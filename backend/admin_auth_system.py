"""
Blendlink Production Admin System - Enhanced Security Module
============================================================
- Two-Factor Authentication (TOTP)
- Secure Admin Login Flow
- Rate Limiting & Brute Force Protection
- Session Management
- Real-Time WebSocket Broadcasting
- Complete Audit Trail
"""

from fastapi import APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any, Set
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import os
import hashlib
import hmac
import base64
import struct
import time
import json
import asyncio
import logging

# Import from main server
from server import get_current_user, db, logger, hash_password, verify_password, create_token

# Create routers
admin_auth_router = APIRouter(prefix="/admin-auth", tags=["Admin Authentication"])
admin_realtime_router = APIRouter(prefix="/admin-realtime", tags=["Admin Realtime"])

# ============== CONFIGURATION ==============

ADMIN_JWT_EXPIRY_HOURS = 4  # Shorter expiry for admin sessions
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 30
TOTP_ISSUER = "Blendlink Admin"
TOTP_DIGITS = 6
TOTP_INTERVAL = 30

# ============== ENUMS ==============

class AdminRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    CO_ADMIN = "co_admin"
    MODERATOR = "moderator"
    SUPPORT = "support"

class AdminAuditAction(str, Enum):
    # Authentication
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    TWO_FA_ENABLED = "2fa_enabled"
    TWO_FA_DISABLED = "2fa_disabled"
    TWO_FA_VERIFIED = "2fa_verified"
    PASSWORD_RESET = "password_reset"
    
    # User Management
    USER_VIEW = "user_view"
    USER_EDIT = "user_edit"
    USER_SUSPEND = "user_suspend"
    USER_UNSUSPEND = "user_unsuspend"
    USER_BAN = "user_ban"
    USER_UNBAN = "user_unban"
    USER_DELETE = "user_delete"
    USER_PASSWORD_RESET = "user_password_reset"
    USER_FORCE_LOGOUT = "user_force_logout"
    
    # Financial
    BALANCE_ADJUST = "balance_adjust"
    WITHDRAWAL_APPROVE = "withdrawal_approve"
    WITHDRAWAL_REJECT = "withdrawal_reject"
    COMMISSION_ADJUST = "commission_adjust"
    
    # Genealogy
    GENEALOGY_VIEW = "genealogy_view"
    GENEALOGY_REASSIGN = "genealogy_reassign"
    ORPHAN_ASSIGN = "orphan_assign"
    
    # Content Moderation
    CONTENT_VIEW_PRIVATE = "content_view_private"
    CONTENT_DELETE = "content_delete"
    CONTENT_RESTORE = "content_restore"
    REPORT_RESOLVE = "report_resolve"
    
    # Platform
    THEME_CHANGE = "theme_change"
    PAGE_CREATE = "page_create"
    PAGE_UPDATE = "page_update"
    PAGE_DELETE = "page_delete"
    SETTINGS_UPDATE = "settings_update"
    
    # Admin Management
    ADMIN_CREATE = "admin_create"
    ADMIN_UPDATE = "admin_update"
    ADMIN_DELETE = "admin_delete"
    PERMISSION_CHANGE = "permission_change"

# ============== MODELS ==============

class AdminPermissions(BaseModel):
    """Granular admin permissions"""
    # User Management
    view_users: bool = True
    edit_users: bool = False
    suspend_users: bool = False
    ban_users: bool = False
    delete_users: bool = False
    reset_user_passwords: bool = False
    force_logout_users: bool = False
    
    # Financial
    view_balances: bool = True
    adjust_bl_coins: bool = False
    adjust_usd_balance: bool = False
    view_transactions: bool = True
    approve_withdrawals: bool = False
    reject_withdrawals: bool = False
    adjust_commissions: bool = False
    
    # Genealogy
    view_genealogy: bool = True
    edit_genealogy: bool = False
    reassign_downlines: bool = False
    manage_orphans: bool = False
    
    # Content Moderation
    view_public_content: bool = True
    view_private_content: bool = False
    delete_content: bool = False
    restore_content: bool = False
    manage_reports: bool = False
    
    # Platform Configuration
    manage_themes: bool = False
    manage_pages: bool = False
    manage_settings: bool = False
    
    # Admin Management
    view_admins: bool = False
    create_admins: bool = False
    edit_admins: bool = False
    delete_admins: bool = False
    manage_permissions: bool = False
    
    # System
    view_audit_logs: bool = False
    view_analytics: bool = True
    view_system_health: bool = False
    use_ai_assistant: bool = False

