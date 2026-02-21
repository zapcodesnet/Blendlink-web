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
        
        # Check if user is admin (check users collection + admin_admins collection)
        is_admin = user.get("is_admin") or user.get("role") in ["admin", "superadmin", "super_admin", "co_admin", "moderator"]
        
        if not is_admin:
            # Also check admin_admins collection
            admin_record = await db.admin_admins.find_one(
                {"email": user.get("email"), "is_active": True},
                {"_id": 0, "role": 1}
            )
            if admin_record and admin_record.get("role") in ["super_admin", "co_admin", "moderator"]:
                is_admin = True
        
        if not is_admin:
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


@admin_membership_router.get("/commissions/held")
async def get_held_commissions(admin: dict = Depends(get_admin_user)):
    """Get list of all users with held commissions"""
    # Find users with commission hold
    users_with_hold = await db.users.find(
        {"commission_hold": True},
        {"_id": 0, "user_id": 1, "username": 1, "email": 1, "commission_hold_reason": 1}
    ).to_list(length=100)
    
    # Get held amounts for each user
    for user in users_with_hold:
        # Get total held amount
        pipeline = [
            {"$match": {"beneficiary_id": user["user_id"], "status": "held"}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}, "count": {"$sum": 1}}}
        ]
        result = await db.commission_history.aggregate(pipeline).to_list(1)
        user["held_amount"] = result[0]["total"] if result else 0
        user["held_count"] = result[0]["count"] if result else 0
        
        # Get when hold was placed
        held_record = await db.admin_audit_logs.find_one(
            {"action": "commission_hold", "user_id": user["user_id"]},
            sort=[("created_at", -1)]
        )
        user["held_at"] = held_record.get("created_at") if held_record else None
        user["reason"] = user.get("commission_hold_reason", "")
    
    return {"held_commissions": users_with_hold}


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


# ============== REAL-TIME COMMISSION ADJUSTMENTS ==============

class CommissionAdjustmentRequest(BaseModel):
    """Request to adjust commission for a user or transaction"""
    user_id: Optional[str] = None
    transaction_id: Optional[str] = None
    adjustment_type: str = "percentage"  # percentage, fixed, override
    adjustment_value: float
    reason: str
    notify_user: bool = True
    apply_to_future: bool = False  # If true, applies to future commissions


class GlobalCommissionOverrideRequest(BaseModel):
    """Request to temporarily override global commission rates"""
    l1_rate_override: Optional[float] = None
    l2_rate_override: Optional[float] = None
    affected_tiers: List[str] = ["free", "bronze", "silver", "gold", "diamond"]
    reason: str
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None
    is_active: bool = True


