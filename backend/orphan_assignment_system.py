"""
BlendLink Enhanced Orphan Assignment System
============================================
Implements the 11-tier priority orphan assignment system with:
- Round-robin distribution within tiers
- Max 2 orphans per user (permanent cap)
- Activity-based eligibility
- Admin manual override
- Audit trail logging
- Batch auto-assignment

Priority Rules (descending order):
1. ID-verified + 0 recruits + daily login (oldest first)
2. Non-ID-verified + 0 recruits + daily login
3. 0 recruits + weekly login
4. 0 recruits + monthly login  
5. 0 recruits + quarterly login (3 months)
6. ID-verified + 1 recruit + daily login (oldest first)
7. Non-ID-verified + 1 recruit + daily login
8. 1 recruit + weekly login
9. 1 recruit + monthly login
10. 1 recruit + quarterly login (3 months)
11. 1 recruit + biannual login (6 months)

Exclusions:
- Users inactive >6 months are NEVER eligible
- Users with 2+ direct recruits are excluded
- Max 2 orphans per user (permanent, tracked separately)
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import logging
import asyncio

from server import db, get_current_user

logger = logging.getLogger(__name__)

# Constants
MAX_ORPHANS_PER_USER = 2
INACTIVITY_THRESHOLD_DAYS = 180  # 6 months

# Router
orphan_router = APIRouter(prefix="/orphan-system", tags=["Orphan Assignment"])

# ============== ENUMS & MODELS ==============

class LoginFrequency(str, Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    BIANNUAL = "biannual"
    INACTIVE = "inactive"

class AssignmentType(str, Enum):
    AUTO = "auto"
    MANUAL = "manual"
    BATCH = "batch"

class OrphanStatus(str, Enum):
    UNASSIGNED = "unassigned"
    ASSIGNED = "assigned"

class EligibleParent(BaseModel):
    user_id: str
    username: str
    email: Optional[str] = None
    tier: int
    tier_description: str
    direct_recruits: int
    orphans_assigned: int
    remaining_capacity: int
    id_verified: bool
    login_frequency: str
    last_login_at: Optional[str] = None
    created_at: str
    priority_score: float

class OrphanUser(BaseModel):
    user_id: str
    username: str
    email: Optional[str] = None
    created_at: str
    last_login_at: Optional[str] = None
    bl_coins: int = 0
    is_assigned: bool = False
    assigned_to: Optional[str] = None
    assigned_to_username: Optional[str] = None
    assigned_at: Optional[str] = None
    assignment_type: Optional[str] = None

class AssignmentResult(BaseModel):
    success: bool
    orphan_user_id: str
    assigned_to: Optional[str] = None
    assigned_to_username: Optional[str] = None
    tier: Optional[int] = None
    message: str

class OrphanAssignmentLog(BaseModel):
    assignment_id: str
    orphan_user_id: str
    orphan_username: str
    assigned_to: str
    assigned_to_username: str
    assignment_type: str  # auto, manual, batch
    assigned_by: Optional[str] = None  # For manual assignments
    tier: Optional[int] = None
    reason: str
    created_at: str

# ============== HELPER FUNCTIONS ==============

def get_login_frequency(last_login_str: Optional[str]) -> LoginFrequency:
    """Determine login frequency based on last login date"""
    if not last_login_str:
        return LoginFrequency.INACTIVE
    
    try:
        last_login = datetime.fromisoformat(last_login_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return LoginFrequency.INACTIVE
    
    now = datetime.now(timezone.utc)
    days_since = (now - last_login).days
    
    if days_since <= 1:
        return LoginFrequency.DAILY
    elif days_since <= 7:
        return LoginFrequency.WEEKLY
    elif days_since <= 30:
        return LoginFrequency.MONTHLY
    elif days_since <= 90:
        return LoginFrequency.QUARTERLY
    elif days_since <= 180:
        return LoginFrequency.BIANNUAL
    else:
        return LoginFrequency.INACTIVE

def get_tier_description(tier: int) -> str:
    """Get human-readable description for a priority tier"""
    descriptions = {
        1: "ID-verified + 0 recruits + daily login",
        2: "0 recruits + daily login (non-verified)",
        3: "0 recruits + weekly login",
        4: "0 recruits + monthly login",
        5: "0 recruits + quarterly login",
        6: "ID-verified + 1 recruit + daily login",
        7: "1 recruit + daily login (non-verified)",
        8: "1 recruit + weekly login",
        9: "1 recruit + monthly login",
        10: "1 recruit + quarterly login",
        11: "1 recruit + biannual login",
    }
    return descriptions.get(tier, f"Tier {tier}")

# ============== CORE ASSIGNMENT LOGIC ==============

async def get_time_thresholds() -> Dict[str, str]:
    """Get ISO timestamp thresholds for login frequency tiers"""
    now = datetime.now(timezone.utc)
    return {
        "daily": (now - timedelta(days=1)).isoformat(),
        "weekly": (now - timedelta(days=7)).isoformat(),
        "monthly": (now - timedelta(days=30)).isoformat(),
        "quarterly": (now - timedelta(days=90)).isoformat(),
        "biannual": (now - timedelta(days=180)).isoformat(),
    }

async def get_last_assigned_user() -> Optional[str]:
    """Get the user_id of the last person who received an orphan (for round-robin)"""
    last_assignment = await db.orphan_assignments.find_one(
        {},
        sort=[("created_at", -1)]
    )
    return last_assignment.get("assigned_to") if last_assignment else None

async def find_eligible_recipient(exclude_user_id: Optional[str] = None) -> Optional[Dict]:
    """
    Find the best eligible recipient for an orphan according to 11 priority tiers.
    Returns user dict with tier info or None if no eligible users.
    
    Implements round-robin within tiers by:
    1. Excluding the last assigned user if possible
    2. Sorting by created_at (oldest first)
    
    NOTE: Uses both 'last_activity' and 'last_login_at' fields for compatibility,
    as the DB may have either field populated.
    """
    thresholds = await get_time_thresholds()
    last_assigned = await get_last_assigned_user()
    
    # Helper to create login time condition that checks both fields
    def login_time_gte(threshold_key: str):
        """Returns $or condition for login time >= threshold"""
        return {"$or": [
            {"last_activity": {"$gte": thresholds[threshold_key]}},
            {"last_login_at": {"$gte": thresholds[threshold_key]}}
        ]}
    
    def login_time_range(min_key: str, max_key: str):
        """Returns condition for login time in range [min, max)"""
        return {"$or": [
            {"last_activity": {"$gte": thresholds[min_key], "$lt": thresholds[max_key]}},
            {"last_login_at": {"$gte": thresholds[min_key], "$lt": thresholds[max_key]}}
        ]}
    
    # Build 11 tier queries in priority order
    # Using $and to properly combine login time checks with other conditions
    tier_queries = [
        # Tier 1: ID-verified + 0 recruits + daily
        {"$and": [
            {"id_verified": True},
            {"direct_referrals": {"$in": [0, None]}},
            login_time_gte("daily")
        ]},
        # Tier 2: Non-ID-verified + 0 recruits + daily
        {"$and": [
            {"id_verified": {"$ne": True}},
            {"direct_referrals": {"$in": [0, None]}},
            login_time_gte("daily")
        ]},
        # Tier 3: 0 recruits + weekly (but not daily)
        {"$and": [
            {"direct_referrals": {"$in": [0, None]}},
            login_time_range("weekly", "daily")
        ]},
        # Tier 4: 0 recruits + monthly (but not weekly)
        {"$and": [
            {"direct_referrals": {"$in": [0, None]}},
            login_time_range("monthly", "weekly")
        ]},
        # Tier 5: 0 recruits + quarterly (but not monthly)
        {"$and": [
            {"direct_referrals": {"$in": [0, None]}},
            login_time_range("quarterly", "monthly")
        ]},
        # Tier 6: ID-verified + 1 recruit + daily
        {"$and": [
            {"id_verified": True},
            {"direct_referrals": 1},
            login_time_gte("daily")
        ]},
        # Tier 7: Non-ID-verified + 1 recruit + daily
        {"$and": [
            {"id_verified": {"$ne": True}},
            {"direct_referrals": 1},
            login_time_gte("daily")
        ]},
        # Tier 8: 1 recruit + weekly (but not daily)
        {"$and": [
            {"direct_referrals": 1},
            login_time_range("weekly", "daily")
        ]},
        # Tier 9: 1 recruit + monthly (but not weekly)
        {"$and": [
            {"direct_referrals": 1},
            login_time_range("monthly", "weekly")
        ]},
        # Tier 10: 1 recruit + quarterly (but not monthly)
        {"$and": [
            {"direct_referrals": 1},
            login_time_range("quarterly", "monthly")
        ]},
        # Tier 11: 1 recruit + biannual (but not quarterly)
        {"$and": [
            {"direct_referrals": 1},
            login_time_range("biannual", "quarterly")
        ]},
    ]
    
    for tier_idx, tier_query in enumerate(tier_queries, 1):
        # Build the complete query by combining tier-specific filters with common eligibility
        # Since tier_query already uses $and, we need to extend it
        base_conditions = tier_query.get("$and", [tier_query])
        
        # Add common eligibility filters
        base_conditions.append({
            "$or": [
                {"orphans_assigned_count": {"$lt": MAX_ORPHANS_PER_USER}},
                {"orphans_assigned_count": {"$exists": False}}
            ]
        })
        
        # Exclude specific user if provided
        if exclude_user_id:
            base_conditions.append({"user_id": {"$ne": exclude_user_id}})
        
        base_query = {"$and": base_conditions}
        
        # Try with round-robin (exclude last assigned)
        if last_assigned:
            rr_conditions = base_conditions.copy()
            rr_conditions.append({"user_id": {"$ne": last_assigned}})
            query_with_rr = {"$and": rr_conditions}
            
            candidate = await db.users.find_one(
                query_with_rr,
                {"user_id": 1, "username": 1, "email": 1, "id_verified": 1, 
                 "direct_referrals": 1, "orphans_assigned_count": 1, "last_login_at": 1,
                 "last_activity": 1, "created_at": 1, "_id": 0},
                sort=[("created_at", 1)]  # Oldest first
            )
            
            if candidate:
                candidate["tier"] = tier_idx
                logger.info(f"Found orphan recipient in Tier {tier_idx}: {candidate['user_id']} (round-robin)")
                return candidate
        
        # Fallback without round-robin
        candidate = await db.users.find_one(
            base_query,
            {"user_id": 1, "username": 1, "email": 1, "id_verified": 1,
             "direct_referrals": 1, "orphans_assigned_count": 1, "last_login_at": 1,
             "last_activity": 1, "created_at": 1, "_id": 0},
            sort=[("created_at", 1)]
        )
        
        if candidate:
            candidate["tier"] = tier_idx
            logger.info(f"Found orphan recipient in Tier {tier_idx}: {candidate['user_id']}")
            return candidate
    
    logger.warning("No eligible orphan recipient found in any tier")
    return None

async def assign_orphan_to_recipient(
    orphan_user_id: str,
    recipient_id: str,
    assignment_type: AssignmentType,
    assigned_by: Optional[str] = None,
    tier: Optional[int] = None
) -> AssignmentResult:
    """
    Assign an orphan to a recipient.
    
    IMPORTANT: Per requirements:
    - Assigned uplines do NOT receive BL coin bonuses for orphan assignments
    - The orphan still receives their 50,000 BL signup bonus (handled at registration)
    """
    # Verify orphan exists and is unassigned
    orphan = await db.users.find_one({"user_id": orphan_user_id})
    if not orphan:
        return AssignmentResult(
            success=False,
            orphan_user_id=orphan_user_id,
            message="Orphan user not found"
        )
    
    # Check if already assigned
    if orphan.get("is_orphan_assigned") and orphan.get("referred_by"):
        return AssignmentResult(
            success=False,
            orphan_user_id=orphan_user_id,
            message="Orphan is already assigned to an upline"
        )
    
    # Verify recipient exists and has capacity
    recipient = await db.users.find_one({"user_id": recipient_id})
    if not recipient:
        return AssignmentResult(
            success=False,
            orphan_user_id=orphan_user_id,
            message="Recipient user not found"
        )
    
    current_orphan_count = recipient.get("orphans_assigned_count", 0)
    if current_orphan_count >= MAX_ORPHANS_PER_USER:
        return AssignmentResult(
            success=False,
            orphan_user_id=orphan_user_id,
            message=f"Recipient has reached maximum orphan limit ({MAX_ORPHANS_PER_USER})"
        )
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update orphan user
    await db.users.update_one(
        {"user_id": orphan_user_id},
        {"$set": {
            "referred_by": recipient_id,
            "is_orphan": True,
            "is_orphan_assigned": True,
            "orphan_assigned_at": now,
            "orphan_assignment_type": assignment_type.value,
            "orphan_assigned_tier": tier,
        }}
    )
    
    # Update recipient counts
    # NOTE: NO bonus is given to recipient for orphan assignments
    await db.users.update_one(
        {"user_id": recipient_id},
        {"$inc": {
            "orphans_assigned_count": 1,
            "direct_referrals": 1,
        }}
    )
    
    # Create referral relationship (but no bonus)
    relationship = {
        "relationship_id": f"rel_{uuid.uuid4().hex[:12]}",
        "referrer_id": recipient_id,
        "referred_id": orphan_user_id,
        "level": 1,
        "is_orphan_assignment": True,
        "created_at": now,
        "last_activity": now,
        "is_active": True,
    }
    await db.referral_relationships.insert_one(relationship)
    
    # Record in audit log
    assignment_log = {
        "assignment_id": f"orphan_assign_{uuid.uuid4().hex[:12]}",
        "orphan_user_id": orphan_user_id,
        "orphan_username": orphan.get("username", "Unknown"),
        "assigned_to": recipient_id,
        "assigned_to_username": recipient.get("username", "Unknown"),
        "assignment_type": assignment_type.value,
        "assigned_by": assigned_by,
        "tier": tier,
        "reason": f"{'Auto' if assignment_type == AssignmentType.AUTO else 'Manual'} assignment via {get_tier_description(tier) if tier else 'N/A'}",
        "recipient_orphan_count_before": current_orphan_count,
        "recipient_orphan_count_after": current_orphan_count + 1,
        "created_at": now,
    }
    await db.orphan_assignments.insert_one(assignment_log)
    
    logger.info(f"Orphan {orphan_user_id} assigned to {recipient_id} via {assignment_type.value} (Tier {tier})")
    
    # Send email notifications (non-blocking)
    try:
        from orphan_scheduler import send_orphan_assignment_notification, send_parent_notification
        
        # Notify orphan
        if orphan.get("email"):
            asyncio.create_task(send_orphan_assignment_notification(
                orphan_email=orphan["email"],
                orphan_username=orphan.get("username", "User"),
                parent_username=recipient.get("username", "Unknown"),
                assignment_type=assignment_type.value,
                tier=tier
            ))
        
        # Notify parent
        if recipient.get("email"):
            asyncio.create_task(send_parent_notification(
                parent_email=recipient["email"],
                parent_username=recipient.get("username", "User"),
                orphan_username=orphan.get("username", "Unknown"),
                orphan_count=current_orphan_count + 1
            ))
    except ImportError:
        logger.debug("Orphan scheduler not available for notifications")
    except Exception as e:
        logger.warning(f"Failed to send assignment notifications: {e}")
    
    return AssignmentResult(
        success=True,
        orphan_user_id=orphan_user_id,
        assigned_to=recipient_id,
        assigned_to_username=recipient.get("username"),
        tier=tier,
        message="Orphan assigned successfully"
    )

async def auto_assign_single_orphan(orphan_user_id: str) -> AssignmentResult:
    """Auto-assign a single orphan to the best eligible recipient"""
    recipient = await find_eligible_recipient()
    
    if not recipient:
        return AssignmentResult(
            success=False,
            orphan_user_id=orphan_user_id,
            message="No eligible recipients available in any tier"
        )
    
    return await assign_orphan_to_recipient(
        orphan_user_id=orphan_user_id,
        recipient_id=recipient["user_id"],
        assignment_type=AssignmentType.AUTO,
        tier=recipient.get("tier")
    )

async def batch_auto_assign_orphans(limit: int = 100) -> Dict[str, Any]:
    """
    Batch process all unassigned orphans.
    Assigns one orphan at a time, alternating among eligible users.
    """
    # Get unassigned orphans
    unassigned_orphans = await db.users.find(
        {
            "$or": [
                {"referred_by": None},
                {"referred_by": {"$exists": False}},
            ],
            "is_orphan_assigned": {"$ne": True}
        },
        {"user_id": 1}
    ).sort("created_at", 1).limit(limit).to_list(limit)
    
    results = {
        "total_processed": 0,
        "successful": 0,
        "failed": 0,
        "no_eligible_recipients": 0,
        "assignments": [],
        "errors": []
    }
    
    for orphan in unassigned_orphans:
        result = await auto_assign_single_orphan(orphan["user_id"])
        results["total_processed"] += 1
        
        if result.success:
            results["successful"] += 1
            results["assignments"].append({
                "orphan_id": result.orphan_user_id,
                "assigned_to": result.assigned_to,
                "tier": result.tier
            })
        else:
            if "No eligible recipients" in result.message:
                results["no_eligible_recipients"] += 1
                # Stop processing if no more eligible recipients
                break
            else:
                results["failed"] += 1
                results["errors"].append({
                    "orphan_id": result.orphan_user_id,
                    "error": result.message
                })
    
    logger.info(f"Batch orphan assignment complete: {results['successful']}/{results['total_processed']} successful")
    return results

# ============== API ENDPOINTS ==============

@orphan_router.get("/queue")
async def get_orphan_queue(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,  # "unassigned", "assigned", or None for all
    current_user: dict = Depends(get_current_user)
):
    """Get the orphan queue with filtering options"""
    query = {
        "$or": [
            {"referred_by": None},
            {"referred_by": {"$exists": False}},
            {"is_orphan": True}
        ]
    }
    
    if status == "unassigned":
        query["is_orphan_assigned"] = {"$ne": True}
    elif status == "assigned":
        query["is_orphan_assigned"] = True
    
    orphans_cursor = db.users.find(
        query,
        {"user_id": 1, "username": 1, "email": 1, "created_at": 1,
         "last_login_at": 1, "last_activity": 1, "bl_coins": 1, "is_orphan_assigned": 1,
         "referred_by": 1, "orphan_assigned_at": 1, "orphan_assignment_type": 1,
         "orphan_assigned_tier": 1, "_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit)
    
    orphans = []
    async for orphan in orphans_cursor:
        # Resolve login time from either field
        login_time = orphan.get("last_activity") or orphan.get("last_login_at")
        
        orphan_data = OrphanUser(
            user_id=orphan["user_id"],
            username=orphan.get("username", "Unknown"),
            email=orphan.get("email"),
            created_at=orphan.get("created_at", ""),
            last_login_at=login_time,  # Use resolved login time
            bl_coins=orphan.get("bl_coins", 0),
            is_assigned=orphan.get("is_orphan_assigned", False),
            assigned_to=orphan.get("referred_by"),
            assigned_at=orphan.get("orphan_assigned_at"),
            assignment_type=orphan.get("orphan_assignment_type")
        )
        
        # Get assigned parent username if assigned
        if orphan_data.assigned_to:
            parent = await db.users.find_one(
                {"user_id": orphan_data.assigned_to},
                {"username": 1}
            )
            orphan_data.assigned_to_username = parent.get("username") if parent else "Unknown"
        
        orphans.append(orphan_data.model_dump())
    
    # Get counts
    total_orphans = await db.users.count_documents(query)
    unassigned_count = await db.users.count_documents({
        "$or": [{"referred_by": None}, {"referred_by": {"$exists": False}}],
        "is_orphan_assigned": {"$ne": True}
    })
    
    return {
        "orphans": orphans,
        "total": total_orphans,
        "unassigned": unassigned_count,
        "skip": skip,
        "limit": limit
    }

@orphan_router.get("/eligible-parents")
async def get_eligible_parents(
    limit: int = 50,
    tier: Optional[int] = None,  # Filter by specific tier
    current_user: dict = Depends(get_current_user)
):
    """
    Get list of all eligible parents sorted by priority tier.
    Includes stats for each potential parent.
    """
    thresholds = await get_time_thresholds()
    
    # Base eligibility query - use both last_activity and last_login_at
    base_query = {
        "$and": [
            {"$or": [
                {"orphans_assigned_count": {"$lt": MAX_ORPHANS_PER_USER}},
                {"orphans_assigned_count": {"$exists": False}}
            ]},
            {"$or": [
                {"last_activity": {"$gte": thresholds["biannual"]}},
                {"last_login_at": {"$gte": thresholds["biannual"]}}
            ]},
            {"$or": [
                {"direct_referrals": 0},
                {"direct_referrals": 1},
                {"direct_referrals": None},
                {"direct_referrals": {"$exists": False}}
            ]}
        ]
    }
    
    # Get all potentially eligible users
    users_cursor = db.users.find(
        base_query,
        {"user_id": 1, "username": 1, "email": 1, "id_verified": 1,
         "direct_referrals": 1, "orphans_assigned_count": 1, "last_login_at": 1,
         "last_activity": 1, "created_at": 1, "_id": 0}
    ).sort("created_at", 1).limit(limit * 2)  # Get more to allow filtering
    
    parents = []
    async for user in users_cursor:
        # Determine tier - use last_activity OR last_login_at
        login_time = user.get("last_activity") or user.get("last_login_at")
        login_freq = get_login_frequency(login_time)
        direct_recruits = user.get("direct_referrals") or 0
        is_verified = user.get("id_verified", False)
        
        # Skip inactive users
        if login_freq == LoginFrequency.INACTIVE:
            continue
        
        # Calculate tier
        user_tier = calculate_user_tier(direct_recruits, is_verified, login_freq)
        
        # Filter by tier if specified
        if tier and user_tier != tier:
            continue
        
        orphans_assigned = user.get("orphans_assigned_count") or 0
        
        parent_data = EligibleParent(
            user_id=user["user_id"],
            username=user.get("username", "Unknown"),
            email=user.get("email"),
            tier=user_tier,
            tier_description=get_tier_description(user_tier),
            direct_recruits=direct_recruits,
            orphans_assigned=orphans_assigned,
            remaining_capacity=MAX_ORPHANS_PER_USER - orphans_assigned,
            id_verified=is_verified,
            login_frequency=login_freq.value,
            last_login_at=login_time,  # Use resolved login time
            created_at=user.get("created_at", ""),
            priority_score=calculate_priority_score(user_tier, user.get("created_at"))
        )
        
        parents.append(parent_data.model_dump())
        
        if len(parents) >= limit:
            break
    
    # Sort by tier (ascending) then by created_at (oldest first)
    parents.sort(key=lambda x: (x["tier"], x["created_at"]))
    
    return {
        "parents": parents,
        "total": len(parents),
        "max_orphans_per_user": MAX_ORPHANS_PER_USER
    }

def calculate_user_tier(direct_recruits: int, is_verified: bool, login_freq: LoginFrequency) -> int:
    """Calculate which priority tier a user belongs to"""
    if direct_recruits == 0 or direct_recruits is None:
        if login_freq == LoginFrequency.DAILY:
            return 1 if is_verified else 2
        elif login_freq == LoginFrequency.WEEKLY:
            return 3
        elif login_freq == LoginFrequency.MONTHLY:
            return 4
        elif login_freq == LoginFrequency.QUARTERLY:
            return 5
    elif direct_recruits == 1:
        if login_freq == LoginFrequency.DAILY:
            return 6 if is_verified else 7
        elif login_freq == LoginFrequency.WEEKLY:
            return 8
        elif login_freq == LoginFrequency.MONTHLY:
            return 9
        elif login_freq == LoginFrequency.QUARTERLY:
            return 10
        elif login_freq == LoginFrequency.BIANNUAL:
            return 11
    
    return 99  # Not eligible

def calculate_priority_score(tier: int, created_at: Optional[str]) -> float:
    """Calculate a numeric priority score for sorting (lower is higher priority)"""
    # Base score from tier
    base_score = tier * 1000
    
    # Add age bonus (older accounts get lower scores = higher priority)
    if created_at:
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            days_old = (datetime.now(timezone.utc) - created).days
            age_bonus = max(0, 3650 - days_old)  # Up to 10 years bonus
        except (ValueError, AttributeError):
            age_bonus = 0
    else:
        age_bonus = 0
    
    return base_score + age_bonus

@orphan_router.get("/stats")
async def get_orphan_stats(current_user: dict = Depends(get_current_user)):
    """Get comprehensive orphan system statistics"""
    now = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    thresholds = await get_time_thresholds()
    
    # Total orphans (ever)
    total_orphans = await db.users.count_documents({
        "$or": [
            {"is_orphan": True},
            {"referred_by": None},
            {"referred_by": {"$exists": False}}
        ]
    })
    
    # Unassigned orphans
    unassigned = await db.users.count_documents({
        "$or": [{"referred_by": None}, {"referred_by": {"$exists": False}}],
        "is_orphan_assigned": {"$ne": True}
    })
    
    # Assigned orphans
    assigned = await db.users.count_documents({
        "is_orphan": True,
        "is_orphan_assigned": True
    })
    
    # Assigned today
    assigned_today = await db.orphan_assignments.count_documents({
        "created_at": {"$gte": today.isoformat()}
    })
    
    # Assigned this week
    week_ago = (now - timedelta(days=7)).isoformat()
    assigned_week = await db.orphan_assignments.count_documents({
        "created_at": {"$gte": week_ago}
    })
    
    # Eligible parents count per tier
    tier_counts = {}
    for tier_num in range(1, 12):
        # This is a simplified count - actual query would be more complex
        tier_counts[f"tier_{tier_num}"] = 0
    
    # Count eligible parents - use both last_activity and last_login_at
    eligible_parents = await db.users.count_documents({
        "$and": [
            {"$or": [
                {"orphans_assigned_count": {"$lt": MAX_ORPHANS_PER_USER}},
                {"orphans_assigned_count": {"$exists": False}}
            ]},
            {"$or": [
                {"last_activity": {"$gte": thresholds["biannual"]}},
                {"last_login_at": {"$gte": thresholds["biannual"]}}
            ]},
            {"$or": [
                {"direct_referrals": 0},
                {"direct_referrals": 1},
                {"direct_referrals": None},
                {"direct_referrals": {"$exists": False}}
            ]}
        ]
    })
    
    # Users at capacity
    at_capacity = await db.users.count_documents({
        "orphans_assigned_count": {"$gte": MAX_ORPHANS_PER_USER}
    })
    
    return {
        "total_orphans": total_orphans,
        "unassigned": unassigned,
        "assigned": assigned,
        "assigned_today": assigned_today,
        "assigned_this_week": assigned_week,
        "eligible_parents": eligible_parents,
        "parents_at_capacity": at_capacity,
        "max_orphans_per_user": MAX_ORPHANS_PER_USER,
        "tier_descriptions": {i: get_tier_description(i) for i in range(1, 12)}
    }

@orphan_router.post("/manual-assign")
async def manual_assign_orphan(
    orphan_user_id: str,
    recipient_user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Manually assign an orphan to a specific recipient.
    Admin override - still respects max orphan limit and inactivity exclusion.
    """
    # Verify recipient is eligible (not inactive >6 months)
    thresholds = await get_time_thresholds()
    recipient = await db.users.find_one({"user_id": recipient_user_id})
    
    if not recipient:
        raise HTTPException(status_code=404, detail="Recipient not found")
    
    # Check inactivity
    last_login = recipient.get("last_login_at")
    if last_login and last_login < thresholds["biannual"]:
        raise HTTPException(
            status_code=400,
            detail="Cannot assign orphan to user inactive for more than 6 months"
        )
    
    # Check capacity
    if recipient.get("orphans_assigned_count", 0) >= MAX_ORPHANS_PER_USER:
        raise HTTPException(
            status_code=400,
            detail=f"Recipient has reached maximum orphan limit ({MAX_ORPHANS_PER_USER})"
        )
    
    result = await assign_orphan_to_recipient(
        orphan_user_id=orphan_user_id,
        recipient_id=recipient_user_id,
        assignment_type=AssignmentType.MANUAL,
        assigned_by=current_user["user_id"],
        tier=None  # Manual assignments don't have a tier
    )
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    
    return result.model_dump()

