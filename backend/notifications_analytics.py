"""
Blendlink Notifications & Analytics System
- Push notifications for reactions, friend requests, comments, etc.
- Detailed user analytics and engagement tracking
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import logging
import json
import httpx
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logger = logging.getLogger(__name__)

# ============== ROUTERS ==============
notifications_router = APIRouter(prefix="/notifications", tags=["Notifications"])
analytics_router = APIRouter(prefix="/analytics", tags=["Analytics"])

# ============== MODELS ==============

class NotificationType:
    REACTION = "reaction"
    COMMENT = "comment"
    FRIEND_REQUEST = "friend_request"
    FRIEND_ACCEPTED = "friend_accepted"
    POST_SHARE = "post_share"
    PAGE_SUBSCRIBE = "page_subscribe"
    GROUP_JOIN = "group_join"
    EVENT_RSVP = "event_rsvp"
    BL_COINS_EARNED = "bl_coins_earned"
    DIAMOND_STATUS = "diamond_status"
    SYSTEM = "system"

class Notification(BaseModel):
    notification_id: str = Field(default_factory=lambda: f"notif_{uuid.uuid4().hex[:12]}")
    user_id: str  # Recipient
    type: str
    title: str
    body: str
    data: Dict[str, Any] = {}
    is_read: bool = False
    is_pushed: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PushToken(BaseModel):
    token_id: str = Field(default_factory=lambda: f"token_{uuid.uuid4().hex[:12]}")
    user_id: str
    expo_push_token: str
    device_type: str = "unknown"  # ios, android, web
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserAnalytics(BaseModel):
    analytics_id: str = Field(default_factory=lambda: f"analytics_{uuid.uuid4().hex[:12]}")
    user_id: str
    date: str  # YYYY-MM-DD format
    
    # Content metrics
    posts_created: int = 0
    stories_created: int = 0
    comments_made: int = 0
    reactions_given: int = 0
    shares_made: int = 0
    
    # Engagement received
    reactions_received: int = 0
    comments_received: int = 0
    shares_received: int = 0
    profile_views: int = 0
    
    # Social metrics
    friend_requests_sent: int = 0
    friend_requests_received: int = 0
    friends_added: int = 0
    
    # BL Coins
    bl_coins_earned: float = 0
    bl_coins_spent: float = 0
    
    # AI Generation
    ai_images_generated: int = 0
    ai_videos_generated: int = 0
    
    # Session data
    sessions: int = 0
    total_time_minutes: int = 0
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== REQUEST MODELS ==============

class RegisterPushTokenRequest(BaseModel):
    expo_push_token: str
    device_type: str = "unknown"

class MarkNotificationsReadRequest(BaseModel):
    notification_ids: List[str]

class AnalyticsDateRange(BaseModel):
    start_date: str  # YYYY-MM-DD
    end_date: str  # YYYY-MM-DD

# ============== HELPER FUNCTIONS ==============

# Import get_current_user from server module
from server import get_current_user

async def get_user_by_id(user_id: str):
    """Get user by ID"""
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})

async def send_expo_push_notification(push_token: str, title: str, body: str, data: dict = None):
    """Send push notification via Expo Push Service"""
    try:
        message = {
            "to": push_token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=message,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"Push sent successfully: {result}")
                return True
            else:
                logger.error(f"Push failed: {response.text}")
                return False
    except Exception as e:
        logger.error(f"Failed to send push notification: {e}")
        return False

async def send_notification_to_user(
    user_id: str,
    notification_type: str,
    title: str,
    body: str,
    data: dict = None,
    background_tasks: BackgroundTasks = None
):
    """Create notification and send push if user has registered token"""
    
    # Create notification record
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        body=body,
        data=data or {}
    )
    
    notif_dict = notification.model_dump()
    notif_dict["created_at"] = notif_dict["created_at"].isoformat()
    await db.notifications.insert_one(notif_dict.copy())
    
    # Get user's push tokens
    tokens = await db.push_tokens.find({
        "user_id": user_id,
        "is_active": True
    }).to_list(10)
    
    # Send push to all registered devices
    for token_doc in tokens:
        if background_tasks:
            background_tasks.add_task(
                send_expo_push_notification,
                token_doc["expo_push_token"],
                title,
                body,
                data
            )
        else:
            await send_expo_push_notification(
                token_doc["expo_push_token"],
                title,
                body,
                data
            )
    
    # Update notification as pushed if we sent to at least one device
    if tokens:
        await db.notifications.update_one(
            {"notification_id": notification.notification_id},
            {"$set": {"is_pushed": True}}
        )
    
    return notification.notification_id

async def track_analytics_event(
    user_id: str,
    event_type: str,
    value: int = 1
):
    """Track an analytics event for a user"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Find or create today's analytics record
    analytics = await db.user_analytics.find_one({
        "user_id": user_id,
        "date": today
    })
    
    if not analytics:
        # Create new record
        new_analytics = UserAnalytics(user_id=user_id, date=today)
        analytics_dict = new_analytics.model_dump()
        analytics_dict["created_at"] = analytics_dict["created_at"].isoformat()
        analytics_dict["updated_at"] = analytics_dict["updated_at"].isoformat()
        await db.user_analytics.insert_one(analytics_dict)
    
    # Update the specific metric
    field_map = {
        "post_created": "posts_created",
        "story_created": "stories_created",
        "comment_made": "comments_made",
        "reaction_given": "reactions_given",
        "share_made": "shares_made",
        "reaction_received": "reactions_received",
        "comment_received": "comments_received",
        "share_received": "shares_received",
        "profile_view": "profile_views",
        "friend_request_sent": "friend_requests_sent",
        "friend_request_received": "friend_requests_received",
        "friend_added": "friends_added",
        "bl_coins_earned": "bl_coins_earned",
        "bl_coins_spent": "bl_coins_spent",
        "ai_image_generated": "ai_images_generated",
        "ai_video_generated": "ai_videos_generated",
        "session_start": "sessions",
        "time_spent": "total_time_minutes",
    }
    
    field = field_map.get(event_type)
    if field:
        await db.user_analytics.update_one(
            {"user_id": user_id, "date": today},
            {
                "$inc": {field: value},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )

# ============== NOTIFICATION ENDPOINTS ==============

@notifications_router.post("/register-token")
async def register_push_token(
    request: RegisterPushTokenRequest,
    current_user: dict = Depends(get_current_user)
):
    """Register a push notification token for the current user"""
    user_id = current_user["user_id"]
    
    # Check if token already exists
    existing = await db.push_tokens.find_one({
        "user_id": user_id,
        "expo_push_token": request.expo_push_token
    })
    
    if existing:
        # Update existing token
        await db.push_tokens.update_one(
            {"token_id": existing["token_id"]},
            {
                "$set": {
                    "is_active": True,
                    "device_type": request.device_type,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return {"message": "Push token updated", "token_id": existing["token_id"]}
    
    # Create new token
    token = PushToken(
        user_id=user_id,
        expo_push_token=request.expo_push_token,
        device_type=request.device_type
    )
    
    token_dict = token.model_dump()
    token_dict["created_at"] = token_dict["created_at"].isoformat()
    token_dict["updated_at"] = token_dict["updated_at"].isoformat()
    await db.push_tokens.insert_one(token_dict)
    
    return {"message": "Push token registered", "token_id": token.token_id}

@notifications_router.delete("/unregister-token")
async def unregister_push_token(
    expo_push_token: str,
    current_user: dict = Depends(get_current_user)
):
    """Unregister a push notification token"""
    result = await db.push_tokens.update_one(
        {
            "user_id": current_user["user_id"],
            "expo_push_token": expo_push_token
        },
        {"$set": {"is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Token not found")
    
    return {"message": "Push token unregistered"}

@notifications_router.get("/")
async def get_notifications(
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get notifications for the current user"""
    query = {"user_id": current_user["user_id"]}
    if unread_only:
        query["is_read"] = False
    
    notifications = await db.notifications.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get unread count
    unread_count = await db.notifications.count_documents({
        "user_id": current_user["user_id"],
        "is_read": False
    })
    
    return {
        "notifications": notifications,
        "unread_count": unread_count
    }

@notifications_router.post("/mark-read")
async def mark_notifications_read(
    request: MarkNotificationsReadRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark notifications as read"""
    result = await db.notifications.update_many(
        {
            "user_id": current_user["user_id"],
            "notification_id": {"$in": request.notification_ids}
        },
        {"$set": {"is_read": True}}
    )
    
    return {"message": f"Marked {result.modified_count} notifications as read"}

@notifications_router.post("/mark-all-read")
async def mark_all_notifications_read(current_user: dict = Depends(get_current_user)):
    """Mark all notifications as read"""
    result = await db.notifications.update_many(
        {"user_id": current_user["user_id"], "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return {"message": f"Marked {result.modified_count} notifications as read"}

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
    
    return {"message": "Notification deleted"}

@notifications_router.get("/settings")
async def get_notification_settings(current_user: dict = Depends(get_current_user)):
    """Get notification preferences"""
    settings = await db.notification_settings.find_one(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    # Default settings
    default_settings = {
        "user_id": current_user["user_id"],
        "reactions": True,
        "comments": True,
        "friend_requests": True,
        "friend_accepted": True,
        "shares": True,
        "page_subscribers": True,
        "group_activity": True,
        "event_reminders": True,
        "bl_coins": True,
        "marketing": False,
    }
    
    return settings or default_settings

@notifications_router.put("/settings")
async def update_notification_settings(
    settings: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update notification preferences"""
    settings["user_id"] = current_user["user_id"]
    settings["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.notification_settings.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": settings},
        upsert=True
    )
    
    return {"message": "Settings updated"}

# ============== ANALYTICS ENDPOINTS ==============

@analytics_router.get("/my-stats")
async def get_my_analytics(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get current user's analytics for the specified period"""
    user_id = current_user["user_id"]
    
    # Calculate date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Get analytics records
    analytics = await db.user_analytics.find({
        "user_id": user_id,
        "date": {
            "$gte": start_date.strftime("%Y-%m-%d"),
            "$lte": end_date.strftime("%Y-%m-%d")
        }
    }, {"_id": 0}).sort("date", -1).to_list(days)
    
    # Calculate totals
    totals = {
        "posts_created": 0,
        "stories_created": 0,
        "comments_made": 0,
        "reactions_given": 0,
        "shares_made": 0,
        "reactions_received": 0,
        "comments_received": 0,
        "shares_received": 0,
        "profile_views": 0,
        "friend_requests_sent": 0,
        "friend_requests_received": 0,
        "friends_added": 0,
        "bl_coins_earned": 0,
        "bl_coins_spent": 0,
        "ai_images_generated": 0,
        "ai_videos_generated": 0,
        "sessions": 0,
        "total_time_minutes": 0,
    }
    
    for record in analytics:
        for key in totals:
            totals[key] += record.get(key, 0)
    
    # Get overall user stats
    user = await get_user_by_id(user_id)
    
    # Get all-time stats from database
    all_time_posts = await db.social_posts.count_documents({"user_id": user_id})
    all_time_comments = await db.comments.count_documents({"user_id": user_id})
    all_time_reactions = await db.reactions.count_documents({"user_id": user_id})
    friends_count = await db.friendships.count_documents({
        "$or": [{"user_id_1": user_id}, {"user_id_2": user_id}]
    })
    
    return {
        "period_days": days,
        "period_totals": totals,
        "daily_breakdown": analytics,
        "all_time_stats": {
            "total_posts": all_time_posts,
            "total_comments": all_time_comments,
            "total_reactions": all_time_reactions,
            "total_friends": friends_count,
            "bl_coins_balance": user.get("bl_coins", 0) if user else 0,
            "account_created": user.get("created_at") if user else None,
        },
        "engagement_rate": calculate_engagement_rate(totals),
    }

@analytics_router.get("/leaderboard")
async def get_leaderboard(
    metric: str = "bl_coins_earned",
    days: int = 7,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get leaderboard for a specific metric"""
    valid_metrics = [
        "bl_coins_earned", "posts_created", "reactions_received",
        "comments_received", "friends_added", "profile_views"
    ]
    
    if metric not in valid_metrics:
        raise HTTPException(status_code=400, detail=f"Invalid metric. Valid options: {valid_metrics}")
    
    # Calculate date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Aggregate user analytics
    pipeline = [
        {
            "$match": {
                "date": {
                    "$gte": start_date.strftime("%Y-%m-%d"),
                    "$lte": end_date.strftime("%Y-%m-%d")
                }
            }
        },
        {
            "$group": {
                "_id": "$user_id",
                "total": {"$sum": f"${metric}"}
            }
        },
        {"$sort": {"total": -1}},
        {"$limit": limit}
    ]
    
    results = await db.user_analytics.aggregate(pipeline).to_list(limit)
    
    # Enrich with user info
    leaderboard = []
    for i, result in enumerate(results):
        user = await get_user_by_id(result["_id"])
        leaderboard.append({
            "rank": i + 1,
            "user_id": result["_id"],
            "name": user.get("name", "Unknown") if user else "Unknown",
            "avatar": user.get("avatar", "") if user else "",
            "value": result["total"],
            "is_current_user": result["_id"] == current_user["user_id"]
        })
    
    # Find current user's rank if not in top
    current_user_in_list = any(l["is_current_user"] for l in leaderboard)
    current_user_rank = None
    
    if not current_user_in_list:
        # Calculate current user's rank
        user_total_pipeline = [
            {
                "$match": {
                    "user_id": current_user["user_id"],
                    "date": {
                        "$gte": start_date.strftime("%Y-%m-%d"),
                        "$lte": end_date.strftime("%Y-%m-%d")
                    }
                }
            },
            {
                "$group": {
                    "_id": "$user_id",
                    "total": {"$sum": f"${metric}"}
                }
            }
        ]
        user_result = await db.user_analytics.aggregate(user_total_pipeline).to_list(1)
        
        if user_result:
            # Count users with higher values
            higher_count = await db.user_analytics.aggregate([
                {
                    "$match": {
                        "date": {
                            "$gte": start_date.strftime("%Y-%m-%d"),
                            "$lte": end_date.strftime("%Y-%m-%d")
                        }
                    }
                },
                {
                    "$group": {
                        "_id": "$user_id",
                        "total": {"$sum": f"${metric}"}
                    }
                },
                {
                    "$match": {
                        "total": {"$gt": user_result[0]["total"]}
                    }
                },
                {"$count": "count"}
            ]).to_list(1)
            
            current_user_rank = {
                "rank": (higher_count[0]["count"] if higher_count else 0) + 1,
                "value": user_result[0]["total"]
            }
    
    return {
        "metric": metric,
        "period_days": days,
        "leaderboard": leaderboard,
        "current_user_rank": current_user_rank
    }

@analytics_router.get("/trends")
async def get_analytics_trends(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get trend data for charts"""
    user_id = current_user["user_id"]
    
    # Calculate date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    # Get daily analytics
    analytics = await db.user_analytics.find({
        "user_id": user_id,
        "date": {
            "$gte": start_date.strftime("%Y-%m-%d"),
            "$lte": end_date.strftime("%Y-%m-%d")
        }
    }, {"_id": 0}).sort("date", 1).to_list(days)
    
    # Build trend data
    dates = []
    bl_coins_trend = []
    engagement_trend = []
    content_trend = []
    
    for record in analytics:
        dates.append(record["date"])
        bl_coins_trend.append(record.get("bl_coins_earned", 0))
        engagement_trend.append(
            record.get("reactions_received", 0) +
            record.get("comments_received", 0) +
            record.get("shares_received", 0)
        )
        content_trend.append(
            record.get("posts_created", 0) +
            record.get("stories_created", 0) +
            record.get("comments_made", 0)
        )
    
    # Calculate week-over-week changes
    if len(analytics) >= 14:
        this_week = analytics[-7:]
        last_week = analytics[-14:-7]
        
        this_week_coins = sum(r.get("bl_coins_earned", 0) for r in this_week)
        last_week_coins = sum(r.get("bl_coins_earned", 0) for r in last_week)
        
        coins_change = ((this_week_coins - last_week_coins) / max(last_week_coins, 1)) * 100
    else:
        coins_change = 0
    
    return {
        "dates": dates,
        "bl_coins_trend": bl_coins_trend,
        "engagement_trend": engagement_trend,
        "content_trend": content_trend,
        "week_over_week_change": {
            "bl_coins": round(coins_change, 1)
        }
    }

@analytics_router.get("/summary")
async def get_analytics_summary(current_user: dict = Depends(get_current_user)):
    """Get a quick summary of key metrics"""
    user_id = current_user["user_id"]
    
    # Today's date
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    
    # Get today's and yesterday's analytics
    today_analytics = await db.user_analytics.find_one(
        {"user_id": user_id, "date": today},
        {"_id": 0}
    )
    
    yesterday_analytics = await db.user_analytics.find_one(
        {"user_id": user_id, "date": yesterday},
        {"_id": 0}
    )
    
    # Get user's current balance
    user = await get_user_by_id(user_id)
    current_balance = user.get("bl_coins", 0) if user else 0
    
    # Get unread notifications count
    unread_notifications = await db.notifications.count_documents({
        "user_id": user_id,
        "is_read": False
    })
    
    # Calculate today's earnings
    today_earned = today_analytics.get("bl_coins_earned", 0) if today_analytics else 0
    yesterday_earned = yesterday_analytics.get("bl_coins_earned", 0) if yesterday_analytics else 0
    
    # Get engagement today
    today_engagement = 0
    if today_analytics:
        today_engagement = (
            today_analytics.get("reactions_received", 0) +
            today_analytics.get("comments_received", 0) +
            today_analytics.get("shares_received", 0)
        )
    
    return {
        "bl_coins_balance": current_balance,
        "today_earned": today_earned,
        "yesterday_earned": yesterday_earned,
        "earning_change": today_earned - yesterday_earned,
        "today_engagement": today_engagement,
        "unread_notifications": unread_notifications,
        "last_updated": datetime.now(timezone.utc).isoformat()
    }

@analytics_router.post("/track-session")
async def track_session_start(current_user: dict = Depends(get_current_user)):
    """Track when user starts a session"""
    await track_analytics_event(current_user["user_id"], "session_start", 1)
    return {"message": "Session tracked"}

@analytics_router.post("/track-time")
async def track_time_spent(
    minutes: int,
    current_user: dict = Depends(get_current_user)
):
    """Track time spent in app"""
    await track_analytics_event(current_user["user_id"], "time_spent", minutes)
    return {"message": f"Tracked {minutes} minutes"}

# ============== ADMIN ANALYTICS ENDPOINTS ==============

@analytics_router.get("/admin/overview")
async def get_admin_analytics_overview(current_user: dict = Depends(get_current_user)):
    """Get platform-wide analytics (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get date range
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=30)
    
    # Total users
    total_users = await db.users.count_documents({})
    
    # New users this month
    new_users = await db.users.count_documents({
        "created_at": {"$gte": start_date.isoformat()}
    })
    
    # Active users (users with analytics in last 7 days)
    week_ago = (end_date - timedelta(days=7)).strftime("%Y-%m-%d")
    active_user_ids = await db.user_analytics.distinct("user_id", {
        "date": {"$gte": week_ago}
    })
    active_users = len(active_user_ids)
    
    # Total posts
    total_posts = await db.social_posts.count_documents({})
    
    # Posts this month
    posts_this_month = await db.social_posts.count_documents({
        "created_at": {"$gte": start_date.isoformat()}
    })
    
    # Total BL coins in circulation
    bl_coins_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$bl_coins"}}}
    ]
    bl_coins_result = await db.users.aggregate(bl_coins_pipeline).to_list(1)
    total_bl_coins = bl_coins_result[0]["total"] if bl_coins_result else 0
    
    # Total reactions
    total_reactions = await db.reactions.count_documents({})
    
    # Total comments
    total_comments = await db.comments.count_documents({})
    
    # Diamond leaders
    diamond_leaders = await db.users.count_documents({"is_diamond_leader": True})
    
    # Daily active users trend
    dau_pipeline = [
        {
            "$match": {
                "date": {
                    "$gte": (end_date - timedelta(days=7)).strftime("%Y-%m-%d")
                }
            }
        },
        {
            "$group": {
                "_id": "$date",
                "active_users": {"$addToSet": "$user_id"}
            }
        },
        {
            "$project": {
                "date": "$_id",
                "count": {"$size": "$active_users"}
            }
        },
        {"$sort": {"date": 1}}
    ]
    dau_trend = await db.user_analytics.aggregate(dau_pipeline).to_list(7)
    
    return {
        "users": {
            "total": total_users,
            "new_this_month": new_users,
            "active_last_7_days": active_users,
            "diamond_leaders": diamond_leaders
        },
        "content": {
            "total_posts": total_posts,
            "posts_this_month": posts_this_month,
            "total_reactions": total_reactions,
            "total_comments": total_comments
        },
        "economy": {
            "total_bl_coins_circulation": total_bl_coins,
        },
        "dau_trend": [{"date": d["date"], "count": d["count"]} for d in dau_trend],
        "generated_at": datetime.now(timezone.utc).isoformat()
    }

@analytics_router.get("/admin/user/{user_id}")
async def get_user_analytics_admin(
    user_id: str,
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed analytics for a specific user (admin only)"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's analytics
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=days)
    
    analytics = await db.user_analytics.find({
        "user_id": user_id,
        "date": {
            "$gte": start_date.strftime("%Y-%m-%d"),
            "$lte": end_date.strftime("%Y-%m-%d")
        }
    }, {"_id": 0}).sort("date", -1).to_list(days)
    
    # Get transactions
    transactions = await db.transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    return {
        "user": {
            "user_id": user["user_id"],
            "name": user.get("name"),
            "email": user.get("email"),
            "username": user.get("username"),
            "bl_coins": user.get("bl_coins", 0),
            "is_diamond_leader": user.get("is_diamond_leader", False),
            "created_at": user.get("created_at")
        },
        "analytics": analytics,
        "recent_transactions": transactions
    }

# ============== HELPER FUNCTIONS ==============

def calculate_engagement_rate(totals: dict) -> float:
    """Calculate engagement rate from totals"""
    content_created = totals.get("posts_created", 0) + totals.get("stories_created", 0)
    if content_created == 0:
        return 0
    
    engagement = (
        totals.get("reactions_received", 0) +
        totals.get("comments_received", 0) +
        totals.get("shares_received", 0)
    )
    
    return round((engagement / content_created) * 100, 2)

# Export routers
def get_notification_analytics_routers():
    return [notifications_router, analytics_router]
