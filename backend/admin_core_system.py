"""
Blendlink Production Admin System - Core Management Module
==========================================================
- Full User Management (search, suspend, ban, delete, password reset)
- Financial Oversight (BL coins, USD, transactions, adjustments)
- Genealogy Management (visual tree, drag-drop reassignment)
- Content Moderation (private content access)
- Role & Permission Management
- System Monitoring
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Query, Body
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid

# Import from server and auth system
from server import get_current_user, db, logger, hash_password
from admin_auth_system import (
    require_admin, check_admin_permission, log_admin_action,
    AdminAuditAction, AdminRole, AdminPermissions, broadcast_admin_event
)

# Create routers
admin_users_router = APIRouter(prefix="/admin/users", tags=["Admin User Management"])
admin_finance_router = APIRouter(prefix="/admin/finance", tags=["Admin Financial"])
admin_genealogy_router = APIRouter(prefix="/admin/genealogy", tags=["Admin Genealogy"])
admin_content_router = APIRouter(prefix="/admin/content", tags=["Admin Content Moderation"])
admin_roles_router = APIRouter(prefix="/admin/roles", tags=["Admin Role Management"])
admin_system_router = APIRouter(prefix="/admin/system", tags=["Admin System"])

# ============== MODELS ==============

class UserSearchFilters(BaseModel):
    query: Optional[str] = None  # Search by email, name, username
    status: Optional[str] = None  # active, suspended, banned
    role: Optional[str] = None  # user, admin
    rank: Optional[str] = None  # regular, diamond_leader
    kyc_status: Optional[str] = None
    has_referrals: Optional[bool] = None
    min_bl_coins: Optional[float] = None
    max_bl_coins: Optional[float] = None
    created_after: Optional[str] = None
    created_before: Optional[str] = None

class UserActionRequest(BaseModel):
    reason: str
    notify_user: bool = True
    duration_days: Optional[int] = None  # For temporary suspensions

class BalanceAdjustmentRequest(BaseModel):
    currency: str  # "bl_coins" or "usd"
    amount: float  # Positive for credit, negative for debit
    reason: str
    notify_user: bool = True

class GenealogyReassignRequest(BaseModel):
    user_id: str
    new_upline_id: str
    reason: str
    notify_users: bool = True

class CreateAdminRequest(BaseModel):
    user_id: str
    role: AdminRole = AdminRole.MODERATOR
    permissions: Optional[Dict[str, bool]] = None

class UpdateAdminRequest(BaseModel):
    role: Optional[AdminRole] = None
    permissions: Optional[Dict[str, bool]] = None
    is_active: Optional[bool] = None

# ============== USER MANAGEMENT ==============

@admin_users_router.get("/search")
async def search_users(
    request: Request,
    query: str = Query(None),
    status: str = Query(None),
    role: str = Query(None),
    rank: str = Query(None),
    kyc_status: str = Query(None),
    skip: int = 0,
    limit: int = 50,
    admin: Dict = Depends(require_admin)
):
    """Search and filter all real users"""
    if not await check_admin_permission(admin, "view_users"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Build query
    mongo_query = {}
    
    if query:
        mongo_query["$or"] = [
            {"email": {"$regex": query, "$options": "i"}},
            {"name": {"$regex": query, "$options": "i"}},
            {"username": {"$regex": query, "$options": "i"}},
            {"user_id": {"$regex": query, "$options": "i"}},
        ]
    
    if status:
        if status == "active":
            mongo_query["is_suspended"] = {"$ne": True}
            mongo_query["is_banned"] = {"$ne": True}
        elif status == "suspended":
            mongo_query["is_suspended"] = True
        elif status == "banned":
            mongo_query["is_banned"] = True
    
    if role:
        mongo_query["role"] = role
    
    if rank:
        mongo_query["rank"] = rank
    
    if kyc_status:
        mongo_query["kyc_status"] = kyc_status
    
    # Execute query
    users = await db.users.find(
        mongo_query,
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.users.count_documents(mongo_query)
    
    # Enrich with stats
    for user in users:
        user["referral_count"] = await db.users.count_documents({"referred_by": user["user_id"]})
        user["total_transactions"] = await db.transactions.count_documents({"user_id": user["user_id"]})
    
    return {
        "users": users,
        "total": total,
        "skip": skip,
        "limit": limit,
    }

@admin_users_router.get("/{user_id}")
async def get_user_details(
    request: Request,
    user_id: str,
    admin: Dict = Depends(require_admin)
):
    """Get detailed user profile including private data"""
    if not await check_admin_permission(admin, "view_users"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get additional data
    referral_count = await db.users.count_documents({"referred_by": user_id})
    l2_count = await db.referral_relationships.count_documents({"referrer_id": user_id, "level": 2})
    
    # Get recent transactions
    recent_transactions = await db.transactions.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Get withdrawal history
    withdrawals = await db.withdrawals.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Get commission earnings
    total_commissions = await db.commissions.aggregate([
        {"$match": {"recipient_id": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}}
    ]).to_list(1)
    
    # Log view action
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.USER_VIEW, "user", user_id,
        {"viewed_fields": ["profile", "transactions", "withdrawals"]},
        request
    )
    
    return {
        "user": user,
        "stats": {
            "referral_count": referral_count,
            "l2_referral_count": l2_count,
            "total_transactions": len(recent_transactions),
            "total_commissions": total_commissions[0]["total"] if total_commissions else 0,
        },
        "recent_transactions": recent_transactions,
        "withdrawals": withdrawals,
    }

@admin_users_router.post("/{user_id}/suspend")
async def suspend_user(
    request: Request,
    user_id: str,
    data: UserActionRequest,
    admin: Dict = Depends(require_admin)
):
    """Suspend a user account"""
    if not await check_admin_permission(admin, "suspend_users"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc)
    update_data = {
        "is_suspended": True,
        "suspended_at": now.isoformat(),
        "suspended_by": admin["admin_id"],
        "suspension_reason": data.reason,
    }
    
    if data.duration_days:
        update_data["suspension_expires"] = (now + timedelta(days=data.duration_days)).isoformat()
    
    await db.users.update_one({"user_id": user_id}, {"$set": update_data})
    
    # Log action
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.USER_SUSPEND, "user", user_id,
        {"reason": data.reason, "duration_days": data.duration_days},
        request
    )
    
    # Broadcast to all admins
    await broadcast_admin_event({
        "type": "user_action",
        "action": "suspended",
        "user_id": user_id,
        "admin": admin["email"],
        "timestamp": now.isoformat(),
    })
    
    return {"success": True, "message": f"User {user_id} suspended"}

@admin_users_router.post("/{user_id}/unsuspend")
async def unsuspend_user(
    request: Request,
    user_id: str,
    admin: Dict = Depends(require_admin)
):
    """Remove suspension from user"""
    if not await check_admin_permission(admin, "suspend_users"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_suspended": False,
            "suspended_at": None,
            "suspended_by": None,
            "suspension_reason": None,
            "suspension_expires": None,
        }}
    )
    
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.USER_UNSUSPEND, "user", user_id,
        {},
        request
    )
    
    await broadcast_admin_event({
        "type": "user_action",
        "action": "unsuspended",
        "user_id": user_id,
        "admin": admin["email"],
    })
    
    return {"success": True, "message": f"User {user_id} unsuspended"}

@admin_users_router.post("/{user_id}/ban")
async def ban_user(
    request: Request,
    user_id: str,
    data: UserActionRequest,
    admin: Dict = Depends(require_admin)
):
    """Permanently ban a user"""
    if not await check_admin_permission(admin, "ban_users"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_banned": True,
            "banned_at": now.isoformat(),
            "banned_by": admin["admin_id"],
            "ban_reason": data.reason,
        }}
    )
    
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.USER_BAN, "user", user_id,
        {"reason": data.reason},
        request
    )
    
    await broadcast_admin_event({
        "type": "user_action",
        "action": "banned",
        "user_id": user_id,
        "admin": admin["email"],
    })
    
    return {"success": True, "message": f"User {user_id} banned"}

@admin_users_router.post("/{user_id}/unban")
async def unban_user(
    request: Request,
    user_id: str,
    admin: Dict = Depends(require_admin)
):
    """Remove ban from user"""
    if not await check_admin_permission(admin, "ban_users"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_banned": False,
            "banned_at": None,
            "banned_by": None,
            "ban_reason": None,
        }}
    )
    
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.USER_UNBAN, "user", user_id,
        {},
        request
    )
    
    return {"success": True, "message": f"User {user_id} unbanned"}

@admin_users_router.delete("/{user_id}")
async def delete_user(
    request: Request,
    user_id: str,
    data: UserActionRequest,
    admin: Dict = Depends(require_admin)
):
    """Permanently delete a user (DANGEROUS)"""
    if not await check_admin_permission(admin, "delete_users"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Soft delete - mark as deleted but keep data
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "is_deleted": True,
            "deleted_at": now.isoformat(),
            "deleted_by": admin["admin_id"],
            "deletion_reason": data.reason,
            "email": f"deleted_{user_id}@deleted.local",  # Anonymize email
        }}
    )
    
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.USER_DELETE, "user", user_id,
        {"reason": data.reason},
        request
    )
    
    return {"success": True, "message": f"User {user_id} deleted"}

@admin_users_router.post("/{user_id}/reset-password")
async def admin_reset_user_password(
    request: Request,
    user_id: str,
    new_password: str = Body(..., embed=True),
    admin: Dict = Depends(require_admin)
):
    """Reset user's password"""
    if not await check_admin_permission(admin, "reset_user_passwords"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    hashed = hash_password(new_password)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"password_hash": hashed, "password_reset_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.USER_PASSWORD_RESET, "user", user_id,
        {},
        request
    )
    
    return {"success": True, "message": "Password reset successfully"}

