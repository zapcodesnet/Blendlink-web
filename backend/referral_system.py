"""
Blendlink Referral & Commission System Module
- 2-Level Unilevel Compensation Plan
- Diamond Leader Status Program
- Orphan Assignment System
- Withdrawal with ID Verification
- Real-time earnings tracking
"""
from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import os
from motor.motor_asyncio import AsyncIOMotorClient

# Import from main server
from server import get_current_user, db, logger

# Create routers
referral_system_router = APIRouter(prefix="/referral-system", tags=["Referral System"])
commission_router = APIRouter(prefix="/commissions", tags=["Commissions"])
diamond_router = APIRouter(prefix="/diamond", tags=["Diamond Leader"])
orphan_router = APIRouter(prefix="/orphans", tags=["Orphan Assignment"])
withdrawal_router = APIRouter(prefix="/withdrawals", tags=["Withdrawals"])
admin_router = APIRouter(prefix="/admin", tags=["Admin"])

# ============== CONSTANTS ==============
LEVEL_1_COMMISSION_RATE = 0.03  # 3%
LEVEL_2_COMMISSION_RATE = 0.01  # 1%
PLATFORM_FEE_RATE = 0.04  # 4%
TOTAL_MARKETPLACE_FEE = 0.08  # 8%

# Diamond Leader rates
DIAMOND_LEVEL_1_RATE = 0.04  # 4%
DIAMOND_LEVEL_2_RATE = 0.02  # 2%
DIAMOND_PLATFORM_RATE = 0.02  # 2%
DIAMOND_BONUS = 100.00  # $100 one-time bonus

# Withdrawal
WITHDRAWAL_FEE_RATE = 0.01  # 1%

# Inactivity period (years)
INACTIVITY_YEARS = 5

# ============== MODELS ==============

class ReferralRelationship(BaseModel):
    """Track referral relationships"""
    relationship_id: str = Field(default_factory=lambda: f"ref_{uuid.uuid4().hex[:12]}")
    referrer_id: str  # The person who referred (upline)
    referred_id: str  # The person who was referred (downline)
    level: int = 1  # 1 = direct, 2 = indirect
    status: str = "active"  # active, inactive, reassigned
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Commission(BaseModel):
    """Commission record"""
    commission_id: str = Field(default_factory=lambda: f"comm_{uuid.uuid4().hex[:12]}")
    user_id: str  # Who earned the commission
    source_user_id: str  # Who generated the sale
    source_transaction_id: str  # The sale/auction that generated this
    level: int  # 1 or 2
    rate: float  # Commission rate applied
    gross_amount: float  # Original sale amount
    commission_amount: float  # Actual commission earned
    commission_type: str  # "marketplace_sale", "auction", "offer_sale"
    status: str = "pending"  # pending, paid, cancelled
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DiamondLeaderStatus(BaseModel):
    """Diamond Leader qualification tracking"""
    status_id: str = Field(default_factory=lambda: f"diamond_{uuid.uuid4().hex[:12]}")
    user_id: str
    qualification_period_start: datetime
    qualification_period_end: datetime
    direct_recruits_count: int = 0
    direct_recruits_required: int = 100
    downline_commissions: float = 0.0
    downline_commissions_required: float = 1000.0
    personal_sales: float = 0.0
    personal_sales_required: float = 1000.0
    is_qualified: bool = False
    bonus_paid: bool = False
    qualified_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class OrphanQueueEntry(BaseModel):
    """Queue for assigning orphans to eligible members"""
    queue_id: str = Field(default_factory=lambda: f"queue_{uuid.uuid4().hex[:12]}")
    user_id: str
    join_date: datetime
    is_eligible: bool = True
    has_received_orphan: bool = False
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    id_verified: bool = False
    has_violations: bool = False
    direct_recruits_count: int = 0

class WithdrawalRequest(BaseModel):
    """Withdrawal request"""
    withdrawal_id: str = Field(default_factory=lambda: f"wd_{uuid.uuid4().hex[:12]}")
    user_id: str
    amount: float
    fee: float
    net_amount: float
    payment_method: str  # "bank_transfer", "paypal", "crypto"
    payment_details: Dict = {}
    status: str = "pending"  # pending, processing, completed, rejected
    rejection_reason: Optional[str] = None
    processed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class IDVerification(BaseModel):
    """ID verification record"""
    verification_id: str = Field(default_factory=lambda: f"idv_{uuid.uuid4().hex[:12]}")
    user_id: str
    stripe_session_id: Optional[str] = None
    status: str = "pending"  # pending, verified, rejected, expired
    document_type: Optional[str] = None  # passport, drivers_license, id_card
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    dob: Optional[str] = None
    expiry_date: Optional[str] = None
    verified_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None  # Verification expires
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== REQUEST MODELS ==============

