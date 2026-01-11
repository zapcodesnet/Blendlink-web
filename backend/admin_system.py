"""
Blendlink Admin System Module
- Secure Admin Authentication
- Role-Based Access Control (RBAC)
- User Management & Moderation
- Theme Management (synced web + mobile)
- Genealogy Tree Visualization
- AI Assistant Integration
- Audit Logging
- Page/Screen Management
"""
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import os
import hashlib
import json

# Import from main server
from server import get_current_user, db, logger, hash_password, verify_password, create_token

# Create routers
admin_system_router = APIRouter(prefix="/admin-system", tags=["Admin System"])
theme_router = APIRouter(prefix="/themes", tags=["Themes"])
page_manager_router = APIRouter(prefix="/pages", tags=["Page Manager"])
genealogy_router = APIRouter(prefix="/genealogy", tags=["Genealogy"])
audit_router = APIRouter(prefix="/audit", tags=["Audit"])

# ============== ENUMS ==============

class AdminRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    CO_ADMIN = "co_admin"
    MODERATOR = "moderator"
    SUPPORT = "support"

class AuditAction(str, Enum):
    LOGIN = "login"
    VIEW_PRIVATE_CONTENT = "view_private_content"
    USER_SUSPEND = "user_suspend"
    USER_BAN = "user_ban"
    USER_DELETE = "user_delete"
    THEME_CHANGE = "theme_change"
    PAGE_MODIFY = "page_modify"
    GENEALOGY_MODIFY = "genealogy_modify"
    PERMISSION_CHANGE = "permission_change"
    AI_ASSIST_REQUEST = "ai_assist_request"

# ============== MODELS ==============

class AdminAccount(BaseModel):
    """Admin account with role-based permissions"""
    admin_id: str = Field(default_factory=lambda: f"admin_{uuid.uuid4().hex[:12]}")
    user_id: str  # Links to regular user account
    role: AdminRole = AdminRole.MODERATOR
    permissions: Dict[str, bool] = Field(default_factory=lambda: {
        "view_users": True,
        "edit_users": False,
        "delete_users": False,
        "suspend_users": True,
        "view_private_content": False,
        "manage_themes": False,
        "manage_pages": False,
        "manage_genealogy": False,
        "manage_admins": False,
        "view_audit_logs": False,
        "use_ai_assistant": False,
        "access_analytics": True,
        "manage_withdrawals": False,
    })
    created_by: Optional[str] = None
    is_active: bool = True
    last_login: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AuditLog(BaseModel):
    """Audit log for compliance tracking"""
    log_id: str = Field(default_factory=lambda: f"audit_{uuid.uuid4().hex[:12]}")
    admin_id: str
    admin_email: str
    action: AuditAction
    target_type: str  # user, content, theme, page, etc.
    target_id: str
    details: Dict[str, Any] = {}
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Theme(BaseModel):
    """Theme configuration"""
    theme_id: str = Field(default_factory=lambda: f"theme_{uuid.uuid4().hex[:12]}")
    name: str
    category: str  # dark, light, colorful, minimal, professional, etc.
    colors: Dict[str, str] = {}
    fonts: Dict[str, str] = {}
    styles: Dict[str, Any] = {}
    preview_image: Optional[str] = None
    is_premium: bool = False
    is_active: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PageConfig(BaseModel):
    """Page/Screen configuration for web and mobile"""
    page_id: str = Field(default_factory=lambda: f"page_{uuid.uuid4().hex[:12]}")
    name: str
    route: str  # Web route
    mobile_screen: str  # Mobile screen name
    icon: str
    order: int = 0
    is_visible: bool = True
    is_restricted: bool = False  # Requires special permission
    required_role: Optional[str] = None  # member, premium, admin, etc.
    custom_content: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class GenealogyNode(BaseModel):
    """Node in the genealogy tree"""
    user_id: str
    name: str
    email: str
    avatar: Optional[str] = None
    level: int = 0
    upline_id: Optional[str] = None
    direct_downlines: List[str] = []
    total_downline_count: int = 0
    bl_coins: float = 0
    joined_at: datetime
    is_active: bool = True

# ============== PERMISSION PRESETS ==============

