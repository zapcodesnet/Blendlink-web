"""
Blendlink Marketplace System
- List photos/music/videos for sale
- 8% platform fee on all transactions
- Immediate fee distribution on sale
- Offer system for public content
- Auction functionality
"""

import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from enum import Enum

logger = logging.getLogger(__name__)

# ============== CONSTANTS ==============
PLATFORM_FEE_PERCENT = 8  # 8% total platform fee

# Fee distribution rates
FEE_DISTRIBUTION = {
    "regular": {
        "l1": 0.03,      # 3% to direct upline
        "l2": 0.01,      # 1% to indirect upline
        "platform": 0.04  # 4% to platform
    },
    "diamond": {
        "l1": 0.04,      # 4% to direct recruit
        "l2": 0.02,      # 2% to indirect recruit
        "platform": 0.02  # 2% to platform
    }
}


class ListingStatus(str, Enum):
    ACTIVE = "active"
    SOLD = "sold"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


class ListingType(str, Enum):
    FIXED_PRICE = "fixed_price"
    AUCTION = "auction"
    OFFER_ONLY = "offer_only"


class OfferStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


# ============== MODELS ==============
class MarketplaceListing(BaseModel):
    """A marketplace listing for digital content"""
    listing_id: str = Field(default_factory=lambda: f"mkt_{uuid.uuid4().hex[:12]}")
    seller_id: str
    
    # Content reference
    content_type: str  # minted_photo, music, video
    content_id: str    # mint_id or media_id
    
    # Listing details
    title: str
    description: str = ""
    price: float  # USD
    listing_type: ListingType = ListingType.FIXED_PRICE
    
    # Auction fields
    starting_bid: Optional[float] = None
    current_bid: Optional[float] = None
    highest_bidder_id: Optional[str] = None
    auction_end: Optional[str] = None
    
    # Status
    status: ListingStatus = ListingStatus.ACTIVE
    
    # Stats
    views: int = 0
    offers_count: int = 0
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    sold_at: Optional[datetime] = None


class ContentOffer(BaseModel):
    """An offer on content (listed or unlisted public content)"""
    offer_id: str = Field(default_factory=lambda: f"offer_{uuid.uuid4().hex[:12]}")
    buyer_id: str
    seller_id: str
    
    # Content reference
    content_type: str
    content_id: str
    listing_id: Optional[str] = None  # If offer is on a listing
    
    # Offer details
    amount: float  # USD
    message: str = ""
    
    # Status
    status: OfferStatus = OfferStatus.PENDING
    
    # Payment
    stripe_payment_intent_id: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None
    responded_at: Optional[datetime] = None


class Sale(BaseModel):
    """Record of a completed sale"""
    sale_id: str = Field(default_factory=lambda: f"sale_{uuid.uuid4().hex[:12]}")
    listing_id: Optional[str] = None
    offer_id: Optional[str] = None
    
    seller_id: str
    buyer_id: str
    
    content_type: str
    content_id: str
    
    # Amounts
    sale_price: float  # Original price USD
    platform_fee: float  # Total 8% fee
    seller_receives: float  # After fee deduction
    
    # Fee distribution
    l1_commission: float = 0
    l1_user_id: Optional[str] = None
    l2_commission: float = 0
    l2_user_id: Optional[str] = None
    platform_amount: float = 0
    
    # Payment
    stripe_payment_intent_id: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============== MARKETPLACE SERVICE ==============