class WithdrawalCreate(BaseModel):
    amount: float
    payment_method: str
    payment_details: Dict = {}

class ReferralCodeApply(BaseModel):
    referral_code: str

# ============== HELPER FUNCTIONS ==============

async def get_user_by_id(user_id: str):
    """Get user by ID"""
    return await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})

async def get_upline(user_id: str, level: int = 1):
    """Get user's upline at specified level"""
    rel = await db.referral_relationships.find_one({
        "referred_id": user_id,
        "level": 1,
        "status": "active"
    }, {"_id": 0})
    
    if not rel:
        return None
    
    if level == 1:
        return await get_user_by_id(rel["referrer_id"])
    elif level == 2:
        # Get referrer's referrer
        return await get_upline(rel["referrer_id"], 1)
    
    return None

async def get_downline(user_id: str, level: int = 1):
    """Get user's downline at specified level"""
    if level == 1:
        rels = await db.referral_relationships.find({
            "referrer_id": user_id,
            "level": 1,
            "status": "active"
        }, {"_id": 0}).to_list(1000)
        return [await get_user_by_id(r["referred_id"]) for r in rels]
    elif level == 2:
        # Get level 1's level 1 (my level 2)
        level_1 = await get_downline(user_id, 1)
        level_2 = []
        for user in level_1:
            if user:
                l2_users = await get_downline(user["user_id"], 1)
                level_2.extend(l2_users)
        return level_2
    return []

async def is_diamond_leader(user_id: str) -> bool:
    """Check if user is a Diamond Leader"""
    status = await db.diamond_status.find_one({
        "user_id": user_id,
        "is_qualified": True
    })
    return status is not None

async def calculate_commission_rates(user_id: str):
    """Get commission rates based on Diamond status"""
    if await is_diamond_leader(user_id):
        return {
            "level_1": DIAMOND_LEVEL_1_RATE,
            "level_2": DIAMOND_LEVEL_2_RATE,
            "platform": DIAMOND_PLATFORM_RATE
        }
    return {
        "level_1": LEVEL_1_COMMISSION_RATE,
        "level_2": LEVEL_2_COMMISSION_RATE,
        "platform": PLATFORM_FEE_RATE
    }