@admin_membership_router.post("/commissions/adjust")
async def adjust_commission(request: CommissionAdjustmentRequest, admin: dict = Depends(get_admin_user)):
    """Adjust commission for a specific user or transaction in real-time"""
    now = datetime.now(timezone.utc).isoformat()
    
    if not request.user_id and not request.transaction_id:
        raise HTTPException(status_code=400, detail="Either user_id or transaction_id is required")
    
    adjustment_record = {
        "adjustment_id": f"adj_{uuid.uuid4().hex[:12]}",
        "user_id": request.user_id,
        "transaction_id": request.transaction_id,
        "adjustment_type": request.adjustment_type,
        "adjustment_value": request.adjustment_value,
        "reason": request.reason,
        "apply_to_future": request.apply_to_future,
        "created_by": admin["user_id"],
        "created_at": now,
        "status": "applied"
    }
    
    # If adjusting a specific transaction
    if request.transaction_id:
        txn = await db.commission_history.find_one({"commission_id": request.transaction_id})
        if not txn:
            raise HTTPException(status_code=404, detail="Commission transaction not found")
        
        original_amount = txn.get("amount_usd", 0)
        
        if request.adjustment_type == "percentage":
            new_amount = original_amount * (1 + request.adjustment_value / 100)
        elif request.adjustment_type == "fixed":
            new_amount = original_amount + request.adjustment_value
        else:  # override
            new_amount = request.adjustment_value
        
        # Update the commission
        await db.commission_history.update_one(
            {"commission_id": request.transaction_id},
            {"$set": {
                "amount_usd": new_amount,
                "original_amount_usd": original_amount,
                "adjusted": True,
                "adjustment_reason": request.reason,
                "adjusted_at": now,
                "adjusted_by": admin["user_id"]
            }}
        )
        
        adjustment_record["original_amount"] = original_amount
        adjustment_record["new_amount"] = new_amount
        adjustment_record["affected_user_id"] = txn.get("beneficiary_id")
        
        # Update user's pending balance if needed
        if txn.get("status") == "pending":
            diff = new_amount - original_amount
            await db.users.update_one(
                {"user_id": txn.get("beneficiary_id")},
                {"$inc": {"pending_commissions": diff}}
            )
    
    # If applying a user-level adjustment for future commissions
    if request.user_id and request.apply_to_future:
        await db.users.update_one(
            {"user_id": request.user_id},
            {"$set": {
                "commission_adjustment": {
                    "type": request.adjustment_type,
                    "value": request.adjustment_value,
                    "reason": request.reason,
                    "set_by": admin["user_id"],
                    "set_at": now
                }
            }}
        )
    
    # Store adjustment record
    await db.commission_adjustments.insert_one(adjustment_record)
    
    # Audit log
    await db.admin_audit_logs.insert_one({
        "action": "commission_adjusted",
        "details": adjustment_record,
        "admin_id": admin["user_id"],
        "created_at": now
    })
    
    # Notify user if requested
    if request.notify_user:
        target_user_id = request.user_id or adjustment_record.get("affected_user_id")
        if target_user_id:
            await db.notifications.insert_one({
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": target_user_id,
                "type": "commission_adjustment",
                "title": "Commission Adjustment",
                "message": f"Your commission has been adjusted. Reason: {request.reason}",
                "read": False,
                "created_at": now
            })
    
    return {
        "success": True,
        "adjustment_id": adjustment_record["adjustment_id"],
        "message": "Commission adjusted successfully"
    }


@admin_membership_router.post("/commissions/global-override")
async def set_global_commission_override(request: GlobalCommissionOverrideRequest, admin: dict = Depends(get_admin_user)):
    """Set a global commission rate override affecting all or specific tiers"""
    now = datetime.now(timezone.utc).isoformat()
    
    override_record = {
        "override_id": f"gco_{uuid.uuid4().hex[:12]}",
        "l1_rate_override": request.l1_rate_override,
        "l2_rate_override": request.l2_rate_override,
        "affected_tiers": request.affected_tiers,
        "reason": request.reason,
        "starts_at": request.starts_at or now,
        "expires_at": request.expires_at,
        "is_active": request.is_active,
        "created_by": admin["user_id"],
        "created_at": now
    }
    
    # Deactivate any existing active overrides
    await db.global_commission_overrides.update_many(
        {"is_active": True},
        {"$set": {"is_active": False, "deactivated_at": now, "deactivated_by": admin["user_id"]}}
    )
    
    # Insert new override
    await db.global_commission_overrides.insert_one(override_record)
    
    # Audit log
    await db.admin_audit_logs.insert_one({
        "action": "global_commission_override_set",
        "details": override_record,
        "admin_id": admin["user_id"],
        "created_at": now
    })
    
    return {
        "success": True,
        "override_id": override_record["override_id"],
        "message": "Global commission override applied"
    }


@admin_membership_router.get("/commissions/global-override")
async def get_global_commission_override(admin: dict = Depends(get_admin_user)):
    """Get current active global commission override"""
    override = await db.global_commission_overrides.find_one(
        {"is_active": True},
        {"_id": 0}
    )
    
    history = await db.global_commission_overrides.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(length=10)
    
    return {
        "active_override": override,
        "history": history
    }


