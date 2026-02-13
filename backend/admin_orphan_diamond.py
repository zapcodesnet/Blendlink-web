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
         "last_activity": 1, "bl_coins": 1, "orphan_assigned_at": 1, "orphan_assignment_type": 1,
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
        
        # Add login frequency - use last_activity OR last_login_at
        login_time = orphan.get("last_activity") or orphan.get("last_login_at")
        orphan["login_frequency"] = get_login_frequency(login_time).value
        orphan["last_login_at"] = login_time  # Normalize the field
    
    # Get total count
    total_count = await db.users.count_documents(query)
    
    return {
        "orphans": orphans,
        "total": total_count,
        "skip": skip,
        "limit": limit
    }

@admin_orphans_router.get("/trends")
async def get_orphan_trends(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    granularity: str = "day",  # 'day', 'week', 'month'
    current_user: dict = Depends(get_current_user)
):
    """
    Get comprehensive orphan assignment trends for dashboard analytics.
    Includes: daily assignments, success rates, pool utilization, and predictions.
    """
    now = datetime.now(timezone.utc)
    
    # Default to last 30 days if no dates provided
    if not end_date:
        end_dt = now
    else:
        try:
            end_dt = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        except:
            end_dt = now
    
    if not start_date:
        start_dt = end_dt - timedelta(days=30)
    else:
        try:
            start_dt = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        except:
            start_dt = end_dt - timedelta(days=30)
    
    start_iso = start_dt.isoformat()
    end_iso = end_dt.isoformat()
    
    # Get all assignments in date range
    assignments = await db.orphan_assignments.find({
        "created_at": {"$gte": start_iso, "$lte": end_iso}
    }).sort("created_at", 1).to_list(10000)
    
    # Aggregate by day/week/month
    date_buckets = {}
    for assignment in assignments:
        created = assignment.get("created_at", "")
        if not created:
            continue
        try:
            dt = datetime.fromisoformat(created.replace('Z', '+00:00'))
            if granularity == "day":
                bucket_key = dt.strftime("%Y-%m-%d")
            elif granularity == "week":
                # Get the Monday of the week
                monday = dt - timedelta(days=dt.weekday())
                bucket_key = monday.strftime("%Y-%m-%d")
            else:  # month
                bucket_key = dt.strftime("%Y-%m")
            
            if bucket_key not in date_buckets:
                date_buckets[bucket_key] = {
                    "date": bucket_key,
                    "total": 0,
                    "auto": 0,
                    "manual": 0,
                    "registration": 0,
                    "successful": 0,
                    "failed": 0,
                    "tiers": {str(i): 0 for i in range(1, 12)}
                }
            
            date_buckets[bucket_key]["total"] += 1
            
            atype = assignment.get("assignment_type", "auto")
            if atype == "auto":
                date_buckets[bucket_key]["auto"] += 1
            elif atype == "manual":
                date_buckets[bucket_key]["manual"] += 1
            else:
                date_buckets[bucket_key]["registration"] += 1
            
            # Track success (has assigned_to)
            if assignment.get("assigned_to"):
                date_buckets[bucket_key]["successful"] += 1
            else:
                date_buckets[bucket_key]["failed"] += 1
            
            # Track tier distribution
            tier = str(assignment.get("tier", 0))
            if tier in date_buckets[bucket_key]["tiers"]:
                date_buckets[bucket_key]["tiers"][tier] += 1
                
        except Exception as e:
            logger.warning(f"Error parsing assignment date: {e}")
            continue
    
    # Fill in missing dates for continuous chart
    timeline = []
    current = start_dt
    while current <= end_dt:
        if granularity == "day":
            bucket_key = current.strftime("%Y-%m-%d")
            current += timedelta(days=1)
        elif granularity == "week":
            monday = current - timedelta(days=current.weekday())
            bucket_key = monday.strftime("%Y-%m-%d")
            current += timedelta(days=7)
        else:
            bucket_key = current.strftime("%Y-%m")
            # Move to next month
            if current.month == 12:
                current = current.replace(year=current.year + 1, month=1)
            else:
                current = current.replace(month=current.month + 1)
        
        if bucket_key in date_buckets:
            timeline.append(date_buckets[bucket_key])
        else:
            timeline.append({
                "date": bucket_key,
                "total": 0,
                "auto": 0,
                "manual": 0,
                "registration": 0,
                "successful": 0,
                "failed": 0,
                "tiers": {str(i): 0 for i in range(1, 12)}
            })
    
    # Remove duplicates (for week/month granularity)
    seen = set()
    unique_timeline = []
    for item in timeline:
        if item["date"] not in seen:
            seen.add(item["date"])
            unique_timeline.append(item)
    
    # Calculate summary statistics
    total_in_range = sum(d["total"] for d in unique_timeline)
    total_auto = sum(d["auto"] for d in unique_timeline)
    total_manual = sum(d["manual"] for d in unique_timeline)
    total_registration = sum(d["registration"] for d in unique_timeline)
    total_successful = sum(d["successful"] for d in unique_timeline)
    total_failed = sum(d["failed"] for d in unique_timeline)
    
    success_rate = (total_successful / total_in_range * 100) if total_in_range > 0 else 0
    
    # Calculate average daily rate
    days_in_range = max((end_dt - start_dt).days, 1)
    avg_daily_rate = total_in_range / days_in_range
    
    # Get current pool status
    six_months_ago = (now - timedelta(days=INACTIVITY_THRESHOLD_DAYS)).isoformat()
    
    current_unassigned = await db.users.count_documents({
        "$or": [{"referred_by": None}, {"referred_by": {"$exists": False}}],
        "is_orphan_assigned": {"$ne": True}
    })
    
    current_eligible = await db.users.count_documents({
        "$and": [
            {"$or": [
                {"orphans_assigned_count": {"$lt": MAX_ORPHANS_PER_USER}},
                {"orphans_assigned_count": {"$exists": False}}
            ]},
            {"$or": [
                {"last_activity": {"$gte": six_months_ago}},
                {"last_login_at": {"$gte": six_months_ago}}
            ]},
            {"$or": [
                {"direct_referrals": 0},
                {"direct_referrals": 1},
                {"direct_referrals": None},
                {"direct_referrals": {"$exists": False}}
            ]}
        ]
    })
    
    # Calculate tier distribution across all time
    tier_totals = {str(i): 0 for i in range(1, 12)}
    for bucket in unique_timeline:
        for tier, count in bucket["tiers"].items():
            tier_totals[tier] += count
    
    # Predict days until pool exhaustion (based on recent rate)
    recent_7_days = sum(d["total"] for d in unique_timeline[-7:]) if len(unique_timeline) >= 7 else total_in_range
    recent_daily_rate = recent_7_days / 7 if len(unique_timeline) >= 7 else avg_daily_rate
    days_until_exhaustion = int(current_eligible / recent_daily_rate) if recent_daily_rate > 0 else 999
    
    # Calculate week-over-week change
    if len(unique_timeline) >= 14:
        this_week = sum(d["total"] for d in unique_timeline[-7:])
        last_week = sum(d["total"] for d in unique_timeline[-14:-7])
        wow_change = ((this_week - last_week) / last_week * 100) if last_week > 0 else 0
    else:
        wow_change = 0
    
    return {
        "timeline": unique_timeline,
        "summary": {
            "total_assignments": total_in_range,
            "total_auto": total_auto,
            "total_manual": total_manual,
            "total_registration": total_registration,
            "success_rate": round(success_rate, 1),
            "avg_daily_rate": round(avg_daily_rate, 2),
            "recent_daily_rate": round(recent_daily_rate, 2),
            "week_over_week_change": round(wow_change, 1)
        },
        "pool_status": {
            "current_unassigned": current_unassigned,
            "current_eligible": current_eligible,
            "days_until_exhaustion": days_until_exhaustion,
            "pool_health": "healthy" if current_eligible >= current_unassigned else "needs_attention"
        },
        "tier_distribution": tier_totals,
        "date_range": {
            "start": start_iso,
            "end": end_iso,
            "granularity": granularity,
            "days": days_in_range
        }
    }


