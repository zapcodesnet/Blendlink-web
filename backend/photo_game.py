"""
Blendlink Photo Game System
- Rock-Paper-Scissors mini-game
- Photo auction battles
- Stamina system
- XP/Level progression
- Leaderboards
- Bot opponents
"""

import os
import uuid
import random
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum

logger = logging.getLogger(__name__)

# ============== CONSTANTS ==============
MAX_STAMINA = 100
BATTLES_PER_FULL_STAMINA = 24
STAMINA_PER_BATTLE = MAX_STAMINA // BATTLES_PER_FULL_STAMINA  # ~4.16
STAMINA_REGEN_PER_HOUR = MAX_STAMINA / 24  # Full regen in 24 hours = 1 battle per hour
DEFEAT_STAMINA_PENALTY = 1.25  # 25% more stamina loss on defeat

# Stamina percentage per battle (for display)
STAMINA_PERCENT_PER_BATTLE = 100 / BATTLES_PER_FULL_STAMINA  # ~4.16%

# Win streak multipliers
WIN_STREAK_MULTIPLIERS = {
    3: 1.25,
    4: 1.50,
    5: 1.75,
    6: 2.00,  # 6+ wins
}

# Strength/Weakness multiplier
STRENGTH_MULTIPLIER = 1.25  # +25% value for strong matchups


class RPSChoice(str, Enum):
    ROCK = "rock"
    PAPER = "paper"
    SCISSORS = "scissors"


class GamePhase(str, Enum):
    RPS_GAME = "rps"
    PHOTO_BATTLE = "photo_battle"
    TIEBREAKER = "tiebreaker"
    COMPLETED = "completed"


# ============== MODELS ==============
class PlayerStats(BaseModel):
    """Player's game statistics"""
    user_id: str
    stamina: float = MAX_STAMINA
    last_stamina_update: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Win streaks
    current_win_streak: int = 0
    best_win_streak: int = 0
    
    # Battle stats
    total_battles: int = 0
    battles_won: int = 0
    battles_lost: int = 0
    
    # Winnings
    total_bl_won: int = 0
    total_bl_lost: int = 0
    
    # Time-based stats
    wins_today: int = 0
    wins_this_week: int = 0
    wins_this_month: int = 0
    wins_this_year: int = 0
    last_win_reset: str = ""


class GameSession(BaseModel):
    """Active game session"""
    session_id: str = Field(default_factory=lambda: f"game_{uuid.uuid4().hex[:12]}")
    player1_id: str
    player2_id: str  # "bot" for bot games
    
    bet_amount: int = 0
    
    # Photo selections
    player1_photo_id: Optional[str] = None
    player2_photo_id: Optional[str] = None
    
    # Game state
    phase: GamePhase = GamePhase.RPS_GAME
    rps_game_number: int = 1  # 1 = first RPS, 2 = photo battle, 3 = tiebreaker
    
    # RPS state
    player1_rps_wins: int = 0
    player2_rps_wins: int = 0
    current_rps_round: int = 1
    player1_rps_choice: Optional[str] = None
    player2_rps_choice: Optional[str] = None
    rps_rounds: List[Dict] = Field(default_factory=list)
    
    # Photo battle result
    photo_battle_winner: Optional[str] = None
    
    # Overall result
    winner_id: Optional[str] = None
    winnings_distributed: bool = False
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None


# ============== GAME LOGIC ==============
def determine_rps_winner(choice1: str, choice2: str) -> int:
    """
    Determine RPS winner
    Returns: 1 if player1 wins, 2 if player2 wins, 0 if tie
    """
    if choice1 == choice2:
        return 0
    
    wins = {
        "rock": "scissors",
        "paper": "rock",
        "scissors": "paper",
    }
    
    if wins.get(choice1) == choice2:
        return 1
    return 2


