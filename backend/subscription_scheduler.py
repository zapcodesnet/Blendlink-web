"""
Subscription Scheduler
Handles recurring subscription payments for BlendLink membership tiers.

Features:
- Daily check for subscriptions due for renewal
- Payment fallback order: Balance -> Stripe Connect -> Card
- Retry mechanism (3 attempts) for failed payments
- User notifications for payment status
- Automatic tier downgrade after all retries fail
"""

from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import os
import uuid
import logging
from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

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

# Subscription tier pricing
TIER_PRICES = {
    "bronze": 4.99,
    "silver": 9.99,
    "gold": 14.99,
    "diamond": 29.99
}

MAX_RETRY_ATTEMPTS = 3
RETRY_INTERVALS_HOURS = [24, 48, 72]  # Hours between retries


async def process_subscription_renewals():
    """
    Main job: Process all subscriptions due for renewal.
    Runs daily at 3 AM UTC.
    """
    logger.info("Starting subscription renewal processing...")
    now = datetime.now(timezone.utc)
    
    # Find subscriptions due for renewal (next_billing <= now)
    due_subscriptions = await db.subscriptions.find({
        "status": {"$in": ["active", "past_due"]},
        "next_billing": {"$lte": now.isoformat()},
        "tier": {"$ne": "free"}
    }).to_list(length=1000)
    
    logger.info(f"Found {len(due_subscriptions)} subscriptions due for renewal")
    
    processed = 0
    failed = 0
    
    for subscription in due_subscriptions:
        try:
            success = await process_single_renewal(subscription)
            if success:
                processed += 1
            else:
                failed += 1
        except Exception as e:
            logger.error(f"Error processing subscription {subscription.get('subscription_id')}: {e}")
            failed += 1
    
    logger.info(f"Subscription renewal complete. Processed: {processed}, Failed: {failed}")
    
    # Log summary
    await db.scheduler_logs.insert_one({
        "job": "subscription_renewals",
        "ran_at": now.isoformat(),
        "subscriptions_checked": len(due_subscriptions),
        "processed": processed,
        "failed": failed
    })