@admin_orphans_router.get("/stats")
async def get_orphan_stats(current_user: dict = Depends(get_current_user)):
    """Get comprehensive orphan statistics"""
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = (now - timedelta(days=7))
    six_months_ago = (now - timedelta(days=INACTIVITY_THRESHOLD_DAYS)).isoformat()
    
    total = await db.users.count_documents({"$or": [
        {"referred_by": None},
        {"referred_by": {"$exists": False}},
        {"is_orphan": True}
    ]})
    
    unassigned = await db.users.count_documents({
        "$or": [{"referred_by": None}, {"referred_by": {"$exists": False}}],
        "is_orphan_assigned": {"$ne": True}
    })
    
    assigned_today = await db.orphan_assignments.count_documents({
        "created_at": {"$gte": today.isoformat()}
    })
    
    assigned_week = await db.orphan_assignments.count_documents({
        "created_at": {"$gte": week_ago.isoformat()}
    })
    
    # Count eligible parents - use $or for last_activity OR last_login_at
    eligible_parents = await db.users.count_documents({
        "$and": [
            {"$or": [
                {"orphans_assigned_count": {"$lt": MAX_ORPHANS_PER_USER}},
                {"orphans_assigned_count": {"$exists": False}}
            ]},
            {"$or": [
                {"last_activity": {"$gte": six_months_ago}},
                {"last_login_at": {"$gte": six_months_ago}}
            ]},
            {"$or": [
                {"direct_referrals": 0},
                {"direct_referrals": 1},
                {"direct_referrals": None},
                {"direct_referrals": {"$exists": False}}
            ]}
        ]
    })
    
    # Count parents at capacity
    at_capacity = await db.users.count_documents({
        "orphans_assigned_count": {"$gte": MAX_ORPHANS_PER_USER}
    })
    
    # Auto vs manual assignment breakdown
    auto_assignments = await db.orphan_assignments.count_documents({
        "assignment_type": "auto"
    })
    manual_assignments = await db.orphan_assignments.count_documents({
        "assignment_type": "manual"
    })
    
    return {
        "total_orphans": total,
        "unassigned": unassigned,
        "assigned": total - unassigned,
        "assigned_today": assigned_today,
        "assigned_this_week": assigned_week,
        "eligible_parents": eligible_parents,
        "parents_at_capacity": at_capacity,
        "max_orphans_per_user": MAX_ORPHANS_PER_USER,
        "assignment_breakdown": {
            "auto": auto_assignments,
            "manual": manual_assignments
        },
        "tier_descriptions": {i: get_tier_description(i) for i in range(1, 12)}
    }

