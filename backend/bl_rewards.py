"""
Blendlink BL Coins Reward System
- Automatic rewards for content creation
- 24-hour privacy lock for rewarded content
- Downline activity bonuses (L1/L2)
- Diamond Leader bonus rates
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from enum import Enum

logger = logging.getLogger(__name__)

# ============== REWARD CONSTANTS ==============
class ContentReward(Enum):
    """BL coin rewards for content actions"""
    POST_VIDEO = 50
    POST_STORY = 50
    POST_MUSIC = 30
    POST_PHOTO = 20
    CREATE_EVENT = 20
    CREATE_GROUP = 40
    CREATE_PAGE = 40
    PAGE_SUBSCRIBE = 10  # Both subscriber and owner get this
    SHARE_POST = 10
    REACTION_GIVEN = 10
    REACTION_RECEIVED = 10
    FIRST_COMMENT = 10

# Downline bonus rates - Now determined by subscription tier
# These are used as fallback only; actual rates come from subscription_tiers.py
DOWNLINE_RATES = {
    "free": {"l1": 0.02, "l2": 0.01},      # 2% L1, 1% L2
    "bronze": {"l1": 0.03, "l2": 0.02},    # 3% L1, 2% L2
    "silver": {"l1": 0.03, "l2": 0.02},    # 3% L1, 2% L2
    "gold": {"l1": 0.03, "l2": 0.02},      # 3% L1, 2% L2
    "diamond": {"l1": 0.04, "l2": 0.03},   # 4% L1, 3% L2
    # Legacy mappings
    "regular": {"l1": 0.02, "l2": 0.01},   # Same as free
}

# Privacy lock duration (hours)
PRIVACY_LOCK_HOURS = 24


class RewardService:
    """Service for managing BL coin rewards"""
    
    def __init__(self, db):
        self.db = db
    
    async def award_content_reward(
        self,
        user_id: str,
        content_type: str,
        content_id: str,
        is_public: bool = True,
    ) -> Dict[str, Any]:
        """
        Award BL coins for creating content
        - Only public content gets rewards
        - Sets 24-hour privacy lock
        """
        if not is_public:
            return {
                "success": False,
                "reason": "Only public content receives BL rewards",
                "reward": 0
            }
        
        # Determine reward amount
        reward_map = {
            "video": ContentReward.POST_VIDEO.value,
            "story": ContentReward.POST_STORY.value,
            "music": ContentReward.POST_MUSIC.value,
            "photo": ContentReward.POST_PHOTO.value,
            "minted_photo": ContentReward.POST_PHOTO.value,
            "event": ContentReward.CREATE_EVENT.value,
            "group": ContentReward.CREATE_GROUP.value,
            "page": ContentReward.CREATE_PAGE.value,
        }
        
        reward_amount = reward_map.get(content_type, 0)
        if reward_amount == 0:
            return {"success": False, "reason": "Unknown content type", "reward": 0}
        
        # Check if already rewarded for this content
        existing = await self.db.content_rewards.find_one({
            "content_id": content_id,
            "content_type": content_type,
        })
        
        if existing:
            return {
                "success": False,
                "reason": "Already rewarded for this content",
                "reward": 0
            }
        
        # Award BL coins to user
        await self.db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"bl_coins": reward_amount}}
        )
        
        # Record the reward
        privacy_unlock_at = datetime.now(timezone.utc) + timedelta(hours=PRIVACY_LOCK_HOURS)
        await self.db.content_rewards.insert_one({
            "user_id": user_id,
            "content_type": content_type,
            "content_id": content_id,
            "reward_amount": reward_amount,
            "privacy_locked_until": privacy_unlock_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        # Record transaction
        from referral_system import record_transaction, TransactionType, Currency
        tx_type_map = {
            "video": TransactionType.POST_VIDEO,
            "story": TransactionType.POST_STORY,
            "music": TransactionType.POST_MUSIC,
            "photo": TransactionType.POST_PHOTO,
            "minted_photo": TransactionType.POST_PHOTO,
            "event": TransactionType.CREATE_EVENT,
            "group": TransactionType.CREATE_GROUP,
            "page": TransactionType.CREATE_PAGE,
        }
        
        await record_transaction(
            user_id=user_id,
            transaction_type=tx_type_map.get(content_type, TransactionType.POST_PHOTO),
            currency=Currency.BL,
            amount=reward_amount,
            reference_id=content_id,
            details={"content_type": content_type}
        )
        
        # Distribute downline bonuses
        await self._distribute_downline_bonus(user_id, reward_amount, content_type, content_id)
        
        logger.info(f"Awarded {reward_amount} BL to {user_id} for {content_type}")
        
        return {
            "success": True,
            "reward": reward_amount,
            "privacy_locked_until": privacy_unlock_at.isoformat(),
        }
    
    async def check_privacy_lock(self, content_type: str, content_id: str) -> Dict[str, Any]:
        """Check if content is still under privacy lock"""
        reward = await self.db.content_rewards.find_one({
            "content_id": content_id,
            "content_type": content_type,
        })
        
        if not reward:
            return {"locked": False, "can_change_privacy": True}
        
        lock_until = reward.get("privacy_locked_until")
        if lock_until:
            lock_time = datetime.fromisoformat(lock_until.replace("Z", "+00:00"))
            if datetime.now(timezone.utc) < lock_time:
                remaining = (lock_time - datetime.now(timezone.utc)).total_seconds()
                return {
                    "locked": True,
                    "can_change_privacy": False,
                    "locked_until": lock_until,
                    "remaining_seconds": remaining,
                    "remaining_hours": remaining / 3600,
                }
        
        return {"locked": False, "can_change_privacy": True}
    
    async def award_share_reward(self, user_id: str, post_id: str) -> Dict[str, Any]:
        """Award BL coins for sharing a post"""
        # Check if already rewarded for sharing this post
        existing = await self.db.share_rewards.find_one({
            "user_id": user_id,
            "post_id": post_id,
        })
        
        if existing:
            return {"success": False, "reason": "Already rewarded for sharing this post", "reward": 0}
        
        reward_amount = ContentReward.SHARE_POST.value
        
        # Award BL coins
        await self.db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"bl_coins": reward_amount}}
        )
        
        # Record the share reward
        await self.db.share_rewards.insert_one({
            "user_id": user_id,
            "post_id": post_id,
            "reward_amount": reward_amount,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        # Record transaction
        from referral_system import record_transaction, TransactionType, Currency
        await record_transaction(
            user_id=user_id,
            transaction_type=TransactionType.SHARE_POST,
            currency=Currency.BL,
            amount=reward_amount,
            reference_id=post_id,
            details={"type": "share"}
        )
        
        # Distribute downline bonuses
        await self._distribute_downline_bonus(user_id, reward_amount, "share", post_id)
        
        return {"success": True, "reward": reward_amount}
    
    async def award_page_subscription(
        self,
        subscriber_id: str,
        page_owner_id: str,
        page_id: str
    ) -> Dict[str, Any]:
        """Award BL coins to both subscriber and page owner"""
        reward_amount = ContentReward.PAGE_SUBSCRIBE.value
        
        # Check if already subscribed
        existing = await self.db.page_subscriptions.find_one({
            "subscriber_id": subscriber_id,
            "page_id": page_id,
        })
        
        if existing:
            return {"success": False, "reason": "Already subscribed", "reward": 0}
        
        # Award to subscriber
        await self.db.users.update_one(
            {"user_id": subscriber_id},
            {"$inc": {"bl_coins": reward_amount}}
        )
        
        # Award to page owner
        await self.db.users.update_one(
            {"user_id": page_owner_id},
            {"$inc": {"bl_coins": reward_amount}}
        )
        
        # Record subscription
        await self.db.page_subscriptions.insert_one({
            "subscriber_id": subscriber_id,
            "page_owner_id": page_owner_id,
            "page_id": page_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        
        # Record transactions
        from referral_system import record_transaction, TransactionType, Currency
        await record_transaction(
            user_id=subscriber_id,
            transaction_type=TransactionType.PAGE_SUBSCRIBE,
            currency=Currency.BL,
            amount=reward_amount,
            reference_id=page_id,
            details={"type": "subscriber"}
        )
        await record_transaction(
            user_id=page_owner_id,
            transaction_type=TransactionType.PAGE_SUBSCRIBE,
            currency=Currency.BL,
            amount=reward_amount,
            reference_id=page_id,
            details={"type": "owner", "subscriber": subscriber_id}
        )
        
        # Distribute downline bonuses for both
        await self._distribute_downline_bonus(subscriber_id, reward_amount, "page_subscribe", page_id)
        await self._distribute_downline_bonus(page_owner_id, reward_amount, "page_subscribe", page_id)
        
        return {
            "success": True,
            "subscriber_reward": reward_amount,
            "owner_reward": reward_amount,
        }
    
    async def _distribute_downline_bonus(
        self,
        user_id: str,
        bl_amount: int,
        activity_type: str,
        reference_id: str
    ) -> None:
        """
        Distribute downline bonuses to uplines based on their subscription tier.
        - L1 (direct upline): Rate based on their tier (2-4%)
        - L2 (upline's upline): Rate based on their tier (1-3%)
        """
        if bl_amount <= 0:
            return
        
        # Get user's referral chain
        user = await self.db.users.find_one(
            {"user_id": user_id},
            {"referred_by": 1}
        )
        
        if not user or not user.get("referred_by"):
            return
        
        # Get L1 (direct upline)
        l1_user = await self.db.users.find_one(
            {"user_id": user["referred_by"]},
            {"user_id": 1, "referred_by": 1, "subscription_tier": 1}
        )
        
        if not l1_user:
            return
        
        # Determine L1 rate based on subscription tier
        l1_tier = l1_user.get("subscription_tier", "free")
        l1_rates = DOWNLINE_RATES.get(l1_tier, DOWNLINE_RATES["free"])
        l1_rate = l1_rates["l1"]
        l1_bonus = round(bl_amount * l1_rate)
        
        if l1_bonus > 0:
            # Award L1 bonus
            await self.db.users.update_one(
                {"user_id": l1_user["user_id"]},
                {"$inc": {"bl_coins": l1_bonus}}
            )
            
            # Record transaction
            from referral_system import record_transaction, TransactionType, Currency
            await record_transaction(
                user_id=l1_user["user_id"],
                transaction_type=TransactionType.UPLINE_ACTIVITY_BONUS,
                currency=Currency.BL,
                amount=l1_bonus,
                reference_id=reference_id,
                details={
                    "level": 1,
                    "from_user": user_id,
                    "activity": activity_type,
                    "rate": l1_rate,
                    "tier": l1_tier,
                }
            )
            
            logger.info(f"L1 bonus: {l1_bonus} BL to {l1_user['user_id']} from {user_id} (tier: {l1_tier})")
        
        # Get L2 (upline's upline)
        if not l1_user.get("referred_by"):
            return
        
        l2_user = await self.db.users.find_one(
            {"user_id": l1_user["referred_by"]},
            {"user_id": 1, "subscription_tier": 1}
        )
        
        if not l2_user:
            return
        
        # Determine L2 rate based on subscription tier
        l2_tier = l2_user.get("subscription_tier", "free")
        l2_rates = DOWNLINE_RATES.get(l2_tier, DOWNLINE_RATES["free"])
        l2_rate = l2_rates["l2"]
        l2_bonus = round(bl_amount * l2_rate)
        
        if l2_bonus > 0:
            # Award L2 bonus
            await self.db.users.update_one(
                {"user_id": l2_user["user_id"]},
                {"$inc": {"bl_coins": l2_bonus}}
            )
            
            # Record transaction
            from referral_system import record_transaction, TransactionType, Currency
            await record_transaction(
                user_id=l2_user["user_id"],
                transaction_type=TransactionType.UPLINE_ACTIVITY_BONUS,
                currency=Currency.BL,
                amount=l2_bonus,
                reference_id=reference_id,
                details={
                    "level": 2,
                    "from_user": user_id,
                    "activity": activity_type,
                    "rate": l2_rate,
                    "tier": l2_tier,
                }
            )
            
            logger.info(f"L2 bonus: {l2_bonus} BL to {l2_user['user_id']} from {user_id} (tier: {l2_tier})")


# Initialize service
reward_service: Optional[RewardService] = None


def init_reward_service(db) -> RewardService:
    global reward_service
    reward_service = RewardService(db)
    return reward_service


def get_reward_service() -> RewardService:
    if not reward_service:
        raise RuntimeError("Reward service not initialized")
    return reward_service
