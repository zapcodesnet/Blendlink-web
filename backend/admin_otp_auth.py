"""
Secure Admin OTP Authentication System for Blendlink
- Email-based OTP verification for admin login
- Separate authentication flow from regular users
- Rate limiting and brute force protection
- Audit logging for all auth attempts
"""

import os
import asyncio
import logging
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional
import uuid
import resend
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel, EmailStr

load_dotenv()

logger = logging.getLogger(__name__)

# Initialize Resend
resend.api_key = os.environ.get("RESEND_API_KEY")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")

# Get MongoDB connection from server
from server import db

# Router for secure admin auth
secure_admin_router = APIRouter(prefix="/admin-auth/secure", tags=["Secure Admin Auth"])

# ============== CONFIGURATION ==============

OTP_LENGTH = 6
OTP_EXPIRY_MINUTES = 5
MAX_OTP_ATTEMPTS = 5
OTP_COOLDOWN_SECONDS = 60  # Minimum time between OTP requests
MAX_FAILED_LOGINS = 5
LOCKOUT_DURATION_MINUTES = 30

# Platform owner's email for super admin
PLATFORM_OWNER_EMAIL = "blendlinknet@gmail.com"

# ============== MODELS ==============

class AdminLoginStep1(BaseModel):
    email: EmailStr
    password: str

class AdminLoginStep2(BaseModel):
    email: EmailStr
    otp_code: str
    session_token: str  # Token from step 1

class AdminOTPResend(BaseModel):
    email: EmailStr
    session_token: str

# ============== HELPER FUNCTIONS ==============

def generate_otp() -> str:
    """Generate a secure 6-digit OTP"""
    return ''.join([str(secrets.randbelow(10)) for _ in range(OTP_LENGTH)])

def generate_session_token() -> str:
    """Generate a secure session token for the auth flow"""
    return secrets.token_urlsafe(32)

def hash_otp(otp: str) -> str:
    """Hash OTP for secure storage"""
    return hashlib.sha256(otp.encode()).hexdigest()

async def send_otp_email(email: str, otp: str, admin_name: str = "Admin") -> bool:
    """Send OTP code via email using Resend"""
    try:
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; margin: 0; padding: 40px 20px;">
            <div style="max-width: 480px; margin: 0 auto; background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); border-radius: 16px; border: 1px solid #334155; overflow: hidden;">
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">🔐 Admin Verification</h1>
                </div>
                
                <!-- Content -->
                <div style="padding: 40px 30px;">
                    <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 20px;">Hello {admin_name},</p>
                    <p style="color: #94a3b8; font-size: 14px; margin: 0 0 30px;">Your one-time verification code for Blendlink Admin Panel is:</p>
                    
                    <!-- OTP Code -->
                    <div style="background: #1e293b; border: 2px solid #3b82f6; border-radius: 12px; padding: 25px; text-align: center; margin: 0 0 30px;">
                        <span style="font-family: 'Courier New', monospace; font-size: 36px; font-weight: 700; color: #3b82f6; letter-spacing: 8px;">{otp}</span>
                    </div>
                    
                    <p style="color: #94a3b8; font-size: 14px; margin: 0 0 10px;">⏱️ This code expires in <strong style="color: #f59e0b;">{OTP_EXPIRY_MINUTES} minutes</strong></p>
                    <p style="color: #64748b; font-size: 13px; margin: 0;">If you didn't request this code, please ignore this email and secure your account.</p>
                </div>
                
                <!-- Footer -->
                <div style="background: #0f172a; padding: 20px 30px; border-top: 1px solid #334155;">
                    <p style="color: #64748b; font-size: 12px; margin: 0; text-align: center;">
                        🛡️ Blendlink Security Team<br>
                        <span style="color: #475569;">This is an automated message. Do not reply.</span>
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        params = {
            "from": SENDER_EMAIL,
            "to": [email],
            "subject": f"🔐 Blendlink Admin Login Code: {otp}",
            "html": html_content
        }
        
        # Run sync SDK in thread to keep FastAPI non-blocking
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"OTP email sent to {email}, email_id: {result.get('id')}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send OTP email to {email}: {e}")
        return False

async def check_rate_limit(email: str, ip_address: str) -> tuple[bool, str]:
    """Check if user is rate limited"""
    # Check for lockout due to failed attempts
    lockout = await db.admin_lockouts.find_one({
        "email": email,
        "locked_until": {"$gt": datetime.now(timezone.utc).isoformat()}
    }, {"_id": 0})
    
    if lockout:
        remaining = (datetime.fromisoformat(lockout["locked_until"]) - datetime.now(timezone.utc)).seconds // 60
        return False, f"Account locked. Try again in {remaining} minutes."
    
    # Check OTP cooldown
    recent_otp = await db.admin_otp_requests.find_one({
        "email": email,
        "created_at": {"$gt": (datetime.now(timezone.utc) - timedelta(seconds=OTP_COOLDOWN_SECONDS)).isoformat()}
    }, {"_id": 0})
    
    if recent_otp:
        return False, f"Please wait {OTP_COOLDOWN_SECONDS} seconds before requesting another code."
    
    return True, ""

