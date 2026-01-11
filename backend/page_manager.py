"""
Blendlink Page/Screen Management System
- Manage pages and screens for web and mobile
- Drag-and-drop reordering
- Show/hide pages
- Custom page creation
- Synced between web and mobile
"""
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
import os

from server import get_current_user, db, logger
from admin_system import require_admin, log_audit, AuditAction, AdminRole

page_manager_router = APIRouter(prefix="/page-manager", tags=["Page Manager"])

# ============== MODELS ==============

class PageConfig(BaseModel):
    """Page/Screen configuration"""
    page_id: str = Field(default_factory=lambda: f"page_{uuid.uuid4().hex[:12]}")
    name: str
    route: str  # Web route path
    mobile_screen: str  # Mobile screen name
    icon: str  # Icon name (lucide-react)
    description: str = ""
    order: int = 0
    is_visible: bool = True
    is_enabled: bool = True
    is_system: bool = False  # System pages can't be deleted
    requires_auth: bool = True
    required_role: Optional[str] = None  # member, premium, admin
    show_in_nav: bool = True
    show_in_mobile_nav: bool = True
    custom_content: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Default system pages
DEFAULT_PAGES = [
    {
        "page_id": "page_home",
        "name": "Home",
        "route": "/",
        "mobile_screen": "HomeScreen",
        "icon": "Home",
        "description": "Main feed and social content",
        "order": 0,
        "is_visible": True,
        "is_system": True,
        "requires_auth": False,
        "show_in_nav": True,
        "show_in_mobile_nav": True,
    },
    {
        "page_id": "page_feed",
        "name": "Feed",
        "route": "/feed",
        "mobile_screen": "SocialFeedScreen",
        "icon": "Newspaper",
        "description": "Social media feed",
        "order": 1,
        "is_visible": True,
        "is_system": True,
        "requires_auth": True,
        "show_in_nav": True,
        "show_in_mobile_nav": True,
    },
    {
        "page_id": "page_marketplace",
        "name": "Marketplace",
        "route": "/marketplace",
        "mobile_screen": "MarketplaceScreen",
        "icon": "ShoppingBag",
        "description": "Buy and sell items",
        "order": 2,
        "is_visible": True,
        "is_system": True,
        "requires_auth": False,
        "show_in_nav": True,
        "show_in_mobile_nav": True,
    },
    {
        "page_id": "page_casino",
        "name": "Casino",
        "route": "/casino",
        "mobile_screen": "CasinoScreen",
        "icon": "Dice5",
        "description": "Casino games and daily spin",
        "order": 3,
        "is_visible": True,
        "is_system": True,
        "requires_auth": True,
        "show_in_nav": True,
        "show_in_mobile_nav": True,
    },
    {
        "page_id": "page_profile",
        "name": "Profile",
        "route": "/profile",
        "mobile_screen": "ProfileScreen",
        "icon": "User",
        "description": "User profile and settings",
        "order": 4,
        "is_visible": True,
        "is_system": True,
        "requires_auth": True,
        "show_in_nav": True,
        "show_in_mobile_nav": True,
    },
    {
        "page_id": "page_wallet",
        "name": "Wallet",
        "route": "/wallet",
        "mobile_screen": "WalletScreen",
        "icon": "Wallet",
        "description": "BL Coins wallet and transactions",
        "order": 5,
        "is_visible": True,
        "is_system": True,
        "requires_auth": True,
        "show_in_nav": True,
        "show_in_mobile_nav": True,
    },
    {
        "page_id": "page_friends",
        "name": "Friends",
        "route": "/friends",
        "mobile_screen": "FriendsScreen",
        "icon": "Users",
        "description": "Manage friends and connections",
        "order": 6,
        "is_visible": True,
        "is_system": True,
        "requires_auth": True,
        "show_in_nav": True,
        "show_in_mobile_nav": True,
    },
    {
        "page_id": "page_groups",
        "name": "Groups",
        "route": "/groups",
        "mobile_screen": "GroupsScreen",
        "icon": "Users2",
        "description": "Community groups",
        "order": 7,
        "is_visible": True,
        "is_system": True,
        "requires_auth": True,
        "show_in_nav": True,
        "show_in_mobile_nav": True,
    },
    {
        "page_id": "page_events",
        "name": "Events",
        "route": "/events",
        "mobile_screen": "EventsScreen",
        "icon": "Calendar",
        "description": "Platform events",
        "order": 8,
        "is_visible": True,
        "is_system": True,
        "requires_auth": True,
        "show_in_nav": True,
        "show_in_mobile_nav": True,
    },
    {
        "page_id": "page_messages",
        "name": "Messages",
        "route": "/messages",
        "mobile_screen": "MessagesScreen",
        "icon": "MessageCircle",
        "description": "Private messaging",
        "order": 9,
        "is_visible": True,
        "is_system": True,
        "requires_auth": True,
        "show_in_nav": True,
        "show_in_mobile_nav": True,
    },
    {
        "page_id": "page_notifications",
        "name": "Notifications",
        "route": "/notifications",
        "mobile_screen": "NotificationsScreen",
        "icon": "Bell",
        "description": "System notifications",
        "order": 10,
        "is_visible": True,
        "is_system": True,
        "requires_auth": True,
        "show_in_nav": False,
        "show_in_mobile_nav": True,
    },
    {
        "page_id": "page_albums",
        "name": "Albums",
        "route": "/albums",
        "mobile_screen": "AlbumsScreen",
        "icon": "Image",
        "description": "Photo and video albums",
        "order": 11,
        "is_visible": True,
        "is_system": True,
        "requires_auth": True,
        "show_in_nav": True,
        "show_in_mobile_nav": True,
    },
    {
        "page_id": "page_earnings",
        "name": "Earnings",
        "route": "/earnings",
        "mobile_screen": "EarningsScreen",
        "icon": "TrendingUp",
        "description": "Referral earnings and commissions",
        "order": 12,
        "is_visible": True,
        "is_system": True,
        "requires_auth": True,
        "show_in_nav": True,
        "show_in_mobile_nav": True,
    },
    {
        "page_id": "page_seller",
        "name": "Seller Dashboard",
        "route": "/seller-dashboard",
        "mobile_screen": "SellerDashboardScreen",
        "icon": "Store",
        "description": "Seller tools and analytics",
        "order": 13,
        "is_visible": True,
        "is_system": True,
        "requires_auth": True,
        "show_in_nav": True,
        "show_in_mobile_nav": True,
    },
    {
        "page_id": "page_admin",
        "name": "Admin Panel",
        "route": "/admin",
        "mobile_screen": "AdminScreen",
        "icon": "Shield",
        "description": "Admin dashboard",
        "order": 99,
        "is_visible": True,
        "is_system": True,
        "requires_auth": True,
        "required_role": "admin",
        "show_in_nav": False,
        "show_in_mobile_nav": False,
    },
]

