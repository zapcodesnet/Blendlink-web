"""
Blendlink Photo Game System v3.0
Minted Photo Auction Bidding Battle - PVP First

Game Flow:
1. Create/Join Open Game with 5 pre-selected minted photos
2. Round sequence: Tapping → RPS → Tapping → RPS → Tapping (tiebreaker)
3. First to 3 wins takes the pot

Stamina: 24 battles max per photo, -1 on win, -2 on loss, +1/hour regeneration
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
# Stamina System (per photo)
MAX_STAMINA_BATTLES = 24  # Maximum battles available
STAMINA_REGEN_PER_HOUR = 1  # Regenerate 1 battle per hour
STAMINA_COST_WIN = 1  # Cost per round won
STAMINA_COST_LOSS = 2  # Cost per round lost

# Required photos for PVP
REQUIRED_PHOTOS_PER_PLAYER = 5

# Million Dollar RPS Constants
STARTING_BANKROLL = 5_000_000  # $5M starting bankroll (per spec)
ADVANTAGE_BONUS = 1_000_000  # $1M bonus for higher Dollar Value photo in RPS
MIN_BID = 1_000_000  # $1M minimum bid
MAX_BID = 6_000_000  # $6M maximum bid (updated with advantage)
BID_INCREMENT = 1_000_000  # $1M increments

# Win streak multipliers (🔥 Fire bonus - visible during battles)
WIN_STREAK_MULTIPLIERS = {
    3: 1.25,   # 🔥 ×1.25
    4: 1.50,   # 🔥 ×1.50
    5: 1.75,   # 🔥 ×1.75
    6: 2.00,   # 🔥 ×2.00
    7: 2.25,   # 🔥 ×2.25
    8: 2.50,   # 🔥 ×2.50
    9: 2.75,   # 🔥 ×2.75
    10: 3.00,  # 🔥 ×3.00 (maximum)
}

# Lose streak immunity threshold (🛡 Shield - gains immunity at 3+ losses)
LOSE_STREAK_IMMUNITY_THRESHOLD = 3

# Scenery types with Neutral category
SCENERY_TYPES = {
    "natural": {"name": "Natural Scenery", "strong_vs": "water", "weak_vs": "manmade", "neutral_bonus": 1.10},
    "water": {"name": "Water Scenery", "strong_vs": "manmade", "weak_vs": "natural", "neutral_bonus": 1.10},
    "manmade": {"name": "Man-made/Mixed", "strong_vs": "natural", "weak_vs": "water", "neutral_bonus": 1.10},
    "neutral": {"name": "Neutral/Plain", "strong_vs": None, "weak_vs": "all", "neutral_bonus": 1.0},
}

# Strength/weakness multipliers
STRENGTH_MULTIPLIER = 1.25  # +25% value for strong matchups
WEAKNESS_MULTIPLIER = 0.75  # -25% value for weak matchups
NEUTRAL_WEAKNESS_MULTIPLIER = 0.90  # Neutral is 10% weaker

# Auction Bidding Constants
BASE_BIDS_TO_WIN = 200  # Base number of taps needed if equal power
MAX_TAPS_PER_SECOND = 25  # Anti-cheat limit (updated from 20)
AUCTION_COUNTDOWN_SECONDS = 10  # Countdown before round starts
AUCTION_ROUND_DURATION = 15  # Seconds to complete tapping

# Bot Match Constants
BOT_DIFFICULTY = {
    "easy": {"win_rate": 0.55, "tap_speed": 5, "strategy": "random"},
    "medium": {"win_rate": 0.50, "tap_speed": 7, "strategy": "basic"},
    "hard": {"win_rate": 0.40, "tap_speed": 9, "strategy": "adaptive"},
}
BOT_MIN_BET = 1
BOT_MAX_BET = 500
BOT_HOUSE_FEE = 0.05  # 5% house fee on winnings


class RPSChoice(str, Enum):
    ROCK = "rock"
    PAPER = "paper"
    SCISSORS = "scissors"


class GamePhase(str, Enum):
    RPS_AUCTION = "rps_auction"  # Stage 1: Million Dollar RPS Bidding
    PHOTO_BATTLE = "photo_battle"  # Stage 2: Photo Dollar Clash
    TIEBREAKER = "tiebreaker"  # Stage 3: RPS Tiebreaker
    COMPLETED = "completed"


# ============== MODELS ==============
class PlayerStats(BaseModel):
    """Player's game statistics"""
    user_id: str
    stamina: float = MAX_STAMINA
    last_stamina_update: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Win streaks (🔥 Fire bonus)
    current_win_streak: int = 0
    best_win_streak: int = 0
    
    # Lose streaks (🛡 Shield immunity)
    current_lose_streak: int = 0
    
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
    
    def get_win_streak_multiplier(self) -> float:
        """Get the win streak power multiplier (🔥)"""
        if self.current_win_streak < 3:
            return 1.0
        # Cap at 10 streaks for max 3.0x
        streak = min(self.current_win_streak, 10)
        return WIN_STREAK_MULTIPLIERS.get(streak, WIN_STREAK_MULTIPLIERS.get(10, 3.0))
    
    def has_shield_immunity(self) -> bool:
        """Check if player has immunity shield (🛡) from lose streak"""
        return self.current_lose_streak >= LOSE_STREAK_IMMUNITY_THRESHOLD
    
    def on_win(self):
        """Update stats on win"""
        self.current_win_streak += 1
        self.current_lose_streak = 0  # Reset lose streak
        self.battles_won += 1
        self.total_battles += 1
        if self.current_win_streak > self.best_win_streak:
            self.best_win_streak = self.current_win_streak
    
    def on_loss(self):
        """Update stats on loss"""
        self.current_win_streak = 0  # Reset win streak
        self.current_lose_streak += 1
        self.battles_lost += 1
        self.total_battles += 1


