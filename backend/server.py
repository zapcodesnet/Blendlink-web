from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File, Form
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Any, Dict
import uuid
import base64
from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
import bcrypt
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection with fallback for preview environments
def get_mongo_connection():
    """
    Attempts to connect to MongoDB Atlas first.
    Falls back to local MongoDB if Atlas is unreachable (e.g., port 27017 blocked in preview).
    """
    mongo_url = os.environ.get('MONGO_URL')
    mongo_url_local = os.environ.get('MONGO_URL_LOCAL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME')
    
    if not db_name:
        raise ValueError('DB_NAME environment variable is required')
    
    # Try Atlas connection first
    try:
        from pymongo import MongoClient as SyncMongoClient
        # Quick sync test with short timeout
        test_client = SyncMongoClient(mongo_url, serverSelectionTimeoutMS=5000)
        test_client.admin.command('ping')
        test_client.close()
        print(f"✅ Connected to MongoDB Atlas: {db_name}")
        return AsyncIOMotorClient(mongo_url), db_name
    except Exception as e:
        print(f"⚠️ Atlas connection failed ({e}), falling back to local MongoDB")
        print(f"✅ Connected to Local MongoDB: {db_name}")
        return AsyncIOMotorClient(mongo_url_local), db_name

client, db_name = get_mongo_connection()
db = client[db_name]

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
utils_router = APIRouter(prefix="/utils", tags=["Utils"])

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
    disclaimer_accepted: bool = False

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
    """
    Verify password with bcrypt, handling invalid hashes gracefully.
    
    Returns False for:
    - Empty passwords or hashes
    - Invalid bcrypt hash formats (e.g., Google OAuth users with no password)
    - Incorrect passwords
    """
    if not password:
        return False
    
    # Handle empty or None hash (Google OAuth users don't have passwords)
    if not hashed:
        logger.debug("Password verification failed: No password hash stored (likely OAuth user)")
        return False
    
    # Validate bcrypt hash format before attempting verification
    # Valid bcrypt hashes start with $2a$, $2b$, or $2y$ followed by cost factor
    if not isinstance(hashed, str) or not hashed.startswith('$2'):
        logger.warning(f"Password verification failed: Invalid hash format (not bcrypt)")
        return False
    
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError as e:
        # This occurs with malformed bcrypt hashes
        logger.warning(f"Password verification failed: Invalid bcrypt salt - {str(e)}")
        return False
    except TypeError as e:
        logger.warning(f"Password verification failed: Type error - {str(e)}")
        return False

def create_token(user_id: str, expiry_hours: int = None) -> str:
    hours = expiry_hours if expiry_hours else JWT_EXPIRY_HOURS
    expires = datetime.now(timezone.utc) + timedelta(hours=hours)
    return jwt.encode({"sub": user_id, "user_id": user_id, "exp": expires}, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")

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

async def get_current_user_from_token(token: str) -> dict:
    """Helper function to get user from token string directly (for use in other modules)"""
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            return None
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        return user
    except JWTError:
        return None

# ============== AUTH ROUTES ==============
@auth_router.post("/register")
async def register(data: UserCreate, response: Response):
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    existing_username = await db.users.find_one({"username": data.username}, {"_id": 0})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Check disclaimer acceptance (required for new registrations)
    if not getattr(data, 'disclaimer_accepted', False):
        raise HTTPException(status_code=400, detail="You must accept the disclaimer to register")
    
    user = UserBase(
        email=data.email,
        name=data.name,
        username=data.username,
        avatar=f"https://ui-avatars.com/api/?name={data.name.replace(' ', '+')}&background=2563eb&color=fff"
    )
    user_dict = user.model_dump()
    user_dict["password_hash"] = hash_password(data.password)
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    user_dict["disclaimer_accepted"] = True
    user_dict["disclaimer_accepted_at"] = datetime.now(timezone.utc).isoformat()
    
    # Initialize new referral system fields
    user_dict["bl_coins"] = 0  # Will be added via transaction
    user_dict["usd_balance"] = 0.0
    user_dict["rank"] = "regular"
    user_dict["is_diamond"] = False
    user_dict["kyc_status"] = "not_started"
    user_dict["direct_referrals"] = 0
    user_dict["indirect_referrals"] = 0
    user_dict["total_earnings_bl"] = 0
    user_dict["total_earnings_usd"] = 0.0
    user_dict["diamond_qualification_progress"] = {}
    user_dict["last_activity"] = datetime.now(timezone.utc).isoformat()
    
    has_referrer = False
    referrer_id = None
    l2_referrer_id = None
    
    # Constants for sign-up bonuses
    SIGNUP_BONUS = 50000  # BL coins for new user
    REFERRAL_BONUS = 50000  # BL coins for referrer
    L1_SIGNUP_RATE = 0.03  # 3% to L1 upline
    L2_SIGNUP_RATE = 0.01  # 1% to L2 upline
    
    # Handle referral
    if data.referral_code:
        referrer = await db.users.find_one({"referral_code": data.referral_code}, {"_id": 0})
        if referrer:
            has_referrer = True
            referrer_id = referrer["user_id"]
            user_dict["referred_by"] = referrer_id
            
            # Get L2 referrer (referrer's upline)
            l2_referrer_id = referrer.get("referred_by")
            
            # Create referral relationship record
            from referral_system import ReferralRelationship
            relationship = ReferralRelationship(
                referrer_id=referrer_id,
                referred_id=user.user_id,
                level=1
            )
            rel_dict = relationship.model_dump()
            rel_dict["created_at"] = rel_dict["created_at"].isoformat()
            rel_dict["last_activity"] = rel_dict["last_activity"].isoformat()
            await db.referral_relationships.insert_one(rel_dict)
            
            # If L2 exists, create that relationship too
            if l2_referrer_id:
                l2_relationship = ReferralRelationship(
                    referrer_id=l2_referrer_id,
                    referred_id=user.user_id,
                    level=2
                )
                l2_rel_dict = l2_relationship.model_dump()
                l2_rel_dict["created_at"] = l2_rel_dict["created_at"].isoformat()
                l2_rel_dict["last_activity"] = l2_rel_dict["last_activity"].isoformat()
                await db.referral_relationships.insert_one(l2_rel_dict)
    
    # Insert user first
    await db.users.insert_one(user_dict.copy())
    
    # If no referrer was provided or found, try to assign from orphan queue
    if not has_referrer:
        # Mark user as orphan first
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {"is_orphan": True}}
        )
        
        try:
            from orphan_assignment_system import auto_assign_single_orphan
            result = await auto_assign_single_orphan(user.user_id)
            if result.success:
                referrer_id = result.assigned_to
                logger.info(f"Orphan user {user.user_id} auto-assigned to {referrer_id} (Tier {result.tier})")
                # Note: Assigned uplines do NOT receive bonuses for orphans
            else:
                logger.warning(f"No eligible parent for orphan {user.user_id}: {result.message}")
        except ImportError:
            # Fallback to old system
            try:
                from referral_system import assign_orphan_to_queue
                assigned_to = await assign_orphan_to_queue(user.user_id)
                if assigned_to:
                    referrer_id = assigned_to
                    logger.info(f"Orphan user {user.user_id} assigned to {assigned_to} via fallback")
            except Exception as e:
                logger.error(f"Fallback orphan assignment failed: {e}")
        except Exception as e:
            logger.error(f"Failed to assign orphan: {e}")
    
    # Process bonuses using the referral system
    bonus_details = {
        "new_user_bonus": SIGNUP_BONUS,
        "referrer_bonus": 0,
        "l1_upline_bonus": 0,
        "l2_upline_bonus": 0,
    }
    
    # Give new user the sign-up bonus (always)
    from referral_system import record_transaction, TransactionType, Currency
    await record_transaction(
        user_id=user.user_id,
        transaction_type=TransactionType.SIGNUP_BONUS,
        currency=Currency.BL,
        amount=SIGNUP_BONUS,
        details={"type": "new_user_signup_bonus"}
    )
    
    # If has valid referrer (not orphan-assigned), give referral bonuses
    if has_referrer and referrer_id:
        # Referrer gets 50,000 BL coins
        await record_transaction(
            user_id=referrer_id,
            transaction_type=TransactionType.REFERRAL_BONUS,
            currency=Currency.BL,
            amount=REFERRAL_BONUS,
            reference_id=user.user_id,
            details={"type": "direct_referral_bonus", "new_user": user.user_id}
        )
        bonus_details["referrer_bonus"] = REFERRAL_BONUS
        
        # Update referrer's direct_referrals count
        await db.users.update_one(
            {"user_id": referrer_id},
            {"$inc": {"direct_referrals": 1}}
        )
        
        # L1 upline (referrer's upline) gets 3% of 50,000 = 1,500
        if l2_referrer_id:
            l1_bonus = round(REFERRAL_BONUS * L1_SIGNUP_RATE)  # 1500
            await record_transaction(
                user_id=l2_referrer_id,
                transaction_type=TransactionType.COMMISSION_L1,
                currency=Currency.BL,
                amount=l1_bonus,
                reference_id=user.user_id,
                details={"type": "signup_l1_commission", "new_user": user.user_id, "via_referrer": referrer_id}
            )
            bonus_details["l1_upline_bonus"] = l1_bonus
            
            # Update L1's indirect count
            await db.users.update_one(
                {"user_id": l2_referrer_id},
                {"$inc": {"indirect_referrals": 1}}
            )
            
            # L2 upline (referrer's upline's upline) gets 1% of 50,000 = 500
            l2_upline = await db.users.find_one({"user_id": l2_referrer_id}, {"referred_by": 1})
            if l2_upline and l2_upline.get("referred_by"):
                l2_bonus = round(REFERRAL_BONUS * L2_SIGNUP_RATE)  # 500
                await record_transaction(
                    user_id=l2_upline["referred_by"],
                    transaction_type=TransactionType.COMMISSION_L2,
                    currency=Currency.BL,
                    amount=l2_bonus,
                    reference_id=user.user_id,
                    details={"type": "signup_l2_commission", "new_user": user.user_id}
                )
                bonus_details["l2_upline_bonus"] = l2_bonus
    
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
    
    return {
        "user_id": user.user_id, 
        "email": user.email, 
        "name": user.name, 
        "token": token,
        "bl_coins_bonus": SIGNUP_BONUS,
        "bonus_details": bonus_details,
    }

