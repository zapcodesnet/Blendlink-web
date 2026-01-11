"""
AI Generation System for Blendlink
- Image Generation (OpenAI GPT Image 1)
- Video Generation (Sora 2)
- Music Generation (Browser-based, no API needed)
"""

import os
import uuid
import base64
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

from server import db, get_current_user

# Router
ai_generation_router = APIRouter(prefix="/ai", tags=["AI Generation"])

# ============== MODELS ==============

class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=1000)
    model: str = Field(default="gpt-image-1")
    number_of_images: int = Field(default=1, ge=1, le=4)

class VideoGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=1000)
    model: str = Field(default="sora-2")
    size: str = Field(default="1280x720")
    duration: int = Field(default=4)
    generate_thumbnail: bool = Field(default=True)  # Auto-generate AI thumbnail

class MusicGenerationRequest(BaseModel):
    genre: str = Field(default="electronic")
    mood: str = Field(default="upbeat")
    duration_seconds: int = Field(default=30, ge=5, le=120)
    tempo: int = Field(default=120, ge=60, le=200)
    generate_cover_art: bool = Field(default=True)  # Auto-generate AI cover art

# ============== IMAGE GENERATION ==============

@ai_generation_router.post("/generate-image")
async def generate_image(
    request: ImageGenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Generate an image using OpenAI GPT Image 1"""
    try:
        from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Create generation record
        generation_id = f"img_{uuid.uuid4().hex[:12]}"
        await db.ai_generations.insert_one({
            "generation_id": generation_id,
            "user_id": current_user["user_id"],
            "type": "image",
            "prompt": request.prompt,
            "model": request.model,
            "status": "processing",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Generate image
        image_gen = OpenAIImageGeneration(api_key=api_key)
        images = await image_gen.generate_images(
            prompt=request.prompt,
            model=request.model,
            number_of_images=request.number_of_images
        )
        
        if not images or len(images) == 0:
            await db.ai_generations.update_one(
                {"generation_id": generation_id},
                {"$set": {"status": "failed", "error": "No image generated"}}
            )
            raise HTTPException(status_code=500, detail="No image was generated")
        
        # Convert to base64
        image_results = []
        for i, image_bytes in enumerate(images):
            image_base64 = base64.b64encode(image_bytes).decode('utf-8')
            image_results.append({
                "index": i,
                "base64": image_base64,
                "data_url": f"data:image/png;base64,{image_base64}"
            })
        
        # Update record
        await db.ai_generations.update_one(
            {"generation_id": generation_id},
            {"$set": {
                "status": "completed",
                "result_count": len(image_results),
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        logger.info(f"Image generated for user {current_user['user_id']}: {generation_id}")
        
        return {
            "success": True,
            "generation_id": generation_id,
            "images": image_results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

# ============== VIDEO GENERATION ==============

# Store for video generation tasks
video_tasks = {}

@ai_generation_router.post("/generate-video")
async def generate_video(
    request: VideoGenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Start video generation using Sora 2 (background task)"""
    
    # Validate parameters
    valid_sizes = ["1280x720", "1792x1024", "1024x1792", "1024x1024"]
    valid_durations = [4, 8, 12]
    
    if request.size not in valid_sizes:
        raise HTTPException(status_code=400, detail=f"Invalid size. Use: {valid_sizes}")
    if request.duration not in valid_durations:
        raise HTTPException(status_code=400, detail=f"Invalid duration. Use: {valid_durations}")
    
    # Create generation record
    generation_id = f"vid_{uuid.uuid4().hex[:12]}"
    await db.ai_generations.insert_one({
        "generation_id": generation_id,
        "user_id": current_user["user_id"],
        "type": "video",
        "prompt": request.prompt,
        "model": request.model,
        "size": request.size,
        "duration": request.duration,
        "status": "queued",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Start background task
    background_tasks.add_task(
        process_video_generation,
        generation_id,
        request.prompt,
        request.model,
        request.size,
        request.duration
    )
    
    return {
        "success": True,
        "generation_id": generation_id,
        "status": "queued",
        "message": "Video generation started. This may take 2-10 minutes."
    }

async def process_video_generation(
    generation_id: str,
    prompt: str,
    model: str,
    size: str,
    duration: int
):
    """Background task to generate video"""
    try:
        from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration
        
        await db.ai_generations.update_one(
            {"generation_id": generation_id},
            {"$set": {"status": "processing", "started_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        api_key = os.environ.get('EMERGENT_LLM_KEY')
        if not api_key:
            raise Exception("AI service not configured")
        
        # Generate video
        video_gen = OpenAIVideoGeneration(api_key=api_key)
        
        # Determine wait time based on duration
        max_wait = 600 if duration <= 4 else (900 if duration <= 8 else 1200)
        
        video_bytes = video_gen.text_to_video(
            prompt=prompt,
            model=model,
            size=size,
            duration=duration,
            max_wait_time=max_wait
        )
        
        if video_bytes:
            # Save video
            video_filename = f"{generation_id}.mp4"
            video_path = f"/app/frontend/public/generated/{video_filename}"
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(video_path), exist_ok=True)
            
            video_gen.save_video(video_bytes, video_path)
            
            # Update record
            await db.ai_generations.update_one(
                {"generation_id": generation_id},
                {"$set": {
                    "status": "completed",
                    "video_url": f"/generated/{video_filename}",
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            logger.info(f"Video generated: {generation_id}")
        else:
            raise Exception("Video generation returned empty result")
            
    except Exception as e:
        logger.error(f"Video generation failed: {e}")
        await db.ai_generations.update_one(
            {"generation_id": generation_id},
            {"$set": {
                "status": "failed",
                "error": str(e),
                "failed_at": datetime.now(timezone.utc).isoformat()
            }}
        )

@ai_generation_router.get("/video-status/{generation_id}")
async def get_video_status(
    generation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check video generation status"""
    record = await db.ai_generations.find_one(
        {"generation_id": generation_id, "user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not record:
        raise HTTPException(status_code=404, detail="Generation not found")
    
    return record

# ============== MUSIC GENERATION (Browser-based params) ==============

@ai_generation_router.post("/generate-music-params")
async def generate_music_params(
    request: MusicGenerationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate parameters for browser-based music synthesis.
    The actual music is generated client-side using Web Audio API / Tone.js
    """
    
    # Genre-based settings
    genre_settings = {
        "electronic": {
            "synth_type": "sawtooth",
            "filter_freq": 2000,
            "reverb": 0.3,
            "delay": 0.2,
            "bass_enabled": True,
            "drums_enabled": True,
            "scale": "minor"
        },
        "ambient": {
            "synth_type": "sine",
            "filter_freq": 800,
            "reverb": 0.7,
            "delay": 0.5,
            "bass_enabled": False,
            "drums_enabled": False,
            "scale": "pentatonic"
        },
        "hiphop": {
            "synth_type": "square",
            "filter_freq": 1500,
            "reverb": 0.2,
            "delay": 0.1,
            "bass_enabled": True,
            "drums_enabled": True,
            "scale": "minor"
        },
        "jazz": {
            "synth_type": "triangle",
            "filter_freq": 3000,
            "reverb": 0.4,
            "delay": 0.3,
            "bass_enabled": True,
            "drums_enabled": True,
            "scale": "dorian"
        },
        "classical": {
            "synth_type": "sine",
            "filter_freq": 4000,
            "reverb": 0.5,
            "delay": 0.2,
            "bass_enabled": False,
            "drums_enabled": False,
            "scale": "major"
        },
        "rock": {
            "synth_type": "sawtooth",
            "filter_freq": 2500,
            "reverb": 0.3,
            "delay": 0.15,
            "bass_enabled": True,
            "drums_enabled": True,
            "scale": "pentatonic"
        }
    }
    
    # Mood-based modifiers
    mood_modifiers = {
        "upbeat": {"tempo_mult": 1.2, "octave_shift": 1, "attack": 0.01},
        "relaxed": {"tempo_mult": 0.8, "octave_shift": 0, "attack": 0.1},
        "energetic": {"tempo_mult": 1.3, "octave_shift": 1, "attack": 0.005},
        "melancholic": {"tempo_mult": 0.7, "octave_shift": -1, "attack": 0.15},
        "mysterious": {"tempo_mult": 0.9, "octave_shift": 0, "attack": 0.05},
        "happy": {"tempo_mult": 1.1, "octave_shift": 1, "attack": 0.02}
    }
    
    # Get base settings
    settings = genre_settings.get(request.genre, genre_settings["electronic"]).copy()
    mood = mood_modifiers.get(request.mood, mood_modifiers["upbeat"])
    
    # Apply mood modifiers
    adjusted_tempo = int(request.tempo * mood["tempo_mult"])
    
    # Generate a simple melody pattern based on scale
    scales = {
        "major": [0, 2, 4, 5, 7, 9, 11],
        "minor": [0, 2, 3, 5, 7, 8, 10],
        "pentatonic": [0, 2, 4, 7, 9],
        "dorian": [0, 2, 3, 5, 7, 9, 10]
    }
    
    scale = scales.get(settings["scale"], scales["major"])
    
    # Generate random melody pattern
    import random
    melody_length = 16
    melody = [random.choice(scale) + (mood["octave_shift"] * 12) for _ in range(melody_length)]
    
    # Generate drum pattern if enabled
    drum_pattern = None
    if settings["drums_enabled"]:
        drum_pattern = {
            "kick": [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            "snare": [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
            "hihat": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        }
    
    # Generate bass pattern if enabled
    bass_pattern = None
    if settings["bass_enabled"]:
        bass_pattern = [melody[i] - 12 if i % 4 == 0 else None for i in range(melody_length)]
    
    generation_id = f"mus_{uuid.uuid4().hex[:12]}"
    
    # Store generation record
    await db.ai_generations.insert_one({
        "generation_id": generation_id,
        "user_id": current_user["user_id"],
        "type": "music",
        "genre": request.genre,
        "mood": request.mood,
        "status": "completed",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "generation_id": generation_id,
        "params": {
            "tempo": adjusted_tempo,
            "duration": request.duration_seconds,
            "synth": {
                "type": settings["synth_type"],
                "attack": mood["attack"],
                "decay": 0.2,
                "sustain": 0.5,
                "release": 0.3
            },
            "effects": {
                "filter_freq": settings["filter_freq"],
                "reverb": settings["reverb"],
                "delay": settings["delay"]
            },
            "melody": melody,
            "bass_pattern": bass_pattern,
            "drum_pattern": drum_pattern,
            "scale": settings["scale"]
        }
    }

# ============== GENERATION HISTORY ==============

@ai_generation_router.get("/history")
async def get_generation_history(
    type: Optional[str] = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get user's AI generation history"""
    query = {"user_id": current_user["user_id"]}
    if type:
        query["type"] = type
    
    generations = await db.ai_generations.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"generations": generations}