@admin_orphans_router.get("/potential-parents")
async def get_potential_parents(
    limit: int = 50,
    tier: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of potential parents for orphan assignment, sorted by 11-tier priority.
    Shows detailed eligibility info for each user.
    """
    now = datetime.now(timezone.utc)
    six_months_ago = (now - timedelta(days=INACTIVITY_THRESHOLD_DAYS)).isoformat()
    
    # Base query for eligible users - fixed MongoDB query with $and for multiple $or conditions
    # NOTE: Using "last_activity" field (the actual field in DB) instead of "last_login_at"
    base_query = {
        "$and": [
            # Must have capacity for orphans
            {"$or": [
                {"orphans_assigned_count": {"$lt": MAX_ORPHANS_PER_USER}},
                {"orphans_assigned_count": {"$exists": False}},
                {"orphans_assigned_count": None}
            ]},
            # Must have logged in within 6 months - use last_activity field
            {"$or": [
                {"last_activity": {"$gte": six_months_ago}},
                {"last_login_at": {"$gte": six_months_ago}}
            ]},
            # Must have 0 or 1 direct referrals
            {"$or": [
                {"direct_referrals": 0},
                {"direct_referrals": 1},
                {"direct_referrals": None},
                {"direct_referrals": {"$exists": False}}
            ]}
        ]
    }
    
    # Get candidates - include both last_activity and last_login_at for compatibility
    candidates_cursor = db.users.find(
        base_query,
        {"user_id": 1, "username": 1, "email": 1, "id_verified": 1,
         "direct_referrals": 1, "orphans_assigned_count": 1, "last_login_at": 1,
         "last_activity": 1, "created_at": 1, "_id": 0}
    ).sort("created_at", 1).limit(limit * 3)
    
    parents = []
    async for user in candidates_cursor:
        # Calculate login frequency and tier - use last_activity OR last_login_at (whichever is set)
        login_time = user.get("last_activity") or user.get("last_login_at")
        login_freq = get_login_frequency(login_time)
        
        # Skip inactive users
        if login_freq == LoginFrequency.INACTIVE:
            continue
        
        direct_recruits = user.get("direct_referrals") or 0
        is_verified = user.get("id_verified", False)
        user_tier = calculate_user_tier(direct_recruits, is_verified, login_freq)
        
        # Filter by tier if specified
        if tier and user_tier != tier:
            continue
        
        # Skip ineligible tiers
        if user_tier > 11:
            continue
        
        orphans_assigned = user.get("orphans_assigned_count") or 0
        
        parents.append({
            "user_id": user["user_id"],
            "username": user.get("username", "Unknown"),
            "email": user.get("email"),
            "tier": user_tier,
            "tier_description": get_tier_description(user_tier),
            "direct_recruits": direct_recruits,
            "orphans_assigned": orphans_assigned,
            "remaining_capacity": MAX_ORPHANS_PER_USER - orphans_assigned,
            "id_verified": is_verified,
            "login_frequency": login_freq.value,
            "last_login_at": login_time,  # Use the resolved login time (last_activity or last_login_at)
            "created_at": user.get("created_at"),
            "priority_score": calculate_priority_score(user_tier, user.get("created_at"))
        })
        
        if len(parents) >= limit:
            break
    
    # Sort by tier (ascending) then created_at (oldest first)
    parents.sort(key=lambda x: (x["tier"], x["created_at"] or ""))
    
    return {
        "parents": parents,
        "total": len(parents),
        "max_orphans_per_user": MAX_ORPHANS_PER_USER,
        "tier_descriptions": {i: get_tier_description(i) for i in range(1, 12)}
    }

@admin_orphans_router.post("/assign")
async def manual_assign_orphan(
    orphan_id: str,
    parent_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Manually assign an orphan to a specific parent.
    Validates:
    - Orphan exists and is unassigned
    - Parent exists, has capacity, and is active within 6 months
    """
    # Verify orphan exists
    orphan = await db.users.find_one({"user_id": orphan_id})
    if not orphan:
        raise HTTPException(status_code=404, detail="Orphan not found")
    
    if orphan.get("is_orphan_assigned") and orphan.get("referred_by"):
        raise HTTPException(status_code=400, detail="Orphan is already assigned")
    
    # Verify parent exists and has capacity
    parent = await db.users.find_one({"user_id": parent_id})
    if not parent:
        raise HTTPException(status_code=404, detail="Parent not found")
    
    # Check capacity
    if parent.get("orphans_assigned_count", 0) >= MAX_ORPHANS_PER_USER:
        raise HTTPException(
            status_code=400, 
            detail=f"Parent has reached orphan limit ({MAX_ORPHANS_PER_USER})"
        )
    
    # Check inactivity
    six_months_ago = (datetime.now(timezone.utc) - timedelta(days=INACTIVITY_THRESHOLD_DAYS)).isoformat()
    if parent.get("last_login_at") and parent["last_login_at"] < six_months_ago:
        raise HTTPException(
            status_code=400,
            detail="Cannot assign orphan to user inactive for more than 6 months"
        )
    
    # Perform assignment using the enhanced system
    result = await assign_orphan_to_recipient(
        orphan_user_id=orphan_id,
        recipient_id=parent_id,
        assignment_type=AssignmentType.MANUAL,
        assigned_by=current_user["user_id"],
        tier=None
    )
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    
    return {
        "success": True,
        "message": "Orphan assigned successfully",
        "orphan_id": orphan_id,
        "assigned_to": parent_id,
        "assigned_to_username": result.assigned_to_username,
        "assigned_by": current_user["user_id"]
    }

@admin_orphans_router.post("/auto-assign")
async def auto_assign_orphan(
    orphan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Auto-assign a single orphan using the 11-tier priority system"""
    orphan = await db.users.find_one({"user_id": orphan_id})
    if not orphan:
        raise HTTPException(status_code=404, detail="Orphan not found")
    
    if orphan.get("is_orphan_assigned") and orphan.get("referred_by"):
        raise HTTPException(status_code=400, detail="Orphan is already assigned")
    
    # Use enhanced auto-assignment
    result = await auto_assign_single_orphan(orphan_id)
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    
    return {
        "success": True,
        "message": f"Orphan auto-assigned to Tier {result.tier}",
        "orphan_id": orphan_id,
        "assigned_to": result.assigned_to,
        "assigned_to_username": result.assigned_to_username,
        "tier": result.tier,
        "tier_description": get_tier_description(result.tier) if result.tier else None
    }

@admin_orphans_router.post("/batch-assign")
async def batch_assign_orphans(
    limit: int = 100,
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Re-run auto-assignment for all unassigned orphans.
    Processes one orphan at a time with round-robin distribution within tiers.
    """
    results = await batch_auto_assign_orphans(limit=limit)
    
    # Log batch operation
    await db.orphan_batch_operations.insert_one({
        "operation_id": f"batch_{uuid.uuid4().hex[:12]}",
        "initiated_by": current_user["user_id"],
        "initiated_by_username": current_user.get("username"),
        "total_processed": results["total_processed"],
        "successful": results["successful"],
        "failed": results["failed"],
        "no_eligible": results["no_eligible_recipients"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "success": True,
        "message": f"Batch assignment complete: {results['successful']}/{results['total_processed']} successful",
        **results
    }

@admin_orphans_router.get("/assignment-log")
async def get_assignment_log(
    skip: int = 0,
    limit: int = 50,
    assignment_type: Optional[str] = None,
    orphan_id: Optional[str] = None,
    assigned_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get orphan assignment audit log with filtering"""
    query = {}
    
    if assignment_type:
        query["assignment_type"] = assignment_type
    if orphan_id:
        query["orphan_user_id"] = orphan_id
    if assigned_to:
        query["assigned_to"] = assigned_to
    
    logs = await db.orphan_assignments.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.orphan_assignments.count_documents(query)
    
    return {
        "logs": logs,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@admin_orphans_router.get("/user/{user_id}")
async def get_user_orphan_details(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get detailed orphan-related information for a specific user"""
    user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "password": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get orphans assigned to this user
    assigned_orphans = await db.users.find(
        {"referred_by": user_id, "is_orphan": True},
        {"user_id": 1, "username": 1, "orphan_assigned_at": 1, "_id": 0}
    ).to_list(MAX_ORPHANS_PER_USER)
    
    # Get assignment history for this user (as recipient)
    assignment_history = await db.orphan_assignments.find(
        {"assigned_to": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Calculate eligibility
    login_freq = get_login_frequency(user.get("last_login_at"))
    direct_recruits = user.get("direct_referrals") or 0
    orphans_assigned = user.get("orphans_assigned_count") or 0
    is_verified = user.get("id_verified", False)
    
    is_eligible = (
        login_freq != LoginFrequency.INACTIVE and
        direct_recruits <= 1 and
        orphans_assigned < MAX_ORPHANS_PER_USER
    )
    
    tier = calculate_user_tier(direct_recruits, is_verified, login_freq) if is_eligible else None
    
    return {
        "user_id": user_id,
        "username": user.get("username"),
        "email": user.get("email"),
        "is_orphan": user.get("is_orphan", False),
        "is_orphan_assigned": user.get("is_orphan_assigned", False),
        "assigned_upline": user.get("referred_by"),
        "orphan_assigned_at": user.get("orphan_assigned_at"),
        "orphans_assigned_count": orphans_assigned,
        "orphans_capacity_remaining": MAX_ORPHANS_PER_USER - orphans_assigned,
        "assigned_orphans": assigned_orphans,
        "assignment_history": assignment_history,
        "eligibility": {
            "is_eligible_to_receive": is_eligible,
            "tier": tier,
            "tier_description": get_tier_description(tier) if tier else "Not eligible",
            "login_frequency": login_freq.value,
            "direct_recruits": direct_recruits,
            "id_verified": is_verified,
            "last_login_at": user.get("last_login_at"),
            "created_at": user.get("created_at")
        }
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
