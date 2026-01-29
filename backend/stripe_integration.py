"""
Blendlink Stripe Integration
- Payment processing for marketplace transactions
- KYC verification via Stripe Identity
- Withdrawal processing
- Commission handling
"""

import os
import logging
import stripe
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Stripe API keys
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# Initialize Stripe
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
else:
    logger.warning("STRIPE_SECRET_KEY not configured")

# Get MongoDB from server
from server import db, get_current_user

# Router
stripe_router = APIRouter(prefix="/payments", tags=["Payments & Stripe"])

# ============== MODELS ==============

class CreatePaymentIntent(BaseModel):
    amount_usd: float
    listing_id: Optional[str] = None
    description: Optional[str] = None

class CreateWithdrawal(BaseModel):
    amount_usd: float

class ProcessSale(BaseModel):
    listing_id: str
    buyer_id: str
    amount_usd: float
    payment_intent_id: str

# ============== KYC / IDENTITY VERIFICATION ==============

@stripe_router.post("/kyc/start")
async def start_kyc_verification(current_user: dict = Depends(get_current_user)):
    """
    Start Stripe Identity verification session.
    User must complete this before withdrawing funds.
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payment system not configured")
    
    try:
        # Check if user already has a pending or completed verification
        user = await db.users.find_one({"user_id": current_user["user_id"]})
        if user.get("kyc_status") == "verified":
            return {"status": "already_verified", "message": "Your identity is already verified"}
        
        # Create Stripe Identity verification session
        verification_session = stripe.identity.VerificationSession.create(
            type="document",
            metadata={
                "user_id": current_user["user_id"],
                "email": current_user.get("email", ""),
            },
            options={
                "document": {
                    "allowed_types": ["driving_license", "passport", "id_card"],
                    "require_matching_selfie": True,
                }
            },
            return_url=f"{os.environ.get('FRONTEND_URL', os.environ.get('APP_URL', ''))}/kyc-complete",
        )
        
        # Update user with verification session ID
        await db.users.update_one(
            {"user_id": current_user["user_id"]},
            {
                "$set": {
                    "kyc_status": "pending",
                    "kyc_session_id": verification_session.id,
                    "kyc_started_at": datetime.now(timezone.utc).isoformat(),
                }
            }
        )
        
        # Record KYC attempt
        await db.kyc_attempts.insert_one({
            "user_id": current_user["user_id"],
            "session_id": verification_session.id,
            "status": "started",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        return {
            "status": "session_created",
            "verification_url": verification_session.url,
            "session_id": verification_session.id,
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe KYC error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to start verification: {str(e)}")

@stripe_router.get("/kyc/status")
async def get_kyc_status(current_user: dict = Depends(get_current_user)):
    """Get user's KYC verification status"""
    user = await db.users.find_one(
        {"user_id": current_user["user_id"]},
        {"kyc_status": 1, "kyc_verified_at": 1}
    )
    
    return {
        "status": user.get("kyc_status", "not_started"),
        "verified_at": user.get("kyc_verified_at"),
        "can_withdraw": user.get("kyc_status") == "verified",
    }

# ============== PAYMENT PROCESSING ==============

