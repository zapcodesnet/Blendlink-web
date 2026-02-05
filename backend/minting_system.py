"""
Blendlink Internal Minting System
- Photo/Video/Music minting as digital collectibles
- AI-powered photo analysis using OpenAI GPT-4o Vision
- Game stats, strength/weakness system
- No blockchain - MongoDB storage
"""

import os
import uuid
import random
import base64
import logging
import httpx
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ============== CONSTANTS ==============
MINT_COST_BL = 200  # 200 BL coins per mint

# Monthly Subscription Tiers with benefits
SUBSCRIPTION_TIERS = {
    "free": {
        "daily_mint_limit": 10,  # 10 FREE mints per day for regular users
        "xp_multiplier": 1,
        "daily_bl_claim": 0,
        "price": 0,
    },
    "bronze": {
        "daily_mint_limit": 20,
        "xp_multiplier": 2,
        "daily_bl_claim": 15_000,
        "price": 4.99,
    },
    "silver": {
        "daily_mint_limit": 50,
        "xp_multiplier": 3,
        "daily_bl_claim": 35_000,
        "price": 9.99,
    },
    "gold": {
        "daily_mint_limit": 100,
        "xp_multiplier": 4,
        "daily_bl_claim": 80_000,
        "price": 14.99,
    },
    "platinum": {
        "daily_mint_limit": 999999,  # Unlimited
        "xp_multiplier": 5,
        "daily_bl_claim": 200_000,
        "price": 24.99,
    },
}

# Legacy compatibility
DAILY_MINT_LIMIT = 10
SUBSCRIPTION_LIMITS = {
    "free": 10,  # 10 FREE mints per day for regular users
    "bronze": 20,
    "silver": 50,
    "gold": 100,
    "platinum": 999999,
    # Legacy names
    "basic": 20,
    "premium": 50,
}

# Scenery types and their strength/weakness relationships
SCENERY_TYPES = {
    "natural": {"name": "Natural Scenery", "strong_vs": "water", "weak_vs": "manmade"},
    "water": {"name": "Water Scenery", "strong_vs": "manmade", "weak_vs": "natural"},
    "manmade": {"name": "Man-made/Mixed", "strong_vs": "natural", "weak_vs": "water"},
    "neutral": {"name": "Neutral/Plain", "strong_vs": None, "weak_vs": "all"},  # 10% weaker than all
}

# Light condition types and their strength/weakness relationships
LIGHT_TYPES = {
    "sunlight_fire": {"name": "Sunlight/Fire", "strong_vs": "darkness_night", "weak_vs": "rain_snow_ice"},
    "rain_snow_ice": {"name": "Rain/Snow/Ice", "strong_vs": "sunlight_fire", "weak_vs": "darkness_night"},
    "darkness_night": {"name": "Darkness/Night/Interior", "strong_vs": "rain_snow_ice", "weak_vs": "sunlight_fire"},
}

# NEW 11-Category Rating System with specific weights (totals 100%)
# Maximum Core Power: 100% = $1,000,000,000 base value
RATING_CRITERIA = {
    "original": {"weight": 8, "max_value": 80_000_000, "label": "Original", "description": "Originality of the photo"},
    "innovative": {"weight": 10, "max_value": 100_000_000, "label": "Innovative", "description": "Super new idea (not a common photo)"},
    "unique": {"weight": 10, "max_value": 100_000_000, "label": "Unique", "description": "New angle, lighting, or technique (not a normal shot)"},
    "rare": {"weight": 10, "max_value": 100_000_000, "label": "Rare", "description": "Must use original; penalize duplicates"},
    "exposure": {"weight": 10, "max_value": 100_000_000, "label": "Exposure", "description": "Subject in focus, super sharp, no blur"},
    "color": {"weight": 8, "max_value": 80_000_000, "label": "Color", "description": "Perfect light/dark balance (not too bright or dark)"},
    "clarity": {"weight": 8, "max_value": 80_000_000, "label": "Clarity", "description": "Colors natural (no bad filters/over-editing)"},
    "composition": {"weight": 8, "max_value": 80_000_000, "label": "Composition", "description": "Main subject easy to see and well-framed"},
    "narrative": {"weight": 8, "max_value": 80_000_000, "label": "Narrative", "description": "Good layout (rule of thirds, leading lines); evokes emotion/story"},
    "captivating": {"weight": 10, "max_value": 100_000_000, "label": "Captivating", "description": "Tells a story or evokes strong emotion (happy, sad, dramatic)"},
    "authenticity": {"weight": 10, "max_value": 100_000_000, "label": "Authenticity", "description": "Face detection (5%) + Live selfie match (5%)"},
}

# Level/Star bonuses for Dollar Value (cumulative)
# Each milestone adds +10%, Level 60 adds extra +20% with golden frame
LEVEL_BONUSES = {
    10: {"stars": 1, "bonus_percent": 10, "bl_coins_reward": 10_000},   # Level 10: 1 star +10% + 10,000 BL
    20: {"stars": 2, "bonus_percent": 20},   # Level 20: 2 stars +20% (cumulative)
    30: {"stars": 3, "bonus_percent": 30},   # Level 30: 3 stars +30%
    40: {"stars": 4, "bonus_percent": 40},   # Level 40: 4 stars +40%
    50: {"stars": 5, "bonus_percent": 50},   # Level 50: 5 stars +50%
    60: {"stars": 5, "bonus_percent": 70, "golden_frame": True, "bl_coins_reward": 100_000},  # Level 60 (max): 5 stars + golden frame +70% + 100,000 BL
}

# Dollar Value Upgrade costs (BL coins)
UPGRADE_COSTS = {
    1_000_000: 1_000_000,      # $1M = 1M BL
    2_000_000: 2_000_000,      # $2M = 2M BL
    3_000_000: 3_000_000,      # $3M = 3M BL
    5_000_000: 5_000_000,      # $5M = 5M BL
    10_000_000: 10_000_000,    # $10M = 10M BL
    20_000_000: 20_000_000,    # $20M = 20M BL
    50_000_000: 50_000_000,    # $50M = 50M BL
    100_000_000: 100_000_000,  # $100M = 100M BL
    500_000_000: 500_000_000,  # $500M = 500M BL
    1_000_000_000: 1_000_000_000,  # $1B = 1B BL
}