# ============== HELPER FUNCTIONS ==============

async def initialize_default_pages():
    """Initialize default pages if not exists"""
    count = await db.page_configs.count_documents({})
    if count == 0:
        for page in DEFAULT_PAGES:
            page["created_at"] = datetime.now(timezone.utc).isoformat()
            page["updated_at"] = datetime.now(timezone.utc).isoformat()
            await db.page_configs.insert_one(page.copy())
        logger.info(f"Initialized {len(DEFAULT_PAGES)} default pages")

# ============== ENDPOINTS ==============

@page_manager_router.get("/pages")
async def get_all_pages(
    include_hidden: bool = False,
    current_user: dict = Depends(require_admin)
):
    """Get all page configurations"""
    # Initialize default pages if needed
    await initialize_default_pages()
    
    query = {}
    if not include_hidden:
        query["is_visible"] = True
    
    pages = await db.page_configs.find(query, {"_id": 0}).sort("order", 1).to_list(100)
    
    return {"pages": pages}

@page_manager_router.get("/pages/public")
async def get_public_pages():
    """Get visible pages for navigation (no auth required)"""
    await initialize_default_pages()
    
    pages = await db.page_configs.find(
        {"is_visible": True, "is_enabled": True},
        {"_id": 0}
    ).sort("order", 1).to_list(100)
    
    return {"pages": pages}

