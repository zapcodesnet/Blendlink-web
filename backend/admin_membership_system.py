"""
Admin Membership System
Provides admin endpoints for managing:
- Membership tiers (view/edit benefits)
- Commission rate controls
- Promo codes
- Transaction monitoring
- Suspicious activity flagging
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

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

admin_membership_router = APIRouter(prefix="/admin/membership", tags=["Admin Membership"])

# ============== MODELS ==============

class TierUpdateRequest(BaseModel):
    """Request to update a tier's benefits"""
    tier_id: str
    daily_mint_limit: Optional[int] = None
    daily_bl_bonus: Optional[int] = None
    xp_multiplier: Optional[int] = None
    max_member_pages: Optional[int] = None
    commission_l1_rate: Optional[float] = None
    commission_l2_rate: Optional[float] = None
    price_monthly: Optional[float] = None
    features: Optional[List[str]] = None


class PromoCodeRequest(BaseModel):
    """Request to create/update promo code"""
    code: str
    discount_type: str = "percentage"  # percentage, fixed, bl_coins
    discount_value: float
    max_uses: Optional[int] = None
    valid_until: Optional[str] = None
    applicable_tiers: List[str] = ["bronze", "silver", "gold", "diamond"]
    is_active: bool = True
    description: Optional[str] = None


class TransactionFilterRequest(BaseModel):
    """Request to filter transactions"""
    transaction_type: Optional[str] = None
    status: Optional[str] = None
    min_amount: Optional[float] = None
    max_amount: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    user_id: Optional[str] = None
    flagged_only: bool = False


class FlagTransactionRequest(BaseModel):
    """Request to flag a suspicious transaction"""
    transaction_id: str
    reason: str
    severity: str = "medium"  # low, medium, high, critical
    action_taken: Optional[str] = None


class CommissionRateOverrideRequest(BaseModel):
    """Request to temporarily override commission rates"""
    tier_id: str
    l1_rate_override: Optional[float] = None
    l2_rate_override: Optional[float] = None
    reason: str
    expires_at: Optional[str] = None


# ============== AUTH HELPER ==============

async def get_admin_user(request: Request) -> dict:
    """Extract and verify admin user from request"""
    from jose import jwt, JWTError
    
    JWT_SECRET = os.environ.get('JWT_SECRET')
    JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
    
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header[7:]
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Check if user is admin
        if not user.get("is_admin") and user.get("role") not in ["admin", "superadmin"]:
            raise HTTPException(status_code=403, detail="Admin access required")
        
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ============== TIER MANAGEMENT ==============

@admin_membership_router.get("/tiers")
async def get_all_tiers(admin: dict = Depends(get_admin_user)):
    """Get all membership tiers with current configuration"""
    from subscription_tiers import SUBSCRIPTION_TIERS
    
    # Get any custom overrides from database
    overrides = await db.tier_overrides.find({}, {"_id": 0}).to_list(length=100)
    override_map = {o["tier_id"]: o for o in overrides}
    
    # Get active promo codes per tier
    promo_codes = await db.promo_codes.find(
        {"is_active": True},
        {"_id": 0}
    ).to_list(length=100)
    
    # Get subscription stats per tier
    tier_stats = {}
    for tier_id in SUBSCRIPTION_TIERS.keys():
        count = await db.subscriptions.count_documents({"tier": tier_id, "status": "active"})
        tier_stats[tier_id] = count
    
    tiers = []
    for tier_id, tier_data in SUBSCRIPTION_TIERS.items():
        tier_info = {
            "tier_id": tier_id,
            **tier_data,
            "active_subscribers": tier_stats.get(tier_id, 0),
            "has_override": tier_id in override_map,
            "override_details": override_map.get(tier_id)
        }
        tiers.append(tier_info)
    
    return {
        "tiers": tiers,
        "promo_codes": promo_codes,
        "total_active_subscriptions": sum(tier_stats.values())
    }


