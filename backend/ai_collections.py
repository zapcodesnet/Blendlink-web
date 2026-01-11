"""
AI Collections System
Allows users to organize AI generations into themed collections/albums
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

from server import db, get_current_user

# Router
ai_collections_router = APIRouter(prefix="/ai/collections", tags=["AI Collections"])

# ============== MODELS ==============

class CreateCollectionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    theme: str = Field(default="default")  # default, dark, vibrant, minimal
    is_public: bool = Field(default=False)

class UpdateCollectionRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    theme: Optional[str] = None
    is_public: Optional[bool] = None
    cover_generation_id: Optional[str] = None

class AddToCollectionRequest(BaseModel):
    generation_ids: List[str]

# ============== COLLECTIONS CRUD ==============

@ai_collections_router.post("/")
async def create_collection(
    request: CreateCollectionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new AI collection"""
    collection_id = f"col_{uuid.uuid4().hex[:12]}"
    
    collection = {
        "collection_id": collection_id,
        "user_id": current_user["user_id"],
        "name": request.name,
        "description": request.description,
        "theme": request.theme,
        "is_public": request.is_public,
        "cover_generation_id": None,
        "generation_ids": [],
        "favorites_count": 0,
        "views_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ai_collections.insert_one(collection)
    
    # Return without _id
    collection.pop("_id", None)
    return {"success": True, "collection": collection}

@ai_collections_router.get("/")
async def get_my_collections(
    current_user: dict = Depends(get_current_user)
):
    """Get all collections for current user"""
    collections = await db.ai_collections.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("updated_at", -1).to_list(100)
    
    # Enrich with item counts and cover images
    for col in collections:
        col["item_count"] = len(col.get("generation_ids", []))
        
        # Get cover image
        if col.get("cover_generation_id"):
            cover = await db.ai_generations.find_one(
                {"generation_id": col["cover_generation_id"]},
                {"_id": 0, "thumbnail_url": 1, "cover_art_url": 1, "type": 1}
            )
            if cover:
                col["cover_url"] = cover.get("thumbnail_url") or cover.get("cover_art_url")
        elif col.get("generation_ids"):
            # Use first item as cover
            first_gen = await db.ai_generations.find_one(
                {"generation_id": col["generation_ids"][0]},
                {"_id": 0, "thumbnail_url": 1, "cover_art_url": 1, "type": 1}
            )
            if first_gen:
                col["cover_url"] = first_gen.get("thumbnail_url") or first_gen.get("cover_art_url")
    
    return {"collections": collections}

@ai_collections_router.get("/public")
async def get_public_collections(
    limit: int = Query(20, le=50),
    skip: int = Query(0)
):
    """Get public collections from all users"""
    collections = await db.ai_collections.find(
        {"is_public": True},
        {"_id": 0}
    ).sort("favorites_count", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user info and covers
    for col in collections:
        col["item_count"] = len(col.get("generation_ids", []))
        
        # Get user info
        user = await db.users.find_one(
            {"user_id": col["user_id"]},
            {"_id": 0, "name": 1, "profile_image": 1}
        )
        col["user"] = user
        
        # Get cover
        if col.get("generation_ids"):
            first_gen = await db.ai_generations.find_one(
                {"generation_id": col["generation_ids"][0]},
                {"_id": 0, "thumbnail_url": 1, "cover_art_url": 1}
            )
            if first_gen:
                col["cover_url"] = first_gen.get("thumbnail_url") or first_gen.get("cover_art_url")
    
    return {"collections": collections}

@ai_collections_router.get("/{collection_id}")
async def get_collection(
    collection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific collection with all generations"""
    collection = await db.ai_collections.find_one(
        {"collection_id": collection_id},
        {"_id": 0}
    )
    
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Check access
    if not collection["is_public"] and collection["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Increment views
    await db.ai_collections.update_one(
        {"collection_id": collection_id},
        {"$inc": {"views_count": 1}}
    )
    
    # Get all generations in this collection
    generations = []
    if collection.get("generation_ids"):
        generations = await db.ai_generations.find(
            {"generation_id": {"$in": collection["generation_ids"]}},
            {"_id": 0}
        ).to_list(100)
    
    collection["generations"] = generations
    collection["item_count"] = len(generations)
    
    # Get user info
    user = await db.users.find_one(
        {"user_id": collection["user_id"]},
        {"_id": 0, "name": 1, "profile_image": 1}
    )
    collection["user"] = user
    
    return collection

@ai_collections_router.put("/{collection_id}")
async def update_collection(
    collection_id: str,
    request: UpdateCollectionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update collection details"""
    collection = await db.ai_collections.find_one({
        "collection_id": collection_id,
        "user_id": current_user["user_id"]
    })
    
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if request.name is not None:
        update_data["name"] = request.name
    if request.description is not None:
        update_data["description"] = request.description
    if request.theme is not None:
        update_data["theme"] = request.theme
    if request.is_public is not None:
        update_data["is_public"] = request.is_public
    if request.cover_generation_id is not None:
        update_data["cover_generation_id"] = request.cover_generation_id
    
    await db.ai_collections.update_one(
        {"collection_id": collection_id},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Collection updated"}

@ai_collections_router.delete("/{collection_id}")
async def delete_collection(
    collection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a collection (doesn't delete the generations)"""
    result = await db.ai_collections.delete_one({
        "collection_id": collection_id,
        "user_id": current_user["user_id"]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    return {"success": True, "message": "Collection deleted"}

# ============== COLLECTION ITEMS ==============

@ai_collections_router.post("/{collection_id}/add")
async def add_to_collection(
    collection_id: str,
    request: AddToCollectionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add generations to a collection"""
    collection = await db.ai_collections.find_one({
        "collection_id": collection_id,
        "user_id": current_user["user_id"]
    })
    
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Verify generations belong to user
    valid_ids = []
    for gen_id in request.generation_ids:
        gen = await db.ai_generations.find_one({
            "generation_id": gen_id,
            "user_id": current_user["user_id"]
        })
        if gen and gen_id not in collection.get("generation_ids", []):
            valid_ids.append(gen_id)
    
    if valid_ids:
        await db.ai_collections.update_one(
            {"collection_id": collection_id},
            {
                "$push": {"generation_ids": {"$each": valid_ids}},
                "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
            }
        )
    
    return {"success": True, "added_count": len(valid_ids)}

@ai_collections_router.post("/{collection_id}/remove")
async def remove_from_collection(
    collection_id: str,
    request: AddToCollectionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Remove generations from a collection"""
    result = await db.ai_collections.update_one(
        {
            "collection_id": collection_id,
            "user_id": current_user["user_id"]
        },
        {
            "$pull": {"generation_ids": {"$in": request.generation_ids}},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    return {"success": True, "message": "Items removed"}

# ============== FAVORITES ==============

@ai_collections_router.post("/{collection_id}/favorite")
async def toggle_favorite_collection(
    collection_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle favorite on a public collection"""
    collection = await db.ai_collections.find_one({
        "collection_id": collection_id,
        "is_public": True
    })
    
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    # Check if already favorited
    existing = await db.ai_collection_favorites.find_one({
        "collection_id": collection_id,
        "user_id": current_user["user_id"]
    })
    
    if existing:
        # Remove favorite
        await db.ai_collection_favorites.delete_one({
            "collection_id": collection_id,
            "user_id": current_user["user_id"]
        })
        await db.ai_collections.update_one(
            {"collection_id": collection_id},
            {"$inc": {"favorites_count": -1}}
        )
        return {"success": True, "favorited": False}
    else:
        # Add favorite
        await db.ai_collection_favorites.insert_one({
            "collection_id": collection_id,
            "user_id": current_user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.ai_collections.update_one(
            {"collection_id": collection_id},
            {"$inc": {"favorites_count": 1}}
        )
        return {"success": True, "favorited": True}

@ai_collections_router.get("/favorites/mine")
async def get_my_favorite_collections(
    current_user: dict = Depends(get_current_user)
):
    """Get collections I've favorited"""
    favorites = await db.ai_collection_favorites.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0, "collection_id": 1}
    ).to_list(100)
    
    collection_ids = [f["collection_id"] for f in favorites]
    
    collections = await db.ai_collections.find(
        {"collection_id": {"$in": collection_ids}},
        {"_id": 0}
    ).to_list(100)
    
    # Enrich
    for col in collections:
        col["item_count"] = len(col.get("generation_ids", []))
        user = await db.users.find_one(
            {"user_id": col["user_id"]},
            {"_id": 0, "name": 1, "profile_image": 1}
        )
        col["user"] = user
    
    return {"collections": collections}

# ============== QUICK FAVORITES (for individual generations) ==============

@ai_collections_router.post("/generation/{generation_id}/favorite")
async def toggle_favorite_generation(
    generation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Toggle favorite on an individual generation"""
    generation = await db.ai_generations.find_one({
        "generation_id": generation_id,
        "user_id": current_user["user_id"]
    })
    
    if not generation:
        raise HTTPException(status_code=404, detail="Generation not found")
    
    is_favorited = generation.get("is_favorited", False)
    
    await db.ai_generations.update_one(
        {"generation_id": generation_id},
        {"$set": {"is_favorited": not is_favorited}}
    )
    
    return {"success": True, "is_favorited": not is_favorited}

@ai_collections_router.get("/generations/favorites")
async def get_favorite_generations(
    current_user: dict = Depends(get_current_user)
):
    """Get all favorited generations"""
    generations = await db.ai_generations.find(
        {
            "user_id": current_user["user_id"],
            "is_favorited": True
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"generations": generations}
