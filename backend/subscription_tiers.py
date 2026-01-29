"""
Blendlink Subscription Tiers System
- Monthly subscription plans (Bronze $4.99, Silver $9.99, Gold $14.99, Platinum $24.99)
- Daily BL coin bonuses (15K, 35K, 80K, 200K)
- Increased minting limits (20, 50, 100, unlimited)
- XP multipliers (x2, x3, x4, x5)
- Stripe integration for payments
"""

import os
import uuid
import stripe
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException, Depends, Request
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Initialize Stripe
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY")

# ============== SUBSCRIPTION TIERS ==============

SUBSCRIPTION_TIERS = {
    "free": {
        "name": "Free",
        "price_monthly": 0,
        "stripe_price_id": None,
        "daily_mint_limit": 3,
        "daily_bl_bonus": 0,
        "xp_multiplier": 1,
        "bonus_streak_multiplier": 1.0,
        "marketplace_fee_discount": 0,
        "stamina_regen_boost": 1.0,
        "matchmaking_priority": 0,
        "can_create_tournaments": False,
        "exclusive_badges": [],
        "features": [
            "3 photo mints per day",
            "1x XP per round",
            "Basic matchmaking",
            "Standard marketplace fees (8%)"
        ]
    },
    "bronze": {
        "name": "Bronze",
        "price_monthly": 4.99,
        "stripe_price_id": os.environ.get("STRIPE_BRONZE_PRICE_ID"),
        "daily_mint_limit": 20,
        "daily_bl_bonus": 15_000,
        "xp_multiplier": 2,
        "bonus_streak_multiplier": 1.25,
        "marketplace_fee_discount": 1,  # 7% instead of 8%
        "stamina_regen_boost": 1.25,
        "matchmaking_priority": 1,
        "can_create_tournaments": False,
        "exclusive_badges": ["bronze_supporter"],
        "features": [
            "20 photo mints per day",
            "15,000 BL daily bonus",
            "2x XP per round",
            "Priority matchmaking",
            "7% marketplace fee",
            "Bronze supporter badge"
        ]
    },
    "silver": {
        "name": "Silver",
        "price_monthly": 9.99,
        "stripe_price_id": os.environ.get("STRIPE_SILVER_PRICE_ID"),
        "daily_mint_limit": 50,
        "daily_bl_bonus": 35_000,
        "xp_multiplier": 3,
        "bonus_streak_multiplier": 1.5,
        "marketplace_fee_discount": 2,  # 6% instead of 8%
        "stamina_regen_boost": 1.5,
        "matchmaking_priority": 2,
        "can_create_tournaments": True,
        "exclusive_badges": ["silver_supporter", "tournament_host"],
        "features": [
            "50 photo mints per day",
            "35,000 BL daily bonus",
            "3x XP per round",
            "VIP matchmaking queue",
            "6% marketplace fee",
            "Create tournaments",
            "Silver & Tournament badges"
        ]
    },
    "gold": {
        "name": "Gold",
        "price_monthly": 14.99,
        "stripe_price_id": os.environ.get("STRIPE_GOLD_PRICE_ID"),
        "daily_mint_limit": 100,
        "daily_bl_bonus": 80_000,
        "xp_multiplier": 4,
        "bonus_streak_multiplier": 1.75,
        "marketplace_fee_discount": 3,  # 5% instead of 8%
        "stamina_regen_boost": 1.75,
        "matchmaking_priority": 3,
        "can_create_tournaments": True,
        "exclusive_badges": ["gold_supporter", "tournament_host", "vip"],
        "features": [
            "100 photo mints per day",
            "80,000 BL daily bonus",
            "4x XP per round",
            "VIP matchmaking queue",
            "5% marketplace fee",
            "Create tournaments",
            "Gold, Tournament & VIP badges"
        ]
    },
    "platinum": {
        "name": "Platinum",
        "price_monthly": 24.99,
        "stripe_price_id": os.environ.get("STRIPE_PLATINUM_PRICE_ID"),
        "daily_mint_limit": 999999,  # Unlimited
        "daily_bl_bonus": 200_000,
        "xp_multiplier": 5,
        "bonus_streak_multiplier": 2.0,
        "marketplace_fee_discount": 4,  # 4% instead of 8%
        "stamina_regen_boost": 2.0,
        "matchmaking_priority": 4,
        "can_create_tournaments": True,
        "exclusive_badges": ["platinum_supporter", "tournament_host", "vip", "elite"],
        "features": [
            "Unlimited photo mints",
            "200,000 BL daily bonus",
            "5x XP per round",
            "Elite matchmaking queue",
            "4% marketplace fee",
            "Create unlimited tournaments",
            "All exclusive badges"
        ]
    }
}

