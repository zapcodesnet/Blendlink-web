"""
Blendlink Internal Minting API Routes
- Photo/Video/Music minting
- Album management
- AI photo analysis
"""

import base64
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from pydantic import BaseModel
from typing import Optional, List
import logging

from minting_system import (
    init_minting_services,
    MintingService,
    AlbumService,
    MINT_COST_BL,
    DAILY_MINT_LIMIT,
    SUBSCRIPTION_LIMITS,
    SCENERY_TYPES,
    LIGHT_TYPES,
    RATING_CRITERIA,
    UPGRADE_COSTS,
    LEVEL_BONUSES,
    calculate_dollar_value,
    get_level_stars,
    # New stat calculation functions
    calculate_total_dollar_value,
    calculate_age_bonus,
    calculate_star_bonus,
    calculate_reaction_bonus,
    calculate_seniority_bonus,
    get_xp_to_next_level,
    STAR_MILESTONES,
    SENIORITY_MAX_LEVEL,
)

logger = logging.getLogger(__name__)

# Router
minting_router = APIRouter(prefix="/minting", tags=["Minting"])

# Services will be initialized when routes are included
_minting_service: Optional[MintingService] = None
_album_service: Optional[AlbumService] = None
_db = None


def setup_minting_routes(db):
    """Initialize minting services with database connection"""
    global _minting_service, _album_service, _db
    _minting_service, _album_service = init_minting_services(db)
    _db = db
    logger.info("Minting services initialized")


async def get_current_user_from_request(request: Request) -> dict:
    """Get current user from request"""
    from server import get_current_user
    return await get_current_user(request)


# ============== REQUEST/RESPONSE MODELS ==============
class MintPhotoRequest(BaseModel):
    name: str
    description: str = ""
    image_base64: str
    mime_type: str = "image/jpeg"
    is_private: bool = False
    show_in_feed: bool = True
    album_id: Optional[str] = None


class RenamePhotoRequest(BaseModel):
    new_name: str


class UpdatePrivacyRequest(BaseModel):
    is_private: bool
    show_in_feed: bool = True


class MoveToAlbumRequest(BaseModel):
    album_id: str


class CreateAlbumRequest(BaseModel):
    name: str
    description: str = ""
    is_private: bool = False


class RenameAlbumRequest(BaseModel):
    new_name: str


# ============== MINTING ROUTES ==============
@minting_router.get("/config")
async def get_minting_config():
    """Get minting configuration"""
    return {
        "mint_cost_bl": MINT_COST_BL,
        "daily_limits": SUBSCRIPTION_LIMITS,
        "scenery_types": SCENERY_TYPES,
        "light_types": LIGHT_TYPES,
        "rating_criteria": RATING_CRITERIA,
        "supported_types": ["photo", "video", "music"],
    }


@minting_router.get("/status")
async def get_mint_status(current_user: dict = Depends(get_current_user_from_request)):
    """Check if user can mint and their current status"""
    if not _minting_service:
        raise HTTPException(status_code=500, detail="Minting service not initialized")
    
    return await _minting_service.check_can_mint(current_user["user_id"])


@minting_router.post("/photo")
async def mint_photo(
    data: MintPhotoRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Mint a new photo collectible
    
    - Costs 500 BL coins
    - Daily limit applies based on subscription
    - AI analyzes photo for stats
    """
    if not _minting_service:
        raise HTTPException(status_code=500, detail="Minting service not initialized")
    
    result = await _minting_service.mint_photo(
        user_id=current_user["user_id"],
        image_base64=data.image_base64,
        name=data.name,
        description=data.description,
        is_private=data.is_private,
        show_in_feed=data.show_in_feed,
        album_id=data.album_id,
        mime_type=data.mime_type,
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Minting failed"))
    
    return result


@minting_router.post("/photo/upload")
async def mint_photo_upload(
    name: str = Form(...),
    description: str = Form(""),
    is_private: str = Form("false"),  # Accept as string, convert below
    show_in_feed: str = Form("true"),  # Accept as string, convert below
    album_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Mint a photo from file upload
    """
    if not _minting_service:
        raise HTTPException(status_code=500, detail="Minting service not initialized")
    
    # Convert string booleans to actual booleans
    is_private_bool = str(is_private).lower() in ('true', '1', 'yes')
    show_in_feed_bool = str(show_in_feed).lower() in ('true', '1', 'yes')
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif"]
    content_type = file.content_type or "image/jpeg"
    if content_type not in allowed_types:
        logger.error(f"Unsupported image type: {content_type}")
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported image type: {content_type}. Allowed: {', '.join(allowed_types)}"
        )
    
    # Read file
    try:
        content = await file.read()
        logger.info(f"File uploaded: {file.filename}, size: {len(content)} bytes, type: {content_type}")
    except Exception as e:
        logger.error(f"Failed to read file: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")
    
    if len(content) > 60 * 1024 * 1024:  # 60MB limit
        raise HTTPException(status_code=400, detail="Image too large. Max 60MB.")
    
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded")
    
    # Resize large images to prevent MongoDB BSON size limit (16MB)
    # If base64 would exceed ~10MB, resize the image
    from PIL import Image
    import io
    
    MAX_BASE64_SIZE = 10 * 1024 * 1024  # 10MB base64 limit (leaves room for other document fields)
    MAX_DIMENSION = 2048  # Max width or height
    
    try:
        img = Image.open(io.BytesIO(content))
        original_format = img.format or 'JPEG'
        
        # IMPORTANT: Preserve original orientation from EXIF data
        # This prevents landscape/portrait orientation from being lost
        try:
            from PIL import ExifTags
            exif = img._getexif()
            if exif is not None:
                for orientation in ExifTags.TAGS.keys():
                    if ExifTags.TAGS[orientation] == 'Orientation':
                        break
                exif_orientation = exif.get(orientation)
                if exif_orientation:
                    # Apply orientation transformation to match EXIF
                    if exif_orientation == 2:
                        img = img.transpose(Image.FLIP_LEFT_RIGHT)
                    elif exif_orientation == 3:
                        img = img.rotate(180)
                    elif exif_orientation == 4:
                        img = img.transpose(Image.FLIP_TOP_BOTTOM)
                    elif exif_orientation == 5:
                        img = img.rotate(-90, expand=True).transpose(Image.FLIP_LEFT_RIGHT)
                    elif exif_orientation == 6:
                        img = img.rotate(-90, expand=True)
                    elif exif_orientation == 7:
                        img = img.rotate(90, expand=True).transpose(Image.FLIP_LEFT_RIGHT)
                    elif exif_orientation == 8:
                        img = img.rotate(90, expand=True)
                    logger.info(f"Applied EXIF orientation correction: {exif_orientation}")
        except (AttributeError, KeyError, IndexError) as e:
            logger.debug(f"No EXIF orientation data found: {e}")
            pass
        
        # Convert RGBA to RGB for JPEG
        if img.mode == 'RGBA' and content_type == 'image/jpeg':
            img = img.convert('RGB')
        
        # Check if resize needed
        needs_resize = False
        width, height = img.size
        
        # Resize if dimensions too large
        if width > MAX_DIMENSION or height > MAX_DIMENSION:
            needs_resize = True
            ratio = min(MAX_DIMENSION / width, MAX_DIMENSION / height)
            new_width = int(width * ratio)
            new_height = int(height * ratio)
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            logger.info(f"Resized image from {width}x{height} to {new_width}x{new_height}")
        
        # Check estimated base64 size (base64 is ~4/3 of binary size)
        estimated_base64_size = len(content) * 4 / 3
        
        # If too large, compress with lower quality
        if estimated_base64_size > MAX_BASE64_SIZE or needs_resize:
            buffer = io.BytesIO()
            
            # Determine output format
            if content_type == 'image/png':
                # Convert large PNGs to JPEG for better compression
                if estimated_base64_size > MAX_BASE64_SIZE:
                    if img.mode == 'RGBA':
                        img = img.convert('RGB')
                    img.save(buffer, format='JPEG', quality=85, optimize=True)
                    content_type = 'image/jpeg'
                else:
                    img.save(buffer, format='PNG', optimize=True)
            else:
                # JPEG - use quality based on size
                quality = 85 if estimated_base64_size < MAX_BASE64_SIZE * 2 else 70
                if img.mode == 'RGBA':
                    img = img.convert('RGB')
                img.save(buffer, format='JPEG', quality=quality, optimize=True)
                content_type = 'image/jpeg'
            
            content = buffer.getvalue()
            logger.info(f"Compressed image to {len(content)} bytes")
    except Exception as e:
        logger.warning(f"Image processing failed, using original: {e}")
        # Continue with original content if processing fails
    
    image_base64 = base64.b64encode(content).decode("utf-8")
    
    # Final check - if still too large, reject
    if len(image_base64) > 12 * 1024 * 1024:  # 12MB base64 hard limit
        raise HTTPException(
            status_code=400, 
            detail="Image too large after compression. Please use a smaller image (under 5MB recommended)."
        )
    
    try:
        result = await _minting_service.mint_photo(
            user_id=current_user["user_id"],
            image_base64=image_base64,
            name=name,
            description=description,
            is_private=is_private_bool,
            show_in_feed=show_in_feed_bool,
            album_id=album_id,
            mime_type=content_type,
        )
    except Exception as e:
        logger.error(f"Minting service error: {e}")
        raise HTTPException(status_code=500, detail=f"Minting failed: {str(e)}")
    
    if not result.get("success"):
        error_msg = result.get("error", "Minting failed")
        logger.error(f"Minting failed: {error_msg}")
        raise HTTPException(status_code=400, detail=error_msg)
    
    logger.info(f"Photo minted successfully: {result.get('photo', {}).get('mint_id')}")
    
    # Reset AI transformation session after successful mint
    try:
        from ai_photo_transform import on_mint_success
        await on_mint_success(current_user["user_id"])
    except Exception as e:
        logger.warning(f"Failed to reset AI transform session: {e}")
    
    return result