@admin_membership_router.put("/tiers/{tier_id}")
async def update_tier(tier_id: str, updates: TierUpdateRequest, admin: dict = Depends(get_admin_user)):
    """Update a tier's configuration (creates override)"""
    from subscription_tiers import SUBSCRIPTION_TIERS
    
    if tier_id not in SUBSCRIPTION_TIERS:
        raise HTTPException(status_code=404, detail="Tier not found")
    
    # Build update dict with only provided fields
    update_data = {
        "tier_id": tier_id,
        "updated_by": admin["user_id"],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if updates.daily_mint_limit is not None:
        update_data["daily_mint_limit"] = updates.daily_mint_limit
    if updates.daily_bl_bonus is not None:
        update_data["daily_bl_bonus"] = updates.daily_bl_bonus
    if updates.xp_multiplier is not None:
        update_data["xp_multiplier"] = updates.xp_multiplier
    if updates.max_member_pages is not None:
        update_data["max_member_pages"] = updates.max_member_pages
    if updates.commission_l1_rate is not None:
        update_data["commission_l1_rate"] = updates.commission_l1_rate
    if updates.commission_l2_rate is not None:
        update_data["commission_l2_rate"] = updates.commission_l2_rate
    if updates.price_monthly is not None:
        update_data["price_monthly"] = updates.price_monthly
    if updates.features is not None:
        update_data["features"] = updates.features
    
    # Upsert the override
    await db.tier_overrides.update_one(
        {"tier_id": tier_id},
        {"$set": update_data},
        upsert=True
    )
    
    # Log the action
    await db.admin_audit_logs.insert_one({
        "action": "tier_update",
        "tier_id": tier_id,
        "changes": update_data,
        "admin_id": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "message": f"Tier {tier_id} updated", "changes": update_data}


@admin_membership_router.delete("/tiers/{tier_id}/override")
async def remove_tier_override(tier_id: str, admin: dict = Depends(get_admin_user)):
    """Remove custom override for a tier, reverting to default"""
    result = await db.tier_overrides.delete_one({"tier_id": tier_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No override found for this tier")
    
    await db.admin_audit_logs.insert_one({
        "action": "tier_override_removed",
        "tier_id": tier_id,
        "admin_id": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "message": f"Override removed for tier {tier_id}"}


# ============== PROMO CODES ==============

@admin_membership_router.get("/promo-codes")
async def get_promo_codes(
    active_only: bool = Query(False),
    admin: dict = Depends(get_admin_user)
):
    """Get all promo codes"""
    query = {}
    if active_only:
        query["is_active"] = True
    
    promo_codes = await db.promo_codes.find(query, {"_id": 0}).to_list(length=500)
    
    # Add usage stats
    for code in promo_codes:
        usage_count = await db.promo_code_usage.count_documents({"code": code["code"]})
        code["usage_count"] = usage_count
    
    return {"promo_codes": promo_codes}


@admin_membership_router.post("/promo-codes")
async def create_promo_code(request: PromoCodeRequest, admin: dict = Depends(get_admin_user)):
    """Create a new promo code"""
    # Check if code already exists
    existing = await db.promo_codes.find_one({"code": request.code.upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Promo code already exists")
    
    promo_code = {
        "code": request.code.upper(),
        "discount_type": request.discount_type,
        "discount_value": request.discount_value,
        "max_uses": request.max_uses,
        "valid_until": request.valid_until,
        "applicable_tiers": request.applicable_tiers,
        "is_active": request.is_active,
        "description": request.description,
        "created_by": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.promo_codes.insert_one(promo_code)
    
    await db.admin_audit_logs.insert_one({
        "action": "promo_code_created",
        "code": request.code.upper(),
        "admin_id": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "promo_code": {**promo_code, "_id": None}}


@admin_membership_router.put("/promo-codes/{code}")
async def update_promo_code(code: str, request: PromoCodeRequest, admin: dict = Depends(get_admin_user)):
    """Update an existing promo code"""
    existing = await db.promo_codes.find_one({"code": code.upper()})
    if not existing:
        raise HTTPException(status_code=404, detail="Promo code not found")
    
    update_data = {
        "discount_type": request.discount_type,
        "discount_value": request.discount_value,
        "max_uses": request.max_uses,
        "valid_until": request.valid_until,
        "applicable_tiers": request.applicable_tiers,
        "is_active": request.is_active,
        "description": request.description,
        "updated_by": admin["user_id"],
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.promo_codes.update_one(
        {"code": code.upper()},
        {"$set": update_data}
    )
    
    return {"success": True, "message": f"Promo code {code.upper()} updated"}


@admin_membership_router.delete("/promo-codes/{code}")
async def delete_promo_code(code: str, admin: dict = Depends(get_admin_user)):
    """Delete a promo code"""
    result = await db.promo_codes.delete_one({"code": code.upper()})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Promo code not found")
    
    await db.admin_audit_logs.insert_one({
        "action": "promo_code_deleted",
        "code": code.upper(),
        "admin_id": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "message": f"Promo code {code.upper()} deleted"}


# ============== TRANSACTION MONITORING ==============

@admin_membership_router.get("/transactions")
async def get_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    transaction_type: Optional[str] = None,
    status: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_id: Optional[str] = None,
    flagged_only: bool = False,
    admin: dict = Depends(get_admin_user)
):
    """Get transactions with filtering"""
    query = {}
    
    if transaction_type:
        query["transaction_type"] = transaction_type
    if status:
        query["status"] = status
    if user_id:
        query["user_id"] = user_id
    if flagged_only:
        query["is_flagged"] = True
    if min_amount is not None or max_amount is not None:
        query["amount"] = {}
        if min_amount is not None:
            query["amount"]["$gte"] = min_amount
        if max_amount is not None:
            query["amount"]["$lte"] = max_amount
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" not in query:
            query["created_at"] = {}
        query["created_at"]["$lte"] = end_date
    
    # Get from multiple transaction collections
    all_transactions = []
    
    # BL transactions
    bl_txns = await db.bl_transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    for txn in bl_txns:
        txn["source"] = "bl_transactions"
    all_transactions.extend(bl_txns)
    
    # Payment transactions
    payment_query = query.copy()
    if "transaction_type" in payment_query:
        payment_query["payment_method"] = payment_query.pop("transaction_type")
    payment_txns = await db.payment_transactions.find(
        payment_query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    for txn in payment_txns:
        txn["source"] = "payment_transactions"
    all_transactions.extend(payment_txns)
    
    # Commission transactions
    commission_txns = await db.commission_history.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    for txn in commission_txns:
        txn["source"] = "commissions"
    all_transactions.extend(commission_txns)
    
    # Sort by date and limit
    all_transactions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    all_transactions = all_transactions[:limit]
    
    # Get total counts
    total_bl = await db.bl_transactions.count_documents(query if "payment_method" not in query else {})
    total_payment = await db.payment_transactions.count_documents(payment_query if payment_query else {})
    total_commission = await db.commission_history.count_documents(query if "payment_method" not in query else {})
    
    return {
        "transactions": all_transactions,
        "total": total_bl + total_payment + total_commission,
        "skip": skip,
        "limit": limit
    }


@admin_membership_router.post("/transactions/flag")
async def flag_transaction(request: FlagTransactionRequest, admin: dict = Depends(get_admin_user)):
    """Flag a transaction as suspicious"""
    flag_data = {
        "transaction_id": request.transaction_id,
        "reason": request.reason,
        "severity": request.severity,
        "action_taken": request.action_taken,
        "flagged_by": admin["user_id"],
        "flagged_at": datetime.now(timezone.utc).isoformat(),
        "status": "pending_review"
    }
    
    # Store the flag
    await db.flagged_transactions.insert_one(flag_data)
    
    # Update original transaction
    collections = ["bl_transactions", "payment_transactions", "commission_history"]
    for coll in collections:
        result = await db[coll].update_one(
            {"$or": [
                {"transaction_id": request.transaction_id},
                {"commission_id": request.transaction_id}
            ]},
            {"$set": {"is_flagged": True, "flag_severity": request.severity}}
        )
        if result.modified_count > 0:
            break
    
    await db.admin_audit_logs.insert_one({
        "action": "transaction_flagged",
        "transaction_id": request.transaction_id,
        "reason": request.reason,
        "severity": request.severity,
        "admin_id": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "message": "Transaction flagged successfully"}


@admin_membership_router.get("/transactions/flagged")
async def get_flagged_transactions(
    status: str = Query("pending_review"),
    severity: Optional[str] = None,
    admin: dict = Depends(get_admin_user)
):
    """Get all flagged transactions"""
    query = {"status": status}
    if severity:
        query["severity"] = severity
    
    flagged = await db.flagged_transactions.find(
        query, {"_id": 0}
    ).sort("flagged_at", -1).to_list(length=500)
    
    return {"flagged_transactions": flagged}


@admin_membership_router.put("/transactions/flag/{transaction_id}/resolve")
async def resolve_flagged_transaction(
    transaction_id: str,
    resolution: str = Query(..., description="Resolution status: resolved, false_positive, action_taken"),
    notes: str = Query(""),
    admin: dict = Depends(get_admin_user)
):
    """Resolve a flagged transaction"""
    result = await db.flagged_transactions.update_one(
        {"transaction_id": transaction_id},
        {"$set": {
            "status": resolution,
            "resolution_notes": notes,
            "resolved_by": admin["user_id"],
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Flagged transaction not found")
    
    # Update original transaction if resolved
    if resolution in ["resolved", "false_positive"]:
        collections = ["bl_transactions", "payment_transactions", "commission_history"]
        for coll in collections:
            await db[coll].update_one(
                {"$or": [
                    {"transaction_id": transaction_id},
                    {"commission_id": transaction_id}
                ]},
                {"$set": {"is_flagged": False}}
            )
    
    return {"success": True, "message": f"Transaction marked as {resolution}"}


# ============== COMMISSION CONTROLS ==============

@admin_membership_router.get("/commission-stats")
async def get_commission_stats(
    period: str = Query("30d", description="7d, 30d, 90d, all"),
    admin: dict = Depends(get_admin_user)
):
    """Get commission statistics"""
    now = datetime.now(timezone.utc)
    
    if period == "7d":
        start_date = (now - timedelta(days=7)).isoformat()
    elif period == "30d":
        start_date = (now - timedelta(days=30)).isoformat()
    elif period == "90d":
        start_date = (now - timedelta(days=90)).isoformat()
    else:
        start_date = None
    
    query = {}
    if start_date:
        query["created_at"] = {"$gte": start_date}
    
    # Get commission totals by tier
    pipeline = [
        {"$match": query} if query else {"$match": {}},
        {"$group": {
            "_id": "$level",
            "total_amount": {"$sum": "$amount_usd"},
            "count": {"$sum": 1},
            "avg_amount": {"$avg": "$amount_usd"}
        }}
    ]
    
    level_stats = await db.commission_history.aggregate(pipeline).to_list(length=10)
    
    # Get top earners
    top_earners_pipeline = [
        {"$match": query} if query else {"$match": {}},
        {"$group": {
            "_id": "$beneficiary_id",
            "total_earned": {"$sum": "$amount_usd"},
            "commission_count": {"$sum": 1}
        }},
        {"$sort": {"total_earned": -1}},
        {"$limit": 20}
    ]
    
    top_earners = await db.commission_history.aggregate(top_earners_pipeline).to_list(length=20)
    
    # Enrich with user data
    for earner in top_earners:
        user = await db.users.find_one(
            {"user_id": earner["_id"]},
            {"_id": 0, "username": 1, "email": 1, "subscription_tier": 1}
        )
        if user:
            earner.update(user)
    
    # Get pending/held commissions
    held_commissions = await db.commission_history.count_documents({
        "status": {"$in": ["pending", "held"]},
        **query
    })
    
    # Total volume
    total_volume = await db.commission_history.aggregate([
        {"$match": query} if query else {"$match": {}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}}
    ]).to_list(length=1)
    
    return {
        "period": period,
        "level_stats": level_stats,
        "top_earners": top_earners,
        "held_commissions_count": held_commissions,
        "total_volume": total_volume[0]["total"] if total_volume else 0
    }


@admin_membership_router.post("/commission-hold/{user_id}")
async def hold_user_commissions(
    user_id: str,
    reason: str = Query(...),
    admin: dict = Depends(get_admin_user)
):
    """Put a hold on a user's commission payouts"""
    # Mark all pending commissions as held
    result = await db.commission_history.update_many(
        {"beneficiary_id": user_id, "status": "pending"},
        {"$set": {
            "status": "held",
            "hold_reason": reason,
            "held_by": admin["user_id"],
            "held_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update user record
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "commission_hold": True,
            "commission_hold_reason": reason
        }}
    )
    
    await db.admin_audit_logs.insert_one({
        "action": "commission_hold",
        "user_id": user_id,
        "reason": reason,
        "commissions_affected": result.modified_count,
        "admin_id": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": "Hold placed on user's commissions",
        "commissions_held": result.modified_count
    }


@admin_membership_router.post("/commission-release/{user_id}")
async def release_user_commissions(
    user_id: str,
    admin: dict = Depends(get_admin_user)
):
    """Release hold on a user's commission payouts"""
    # Release all held commissions
    result = await db.commission_history.update_many(
        {"beneficiary_id": user_id, "status": "held"},
        {"$set": {
            "status": "pending",
            "released_by": admin["user_id"],
            "released_at": datetime.now(timezone.utc).isoformat()
        },
        "$unset": {"hold_reason": "", "held_by": "", "held_at": ""}}
    )
    
    # Update user record
    await db.users.update_one(
        {"user_id": user_id},
        {"$unset": {"commission_hold": "", "commission_hold_reason": ""}}
    )
    
    await db.admin_audit_logs.insert_one({
        "action": "commission_release",
        "user_id": user_id,
        "commissions_released": result.modified_count,
        "admin_id": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": "Commission hold released",
        "commissions_released": result.modified_count
    }


# ============== SUBSCRIPTION ANALYTICS ==============

@admin_membership_router.get("/subscription-analytics")
async def get_subscription_analytics(
    period: str = Query("30d"),
    admin: dict = Depends(get_admin_user)
):
    """Get detailed subscription analytics"""
    now = datetime.now(timezone.utc)
    
    if period == "7d":
        start_date = (now - timedelta(days=7)).isoformat()
        days = 7
    elif period == "30d":
        start_date = (now - timedelta(days=30)).isoformat()
        days = 30
    elif period == "90d":
        start_date = (now - timedelta(days=90)).isoformat()
        days = 90
    else:
        start_date = None
        days = 365
    
    # Current tier distribution
    tier_distribution = []
    for tier in ["free", "bronze", "silver", "gold", "diamond"]:
        count = await db.subscriptions.count_documents({"tier": tier, "status": "active"})
        tier_distribution.append({"tier": tier, "count": count})
    
    # New subscriptions in period
    new_subs_query = {"created_at": {"$gte": start_date}} if start_date else {}
    new_subscriptions = await db.subscriptions.count_documents({
        **new_subs_query,
        "tier": {"$ne": "free"}
    })
    
    # Churned subscriptions
    churned = await db.subscriptions.count_documents({
        "status": "canceled",
        "updated_at": {"$gte": start_date} if start_date else {}
    })
    
    # Revenue from subscriptions
    revenue_pipeline = [
        {"$match": {
            "transaction_type": "subscription",
            "status": "completed",
            **({"created_at": {"$gte": start_date}} if start_date else {})
        }},
        {"$group": {
            "_id": "$tier",
            "revenue": {"$sum": "$amount"},
            "count": {"$sum": 1}
        }}
    ]
    revenue_by_tier = await db.bl_transactions.aggregate(revenue_pipeline).to_list(length=10)
    
    # Daily signups trend
    daily_signups = []
    for i in range(min(days, 30)):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        count = await db.subscriptions.count_documents({
            "created_at": {"$gte": day_start.isoformat(), "$lt": day_end.isoformat()},
            "tier": {"$ne": "free"}
        })
        daily_signups.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "count": count
        })
    daily_signups.reverse()
    
    return {
        "period": period,
        "tier_distribution": tier_distribution,
        "new_subscriptions": new_subscriptions,
        "churned_subscriptions": churned,
        "revenue_by_tier": revenue_by_tier,
        "daily_signups_trend": daily_signups,
        "churn_rate": round(churned / max(new_subscriptions, 1) * 100, 2)
    }
