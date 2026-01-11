"""
Real-time Analytics & A/B Testing System for Blendlink
- WebSocket for live analytics updates
- A/B Testing with configurable percentage splits
- Biometric authentication support
"""
from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Set
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import json
import asyncio
import random
import hashlib

# Import from main server
from server import get_current_user, db, logger

# Create routers
realtime_router = APIRouter(prefix="/realtime", tags=["Real-time Analytics"])
ab_testing_router = APIRouter(prefix="/ab-testing", tags=["A/B Testing"])
biometric_router = APIRouter(prefix="/biometric", tags=["Biometric Auth"])

# ============== WEBSOCKET CONNECTION MANAGER ==============

class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: Dict[str, Set[WebSocket]] = {
            "analytics": set(),
            "admin": set(),
            "notifications": set(),
        }
        self.user_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, channel: str, user_id: str = None):
        await websocket.accept()
        if channel not in self.active_connections:
            self.active_connections[channel] = set()
        self.active_connections[channel].add(websocket)
        if user_id:
            self.user_connections[user_id] = websocket
        logger.info(f"WebSocket connected to {channel}: {len(self.active_connections[channel])} connections")
    
    def disconnect(self, websocket: WebSocket, channel: str, user_id: str = None):
        if channel in self.active_connections:
            self.active_connections[channel].discard(websocket)
        if user_id and user_id in self.user_connections:
            del self.user_connections[user_id]
    
    async def broadcast(self, channel: str, message: dict):
        """Broadcast message to all connections in a channel"""
        if channel not in self.active_connections:
            return
        disconnected = set()
        for connection in self.active_connections[channel]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)
        for conn in disconnected:
            self.active_connections[channel].discard(conn)
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send message to specific user"""
        if user_id in self.user_connections:
            try:
                await self.user_connections[user_id].send_json(message)
            except Exception:
                del self.user_connections[user_id]

manager = ConnectionManager()

# ============== REAL-TIME ANALYTICS ==============

class AnalyticsMetric(str, Enum):
    USERS_ONLINE = "users_online"
    NEW_SIGNUPS = "new_signups"
    ACTIVE_SESSIONS = "active_sessions"
    REVENUE = "revenue"
    BL_COINS = "bl_coins_activity"
    NEW_POSTS = "new_posts"
    REACTIONS = "reactions"
    COMMENTS = "comments"
    TRANSACTIONS = "transactions"

# Track active users
active_users: Dict[str, datetime] = {}

async def get_realtime_metrics() -> dict:
    """Get current real-time metrics"""
    now = datetime.now(timezone.utc)
    five_min_ago = (now - timedelta(minutes=5)).isoformat()
    one_hour_ago = (now - timedelta(hours=1)).isoformat()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    
    # Clean up stale active users
    stale_threshold = now - timedelta(minutes=5)
    for user_id in list(active_users.keys()):
        if active_users[user_id] < stale_threshold:
            del active_users[user_id]
    
    # Get metrics from database
    users_online = len(active_users)
    new_signups_today = await db.users.count_documents({"created_at": {"$gte": today_start}})
    new_signups_hour = await db.users.count_documents({"created_at": {"$gte": one_hour_ago}})
    
    # Content metrics
    new_posts_hour = await db.posts.count_documents({"created_at": {"$gte": one_hour_ago}})
    new_posts_today = await db.posts.count_documents({"created_at": {"$gte": today_start}})
    
    # Transaction metrics
    recent_transactions = await db.transactions.count_documents({"created_at": {"$gte": one_hour_ago}})
    
    # BL Coins activity
    pipeline = [
        {"$match": {"created_at": {"$gte": one_hour_ago}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    coins_result = await db.transactions.aggregate(pipeline).to_list(1)
    bl_coins_activity = abs(coins_result[0]["total"]) if coins_result else 0
    
    # Casino activity
    casino_bets_hour = await db.casino_history.count_documents({"created_at": {"$gte": one_hour_ago}})
    
    return {
        "timestamp": now.isoformat(),
        "users_online": users_online,
        "active_sessions": users_online,
        "new_signups": {
            "hour": new_signups_hour,
            "today": new_signups_today,
        },
        "content": {
            "new_posts_hour": new_posts_hour,
            "new_posts_today": new_posts_today,
        },
        "transactions": {
            "count_hour": recent_transactions,
            "bl_coins_volume": bl_coins_activity,
        },
        "casino": {
            "bets_hour": casino_bets_hour,
        },
    }

@realtime_router.websocket("/ws/analytics")
async def websocket_analytics(websocket: WebSocket, token: str = Query(None)):
    """WebSocket endpoint for real-time analytics"""
    # Verify admin token
    user_id = None
    if token:
        try:
            from server import verify_token
            user_id = verify_token(token)
            user = await db.users.find_one({"user_id": user_id})
            if not user or not user.get("is_admin"):
                await websocket.close(code=4003)
                return
        except Exception:
            await websocket.close(code=4001)
            return
    
    await manager.connect(websocket, "analytics", user_id)
    
    try:
        # Send initial data
        metrics = await get_realtime_metrics()
        await websocket.send_json({"type": "initial", "data": metrics})
        
        # Keep connection alive and send updates
        while True:
            try:
                # Wait for messages or timeout
                data = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
                
                if data == "ping":
                    await websocket.send_text("pong")
                elif data == "refresh":
                    metrics = await get_realtime_metrics()
                    await websocket.send_json({"type": "update", "data": metrics})
                    
            except asyncio.TimeoutError:
                # Send periodic updates
                metrics = await get_realtime_metrics()
                await websocket.send_json({"type": "update", "data": metrics})
                
    except WebSocketDisconnect:
        manager.disconnect(websocket, "analytics", user_id)

@realtime_router.post("/heartbeat")
async def user_heartbeat(current_user: dict = Depends(get_current_user)):
    """Track user as active"""
    active_users[current_user["user_id"]] = datetime.now(timezone.utc)
    return {"status": "ok"}

@realtime_router.get("/metrics")
async def get_metrics(current_user: dict = Depends(get_current_user)):
    """Get current real-time metrics (REST endpoint)"""
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return await get_realtime_metrics()

# ============== A/B TESTING SYSTEM ==============

class ABTestType(str, Enum):
    UI_ELEMENT = "ui_element"
    FEATURE = "feature"
    CONTENT = "content"
    ONBOARDING = "onboarding"
    PRICING = "pricing"

class ABTestStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"

class ABTestVariant(BaseModel):
    variant_id: str = Field(default_factory=lambda: f"var_{uuid.uuid4().hex[:8]}")
    name: str
    description: Optional[str] = None
    percentage: float = 50.0  # Percentage of users assigned to this variant
    config: Dict[str, Any] = {}  # Variant-specific configuration
    conversions: int = 0
    impressions: int = 0

class ABTest(BaseModel):
    test_id: str = Field(default_factory=lambda: f"ab_{uuid.uuid4().hex[:12]}")
    name: str
    description: Optional[str] = None
    test_type: ABTestType
    status: ABTestStatus = ABTestStatus.DRAFT
    variants: List[ABTestVariant] = []
    target_audience: Dict[str, Any] = {}  # Targeting rules
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    created_by: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
class CreateABTestRequest(BaseModel):
    name: str
    description: Optional[str] = None
    test_type: ABTestType
    variants: List[Dict[str, Any]]  # [{name, percentage, config}]
    target_audience: Optional[Dict[str, Any]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

@ab_testing_router.post("/tests")
async def create_ab_test(
    data: CreateABTestRequest,
    current_user: dict = Depends(get_current_user)
):
    """Create a new A/B test"""
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate percentages sum to 100
    total_percentage = sum(v.get("percentage", 0) for v in data.variants)
    if abs(total_percentage - 100) > 0.01:
        raise HTTPException(status_code=400, detail=f"Variant percentages must sum to 100 (got {total_percentage})")
    
    # Create variants
    variants = []
    for v in data.variants:
        variant = ABTestVariant(
            name=v["name"],
            description=v.get("description"),
            percentage=v.get("percentage", 50),
            config=v.get("config", {}),
        )
        variants.append(variant.model_dump())
    
    test = ABTest(
        name=data.name,
        description=data.description,
        test_type=data.test_type,
        variants=variants,
        target_audience=data.target_audience or {},
        start_date=data.start_date,
        end_date=data.end_date,
        created_by=current_user["user_id"],
    )
    
    test_dict = test.model_dump()
    await db.ab_tests.insert_one(test_dict.copy())
    
    return test_dict

@ab_testing_router.get("/tests")
async def list_ab_tests(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List all A/B tests"""
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if status:
        query["status"] = status
    
    tests = await db.ab_tests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return tests

