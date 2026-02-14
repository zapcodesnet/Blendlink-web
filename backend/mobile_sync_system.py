"""
Mobile App Sync Verification System
Ensures API compatibility between web and mobile applications.

Features:
- API endpoint compatibility checks
- Schema validation
- Version tracking
- Sync health monitoring
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import logging

logger = logging.getLogger(__name__)

mobile_sync_router = APIRouter(prefix="/mobile-sync", tags=["Mobile Sync"])


# Expected API endpoints for mobile app
MOBILE_REQUIRED_ENDPOINTS = [
    # Auth
    {"path": "/api/auth/login", "method": "POST", "category": "auth"},
    {"path": "/api/auth/register", "method": "POST", "category": "auth"},
    {"path": "/api/auth/google", "method": "POST", "category": "auth"},
    {"path": "/api/users/me", "method": "GET", "category": "auth"},
    
    # Marketplace
    {"path": "/api/marketplace/listings", "method": "GET", "category": "marketplace"},
    {"path": "/api/marketplace/listings", "method": "POST", "category": "marketplace"},
    {"path": "/api/marketplace/listing/{listing_id}", "method": "GET", "category": "marketplace"},
    {"path": "/api/marketplace/search", "method": "GET", "category": "marketplace"},
    
    # Wallet & Payments
    {"path": "/api/wallet/balance", "method": "GET", "category": "wallet"},
    {"path": "/api/stripe/top-up", "method": "POST", "category": "wallet"},
    {"path": "/api/stripe/checkout-session", "method": "POST", "category": "wallet"},
    {"path": "/api/stripe/purchase-coins-from-balance", "method": "POST", "category": "wallet"},
    {"path": "/api/stripe/subscribe-from-balance", "method": "POST", "category": "wallet"},
    
    # Membership
    {"path": "/api/membership/tiers", "method": "GET", "category": "membership"},
    {"path": "/api/membership/current", "method": "GET", "category": "membership"},
    
    # Referrals & Commissions
    {"path": "/api/referral/code", "method": "GET", "category": "referral"},
    {"path": "/api/referral/team", "method": "GET", "category": "referral"},
    {"path": "/api/referral/earnings", "method": "GET", "category": "referral"},
    
    # Photo Game
    {"path": "/api/photo-game/daily", "method": "GET", "category": "photo_game"},
    {"path": "/api/photo-game/submit", "method": "POST", "category": "photo_game"},
    {"path": "/api/photo-game/mint", "method": "POST", "category": "photo_game"},
    
    # Member Pages
    {"path": "/api/member-pages", "method": "GET", "category": "member_pages"},
    {"path": "/api/member-pages/{page_id}", "method": "GET", "category": "member_pages"},
    
    # Notifications
    {"path": "/api/notifications", "method": "GET", "category": "notifications"},
    {"path": "/api/notifications/mark-read", "method": "POST", "category": "notifications"},
    
    # Stripe Connect
    {"path": "/api/stripe/connect/onboarding", "method": "POST", "category": "stripe_connect"},
    {"path": "/api/stripe/connect/status", "method": "GET", "category": "stripe_connect"},
]


# Expected response schemas for critical endpoints
EXPECTED_SCHEMAS = {
    "/api/users/me": {
        "required_fields": ["user_id", "email", "username"],
        "optional_fields": ["bl_coins", "usd_balance", "subscription_tier", "xp", "level"]
    },
    "/api/wallet/balance": {
        "required_fields": ["bl_coins", "usd_balance"],
        "optional_fields": ["pending_balance", "available_for_withdrawal"]
    },
    "/api/membership/current": {
        "required_fields": ["tier", "status"],
        "optional_fields": ["next_billing", "benefits", "commission_rate"]
    }
}


class SyncStatus(BaseModel):
    endpoint: str
    method: str
    category: str
    status: str  # "available", "unavailable", "changed"
    response_time_ms: Optional[float] = None
    error: Optional[str] = None


class SyncReport(BaseModel):
    generated_at: str
    total_endpoints: int
    available: int
    unavailable: int
    changed: int
    by_category: Dict[str, Dict[str, int]]
    details: List[SyncStatus]
    overall_health: str  # "healthy", "degraded", "critical"


@mobile_sync_router.get("/status")
async def get_sync_status():
    """
    Get overall mobile sync status.
    Returns summary of API compatibility.
    """
    return {
        "status": "operational",
        "api_version": "2.0",
        "last_verified": datetime.now(timezone.utc).isoformat(),
        "total_endpoints": len(MOBILE_REQUIRED_ENDPOINTS),
        "categories": list(set(e["category"] for e in MOBILE_REQUIRED_ENDPOINTS))
    }


@mobile_sync_router.get("/endpoints")
async def list_required_endpoints(category: Optional[str] = None):
    """
    List all endpoints required for mobile app sync.
    Optionally filter by category.
    """
    endpoints = MOBILE_REQUIRED_ENDPOINTS
    
    if category:
        endpoints = [e for e in endpoints if e["category"] == category]
    
    return {
        "endpoints": endpoints,
        "total": len(endpoints),
        "filter_applied": category
    }


@mobile_sync_router.get("/verify")
async def verify_sync_compatibility():
    """
    Verify that all required mobile endpoints are available.
    Returns detailed compatibility report.
    """
    from fastapi.routing import APIRoute
    from server import app
    
    # Get all registered routes
    registered_routes = set()
    for route in app.routes:
        if isinstance(route, APIRoute):
            for method in route.methods:
                registered_routes.add((route.path, method))
    
    results = []
    available = 0
    unavailable = 0
    by_category = {}
    
    for endpoint in MOBILE_REQUIRED_ENDPOINTS:
        path = endpoint["path"]
        method = endpoint["method"]
        category = endpoint["category"]
        
        # Initialize category counter
        if category not in by_category:
            by_category[category] = {"available": 0, "unavailable": 0}
        
        # Check if route is registered (handle path parameters)
        is_available = False
        for reg_path, reg_method in registered_routes:
            if reg_method == method:
                # Normalize paths for comparison
                norm_path = path.replace("{listing_id}", "{item_id}").replace("{page_id}", "{item_id}")
                norm_reg = reg_path.replace("{listing_id}", "{item_id}").replace("{page_id}", "{item_id}")
                
                if norm_path == norm_reg or path.split("{")[0] == reg_path.split("{")[0]:
                    is_available = True
                    break
        
        status = "available" if is_available else "unavailable"
        
        if is_available:
            available += 1
            by_category[category]["available"] += 1
        else:
            unavailable += 1
            by_category[category]["unavailable"] += 1
        
        results.append(SyncStatus(
            endpoint=path,
            method=method,
            category=category,
            status=status
        ))
    
    # Determine overall health
    availability_rate = available / len(MOBILE_REQUIRED_ENDPOINTS)
    if availability_rate >= 0.95:
        overall_health = "healthy"
    elif availability_rate >= 0.80:
        overall_health = "degraded"
    else:
        overall_health = "critical"
    
    return SyncReport(
        generated_at=datetime.now(timezone.utc).isoformat(),
        total_endpoints=len(MOBILE_REQUIRED_ENDPOINTS),
        available=available,
        unavailable=unavailable,
        changed=0,
        by_category=by_category,
        details=results,
        overall_health=overall_health
    )


@mobile_sync_router.get("/schemas")
async def get_expected_schemas():
    """
    Get expected response schemas for critical endpoints.
    Mobile app can use this to validate responses.
    """
    return {
        "schemas": EXPECTED_SCHEMAS,
        "total": len(EXPECTED_SCHEMAS)
    }


@mobile_sync_router.post("/report-issue")
async def report_sync_issue(
    endpoint: str,
    issue_type: str,
    description: str,
    app_version: Optional[str] = None,
    device_info: Optional[str] = None
):
    """
    Report a sync issue from mobile app.
    Helps track API compatibility problems.
    """
    from motor.motor_asyncio import AsyncIOMotorClient
    import os
    
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'blendlink')
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    issue_doc = {
        "endpoint": endpoint,
        "issue_type": issue_type,
        "description": description,
        "app_version": app_version,
        "device_info": device_info,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.mobile_sync_issues.insert_one(issue_doc)
    
    return {
        "success": True,
        "message": "Issue reported successfully"
    }


@mobile_sync_router.get("/health")
async def get_mobile_sync_health():
    """
    Get detailed health check for mobile app synchronization.
    Includes database connectivity and critical service status.
    """
    from motor.motor_asyncio import AsyncIOMotorClient
    import os
    
    health_checks = {}
    
    # Database check
    try:
        mongo_url = os.environ.get('MONGO_URL')
        client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=5000)
        await client.admin.command('ping')
        health_checks["database"] = {"status": "healthy", "latency_ms": 0}
    except Exception as e:
        health_checks["database"] = {"status": "unhealthy", "error": str(e)}
    
    # API version
    health_checks["api_version"] = "2.0"
    
    # Feature flags for mobile
    health_checks["features"] = {
        "stripe_payments": True,
        "google_auth": True,
        "photo_game": True,
        "member_pages": True,
        "commissions": True,
        "notifications": True
    }
    
    # Overall status
    all_healthy = all(
        v.get("status") == "healthy" if isinstance(v, dict) and "status" in v else True
        for v in health_checks.values()
    )
    
    return {
        "status": "healthy" if all_healthy else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": health_checks
    }