# Legacy tier mapping for backward compatibility
LEGACY_TIER_MAP = {
    "basic": "bronze",
    "premium": "silver",
}

# ============== RANKED TIERS ==============

RANKED_TIERS = {
    "bronze": {
        "name": "Bronze",
        "min_rating": 0,
        "max_rating": 999,
        "icon": "🥉",
        "color": "#CD7F32",
        "season_rewards": {
            "bl_coins": 100,
            "exclusive_badge": "bronze_s1"
        }
    },
    "silver": {
        "name": "Silver",
        "min_rating": 1000,
        "max_rating": 1499,
        "icon": "🥈",
        "color": "#C0C0C0",
        "season_rewards": {
            "bl_coins": 300,
            "exclusive_badge": "silver_s1"
        }
    },
    "gold": {
        "name": "Gold",
        "min_rating": 1500,
        "max_rating": 1999,
        "icon": "🥇",
        "color": "#FFD700",
        "season_rewards": {
            "bl_coins": 500,
            "exclusive_badge": "gold_s1"
        }
    },
    "platinum": {
        "name": "Platinum",
        "min_rating": 2000,
        "max_rating": 2499,
        "icon": "💎",
        "color": "#E5E4E2",
        "season_rewards": {
            "bl_coins": 1000,
            "exclusive_badge": "platinum_s1"
        }
    },
    "diamond": {
        "name": "Diamond",
        "min_rating": 2500,
        "max_rating": 2999,
        "icon": "💠",
        "color": "#B9F2FF",
        "season_rewards": {
            "bl_coins": 2000,
            "exclusive_badge": "diamond_s1"
        }
    },
    "master": {
        "name": "Master",
        "min_rating": 3000,
        "max_rating": 99999,
        "icon": "👑",
        "color": "#9932CC",
        "season_rewards": {
            "bl_coins": 5000,
            "exclusive_badge": "master_s1"
        }
    }
}


# ============== MODELS ==============

class Subscription(BaseModel):
    """User subscription record"""
    subscription_id: str = Field(default_factory=lambda: f"sub_{uuid.uuid4().hex[:12]}")
    user_id: str
    tier: str = "free"
    stripe_subscription_id: Optional[str] = None
    stripe_customer_id: Optional[str] = None
    
    # Status
    status: str = "active"  # active, canceled, past_due
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    
    # Daily bonus tracking
    last_bonus_claimed: Optional[datetime] = None
    bonus_streak: int = 0
    total_bl_earned: int = 0
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RankedProfile(BaseModel):
    """User's ranked matchmaking profile"""
    user_id: str
    
    # Rating (ELO-like system)
    rating: int = 1000
    peak_rating: int = 1000
    
    # Current tier
    tier: str = "bronze"
    
    # Season stats
    season_wins: int = 0
    season_losses: int = 0
    season_games: int = 0
    
    # Lifetime stats
    total_wins: int = 0
    total_losses: int = 0
    total_games: int = 0
    
    # Streak
    current_streak: int = 0
    best_streak: int = 0
    
    # Last updated
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Tournament(BaseModel):
    """Tournament configuration"""
    tournament_id: str = Field(default_factory=lambda: f"tourney_{uuid.uuid4().hex[:12]}")
    creator_id: str
    name: str
    description: str = ""
    
    # Settings
    max_participants: int = 16
    entry_fee: int = 0  # BL coins
    prize_pool: int = 0
    
    # Format
    format: str = "single_elimination"  # single_elimination, double_elimination, swiss
    rounds: int = 4
    
    # Schedule
    registration_start: datetime
    registration_end: datetime
    start_time: datetime
    
    # Participants
    participants: List[str] = Field(default_factory=list)
    bracket: Dict[str, Any] = Field(default_factory=dict)
    
    # Status
    status: str = "registration"  # registration, in_progress, completed, canceled
    winner_id: Optional[str] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ============== SUBSCRIPTION SERVICE ==============

