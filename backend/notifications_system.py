"""
Push Notifications System for Blendlink
- Commission earned notifications
- Daily BL claim reminders
- Daily spin reminders
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
import uuid

logger = logging.getLogger(__name__)

# Get MongoDB connection from server
from server import db, get_current_user

# Router
notifications_router = APIRouter(prefix="/notifications", tags=["Notifications"])

# Enums
class NotificationType(str, Enum):
    COMMISSION_EARNED = "commission_earned"
    DAILY_CLAIM_READY = "daily_claim_ready"
    DAILY_SPIN_READY = "daily_spin_ready"
    REFERRAL_JOINED = "referral_joined"
    WITHDRAWAL_STATUS = "withdrawal_status"
    DIAMOND_PROMOTION = "diamond_promotion"
    DIAMOND_WARNING = "diamond_warning"
    SYSTEM = "system"
    # Social engagement notifications for marketplace
    LISTING_LIKED = "listing_liked"
    LISTING_COMMENTED = "listing_commented"
    LISTING_SHARED = "listing_shared"
    # Order notifications
    ORDER_RECEIVED = "order_received"
    ORDER_SHIPPED = "order_shipped"
    ORDER_DELIVERED = "order_delivered"

class NotificationPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"

# Models
class Notification(BaseModel):
    notification_id: str = Field(default_factory=lambda: f"notif_{uuid.uuid4().hex[:12]}")
    user_id: str
    type: NotificationType
    title: str
    body: str
    data: dict = {}
    priority: NotificationPriority = NotificationPriority.NORMAL
    read: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict = {}
    user_agent: Optional[str] = None

# ============== NOTIFICATION CREATION ==============

async def create_notification(
    user_id: str,
    notification_type: NotificationType,
    title: str,
    body: str,
    data: dict = {},
    priority: NotificationPriority = NotificationPriority.NORMAL
) -> str:
    """Create and store a notification"""
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        body=body,
        data=data,
        priority=priority,
    )
    
    await db.notifications.insert_one(notification.dict())
    
    # Try to send push notification if user has subscriptions
    await send_push_notification(user_id, notification)
    
    logger.info(f"Created notification {notification.notification_id} for user {user_id}")
    return notification.notification_id

async def send_push_notification(user_id: str, notification: Notification):
    """Send push notification via stored subscriptions"""
    subscriptions = await db.push_subscriptions.find(
        {"user_id": user_id}
    ).to_list(10)
    
    # For now, just log - actual push would use web-push library
    for sub in subscriptions:
        logger.info(f"Would send push to endpoint: {sub.get('endpoint', '')[:50]}...")

# ============== TRIGGER FUNCTIONS ==============

async def notify_commission_earned(user_id: str, amount: float, level: int, source_username: str):
    """Notify user when they earn a commission"""
    await create_notification(
        user_id=user_id,
        notification_type=NotificationType.COMMISSION_EARNED,
        title="Commission Earned! 💰",
        body=f"You earned ${amount:.2f} from Level {level} referral ({source_username})",
        data={"amount": amount, "level": level, "source": source_username},
        priority=NotificationPriority.HIGH,
    )

async def notify_referral_joined(user_id: str, new_user_name: str, bonus_amount: int):
    """Notify user when someone joins with their referral code"""
    await create_notification(
        user_id=user_id,
        notification_type=NotificationType.REFERRAL_JOINED,
        title="New Team Member! 🎉",
        body=f"{new_user_name} joined using your code! You both got {bonus_amount:,} BL coins!",
        data={"new_user": new_user_name, "bonus": bonus_amount},
        priority=NotificationPriority.HIGH,
    )

async def notify_daily_claim_ready(user_id: str, amount: int, is_diamond: bool):
    """Notify user their daily claim is ready"""
    emoji = "💎" if is_diamond else "🎁"
    await create_notification(
        user_id=user_id,
        notification_type=NotificationType.DAILY_CLAIM_READY,
        title=f"Daily Claim Ready! {emoji}",
        body=f"Your daily {amount:,} BL coins are ready to claim!",
        data={"amount": amount, "is_diamond": is_diamond},
        priority=NotificationPriority.NORMAL,
    )

async def notify_daily_spin_ready(user_id: str):
    """Notify user their daily spin is ready"""
    await create_notification(
        user_id=user_id,
        notification_type=NotificationType.DAILY_SPIN_READY,
        title="Daily Spin Ready! 🎰",
        body="Your daily spin is ready! Try your luck and win BL coins!",
        data={},
        priority=NotificationPriority.NORMAL,
    )

async def notify_withdrawal_status(user_id: str, status: str, amount: float, reason: str = None):
    """Notify user about withdrawal status change"""
    status_text = {
        "approved": "Your withdrawal has been approved and is being processed.",
        "completed": f"Your withdrawal of ${amount:.2f} has been sent!",
        "rejected": f"Your withdrawal was rejected. {reason or ''}"
    }
    
    await create_notification(
        user_id=user_id,
        notification_type=NotificationType.WITHDRAWAL_STATUS,
        title=f"Withdrawal {status.title()}",
        body=status_text.get(status, f"Withdrawal status: {status}"),
        data={"status": status, "amount": amount, "reason": reason},
        priority=NotificationPriority.HIGH,
    )

async def notify_diamond_promotion(user_id: str):
    """Notify user they became a Diamond Leader"""
    await create_notification(
        user_id=user_id,
        notification_type=NotificationType.DIAMOND_PROMOTION,
        title="Diamond Leader! 💎👑",
        body="Congratulations! You've qualified as a Diamond Leader! Enjoy enhanced commission rates and 5,000 daily BL coins!",
        data={},
        priority=NotificationPriority.HIGH,
    )

async def notify_diamond_warning(user_id: str, days_left: int, missing: List[str]):
    """Warn Diamond Leader about maintenance deadline"""
    await create_notification(
        user_id=user_id,
        notification_type=NotificationType.DIAMOND_WARNING,
        title="Diamond Status Warning ⚠️",
        body=f"You have {days_left} days to meet maintenance requirements or lose Diamond status. Missing: {', '.join(missing)}",
        data={"days_left": days_left, "missing": missing},
        priority=NotificationPriority.HIGH,
    )

# ============== SOCIAL ENGAGEMENT NOTIFICATIONS ==============

async def notify_listing_liked(seller_id: str, liker_username: str, listing_id: str, listing_title: str):
    """Notify seller when someone likes their listing"""
    await create_notification(
        user_id=seller_id,
        notification_type=NotificationType.LISTING_LIKED,
        title="Someone liked your listing! ❤️",
        body=f"@{liker_username} liked your listing: {listing_title}",
        data={
            "listing_id": listing_id,
            "listing_title": listing_title,
            "liker_username": liker_username,
            "action": "liked",
            "link": f"/marketplace/{listing_id}"
        },
        priority=NotificationPriority.NORMAL,
    )

async def notify_listing_commented(seller_id: str, commenter_username: str, listing_id: str, listing_title: str, comment_preview: str = ""):
    """Notify seller when someone comments on their listing"""
    await create_notification(
        user_id=seller_id,
        notification_type=NotificationType.LISTING_COMMENTED,
        title="New comment on your listing! 💬",
        body=f"@{commenter_username} commented on {listing_title}: \"{comment_preview[:50]}{'...' if len(comment_preview) > 50 else ''}\"",
        data={
            "listing_id": listing_id,
            "listing_title": listing_title,
            "commenter_username": commenter_username,
            "comment_preview": comment_preview,
            "action": "commented",
            "link": f"/marketplace/{listing_id}"
        },
        priority=NotificationPriority.NORMAL,
    )

async def notify_listing_shared(seller_id: str, sharer_username: str, listing_id: str, listing_title: str):
    """Notify seller when someone shares their listing"""
    await create_notification(
        user_id=seller_id,
        notification_type=NotificationType.LISTING_SHARED,
        title="Your listing was shared! 🔗",
        body=f"@{sharer_username} shared your listing: {listing_title}",
        data={
            "listing_id": listing_id,
            "listing_title": listing_title,
            "sharer_username": sharer_username,
            "action": "shared",
            "link": f"/marketplace/{listing_id}"
        },
        priority=NotificationPriority.NORMAL,
    )

async def notify_order_received(seller_id: str, order_id: str, buyer_name: str, listing_title: str, total_amount: float, shipping_cost: float):
    """Notify seller when they receive a new order"""
    await create_notification(
        user_id=seller_id,
        notification_type=NotificationType.ORDER_RECEIVED,
        title="New Order Received! 🛒",
        body=f"{buyer_name} purchased {listing_title} for ${total_amount:.2f} (includes ${shipping_cost:.2f} shipping)",
        data={
            "order_id": order_id,
            "buyer_name": buyer_name,
            "listing_title": listing_title,
            "total_amount": total_amount,
            "shipping_cost": shipping_cost,
            "action": "order_received",
            "link": f"/seller-dashboard/orders/{order_id}"
        },
        priority=NotificationPriority.HIGH,
    )

# ============== SCHEDULED REMINDER JOBS ==============

async def check_and_send_daily_reminders():
    """Background job to send daily claim and spin reminders"""
    now = datetime.now(timezone.utc)
    
    # Find users whose last claim was 24+ hours ago
    claim_threshold = (now - timedelta(hours=24)).isoformat()
    
    users_needing_claim_reminder = await db.users.find({
        "$or": [
            {"daily_claim_last": {"$lt": claim_threshold}},
            {"daily_claim_last": {"$exists": False}}
        ]
    }, {"user_id": 1, "rank": 1, "notification_preferences": 1}).to_list(1000)
    
    for user in users_needing_claim_reminder:
        prefs = user.get("notification_preferences", {})
        if prefs.get("daily_claim_reminder", True):
            is_diamond = user.get("rank") == "diamond_leader"
            amount = 5000 if is_diamond else 2000
            await notify_daily_claim_ready(user["user_id"], amount, is_diamond)
    
    # Find users whose last spin was 24+ hours ago
    spin_threshold = (now - timedelta(hours=24)).isoformat()
    
    users_needing_spin_reminder = await db.users.find({
        "$or": [
            {"last_spin": {"$lt": spin_threshold}},
            {"last_spin": {"$exists": False}}
        ]
    }, {"user_id": 1, "notification_preferences": 1}).to_list(1000)
    
    for user in users_needing_spin_reminder:
        prefs = user.get("notification_preferences", {})
        if prefs.get("daily_spin_reminder", True):
            await notify_daily_spin_ready(user["user_id"])
    
    logger.info(f"Sent {len(users_needing_claim_reminder)} claim reminders and {len(users_needing_spin_reminder)} spin reminders")

# ============== API ENDPOINTS ==============

@notifications_router.get("/list")
async def get_notifications(
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get user's notifications"""
    query = {"user_id": current_user["user_id"]}
    if unread_only:
        query["read"] = False
    
    notifications = await db.notifications.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    unread_count = await db.notifications.count_documents({
        "user_id": current_user["user_id"],
        "read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "skip": skip,
        "limit": limit,
    }

@notifications_router.post("/mark-read/{notification_id}")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": current_user["user_id"]},
        {"$set": {"read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True}

@notifications_router.post("/mark-all-read")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    result = await db.notifications.update_many(
        {"user_id": current_user["user_id"], "read": False},
        {"$set": {"read": True}}
    )
    
    return {"success": True, "marked_count": result.modified_count}

@notifications_router.delete("/{notification_id}")
async def delete_notification(
    notification_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a notification"""
    result = await db.notifications.delete_one({
        "notification_id": notification_id,
        "user_id": current_user["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"success": True}

@notifications_router.post("/subscribe")
async def subscribe_to_push(
    subscription: PushSubscription,
    current_user: dict = Depends(get_current_user)
):
    """Register push notification subscription"""
    await db.push_subscriptions.update_one(
        {"user_id": current_user["user_id"], "endpoint": subscription.endpoint},
        {"$set": {
            "user_id": current_user["user_id"],
            "endpoint": subscription.endpoint,
            "keys": subscription.keys,
            "user_agent": subscription.user_agent,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True
    )
    
    return {"success": True, "message": "Push subscription registered"}

@notifications_router.delete("/unsubscribe")
async def unsubscribe_from_push(
    endpoint: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove push notification subscription"""
    await db.push_subscriptions.delete_one({
        "user_id": current_user["user_id"],
        "endpoint": endpoint
    })
    
    return {"success": True}

class NotificationPreferences(BaseModel):
    commission_alerts: bool = True
    referral_alerts: bool = True
    daily_claim_reminder: bool = True
    daily_spin_reminder: bool = True
    withdrawal_alerts: bool = True
    diamond_alerts: bool = True

@notifications_router.get("/preferences")
async def get_notification_preferences(current_user: dict = Depends(get_current_user)):
    """Get user's notification preferences"""
    user = await db.users.find_one(
        {"user_id": current_user["user_id"]},
        {"notification_preferences": 1}
    )
    
    prefs = user.get("notification_preferences", {})
    return NotificationPreferences(**prefs)

@notifications_router.put("/preferences")
async def update_notification_preferences(
    preferences: NotificationPreferences,
    current_user: dict = Depends(get_current_user)
):
    """Update user's notification preferences"""
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {"notification_preferences": preferences.dict()}}
    )
    
    return {"success": True, "preferences": preferences.dict()}