async def process_single_renewal(subscription: dict) -> bool:
    """
    Process a single subscription renewal with fallback payment methods.
    
    Payment Fallback Order:
    1. BlendLink USD balance
    2. Connected Stripe account (if has card on file)
    3. Default payment method
    
    Returns True if payment successful, False otherwise.
    """
    user_id = subscription["user_id"]
    subscription_id = subscription["subscription_id"]
    tier = subscription["tier"]
    retry_count = subscription.get("retry_count", 0)
    
    # Get tier price
    amount = TIER_PRICES.get(tier, 0)
    if amount <= 0:
        logger.warning(f"Invalid tier {tier} for subscription {subscription_id}")
        return False
    
    # Get user data
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        logger.warning(f"User {user_id} not found for subscription {subscription_id}")
        return False
    
    logger.info(f"Processing renewal for {user_id}: {tier} - ${amount}")
    
    # Attempt payment with fallback methods
    payment_result = await attempt_payment_with_fallback(user, amount, tier, subscription_id)
    
    if payment_result["success"]:
        # Payment successful - update subscription
        now = datetime.now(timezone.utc)
        next_billing = (now + relativedelta(months=1)).isoformat()
        
        await db.subscriptions.update_one(
            {"subscription_id": subscription_id},
            {"$set": {
                "status": "active",
                "last_payment": now.isoformat(),
                "next_billing": next_billing,
                "retry_count": 0,
                "payment_method_used": payment_result["method"],
                "updated_at": now.isoformat()
            }}
        )
        
        # Update user record
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "subscription_status": "active",
                "subscription_next_billing": next_billing,
                "subscription_last_payment_method": payment_result["method"],
                "updated_at": now.isoformat()
            }}
        )
        
        # Record transaction
        await db.bl_transactions.insert_one({
            "transaction_id": f"sub_renewal_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "transaction_type": "subscription_renewal",
            "tier": tier,
            "amount_usd": amount,
            "payment_method": payment_result["method"],
            "description": f"Monthly renewal for {tier.capitalize()} membership",
            "status": "completed",
            "created_at": now.isoformat()
        })
        
        # Send success notification
        await send_payment_notification(user, "success", tier, amount, payment_result["method"])
        
        logger.info(f"Subscription {subscription_id} renewed successfully via {payment_result['method']}")
        return True
    
    else:
        # Payment failed - handle retry or downgrade
        new_retry_count = retry_count + 1
        
        if new_retry_count >= MAX_RETRY_ATTEMPTS:
            # Max retries reached - downgrade to free
            await handle_subscription_downgrade(user_id, subscription_id, tier)
            return False
        
        # Schedule retry
        retry_at = datetime.now(timezone.utc) + timedelta(hours=RETRY_INTERVALS_HOURS[new_retry_count - 1])
        
        await db.subscriptions.update_one(
            {"subscription_id": subscription_id},
            {"$set": {
                "status": "past_due",
                "retry_count": new_retry_count,
                "last_retry_at": datetime.now(timezone.utc).isoformat(),
                "next_retry_at": retry_at.isoformat(),
                "last_failure_reason": payment_result.get("error", "Payment failed"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update user status
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "subscription_status": "past_due",
                "subscription_retry_count": new_retry_count,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Send retry notification
        await send_payment_notification(
            user, 
            "retry", 
            tier, 
            amount, 
            None,
            retry_attempt=new_retry_count,
            next_retry=retry_at
        )
        
        logger.warning(f"Payment failed for {subscription_id}. Retry {new_retry_count}/{MAX_RETRY_ATTEMPTS}")
        return False


async def attempt_payment_with_fallback(user: dict, amount: float, tier: str, subscription_id: str) -> dict:
    """
    Attempt payment using fallback methods in order:
    1. USD Balance
    2. Stripe Connect (card on file)
    3. Default payment method
    """
    user_id = user["user_id"]
    
    # Method 1: USD Balance
    usd_balance = user.get("usd_balance", 0)
    if usd_balance >= amount:
        logger.info(f"Attempting balance payment for {user_id}: ${amount}")
        
        # Deduct from balance
        result = await db.users.update_one(
            {"user_id": user_id, "usd_balance": {"$gte": amount}},
            {"$inc": {"usd_balance": -amount}}
        )
        
        if result.modified_count > 0:
            return {"success": True, "method": "balance"}
        else:
            logger.warning(f"Balance payment failed - concurrent modification for {user_id}")
    
    # Method 2: Stripe Connect (if user has card on file)
    connect_account = await db.stripe_connect_accounts.find_one({"user_id": user_id})
    if connect_account and connect_account.get("default_payment_method"):
        try:
            logger.info(f"Attempting Stripe payment for {user_id}")
            result = await charge_stripe_customer(user_id, amount, tier, subscription_id)
            if result["success"]:
                return {"success": True, "method": "stripe_card"}
        except Exception as e:
            logger.error(f"Stripe payment failed for {user_id}: {e}")
    
    # Method 3: User's saved payment method
    payment_methods = await db.payment_methods.find({"user_id": user_id, "is_default": True}).to_list(1)
    if payment_methods:
        try:
            logger.info(f"Attempting saved payment method for {user_id}")
            result = await charge_saved_payment_method(user_id, payment_methods[0], amount, tier)
            if result["success"]:
                return {"success": True, "method": "saved_card"}
        except Exception as e:
            logger.error(f"Saved payment method failed for {user_id}: {e}")
    
    # All methods failed
    return {"success": False, "error": "All payment methods failed"}


async def charge_stripe_customer(user_id: str, amount: float, tier: str, subscription_id: str) -> dict:
    """Charge customer's Stripe account"""
    import stripe
    
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY")
    
    # Get user's Stripe customer ID
    user = await db.users.find_one({"user_id": user_id})
    stripe_customer_id = user.get("stripe_customer_id")
    
    if not stripe_customer_id:
        return {"success": False, "error": "No Stripe customer ID"}
    
    try:
        # Create a payment intent
        payment_intent = stripe.PaymentIntent.create(
            amount=int(amount * 100),  # Convert to cents
            currency="usd",
            customer=stripe_customer_id,
            payment_method_types=["card"],
            off_session=True,
            confirm=True,
            metadata={
                "user_id": user_id,
                "subscription_id": subscription_id,
                "tier": tier,
                "type": "subscription_renewal"
            }
        )
        
        if payment_intent.status == "succeeded":
            return {"success": True, "payment_intent_id": payment_intent.id}
        else:
            return {"success": False, "error": f"Payment status: {payment_intent.status}"}
            
    except stripe.error.CardError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def charge_saved_payment_method(user_id: str, payment_method: dict, amount: float, tier: str) -> dict:
    """Charge using user's saved payment method"""
    import stripe
    
    stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY")
    
    stripe_payment_method_id = payment_method.get("stripe_payment_method_id")
    
    if not stripe_payment_method_id:
        return {"success": False, "error": "No Stripe payment method ID"}
    
    try:
        # Get or create Stripe customer
        user = await db.users.find_one({"user_id": user_id})
        stripe_customer_id = user.get("stripe_customer_id")
        
        if not stripe_customer_id:
            # Create customer
            customer = stripe.Customer.create(
                email=user.get("email"),
                name=user.get("name"),
                metadata={"blendlink_user_id": user_id}
            )
            stripe_customer_id = customer.id
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {"stripe_customer_id": stripe_customer_id}}
            )
        
        # Charge
        payment_intent = stripe.PaymentIntent.create(
            amount=int(amount * 100),
            currency="usd",
            customer=stripe_customer_id,
            payment_method=stripe_payment_method_id,
            off_session=True,
            confirm=True
        )
        
        if payment_intent.status == "succeeded":
            return {"success": True, "payment_intent_id": payment_intent.id}
        else:
            return {"success": False, "error": f"Payment status: {payment_intent.status}"}
            
    except stripe.error.CardError as e:
        return {"success": False, "error": str(e)}
    except Exception as e:
        return {"success": False, "error": str(e)}


async def handle_subscription_downgrade(user_id: str, subscription_id: str, previous_tier: str):
    """
    Handle subscription downgrade after all payment retries fail.
    Downgrades user to free tier and sends notification.
    """
    now = datetime.now(timezone.utc)
    
    # Update subscription
    await db.subscriptions.update_one(
        {"subscription_id": subscription_id},
        {"$set": {
            "status": "cancelled",
            "cancelled_reason": "payment_failed",
            "cancelled_at": now.isoformat(),
            "previous_tier": previous_tier
        }}
    )
    
    # Downgrade user to free tier
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "subscription_tier": "free",
            "subscription_status": "cancelled",
            "subscription_cancelled_reason": "payment_failed",
            "subscription_cancelled_at": now.isoformat(),
            "updated_at": now.isoformat()
        }}
    )
    
    # Record event
    await db.subscription_events.insert_one({
        "event_id": f"evt_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "subscription_id": subscription_id,
        "event_type": "downgrade",
        "from_tier": previous_tier,
        "to_tier": "free",
        "reason": "payment_failed_max_retries",
        "created_at": now.isoformat()
    })
    
    # Send notification
    user = await db.users.find_one({"user_id": user_id})
    if user:
        await send_payment_notification(user, "downgrade", previous_tier, TIER_PRICES.get(previous_tier, 0), None)
    
    logger.warning(f"User {user_id} downgraded from {previous_tier} to free due to payment failure")