class AdminAccount(BaseModel):
    """Admin account with 2FA support"""
    admin_id: str = Field(default_factory=lambda: f"admin_{uuid.uuid4().hex[:12]}")
    user_id: str
    email: str
    name: str
    role: AdminRole = AdminRole.MODERATOR
    permissions: AdminPermissions = Field(default_factory=AdminPermissions)
    
    # 2FA
    totp_secret: Optional[str] = None
    totp_enabled: bool = False
    totp_verified: bool = False
    backup_codes: List[str] = Field(default_factory=list)
    
    # Security
    is_active: bool = True
    is_locked: bool = False
    locked_until: Optional[str] = None
    login_attempts: int = 0
    last_login: Optional[str] = None
    last_login_ip: Optional[str] = None
    
    # Metadata
    created_by: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: Optional[str] = None

class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None

class AdminLoginResponse(BaseModel):
    success: bool
    requires_2fa: bool = False
    admin_token: Optional[str] = None
    admin: Optional[Dict] = None
    message: str

class Setup2FAResponse(BaseModel):
    secret: str
    qr_code_url: str
    backup_codes: List[str]

class Verify2FARequest(BaseModel):
    totp_code: str

class AuditLogEntry(BaseModel):
    log_id: str = Field(default_factory=lambda: f"audit_{uuid.uuid4().hex[:12]}")
    admin_id: str
    admin_email: str
    admin_name: str
    action: AdminAuditAction
    target_type: str
    target_id: Optional[str] = None
    details: Dict[str, Any] = {}
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# ============== TOTP FUNCTIONS ==============

def generate_totp_secret() -> str:
    """Generate a random TOTP secret"""
    return base64.b32encode(os.urandom(20)).decode('utf-8')