class SubscriptionService:
    """Service for managing subscriptions"""
    
    def __init__(self, db):
        self.db = db
    
    async def get_subscription(self, user_id: str) -> Dict[str, Any]:
        """Get user's current subscription"""
        sub = await self.db.subscriptions.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        
        if not sub:
            # Create free tier subscription
            sub = Subscription(user_id=user_id, tier="free").model_dump()
            sub["created_at"] = sub["created_at"].isoformat()
            sub["updated_at"] = sub["updated_at"].isoformat()
            await self.db.subscriptions.insert_one(sub)
            # Re-fetch without _id
            sub = await self.db.subscriptions.find_one(
                {"user_id": user_id},
                {"_id": 0}
            )
        
        # Add tier details
        tier_info = SUBSCRIPTION_TIERS.get(sub.get("tier", "free"), SUBSCRIPTION_TIERS["free"])
        sub["tier_details"] = tier_info
        
        return sub
    
    async def create_checkout_session(self, user_id: str, tier: str, success_url: str, cancel_url: str) -> Dict[str, Any]:
        """Create Stripe checkout session for subscription"""
        if tier not in ["basic", "premium"]:
            raise HTTPException(status_code=400, detail="Invalid subscription tier")
        
        tier_info = SUBSCRIPTION_TIERS[tier]
        price_id = tier_info.get("stripe_price_id")
        
        if not price_id:
            raise HTTPException(status_code=400, detail="Stripe not configured for this tier")
        
        # Get or create Stripe customer
        user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        sub = await self.get_subscription(user_id)
        customer_id = sub.get("stripe_customer_id")
        
        if not customer_id:
            # Create new Stripe customer
            customer = stripe.Customer.create(
                email=user.get("email"),
                metadata={"user_id": user_id}
            )
            customer_id = customer.id
            
            # Save customer ID
            await self.db.subscriptions.update_one(
                {"user_id": user_id},
                {"$set": {"stripe_customer_id": customer_id}}
            )
        
        # Create checkout session
        session = stripe.checkout.Session.create(
            customer=customer_id,
            mode="subscription",
            payment_method_types=["card"],
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "user_id": user_id,
                "tier": tier
            }
        )
        
        return {
            "checkout_url": session.url,
            "session_id": session.id
        }
    
    async def handle_webhook(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """Handle Stripe webhook events"""
        event_type = event.get("type")
        data = event.get("data", {}).get("object", {})
        
        if event_type == "checkout.session.completed":
            # Subscription purchased
            user_id = data.get("metadata", {}).get("user_id")
            tier = data.get("metadata", {}).get("tier")
            subscription_id = data.get("subscription")
            
            if user_id and tier:
                await self._activate_subscription(user_id, tier, subscription_id)
                return {"status": "subscription_activated", "user_id": user_id, "tier": tier}
        
        elif event_type == "customer.subscription.updated":
            # Subscription updated
            customer_id = data.get("customer")
            status = data.get("status")
            
            sub = await self.db.subscriptions.find_one({"stripe_customer_id": customer_id})
            if sub:
                await self.db.subscriptions.update_one(
                    {"stripe_customer_id": customer_id},
                    {"$set": {
                        "status": status,
                        "current_period_end": datetime.fromtimestamp(data.get("current_period_end", 0), tz=timezone.utc).isoformat()
                    }}
                )
                return {"status": "subscription_updated"}
        
        elif event_type == "customer.subscription.deleted":
            # Subscription canceled
            customer_id = data.get("customer")
            
            sub = await self.db.subscriptions.find_one({"stripe_customer_id": customer_id})
            if sub:
                await self._deactivate_subscription(sub["user_id"])
                return {"status": "subscription_canceled"}
        
        return {"status": "ignored"}
    
    async def _activate_subscription(self, user_id: str, tier: str, stripe_subscription_id: str):
        """Activate user's subscription"""
        now = datetime.now(timezone.utc)
        
        await self.db.subscriptions.update_one(
            {"user_id": user_id},
            {"$set": {
                "tier": tier,
                "status": "active",
                "stripe_subscription_id": stripe_subscription_id,
                "current_period_start": now.isoformat(),
                "current_period_end": (now + timedelta(days=30)).isoformat(),
                "updated_at": now.isoformat()
            }},
            upsert=True
        )
        
        # Update user's subscription tier
        await self.db.users.update_one(
            {"user_id": user_id},
            {"$set": {"subscription_tier": tier}}
        )
        
        logger.info(f"Subscription activated: user={user_id}, tier={tier}")
    
    async def _deactivate_subscription(self, user_id: str):
        """Deactivate user's subscription (revert to free)"""
        await self.db.subscriptions.update_one(
            {"user_id": user_id},
            {"$set": {
                "tier": "free",
                "status": "canceled",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        await self.db.users.update_one(
            {"user_id": user_id},
            {"$set": {"subscription_tier": "free"}}
        )
        
        logger.info(f"Subscription deactivated: user={user_id}")
    
    async def claim_daily_bonus(self, user_id: str) -> Dict[str, Any]:
        """Claim daily BL coin bonus for subscribers"""
        sub = await self.get_subscription(user_id)
        tier = sub.get("tier", "free")
        tier_info = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])
        
        daily_bonus = tier_info.get("daily_bl_bonus", 0)
        if daily_bonus == 0:
            return {
                "success": False,
                "message": "Free tier doesn't include daily bonus. Upgrade to Basic or Premium!",
                "can_claim": False
            }
        
        # Check if already claimed today
        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        
        last_claimed_str = sub.get("last_bonus_claimed")
        if last_claimed_str:
            last_claimed = datetime.fromisoformat(last_claimed_str.replace("Z", "+00:00"))
            if last_claimed >= today_start:
                return {
                    "success": False,
                    "message": "Already claimed today's bonus!",
                    "can_claim": False,
                    "next_claim": (today_start + timedelta(days=1)).isoformat()
                }
        
        # Calculate streak bonus
        streak = sub.get("bonus_streak", 0)
        yesterday_start = today_start - timedelta(days=1)
        
        if last_claimed_str:
            last_claimed = datetime.fromisoformat(last_claimed_str.replace("Z", "+00:00"))
            if last_claimed >= yesterday_start:
                streak += 1
            else:
                streak = 1  # Reset streak
        else:
            streak = 1
        
        # Apply streak multiplier (capped at 7 days)
        streak_multiplier = min(1 + (streak - 1) * 0.1, 1.7)  # Up to 70% bonus at 7+ days
        total_bonus = int(daily_bonus * streak_multiplier * tier_info.get("bonus_streak_multiplier", 1.0))
        
        # Update subscription
        await self.db.subscriptions.update_one(
            {"user_id": user_id},
            {"$set": {
                "last_bonus_claimed": now.isoformat(),
                "bonus_streak": streak,
                "updated_at": now.isoformat()
            },
            "$inc": {"total_bl_earned": total_bonus}}
        )
        
        # Add BL coins to user
        await self.db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"bl_coins": total_bonus}}
        )
        
        return {
            "success": True,
            "message": f"Claimed {total_bonus} BL Coins!",
            "amount": total_bonus,
            "base_amount": daily_bonus,
            "streak": streak,
            "streak_multiplier": streak_multiplier,
            "next_claim": (today_start + timedelta(days=1)).isoformat()
        }
    
    async def cancel_subscription(self, user_id: str) -> Dict[str, Any]:
        """Cancel user's subscription"""
        sub = await self.get_subscription(user_id)
        
        if sub.get("tier") == "free":
            return {"success": False, "message": "No active subscription to cancel"}
        
        stripe_sub_id = sub.get("stripe_subscription_id")
        if stripe_sub_id:
            try:
                stripe.Subscription.delete(stripe_sub_id)
            except Exception as e:
                logger.error(f"Failed to cancel Stripe subscription: {e}")
        
        await self._deactivate_subscription(user_id)
        
        return {"success": True, "message": "Subscription canceled"}


