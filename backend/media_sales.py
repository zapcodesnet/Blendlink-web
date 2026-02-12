"""
Blendlink Watermark & Media Sales Module
- Watermark creation and management
- Media upload with watermark application
- Offer system for purchasing watermarked media
- E-signature contracts for copyright transfer
- Stripe payment integration
"""
from fastapi import APIRouter, HTTPException, Depends, Request, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import os
import base64
from io import BytesIO
from motor.motor_asyncio import AsyncIOMotorClient
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, CheckoutSessionResponse, CheckoutStatusResponse, CheckoutSessionRequest
)

# Import from main server
from server import get_current_user, db, logger

# Create routers
watermark_router = APIRouter(prefix="/watermark", tags=["Watermark"])
media_router = APIRouter(prefix="/media", tags=["Media"])
offers_router = APIRouter(prefix="/offers", tags=["Offers"])
contracts_router = APIRouter(prefix="/contracts", tags=["Contracts"])
payments_router = APIRouter(prefix="/payments", tags=["Payments"])

# ============== WATERMARKING FUNCTIONS ==============

def apply_image_watermark(image_bytes: bytes, watermark_text: str, opacity: float = 0.2, position: str = "diagonal") -> bytes:
    """
    Apply a text watermark to an image.
    Returns watermarked image as bytes.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont, ImageEnhance
        
        # Open the image
        img = Image.open(BytesIO(image_bytes))
        
        # Convert to RGBA for transparency
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # Create a transparent overlay
        overlay = Image.new('RGBA', img.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)
        
        # Calculate font size based on image dimensions
        min_dim = min(img.size)
        font_size = max(20, min_dim // 15)
        
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()
        
        # Calculate text size
        bbox = draw.textbbox((0, 0), watermark_text, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        
        # Watermark color with opacity
        alpha = int(255 * opacity)
        watermark_color = (128, 128, 128, alpha)
        
        if position == "diagonal":
            # Draw diagonal repeating watermark
            for y in range(0, img.size[1], text_height * 3):
                for x in range(-img.size[0], img.size[0] * 2, text_width + 50):
                    # Create rotated text
                    txt_img = Image.new('RGBA', (text_width + 20, text_height + 20), (255, 255, 255, 0))
                    txt_draw = ImageDraw.Draw(txt_img)
                    txt_draw.text((10, 10), watermark_text, font=font, fill=watermark_color)
                    txt_img = txt_img.rotate(30, expand=True)
                    overlay.paste(txt_img, (x + (y % 3) * 100, y), txt_img)
        else:
            # Center position
            x = (img.size[0] - text_width) // 2
            y = (img.size[1] - text_height) // 2
            draw.text((x, y), watermark_text, font=font, fill=watermark_color)
        
        # Composite the overlay onto the original image
        watermarked = Image.alpha_composite(img, overlay)
        
        # Convert back to RGB for JPEG compatibility
        if watermarked.mode == 'RGBA':
            watermarked = watermarked.convert('RGB')
        
        # Save to bytes
        output = BytesIO()
        watermarked.save(output, format='PNG', quality=95)
        output.seek(0)
        return output.read()
        
    except ImportError:
        logger.warning("PIL not installed, returning original image")
        return image_bytes
    except Exception as e:
        logger.error(f"Watermarking failed: {e}")
        return image_bytes

def apply_video_watermark(video_path: str, watermark_text: str, output_path: str, opacity: float = 0.2) -> str:
    """
    Apply a text watermark to a video using FFmpeg.
    Returns path to watermarked video.
    """
    import subprocess
    
    try:
        # FFmpeg command to add text watermark
        # Using drawtext filter
        filter_string = f"drawtext=text='{watermark_text}':fontsize=36:fontcolor=white@{opacity}:x=(w-text_w)/2:y=(h-text_h)/2"
        
        cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-vf', filter_string,
            '-codec:a', 'copy',
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        
        if result.returncode != 0:
            logger.error(f"FFmpeg error: {result.stderr}")
            return video_path  # Return original if watermarking fails
        
        return output_path
    except Exception as e:
        logger.error(f"Video watermarking failed: {e}")
        return video_path

# ============== MODELS ==============

class WatermarkTemplate(BaseModel):
    """User's watermark template"""
    watermark_id: str = Field(default_factory=lambda: f"wm_{uuid.uuid4().hex[:12]}")
    user_id: str
    name: str  # Template name
    text: str  # The watermark text
    font_family: str = "Arial"
    font_size: int = 24
    color: str = "#ffffff"
    opacity: float = 0.8  # 70-90% transparency means 10-30% opacity visually
    position_x: float = 50.0  # Percentage from left
    position_y: float = 50.0  # Percentage from top
    rotation: float = 0.0
    is_default: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WatermarkCreate(BaseModel):
    name: str
    text: str
    font_family: str = "Arial"
    font_size: int = 24
    color: str = "#ffffff"
    opacity: float = 0.8
    position_x: float = 50.0
    position_y: float = 50.0
    rotation: float = 0.0
    is_default: bool = False

