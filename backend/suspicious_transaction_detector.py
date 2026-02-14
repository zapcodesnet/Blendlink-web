"""
Suspicious Transaction Detector
Auto-flags transactions based on configurable rules and thresholds.

Features:
- Velocity checks (too many transactions in short time)
- Amount anomaly detection
- Geographic anomaly detection
- Pattern-based fraud detection
- Commission manipulation detection
"""

from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import os
import uuid
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Database connection
def get_mongo_connection():
    mongo_url = os.environ.get('MONGO_URL')
    mongo_url_local = os.environ.get('MONGO_URL_LOCAL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'blendlink')
    
    try:
        from pymongo import MongoClient as SyncMongoClient
        test_client = SyncMongoClient(mongo_url, serverSelectionTimeoutMS=5000)
        test_client.admin.command('ping')
        test_client.close()
        return AsyncIOMotorClient(mongo_url), db_name
    except Exception:
        return AsyncIOMotorClient(mongo_url_local), db_name

client, db_name = get_mongo_connection()
db = client[db_name]


# ============== DETECTION RULES ==============

DETECTION_RULES = {
    # Velocity Rules
    "high_frequency_transactions": {
        "enabled": True,
        "description": "Too many transactions in a short period",
        "threshold": 10,  # transactions
        "window_minutes": 60,
        "severity": "high"
    },
    "rapid_withdrawals": {
        "enabled": True,
        "description": "Multiple withdrawal requests in short succession",
        "threshold": 3,
        "window_minutes": 30,
        "severity": "critical"
    },
    
    # Amount Rules
    "large_single_transaction": {
        "enabled": True,
        "description": "Single transaction exceeds threshold",
        "threshold_usd": 500,
        "severity": "medium"
    },
    "large_daily_volume": {
        "enabled": True,
        "description": "Daily transaction volume exceeds threshold",
        "threshold_usd": 2000,
        "severity": "high"
    },
    "sudden_balance_spike": {
        "enabled": True,
        "description": "Unusual increase in balance compared to history",
        "multiplier": 5,  # 5x average
        "severity": "high"
    },
    
    # Commission Rules
    "self_referral_pattern": {
        "enabled": True,
        "description": "Potential self-referral or circular referral detected",
        "severity": "critical"
    },
    "commission_farming": {
        "enabled": True,
        "description": "Pattern suggests artificial commission generation",
        "threshold_commissions": 20,
        "window_hours": 24,
        "severity": "critical"
    },
    
    # Account Rules
    "new_account_large_transaction": {
        "enabled": True,
        "description": "Large transaction from recently created account",
        "account_age_days": 7,
        "threshold_usd": 100,
        "severity": "high"
    },
    "dormant_account_activation": {
        "enabled": True,
        "description": "Dormant account suddenly active with large transactions",
        "dormant_days": 30,
        "severity": "medium"
    }
}


async def analyze_transaction(transaction: dict) -> list:
    """
    Analyze a transaction against all detection rules.
    Returns list of triggered rules with details.
    """
    triggered_rules = []
    user_id = transaction.get("user_id")
    amount = transaction.get("amount_usd") or transaction.get("amount", 0)
    transaction_type = transaction.get("transaction_type", "")
    
    if not user_id:
        return triggered_rules
    
    # Get user data
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        return triggered_rules
    
    now = datetime.now(timezone.utc)
    
    # Check each enabled rule
    for rule_id, rule in DETECTION_RULES.items():
        if not rule.get("enabled"):
            continue
        
        try:
            result = await check_rule(rule_id, rule, transaction, user, now)
            if result:
                triggered_rules.append({
                    "rule_id": rule_id,
                    "description": rule["description"],
                    "severity": rule["severity"],
                    "details": result
                })
        except Exception as e:
            logger.error(f"Error checking rule {rule_id}: {e}")
    
    return triggered_rules


async def check_rule(rule_id: str, rule: dict, transaction: dict, user: dict, now: datetime) -> dict:
    """Check a specific rule against a transaction"""
    user_id = user["user_id"]
    amount = transaction.get("amount_usd") or transaction.get("amount", 0)
    transaction_type = transaction.get("transaction_type", "")
    
    if rule_id == "high_frequency_transactions":
        window_start = (now - timedelta(minutes=rule["window_minutes"])).isoformat()
        count = await db.bl_transactions.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": window_start}
        })
        if count >= rule["threshold"]:
            return {"count": count, "window_minutes": rule["window_minutes"]}
    
    elif rule_id == "rapid_withdrawals":
        if transaction_type != "withdrawal":
            return None
        window_start = (now - timedelta(minutes=rule["window_minutes"])).isoformat()
        count = await db.bl_transactions.count_documents({
            "user_id": user_id,
            "transaction_type": "withdrawal",
            "created_at": {"$gte": window_start}
        })
        if count >= rule["threshold"]:
            return {"count": count, "window_minutes": rule["window_minutes"]}
    
    elif rule_id == "large_single_transaction":
        if amount >= rule["threshold_usd"]:
            return {"amount": amount, "threshold": rule["threshold_usd"]}
    
    elif rule_id == "large_daily_volume":
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": day_start}}},
            {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}}}
        ]
        result = await db.bl_transactions.aggregate(pipeline).to_list(1)
        daily_total = result[0]["total"] if result else 0
        if daily_total >= rule["threshold_usd"]:
            return {"daily_total": daily_total, "threshold": rule["threshold_usd"]}
    
    elif rule_id == "sudden_balance_spike":
        # Get average daily earnings over last 30 days
        month_ago = (now - timedelta(days=30)).isoformat()
        pipeline = [
            {"$match": {
                "user_id": user_id,
                "transaction_type": {"$in": ["commission", "sale", "earning"]},
                "created_at": {"$gte": month_ago}
            }},
            {"$group": {"_id": None, "total": {"$sum": "$amount_usd"}, "count": {"$sum": 1}}}
        ]
        result = await db.bl_transactions.aggregate(pipeline).to_list(1)
        if result:
            avg_daily = result[0]["total"] / 30
            if amount > avg_daily * rule["multiplier"] and avg_daily > 0:
                return {"amount": amount, "average_daily": avg_daily, "multiplier": rule["multiplier"]}
    
    elif rule_id == "self_referral_pattern":
        # Check for circular referral patterns
        referrer_id = user.get("referred_by")
        if referrer_id:
            referrer = await db.users.find_one({"user_id": referrer_id})
            if referrer:
                # Check if referrer was referred by this user (circular)
                if referrer.get("referred_by") == user_id:
                    return {"pattern": "circular_referral", "referrer_id": referrer_id}
                
                # Check for same IP/device
                if user.get("registration_ip") and user.get("registration_ip") == referrer.get("registration_ip"):
                    return {"pattern": "same_ip", "ip": user.get("registration_ip")}
    
    elif rule_id == "commission_farming":
        if transaction_type != "commission":
            return None
        window_start = (now - timedelta(hours=rule["window_hours"])).isoformat()
        count = await db.commission_history.count_documents({
            "beneficiary_id": user_id,
            "created_at": {"$gte": window_start}
        })
        if count >= rule["threshold_commissions"]:
            return {"commission_count": count, "window_hours": rule["window_hours"]}
    
    elif rule_id == "new_account_large_transaction":
        created_at = user.get("created_at")
        if created_at:
            try:
                created_date = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                account_age = (now - created_date).days
                if account_age <= rule["account_age_days"] and amount >= rule["threshold_usd"]:
                    return {"account_age_days": account_age, "amount": amount}
            except:
                pass
    
    elif rule_id == "dormant_account_activation":
        # Check last activity
        last_activity = await db.bl_transactions.find_one(
            {"user_id": user_id},
            sort=[("created_at", -1)]
        )
        if last_activity:
            try:
                last_date = datetime.fromisoformat(last_activity["created_at"].replace("Z", "+00:00"))
                days_inactive = (now - last_date).days
                if days_inactive >= rule["dormant_days"]:
                    return {"days_inactive": days_inactive}
            except:
                pass
    
    return None


