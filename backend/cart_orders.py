"""
Blendlink Cart & Order System
- Shopping cart management
- Guest checkout
- Order processing
- Email confirmations via Resend
"""

import os
import logging
import httpx
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
import uuid

logger = logging.getLogger(__name__)

# Resend API configuration
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "orders@blendlink.net")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://blendlink.net")

# Router
cart_router = APIRouter(prefix="/cart", tags=["Cart"])
orders_router = APIRouter(prefix="/orders", tags=["Orders"])

# ============== MODELS ==============

class CartItem(BaseModel):
    listing_id: str
    quantity: int = 1

class AddToCartRequest(BaseModel):
    listing_id: str
    quantity: int = 1

class CheckoutRequest(BaseModel):
    items: List[dict]
    customer: dict
    shipping_address: dict
    shipping_option: Optional[dict] = None
    payment_method: str = "card"
    total_items: float
    shipping_cost: float
    total: float

class OrderStatusUpdate(BaseModel):
    status: str
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None

# ============== EMAIL HELPERS ==============

async def send_email(to: str, subject: str, html: str) -> bool:
    """Send email via Resend API"""
    if not RESEND_API_KEY:
        logger.warning("Resend API key not configured, skipping email")
        return False
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "from": f"Blendlink <{SENDER_EMAIL}>",
                    "to": [to],
                    "subject": subject,
                    "html": html
                }
            )
            
            if response.status_code >= 400:
                logger.error(f"Resend API error: {response.status_code} - {response.text}")
                return False
            
            return True
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return False

