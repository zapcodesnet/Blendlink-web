"""
BlendLink Member Pages - Extended Features
Section 2: Analytics, Inventory, Barcode & AI Item Scan
Section 3: Referral System
Section 4: Point of Sale (POS) System
Section 5: Marketplace Integration
Section 6: Customer-facing Options & Google Maps
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, BackgroundTasks, Header
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import logging
import json
import base64
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

# Platform fee constants (mirrored from member_pages_system to avoid circular import)
PLATFORM_FEE_RATE = 0.08  # 8%

async def apply_platform_fee(page_id: str, transaction_total: float, payment_method: str):
    """
    Apply 8% platform fee to a transaction.
    For card payments: fee is deducted automatically from payout
    For cash payments: fee is accumulated and billed monthly
    """
    fee_amount = transaction_total * PLATFORM_FEE_RATE
    
    if payment_method == "cash":
        # Accumulate fee for monthly billing
        await db.member_pages.update_one(
            {"page_id": page_id},
            {"$inc": {"platform_fees_owed": fee_amount}}
        )
        
        # Log the fee
        await db.platform_fee_logs.insert_one({
            "log_id": f"fee_{uuid.uuid4().hex[:12]}",
            "page_id": page_id,
            "transaction_total": transaction_total,
            "fee_amount": fee_amount,
            "fee_rate": PLATFORM_FEE_RATE,
            "payment_method": payment_method,
            "status": "pending",  # pending = owed, paid = settled
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    else:
        # For card payments, fee is auto-deducted (log as paid)
        await db.platform_fee_logs.insert_one({
            "log_id": f"fee_{uuid.uuid4().hex[:12]}",
            "page_id": page_id,
            "transaction_total": transaction_total,
            "fee_amount": fee_amount,
            "fee_rate": PLATFORM_FEE_RATE,
            "payment_method": payment_method,
            "status": "auto_deducted",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return fee_amount

async def verify_page_access_local(page_id: str, user_id: str):
    """Verify user is owner OR an authorized team member (local copy)"""
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    is_owner = page["owner_id"] == user_id
    is_authorized = user_id in page.get("authorized_users", [])
    
    if not is_owner and not is_authorized:
        raise HTTPException(status_code=403, detail="Not authorized to access this page")
    
    return page, is_owner

# ============== ROUTERS ==============
barcode_router = APIRouter(prefix="/barcode", tags=["Barcode Scanning"])
ai_scan_router = APIRouter(prefix="/ai-scan", tags=["AI Item Scan"])
page_referral_router = APIRouter(prefix="/page-referrals", tags=["Page Referrals"])
pos_router = APIRouter(prefix="/pos", tags=["Point of Sale"])
marketplace_link_router = APIRouter(prefix="/marketplace-link", tags=["Marketplace Link"])
customer_options_router = APIRouter(prefix="/customer-options", tags=["Customer Options"])

# Auth helpers - avoiding circular import
import jwt
async def get_current_user(
    authorization: str = Header(None)
):
    """Validate JWT token and return user"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.replace("Bearer ", "")
    jwt_secret = os.environ.get("JWT_SECRET", "blendlink-secret-key")
    
    try:
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Optional user auth helper
from fastapi import Request
async def get_optional_user(request: Request):
    """Get current user if authenticated, else return None"""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    try:
        token = auth_header.replace("Bearer ", "")
        import jwt
        jwt_secret = os.environ.get("JWT_SECRET", "blendlink-secret-key")
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"])
        user_id = payload.get("user_id")
        if not user_id:
            return None
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        return user
    except:
        return None

# ============== SECTION 2: BARCODE SCANNING ==============

class BarcodeSearchRequest(BaseModel):
    barcode: str
    page_id: str

class BarcodeAddRequest(BaseModel):
    barcode: str
    page_id: str
    item_id: str
    item_type: str  # product, menu_item, rental

@barcode_router.post("/search")
async def search_by_barcode(
    request: BarcodeSearchRequest,
    current_user: dict = Depends(get_current_user)
):
    """Search for an item by barcode"""
    barcode = request.barcode.strip()
    page_id = request.page_id
    
    # Search in products
    product = await db.page_products.find_one(
        {"page_id": page_id, "barcode": barcode},
        {"_id": 0}
    )
    if product:
        return {"found": True, "item_type": "product", "item": product}
    
    # Search in menu items (some may have barcodes)
    menu_item = await db.page_menu_items.find_one(
        {"page_id": page_id, "barcode": barcode},
        {"_id": 0}
    )
    if menu_item:
        return {"found": True, "item_type": "menu_item", "item": menu_item}
    
    # Search in rentals
    rental = await db.page_rentals.find_one(
        {"page_id": page_id, "barcode": barcode},
        {"_id": 0}
    )
    if rental:
        return {"found": True, "item_type": "rental", "item": rental}
    
    return {"found": False, "message": "No item found with this barcode"}