async def send_payment_notification(
    user: dict, 
    notification_type: str, 
    tier: str, 
    amount: float, 
    payment_method: str,
    retry_attempt: int = 0,
    next_retry: datetime = None
):
    """
    Send notification to user about their subscription payment status.
    """
    user_id = user["user_id"]
    user_email = user.get("email", "")
    
    # Create in-app notification
    notification_data = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "read": False
    }
    
    if notification_type == "success":
        notification_data.update({
            "type": "subscription_renewed",
            "title": "Subscription Renewed",
            "message": f"Your {tier.capitalize()} membership has been renewed for ${amount:.2f}",
            "data": {"tier": tier, "amount": amount, "method": payment_method}
        })
    
    elif notification_type == "retry":
        notification_data.update({
            "type": "payment_retry",
            "title": "Payment Retry Scheduled",
            "message": f"Your subscription payment of ${amount:.2f} failed. We'll retry on {next_retry.strftime('%b %d')}. Attempt {retry_attempt}/3.",
            "priority": "high",
            "data": {"tier": tier, "amount": amount, "retry_attempt": retry_attempt}
        })
    
    elif notification_type == "downgrade":
        notification_data.update({
            "type": "subscription_cancelled",
            "title": "Subscription Cancelled",
            "message": f"Your {tier.capitalize()} membership has been cancelled due to payment failure. You've been moved to the Free tier.",
            "priority": "urgent",
            "data": {"previous_tier": tier, "new_tier": "free"}
        })
    
    await db.notifications.insert_one(notification_data)
    
    # Send email notification
    if user_email:
        try:
            await send_subscription_email(user_email, notification_type, tier, amount, retry_attempt, next_retry)
        except Exception as e:
            logger.error(f"Failed to send email notification to {user_email}: {e}")


