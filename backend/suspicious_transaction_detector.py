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
    },
    
    # ============== ADVANCED ML-INSPIRED RULES ==============
    
    # Statistical Anomaly Detection
    "statistical_amount_anomaly": {
        "enabled": True,
        "description": "Transaction amount significantly deviates from user's historical pattern (Z-score > 3)",
        "z_score_threshold": 3.0,  # Standard deviations from mean
        "min_history_count": 10,  # Minimum transactions needed for baseline
        "severity": "high"
    },
    
    # Time-based Behavioral Analysis
    "unusual_time_pattern": {
        "enabled": True,
        "description": "Transaction at unusual time compared to user's typical behavior",
        "off_hours_start": 2,  # 2 AM
        "off_hours_end": 5,    # 5 AM
        "requires_history": True,
        "severity": "medium"
    },
    
    # Velocity Acceleration Detection
    "velocity_acceleration": {
        "enabled": True,
        "description": "Transaction velocity increasing faster than normal (acceleration anomaly)",
        "acceleration_multiplier": 3.0,  # 3x increase in activity rate
        "comparison_period_hours": 24,
        "baseline_period_hours": 168,  # 7 days
        "severity": "high"
    },
    
    # Network/Graph Analysis
    "cluster_activity_pattern": {
        "enabled": True,
        "description": "Suspicious coordinated activity among connected accounts",
        "min_cluster_size": 3,  # Minimum accounts in cluster
        "time_window_minutes": 30,  # Activity within this window
        "severity": "critical"
    },
    
    # Amount Structuring Detection (Smurfing)
    "amount_structuring": {
        "enabled": True,
        "description": "Multiple transactions just below threshold (potential structuring)",
        "threshold_amount": 500,  # The amount people try to stay under
        "tolerance_percentage": 10,  # Within 10% of threshold
        "min_count": 3,  # At least 3 transactions fitting pattern
        "window_hours": 24,
        "severity": "critical"
    },
    
    # Round Amount Pattern
    "round_amount_pattern": {
        "enabled": True,
        "description": "Unusual frequency of round-number transactions",
        "round_threshold": 50,  # Amounts divisible by this
        "min_count": 5,  # At least 5 round amounts
        "window_hours": 48,
        "severity": "medium"
    },
    
    # Recipient Diversity Analysis
    "low_recipient_diversity": {
        "enabled": True,
        "description": "High volume transactions to very few unique recipients",
        "min_transaction_count": 10,
        "max_recipient_ratio": 0.2,  # If recipients/transactions < 20%, flag
        "window_hours": 24,
        "severity": "high"
    },
    
    # Beneficiary Risk Score
    "high_risk_beneficiary": {
        "enabled": True,
        "description": "Transaction to or from account with existing fraud flags",
        "severity": "critical"
    },
    
    # Failed Transaction Pattern
    "excessive_failed_attempts": {
        "enabled": True,
        "description": "Multiple failed transactions before successful one (testing pattern)",
        "max_failures_before_success": 3,
        "window_minutes": 60,
        "severity": "high"
    },
    
    # Device/Session Anomaly
    "multi_account_device": {
        "enabled": True,
        "description": "Multiple accounts transacting from same device/session",
        "max_accounts_per_device": 2,
        "window_hours": 24,
        "severity": "critical"
    },
    
    # Geographic Velocity (Impossible Travel)
    "impossible_travel": {
        "enabled": True,
        "description": "Transactions from geographically distant locations in impossible timeframe",
        "min_distance_km": 500,
        "max_travel_time_hours": 1,
        "severity": "critical"
    },
    
    # Layering Detection
    "layering_pattern": {
        "enabled": True,
        "description": "Funds moving through multiple accounts rapidly (layering)",
        "max_hops": 3,
        "time_window_hours": 4,
        "severity": "critical"
    }
}


