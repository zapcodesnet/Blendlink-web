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
    mint_id: str
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


@minting_router.get("/photo/{mint_id}/image")
async def get_photo_image(mint_id: str):
    """Get the full image data for a minted photo"""
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
    
    # Return base64 data URL
    return {"image_data": f"data:image/jpeg;base64,{image_data}"}


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
    mint_id: str
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
    
    - Costs 100 BL coins per attempt (max 3 attempts)
    - Uses GPT-4o Vision to compare faces
    - Awards 5% Authenticity bonus if match > 80%
    - Once added, Authenticity is permanent
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    SELFIE_MATCH_COST = 100  # BL coins per attempt
    MAX_ATTEMPTS = 3
    MATCH_THRESHOLD = 80  # 80% match required for full bonus
    
    # Get the photo
    photo = await _db.minted_photos.find_one(
        {"mint_id": mint_id},
        {"_id": 0}
    )
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    if photo["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only match your own photos")
    
    # Check if authenticity already added
    if photo.get("selfie_match_score", 0) > 0:
        raise HTTPException(status_code=400, detail="Authenticity already added to this photo")
    
    # Check if photo has face detection
    if not photo.get("has_face") or photo.get("face_detection_score", 0) < 10:
        raise HTTPException(status_code=400, detail="Photo must have a clear face for selfie match")
    
    # Check attempts
    attempts = photo.get("selfie_match_attempts", 0)
    if attempts >= MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_ATTEMPTS} attempts reached")
    
    # Check user balance
    if current_user.get("bl_coins", 0) < SELFIE_MATCH_COST:
        raise HTTPException(status_code=400, detail=f"Insufficient BL coins. Need {SELFIE_MATCH_COST} BL")
    
    # Deduct BL coins
    await _db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$inc": {"bl_coins": -SELFIE_MATCH_COST}}
    )
    
    # Increment attempt count
    await _db.minted_photos.update_one(
        {"mint_id": mint_id},
        {"$inc": {"selfie_match_attempts": 1}}
    )
    
    try:
        # Use GPT-4o Vision for face comparison
        from emergentintegrations.llm.chat import chat, ChatConfig, Message
        import os
        
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Get photo image
        photo_image_data = photo.get("image_data")
        if not photo_image_data:
            # Fetch from URL if not stored
            photo_with_data = await _db.minted_photos.find_one({"mint_id": mint_id})
            photo_image_data = photo_with_data.get("image_data") if photo_with_data else None
        
        if not photo_image_data:
            raise HTTPException(status_code=500, detail="Photo image not found")
        
        # Prepare prompt for face comparison
        comparison_prompt = """Compare the faces in these two images and provide a face similarity score.

Image 1: The minted photo (may contain one or more faces)
Image 2: A live selfie for verification

Instructions:
1. Focus ONLY on facial features (eyes, nose, mouth, face shape, etc.)
2. Ignore differences in lighting, angle, image quality, or background
3. Score from 0-100% where:
   - 90-100%: Definitely the same person
   - 80-89%: Very likely the same person
   - 60-79%: Possibly the same person
   - 40-59%: Unclear/uncertain
   - 0-39%: Likely different people

Return ONLY a JSON object with this exact format:
{"match_score": <number>, "confidence": "<high/medium/low>", "notes": "<brief explanation>"}"""

        # Call GPT-4o Vision
        config = ChatConfig(
            model="gpt-4o",
            api_key=api_key,
            temperature=0.1,
        )
        
        messages = [
            Message(role="user", content=[
                {"type": "text", "text": comparison_prompt},
                {"type": "image_url", "image_url": {"url": f"data:{photo.get('mime_type', 'image/jpeg')};base64,{photo_image_data}"}},
                {"type": "image_url", "image_url": {"url": f"data:{request.mime_type};base64,{request.selfie_base64}"}},
            ])
        ]
        
        response = await chat(config, messages)
        
        # Parse response
        import json
        import re
        
        response_text = response.content if hasattr(response, 'content') else str(response)
        
        # Extract JSON from response
        json_match = re.search(r'\{[^}]+\}', response_text)
        if json_match:
            result = json.loads(json_match.group())
            match_score = result.get("match_score", 0)
            confidence = result.get("confidence", "low")
            notes = result.get("notes", "")
        else:
            # Try to extract just the number
            num_match = re.search(r'(\d+)', response_text)
            match_score = int(num_match.group(1)) if num_match else 0
            confidence = "low"
            notes = "Score extracted from response"
        
        # Calculate authenticity bonus
        if match_score >= MATCH_THRESHOLD:
            # Award full 5% bonus (5% of max = 5% of $100M = $5M equivalent, but stored as score)
            authenticity_bonus = 5.0
            bonus_message = f"🎉 Face match successful! +{authenticity_bonus}% Authenticity"
        else:
            authenticity_bonus = match_score / 20  # Partial bonus: 0-4% based on score
            bonus_message = f"Face match: {match_score}%. Partial Authenticity bonus: +{authenticity_bonus:.1f}%"
        
        # Update photo with match result (only if this is the best attempt)
        current_best = photo.get("selfie_match_score", 0)
        if match_score > current_best:
            # Recalculate dollar value with authenticity bonus
            base_value = photo.get("base_dollar_value", photo.get("dollar_value", 0))
            
            # Face detection gives up to 5%
            face_detection_score = photo.get("face_detection_score", 0)
            face_detection_bonus = min(5, face_detection_score / 20)
            
            # Selfie match gives up to 5%
            selfie_match_bonus = authenticity_bonus
            
            # Total authenticity (capped at 10%)
            total_authenticity = min(10, face_detection_bonus + selfie_match_bonus)
            
            # Apply to dollar value (10% = $100M max from authenticity)
            authenticity_value = int(base_value * (total_authenticity / 100))
            new_dollar_value = base_value + authenticity_value
            
            await _db.minted_photos.update_one(
                {"mint_id": mint_id},
                {
                    "$set": {
                        "selfie_match_score": match_score,
                        "selfie_match_confidence": confidence,
                        "selfie_match_notes": notes,
                        "authenticity_bonus": total_authenticity,
                        "dollar_value": new_dollar_value,
                        "authenticity_locked": True,
                    }
                }
            )
        
        remaining_attempts = MAX_ATTEMPTS - attempts - 1
        
        return {
            "success": True,
            "match_score": match_score,
            "confidence": confidence,
            "notes": notes,
            "authenticity_bonus": authenticity_bonus,
            "message": bonus_message,
            "remaining_attempts": remaining_attempts,
            "cost_paid": SELFIE_MATCH_COST,
            "is_best_score": match_score > current_best,
        }
        
    except Exception as e:
        logger.error(f"Selfie match error: {e}")
        # Refund on error
        await _db.users.update_one(
            {"user_id": current_user["user_id"]},
            {"$inc": {"bl_coins": SELFIE_MATCH_COST}}
        )
        await _db.minted_photos.update_one(
            {"mint_id": mint_id},
            {"$inc": {"selfie_match_attempts": -1}}
        )
        raise HTTPException(status_code=500, detail=f"Face matching failed: {str(e)}")


@minting_router.get("/photo/{mint_id}/authenticity-status")
async def get_authenticity_status(mint_id: str):
    """Get the authenticity status of a minted photo"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    photo = await _db.minted_photos.find_one(
        {"mint_id": mint_id},
        {"_id": 0, "image_data": 0}
    )
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    return {
        "mint_id": mint_id,
        "has_face": photo.get("has_face", False),
        "face_detection_score": photo.get("face_detection_score", 0),
        "selfie_match_score": photo.get("selfie_match_score", 0),
        "selfie_match_confidence": photo.get("selfie_match_confidence"),
        "authenticity_bonus": photo.get("authenticity_bonus", 0),
        "authenticity_locked": photo.get("authenticity_locked", False),
        "selfie_match_attempts": photo.get("selfie_match_attempts", 0),
        "max_attempts": 3,
        "can_add_selfie": (
            photo.get("has_face", False) and 
            not photo.get("authenticity_locked", False) and
            photo.get("selfie_match_attempts", 0) < 3
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

