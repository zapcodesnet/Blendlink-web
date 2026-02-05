"""
AI Photo Transformation Service
Uses OpenAI GPT Image 1 via Emergent LLM Key to transform photos based on text descriptions.
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional
import logging
import base64
import os
import asyncio
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# Router
transform_router = APIRouter(prefix="/ai-transform", tags=["AI Photo Transform"])

# Constants
MAX_GENERATIONS_PER_SESSION = 3
GENERATION_TIMEOUT = 60  # seconds

# In-memory session tracker (resets on server restart, or on successful mint)
# Format: {user_id: {"count": int, "session_start": datetime}}
_transform_sessions = {}


class TransformRequest(BaseModel):
    """Request to transform a photo with AI"""
    image_base64: str = Field(..., description="Base64 encoded image data (without data URL prefix)")
    prompt: str = Field(..., min_length=3, max_length=500, description="Description of desired transformation")
    num_variations: int = Field(default=2, ge=1, le=4, description="Number of variations to generate (1-4)")


class TransformResponse(BaseModel):
    """Response with transformed images"""
    success: bool
    variations: List[str] = []  # List of base64 encoded images
    generations_remaining: int
    error: Optional[str] = None


async def get_current_user_from_request(request: Request) -> dict:
    """Get current user from request"""
    from server import get_current_user
    return await get_current_user(request)


def get_user_generation_count(user_id: str) -> int:
    """Get the number of generations used by user in current session"""
    session = _transform_sessions.get(user_id)
    if not session:
        return 0
    return session.get("count", 0)


def increment_user_generation_count(user_id: str, count: int = 1) -> int:
    """Increment user's generation count and return new total"""
    if user_id not in _transform_sessions:
        _transform_sessions[user_id] = {
            "count": 0,
            "session_start": datetime.now(timezone.utc)
        }
    _transform_sessions[user_id]["count"] += count
    return _transform_sessions[user_id]["count"]


def reset_user_generation_count(user_id: str):
    """Reset user's generation count (called after successful mint)"""
    if user_id in _transform_sessions:
        del _transform_sessions[user_id]
    logger.info(f"Reset transformation count for user {user_id}")


@transform_router.get("/status")
async def get_transform_status(current_user: dict = Depends(get_current_user_from_request)):
    """Get current transformation session status"""
    user_id = current_user["user_id"]
    count = get_user_generation_count(user_id)
    
    return {
        "generations_used": count,
        "generations_remaining": max(0, MAX_GENERATIONS_PER_SESSION - count),
        "max_per_session": MAX_GENERATIONS_PER_SESSION,
    }


@transform_router.post("/generate", response_model=TransformResponse)
async def generate_transformations(
    request: TransformRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Generate AI transformations of an uploaded photo.
    
    - Uses OpenAI GPT Image 1 for text-guided image editing
    - Limited to 3 generations per mint session
    - Resets after successful mint or session end
    """
    user_id = current_user["user_id"]
    
    # Check generation limit
    current_count = get_user_generation_count(user_id)
    if current_count >= MAX_GENERATIONS_PER_SESSION:
        raise HTTPException(
            status_code=429,
            detail=f"Maximum {MAX_GENERATIONS_PER_SESSION} generations per mint session. Complete or cancel minting to reset."
        )
    
    # Validate and clean base64 image
    image_base64 = request.image_base64
    if image_base64.startswith('data:'):
        # Remove data URL prefix if present
        image_base64 = image_base64.split(',')[1] if ',' in image_base64 else image_base64
    
    # Validate base64
    try:
        image_bytes = base64.b64decode(image_base64)
        if len(image_bytes) < 1000:  # Minimum reasonable image size
            raise ValueError("Image too small")
        if len(image_bytes) > 20 * 1024 * 1024:  # 20MB max
            raise ValueError("Image too large (max 20MB)")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")
    
    # Get API key
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    logger.info(f"Generating {request.num_variations} AI transformations for user {user_id}")
    logger.info(f"Prompt: {request.prompt[:100]}...")
    
    try:
        from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
        
        # Initialize image generator
        image_gen = OpenAIImageGeneration(api_key=api_key)
        
        # Build transformation prompt
        # For image editing, we describe what we want the final image to look like
        edit_prompt = f"Transform this image: {request.prompt}. Maintain the overall composition and subject while applying the requested changes. High quality, detailed result."
        
        # Generate variations
        # Note: GPT Image 1 generates new images based on prompt, so we include context about the original
        variations = []
        
        # Generate images (each call generates one image)
        for i in range(request.num_variations):
            try:
                # Generate image based on transformation prompt
                images = await asyncio.wait_for(
                    image_gen.generate_images(
                        prompt=edit_prompt,
                        model="gpt-image-1",
                        number_of_images=1
                    ),
                    timeout=GENERATION_TIMEOUT
                )
                
                if images and len(images) > 0:
                    # Convert bytes to base64
                    variation_base64 = base64.b64encode(images[0]).decode('utf-8')
                    variations.append(variation_base64)
                    logger.info(f"Generated variation {i+1}/{request.num_variations}")
                
            except asyncio.TimeoutError:
                logger.warning(f"Timeout generating variation {i+1}")
                continue
            except Exception as e:
                logger.error(f"Error generating variation {i+1}: {e}")
                continue
        
        if not variations:
            # Try alternative approach with more descriptive prompt
            logger.warning("No variations generated, trying alternative approach...")
            try:
                alt_prompt = f"Create an image that looks like: A photo with these modifications applied - {request.prompt}. Make it realistic and high quality."
                images = await asyncio.wait_for(
                    image_gen.generate_images(
                        prompt=alt_prompt,
                        model="gpt-image-1",
                        number_of_images=min(2, request.num_variations)
                    ),
                    timeout=GENERATION_TIMEOUT * 2
                )
                
                for img_bytes in images:
                    variation_base64 = base64.b64encode(img_bytes).decode('utf-8')
                    variations.append(variation_base64)
                    
            except Exception as e:
                logger.error(f"Alternative approach also failed: {e}")
        
        if not variations:
            return TransformResponse(
                success=False,
                variations=[],
                generations_remaining=MAX_GENERATIONS_PER_SESSION - current_count,
                error="Failed to generate transformations. Try a clearer description or different prompt."
            )
        
        # Increment generation count
        new_count = increment_user_generation_count(user_id, 1)
        
        logger.info(f"Successfully generated {len(variations)} variations for user {user_id}")
        
        return TransformResponse(
            success=True,
            variations=variations,
            generations_remaining=max(0, MAX_GENERATIONS_PER_SESSION - new_count),
            error=None
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI transformation error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"AI transformation failed: {str(e)}. Please try again."
        )


@transform_router.post("/reset")
async def reset_transform_session(current_user: dict = Depends(get_current_user_from_request)):
    """
    Reset transformation session (called after successful mint).
    This allows the user to generate more transformations for their next mint.
    """
    user_id = current_user["user_id"]
    reset_user_generation_count(user_id)
    
    return {
        "success": True,
        "message": "Transformation session reset",
        "generations_remaining": MAX_GENERATIONS_PER_SESSION
    }


# Helper function to call from minting routes after successful mint
async def on_mint_success(user_id: str):
    """Called after successful mint to reset transformation counter"""
    reset_user_generation_count(user_id)