@admin_users_router.post("/{user_id}/force-logout")
async def force_logout_user(
    request: Request,
    user_id: str,
    admin: Dict = Depends(require_admin)
):
    """Force logout user from all sessions"""
    if not await check_admin_permission(admin, "force_logout_users"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Invalidate all tokens by updating token_version
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"token_version": 1}}
    )
    
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.USER_FORCE_LOGOUT, "user", user_id,
        {},
        request
    )
    
    return {"success": True, "message": "User logged out from all sessions"}

# ============== FINANCIAL MANAGEMENT ==============

@admin_finance_router.get("/overview")
async def get_financial_overview(
    request: Request,
    admin: Dict = Depends(require_admin)
):
    """Get platform-wide financial overview"""
    if not await check_admin_permission(admin, "view_balances"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Total BL coins in circulation
    bl_coins_result = await db.users.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$bl_coins"}}}
    ]).to_list(1)
    total_bl_coins = bl_coins_result[0]["total"] if bl_coins_result else 0
    
    # Total USD balances
    usd_result = await db.users.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$usd_balance"}}}
    ]).to_list(1)
    total_usd = usd_result[0]["total"] if usd_result else 0
    
    # Pending withdrawals
    pending_withdrawals = await db.withdrawals.aggregate([
        {"$match": {"status": "pending"}},
        {"$group": {"_id": None, "count": {"$sum": 1}, "amount": {"$sum": "$amount_usd"}}}
    ]).to_list(1)
    
    # Total commissions paid
    commissions_result = await db.commissions.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}}
    ]).to_list(1)
    total_commissions = commissions_result[0]["total"] if commissions_result else 0
    
    # Platform fees collected
    fees_result = await db.platform_fees.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}}
    ]).to_list(1)
    total_fees = fees_result[0]["total"] if fees_result else 0
    
    return {
        "total_bl_coins": total_bl_coins,
        "total_usd_balances": total_usd,
        "pending_withdrawals": {
            "count": pending_withdrawals[0]["count"] if pending_withdrawals else 0,
            "amount": pending_withdrawals[0]["amount"] if pending_withdrawals else 0,
        },
        "total_commissions_paid": total_commissions,
        "total_platform_fees": total_fees,
    }

