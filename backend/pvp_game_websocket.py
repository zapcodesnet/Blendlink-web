"""
Real-time PVP Game WebSocket Handler
Handles synchronized PVP gameplay with per-round ready mechanism.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Optional, List
from dataclasses import dataclass, field
import uuid

from fastapi import WebSocket

logger = logging.getLogger(__name__)

# Constants
COUNTDOWN_SECONDS = 10
READY_TIMEOUT_SECONDS = 30  # Auto-ready after 30s


@dataclass
class PlayerConnection:
    """A player's connection to a PVP game"""
    user_id: str
    username: str
    websocket: WebSocket
    photos: List[Dict]  # 5 locked-in photos
    selected_photo_id: Optional[str] = None  # Current round selection
    is_ready: bool = False
    is_connected: bool = True
    last_heartbeat: float = 0
    missed_pings: int = 0  # Track missed heartbeats


@dataclass
class SpectatorConnection:
    """A spectator's connection to watch a PVP game"""
    user_id: str
    username: str
    websocket: WebSocket
    is_connected: bool = True
    joined_at: float = 0


@dataclass 
class PVPGameRoom:
    """A PVP game room with round-by-round synchronization"""
    room_id: str
    game_id: str  # Open game ID
    session_id: Optional[str] = None
    
    player1: Optional[PlayerConnection] = None  # Creator
    player2: Optional[PlayerConnection] = None  # Joiner
    
    # Spectators
    spectators: Dict[str, SpectatorConnection] = field(default_factory=dict)
    
    # Game state
    current_round: int = 1
    max_rounds: int = 5
    player1_wins: int = 0
    player2_wins: int = 0
    
    # Round state
    round_phase: str = "waiting"  # waiting, selecting, ready, countdown, playing, result
    round_type: str = "auction"  # auction or rps
    
    # Countdown
    countdown_task: Optional[asyncio.Task] = None
    countdown_start_time: Optional[datetime] = None
    
    # Timeout task for auto-ready
    timeout_task: Optional[asyncio.Task] = None
    
    # Public visibility for spectators
    allow_spectators: bool = True
    started_at: Optional[datetime] = None