@minting_router.get("/photos")
async def get_my_photos(
    album_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Get current user's minted photos"""
    if not _minting_service:
        raise HTTPException(status_code=500, detail="Minting service not initialized")
    
    photos = await _minting_service.get_user_photos(
        user_id=current_user["user_id"],
        include_private=True,  # User can see their own private photos
        album_id=album_id,
        skip=skip,
        limit=limit,
    )
    
    return {"photos": photos, "count": len(photos)}


# ============== UPGRADE & ENHANCEMENT ROUTES ==============

class UpgradeDollarValueRequest(BaseModel):
    upgrade_amount: int  # Dollar amount to upgrade by (e.g., 1000000 for $1M)


@minting_router.post("/photos/{mint_id}/upgrade")
async def upgrade_photo_dollar_value(
    mint_id: str,
    data: UpgradeDollarValueRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Upgrade a photo's Dollar Value using BL coins.
    Cost: $1M = 1M BL, $10M = 10M BL, etc.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Verify photo ownership
    photo = await _db.minted_photos.find_one(
        {"mint_id": mint_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found or does not belong to you")
    
    # Validate upgrade amount
    upgrade_amount = data.upgrade_amount
    if upgrade_amount not in UPGRADE_COSTS:
        valid_amounts = sorted(UPGRADE_COSTS.keys())
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid upgrade amount. Valid amounts: {[f'${a:,}' for a in valid_amounts]}"
        )
    
    # Check if this upgrade tier was already purchased
    upgrades_purchased = photo.get("upgrades_purchased", [])
    if upgrade_amount in upgrades_purchased:
        raise HTTPException(
            status_code=400, 
            detail=f"You've already purchased the ${upgrade_amount:,} upgrade for this photo"
        )
    
    # Check BL coin balance
    bl_cost = UPGRADE_COSTS[upgrade_amount]
    user = await _db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if user.get("bl_coins", 0) < bl_cost:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient BL coins. Need {bl_cost:,} BL, have {user.get('bl_coins', 0):,} BL"
        )
    
    # Deduct BL coins
    await _db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"bl_coins": -bl_cost}}
    )
    
    # Update photo
    new_total_upgrade = photo.get("total_upgrade_value", 0) + upgrade_amount
    new_dollar_value = photo.get("base_dollar_value", photo.get("dollar_value", 1000000)) + \
                       photo.get("level_bonus_percent", 0) * photo.get("base_dollar_value", 1000000) // 100 + \
                       new_total_upgrade
    
    await _db.minted_photos.update_one(
        {"mint_id": mint_id},
        {
            "$push": {"upgrades_purchased": upgrade_amount},
            "$set": {
                "total_upgrade_value": new_total_upgrade,
                "dollar_value": new_dollar_value
            }
        }
    )
    
    return {
        "success": True,
        "upgrade_amount": upgrade_amount,
        "bl_spent": bl_cost,
        "new_dollar_value": new_dollar_value,
        "total_upgrades": new_total_upgrade
    }


