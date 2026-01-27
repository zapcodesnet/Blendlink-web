"""
Real-time Auction Bidding WebSocket Handler
Handles phone tapping battles between players in real-time.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
from dataclasses import dataclass, field
from collections import defaultdict

from fastapi import WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

# Constants
MAX_TAPS_PER_SECOND = 10
AUCTION_COUNTDOWN_SECONDS = 10
AUCTION_ROUND_DURATION = 15
BASE_BIDS_TO_WIN = 200


@dataclass
class AuctionPlayer:
    """Player in an auction battle"""
    user_id: str
    websocket: WebSocket
    photo: Dict
    stats: Dict
    effective_value: int = 0
    bids_required: int = BASE_BIDS_TO_WIN
    current_bids: int = 0
    last_tap_time: float = 0
    taps_this_second: int = 0
    is_ready: bool = False
    is_connected: bool = True


@dataclass
class AuctionRoom:
    """An auction bidding room/session"""
    room_id: str
    game_session_id: str
    round_number: int
    player1: Optional[AuctionPlayer] = None
    player2: Optional[AuctionPlayer] = None
    state: str = "waiting"  # waiting, countdown, active, finished
    winner_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    countdown_task: Optional[asyncio.Task] = None
    game_task: Optional[asyncio.Task] = None
    is_bot_match: bool = False
    bot_difficulty: str = "medium"
    bet_amount: int = 0


class AuctionBiddingManager:
    """Manages real-time auction bidding WebSocket connections"""
    
    def __init__(self):
        self.rooms: Dict[str, AuctionRoom] = {}
        self.player_rooms: Dict[str, str] = {}  # user_id -> room_id
        self.active_connections: Dict[str, WebSocket] = {}  # user_id -> websocket
        self._lock = asyncio.Lock()
    
    async def create_room(
        self, 
        game_session_id: str, 
        round_number: int,
        player1_data: Dict,
        player2_data: Optional[Dict] = None,
        is_bot_match: bool = False,
        bot_difficulty: str = "medium",
        bet_amount: int = 0
    ) -> str:
        """Create a new auction room"""
        room_id = f"auction_{uuid.uuid4().hex[:8]}"
        
        room = AuctionRoom(
            room_id=room_id,
            game_session_id=game_session_id,
            round_number=round_number,
            is_bot_match=is_bot_match,
            bot_difficulty=bot_difficulty,
            bet_amount=bet_amount,
        )
        
        async with self._lock:
            self.rooms[room_id] = room
        
        logger.info(f"Created auction room {room_id} for game {game_session_id}, round {round_number}")
        return room_id
    
    async def join_room(
        self, 
        room_id: str, 
        user_id: str, 
        websocket: WebSocket,
        photo: Dict,
        stats: Dict,
        opponent_photo: Dict = None,
        opponent_stats: Dict = None
    ) -> bool:
        """Join a player to an auction room"""
        room = self.rooms.get(room_id)
        if not room:
            logger.error(f"Room {room_id} not found")
            return False
        
        # Calculate battle values
        from photo_game import calculate_photo_battle_value, calculate_auction_bids_required
        
        player_value_data = calculate_photo_battle_value(
            photo, 
            opponent_photo or {},
            stats,
            opponent_stats
        )
        
        effective_value = player_value_data["effective_value"]
        
        # Calculate bids required (will be adjusted when both players join)
        player = AuctionPlayer(
            user_id=user_id,
            websocket=websocket,
            photo=photo,
            stats=stats,
            effective_value=effective_value,
            bids_required=BASE_BIDS_TO_WIN,
            is_connected=True,
        )
        
        async with self._lock:
            if room.player1 is None:
                room.player1 = player
            elif room.player2 is None:
                room.player2 = player
                
                # Both players joined - calculate bid requirements
                bid_calc = calculate_auction_bids_required(
                    room.player1.effective_value,
                    room.player2.effective_value
                )
                room.player1.bids_required = bid_calc["player_bids"]
                room.player2.bids_required = bid_calc["opponent_bids"]
            else:
                logger.error(f"Room {room_id} is full")
                return False
            
            self.player_rooms[user_id] = room_id
            self.active_connections[user_id] = websocket
        
        logger.info(f"Player {user_id} joined room {room_id}")
        return True
    
    async def player_ready(self, room_id: str, user_id: str):
        """Mark a player as ready"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        if room.player1 and room.player1.user_id == user_id:
            room.player1.is_ready = True
        elif room.player2 and room.player2.user_id == user_id:
            room.player2.is_ready = True
        
        # Check if both players ready
        if room.player1 and room.player2:
            if room.player1.is_ready and room.player2.is_ready:
                await self._start_countdown(room_id)
        elif room.is_bot_match and room.player1 and room.player1.is_ready:
            # Bot is always ready
            await self._start_countdown(room_id)
    
    async def _start_countdown(self, room_id: str):
        """Start the countdown before auction begins"""
        room = self.rooms.get(room_id)
        if not room or room.state != "waiting":
            return
        
        room.state = "countdown"
        
        # Broadcast countdown start
        await self._broadcast_to_room(room_id, {
            "type": "countdown_start",
            "duration": AUCTION_COUNTDOWN_SECONDS,
            "player1": {
                "user_id": room.player1.user_id if room.player1 else None,
                "effective_value": room.player1.effective_value if room.player1 else 0,
                "bids_required": room.player1.bids_required if room.player1 else BASE_BIDS_TO_WIN,
                "photo": self._sanitize_photo(room.player1.photo) if room.player1 else None,
            },
            "player2": {
                "user_id": room.player2.user_id if room.player2 else "bot",
                "effective_value": room.player2.effective_value if room.player2 else 0,
                "bids_required": room.player2.bids_required if room.player2 else BASE_BIDS_TO_WIN,
                "photo": self._sanitize_photo(room.player2.photo) if room.player2 else None,
            } if not room.is_bot_match else {
                "user_id": "bot",
                "effective_value": 0,
                "bids_required": BASE_BIDS_TO_WIN,
                "is_bot": True,
                "difficulty": room.bot_difficulty,
            },
        })
        
        # Start countdown timer
        room.countdown_task = asyncio.create_task(self._countdown_timer(room_id))
    
    async def _countdown_timer(self, room_id: str):
        """Countdown timer before auction starts"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        for i in range(AUCTION_COUNTDOWN_SECONDS, 0, -1):
            await self._broadcast_to_room(room_id, {
                "type": "countdown_tick",
                "seconds_remaining": i,
            })
            await asyncio.sleep(1)
        
        # Start the auction
        await self._start_auction(room_id)
    
    async def _start_auction(self, room_id: str):
        """Start the actual auction bidding"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        room.state = "active"
        room.start_time = datetime.now(timezone.utc)
        
        await self._broadcast_to_room(room_id, {
            "type": "auction_start",
            "duration": AUCTION_ROUND_DURATION,
        })
        
        # Start game timer and bot if needed
        room.game_task = asyncio.create_task(self._auction_timer(room_id))
        
        if room.is_bot_match:
            asyncio.create_task(self._bot_tapping(room_id))
    
    async def _auction_timer(self, room_id: str):
        """Timer for auction duration"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        start_time = asyncio.get_event_loop().time()
        
        while room.state == "active":
            elapsed = asyncio.get_event_loop().time() - start_time
            remaining = AUCTION_ROUND_DURATION - elapsed
            
            if remaining <= 0:
                break
            
            # Broadcast time update every second
            if int(remaining) != int(remaining + 1):
                await self._broadcast_to_room(room_id, {
                    "type": "time_update",
                    "seconds_remaining": int(remaining),
                })
            
            await asyncio.sleep(0.1)
        
        # End auction
        await self._end_auction(room_id)
    
    async def _bot_tapping(self, room_id: str):
        """Simulate bot tapping"""
        room = self.rooms.get(room_id)
        if not room or not room.is_bot_match:
            return
        
        from photo_game import BOT_DIFFICULTY
        
        difficulty = BOT_DIFFICULTY.get(room.bot_difficulty, BOT_DIFFICULTY["medium"])
        tap_speed = difficulty["tap_speed"]
        
        # Create virtual bot player if not exists
        if not room.player2:
            from photo_game import generate_bot_photo, generate_bot_stats
            bot_photo = generate_bot_photo(room.bot_difficulty)
            bot_stats = generate_bot_stats(room.bot_difficulty)
            
            room.player2 = AuctionPlayer(
                user_id="bot",
                websocket=None,
                photo=bot_photo,
                stats=bot_stats,
                effective_value=bot_photo.get("dollar_value", 50_000_000),
                bids_required=BASE_BIDS_TO_WIN,
                is_connected=True,
            )
        
        # Add some randomness to bot behavior
        import random
        
        while room.state == "active":
            # Bot thinks for a moment (realism)
            await asyncio.sleep(random.uniform(0.1, 0.3))
            
            if room.state != "active":
                break
            
            # Bot taps
            taps = random.randint(max(1, tap_speed - 2), min(MAX_TAPS_PER_SECOND, tap_speed + 2))
            room.player2.current_bids += taps
            
            # Check if bot wins
            if room.player2.current_bids >= room.player2.bids_required:
                room.winner_id = "bot"
                await self._end_auction(room_id)
                break
            
            # Broadcast bot progress
            await self._broadcast_to_room(room_id, {
                "type": "bid_update",
                "player_id": "bot",
                "current_bids": room.player2.current_bids,
                "bids_required": room.player2.bids_required,
                "progress": min(100, int(room.player2.current_bids / room.player2.bids_required * 100)),
            })
            
            await asyncio.sleep(0.1)
    
    async def handle_tap(self, room_id: str, user_id: str, tap_count: int = 1):
        """Handle a tap from a player"""
        room = self.rooms.get(room_id)
        if not room or room.state != "active":
            return
        
        player = None
        if room.player1 and room.player1.user_id == user_id:
            player = room.player1
        elif room.player2 and room.player2.user_id == user_id:
            player = room.player2
        
        if not player:
            return
        
        # Anti-cheat: Check taps per second
        current_time = asyncio.get_event_loop().time()
        if current_time - player.last_tap_time >= 1.0:
            player.taps_this_second = 0
            player.last_tap_time = current_time
        
        # Limit taps
        allowed_taps = min(tap_count, MAX_TAPS_PER_SECOND - player.taps_this_second)
        if allowed_taps <= 0:
            return
        
        player.taps_this_second += allowed_taps
        player.current_bids += allowed_taps
        
        # Check if player wins
        if player.current_bids >= player.bids_required:
            room.winner_id = user_id
            await self._end_auction(room_id)
            return
        
        # Broadcast update
        await self._broadcast_to_room(room_id, {
            "type": "bid_update",
            "player_id": user_id,
            "current_bids": player.current_bids,
            "bids_required": player.bids_required,
            "progress": min(100, int(player.current_bids / player.bids_required * 100)),
            "dollar_meter": self._calculate_dollar_meter(player),
        })
    
    def _calculate_dollar_meter(self, player: AuctionPlayer) -> int:
        """Calculate the animated dollar meter value"""
        progress = player.current_bids / player.bids_required
        return int(player.effective_value * progress)
    
    async def _end_auction(self, room_id: str):
        """End the auction and determine winner"""
        room = self.rooms.get(room_id)
        if not room or room.state == "finished":
            return
        
        room.state = "finished"
        room.end_time = datetime.now(timezone.utc)
        
        # Determine winner if not already set
        if not room.winner_id:
            p1_progress = room.player1.current_bids / room.player1.bids_required if room.player1 else 0
            p2_progress = room.player2.current_bids / room.player2.bids_required if room.player2 else 0
            
            if p1_progress > p2_progress:
                room.winner_id = room.player1.user_id if room.player1 else None
            elif p2_progress > p1_progress:
                room.winner_id = room.player2.user_id if room.player2 else "bot"
            else:
                # Tie - player with higher effective value wins
                if room.player1 and room.player2:
                    if room.player1.effective_value >= room.player2.effective_value:
                        room.winner_id = room.player1.user_id
                    else:
                        room.winner_id = room.player2.user_id if room.player2.user_id != "bot" else "bot"
        
        # Broadcast result
        await self._broadcast_to_room(room_id, {
            "type": "auction_end",
            "winner_id": room.winner_id,
            "player1_final": {
                "user_id": room.player1.user_id if room.player1 else None,
                "bids": room.player1.current_bids if room.player1 else 0,
                "required": room.player1.bids_required if room.player1 else 0,
                "progress": int(room.player1.current_bids / room.player1.bids_required * 100) if room.player1 else 0,
            },
            "player2_final": {
                "user_id": room.player2.user_id if room.player2 else "bot",
                "bids": room.player2.current_bids if room.player2 else 0,
                "required": room.player2.bids_required if room.player2 else 0,
                "progress": int(room.player2.current_bids / room.player2.bids_required * 100) if room.player2 else 0,
            },
            "bet_amount": room.bet_amount,
        })
        
        # Cleanup
        await self._cleanup_room(room_id)
    
    async def _cleanup_room(self, room_id: str):
        """Clean up room after auction ends"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        # Cancel tasks
        if room.countdown_task:
            room.countdown_task.cancel()
        if room.game_task:
            room.game_task.cancel()
        
        # Remove player mappings
        if room.player1:
            self.player_rooms.pop(room.player1.user_id, None)
            self.active_connections.pop(room.player1.user_id, None)
        if room.player2 and room.player2.user_id != "bot":
            self.player_rooms.pop(room.player2.user_id, None)
            self.active_connections.pop(room.player2.user_id, None)
        
        # Keep room for 60 seconds for reconnection
        await asyncio.sleep(60)
        
        async with self._lock:
            self.rooms.pop(room_id, None)
    
    async def _broadcast_to_room(self, room_id: str, message: Dict):
        """Broadcast a message to all players in a room"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        msg_json = json.dumps(message)
        
        for player in [room.player1, room.player2]:
            if player and player.websocket and player.is_connected:
                try:
                    await player.websocket.send_text(msg_json)
                except Exception as e:
                    logger.error(f"Error sending to {player.user_id}: {e}")
                    player.is_connected = False
    
    def _sanitize_photo(self, photo: Dict) -> Dict:
        """Remove sensitive data from photo for broadcast"""
        if not photo:
            return None
        return {
            "mint_id": photo.get("mint_id"),
            "name": photo.get("name"),
            "photo_url": photo.get("photo_url"),
            "thumbnail_url": photo.get("thumbnail_url"),
            "dollar_value": photo.get("dollar_value"),
            "scenery_type": photo.get("scenery_type"),
            "light_type": photo.get("light_type"),
            "level": photo.get("level"),
            "overall_score": photo.get("overall_score"),
        }
    
    async def disconnect(self, user_id: str):
        """Handle player disconnect"""
        room_id = self.player_rooms.get(user_id)
        if room_id:
            room = self.rooms.get(room_id)
            if room:
                if room.player1 and room.player1.user_id == user_id:
                    room.player1.is_connected = False
                elif room.player2 and room.player2.user_id == user_id:
                    room.player2.is_connected = False
                
                # If auction is active and player disconnects, opponent wins
                if room.state == "active":
                    other_player = room.player2 if room.player1 and room.player1.user_id == user_id else room.player1
                    if other_player:
                        room.winner_id = other_player.user_id
                        await self._end_auction(room_id)
        
        self.active_connections.pop(user_id, None)
        self.player_rooms.pop(user_id, None)


# Global manager instance
auction_manager = AuctionBiddingManager()