async def flag_transaction(transaction_id: str, triggered_rules: list, auto_flag: bool = True) -> dict:
    """
    Flag a transaction as suspicious based on triggered rules.
    """
    if not triggered_rules:
        return {"flagged": False}
    
    # Determine overall severity (highest among triggered rules)
    severity_order = {"low": 0, "medium": 1, "high": 2, "critical": 3}
    max_severity = max(triggered_rules, key=lambda r: severity_order.get(r["severity"], 0))
    
    flag_data = {
        "flagged_at": datetime.now(timezone.utc).isoformat(),
        "auto_flagged": auto_flag,
        "is_flagged": True,
        "flag_status": "pending_review",
        "flag_severity": max_severity["severity"],
        "flag_reasons": triggered_rules
    }
    
    # Update in bl_transactions
    result = await db.bl_transactions.update_one(
        {"transaction_id": transaction_id},
        {"$set": flag_data}
    )
    
    # Also update in commission_history if it's a commission
    await db.commission_history.update_one(
        {"commission_id": transaction_id},
        {"$set": flag_data}
    )
    
    # Create alert for admins
    await db.admin_alerts.insert_one({
        "alert_id": f"alert_{uuid.uuid4().hex[:12]}",
        "type": "suspicious_transaction",
        "transaction_id": transaction_id,
        "severity": max_severity["severity"],
        "triggered_rules": [r["rule_id"] for r in triggered_rules],
        "status": "unread",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    logger.warning(f"Transaction {transaction_id} flagged: {[r['rule_id'] for r in triggered_rules]}")
    
    return {
        "flagged": True,
        "severity": max_severity["severity"],
        "rules_triggered": len(triggered_rules)
    }


async def scan_recent_transactions(hours: int = 24) -> dict:
    """
    Scan recent transactions for suspicious activity.
    Returns summary of flagged transactions.
    """
    logger.info(f"Scanning transactions from last {hours} hours...")
    
    start_time = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    
    # Get unflagged transactions
    transactions = await db.bl_transactions.find({
        "created_at": {"$gte": start_time},
        "is_flagged": {"$ne": True}
    }).to_list(length=1000)
    
    flagged_count = 0
    total_scanned = len(transactions)
    severity_counts = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    
    for txn in transactions:
        triggered_rules = await analyze_transaction(txn)
        if triggered_rules:
            result = await flag_transaction(
                txn.get("transaction_id") or str(txn.get("_id")),
                triggered_rules
            )
            if result["flagged"]:
                flagged_count += 1
                severity_counts[result["severity"]] = severity_counts.get(result["severity"], 0) + 1
    
    logger.info(f"Scan complete: {flagged_count}/{total_scanned} transactions flagged")
    
    return {
        "scanned": total_scanned,
        "flagged": flagged_count,
        "by_severity": severity_counts,
        "scan_time": datetime.now(timezone.utc).isoformat()
    }


async def get_detection_rules() -> dict:
    """Get current detection rules configuration"""
    return DETECTION_RULES


async def update_detection_rule(rule_id: str, updates: dict) -> dict:
    """Update a detection rule's configuration"""
    if rule_id not in DETECTION_RULES:
        return {"success": False, "error": "Rule not found"}
    
    # Apply updates
    for key, value in updates.items():
        if key in DETECTION_RULES[rule_id]:
            DETECTION_RULES[rule_id][key] = value
    
    # Log the change
    await db.admin_audit_logs.insert_one({
        "action": "detection_rule_updated",
        "rule_id": rule_id,
        "updates": updates,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"success": True, "rule": DETECTION_RULES[rule_id]}


# Middleware function to auto-analyze transactions
async def auto_analyze_on_create(transaction: dict):
    """
    Call this when a new transaction is created to auto-analyze.
    Can be integrated as middleware or called directly.
    """
    try:
        triggered_rules = await analyze_transaction(transaction)
        if triggered_rules:
            transaction_id = transaction.get("transaction_id") or str(transaction.get("_id"))
            await flag_transaction(transaction_id, triggered_rules, auto_flag=True)
    except Exception as e:
        logger.error(f"Error in auto-analyze: {e}")