@minting_router.get("/photos/{mint_id}/upgrade-options")
async def get_upgrade_options(
    mint_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Get available upgrade options for a photo"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    photo = await _db.minted_photos.find_one(
        {"mint_id": mint_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    upgrades_purchased = photo.get("upgrades_purchased", [])
    user = await _db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    bl_balance = user.get("bl_coins", 0)
    
    options = []
    for amount, cost in sorted(UPGRADE_COSTS.items()):
        options.append({
            "upgrade_amount": amount,
            "bl_cost": cost,
            "already_purchased": amount in upgrades_purchased,
            "can_afford": bl_balance >= cost
        })
    
    return {
        "current_dollar_value": photo.get("dollar_value", 0),
        "base_dollar_value": photo.get("base_dollar_value", photo.get("dollar_value", 0)),
        "total_upgrades": photo.get("total_upgrade_value", 0),
        "bl_balance": bl_balance,
        "options": options
    }


@minting_router.get("/rating-criteria")
async def get_rating_criteria():
    """Get the 11-category rating criteria with weights and max values"""
    from minting_system import RATING_CRITERIA
    
    criteria = []
    for key, config in RATING_CRITERIA.items():
        criteria.append({
            "key": key,
            "label": config["label"],
            "description": config["description"],
            "weight": config["weight"],
            "max_value": config["max_value"]
        })
    
    return {
        "criteria": criteria,
        "total_weight": 100,
        "max_total_value": 1_000_000_000
    }


@minting_router.get("/level-bonuses")
async def get_level_bonuses():
    """Get level milestone bonuses"""
    bonuses = []
    for level, config in sorted(LEVEL_BONUSES.items()):
        bonuses.append({
            "level": level,
            "stars": config["stars"],
            "bonus_percent": config["bonus_percent"],
            "has_golden_frame": config.get("golden_frame", False)
        })
    
    return {"bonuses": bonuses}


@minting_router.get("/photos/{mint_id}/full-stats")
async def get_photo_full_stats(
    mint_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Get complete photo stats with ALL real-time calculated bonuses.
    This returns everything needed for the back-of-card display.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    photo = await _db.minted_photos.find_one(
        {"mint_id": mint_id},
        {"_id": 0}
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Calculate all bonuses in real-time
    total_stats = calculate_total_dollar_value(photo)
    
    # Get minter info
    minter = await _db.users.find_one(
        {"user_id": photo.get("minted_by", photo.get("user_id"))},
        {"_id": 0, "username": 1, "profile_picture": 1}
    )
    
    # Win/Loss streak data
    win_streak = photo.get("win_streak", 0)
    lose_streak = photo.get("lose_streak", 0)
    
    # Streak multipliers (from existing mechanics)
    streak_multipliers = {
        3: 1.25, 4: 1.50, 5: 1.75, 6: 2.00,
        7: 2.25, 8: 2.50, 9: 2.75, 10: 3.00
    }
    current_streak_multiplier = 1.0
    if win_streak >= 3:
        current_streak_multiplier = streak_multipliers.get(min(win_streak, 10), 1.0)
    
    # Has lose streak immunity (3+ losses = immunity to stronger scenery)
    has_immunity = lose_streak >= 3
    
    return {
        "mint_id": mint_id,
        "name": photo.get("name", ""),
        "image_url": photo.get("image_url", ""),
        
        # Minter info (permanent)
        "minted_by": {
            "user_id": photo.get("minted_by", photo.get("user_id")),
            "username": minter.get("username") if minter else "Unknown",
            "profile_picture": minter.get("profile_picture") if minter else None
        },
        "minted_at": photo.get("minted_at"),
        
        # Core Power / Dollar Value
        "base_dollar_value": total_stats["base_dollar_value"],
        "total_dollar_value": total_stats["total_dollar_value"],
        
        # Level & XP (for XP meter)
        "level": total_stats["level"],
        "xp": total_stats["xp"],
        "xp_progress": total_stats["xp_progress"],
        
        # Stars
        "stars": total_stats["stars"],
        "has_golden_frame": total_stats["has_golden_frame"],
        
        # All bonuses breakdown
        "bonuses": total_stats["bonuses"],
        
        # Scenery & battle stats
        "scenery_type": photo.get("scenery_type", "neutral"),
        "scenery_description": photo.get("scenery_description", ""),
        
        # Streaks
        "win_streak": win_streak,
        "lose_streak": lose_streak,
        "highest_win_streak": photo.get("highest_win_streak", 0),
        "streak_multiplier": current_streak_multiplier,
        "has_immunity": has_immunity,
        
        # Stamina
        "battles_remaining": photo.get("battles_remaining", 24),
        "max_battles": 24,
        "stamina_regen_per_hour": 1,
        
        # Reactions (total from all sources)
        "total_reactions": photo.get("total_reactions", 0),
        
        # BL Coins spent
        "bl_coins_spent": photo.get("bl_coins_spent", 0),
        "total_upgrade_value": photo.get("total_upgrade_value", 0),
        
        # Authenticity
        "authenticity": {
            "face_detection_bonus": photo.get("face_bonus_percent", 0),
            "selfie_match_bonus": photo.get("selfie_bonus_percent", 0),
            "total_authenticity_percent": photo.get("face_bonus_percent", 0) + photo.get("selfie_bonus_percent", 0)
        },
        
        # Seniority info
        "seniority": {
            "level": total_stats["level"],
            "is_max_level": total_stats["level"] >= SENIORITY_MAX_LEVEL,
            "levels_to_seniority": max(0, SENIORITY_MAX_LEVEL - total_stats["level"]),
            "has_golden_frame": total_stats["has_golden_frame"]
        },
        
        # Rating breakdown (AI scores)
        "ratings": photo.get("ratings", {}),
        
        # Star milestones info
        "star_milestones": STAR_MILESTONES
    }


@minting_router.get("/minting-config")
async def get_minting_config():
    """Get minting configuration including fees and limits"""
    return {
        "mint_cost_bl": MINT_COST_BL,
        "daily_limit_free": DAILY_MINT_LIMIT,
        "subscription_limits": SUBSCRIPTION_LIMITS,
        "scenery_types": list(SCENERY_TYPES.keys()),
        "light_types": list(LIGHT_TYPES.keys()),
        "star_milestones": STAR_MILESTONES,
        "max_seniority_level": SENIORITY_MAX_LEVEL
    }


@minting_router.delete("/photos/{mint_id}")
async def delete_minted_photo(
    mint_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Permanently delete a minted photo"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Verify ownership
    photo = await _db.minted_photos.find_one(
        {"mint_id": mint_id, "user_id": current_user["user_id"]},
        {"_id": 0, "mint_id": 1}
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found or does not belong to you")
    
    # Delete the photo
    result = await _db.minted_photos.delete_one({"mint_id": mint_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=500, detail="Failed to delete photo")
    
    return {"success": True, "message": "Photo permanently deleted", "mint_id": mint_id}


@minting_router.get("/photos/user/{user_id}")
async def get_user_photos(
    user_id: str,
    album_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
):
    """Get another user's public minted photos"""
    if not _minting_service:
        raise HTTPException(status_code=500, detail="Minting service not initialized")
    
    photos = await _minting_service.get_user_photos(
        user_id=user_id,
        include_private=False,  # Only public photos
        album_id=album_id,
        skip=skip,
        limit=limit,
    )
    
    return {"photos": photos, "count": len(photos)}


@minting_router.get("/photo/{mint_id}")
async def get_photo(mint_id: str):
    """Get a specific minted photo"""
    if not _minting_service:
        raise HTTPException(status_code=500, detail="Minting service not initialized")
    
    photo = await _minting_service.get_photo(mint_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    return photo


@minting_router.get("/photo/{mint_id}/full-stats")
async def get_photo_full_stats(mint_id: str, current_user: dict = Depends(get_current_user_from_request)):
    """
    Get complete photo stats for synchronization across all pages.
    Returns all attributes needed for unified display INCLUDING new progression stats:
    - Stars, Level, Age, Reactions, BL Coins, Seniority
    - XP meter bar with progress percentage
    - All real-time calculated bonuses
    """
    from datetime import datetime, timezone
    
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    photo = await _db.minted_photos.find_one(
        {"mint_id": mint_id},
        {"_id": 0, "image_data": 0}  # Exclude large image data
    )
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Get user's subscription for XP multiplier
    user_subscription = None
    if current_user:
        user_sub = await _db.subscriptions.find_one(
            {"user_id": current_user["user_id"], "status": "active"},
            {"_id": 0}
        )
        if user_sub:
            try:
                from subscription_tiers import SUBSCRIPTION_TIERS
                tier = user_sub.get("tier", "free")
                tier_info = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])
                user_subscription = {
                    "tier": tier,
                    "xp_multiplier": tier_info.get("xp_multiplier", 1),
                    "name": tier_info.get("name", "Free"),
                }
            except:
                pass
    
    # Calculate derived values
    level = photo.get("level", 1)
    xp = photo.get("xp", 0)
    level_info = get_level_stars(level)
    stars = photo.get("stars", 0) or level_info.get("stars", 0)
    has_golden_frame = level_info.get("has_golden_frame", False) or level >= 60
    level_bonus_percent = photo.get("level_bonus_percent", 0) or level_info.get("bonus_percent", 0)
    
    # ========== REAL-TIME CALCULATED BONUSES ==========
    
    # Get minted_at timestamp
    minted_at = photo.get("minted_at") or photo.get("created_at")
    if isinstance(minted_at, str):
        try:
            minted_at = datetime.fromisoformat(minted_at.replace("Z", "+00:00"))
        except:
            minted_at = datetime.now(timezone.utc)
    if minted_at is None:
        minted_at = datetime.now(timezone.utc)
    if minted_at.tzinfo is None:
        minted_at = minted_at.replace(tzinfo=timezone.utc)
    
    base_dollar_value = photo.get("base_dollar_value", 1_000_000)
    total_reactions = photo.get("total_reactions", 0)
    reaction_milestone_count = photo.get("reaction_milestone_count", 0)
    
    # 1. Calculate Age Bonus (+$1M every 30 days automatically)
    age_bonus_data = calculate_age_bonus(minted_at)
    age_days = age_bonus_data["days_old"]
    age_bonus_value = age_bonus_data["age_bonus_value"]
    age_cycles = age_bonus_data["cycles_completed"]
    days_until_next_age_bonus = age_bonus_data["days_until_next_bonus"]
    
    # 2. Calculate Star Bonus (+$1M + 10% per star milestone)
    star_bonus_data = calculate_star_bonus(level, base_dollar_value)
    star_bonus_value = star_bonus_data["total_star_bonus"]
    star_milestones_achieved = star_bonus_data["milestones_achieved"]
    
    # 3. Calculate Reaction Bonus (+$1M per 100 reactions)
    reaction_bonus_data = calculate_reaction_bonus(total_reactions, reaction_milestone_count)
    reaction_bonus_value = reaction_bonus_data["reaction_bonus_value"]
    reactions_since_last_milestone = reaction_bonus_data["reactions_since_last_milestone"]
    reactions_to_next_bonus = reaction_bonus_data["reactions_to_next_bonus"]
    
    # 4. Calculate Seniority Bonus (Level 60: +$1M + 20%)
    # For seniority, we need the running total before seniority
    running_total = base_dollar_value + photo.get("total_upgrade_value", 0) + age_bonus_value + star_bonus_value + reaction_bonus_value
    seniority_bonus_data = calculate_seniority_bonus(level, running_total)
    seniority_bonus_value = seniority_bonus_data.get("seniority_bonus", 0)
    seniority_achieved = seniority_bonus_data.get("seniority_achieved", False)
    levels_to_seniority = seniority_bonus_data.get("levels_remaining", 60 - level)
    
    # 5. Calculate XP Progress to next level (for XP meter bar)
    xp_progress_data = get_xp_to_next_level(level, xp)
    
    # 6. Calculate Total Dollar Value with ALL bonuses
    level_bonus_value = int(base_dollar_value * level_bonus_percent / 100)
    total_upgrade_value = photo.get("total_upgrade_value", 0)
    
    total_dollar_value = (
        base_dollar_value +
        level_bonus_value +
        total_upgrade_value +
        age_bonus_value +
        star_bonus_value +
        reaction_bonus_value +
        seniority_bonus_value
    )
    
    # Win/lose streak calculations
    win_streak = photo.get("win_streak", 0)
    lose_streak = photo.get("lose_streak", 0)
    
    # Streak multipliers (temporary, for battles)
    streak_multipliers = {3: 1.25, 4: 1.50, 5: 1.75, 6: 2.00, 7: 2.25, 8: 2.50, 9: 2.75, 10: 3.00}
    streak_multiplier = streak_multipliers.get(min(win_streak, 10), 1.0) if win_streak >= 3 else 1.0
    has_immunity = lose_streak >= 3
    
    # Authenticity
    face_score = photo.get("face_detection_score", 0)
    selfie_score = photo.get("selfie_match_score", 0)
    total_authenticity = min(face_score + selfie_score, 10)  # Max 10%
    authenticity_bonus = int(1_000_000_000 * (total_authenticity / 100))  # Up to $100M
    
    # BL Coins spent tracking
    bl_coins_spent = photo.get("bl_coins_spent", 0) or total_upgrade_value
    
    # Build comprehensive response
    full_stats = {
        # Core identification
        "mint_id": photo.get("mint_id"),
        "name": photo.get("name"),
        "image_url": photo.get("image_url"),
        "thumbnail_url": photo.get("thumbnail_url"),
        
        # Dollar values - Total calculated in real-time
        "base_dollar_value": base_dollar_value,
        "dollar_value": total_dollar_value,
        "total_dollar_value": total_dollar_value,
        "total_upgrade_value": total_upgrade_value,
        "level_bonus_percent": level_bonus_percent,
        "level_bonus_value": level_bonus_value,
        "authenticity_bonus_value": authenticity_bonus,
        
        # ========== NEW PROGRESSION STATS (below Authenticity) ==========
        
        # Stars - +$1M + 10% per star milestone
        "stars": stars,
        "star_bonus_value": star_bonus_value,
        "star_milestones_achieved": star_milestones_achieved,
        
        # Level - with XP progress
        "level": level,
        "xp": xp,
        "xp_progress": xp_progress_data,  # Contains progress_percent, xp_needed, remaining, etc.
        "xp_progress_percent": xp_progress_data["progress_percent"],
        "xp_to_next_level": xp_progress_data["remaining"],
        "xp_for_next_level": xp_progress_data["xp_for_next_level"],
        "has_golden_frame": has_golden_frame,
        
        # Age - +$1M every 30 days
        "age_days": age_days,
        "age_bonus_value": age_bonus_value,
        "age_cycles_completed": age_cycles,
        "days_until_next_age_bonus": days_until_next_age_bonus,
        
        # Reactions - +$1M per 100 reactions
        "total_reactions": total_reactions,
        "reaction_bonus_value": reaction_bonus_value,
        "reactions_since_last_milestone": reactions_since_last_milestone,
        "reactions_to_next_bonus": reactions_to_next_bonus,
        "reaction_milestone_count": reaction_bonus_data["milestones_reached"],
        "likes_count": photo.get("likes_count", 0),
        
        # BL Coins spent (converts to Dollar Value boost)
        "bl_coins_spent": bl_coins_spent,
        
        # Seniority - Level 60 bonus (+$1M + 20%)
        "seniority_achieved": seniority_achieved,
        "seniority_bonus_value": seniority_bonus_value,
        "levels_to_seniority": levels_to_seniority,
        
        # Monthly Growth (legacy - now part of age_bonus)
        "monthly_growth_value": age_bonus_value,
        
        # ========== EXISTING STATS ==========
        
        # Scenery
        "scenery_type": photo.get("scenery_type", "natural"),
        "strength_vs": photo.get("strength_vs", ""),
        "weakness_vs": photo.get("weakness_vs", ""),
        "light_type": photo.get("light_type", "sunlight_fire"),
        "light_strength_vs": photo.get("light_strength_vs", ""),
        "light_weakness_vs": photo.get("light_weakness_vs", ""),
        
        # Streaks (temporary battle bonuses)
        "win_streak": win_streak,
        "lose_streak": lose_streak,
        "streak_multiplier": streak_multiplier,
        "has_immunity": has_immunity,
        "battles_won": photo.get("battles_won", 0),
        "battles_lost": photo.get("battles_lost", 0),
        "highest_win_streak": photo.get("highest_win_streak", 0),
        
        # Authenticity
        "has_face": photo.get("has_face", False),
        "face_detection_score": face_score,
        "selfie_match_score": selfie_score,
        "selfie_match_completed": photo.get("selfie_match_completed", False),
        "selfie_match_attempts": photo.get("selfie_match_attempts", 0),
        "total_authenticity": total_authenticity,
        
        # Stamina
        "stamina": photo.get("stamina", 100),
        "current_stamina": photo.get("current_stamina", 24),
        "max_stamina": photo.get("max_stamina", 24),
        
        # Ownership
        "user_id": photo.get("user_id"),
        "minted_by_user_id": photo.get("minted_by_user_id"),
        "minted_by_username": photo.get("minted_by_username"),
        
        # Category ratings
        "ratings": photo.get("ratings", {}),
        "category_values": photo.get("category_values", {}),
        "overall_score": photo.get("overall_score", 0),
        
        # User subscription (for XP multiplier display)
        "user_subscription": user_subscription,
        
        # Timestamps
        "created_at": photo.get("created_at"),
        "minted_at": photo.get("minted_at"),
        "last_battle_at": photo.get("last_battle_at"),
        
        # Star milestones reference
        "star_milestones_info": STAR_MILESTONES,
        "seniority_max_level": SENIORITY_MAX_LEVEL,
    }
    
    return full_stats


@minting_router.get("/photo/{mint_id}/image")
async def get_photo_image(mint_id: str):
    """Get the full image data for a minted photo - returns actual image bytes"""
    from fastapi.responses import Response
    
    if not _minting_service:
        raise HTTPException(status_code=500, detail="Minting service not initialized")
    
    photo = await _minting_service.get_photo(mint_id, include_image=True)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    if photo.get("is_private"):
        raise HTTPException(status_code=403, detail="Photo is private")
    
    image_data = photo.get("image_data")
    if not image_data:
        raise HTTPException(status_code=404, detail="Image data not found")
    
    # Decode base64 and return actual image bytes
    image_bytes = base64.b64decode(image_data)
    mime_type = photo.get("mime_type", "image/jpeg")
    
    return Response(
        content=image_bytes,
        media_type=mime_type,
        headers={
            "Cache-Control": "public, max-age=86400",  # Cache for 24 hours
            "Content-Disposition": f"inline; filename={mint_id}.jpg"
        }
    )


@minting_router.put("/photo/{mint_id}/rename")
async def rename_photo(
    mint_id: str,
    data: RenamePhotoRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Rename a minted photo"""
    if not _minting_service:
        raise HTTPException(status_code=500, detail="Minting service not initialized")
    
    result = await _minting_service.rename_photo(
        mint_id=mint_id,
        user_id=current_user["user_id"],
        new_name=data.new_name,
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@minting_router.put("/photo/{mint_id}/privacy")
async def update_photo_privacy(
    mint_id: str,
    data: UpdatePrivacyRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Update photo privacy settings"""
    if not _minting_service:
        raise HTTPException(status_code=500, detail="Minting service not initialized")
    
    result = await _minting_service.update_photo_privacy(
        mint_id=mint_id,
        user_id=current_user["user_id"],
        is_private=data.is_private,
        show_in_feed=data.show_in_feed,
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@minting_router.put("/photo/{mint_id}/album")
async def move_photo_to_album(
    mint_id: str,
    data: MoveToAlbumRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Move a photo to an album"""
    if not _minting_service:
        raise HTTPException(status_code=500, detail="Minting service not initialized")
    
    result = await _minting_service.move_to_album(
        mint_id=mint_id,
        user_id=current_user["user_id"],
        album_id=data.album_id,
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


# ============== DOLLAR VALUE UPGRADES ==============
# Note: The main upgrade endpoint is defined above at /photos/{mint_id}/upgrade

@minting_router.get("/upgrade-prices")
async def get_upgrade_prices():
    """Get available dollar value upgrade options and their BL costs"""
    from minting_system import UPGRADE_COSTS
    
    return {
        "upgrades": [
            {
                "dollar_amount": amount,
                "bl_cost": cost,
                "formatted_dollar": f"${amount:,}",
                "formatted_cost": f"{cost:,} BL",
            }
            for amount, cost in sorted(UPGRADE_COSTS.items())
        ]
    }


@minting_router.get("/photos/{mint_id}/available-upgrades")
async def get_available_upgrades(
    mint_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Get available upgrades for a specific photo"""
    from minting_system import UPGRADE_COSTS
    
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    photo = await _db.minted_photos.find_one(
        {"mint_id": mint_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found or does not belong to you")
    
    purchased = photo.get("upgrades_purchased", [])
    
    user = await _db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0, "bl_coins": 1})
    user_bl = user.get("bl_coins", 0) if user else 0
    
    available = []
    for amount, cost in sorted(UPGRADE_COSTS.items()):
        available.append({
            "dollar_amount": amount,
            "bl_cost": cost,
            "formatted_dollar": f"${amount:,}",
            "formatted_cost": f"{cost:,} BL",
            "already_purchased": amount in purchased,
            "can_afford": user_bl >= cost,
        })
    
    return {
        "photo_id": mint_id,
        "current_upgrade_total": photo.get("total_upgrade_value", 0),
        "user_bl_balance": user_bl,
        "available_upgrades": available,
    }




# ============== ALBUM ROUTES ==============
@minting_router.post("/albums")
async def create_album(
    data: CreateAlbumRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Create a new photo album"""
    if not _album_service:
        raise HTTPException(status_code=500, detail="Album service not initialized")
    
    result = await _album_service.create_album(
        user_id=current_user["user_id"],
        name=data.name,
        description=data.description,
        is_private=data.is_private,
    )
    
    return result


@minting_router.get("/albums")
async def get_my_albums(current_user: dict = Depends(get_current_user_from_request)):
    """Get current user's albums"""
    if not _album_service:
        raise HTTPException(status_code=500, detail="Album service not initialized")
    
    albums = await _album_service.get_user_albums(
        user_id=current_user["user_id"],
        include_private=True,
    )
    
    return {"albums": albums}


@minting_router.get("/albums/user/{user_id}")
async def get_user_albums(user_id: str):
    """Get another user's public albums"""
    if not _album_service:
        raise HTTPException(status_code=500, detail="Album service not initialized")
    
    albums = await _album_service.get_user_albums(
        user_id=user_id,
        include_private=False,
    )
    
    return {"albums": albums}


@minting_router.put("/albums/{album_id}/rename")
async def rename_album(
    album_id: str,
    data: RenameAlbumRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Rename an album"""
    if not _album_service:
        raise HTTPException(status_code=500, detail="Album service not initialized")
    
    result = await _album_service.rename_album(
        album_id=album_id,
        user_id=current_user["user_id"],
        new_name=data.new_name,
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@minting_router.delete("/albums/{album_id}")
async def delete_album(
    album_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Delete an album (photos are kept, just unassigned)"""
    if not _album_service:
        raise HTTPException(status_code=500, detail="Album service not initialized")
    
    result = await _album_service.delete_album(
        album_id=album_id,
        user_id=current_user["user_id"],
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


# ============== FEED ROUTES ==============
@minting_router.get("/feed")
async def get_minted_photos_feed(skip: int = 0, limit: int = 20):
    """Get public minted photos feed"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    photos = await _db.minted_photos.find(
        {"is_private": False, "show_in_feed": True},
        {"_id": 0, "image_data": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Batch fetch users
    if photos:
        user_ids = list(set(p["user_id"] for p in photos))
        users = await _db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "password_hash": 0}
        ).to_list(len(user_ids))
        users_map = {u["user_id"]: u for u in users}
        
        for photo in photos:
            photo["user"] = users_map.get(photo["user_id"])
    
    return {"photos": photos, "count": len(photos)}



# ============== SELFIE MATCH / AUTHENTICITY ROUTES ==============
class SelfieMatchRequest(BaseModel):
    """Request for selfie face match"""
    selfie_base64: str  # Base64 encoded selfie image
    mime_type: str = "image/jpeg"


@minting_router.post("/photo/{mint_id}/selfie-match")
async def selfie_match(
    mint_id: str,
    request: SelfieMatchRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Match a selfie against the minted photo for Authenticity bonus.
    
    CRITICAL: Attempts are ONLY counted after successful AI analysis, NOT on errors.
    
    - First 3 attempts are FREE during initial minting
    - Later attempts: 100 BL coins per try (max 3 additional tries)
    - Uses GPT-4o Vision to compare faces
    - If match score > 80%, treat as 100% match
    - Awards 5% Authenticity bonus if match > 80% (treated as 100%)
    - Combined with face detection (+5%) = up to +10% total Authenticity
    - Once successful, Authenticity is permanent and locked
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    SELFIE_MATCH_COST = 100  # BL coins per attempt (after free tries)
    FREE_ATTEMPTS = 3  # First 3 are free during minting
    PAID_ATTEMPTS = 3  # Can buy up to 3 more attempts
    MAX_ATTEMPTS = FREE_ATTEMPTS + PAID_ATTEMPTS  # 6 total attempts
    MATCH_THRESHOLD = 80  # >80% match = treat as 100% (lowered from 90%)
    
    # Get the photo with full data including image_data
    photo = await _db.minted_photos.find_one({"mint_id": mint_id})
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    if photo["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only match your own photos")
    
    # Check if authenticity already successfully added (locked)
    if photo.get("selfie_match_completed") or photo.get("authenticity_locked"):
        raise HTTPException(status_code=400, detail="Authenticity already verified and locked for this photo")
    
    # Check if photo has face detection - with helpful error message
    if not photo.get("has_face"):
        logger.warning(f"[SelfieMatch] Photo {mint_id} has_face={photo.get('has_face')}, face_detection_score={photo.get('face_detection_score', 0)}")
        raise HTTPException(
            status_code=400, 
            detail="This photo doesn't have a detected face. Try with a photo that clearly shows your face."
        )
    
    # Check attempts BEFORE processing
    attempts = photo.get("selfie_match_attempts", 0)
    if attempts >= MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_ATTEMPTS} attempts reached. No more tries available.")
    
    # Calculate cost - first 3 are free, next 3 cost BL coins
    is_paid_attempt = attempts >= FREE_ATTEMPTS
    actual_cost = SELFIE_MATCH_COST if is_paid_attempt else 0
    
    # Check user balance if paid attempt
    if is_paid_attempt:
        user = await _db.users.find_one({"user_id": current_user["user_id"]})
        if (user.get("bl_coins", 0) if user else 0) < SELFIE_MATCH_COST:
            raise HTTPException(status_code=400, detail=f"Insufficient BL coins. Need {SELFIE_MATCH_COST} BL")
    
    # Validate input data BEFORE incrementing attempts
    if not request.selfie_base64:
        raise HTTPException(status_code=400, detail="No selfie image provided. Please capture your selfie first.")
    
    # Check if selfie data is valid base64
    try:
        import base64
        # Just validate it can be decoded
        decoded_length = len(base64.b64decode(request.selfie_base64))
        if decoded_length < 1000:  # Too small to be a real image
            raise HTTPException(status_code=400, detail="Selfie image is too small. Please capture a clear photo.")
        logger.info(f"[SelfieMatch] Selfie data validated: {decoded_length} bytes")
    except Exception as e:
        logger.error(f"[SelfieMatch] Invalid selfie data: {e}")
        raise HTTPException(status_code=400, detail="Invalid selfie image data. Please try capturing again.")
    
    # Get photo image data
    photo_image_data = photo.get("image_data")
    photo_mime_type = photo.get("mime_type", "image/jpeg")
    
    if not photo_image_data:
        logger.error(f"[SelfieMatch] No image data found for photo {mint_id}")
        raise HTTPException(
            status_code=500, 
            detail="Photo image data not found. This photo may need to be re-minted."
        )
    
    # NOW we can proceed with the actual matching - attempts will only be counted on success
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        import os
        import json
        import re
        import uuid
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            logger.error("[SelfieMatch] EMERGENT_LLM_KEY not configured")
            raise HTTPException(status_code=500, detail="AI service not configured. Please contact support.")
        
        logger.info(f"[SelfieMatch] Starting AI analysis for {mint_id}, attempt {attempts + 1}/{MAX_ATTEMPTS}")
        
        # Enhanced prompt for more accurate matching
        comparison_prompt = """You are an expert facial recognition system. Compare the faces in these two images.

IMAGE 1: Original minted photo (reference face)
IMAGE 2: Live selfie (face to verify)

MATCHING INSTRUCTIONS:
1. Focus ONLY on core facial structure: eyes shape/spacing, nose shape, mouth shape, face contour, jawline
2. IGNORE: lighting differences, camera angle, image quality, background, accessories (glasses/hats), makeup, facial expression, age differences
3. Be LENIENT - if the core facial structure matches, score HIGH even with different conditions

SCORING:
- 90-100%: Definitely same person (clear structural match)
- 80-89%: Very likely same person (most features match)  
- 70-79%: Probably same person (key features match)
- 50-69%: Uncertain (some similarities)
- 0-49%: Likely different people

Return ONLY valid JSON: {"match_score": <integer 0-100>, "confidence": "<high/medium/low>", "notes": "<brief reason>"}"""

        # Initialize chat with GPT-4o model
        session_id = f"selfie_match_{mint_id}_{uuid.uuid4().hex[:8]}"
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message="You are an expert facial recognition AI. Always respond with valid JSON only."
        )
        chat = chat.with_model("openai", "gpt-4o")
        
        # Create message with images
        user_message = UserMessage(
            text=comparison_prompt,
            images=[
                ImageContent(image_base64=f"data:{photo_mime_type};base64,{photo_image_data}"),
                ImageContent(image_base64=f"data:{request.mime_type};base64,{request.selfie_base64}"),
            ]
        )
        
        logger.info(f"[SelfieMatch] Calling GPT-4o Vision API...")
        response_text = chat.send_message(user_message)
        
        logger.info(f"[SelfieMatch] GPT-4o response for {mint_id}: {response_text[:300]}")
        
        # Parse response
        json_match = re.search(r'\{[^}]+\}', response_text)
        if json_match:
            try:
                result = json.loads(json_match.group())
                match_score = int(result.get("match_score", 0))
                confidence = result.get("confidence", "medium")
                notes = result.get("notes", "Analysis complete")
            except json.JSONDecodeError:
                match_score = 0
                confidence = "low"
                notes = "Failed to parse AI response"
        else:
            # Try to extract just the number
            num_match = re.search(r'(\d+)', response_text)
            match_score = int(num_match.group(1)) if num_match else 0
            confidence = "low"
            notes = "Score extracted from response"
        
        logger.info(f"[SelfieMatch] Match result for {mint_id}: score={match_score}%, confidence={confidence}")
        
        # ONLY NOW increment attempt counter (after successful analysis)
        await _db.minted_photos.update_one(
            {"mint_id": mint_id},
            {"$inc": {"selfie_match_attempts": 1}}
        )
        
        # Deduct BL coins if paid attempt (only after successful analysis)
        if is_paid_attempt:
            await _db.users.update_one(
                {"user_id": current_user["user_id"]},
                {"$inc": {"bl_coins": -SELFIE_MATCH_COST}}
            )
        
        # NEW: If match > 80%, treat as 100% match
        effective_score = match_score
        match_success = False
        
        if match_score > MATCH_THRESHOLD:
            effective_score = 100
            match_success = True
            logger.info(f"[SelfieMatch] Score {match_score}% > {MATCH_THRESHOLD}%, treating as 100% match!")
        
        # Calculate authenticity bonus
        if effective_score >= 100:
            authenticity_bonus = 5.0
            bonus_message = f"🎉 Perfect match! +5% Authenticity bonus permanently added!"
        elif match_score >= 70:
            authenticity_bonus = 4.0
            bonus_message = f"✅ Good match ({match_score}%)! +4% Authenticity bonus"
            match_success = True
        elif match_score >= 50:
            authenticity_bonus = match_score / 25
            bonus_message = f"Partial match ({match_score}%). +{authenticity_bonus:.1f}% bonus"
        else:
            authenticity_bonus = 0
            bonus_message = f"Low match ({match_score}%). No bonus applied. Try better lighting and face alignment."
        
        # Update photo with match result
        current_best = photo.get("selfie_match_score", 0)
        
        if match_score > current_best or effective_score >= 100:
            base_value = photo.get("base_dollar_value", photo.get("dollar_value", 0))
            
            # Face detection bonus (up to 5%)
            face_detection_score = photo.get("face_detection_score", 0)
            face_detection_bonus = min(5, face_detection_score / 20)
            
            # Selfie match bonus (up to 5%)
            selfie_match_bonus = authenticity_bonus
            
            # Total authenticity capped at 10%
            total_authenticity = min(10, face_detection_bonus + selfie_match_bonus)
            
            # Apply to dollar value
            authenticity_value = int(base_value * (total_authenticity / 100))
            new_dollar_value = base_value + authenticity_value
            
            update_data = {
                "selfie_match_score": match_score,
                "selfie_bonus_percent": selfie_match_bonus,
                "selfie_match_confidence": confidence,
                "selfie_match_notes": notes,
                "authenticity_bonus": total_authenticity,
                "dollar_value": new_dollar_value,
            }
            
            # Lock if successful (>80% = 100%)
            if effective_score >= 100:
                update_data["selfie_match_completed"] = True
                update_data["authenticity_locked"] = True
                logger.info(f"[SelfieMatch] SUCCESS! Locking authenticity for {mint_id} with +{total_authenticity}% bonus")
            
            await _db.minted_photos.update_one(
                {"mint_id": mint_id},
                {"$set": update_data}
            )
        
        remaining_attempts = MAX_ATTEMPTS - attempts - 1
        
        return {
            "success": match_success,
            "match_score": match_score,
            "effective_score": effective_score,
            "confidence": confidence,
            "notes": notes,
            "authenticity_bonus_added": authenticity_bonus if match_success else 0,
            "total_authenticity": min(10, photo.get("face_bonus_percent", 0) + (authenticity_bonus if match_success else 0)),
            "message": bonus_message,
            "remaining_attempts": remaining_attempts,
            "cost_paid": actual_cost,
            "is_best_score": match_score > current_best,
            "is_locked": effective_score >= 100,
        }
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        # Log detailed error but DON'T increment attempts on processing errors
        logger.error(f"[SelfieMatch] Processing error for {mint_id}: {str(e)}")
        import traceback
        logger.error(f"[SelfieMatch] Traceback: {traceback.format_exc()}")
        
        # Return a helpful error message based on the error type
        error_msg = str(e).lower()
        if "timeout" in error_msg or "connection" in error_msg:
            detail = "Network issue - please check your connection and try again. This attempt was not counted."
        elif "api" in error_msg or "key" in error_msg:
            detail = "AI service temporarily unavailable. Please try again in a moment. This attempt was not counted."
        else:
            detail = f"Processing error - please try again. This attempt was not counted. ({str(e)[:100]})"
        
        raise HTTPException(status_code=500, detail=detail)


@minting_router.get("/photo/{mint_id}/authenticity-status")
async def get_authenticity_status(mint_id: str):
    """Get the authenticity status of a minted photo"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Constants matching selfie-match endpoint
    FREE_ATTEMPTS = 3
    PAID_ATTEMPTS = 3
    MAX_ATTEMPTS = FREE_ATTEMPTS + PAID_ATTEMPTS  # 6 total
    
    photo = await _db.minted_photos.find_one(
        {"mint_id": mint_id},
        {"_id": 0, "image_data": 0}
    )
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    attempts_used = photo.get("selfie_match_attempts", 0)
    is_free_attempt = attempts_used < FREE_ATTEMPTS
    
    return {
        "mint_id": mint_id,
        "has_face": photo.get("has_face", False),
        "face_detection_score": photo.get("face_detection_score", 0),
        "selfie_match_score": photo.get("selfie_match_score", 0),
        "selfie_match_confidence": photo.get("selfie_match_confidence"),
        "authenticity_bonus": photo.get("authenticity_bonus", 0),
        "authenticity_locked": photo.get("authenticity_locked", False),
        "selfie_match_attempts": attempts_used,
        "max_attempts": MAX_ATTEMPTS,
        "free_attempts": FREE_ATTEMPTS,
        "paid_attempts": PAID_ATTEMPTS,
        "is_free_attempt": is_free_attempt,
        "free_attempts_remaining": max(0, FREE_ATTEMPTS - attempts_used),
        "can_add_selfie": (
            photo.get("has_face", False) and 
            not photo.get("authenticity_locked", False) and
            attempts_used < MAX_ATTEMPTS
        ),
    }



@minting_router.post("/photos/{mint_id}/claim-birthday-bonus")
async def claim_birthday_bonus(
    mint_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Claim the yearly birthday bonus for a minted photo.
    +5,000 BL coins on minting anniversary date each year.
    """
    from minting_system import BIRTHDAY_BONUS_BL
    from datetime import datetime, timezone
    
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Verify ownership
    photo = await _db.minted_photos.find_one(
        {"mint_id": mint_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found or does not belong to you")
    
    now = datetime.now(timezone.utc)
    minted_at = photo.get("minted_at")
    if isinstance(minted_at, str):
        minted_at = datetime.fromisoformat(minted_at.replace('Z', '+00:00'))
    
    if not minted_at:
        raise HTTPException(status_code=400, detail="Photo minting date not available")
    
    # Check if today is the anniversary (same month and day)
    is_anniversary = (now.month == minted_at.month and now.day == minted_at.day)
    
    if not is_anniversary:
        days_until_birthday = ((minted_at.replace(year=now.year) - now).days) % 365
        raise HTTPException(
            status_code=400, 
            detail=f"Birthday bonus can only be claimed on the minting anniversary. {days_until_birthday} days until next anniversary."
        )
    
    # Check if already claimed this year
    last_claimed_year = photo.get("last_birthday_bonus_year", 0)
    if last_claimed_year >= now.year:
        raise HTTPException(status_code=400, detail="Birthday bonus already claimed this year")
    
    # Award the bonus
    await _db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"bl_coins": BIRTHDAY_BONUS_BL}}
    )
    
    # Update photo's last claim year
    await _db.minted_photos.update_one(
        {"mint_id": mint_id},
        {"$set": {"last_birthday_bonus_year": now.year}}
    )
    
    # Record transaction
    from referral_system import record_transaction, TransactionType, Currency
    await record_transaction(
        user_id=current_user["user_id"],
        transaction_type=TransactionType.BIRTHDAY_BONUS,
        currency=Currency.BL,
        amount=BIRTHDAY_BONUS_BL,
        reference_id=mint_id,
        details={"type": "birthday_bonus", "photo_name": photo.get("name")}
    )
    
    return {
        "success": True,
        "bl_awarded": BIRTHDAY_BONUS_BL,
        "photo_name": photo.get("name"),
        "message": f"🎂 Happy Birthday to '{photo.get('name')}'! You received {BIRTHDAY_BONUS_BL:,} BL coins!"
    }


@minting_router.post("/subscription/claim-daily-bl")
async def claim_daily_subscription_bl(
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Claim daily BL coins based on subscription tier.
    - Bronze: 15,000 BL/day
    - Silver: 35,000 BL/day
    - Gold: 80,000 BL/day
    - Platinum: 200,000 BL/day
    """
    from minting_system import SUBSCRIPTION_TIERS
    from datetime import datetime, timezone
    
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user = await _db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription_tier = user.get("subscription_tier", "free")
    tier_config = SUBSCRIPTION_TIERS.get(subscription_tier, SUBSCRIPTION_TIERS["free"])
    daily_bl_claim = tier_config.get("daily_bl_claim", 0)
    
    if daily_bl_claim <= 0:
        raise HTTPException(status_code=400, detail="Free tier does not include daily BL claim. Subscribe to unlock!")
    
    # Check if already claimed today
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    
    last_claim = user.get("last_daily_bl_claim")
    if last_claim:
        if isinstance(last_claim, str):
            last_claim = datetime.fromisoformat(last_claim.replace('Z', '+00:00'))
        if last_claim >= today_start:
            next_claim_in = 24 - (now - last_claim).seconds // 3600
            raise HTTPException(status_code=400, detail=f"Daily BL already claimed. Next claim in {next_claim_in} hours.")
    
    # Award the daily BL
    await _db.users.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$inc": {"bl_coins": daily_bl_claim},
            "$set": {"last_daily_bl_claim": now.isoformat()}
        }
    )
    
    # Record transaction
    from referral_system import record_transaction, TransactionType, Currency
    await record_transaction(
        user_id=current_user["user_id"],
        transaction_type=TransactionType.SUBSCRIPTION_BONUS,
        currency=Currency.BL,
        amount=daily_bl_claim,
        reference_id=f"daily_{now.strftime('%Y%m%d')}",
        details={"type": "daily_subscription_claim", "tier": subscription_tier}
    )
    
    return {
        "success": True,
        "bl_awarded": daily_bl_claim,
        "subscription_tier": subscription_tier,
        "message": f"💰 Daily claim successful! +{daily_bl_claim:,} BL coins from your {subscription_tier.title()} subscription!"
    }


@minting_router.get("/subscription/info")
async def get_subscription_info(
    current_user: dict = Depends(get_current_user_from_request)
):
    """Get current subscription tier and benefits"""
    from minting_system import SUBSCRIPTION_TIERS
    from datetime import datetime, timezone
    
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user = await _db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    subscription_tier = user.get("subscription_tier", "free")
    tier_config = SUBSCRIPTION_TIERS.get(subscription_tier, SUBSCRIPTION_TIERS["free"])
    
    # Check if can claim today
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    last_claim = user.get("last_daily_bl_claim")
    can_claim = True
    
    if last_claim:
        if isinstance(last_claim, str):
            last_claim = datetime.fromisoformat(last_claim.replace('Z', '+00:00'))
        if last_claim >= today_start:
            can_claim = False
    
    return {
        "current_tier": subscription_tier,
        "benefits": {
            "daily_mint_limit": tier_config.get("daily_mint_limit"),
            "xp_multiplier": tier_config.get("xp_multiplier"),
            "daily_bl_claim": tier_config.get("daily_bl_claim"),
            "price": tier_config.get("price"),
        },
        "can_claim_daily_bl": can_claim and tier_config.get("daily_bl_claim", 0) > 0,
        "all_tiers": {
            name: {
                "daily_mint_limit": config.get("daily_mint_limit"),
                "xp_multiplier": config.get("xp_multiplier"),
                "daily_bl_claim": config.get("daily_bl_claim"),
                "price": config.get("price"),
            }
            for name, config in SUBSCRIPTION_TIERS.items()
        }
    }


@minting_router.post("/photos/{mint_id}/react")
async def react_to_photo(
    mint_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Add a reaction (like/emoji) to a minted photo.
    +$1M bonus per 100 reactions accumulated.
    For now, this is a mocked counter - real FB integration later.
    """
    from minting_system import REACTION_BONUS_THRESHOLD, REACTION_BONUS_VALUE
    from datetime import datetime, timezone
    
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Get the photo
    photo = await _db.minted_photos.find_one({"mint_id": mint_id}, {"_id": 0})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Check if user already reacted (one reaction per user)
    existing_reaction = await _db.photo_reactions.find_one({
        "mint_id": mint_id,
        "user_id": current_user["user_id"]
    })
    
    if existing_reaction:
        raise HTTPException(status_code=400, detail="You have already reacted to this photo")
    
    # Add reaction
    await _db.photo_reactions.insert_one({
        "mint_id": mint_id,
        "user_id": current_user["user_id"],
        "reaction_type": "like",
        "created_at": datetime.now(timezone.utc),
    })
    
    # Update photo's total reactions
    new_total = photo.get("total_reactions", 0) + 1
    new_reaction_bonus = (new_total // REACTION_BONUS_THRESHOLD) * REACTION_BONUS_VALUE
    old_reaction_bonus = photo.get("reaction_bonus_value", 0)
    
    # Calculate if this reaction triggered a bonus milestone
    bonus_triggered = new_reaction_bonus > old_reaction_bonus
    bonus_amount = new_reaction_bonus - old_reaction_bonus if bonus_triggered else 0
    
    await _db.minted_photos.update_one(
        {"mint_id": mint_id},
        {"$set": {
            "total_reactions": new_total,
            "reaction_bonus_value": new_reaction_bonus,
            "likes_count": new_total,  # Keep likes_count in sync
        }}
    )
    
    return {
        "success": True,
        "total_reactions": new_total,
        "reaction_bonus_value": new_reaction_bonus,
        "bonus_triggered": bonus_triggered,
        "bonus_amount": bonus_amount,
        "message": f"❤️ Reaction added! {new_total} total reactions." + (f" +${bonus_amount:,} bonus!" if bonus_triggered else "")
    }


@minting_router.delete("/photos/{mint_id}/react")
async def remove_reaction(
    mint_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Remove a reaction from a photo"""
    from minting_system import REACTION_BONUS_THRESHOLD, REACTION_BONUS_VALUE
    
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Check if reaction exists
    existing = await _db.photo_reactions.find_one({
        "mint_id": mint_id,
        "user_id": current_user["user_id"]
    })
    
    if not existing:
        raise HTTPException(status_code=404, detail="Reaction not found")
    
    # Remove reaction
    await _db.photo_reactions.delete_one({
        "mint_id": mint_id,
        "user_id": current_user["user_id"]
    })
    
    # Update photo's total reactions
    photo = await _db.minted_photos.find_one({"mint_id": mint_id}, {"_id": 0})
    if photo:
        new_total = max(0, photo.get("total_reactions", 1) - 1)
        new_reaction_bonus = (new_total // REACTION_BONUS_THRESHOLD) * REACTION_BONUS_VALUE
        
        await _db.minted_photos.update_one(
            {"mint_id": mint_id},
            {"$set": {
                "total_reactions": new_total,
                "reaction_bonus_value": new_reaction_bonus,
                "likes_count": new_total,
            }}
        )
    
    return {"success": True, "message": "Reaction removed"}


@minting_router.get("/photos/{mint_id}/full-value")
async def get_photo_full_value(mint_id: str):
    """
    Get a photo with fully calculated dollar value including:
    - Base value (AI scoring)
    - Level bonus
    - Upgrade bonus
    - Monthly growth (+$1M per 30 days)
    - Reaction bonus (+$1M per 100 reactions)
    """
    from minting_system import calculate_full_dollar_value, calculate_stamina_regen
    from minting_system import get_level_stars as get_stars_info
    from datetime import datetime, timezone
    
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    photo = await _db.minted_photos.find_one({"mint_id": mint_id}, {"_id": 0})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    now = datetime.now(timezone.utc)
    
    # Calculate full dollar value
    value_breakdown = calculate_full_dollar_value(photo, now)
    
    # Calculate current stamina with regeneration
    current_stamina = calculate_stamina_regen(photo, now)
    
    # Get star info
    level = photo.get("level", 1)
    star_info = get_stars_info(level)
    
    # Check birthday eligibility
    minted_at = photo.get("minted_at")
    if isinstance(minted_at, str):
        minted_at = datetime.fromisoformat(minted_at.replace('Z', '+00:00'))
    
    is_birthday = False
    days_until_birthday = 0
    can_claim_birthday = False
    
    if minted_at:
        is_birthday = (now.month == minted_at.month and now.day == minted_at.day)
        anniversary_this_year = minted_at.replace(year=now.year)
        if anniversary_this_year < now:
            anniversary_this_year = minted_at.replace(year=now.year + 1)
        days_until_birthday = (anniversary_this_year - now).days
        
        last_claimed_year = photo.get("last_birthday_bonus_year", 0)
        can_claim_birthday = is_birthday and last_claimed_year < now.year
    
    return {
        "mint_id": mint_id,
        "name": photo.get("name"),
        "image_url": photo.get("image_url"),
        # Value breakdown
        "dollar_value": value_breakdown["dollar_value"],
        "base_dollar_value": value_breakdown["base_dollar_value"],
        "level_bonus": value_breakdown["level_bonus"],
        "level_bonus_percent": value_breakdown["level_bonus_percent"],
        "upgrade_bonus": value_breakdown["total_upgrade_value"],
        "monthly_growth_value": value_breakdown["monthly_growth_value"],
        "reaction_bonus_value": value_breakdown["reaction_bonus_value"],
        # Reactions
        "total_reactions": photo.get("total_reactions", 0),
        # Stamina
        "current_stamina": current_stamina,
        "max_stamina": photo.get("max_stamina", 24),
        # Level & XP
        "level": level,
        "xp": photo.get("xp", 0),
        "stars": star_info["stars"],
        "has_golden_frame": star_info["has_golden_frame"],
        # Streaks
        "win_streak": photo.get("win_streak", 0),
        "lose_streak": photo.get("lose_streak", 0),
        # Minter info
        "minted_by_username": photo.get("minted_by_username", ""),
        "minted_at": minted_at.isoformat() if minted_at else None,
        # Birthday
        "is_birthday": is_birthday,
        "days_until_birthday": days_until_birthday,
        "can_claim_birthday_bonus": can_claim_birthday,
        # Scenery
        "scenery_type": photo.get("scenery_type"),
        "strength_vs": photo.get("strength_vs"),
        "weakness_vs": photo.get("weakness_vs"),
    }


@minting_router.get("/photos/{mint_id}/check-birthday")
async def check_birthday_eligibility(
    mint_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Check if a photo is eligible for birthday bonus claim"""
    from minting_system import BIRTHDAY_BONUS_BL
    from datetime import datetime, timezone
    
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    photo = await _db.minted_photos.find_one(
        {"mint_id": mint_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found or does not belong to you")
    
    now = datetime.now(timezone.utc)
    minted_at = photo.get("minted_at")
    if isinstance(minted_at, str):
        minted_at = datetime.fromisoformat(minted_at.replace('Z', '+00:00'))
    
    if not minted_at:
        return {"can_claim": False, "reason": "Minting date not available"}
    
    is_birthday = (now.month == minted_at.month and now.day == minted_at.day)
    last_claimed_year = photo.get("last_birthday_bonus_year", 0)
    
    # Calculate days until next birthday
    anniversary_this_year = minted_at.replace(year=now.year)
    if anniversary_this_year.date() < now.date():
        anniversary_this_year = minted_at.replace(year=now.year + 1)
    days_until = (anniversary_this_year.date() - now.date()).days
    
    can_claim = is_birthday and last_claimed_year < now.year
    
    return {
        "can_claim": can_claim,
        "is_birthday": is_birthday,
        "days_until_birthday": days_until,
        "last_claimed_year": last_claimed_year,
        "bonus_amount": BIRTHDAY_BONUS_BL,
        "photo_name": photo.get("name"),
        "minted_at": minted_at.isoformat() if minted_at else None,
        "message": "🎂 Happy Birthday! Claim your bonus!" if can_claim else f"{days_until} days until birthday bonus"
    }

