"""
Diamond Leader Rank & Withdrawal System
=======================================
- Diamond Leader qualification & maintenance
- KYC verification integration (Stripe Identity)
- Real money withdrawals with 1% fee
- Inactivity reassignment (admin approval required)
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid

# Import from main server and referral system
from server import get_current_user, db, logger
from referral_system import (
    UserRank, TransactionType, Currency, KYCStatus, WithdrawalStatus,
    ReassignmentStatus, record_transaction, get_user_rank,
    DIAMOND_REQUIRED_DIRECT_RECRUITS, DIAMOND_REQUIRED_DOWNLINE_COMMISSIONS,
    DIAMOND_REQUIRED_PERSONAL_SALES, DIAMOND_QUALIFICATION_PERIOD_DAYS,
    DIAMOND_MAINTENANCE_NEW_RECRUITS, DIAMOND_MAINTENANCE_PERSONAL_SALES,
    DIAMOND_MAINTENANCE_COMMISSIONS, DIAMOND_MAINTENANCE_PERIOD_DAYS,
    DIAMOND_REWARD_BL, WITHDRAWAL_FEE_RATE, INACTIVITY_YEARS_FOR_REASSIGNMENT
)

# Routers
diamond_router = APIRouter(prefix="/diamond", tags=["Diamond Leader"])
withdrawal_router = APIRouter(prefix="/withdrawal", tags=["Withdrawals"])
kyc_router = APIRouter(prefix="/kyc", tags=["KYC Verification"])
reassignment_router = APIRouter(prefix="/reassignment", tags=["Reassignment"])

# ============== PYDANTIC MODELS ==============

class DiamondStatus(BaseModel):
    is_diamond: bool
    qualified_at: Optional[str] = None
    last_maintained_at: Optional[str] = None
    maintenance_due_at: Optional[str] = None
    days_until_check: int = 0
    qualification_progress: Dict[str, Any] = {}
    maintenance_progress: Dict[str, Any] = {}

class WithdrawalRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Amount in USD")
    payout_method: str = Field(..., description="bank_account or debit_card")
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    routing_number: Optional[str] = None
    card_last_four: Optional[str] = None

class KYCInitRequest(BaseModel):
    return_url: str = Field(..., description="URL to return after KYC")

class ReassignmentRequest(BaseModel):
    inactive_user_id: str
    new_upline_id: str
    reason: str = "5_year_inactivity"

# ============== DIAMOND LEADER FUNCTIONS ==============

async def check_diamond_qualification(user_id: str) -> Dict[str, Any]:
    """
    Check if user qualifies for Diamond Leader rank.
    Requirements (all within 30 days):
    - 100+ direct recruits
    - $1,000+ downline commissions
    - $1,000+ personal sales
    """
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=DIAMOND_QUALIFICATION_PERIOD_DAYS)).isoformat()
    
    # Count direct recruits
    direct_recruits = await db.users.count_documents({"referred_by": user_id})
    
    # Sum downline commissions (30 days)
    commission_pipeline = [
        {"$match": {
            "recipient_id": user_id,
            "created_at": {"$gte": thirty_days_ago}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}}
    ]
    commission_result = await db.commissions.aggregate(commission_pipeline).to_list(1)
    downline_commissions = commission_result[0]["total"] if commission_result else 0
    
    # Sum personal sales (30 days)
    sales_pipeline = [
        {"$match": {
            "user_id": user_id,
            "type": TransactionType.SALE_EARNINGS,
            "currency": Currency.USD,
            "created_at": {"$gte": thirty_days_ago}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    sales_result = await db.transactions.aggregate(sales_pipeline).to_list(1)
    personal_sales = sales_result[0]["total"] if sales_result else 0
    
    qualified = (
        direct_recruits >= DIAMOND_REQUIRED_DIRECT_RECRUITS and
        downline_commissions >= DIAMOND_REQUIRED_DOWNLINE_COMMISSIONS and
        personal_sales >= DIAMOND_REQUIRED_PERSONAL_SALES
    )
    
    return {
        "qualified": qualified,
        "direct_recruits": direct_recruits,
        "direct_recruits_required": DIAMOND_REQUIRED_DIRECT_RECRUITS,
        "downline_commissions": downline_commissions,
        "downline_commissions_required": DIAMOND_REQUIRED_DOWNLINE_COMMISSIONS,
        "personal_sales": personal_sales,
        "personal_sales_required": DIAMOND_REQUIRED_PERSONAL_SALES,
    }

async def check_diamond_maintenance(user_id: str) -> Dict[str, Any]:
    """
    Check if Diamond Leader meets maintenance requirements.
    Requirements (every 30 days):
    - 1+ new direct recruit
    - $10+ personal sales
    - $10+ downline commissions
    """
    user = await db.users.find_one({"user_id": user_id}, {"rank_last_maintained_at": 1})
    
    # Determine check period
    if user and user.get("rank_last_maintained_at"):
        period_start = user["rank_last_maintained_at"]
    else:
        period_start = (datetime.now(timezone.utc) - timedelta(days=DIAMOND_MAINTENANCE_PERIOD_DAYS)).isoformat()
    
    # Count new recruits since last maintenance
    new_recruits = await db.users.count_documents({
        "referred_by": user_id,
        "created_at": {"$gte": period_start}
    })
    
    # Sum personal sales since last maintenance
    sales_pipeline = [
        {"$match": {
            "user_id": user_id,
            "type": TransactionType.SALE_EARNINGS,
            "currency": Currency.USD,
            "created_at": {"$gte": period_start}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    sales_result = await db.transactions.aggregate(sales_pipeline).to_list(1)
    personal_sales = sales_result[0]["total"] if sales_result else 0
    
    # Sum commissions since last maintenance
    commission_pipeline = [
        {"$match": {
            "recipient_id": user_id,
            "created_at": {"$gte": period_start}
        }},
        {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}}
    ]
    commission_result = await db.commissions.aggregate(commission_pipeline).to_list(1)
    commissions = commission_result[0]["total"] if commission_result else 0
    
    maintained = (
        new_recruits >= DIAMOND_MAINTENANCE_NEW_RECRUITS and
        personal_sales >= DIAMOND_MAINTENANCE_PERSONAL_SALES and
        commissions >= DIAMOND_MAINTENANCE_COMMISSIONS
    )
    
    return {
        "maintained": maintained,
        "new_recruits": new_recruits,
        "new_recruits_required": DIAMOND_MAINTENANCE_NEW_RECRUITS,
        "personal_sales": personal_sales,
        "personal_sales_required": DIAMOND_MAINTENANCE_PERSONAL_SALES,
        "commissions": commissions,
        "commissions_required": DIAMOND_MAINTENANCE_COMMISSIONS,
        "period_start": period_start,
    }

async def promote_to_diamond(user_id: str) -> Dict[str, Any]:
    """Promote user to Diamond Leader and grant one-time rewards"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Update user rank
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "rank": UserRank.DIAMOND_LEADER.value,
            "rank_qualified_at": now,
            "rank_last_maintained_at": now,
        }}
    )
    
    # Grant BL coin bonus
    await record_transaction(
        user_id=user_id,
        transaction_type=TransactionType.DIAMOND_BONUS_BL,
        currency=Currency.BL,
        amount=DIAMOND_REWARD_BL,
        details={"type": "diamond_qualification_bonus"}
    )
    
    # Record rank change
    await db.rank_history.insert_one({
        "history_id": f"rank_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "old_rank": UserRank.REGULAR.value,
        "new_rank": UserRank.DIAMOND_LEADER.value,
        "reason": "qualification",
        "created_at": now,
    })
    
    # Create pending USD reward for admin payout
    await db.pending_payouts.insert_one({
        "payout_id": f"payout_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "type": "diamond_qualification",
        "amount_usd": 100.0,  # Default, admin can change
        "status": "pending",
        "created_at": now,
    })
    
    logger.info(f"User {user_id} promoted to Diamond Leader")
    
    return {
        "success": True,
        "new_rank": UserRank.DIAMOND_LEADER.value,
        "bl_bonus": DIAMOND_REWARD_BL,
        "usd_bonus_pending": True,
    }