ROLE_PERMISSIONS = {
    AdminRole.SUPER_ADMIN: {
        "view_users": True,
        "edit_users": True,
        "delete_users": True,
        "suspend_users": True,
        "view_private_content": True,
        "manage_themes": True,
        "manage_pages": True,
        "manage_genealogy": True,
        "manage_admins": True,
        "view_audit_logs": True,
        "use_ai_assistant": True,
        "access_analytics": True,
        "manage_withdrawals": True,
    },
    AdminRole.CO_ADMIN: {
        "view_users": True,
        "edit_users": True,
        "delete_users": False,
        "suspend_users": True,
        "view_private_content": True,
        "manage_themes": True,
        "manage_pages": True,
        "manage_genealogy": False,
        "manage_admins": False,
        "view_audit_logs": True,
        "use_ai_assistant": True,
        "access_analytics": True,
        "manage_withdrawals": True,
    },
    AdminRole.MODERATOR: {
        "view_users": True,
        "edit_users": False,
        "delete_users": False,
        "suspend_users": True,
        "view_private_content": True,
        "manage_themes": False,
        "manage_pages": False,
        "manage_genealogy": False,
        "manage_admins": False,
        "view_audit_logs": False,
        "use_ai_assistant": False,
        "access_analytics": True,
        "manage_withdrawals": False,
    },
    AdminRole.SUPPORT: {
        "view_users": True,
        "edit_users": False,
        "delete_users": False,
        "suspend_users": False,
        "view_private_content": False,
        "manage_themes": False,
        "manage_pages": False,
        "manage_genealogy": False,
        "manage_admins": False,
        "view_audit_logs": False,
        "use_ai_assistant": False,
        "access_analytics": False,
        "manage_withdrawals": False,
    },
}

# ============== HELPER FUNCTIONS ==============

async def get_admin_account(user_id: str) -> Optional[dict]:
    """Get admin account for user"""
    admin = await db.admins.find_one({"user_id": user_id, "is_active": True}, {"_id": 0})
    return admin

