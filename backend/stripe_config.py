"""
BlendLink Stripe Configuration — Single Source of Truth

All Stripe API keys are loaded from environment variables.
NEVER hardcode keys in any other file — import from here.

Usage:
    from stripe_config import STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, init_stripe
    init_stripe()  # Sets stripe.api_key globally
"""
import os
import stripe
import logging

logger = logging.getLogger(__name__)

# Load from environment variables ONLY — never hardcode
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_PUBLISHABLE_KEY = os.environ.get("STRIPE_PUBLISHABLE_KEY", "")


def init_stripe():
    """Initialize Stripe with the secret key from environment"""
    if not STRIPE_SECRET_KEY:
        logger.error("STRIPE_SECRET_KEY not set in environment!")
        return False
    
    stripe.api_key = STRIPE_SECRET_KEY
    
    key_prefix = STRIPE_SECRET_KEY[:12] if len(STRIPE_SECRET_KEY) > 12 else "***"
    if STRIPE_SECRET_KEY.startswith("sk_live"):
        logger.info(f"Stripe initialized with LIVE key: {key_prefix}...")
    elif STRIPE_SECRET_KEY.startswith("sk_test"):
        logger.warning(f"Stripe initialized with TEST key: {key_prefix}...")
    else:
        logger.warning(f"Stripe key format unrecognized: {key_prefix}...")
    
    return True


def get_stripe_key():
    """Get the Stripe secret key — use this instead of hardcoding"""
    return STRIPE_SECRET_KEY


def get_publishable_key():
    """Get the Stripe publishable key for frontend config endpoint"""
    return STRIPE_PUBLISHABLE_KEY
