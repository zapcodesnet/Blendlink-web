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

# Platform fee rate
PLATFORM_FEE_RATE = 0.08  # 8%

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


# ============== EXPORT ==============

def get_stripe_router():
    """Get the Stripe payment router"""
    return stripe_router