async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Require user to be an admin"""
    admin = await get_admin_account(current_user["user_id"])
    if not admin and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return {**current_user, "admin": admin}

async def require_permission(permission: str):
    """Factory for permission-based dependency"""
    async def check_permission(current_user: dict = Depends(require_admin)) -> dict:
        admin = current_user.get("admin")
        if admin:
            if not admin.get("permissions", {}).get(permission, False):
                # Check if super_admin (always has all permissions)
                if admin.get("role") != AdminRole.SUPER_ADMIN:
                    raise HTTPException(
                        status_code=403, 
                        detail=f"Permission '{permission}' required"
                    )
        return current_user
    return check_permission

async def log_audit(
    admin_id: str,
    admin_email: str,
    action: AuditAction,
    target_type: str,
    target_id: str,
    details: Dict[str, Any] = {},
    request: Optional[Request] = None
):
    """Log an audit entry"""
    log = AuditLog(
        admin_id=admin_id,
        admin_email=admin_email,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details,
        ip_address=request.client.host if request else None,
        user_agent=request.headers.get("user-agent") if request else None,
    )
    log_dict = log.model_dump()
    log_dict["created_at"] = log_dict["created_at"].isoformat()
    await db.audit_logs.insert_one(log_dict.copy())
    return log_dict

# ============== ADMIN AUTHENTICATION ==============

class AdminLoginRequest(BaseModel):
    email: str
    password: str
    admin_code: Optional[str] = None  # Optional 2FA or admin code

@admin_system_router.post("/login")
async def admin_login(data: AdminLoginRequest, request: Request):
    """Secure admin login"""
    # Find user
    user = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Verify password
    if not verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check if user is admin
    admin = await get_admin_account(user["user_id"])
    if not admin and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Update last login
    if admin:
        await db.admins.update_one(
            {"admin_id": admin["admin_id"]},
            {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
        )
    
    # Create token
    token = create_token(user["user_id"])
    
    # Log audit
    await log_audit(
        admin_id=admin["admin_id"] if admin else user["user_id"],
        admin_email=user["email"],
        action=AuditAction.LOGIN,
        target_type="admin_session",
        target_id=user["user_id"],
        request=request
    )
    
    return {
        "token": token,
        "user": {
            "user_id": user["user_id"],
            "email": user["email"],
            "name": user["name"],
            "avatar": user.get("avatar"),
            "is_admin": True,
        },
        "admin": admin or {"role": AdminRole.SUPER_ADMIN, "permissions": ROLE_PERMISSIONS[AdminRole.SUPER_ADMIN]},
    }

@admin_system_router.get("/me")
async def get_admin_profile(current_user: dict = Depends(require_admin)):
    """Get current admin profile and permissions"""
    admin = current_user.get("admin")
    return {
        "user": {
            "user_id": current_user["user_id"],
            "email": current_user["email"],
            "name": current_user["name"],
            "avatar": current_user.get("avatar"),
        },
        "admin": admin or {"role": AdminRole.SUPER_ADMIN, "permissions": ROLE_PERMISSIONS[AdminRole.SUPER_ADMIN]},
    }

# ============== ADMIN MANAGEMENT ==============

class CreateAdminRequest(BaseModel):
    user_id: str
    role: AdminRole = AdminRole.MODERATOR
    custom_permissions: Optional[Dict[str, bool]] = None

@admin_system_router.post("/admins")
async def create_admin(
    data: CreateAdminRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Create a new admin (super_admin only)"""
    admin = current_user.get("admin")
    if admin and admin.get("role") != AdminRole.SUPER_ADMIN and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Only super admins can create admins")
    
    # Check if user exists
    user = await db.users.find_one({"user_id": data.user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already admin
    existing = await db.admins.find_one({"user_id": data.user_id})
    if existing:
        raise HTTPException(status_code=400, detail="User is already an admin")
    
    # Create admin account
    permissions = data.custom_permissions or ROLE_PERMISSIONS.get(data.role, {})
    new_admin = AdminAccount(
        user_id=data.user_id,
        role=data.role,
        permissions=permissions,
        created_by=current_user["user_id"],
    )
    
    admin_dict = new_admin.model_dump()
    admin_dict["created_at"] = admin_dict["created_at"].isoformat()
    await db.admins.insert_one(admin_dict.copy())
    
    # Update user's is_admin flag
    await db.users.update_one(
        {"user_id": data.user_id},
        {"$set": {"is_admin": True}}
    )
    
    # Log audit
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.PERMISSION_CHANGE,
        target_type="admin",
        target_id=data.user_id,
        details={"action": "create", "role": data.role},
        request=request
    )
    
    return admin_dict

@admin_system_router.get("/admins")
async def list_admins(current_user: dict = Depends(require_admin)):
    """List all admin accounts"""
    admins = await db.admins.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    # Enrich with user data
    for admin in admins:
        user = await db.users.find_one({"user_id": admin["user_id"]}, {"_id": 0, "password_hash": 0})
        admin["user"] = user
    
    return admins

@admin_system_router.put("/admins/{admin_id}")
async def update_admin(
    admin_id: str,
    role: Optional[AdminRole] = None,
    permissions: Optional[Dict[str, bool]] = None,
    is_active: Optional[bool] = None,
    request: Request = None,
    current_user: dict = Depends(require_admin)
):
    """Update admin role/permissions"""
    admin = current_user.get("admin")
    if admin and admin.get("role") != AdminRole.SUPER_ADMIN and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Only super admins can modify admins")
    
    target_admin = await db.admins.find_one({"admin_id": admin_id}, {"_id": 0})
    if not target_admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    updates = {}
    if role is not None:
        updates["role"] = role
        updates["permissions"] = ROLE_PERMISSIONS.get(role, {})
    if permissions is not None:
        updates["permissions"] = permissions
    if is_active is not None:
        updates["is_active"] = is_active
        if not is_active:
            await db.users.update_one(
                {"user_id": target_admin["user_id"]},
                {"$set": {"is_admin": False}}
            )
    
    if updates:
        await db.admins.update_one({"admin_id": admin_id}, {"$set": updates})
    
    # Log audit
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.PERMISSION_CHANGE,
        target_type="admin",
        target_id=admin_id,
        details={"updates": updates},
        request=request
    )
    
    return {"message": "Admin updated", "updates": updates}

# ============== USER MANAGEMENT ==============

@admin_system_router.get("/users")
async def list_users(
    search: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(require_admin)
):
    """List all users with search/filter"""
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"username": {"$regex": search, "$options": "i"}},
        ]
    if status == "suspended":
        query["is_suspended"] = True
    elif status == "banned":
        query["is_banned"] = True
    elif status == "active":
        query["is_suspended"] = {"$ne": True}
        query["is_banned"] = {"$ne": True}
    
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents(query)
    
    return {
        "users": users,
        "total": total,
        "skip": skip,
        "limit": limit,
    }