class GameSession(BaseModel):
    """Active game session with Million Dollar RPS"""
    session_id: str = Field(default_factory=lambda: f"game_{uuid.uuid4().hex[:12]}")
    player1_id: str
    player2_id: str  # "bot" for bot games
    
    bet_amount: int = 0  # BL coin bet (separate from RPS bankroll)
    
    # Photo selections
    player1_photo_id: Optional[str] = None
    player2_photo_id: Optional[str] = None
    
    # Game state
    phase: GamePhase = GamePhase.RPS_AUCTION
    stage_number: int = 1  # 1 = first RPS, 2 = photo battle, 3 = tiebreaker
    
    # Million Dollar RPS Bankrolls
    player1_bankroll: int = STARTING_BANKROLL
    player2_bankroll: int = STARTING_BANKROLL
    
    # RPS Auction state
    player1_rps_wins: int = 0
    player2_rps_wins: int = 0
    current_rps_round: int = 1
    rps_rounds: List[Dict] = Field(default_factory=list)
    
    # Stage winners
    stage1_winner: Optional[str] = None  # RPS Auction winner
    stage2_winner: Optional[str] = None  # Photo battle winner
    
    # Photo battle result
    photo_battle_result: Optional[Dict] = None
    
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
    player_stats: Optional[Dict] = None,
    opponent_stats: Optional[Dict] = None
) -> Dict:
    """
    Calculate effective dollar value for photo battle with full streak and scenery system.
    
    Returns dict with:
    - effective_value: Final battle value after all modifiers
    - base_value: Original dollar value
    - scenery_modifier: Strength/weakness multiplier applied
    - streak_modifier: Win streak multiplier
    - has_immunity: Whether shield immunity negated weakness
    - modifiers_applied: List of all modifiers for display
    """
    base_value = photo.get("dollar_value", 1_000_000)
    modifiers_applied = []
    scenery_modifier = 1.0
    streak_modifier = 1.0
    has_immunity = False
    
    # Get scenery types
    photo_type = photo.get("scenery_type", "natural")
    opponent_type = opponent_photo.get("scenery_type", "natural")
    
    # Check if player has shield immunity (🛡) from lose streak
    if player_stats:
        lose_streak = player_stats.get("current_lose_streak", 0)
        has_immunity = lose_streak >= LOSE_STREAK_IMMUNITY_THRESHOLD
    
    # Apply scenery strength/weakness multiplier (only if different scenery)
    if photo_type != opponent_type:
        photo_scenery = SCENERY_TYPES.get(photo_type, SCENERY_TYPES["natural"])
        opponent_scenery = SCENERY_TYPES.get(opponent_type, SCENERY_TYPES["natural"])
        
        # Handle Neutral scenery (10% weaker vs all)
        if photo_type == "neutral":
            # Neutral is 10% weaker against all other types
            if not has_immunity:
                scenery_modifier = NEUTRAL_WEAKNESS_MULTIPLIER
                modifiers_applied.append({"type": "weakness", "reason": "Neutral background (-10%)", "value": -10})
        elif opponent_type == "neutral":
            # 10% stronger against Neutral
            scenery_modifier = 1.0 / NEUTRAL_WEAKNESS_MULTIPLIER  # ~1.11
            modifiers_applied.append({"type": "strength", "reason": f"{photo_scenery['name']} vs Neutral (+10%)", "value": 10})
        else:
            # Standard strength/weakness (25%)
            if photo_scenery.get("strong_vs") == opponent_type:
                scenery_modifier = STRENGTH_MULTIPLIER
                modifiers_applied.append({"type": "strength", "reason": f"{photo_scenery['name']} strong vs {opponent_scenery['name']} (+25%)", "value": 25})
            elif photo_scenery.get("weak_vs") == opponent_type:
                if has_immunity:
                    # Shield immunity negates weakness!
                    modifiers_applied.append({"type": "immunity", "reason": "🛡 Shield immunity negates weakness", "value": 0})
                else:
                    scenery_modifier = WEAKNESS_MULTIPLIER
                    modifiers_applied.append({"type": "weakness", "reason": f"{photo_scenery['name']} weak vs {opponent_scenery['name']} (-25%)", "value": -25})
    
    # Apply light condition strength/weakness (15%)
    photo_light = photo.get("light_type")
    opponent_light = opponent_photo.get("light_type")
    if photo_light and opponent_light and photo_light != opponent_light:
        light_info = LIGHT_TYPES.get(photo_light, {})
        if light_info.get("strong_vs") == opponent_light:
            scenery_modifier *= 1.15
            modifiers_applied.append({"type": "strength", "reason": "Light advantage (+15%)", "value": 15})
        elif light_info.get("weak_vs") == opponent_light:
            if has_immunity:
                modifiers_applied.append({"type": "immunity", "reason": "🛡 Shield immunity negates light weakness", "value": 0})
            else:
                scenery_modifier *= 0.87  # ~1/1.15
                modifiers_applied.append({"type": "weakness", "reason": "Light disadvantage (-15%)", "value": -15})
    
    # Apply win streak multiplier (🔥)
    if player_stats:
        win_streak = player_stats.get("current_win_streak", 0)
        if win_streak >= 3:
            # Cap at 10 streaks for max 3.0x
            capped_streak = min(win_streak, 10)
            streak_modifier = WIN_STREAK_MULTIPLIERS.get(capped_streak, 3.0)
            modifiers_applied.append({
                "type": "streak", 
                "reason": f"🔥 {win_streak} win streak (×{streak_modifier:.2f})", 
                "value": int((streak_modifier - 1) * 100)
            })
    
    # Legacy bonus: Age (0.1% per day since minting)
    legacy_modifier = 1.0
    created_at = photo.get("created_at")
    if created_at:
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            except:
                created_at = None
        if created_at:
            days_old = (datetime.now(timezone.utc) - created_at).days
            if days_old > 0:
                age_bonus = days_old * 0.001  # 0.1% per day
                legacy_modifier += age_bonus
                modifiers_applied.append({"type": "legacy", "reason": f"Age bonus ({days_old} days)", "value": round(age_bonus * 100, 1)})
    
    # Legacy bonus: Likes (0.05% per like)
    likes = photo.get("likes_count", 0)
    if likes > 0:
        likes_bonus = likes * 0.0005  # 0.05% per like
        legacy_modifier += likes_bonus
        modifiers_applied.append({"type": "legacy", "reason": f"Likes bonus ({likes} likes)", "value": round(likes_bonus * 100, 1)})
    
    # Calculate final effective value
    effective_value = int(base_value * scenery_modifier * streak_modifier * legacy_modifier)
    
    # Ensure minimum value of $1,000,000
    effective_value = max(effective_value, 1_000_000)
    
    return {
        "effective_value": effective_value,
        "base_value": base_value,
        "scenery_modifier": scenery_modifier,
        "streak_modifier": streak_modifier,
        "legacy_modifier": legacy_modifier,
        "has_immunity": has_immunity,
        "modifiers_applied": modifiers_applied,
        "photo_type": photo_type,
        "opponent_type": opponent_type,
    }