# ============== RANKED SERVICE ==============

class RankedService:
    """Service for ranked matchmaking"""
    
    def __init__(self, db):
        self.db = db
    
    async def get_ranked_profile(self, user_id: str) -> Dict[str, Any]:
        """Get user's ranked profile"""
        profile = await self.db.ranked_profiles.find_one(
            {"user_id": user_id},
            {"_id": 0}
        )
        
        if not profile:
            # Create default profile
            profile = RankedProfile(user_id=user_id).model_dump()
            profile["updated_at"] = profile["updated_at"].isoformat()
            await self.db.ranked_profiles.insert_one(profile)
            # Re-fetch without _id
            profile = await self.db.ranked_profiles.find_one(
                {"user_id": user_id},
                {"_id": 0}
            )
        
        # Add tier info
        tier = self._get_tier_from_rating(profile.get("rating", 1000))
        profile["tier"] = tier
        profile["tier_info"] = RANKED_TIERS.get(tier, RANKED_TIERS["bronze"])
        
        return profile
    
    def _get_tier_from_rating(self, rating: int) -> str:
        """Determine tier from rating"""
        for tier_id, tier_info in RANKED_TIERS.items():
            if tier_info["min_rating"] <= rating <= tier_info["max_rating"]:
                return tier_id
        return "bronze"
    
    async def update_rating(self, winner_id: str, loser_id: str, is_ranked: bool = True) -> Dict[str, Any]:
        """Update ratings after a ranked match"""
        if not is_ranked:
            return {"ranked": False}
        
        winner_profile = await self.get_ranked_profile(winner_id)
        loser_profile = await self.get_ranked_profile(loser_id) if loser_id != "bot" else None
        
        winner_rating = winner_profile.get("rating", 1000)
        loser_rating = loser_profile.get("rating", 1000) if loser_profile else 1000
        
        # ELO calculation
        k_factor = 32
        expected_winner = 1 / (1 + 10 ** ((loser_rating - winner_rating) / 400))
        expected_loser = 1 - expected_winner
        
        winner_new_rating = int(winner_rating + k_factor * (1 - expected_winner))
        loser_new_rating = int(loser_rating + k_factor * (0 - expected_loser)) if loser_profile else loser_rating
        
        # Update winner
        winner_streak = winner_profile.get("current_streak", 0) + 1
        await self.db.ranked_profiles.update_one(
            {"user_id": winner_id},
            {"$set": {
                "rating": winner_new_rating,
                "peak_rating": max(winner_profile.get("peak_rating", 0), winner_new_rating),
                "tier": self._get_tier_from_rating(winner_new_rating),
                "current_streak": winner_streak,
                "best_streak": max(winner_profile.get("best_streak", 0), winner_streak),
                "updated_at": datetime.now(timezone.utc).isoformat()
            },
            "$inc": {
                "season_wins": 1,
                "season_games": 1,
                "total_wins": 1,
                "total_games": 1
            }},
            upsert=True
        )
        
        # Update loser (if not bot)
        if loser_profile:
            await self.db.ranked_profiles.update_one(
                {"user_id": loser_id},
                {"$set": {
                    "rating": max(0, loser_new_rating),
                    "tier": self._get_tier_from_rating(max(0, loser_new_rating)),
                    "current_streak": 0,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                },
                "$inc": {
                    "season_losses": 1,
                    "season_games": 1,
                    "total_losses": 1,
                    "total_games": 1
                }},
                upsert=True
            )
        
        return {
            "ranked": True,
            "winner": {
                "user_id": winner_id,
                "old_rating": winner_rating,
                "new_rating": winner_new_rating,
                "rating_change": winner_new_rating - winner_rating,
                "tier": self._get_tier_from_rating(winner_new_rating)
            },
            "loser": {
                "user_id": loser_id,
                "old_rating": loser_rating,
                "new_rating": loser_new_rating,
                "rating_change": loser_new_rating - loser_rating,
                "tier": self._get_tier_from_rating(loser_new_rating)
            } if loser_profile else None
        }
    
    async def get_leaderboard(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get ranked leaderboard"""
        profiles = await self.db.ranked_profiles.find(
            {},
            {"_id": 0, "user_id": 1, "rating": 1, "tier": 1, "season_wins": 1, "season_games": 1}
        ).sort("rating", -1).limit(limit).to_list(length=limit)
        
        # Enrich with usernames
        for i, profile in enumerate(profiles):
            user = await self.db.users.find_one(
                {"user_id": profile["user_id"]},
                {"_id": 0, "username": 1, "display_name": 1, "profile_image": 1}
            )
            if user:
                profile.update(user)
            profile["rank"] = i + 1
            profile["tier_info"] = RANKED_TIERS.get(profile.get("tier", "bronze"), RANKED_TIERS["bronze"])
        
        return profiles


# ============== TOURNAMENT SERVICE ==============

class TournamentService:
    """Service for managing tournaments"""
    
    def __init__(self, db):
        self.db = db
    
    async def create_tournament(self, creator_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new tournament"""
        # Check if user can create tournaments
        sub = await self.db.subscriptions.find_one({"user_id": creator_id}, {"_id": 0})
        tier = sub.get("tier", "free") if sub else "free"
        tier_info = SUBSCRIPTION_TIERS.get(tier, SUBSCRIPTION_TIERS["free"])
        
        if not tier_info.get("can_create_tournaments"):
            raise HTTPException(
                status_code=403,
                detail="Premium subscription required to create tournaments"
            )
        
        tournament = Tournament(
            creator_id=creator_id,
            name=data.get("name", "Tournament"),
            description=data.get("description", ""),
            max_participants=min(data.get("max_participants", 16), 64),
            entry_fee=data.get("entry_fee", 0),
            prize_pool=data.get("prize_pool", 0),
            format=data.get("format", "single_elimination"),
            registration_start=datetime.fromisoformat(data["registration_start"]),
            registration_end=datetime.fromisoformat(data["registration_end"]),
            start_time=datetime.fromisoformat(data["start_time"])
        )
        
        tournament_dict = tournament.model_dump()
        for key in ["registration_start", "registration_end", "start_time", "created_at"]:
            if isinstance(tournament_dict[key], datetime):
                tournament_dict[key] = tournament_dict[key].isoformat()
        
        await self.db.tournaments.insert_one(tournament_dict)
        
        return tournament_dict
    
    async def get_tournaments(self, status: Optional[str] = None, limit: int = 20) -> List[Dict[str, Any]]:
        """Get list of tournaments"""
        query = {}
        if status:
            query["status"] = status
        
        tournaments = await self.db.tournaments.find(
            query,
            {"_id": 0}
        ).sort("start_time", 1).limit(limit).to_list(length=limit)
        
        return tournaments
    
    async def join_tournament(self, user_id: str, tournament_id: str) -> Dict[str, Any]:
        """Join a tournament"""
        tournament = await self.db.tournaments.find_one(
            {"tournament_id": tournament_id},
            {"_id": 0}
        )
        
        if not tournament:
            raise HTTPException(status_code=404, detail="Tournament not found")
        
        if tournament.get("status") != "registration":
            raise HTTPException(status_code=400, detail="Registration is closed")
        
        if user_id in tournament.get("participants", []):
            raise HTTPException(status_code=400, detail="Already registered")
        
        if len(tournament.get("participants", [])) >= tournament.get("max_participants", 16):
            raise HTTPException(status_code=400, detail="Tournament is full")
        
        # Deduct entry fee if applicable
        entry_fee = tournament.get("entry_fee", 0)
        if entry_fee > 0:
            user = await self.db.users.find_one({"user_id": user_id}, {"_id": 0, "bl_coins": 1})
            if not user or user.get("bl_coins", 0) < entry_fee:
                raise HTTPException(status_code=400, detail="Insufficient BL coins for entry fee")
            
            await self.db.users.update_one(
                {"user_id": user_id},
                {"$inc": {"bl_coins": -entry_fee}}
            )
        
        # Add to tournament
        await self.db.tournaments.update_one(
            {"tournament_id": tournament_id},
            {
                "$push": {"participants": user_id},
                "$inc": {"prize_pool": entry_fee}
            }
        )
        
        return {"success": True, "message": "Joined tournament successfully"}


# ============== API ROUTES ==============

subscription_router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])
_db = None