class MediaItem(BaseModel):
    """Watermarked media item for sale"""
    media_id: str = Field(default_factory=lambda: f"media_{uuid.uuid4().hex[:12]}")
    user_id: str
    title: str
    description: str = ""
    media_type: str  # "photo" or "video"
    original_url: str  # Original unwatermarked URL (stored securely)
    watermarked_url: str  # Watermarked version URL (public)
    thumbnail_url: str = ""
    watermark_id: str  # Which watermark template was used
    watermark_config: Dict = {}  # Snapshot of watermark settings at upload time
    privacy: str = "public"  # "public", "private", "album"
    album_id: Optional[str] = None
    is_for_sale: bool = True  # Auto true if public with watermark
    fixed_price: Optional[float] = None  # If listed in marketplace
    view_count: int = 0
    offer_count: int = 0
    status: str = "active"  # "active", "sold", "removed"
    sold_to: Optional[str] = None
    sold_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MediaUpload(BaseModel):
    title: str
    description: str = ""
    media_type: str
    original_url: str
    watermarked_url: str
    thumbnail_url: str = ""
    watermark_id: str
    watermark_config: Dict = {}
    privacy: str = "public"
    album_id: Optional[str] = None
    fixed_price: Optional[float] = None

class Offer(BaseModel):
    """Purchase offer for watermarked media"""
    offer_id: str = Field(default_factory=lambda: f"offer_{uuid.uuid4().hex[:12]}")
    media_id: str
    buyer_id: Optional[str] = None  # None if guest
    buyer_email: str
    buyer_name: str
    seller_id: str
    amount: float
    message: str = ""
    status: str = "pending"  # "pending", "accepted", "rejected", "paid", "completed", "cancelled"
    stripe_session_id: Optional[str] = None
    payment_status: Optional[str] = None
    contract_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OfferCreate(BaseModel):
    media_id: str
    buyer_email: str
    buyer_name: str
    amount: float
    message: str = ""

class Contract(BaseModel):
    """E-signed copyright transfer contract"""
    contract_id: str = Field(default_factory=lambda: f"contract_{uuid.uuid4().hex[:12]}")
    offer_id: str
    media_id: str
    seller_id: str
    buyer_id: Optional[str] = None
    buyer_email: str
    buyer_name: str
    amount: float
    
    # Contract details
    media_title: str
    media_type: str
    transfer_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Signatures
    seller_signature: Optional[str] = None  # Base64 image or typed name
    seller_signature_type: str = "typed"  # "typed" or "drawn"
    seller_signed_at: Optional[datetime] = None
    
    buyer_signature: Optional[str] = None
    buyer_signature_type: str = "typed"
    buyer_signed_at: Optional[datetime] = None
    
    # Status
    status: str = "pending_signatures"  # "pending_signatures", "seller_signed", "fully_signed", "completed"
    pdf_url: Optional[str] = None  # Generated PDF URL
    
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SignContract(BaseModel):
    signature: str  # Base64 image or typed text
    signature_type: str = "typed"  # "typed" or "drawn"

class PaymentTransaction(BaseModel):
    """Stripe payment transaction record"""
    transaction_id: str = Field(default_factory=lambda: f"pay_{uuid.uuid4().hex[:12]}")
    offer_id: str
    buyer_email: str
    seller_id: str
    amount: float
    currency: str = "usd"
    stripe_session_id: str
    payment_status: str = "initiated"  # "initiated", "paid", "failed", "refunded"
    metadata: Dict = {}
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== WATERMARK ROUTES ==============

