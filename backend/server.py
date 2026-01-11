from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any
import uuid
import base64
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
import bcrypt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config - No fallbacks for security
JWT_SECRET = os.environ.get('JWT_SECRET')
if not JWT_SECRET:
    raise ValueError("JWT_SECRET environment variable is required")
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRY_HOURS = int(os.environ.get('JWT_EXPIRY_HOURS', 168))

# Create the main app
app = FastAPI(title="Blendlink API")

# Create routers
api_router = APIRouter(prefix="/api")
auth_router = APIRouter(prefix="/auth", tags=["Authentication"])
users_router = APIRouter(prefix="/users", tags=["Users"])
posts_router = APIRouter(prefix="/posts", tags=["Posts"])
messages_router = APIRouter(prefix="/messages", tags=["Messages"])
marketplace_router = APIRouter(prefix="/marketplace", tags=["Marketplace"])
rentals_router = APIRouter(prefix="/rentals", tags=["Rentals"])
services_router = APIRouter(prefix="/services", tags=["Services"])
games_router = APIRouter(prefix="/games", tags=["Games"])
raffles_router = APIRouter(prefix="/raffles", tags=["Raffles"])
wallet_router = APIRouter(prefix="/wallet", tags=["Wallet"])
referrals_router = APIRouter(prefix="/referrals", tags=["Referrals"])
upload_router = APIRouter(prefix="/upload", tags=["Upload"])

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============== MODELS ==============
class UserBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:12]}")
    email: str
    name: str
    username: str = ""
    avatar: str = ""
    bio: str = ""
    followers_count: int = 0
    following_count: int = 0
    bl_coins: float = 100.0
    referral_code: str = Field(default_factory=lambda: uuid.uuid4().hex[:8].upper())
    referred_by: Optional[str] = None
    level1_referrals: int = 0
    level2_referrals: int = 0
    # New fields for referral/commission system
    direct_referrals: int = 0
    total_earnings: float = 0.0
    pending_earnings: float = 0.0
    available_balance: float = 0.0
    is_admin: bool = False
    has_violations: bool = False
    last_activity: Optional[datetime] = None
    id_verified: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    username: str
    referral_code: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class PostBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    post_id: str = Field(default_factory=lambda: f"post_{uuid.uuid4().hex[:12]}")
    user_id: str
    content: str
    images: List[str] = []
    likes_count: int = 0
    comments_count: int = 0
    is_story: bool = False
    expires_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class CommentBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    comment_id: str = Field(default_factory=lambda: f"comment_{uuid.uuid4().hex[:12]}")
    post_id: str
    user_id: str
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    message_id: str = Field(default_factory=lambda: f"msg_{uuid.uuid4().hex[:12]}")
    sender_id: str
    receiver_id: str
    content: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ListingBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    listing_id: str = Field(default_factory=lambda: f"listing_{uuid.uuid4().hex[:12]}")
    user_id: str
    title: str
    description: str
    price: float
    category: str
    images: List[str] = []
    condition: str = "new"
    is_digital: bool = False
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PropertyBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    property_id: str = Field(default_factory=lambda: f"prop_{uuid.uuid4().hex[:12]}")
    user_id: str
    title: str
    description: str
    property_type: str
    price: float
    bedrooms: int = 0
    bathrooms: int = 0
    location: str
    images: List[str] = []
    amenities: List[str] = []
    status: str = "available"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ServiceBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    service_id: str = Field(default_factory=lambda: f"svc_{uuid.uuid4().hex[:12]}")
    user_id: str
    title: str
    description: str
    category: str
    hourly_rate: Optional[float] = None
    fixed_price: Optional[float] = None
    location: str
    is_remote: bool = False
    rating: float = 0.0
    reviews_count: int = 0
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RaffleBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    raffle_id: str = Field(default_factory=lambda: f"raffle_{uuid.uuid4().hex[:12]}")
    title: str
    description: str
    prize: str
    entry_cost: float = 10.0
    max_entries: int = 100
    current_entries: int = 0
    end_date: datetime
    winner_id: Optional[str] = None
    status: str = "active"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TransactionBase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    transaction_id: str = Field(default_factory=lambda: f"txn_{uuid.uuid4().hex[:12]}")
    user_id: str
    type: str  # earn, spend, referral, game, raffle
    amount: float
    description: str
    reference_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GameResult(BaseModel):
    model_config = ConfigDict(extra="ignore")
    game_id: str = Field(default_factory=lambda: f"game_{uuid.uuid4().hex[:12]}")
    user_id: str
    game_type: str
    bet_amount: float
    won_amount: float
    result: dict
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== HELPER FUNCTIONS ==============
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password with bcrypt, handling invalid hashes gracefully."""
    if not hashed or not password:
        return False
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except (ValueError, TypeError):
        # Handle invalid salt or hash format
        return False

def create_token(user_id: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    return jwt.encode({"user_id": user_id, "exp": expires}, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
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
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ============== AUTH ROUTES ==============
@auth_router.post("/register")
async def register(data: UserCreate, response: Response):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    existing_username = await db.users.find_one({"username": data.username}, {"_id": 0})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    user = UserBase(
        email=data.email,
        name=data.name,
        username=data.username,
        avatar=f"https://ui-avatars.com/api/?name={data.name.replace(' ', '+')}&background=2563eb&color=fff"
    )
    user_dict = user.model_dump()
    user_dict["password_hash"] = hash_password(data.password)
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    
    has_referrer = False
    
    # Handle referral
    if data.referral_code:
        referrer = await db.users.find_one({"referral_code": data.referral_code}, {"_id": 0})
        if referrer:
            has_referrer = True
            user_dict["referred_by"] = referrer["user_id"]
            # Update referrer's level 1 count and give bonus
            await db.users.update_one(
                {"user_id": referrer["user_id"]},
                {"$inc": {"level1_referrals": 1, "bl_coins": 50, "direct_referrals": 1}}
            )
            # Check for level 2 referrer
            if referrer.get("referred_by"):
                await db.users.update_one(
                    {"user_id": referrer["referred_by"]},
                    {"$inc": {"level2_referrals": 1, "bl_coins": 25}}
                )
            # Record transaction
            txn = TransactionBase(
                user_id=referrer["user_id"],
                type="referral",
                amount=50,
                description=f"Level 1 referral bonus for {data.username}"
            )
            txn_dict = txn.model_dump()
            txn_dict["created_at"] = txn_dict["created_at"].isoformat()
            await db.transactions.insert_one(txn_dict)
            
            # Also create referral relationship record for new commission system
            from referral_system import ReferralRelationship
            relationship = ReferralRelationship(
                referrer_id=referrer["user_id"],
                referred_id=user.user_id,
                level=1
            )
            rel_dict = relationship.model_dump()
            rel_dict["created_at"] = rel_dict["created_at"].isoformat()
            rel_dict["last_activity"] = rel_dict["last_activity"].isoformat()
            await db.referral_relationships.insert_one(rel_dict)
    
    await db.users.insert_one(user_dict.copy())
    
    # If no referrer was provided or found, try to assign from orphan queue
    if not has_referrer:
        try:
            from referral_system import assign_orphan_to_queue
            assigned_to = await assign_orphan_to_queue(user.user_id)
            if assigned_to:
                user_dict["referred_by"] = assigned_to
                await db.users.update_one(
                    {"user_id": user.user_id},
                    {"$set": {"referred_by": assigned_to}}
                )
                logger.info(f"Orphan user {user.user_id} assigned to {assigned_to}")
        except Exception as e:
            logger.error(f"Failed to assign orphan: {e}")
    
    token = create_token(user.user_id)
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=JWT_EXPIRY_HOURS * 3600
    )
    
    return {"user_id": user.user_id, "email": user.email, "name": user.name, "token": token}

@auth_router.post("/login")
async def login(data: UserLogin, response: Response):
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["user_id"])
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=JWT_EXPIRY_HOURS * 3600
    )
    
    user.pop("password_hash", None)
    return {"token": token, "user": user}

class GoogleAuthData(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None
    google_id: Optional[str] = None

# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
@auth_router.post("/google")
async def google_auth(data: GoogleAuthData, response: Response):
    """Handle Google OAuth - create or login user"""
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    
    if existing:
        user_id = existing["user_id"]
        # Update user info from Google
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": data.name,
                "avatar": data.picture or existing.get("avatar"),
                "google_id": data.google_id
            }}
        )
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    else:
        # Create new user
        user = UserBase(
            email=data.email,
            name=data.name,
            username=data.email.split("@")[0] + "_" + str(int(datetime.now(timezone.utc).timestamp()))[-6:],
            avatar=data.picture or f"https://ui-avatars.com/api/?name={data.name.replace(' ', '+')}&background=2563eb&color=fff"
        )
        user_dict = user.model_dump()
        user_dict["created_at"] = user_dict["created_at"].isoformat()
        user_dict["google_id"] = data.google_id
        user_dict["password_hash"] = ""  # No password for Google users
        await db.users.insert_one(user_dict)
        user_id = user.user_id
        
        # Create welcome transaction
        welcome_tx = {
            "transaction_id": f"tx_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "type": "welcome",
            "amount": 50000,
            "description": "Welcome bonus!",
            "balance_after": 50000,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.transactions.insert_one(welcome_tx)
        
        # Try to assign from orphan queue since no referral code
        try:
            from referral_system import assign_orphan_to_queue
            assigned_to = await assign_orphan_to_queue(user_id)
            if assigned_to:
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {"referred_by": assigned_to}}
                )
                logger.info(f"Google orphan user {user_id} assigned to {assigned_to}")
        except Exception as e:
            logger.error(f"Failed to assign Google orphan: {e}")
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    
    token = create_token(user_id)
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=JWT_EXPIRY_HOURS * 3600
    )
    
    return {"token": token, "user": user}

# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
@auth_router.post("/google-session")
async def google_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    async with httpx.AsyncClient() as client_http:
        resp = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        google_data = resp.json()
    
    existing = await db.users.find_one({"email": google_data["email"]}, {"_id": 0})
    
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": google_data["name"], "avatar": google_data.get("picture", existing.get("avatar"))}}
        )
    else:
        user = UserBase(
            email=google_data["email"],
            name=google_data["name"],
            username=google_data["email"].split("@")[0],
            avatar=google_data.get("picture", "")
        )
        user_dict = user.model_dump()
        user_dict["created_at"] = user_dict["created_at"].isoformat()
        await db.users.insert_one(user_dict)
        user_id = user.user_id
        
        # Try to assign from orphan queue since no referral code
        try:
            from referral_system import assign_orphan_to_queue
            assigned_to = await assign_orphan_to_queue(user_id)
            if assigned_to:
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {"referred_by": assigned_to}}
                )
                logger.info(f"Google-session orphan user {user_id} assigned to {assigned_to}")
        except Exception as e:
            logger.error(f"Failed to assign google-session orphan: {e}")
    
    token = create_token(user_id)
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=JWT_EXPIRY_HOURS * 3600
    )
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    return {"token": token, "user": user}

@auth_router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    user.pop("password_hash", None)
    return user

@auth_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("session_token", path="/")
    return {"message": "Logged out"}

# ============== USER ROUTES ==============
@users_router.get("/{user_id}")
async def get_user(user_id: str):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@users_router.get("/{user_id}/posts")
async def get_user_posts(user_id: str, skip: int = 0, limit: int = 20):
    posts = await db.posts.find(
        {"user_id": user_id, "is_story": False},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return posts

@users_router.post("/{user_id}/follow")
async def follow_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    existing = await db.follows.find_one({
        "follower_id": current_user["user_id"],
        "following_id": user_id
    }, {"_id": 0})
    
    if existing:
        await db.follows.delete_one({
            "follower_id": current_user["user_id"],
            "following_id": user_id
        })
        await db.users.update_one({"user_id": current_user["user_id"]}, {"$inc": {"following_count": -1}})
        await db.users.update_one({"user_id": user_id}, {"$inc": {"followers_count": -1}})
        return {"following": False}
    else:
        await db.follows.insert_one({
            "follower_id": current_user["user_id"],
            "following_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.users.update_one({"user_id": current_user["user_id"]}, {"$inc": {"following_count": 1}})
        await db.users.update_one({"user_id": user_id}, {"$inc": {"followers_count": 1}})
        return {"following": True}

@users_router.get("/{user_id}/following")
async def get_following(user_id: str):
    follows = await db.follows.find({"follower_id": user_id}, {"_id": 0}).to_list(1000)
    following_ids = [f["following_id"] for f in follows]
    return following_ids

# ============== POST ROUTES ==============
@posts_router.get("/feed")
async def get_feed(skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    following = await db.follows.find({"follower_id": current_user["user_id"]}, {"_id": 0}).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    following_ids.append(current_user["user_id"])
    
    posts = await db.posts.find(
        {"user_id": {"$in": following_ids}, "is_story": False},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Batch fetch user data and likes to avoid N+1 queries
    if posts:
        user_ids = list(set(post["user_id"] for post in posts))
        users = await db.users.find(
            {"user_id": {"$in": user_ids}}, 
            {"_id": 0, "password_hash": 0}
        ).to_list(len(user_ids))
        users_map = {u["user_id"]: u for u in users}
        
        post_ids = [post["post_id"] for post in posts]
        likes = await db.likes.find({
            "post_id": {"$in": post_ids},
            "user_id": current_user["user_id"]
        }, {"_id": 0}).to_list(len(post_ids))
        liked_posts = {like["post_id"] for like in likes}
        
        for post in posts:
            post["user"] = users_map.get(post["user_id"])
            post["liked"] = post["post_id"] in liked_posts
    
    return posts

@posts_router.get("/explore")
async def explore_posts(skip: int = 0, limit: int = 20):
    posts = await db.posts.find(
        {"is_story": False},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Batch fetch user data to avoid N+1 queries
    if posts:
        user_ids = list(set(post["user_id"] for post in posts))
        users = await db.users.find(
            {"user_id": {"$in": user_ids}}, 
            {"_id": 0, "password_hash": 0}
        ).to_list(len(user_ids))
        users_map = {u["user_id"]: u for u in users}
        
        for post in posts:
            post["user"] = users_map.get(post["user_id"])
    
    return posts

@posts_router.get("/stories")
async def get_stories(current_user: dict = Depends(get_current_user)):
    following = await db.follows.find({"follower_id": current_user["user_id"]}, {"_id": 0}).to_list(1000)
    following_ids = [f["following_id"] for f in following]
    following_ids.append(current_user["user_id"])
    
    now = datetime.now(timezone.utc)
    stories = await db.posts.find(
        {
            "user_id": {"$in": following_ids},
            "is_story": True,
            "expires_at": {"$gt": now.isoformat()}
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Batch fetch user data to avoid N+1 queries
    if stories:
        user_ids = list(set(story["user_id"] for story in stories))
        users = await db.users.find(
            {"user_id": {"$in": user_ids}}, 
            {"_id": 0, "password_hash": 0}
        ).to_list(len(user_ids))
        users_map = {u["user_id"]: u for u in users}
        
        for story in stories:
            story["user"] = users_map.get(story["user_id"])
    
    return stories

class CreatePost(BaseModel):
    content: str
    images: List[str] = []
    is_story: bool = False

@posts_router.post("")
async def create_post(data: CreatePost, current_user: dict = Depends(get_current_user)):
    post = PostBase(
        user_id=current_user["user_id"],
        content=data.content,
        images=data.images,
        is_story=data.is_story,
        expires_at=(datetime.now(timezone.utc) + timedelta(hours=24)) if data.is_story else None
    )
    post_dict = post.model_dump()
    post_dict["created_at"] = post_dict["created_at"].isoformat()
    if post_dict["expires_at"]:
        post_dict["expires_at"] = post_dict["expires_at"].isoformat()
    
    await db.posts.insert_one(post_dict.copy())
    
    # Daily login reward
    today = datetime.now(timezone.utc).date().isoformat()
    daily_reward = await db.daily_rewards.find_one({
        "user_id": current_user["user_id"],
        "date": today
    }, {"_id": 0})
    
    if not daily_reward:
        await db.users.update_one({"user_id": current_user["user_id"]}, {"$inc": {"bl_coins": 5}})
        await db.daily_rewards.insert_one({
            "user_id": current_user["user_id"],
            "date": today,
            "amount": 5
        })
        txn = TransactionBase(
            user_id=current_user["user_id"],
            type="earn",
            amount=5,
            description="Daily activity reward"
        )
        txn_dict = txn.model_dump()
        txn_dict["created_at"] = txn_dict["created_at"].isoformat()
        await db.transactions.insert_one(txn_dict)
    
    return post_dict

@posts_router.post("/{post_id}/like")
async def like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    existing = await db.likes.find_one({
        "post_id": post_id,
        "user_id": current_user["user_id"]
    }, {"_id": 0})
    
    if existing:
        await db.likes.delete_one({"post_id": post_id, "user_id": current_user["user_id"]})
        await db.posts.update_one({"post_id": post_id}, {"$inc": {"likes_count": -1}})
        return {"liked": False}
    else:
        await db.likes.insert_one({
            "post_id": post_id,
            "user_id": current_user["user_id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.posts.update_one({"post_id": post_id}, {"$inc": {"likes_count": 1}})
        return {"liked": True}

@posts_router.get("/{post_id}/comments")
async def get_comments(post_id: str):
    comments = await db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Batch fetch all users to avoid N+1 queries
    if comments:
        user_ids = list(set(c["user_id"] for c in comments))
        users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(len(user_ids))
        users_map = {u["user_id"]: u for u in users}
        for comment in comments:
            comment["user"] = users_map.get(comment["user_id"])
    
    return comments

class CreateComment(BaseModel):
    content: str

@posts_router.post("/{post_id}/comments")
async def create_comment(post_id: str, data: CreateComment, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment = CommentBase(
        post_id=post_id,
        user_id=current_user["user_id"],
        content=data.content
    )
    comment_dict = comment.model_dump()
    comment_dict["created_at"] = comment_dict["created_at"].isoformat()
    
    await db.comments.insert_one(comment_dict)
    await db.posts.update_one({"post_id": post_id}, {"$inc": {"comments_count": 1}})
    
    return comment_dict

# ============== MESSAGE ROUTES ==============
@messages_router.get("/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    pipeline = [
        {"$match": {"$or": [
            {"sender_id": current_user["user_id"]},
            {"receiver_id": current_user["user_id"]}
        ]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {"$cond": [
                {"$eq": ["$sender_id", current_user["user_id"]]},
                "$receiver_id",
                "$sender_id"
            ]},
            "last_message": {"$first": "$$ROOT"},
            "unread_count": {"$sum": {"$cond": [
                {"$and": [
                    {"$eq": ["$receiver_id", current_user["user_id"]]},
                    {"$eq": ["$read", False]}
                ]},
                1, 0
            ]}}
        }},
        {"$project": {"_id": 0, "user_id": "$_id", "last_message": 1, "unread_count": 1}}
    ]
    
    conversations = await db.messages.aggregate(pipeline).to_list(100)
    
    # Batch fetch all users to avoid N+1 queries
    if conversations:
        user_ids = [conv["user_id"] for conv in conversations]
        users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(len(user_ids))
        users_map = {u["user_id"]: u for u in users}
        for conv in conversations:
            conv["user"] = users_map.get(conv["user_id"])
            conv["last_message"].pop("_id", None)
    
    return conversations

@messages_router.get("/{user_id}")
async def get_messages(user_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({
        "$or": [
            {"sender_id": current_user["user_id"], "receiver_id": user_id},
            {"sender_id": user_id, "receiver_id": current_user["user_id"]}
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(100)
    
    # Mark as read
    await db.messages.update_many(
        {"sender_id": user_id, "receiver_id": current_user["user_id"], "read": False},
        {"$set": {"read": True}}
    )
    
    return messages

class SendMessage(BaseModel):
    content: str
    media_url: Optional[str] = None
    media_type: Optional[str] = None

@messages_router.post("/{user_id}")
async def send_message(user_id: str, data: SendMessage, current_user: dict = Depends(get_current_user)):
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    message = MessageBase(
        sender_id=current_user["user_id"],
        receiver_id=user_id,
        content=data.content,
        media_url=data.media_url,
        media_type=data.media_type
    )
    msg_dict = message.model_dump()
    msg_dict["created_at"] = msg_dict["created_at"].isoformat()
    
    await db.messages.insert_one(msg_dict)
    return msg_dict

@messages_router.get("/{user_id}/typing")
async def get_typing_status(user_id: str, current_user: dict = Depends(get_current_user)):
    typing = await db.typing_status.find_one({
        "user_id": user_id,
        "to_user_id": current_user["user_id"]
    }, {"_id": 0})
    return {"typing": typing is not None}

@messages_router.post("/{user_id}/typing")
async def set_typing_status(user_id: str, current_user: dict = Depends(get_current_user)):
    await db.typing_status.update_one(
        {"user_id": current_user["user_id"], "to_user_id": user_id},
        {"$set": {"timestamp": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    return {"status": "ok"}

@messages_router.delete("/{user_id}/typing")
async def clear_typing_status(user_id: str, current_user: dict = Depends(get_current_user)):
    await db.typing_status.delete_one({"user_id": current_user["user_id"], "to_user_id": user_id})
    return {"status": "ok"}

# ============== MARKETPLACE ROUTES ==============
@marketplace_router.get("/listings")
async def get_listings(category: Optional[str] = None, search: Optional[str] = None, skip: int = 0, limit: int = 20):
    query = {"status": "active"}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    listings = await db.listings.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Batch fetch all users to avoid N+1 queries
    if listings:
        user_ids = list(set(listing["user_id"] for listing in listings))
        users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(len(user_ids))
        users_map = {u["user_id"]: u for u in users}
        for listing in listings:
            listing["seller"] = users_map.get(listing["user_id"])
    
    return listings

@marketplace_router.get("/listings/{listing_id}")
async def get_listing(listing_id: str):
    listing = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    user = await db.users.find_one({"user_id": listing["user_id"]}, {"_id": 0, "password_hash": 0})
    listing["seller"] = user
    return listing

class CreateListing(BaseModel):
    title: str
    description: str
    price: float
    category: str
    images: List[str] = []
    condition: str = "new"
    is_digital: bool = False

@marketplace_router.post("/listings")
async def create_listing(data: CreateListing, current_user: dict = Depends(get_current_user)):
    listing = ListingBase(
        user_id=current_user["user_id"],
        title=data.title,
        description=data.description,
        price=data.price,
        category=data.category,
        images=data.images,
        condition=data.condition,
        is_digital=data.is_digital
    )
    listing_dict = listing.model_dump()
    listing_dict["created_at"] = listing_dict["created_at"].isoformat()
    
    await db.listings.insert_one(listing_dict.copy())
    return listing_dict

@marketplace_router.get("/categories")
async def get_categories():
    return [
        {"id": "electronics", "name": "Electronics", "icon": "Smartphone"},
        {"id": "fashion", "name": "Fashion", "icon": "Shirt"},
        {"id": "home", "name": "Home & Garden", "icon": "Home"},
        {"id": "vehicles", "name": "Vehicles", "icon": "Car"},
        {"id": "sports", "name": "Sports", "icon": "Dumbbell"},
        {"id": "digital", "name": "Digital Goods", "icon": "Download"},
        {"id": "services", "name": "Services", "icon": "Wrench"},
        {"id": "other", "name": "Other", "icon": "Package"}
    ]

class GuestCheckoutRequest(BaseModel):
    items: List[dict]
    customer: dict
    total: float

@marketplace_router.post("/guest-checkout")
async def guest_checkout(data: GuestCheckoutRequest):
    """Process a guest checkout without requiring login"""
    # Validate customer info
    if not data.customer.get("name") or not data.customer.get("email"):
        raise HTTPException(status_code=400, detail="Name and email are required")
    
    # Create guest order
    order_id = f"order_{uuid.uuid4().hex[:12]}"
    
    order = {
        "order_id": order_id,
        "customer_email": data.customer.get("email"),
        "customer_name": data.customer.get("name"),
        "customer_phone": data.customer.get("phone"),
        "shipping_address": {
            "address": data.customer.get("address"),
            "city": data.customer.get("city"),
            "zip_code": data.customer.get("zipCode"),
            "country": data.customer.get("country", "US")
        },
        "items": data.items,
        "total": data.total,
        "status": "pending",
        "is_guest_order": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.guest_orders.insert_one(order.copy())
    
    # Try to create Stripe checkout session
    try:
        import stripe
        stripe.api_key = os.environ.get("STRIPE_API_KEY")
        
        if stripe.api_key:
            line_items = [
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": item.get("title", "Item"),
                            "description": f"{item.get('type', 'product').title()}"
                        },
                        "unit_amount": int(item.get("price", 0) * 100),
                    },
                    "quantity": item.get("quantity", 1)
                }
                for item in data.items
            ]
            
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=line_items,
                mode="payment",
                customer_email=data.customer.get("email"),
                success_url=f"{os.environ.get('FRONTEND_URL')}/payment/success?order_id={order_id}",
                cancel_url=f"{os.environ.get('FRONTEND_URL')}/payment/cancel?order_id={order_id}",
                metadata={"order_id": order_id, "is_guest": "true"}
            )
            
            return {
                "order_id": order_id,
                "payment_url": checkout_session.url,
                "message": "Redirecting to payment"
            }
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
    
    # Fallback: return success without payment
    return {
        "order_id": order_id,
        "message": "Order placed successfully. Payment will be processed offline.",
        "status": "pending_payment"
    }

# ============== RENTALS ROUTES ==============
@rentals_router.get("/properties")
async def get_properties(
    property_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    bedrooms: Optional[int] = None,
    location: Optional[str] = None,
    skip: int = 0,
    limit: int = 20
):
    query = {"status": "available"}
    if property_type:
        query["property_type"] = property_type
    if min_price:
        query["price"] = {"$gte": min_price}
    if max_price:
        query.setdefault("price", {})["$lte"] = max_price
    if bedrooms:
        query["bedrooms"] = {"$gte": bedrooms}
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    
    properties = await db.properties.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Batch fetch users to avoid N+1 query problem
    user_ids = list(set(prop["user_id"] for prop in properties if prop.get("user_id")))
    if user_ids:
        users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(len(user_ids))
        user_map = {u["user_id"]: u for u in users}
        for prop in properties:
            prop["owner"] = user_map.get(prop.get("user_id"))
    
    return properties

@rentals_router.get("/properties/{property_id}")
async def get_property(property_id: str):
    prop = await db.properties.find_one({"property_id": property_id}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    
    user = await db.users.find_one({"user_id": prop["user_id"]}, {"_id": 0, "password_hash": 0})
    prop["owner"] = user
    return prop

class CreateProperty(BaseModel):
    title: str
    description: str
    property_type: str
    price: float
    bedrooms: int = 0
    bathrooms: int = 0
    location: str
    images: List[str] = []
    amenities: List[str] = []

@rentals_router.post("/properties")
async def create_property(data: CreateProperty, current_user: dict = Depends(get_current_user)):
    prop = PropertyBase(
        user_id=current_user["user_id"],
        **data.model_dump()
    )
    prop_dict = prop.model_dump()
    prop_dict["created_at"] = prop_dict["created_at"].isoformat()
    
    await db.properties.insert_one(prop_dict.copy())
    return prop_dict

# ============== SERVICES ROUTES ==============
@services_router.get("")
async def get_services(
    category: Optional[str] = None,
    is_remote: Optional[bool] = None,
    location: Optional[str] = None,
    skip: int = 0,
    limit: int = 20
):
    query = {"status": "active"}
    if category:
        query["category"] = category
    if is_remote is not None:
        query["is_remote"] = is_remote
    if location:
        query["location"] = {"$regex": location, "$options": "i"}
    
    services = await db.services.find(query, {"_id": 0}).sort("rating", -1).skip(skip).limit(limit).to_list(limit)
    
    # Batch fetch users to avoid N+1 query problem
    user_ids = list(set(svc["user_id"] for svc in services if svc.get("user_id")))
    if user_ids:
        users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(len(user_ids))
        user_map = {u["user_id"]: u for u in users}
        for svc in services:
            svc["provider"] = user_map.get(svc.get("user_id"))
    
    return services

@services_router.get("/{service_id}")
async def get_service(service_id: str):
    svc = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    
    user = await db.users.find_one({"user_id": svc["user_id"]}, {"_id": 0, "password_hash": 0})
    svc["provider"] = user
    return svc

class CreateService(BaseModel):
    title: str
    description: str
    category: str
    hourly_rate: Optional[float] = None
    fixed_price: Optional[float] = None
    location: str
    is_remote: bool = False

@services_router.post("")
async def create_service(data: CreateService, current_user: dict = Depends(get_current_user)):
    svc = ServiceBase(
        user_id=current_user["user_id"],
        **data.model_dump()
    )
    svc_dict = svc.model_dump()
    svc_dict["created_at"] = svc_dict["created_at"].isoformat()
    
    await db.services.insert_one(svc_dict.copy())
    return svc_dict

@services_router.get("/categories/list")
async def get_service_categories():
    return [
        {"id": "healthcare", "name": "Healthcare", "icon": "Heart"},
        {"id": "home-services", "name": "Home Services", "icon": "Home"},
        {"id": "education", "name": "Education & Tutoring", "icon": "GraduationCap"},
        {"id": "tech", "name": "Tech & IT", "icon": "Laptop"},
        {"id": "beauty", "name": "Beauty & Wellness", "icon": "Sparkles"},
        {"id": "transport", "name": "Transportation", "icon": "Car"},
        {"id": "legal", "name": "Legal Services", "icon": "Scale"},
        {"id": "creative", "name": "Creative Services", "icon": "Palette"}
    ]

# ============== GAMES ROUTES ==============
import random

@games_router.post("/spin-wheel")
async def play_spin_wheel(current_user: dict = Depends(get_current_user)):
    bet = 5
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if user["bl_coins"] < bet:
        raise HTTPException(status_code=400, detail="Insufficient BL Coins")
    
    # Deduct bet
    await db.users.update_one({"user_id": current_user["user_id"]}, {"$inc": {"bl_coins": -bet}})
    
    # Spin wheel - weighted outcomes
    outcomes = [
        {"label": "0", "multiplier": 0, "weight": 30},
        {"label": "1x", "multiplier": 1, "weight": 25},
        {"label": "2x", "multiplier": 2, "weight": 20},
        {"label": "3x", "multiplier": 3, "weight": 15},
        {"label": "5x", "multiplier": 5, "weight": 7},
        {"label": "10x", "multiplier": 10, "weight": 3}
    ]
    
    total_weight = sum(o["weight"] for o in outcomes)
    rand = random.randint(1, total_weight)
    cumulative = 0
    result = outcomes[0]
    for outcome in outcomes:
        cumulative += outcome["weight"]
        if rand <= cumulative:
            result = outcome
            break
    
    winnings = bet * result["multiplier"]
    if winnings > 0:
        await db.users.update_one({"user_id": current_user["user_id"]}, {"$inc": {"bl_coins": winnings}})
    
    # Record game
    game = GameResult(
        user_id=current_user["user_id"],
        game_type="spin_wheel",
        bet_amount=bet,
        won_amount=winnings,
        result=result
    )
    game_dict = game.model_dump()
    game_dict["created_at"] = game_dict["created_at"].isoformat()
    await db.games.insert_one(game_dict)
    
    # Record transaction
    if winnings > 0:
        txn = TransactionBase(
            user_id=current_user["user_id"],
            type="game",
            amount=winnings - bet,
            description=f"Spin wheel win: {result['label']}"
        )
    else:
        txn = TransactionBase(
            user_id=current_user["user_id"],
            type="game",
            amount=-bet,
            description="Spin wheel loss"
        )
    txn_dict = txn.model_dump()
    txn_dict["created_at"] = txn_dict["created_at"].isoformat()
    await db.transactions.insert_one(txn_dict)
    
    updated_user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    
    return {
        "result": result,
        "bet": bet,
        "winnings": winnings,
        "new_balance": updated_user["bl_coins"]
    }

@games_router.post("/scratch-card")
async def play_scratch_card(current_user: dict = Depends(get_current_user)):
    bet = 10
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if user["bl_coins"] < bet:
        raise HTTPException(status_code=400, detail="Insufficient BL Coins")
    
    await db.users.update_one({"user_id": current_user["user_id"]}, {"$inc": {"bl_coins": -bet}})
    
    # Generate scratch card
    symbols = ["coin", "star", "diamond", "seven", "cherry", "bell"]
    card = [[random.choice(symbols) for _ in range(3)] for _ in range(3)]
    
    # Check for wins
    winnings = 0
    winning_lines = []
    
    # Check rows
    for i, row in enumerate(card):
        if row[0] == row[1] == row[2]:
            if row[0] == "diamond":
                winnings += bet * 10
            elif row[0] == "seven":
                winnings += bet * 5
            else:
                winnings += bet * 2
            winning_lines.append(f"row_{i}")
    
    # Check diagonals
    if card[0][0] == card[1][1] == card[2][2]:
        winnings += bet * 3
        winning_lines.append("diagonal_1")
    if card[0][2] == card[1][1] == card[2][0]:
        winnings += bet * 3
        winning_lines.append("diagonal_2")
    
    if winnings > 0:
        await db.users.update_one({"user_id": current_user["user_id"]}, {"$inc": {"bl_coins": winnings}})
    
    game = GameResult(
        user_id=current_user["user_id"],
        game_type="scratch_card",
        bet_amount=bet,
        won_amount=winnings,
        result={"card": card, "winning_lines": winning_lines}
    )
    game_dict = game.model_dump()
    game_dict["created_at"] = game_dict["created_at"].isoformat()
    await db.games.insert_one(game_dict)
    
    txn = TransactionBase(
        user_id=current_user["user_id"],
        type="game",
        amount=winnings - bet if winnings > 0 else -bet,
        description=f"Scratch card {'win' if winnings > 0 else 'loss'}"
    )
    txn_dict = txn.model_dump()
    txn_dict["created_at"] = txn_dict["created_at"].isoformat()
    await db.transactions.insert_one(txn_dict)
    
    updated_user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    
    return {
        "card": card,
        "winning_lines": winning_lines,
        "bet": bet,
        "winnings": winnings,
        "new_balance": updated_user["bl_coins"]
    }

class MemoryGameResult(BaseModel):
    moves: int
    time_seconds: int

@games_router.post("/memory-match")
async def complete_memory_game(data: MemoryGameResult, current_user: dict = Depends(get_current_user)):
    # Reward based on performance
    base_reward = 5
    if data.moves <= 12:
        bonus = 10
    elif data.moves <= 16:
        bonus = 5
    else:
        bonus = 0
    
    if data.time_seconds <= 30:
        bonus += 5
    elif data.time_seconds <= 60:
        bonus += 2
    
    total_reward = base_reward + bonus
    
    await db.users.update_one({"user_id": current_user["user_id"]}, {"$inc": {"bl_coins": total_reward}})
    
    game = GameResult(
        user_id=current_user["user_id"],
        game_type="memory_match",
        bet_amount=0,
        won_amount=total_reward,
        result={"moves": data.moves, "time_seconds": data.time_seconds}
    )
    game_dict = game.model_dump()
    game_dict["created_at"] = game_dict["created_at"].isoformat()
    await db.games.insert_one(game_dict)
    
    txn = TransactionBase(
        user_id=current_user["user_id"],
        type="game",
        amount=total_reward,
        description=f"Memory match completed in {data.moves} moves"
    )
    txn_dict = txn.model_dump()
    txn_dict["created_at"] = txn_dict["created_at"].isoformat()
    await db.transactions.insert_one(txn_dict)
    
    updated_user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    
    return {
        "reward": total_reward,
        "moves": data.moves,
        "time_seconds": data.time_seconds,
        "new_balance": updated_user["bl_coins"]
    }

# ============== RAFFLES ROUTES ==============
@raffles_router.get("")
async def get_raffles(status: Optional[str] = "active"):
    query = {}
    if status:
        query["status"] = status
    
    raffles = await db.raffles.find(query, {"_id": 0}).sort("end_date", 1).to_list(50)
    return raffles

@raffles_router.get("/{raffle_id}")
async def get_raffle(raffle_id: str):
    raffle = await db.raffles.find_one({"raffle_id": raffle_id}, {"_id": 0})
    if not raffle:
        raise HTTPException(status_code=404, detail="Raffle not found")
    return raffle

@raffles_router.post("/{raffle_id}/enter")
async def enter_raffle(raffle_id: str, current_user: dict = Depends(get_current_user)):
    raffle = await db.raffles.find_one({"raffle_id": raffle_id}, {"_id": 0})
    if not raffle:
        raise HTTPException(status_code=404, detail="Raffle not found")
    
    if raffle["status"] != "active":
        raise HTTPException(status_code=400, detail="Raffle is not active")
    
    if raffle["current_entries"] >= raffle["max_entries"]:
        raise HTTPException(status_code=400, detail="Raffle is full")
    
    existing = await db.raffle_entries.find_one({
        "raffle_id": raffle_id,
        "user_id": current_user["user_id"]
    }, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Already entered this raffle")
    
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    if user["bl_coins"] < raffle["entry_cost"]:
        raise HTTPException(status_code=400, detail="Insufficient BL Coins")
    
    await db.users.update_one({"user_id": current_user["user_id"]}, {"$inc": {"bl_coins": -raffle["entry_cost"]}})
    await db.raffles.update_one({"raffle_id": raffle_id}, {"$inc": {"current_entries": 1}})
    
    await db.raffle_entries.insert_one({
        "raffle_id": raffle_id,
        "user_id": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    txn = TransactionBase(
        user_id=current_user["user_id"],
        type="raffle",
        amount=-raffle["entry_cost"],
        description=f"Entered raffle: {raffle['title']}",
        reference_id=raffle_id
    )
    txn_dict = txn.model_dump()
    txn_dict["created_at"] = txn_dict["created_at"].isoformat()
    await db.transactions.insert_one(txn_dict)
    
    updated_user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    
    return {"success": True, "new_balance": updated_user["bl_coins"]}

# ============== WALLET ROUTES ==============
@wallet_router.get("/balance")
async def get_balance(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    return {"balance": user["bl_coins"], "bl_coins": user["bl_coins"]}

@wallet_router.post("/claim-daily")
async def claim_daily(current_user: dict = Depends(get_current_user)):
    """Claim daily login reward"""
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    # Check if already claimed today
    last_claim = user.get("last_daily_claim")
    today = datetime.now(timezone.utc).date()
    
    if last_claim:
        last_claim_date = datetime.fromisoformat(last_claim.replace("Z", "+00:00")).date() if isinstance(last_claim, str) else last_claim.date()
        if last_claim_date == today:
            raise HTTPException(status_code=400, detail="Daily reward already claimed today")
    
    # Award daily bonus
    daily_bonus = 10000
    new_balance = user["bl_coins"] + daily_bonus
    
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {
            "bl_coins": new_balance,
            "last_daily_claim": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Create transaction record
    transaction = {
        "transaction_id": f"tx_{uuid.uuid4().hex[:12]}",
        "user_id": current_user["user_id"],
        "type": "daily_claim",
        "amount": daily_bonus,
        "description": "Daily login reward",
        "balance_after": new_balance,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.transactions.insert_one(transaction)
    
    return {
        "success": True,
        "amount": daily_bonus,
        "new_balance": new_balance,
        "message": f"Claimed {daily_bonus} BL Coins!"
    }

@wallet_router.get("/transactions")
async def get_transactions(skip: int = 0, limit: int = 50, current_user: dict = Depends(get_current_user)):
    transactions = await db.transactions.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return transactions

@wallet_router.get("/stats")
async def get_wallet_stats(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    
    # Calculate earnings from different sources
    pipeline = [
        {"$match": {"user_id": current_user["user_id"]}},
        {"$group": {
            "_id": "$type",
            "total": {"$sum": "$amount"}
        }}
    ]
    
    stats = await db.transactions.aggregate(pipeline).to_list(10)
    stats_dict = {s["_id"]: s["total"] for s in stats}
    
    return {
        "balance": user["bl_coins"],
        "earnings": {
            "referrals": stats_dict.get("referral", 0),
            "games": stats_dict.get("game", 0),
            "daily": stats_dict.get("earn", 0)
        },
        "spent": {
            "raffles": abs(stats_dict.get("raffle", 0)),
            "games_bet": abs(min(0, stats_dict.get("game", 0)))
        }
    }

# ============== REFERRALS ROUTES ==============
@referrals_router.get("/stats")
async def get_referral_stats(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0})
    
    level1 = await db.users.find({"referred_by": current_user["user_id"]}, {"_id": 0, "password_hash": 0}).to_list(100)
    level1_ids = [u["user_id"] for u in level1]
    
    level2 = await db.users.find({"referred_by": {"$in": level1_ids}}, {"_id": 0, "password_hash": 0}).to_list(100)
    
    referral_earnings = await db.transactions.find({
        "user_id": current_user["user_id"],
        "type": "referral"
    }, {"_id": 0}).to_list(100)
    
    total_earned = sum(t["amount"] for t in referral_earnings)
    
    return {
        "referral_code": user["referral_code"],
        "level1_count": len(level1),
        "level2_count": len(level2),
        "level1_referrals": level1[:10],
        "level2_referrals": level2[:10],
        "total_earned": total_earned
    }

# ============== FILE UPLOAD ROUTES ==============
# Ensure uploads directory exists
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@upload_router.post("/file")
async def upload_file(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a single file (image, video, audio)"""
    # Validate file type
    allowed_types = {
        "image": ["image/jpeg", "image/png", "image/gif", "image/webp"],
        "video": ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
        "audio": ["audio/mpeg", "audio/wav", "audio/ogg", "audio/mp3"]
    }
    
    content_type = file.content_type or ""
    media_type = None
    for mtype, types in allowed_types.items():
        if content_type in types:
            media_type = mtype
            break
    
    if not media_type:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {content_type}")
    
    # Read file content
    content = await file.read()
    
    # Check file size (max 50MB)
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB.")
    
    # Generate unique filename
    ext = Path(file.filename or "file").suffix or ".bin"
    unique_id = uuid.uuid4().hex[:12]
    filename = f"{media_type}_{unique_id}{ext}"
    file_path = UPLOAD_DIR / filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Generate data URL for immediate use
    data_url = f"data:{content_type};base64,{base64.b64encode(content).decode('utf-8')}"
    
    # Store in database for tracking
    upload_record = {
        "upload_id": f"upload_{unique_id}",
        "user_id": current_user["user_id"],
        "filename": filename,
        "original_filename": file.filename,
        "content_type": content_type,
        "media_type": media_type,
        "size": len(content),
        "file_path": str(file_path),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.uploads.insert_one(upload_record)
    
    return {
        "upload_id": upload_record["upload_id"],
        "filename": filename,
        "media_type": media_type,
        "content_type": content_type,
        "size": len(content),
        "data_url": data_url,
        "file_url": f"/api/upload/files/{filename}"
    }

@upload_router.post("/files")
async def upload_multiple_files(
    files: List[UploadFile] = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload multiple files at once"""
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 files allowed per upload")
    
    results = []
    for file in files:
        try:
            result = await upload_file(file, current_user)
            results.append(result)
        except HTTPException as e:
            results.append({"error": e.detail, "filename": file.filename})
    
    return {"uploads": results}

@upload_router.get("/files/{filename}")
async def get_uploaded_file(filename: str):
    """Serve uploaded files"""
    from fastapi.responses import FileResponse
    
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)

@upload_router.get("/files/thumbnails/{filename}")
async def get_thumbnail_file(filename: str):
    """Serve thumbnail files"""
    from fastapi.responses import FileResponse
    
    thumb_dir = UPLOAD_DIR / "thumbnails"
    thumb_dir.mkdir(exist_ok=True)
    file_path = thumb_dir / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    
    return FileResponse(file_path)

# ============== ROOT ROUTES ==============
@api_router.get("/")
async def root():
    return {"message": "Blendlink API v1.0", "status": "healthy"}

@api_router.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include all routers
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(posts_router)
api_router.include_router(messages_router)
api_router.include_router(marketplace_router)
api_router.include_router(rentals_router)
api_router.include_router(services_router)
api_router.include_router(games_router)
api_router.include_router(raffles_router)
api_router.include_router(wallet_router)
api_router.include_router(referrals_router)
api_router.include_router(upload_router)

# Import and include media sales routers
from media_sales import watermark_router, media_router, offers_router, contracts_router, payments_router
api_router.include_router(watermark_router)
api_router.include_router(media_router)
api_router.include_router(offers_router)
api_router.include_router(contracts_router)
api_router.include_router(payments_router)

# Import and include referral system routers
from referral_system import (
    referral_system_router, commission_router, diamond_router, 
    orphan_router, withdrawal_router, admin_router
)
api_router.include_router(referral_system_router)
api_router.include_router(commission_router)
api_router.include_router(diamond_router)
api_router.include_router(orphan_router)
api_router.include_router(withdrawal_router)
api_router.include_router(admin_router)

# Import and include social system routers
from social_system import (
    social_router, friends_router, stories_router,
    groups_router, pages_router, events_router, ai_media_router
)
api_router.include_router(social_router)
api_router.include_router(friends_router)
api_router.include_router(stories_router)
api_router.include_router(groups_router)
api_router.include_router(pages_router)
api_router.include_router(events_router)
api_router.include_router(ai_media_router)

# Import and include notifications & analytics routers
from notifications_analytics import notifications_router, analytics_router
api_router.include_router(notifications_router)
api_router.include_router(analytics_router)

# Import and include seller dashboard routers
from seller_dashboard import get_seller_routers
for router in get_seller_routers():
    api_router.include_router(router)

# Import and include album system router
from album_system import get_album_router
api_router.include_router(get_album_router())

# Import and include casino system router
from casino_system import get_casino_router
api_router.include_router(get_casino_router())

# Import and include admin system routers
from admin_system import admin_system_router, audit_router, genealogy_router
api_router.include_router(admin_system_router)
api_router.include_router(audit_router)
api_router.include_router(genealogy_router)

# Import and include theme system router
from theme_system import theme_router
api_router.include_router(theme_router)

# Import and include AI assistant router
from ai_assistant import ai_assistant_router
api_router.include_router(ai_assistant_router)

# Import and include page manager router
from page_manager import page_manager_router
api_router.include_router(page_manager_router)

# Stripe webhook endpoint (must be at app level, not api_router)
@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    import os
    
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Update payment status based on webhook event
        if webhook_response.payment_status == "paid":
            await db.payment_transactions.update_one(
                {"stripe_session_id": webhook_response.session_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

# Import and include real-time and A/B testing routers
try:
    from realtime_ab_system import realtime_router, ab_testing_router, biometric_router
    api_router.include_router(realtime_router)
    api_router.include_router(ab_testing_router)
    api_router.include_router(biometric_router)
    logger.info("Real-time analytics, A/B testing, and biometric routers loaded")
except ImportError as e:
    logger.warning(f"Could not load realtime_ab_system: {e}")

# Import and include referral system routers
try:
    from referral_system import referral_router
    from diamond_withdrawal_system import diamond_router, withdrawal_router, kyc_router
    api_router.include_router(referral_router)
    api_router.include_router(diamond_router)
    api_router.include_router(withdrawal_router)
    api_router.include_router(kyc_router)
    logger.info("Referral, Diamond Leader, Withdrawal, and KYC routers loaded")
except ImportError as e:
    logger.warning(f"Could not load referral/diamond systems: {e}")

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
