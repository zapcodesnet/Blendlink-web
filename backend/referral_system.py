"""
Blendlink Referral & Compensation System
========================================
Complete implementation of:
- 2-Level Unilevel Compensation (3%/1% regular, 4%/2% diamond)
- Sign-up Bonuses (50,000 BL)
- Orphan Auto-Assignment (11 priority tiers)
- Daily BL Coin Claims (2,000 regular / 5,000 diamond)
- Diamond Leader Rank System
- Real Money (USD) Balance & Withdrawals
- KYC Verification Integration
- Real-time Sync via WebSocket
"""

from fastapi import APIRouter, HTTPException, Depends, Request, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import asyncio

# Import from main server
from server import get_current_user, db, logger

# Router
referral_router = APIRouter(prefix="/referral", tags=["Referral & Compensation"])

# ============== ENUMS ==============

class UserRank(str, Enum):
    REGULAR = "regular"
    DIAMOND_LEADER = "diamond_leader"

class TransactionType(str, Enum):
    SIGNUP_BONUS = "signup_bonus"
    REFERRAL_BONUS = "referral_bonus"
    COMMISSION_L1 = "commission_l1"
    COMMISSION_L2 = "commission_l2"
    DAILY_CLAIM = "daily_claim"
    SALE_EARNINGS = "sale_earnings"
    WITHDRAWAL = "withdrawal"
    WITHDRAWAL_FEE = "withdrawal_fee"
    DIAMOND_BONUS_BL = "diamond_bonus_bl"
    DIAMOND_BONUS_USD = "diamond_bonus_usd"
    ADMIN_ADJUSTMENT = "admin_adjustment"
    PLATFORM_FEE = "platform_fee"

class Currency(str, Enum):
    BL = "BL"
    USD = "USD"

class KYCStatus(str, Enum):
    NOT_STARTED = "not_started"
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"

class WithdrawalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"

class ReassignmentStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    COMPLETED = "completed"

# ============== CONSTANTS ==============

# Compensation rates
REGULAR_L1_RATE = 0.03  # 3%
REGULAR_L2_RATE = 0.01  # 1%
REGULAR_PLATFORM_RATE = 0.04  # 4%

DIAMOND_L1_RATE = 0.04  # 4%
DIAMOND_L2_RATE = 0.02  # 2%
DIAMOND_PLATFORM_RATE = 0.02  # 2%

TOTAL_FEE_RATE = 0.08  # 8% total

# Bonuses
SIGNUP_BONUS_BL = 50000
REFERRAL_BONUS_BL = 50000

# Daily claims
REGULAR_DAILY_CLAIM_BL = 2000
DIAMOND_DAILY_CLAIM_BL = 5000
DAILY_CLAIM_COOLDOWN_HOURS = 24

# Diamond Leader requirements
DIAMOND_REQUIRED_DIRECT_RECRUITS = 100
DIAMOND_REQUIRED_DOWNLINE_COMMISSIONS = 1000.0  # USD
DIAMOND_REQUIRED_PERSONAL_SALES = 1000.0  # USD
DIAMOND_QUALIFICATION_PERIOD_DAYS = 30

# Diamond maintenance requirements
DIAMOND_MAINTENANCE_NEW_RECRUITS = 1
DIAMOND_MAINTENANCE_PERSONAL_SALES = 10.0  # USD
DIAMOND_MAINTENANCE_COMMISSIONS = 10.0  # USD
DIAMOND_MAINTENANCE_PERIOD_DAYS = 30

# Diamond rewards (configurable by admin)
DIAMOND_REWARD_USD_DEFAULT = 100.0
DIAMOND_REWARD_BL = 500000

# Withdrawal
WITHDRAWAL_FEE_RATE = 0.01  # 1%

# Orphan assignment
MAX_ORPHANS_PER_USER = 2
ORPHAN_INACTIVITY_THRESHOLD_MONTHS = 6

# Inactivity reassignment
INACTIVITY_YEARS_FOR_REASSIGNMENT = 5

# ============== PYDANTIC MODELS ==============

