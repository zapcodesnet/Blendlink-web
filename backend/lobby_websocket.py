"""
Real-time Game Lobby WebSocket Handler
Handles instant ready status updates and game start synchronization.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Optional, Set
from dataclasses import dataclass

from fastapi import WebSocket

logger = logging.getLogger(__name__)


@dataclass
class LobbyConnection:
    """A player's connection to a game lobby"""
    user_id: str
    websocket: WebSocket
    is_connected: bool = True


class GameLobbyManager:
    """Manages real-time game lobby WebSocket connections"""
    
    def __init__(self):
        # game_id -> {user_id: LobbyConnection}
        self.lobbies: Dict[str, Dict[str, LobbyConnection]] = {}
        # user_id -> game_id (for quick lookup)
        self.user_lobbies: Dict[str, str] = {}
        self._lock = asyncio.Lock()
    
    async def connect(self, game_id: str, user_id: str, websocket: WebSocket) -> bool:
        """Connect a player to a game lobby"""
        async with self._lock:
            if game_id not in self.lobbies:
                self.lobbies[game_id] = {}
            
            connection = LobbyConnection(
                user_id=user_id,
                websocket=websocket,
                is_connected=True
            )
            
            self.lobbies[game_id][user_id] = connection
            self.user_lobbies[user_id] = game_id
        
        logger.info(f"Player {user_id} connected to lobby {game_id}")
        
        # Notify other players in the lobby
        await self.broadcast_to_lobby(game_id, {
            "type": "player_connected",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude_user=user_id)
        
        return True
    
    async def disconnect(self, user_id: str):
        """Disconnect a player from their lobby"""
        game_id = self.user_lobbies.get(user_id)
        if not game_id:
            return
        
        async with self._lock:
            if game_id in self.lobbies and user_id in self.lobbies[game_id]:
                del self.lobbies[game_id][user_id]
                
                # Clean up empty lobbies
                if not self.lobbies[game_id]:
                    del self.lobbies[game_id]
            
            self.user_lobbies.pop(user_id, None)
        
        logger.info(f"Player {user_id} disconnected from lobby {game_id}")
        
        # Notify remaining players
        await self.broadcast_to_lobby(game_id, {
            "type": "player_disconnected",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_to_lobby(
        self, 
        game_id: str, 
        message: Dict, 
        exclude_user: Optional[str] = None
    ):
        """Broadcast a message to all players in a lobby"""
        if game_id not in self.lobbies:
            return
        
        msg_json = json.dumps(message)
        
        for user_id, connection in list(self.lobbies.get(game_id, {}).items()):
            if exclude_user and user_id == exclude_user:
                continue
            
            if connection.is_connected and connection.websocket:
                try:
                    await connection.websocket.send_text(msg_json)
                except Exception as e:
                    logger.error(f"Error sending to {user_id}: {e}")
                    connection.is_connected = False
    
    async def send_to_user(self, user_id: str, message: Dict):
        """Send a message to a specific user"""
        game_id = self.user_lobbies.get(user_id)
        if not game_id or game_id not in self.lobbies:
            return False
        
        connection = self.lobbies[game_id].get(user_id)
        if not connection or not connection.is_connected:
            return False
        
        try:
            await connection.websocket.send_text(json.dumps(message))
            return True
        except Exception as e:
            logger.error(f"Error sending to {user_id}: {e}")
            connection.is_connected = False
            return False
    
    async def broadcast_player_joined(
        self, 
        game_id: str, 
        joiner_id: str, 
        joiner_username: str,
        joiner_photos: list
    ):
        """Broadcast when a new player joins the game"""
        await self.broadcast_to_lobby(game_id, {
            "type": "player_joined",
            "user_id": joiner_id,
            "username": joiner_username,
            "photos": joiner_photos,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, exclude_user=joiner_id)
    
    async def broadcast_ready_status(
        self, 
        game_id: str, 
        user_id: str, 
        username: str,
        is_ready: bool,
        is_creator: bool
    ):
        """Broadcast when a player changes their ready status"""
        await self.broadcast_to_lobby(game_id, {
            "type": "ready_status_changed",
            "user_id": user_id,
            "username": username,
            "is_ready": is_ready,
            "is_creator": is_creator,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_countdown_start(self, game_id: str, seconds: int = 10):
        """Broadcast when both players are ready and countdown starts"""
        await self.broadcast_to_lobby(game_id, {
            "type": "countdown_start",
            "seconds": seconds,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    async def broadcast_game_start(
        self, 
        game_id: str, 
        session_id: str,
        session_data: Dict,
        pvp_room_id: str = None  # Add pvp_room_id parameter
    ):
        """Broadcast when the game is starting"""
        message = {
            "type": "game_start",
            "session_id": session_id,
            "session": session_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        # Include pvp_room_id if provided
        if pvp_room_id:
            message["pvp_room_id"] = pvp_room_id
        await self.broadcast_to_lobby(game_id, message)
    
    async def broadcast_game_state(self, game_id: str, game_state: Dict):
        """Broadcast full game state update"""
        await self.broadcast_to_lobby(game_id, {
            "type": "game_state",
            "state": game_state,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    
    def get_lobby_connections(self, game_id: str) -> int:
        """Get number of connected players in a lobby"""
        if game_id not in self.lobbies:
            return 0
        return sum(1 for c in self.lobbies[game_id].values() if c.is_connected)
    
    def is_user_in_lobby(self, user_id: str, game_id: str) -> bool:
        """Check if a user is connected to a specific lobby"""
        return (
            user_id in self.user_lobbies and 
            self.user_lobbies[user_id] == game_id
        )


# Global manager instance
lobby_manager = GameLobbyManager()