@watermark_router.post("/templates")
async def create_watermark_template(data: WatermarkCreate, current_user: dict = Depends(get_current_user)):
    """Create a new watermark template"""
    # Validate opacity (70-90% transparency = 10-30% visible opacity)
    if data.opacity < 0.1 or data.opacity > 0.3:
        data.opacity = max(0.1, min(0.3, data.opacity))
    
    # If this is set as default, unset other defaults
    if data.is_default:
        await db.watermark_templates.update_many(
            {"user_id": current_user["user_id"]},
            {"$set": {"is_default": False}}
        )
    
    template = WatermarkTemplate(
        user_id=current_user["user_id"],
        **data.model_dump()
    )
    template_dict = template.model_dump()
    template_dict["created_at"] = template_dict["created_at"].isoformat()
    
    await db.watermark_templates.insert_one(template_dict)
    
    return {"watermark_id": template.watermark_id, "message": "Watermark template created"}

class ApplyWatermarkRequest(BaseModel):
    image_base64: str
    watermark_text: str = "Blendlink"
    opacity: float = 0.2
    position: str = "diagonal"  # "diagonal" or "center"

@watermark_router.post("/apply-to-image")
async def apply_watermark_to_image(request: ApplyWatermarkRequest, current_user: dict = Depends(get_current_user)):
    """Apply watermark to an image and return watermarked version"""
    try:
        # Decode base64 image
        image_data = request.image_base64
        if ',' in image_data:
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        
        # Apply watermark
        watermarked_bytes = apply_image_watermark(
            image_bytes=image_bytes,
            watermark_text=request.watermark_text,
            opacity=request.opacity,
            position=request.position
        )
        
        # Encode back to base64
        watermarked_base64 = base64.b64encode(watermarked_bytes).decode('utf-8')
        
        return {
            "watermarked_image": f"data:image/png;base64,{watermarked_base64}",
            "watermark_text": request.watermark_text,
            "message": "Watermark applied successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply watermark: {str(e)}")

@watermark_router.post("/apply-to-video")
async def apply_watermark_to_video(
    video_base64: str,
    watermark_text: str = "Blendlink",
    opacity: float = 0.3,
    current_user: dict = Depends(get_current_user)
):
    """Apply watermark to a video (requires FFmpeg)"""
    import tempfile
    
    try:
        # Decode base64 video
        video_data = video_base64
        if ',' in video_data:
            video_data = video_data.split(',')[1]
        
        video_bytes = base64.b64decode(video_data)
        
        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as input_file:
            input_file.write(video_bytes)
            input_path = input_file.name
        
        # Output path
        output_path = input_path.replace('.mp4', '_watermarked.mp4')
        
        # Apply watermark
        result_path = apply_video_watermark(
            video_path=input_path,
            watermark_text=watermark_text,
            output_path=output_path,
            opacity=opacity
        )
        
        # Read watermarked video
        with open(result_path, 'rb') as f:
            watermarked_bytes = f.read()
        
        # Clean up temp files
        os.unlink(input_path)
        if os.path.exists(output_path):
            os.unlink(output_path)
        
        # Encode to base64
        watermarked_base64 = base64.b64encode(watermarked_bytes).decode('utf-8')
        
        return {
            "watermarked_video": f"data:video/mp4;base64,{watermarked_base64}",
            "watermark_text": watermark_text,
            "message": "Video watermark applied successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to apply video watermark: {str(e)}")

@watermark_router.get("/templates")
async def get_watermark_templates(current_user: dict = Depends(get_current_user)):
    """Get all watermark templates for current user"""
    templates = await db.watermark_templates.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    return templates