async def demote_from_diamond(user_id: str) -> Dict[str, Any]:
    """Demote user from Diamond Leader to Regular"""
    now = datetime.now(timezone.utc).isoformat()
    
    # Update user rank
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "rank": UserRank.REGULAR.value,
        },
        "$unset": {
            "rank_qualified_at": "",
            "rank_last_maintained_at": "",
        }}
    )
    
    # Record rank change
    await db.rank_history.insert_one({
        "history_id": f"rank_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "old_rank": UserRank.DIAMOND_LEADER.value,
        "new_rank": UserRank.REGULAR.value,
        "reason": "maintenance_failure",
        "created_at": now,
    })
    
    logger.info(f"User {user_id} demoted from Diamond Leader")
    
    return {
        "success": True,
        "new_rank": UserRank.REGULAR.value,
    }

# ============== DIAMOND ENDPOINTS ==============

@diamond_router.get("/status")
async def get_diamond_status(current_user: dict = Depends(get_current_user)) -> DiamondStatus:
    """Get user's Diamond Leader status"""
    user = await db.users.find_one(
        {"user_id": current_user["user_id"]},
        {"rank": 1, "rank_qualified_at": 1, "rank_last_maintained_at": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    is_diamond = user.get("rank") == UserRank.DIAMOND_LEADER.value
    
    qualification_progress = await check_diamond_qualification(current_user["user_id"])
    maintenance_progress = await check_diamond_maintenance(current_user["user_id"]) if is_diamond else {}
    
    # Calculate maintenance due date
    maintenance_due_at = None
    days_until_check = 0
    if is_diamond and user.get("rank_last_maintained_at"):
        last_maintained = datetime.fromisoformat(user["rank_last_maintained_at"].replace("Z", "+00:00"))
        due_date = last_maintained + timedelta(days=DIAMOND_MAINTENANCE_PERIOD_DAYS)
        maintenance_due_at = due_date.isoformat()
        days_until_check = max(0, (due_date - datetime.now(timezone.utc)).days)
    
    return DiamondStatus(
        is_diamond=is_diamond,
        qualified_at=user.get("rank_qualified_at"),
        last_maintained_at=user.get("rank_last_maintained_at"),
        maintenance_due_at=maintenance_due_at,
        days_until_check=days_until_check,
        qualification_progress=qualification_progress,
        maintenance_progress=maintenance_progress,
    )

@diamond_router.post("/check-qualification")
async def check_and_promote(current_user: dict = Depends(get_current_user)):
    """Check if user qualifies for Diamond and promote if eligible"""
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"rank": 1})
    
    if user.get("rank") == UserRank.DIAMOND_LEADER.value:
        raise HTTPException(status_code=400, detail="Already a Diamond Leader")
    
    qualification = await check_diamond_qualification(current_user["user_id"])
    
    if qualification["qualified"]:
        result = await promote_to_diamond(current_user["user_id"])
        return {
            "promoted": True,
            "qualification": qualification,
            "rewards": result,
        }
    else:
        return {
            "promoted": False,
            "qualification": qualification,
            "message": "Requirements not met",
        }

