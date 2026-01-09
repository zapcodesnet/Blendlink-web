"""
Blendlink Social System - Facebook-style social features
- Posts with privacy settings
- Custom reactions (golden thumbs up / silver thumbs down)
- Comments with BL coin rewards
- Stories (24-hour expiry)
- Friends system
- Groups, Pages, Events
- AI Media Generation
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import logging
import base64
import asyncio
from dotenv import load_dotenv

load_dotenv()

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logger = logging.getLogger(__name__)

# ============== ROUTERS ==============
social_router = APIRouter(prefix="/social", tags=["Social"])
friends_router = APIRouter(prefix="/friends", tags=["Friends"])
stories_router = APIRouter(prefix="/stories", tags=["Stories"])
groups_router = APIRouter(prefix="/groups", tags=["Groups"])
pages_router = APIRouter(prefix="/pages", tags=["Pages"])
events_router = APIRouter(prefix="/events", tags=["Events"])
ai_media_router = APIRouter(prefix="/ai-media", tags=["AI Media Generation"])

# ============== MODELS ==============

class PostPrivacy:
    PUBLIC = "public"
    FRIENDS = "friends_only"
    PRIVATE = "private"

class ReactionType:
    GOLDEN_THUMBS_UP = "golden_thumbs_up"
    SILVER_THUMBS_DOWN = "silver_thumbs_down"

class MediaType:
    TEXT = "text"
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"

# BL Coin Rewards
BL_REWARDS = {
    "post_video": 50,
    "post_story": 50,
    "post_music": 30,
    "post_photo": 20,
    "create_event": 20,
    "create_group": 40,
    "create_page": 40,
    "page_subscribe": 10,  # Both subscriber and owner get this
    "share_post": 10,
    "reaction_given": 10,  # Reactor gets
    "reaction_received": 10,  # Post owner gets (only for golden thumbs up)
    "comment": 10,  # First comment per post
}

class SocialPost(BaseModel):
    post_id: str = Field(default_factory=lambda: f"post_{uuid.uuid4().hex[:12]}")
    user_id: str
    content: str = ""
    media_type: str = MediaType.TEXT  # text, image, video, audio
    media_urls: List[str] = []
    thumbnail_url: Optional[str] = None
    privacy: str = PostPrivacy.PUBLIC
    golden_thumbs_up_count: int = 0
    silver_thumbs_down_count: int = 0
    comments_count: int = 0
    shares_count: int = 0
    is_ai_generated: bool = False
    ai_prompt: Optional[str] = None
    # For shared posts
    original_post_id: Optional[str] = None
    shared_from_user_id: Optional[str] = None
    # Group/Page context
    group_id: Optional[str] = None
    page_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Story(BaseModel):
    story_id: str = Field(default_factory=lambda: f"story_{uuid.uuid4().hex[:12]}")
    user_id: str
    media_type: str = MediaType.IMAGE
    media_url: str
    thumbnail_url: Optional[str] = None
    privacy: str = PostPrivacy.PUBLIC
    views_count: int = 0
    viewers: List[str] = []
    is_ai_generated: bool = False
    expires_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=24))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Reaction(BaseModel):
    reaction_id: str = Field(default_factory=lambda: f"reaction_{uuid.uuid4().hex[:12]}")
    post_id: str
    user_id: str
    reaction_type: str  # golden_thumbs_up or silver_thumbs_down
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Comment(BaseModel):
    comment_id: str = Field(default_factory=lambda: f"comment_{uuid.uuid4().hex[:12]}")
    post_id: str
    user_id: str
    content: str
    parent_comment_id: Optional[str] = None  # For replies
    likes_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FriendRequest(BaseModel):
    request_id: str = Field(default_factory=lambda: f"freq_{uuid.uuid4().hex[:12]}")
    from_user_id: str
    to_user_id: str
    status: str = "pending"  # pending, accepted, declined
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Friendship(BaseModel):
    friendship_id: str = Field(default_factory=lambda: f"friend_{uuid.uuid4().hex[:12]}")
    user_id_1: str
    user_id_2: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Group(BaseModel):
    group_id: str = Field(default_factory=lambda: f"group_{uuid.uuid4().hex[:12]}")
    name: str
    description: str = ""
    cover_image: str = ""
    creator_id: str
    admin_ids: List[str] = []
    member_count: int = 0
    privacy: str = "public"  # public, private
    requires_approval: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Page(BaseModel):
    page_id: str = Field(default_factory=lambda: f"page_{uuid.uuid4().hex[:12]}")
    name: str
    description: str = ""
    category: str = ""
    cover_image: str = ""
    profile_image: str = ""
    creator_id: str
    admin_ids: List[str] = []
    subscriber_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Event(BaseModel):
    event_id: str = Field(default_factory=lambda: f"event_{uuid.uuid4().hex[:12]}")
    name: str
    description: str = ""
    cover_image: str = ""
    creator_id: str
    location: str = ""
    start_time: datetime
    end_time: Optional[datetime] = None
    privacy: str = "public"
    interested_count: int = 0
    going_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Album(BaseModel):
    album_id: str = Field(default_factory=lambda: f"album_{uuid.uuid4().hex[:12]}")
    user_id: str
    name: str
    description: str = ""
    cover_image: str = ""
    media_type: str = "photo"  # photo, video, music
    media_items: List[str] = []
    privacy: str = PostPrivacy.PUBLIC
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== REQUEST/RESPONSE MODELS ==============

class CreatePostRequest(BaseModel):
    content: str = ""
    media_type: str = MediaType.TEXT
    media_urls: List[str] = []
    privacy: str = PostPrivacy.PUBLIC
    group_id: Optional[str] = None
    page_id: Optional[str] = None

class CreateStoryRequest(BaseModel):
    media_type: str = MediaType.IMAGE
    media_url: str
    privacy: str = PostPrivacy.PUBLIC

class ReactToPostRequest(BaseModel):
    reaction_type: str  # golden_thumbs_up or silver_thumbs_down

class CreateCommentRequest(BaseModel):
    content: str
    parent_comment_id: Optional[str] = None

class CreateGroupRequest(BaseModel):
    name: str
    description: str = ""
    cover_image: str = ""
    privacy: str = "public"
    requires_approval: bool = False

class CreatePageRequest(BaseModel):
    name: str
    description: str = ""
    category: str = ""
    cover_image: str = ""
    profile_image: str = ""

class CreateEventRequest(BaseModel):
    name: str
    description: str = ""
    cover_image: str = ""
    location: str = ""
    start_time: datetime
    end_time: Optional[datetime] = None
    privacy: str = "public"

class AIMediaRequest(BaseModel):
    prompt: str
    media_type: str  # image, video, music
    duration: Optional[int] = None  # For video/music (6-15 seconds)
    uploaded_media_url: Optional[str] = None  # For editing existing media
    style: Optional[str] = None

# ============== HELPER FUNCTIONS ==============

# Import get_current_user from server module
from server import get_current_user

async def get_user_by_id(user_id: str):
    """Get user by ID"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return user