@watermark_router.get("/templates/{watermark_id}")
async def get_watermark_template(watermark_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific watermark template"""
    template = await db.watermark_templates.find_one(
        {"watermark_id": watermark_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    if not template:
        raise HTTPException(status_code=404, detail="Watermark template not found")
    return template

@watermark_router.put("/templates/{watermark_id}")
async def update_watermark_template(watermark_id: str, data: WatermarkCreate, current_user: dict = Depends(get_current_user)):
    """Update a watermark template"""
    template = await db.watermark_templates.find_one(
        {"watermark_id": watermark_id, "user_id": current_user["user_id"]}
    )
    if not template:
        raise HTTPException(status_code=404, detail="Watermark template not found")
    
    # Validate opacity
    if data.opacity < 0.1 or data.opacity > 0.3:
        data.opacity = max(0.1, min(0.3, data.opacity))
    
    # If setting as default, unset others
    if data.is_default:
        await db.watermark_templates.update_many(
            {"user_id": current_user["user_id"], "watermark_id": {"$ne": watermark_id}},
            {"$set": {"is_default": False}}
        )
    
    await db.watermark_templates.update_one(
        {"watermark_id": watermark_id},
        {"$set": data.model_dump()}
    )
    
    return {"message": "Watermark template updated"}

@watermark_router.delete("/templates/{watermark_id}")
async def delete_watermark_template(watermark_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a watermark template"""
    result = await db.watermark_templates.delete_one(
        {"watermark_id": watermark_id, "user_id": current_user["user_id"]}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Watermark template not found")
    return {"message": "Watermark template deleted"}

# ============== MEDIA ROUTES ==============

@media_router.post("/upload")
async def upload_media(data: MediaUpload, current_user: dict = Depends(get_current_user)):
    """Upload media with watermark"""
    # Verify watermark template exists
    watermark = await db.watermark_templates.find_one(
        {"watermark_id": data.watermark_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    if not watermark:
        raise HTTPException(status_code=404, detail="Watermark template not found")
    
    # Auto-enable for sale if public with watermark
    is_for_sale = data.privacy == "public"
    
    media = MediaItem(
        user_id=current_user["user_id"],
        title=data.title,
        description=data.description,
        media_type=data.media_type,
        original_url=data.original_url,
        watermarked_url=data.watermarked_url,
        thumbnail_url=data.thumbnail_url,
        watermark_id=data.watermark_id,
        watermark_config=data.watermark_config or watermark,
        privacy=data.privacy,
        album_id=data.album_id,
        is_for_sale=is_for_sale,
        fixed_price=data.fixed_price
    )
    
    media_dict = media.model_dump()
    media_dict["created_at"] = media_dict["created_at"].isoformat()
    if media_dict.get("sold_at"):
        media_dict["sold_at"] = media_dict["sold_at"].isoformat()
    
    await db.media_items.insert_one(media_dict)
    
    return {
        "media_id": media.media_id,
        "is_for_sale": is_for_sale,
        "message": "Media uploaded successfully"
    }

@media_router.get("/my-media")
async def get_my_media(
    skip: int = 0, 
    limit: int = 20,
    status: str = "active",
    current_user: dict = Depends(get_current_user)
):
    """Get current user's media items"""
    query = {"user_id": current_user["user_id"]}
    if status:
        query["status"] = status
    
    media = await db.media_items.find(query, {"_id": 0, "original_url": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return media

@media_router.get("/for-sale")
async def get_media_for_sale(skip: int = 0, limit: int = 20, media_type: str = None):
    """Get all public watermarked media for sale (no auth required)"""
    query = {"is_for_sale": True, "status": "active", "privacy": "public"}
    if media_type:
        query["media_type"] = media_type
    
    media = await db.media_items.find(
        query, 
        {"_id": 0, "original_url": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Add seller info
    for item in media:
        seller = await db.users.find_one({"user_id": item["user_id"]}, {"_id": 0, "password_hash": 0, "bl_coins": 0})
        item["seller"] = seller
    
    return media

@media_router.get("/{media_id}")
async def get_media_detail(media_id: str):
    """Get media detail (public watermarked view)"""
    media = await db.media_items.find_one(
        {"media_id": media_id, "status": "active"},
        {"_id": 0, "original_url": 0}
    )
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    # Increment view count
    await db.media_items.update_one(
        {"media_id": media_id},
        {"$inc": {"view_count": 1}}
    )
    
    # Add seller info
    seller = await db.users.find_one({"user_id": media["user_id"]}, {"_id": 0, "password_hash": 0, "bl_coins": 0})
    media["seller"] = seller
    
    return media

@media_router.delete("/{media_id}")
async def delete_media(media_id: str, current_user: dict = Depends(get_current_user)):
    """Delete media item"""
    result = await db.media_items.delete_one(
        {"media_id": media_id, "user_id": current_user["user_id"], "status": {"$ne": "sold"}}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Media not found or already sold")
    return {"message": "Media deleted"}

# ============== OFFERS ROUTES ==============

@offers_router.post("/")
async def create_offer(data: OfferCreate, request: Request):
    """Create a purchase offer (guests and members can offer)"""
    # Get media item
    media = await db.media_items.find_one(
        {"media_id": data.media_id, "is_for_sale": True, "status": "active"},
        {"_id": 0}
    )
    if not media:
        raise HTTPException(status_code=404, detail="Media not found or not for sale")
    
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Offer amount must be positive")
    
    # Check if buyer is authenticated
    buyer_id = None
    try:
        current_user = await get_current_user(request)
        buyer_id = current_user["user_id"]
        # Can't buy your own media
        if buyer_id == media["user_id"]:
            raise HTTPException(status_code=400, detail="Cannot make offer on your own media")
    except:
        pass  # Guest user
    
    offer = Offer(
        media_id=data.media_id,
        buyer_id=buyer_id,
        buyer_email=data.buyer_email,
        buyer_name=data.buyer_name,
        seller_id=media["user_id"],
        amount=data.amount,
        message=data.message
    )
    
    offer_dict = offer.model_dump()
    offer_dict["created_at"] = offer_dict["created_at"].isoformat()
    offer_dict["updated_at"] = offer_dict["updated_at"].isoformat()
    
    await db.offers.insert_one(offer_dict)
    
    # Increment offer count
    await db.media_items.update_one(
        {"media_id": data.media_id},
        {"$inc": {"offer_count": 1}}
    )
    
    return {"offer_id": offer.offer_id, "message": "Offer submitted successfully"}

@offers_router.get("/received")
async def get_received_offers(status: str = None, current_user: dict = Depends(get_current_user)):
    """Get offers received on your media"""
    query = {"seller_id": current_user["user_id"]}
    if status:
        query["status"] = status
    
    offers = await db.offers.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Add media info
    for offer in offers:
        media = await db.media_items.find_one({"media_id": offer["media_id"]}, {"_id": 0, "original_url": 0})
        offer["media"] = media
    
    return offers

@offers_router.get("/sent")
async def get_sent_offers(request: Request):
    """Get offers you've sent (requires auth or email)"""
    try:
        current_user = await get_current_user(request)
        query = {"buyer_id": current_user["user_id"]}
    except:
        # For guests, they'd need to provide their email
        raise HTTPException(status_code=401, detail="Authentication required to view sent offers")
    
    offers = await db.offers.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Add media info
    for offer in offers:
        media = await db.media_items.find_one({"media_id": offer["media_id"]}, {"_id": 0, "original_url": 0})
        offer["media"] = media
    
    return offers

@offers_router.post("/{offer_id}/accept")
async def accept_offer(offer_id: str, current_user: dict = Depends(get_current_user)):
    """Accept an offer"""
    offer = await db.offers.find_one({"offer_id": offer_id, "seller_id": current_user["user_id"]})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Offer is already {offer['status']}")
    
    await db.offers.update_one(
        {"offer_id": offer_id},
        {"$set": {"status": "accepted", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Offer accepted. Buyer can now proceed with payment."}

@offers_router.post("/{offer_id}/reject")
async def reject_offer(offer_id: str, current_user: dict = Depends(get_current_user)):
    """Reject an offer"""
    result = await db.offers.update_one(
        {"offer_id": offer_id, "seller_id": current_user["user_id"], "status": "pending"},
        {"$set": {"status": "rejected", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found or not pending")
    
    return {"message": "Offer rejected"}

# ============== PAYMENT ROUTES ==============

@payments_router.post("/checkout/{offer_id}")
async def create_checkout_session(offer_id: str, request: Request):
    """Create Stripe checkout session for an accepted offer"""
    offer = await db.offers.find_one({"offer_id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer["status"] != "accepted":
        raise HTTPException(status_code=400, detail="Offer must be accepted before payment")
    
    # Get origin URL from request
    body = await request.json()
    origin_url = body.get("origin_url", str(request.base_url).rstrip("/"))
    
    # Initialize Stripe
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    # Create checkout session
    success_url = f"{origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}&offer_id={offer_id}"
    cancel_url = f"{origin_url}/payment/cancel?offer_id={offer_id}"
    
    checkout_request = CheckoutSessionRequest(
        amount=float(offer["amount"]),
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "offer_id": offer_id,
            "media_id": offer["media_id"],
            "buyer_email": offer["buyer_email"],
            "seller_id": offer["seller_id"]
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    payment = PaymentTransaction(
        offer_id=offer_id,
        buyer_email=offer["buyer_email"],
        seller_id=offer["seller_id"],
        amount=offer["amount"],
        stripe_session_id=session.session_id,
        payment_status="initiated",
        metadata=checkout_request.metadata
    )
    
    payment_dict = payment.model_dump()
    payment_dict["created_at"] = payment_dict["created_at"].isoformat()
    payment_dict["updated_at"] = payment_dict["updated_at"].isoformat()
    
    await db.payment_transactions.insert_one(payment_dict)
    
    # Update offer with session ID
    await db.offers.update_one(
        {"offer_id": offer_id},
        {"$set": {"stripe_session_id": session.session_id}}
    )
    
    return {"checkout_url": session.url, "session_id": session.session_id}

@payments_router.get("/status/{session_id}")
async def get_payment_status(session_id: str, request: Request):
    """Check payment status"""
    # CRITICAL: Validate session_id format before making API call
    if not session_id or session_id in ["test", "null", "undefined", ""]:
        logger.warning(f"Media sales: Invalid session_id received: '{session_id}'")
        raise HTTPException(status_code=400, detail="Invalid or missing session ID")
    
    # Stripe session IDs must start with cs_live_ or cs_test_
    if not session_id.startswith("cs_"):
        logger.warning(f"Media sales: Session ID format invalid: '{session_id}'")
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid session ID format. Expected 'cs_live_...' or 'cs_test_...'"
        )
    
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe not configured")
    
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Media sales Stripe status check error: {error_msg}")
        if "No such checkout.session" in error_msg:
            raise HTTPException(status_code=404, detail="Checkout session not found or expired")
        raise HTTPException(status_code=500, detail=f"Failed to check status: {error_msg}")
    
    # Update payment transaction
    if status.payment_status == "paid":
        await db.payment_transactions.update_one(
            {"stripe_session_id": session_id},
            {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        # Update offer status
        payment = await db.payment_transactions.find_one({"stripe_session_id": session_id})
        if payment:
            # Update offer to paid
            await db.offers.update_one(
                {"offer_id": payment["offer_id"]},
                {"$set": {"status": "paid", "payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            # Create contract for signing
            offer = await db.offers.find_one({"offer_id": payment["offer_id"]})
            media = await db.media_items.find_one({"media_id": offer["media_id"]})
            
            # Check if contract already exists
            existing_contract = await db.contracts.find_one({"offer_id": payment["offer_id"]})
            if not existing_contract:
                contract = Contract(
                    offer_id=payment["offer_id"],
                    media_id=offer["media_id"],
                    seller_id=offer["seller_id"],
                    buyer_id=offer.get("buyer_id"),
                    buyer_email=offer["buyer_email"],
                    buyer_name=offer["buyer_name"],
                    amount=offer["amount"],
                    media_title=media["title"],
                    media_type=media["media_type"]
                )
                
                contract_dict = contract.model_dump()
                contract_dict["created_at"] = contract_dict["created_at"].isoformat()
                contract_dict["transfer_date"] = contract_dict["transfer_date"].isoformat()
                
                await db.contracts.insert_one(contract_dict)
                
                # Update offer with contract ID
                await db.offers.update_one(
                    {"offer_id": payment["offer_id"]},
                    {"$set": {"contract_id": contract.contract_id}}
                )
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount": status.amount_total / 100,  # Convert from cents
        "currency": status.currency
    }

# ============== CONTRACTS ROUTES ==============

@contracts_router.get("/{contract_id}")
async def get_contract(contract_id: str, request: Request):
    """Get contract details"""
    contract = await db.contracts.find_one({"contract_id": contract_id}, {"_id": 0})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    # Add media info
    media = await db.media_items.find_one({"media_id": contract["media_id"]}, {"_id": 0, "original_url": 0})
    contract["media"] = media
    
    # Add seller info
    seller = await db.users.find_one({"user_id": contract["seller_id"]}, {"_id": 0, "password_hash": 0})
    contract["seller"] = seller
    
    return contract

@contracts_router.post("/{contract_id}/sign/seller")
async def seller_sign_contract(contract_id: str, data: SignContract, current_user: dict = Depends(get_current_user)):
    """Seller signs the contract"""
    contract = await db.contracts.find_one({"contract_id": contract_id, "seller_id": current_user["user_id"]})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    if contract.get("seller_signature"):
        raise HTTPException(status_code=400, detail="Contract already signed by seller")
    
    new_status = "seller_signed"
    if contract.get("buyer_signature"):
        new_status = "fully_signed"
    
    await db.contracts.update_one(
        {"contract_id": contract_id},
        {"$set": {
            "seller_signature": data.signature,
            "seller_signature_type": data.signature_type,
            "seller_signed_at": datetime.now(timezone.utc).isoformat(),
            "status": new_status
        }}
    )
    
    return {"message": "Contract signed", "status": new_status}

@contracts_router.post("/{contract_id}/sign/buyer")
async def buyer_sign_contract(contract_id: str, data: SignContract, request: Request):
    """Buyer signs the contract"""
    contract = await db.contracts.find_one({"contract_id": contract_id})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    if contract.get("buyer_signature"):
        raise HTTPException(status_code=400, detail="Contract already signed by buyer")
    
    # Verify buyer (either by auth or email match)
    try:
        current_user = await get_current_user(request)
        if contract.get("buyer_id") and current_user["user_id"] != contract["buyer_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to sign this contract")
    except:
        # For guest buyers, we'd verify by email token in a real system
        pass
    
    new_status = "buyer_signed" if not contract.get("seller_signature") else "fully_signed"
    
    await db.contracts.update_one(
        {"contract_id": contract_id},
        {"$set": {
            "buyer_signature": data.signature,
            "buyer_signature_type": data.signature_type,
            "buyer_signed_at": datetime.now(timezone.utc).isoformat(),
            "status": new_status
        }}
    )
    
    # If fully signed, complete the transfer
    if new_status == "fully_signed":
        await complete_transfer(contract_id)
    
    return {"message": "Contract signed", "status": new_status}

async def complete_transfer(contract_id: str):
    """Complete the media transfer after both signatures"""
    contract = await db.contracts.find_one({"contract_id": contract_id})
    if not contract:
        return
    
    # Update contract status
    await db.contracts.update_one(
        {"contract_id": contract_id},
        {"$set": {"status": "completed"}}
    )
    
    # Update offer status
    await db.offers.update_one(
        {"offer_id": contract["offer_id"]},
        {"$set": {"status": "completed", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Update media status - mark as sold and remove from seller's visible media
    await db.media_items.update_one(
        {"media_id": contract["media_id"]},
        {"$set": {
            "status": "sold",
            "sold_to": contract.get("buyer_id") or contract["buyer_email"],
            "sold_at": datetime.now(timezone.utc).isoformat(),
            "is_for_sale": False
        }}
    )
    
    # Process commissions for the sale (8% total fee)
    try:
        from referral_system import process_sale_commissions
        
        # Create a marketplace sale record for tracking
        sale_id = f"sale_{uuid.uuid4().hex[:12]}"
        sale_record = {
            "sale_id": sale_id,
            "contract_id": contract_id,
            "media_id": contract["media_id"],
            "seller_id": contract["seller_id"],
            "buyer_id": contract.get("buyer_id"),
            "buyer_email": contract["buyer_email"],
            "amount": contract["amount"],
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.marketplace_sales.insert_one(sale_record)
        
        # Process and distribute commissions
        commission_result = await process_sale_commissions(
            sale_id=sale_id,
            sale_amount=contract["amount"],
            seller_id=contract["seller_id"]
        )
        logger.info(f"Commissions processed for sale {sale_id}: {commission_result}")
    except Exception as e:
        logger.error(f"Failed to process commissions for contract {contract_id}: {e}")

@contracts_router.get("/{contract_id}/download")
async def download_original_media(contract_id: str, request: Request):
    """Download the original unwatermarked media after contract is complete"""
    contract = await db.contracts.find_one({"contract_id": contract_id})
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    if contract["status"] != "completed":
        raise HTTPException(status_code=400, detail="Contract must be fully signed before download")
    
    # Verify buyer
    try:
        current_user = await get_current_user(request)
        if contract.get("buyer_id") and current_user["user_id"] != contract["buyer_id"]:
            raise HTTPException(status_code=403, detail="Not authorized to download")
    except:
        # For guest buyers, verify by email in headers or token
        pass
    
    # Get original media URL
    media = await db.media_items.find_one({"media_id": contract["media_id"]})
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    return {
        "download_url": media["original_url"],
        "media_title": media["title"],
        "media_type": media["media_type"]
    }

@contracts_router.get("/my/seller")
async def get_seller_contracts(current_user: dict = Depends(get_current_user)):
    """Get contracts where you are the seller"""
    contracts = await db.contracts.find(
        {"seller_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return contracts

@contracts_router.get("/my/buyer")
async def get_buyer_contracts(current_user: dict = Depends(get_current_user)):
    """Get contracts where you are the buyer"""
    contracts = await db.contracts.find(
        {"buyer_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return contracts
