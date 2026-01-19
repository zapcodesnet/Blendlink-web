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
DAILY_MINT_LIMIT = 3  # Max mints per day (free tier)
SUBSCRIPTION_LIMITS = {
    "free": 3,
    "basic": 20,  # $4.99/month
    "premium": 50,  # $9.99/month
}

# Scenery types and their strength/weakness relationships
SCENERY_TYPES = {
    "natural": {"name": "Natural Scenery", "strong_vs": "water", "weak_vs": "manmade"},
    "water": {"name": "Water Scenery", "strong_vs": "manmade", "weak_vs": "natural"},
    "manmade": {"name": "Man-made/Mixed", "strong_vs": "natural", "weak_vs": "water"},
}

# Light condition types and their strength/weakness relationships
LIGHT_TYPES = {
    "sunlight_fire": {"name": "Sunlight/Fire", "strong_vs": "darkness_night", "weak_vs": "rain_snow_ice"},
    "rain_snow_ice": {"name": "Rain/Snow/Ice", "strong_vs": "sunlight_fire", "weak_vs": "darkness_night"},
    "darkness_night": {"name": "Darkness/Night/Interior", "strong_vs": "rain_snow_ice", "weak_vs": "sunlight_fire"},
}

# Photo rating criteria with weights (totals 100%)
RATING_CRITERIA = {
    "originality": 12,
    "innovation": 12, 
    "uniqueness": 12,
    "focus_sharpness": 10,
    "exposure_tonal_range": 10,
    "color_accuracy": 8,
    "subject_clarity": 8,
    "composition": 10,
    "narrative_emotion": 10,
    "captivating_mesmerizing": 8,
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
    scenery_type: str = "natural"  # natural, water, manmade
    light_type: str = "sunlight_fire"  # sunlight_fire, rain_snow_ice, darkness_night
    strength_vs: str = ""
    weakness_vs: str = ""
    light_strength_vs: str = ""
    light_weakness_vs: str = ""
    
    # Rating scores (1-100 scale)
    ratings: Dict[str, int] = Field(default_factory=dict)
    overall_score: float = 0.0
    
    # Dollar value ($1M to $1B based on ratings)
    dollar_value: int = 1000000
    
    # Bonuses
    has_face: bool = False
    face_bonus_percent: int = 0  # +10% if face detected
    selfie_bonus_percent: int = 0  # +1% to +20% hidden bonus
    
    # Power & XP
    power: float = 100.0
    xp: int = 0
    level: int = 1
    
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
        chat = LlmChat(
            api_key=api_key,
            session_id=f"photo_analysis_{uuid.uuid4().hex[:8]}",
            system_message="""You are an expert photo analyst for a gaming platform. 
Analyze photos and provide structured ratings. Be fair but varied in your assessments.
Return ONLY valid JSON without any markdown formatting or code blocks."""
        ).with_model("openai", "gpt-4o")
        
        # Create image content with proper data URL format
        image_data_url = f"data:{mime_type};base64,{image_base64}"
        image_content = ImageContent(image_base64=image_data_url)
        
        analysis_prompt = """Analyze this photo and return a JSON object with these exact fields:

{
  "scenery_type": "natural" or "water" or "manmade",
  "light_type": "sunlight_fire" or "rain_snow_ice" or "darkness_night",
  "scenery_description": "brief description of dominant background",
  "light_description": "brief description of lighting conditions",
  "has_face": true/false,
  "face_count": number,
  "ratings": {
    "originality": 1-100,
    "innovation": 1-100,
    "uniqueness": 1-100,
    "focus_sharpness": 1-100,
    "exposure_tonal_range": 1-100,
    "color_accuracy": 1-100,
    "subject_clarity": 1-100,
    "composition": 1-100,
    "narrative_emotion": 1-100,
    "captivating_mesmerizing": 1-100
  }
}

Scenery types:
- "natural": landscapes, forests, mountains, gardens, macro nature, animals
- "water": oceans, waterfalls, rivers, lakes, rain, underwater, beaches
- "manmade": cities, buildings, streets, interiors, vehicles, tech, urban

Light types:
- "sunlight_fire": bright daylight, golden hour, fire, warm artificial light
- "rain_snow_ice": rain, snow, ice, fog, overcast, cold weather
- "darkness_night": night scenes, dark interiors, low light, shadows

Be generous but realistic. Most photos should score 40-80 range.
Exceptional photos can score 80-95.
Return ONLY the JSON object, no other text."""

        user_message = UserMessage(
            text=analysis_prompt,
            image_contents=[image_content]
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
            
        if "ratings" not in result:
            result["ratings"] = {criterion: random.randint(50, 75) for criterion in RATING_CRITERIA.keys()}
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
    Calculate dollar value based on ratings
    Range: $1M to $1B
    """
    # Average rating (1-100)
    avg_rating = sum(ratings.values()) / len(ratings) if ratings else 50
    
    # Base value: exponential scale from $1M to $1B
    # Rating 50 = ~$10M, Rating 100 = $1B
    base_value = int(1_000_000 * (2 ** (avg_rating / 10)))
    
    # Cap at $1B
    base_value = min(base_value, 1_000_000_000)
    
    # Face bonus (+10%)
    if has_face:
        base_value = int(base_value * 1.10)
    
    # Selfie bonus (+1% to +20%)
    if selfie_bonus > 0:
        base_value = int(base_value * (1 + selfie_bonus / 100))
    
    return base_value


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
        
        # Calculate dollar value
        ratings = analysis.get("ratings", {})
        has_face = analysis.get("has_face", False)
        selfie_bonus = random.randint(1, 20) if has_face else 0  # Hidden bonus
        dollar_value = calculate_dollar_value(ratings, has_face, selfie_bonus)
        
        # Calculate overall score
        overall_score = sum(ratings.values()) / len(ratings) if ratings else 50.0
        
        # Create minted photo
        photo = MintedPhoto(
            user_id=user_id,
            name=name,
            description=description,
            image_url=f"data:{mime_type};base64,{image_base64[:100]}...",  # Store reference
            scenery_type=scenery_type,
            strength_vs=scenery_info["strong_vs"],
            weakness_vs=scenery_info["weak_vs"],
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
        
        # Store full image data
        photo_dict = photo.model_dump()
        photo_dict["image_data"] = image_base64  # Full base64 image
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
            "strength_vs": scenery_info["strong_vs"],
            "weakness_vs": scenery_info["weak_vs"],
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