def get_totp_token(secret: str, time_step: int = None) -> str:
    """Generate TOTP token"""
    if time_step is None:
        time_step = int(time.time() // TOTP_INTERVAL)
    
    key = base64.b32decode(secret, casefold=True)
    msg = struct.pack(">Q", time_step)
    hmac_hash = hmac.new(key, msg, hashlib.sha1).digest()
    offset = hmac_hash[-1] & 0x0F
    code = struct.unpack(">I", hmac_hash[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(code % (10 ** TOTP_DIGITS)).zfill(TOTP_DIGITS)

def verify_totp(secret: str, code: str, window: int = 1) -> bool:
    """Verify TOTP code with time window"""
    current_time_step = int(time.time() // TOTP_INTERVAL)
    for i in range(-window, window + 1):
        if get_totp_token(secret, current_time_step + i) == code:
            return True
    return False

def generate_backup_codes(count: int = 10) -> List[str]:
    """Generate backup codes for 2FA recovery"""
    return [uuid.uuid4().hex[:8].upper() for _ in range(count)]

def get_totp_qr_url(email: str, secret: str) -> str:
    """Generate QR code URL for authenticator apps"""
    import urllib.parse
    label = urllib.parse.quote(f"{TOTP_ISSUER}:{email}")
    params = urllib.parse.urlencode({
        "secret": secret,
        "issuer": TOTP_ISSUER,
        "algorithm": "SHA1",
        "digits": TOTP_DIGITS,
        "period": TOTP_INTERVAL,
    })
    return f"otpauth://totp/{label}?{params}"

# ============== HELPER FUNCTIONS ==============

def get_client_ip(request: Request) -> str:
    """Get client IP address from request"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

async def log_admin_action(
    admin_id: str,
    admin_email: str,
    admin_name: str,
    action: AdminAuditAction,
    target_type: str,
    target_id: str = None,
    details: Dict = None,
    request: Request = None
):
    """Log admin action for audit trail"""
    log_entry = AuditLogEntry(
        admin_id=admin_id,
        admin_email=admin_email,
        admin_name=admin_name,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details or {},
        ip_address=get_client_ip(request) if request else None,
        user_agent=request.headers.get("User-Agent") if request else None,
    )
    
    await db.admin_audit_logs.insert_one(log_entry.dict())
    logger.info(f"ADMIN AUDIT: {admin_email} - {action.value} - {target_type}:{target_id}")
    
    # Broadcast to connected admin WebSockets
    await broadcast_admin_event({
        "type": "audit_log",
        "data": {
            "action": action.value,
            "admin": admin_email,
            "target": f"{target_type}:{target_id}",
            "timestamp": log_entry.timestamp,
        }
    })

async def get_admin_account(user_id: str) -> Optional[Dict]:
    """Get admin account by user_id"""
    return await db.admin_accounts.find_one({"user_id": user_id, "is_active": True}, {"_id": 0})

async def check_admin_permission(admin: Dict, permission: str) -> bool:
    """Check if admin has specific permission"""
    if admin.get("role") == AdminRole.SUPER_ADMIN.value:
        return True
    permissions = admin.get("permissions", {})
    return permissions.get(permission, False)

async def require_admin(current_user: dict = Depends(get_current_user)) -> Dict:
    """Dependency to require admin access"""
    admin = await get_admin_account(current_user["user_id"])
    if not admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    if admin.get("is_locked"):
        locked_until = admin.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > datetime.now(timezone.utc):
            raise HTTPException(status_code=403, detail="Account is locked")
    return {**admin, **current_user}

async def require_permission(permission: str):
    """Factory for permission requirement dependency"""
    async def check(admin: Dict = Depends(require_admin)):
        if not await check_admin_permission(admin, permission):
            raise HTTPException(status_code=403, detail=f"Permission denied: {permission}")
        return admin
    return check

# ============== WEBSOCKET CONNECTION MANAGER ==============

class AdminConnectionManager:
    """Manage WebSocket connections for real-time admin sync"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}  # admin_id -> websocket
        self.connection_info: Dict[str, Dict] = {}  # admin_id -> {email, role, connected_at}
    
    async def connect(self, websocket: WebSocket, admin_id: str, admin_email: str, role: str):
        await websocket.accept()
        self.active_connections[admin_id] = websocket
        self.connection_info[admin_id] = {
            "email": admin_email,
            "role": role,
            "connected_at": datetime.now(timezone.utc).isoformat(),
        }
        logger.info(f"Admin WebSocket connected: {admin_email}")
        
        # Notify other admins
        await self.broadcast({
            "type": "admin_connected",
            "data": {"admin_email": admin_email, "role": role}
        }, exclude=admin_id)
    
    def disconnect(self, admin_id: str):
        if admin_id in self.active_connections:
            info = self.connection_info.get(admin_id, {})
            del self.active_connections[admin_id]
            del self.connection_info[admin_id]
            logger.info(f"Admin WebSocket disconnected: {info.get('email', admin_id)}")
    
    async def send_personal(self, admin_id: str, message: dict):
        if admin_id in self.active_connections:
            try:
                await self.active_connections[admin_id].send_json(message)
            except Exception as e:
                logger.error(f"Failed to send to admin {admin_id}: {e}")
                self.disconnect(admin_id)
    
    async def broadcast(self, message: dict, exclude: str = None):
        """Broadcast message to all connected admins"""
        disconnected = []
        for admin_id, websocket in self.active_connections.items():
            if admin_id != exclude:
                try:
                    await websocket.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to broadcast to admin {admin_id}: {e}")
                    disconnected.append(admin_id)
        
        for admin_id in disconnected:
            self.disconnect(admin_id)
    
    def get_online_admins(self) -> List[Dict]:
        """Get list of currently online admins"""
        return [
            {"admin_id": aid, **info}
            for aid, info in self.connection_info.items()
        ]

# Global connection manager
admin_ws_manager = AdminConnectionManager()

async def broadcast_admin_event(event: dict):
    """Broadcast event to all connected admins"""
    await admin_ws_manager.broadcast(event)

# ============== AUTH ENDPOINTS ==============

@admin_auth_router.post("/login", response_model=AdminLoginResponse)
async def admin_login(request: Request, data: AdminLoginRequest):
    """
    Admin login with 2FA support
    - Separate from regular user login
    - Rate limited with lockout
    - Requires 2FA if enabled
    """
    logger.info(f"Admin login attempt for email: {data.email}")
    
    # Find user by email
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    logger.info(f"User lookup result: {user['user_id'] if user else 'Not found'}")
    if not user:
        return AdminLoginResponse(
            success=False,
            message="Invalid credentials"
        )
    
    # Check if user has admin account
    admin = await db.admin_accounts.find_one({"user_id": user["user_id"], "is_active": True}, {"_id": 0})
    logger.info(f"Admin lookup result: {admin['admin_id'] if admin else 'Not found'}")
    if not admin:
        return AdminLoginResponse(
            success=False,
            message="Admin access not granted"
        )
    
    # Check if account is locked
    if admin.get("is_locked"):
        locked_until = admin.get("locked_until")
        if locked_until:
            lock_time = datetime.fromisoformat(locked_until)
            if lock_time > datetime.now(timezone.utc):
                remaining = (lock_time - datetime.now(timezone.utc)).seconds // 60
                return AdminLoginResponse(
                    success=False,
                    message=f"Account locked. Try again in {remaining} minutes"
                )
            else:
                # Unlock account
                await db.admin_accounts.update_one(
                    {"admin_id": admin["admin_id"]},
                    {"$set": {"is_locked": False, "locked_until": None, "login_attempts": 0}}
                )
    
    # Verify password
    if not verify_password(data.password, user.get("password_hash", "")):
        # Increment login attempts
        attempts = admin.get("login_attempts", 0) + 1
        update_data = {"login_attempts": attempts}
        
        if attempts >= MAX_LOGIN_ATTEMPTS:
            lock_until = datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_DURATION_MINUTES)
            update_data["is_locked"] = True
            update_data["locked_until"] = lock_until.isoformat()
            
            await log_admin_action(
                admin["admin_id"], admin["email"], admin.get("name", ""),
                AdminAuditAction.LOGIN_FAILED, "auth", admin["admin_id"],
                {"reason": "max_attempts_reached", "locked_until": lock_until.isoformat()},
                request
            )
        
        await db.admin_accounts.update_one(
            {"admin_id": admin["admin_id"]},
            {"$set": update_data}
        )
        
        return AdminLoginResponse(
            success=False,
            message=f"Invalid credentials. {MAX_LOGIN_ATTEMPTS - attempts} attempts remaining"
        )
    
    # Check 2FA
    if admin.get("totp_enabled") and admin.get("totp_verified"):
        if not data.totp_code:
            return AdminLoginResponse(
                success=False,
                requires_2fa=True,
                message="2FA code required"
            )
        
        # Verify TOTP
        if not verify_totp(admin["totp_secret"], data.totp_code):
            # Check backup codes
            backup_codes = admin.get("backup_codes", [])
            if data.totp_code.upper() in backup_codes:
                # Remove used backup code
                backup_codes.remove(data.totp_code.upper())
                await db.admin_accounts.update_one(
                    {"admin_id": admin["admin_id"]},
                    {"$set": {"backup_codes": backup_codes}}
                )
            else:
                return AdminLoginResponse(
                    success=False,
                    requires_2fa=True,
                    message="Invalid 2FA code"
                )
    
    # Login successful
    now = datetime.now(timezone.utc)
    await db.admin_accounts.update_one(
        {"admin_id": admin["admin_id"]},
        {"$set": {
            "login_attempts": 0,
            "last_login": now.isoformat(),
            "last_login_ip": get_client_ip(request),
        }}
    )
    
    # Create admin token with shorter expiry
    token = create_token(user["user_id"], expiry_hours=ADMIN_JWT_EXPIRY_HOURS)
    
    # Log successful login
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.LOGIN_SUCCESS, "auth", admin["admin_id"],
        {"ip": get_client_ip(request)},
        request
    )
    
    # Return admin info (excluding sensitive data)
    admin_info = {
        "admin_id": admin["admin_id"],
        "user_id": admin["user_id"],
        "email": admin["email"],
        "name": admin.get("name", ""),
        "role": admin["role"],
        "permissions": admin.get("permissions", {}),
        "totp_enabled": admin.get("totp_enabled", False),
    }
    
    return AdminLoginResponse(
        success=True,
        admin_token=token,
        admin=admin_info,
        message="Login successful"
    )

@admin_auth_router.post("/logout")
async def admin_logout(request: Request, admin: Dict = Depends(require_admin)):
    """Admin logout with audit logging"""
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.LOGOUT, "auth", admin["admin_id"],
        {},
        request
    )
    
    # Disconnect WebSocket if connected
    admin_ws_manager.disconnect(admin["admin_id"])
    
    return {"success": True, "message": "Logged out successfully"}

@admin_auth_router.get("/me")
async def get_admin_profile(admin: Dict = Depends(require_admin)):
    """Get current admin profile"""
    return {
        "admin_id": admin["admin_id"],
        "user_id": admin["user_id"],
        "email": admin["email"],
        "name": admin.get("name", ""),
        "role": admin["role"],
        "permissions": admin.get("permissions", {}),
        "totp_enabled": admin.get("totp_enabled", False),
        "last_login": admin.get("last_login"),
    }

# ============== 2FA ENDPOINTS ==============

@admin_auth_router.post("/2fa/setup", response_model=Setup2FAResponse)
async def setup_2fa(request: Request, admin: Dict = Depends(require_admin)):
    """Setup 2FA for admin account"""
    if admin.get("totp_enabled") and admin.get("totp_verified"):
        raise HTTPException(status_code=400, detail="2FA is already enabled")
    
    # Generate new TOTP secret
    secret = generate_totp_secret()
    backup_codes = generate_backup_codes()
    
    # Store secret (not yet verified)
    await db.admin_accounts.update_one(
        {"admin_id": admin["admin_id"]},
        {"$set": {
            "totp_secret": secret,
            "totp_enabled": False,
            "totp_verified": False,
            "backup_codes": backup_codes,
        }}
    )
    
    qr_url = get_totp_qr_url(admin["email"], secret)
    
    return Setup2FAResponse(
        secret=secret,
        qr_code_url=qr_url,
        backup_codes=backup_codes
    )

@admin_auth_router.post("/2fa/verify")
async def verify_2fa_setup(request: Request, data: Verify2FARequest, admin: Dict = Depends(require_admin)):
    """Verify and enable 2FA"""
    admin_account = await db.admin_accounts.find_one({"admin_id": admin["admin_id"]}, {"_id": 0})
    
    if not admin_account.get("totp_secret"):
        raise HTTPException(status_code=400, detail="2FA setup not initiated")
    
    if not verify_totp(admin_account["totp_secret"], data.totp_code):
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Enable 2FA
    await db.admin_accounts.update_one(
        {"admin_id": admin["admin_id"]},
        {"$set": {
            "totp_enabled": True,
            "totp_verified": True,
        }}
    )
    
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.TWO_FA_ENABLED, "security", admin["admin_id"],
        {},
        request
    )
    
    return {"success": True, "message": "2FA enabled successfully"}

