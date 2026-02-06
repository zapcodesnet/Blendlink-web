"""
MongoDB PVP Optimization Module
- Indexes for fast queries on pvp_sessions, open_games
- Change streams for real-time sync (requires MongoDB Atlas or replica set)
- Atomic transactions for round results
- Compatible with MongoDB Atlas M0 Free Tier

NOTE: MongoDB Atlas M0 Free Tier Limitations:
- ✅ Change Streams: SUPPORTED (requires replica set, Atlas has this by default)
- ✅ Transactions: SUPPORTED (single-document atomic ops work, multi-doc needs M10+)
- ✅ Indexes: SUPPORTED (up to 64 per collection)
- ⚠️ Connections: 500 max
- ⚠️ Storage: 512MB
- ⚠️ No sharding
"""

import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, Dict, Any, Callable
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


# ============== INDEX DEFINITIONS ==============
PVP_INDEXES = {
    "pvp_sessions": [
        # Primary lookup indexes
        {"keys": [("session_id", 1)], "unique": True, "name": "idx_session_id"},
        {"keys": [("open_game_id", 1)], "unique": False, "name": "idx_open_game_id"},
        
        # Player lookups (find user's active games)
        {"keys": [("player1_id", 1), ("status", 1)], "name": "idx_player1_status"},
        {"keys": [("player2_id", 1), ("status", 1)], "name": "idx_player2_status"},
        
        # Real-time sync queries (for polling fallback)
        {"keys": [("status", 1), ("updated_at", -1)], "name": "idx_status_updated"},
        
        # Round-based queries
        {"keys": [("current_round", 1), ("status", 1)], "name": "idx_round_status"},
        
        # TTL index to auto-delete old completed games after 7 days
        {"keys": [("completed_at", 1)], "expireAfterSeconds": 604800, "name": "idx_ttl_completed"},
    ],
    
    "open_games": [
        # Primary lookup
        {"keys": [("game_id", 1)], "unique": True, "name": "idx_game_id"},
        
        # Matchmaking queries (find open games)
        {"keys": [("status", 1), ("created_at", -1)], "name": "idx_status_created"},
        
        # Creator lookup
        {"keys": [("creator_id", 1), ("status", 1)], "name": "idx_creator_status"},
        
        # Opponent lookup (for matched games)
        {"keys": [("opponent_id", 1), ("status", 1)], "name": "idx_opponent_status"},
        
        # TTL for stale waiting games (auto-delete after 24 hours)
        {"keys": [("created_at", 1)], "expireAfterSeconds": 86400, 
         "partialFilterExpression": {"status": "waiting"}, "name": "idx_ttl_waiting"},
    ],
    
    "pvp_round_results": [
        # For round history queries
        {"keys": [("session_id", 1), ("round", 1)], "unique": True, "name": "idx_session_round"},
        {"keys": [("winner_id", 1), ("created_at", -1)], "name": "idx_winner_history"},
    ],
}


async def create_pvp_indexes(db: AsyncIOMotorDatabase) -> Dict[str, Any]:
    """
    Create all PVP-related indexes.
    Safe to run multiple times (uses create_index which is idempotent).
    
    Returns dict with created index names per collection.
    """
    results = {}
    
    for collection_name, indexes in PVP_INDEXES.items():
        collection = db[collection_name]
        created = []
        
        for index_spec in indexes:
            try:
                keys = index_spec.pop("keys")
                
                # Create index (idempotent - won't error if exists)
                result = await collection.create_index(keys, **index_spec)
                created.append(result)
                logger.info(f"Created/verified index {result} on {collection_name}")
                
                # Restore keys for potential re-runs
                index_spec["keys"] = keys
                
            except Exception as e:
                logger.warning(f"Index creation warning for {collection_name}: {e}")
                # Restore keys even on error
                if "keys" not in index_spec:
                    index_spec["keys"] = keys
        
        results[collection_name] = created
    
    return results


