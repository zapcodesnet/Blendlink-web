"""
Binary Reaction System
=====================
Implements golden thumbs up / silver thumbs down reactions
- Golden Thumbs Up: Awards 10 BL coins to BOTH reactor and content creator
- Silver Thumbs Down: Awards 10 BL coins to reactor only (owner gets nothing)
- Reactions are PERMANENT (no undo/remove/change)
- Only one reaction per user per item
- Real-time sync across web and mobile
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime, timezone
import uuid

from server import get_current_user, db, logger

reactions_router = APIRouter(prefix="/reactions", tags=["Reactions"])

# Constants
GOLDEN_REWARD_REACTOR = 10  # BL coins for giving golden thumbs up
GOLDEN_REWARD_OWNER = 10    # BL coins for receiving golden thumbs up
SILVER_REWARD_REACTOR = 10  # BL coins for giving silver thumbs down (owner gets nothing)

class ReactionRequest(BaseModel):
    item_type: str  # 'post', 'listing', 'minted_photo', 'comment', etc.
    item_id: str
    reaction_type: Literal['golden_up', 'silver_down']  # Updated to match new system

class ReactionResponse(BaseModel):
    success: bool
    golden_count: int
    silver_count: int
    user_reaction: Optional[str]
    reactor_reward: int = 0
    owner_reward: int = 0
    message: Optional[str] = None

@reactions_router.post("/react", response_model=ReactionResponse)
async def react_to_item(
    request: ReactionRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Add a PERMANENT reaction on an item
    - Reactions cannot be removed or changed once placed
    - Golden thumbs up: Both reactor AND owner get 10 BL coins
    - Silver thumbs down: Only reactor gets 10 BL coins
    """
    user_id = current_user["user_id"]
    
    # Get or create reaction document for this item
    item_reactions = await db.reactions.find_one({
        "item_type": request.item_type,
        "item_id": request.item_id
    })
    
    if not item_reactions:
        item_reactions = {
            "reaction_id": f"react_{uuid.uuid4().hex[:12]}",
            "item_type": request.item_type,
            "item_id": request.item_id,
            "golden_count": 0,
            "silver_count": 0,
            "user_reactions": {},  # {user_id: 'golden_up' or 'silver_down'}
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.reactions.insert_one(item_reactions)
    
    # Check if user already reacted - REACTIONS ARE PERMANENT
    existing_reaction = item_reactions.get("user_reactions", {}).get(user_id)
    if existing_reaction:
        return ReactionResponse(
            success=False,
            golden_count=item_reactions.get("golden_count", 0),
            silver_count=item_reactions.get("silver_count", 0),
            user_reaction=existing_reaction,
            message="You have already reacted. Reactions are permanent and cannot be changed."
        )
    
    # Find content owner
    owner_id = await get_content_owner(request.item_type, request.item_id)
    
    # Cannot react to own content
    if owner_id == user_id:
        return ReactionResponse(
            success=False,
            golden_count=item_reactions.get("golden_count", 0),
            silver_count=item_reactions.get("silver_count", 0),
            user_reaction=None,
            message="You cannot react to your own content."
        )
    
    # Calculate new counts
    golden_count = item_reactions.get("golden_count", 0)
    silver_count = item_reactions.get("silver_count", 0)
    reactor_reward = 0
    owner_reward = 0
    
    if request.reaction_type == 'golden_up':
        golden_count += 1
        reactor_reward = GOLDEN_REWARD_REACTOR
        
        # Reactor gets 10 BL
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"bl_coins": GOLDEN_REWARD_REACTOR}}
        )
        await db.transactions.insert_one({
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "type": "reaction_given",
            "currency": "BL",
            "amount": GOLDEN_REWARD_REACTOR,
            "description": f"Gave golden thumbs up on {request.item_type}",
            "related_item_id": request.item_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Owner also gets 10 BL
        if owner_id:
            owner_reward = GOLDEN_REWARD_OWNER
            await db.users.update_one(
                {"user_id": owner_id},
                {"$inc": {"bl_coins": GOLDEN_REWARD_OWNER}}
            )
            await db.transactions.insert_one({
                "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
                "user_id": owner_id,
                "type": "reaction_received",
                "currency": "BL",
                "amount": GOLDEN_REWARD_OWNER,
                "description": f"Received golden thumbs up on {request.item_type}",
                "related_item_id": request.item_id,
                "from_user_id": user_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        logger.info(f"Golden reaction: reactor {user_id} +{GOLDEN_REWARD_REACTOR}BL, owner {owner_id} +{GOLDEN_REWARD_OWNER}BL")
        
    else:  # silver_down
        silver_count += 1
        reactor_reward = SILVER_REWARD_REACTOR
        
        # Only reactor gets 10 BL for thumbs down
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"bl_coins": SILVER_REWARD_REACTOR}}
        )
        await db.transactions.insert_one({
            "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "type": "reaction_given",
            "currency": "BL",
            "amount": SILVER_REWARD_REACTOR,
            "description": f"Gave silver thumbs down on {request.item_type}",
            "related_item_id": request.item_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"Silver reaction: reactor {user_id} +{SILVER_REWARD_REACTOR}BL")
    
    # Update in database - mark as permanent
    await db.reactions.update_one(
        {"item_type": request.item_type, "item_id": request.item_id},
        {
            "$set": {
                "golden_count": golden_count,
                "silver_count": silver_count,
                f"user_reactions.{user_id}": request.reaction_type,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Also update likes_count on the content for compatibility
    await update_content_likes(request.item_type, request.item_id, golden_count)
    
    return ReactionResponse(
        success=True,
        golden_count=golden_count,
        silver_count=silver_count,
        user_reaction=request.reaction_type,
        reactor_reward=reactor_reward,
        owner_reward=owner_reward,
        message="Reaction added permanently!"
    )


async def update_content_likes(item_type: str, item_id: str, golden_count: int):
    """Update likes_count on content for compatibility"""
    collection_map = {
        "post": ("posts", "post_id"),
        "listing": ("listings", "listing_id"),
        "minted_photo": ("minted_photos", "mint_id"),
        "comment": ("comments", "comment_id"),
    }
    
    if item_type in collection_map:
        collection, id_field = collection_map[item_type]
        await db[collection].update_one(
            {id_field: item_id},
            {"$set": {"likes_count": golden_count, "golden_reactions": golden_count}}
        )


@reactions_router.get("/item/{item_type}/{item_id}")
async def get_item_reactions(
    item_type: str,
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get reactions for an item"""
    item_reactions = await db.reactions.find_one({
        "item_type": item_type,
        "item_id": item_id
    }, {"_id": 0})
    
    if not item_reactions:
        return {
            "upvotes": 0,
            "downvotes": 0,
            "user_reaction": None
        }
    
    user_reaction = item_reactions.get("user_reactions", {}).get(current_user["user_id"])
    
    return {
        "upvotes": item_reactions.get("upvotes", 0),
        "downvotes": item_reactions.get("downvotes", 0),
        "user_reaction": user_reaction
    }

@reactions_router.get("/user/stats")
async def get_user_reaction_stats(current_user: dict = Depends(get_current_user)):
    """Get user's reaction statistics"""
    user_id = current_user["user_id"]
    
    # Count reactions given
    given_up = await db.reactions.count_documents({
        f"user_reactions.{user_id}": "up"
    })
    given_down = await db.reactions.count_documents({
        f"user_reactions.{user_id}": "down"
    })
    
    # Get total rewards earned from reactions
    rewards = await db.transactions.aggregate([
        {"$match": {"user_id": user_id, "type": "reaction_received"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    total_earned = rewards[0]["total"] if rewards else 0
    
    return {
        "reactions_given": {
            "upvotes": given_up,
            "downvotes": given_down,
            "total": given_up + given_down
        },
        "bl_earned_from_reactions": total_earned
    }

async def get_content_owner(item_type: str, item_id: str) -> Optional[str]:
    """Get the owner user_id of content"""
    collection_map = {
        "post": "posts",
        "listing": "listings",
        "comment": "comments",
        "story": "stories",
        "event": "events"
    }
    
    collection_name = collection_map.get(item_type, f"{item_type}s")
    
    try:
        item = await db[collection_name].find_one(
            {"$or": [
                {f"{item_type}_id": item_id},
                {"_id": item_id},
                {"id": item_id}
            ]},
            {"user_id": 1, "author_id": 1, "owner_id": 1, "seller_id": 1}
        )
        
        if item:
            return (
                item.get("user_id") or 
                item.get("author_id") or 
                item.get("owner_id") or 
                item.get("seller_id")
            )
    except Exception as e:
        logger.error(f"Error getting content owner: {e}")
    
    return None