# ============== WITHDRAWAL ENDPOINTS ==============

@withdrawal_router.get("/status")
async def get_withdrawal_status(current_user: dict = Depends(get_current_user)):
    """Get user's withdrawal eligibility status"""
    user = await db.users.find_one(
        {"user_id": current_user["user_id"]},
        {"usd_balance": 1, "kyc_status": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    kyc_status = user.get("kyc_status", "not_started")
    usd_balance = user.get("usd_balance", 0)
    
    return {
        "usd_balance": usd_balance,
        "kyc_status": kyc_status,
        "kyc_required": kyc_status != "verified",
        "can_withdraw": kyc_status == "verified" and usd_balance > 0,
        "withdrawal_fee_rate": WITHDRAWAL_FEE_RATE * 100,
        "min_withdrawal": 10.0,
    }

@withdrawal_router.post("/request")
async def request_withdrawal(
    request: WithdrawalRequest,
    current_user: dict = Depends(get_current_user)
):
    """Request a withdrawal (requires KYC verification)"""
    user = await db.users.find_one(
        {"user_id": current_user["user_id"]},
        {"usd_balance": 1, "kyc_status": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check KYC status
    if user.get("kyc_status") != "verified":
        raise HTTPException(
            status_code=403,
            detail="KYC verification required before withdrawal"
        )
    
    # Check balance
    usd_balance = user.get("usd_balance", 0)
    if request.amount > usd_balance:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    if request.amount < 10.0:
        raise HTTPException(status_code=400, detail="Minimum withdrawal is $10")
    
    # Calculate fee
    fee = request.amount * WITHDRAWAL_FEE_RATE
    net_amount = request.amount - fee
    
    now = datetime.now(timezone.utc).isoformat()
    withdrawal_id = f"wd_{uuid.uuid4().hex[:12]}"
    
    # Create withdrawal request
    withdrawal = {
        "withdrawal_id": withdrawal_id,
        "user_id": current_user["user_id"],
        "amount_usd": request.amount,
        "fee_usd": fee,
        "net_amount_usd": net_amount,
        "payout_method": request.payout_method,
        "bank_name": request.bank_name,
        "account_last_four": request.account_number[-4:] if request.account_number else request.card_last_four,
        "status": WithdrawalStatus.PENDING.value,
        "created_at": now,
    }
    await db.withdrawals.insert_one(withdrawal)
    
    # Deduct from balance (hold)
    await record_transaction(
        user_id=current_user["user_id"],
        transaction_type=TransactionType.WITHDRAWAL,
        currency=Currency.USD,
        amount=-request.amount,
        reference_id=withdrawal_id,
        details={"status": "pending", "net_amount": net_amount, "fee": fee}
    )
    
    logger.info(f"Withdrawal request {withdrawal_id} created for user {current_user['user_id']}: ${request.amount}")
    
    return {
        "withdrawal_id": withdrawal_id,
        "amount": request.amount,
        "fee": fee,
        "net_amount": net_amount,
        "status": "pending",
        "message": "Withdrawal request submitted. Admin will process within 1-3 business days.",
    }

@withdrawal_router.get("/history")
async def get_withdrawal_history(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get user's withdrawal history"""
    withdrawals = await db.withdrawals.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.withdrawals.count_documents({"user_id": current_user["user_id"]})
    
    return {
        "withdrawals": withdrawals,
        "total": total,
        "skip": skip,
        "limit": limit,
    }

# ============== KYC ENDPOINTS ==============

@kyc_router.get("/status")
async def get_kyc_status(current_user: dict = Depends(get_current_user)):
    """Get user's KYC verification status"""
    user = await db.users.find_one(
        {"user_id": current_user["user_id"]},
        {"kyc_status": 1, "kyc_verified_at": 1, "id_verified": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    kyc_status = user.get("kyc_status", "not_started")
    
    return {
        "status": kyc_status,
        "verified_at": user.get("kyc_verified_at"),
        "id_verified": user.get("id_verified", False),
        "can_withdraw": kyc_status == "verified",
    }

@kyc_router.post("/init")
async def init_kyc_verification(
    request: KYCInitRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Initialize KYC verification with Stripe Identity.
    Returns a verification session URL.
    """
    try:
        import stripe
        import os
        
        # FORCE LIVE STRIPE KEY
        api_key = get_stripe_key()
        
        if not api_key:
            # Fallback to manual verification if Stripe not configured
            await db.users.update_one(
                {"user_id": current_user["user_id"]},
                {"$set": {"kyc_status": "pending"}}
            )
            return {
                "status": "pending",
                "message": "KYC verification pending - Stripe not configured"
            }
        
        stripe.api_key = api_key
        
        if not stripe.api_key:
            # Fallback to manual verification
            await db.users.update_one(
                {"user_id": current_user["user_id"]},
                {"$set": {"kyc_status": "pending"}}
            )
            return {
                "method": "manual",
                "message": "KYC verification request submitted. Admin will review your documents.",
                "status": "pending",
            }
        
        # Create Stripe Identity verification session
        verification_session = stripe.identity.VerificationSession.create(
            type="document",
            metadata={
                "user_id": current_user["user_id"],
            },
            return_url=request.return_url,
        )
        
        # Update user KYC status
        await db.users.update_one(
            {"user_id": current_user["user_id"]},
            {"$set": {
                "kyc_status": "pending",
                "kyc_session_id": verification_session.id,
            }}
        )
        
        return {
            "method": "stripe_identity",
            "verification_url": verification_session.url,
            "session_id": verification_session.id,
            "status": "pending",
        }
        
    except Exception as e:
        logger.error(f"KYC init error: {e}")
        # Fallback to manual verification
        await db.users.update_one(
            {"user_id": current_user["user_id"]},
            {"$set": {"kyc_status": "pending"}}
        )
        return {
            "method": "manual",
            "message": "KYC verification request submitted. Admin will review manually.",
            "status": "pending",
        }

# ============== INACTIVITY REASSIGNMENT ==============

@reassignment_router.post("/request")
async def request_downline_reassignment(
    request: ReassignmentRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Request reassignment of inactive user's downline.
    Requires admin approval before execution.
    """
    # Check if current user is admin
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"is_admin": 1})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Verify inactive user exists and is actually inactive
    inactive_user = await db.users.find_one(
        {"user_id": request.inactive_user_id},
        {"last_login_at": 1, "referred_by": 1}
    )
    
    if not inactive_user:
        raise HTTPException(status_code=404, detail="Inactive user not found")
    
    # Check 5-year inactivity
    if inactive_user.get("last_login_at"):
        last_login = datetime.fromisoformat(inactive_user["last_login_at"].replace("Z", "+00:00"))
        years_inactive = (datetime.now(timezone.utc) - last_login).days / 365
        
        if years_inactive < INACTIVITY_YEARS_FOR_REASSIGNMENT:
            raise HTTPException(
                status_code=400,
                detail=f"User has not been inactive for {INACTIVITY_YEARS_FOR_REASSIGNMENT} years"
            )
    
    # Create reassignment request (pending admin approval)
    now = datetime.now(timezone.utc).isoformat()
    reassignment_id = f"reassign_{uuid.uuid4().hex[:12]}"
    
    # Count affected downlines
    direct_count = await db.users.count_documents({"referred_by": request.inactive_user_id})
    
    reassignment = {
        "reassignment_id": reassignment_id,
        "inactive_user_id": request.inactive_user_id,
        "new_upline_id": request.new_upline_id,
        "old_upline_id": inactive_user.get("referred_by"),
        "affected_direct_count": direct_count,
        "reason": request.reason,
        "status": ReassignmentStatus.PENDING.value,
        "requested_by": current_user["user_id"],
        "created_at": now,
    }
    
    await db.reassignment_requests.insert_one(reassignment)
    
    # Notify admins (in real app, send notification)
    logger.info(f"Reassignment request {reassignment_id} created: {request.inactive_user_id} -> {request.new_upline_id}")
    
    return {
        "reassignment_id": reassignment_id,
        "status": "pending",
        "affected_users": direct_count,
        "message": "Reassignment request created. Awaiting admin approval.",
    }

# ============== ADMIN ENDPOINTS FOR REASSIGNMENT ==============

@reassignment_router.get("/admin/list")
async def list_reassignment_requests(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all pending reassignment requests (admin only)"""
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"is_admin": 1})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    
    requests = await db.reassignment_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return requests

@reassignment_router.post("/admin/approve/{reassignment_id}")
async def approve_reassignment(
    reassignment_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Approve and execute a reassignment request (admin only)"""
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"is_admin": 1})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get reassignment request
    request = await db.reassignment_requests.find_one({"reassignment_id": reassignment_id})
    if not request:
        raise HTTPException(status_code=404, detail="Reassignment request not found")
    
    if request["status"] != ReassignmentStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Request already processed")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Execute reassignment - update all direct referrals
    result = await db.users.update_many(
        {"referred_by": request["inactive_user_id"]},
        {"$set": {
            "referred_by": request["new_upline_id"],
            "reassigned_at": now,
            "reassigned_from": request["inactive_user_id"],
        }}
    )
    
    # Update request status
    await db.reassignment_requests.update_one(
        {"reassignment_id": reassignment_id},
        {"$set": {
            "status": ReassignmentStatus.COMPLETED.value,
            "approved_by": current_user["user_id"],
            "approved_at": now,
            "users_reassigned": result.modified_count,
        }}
    )
    
    # Update direct referral counts
    await db.users.update_one(
        {"user_id": request["new_upline_id"]},
        {"$inc": {"direct_referrals": result.modified_count}}
    )
    
    logger.info(f"Reassignment {reassignment_id} completed: {result.modified_count} users reassigned")
    
    return {
        "success": True,
        "reassignment_id": reassignment_id,
        "users_reassigned": result.modified_count,
        "new_upline": request["new_upline_id"],
    }

@reassignment_router.post("/admin/reject/{reassignment_id}")
async def reject_reassignment(
    reassignment_id: str,
    reason: str = "Rejected by admin",
    current_user: dict = Depends(get_current_user)
):
    """Reject a reassignment request (admin only)"""
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"is_admin": 1})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.reassignment_requests.update_one(
        {"reassignment_id": reassignment_id, "status": ReassignmentStatus.PENDING.value},
        {"$set": {
            "status": ReassignmentStatus.REJECTED.value,
            "rejected_by": current_user["user_id"],
            "rejected_at": datetime.now(timezone.utc).isoformat(),
            "rejection_reason": reason,
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found or already processed")
    
    return {"success": True, "message": "Reassignment request rejected"}

# ============== DISCLAIMER TEXT ==============

DISCLAIMER_TEXT = """
IMPORTANT LEGAL DISCLAIMER

BL coins are virtual play money with NO real-world monetary value. They cannot be exchanged, sold, or converted to real currency outside of the platform's designated withdrawal process.

PARTICIPATION INVOLVES FINANCIAL RISK. Only use funds you can afford to lose.

This platform is NOT:
- An investment opportunity or financial service
- A gambling product or casino (BL coins have no value)
- A money transmission service
- A securities offering

The referral and compensation system is designed to reward user engagement and recruitment. Earnings depend on actual sales activity in the marketplace, not recruitment alone.

By using this platform, you agree to:
- Comply with all applicable laws in your jurisdiction
- Not use the platform for money laundering or illegal activities
- Accept full responsibility for any tax obligations on earnings

Play responsibly. If you have concerns about compulsive behavior, please seek help.

© Blendlink. All rights reserved.
"""

@diamond_router.get("/disclaimer")
async def get_disclaimer():
    """Get the legal disclaimer text"""
    return {
        "disclaimer": DISCLAIMER_TEXT,
        "must_accept_on": ["signup", "withdrawal", "referral_page"],
        "version": "1.0",
        "last_updated": "2026-01-11",
    }

# ============== ADMIN WITHDRAWAL MANAGEMENT ==============

admin_withdrawal_router = APIRouter(prefix="/admin/withdrawals", tags=["Admin Withdrawals"])

@admin_withdrawal_router.get("/list")
async def admin_list_withdrawals(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """List all withdrawals (admin only)"""
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"is_admin": 1})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    
    withdrawals = await db.withdrawals.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Enrich with user info
    for w in withdrawals:
        user_info = await db.users.find_one(
            {"user_id": w["user_id"]},
            {"_id": 0, "email": 1, "name": 1, "username": 1, "kyc_status": 1}
        )
        w["user"] = user_info
    
    # Get counts by status
    counts = {
        "pending": await db.withdrawals.count_documents({"status": "pending"}),
        "approved": await db.withdrawals.count_documents({"status": "approved"}),
        "rejected": await db.withdrawals.count_documents({"status": "rejected"}),
        "completed": await db.withdrawals.count_documents({"status": "completed"}),
    }
    
    total = await db.withdrawals.count_documents(query)
    
    return {
        "withdrawals": withdrawals,
        "counts": counts,
        "total": total,
        "skip": skip,
        "limit": limit,
    }

@admin_withdrawal_router.get("/{withdrawal_id}")
async def admin_get_withdrawal(
    withdrawal_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get withdrawal details (admin only)"""
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"is_admin": 1})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    withdrawal = await db.withdrawals.find_one({"withdrawal_id": withdrawal_id}, {"_id": 0})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    # Get user info
    user_info = await db.users.find_one(
        {"user_id": withdrawal["user_id"]},
        {"_id": 0, "password_hash": 0}
    )
    withdrawal["user"] = user_info
    
    return withdrawal

class WithdrawalApprovalRequest(BaseModel):
    payout_reference: Optional[str] = None
    notes: Optional[str] = None

@admin_withdrawal_router.post("/{withdrawal_id}/approve")
async def admin_approve_withdrawal(
    withdrawal_id: str,
    data: WithdrawalApprovalRequest,
    current_user: dict = Depends(get_current_user)
):
    """Approve a withdrawal request (admin only)"""
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"is_admin": 1})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    withdrawal = await db.withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot approve withdrawal with status: {withdrawal['status']}")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "approved",
            "approved_by": current_user["user_id"],
            "approved_at": now,
            "payout_reference": data.payout_reference,
            "admin_notes": data.notes,
        }}
    )
    
    logger.info(f"Withdrawal {withdrawal_id} approved by {current_user['user_id']}")
    
    return {
        "success": True,
        "withdrawal_id": withdrawal_id,
        "status": "approved",
        "message": "Withdrawal approved",
    }

class WithdrawalCompletionRequest(BaseModel):
    payout_reference: str
    payout_method_used: str
    notes: Optional[str] = None

@admin_withdrawal_router.post("/{withdrawal_id}/complete")
async def admin_complete_withdrawal(
    withdrawal_id: str,
    data: WithdrawalCompletionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Mark withdrawal as completed/paid out (admin only)"""
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"is_admin": 1})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    withdrawal = await db.withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail=f"Cannot complete withdrawal with status: {withdrawal['status']}")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "completed",
            "completed_by": current_user["user_id"],
            "completed_at": now,
            "payout_reference": data.payout_reference,
            "payout_method_used": data.payout_method_used,
            "admin_notes": data.notes,
        }}
    )
    
    logger.info(f"Withdrawal {withdrawal_id} completed by {current_user['user_id']}")
    
    return {
        "success": True,
        "withdrawal_id": withdrawal_id,
        "status": "completed",
        "message": "Withdrawal marked as completed",
    }