class MarketplaceService:
    """Service for managing marketplace operations"""
    
    def __init__(self, db):
        self.db = db
    
    async def create_listing(
        self,
        seller_id: str,
        content_type: str,
        content_id: str,
        title: str,
        price: float,
        description: str = "",
        listing_type: str = "fixed_price",
        auction_duration_hours: int = 24,
    ) -> Dict[str, Any]:
        """Create a new marketplace listing"""
        # Verify ownership
        ownership = await self._verify_ownership(seller_id, content_type, content_id)
        if not ownership["owned"]:
            return {"success": False, "error": "You don't own this content"}
        
        # Check if already listed
        existing = await self.db.marketplace_listings.find_one({
            "content_id": content_id,
            "status": ListingStatus.ACTIVE.value,
        })
        if existing:
            return {"success": False, "error": "Content is already listed"}
        
        # Create listing
        listing = MarketplaceListing(
            seller_id=seller_id,
            content_type=content_type,
            content_id=content_id,
            title=title,
            description=description,
            price=price,
            listing_type=ListingType(listing_type),
        )
        
        # Set auction fields if auction
        if listing_type == "auction":
            listing.starting_bid = price
            listing.current_bid = price
            listing.auction_end = (datetime.now(timezone.utc) + timedelta(hours=auction_duration_hours)).isoformat()
        
        listing_dict = listing.model_dump()
        listing_dict["created_at"] = listing_dict["created_at"].isoformat()
        if listing_dict.get("sold_at"):
            listing_dict["sold_at"] = listing_dict["sold_at"].isoformat()
        
        await self.db.marketplace_listings.insert_one(listing_dict)
        
        # Mark content as listed
        await self._mark_content_listed(content_type, content_id, True, listing.listing_id)
        
        logger.info(f"Created listing {listing.listing_id} for {content_type} {content_id}")
        
        return {
            "success": True,
            "listing": listing_dict,
        }
    
    async def get_listings(
        self,
        content_type: Optional[str] = None,
        seller_id: Optional[str] = None,
        status: str = "active",
        skip: int = 0,
        limit: int = 20,
    ) -> List[Dict]:
        """Get marketplace listings"""
        query = {"status": status}
        
        if content_type:
            query["content_type"] = content_type
        if seller_id:
            query["seller_id"] = seller_id
        
        listings = await self.db.marketplace_listings.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        # Fetch seller info and content details
        if listings:
            seller_ids = list(set(l["seller_id"] for l in listings))
            sellers = await self.db.users.find(
                {"user_id": {"$in": seller_ids}},
                {"_id": 0, "password_hash": 0, "user_id": 1, "name": 1, "avatar": 1}
            ).to_list(len(seller_ids))
            sellers_map = {s["user_id"]: s for s in sellers}
            
            for listing in listings:
                listing["seller"] = sellers_map.get(listing["seller_id"])
        
        return listings
    
    async def buy_listing(
        self,
        listing_id: str,
        buyer_id: str,
        stripe_payment_intent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Complete a purchase from a listing
        - Deducts 8% platform fee
        - Distributes fees immediately
        - Transfers ownership
        """
        # Get listing
        listing = await self.db.marketplace_listings.find_one({
            "listing_id": listing_id,
            "status": ListingStatus.ACTIVE.value,
        })
        
        if not listing:
            return {"success": False, "error": "Listing not found or not active"}
        
        if listing["seller_id"] == buyer_id:
            return {"success": False, "error": "Cannot buy your own listing"}
        
        # Calculate fees
        sale_price = listing["price"]
        fee_breakdown = await self._calculate_fee_distribution(
            listing["seller_id"],
            sale_price
        )
        
        # Create sale record
        sale = Sale(
            listing_id=listing_id,
            seller_id=listing["seller_id"],
            buyer_id=buyer_id,
            content_type=listing["content_type"],
            content_id=listing["content_id"],
            sale_price=sale_price,
            platform_fee=fee_breakdown["total_fee"],
            seller_receives=fee_breakdown["seller_receives"],
            l1_commission=fee_breakdown["l1_amount"],
            l1_user_id=fee_breakdown.get("l1_user_id"),
            l2_commission=fee_breakdown["l2_amount"],
            l2_user_id=fee_breakdown.get("l2_user_id"),
            platform_amount=fee_breakdown["platform_amount"],
            stripe_payment_intent_id=stripe_payment_intent_id,
        )
        
        sale_dict = sale.model_dump()
        sale_dict["created_at"] = sale_dict["created_at"].isoformat()
        await self.db.marketplace_sales.insert_one(sale_dict)
        
        # Distribute fees immediately
        await self._distribute_sale_fees(fee_breakdown, sale.sale_id)
        
        # Update listing status
        await self.db.marketplace_listings.update_one(
            {"listing_id": listing_id},
            {
                "$set": {
                    "status": ListingStatus.SOLD.value,
                    "sold_at": datetime.now(timezone.utc).isoformat(),
                }
            }
        )
        
        # Transfer ownership
        await self._transfer_ownership(
            listing["content_type"],
            listing["content_id"],
            listing["seller_id"],
            buyer_id
        )
        
        logger.info(f"Sale completed: {sale.sale_id} - ${sale_price} for {listing['content_type']}")
        
        return {
            "success": True,
            "sale": sale_dict,
            "fee_breakdown": fee_breakdown,
        }
    
    async def make_offer(
        self,
        buyer_id: str,
        content_type: str,
        content_id: str,
        amount: float,
        message: str = "",
        listing_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Make an offer on content"""
        # Get content owner
        owner_id = await self._get_content_owner(content_type, content_id)
        if not owner_id:
            return {"success": False, "error": "Content not found"}
        
        if owner_id == buyer_id:
            return {"success": False, "error": "Cannot make offer on your own content"}
        
        # Create offer
        offer = ContentOffer(
            buyer_id=buyer_id,
            seller_id=owner_id,
            content_type=content_type,
            content_id=content_id,
            listing_id=listing_id,
            amount=amount,
            message=message,
            expires_at=(datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        )
        
        offer_dict = offer.model_dump()
        offer_dict["created_at"] = offer_dict["created_at"].isoformat()
        
        await self.db.marketplace_offers.insert_one(offer_dict)
        
        # Update offers count on listing if applicable
        if listing_id:
            await self.db.marketplace_listings.update_one(
                {"listing_id": listing_id},
                {"$inc": {"offers_count": 1}}
            )
        
        logger.info(f"Offer {offer.offer_id} created: ${amount} for {content_type} {content_id}")
        
        return {"success": True, "offer": offer_dict}
    
    async def respond_to_offer(
        self,
        offer_id: str,
        seller_id: str,
        accept: bool,
        stripe_payment_intent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Accept or decline an offer"""
        offer = await self.db.marketplace_offers.find_one({
            "offer_id": offer_id,
            "seller_id": seller_id,
            "status": OfferStatus.PENDING.value,
        })
        
        if not offer:
            return {"success": False, "error": "Offer not found or not pending"}
        
        if accept:
            # Process sale
            fee_breakdown = await self._calculate_fee_distribution(
                offer["seller_id"],
                offer["amount"]
            )
            
            # Create sale record
            sale = Sale(
                offer_id=offer_id,
                listing_id=offer.get("listing_id"),
                seller_id=offer["seller_id"],
                buyer_id=offer["buyer_id"],
                content_type=offer["content_type"],
                content_id=offer["content_id"],
                sale_price=offer["amount"],
                platform_fee=fee_breakdown["total_fee"],
                seller_receives=fee_breakdown["seller_receives"],
                l1_commission=fee_breakdown["l1_amount"],
                l1_user_id=fee_breakdown.get("l1_user_id"),
                l2_commission=fee_breakdown["l2_amount"],
                l2_user_id=fee_breakdown.get("l2_user_id"),
                platform_amount=fee_breakdown["platform_amount"],
                stripe_payment_intent_id=stripe_payment_intent_id,
            )
            
            sale_dict = sale.model_dump()
            sale_dict["created_at"] = sale_dict["created_at"].isoformat()
            await self.db.marketplace_sales.insert_one(sale_dict)
            
            # Distribute fees
            await self._distribute_sale_fees(fee_breakdown, sale.sale_id)
            
            # Transfer ownership
            await self._transfer_ownership(
                offer["content_type"],
                offer["content_id"],
                offer["seller_id"],
                offer["buyer_id"]
            )
            
            # Update offer status
            await self.db.marketplace_offers.update_one(
                {"offer_id": offer_id},
                {
                    "$set": {
                        "status": OfferStatus.ACCEPTED.value,
                        "responded_at": datetime.now(timezone.utc).isoformat(),
                    }
                }
            )
            
            # Cancel listing if exists
            if offer.get("listing_id"):
                await self.db.marketplace_listings.update_one(
                    {"listing_id": offer["listing_id"]},
                    {"$set": {"status": ListingStatus.SOLD.value}}
                )
            
            return {
                "success": True,
                "accepted": True,
                "sale": sale_dict,
                "fee_breakdown": fee_breakdown,
            }
        else:
            # Decline offer
            await self.db.marketplace_offers.update_one(
                {"offer_id": offer_id},
                {
                    "$set": {
                        "status": OfferStatus.DECLINED.value,
                        "responded_at": datetime.now(timezone.utc).isoformat(),
                    }
                }
            )
            
            return {"success": True, "accepted": False}
    
    async def _calculate_fee_distribution(
        self,
        seller_id: str,
        sale_price: float
    ) -> Dict[str, Any]:
        """
        Calculate fee distribution for a sale
        - 8% total platform fee
        - Distribution based on seller's diamond status
        """
        total_fee = sale_price * (PLATFORM_FEE_PERCENT / 100)
        seller_receives = sale_price - total_fee
        
        # Get seller info and upline chain
        seller = await self.db.users.find_one(
            {"user_id": seller_id},
            {"is_diamond": 1, "referred_by": 1}
        )
        
        is_diamond = seller.get("is_diamond", False) if seller else False
        rates = FEE_DISTRIBUTION["diamond"] if is_diamond else FEE_DISTRIBUTION["regular"]
        
        result = {
            "sale_price": sale_price,
            "total_fee": round(total_fee, 2),
            "seller_receives": round(seller_receives, 2),
            "l1_amount": 0,
            "l1_user_id": None,
            "l2_amount": 0,
            "l2_user_id": None,
            "platform_amount": round(total_fee, 2),
            "seller_id": seller_id,
        }
        
        # Get L1 upline
        if seller and seller.get("referred_by"):
            l1_user = await self.db.users.find_one(
                {"user_id": seller["referred_by"]},
                {"user_id": 1, "referred_by": 1}
            )
            
            if l1_user:
                l1_amount = round(sale_price * rates["l1"], 2)
                result["l1_amount"] = l1_amount
                result["l1_user_id"] = l1_user["user_id"]
                result["platform_amount"] -= l1_amount
                
                # Get L2 upline
                if l1_user.get("referred_by"):
                    l2_user = await self.db.users.find_one(
                        {"user_id": l1_user["referred_by"]},
                        {"user_id": 1}
                    )
                    
                    if l2_user:
                        l2_amount = round(sale_price * rates["l2"], 2)
                        result["l2_amount"] = l2_amount
                        result["l2_user_id"] = l2_user["user_id"]
                        result["platform_amount"] -= l2_amount
        
        result["platform_amount"] = round(result["platform_amount"], 2)
        
        return result
    
    async def _distribute_sale_fees(self, fee_breakdown: Dict, sale_id: str) -> None:
        """Distribute fees immediately to all parties"""
        from referral_system import record_transaction, TransactionType, Currency
        
        # Credit seller
        await self.db.users.update_one(
            {"user_id": fee_breakdown["seller_id"]},
            {"$inc": {"usd_balance": fee_breakdown["seller_receives"]}}
        )
        await record_transaction(
            user_id=fee_breakdown["seller_id"],
            transaction_type=TransactionType.SALE_EARNINGS,
            currency=Currency.USD,
            amount=fee_breakdown["seller_receives"],
            reference_id=sale_id,
            details={"gross": fee_breakdown["sale_price"], "fee": fee_breakdown["total_fee"]}
        )
        
        # Credit L1 commission
        if fee_breakdown.get("l1_user_id") and fee_breakdown["l1_amount"] > 0:
            await self.db.users.update_one(
                {"user_id": fee_breakdown["l1_user_id"]},
                {"$inc": {"usd_balance": fee_breakdown["l1_amount"]}}
            )
            await record_transaction(
                user_id=fee_breakdown["l1_user_id"],
                transaction_type=TransactionType.COMMISSION_L1,
                currency=Currency.USD,
                amount=fee_breakdown["l1_amount"],
                reference_id=sale_id,
                details={"from_seller": fee_breakdown["seller_id"]}
            )
        
        # Credit L2 commission
        if fee_breakdown.get("l2_user_id") and fee_breakdown["l2_amount"] > 0:
            await self.db.users.update_one(
                {"user_id": fee_breakdown["l2_user_id"]},
                {"$inc": {"usd_balance": fee_breakdown["l2_amount"]}}
            )
            await record_transaction(
                user_id=fee_breakdown["l2_user_id"],
                transaction_type=TransactionType.COMMISSION_L2,
                currency=Currency.USD,
                amount=fee_breakdown["l2_amount"],
                reference_id=sale_id,
                details={"from_seller": fee_breakdown["seller_id"]}
            )
        
        # Record platform fee (for tracking)
        await record_transaction(
            user_id="platform",
            transaction_type=TransactionType.PLATFORM_FEE,
            currency=Currency.USD,
            amount=fee_breakdown["platform_amount"],
            reference_id=sale_id,
            details={"from_sale": sale_id}
        )
        
        logger.info(f"Fees distributed for sale {sale_id}: L1=${fee_breakdown['l1_amount']}, L2=${fee_breakdown['l2_amount']}, Platform=${fee_breakdown['platform_amount']}")
    
    async def _verify_ownership(self, user_id: str, content_type: str, content_id: str) -> Dict:
        """Verify user owns the content"""
        collection_map = {
            "minted_photo": ("minted_photos", "mint_id"),
            "music": ("minted_music", "mint_id"),
            "video": ("minted_videos", "mint_id"),
        }
        
        if content_type not in collection_map:
            return {"owned": False}
        
        collection, id_field = collection_map[content_type]
        content = await self.db[collection].find_one({
            id_field: content_id,
            "user_id": user_id,
        })
        
        return {"owned": content is not None}
    
    async def _get_content_owner(self, content_type: str, content_id: str) -> Optional[str]:
        """Get the owner of content"""
        collection_map = {
            "minted_photo": ("minted_photos", "mint_id"),
            "music": ("minted_music", "mint_id"),
            "video": ("minted_videos", "mint_id"),
        }
        
        if content_type not in collection_map:
            return None
        
        collection, id_field = collection_map[content_type]
        content = await self.db[collection].find_one(
            {id_field: content_id},
            {"user_id": 1}
        )
        
        return content.get("user_id") if content else None
    
    async def _mark_content_listed(
        self,
        content_type: str,
        content_id: str,
        is_listed: bool,
        listing_id: Optional[str] = None
    ) -> None:
        """Mark content as listed/unlisted"""
        collection_map = {
            "minted_photo": ("minted_photos", "mint_id"),
            "music": ("minted_music", "mint_id"),
            "video": ("minted_videos", "mint_id"),
        }
        
        if content_type not in collection_map:
            return
        
        collection, id_field = collection_map[content_type]
        await self.db[collection].update_one(
            {id_field: content_id},
            {"$set": {"is_listed": is_listed, "listing_id": listing_id}}
        )
    
    async def _transfer_ownership(
        self,
        content_type: str,
        content_id: str,
        from_user_id: str,
        to_user_id: str
    ) -> None:
        """Transfer ownership of content"""
        collection_map = {
            "minted_photo": ("minted_photos", "mint_id"),
            "music": ("minted_music", "mint_id"),
            "video": ("minted_videos", "mint_id"),
        }
        
        if content_type not in collection_map:
            return
        
        collection, id_field = collection_map[content_type]
        await self.db[collection].update_one(
            {id_field: content_id},
            {
                "$set": {
                    "user_id": to_user_id,
                    "is_listed": False,
                    "listing_id": None,
                },
                "$inc": {"times_transferred": 1},
                "$push": {
                    "ownership_history": {
                        "from": from_user_id,
                        "to": to_user_id,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                }
            }
        )
        
        logger.info(f"Ownership transferred: {content_type} {content_id} from {from_user_id} to {to_user_id}")


# Initialize service
marketplace_service: Optional[MarketplaceService] = None


def init_marketplace_service(db) -> MarketplaceService:
    global marketplace_service
    marketplace_service = MarketplaceService(db)
    return marketplace_service
