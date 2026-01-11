"""
Admin Push Notifications System for Blendlink
Phase 1: Core notification delivery and preferences
Phase 2: Role-based assignment and advanced features

Notification Types:
- KYC requests (new_kyc_request)
- Withdrawal requests (new_withdrawal_request)
- Diamond leader promotions (diamond_promotion)
- Security alerts (security_alert, login_attempt, suspicious_activity)
- Admin panel logins (admin_login)
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict
from enum import Enum
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
import uuid
import httpx

logger = logging.getLogger(__name__)

# Get MongoDB connection from server
from server import db, get_current_user

# Router
admin_notifications_router = APIRouter(prefix="/admin/notifications", tags=["Admin Notifications"])

# ============== ENUMS ==============

class AdminNotificationType(str, Enum):
    # KYC & Withdrawals
    NEW_KYC_REQUEST = "new_kyc_request"
    KYC_APPROVED = "kyc_approved"
    KYC_REJECTED = "kyc_rejected"
    NEW_WITHDRAWAL = "new_withdrawal"
    WITHDRAWAL_APPROVED = "withdrawal_approved"
    WITHDRAWAL_REJECTED = "withdrawal_rejected"
    
    # User Events
    DIAMOND_PROMOTION = "diamond_promotion"
    DIAMOND_DEMOTION = "diamond_demotion"
    NEW_USER_SIGNUP = "new_user_signup"
    USER_BANNED = "user_banned"
    USER_SUSPENDED = "user_suspended"
    
    # Security Alerts
    ADMIN_LOGIN = "admin_login"
    FAILED_LOGIN_ATTEMPT = "failed_login_attempt"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    BRUTE_FORCE_DETECTED = "brute_force_detected"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    
    # System
    SYSTEM_ALERT = "system_alert"
    HIGH_WITHDRAWAL_VOLUME = "high_withdrawal_volume"
    DATABASE_WARNING = "database_warning"

class NotificationPriority(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"

class NotificationChannel(str, Enum):
    PUSH = "push"       # Mobile/Web push notification
    IN_APP = "in_app"   # In-app notification center
    EMAIL = "email"     # Email notification (future)
    SMS = "sms"         # SMS notification (future)

# ============== MODELS ==============

class AdminNotification(BaseModel):
    notification_id: str = Field(default_factory=lambda: f"admin_notif_{uuid.uuid4().hex[:12]}")
    recipient_admin_ids: List[str] = []  # Empty = all admins with permission
    notification_type: AdminNotificationType
    title: str
    body: str
    data: dict = {}
    priority: NotificationPriority = NotificationPriority.NORMAL
    channels: List[NotificationChannel] = [NotificationChannel.PUSH, NotificationChannel.IN_APP]
    read_by: List[str] = []  # List of admin_ids who have read
    dismissed_by: List[str] = []  # List of admin_ids who dismissed
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    expires_at: Optional[str] = None

class AdminNotificationPreferences(BaseModel):
    admin_id: str
    enabled: bool = True  # Master switch
    
    # Per-type preferences
    kyc_notifications: bool = True
    withdrawal_notifications: bool = True
    security_notifications: bool = True
    user_event_notifications: bool = True
    system_notifications: bool = True
    diamond_notifications: bool = True
    
    # Channel preferences
    push_enabled: bool = True
    in_app_enabled: bool = True
    email_enabled: bool = False  # Future
    
    # Quiet hours (don't send push during these hours)
    quiet_hours_enabled: bool = False
    quiet_hours_start: int = 22  # 10 PM
    quiet_hours_end: int = 7    # 7 AM
    
    # Priority threshold (only notify for this priority and above)
    min_priority: NotificationPriority = NotificationPriority.LOW
    
    # Role-based delegation (assign to others)
    delegate_to: List[str] = []  # Admin IDs to forward notifications to
    
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class NotificationPreferencesUpdate(BaseModel):
    enabled: Optional[bool] = None
    kyc_notifications: Optional[bool] = None
    withdrawal_notifications: Optional[bool] = None
    security_notifications: Optional[bool] = None
    user_event_notifications: Optional[bool] = None
    system_notifications: Optional[bool] = None
    diamond_notifications: Optional[bool] = None
    push_enabled: Optional[bool] = None
    in_app_enabled: Optional[bool] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[int] = None
    quiet_hours_end: Optional[int] = None
    min_priority: Optional[NotificationPriority] = None
    delegate_to: Optional[List[str]] = None

# ============== NOTIFICATION MAPPING ==============

NOTIFICATION_TYPE_CATEGORY = {
    AdminNotificationType.NEW_KYC_REQUEST: "kyc_notifications",
    AdminNotificationType.KYC_APPROVED: "kyc_notifications",
    AdminNotificationType.KYC_REJECTED: "kyc_notifications",
    AdminNotificationType.NEW_WITHDRAWAL: "withdrawal_notifications",
    AdminNotificationType.WITHDRAWAL_APPROVED: "withdrawal_notifications",
    AdminNotificationType.WITHDRAWAL_REJECTED: "withdrawal_notifications",
    AdminNotificationType.DIAMOND_PROMOTION: "diamond_notifications",
    AdminNotificationType.DIAMOND_DEMOTION: "diamond_notifications",
    AdminNotificationType.NEW_USER_SIGNUP: "user_event_notifications",
    AdminNotificationType.USER_BANNED: "user_event_notifications",
    AdminNotificationType.USER_SUSPENDED: "user_event_notifications",
    AdminNotificationType.ADMIN_LOGIN: "security_notifications",
    AdminNotificationType.FAILED_LOGIN_ATTEMPT: "security_notifications",
    AdminNotificationType.SUSPICIOUS_ACTIVITY: "security_notifications",
    AdminNotificationType.BRUTE_FORCE_DETECTED: "security_notifications",
    AdminNotificationType.UNAUTHORIZED_ACCESS: "security_notifications",
    AdminNotificationType.SYSTEM_ALERT: "system_notifications",
    AdminNotificationType.HIGH_WITHDRAWAL_VOLUME: "system_notifications",
    AdminNotificationType.DATABASE_WARNING: "system_notifications",
}

NOTIFICATION_DEFAULT_PRIORITY = {
    AdminNotificationType.NEW_KYC_REQUEST: NotificationPriority.NORMAL,
    AdminNotificationType.NEW_WITHDRAWAL: NotificationPriority.NORMAL,
    AdminNotificationType.DIAMOND_PROMOTION: NotificationPriority.NORMAL,
    AdminNotificationType.ADMIN_LOGIN: NotificationPriority.LOW,
    AdminNotificationType.FAILED_LOGIN_ATTEMPT: NotificationPriority.HIGH,
    AdminNotificationType.SUSPICIOUS_ACTIVITY: NotificationPriority.CRITICAL,
    AdminNotificationType.BRUTE_FORCE_DETECTED: NotificationPriority.CRITICAL,
    AdminNotificationType.UNAUTHORIZED_ACCESS: NotificationPriority.CRITICAL,
    AdminNotificationType.SYSTEM_ALERT: NotificationPriority.HIGH,
}

# ============== HELPER FUNCTIONS ==============

async def get_admin_preferences(admin_id: str) -> AdminNotificationPreferences:
    """Get or create admin notification preferences"""
    prefs = await db.admin_notification_preferences.find_one({"admin_id": admin_id}, {"_id": 0})
    if prefs:
        return AdminNotificationPreferences(**prefs)
    
    # Create default preferences
    default_prefs = AdminNotificationPreferences(admin_id=admin_id)
    await db.admin_notification_preferences.insert_one(default_prefs.dict())
    return default_prefs

async def should_notify_admin(admin_id: str, notification_type: AdminNotificationType, priority: NotificationPriority) -> bool:
    """Check if admin should receive this notification based on preferences"""
    prefs = await get_admin_preferences(admin_id)
    
    # Master switch
    if not prefs.enabled:
        return False
    
    # Check category preference
    category = NOTIFICATION_TYPE_CATEGORY.get(notification_type, "system_notifications")
    if not getattr(prefs, category, True):
        return False
    
    # Check priority threshold
    priority_order = [NotificationPriority.LOW, NotificationPriority.NORMAL, NotificationPriority.HIGH, NotificationPriority.CRITICAL]
    if priority_order.index(priority) < priority_order.index(prefs.min_priority):
        return False
    
    # Check quiet hours for push notifications
    if prefs.quiet_hours_enabled and prefs.push_enabled:
        now = datetime.now(timezone.utc)
        current_hour = now.hour
        if prefs.quiet_hours_start <= current_hour or current_hour < prefs.quiet_hours_end:
            # During quiet hours, only allow critical notifications
            if priority != NotificationPriority.CRITICAL:
                return False
    
    return True

async def get_admins_for_notification(notification_type: AdminNotificationType, priority: NotificationPriority) -> List[str]:
    """Get list of admin IDs who should receive this notification"""
    # Get all active admins
    admins = await db.admin_accounts.find({"is_active": True}, {"_id": 0, "admin_id": 1}).to_list(100)
    
    eligible_admins = []
    for admin in admins:
        admin_id = admin["admin_id"]
        if await should_notify_admin(admin_id, notification_type, priority):
            eligible_admins.append(admin_id)
            
            # Check for delegates
            prefs = await get_admin_preferences(admin_id)
            for delegate_id in prefs.delegate_to:
                if delegate_id not in eligible_admins:
                    eligible_admins.append(delegate_id)
    
    return eligible_admins

async def send_push_to_admin(admin_id: str, title: str, body: str, data: dict = None):
    """Send push notification to admin's registered devices"""
    # Get admin's push tokens
    tokens = await db.admin_push_tokens.find({
        "admin_id": admin_id,
        "is_active": True
    }).to_list(10)
    
    for token_doc in tokens:
        try:
            push_token = token_doc.get("push_token") or token_doc.get("expo_push_token")
            if not push_token:
                continue
                
            message = {
                "to": push_token,
                "sound": "default",
                "title": title,
                "body": body,
                "data": data or {},
                "priority": "high",
                "channelId": "admin-alerts",
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://exp.host/--/api/v2/push/send",
                    json=message,
                    headers={"Content-Type": "application/json"},
                    timeout=10.0
                )
                
                if response.status_code == 200:
                    logger.info(f"Admin push sent to {admin_id}")
                else:
                    logger.error(f"Admin push failed: {response.text}")
        except Exception as e:
            logger.error(f"Failed to send admin push: {e}")