def setup_subscription_routes(db):
    """Initialize routes with database connection"""
    global _db
    _db = db


def get_subscription_service():
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return SubscriptionService(_db)


def get_ranked_service():
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return RankedService(_db)


def get_tournament_service():
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return TournamentService(_db)


async def get_current_user(request: Request) -> dict:
    """Extract current user from request"""
    from jose import jwt, JWTError
    import os
    
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
        user = await _db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


@subscription_router.get("/tiers")
async def get_subscription_tiers():
    """Get available subscription tiers"""
    return {
        "tiers": SUBSCRIPTION_TIERS,
        "ranked_tiers": RANKED_TIERS
    }


@subscription_router.get("/my-subscription")
async def get_my_subscription(current_user: dict = Depends(get_current_user)):
    """Get current user's subscription"""
    service = get_subscription_service()
    return await service.get_subscription(current_user["user_id"])


@subscription_router.post("/checkout")
async def create_checkout(
    tier: str,
    success_url: str,
    cancel_url: str,
    current_user: dict = Depends(get_current_user)
):
    """Create Stripe checkout session"""
    service = get_subscription_service()
    return await service.create_checkout_session(
        current_user["user_id"],
        tier,
        success_url,
        cancel_url
    )


@subscription_router.post("/claim-daily-bonus")
async def claim_daily_bonus(current_user: dict = Depends(get_current_user)):
    """Claim daily BL coin bonus"""
    service = get_subscription_service()
    return await service.claim_daily_bonus(current_user["user_id"])