class PVPGameManager:
    """Manages real-time PVP game WebSocket connections with per-round sync"""
    
    def __init__(self):
        # room_id -> PVPGameRoom
        self.rooms: Dict[str, PVPGameRoom] = {}
        # user_id -> room_id
        self.user_rooms: Dict[str, str] = {}
        self._lock = asyncio.Lock()
        self._db = None
    
    def set_db(self, db):
        """Set database connection"""
        self._db = db
    
    async def create_room(self, game_id: str) -> str:
        """Create a new PVP game room"""
        room_id = f"pvp_{uuid.uuid4().hex[:12]}"
        
        room = PVPGameRoom(
            room_id=room_id,
            game_id=game_id,
        )
        
        async with self._lock:
            self.rooms[room_id] = room
        
        logger.info(f"Created PVP room {room_id} for game {game_id}")
        return room_id
    
    async def connect_player(
        self,
        room_id: str,
        user_id: str,
        username: str,
        websocket: WebSocket,
        photos: List[Dict],
        is_creator: bool,
        is_reconnect: bool = False
    ) -> bool:
        """Connect a player to a PVP game room
        
        If the player is already in the room (reconnecting), update their connection.
        """
        room = self.rooms.get(room_id)
        if not room:
            logger.error(f"Room {room_id} not found")
            return False
        
        async with self._lock:
            # Check if player is already in this room (reconnection case)
            existing_player = None
            if room.player1 and room.player1.user_id == user_id:
                existing_player = room.player1
                logger.info(f"Player {username} ({user_id}) reconnecting to room {room_id} as player1")
            elif room.player2 and room.player2.user_id == user_id:
                existing_player = room.player2
                logger.info(f"Player {username} ({user_id}) reconnecting to room {room_id} as player2")
            
            if existing_player:
                # Update existing connection
                existing_player.websocket = websocket
                existing_player.is_connected = True
                existing_player.last_heartbeat = asyncio.get_event_loop().time()
                existing_player.missed_pings = 0
                # Update photos if provided
                if photos:
                    existing_player.photos = photos
            else:
                # New connection
                connection = PlayerConnection(
                    user_id=user_id,
                    username=username,
                    websocket=websocket,
                    photos=photos,
                    is_connected=True,
                    last_heartbeat=asyncio.get_event_loop().time()
                )
                
                if is_creator:
                    room.player1 = connection
                else:
                    room.player2 = connection
                
                logger.info(f"Player {username} ({user_id}) connected to room {room_id}")
            
            self.user_rooms[user_id] = room_id
        
        # Notify other player
        await self._broadcast_player_connected(room_id, user_id, username)
        
        # Check if both players connected (for new connections)
        if room.player1 and room.player2 and not existing_player:
            await self._transition_to_selecting(room_id)
        
        # If reconnecting and game was already in progress, send current state
        if existing_player or is_reconnect:
            await self._send_game_state_to_player(room_id, user_id)
        
        return True
    
    async def _send_game_state_to_player(self, room_id: str, user_id: str):
        """Send current game state to a player (useful for reconnections)"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        # Find the player
        player = None
        is_player1 = False
        if room.player1 and room.player1.user_id == user_id:
            player = room.player1
            is_player1 = True
        elif room.player2 and room.player2.user_id == user_id:
            player = room.player2
        
        if not player or not player.websocket:
            return
        
        try:
            state_msg = {
                "type": "game_state",
                "room_id": room_id,
                "phase": room.phase,
                "current_round": room.current_round,
                "player1_wins": room.player1_wins,
                "player2_wins": room.player2_wins,
                "player1_connected": room.player1 is not None and room.player1.is_connected,
                "player2_connected": room.player2 is not None and room.player2.is_connected,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            await player.websocket.send_json(state_msg)
            logger.info(f"Sent game state to {user_id}: phase={room.phase}, round={room.current_round}")
        except Exception as e:
            logger.error(f"Failed to send game state to {user_id}: {e}")
    
    async def reconnect_player(
        self,
        room_id: str,
        user_id: str,
        websocket: WebSocket,
    ) -> bool:
        """Reconnect a disconnected player to their game room"""
        room = self.rooms.get(room_id)
        if not room:
            logger.error(f"Room {room_id} not found for reconnect")
            return False
        
        async with self._lock:
            player = None
            if room.player1 and room.player1.user_id == user_id:
                player = room.player1
            elif room.player2 and room.player2.user_id == user_id:
                player = room.player2
            
            if not player:
                logger.error(f"User {user_id} not found in room {room_id}")
                return False
            
            # Update connection
            player.websocket = websocket
            player.is_connected = True
            player.last_heartbeat = asyncio.get_event_loop().time()
            player.missed_pings = 0
            
            self.user_rooms[user_id] = room_id
        
        logger.info(f"Player {user_id} reconnected to room {room_id}")
        
        # Notify all players about reconnection
        await self._broadcast_to_room(room_id, {
            "type": "player_reconnected",
            "user_id": user_id,
            "username": player.username,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Send current game state to reconnected player
        await self._send_to_user(user_id, {
            "type": "reconnect_state",
            "room_id": room_id,
            "current_round": room.current_round,
            "round_phase": room.round_phase,
            "round_type": room.round_type,
            "player1_wins": room.player1_wins,
            "player2_wins": room.player2_wins,
            "player1": {
                "user_id": room.player1.user_id if room.player1 else None,
                "username": room.player1.username if room.player1 else None,
                "is_connected": room.player1.is_connected if room.player1 else False,
                "has_selected": bool(room.player1.selected_photo_id) if room.player1 else False,
                "is_ready": room.player1.is_ready if room.player1 else False,
                "selected_photo": self._sanitize_photo(
                    next((p for p in room.player1.photos if p.get("mint_id") == room.player1.selected_photo_id), None)
                ) if room.player1 and room.player1.selected_photo_id else None,
            },
            "player2": {
                "user_id": room.player2.user_id if room.player2 else None,
                "username": room.player2.username if room.player2 else None,
                "is_connected": room.player2.is_connected if room.player2 else False,
                "has_selected": bool(room.player2.selected_photo_id) if room.player2 else False,
                "is_ready": room.player2.is_ready if room.player2 else False,
                "selected_photo": self._sanitize_photo(
                    next((p for p in room.player2.photos if p.get("mint_id") == room.player2.selected_photo_id), None)
                ) if room.player2 and room.player2.selected_photo_id else None,
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return True
    
    async def disconnect_player(self, user_id: str):
        """Handle player disconnect"""
        room_id = self.user_rooms.get(user_id)
        if not room_id:
            return
        
        room = self.rooms.get(room_id)
        if not room:
            return
        
        async with self._lock:
            if room.player1 and room.player1.user_id == user_id:
                room.player1.is_connected = False
            elif room.player2 and room.player2.user_id == user_id:
                room.player2.is_connected = False
            
            self.user_rooms.pop(user_id, None)
        
        logger.info(f"Player {user_id} disconnected from room {room_id}")
        
        # Notify other player and handle disconnect
        try:
            await self._broadcast_to_room(room_id, {
                "type": "player_disconnected",
                "user_id": user_id,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
        except Exception as e:
            logger.error(f"Error broadcasting disconnect: {e}")
        
        # Start forfeit timer if game is in progress
        if room.round_phase in ["selecting", "ready", "countdown", "playing"]:
            try:
                asyncio.create_task(self._handle_disconnect_forfeit(room_id, user_id))
            except Exception as e:
                logger.error(f"Error creating forfeit task: {e}")
    
    async def _handle_disconnect_forfeit(self, room_id: str, disconnected_user_id: str):
        """Handle forfeit after disconnect timeout"""
        await asyncio.sleep(10)  # 10 second reconnect window
        
        room = self.rooms.get(room_id)
        if not room:
            return
        
        # Check if player reconnected
        if room.player1 and room.player1.user_id == disconnected_user_id and room.player1.is_connected:
            return
        if room.player2 and room.player2.user_id == disconnected_user_id and room.player2.is_connected:
            return
        
        # Forfeit - other player wins
        winner_id = None
        if room.player1 and room.player1.user_id != disconnected_user_id:
            winner_id = room.player1.user_id
        elif room.player2 and room.player2.user_id != disconnected_user_id:
            winner_id = room.player2.user_id
        
        if winner_id:
            await self._broadcast_to_room(room_id, {
                "type": "game_forfeit",
                "winner_id": winner_id,
                "reason": "opponent_disconnected",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
    
    async def select_photo(self, room_id: str, user_id: str, photo_id: str) -> bool:
        """Player selects a photo for the current round"""
        room = self.rooms.get(room_id)
        if not room or room.round_phase != "selecting":
            return False
        
        # Find player
        player = None
        if room.player1 and room.player1.user_id == user_id:
            player = room.player1
        elif room.player2 and room.player2.user_id == user_id:
            player = room.player2
        
        if not player:
            return False
        
        # Validate photo is in player's locked photos
        valid_photo = any(p.get("mint_id") == photo_id for p in player.photos)
        if not valid_photo:
            return False
        
        player.selected_photo_id = photo_id
        
        # Broadcast selection (don't reveal which photo, just that they selected)
        await self._broadcast_to_room(room_id, {
            "type": "player_selected_photo",
            "user_id": user_id,
            "has_selected": True,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude_user=user_id)
        
        # Send confirmation to the selecting player
        await self._send_to_user(user_id, {
            "type": "photo_selection_confirmed",
            "photo_id": photo_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Check if both players have selected
        if room.player1 and room.player2:
            if room.player1.selected_photo_id and room.player2.selected_photo_id:
                await self._transition_to_ready(room_id)
        
        return True
    
    async def mark_ready(self, room_id: str, user_id: str) -> bool:
        """Player marks ready for the round"""
        room = self.rooms.get(room_id)
        if not room or room.round_phase != "ready":
            return False
        
        # Find player
        if room.player1 and room.player1.user_id == user_id:
            room.player1.is_ready = True
        elif room.player2 and room.player2.user_id == user_id:
            room.player2.is_ready = True
        else:
            return False
        
        # Broadcast ready status
        await self._broadcast_to_room(room_id, {
            "type": "player_ready",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Check if both ready
        if room.player1 and room.player2:
            if room.player1.is_ready and room.player2.is_ready:
                await self._start_countdown(room_id)
        
        return True
    
    async def handle_tap(self, room_id: str, user_id: str, tap_count: int = 1) -> bool:
        """Handle player tap during auction round"""
        room = self.rooms.get(room_id)
        if not room or room.round_phase != "playing" or room.round_type != "auction":
            return False
        
        # Find player and opponent
        is_player1 = room.player1 and room.player1.user_id == user_id
        is_player2 = room.player2 and room.player2.user_id == user_id
        
        if not is_player1 and not is_player2:
            return False
        
        # Update tap count (stored on the connection object for now)
        if is_player1:
            if not hasattr(room.player1, 'tap_count'):
                room.player1.tap_count = 0
            room.player1.tap_count += tap_count
            total_taps = room.player1.tap_count
        else:
            if not hasattr(room.player2, 'tap_count'):
                room.player2.tap_count = 0
            room.player2.tap_count += tap_count
            total_taps = room.player2.tap_count
        
        # Broadcast tap update to opponent
        await self._broadcast_to_room(room_id, {
            "type": "tap_update",
            "user_id": user_id,
            "is_me": False,  # Will be overridden for the sending player
            "total_taps": total_taps,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude_user=user_id)
        
        # Send confirmation to the tapping player
        await self._send_to_user(user_id, {
            "type": "tap_update",
            "user_id": user_id,
            "is_me": True,
            "total_taps": total_taps,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        return True
    
    async def _transition_to_selecting(self, room_id: str):
        """Transition to photo selection phase"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        room.round_phase = "selecting"
        
        # Determine round type
        round_types = ["auction", "rps", "auction", "rps", "auction"]
        room.round_type = round_types[room.current_round - 1] if room.current_round <= 5 else "auction"
        
        # Reset player states for new round
        if room.player1:
            room.player1.selected_photo_id = None
            room.player1.is_ready = False
        if room.player2:
            room.player2.selected_photo_id = None
            room.player2.is_ready = False
        
        # Broadcast phase change with full game state
        await self._broadcast_game_state(room_id, {
            "type": "round_selecting",
            "round": room.current_round,
            "round_type": room.round_type,
            "player1_score": room.player1_wins,
            "player2_score": room.player2_wins,
        })
        
        # Start timeout for auto-selection
        if room.timeout_task:
            room.timeout_task.cancel()
        room.timeout_task = asyncio.create_task(self._selection_timeout(room_id))
    
    async def _selection_timeout(self, room_id: str):
        """Handle selection timeout - broadcast countdown and auto-select"""
        import random
        
        # Broadcast countdown every second for 30 seconds
        for remaining in range(READY_TIMEOUT_SECONDS, 0, -1):
            room = self.rooms.get(room_id)
            if not room or room.round_phase != "selecting":
                return
            
            # Check if both have selected (end timeout early)
            if room.player1 and room.player2:
                if room.player1.selected_photo_id and room.player2.selected_photo_id:
                    await self._transition_to_ready(room_id)
                    return
            
            # Broadcast countdown tick
            await self._broadcast_to_room(room_id, {
                "type": "selection_timeout_tick",
                "seconds_remaining": remaining,
                "player1_selected": bool(room.player1.selected_photo_id) if room.player1 else False,
                "player2_selected": bool(room.player2.selected_photo_id) if room.player2 else False,
            })
            
            await asyncio.sleep(1)
        
        # Timeout reached - auto-select for players who haven't
        room = self.rooms.get(room_id)
        if not room or room.round_phase != "selecting":
            return
        
        # Auto-select for players who haven't selected
        if room.player1 and not room.player1.selected_photo_id:
            available = [p for p in room.player1.photos if p.get("current_stamina", 1) >= 1]
            if available:
                room.player1.selected_photo_id = random.choice(available).get("mint_id")
                await self._broadcast_to_room(room_id, {
                    "type": "auto_selected",
                    "user_id": room.player1.user_id,
                    "reason": "timeout",
                })
        
        if room.player2 and not room.player2.selected_photo_id:
            available = [p for p in room.player2.photos if p.get("current_stamina", 1) >= 1]
            if available:
                room.player2.selected_photo_id = random.choice(available).get("mint_id")
                await self._broadcast_to_room(room_id, {
                    "type": "auto_selected",
                    "user_id": room.player2.user_id,
                    "reason": "timeout",
                })
        
        # Transition to ready phase if both have selections now
        if room.player1 and room.player2:
            if room.player1.selected_photo_id and room.player2.selected_photo_id:
                await self._transition_to_ready(room_id)
    
    async def _transition_to_ready(self, room_id: str):
        """Transition to ready phase after both selected"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        room.round_phase = "ready"
        
        # Cancel selection timeout
        if room.timeout_task:
            room.timeout_task.cancel()
            room.timeout_task = None
        
        # Get selected photos for display
        player1_photo = None
        player2_photo = None
        
        if room.player1:
            player1_photo = next(
                (p for p in room.player1.photos if p.get("mint_id") == room.player1.selected_photo_id),
                None
            )
        if room.player2:
            player2_photo = next(
                (p for p in room.player2.photos if p.get("mint_id") == room.player2.selected_photo_id),
                None
            )
        
        # Broadcast ready phase with BOTH photos revealed
        await self._broadcast_to_room(room_id, {
            "type": "round_ready",
            "round": room.current_round,
            "round_type": room.round_type,
            "player1_photo": self._sanitize_photo(player1_photo),
            "player2_photo": self._sanitize_photo(player2_photo),
            "player1_ready": room.player1.is_ready if room.player1 else False,
            "player2_ready": room.player2.is_ready if room.player2 else False,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Start timeout for auto-ready
        room.timeout_task = asyncio.create_task(self._ready_timeout(room_id))
    
    async def _ready_timeout(self, room_id: str):
        """Handle ready timeout - auto-ready players"""
        await asyncio.sleep(READY_TIMEOUT_SECONDS)
        
        room = self.rooms.get(room_id)
        if not room or room.round_phase != "ready":
            return
        
        # Auto-ready players who haven't clicked ready
        if room.player1 and not room.player1.is_ready:
            room.player1.is_ready = True
            await self._broadcast_to_room(room_id, {
                "type": "auto_ready",
                "user_id": room.player1.user_id,
                "reason": "timeout",
            })
        
        if room.player2 and not room.player2.is_ready:
            room.player2.is_ready = True
            await self._broadcast_to_room(room_id, {
                "type": "auto_ready",
                "user_id": room.player2.user_id,
                "reason": "timeout",
            })
        
        # Start countdown
        await self._start_countdown(room_id)
    
    async def _start_countdown(self, room_id: str):
        """Start the synchronized countdown"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        room.round_phase = "countdown"
        room.countdown_start_time = datetime.now(timezone.utc)
        
        # Cancel any timeout task
        if room.timeout_task:
            room.timeout_task.cancel()
            room.timeout_task = None
        
        # Broadcast countdown start with server timestamp
        await self._broadcast_to_room(room_id, {
            "type": "countdown_start",
            "round": room.current_round,
            "seconds": COUNTDOWN_SECONDS,
            "server_timestamp": room.countdown_start_time.isoformat(),
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Start countdown task
        room.countdown_task = asyncio.create_task(self._countdown_loop(room_id))
    
    async def _countdown_loop(self, room_id: str):
        """Server-authoritative countdown with millisecond precision broadcasts"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        for remaining in range(COUNTDOWN_SECONDS, 0, -1):
            # Broadcast every second with exact server time
            await self._broadcast_to_room(room_id, {
                "type": "countdown_tick",
                "seconds_remaining": remaining,
                "server_timestamp": datetime.now(timezone.utc).isoformat(),
            })
            await asyncio.sleep(1)
        
        # Countdown complete - start round
        await self._start_round(room_id)
    
    async def _start_round(self, room_id: str):
        """Start the actual round gameplay"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        room.round_phase = "playing"
        
        # Get full photo data for both players
        player1_photo = None
        player2_photo = None
        
        if room.player1:
            player1_photo = next(
                (p for p in room.player1.photos if p.get("mint_id") == room.player1.selected_photo_id),
                None
            )
        if room.player2:
            player2_photo = next(
                (p for p in room.player2.photos if p.get("mint_id") == room.player2.selected_photo_id),
                None
            )
        
        # Broadcast round start with FULL photo data
        await self._broadcast_to_room(room_id, {
            "type": "round_start",
            "round": room.current_round,
            "round_type": room.round_type,
            "player1": {
                "user_id": room.player1.user_id if room.player1 else None,
                "username": room.player1.username if room.player1 else None,
                "photo": self._sanitize_photo(player1_photo),
            },
            "player2": {
                "user_id": room.player2.user_id if room.player2 else None,
                "username": room.player2.username if room.player2 else None,
                "photo": self._sanitize_photo(player2_photo),
            },
            "server_timestamp": datetime.now(timezone.utc).isoformat(),
        })
    
    async def submit_round_result(
        self,
        room_id: str,
        winner_user_id: str,
        player1_score: int,
        player2_score: int,
        round_data: Dict
    ):
        """Submit round result from gameplay component"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        room.round_phase = "result"
        
        # Update scores
        if room.player1 and winner_user_id == room.player1.user_id:
            room.player1_wins += 1
        elif room.player2 and winner_user_id == room.player2.user_id:
            room.player2_wins += 1
        
        # Broadcast result
        await self._broadcast_to_room(room_id, {
            "type": "round_result",
            "round": room.current_round,
            "winner_user_id": winner_user_id,
            "player1_wins": room.player1_wins,
            "player2_wins": room.player2_wins,
            "round_data": round_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Check for game end (first to 3 wins)
        if room.player1_wins >= 3 or room.player2_wins >= 3:
            await self._end_game(room_id)
        else:
            # Schedule transition to next round
            await asyncio.sleep(3)  # Brief result display
            room.current_round += 1
            await self._transition_to_selecting(room_id)
    
    async def _end_game(self, room_id: str):
        """End the game and declare winner"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        winner_id = None
        if room.player1_wins > room.player2_wins:
            winner_id = room.player1.user_id if room.player1 else None
        else:
            winner_id = room.player2.user_id if room.player2 else None
        
        await self._broadcast_to_room(room_id, {
            "type": "game_end",
            "winner_user_id": winner_id,
            "player1_wins": room.player1_wins,
            "player2_wins": room.player2_wins,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        # Cleanup room after delay
        await asyncio.sleep(60)
        await self._cleanup_room(room_id)
    
    async def _cleanup_room(self, room_id: str):
        """Clean up room resources"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        # Cancel tasks
        if room.countdown_task:
            room.countdown_task.cancel()
        if room.timeout_task:
            room.timeout_task.cancel()
        
        # Remove player mappings
        async with self._lock:
            if room.player1:
                self.user_rooms.pop(room.player1.user_id, None)
            if room.player2:
                self.user_rooms.pop(room.player2.user_id, None)
            self.rooms.pop(room_id, None)
        
        logger.info(f"Cleaned up room {room_id}")
    
    async def _broadcast_player_connected(self, room_id: str, user_id: str, username: str):
        """Broadcast when a player connects"""
        await self._broadcast_to_room(room_id, {
            "type": "player_connected",
            "user_id": user_id,
            "username": username,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude_user=user_id)
    
    async def _broadcast_game_state(self, room_id: str, additional_data: Dict = None):
        """Broadcast full game state"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        state = {
            "type": "game_state",
            "room_id": room_id,
            "current_round": room.current_round,
            "round_phase": room.round_phase,
            "round_type": room.round_type,
            "player1_wins": room.player1_wins,
            "player2_wins": room.player2_wins,
            "player1": {
                "user_id": room.player1.user_id if room.player1 else None,
                "username": room.player1.username if room.player1 else None,
                "is_connected": room.player1.is_connected if room.player1 else False,
                "has_selected": bool(room.player1.selected_photo_id) if room.player1 else False,
                "is_ready": room.player1.is_ready if room.player1 else False,
            },
            "player2": {
                "user_id": room.player2.user_id if room.player2 else None,
                "username": room.player2.username if room.player2 else None,
                "is_connected": room.player2.is_connected if room.player2 else False,
                "has_selected": bool(room.player2.selected_photo_id) if room.player2 else False,
                "is_ready": room.player2.is_ready if room.player2 else False,
            },
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if additional_data:
            state.update(additional_data)
        
        await self._broadcast_to_room(room_id, state)
    
    async def _broadcast_to_room(
        self,
        room_id: str,
        message: Dict,
        exclude_user: Optional[str] = None
    ):
        """Broadcast a message to all players in a room and spectators"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        msg_json = json.dumps(message)
        
        # Send to players
        for player in [room.player1, room.player2]:
            if not player or not player.is_connected or not player.websocket:
                continue
            if exclude_user and player.user_id == exclude_user:
                continue
            
            try:
                await player.websocket.send_text(msg_json)
            except Exception as e:
                logger.error(f"Error sending to {player.user_id}: {e}")
                player.is_connected = False
        
        # Also send to spectators (they see the same game events)
        for spectator in list(room.spectators.values()):
            if not spectator.is_connected or not spectator.websocket:
                continue
            try:
                await spectator.websocket.send_text(msg_json)
            except Exception as e:
                logger.error(f"Error sending to spectator {spectator.user_id}: {e}")
                spectator.is_connected = False
    
    async def _send_to_user(self, user_id: str, message: Dict):
        """Send a message to a specific user"""
        room_id = self.user_rooms.get(user_id)
        if not room_id:
            return False
        
        room = self.rooms.get(room_id)
        if not room:
            return False
        
        player = None
        if room.player1 and room.player1.user_id == user_id:
            player = room.player1
        elif room.player2 and room.player2.user_id == user_id:
            player = room.player2
        
        if not player or not player.is_connected or not player.websocket:
            return False
        
        try:
            await player.websocket.send_text(json.dumps(message))
            return True
        except Exception as e:
            logger.error(f"Error sending to {user_id}: {e}")
            player.is_connected = False
            return False
    
    def _sanitize_photo(self, photo: Optional[Dict]) -> Optional[Dict]:
        """Remove sensitive data from photo for broadcast"""
        if not photo:
            return None
        return {
            "mint_id": photo.get("mint_id"),
            "name": photo.get("name"),
            "image_url": photo.get("image_url"),
            "dollar_value": photo.get("dollar_value"),
            "scenery_type": photo.get("scenery_type"),
            "level": photo.get("level", 1),
            "win_streak": photo.get("win_streak", 0),
            "lose_streak": photo.get("lose_streak", 0),
            "current_stamina": photo.get("current_stamina"),
        }
    
    def get_room(self, room_id: str) -> Optional[PVPGameRoom]:
        """Get a room by ID"""
        return self.rooms.get(room_id)
    
    def get_room_by_game_id(self, game_id: str) -> Optional[PVPGameRoom]:
        """Get a room by game_id"""
        for room in self.rooms.values():
            if room.game_id == game_id:
                return room
        return None
    
    # ==================== SPECTATOR METHODS ====================
    
    async def connect_spectator(
        self,
        room_id: str,
        user_id: str,
        username: str,
        websocket: WebSocket
    ) -> bool:
        """Connect a spectator to watch a PVP game"""
        room = self.rooms.get(room_id)
        if not room:
            logger.warning(f"Spectator tried to join non-existent room {room_id}")
            return False
        
        if not room.allow_spectators:
            logger.warning(f"Room {room_id} does not allow spectators")
            return False
        
        # Don't allow players to spectate their own game
        if room.player1 and room.player1.user_id == user_id:
            return False
        if room.player2 and room.player2.user_id == user_id:
            return False
        
        import time
        spectator = SpectatorConnection(
            user_id=user_id,
            username=username,
            websocket=websocket,
            is_connected=True,
            joined_at=time.time()
        )
        
        async with self._lock:
            room.spectators[user_id] = spectator
        
        logger.info(f"Spectator {username} ({user_id}) joined room {room_id}")
        
        # Send current game state to spectator
        await self._send_spectator_state(room_id, user_id)
        
        # Notify others about new spectator count
        await self._broadcast_spectator_count(room_id)
        
        return True
    
    async def disconnect_spectator(self, user_id: str, room_id: str):
        """Disconnect a spectator from a room"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        async with self._lock:
            if user_id in room.spectators:
                room.spectators[user_id].is_connected = False
                del room.spectators[user_id]
        
        logger.info(f"Spectator {user_id} left room {room_id}")
        await self._broadcast_spectator_count(room_id)
    
    async def _send_spectator_state(self, room_id: str, spectator_id: str):
        """Send current game state to a spectator"""
        room = self.rooms.get(room_id)
        if not room or spectator_id not in room.spectators:
            return
        
        spectator = room.spectators[spectator_id]
        
        # Build spectator-safe game state (hide sensitive info)
        state = {
            "type": "spectator_state",
            "room_id": room_id,
            "current_round": room.current_round,
            "max_rounds": room.max_rounds,
            "round_phase": room.round_phase,
            "round_type": room.round_type,
            "player1_wins": room.player1_wins,
            "player2_wins": room.player2_wins,
            "spectator_count": len(room.spectators),
            "player1": {
                "username": room.player1.username if room.player1 else None,
                "is_connected": room.player1.is_connected if room.player1 else False,
                "has_selected": bool(room.player1.selected_photo_id) if room.player1 else False,
                "is_ready": room.player1.is_ready if room.player1 else False,
                # Only show selected photo if round is in playing/result phase
                "selected_photo": self._sanitize_photo_for_spectator(
                    next((p for p in room.player1.photos if p.get("mint_id") == room.player1.selected_photo_id), None)
                ) if room.player1 and room.player1.selected_photo_id and room.round_phase in ["playing", "result", "ready", "countdown"] else None,
            } if room.player1 else None,
            "player2": {
                "username": room.player2.username if room.player2 else None,
                "is_connected": room.player2.is_connected if room.player2 else False,
                "has_selected": bool(room.player2.selected_photo_id) if room.player2 else False,
                "is_ready": room.player2.is_ready if room.player2 else False,
                "selected_photo": self._sanitize_photo_for_spectator(
                    next((p for p in room.player2.photos if p.get("mint_id") == room.player2.selected_photo_id), None)
                ) if room.player2 and room.player2.selected_photo_id and room.round_phase in ["playing", "result", "ready", "countdown"] else None,
            } if room.player2 else None,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        try:
            await spectator.websocket.send_json(state)
        except Exception as e:
            logger.error(f"Error sending state to spectator {spectator_id}: {e}")
    
    def _sanitize_photo_for_spectator(self, photo: Optional[Dict]) -> Optional[Dict]:
        """Sanitize photo data for spectator view (limited info)"""
        if not photo:
            return None
        return {
            "mint_id": photo.get("mint_id"),
            "image_url": photo.get("image_url"),
            "title": photo.get("title"),
            "dollar_value": photo.get("dollar_value"),
            "level": photo.get("level"),
            "rarity": photo.get("rarity"),
        }
    
    async def _broadcast_spectator_count(self, room_id: str):
        """Broadcast updated spectator count to players and spectators"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        count = len([s for s in room.spectators.values() if s.is_connected])
        message = {
            "type": "spectator_count",
            "count": count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Send to players
        await self._broadcast_to_room(room_id, message)
        
        # Send to all spectators
        await self._broadcast_to_spectators(room_id, message)
    
    async def _broadcast_to_spectators(self, room_id: str, message: Dict):
        """Broadcast a message to all spectators in a room"""
        room = self.rooms.get(room_id)
        if not room:
            return
        
        msg_json = json.dumps(message)
        
        for spectator in list(room.spectators.values()):
            if spectator.is_connected:
                try:
                    await spectator.websocket.send_text(msg_json)
                except Exception as e:
                    logger.error(f"Error sending to spectator {spectator.user_id}: {e}")
                    spectator.is_connected = False
    
    def get_live_battles(self) -> List[Dict]:
        """Get list of ongoing battles available for spectating"""
        live_battles = []
        
        for room in self.rooms.values():
            # Only show rooms that are actively being played
            if not room.player1 or not room.player2:
                continue
            if not room.player1.is_connected or not room.player2.is_connected:
                continue
            if not room.allow_spectators:
                continue
            if room.round_phase in ["waiting"]:
                continue
            
            live_battles.append({
                "room_id": room.room_id,
                "game_id": room.game_id,
                "player1": {
                    "username": room.player1.username,
                    "wins": room.player1_wins
                },
                "player2": {
                    "username": room.player2.username,
                    "wins": room.player2_wins
                },
                "current_round": room.current_round,
                "max_rounds": room.max_rounds,
                "round_phase": room.round_phase,
                "spectator_count": len([s for s in room.spectators.values() if s.is_connected]),
                "started_at": room.started_at.isoformat() if room.started_at else None
            })
        
        return live_battles


# Global manager instance
pvp_game_manager = PVPGameManager()