@ab_testing_router.get("/tests/{test_id}")
async def get_ab_test(test_id: str, current_user: dict = Depends(get_current_user)):
    """Get A/B test details with results"""
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    test = await db.ab_tests.find_one({"test_id": test_id}, {"_id": 0})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Calculate conversion rates
    for variant in test.get("variants", []):
        impressions = variant.get("impressions", 0)
        conversions = variant.get("conversions", 0)
        variant["conversion_rate"] = (conversions / impressions * 100) if impressions > 0 else 0
    
    return test

@ab_testing_router.put("/tests/{test_id}/status")
async def update_test_status(
    test_id: str,
    status: ABTestStatus,
    current_user: dict = Depends(get_current_user)
):
    """Update A/B test status (activate, pause, complete)"""
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    test = await db.ab_tests.find_one({"test_id": test_id})
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    updates = {
        "status": status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    if status == ABTestStatus.ACTIVE and not test.get("start_date"):
        updates["start_date"] = datetime.now(timezone.utc).isoformat()
    elif status == ABTestStatus.COMPLETED and not test.get("end_date"):
        updates["end_date"] = datetime.now(timezone.utc).isoformat()
    
    await db.ab_tests.update_one({"test_id": test_id}, {"$set": updates})
    
    return {"message": f"Test status updated to {status}", "test_id": test_id}

@ab_testing_router.delete("/tests/{test_id}")
async def delete_ab_test(test_id: str, current_user: dict = Depends(get_current_user)):
    """Delete an A/B test"""
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    if not user or not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.ab_tests.delete_one({"test_id": test_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Also clean up user assignments
    await db.ab_test_assignments.delete_many({"test_id": test_id})
    
    return {"message": "Test deleted", "test_id": test_id}

@ab_testing_router.get("/assignment/{test_id}")
async def get_user_assignment(
    test_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get user's assigned variant for a test"""
    # Check if user already has an assignment
    assignment = await db.ab_test_assignments.find_one({
        "test_id": test_id,
        "user_id": current_user["user_id"]
    }, {"_id": 0})
    
    if assignment:
        return assignment
    
    # Get the test
    test = await db.ab_tests.find_one({"test_id": test_id, "status": "active"}, {"_id": 0})
    if not test:
        return {"variant_id": None, "message": "Test not active"}
    
    # Assign user to a variant based on percentages
    user_hash = hashlib.md5(f"{current_user['user_id']}:{test_id}".encode()).hexdigest()
    hash_value = int(user_hash[:8], 16) % 10000 / 100  # 0-100 range
    
    cumulative = 0
    assigned_variant = None
    for variant in test.get("variants", []):
        cumulative += variant.get("percentage", 0)
        if hash_value < cumulative:
            assigned_variant = variant
            break
    
    if not assigned_variant and test.get("variants"):
        assigned_variant = test["variants"][-1]
    
    if assigned_variant:
        # Save assignment
        new_assignment = {
            "assignment_id": f"assign_{uuid.uuid4().hex[:12]}",
            "test_id": test_id,
            "user_id": current_user["user_id"],
            "variant_id": assigned_variant["variant_id"],
            "variant_name": assigned_variant["name"],
            "config": assigned_variant.get("config", {}),
            "assigned_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.ab_test_assignments.insert_one(new_assignment.copy())
        
        # Increment impressions
        await db.ab_tests.update_one(
            {"test_id": test_id, "variants.variant_id": assigned_variant["variant_id"]},
            {"$inc": {"variants.$.impressions": 1}}
        )
        
        return new_assignment
    
    return {"variant_id": None, "message": "No variant assigned"}

@ab_testing_router.post("/conversion/{test_id}")
async def track_conversion(
    test_id: str,
    conversion_type: str = "default",
    current_user: dict = Depends(get_current_user)
):
    """Track a conversion event for A/B test"""
    # Get user's assignment
    assignment = await db.ab_test_assignments.find_one({
        "test_id": test_id,
        "user_id": current_user["user_id"]
    })
    
    if not assignment:
        return {"message": "User not in test"}
    
    # Check if already converted for this type
    existing = await db.ab_test_conversions.find_one({
        "test_id": test_id,
        "user_id": current_user["user_id"],
        "conversion_type": conversion_type,
    })
    
    if existing:
        return {"message": "Already converted", "conversion_id": existing.get("conversion_id")}
    
    # Record conversion
    conversion = {
        "conversion_id": f"conv_{uuid.uuid4().hex[:12]}",
        "test_id": test_id,
        "user_id": current_user["user_id"],
        "variant_id": assignment["variant_id"],
        "conversion_type": conversion_type,
        "converted_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.ab_test_conversions.insert_one(conversion.copy())
    
    # Increment conversions
    await db.ab_tests.update_one(
        {"test_id": test_id, "variants.variant_id": assignment["variant_id"]},
        {"$inc": {"variants.$.conversions": 1}}
    )
    
    return {"message": "Conversion tracked", "conversion_id": conversion["conversion_id"]}

@ab_testing_router.get("/active")
async def get_active_tests_for_user(current_user: dict = Depends(get_current_user)):
    """Get all active tests and user's assignments"""
    active_tests = await db.ab_tests.find(
        {"status": "active"},
        {"_id": 0, "test_id": 1, "name": 1, "test_type": 1}
    ).to_list(50)
    
    # Get user's assignments
    assignments = await db.ab_test_assignments.find(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    ).to_list(100)
    
    assignment_map = {a["test_id"]: a for a in assignments}
    
    result = []
    for test in active_tests:
        test_data = {
            "test_id": test["test_id"],
            "name": test["name"],
            "test_type": test["test_type"],
            "assignment": assignment_map.get(test["test_id"]),
        }
        result.append(test_data)
    
    return result

# ============== BIOMETRIC AUTHENTICATION ==============

class BiometricCredential(BaseModel):
    credential_id: str = Field(default_factory=lambda: f"bio_{uuid.uuid4().hex[:16]}")
    user_id: str
    device_id: str
    device_name: str
    credential_type: str  # "touchid", "faceid", "fingerprint"
    public_key: str  # For WebAuthn
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_used: Optional[str] = None
    is_active: bool = True

class RegisterBiometricRequest(BaseModel):
    device_id: str
    device_name: str
    credential_type: str
    public_key: str
    platform: str  # "ios", "android", "web"

class BiometricAuthRequest(BaseModel):
    device_id: str
    credential_id: str
    signature: str  # Signed challenge

@biometric_router.post("/register")
async def register_biometric(
    data: RegisterBiometricRequest,
    current_user: dict = Depends(get_current_user)
):
    """Register a biometric credential for a device"""
    # Check if credential already exists for this device
    existing = await db.biometric_credentials.find_one({
        "user_id": current_user["user_id"],
        "device_id": data.device_id,
        "is_active": True,
    })
    
    if existing:
        # Update existing credential
        await db.biometric_credentials.update_one(
            {"credential_id": existing["credential_id"]},
            {"$set": {
                "public_key": data.public_key,
                "credential_type": data.credential_type,
                "device_name": data.device_name,
            }}
        )
        return {"message": "Credential updated", "credential_id": existing["credential_id"]}
    
    # Create new credential
    credential = BiometricCredential(
        user_id=current_user["user_id"],
        device_id=data.device_id,
        device_name=data.device_name,
        credential_type=data.credential_type,
        public_key=data.public_key,
    )
    
    cred_dict = credential.model_dump()
    await db.biometric_credentials.insert_one(cred_dict.copy())
    
    return {
        "message": "Biometric registered",
        "credential_id": credential.credential_id,
        "device_name": data.device_name,
    }

@biometric_router.get("/challenge")
async def get_biometric_challenge(device_id: str):
    """Get a challenge for biometric authentication"""
    # Generate random challenge
    challenge = uuid.uuid4().hex + uuid.uuid4().hex
    
    # Store challenge temporarily (expires in 5 minutes)
    await db.biometric_challenges.insert_one({
        "challenge": challenge,
        "device_id": device_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
    })
    
    return {"challenge": challenge, "expires_in": 300}

@biometric_router.post("/authenticate")
async def biometric_authenticate(data: BiometricAuthRequest):
    """Authenticate using biometric credential"""
    # Get credential
    credential = await db.biometric_credentials.find_one({
        "credential_id": data.credential_id,
        "device_id": data.device_id,
        "is_active": True,
    }, {"_id": 0})
    
    if not credential:
        raise HTTPException(status_code=401, detail="Invalid credential")
    
    # In production, verify signature against public key
    # For now, we trust the client's biometric verification
    
    # Update last used
    await db.biometric_credentials.update_one(
        {"credential_id": data.credential_id},
        {"$set": {"last_used": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Get user and create token
    user = await db.users.find_one({"user_id": credential["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    from server import create_token
    token = create_token(user["user_id"])
    
    return {
        "token": token,
        "user": user,
        "biometric_type": credential["credential_type"],
    }

@biometric_router.get("/credentials")
async def list_biometric_credentials(current_user: dict = Depends(get_current_user)):
    """List user's registered biometric credentials"""
    credentials = await db.biometric_credentials.find(
        {"user_id": current_user["user_id"], "is_active": True},
        {"_id": 0, "public_key": 0}
    ).to_list(10)
    
    return credentials

@biometric_router.delete("/credentials/{credential_id}")
async def revoke_biometric_credential(
    credential_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Revoke a biometric credential"""
    result = await db.biometric_credentials.update_one(
        {"credential_id": credential_id, "user_id": current_user["user_id"]},
        {"$set": {"is_active": False}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Credential not found")
    
    return {"message": "Credential revoked"}

# ============== BROADCAST FUNCTIONS ==============

async def broadcast_analytics_update():
    """Broadcast real-time analytics update to all connected admins"""
    metrics = await get_realtime_metrics()
    await manager.broadcast("analytics", {"type": "update", "data": metrics})

async def broadcast_new_user(user_data: dict):
    """Broadcast new user signup"""
    await manager.broadcast("analytics", {
        "type": "event",
        "event": "new_signup",
        "data": {
            "user_id": user_data.get("user_id"),
            "name": user_data.get("name"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    })

async def broadcast_transaction(transaction_data: dict):
    """Broadcast transaction event"""
    await manager.broadcast("analytics", {
        "type": "event",
        "event": "transaction",
        "data": transaction_data,
    })