@subscription_router.post("/cancel")
async def cancel_subscription(current_user: dict = Depends(get_current_user)):
    """Cancel subscription"""
    service = get_subscription_service()
    return await service.cancel_subscription(current_user["user_id"])


@subscription_router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig_header,
            os.environ.get("STRIPE_WEBHOOK_SECRET")
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    service = get_subscription_service()
    return await service.handle_webhook(event)


# Ranked routes
@subscription_router.get("/ranked/profile")
async def get_ranked_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's ranked profile"""
    service = get_ranked_service()
    return await service.get_ranked_profile(current_user["user_id"])


@subscription_router.get("/ranked/leaderboard")
async def get_ranked_leaderboard(limit: int = 50):
    """Get ranked leaderboard"""
    service = get_ranked_service()
    return await service.get_leaderboard(limit)


# Tournament routes
@subscription_router.get("/tournaments")
async def get_tournaments(status: Optional[str] = None, limit: int = 20):
    """Get list of tournaments"""
    service = get_tournament_service()
    return await service.get_tournaments(status, limit)


@subscription_router.post("/tournaments")
async def create_tournament(
    data: Dict[str, Any],
    current_user: dict = Depends(get_current_user)
):
    """Create a new tournament"""
    service = get_tournament_service()
    return await service.create_tournament(current_user["user_id"], data)


@subscription_router.post("/tournaments/{tournament_id}/join")
async def join_tournament(
    tournament_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Join a tournament"""
    service = get_tournament_service()
    return await service.join_tournament(current_user["user_id"], tournament_id)
