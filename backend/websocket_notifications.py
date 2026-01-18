"""
Blendlink WebSocket Notification System
- Real-time game events (match found, opponent turn, result)
- Marketplace events (offers, sales)
- BL coin events (rewards, bonuses)
- Push notification integration
"""

import json
import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Set, Optional, Any
from enum import Enum
from fastapi import WebSocket, WebSocketDisconnect
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class NotificationType(str, Enum):
    """Types of real-time notifications"""
    # Game events
    MATCH_FOUND = "match_found"
    OPPONENT_TURN = "opponent_turn"
    YOUR_TURN = "your_turn"
    GAME_RESULT = "game_result"
    RPS_ROUND_RESULT = "rps_round_result"
    PHOTO_BATTLE_RESULT = "photo_battle_result"
    
    # Marketplace events
    OFFER_RECEIVED = "offer_received"
    OFFER_ACCEPTED = "offer_accepted"
    OFFER_DECLINED = "offer_declined"
    SALE_COMPLETED = "sale_completed"
    LISTING_SOLD = "listing_sold"
    
    # BL coin events
    BL_REWARD = "bl_reward"
    DOWNLINE_BONUS = "downline_bonus"
    REACTION_REWARD = "reaction_reward"
    
    # General
    NOTIFICATION = "notification"
    SYSTEM = "system"


class WebSocketNotification(BaseModel):
    """Structure for WebSocket messages"""
    type: str
    title: str
    message: str
    data: Dict[str, Any] = {}
    timestamp: str = ""
    
    def __init__(self, **data):
        if not data.get("timestamp"):
            data["timestamp"] = datetime.now(timezone.utc).isoformat()
        super().__init__(**data)


class ConnectionManager:
    """Manages WebSocket connections for all users"""
    
    def __init__(self):
        # Map user_id to set of WebSocket connections (user can have multiple devices)
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self._lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept and register a new WebSocket connection"""
        await websocket.accept()
        
        async with self._lock:
            if user_id not in self.active_connections:
                self.active_connections[user_id] = set()
            self.active_connections[user_id].add(websocket)
        
        logger.info(f"WebSocket connected: user {user_id} ({len(self.active_connections[user_id])} connections)")
        
        # Send welcome message
        await self.send_to_user(user_id, WebSocketNotification(
            type=NotificationType.SYSTEM.value,
            title="Connected",
            message="Real-time notifications active",
            data={"connected_at": datetime.now(timezone.utc).isoformat()}
        ))
    
    async def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove a WebSocket connection"""
        async with self._lock:
            if user_id in self.active_connections:
                self.active_connections[user_id].discard(websocket)
                if not self.active_connections[user_id]:
                    del self.active_connections[user_id]
        
        logger.info(f"WebSocket disconnected: user {user_id}")
    
    async def send_to_user(self, user_id: str, notification: WebSocketNotification) -> bool:
        """Send notification to a specific user (all their connections)"""
        if user_id not in self.active_connections:
            return False
        
        message = notification.model_dump_json()
        disconnected = set()
        
        for websocket in self.active_connections[user_id]:
            try:
                await websocket.send_text(message)
            except Exception as e:
                logger.error(f"Failed to send to {user_id}: {e}")
                disconnected.add(websocket)
        
        # Clean up disconnected
        if disconnected:
            async with self._lock:
                for ws in disconnected:
                    self.active_connections[user_id].discard(ws)
        
        return True
    
    async def send_to_users(self, user_ids: list, notification: WebSocketNotification):
        """Send notification to multiple users"""
        for user_id in user_ids:
            await self.send_to_user(user_id, notification)
    
    async def broadcast(self, notification: WebSocketNotification):
        """Send notification to all connected users"""
        for user_id in list(self.active_connections.keys()):
            await self.send_to_user(user_id, notification)
    
    def is_user_online(self, user_id: str) -> bool:
        """Check if user has any active connections"""
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0
    
    def get_online_users(self) -> list:
        """Get list of online user IDs"""
        return list(self.active_connections.keys())
    
    def get_stats(self) -> Dict:
        """Get connection statistics"""
        total_connections = sum(len(conns) for conns in self.active_connections.values())
        return {
            "online_users": len(self.active_connections),
            "total_connections": total_connections,
        }


# Global connection manager
ws_manager = ConnectionManager()


# ============== NOTIFICATION HELPERS ==============

async def notify_match_found(player1_id: str, player2_id: str, match_id: str, mode: str):
    """Notify both players that a match was found"""
    notification = WebSocketNotification(
        type=NotificationType.MATCH_FOUND.value,
        title="Match Found!",
        message=f"{'Bot' if mode == 'bot' else 'Player'} opponent found",
        data={
            "match_id": match_id,
            "mode": mode,
        }
    )
    
    await ws_manager.send_to_user(player1_id, notification)
    if player2_id != "bot":
        await ws_manager.send_to_user(player2_id, notification)


async def notify_game_turn(player_id: str, session_id: str, phase: str):
    """Notify player it's their turn"""
    notification = WebSocketNotification(
        type=NotificationType.YOUR_TURN.value,
        title="Your Turn!",
        message=f"Make your move in the {phase} phase",
        data={
            "session_id": session_id,
            "phase": phase,
        }
    )
    await ws_manager.send_to_user(player_id, notification)