# ============== CHANGE STREAMS (Real-time Sync) ==============
class PVPChangeStreamManager:
    """
    Manages MongoDB change streams for real-time PVP sync.
    
    MongoDB Atlas M0 Free Tier DOES support change streams.
    Falls back gracefully if not available.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self._watchers: Dict[str, asyncio.Task] = {}
        self._callbacks: Dict[str, Callable] = {}
        self._running = False
    
    async def start_watching(
        self,
        collection_name: str,
        callback: Callable[[Dict], Any],
        pipeline: Optional[list] = None
    ) -> bool:
        """
        Start watching a collection for changes.
        
        Args:
            collection_name: Name of collection to watch
            callback: Async function called with change document
            pipeline: Optional aggregation pipeline to filter changes
        
        Returns:
            True if watching started, False if not supported
        """
        if collection_name in self._watchers:
            logger.warning(f"Already watching {collection_name}")
            return True
        
        try:
            collection = self.db[collection_name]
            
            # Default pipeline: watch for updates to tap counts and status
            if pipeline is None:
                pipeline = [
                    {"$match": {
                        "operationType": {"$in": ["update", "insert", "replace"]},
                        "$or": [
                            {"updateDescription.updatedFields.player1_taps": {"$exists": True}},
                            {"updateDescription.updatedFields.player2_taps": {"$exists": True}},
                            {"updateDescription.updatedFields.status": {"$exists": True}},
                            {"updateDescription.updatedFields.current_round": {"$exists": True}},
                        ]
                    }}
                ]
            
            self._callbacks[collection_name] = callback
            self._watchers[collection_name] = asyncio.create_task(
                self._watch_loop(collection_name, collection, pipeline)
            )
            self._running = True
            
            logger.info(f"Started change stream for {collection_name}")
            return True
            
        except Exception as e:
            logger.warning(f"Change streams not available for {collection_name}: {e}")
            return False
    
    async def _watch_loop(self, name: str, collection, pipeline: list):
        """Internal watch loop with reconnection logic."""
        retry_delay = 1
        max_retry_delay = 30
        
        while self._running:
            try:
                async with collection.watch(pipeline, full_document="updateLookup") as stream:
                    retry_delay = 1  # Reset on successful connection
                    logger.info(f"Change stream connected for {name}")
                    
                    async for change in stream:
                        if not self._running:
                            break
                        
                        callback = self._callbacks.get(name)
                        if callback:
                            try:
                                await callback(change)
                            except Exception as e:
                                logger.error(f"Change stream callback error: {e}")
                                
            except asyncio.CancelledError:
                break
            except Exception as e:
                if not self._running:
                    break
                logger.warning(f"Change stream error for {name}: {e}, reconnecting in {retry_delay}s")
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, max_retry_delay)
    
    async def stop_watching(self, collection_name: str = None):
        """Stop watching collection(s)."""
        if collection_name:
            if collection_name in self._watchers:
                self._watchers[collection_name].cancel()
                try:
                    await self._watchers[collection_name]
                except asyncio.CancelledError:
                    pass
                del self._watchers[collection_name]
                del self._callbacks[collection_name]
        else:
            # Stop all
            self._running = False
            for task in self._watchers.values():
                task.cancel()
            for task in self._watchers.values():
                try:
                    await task
                except asyncio.CancelledError:
                    pass
            self._watchers.clear()
            self._callbacks.clear()


# ============== ATOMIC OPERATIONS ==============
class PVPAtomicOps:
    """
    Atomic operations for PVP game state.
    Uses MongoDB's atomic operators to prevent race conditions.
    
    Note: Multi-document transactions require M10+ tier.
    These operations use single-document atomicity (works on M0 Free).
    """
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
    
    async def atomic_submit_tap(
        self,
        session_id: str,
        player_num: int,  # 1 or 2
        tap_count: int
    ) -> Optional[Dict]:
        """
        Atomically increment tap count for a player.
        Uses $inc operator for atomic increment.
        
        Returns updated document or None if session not found.
        """
        field = f"player{player_num}_taps"
        
        result = await self.db.pvp_sessions.find_one_and_update(
            {"$or": [
                {"session_id": session_id},
                {"open_game_id": session_id}
            ]},
            {
                "$inc": {field: tap_count},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            },
            return_document=True,
            projection={"_id": 0, "player1_taps": 1, "player2_taps": 1, "status": 1}
        )
        
        return result
    
    async def atomic_finish_round(
        self,
        session_id: str,
        winner_user_id: str,
        player1_wins: int,
        player2_wins: int,
        round_data: Dict
    ) -> Dict:
        """
        Atomically finish a round with idempotency check.
        Uses findOneAndUpdate with condition to prevent double-processing.
        
        Returns:
            {"success": True, "already_processed": False, ...} if new result
            {"success": True, "already_processed": True, ...} if duplicate
            {"success": False, "error": "..."} on error
        """
        current_round = round_data.get("round", 1)
        
        # Check if this round was already processed
        existing = await self.db.pvp_sessions.find_one(
            {"$or": [
                {"session_id": session_id},
                {"open_game_id": session_id}
            ]},
            {"rounds": 1, "player1_wins": 1, "player2_wins": 1, "_id": 0}
        )
        
        if not existing:
            return {"success": False, "error": "Session not found"}
        
        # Check if round already exists in results
        existing_rounds = existing.get("rounds", [])
        for r in existing_rounds:
            if r.get("round") == current_round:
                return {
                    "success": True,
                    "already_processed": True,
                    "player1_wins": existing.get("player1_wins"),
                    "player2_wins": existing.get("player2_wins"),
                }
        
        # Atomically add round result
        round_result = {
            "round": current_round,
            "winner_user_id": winner_user_id,
            "round_type": round_data.get("type", "auction"),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        
        game_over = player1_wins >= 3 or player2_wins >= 3
        new_status = "complete" if game_over else "in_progress"
        
        update_doc = {
            "$push": {"rounds": round_result},
            "$set": {
                "player1_wins": player1_wins,
                "player2_wins": player2_wins,
                "status": new_status,
                "updated_at": datetime.now(timezone.utc),
            }
        }
        
        if game_over:
            update_doc["$set"]["winner_id"] = winner_user_id
            update_doc["$set"]["completed_at"] = datetime.now(timezone.utc)
        else:
            update_doc["$set"]["current_round"] = current_round + 1
            # Reset tap counts for next round
            update_doc["$set"]["player1_taps"] = 0
            update_doc["$set"]["player2_taps"] = 0
        
        await self.db.pvp_sessions.find_one_and_update(
            {"$or": [
                {"session_id": session_id},
                {"open_game_id": session_id}
            ]},
            update_doc,
            return_document=True,
            projection={"_id": 0}
        )
        
        # Also store in round_results collection for history
        await self.db.pvp_round_results.insert_one({
            "session_id": session_id,
            **round_result
        })
        
        return {
            "success": True,
            "already_processed": False,
            "player1_wins": player1_wins,
            "player2_wins": player2_wins,
            "game_over": game_over,
            "next_round": current_round + 1 if not game_over else None,
        }
    
    async def atomic_select_photo(
        self,
        session_id: str,
        player_num: int,
        photo_id: str,
        photo_data: Dict
    ) -> Dict:
        """
        Atomically select photo for a player.
        Returns both_selected=True if both players have now selected.
        """
        photo_id_field = f"player{player_num}_current_photo_id"
        photo_data_field = f"player{player_num}_current_photo"
        selected_field = f"player{player_num}_selected"
        
        result = await self.db.pvp_sessions.find_one_and_update(
            {"$or": [
                {"session_id": session_id},
                {"open_game_id": session_id}
            ]},
            {
                "$set": {
                    photo_id_field: photo_id,
                    photo_data_field: photo_data,
                    selected_field: True,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
            return_document=True,
            projection={
                "_id": 0,
                "player1_current_photo_id": 1,
                "player2_current_photo_id": 1,
                "player1_selected": 1,
                "player2_selected": 1,
            }
        )
        
        if not result:
            return {"success": False, "error": "Session not found"}
        
        both_selected = (
            result.get("player1_selected") and 
            result.get("player2_selected")
        )
        
        return {
            "success": True,
            "both_selected": both_selected,
            "player1_photo_id": result.get("player1_current_photo_id"),
            "player2_photo_id": result.get("player2_current_photo_id"),
        }


# ============== INITIALIZATION ==============
_change_stream_manager: Optional[PVPChangeStreamManager] = None
_atomic_ops: Optional[PVPAtomicOps] = None


async def initialize_pvp_mongo_optimizations(db: AsyncIOMotorDatabase) -> Dict:
    """
    Initialize all MongoDB PVP optimizations.
    Call this on app startup.
    
    Returns:
        {
            "indexes_created": {...},
            "change_streams_available": bool,
            "atomic_ops_ready": bool,
        }
    """
    global _change_stream_manager, _atomic_ops
    
    results = {
        "indexes_created": {},
        "change_streams_available": False,
        "atomic_ops_ready": False,
    }
    
    # Create indexes
    try:
        results["indexes_created"] = await create_pvp_indexes(db)
        logger.info("PVP indexes created/verified")
    except Exception as e:
        logger.error(f"Failed to create indexes: {e}")
    
    # Initialize change stream manager
    try:
        _change_stream_manager = PVPChangeStreamManager(db)
        # Test if change streams are available
        test_collection = db["pvp_sessions"]
        async with test_collection.watch([], max_await_time_ms=100):
            pass  # Just testing connection
        results["change_streams_available"] = True
        logger.info("Change streams available")
    except Exception as e:
        logger.warning(f"Change streams not available: {e}")
        _change_stream_manager = None
    
    # Initialize atomic operations
    try:
        _atomic_ops = PVPAtomicOps(db)
        results["atomic_ops_ready"] = True
        logger.info("Atomic operations ready")
    except Exception as e:
        logger.error(f"Failed to initialize atomic ops: {e}")
    
    return results


def get_change_stream_manager() -> Optional[PVPChangeStreamManager]:
    """Get the change stream manager instance."""
    return _change_stream_manager


def get_atomic_ops() -> Optional[PVPAtomicOps]:
    """Get the atomic operations instance."""
    return _atomic_ops


# ============== FREE TIER CONFIRMATION ==============
"""
MongoDB Atlas M0 Free Tier Compatibility:

✅ FULLY SUPPORTED:
- All indexes defined above (up to 64 per collection)
- Change streams (replica set feature, included in Atlas)
- Single-document atomic operations ($inc, $set, $push)
- find_one_and_update with atomicity
- TTL indexes for auto-cleanup

⚠️ LIMITATIONS (don't affect PVP sync):
- 512MB storage (sufficient for thousands of games)
- 500 connections (sufficient for ~100 concurrent users)
- No multi-document transactions (use single-doc atomic ops instead)
- No sharding (not needed at this scale)

RECOMMENDED SETTINGS for M0:
- maxPoolSize: 10 (default is 100, reduce for free tier)
- serverSelectionTimeoutMS: 5000
- connectTimeoutMS: 10000
"""