# ============== CORE NOTIFICATION FUNCTION ==============

async def create_admin_notification(
    notification_type: AdminNotificationType,
    title: str,
    body: str,
    data: dict = {},
    priority: NotificationPriority = None,
    specific_admins: List[str] = None,
    background_tasks: BackgroundTasks = None
) -> str:
    """Create and send admin notification"""
    
    # Determine priority
    if priority is None:
        priority = NOTIFICATION_DEFAULT_PRIORITY.get(notification_type, NotificationPriority.NORMAL)
    
    # Get recipient admins
    if specific_admins:
        recipient_ids = specific_admins
    else:
        recipient_ids = await get_admins_for_notification(notification_type, priority)
    
    if not recipient_ids:
        logger.warning(f"No admins to notify for {notification_type}")
        return None
    
    # Create notification
    notification = AdminNotification(
        recipient_admin_ids=recipient_ids,
        notification_type=notification_type,
        title=title,
        body=body,
        data=data,
        priority=priority,
    )
    
    # Store in database
    await db.admin_notifications.insert_one(notification.dict())
    
    # Send push notifications to each admin
    for admin_id in recipient_ids:
        prefs = await get_admin_preferences(admin_id)
        if prefs.push_enabled:
            if background_tasks:
                background_tasks.add_task(
                    send_push_to_admin,
                    admin_id,
                    title,
                    body,
                    {"type": notification_type, "notification_id": notification.notification_id, **data}
                )
            else:
                await send_push_to_admin(
                    admin_id,
                    title,
                    body,
                    {"type": notification_type, "notification_id": notification.notification_id, **data}
                )
    
    logger.info(f"Created admin notification {notification.notification_id} for {len(recipient_ids)} admins")
    return notification.notification_id