async def notify_rps_result(player_id: str, session_id: str, round_data: Dict, scores: Dict):
    """Notify player of RPS round result"""
    result = round_data.get("winner", "tie")
    is_win = result == "player1" if round_data.get("is_player1", True) else result == "player2"
    
    notification = WebSocketNotification(
        type=NotificationType.RPS_ROUND_RESULT.value,
        title="Round Complete!",
        message=f"You {'won' if is_win else 'lost' if result != 'tie' else 'tied'} this round",
        data={
            "session_id": session_id,
            "round": round_data,
            "scores": scores,
        }
    )
    await ws_manager.send_to_user(player_id, notification)


async def notify_game_result(winner_id: str, loser_id: str, session_id: str, winnings: int = 0):
    """Notify both players of game result"""
    # Winner notification
    await ws_manager.send_to_user(winner_id, WebSocketNotification(
        type=NotificationType.GAME_RESULT.value,
        title="🏆 Victory!",
        message=f"You won{f' +{winnings} BL' if winnings > 0 else ''}!",
        data={
            "session_id": session_id,
            "result": "win",
            "winnings": winnings,
        }
    ))
    
    # Loser notification (if not bot)
    if loser_id != "bot":
        await ws_manager.send_to_user(loser_id, WebSocketNotification(
            type=NotificationType.GAME_RESULT.value,
            title="😢 Defeat",
            message="Better luck next time!",
            data={
                "session_id": session_id,
                "result": "lose",
            }
        ))


async def notify_offer_received(seller_id: str, buyer_name: str, amount: float, content_type: str, offer_id: str):
    """Notify seller of new offer"""
    notification = WebSocketNotification(
        type=NotificationType.OFFER_RECEIVED.value,
        title="New Offer!",
        message=f"{buyer_name} offered ${amount:.2f} for your {content_type}",
        data={
            "offer_id": offer_id,
            "amount": amount,
            "content_type": content_type,
        }
    )
    await ws_manager.send_to_user(seller_id, notification)


async def notify_offer_response(buyer_id: str, accepted: bool, content_type: str, amount: float):
    """Notify buyer of offer response"""
    notification = WebSocketNotification(
        type=NotificationType.OFFER_ACCEPTED.value if accepted else NotificationType.OFFER_DECLINED.value,
        title="Offer Accepted!" if accepted else "Offer Declined",
        message=f"Your ${amount:.2f} offer was {'accepted' if accepted else 'declined'}",
        data={
            "accepted": accepted,
            "content_type": content_type,
            "amount": amount,
        }
    )
    await ws_manager.send_to_user(buyer_id, notification)


async def notify_sale_completed(seller_id: str, buyer_id: str, amount: float, content_name: str):
    """Notify both parties of completed sale"""
    # Seller
    await ws_manager.send_to_user(seller_id, WebSocketNotification(
        type=NotificationType.SALE_COMPLETED.value,
        title="Sale Completed!",
        message=f"'{content_name}' sold for ${amount:.2f}",
        data={"role": "seller", "amount": amount}
    ))
    
    # Buyer
    await ws_manager.send_to_user(buyer_id, WebSocketNotification(
        type=NotificationType.SALE_COMPLETED.value,
        title="Purchase Complete!",
        message=f"You now own '{content_name}'",
        data={"role": "buyer", "amount": amount}
    ))


async def notify_bl_reward(user_id: str, amount: int, reason: str, source: str = None):
    """Notify user of BL coin reward"""
    notification = WebSocketNotification(
        type=NotificationType.BL_REWARD.value,
        title=f"+{amount} BL Coins!",
        message=reason,
        data={
            "amount": amount,
            "source": source,
        }
    )
    await ws_manager.send_to_user(user_id, notification)


async def notify_downline_bonus(user_id: str, amount: int, level: int, from_user_name: str, activity: str):
    """Notify user of downline activity bonus"""
    notification = WebSocketNotification(
        type=NotificationType.DOWNLINE_BONUS.value,
        title=f"+{amount} BL Bonus!",
        message=f"L{level} bonus from {from_user_name}'s {activity}",
        data={
            "amount": amount,
            "level": level,
            "activity": activity,
        }
    )
    await ws_manager.send_to_user(user_id, notification)


# ============== PUSH NOTIFICATION HELPERS ==============

async def send_push_notification(db, user_id: str, title: str, body: str, data: Dict = None):
    """Send push notification to user's registered devices"""
    try:
        # Get user's push tokens
        tokens = await db.push_tokens.find(
            {"user_id": user_id, "active": True}
        ).to_list(10)
        
        if not tokens:
            return
        
        import httpx
        
        messages = []
        for token_doc in tokens:
            expo_token = token_doc.get("expo_push_token")
            if expo_token:
                messages.append({
                    "to": expo_token,
                    "title": title,
                    "body": body,
                    "data": data or {},
                    "sound": "default",
                })
        
        if messages:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://exp.host/--/api/v2/push/send",
                    json=messages,
                    headers={"Content-Type": "application/json"},
                )
                logger.info(f"Push notification sent to {user_id}: {response.status_code}")
                
    except Exception as e:
        logger.error(f"Failed to send push notification: {e}")


async def notify_with_push(db, user_id: str, notification: WebSocketNotification):
    """Send both WebSocket and push notification"""
    # Send WebSocket (if online)
    ws_sent = await ws_manager.send_to_user(user_id, notification)
    
    # Send push notification (if offline or for important events)
    if not ws_sent or notification.type in [
        NotificationType.MATCH_FOUND.value,
        NotificationType.OFFER_RECEIVED.value,
        NotificationType.SALE_COMPLETED.value,
    ]:
        await send_push_notification(
            db,
            user_id,
            notification.title,
            notification.message,
            notification.data
        )