@admin_finance_router.get("/transactions")
async def get_all_transactions(
    request: Request,
    user_id: Optional[str] = None,
    transaction_type: Optional[str] = None,
    currency: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    admin: Dict = Depends(require_admin)
):
    """Get all transactions with filters"""
    if not await check_admin_permission(admin, "view_transactions"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    query = {}
    if user_id:
        query["user_id"] = user_id
    if transaction_type:
        query["transaction_type"] = transaction_type
    if currency:
        query["currency"] = currency
    
    transactions = await db.transactions.find(
        query, {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.transactions.count_documents(query)
    
    return {
        "transactions": transactions,
        "total": total,
        "skip": skip,
        "limit": limit,
    }

@admin_finance_router.post("/adjust-balance/{user_id}")
async def adjust_user_balance(
    request: Request,
    user_id: str,
    data: BalanceAdjustmentRequest,
    admin: Dict = Depends(require_admin)
):
    """Manually adjust user's balance with audit trail"""
    permission = "adjust_bl_coins" if data.currency == "bl_coins" else "adjust_usd_balance"
    if not await check_admin_permission(admin, permission):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get current balance
    field = "bl_coins" if data.currency == "bl_coins" else "usd_balance"
    current_balance = user.get(field, 0)
    new_balance = current_balance + data.amount
    
    if new_balance < 0:
        raise HTTPException(status_code=400, detail="Resulting balance cannot be negative")
    
    # Update balance
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {field: new_balance}}
    )
    
    # Record transaction
    transaction_id = f"txn_{uuid.uuid4().hex[:12]}"
    await db.transactions.insert_one({
        "transaction_id": transaction_id,
        "user_id": user_id,
        "transaction_type": "admin_adjustment",
        "currency": data.currency,
        "amount": data.amount,
        "balance_before": current_balance,
        "balance_after": new_balance,
        "reference_id": f"admin_{admin['admin_id']}",
        "details": {
            "reason": data.reason,
            "adjusted_by": admin["email"],
        },
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Log action
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.BALANCE_ADJUST, "user", user_id,
        {
            "currency": data.currency,
            "amount": data.amount,
            "balance_before": current_balance,
            "balance_after": new_balance,
            "reason": data.reason,
        },
        request
    )
    
    # Broadcast update
    await broadcast_admin_event({
        "type": "balance_adjusted",
        "user_id": user_id,
        "currency": data.currency,
        "amount": data.amount,
        "admin": admin["email"],
    })
    
    return {
        "success": True,
        "transaction_id": transaction_id,
        "balance_before": current_balance,
        "balance_after": new_balance,
    }

# ============== GENEALOGY MANAGEMENT ==============

@admin_genealogy_router.get("/tree")
async def get_full_genealogy_tree(
    request: Request,
    root_user_id: Optional[str] = None,
    max_depth: int = 5,
    admin: Dict = Depends(require_admin)
):
    """Get full genealogy tree with profile pictures, names, usernames"""
    if not await check_admin_permission(admin, "view_genealogy"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    async def build_tree(user_id: str, depth: int = 0) -> Dict:
        if depth >= max_depth:
            return None
        
        user = await db.users.find_one(
            {"user_id": user_id},
            {"_id": 0, "user_id": 1, "name": 1, "username": 1, "avatar": 1, 
             "email": 1, "rank": 1, "bl_coins": 1, "usd_balance": 1,
             "created_at": 1, "last_login": 1, "referred_by": 1}
        )
        
        if not user:
            return None
        
        # Get direct referrals
        referrals = await db.users.find(
            {"referred_by": user_id},
            {"user_id": 1}
        ).to_list(1000)
        
        referral_count = len(referrals)
        
        # Build children recursively
        children = []
        for ref in referrals[:50]:  # Limit to 50 direct children for performance
            child = await build_tree(ref["user_id"], depth + 1)
            if child:
                children.append(child)
        
        return {
            "user_id": user["user_id"],
            "name": user.get("name", ""),
            "username": user.get("username", ""),
            "avatar": user.get("avatar"),
            "email": user.get("email", ""),
            "rank": user.get("rank", "regular"),
            "bl_coins": user.get("bl_coins", 0),
            "usd_balance": user.get("usd_balance", 0),
            "referred_by": user.get("referred_by"),
            "referral_count": referral_count,
            "created_at": user.get("created_at"),
            "last_login": user.get("last_login"),
            "children": children,
            "depth": depth,
        }
    
    # If no root specified, get top-level users (no referrer)
    if not root_user_id:
        top_users = await db.users.find(
            {"$or": [{"referred_by": None}, {"referred_by": {"$exists": False}}]},
            {"user_id": 1}
        ).limit(10).to_list(10)
        
        trees = []
        for user in top_users:
            tree = await build_tree(user["user_id"])
            if tree:
                trees.append(tree)
        
        return {"trees": trees, "root_count": len(trees)}
    else:
        tree = await build_tree(root_user_id)
        return {"tree": tree}

@admin_genealogy_router.get("/user/{user_id}/network")
async def get_user_network(
    request: Request,
    user_id: str,
    admin: Dict = Depends(require_admin)
):
    """Get user's full network (upline + downline)"""
    if not await check_admin_permission(admin, "view_genealogy"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get upline chain
    upline = []
    current = user
    while current.get("referred_by"):
        upline_user = await db.users.find_one(
            {"user_id": current["referred_by"]},
            {"_id": 0, "user_id": 1, "name": 1, "username": 1, "avatar": 1, "rank": 1}
        )
        if upline_user:
            upline.append(upline_user)
            current = upline_user
        else:
            break
    
    # Get L1 downline
    l1_downline = await db.users.find(
        {"referred_by": user_id},
        {"_id": 0, "user_id": 1, "name": 1, "username": 1, "avatar": 1, "rank": 1, "bl_coins": 1}
    ).to_list(1000)
    
    # Get L2 downline
    l1_ids = [u["user_id"] for u in l1_downline]
    l2_downline = await db.users.find(
        {"referred_by": {"$in": l1_ids}},
        {"_id": 0, "user_id": 1, "name": 1, "username": 1, "avatar": 1, "rank": 1, "referred_by": 1}
    ).to_list(5000)
    
    # Log view
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.GENEALOGY_VIEW, "user", user_id,
        {"view_type": "network"},
        request
    )
    
    return {
        "user": user,
        "upline": upline,
        "l1_downline": l1_downline,
        "l2_downline": l2_downline,
        "stats": {
            "upline_depth": len(upline),
            "l1_count": len(l1_downline),
            "l2_count": len(l2_downline),
            "total_network": len(l1_downline) + len(l2_downline),
        }
    }

@admin_genealogy_router.post("/reassign")
async def reassign_downline(
    request: Request,
    data: GenealogyReassignRequest,
    admin: Dict = Depends(require_admin)
):
    """Manually reassign a user to a new upline (drag-and-drop support)"""
    if not await check_admin_permission(admin, "reassign_downlines"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Verify both users exist
    user = await db.users.find_one({"user_id": data.user_id})
    new_upline = await db.users.find_one({"user_id": data.new_upline_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not new_upline:
        raise HTTPException(status_code=404, detail="New upline not found")
    
    # Prevent circular reference
    current = new_upline
    while current.get("referred_by"):
        if current["referred_by"] == data.user_id:
            raise HTTPException(status_code=400, detail="Cannot create circular reference")
        current = await db.users.find_one({"user_id": current["referred_by"]})
        if not current:
            break
    
    old_upline_id = user.get("referred_by")
    now = datetime.now(timezone.utc)
    
    # Update user's upline
    await db.users.update_one(
        {"user_id": data.user_id},
        {"$set": {
            "referred_by": data.new_upline_id,
            "upline_changed_at": now.isoformat(),
            "upline_changed_by": admin["admin_id"],
        }}
    )
    
    # Update referral relationships
    await db.referral_relationships.update_many(
        {"referred_id": data.user_id, "level": 1},
        {"$set": {
            "referrer_id": data.new_upline_id,
            "updated_at": now.isoformat(),
        }}
    )
    
    # Log action
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.GENEALOGY_REASSIGN, "user", data.user_id,
        {
            "old_upline_id": old_upline_id,
            "new_upline_id": data.new_upline_id,
            "reason": data.reason,
        },
        request
    )
    
    # Broadcast update
    await broadcast_admin_event({
        "type": "genealogy_changed",
        "user_id": data.user_id,
        "old_upline": old_upline_id,
        "new_upline": data.new_upline_id,
        "admin": admin["email"],
    })
    
    return {
        "success": True,
        "user_id": data.user_id,
        "old_upline_id": old_upline_id,
        "new_upline_id": data.new_upline_id,
    }

@admin_genealogy_router.get("/orphans")
async def get_orphan_queue(
    request: Request,
    admin: Dict = Depends(require_admin)
):
    """Get orphan assignment queue"""
    if not await check_admin_permission(admin, "manage_orphans"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Get users without upline (orphans)
    orphans = await db.users.find(
        {"$or": [{"referred_by": None}, {"referred_by": {"$exists": False}}]},
        {"_id": 0, "user_id": 1, "name": 1, "username": 1, "email": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(100)
    
    # Get pending orphan assignment requests
    pending_requests = await db.orphan_reassignments.find(
        {"status": "pending"},
        {"_id": 0}
    ).to_list(100)
    
    return {
        "orphans": orphans,
        "pending_requests": pending_requests,
        "orphan_count": len(orphans),
    }

# ============== ROLE & PERMISSION MANAGEMENT ==============

@admin_roles_router.get("/admins")
async def list_all_admins(
    request: Request,
    admin: Dict = Depends(require_admin)
):
    """List all admin accounts"""
    if not await check_admin_permission(admin, "view_admins"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    admins = await db.admin_accounts.find(
        {},
        {"_id": 0, "totp_secret": 0, "backup_codes": 0}
    ).to_list(100)
    
    return {"admins": admins, "count": len(admins)}

@admin_roles_router.post("/admins")
async def create_admin(
    request: Request,
    data: CreateAdminRequest,
    admin: Dict = Depends(require_admin)
):
    """Create a new admin account"""
    if not await check_admin_permission(admin, "create_admins"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Verify user exists
    user = await db.users.find_one({"user_id": data.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if already admin
    existing = await db.admin_accounts.find_one({"user_id": data.user_id})
    if existing:
        raise HTTPException(status_code=400, detail="User is already an admin")
    
    # Create admin account
    now = datetime.now(timezone.utc)
    admin_account = {
        "admin_id": f"admin_{uuid.uuid4().hex[:12]}",
        "user_id": data.user_id,
        "email": user.get("email"),
        "name": user.get("name", ""),
        "role": data.role.value,
        "permissions": data.permissions or AdminPermissions().dict(),
        "is_active": True,
        "created_by": admin["admin_id"],
        "created_at": now.isoformat(),
    }
    
    await db.admin_accounts.insert_one(admin_account)
    
    # Update user record
    await db.users.update_one(
        {"user_id": data.user_id},
        {"$set": {"is_admin": True, "admin_role": data.role.value}}
    )
    
    # Log action
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.ADMIN_CREATE, "admin", admin_account["admin_id"],
        {"new_admin_email": user.get("email"), "role": data.role.value},
        request
    )
    
    return {"success": True, "admin_id": admin_account["admin_id"]}

@admin_roles_router.put("/admins/{target_admin_id}")
async def update_admin(
    request: Request,
    target_admin_id: str,
    data: UpdateAdminRequest,
    admin: Dict = Depends(require_admin)
):
    """Update admin role or permissions"""
    if not await check_admin_permission(admin, "edit_admins"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if data.role:
        update_data["role"] = data.role.value
    if data.permissions:
        update_data["permissions"] = data.permissions
    if data.is_active is not None:
        update_data["is_active"] = data.is_active
    
    result = await db.admin_accounts.update_one(
        {"admin_id": target_admin_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.ADMIN_UPDATE, "admin", target_admin_id,
        {"updates": update_data},
        request
    )
    
    return {"success": True}

@admin_roles_router.delete("/admins/{target_admin_id}")
async def delete_admin(
    request: Request,
    target_admin_id: str,
    admin: Dict = Depends(require_admin)
):
    """Remove admin privileges"""
    if not await check_admin_permission(admin, "delete_admins"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Get admin to delete
    target = await db.admin_accounts.find_one({"admin_id": target_admin_id})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    
    # Prevent self-deletion
    if target_admin_id == admin["admin_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")
    
    # Delete admin account
    await db.admin_accounts.delete_one({"admin_id": target_admin_id})
    
    # Update user record
    await db.users.update_one(
        {"user_id": target["user_id"]},
        {"$set": {"is_admin": False, "admin_role": None}}
    )
    
    await log_admin_action(
        admin["admin_id"], admin["email"], admin.get("name", ""),
        AdminAuditAction.ADMIN_DELETE, "admin", target_admin_id,
        {"deleted_admin_email": target.get("email")},
        request
    )
    
    return {"success": True}

# ============== SYSTEM MONITORING ==============

@admin_system_router.get("/health")
async def get_system_health(
    request: Request,
    admin: Dict = Depends(require_admin)
):
    """Get system health metrics"""
    if not await check_admin_permission(admin, "view_system_health"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Database stats
    db_stats = await db.command("dbStats")
    
    # User counts
    total_users = await db.users.count_documents({})
    active_users_24h = await db.users.count_documents({
        "last_login": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()}
    })
    
    # Transaction volume (24h)
    txn_24h = await db.transactions.count_documents({
        "created_at": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()}
    })
    
    return {
        "database": {
            "collections": db_stats.get("collections", 0),
            "data_size_mb": round(db_stats.get("dataSize", 0) / (1024 * 1024), 2),
            "storage_size_mb": round(db_stats.get("storageSize", 0) / (1024 * 1024), 2),
        },
        "users": {
            "total": total_users,
            "active_24h": active_users_24h,
        },
        "transactions": {
            "last_24h": txn_24h,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

@admin_system_router.get("/activity-feed")
async def get_activity_feed(
    request: Request,
    limit: int = 50,
    admin: Dict = Depends(require_admin)
):
    """Get real-time activity feed"""
    # Get recent audit logs
    logs = await db.admin_audit_logs.find(
        {},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Get recent user signups
    signups = await db.users.find(
        {},
        {"_id": 0, "user_id": 1, "name": 1, "email": 1, "created_at": 1}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    # Get recent transactions
    transactions = await db.transactions.find(
        {},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    return {
        "audit_logs": logs,
        "recent_signups": signups,
        "recent_transactions": transactions,
    }

@admin_system_router.get("/analytics")
async def get_analytics(
    request: Request,
    period: str = "7d",  # 24h, 7d, 30d
    admin: Dict = Depends(require_admin)
):
    """Get platform analytics"""
    if not await check_admin_permission(admin, "view_analytics"):
        raise HTTPException(status_code=403, detail="Permission denied")
    
    # Calculate date range
    periods = {"24h": 1, "7d": 7, "30d": 30}
    days = periods.get(period, 7)
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    
    # Signups per day
    signups = await db.users.aggregate([
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]).to_list(days)
    
    # Daily active users
    active_users = await db.users.aggregate([
        {"$match": {"last_login": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$substr": ["$last_login", 0, 10]},
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]).to_list(days)
    
    # Transactions per day
    transactions = await db.transactions.aggregate([
        {"$match": {"created_at": {"$gte": start_date}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "count": {"$sum": 1},
            "volume": {"$sum": "$amount"}
        }},
        {"$sort": {"_id": 1}}
    ]).to_list(days)
    
    return {
        "period": period,
        "signups": signups,
        "active_users": active_users,
        "transactions": transactions,
    }