def generate_order_confirmation_email(order: dict) -> str:
    """Generate HTML email for order confirmation"""
    items_html = ""
    for item in order.get("items", []):
        items_html += f"""
        <tr>
            <td style="padding: 10px; border-bottom: 1px solid #eee;">
                {item.get('title', 'Item')}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
                ${item.get('price', 0):.2f}
            </td>
        </tr>
        """
    
    shipping_info = order.get("shipping_address", {})
    tracking_html = ""
    if order.get("tracking_number"):
        tracking_html = f"""
        <p><strong>Tracking Number:</strong> {order['tracking_number']}</p>
        <p><a href="{order.get('tracking_url', '#')}" style="color: #6366f1;">Track Your Package</a></p>
        """
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #fff; padding: 20px; border: 1px solid #eee; }}
            .order-table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
            .total-row {{ font-weight: bold; background: #f9f9f9; }}
            .cta-button {{ display: inline-block; background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
            .footer {{ text-align: center; padding: 20px; color: #666; font-size: 12px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Order Confirmed! 🎉</h1>
                <p>Order #{order.get('order_id', 'N/A')}</p>
            </div>
            <div class="content">
                <p>Hi {order.get('customer_name', 'there')},</p>
                <p>Thank you for your purchase on Blendlink! Your order has been confirmed.</p>
                
                <h3>Order Details</h3>
                <table class="order-table">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 10px; text-align: left;">Item</th>
                            <th style="padding: 10px; text-align: right;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items_html}
                        <tr>
                            <td style="padding: 10px;">Shipping</td>
                            <td style="padding: 10px; text-align: right;">${order.get('shipping_cost', 0):.2f}</td>
                        </tr>
                        <tr class="total-row">
                            <td style="padding: 10px;"><strong>Total</strong></td>
                            <td style="padding: 10px; text-align: right;"><strong>${order.get('total', 0):.2f}</strong></td>
                        </tr>
                    </tbody>
                </table>
                
                <h3>Shipping Address</h3>
                <p>
                    {shipping_info.get('name', '')}<br>
                    {shipping_info.get('street1', '')}<br>
                    {shipping_info.get('city', '')}, {shipping_info.get('state', '')} {shipping_info.get('zip', '')}<br>
                    {shipping_info.get('country', 'US')}
                </p>
                
                {tracking_html}
                
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                
                <h3>Join Blendlink Today! 🚀</h3>
                <p>Create a free account to:</p>
                <ul>
                    <li>Track all your orders in one place</li>
                    <li>Faster checkout on future purchases</li>
                    <li>Earn BL coins rewards</li>
                    <li>Get exclusive member discounts</li>
                </ul>
                <a href="{FRONTEND_URL}/register" class="cta-button">Create Account</a>
            </div>
            <div class="footer">
                <p>Questions? Contact us at support@blendlink.net</p>
                <p>© 2026 Blendlink. All rights reserved.</p>
            </div>
        </div>
    </body>
    </html>
    """

def generate_seller_notification_email(order: dict, seller_name: str) -> str:
    """Generate HTML email for seller order notification"""
    items_html = ""
    for item in order.get("items", []):
        if item.get("seller_id") == order.get("_seller_id"):
            items_html += f"""
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">{item.get('title', 'Item')}</td>
                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.get('price', 0):.2f}</td>
            </tr>
            """
    
    shipping = order.get("shipping_address", {})
    shipping_option = order.get("shipping_option", {})
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }}
            .content {{ background: #fff; padding: 20px; border: 1px solid #eee; }}
            .info-box {{ background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 15px; margin: 15px 0; }}
            .cta-button {{ display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>New Order Received! 🛒</h1>
                <p>Order #{order.get('order_id', 'N/A')}</p>
            </div>
            <div class="content">
                <p>Hi {seller_name},</p>
                <p>Great news! You have a new order on Blendlink.</p>
                
                <div class="info-box">
                    <h3 style="margin-top: 0;">Buyer Information</h3>
                    <p><strong>Name:</strong> {order.get('customer_name', 'N/A')}</p>
                    <p><strong>Email:</strong> {order.get('customer_email', 'N/A')}</p>
                    <p><strong>Phone:</strong> {order.get('customer_phone', 'N/A')}</p>
                </div>
                
                <h3>Items Sold</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    {items_html}
                </table>
                
                <div class="info-box">
                    <h3 style="margin-top: 0;">Shipping Details</h3>
                    <p><strong>Ship To:</strong><br>
                    {shipping.get('name', '')}<br>
                    {shipping.get('street1', '')}<br>
                    {shipping.get('city', '')}, {shipping.get('state', '')} {shipping.get('zip', '')}</p>
                    
                    <p><strong>Selected Shipping:</strong> {shipping_option.get('carrier', 'N/A')} - {shipping_option.get('service', 'N/A')}</p>
                    <p><strong>Shipping Cost (paid by buyer):</strong> ${order.get('shipping_cost', 0):.2f}</p>
                </div>
                
                <p><strong>Next Steps:</strong></p>
                <ol>
                    <li>Go to your Seller Dashboard</li>
                    <li>Click "Print Shipping Label" for this order</li>
                    <li>Pack and ship the item</li>
                </ol>
                
                <a href="{FRONTEND_URL}/seller-dashboard" class="cta-button">Go to Seller Dashboard</a>
            </div>
        </div>
    </body>
    </html>
    """

# ============== CART ENDPOINTS ==============

@cart_router.get("")
async def get_cart(request: Request):
    """Get user's cart (or return empty for guests - cart stored in localStorage)"""
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
        
        # Get cart from database
        cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0})
        
        if not cart:
            return {"items": [], "total": 0}
        
        # Enrich items with listing details
        enriched_items = []
        for item in cart.get("items", []):
            listing = await db.listings.find_one(
                {"listing_id": item["listing_id"]},
                {"_id": 0}
            )
            if listing:
                enriched_items.append({
                    **item,
                    "listing": listing
                })
        
        return {
            "items": enriched_items,
            "total": sum(item.get("listing", {}).get("price", 0) * item.get("quantity", 1) for item in enriched_items)
        }
        
    except:
        # Guest user - return empty (cart in localStorage)
        return {"items": [], "total": 0, "guest": True}

@cart_router.post("/add")
async def add_to_cart(data: AddToCartRequest, request: Request):
    """Add item to cart"""
    from server import get_current_user, db
    
    # Verify listing exists
    listing = await db.listings.find_one({"listing_id": data.listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if listing.get("status") != "active":
        raise HTTPException(status_code=400, detail="This item is no longer available")
    
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
        
        # Get or create cart
        cart = await db.carts.find_one({"user_id": user_id})
        
        if cart:
            # Check if item already in cart
            items = cart.get("items", [])
            item_exists = False
            for item in items:
                if item["listing_id"] == data.listing_id:
                    item["quantity"] += data.quantity
                    item_exists = True
                    break
            
            if not item_exists:
                items.append({
                    "listing_id": data.listing_id,
                    "quantity": data.quantity,
                    "added_at": datetime.now(timezone.utc).isoformat()
                })
            
            await db.carts.update_one(
                {"user_id": user_id},
                {"$set": {"items": items, "updated_at": datetime.now(timezone.utc).isoformat()}}
            )
        else:
            await db.carts.insert_one({
                "user_id": user_id,
                "items": [{
                    "listing_id": data.listing_id,
                    "quantity": data.quantity,
                    "added_at": datetime.now(timezone.utc).isoformat()
                }],
                "created_at": datetime.now(timezone.utc).isoformat()
            })
        
        return {"success": True, "message": "Added to cart"}
        
    except:
        # Guest user - return listing info for localStorage cart
        return {
            "success": True,
            "guest": True,
            "item": {
                "listing_id": listing["listing_id"],
                "title": listing["title"],
                "price": listing["price"],
                "image": listing.get("images", [None])[0],
                "quantity": data.quantity,
                "seller_id": listing.get("user_id"),
                "is_digital": listing.get("is_digital", False),
                "weight": listing.get("weight"),
                "dimensions": listing.get("dimensions"),
                "location": listing.get("location")
            }
        }

@cart_router.delete("/remove/{listing_id}")
async def remove_from_cart(listing_id: str, request: Request):
    """Remove item from cart"""
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
        
        await db.carts.update_one(
            {"user_id": user_id},
            {"$pull": {"items": {"listing_id": listing_id}}}
        )
        
        return {"success": True, "message": "Removed from cart"}
    except:
        return {"success": True, "guest": True}

@cart_router.delete("/clear")
async def clear_cart(request: Request):
    """Clear entire cart"""
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
        
        await db.carts.delete_one({"user_id": user_id})
        
        return {"success": True, "message": "Cart cleared"}
    except:
        return {"success": True, "guest": True}

# ============== ORDER ENDPOINTS ==============

@orders_router.post("/checkout")
async def process_checkout(data: CheckoutRequest, request: Request):
    """Process checkout - works for both guests and logged-in users"""
    from server import db
    import stripe
    
    # Validate required fields
    if not data.customer.get("name") or not data.customer.get("email"):
        raise HTTPException(status_code=400, detail="Name and email are required")
    
    if not data.shipping_address.get("street1") or not data.shipping_address.get("zip"):
        # Check if all items are digital
        all_digital = all(item.get("is_digital", False) for item in data.items)
        if not all_digital:
            raise HTTPException(status_code=400, detail="Shipping address required for physical items")
    
    # Get user if logged in
    user_id = None
    try:
        from server import get_current_user
        user = await get_current_user(request)
        user_id = user["user_id"]
    except:
        pass
    
    # Create order
    order_id = f"order_{uuid.uuid4().hex[:12]}"
    
    order = {
        "order_id": order_id,
        "user_id": user_id,
        "is_guest_order": user_id is None,
        "customer_name": data.customer.get("name"),
        "customer_email": data.customer.get("email"),
        "customer_phone": data.customer.get("phone", ""),
        "shipping_address": data.shipping_address,
        "shipping_option": data.shipping_option,
        "items": data.items,
        "total_items": data.total_items,
        "shipping_cost": data.shipping_cost,
        "total": data.total,
        "payment_method": data.payment_method,
        "payment_status": "pending",
        "order_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.insert_one(order.copy())
    
    # Group items by seller for notifications
    sellers = {}
    for item in data.items:
        seller_id = item.get("seller_id")
        if seller_id:
            if seller_id not in sellers:
                sellers[seller_id] = []
            sellers[seller_id].append(item)
    
    # Try Stripe checkout
    try:
        stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")
        
        if stripe.api_key:
            line_items = []
            
            # Add items
            for item in data.items:
                line_items.append({
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": item.get("title", "Item"),
                            "images": [item.get("image")] if item.get("image") else []
                        },
                        "unit_amount": int(float(item.get("price", 0)) * 100),
                    },
                    "quantity": item.get("quantity", 1)
                })
            
            # Add shipping
            if data.shipping_cost > 0:
                line_items.append({
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": f"Shipping ({data.shipping_option.get('carrier', '')} {data.shipping_option.get('service', '')})" if data.shipping_option else "Shipping"
                        },
                        "unit_amount": int(data.shipping_cost * 100),
                    },
                    "quantity": 1
                })
            
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=["card"],
                line_items=line_items,
                mode="payment",
                customer_email=data.customer.get("email"),
                success_url=f"{FRONTEND_URL}/payment/success?order_id={order_id}",
                cancel_url=f"{FRONTEND_URL}/payment/cancel?order_id={order_id}",
                metadata={
                    "order_id": order_id,
                    "is_guest": str(user_id is None).lower()
                }
            )
            
            return {
                "order_id": order_id,
                "payment_url": checkout_session.url,
                "message": "Redirecting to payment"
            }
    except Exception as e:
        logger.error(f"Stripe checkout error: {e}")
    
    # Fallback: Mark as pending payment
    return {
        "order_id": order_id,
        "message": "Order created. Payment will be processed.",
        "status": "pending_payment"
    }

@orders_router.post("/{order_id}/confirm")
async def confirm_order(order_id: str):
    """Confirm order payment (called by webhook or manually)"""
    from server import db
    
    order = await db.orders.find_one({"order_id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Update order status
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": {
            "payment_status": "paid",
            "order_status": "confirmed",
            "confirmed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Send confirmation email to buyer
    email_sent = await send_email(
        to=order.get("customer_email"),
        subject=f"Order Confirmed - #{order_id}",
        html=generate_order_confirmation_email(order)
    )
    
    # Notify sellers
    sellers_notified = []
    for item in order.get("items", []):
        seller_id = item.get("seller_id")
        if seller_id and seller_id not in sellers_notified:
            try:
                # Get seller info
                seller = await db.users.find_one({"user_id": seller_id}, {"_id": 0, "password_hash": 0})
                if seller:
                    # Send notification
                    from notifications_system import notify_order_received
                    await notify_order_received(
                        seller_id=seller_id,
                        order_id=order_id,
                        buyer_name=order.get("customer_name", "A customer"),
                        listing_title=item.get("title", "Your item"),
                        total_amount=order.get("total", 0),
                        shipping_cost=order.get("shipping_cost", 0)
                    )
                    
                    # Send email
                    if seller.get("email"):
                        order_copy = order.copy()
                        order_copy["_seller_id"] = seller_id
                        await send_email(
                            to=seller["email"],
                            subject=f"New Order Received - #{order_id}",
                            html=generate_seller_notification_email(order_copy, seller.get("name", "Seller"))
                        )
                    
                    sellers_notified.append(seller_id)
            except Exception as e:
                logger.error(f"Failed to notify seller {seller_id}: {e}")
    
    # Update listing status (mark as sold for single-item listings)
    for item in order.get("items", []):
        await db.listings.update_one(
            {"listing_id": item.get("listing_id")},
            {"$set": {"status": "sold"}}
        )
    
    return {
        "success": True,
        "order_id": order_id,
        "email_sent": email_sent,
        "sellers_notified": len(sellers_notified)
    }

@orders_router.get("/{order_id}")
async def get_order(order_id: str, request: Request):
    """Get order details"""
    from server import db
    
    order = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return order

@orders_router.get("/seller/list")
async def get_seller_orders(request: Request, skip: int = 0, limit: int = 50):
    """Get orders for a seller"""
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
    except:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Find orders containing this seller's items
    orders = await db.orders.find(
        {"items.seller_id": user_id, "payment_status": "paid"},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return orders

@orders_router.patch("/{order_id}/status")
async def update_order_status(order_id: str, data: OrderStatusUpdate, request: Request):
    """Update order status (seller action)"""
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
    except:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    update_data = {
        "order_status": data.status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if data.tracking_number:
        update_data["tracking_number"] = data.tracking_number
    if data.tracking_url:
        update_data["tracking_url"] = data.tracking_url
    
    await db.orders.update_one(
        {"order_id": order_id},
        {"$set": update_data}
    )
    
    return {"success": True, "message": f"Order status updated to {data.status}"}