async def analyze_transaction(transaction: dict) -> list:
    """
    Analyze a transaction against all detection rules.
    Returns list of triggered rules with details.
    """
    triggered_rules = []
    user_id = transaction.get("user_id")
    
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
            except ValueError:
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
            except ValueError:
                pass
    
    # ============== ADVANCED ML-INSPIRED RULE CHECKS ==============
    
    elif rule_id == "statistical_amount_anomaly":
        # Calculate Z-score for transaction amount
        min_history = rule.get("min_history_count", 10)
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$group": {
                "_id": None,
                "mean": {"$avg": "$amount_usd"},
                "count": {"$sum": 1},
                "amounts": {"$push": "$amount_usd"}
            }}
        ]
        result = await db.bl_transactions.aggregate(pipeline).to_list(1)
        if result and result[0]["count"] >= min_history:
            mean = result[0]["mean"]
            amounts = [a for a in result[0]["amounts"] if a is not None]
            if amounts and mean > 0:
                # Calculate standard deviation
                variance = sum((x - mean) ** 2 for x in amounts) / len(amounts)
                std_dev = variance ** 0.5
                if std_dev > 0:
                    z_score = (amount - mean) / std_dev
                    if abs(z_score) >= rule["z_score_threshold"]:
                        return {
                            "z_score": round(z_score, 2),
                            "amount": amount,
                            "user_mean": round(mean, 2),
                            "user_std_dev": round(std_dev, 2)
                        }
    
    elif rule_id == "unusual_time_pattern":
        txn_created = transaction.get("created_at")
        if txn_created:
            try:
                txn_time = datetime.fromisoformat(txn_created.replace("Z", "+00:00"))
                hour = txn_time.hour
                off_start = rule.get("off_hours_start", 2)
                off_end = rule.get("off_hours_end", 5)
                if off_start <= hour < off_end:
                    return {"transaction_hour": hour, "off_hours_range": f"{off_start}-{off_end}"}
            except ValueError:
                pass
    
    elif rule_id == "velocity_acceleration":
        comparison_hours = rule.get("comparison_period_hours", 24)
        baseline_hours = rule.get("baseline_period_hours", 168)
        
        comparison_start = (now - timedelta(hours=comparison_hours)).isoformat()
        baseline_start = (now - timedelta(hours=baseline_hours)).isoformat()
        
        recent_count = await db.bl_transactions.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": comparison_start}
        })
        
        baseline_count = await db.bl_transactions.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": baseline_start, "$lt": comparison_start}
        })
        
        if baseline_count > 0:
            # Normalize to per-day rates
            recent_rate = recent_count / (comparison_hours / 24)
            baseline_rate = baseline_count / ((baseline_hours - comparison_hours) / 24)
            
            if baseline_rate > 0 and recent_rate > baseline_rate * rule["acceleration_multiplier"]:
                return {
                    "recent_rate": round(recent_rate, 2),
                    "baseline_rate": round(baseline_rate, 2),
                    "acceleration": round(recent_rate / baseline_rate, 2)
                }
    
    elif rule_id == "amount_structuring":
        threshold = rule.get("threshold_amount", 500)
        tolerance = rule.get("tolerance_percentage", 10) / 100
        window_hours = rule.get("window_hours", 24)
        min_count = rule.get("min_count", 3)
        
        window_start = (now - timedelta(hours=window_hours)).isoformat()
        lower_bound = threshold * (1 - tolerance)
        
        structuring_txns = await db.bl_transactions.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": window_start},
            "amount_usd": {"$gte": lower_bound, "$lt": threshold}
        })
        
        if structuring_txns >= min_count:
            return {
                "count": structuring_txns,
                "threshold": threshold,
                "pattern": f"Multiple transactions between ${lower_bound:.0f}-${threshold}"
            }
    
    elif rule_id == "round_amount_pattern":
        round_threshold = rule.get("round_threshold", 50)
        window_hours = rule.get("window_hours", 48)
        min_count = rule.get("min_count", 5)
        
        window_start = (now - timedelta(hours=window_hours)).isoformat()
        
        # Count transactions with round amounts
        pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": window_start}}},
            {"$addFields": {
                "is_round": {"$eq": [{"$mod": ["$amount_usd", round_threshold]}, 0]}
            }},
            {"$match": {"is_round": True}},
            {"$count": "round_count"}
        ]
        result = await db.bl_transactions.aggregate(pipeline).to_list(1)
        round_count = result[0]["round_count"] if result else 0
        
        if round_count >= min_count:
            return {
                "round_transaction_count": round_count,
                "round_threshold": round_threshold,
                "window_hours": window_hours
            }
    
    elif rule_id == "low_recipient_diversity":
        window_hours = rule.get("window_hours", 24)
        min_txn_count = rule.get("min_transaction_count", 10)
        max_ratio = rule.get("max_recipient_ratio", 0.2)
        
        window_start = (now - timedelta(hours=window_hours)).isoformat()
        
        pipeline = [
            {"$match": {"user_id": user_id, "created_at": {"$gte": window_start}}},
            {"$group": {
                "_id": None,
                "total_transactions": {"$sum": 1},
                "unique_recipients": {"$addToSet": "$recipient_id"}
            }}
        ]
        result = await db.bl_transactions.aggregate(pipeline).to_list(1)
        
        if result and result[0]["total_transactions"] >= min_txn_count:
            total = result[0]["total_transactions"]
            unique = len([r for r in result[0]["unique_recipients"] if r])
            ratio = unique / total if total > 0 else 1
            
            if ratio < max_ratio:
                return {
                    "total_transactions": total,
                    "unique_recipients": unique,
                    "diversity_ratio": round(ratio, 3)
                }
    
    elif rule_id == "high_risk_beneficiary":
        recipient_id = transaction.get("recipient_id") or transaction.get("beneficiary_id")
        if recipient_id:
            # Check if recipient has existing fraud flags
            flagged_user = await db.users.find_one({
                "user_id": recipient_id,
                "$or": [
                    {"is_flagged": True},
                    {"fraud_score": {"$gte": 0.7}},
                    {"commission_hold": True}
                ]
            })
            if flagged_user:
                return {
                    "flagged_user_id": recipient_id,
                    "flag_reason": flagged_user.get("flag_reason", "Previous fraud detection")
                }
    
    elif rule_id == "excessive_failed_attempts":
        window_minutes = rule.get("window_minutes", 60)
        max_failures = rule.get("max_failures_before_success", 3)
        
        window_start = (now - timedelta(minutes=window_minutes)).isoformat()
        
        # Count failed transactions before this one
        failed_count = await db.bl_transactions.count_documents({
            "user_id": user_id,
            "created_at": {"$gte": window_start},
            "status": {"$in": ["failed", "declined", "error"]}
        })
        
        if failed_count >= max_failures and transaction.get("status") == "completed":
            return {
                "failed_attempts": failed_count,
                "window_minutes": window_minutes,
                "pattern": "Testing pattern detected"
            }
    
    elif rule_id == "multi_account_device":
        device_id = transaction.get("device_id") or user.get("last_device_id")
        if device_id:
            window_hours = rule.get("window_hours", 24)
            max_accounts = rule.get("max_accounts_per_device", 2)
            
            window_start = (now - timedelta(hours=window_hours)).isoformat()
            
            # Find other users with same device
            other_accounts = await db.users.count_documents({
                "user_id": {"$ne": user_id},
                "$or": [
                    {"last_device_id": device_id},
                    {"device_ids": device_id}
                ],
                "last_activity": {"$gte": window_start}
            })
            
            if other_accounts >= max_accounts:
                return {
                    "device_id": device_id,
                    "accounts_on_device": other_accounts + 1
                }
    
    elif rule_id == "impossible_travel":
        current_location = transaction.get("location") or transaction.get("ip_location")
        if current_location:
            # Get previous transaction location
            prev_txn = await db.bl_transactions.find_one(
                {"user_id": user_id, "created_at": {"$lt": transaction.get("created_at")}},
                sort=[("created_at", -1)]
            )
            if prev_txn:
                prev_location = prev_txn.get("location") or prev_txn.get("ip_location")
                if prev_location and prev_location.get("country") != current_location.get("country"):
                    try:
                        prev_time = datetime.fromisoformat(prev_txn["created_at"].replace("Z", "+00:00"))
                        curr_time = datetime.fromisoformat(transaction["created_at"].replace("Z", "+00:00"))
                        time_diff_hours = (curr_time - prev_time).total_seconds() / 3600
                        
                        if time_diff_hours < rule.get("max_travel_time_hours", 1):
                            return {
                                "previous_location": prev_location.get("country"),
                                "current_location": current_location.get("country"),
                                "time_between_hours": round(time_diff_hours, 2)
                            }
                    except (ValueError, TypeError):
                        pass
    
    elif rule_id == "layering_pattern":
        # Look for funds that quickly hop through accounts
        max_hops = rule.get("max_hops", 3)
        window_hours = rule.get("time_window_hours", 4)
        window_start = (now - timedelta(hours=window_hours)).isoformat()
        
        # Trace back incoming transfers
        incoming_source = transaction.get("source_user_id")
        if incoming_source and amount > 50:  # Only check meaningful amounts
            hop_count = 0
            current_source = incoming_source
            sources_chain = [user_id]
            
            for _ in range(max_hops):
                # Find where this source got the money
                source_txn = await db.bl_transactions.find_one({
                    "user_id": current_source,
                    "transaction_type": {"$in": ["transfer_in", "deposit"]},
                    "created_at": {"$gte": window_start}
                }, sort=[("created_at", -1)])
                
                if source_txn and source_txn.get("source_user_id"):
                    hop_count += 1
                    sources_chain.append(current_source)
                    current_source = source_txn.get("source_user_id")
                else:
                    break
            
            if hop_count >= max_hops:
                return {
                    "hop_count": hop_count,
                    "sources_chain": sources_chain[:5],  # Limit for display
                    "window_hours": window_hours
                }
    
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
    await db.bl_transactions.update_one(
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


# ============== FRAUD ANALYTICS ==============

async def get_fraud_analytics(days: int = 30) -> dict:
    """
    Get comprehensive fraud analytics and patterns.
    Provides ML-like insights without external ML service.
    """
    now = datetime.now(timezone.utc)
    start_date = (now - timedelta(days=days)).isoformat()
    
    analytics = {
        "period_days": days,
        "generated_at": now.isoformat()
    }
    
    # Total flagged transactions
    total_flagged = await db.bl_transactions.count_documents({
        "is_flagged": True,
        "flagged_at": {"$gte": start_date}
    })
    
    total_transactions = await db.bl_transactions.count_documents({
        "created_at": {"$gte": start_date}
    })
    
    analytics["summary"] = {
        "total_transactions": total_transactions,
        "flagged_transactions": total_flagged,
        "flag_rate_percentage": round(total_flagged / max(total_transactions, 1) * 100, 2)
    }
    
    # Flags by rule
    rule_pipeline = [
        {"$match": {"is_flagged": True, "flagged_at": {"$gte": start_date}}},
        {"$unwind": "$flag_reasons"},
        {"$group": {
            "_id": "$flag_reasons.rule_id",
            "count": {"$sum": 1},
            "avg_severity_score": {
                "$avg": {
                    "$switch": {
                        "branches": [
                            {"case": {"$eq": ["$flag_reasons.severity", "low"]}, "then": 1},
                            {"case": {"$eq": ["$flag_reasons.severity", "medium"]}, "then": 2},
                            {"case": {"$eq": ["$flag_reasons.severity", "high"]}, "then": 3},
                            {"case": {"$eq": ["$flag_reasons.severity", "critical"]}, "then": 4}
                        ],
                        "default": 2
                    }
                }
            }
        }},
        {"$sort": {"count": -1}}
    ]
    rules_breakdown = await db.bl_transactions.aggregate(rule_pipeline).to_list(50)
    analytics["rules_breakdown"] = rules_breakdown
    
    # Top flagged users
    user_pipeline = [
        {"$match": {"is_flagged": True, "flagged_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$user_id",
            "flag_count": {"$sum": 1},
            "total_flagged_amount": {"$sum": "$amount_usd"},
            "severities": {"$push": "$flag_severity"}
        }},
        {"$sort": {"flag_count": -1}},
        {"$limit": 20}
    ]
    top_flagged_users = await db.bl_transactions.aggregate(user_pipeline).to_list(20)
    
    # Enrich with user data
    for user in top_flagged_users:
        user_data = await db.users.find_one(
            {"user_id": user["_id"]},
            {"_id": 0, "username": 1, "email": 1, "subscription_tier": 1}
        )
        if user_data:
            user.update(user_data)
        # Calculate most common severity
        if user["severities"]:
            user["most_common_severity"] = max(set(user["severities"]), key=user["severities"].count)
    
    analytics["top_flagged_users"] = top_flagged_users
    
    # Severity distribution
    severity_pipeline = [
        {"$match": {"is_flagged": True, "flagged_at": {"$gte": start_date}}},
        {"$group": {
            "_id": "$flag_severity",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount_usd"}
        }}
    ]
    severity_distribution = await db.bl_transactions.aggregate(severity_pipeline).to_list(10)
    analytics["severity_distribution"] = severity_distribution
    
    # Time-based patterns (detect peak fraud hours)
    hour_pipeline = [
        {"$match": {"is_flagged": True, "flagged_at": {"$gte": start_date}}},
        {"$addFields": {
            "hour": {"$hour": {"$dateFromString": {"dateString": "$flagged_at"}}}
        }},
        {"$group": {
            "_id": "$hour",
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": 1}}
    ]
    hourly_distribution = await db.bl_transactions.aggregate(hour_pipeline).to_list(24)
    analytics["hourly_distribution"] = hourly_distribution
    
    # Find peak hours
    if hourly_distribution:
        peak_hour = max(hourly_distribution, key=lambda x: x["count"])
        analytics["peak_fraud_hour"] = peak_hour["_id"]
    
    # Daily trend
    daily_pipeline = [
        {"$match": {"is_flagged": True, "flagged_at": {"$gte": start_date}}},
        {"$addFields": {
            "date": {"$dateToString": {"format": "%Y-%m-%d", "date": {"$dateFromString": {"dateString": "$flagged_at"}}}}
        }},
        {"$group": {
            "_id": "$date",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount_usd"}
        }},
        {"$sort": {"_id": 1}}
    ]
    daily_trend = await db.bl_transactions.aggregate(daily_pipeline).to_list(days)
    analytics["daily_trend"] = daily_trend
    
    # Calculate risk score percentiles
    risk_pipeline = [
        {"$match": {"fraud_score": {"$exists": True}}},
        {"$group": {
            "_id": None,
            "avg_risk_score": {"$avg": "$fraud_score"},
            "max_risk_score": {"$max": "$fraud_score"},
            "high_risk_count": {"$sum": {"$cond": [{"$gte": ["$fraud_score", 0.7]}, 1, 0]}}
        }}
    ]
    risk_stats = await db.users.aggregate(risk_pipeline).to_list(1)
    analytics["risk_score_stats"] = risk_stats[0] if risk_stats else {}
    
    # Pending alerts
    pending_alerts = await db.admin_alerts.count_documents({
        "type": "suspicious_transaction",
        "status": "unread"
    })
    analytics["pending_alerts"] = pending_alerts
    
    return analytics


async def calculate_user_risk_score(user_id: str) -> dict:
    """
    Calculate a comprehensive risk score for a user based on multiple factors.
    Score ranges from 0.0 (safe) to 1.0 (high risk).
    """
    now = datetime.now(timezone.utc)
    user = await db.users.find_one({"user_id": user_id})
    
    if not user:
        return {"error": "User not found", "risk_score": 0.5}
    
    risk_factors = []
    total_weight = 0
    weighted_score = 0
    
    # Factor 1: Account age (newer = higher risk)
    created_at = user.get("created_at")
    if created_at:
        try:
            created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            account_age_days = (now - created).days
            
            if account_age_days < 7:
                score = 0.8
            elif account_age_days < 30:
                score = 0.5
            elif account_age_days < 90:
                score = 0.3
            else:
                score = 0.1
            
            weight = 15
            risk_factors.append({
                "factor": "account_age",
                "score": score,
                "weight": weight,
                "detail": f"{account_age_days} days old"
            })
            weighted_score += score * weight
            total_weight += weight
        except ValueError:
            pass
    
    # Factor 2: Previous flags
    flag_count = await db.bl_transactions.count_documents({
        "user_id": user_id,
        "is_flagged": True
    })
    
    if flag_count > 10:
        score = 0.9
    elif flag_count > 5:
        score = 0.7
    elif flag_count > 0:
        score = 0.4
    else:
        score = 0.0
    
    weight = 25
    risk_factors.append({
        "factor": "previous_flags",
        "score": score,
        "weight": weight,
        "detail": f"{flag_count} flagged transactions"
    })
    weighted_score += score * weight
    total_weight += weight
    
    # Factor 3: Transaction velocity
    week_ago = (now - timedelta(days=7)).isoformat()
    recent_txn_count = await db.bl_transactions.count_documents({
        "user_id": user_id,
        "created_at": {"$gte": week_ago}
    })
    
    if recent_txn_count > 100:
        score = 0.8
    elif recent_txn_count > 50:
        score = 0.5
    elif recent_txn_count > 20:
        score = 0.3
    else:
        score = 0.1
    
    weight = 15
    risk_factors.append({
        "factor": "transaction_velocity",
        "score": score,
        "weight": weight,
        "detail": f"{recent_txn_count} transactions this week"
    })
    weighted_score += score * weight
    total_weight += weight
    
    # Factor 4: Commission hold status
    if user.get("commission_hold"):
        score = 0.9
        detail = "Currently on commission hold"
    else:
        score = 0.0
        detail = "No holds"
    
    weight = 20
    risk_factors.append({
        "factor": "commission_hold",
        "score": score,
        "weight": weight,
        "detail": detail
    })
    weighted_score += score * weight
    total_weight += weight
    
    # Factor 5: Verification status
    if user.get("id_verified"):
        score = 0.0
    elif user.get("email_verified"):
        score = 0.3
    else:
        score = 0.6
    
    weight = 15
    risk_factors.append({
        "factor": "verification_status",
        "score": score,
        "weight": weight,
        "detail": f"ID: {user.get('id_verified', False)}, Email: {user.get('email_verified', False)}"
    })
    weighted_score += score * weight
    total_weight += weight
    
    # Factor 6: Referral patterns
    referral_count = await db.users.count_documents({"referred_by": user_id})
    suspicious_referrals = await db.users.count_documents({
        "referred_by": user_id,
        "$or": [{"is_flagged": True}, {"fraud_score": {"$gte": 0.7}}]
    })
    
    if referral_count > 0:
        suspicious_ratio = suspicious_referrals / referral_count
        score = min(suspicious_ratio * 1.5, 1.0)
    else:
        score = 0.2  # No referrals is slightly suspicious
    
    weight = 10
    risk_factors.append({
        "factor": "referral_quality",
        "score": score,
        "weight": weight,
        "detail": f"{suspicious_referrals}/{referral_count} suspicious referrals"
    })
    weighted_score += score * weight
    total_weight += weight
    
    # Calculate final score
    final_score = weighted_score / total_weight if total_weight > 0 else 0.5
    final_score = round(min(max(final_score, 0), 1), 3)  # Clamp between 0-1
    
    # Determine risk level
    if final_score >= 0.7:
        risk_level = "high"
    elif final_score >= 0.4:
        risk_level = "medium"
    else:
        risk_level = "low"
    
    # Update user's fraud score
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "fraud_score": final_score,
            "fraud_score_updated_at": now.isoformat()
        }}
    )
    
    return {
        "user_id": user_id,
        "risk_score": final_score,
        "risk_level": risk_level,
        "risk_factors": risk_factors,
        "calculated_at": now.isoformat()
    }


async def batch_calculate_risk_scores(limit: int = 100) -> dict:
    """Calculate risk scores for users with recent activity"""
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    
    # Find users with recent transactions
    pipeline = [
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$group": {"_id": "$user_id"}},
        {"$limit": limit}
    ]
    active_users = await db.bl_transactions.aggregate(pipeline).to_list(limit)
    
    results = {
        "processed": 0,
        "high_risk": 0,
        "medium_risk": 0,
        "low_risk": 0
    }
    
    for user in active_users:
        try:
            score_result = await calculate_user_risk_score(user["_id"])
            results["processed"] += 1
            
            if score_result.get("risk_level") == "high":
                results["high_risk"] += 1
            elif score_result.get("risk_level") == "medium":
                results["medium_risk"] += 1
            else:
                results["low_risk"] += 1
        except Exception as e:
            logger.error(f"Error calculating risk for {user['_id']}: {e}")
    
    return results