@orphan_router.post("/auto-assign/{orphan_user_id}")
async def auto_assign_single(
    orphan_user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Auto-assign a single orphan to the best eligible recipient"""
    result = await auto_assign_single_orphan(orphan_user_id)
    
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    
    return result.model_dump()

@orphan_router.post("/batch-assign")
async def batch_assign_orphans(
    limit: int = 100,
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Batch auto-assign all unassigned orphans.
    Processes one orphan at a time with round-robin distribution.
    """
    results = await batch_auto_assign_orphans(limit=limit)
    
    # Log the batch operation
    await db.orphan_batch_operations.insert_one({
        "operation_id": f"batch_{uuid.uuid4().hex[:12]}",
        "initiated_by": current_user["user_id"],
        "total_processed": results["total_processed"],
        "successful": results["successful"],
        "failed": results["failed"],
        "no_eligible": results["no_eligible_recipients"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return results

@orphan_router.get("/assignment-log")
async def get_assignment_log(
    skip: int = 0,
    limit: int = 50,
    assignment_type: Optional[str] = None,  # "auto", "manual", "batch"
    current_user: dict = Depends(get_current_user)
):
    """Get the orphan assignment audit log"""
    query = {}
    if assignment_type:
        query["assignment_type"] = assignment_type
    
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

@orphan_router.get("/user/{user_id}/orphan-info")
async def get_user_orphan_info(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get orphan-related information for a specific user"""
    user = await db.users.find_one(
        {"user_id": user_id},
        {"user_id": 1, "username": 1, "is_orphan": 1, "is_orphan_assigned": 1,
         "referred_by": 1, "orphan_assigned_at": 1, "orphan_assignment_type": 1,
         "orphans_assigned_count": 1, "direct_referrals": 1, "last_login_at": 1,
         "id_verified": 1, "created_at": 1, "_id": 0}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get assigned orphans if any
    assigned_orphans = await db.users.find(
        {"referred_by": user_id, "is_orphan": True},
        {"user_id": 1, "username": 1, "orphan_assigned_at": 1, "_id": 0}
    ).to_list(MAX_ORPHANS_PER_USER)
    
    # Calculate eligibility
    login_freq = get_login_frequency(user.get("last_login_at"))
    direct_recruits = user.get("direct_referrals") or 0
    orphans_assigned = user.get("orphans_assigned_count") or 0
    
    is_eligible = (
        login_freq != LoginFrequency.INACTIVE and
        direct_recruits <= 1 and
        orphans_assigned < MAX_ORPHANS_PER_USER
    )
    
    tier = calculate_user_tier(
        direct_recruits,
        user.get("id_verified", False),
        login_freq
    ) if is_eligible else None
    
    return {
        "user_id": user_id,
        "username": user.get("username"),
        "is_orphan": user.get("is_orphan", False),
        "is_orphan_assigned": user.get("is_orphan_assigned", False),
        "assigned_upline": user.get("referred_by"),
        "orphan_assigned_at": user.get("orphan_assigned_at"),
        "orphan_assignment_type": user.get("orphan_assignment_type"),
        "orphans_assigned_count": orphans_assigned,
        "orphans_capacity_remaining": MAX_ORPHANS_PER_USER - orphans_assigned,
        "assigned_orphans": assigned_orphans,
        "eligibility": {
            "is_eligible": is_eligible,
            "tier": tier,
            "tier_description": get_tier_description(tier) if tier else "Not eligible",
            "login_frequency": login_freq.value,
            "direct_recruits": direct_recruits,
            "id_verified": user.get("id_verified", False),
        }
    }



# ============== SCHEDULER ENDPOINTS ==============

@orphan_router.get("/scheduler/status")
async def get_scheduler_status_endpoint(current_user: dict = Depends(get_current_user)):
    """Get the current status of the orphan assignment scheduler"""
    try:
        from orphan_scheduler import get_scheduler_status
        return get_scheduler_status()
    except ImportError:
        return {"running": False, "jobs": [], "error": "Scheduler module not loaded"}

@orphan_router.post("/scheduler/trigger/{job_type}")
async def trigger_scheduler_job(
    job_type: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Manually trigger a scheduler job.
    job_type: 'auto_assign' or 'cleanup'
    """
    if job_type not in ["auto_assign", "cleanup"]:
        raise HTTPException(status_code=400, detail="Invalid job type. Use 'auto_assign' or 'cleanup'")
    
    try:
        from orphan_scheduler import trigger_orphan_job_now
        result = await trigger_orphan_job_now(job_type)
        return result
    except ImportError:
        raise HTTPException(status_code=500, detail="Scheduler module not available")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@orphan_router.get("/scheduler/history")
async def get_scheduler_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get history of scheduled orphan assignment jobs"""
    history = await db.orphan_scheduled_jobs.find(
        {},
        {"_id": 0}
    ).sort("run_at", -1).limit(limit).to_list(limit)
    
    return {"history": history, "total": len(history)}