@admin_system_router.get("/users/{user_id}")
async def get_user_details(
    user_id: str,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Get detailed user info including private data (with audit)"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get additional data
    posts_count = await db.posts.count_documents({"user_id": user_id})
    listings_count = await db.listings.count_documents({"user_id": user_id})
    referrals_count = await db.referral_relationships.count_documents({"referrer_id": user_id, "level": 1})
    
    # Log audit for viewing user data
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.VIEW_PRIVATE_CONTENT,
        target_type="user",
        target_id=user_id,
        details={"action": "view_profile"},
        request=request
    )
    
    return {
        **user,
        "stats": {
            "posts_count": posts_count,
            "listings_count": listings_count,
            "referrals_count": referrals_count,
        }
    }

class UserActionRequest(BaseModel):
    reason: Optional[str] = None
    duration_days: Optional[int] = None

@admin_system_router.post("/users/{user_id}/suspend")
async def suspend_user(
    user_id: str,
    data: UserActionRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Suspend a user temporarily"""
    admin = current_user.get("admin")
    if admin and not admin.get("permissions", {}).get("suspend_users", False):
        if admin.get("role") != AdminRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Permission denied")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    suspend_until = None
    if data.duration_days:
        suspend_until = (datetime.now(timezone.utc) + timedelta(days=data.duration_days)).isoformat()
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_suspended": True,
            "suspend_reason": data.reason,
            "suspend_until": suspend_until,
            "suspended_by": current_user["user_id"],
            "suspended_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    # Log audit
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.USER_SUSPEND,
        target_type="user",
        target_id=user_id,
        details={"reason": data.reason, "duration_days": data.duration_days},
        request=request
    )
    
    return {"message": "User suspended", "suspend_until": suspend_until}

@admin_system_router.post("/users/{user_id}/unsuspend")
async def unsuspend_user(
    user_id: str,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Remove suspension from user"""
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_suspended": False,
            "suspend_reason": None,
            "suspend_until": None,
        }}
    )
    
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.USER_SUSPEND,
        target_type="user",
        target_id=user_id,
        details={"action": "unsuspend"},
        request=request
    )
    
    return {"message": "User unsuspended"}

@admin_system_router.post("/users/{user_id}/ban")
async def ban_user(
    user_id: str,
    data: UserActionRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Permanently ban a user"""
    admin = current_user.get("admin")
    if admin and not admin.get("permissions", {}).get("delete_users", False):
        if admin.get("role") != AdminRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Permission denied")
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_banned": True,
            "ban_reason": data.reason,
            "banned_by": current_user["user_id"],
            "banned_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.USER_BAN,
        target_type="user",
        target_id=user_id,
        details={"reason": data.reason},
        request=request
    )
    
    return {"message": "User banned"}

@admin_system_router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Delete a user account (super_admin only)"""
    admin = current_user.get("admin")
    if admin and admin.get("role") != AdminRole.SUPER_ADMIN and not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Only super admins can delete users")
    
    # Soft delete - mark as deleted but keep data
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_deleted": True,
            "deleted_by": current_user["user_id"],
            "deleted_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.USER_DELETE,
        target_type="user",
        target_id=user_id,
        request=request
    )
    
    return {"message": "User deleted"}

# ============== PRIVATE CONTENT ACCESS ==============

@admin_system_router.get("/users/{user_id}/private-albums")
async def get_user_private_albums(
    user_id: str,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """View user's private albums (with audit logging)"""
    admin = current_user.get("admin")
    if admin and not admin.get("permissions", {}).get("view_private_content", False):
        if admin.get("role") != AdminRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Permission denied")
    
    albums = await db.albums.find({"user_id": user_id}, {"_id": 0}).to_list(100)
    
    # Log audit
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.VIEW_PRIVATE_CONTENT,
        target_type="albums",
        target_id=user_id,
        details={"count": len(albums)},
        request=request
    )
    
    return albums