def calculate_photo_battle_value(
    photo: Dict,
    opponent_photo: Dict,
    player_stats: Optional[Dict] = None
) -> float:
    """
    Calculate effective dollar value for photo battle
    Applies strength/weakness multipliers and win streak bonuses
    """
    base_value = photo.get("dollar_value", 1_000_000)
    
    # Apply strength/weakness multiplier
    photo_type = photo.get("scenery_type", "natural")
    opponent_type = opponent_photo.get("scenery_type", "natural")
    
    if photo.get("strength_vs") == opponent_type:
        base_value = int(base_value * STRENGTH_MULTIPLIER)
    elif photo.get("weakness_vs") == opponent_type:
        base_value = int(base_value / STRENGTH_MULTIPLIER)
    
    # Apply win streak multiplier
    if player_stats:
        streak = player_stats.get("current_win_streak", 0)
        if streak >= 6:
            base_value = int(base_value * WIN_STREAK_MULTIPLIERS[6])
        elif streak >= 5:
            base_value = int(base_value * WIN_STREAK_MULTIPLIERS[5])
        elif streak >= 4:
            base_value = int(base_value * WIN_STREAK_MULTIPLIERS[4])
        elif streak >= 3:
            base_value = int(base_value * WIN_STREAK_MULTIPLIERS[3])
    
    return base_value


def generate_bot_photo() -> Dict:
    """Generate a random bot photo for battles"""
    import random
    
    scenery_types = ["natural", "water", "manmade"]
    scenery = random.choice(scenery_types)
    
    from minting_system import SCENERY_TYPES, RATING_CRITERIA
    scenery_info = SCENERY_TYPES[scenery]
    
    # Generate random ratings (bot has moderate stats)
    ratings = {criterion: random.randint(40, 75) for criterion in RATING_CRITERIA}
    avg_rating = sum(ratings.values()) / len(ratings)
    
    # Calculate dollar value (bot gets moderate values)
    dollar_value = int(1_000_000 * (2 ** (avg_rating / 10)))
    dollar_value = min(dollar_value, 500_000_000)  # Cap at $500M for bots
    
    return {
        "mint_id": f"bot_photo_{uuid.uuid4().hex[:8]}",
        "name": f"Bot Photo #{random.randint(1000, 9999)}",
        "user_id": "bot",
        "scenery_type": scenery,
        "strength_vs": scenery_info["strong_vs"],
        "weakness_vs": scenery_info["weak_vs"],
        "ratings": ratings,
        "overall_score": avg_rating,
        "dollar_value": dollar_value,
        "has_face": random.random() > 0.7,
        "power": random.randint(80, 120),
        "level": random.randint(1, 30),
    }