@admin_auth_router.post("/2fa/disable")
async def disable_2fa(request: Request, data: Verify2FARequest, admin: Dict = Depends(require_admin)):
    """Disable 2FA (requires current code)"""
    admin_account = await db.admin_accounts.find_one({"admin_id": admin["admin_id"]}, {"_id": 0})
    
    if not admin_account.get("totp_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    
    if not verify_totp(admin_account["totp_secret"], data.totp_code):
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Disable 2FA
    await db.admin_accounts.update_one(
        {"admin_id": admin["admin_id"]},
        {"$set": {
            "totp_enabled": False,
            "totp_verified": False,
            "totp_secret": None,
            "backup_codes": [],
        }}
    )
    
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.TWO_FA_DISABLED, "security", admin["admin_id"],
        {},
        request
    )
    
    return {"success": True, "message": "2FA disabled"}

@admin_auth_router.get("/2fa/backup-codes")
async def regenerate_backup_codes(request: Request, admin: Dict = Depends(require_admin)):
    """Regenerate backup codes"""
    admin_account = await db.admin_accounts.find_one({"admin_id": admin["admin_id"]}, {"_id": 0})
    
    if not admin_account.get("totp_enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled")
    
    backup_codes = generate_backup_codes()
    
    await db.admin_accounts.update_one(
        {"admin_id": admin["admin_id"]},
        {"$set": {"backup_codes": backup_codes}}
    )
    
    return {"backup_codes": backup_codes}

