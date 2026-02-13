"""
Admin Orphan and Diamond Leader Management API
Provides endpoints for managing orphans and diamond leaders from the admin panel.

Enhanced with:
- 11-tier priority orphan assignment system
- Round-robin distribution within tiers
- Max 2 orphans per user (permanent cap)
- Manual override with validation
- Comprehensive audit trail
- Batch auto-assignment
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
import uuid
import logging

# Import shared dependencies
from server import db, get_current_user

# Import enhanced orphan system
from orphan_assignment_system import (
    find_eligible_recipient,
    assign_orphan_to_recipient,
    auto_assign_single_orphan,
    batch_auto_assign_orphans,
    get_login_frequency,
    get_tier_description,
    calculate_user_tier,
    calculate_priority_score,
    AssignmentType,
    LoginFrequency,
    MAX_ORPHANS_PER_USER,
    INACTIVITY_THRESHOLD_DAYS
)

logger = logging.getLogger(__name__)

# Create routers
admin_orphans_router = APIRouter(prefix="/admin/orphans", tags=["Admin Orphans"])
admin_diamonds_router = APIRouter(prefix="/admin/diamond-leaders", tags=["Admin Diamond Leaders"])

# ============== ORPHAN MANAGEMENT ==============

@admin_orphans_router.get("")
async def get_orphans(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,  # 'unassigned', 'assigned', or None for all
    current_user: dict = Depends(get_current_user)
):
    """Get list of orphans (users without referrers) with detailed info"""
    query = {"$or": [
        {"referred_by": None},
        {"referred_by": {"$exists": False}},
        {"is_orphan": True}
    ]}
    
    if status == "unassigned":
        query["is_orphan_assigned"] = {"$ne": True}
    elif status == "assigned":
        query["is_orphan_assigned"] = True
    
    orphans = await db.users.find(
        query,
        {"user_id": 1, "username": 1, "email": 1, "created_at": 1, 
         "is_orphan_assigned": 1, "referred_by": 1, "last_login_at": 1, 
         "bl_coins": 1, "orphan_assigned_at": 1, "orphan_assignment_type": 1,
         "orphan_assigned_tier": 1, "_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with assigned parent info and login frequency
    for orphan in orphans:
        if orphan.get("referred_by"):
            parent = await db.users.find_one(
                {"user_id": orphan["referred_by"]},
                {"username": 1, "_id": 0}
            )
            orphan["assigned_to_username"] = parent.get("username") if parent else "Unknown"
        
        # Add login frequency
        orphan["login_frequency"] = get_login_frequency(orphan.get("last_login_at")).value
    
    # Get total count
    total_count = await db.users.count_documents(query)
    
    return {
        "orphans": orphans,
        "total": total_count,
        "skip": skip,
        "limit": limit
    }

@admin_orphans_router.get("/stats")
async def get_orphan_stats(current_user: dict = Depends(get_current_user)):
    """Get orphan statistics"""
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    
    total = await db.users.count_documents({"$or": [
        {"referred_by": None},
        {"referred_by": {"$exists": False}},
        {"is_orphan": True}
    ]})
    
    unassigned = await db.users.count_documents({
        "$or": [{"referred_by": None}, {"referred_by": {"$exists": False}}],
        "is_orphan_assigned": {"$ne": True}
    })
    
    assigned_today = await db.users.count_documents({
        "orphan_assigned_at": {"$gte": today.isoformat()}
    })
    
    return {
        "total_orphans": total,
        "unassigned": unassigned,
        "assigned_today": assigned_today,
        "avg_assignment_time": 24  # Default value
    }

@admin_orphans_router.get("/potential-parents")
async def get_potential_parents(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get list of potential parents for orphan assignment, sorted by tier priority"""
    now = datetime.now(timezone.utc)
    six_months_ago = (now - timedelta(days=180)).isoformat()
    daily_threshold = (now - timedelta(days=1)).isoformat()
    weekly_threshold = (now - timedelta(days=7)).isoformat()
    monthly_threshold = (now - timedelta(days=30)).isoformat()
    quarterly_threshold = (now - timedelta(days=90)).isoformat()
    
    parents = []
    
    # Define tier queries in priority order
    tier_queries = [
        {"id_verified": True, "direct_referrals": 0, "last_login_at": {"$gte": daily_threshold}},
        {"direct_referrals": 0, "last_login_at": {"$gte": daily_threshold}},
        {"direct_referrals": 0, "last_login_at": {"$gte": weekly_threshold}},
        {"direct_referrals": 0, "last_login_at": {"$gte": monthly_threshold}},
        {"direct_referrals": 0, "last_login_at": {"$gte": quarterly_threshold}},
        {"id_verified": True, "direct_referrals": 1, "last_login_at": {"$gte": daily_threshold}},
        {"direct_referrals": 1, "last_login_at": {"$gte": daily_threshold}},
        {"direct_referrals": 1, "last_login_at": {"$gte": weekly_threshold}},
        {"direct_referrals": 1, "last_login_at": {"$gte": monthly_threshold}},
        {"direct_referrals": 1, "last_login_at": {"$gte": quarterly_threshold}},
        {"direct_referrals": 1, "last_login_at": {"$gte": six_months_ago}},
    ]
    
    tier_descriptions = [
        "ID-verified + 0 recruits + daily login",
        "0 recruits + daily login",
        "0 recruits + weekly login",
        "0 recruits + monthly login",
        "0 recruits + quarterly login",
        "ID-verified + 1 recruit + daily login",
        "1 recruit + daily login",
        "1 recruit + weekly login",
        "1 recruit + monthly login",
        "1 recruit + quarterly login",
        "1 recruit + biannual login",
    ]
    
    seen_ids = set()
    
    for tier_idx, tier_query in enumerate(tier_queries, 1):
        if len(parents) >= limit:
            break
            
        base_query = {
            **tier_query,
            "orphans_assigned_count": {"$lt": MAX_ORPHANS_PER_USER},
            "last_login_at": {"$gte": six_months_ago},
        }
        
        candidates = await db.users.find(
            base_query,
            {"user_id": 1, "username": 1, "direct_referrals": 1, 
             "orphans_assigned_count": 1, "last_login_at": 1, "_id": 0}
        ).sort("created_at", 1).limit(5).to_list(5)
        
        for candidate in candidates:
            if candidate["user_id"] not in seen_ids and len(parents) < limit:
                seen_ids.add(candidate["user_id"])
                parents.append({
                    **candidate,
                    "tier": tier_idx,
                    "tier_desc": tier_descriptions[tier_idx - 1],
                    "orphans_assigned": candidate.get("orphans_assigned_count", 0)
                })
    
    return {"parents": parents}

