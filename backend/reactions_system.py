"""
Binary Reaction System
=====================
Implements golden thumbs up / silver thumbs down reactions
- Upvote: Awards 10 BL coins to content creator
- Downvote: No reward
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
UPVOTE_REWARD_BL = 10

class ReactionRequest(BaseModel):
    item_type: str  # 'post', 'listing', 'comment', etc.
    item_id: str
    reaction_type: Literal['up', 'down']
    is_toggle: bool = False  # True if removing existing reaction

class ReactionResponse(BaseModel):
    success: bool
    upvotes: int
    downvotes: int
    user_reaction: Optional[str]
    reward_given: bool = False
    message: Optional[str] = None

@reactions_router.post("/react", response_model=ReactionResponse)
async def react_to_item(
    request: ReactionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add or toggle a reaction on an item"""
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
            "upvotes": 0,
            "downvotes": 0,
            "user_reactions": {},  # {user_id: 'up' or 'down'}
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.reactions.insert_one(item_reactions)
    
    # Get existing user reaction
    existing_reaction = item_reactions.get("user_reactions", {}).get(user_id)
    
    # Calculate new counts
    upvotes = item_reactions.get("upvotes", 0)
    downvotes = item_reactions.get("downvotes", 0)
    new_reaction = None
    reward_given = False
    
    if request.is_toggle and existing_reaction == request.reaction_type:
        # Remove reaction
        if existing_reaction == 'up':
            upvotes = max(0, upvotes - 1)
        else:
            downvotes = max(0, downvotes - 1)
        new_reaction = None
    else:
        # Remove old reaction if switching
        if existing_reaction:
            if existing_reaction == 'up':
                upvotes = max(0, upvotes - 1)
            else:
                downvotes = max(0, downvotes - 1)
        
        # Add new reaction
        if request.reaction_type == 'up':
            upvotes += 1
            new_reaction = 'up'
            
            # Award BL coins to content creator for upvotes
            if existing_reaction != 'up':
                # Find content owner
                owner_id = await get_content_owner(request.item_type, request.item_id)
                if owner_id and owner_id != user_id:
                    # Award BL coins
                    await db.users.update_one(
                        {"user_id": owner_id},
                        {"$inc": {"bl_coins": UPVOTE_REWARD_BL}}
                    )
                    
                    # Record transaction
                    await db.transactions.insert_one({
                        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
                        "user_id": owner_id,
                        "type": "reaction_received",
                        "currency": "BL",
                        "amount": UPVOTE_REWARD_BL,
                        "description": f"Received upvote on {request.item_type}",
                        "related_item_type": request.item_type,
                        "related_item_id": request.item_id,
                        "from_user_id": user_id,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
                    
                    reward_given = True
                    logger.info(f"Awarded {UPVOTE_REWARD_BL} BL to {owner_id} for upvote")
        else:
            downvotes += 1
            new_reaction = 'down'
    
    # Update in database
    update_data = {
        "upvotes": upvotes,
        "downvotes": downvotes,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if new_reaction:
        update_data[f"user_reactions.{user_id}"] = new_reaction
    else:
        # Remove user reaction
        await db.reactions.update_one(
            {"item_type": request.item_type, "item_id": request.item_id},
            {"$unset": {f"user_reactions.{user_id}": ""}}
        )
    
    await db.reactions.update_one(
        {"item_type": request.item_type, "item_id": request.item_id},
        {"$set": update_data}
    )
    
    return ReactionResponse(
        success=True,
        upvotes=upvotes,
        downvotes=downvotes,
        user_reaction=new_reaction,
        reward_given=reward_given,
        message="Reaction updated"
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