async def award_bl_coins(user_id: str, amount: float, reason: str):
    """Award BL coins to a user and record transaction"""
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"bl_coins": amount}}
    )
    
    # Get new balance
    user = await db.users.find_one({"user_id": user_id}, {"bl_coins": 1})
    new_balance = user.get("bl_coins", 0) if user else 0
    
    # Record transaction
    transaction = {
        "transaction_id": f"tx_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "type": "reward",
        "amount": amount,
        "description": reason,
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(transaction)
    
    return new_balance

async def deduct_bl_coins(user_id: str, amount: float, reason: str) -> bool:
    """Deduct BL coins from user. Returns True if successful, False if insufficient balance."""
    user = await db.users.find_one({"user_id": user_id}, {"bl_coins": 1})
    if not user or user.get("bl_coins", 0) < amount:
        return False
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"bl_coins": -amount}}
    )
    
    # Get new balance
    user = await db.users.find_one({"user_id": user_id}, {"bl_coins": 1})
    new_balance = user.get("bl_coins", 0) if user else 0
    
    # Record transaction
    transaction = {
        "transaction_id": f"tx_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "type": "deduction",
        "amount": -amount,
        "description": reason,
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(transaction)
    
    return True

async def are_friends(user_id_1: str, user_id_2: str) -> bool:
    """Check if two users are friends"""
    friendship = await db.friendships.find_one({
        "$or": [
            {"user_id_1": user_id_1, "user_id_2": user_id_2},
            {"user_id_1": user_id_2, "user_id_2": user_id_1}
        ]
    })
    return friendship is not None

async def can_view_content(viewer_id: str, content_owner_id: str, privacy: str) -> bool:
    """Check if viewer can see content based on privacy setting"""
    if privacy == PostPrivacy.PUBLIC:
        return True
    if privacy == PostPrivacy.PRIVATE:
        return viewer_id == content_owner_id
    if privacy == PostPrivacy.FRIENDS:
        return viewer_id == content_owner_id or await are_friends(viewer_id, content_owner_id)
    return False

async def enrich_post_with_user(post: dict) -> dict:
    """Add user info to post"""
    user = await get_user_by_id(post["user_id"])
    post["user"] = {
        "user_id": user["user_id"] if user else post["user_id"],
        "name": user.get("name", "Unknown") if user else "Unknown",
        "username": user.get("username", "") if user else "",
        "avatar": user.get("avatar", "") if user else ""
    }
    return post

# ============== SOCIAL FEED ENDPOINTS ==============

@social_router.get("/feed")
async def get_social_feed(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get personalized social feed - posts from friends, groups, pages"""
    user_id = current_user["user_id"]
    
    # Get user's friends
    friendships = await db.friendships.find({
        "$or": [{"user_id_1": user_id}, {"user_id_2": user_id}]
    }).to_list(1000)
    
    friend_ids = []
    for f in friendships:
        friend_ids.append(f["user_id_1"] if f["user_id_2"] == user_id else f["user_id_2"])
    
    # Get subscribed pages
    page_subs = await db.page_subscriptions.find({"user_id": user_id}).to_list(100)
    page_ids = [s["page_id"] for s in page_subs]
    
    # Get joined groups
    group_memberships = await db.group_members.find({"user_id": user_id}).to_list(100)
    group_ids = [m["group_id"] for m in group_memberships]
    
    # Build query for feed posts
    feed_query = {
        "$or": [
            # Own posts
            {"user_id": user_id},
            # Friends' public/friends-only posts
            {"user_id": {"$in": friend_ids}, "privacy": {"$in": [PostPrivacy.PUBLIC, PostPrivacy.FRIENDS]}},
            # Public posts from others
            {"privacy": PostPrivacy.PUBLIC},
            # Posts from subscribed pages
            {"page_id": {"$in": page_ids}},
            # Posts from joined groups
            {"group_id": {"$in": group_ids}}
        ]
    }
    
    posts = await db.social_posts.find(
        feed_query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich posts with user info and check if current user reacted
    enriched_posts = []
    for post in posts:
        post = await enrich_post_with_user(post)
        
        # Check if user has reacted
        user_reaction = await db.reactions.find_one({
            "post_id": post["post_id"],
            "user_id": user_id
        }, {"_id": 0})
        post["user_reaction"] = user_reaction.get("reaction_type") if user_reaction else None
        
        enriched_posts.append(post)
    
    return enriched_posts

@social_router.post("/posts")
async def create_post(
    request: CreatePostRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new post with BL coin rewards"""
    user_id = current_user["user_id"]
    
    # Determine media type and reward
    reward = 0
    reward_reason = ""
    
    if request.privacy == PostPrivacy.PUBLIC:
        if request.media_type == MediaType.VIDEO:
            reward = BL_REWARDS["post_video"]
            reward_reason = "Posted video to feed"
        elif request.media_type == MediaType.AUDIO:
            reward = BL_REWARDS["post_music"]
            reward_reason = "Posted music to feed"
        elif request.media_type == MediaType.IMAGE:
            reward = BL_REWARDS["post_photo"]
            reward_reason = "Posted photo to feed"
    
    # Create post
    post = SocialPost(
        user_id=user_id,
        content=request.content,
        media_type=request.media_type,
        media_urls=request.media_urls,
        privacy=request.privacy,
        group_id=request.group_id,
        page_id=request.page_id
    )
    
    post_dict = post.model_dump()
    post_dict["created_at"] = post_dict["created_at"].isoformat()
    post_dict["updated_at"] = post_dict["updated_at"].isoformat()
    
    await db.social_posts.insert_one(post_dict.copy())
    
    # Award BL coins
    new_balance = current_user.get("bl_coins", 0)
    if reward > 0:
        new_balance = await award_bl_coins(user_id, reward, reward_reason)
    
    # Add user info to response
    post_dict["user"] = {
        "user_id": user_id,
        "name": current_user.get("name", "Unknown"),
        "avatar": current_user.get("avatar", "")
    }
    
    return {
        "post": post_dict,
        "bl_coins_earned": reward,
        "new_balance": new_balance
    }

@social_router.get("/posts/{post_id}")
async def get_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Get a single post by ID"""
    post = await db.social_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check privacy
    if not await can_view_content(current_user["user_id"], post["user_id"], post["privacy"]):
        raise HTTPException(status_code=403, detail="You don't have permission to view this post")
    
    post = await enrich_post_with_user(post)
    
    # Check user reaction
    user_reaction = await db.reactions.find_one({
        "post_id": post_id,
        "user_id": current_user["user_id"]
    }, {"_id": 0})
    post["user_reaction"] = user_reaction.get("reaction_type") if user_reaction else None
    
    return post

@social_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a post (owner only)"""
    post = await db.social_posts.find_one({"post_id": post_id})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post["user_id"] != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="You can only delete your own posts")
    
    await db.social_posts.delete_one({"post_id": post_id})
    await db.reactions.delete_many({"post_id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    
    return {"message": "Post deleted successfully"}

# ============== REACTIONS ENDPOINTS ==============

@social_router.post("/posts/{post_id}/react")
async def react_to_post(
    post_id: str,
    request: ReactToPostRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    React to a post with golden thumbs up or silver thumbs down.
    - Reactions are permanent (cannot change or remove)
    - Post owners cannot react to their own posts
    - Golden thumbs up: Both reactor and post owner get 10 BL coins
    - Silver thumbs down: Only reactor gets 10 BL coins
    """
    user_id = current_user["user_id"]
    
    # Get post
    post = await db.social_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user is post owner
    if post["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="You cannot react to your own post")
    
    # Check if already reacted
    existing_reaction = await db.reactions.find_one({
        "post_id": post_id,
        "user_id": user_id
    })
    if existing_reaction:
        raise HTTPException(status_code=400, detail="You have already reacted to this post. Reactions are permanent.")
    
    # Validate reaction type
    if request.reaction_type not in [ReactionType.GOLDEN_THUMBS_UP, ReactionType.SILVER_THUMBS_DOWN]:
        raise HTTPException(status_code=400, detail="Invalid reaction type")
    
    # Create reaction
    reaction = Reaction(
        post_id=post_id,
        user_id=user_id,
        reaction_type=request.reaction_type
    )
    reaction_dict = reaction.model_dump()
    reaction_dict["created_at"] = reaction_dict["created_at"].isoformat()
    await db.reactions.insert_one(reaction_dict)
    
    # Update post counts
    update_field = "golden_thumbs_up_count" if request.reaction_type == ReactionType.GOLDEN_THUMBS_UP else "silver_thumbs_down_count"
    await db.social_posts.update_one(
        {"post_id": post_id},
        {"$inc": {update_field: 1}}
    )
    
    # Award BL coins (only for public posts)
    reactor_reward = 0
    owner_reward = 0
    
    if post["privacy"] == PostPrivacy.PUBLIC:
        # Reactor always gets coins
        reactor_reward = BL_REWARDS["reaction_given"]
        await award_bl_coins(user_id, reactor_reward, f"Reacted to post")
        
        # Post owner only gets coins for golden thumbs up
        if request.reaction_type == ReactionType.GOLDEN_THUMBS_UP:
            owner_reward = BL_REWARDS["reaction_received"]
            await award_bl_coins(post["user_id"], owner_reward, "Received golden thumbs up reaction")
    
    # Send push notification to post owner
    try:
        from notifications_analytics import send_notification_to_user, track_analytics_event, NotificationType
        
        reaction_emoji = "⭐" if request.reaction_type == ReactionType.GOLDEN_THUMBS_UP else "👎"
        reaction_text = "liked" if request.reaction_type == ReactionType.GOLDEN_THUMBS_UP else "disliked"
        
        await send_notification_to_user(
            user_id=post["user_id"],
            notification_type=NotificationType.REACTION,
            title=f"{current_user.get('name', 'Someone')} {reaction_text} your post",
            body=f"{reaction_emoji} {current_user.get('name', 'Someone')} reacted to your post" + (f" (+{owner_reward} BL coins)" if owner_reward > 0 else ""),
            data={
                "post_id": post_id,
                "reactor_id": user_id,
                "reaction_type": request.reaction_type
            },
            background_tasks=background_tasks
        )
        
        # Track analytics
        await track_analytics_event(user_id, "reaction_given", 1)
        await track_analytics_event(post["user_id"], "reaction_received", 1)
    except Exception as e:
        logger.error(f"Failed to send reaction notification: {e}")
    
    # Get updated counts
    updated_post = await db.social_posts.find_one({"post_id": post_id}, {"_id": 0})
    
    return {
        "reaction_type": request.reaction_type,
        "golden_thumbs_up_count": updated_post["golden_thumbs_up_count"],
        "silver_thumbs_down_count": updated_post["silver_thumbs_down_count"],
        "reactor_bl_coins_earned": reactor_reward,
        "owner_bl_coins_earned": owner_reward
    }

@social_router.get("/posts/{post_id}/reactions")
async def get_post_reactions(
    post_id: str,
    reaction_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get reactions for a post"""
    query = {"post_id": post_id}
    if reaction_type:
        query["reaction_type"] = reaction_type
    
    reactions = await db.reactions.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user info
    for reaction in reactions:
        user = await get_user_by_id(reaction["user_id"])
        reaction["user"] = {
            "user_id": user["user_id"] if user else reaction["user_id"],
            "name": user.get("name", "Unknown") if user else "Unknown",
            "avatar": user.get("avatar", "") if user else ""
        }
    
    return reactions

# ============== COMMENTS ENDPOINTS ==============

@social_router.post("/posts/{post_id}/comments")
async def create_comment(
    post_id: str,
    request: CreateCommentRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a comment on a post.
    - First comment on a post earns 10 BL coins (public posts only)
    - Post owners commenting don't earn coins
    """
    user_id = current_user["user_id"]
    
    # Get post
    post = await db.social_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if user can comment (based on privacy)
    if not await can_view_content(user_id, post["user_id"], post["privacy"]):
        raise HTTPException(status_code=403, detail="You cannot comment on this post")
    
    # Check if this is user's first comment on this post
    existing_comment = await db.comments.find_one({
        "post_id": post_id,
        "user_id": user_id
    })
    
    # Create comment
    comment = Comment(
        post_id=post_id,
        user_id=user_id,
        content=request.content,
        parent_comment_id=request.parent_comment_id
    )
    comment_dict = comment.model_dump()
    comment_dict["created_at"] = comment_dict["created_at"].isoformat()
    await db.comments.insert_one(comment_dict.copy())
    
    # Update post comment count
    await db.social_posts.update_one(
        {"post_id": post_id},
        {"$inc": {"comments_count": 1}}
    )
    
    # Award BL coins (only for first comment on public posts, and not for post owners)
    bl_earned = 0
    if post["privacy"] == PostPrivacy.PUBLIC and not existing_comment and user_id != post["user_id"]:
        bl_earned = BL_REWARDS["comment"]
        await award_bl_coins(user_id, bl_earned, f"First comment on post")
    
    # Send push notification to post owner (if commenter is not the owner)
    if user_id != post["user_id"]:
        try:
            from notifications_analytics import send_notification_to_user, track_analytics_event, NotificationType
            
            comment_preview = request.content[:50] + "..." if len(request.content) > 50 else request.content
            
            await send_notification_to_user(
                user_id=post["user_id"],
                notification_type=NotificationType.COMMENT,
                title=f"{current_user.get('name', 'Someone')} commented on your post",
                body=f'💬 "{comment_preview}"',
                data={
                    "post_id": post_id,
                    "comment_id": comment.comment_id,
                    "commenter_id": user_id
                },
                background_tasks=background_tasks
            )
            
            # Track analytics
            await track_analytics_event(user_id, "comment_made", 1)
            await track_analytics_event(post["user_id"], "comment_received", 1)
        except Exception as e:
            logger.error(f"Failed to send comment notification: {e}")
    
    # Remove _id if present (MongoDB adds it)
    comment_dict.pop("_id", None)
    
    # Enrich with user info
    comment_dict["user"] = {
        "user_id": user_id,
        "name": current_user.get("name", "Unknown"),
        "avatar": current_user.get("avatar", "")
    }
    
    return {
        "comment": comment_dict,
        "bl_coins_earned": bl_earned
    }

@social_router.get("/posts/{post_id}/comments")
async def get_comments(
    post_id: str,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get comments for a post"""
    comments = await db.comments.find(
        {"post_id": post_id, "parent_comment_id": None},
        {"_id": 0}
    ).sort("created_at", 1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user info and get replies
    for comment in comments:
        user = await get_user_by_id(comment["user_id"])
        comment["user"] = {
            "user_id": user["user_id"] if user else comment["user_id"],
            "name": user.get("name", "Unknown") if user else "Unknown",
            "avatar": user.get("avatar", "") if user else ""
        }
        
        # Get replies
        replies = await db.comments.find(
            {"parent_comment_id": comment["comment_id"]},
            {"_id": 0}
        ).sort("created_at", 1).to_list(50)
        
        for reply in replies:
            reply_user = await get_user_by_id(reply["user_id"])
            reply["user"] = {
                "user_id": reply_user["user_id"] if reply_user else reply["user_id"],
                "name": reply_user.get("name", "Unknown") if reply_user else "Unknown",
                "avatar": reply_user.get("avatar", "") if reply_user else ""
            }
        
        comment["replies"] = replies
    
    return comments

@social_router.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a comment (owner only)"""
    comment = await db.comments.find_one({"comment_id": comment_id})
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment["user_id"] != current_user["user_id"] and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    
    # Delete comment and its replies
    await db.comments.delete_many({
        "$or": [
            {"comment_id": comment_id},
            {"parent_comment_id": comment_id}
        ]
    })
    
    # Update post comment count
    await db.social_posts.update_one(
        {"post_id": comment["post_id"]},
        {"$inc": {"comments_count": -1}}
    )
    
    return {"message": "Comment deleted successfully"}

# ============== SHARE POST ==============

@social_router.post("/posts/{post_id}/share")
async def share_post(
    post_id: str,
    content: str = "",
    privacy: str = PostPrivacy.PUBLIC,
    current_user: dict = Depends(get_current_user)
):
    """Share a post (creates a new post linking to original)"""
    user_id = current_user["user_id"]
    
    # Get original post
    original_post = await db.social_posts.find_one({"post_id": post_id}, {"_id": 0})
    if not original_post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Check if can share
    if original_post["privacy"] == PostPrivacy.PRIVATE:
        raise HTTPException(status_code=403, detail="Cannot share private posts")
    
    # Create shared post
    shared_post = SocialPost(
        user_id=user_id,
        content=content,
        media_type=original_post["media_type"],
        media_urls=original_post["media_urls"],
        privacy=privacy,
        original_post_id=post_id,
        shared_from_user_id=original_post["user_id"]
    )
    
    post_dict = shared_post.model_dump()
    post_dict["created_at"] = post_dict["created_at"].isoformat()
    post_dict["updated_at"] = post_dict["updated_at"].isoformat()
    await db.social_posts.insert_one(post_dict.copy())
    
    # Update original post share count
    await db.social_posts.update_one(
        {"post_id": post_id},
        {"$inc": {"shares_count": 1}}
    )
    
    # Award BL coins for sharing public posts
    bl_earned = 0
    if privacy == PostPrivacy.PUBLIC:
        bl_earned = BL_REWARDS["share_post"]
        await award_bl_coins(user_id, bl_earned, "Shared a post")
    
    # Remove _id if present (MongoDB adds it)
    post_dict.pop("_id", None)
    
    return {
        "post": post_dict,
        "bl_coins_earned": bl_earned
    }

# ============== STORIES ENDPOINTS ==============

@stories_router.get("/")
async def get_stories(current_user: dict = Depends(get_current_user)):
    """Get stories from friends and self (not expired)"""
    user_id = current_user["user_id"]
    
    # Get friends
    friendships = await db.friendships.find({
        "$or": [{"user_id_1": user_id}, {"user_id_2": user_id}]
    }).to_list(1000)
    
    friend_ids = [user_id]  # Include self
    for f in friendships:
        friend_ids.append(f["user_id_1"] if f["user_id_2"] == user_id else f["user_id_2"])
    
    now = datetime.now(timezone.utc)
    
    # Get unexpired stories
    stories = await db.stories.find({
        "user_id": {"$in": friend_ids},
        "expires_at": {"$gt": now.isoformat()},
        "$or": [
            {"privacy": PostPrivacy.PUBLIC},
            {"privacy": PostPrivacy.FRIENDS, "user_id": {"$in": friend_ids}},
            {"user_id": user_id}
        ]
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Group by user
    stories_by_user = {}
    for story in stories:
        uid = story["user_id"]
        if uid not in stories_by_user:
            user = await get_user_by_id(uid)
            stories_by_user[uid] = {
                "user": {
                    "user_id": uid,
                    "name": user.get("name", "Unknown") if user else "Unknown",
                    "avatar": user.get("avatar", "") if user else ""
                },
                "stories": [],
                "has_unviewed": False
            }
        stories_by_user[uid]["stories"].append(story)
        if user_id not in story.get("viewers", []):
            stories_by_user[uid]["has_unviewed"] = True
    
    return list(stories_by_user.values())

@stories_router.post("/")
async def create_story(
    request: CreateStoryRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new story (24-hour expiry)"""
    user_id = current_user["user_id"]
    
    story = Story(
        user_id=user_id,
        media_type=request.media_type,
        media_url=request.media_url,
        privacy=request.privacy
    )
    
    story_dict = story.model_dump()
    story_dict["created_at"] = story_dict["created_at"].isoformat()
    story_dict["expires_at"] = story_dict["expires_at"].isoformat()
    await db.stories.insert_one(story_dict.copy())
    
    # Award BL coins for public stories
    bl_earned = 0
    if request.privacy == PostPrivacy.PUBLIC:
        bl_earned = BL_REWARDS["post_story"]
        await award_bl_coins(user_id, bl_earned, "Posted a story")
    
    # Remove _id if present (MongoDB adds it)
    story_dict.pop("_id", None)
    
    return {
        "story": story_dict,
        "bl_coins_earned": bl_earned
    }

@stories_router.post("/{story_id}/view")
async def view_story(story_id: str, current_user: dict = Depends(get_current_user)):
    """Mark a story as viewed"""
    user_id = current_user["user_id"]
    
    await db.stories.update_one(
        {"story_id": story_id},
        {
            "$addToSet": {"viewers": user_id},
            "$inc": {"views_count": 1}
        }
    )
    
    return {"message": "Story viewed"}

@stories_router.delete("/{story_id}")
async def delete_story(story_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a story (owner only)"""
    story = await db.stories.find_one({"story_id": story_id})
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    
    if story["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own stories")
    
    await db.stories.delete_one({"story_id": story_id})
    return {"message": "Story deleted"}

# ============== FRIENDS ENDPOINTS ==============

@friends_router.get("/")
async def get_friends(current_user: dict = Depends(get_current_user)):
    """Get list of friends"""
    user_id = current_user["user_id"]
    
    friendships = await db.friendships.find({
        "$or": [{"user_id_1": user_id}, {"user_id_2": user_id}]
    }, {"_id": 0}).to_list(1000)
    
    friends = []
    for f in friendships:
        friend_id = f["user_id_1"] if f["user_id_2"] == user_id else f["user_id_2"]
        friend = await get_user_by_id(friend_id)
        if friend:
            friends.append({
                "user_id": friend["user_id"],
                "name": friend.get("name", "Unknown"),
                "username": friend.get("username", ""),
                "avatar": friend.get("avatar", ""),
                "friendship_date": f["created_at"]
            })
    
    return friends

@friends_router.get("/requests")
async def get_friend_requests(current_user: dict = Depends(get_current_user)):
    """Get pending friend requests"""
    user_id = current_user["user_id"]
    
    # Incoming requests
    incoming = await db.friend_requests.find({
        "to_user_id": user_id,
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    for req in incoming:
        user = await get_user_by_id(req["from_user_id"])
        req["from_user"] = {
            "user_id": user["user_id"] if user else req["from_user_id"],
            "name": user.get("name", "Unknown") if user else "Unknown",
            "avatar": user.get("avatar", "") if user else ""
        }
    
    # Outgoing requests
    outgoing = await db.friend_requests.find({
        "from_user_id": user_id,
        "status": "pending"
    }, {"_id": 0}).to_list(100)
    
    for req in outgoing:
        user = await get_user_by_id(req["to_user_id"])
        req["to_user"] = {
            "user_id": user["user_id"] if user else req["to_user_id"],
            "name": user.get("name", "Unknown") if user else "Unknown",
            "avatar": user.get("avatar", "") if user else ""
        }
    
    return {
        "incoming": incoming,
        "outgoing": outgoing
    }

@friends_router.post("/request/{to_user_id}")
async def send_friend_request(
    to_user_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Send a friend request"""
    from_user_id = current_user["user_id"]
    
    if from_user_id == to_user_id:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")
    
    # Check if already friends
    if await are_friends(from_user_id, to_user_id):
        raise HTTPException(status_code=400, detail="Already friends")
    
    # Check for existing pending request
    existing = await db.friend_requests.find_one({
        "$or": [
            {"from_user_id": from_user_id, "to_user_id": to_user_id, "status": "pending"},
            {"from_user_id": to_user_id, "to_user_id": from_user_id, "status": "pending"}
        ]
    })
    if existing:
        raise HTTPException(status_code=400, detail="Friend request already pending")
    
    # Create request
    friend_request = FriendRequest(from_user_id=from_user_id, to_user_id=to_user_id)
    req_dict = friend_request.model_dump()
    req_dict["created_at"] = req_dict["created_at"].isoformat()
    await db.friend_requests.insert_one(req_dict)
    
    # Send push notification
    try:
        from notifications_analytics import send_notification_to_user, track_analytics_event, NotificationType
        
        await send_notification_to_user(
            user_id=to_user_id,
            notification_type=NotificationType.FRIEND_REQUEST,
            title="New Friend Request",
            body=f"👥 {current_user.get('name', 'Someone')} wants to be your friend!",
            data={
                "request_id": friend_request.request_id,
                "from_user_id": from_user_id,
                "from_user_name": current_user.get("name", "Unknown")
            },
            background_tasks=background_tasks
        )
        
        # Track analytics
        await track_analytics_event(from_user_id, "friend_request_sent", 1)
        await track_analytics_event(to_user_id, "friend_request_received", 1)
    except Exception as e:
        logger.error(f"Failed to send friend request notification: {e}")
    
    return {"message": "Friend request sent", "request_id": friend_request.request_id}

@friends_router.post("/accept/{request_id}")
async def accept_friend_request(
    request_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Accept a friend request"""
    user_id = current_user["user_id"]
    
    friend_req = await db.friend_requests.find_one({
        "request_id": request_id,
        "to_user_id": user_id,
        "status": "pending"
    })
    
    if not friend_req:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    # Create friendship
    friendship = Friendship(
        user_id_1=friend_req["from_user_id"],
        user_id_2=user_id
    )
    friend_dict = friendship.model_dump()
    friend_dict["created_at"] = friend_dict["created_at"].isoformat()
    await db.friendships.insert_one(friend_dict)
    
    # Update request status
    await db.friend_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "accepted"}}
    )
    
    # Update friend counts
    await db.users.update_one({"user_id": friend_req["from_user_id"]}, {"$inc": {"followers_count": 1}})
    await db.users.update_one({"user_id": user_id}, {"$inc": {"followers_count": 1}})
    
    # Send push notification to the requester
    try:
        from notifications_analytics import send_notification_to_user, track_analytics_event, NotificationType
        
        await send_notification_to_user(
            user_id=friend_req["from_user_id"],
            notification_type=NotificationType.FRIEND_ACCEPTED,
            title="Friend Request Accepted!",
            body=f"🎉 {current_user.get('name', 'Someone')} accepted your friend request!",
            data={
                "user_id": user_id,
                "user_name": current_user.get("name", "Unknown")
            },
            background_tasks=background_tasks
        )
        
        # Track analytics
        await track_analytics_event(friend_req["from_user_id"], "friend_added", 1)
        await track_analytics_event(user_id, "friend_added", 1)
    except Exception as e:
        logger.error(f"Failed to send friend accepted notification: {e}")
    
    return {"message": "Friend request accepted"}

@friends_router.post("/decline/{request_id}")
async def decline_friend_request(request_id: str, current_user: dict = Depends(get_current_user)):
    """Decline a friend request"""
    user_id = current_user["user_id"]
    
    result = await db.friend_requests.update_one(
        {"request_id": request_id, "to_user_id": user_id, "status": "pending"},
        {"$set": {"status": "declined"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    return {"message": "Friend request declined"}

@friends_router.delete("/{friend_id}")
async def unfriend(friend_id: str, current_user: dict = Depends(get_current_user)):
    """Remove a friend"""
    user_id = current_user["user_id"]
    
    result = await db.friendships.delete_one({
        "$or": [
            {"user_id_1": user_id, "user_id_2": friend_id},
            {"user_id_1": friend_id, "user_id_2": user_id}
        ]
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Friendship not found")
    
    # Update friend counts
    await db.users.update_one({"user_id": friend_id}, {"$inc": {"followers_count": -1}})
    await db.users.update_one({"user_id": user_id}, {"$inc": {"followers_count": -1}})
    
    return {"message": "Unfriended successfully"}

@friends_router.get("/search")
async def search_users(
    query: str,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Search for users to add as friends"""
    users = await db.users.find(
        {
            "$or": [
                {"name": {"$regex": query, "$options": "i"}},
                {"username": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}}
            ],
            "user_id": {"$ne": current_user["user_id"]}
        },
        {"_id": 0, "password_hash": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    # Add friendship status
    for user in users:
        user["is_friend"] = await are_friends(current_user["user_id"], user["user_id"])
        
        # Check for pending request
        pending = await db.friend_requests.find_one({
            "$or": [
                {"from_user_id": current_user["user_id"], "to_user_id": user["user_id"], "status": "pending"},
                {"from_user_id": user["user_id"], "to_user_id": current_user["user_id"], "status": "pending"}
            ]
        })
        user["request_pending"] = pending is not None
    
    return users

# ============== GROUPS ENDPOINTS ==============

@groups_router.get("/")
async def get_groups(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get groups (user's groups and public groups)"""
    user_id = current_user["user_id"]
    
    # Get user's group memberships
    memberships = await db.group_members.find({"user_id": user_id}).to_list(100)
    member_group_ids = [m["group_id"] for m in memberships]
    
    groups = await db.groups.find(
        {"$or": [
            {"group_id": {"$in": member_group_ids}},
            {"privacy": "public"}
        ]},
        {"_id": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    for group in groups:
        group["is_member"] = group["group_id"] in member_group_ids
        group["is_admin"] = user_id in group.get("admin_ids", []) or user_id == group["creator_id"]
    
    return groups

@groups_router.post("/")
async def create_group(
    request: CreateGroupRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new group"""
    user_id = current_user["user_id"]
    
    group = Group(
        name=request.name,
        description=request.description,
        cover_image=request.cover_image,
        creator_id=user_id,
        admin_ids=[user_id],
        privacy=request.privacy,
        requires_approval=request.requires_approval,
        member_count=1
    )
    
    group_dict = group.model_dump()
    group_dict["created_at"] = group_dict["created_at"].isoformat()
    await db.groups.insert_one(group_dict.copy())
    
    # Add creator as member
    await db.group_members.insert_one({
        "group_id": group.group_id,
        "user_id": user_id,
        "role": "admin",
        "joined_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Award BL coins
    bl_earned = BL_REWARDS["create_group"]
    await award_bl_coins(user_id, bl_earned, f"Created group: {request.name}")
    
    # Remove _id if present (MongoDB adds it)
    group_dict.pop("_id", None)
    
    return {
        "group": group_dict,
        "bl_coins_earned": bl_earned
    }

@groups_router.post("/{group_id}/join")
async def join_group(group_id: str, current_user: dict = Depends(get_current_user)):
    """Join a group"""
    user_id = current_user["user_id"]
    
    group = await db.groups.find_one({"group_id": group_id})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Check if already member
    existing = await db.group_members.find_one({"group_id": group_id, "user_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already a member")
    
    if group["requires_approval"]:
        # Create join request
        await db.group_join_requests.insert_one({
            "request_id": f"gjr_{uuid.uuid4().hex[:12]}",
            "group_id": group_id,
            "user_id": user_id,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"message": "Join request sent, waiting for admin approval"}
    
    # Direct join
    await db.group_members.insert_one({
        "group_id": group_id,
        "user_id": user_id,
        "role": "member",
        "joined_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.groups.update_one({"group_id": group_id}, {"$inc": {"member_count": 1}})
    
    return {"message": "Joined group successfully"}

@groups_router.post("/{group_id}/leave")
async def leave_group(group_id: str, current_user: dict = Depends(get_current_user)):
    """Leave a group"""
    user_id = current_user["user_id"]
    
    result = await db.group_members.delete_one({"group_id": group_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not a member of this group")
    
    await db.groups.update_one({"group_id": group_id}, {"$inc": {"member_count": -1}})
    
    return {"message": "Left group successfully"}

# ============== PAGES ENDPOINTS ==============

@pages_router.get("/")
async def get_pages(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get pages"""
    user_id = current_user["user_id"]
    
    # Get user's subscriptions
    subs = await db.page_subscriptions.find({"user_id": user_id}).to_list(100)
    subscribed_page_ids = [s["page_id"] for s in subs]
    
    pages = await db.pages.find({}, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    
    for page in pages:
        page["is_subscribed"] = page["page_id"] in subscribed_page_ids
        page["is_admin"] = user_id in page.get("admin_ids", []) or user_id == page["creator_id"]
    
    return pages

@pages_router.post("/")
async def create_page(
    request: CreatePageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new page"""
    user_id = current_user["user_id"]
    
    page = Page(
        name=request.name,
        description=request.description,
        category=request.category,
        cover_image=request.cover_image,
        profile_image=request.profile_image,
        creator_id=user_id,
        admin_ids=[user_id]
    )
    
    page_dict = page.model_dump()
    page_dict["created_at"] = page_dict["created_at"].isoformat()
    await db.pages.insert_one(page_dict.copy())
    
    # Award BL coins
    bl_earned = BL_REWARDS["create_page"]
    await award_bl_coins(user_id, bl_earned, f"Created page: {request.name}")
    
    # Remove _id if present (MongoDB adds it)
    page_dict.pop("_id", None)
    
    return {
        "page": page_dict,
        "bl_coins_earned": bl_earned
    }

@pages_router.post("/{page_id}/subscribe")
async def subscribe_to_page(page_id: str, current_user: dict = Depends(get_current_user)):
    """Subscribe to a page"""
    user_id = current_user["user_id"]
    
    page = await db.pages.find_one({"page_id": page_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Check if already subscribed
    existing = await db.page_subscriptions.find_one({"page_id": page_id, "user_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="Already subscribed")
    
    # Subscribe
    await db.page_subscriptions.insert_one({
        "page_id": page_id,
        "user_id": user_id,
        "subscribed_at": datetime.now(timezone.utc).isoformat()
    })
    
    await db.pages.update_one({"page_id": page_id}, {"$inc": {"subscriber_count": 1}})
    
    # Award BL coins to both subscriber and page owner
    bl_earned = BL_REWARDS["page_subscribe"]
    await award_bl_coins(user_id, bl_earned, f"Subscribed to page: {page['name']}")
    await award_bl_coins(page["creator_id"], bl_earned, f"New subscriber to page: {page['name']}")
    
    return {
        "message": "Subscribed successfully",
        "bl_coins_earned": bl_earned
    }

@pages_router.post("/{page_id}/unsubscribe")
async def unsubscribe_from_page(page_id: str, current_user: dict = Depends(get_current_user)):
    """Unsubscribe from a page"""
    user_id = current_user["user_id"]
    
    result = await db.page_subscriptions.delete_one({"page_id": page_id, "user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not subscribed to this page")
    
    await db.pages.update_one({"page_id": page_id}, {"$inc": {"subscriber_count": -1}})
    
    return {"message": "Unsubscribed successfully"}

# ============== EVENTS ENDPOINTS ==============

@events_router.get("/")
async def get_events(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get upcoming events"""
    user_id = current_user["user_id"]
    now = datetime.now(timezone.utc)
    
    events = await db.events.find(
        {"start_time": {"$gte": now.isoformat()}},
        {"_id": 0}
    ).sort("start_time", 1).skip(skip).limit(limit).to_list(limit)
    
    # Get user's RSVP status for each event
    for event in events:
        rsvp = await db.event_rsvps.find_one({"event_id": event["event_id"], "user_id": user_id})
        event["user_rsvp"] = rsvp["status"] if rsvp else None
    
    return events

@events_router.post("/")
async def create_event(
    request: CreateEventRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new event"""
    user_id = current_user["user_id"]
    
    event = Event(
        name=request.name,
        description=request.description,
        cover_image=request.cover_image,
        creator_id=user_id,
        location=request.location,
        start_time=request.start_time,
        end_time=request.end_time,
        privacy=request.privacy
    )
    
    event_dict = event.model_dump()
    event_dict["created_at"] = event_dict["created_at"].isoformat()
    event_dict["start_time"] = event_dict["start_time"].isoformat()
    if event_dict["end_time"]:
        event_dict["end_time"] = event_dict["end_time"].isoformat()
    await db.events.insert_one(event_dict.copy())
    
    # Award BL coins
    bl_earned = BL_REWARDS["create_event"]
    await award_bl_coins(user_id, bl_earned, f"Created event: {request.name}")
    
    # Remove _id if present (MongoDB adds it)
    event_dict.pop("_id", None)
    
    return {
        "event": event_dict,
        "bl_coins_earned": bl_earned
    }

@events_router.post("/{event_id}/rsvp")
async def rsvp_to_event(
    event_id: str,
    status: str = "going",  # going, interested
    current_user: dict = Depends(get_current_user)
):
    """RSVP to an event"""
    user_id = current_user["user_id"]
    
    event = await db.events.find_one({"event_id": event_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    # Check existing RSVP
    existing = await db.event_rsvps.find_one({"event_id": event_id, "user_id": user_id})
    
    if existing:
        # Update RSVP
        old_status = existing["status"]
        await db.event_rsvps.update_one(
            {"event_id": event_id, "user_id": user_id},
            {"$set": {"status": status}}
        )
        
        # Update counts
        if old_status == "going":
            await db.events.update_one({"event_id": event_id}, {"$inc": {"going_count": -1}})
        elif old_status == "interested":
            await db.events.update_one({"event_id": event_id}, {"$inc": {"interested_count": -1}})
    else:
        # Create new RSVP
        await db.event_rsvps.insert_one({
            "event_id": event_id,
            "user_id": user_id,
            "status": status,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Update new status count
    if status == "going":
        await db.events.update_one({"event_id": event_id}, {"$inc": {"going_count": 1}})
    elif status == "interested":
        await db.events.update_one({"event_id": event_id}, {"$inc": {"interested_count": 1}})
    
    return {"message": f"RSVP updated to {status}"}

# ============== AI MEDIA GENERATION ENDPOINTS ==============

@ai_media_router.post("/estimate-cost")
async def estimate_ai_generation_cost(
    request: AIMediaRequest,
    current_user: dict = Depends(get_current_user)
):
    """Estimate cost in BL coins for AI media generation"""
    base_costs = {
        "image": 200,
        "video": 400,
        "music": 300
    }
    
    base_cost = base_costs.get(request.media_type, 200)
    
    # Adjust for duration (video/music)
    duration_multiplier = 1.0
    if request.duration:
        if request.duration > 10:
            duration_multiplier = 1.5
        elif request.duration > 6:
            duration_multiplier = 1.25
    
    # Adjust for editing vs creating
    edit_multiplier = 0.8 if request.uploaded_media_url else 1.0
    
    estimated_cost = int(base_cost * duration_multiplier * edit_multiplier)
    
    # Get user balance
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"bl_coins": 1})
    balance = user.get("bl_coins", 0) if user else 0
    
    return {
        "estimated_cost": estimated_cost,
        "current_balance": balance,
        "can_afford": balance >= estimated_cost,
        "media_type": request.media_type,
        "duration": request.duration
    }

@ai_media_router.post("/generate")
async def generate_ai_media(
    request: AIMediaRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Generate AI media (image, video, or music)"""
    user_id = current_user["user_id"]
    
    # Estimate cost
    cost_estimate = await estimate_ai_generation_cost(request, current_user)
    cost = cost_estimate["estimated_cost"]
    
    # Check balance
    if not cost_estimate["can_afford"]:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Need more BL coins",
                "required": cost,
                "current_balance": cost_estimate["current_balance"],
                "suggestions": [
                    "Post videos to earn 50 BL coins each",
                    "Post photos to earn 20 BL coins each",
                    "React to posts to earn 10 BL coins each",
                    "Comment on posts to earn 10 BL coins"
                ]
            }
        )
    
    # Deduct coins
    if not await deduct_bl_coins(user_id, cost, f"AI {request.media_type} generation"):
        raise HTTPException(status_code=400, detail="Failed to deduct BL coins")
    
    # Generate media based on type
    try:
        if request.media_type == "image":
            result = await generate_ai_image(request.prompt, request.uploaded_media_url)
        elif request.media_type == "video":
            duration = request.duration or 6
            result = await generate_ai_video(request.prompt, duration)
        elif request.media_type == "music":
            raise HTTPException(status_code=501, detail="Music generation coming soon")
        else:
            raise HTTPException(status_code=400, detail="Invalid media type")
        
        # Save to user's AI generations
        generation_record = {
            "generation_id": f"aigen_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "media_type": request.media_type,
            "prompt": request.prompt,
            "result_url": result.get("url"),
            "result_base64": result.get("base64"),
            "cost": cost,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.ai_generations.insert_one(generation_record)
        
        return {
            "success": True,
            "generation_id": generation_record["generation_id"],
            "media_type": request.media_type,
            "result": result,
            "cost_deducted": cost,
            "disclaimer": "This content is AI-generated and royalty-free for personal use."
        }
        
    except Exception as e:
        # Refund coins on failure
        await award_bl_coins(user_id, cost, f"Refund: AI generation failed")
        logger.error(f"AI generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")

async def generate_ai_image(prompt: str, edit_image_url: Optional[str] = None) -> dict:
    """Generate or edit an image using OpenAI GPT Image"""
    from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    image_gen = OpenAIImageGeneration(api_key=api_key)
    
    # Generate image
    images = await image_gen.generate_images(
        prompt=prompt,
        model="gpt-image-1",
        number_of_images=1
    )
    
    if images and len(images) > 0:
        image_base64 = base64.b64encode(images[0]).decode('utf-8')
        return {
            "base64": image_base64,
            "format": "png"
        }
    else:
        raise HTTPException(status_code=500, detail="No image was generated")

async def generate_ai_video(prompt: str, duration: int = 6) -> dict:
    """Generate a video using Sora 2"""
    from emergentintegrations.llm.openai.video_generation import OpenAIVideoGeneration
    import asyncio
    
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    # Ensure duration is valid (4, 8, or 12 seconds)
    valid_durations = [4, 8, 12]
    duration = min(valid_durations, key=lambda x: abs(x - duration))
    
    # Run synchronous video generation in a thread pool to avoid blocking
    def _generate_video():
        video_gen = OpenAIVideoGeneration(api_key=api_key)
        video_bytes = video_gen.text_to_video(
            prompt=prompt,
            model="sora-2",
            size="1280x720",
            duration=duration,
            max_wait_time=600
        )
        return video_bytes, video_gen
    
    loop = asyncio.get_event_loop()
    video_bytes, video_gen = await loop.run_in_executor(None, _generate_video)
    
    if video_bytes:
        # Save to temp file and return path
        output_path = f"/app/uploads/ai_video_{uuid.uuid4().hex[:12]}.mp4"
        os.makedirs("/app/uploads", exist_ok=True)
        video_gen.save_video(video_bytes, output_path)
        
        video_base64 = base64.b64encode(video_bytes).decode('utf-8')
        return {
            "base64": video_base64,
            "path": output_path,
            "format": "mp4",
            "duration": duration
        }
    else:
        raise HTTPException(status_code=500, detail="Video generation failed")

@ai_media_router.get("/my-generations")
async def get_my_ai_generations(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get user's AI-generated media history"""
    generations = await db.ai_generations.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return generations

# ============== USER PROFILE ENDPOINTS ==============

@social_router.get("/user/{user_id}/posts")
async def get_user_posts(
    user_id: str,
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get posts from a specific user"""
    viewer_id = current_user["user_id"]
    
    # Determine what posts the viewer can see
    if viewer_id == user_id:
        # Own posts - can see all
        query = {"user_id": user_id}
    elif await are_friends(viewer_id, user_id):
        # Friends - can see public and friends-only
        query = {"user_id": user_id, "privacy": {"$in": [PostPrivacy.PUBLIC, PostPrivacy.FRIENDS]}}
    else:
        # Not friends - can only see public
        query = {"user_id": user_id, "privacy": PostPrivacy.PUBLIC}
    
    posts = await db.social_posts.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich posts
    for post in posts:
        post = await enrich_post_with_user(post)
        user_reaction = await db.reactions.find_one({
            "post_id": post["post_id"],
            "user_id": viewer_id
        }, {"_id": 0})
        post["user_reaction"] = user_reaction.get("reaction_type") if user_reaction else None
    
    return posts

@social_router.get("/user/{user_id}/albums")
async def get_user_albums(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get user's albums"""
    viewer_id = current_user["user_id"]
    
    # Determine privacy filter
    if viewer_id == user_id:
        query = {"user_id": user_id}
    elif await are_friends(viewer_id, user_id):
        query = {"user_id": user_id, "privacy": {"$in": [PostPrivacy.PUBLIC, PostPrivacy.FRIENDS]}}
    else:
        query = {"user_id": user_id, "privacy": PostPrivacy.PUBLIC}
    
    albums = await db.albums.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return albums

@social_router.post("/albums")
async def create_album(
    name: str,
    description: str = "",
    media_type: str = "photo",
    privacy: str = PostPrivacy.PUBLIC,
    current_user: dict = Depends(get_current_user)
):
    """Create a new album"""
    album = Album(
        user_id=current_user["user_id"],
        name=name,
        description=description,
        media_type=media_type,
        privacy=privacy
    )
    
    album_dict = album.model_dump()
    album_dict["created_at"] = album_dict["created_at"].isoformat()
    await db.albums.insert_one(album_dict)
    
    return album_dict

# Export routers
def get_social_routers():
    return [social_router, friends_router, stories_router, groups_router, pages_router, events_router, ai_media_router]
