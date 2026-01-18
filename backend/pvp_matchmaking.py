"""
Blendlink Photo Game PvP Matchmaking System
- Real-time PvP matchmaking
- Bot fallback when no players available
- WebSocket game sessions
"""

import uuid
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List, Set
from enum import Enum
from collections import defaultdict

logger = logging.getLogger(__name__)

# ============== CONSTANTS ==============
MATCHMAKING_TIMEOUT_SECONDS = 30  # Time to wait for opponent before bot
TURN_TIMEOUT_SECONDS = 30  # Time for each turn
BOT_DELAY_SECONDS = 1.5  # Delay for bot responses


class MatchStatus(str, Enum):
    SEARCHING = "searching"
    MATCHED = "matched"
    IN_GAME = "in_game"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class GameMode(str, Enum):
    PVP = "pvp"
    BOT = "bot"


# ============== MATCHMAKING QUEUE ==============
class MatchmakingQueue:
    """Manages the matchmaking queue for PvP games"""
    
    def __init__(self):
        self.waiting_players: Dict[str, Dict] = {}  # user_id -> player_data
        self.active_matches: Dict[str, Dict] = {}  # match_id -> match_data
        self.player_to_match: Dict[str, str] = {}  # user_id -> match_id
        self._lock = asyncio.Lock()
    
    async def join_queue(
        self,
        user_id: str,
        bet_amount: int = 0,
        photo_id: Optional[str] = None,
        use_bot_fallback: bool = True,
    ) -> Dict[str, Any]:
        """
        Join the matchmaking queue
        Returns immediately if a match is found, otherwise waits
        """
        async with self._lock:
            # Check if already in queue or match
            if user_id in self.waiting_players:
                return {
                    "status": "already_searching",
                    "message": "Already in matchmaking queue"
                }
            
            if user_id in self.player_to_match:
                return {
                    "status": "in_match",
                    "match_id": self.player_to_match[user_id]
                }
            
            # Try to find a match with similar bet
            for waiting_id, waiting_data in list(self.waiting_players.items()):
                if waiting_id == user_id:
                    continue
                
                # Match by bet amount (exact match for now)
                if waiting_data["bet_amount"] == bet_amount:
                    # Found a match!
                    match_id = f"match_{uuid.uuid4().hex[:12]}"
                    
                    match_data = {
                        "match_id": match_id,
                        "player1_id": waiting_id,
                        "player2_id": user_id,
                        "player1_photo_id": waiting_data.get("photo_id"),
                        "player2_photo_id": photo_id,
                        "bet_amount": bet_amount,
                        "status": MatchStatus.MATCHED.value,
                        "mode": GameMode.PVP.value,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                    
                    # Remove from waiting and add to active
                    del self.waiting_players[waiting_id]
                    self.active_matches[match_id] = match_data
                    self.player_to_match[waiting_id] = match_id
                    self.player_to_match[user_id] = match_id
                    
                    logger.info(f"Match found: {match_id} - {waiting_id} vs {user_id}")
                    
                    return {
                        "status": "matched",
                        "match_id": match_id,
                        "opponent_id": waiting_id,
                        "mode": "pvp",
                    }
            
            # No match found, add to queue
            self.waiting_players[user_id] = {
                "user_id": user_id,
                "bet_amount": bet_amount,
                "photo_id": photo_id,
                "use_bot_fallback": use_bot_fallback,
                "joined_at": datetime.now(timezone.utc).isoformat(),
            }
            
            logger.info(f"Player {user_id} joined matchmaking queue (bet: {bet_amount})")
            
            return {
                "status": "searching",
                "message": "Searching for opponent...",
                "timeout_seconds": MATCHMAKING_TIMEOUT_SECONDS,
            }
    
    async def leave_queue(self, user_id: str) -> Dict[str, Any]:
        """Leave the matchmaking queue"""
        async with self._lock:
            if user_id in self.waiting_players:
                del self.waiting_players[user_id]
                logger.info(f"Player {user_id} left matchmaking queue")
                return {"success": True, "status": "left_queue"}
            
            return {"success": False, "status": "not_in_queue"}
    
    async def check_timeout_and_create_bot_match(self, user_id: str) -> Optional[Dict]:
        """
        Check if player has timed out waiting and create bot match if needed
        Called after MATCHMAKING_TIMEOUT_SECONDS
        """
        async with self._lock:
            if user_id not in self.waiting_players:
                return None
            
            player_data = self.waiting_players[user_id]
            
            if not player_data.get("use_bot_fallback", True):
                return None
            
            # Create bot match
            match_id = f"match_{uuid.uuid4().hex[:12]}"
            
            match_data = {
                "match_id": match_id,
                "player1_id": user_id,
                "player2_id": "bot",
                "player1_photo_id": player_data.get("photo_id"),
                "player2_photo_id": None,  # Bot generates photo dynamically
                "bet_amount": player_data["bet_amount"],
                "status": MatchStatus.MATCHED.value,
                "mode": GameMode.BOT.value,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            
            del self.waiting_players[user_id]
            self.active_matches[match_id] = match_data
            self.player_to_match[user_id] = match_id
            
            logger.info(f"Bot match created: {match_id} for {user_id}")
            
            return {
                "status": "matched",
                "match_id": match_id,
                "opponent_id": "bot",
                "mode": "bot",
            }
    
    async def get_match(self, match_id: str) -> Optional[Dict]:
        """Get match data"""
        return self.active_matches.get(match_id)
    
    async def get_player_match(self, user_id: str) -> Optional[Dict]:
        """Get player's current match"""
        match_id = self.player_to_match.get(user_id)
        if match_id:
            return self.active_matches.get(match_id)
        return None
    
    async def end_match(self, match_id: str) -> None:
        """Clean up ended match"""
        async with self._lock:
            if match_id in self.active_matches:
                match = self.active_matches[match_id]
                
                # Remove player references
                if match["player1_id"] in self.player_to_match:
                    del self.player_to_match[match["player1_id"]]
                if match["player2_id"] != "bot" and match["player2_id"] in self.player_to_match:
                    del self.player_to_match[match["player2_id"]]
                
                del self.active_matches[match_id]
                
                logger.info(f"Match ended: {match_id}")
    
    def get_queue_status(self) -> Dict:
        """Get current queue status"""
        return {
            "players_waiting": len(self.waiting_players),
            "active_matches": len(self.active_matches),
        }


# Global matchmaking queue
matchmaking_queue = MatchmakingQueue()


# ============== PVP GAME SERVICE ==============
class PvPGameService:
    """Service for managing PvP photo game battles"""
    
    def __init__(self, db):
        self.db = db
        self.queue = matchmaking_queue
    
    async def find_match(
        self,
        user_id: str,
        bet_amount: int = 0,
        photo_id: Optional[str] = None,
        use_bot_fallback: bool = True,
    ) -> Dict[str, Any]:
        """Start matchmaking for a player"""
        from photo_game import PhotoGameService
        
        # Verify player has enough stamina and BL coins
        game_service = PhotoGameService(self.db)
        stats = await game_service.get_player_stats(user_id)
        
        if stats.get("stamina", 0) < 4:  # STAMINA_PER_BATTLE
            return {"success": False, "error": "Not enough stamina"}
        
        if bet_amount > 0:
            user = await self.db.users.find_one({"user_id": user_id}, {"bl_coins": 1})
            if not user or user.get("bl_coins", 0) < bet_amount:
                return {"success": False, "error": "Not enough BL coins for bet"}
            
            # Deduct bet amount when joining matchmaking (held in escrow)
            await self.db.users.update_one(
                {"user_id": user_id},
                {"$inc": {"bl_coins": -bet_amount}}
            )
        
        # Verify photo ownership and stamina if provided
        if photo_id:
            photo = await self.db.minted_photos.find_one({
                "mint_id": photo_id,
                "user_id": user_id,
            })
            if not photo:
                # Refund bet if photo check fails
                if bet_amount > 0:
                    await self.db.users.update_one(
                        {"user_id": user_id},
                        {"$inc": {"bl_coins": bet_amount}}
                    )
                return {"success": False, "error": "Photo not found or not owned"}
            
            # Check photo stamina
            photo_stamina = photo.get("stamina", 100)
            if photo_stamina <= 0:
                # Refund bet if photo has no stamina
                if bet_amount > 0:
                    await self.db.users.update_one(
                        {"user_id": user_id},
                        {"$inc": {"bl_coins": bet_amount}}
                    )
                return {"success": False, "error": "This photo has no stamina. Wait for it to recover."}
        
        # Join matchmaking queue
        result = await self.queue.join_queue(
            user_id=user_id,
            bet_amount=bet_amount,
            photo_id=photo_id,
            use_bot_fallback=use_bot_fallback,
        )
        
        return {"success": True, **result}
    
    async def check_match_status(self, user_id: str) -> Dict[str, Any]:
        """Check if a match has been found"""
        # Check if already matched
        match = await self.queue.get_player_match(user_id)
        if match:
            return {
                "status": "matched",
                "match_id": match["match_id"],
                "opponent_id": match["player2_id"] if match["player1_id"] == user_id else match["player1_id"],
                "mode": match["mode"],
            }
        
        # Check if still waiting
        if user_id in self.queue.waiting_players:
            player_data = self.queue.waiting_players[user_id]
            joined_at = datetime.fromisoformat(player_data["joined_at"].replace("Z", "+00:00"))
            elapsed = (datetime.now(timezone.utc) - joined_at).total_seconds()
            
            # Check timeout
            if elapsed >= MATCHMAKING_TIMEOUT_SECONDS:
                # Try to create bot match
                result = await self.queue.check_timeout_and_create_bot_match(user_id)
                if result:
                    return result
            
            return {
                "status": "searching",
                "elapsed_seconds": elapsed,
                "timeout_seconds": MATCHMAKING_TIMEOUT_SECONDS,
            }
        
        return {"status": "not_in_queue"}
    
    async def cancel_matchmaking(self, user_id: str) -> Dict[str, Any]:
        """Cancel matchmaking and refund bet"""
        # Get player data to refund bet
        player_data = self.queue.waiting_players.get(user_id)
        bet_amount = player_data.get("bet_amount", 0) if player_data else 0
        
        result = await self.queue.leave_queue(user_id)
        
        # Refund bet if was in queue
        if result.get("success") and bet_amount > 0:
            await self.db.users.update_one(
                {"user_id": user_id},
                {"$inc": {"bl_coins": bet_amount}}
            )
            result["bet_refunded"] = bet_amount
        
        return result
    
    async def start_match_game(self, match_id: str, user_id: str) -> Dict[str, Any]:
        """
        Start the actual game from a match
        Creates a game session in the photo_game system
        """
        match = await self.queue.get_match(match_id)
        if not match:
            return {"success": False, "error": "Match not found"}
        
        # Verify player is in this match
        if user_id != match["player1_id"] and user_id != match["player2_id"]:
            return {"success": False, "error": "Not your match"}
        
        # Import and use the existing game service
        from photo_game import PhotoGameService
        from game_routes import _game_service
        
        if not _game_service:
            game_service = PhotoGameService(self.db)
        else:
            game_service = _game_service
        
        # Determine which player is starting
        is_player1 = user_id == match["player1_id"]
        opponent_id = match["player2_id"] if is_player1 else match["player1_id"]
        photo_id = match["player1_photo_id"] if is_player1 else match["player2_photo_id"]
        
        # Start game session (bet was already deducted in find_match, so skip_bet_deduction=True)
        result = await game_service.start_game(
            player_id=user_id,
            opponent_id=opponent_id,
            bet_amount=match["bet_amount"],
            player_photo_id=photo_id,
            skip_bet_deduction=True,  # Bet was deducted when joining matchmaking
        )
        
        if result["success"]:
            # Update match with session ID
            match["game_session_id"] = result["session"]["session_id"]
            match["status"] = MatchStatus.IN_GAME.value
            
            result["match_id"] = match_id
            result["mode"] = match["mode"]
        
        return result
    
    async def get_queue_status(self) -> Dict:
        """Get matchmaking queue status"""
        return self.queue.get_queue_status()


# Initialize service
pvp_service: Optional[PvPGameService] = None


def init_pvp_service(db) -> PvPGameService:
    global pvp_service
    pvp_service = PvPGameService(db)
    return pvp_service
