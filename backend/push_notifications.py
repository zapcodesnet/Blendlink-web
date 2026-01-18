"""
Blendlink Push Notifications Service
- Expo Push Notifications for mobile app
- Integration with WebSocket for real-time fallback
"""

import os
import json
import httpx
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class PushNotification(BaseModel):
    """Push notification payload"""
    to: str  # Expo push token
    title: str
    body: str
    data: Dict[str, Any] = Field(default_factory=dict)
    sound: str = "default"
    badge: int = 1
    priority: str = "high"  # high, normal
    channel_id: Optional[str] = None  # Android notification channel


class PushNotificationService:
    """Service for sending push notifications"""
    
    def __init__(self, db):
        self.db = db
        self.http_client = httpx.AsyncClient(timeout=30.0)
    
    async def register_token(self, user_id: str, expo_token: str, device_info: Dict = None) -> bool:
        """Register a user's Expo push token"""
        try:
            await self.db.push_tokens.update_one(
                {"user_id": user_id, "expo_token": expo_token},
                {"$set": {
                    "user_id": user_id,
                    "expo_token": expo_token,
                    "device_info": device_info or {},
                    "is_active": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }},
                upsert=True
            )
            logger.info(f"Registered push token for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to register push token: {e}")
            return False
    
    async def unregister_token(self, user_id: str, expo_token: str) -> bool:
        """Unregister a push token"""
        try:
            await self.db.push_tokens.update_one(
                {"user_id": user_id, "expo_token": expo_token},
                {"$set": {"is_active": False}}
            )
            return True
        except Exception as e:
            logger.error(f"Failed to unregister push token: {e}")
            return False
    
    async def get_user_tokens(self, user_id: str) -> List[str]:
        """Get all active push tokens for a user"""
        tokens = await self.db.push_tokens.find(
            {"user_id": user_id, "is_active": True},
            {"expo_token": 1, "_id": 0}
        ).to_list(length=10)
        return [t["expo_token"] for t in tokens]
    
    async def send_notification(
        self,
        user_id: str,
        title: str,
        body: str,
        data: Dict = None,
        sound: str = "default",
        badge: int = 1
    ) -> Dict[str, Any]:
        """Send push notification to a user"""
        tokens = await self.get_user_tokens(user_id)
        
        if not tokens:
            logger.info(f"No push tokens found for user {user_id}")
            return {"success": False, "reason": "no_tokens"}
        
        messages = []
        for token in tokens:
            messages.append({
                "to": token,
                "title": title,
                "body": body,
                "data": data or {},
                "sound": sound,
                "badge": badge,
                "priority": "high"
            })
        
        return await self._send_to_expo(messages)
    
    async def send_bulk_notifications(
        self,
        user_ids: List[str],
        title: str,
        body: str,
        data: Dict = None
    ) -> Dict[str, Any]:
        """Send push notification to multiple users"""
        messages = []
        
        for user_id in user_ids:
            tokens = await self.get_user_tokens(user_id)
            for token in tokens:
                messages.append({
                    "to": token,
                    "title": title,
                    "body": body,
                    "data": data or {},
                    "sound": "default",
                    "priority": "high"
                })
        
        if not messages:
            return {"success": False, "reason": "no_tokens"}
        
        return await self._send_to_expo(messages)
    
    async def _send_to_expo(self, messages: List[Dict]) -> Dict[str, Any]:
        """Send messages to Expo push service"""
        try:
            # Expo accepts up to 100 messages per request
            chunks = [messages[i:i+100] for i in range(0, len(messages), 100)]
            
            results = []
            for chunk in chunks:
                response = await self.http_client.post(
                    EXPO_PUSH_URL,
                    json=chunk,
                    headers={
                        "Accept": "application/json",
                        "Accept-Encoding": "gzip, deflate",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    results.extend(result.get("data", []))
                else:
                    logger.error(f"Expo push failed: {response.status_code} - {response.text}")
            
            # Check for errors
            errors = [r for r in results if r.get("status") == "error"]
            if errors:
                logger.warning(f"Some push notifications failed: {errors}")
            
            return {
                "success": True,
                "sent": len(results) - len(errors),
                "failed": len(errors),
                "errors": errors
            }
            
        except Exception as e:
            logger.error(f"Failed to send push notifications: {e}")
            return {"success": False, "error": str(e)}
    
    # ============== NOTIFICATION HELPERS ==============
    
    async def notify_match_found(self, user_id: str, opponent_name: str, match_id: str):
        """Notify user that a match was found"""
        await self.send_notification(
            user_id=user_id,
            title="⚔️ Match Found!",
            body=f"Your opponent {opponent_name} is ready to battle!",
            data={
                "type": "match_found",
                "match_id": match_id,
                "screen": "PhotoGameArena"
            }
        )
    
    async def notify_your_turn(self, user_id: str, session_id: str):
        """Notify user it's their turn"""
        await self.send_notification(
            user_id=user_id,
            title="🎮 Your Turn!",
            body="Make your move in the battle!",
            data={
                "type": "your_turn",
                "session_id": session_id,
                "screen": "PhotoGameArena"
            }
        )
    
    async def notify_battle_result(self, user_id: str, won: bool, bl_change: int):
        """Notify user about battle result"""
        if won:
            title = "🏆 Victory!"
            body = f"You won the battle! +{bl_change} BL Coins"
        else:
            title = "😢 Defeat"
            body = f"Better luck next time. {bl_change} BL Coins"
        
        await self.send_notification(
            user_id=user_id,
            title=title,
            body=body,
            data={
                "type": "battle_result",
                "won": won,
                "bl_change": bl_change
            }
        )
    
    async def notify_new_offer(self, user_id: str, item_name: str, offer_amount: int, buyer_name: str):
        """Notify seller about new offer"""
        await self.send_notification(
            user_id=user_id,
            title="💰 New Offer!",
            body=f"{buyer_name} offered {offer_amount} BL for {item_name}",
            data={
                "type": "new_offer",
                "screen": "PhotoMarketplace"
            }
        )
    
    async def notify_offer_accepted(self, user_id: str, item_name: str, amount: int):
        """Notify buyer that offer was accepted"""
        await self.send_notification(
            user_id=user_id,
            title="🎉 Offer Accepted!",
            body=f"Your offer for {item_name} was accepted!",
            data={
                "type": "offer_accepted",
                "screen": "MintedPhotos"
            }
        )
    
    async def notify_item_sold(self, user_id: str, item_name: str, amount: int):
        """Notify seller that item was sold"""
        await self.send_notification(
            user_id=user_id,
            title="💸 Item Sold!",
            body=f"{item_name} sold for {amount} BL Coins!",
            data={
                "type": "item_sold",
                "screen": "PhotoMarketplace"
            }
        )
    
    async def notify_daily_bonus_available(self, user_id: str, tier: str, bonus_amount: int):
        """Notify user about daily bonus"""
        await self.send_notification(
            user_id=user_id,
            title="🎁 Daily Bonus Available!",
            body=f"Claim your {bonus_amount} BL Coins bonus!",
            data={
                "type": "daily_bonus",
                "screen": "Subscription"
            },
            badge=1
        )
    
    async def notify_tournament_starting(self, user_ids: List[str], tournament_name: str, tournament_id: str):
        """Notify participants that tournament is starting"""
        await self.send_bulk_notifications(
            user_ids=user_ids,
            title="🏆 Tournament Starting!",
            body=f"{tournament_name} is about to begin!",
            data={
                "type": "tournament_starting",
                "tournament_id": tournament_id,
                "screen": "PhotoGameArena"
            }
        )


# ============== API ROUTES ==============
from fastapi import APIRouter, HTTPException, Depends, Request

push_router = APIRouter(prefix="/push", tags=["Push Notifications"])
_db = None
_push_service = None


def setup_push_routes(db):
    """Initialize routes with database connection"""
    global _db, _push_service
    _db = db
    _push_service = PushNotificationService(db)


def get_push_service():
    if _push_service is None:
        raise HTTPException(status_code=500, detail="Push service not initialized")
    return _push_service


async def get_current_user(request: Request) -> dict:
    """Extract current user from request"""
    from jose import jwt, JWTError
    JWT_SECRET = os.environ.get("JWT_SECRET", "blendlink-secret-key-2024")
    JWT_ALGORITHM = "HS256"
    
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await _db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@push_router.post("/register")
async def register_push_token(
    expo_token: str,
    device_info: Dict = None,
    current_user: dict = Depends(get_current_user)
):
    """Register Expo push token for current user"""
    service = get_push_service()
    success = await service.register_token(
        current_user["user_id"],
        expo_token,
        device_info
    )
    return {"success": success}


@push_router.post("/unregister")
async def unregister_push_token(
    expo_token: str,
    current_user: dict = Depends(get_current_user)
):
    """Unregister Expo push token"""
    service = get_push_service()
    success = await service.unregister_token(
        current_user["user_id"],
        expo_token
    )
    return {"success": success}


@push_router.post("/test")
async def test_push_notification(
    current_user: dict = Depends(get_current_user)
):
    """Send a test push notification to current user"""
    service = get_push_service()
    result = await service.send_notification(
        user_id=current_user["user_id"],
        title="🔔 Test Notification",
        body="Push notifications are working!",
        data={"type": "test"}
    )
    return result