# ============== TRIGGER FUNCTIONS (Called from other modules) ==============

async def notify_new_kyc_request(user_id: str, user_name: str, user_email: str, background_tasks: BackgroundTasks = None):
    """Notify admins of new KYC verification request"""
    await create_admin_notification(
        notification_type=AdminNotificationType.NEW_KYC_REQUEST,
        title="🪪 New KYC Request",
        body=f"{user_name} ({user_email}) submitted a KYC verification request",
        data={"user_id": user_id, "user_name": user_name, "user_email": user_email},
        background_tasks=background_tasks
    )

async def notify_new_withdrawal(user_id: str, user_name: str, amount: float, withdrawal_id: str, background_tasks: BackgroundTasks = None):
    """Notify admins of new withdrawal request"""
    await create_admin_notification(
        notification_type=AdminNotificationType.NEW_WITHDRAWAL,
        title="💸 New Withdrawal Request",
        body=f"{user_name} requested a ${amount:.2f} withdrawal",
        data={"user_id": user_id, "amount": amount, "withdrawal_id": withdrawal_id},
        background_tasks=background_tasks
    )

async def notify_diamond_promotion(user_id: str, user_name: str, background_tasks: BackgroundTasks = None):
    """Notify admins when a user is promoted to Diamond Leader"""
    await create_admin_notification(
        notification_type=AdminNotificationType.DIAMOND_PROMOTION,
        title="💎 New Diamond Leader!",
        body=f"{user_name} has been promoted to Diamond Leader status",
        data={"user_id": user_id, "user_name": user_name},
        priority=NotificationPriority.HIGH,
        background_tasks=background_tasks
    )