def calculate_auction_bids_required(
    player_value: int,
    opponent_value: int,
    base_bids: int = BASE_BIDS_TO_WIN
) -> Dict:
    """
    Calculate required bids (taps) for auction battle based on power difference.
    
    Higher dollar value = fewer bids needed to win.
    Lower dollar value = more bids needed to win.
    
    Returns dict with bids_required for each player.
    """
    # Calculate power ratio
    total_power = player_value + opponent_value
    if total_power == 0:
        return {"player_bids": base_bids, "opponent_bids": base_bids}
    
    player_ratio = player_value / total_power
    opponent_ratio = opponent_value / total_power
    
    # Bids inversely proportional to power ratio
    # Higher power = lower percentage of base_bids needed
    # Formula: bids = base_bids * (1 - power_ratio + 0.5)
    # This gives: 50% power = base_bids, 75% power = 0.75 * base_bids, 25% power = 1.25 * base_bids
    
    player_bids = int(base_bids * (1.5 - player_ratio))
    opponent_bids = int(base_bids * (1.5 - opponent_ratio))
    
    # Clamp to reasonable range (50 to 400 bids)
    player_bids = max(50, min(400, player_bids))
    opponent_bids = max(50, min(400, opponent_bids))
    
    # Calculate advantage percentage
    if player_bids < opponent_bids:
        advantage = "player"
        advantage_percent = int((opponent_bids - player_bids) / opponent_bids * 100)
    elif opponent_bids < player_bids:
        advantage = "opponent"
        advantage_percent = int((player_bids - opponent_bids) / player_bids * 100)
    else:
        advantage = "none"
        advantage_percent = 0
    
    return {
        "player_bids": player_bids,
        "opponent_bids": opponent_bids,
        "advantage": advantage,
        "advantage_percent": advantage_percent,
        "power_difference": player_value - opponent_value,
    }


