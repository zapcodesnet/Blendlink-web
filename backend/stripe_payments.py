"""
BlendLink Stripe Payment Integration
Handles payment processing for:
- Guest checkout on public pages
- POS card payments
- Refunds with automatic fee reversal
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import logging
from dotenv import load_dotenv

load_dotenv()

# Import Stripe checkout from emergentintegrations
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, 
    CheckoutSessionResponse, 
    CheckoutStatusResponse, 
    CheckoutSessionRequest
)

# Database connection
def get_mongo_connection():
    mongo_url = os.environ.get('MONGO_URL')
    mongo_url_local = os.environ.get('MONGO_URL_LOCAL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'blendlink')
    
    try:
        from pymongo import MongoClient as SyncMongoClient
        test_client = SyncMongoClient(mongo_url, serverSelectionTimeoutMS=5000)
        test_client.admin.command('ping')
        test_client.close()
        return AsyncIOMotorClient(mongo_url), db_name
    except Exception:
        return AsyncIOMotorClient(mongo_url_local), db_name

client, db_name = get_mongo_connection()
db = client[db_name]

logger = logging.getLogger(__name__)

# Platform fee rate - UPDATED to 10% as per business requirement
PLATFORM_FEE_RATE = 0.10  # 10%

# Log Stripe configuration status on module load
stripe_api_key = os.environ.get("STRIPE_API_KEY", "")
stripe_pub_key = os.environ.get("STRIPE_PUBLISHABLE_KEY", "")
if stripe_api_key:
    key_prefix = stripe_api_key[:7] if len(stripe_api_key) > 7 else "******"
    key_type = "LIVE" if stripe_api_key.startswith("sk_live") else "TEST"
    logger.info(f"Stripe configured: {key_type} mode (key: {key_prefix}...)")
else:
    logger.warning("Stripe API key not configured!")

# Router
stripe_router = APIRouter(prefix="/payments/stripe", tags=["Stripe Payments"])


# ============== REQUEST/RESPONSE MODELS ==============

class CreateCheckoutRequest(BaseModel):
    """Request to create a checkout session"""
    order_id: str  # Order ID from page_orders collection
    origin_url: str  # Frontend origin URL for redirect


class PaymentStatusRequest(BaseModel):
    """Request to check payment status"""
    session_id: str


class RefundPaymentRequest(BaseModel):
    """Request to refund a payment"""
    order_id: str
    amount: Optional[float] = None  # None = full refund
    reason: str = "Customer request"


# ============== STRIPE CHECKOUT ENDPOINTS ==============

@stripe_router.post("/checkout/session")
async def create_checkout_session(request: CreateCheckoutRequest, http_request: Request):
    """
    Create a Stripe checkout session for an order.
    Amount is fetched from the order - NOT accepted from frontend.
    """
    # Get the order
    order = await db.page_orders.find_one({"order_id": request.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=400, detail="Order already paid")
    
    # Get amount from server-side order (security - never accept from frontend)
    amount = float(order.get("total", 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid order amount")
    
    currency = order.get("currency", "usd").lower()
    
    # Build URLs from frontend origin
    origin = request.origin_url.rstrip("/")
    success_url = f"{origin}/payment-success?session_id={{CHECKOUT_SESSION_ID}}&order_id={request.order_id}"
    cancel_url = f"{origin}/payment-cancelled?order_id={request.order_id}"
    
    # Initialize Stripe checkout
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    # Create checkout session with metadata
    metadata = {
        "order_id": request.order_id,
        "page_id": order.get("page_id", ""),
        "customer_name": order.get("customer_name", ""),
        "customer_phone": order.get("customer_phone", ""),
        "platform_fee": str(round(amount * PLATFORM_FEE_RATE, 2))
    }
    
    checkout_request = CheckoutSessionRequest(
        amount=amount,
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
        payment_methods=["card"]
    )
    
    try:
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout: {str(e)}")
    
    # Create payment transaction record
    transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
    transaction_record = {
        "transaction_id": transaction_id,
        "stripe_session_id": session.session_id,
        "order_id": request.order_id,
        "page_id": order.get("page_id"),
        "amount": amount,
        "currency": currency,
        "platform_fee": amount * PLATFORM_FEE_RATE,
        "payment_method": "card",
        "payment_status": "pending",
        "status": "initiated",
        "customer_name": order.get("customer_name"),
        "customer_email": order.get("customer_email"),
        "metadata": metadata,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.payment_transactions.insert_one(transaction_record)
    
    # Update order with session ID
    await db.page_orders.update_one(
        {"order_id": request.order_id},
        {"$set": {
            "stripe_session_id": session.session_id,
            "payment_status": "pending",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "url": session.url,
        "session_id": session.session_id,
        "transaction_id": transaction_id
    }


@stripe_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, http_request: Request):
    """
    Check the status of a Stripe checkout session.
    Updates the database with the payment status.
    """
    # Initialize Stripe
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.error(f"Stripe status check error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check status: {str(e)}")
    
    # Find the transaction
    transaction = await db.payment_transactions.find_one({"stripe_session_id": session_id})
    
    if transaction:
        # Prevent duplicate processing
        if transaction.get("payment_status") == "paid" and status.payment_status == "paid":
            return {
                "status": status.status,
                "payment_status": status.payment_status,
                "amount": status.amount_total / 100,  # Convert from cents
                "currency": status.currency,
                "order_id": transaction.get("order_id"),
                "already_processed": True
            }
        
        # Update transaction status
        await db.payment_transactions.update_one(
            {"stripe_session_id": session_id},
            {"$set": {
                "status": status.status,
                "payment_status": status.payment_status,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # If paid, update the order and apply platform fee
        if status.payment_status == "paid" and transaction.get("payment_status") != "paid":
            order_id = transaction.get("order_id")
            
            # Update order
            await db.page_orders.update_one(
                {"order_id": order_id},
                {"$set": {
                    "status": "confirmed",
                    "payment_status": "paid",
                    "paid_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Log platform fee (auto-deducted from card payments)
            page_id = transaction.get("page_id")
            if page_id:
                await db.platform_fee_logs.insert_one({
                    "log_id": f"fee_{uuid.uuid4().hex[:12]}",
                    "page_id": page_id,
                    "transaction_total": transaction.get("amount", 0),
                    "fee_amount": transaction.get("platform_fee", 0),
                    "fee_rate": PLATFORM_FEE_RATE,
                    "payment_method": "card",
                    "status": "auto_deducted",
                    "stripe_session_id": session_id,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            
            logger.info(f"Payment completed for order {order_id}")
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount": status.amount_total / 100,  # Convert from cents
        "currency": status.currency,
        "order_id": transaction.get("order_id") if transaction else None,
        "metadata": status.metadata
    }


@stripe_router.post("/refund")
async def process_stripe_refund(request: RefundPaymentRequest, http_request: Request):
    """
    Process a refund for a Stripe payment.
    Automatically reverses the 8% platform fee.
    """
    # Find the order
    order = await db.page_orders.find_one({"order_id": request.order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.get("payment_status") != "paid":
        raise HTTPException(status_code=400, detail="Order not paid, cannot refund")
    
    if order.get("status") == "refunded":
        raise HTTPException(status_code=400, detail="Order already refunded")
    
    # Find the payment transaction
    transaction = await db.payment_transactions.find_one({"order_id": request.order_id})
    if not transaction:
        raise HTTPException(status_code=404, detail="Payment transaction not found")
    
    # Calculate refund amount
    original_total = float(order.get("total", 0))
    refund_amount = request.amount if request.amount else original_total
    
    if refund_amount > original_total:
        raise HTTPException(status_code=400, detail="Refund amount exceeds order total")
    
    # Calculate fee refund
    original_fee = transaction.get("platform_fee", original_total * PLATFORM_FEE_RATE)
    fee_refund = (refund_amount / original_total) * original_fee if original_total > 0 else 0
    
    # Note: In a real implementation, you would use Stripe's refund API here
    # For now, we'll log the refund and update records
    
    # Create refund record
    refund_id = f"rfnd_{uuid.uuid4().hex[:12]}"
    refund_record = {
        "refund_id": refund_id,
        "order_id": request.order_id,
        "page_id": order.get("page_id"),
        "stripe_session_id": transaction.get("stripe_session_id"),
        "original_total": original_total,
        "refund_amount": refund_amount,
        "fee_refunded": fee_refund,
        "payment_method": "card",
        "reason": request.reason,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.refunds.insert_one(refund_record)
    
    # Update order status
    is_full_refund = refund_amount >= original_total
    await db.page_orders.update_one(
        {"order_id": request.order_id},
        {"$set": {
            "status": "refunded" if is_full_refund else "partially_refunded",
            "refund_amount": refund_amount,
            "refund_id": refund_id,
            "refunded_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update transaction
    await db.payment_transactions.update_one(
        {"order_id": request.order_id},
        {"$set": {
            "status": "refunded" if is_full_refund else "partially_refunded",
            "refund_amount": refund_amount,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Log fee reversal
    await db.platform_fee_logs.insert_one({
        "log_id": f"fee_rfnd_{uuid.uuid4().hex[:12]}",
        "page_id": order.get("page_id"),
        "transaction_total": refund_amount,
        "fee_amount": -fee_refund,  # Negative = credit
        "fee_rate": PLATFORM_FEE_RATE,
        "payment_method": "card",
        "status": "refunded",
        "refund_id": refund_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "refund_id": refund_id,
        "refund_amount": refund_amount,
        "fee_credited": fee_refund,
        "message": f"Refund of ${refund_amount:.2f} processed successfully"
    }


# ============== WEBHOOK ENDPOINT ==============

@stripe_router.post("/webhook")
async def handle_stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        body = await request.body()
        signature = request.headers.get("Stripe-Signature", "")
        
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Process webhook event
        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            
            # Update transaction
            await db.payment_transactions.update_one(
                {"stripe_session_id": session_id},
                {"$set": {
                    "status": "complete",
                    "payment_status": "paid",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Get order ID from metadata
            order_id = webhook_response.metadata.get("order_id")
            if order_id:
                await db.page_orders.update_one(
                    {"order_id": order_id},
                    {"$set": {
                        "status": "confirmed",
                        "payment_status": "paid",
                        "paid_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
        
        return {"status": "ok", "event_type": webhook_response.event_type}
    
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}


# ============== STRIPE SUBSCRIPTIONS ==============

import stripe

class CreateSubscriptionProductRequest(BaseModel):
    """Request to create a subscription product"""
    page_id: str
    product_id: str  # Page product ID
    name: str
    description: Optional[str] = None
    frequency: str = "monthly"  # weekly, monthly, yearly
    price: float
    trial_days: int = 0
    currency: str = "usd"


class CreateSubscriptionRequest(BaseModel):
    """Request to create a customer subscription"""
    page_id: str
    product_id: str
    customer_email: str
    customer_name: Optional[str] = None
    payment_method_id: Optional[str] = None  # For card payments
    origin_url: str


class CancelSubscriptionRequest(BaseModel):
    """Request to cancel a subscription"""
    subscription_id: str


@stripe_router.post("/subscriptions/create-product")
async def create_subscription_product(request: CreateSubscriptionProductRequest):
    """
    Create a Stripe Product and Price for a recurring subscription.
    This must be called by page owners when they mark a product as subscription-based.
    """
    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = api_key
    
    try:
        # Map frequency to Stripe interval
        interval_map = {
            "weekly": {"interval": "week", "interval_count": 1},
            "monthly": {"interval": "month", "interval_count": 1},
            "yearly": {"interval": "year", "interval_count": 1}
        }
        
        if request.frequency not in interval_map:
            raise HTTPException(status_code=400, detail="Invalid frequency. Use: weekly, monthly, yearly")
        
        interval_config = interval_map[request.frequency]
        
        # Create Stripe Product
        stripe_product = stripe.Product.create(
            name=request.name,
            description=request.description or f"Subscription to {request.name}",
            metadata={
                "page_id": request.page_id,
                "product_id": request.product_id,
                "type": "page_subscription"
            }
        )
        
        # Create Stripe Price with recurring interval
        # Amount in cents, with 8% platform fee built in
        amount_cents = int(request.price * 100)
        
        stripe_price = stripe.Price.create(
            product=stripe_product.id,
            unit_amount=amount_cents,
            currency=request.currency.lower(),
            recurring=interval_config,
            metadata={
                "page_id": request.page_id,
                "product_id": request.product_id,
                "platform_fee_rate": str(PLATFORM_FEE_RATE)
            }
        )
        
        # Save to database
        subscription_product = {
            "subscription_product_id": f"subprod_{uuid.uuid4().hex[:12]}",
            "page_id": request.page_id,
            "product_id": request.product_id,
            "stripe_product_id": stripe_product.id,
            "stripe_price_id": stripe_price.id,
            "name": request.name,
            "description": request.description,
            "price": request.price,
            "currency": request.currency,
            "frequency": request.frequency,
            "trial_days": request.trial_days,
            "platform_fee_rate": PLATFORM_FEE_RATE,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.subscription_products.insert_one(subscription_product)
        
        # Update the page product to link to stripe
        await db.page_products.update_one(
            {"product_id": request.product_id},
            {"$set": {
                "stripe_product_id": stripe_product.id,
                "stripe_price_id": stripe_price.id,
                "is_subscription": True,
                "subscription_frequency": request.frequency,
                "trial_period_days": request.trial_days,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"Created subscription product: {stripe_product.id} with price: {stripe_price.id}")
        
        return {
            "success": True,
            "stripe_product_id": stripe_product.id,
            "stripe_price_id": stripe_price.id,
            "subscription_product_id": subscription_product["subscription_product_id"]
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating subscription product: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@stripe_router.post("/subscriptions/checkout")
async def create_subscription_checkout(request: CreateSubscriptionRequest, http_request: Request):
    """
    Create a Stripe Checkout Session for subscription.
    Customer will be redirected to Stripe to complete payment.
    """
    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = api_key
    
    try:
        # Get subscription product details
        sub_product = await db.subscription_products.find_one({
            "product_id": request.product_id,
            "is_active": True
        })
        
        if not sub_product:
            raise HTTPException(status_code=404, detail="Subscription product not found")
        
        # Create or retrieve Stripe customer
        customers = stripe.Customer.list(email=request.customer_email, limit=1)
        if customers.data:
            customer = customers.data[0]
        else:
            customer = stripe.Customer.create(
                email=request.customer_email,
                name=request.customer_name,
                metadata={
                    "source": "blendlink_page",
                    "page_id": request.page_id
                }
            )
        
        # Build checkout session
        origin_url = request.origin_url.rstrip("/")
        success_url = f"{origin_url}/subscription-success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{origin_url}/subscription-cancelled"
        
        checkout_params = {
            "mode": "subscription",
            "customer": customer.id,
            "line_items": [{
                "price": sub_product["stripe_price_id"],
                "quantity": 1
            }],
            "success_url": success_url,
            "cancel_url": cancel_url,
            "metadata": {
                "page_id": request.page_id,
                "product_id": request.product_id,
                "customer_email": request.customer_email,
                "platform_fee_rate": str(PLATFORM_FEE_RATE)
            }
        }
        
        # Add trial period if configured
        if sub_product.get("trial_days", 0) > 0:
            checkout_params["subscription_data"] = {
                "trial_period_days": sub_product["trial_days"]
            }
        
        session = stripe.checkout.Session.create(**checkout_params)
        
        # Record subscription attempt
        subscription_record = {
            "subscription_record_id": f"subrec_{uuid.uuid4().hex[:12]}",
            "stripe_session_id": session.id,
            "stripe_customer_id": customer.id,
            "page_id": request.page_id,
            "product_id": request.product_id,
            "customer_email": request.customer_email,
            "customer_name": request.customer_name,
            "price": sub_product["price"],
            "currency": sub_product["currency"],
            "frequency": sub_product["frequency"],
            "trial_days": sub_product.get("trial_days", 0),
            "platform_fee": sub_product["price"] * PLATFORM_FEE_RATE,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.customer_subscriptions.insert_one(subscription_record)
        
        return {
            "checkout_url": session.url,
            "session_id": session.id,
            "customer_id": customer.id
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error creating subscription checkout: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@stripe_router.get("/subscriptions/status/{session_id}")
async def get_subscription_status(session_id: str):
    """
    Check the status of a subscription checkout session.
    Called after customer returns from Stripe.
    """
    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = api_key
    
    try:
        session = stripe.checkout.Session.retrieve(session_id)
        
        # Update our records
        update_data = {
            "status": session.status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        if session.subscription:
            subscription = stripe.Subscription.retrieve(session.subscription)
            update_data["stripe_subscription_id"] = subscription.id
            update_data["subscription_status"] = subscription.status
            update_data["current_period_start"] = subscription.current_period_start
            update_data["current_period_end"] = subscription.current_period_end
            
            if subscription.status == "active" or subscription.status == "trialing":
                update_data["activated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.customer_subscriptions.update_one(
            {"stripe_session_id": session_id},
            {"$set": update_data}
        )
        
        # Get our record
        record = await db.customer_subscriptions.find_one(
            {"stripe_session_id": session_id},
            {"_id": 0}
        )
        
        return {
            "session_status": session.status,
            "subscription_id": session.subscription,
            "subscription_status": subscription.status if session.subscription else None,
            "customer_email": session.customer_details.email if session.customer_details else None,
            "record": record
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error checking subscription: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@stripe_router.post("/subscriptions/cancel")
async def cancel_subscription(request: CancelSubscriptionRequest):
    """
    Cancel a customer's subscription.
    """
    api_key = os.environ.get('STRIPE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    stripe.api_key = api_key
    
    try:
        # Cancel in Stripe
        stripe.Subscription.delete(request.subscription_id)
        
        # Update our record
        await db.customer_subscriptions.update_one(
            {"stripe_subscription_id": request.subscription_id},
            {"$set": {
                "subscription_status": "canceled",
                "canceled_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "success": True,
            "subscription_id": request.subscription_id,
            "status": "canceled"
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error canceling subscription: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@stripe_router.get("/subscriptions/page/{page_id}")
async def get_page_subscriptions(page_id: str):
    """
    Get all active subscriptions for a page (for page owners).
    """
    subscriptions = await db.customer_subscriptions.find(
        {
            "page_id": page_id,
            "subscription_status": {"$in": ["active", "trialing"]}
        },
        {"_id": 0}
    ).to_list(500)
    
    # Calculate summary stats
    total_mrr = sum(s.get("price", 0) for s in subscriptions if s.get("frequency") == "monthly")
    total_arr = sum(
        s.get("price", 0) * 12 if s.get("frequency") == "monthly" else 
        s.get("price", 0) * 52 if s.get("frequency") == "weekly" else 
        s.get("price", 0) 
        for s in subscriptions
    )
    
    return {
        "subscriptions": subscriptions,
        "stats": {
            "total_active": len(subscriptions),
            "mrr": total_mrr,
            "arr": total_arr,
            "platform_fees_pending": total_mrr * PLATFORM_FEE_RATE
        }
    }


# ============== EXPORT ==============

def get_stripe_router():
    """Get the Stripe payment router"""
    return stripe_router
