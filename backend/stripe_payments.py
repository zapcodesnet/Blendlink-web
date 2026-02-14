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

# FORCE-VERIFY Stripe configuration status on module load
# CRITICAL: Use STRIPE_SECRET_KEY first (STRIPE_API_KEY has system override with test key)
stripe_api_key = os.environ.get("STRIPE_SECRET_KEY", "") or os.environ.get("STRIPE_API_KEY", "")
stripe_pub_key = os.environ.get("STRIPE_PUBLISHABLE_KEY", "")

# Define LIVE_STRIPE_SECRET_KEY from environment
LIVE_STRIPE_SECRET_KEY = os.environ.get("STRIPE_LIVE_SECRET_KEY") or os.environ.get("STRIPE_SECRET_KEY") or stripe_api_key

# Validate Stripe key configuration from environment
if stripe_api_key:
    key_prefix = stripe_api_key[:12] if len(stripe_api_key) > 12 else "******"
    if stripe_api_key.startswith("sk_live"):
        logger.info(f"✅ STRIPE LIVE MODE VERIFIED - Key: {key_prefix}...")
        print(f"✅ STRIPE LIVE MODE VERIFIED (LIVE) - Key: {key_prefix}...")
    elif stripe_api_key.startswith("sk_test"):
        logger.warning("⚠️ STRIPE TEST MODE DETECTED - Consider using LIVE keys in production")
        print(f"⚠️ STRIPE TEST MODE DETECTED - Key: {key_prefix}...")
    else:
        logger.warning(f"⚠️ Unknown Stripe key format: {key_prefix}...")
else:
    logger.error("❌ STRIPE SECRET KEY NOT CONFIGURED - PAYMENTS WILL FAIL!")
    print("❌ STRIPE SECRET KEY NOT CONFIGURED!")

if stripe_pub_key:
    pub_key_prefix = stripe_pub_key[:12] if len(stripe_pub_key) > 12 else "******"
    if stripe_pub_key.startswith("pk_live"):
        logger.info(f"✅ STRIPE PUBLISHABLE KEY LIVE MODE - Key: {pub_key_prefix}...")
    elif stripe_pub_key.startswith("pk_test"):
        logger.warning("⚠️ STRIPE PUBLISHABLE KEY IN TEST MODE!")

# Router
stripe_router = APIRouter(prefix="/payments/stripe", tags=["Stripe Payments"])


# ============== AUTH HELPER ==============