class WithdrawalRejectionRequest(BaseModel):
    reason: str
    refund_balance: bool = True

@admin_withdrawal_router.post("/{withdrawal_id}/reject")
async def admin_reject_withdrawal(
    withdrawal_id: str,
    data: WithdrawalRejectionRequest,
    current_user: dict = Depends(get_current_user)
):
    """Reject a withdrawal request (admin only)"""
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"is_admin": 1})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    withdrawal = await db.withdrawals.find_one({"withdrawal_id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    
    if withdrawal["status"] not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail=f"Cannot reject withdrawal with status: {withdrawal['status']}")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Refund balance if requested
    if data.refund_balance:
        await db.users.update_one(
            {"user_id": withdrawal["user_id"]},
            {"$inc": {"usd_balance": withdrawal["amount_usd"]}}
        )
        
        # Record refund transaction
        await record_transaction(
            user_id=withdrawal["user_id"],
            transaction_type=TransactionType.WITHDRAWAL,
            currency=Currency.USD,
            amount=withdrawal["amount_usd"],
            reference_id=withdrawal_id,
            details={"type": "refund", "reason": data.reason}
        )
    
    await db.withdrawals.update_one(
        {"withdrawal_id": withdrawal_id},
        {"$set": {
            "status": "rejected",
            "rejected_by": current_user["user_id"],
            "rejected_at": now,
            "rejection_reason": data.reason,
            "balance_refunded": data.refund_balance,
        }}
    )
    
    logger.info(f"Withdrawal {withdrawal_id} rejected by {current_user['user_id']}: {data.reason}")
    
    return {
        "success": True,
        "withdrawal_id": withdrawal_id,
        "status": "rejected",
        "balance_refunded": data.refund_balance,
        "message": "Withdrawal rejected",
    }

@admin_withdrawal_router.get("/stats/summary")
async def admin_withdrawal_stats(current_user: dict = Depends(get_current_user)):
    """Get withdrawal statistics (admin only)"""
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"is_admin": 1})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Aggregate stats
    pipeline = [
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount_usd"},
            "total_fees": {"$sum": "$fee_usd"},
        }}
    ]
    
    stats = await db.withdrawals.aggregate(pipeline).to_list(10)
    stats_dict = {s["_id"]: {"count": s["count"], "amount": s["total_amount"], "fees": s["total_fees"]} for s in stats}
    
    # Total pending KYC verifications
    pending_kyc = await db.users.count_documents({"kyc_status": "pending"})
    
    return {
        "by_status": stats_dict,
        "pending_kyc_count": pending_kyc,
        "total_withdrawals": sum(s.get("count", 0) for s in stats_dict.values()),
        "total_paid_out": stats_dict.get("completed", {}).get("amount", 0),
        "total_fees_collected": sum(s.get("fees", 0) for s in stats_dict.values()),
    }