@stripe_router.post("/create-payment-intent")
async def create_payment_intent(
    data: CreatePaymentIntent,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a Stripe PaymentIntent for marketplace purchase.
    """
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payment system not configured")
    
    if data.amount_usd < 0.50:
        raise HTTPException(status_code=400, detail="Minimum payment amount is $0.50")
    
    try:
        # Get listing details if provided
        listing = None
        if data.listing_id:
            listing = await db.listings.find_one({"listing_id": data.listing_id})
            if not listing:
                raise HTTPException(status_code=404, detail="Listing not found")
        
        # Create PaymentIntent
        intent = stripe.PaymentIntent.create(
            amount=int(data.amount_usd * 100),  # Stripe uses cents
            currency="usd",
            metadata={
                "user_id": current_user["user_id"],
                "listing_id": data.listing_id or "",
                "type": "marketplace_purchase" if data.listing_id else "direct_payment",
            },
            description=data.description or "Blendlink purchase",
        )
        
        # Record payment intent
        await db.payment_intents.insert_one({
            "intent_id": intent.id,
            "user_id": current_user["user_id"],
            "amount_usd": data.amount_usd,
            "listing_id": data.listing_id,
            "status": intent.status,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        return {
            "client_secret": intent.client_secret,
            "intent_id": intent.id,
            "amount_usd": data.amount_usd,
            "publishable_key": STRIPE_PUBLISHABLE_KEY,
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Stripe payment error: {e}")
        raise HTTPException(status_code=500, detail=f"Payment failed: {str(e)}")

@stripe_router.post("/process-sale")
async def process_sale(data: ProcessSale, current_user: dict = Depends(get_current_user)):
    """
    Process a completed sale and distribute commissions.
    Called after successful payment.
    8% total fee: 3% L1, 1% L2, 4% platform
    """
    # Verify payment was successful
    try:
        intent = stripe.PaymentIntent.retrieve(data.payment_intent_id)
        if intent.status != "succeeded":
            raise HTTPException(status_code=400, detail="Payment not completed")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid payment: {str(e)}")
    
    # Get listing and seller
    listing = await db.listings.find_one({"listing_id": data.listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    seller_id = listing.get("seller_id") or listing.get("user_id")
    if not seller_id:
        raise HTTPException(status_code=400, detail="Seller not found")
    
    # Calculate commissions (8% total)
    from referral_system import calculate_commission, process_commissions
    commission = await calculate_commission(data.amount_usd, seller_id)
    
    # Record the sale
    sale_id = f"sale_{datetime.now().strftime('%Y%m%d%H%M%S')}_{data.listing_id[:8]}"
    await db.sales.insert_one({
        "sale_id": sale_id,
        "listing_id": data.listing_id,
        "seller_id": seller_id,
        "buyer_id": data.buyer_id,
        "amount_usd": data.amount_usd,
        "payment_intent_id": data.payment_intent_id,
        "status": "completed",
        "commission_breakdown": {
            "l1_amount": commission.l1_amount,
            "l2_amount": commission.l2_amount,
            "platform_amount": commission.platform_amount,
            "seller_net": commission.seller_net,
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Process commissions
    await process_commissions(commission, sale_id, seller_id)
    
    # Credit seller (minus 8% fee)
    from referral_system import record_transaction, TransactionType, Currency
    await record_transaction(
        user_id=seller_id,
        transaction_type=TransactionType.SALE_EARNINGS,
        currency=Currency.USD,
        amount=commission.seller_net,
        reference_id=sale_id,
        details={
            "listing_id": data.listing_id,
            "gross_amount": data.amount_usd,
            "total_fees": commission.total_fee,
        }
    )
    
    # Award marketplace purchase bonus to buyer (1000 BL per USD)
    from referral_system import reward_activity, ACTIVITY_REWARDS
    bl_bonus = int(data.amount_usd * ACTIVITY_REWARDS["marketplace_purchase_per_usd"])
    await reward_activity(
        user_id=data.buyer_id,
        activity_type="marketplace_purchase_bonus",
        reference_id=sale_id,
        custom_amount=bl_bonus,
        details={"purchase_amount_usd": data.amount_usd}
    )
    
    return {
        "success": True,
        "sale_id": sale_id,
        "seller_net": commission.seller_net,
        "buyer_bl_bonus": bl_bonus,
        "commissions": {
            "l1": commission.l1_amount,
            "l2": commission.l2_amount,
            "platform": commission.platform_amount,
        }
    }

# ============== WITHDRAWALS ==============

@stripe_router.post("/withdraw")
async def create_withdrawal(
    data: CreateWithdrawal,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a withdrawal request.
    Requires KYC verification.
    1% fee to platform.
    """
    # Check KYC status
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("kyc_status") != "verified":
        raise HTTPException(status_code=400, detail="Identity verification required before withdrawal")
    
    # Check balance
    usd_balance = user.get("usd_balance", 0)
    if data.amount_usd > usd_balance:
        raise HTTPException(status_code=400, detail=f"Insufficient balance. Available: ${usd_balance:.2f}")
    
    if data.amount_usd < 10:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is $10")
    
    # Calculate fee (1%)
    fee = round(data.amount_usd * 0.01, 2)
    net_amount = round(data.amount_usd - fee, 2)
    
    # Create withdrawal request
    withdrawal_id = f"wd_{datetime.now().strftime('%Y%m%d%H%M%S')}_{current_user['user_id'][:8]}"
    
    await db.withdrawals.insert_one({
        "withdrawal_id": withdrawal_id,
        "user_id": current_user["user_id"],
        "amount_usd": data.amount_usd,
        "fee_usd": fee,
        "net_amount_usd": net_amount,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Deduct from balance immediately (pending withdrawal)
    from referral_system import record_transaction, TransactionType, Currency
    await record_transaction(
        user_id=current_user["user_id"],
        transaction_type=TransactionType.WITHDRAWAL,
        currency=Currency.USD,
        amount=-data.amount_usd,  # Negative for deduction
        reference_id=withdrawal_id,
        details={"fee": fee, "net": net_amount}
    )
    
    # Record fee
    await record_transaction(
        user_id=current_user["user_id"],
        transaction_type=TransactionType.WITHDRAWAL_FEE,
        currency=Currency.USD,
        amount=-fee,
        reference_id=withdrawal_id,
    )
    
    return {
        "success": True,
        "withdrawal_id": withdrawal_id,
        "amount": data.amount_usd,
        "fee": fee,
        "net_amount": net_amount,
        "status": "pending",
        "message": "Withdrawal request submitted. Processing may take 1-3 business days."
    }

@stripe_router.get("/withdrawal-history")
async def get_withdrawal_history(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get user's withdrawal history"""
    withdrawals = await db.withdrawals.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.withdrawals.count_documents({"user_id": current_user["user_id"]})
    
    return {
        "withdrawals": withdrawals,
        "total": total,
    }

# ============== STRIPE WEBHOOKS ==============

@stripe_router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        if STRIPE_WEBHOOK_SECRET:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
        else:
            # For testing without webhook secret
            import json
            event = stripe.Event.construct_from(
                json.loads(payload), stripe.api_key
            )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    # Handle specific events
    event_type = event.type
    
    if event_type == "identity.verification_session.verified":
        # KYC verification completed successfully
        session = event.data.object
        user_id = session.metadata.get("user_id")
        
        if user_id:
            await db.users.update_one(
                {"user_id": user_id},
                {
                    "$set": {
                        "kyc_status": "verified",
                        "kyc_verified_at": datetime.now(timezone.utc).isoformat(),
                    }
                }
            )
            logger.info(f"KYC verified for user {user_id}")
    
    elif event_type == "identity.verification_session.requires_input":
        # KYC needs more info
        session = event.data.object
        user_id = session.metadata.get("user_id")
        
        if user_id:
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"kyc_status": "requires_input"}}
            )
    
    elif event_type == "payment_intent.succeeded":
        # Payment completed
        intent = event.data.object
        logger.info(f"Payment {intent.id} succeeded")
        
        # Update payment intent status
        await db.payment_intents.update_one(
            {"intent_id": intent.id},
            {"$set": {"status": "succeeded", "completed_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    elif event_type == "payment_intent.payment_failed":
        # Payment failed
        intent = event.data.object
        logger.warning(f"Payment {intent.id} failed")
        
        await db.payment_intents.update_one(
            {"intent_id": intent.id},
            {"$set": {"status": "failed"}}
        )
    
    return {"status": "success"}

# ============== ADMIN ENDPOINTS ==============

@stripe_router.get("/admin/pending-withdrawals")
async def get_pending_withdrawals(current_user: dict = Depends(get_current_user)):
    """Admin: Get all pending withdrawals"""
    # Check if admin
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    withdrawals = await db.withdrawals.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    return {"pending_withdrawals": withdrawals, "count": len(withdrawals)}

@stripe_router.post("/admin/process-withdrawal/{withdrawal_id}")
async def admin_process_withdrawal(
    withdrawal_id: str,
    action: str,  # "approve" or "reject"
    current_user: dict = Depends(get_current_user)
):
    """Admin: Process a withdrawal request"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    withdrawal = await db.withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail="Withdrawal already processed")
    
    if action == "approve":
        # Mark as completed
        await db.withdrawals.update_one(
            {"withdrawal_id": withdrawal_id},
            {
                "$set": {
                    "status": "completed",
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "processed_by": current_user["user_id"],
                }
            }
        )
        return {"success": True, "message": "Withdrawal approved and marked as completed"}
    
    elif action == "reject":
        # Refund the amount back to user
        from referral_system import record_transaction, TransactionType, Currency
        await record_transaction(
            user_id=withdrawal["user_id"],
            transaction_type=TransactionType.ADMIN_ADJUSTMENT,
            currency=Currency.USD,
            amount=withdrawal["amount_usd"],  # Positive to refund
            reference_id=withdrawal_id,
            details={"type": "withdrawal_rejected_refund"}
        )
        
        await db.withdrawals.update_one(
            {"withdrawal_id": withdrawal_id},
            {
                "$set": {
                    "status": "rejected",
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "processed_by": current_user["user_id"],
                }
            }
        )
        return {"success": True, "message": "Withdrawal rejected and amount refunded"}
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'approve' or 'reject'")

@stripe_router.get("/config")
async def get_stripe_config():
    """Get Stripe publishable key for frontend"""
    return {
        "publishable_key": STRIPE_PUBLISHABLE_KEY,
        "enabled": bool(STRIPE_SECRET_KEY),
    }
