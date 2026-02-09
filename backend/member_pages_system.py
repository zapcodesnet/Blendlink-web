"""
BlendLink Member Pages System - Enhanced Business Page Types
- Public Store Pages (e-commerce)
- Restaurant Pages (menu-driven)
- Services Pages (booking/calendar)
- Rental Pages (availability calendar)
- Real-time sync via WebSocket
- Per-page dashboards with analytics
"""

from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import logging
import json
import asyncio
from dotenv import load_dotenv

load_dotenv()

# Database connection
def get_mongo_connection():
    mongo_url = os.environ.get('MONGO_URL')
    mongo_url_local = os.environ.get('MONGO_URL_LOCAL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'blendlink')
    
    try:
        from pymongo import MongoClient as SyncMongoClient
        test_client = SyncMongoClient(mongo_url, serverSelectionTimeoutMS=5000)
        test_client.admin.command('ping')
        test_client.close()
        return AsyncIOMotorClient(mongo_url), db_name
    except Exception:
        return AsyncIOMotorClient(mongo_url_local), db_name

client, db_name = get_mongo_connection()
db = client[db_name]

logger = logging.getLogger(__name__)

# ============== ROUTERS ==============
member_pages_router = APIRouter(prefix="/member-pages", tags=["Member Pages"])
page_products_router = APIRouter(prefix="/page-products", tags=["Page Products"])
page_menu_router = APIRouter(prefix="/page-menu", tags=["Page Menu"])
page_services_router = APIRouter(prefix="/page-services", tags=["Page Services"])
page_rentals_router = APIRouter(prefix="/page-rentals", tags=["Page Rentals"])
page_inventory_router = APIRouter(prefix="/page-inventory", tags=["Page Inventory"])
page_analytics_router = APIRouter(prefix="/page-analytics", tags=["Page Analytics"])

# ============== CONSTANTS ==============
PAGE_TYPES = {
    "store": "Public Store Page",
    "restaurant": "Restaurant Page",
    "services": "Services Page",
    "rental": "Rental Page",
    "general": "General Page"  # Original page type
}

ORDER_TYPES = ["dine_in", "drive_thru", "pickup", "delivery", "shipping"]

# ============== MODELS ==============

class PageLocation(BaseModel):
    """Location model for multi-branch support"""
    location_id: str = Field(default_factory=lambda: f"loc_{uuid.uuid4().hex[:8]}")
    name: str
    address: str
    city: str
    state: str = ""
    country: str
    postal_code: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: str = ""
    email: str = ""
    is_primary: bool = False
    operating_hours: Dict[str, Any] = {}  # {"monday": {"open": "09:00", "close": "17:00"}, ...}

class PageSettings(BaseModel):
    """Settings for member pages"""
    order_types: List[str] = []  # dine_in, drive_thru, pickup, delivery, shipping
    accepts_cash: bool = True
    accepts_card: bool = True
    accepts_digital_wallet: bool = False
    tax_rate: float = 0.0
    currency: str = "USD"
    show_referral_link: bool = True
    referral_position: str = "footer"  # header, footer, sidebar
    enable_reviews: bool = True
    enable_ratings: bool = True
    auto_accept_orders: bool = False
    min_order_amount: float = 0.0
    delivery_fee: float = 0.0
    delivery_radius_miles: float = 10.0

class MemberPage(BaseModel):
    """Enhanced member page model"""
    page_id: str = Field(default_factory=lambda: f"mpage_{uuid.uuid4().hex[:12]}")
    owner_id: str
    page_type: str = "general"  # store, restaurant, services, rental, general
    name: str
    slug: str  # Unique URL slug
    description: str = ""
    category: str = ""
    cover_image: str = ""
    logo_image: str = ""
    theme_color: str = "#10B981"
    settings: Dict[str, Any] = {}
    locations: List[Dict[str, Any]] = []
    is_published: bool = False
    is_verified: bool = False
    subscriber_count: int = 0
    total_views: int = 0
    total_orders: int = 0
    total_revenue: float = 0.0
    rating_average: float = 0.0
    rating_count: int = 0
    referral_code: str = Field(default_factory=lambda: uuid.uuid4().hex[:8].upper())
    marketplace_linked: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PageProduct(BaseModel):
    """Product for store pages"""
    product_id: str = Field(default_factory=lambda: f"prod_{uuid.uuid4().hex[:12]}")
    page_id: str
    name: str
    description: str = ""
    sku: str = ""
    barcode: str = ""
    category: str = ""
    images: List[str] = []
    price: float
    compare_at_price: Optional[float] = None
    cost_price: Optional[float] = None
    variants: List[Dict[str, Any]] = []  # [{name: "Size", options: ["S", "M", "L"], prices: {...}}]
    stock_quantity: int = 0
    low_stock_threshold: int = 5
    track_inventory: bool = True
    allow_backorder: bool = False
    is_active: bool = True
    is_featured: bool = False
    rating_average: float = 0.0
    rating_count: int = 0
    total_sold: int = 0
    tags: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MenuItem(BaseModel):
    """Menu item for restaurant pages"""
    item_id: str = Field(default_factory=lambda: f"menu_{uuid.uuid4().hex[:12]}")
    page_id: str
    name: str
    description: str = ""
    category: str = ""  # Appetizers, Mains, Desserts, Beverages, etc.
    subcategory: str = ""
    images: List[str] = []
    price: float
    sizes: List[Dict[str, Any]] = []  # [{name: "Small", price: 5.99}, {name: "Large", price: 8.99}]
    add_ons: List[Dict[str, Any]] = []  # [{name: "Extra Cheese", price: 1.50}]
    ingredients: List[str] = []
    allergens: List[str] = []
    calories: Optional[int] = None
    is_vegetarian: bool = False
    is_vegan: bool = False
    is_gluten_free: bool = False
    is_spicy: bool = False
    spice_level: int = 0  # 0-5
    is_available: bool = True
    is_featured: bool = False
    preparation_time: int = 15  # minutes
    rating_average: float = 0.0
    rating_count: int = 0
    total_ordered: int = 0
    display_order: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PageService(BaseModel):
    """Service for services pages"""
    service_id: str = Field(default_factory=lambda: f"svc_{uuid.uuid4().hex[:12]}")
    page_id: str
    name: str
    description: str = ""
    category: str = ""
    images: List[str] = []
    duration_minutes: int = 60
    price: float
    price_type: str = "fixed"  # fixed, hourly, starting_at
    tiers: List[Dict[str, Any]] = []  # [{name: "Basic", price: 50, features: [...]}, ...]
    is_available: bool = True
    is_featured: bool = False
    requires_booking: bool = True
    max_bookings_per_slot: int = 1
    buffer_time_minutes: int = 15
    cancellation_policy: str = ""
    rating_average: float = 0.0
    rating_count: int = 0
    total_bookings: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ServiceAvailability(BaseModel):
    """Availability slots for services"""
    availability_id: str = Field(default_factory=lambda: f"avail_{uuid.uuid4().hex[:8]}")
    page_id: str
    service_id: Optional[str] = None  # None means applies to all services
    day_of_week: int  # 0=Monday, 6=Sunday
    start_time: str  # "09:00"
    end_time: str  # "17:00"
    slot_duration_minutes: int = 60
    is_active: bool = True

class PageRentalItem(BaseModel):
    """Rental item for rental pages"""
    rental_id: str = Field(default_factory=lambda: f"rent_{uuid.uuid4().hex[:12]}")
    page_id: str
    name: str
    description: str = ""
    category: str = ""
    images: List[str] = []
    hourly_rate: Optional[float] = None
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    deposit_amount: float = 0.0
    terms: str = ""
    min_rental_hours: int = 1
    max_rental_days: int = 30
    quantity_available: int = 1
    is_available: bool = True
    is_featured: bool = False
    rating_average: float = 0.0
    rating_count: int = 0
    total_rentals: int = 0
    blocked_dates: List[str] = []  # ISO date strings
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PageInventoryItem(BaseModel):
    """Inventory tracking for products/menu items/rentals"""
    inventory_id: str = Field(default_factory=lambda: f"inv_{uuid.uuid4().hex[:8]}")
    page_id: str
    item_id: str  # product_id, item_id, or rental_id
    item_type: str  # product, menu_item, rental
    location_id: Optional[str] = None  # For multi-branch
    quantity: int = 0
    reserved_quantity: int = 0
    low_stock_threshold: int = 5
    last_restocked: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PageOrder(BaseModel):
    """Order for member pages"""
    order_id: str = Field(default_factory=lambda: f"ord_{uuid.uuid4().hex[:12]}")
    page_id: str
    customer_id: str
    order_type: str  # dine_in, drive_thru, pickup, delivery, shipping
    status: str = "pending"  # pending, confirmed, preparing, ready, completed, cancelled
    items: List[Dict[str, Any]] = []  # [{item_id, name, quantity, price, options, ...}]
    subtotal: float = 0.0
    tax: float = 0.0
    delivery_fee: float = 0.0
    discount: float = 0.0
    total: float = 0.0
    payment_method: str = ""
    payment_status: str = "pending"  # pending, paid, refunded
    stripe_payment_id: Optional[str] = None
    delivery_address: Optional[Dict[str, Any]] = None
    table_number: Optional[str] = None
    notes: str = ""
    referral_code_used: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PageReview(BaseModel):
    """Review for member pages"""
    review_id: str = Field(default_factory=lambda: f"rev_{uuid.uuid4().hex[:12]}")
    page_id: str
    item_id: Optional[str] = None  # Optional: specific product/service/rental
    item_type: Optional[str] = None
    customer_id: str
    rating: int  # 1-5
    title: str = ""
    content: str = ""
    images: List[str] = []
    is_verified_purchase: bool = False
    helpful_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ServiceBooking(BaseModel):
    """Booking for services pages"""
    booking_id: str = Field(default_factory=lambda: f"book_{uuid.uuid4().hex[:12]}")
    page_id: str
    service_id: str
    customer_id: str
    location_id: Optional[str] = None
    booking_date: str  # ISO date
    start_time: str  # "14:00"
    end_time: str  # "15:00"
    status: str = "pending"  # pending, confirmed, completed, cancelled, no_show
    notes: str = ""
    payment_status: str = "pending"
    total_price: float = 0.0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RentalBooking(BaseModel):
    """Booking for rentals"""
    booking_id: str = Field(default_factory=lambda: f"rbook_{uuid.uuid4().hex[:12]}")
    page_id: str
    rental_id: str
    customer_id: str
    start_date: str  # ISO date
    end_date: str
    rental_type: str  # hourly, daily, weekly, monthly
    quantity: int = 1
    status: str = "pending"
    deposit_paid: bool = False
    total_price: float = 0.0
    deposit_amount: float = 0.0
    notes: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== REQUEST MODELS ==============

class CreateMemberPageRequest(BaseModel):
    page_type: str
    name: str
    slug: str
    description: str = ""
    category: str = ""
    cover_image: str = ""
    logo_image: str = ""
    theme_color: str = "#10B981"

class UpdateMemberPageRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    cover_image: Optional[str] = None
    logo_image: Optional[str] = None
    theme_color: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    is_published: Optional[bool] = None

class AddLocationRequest(BaseModel):
    name: str
    address: str
    city: str
    state: str = ""
    country: str
    postal_code: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    phone: str = ""
    email: str = ""
    is_primary: bool = False
    operating_hours: Dict[str, Any] = {}

class CreateProductRequest(BaseModel):
    name: str
    description: str = ""
    sku: str = ""
    barcode: str = ""
    category: str = ""
    images: List[str] = []
    price: float
    compare_at_price: Optional[float] = None
    cost_price: Optional[float] = None
    variants: List[Dict[str, Any]] = []
    stock_quantity: int = 0
    low_stock_threshold: int = 5
    track_inventory: bool = True
    tags: List[str] = []

class CreateMenuItemRequest(BaseModel):
    name: str
    description: str = ""
    category: str = ""
    subcategory: str = ""
    images: List[str] = []
    price: float
    sizes: List[Dict[str, Any]] = []
    add_ons: List[Dict[str, Any]] = []
    ingredients: List[str] = []
    allergens: List[str] = []
    calories: Optional[int] = None
    is_vegetarian: bool = False
    is_vegan: bool = False
    is_gluten_free: bool = False
    is_spicy: bool = False
    spice_level: int = 0
    preparation_time: int = 15

class CreateServiceRequest(BaseModel):
    name: str
    description: str = ""
    category: str = ""
    images: List[str] = []
    duration_minutes: int = 60
    price: float
    price_type: str = "fixed"
    tiers: List[Dict[str, Any]] = []
    requires_booking: bool = True
    max_bookings_per_slot: int = 1
    buffer_time_minutes: int = 15
    cancellation_policy: str = ""

class CreateRentalRequest(BaseModel):
    name: str
    description: str = ""
    category: str = ""
    images: List[str] = []
    hourly_rate: Optional[float] = None
    daily_rate: Optional[float] = None
    weekly_rate: Optional[float] = None
    monthly_rate: Optional[float] = None
    deposit_amount: float = 0.0
    terms: str = ""
    min_rental_hours: int = 1
    max_rental_days: int = 30
    quantity_available: int = 1

class CreateOrderRequest(BaseModel):
    page_id: str
    order_type: str
    items: List[Dict[str, Any]]
    delivery_address: Optional[Dict[str, Any]] = None
    table_number: Optional[str] = None
    notes: str = ""
    referral_code: Optional[str] = None

class CreateBookingRequest(BaseModel):
    service_id: str
    location_id: Optional[str] = None
    booking_date: str
    start_time: str
    notes: str = ""

class CreateRentalBookingRequest(BaseModel):
    rental_id: str
    start_date: str
    end_date: str
    rental_type: str
    quantity: int = 1
    notes: str = ""

# ============== HELPER FUNCTIONS ==============

from server import get_current_user

async def verify_page_owner(page_id: str, user_id: str):
    """Verify user is the page owner"""
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    if page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this page")
    return page

# ============== SLUG VALIDATION SYSTEM ==============

# Reserved slugs that cannot be used for member pages
RESERVED_SLUGS = {
    # System routes
    'admin', 'api', 'login', 'register', 'logout', 'signup', 'signin',
    'auth', 'oauth', 'callback', 'verify', 'reset', 'password',
    # App routes
    'home', 'dashboard', 'profile', 'settings', 'account', 'wallet',
    'marketplace', 'market', 'shop', 'store', 'explore', 'discover',
    'pages', 'page', 'create', 'edit', 'delete', 'new',
    # Features
    'notifications', 'messages', 'chat', 'inbox', 'help', 'support',
    'about', 'contact', 'terms', 'privacy', 'legal', 'faq',
    'blog', 'news', 'updates', 'changelog',
    # Special
    'public', 'private', 'test', 'demo', 'example', 'sample',
    'null', 'undefined', 'true', 'false', 'none',
    # Brand
    'blendlink', 'blend-link', 'bl', 'official', 'verified'
}

# Minimum and maximum slug lengths
SLUG_MIN_LENGTH = 3
SLUG_MAX_LENGTH = 50

def validate_slug_format(slug: str) -> tuple[bool, str]:
    """
    Validate slug format and return (is_valid, error_message)
    Rules:
    - Lowercase letters, numbers, and hyphens only
    - Must start with a letter
    - Must not end with a hyphen
    - No consecutive hyphens
    - Length between 3-50 characters
    - Not in reserved list
    """
    import re
    
    slug = slug.lower().strip()
    
    # Length check
    if len(slug) < SLUG_MIN_LENGTH:
        return False, f"Slug must be at least {SLUG_MIN_LENGTH} characters"
    
    if len(slug) > SLUG_MAX_LENGTH:
        return False, f"Slug must be at most {SLUG_MAX_LENGTH} characters"
    
    # Character check
    if not re.match(r'^[a-z0-9-]+$', slug):
        return False, "Slug can only contain lowercase letters, numbers, and hyphens"
    
    # Must start with a letter
    if not slug[0].isalpha():
        return False, "Slug must start with a letter"
    
    # Must not end with a hyphen
    if slug.endswith('-'):
        return False, "Slug cannot end with a hyphen"
    
    # No consecutive hyphens
    if '--' in slug:
        return False, "Slug cannot contain consecutive hyphens"
    
    # Reserved slug check
    if slug in RESERVED_SLUGS:
        return False, f"'{slug}' is a reserved name and cannot be used"
    
    return True, ""

async def check_slug_availability(slug: str, exclude_page_id: str = None) -> tuple[bool, str]:
    """
    Check if a slug is available across member_pages
    Returns (is_available, reason_if_not)
    """
    slug = slug.lower().strip()
    
    # First validate format
    is_valid, error_msg = validate_slug_format(slug)
    if not is_valid:
        return False, error_msg
    
    # Check member_pages collection
    query = {"slug": slug}
    if exclude_page_id:
        query["page_id"] = {"$ne": exclude_page_id}
    existing = await db.member_pages.find_one(query)
    
    if existing:
        return False, "This slug is already taken by another page"
    
    return True, ""

async def generate_slug_suggestions(base_slug: str) -> List[str]:
    """Generate alternative slug suggestions"""
    import random
    
    # Clean the base slug
    base_slug = base_slug.lower().strip()
    if not base_slug[0].isalpha():
        base_slug = 'page-' + base_slug
    
    suggestions = []
    
    # Try numbered suffixes first
    for i in range(1, 6):
        suggestion = f"{base_slug}-{i}"
        is_available, _ = await check_slug_availability(suggestion)
        if is_available:
            suggestions.append(suggestion)
        if len(suggestions) >= 3:
            break
    
    # Add random suffix suggestions
    while len(suggestions) < 5:
        suffix = ''.join(random.choices('0123456789', k=4))
        suggestion = f"{base_slug}-{suffix}"
        is_available, _ = await check_slug_availability(suggestion)
        if is_available:
            suggestions.append(suggestion)
    
    return suggestions[:5]

async def update_inventory(page_id: str, item_id: str, item_type: str, quantity_change: int, location_id: str = None):
    """Update inventory quantity"""
    query = {"page_id": page_id, "item_id": item_id, "item_type": item_type}
    if location_id:
        query["location_id"] = location_id
    
    result = await db.page_inventory.update_one(
        query,
        {
            "$inc": {"quantity": quantity_change},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Check for low stock alert
    if result.modified_count > 0:
        inv = await db.page_inventory.find_one(query)
        if inv and inv.get("quantity", 0) <= inv.get("low_stock_threshold", 5):
            # Trigger low stock notification
            await create_low_stock_alert(page_id, item_id, item_type, inv["quantity"])
    
    return result.modified_count > 0

async def create_low_stock_alert(page_id: str, item_id: str, item_type: str, current_quantity: int):
    """Create low stock alert notification"""
    page = await db.member_pages.find_one({"page_id": page_id}, {"owner_id": 1, "name": 1})
    if page:
        alert = {
            "alert_id": f"alert_{uuid.uuid4().hex[:8]}",
            "user_id": page["owner_id"],
            "page_id": page_id,
            "type": "low_stock",
            "item_id": item_id,
            "item_type": item_type,
            "current_quantity": current_quantity,
            "message": f"Low stock alert for item in {page['name']}",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.page_alerts.insert_one(alert)

# ============== WEBSOCKET MANAGER ==============

class PageSyncManager:
    """WebSocket manager for real-time page sync"""
    
    def __init__(self):
        self.connections: Dict[str, Dict[str, WebSocket]] = {}  # page_id -> {user_id: websocket}
    
    async def connect(self, websocket: WebSocket, page_id: str, user_id: str):
        await websocket.accept()
        if page_id not in self.connections:
            self.connections[page_id] = {}
        self.connections[page_id][user_id] = websocket
        logger.info(f"User {user_id} connected to page {page_id}")
    
    def disconnect(self, page_id: str, user_id: str):
        if page_id in self.connections:
            self.connections[page_id].pop(user_id, None)
            if not self.connections[page_id]:
                del self.connections[page_id]
    
    async def broadcast_to_page(self, page_id: str, message: dict, exclude_user: str = None):
        """Broadcast message to all users connected to a page"""
        if page_id in self.connections:
            for user_id, ws in list(self.connections[page_id].items()):
                if exclude_user and user_id == exclude_user:
                    continue
                try:
                    await ws.send_json(message)
                except Exception as e:
                    logger.error(f"Failed to send to {user_id}: {e}")
                    self.disconnect(page_id, user_id)
    
    async def broadcast_to_user(self, user_id: str, message: dict):
        """Broadcast message to a specific user across all their pages"""
        for page_id, users in self.connections.items():
            if user_id in users:
                try:
                    await users[user_id].send_json(message)
                except Exception:
                    pass

page_sync_manager = PageSyncManager()

# ============== MONGODB CHANGE STREAMS FOR REAL-TIME SYNC ==============

class MongoDBChangeStreamManager:
    """
    MongoDB Change Streams for true database-level real-time sync.
    Watches collections and broadcasts changes to connected WebSocket clients.
    """
    
    def __init__(self):
        self.running = False
        self.tasks: List[asyncio.Task] = []
        self.collections_to_watch = [
            ("member_pages", self._handle_page_change),
            ("page_products", self._handle_product_change),
            ("page_menu_items", self._handle_menu_change),
            ("page_services", self._handle_service_change),
            ("page_rentals", self._handle_rental_change),
            ("page_orders", self._handle_order_change),
            ("page_inventory", self._handle_inventory_change),
            ("member_page_subscriptions", self._handle_subscription_change),
        ]
    
    async def start(self):
        """Start watching all collections for changes"""
        if self.running:
            logger.warning("Change stream manager already running")
            return
        
        self.running = True
        logger.info("🔄 Starting MongoDB Change Streams for real-time sync...")
        
        for collection_name, handler in self.collections_to_watch:
            task = asyncio.create_task(
                self._watch_collection(collection_name, handler)
            )
            self.tasks.append(task)
            logger.info(f"   ✅ Watching collection: {collection_name}")
        
        logger.info("🎉 MongoDB Change Streams active - Real-time sync enabled!")
    
    async def stop(self):
        """Stop all change stream watchers"""
        self.running = False
        for task in self.tasks:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        self.tasks = []
        logger.info("MongoDB Change Streams stopped")
    
    async def _watch_collection(self, collection_name: str, handler):
        """Watch a single collection for changes"""
        collection = db[collection_name]
        
        while self.running:
            try:
                # Use change stream with full document lookup
                pipeline = [
                    {"$match": {
                        "operationType": {"$in": ["insert", "update", "replace", "delete"]}
                    }}
                ]
                
                async with collection.watch(
                    pipeline,
                    full_document="updateLookup",
                    full_document_before_change="whenAvailable"
                ) as stream:
                    logger.info(f"Change stream connected for {collection_name}")
                    
                    async for change in stream:
                        if not self.running:
                            break
                        
                        try:
                            await handler(change)
                        except Exception as e:
                            logger.error(f"Error handling change in {collection_name}: {e}")
                            
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Change stream error for {collection_name}: {e}")
                if self.running:
                    # Wait before reconnecting
                    await asyncio.sleep(5)
    
    async def _handle_page_change(self, change: dict):
        """Handle changes to member_pages collection"""
        op_type = change.get("operationType")
        doc = change.get("fullDocument") or {}
        page_id = doc.get("page_id") or change.get("documentKey", {}).get("page_id")
        
        if not page_id:
            return
        
        message = {
            "type": "page_change",
            "operation": op_type,
            "page_id": page_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if op_type == "insert":
            message["type"] = "page_created"
            message["page"] = {k: v for k, v in doc.items() if k != "_id"}
        elif op_type in ("update", "replace"):
            message["type"] = "page_updated"
            message["changes"] = change.get("updateDescription", {}).get("updatedFields", {})
            message["page"] = {k: v for k, v in doc.items() if k != "_id"} if doc else None
        elif op_type == "delete":
            message["type"] = "page_deleted"
        
        # Broadcast to all users viewing this page
        await page_sync_manager.broadcast_to_page(page_id, message)
        
        # Also broadcast to page owner for dashboard updates
        if doc.get("owner_id"):
            await page_sync_manager.broadcast_to_user(doc["owner_id"], message)
        
        logger.debug(f"Page change broadcast: {op_type} for {page_id}")
    
    async def _handle_product_change(self, change: dict):
        """Handle changes to page_products collection"""
        op_type = change.get("operationType")
        doc = change.get("fullDocument") or {}
        page_id = doc.get("page_id") or change.get("documentKey", {}).get("page_id")
        product_id = doc.get("product_id")
        
        if not page_id:
            return
        
        message = {
            "type": f"product_{op_type}d",
            "operation": op_type,
            "page_id": page_id,
            "product_id": product_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if doc:
            message["product"] = {k: v for k, v in doc.items() if k != "_id"}
        
        await page_sync_manager.broadcast_to_page(page_id, message)
        logger.debug(f"Product change broadcast: {op_type} for {product_id}")
    
    async def _handle_menu_change(self, change: dict):
        """Handle changes to page_menu_items collection"""
        op_type = change.get("operationType")
        doc = change.get("fullDocument") or {}
        page_id = doc.get("page_id")
        item_id = doc.get("item_id")
        
        if not page_id:
            return
        
        message = {
            "type": f"menu_item_{op_type}d",
            "operation": op_type,
            "page_id": page_id,
            "item_id": item_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if doc:
            message["item"] = {k: v for k, v in doc.items() if k != "_id"}
        
        await page_sync_manager.broadcast_to_page(page_id, message)
        logger.debug(f"Menu item change broadcast: {op_type} for {item_id}")
    
    async def _handle_service_change(self, change: dict):
        """Handle changes to page_services collection"""
        op_type = change.get("operationType")
        doc = change.get("fullDocument") or {}
        page_id = doc.get("page_id")
        service_id = doc.get("service_id")
        
        if not page_id:
            return
        
        message = {
            "type": f"service_{op_type}d",
            "operation": op_type,
            "page_id": page_id,
            "service_id": service_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if doc:
            message["service"] = {k: v for k, v in doc.items() if k != "_id"}
        
        await page_sync_manager.broadcast_to_page(page_id, message)
        logger.debug(f"Service change broadcast: {op_type} for {service_id}")
    
    async def _handle_rental_change(self, change: dict):
        """Handle changes to page_rentals collection"""
        op_type = change.get("operationType")
        doc = change.get("fullDocument") or {}
        page_id = doc.get("page_id")
        rental_id = doc.get("rental_id")
        
        if not page_id:
            return
        
        message = {
            "type": f"rental_{op_type}d",
            "operation": op_type,
            "page_id": page_id,
            "rental_id": rental_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if doc:
            message["rental"] = {k: v for k, v in doc.items() if k != "_id"}
        
        await page_sync_manager.broadcast_to_page(page_id, message)
        logger.debug(f"Rental change broadcast: {op_type} for {rental_id}")
    
    async def _handle_order_change(self, change: dict):
        """Handle changes to page_orders collection"""
        op_type = change.get("operationType")
        doc = change.get("fullDocument") or {}
        page_id = doc.get("page_id")
        order_id = doc.get("order_id")
        
        if not page_id:
            return
        
        message = {
            "type": f"order_{op_type}d",
            "operation": op_type,
            "page_id": page_id,
            "order_id": order_id,
            "order_status": doc.get("status"),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        if doc:
            # Include safe order data (exclude sensitive info)
            message["order"] = {
                "order_id": doc.get("order_id"),
                "status": doc.get("status"),
                "total": doc.get("total"),
                "order_type": doc.get("order_type"),
                "items_count": len(doc.get("items", [])),
                "created_at": doc.get("created_at")
            }
        
        await page_sync_manager.broadcast_to_page(page_id, message)
        logger.debug(f"Order change broadcast: {op_type} for {order_id}")
    
    async def _handle_inventory_change(self, change: dict):
        """Handle changes to page_inventory collection"""
        op_type = change.get("operationType")
        doc = change.get("fullDocument") or {}
        page_id = doc.get("page_id")
        item_id = doc.get("item_id")
        
        if not page_id:
            return
        
        message = {
            "type": "inventory_updated",
            "operation": op_type,
            "page_id": page_id,
            "item_id": item_id,
            "quantity": doc.get("quantity"),
            "low_stock_alert": doc.get("quantity", 0) <= doc.get("low_stock_threshold", 10),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        await page_sync_manager.broadcast_to_page(page_id, message)
        logger.debug(f"Inventory change broadcast: {op_type} for {item_id}")
    
    async def _handle_subscription_change(self, change: dict):
        """Handle changes to member_page_subscriptions collection"""
        op_type = change.get("operationType")
        doc = change.get("fullDocument") or {}
        page_id = doc.get("page_id")
        user_id = doc.get("user_id")
        
        if not page_id:
            return
        
        message = {
            "type": f"subscriber_{op_type}d",
            "operation": op_type,
            "page_id": page_id,
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Update subscriber count
        if op_type in ("insert", "delete"):
            count = await db.member_page_subscriptions.count_documents({"page_id": page_id})
            message["subscriber_count"] = count
        
        await page_sync_manager.broadcast_to_page(page_id, message)
        logger.debug(f"Subscription change broadcast: {op_type} for page {page_id}")

# Global change stream manager instance
change_stream_manager = MongoDBChangeStreamManager()

# ============== MEMBER PAGES ENDPOINTS ==============

@member_pages_router.get("/types")
async def get_page_types():
    """Get available page types"""
    return {"page_types": PAGE_TYPES, "order_types": ORDER_TYPES}

@member_pages_router.get("/check-slug/{slug}")
async def check_slug(slug: str):
    """
    Check if a slug is available and validate format.
    Returns detailed validation info including:
    - is_available: whether the slug can be used
    - is_valid: whether the format is correct
    - error: any validation error message
    - suggestions: alternative slug suggestions if not available
    - validation_rules: current validation rules for frontend reference
    """
    slug_lower = slug.lower().strip()
    
    # Validate format first
    is_valid, format_error = validate_slug_format(slug_lower)
    
    if not is_valid:
        # Generate suggestions based on sanitized slug
        import re
        sanitized = re.sub(r'[^a-z0-9-]', '-', slug_lower)
        sanitized = re.sub(r'-+', '-', sanitized).strip('-')
        if sanitized and len(sanitized) >= SLUG_MIN_LENGTH:
            suggestions = await generate_slug_suggestions(sanitized)
        else:
            suggestions = []
        
        return {
            "slug": slug_lower,
            "is_available": False,
            "is_valid": False,
            "error": format_error,
            "suggestions": suggestions,
            "validation_rules": {
                "min_length": SLUG_MIN_LENGTH,
                "max_length": SLUG_MAX_LENGTH,
                "pattern": "^[a-z][a-z0-9-]*[a-z0-9]$",
                "rules": [
                    "Must be 3-50 characters",
                    "Only lowercase letters, numbers, and hyphens",
                    "Must start with a letter",
                    "Cannot end with a hyphen",
                    "No consecutive hyphens",
                    "Cannot be a reserved name"
                ]
            }
        }
    
    # Check availability
    is_available, availability_error = await check_slug_availability(slug_lower)
    
    suggestions = []
    if not is_available:
        suggestions = await generate_slug_suggestions(slug_lower)
    
    return {
        "slug": slug_lower,
        "is_available": is_available,
        "is_valid": True,
        "error": availability_error if not is_available else None,
        "suggestions": suggestions,
        "validation_rules": {
            "min_length": SLUG_MIN_LENGTH,
            "max_length": SLUG_MAX_LENGTH,
            "pattern": "^[a-z][a-z0-9-]*[a-z0-9]$",
            "rules": [
                "Must be 3-50 characters",
                "Only lowercase letters, numbers, and hyphens",
                "Must start with a letter",
                "Cannot end with a hyphen",
                "No consecutive hyphens",
                "Cannot be a reserved name"
            ]
        }
    }

@member_pages_router.get("/my-pages")
async def get_my_member_pages(current_user: dict = Depends(get_current_user)):
    """Get all pages owned by current user and pages they follow"""
    user_id = current_user["user_id"]
    
    # Get owned pages
    owned_pages = await db.member_pages.find(
        {"owner_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Get followed/subscribed pages
    subscriptions = await db.member_page_subscriptions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    followed_page_ids = [s["page_id"] for s in subscriptions]
    followed_pages = []
    if followed_page_ids:
        followed_pages = await db.member_pages.find(
            {"page_id": {"$in": followed_page_ids}},
            {"_id": 0}
        ).to_list(100)
    
    return {
        "pages": owned_pages,
        "following": followed_pages
    }

@member_pages_router.get("/discover")
async def discover_member_pages(
    skip: int = 0,
    limit: int = 50,
    category: str = None,
    page_type: str = None,
    search: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Discover public member pages"""
    user_id = current_user["user_id"]
    
    # Build query for published pages
    query = {"is_published": True}
    
    if category:
        query["category"] = category
    if page_type and page_type in PAGE_TYPES:
        query["page_type"] = page_type
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"slug": {"$regex": search, "$options": "i"}}
        ]
    
    # Get pages
    pages = await db.member_pages.find(
        query,
        {"_id": 0}
    ).sort("total_views", -1).skip(skip).limit(limit).to_list(limit)
    
    # Also include draft pages from current user (they can see their own)
    user_drafts = await db.member_pages.find(
        {"owner_id": user_id, "is_published": False},
        {"_id": 0}
    ).to_list(20)
    
    # Merge, avoiding duplicates
    page_ids = {p["page_id"] for p in pages}
    for draft in user_drafts:
        if draft["page_id"] not in page_ids:
            pages.append(draft)
    
    # Get user's subscriptions to mark followed pages
    subs = await db.member_page_subscriptions.find(
        {"user_id": user_id},
        {"page_id": 1, "_id": 0}
    ).to_list(100)
    subscribed_ids = {s["page_id"] for s in subs}
    
    # Mark pages with subscription status and ownership
    for page in pages:
        page["is_subscribed"] = page["page_id"] in subscribed_ids
        page["is_owner"] = page["owner_id"] == user_id
    
    return {"pages": pages}

@member_pages_router.post("/{page_id}/subscribe")
async def subscribe_to_member_page(page_id: str, current_user: dict = Depends(get_current_user)):
    """Subscribe/follow a member page"""
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Can't subscribe to own page
    if page["owner_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot subscribe to your own page")
    
    # Check if already subscribed
    existing = await db.member_page_subscriptions.find_one({
        "page_id": page_id,
        "user_id": user_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already subscribed to this page")
    
    # Create subscription
    await db.member_page_subscriptions.insert_one({
        "subscription_id": f"sub_{uuid.uuid4().hex[:12]}",
        "page_id": page_id,
        "user_id": user_id,
        "subscribed_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Update subscriber count
    await db.member_pages.update_one(
        {"page_id": page_id},
        {"$inc": {"subscriber_count": 1}}
    )
    
    # Award BL coins to subscriber
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"bl_coins": 10}}
    )
    
    # Award BL coins to page owner
    await db.users.update_one(
        {"user_id": page["owner_id"]},
        {"$inc": {"bl_coins": 10}}
    )
    
    return {
        "message": f"Subscribed to {page['name']}!",
        "bl_coins_earned": 10
    }

@member_pages_router.post("/{page_id}/unsubscribe")
async def unsubscribe_from_member_page(page_id: str, current_user: dict = Depends(get_current_user)):
    """Unsubscribe/unfollow from a member page"""
    user_id = current_user["user_id"]
    
    # Remove subscription
    result = await db.member_page_subscriptions.delete_one({
        "page_id": page_id,
        "user_id": user_id
    })
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not subscribed to this page")
    
    # Update subscriber count
    await db.member_pages.update_one(
        {"page_id": page_id},
        {"$inc": {"subscriber_count": -1}}
    )
    
    return {"message": "Unsubscribed successfully"}

@member_pages_router.post("/")
async def create_member_page(
    request: CreateMemberPageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new member page"""
    user_id = current_user["user_id"]
    
    # Check page type validity
    if request.page_type not in PAGE_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid page type. Must be one of: {list(PAGE_TYPES.keys())}")
    
    # Check slug availability using enhanced validation
    slug = request.slug.lower().strip()
    if not slug:
        raise HTTPException(status_code=400, detail="Slug is required")
    
    # Use the comprehensive slug validation
    is_valid, format_error = validate_slug_format(slug)
    if not is_valid:
        suggestions = await generate_slug_suggestions(slug)
        raise HTTPException(
            status_code=400, 
            detail={
                "message": format_error,
                "suggestions": suggestions
            }
        )
    
    is_available, availability_error = await check_slug_availability(slug)
    if not is_available:
        suggestions = await generate_slug_suggestions(slug)
        raise HTTPException(
            status_code=400, 
            detail={
                "message": availability_error,
                "suggestions": suggestions
            }
        )
    
    # Create page
    page = MemberPage(
        owner_id=user_id,
        page_type=request.page_type,
        name=request.name,
        slug=slug,
        description=request.description,
        category=request.category,
        cover_image=request.cover_image,
        logo_image=request.logo_image,
        theme_color=request.theme_color,
        settings={
            "order_types": [],
            "accepts_cash": True,
            "accepts_card": True,
            "show_referral_link": True,
            "enable_reviews": True,
            "enable_ratings": True
        }
    )
    
    page_dict = page.model_dump()
    page_dict["created_at"] = page_dict["created_at"].isoformat()
    page_dict["updated_at"] = page_dict["updated_at"].isoformat()
    
    await db.member_pages.insert_one(page_dict.copy())
    page_dict.pop("_id", None)
    
    # Award BL coins for creating page
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"bl_coins": 40}}
    )
    
    # Log transaction
    await db.transactions.insert_one({
        "transaction_id": f"tx_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "type": "bl_coin_credit",
        "amount": 40,
        "description": f"Created {PAGE_TYPES[request.page_type]}: {request.name}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "page": page_dict,
        "bl_coins_earned": 40,
        "message": f"{PAGE_TYPES[request.page_type]} created successfully!"
    }

@member_pages_router.get("/{page_id}")
async def get_member_page(page_id: str, current_user: dict = Depends(get_current_user)):
    """Get a specific member page with dashboard data"""
    page = await db.member_pages.find_one({"page_id": page_id}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    user_id = current_user["user_id"]
    is_owner = page["owner_id"] == user_id
    
    # If owner, include dashboard stats
    if is_owner:
        # Get recent orders
        recent_orders = await db.page_orders.find(
            {"page_id": page_id},
            {"_id": 0}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        # Get item counts based on page type
        item_counts = {}
        if page["page_type"] == "store":
            item_counts["products"] = await db.page_products.count_documents({"page_id": page_id})
        elif page["page_type"] == "restaurant":
            item_counts["menu_items"] = await db.page_menu_items.count_documents({"page_id": page_id})
        elif page["page_type"] == "services":
            item_counts["services"] = await db.page_services.count_documents({"page_id": page_id})
        elif page["page_type"] == "rental":
            item_counts["rentals"] = await db.page_rentals.count_documents({"page_id": page_id})
        
        # Get low stock alerts
        alerts = await db.page_alerts.find(
            {"page_id": page_id, "is_read": False},
            {"_id": 0}
        ).sort("created_at", -1).limit(10).to_list(10)
        
        page["dashboard"] = {
            "recent_orders": recent_orders,
            "item_counts": item_counts,
            "alerts": alerts
        }
    
    page["is_owner"] = is_owner
    return page

@member_pages_router.put("/{page_id}")
async def update_member_page(
    page_id: str,
    request: UpdateMemberPageRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a member page"""
    user_id = current_user["user_id"]
    await verify_page_owner(page_id, user_id)
    
    update_data = {}
    for field, value in request.model_dump(exclude_unset=True).items():
        if value is not None:
            update_data[field] = value
    
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.member_pages.update_one(
        {"page_id": page_id},
        {"$set": update_data}
    )
    
    # Broadcast update to connected clients
    await page_sync_manager.broadcast_to_page(page_id, {
        "type": "page_updated",
        "page_id": page_id,
        "changes": update_data
    })
    
    updated_page = await db.member_pages.find_one({"page_id": page_id}, {"_id": 0})
    return {"page": updated_page, "message": "Page updated successfully"}

@member_pages_router.delete("/{page_id}")
async def delete_member_page(page_id: str, current_user: dict = Depends(get_current_user)):
    """Delete a member page"""
    user_id = current_user["user_id"]
    await verify_page_owner(page_id, user_id)
    
    # Delete page and all related data
    await db.member_pages.delete_one({"page_id": page_id})
    await db.page_products.delete_many({"page_id": page_id})
    await db.page_menu_items.delete_many({"page_id": page_id})
    await db.page_services.delete_many({"page_id": page_id})
    await db.page_rentals.delete_many({"page_id": page_id})
    await db.page_orders.delete_many({"page_id": page_id})
    await db.page_inventory.delete_many({"page_id": page_id})
    await db.page_reviews.delete_many({"page_id": page_id})
    await db.page_alerts.delete_many({"page_id": page_id})
    
    return {"message": "Page deleted successfully"}

@member_pages_router.post("/{page_id}/locations")
async def add_page_location(
    page_id: str,
    request: AddLocationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Add a location to a page"""
    user_id = current_user["user_id"]
    await verify_page_owner(page_id, user_id)
    
    location = PageLocation(**request.model_dump())
    location_dict = location.model_dump()
    
    # If this is the first location or marked as primary, update others
    if request.is_primary:
        await db.member_pages.update_one(
            {"page_id": page_id},
            {"$set": {"locations.$[].is_primary": False}}
        )
    
    await db.member_pages.update_one(
        {"page_id": page_id},
        {"$push": {"locations": location_dict}}
    )
    
    # Broadcast update
    await page_sync_manager.broadcast_to_page(page_id, {
        "type": "location_added",
        "page_id": page_id,
        "location": location_dict
    })
    
    return {"location": location_dict, "message": "Location added successfully"}

@member_pages_router.get("/public/{slug}")
async def get_public_page(slug: str):
    """Get a public page by slug (no auth required)"""
    page = await db.member_pages.find_one(
        {"slug": slug.lower(), "is_published": True},
        {"_id": 0}
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Increment view count
    await db.member_pages.update_one(
        {"slug": slug.lower()},
        {"$inc": {"total_views": 1}}
    )
    
    # Get items based on page type
    items = []
    if page["page_type"] == "store":
        items = await db.page_products.find(
            {"page_id": page["page_id"], "is_active": True},
            {"_id": 0}
        ).to_list(100)
    elif page["page_type"] == "restaurant":
        items = await db.page_menu_items.find(
            {"page_id": page["page_id"], "is_available": True},
            {"_id": 0}
        ).sort("display_order", 1).to_list(100)
    elif page["page_type"] == "services":
        items = await db.page_services.find(
            {"page_id": page["page_id"], "is_available": True},
            {"_id": 0}
        ).to_list(100)
    elif page["page_type"] == "rental":
        items = await db.page_rentals.find(
            {"page_id": page["page_id"], "is_available": True},
            {"_id": 0}
        ).to_list(100)
    
    # Get reviews
    reviews = await db.page_reviews.find(
        {"page_id": page["page_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    return {
        "page": page,
        "items": items,
        "reviews": reviews
    }

# ============== PRODUCTS ENDPOINTS (Store Pages) ==============

@page_products_router.get("/{page_id}")
async def get_page_products(
    page_id: str,
    category: str = None,
    search: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all products for a store page"""
    query = {"page_id": page_id}
    if category:
        query["category"] = category
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
            {"barcode": search}
        ]
    
    products = await db.page_products.find(query, {"_id": 0}).to_list(500)
    return {"products": products}

@page_products_router.post("/{page_id}")
async def create_product(
    page_id: str,
    request: CreateProductRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new product"""
    user_id = current_user["user_id"]
    page = await verify_page_owner(page_id, user_id)
    
    if page["page_type"] != "store":
        raise HTTPException(status_code=400, detail="Products can only be added to store pages")
    
    product = PageProduct(
        page_id=page_id,
        **request.model_dump()
    )
    
    product_dict = product.model_dump()
    product_dict["created_at"] = product_dict["created_at"].isoformat()
    
    await db.page_products.insert_one(product_dict.copy())
    product_dict.pop("_id", None)
    
    # Create inventory record
    await db.page_inventory.insert_one({
        "inventory_id": f"inv_{uuid.uuid4().hex[:8]}",
        "page_id": page_id,
        "item_id": product.product_id,
        "item_type": "product",
        "quantity": request.stock_quantity,
        "low_stock_threshold": request.low_stock_threshold,
        "updated_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Broadcast update
    await page_sync_manager.broadcast_to_page(page_id, {
        "type": "product_created",
        "page_id": page_id,
        "product": product_dict
    })
    
    return {"product": product_dict, "message": "Product created successfully"}

@page_products_router.put("/{page_id}/{product_id}")
async def update_product(
    page_id: str,
    product_id: str,
    request: CreateProductRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a product"""
    user_id = current_user["user_id"]
    await verify_page_owner(page_id, user_id)
    
    update_data = request.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.page_products.update_one(
        {"page_id": page_id, "product_id": product_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Broadcast update
    await page_sync_manager.broadcast_to_page(page_id, {
        "type": "product_updated",
        "page_id": page_id,
        "product_id": product_id,
        "changes": update_data
    })
    
    updated = await db.page_products.find_one({"product_id": product_id}, {"_id": 0})
    return {"product": updated, "message": "Product updated successfully"}

@page_products_router.delete("/{page_id}/{product_id}")
async def delete_product(
    page_id: str,
    product_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a product"""
    user_id = current_user["user_id"]
    await verify_page_owner(page_id, user_id)
    
    result = await db.page_products.delete_one({"page_id": page_id, "product_id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Delete inventory record
    await db.page_inventory.delete_one({"page_id": page_id, "item_id": product_id})
    
    # Broadcast update
    await page_sync_manager.broadcast_to_page(page_id, {
        "type": "product_deleted",
        "page_id": page_id,
        "product_id": product_id
    })
    
    return {"message": "Product deleted successfully"}

# ============== MENU ENDPOINTS (Restaurant Pages) ==============

@page_menu_router.get("/{page_id}")
async def get_menu_items(
    page_id: str,
    category: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all menu items for a restaurant page"""
    query = {"page_id": page_id}
    if category:
        query["category"] = category
    
    items = await db.page_menu_items.find(query, {"_id": 0}).sort("display_order", 1).to_list(500)
    
    # Group by category
    categories = {}
    for item in items:
        cat = item.get("category", "Other")
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(item)
    
    return {"items": items, "categories": categories}

@page_menu_router.post("/{page_id}")
async def create_menu_item(
    page_id: str,
    request: CreateMenuItemRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new menu item"""
    user_id = current_user["user_id"]
    page = await verify_page_owner(page_id, user_id)
    
    if page["page_type"] != "restaurant":
        raise HTTPException(status_code=400, detail="Menu items can only be added to restaurant pages")
    
    # Get max display order
    max_order = await db.page_menu_items.find_one(
        {"page_id": page_id, "category": request.category},
        sort=[("display_order", -1)]
    )
    display_order = (max_order.get("display_order", 0) + 1) if max_order else 0
    
    item = MenuItem(
        page_id=page_id,
        display_order=display_order,
        **request.model_dump()
    )
    
    item_dict = item.model_dump()
    item_dict["created_at"] = item_dict["created_at"].isoformat()
    
    await db.page_menu_items.insert_one(item_dict.copy())
    item_dict.pop("_id", None)
    
    # Broadcast update
    await page_sync_manager.broadcast_to_page(page_id, {
        "type": "menu_item_created",
        "page_id": page_id,
        "item": item_dict
    })
    
    return {"item": item_dict, "message": "Menu item created successfully"}

@page_menu_router.put("/{page_id}/{item_id}")
async def update_menu_item(
    page_id: str,
    item_id: str,
    request: CreateMenuItemRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update a menu item"""
    user_id = current_user["user_id"]
    await verify_page_owner(page_id, user_id)
    
    update_data = request.model_dump()
    
    result = await db.page_menu_items.update_one(
        {"page_id": page_id, "item_id": item_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    # Broadcast update
    await page_sync_manager.broadcast_to_page(page_id, {
        "type": "menu_item_updated",
        "page_id": page_id,
        "item_id": item_id,
        "changes": update_data
    })
    
    updated = await db.page_menu_items.find_one({"item_id": item_id}, {"_id": 0})
    return {"item": updated, "message": "Menu item updated successfully"}

@page_menu_router.delete("/{page_id}/{item_id}")
async def delete_menu_item(
    page_id: str,
    item_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a menu item"""
    user_id = current_user["user_id"]
    await verify_page_owner(page_id, user_id)
    
    result = await db.page_menu_items.delete_one({"page_id": page_id, "item_id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menu item not found")
    
    # Broadcast update
    await page_sync_manager.broadcast_to_page(page_id, {
        "type": "menu_item_deleted",
        "page_id": page_id,
        "item_id": item_id
    })
    
    return {"message": "Menu item deleted successfully"}

# ============== SERVICES ENDPOINTS ==============

@page_services_router.get("/{page_id}")
async def get_services(page_id: str, current_user: dict = Depends(get_current_user)):
    """Get all services for a services page"""
    services = await db.page_services.find({"page_id": page_id}, {"_id": 0}).to_list(100)
    return {"services": services}

@page_services_router.post("/{page_id}")
async def create_service(
    page_id: str,
    request: CreateServiceRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new service"""
    user_id = current_user["user_id"]
    page = await verify_page_owner(page_id, user_id)
    
    if page["page_type"] != "services":
        raise HTTPException(status_code=400, detail="Services can only be added to services pages")
    
    service = PageService(
        page_id=page_id,
        **request.model_dump()
    )
    
    service_dict = service.model_dump()
    service_dict["created_at"] = service_dict["created_at"].isoformat()
    
    await db.page_services.insert_one(service_dict.copy())
    service_dict.pop("_id", None)
    
    # Broadcast update
    await page_sync_manager.broadcast_to_page(page_id, {
        "type": "service_created",
        "page_id": page_id,
        "service": service_dict
    })
    
    return {"service": service_dict, "message": "Service created successfully"}

@page_services_router.get("/{page_id}/availability")
async def get_service_availability(
    page_id: str,
    service_id: str = None,
    date: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get available time slots for booking"""
    from datetime import datetime as dt
    
    query = {"page_id": page_id, "is_active": True}
    if service_id:
        query["$or"] = [{"service_id": service_id}, {"service_id": None}]
    
    availability = await db.page_availability.find(query, {"_id": 0}).to_list(100)
    
    # If date provided, calculate available slots
    if date:
        target_date = dt.fromisoformat(date)
        day_of_week = target_date.weekday()
        
        # Filter by day of week
        day_availability = [a for a in availability if a["day_of_week"] == day_of_week]
        
        # Get existing bookings for that date
        bookings = await db.page_bookings.find({
            "page_id": page_id,
            "booking_date": date,
            "status": {"$nin": ["cancelled"]}
        }).to_list(100)
        
        # Calculate available slots
        slots = []
        for avail in day_availability:
            # Parse times
            start = dt.strptime(avail["start_time"], "%H:%M")
            end = dt.strptime(avail["end_time"], "%H:%M")
            duration = avail.get("slot_duration_minutes", 60)
            
            current = start
            while current < end:
                slot_end = current + timedelta(minutes=duration)
                slot_str = current.strftime("%H:%M")
                
                # Check if slot is booked
                is_booked = any(
                    b["start_time"] == slot_str 
                    for b in bookings 
                    if not service_id or b.get("service_id") == service_id
                )
                
                if not is_booked:
                    slots.append({
                        "start_time": slot_str,
                        "end_time": slot_end.strftime("%H:%M"),
                        "available": True
                    })
                
                current = slot_end
        
        return {"date": date, "slots": slots}
    
    return {"availability": availability}

@page_services_router.post("/{page_id}/book")
async def book_service(
    page_id: str,
    request: CreateBookingRequest,
    current_user: dict = Depends(get_current_user)
):
    """Book a service"""
    user_id = current_user["user_id"]
    
    # Verify service exists
    service = await db.page_services.find_one({
        "page_id": page_id,
        "service_id": request.service_id
    })
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Check availability
    existing = await db.page_bookings.find_one({
        "page_id": page_id,
        "booking_date": request.booking_date,
        "start_time": request.start_time,
        "status": {"$nin": ["cancelled"]}
    })
    if existing:
        raise HTTPException(status_code=400, detail="Time slot is not available")
    
    # Calculate end time
    from datetime import datetime as dt
    start = dt.strptime(request.start_time, "%H:%M")
    end = start + timedelta(minutes=service.get("duration_minutes", 60))
    
    booking = ServiceBooking(
        page_id=page_id,
        service_id=request.service_id,
        customer_id=user_id,
        location_id=request.location_id,
        booking_date=request.booking_date,
        start_time=request.start_time,
        end_time=end.strftime("%H:%M"),
        notes=request.notes,
        total_price=service.get("price", 0)
    )
    
    booking_dict = booking.model_dump()
    booking_dict["created_at"] = booking_dict["created_at"].isoformat()
    
    await db.page_bookings.insert_one(booking_dict.copy())
    booking_dict.pop("_id", None)
    
    # Update service stats
    await db.page_services.update_one(
        {"service_id": request.service_id},
        {"$inc": {"total_bookings": 1}}
    )
    
    # Notify page owner
    page = await db.member_pages.find_one({"page_id": page_id})
    if page:
        await db.page_alerts.insert_one({
            "alert_id": f"alert_{uuid.uuid4().hex[:8]}",
            "user_id": page["owner_id"],
            "page_id": page_id,
            "type": "new_booking",
            "booking_id": booking.booking_id,
            "message": f"New booking for {service['name']} on {request.booking_date}",
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Broadcast update
    await page_sync_manager.broadcast_to_page(page_id, {
        "type": "booking_created",
        "page_id": page_id,
        "booking": booking_dict
    })
    
    return {"booking": booking_dict, "message": "Booking created successfully"}

# ============== RENTALS ENDPOINTS ==============

@page_rentals_router.get("/{page_id}")
async def get_rentals(page_id: str, current_user: dict = Depends(get_current_user)):
    """Get all rental items for a rental page"""
    rentals = await db.page_rentals.find({"page_id": page_id}, {"_id": 0}).to_list(100)
    return {"rentals": rentals}

@page_rentals_router.post("/{page_id}")
async def create_rental(
    page_id: str,
    request: CreateRentalRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new rental item"""
    user_id = current_user["user_id"]
    page = await verify_page_owner(page_id, user_id)
    
    if page["page_type"] != "rental":
        raise HTTPException(status_code=400, detail="Rentals can only be added to rental pages")
    
    rental = PageRentalItem(
        page_id=page_id,
        **request.model_dump()
    )
    
    rental_dict = rental.model_dump()
    rental_dict["created_at"] = rental_dict["created_at"].isoformat()
    
    await db.page_rentals.insert_one(rental_dict.copy())
    rental_dict.pop("_id", None)
    
    # Broadcast update
    await page_sync_manager.broadcast_to_page(page_id, {
        "type": "rental_created",
        "page_id": page_id,
        "rental": rental_dict
    })
    
    return {"rental": rental_dict, "message": "Rental item created successfully"}

@page_rentals_router.get("/{page_id}/{rental_id}/availability")
async def get_rental_availability(
    page_id: str,
    rental_id: str,
    start_date: str = None,
    end_date: str = None
):
    """Get availability for a rental item"""
    rental = await db.page_rentals.find_one({"page_id": page_id, "rental_id": rental_id})
    if not rental:
        raise HTTPException(status_code=404, detail="Rental item not found")
    
    # Get all bookings for this rental
    query = {"page_id": page_id, "rental_id": rental_id, "status": {"$nin": ["cancelled"]}}
    bookings = await db.page_rental_bookings.find(query, {"_id": 0}).to_list(100)
    
    # Get blocked dates
    blocked_dates = rental.get("blocked_dates", [])
    
    return {
        "rental_id": rental_id,
        "quantity_available": rental.get("quantity_available", 1),
        "bookings": bookings,
        "blocked_dates": blocked_dates
    }

@page_rentals_router.post("/{page_id}/book")
async def book_rental(
    page_id: str,
    request: CreateRentalBookingRequest,
    current_user: dict = Depends(get_current_user)
):
    """Book a rental item"""
    user_id = current_user["user_id"]
    
    rental = await db.page_rentals.find_one({
        "page_id": page_id,
        "rental_id": request.rental_id
    })
    if not rental:
        raise HTTPException(status_code=404, detail="Rental item not found")
    
    # Calculate price based on rental type
    price = 0
    if request.rental_type == "hourly" and rental.get("hourly_rate"):
        # Calculate hours between dates
        price = rental["hourly_rate"] * 24  # Simplified
    elif request.rental_type == "daily" and rental.get("daily_rate"):
        from datetime import datetime as dt
        start = dt.fromisoformat(request.start_date)
        end = dt.fromisoformat(request.end_date)
        days = (end - start).days or 1
        price = rental["daily_rate"] * days
    elif request.rental_type == "weekly" and rental.get("weekly_rate"):
        price = rental["weekly_rate"]
    elif request.rental_type == "monthly" and rental.get("monthly_rate"):
        price = rental["monthly_rate"]
    
    booking = RentalBooking(
        page_id=page_id,
        rental_id=request.rental_id,
        customer_id=user_id,
        start_date=request.start_date,
        end_date=request.end_date,
        rental_type=request.rental_type,
        quantity=request.quantity,
        total_price=price * request.quantity,
        deposit_amount=rental.get("deposit_amount", 0),
        notes=request.notes
    )
    
    booking_dict = booking.model_dump()
    booking_dict["created_at"] = booking_dict["created_at"].isoformat()
    
    await db.page_rental_bookings.insert_one(booking_dict.copy())
    booking_dict.pop("_id", None)
    
    # Update rental stats
    await db.page_rentals.update_one(
        {"rental_id": request.rental_id},
        {"$inc": {"total_rentals": 1}}
    )
    
    # Broadcast update
    await page_sync_manager.broadcast_to_page(page_id, {
        "type": "rental_booking_created",
        "page_id": page_id,
        "booking": booking_dict
    })
    
    return {"booking": booking_dict, "message": "Rental booked successfully"}

# ============== INVENTORY ENDPOINTS ==============

@page_inventory_router.get("/{page_id}")
async def get_inventory(
    page_id: str,
    low_stock_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """Get inventory for a page"""
    user_id = current_user["user_id"]
    await verify_page_owner(page_id, user_id)
    
    query = {"page_id": page_id}
    if low_stock_only:
        query["$expr"] = {"$lte": ["$quantity", "$low_stock_threshold"]}
    
    inventory = await db.page_inventory.find(query, {"_id": 0}).to_list(500)
    return {"inventory": inventory}

@page_inventory_router.put("/{page_id}/{item_id}")
async def update_inventory_quantity(
    page_id: str,
    item_id: str,
    quantity: int,
    location_id: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Update inventory quantity for an item"""
    user_id = current_user["user_id"]
    await verify_page_owner(page_id, user_id)
    
    query = {"page_id": page_id, "item_id": item_id}
    if location_id:
        query["location_id"] = location_id
    
    result = await db.page_inventory.update_one(
        query,
        {
            "$set": {
                "quantity": quantity,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    
    # Broadcast update
    await page_sync_manager.broadcast_to_page(page_id, {
        "type": "inventory_updated",
        "page_id": page_id,
        "item_id": item_id,
        "quantity": quantity
    })
    
    return {"message": "Inventory updated successfully", "quantity": quantity}

@page_inventory_router.post("/{page_id}/bulk-import")
async def bulk_import_inventory(
    page_id: str,
    items: List[Dict[str, Any]],
    current_user: dict = Depends(get_current_user)
):
    """Bulk import inventory items"""
    user_id = current_user["user_id"]
    await verify_page_owner(page_id, user_id)
    
    imported = 0
    for item in items:
        item["page_id"] = page_id
        item["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        await db.page_inventory.update_one(
            {"page_id": page_id, "item_id": item.get("item_id")},
            {"$set": item},
            upsert=True
        )
        imported += 1
    
    return {"message": f"Imported {imported} inventory items"}

# ============== ANALYTICS ENDPOINTS ==============

@page_analytics_router.get("/{page_id}")
async def get_page_analytics(
    page_id: str,
    period: str = "7d",  # 7d, 30d, 90d, 1y
    current_user: dict = Depends(get_current_user)
):
    """Get analytics for a page"""
    user_id = current_user["user_id"]
    await verify_page_owner(page_id, user_id)
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    if period == "7d":
        start_date = now - timedelta(days=7)
    elif period == "30d":
        start_date = now - timedelta(days=30)
    elif period == "90d":
        start_date = now - timedelta(days=90)
    else:
        start_date = now - timedelta(days=365)
    
    start_str = start_date.isoformat()
    
    # Get page stats
    page = await db.member_pages.find_one({"page_id": page_id}, {"_id": 0})
    
    # Get orders in period
    orders = await db.page_orders.find({
        "page_id": page_id,
        "created_at": {"$gte": start_str}
    }).to_list(1000)
    
    # Calculate metrics
    total_orders = len(orders)
    total_revenue = sum(o.get("total", 0) for o in orders)
    completed_orders = len([o for o in orders if o.get("status") == "completed"])
    
    # Get views (from page_views collection or page.total_views)
    views = await db.page_views.count_documents({
        "page_id": page_id,
        "viewed_at": {"$gte": start_str}
    })
    
    # Get top items
    item_sales = {}
    for order in orders:
        for item in order.get("items", []):
            item_id = item.get("item_id")
            if item_id:
                if item_id not in item_sales:
                    item_sales[item_id] = {"name": item.get("name", "Unknown"), "quantity": 0, "revenue": 0}
                item_sales[item_id]["quantity"] += item.get("quantity", 1)
                item_sales[item_id]["revenue"] += item.get("price", 0) * item.get("quantity", 1)
    
    top_items = sorted(item_sales.values(), key=lambda x: x["revenue"], reverse=True)[:10]
    
    # Get referral stats
    referral_signups = await db.users.count_documents({
        "referred_by_page": page_id,
        "created_at": {"$gte": start_str}
    })
    
    return {
        "period": period,
        "overview": {
            "total_views": views or page.get("total_views", 0),
            "total_orders": total_orders,
            "completed_orders": completed_orders,
            "total_revenue": total_revenue,
            "conversion_rate": (total_orders / views * 100) if views > 0 else 0,
            "average_order_value": (total_revenue / total_orders) if total_orders > 0 else 0
        },
        "top_items": top_items,
        "referral_stats": {
            "signups": referral_signups,
            "referral_code": page.get("referral_code", "")
        },
        "rating": {
            "average": page.get("rating_average", 0),
            "count": page.get("rating_count", 0)
        }
    }

@page_analytics_router.get("/{page_id}/export")
async def export_analytics(
    page_id: str,
    format: str = "csv",  # csv, json, excel
    period: str = "30d",
    current_user: dict = Depends(get_current_user)
):
    """Export analytics data"""
    user_id = current_user["user_id"]
    await verify_page_owner(page_id, user_id)
    
    # Get analytics data
    analytics = await get_page_analytics(page_id, period, current_user)
    
    if format == "json":
        return analytics
    elif format == "csv":
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write overview
        writer.writerow(["Metric", "Value"])
        for key, value in analytics["overview"].items():
            writer.writerow([key, value])
        
        writer.writerow([])
        writer.writerow(["Top Items"])
        writer.writerow(["Name", "Quantity", "Revenue"])
        for item in analytics["top_items"]:
            writer.writerow([item["name"], item["quantity"], item["revenue"]])
        
        return {"csv_data": output.getvalue(), "filename": f"analytics_{page_id}_{period}.csv"}
    
    return analytics


@page_analytics_router.get("/{page_id}/daily-report")
async def get_daily_report(
    page_id: str,
    date: str = None,  # YYYY-MM-DD format
    current_user: dict = Depends(get_current_user)
):
    """Get daily sales report for a specific date"""
    user_id = current_user["user_id"]
    
    # Verify page ownership
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Parse date
    if date:
        try:
            report_date = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        report_date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    # Date range for the day
    start_of_day = report_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = start_of_day + timedelta(days=1)
    
    # Fetch orders for the date
    orders = await db.page_orders.find({
        "page_id": page_id,
        "created_at": {
            "$gte": start_of_day.isoformat(),
            "$lt": end_of_day.isoformat()
        }
    }).to_list(1000)
    
    # Summary metrics
    total_sales = sum(o.get("total", 0) for o in orders)
    total_orders = len(orders)
    average_order = total_sales / total_orders if total_orders > 0 else 0
    total_items_sold = sum(
        sum(item.get("quantity", 1) for item in o.get("items", []))
        for o in orders
    )
    
    # Top products
    product_sales = {}
    for order in orders:
        for item in order.get("items", []):
            name = item.get("name", "Unknown")
            if name not in product_sales:
                product_sales[name] = {"name": name, "quantity": 0, "revenue": 0}
            product_sales[name]["quantity"] += item.get("quantity", 1)
            product_sales[name]["revenue"] += item.get("price", 0) * item.get("quantity", 1)
    
    top_products = sorted(product_sales.values(), key=lambda x: x["revenue"], reverse=True)[:5]
    
    # Hourly sales distribution
    hourly_sales = [0] * 24
    for order in orders:
        try:
            order_time = datetime.fromisoformat(order["created_at"].replace("Z", "+00:00"))
            hour = order_time.hour
            hourly_sales[hour] += order.get("total", 0)
        except:
            pass
    
    # Peak hours (top 3)
    peak_hours = [
        {"hour": h, "sales": s}
        for h, s in enumerate(hourly_sales)
        if s > 0
    ]
    peak_hours.sort(key=lambda x: x["sales"], reverse=True)
    peak_hours = peak_hours[:3]
    
    # Payment methods breakdown
    payment_methods = {}
    for order in orders:
        method = order.get("payment_method", "unknown")
        payment_methods[method] = payment_methods.get(method, 0) + order.get("total", 0)
    
    # Order types breakdown
    order_types = {}
    for order in orders:
        otype = order.get("order_type", "pickup")
        order_types[otype] = order_types.get(otype, 0) + 1
    
    return {
        "date": date or start_of_day.strftime("%Y-%m-%d"),
        "page_name": page.get("name"),
        "summary": {
            "total_sales": total_sales,
            "total_orders": total_orders,
            "average_order": average_order,
            "total_items_sold": total_items_sold
        },
        "top_products": top_products,
        "hourly_sales": hourly_sales,
        "peak_hours": peak_hours,
        "payment_methods": payment_methods,
        "order_types": order_types
    }


# ============== EMAIL REPORT SETTINGS ==============

class EmailReportSettings(BaseModel):
    email_enabled: bool = False
    email: Optional[str] = None  # Override email (defaults to owner's email)
    send_hour: int = 23  # Hour to send report (0-23, default 11 PM)
    send_empty_reports: bool = False  # Send reports even with no sales
    timezone: str = "UTC"

@page_analytics_router.get("/{page_id}/email-settings")
async def get_email_report_settings(
    page_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get email report settings for a page"""
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return {
        "settings": page.get("report_settings", {
            "email_enabled": False,
            "email": None,
            "send_hour": 23,
            "send_empty_reports": False,
            "timezone": "UTC"
        }),
        "owner_email": current_user.get("email")
    }

@page_analytics_router.put("/{page_id}/email-settings")
async def update_email_report_settings(
    page_id: str,
    settings: EmailReportSettings,
    current_user: dict = Depends(get_current_user)
):
    """Update email report settings for a page"""
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Validate send_hour
    if settings.send_hour < 0 or settings.send_hour > 23:
        raise HTTPException(status_code=400, detail="send_hour must be between 0 and 23")
    
    await db.member_pages.update_one(
        {"page_id": page_id},
        {"$set": {"report_settings": settings.dict()}}
    )
    
    return {"message": "Email report settings updated", "settings": settings.dict()}

@page_analytics_router.post("/{page_id}/send-test-report")
async def send_test_report(
    page_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Send a test daily report email immediately"""
    from report_scheduler import trigger_report_now
    
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get recipient email
    recipient_email = page.get("report_settings", {}).get("email") or current_user.get("email")
    if not recipient_email:
        raise HTTPException(status_code=400, detail="No email address configured")
    
    result = await trigger_report_now(page_id, recipient_email)
    
    if result.get("status") == "error":
        raise HTTPException(status_code=500, detail=result.get("message"))
    
    return result


# ============== ORDER STATUS UPDATE ==============

class OrderStatusUpdate(BaseModel):
    status: str

@member_pages_router.put("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    request: OrderStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update order status"""
    user_id = current_user["user_id"]
    
    # Find the order
    order = await db.page_orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Verify page ownership
    page = await db.member_pages.find_one({"page_id": order["page_id"]})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    valid_statuses = ["pending", "confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled"]
    if request.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    # Update order status
    update_data = {
        "status": request.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if request.status == "completed":
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.page_orders.update_one(
        {"order_id": order_id},
        {"$set": update_data}
    )
    
    # Broadcast status change via WebSocket
    await page_sync_manager.broadcast_to_page(order["page_id"], {
        "type": "order_status_changed",
        "order_id": order_id,
        "new_status": request.status
    })
    
    return {"message": f"Order status updated to {request.status}", "status": request.status}


# ============== WEBSOCKET ENDPOINT ==============

@member_pages_router.websocket("/ws/{page_id}")
async def page_websocket(websocket: WebSocket, page_id: str):
    """WebSocket endpoint for real-time page sync"""
    # Get token from query params
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Token required")
        return
    
    try:
        # Verify token
        import jwt
        payload = jwt.decode(token, os.environ.get("JWT_SECRET", "secret"), algorithms=["HS256"])
        user_id = payload.get("user_id")
        
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token")
            return
        
        # Connect to page
        await page_sync_manager.connect(websocket, page_id, user_id)
        
        # Send initial connection success
        await websocket.send_json({
            "type": "connected",
            "page_id": page_id,
            "user_id": user_id
        })
        
        # Listen for messages
        try:
            while True:
                data = await websocket.receive_json()
                
                if data.get("type") == "ping":
                    await websocket.send_json({"type": "pong"})
                elif data.get("type") == "subscribe":
                    # Handle additional subscriptions
                    pass
                    
        except WebSocketDisconnect:
            page_sync_manager.disconnect(page_id, user_id)
            logger.info(f"User {user_id} disconnected from page {page_id}")
            
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close(code=4001, reason="Authentication failed")

# ============== EXPORT ROUTERS ==============

async def start_change_streams():
    """Start MongoDB Change Streams for real-time sync - call this on app startup"""
    try:
        await change_stream_manager.start()
    except Exception as e:
        logger.error(f"Failed to start change streams: {e}")

async def stop_change_streams():
    """Stop MongoDB Change Streams - call this on app shutdown"""
    try:
        await change_stream_manager.stop()
    except Exception as e:
        logger.error(f"Failed to stop change streams: {e}")

def get_member_pages_routers():
    """Get all member pages routers"""
    return [
        member_pages_router,
        page_products_router,
        page_menu_router,
        page_services_router,
        page_rentals_router,
        page_inventory_router,
        page_analytics_router
    ]