# Monthly Dollar Value Growth
MONTHLY_GROWTH_VALUE = 1_000_000  # +$1M per 30 days

# Birthday Bonus (minting anniversary)
BIRTHDAY_BONUS_BL = 5_000  # 5,000 BL coins yearly

# Social Reaction Bonus
REACTION_BONUS_THRESHOLD = 100  # Per 100 new reactions
REACTION_BONUS_VALUE = 1_000_000  # +$1M per threshold

# Age Bonus (same as monthly growth but tracked separately)
AGE_BONUS_DAYS = 30  # Every 30 days
AGE_BONUS_VALUE = 1_000_000  # +$1M per cycle

# Star Bonus (per new star level)
STAR_BONUS_FLAT = 1_000_000  # +$1M flat bonus
STAR_BONUS_PERCENT = 10  # +10% of current total Dollar Value

# Seniority Bonus (Level 60)
SENIORITY_MAX_LEVEL = 60
SENIORITY_BONUS_FLAT = 1_000_000  # +$1M flat
SENIORITY_BONUS_PERCENT = 20  # +20% of total Dollar Value

# XP Requirements per Level (L1=0, L2=10, each next = +50% marginal XP)
def get_xp_for_level(level):
    """Calculate total XP required for a given level"""
    if level <= 1:
        return 0
    if level == 2:
        return 10
    
    total_xp = 10  # Level 2 requirement
    marginal = 10
    for lvl in range(3, level + 1):
        marginal = int(marginal * 1.5)  # +50% more per level
        total_xp += marginal
    return total_xp

def get_xp_to_next_level(current_level, current_xp):
    """Calculate XP needed for next level and progress percentage"""
    current_level_xp = get_xp_for_level(current_level)
    next_level_xp = get_xp_for_level(current_level + 1)
    xp_needed = next_level_xp - current_level_xp
    xp_progress = current_xp - current_level_xp
    progress_percent = min(100, max(0, (xp_progress / xp_needed * 100) if xp_needed > 0 else 0))
    return {
        "xp_for_current_level": current_level_xp,
        "xp_for_next_level": next_level_xp,
        "xp_needed": xp_needed,
        "xp_progress": xp_progress,
        "progress_percent": round(progress_percent, 1),
        "remaining": max(0, xp_needed - xp_progress)
    }

# Star Level Milestones (matches XP & Level Progression rules)
STAR_MILESTONES = {
    10: {"stars": 1, "bonus_percent": 10, "bl_coins": 10_000},
    20: {"stars": 2, "bonus_percent": 10, "bl_coins": 20_000},
    30: {"stars": 3, "bonus_percent": 10, "bl_coins": 30_000},
    40: {"stars": 4, "bonus_percent": 10, "bl_coins": 40_000},
    50: {"stars": 5, "bonus_percent": 10, "bl_coins": 50_000},
    60: {"stars": 5, "bonus_percent": 20, "bl_coins": 100_000, "golden_frame": True},
}

# Legacy list for backward compatibility
RATING_CRITERIA_LIST = list(RATING_CRITERIA.keys())

# ============== MODELS ==============
class MintedPhoto(BaseModel):
    """Minted photo collectible"""
    mint_id: str = Field(default_factory=lambda: f"mint_{uuid.uuid4().hex[:16]}")
    user_id: str
    name: str
    description: str = ""
    image_url: str
    thumbnail_url: str = ""
    
    # Mock transaction hash for NFT-like feel
    transaction_hash: str = Field(default_factory=lambda: f"0x{uuid.uuid4().hex}{uuid.uuid4().hex[:24]}")
    
    # Permanent Minting Metadata (transfers with photo)
    minted_by_user_id: str = ""  # Original minter's user ID
    minted_by_username: str = ""  # Original minter's @username
    
    # AI Analysis Results
    scenery_type: str = "natural"  # natural, water, manmade, neutral
    light_type: str = "sunlight_fire"  # sunlight_fire, rain_snow_ice, darkness_night
    strength_vs: str = ""
    weakness_vs: str = ""
    light_strength_vs: str = ""
    light_weakness_vs: str = ""
    
    # 11-Category Rating scores (0-100 scale, each represents % of max)
    ratings: Dict[str, int] = Field(default_factory=dict)
    # Individual category dollar values
    category_values: Dict[str, int] = Field(default_factory=dict)
    overall_score: float = 0.0
    
    # Base Dollar value ($1M to $1B based on ratings) - Core Power
    base_dollar_value: int = 1_000_000
    # Total Dollar value (includes level bonuses, upgrades, monthly growth, reactions)
    dollar_value: int = 1_000_000
    # Dollar value upgrades purchased with BL coins
    upgrades_purchased: List[int] = Field(default_factory=list)
    total_upgrade_value: int = 0
    
    # Monthly Dollar Value Growth (+$1M per 30 days)
    monthly_growth_value: int = 0  # Accumulated monthly growth
    last_monthly_growth_at: Optional[datetime] = None  # Last growth calculation
    
    # Social Reaction Bonus (+$1M per 100 reactions)
    total_reactions: int = 0  # Combined from all sources (FB, website, app)
    reaction_bonus_value: int = 0  # Accumulated reaction bonus
    
    # Authenticity (Face Detection + Selfie Match)
    has_face: bool = False
    face_detection_score: int = 0  # 0-100%, contributes up to 5% of authenticity
    selfie_match_score: int = 0  # 0-100%, contributes up to 5% of authenticity
    selfie_match_completed: bool = False  # Once done, cannot be redone
    selfie_match_attempts: int = 0  # Max 3 attempts
    
    # Legacy fields for backward compatibility
    face_bonus_percent: int = 0
    selfie_bonus_percent: int = 0
    
    # Power & XP - Level system with star bonuses
    power: float = 100.0
    xp: int = 0
    level: int = 1
    stars: int = 0  # 0-5 stars based on level milestones
    has_golden_frame: bool = False  # Level 60 bonus
    level_bonus_percent: int = 0  # Cumulative level bonus
    
    # Stats
    likes_count: int = 0
    battles_won: int = 0
    battles_lost: int = 0
    times_transferred: int = 0
    
    # Photo stamina for battles (Win=-1, Loss=-2, Max=24, Regen=+1/hour)
    stamina: float = 100.0  # 100% = 24 battles
    current_stamina: int = 24  # Direct battle count
    max_stamina: int = 24
    last_battle_at: Optional[datetime] = None
    last_stamina_regen_at: Optional[datetime] = None
    
    # Privacy & Display
    is_private: bool = False
    show_in_feed: bool = True
    album_id: Optional[str] = None
    
    # Marketplace
    is_listed: bool = False
    listing_price: Optional[float] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    minted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Birthday Bonus Tracking
    last_birthday_bonus_year: int = 0  # Year of last birthday bonus claim
    
    # ========== NEW STATS FOR BACK-CARD (below Authenticity) ==========
    
    # Age Bonus - +$1M every 30 days automatically
    age_bonus_value: int = 0  # Accumulated age bonus
    age_bonus_cycles: int = 0  # Number of 30-day cycles completed
    
    # Star Bonus - +$1M + 10% per new star level achieved
    star_bonus_value: int = 0  # Accumulated star bonus
    stars_achieved: List[int] = Field(default_factory=list)  # List of star levels achieved (e.g., [1, 2, 3])
    
    # Seniority - Level 60 bonus (+$1M + 20%)
    seniority_bonus_applied: bool = False  # Has seniority bonus been applied
    seniority_bonus_value: int = 0  # Seniority bonus amount
    
    # BL Coins spent on this photo (for Dollar Value boost tracking)
    bl_coins_spent: int = 0  # Total BL coins spent/invested
    
    # Reaction Milestone Tracking (for +$1M per 100 reactions)
    reaction_milestone_count: int = 0  # Number of 100-reaction milestones reached
    reactions_since_last_milestone: int = 0  # Counter 0-99, resets at 100
    
    # Win/Loss Streaks for battle bonuses
    win_streak: int = 0  # Current win streak (max 10)
    lose_streak: int = 0  # Current lose streak
    highest_win_streak: int = 0  # All-time highest win streak


