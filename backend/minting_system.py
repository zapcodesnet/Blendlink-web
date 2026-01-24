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
MINT_COST_BL = 500  # BL coins per mint
DAILY_MINT_LIMIT = 10  # Max mints per day (free tier)
SUBSCRIPTION_LIMITS = {
    "free": 10,
    "basic": 20,  # $4.99/month
    "premium": 50,  # $9.99/month
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

# Level/Star bonuses for Dollar Value
LEVEL_BONUSES = {
    10: {"stars": 1, "bonus_percent": 20},   # Level 10: 1 star +20%
    20: {"stars": 2, "bonus_percent": 40},   # Level 20: 2 stars +40% (cumulative)
    30: {"stars": 3, "bonus_percent": 60},   # Level 30: 3 stars +60%
    40: {"stars": 4, "bonus_percent": 80},   # Level 40: 4 stars +80%
    50: {"stars": 5, "bonus_percent": 100},  # Level 50: 5 stars +100%
    60: {"stars": 5, "bonus_percent": 150, "golden_frame": True},  # Level 60 (max): 5 stars + golden frame +150%
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
    # Total Dollar value (includes level bonuses and upgrades)
    dollar_value: int = 1_000_000
    # Dollar value upgrades purchased with BL coins
    upgrades_purchased: List[int] = Field(default_factory=list)
    total_upgrade_value: int = 0
    
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
    
    # Photo stamina for battles (100% = 24 battles)
    stamina: float = 100.0
    last_battle_at: Optional[datetime] = None
    
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
    scenery = random.choice(["natural", "water", "manmade"])
    light = random.choice(["sunlight_fire", "rain_snow_ice", "darkness_night"])
    return {
        "scenery_type": scenery,
        "light_type": light,
        "scenery_description": "Unable to analyze - using default",
        "light_description": "Unable to analyze - using default",
        "has_face": random.random() > 0.7,
        "face_count": 1 if random.random() > 0.7 else 0,
        "ratings": {
            criterion: random.randint(50, 85) for criterion in RATING_CRITERIA.keys()
        }
    }


def calculate_dollar_value(ratings: Dict[str, int], has_face: bool, selfie_bonus: int = 0) -> int:
    """
    Calculate dollar value based on weighted ratings
    Range: $1M to $1B
    
    Weights:
    - Originality (12%), Innovation (12%), Uniqueness (12%)
    - Focus/Sharpness (10%), Exposure/Tonal Range (10%), Composition (10%), Narrative/Emotion (10%)
    - Color Accuracy (8%), Subject Clarity (8%), Captivating/Mesmerizing (8%)
    """
    if not ratings:
        return 1_000_000
    
    # Calculate weighted average
    total_weighted = 0
    total_weight = 0
    
    for criterion, weight in RATING_CRITERIA.items():
        if criterion in ratings:
            total_weighted += ratings[criterion] * weight
            total_weight += weight
    
    avg_rating = total_weighted / total_weight if total_weight > 0 else 50
    
    # Base value: exponential scale from $1M to $1B
    # Rating 50 = ~$10M, Rating 100 = $1B
    base_value = int(1_000_000 * (2 ** (avg_rating / 10)))
    
    # Cap at $1B
    base_value = min(base_value, 1_000_000_000)
    
    # Face bonus (+10%)
    if has_face:
        base_value = int(base_value * 1.10)
    
    # Selfie bonus (+1% to +20%, hidden)
    if selfie_bonus > 0:
        base_value = int(base_value * (1 + selfie_bonus / 100))
    
    # Final cap at $1B
    return min(base_value, 1_000_000_000)


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
        
        # Check BL coins
        bl_coins = user.get("bl_coins", 0)
        if bl_coins < MINT_COST_BL:
            return {
                "can_mint": False, 
                "reason": f"Insufficient BL coins. Need {MINT_COST_BL}, have {bl_coins}",
                "bl_needed": MINT_COST_BL - bl_coins
            }
        
        # Check daily limit
        subscription = user.get("subscription_tier", "free")
        daily_limit = SUBSCRIPTION_LIMITS.get(subscription, 3)
        
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
                "daily_limit": daily_limit
            }
        
        return {
            "can_mint": True,
            "bl_coins": bl_coins,
            "mints_today": mints_today,
            "daily_limit": daily_limit,
            "remaining_mints": daily_limit - mints_today
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
        
        # Calculate dollar value
        ratings = analysis.get("ratings", {})
        has_face = analysis.get("has_face", False)
        selfie_bonus = random.randint(1, 20) if has_face else 0  # Hidden bonus
        dollar_value = calculate_dollar_value(ratings, has_face, selfie_bonus)
        
        # Calculate overall score (weighted average)
        total_weighted = sum(ratings.get(c, 50) * w for c, w in RATING_CRITERIA.items())
        total_weight = sum(RATING_CRITERIA.values())
        overall_score = total_weighted / total_weight if total_weight > 0 else 50.0
        
        # Create minted photo
        photo = MintedPhoto(
            user_id=user_id,
            name=name,
            description=description,
            image_url=f"data:{mime_type};base64,{image_base64}",  # Full base64 data URL
            thumbnail_url=f"data:{mime_type};base64,{image_base64}",  # Same for thumbnail
            scenery_type=scenery_type,
            light_type=light_type,
            strength_vs=scenery_info["strong_vs"],
            weakness_vs=scenery_info["weak_vs"],
            light_strength_vs=light_info["strong_vs"],
            light_weakness_vs=light_info["weak_vs"],
            ratings=ratings,
            overall_score=overall_score,
            dollar_value=dollar_value,
            has_face=has_face,
            face_bonus_percent=10 if has_face else 0,
            selfie_bonus_percent=selfie_bonus,
            is_private=is_private,
            show_in_feed=show_in_feed and not is_private,
            album_id=album_id,
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
            {"_id": 0, "image_data": 0}  # Exclude full image data
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
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