def generate_bot_photo(difficulty: str = "medium", player_photos: List[Dict] = None) -> Dict:
    """
    Generate a bot photo for battles based on difficulty level.
    
    Difficulty affects:
    - Dollar value range
    - Scenery selection strategy (can counter player)
    - Rating scores
    """
    from minting_system import RATING_CRITERIA
    
    difficulty_config = BOT_DIFFICULTY.get(difficulty, BOT_DIFFICULTY["medium"])
    
    # Determine scenery based on difficulty and player photos
    if difficulty == "hard" and player_photos:
        # Smart bot: Choose scenery that's strong against player's likely choice
        player_sceneries = [p.get("scenery_type", "natural") for p in player_photos]
        most_common = max(set(player_sceneries), key=player_sceneries.count)
        # Counter the player's most common scenery
        counter_map = {"natural": "manmade", "water": "natural", "manmade": "water", "neutral": "water"}
        scenery = counter_map.get(most_common, random.choice(["natural", "water", "manmade"]))
    elif difficulty == "easy":
        # Easy bot: May choose neutral (weakest)
        scenery = random.choice(["natural", "water", "manmade", "neutral"])
    else:
        # Medium bot: Standard scenery
        scenery = random.choice(["natural", "water", "manmade"])
    
    light = random.choice(["sunlight_fire", "rain_snow_ice", "darkness_night"])
    
    scenery_info = SCENERY_TYPES.get(scenery, SCENERY_TYPES["natural"])
    light_info = LIGHT_TYPES[light]
    
    # Generate ratings based on difficulty
    if difficulty == "easy":
        ratings = {criterion: random.randint(25, 55) for criterion in RATING_CRITERIA}
        dollar_range = (1_000_000, 50_000_000)
    elif difficulty == "hard":
        ratings = {criterion: random.randint(55, 85) for criterion in RATING_CRITERIA}
        dollar_range = (100_000_000, 750_000_000)
    else:  # medium
        ratings = {criterion: random.randint(40, 70) for criterion in RATING_CRITERIA}
        dollar_range = (10_000_000, 200_000_000)
    
    avg_rating = sum(ratings.values()) / len(ratings)
    
    # Calculate dollar value within range
    rating_factor = avg_rating / 100
    dollar_value = int(dollar_range[0] + (dollar_range[1] - dollar_range[0]) * rating_factor)
    
    # Add some randomness
    dollar_value = int(dollar_value * random.uniform(0.8, 1.2))
    dollar_value = max(dollar_range[0], min(dollar_range[1], dollar_value))
    
    return {
        "mint_id": f"bot_photo_{uuid.uuid4().hex[:8]}",
        "name": f"Bot Photo #{random.randint(1000, 9999)}",
        "user_id": "bot",
        "scenery_type": scenery,
        "light_type": light,
        "strength_vs": scenery_info.get("strong_vs"),
        "weakness_vs": scenery_info.get("weak_vs") if scenery != "neutral" else "all",
        "light_strength_vs": light_info["strong_vs"],
        "light_weakness_vs": light_info["weak_vs"],
        "ratings": ratings,
        "overall_score": avg_rating,
        "dollar_value": dollar_value,
        "has_face": random.random() > 0.7,
        "power": int(50 + avg_rating * 0.5),
        "level": random.randint(1, 30) if difficulty == "easy" else random.randint(10, 50),
        "likes_count": random.randint(0, 50) if difficulty == "easy" else random.randint(50, 500),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_bot_photo": True,
        "difficulty": difficulty,
    }


