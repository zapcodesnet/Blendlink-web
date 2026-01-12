"""
Simple Admin Password Authentication System for Blendlink
- Direct password-based login (no OTP/email)
- Single admin account with hardcoded credentials
- JWT token for session management
"""

import os
import logging
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import Optional
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request, Header
from pydantic import BaseModel, EmailStr
from jose import jwt, JWTError

load_dotenv()

logger = logging.getLogger(__name__)

# Get MongoDB connection from server
from server import db

# Router for secure admin auth
secure_admin_router = APIRouter(prefix="/admin-auth/secure", tags=["Secure Admin Auth"])

# ============== CONFIGURATION ==============

# Admin credentials (password is hashed)
ADMIN_EMAIL = "blendlinknet@gmail.com"
# Password: Blend!Admin2026Link
ADMIN_PASSWORD_HASH = bcrypt.hashpw("Blend!Admin2026Link".encode(), bcrypt.gensalt()).decode()

# JWT Configuration - Use same secret as main server
SECRET_KEY = os.environ.get("JWT_SECRET", os.environ.get("SECRET_KEY", "blendlink-secret-key-2026"))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# ============== MODELS ==============

class AdminLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    success: bool
    token: str
    user: dict
    message: str

# ============== HELPER FUNCTIONS ==============

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    try:
        return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> Optional[dict]:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError as e:
        logger.warning(f"Token verification failed: {e}")
        return None

# ============== ENDPOINTS ==============

@secure_admin_router.post("/login")
async def admin_login(credentials: AdminLogin, request: Request):
    """
    Simple password-based admin login
    - No OTP required
    - Returns JWT token on success
    """
    email = credentials.email.lower().strip()
    password = credentials.password
    
    # Log attempt
    client_ip = request.client.host if request.client else "unknown"
    logger.info(f"Admin login attempt from {client_ip} for {email}")
    
    # Verify credentials
    if email != ADMIN_EMAIL:
        logger.warning(f"Admin login failed: Invalid email {email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check password
    if not verify_password(password, ADMIN_PASSWORD_HASH):
        logger.warning(f"Admin login failed: Invalid password for {email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Get or create admin user in database
    admin_user = await db.users.find_one({"email": ADMIN_EMAIL})
    if not admin_user:
        # Create admin user if doesn't exist
        admin_user = {
            "user_id": f"admin_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}",
            "email": ADMIN_EMAIL,
            "name": "Super Admin",
            "is_admin": True,
            "role": "super_admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(admin_user)
        logger.info(f"Created admin user: {ADMIN_EMAIL}")
    else:
        # Ensure admin flag is set
        if not admin_user.get("is_admin"):
            await db.users.update_one(
                {"email": ADMIN_EMAIL},
                {"$set": {"is_admin": True, "role": "super_admin"}}
            )
    
    # Create JWT token
    token_data = {
        "user_id": admin_user.get("user_id", "admin"),
        "email": ADMIN_EMAIL,
        "role": "super_admin",
        "is_admin": True,
    }
    token = create_access_token(token_data)
    
    # Log successful login
    await db.admin_audit_logs.insert_one({
        "action": "admin_login",
        "admin_email": ADMIN_EMAIL,
        "ip_address": client_ip,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "success": True,
    })
    
    logger.info(f"Admin login successful for {email}")
    
    return {
        "success": True,
        "token": token,
        "user": {
            "user_id": admin_user.get("user_id", "admin"),
            "email": ADMIN_EMAIL,
            "name": admin_user.get("name", "Super Admin"),
            "role": "super_admin",
            "is_admin": True,
        },
        "message": "Login successful"
    }

@secure_admin_router.get("/check-session")
async def check_admin_session(authorization: Optional[str] = Header(None)):
    """
    Verify if current session/token is valid
    """
    if not authorization:
        raise HTTPException(status_code=401, detail="No token provided")
    
    # Extract token from "Bearer <token>" format
    token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
    
    # Verify token
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check if token is for admin
    if not payload.get("is_admin"):
        raise HTTPException(status_code=403, detail="Not an admin session")
    
    return {
        "valid": True,
        "user_id": payload.get("user_id"),
        "email": payload.get("email"),
        "role": payload.get("role", "super_admin"),
        "expires_at": datetime.fromtimestamp(payload.get("exp", 0), tz=timezone.utc).isoformat()
    }

@secure_admin_router.post("/logout")
async def admin_logout(authorization: Optional[str] = Header(None)):
    """
    Admin logout - invalidate session
    Note: With JWT, actual invalidation requires token blacklisting
    For simplicity, we just log the logout and client should clear the token
    """
    if authorization:
        token = authorization.replace("Bearer ", "") if authorization.startswith("Bearer ") else authorization
        payload = verify_token(token)
        if payload:
            await db.admin_audit_logs.insert_one({
                "action": "admin_logout",
                "admin_email": payload.get("email"),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
    
    return {"success": True, "message": "Logged out successfully"}


# ============== LEGACY ENDPOINTS (for backward compatibility) ==============
# These are kept to prevent 404 errors if old frontend code calls them

@secure_admin_router.post("/login/step1")
async def admin_login_step1_legacy(credentials: AdminLogin, request: Request):
    """Legacy endpoint - redirects to simple login"""
    # Just call the main login endpoint
    return await admin_login(credentials, request)

@secure_admin_router.post("/login/step2")
async def admin_login_step2_legacy():
    """Legacy OTP endpoint - no longer needed"""
    raise HTTPException(status_code=410, detail="OTP verification removed. Use /login endpoint directly.")

@secure_admin_router.post("/login/resend-otp")
async def admin_resend_otp_legacy():
    """Legacy resend OTP endpoint - no longer needed"""
    raise HTTPException(status_code=410, detail="OTP system removed. Use /login endpoint directly.")
