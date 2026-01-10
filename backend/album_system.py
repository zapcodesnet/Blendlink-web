"""
Blendlink Album & Media Management System
- Album CRUD operations
- Video thumbnail generation (FFmpeg)
- Media organization and privacy
- Auto-posting public album content to feed
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import os
import base64
import subprocess
import tempfile
from pathlib import Path

# Import from main server
from server import get_current_user, db, logger

# Create router
album_router = APIRouter(prefix="/albums", tags=["Albums"])

# Ensure directories exist
UPLOAD_DIR = Path("/app/uploads")
THUMBNAIL_DIR = UPLOAD_DIR / "thumbnails"
UPLOAD_DIR.mkdir(exist_ok=True)
THUMBNAIL_DIR.mkdir(exist_ok=True)

# ============== MODELS ==============

class AlbumCreate(BaseModel):
    name: str
    description: str = ""
    media_type: str = "mixed"  # "photo", "video", "music", "mixed"
    privacy: str = "public"  # "public", "private", "friends"
    auto_post_to_feed: bool = True

class AlbumUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    privacy: Optional[str] = None
    cover_image: Optional[str] = None
    auto_post_to_feed: Optional[bool] = None

class MediaItemAdd(BaseModel):
    media_url: str
    media_type: str  # "image", "video", "audio"
    title: Optional[str] = None
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None

# ============== HELPER FUNCTIONS ==============

def generate_video_thumbnail(video_path: str, output_path: str, time: str = "00:00:01") -> bool:
    """Generate a thumbnail from a video using FFmpeg"""
    try:
        cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-ss', time,
            '-vframes', '1',
            '-q:v', '2',
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=30)
        return result.returncode == 0 and os.path.exists(output_path)
    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
        return False

def generate_video_preview_gif(video_path: str, output_path: str, duration: int = 3) -> bool:
    """Generate a short looping GIF preview from video"""
    try:
        cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-ss', '0',
            '-t', str(duration),
            '-vf', 'fps=10,scale=320:-1:flags=lanczos',
            '-c:v', 'gif',
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=60)
        return result.returncode == 0 and os.path.exists(output_path)
    except Exception as e:
        logger.error(f"GIF preview generation failed: {e}")
        return False

async def create_feed_post_from_media(user_id: str, album_id: str, media_url: str, media_type: str, title: str = None):
    """Auto-create a feed post when public media is added to album"""
    post_id = f"post_{uuid.uuid4().hex[:12]}"
    
    content = title or "Added new media to album"
    
    post = {
        "post_id": post_id,
        "user_id": user_id,
        "content": content,
        "media_type": media_type,
        "media_urls": [media_url],
        "privacy": "public",
        "album_id": album_id,
        "reactions": {},
        "reaction_counts": {},
        "comment_count": 0,
        "shares_count": 0,
        "is_album_post": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.posts.insert_one(post)
    logger.info(f"Auto-created feed post {post_id} from album {album_id}")
    return post_id

# ============== ALBUM CRUD ROUTES ==============

@album_router.post("/create")
async def create_album(
    data: AlbumCreate,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Create a new album"""
    album_id = f"album_{uuid.uuid4().hex[:12]}"
    
    album = {
        "album_id": album_id,
        "user_id": current_user["user_id"],
        "name": data.name,
        "description": data.description,
        "media_type": data.media_type,
        "privacy": data.privacy,
        "cover_image": None,
        "media_items": [],
        "media_count": 0,
        "auto_post_to_feed": data.auto_post_to_feed,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.albums.insert_one(album)
    
    return {
        "album_id": album_id,
        "message": "Album created successfully",
        "album": {k: v for k, v in album.items() if k != "_id"}
    }

@album_router.get("/my")
async def get_my_albums(current_user: dict = Depends(get_current_user)):
    """Get all albums for current user"""
    albums = await db.albums.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"albums": albums, "count": len(albums)}