async def notify_admin_login(admin_id: str, admin_email: str, ip_address: str, user_agent: str = None, background_tasks: BackgroundTasks = None):
    """Notify other admins when an admin logs in"""
    # Don't notify the admin who just logged in
    other_admins = await db.admin_accounts.find(
        {"is_active": True, "admin_id": {"$ne": admin_id}},
        {"_id": 0, "admin_id": 1}
    ).to_list(100)
    
    await create_admin_notification(
        notification_type=AdminNotificationType.ADMIN_LOGIN,
        title="🔐 Admin Login",
        body=f"{admin_email} logged into admin panel from {ip_address}",
        data={"admin_id": admin_id, "admin_email": admin_email, "ip_address": ip_address, "user_agent": user_agent},
        priority=NotificationPriority.LOW,
        specific_admins=[a["admin_id"] for a in other_admins],
        background_tasks=background_tasks
    )

async def notify_security_alert(
    alert_type: AdminNotificationType,
    title: str,
    body: str,
    data: dict = {},
    background_tasks: BackgroundTasks = None
):
    """Send security alert to all admins"""
    await create_admin_notification(
        notification_type=alert_type,
        title=title,
        body=body,
        data=data,
        priority=NotificationPriority.CRITICAL,
        background_tasks=background_tasks
    )

async def notify_failed_login_attempts(email: str, attempt_count: int, ip_address: str, background_tasks: BackgroundTasks = None):
    """Notify admins of multiple failed login attempts (potential brute force)"""
    if attempt_count >= 5:
        await notify_security_alert(
            alert_type=AdminNotificationType.BRUTE_FORCE_DETECTED,
            title="🚨 Brute Force Attack Detected",
            body=f"{attempt_count} failed login attempts for {email} from {ip_address}",
            data={"email": email, "attempt_count": attempt_count, "ip_address": ip_address},
            background_tasks=background_tasks
        )
    elif attempt_count >= 3:
        await create_admin_notification(
            notification_type=AdminNotificationType.FAILED_LOGIN_ATTEMPT,
            title="⚠️ Failed Login Attempts",
            body=f"{attempt_count} failed login attempts for {email} from {ip_address}",
            data={"email": email, "attempt_count": attempt_count, "ip_address": ip_address},
            priority=NotificationPriority.HIGH,
            background_tasks=background_tasks
        )

# ============== API ENDPOINTS ==============

@admin_notifications_router.get("/")
async def get_admin_notifications(
    unread_only: bool = False,
    limit: int = 50,
    skip: int = 0,
    current_user: dict = Depends(get_current_user)
):
    """Get notifications for current admin"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    admin_id = current_user.get("admin_id") or current_user.get("user_id")
    
    query = {"recipient_admin_ids": admin_id}
    if unread_only:
        query["read_by"] = {"$ne": admin_id}
    
    notifications = await db.admin_notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    unread_count = await db.admin_notifications.count_documents({
        "recipient_admin_ids": admin_id,
        "read_by": {"$ne": admin_id}
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count,
        "total": await db.admin_notifications.count_documents({"recipient_admin_ids": admin_id})
    }

@admin_notifications_router.post("/mark-read")
async def mark_notifications_read(
    notification_ids: List[str],
    current_user: dict = Depends(get_current_user)
):
    """Mark notifications as read"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    admin_id = current_user.get("admin_id") or current_user.get("user_id")
    
    result = await db.admin_notifications.update_many(
        {"notification_id": {"$in": notification_ids}},
        {"$addToSet": {"read_by": admin_id}}
    )
    
    return {"marked_read": result.modified_count}

@admin_notifications_router.post("/mark-all-read")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    admin_id = current_user.get("admin_id") or current_user.get("user_id")
    
    result = await db.admin_notifications.update_many(
        {"recipient_admin_ids": admin_id, "read_by": {"$ne": admin_id}},
        {"$addToSet": {"read_by": admin_id}}
    )
    
    return {"marked_read": result.modified_count}