@auth_router.post("/login")
async def login(data: UserLogin, response: Response):
    # Find user by email (case-insensitive)
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    
    # Log for debugging (remove in production if needed)
    if not user:
        logger.warning(f"Login attempt failed: User not found for email {data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    password_valid = verify_password(data.password, user.get("password_hash", ""))
    if not password_valid:
        logger.warning(f"Login attempt failed: Invalid password for user {user.get('user_id')}")
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
    
    # Update last activity
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"last_activity": datetime.now(timezone.utc).isoformat()}}
    )
    
    user.pop("password_hash", None)
    logger.info(f"Login successful for user {user.get('user_id')}")
    return {"token": token, "user": user}

@auth_router.get("/verify-test-user")
async def verify_test_user():
    """Diagnostic endpoint to verify test user exists and is correctly configured"""
    import bcrypt
    
    test_email = "tester@blendlink.net"
    test_password = "BlendLink2024!"
    
    user = await db.users.find_one({"email": test_email})
    
    if not user:
        return {
            "status": "error",
            "message": "Test user not found",
            "exists": False
        }
    
    password_hash = user.get("password_hash", "")
    hash_valid = bool(password_hash and password_hash.startswith("$2"))
    
    try:
        password_correct = bcrypt.checkpw(test_password.encode(), password_hash.encode()) if hash_valid else False
    except:
        password_correct = False
    
    return {
        "status": "ok" if password_correct else "error",
        "exists": True,
        "user_id": user.get("user_id"),
        "email": user.get("email"),
        "hash_format_valid": hash_valid,
        "password_verified": password_correct,
        "bl_coins": user.get("bl_coins", 0),
        "is_premium": user.get("is_premium", False),
        "is_verified": user.get("is_verified", False)
    }

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
async def get_user(user_id: str, request: Request):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if viewer is authenticated and if they're friends
    is_friend = False
    viewer_id = None
    try:
        viewer = await get_current_user(request)
        viewer_id = viewer.get("user_id")
        if viewer_id:
            is_friend = await check_if_friends(user_id, viewer_id)
    except:
        pass  # Anonymous viewer
    
    # Apply privacy filter if user has privacy enabled
    if user.get("is_real_name_private", False) and not is_friend:
        user["display_name"] = user.get("username") or f"user_{user_id[:8]}"
        user["name_hidden"] = True
    else:
        user["display_name"] = user.get("name")
        user["name_hidden"] = False
    
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

# ============== PRIVACY SETTINGS ==============
class PrivacySettingsUpdate(BaseModel):
    is_real_name_private: bool

class ProfilePictureUpdate(BaseModel):
    image_url: str
    mint_id: Optional[str] = None

@users_router.put("/me/profile-picture")
async def update_profile_picture(data: ProfilePictureUpdate, current_user: dict = Depends(get_current_user)):
    """Update user's profile picture from a minted photo"""
    # Validate the image_url is not empty
    if not data.image_url:
        raise HTTPException(status_code=400, detail="Image URL is required")
    
    # If mint_id is provided, verify it belongs to the user
    if data.mint_id:
        photo = await db.minted_photos.find_one({
            "mint_id": data.mint_id,
            "user_id": current_user["user_id"]
        }, {"_id": 0})
        if not photo:
            raise HTTPException(status_code=404, detail="Photo not found or does not belong to you")
    
    # Update the user's profile picture
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {
            "profile_picture": data.image_url,
            "profile_picture_mint_id": data.mint_id,
            "profile_picture_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "profile_picture": data.image_url,
        "message": "Profile picture updated successfully"
    }

@users_router.put("/privacy-settings")
async def update_privacy_settings(data: PrivacySettingsUpdate, current_user: dict = Depends(get_current_user)):
    """Update user's privacy settings - specifically the real name visibility"""
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {
            "is_real_name_private": data.is_real_name_private,
            "privacy_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "is_real_name_private": data.is_real_name_private,
        "message": "Privacy settings updated successfully"
    }


# Medal Showcase API
class MedalShowcaseUpdate(BaseModel):
    showcase_photo_ids: List[str] = []