@album_router.get("/{album_id}")
async def get_album(album_id: str, current_user: dict = Depends(get_current_user)):
    """Get album details with media items"""
    album = await db.albums.find_one({"album_id": album_id}, {"_id": 0})
    
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    # Check privacy
    if album["privacy"] == "private" and album["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get owner info
    owner = await db.users.find_one(
        {"user_id": album["user_id"]},
        {"_id": 0, "password_hash": 0}
    )
    album["owner"] = owner
    
    return album

@album_router.put("/{album_id}")
async def update_album(
    album_id: str,
    data: AlbumUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update album details"""
    album = await db.albums.find_one({"album_id": album_id})
    
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    if album["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.albums.update_one(
        {"album_id": album_id},
        {"$set": update_data}
    )
    
    return {"message": "Album updated", "album_id": album_id}

@album_router.delete("/{album_id}")
async def delete_album(album_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an album and all its media"""
    album = await db.albums.find_one({"album_id": album_id})
    
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    if album["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete associated posts
    await db.posts.delete_many({"album_id": album_id})
    
    # Delete album
    await db.albums.delete_one({"album_id": album_id})
    
    return {"message": "Album deleted", "album_id": album_id}

# ============== MEDIA ITEM ROUTES ==============

@album_router.post("/{album_id}/add-media")
async def add_media_to_album(
    album_id: str,
    data: MediaItemAdd,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Add media to an album"""
    album = await db.albums.find_one({"album_id": album_id})
    
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    if album["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    media_id = f"media_{uuid.uuid4().hex[:12]}"
    
    media_item = {
        "media_id": media_id,
        "media_url": data.media_url,
        "media_type": data.media_type,
        "title": data.title,
        "description": data.description,
        "thumbnail_url": data.thumbnail_url,
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update album
    await db.albums.update_one(
        {"album_id": album_id},
        {
            "$push": {"media_items": media_item},
            "$inc": {"media_count": 1},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Set cover image if first item
    if album["media_count"] == 0 and data.media_type in ["image", "video"]:
        cover_url = data.thumbnail_url or data.media_url
        await db.albums.update_one(
            {"album_id": album_id},
            {"$set": {"cover_image": cover_url}}
        )
    
    # Auto-post to feed if public album
    if album["privacy"] == "public" and album.get("auto_post_to_feed", True):
        background_tasks.add_task(
            create_feed_post_from_media,
            current_user["user_id"],
            album_id,
            data.media_url,
            data.media_type,
            data.title
        )
    
    return {
        "message": "Media added to album",
        "media_id": media_id,
        "album_id": album_id
    }

@album_router.post("/{album_id}/upload")
async def upload_media_to_album(
    album_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(None),
    description: str = Form(None),
    current_user: dict = Depends(get_current_user)
):
    """Upload and add media file to album"""
    album = await db.albums.find_one({"album_id": album_id})
    
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    if album["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Read file
    content = await file.read()
    content_type = file.content_type or ""
    
    # Determine media type
    if content_type.startswith("image/"):
        media_type = "image"
    elif content_type.startswith("video/"):
        media_type = "video"
    elif content_type.startswith("audio/"):
        media_type = "audio"
    else:
        raise HTTPException(status_code=400, detail="Unsupported media type")
    
    # Generate unique filename
    ext = Path(file.filename or "file").suffix or ".bin"
    unique_id = uuid.uuid4().hex[:12]
    filename = f"{media_type}_{unique_id}{ext}"
    file_path = UPLOAD_DIR / filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    media_url = f"/api/upload/files/{filename}"
    thumbnail_url = None
    
    # Generate thumbnail for video
    if media_type == "video":
        thumb_filename = f"thumb_{unique_id}.jpg"
        thumb_path = THUMBNAIL_DIR / thumb_filename
        
        if generate_video_thumbnail(str(file_path), str(thumb_path)):
            thumbnail_url = f"/api/upload/files/thumbnails/{thumb_filename}"
        
        # Generate GIF preview
        gif_filename = f"preview_{unique_id}.gif"
        gif_path = THUMBNAIL_DIR / gif_filename
        generate_video_preview_gif(str(file_path), str(gif_path), duration=3)
    
    # Add to album
    media_id = f"media_{unique_id}"
    
    media_item = {
        "media_id": media_id,
        "media_url": media_url,
        "media_type": media_type,
        "title": title,
        "description": description,
        "thumbnail_url": thumbnail_url,
        "original_filename": file.filename,
        "file_size": len(content),
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Update album
    await db.albums.update_one(
        {"album_id": album_id},
        {
            "$push": {"media_items": media_item},
            "$inc": {"media_count": 1},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Set cover image if first item
    if album["media_count"] == 0:
        cover_url = thumbnail_url or media_url
        await db.albums.update_one(
            {"album_id": album_id},
            {"$set": {"cover_image": cover_url}}
        )
    
    # Auto-post to feed if public
    if album["privacy"] == "public" and album.get("auto_post_to_feed", True):
        background_tasks.add_task(
            create_feed_post_from_media,
            current_user["user_id"],
            album_id,
            media_url,
            media_type,
            title
        )
    
    return {
        "message": "Media uploaded and added to album",
        "media_id": media_id,
        "media_url": media_url,
        "thumbnail_url": thumbnail_url,
        "album_id": album_id
    }

@album_router.delete("/{album_id}/media/{media_id}")
async def remove_media_from_album(
    album_id: str,
    media_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Remove media from album"""
    album = await db.albums.find_one({"album_id": album_id})
    
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    
    if album["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.albums.update_one(
        {"album_id": album_id},
        {
            "$pull": {"media_items": {"media_id": media_id}},
            "$inc": {"media_count": -1},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Delete associated feed post
    await db.posts.delete_many({
        "album_id": album_id,
        "media_urls": {"$elemMatch": {"$regex": media_id}}
    })
    
    return {"message": "Media removed from album"}

# ============== VIDEO PROCESSING ROUTES ==============

@album_router.post("/generate-thumbnail")
async def generate_thumbnail_from_video(
    video_url: str,
    time: str = "00:00:01",
    current_user: dict = Depends(get_current_user)
):
    """Generate a thumbnail from a video URL"""
    # Handle data URL
    if video_url.startswith("data:"):
        parts = video_url.split(",")
        if len(parts) != 2:
            raise HTTPException(status_code=400, detail="Invalid data URL")
        
        video_bytes = base64.b64decode(parts[1])
        
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(video_bytes)
            video_path = tmp.name
    else:
        # Assume it's a file path
        video_path = str(UPLOAD_DIR / video_url.split("/")[-1])
        if not os.path.exists(video_path):
            raise HTTPException(status_code=404, detail="Video file not found")
    
    # Generate thumbnail
    unique_id = uuid.uuid4().hex[:12]
    thumb_filename = f"thumb_{unique_id}.jpg"
    thumb_path = THUMBNAIL_DIR / thumb_filename
    
    if not generate_video_thumbnail(video_path, str(thumb_path), time):
        raise HTTPException(status_code=500, detail="Failed to generate thumbnail")
    
    # Read thumbnail and convert to base64
    with open(thumb_path, "rb") as f:
        thumb_bytes = f.read()
    
    thumb_base64 = base64.b64encode(thumb_bytes).decode("utf-8")
    
    # Clean up temp file if data URL
    if video_url.startswith("data:"):
        os.unlink(video_path)
    
    return {
        "thumbnail_url": f"/api/upload/files/thumbnails/{thumb_filename}",
        "thumbnail_base64": f"data:image/jpeg;base64,{thumb_base64}"
    }

@album_router.post("/generate-preview-gif")
async def generate_preview_gif(
    video_url: str,
    duration: int = 3,
    current_user: dict = Depends(get_current_user)
):
    """Generate a looping GIF preview from video"""
    # Handle data URL
    if video_url.startswith("data:"):
        parts = video_url.split(",")
        video_bytes = base64.b64decode(parts[1])
        
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(video_bytes)
            video_path = tmp.name
    else:
        video_path = str(UPLOAD_DIR / video_url.split("/")[-1])
        if not os.path.exists(video_path):
            raise HTTPException(status_code=404, detail="Video file not found")
    
    # Generate GIF
    unique_id = uuid.uuid4().hex[:12]
    gif_filename = f"preview_{unique_id}.gif"
    gif_path = THUMBNAIL_DIR / gif_filename
    
    if not generate_video_preview_gif(video_path, str(gif_path), duration):
        raise HTTPException(status_code=500, detail="Failed to generate GIF preview")
    
    # Read GIF
    with open(gif_path, "rb") as f:
        gif_bytes = f.read()
    
    gif_base64 = base64.b64encode(gif_bytes).decode("utf-8")
    
    if video_url.startswith("data:"):
        os.unlink(video_path)
    
    return {
        "gif_url": f"/api/upload/files/thumbnails/{gif_filename}",
        "gif_base64": f"data:image/gif;base64,{gif_base64}"
    }

# Export router
def get_album_router():
    return album_router