@barcode_router.post("/assign")
async def assign_barcode(
    request: BarcodeAddRequest,
    current_user: dict = Depends(get_current_user)
):
    """Assign a barcode to an item"""
    user_id = current_user["user_id"]
    
    # Verify page ownership
    page = await db.member_pages.find_one({"page_id": request.page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if barcode already exists in this page
    existing = await db.page_products.find_one({"page_id": request.page_id, "barcode": request.barcode})
    if existing and existing.get("product_id") != request.item_id:
        raise HTTPException(status_code=400, detail="Barcode already assigned to another item")
    
    # Update the item with barcode
    collection_map = {
        "product": "page_products",
        "menu_item": "page_menu_items",
        "rental": "page_rentals"
    }
    
    collection = collection_map.get(request.item_type)
    if not collection:
        raise HTTPException(status_code=400, detail="Invalid item type")
    
    id_field_map = {
        "product": "product_id",
        "menu_item": "item_id",
        "rental": "rental_id"
    }
    
    result = await db[collection].update_one(
        {"page_id": request.page_id, id_field_map[request.item_type]: request.item_id},
        {"$set": {"barcode": request.barcode}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return {"message": "Barcode assigned successfully", "barcode": request.barcode}

@barcode_router.get("/inventory/{page_id}")
async def get_inventory_with_barcodes(
    page_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all items with barcodes for inventory management"""
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    items = []
    
    # Get products with barcodes
    products = await db.page_products.find(
        {"page_id": page_id, "barcode": {"$exists": True, "$ne": ""}},
        {"_id": 0}
    ).to_list(500)
    for p in products:
        items.append({**p, "item_type": "product"})
    
    # Get rentals with barcodes
    rentals = await db.page_rentals.find(
        {"page_id": page_id, "barcode": {"$exists": True, "$ne": ""}},
        {"_id": 0}
    ).to_list(500)
    for r in rentals:
        items.append({**r, "item_type": "rental"})
    
    return {"items": items, "total": len(items)}


# ============== SECTION 2: AI ITEM SCAN ==============

class AIScanRequest(BaseModel):
    image_base64: str
    page_id: str
    scan_type: str = "identify"  # identify, add_to_cart, check_inventory

@ai_scan_router.post("/scan")
async def ai_scan_item(
    request: AIScanRequest,
    current_user: dict = Depends(get_current_user)
):
    """AI-powered item scanning using OpenAI Vision"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    
    page_id = request.page_id
    
    # Get page and its items
    page = await db.member_pages.find_one({"page_id": page_id}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    # Get all items from the page for matching
    items_list = []
    if page["page_type"] == "store":
        products = await db.page_products.find({"page_id": page_id}, {"_id": 0}).to_list(200)
        items_list = [{"id": p["product_id"], "name": p["name"], "description": p.get("description", ""), 
                       "price": p["price"], "type": "product"} for p in products]
    elif page["page_type"] == "restaurant":
        menu_items = await db.page_menu_items.find({"page_id": page_id}, {"_id": 0}).to_list(200)
        items_list = [{"id": m["item_id"], "name": m["name"], "description": m.get("description", ""),
                       "price": m["price"], "type": "menu_item"} for m in menu_items]
    elif page["page_type"] == "rental":
        rentals = await db.page_rentals.find({"page_id": page_id}, {"_id": 0}).to_list(200)
        items_list = [{"id": r["rental_id"], "name": r["name"], "description": r.get("description", ""),
                       "price": r.get("daily_rate", 0), "type": "rental"} for r in rentals]
    
    if not items_list:
        return {"success": False, "message": "No items in inventory to match against"}
    
    # Create inventory summary for AI
    inventory_summary = "\n".join([f"- {i['name']} (ID: {i['id']}, ${i['price']}): {i['description'][:100]}" 
                                   for i in items_list[:50]])
    
    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        chat = LlmChat(
            api_key=api_key,
            session_id=f"ai_scan_{uuid.uuid4().hex[:8]}",
            system_message=f"""You are an AI item scanner for a {page["page_type"]} business called "{page["name"]}".
Your task is to identify items in images and match them against the inventory.

INVENTORY LIST:
{inventory_summary}

When you identify an item in the image, respond with JSON in this exact format:
{{"matched": true, "item_id": "the_matching_id", "item_name": "name", "confidence": 0.95, "description": "what you see"}}

If no match found:
{{"matched": false, "confidence": 0, "description": "what you see in the image"}}

Only respond with valid JSON, no other text."""
        ).with_model("openai", "gpt-4o")
        
        # Create image content
        image_content = ImageContent(image_base64=request.image_base64)
        
        user_message = UserMessage(
            text="Identify this item and find it in the inventory. Return JSON only.",
            file_contents=[image_content]
        )
        
        response = await chat.send_message(user_message)
        
        # Parse AI response
        try:
            # Clean response - remove markdown code blocks if present
            clean_response = response.strip()
            if clean_response.startswith("```"):
                clean_response = clean_response.split("```")[1]
                if clean_response.startswith("json"):
                    clean_response = clean_response[4:]
            clean_response = clean_response.strip()
            
            result = json.loads(clean_response)
            
            # If matched, get full item details
            if result.get("matched") and result.get("item_id"):
                item_id = result["item_id"]
                item_details = None
                
                # Find the item
                for item in items_list:
                    if item["id"] == item_id:
                        item_details = item
                        break
                
                if item_details:
                    return {
                        "success": True,
                        "matched": True,
                        "item": item_details,
                        "confidence": result.get("confidence", 0.8),
                        "ai_description": result.get("description", "")
                    }
            
            return {
                "success": True,
                "matched": False,
                "ai_description": result.get("description", "No matching item found"),
                "confidence": result.get("confidence", 0)
            }
            
        except json.JSONDecodeError:
            return {
                "success": True,
                "matched": False,
                "ai_description": response[:200],
                "raw_response": response
            }
            
    except Exception as e:
        logger.error(f"AI scan error: {e}")
        return {"success": False, "error": str(e)}


# ============== SECTION 3: REFERRAL SYSTEM ==============

class PageReferralSettings(BaseModel):
    page_id: str
    show_referral_link: bool = True
    referral_position: str = "footer"  # header, footer, sidebar, popup
    referral_reward_type: str = "bl_coins"  # bl_coins, discount, both
    referrer_reward: float = 100  # BL coins or discount %
    referee_reward: float = 50  # BL coins or discount %
    custom_message: str = ""

@page_referral_router.get("/{page_id}/settings")
async def get_referral_settings(
    page_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get referral settings for a page"""
    page = await db.member_pages.find_one({"page_id": page_id}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    settings = page.get("referral_settings", {
        "show_referral_link": True,
        "referral_position": "footer",
        "referral_reward_type": "bl_coins",
        "referrer_reward": 100,
        "referee_reward": 50,
        "custom_message": f"Join {page['name']} and get rewards!"
    })
    
    return {
        "settings": settings,
        "referral_code": page.get("referral_code", ""),
        "referral_link": f"https://blendlink.net/{page['slug']}?ref={page.get('referral_code', '')}"
    }

@page_referral_router.put("/{page_id}/settings")
async def update_referral_settings(
    page_id: str,
    settings: PageReferralSettings,
    current_user: dict = Depends(get_current_user)
):
    """Update referral settings for a page"""
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.member_pages.update_one(
        {"page_id": page_id},
        {"$set": {"referral_settings": settings.model_dump(exclude={"page_id"})}}
    )
    
    return {"message": "Referral settings updated"}

@page_referral_router.get("/{page_id}/stats")
async def get_referral_stats(
    page_id: str,
    period: str = "30d",
    current_user: dict = Depends(get_current_user)
):
    """Get referral statistics for a page"""
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Calculate date range
    now = datetime.now(timezone.utc)
    days = {"7d": 7, "30d": 30, "90d": 90, "1y": 365}.get(period, 30)
    start_date = (now - timedelta(days=days)).isoformat()
    
    # Get referral clicks
    clicks = await db.page_referral_clicks.count_documents({
        "page_id": page_id,
        "clicked_at": {"$gte": start_date}
    })
    
    # Get signups via referral
    signups = await db.page_referral_signups.count_documents({
        "page_id": page_id,
        "signed_up_at": {"$gte": start_date}
    })
    
    # Get orders via referral
    referral_orders = await db.page_orders.find({
        "page_id": page_id,
        "referral_code_used": page.get("referral_code"),
        "created_at": {"$gte": start_date}
    }).to_list(1000)
    
    total_referral_revenue = sum(o.get("total", 0) for o in referral_orders)
    
    # Get top referrers
    top_referrers = await db.page_referral_signups.aggregate([
        {"$match": {"page_id": page_id}},
        {"$group": {"_id": "$referrer_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10}
    ]).to_list(10)
    
    return {
        "period": period,
        "stats": {
            "total_clicks": clicks,
            "total_signups": signups,
            "conversion_rate": (signups / clicks * 100) if clicks > 0 else 0,
            "referral_orders": len(referral_orders),
            "referral_revenue": total_referral_revenue
        },
        "top_referrers": top_referrers,
        "referral_code": page.get("referral_code", "")
    }

@page_referral_router.post("/track-click")
async def track_referral_click(
    page_id: str,
    referral_code: str
):
    """Track a referral link click (public endpoint)"""
    await db.page_referral_clicks.insert_one({
        "click_id": f"click_{uuid.uuid4().hex[:8]}",
        "page_id": page_id,
        "referral_code": referral_code,
        "clicked_at": datetime.now(timezone.utc).isoformat()
    })
    return {"tracked": True}

@page_referral_router.post("/track-signup")
async def track_referral_signup(
    page_id: str,
    referral_code: str,
    user_id: str
):
    """Track a signup via referral"""
    # Verify the referral code belongs to this page
    page = await db.member_pages.find_one({"page_id": page_id, "referral_code": referral_code})
    if not page:
        return {"success": False, "message": "Invalid referral code"}
    
    # Record the signup
    await db.page_referral_signups.insert_one({
        "signup_id": f"signup_{uuid.uuid4().hex[:8]}",
        "page_id": page_id,
        "referral_code": referral_code,
        "user_id": user_id,
        "referrer_id": page["owner_id"],
        "signed_up_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Award BL coins to referrer
    referral_settings = page.get("referral_settings", {})
    referrer_reward = referral_settings.get("referrer_reward", 100)
    
    await db.users.update_one(
        {"user_id": page["owner_id"]},
        {"$inc": {"bl_coins": referrer_reward}}
    )
    
    # Award BL coins to referee
    referee_reward = referral_settings.get("referee_reward", 50)
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"bl_coins": referee_reward}}
    )
    
    return {
        "success": True,
        "referrer_rewarded": referrer_reward,
        "referee_rewarded": referee_reward
    }


# ============== SECTION 4: POINT OF SALE (POS) ==============

class POSTransaction(BaseModel):
    page_id: str
    items: List[Dict[str, Any]]  # [{item_id, name, quantity, price, options}]
    order_type: str  # dine_in, drive_thru, pickup, delivery, shipping
    payment_method: str  # cash, card, digital_wallet
    subtotal: float
    tax: float
    discount: float = 0
    tip: float = 0
    total: float
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    table_number: Optional[str] = None
    notes: str = ""

class POSSettings(BaseModel):
    page_id: str
    tax_rate: float = 0.0
    tip_enabled: bool = True
    tip_presets: List[int] = [15, 18, 20, 25]
    receipt_header: str = ""
    receipt_footer: str = ""
    auto_print_receipt: bool = False
    require_customer_info: bool = False
    enable_table_management: bool = False
    tables: List[Dict[str, Any]] = []

@pos_router.get("/{page_id}/settings")
async def get_pos_settings(
    page_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get POS settings for a page"""
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    settings = page.get("pos_settings", {
        "tax_rate": 0.0,
        "tip_enabled": True,
        "tip_presets": [15, 18, 20, 25],
        "receipt_header": page["name"],
        "receipt_footer": "Thank you for your business!",
        "auto_print_receipt": False,
        "require_customer_info": False,
        "enable_table_management": page["page_type"] == "restaurant",
        "tables": []
    })
    
    return {"settings": settings}

@pos_router.put("/{page_id}/settings")
async def update_pos_settings(
    page_id: str,
    settings: POSSettings,
    current_user: dict = Depends(get_current_user)
):
    """Update POS settings"""
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.member_pages.update_one(
        {"page_id": page_id},
        {"$set": {"pos_settings": settings.model_dump(exclude={"page_id"})}}
    )
    
    return {"message": "POS settings updated"}

@pos_router.post("/transaction")
async def create_pos_transaction(
    transaction: POSTransaction,
    current_user: dict = Depends(get_current_user)
):
    """Create a new POS transaction with 8% platform fee"""
    user_id = current_user["user_id"]
    
    # Use verify_page_access to allow both owner and team members
    page, is_owner = await verify_page_access_local(transaction.page_id, user_id)
    
    # Create order
    order_id = f"pos_{uuid.uuid4().hex[:12]}"
    
    # Calculate 8% platform fee
    platform_fee = transaction.total * PLATFORM_FEE_RATE
    
    order = {
        "order_id": order_id,
        "page_id": transaction.page_id,
        "customer_id": None,  # Walk-in customer
        "customer_name": transaction.customer_name,
        "customer_phone": transaction.customer_phone,
        "order_type": transaction.order_type,
        "status": "completed",  # POS transactions are immediate
        "items": transaction.items,
        "subtotal": transaction.subtotal,
        "tax": transaction.tax,
        "discount": transaction.discount,
        "tip": transaction.tip,
        "total": transaction.total,
        "payment_method": transaction.payment_method,
        "payment_status": "paid",
        "table_number": transaction.table_number,
        "notes": transaction.notes,
        "is_pos_transaction": True,
        "platform_fee": platform_fee,  # Track fee on each order
        "platform_fee_rate": PLATFORM_FEE_RATE,
        "currency": page.get("currency", "USD"),
        "currency_symbol": page.get("currency_symbol", "$"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.page_orders.insert_one(order.copy())
    order.pop("_id", None)
    
    # Apply platform fee (accumulates for cash, logged for card)
    await apply_platform_fee(transaction.page_id, transaction.total, transaction.payment_method)
    
    # Update inventory for each item
    for item in transaction.items:
        item_id = item.get("item_id")
        quantity = item.get("quantity", 1)
        
        # Decrement inventory
        await db.page_inventory.update_one(
            {"page_id": transaction.page_id, "item_id": item_id},
            {"$inc": {"quantity": -quantity}}
        )
        
        # Update product/item sold count
        if page["page_type"] == "store":
            await db.page_products.update_one(
                {"product_id": item_id},
                {"$inc": {"total_sold": quantity}}
            )
        elif page["page_type"] == "restaurant":
            await db.page_menu_items.update_one(
                {"item_id": item_id},
                {"$inc": {"total_ordered": quantity}}
            )
    
    # Update page totals
    await db.member_pages.update_one(
        {"page_id": transaction.page_id},
        {
            "$inc": {
                "total_orders": 1,
                "total_revenue": transaction.total
            }
        }
    )
    
    # Generate receipt with fee info
    receipt = generate_receipt(order, page)
    
    return {
        "success": True,
        "order": order,
        "receipt": receipt,
        "platform_fee": {
            "amount": platform_fee,
            "rate": f"{PLATFORM_FEE_RATE * 100}%",
            "status": "pending" if transaction.payment_method == "cash" else "auto_deducted"
        }
    }

def generate_receipt(order: dict, page: dict) -> dict:
    """Generate a digital receipt"""
    pos_settings = page.get("pos_settings", {})
    
    receipt_lines = []
    receipt_lines.append(pos_settings.get("receipt_header", page["name"]))
    receipt_lines.append("=" * 40)
    receipt_lines.append(f"Order #: {order['order_id']}")
    receipt_lines.append(f"Date: {order['created_at'][:19]}")
    if order.get("table_number"):
        receipt_lines.append(f"Table: {order['table_number']}")
    receipt_lines.append("-" * 40)
    
    for item in order["items"]:
        line = f"{item['quantity']}x {item['name']}"
        price = f"${item['price'] * item['quantity']:.2f}"
        receipt_lines.append(f"{line:<30} {price:>10}")
    
    receipt_lines.append("-" * 40)
    receipt_lines.append(f"{'Subtotal':<30} ${order['subtotal']:.2f}")
    if order.get("tax", 0) > 0:
        receipt_lines.append(f"{'Tax':<30} ${order['tax']:.2f}")
    if order.get("discount", 0) > 0:
        receipt_lines.append(f"{'Discount':<30} -${order['discount']:.2f}")
    if order.get("tip", 0) > 0:
        receipt_lines.append(f"{'Tip':<30} ${order['tip']:.2f}")
    receipt_lines.append("=" * 40)
    receipt_lines.append(f"{'TOTAL':<30} ${order['total']:.2f}")
    receipt_lines.append(f"Payment: {order['payment_method'].upper()}")
    receipt_lines.append("=" * 40)
    receipt_lines.append(pos_settings.get("receipt_footer", "Thank you!"))
    
    return {
        "order_id": order["order_id"],
        "text": "\n".join(receipt_lines),
        "data": order
    }

@pos_router.get("/{page_id}/transactions")
async def get_pos_transactions(
    page_id: str,
    date: str = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get POS transactions for a page"""
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"page_id": page_id, "is_pos_transaction": True}
    
    if date:
        query["created_at"] = {"$regex": f"^{date}"}
    
    transactions = await db.page_orders.find(
        query, {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Calculate daily totals
    total_sales = sum(t.get("total", 0) for t in transactions)
    total_transactions = len(transactions)
    
    return {
        "transactions": transactions,
        "summary": {
            "total_sales": total_sales,
            "total_transactions": total_transactions,
            "average_transaction": total_sales / total_transactions if total_transactions > 0 else 0
        }
    }

@pos_router.get("/{page_id}/tables")
async def get_table_status(
    page_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get table status for restaurant pages"""
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if page["page_type"] != "restaurant":
        raise HTTPException(status_code=400, detail="Table management only for restaurants")
    
    tables = page.get("pos_settings", {}).get("tables", [])
    
    # Get active orders by table
    active_orders = await db.page_orders.find({
        "page_id": page_id,
        "order_type": "dine_in",
        "status": {"$nin": ["completed", "cancelled"]},
        "table_number": {"$exists": True}
    }, {"_id": 0}).to_list(100)
    
    occupied_tables = {o["table_number"]: o for o in active_orders}
    
    table_status = []
    for table in tables:
        table_num = table.get("number")
        status = "available"
        current_order = None
        
        if str(table_num) in occupied_tables:
            status = "occupied"
            current_order = occupied_tables[str(table_num)]
        
        table_status.append({
            **table,
            "status": status,
            "current_order": current_order
        })
    
    return {"tables": table_status}


# ============== POS STRIPE CHECKOUT ==============

class POSCheckoutRequest(BaseModel):
    page_id: str
    items: List[Dict[str, Any]]
    order_type: str
    subtotal: float
    tax: float
    discount: float = 0.0
    tip: float = 0.0
    total: float
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    table_number: Optional[str] = None
    notes: str = ""
    origin_url: str  # Frontend origin URL for success/cancel redirects

@pos_router.post("/checkout/create")
async def create_pos_checkout_session(
    request: POSCheckoutRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a Stripe checkout session for POS card payments"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": request.page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create a pending order first
    order_id = f"pos_{uuid.uuid4().hex[:12]}"
    order = {
        "order_id": order_id,
        "page_id": request.page_id,
        "customer_id": None,
        "customer_name": request.customer_name,
        "customer_phone": request.customer_phone,
        "order_type": request.order_type,
        "status": "pending_payment",
        "items": request.items,
        "subtotal": request.subtotal,
        "tax": request.tax,
        "discount": request.discount,
        "tip": request.tip,
        "total": request.total,
        "payment_method": "card",
        "payment_status": "pending",
        "table_number": request.table_number,
        "notes": request.notes,
        "is_pos_transaction": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.page_orders.insert_one(order.copy())
    order.pop("_id", None)
    
    # Create Stripe checkout session
    api_key = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
    
    # Build URLs from provided origin
    success_url = f"{request.origin_url}/member-pages/{request.page_id}?payment=success&session_id={{CHECKOUT_SESSION_ID}}&order_id={order_id}"
    cancel_url = f"{request.origin_url}/member-pages/{request.page_id}?payment=cancelled&order_id={order_id}"
    
    webhook_url = f"{request.origin_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    # Build item description
    item_desc = ", ".join([f"{i.get('quantity', 1)}x {i.get('name')}" for i in request.items[:3]])
    if len(request.items) > 3:
        item_desc += f" and {len(request.items) - 3} more"
    
    checkout_request = CheckoutSessionRequest(
        amount=float(request.total),  # Keep as float for Stripe
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "order_id": order_id,
            "page_id": request.page_id,
            "page_name": page["name"],
            "order_type": request.order_type,
            "source": "pos_terminal"
        }
    )
    
    try:
        session = await stripe_checkout.create_checkout_session(checkout_request)
        
        # Store session ID with the order
        await db.page_orders.update_one(
            {"order_id": order_id},
            {"$set": {"stripe_session_id": session.session_id}}
        )
        
        # Also create entry in payment_transactions for tracking
        await db.payment_transactions.insert_one({
            "transaction_id": f"ptx_{uuid.uuid4().hex[:12]}",
            "stripe_session_id": session.session_id,
            "order_id": order_id,
            "page_id": request.page_id,
            "user_id": user_id,
            "amount": request.total,
            "currency": "usd",
            "payment_status": "pending",
            "source": "pos_terminal",
            "metadata": checkout_request.metadata,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "success": True,
            "checkout_url": session.url,
            "session_id": session.session_id,
            "order_id": order_id
        }
        
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
        # Mark order as failed
        await db.page_orders.update_one(
            {"order_id": order_id},
            {"$set": {"status": "payment_failed", "payment_status": "failed"}}
        )
        raise HTTPException(status_code=500, detail=f"Payment processing error: {str(e)}")

@pos_router.get("/checkout/status/{session_id}")
async def get_pos_checkout_status(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Check the status of a POS checkout session"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    api_key = os.environ.get("STRIPE_API_KEY", "sk_test_emergent")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
        
        # If paid, update the order
        if status.payment_status == "paid":
            order = await db.page_orders.find_one(
                {"stripe_session_id": session_id},
                {"_id": 0}
            )
            
            if order and order.get("payment_status") != "paid":
                # Update order to completed
                await db.page_orders.update_one(
                    {"stripe_session_id": session_id},
                    {
                        "$set": {
                            "status": "completed",
                            "payment_status": "paid",
                            "completed_at": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
                
                # Update payment transaction
                await db.payment_transactions.update_one(
                    {"stripe_session_id": session_id},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc).isoformat()}}
                )
                
                # Update inventory and page stats
                page = await db.member_pages.find_one({"page_id": order["page_id"]})
                if page:
                    for item in order.get("items", []):
                        item_id = item.get("item_id")
                        quantity = item.get("quantity", 1)
                        
                        await db.page_inventory.update_one(
                            {"page_id": order["page_id"], "item_id": item_id},
                            {"$inc": {"quantity": -quantity}}
                        )
                        
                        if page["page_type"] == "store":
                            await db.page_products.update_one(
                                {"product_id": item_id},
                                {"$inc": {"total_sold": quantity}}
                            )
                    
                    await db.member_pages.update_one(
                        {"page_id": order["page_id"]},
                        {"$inc": {"total_orders": 1, "total_revenue": order["total"]}}
                    )
        
        return {
            "status": status.status,
            "payment_status": status.payment_status,
            "amount_total": status.amount_total,
            "currency": status.currency
        }
        
    except Exception as e:
        logger.error(f"Checkout status error: {e}")
        raise HTTPException(status_code=500, detail=f"Error checking payment status: {str(e)}")


# ============== SECTION 5: MARKETPLACE INTEGRATION ==============

class MarketplaceLinkRequest(BaseModel):
    page_id: str
    listing_id: str
    link: bool = True  # True to link, False to unlink
    unlink: bool = False  # Alternative: True to unlink (backwards compatibility)

@marketplace_link_router.post("/link")
async def link_marketplace_listing(
    request: MarketplaceLinkRequest,
    current_user: dict = Depends(get_current_user)
):
    """Link a marketplace listing to a member page"""
    user_id = current_user["user_id"]
    
    # Handle both 'link: false' and 'unlink: true' for unlinking
    should_link = request.link and not request.unlink
    
    # Verify page ownership
    page = await db.member_pages.find_one({"page_id": request.page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this page")
    
    # Verify listing ownership
    listing = await db.marketplace_listings.find_one({"listing_id": request.listing_id})
    if not listing or listing.get("seller_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this listing")
    
    if should_link:
        # Link the listing to the page
        await db.marketplace_listings.update_one(
            {"listing_id": request.listing_id},
            {"$set": {
                "linked_page_id": request.page_id,
                "linked_page_slug": page["slug"]
            }}
        )
        
        # Also add to page's linked listings
        await db.member_pages.update_one(
            {"page_id": request.page_id},
            {
                "$addToSet": {"linked_listings": request.listing_id},
                "$set": {"marketplace_linked": True}
            }
        )
        
        return {"message": "Listing linked to page", "page_slug": page["slug"]}
    else:
        # Unlink
        await db.marketplace_listings.update_one(
            {"listing_id": request.listing_id},
            {"$unset": {"linked_page_id": "", "linked_page_slug": ""}}
        )
        
        await db.member_pages.update_one(
            {"page_id": request.page_id},
            {"$pull": {"linked_listings": request.listing_id}}
        )
        
        return {"message": "Listing unlinked from page"}

@marketplace_link_router.get("/{page_id}/listings")
async def get_linked_listings(
    page_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all marketplace listings linked to a page"""
    page = await db.member_pages.find_one({"page_id": page_id}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    linked_ids = page.get("linked_listings", [])
    
    listings = await db.marketplace_listings.find(
        {"listing_id": {"$in": linked_ids}},
        {"_id": 0}
    ).to_list(100)
    
    return {"listings": listings, "total": len(listings)}

@marketplace_link_router.get("/available")
async def get_linkable_listings(
    current_user: dict = Depends(get_current_user)
):
    """Get user's marketplace listings that can be linked"""
    user_id = current_user["user_id"]
    
    listings = await db.marketplace_listings.find(
        {"seller_id": user_id},
        {"_id": 0}
    ).to_list(100)
    
    return {"listings": listings}


# ============== SECTION 6: CUSTOMER OPTIONS & GOOGLE MAPS ==============

class LocationUpdate(BaseModel):
    location_id: str
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
    operating_hours: Dict[str, Any] = {}
    is_primary: bool = False

class CustomerOptionsUpdate(BaseModel):
    page_id: str
    order_types: List[str] = []  # dine_in, drive_thru, pickup, delivery, shipping
    delivery_settings: Dict[str, Any] = {}
    pickup_settings: Dict[str, Any] = {}
    shipping_settings: Dict[str, Any] = {}

@customer_options_router.get("/{page_id}/options")
async def get_customer_options(
    page_id: str,
    current_user: dict = Depends(get_optional_user)
):
    """Get customer-facing options for a page (public or owner)"""
    # First try to find published page (public view)
    page = await db.member_pages.find_one(
        {"page_id": page_id, "is_published": True},
        {"_id": 0}
    )
    
    # If not found and user is authenticated, check if they're the owner
    if not page and current_user:
        page = await db.member_pages.find_one(
            {"page_id": page_id, "owner_id": current_user["user_id"]},
            {"_id": 0}
        )
    
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    settings = page.get("settings", {})
    locations = page.get("locations", [])
    
    return {
        "page_id": page_id,
        "page_name": page["name"],
        "order_types": settings.get("order_types", []),
        "locations": locations,
        "delivery_settings": settings.get("delivery_settings", {
            "enabled": "delivery" in settings.get("order_types", []),
            "fee": settings.get("delivery_fee", 0),
            "radius_miles": settings.get("delivery_radius_miles", 10),
            "min_order": settings.get("min_order_amount", 0)
        }),
        "pickup_settings": settings.get("pickup_settings", {
            "enabled": "pickup" in settings.get("order_types", []),
            "lead_time_minutes": 30
        }),
        "shipping_settings": settings.get("shipping_settings", {
            "enabled": "shipping" in settings.get("order_types", []),
            "domestic": True,
            "international": False
        })
    }

@customer_options_router.put("/{page_id}/options")
async def update_customer_options(
    page_id: str,
    options: CustomerOptionsUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update customer-facing options"""
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {
        "settings.order_types": options.order_types,
        "settings.delivery_settings": options.delivery_settings,
        "settings.pickup_settings": options.pickup_settings,
        "settings.shipping_settings": options.shipping_settings,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.member_pages.update_one(
        {"page_id": page_id},
        {"$set": update_data}
    )
    
    return {"message": "Customer options updated"}

@customer_options_router.post("/{page_id}/locations")
async def add_location(
    page_id: str,
    location: LocationUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Add a new location to a page"""
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    location_data = location.model_dump()
    location_data["location_id"] = f"loc_{uuid.uuid4().hex[:8]}"
    
    # If this is primary, unset other primaries
    if location.is_primary:
        await db.member_pages.update_one(
            {"page_id": page_id},
            {"$set": {"locations.$[].is_primary": False}}
        )
    
    await db.member_pages.update_one(
        {"page_id": page_id},
        {"$push": {"locations": location_data}}
    )
    
    return {"message": "Location added", "location": location_data}

@customer_options_router.put("/{page_id}/locations/{location_id}")
async def update_location(
    page_id: str,
    location_id: str,
    location: LocationUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update a location"""
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    location_data = location.model_dump()
    location_data["location_id"] = location_id
    
    # If this is primary, unset other primaries
    if location.is_primary:
        await db.member_pages.update_one(
            {"page_id": page_id},
            {"$set": {"locations.$[].is_primary": False}}
        )
    
    await db.member_pages.update_one(
        {"page_id": page_id, "locations.location_id": location_id},
        {"$set": {"locations.$": location_data}}
    )
    
    return {"message": "Location updated"}

@customer_options_router.delete("/{page_id}/locations/{location_id}")
async def delete_location(
    page_id: str,
    location_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a location"""
    user_id = current_user["user_id"]
    
    page = await db.member_pages.find_one({"page_id": page_id})
    if not page or page["owner_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.member_pages.update_one(
        {"page_id": page_id},
        {"$pull": {"locations": {"location_id": location_id}}}
    )
    
    return {"message": "Location deleted"}

@customer_options_router.get("/{page_id}/map-data")
async def get_map_data(page_id: str):
    """Get location data for Google Maps integration (public)"""
    page = await db.member_pages.find_one(
        {"page_id": page_id},
        {"_id": 0, "locations": 1, "name": 1, "slug": 1}
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    locations = page.get("locations", [])
    
    # Format for Google Maps
    markers = []
    for loc in locations:
        if loc.get("latitude") and loc.get("longitude"):
            markers.append({
                "id": loc["location_id"],
                "name": loc["name"],
                "address": f"{loc['address']}, {loc['city']}, {loc.get('state', '')} {loc.get('postal_code', '')}",
                "lat": loc["latitude"],
                "lng": loc["longitude"],
                "phone": loc.get("phone", ""),
                "hours": loc.get("operating_hours", {}),
                "is_primary": loc.get("is_primary", False)
            })
    
    return {
        "page_name": page["name"],
        "page_slug": page["slug"],
        "markers": markers,
        "center": markers[0] if markers else None
    }

@customer_options_router.post("/calculate-delivery")
async def calculate_delivery(
    page_id: str,
    customer_lat: float,
    customer_lng: float
):
    """Calculate delivery feasibility and fee based on distance"""
    page = await db.member_pages.find_one({"page_id": page_id}, {"_id": 0})
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    
    settings = page.get("settings", {})
    delivery_settings = settings.get("delivery_settings", {})
    locations = page.get("locations", [])
    
    if not delivery_settings.get("enabled", False):
        return {"delivery_available": False, "reason": "Delivery not available"}
    
    # Find nearest location with coordinates
    nearest_location = None
    min_distance = float('inf')
    
    for loc in locations:
        if loc.get("latitude") and loc.get("longitude"):
            # Haversine formula for distance
            import math
            lat1, lon1 = math.radians(loc["latitude"]), math.radians(loc["longitude"])
            lat2, lon2 = math.radians(customer_lat), math.radians(customer_lng)
            
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            
            a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
            c = 2 * math.asin(math.sqrt(a))
            
            # Earth's radius in miles
            r = 3956
            distance = c * r
            
            if distance < min_distance:
                min_distance = distance
                nearest_location = loc
    
    if not nearest_location:
        return {"delivery_available": False, "reason": "No delivery locations configured"}
    
    max_radius = delivery_settings.get("radius_miles", 10)
    
    if min_distance > max_radius:
        return {
            "delivery_available": False,
            "reason": f"Outside delivery area ({min_distance:.1f} miles, max {max_radius} miles)",
            "distance_miles": round(min_distance, 2),
            "nearest_location": nearest_location["name"]
        }
    
    # Calculate delivery fee (could be distance-based)
    base_fee = delivery_settings.get("fee", 0)
    per_mile_fee = delivery_settings.get("per_mile_fee", 0)
    delivery_fee = base_fee + (per_mile_fee * min_distance)
    
    return {
        "delivery_available": True,
        "distance_miles": round(min_distance, 2),
        "delivery_fee": round(delivery_fee, 2),
        "estimated_time_minutes": int(15 + (min_distance * 3)),  # Rough estimate
        "delivering_from": {
            "name": nearest_location["name"],
            "address": nearest_location["address"]
        },
        "min_order": delivery_settings.get("min_order", 0)
    }


# ============== EXPORT ROUTERS ==============

def get_extended_pages_routers():
    """Get all extended pages routers"""
    return [
        barcode_router,
        ai_scan_router,
        page_referral_router,
        pos_router,
        marketplace_link_router,
        customer_options_router
    ]
