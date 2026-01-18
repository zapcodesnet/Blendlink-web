"""
Blendlink Photo Game API Routes
- Game sessions
- RPS battles
- Photo battles
- Leaderboards
"""

from fastapi import APIRouter, HTTPException, Depends, Request
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
_db = None


def setup_game_routes(db):
    """Initialize game services with database connection"""
    global _game_service, _db
    _game_service = init_game_service(db)
    _db = db
    logger.info("Photo Game services initialized")


async def get_current_user_from_request(request: Request) -> dict:
    """Get current user from request"""
    from server import get_current_user
    return await get_current_user(request)


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
async def get_my_stats(current_user: dict = Depends(get_current_user_from_request)):
    """Get current user's game stats"""
    if not _game_service:
        raise HTTPException(status_code=500, detail="Game service not initialized")
    
    stats = await _game_service.get_player_stats(current_user["user_id"])
    return stats


@game_router.get("/stats/{user_id}")
async def get_user_stats(user_id: str):
    """Get a user's public game stats"""
    if not _game_service:
        raise HTTPException(status_code=500, detail="Game service not initialized")
    
    stats = await _game_service.get_player_stats(user_id)
    
    # Remove sensitive fields
    stats.pop("stamina", None)
    stats.pop("last_stamina_update", None)
    
    return stats


@game_router.post("/start")
async def start_game(
    data: StartGameRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Start a new game session
    
    - Requires stamina
    - Optional BL coin bet
    - Select a minted photo for battle
    """
    if not _game_service:
        raise HTTPException(status_code=500, detail="Game service not initialized")
    
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
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Play a Rock-Paper-Scissors round
    
    First to 3 wins advances to next phase
    """
    if not _game_service:
        raise HTTPException(status_code=500, detail="Game service not initialized")
    
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
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Execute the photo battle phase
    
    Photos are compared based on dollar value with strength/weakness modifiers
    """
    if not _game_service:
        raise HTTPException(status_code=500, detail="Game service not initialized")
    
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
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    session = await _db.game_sessions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session


@game_router.get("/sessions/active")
async def get_active_sessions(current_user: dict = Depends(get_current_user_from_request)):
    """Get user's active game sessions"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    sessions = await _db.game_sessions.find(
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
    current_user: dict = Depends(get_current_user_from_request)
):
    """Get user's completed game history"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    sessions = await _db.game_sessions.find(
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
    if not _game_service:
        raise HTTPException(status_code=500, detail="Game service not initialized")
    
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
    if not _game_service:
        raise HTTPException(status_code=500, detail="Game service not initialized")
    
    leaderboard = await _game_service.get_photo_leaderboard(period=period, limit=limit)
    return {"leaderboard": leaderboard, "period": period}



# ============== PVP MATCHMAKING ==============
from pvp_matchmaking import init_pvp_service, PvPGameService

_pvp_service: Optional[PvPGameService] = None


class FindMatchRequest(BaseModel):
    bet_amount: int = 0
    photo_id: Optional[str] = None
    use_bot_fallback: bool = True


@game_router.post("/pvp/find-match")
async def find_pvp_match(
    data: FindMatchRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Start searching for a PvP match
    - If opponent found, returns match immediately
    - If no opponent, waits up to 30 seconds
    - After timeout, creates bot match if use_bot_fallback is True
    """
    global _pvp_service
    if not _pvp_service:
        _pvp_service = init_pvp_service(_db)
    
    result = await _pvp_service.find_match(
        user_id=current_user["user_id"],
        bet_amount=data.bet_amount,
        photo_id=data.photo_id,
        use_bot_fallback=data.use_bot_fallback,
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@game_router.get("/pvp/match-status")
async def check_match_status(
    current_user: dict = Depends(get_current_user_from_request)
):
    """Check if a match has been found"""
    global _pvp_service
    if not _pvp_service:
        _pvp_service = init_pvp_service(_db)
    
    return await _pvp_service.check_match_status(current_user["user_id"])


@game_router.post("/pvp/cancel")
async def cancel_matchmaking(
    current_user: dict = Depends(get_current_user_from_request)
):
    """Cancel matchmaking"""
    global _pvp_service
    if not _pvp_service:
        _pvp_service = init_pvp_service(_db)
    
    return await _pvp_service.cancel_matchmaking(current_user["user_id"])


@game_router.post("/pvp/match/{match_id}/start")
async def start_match_game(
    match_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Start the game from a matched pair"""
    global _pvp_service
    if not _pvp_service:
        _pvp_service = init_pvp_service(_db)
    
    result = await _pvp_service.start_match_game(
        match_id=match_id,
        user_id=current_user["user_id"],
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result


@game_router.get("/pvp/queue-status")
async def get_queue_status():
    """Get current matchmaking queue status"""
    global _pvp_service
    if not _pvp_service:
        _pvp_service = init_pvp_service(_db)
    
    return await _pvp_service.get_queue_status()