class PhotoAlbum(BaseModel):
    """User's photo album"""
    album_id: str = Field(default_factory=lambda: f"album_{uuid.uuid4().hex[:12]}")
    user_id: str
    name: str
    description: str = ""
    is_private: bool = False
    cover_image: str = ""
    photo_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MintTransaction(BaseModel):
    """Record of a minting transaction"""
    tx_id: str = Field(default_factory=lambda: f"mtx_{uuid.uuid4().hex[:12]}")
    user_id: str
    mint_id: str
    mint_type: str = "photo"  # photo, video, music
    bl_cost: int = MINT_COST_BL
    transaction_hash: str = ""
    status: str = "completed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class PhotoBattle(BaseModel):
    """Record of a photo battle"""
    battle_id: str = Field(default_factory=lambda: f"battle_{uuid.uuid4().hex[:12]}")
    player1_id: str
    player2_id: str  # Can be "bot" for bot battles
    player1_photo_id: str
    player2_photo_id: str
    
    # Betting
    bet_amount: int = 0
    
    # Results
    winner_id: Optional[str] = None
    winner_photo_id: Optional[str] = None
    
    # Game flow
    rps_results: List[Dict] = Field(default_factory=list)  # Rock-Paper-Scissors rounds
    photo_battle_result: Optional[Dict] = None
    
    status: str = "pending"  # pending, in_progress, completed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None


# ============== REAL-TIME BONUS CALCULATIONS ==============
def calculate_age_bonus(minted_at: datetime) -> Dict[str, Any]:
    """Calculate Age bonus: +$1M every 30 days automatically"""
    now = datetime.now(timezone.utc)
    if minted_at.tzinfo is None:
        minted_at = minted_at.replace(tzinfo=timezone.utc)
    
    days_since_mint = (now - minted_at).days
    cycles_completed = days_since_mint // AGE_BONUS_DAYS
    age_bonus = cycles_completed * AGE_BONUS_VALUE
    
    days_until_next = AGE_BONUS_DAYS - (days_since_mint % AGE_BONUS_DAYS)
    
    return {
        "days_old": days_since_mint,
        "cycles_completed": cycles_completed,
        "age_bonus_value": age_bonus,
        "days_until_next_bonus": days_until_next,
        "next_bonus_date": now + timedelta(days=days_until_next)
    }

def calculate_star_bonus(level: int, base_value: int) -> Dict[str, Any]:
    """Calculate Star bonus based on level milestones"""
    stars = 0
    total_star_bonus = 0
    star_details = []
    
    for lvl, data in sorted(STAR_MILESTONES.items()):
        if level >= lvl:
            stars = data["stars"]
            # +$1M flat + 10% of current base value per star milestone
            milestone_bonus = STAR_BONUS_FLAT + int(base_value * STAR_BONUS_PERCENT / 100)
            total_star_bonus += milestone_bonus
            star_details.append({
                "level": lvl,
                "stars": data["stars"],
                "bonus": milestone_bonus,
                "bl_coins": data.get("bl_coins", 0)
            })
    
    return {
        "current_stars": stars,
        "total_star_bonus": total_star_bonus,
        "milestones_achieved": star_details,
        "has_golden_frame": level >= SENIORITY_MAX_LEVEL
    }

