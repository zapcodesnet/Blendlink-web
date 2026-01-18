"""
Blendlink Photo Game API Routes
- Game sessions
- RPS battles
- Photo battles
- Leaderboards
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import logging

from photo_game import (
    init_game_service,
    PhotoGameService,
    MAX_STAMINA,
    STAMINA_PER_BATTLE,
)

logger = logging.getLogger(__name__)

# Router
game_router = APIRouter(prefix="/photo-game", tags=["Photo Game"])

# Service will be initialized when routes are included
_game_service: Optional[PhotoGameService] = None


def get_game_service() -> PhotoGameService:
    if not _game_service:
        raise HTTPException(status_code=500, detail="Game service not initialized")
    return _game_service


# ============== REQUEST MODELS ==============
class StartGameRequest(BaseModel):
    opponent_id: str = "bot"  # "bot" for bot games
    bet_amount: int = 0
    photo_id: Optional[str] = None


class RPSMoveRequest(BaseModel):
    choice: str  # rock, paper, scissors


# ============== ROUTES ==============
@game_router.get("/config")
async def get_game_config():
    """Get game configuration"""
    return {
        "max_stamina": MAX_STAMINA,
        "stamina_per_battle": STAMINA_PER_BATTLE,
        "stamina_regen_hours": 24,
        "win_streak_multipliers": {
            "3": 1.25,
            "4": 1.50,
            "5": 1.75,
            "6+": 2.00,
        },
        "strength_multiplier": 1.25,
    }


@game_router.get("/stats")
async def get_my_stats(current_user: dict = Depends()):
    """Get current user's game stats"""
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _game_service
    if not _game_service:
        _game_service = init_game_service(db)
    
    stats = await _game_service.get_player_stats(current_user["user_id"])
    return stats


@game_router.get("/stats/{user_id}")
async def get_user_stats(user_id: str):
    """Get a user's public game stats"""
    from server import db
    
    global _game_service
    if not _game_service:
        _game_service = init_game_service(db)
    
    stats = await _game_service.get_player_stats(user_id)
    
    # Remove sensitive fields
    stats.pop("stamina", None)
    stats.pop("last_stamina_update", None)
    
    return stats


@game_router.post("/start")
async def start_game(
    data: StartGameRequest,
    current_user: dict = Depends()
):
    """
    Start a new game session
    
    - Requires stamina
    - Optional BL coin bet
    - Select a minted photo for battle
    """
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _game_service
    if not _game_service:
        _game_service = init_game_service(db)
    
    result = await _game_service.start_game(
        player_id=current_user["user_id"],
        opponent_id=data.opponent_id,
        bet_amount=data.bet_amount,
        player_photo_id=data.photo_id,
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@game_router.post("/session/{session_id}/rps")
async def play_rps(
    session_id: str,
    data: RPSMoveRequest,
    current_user: dict = Depends()
):
    """
    Play a Rock-Paper-Scissors round
    
    First to 3 wins advances to next phase
    """
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _game_service
    if not _game_service:
        _game_service = init_game_service(db)
    
    result = await _game_service.play_rps_round(
        session_id=session_id,
        player_id=current_user["user_id"],
        choice=data.choice.lower(),
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@game_router.post("/session/{session_id}/photo-battle")
async def execute_photo_battle(
    session_id: str,
    current_user: dict = Depends()
):
    """
    Execute the photo battle phase
    
    Photos are compared based on dollar value with strength/weakness modifiers
    """
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    global _game_service
    if not _game_service:
        _game_service = init_game_service(db)
    
    result = await _game_service.play_photo_battle(
        session_id=session_id,
        player_id=current_user["user_id"],
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@game_router.get("/session/{session_id}")
async def get_game_session(session_id: str):
    """Get current game session state"""
    from server import db
    
    session = await db.game_sessions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session


@game_router.get("/sessions/active")
async def get_active_sessions(current_user: dict = Depends()):
    """Get user's active game sessions"""
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    sessions = await db.game_sessions.find(
        {
            "player1_id": current_user["user_id"],
            "phase": {"$ne": "completed"},
        },
        {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    
    return {"sessions": sessions}


@game_router.get("/sessions/history")
async def get_game_history(
    skip: int = 0,
    limit: int = 20,
    current_user: dict = Depends()
):
    """Get user's completed game history"""
    from server import get_current_user, db
    current_user = await get_current_user(current_user)
    
    sessions = await db.game_sessions.find(
        {
            "$or": [
                {"player1_id": current_user["user_id"]},
                {"player2_id": current_user["user_id"]},
            ],
            "phase": "completed",
        },
        {"_id": 0}
    ).sort("completed_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {"sessions": sessions, "count": len(sessions)}


# ============== LEADERBOARDS ==============
@game_router.get("/leaderboard/wins")
async def get_wins_leaderboard(
    period: str = "24h",  # 24h, 7d, 30d, 1y
    limit: int = 20
):
    """Get leaderboard for most wins"""
    from server import db
    
    global _game_service
    if not _game_service:
        _game_service = init_game_service(db)
    
    if period not in ["24h", "7d", "30d", "1y"]:
        raise HTTPException(status_code=400, detail="Invalid period. Use: 24h, 7d, 30d, 1y")
    
    leaderboard = await _game_service.get_leaderboard(period=period, limit=limit)
    return {"leaderboard": leaderboard, "period": period}


@game_router.get("/leaderboard/photos")
async def get_photos_leaderboard(
    period: str = "24h",
    limit: int = 20
):
    """Get leaderboard for most liked minted photos"""
    from server import db
    
    global _game_service
    if not _game_service:
        _game_service = init_game_service(db)
    
    leaderboard = await _game_service.get_photo_leaderboard(period=period, limit=limit)
    return {"leaderboard": leaderboard, "period": period}


# ============== INIT FUNCTION ==============
def setup_game_routes(db):
    """Initialize game services with database connection"""
    global _game_service
    _game_service = init_game_service(db)
    logger.info("Photo Game services initialized")