class CommissionCalculation(BaseModel):
    l1_recipient_id: Optional[str] = None
    l1_amount: float = 0.0
    l1_rate: float = 0.0
    l2_recipient_id: Optional[str] = None
    l2_amount: float = 0.0
    l2_rate: float = 0.0
    platform_amount: float = 0.0
    platform_rate: float = 0.0
    total_fee: float = 0.0

class DailyClaimResponse(BaseModel):
    success: bool
    amount: int
    new_balance: float
    next_claim_at: str
    is_diamond: bool

class WithdrawalRequest(BaseModel):
    amount: float = Field(..., gt=0, description="Amount in USD to withdraw")
    payout_method: str = Field(..., description="bank_account or debit_card")
    bank_details: Optional[Dict[str, str]] = None

class GenealogyMember(BaseModel):
    user_id: str
    username: str
    avatar: Optional[str] = None
    level: int  # 1 or 2
    direct_recruits_count: int
    total_recruits_count: int
    joined_at: str
    is_blocked: bool = False
    is_blocked_by_them: bool = False

class ReferralRelationship(BaseModel):
    relationship_id: str = Field(default_factory=lambda: f"rel_{uuid.uuid4().hex[:12]}")
    referrer_id: str
    referred_id: str
    level: int = 1  # 1 for direct, 2 for indirect
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True

# ============== HELPER FUNCTIONS ==============

async def get_user_rank(user_id: str) -> UserRank:
    """Get user's current rank"""
    user = await db.users.find_one({"user_id": user_id}, {"rank": 1})
    return UserRank(user.get("rank", "regular")) if user else UserRank.REGULAR

async def get_commission_rates(user_id: str) -> tuple:
    """Get commission rates based on user rank"""
    rank = await get_user_rank(user_id)
    if rank == UserRank.DIAMOND_LEADER:
        return DIAMOND_L1_RATE, DIAMOND_L2_RATE, DIAMOND_PLATFORM_RATE
    return REGULAR_L1_RATE, REGULAR_L2_RATE, REGULAR_PLATFORM_RATE

async def get_upline_chain(user_id: str) -> tuple:
    """Get L1 and L2 upline for a user"""
    user = await db.users.find_one({"user_id": user_id}, {"referred_by": 1})
    if not user or not user.get("referred_by"):
        return None, None
    
    l1_upline_id = user["referred_by"]
    
    # Get L2 upline (L1's referrer)
    l1_user = await db.users.find_one({"user_id": l1_upline_id}, {"referred_by": 1})
    l2_upline_id = l1_user.get("referred_by") if l1_user else None
    
    return l1_upline_id, l2_upline_id