def calculate_seniority_bonus(level: int, total_value: int) -> Dict[str, Any]:
    """Calculate Seniority bonus at Level 60"""
    if level >= SENIORITY_MAX_LEVEL:
        # +$1M + 20% of total Dollar Value
        seniority_bonus = SENIORITY_BONUS_FLAT + int(total_value * SENIORITY_BONUS_PERCENT / 100)
        return {
            "seniority_achieved": True,
            "seniority_bonus": seniority_bonus,
            "has_golden_frame": True
        }
    return {
        "seniority_achieved": False,
        "seniority_bonus": 0,
        "has_golden_frame": False,
        "levels_remaining": SENIORITY_MAX_LEVEL - level
    }

def calculate_reaction_bonus(total_reactions: int, current_milestone_count: int = 0) -> Dict[str, Any]:
    """Calculate reaction bonus: +$1M per 100 reactions"""
    new_milestones = total_reactions // REACTION_BONUS_THRESHOLD
    new_bonus_milestones = new_milestones - current_milestone_count
    reaction_bonus = new_milestones * REACTION_BONUS_VALUE
    
    reactions_to_next = REACTION_BONUS_THRESHOLD - (total_reactions % REACTION_BONUS_THRESHOLD)
    if reactions_to_next == REACTION_BONUS_THRESHOLD:
        reactions_to_next = 0  # Just hit a milestone
    
    return {
        "total_reactions": total_reactions,
        "milestones_reached": new_milestones,
        "new_milestones": max(0, new_bonus_milestones),
        "reaction_bonus_value": reaction_bonus,
        "reactions_since_last_milestone": total_reactions % REACTION_BONUS_THRESHOLD,
        "reactions_to_next_bonus": reactions_to_next
    }

