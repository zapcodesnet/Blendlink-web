"""
Blendlink Internal Minting API Routes
- Photo/Video/Music minting
- Album management
- AI photo analysis
"""

import base64
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
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
)

logger = logging.getLogger(__name__)

# Router
minting_router = APIRouter(prefix="/minting", tags=["Minting"])

# Services will be initialized when routes are included
_minting_service: Optional[MintingService] = None
_album_service: Optional[AlbumService] = None


def get_minting_service() -> MintingService:
    if not _minting_service:
        raise HTTPException(status_code=500, detail="Minting service not initialized")
    return _minting_service


def get_album_service() -> AlbumService:
    if not _album_service:
        raise HTTPException(status_code=500, detail="Album service not initialized")
    return _album_service


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
        "supported_types": ["photo", "video", "music"],
    }


@minting_router.get("/status")
async def get_mint_status(current_user: dict = Depends()):
    """Check if user can mint and their current status"""
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _minting_service
    if not _minting_service:
        _minting_service, _ = init_minting_services(db)
    
    return await _minting_service.check_can_mint(current_user["user_id"])


@minting_router.post("/photo")
async def mint_photo(
    data: MintPhotoRequest,
    current_user: dict = Depends()
):
    """
    Mint a new photo collectible
    
    - Costs 500 BL coins
    - Daily limit applies based on subscription
    - AI analyzes photo for stats
    """
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _minting_service
    if not _minting_service:
        _minting_service, _ = init_minting_services(db)
    
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
    is_private: bool = Form(False),
    show_in_feed: bool = Form(True),
    album_id: Optional[str] = Form(None),
    file: UploadFile = File(...),
    current_user: dict = Depends()
):
    """
    Mint a photo from file upload
    """
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _minting_service
    if not _minting_service:
        _minting_service, _ = init_minting_services(db)
    
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported image type. Allowed: {', '.join(allowed_types)}"
        )
    
    # Read and encode file
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="Image too large. Max 10MB.")
    
    image_base64 = base64.b64encode(content).decode("utf-8")
    
    result = await _minting_service.mint_photo(
        user_id=current_user["user_id"],
        image_base64=image_base64,
        name=name,
        description=description,
        is_private=is_private,
        show_in_feed=show_in_feed,
        album_id=album_id,
        mime_type=file.content_type,
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error", "Minting failed"))
    
    return result


@minting_router.get("/photos")
async def get_my_photos(
    album_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends()
):
    """Get current user's minted photos"""
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _minting_service
    if not _minting_service:
        _minting_service, _ = init_minting_services(db)
    
    photos = await _minting_service.get_user_photos(
        user_id=current_user["user_id"],
        include_private=True,  # User can see their own private photos
        album_id=album_id,
        skip=skip,
        limit=limit,
    )
    
    return {"photos": photos, "count": len(photos)}


@minting_router.get("/photos/user/{user_id}")
async def get_user_photos(
    user_id: str,
    album_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
):
    """Get another user's public minted photos"""
    from server import db
    
    global _minting_service
    if not _minting_service:
        _minting_service, _ = init_minting_services(db)
    
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
    from server import db
    
    global _minting_service
    if not _minting_service:
        _minting_service, _ = init_minting_services(db)
    
    photo = await _minting_service.get_photo(mint_id)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    return photo


@minting_router.get("/photo/{mint_id}/image")
async def get_photo_image(mint_id: str):
    """Get the full image data for a minted photo"""
    from server import db
    from fastapi.responses import Response
    
    global _minting_service
    if not _minting_service:
        _minting_service, _ = init_minting_services(db)
    
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
    current_user: dict = Depends()
):
    """Rename a minted photo"""
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _minting_service
    if not _minting_service:
        _minting_service, _ = init_minting_services(db)
    
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
    current_user: dict = Depends()
):
    """Update photo privacy settings"""
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _minting_service
    if not _minting_service:
        _minting_service, _ = init_minting_services(db)
    
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
    current_user: dict = Depends()
):
    """Move a photo to an album"""
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _minting_service
    if not _minting_service:
        _minting_service, _ = init_minting_services(db)
    
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
    current_user: dict = Depends()
):
    """Create a new photo album"""
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _album_service
    if not _album_service:
        _, _album_service = init_minting_services(db)
    
    result = await _album_service.create_album(
        user_id=current_user["user_id"],
        name=data.name,
        description=data.description,
        is_private=data.is_private,
    )
    
    return result


@minting_router.get("/albums")
async def get_my_albums(current_user: dict = Depends()):
    """Get current user's albums"""
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _album_service
    if not _album_service:
        _, _album_service = init_minting_services(db)
    
    albums = await _album_service.get_user_albums(
        user_id=current_user["user_id"],
        include_private=True,
    )
    
    return {"albums": albums}


@minting_router.get("/albums/user/{user_id}")
async def get_user_albums(user_id: str):
    """Get another user's public albums"""
    from server import db
    
    global _album_service
    if not _album_service:
        _, _album_service = init_minting_services(db)
    
    albums = await _album_service.get_user_albums(
        user_id=user_id,
        include_private=False,
    )
    
    return {"albums": albums}


@minting_router.put("/albums/{album_id}/rename")
async def rename_album(
    album_id: str,
    data: RenameAlbumRequest,
    current_user: dict = Depends()
):
    """Rename an album"""
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _album_service
    if not _album_service:
        _, _album_service = init_minting_services(db)
    
    result = await _album_service.rename_album(
        album_id=album_id,
        user_id=current_user["user_id"],
        new_name=data.new_name,
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@minting_router.delete("/albums/{album_id}")
async def delete_album(album_id: str, current_user: dict = Depends()):
    """Delete an album (photos are kept, just unassigned)"""
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _album_service
    if not _album_service:
        _, _album_service = init_minting_services(db)
    
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
    from server import db
    
    photos = await db.minted_photos.find(
        {"is_private": False, "show_in_feed": True},
        {"_id": 0, "image_data": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Batch fetch users
    if photos:
        user_ids = list(set(p["user_id"] for p in photos))
        users = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "password_hash": 0}
        ).to_list(len(user_ids))
        users_map = {u["user_id"]: u for u in users}
        
        for photo in photos:
            photo["user"] = users_map.get(photo["user_id"])
    
    return {"photos": photos, "count": len(photos)}


# ============== INIT FUNCTION ==============
def setup_minting_routes(db):
    """Initialize minting services with database connection"""
    global _minting_service, _album_service
    _minting_service, _album_service = init_minting_services(db)
    logger.info("Minting services initialized")
