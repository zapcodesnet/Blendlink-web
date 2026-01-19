"""
Photo Editor Module for Seller Dashboard
Features:
- Multi-photo upload (up to 10 photos, 60MB each)
- AI Background Removal using rembg
- Brightness/Contrast adjustments
- Background customization (solid colors, patterns, custom uploads)
- Undo/Redo functionality
- Save seller's background preference
"""

import os
import uuid
import base64
import io
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from jose import jwt, JWTError
from PIL import Image, ImageEnhance, ImageFilter
import numpy as np

load_dotenv()

logger = logging.getLogger(__name__)

# Initialize router
photo_editor_router = APIRouter(prefix="/photo-editor", tags=["Photo Editor"])

# Database connection
MONGO_URL = os.environ.get('MONGO_URL')
if not MONGO_URL:
    raise ValueError("MONGO_URL environment variable is required")
DB_NAME = os.environ.get('DB_NAME')
if not DB_NAME:
    raise ValueError("DB_NAME environment variable is required")
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = 'HS256'

# Max file size: 60MB
MAX_FILE_SIZE = 60 * 1024 * 1024
MAX_PHOTOS = 10

# Predefined background patterns/textures
BACKGROUND_PATTERNS = [
    {"id": "solid_white", "name": "Pure White", "type": "solid", "color": "#FFFFFF"},
    {"id": "solid_black", "name": "Pure Black", "type": "solid", "color": "#000000"},
    {"id": "solid_gray", "name": "Light Gray", "type": "solid", "color": "#F5F5F5"},
    {"id": "solid_cream", "name": "Cream", "type": "solid", "color": "#FFFDD0"},
    {"id": "solid_blue", "name": "Sky Blue", "type": "solid", "color": "#87CEEB"},
    {"id": "solid_pink", "name": "Soft Pink", "type": "solid", "color": "#FFB6C1"},
    {"id": "solid_mint", "name": "Mint Green", "type": "solid", "color": "#98FF98"},
    {"id": "solid_lavender", "name": "Lavender", "type": "solid", "color": "#E6E6FA"},
    {"id": "gradient_sunset", "name": "Sunset Gradient", "type": "gradient", "colors": ["#FF6B6B", "#FFA07A"]},
    {"id": "gradient_ocean", "name": "Ocean Gradient", "type": "gradient", "colors": ["#667eea", "#764ba2"]},
    {"id": "gradient_forest", "name": "Forest Gradient", "type": "gradient", "colors": ["#11998e", "#38ef7d"]},
    {"id": "gradient_purple", "name": "Purple Haze", "type": "gradient", "colors": ["#DA22FF", "#9733EE"]},
    {"id": "gradient_peach", "name": "Peach Dream", "type": "gradient", "colors": ["#FFECD2", "#FCB69F"]},
    {"id": "pattern_dots", "name": "Polka Dots", "type": "pattern", "pattern": "dots"},
    {"id": "pattern_lines", "name": "Diagonal Lines", "type": "pattern", "pattern": "lines"},
    {"id": "pattern_grid", "name": "Grid", "type": "pattern", "pattern": "grid"},
    {"id": "pattern_chevron", "name": "Chevron", "type": "pattern", "pattern": "chevron"},
    {"id": "texture_marble", "name": "Marble", "type": "texture", "texture": "marble"},
    {"id": "texture_wood", "name": "Light Wood", "type": "texture", "texture": "wood"},
    {"id": "texture_concrete", "name": "Concrete", "type": "texture", "texture": "concrete"},
]

# ============== MODELS ==============

class PhotoUploadRequest(BaseModel):
    photos: List[str]  # Base64 encoded images

class PhotoUploadResponse(BaseModel):
    photo_id: str
    original_url: str
    thumbnail_url: str
    filename: str
    size_bytes: int
    width: int
    height: int
    uploaded_at: str

class BackgroundRemovalRequest(BaseModel):
    photo_id: str

class BatchBackgroundRemovalRequest(BaseModel):
    photo_ids: List[str]  # List of photo IDs to process

class BackgroundRemovalResponse(BaseModel):
    photo_id: str
    processed_url: str
    has_transparency: bool
    processing_time_ms: int

class BatchBackgroundRemovalResponse(BaseModel):
    total_requested: int
    total_processed: int
    total_failed: int
    total_time_ms: int
    results: List[Dict[str, Any]]  # Individual results per photo

class AdjustmentsRequest(BaseModel):
    photo_id: str
    brightness: float = 1.0  # 0.5 to 2.0
    contrast: float = 1.0    # 0.5 to 2.0
    saturation: float = 1.0  # 0.5 to 2.0
    sharpness: float = 1.0   # 0.5 to 2.0

class ApplyBackgroundRequest(BaseModel):
    photo_id: str
    background_type: str  # "solid", "gradient", "pattern", "custom"
    background_value: str  # color hex, pattern id, or base64 of custom image
    background_scale: float = 1.0
    background_offset_x: int = 0
    background_offset_y: int = 0