def calculate_total_dollar_value(photo_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate total Dollar Value with ALL bonuses applied in real-time.
    This is the master calculation that combines all boost sources.
    """
    base_value = photo_data.get("base_dollar_value", 1_000_000)
    minted_at = photo_data.get("minted_at", datetime.now(timezone.utc))
    if isinstance(minted_at, str):
        minted_at = datetime.fromisoformat(minted_at.replace("Z", "+00:00"))
    
    level = photo_data.get("level", 1)
    xp = photo_data.get("xp", 0)
    total_reactions = photo_data.get("total_reactions", 0)
    reaction_milestone_count = photo_data.get("reaction_milestone_count", 0)
    
    # 1. Base Dollar Value (from AI scoring)
    total = base_value
    
    # 2. Level Bonus (cumulative %)
    level_bonus_percent = photo_data.get("level_bonus_percent", 0)
    level_bonus_value = int(base_value * level_bonus_percent / 100)
    total += level_bonus_value
    
    # 3. Age Bonus (+$1M per 30 days)
    age_data = calculate_age_bonus(minted_at)
    total += age_data["age_bonus_value"]
    
    # 4. Star Bonus (+$1M + 10% per star milestone)
    star_data = calculate_star_bonus(level, base_value)
    total += star_data["total_star_bonus"]
    
    # 5. Reaction Bonus (+$1M per 100 reactions)
    reaction_data = calculate_reaction_bonus(total_reactions, reaction_milestone_count)
    total += reaction_data["reaction_bonus_value"]
    
    # 6. Monthly Growth (legacy - also tracked as age bonus)
    monthly_growth = photo_data.get("monthly_growth_value", 0)
    # Don't double-count - age bonus replaces monthly growth
    
    # 7. Upgrade Value (BL coins spent)
    upgrade_value = photo_data.get("total_upgrade_value", 0)
    total += upgrade_value
    
    # 8. Seniority Bonus (Level 60: +$1M + 20%)
    seniority_data = calculate_seniority_bonus(level, total)
    if seniority_data["seniority_achieved"]:
        total += seniority_data["seniority_bonus"]
    
    # 9. XP Progress to next level
    xp_progress = get_xp_to_next_level(level, xp)
    
    return {
        "base_dollar_value": base_value,
        "total_dollar_value": total,
        "level": level,
        "xp": xp,
        "xp_progress": xp_progress,
        "stars": star_data["current_stars"],
        "has_golden_frame": star_data["has_golden_frame"] or seniority_data["has_golden_frame"],
        "bonuses": {
            "level_bonus": {"percent": level_bonus_percent, "value": level_bonus_value},
            "age_bonus": age_data,
            "star_bonus": star_data,
            "reaction_bonus": reaction_data,
            "upgrade_bonus": {"value": upgrade_value},
            "seniority_bonus": seniority_data,
        }
    }


# ============== AI PHOTO ANALYSIS ==============
async def analyze_photo_with_ai(image_base64: str, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """
    Analyze photo using OpenAI GPT-4o Vision via Emergent LLM Key
    Returns scenery type, light type, ratings, face detection, etc.
    """
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            logger.error("EMERGENT_LLM_KEY not configured")
            return get_fallback_analysis()
        
        # Initialize chat with GPT-4o Vision
        # Note: Using gpt-4o for vision capabilities
        chat = LlmChat(
            api_key=api_key,
            session_id=f"photo_analysis_{uuid.uuid4().hex[:8]}",
            system_message="""You are an expert photo analyst for a gaming platform. 
Analyze photos and provide structured ratings. Be fair but varied in your assessments.
Return ONLY valid JSON without any markdown formatting or code blocks."""
        ).with_model("openai", "gpt-4o")
        
        # Create image content - pass just the base64 data WITHOUT the data URL prefix
        # The library will add the prefix automatically in _add_user_message
        image_content = ImageContent(image_base64=image_base64)
        
        analysis_prompt = """Analyze this photo and return a JSON object with these exact fields:

{
  "scenery_type": "natural" or "water" or "manmade" or "neutral",
  "light_type": "sunlight_fire" or "rain_snow_ice" or "darkness_night",
  "scenery_description": "brief description of dominant background",
  "light_description": "brief description of lighting conditions",
  "has_face": true/false,
  "face_count": number,
  "face_clarity": 0-100 (how clear/prominent the face is, 0 if no face),
  "ratings": {
    "original": 0-100,
    "innovative": 0-100,
    "unique": 0-100,
    "rare": 0-100,
    "exposure": 0-100,
    "color": 0-100,
    "clarity": 0-100,
    "composition": 0-100,
    "narrative": 0-100,
    "captivating": 0-100
  }
}

RATING CATEGORIES (score each 0-100):
1. Original (Originality) - How original is this photo?
2. Innovative - Is this a super new idea? Not a common photo type?
3. Unique - New angle, lighting, or technique? Not a normal shot?
4. Rare - Does this appear to be an original photo (not a copy/screenshot)?
5. Exposure - Is subject in focus, super sharp, no blur?
6. Color - Perfect light/dark balance? Not too bright or dark?
7. Clarity - Are colors natural? No bad filters or over-editing?
8. Composition - Is main subject easy to see and well-framed?
9. Narrative - Good layout (rule of thirds, leading lines)? Evokes emotion/story?
10. Captivating - Does it tell a story or evoke strong emotion?

SCENERY TYPES:
- "natural": landscapes, forests, mountains, gardens, macro nature, animals
- "water": oceans, waterfalls, rivers, lakes, rain, underwater, beaches
- "manmade": cities, buildings, streets, interiors, vehicles, tech, urban
- "neutral": ID-style photos, transparent background, plain solid color, empty/plain background

LIGHT TYPES:
- "sunlight_fire": bright daylight, golden hour, fire, warm artificial light
- "rain_snow_ice": rain, snow, ice, fog, overcast, cold weather
- "darkness_night": night scenes, dark interiors, low light, shadows

Be fair and varied. Most photos score 30-70 range. Exceptional photos can score 70-95.
Penalize screenshots, obvious copies, heavily filtered images in the "rare" category.
Return ONLY the JSON object, no other text."""

        user_message = UserMessage(
            text=analysis_prompt,
            file_contents=[image_content]
        )
        
        # Send message and get response
        response = await chat.send_message(user_message)
        
        # Parse response - clean any markdown formatting
        import json
        cleaned = response.strip()
        
        # Remove markdown code blocks if present
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            start_idx = 1 if lines[0].startswith("```") else 0
            end_idx = len(lines)
            for i, line in enumerate(lines[1:], 1):
                if line.strip() == "```":
                    end_idx = i
                    break
            cleaned = "\n".join(lines[start_idx:end_idx])
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()
        
        result = json.loads(cleaned)
        
        # Validate and normalize response
        if "scenery_type" not in result:
            result["scenery_type"] = "natural"
        if result["scenery_type"] not in SCENERY_TYPES:
            result["scenery_type"] = "natural"
        
        if "light_type" not in result:
            result["light_type"] = "sunlight_fire"
        if result["light_type"] not in LIGHT_TYPES:
            result["light_type"] = "sunlight_fire"
        
        # Ensure all 11 rating categories are present (using new category names)
        required_ratings = ["original", "innovative", "unique", "rare", "exposure", 
                          "color", "clarity", "composition", "narrative", "captivating"]
        if "ratings" not in result:
            result["ratings"] = {}
        for category in required_ratings:
            if category not in result["ratings"]:
                result["ratings"][category] = random.randint(40, 70)
        
        # Calculate authenticity score based on face detection
        face_clarity = result.get("face_clarity", 0)
        if result.get("has_face", False) and face_clarity > 0:
            # Face detection contributes up to 5% (50 out of 100 for the authenticity category)
            result["face_detection_score"] = min(100, face_clarity)
        else:
            result["face_detection_score"] = 0
        
        # Authenticity score = face detection (max 50%) + selfie match (max 50%, done later)
        # For now, authenticity is just the face detection portion
        result["ratings"]["authenticity"] = result["face_detection_score"] // 2  # Max 50 at mint time
        
        if "has_face" not in result:
            result["has_face"] = False
            
        logger.info(f"AI photo analysis complete: scenery={result['scenery_type']}, light={result.get('light_type')}, has_face={result.get('has_face')}")
        return result
        
    except Exception as e:
        logger.error(f"AI photo analysis failed: {e}")
        return get_fallback_analysis()


def get_fallback_analysis() -> Dict[str, Any]:
    """Generate fallback analysis when AI is unavailable"""
    scenery = random.choice(["natural", "water", "manmade", "neutral"])
    light = random.choice(["sunlight_fire", "rain_snow_ice", "darkness_night"])
    has_face = random.random() > 0.7
    face_clarity = random.randint(60, 100) if has_face else 0
    
    ratings = {
        "original": random.randint(40, 80),
        "innovative": random.randint(40, 80),
        "unique": random.randint(40, 80),
        "rare": random.randint(50, 90),  # Higher default for original photos
        "exposure": random.randint(40, 80),
        "color": random.randint(40, 80),
        "clarity": random.randint(40, 80),
        "composition": random.randint(40, 80),
        "narrative": random.randint(40, 80),
        "captivating": random.randint(40, 80),
        "authenticity": face_clarity // 2 if has_face else 0,  # Max 50 at mint time
    }
    
    return {
        "scenery_type": scenery,
        "light_type": light,
        "scenery_description": "Unable to analyze - using default",
        "light_description": "Unable to analyze - using default",
        "has_face": has_face,
        "face_count": 1 if has_face else 0,
        "face_clarity": face_clarity,
        "face_detection_score": face_clarity if has_face else 0,
        "ratings": ratings
    }


def calculate_dollar_value(ratings: Dict[str, int], scenery_type: str = "natural", 
                          level: int = 1, total_upgrades: int = 0) -> Dict[str, Any]:
    """
    Calculate dollar value based on weighted 11-category ratings
    Range: $1M to $1B base, with level bonuses and upgrades
    
    New 11-Category System:
    1. Original (8%) = $80M max
    2. Innovative (10%) = $100M max
    3. Unique (10%) = $100M max
    4. Rare (10%) = $100M max
    5. Exposure (10%) = $100M max
    6. Color (8%) = $80M max
    7. Clarity (8%) = $80M max
    8. Composition (8%) = $80M max
    9. Narrative (8%) = $80M max
    10. Captivating (10%) = $100M max
    11. Authenticity (10%) = $100M max (face 5% + selfie 5%)
    
    Total = 100% = $1B max
    """
    if not ratings:
        return {
            "base_value": 1_000_000,
            "dollar_value": 1_000_000,
            "category_values": {},
            "level_bonus": 0,
            "upgrade_bonus": 0,
            "scenery_penalty": 0
        }
    
    # Calculate each category's dollar value contribution
    category_values = {}
    total_value = 0
    
    for category, config in RATING_CRITERIA.items():
        score = ratings.get(category, 50)  # Default to 50 if missing
        # Each category contributes (score/100) * max_value
        category_dollar = int((score / 100) * config["max_value"])
        category_values[category] = category_dollar
        total_value += category_dollar
    
    base_value = max(1_000_000, total_value)  # Minimum $1M
    
    # Apply scenery penalty for neutral (-10%)
    scenery_penalty = 0
    if scenery_type == "neutral":
        scenery_penalty = int(base_value * 0.10)
        base_value = int(base_value * 0.90)
    
    # Apply level bonus
    level_bonus_percent = 0
    for threshold, bonus_info in sorted(LEVEL_BONUSES.items()):
        if level >= threshold:
            level_bonus_percent = bonus_info["bonus_percent"]
    
    level_bonus = int(base_value * (level_bonus_percent / 100))
    
    # Final dollar value = base + level bonus + upgrades
    dollar_value = base_value + level_bonus + total_upgrades
    
    return {
        "base_value": base_value,
        "dollar_value": dollar_value,
        "category_values": category_values,
        "level_bonus": level_bonus,
        "level_bonus_percent": level_bonus_percent,
        "upgrade_bonus": total_upgrades,
        "scenery_penalty": scenery_penalty
    }


def calculate_full_dollar_value(
    photo: Dict[str, Any],
    current_time: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Calculate full dollar value with all bonuses:
    - Base value (AI scoring)
    - Level bonus
    - Upgrade bonus
    - Monthly growth (+$1M per 30 days)
    - Reaction bonus (+$1M per 100 reactions)
    
    Returns updated values for database storage
    """
    if current_time is None:
        current_time = datetime.now(timezone.utc)
    
    base_dollar_value = photo.get("base_dollar_value", 1_000_000)
    level_bonus_percent = photo.get("level_bonus_percent", 0)
    total_upgrade_value = photo.get("total_upgrade_value", 0)
    
    # Calculate level bonus
    level_bonus = int(base_dollar_value * (level_bonus_percent / 100))
    
    # Calculate monthly growth since minting
    minted_at = photo.get("minted_at")
    if isinstance(minted_at, str):
        minted_at = datetime.fromisoformat(minted_at.replace('Z', '+00:00'))
    
    monthly_growth_value = 0
    if minted_at:
        days_since_mint = (current_time - minted_at).days
        months_since_mint = days_since_mint // 30
        monthly_growth_value = months_since_mint * MONTHLY_GROWTH_VALUE
    
    # Calculate reaction bonus
    total_reactions = photo.get("total_reactions", 0)
    reaction_bonus_value = (total_reactions // REACTION_BONUS_THRESHOLD) * REACTION_BONUS_VALUE
    
    # Final dollar value
    dollar_value = (
        base_dollar_value +
        level_bonus +
        total_upgrade_value +
        monthly_growth_value +
        reaction_bonus_value
    )
    
    return {
        "dollar_value": dollar_value,
        "base_dollar_value": base_dollar_value,
        "level_bonus": level_bonus,
        "level_bonus_percent": level_bonus_percent,
        "total_upgrade_value": total_upgrade_value,
        "monthly_growth_value": monthly_growth_value,
        "reaction_bonus_value": reaction_bonus_value,
        "last_monthly_growth_at": current_time
    }


def calculate_stamina_regen(photo: Dict[str, Any], current_time: Optional[datetime] = None) -> int:
    """
    Calculate current stamina with regeneration.
    +1 battle per hour when not used.
    Max: 24 battles
    """
    if current_time is None:
        current_time = datetime.now(timezone.utc)
    
    current_stamina = photo.get("current_stamina", 24)
    max_stamina = photo.get("max_stamina", 24)
    last_battle_at = photo.get("last_battle_at")
    
    if not last_battle_at or current_stamina >= max_stamina:
        return min(current_stamina, max_stamina)
    
    if isinstance(last_battle_at, str):
        last_battle_at = datetime.fromisoformat(last_battle_at.replace('Z', '+00:00'))
    
    # Calculate hours since last battle
    hours_since_battle = (current_time - last_battle_at).total_seconds() / 3600
    
    # Add +1 per hour (integer hours only)
    regen_amount = int(hours_since_battle)
    
    new_stamina = min(current_stamina + regen_amount, max_stamina)
    return new_stamina


def get_level_stars(level: int) -> Dict[str, Any]:
    """Get stars and bonuses for a given level"""
    stars = 0
    bonus_percent = 0
    has_golden_frame = False
    
    for threshold, bonus_info in sorted(LEVEL_BONUSES.items()):
        if level >= threshold:
            stars = bonus_info["stars"]
            bonus_percent = bonus_info["bonus_percent"]
            has_golden_frame = bonus_info.get("golden_frame", False)
    
    return {
        "stars": stars,
        "bonus_percent": bonus_percent,
        "has_golden_frame": has_golden_frame
    }


def calculate_level_xp(level: int) -> int:
    """Calculate XP required for a level (50% marginal increase per level)"""
    if level <= 1:
        return 0
    if level == 2:
        return 10
    
    # Each level requires 50% more marginal XP than previous
    xp = 10
    for i in range(3, level + 1):
        xp = int(xp * 1.5)
    return xp


def get_level_from_xp(xp: int) -> int:
    """Get level from total XP"""
    level = 1
    total_xp_needed = 0
    
    while level < 60:
        next_level_xp = calculate_level_xp(level + 1)
        if total_xp_needed + next_level_xp > xp:
            break
        total_xp_needed += next_level_xp
        level += 1
    
    return level


# ============== MINTING SERVICE ==============
class MintingService:
    """Service for managing internal photo minting"""
    
    def __init__(self, db):
        self.db = db
    
    async def check_can_mint(self, user_id: str) -> Dict[str, Any]:
        """Check if user can mint today"""
        user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            return {"can_mint": False, "reason": "User not found"}
        
        # Get user's BL coins (for info only - minting is FREE)
        bl_coins = user.get("bl_coins", 0)
        
        # Check daily limit
        subscription = user.get("subscription_tier", "free")
        daily_limit = SUBSCRIPTION_LIMITS.get(subscription, 10)  # Default 10 for free users
        
        # Fix: Use string comparison properly for ISO dates stored as strings
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_start_str = today_start.isoformat()
        mints_today = await self.db.mint_transactions.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": today_start_str}
        })
        
        if mints_today >= daily_limit:
            return {
                "can_mint": False,
                "reason": f"Daily limit reached ({daily_limit} mints). Resets at midnight UTC.",
                "mints_today": mints_today,
                "daily_limit": daily_limit,
                "remaining_mints": 0,
                "is_free": True  # Minting is FREE for all users
            }
        
        return {
            "can_mint": True,
            "bl_coins": bl_coins,
            "mints_today": mints_today,
            "daily_limit": daily_limit,
            "remaining_mints": daily_limit - mints_today,
            "is_free": True  # Minting is FREE for all users
        }
    
    async def mint_photo(
        self,
        user_id: str,
        image_base64: str,
        name: str,
        description: str = "",
        is_private: bool = False,
        show_in_feed: bool = True,
        album_id: Optional[str] = None,
        mime_type: str = "image/jpeg"
    ) -> Dict[str, Any]:
        """
        Mint a new photo collectible
        """
        # Check if user can mint
        check = await self.check_can_mint(user_id)
        if not check["can_mint"]:
            return {"success": False, "error": check["reason"]}
        
        # Get user info for minter metadata
        user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0, "username": 1, "name": 1})
        minter_username = user.get("username") or user.get("name") or user_id
        
        # Deduct BL coins
        await self.db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"bl_coins": -MINT_COST_BL}}
        )
        
        # Analyze photo with AI
        analysis = await analyze_photo_with_ai(image_base64, mime_type)
        
        # Get scenery info
        scenery_type = analysis.get("scenery_type", "natural")
        scenery_info = SCENERY_TYPES.get(scenery_type, SCENERY_TYPES["natural"])
        
        # Get light info
        light_type = analysis.get("light_type", "sunlight_fire")
        light_info = LIGHT_TYPES.get(light_type, LIGHT_TYPES["sunlight_fire"])
        
        # Get ratings and face detection info
        ratings = analysis.get("ratings", {})
        has_face = analysis.get("has_face", False)
        face_detection_score = analysis.get("face_detection_score", 0)
        
        # Calculate dollar value using new 11-category system
        dollar_calc = calculate_dollar_value(
            ratings=ratings,
            scenery_type=scenery_type,
            level=1,  # New photo starts at level 1
            total_upgrades=0
        )
        
        base_dollar_value = dollar_calc["base_value"]
        dollar_value = dollar_calc["dollar_value"]
        category_values = dollar_calc["category_values"]
        
        # Calculate overall score (weighted average percentage)
        total_weighted = 0
        total_weight = 0
        for criterion, config in RATING_CRITERIA.items():
            score = ratings.get(criterion, 50)
            total_weighted += score * config["weight"]
            total_weight += config["weight"]
        overall_score = total_weighted / total_weight if total_weight > 0 else 50.0
        
        # Get strength/weakness (handle neutral type)
        strength_vs = scenery_info.get("strong_vs", "")
        weakness_vs = scenery_info.get("weak_vs", "")
        if scenery_type == "neutral":
            weakness_vs = "all"  # Neutral is weak against all
        
        # Create minted photo with new fields
        photo = MintedPhoto(
            user_id=user_id,
            name=name,
            description=description,
            image_url=f"data:{mime_type};base64,{image_base64}",  # Full base64 data URL
            thumbnail_url=f"data:{mime_type};base64,{image_base64}",  # Same for thumbnail
            # Permanent minter metadata (transfers with photo)
            minted_by_user_id=user_id,
            minted_by_username=minter_username,
            scenery_type=scenery_type,
            light_type=light_type,
            strength_vs=strength_vs if strength_vs else "",
            weakness_vs=weakness_vs if weakness_vs else "",
            light_strength_vs=light_info["strong_vs"],
            light_weakness_vs=light_info["weak_vs"],
            ratings=ratings,
            category_values=category_values,
            overall_score=overall_score,
            base_dollar_value=base_dollar_value,
            dollar_value=dollar_value,
            has_face=has_face,
            face_detection_score=face_detection_score,
            selfie_match_score=0,
            selfie_match_completed=False,
            selfie_match_attempts=0,
            is_private=is_private,
            show_in_feed=show_in_feed and not is_private,
            album_id=album_id,
            level=1,
            stars=0,
            has_golden_frame=False,
            level_bonus_percent=0,
            # Stamina system
            current_stamina=24,
            max_stamina=24,
        )
        
        # Store photo data
        photo_dict = photo.model_dump()
        photo_dict["image_data"] = image_base64  # Also keep raw base64 for backward compatibility
        photo_dict["mime_type"] = mime_type  # Store mime type
        photo_dict["created_at"] = photo_dict["created_at"].isoformat()
        photo_dict["minted_at"] = photo_dict["minted_at"].isoformat()
        
        await self.db.minted_photos.insert_one(photo_dict)
        
        # Create mint transaction
        tx = MintTransaction(
            user_id=user_id,
            mint_id=photo.mint_id,
            mint_type="photo",
            bl_cost=MINT_COST_BL,
            transaction_hash=photo.transaction_hash,
        )
        tx_dict = tx.model_dump()
        tx_dict["created_at"] = tx_dict["created_at"].isoformat()
        await self.db.mint_transactions.insert_one(tx_dict)
        
        # Record BL transaction
        from referral_system import record_transaction, TransactionType, Currency
        await record_transaction(
            user_id=user_id,
            transaction_type=TransactionType.MINT_COST,
            currency=Currency.BL,
            amount=-MINT_COST_BL,
            reference_id=photo.mint_id,
            details={"type": "photo_mint", "name": name}
        )
        
        # Return without full image data
        result = photo.model_dump()
        result["analysis"] = {
            "scenery_type": scenery_type,
            "scenery_name": scenery_info["name"],
            "light_type": light_type,
            "light_name": light_info["name"],
            "strength_vs": scenery_info["strong_vs"],
            "weakness_vs": scenery_info["weak_vs"],
            "light_strength_vs": light_info["strong_vs"],
            "light_weakness_vs": light_info["weak_vs"],
            "has_face": has_face,
        }
        
        return {
            "success": True,
            "photo": result,
            "transaction_hash": photo.transaction_hash,
            "bl_spent": MINT_COST_BL,
        }
    
    async def get_user_photos(
        self, 
        user_id: str, 
        include_private: bool = False,
        album_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[Dict]:
        """Get user's minted photos"""
        query = {"user_id": user_id}
        
        if not include_private:
            query["is_private"] = False
        
        if album_id:
            query["album_id"] = album_id
        
        photos = await self.db.minted_photos.find(
            query,
            {"_id": 0, "image_data": 0, "image_url": 0}  # Exclude large base64 data
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Add lightweight image URL references
        for photo in photos:
            photo["image_url"] = f"/api/minting/photo/{photo.get('mint_id')}/image"
        
        return photos
    
    async def get_photo(self, mint_id: str, include_image: bool = False) -> Optional[Dict]:
        """Get a specific minted photo"""
        projection = {"_id": 0}
        if not include_image:
            projection["image_data"] = 0
        
        photo = await self.db.minted_photos.find_one(
            {"mint_id": mint_id},
            projection
        )
        return photo
    
    async def rename_photo(self, mint_id: str, user_id: str, new_name: str) -> Dict[str, Any]:
        """Rename a minted photo"""
        result = await self.db.minted_photos.update_one(
            {"mint_id": mint_id, "user_id": user_id},
            {"$set": {"name": new_name}}
        )
        
        if result.modified_count == 0:
            return {"success": False, "error": "Photo not found or not owned by user"}
        
        return {"success": True, "new_name": new_name}
    
    async def update_photo_privacy(
        self, 
        mint_id: str, 
        user_id: str, 
        is_private: bool,
        show_in_feed: bool
    ) -> Dict[str, Any]:
        """Update photo privacy settings"""
        result = await self.db.minted_photos.update_one(
            {"mint_id": mint_id, "user_id": user_id},
            {"$set": {
                "is_private": is_private,
                "show_in_feed": show_in_feed and not is_private
            }}
        )
        
        if result.modified_count == 0:
            return {"success": False, "error": "Photo not found or not owned by user"}
        
        return {"success": True}
    
    async def move_to_album(self, mint_id: str, user_id: str, album_id: str) -> Dict[str, Any]:
        """Move photo to an album"""
        # Verify album exists and belongs to user
        album = await self.db.photo_albums.find_one({
            "album_id": album_id,
            "user_id": user_id
        })
        
        if not album:
            return {"success": False, "error": "Album not found"}
        
        result = await self.db.minted_photos.update_one(
            {"mint_id": mint_id, "user_id": user_id},
            {"$set": {"album_id": album_id}}
        )
        
        if result.modified_count == 0:
            return {"success": False, "error": "Photo not found or not owned by user"}
        
        # Update album photo count
        await self.db.photo_albums.update_one(
            {"album_id": album_id},
            {"$inc": {"photo_count": 1}}
        )
        
        return {"success": True}


# ============== ALBUM SERVICE ==============
class AlbumService:
    """Service for managing photo albums"""
    
    def __init__(self, db):
        self.db = db
    
    async def create_album(
        self,
        user_id: str,
        name: str,
        description: str = "",
        is_private: bool = False
    ) -> Dict[str, Any]:
        """Create a new album"""
        album = PhotoAlbum(
            user_id=user_id,
            name=name,
            description=description,
            is_private=is_private,
        )
        
        album_dict = album.model_dump()
        album_dict["created_at"] = album_dict["created_at"].isoformat()
        await self.db.photo_albums.insert_one(album_dict)
        
        return {"success": True, "album": album_dict}
    
    async def get_user_albums(self, user_id: str, include_private: bool = False) -> List[Dict]:
        """Get user's albums"""
        query = {"user_id": user_id}
        if not include_private:
            query["is_private"] = False
        
        albums = await self.db.photo_albums.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        return albums
    
    async def rename_album(self, album_id: str, user_id: str, new_name: str) -> Dict[str, Any]:
        """Rename an album"""
        result = await self.db.photo_albums.update_one(
            {"album_id": album_id, "user_id": user_id},
            {"$set": {"name": new_name}}
        )
        
        if result.modified_count == 0:
            return {"success": False, "error": "Album not found"}
        
        return {"success": True}
    
    async def delete_album(self, album_id: str, user_id: str) -> Dict[str, Any]:
        """Delete an album (photos are not deleted, just unassigned)"""
        # Unassign photos from album
        await self.db.minted_photos.update_many(
            {"album_id": album_id, "user_id": user_id},
            {"$set": {"album_id": None}}
        )
        
        # Delete album
        result = await self.db.photo_albums.delete_one({
            "album_id": album_id,
            "user_id": user_id
        })
        
        if result.deleted_count == 0:
            return {"success": False, "error": "Album not found"}
        
        return {"success": True}


# Initialize services (will be set up in routes)
minting_service: Optional[MintingService] = None
album_service: Optional[AlbumService] = None


def init_minting_services(db):
    """Initialize minting services with database"""
    global minting_service, album_service
    minting_service = MintingService(db)
    album_service = AlbumService(db)
    return minting_service, album_service
