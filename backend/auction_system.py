"""
Blendlink Auction System
- Fixed Price vs Auction listing toggle
- Duration options: 1h, 3h, 6h, 12h, 1d, 2d, 3d, 5d, 7d
- Starting bid, reserve price (optional), buy it now price (optional)
- Auto-extend if bid in last 5 minutes
- Real-time countdown via WebSocket
- Post-auction: offer to 2nd-highest bidder
"""

import os
import logging
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
import json

logger = logging.getLogger(__name__)

# Router
auction_router = APIRouter(prefix="/auctions", tags=["Auctions"])

# ============== MODELS ==============

class AuctionSettings(BaseModel):
    """Auction settings for a listing"""
    is_auction: bool = False
    duration: str = "1d"  # 1h, 3h, 6h, 12h, 1d, 2d, 3d, 5d, 7d
    starting_bid: Optional[float] = None
    reserve_price: Optional[float] = None
    buy_it_now_price: Optional[float] = None
    auto_relist: bool = False
    auto_extend: bool = True  # Extend by 5 min if bid in last 5 min

class PlaceBidRequest(BaseModel):
    amount: float
    max_bid: Optional[float] = None  # For auto-bidding

class AuctionOffer(BaseModel):
    """Offer to losing bidders after auction ends"""
    offer_price: float
    message: Optional[str] = None
    bidder_ids: List[str] = []  # Empty = all losing bidders

# Duration mapping
DURATION_MAP = {
    "1h": timedelta(hours=1),
    "3h": timedelta(hours=3),
    "6h": timedelta(hours=6),
    "12h": timedelta(hours=12),
    "1d": timedelta(days=1),
    "2d": timedelta(days=2),
    "3d": timedelta(days=3),
    "5d": timedelta(days=5),
    "7d": timedelta(days=7),
}

# ============== WEBSOCKET MANAGER ==============

class AuctionWebSocketManager:
    """Manage WebSocket connections for real-time auction updates"""
    
    def __init__(self):
        self.auction_connections: dict[str, list[WebSocket]] = {}  # listing_id -> websockets
    
    async def connect(self, websocket: WebSocket, listing_id: str):
        await websocket.accept()
        if listing_id not in self.auction_connections:
            self.auction_connections[listing_id] = []
        self.auction_connections[listing_id].append(websocket)
        logger.info(f"WebSocket connected for auction {listing_id}")
    
    def disconnect(self, websocket: WebSocket, listing_id: str):
        if listing_id in self.auction_connections:
            if websocket in self.auction_connections[listing_id]:
                self.auction_connections[listing_id].remove(websocket)
                logger.info(f"WebSocket disconnected from auction {listing_id}")
    
    async def broadcast_to_auction(self, listing_id: str, message: dict):
        """Broadcast message to all connected clients for an auction"""
        if listing_id in self.auction_connections:
            disconnected = []
            for websocket in self.auction_connections[listing_id]:
                try:
                    await websocket.send_json(message)
                except Exception:
                    disconnected.append(websocket)
            # Clean up disconnected
            for ws in disconnected:
                self.auction_connections[listing_id].remove(ws)

auction_ws_manager = AuctionWebSocketManager()

# ============== HELPER FUNCTIONS ==============

def get_auction_end_time(duration: str, start_time: datetime = None) -> datetime:
    """Calculate auction end time from duration string"""
    if start_time is None:
        start_time = datetime.now(timezone.utc)
    delta = DURATION_MAP.get(duration, timedelta(days=1))
    return start_time + delta

def calculate_time_remaining(end_time: str) -> dict:
    """Calculate time remaining in auction"""
    end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    remaining = end_dt - now
    
    if remaining.total_seconds() <= 0:
        return {"ended": True, "seconds": 0, "display": "Ended"}
    
    total_seconds = int(remaining.total_seconds())
    days = total_seconds // 86400
    hours = (total_seconds % 86400) // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    
    if days > 0:
        display = f"{days}d {hours}h"
    elif hours > 0:
        display = f"{hours}h {minutes}m"
    elif minutes > 0:
        display = f"{minutes}m {seconds}s"
    else:
        display = f"{seconds}s"
    
    return {
        "ended": False,
        "seconds": total_seconds,
        "days": days,
        "hours": hours,
        "minutes": minutes,
        "remaining_seconds": seconds,
        "display": display
    }