def generate_bot_stats(difficulty: str = "medium") -> Dict:
    """Generate bot player stats for battles"""
    difficulty_config = BOT_DIFFICULTY.get(difficulty, BOT_DIFFICULTY["medium"])
    
    # Bots can have streaks for realism
    if difficulty == "easy":
        win_streak = random.randint(0, 2)
        lose_streak = random.randint(0, 4)
    elif difficulty == "hard":
        win_streak = random.randint(2, 6)
        lose_streak = random.randint(0, 1)
    else:
        win_streak = random.randint(0, 4)
        lose_streak = random.randint(0, 2)
    
    return {
        "user_id": "bot",
        "current_win_streak": win_streak,
        "current_lose_streak": lose_streak,
        "best_win_streak": max(win_streak, random.randint(3, 8)),
        "total_battles": random.randint(50, 500),
        "battles_won": random.randint(20, 250),
        "battles_lost": random.randint(20, 250),
        "difficulty": difficulty,
        "tap_speed": difficulty_config["tap_speed"],
        "strategy": difficulty_config["strategy"],
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
            stats = await self.db.player_stats.find_one({"user_id": user_id}, {"_id": 0})
        else:
            # Update stamina based on time passed
            stats = await self._regenerate_stamina(stats)
        
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
    
    async def regenerate_photo_stamina(self, photo: Dict) -> Dict:
        """Regenerate stamina for a specific photo"""
        last_battle = photo.get("last_battle_at")
        current_stamina = photo.get("stamina", 100)
        
        if last_battle and current_stamina < 100:
            if isinstance(last_battle, str):
                last_battle = datetime.fromisoformat(last_battle.replace("Z", "+00:00"))
            
            now = datetime.now(timezone.utc)
            hours_passed = (now - last_battle).total_seconds() / 3600
            
            # Regenerate ~4.16% per hour (1 battle per hour)
            stamina_gained = hours_passed * STAMINA_REGEN_PER_HOUR
            new_stamina = min(100, current_stamina + stamina_gained)
            
            if new_stamina > current_stamina:
                await self.db.minted_photos.update_one(
                    {"mint_id": photo["mint_id"]},
                    {"$set": {"stamina": new_stamina}}
                )
                photo["stamina"] = new_stamina
        
        return photo
    
    async def start_game(
        self,
        player_id: str,
        opponent_id: str = "bot",
        bet_amount: int = 0,
        player_photo_id: Optional[str] = None,
        skip_bet_deduction: bool = False,
        practice_mode: bool = False,
    ) -> Dict[str, Any]:
        """Start a new game session with Million Dollar RPS
        
        Args:
            practice_mode: If True, no BL bet, no stamina loss, no rewards - pure practice
        """
        # In practice mode, force no bet and always bot opponent
        if practice_mode:
            bet_amount = 0
            opponent_id = "bot"
        
        # Check player stamina (skip in practice mode)
        if not practice_mode:
            stats = await self.get_player_stats(player_id)
            if stats.get("stamina", 0) < STAMINA_PER_BATTLE:
                return {
                    "success": False,
                    "error": f"Insufficient stamina. Need {STAMINA_PER_BATTLE:.1f}%, have {stats.get('stamina', 0):.1f}%",
                    "stamina": stats.get("stamina", 0),
                }
        
        # Check BL coins for bet (only if not already deducted and not practice mode)
        if bet_amount > 0 and not skip_bet_deduction and not practice_mode:
            user = await self.db.users.find_one({"user_id": player_id}, {"bl_coins": 1})
            if not user or user.get("bl_coins", 0) < bet_amount:
                return {"success": False, "error": f"Insufficient BL coins. Need {bet_amount}, have {user.get('bl_coins', 0) if user else 0}"}
        
        # Get player's photo - REQUIRED for battle
        player_photo = None
        if player_photo_id:
            player_photo = await self.db.minted_photos.find_one(
                {"mint_id": player_photo_id, "user_id": player_id},
                {"_id": 0, "image_data": 0}
            )
            if not player_photo:
                return {"success": False, "error": "Photo not found or not owned"}
            
            # Regenerate photo stamina
            player_photo = await self.regenerate_photo_stamina(player_photo)
            
            # Check if photo has stamina (skip in practice mode)
            if not practice_mode:
                photo_stamina = player_photo.get("stamina", 100)
                if photo_stamina <= 0:
                    return {
                        "success": False, 
                        "error": "This photo has no stamina. Wait at least 1 hour for it to recover.",
                        "photo_stamina": photo_stamina
                    }
        else:
            return {"success": False, "error": "Photo selection is required for battle"}
        
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
            player1_bankroll=STARTING_BANKROLL,
            player2_bankroll=STARTING_BANKROLL,
        )
        
        session_dict = session.model_dump()
        session_dict["created_at"] = session_dict["created_at"].isoformat()
        session_dict["player1_photo"] = player_photo
        session_dict["player2_photo"] = opponent_photo
        session_dict["practice_mode"] = practice_mode  # Track practice mode
        
        await self.db.game_sessions.insert_one(session_dict)
        
        # Remove MongoDB _id from response
        if "_id" in session_dict:
            del session_dict["_id"]
        
        # Deduct stamina from player stats (skip in practice mode)
        if not practice_mode:
            await self.db.player_stats.update_one(
                {"user_id": player_id},
                {"$inc": {"stamina": -STAMINA_PER_BATTLE}}
            )
        
        # Deduct stamina from photo (skip in practice mode)
        if not practice_mode:
            await self.db.minted_photos.update_one(
                {"mint_id": player_photo_id},
                {
                    "$inc": {"stamina": -STAMINA_PERCENT_PER_BATTLE},
                    "$set": {"last_battle_at": datetime.now(timezone.utc).isoformat()}
                }
            )
        
        # Deduct BL bet amount (only if not already deducted in PvP flow, skip in practice mode)
        if bet_amount > 0 and not skip_bet_deduction and not practice_mode:
            await self.db.users.update_one(
                {"user_id": player_id},
                {"$inc": {"bl_coins": -bet_amount}}
            )
        
        return {
            "success": True,
            "session": session_dict,
            "phase": "rps_auction",
            "stage": 1,
            "bankroll": STARTING_BANKROLL,
            "min_bid": MIN_BID,
            "max_bid": MAX_BID,
            "instructions": "Stage 1: Million Dollar RPS Auction - First to 3 wins! Choose RPS + bid amount ($1M-$5M)",
        }
    
    async def play_rps_auction_round(
        self,
        session_id: str,
        player_id: str,
        choice: str,
        bid_amount: int,
    ) -> Dict[str, Any]:
        """
        Play a round of Million Dollar RPS Bidding Auction
        - Each player chooses RPS + bid ($1M-$5M)
        - Winner of RPS takes the pot
        - If tie RPS, higher bid wins
        - First to 3 wins takes Stage 1
        """
        if choice not in ["rock", "paper", "scissors"]:
            return {"success": False, "error": "Invalid RPS choice"}
        
        # Validate bid
        if bid_amount < MIN_BID or bid_amount > MAX_BID:
            return {"success": False, "error": f"Bid must be between ${MIN_BID:,} and ${MAX_BID:,}"}
        
        if bid_amount % BID_INCREMENT != 0:
            return {"success": False, "error": f"Bid must be in ${BID_INCREMENT:,} increments"}
        
        session = await self.db.game_sessions.find_one(
            {"session_id": session_id},
            {"_id": 0}
        )
        
        if not session:
            return {"success": False, "error": "Session not found"}
        
        if session.get("phase") not in ["rps_auction", "tiebreaker"]:
            return {"success": False, "error": "Not in RPS Auction phase"}
        
        if session["player1_id"] != player_id:
            return {"success": False, "error": "Not your game"}
        
        # Check player has enough bankroll
        p1_bankroll = session.get("player1_bankroll", STARTING_BANKROLL)
        if bid_amount > p1_bankroll:
            return {"success": False, "error": f"Insufficient bankroll. Have ${p1_bankroll:,}, trying to bid ${bid_amount:,}"}
        
        # Bot makes choice and bid
        bot_choice = random.choice(["rock", "paper", "scissors"])
        p2_bankroll = session.get("player2_bankroll", STARTING_BANKROLL)
        max_bot_bid = min(MAX_BID, p2_bankroll)
        bot_bid = random.choice([MIN_BID, MIN_BID * 2, MIN_BID * 3, max_bot_bid]) if max_bot_bid >= MIN_BID else 0
        
        # Determine RPS result
        rps_result = determine_rps_winner(choice, bot_choice)
        
        # Calculate pot and determine round winner
        total_pot = bid_amount + bot_bid
        round_winner = None
        
        if rps_result == 1:
            # Player wins RPS, takes pot
            round_winner = "player1"
            p1_bankroll = p1_bankroll - bid_amount + total_pot
            p2_bankroll = p2_bankroll - bot_bid
        elif rps_result == 2:
            # Bot wins RPS, takes pot
            round_winner = "player2"
            p1_bankroll = p1_bankroll - bid_amount
            p2_bankroll = p2_bankroll - bot_bid + total_pot
        else:
            # Tie RPS - higher bid wins
            if bid_amount > bot_bid:
                round_winner = "player1"
                p1_bankroll = p1_bankroll - bid_amount + total_pot
                p2_bankroll = p2_bankroll - bot_bid
            elif bot_bid > bid_amount:
                round_winner = "player2"
                p1_bankroll = p1_bankroll - bid_amount
                p2_bankroll = p2_bankroll - bot_bid + total_pot
            else:
                # Same bid, true tie - split pot (no change)
                round_winner = "tie"
        
        round_data = {
            "round": session.get("current_rps_round", 1),
            "player1_choice": choice,
            "player1_bid": bid_amount,
            "player2_choice": bot_choice,
            "player2_bid": bot_bid,
            "rps_result": "player1" if rps_result == 1 else ("player2" if rps_result == 2 else "tie"),
            "total_pot": total_pot,
            "winner": round_winner,
            "player1_bankroll_after": p1_bankroll,
            "player2_bankroll_after": p2_bankroll,
        }
        
        # Update win counts
        p1_wins = session.get("player1_rps_wins", 0)
        p2_wins = session.get("player2_rps_wins", 0)
        
        if round_winner == "player1":
            p1_wins += 1
        elif round_winner == "player2":
            p2_wins += 1
        
        # Check for bankruptcy (automatic loss)
        bankrupt_loser = None
        if p1_bankroll < MIN_BID and p1_wins < 3:
            bankrupt_loser = "player1"
            p2_wins = 3  # Auto win for opponent
        elif p2_bankroll < MIN_BID and p2_wins < 3:
            bankrupt_loser = "player2"
            p1_wins = 3  # Auto win for opponent
        
        if bankrupt_loser:
            round_data["bankruptcy"] = bankrupt_loser
        
        # Build update
        updates = {
            "$push": {"rps_rounds": round_data},
            "$inc": {"current_rps_round": 1},
            "$set": {
                "player1_bankroll": p1_bankroll,
                "player2_bankroll": p2_bankroll,
                "player1_rps_wins": p1_wins,
                "player2_rps_wins": p2_wins,
            }
        }
        
        # Check if Stage 1 (or tiebreaker) is complete
        stage_winner = None
        next_phase = session.get("phase")
        
        if p1_wins >= 3:
            stage_winner = session["player1_id"]
        elif p2_wins >= 3:
            stage_winner = session["player2_id"]
        
        if stage_winner:
            stage_num = session.get("stage_number", 1)
            
            if stage_num == 1:
                # Stage 1 complete - move to photo battle
                updates["$set"]["stage1_winner"] = stage_winner
                updates["$set"]["phase"] = "photo_battle"
                updates["$set"]["stage_number"] = 2
                round_data["stage_winner"] = "player1" if stage_winner == session["player1_id"] else "player2"
                round_data["next_phase"] = "photo_battle"
                next_phase = "photo_battle"
            elif stage_num == 3:
                # Tiebreaker complete - determine overall winner
                updates["$set"]["phase"] = "completed"
                updates["$set"]["winner_id"] = stage_winner
                updates["$set"]["completed_at"] = datetime.now(timezone.utc).isoformat()
                round_data["overall_winner"] = "player1" if stage_winner == session["player1_id"] else "player2"
                next_phase = "completed"
        
        await self.db.game_sessions.update_one({"session_id": session_id}, updates)
        
        # Get updated session
        updated_session = await self.db.game_sessions.find_one(
            {"session_id": session_id},
            {"_id": 0}
        )
        
        # Process winnings if game completed
        if next_phase == "completed":
            await self._process_game_result(updated_session)
        
        return {
            "success": True,
            "round": round_data,
            "player1_wins": p1_wins,
            "player2_wins": p2_wins,
            "player1_bankroll": p1_bankroll,
            "player2_bankroll": p2_bankroll,
            "phase": next_phase,
            "session": updated_session,
        }
    
    # Keep legacy play_rps_round for backward compatibility
    async def play_rps_round(
        self,
        session_id: str,
        player_id: str,
        choice: str,
    ) -> Dict[str, Any]:
        """Legacy RPS round - uses default bid of $1M"""
        return await self.play_rps_auction_round(
            session_id=session_id,
            player_id=player_id,
            choice=choice,
            bid_amount=MIN_BID,
        )
    
    async def play_photo_battle(self, session_id: str, player_id: str) -> Dict[str, Any]:
        """Execute the photo battle phase (Stage 2)"""
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
            p1_photo = generate_bot_photo()
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
                "light_type": p1_photo.get("light_type"),
                "base_value": p1_photo.get("dollar_value"),
                "likes": p1_photo.get("likes_count", 0),
            },
            "player2_photo": {
                "name": p2_photo.get("name"),
                "scenery_type": p2_photo.get("scenery_type"),
                "light_type": p2_photo.get("light_type"),
                "base_value": p2_photo.get("dollar_value"),
                "likes": p2_photo.get("likes_count", 0),
            },
            "winner": "player1" if photo_winner == session["player1_id"] else "player2",
        }
        
        # Get Stage 1 winner
        stage1_winner = session.get("stage1_winner")
        
        # If same player won both stages, they win overall
        if stage1_winner == photo_winner:
            overall_winner = stage1_winner
            next_phase = "completed"
        else:
            # Split - need tiebreaker (Stage 3)
            overall_winner = None
            next_phase = "tiebreaker"
        
        updates = {
            "$set": {
                "photo_battle_result": battle_result,
                "stage2_winner": photo_winner,
                "phase": next_phase,
            }
        }
        
        if next_phase == "completed":
            updates["$set"]["winner_id"] = overall_winner
            updates["$set"]["completed_at"] = datetime.now(timezone.utc).isoformat()
        elif next_phase == "tiebreaker":
            # Reset for tiebreaker
            updates["$set"]["stage_number"] = 3
            updates["$set"]["player1_rps_wins"] = 0
            updates["$set"]["player2_rps_wins"] = 0
            updates["$set"]["current_rps_round"] = 1
            updates["$set"]["player1_bankroll"] = STARTING_BANKROLL
            updates["$set"]["player2_bankroll"] = STARTING_BANKROLL
        
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
            "stage1_winner": "player1" if stage1_winner == session["player1_id"] else "player2",
            "stage2_winner": battle_result["winner"],
            "overall_winner": "player1" if overall_winner == session["player1_id"] else ("player2" if overall_winner else None),
            "session": updated_session,
        }
    
    async def _process_game_result(self, session: Dict) -> None:
        """Process game result - update stats and distribute winnings"""
        if session.get("winnings_distributed"):
            return
        
        # Skip all rewards/stats in practice mode
        if session.get("practice_mode"):
            await self.db.game_sessions.update_one(
                {"session_id": session["session_id"]},
                {"$set": {"winnings_distributed": True, "practice_mode_result": True}}
            )
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
            
            # Add winnings
            if bet_amount > 0:
                await self.db.users.update_one(
                    {"user_id": winner_id},
                    {"$inc": {"bl_coins": bet_amount * 2}}
                )
                
                from referral_system import record_transaction, TransactionType, Currency
                await record_transaction(
                    user_id=winner_id,
                    transaction_type=TransactionType.BATTLE_WIN,
                    currency=Currency.BL,
                    amount=bet_amount,
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
            
            # Extra stamina penalty for photo on loss
            loser_photo_id = None
            if session["player1_id"] == loser_id:
                loser_photo_id = session.get("player1_photo_id")
            elif session["player2_id"] == loser_id:
                loser_photo_id = session.get("player2_photo_id")
            
            if loser_photo_id:
                extra_photo_stamina_loss = STAMINA_PERCENT_PER_BATTLE * (DEFEAT_STAMINA_PENALTY - 1)
                await self.db.minted_photos.update_one(
                    {"mint_id": loser_photo_id},
                    {"$inc": {"stamina": -extra_photo_stamina_loss}}
                )
            
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
        period: str = "24h",
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
        photos = await self.db.minted_photos.find(
            {"is_private": False},
            {"_id": 0, "image_data": 0}
        ).sort("likes_count", -1).limit(limit).to_list(limit)
        
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