@admin_orphans_router.post("/assign")
async def manual_assign_orphan(
    orphan_id: str,
    parent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Manually assign an orphan to a specific parent"""
    # Verify orphan exists
    orphan = await db.users.find_one({"user_id": orphan_id})
    if not orphan:
        raise HTTPException(status_code=404, detail="Orphan not found")
    
    # Verify parent exists and has capacity
    parent = await db.users.find_one({"user_id": parent_id})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    
    if parent.get("orphans_assigned_count", 0) >= MAX_ORPHANS_PER_USER:
        raise HTTPException(status_code=400, detail="Parent has reached orphan limit")
    
    # Assign orphan
    await db.users.update_one(
        {"user_id": orphan_id},
        {"$set": {
            "referred_by": parent_id,
            "is_orphan": True,
            "is_orphan_assigned": True,
            "orphan_assigned_at": datetime.now(timezone.utc).isoformat(),
            "orphan_assignment_type": "manual"
        }}
    )
    
    # Update parent counts
    await db.users.update_one(
        {"user_id": parent_id},
        {"$inc": {"orphans_assigned_count": 1, "direct_referrals": 1}}
    )
    
    # Log assignment
    await db.orphan_assignments.insert_one({
        "assignment_id": f"orphan_{uuid.uuid4().hex[:12]}",
        "orphan_user_id": orphan_id,
        "assigned_to": parent_id,
        "assignment_type": "manual",
        "assigned_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "message": "Orphan assigned successfully"}

@admin_orphans_router.post("/auto-assign")
async def auto_assign_orphan(
    orphan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Auto-assign an orphan using the 11-tier priority system"""
    from referral_system import find_orphan_recipient
    
    orphan = await db.users.find_one({"user_id": orphan_id})
    if not orphan:
        raise HTTPException(status_code=404, detail="Orphan not found")
    
    parent_id = await find_orphan_recipient()
    if not parent_id:
        raise HTTPException(status_code=400, detail="No suitable parent found in any tier")
    
    parent = await db.users.find_one({"user_id": parent_id}, {"username": 1})
    
    # Assign orphan
    await db.users.update_one(
        {"user_id": orphan_id},
        {"$set": {
            "referred_by": parent_id,
            "is_orphan": True,
            "is_orphan_assigned": True,
            "orphan_assigned_at": datetime.now(timezone.utc).isoformat(),
            "orphan_assignment_type": "auto"
        }}
    )
    
    # Update parent counts
    await db.users.update_one(
        {"user_id": parent_id},
        {"$inc": {"orphans_assigned_count": 1, "direct_referrals": 1}}
    )
    
    return {
        "success": True, 
        "assigned_to": parent_id,
        "assigned_to_username": parent.get("username", "Unknown")
    }

# ============== DIAMOND LEADER MANAGEMENT ==============

@admin_diamonds_router.get("")
async def get_diamond_leaders(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all diamond leaders with their performance metrics"""
    diamonds = await db.users.find(
        {"rank": "diamond_leader"},
        {"user_id": 1, "username": 1, "email": 1, "diamond_achieved_at": 1,
         "diamond_maintenance_due": 1, "direct_referrals": 1, "_id": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    # Get 30-day metrics for each diamond
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    for diamond in diamonds:
        # Commission total
        comm_result = await db.commissions.aggregate([
            {"$match": {"recipient_id": diamond["user_id"], "created_at": {"$gte": thirty_days_ago}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}}
        ]).to_list(1)
        diamond["total_commissions_30d"] = comm_result[0]["total"] if comm_result else 0
        
        # Sales total
        sales_result = await db.sales.aggregate([
            {"$match": {"seller_id": diamond["user_id"], "status": "completed", "created_at": {"$gte": thirty_days_ago}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}}
        ]).to_list(1)
        diamond["personal_sales_30d"] = sales_result[0]["total"] if sales_result else 0
        
        # BL earned
        bl_result = await db.transactions.aggregate([
            {"$match": {"user_id": diamond["user_id"], "currency": "BL", "amount": {"$gt": 0}, "created_at": {"$gte": thirty_days_ago}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        diamond["bl_earned_30d"] = bl_result[0]["total"] if bl_result else 0
        
        # Maintenance status
        if diamond.get("diamond_maintenance_due"):
            due_date = datetime.fromisoformat(diamond["diamond_maintenance_due"].replace("Z", "+00:00"))
            days_left = (due_date - datetime.now(timezone.utc)).days
            diamond["maintenance_status"] = "at_risk" if days_left < 7 else "on_track"
        else:
            diamond["maintenance_status"] = "unknown"
    
    return {"diamonds": diamonds}

@admin_diamonds_router.get("/candidates")
async def get_diamond_candidates(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get users who are close to diamond qualification"""
    # Find users with significant activity but not yet diamond
    candidates = await db.users.find(
        {
            "rank": {"$ne": "diamond_leader"},
            "$or": [
                {"direct_referrals": {"$gte": 50}},
                {"total_bl_earned": {"$gte": 3000000}}
            ]
        },
        {"user_id": 1, "username": 1, "email": 1, "direct_referrals": 1, 
         "total_bl_earned": 1, "_id": 0}
    ).limit(limit).to_list(limit)
    
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    for candidate in candidates:
        # Get progress
        comm_result = await db.commissions.aggregate([
            {"$match": {"recipient_id": candidate["user_id"], "created_at": {"$gte": thirty_days_ago}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}}
        ]).to_list(1)
        downline_commissions = comm_result[0]["total"] if comm_result else 0
        
        sales_result = await db.sales.aggregate([
            {"$match": {"seller_id": candidate["user_id"], "status": "completed", "created_at": {"$gte": thirty_days_ago}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}}
        ]).to_list(1)
        personal_sales = sales_result[0]["total"] if sales_result else 0
        
        candidate["progress"] = {
            "direct_recruits": {"current": candidate.get("direct_referrals", 0), "required": 100},
            "downline_commissions": {"current": downline_commissions, "required": 1000},
            "personal_sales": {"current": personal_sales, "required": 1000},
            "bl_coins_earned": {"current": candidate.get("total_bl_earned", 0), "required": 6000000}
        }
        
        candidate["qualified"] = (
            candidate["progress"]["direct_recruits"]["current"] >= 100 and
            candidate["progress"]["downline_commissions"]["current"] >= 1000 and
            candidate["progress"]["personal_sales"]["current"] >= 1000 and
            candidate["progress"]["bl_coins_earned"]["current"] >= 6000000
        )
    
    return {"candidates": candidates}

@admin_diamonds_router.get("/pending-demotions")
async def get_pending_demotions(current_user: dict = Depends(get_current_user)):
    """Get diamond leaders who haven't met maintenance requirements"""
    now = datetime.now(timezone.utc)
    
    # Find diamonds with overdue maintenance
    overdue_diamonds = await db.users.find(
        {
            "rank": "diamond_leader",
            "diamond_maintenance_due": {"$lt": now.isoformat()}
        },
        {"user_id": 1, "username": 1, "email": 1, "diamond_maintenance_due": 1, "_id": 0}
    ).to_list(100)
    
    return {"pending": overdue_diamonds}

@admin_diamonds_router.get("/stats")
async def get_diamond_stats(current_user: dict = Depends(get_current_user)):
    """Get diamond leader statistics"""
    now = datetime.now(timezone.utc)
    thirty_days_ago = (now - timedelta(days=30)).isoformat()
    
    total = await db.users.count_documents({"rank": "diamond_leader"})
    
    promoted = await db.users.count_documents({
        "rank": "diamond_leader",
        "diamond_achieved_at": {"$gte": thirty_days_ago}
    })
    
    demoted = await db.users.count_documents({
        "diamond_demoted_at": {"$gte": thirty_days_ago}
    })
    
    pending_bonuses = await db.pending_diamond_bonuses.aggregate([
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}}
    ]).to_list(1)
    
    return {
        "total_diamonds": total,
        "promoted_this_month": promoted,
        "demoted_this_month": demoted,
        "pending_bonuses": pending_bonuses[0]["total"] if pending_bonuses else 0
    }

