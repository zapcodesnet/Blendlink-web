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
from minting_system import UPGRADE_COSTS, LEVEL_BONUSES, calculate_dollar_value, get_level_stars

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