@page_manager_router.get("/pages/{page_id}")
async def get_page(
    page_id: str,
    current_user: dict = Depends(require_admin)
):
    """Get a specific page configuration"""
    page = await db.page_configs.find_one({"page_id": page_id}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    return page

class CreatePageRequest(BaseModel):
    name: str
    route: str
    mobile_screen: str
    icon: str = "FileText"
    description: str = ""
    requires_auth: bool = True
    required_role: Optional[str] = None
    show_in_nav: bool = True
    show_in_mobile_nav: bool = True
    custom_content: Optional[Dict[str, Any]] = None

@page_manager_router.post("/pages")
async def create_page(
    data: CreatePageRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Create a new custom page"""
    admin = current_user.get("admin")
    if admin and not admin.get("permissions", {}).get("manage_pages", False):
        if admin.get("role") != AdminRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Permission denied")
    
    # Check for duplicate route
    existing = await db.page_configs.find_one({"route": data.route})
    if existing:
        raise HTTPException(status_code=400, detail="Route already exists")
    
    # Get max order
    max_order_page = await db.page_configs.find_one(
        {}, 
        sort=[("order", -1)]
    )
    max_order = max_order_page.get("order", 0) if max_order_page else 0
    
    page = PageConfig(
        name=data.name,
        route=data.route,
        mobile_screen=data.mobile_screen,
        icon=data.icon,
        description=data.description,
        order=max_order + 1,
        requires_auth=data.requires_auth,
        required_role=data.required_role,
        show_in_nav=data.show_in_nav,
        show_in_mobile_nav=data.show_in_mobile_nav,
        custom_content=data.custom_content,
        is_system=False,
    )
    
    page_dict = page.model_dump()
    page_dict["created_at"] = page_dict["created_at"].isoformat()
    page_dict["updated_at"] = page_dict["updated_at"].isoformat()
    
    await db.page_configs.insert_one(page_dict.copy())
    
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.PAGE_MODIFY,
        target_type="page",
        target_id=page.page_id,
        details={"action": "create", "name": data.name},
        request=request
    )
    
    return page_dict

class UpdatePageRequest(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    is_visible: Optional[bool] = None
    is_enabled: Optional[bool] = None
    requires_auth: Optional[bool] = None
    required_role: Optional[str] = None
    show_in_nav: Optional[bool] = None
    show_in_mobile_nav: Optional[bool] = None
    custom_content: Optional[Dict[str, Any]] = None

@page_manager_router.put("/pages/{page_id}")
async def update_page(
    page_id: str,
    data: UpdatePageRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Update a page configuration"""
    admin = current_user.get("admin")
    if admin and not admin.get("permissions", {}).get("manage_pages", False):
        if admin.get("role") != AdminRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Permission denied")
    
    page = await db.page_configs.find_one({"page_id": page_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.page_configs.update_one(
        {"page_id": page_id},
        {"$set": updates}
    )
    
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.PAGE_MODIFY,
        target_type="page",
        target_id=page_id,
        details={"action": "update", "updates": list(updates.keys())},
        request=request
    )
    
    return {"message": "Page updated", "updates": updates}

class ReorderPagesRequest(BaseModel):
    page_orders: List[Dict[str, Any]]  # [{"page_id": "...", "order": 0}, ...]

@page_manager_router.post("/pages/reorder")
async def reorder_pages(
    data: ReorderPagesRequest,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Reorder pages (drag-and-drop)"""
    admin = current_user.get("admin")
    if admin and not admin.get("permissions", {}).get("manage_pages", False):
        if admin.get("role") != AdminRole.SUPER_ADMIN:
            raise HTTPException(status_code=403, detail="Permission denied")
    
    for item in data.page_orders:
        await db.page_configs.update_one(
            {"page_id": item["page_id"]},
            {"$set": {"order": item["order"], "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.PAGE_MODIFY,
        target_type="pages",
        target_id="bulk_reorder",
        details={"count": len(data.page_orders)},
        request=request
    )
    
    return {"message": f"Reordered {len(data.page_orders)} pages"}

@page_manager_router.post("/pages/{page_id}/toggle")
async def toggle_page_visibility(
    page_id: str,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Toggle page visibility"""
    page = await db.page_configs.find_one({"page_id": page_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    new_visibility = not page.get("is_visible", True)
    
    await db.page_configs.update_one(
        {"page_id": page_id},
        {"$set": {
            "is_visible": new_visibility,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": f"Page {'shown' if new_visibility else 'hidden'}", "is_visible": new_visibility}

@page_manager_router.delete("/pages/{page_id}")
async def delete_page(
    page_id: str,
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Delete a custom page (system pages can't be deleted)"""
    admin = current_user.get("admin")
    if admin and admin.get("role") != AdminRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only super admins can delete pages")
    
    page = await db.page_configs.find_one({"page_id": page_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    if page.get("is_system"):
        raise HTTPException(status_code=400, detail="System pages cannot be deleted")
    
    await db.page_configs.delete_one({"page_id": page_id})
    
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.PAGE_MODIFY,
        target_type="page",
        target_id=page_id,
        details={"action": "delete", "name": page.get("name")},
        request=request
    )
    
    return {"message": "Page deleted"}

@page_manager_router.post("/pages/reset")
async def reset_to_defaults(
    request: Request,
    current_user: dict = Depends(require_admin)
):
    """Reset pages to default configuration"""
    admin = current_user.get("admin")
    if admin and admin.get("role") != AdminRole.SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="Only super admins can reset pages")
    
    # Delete all pages
    await db.page_configs.delete_many({})
    
    # Re-initialize defaults
    for page in DEFAULT_PAGES:
        page["created_at"] = datetime.now(timezone.utc).isoformat()
        page["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.page_configs.insert_one(page.copy())
    
    await log_audit(
        admin_id=current_user.get("admin", {}).get("admin_id", current_user["user_id"]),
        admin_email=current_user["email"],
        action=AuditAction.PAGE_MODIFY,
        target_type="pages",
        target_id="reset",
        details={"action": "reset_to_defaults"},
        request=request
    )
    
    return {"message": f"Reset to {len(DEFAULT_PAGES)} default pages"}