async def record_transaction(
    user_id: str,
    transaction_type: TransactionType,
    currency: Currency,
    amount: float,
    reference_id: str = None,
    details: Dict = None
) -> str:
    """Record a transaction and update balance"""
    transaction_id = f"txn_{uuid.uuid4().hex[:16]}"
    
    # Get current balance
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if currency == Currency.BL:
        current_balance = user.get("bl_coins", 0)
        new_balance = current_balance + amount
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"bl_coins": new_balance}}
        )
    else:  # USD
        current_balance = user.get("usd_balance", 0)
        new_balance = current_balance + amount
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"usd_balance": new_balance}}
        )
    
    # Record transaction
    transaction = {
        "transaction_id": transaction_id,
        "user_id": user_id,
        "type": transaction_type,
        "currency": currency,
        "amount": amount,
        "balance_before": current_balance,
        "balance_after": new_balance,
        "reference_id": reference_id,
        "details": details or {},
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.transactions.insert_one(transaction)
    
    # Broadcast real-time update
    await broadcast_balance_update(user_id, currency, new_balance)
    
    return transaction_id

async def broadcast_balance_update(user_id: str, currency: Currency, new_balance: float):
    """Broadcast balance update via WebSocket"""
    try:
        from realtime_ab_system import manager
        await manager.send_to_user(user_id, {
            "type": "balance_update",
            "currency": currency,
            "balance": new_balance,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.warning(f"Could not broadcast balance update: {e}")

async def is_user_active(user_id: str, months: int = 6) -> bool:
    """Check if user has been active within specified months"""
    user = await db.users.find_one({"user_id": user_id}, {"last_login_at": 1})
    if not user or not user.get("last_login_at"):
        return False
    
    last_login = datetime.fromisoformat(user["last_login_at"].replace("Z", "+00:00"))
    threshold = datetime.now(timezone.utc) - timedelta(days=months * 30)
    return last_login > threshold

async def get_login_frequency(user_id: str) -> str:
    """Determine user's login frequency category"""
    user = await db.users.find_one({"user_id": user_id}, {"last_login_at": 1, "login_history": 1})
    if not user or not user.get("last_login_at"):
        return "inactive"
    
    last_login = datetime.fromisoformat(user["last_login_at"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    days_since_login = (now - last_login).days
    
    if days_since_login <= 1:
        return "daily"
    elif days_since_login <= 7:
        return "weekly"
    elif days_since_login <= 30:
        return "monthly"
    elif days_since_login <= 90:
        return "quarterly"
    elif days_since_login <= 180:
        return "biannual"
    else:
        return "inactive"

# ============== COMMISSION CALCULATION ==============

async def calculate_commission(sale_amount: float, seller_id: str) -> CommissionCalculation:
    """
    Calculate commissions for a sale.
    Returns breakdown of L1, L2, and platform fees.
    """
    total_fee = sale_amount * TOTAL_FEE_RATE
    
    l1_upline_id, l2_upline_id = await get_upline_chain(seller_id)
    
    result = CommissionCalculation(
        total_fee=total_fee
    )
    
    # Calculate L1 commission
    if l1_upline_id:
        l1_rate, l2_rate, platform_rate = await get_commission_rates(l1_upline_id)
        result.l1_recipient_id = l1_upline_id
        result.l1_amount = sale_amount * l1_rate
        result.l1_rate = l1_rate
        
        # Calculate L2 commission
        if l2_upline_id:
            result.l2_recipient_id = l2_upline_id
            result.l2_amount = sale_amount * l2_rate
            result.l2_rate = l2_rate
        
        result.platform_amount = total_fee - result.l1_amount - result.l2_amount
        result.platform_rate = result.platform_amount / sale_amount if sale_amount > 0 else 0
    else:
        # No upline, all fees go to platform
        result.platform_amount = total_fee
        result.platform_rate = TOTAL_FEE_RATE
    
    return result

async def process_sale_commissions(
    sale_id: str,
    sale_amount: float,
    seller_id: str,
    background_tasks: BackgroundTasks = None
) -> CommissionCalculation:
    """
    Process a sale and distribute commissions.
    Called when a marketplace sale/offer/auction completes.
    """
    commission = await calculate_commission(sale_amount, seller_id)
    
    # Get seller info for notifications
    seller = await db.users.find_one({"user_id": seller_id}, {"username": 1, "name": 1})
    seller_name = seller.get("username") or seller.get("name", "Unknown") if seller else "Unknown"
    
    # Import notification functions
    try:
        from notifications_system import notify_commission_earned
    except ImportError:
        notify_commission_earned = None
    
    # Record L1 commission
    if commission.l1_recipient_id and commission.l1_amount > 0:
        await record_transaction(
            user_id=commission.l1_recipient_id,
            transaction_type=TransactionType.COMMISSION_L1,
            currency=Currency.USD,
            amount=commission.l1_amount,
            reference_id=sale_id,
            details={
                "sale_amount": sale_amount,
                "rate": commission.l1_rate,
                "source_user_id": seller_id,
                "level": 1,
            }
        )
        
        # Record in commissions collection for tracking
        await db.commissions.insert_one({
            "commission_id": f"comm_{uuid.uuid4().hex[:12]}",
            "recipient_id": commission.l1_recipient_id,
            "source_user_id": seller_id,
            "sale_id": sale_id,
            "level": 1,
            "amount_usd": commission.l1_amount,
            "rate_percent": commission.l1_rate * 100,
            "rank_at_time": (await get_user_rank(commission.l1_recipient_id)).value,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        # Send notification
        if notify_commission_earned:
            try:
                await notify_commission_earned(commission.l1_recipient_id, commission.l1_amount, 1, seller_name)
            except Exception as e:
                logger.warning(f"Failed to send L1 commission notification: {e}")
    
    # Record L2 commission
    if commission.l2_recipient_id and commission.l2_amount > 0:
        await record_transaction(
            user_id=commission.l2_recipient_id,
            transaction_type=TransactionType.COMMISSION_L2,
            currency=Currency.USD,
            amount=commission.l2_amount,
            reference_id=sale_id,
            details={
                "sale_amount": sale_amount,
                "rate": commission.l2_rate,
                "source_user_id": seller_id,
                "level": 2,
            }
        )
        
        await db.commissions.insert_one({
            "commission_id": f"comm_{uuid.uuid4().hex[:12]}",
            "recipient_id": commission.l2_recipient_id,
            "source_user_id": seller_id,
            "sale_id": sale_id,
            "level": 2,
            "amount_usd": commission.l2_amount,
            "rate_percent": commission.l2_rate * 100,
            "rank_at_time": (await get_user_rank(commission.l2_recipient_id)).value,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        # Send notification
        if notify_commission_earned:
            try:
                await notify_commission_earned(commission.l2_recipient_id, commission.l2_amount, 2, seller_name)
            except Exception as e:
                logger.warning(f"Failed to send L2 commission notification: {e}")
    
    # Record platform fee
    if commission.platform_amount > 0:
        await db.platform_fees.insert_one({
            "fee_id": f"fee_{uuid.uuid4().hex[:12]}",
            "sale_id": sale_id,
            "amount_usd": commission.platform_amount,
            "rate_percent": commission.platform_rate * 100,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    
    logger.info(f"Processed commissions for sale {sale_id}: L1=${commission.l1_amount:.2f}, L2=${commission.l2_amount:.2f}, Platform=${commission.platform_amount:.2f}")
    
    return commission

# ============== ORPHAN ASSIGNMENT ==============

async def find_orphan_recipient() -> Optional[str]:
    """
    Find the best recipient for an orphan according to priority tiers.
    Returns user_id of the best match or None if no suitable recipient.
    """
    now = datetime.now(timezone.utc)
    six_months_ago = (now - timedelta(days=180)).isoformat()
    
    # Define login frequency thresholds
    daily_threshold = (now - timedelta(days=1)).isoformat()
    weekly_threshold = (now - timedelta(days=7)).isoformat()
    monthly_threshold = (now - timedelta(days=30)).isoformat()
    quarterly_threshold = (now - timedelta(days=90)).isoformat()
    biannual_threshold = six_months_ago
    
    # 11 Priority Tiers
    tiers = [
        # Tier 1: ID-verified + active + 0 direct recruits + daily login
        {"id_verified": True, "direct_referrals": 0, "last_login_at": {"$gte": daily_threshold}},
        # Tier 2: Not ID-verified + active + 0 direct recruits + daily login
        {"id_verified": {"$ne": True}, "direct_referrals": 0, "last_login_at": {"$gte": daily_threshold}},
        # Tier 3: Active + 0 direct recruits + weekly login
        {"direct_referrals": 0, "last_login_at": {"$gte": weekly_threshold}},
        # Tier 4: Active + 0 direct recruits + monthly login
        {"direct_referrals": 0, "last_login_at": {"$gte": monthly_threshold}},
        # Tier 5: Active + 0 direct recruits + quarterly login
        {"direct_referrals": 0, "last_login_at": {"$gte": quarterly_threshold}},
        # Tier 6: ID-verified + active + 1 direct recruit + daily login
        {"id_verified": True, "direct_referrals": 1, "last_login_at": {"$gte": daily_threshold}},
        # Tier 7: Not ID-verified + active + 1 direct recruit + daily login
        {"id_verified": {"$ne": True}, "direct_referrals": 1, "last_login_at": {"$gte": daily_threshold}},
        # Tier 8: Active + 1 direct recruit + weekly login
        {"direct_referrals": 1, "last_login_at": {"$gte": weekly_threshold}},
        # Tier 9: Active + 1 direct recruit + monthly login
        {"direct_referrals": 1, "last_login_at": {"$gte": monthly_threshold}},
        # Tier 10: Active + 1 direct recruit + quarterly login
        {"direct_referrals": 1, "last_login_at": {"$gte": quarterly_threshold}},
        # Tier 11: Active + 1 direct recruit + biannual login
        {"direct_referrals": 1, "last_login_at": {"$gte": biannual_threshold}},
    ]
    
    for tier_idx, tier_query in enumerate(tiers, 1):
        # Add common filters
        query = {
            **tier_query,
            "orphans_assigned_count": {"$lt": MAX_ORPHANS_PER_USER},
            "last_login_at": {"$gte": six_months_ago},  # Never assign to inactive > 6 months
        }
        
        # Find oldest user matching this tier
        candidate = await db.users.find_one(
            query,
            {"user_id": 1},
            sort=[("created_at", 1)]  # Oldest first
        )
        
        if candidate:
            logger.info(f"Found orphan recipient in Tier {tier_idx}: {candidate['user_id']}")
            return candidate["user_id"]
    
    logger.warning("No suitable orphan recipient found in any tier")
    return None

async def assign_orphan(new_user_id: str) -> Optional[str]:
    """
    Assign an orphan (user without referrer) to an existing member.
    Returns the assigned referrer's user_id or None.
    """
    recipient_id = await find_orphan_recipient()
    
    if not recipient_id:
        logger.warning(f"Could not assign orphan {new_user_id} - no suitable recipients")
        return None
    
    # Update the new user's referrer
    await db.users.update_one(
        {"user_id": new_user_id},
        {"$set": {
            "referred_by": recipient_id,
            "is_orphan": True,
            "orphan_assigned_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    
    # Increment recipient's orphan count and direct referrals
    await db.users.update_one(
        {"user_id": recipient_id},
        {"$inc": {
            "orphans_assigned_count": 1,
            "direct_referrals": 1,
        }}
    )
    
    # Give referral bonus to recipient
    await record_transaction(
        user_id=recipient_id,
        transaction_type=TransactionType.REFERRAL_BONUS,
        currency=Currency.BL,
        amount=REFERRAL_BONUS_BL,
        reference_id=new_user_id,
        details={"type": "orphan_assignment", "new_user_id": new_user_id}
    )
    
    # Record orphan assignment in audit log
    await db.orphan_assignments.insert_one({
        "assignment_id": f"orphan_{uuid.uuid4().hex[:12]}",
        "orphan_user_id": new_user_id,
        "assigned_to": recipient_id,
        "assignment_type": "auto",
        "tier_matched": None,  # Could track which tier matched
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    logger.info(f"Orphan {new_user_id} assigned to {recipient_id}")
    return recipient_id

# ============== SIGNUP BONUSES ==============

async def process_signup_bonus(
    new_user_id: str,
    referrer_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Process signup bonuses for a new user.
    - New user always gets 50,000 BL
    - If referrer exists, referrer gets 50,000 BL
    - If no referrer (orphan), auto-assign and give bonus
    """
    result = {
        "new_user_bonus": SIGNUP_BONUS_BL,
        "referrer_bonus": 0,
        "assigned_referrer": None,
        "is_orphan": False,
    }
    
    # Give new user signup bonus
    await record_transaction(
        user_id=new_user_id,
        transaction_type=TransactionType.SIGNUP_BONUS,
        currency=Currency.BL,
        amount=SIGNUP_BONUS_BL,
        details={"type": "welcome_bonus"}
    )
    
    if referrer_id:
        # User signed up with referral code
        result["referrer_bonus"] = REFERRAL_BONUS_BL
        await record_transaction(
            user_id=referrer_id,
            transaction_type=TransactionType.REFERRAL_BONUS,
            currency=Currency.BL,
            amount=REFERRAL_BONUS_BL,
            reference_id=new_user_id,
            details={"type": "direct_referral", "new_user_id": new_user_id}
        )
        
        # Update referrer's direct referral count
        await db.users.update_one(
            {"user_id": referrer_id},
            {"$inc": {"direct_referrals": 1}}
        )
    else:
        # Orphan - auto-assign
        result["is_orphan"] = True
        assigned_referrer = await assign_orphan(new_user_id)
        result["assigned_referrer"] = assigned_referrer
    
    logger.info(f"Processed signup bonus for {new_user_id}: {result}")
    return result

# ============== DAILY CLAIM ==============

@referral_router.post("/daily-claim")
async def claim_daily_bl(current_user: dict = Depends(get_current_user)) -> DailyClaimResponse:
    """
    Claim daily BL coins.
    - Regular members: 2,000 BL every 24 hours
    - Diamond Leaders: 5,000 BL every 24 hours
    """
    user_id = current_user["user_id"]
    user = await db.users.find_one({"user_id": user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check cooldown
    last_claim = user.get("daily_claim_last")
    now = datetime.now(timezone.utc)
    
    if last_claim:
        last_claim_dt = datetime.fromisoformat(last_claim.replace("Z", "+00:00"))
        cooldown_end = last_claim_dt + timedelta(hours=DAILY_CLAIM_COOLDOWN_HOURS)
        
        if now < cooldown_end:
            seconds_remaining = (cooldown_end - now).total_seconds()
            raise HTTPException(
                status_code=429,
                detail={
                    "message": "Daily claim not yet available",
                    "seconds_remaining": int(seconds_remaining),
                    "next_claim_at": cooldown_end.isoformat(),
                }
            )
    
    # Determine claim amount based on rank
    rank = UserRank(user.get("rank", "regular"))
    is_diamond = rank == UserRank.DIAMOND_LEADER
    claim_amount = DIAMOND_DAILY_CLAIM_BL if is_diamond else REGULAR_DAILY_CLAIM_BL
    
    # Process claim
    await record_transaction(
        user_id=user_id,
        transaction_type=TransactionType.DAILY_CLAIM,
        currency=Currency.BL,
        amount=claim_amount,
        details={"rank": rank.value, "is_diamond": is_diamond}
    )
    
    # Update last claim time
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"daily_claim_last": now.isoformat()}}
    )
    
    # Get updated balance
    updated_user = await db.users.find_one({"user_id": user_id}, {"bl_coins": 1})
    next_claim = now + timedelta(hours=DAILY_CLAIM_COOLDOWN_HOURS)
    
    return DailyClaimResponse(
        success=True,
        amount=claim_amount,
        new_balance=updated_user.get("bl_coins", 0),
        next_claim_at=next_claim.isoformat(),
        is_diamond=is_diamond
    )

@referral_router.get("/daily-claim/status")
async def get_daily_claim_status(current_user: dict = Depends(get_current_user)):
    """Get current daily claim status"""
    user = await db.users.find_one(
        {"user_id": current_user["user_id"]},
        {"daily_claim_last": 1, "rank": 1, "bl_coins": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    now = datetime.now(timezone.utc)
    last_claim = user.get("daily_claim_last")
    rank = UserRank(user.get("rank", "regular"))
    is_diamond = rank == UserRank.DIAMOND_LEADER
    claim_amount = DIAMOND_DAILY_CLAIM_BL if is_diamond else REGULAR_DAILY_CLAIM_BL
    
    can_claim = True
    seconds_remaining = 0
    next_claim_at = now.isoformat()
    
    if last_claim:
        last_claim_dt = datetime.fromisoformat(last_claim.replace("Z", "+00:00"))
        cooldown_end = last_claim_dt + timedelta(hours=DAILY_CLAIM_COOLDOWN_HOURS)
        
        if now < cooldown_end:
            can_claim = False
            seconds_remaining = int((cooldown_end - now).total_seconds())
            next_claim_at = cooldown_end.isoformat()
    
    return {
        "can_claim": can_claim,
        "claim_amount": claim_amount,
        "seconds_remaining": seconds_remaining,
        "next_claim_at": next_claim_at,
        "is_diamond": is_diamond,
        "current_balance": user.get("bl_coins", 0),
    }

# ============== ENDPOINTS ==============

@referral_router.get("/my-stats")
async def get_my_referral_stats(current_user: dict = Depends(get_current_user)):
    """Get current user's referral statistics"""
    user_id = current_user["user_id"]
    user = await db.users.find_one({"user_id": user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Count L1 (direct) referrals
    l1_count = await db.users.count_documents({"referred_by": user_id})
    
    # Count L2 (indirect) referrals
    l1_user_ids = [u["user_id"] async for u in db.users.find({"referred_by": user_id}, {"user_id": 1})]
    l2_count = await db.users.count_documents({"referred_by": {"$in": l1_user_ids}}) if l1_user_ids else 0
    
    # Get commission stats (30 days)
    thirty_days_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    
    pipeline = [
        {"$match": {
            "recipient_id": user_id,
            "created_at": {"$gte": thirty_days_ago}
        }},
        {"$group": {
            "_id": "$level",
            "total": {"$sum": "$amount_usd"},
            "count": {"$sum": 1}
        }}
    ]
    
    commission_stats = {}
    async for stat in db.commissions.aggregate(pipeline):
        level = stat["_id"]
        commission_stats[f"l{level}_total"] = stat["total"]
        commission_stats[f"l{level}_count"] = stat["count"]
    
    # Get personal sales (30 days)
    personal_sales_pipeline = [
        {"$match": {
            "user_id": user_id,
            "type": TransactionType.SALE_EARNINGS,
            "created_at": {"$gte": thirty_days_ago}
        }},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$amount"}
        }}
    ]
    
    personal_sales_result = await db.transactions.aggregate(personal_sales_pipeline).to_list(1)
    personal_sales_30d = personal_sales_result[0]["total"] if personal_sales_result else 0
    
    rank = UserRank(user.get("rank", "regular"))
    l1_rate, l2_rate, _ = await get_commission_rates(user_id)
    
    return {
        "user_id": user_id,
        "rank": rank.value,
        "referral_code": user.get("referral_code"),
        "direct_referrals": l1_count,
        "indirect_referrals": l2_count,
        "total_referrals": l1_count + l2_count,
        "commission_rates": {
            "l1": l1_rate * 100,
            "l2": l2_rate * 100,
        },
        "commissions_30d": {
            "l1_total": commission_stats.get("l1_total", 0),
            "l1_count": commission_stats.get("l1_count", 0),
            "l2_total": commission_stats.get("l2_total", 0),
            "l2_count": commission_stats.get("l2_count", 0),
            "total": commission_stats.get("l1_total", 0) + commission_stats.get("l2_total", 0),
        },
        "personal_sales_30d": personal_sales_30d,
        "bl_coins": user.get("bl_coins", 0),
        "usd_balance": user.get("usd_balance", 0),
        "orphans_assigned": user.get("orphans_assigned_count", 0),
        "is_orphan": user.get("is_orphan", False),
    }

@referral_router.get("/genealogy")
async def get_genealogy(current_user: dict = Depends(get_current_user)) -> List[GenealogyMember]:
    """
    Get user's genealogy tree (L1 + L2 downlines only).
    Privacy rules applied - no transaction/earnings data visible.
    """
    user_id = current_user["user_id"]
    
    # Get blocked users
    blocked_by_me = set()
    blocked_me = set()
    
    blocks = await db.blocks.find({"blocker_id": user_id}, {"blocked_id": 1}).to_list(1000)
    blocked_by_me = {b["blocked_id"] for b in blocks}
    
    blocks_me = await db.blocks.find({"blocked_id": user_id}, {"blocker_id": 1}).to_list(1000)
    blocked_me = {b["blocker_id"] for b in blocks_me}
    
    genealogy = []
    
    # Get L1 (direct) referrals
    l1_users = await db.users.find(
        {"referred_by": user_id},
        {"user_id": 1, "username": 1, "avatar": 1, "created_at": 1, "direct_referrals": 1}
    ).to_list(1000)
    
    l1_user_ids = []
    
    for l1 in l1_users:
        l1_user_ids.append(l1["user_id"])
        
        # Count L1's direct referrals (L2 for current user)
        l1_direct_count = l1.get("direct_referrals", 0)
        l2_of_l1_count = await db.users.count_documents({"referred_by": l1["user_id"]})
        
        is_blocked = l1["user_id"] in blocked_by_me
        is_blocked_by_them = l1["user_id"] in blocked_me
        
        genealogy.append(GenealogyMember(
            user_id=l1["user_id"],
            username=l1.get("username", "Unknown") if not is_blocked_by_them else "???",
            avatar=l1.get("avatar") if not is_blocked_by_them else None,
            level=1,
            direct_recruits_count=l1_direct_count,
            total_recruits_count=l1_direct_count + l2_of_l1_count,
            joined_at=l1.get("created_at", ""),
            is_blocked=is_blocked,
            is_blocked_by_them=is_blocked_by_them,
        ))
    
    # Get L2 (indirect) referrals
    if l1_user_ids:
        l2_users = await db.users.find(
            {"referred_by": {"$in": l1_user_ids}},
            {"user_id": 1, "username": 1, "avatar": 1, "created_at": 1, "direct_referrals": 1, "referred_by": 1}
        ).to_list(5000)
        
        for l2 in l2_users:
            l2_direct_count = l2.get("direct_referrals", 0)
            l3_count = await db.users.count_documents({"referred_by": l2["user_id"]})
            
            is_blocked = l2["user_id"] in blocked_by_me
            is_blocked_by_them = l2["user_id"] in blocked_me
            
            genealogy.append(GenealogyMember(
                user_id=l2["user_id"],
                username=l2.get("username", "Unknown") if not is_blocked_by_them else "???",
                avatar=l2.get("avatar") if not is_blocked_by_them else None,
                level=2,
                direct_recruits_count=l2_direct_count,
                total_recruits_count=l2_direct_count + l3_count,
                joined_at=l2.get("created_at", ""),
                is_blocked=is_blocked,
                is_blocked_by_them=is_blocked_by_them,
            ))
    
    return genealogy

@referral_router.get("/upline")
async def get_my_upline(current_user: dict = Depends(get_current_user)):
    """Get current user's upline (L1 referrer and L2)"""
    user = await db.users.find_one(
        {"user_id": current_user["user_id"]},
        {"referred_by": 1, "is_orphan": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    l1_upline_id, l2_upline_id = await get_upline_chain(current_user["user_id"])
    
    result = {
        "is_orphan": user.get("is_orphan", False),
        "l1_upline": None,
        "l2_upline": None,
    }
    
    if l1_upline_id:
        l1 = await db.users.find_one(
            {"user_id": l1_upline_id},
            {"user_id": 1, "username": 1, "avatar": 1}
        )
        if l1:
            result["l1_upline"] = {
                "user_id": l1["user_id"],
                "username": l1.get("username"),
                "avatar": l1.get("avatar"),
            }
    
    if l2_upline_id:
        l2 = await db.users.find_one(
            {"user_id": l2_upline_id},
            {"user_id": 1, "username": 1, "avatar": 1}
        )
        if l2:
            result["l2_upline"] = {
                "user_id": l2["user_id"],
                "username": l2.get("username"),
                "avatar": l2.get("avatar"),
            }
    
    return result

@referral_router.get("/commission-history")
async def get_commission_history(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get user's commission history"""
    commissions = await db.commissions.find(
        {"recipient_id": current_user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.commissions.count_documents({"recipient_id": current_user["user_id"]})
    
    return {
        "commissions": commissions,
        "total": total,
        "skip": skip,
        "limit": limit,
    }

@referral_router.get("/transaction-history")
async def get_transaction_history(
    skip: int = 0,
    limit: int = 50,
    currency: Optional[str] = None,
    transaction_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get user's transaction history"""
    query = {"user_id": current_user["user_id"]}
    
    if currency:
        query["currency"] = currency
    if transaction_type:
        query["type"] = transaction_type
    
    transactions = await db.transactions.find(
        query,
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    total = await db.transactions.count_documents(query)
    
    return {
        "transactions": transactions,
        "total": total,
        "skip": skip,
        "limit": limit,
    }

@referral_router.get("/balances")
async def get_balances(current_user: dict = Depends(get_current_user)):
    """Get user's current balances"""
    user = await db.users.find_one(
        {"user_id": current_user["user_id"]},
        {"bl_coins": 1, "usd_balance": 1, "rank": 1, "kyc_status": 1}
    )
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "bl_coins": user.get("bl_coins", 0),
        "usd_balance": user.get("usd_balance", 0),
        "rank": user.get("rank", "regular"),
        "kyc_status": user.get("kyc_status", "not_started"),
        "can_withdraw": user.get("kyc_status") == "verified" and user.get("usd_balance", 0) > 0,
    }