@admin_system_router.get("/users/{user_id}/private-messages")
async def get_user_private_messages(
    user_id: str,
    request: Request,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(require_admin)
):
    """View user's private messages (with audit logging - GDPR compliance)"""
    admin = current_user.get("admin")
    if admin and not admin.get("permissions", {}).get("view_private_content", False):
        if admin.get("role") != AdminRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Permission denied")
    
    messages = await db.messages.find(
        {"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Log audit (GDPR compliance)
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.VIEW_PRIVATE_CONTENT,
        target_type="messages",
        target_id=user_id,
        details={"count": len(messages), "skip": skip, "limit": limit},
        request=request
    )
    
    return messages

# ============== DASHBOARD STATS ==============

@admin_system_router.get("/dashboard")
async def get_admin_dashboard(current_user: dict = Depends(require_admin)):
    """Get admin dashboard statistics"""
    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    seven_days_ago = (now - timedelta(days=7)).isoformat()
    
    # User stats
    total_users = await db.users.count_documents({"is_deleted": {"$ne": True}})
    new_users_30d = await db.users.count_documents({"created_at": {"$gte": thirty_days_ago}})
    new_users_7d = await db.users.count_documents({"created_at": {"$gte": seven_days_ago}})
    suspended_users = await db.users.count_documents({"is_suspended": True})
    banned_users = await db.users.count_documents({"is_banned": True})
    
    # Content stats
    total_posts = await db.posts.count_documents({})
    total_listings = await db.listings.count_documents({})
    total_albums = await db.albums.count_documents({})
    
    # Financial stats
    pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$bl_coins"}}}
    ]
    coins_result = await db.users.aggregate(pipeline).to_list(1)
    total_coins = coins_result[0]["total"] if coins_result else 0
    
    # Admin stats
    total_admins = await db.admins.count_documents({"is_active": True})
    
    # Recent activity
    recent_users = await db.users.find(
        {"is_deleted": {"$ne": True}},
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "users": {
            "total": total_users,
            "new_30d": new_users_30d,
            "new_7d": new_users_7d,
            "suspended": suspended_users,
            "banned": banned_users,
        },
        "content": {
            "posts": total_posts,
            "listings": total_listings,
            "albums": total_albums,
        },
        "financial": {
            "total_bl_coins": total_coins,
        },
        "admins": {
            "total": total_admins,
        },
        "recent_users": recent_users,
    }

# ============== AUDIT LOGS ==============

@audit_router.get("/logs")
async def get_audit_logs(
    action: Optional[str] = None,
    admin_id: Optional[str] = None,
    target_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(require_admin)
):
    """Get audit logs (super_admin and co_admin only)"""
    admin = current_user.get("admin")
    if admin and not admin.get("permissions", {}).get("view_audit_logs", False):
        if admin.get("role") not in [AdminRole.SUPER_ADMIN, AdminRole.CO_ADMIN]:
            raise HTTPException(status_code=403, detail="Permission denied")
    
    query = {}
    if action:
        query["action"] = action
    if admin_id:
        query["admin_id"] = admin_id
    if target_type:
        query["target_type"] = target_type
    
    logs = await db.audit_logs.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.audit_logs.count_documents(query)
    
    return {
        "logs": logs,
        "total": total,
        "skip": skip,
        "limit": limit,
    }

# ============== GENEALOGY TREE ==============

@genealogy_router.get("/tree")
async def get_full_genealogy_tree(
    root_user_id: Optional[str] = None,
    max_depth: int = 10,
    current_user: dict = Depends(require_admin)
):
    """Get full genealogy tree (admin only)"""
    admin = current_user.get("admin")
    if admin and not admin.get("permissions", {}).get("manage_genealogy", False):
        if admin.get("role") != AdminRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Permission denied")
    
    async def build_tree(user_id: str, depth: int = 0) -> dict:
        if depth > max_depth:
            return None
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            return None
        
        # Get direct downlines (level 1 referrals)
        relationships = await db.referral_relationships.find(
            {"referrer_id": user_id, "level": 1}
        ).to_list(1000)
        
        downline_ids = [r["referred_id"] for r in relationships]
        children = []
        
        for downline_id in downline_ids:
            child = await build_tree(downline_id, depth + 1)
            if child:
                children.append(child)
        
        return {
            "user_id": user["user_id"],
            "name": user.get("name", "Unknown"),
            "email": user.get("email", ""),
            "avatar": user.get("avatar"),
            "bl_coins": user.get("bl_coins", 0),
            "level": depth,
            "joined_at": user.get("created_at"),
            "is_active": not user.get("is_suspended") and not user.get("is_banned"),
            "children": children,
            "children_count": len(children),
        }
    
    # If no root specified, get all users without upline (roots)
    if root_user_id:
        tree = await build_tree(root_user_id)
        return {"tree": tree}
    else:
        # Find root users (no referred_by)
        root_users = await db.users.find(
            {"referred_by": None, "is_deleted": {"$ne": True}},
            {"_id": 0, "user_id": 1}
        ).limit(50).to_list(50)
        
        trees = []
        for root in root_users:
            tree = await build_tree(root["user_id"])
            if tree:
                trees.append(tree)
        
        return {"trees": trees}