async def record_failed_attempt(email: str, ip_address: str, reason: str):
    """Record a failed login attempt"""
    await db.admin_failed_attempts.insert_one({
        "attempt_id": f"fail_{uuid.uuid4().hex[:12]}",
        "email": email,
        "ip_address": ip_address,
        "reason": reason,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Count recent failures
    recent_failures = await db.admin_failed_attempts.count_documents({
        "email": email,
        "created_at": {"$gt": (datetime.now(timezone.utc) - timedelta(minutes=30)).isoformat()}
    })
    
    if recent_failures >= MAX_FAILED_LOGINS:
        # Lock the account
        await db.admin_lockouts.update_one(
            {"email": email},
            {"$set": {
                "email": email,
                "locked_until": (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)).isoformat(),
                "reason": f"Too many failed attempts ({recent_failures})",
                "created_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        logger.warning(f"Admin account locked due to {recent_failures} failed attempts: {email}")
        
        # Trigger security alert notification
        try:
            from admin_notifications import notify_security_alert, AdminNotificationType
            await notify_security_alert(
                alert_type=AdminNotificationType.BRUTE_FORCE_DETECTED,
                title="🚨 Admin Account Locked",
                body=f"Account {email} locked after {recent_failures} failed login attempts from {ip_address}",
                data={"email": email, "ip_address": ip_address, "attempts": recent_failures}
            )
        except Exception as e:
            logger.error(f"Failed to send security alert: {e}")

# ============== API ENDPOINTS ==============

@secure_admin_router.post("/login/step1")
async def admin_login_step1(data: AdminLoginStep1, request: Request):
    """
    Step 1 of admin login: Verify credentials and send OTP
    Returns a session token to use in step 2
    """
    ip_address = request.client.host if request.client else "unknown"
    
    # Check rate limiting
    can_proceed, error_msg = await check_rate_limit(data.email, ip_address)
    if not can_proceed:
        raise HTTPException(status_code=429, detail=error_msg)
    
    logger.info(f"Admin login step 1 for: {data.email} from {ip_address}")
    
    # Find user by email
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        await record_failed_attempt(data.email, ip_address, "User not found")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user is admin
    if not user.get("is_admin"):
        await record_failed_attempt(data.email, ip_address, "Not an admin")
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify password
    import bcrypt
    stored_hash = user.get("password_hash") or user.get("password", "")
    
    try:
        if stored_hash.startswith("$2"):
            password_valid = bcrypt.checkpw(data.password.encode('utf-8'), stored_hash.encode('utf-8'))
        else:
            # Fallback for plain text (development only)
            password_valid = (data.password == stored_hash)
    except Exception as e:
        logger.error(f"Password verification error: {e}")
        password_valid = False
    
    if not password_valid:
        await record_failed_attempt(data.email, ip_address, "Invalid password")
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Generate OTP and session token
    otp_code = generate_otp()
    session_token = generate_session_token()
    otp_hash = hash_otp(otp_code)
    
    # Store OTP request
    await db.admin_otp_requests.insert_one({
        "request_id": f"otp_{uuid.uuid4().hex[:12]}",
        "email": data.email,
        "user_id": user.get("user_id"),
        "otp_hash": otp_hash,
        "session_token": session_token,
        "ip_address": ip_address,
        "attempts": 0,
        "verified": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)).isoformat()
    })
    
    # Send OTP via email
    admin_name = user.get("name", "Admin")
    email_sent = await send_otp_email(data.email, otp_code, admin_name)
    
    if not email_sent:
        # Log the OTP for development/debugging (remove in production)
        logger.warning(f"[DEV] OTP for {data.email}: {otp_code}")
    
    # Log audit event
    await db.admin_auth_audit.insert_one({
        "audit_id": f"audit_{uuid.uuid4().hex[:12]}",
        "email": data.email,
        "action": "otp_requested",
        "ip_address": ip_address,
        "user_agent": request.headers.get("user-agent", ""),
        "email_sent": email_sent,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": f"Verification code sent to {data.email}",
        "session_token": session_token,
        "expires_in": OTP_EXPIRY_MINUTES * 60,
        "email_masked": f"{data.email[:3]}***{data.email[data.email.index('@'):]}"
    }

@secure_admin_router.post("/login/step2")
async def admin_login_step2(data: AdminLoginStep2, request: Request):
    """
    Step 2 of admin login: Verify OTP and complete authentication
    Returns JWT token for admin session
    """
    ip_address = request.client.host if request.client else "unknown"
    
    logger.info(f"Admin login step 2 for: {data.email}")
    
    # Find the OTP request
    otp_request = await db.admin_otp_requests.find_one({
        "email": data.email,
        "session_token": data.session_token,
        "verified": False,
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
    }, {"_id": 0})
    
    if not otp_request:
        await record_failed_attempt(data.email, ip_address, "Invalid or expired session")
        raise HTTPException(status_code=401, detail="Invalid or expired verification session. Please start again.")
    
    # Check attempt count
    if otp_request.get("attempts", 0) >= MAX_OTP_ATTEMPTS:
        await record_failed_attempt(data.email, ip_address, "Too many OTP attempts")
        raise HTTPException(status_code=429, detail="Too many attempts. Please request a new code.")
    
    # Increment attempt counter
    await db.admin_otp_requests.update_one(
        {"session_token": data.session_token},
        {"$inc": {"attempts": 1}}
    )
    
    # Verify OTP
    otp_hash = hash_otp(data.otp_code)
    if otp_hash != otp_request.get("otp_hash"):
        remaining = MAX_OTP_ATTEMPTS - otp_request.get("attempts", 0) - 1
        await record_failed_attempt(data.email, ip_address, "Invalid OTP")
        raise HTTPException(
            status_code=401, 
            detail=f"Invalid verification code. {remaining} attempts remaining."
        )
    
    # Mark as verified
    await db.admin_otp_requests.update_one(
        {"session_token": data.session_token},
        {"$set": {"verified": True, "verified_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Get user and admin account
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    admin = await db.admin_accounts.find_one({"user_id": user.get("user_id")}, {"_id": 0})
    
    # Generate JWT token
    import jwt
    JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production")
    
    token_payload = {
        "user_id": user.get("user_id"),
        "email": data.email,
        "is_admin": True,
        "admin_id": admin.get("admin_id") if admin else None,
        "role": admin.get("role", "admin") if admin else "admin",
        "exp": datetime.now(timezone.utc) + timedelta(hours=8),
        "iat": datetime.now(timezone.utc),
        "type": "admin_session"
    }
    
    token = jwt.encode(token_payload, JWT_SECRET, algorithm="HS256")
    
    # Update last login
    await db.users.update_one(
        {"user_id": user.get("user_id")},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    if admin:
        await db.admin_accounts.update_one(
            {"admin_id": admin.get("admin_id")},
            {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Log successful auth
    await db.admin_auth_audit.insert_one({
        "audit_id": f"audit_{uuid.uuid4().hex[:12]}",
        "email": data.email,
        "action": "login_success",
        "ip_address": ip_address,
        "user_agent": request.headers.get("user-agent", ""),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Send admin login notification to other admins
    try:
        from admin_notifications import notify_admin_login
        await notify_admin_login(
            admin_id=admin.get("admin_id") if admin else user.get("user_id"),
            admin_email=data.email,
            ip_address=ip_address,
            user_agent=request.headers.get("user-agent", "")
        )
    except Exception as e:
        logger.error(f"Failed to send admin login notification: {e}")
    
    # Clear any lockouts for this email
    await db.admin_lockouts.delete_many({"email": data.email})
    
    return {
        "success": True,
        "message": "Authentication successful",
        "token": token,
        "user": {
            "user_id": user.get("user_id"),
            "email": data.email,
            "name": user.get("name"),
            "is_admin": True,
            "role": admin.get("role", "admin") if admin else "admin",
            "avatar": user.get("avatar")
        }
    }

@secure_admin_router.post("/login/resend-otp")
async def resend_admin_otp(data: AdminOTPResend, request: Request):
    """Resend OTP code (with rate limiting)"""
    ip_address = request.client.host if request.client else "unknown"
    
    # Check rate limiting
    can_proceed, error_msg = await check_rate_limit(data.email, ip_address)
    if not can_proceed:
        raise HTTPException(status_code=429, detail=error_msg)
    
    # Verify session token exists
    otp_request = await db.admin_otp_requests.find_one({
        "email": data.email,
        "session_token": data.session_token,
        "verified": False
    }, {"_id": 0})
    
    if not otp_request:
        raise HTTPException(status_code=401, detail="Invalid session. Please start login again.")
    
    # Get user
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Generate new OTP
    new_otp = generate_otp()
    new_otp_hash = hash_otp(new_otp)
    
    # Update the OTP request
    await db.admin_otp_requests.update_one(
        {"session_token": data.session_token},
        {"$set": {
            "otp_hash": new_otp_hash,
            "attempts": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)).isoformat()
        }}
    )
    
    # Send new OTP
    admin_name = user.get("name", "Admin")
    email_sent = await send_otp_email(data.email, new_otp, admin_name)
    
    if not email_sent:
        logger.warning(f"[DEV] Resent OTP for {data.email}: {new_otp}")
    
    return {
        "success": True,
        "message": f"New verification code sent to {data.email}",
        "expires_in": OTP_EXPIRY_MINUTES * 60
    }

@secure_admin_router.get("/check-session")
async def check_admin_session(request: Request):
    """Check if current admin session is valid"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token provided")
    
    token = auth_header.replace("Bearer ", "")
    
    try:
        import jwt
        JWT_SECRET = os.environ.get("JWT_SECRET", "your-secret-key-change-in-production")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        
        if payload.get("type") != "admin_session" and not payload.get("is_admin"):
            raise HTTPException(status_code=403, detail="Not an admin session")
        
        return {
            "valid": True,
            "email": payload.get("email"),
            "role": payload.get("role"),
            "expires_at": datetime.fromtimestamp(payload.get("exp", 0), tz=timezone.utc).isoformat()
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session")