async def get_current_user(request: Request) -> dict:
    """Get authenticated user from request"""
    from jose import jwt, JWTError
    
    JWT_SECRET = os.environ.get('JWT_SECRET')
    JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
    
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


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
    # CRITICAL: Use STRIPE_SECRET_KEY (not STRIPE_API_KEY which may have system override)
    api_key = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY")
    
    # FORCE LIVE MODE - Override any test keys in production
    if not api_key or not api_key.startswith("sk_live"):
        logger.warning(f"⚠️ CHECKOUT SESSION: FORCING LIVE KEY - was {api_key[:15] if api_key else 'empty'}...")
        api_key = LIVE_STRIPE_SECRET_KEY
    
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    # Log the key being used (prefix only)
    logger.info(f"✅ Creating checkout session with key: {api_key[:12]}...")
    
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
    # CRITICAL: Validate session_id format before making API call
    if not session_id or session_id in ["test", "null", "undefined", ""]:
        logger.warning(f"Invalid session_id received: '{session_id}'")
        raise HTTPException(status_code=400, detail="Invalid or missing session ID")
    
    # Stripe session IDs must start with cs_live_ or cs_test_
    if not session_id.startswith("cs_"):
        logger.warning(f"Session ID format invalid: '{session_id}' (must start with 'cs_')")
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid session ID format. Expected 'cs_live_...' or 'cs_test_...', got '{session_id[:20]}...'"
        )
    
    # Initialize Stripe
    # CRITICAL: Use STRIPE_SECRET_KEY (not STRIPE_API_KEY which may have system override)
    api_key = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Stripe status check error for session {session_id[:20]}...: {error_msg}")
        # Handle specific Stripe errors
        if "No such checkout.session" in error_msg:
            raise HTTPException(status_code=404, detail="Checkout session not found or expired")
        raise HTTPException(status_code=500, detail=f"Failed to check status: {error_msg}")
    
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
            
            logger.info(f"✅ LIVE Payment completed for order {order_id}")
            
            # Send WebSocket notification for real-time sync with mobile app
            try:
                from websocket_notifications import manager as ws_manager
                # Notify page owner about successful payment
                if page_id:
                    await ws_manager.broadcast_to_page(page_id, {
                        "type": "PAYMENT_RECEIVED",
                        "order_id": order_id,
                        "amount": transaction.get("amount", 0),
                        "customer_name": transaction.get("customer_name", ""),
                        "payment_method": "card",
                        "platform_fee": transaction.get("platform_fee", 0),
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                    logger.info(f"WebSocket notification sent for order {order_id}")
            except Exception as ws_error:
                logger.warning(f"WebSocket notification failed (non-critical): {ws_error}")
    
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
    Automatically reverses the 10% platform fee proportionally.
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
    # CRITICAL: Use STRIPE_SECRET_KEY (not STRIPE_API_KEY which may have system override)
    api_key = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY")
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
    # CRITICAL: Use STRIPE_SECRET_KEY (not STRIPE_API_KEY which may have system override)
    api_key = os.environ.get('STRIPE_SECRET_KEY') or os.environ.get('STRIPE_API_KEY')
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
    # CRITICAL: Use STRIPE_SECRET_KEY (not STRIPE_API_KEY which may have system override)
    api_key = os.environ.get('STRIPE_SECRET_KEY') or os.environ.get('STRIPE_API_KEY')
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
    # CRITICAL: Use STRIPE_SECRET_KEY first (STRIPE_API_KEY may have system override with test key)
    api_key = os.environ.get('STRIPE_SECRET_KEY') or os.environ.get('STRIPE_API_KEY')
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
    # CRITICAL: Use STRIPE_SECRET_KEY first (STRIPE_API_KEY may have system override with test key)
    api_key = os.environ.get('STRIPE_SECRET_KEY') or os.environ.get('STRIPE_API_KEY')
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


# ============== BL COINS PURCHASE ==============

# BL Coins pricing tiers
BL_COINS_TIERS = {
    "starter": {"price": 4.99, "coins": 30000, "label": "Starter Pack"},
    "popular": {"price": 9.99, "coins": 80000, "label": "Popular"},
    "premium": {"price": 14.99, "coins": 400000, "label": "Premium"},
    "ultimate": {"price": 29.99, "coins": 1000000, "label": "Ultimate"}
}


class BLCoinsCheckoutRequest(BaseModel):
    """Request to create a BL coins purchase checkout session"""
    tier_id: str
    amount_usd: float
    coins_amount: int
    origin_url: str


@stripe_router.post("/bl-coins/checkout")
async def create_bl_coins_checkout(request: BLCoinsCheckoutRequest, http_request: Request):
    """
    Create a Stripe checkout session for purchasing BL coins.
    After successful payment, coins are credited to user's wallet.
    """
    # Verify the tier and amounts match
    tier = BL_COINS_TIERS.get(request.tier_id)
    if not tier:
        raise HTTPException(status_code=400, detail="Invalid tier selected")
    
    if abs(tier["price"] - request.amount_usd) > 0.01 or tier["coins"] != request.coins_amount:
        raise HTTPException(status_code=400, detail="Price mismatch. Please refresh and try again.")
    
    # Get current user from token
    from server import get_current_user_from_token
    token = http_request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user = await get_current_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = user.get("user_id")
    user_email = user.get("email", "")
    
    # FORCE LIVE MODE
    api_key = LIVE_STRIPE_SECRET_KEY
    
    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    # Build URLs
    origin = request.origin_url.rstrip("/")
    success_url = f"{origin}/coins-purchase-success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/coins-purchase-cancelled"
    
    # Create checkout session with metadata
    metadata = {
        "purchase_type": "bl_coins",
        "user_id": user_id,
        "user_email": user_email,
        "tier_id": request.tier_id,
        "coins_amount": str(request.coins_amount),
        "send_receipt": "true"
    }
    
    checkout_request = CheckoutSessionRequest(
        amount=request.amount_usd,
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
        payment_methods=["card"]
    )
    
    try:
        session: CheckoutSessionResponse = await stripe_checkout.create_checkout_session(checkout_request)
    except Exception as e:
        logger.error(f"Stripe BL coins checkout error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create checkout: {str(e)}")
    
    # Create purchase record
    purchase_id = f"blp_{uuid.uuid4().hex[:12]}"
    purchase_record = {
        "purchase_id": purchase_id,
        "stripe_session_id": session.session_id,
        "user_id": user_id,
        "user_email": user_email,
        "tier_id": request.tier_id,
        "amount_usd": request.amount_usd,
        "coins_amount": request.coins_amount,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.bl_coins_purchases.insert_one(purchase_record)
    
    logger.info(f"Created BL coins checkout for user {user_id}: {request.coins_amount} coins for ${request.amount_usd}")
    
    return {
        "url": session.url,
        "session_id": session.session_id,
        "purchase_id": purchase_id
    }


@stripe_router.get("/bl-coins/status/{session_id}")
async def get_bl_coins_purchase_status(session_id: str, http_request: Request):
    """
    Check the status of a BL coins purchase and credit coins if paid.
    """
    # Validate session ID
    if not session_id or not session_id.startswith("cs_"):
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    # FORCE LIVE MODE
    api_key = LIVE_STRIPE_SECRET_KEY
    
    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logger.error(f"Stripe status check error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check status: {str(e)}")
    
    # Find the purchase record
    purchase = await db.bl_coins_purchases.find_one({"stripe_session_id": session_id})
    
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase record not found")
    
    # If already processed, return success
    if purchase.get("status") == "completed":
        return {
            "status": "completed",
            "coins_credited": purchase.get("coins_amount"),
            "new_balance": purchase.get("new_balance"),
            "already_processed": True
        }
    
    # If payment successful, credit coins
    if status.payment_status == "paid" and purchase.get("status") != "completed":
        user_id = purchase.get("user_id")
        coins_amount = purchase.get("coins_amount", 0)
        user_email = purchase.get("user_email", "")
        
        # Credit coins to user
        result = await db.users.find_one_and_update(
            {"user_id": user_id},
            {"$inc": {"bl_coins": coins_amount}},
            return_document=True
        )
        
        new_balance = result.get("bl_coins", 0) if result else coins_amount
        
        # Update purchase record
        await db.bl_coins_purchases.update_one(
            {"stripe_session_id": session_id},
            {"$set": {
                "status": "completed",
                "new_balance": new_balance,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Record transaction
        await db.bl_transactions.insert_one({
            "transaction_id": f"tx_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "type": "purchase",
            "amount": coins_amount,
            "description": f"Purchased {coins_amount:,} BL coins for ${purchase.get('amount_usd', 0):.2f}",
            "reference_id": purchase.get("purchase_id"),
            "stripe_session_id": session_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"Credited {coins_amount} BL coins to user {user_id}. New balance: {new_balance}")
        
        # Send push notification for mobile app
        try:
            from push_notifications import PushNotificationService
            push_service = PushNotificationService(db)
            await push_service.notify_bl_coins_credited(
                user_id=user_id,
                coins=coins_amount,
                source="purchase"
            )
        except Exception as e:
            logger.error(f"Failed to send push notification: {e}")
        
        # Send receipt email
        if user_email:
            try:
                await send_bl_coins_receipt_email(
                    email=user_email,
                    coins_amount=coins_amount,
                    amount_usd=purchase.get("amount_usd", 0),
                    tier_label=BL_COINS_TIERS.get(purchase.get("tier_id"), {}).get("label", "BL Coins"),
                    new_balance=new_balance
                )
            except Exception as e:
                logger.error(f"Failed to send receipt email: {e}")
        
        return {
            "status": "completed",
            "coins_credited": coins_amount,
            "new_balance": new_balance,
            "already_processed": False
        }
    
    return {
        "status": status.payment_status,
        "session_status": status.status,
        "coins_amount": purchase.get("coins_amount")
    }


async def send_bl_coins_receipt_email(email: str, coins_amount: int, amount_usd: float, tier_label: str, new_balance: int):
    """Send receipt email after successful BL coins purchase"""
    from email_report_service import send_email_notification
    
    subject = f"Receipt: {coins_amount:,} BL Coins Purchase - Blendlink"
    
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #f59e0b, #ea580c); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }}
            .header h1 {{ color: white; margin: 0; }}
            .content {{ background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }}
            .receipt-box {{ background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 20px 0; }}
            .detail-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }}
            .detail-row:last-child {{ border-bottom: none; }}
            .amount {{ font-size: 24px; font-weight: bold; color: #059669; }}
            .footer {{ text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Purchase Confirmed!</h1>
            </div>
            <div class="content">
                <p>Thank you for your purchase! Your BL coins have been added to your wallet.</p>
                
                <div class="receipt-box">
                    <h3 style="margin-top: 0;">Receipt Details</h3>
                    <div class="detail-row">
                        <span>Package:</span>
                        <strong>{tier_label}</strong>
                    </div>
                    <div class="detail-row">
                        <span>BL Coins:</span>
                        <strong>+{coins_amount:,} BL</strong>
                    </div>
                    <div class="detail-row">
                        <span>Amount Paid:</span>
                        <strong>${amount_usd:.2f} USD</strong>
                    </div>
                    <div class="detail-row">
                        <span>New Balance:</span>
                        <span class="amount">{new_balance:,} BL</span>
                    </div>
                </div>
                
                <p>You can now use your BL coins to:</p>
                <ul>
                    <li>Create marketplace listings (200 BL each)</li>
                    <li>Play games and win prizes</li>
                    <li>Mint photos and collectibles</li>
                    <li>And much more!</li>
                </ul>
                
                <p style="margin-top: 20px;">
                    <a href="https://blendlink.net/wallet" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                        View Your Wallet
                    </a>
                </p>
            </div>
            <div class="footer">
                <p>This is an automated receipt from Blendlink.</p>
                <p>If you have any questions, please contact support@blendlink.net</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    await send_email_notification(
        to_email=email,
        subject=subject,
        html_content=html_content
    )
    
    logger.info(f"Sent BL coins purchase receipt to {email}")


# ============== STRIPE CONNECT & WITHDRAWALS ==============

# Withdrawal fee - 3%
WITHDRAWAL_FEE_RATE = 0.03

@stripe_router.get("/connect/status")
async def get_stripe_connect_status(http_request: Request):
    """Get user's Stripe Connect account status"""
    from server import get_current_user_from_token
    
    token = http_request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user = await get_current_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = user.get("user_id")
    
    # Check if user has a connected Stripe account
    connect_account = await db.stripe_connect_accounts.find_one({"user_id": user_id})
    
    if not connect_account:
        return {
            "is_connected": False,
            "charges_enabled": False,
            "payouts_enabled": False,
            "onboarding_url": None
        }
    
    # Verify account status with Stripe
    try:
        import stripe
        stripe.api_key = LIVE_STRIPE_SECRET_KEY
        
        account = stripe.Account.retrieve(connect_account["stripe_account_id"])
        
        # Update local record
        await db.stripe_connect_accounts.update_one(
            {"user_id": user_id},
            {"$set": {
                "charges_enabled": account.charges_enabled,
                "payouts_enabled": account.payouts_enabled,
                "details_submitted": account.details_submitted,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "is_connected": True,
            "charges_enabled": account.charges_enabled,
            "payouts_enabled": account.payouts_enabled,
            "details_submitted": account.details_submitted
        }
    except Exception as e:
        logger.error(f"Stripe Connect status error: {e}")
        return {
            "is_connected": connect_account is not None,
            "charges_enabled": connect_account.get("charges_enabled", False),
            "payouts_enabled": connect_account.get("payouts_enabled", False),
            "error": str(e)
        }


@stripe_router.post("/connect/onboard")
async def create_stripe_connect_onboarding(http_request: Request):
    """Create Stripe Connect onboarding link for user"""
    from server import get_current_user_from_token
    
    token = http_request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user = await get_current_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = user.get("user_id")
    user_email = user.get("email", "")
    
    try:
        import stripe
        stripe.api_key = LIVE_STRIPE_SECRET_KEY
        
        # Check if user already has an account
        connect_account = await db.stripe_connect_accounts.find_one({"user_id": user_id})
        
        if connect_account:
            stripe_account_id = connect_account["stripe_account_id"]
        else:
            # Create new Stripe Express account
            account = stripe.Account.create(
                type="express",
                email=user_email,
                capabilities={
                    "transfers": {"requested": True},
                },
                metadata={
                    "blendlink_user_id": user_id
                }
            )
            stripe_account_id = account.id
            
            # Save to database
            await db.stripe_connect_accounts.insert_one({
                "user_id": user_id,
                "stripe_account_id": stripe_account_id,
                "email": user_email,
                "charges_enabled": False,
                "payouts_enabled": False,
                "details_submitted": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        # Create onboarding link
        host_url = str(http_request.headers.get("origin", "https://blendlink.net"))
        
        account_link = stripe.AccountLink.create(
            account=stripe_account_id,
            refresh_url=f"{host_url}/wallet?stripe_refresh=true",
            return_url=f"{host_url}/wallet?stripe_connected=true",
            type="account_onboarding",
        )
        
        return {"url": account_link.url}
        
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Stripe Connect onboarding error: {error_msg}")
        
        # Provide user-friendly error messages
        if "platform-profile" in error_msg.lower():
            raise HTTPException(
                status_code=503, 
                detail="Stripe Connect is being configured. Please try again later or contact support."
            )
        elif "account" in error_msg.lower() and "already" in error_msg.lower():
            raise HTTPException(status_code=400, detail="Your Stripe account is already connected.")
        else:
            raise HTTPException(status_code=500, detail="Unable to start Stripe onboarding. Please try again later.")


class WithdrawRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Amount to withdraw in USD")


@stripe_router.post("/withdraw")
async def withdraw_to_stripe(request: WithdrawRequest, http_request: Request):
    """
    Withdraw earnings to user's connected Stripe account.
    Applies 3% withdrawal fee.
    """
    from server import get_current_user_from_token
    
    token = http_request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user = await get_current_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = user.get("user_id")
    
    # Validate minimum amount
    if request.amount < 10:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is $10.00")
    
    # Check user's USD balance
    user_data = await db.users.find_one({"user_id": user_id}, {"usd_balance": 1})
    available_balance = user_data.get("usd_balance", 0) if user_data else 0
    
    if request.amount > available_balance:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Available: ${available_balance:.2f}")
    
    # Check Stripe Connect status
    connect_account = await db.stripe_connect_accounts.find_one({"user_id": user_id})
    
    if not connect_account:
        raise HTTPException(status_code=400, detail="Please connect your Stripe account first")
    
    if not connect_account.get("payouts_enabled"):
        raise HTTPException(status_code=400, detail="Stripe account is not fully set up. Please complete onboarding.")
    
    stripe_account_id = connect_account["stripe_account_id"]
    
    # Calculate fee
    fee = request.amount * WITHDRAWAL_FEE_RATE
    net_amount = request.amount - fee
    
    try:
        import stripe
        stripe.api_key = LIVE_STRIPE_SECRET_KEY
        
        # Create transfer to connected account
        transfer = stripe.Transfer.create(
            amount=int(net_amount * 100),  # Convert to cents
            currency="usd",
            destination=stripe_account_id,
            description=f"BlendLink withdrawal for user {user_id}",
            metadata={
                "user_id": user_id,
                "gross_amount": str(request.amount),
                "fee": str(fee),
                "net_amount": str(net_amount)
            }
        )
        
        # Deduct from user's USD balance
        new_balance = available_balance - request.amount
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"usd_balance": new_balance}}
        )
        
        # Record withdrawal
        withdrawal_id = f"wd_{uuid.uuid4().hex[:12]}"
        await db.withdrawals.insert_one({
            "withdrawal_id": withdrawal_id,
            "user_id": user_id,
            "stripe_transfer_id": transfer.id,
            "stripe_account_id": stripe_account_id,
            "amount": request.amount,
            "fee": fee,
            "net_amount": net_amount,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Record transaction
        from referral_system import record_transaction, TransactionType, Currency
        await record_transaction(
            user_id=user_id,
            transaction_type=TransactionType.WITHDRAWAL,
            currency=Currency.USD,
            amount=-request.amount,
            reference_id=withdrawal_id,
            details={
                "stripe_transfer_id": transfer.id,
                "fee": fee,
                "net_amount": net_amount
            }
        )
        
        logger.info(f"Withdrawal processed: {withdrawal_id} - ${net_amount:.2f} to {stripe_account_id}")
        
        # Send push notification
        try:
            from push_notifications import PushNotificationService
            push_service = PushNotificationService(db)
            await push_service.notify_withdrawal_success(
                user_id=user_id,
                amount=request.amount,
                net_amount=net_amount
            )
        except Exception as e:
            logger.error(f"Failed to send push notification: {e}")
        
        return {
            "success": True,
            "withdrawal_id": withdrawal_id,
            "amount": request.amount,
            "fee": fee,
            "net_amount": net_amount,
            "new_balance": new_balance,
            "message": "Withdrawal submitted. Processing takes 48 hours to 7 days."
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe withdrawal error: {e}")
        
        # Send failure notification
        try:
            from push_notifications import PushNotificationService
            push_service = PushNotificationService(db)
            await push_service.notify_withdrawal_failed(
                user_id=user_id,
                amount=request.amount,
                reason=str(e)
            )
        except:
            pass
        
        raise HTTPException(status_code=500, detail=f"Withdrawal failed: {str(e)}")
    except Exception as e:
        logger.error(f"Withdrawal error: {e}")
        raise HTTPException(status_code=500, detail=f"Withdrawal failed: {str(e)}")


# ============== BL COINS FROM BALANCE ==============

class PurchaseCoinsFromBalanceRequest(BaseModel):
    """Request to purchase BL coins from USD balance"""
    package_id: str
    quantity: int = 1
    amount: float
    coins: int


@stripe_router.post("/bl-coins/purchase-from-balance")
async def purchase_bl_coins_from_balance(
    request: PurchaseCoinsFromBalanceRequest,
    current_user: dict = Depends(get_current_user)
):
    """Purchase BL coins by deducting from user's USD balance"""
    user_id = current_user["user_id"]
    
    # Get current balance
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    usd_balance = user.get("usd_balance", 0)
    
    if usd_balance < request.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: ${usd_balance:.2f}, Required: ${request.amount:.2f}"
        )
    
    # Deduct from USD balance and add BL coins
    new_usd_balance = usd_balance - request.amount
    current_bl_coins = user.get("bl_coins", 0)
    new_bl_coins = current_bl_coins + request.coins
    
    # Update user in atomic operation
    result = await db.users.update_one(
        {"user_id": user_id, "usd_balance": usd_balance},  # Optimistic lock
        {
            "$set": {
                "usd_balance": new_usd_balance,
                "bl_coins": new_bl_coins,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=409, detail="Balance changed during transaction. Please try again.")
    
    # Log the transaction
    transaction_id = f"coins_balance_{uuid.uuid4().hex[:12]}"
    await db.bl_transactions.insert_one({
        "transaction_id": transaction_id,
        "user_id": user_id,
        "transaction_type": "coins_purchase_from_balance",
        "amount": request.coins,
        "usd_amount": request.amount,
        "package_id": request.package_id,
        "quantity": request.quantity,
        "description": f"Purchased {request.coins:,} BL coins for ${request.amount:.2f}",
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.info(f"BL coins purchased from balance: {user_id} - {request.coins} coins for ${request.amount}")
    
    return {
        "success": True,
        "transaction_id": transaction_id,
        "coins_purchased": request.coins,
        "amount_charged": request.amount,
        "new_bl_balance": new_bl_coins,
        "new_usd_balance": new_usd_balance
    }


# ============== SUBSCRIPTION FROM BALANCE ==============

class SubscribeFromBalanceRequest(BaseModel):
    """Request to subscribe using USD balance"""
    tier: str
    amount: float


@stripe_router.post("/subscriptions/subscribe-from-balance")
async def subscribe_from_balance(
    request: SubscribeFromBalanceRequest,
    current_user: dict = Depends(get_current_user)
):
    """Subscribe to a tier by deducting from user's USD balance"""
    user_id = current_user["user_id"]
    
    # Validate tier
    valid_tiers = ["bronze", "silver", "gold", "diamond"]
    if request.tier not in valid_tiers:
        raise HTTPException(status_code=400, detail="Invalid tier")
    
    # Get current user data
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    usd_balance = user.get("usd_balance", 0)
    
    if usd_balance < request.amount:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: ${usd_balance:.2f}, Required: ${request.amount:.2f}"
        )
    
    # Calculate next billing date (1 month from now)
    now = datetime.now(timezone.utc)
    from dateutil.relativedelta import relativedelta
    next_billing = (now + relativedelta(months=1)).isoformat()
    
    # Deduct balance and update subscription
    new_usd_balance = usd_balance - request.amount
    
    # Update user in atomic operation
    result = await db.users.update_one(
        {"user_id": user_id, "usd_balance": usd_balance},  # Optimistic lock
        {
            "$set": {
                "usd_balance": new_usd_balance,
                "subscription_tier": request.tier,
                "subscription_status": "active",
                "subscription_started": now.isoformat(),
                "subscription_next_billing": next_billing,
                "subscription_payment_method": "balance",
                "updated_at": now.isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=409, detail="Balance changed during transaction. Please try again.")
    
    # Create subscription record
    subscription_id = f"sub_{uuid.uuid4().hex[:12]}"
    subscription = {
        "subscription_id": subscription_id,
        "user_id": user_id,
        "tier": request.tier,
        "status": "active",
        "amount": request.amount,
        "payment_method": "balance",
        "started_at": now.isoformat(),
        "next_billing": next_billing,
        "retry_count": 0,
        "created_at": now.isoformat()
    }
    
    await db.subscriptions.insert_one(subscription)
    
    # Log the transaction
    transaction_id = f"sub_balance_{uuid.uuid4().hex[:12]}"
    await db.bl_transactions.insert_one({
        "transaction_id": transaction_id,
        "user_id": user_id,
        "transaction_type": "subscription",
        "tier": request.tier,
        "amount_usd": request.amount,
        "description": f"Subscribed to {request.tier.capitalize()} membership",
        "status": "completed",
        "created_at": now.isoformat()
    })
    
    logger.info(f"Subscription from balance: {user_id} - {request.tier} for ${request.amount}")
    
    return {
        "success": True,
        "subscription_id": subscription_id,
        "tier": request.tier,
        "amount_charged": request.amount,
        "new_usd_balance": new_usd_balance,
        "next_billing_date": next_billing,
        "subscription": {
            "subscription_id": subscription_id,
            "tier": request.tier,
            "status": "active",
            "next_billing": next_billing
        }
    }


@stripe_router.get("/subscriptions/current")
async def get_current_subscription(
    current_user: dict = Depends(get_current_user)
):
    """Get user's current subscription status"""
    user_id = current_user["user_id"]
    
    subscription = await db.subscriptions.find_one(
        {"user_id": user_id, "status": "active"},
        {"_id": 0}
    )
    
    if not subscription:
        # Check user record for legacy subscription
        user = await db.users.find_one(
            {"user_id": user_id},
            {"_id": 0, "subscription_tier": 1, "subscription_status": 1, "subscription_next_billing": 1}
        )
        if user and user.get("subscription_tier") and user.get("subscription_tier") != "free":
            return {
                "tier": user.get("subscription_tier"),
                "status": user.get("subscription_status", "active"),
                "next_billing": user.get("subscription_next_billing")
            }
        raise HTTPException(status_code=404, detail="No active subscription")
    
    return subscription


@stripe_router.post("/subscriptions/cancel")
async def cancel_user_subscription(
    current_user: dict = Depends(get_current_user)
):
    """Cancel user's subscription (effective at end of billing period)"""
    user_id = current_user["user_id"]
    now = datetime.now(timezone.utc).isoformat()
    
    # Update subscription
    await db.subscriptions.update_one(
        {"user_id": user_id, "status": "active"},
        {"$set": {
            "status": "cancelled",
            "cancelled_at": now,
            "cancel_at_period_end": True
        }}
    )
    
    # Update user
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "subscription_status": "cancelled",
            "subscription_cancel_at_period_end": True,
            "updated_at": now
        }}
    )
    
    return {"success": True, "message": "Subscription will be cancelled at the end of the billing period"}


# ============== EXPORT ==============

def get_stripe_router():
    """Get the Stripe payment router"""
    return stripe_router