# ============== WEBSOCKET ENDPOINT ==============

@admin_realtime_router.websocket("/ws")
async def admin_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time admin synchronization
    Requires admin token in query params
    """
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Token required")
        return
    
    try:
        # Verify token and get user
        from server import decode_token
        payload = decode_token(token)
        user_id = payload.get("sub")
        
        # Get admin account
        admin = await get_admin_account(user_id)
        if not admin:
            await websocket.close(code=4003, reason="Admin access required")
            return
        
        # Connect
        await admin_ws_manager.connect(
            websocket,
            admin["admin_id"],
            admin["email"],
            admin["role"]
        )
        
        # Send initial state
        await websocket.send_json({
            "type": "connected",
            "data": {
                "admin_id": admin["admin_id"],
                "online_admins": admin_ws_manager.get_online_admins(),
            }
        })
        
        # Listen for messages
        while True:
            try:
                data = await websocket.receive_json()
                
                # Handle different message types
                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif data.get("type") == "get_online_admins":
                    await websocket.send_json({
                        "type": "online_admins",
                        "data": admin_ws_manager.get_online_admins()
                    })
                    
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
                break
                
    except Exception as e:
        logger.error(f"WebSocket auth error: {e}")
        await websocket.close(code=4001, reason="Authentication failed")
    finally:
        if admin:
            admin_ws_manager.disconnect(admin["admin_id"])

# ============== ONLINE ADMINS ENDPOINT ==============

@admin_auth_router.get("/online")
async def get_online_admins(admin: Dict = Depends(require_admin)):
    """Get list of currently online admins"""
    return {
        "online_admins": admin_ws_manager.get_online_admins(),
        "count": len(admin_ws_manager.active_connections)
    }
