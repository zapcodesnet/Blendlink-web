"""
Blendlink Marketplace API Routes
- List content for sale
- Buy listings
- Make/respond to offers
- Auction bidding
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import Optional, List
import logging

from marketplace_system import (
    init_marketplace_service,
    MarketplaceService,
    PLATFORM_FEE_PERCENT,
)

logger = logging.getLogger(__name__)

# Router
marketplace_router = APIRouter(prefix="/marketplace", tags=["Marketplace"])

# Service
_marketplace_service: Optional[MarketplaceService] = None
_db = None


def setup_marketplace_routes(db):
    """Initialize marketplace services"""
    global _marketplace_service, _db
    _marketplace_service = init_marketplace_service(db)
    _db = db
    logger.info("Marketplace services initialized")


async def get_current_user_from_request(request: Request) -> dict:
    """Get current user from request"""
    from server import get_current_user
    return await get_current_user(request)


# ============== REQUEST MODELS ==============
class CreateListingRequest(BaseModel):
    content_type: str  # minted_photo, music, video
    content_id: str
    title: str
    price: float
    description: str = ""
    listing_type: str = "fixed_price"  # fixed_price, auction, offer_only
    auction_duration_hours: int = 24


class MakeOfferRequest(BaseModel):
    content_type: str
    content_id: str
    amount: float
    message: str = ""
    listing_id: Optional[str] = None


class RespondOfferRequest(BaseModel):
    accept: bool
    stripe_payment_intent_id: Optional[str] = None


class BuyListingRequest(BaseModel):
    stripe_payment_intent_id: Optional[str] = None


class PlaceBidRequest(BaseModel):
    bid_amount: float


# ============== ROUTES ==============
@marketplace_router.get("/config")
async def get_marketplace_config():
    """Get marketplace configuration"""
    return {
        "platform_fee_percent": PLATFORM_FEE_PERCENT,
        "supported_content_types": ["minted_photo", "music", "video"],
        "listing_types": ["fixed_price", "auction", "offer_only"],
        "min_price_usd": 1.00,
        "max_auction_duration_hours": 168,  # 7 days
    }


@marketplace_router.get("/listings")
async def get_listings(
    content_type: Optional[str] = None,
    status: str = "active",
    skip: int = 0,
    limit: int = 20,
):
    """Get marketplace listings"""
    if not _marketplace_service:
        raise HTTPException(status_code=500, detail="Marketplace not initialized")
    
    listings = await _marketplace_service.get_listings(
        content_type=content_type,
        status=status,
        skip=skip,
        limit=limit,
    )
    
    return {"listings": listings, "count": len(listings)}


@marketplace_router.get("/listings/my")
async def get_my_listings(
    status: str = "active",
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user_from_request),
):
    """Get current user's listings"""
    if not _marketplace_service:
        raise HTTPException(status_code=500, detail="Marketplace not initialized")
    
    listings = await _marketplace_service.get_listings(
        seller_id=current_user["user_id"],
        status=status,
        skip=skip,
        limit=limit,
    )
    
    return {"listings": listings, "count": len(listings)}


@marketplace_router.get("/listing/{listing_id}")
async def get_listing(listing_id: str):
    """Get a specific listing"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    listing = await _db.marketplace_listings.find_one(
        {"listing_id": listing_id},
        {"_id": 0}
    )
    
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    # Increment view count
    await _db.marketplace_listings.update_one(
        {"listing_id": listing_id},
        {"$inc": {"views": 1}}
    )
    
    # Get seller info
    seller = await _db.users.find_one(
        {"user_id": listing["seller_id"]},
        {"_id": 0, "password_hash": 0, "user_id": 1, "name": 1, "avatar": 1}
    )
    listing["seller"] = seller
    
    return listing


@marketplace_router.post("/listings")
async def create_listing(
    data: CreateListingRequest,
    current_user: dict = Depends(get_current_user_from_request),
):
    """Create a new marketplace listing"""
    if not _marketplace_service:
        raise HTTPException(status_code=500, detail="Marketplace not initialized")
    
    if data.price < 1.00:
        raise HTTPException(status_code=400, detail="Minimum price is $1.00")
    
    result = await _marketplace_service.create_listing(
        seller_id=current_user["user_id"],
        content_type=data.content_type,
        content_id=data.content_id,
        title=data.title,
        price=data.price,
        description=data.description,
        listing_type=data.listing_type,
        auction_duration_hours=data.auction_duration_hours,
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@marketplace_router.post("/listing/{listing_id}/buy")
async def buy_listing(
    listing_id: str,
    data: BuyListingRequest,
    current_user: dict = Depends(get_current_user_from_request),
):
    """Buy a listing (fixed price)"""
    if not _marketplace_service:
        raise HTTPException(status_code=500, detail="Marketplace not initialized")
    
    result = await _marketplace_service.buy_listing(
        listing_id=listing_id,
        buyer_id=current_user["user_id"],
        stripe_payment_intent_id=data.stripe_payment_intent_id,
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@marketplace_router.delete("/listing/{listing_id}")
async def cancel_listing(
    listing_id: str,
    current_user: dict = Depends(get_current_user_from_request),
):
    """Cancel a listing"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    listing = await _db.marketplace_listings.find_one({
        "listing_id": listing_id,
        "seller_id": current_user["user_id"],
        "status": "active",
    })
    
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found or not yours")
    
    await _db.marketplace_listings.update_one(
        {"listing_id": listing_id},
        {"$set": {"status": "cancelled"}}
    )
    
    # Unmark content
    from marketplace_system import MarketplaceService
    if _marketplace_service:
        await _marketplace_service._mark_content_listed(
            listing["content_type"],
            listing["content_id"],
            False,
            None
        )
    
    return {"success": True}