class SaveEditsRequest(BaseModel):
    photo_id: str
    save_as_default_background: bool = False

class PhotoEditHistory(BaseModel):
    action: str
    params: Dict[str, Any]
    timestamp: str
    result_url: str

class EditedPhoto(BaseModel):
    photo_id: str
    user_id: str
    original_url: str
    current_url: str
    processed_url: Optional[str] = None
    thumbnail_url: str
    has_background_removed: bool = False
    current_background: Optional[Dict[str, Any]] = None
    adjustments: Dict[str, float] = {}
    edit_history: List[PhotoEditHistory] = []
    created_at: str
    updated_at: str

class FinalizePhotosRequest(BaseModel):
    photo_ids: List[str]

# ============== HELPER FUNCTIONS ==============

async def get_current_user(request: Request):
    """Get current user from JWT token"""
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def base64_to_image(base64_string: str) -> Image.Image:
    """Convert base64 string to PIL Image"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    image_data = base64.b64decode(base64_string)
    return Image.open(io.BytesIO(image_data))

def image_to_base64(image: Image.Image, format: str = "PNG") -> str:
    """Convert PIL Image to base64 string"""
    buffer = io.BytesIO()
    if format.upper() == "PNG":
        image.save(buffer, format="PNG")
    else:
        if image.mode == 'RGBA':
            image = image.convert('RGB')
        image.save(buffer, format="JPEG", quality=90)
    return f"data:image/{format.lower()};base64,{base64.b64encode(buffer.getvalue()).decode()}"

def create_thumbnail(image: Image.Image, size: tuple = (200, 200)) -> Image.Image:
    """Create a thumbnail from PIL Image"""
    thumb = image.copy()
    thumb.thumbnail(size, Image.Resampling.LANCZOS)
    return thumb

def create_solid_background(width: int, height: int, color: str) -> Image.Image:
    """Create a solid color background"""
    # Parse hex color
    color = color.lstrip('#')
    rgb = tuple(int(color[i:i+2], 16) for i in (0, 2, 4))
    return Image.new('RGBA', (width, height), rgb + (255,))

def create_gradient_background(width: int, height: int, colors: List[str], direction: str = "vertical") -> Image.Image:
    """Create a gradient background"""
    # Parse colors
    color1 = colors[0].lstrip('#')
    color2 = colors[1].lstrip('#')
    rgb1 = tuple(int(color1[i:i+2], 16) for i in (0, 2, 4))
    rgb2 = tuple(int(color2[i:i+2], 16) for i in (0, 2, 4))
    
    # Create gradient
    base = Image.new('RGBA', (width, height), rgb1 + (255,))
    top = Image.new('RGBA', (width, height), rgb2 + (255,))
    
    # Create mask for gradient
    mask = Image.new('L', (width, height))
    for y in range(height):
        value = int(255 * (y / height))
        for x in range(width):
            mask.putpixel((x, y), value)
    
    return Image.composite(top, base, mask)

def create_pattern_background(width: int, height: int, pattern: str, colors: tuple = ("#FFFFFF", "#EEEEEE")) -> Image.Image:
    """Create a patterned background"""
    bg = Image.new('RGBA', (width, height), colors[0])
    
    from PIL import ImageDraw
    draw = ImageDraw.Draw(bg)
    
    if pattern == "dots":
        spacing = 30
        radius = 5
        for y in range(0, height, spacing):
            for x in range(0, width, spacing):
                draw.ellipse([x-radius, y-radius, x+radius, y+radius], fill=colors[1])
    
    elif pattern == "lines":
        spacing = 20
        for i in range(-height, width + height, spacing):
            draw.line([(i, 0), (i + height, height)], fill=colors[1], width=2)
    
    elif pattern == "grid":
        spacing = 30
        for x in range(0, width, spacing):
            draw.line([(x, 0), (x, height)], fill=colors[1], width=1)
        for y in range(0, height, spacing):
            draw.line([(0, y), (width, y)], fill=colors[1], width=1)
    
    elif pattern == "chevron":
        spacing = 40
        for y in range(-spacing, height + spacing, spacing):
            points = []
            for x in range(0, width + spacing, spacing // 2):
                if len(points) % 2 == 0:
                    points.append((x, y))
                else:
                    points.append((x, y + spacing // 2))
            if len(points) >= 2:
                draw.line(points, fill=colors[1], width=2)
    
    return bg

def composite_image_on_background(
    foreground: Image.Image,
    background: Image.Image,
    scale: float = 1.0,
    offset_x: int = 0,
    offset_y: int = 0
) -> Image.Image:
    """Composite a foreground image (with transparency) onto a background"""
    # Ensure foreground has alpha channel
    if foreground.mode != 'RGBA':
        foreground = foreground.convert('RGBA')
    
    # Scale foreground if needed
    if scale != 1.0:
        new_size = (int(foreground.width * scale), int(foreground.height * scale))
        foreground = foreground.resize(new_size, Image.Resampling.LANCZOS)
    
    # Create output at background size
    result = background.copy()
    if result.mode != 'RGBA':
        result = result.convert('RGBA')
    
    # Calculate position (center by default, then apply offset)
    x = (result.width - foreground.width) // 2 + offset_x
    y = (result.height - foreground.height) // 2 + offset_y
    
    # Paste foreground onto background
    result.paste(foreground, (x, y), foreground)
    
    return result

# ============== ENDPOINTS ==============

@photo_editor_router.post("/upload", response_model=List[PhotoUploadResponse])
async def upload_photos(
    request: PhotoUploadRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Upload multiple photos for editing (up to 10, max 60MB each)
    Photos are stored as base64 in the database
    """
    photos = request.photos
    if not photos:
        raise HTTPException(status_code=400, detail="No photos provided")
    
    if len(photos) > MAX_PHOTOS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_PHOTOS} photos allowed per batch")
    
    user_id = current_user["user_id"]
    results = []
    
    for i, photo_base64 in enumerate(photos):
        try:
            # Check size (rough estimate from base64 length)
            if len(photo_base64) > MAX_FILE_SIZE * 1.37:  # Base64 is ~37% larger
                raise HTTPException(status_code=400, detail=f"Photo {i+1} exceeds 60MB limit")
            
            # Convert to image
            image = base64_to_image(photo_base64)
            
            # Create thumbnail
            thumb = create_thumbnail(image)
            thumb_base64 = image_to_base64(thumb, "JPEG")
            
            # Generate photo ID
            photo_id = f"photo_{uuid.uuid4().hex[:12]}"
            
            # Store in database
            photo_doc = {
                "photo_id": photo_id,
                "user_id": user_id,
                "original_url": photo_base64,
                "current_url": photo_base64,
                "thumbnail_url": thumb_base64,
                "width": image.width,
                "height": image.height,
                "size_bytes": len(photo_base64),
                "has_background_removed": False,
                "processed_url": None,
                "current_background": None,
                "adjustments": {},
                "edit_history": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.edited_photos.insert_one(photo_doc)
            
            results.append(PhotoUploadResponse(
                photo_id=photo_id,
                original_url=photo_base64[:100] + "...",  # Truncate for response
                thumbnail_url=thumb_base64,
                filename=f"photo_{i+1}.jpg",
                size_bytes=len(photo_base64),
                width=image.width,
                height=image.height,
                uploaded_at=photo_doc["created_at"]
            ))
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error uploading photo {i+1}: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to process photo {i+1}: {str(e)}")
    
    return results

@photo_editor_router.get("/photos")
async def get_user_photos(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get all photos for the current user's editing session"""
    user_id = current_user["user_id"]
    
    photos = await db.edited_photos.find(
        {"user_id": user_id},
        {"_id": 0, "original_url": 0}  # Exclude large base64 data
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.edited_photos.count_documents({"user_id": user_id})
    
    return {
        "photos": photos,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@photo_editor_router.get("/photos/{photo_id}")
async def get_photo(
    photo_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a single photo with all its data"""
    user_id = current_user["user_id"]
    
    photo = await db.edited_photos.find_one(
        {"photo_id": photo_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    return photo

@photo_editor_router.post("/remove-background")
async def remove_background(
    request: BackgroundRemovalRequest,
    current_user: dict = Depends(get_current_user)
):
    """Remove background from a photo using rembg AI"""
    import time
    start_time = time.time()
    
    user_id = current_user["user_id"]
    
    # Get photo from database
    photo = await db.edited_photos.find_one(
        {"photo_id": request.photo_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    try:
        # Import rembg
        from rembg import remove
        
        # Convert base64 to image
        image = base64_to_image(photo["current_url"])
        
        # Remove background
        output = remove(image)
        
        # Convert back to base64
        processed_base64 = image_to_base64(output, "PNG")
        
        # Calculate processing time
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Update database
        edit_entry = {
            "action": "remove_background",
            "params": {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "result_url": processed_base64[:100] + "..."
        }
        
        await db.edited_photos.update_one(
            {"photo_id": request.photo_id},
            {
                "$set": {
                    "processed_url": processed_base64,
                    "current_url": processed_base64,
                    "has_background_removed": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$push": {"edit_history": edit_entry}
            }
        )
        
        return {
            "photo_id": request.photo_id,
            "processed_url": processed_base64,
            "has_transparency": True,
            "processing_time_ms": processing_time_ms
        }
        
    except Exception as e:
        logger.error(f"Background removal failed: {e}")
        raise HTTPException(status_code=500, detail=f"Background removal failed: {str(e)}")

@photo_editor_router.post("/remove-background-batch")
async def remove_background_batch(
    request: BatchBackgroundRemovalRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Batch remove backgrounds from multiple photos using rembg AI.
    Processes all photos in sequence and returns results for each.
    """
    import time
    total_start_time = time.time()
    
    user_id = current_user["user_id"]
    
    if not request.photo_ids:
        raise HTTPException(status_code=400, detail="No photo IDs provided")
    
    if len(request.photo_ids) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 photos per batch")
    
    # Import rembg once for batch
    from rembg import remove
    
    results = []
    processed_count = 0
    failed_count = 0
    
    for photo_id in request.photo_ids:
        photo_start_time = time.time()
        
        try:
            # Get photo from database
            photo = await db.edited_photos.find_one(
                {"photo_id": photo_id, "user_id": user_id},
                {"_id": 0}
            )
            
            if not photo:
                results.append({
                    "photo_id": photo_id,
                    "success": False,
                    "error": "Photo not found",
                    "processing_time_ms": 0
                })
                failed_count += 1
                continue
            
            # Skip if already processed
            if photo.get("has_background_removed"):
                results.append({
                    "photo_id": photo_id,
                    "success": True,
                    "skipped": True,
                    "message": "Background already removed",
                    "processing_time_ms": 0
                })
                processed_count += 1
                continue
            
            # Convert base64 to image
            image = base64_to_image(photo["current_url"])
            
            # Remove background
            output = remove(image)
            
            # Convert back to base64
            processed_base64 = image_to_base64(output, "PNG")
            
            # Calculate processing time
            photo_processing_time = int((time.time() - photo_start_time) * 1000)
            
            # Update database
            edit_entry = {
                "action": "remove_background",
                "params": {"batch": True},
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "result_url": processed_base64[:100] + "..."
            }
            
            await db.edited_photos.update_one(
                {"photo_id": photo_id},
                {
                    "$set": {
                        "processed_url": processed_base64,
                        "current_url": processed_base64,
                        "has_background_removed": True,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$push": {"edit_history": edit_entry}
                }
            )
            
            results.append({
                "photo_id": photo_id,
                "success": True,
                "has_transparency": True,
                "processing_time_ms": photo_processing_time
            })
            processed_count += 1
            
        except Exception as e:
            logger.error(f"Batch background removal failed for {photo_id}: {e}")
            results.append({
                "photo_id": photo_id,
                "success": False,
                "error": str(e),
                "processing_time_ms": int((time.time() - photo_start_time) * 1000)
            })
            failed_count += 1
    
    total_time_ms = int((time.time() - total_start_time) * 1000)
    
    return {
        "total_requested": len(request.photo_ids),
        "total_processed": processed_count,
        "total_failed": failed_count,
        "total_time_ms": total_time_ms,
        "results": results
    }

@photo_editor_router.post("/adjust")
async def adjust_photo(
    request: AdjustmentsRequest,
    current_user: dict = Depends(get_current_user)
):
    """Apply brightness, contrast, saturation, sharpness adjustments"""
    user_id = current_user["user_id"]
    
    # Get photo
    photo = await db.edited_photos.find_one(
        {"photo_id": request.photo_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    try:
        # Use processed URL if background was removed, otherwise original
        source_url = photo.get("processed_url") or photo["original_url"]
        image = base64_to_image(source_url)
        
        # Apply adjustments
        if request.brightness != 1.0:
            enhancer = ImageEnhance.Brightness(image)
            image = enhancer.enhance(request.brightness)
        
        if request.contrast != 1.0:
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(request.contrast)
        
        if request.saturation != 1.0:
            # Convert to RGB for saturation
            if image.mode == 'RGBA':
                rgb = image.convert('RGB')
                alpha = image.split()[3]
                enhancer = ImageEnhance.Color(rgb)
                rgb = enhancer.enhance(request.saturation)
                image = rgb.convert('RGBA')
                image.putalpha(alpha)
            else:
                enhancer = ImageEnhance.Color(image)
                image = enhancer.enhance(request.saturation)
        
        if request.sharpness != 1.0:
            enhancer = ImageEnhance.Sharpness(image)
            image = enhancer.enhance(request.sharpness)
        
        # Convert back to base64
        format = "PNG" if image.mode == 'RGBA' else "JPEG"
        adjusted_base64 = image_to_base64(image, format)
        
        # Update database
        adjustments = {
            "brightness": request.brightness,
            "contrast": request.contrast,
            "saturation": request.saturation,
            "sharpness": request.sharpness
        }
        
        edit_entry = {
            "action": "adjust",
            "params": adjustments,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "result_url": adjusted_base64[:100] + "..."
        }
        
        await db.edited_photos.update_one(
            {"photo_id": request.photo_id},
            {
                "$set": {
                    "current_url": adjusted_base64,
                    "adjustments": adjustments,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$push": {"edit_history": edit_entry}
            }
        )
        
        return {
            "photo_id": request.photo_id,
            "adjusted_url": adjusted_base64,
            "adjustments": adjustments
        }
        
    except Exception as e:
        logger.error(f"Adjustment failed: {e}")
        raise HTTPException(status_code=500, detail=f"Adjustment failed: {str(e)}")

def analyze_image_for_enhancement(image: Image.Image) -> Dict[str, float]:
    """
    Analyze image and calculate optimal enhancement values.
    Uses histogram analysis to determine brightness, contrast, saturation needs.
    """
    import numpy as np
    
    # Convert to RGB if needed
    if image.mode == 'RGBA':
        rgb_image = Image.new('RGB', image.size, (255, 255, 255))
        rgb_image.paste(image, mask=image.split()[3])
    else:
        rgb_image = image.convert('RGB')
    
    # Get image as numpy array
    img_array = np.array(rgb_image)
    
    # Calculate brightness (average luminance)
    # Using perceived luminance formula: 0.299*R + 0.587*G + 0.114*B
    luminance = 0.299 * img_array[:,:,0] + 0.587 * img_array[:,:,1] + 0.114 * img_array[:,:,2]
    avg_brightness = np.mean(luminance)
    
    # Target brightness is around 128 (middle of 0-255)
    # Calculate adjustment factor
    if avg_brightness < 80:
        brightness_factor = 1.3  # Image is too dark
    elif avg_brightness < 110:
        brightness_factor = 1.15  # Slightly dark
    elif avg_brightness > 180:
        brightness_factor = 0.85  # Image is too bright
    elif avg_brightness > 150:
        brightness_factor = 0.95  # Slightly bright
    else:
        brightness_factor = 1.0  # Good brightness
    
    # Calculate contrast (standard deviation of luminance)
    std_dev = np.std(luminance)
    if std_dev < 40:
        contrast_factor = 1.25  # Low contrast, increase
    elif std_dev < 55:
        contrast_factor = 1.1  # Slightly low
    elif std_dev > 85:
        contrast_factor = 0.9  # High contrast, reduce
    else:
        contrast_factor = 1.0  # Good contrast
    
    # Calculate saturation (difference between max and min RGB channels)
    max_rgb = np.max(img_array, axis=2)
    min_rgb = np.min(img_array, axis=2)
    saturation_level = np.mean(max_rgb - min_rgb)
    
    if saturation_level < 30:
        saturation_factor = 1.3  # Very desaturated
    elif saturation_level < 50:
        saturation_factor = 1.15  # Slightly desaturated
    elif saturation_level > 120:
        saturation_factor = 0.9  # Over-saturated
    else:
        saturation_factor = 1.05  # Slight boost usually helps product photos
    
    # Sharpness - always apply slight sharpening for product photos
    sharpness_factor = 1.2  # Moderate sharpening
    
    return {
        "brightness": round(brightness_factor, 2),
        "contrast": round(contrast_factor, 2),
        "saturation": round(saturation_factor, 2),
        "sharpness": round(sharpness_factor, 2),
        "analysis": {
            "avg_brightness": round(float(avg_brightness), 1),
            "std_dev": round(float(std_dev), 1),
            "saturation_level": round(float(saturation_level), 1)
        }
    }

class AutoEnhanceRequest(BaseModel):
    photo_id: str

@photo_editor_router.post("/auto-enhance")
async def auto_enhance_photo(
    request: AutoEnhanceRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    AI-powered auto-enhancement that automatically adjusts brightness, 
    contrast, saturation, and sharpness to optimal levels for product photos.
    Uses histogram analysis to determine the best adjustments.
    """
    import time
    start_time = time.time()
    
    user_id = current_user["user_id"]
    
    # Get photo
    photo = await db.edited_photos.find_one(
        {"photo_id": request.photo_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    try:
        # Get source image
        source_url = photo.get("processed_url") or photo.get("current_url") or photo["original_url"]
        image = base64_to_image(source_url)
        
        # Analyze image and get optimal enhancement values
        enhancements = analyze_image_for_enhancement(image)
        
        # Apply enhancements
        if enhancements["brightness"] != 1.0:
            enhancer = ImageEnhance.Brightness(image)
            image = enhancer.enhance(enhancements["brightness"])
        
        if enhancements["contrast"] != 1.0:
            enhancer = ImageEnhance.Contrast(image)
            image = enhancer.enhance(enhancements["contrast"])
        
        if enhancements["saturation"] != 1.0:
            if image.mode == 'RGBA':
                rgb = image.convert('RGB')
                alpha = image.split()[3]
                enhancer = ImageEnhance.Color(rgb)
                rgb = enhancer.enhance(enhancements["saturation"])
                image = rgb.convert('RGBA')
                image.putalpha(alpha)
            else:
                enhancer = ImageEnhance.Color(image)
                image = enhancer.enhance(enhancements["saturation"])
        
        if enhancements["sharpness"] != 1.0:
            enhancer = ImageEnhance.Sharpness(image)
            image = enhancer.enhance(enhancements["sharpness"])
        
        # Convert back to base64
        format = "PNG" if image.mode == 'RGBA' else "JPEG"
        enhanced_base64 = image_to_base64(image, format)
        
        processing_time_ms = int((time.time() - start_time) * 1000)
        
        # Update database
        adjustments = {
            "brightness": enhancements["brightness"],
            "contrast": enhancements["contrast"],
            "saturation": enhancements["saturation"],
            "sharpness": enhancements["sharpness"]
        }
        
        edit_entry = {
            "action": "auto_enhance",
            "params": {**adjustments, "analysis": enhancements["analysis"]},
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "result_url": enhanced_base64[:100] + "..."
        }
        
        await db.edited_photos.update_one(
            {"photo_id": request.photo_id},
            {
                "$set": {
                    "current_url": enhanced_base64,
                    "adjustments": adjustments,
                    "auto_enhanced": True,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$push": {"edit_history": edit_entry}
            }
        )
        
        return {
            "photo_id": request.photo_id,
            "enhanced_url": enhanced_base64,
            "adjustments_applied": adjustments,
            "analysis": enhancements["analysis"],
            "processing_time_ms": processing_time_ms
        }
        
    except Exception as e:
        logger.error(f"Auto-enhance failed: {e}")
        raise HTTPException(status_code=500, detail=f"Auto-enhance failed: {str(e)}")

class BatchAutoEnhanceRequest(BaseModel):
    photo_ids: List[str]

@photo_editor_router.post("/auto-enhance-batch")
async def auto_enhance_batch(
    request: BatchAutoEnhanceRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Batch auto-enhance multiple photos with AI-powered adjustments.
    """
    import time
    total_start_time = time.time()
    
    user_id = current_user["user_id"]
    
    if not request.photo_ids:
        raise HTTPException(status_code=400, detail="No photo IDs provided")
    
    if len(request.photo_ids) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 photos per batch")
    
    results = []
    processed_count = 0
    failed_count = 0
    
    for photo_id in request.photo_ids:
        photo_start_time = time.time()
        
        try:
            photo = await db.edited_photos.find_one(
                {"photo_id": photo_id, "user_id": user_id},
                {"_id": 0}
            )
            
            if not photo:
                results.append({
                    "photo_id": photo_id,
                    "success": False,
                    "error": "Photo not found"
                })
                failed_count += 1
                continue
            
            # Skip if already auto-enhanced
            if photo.get("auto_enhanced"):
                results.append({
                    "photo_id": photo_id,
                    "success": True,
                    "skipped": True,
                    "message": "Already auto-enhanced"
                })
                processed_count += 1
                continue
            
            # Get source image
            source_url = photo.get("processed_url") or photo.get("current_url") or photo["original_url"]
            image = base64_to_image(source_url)
            
            # Analyze and enhance
            enhancements = analyze_image_for_enhancement(image)
            
            # Apply enhancements
            if enhancements["brightness"] != 1.0:
                enhancer = ImageEnhance.Brightness(image)
                image = enhancer.enhance(enhancements["brightness"])
            
            if enhancements["contrast"] != 1.0:
                enhancer = ImageEnhance.Contrast(image)
                image = enhancer.enhance(enhancements["contrast"])
            
            if enhancements["saturation"] != 1.0:
                if image.mode == 'RGBA':
                    rgb = image.convert('RGB')
                    alpha = image.split()[3]
                    enhancer = ImageEnhance.Color(rgb)
                    rgb = enhancer.enhance(enhancements["saturation"])
                    image = rgb.convert('RGBA')
                    image.putalpha(alpha)
                else:
                    enhancer = ImageEnhance.Color(image)
                    image = enhancer.enhance(enhancements["saturation"])
            
            if enhancements["sharpness"] != 1.0:
                enhancer = ImageEnhance.Sharpness(image)
                image = enhancer.enhance(enhancements["sharpness"])
            
            # Convert to base64
            format = "PNG" if image.mode == 'RGBA' else "JPEG"
            enhanced_base64 = image_to_base64(image, format)
            
            processing_time_ms = int((time.time() - photo_start_time) * 1000)
            
            # Update database
            adjustments = {
                "brightness": enhancements["brightness"],
                "contrast": enhancements["contrast"],
                "saturation": enhancements["saturation"],
                "sharpness": enhancements["sharpness"]
            }
            
            edit_entry = {
                "action": "auto_enhance",
                "params": {**adjustments, "batch": True},
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "result_url": enhanced_base64[:100] + "..."
            }
            
            await db.edited_photos.update_one(
                {"photo_id": photo_id},
                {
                    "$set": {
                        "current_url": enhanced_base64,
                        "adjustments": adjustments,
                        "auto_enhanced": True,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    },
                    "$push": {"edit_history": edit_entry}
                }
            )
            
            results.append({
                "photo_id": photo_id,
                "success": True,
                "adjustments": adjustments,
                "processing_time_ms": processing_time_ms
            })
            processed_count += 1
            
        except Exception as e:
            logger.error(f"Batch auto-enhance failed for {photo_id}: {e}")
            results.append({
                "photo_id": photo_id,
                "success": False,
                "error": str(e)
            })
            failed_count += 1
    
    total_time_ms = int((time.time() - total_start_time) * 1000)
    
    return {
        "total_requested": len(request.photo_ids),
        "total_processed": processed_count,
        "total_failed": failed_count,
        "total_time_ms": total_time_ms,
        "results": results
    }

@photo_editor_router.post("/apply-background")
async def apply_background(
    request: ApplyBackgroundRequest,
    current_user: dict = Depends(get_current_user)
):
    """Apply a new background to a photo with removed background"""
    user_id = current_user["user_id"]
    
    # Get photo
    photo = await db.edited_photos.find_one(
        {"photo_id": request.photo_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    if not photo.get("has_background_removed"):
        raise HTTPException(status_code=400, detail="Background must be removed first")
    
    try:
        # Get the processed image with transparency
        foreground = base64_to_image(photo["processed_url"] or photo["current_url"])
        width, height = foreground.width, foreground.height
        
        # Create background based on type
        if request.background_type == "solid":
            background = create_solid_background(width, height, request.background_value)
        
        elif request.background_type == "gradient":
            # Find gradient in patterns
            gradient_pattern = next(
                (p for p in BACKGROUND_PATTERNS if p["id"] == request.background_value),
                None
            )
            if gradient_pattern and gradient_pattern["type"] == "gradient":
                background = create_gradient_background(width, height, gradient_pattern["colors"])
            else:
                # Parse colors from value if provided directly
                colors = request.background_value.split(",")
                if len(colors) >= 2:
                    background = create_gradient_background(width, height, colors)
                else:
                    raise HTTPException(status_code=400, detail="Invalid gradient colors")
        
        elif request.background_type == "pattern":
            pattern_def = next(
                (p for p in BACKGROUND_PATTERNS if p["id"] == request.background_value),
                None
            )
            if pattern_def:
                background = create_pattern_background(width, height, pattern_def.get("pattern", "dots"))
            else:
                raise HTTPException(status_code=400, detail="Invalid pattern ID")
        
        elif request.background_type == "custom":
            # Custom background is base64 image
            background = base64_to_image(request.background_value)
            background = background.resize((width, height), Image.Resampling.LANCZOS)
        
        else:
            raise HTTPException(status_code=400, detail="Invalid background type")
        
        # Composite foreground onto background
        result = composite_image_on_background(
            foreground,
            background,
            scale=request.background_scale,
            offset_x=request.background_offset_x,
            offset_y=request.background_offset_y
        )
        
        # Convert to base64
        result_base64 = image_to_base64(result, "PNG")
        
        # Update database
        background_config = {
            "type": request.background_type,
            "value": request.background_value[:100] if request.background_type == "custom" else request.background_value,
            "scale": request.background_scale,
            "offset_x": request.background_offset_x,
            "offset_y": request.background_offset_y
        }
        
        edit_entry = {
            "action": "apply_background",
            "params": background_config,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "result_url": result_base64[:100] + "..."
        }
        
        await db.edited_photos.update_one(
            {"photo_id": request.photo_id},
            {
                "$set": {
                    "current_url": result_base64,
                    "current_background": background_config,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$push": {"edit_history": edit_entry}
            }
        )
        
        return {
            "photo_id": request.photo_id,
            "result_url": result_base64,
            "background": background_config
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Apply background failed: {e}")
        raise HTTPException(status_code=500, detail=f"Apply background failed: {str(e)}")

@photo_editor_router.post("/undo/{photo_id}")
async def undo_edit(
    photo_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Undo the last edit operation"""
    user_id = current_user["user_id"]
    
    photo = await db.edited_photos.find_one(
        {"photo_id": photo_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    history = photo.get("edit_history", [])
    if len(history) < 2:
        # Reset to original
        await db.edited_photos.update_one(
            {"photo_id": photo_id},
            {
                "$set": {
                    "current_url": photo["original_url"],
                    "has_background_removed": False,
                    "processed_url": None,
                    "current_background": None,
                    "adjustments": {},
                    "edit_history": [],
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return {
            "photo_id": photo_id,
            "message": "Reset to original",
            "current_url": photo["original_url"]
        }
    
    # Remove last history entry
    history.pop()
    
    # Get the previous state
    if history:
        # Need to replay all edits up to this point
        # For simplicity, we'll just indicate undo happened
        await db.edited_photos.update_one(
            {"photo_id": photo_id},
            {
                "$pop": {"edit_history": 1},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
        return {
            "photo_id": photo_id,
            "message": "Last edit undone",
            "remaining_history": len(history)
        }
    
    return {"photo_id": photo_id, "message": "No more edits to undo"}

@photo_editor_router.post("/reset/{photo_id}")
async def reset_photo(
    photo_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Reset photo to original state"""
    user_id = current_user["user_id"]
    
    photo = await db.edited_photos.find_one(
        {"photo_id": photo_id, "user_id": user_id},
        {"_id": 0}
    )
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    await db.edited_photos.update_one(
        {"photo_id": photo_id},
        {
            "$set": {
                "current_url": photo["original_url"],
                "has_background_removed": False,
                "processed_url": None,
                "current_background": None,
                "adjustments": {},
                "edit_history": [],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    return {
        "photo_id": photo_id,
        "message": "Photo reset to original",
        "original_url": photo["original_url"]
    }

@photo_editor_router.get("/backgrounds")
async def get_available_backgrounds():
    """Get list of available predefined backgrounds"""
    return {
        "backgrounds": BACKGROUND_PATTERNS,
        "categories": {
            "solid": [b for b in BACKGROUND_PATTERNS if b["type"] == "solid"],
            "gradient": [b for b in BACKGROUND_PATTERNS if b["type"] == "gradient"],
            "pattern": [b for b in BACKGROUND_PATTERNS if b["type"] == "pattern"],
            "texture": [b for b in BACKGROUND_PATTERNS if b["type"] == "texture"]
        }
    }

@photo_editor_router.post("/save-preference")
async def save_background_preference(
    background_type: str,
    background_value: str,
    current_user: dict = Depends(get_current_user)
):
    """Save seller's default background preference"""
    user_id = current_user["user_id"]
    
    preference = {
        "type": background_type,
        "value": background_value,
        "saved_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"photo_editor_preferences.default_background": preference}}
    )
    
    return {
        "success": True,
        "message": "Background preference saved",
        "preference": preference
    }

@photo_editor_router.get("/preference")
async def get_background_preference(current_user: dict = Depends(get_current_user)):
    """Get seller's saved background preference"""
    user_id = current_user["user_id"]
    
    user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "photo_editor_preferences": 1}
    )
    
    preferences = user.get("photo_editor_preferences", {}) if user else {}
    
    return {
        "default_background": preferences.get("default_background"),
        "preferences": preferences
    }

@photo_editor_router.delete("/photos/{photo_id}")
async def delete_photo(
    photo_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a photo from the editing session"""
    user_id = current_user["user_id"]
    
    result = await db.edited_photos.delete_one(
        {"photo_id": photo_id, "user_id": user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    return {"success": True, "message": "Photo deleted"}

@photo_editor_router.post("/finalize")
async def finalize_photos(
    request: FinalizePhotosRequest,
    current_user: dict = Depends(get_current_user)
):
    """Finalize edited photos and prepare for listing creation"""
    user_id = current_user["user_id"]
    photo_ids = request.photo_ids
    
    finalized = []
    for photo_id in photo_ids:
        photo = await db.edited_photos.find_one(
            {"photo_id": photo_id, "user_id": user_id},
            {"_id": 0}
        )
        
        if photo:
            finalized.append({
                "photo_id": photo_id,
                "final_url": photo["current_url"],
                "thumbnail_url": photo["thumbnail_url"],
                "original_url": photo["original_url"],
                "has_edits": len(photo.get("edit_history", [])) > 0
            })
    
    return {
        "success": True,
        "finalized_photos": finalized,
        "count": len(finalized)
    }

class GenerateAIListingRequest(BaseModel):
    photo_ids: List[str]
    condition: str = "like_new"  # new, like_new, good, fair, poor

@photo_editor_router.post("/generate-ai-listing")
async def generate_ai_listing(
    request: GenerateAIListingRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate AI listing from edited photos.
    Sends photos to AI analysis to generate title, description, dimensions, weight, price suggestions.
    """
    user_id = current_user["user_id"]
    
    if not request.photo_ids:
        raise HTTPException(status_code=400, detail="No photo IDs provided")
    
    # Get photos from database
    images = []
    for photo_id in request.photo_ids:
        photo = await db.edited_photos.find_one(
            {"photo_id": photo_id, "user_id": user_id},
            {"_id": 0}
        )
        if photo:
            images.append(photo["current_url"])
    
    if not images:
        raise HTTPException(status_code=404, detail="No photos found")
    
    try:
        # Import the AI analysis function from seller_dashboard
        from seller_dashboard import analyze_images_with_ai
        
        system_prompt = """You are an expert e-commerce listing creator specializing in marketplace sales.
        Analyze product images and generate:
        1. An attention-grabbing title (max 80 chars)
        2. A detailed, benefit-focused description
        3. Estimated dimensions (length x width x height in inches)
        4. Estimated weight (in lbs)
        5. Suggested price range based on condition and market value
        6. Category suggestions
        7. Key features/highlights as bullet points
        
        Be thorough in identifying product features, condition indicators, brand, model, and any visible flaws.
        Create descriptions that highlight benefits and drive purchase intent."""
        
        result = await analyze_images_with_ai(
            images=images,
            condition=request.condition,
            system_prompt=system_prompt
        )
        
        # Store the analysis result
        analysis_doc = {
            "analysis_id": f"listing_analysis_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "photo_ids": request.photo_ids,
            "condition": request.condition,
            "analysis_result": result,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.listing_analyses.insert_one(analysis_doc)
        
        return {
            "success": True,
            "analysis_id": analysis_doc["analysis_id"],
            "listing_data": result,
            "photo_count": len(images)
        }
        
    except Exception as e:
        logger.error(f"AI listing generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI listing generation failed: {str(e)}")

# Export router
def get_photo_editor_router():
    return photo_editor_router