# ============== ADMIN KYC MANAGEMENT ==============

@admin_withdrawal_router.get("/kyc/pending")
async def admin_list_pending_kyc(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """List users with pending KYC (admin only)"""
    user = await db.users.find_one({"user_id": current_user["user_id"]}, {"is_admin": 1})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    users = await db.users.find(
        {"kyc_status": "pending"},
        {"_id": 0, "password_hash": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.users.count_documents({"kyc_status": "pending"})
    
    return {
        "users": users,
        "total": total,
        "skip": skip,
        "limit": limit,
    }

class KYCApprovalRequest(BaseModel):
    notes: Optional[str] = None

@admin_withdrawal_router.post("/kyc/{user_id}/approve")
async def admin_approve_kyc(
    user_id: str,
    data: KYCApprovalRequest,
    current_user: dict = Depends(get_current_user)
):
    """Approve KYC for a user (admin only)"""
    admin = await db.users.find_one({"user_id": current_user["user_id"]}, {"is_admin": 1})
    if not admin or not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    target_user = await db.users.find_one({"user_id": user_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "kyc_status": "verified",
            "kyc_verified_at": now,
            "kyc_verified_by": current_user["user_id"],
            "kyc_notes": data.notes,
            "id_verified": True,
        }}
    )
    
    logger.info(f"KYC approved for user {user_id} by {current_user['user_id']}")
    
    return {
        "success": True,
        "user_id": user_id,
        "kyc_status": "verified",
    }

@admin_withdrawal_router.post("/kyc/{user_id}/reject")
async def admin_reject_kyc(
    user_id: str,
    reason: str = "Documents not acceptable",
    current_user: dict = Depends(get_current_user)
):
    """Reject KYC for a user (admin only)"""
    admin = await db.users.find_one({"user_id": current_user["user_id"]}, {"is_admin": 1})
    if not admin or not admin.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now = datetime.now(timezone.utc).isoformat()
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "kyc_status": "rejected",
            "kyc_rejected_at": now,
            "kyc_rejected_by": current_user["user_id"],
            "kyc_rejection_reason": reason,
        }}
    )
    
    logger.info(f"KYC rejected for user {user_id} by {current_user['user_id']}: {reason}")
    
    return {
        "success": True,
        "user_id": user_id,
        "kyc_status": "rejected",
    }