@admin_membership_router.delete("/commissions/global-override/{override_id}")
async def remove_global_commission_override(override_id: str, admin: dict = Depends(get_admin_user)):
    """Remove a global commission override"""
    result = await db.global_commission_overrides.update_one(
        {"override_id": override_id},
        {"$set": {
            "is_active": False,
            "deactivated_at": datetime.now(timezone.utc).isoformat(),
            "deactivated_by": admin["user_id"]
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Override not found")
    
    await db.admin_audit_logs.insert_one({
        "action": "global_commission_override_removed",
        "override_id": override_id,
        "admin_id": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "message": "Global commission override removed"}


@admin_membership_router.get("/commissions/adjustments")
async def get_commission_adjustments(
    user_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    admin: dict = Depends(get_admin_user)
):
    """Get history of commission adjustments"""
    query = {}
    if user_id:
        query["$or"] = [{"user_id": user_id}, {"affected_user_id": user_id}]
    
    adjustments = await db.commission_adjustments.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    total = await db.commission_adjustments.count_documents(query)
    
    return {
        "adjustments": adjustments,
        "total": total,
        "skip": skip,
        "limit": limit
    }


# ============== CUSTOM MEMBERSHIP BENEFITS ==============

class CustomBenefitRequest(BaseModel):
    """Request to create or update a custom benefit"""
    benefit_id: Optional[str] = None  # For updates
    name: str
    description: str
    benefit_type: str  # numeric, boolean, text, percentage
    default_value: Any
    icon: Optional[str] = None
    display_order: int = 0
    tier_values: Optional[Dict[str, Any]] = None  # Override values per tier


@admin_membership_router.get("/custom-benefits")
async def get_custom_benefits(admin: dict = Depends(get_admin_user)):
    """Get all custom benefits"""
    benefits = await db.custom_membership_benefits.find(
        {},
        {"_id": 0}
    ).sort("display_order", 1).to_list(length=100)
    
    return {"benefits": benefits}


@admin_membership_router.post("/custom-benefits")
async def create_custom_benefit(request: CustomBenefitRequest, admin: dict = Depends(get_admin_user)):
    """Create a new custom membership benefit"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Check for duplicate name
    existing = await db.custom_membership_benefits.find_one({"name": request.name})
    if existing:
        raise HTTPException(status_code=400, detail="A benefit with this name already exists")
    
    benefit_id = f"benefit_{uuid.uuid4().hex[:12]}"
    
    benefit = {
        "benefit_id": benefit_id,
        "name": request.name,
        "description": request.description,
        "benefit_type": request.benefit_type,
        "default_value": request.default_value,
        "icon": request.icon,
        "display_order": request.display_order,
        "tier_values": request.tier_values or {
            "free": request.default_value,
            "bronze": request.default_value,
            "silver": request.default_value,
            "gold": request.default_value,
            "diamond": request.default_value
        },
        "created_by": admin["user_id"],
        "created_at": now,
        "is_active": True
    }
    
    await db.custom_membership_benefits.insert_one(benefit)
    
    await db.admin_audit_logs.insert_one({
        "action": "custom_benefit_created",
        "benefit": benefit,
        "admin_id": admin["user_id"],
        "created_at": now
    })
    
    return {"success": True, "benefit_id": benefit_id, "benefit": {k: v for k, v in benefit.items() if k != "_id"}}


@admin_membership_router.put("/custom-benefits/{benefit_id}")
async def update_custom_benefit(benefit_id: str, request: CustomBenefitRequest, admin: dict = Depends(get_admin_user)):
    """Update an existing custom benefit"""
    existing = await db.custom_membership_benefits.find_one({"benefit_id": benefit_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Benefit not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    update_data = {
        "name": request.name,
        "description": request.description,
        "benefit_type": request.benefit_type,
        "default_value": request.default_value,
        "icon": request.icon,
        "display_order": request.display_order,
        "updated_by": admin["user_id"],
        "updated_at": now
    }
    
    if request.tier_values:
        update_data["tier_values"] = request.tier_values
    
    await db.custom_membership_benefits.update_one(
        {"benefit_id": benefit_id},
        {"$set": update_data}
    )
    
    await db.admin_audit_logs.insert_one({
        "action": "custom_benefit_updated",
        "benefit_id": benefit_id,
        "changes": update_data,
        "admin_id": admin["user_id"],
        "created_at": now
    })
    
    return {"success": True, "message": f"Benefit '{request.name}' updated"}


@admin_membership_router.delete("/custom-benefits/{benefit_id}")
async def delete_custom_benefit(benefit_id: str, admin: dict = Depends(get_admin_user)):
    """Delete a custom benefit"""
    result = await db.custom_membership_benefits.delete_one({"benefit_id": benefit_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Benefit not found")
    
    await db.admin_audit_logs.insert_one({
        "action": "custom_benefit_deleted",
        "benefit_id": benefit_id,
        "admin_id": admin["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "message": "Custom benefit deleted"}


@admin_membership_router.put("/custom-benefits/{benefit_id}/tier-value")
async def update_benefit_tier_value(
    benefit_id: str,
    tier_id: str = Query(...),
    value: Any = Query(...),
    admin: dict = Depends(get_admin_user)
):
    """Update a specific tier's value for a custom benefit"""
    valid_tiers = ["free", "bronze", "silver", "gold", "diamond"]
    if tier_id not in valid_tiers:
        raise HTTPException(status_code=400, detail=f"Invalid tier. Must be one of: {valid_tiers}")
    
    result = await db.custom_membership_benefits.update_one(
        {"benefit_id": benefit_id},
        {"$set": {
            f"tier_values.{tier_id}": value,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Benefit not found")
    
    return {"success": True, "message": f"Tier '{tier_id}' value updated to {value}"}


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


# ============== PER-USER MEMBERSHIP MANAGEMENT ==============

@admin_membership_router.get("/users")
async def search_membership_users(
    search: str = "",
    page: int = 1,
    limit: int = 20,
    current_user: dict = Depends(get_admin_user)
):
    """Search users for membership management"""
    skip = (page - 1) * limit
    
    query = {}
    if search:
        query = {"$or": [
            {"email": {"$regex": search, "$options": "i"}},
            {"username": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
            {"user_id": {"$regex": search, "$options": "i"}},
        ]}
    
    total = await db.users.count_documents(query)
    users = await db.users.find(
        query,
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Enrich with subscription data
    results = []
    for u in users:
        sub = await db.subscriptions.find_one({"user_id": u["user_id"]}, {"_id": 0})
        results.append({
            "user_id": u.get("user_id"),
            "email": u.get("email"),
            "name": u.get("name"),
            "username": u.get("username"),
            "subscription_tier": u.get("subscription_tier") or "free",
            "subscription_status": sub.get("status", "none") if sub else "none",
            "stripe_customer_id": sub.get("stripe_customer_id") if sub else None,
            "custom_price": sub.get("custom_price") if sub else None,
            "custom_validity": sub.get("custom_validity") if sub else None,
            "validity_type": sub.get("validity_type") if sub else None,
            "expires_at": sub.get("current_period_end") or sub.get("expires_at") if sub else None,
            "started_at": sub.get("current_period_start") or sub.get("created_at") if sub else None,
            "created_at": u.get("created_at"),
            "bl_coins": u.get("bl_coins", 0),
        })
    
    return {"users": results, "total": total, "page": page, "limit": limit}


@admin_membership_router.get("/users/{user_id}")
async def get_user_membership_detail(user_id: str, current_user: dict = Depends(get_admin_user)):
    """Get detailed membership info for a specific user"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    sub = await db.subscriptions.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "user": user,
        "subscription": sub,
        "current_tier": user.get("subscription_tier") or "free",
    }


@admin_membership_router.post("/users/{user_id}/change-tier")
async def change_user_tier(
    user_id: str,
    request: Request,
    current_user: dict = Depends(get_admin_user)
):
    """Change a user's membership tier (admin override)"""
    body = await request.json()
    new_tier = body.get("tier", "free")
    custom_price = body.get("custom_price")
    validity_type = body.get("validity_type")  # months, years, forever, date
    validity_value = body.get("validity_value")  # number or date string
    cancel_immediately = body.get("cancel_immediately", False)
    reason = body.get("reason", "")
    
    valid_tiers = ["free", "bronze", "silver", "gold", "diamond"]
    if new_tier not in valid_tiers:
        raise HTTPException(status_code=400, detail=f"Invalid tier: {new_tier}")
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    old_tier = user.get("subscription_tier") or "free"
    now = datetime.now(timezone.utc)
    
    # Calculate expiry
    expires_at = None
    if validity_type == "months" and validity_value:
        expires_at = (now + timedelta(days=int(validity_value) * 30)).isoformat()
    elif validity_type == "years" and validity_value:
        expires_at = (now + timedelta(days=int(validity_value) * 365)).isoformat()
    elif validity_type == "forever":
        expires_at = "2099-12-31T23:59:59+00:00"  # Lifetime
    elif validity_type == "date" and validity_value:
        expires_at = validity_value  # ISO date string from date picker
    
    # Update user's tier
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"subscription_tier": new_tier}}
    )
    
    # Update subscription record
    sub_update = {
        "user_id": user_id,
        "tier": new_tier,
        "status": "active" if new_tier != "free" else "none",
        "admin_override": True,
        "admin_override_by": admin.get("user_id"),
        "admin_override_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    
    if custom_price is not None:
        sub_update["custom_price"] = float(custom_price)
    if expires_at:
        sub_update["expires_at"] = expires_at
        sub_update["current_period_end"] = expires_at
    if validity_type:
        sub_update["validity_type"] = validity_type
        sub_update["validity_value"] = validity_value
    
    await db.subscriptions.update_one(
        {"user_id": user_id},
        {"$set": sub_update},
        upsert=True
    )
    
    # Audit log
    await db.admin_audit_log.insert_one({
        "action": "change_user_tier",
        "admin_id": admin.get("user_id"),
        "admin_email": admin.get("email"),
        "target_user_id": user_id,
        "old_tier": old_tier,
        "new_tier": new_tier,
        "custom_price": custom_price,
        "validity_type": validity_type,
        "validity_value": validity_value,
        "reason": reason,
        "timestamp": now.isoformat(),
    })
    
    return {
        "success": True,
        "message": f"User {user_id} tier changed from {old_tier} to {new_tier}",
        "old_tier": old_tier,
        "new_tier": new_tier,
    }


@admin_membership_router.post("/users/{user_id}/cancel")
async def cancel_user_subscription(
    user_id: str,
    request: Request,
    current_user: dict = Depends(get_admin_user)
):
    """Cancel a user's subscription"""
    body = await request.json()
    cancel_immediately = body.get("immediately", False)
    reason = body.get("reason", "")
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    old_tier = user.get("subscription_tier") or "free"
    now = datetime.now(timezone.utc)
    
    if cancel_immediately:
        await db.users.update_one({"user_id": user_id}, {"$set": {"subscription_tier": "free"}})
        await db.subscriptions.update_one(
            {"user_id": user_id},
            {"$set": {"status": "canceled", "tier": "free", "canceled_at": now.isoformat(), "canceled_by": admin.get("user_id")}}
        )
    else:
        await db.subscriptions.update_one(
            {"user_id": user_id},
            {"$set": {"status": "cancel_at_period_end", "canceled_at": now.isoformat(), "canceled_by": admin.get("user_id")}}
        )
    
    # Audit log
    await db.admin_audit_log.insert_one({
        "action": "cancel_user_subscription",
        "admin_id": admin.get("user_id"),
        "admin_email": admin.get("email"),
        "target_user_id": user_id,
        "old_tier": old_tier,
        "immediately": cancel_immediately,
        "reason": reason,
        "timestamp": now.isoformat(),
    })
    
    return {"success": True, "message": f"Subscription canceled for user {user_id}", "immediately": cancel_immediately}


@admin_membership_router.get("/audit-log")
async def get_membership_audit_log(
    page: int = 1,
    limit: int = 50,
    current_user: dict = Depends(get_admin_user)
):
    """Get membership change audit log (Super Admin only)"""
    skip = (page - 1) * limit
    total = await db.admin_audit_log.count_documents({"action": {"$in": ["change_user_tier", "cancel_user_subscription"]}})
    logs = await db.admin_audit_log.find(
        {"action": {"$in": ["change_user_tier", "cancel_user_subscription"]}},
        {"_id": 0}
    ).sort("timestamp", -1).skip(skip).limit(limit).to_list(length=limit)
    
    return {"logs": logs, "total": total, "page": page}