async def check_auto_extend(listing_id: str, db) -> bool:
    """Check if auction should be extended (bid in last 5 minutes)"""
    listing = await db.listings.find_one({"listing_id": listing_id})
    if not listing or not listing.get("auction"):
        return False
    
    auction = listing["auction"]
    if not auction.get("auto_extend", True):
        return False
    
    end_time = datetime.fromisoformat(auction["end_time"].replace('Z', '+00:00'))
    now = datetime.now(timezone.utc)
    time_remaining = (end_time - now).total_seconds()
    
    # If bid placed in last 5 minutes, extend by 5 minutes
    if 0 < time_remaining <= 300:  # 5 minutes = 300 seconds
        new_end_time = end_time + timedelta(minutes=5)
        await db.listings.update_one(
            {"listing_id": listing_id},
            {"$set": {
                "auction.end_time": new_end_time.isoformat(),
                "auction.extended": True,
                "auction.extension_count": auction.get("extension_count", 0) + 1
            }}
        )
        logger.info(f"Auction {listing_id} extended by 5 minutes")
        return True
    
    return False

# ============== ENDPOINTS ==============

@auction_router.post("/listing/{listing_id}/bid")
async def place_bid(listing_id: str, data: PlaceBidRequest, request: Request):
    """Place a bid on an auction listing"""
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
        bidder_id = user["user_id"]
        bidder_name = user.get("name", "")
        bidder_username = user.get("username", "")
    except:
        raise HTTPException(status_code=401, detail="Authentication required to bid")
    
    # Get listing
    listing = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if not listing.get("auction") or not listing["auction"].get("is_auction"):
        raise HTTPException(status_code=400, detail="This is not an auction listing")
    
    auction = listing["auction"]
    
    # Check if auction has ended
    end_time = datetime.fromisoformat(auction["end_time"].replace('Z', '+00:00'))
    if datetime.now(timezone.utc) >= end_time:
        raise HTTPException(status_code=400, detail="This auction has ended")
    
    # Check if user is the seller
    if listing.get("user_id") == bidder_id:
        raise HTTPException(status_code=400, detail="You cannot bid on your own listing")
    
    # Validate bid amount
    current_bid = auction.get("current_bid", auction.get("starting_bid", 0))
    min_bid_increment = max(1, current_bid * 0.05)  # 5% or $1 minimum increment
    min_next_bid = current_bid + min_bid_increment if auction.get("bid_count", 0) > 0 else auction.get("starting_bid", 1)
    
    if data.amount < min_next_bid:
        raise HTTPException(
            status_code=400, 
            detail=f"Minimum bid is ${min_next_bid:.2f}"
        )
    
    # Check buy it now price
    if auction.get("buy_it_now_price") and data.amount >= auction["buy_it_now_price"]:
        # Instant purchase
        await db.listings.update_one(
            {"listing_id": listing_id},
            {"$set": {
                "auction.status": "sold",
                "auction.current_bid": auction["buy_it_now_price"],
                "auction.winning_bidder_id": bidder_id,
                "auction.winning_bidder_name": bidder_name,
                "auction.sold_via": "buy_it_now",
                "status": "sold"
            }}
        )
        
        # Notify seller
        try:
            from notifications_system import create_notification
            await create_notification(
                user_id=listing["user_id"],
                type="auction_sold",
                title="Item Sold via Buy It Now!",
                message=f"{bidder_name} purchased {listing['title']} for ${auction['buy_it_now_price']:.2f}",
                data={"listing_id": listing_id}
            )
        except:
            pass
        
        await auction_ws_manager.broadcast_to_auction(listing_id, {
            "type": "auction_ended",
            "status": "sold",
            "sold_via": "buy_it_now",
            "final_price": auction["buy_it_now_price"],
            "winner_id": bidder_id,
            "winner_name": bidder_name
        })
        
        return {
            "success": True,
            "type": "buy_it_now",
            "message": "Congratulations! You won with Buy It Now!",
            "final_price": auction["buy_it_now_price"]
        }
    
    # Create bid record
    bid_id = f"bid_{uuid.uuid4().hex[:12]}"
    bid = {
        "bid_id": bid_id,
        "listing_id": listing_id,
        "bidder_id": bidder_id,
        "bidder_name": bidder_name,
        "bidder_username": bidder_username,
        "amount": data.amount,
        "max_bid": data.max_bid,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.auction_bids.insert_one(bid.copy())
    
    # Update listing auction data
    update_data = {
        "auction.current_bid": data.amount,
        "auction.current_bidder_id": bidder_id,
        "auction.current_bidder_name": bidder_name,
        "auction.bid_count": auction.get("bid_count", 0) + 1,
        "auction.last_bid_time": datetime.now(timezone.utc).isoformat()
    }
    
    await db.listings.update_one({"listing_id": listing_id}, {"$set": update_data})
    
    # Check auto-extend
    extended = await check_auto_extend(listing_id, db)
    
    # Get updated time remaining
    updated_listing = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    time_remaining = calculate_time_remaining(updated_listing["auction"]["end_time"])
    
    # Notify previous high bidder (if any)
    previous_bidder_id = auction.get("current_bidder_id")
    if previous_bidder_id and previous_bidder_id != bidder_id:
        try:
            from notifications_system import create_notification
            await create_notification(
                user_id=previous_bidder_id,
                type="outbid",
                title="You've been outbid!",
                message=f"Someone bid ${data.amount:.2f} on {listing['title']}",
                data={"listing_id": listing_id, "new_bid": data.amount}
            )
        except:
            pass
    
    # Notify seller of new bid
    try:
        from notifications_system import create_notification
        await create_notification(
            user_id=listing["user_id"],
            type="new_bid",
            title="New Bid Received!",
            message=f"{bidder_name} bid ${data.amount:.2f} on {listing['title']}",
            data={"listing_id": listing_id, "amount": data.amount}
        )
    except:
        pass
    
    # Broadcast to all connected clients
    await auction_ws_manager.broadcast_to_auction(listing_id, {
        "type": "new_bid",
        "bid_id": bid_id,
        "amount": data.amount,
        "bidder_name": bidder_name,
        "bidder_id": bidder_id,
        "bid_count": auction.get("bid_count", 0) + 1,
        "time_remaining": time_remaining,
        "extended": extended
    })
    
    return {
        "success": True,
        "bid_id": bid_id,
        "amount": data.amount,
        "bid_count": auction.get("bid_count", 0) + 1,
        "time_remaining": time_remaining,
        "extended": extended,
        "message": "Bid placed successfully!"
    }

@auction_router.get("/listing/{listing_id}/bids")
async def get_auction_bids(listing_id: str, limit: int = 50):
    """Get bid history for an auction listing"""
    from server import db
    
    # Verify listing exists and is an auction
    listing = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if not listing.get("auction") or not listing["auction"].get("is_auction"):
        raise HTTPException(status_code=400, detail="This is not an auction listing")
    
    # Get bids
    bids = await db.auction_bids.find(
        {"listing_id": listing_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Get auction status
    auction = listing["auction"]
    time_remaining = calculate_time_remaining(auction["end_time"])
    
    return {
        "listing_id": listing_id,
        "bids": bids,
        "current_bid": auction.get("current_bid", auction.get("starting_bid", 0)),
        "bid_count": auction.get("bid_count", 0),
        "starting_bid": auction.get("starting_bid"),
        "reserve_price": auction.get("reserve_price"),
        "buy_it_now_price": auction.get("buy_it_now_price"),
        "time_remaining": time_remaining,
        "reserve_met": auction.get("current_bid", 0) >= (auction.get("reserve_price") or 0)
    }

@auction_router.get("/listing/{listing_id}/status")
async def get_auction_status(listing_id: str):
    """Get current auction status with time remaining"""
    from server import db
    
    listing = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if not listing.get("auction") or not listing["auction"].get("is_auction"):
        raise HTTPException(status_code=400, detail="This is not an auction listing")
    
    auction = listing["auction"]
    time_remaining = calculate_time_remaining(auction["end_time"])
    reserve_met = auction.get("current_bid", 0) >= (auction.get("reserve_price") or 0)
    
    return {
        "listing_id": listing_id,
        "status": auction.get("status", "active"),
        "current_bid": auction.get("current_bid", auction.get("starting_bid", 0)),
        "starting_bid": auction.get("starting_bid"),
        "reserve_price": auction.get("reserve_price"),
        "buy_it_now_price": auction.get("buy_it_now_price"),
        "bid_count": auction.get("bid_count", 0),
        "current_bidder_id": auction.get("current_bidder_id"),
        "current_bidder_name": auction.get("current_bidder_name"),
        "time_remaining": time_remaining,
        "end_time": auction.get("end_time"),
        "reserve_met": reserve_met,
        "auto_extend": auction.get("auto_extend", True),
        "extended": auction.get("extended", False),
        "extension_count": auction.get("extension_count", 0)
    }

@auction_router.post("/listing/{listing_id}/end")
async def end_auction(listing_id: str, request: Request):
    """Manually end an auction (seller only, or system for expired auctions)"""
    from server import get_current_user, db
    
    listing = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if not listing.get("auction") or not listing["auction"].get("is_auction"):
        raise HTTPException(status_code=400, detail="This is not an auction listing")
    
    # Verify seller
    try:
        user = await get_current_user(request)
        if user["user_id"] != listing["user_id"]:
            raise HTTPException(status_code=403, detail="Only the seller can end this auction")
    except HTTPException:
        raise
    except:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    auction = listing["auction"]
    
    # Determine outcome
    reserve_met = auction.get("current_bid", 0) >= (auction.get("reserve_price") or 0)
    has_bids = auction.get("bid_count", 0) > 0
    
    if has_bids and reserve_met:
        # Auction successful - winner!
        status = "sold"
        await db.listings.update_one(
            {"listing_id": listing_id},
            {"$set": {
                "auction.status": "sold",
                "auction.ended_at": datetime.now(timezone.utc).isoformat(),
                "status": "sold"
            }}
        )
        
        # Notify winner
        winner_id = auction.get("current_bidder_id")
        if winner_id:
            try:
                from notifications_system import create_notification
                await create_notification(
                    user_id=winner_id,
                    type="auction_won",
                    title="Congratulations! You won!",
                    message=f"You won {listing['title']} with a bid of ${auction['current_bid']:.2f}",
                    data={"listing_id": listing_id}
                )
            except:
                pass
        
        result = {
            "status": "sold",
            "winner_id": winner_id,
            "winner_name": auction.get("current_bidder_name"),
            "final_price": auction.get("current_bid"),
            "message": "Auction ended successfully! Contact the winner to arrange payment."
        }
    elif has_bids and not reserve_met:
        # Reserve not met
        status = "reserve_not_met"
        await db.listings.update_one(
            {"listing_id": listing_id},
            {"$set": {
                "auction.status": "reserve_not_met",
                "auction.ended_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        result = {
            "status": "reserve_not_met",
            "highest_bid": auction.get("current_bid"),
            "reserve_price": auction.get("reserve_price"),
            "message": "Reserve price was not met. You can offer the item to bidders."
        }
    else:
        # No bids
        status = "no_bids"
        if auction.get("auto_relist"):
            # Auto-relist
            new_end_time = get_auction_end_time(auction.get("duration", "1d"))
            await db.listings.update_one(
                {"listing_id": listing_id},
                {"$set": {
                    "auction.status": "active",
                    "auction.end_time": new_end_time.isoformat(),
                    "auction.relist_count": auction.get("relist_count", 0) + 1,
                    "auction.current_bid": None,
                    "auction.current_bidder_id": None,
                    "auction.current_bidder_name": None,
                    "auction.bid_count": 0
                }}
            )
            result = {
                "status": "relisted",
                "new_end_time": new_end_time.isoformat(),
                "message": "No bids received. Auction has been automatically relisted."
            }
        else:
            await db.listings.update_one(
                {"listing_id": listing_id},
                {"$set": {
                    "auction.status": "ended_no_bids",
                    "auction.ended_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            result = {
                "status": "no_bids",
                "message": "Auction ended with no bids. You can relist or convert to fixed price."
            }
    
    # Broadcast end to all connected clients
    await auction_ws_manager.broadcast_to_auction(listing_id, {
        "type": "auction_ended",
        **result
    })
    
    return result

@auction_router.post("/listing/{listing_id}/offer-to-bidders")
async def offer_to_losing_bidders(listing_id: str, data: AuctionOffer, request: Request):
    """Offer item to losing bidders (2nd place or all) after auction ends"""
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
    except:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    listing = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if user["user_id"] != listing.get("user_id"):
        raise HTTPException(status_code=403, detail="Only the seller can make offers")
    
    auction = listing.get("auction", {})
    if auction.get("status") not in ["sold", "reserve_not_met", "ended_no_bids"]:
        raise HTTPException(status_code=400, detail="Auction must be ended to offer to bidders")
    
    # Get losing bidders
    winning_bidder_id = auction.get("current_bidder_id")
    
    query = {"listing_id": listing_id}
    if data.bidder_ids:
        query["bidder_id"] = {"$in": data.bidder_ids}
    elif winning_bidder_id:
        query["bidder_id"] = {"$ne": winning_bidder_id}
    
    bidders = await db.auction_bids.find(query, {"_id": 0}).to_list(100)
    
    # Get unique bidder IDs
    unique_bidder_ids = list(set([b["bidder_id"] for b in bidders]))
    
    if not unique_bidder_ids:
        raise HTTPException(status_code=400, detail="No bidders to offer to")
    
    # Create offers
    offers_created = 0
    for bidder_id in unique_bidder_ids:
        offer_id = f"post_auction_{uuid.uuid4().hex[:12]}"
        
        offer = {
            "offer_id": offer_id,
            "type": "post_auction_offer",
            "listing_id": listing_id,
            "listing_title": listing.get("title"),
            "listing_image": listing.get("images", [None])[0],
            "seller_id": user["user_id"],
            "bidder_id": bidder_id,
            "offer_price": data.offer_price,
            "message": data.message,
            "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.post_auction_offers.insert_one(offer.copy())
        
        # Notify bidder
        try:
            from notifications_system import create_notification
            await create_notification(
                user_id=bidder_id,
                type="post_auction_offer",
                title="Special Offer from Seller!",
                message=f"The seller is offering you {listing['title']} for ${data.offer_price:.2f}",
                data={"offer_id": offer_id, "listing_id": listing_id}
            )
        except:
            pass
        
        offers_created += 1
    
    return {
        "success": True,
        "offers_created": offers_created,
        "message": f"Offers sent to {offers_created} bidder(s)"
    }

@auction_router.post("/listing/{listing_id}/relist")
async def relist_auction(listing_id: str, request: Request, duration: str = "1d"):
    """Relist an ended auction"""
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
    except:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    listing = await db.listings.find_one({"listing_id": listing_id}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if user["user_id"] != listing.get("user_id"):
        raise HTTPException(status_code=403, detail="Only the seller can relist")
    
    auction = listing.get("auction", {})
    if auction.get("status") == "active":
        raise HTTPException(status_code=400, detail="Auction is still active")
    
    # Validate duration
    if duration not in DURATION_MAP:
        raise HTTPException(status_code=400, detail="Invalid duration")
    
    # Reset auction
    new_end_time = get_auction_end_time(duration)
    
    await db.listings.update_one(
        {"listing_id": listing_id},
        {"$set": {
            "auction.status": "active",
            "auction.duration": duration,
            "auction.end_time": new_end_time.isoformat(),
            "auction.relist_count": auction.get("relist_count", 0) + 1,
            "auction.current_bid": None,
            "auction.current_bidder_id": None,
            "auction.current_bidder_name": None,
            "auction.bid_count": 0,
            "auction.extended": False,
            "auction.extension_count": 0,
            "status": "active"
        }}
    )
    
    return {
        "success": True,
        "new_end_time": new_end_time.isoformat(),
        "duration": duration,
        "message": "Auction relisted successfully!"
    }

@auction_router.get("/active")
async def get_active_auctions(skip: int = 0, limit: int = 20, ending_soon: bool = False):
    """Get active auction listings"""
    from server import db
    
    query = {
        "auction.is_auction": True,
        "auction.status": "active",
        "status": "active"
    }
    
    sort_field = "auction.end_time" if ending_soon else "created_at"
    sort_order = 1 if ending_soon else -1  # Ascending for ending soon
    
    listings = await db.listings.find(
        query,
        {"_id": 0}
    ).sort(sort_field, sort_order).skip(skip).limit(limit).to_list(limit)
    
    # Add time remaining to each
    for listing in listings:
        if listing.get("auction") and listing["auction"].get("end_time"):
            listing["auction"]["time_remaining"] = calculate_time_remaining(listing["auction"]["end_time"])
    
    total = await db.listings.count_documents(query)
    
    return {
        "listings": listings,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@auction_router.get("/my-bids")
async def get_my_bids(request: Request, status: str = "all"):
    """Get user's bid history"""
    from server import get_current_user, db
    
    try:
        user = await get_current_user(request)
    except:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Get all bids by user
    bids = await db.auction_bids.find(
        {"bidder_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    
    # Get unique listing IDs
    listing_ids = list(set([b["listing_id"] for b in bids]))
    
    # Get listings
    listings = {}
    if listing_ids:
        listing_docs = await db.listings.find(
            {"listing_id": {"$in": listing_ids}},
            {"_id": 0}
        ).to_list(len(listing_ids))
        listings = {l["listing_id"]: l for l in listing_docs}
    
    # Enrich bids with listing info
    enriched_bids = []
    for bid in bids:
        listing = listings.get(bid["listing_id"], {})
        auction = listing.get("auction", {})
        
        bid_status = "active"
        if auction.get("status") == "sold":
            if auction.get("current_bidder_id") == user["user_id"]:
                bid_status = "won"
            else:
                bid_status = "lost"
        elif auction.get("status") in ["reserve_not_met", "ended_no_bids"]:
            bid_status = "ended"
        elif auction.get("current_bidder_id") != user["user_id"]:
            bid_status = "outbid"
        
        if status != "all" and bid_status != status:
            continue
        
        enriched_bids.append({
            **bid,
            "listing_title": listing.get("title"),
            "listing_image": listing.get("images", [None])[0] if listing.get("images") else None,
            "current_bid": auction.get("current_bid"),
            "auction_status": auction.get("status"),
            "is_winning": auction.get("current_bidder_id") == user["user_id"],
            "bid_status": bid_status,
            "time_remaining": calculate_time_remaining(auction["end_time"]) if auction.get("end_time") else None
        })
    
    return {"bids": enriched_bids}

# ============== WEBSOCKET ENDPOINT ==============

@auction_router.websocket("/ws/{listing_id}")
async def auction_websocket(websocket: WebSocket, listing_id: str):
    """WebSocket for real-time auction updates"""
    await auction_ws_manager.connect(websocket, listing_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle ping/pong for keepalive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        auction_ws_manager.disconnect(websocket, listing_id)