@genealogy_router.get("/user/{user_id}")
async def get_user_genealogy(
    user_id: str,
    current_user: dict = Depends(require_admin)
):
    """Get genealogy for specific user"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get upline
    upline = None
    if user.get("referred_by"):
        upline = await db.users.find_one(
            {"user_id": user["referred_by"]},
            {"_id": 0, "password_hash": 0}
        )
    
    # Get direct downlines (level 1)
    level1_relationships = await db.referral_relationships.find(
        {"referrer_id": user_id, "level": 1}
    ).to_list(1000)
    level1_ids = [r["referred_id"] for r in level1_relationships]
    level1_users = await db.users.find(
        {"user_id": {"$in": level1_ids}},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    
    # Get level 2 (indirect)
    level2_relationships = await db.referral_relationships.find(
        {"referrer_id": user_id, "level": 2}
    ).to_list(1000)
    level2_ids = [r["referred_id"] for r in level2_relationships]
    level2_users = await db.users.find(
        {"user_id": {"$in": level2_ids}},
        {"_id": 0, "password_hash": 0}
    ).to_list(1000)
    
    return {
        "user": user,
        "upline": upline,
        "level1_downlines": level1_users,
        "level2_downlines": level2_users,
        "stats": {
            "level1_count": len(level1_users),
            "level2_count": len(level2_users),
            "total_downline": len(level1_users) + len(level2_users),
        }
    }

class ReassignUplineRequest(BaseModel):
    user_id: str
    new_upline_id: str

@genealogy_router.post("/reassign")
async def reassign_upline(
    data: ReassignUplineRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Reassign a user's upline (drag-drop functionality)"""
    admin = current_user.get("admin")
    if admin and not admin.get("permissions", {}).get("manage_genealogy", False):
        if admin.get("role") != AdminRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Permission denied")
    
    # Validate users exist
    user = await db.users.find_one({"user_id": data.user_id})
    new_upline = await db.users.find_one({"user_id": data.new_upline_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not new_upline:
        raise HTTPException(status_code=404, detail="New upline not found")
    
    # Prevent circular references
    if data.user_id == data.new_upline_id:
        raise HTTPException(status_code=400, detail="Cannot assign user as their own upline")
    
    old_upline_id = user.get("referred_by")
    
    # Update user's upline
    await db.users.update_one(
        {"user_id": data.user_id},
        {"$set": {"referred_by": data.new_upline_id}}
    )
    
    # Update referral relationships
    # Remove old level 1 relationship
    if old_upline_id:
        await db.referral_relationships.delete_one({
            "referrer_id": old_upline_id,
            "referred_id": data.user_id,
            "level": 1
        })
    
    # Create new level 1 relationship
    new_rel = {
        "relationship_id": f"ref_{uuid.uuid4().hex[:12]}",
        "referrer_id": data.new_upline_id,
        "referred_id": data.user_id,
        "level": 1,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_activity": datetime.now(timezone.utc).isoformat(),
    }
    await db.referral_relationships.insert_one(new_rel.copy())
    
    # Log audit
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.GENEALOGY_MODIFY,
        target_type="genealogy",
        target_id=data.user_id,
        details={
            "old_upline": old_upline_id,
            "new_upline": data.new_upline_id,
        },
        request=request
    )
    
    return {"message": "Upline reassigned successfully"}

# ============== PLATFORM SETTINGS ==============

@admin_system_router.get("/settings")
async def get_platform_settings(current_user: dict = Depends(require_admin)):
    """Get platform settings"""
    settings = await db.platform_settings.find_one({"key": "global"}, {"_id": 0})
    if not settings:
        settings = {
            "key": "global",
            "registration_enabled": True,
            "email_verification_required": False,
            "messaging_enabled": True,
            "marketplace_enabled": True,
            "casino_enabled": True,
            "referral_bonus": 100,
            "welcome_bonus": 100,
            "maintenance_mode": False,
        }
        await db.platform_settings.insert_one(settings.copy())
    return settings

@admin_system_router.put("/settings")
async def update_platform_settings(
    settings: Dict[str, Any],
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Update platform settings"""
    admin = current_user.get("admin")
    if admin and admin.get("role") not in [AdminRole.SUPER_ADMIN, AdminRole.CO_ADMIN]:
        raise HTTPException(status_code=403, detail="Permission denied")
    
    await db.platform_settings.update_one(
        {"key": "global"},
        {"$set": settings},
        upsert=True
    )
    
    await log_audit(
        admin_id=(current_user.get("admin") or {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.PERMISSION_CHANGE,
        target_type="settings",
        target_id="global",
        details=settings,
        request=request
    )
    
    return {"message": "Settings updated", "settings": settings}