@admin_diamonds_router.post("/promote")
async def promote_to_diamond(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Manually promote a user to Diamond Leader"""
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("rank") == "diamond_leader":
        raise HTTPException(status_code=400, detail="User is already a Diamond Leader")
    
    now = datetime.now(timezone.utc)
    
    # Update user
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "rank": "diamond_leader",
            "is_diamond": True,
            "diamond_achieved_at": now.isoformat(),
            "diamond_maintenance_due": (now + timedelta(days=30)).isoformat(),
            "promoted_by": current_user["user_id"]
        }}
    )
    
    # Award BL coins bonus
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"bl_coins": 10000000}}
    )
    
    # Record transaction
    await db.transactions.insert_one({
        "transaction_id": f"txn_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "type": "diamond_bonus_bl",
        "currency": "BL",
        "amount": 10000000,
        "description": "Diamond Leader Promotion Bonus",
        "created_at": now.isoformat()
    })
    
    # Record pending USD bonus
    await db.pending_diamond_bonuses.insert_one({
        "bonus_id": f"diamond_bonus_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "amount_usd": 100.0,
        "status": "pending",
        "approved_by": current_user["user_id"],
        "created_at": now.isoformat()
    })
    
    return {"success": True, "message": "User promoted to Diamond Leader"}

@admin_diamonds_router.post("/demote")
async def demote_diamond(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Demote a Diamond Leader back to regular status"""
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("rank") != "diamond_leader":
        raise HTTPException(status_code=400, detail="User is not a Diamond Leader")
    
    now = datetime.now(timezone.utc)
    
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$set": {
                "rank": "regular",
                "is_diamond": False,
                "diamond_demoted_at": now.isoformat(),
                "demoted_by": current_user["user_id"]
            },
            "$unset": {"diamond_maintenance_due": ""}
        }
    )
    
    return {"success": True, "message": "User demoted from Diamond Leader"}

@admin_diamonds_router.post("/extend-maintenance")
async def extend_maintenance(
    user_id: str,
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Extend a Diamond Leader's maintenance period"""
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("rank") != "diamond_leader":
        raise HTTPException(status_code=400, detail="User is not a Diamond Leader")
    
    current_due = user.get("diamond_maintenance_due")
    if current_due:
        due_date = datetime.fromisoformat(current_due.replace("Z", "+00:00"))
    else:
        due_date = datetime.now(timezone.utc)
    
    new_due = due_date + timedelta(days=days)
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"diamond_maintenance_due": new_due.isoformat()}}
    )
    
    return {
        "success": True, 
        "message": f"Maintenance extended by {days} days",
        "new_due_date": new_due.isoformat()
    }