# ============== OFFERS ==============
@marketplace_router.post("/offers")
async def make_offer(
    data: MakeOfferRequest,
    current_user: dict = Depends(get_current_user_from_request),
):
    """Make an offer on content"""
    if not _marketplace_service:
        raise HTTPException(status_code=500, detail="Marketplace not initialized")
    
    if data.amount < 1.00:
        raise HTTPException(status_code=400, detail="Minimum offer is $1.00")
    
    result = await _marketplace_service.make_offer(
        buyer_id=current_user["user_id"],
        content_type=data.content_type,
        content_id=data.content_id,
        amount=data.amount,
        message=data.message,
        listing_id=data.listing_id,
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@marketplace_router.get("/offers/received")
async def get_received_offers(
    status: str = "pending",
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user_from_request),
):
    """Get offers received on your content"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    query = {"seller_id": current_user["user_id"]}
    if status != "all":
        query["status"] = status
    
    offers = await _db.marketplace_offers.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Fetch buyer info
    if offers:
        buyer_ids = [o["buyer_id"] for o in offers]
        buyers = await _db.users.find(
            {"user_id": {"$in": buyer_ids}},
            {"_id": 0, "password_hash": 0, "user_id": 1, "name": 1, "avatar": 1}
        ).to_list(len(buyer_ids))
        buyers_map = {b["user_id"]: b for b in buyers}
        
        for offer in offers:
            offer["buyer"] = buyers_map.get(offer["buyer_id"])
    
    return {"offers": offers, "count": len(offers)}


@marketplace_router.get("/offers/sent")
async def get_sent_offers(
    status: str = "pending",
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user_from_request),
):
    """Get offers you've sent"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    query = {"buyer_id": current_user["user_id"]}
    if status != "all":
        query["status"] = status
    
    offers = await _db.marketplace_offers.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"offers": offers, "count": len(offers)}


@marketplace_router.post("/offers/{offer_id}/respond")
async def respond_to_offer(
    offer_id: str,
    data: RespondOfferRequest,
    current_user: dict = Depends(get_current_user_from_request),
):
    """Accept or decline an offer"""
    if not _marketplace_service:
        raise HTTPException(status_code=500, detail="Marketplace not initialized")
    
    result = await _marketplace_service.respond_to_offer(
        offer_id=offer_id,
        seller_id=current_user["user_id"],
        accept=data.accept,
        stripe_payment_intent_id=data.stripe_payment_intent_id,
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@marketplace_router.delete("/offers/{offer_id}")
async def cancel_offer(
    offer_id: str,
    current_user: dict = Depends(get_current_user_from_request),
):
    """Cancel your pending offer"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    result = await _db.marketplace_offers.update_one(
        {
            "offer_id": offer_id,
            "buyer_id": current_user["user_id"],
            "status": "pending",
        },
        {"$set": {"status": "cancelled"}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Offer not found or not pending")
    
    return {"success": True}


# ============== SALES HISTORY ==============
@marketplace_router.get("/sales/history")
async def get_sales_history(
    role: str = "seller",  # seller or buyer
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user_from_request),
):
    """Get sales history"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    if role == "seller":
        query = {"seller_id": current_user["user_id"]}
    else:
        query = {"buyer_id": current_user["user_id"]}
    
    sales = await _db.marketplace_sales.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"sales": sales, "count": len(sales)}


@marketplace_router.get("/stats")
async def get_marketplace_stats(
    current_user: dict = Depends(get_current_user_from_request),
):
    """Get user's marketplace stats"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user["user_id"]
    
    # Count active listings
    active_listings = await _db.marketplace_listings.count_documents({
        "seller_id": user_id,
        "status": "active",
    })
    
    # Count total sales
    total_sales = await _db.marketplace_sales.count_documents({
        "seller_id": user_id,
    })
    
    # Sum earnings
    sales_pipeline = [
        {"$match": {"seller_id": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$seller_receives"}}}
    ]
    earnings = await _db.marketplace_sales.aggregate(sales_pipeline).to_list(1)
    total_earnings = earnings[0]["total"] if earnings else 0
    
    # Count pending offers received
    pending_offers = await _db.marketplace_offers.count_documents({
        "seller_id": user_id,
        "status": "pending",
    })
    
    # Count purchases
    total_purchases = await _db.marketplace_sales.count_documents({
        "buyer_id": user_id,
    })
    
    return {
        "active_listings": active_listings,
        "total_sales": total_sales,
        "total_earnings_usd": round(total_earnings, 2),
        "pending_offers": pending_offers,
        "total_purchases": total_purchases,
    }