@users_router.put("/me/medal-showcase")
async def update_medal_showcase(data: MedalShowcaseUpdate, current_user: dict = Depends(get_current_user)):
    """Update user's medal showcase - choose which decorated photos to feature"""
    # Limit to 5 photos
    photo_ids = data.showcase_photo_ids[:5]
    
    # Verify all photos belong to user and have medals
    if photo_ids:
        photos = await db.minted_photos.find({
            "mint_id": {"$in": photo_ids},
            "user_id": current_user["user_id"]
        }, {"_id": 0}).to_list(5)
        
        # Only include photos that exist
        valid_ids = [p["mint_id"] for p in photos]
        photo_ids = [pid for pid in photo_ids if pid in valid_ids]
    
    # Update user's showcase
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {"$set": {
            "medal_showcase_ids": photo_ids,
            "medal_showcase_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {
        "success": True,
        "showcase_photo_ids": photo_ids,
        "message": "Medal showcase updated successfully"
    }


@users_router.get("/{user_id}/medal-showcase")
async def get_user_medal_showcase(user_id: str):
    """Get a user's medal showcase (public endpoint)"""
    # Get user's showcase settings
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    showcase_ids = user.get("medal_showcase_ids", [])
    
    # Get all user's photos with medals
    from game_routes import _db as game_db
    
    all_photos = await db.minted_photos.find(
        {"user_id": user_id},
        {"_id": 0, "mint_id": 1, "name": 1, "image_url": 1, "dollar_value": 1, "medals": 1}
    ).to_list(100)
    
    # Enrich with stamina data for medal counts
    enriched_photos = []
    total_medals = 0
    
    for photo in all_photos:
        stamina_record = await db.photo_stamina.find_one({"mint_id": photo["mint_id"]})
        medals = {}
        win_streak = 0
        
        if stamina_record:
            medals = stamina_record.get("medals", {"ten_win_streak": 0})
            win_streak = stamina_record.get("win_streak", 0)
        
        # Also check photo itself
        if not medals.get("ten_win_streak") and photo.get("medals"):
            medals = photo.get("medals", {"ten_win_streak": 0})
        
        medal_count = medals.get("ten_win_streak", 0)
        if medal_count > 0:
            total_medals += medal_count
            enriched_photos.append({
                **photo,
                "medals": medals,
                "win_streak": win_streak,
            })
    
    # Get showcase photos in order
    showcase_photos = []
    for mint_id in showcase_ids:
        for p in enriched_photos:
            if p["mint_id"] == mint_id:
                showcase_photos.append(p)
                break
    
    return {
        "user_id": user_id,
        "showcase_photo_ids": showcase_ids,
        "showcase_photos": showcase_photos,
        "all_medal_photos": enriched_photos,
        "total_medals": total_medals,
    }


@users_router.get("/{user_id}/friends")
async def get_user_friends(user_id: str, current_user: dict = Depends(get_current_user)):
    """Get list of approved friends for a user"""
    # Friends are mutual followers (both follow each other)
    user_following = await db.follows.find({"follower_id": user_id}, {"_id": 0}).to_list(1000)
    following_ids = set(f["following_id"] for f in user_following)
    
    user_followers = await db.follows.find({"following_id": user_id}, {"_id": 0}).to_list(1000)
    follower_ids = set(f["follower_id"] for f in user_followers)
    
    # Mutual followers = friends
    friend_ids = following_ids.intersection(follower_ids)
    return list(friend_ids)

async def check_if_friends(user_id: str, viewer_id: str) -> bool:
    """Check if two users are mutual friends (both follow each other)"""
    if user_id == viewer_id:
        return True  # User can see their own name
    
    # Check if viewer follows user
    viewer_follows = await db.follows.find_one({
        "follower_id": viewer_id,
        "following_id": user_id
    })
    if not viewer_follows:
        return False
    
    # Check if user follows viewer back (mutual)
    user_follows_back = await db.follows.find_one({
        "follower_id": user_id,
        "following_id": viewer_id
    })
    return user_follows_back is not None

def get_display_name(user: dict, is_friend: bool = False) -> str:
    """Get the appropriate display name based on privacy settings and friendship"""
    if not user:
        return "Unknown User"
    
    is_private = user.get("is_real_name_private", False)
    
    if is_private and not is_friend:
        # Return username for non-friends when privacy is enabled
        return user.get("username") or f"user_{user.get('user_id', '')[:8]}"
    
    # Return real name
    return user.get("name") or user.get("username") or "User"

# ============== POST ROUTES ==============
@posts_router.get("/feed")
async def get_feed(skip: int = 0, limit: int = 20, current_user: dict = Depends(get_current_user)):
    """Optimized feed endpoint with efficient querying"""
    # Get following list with projection for faster query
    following = await db.follows.find(
        {"follower_id": current_user["user_id"]}, 
        {"_id": 0, "following_id": 1}
    ).to_list(500)  # Reasonable limit
    following_ids = [f["following_id"] for f in following]
    following_ids.append(current_user["user_id"])
    
    # Fetch posts with optimized query
    posts = await db.posts.find(
        {"user_id": {"$in": following_ids}, "is_story": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    if not posts:
        return []
    
    # Batch fetch user data and likes in parallel-ish manner
    user_ids = list(set(post["user_id"] for post in posts))
    post_ids = [post["post_id"] for post in posts]
    
    # Fetch users and likes concurrently
    users_task = db.users.find(
        {"user_id": {"$in": user_ids}}, 
        {"_id": 0, "user_id": 1, "name": 1, "username": 1, "avatar": 1, "is_real_name_private": 1}
    ).to_list(len(user_ids))
    
    likes_task = db.likes.find({
        "post_id": {"$in": post_ids},
        "user_id": current_user["user_id"]
    }, {"_id": 0, "post_id": 1}).to_list(len(post_ids))
    
    users, likes = await asyncio.gather(users_task, likes_task)
    
    users_map = {u["user_id"]: u for u in users}
    liked_posts = {like["post_id"] for like in likes}
    
    for post in posts:
        post["user"] = users_map.get(post["user_id"])
        post["liked"] = post["post_id"] in liked_posts
    
    return posts

@posts_router.get("/explore")
async def explore_posts(skip: int = 0, limit: int = 20):
    """Optimized explore endpoint"""
    posts = await db.posts.find(
        {"is_story": {"$ne": True}},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    if not posts:
        return []
    
    # Batch fetch user data
    user_ids = list(set(post["user_id"] for post in posts))
    users = await db.users.find(
        {"user_id": {"$in": user_ids}}, 
        {"_id": 0, "user_id": 1, "name": 1, "username": 1, "avatar": 1}
    ).to_list(len(user_ids))
    users_map = {u["user_id"]: u for u in users}
    
    for post in posts:
        post["user"] = users_map.get(post["user_id"])
    
    return posts

@posts_router.get("/stories")
async def get_stories(current_user: dict = Depends(get_current_user)):
    """Optimized stories endpoint"""
    # Get following with minimal projection
    following = await db.follows.find(
        {"follower_id": current_user["user_id"]}, 
        {"_id": 0, "following_id": 1}
    ).to_list(500)
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
async def get_listings(request: Request, category: Optional[str] = None, search: Optional[str] = None, skip: int = 0, limit: int = 20):
    query = {"status": "active"}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    listings = await db.listings.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get viewer ID for privacy check
    viewer_id = None
    try:
        viewer = await get_current_user(request)
        viewer_id = viewer.get("user_id")
    except:
        pass  # Anonymous viewer
    
    # Batch fetch all users to avoid N+1 queries
    if listings:
        user_ids = list(set(listing["user_id"] for listing in listings))
        users = await db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "password_hash": 0}).to_list(len(user_ids))
        users_map = {u["user_id"]: u for u in users}
        
        for listing in listings:
            seller = users_map.get(listing["user_id"])
            if seller:
                # Apply privacy filter
                is_friend = False
                if viewer_id:
                    is_friend = await check_if_friends(listing["user_id"], viewer_id)
                
                seller_copy = seller.copy()
                if seller.get("is_real_name_private", False) and not is_friend:
                    seller_copy["display_name"] = seller.get("username") or f"user_{listing['user_id'][:8]}"
                    seller_copy["name_hidden"] = True
                else:
                    seller_copy["display_name"] = seller.get("name")
                    seller_copy["name_hidden"] = False
                listing["seller"] = seller_copy
            else:
                listing["seller"] = None
    
    return listings

@marketplace_router.get("/listings/{listing_id}")
async def get_listing(listing_id: str, request: Request):
    listing = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    user = await db.users.find_one({"user_id": listing["user_id"]}, {"_id": 0, "password_hash": 0})
    
    # Get viewer ID for privacy check
    viewer_id = None
    try:
        viewer = await get_current_user(request)
        viewer_id = viewer.get("user_id")
    except:
        pass  # Anonymous viewer
    
    if user:
        # Apply privacy filter
        is_friend = False
        if viewer_id:
            is_friend = await check_if_friends(listing["user_id"], viewer_id)
        
        if user.get("is_real_name_private", False) and not is_friend:
            user["display_name"] = user.get("username") or f"user_{listing['user_id'][:8]}"
            user["name_hidden"] = True
        else:
            user["display_name"] = user.get("name")
            user["name_hidden"] = False
    
    listing["seller"] = user
    return listing

class AuctionSettingsModel(BaseModel):
    is_auction: bool = False
    duration: str = "1d"  # 1h, 3h, 6h, 12h, 1d, 2d, 3d, 5d, 7d
    starting_bid: Optional[float] = None
    reserve_price: Optional[float] = None
    buy_it_now_price: Optional[float] = None
    auto_relist: bool = False
    auto_extend: bool = True

class CreateListing(BaseModel):
    title: str
    description: str
    price: float  # For fixed price OR starting bid for auctions
    category: str
    images: List[str] = []
    condition: str = "new"
    is_digital: bool = False
    target_countries: List[str] = ["US"]  # Target market countries
    weight: Optional[Dict] = None  # e.g., {"value": 2.5, "unit": "lbs"}
    dimensions: Optional[Dict] = None  # e.g., {"length": 12, "width": 9, "height": 6, "unit": "in"}
    tags: List[str] = []
    location: Optional[str] = None  # Seller's ZIP code
    auction: Optional[AuctionSettingsModel] = None  # Auction settings
    share_to_feed: bool = False  # Share listing to social feed

# Listing Fee Constant
LISTING_FEE_BL_COINS = 200  # 200 BL coins per listing

@marketplace_router.get("/listing-fee")
async def get_listing_fee():
    """Get the current listing fee in BL coins"""
    return {
        "fee": LISTING_FEE_BL_COINS,
        "currency": "BL coins",
        "description": "Fee charged per listing creation"
    }

@marketplace_router.post("/listings")
async def create_listing(data: CreateListing, current_user: dict = Depends(get_current_user)):
    # Check and deduct listing fee (200 BL coins)
    user_id = current_user["user_id"]
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "bl_coins": 1})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    LISTING_FEE_BL_COINS = 200
    current_balance = user.get("bl_coins", 0)
    
    if current_balance < LISTING_FEE_BL_COINS:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient BL coins. You need {LISTING_FEE_BL_COINS} BL coins to create a listing. Current balance: {current_balance}"
        )
    
    # Deduct the listing fee
    fee_result = await db.users.update_one(
        {"user_id": user_id, "bl_coins": {"$gte": LISTING_FEE_BL_COINS}},
        {"$inc": {"bl_coins": -LISTING_FEE_BL_COINS}}
    )
    
    if fee_result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Failed to deduct listing fee. Please try again.")
    
    # Record the listing fee transaction
    await db.bl_transactions.insert_one({
        "transaction_id": f"bltxn_{uuid.uuid4().hex[:16]}",
        "user_id": user_id,
        "amount": -LISTING_FEE_BL_COINS,
        "type": "listing_fee",
        "description": f"Listing fee for marketplace item: {data.title[:50]}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
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
    
    # Add extended fields
    listing_dict["target_countries"] = data.target_countries
    listing_dict["weight"] = data.weight
    listing_dict["dimensions"] = data.dimensions
    listing_dict["tags"] = data.tags
    listing_dict["location"] = data.location
    listing_dict["likes"] = []
    listing_dict["shares"] = 0
    
    # Handle auction settings
    if data.auction and data.auction.is_auction:
        from auction_system import get_auction_end_time, DURATION_MAP
        
        # Validate duration
        if data.auction.duration not in DURATION_MAP:
            raise HTTPException(status_code=400, detail="Invalid auction duration")
        
        # Calculate end time
        end_time = get_auction_end_time(data.auction.duration)
        
        listing_dict["auction"] = {
            "is_auction": True,
            "duration": data.auction.duration,
            "starting_bid": data.auction.starting_bid or data.price,
            "reserve_price": data.auction.reserve_price,
            "buy_it_now_price": data.auction.buy_it_now_price,
            "auto_relist": data.auction.auto_relist,
            "auto_extend": data.auction.auto_extend,
            "current_bid": None,
            "current_bidder_id": None,
            "current_bidder_name": None,
            "bid_count": 0,
            "status": "active",
            "end_time": end_time.isoformat(),
            "extended": False,
            "extension_count": 0
        }
        listing_dict["listing_type"] = "auction"
    else:
        listing_dict["listing_type"] = "fixed_price"
    
    await db.listings.insert_one(listing_dict.copy())
    
    # Award BL coins for creating a marketplace listing (100 coins)
    user_id = current_user["user_id"]
    bl_reward = 100  # ACTIVITY_REWARDS["marketplace_listing"]
    reward_reason = f"Created marketplace listing: {data.title[:50]}"
    
    try:
        # Award to the listing creator
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"bl_coins": bl_reward}}
        )
        
        # Log the BL transaction
        await db.bl_transactions.insert_one({
            "transaction_id": f"bltxn_{uuid.uuid4().hex[:16]}",
            "user_id": user_id,
            "amount": bl_reward,
            "type": "reward",
            "reason": reward_reason,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        # Award upline bonuses using the existing referral structure
        # L1 upline gets 3% of the BL coins (3 coins), L2 gets 1% (1 coin)
        user = await db.users.find_one({"user_id": user_id})
        
        if user and user.get("l1_recruiter_id"):
            l1_bonus = int(bl_reward * 0.03)  # 3% for L1
            if l1_bonus > 0:
                await db.users.update_one(
                    {"user_id": user["l1_recruiter_id"]},
                    {"$inc": {"bl_coins": l1_bonus}}
                )
                await db.bl_transactions.insert_one({
                    "transaction_id": f"bltxn_{uuid.uuid4().hex[:16]}",
                    "user_id": user["l1_recruiter_id"],
                    "amount": l1_bonus,
                    "type": "referral_bonus",
                    "reason": f"L1 bonus from {current_user.get('name', 'user')}'s listing",
                    "from_user_id": user_id,
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            
            # L2 upline gets 1%
            l1_user = await db.users.find_one({"user_id": user["l1_recruiter_id"]})
            if l1_user and l1_user.get("l1_recruiter_id"):
                l2_bonus = int(bl_reward * 0.01)  # 1% for L2
                if l2_bonus > 0:
                    await db.users.update_one(
                        {"user_id": l1_user["l1_recruiter_id"]},
                        {"$inc": {"bl_coins": l2_bonus}}
                    )
                    await db.bl_transactions.insert_one({
                        "transaction_id": f"bltxn_{uuid.uuid4().hex[:16]}",
                        "user_id": l1_user["l1_recruiter_id"],
                        "amount": l2_bonus,
                        "type": "referral_bonus",
                        "reason": f"L2 bonus from {current_user.get('name', 'user')}'s listing",
                        "from_user_id": user_id,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    })
        
        listing_dict["bl_coins_earned"] = bl_reward
        logger.info(f"Awarded {bl_reward} BL coins to user {user_id} for listing creation")
        
    except Exception as e:
        logger.error(f"Failed to award BL coins for listing: {e}")
        # Continue even if reward fails
    
    # Share to feed if requested
    if data.share_to_feed:
        try:
            # Create a social post linking to the listing
            post_id = f"post_{uuid.uuid4().hex[:12]}"
            listing_url = f"/marketplace/{listing_dict['listing_id']}"
            
            # Format price display
            if data.auction and data.auction.is_auction:
                price_text = f"Starting bid: ${data.price:.2f}"
                if data.auction.buy_it_now_price:
                    price_text += f" | Buy Now: ${data.auction.buy_it_now_price:.2f}"
                listing_type_text = "🔨 New Auction Listing"
            else:
                price_text = f"Price: ${data.price:.2f}"
                listing_type_text = "🛒 New Marketplace Listing"
            
            # Create post content
            post_content = f"{listing_type_text}\n\n{data.title}\n\n{price_text}\n\n{data.description[:200]}{'...' if len(data.description) > 200 else ''}\n\n🔗 View listing"
            
            feed_post = {
                "post_id": post_id,
                "user_id": user_id,
                "content": post_content,
                "images": data.images[:4] if data.images else [],  # Max 4 images for feed
                "post_type": "marketplace_listing",
                "listing_id": listing_dict["listing_id"],
                "listing_url": listing_url,
                "listing_title": data.title,
                "listing_price": data.price,
                "listing_category": data.category,
                "is_auction": data.auction.is_auction if data.auction else False,
                "likes": [],
                "comments": [],
                "shares": 0,
                "visibility": "public",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.posts.insert_one(feed_post.copy())
            listing_dict["feed_post_id"] = post_id
            logger.info(f"Created feed post {post_id} for listing {listing_dict['listing_id']}")
            
        except Exception as e:
            logger.error(f"Failed to create feed post for listing: {e}")
            # Continue even if feed post fails
    
    return listing_dict

# Master category list - single source of truth for all marketplace categories
MARKETPLACE_CATEGORIES = [
    {"id": "electronics", "name": "Electronics", "icon": "Smartphone"},
    {"id": "fashion", "name": "Fashion", "icon": "Shirt"},
    {"id": "home", "name": "Home & Garden", "icon": "Home"},
    {"id": "vehicles", "name": "Vehicles", "icon": "Car"},
    {"id": "sports", "name": "Sports", "icon": "Dumbbell"},
    {"id": "digital", "name": "Digital Goods & NFTs", "icon": "Download"},
    {"id": "services", "name": "Services", "icon": "Wrench"},
    {"id": "jewelry", "name": "Jewelry & Watches", "icon": "Watch"},
    {"id": "collectibles", "name": "Collectibles & Art", "icon": "Palette"},
    {"id": "health", "name": "Health & Beauty", "icon": "Heart"},
    {"id": "toys", "name": "Toys & Hobbies", "icon": "Gamepad2"},
    {"id": "business", "name": "Business & Industrial", "icon": "Building2"},
    {"id": "pets", "name": "Pet Supplies", "icon": "PawPrint"},
    {"id": "baby", "name": "Baby Essentials", "icon": "Baby"},
    {"id": "giftcards", "name": "Gift Cards & Coupons", "icon": "Gift"},
    {"id": "tickets", "name": "Tickets & Travel", "icon": "Ticket"},
    {"id": "general", "name": "General", "icon": "Package"},
]

@marketplace_router.get("/categories")
async def get_categories():
    """Return the master list of marketplace categories"""
    return MARKETPLACE_CATEGORIES

class UpdateListing(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    images: Optional[List[str]] = None
    condition: Optional[str] = None
    status: Optional[str] = None
    target_countries: Optional[List[str]] = None
    weight: Optional[Dict] = None
    dimensions: Optional[Dict] = None
    tags: Optional[List[str]] = None

@marketplace_router.put("/listings/{listing_id}")
async def update_listing(listing_id: str, data: UpdateListing, current_user: dict = Depends(get_current_user)):
    """Update a listing - only owner can update"""
    # Check if listing exists and belongs to user
    listing = await db.listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if listing.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only edit your own listings")
    
    # Build update dict with only provided fields
    update_data = {}
    if data.title is not None:
        update_data["title"] = data.title
    if data.description is not None:
        update_data["description"] = data.description
    if data.price is not None:
        update_data["price"] = data.price
    if data.category is not None:
        update_data["category"] = data.category
    if data.images is not None:
        update_data["images"] = data.images
    if data.condition is not None:
        update_data["condition"] = data.condition
    if data.status is not None:
        update_data["status"] = data.status
    if data.target_countries is not None:
        update_data["target_countries"] = data.target_countries
    if data.weight is not None:
        update_data["weight"] = data.weight
    if data.dimensions is not None:
        update_data["dimensions"] = data.dimensions
    if data.tags is not None:
        update_data["tags"] = data.tags
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if update_data:
        await db.listings.update_one(
            {"listing_id": listing_id},
            {"$set": update_data}
        )
    
    # Fetch and return updated listing
    updated_listing = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    return updated_listing

@marketplace_router.delete("/listings/{listing_id}")
async def delete_listing(listing_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a listing - only owner can delete"""
    listing = await db.listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if listing.get("user_id") != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own listings")
    
    await db.listings.delete_one({"listing_id": listing_id})
    return {"success": True, "message": "Listing deleted"}

@marketplace_router.post("/listings/{listing_id}/like")
async def like_listing(listing_id: str, request: Request):
    """Like or unlike a marketplace listing"""
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
        username = user.get("username") or user.get("name", "Someone")
    except:
        raise HTTPException(status_code=401, detail="Login required to like")
    
    # Check if listing exists
    listing = await db.listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    seller_id = listing.get("user_id")
    
    # Check if user already liked
    existing_like = await db.listing_likes.find_one({
        "listing_id": listing_id,
        "user_id": user_id
    })
    
    if existing_like:
        # Unlike
        await db.listing_likes.delete_one({"_id": existing_like["_id"]})
        await db.listings.update_one(
            {"listing_id": listing_id},
            {"$inc": {"likes_count": -1}}
        )
        return {"liked": False, "likes_count": max(0, (listing.get("likes_count", 0) - 1))}
    else:
        # Like
        await db.listing_likes.insert_one({
            "listing_id": listing_id,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        await db.listings.update_one(
            {"listing_id": listing_id},
            {"$inc": {"likes_count": 1}}
        )
        
        # Send notification to seller (if not self-like)
        if seller_id and seller_id != user_id:
            try:
                from notifications_system import notify_listing_liked
                await notify_listing_liked(
                    seller_id=seller_id,
                    liker_username=username,
                    listing_id=listing_id,
                    listing_title=listing.get("title", "Your listing")
                )
            except Exception as e:
                logger.warning(f"Failed to send like notification: {e}")
        
        return {"liked": True, "likes_count": (listing.get("likes_count", 0) + 1)}

@marketplace_router.post("/listings/{listing_id}/share")
async def share_listing(listing_id: str, request: Request):
    """Track when a listing is shared and notify seller"""
    # Get user info if logged in (optional for sharing)
    user_id = None
    username = "Someone"
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
        username = user.get("username") or user.get("name", "Someone")
    except:
        pass  # Allow anonymous shares
    
    # Check if listing exists
    listing = await db.listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    seller_id = listing.get("user_id")
    
    # Track the share
    await db.listing_shares.insert_one({
        "listing_id": listing_id,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Increment share count
    await db.listings.update_one(
        {"listing_id": listing_id},
        {"$inc": {"shares_count": 1}}
    )
    
    # Notify seller (if not self-share and user is logged in)
    if seller_id and user_id and seller_id != user_id:
        try:
            from notifications_system import notify_listing_shared
            await notify_listing_shared(
                seller_id=seller_id,
                sharer_username=username,
                listing_id=listing_id,
                listing_title=listing.get("title", "Your listing")
            )
        except Exception as e:
            logger.warning(f"Failed to send share notification: {e}")
    
    return {"shared": True, "shares_count": (listing.get("shares_count", 0) + 1)}

class ListingCommentRequest(BaseModel):
    content: str

@marketplace_router.post("/listings/{listing_id}/comments")
async def comment_on_listing(listing_id: str, data: ListingCommentRequest, request: Request):
    """Add a comment to a listing and notify seller"""
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
        username = user.get("username") or user.get("name", "Someone")
    except:
        raise HTTPException(status_code=401, detail="Login required to comment")
    
    # Check if listing exists
    listing = await db.listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    seller_id = listing.get("user_id")
    
    # Create comment
    comment_id = f"comment_{uuid.uuid4().hex[:12]}"
    comment = {
        "comment_id": comment_id,
        "listing_id": listing_id,
        "user_id": user_id,
        "content": data.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.listing_comments.insert_one(comment)
    
    # Update comment count
    await db.listings.update_one(
        {"listing_id": listing_id},
        {"$inc": {"comments_count": 1}}
    )
    
    # Notify seller (if not self-comment)
    if seller_id and seller_id != user_id:
        try:
            from notifications_system import notify_listing_commented
            await notify_listing_commented(
                seller_id=seller_id,
                commenter_username=username,
                listing_id=listing_id,
                listing_title=listing.get("title", "Your listing"),
                comment_preview=data.content
            )
        except Exception as e:
            logger.warning(f"Failed to send comment notification: {e}")
    
    # Return comment with user info (exclude MongoDB _id)
    comment.pop("_id", None)
    comment["user"] = {"user_id": user_id, "username": username, "name": user.get("name"), "avatar": user.get("avatar")}
    return comment

@marketplace_router.get("/listings/{listing_id}/comments")
async def get_listing_comments(listing_id: str, skip: int = 0, limit: int = 50):
    """Get comments for a listing"""
    comments = await db.listing_comments.find(
        {"listing_id": listing_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Batch fetch user info
    if comments:
        user_ids = list(set(c["user_id"] for c in comments if c.get("user_id")))
        users = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "password_hash": 0}
        ).to_list(len(user_ids))
        users_map = {u["user_id"]: u for u in users}
        
        for comment in comments:
            comment["user"] = users_map.get(comment.get("user_id"))
    
    return comments

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
        # CRITICAL: Use STRIPE_SECRET_KEY (not STRIPE_API_KEY which may have system override)
        api_key = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY")
        
        if not api_key:
            raise HTTPException(status_code=500, detail="Stripe not configured")
        
        stripe.api_key = api_key
        
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
    """
    Claim daily login reward - unified system
    Uses referral system's daily claim logic for consistency
    """
    # Redirect to the main daily claim in referral system
    # to ensure consistency across all pages
    from referral_system import claim_daily_bl
    return await claim_daily_bl(current_user)

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
        "file_url": f"/api/upload/files/{filename}",
        "url": f"/api/upload/files/{filename}"  # Alias for convenience
    }

@upload_router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload a single image - simplified endpoint for product images"""
    # Validate image type
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    content_type = file.content_type or ""
    
    if content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported image type: {content_type}. Use JPEG, PNG, GIF or WebP.")
    
    # Read file content
    content = await file.read()
    
    # Check file size (max 5MB for images)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large. Maximum size is 5MB.")
    
    # Generate unique filename
    ext = Path(file.filename or "image").suffix or ".jpg"
    unique_id = uuid.uuid4().hex[:12]
    filename = f"product_{unique_id}{ext}"
    file_path = UPLOAD_DIR / filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(content)
    
    # Store in database
    upload_record = {
        "upload_id": f"img_{unique_id}",
        "user_id": current_user["user_id"],
        "filename": filename,
        "original_filename": file.filename,
        "content_type": content_type,
        "media_type": "image",
        "size": len(content),
        "file_path": str(file_path),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.uploads.insert_one(upload_record)
    
    # Return the URL that can be used to access the image
    return {
        "success": True,
        "upload_id": upload_record["upload_id"],
        "filename": filename,
        "url": f"/api/upload/files/{filename}",
        "size": len(content)
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

# NOTE: Referral system routers are imported at the end of this file in a try-except block

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

# Import and include photo editor router
from photo_editor import get_photo_editor_router
api_router.include_router(get_photo_editor_router())

# Import and include album system router
from album_system import get_album_router
api_router.include_router(get_album_router())

# Import and include casino system router
from casino_system import get_casino_router
api_router.include_router(get_casino_router())

# Import and include poker tournament router
from poker_tournament import poker_router
api_router.include_router(poker_router)

# Import and include social messaging router
from social_messaging import messaging_router
api_router.include_router(messaging_router)

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

# Import and include AI generation router
from ai_generation import ai_generation_router
api_router.include_router(ai_generation_router)

# Import and include AI photo transformation router
from ai_photo_transform import transform_router
api_router.include_router(transform_router)
logger.info("AI Photo Transform System loaded")

# Import and include AI collections router
from ai_collections import ai_collections_router
api_router.include_router(ai_collections_router)

# Import and include page manager router
from page_manager import page_manager_router
api_router.include_router(page_manager_router)

# Import and include member pages system routers
try:
    from member_pages_system import get_member_pages_routers
    for router in get_member_pages_routers():
        api_router.include_router(router)
    logger.info("Member Pages System loaded")
except Exception as e:
    logger.warning(f"Failed to load Member Pages System: {e}")

# Import and include member pages extended features (Sections 2-6)
try:
    from member_pages_extended import get_extended_pages_routers
    for router in get_extended_pages_routers():
        api_router.include_router(router)
    logger.info("Member Pages Extended Features loaded (Barcode, AI Scan, POS, Referrals, Marketplace Link, Customer Options)")
except Exception as e:
    logger.warning(f"Failed to load Member Pages Extended: {e}")

# Import and include Page Stripe Payments router
try:
    from stripe_payments import get_stripe_router
    api_router.include_router(get_stripe_router())
    logger.info("Page Stripe Payments loaded")
except Exception as e:
    logger.warning(f"Failed to load Page Stripe Payments: {e}")

# Import and include Stripe integration router
try:
    from stripe_integration import stripe_router
    api_router.include_router(stripe_router)
    logger.info("Stripe integration router loaded")
except Exception as e:
    logger.warning(f"Failed to load Stripe integration: {e}")

# Stripe webhook endpoint (must be at app level, not api_router)
@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    import os
    
    # CRITICAL: Use STRIPE_SECRET_KEY (not STRIPE_API_KEY which may have system override)
    api_key = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY")
    
    # Ensure live key is used - read from environment only
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe API key not configured")
    
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        # Update payment status based on webhook event
        if webhook_response.payment_status == "paid":
            payment_txn = await db.payment_transactions.find_one(
                {"stripe_session_id": webhook_response.session_id}
            )
            
            await db.payment_transactions.update_one(
                {"stripe_session_id": webhook_response.session_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
            
            # Process commissions for marketplace sales
            if payment_txn and payment_txn.get("seller_id"):
                try:
                    from referral_system import process_sale_commissions
                    sale_id = payment_txn.get("order_id") or f"sale_{uuid.uuid4().hex[:12]}"
                    await process_sale_commissions(
                        sale_id=sale_id,
                        sale_amount=float(payment_txn.get("amount", 0)),
                        seller_id=payment_txn["seller_id"]
                    )
                    logger.info(f"Commissions processed for payment {webhook_response.session_id}")
                except Exception as comm_err:
                    logger.error(f"Commission processing error: {comm_err}")
        
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
    from diamond_withdrawal_system import diamond_router, withdrawal_router, kyc_router, reassignment_router, admin_withdrawal_router
    from notifications_system import notifications_router
    api_router.include_router(referral_router)
    api_router.include_router(diamond_router)
    api_router.include_router(withdrawal_router)
    api_router.include_router(kyc_router)
    api_router.include_router(reassignment_router)
    api_router.include_router(admin_withdrawal_router)
    api_router.include_router(notifications_router)
    logger.info("Referral, Diamond, Withdrawal, KYC, Reassignment, Admin Withdrawal, and Notifications routers loaded")
except ImportError as e:
    logger.warning(f"Could not load referral/diamond systems: {e}")

# Import and include production admin system routers
try:
    from admin_auth_system import admin_auth_router, admin_realtime_router
    from admin_core_system import (
        admin_users_router, admin_finance_router, admin_genealogy_router,
        admin_content_router, admin_roles_router, admin_system_router
    )
    from admin_notifications import admin_notifications_router
    from admin_otp_auth import secure_admin_router
    from admin_security_routes import admin_security_router
    from admin_orphan_diamond import admin_orphans_router, admin_diamonds_router
    from reactions_system import reactions_router
    from orphan_assignment_system import orphan_router
    api_router.include_router(admin_auth_router)
    api_router.include_router(secure_admin_router)
    api_router.include_router(admin_users_router)
    api_router.include_router(admin_finance_router)
    api_router.include_router(admin_genealogy_router)
    api_router.include_router(admin_content_router)
    api_router.include_router(admin_roles_router)
    api_router.include_router(admin_system_router)
    api_router.include_router(admin_notifications_router)
    api_router.include_router(admin_security_router)
    api_router.include_router(admin_orphans_router)
    api_router.include_router(admin_diamonds_router)
    api_router.include_router(reactions_router)
    api_router.include_router(orphan_router)
    # WebSocket router needs to be on the app directly
    app.include_router(admin_realtime_router, prefix="/api")
    logger.info("Production Admin System routers loaded (Auth, Secure OTP, Users, Finance, Genealogy, Content, Roles, System, Notifications, Security, Orphans, Diamonds, Reactions, OrphanSystem)")
except ImportError as e:
    logger.warning(f"Could not load production admin system: {e}")

# NFT/Blockchain features removed - using internal minting system instead

# Load Internal Minting System
try:
    from minting_routes import minting_router, setup_minting_routes
    api_router.include_router(minting_router)
    setup_minting_routes(db)
    logger.info("Internal Minting System loaded (Photo/Video/Music collectibles)")
except ImportError as e:
    logger.warning(f"Could not load minting routes: {e}")

# Load Photo Game System
try:
    from game_routes import game_router, setup_game_routes
    api_router.include_router(game_router)
    setup_game_routes(db)
    logger.info("Photo Game System loaded (Battles, Leaderboards, XP)")
except ImportError as e:
    logger.warning(f"Could not load game routes: {e}")

# Load Marketplace System
try:
    from marketplace_routes import marketplace_router, setup_marketplace_routes
    api_router.include_router(marketplace_router)
    setup_marketplace_routes(db)
    logger.info("Marketplace System loaded (Sales, Offers, Auctions)")
except ImportError as e:
    logger.warning(f"Could not load marketplace routes: {e}")

# Load BL Rewards System
try:
    from bl_rewards import init_reward_service
    init_reward_service(db)
    logger.info("BL Rewards System loaded (Content rewards, Downline bonuses)")
except ImportError as e:
    logger.warning(f"Could not load BL rewards: {e}")

# Load Shipping System
try:
    from shipping_system import shipping_router
    api_router.include_router(shipping_router)
    logger.info("Shipping System loaded (Shippo integration)")
except ImportError as e:
    logger.warning(f"Could not load shipping system: {e}")

# Load Cart & Orders System
try:
    from cart_orders import cart_router, orders_router
    api_router.include_router(cart_router)
    api_router.include_router(orders_router)
    logger.info("Cart & Orders System loaded (Guest checkout, Order management)")
except ImportError as e:
    logger.warning(f"Could not load cart/orders system: {e}")

# Load Subscription & Ranked System
try:
    from subscription_tiers import subscription_router, setup_subscription_routes
    api_router.include_router(subscription_router)
    setup_subscription_routes(db)
    logger.info("Subscription System loaded (Tiers, Daily Bonuses, Ranked, Tournaments)")
except ImportError as e:
    logger.warning(f"Could not load subscription routes: {e}")

# Load Admin Membership System
try:
    from admin_membership_system import admin_membership_router
    api_router.include_router(admin_membership_router)
    logger.info("Admin Membership System loaded (Tier Management, Promo Codes, Transaction Monitoring)")
except ImportError as e:
    logger.warning(f"Could not load admin membership system: {e}")

# Load Subscription Scheduler for recurring payments
try:
    from subscription_scheduler import (
        start_subscription_scheduler, 
        get_scheduler_status,
        trigger_renewal_check,
        trigger_retry_check
    )
    
    # Create admin endpoints for scheduler management
    @api_router.get("/admin/subscription-scheduler/status")
    async def get_subscription_scheduler_status():
        """Get status of subscription scheduler"""
        return get_scheduler_status()
    
    @api_router.post("/admin/subscription-scheduler/trigger-renewals")
    async def admin_trigger_renewals():
        """Manually trigger subscription renewal check"""
        result = await trigger_renewal_check()
        return {"success": True, "result": result}
    
    @api_router.post("/admin/subscription-scheduler/trigger-retries")
    async def admin_trigger_retries():
        """Manually trigger payment retry check"""
        result = await trigger_retry_check()
        return {"success": True, "result": result}
    
    # Start scheduler on app startup
    @app.on_event("startup")
    async def start_subscription_scheduler_on_startup():
        start_subscription_scheduler()
        logger.info("Subscription scheduler started")
    
    logger.info("Subscription Scheduler loaded (Recurring Payments, Retries, Notifications)")
except ImportError as e:
    logger.warning(f"Could not load subscription scheduler: {e}")

# Load Suspicious Transaction Detector
try:
    from suspicious_transaction_detector import (
        scan_recent_transactions,
        get_detection_rules,
        update_detection_rule,
        analyze_transaction,
        flag_transaction,
        get_fraud_analytics,
        calculate_user_risk_score,
        batch_calculate_risk_scores
    )
    
    @api_router.get("/admin/fraud-detection/rules")
    async def get_fraud_detection_rules():
        """Get current fraud detection rules configuration"""
        rules = await get_detection_rules()
        return {"rules": rules}
    
    @api_router.put("/admin/fraud-detection/rules/{rule_id}")
    async def update_fraud_rule(rule_id: str, updates: dict):
        """Update a fraud detection rule"""
        result = await update_detection_rule(rule_id, updates)
        return result
    
    @api_router.post("/admin/fraud-detection/scan")
    async def trigger_fraud_scan(hours: int = 24):
        """Manually trigger a fraud detection scan on recent transactions"""
        result = await scan_recent_transactions(hours)
        return {"success": True, "result": result}
    
    @api_router.post("/admin/fraud-detection/analyze/{transaction_id}")
    async def analyze_single_transaction(transaction_id: str):
        """Analyze a specific transaction for fraud indicators"""
        # Get transaction from either collection
        txn = await db.bl_transactions.find_one({"transaction_id": transaction_id})
        if not txn:
            txn = await db.commission_history.find_one({"commission_id": transaction_id})
        if not txn:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
        from suspicious_transaction_detector import analyze_transaction as analyze_txn
        triggered_rules = await analyze_txn(txn)
        
        return {
            "transaction_id": transaction_id,
            "triggered_rules": triggered_rules,
            "is_suspicious": len(triggered_rules) > 0
        }
    
    @api_router.get("/admin/fraud-detection/analytics")
    async def get_fraud_analytics_endpoint(days: int = 30):
        """Get comprehensive fraud analytics and patterns"""
        analytics = await get_fraud_analytics(days)
        return analytics
    
    @api_router.get("/admin/fraud-detection/user-risk/{user_id}")
    async def get_user_risk_score(user_id: str):
        """Calculate and return risk score for a specific user"""
        result = await calculate_user_risk_score(user_id)
        return result
    
    @api_router.post("/admin/fraud-detection/batch-risk-scores")
    async def calculate_batch_risk_scores(limit: int = 100):
        """Calculate risk scores for recently active users"""
        result = await batch_calculate_risk_scores(limit)
        return {"success": True, "result": result}
    
    logger.info("Suspicious Transaction Detector loaded (Auto-flagging, Fraud rules, Analytics)")
except ImportError as e:
    logger.warning(f"Could not load suspicious transaction detector: {e}")

# Load Mobile Sync Verification System
try:
    from mobile_sync_system import mobile_sync_router
    api_router.include_router(mobile_sync_router)
    logger.info("Mobile Sync System loaded (API Compatibility, Health Checks)")
except ImportError as e:
    logger.warning(f"Could not load mobile sync system: {e}")

# Load Marketplace Offers System
try:
    from marketplace_offers import offer_router
    api_router.include_router(offer_router)
    logger.info("Marketplace Offers System loaded (Make an Offer, Counter-offers, Deposits)")
except ImportError as e:
    logger.warning(f"Could not load marketplace offers system: {e}")

# Load Auction System
try:
    from auction_system import auction_router
    api_router.include_router(auction_router)
    logger.info("Auction System loaded (Bidding, Auto-extend, Real-time updates)")
except ImportError as e:
    logger.warning(f"Could not load auction system: {e}")

# Load WebSocket Notifications
try:
    from websocket_notifications import ws_manager, WebSocketNotification, NotificationType
    from fastapi import WebSocket, WebSocketDisconnect
    
    @app.websocket("/api/ws/{token}")
    async def websocket_endpoint(websocket: WebSocket, token: str):
        """WebSocket endpoint for real-time notifications"""
        try:
            # Verify token
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("user_id")
            if not user_id:
                await websocket.close(code=1008, reason="Invalid token")
                return
            
            await ws_manager.connect(websocket, user_id)
            
            try:
                while True:
                    # Keep connection alive and handle incoming messages
                    data = await websocket.receive_json()
                    
                    # Handle ping/pong
                    if data.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
                    
                    # Handle room subscriptions
                    elif data.get("type") == "subscribe_room":
                        room_id = data.get("room_id")
                        if room_id:
                            # Join room logic handled by manager
                            pass
                            
            except WebSocketDisconnect:
                pass
            finally:
                await ws_manager.disconnect(websocket, user_id)
                
        except JWTError:
            await websocket.close(code=1008, reason="Invalid token")
    
    @api_router.get("/ws/status")
    async def get_websocket_status():
        """Get WebSocket connection stats"""
        return ws_manager.get_stats()
    
    logger.info("WebSocket Notifications loaded")
except Exception as e:
    logger.warning(f"Could not load WebSocket system: {e}")

# Load Auction Bidding WebSocket
try:
    from auction_websocket import auction_manager
    from fastapi import WebSocket, WebSocketDisconnect
    
    @app.websocket("/api/ws/auction/{room_id}/{token}")
    async def auction_websocket_endpoint(websocket: WebSocket, room_id: str, token: str):
        """WebSocket endpoint for real-time auction bidding"""
        import jwt
        
        # Verify token
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("user_id") or payload.get("sub")
        except jwt.ExpiredSignatureError:
            await websocket.close(code=1008, reason="Token expired")
            return
        except jwt.InvalidTokenError:
            await websocket.close(code=1008, reason="Invalid token")
            return
        
        await websocket.accept()
        
        try:
            while True:
                data = await websocket.receive_json()
                action = data.get("action")
                
                if action == "join":
                    # Join the auction room
                    photo = data.get("photo", {})
                    stats = data.get("stats", {})
                    opponent_photo = data.get("opponent_photo", {})
                    opponent_stats = data.get("opponent_stats", {})
                    
                    success = await auction_manager.join_room(
                        room_id, user_id, websocket,
                        photo, stats, opponent_photo, opponent_stats
                    )
                    
                    await websocket.send_json({
                        "type": "join_result",
                        "success": success,
                        "room_id": room_id,
                        "user_id": user_id,
                    })
                
                elif action == "ready":
                    await auction_manager.player_ready(room_id, user_id)
                
                elif action == "tap":
                    tap_count = data.get("count", 1)
                    await auction_manager.handle_tap(room_id, user_id, tap_count)
                
                elif action == "ping":
                    await websocket.send_json({"type": "pong"})
        
        except WebSocketDisconnect:
            await auction_manager.disconnect(user_id)
        except Exception as e:
            logger.error(f"Auction WebSocket error: {e}")
            await auction_manager.disconnect(user_id)
    
    logger.info("Auction Bidding WebSocket loaded")
except Exception as e:
    logger.warning(f"Could not load Auction WebSocket: {e}")

# Load Game Lobby WebSocket
try:
    from lobby_websocket import lobby_manager
    from fastapi import WebSocket, WebSocketDisconnect
    
    @app.websocket("/api/ws/lobby/{game_id}/{token}")
    async def lobby_websocket_endpoint(websocket: WebSocket, game_id: str, token: str):
        """WebSocket endpoint for real-time game lobby updates"""
        # Validate token
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("user_id")
            if not user_id:
                await websocket.close(code=1008, reason="Invalid token")
                return
        except jwt.ExpiredSignatureError:
            await websocket.close(code=1008, reason="Token expired")
            return
        except jwt.InvalidTokenError:
            await websocket.close(code=1008, reason="Invalid token")
            return
        
        await websocket.accept()
        logger.info(f"Lobby WS: Accepted connection for {user_id} to game {game_id}")
        await lobby_manager.connect(game_id, user_id, websocket)
        
        # Send confirmation to client
        try:
            await websocket.send_json({
                "type": "joined",
                "game_id": game_id,
                "user_id": user_id,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            logger.info(f"Lobby WS: Sent 'joined' confirmation to {user_id}")
        except Exception as e:
            logger.error(f"Lobby WS: Failed to send joined confirmation to {user_id}: {e}")
            await lobby_manager.disconnect(user_id)
            return
        
        try:
            while True:
                try:
                    data = await asyncio.wait_for(websocket.receive_json(), timeout=120)  # 2 minute timeout
                    logger.debug(f"Lobby WS: Received message from {user_id}: {data.get('type', 'unknown')}")
                except asyncio.TimeoutError:
                    # Send ping to keep connection alive
                    try:
                        await websocket.send_json({"type": "ping"})
                        continue
                    except Exception:
                        logger.warning(f"Lobby WS: Failed to send ping to {user_id}, connection may be dead")
                        break
                
                msg_type = data.get("type")
                
                if msg_type == "ping":
                    await websocket.send_json({"type": "pong", "timestamp": datetime.now(timezone.utc).isoformat()})
                elif msg_type == "pong":
                    # Client responded to our ping - connection is alive
                    pass
                elif msg_type == "ready":
                    # Player ready via WebSocket - sync with API state
                    logger.info(f"Player {user_id} sent ready via WebSocket for game {game_id}")
                    # Just acknowledge - actual ready state is handled by API
                    await websocket.send_json({"type": "ready_ack", "success": True})
                else:
                    # Log unknown message types for debugging
                    logger.debug(f"Lobby WS unhandled message type: {msg_type}")
                    
        except WebSocketDisconnect as e:
            logger.info(f"Lobby WS: Player {user_id} disconnected (WebSocketDisconnect code={getattr(e, 'code', 'unknown')})")
            await lobby_manager.disconnect(user_id)
        except Exception as e:
            logger.error(f"Lobby WebSocket error for {user_id}: {type(e).__name__}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            await lobby_manager.disconnect(user_id)
    
    logger.info("Game Lobby WebSocket loaded")
except Exception as e:
    logger.warning(f"Could not load Game Lobby WebSocket: {e}")

# Load PVP Game WebSocket (Real-time synchronized gameplay)
try:
    from pvp_game_websocket import pvp_game_manager, PVPGameRoom
    from fastapi import WebSocket, WebSocketDisconnect
    
    # Set database for PVP manager
    pvp_game_manager.set_db(db)
    
    @app.websocket("/api/ws/pvp-game/{room_id}/{token}")
    async def pvp_game_websocket_endpoint(websocket: WebSocket, room_id: str, token: str):
        """WebSocket endpoint for real-time synchronized PVP gameplay"""
        # Validate token
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("user_id")
            if not user_id:
                await websocket.close(code=1008, reason="Invalid token")
                return
        except jwt.ExpiredSignatureError:
            await websocket.close(code=1008, reason="Token expired")
            return
        except jwt.InvalidTokenError:
            await websocket.close(code=1008, reason="Invalid token")
            return
        
        await websocket.accept()
        
        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "room_id": room_id,
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        try:
            while True:
                try:
                    data = await asyncio.wait_for(websocket.receive_json(), timeout=120)  # 2 minute timeout
                except asyncio.TimeoutError:
                    # Send ping to keep connection alive
                    try:
                        await websocket.send_json({"type": "ping", "timestamp": datetime.now(timezone.utc).isoformat()})
                        continue
                    except Exception:
                        logger.warning(f"PVP WS: Failed to send ping to {user_id}, connection may be dead")
                        break
                
                msg_type = data.get("type")
                
                if msg_type == "join":
                    # Player joining the game room
                    photos = data.get("photos", [])
                    username = data.get("username", "Player")
                    is_creator = data.get("is_creator", False)
                    is_reconnect = data.get("is_reconnect", False)
                    game_id = data.get("game_id")  # Optional - for auto-creating room
                    
                    # Auto-create room if it doesn't exist (for late joiners)
                    if room_id not in pvp_game_manager.rooms:
                        logger.info(f"Room {room_id} not found, creating on-demand for game_id={game_id}")
                        try:
                            pvp_game_manager.rooms[room_id] = PVPGameRoom(
                                room_id=room_id,
                                game_id=game_id or room_id,
                            )
                            logger.info(f"Successfully created on-demand room {room_id}")
                        except Exception as room_create_err:
                            logger.error(f"Failed to create on-demand room {room_id}: {room_create_err}")
                    
                    try:
                        success = await pvp_game_manager.connect_player(
                            room_id=room_id,
                            user_id=user_id,
                            username=username,
                            websocket=websocket,
                            photos=photos,
                            is_creator=is_creator,
                            is_reconnect=is_reconnect
                        )
                        logger.info(f"connect_player result for {user_id} in room {room_id}: {success}")
                    except Exception as connect_err:
                        logger.error(f"Exception in connect_player for {user_id} in room {room_id}: {connect_err}")
                        success = False
                    
                    await websocket.send_json({
                        "type": "join_result",
                        "success": success,
                        "room_id": room_id,
                        "error": None if success else "Failed to join game room"
                    })
                
                elif msg_type == "reconnect":
                    # Player reconnecting to existing game room
                    success = await pvp_game_manager.reconnect_player(
                        room_id=room_id,
                        user_id=user_id,
                        websocket=websocket
                    )
                    
                    await websocket.send_json({
                        "type": "reconnect_result",
                        "success": success,
                        "room_id": room_id,
                    })
                    
                elif msg_type == "select_photo":
                    # Player selects photo for current round
                    photo_id = data.get("photo_id")
                    await pvp_game_manager.select_photo(room_id, user_id, photo_id)
                    
                elif msg_type == "rps_choice":
                    # FIXED: Server-authoritative RPS choice submission
                    # Player submits their Rock-Paper-Scissors choice and bid
                    choice = data.get("choice")  # 'rock', 'paper', or 'scissors'
                    bid = data.get("bid", 1_000_000)  # Default to minimum bid
                    logger.info(f"[RPS] Player {user_id} submitted choice={choice}, bid={bid}")
                    await pvp_game_manager.submit_rps_choice(room_id, user_id, choice, bid)
                    
                elif msg_type == "ready":
                    # Player marks ready
                    await pvp_game_manager.mark_ready(room_id, user_id)
                    
                elif msg_type == "tap":
                    # Player tap during auction round
                    tap_count = data.get("count", 1)
                    await pvp_game_manager.handle_tap(room_id, user_id, tap_count)
                    
                elif msg_type == "round_result":
                    # Round result submitted (from gameplay component)
                    winner_id = data.get("winner_user_id")
                    p1_score = data.get("player1_score", 0)
                    p2_score = data.get("player2_score", 0)
                    round_data = data.get("round_data", {})
                    
                    await pvp_game_manager.submit_round_result(
                        room_id, winner_id, p1_score, p2_score, round_data
                    )
                    
                elif msg_type == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                elif msg_type == "pong":
                    # Client responded to our ping - connection is alive
                    pass
                    
        except WebSocketDisconnect as e:
            logger.info(f"PVP WS: Player {user_id} disconnected (WebSocketDisconnect code={getattr(e, 'code', 'unknown')})")
            try:
                await pvp_game_manager.disconnect_player(user_id)
            except Exception as disc_err:
                logger.error(f"Error during disconnect cleanup: {disc_err}")
        except Exception as e:
            logger.error(f"PVP Game WebSocket error for {user_id}: {type(e).__name__}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            try:
                await pvp_game_manager.disconnect_player(user_id)
            except Exception as disc_err:
                logger.error(f"Error during disconnect cleanup: {disc_err}")
    
    logger.info("PVP Game WebSocket loaded")
    
    # Spectator WebSocket endpoint
    @app.websocket("/api/ws/spectate/{room_id}/{token}")
    async def spectator_websocket_endpoint(websocket: WebSocket, room_id: str, token: str):
        """WebSocket endpoint for spectating PVP games"""
        # Validate token
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("user_id")
            username = payload.get("username", "Spectator")
            if not user_id:
                await websocket.close(code=1008, reason="Invalid token")
                return
        except jwt.ExpiredSignatureError:
            await websocket.close(code=1008, reason="Token expired")
            return
        except jwt.InvalidTokenError:
            await websocket.close(code=1008, reason="Invalid token")
            return
        
        # Get username from database if not in token
        if username == "Spectator":
            user = await db.users.find_one({"user_id": user_id}, {"username": 1})
            if user:
                username = user.get("username", "Spectator")
        
        await websocket.accept()
        
        # Try to connect as spectator
        success = await pvp_game_manager.connect_spectator(
            room_id=room_id,
            user_id=user_id,
            username=username,
            websocket=websocket
        )
        
        if not success:
            await websocket.send_json({
                "type": "error",
                "message": "Could not join as spectator. Game may not exist or not allow spectators.",
                "timestamp": datetime.now(timezone.utc).isoformat()
            })
            await websocket.close(code=1008, reason="Cannot spectate")
            return
        
        # Send connection confirmation
        await websocket.send_json({
            "type": "spectator_connected",
            "room_id": room_id,
            "user_id": user_id,
            "username": username,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
        try:
            while True:
                data = await websocket.receive_json()
                msg_type = data.get("type")
                
                if msg_type == "ping":
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    })
                # Spectators can only receive, not send game commands
                    
        except WebSocketDisconnect:
            await pvp_game_manager.disconnect_spectator(user_id, room_id)
        except Exception as e:
            logger.error(f"Spectator WebSocket error: {e}")
            await pvp_game_manager.disconnect_spectator(user_id, room_id)
    
    # Live battles API endpoint
    @api_router.get("/photo-game/live-battles")
    async def get_live_battles():
        """Get list of ongoing PVP battles available for spectating"""
        battles = pvp_game_manager.get_live_battles()
        return {
            "battles": battles,
            "count": len(battles),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    logger.info("Spectator WebSocket and Live Battles API loaded")
    
except Exception as e:
    logger.warning(f"Could not load PVP Game WebSocket: {e}")

# Load Push Notifications
try:
    from push_notifications import push_router, setup_push_routes
    api_router.include_router(push_router)
    setup_push_routes(db)
    logger.info("Push Notifications loaded (Expo push tokens)")
except ImportError as e:
    logger.warning(f"Could not load push notifications: {e}")

# ============== URL PREVIEW UTILITY ==============
class URLPreviewRequest(BaseModel):
    url: str

@utils_router.post("/url-preview")
async def get_url_preview(data: URLPreviewRequest):
    """Fetch metadata from a URL for link preview cards"""
    import re
    from urllib.parse import urlparse
    
    url = data.url.strip()
    
    # Validate URL
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    
    try:
        parsed = urlparse(url)
        if not parsed.netloc:
            raise HTTPException(status_code=400, detail="Invalid URL")
        
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            response = await client.get(url, headers={
                'User-Agent': 'Mozilla/5.0 (compatible; BlendlinkBot/1.0)'
            })
            
            if response.status_code != 200:
                return {
                    "success": False,
                    "url": url,
                    "title": parsed.netloc,
                    "description": None,
                    "image": None,
                    "siteName": parsed.netloc
                }
            
            html = response.text
            
            # Extract metadata using regex (simpler than BeautifulSoup)
            def get_meta(property_name, content_attr="content"):
                patterns = [
                    rf'<meta[^>]*property=["\']og:{property_name}["\'][^>]*{content_attr}=["\']([^"\']+)["\']',
                    rf'<meta[^>]*{content_attr}=["\']([^"\']+)["\'][^>]*property=["\']og:{property_name}["\']',
                    rf'<meta[^>]*name=["\']twitter:{property_name}["\'][^>]*{content_attr}=["\']([^"\']+)["\']',
                    rf'<meta[^>]*{content_attr}=["\']([^"\']+)["\'][^>]*name=["\']twitter:{property_name}["\']',
                ]
                for pattern in patterns:
                    match = re.search(pattern, html, re.IGNORECASE)
                    if match:
                        return match.group(1)
                return None
            
            # Get title
            title = get_meta("title")
            if not title:
                title_match = re.search(r'<title[^>]*>([^<]+)</title>', html, re.IGNORECASE)
                title = title_match.group(1).strip() if title_match else parsed.netloc
            
            # Get description
            description = get_meta("description")
            if not description:
                desc_match = re.search(r'<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\']', html, re.IGNORECASE)
                if not desc_match:
                    desc_match = re.search(r'<meta[^>]*content=["\']([^"\']+)["\'][^>]*name=["\']description["\']', html, re.IGNORECASE)
                description = desc_match.group(1) if desc_match else None
            
            # Get image
            image = get_meta("image")
            if image and not image.startswith('http'):
                # Make relative URLs absolute
                if image.startswith('//'):
                    image = 'https:' + image
                elif image.startswith('/'):
                    image = f"{parsed.scheme}://{parsed.netloc}{image}"
            
            # Get site name
            site_name = get_meta("site_name") or parsed.netloc
            
            return {
                "success": True,
                "url": url,
                "title": title[:200] if title else parsed.netloc,
                "description": description[:300] if description else None,
                "image": image,
                "siteName": site_name
            }
            
    except httpx.TimeoutException:
        return {
            "success": False,
            "url": url,
            "title": urlparse(url).netloc,
            "description": None,
            "image": None,
            "siteName": urlparse(url).netloc,
            "error": "Request timed out"
        }
    except Exception as e:
        logger.error(f"URL preview error: {e}")
        return {
            "success": False,
            "url": url,
            "title": urlparse(url).netloc if url else "Unknown",
            "description": None,
            "image": None,
            "siteName": urlparse(url).netloc if url else "Unknown"
        }

# ============== LANGUAGE DETECTION ==============
# Country code to language mapping
COUNTRY_TO_LANGUAGE = {
    # English
    "US": "en", "GB": "en", "AU": "en", "CA": "en", "NZ": "en", "IE": "en",
    # European languages
    "ES": "es", "MX": "es", "AR": "es", "CO": "es", "CL": "es", "PE": "es",
    "FR": "fr", "BE": "fr", "CH": "fr",
    "DE": "de", "AT": "de",
    "IT": "it",
    "PT": "pt", "BR": "pt",
    "NL": "nl",
    "SE": "sv",
    "PL": "pl",
    "NO": "no",
    "DK": "da",
    "FI": "fi",
    "RO": "ro",
    "CZ": "cs",
    "GR": "el",
    "HU": "hu",
    "UA": "uk",
    "RU": "ru",
    "RS": "sr",
    "BG": "bg",
    "HR": "hr",
    "SK": "sk",
    "LT": "lt",
    "LV": "lv",
    "EE": "et",
    "SI": "sl",
    "LU": "lb",
    "MT": "mt",
    "IS": "is",
    "AL": "sq",
    "MK": "mk",
    "BA": "bs",
    "ME": "sr",  # Montenegro uses Serbian
    # Asian languages
    "CN": "zh-CN",
    "TW": "zh-TW",
    "HK": "zh-HK",
    "JP": "ja",
    "KR": "ko",
    "IN": "hi",
    "ID": "id",
    "PH": "tl",
    "MY": "ms",
    "TH": "th",
    "VN": "vi",
    "MN": "mn",
    "NP": "ne",
    "LK": "si",
    "PK": "ur",
    "BD": "bn",
    # Middle East
    "IL": "he",
    "SA": "ar", "AE": "ar", "EG": "ar", "MA": "ar",
    # Africa
    "ZA": "af",
}

@utils_router.get("/detect-language")
async def detect_language(request: Request):
    """Detect user's language based on IP geolocation"""
    # Get client IP
    forwarded = request.headers.get("X-Forwarded-For")
    client_ip = forwarded.split(",")[0].strip() if forwarded else request.client.host
    
    # Skip detection for localhost/private IPs
    if client_ip in ("127.0.0.1", "localhost") or client_ip.startswith(("10.", "192.168.", "172.")):
        return {
            "detected_country": "US",
            "detected_language": "en",
            "ip": client_ip,
            "source": "default"
        }
    
    try:
        # Use free ipapi.co service
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"https://ipapi.co/{client_ip}/json/")
            
            if response.status_code == 200:
                data = response.json()
                country_code = data.get("country_code", "US")
                language = COUNTRY_TO_LANGUAGE.get(country_code, "en")
                
                return {
                    "detected_country": country_code,
                    "detected_language": language,
                    "country_name": data.get("country_name"),
                    "ip": client_ip,
                    "source": "ipapi.co"
                }
    except Exception as e:
        logger.error(f"Language detection error: {e}")
    
    # Fallback to English
    return {
        "detected_country": "US",
        "detected_language": "en",
        "ip": client_ip,
        "source": "fallback"
    }

# Include utils router
api_router.include_router(utils_router)

app.include_router(api_router)

# Root-level health endpoint for Kubernetes health checks
# This must be at the root level (not under /api) for K8s probes
@app.get("/health")
async def kubernetes_health_check():
    """Root-level health check endpoint for Kubernetes liveness/readiness probes."""
    return {"status": "ok", "service": "blendlink-api", "timestamp": datetime.now(timezone.utc).isoformat()}

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== MONGODB PVP OPTIMIZATION STARTUP ==============
@app.on_event("startup")
async def startup_mongodb_pvp_optimizations():
    """Initialize MongoDB PVP optimizations on startup."""
    try:
        from mongodb_pvp_optimization import initialize_pvp_mongo_optimizations
        
        init_results = await initialize_pvp_mongo_optimizations(db)
        logger.info(f"MongoDB PVP Optimizations initialized: {init_results}")
        
        # Log index summary
        for collection, indexes in init_results.get("indexes_created", {}).items():
            logger.info(f"  {collection}: {len(indexes)} indexes")
        
        if init_results.get("change_streams_available"):
            logger.info("  ✅ Change streams available for real-time sync")
        else:
            logger.info("  ⚠️ Change streams not available, using polling fallback")
        
        if init_results.get("atomic_ops_ready"):
            logger.info("  ✅ Atomic operations ready")
            
    except Exception as e:
        logger.warning(f"MongoDB PVP optimization startup warning: {e}")
        # Non-fatal - app will still work with polling

@app.on_event("startup")
async def startup_member_pages_change_streams():
    """Initialize MongoDB Change Streams for Member Pages real-time sync."""
    try:
        from member_pages_system import start_change_streams
        await start_change_streams()
        logger.info("✅ Member Pages Change Streams initialized for real-time sync")
    except Exception as e:
        logger.warning(f"Member Pages change streams startup warning: {e}")
        # Non-fatal - WebSocket manual broadcasts will still work


@app.on_event("startup")
async def startup_report_scheduler():
    """Start the daily report email scheduler"""
    try:
        from report_scheduler import start_scheduler
        start_scheduler()
        logger.info("✅ Daily Report Email Scheduler started")
    except Exception as e:
        logger.warning(f"Daily Report Scheduler startup warning: {e}")

@app.on_event("startup")
async def startup_orphan_scheduler():
    """Start the orphan auto-assignment scheduler"""
    try:
        from orphan_scheduler import start_orphan_scheduler
        start_orphan_scheduler()
        logger.info("✅ Orphan Auto-Assignment Scheduler started (every 6h)")
    except Exception as e:
        logger.warning(f"Orphan Scheduler startup warning: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    # Stop orphan scheduler
    try:
        from orphan_scheduler import stop_orphan_scheduler
        stop_orphan_scheduler()
        logger.info("Orphan Scheduler stopped")
    except Exception as e:
        logger.warning(f"Orphan scheduler cleanup warning: {e}")
    
    # Stop report scheduler
    try:
        from report_scheduler import stop_scheduler
        stop_scheduler()
        logger.info("Daily Report Email Scheduler stopped")
    except Exception as e:
        logger.warning(f"Report scheduler cleanup warning: {e}")
    
    # Cleanup member pages change streams
    try:
        from member_pages_system import stop_change_streams
        await stop_change_streams()
        logger.info("Member Pages change streams stopped")
    except Exception as e:
        logger.warning(f"Member Pages change stream cleanup warning: {e}")
    
    # Cleanup PVP change streams if active
    try:
        from mongodb_pvp_optimization import get_change_stream_manager
        manager = get_change_stream_manager()
        if manager:
            await manager.stop_watching()
            logger.info("PVP Change streams stopped")
    except Exception as e:
        logger.warning(f"PVP change stream cleanup warning: {e}")
    
    client.close()
