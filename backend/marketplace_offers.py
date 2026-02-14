"""
Blendlink Marketplace Offer System
- Buyer makes offer with $1 refundable deposit
- Counter-offer flow (max 2 offers from each side)
- Stripe integration for deposits and payments
- Real-time notifications via WebSocket
"""

import os
import logging
import stripe
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
import asyncio
import json

logger = logging.getLogger(__name__)

# Initialize Stripe from environment only
api_key = os.environ.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_API_KEY")
if api_key:
    stripe.api_key = api_key
else:
    logger.warning("Stripe API key not configured - payment features will be unavailable")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://blendlink.net")

# Router
offer_router = APIRouter(prefix="/offers", tags=["Marketplace Offers"])

# ============== MODELS ==============

class CreateOfferRequest(BaseModel):
    listing_id: str
    offer_amount: float
    message: Optional[str] = None

class CounterOfferRequest(BaseModel):
    counter_amount: float
    message: Optional[str] = None

class OfferResponse(BaseModel):
    action: str  # "accept", "reject", "counter"
    counter_amount: Optional[float] = None
    message: Optional[str] = None

# ============== WEBSOCKET MANAGER ==============

class OfferWebSocketManager:
    """Manage WebSocket connections for real-time offer updates"""
    
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}  # offer_id -> websockets
        self.user_connections: dict[str, list[WebSocket]] = {}  # user_id -> websockets
    
    async def connect(self, websocket: WebSocket, offer_id: str = None, user_id: str = None):
        await websocket.accept()
        if offer_id:
            if offer_id not in self.active_connections:
                self.active_connections[offer_id] = []
            self.active_connections[offer_id].append(websocket)
        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, offer_id: str = None, user_id: str = None):
        if offer_id and offer_id in self.active_connections:
            if websocket in self.active_connections[offer_id]:
                self.active_connections[offer_id].remove(websocket)
        if user_id and user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
    
    async def broadcast_to_offer(self, offer_id: str, message: dict):
        if offer_id in self.active_connections:
            for connection in self.active_connections[offer_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass
    
    async def send_to_user(self, user_id: str, message: dict):
        if user_id in self.user_connections:
            for connection in self.user_connections[user_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

offer_ws_manager = OfferWebSocketManager()

# ============== HELPER FUNCTIONS ==============

async def create_deposit_payment_intent(offer_id: str, buyer_email: str) -> dict:
    """Create a Stripe PaymentIntent for the $1 refundable deposit"""
    try:
        payment_intent = stripe.PaymentIntent.create(
            amount=100,  # $1.00 in cents
            currency="usd",
            capture_method="manual",  # Don't capture immediately - hold the funds
            metadata={
                "type": "offer_deposit",
                "offer_id": offer_id
            },
            receipt_email=buyer_email,
            description=f"Refundable offer deposit - Offer #{offer_id[:8]}"
        )
        return {
            "client_secret": payment_intent.client_secret,
            "payment_intent_id": payment_intent.id
        }
    except Exception as e:
        logger.error(f"Failed to create deposit PaymentIntent: {e}")
        raise HTTPException(status_code=500, detail="Failed to create deposit payment")

async def capture_deposit(payment_intent_id: str) -> bool:
    """Capture the held deposit (called when offer is accepted)"""
    try:
        stripe.PaymentIntent.capture(payment_intent_id)
        return True
    except Exception as e:
        logger.error(f"Failed to capture deposit: {e}")
        return False

async def cancel_deposit(payment_intent_id: str) -> bool:
    """Cancel/release the held deposit (called when offer is rejected/expired)"""
    try:
        stripe.PaymentIntent.cancel(payment_intent_id)
        return True
    except Exception as e:
        logger.error(f"Failed to cancel deposit: {e}")
        return False

def calculate_remaining_turns(offer: dict) -> dict:
    """Calculate remaining negotiation turns for buyer and seller"""
    history = offer.get("negotiation_history", [])
    
    buyer_counters = sum(1 for h in history if h.get("action") == "counter" and h.get("by") == "buyer")
    seller_counters = sum(1 for h in history if h.get("action") == "counter" and h.get("by") == "seller")
    
    return {
        "buyer_remaining": max(0, 2 - buyer_counters),
        "seller_remaining": max(0, 2 - seller_counters),
        "buyer_counters": buyer_counters,
        "seller_counters": seller_counters
    }

# ============== ENDPOINTS ==============

@offer_router.post("")
async def create_offer(data: CreateOfferRequest, request: Request):
    """
    Create a new offer on a listing.
    Requires $1 refundable deposit via Stripe.
    """
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
        buyer_id = user["user_id"]
        buyer_email = user.get("email", "")
        buyer_name = user.get("name", "")
    except:
        raise HTTPException(status_code=401, detail="Authentication required to make an offer")
    
    # Get listing
    listing = await db.listings.find_one({"listing_id": data.listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if listing.get("status") != "active":
        raise HTTPException(status_code=400, detail="This listing is not available")
    
    seller_id = listing.get("user_id")
    if buyer_id == seller_id:
        raise HTTPException(status_code=400, detail="You cannot make an offer on your own listing")
    
    # Validate offer amount
    if data.offer_amount <= 0:
        raise HTTPException(status_code=400, detail="Offer amount must be positive")
    
    if data.offer_amount > listing.get("price", 0) * 2:
        raise HTTPException(status_code=400, detail="Offer amount seems unreasonable")
    
    # Check for existing pending offer from this buyer on this listing
    existing_offer = await db.marketplace_offers.find_one({
        "listing_id": data.listing_id,
        "buyer_id": buyer_id,
        "status": {"$in": ["pending", "counter_pending"]}
    })
    
    if existing_offer:
        raise HTTPException(status_code=400, detail="You already have a pending offer on this listing")
    
    # Create offer
    offer_id = f"offer_{uuid.uuid4().hex[:12]}"
    
    offer = {
        "offer_id": offer_id,
        "listing_id": data.listing_id,
        "listing_title": listing.get("title"),
        "listing_price": listing.get("price"),
        "listing_image": listing.get("images", [None])[0],
        "buyer_id": buyer_id,
        "buyer_name": buyer_name,
        "buyer_email": buyer_email,
        "seller_id": seller_id,
        "initial_amount": data.offer_amount,
        "current_amount": data.offer_amount,
        "message": data.message,
        "status": "pending_deposit",  # pending_deposit, pending, counter_pending, accepted, rejected, expired, completed
        "deposit_status": "pending",  # pending, held, captured, released
        "deposit_payment_intent_id": None,
        "negotiation_history": [
            {
                "action": "initial_offer",
                "by": "buyer",
                "amount": data.offer_amount,
                "message": data.message,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        ],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    }
    
    await db.marketplace_offers.insert_one(offer.copy())
    
    # Create deposit payment intent
    deposit_info = await create_deposit_payment_intent(offer_id, buyer_email)
    
    # Update offer with payment intent ID
    await db.marketplace_offers.update_one(
        {"offer_id": offer_id},
        {"$set": {"deposit_payment_intent_id": deposit_info["payment_intent_id"]}}
    )
    
    return {
        "offer_id": offer_id,
        "status": "pending_deposit",
        "deposit_client_secret": deposit_info["client_secret"],
        "deposit_amount": 1.00,
        "message": "Please complete the $1 refundable deposit to submit your offer"
    }

@offer_router.post("/{offer_id}/confirm-deposit")
async def confirm_deposit(offer_id: str, request: Request):
    """
    Confirm that the deposit was successfully paid.
    Called after Stripe payment succeeds on frontend.
    """
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
    except:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    offer = await db.marketplace_offers.find_one({"offer_id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer["buyer_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if offer["status"] != "pending_deposit":
        raise HTTPException(status_code=400, detail="Offer is not pending deposit")
    
    # Verify payment intent is captured
    try:
        payment_intent = stripe.PaymentIntent.retrieve(offer["deposit_payment_intent_id"])
        if payment_intent.status not in ["requires_capture", "succeeded"]:
            raise HTTPException(status_code=400, detail="Deposit payment not completed")
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=f"Failed to verify deposit: {str(e)}")
    
    # Update offer status
    await db.marketplace_offers.update_one(
        {"offer_id": offer_id},
        {"$set": {
            "status": "pending",
            "deposit_status": "held",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Notify seller
    try:
        from notifications_system import create_notification
        await create_notification(
            user_id=offer["seller_id"],
            type="new_offer",
            title="New Offer Received!",
            message=f"{offer['buyer_name']} offered ${offer['current_amount']:.2f} for {offer['listing_title']}",
            data={"offer_id": offer_id, "listing_id": offer["listing_id"]}
        )
    except Exception as e:
        logger.error(f"Failed to send offer notification: {e}")
    
    # Send WebSocket update
    await offer_ws_manager.send_to_user(offer["seller_id"], {
        "type": "new_offer",
        "offer_id": offer_id,
        "amount": offer["current_amount"],
        "listing_title": offer["listing_title"]
    })
    
    return {
        "success": True,
        "offer_id": offer_id,
        "status": "pending",
        "message": "Offer submitted! The seller will be notified."
    }

@offer_router.post("/{offer_id}/respond")
async def respond_to_offer(offer_id: str, data: OfferResponse, request: Request):
    """
    Respond to an offer (seller) or counter-offer (buyer/seller).
    Actions: accept, reject, counter
    """
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
    except:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    offer = await db.marketplace_offers.find_one({"offer_id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    # Determine if user is buyer or seller
    is_buyer = user_id == offer["buyer_id"]
    is_seller = user_id == offer["seller_id"]
    
    if not is_buyer and not is_seller:
        raise HTTPException(status_code=403, detail="Not authorized to respond to this offer")
    
    # Check if offer is in a state that can be responded to
    if offer["status"] not in ["pending", "counter_pending"]:
        raise HTTPException(status_code=400, detail=f"Cannot respond to offer with status: {offer['status']}")
    
    # Check whose turn it is
    history = offer.get("negotiation_history", [])
    last_action = history[-1] if history else None
    
    if last_action:
        last_by = last_action.get("by")
        if is_buyer and last_by == "buyer" and last_action.get("action") != "initial_offer":
            raise HTTPException(status_code=400, detail="Waiting for seller response")
        if is_seller and last_by == "seller":
            raise HTTPException(status_code=400, detail="Waiting for buyer response")
    
    turns = calculate_remaining_turns(offer)
    actor = "buyer" if is_buyer else "seller"
    
    # Handle actions
    if data.action == "accept":
        # Accept the current offer amount
        await db.marketplace_offers.update_one(
            {"offer_id": offer_id},
            {
                "$set": {
                    "status": "accepted",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$push": {
                    "negotiation_history": {
                        "action": "accept",
                        "by": actor,
                        "amount": offer["current_amount"],
                        "message": data.message,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                }
            }
        )
        
        # If seller accepts, capture the deposit and prompt buyer to pay full amount
        if is_seller:
            # Capture the $1 deposit
            await capture_deposit(offer["deposit_payment_intent_id"])
            await db.marketplace_offers.update_one(
                {"offer_id": offer_id},
                {"$set": {"deposit_status": "captured"}}
            )
        
        # Notify other party
        notify_user = offer["buyer_id"] if is_seller else offer["seller_id"]
        try:
            from notifications_system import create_notification
            await create_notification(
                user_id=notify_user,
                type="offer_accepted",
                title="Offer Accepted!",
                message=f"Your offer of ${offer['current_amount']:.2f} for {offer['listing_title']} was accepted!",
                data={"offer_id": offer_id, "listing_id": offer["listing_id"]}
            )
        except:
            pass
        
        # WebSocket notification
        await offer_ws_manager.broadcast_to_offer(offer_id, {
            "type": "offer_accepted",
            "offer_id": offer_id,
            "amount": offer["current_amount"],
            "by": actor
        })
        
        return {
            "success": True,
            "status": "accepted",
            "amount": offer["current_amount"],
            "message": "Offer accepted! Proceed to payment to complete the purchase."
        }
    
    elif data.action == "reject":
        # Release the deposit
        await cancel_deposit(offer["deposit_payment_intent_id"])
        
        await db.marketplace_offers.update_one(
            {"offer_id": offer_id},
            {
                "$set": {
                    "status": "rejected",
                    "deposit_status": "released",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$push": {
                    "negotiation_history": {
                        "action": "reject",
                        "by": actor,
                        "message": data.message,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                }
            }
        )
        
        # Notify other party
        notify_user = offer["buyer_id"] if is_seller else offer["seller_id"]
        try:
            from notifications_system import create_notification
            await create_notification(
                user_id=notify_user,
                type="offer_rejected",
                title="Offer Rejected",
                message=f"Your offer for {offer['listing_title']} was rejected.",
                data={"offer_id": offer_id, "listing_id": offer["listing_id"]}
            )
        except:
            pass
        
        # WebSocket notification
        await offer_ws_manager.broadcast_to_offer(offer_id, {
            "type": "offer_rejected",
            "offer_id": offer_id,
            "by": actor
        })
        
        return {
            "success": True,
            "status": "rejected",
            "message": "Offer rejected. The deposit has been released."
        }
    
    elif data.action == "counter":
        # Check remaining turns
        remaining = turns["buyer_remaining"] if is_buyer else turns["seller_remaining"]
        if remaining <= 0:
            raise HTTPException(
                status_code=400, 
                detail="You have no counter-offers remaining. You can only accept or reject."
            )
        
        if not data.counter_amount or data.counter_amount <= 0:
            raise HTTPException(status_code=400, detail="Counter amount required")
        
        await db.marketplace_offers.update_one(
            {"offer_id": offer_id},
            {
                "$set": {
                    "current_amount": data.counter_amount,
                    "status": "counter_pending",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$push": {
                    "negotiation_history": {
                        "action": "counter",
                        "by": actor,
                        "amount": data.counter_amount,
                        "message": data.message,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                }
            }
        )
        
        # Notify other party
        notify_user = offer["buyer_id"] if is_seller else offer["seller_id"]
        try:
            from notifications_system import create_notification
            await create_notification(
                user_id=notify_user,
                type="counter_offer",
                title="Counter-Offer Received",
                message=f"New counter-offer of ${data.counter_amount:.2f} for {offer['listing_title']}",
                data={"offer_id": offer_id, "listing_id": offer["listing_id"]}
            )
        except:
            pass
        
        # WebSocket notification
        await offer_ws_manager.broadcast_to_offer(offer_id, {
            "type": "counter_offer",
            "offer_id": offer_id,
            "amount": data.counter_amount,
            "by": actor
        })
        await offer_ws_manager.send_to_user(notify_user, {
            "type": "counter_offer",
            "offer_id": offer_id,
            "amount": data.counter_amount,
            "listing_title": offer["listing_title"]
        })
        
        new_turns = calculate_remaining_turns({
            "negotiation_history": offer.get("negotiation_history", []) + [{
                "action": "counter",
                "by": actor,
                "amount": data.counter_amount
            }]
        })
        
        return {
            "success": True,
            "status": "counter_pending",
            "current_amount": data.counter_amount,
            "remaining_turns": new_turns,
            "message": "Counter-offer sent!"
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid action")

@offer_router.post("/{offer_id}/complete-purchase")
async def complete_offer_purchase(offer_id: str, request: Request):
    """
    Create Stripe checkout session for the accepted offer amount.
    The $1 deposit is applied to the total.
    """
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
    except:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    offer = await db.marketplace_offers.find_one({"offer_id": offer_id})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    if offer["buyer_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if offer["status"] != "accepted":
        raise HTTPException(status_code=400, detail="Offer must be accepted before payment")
    
    # Calculate amount due (total minus deposit already captured)
    total_amount = offer["current_amount"]
    deposit_captured = 1.00 if offer.get("deposit_status") == "captured" else 0
    amount_due = total_amount - deposit_captured
    
    # Get listing for details
    listing = await db.listings.find_one({"listing_id": offer["listing_id"]}, {"_id": 0})
    
    try:
        # Create Stripe checkout session for remaining amount
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "product_data": {
                            "name": offer["listing_title"],
                            "images": [offer["listing_image"]] if offer.get("listing_image") else [],
                            "description": f"Accepted offer price: ${total_amount:.2f} (${deposit_captured:.2f} deposit already applied)"
                        },
                        "unit_amount": int(amount_due * 100),  # Convert to cents
                    },
                    "quantity": 1
                }
            ],
            mode="payment",
            customer_email=offer["buyer_email"],
            success_url=f"{FRONTEND_URL}/payment/success?offer_id={offer_id}&type=offer",
            cancel_url=f"{FRONTEND_URL}/payment/cancel?offer_id={offer_id}&type=offer",
            metadata={
                "type": "offer_payment",
                "offer_id": offer_id,
                "listing_id": offer["listing_id"]
            }
        )
        
        # Update offer with checkout session
        await db.marketplace_offers.update_one(
            {"offer_id": offer_id},
            {"$set": {
                "checkout_session_id": checkout_session.id,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "payment_url": checkout_session.url,
            "amount_due": amount_due,
            "deposit_applied": deposit_captured,
            "total_price": total_amount
        }
        
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=500, detail=f"Payment error: {str(e)}")

@offer_router.get("/my-offers")
async def get_my_offers(request: Request, role: str = "all", status: str = "all"):
    """
    Get user's offers (as buyer and/or seller).
    """
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
    except:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Build query
    query = {}
    if role == "buyer":
        query["buyer_id"] = user_id
    elif role == "seller":
        query["seller_id"] = user_id
    else:
        query["$or"] = [{"buyer_id": user_id}, {"seller_id": user_id}]
    
    if status != "all":
        query["status"] = status
    
    offers = await db.marketplace_offers.find(
        query, 
        {"_id": 0}
    ).sort("updated_at", -1).limit(100).to_list(100)
    
    # Add role indicator and remaining turns
    for offer in offers:
        offer["is_buyer"] = offer["buyer_id"] == user_id
        offer["is_seller"] = offer["seller_id"] == user_id
        offer["remaining_turns"] = calculate_remaining_turns(offer)
    
    return {"offers": offers}

@offer_router.get("/{offer_id}")
async def get_offer_detail(offer_id: str, request: Request):
    """Get detailed offer information."""
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
    except:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    offer = await db.marketplace_offers.find_one({"offer_id": offer_id}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    # Only buyer or seller can view
    if user_id != offer["buyer_id"] and user_id != offer["seller_id"]:
        raise HTTPException(status_code=403, detail="Not authorized to view this offer")
    
    offer["is_buyer"] = user_id == offer["buyer_id"]
    offer["is_seller"] = user_id == offer["seller_id"]
    offer["remaining_turns"] = calculate_remaining_turns(offer)
    
    # Get buyer/seller info
    buyer = await db.users.find_one({"user_id": offer["buyer_id"]}, {"_id": 0, "password_hash": 0})
    seller = await db.users.find_one({"user_id": offer["seller_id"]}, {"_id": 0, "password_hash": 0})
    
    offer["buyer"] = {
        "user_id": buyer.get("user_id") if buyer else None,
        "name": buyer.get("name") if buyer else "Unknown",
        "username": buyer.get("username") if buyer else None,
        "avatar": buyer.get("avatar") or buyer.get("picture") if buyer else None
    }
    offer["seller"] = {
        "user_id": seller.get("user_id") if seller else None,
        "name": seller.get("name") if seller else "Unknown", 
        "username": seller.get("username") if seller else None,
        "avatar": seller.get("avatar") or seller.get("picture") if seller else None
    }
    
    return offer

@offer_router.get("/listing/{listing_id}")
async def get_listing_offers(listing_id: str, request: Request):
    """Get all offers for a listing (seller only)."""
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
    except:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Verify user owns the listing
    listing = await db.listings.find_one({"listing_id": listing_id})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if listing.get("user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view these offers")
    
    offers = await db.marketplace_offers.find(
        {"listing_id": listing_id, "status": {"$ne": "pending_deposit"}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"offers": offers}

# ============== WEBSOCKET ENDPOINT ==============

@offer_router.websocket("/ws/{offer_id}")
async def offer_websocket(websocket: WebSocket, offer_id: str):
    """WebSocket for real-time offer updates."""
    await offer_ws_manager.connect(websocket, offer_id=offer_id)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            # Echo back for heartbeat
            await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        offer_ws_manager.disconnect(websocket, offer_id=offer_id)