# ============== GAME SERVICE ==============
class PhotoGameService:
    """Service for managing photo game battles"""
    
    def __init__(self, db):
        self.db = db
    
    async def get_player_stats(self, user_id: str) -> Dict:
        """Get or create player stats"""
        stats = await self.db.player_stats.find_one({"user_id": user_id}, {"_id": 0})
        
        if not stats:
            # Create new stats
            new_stats = PlayerStats(user_id=user_id)
            stats_dict = new_stats.model_dump()
            stats_dict["last_stamina_update"] = stats_dict["last_stamina_update"].isoformat()
            await self.db.player_stats.insert_one(stats_dict)
            # Re-fetch without _id to avoid ObjectId issues
            stats = await self.db.player_stats.find_one({"user_id": user_id}, {"_id": 0})
        else:
            # Update stamina based on time passed
            stats = await self._regenerate_stamina(stats)
        
        # Ensure no ObjectId in response
        if stats and "_id" in stats:
            del stats["_id"]
        
        return stats
    
    async def _regenerate_stamina(self, stats: Dict) -> Dict:
        """Regenerate stamina based on time passed"""
        last_update = stats.get("last_stamina_update")
        if isinstance(last_update, str):
            last_update = datetime.fromisoformat(last_update.replace("Z", "+00:00"))
        
        now = datetime.now(timezone.utc)
        hours_passed = (now - last_update).total_seconds() / 3600
        
        if hours_passed > 0 and stats.get("stamina", MAX_STAMINA) < MAX_STAMINA:
            stamina_gained = hours_passed * STAMINA_REGEN_PER_HOUR
            new_stamina = min(MAX_STAMINA, stats.get("stamina", 0) + stamina_gained)
            
            await self.db.player_stats.update_one(
                {"user_id": stats["user_id"]},
                {
                    "$set": {
                        "stamina": new_stamina,
                        "last_stamina_update": now.isoformat(),
                    }
                }
            )
            stats["stamina"] = new_stamina
            stats["last_stamina_update"] = now.isoformat()
        
        return stats
    
    async def start_game(
        self,
        player_id: str,
        opponent_id: str = "bot",
        bet_amount: int = 0,
        player_photo_id: Optional[str] = None,
        skip_bet_deduction: bool = False,  # Used when bet was already deducted in PvP matchmaking
    ) -> Dict[str, Any]:
        """Start a new game session"""
        # Check stamina
        stats = await self.get_player_stats(player_id)
        stamina_cost = STAMINA_PER_BATTLE
        
        if stats.get("stamina", 0) < stamina_cost:
            return {
                "success": False,
                "error": f"Insufficient stamina. Need {stamina_cost}, have {stats.get('stamina', 0):.1f}",
                "stamina": stats.get("stamina", 0),
            }
        
        # Check BL coins for bet (only if not already deducted)
        if bet_amount > 0 and not skip_bet_deduction:
            user = await self.db.users.find_one({"user_id": player_id}, {"bl_coins": 1})
            if not user or user.get("bl_coins", 0) < bet_amount:
                return {"success": False, "error": "Insufficient BL coins for bet"}
        
        # Get player's photo - REQUIRED for battle
        player_photo = None
        if player_photo_id:
            player_photo = await self.db.minted_photos.find_one(
                {"mint_id": player_photo_id, "user_id": player_id},
                {"_id": 0, "image_data": 0}
            )
            if not player_photo:
                return {"success": False, "error": "Photo not found or not owned"}
            
            # Check if photo has stamina (stamina stored as percentage 0-100)
            photo_stamina = player_photo.get("stamina", 100)
            if photo_stamina <= 0:
                return {"success": False, "error": "This photo has no stamina. Wait for it to recover."}
        
        # Generate bot photo if playing against bot
        opponent_photo = None
        if opponent_id == "bot":
            opponent_photo = generate_bot_photo()
        
        # Create game session
        session = GameSession(
            player1_id=player_id,
            player2_id=opponent_id,
            bet_amount=bet_amount,
            player1_photo_id=player_photo_id,
            player2_photo_id=opponent_photo["mint_id"] if opponent_photo else None,
        )
        
        session_dict = session.model_dump()
        session_dict["created_at"] = session_dict["created_at"].isoformat()
        session_dict["player1_photo"] = player_photo
        session_dict["player2_photo"] = opponent_photo
        
        await self.db.game_sessions.insert_one(session_dict)
        
        # Deduct stamina from player stats
        await self.db.player_stats.update_one(
            {"user_id": player_id},
            {"$inc": {"stamina": -stamina_cost}}
        )
        
        # Deduct stamina from photo (one battle = ~4.16% stamina)
        if player_photo_id:
            await self.db.minted_photos.update_one(
                {"mint_id": player_photo_id},
                {
                    "$inc": {"stamina": -STAMINA_PERCENT_PER_BATTLE},
                    "$set": {"last_battle_at": datetime.now(timezone.utc).isoformat()}
                }
            )
        
        # Deduct bet amount (only if not already deducted in PvP flow)
        if bet_amount > 0 and not skip_bet_deduction:
            await self.db.users.update_one(
                {"user_id": player_id},
                {"$inc": {"bl_coins": -bet_amount}}
            )
        
        return {
            "success": True,
            "session": session_dict,
            "phase": "rps",
            "instructions": "Play Rock-Paper-Scissors - first to 3 wins!",
        }
    
    async def play_rps_round(
        self,
        session_id: str,
        player_id: str,
        choice: str,
    ) -> Dict[str, Any]:
        """Play a round of Rock-Paper-Scissors"""
        if choice not in ["rock", "paper", "scissors"]:
            return {"success": False, "error": "Invalid choice"}
        
        session = await self.db.game_sessions.find_one(
            {"session_id": session_id},
            {"_id": 0}
        )
        
        if not session:
            return {"success": False, "error": "Session not found"}
        
        if session.get("phase") not in ["rps", "tiebreaker"]:
            return {"success": False, "error": "Not in RPS phase"}
        
        if session["player1_id"] != player_id:
            return {"success": False, "error": "Not your game"}
        
        # Bot makes random choice
        bot_choice = random.choice(["rock", "paper", "scissors"])
        
        # Determine winner
        result = determine_rps_winner(choice, bot_choice)
        
        round_data = {
            "round": session.get("current_rps_round", 1),
            "player1_choice": choice,
            "player2_choice": bot_choice,
            "winner": "player1" if result == 1 else ("player2" if result == 2 else "tie"),
        }
        
        # Update session
        updates = {
            "$push": {"rps_rounds": round_data},
            "$inc": {"current_rps_round": 1},
        }
        
        p1_wins = session.get("player1_rps_wins", 0)
        p2_wins = session.get("player2_rps_wins", 0)
        
        if result == 1:
            p1_wins += 1
            updates["$inc"]["player1_rps_wins"] = 1
        elif result == 2:
            p2_wins += 1
            updates["$inc"]["player2_rps_wins"] = 1
        
        # Check if RPS game is over (first to 3)
        rps_winner = None
        if p1_wins >= 3:
            rps_winner = session["player1_id"]
        elif p2_wins >= 3:
            rps_winner = session["player2_id"]
        
        if rps_winner:
            game_number = session.get("rps_game_number", 1)
            
            if game_number == 1:
                # First RPS done, move to photo battle
                updates["$set"] = {
                    "phase": "photo_battle",
                    "rps_game_number": 2,
                    "player1_rps_wins": 0,
                    "player2_rps_wins": 0,
                    "current_rps_round": 1,
                }
                round_data["rps_winner"] = "player1" if rps_winner == session["player1_id"] else "player2"
                round_data["next_phase"] = "photo_battle"
            elif game_number == 3:
                # Tiebreaker done, determine overall winner
                overall_winner = rps_winner
                updates["$set"] = {
                    "phase": "completed",
                    "winner_id": overall_winner,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }
                round_data["overall_winner"] = "player1" if overall_winner == session["player1_id"] else "player2"
        
        await self.db.game_sessions.update_one({"session_id": session_id}, updates)
        
        # Get updated session
        updated_session = await self.db.game_sessions.find_one(
            {"session_id": session_id},
            {"_id": 0}
        )
        
        # Process winnings if game completed
        if updated_session.get("phase") == "completed":
            await self._process_game_result(updated_session)
        
        return {
            "success": True,
            "round": round_data,
            "player1_wins": p1_wins,
            "player2_wins": p2_wins,
            "phase": updated_session.get("phase"),
            "session": updated_session,
        }
    
    async def play_photo_battle(self, session_id: str, player_id: str) -> Dict[str, Any]:
        """Execute the photo battle phase"""
        session = await self.db.game_sessions.find_one(
            {"session_id": session_id},
            {"_id": 0}
        )
        
        if not session:
            return {"success": False, "error": "Session not found"}
        
        if session.get("phase") != "photo_battle":
            return {"success": False, "error": "Not in photo battle phase"}
        
        # Get photos
        p1_photo = session.get("player1_photo") or await self.db.minted_photos.find_one(
            {"mint_id": session.get("player1_photo_id")},
            {"_id": 0, "image_data": 0}
        )
        
        p2_photo = session.get("player2_photo")
        if not p2_photo and session.get("player2_photo_id"):
            p2_photo = await self.db.minted_photos.find_one(
                {"mint_id": session.get("player2_photo_id")},
                {"_id": 0, "image_data": 0}
            )
        
        if not p1_photo:
            p1_photo = generate_bot_photo()  # Fallback
        if not p2_photo:
            p2_photo = generate_bot_photo()
        
        # Get player stats for win streak
        p1_stats = await self.get_player_stats(session["player1_id"])
        p2_stats = None
        if session["player2_id"] != "bot":
            p2_stats = await self.get_player_stats(session["player2_id"])
        
        # Calculate battle values
        p1_value = calculate_photo_battle_value(p1_photo, p2_photo, p1_stats)
        p2_value = calculate_photo_battle_value(p2_photo, p1_photo, p2_stats)
        
        # Determine winner
        if p1_value > p2_value:
            photo_winner = session["player1_id"]
        elif p2_value > p1_value:
            photo_winner = session["player2_id"]
        else:
            # Tie - random winner
            photo_winner = random.choice([session["player1_id"], session["player2_id"]])
        
        battle_result = {
            "player1_value": p1_value,
            "player2_value": p2_value,
            "player1_photo": {
                "name": p1_photo.get("name"),
                "scenery_type": p1_photo.get("scenery_type"),
                "base_value": p1_photo.get("dollar_value"),
            },
            "player2_photo": {
                "name": p2_photo.get("name"),
                "scenery_type": p2_photo.get("scenery_type"),
                "base_value": p2_photo.get("dollar_value"),
            },
            "winner": "player1" if photo_winner == session["player1_id"] else "player2",
        }
        
        # Check overall game state
        # Count who won RPS and who won photo battle
        rps_rounds = session.get("rps_rounds", [])
        rps_winner = None
        for r in rps_rounds:
            if r.get("rps_winner"):
                rps_winner = session["player1_id"] if r["rps_winner"] == "player1" else session["player2_id"]
                break
        
        if not rps_winner:
            # Determine from wins
            if session.get("player1_rps_wins", 0) >= 3:
                rps_winner = session["player1_id"]
            else:
                rps_winner = session["player2_id"]
        
        # If same player won both, they win overall
        if rps_winner == photo_winner:
            overall_winner = rps_winner
            next_phase = "completed"
        else:
            # Split - need tiebreaker
            overall_winner = None
            next_phase = "tiebreaker"
        
        updates = {
            "$set": {
                "photo_battle_result": battle_result,
                "photo_battle_winner": photo_winner,
                "phase": next_phase,
            }
        }
        
        if next_phase == "completed":
            updates["$set"]["winner_id"] = overall_winner
            updates["$set"]["completed_at"] = datetime.now(timezone.utc).isoformat()
        elif next_phase == "tiebreaker":
            updates["$set"]["rps_game_number"] = 3
            updates["$set"]["player1_rps_wins"] = 0
            updates["$set"]["player2_rps_wins"] = 0
            updates["$set"]["current_rps_round"] = 1
        
        await self.db.game_sessions.update_one({"session_id": session_id}, updates)
        
        updated_session = await self.db.game_sessions.find_one(
            {"session_id": session_id},
            {"_id": 0}
        )
        
        # Process winnings if completed
        if next_phase == "completed":
            await self._process_game_result(updated_session)
        
        return {
            "success": True,
            "battle_result": battle_result,
            "phase": next_phase,
            "overall_winner": "player1" if overall_winner == session["player1_id"] else ("player2" if overall_winner else None),
            "session": updated_session,
        }
    
    async def _process_game_result(self, session: Dict) -> None:
        """Process game result - update stats and distribute winnings"""
        if session.get("winnings_distributed"):
            return
        
        winner_id = session.get("winner_id")
        loser_id = session["player1_id"] if winner_id == session["player2_id"] else session["player2_id"]
        bet_amount = session.get("bet_amount", 0)
        
        # Update winner stats
        if winner_id and winner_id != "bot":
            await self.db.player_stats.update_one(
                {"user_id": winner_id},
                {
                    "$inc": {
                        "total_battles": 1,
                        "battles_won": 1,
                        "current_win_streak": 1,
                        "total_bl_won": bet_amount * 2 if bet_amount > 0 else 0,
                        "wins_today": 1,
                        "wins_this_week": 1,
                        "wins_this_month": 1,
                        "wins_this_year": 1,
                    }
                }
            )
            
            # Update best streak if needed
            stats = await self.db.player_stats.find_one({"user_id": winner_id})
            if stats and stats.get("current_win_streak", 0) > stats.get("best_win_streak", 0):
                await self.db.player_stats.update_one(
                    {"user_id": winner_id},
                    {"$set": {"best_win_streak": stats["current_win_streak"]}}
                )
            
            # Add winnings (bet * 2 - they get their bet back plus opponent's bet)
            if bet_amount > 0:
                await self.db.users.update_one(
                    {"user_id": winner_id},
                    {"$inc": {"bl_coins": bet_amount * 2}}
                )
                
                # Record transaction
                from referral_system import record_transaction, TransactionType, Currency
                await record_transaction(
                    user_id=winner_id,
                    transaction_type=TransactionType.BATTLE_WIN,
                    currency=Currency.BL,
                    amount=bet_amount,  # Net profit
                    reference_id=session["session_id"],
                    details={"opponent": loser_id, "total_pot": bet_amount * 2}
                )
            
            # Add XP to winner's photo
            if session.get("player1_photo_id") and winner_id == session["player1_id"]:
                await self.db.minted_photos.update_one(
                    {"mint_id": session["player1_photo_id"]},
                    {"$inc": {"xp": 1, "battles_won": 1}}
                )
        
        # Update loser stats
        if loser_id and loser_id != "bot":
            # Extra stamina penalty for loss
            extra_stamina_loss = STAMINA_PER_BATTLE * (DEFEAT_STAMINA_PENALTY - 1)
            
            await self.db.player_stats.update_one(
                {"user_id": loser_id},
                {
                    "$inc": {
                        "total_battles": 1,
                        "battles_lost": 1,
                        "total_bl_lost": bet_amount,
                        "stamina": -extra_stamina_loss,
                    },
                    "$set": {"current_win_streak": 0},
                }
            )
            
            # Record loss transaction
            if bet_amount > 0:
                from referral_system import record_transaction, TransactionType, Currency
                await record_transaction(
                    user_id=loser_id,
                    transaction_type=TransactionType.BATTLE_LOSS,
                    currency=Currency.BL,
                    amount=-bet_amount,
                    reference_id=session["session_id"],
                    details={"opponent": winner_id}
                )
            
            # Add loss to photo stats
            if session.get("player1_photo_id") and loser_id == session["player1_id"]:
                await self.db.minted_photos.update_one(
                    {"mint_id": session["player1_photo_id"]},
                    {"$inc": {"xp": 1, "battles_lost": 1}}
                )
        
        # Mark winnings as distributed
        await self.db.game_sessions.update_one(
            {"session_id": session["session_id"]},
            {"$set": {"winnings_distributed": True}}
        )
    
    async def get_leaderboard(
        self,
        period: str = "24h",  # 24h, 7d, 30d, 1y
        limit: int = 20
    ) -> List[Dict]:
        """Get leaderboard for specified period"""
        field_map = {
            "24h": "wins_today",
            "7d": "wins_this_week",
            "30d": "wins_this_month",
            "1y": "wins_this_year",
        }
        
        field = field_map.get(period, "wins_today")
        
        stats = await self.db.player_stats.find(
            {field: {"$gt": 0}},
            {"_id": 0}
        ).sort(field, -1).limit(limit).to_list(limit)
        
        # Fetch user info
        if stats:
            user_ids = [s["user_id"] for s in stats]
            users = await self.db.users.find(
                {"user_id": {"$in": user_ids}},
                {"_id": 0, "password_hash": 0, "user_id": 1, "name": 1, "avatar": 1}
            ).to_list(len(user_ids))
            users_map = {u["user_id"]: u for u in users}
            
            for stat in stats:
                stat["user"] = users_map.get(stat["user_id"])
        
        return stats
    
    async def get_photo_leaderboard(
        self,
        period: str = "24h",
        limit: int = 20
    ) -> List[Dict]:
        """Get leaderboard for most liked minted photos"""
        # For now, just get by likes_count
        # TODO: Add time-based filtering
        
        photos = await self.db.minted_photos.find(
            {"is_private": False},
            {"_id": 0, "image_data": 0}
        ).sort("likes_count", -1).limit(limit).to_list(limit)
        
        # Fetch user info
        if photos:
            user_ids = list(set(p["user_id"] for p in photos))
            users = await self.db.users.find(
                {"user_id": {"$in": user_ids}},
                {"_id": 0, "password_hash": 0}
            ).to_list(len(user_ids))
            users_map = {u["user_id"]: u for u in users}
            
            for photo in photos:
                photo["user"] = users_map.get(photo["user_id"])
        
        return photos


# Initialize service
game_service: Optional[PhotoGameService] = None


def init_game_service(db) -> PhotoGameService:
    global game_service
    game_service = PhotoGameService(db)
    return game_service