@admin_notifications_router.post("/dismiss/{notification_id}")
async def dismiss_notification(notification_id: str, current_user: dict = Depends(get_current_user)):
    """Dismiss a notification (won't show again)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    admin_id = current_user.get("admin_id") or current_user.get("user_id")
    
    await db.admin_notifications.update_one(
        {"notification_id": notification_id},
        {"$addToSet": {"dismissed_by": admin_id, "read_by": admin_id}}
    )
    
    return {"success": True}

@admin_notifications_router.get("/preferences")
async def get_notification_preferences(current_user: dict = Depends(get_current_user)):
    """Get current admin's notification preferences"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    admin_id = current_user.get("admin_id") or current_user.get("user_id")
    prefs = await get_admin_preferences(admin_id)
    
    return prefs.dict()

@admin_notifications_router.put("/preferences")
async def update_notification_preferences(
    updates: NotificationPreferencesUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update notification preferences"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    admin_id = current_user.get("admin_id") or current_user.get("user_id")
    
    # Get current preferences
    prefs = await get_admin_preferences(admin_id)
    
    # Update only provided fields
    update_dict = {k: v for k, v in updates.dict().items() if v is not None}
    update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.admin_notification_preferences.update_one(
        {"admin_id": admin_id},
        {"$set": update_dict},
        upsert=True
    )
    
    return {"success": True, "updated_fields": list(update_dict.keys())}

@admin_notifications_router.post("/register-push-token")
async def register_admin_push_token(
    request: Request,
    push_token: str,
    device_type: str = "unknown",
    current_user: dict = Depends(get_current_user)
):
    """Register a push notification token for admin"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    admin_id = current_user.get("admin_id") or current_user.get("user_id")
    
    # Check if token already exists
    existing = await db.admin_push_tokens.find_one({"push_token": push_token})
    if existing:
        # Update to point to this admin
        await db.admin_push_tokens.update_one(
            {"push_token": push_token},
            {"$set": {"admin_id": admin_id, "is_active": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Create new token record
        await db.admin_push_tokens.insert_one({
            "token_id": f"apt_{uuid.uuid4().hex[:12]}",
            "admin_id": admin_id,
            "push_token": push_token,
            "device_type": device_type,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"success": True, "message": "Push token registered"}

@admin_notifications_router.delete("/unregister-push-token")
async def unregister_admin_push_token(
    push_token: str,
    current_user: dict = Depends(get_current_user)
):
    """Unregister a push notification token"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    admin_id = current_user.get("admin_id") or current_user.get("user_id")
    
    await db.admin_push_tokens.update_one(
        {"push_token": push_token, "admin_id": admin_id},
        {"$set": {"is_active": False}}
    )
    
    return {"success": True}

@admin_notifications_router.post("/test")
async def send_test_notification(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Send a test notification to current admin"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    admin_id = current_user.get("admin_id") or current_user.get("user_id")
    
    await create_admin_notification(
        notification_type=AdminNotificationType.SYSTEM_ALERT,
        title="🔔 Test Notification",
        body="This is a test notification. If you received this, push notifications are working!",
        data={"test": True},
        priority=NotificationPriority.NORMAL,
        specific_admins=[admin_id],
        background_tasks=background_tasks
    )
    
    return {"success": True, "message": "Test notification sent"}

# ============== DELEGATION ENDPOINTS ==============

@admin_notifications_router.get("/delegates")
async def get_available_delegates(current_user: dict = Depends(get_current_user)):
    """Get list of admins that can receive delegated notifications"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    admin_id = current_user.get("admin_id") or current_user.get("user_id")
    
    # Get all other active admins
    admins = await db.admin_accounts.find(
        {"is_active": True, "admin_id": {"$ne": admin_id}},
        {"_id": 0, "admin_id": 1, "user_id": 1, "role": 1}
    ).to_list(100)
    
    # Get user info for each admin
    result = []
    for admin in admins:
        user = await db.users.find_one(
            {"user_id": admin.get("user_id")},
            {"_id": 0, "name": 1, "email": 1}
        )
        if user:
            result.append({
                "admin_id": admin["admin_id"],
                "name": user.get("name", "Unknown"),
                "email": user.get("email"),
                "role": admin.get("role", "admin")
            })
    
    return {"delegates": result}

@admin_notifications_router.put("/delegates")
async def update_delegates(
    delegate_ids: List[str],
    current_user: dict = Depends(get_current_user)
):
    """Update notification delegation"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    admin_id = current_user.get("admin_id") or current_user.get("user_id")
    
    await db.admin_notification_preferences.update_one(
        {"admin_id": admin_id},
        {"$set": {"delegate_to": delegate_ids, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"success": True, "delegates": delegate_ids}