async def send_subscription_email(
    email: str, 
    notification_type: str, 
    tier: str, 
    amount: float,
    retry_attempt: int = 0,
    next_retry: datetime = None
):
    """Send email notification for subscription events"""
    from email_report_service import send_email_notification
    
    if notification_type == "success":
        subject = f"Subscription Renewed - {tier.capitalize()} Membership"
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">Payment Successful!</h1>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb;">
                <p>Your <strong>{tier.capitalize()}</strong> membership has been renewed.</p>
                <div style="background: #ecfdf5; border: 1px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Amount:</strong> ${amount:.2f}</p>
                    <p style="margin: 10px 0 0 0;"><strong>Next billing:</strong> 1 month from today</p>
                </div>
                <p>Thank you for being a {tier.capitalize()} member!</p>
            </div>
        </div>
        """
    
    elif notification_type == "retry":
        subject = f"Payment Failed - Retry {retry_attempt}/3"
        retry_date = next_retry.strftime("%B %d, %Y") if next_retry else "soon"
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">Payment Failed</h1>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb;">
                <p>We were unable to process your {tier.capitalize()} membership payment of ${amount:.2f}.</p>
                <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Retry attempt:</strong> {retry_attempt} of 3</p>
                    <p style="margin: 10px 0 0 0;"><strong>Next retry:</strong> {retry_date}</p>
                </div>
                <p>To avoid losing your membership benefits, please:</p>
                <ul>
                    <li>Add funds to your BlendLink wallet</li>
                    <li>Update your payment method</li>
                </ul>
                <a href="https://blendlink.net/wallet" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 10px;">Update Payment</a>
            </div>
        </div>
        """
    
    elif notification_type == "downgrade":
        subject = f"Subscription Cancelled - {tier.capitalize()} Membership"
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                <h1 style="color: white; margin: 0;">Subscription Cancelled</h1>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb;">
                <p>After 3 failed payment attempts, your <strong>{tier.capitalize()}</strong> membership has been cancelled.</p>
                <div style="background: #fef2f2; border: 1px solid #ef4444; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>Previous tier:</strong> {tier.capitalize()}</p>
                    <p style="margin: 10px 0 0 0;"><strong>Current tier:</strong> Free</p>
                </div>
                <p>You've lost access to:</p>
                <ul>
                    <li>Higher commission rates</li>
                    <li>Increased daily minting limits</li>
                    <li>XP multiplier bonuses</li>
                    <li>Additional member pages</li>
                </ul>
                <p>Want to resubscribe?</p>
                <a href="https://blendlink.net/wallet" style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 10px;">Resubscribe Now</a>
            </div>
        </div>
        """
    
    else:
        return
    
    await send_email_notification(
        to_email=email,
        subject=subject,
        html_content=html_content
    )


async def process_retry_payments():
    """
    Process scheduled payment retries.
    Runs every 6 hours.
    """
    logger.info("Starting payment retry processing...")
    now = datetime.now(timezone.utc)
    
    # Find subscriptions scheduled for retry
    retry_subscriptions = await db.subscriptions.find({
        "status": "past_due",
        "retry_count": {"$lt": MAX_RETRY_ATTEMPTS},
        "next_retry_at": {"$lte": now.isoformat()}
    }).to_list(length=500)
    
    logger.info(f"Found {len(retry_subscriptions)} subscriptions for retry")
    
    for subscription in retry_subscriptions:
        try:
            await process_single_renewal(subscription)
        except Exception as e:
            logger.error(f"Error in retry for {subscription.get('subscription_id')}: {e}")
    
    logger.info("Payment retry processing complete")


# Initialize scheduler
subscription_scheduler = AsyncIOScheduler()


def setup_subscription_scheduler():
    """Set up the subscription renewal scheduler"""
    # Main renewal job - runs daily at 3 AM UTC
    subscription_scheduler.add_job(
        process_subscription_renewals,
        CronTrigger(hour=3, minute=0),
        id="subscription_renewals",
        name="Process subscription renewals",
        replace_existing=True
    )
    
    # Retry job - runs every 6 hours
    subscription_scheduler.add_job(
        process_retry_payments,
        CronTrigger(hour="*/6"),
        id="payment_retries",
        name="Process payment retries",
        replace_existing=True
    )
    
    logger.info("Subscription scheduler configured")


def start_subscription_scheduler():
    """Start the subscription scheduler"""
    if not subscription_scheduler.running:
        setup_subscription_scheduler()
        subscription_scheduler.start()
        logger.info("Subscription scheduler started")


def get_scheduler_status():
    """Get status of scheduled jobs"""
    jobs = []
    for job in subscription_scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger)
        })
    return {
        "running": subscription_scheduler.running,
        "jobs": jobs
    }


# Manual trigger functions for admin
async def trigger_renewal_check():
    """Manually trigger subscription renewal check"""
    await process_subscription_renewals()
    return {"status": "completed"}


async def trigger_retry_check():
    """Manually trigger payment retry check"""
    await process_retry_payments()
    return {"status": "completed"}