async def process_sale_commissions(
    seller_id: str,
    sale_amount: float,
    transaction_id: str,
    commission_type: str = "marketplace_sale"
):
    """Process and distribute commissions for a sale"""
    total_fee = sale_amount * TOTAL_MARKETPLACE_FEE
    
    # Get seller's uplines
    level_1_upline = await get_upline(seller_id, 1)
    level_2_upline = await get_upline(seller_id, 2)
    
    commissions_created = []
    platform_share = total_fee
    
    # Level 1 commission (3% or 4% for Diamond)
    if level_1_upline:
        rates = await calculate_commission_rates(level_1_upline["user_id"])
        l1_commission = sale_amount * rates["level_1"]
        platform_share -= l1_commission
        
        commission = Commission(
            user_id=level_1_upline["user_id"],
            source_user_id=seller_id,
            source_transaction_id=transaction_id,
            level=1,
            rate=rates["level_1"],
            gross_amount=sale_amount,
            commission_amount=l1_commission,
            commission_type=commission_type,
            status="pending"
        )
        
        comm_dict = commission.model_dump()
        comm_dict["created_at"] = comm_dict["created_at"].isoformat()
        await db.commissions.insert_one(comm_dict)
        
        # Update user's pending balance
        await db.users.update_one(
            {"user_id": level_1_upline["user_id"]},
            {"$inc": {"pending_earnings": l1_commission, "total_earnings": l1_commission}}
        )
        
        commissions_created.append({
            "user_id": level_1_upline["user_id"],
            "level": 1,
            "amount": l1_commission
        })
    
    # Level 2 commission (1% or 2% for Diamond)
    if level_2_upline:
        rates = await calculate_commission_rates(level_2_upline["user_id"])
        l2_commission = sale_amount * rates["level_2"]
        platform_share -= l2_commission
        
        commission = Commission(
            user_id=level_2_upline["user_id"],
            source_user_id=seller_id,
            source_transaction_id=transaction_id,
            level=2,
            rate=rates["level_2"],
            gross_amount=sale_amount,
            commission_amount=l2_commission,
            commission_type=commission_type,
            status="pending"
        )
        
        comm_dict = commission.model_dump()
        comm_dict["created_at"] = comm_dict["created_at"].isoformat()
        await db.commissions.insert_one(comm_dict)
        
        # Update user's pending balance
        await db.users.update_one(
            {"user_id": level_2_upline["user_id"]},
            {"$inc": {"pending_earnings": l2_commission, "total_earnings": l2_commission}}
        )
        
        commissions_created.append({
            "user_id": level_2_upline["user_id"],
            "level": 2,
            "amount": l2_commission
        })
    
    # Platform commission (remaining)
    await db.platform_earnings.insert_one({
        "earning_id": f"pe_{uuid.uuid4().hex[:12]}",
        "source_transaction_id": transaction_id,
        "amount": platform_share,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "total_fee": total_fee,
        "commissions": commissions_created,
        "platform_share": platform_share
    }

# ============== REFERRAL SYSTEM ROUTES ==============

@referral_system_router.get("/my-network")
async def get_my_network(current_user: dict = Depends(get_current_user)):
    """Get user's referral network"""
    user_id = current_user["user_id"]
    
    # Get direct referrals (Level 1)
    level_1 = await get_downline(user_id, 1)
    level_1_count = len([u for u in level_1 if u])
    
    # Get indirect referrals (Level 2)
    level_2 = await get_downline(user_id, 2)
    level_2_count = len([u for u in level_2 if u])
    
    # Get upline
    upline = await get_upline(user_id, 1)
    
    # Get total earnings from network
    total_commissions = await db.commissions.aggregate([
        {"$match": {"user_id": user_id, "status": {"$in": ["pending", "paid"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$commission_amount"}}}
    ]).to_list(1)
    
    total_earned = total_commissions[0]["total"] if total_commissions else 0
    
    return {
        "user_id": user_id,
        "referral_code": current_user.get("referral_code"),
        "upline": upline,
        "level_1_count": level_1_count,
        "level_2_count": level_2_count,
        "total_network_size": level_1_count + level_2_count,
        "total_commissions_earned": total_earned,
        "level_1_members": [{"user_id": u["user_id"], "name": u["name"], "email": u["email"]} for u in level_1 if u][:10],
        "level_2_members": [{"user_id": u["user_id"], "name": u["name"]} for u in level_2 if u][:10]
    }

@referral_system_router.get("/stats")
async def get_referral_stats(current_user: dict = Depends(get_current_user)):
    """Get detailed referral statistics"""
    user_id = current_user["user_id"]
    
    # Get commissions by level
    level_1_commissions = await db.commissions.aggregate([
        {"$match": {"user_id": user_id, "level": 1}},
        {"$group": {"_id": None, "total": {"$sum": "$commission_amount"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    
    level_2_commissions = await db.commissions.aggregate([
        {"$match": {"user_id": user_id, "level": 2}},
        {"$group": {"_id": None, "total": {"$sum": "$commission_amount"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    
    # Recent commissions
    recent_commissions = await db.commissions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Get Diamond status
    diamond_status = await db.diamond_status.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    return {
        "level_1": {
            "total_earned": level_1_commissions[0]["total"] if level_1_commissions else 0,
            "transaction_count": level_1_commissions[0]["count"] if level_1_commissions else 0,
            "rate": DIAMOND_LEVEL_1_RATE if diamond_status and diamond_status.get("is_qualified") else LEVEL_1_COMMISSION_RATE
        },
        "level_2": {
            "total_earned": level_2_commissions[0]["total"] if level_2_commissions else 0,
            "transaction_count": level_2_commissions[0]["count"] if level_2_commissions else 0,
            "rate": DIAMOND_LEVEL_2_RATE if diamond_status and diamond_status.get("is_qualified") else LEVEL_2_COMMISSION_RATE
        },
        "diamond_status": diamond_status,
        "recent_commissions": recent_commissions
    }

@referral_system_router.post("/apply-code")
async def apply_referral_code(data: ReferralCodeApply, current_user: dict = Depends(get_current_user)):
    """Apply a referral code (only if user doesn't have an upline)"""
    user_id = current_user["user_id"]
    
    # Check if user already has an upline
    existing_upline = await get_upline(user_id, 1)
    if existing_upline:
        raise HTTPException(status_code=400, detail="You already have a referrer")
    
    # Find user with this referral code
    referrer = await db.users.find_one(
        {"referral_code": data.referral_code.upper()},
        {"_id": 0}
    )
    
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    if referrer["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot refer yourself")
    
    # Create referral relationship
    relationship = ReferralRelationship(
        referrer_id=referrer["user_id"],
        referred_id=user_id,
        level=1
    )
    
    rel_dict = relationship.model_dump()
    rel_dict["created_at"] = rel_dict["created_at"].isoformat()
    rel_dict["last_activity"] = rel_dict["last_activity"].isoformat()
    
    await db.referral_relationships.insert_one(rel_dict)
    
    # Update referrer's direct recruits count
    await db.users.update_one(
        {"user_id": referrer["user_id"]},
        {"$inc": {"direct_referrals": 1}}
    )
    
    return {"message": "Referral code applied successfully", "referrer": referrer["name"]}

# ============== COMMISSION ROUTES ==============

@commission_router.get("/my-commissions")
async def get_my_commissions(
    skip: int = 0,
    limit: int = 50,
    status: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get user's commission history"""
    query = {"user_id": current_user["user_id"]}
    if status:
        query["status"] = status
    
    commissions = await db.commissions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get totals
    totals = await db.commissions.aggregate([
        {"$match": {"user_id": current_user["user_id"]}},
        {"$group": {
            "_id": "$status",
            "total": {"$sum": "$commission_amount"}
        }}
    ]).to_list(10)
    
    totals_dict = {t["_id"]: t["total"] for t in totals}
    
    return {
        "commissions": commissions,
        "totals": {
            "pending": totals_dict.get("pending", 0),
            "paid": totals_dict.get("paid", 0),
            "total": sum(totals_dict.values())
        }
    }

@commission_router.get("/pending")
async def get_pending_commissions(current_user: dict = Depends(get_current_user)):
    """Get user's pending commissions"""
    commissions = await db.commissions.find(
        {"user_id": current_user["user_id"], "status": "pending"},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    total_pending = sum(c["commission_amount"] for c in commissions)
    
    return {
        "commissions": commissions,
        "total_pending": total_pending,
        "count": len(commissions)
    }

# ============== DIAMOND LEADER ROUTES ==============

@diamond_router.get("/status")
async def get_diamond_status(current_user: dict = Depends(get_current_user)):
    """Get user's Diamond Leader status and progress"""
    user_id = current_user["user_id"]
    
    # Get or create current qualification period
    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=30)
    
    status = await db.diamond_status.find_one(
        {
            "user_id": user_id,
            "qualification_period_end": {"$gte": now.isoformat()}
        },
        {"_id": 0}
    )
    
    if not status:
        # Calculate current progress
        # Count direct recruits in last 30 days
        recent_recruits = await db.referral_relationships.count_documents({
            "referrer_id": user_id,
            "level": 1,
            "created_at": {"$gte": period_start.isoformat()}
        })
        
        # Calculate downline commissions in last 30 days
        downline_comms = await db.commissions.aggregate([
            {
                "$match": {
                    "user_id": user_id,
                    "created_at": {"$gte": period_start.isoformat()}
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$commission_amount"}}}
        ]).to_list(1)
        
        # Calculate personal sales in last 30 days
        personal_sales = await db.marketplace_sales.aggregate([
            {
                "$match": {
                    "seller_id": user_id,
                    "created_at": {"$gte": period_start.isoformat()},
                    "status": "completed"
                }
            },
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        
        status = {
            "user_id": user_id,
            "qualification_period_start": period_start.isoformat(),
            "qualification_period_end": now.isoformat(),
            "direct_recruits_count": recent_recruits,
            "direct_recruits_required": 100,
            "downline_commissions": downline_comms[0]["total"] if downline_comms else 0,
            "downline_commissions_required": 1000.0,
            "personal_sales": personal_sales[0]["total"] if personal_sales else 0,
            "personal_sales_required": 1000.0,
            "is_qualified": False,
            "bonus_paid": False
        }
    
    # Calculate progress percentages
    progress = {
        "direct_recruits": min(100, (status["direct_recruits_count"] / 100) * 100),
        "downline_commissions": min(100, (status["downline_commissions"] / 1000) * 100),
        "personal_sales": min(100, (status["personal_sales"] / 1000) * 100)
    }
    
    overall_progress = (progress["direct_recruits"] + progress["downline_commissions"] + progress["personal_sales"]) / 3
    
    return {
        **status,
        "progress": progress,
        "overall_progress": overall_progress,
        "benefits": {
            "bonus": DIAMOND_BONUS,
            "level_1_rate": f"{DIAMOND_LEVEL_1_RATE * 100}%",
            "level_2_rate": f"{DIAMOND_LEVEL_2_RATE * 100}%",
            "platform_rate": f"{DIAMOND_PLATFORM_RATE * 100}%"
        }
    }

@diamond_router.post("/check-qualification")
async def check_diamond_qualification(
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Check and update Diamond Leader qualification"""
    user_id = current_user["user_id"]
    now = datetime.now(timezone.utc)
    period_start = now - timedelta(days=30)
    
    # Count direct recruits in last 30 days
    recent_recruits = await db.referral_relationships.count_documents({
        "referrer_id": user_id,
        "level": 1,
        "created_at": {"$gte": period_start.isoformat()}
    })
    
    # Calculate downline commissions in last 30 days
    downline_comms = await db.commissions.aggregate([
        {
            "$match": {
                "user_id": user_id,
                "created_at": {"$gte": period_start.isoformat()}
            }
        },
        {"$group": {"_id": None, "total": {"$sum": "$commission_amount"}}}
    ]).to_list(1)
    downline_total = downline_comms[0]["total"] if downline_comms else 0
    
    # Calculate personal sales in last 30 days
    personal_sales = await db.marketplace_sales.aggregate([
        {
            "$match": {
                "seller_id": user_id,
                "created_at": {"$gte": period_start.isoformat()},
                "status": "completed"
            }
        },
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    personal_total = personal_sales[0]["total"] if personal_sales else 0
    
    # Check if qualified
    is_qualified = (
        recent_recruits >= 100 and
        downline_total >= 1000 and
        personal_total >= 1000
    )
    
    if is_qualified:
        # Check if already received bonus
        existing = await db.diamond_status.find_one({
            "user_id": user_id,
            "is_qualified": True,
            "bonus_paid": True
        })
        
        if not existing:
            # Create Diamond status record
            status = DiamondLeaderStatus(
                user_id=user_id,
                qualification_period_start=period_start,
                qualification_period_end=now,
                direct_recruits_count=recent_recruits,
                downline_commissions=downline_total,
                personal_sales=personal_total,
                is_qualified=True,
                qualified_at=now
            )
            
            status_dict = status.model_dump()
            for key in ["qualification_period_start", "qualification_period_end", "qualified_at", "created_at"]:
                if status_dict.get(key):
                    status_dict[key] = status_dict[key].isoformat()
            
            await db.diamond_status.insert_one(status_dict)
            
            # Award bonus
            await db.users.update_one(
                {"user_id": user_id},
                {"$inc": {"available_balance": DIAMOND_BONUS, "total_earnings": DIAMOND_BONUS}}
            )
            
            # Update status to bonus paid
            await db.diamond_status.update_one(
                {"user_id": user_id, "is_qualified": True},
                {"$set": {"bonus_paid": True}}
            )
            
            return {
                "qualified": True,
                "new_qualification": True,
                "bonus_awarded": DIAMOND_BONUS,
                "message": f"Congratulations! You've achieved Diamond Leader status and received ${DIAMOND_BONUS} bonus!"
            }
        
        return {
            "qualified": True,
            "new_qualification": False,
            "message": "You are already a Diamond Leader!"
        }
    
    return {
        "qualified": False,
        "progress": {
            "direct_recruits": f"{recent_recruits}/100",
            "downline_commissions": f"${downline_total:.2f}/$1000",
            "personal_sales": f"${personal_total:.2f}/$1000"
        },
        "message": "Keep going! You're on your way to Diamond Leader status."
    }

# ============== ORPHAN ASSIGNMENT ROUTES ==============

@orphan_router.get("/queue-status")
async def get_orphan_queue_status(current_user: dict = Depends(get_current_user)):
    """Check user's position in orphan assignment queue"""
    user_id = current_user["user_id"]
    
    # Check if user is in queue
    queue_entry = await db.orphan_queue.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not queue_entry:
        # Check eligibility
        user = await get_user_by_id(user_id)
        direct_count = await db.referral_relationships.count_documents({
            "referrer_id": user_id,
            "level": 1
        })
        
        id_verified = await db.id_verifications.find_one({
            "user_id": user_id,
            "status": "verified"
        })
        
        is_eligible = (
            direct_count == 0 and
            id_verified is not None and
            not user.get("has_violations", False)
        )
        
        return {
            "in_queue": False,
            "is_eligible": is_eligible,
            "eligibility_details": {
                "zero_direct_recruits": direct_count == 0,
                "id_verified": id_verified is not None,
                "no_violations": not user.get("has_violations", False)
            }
        }
    
    # Get position in queue
    position = await db.orphan_queue.count_documents({
        "is_eligible": True,
        "has_received_orphan": False,
        "join_date": {"$lt": queue_entry["join_date"]}
    })
    
    return {
        "in_queue": True,
        "position": position + 1,
        "is_eligible": queue_entry["is_eligible"],
        "has_received_orphan": queue_entry["has_received_orphan"]
    }

@orphan_router.post("/join-queue")
async def join_orphan_queue(current_user: dict = Depends(get_current_user)):
    """Join the orphan assignment queue"""
    user_id = current_user["user_id"]
    
    # Check eligibility
    direct_count = await db.referral_relationships.count_documents({
        "referrer_id": user_id,
        "level": 1
    })
    
    if direct_count > 0:
        raise HTTPException(
            status_code=400,
            detail="You must have zero direct recruits to join the orphan queue"
        )
    
    id_verified = await db.id_verifications.find_one({
        "user_id": user_id,
        "status": "verified"
    })
    
    if not id_verified:
        raise HTTPException(
            status_code=400,
            detail="You must have a verified ID to join the orphan queue"
        )
    
    user = await get_user_by_id(user_id)
    if user.get("has_violations", False):
        raise HTTPException(
            status_code=400,
            detail="Users with violations cannot join the orphan queue"
        )
    
    # Check if already in queue
    existing = await db.orphan_queue.find_one({"user_id": user_id})
    if existing:
        raise HTTPException(status_code=400, detail="You are already in the queue")
    
    # Add to queue
    queue_entry = OrphanQueueEntry(
        user_id=user_id,
        join_date=datetime.fromisoformat(current_user.get("created_at", datetime.now(timezone.utc).isoformat())),
        is_eligible=True,
        id_verified=True,
        direct_recruits_count=0
    )
    
    entry_dict = queue_entry.model_dump()
    entry_dict["join_date"] = entry_dict["join_date"].isoformat()
    entry_dict["last_activity"] = entry_dict["last_activity"].isoformat()
    
    await db.orphan_queue.insert_one(entry_dict)
    
    return {"message": "Successfully joined the orphan assignment queue"}

async def assign_orphan_to_queue(orphan_user_id: str):
    """Assign an orphan (user without referrer) to next eligible queue member"""
    # Get next eligible member from queue
    next_member = await db.orphan_queue.find_one(
        {
            "is_eligible": True,
            "has_received_orphan": False
        },
        sort=[("join_date", 1)]
    )
    
    if not next_member:
        logger.info(f"No eligible queue members for orphan {orphan_user_id}")
        return None
    
    # Create referral relationship
    relationship = ReferralRelationship(
        referrer_id=next_member["user_id"],
        referred_id=orphan_user_id,
        level=1
    )
    
    rel_dict = relationship.model_dump()
    rel_dict["created_at"] = rel_dict["created_at"].isoformat()
    rel_dict["last_activity"] = rel_dict["last_activity"].isoformat()
    
    await db.referral_relationships.insert_one(rel_dict)
    
    # Mark queue member as having received orphan
    await db.orphan_queue.update_one(
        {"user_id": next_member["user_id"]},
        {"$set": {"has_received_orphan": True}}
    )
    
    # Update referrer's direct recruits count
    await db.users.update_one(
        {"user_id": next_member["user_id"]},
        {"$inc": {"direct_referrals": 1}}
    )
    
    logger.info(f"Assigned orphan {orphan_user_id} to {next_member['user_id']}")
    
    return next_member["user_id"]

# ============== WITHDRAWAL ROUTES ==============

@withdrawal_router.get("/eligibility")
async def check_withdrawal_eligibility(current_user: dict = Depends(get_current_user)):
    """Check if user is eligible to withdraw"""
    user_id = current_user["user_id"]
    
    # Check ID verification
    verification = await db.id_verifications.find_one(
        {"user_id": user_id, "status": "verified"},
        {"_id": 0}
    )
    
    # Get available balance
    user = await get_user_by_id(user_id)
    available_balance = user.get("available_balance", 0)
    pending_earnings = user.get("pending_earnings", 0)
    
    return {
        "is_eligible": verification is not None,
        "id_verified": verification is not None,
        "verification_status": verification["status"] if verification else "not_verified",
        "available_balance": available_balance,
        "pending_earnings": pending_earnings,
        "withdrawal_fee": f"{WITHDRAWAL_FEE_RATE * 100}%",
        "min_withdrawal": 10.0
    }

@withdrawal_router.post("/request")
async def request_withdrawal(
    data: WithdrawalCreate,
    current_user: dict = Depends(get_current_user)
):
    """Request a withdrawal"""
    user_id = current_user["user_id"]
    
    # Check ID verification
    verification = await db.id_verifications.find_one({
        "user_id": user_id,
        "status": "verified"
    })
    
    if not verification:
        raise HTTPException(
            status_code=400,
            detail="ID verification required for withdrawals"
        )
    
    # Check balance
    user = await get_user_by_id(user_id)
    available = user.get("available_balance", 0)
    
    if data.amount > available:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: ${available:.2f}"
        )
    
    if data.amount < 10:
        raise HTTPException(
            status_code=400,
            detail="Minimum withdrawal amount is $10"
        )
    
    # Calculate fee
    fee = data.amount * WITHDRAWAL_FEE_RATE
    net_amount = data.amount - fee
    
    # Create withdrawal request
    withdrawal = WithdrawalRequest(
        user_id=user_id,
        amount=data.amount,
        fee=fee,
        net_amount=net_amount,
        payment_method=data.payment_method,
        payment_details=data.payment_details
    )
    
    wd_dict = withdrawal.model_dump()
    wd_dict["created_at"] = wd_dict["created_at"].isoformat()
    
    await db.withdrawals.insert_one(wd_dict)
    
    # Deduct from available balance
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"available_balance": -data.amount}}
    )
    
    return {
        "withdrawal_id": withdrawal.withdrawal_id,
        "amount": data.amount,
        "fee": fee,
        "net_amount": net_amount,
        "status": "pending",
        "message": "Withdrawal request submitted successfully"
    }

@withdrawal_router.get("/history")
async def get_withdrawal_history(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get withdrawal history"""
    withdrawals = await db.withdrawals.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return withdrawals

# ============== ID VERIFICATION ROUTES ==============

@withdrawal_router.post("/verify-id/start")
async def start_id_verification(current_user: dict = Depends(get_current_user)):
    """Start Stripe Identity verification session"""
    import stripe
    
    user_id = current_user["user_id"]
    stripe.api_key = os.environ.get("STRIPE_API_KEY")
    
    try:
        # Create verification session
        verification_session = stripe.identity.VerificationSession.create(
            type="document",
            provided_details={
                "email": current_user.get("email"),
            },
            metadata={
                "user_id": user_id,
            }
        )
        
        # Store verification record
        verification = IDVerification(
            user_id=user_id,
            stripe_session_id=verification_session.id,
            status="pending"
        )
        
        v_dict = verification.model_dump()
        v_dict["created_at"] = v_dict["created_at"].isoformat()
        
        await db.id_verifications.insert_one(v_dict)
        
        return {
            "session_id": verification_session.id,
            "client_secret": verification_session.client_secret,
            "url": verification_session.url
        }
    
    except Exception as e:
        logger.error(f"Stripe Identity error: {e}")
        raise HTTPException(status_code=500, detail="Failed to start verification")

@withdrawal_router.get("/verify-id/status")
async def get_id_verification_status(current_user: dict = Depends(get_current_user)):
    """Get ID verification status"""
    verification = await db.id_verifications.find_one(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    )
    
    if not verification:
        return {"status": "not_started", "verified": False}
    
    return {
        "status": verification["status"],
        "verified": verification["status"] == "verified",
        "verified_at": verification.get("verified_at"),
        "expires_at": verification.get("expires_at")
    }

# ============== ADMIN ROUTES ==============

async def get_admin_user(current_user: dict = Depends(get_current_user)):
    """Verify user is admin"""
    if not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@admin_router.get("/dashboard")
async def admin_dashboard(admin: dict = Depends(get_admin_user)):
    """Get admin dashboard stats"""
    # Total users
    total_users = await db.users.count_documents({})
    
    # Total commissions paid
    total_commissions = await db.commissions.aggregate([
        {"$match": {"status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$commission_amount"}}}
    ]).to_list(1)
    
    # Platform earnings
    platform_earnings = await db.platform_earnings.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]).to_list(1)
    
    # Pending withdrawals
    pending_withdrawals = await db.withdrawals.count_documents({"status": "pending"})
    
    # Diamond Leaders
    diamond_count = await db.diamond_status.count_documents({"is_qualified": True})
    
    # Recent activity
    recent_users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "total_users": total_users,
        "total_commissions_paid": total_commissions[0]["total"] if total_commissions else 0,
        "platform_earnings": platform_earnings[0]["total"] if platform_earnings else 0,
        "pending_withdrawals": pending_withdrawals,
        "diamond_leaders": diamond_count,
        "recent_users": recent_users
    }

@admin_router.get("/withdrawals/pending")
async def get_pending_withdrawals(admin: dict = Depends(get_admin_user)):
    """Get pending withdrawal requests"""
    withdrawals = await db.withdrawals.find(
        {"status": "pending"},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    
    # Add user info
    for w in withdrawals:
        user = await get_user_by_id(w["user_id"])
        w["user"] = user
    
    return withdrawals

@admin_router.post("/withdrawals/{withdrawal_id}/approve")
async def approve_withdrawal(withdrawal_id: str, admin: dict = Depends(get_admin_user)):
    """Approve a withdrawal request"""
    withdrawal = await db.withdrawals.find_one({"withdrawal_id": withdrawal_id})
    
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal is already {withdrawal['status']}")
    
    await db.withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "completed",
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Record platform earning from fee
    await db.platform_earnings.insert_one({
        "earning_id": f"pe_{uuid.uuid4().hex[:12]}",
        "source_type": "withdrawal_fee",
        "source_id": withdrawal_id,
        "amount": withdrawal["fee"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"message": "Withdrawal approved", "withdrawal_id": withdrawal_id}

@admin_router.post("/withdrawals/{withdrawal_id}/reject")
async def reject_withdrawal(
    withdrawal_id: str,
    reason: str,
    admin: dict = Depends(get_admin_user)
):
    """Reject a withdrawal request"""
    withdrawal = await db.withdrawals.find_one({"withdrawal_id": withdrawal_id})
    
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Withdrawal is already {withdrawal['status']}")
    
    await db.withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "rejected",
            "rejection_reason": reason,
            "processed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Refund the amount to user's balance
    await db.users.update_one(
        {"user_id": withdrawal["user_id"]},
        {"$inc": {"available_balance": withdrawal["amount"]}}
    )
    
    return {"message": "Withdrawal rejected", "withdrawal_id": withdrawal_id}

@admin_router.get("/users")
async def get_all_users(
    skip: int = 0,
    limit: int = 50,
    admin: dict = Depends(get_admin_user)
):
    """Get all users"""
    users = await db.users.find(
        {},
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.users.count_documents({})
    
    return {
        "users": users,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@admin_router.post("/users/{user_id}/set-admin")
async def set_user_admin(user_id: str, is_admin: bool, admin: dict = Depends(get_admin_user)):
    """Set or remove admin status for a user"""
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_admin": is_admin}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": f"User admin status set to {is_admin}"}

@admin_router.get("/analytics")
async def get_analytics(admin: dict = Depends(get_admin_user)):
    """Get platform analytics"""
    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)
    
    # User growth
    new_users_30d = await db.users.count_documents({
        "created_at": {"$gte": thirty_days_ago.isoformat()}
    })
    
    new_users_7d = await db.users.count_documents({
        "created_at": {"$gte": seven_days_ago.isoformat()}
    })
    
    # Commission trends
    commissions_30d = await db.commissions.aggregate([
        {"$match": {"created_at": {"$gte": thirty_days_ago.isoformat()}}},
        {"$group": {"_id": None, "total": {"$sum": "$commission_amount"}}}
    ]).to_list(1)
    
    # Sales volume
    sales_30d = await db.marketplace_sales.aggregate([
        {"$match": {"created_at": {"$gte": thirty_days_ago.isoformat()}, "status": "completed"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]).to_list(1)
    
    return {
        "users": {
            "new_30d": new_users_30d,
            "new_7d": new_users_7d
        },
        "commissions": {
            "total_30d": commissions_30d[0]["total"] if commissions_30d else 0
        },
        "sales": {
            "volume_30d": sales_30d[0]["total"] if sales_30d else 0,
            "count_30d": sales_30d[0]["count"] if sales_30d else 0
        }
    }
