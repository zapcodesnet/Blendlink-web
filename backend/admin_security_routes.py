"""
Admin Security Dashboard API
Provides endpoints for security monitoring: login history, failed attempts, locked accounts, and alerts
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from server import db, get_current_user

# Router
admin_security_router = APIRouter(prefix="/admin/security", tags=["Admin Security"])

# ============== MODELS ==============

class UnlockAccountRequest(BaseModel):
    email: str

# ============== HELPER FUNCTIONS ==============

def get_time_range(range_str: str) -> datetime:
    """Convert range string to datetime"""
    now = datetime.now(timezone.utc)
    ranges = {
        '1h': timedelta(hours=1),
        '24h': timedelta(days=1),
        '7d': timedelta(days=7),
        '30d': timedelta(days=30),
    }
    delta = ranges.get(range_str, timedelta(days=1))
    return now - delta

# ============== API ENDPOINTS ==============

@admin_security_router.get("/stats")
async def get_security_stats(
    range: str = Query("24h", description="Time range: 1h, 24h, 7d, 30d"),
    current_user: dict = Depends(get_current_user)
):
    """Get security statistics for the admin dashboard"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    since = get_time_range(range)
    since_iso = since.isoformat()
    
    # Count successful logins
    total_logins = await db.admin_auth_audit.count_documents({
        "action": {"$in": ["otp_verified", "login_success", "admin_login"]},
        "created_at": {"$gte": since_iso}
    })
    
    # Count failed attempts
    failed_attempts = await db.admin_failed_attempts.count_documents({
        "created_at": {"$gte": since_iso}
    })
    
    # Count locked accounts
    locked_count = await db.admin_lockouts.count_documents({
        "locked_until": {"$gt": datetime.now(timezone.utc).isoformat()}
    })
    
    # Count active sessions (approximate - tokens not expired)
    active_sessions = await db.admin_otp_requests.count_documents({
        "verified": True,
        "verified_at": {"$gte": (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()}
    })
    
    return {
        "total_logins": total_logins,
        "failed_attempts": failed_attempts,
        "locked_accounts": locked_count,
        "active_sessions": max(active_sessions, 1),
        "range": range,
        "since": since_iso
    }

@admin_security_router.get("/login-history")
async def get_login_history(
    range: str = Query("24h"),
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_user)
):
    """Get admin login history"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    since = get_time_range(range)
    since_iso = since.isoformat()
    
    # Get successful login events
    logins = await db.admin_auth_audit.find({
        "action": {"$in": ["otp_verified", "login_success", "admin_login", "otp_requested"]},
        "created_at": {"$gte": since_iso}
    }, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    # Enrich with status
    for login in logins:
        if login.get("action") == "otp_verified" or login.get("action") == "login_success":
            login["status"] = "success"
        elif login.get("action") == "otp_requested":
            login["status"] = "pending"
        else:
            login["status"] = login.get("action", "unknown")
    
    return {"logins": logins, "total": len(logins)}

@admin_security_router.get("/failed-attempts")
async def get_failed_attempts(
    range: str = Query("24h"),
    limit: int = Query(50, le=200),
    current_user: dict = Depends(get_current_user)
):
    """Get failed login attempts"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    since = get_time_range(range)
    since_iso = since.isoformat()
    
    attempts = await db.admin_failed_attempts.find({
        "created_at": {"$gte": since_iso}
    }, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"attempts": attempts, "total": len(attempts)}

@admin_security_router.get("/locked-accounts")
async def get_locked_accounts(current_user: dict = Depends(get_current_user)):
    """Get currently locked accounts"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    now_iso = datetime.now(timezone.utc).isoformat()
    
    accounts = await db.admin_lockouts.find({
        "locked_until": {"$gt": now_iso}
    }, {"_id": 0}).to_list(100)
    
    return {"accounts": accounts, "total": len(accounts)}

@admin_security_router.post("/unlock-account")
async def unlock_account(
    request: UnlockAccountRequest,
    current_user: dict = Depends(get_current_user)
):
    """Manually unlock a locked account"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Remove lockout
    result = await db.admin_lockouts.delete_one({"email": request.email})
    
    # Also clear recent failed attempts for this email
    await db.admin_failed_attempts.delete_many({"email": request.email})
    
    if result.deleted_count > 0:
        # Log the action
        await db.admin_auth_audit.insert_one({
            "audit_id": f"audit_unlock_{datetime.now(timezone.utc).timestamp()}",
            "action": "account_unlocked",
            "email": request.email,
            "unlocked_by": current_user.get("email"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        logger.info(f"Account {request.email} unlocked by {current_user.get('email')}")
        return {"success": True, "message": f"Account {request.email} unlocked"}
    
    return {"success": False, "message": "Account not found or already unlocked"}

@admin_security_router.get("/alerts")
async def get_security_alerts(
    range: str = Query("24h"),
    limit: int = Query(20, le=100),
    current_user: dict = Depends(get_current_user)
):
    """Get security alerts"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    since = get_time_range(range)
    since_iso = since.isoformat()
    
    # Get security-related notifications
    alerts = await db.admin_notifications.find({
        "notification_type": {"$in": [
            "brute_force_detected",
            "suspicious_activity", 
            "unauthorized_access",
            "failed_login_attempt"
        ]},
        "created_at": {"$gte": since_iso}
    }, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"alerts": alerts, "total": len(alerts)}

@admin_security_router.get("/session-info")
async def get_current_session_info(current_user: dict = Depends(get_current_user)):
    """Get information about the current admin session"""
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get the most recent login for this admin
    recent_login = await db.admin_auth_audit.find_one(
        {
            "email": current_user.get("email"),
            "action": {"$in": ["otp_verified", "login_success"]}
        },
        {"_id": 0},
        sort=[("created_at", -1)]
    )
    
    return {
        "admin_email": current_user.get("email"),
        "admin_name": current_user.get("name"),
        "last_login": recent_login.get("created_at") if recent_login else None,
        "last_ip": recent_login.get("ip_address") if recent_login else None,
        "last_location": recent_login.get("location") if recent_login else None
    }
