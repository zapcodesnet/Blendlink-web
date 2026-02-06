"""
Blendlink Photo Game API Routes v3.0
- Open Games (PVP matchmaking)
- Game sessions
- RPS battles with power advantage
- Photo auction bidding (tapping)
- Stamina system
- Leaderboards
"""

from fastapi import APIRouter, HTTPException, Depends, Request, Body
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import logging
import uuid
from datetime import datetime, timezone, timedelta

from photo_game import (
    init_game_service,
    PhotoGameService,
    MAX_STAMINA_BATTLES,
    STAMINA_REGEN_PER_HOUR,
    STAMINA_COST_WIN,
    STAMINA_COST_LOSS,
    REQUIRED_PHOTOS_PER_PLAYER,
    STARTING_BANKROLL,
    ADVANTAGE_BONUS,
    MIN_BID,
    MAX_BID,
    BID_INCREMENT,
    MAX_TAPS_PER_SECOND,
    calculate_photo_battle_value,
    calculate_auction_bids_required,
    calculate_rps_power_advantage,
    calculate_current_stamina,
    generate_bot_photo,
    generate_bot_stats,
    WIN_STREAK_MULTIPLIERS,
    LOSE_STREAK_IMMUNITY_THRESHOLD,
    BOT_MIN_BET,
    BOT_MAX_BET,
    BOT_HOUSE_FEE,
    OpenGame,
    OpenGameStatus,
    PVPGameSession,
    RoundType,
    PhotoStamina,
    # XP & Level System
    XP_PER_ROUND,
    SUBSCRIPTION_XP_MULTIPLIERS,
    get_level_from_xp,
    get_xp_for_next_level,
    calculate_xp_with_subscription,
    LEVEL_XP_THRESHOLDS,
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


async def get_optional_user(request: Request) -> Optional[dict]:
    """Get current user if authenticated, None otherwise"""
    try:
        from server import get_current_user
        return await get_current_user(request)
    except Exception:
        return None


# ============== REQUEST MODELS ==============
class CreateOpenGameRequest(BaseModel):
    """Request to create a new open PVP game"""
    photo_ids: List[str] = Field(..., min_length=5, max_length=5)  # Exactly 5 photos
    bet_amount: int = 0  # BL coins (no upper limit for PVP)
    is_bot_allowed: bool = False  # Allow bot fallback
    bot_difficulty: str = "medium"


class JoinOpenGameRequest(BaseModel):
    """Request to join an open game"""
    game_id: str
    photo_ids: List[str] = Field(..., min_length=5, max_length=5)  # Exactly 5 photos


class ReadyRequest(BaseModel):
    """Mark player as ready"""
    game_id: str


class SelectRoundPhotoRequest(BaseModel):
    """Select photo for current round"""
    session_id: str
    photo_id: str


class StartGameRequest(BaseModel):
    opponent_id: str = "bot"  # "bot" for bot games
    bet_amount: int = 0
    photo_id: Optional[str] = None
    practice_mode: bool = False


class RPSMoveRequest(BaseModel):
    choice: str  # rock, paper, scissors


class RPSAuctionMoveRequest(BaseModel):
    choice: str  # rock, paper, scissors
    bid_amount: int  # $1M to $6M in $1M increments


# ============== ROUTES ==============
@game_router.get("/config")
async def get_game_config():
    """Get game configuration"""
    return {
        "max_stamina": MAX_STAMINA_BATTLES,
        "stamina_regen_per_hour": STAMINA_REGEN_PER_HOUR,
        "stamina_cost_win": STAMINA_COST_WIN,
        "stamina_cost_loss": STAMINA_COST_LOSS,
        "required_photos": REQUIRED_PHOTOS_PER_PLAYER,
        "win_streak_multipliers": {
            "3": 1.25, "4": 1.50, "5": 1.75,
            "6": 2.00, "7": 2.25, "8": 2.50,
            "9": 2.75, "10": 3.00,
        },
        "strength_multiplier": 1.25,
        "max_taps_per_second": MAX_TAPS_PER_SECOND,
        "rps_auction": {
            "starting_bankroll": STARTING_BANKROLL,
            "advantage_bonus": ADVANTAGE_BONUS,
            "min_bid": MIN_BID,
            "max_bid": MAX_BID,
            "bid_increment": BID_INCREMENT,
        }
    }


# ============== OPEN GAMES (PVP MATCHMAKING) ==============
@game_router.get("/open-games")
async def list_open_games(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    List all open games waiting for opponents.
    Returns games with creator's strongest photo as thumbnail.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    query = {"status": OpenGameStatus.WAITING.value}
    
    # Optional search by username or game_id
    if search:
        query["$or"] = [
            {"creator_username": {"$regex": search, "$options": "i"}},
            {"game_id": {"$regex": search, "$options": "i"}},
        ]
    
    games_cursor = _db.open_games.find(query).sort("created_at", -1).limit(50)
    games = await games_cursor.to_list(length=50)
    
    # Format response
    result = []
    for game in games:
        result.append({
            "game_id": game.get("game_id"),
            "creator_id": game.get("creator_id"),
            "creator_username": game.get("creator_username", "Player"),
            "bet_amount": game.get("bet_amount", 0),
            "total_dollar_value": game.get("total_dollar_value", 0),
            "thumbnail_photo": game.get("thumbnail_photo"),
            "created_at": game.get("created_at"),
            "is_bot_allowed": game.get("is_bot_allowed", False),
            "photo_count": len(game.get("creator_photo_ids", [])),
        })
    
    return {"games": result, "count": len(result)}


@game_router.get("/open-games/{game_id}")
async def get_open_game_details(
    game_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Get detailed view of an open game including all 5 creator photos.
    Used for the preview modal with flip cards.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    game = await _db.open_games.find_one({"game_id": game_id})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Exclude _id from response
    game.pop("_id", None)
    
    return game


@game_router.post("/open-games/create")
async def create_open_game(
    data: CreateOpenGameRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Create a new open PVP game.
    Requires exactly 5 minted photos with stamina >= 1.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user["user_id"]
    
    # Validate exactly 5 photos
    if len(data.photo_ids) != REQUIRED_PHOTOS_PER_PLAYER:
        raise HTTPException(
            status_code=400, 
            detail=f"Must select exactly {REQUIRED_PHOTOS_PER_PLAYER} photos"
        )
    
    # Fetch all photos and validate ownership & stamina
    photos = []
    total_dollar_value = 0
    highest_value_photo = None
    highest_value = 0
    
    for photo_id in data.photo_ids:
        photo = await _db.minted_photos.find_one({
            "mint_id": photo_id,
            "user_id": user_id
        })
        
        if not photo:
            raise HTTPException(status_code=404, detail=f"Photo {photo_id} not found")
        
        # Get/calculate current stamina
        stamina_record = await _db.photo_stamina.find_one({"mint_id": photo_id})
        if stamina_record:
            current_stamina = calculate_current_stamina(
                stamina_record.get("stamina", MAX_STAMINA_BATTLES),
                stamina_record.get("last_regen_timestamp"),
                stamina_record.get("max_stamina", MAX_STAMINA_BATTLES)
            )
        else:
            current_stamina = MAX_STAMINA_BATTLES
        
        if current_stamina < 1:
            raise HTTPException(
                status_code=400,
                detail=f"Photo '{photo.get('name', photo_id)}' has no stamina left (0/{MAX_STAMINA_BATTLES})"
            )
        
        # Build photo data for preview - EXCLUDE base64 image_url to prevent DocumentTooLarge error
        # Use API endpoint reference instead of storing massive base64 data
        photo_data = {
            "mint_id": photo.get("mint_id"),
            "name": photo.get("name"),
            "image_url": f"/api/minting/photo/{photo.get('mint_id')}/image",  # Lightweight API reference
            "dollar_value": photo.get("dollar_value", 0),
            "scenery_type": photo.get("scenery_type", "natural"),
            "current_stamina": current_stamina,
            "max_stamina": MAX_STAMINA_BATTLES,
            "level": stamina_record.get("level", 1) if stamina_record else 1,
            "xp": stamina_record.get("xp", 0) if stamina_record else 0,
            "win_streak": stamina_record.get("win_streak", 0) if stamina_record else 0,
            "lose_streak": stamina_record.get("lose_streak", 0) if stamina_record else 0,
        }
        
        photos.append(photo_data)
        total_dollar_value += photo.get("dollar_value", 0)
        
        # Track highest value for thumbnail
        if photo.get("dollar_value", 0) > highest_value:
            highest_value = photo.get("dollar_value", 0)
            highest_value_photo = photo_data
    
    # Create open game
    open_game = OpenGame(
        creator_id=user_id,
        creator_username=current_user.get("username", "Player"),
        creator_photo_ids=data.photo_ids,
        creator_photos=photos,
        thumbnail_photo=highest_value_photo,
        total_dollar_value=total_dollar_value,
        bet_amount=data.bet_amount,
        is_bot_allowed=data.is_bot_allowed,
        bot_difficulty=data.bot_difficulty,
    )
    
    # Insert into database
    await _db.open_games.insert_one(open_game.model_dump())
    
    return {
        "success": True,
        "game_id": open_game.game_id,
        "message": "Game created! Waiting for opponent...",
        "game": open_game.model_dump()
    }


@game_router.post("/open-games/join")
async def join_open_game(
    data: JoinOpenGameRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Join an existing open game.
    Requires exactly 5 minted photos with stamina >= 1.
    Sends notification to creator.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user["user_id"]
    
    # Find the game
    game = await _db.open_games.find_one({
        "game_id": data.game_id,
        "status": OpenGameStatus.WAITING.value
    })
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found or already started")
    
    # Can't join own game
    if game.get("creator_id") == user_id:
        raise HTTPException(status_code=400, detail="Cannot join your own game")
    
    # Validate exactly 5 photos
    if len(data.photo_ids) != REQUIRED_PHOTOS_PER_PLAYER:
        raise HTTPException(
            status_code=400,
            detail=f"Must select exactly {REQUIRED_PHOTOS_PER_PLAYER} photos"
        )
    
    # Fetch and validate opponent photos
    photos = []
    for photo_id in data.photo_ids:
        photo = await _db.minted_photos.find_one({
            "mint_id": photo_id,
            "user_id": user_id
        })
        
        if not photo:
            raise HTTPException(status_code=404, detail=f"Photo {photo_id} not found")
        
        # Get/calculate current stamina
        stamina_record = await _db.photo_stamina.find_one({"mint_id": photo_id})
        if stamina_record:
            current_stamina = calculate_current_stamina(
                stamina_record.get("stamina", MAX_STAMINA_BATTLES),
                stamina_record.get("last_regen_timestamp"),
                stamina_record.get("max_stamina", MAX_STAMINA_BATTLES)
            )
        else:
            current_stamina = MAX_STAMINA_BATTLES
        
        if current_stamina < 1:
            raise HTTPException(
                status_code=400,
                detail=f"Photo '{photo.get('name', photo_id)}' has no stamina left"
            )
        
        # Use lightweight API reference instead of base64 image_url to prevent DocumentTooLarge
        photo_data = {
            "mint_id": photo.get("mint_id"),
            "name": photo.get("name"),
            "image_url": f"/api/minting/photo/{photo.get('mint_id')}/image",  # API endpoint reference
            "dollar_value": photo.get("dollar_value", 0),
            "scenery_type": photo.get("scenery_type", "natural"),
            "current_stamina": current_stamina,
            "max_stamina": MAX_STAMINA_BATTLES,
            "level": stamina_record.get("level", 1) if stamina_record else 1,
            "xp": stamina_record.get("xp", 0) if stamina_record else 0,
            "win_streak": stamina_record.get("win_streak", 0) if stamina_record else 0,
            "lose_streak": stamina_record.get("lose_streak", 0) if stamina_record else 0,
        }
        photos.append(photo_data)
    
    # Update game with opponent info
    await _db.open_games.update_one(
        {"game_id": data.game_id},
        {"$set": {
            "opponent_id": user_id,
            "opponent_username": current_user.get("username", "Player"),
            "opponent_photo_ids": data.photo_ids,
            "opponent_photos": photos,
            "status": OpenGameStatus.READY.value,
        }}
    )
    
    # Create notification for creator
    notification = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": game.get("creator_id"),
        "type": "game_joined",
        "title": "Player joined your game!",
        "message": f"{current_user.get('username', 'A player')} has joined your Photo Battle! Tap Ready to start.",
        "data": {
            "game_id": data.game_id,
            "opponent_username": current_user.get("username", "Player"),
        },
        "created_at": datetime.now(timezone.utc),
        "read": False,
    }
    await _db.notifications.insert_one(notification)
    
    # Broadcast via WebSocket for instant notification
    try:
        from lobby_websocket import lobby_manager
        await lobby_manager.broadcast_player_joined(
            game_id=data.game_id,
            joiner_id=user_id,
            joiner_username=current_user.get("username", "Player"),
            joiner_photos=photos
        )
    except Exception as e:
        logger.warning(f"Could not broadcast player joined: {e}")
    
    # Fetch updated game
    updated_game = await _db.open_games.find_one({"game_id": data.game_id})
    updated_game.pop("_id", None)
    
    return {
        "success": True,
        "message": "Joined game! Both players must tap Ready to start.",
        "game": updated_game
    }


@game_router.post("/open-games/ready")
async def mark_ready(
    data: ReadyRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Mark player as ready. When both are ready, starts 10-second countdown.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user["user_id"]
    
    game = await _db.open_games.find_one({
        "game_id": data.game_id,
        "status": {"$in": [OpenGameStatus.READY.value, OpenGameStatus.STARTING.value]}
    })
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found or not in ready state")
    
    # Determine which player
    is_creator = game.get("creator_id") == user_id
    is_opponent = game.get("opponent_id") == user_id
    
    if not is_creator and not is_opponent:
        raise HTTPException(status_code=403, detail="Not a participant in this game")
    
    # Update ready status
    update_field = "creator_ready" if is_creator else "opponent_ready"
    await _db.open_games.update_one(
        {"game_id": data.game_id},
        {"$set": {update_field: True}}
    )
    
    # Check if both ready
    game = await _db.open_games.find_one({"game_id": data.game_id})
    both_ready = game.get("creator_ready") and game.get("opponent_ready")
    
    # Broadcast ready status via WebSocket (instant notification)
    try:
        from lobby_websocket import lobby_manager
        await lobby_manager.broadcast_ready_status(
            game_id=data.game_id,
            user_id=user_id,
            username=current_user.get("username", "Player"),
            is_ready=True,
            is_creator=is_creator
        )
    except Exception as e:
        logger.warning(f"Could not broadcast ready status: {e}")
    
    if both_ready and game.get("status") != OpenGameStatus.STARTING.value:
        # Start countdown
        await _db.open_games.update_one(
            {"game_id": data.game_id},
            {"$set": {
                "status": OpenGameStatus.STARTING.value,
                "countdown_started_at": datetime.now(timezone.utc)
            }}
        )
        
        # Broadcast countdown start via WebSocket
        try:
            from lobby_websocket import lobby_manager
            await lobby_manager.broadcast_countdown_start(data.game_id, seconds=10)
        except Exception as e:
            logger.warning(f"Could not broadcast countdown start: {e}")
    
    game = await _db.open_games.find_one({"game_id": data.game_id})
    game.pop("_id", None)
    
    return {
        "success": True,
        "both_ready": both_ready,
        "game": game
    }


@game_router.post("/open-games/start/{game_id}")
async def start_pvp_game(
    game_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Actually start the PVP game after countdown.
    Creates a PVPGameSession.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    game = await _db.open_games.find_one({
        "game_id": game_id,
        "status": OpenGameStatus.STARTING.value
    })
    
    if not game:
        raise HTTPException(status_code=404, detail="Game not found or not ready to start")
    
    # Create PVP game session
    session = PVPGameSession(
        open_game_id=game_id,
        player1_id=game.get("creator_id"),
        player2_id=game.get("opponent_id"),
        bet_amount=game.get("bet_amount", 0),
        player1_photo_ids=game.get("creator_photo_ids", []),
        player2_photo_ids=game.get("opponent_photo_ids", []),
        player1_photos=game.get("creator_photos", []),
        player2_photos=game.get("opponent_photos", []),
    )
    
    await _db.pvp_sessions.insert_one(session.model_dump())
    
    # Update open game with session reference
    await _db.open_games.update_one(
        {"game_id": game_id},
        {"$set": {
            "status": OpenGameStatus.IN_PROGRESS.value,
            "active_session_id": session.session_id
        }}
    )
    
    # Create PVP game room for real-time synchronized gameplay FIRST
    room_id = None
    try:
        from pvp_game_websocket import pvp_game_manager
        room_id = await pvp_game_manager.create_room(game_id)
        logger.info(f"Created PVP room {room_id} for game {game_id}")
    except Exception as e:
        logger.warning(f"Could not create PVP game room: {e}")
    
    # Broadcast game start via WebSocket (include pvp_room_id)
    try:
        from lobby_websocket import lobby_manager
        # Use mode='json' to serialize datetime objects to ISO strings
        session_data = session.model_dump(mode='json')
        await lobby_manager.broadcast_game_start(
            game_id=game_id,
            session_id=session.session_id,
            session_data=session_data,
            pvp_room_id=room_id  # Include room ID in broadcast
        )
    except Exception as e:
        logger.warning(f"Could not broadcast game start: {e}")
    
    return {
        "success": True,
        "session_id": session.session_id,
        "session": session.model_dump(mode='json'),
        "pvp_room_id": room_id,
        "websocket_url": f"/api/ws/pvp-game/{room_id}" if room_id else None,
    }


@game_router.delete("/open-games/{game_id}")
async def cancel_open_game(
    game_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Cancel an open game (creator only, before opponent joins)"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    result = await _db.open_games.update_one(
        {
            "game_id": game_id,
            "creator_id": current_user["user_id"],
            "status": OpenGameStatus.WAITING.value
        },
        {"$set": {"status": OpenGameStatus.CANCELLED.value}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Game not found or cannot be cancelled")
    
    return {"success": True, "message": "Game cancelled"}


# ============== STAMINA ROUTES ==============
@game_router.get("/photo-stamina/{mint_id}")
async def get_photo_stamina(
    mint_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Get stamina info for a specific photo"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Verify ownership
    photo = await _db.minted_photos.find_one({
        "mint_id": mint_id,
        "user_id": current_user["user_id"]
    })
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Get stamina record
    stamina_record = await _db.photo_stamina.find_one({"mint_id": mint_id})
    
    if stamina_record:
        current_stamina = calculate_current_stamina(
            stamina_record.get("stamina", MAX_STAMINA_BATTLES),
            stamina_record.get("last_regen_timestamp"),
            stamina_record.get("max_stamina", MAX_STAMINA_BATTLES)
        )
        
        return {
            "mint_id": mint_id,
            "current_stamina": current_stamina,
            "max_stamina": MAX_STAMINA_BATTLES,
            "level": stamina_record.get("level", 1),
            "xp": stamina_record.get("xp", 0),
            "win_streak": stamina_record.get("win_streak", 0),
            "lose_streak": stamina_record.get("lose_streak", 0),
            "total_rounds_played": stamina_record.get("total_rounds_played", 0),
            "rounds_won": stamina_record.get("rounds_won", 0),
            "rounds_lost": stamina_record.get("rounds_lost", 0),
            "medals": stamina_record.get("medals", {"ten_win_streak": 0}),
        }
    else:
        # No record = full stamina, no battles
        return {
            "mint_id": mint_id,
            "current_stamina": MAX_STAMINA_BATTLES,
            "max_stamina": MAX_STAMINA_BATTLES,
            "level": 1,
            "xp": 0,
            "win_streak": 0,
            "lose_streak": 0,
            "total_rounds_played": 0,
            "rounds_won": 0,
            "rounds_lost": 0,
            "medals": {"ten_win_streak": 0},
        }


# Medal Constants
MEDAL_WIN_STREAK_THRESHOLD = 10  # 10 consecutive round wins to earn a medal


class RecordRoundResultRequest(BaseModel):
    """Request to record round results for photos"""
    photo_id: str
    round_won: bool  # True if this photo won the round, False if lost


@game_router.post("/record-round-result")
async def record_round_result(
    request: RecordRoundResultRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Record a round result for a photo and check for medal awards.
    
    Win Streak Medal Rules:
    - Cumulative across games
    - Resets to 0 if photo loses ANY round
    - Earns 🏅 medal at every 10 consecutive wins
    - Medals are permanent and transfer with photo
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    mint_id = request.photo_id
    round_won = request.round_won
    
    # Verify photo exists and belongs to user
    photo = await _db.minted_photos.find_one({
        "mint_id": mint_id,
        "user_id": current_user["user_id"]
    })
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found or not owned by user")
    
    # Get or create stamina record
    stamina_record = await _db.photo_stamina.find_one({"mint_id": mint_id})
    
    if not stamina_record:
        stamina_record = {
            "mint_id": mint_id,
            "user_id": current_user["user_id"],
            "stamina": MAX_STAMINA_BATTLES,
            "max_stamina": MAX_STAMINA_BATTLES,
            "level": 1,
            "xp": 0,
            "win_streak": 0,
            "lose_streak": 0,
            "total_rounds_played": 0,
            "rounds_won": 0,
            "rounds_lost": 0,
            "medals": {"ten_win_streak": 0},
            "last_regen_timestamp": datetime.now(timezone.utc),
        }
        await _db.photo_stamina.insert_one(stamina_record)
    
    # Get user's subscription tier for XP multiplier
    user = await _db.users.find_one({"user_id": current_user["user_id"]}, {"_id": 0, "subscription_tier": 1})
    subscription_tier = user.get("subscription_tier", "free") if user else "free"
    
    # Calculate XP with subscription multiplier
    base_xp = XP_PER_ROUND  # +1 XP per round (win or loss)
    xp_gained = calculate_xp_with_subscription(base_xp, subscription_tier)
    
    # Calculate stamina cost
    stamina_cost = STAMINA_COST_WIN if round_won else STAMINA_COST_LOSS  # Win=-1, Loss=-2
    
    # Get current stamina with regeneration
    current_stamina = calculate_current_stamina(
        stamina_record.get("stamina", MAX_STAMINA_BATTLES),
        stamina_record.get("last_regen_timestamp"),
        stamina_record.get("max_stamina", MAX_STAMINA_BATTLES)
    )
    new_stamina = max(0, current_stamina - stamina_cost)
    
    # Update stats
    current_win_streak = stamina_record.get("win_streak", 0)
    current_xp = stamina_record.get("xp", 0)
    medals = stamina_record.get("medals", {"ten_win_streak": 0})
    medal_earned = False
    bonus_coins = 0
    level_up = False
    old_level = stamina_record.get("level", 1)
    MEDAL_BONUS_COINS = 10000  # 10,000 BL coins per medal
    
    # Calculate new XP and check for level up
    new_xp = current_xp + xp_gained
    new_level = get_level_from_xp(new_xp)
    
    if new_level > old_level:
        level_up = True
        logger.info(f"Photo {mint_id} leveled up from {old_level} to {new_level}!")
        
        # Check for level-up BL coin rewards
        from minting_system import LEVEL_BONUSES
        for level_threshold, bonus_info in LEVEL_BONUSES.items():
            if old_level < level_threshold <= new_level and "bl_coins_reward" in bonus_info:
                level_bonus_coins = bonus_info["bl_coins_reward"]
                bonus_coins += level_bonus_coins
                logger.info(f"Photo {mint_id} reached level {level_threshold}! Bonus: {level_bonus_coins} BL coins")
    
    if round_won:
        # Win: increment streak
        new_win_streak = current_win_streak + 1
        
        # Check if we hit 10-win threshold
        if new_win_streak >= MEDAL_WIN_STREAK_THRESHOLD and new_win_streak % MEDAL_WIN_STREAK_THRESHOLD == 0:
            medals["ten_win_streak"] = medals.get("ten_win_streak", 0) + 1
            medal_earned = True
            bonus_coins += MEDAL_BONUS_COINS
            logger.info(f"Photo {mint_id} earned 10-win streak medal! Total: {medals['ten_win_streak']}. Bonus: {MEDAL_BONUS_COINS} BL coins")
        
        update_data = {
            "$set": {
                "win_streak": new_win_streak,
                "lose_streak": 0,
                "medals": medals,
                "level": new_level,
                "xp": new_xp,
                "stamina": new_stamina,
                "last_regen_timestamp": datetime.now(timezone.utc),
            },
            "$inc": {
                "total_rounds_played": 1,
                "rounds_won": 1,
            }
        }
    else:
        # Loss: reset streak to 0
        new_win_streak = 0
        new_lose_streak = stamina_record.get("lose_streak", 0) + 1
        
        update_data = {
            "$set": {
                "win_streak": 0,
                "lose_streak": new_lose_streak,
                "level": new_level,
                "xp": new_xp,
                "stamina": new_stamina,
                "last_regen_timestamp": datetime.now(timezone.utc),
            },
            "$inc": {
                "total_rounds_played": 1,
                "rounds_lost": 1,
            }
        }
    
    # Update the record
    await _db.photo_stamina.update_one(
        {"mint_id": mint_id},
        update_data
    )
    
    # Award bonus coins if any (medal + level up)
    if bonus_coins > 0:
        # Update medals on minted_photos (for transfer persistence)
        if medal_earned:
            await _db.minted_photos.update_one(
                {"mint_id": mint_id},
                {"$set": {"medals": medals}}
            )
        
        # Update level on minted_photos
        if level_up:
            # Get star info from level
            from minting_system import get_level_stars
            star_info = get_level_stars(new_level)
            await _db.minted_photos.update_one(
                {"mint_id": mint_id},
                {"$set": {
                    "level": new_level,
                    "xp": new_xp,
                    "stars": star_info["stars"],
                    "has_golden_frame": star_info["has_golden_frame"],
                    "level_bonus_percent": star_info["bonus_percent"],
                }}
            )
        
        # Award bonus coins to user's wallet
        user_id = current_user["user_id"]
        await _db.users.update_one(
            {"user_id": user_id},
            {
                "$inc": {"bl_coins": bonus_coins},
                "$push": {
                    "coin_transactions": {
                        "type": "game_bonus",
                        "amount": bonus_coins,
                        "description": f"{'🏅 Medal' if medal_earned else '⬆️ Level Up'} Bonus for {photo.get('name', 'Photo')}",
                        "photo_mint_id": mint_id,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                }
            }
        )
        logger.info(f"User {user_id} received {bonus_coins} BL coins for photo {mint_id}")
    
    # Calculate XP progress for response
    xp_for_next = get_xp_for_next_level(new_level)
    xp_progress = new_xp - LEVEL_XP_THRESHOLDS.get(new_level, 0)
    xp_needed_for_next = xp_for_next - LEVEL_XP_THRESHOLDS.get(new_level, 0) if new_level < 60 else 0
    
    return {
        "success": True,
        "photo_id": mint_id,
        "round_won": round_won,
        # Streak info
        "new_win_streak": new_win_streak if round_won else 0,
        "new_lose_streak": 0 if round_won else stamina_record.get("lose_streak", 0) + 1,
        "has_immunity": (stamina_record.get("lose_streak", 0) + (0 if round_won else 1)) >= LOSE_STREAK_IMMUNITY_THRESHOLD,
        # Medal info
        "medal_earned": medal_earned,
        "total_medals": medals.get("ten_win_streak", 0),
        "bonus_coins": bonus_coins,
        # XP & Level info
        "xp_gained": xp_gained,
        "xp_multiplier": SUBSCRIPTION_XP_MULTIPLIERS.get(subscription_tier, 1),
        "subscription_tier": subscription_tier,
        "new_xp": new_xp,
        "new_level": new_level,
        "level_up": level_up,
        "xp_progress": xp_progress,
        "xp_needed_for_next": xp_needed_for_next,
        # Stamina info
        "stamina_cost": stamina_cost,
        "new_stamina": new_stamina,
        "max_stamina": MAX_STAMINA_BATTLES,
    }


@game_router.get("/photo-medals/{mint_id}")
async def get_photo_medals(mint_id: str):
    """
    Get medals for a specific photo (public endpoint).
    Medals are permanent and transfer with photo ownership.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Check minted_photos first (for transferred photos)
    photo = await _db.minted_photos.find_one(
        {"mint_id": mint_id},
        {"_id": 0, "medals": 1, "name": 1, "mint_id": 1}
    )
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Get from photo_stamina for detailed stats
    stamina_record = await _db.photo_stamina.find_one({"mint_id": mint_id})
    
    medals = photo.get("medals") or stamina_record.get("medals") if stamina_record else {"ten_win_streak": 0}
    win_streak = stamina_record.get("win_streak", 0) if stamina_record else 0
    
    return {
        "mint_id": mint_id,
        "name": photo.get("name"),
        "medals": medals,
        "current_win_streak": win_streak,
        "next_medal_at": MEDAL_WIN_STREAK_THRESHOLD - (win_streak % MEDAL_WIN_STREAK_THRESHOLD) if win_streak > 0 else MEDAL_WIN_STREAK_THRESHOLD,
    }



@game_router.get("/xp-level-info")
async def get_xp_level_info():
    """
    Get XP and level progression info.
    Includes level thresholds, star bonuses, and subscription multipliers.
    """
    from minting_system import LEVEL_BONUSES, SUBSCRIPTION_TIERS
    
    return {
        "xp_per_round": XP_PER_ROUND,
        "subscription_multipliers": SUBSCRIPTION_XP_MULTIPLIERS,
        "level_thresholds": LEVEL_XP_THRESHOLDS,
        "level_bonuses": {
            level: {
                "stars": info.get("stars"),
                "bonus_percent": info.get("bonus_percent"),
                "bl_coins_reward": info.get("bl_coins_reward", 0),
                "golden_frame": info.get("golden_frame", False),
            }
            for level, info in LEVEL_BONUSES.items()
        },
        "subscription_tiers": {
            name: {
                "xp_multiplier": config.get("xp_multiplier"),
                "daily_mint_limit": config.get("daily_mint_limit"),
                "daily_bl_claim": config.get("daily_bl_claim"),
                "price": config.get("price"),
            }
            for name, config in SUBSCRIPTION_TIERS.items()
        },
        "streak_multipliers": WIN_STREAK_MULTIPLIERS,
        "lose_streak_immunity_threshold": LOSE_STREAK_IMMUNITY_THRESHOLD,
        "stamina": {
            "max": MAX_STAMINA_BATTLES,
            "cost_win": STAMINA_COST_WIN,
            "cost_loss": STAMINA_COST_LOSS,
            "regen_per_hour": STAMINA_REGEN_PER_HOUR,
        }
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
    
    - Requires stamina (unless practice_mode=True)
    - Optional BL coin bet (disabled in practice_mode)
    - Select a minted photo for battle
    - practice_mode: No BL bet, no stamina loss, no rewards - pure practice vs bot
    """
    if not _game_service:
        raise HTTPException(status_code=500, detail="Game service not initialized")
    
    result = await _game_service.start_game(
        player_id=current_user["user_id"],
        opponent_id=data.opponent_id,
        bet_amount=data.bet_amount,
        player_photo_id=data.photo_id,
        practice_mode=data.practice_mode,
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
    Play a Rock-Paper-Scissors round (legacy - uses $1M default bid)
    
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


@game_router.post("/session/{session_id}/rps-auction")
async def play_rps_auction(
    session_id: str,
    data: RPSAuctionMoveRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Play a Million Dollar RPS Bidding Auction round
    
    - Choose RPS (rock/paper/scissors) + bid amount ($1M-$5M)
    - Winner of RPS takes the pot
    - If tie RPS, higher bid wins
    - First to 3 wins takes Stage 1
    - Bankrupt ($0 balance) = automatic loss
    """
    if not _game_service:
        raise HTTPException(status_code=500, detail="Game service not initialized")
    
    result = await _game_service.play_rps_auction_round(
        session_id=session_id,
        player_id=current_user["user_id"],
        choice=data.choice.lower(),
        bid_amount=data.bid_amount,
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


# ============== MATCH HISTORY WITH REPLAY ==============
@game_router.get("/match-history")
async def get_match_history_with_replay(
    skip: int = 0,
    limit: int = 50,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Get user's match history with full replay data.
    Includes all 5 photos from both players and detailed round-by-round results.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user["user_id"]
    
    # Get completed battle sessions
    sessions = await _db.battle_sessions.find(
        {
            "$or": [
                {"player1_id": user_id},
                {"player2_id": user_id},
            ],
            "status": "completed",
        },
        {"_id": 0}
    ).sort("completed_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Also check pvp_sessions collection
    pvp_sessions = await _db.pvp_sessions.find(
        {
            "$or": [
                {"player1_id": user_id},
                {"player2_id": user_id},
            ],
            "status": "completed",
        },
        {"_id": 0}
    ).sort("completed_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Also check game_sessions for backwards compatibility
    game_sessions = await _db.game_sessions.find(
        {
            "$or": [
                {"player1_id": user_id},
                {"player2_id": user_id},
            ],
            "phase": "completed",
        },
        {"_id": 0}
    ).sort("completed_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Combine all sessions
    all_sessions = sessions + pvp_sessions + game_sessions
    
    # Enrich sessions with player info and photos
    enriched_matches = []
    for session in all_sessions:
        session_id = session.get("session_id") or session.get("game_id")
        
        # Get player info
        player1_id = session.get("player1_id")
        player2_id = session.get("player2_id")
        
        player1_info = None
        player2_info = None
        
        if player1_id:
            p1 = await _db.users.find_one({"user_id": player1_id}, {"_id": 0, "user_id": 1, "username": 1, "name": 1})
            player1_info = p1 if p1 else {"user_id": player1_id, "username": "Player 1"}
            
        if player2_id:
            p2 = await _db.users.find_one({"user_id": player2_id}, {"_id": 0, "user_id": 1, "username": 1, "name": 1})
            player2_info = p2 if p2 else {"user_id": player2_id, "username": "Bot" if session.get("is_bot") else "Player 2"}
        
        # Get photos for both players
        player1_photo_ids = session.get("player1_photo_ids") or session.get("creator_photo_ids") or []
        player2_photo_ids = session.get("player2_photo_ids") or session.get("opponent_photo_ids") or []
        
        player1_photos = []
        player2_photos = []
        
        if player1_photo_ids:
            photos = await _db.minted_photos.find(
                {"mint_id": {"$in": player1_photo_ids}},
                {"_id": 0, "mint_id": 1, "name": 1, "image_url": 1, "dollar_value": 1, "scenery_type": 1}
            ).to_list(5)
            player1_photos = photos
            
        if player2_photo_ids:
            photos = await _db.minted_photos.find(
                {"mint_id": {"$in": player2_photo_ids}},
                {"_id": 0, "mint_id": 1, "name": 1, "image_url": 1, "dollar_value": 1, "scenery_type": 1}
            ).to_list(5)
            player2_photos = photos
        
        # Build rounds array from session data
        rounds = session.get("rounds") or []
        if not rounds:
            # Try to reconstruct rounds from available data
            rps_rounds = session.get("rps_rounds") or []
            tapping_results = session.get("tapping_results") or []
            
            # Alternate tapping and RPS rounds (standard sequence)
            for i in range(5):
                if i % 2 == 0:  # Tapping rounds: 0, 2, 4
                    tap_idx = i // 2
                    tap_data = tapping_results[tap_idx] if tap_idx < len(tapping_results) else {}
                    rounds.append({
                        "type": "auction",
                        "round": i + 1,
                        "player1_taps": tap_data.get("player1_taps", 0),
                        "player2_taps": tap_data.get("player2_taps", 0),
                        "winner": tap_data.get("winner"),
                        "player1_photo": player1_photos[tap_idx] if tap_idx < len(player1_photos) else None,
                        "player2_photo": player2_photos[tap_idx] if tap_idx < len(player2_photos) else None,
                    })
                else:  # RPS rounds: 1, 3
                    rps_idx = i // 2
                    rps_data = rps_rounds[rps_idx] if rps_idx < len(rps_rounds) else {}
                    rounds.append({
                        "type": "rps",
                        "round": i + 1,
                        "player1_choice": rps_data.get("player1_choice"),
                        "player2_choice": rps_data.get("player2_choice"),
                        "player1_bid": rps_data.get("player1_bid"),
                        "player2_bid": rps_data.get("player2_bid"),
                        "winner": rps_data.get("winner"),
                    })
        
        # Calculate scores
        player1_wins = session.get("player1_wins") or session.get("player1_rps_wins", 0)
        player2_wins = session.get("player2_wins") or session.get("player2_rps_wins", 0)
        
        enriched_matches.append({
            "session_id": session_id,
            "player1_id": player1_id,
            "player2_id": player2_id,
            "player1_info": player1_info,
            "player2_info": player2_info,
            "player1_photos": player1_photos,
            "player2_photos": player2_photos,
            "player1_wins": player1_wins,
            "player2_wins": player2_wins,
            "winner_id": session.get("winner_id"),
            "bet_amount": session.get("bet_amount", 0),
            "rounds": rounds,
            "is_bot": session.get("is_bot", False),
            "completed_at": session.get("completed_at"),
            "created_at": session.get("created_at"),
        })
    
    # Sort by completed_at and remove duplicates
    seen_ids = set()
    unique_matches = []
    for match in sorted(enriched_matches, key=lambda x: x.get("completed_at") or x.get("created_at") or "", reverse=True):
        if match["session_id"] and match["session_id"] not in seen_ids:
            seen_ids.add(match["session_id"])
            unique_matches.append(match)
    
    return {
        "matches": unique_matches[:limit],
        "count": len(unique_matches[:limit]),
        "total": len(unique_matches),
    }


@game_router.get("/battle/{session_id}")
async def get_battle_details(
    session_id: str,
):
    """
    Get public battle details for sharing/viewing.
    Anyone can view a battle replay via its session_id.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Search in all session collections
    session = await _db.battle_sessions.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    
    if not session:
        session = await _db.pvp_sessions.find_one(
            {"session_id": session_id},
            {"_id": 0}
        )
    
    if not session:
        session = await _db.game_sessions.find_one(
            {"session_id": session_id},
            {"_id": 0}
        )
    
    if not session:
        raise HTTPException(status_code=404, detail="Battle not found")
    
    # Get player info
    player1_id = session.get("player1_id")
    player2_id = session.get("player2_id")
    
    player1_info = None
    player2_info = None
    
    if player1_id:
        p1 = await _db.users.find_one({"user_id": player1_id}, {"_id": 0, "user_id": 1, "username": 1, "name": 1})
        player1_info = p1 if p1 else {"user_id": player1_id, "username": "Player 1"}
        
    if player2_id:
        p2 = await _db.users.find_one({"user_id": player2_id}, {"_id": 0, "user_id": 1, "username": 1, "name": 1})
        player2_info = p2 if p2 else {"user_id": player2_id, "username": "Bot" if session.get("is_bot") else "Player 2"}
    
    # Get photos
    player1_photo_ids = session.get("player1_photo_ids") or session.get("creator_photo_ids") or []
    player2_photo_ids = session.get("player2_photo_ids") or session.get("opponent_photo_ids") or []
    
    player1_photos = []
    player2_photos = []
    
    if player1_photo_ids:
        photos = await _db.minted_photos.find(
            {"mint_id": {"$in": player1_photo_ids}},
            {"_id": 0, "mint_id": 1, "name": 1, "image_url": 1, "dollar_value": 1, "scenery_type": 1}
        ).to_list(5)
        player1_photos = photos
        
    if player2_photo_ids:
        photos = await _db.minted_photos.find(
            {"mint_id": {"$in": player2_photo_ids}},
            {"_id": 0, "mint_id": 1, "name": 1, "image_url": 1, "dollar_value": 1, "scenery_type": 1}
        ).to_list(5)
        player2_photos = photos
    
    return {
        "session_id": session_id,
        "player1_id": player1_id,
        "player2_id": player2_id,
        "player1_info": player1_info,
        "player2_info": player2_info,
        "player1_photos": player1_photos,
        "player2_photos": player2_photos,
        "player1_wins": session.get("player1_wins", 0),
        "player2_wins": session.get("player2_wins", 0),
        "winner_id": session.get("winner_id"),
        "bet_amount": session.get("bet_amount", 0),
        "rounds": session.get("rounds", []),
        "is_bot": session.get("is_bot", False),
        "completed_at": session.get("completed_at"),
    }


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


@game_router.get("/pvp/session/{game_id}")
async def get_pvp_session_state(
    game_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Get the current state of a PVP session for polling-based sync.
    This is a fallback mechanism when WebSocket connections are unreliable.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user.get("user_id")
    
    # Try to find the session in pvp_sessions
    session = await _db.pvp_sessions.find_one(
        {"$or": [
            {"session_id": game_id},
            {"open_game_id": game_id},
            {"pvp_room_id": game_id}
        ]},
        {"_id": 0}
    )
    
    if not session:
        # Try game_sessions collection
        session = await _db.game_sessions.find_one(
            {"session_id": game_id},
            {"_id": 0}
        )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if user is part of this session
    if session.get("player1_id") != user_id and session.get("player2_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this session")
    
    return {
        "session_id": session.get("session_id"),
        "status": session.get("status", "unknown"),
        "current_round": session.get("current_round", 1),
        "player1_id": session.get("player1_id"),
        "player2_id": session.get("player2_id"),
        "player1_wins": session.get("player1_wins", 0),
        "player2_wins": session.get("player2_wins", 0),
        "player1_selected": session.get("player1_selected", False),
        "player2_selected": session.get("player2_selected", False),
        "winner_id": session.get("winner_id"),
        "updated_at": session.get("updated_at", session.get("created_at")),
        # Include round result if available
        "round_result": session.get("current_round_result"),
        "player1_photo": session.get("player1_current_photo"),
        "player2_photo": session.get("player2_current_photo"),
    }


class PVPPhotoSelectRequest(BaseModel):
    session_id: str
    photo_id: str


@game_router.post("/pvp/select-photo")
async def pvp_select_photo(
    data: PVPPhotoSelectRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Select a photo for the current PVP round via API (polling fallback).
    This endpoint processes the selection and checks if both players have selected.
    If both have selected, it triggers the round evaluation.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user.get("user_id")
    
    # Find the session
    session = await _db.pvp_sessions.find_one(
        {"$or": [
            {"session_id": data.session_id},
            {"open_game_id": data.session_id},
            {"pvp_room_id": data.session_id}
        ]}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Determine if user is player1 or player2
    is_player1 = session.get("player1_id") == user_id
    is_player2 = session.get("player2_id") == user_id
    
    if not is_player1 and not is_player2:
        raise HTTPException(status_code=403, detail="Not a participant in this session")
    
    # Get the player's photo
    player_photos = session.get("player1_photos" if is_player1 else "player2_photos", [])
    selected_photo = None
    for photo in player_photos:
        if photo.get("mint_id") == data.photo_id:
            selected_photo = photo
            break
    
    if not selected_photo:
        raise HTTPException(status_code=400, detail="Photo not in your selection")
    
    # Update the selection in database
    update_field = "player1_current_photo" if is_player1 else "player2_current_photo"
    selected_field = "player1_selected" if is_player1 else "player2_selected"
    
    await _db.pvp_sessions.update_one(
        {"session_id": session.get("session_id")},
        {
            "$set": {
                update_field: selected_photo,
                selected_field: True,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    # Check if both players have selected
    updated_session = await _db.pvp_sessions.find_one(
        {"session_id": session.get("session_id")}
    )
    
    both_selected = updated_session.get("player1_selected") and updated_session.get("player2_selected")
    
    result = {
        "success": True,
        "both_selected": both_selected,
        "player1_selected": updated_session.get("player1_selected", False),
        "player2_selected": updated_session.get("player2_selected", False),
    }
    
    # If both selected, prepare for tapping phase - DON'T determine winner yet!
    # The winner is determined by who taps more (Photo Auction Bidding)
    if both_selected:
        p1_photo = updated_session.get("player1_current_photo", {})
        p2_photo = updated_session.get("player2_current_photo", {})
        
        p1_value = p1_photo.get("dollar_value", 0)
        p2_value = p2_photo.get("dollar_value", 0)
        
        # Reset taps for the new round and set status to "tapping"
        await _db.pvp_sessions.update_one(
            {"session_id": session.get("session_id")},
            {
                "$set": {
                    "player1_taps": 0,
                    "player2_taps": 0,
                    "player1_dollar": 0,
                    "player2_dollar": 0,
                    "status": "tapping",  # Ready for tapping phase
                    "round_start_time": datetime.now(timezone.utc),
                    "updated_at": datetime.now(timezone.utc)
                }
            }
        )
        
        # Return photo info for display but NO winner yet
        result["status"] = "tapping"
        result["player1_photo"] = {
            "mint_id": p1_photo.get("mint_id"),
            "image_url": p1_photo.get("image_url"),
            "dollar_value": p1_value,
            "scenery_type": p1_photo.get("scenery_type"),
            "level": p1_photo.get("level", 1),
        }
        result["player2_photo"] = {
            "mint_id": p2_photo.get("mint_id"),
            "image_url": p2_photo.get("image_url"),
            "dollar_value": p2_value,
            "scenery_type": p2_photo.get("scenery_type"),
            "level": p2_photo.get("level", 1),
        }
        result["player1_value"] = p1_value
        result["player2_value"] = p2_value
        result["current_round"] = updated_session.get("current_round", 1)
    
    return result


@game_router.post("/pvp/next-round")
async def pvp_next_round(
    session_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Move to the next round after viewing round results.
    Resets selections for the new round.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user.get("user_id")
    
    session = await _db.pvp_sessions.find_one(
        {"$or": [
            {"session_id": session_id},
            {"open_game_id": session_id},
            {"pvp_room_id": session_id}
        ]}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.get("player1_id") != user_id and session.get("player2_id") != user_id:
        raise HTTPException(status_code=403, detail="Not a participant")
    
    current_round = session.get("current_round", 1)
    
    # Reset for next round
    await _db.pvp_sessions.update_one(
        {"session_id": session.get("session_id")},
        {
            "$set": {
                "current_round": current_round + 1,
                "player1_selected": False,
                "player2_selected": False,
                "player1_current_photo": None,
                "player2_current_photo": None,
                "current_round_result": None,
                "status": "selecting",
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "success": True,
        "current_round": current_round + 1,
        "status": "selecting"
    }


# ============== PVP TAP ENDPOINTS (Polling Fallback for Real-time Sync) ==============

class PVPTapRequest(BaseModel):
    session_id: str
    tap_count: int = 1


@game_router.post("/pvp/tap")
async def pvp_submit_tap(
    data: PVPTapRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Submit taps for the current PVP round via API (polling fallback).
    Uses ATOMIC $inc operation to prevent race conditions.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user.get("user_id")
    
    # Find the session first to determine player
    session = await _db.pvp_sessions.find_one(
        {"$or": [
            {"session_id": data.session_id},
            {"open_game_id": data.session_id},
            {"pvp_room_id": data.session_id}
        ]},
        {"_id": 0, "player1_id": 1, "player2_id": 1, "session_id": 1,
         "player1_current_photo": 1, "player2_current_photo": 1}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Determine if user is player1 or player2
    is_player1 = session.get("player1_id") == user_id
    is_player2 = session.get("player2_id") == user_id
    
    if not is_player1 and not is_player2:
        raise HTTPException(status_code=403, detail="Not a participant in this session")
    
    player_num = 1 if is_player1 else 2
    
    # Use atomic operations if available
    try:
        from mongodb_pvp_optimization import get_atomic_ops
        atomic_ops = get_atomic_ops()
        if atomic_ops:
            result = await atomic_ops.atomic_submit_tap(
                session.get("session_id"),
                player_num,
                data.tap_count
            )
            if result:
                # Calculate dollar value
                photo_field = "player1_current_photo" if is_player1 else "player2_current_photo"
                photo = session.get(photo_field, {})
                photo_dollar_value = photo.get("dollar_value", 1000000) if photo else 1000000
                required_taps = 100
                new_taps = result.get(f"player{player_num}_taps", 0)
                current_dollar = new_taps * (photo_dollar_value / required_taps)
                
                return {
                    "success": True,
                    "my_taps": new_taps,
                    "my_dollar": current_dollar,
                    "opponent_taps": result.get(f"player{3-player_num}_taps", 0),
                    "atomic": True
                }
    except Exception as e:
        logger.debug(f"Atomic tap failed, falling back: {e}")
    
    # Fallback to non-atomic update (still works, just slightly less safe)
    tap_field = f"player{player_num}_taps"
    
    # Use $inc for atomic increment even in fallback
    result = await _db.pvp_sessions.find_one_and_update(
        {"session_id": session.get("session_id")},
        {
            "$inc": {tap_field: data.tap_count},
            "$set": {"updated_at": datetime.now(timezone.utc)}
        },
        return_document=True,
        projection={"_id": 0, "player1_taps": 1, "player2_taps": 1}
    )
    
    if not result:
        raise HTTPException(status_code=404, detail="Session update failed")
    
    # Calculate dollar value
    photo_field = "player1_current_photo" if is_player1 else "player2_current_photo"
    photo = session.get(photo_field, {})
    photo_dollar_value = photo.get("dollar_value", 1000000) if photo else 1000000
    required_taps = 100
    new_taps = result.get(tap_field, 0)
    current_dollar = new_taps * (photo_dollar_value / required_taps)
    )
    
    # Get updated session for response
    updated_session = await _db.pvp_sessions.find_one(
        {"session_id": session.get("session_id")},
        {"_id": 0}
    )
    
    return {
        "success": True,
        "my_taps": new_taps,
        "my_dollar": current_dollar,
        "opponent_taps": updated_session.get("player2_taps" if is_player1 else "player1_taps", 0),
        "opponent_dollar": updated_session.get("player2_dollar" if is_player1 else "player1_dollar", 0),
    }


@game_router.get("/pvp/tap-state/{session_id}")
async def pvp_get_tap_state(
    session_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Get current tap state for both players (polling endpoint).
    Poll this every 100-200ms during tapping phase for real-time sync.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user.get("user_id")
    
    session = await _db.pvp_sessions.find_one(
        {"$or": [
            {"session_id": session_id},
            {"open_game_id": session_id},
            {"pvp_room_id": session_id}
        ]},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    is_player1 = session.get("player1_id") == user_id
    
    return {
        "session_id": session.get("session_id"),
        "status": session.get("status"),
        "current_round": session.get("current_round", 1),
        "player1_taps": session.get("player1_taps", 0),
        "player1_dollar": session.get("player1_dollar", 0),
        "player2_taps": session.get("player2_taps", 0),
        "player2_dollar": session.get("player2_dollar", 0),
        "my_taps": session.get("player1_taps" if is_player1 else "player2_taps", 0),
        "my_dollar": session.get("player1_dollar" if is_player1 else "player2_dollar", 0),
        "opponent_taps": session.get("player2_taps" if is_player1 else "player1_taps", 0),
        "opponent_dollar": session.get("player2_dollar" if is_player1 else "player1_dollar", 0),
        "round_time_remaining": session.get("round_time_remaining"),
        "updated_at": session.get("updated_at"),
    }


@game_router.post("/pvp/finish-round")
async def pvp_finish_round(
    session_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Finish the current tapping round and calculate winner.
    Called when the round timer expires.
    IDEMPOTENT: Can be called by both players - returns cached result if already finished.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user.get("user_id")
    
    session = await _db.pvp_sessions.find_one(
        {"$or": [
            {"session_id": session_id},
            {"open_game_id": session_id},
            {"pvp_room_id": session_id}
        ]}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session.get("player1_id") != user_id and session.get("player2_id") != user_id:
        raise HTTPException(status_code=403, detail="Not a participant")
    
    # IDEMPOTENT CHECK: If this round already has a result, return it
    current_round = session.get("current_round", 1)
    existing_result = session.get("current_round_result")
    if existing_result and existing_result.get("round") == current_round:
        # Round already finished - return cached result
        return {
            "success": True,
            "round_result": existing_result,
            "player1_wins": session.get("player1_wins", 0),
            "player2_wins": session.get("player2_wins", 0),
            "game_over": session.get("status") in ["complete", "finished"],
            "game_winner_id": session.get("winner_id"),
            "already_finished": True,
        }
    
    # Get tap counts and dollar values
    p1_taps = session.get("player1_taps", 0)
    p2_taps = session.get("player2_taps", 0)
    p1_dollar = session.get("player1_dollar", 0)
    p2_dollar = session.get("player2_dollar", 0)
    
    # Determine round winner based on dollar value (higher wins)
    if p1_dollar > p2_dollar:
        round_winner = "player1"
        winner_id = session.get("player1_id")
    elif p2_dollar > p1_dollar:
        round_winner = "player2"
        winner_id = session.get("player2_id")
    else:
        round_winner = "tie"
        winner_id = None
    
    # Update wins
    new_p1_wins = session.get("player1_wins", 0)
    new_p2_wins = session.get("player2_wins", 0)
    
    if round_winner == "player1":
        new_p1_wins += 1
    elif round_winner == "player2":
        new_p2_wins += 1
    
    current_round = session.get("current_round", 1)
    game_over = new_p1_wins >= 3 or new_p2_wins >= 3 or current_round >= 5
    
    round_result = {
        "round": current_round,
        "winner": round_winner,
        "winner_id": winner_id,
        "player1_taps": p1_taps,
        "player1_dollar": p1_dollar,
        "player2_taps": p2_taps,
        "player2_dollar": p2_dollar,
    }
    
    game_winner_id = None
    if game_over:
        if new_p1_wins > new_p2_wins:
            game_winner_id = session.get("player1_id")
        elif new_p2_wins > new_p1_wins:
            game_winner_id = session.get("player2_id")
    
    # Update session
    await _db.pvp_sessions.update_one(
        {"session_id": session.get("session_id")},
        {
            "$set": {
                "player1_wins": new_p1_wins,
                "player2_wins": new_p2_wins,
                "current_round_result": round_result,
                "status": "complete" if game_over else "round_result",
                "winner_id": game_winner_id,
                # Reset taps for next round
                "player1_taps": 0,
                "player2_taps": 0,
                "player1_dollar": 0,
                "player2_dollar": 0,
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "success": True,
        "round_result": round_result,
        "player1_wins": new_p1_wins,
        "player2_wins": new_p2_wins,
        "game_over": game_over,
        "game_winner_id": game_winner_id,
    }


@game_router.post("/pvp/submit-round-result")
async def submit_round_result_api(
    session_id: str = Body(...),
    winner_user_id: str = Body(...),
    player1_score: int = Body(...),
    player2_score: int = Body(...),
    round: int = Body(...),
    round_type: str = Body(...),
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    API fallback for submitting round result when WebSocket is unavailable.
    This triggers the same round transition logic as WebSocket.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Validate session exists
    session = await _db.pvp_sessions.find_one({
        "$or": [{"session_id": session_id}, {"open_game_id": session_id}]
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    user_id = current_user["user_id"]
    
    # Validate user is a participant
    if user_id != session.get("player1_id") and user_id != session.get("player2_id"):
        raise HTTPException(status_code=403, detail="Not a participant")
    
    # Use WebSocket manager if available
    try:
        from pvp_game_websocket import pvp_game_manager
        
        # Find the room
        room_id = None
        for rid, room in pvp_game_manager.rooms.items():
            if room.game_id == session_id or room.session_id == session_id:
                room_id = rid
                break
        
        if room_id:
            await pvp_game_manager.submit_round_result(
                room_id=room_id,
                winner_user_id=winner_user_id,
                player1_score=player1_score,
                player2_score=player2_score,
                round_data={
                    "round": round,
                    "type": round_type,
                }
            )
            return {"success": True, "method": "websocket_manager"}
    except Exception as e:
        logger.warning(f"WebSocket manager fallback failed: {e}")
    
    # Direct DB update as last resort
    game_over = player1_score >= 3 or player2_score >= 3
    new_round = round + 1 if not game_over else round
    new_status = "complete" if game_over else "selecting"
    
    await _db.pvp_sessions.update_one(
        {"$or": [{"session_id": session_id}, {"open_game_id": session_id}]},
        {
            "$set": {
                "player1_wins": player1_score,
                "player2_wins": player2_score,
                "current_round": new_round,
                "status": new_status,
                "winner_id": winner_user_id if game_over else None,
                "round_result_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc),
            }
        }
    )
    
    return {
        "success": True,
        "method": "database",
        "game_over": game_over,
        "next_round": new_round,
    }


# ============== BATTLE-READY PHOTOS ==============
@game_router.get("/battle-photos")
async def get_battle_ready_photos(
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Get user's minted photos sorted by dollar value (power) for battle selection.
    Includes stamina info and grays out photos with 0% stamina.
    
    Stamina recovery:
    - 1 battle restored per 1 hour of rest
    - Full 24 battles restored after 24 hours rest
    - Max stamina: 100% = 24 battles
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    from datetime import datetime, timezone
    
    user_id = current_user["user_id"]
    
    # Get all user's minted photos
    photos = await _db.minted_photos.find(
        {"user_id": user_id},
        {"_id": 0, "image_data": 0}
    ).sort("dollar_value", -1).to_list(100)  # Sort by dollar value (power) descending
    
    # Calculate current stamina for each photo based on time since last battle
    now = datetime.now(timezone.utc)
    battle_photos = []
    
    for photo in photos:
        # Get stored stamina (default 100%)
        stamina = photo.get("stamina", 100)
        last_battle = photo.get("last_battle_at")
        
        # Regenerate stamina based on time passed
        if last_battle and stamina < 100:
            if isinstance(last_battle, str):
                last_battle_dt = datetime.fromisoformat(last_battle.replace("Z", "+00:00"))
            else:
                last_battle_dt = last_battle
            
            hours_passed = (now - last_battle_dt).total_seconds() / 3600
            
            # 1 battle worth of stamina per hour = ~4.16% per hour
            stamina_regen_per_hour = 100 / 24  # ~4.16%
            stamina_gained = hours_passed * stamina_regen_per_hour
            stamina = min(100, stamina + stamina_gained)
            
            # Update photo stamina in DB if regenerated
            if stamina > photo.get("stamina", 100):
                await _db.minted_photos.update_one(
                    {"mint_id": photo["mint_id"]},
                    {"$set": {"stamina": stamina}}
                )
        
        # Determine if photo can be used for battle
        is_available = stamina > 0
        battles_remaining = int(stamina / (100 / 24))  # How many battles this photo can do
        
        # Calculate time until 1 battle is available (if stamina is low)
        time_until_available = None
        if stamina <= 0:
            # Need at least ~4.16% stamina for 1 battle
            time_until_available = 60  # 60 minutes for 1 battle
        elif stamina < (100 / 24):
            needed = (100 / 24) - stamina
            time_until_available = int(needed / (100 / 24) * 60)
        
        # Fetch medals from photo_stamina collection
        stamina_record = await _db.photo_stamina.find_one({"mint_id": photo.get("mint_id")})
        medals = {}
        win_streak = 0
        lose_streak = 0
        if stamina_record:
            medals = stamina_record.get("medals", {"ten_win_streak": 0})
            win_streak = stamina_record.get("win_streak", 0)
            lose_streak = stamina_record.get("lose_streak", 0)
        # Also check if medals are stored on the photo itself (for transfers)
        if not medals.get("ten_win_streak") and photo.get("medals"):
            medals = photo.get("medals", {"ten_win_streak": 0})
        
        battle_photos.append({
            "mint_id": photo.get("mint_id"),
            "name": photo.get("name"),
            "description": photo.get("description", ""),
            "scenery_type": photo.get("scenery_type", "natural"),
            "strength_vs": photo.get("strength_vs"),
            "weakness_vs": photo.get("weakness_vs"),
            "dollar_value": photo.get("dollar_value", 1000000),
            "overall_score": photo.get("overall_score", 50),
            "power": photo.get("power", 100),
            "level": photo.get("level", 1),
            "xp": photo.get("xp", 0),
            "battles_won": photo.get("battles_won", 0),
            "battles_lost": photo.get("battles_lost", 0),
            "has_face": photo.get("has_face", False),
            "stamina": round(stamina, 1),
            "stamina_percent": round(stamina, 1),
            "battles_remaining": battles_remaining,
            "is_available": is_available,
            "time_until_available": time_until_available,
            "image_url": f"/api/minting/photo/{photo.get('mint_id')}/image",  # Lightweight API reference
            "medals": medals,
            "win_streak": win_streak,
            "lose_streak": lose_streak,
            "current_win_streak": win_streak,
            "current_lose_streak": lose_streak,
        })
    
    return {
        "photos": battle_photos,
        "count": len(battle_photos),
        "available_count": sum(1 for p in battle_photos if p["is_available"]),
    }



# ============== AUCTION BATTLE ENDPOINTS ==============
class CreateAuctionBattleRequest(BaseModel):
    """Request to create an auction battle room"""
    photo_id: str
    is_bot_match: bool = False
    bot_difficulty: str = "medium"  # easy, medium, hard
    bet_amount: int = 0  # BL coins bet (1-500 for bot matches)


class JoinAuctionBattleRequest(BaseModel):
    """Request to join an existing auction battle"""
    room_id: str
    photo_id: str


@game_router.post("/auction/create")
async def create_auction_battle(
    request: CreateAuctionBattleRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Create a new auction battle room"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    from auction_websocket import auction_manager
    
    # Validate bot match bet
    if request.is_bot_match:
        if request.bet_amount < BOT_MIN_BET or request.bet_amount > BOT_MAX_BET:
            raise HTTPException(
                status_code=400, 
                detail=f"Bot match bet must be between {BOT_MIN_BET} and {BOT_MAX_BET} BL coins"
            )
        
        # Check user balance
        if current_user.get("bl_coins", 0) < request.bet_amount:
            raise HTTPException(status_code=400, detail="Insufficient BL coins for bet")
    
    # Get player's photo - exclude large base64 data
    player_photo = await _db.minted_photos.find_one(
        {"mint_id": request.photo_id, "user_id": current_user["user_id"]},
        {"_id": 0, "image_data": 0, "image_url": 0}
    )
    
    if not player_photo:
        raise HTTPException(status_code=404, detail="Photo not found or not owned by you")
    
    # Add lightweight image URL reference
    player_photo["image_url"] = f"/api/minting/photo/{player_photo.get('mint_id')}/image"
    
    # Get player stats
    player_stats = await _db.game_stats.find_one(
        {"user_id": current_user["user_id"]},
        {"_id": 0}
    )
    if not player_stats:
        player_stats = {"user_id": current_user["user_id"], "current_win_streak": 0, "current_lose_streak": 0}
    
    # Create game session
    session_id = f"auction_{uuid.uuid4().hex[:12]}"
    
    # Generate bot data if bot match
    bot_photo = None
    bot_stats = None
    player_battle_value = None
    if request.is_bot_match:
        bot_photo = generate_bot_photo(request.bot_difficulty, [player_photo])
        bot_stats = generate_bot_stats(request.bot_difficulty)
        
        # Calculate battle values for display
        player_battle_value = calculate_photo_battle_value(player_photo, bot_photo, player_stats, bot_stats)
        
        # Deduct bet
        await _db.users.update_one(
            {"user_id": current_user["user_id"]},
            {"$inc": {"bl_coins": -request.bet_amount}}
        )
    
    # Create auction room
    room_id = await auction_manager.create_room(
        game_session_id=session_id,
        round_number=1,
        player1_data={
            "user_id": current_user["user_id"],
            "photo": player_photo,
            "stats": player_stats,
        },
        player2_data={
            "user_id": "bot",
            "photo": bot_photo,
            "stats": bot_stats,
        } if request.is_bot_match else None,
        is_bot_match=request.is_bot_match,
        bot_difficulty=request.bot_difficulty,
        bet_amount=request.bet_amount,
    )
    
    # Calculate effective values for display (use pre-calculated if available)
    battle_value = player_battle_value or {}
    if request.is_bot_match and bot_photo and not player_battle_value:
        battle_value = calculate_photo_battle_value(player_photo, bot_photo, player_stats, bot_stats)
    
    return {
        "success": True,
        "room_id": room_id,
        "session_id": session_id,
        "is_bot_match": request.is_bot_match,
        "bot_difficulty": request.bot_difficulty if request.is_bot_match else None,
        "bet_amount": request.bet_amount,
        "player_photo": {
            "mint_id": player_photo.get("mint_id"),
            "name": player_photo.get("name"),
            "dollar_value": player_photo.get("dollar_value"),
            "scenery_type": player_photo.get("scenery_type"),
            "effective_value": battle_value.get("effective_value", player_photo.get("dollar_value")),
            "modifiers": battle_value.get("modifiers_applied", []),
        },
        "bot_photo": {
            "mint_id": bot_photo.get("mint_id") if bot_photo else None,
            "name": bot_photo.get("name") if bot_photo else None,
            "dollar_value": bot_photo.get("dollar_value") if bot_photo else None,
            "scenery_type": bot_photo.get("scenery_type") if bot_photo else None,
        } if request.is_bot_match else None,
        "player_stats": {
            "win_streak": player_stats.get("current_win_streak", 0),
            "lose_streak": player_stats.get("current_lose_streak", 0),
            "has_fire": player_stats.get("current_win_streak", 0) >= 3,
            "has_shield": player_stats.get("current_lose_streak", 0) >= 3,
        },
        "websocket_url": f"/ws/auction/{room_id}",
    }


@game_router.post("/auction/result")
async def record_auction_result(
    room_id: str,
    winner_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Record the result of an auction battle"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    from auction_websocket import auction_manager
    
    room = auction_manager.rooms.get(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    # Verify user is in the room
    if room.player1 and room.player1.user_id != current_user["user_id"]:
        if not room.is_bot_match or (room.player2 and room.player2.user_id != current_user["user_id"]):
            raise HTTPException(status_code=403, detail="Not a participant in this battle")
    
    user_id = current_user["user_id"]
    player_won = winner_id == user_id
    
    # Update player stats
    stats_update = {}
    if player_won:
        stats_update = {
            "$inc": {
                "current_win_streak": 1,
                "battles_won": 1,
                "total_battles": 1,
            },
            "$set": {"current_lose_streak": 0}
        }
    else:
        stats_update = {
            "$inc": {
                "current_lose_streak": 1,
                "battles_lost": 1,
                "total_battles": 1,
            },
            "$set": {"current_win_streak": 0}
        }
    
    await _db.game_stats.update_one(
        {"user_id": user_id},
        stats_update,
        upsert=True
    )
    
    # Handle bet winnings
    winnings = 0
    if room.bet_amount > 0 and room.is_bot_match:
        if player_won:
            # Player wins: gets pot minus house fee
            pot = room.bet_amount * 2  # Player bet + bot "bet"
            winnings = int(pot * (1 - BOT_HOUSE_FEE))
            await _db.users.update_one(
                {"user_id": user_id},
                {"$inc": {"bl_coins": winnings}}
            )
        # If player loses, they already lost their bet (deducted at creation)
    
    # Update photo stats
    if room.player1 and room.player1.photo:
        photo_update = {"$inc": {}}
        if player_won:
            photo_update["$inc"]["battles_won"] = 1
            photo_update["$inc"]["xp"] = 100  # XP for winning
        else:
            photo_update["$inc"]["battles_lost"] = 1
            photo_update["$inc"]["xp"] = 25  # Small XP for losing
        
        await _db.minted_photos.update_one(
            {"mint_id": room.player1.photo.get("mint_id")},
            photo_update
        )
    
    return {
        "success": True,
        "player_won": player_won,
        "winnings": winnings,
        "new_streak": {
            "win_streak": 1 if player_won else 0,
            "lose_streak": 0 if player_won else 1,
        }
    }


@game_router.get("/auction/streak-info/{user_id}")
async def get_streak_info(user_id: str):
    """Get win/lose streak info for a user"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    stats = await _db.game_stats.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not stats:
        stats = {
            "current_win_streak": 0,
            "current_lose_streak": 0,
            "best_win_streak": 0,
            "total_battles": 0,
        }
    
    # Calculate streak bonus
    win_streak = stats.get("current_win_streak", 0)
    lose_streak = stats.get("current_lose_streak", 0)
    
    streak_multiplier = 1.0
    if win_streak >= 3:
        capped = min(win_streak, 10)
        streak_multiplier = WIN_STREAK_MULTIPLIERS.get(capped, 3.0)
    
    return {
        "user_id": user_id,
        "current_win_streak": win_streak,
        "current_lose_streak": lose_streak,
        "best_win_streak": stats.get("best_win_streak", 0),
        "total_battles": stats.get("total_battles", 0),
        "has_fire": win_streak >= 3,
        "fire_multiplier": streak_multiplier,
        "has_shield": lose_streak >= LOSE_STREAK_IMMUNITY_THRESHOLD,
        "shield_info": "100% immunity vs stronger scenery" if lose_streak >= LOSE_STREAK_IMMUNITY_THRESHOLD else None,
    }


# ============== BOT BATTLE PROGRESSION SYSTEM ==============

# Bot difficulty configurations
# IMPORTANT: Tap rates are hidden from players - only used internally
BOT_DIFFICULTY_CONFIG = {
    "easy": {
        "min_dollar_value": 1_000_000_000,  # $1B minimum
        "taps_per_second": 12,              # Hidden from players
        "fixed_bet": 200,
        "sceneries": ["water", "natural", "man_made", "neutral", "neutral"],  # 1W, 1N, 1M, 2Neu
    },
    "medium": {
        "min_dollar_value": 2_000_000_000,  # $2B minimum
        "taps_per_second": 18,              # Hidden from players
        "fixed_bet": 1000,
        "sceneries": ["water", "natural", "man_made", "man_made", "neutral"],  # 1W, 1N, 2M, 1Neu
    },
    "hard": {
        "min_dollar_value": 5_000_000_000,  # $5B minimum
        "taps_per_second": 20,              # Hidden from players
        "fixed_bet": 5000,
        "sceneries": ["water", "natural", "natural", "man_made", "neutral"],  # 1W, 2N, 1M, 1Neu
    },
    "extreme": {
        "min_dollar_value": 10_000_000_000, # $10B minimum
        "taps_per_second": 25,              # Hidden from players
        "fixed_bet": 10000,
        "sceneries": ["water", "water", "natural", "man_made", "neutral"],  # 2W, 1N, 1M, 1Neu
    },
}

class BotBattleStartRequest(BaseModel):
    difficulty: str = "easy"
    photo_ids: List[str]  # 5 photo IDs
    
class BotBattleResultRequest(BaseModel):
    session_id: str
    player_won: bool
    difficulty: str
    rounds_won: int
    rounds_lost: int
    bet_amount: int


@game_router.get("/bot-battle/stats")
async def get_bot_battle_stats(current_user: dict = Depends(get_current_user_from_request)):
    """Get bot battle progression stats for current user"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user["user_id"]
    
    # Get or create bot stats
    stats = await _db.bot_battle_stats.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    if not stats:
        stats = {
            "user_id": user_id,
            "easy_bot_wins": 0,
            "medium_bot_wins": 0,
            "hard_bot_wins": 0,
            "extreme_bot_wins": 0,
            "total_bot_battles": 0,
            "total_bot_wins": 0,
            "total_bl_won_from_bots": 0,
            "total_bl_lost_to_bots": 0,
            "claimed_bonuses": [],  # Track which bonuses have been claimed
        }
        await _db.bot_battle_stats.insert_one({**stats, "user_id": user_id})
    
    # Calculate unlocked difficulties
    unlocked = {
        "easy": True,  # Always unlocked
        "medium": stats.get("easy_bot_wins", 0) >= 3,
        "hard": stats.get("medium_bot_wins", 0) >= 3,
        "extreme": stats.get("hard_bot_wins", 0) >= 3,
    }
    
    # Calculate claimable bonuses (unlocked but not yet claimed)
    # Support both old field names (medium_unlock_bonus_claimed) and new array format (claimed_bonuses)
    claimed = stats.get("claimed_bonuses", [])
    # Also check old-style boolean flags for backwards compatibility
    if stats.get("medium_unlock_bonus_claimed"):
        claimed = claimed + ["medium_unlock"] if "medium_unlock" not in claimed else claimed
    if stats.get("hard_unlock_bonus_claimed"):
        claimed = claimed + ["hard_unlock"] if "hard_unlock" not in claimed else claimed
    if stats.get("extreme_unlock_bonus_claimed"):
        claimed = claimed + ["extreme_unlock"] if "extreme_unlock" not in claimed else claimed
    if stats.get("extreme_mastery_bonus_claimed"):
        claimed = claimed + ["extreme_mastery"] if "extreme_mastery" not in claimed else claimed
    
    claimable_bonuses = []
    
    # Medium unlock bonus
    if unlocked["medium"] and "medium_unlock" not in claimed:
        claimable_bonuses.append({
            "id": "medium_unlock",
            "label": "Medium Bot Unlocked!",
            "amount": 20000,
            "description": "Claim +20,000 BL for unlocking Medium Bot"
        })
    
    # Hard unlock bonus
    if unlocked["hard"] and "hard_unlock" not in claimed:
        claimable_bonuses.append({
            "id": "hard_unlock",
            "label": "Hard Bot Unlocked!",
            "amount": 100000,
            "description": "Claim +100,000 BL for unlocking Hard Bot"
        })
    
    # Extreme unlock bonus
    if unlocked["extreme"] and "extreme_unlock" not in claimed:
        claimable_bonuses.append({
            "id": "extreme_unlock",
            "label": "Extremely Hard Bot Unlocked!",
            "amount": 500000,
            "description": "Claim +500,000 BL for unlocking Extremely Hard Bot"
        })
    
    # Extreme mastery bonus (3 wins vs Extremely Hard)
    if stats.get("extreme_bot_wins", 0) >= 3 and "extreme_mastery" not in claimed:
        claimable_bonuses.append({
            "id": "extreme_mastery",
            "label": "Bot Battle Master!",
            "amount": 1000000,
            "description": "Claim +1,000,000 BL for mastering all bot difficulties"
        })
    
    return {
        **stats,
        "unlocked_difficulties": unlocked,
        "claimable_bonuses": claimable_bonuses,
    }


@game_router.post("/bot-battle/claim-bonus")
async def claim_bot_bonus(
    bonus_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Claim a one-time bot unlock bonus"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user["user_id"]
    
    # Define bonus amounts
    bonus_amounts = {
        "medium_unlock": 20000,
        "hard_unlock": 100000,
        "extreme_unlock": 500000,
        "extreme_mastery": 1000000,
    }
    
    if bonus_id not in bonus_amounts:
        raise HTTPException(status_code=400, detail="Invalid bonus ID")
    
    # Get stats
    stats = await _db.bot_battle_stats.find_one({"user_id": user_id})
    if not stats:
        raise HTTPException(status_code=404, detail="Stats not found")
    
    claimed = stats.get("claimed_bonuses", [])
    
    # Check if already claimed
    if bonus_id in claimed:
        raise HTTPException(status_code=400, detail="Bonus already claimed")
    
    # Verify eligibility
    unlocked = {
        "medium": stats.get("easy_bot_wins", 0) >= 3,
        "hard": stats.get("medium_bot_wins", 0) >= 3,
        "extreme": stats.get("hard_bot_wins", 0) >= 3,
        "extreme_mastery": stats.get("extreme_bot_wins", 0) >= 3,
    }
    
    # Map bonus_id to unlock requirement
    bonus_to_unlock = {
        "medium_unlock": "medium",
        "hard_unlock": "hard",
        "extreme_unlock": "extreme",
        "extreme_mastery": "extreme_mastery",
    }
    
    required_unlock = bonus_to_unlock.get(bonus_id)
    if not unlocked.get(required_unlock, False):
        raise HTTPException(status_code=400, detail="Bonus not yet earned")
    
    bonus_amount = bonus_amounts[bonus_id]
    
    # Credit BL coins to user
    await _db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"bl_coins": bonus_amount}}
    )
    
    # Mark bonus as claimed
    await _db.bot_battle_stats.update_one(
        {"user_id": user_id},
        {"$push": {"claimed_bonuses": bonus_id}}
    )
    
    # Get updated user balance
    user = await _db.users.find_one({"user_id": user_id}, {"bl_coins": 1})
    new_balance = user.get("bl_coins", 0) if user else 0
    
    return {
        "success": True,
        "bonus_id": bonus_id,
        "amount_claimed": bonus_amount,
        "new_bl_balance": new_balance,
        "message": f"Claimed {bonus_amount:,} BL coins!"
    }


@game_router.post("/bot-battle/start")
async def start_bot_battle(
    request: BotBattleStartRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Start a new bot battle with 5-photo selection"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user["user_id"]
    difficulty = request.difficulty
    
    # Validate difficulty
    if difficulty not in BOT_DIFFICULTY_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid difficulty")
    
    config = BOT_DIFFICULTY_CONFIG[difficulty]
    
    # Check if difficulty is unlocked
    stats = await _db.bot_battle_stats.find_one({"user_id": user_id}, {"_id": 0})
    if not stats:
        stats = {"easy_bot_wins": 0, "medium_bot_wins": 0, "hard_bot_wins": 0}
    
    unlock_requirements = {
        "easy": True,
        "medium": stats.get("easy_bot_wins", 0) >= 3,
        "hard": stats.get("medium_bot_wins", 0) >= 3,
        "extreme": stats.get("hard_bot_wins", 0) >= 3,
    }
    
    if not unlock_requirements.get(difficulty, False):
        raise HTTPException(status_code=403, detail=f"Difficulty '{difficulty}' is not yet unlocked")
    
    # Validate exactly 5 photos
    if len(request.photo_ids) != 5:
        raise HTTPException(status_code=400, detail="Exactly 5 photos required")
    
    # Validate all photos exist and have stamina
    player_photos = []
    for photo_id in request.photo_ids:
        photo = await _db.minted_photos.find_one(
            {"mint_id": photo_id, "user_id": user_id},
            {"_id": 0, "image_data": 0, "image_url": 0}  # Exclude large base64 data
        )
        if not photo:
            raise HTTPException(status_code=404, detail=f"Photo {photo_id} not found or not owned")
        
        # Calculate current stamina with proper parameters
        from datetime import datetime
        last_regen = photo.get("last_regen_timestamp")
        if isinstance(last_regen, str):
            try:
                last_regen = datetime.fromisoformat(last_regen.replace('Z', '+00:00'))
            except (ValueError, TypeError):
                last_regen = None
        
        current_stamina = calculate_current_stamina(
            photo.get("stamina", 100),
            last_regen,
            photo.get("max_stamina", 24)
        )
        if current_stamina < 1:
            raise HTTPException(
                status_code=400, 
                detail=f"Photo '{photo.get('name', photo_id)}' has insufficient stamina"
            )
        # Add lightweight image URL reference for frontend display
        photo["image_url"] = f"/api/minting/photo/{photo.get('mint_id')}/image"
        player_photos.append({**photo, "current_stamina": current_stamina})
    
    # Check user balance for fixed bet
    user = await _db.users.find_one({"user_id": user_id}, {"_id": 0, "bl_coins": 1})
    user_balance = user.get("bl_coins", 0) if user else 0
    fixed_bet = config["fixed_bet"]
    
    if user_balance < fixed_bet:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient balance. Required: {fixed_bet} BL, Available: {user_balance} BL"
        )
    
    # Generate bot's 5 photos
    bot_photos = []
    for i, scenery in enumerate(config["sceneries"]):
        bot_photo = {
            "mint_id": f"bot_{difficulty}_{i}_{uuid.uuid4().hex[:8]}",
            "name": f"Bot Photo {i+1}",
            "dollar_value": config["min_dollar_value"] + (i * 50_000_000),
            "scenery_type": scenery,
            "is_bot": True,
        }
        bot_photos.append(bot_photo)
    
    # Create session
    session_id = f"bot_{difficulty}_{uuid.uuid4().hex[:12]}"
    session = {
        "session_id": session_id,
        "user_id": user_id,
        "difficulty": difficulty,
        "bet_amount": fixed_bet,
        "player_photos": player_photos,
        "bot_photos": bot_photos,
        "bot_taps_per_second": config["taps_per_second"],
        "current_round": 1,
        "player_wins": 0,
        "bot_wins": 0,
        "player_used_indices": [],
        "bot_used_indices": [],
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await _db.bot_battle_sessions.insert_one(session)
    
    # Deduct bet amount
    await _db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"bl_coins": -fixed_bet}}
    )
    
    return {
        "success": True,
        "session_id": session_id,
        "difficulty": difficulty,
        "bet_amount": fixed_bet,
        "player_photos": player_photos,
        "bot_photos": bot_photos,
        "bot_config": {
            "taps_per_second": config["taps_per_second"],
            "min_dollar_value": config["min_dollar_value"],
        },
    }


@game_router.post("/bot-battle/result")
async def record_bot_battle_result(
    request: BotBattleResultRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Record the result of a completed bot battle"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user["user_id"]
    difficulty = request.difficulty
    
    # Validate difficulty
    if difficulty not in BOT_DIFFICULTY_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid difficulty")
    
    config = BOT_DIFFICULTY_CONFIG[difficulty]
    bet_amount = request.bet_amount or config["fixed_bet"]
    
    # Calculate winnings
    pot_total = bet_amount * 2  # Player bet + bot bet
    winnings = pot_total if request.player_won else 0
    
    # Update user balance
    if request.player_won:
        await _db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"bl_coins": winnings}}
        )
    
    # Update bot battle stats
    update_fields = {
        "$inc": {
            "total_bot_battles": 1,
        }
    }
    
    if request.player_won:
        update_fields["$inc"]["total_bot_wins"] = 1
        update_fields["$inc"]["total_bl_won_from_bots"] = winnings
        update_fields["$inc"][f"{difficulty}_bot_wins"] = 1
    else:
        update_fields["$inc"]["total_bl_lost_to_bots"] = bet_amount
    
    await _db.bot_battle_stats.update_one(
        {"user_id": user_id},
        update_fields,
        upsert=True
    )
    
    # Update game stats (streaks, battles_won, etc.)
    game_stats_update = {
        "$inc": {
            "total_battles": 1,
        }
    }
    
    if request.player_won:
        game_stats_update["$inc"]["battles_won"] = 1
        game_stats_update["$inc"]["current_win_streak"] = 1
        game_stats_update["$set"] = {"current_lose_streak": 0}
    else:
        game_stats_update["$inc"]["battles_lost"] = 1
        game_stats_update["$inc"]["current_lose_streak"] = 1
        game_stats_update["$set"] = {"current_win_streak": 0}
    
    await _db.game_stats.update_one(
        {"user_id": user_id},
        game_stats_update,
        upsert=True
    )
    
    # Get updated stats
    updated_stats = await _db.bot_battle_stats.find_one(
        {"user_id": user_id},
        {"_id": 0}
    )
    
    # Check for newly unlocked difficulties and award one-time bonuses
    newly_unlocked = None
    unlock_bonus = 0
    extreme_mastery_bonus = 0
    
    # Unlock bonus amounts
    UNLOCK_BONUSES = {
        "medium": 20000,      # +20,000 BL for unlocking Medium
        "hard": 100000,       # +100,000 BL for unlocking Hard
        "extreme": 500000,    # +500,000 BL for unlocking Extremely Hard
    }
    EXTREME_MASTERY_BONUS = 1000000  # +1,000,000 BL for mastering Extremely Hard (3 wins)
    
    if request.player_won:
        if difficulty == "easy" and updated_stats.get("easy_bot_wins", 0) == 3:
            newly_unlocked = "medium"
        elif difficulty == "medium" and updated_stats.get("medium_bot_wins", 0) == 3:
            newly_unlocked = "hard"
        elif difficulty == "hard" and updated_stats.get("hard_bot_wins", 0) == 3:
            newly_unlocked = "extreme"
        elif difficulty == "extreme" and updated_stats.get("extreme_bot_wins", 0) == 3:
            # Check if mastery bonus already claimed
            mastery_claimed = updated_stats.get("extreme_mastery_bonus_claimed", False)
            if not mastery_claimed:
                extreme_mastery_bonus = EXTREME_MASTERY_BONUS
                await _db.bot_battle_stats.update_one(
                    {"user_id": user_id},
                    {"$set": {"extreme_mastery_bonus_claimed": True}}
                )
                await _db.users.update_one(
                    {"user_id": user_id},
                    {"$inc": {"bl_coins": extreme_mastery_bonus}}
                )
    
    # Award one-time unlock bonus if unlocked a new difficulty
    if newly_unlocked:
        # Check if bonus was already claimed
        bonus_field = f"{newly_unlocked}_unlock_bonus_claimed"
        already_claimed = updated_stats.get(bonus_field, False)
        
        if not already_claimed:
            unlock_bonus = UNLOCK_BONUSES.get(newly_unlocked, 0)
            
            # Mark as claimed and award bonus
            await _db.bot_battle_stats.update_one(
                {"user_id": user_id},
                {"$set": {bonus_field: True}}
            )
            await _db.users.update_one(
                {"user_id": user_id},
                {"$inc": {"bl_coins": unlock_bonus}}
            )
    
    # Build response message
    bonus_message = None
    if newly_unlocked and unlock_bonus > 0:
        bonus_message = f"🎉 You unlocked {newly_unlocked.title()} Bot! +{unlock_bonus:,} BL coins bonus!"
    elif extreme_mastery_bonus > 0:
        bonus_message = f"🏆 Extremely Hard Bot MASTERED! +{extreme_mastery_bonus:,} BL coins bonus!"
    elif newly_unlocked:
        bonus_message = f"🎉 You unlocked {newly_unlocked.title()} Bot!"
    
    return {
        "success": True,
        "player_won": request.player_won,
        "winnings": winnings if request.player_won else 0,
        "bet_lost": bet_amount if not request.player_won else 0,
        "difficulty": difficulty,
        f"{difficulty}_wins": updated_stats.get(f"{difficulty}_bot_wins", 0),
        "newly_unlocked_difficulty": newly_unlocked,
        "unlock_bonus": unlock_bonus,
        "extreme_mastery_bonus": extreme_mastery_bonus,
        "message": bonus_message,
    }


@game_router.get("/bot-battle/generate-photos/{difficulty}")
async def generate_bot_photos_for_difficulty(difficulty: str):
    """Generate bot photos for a specific difficulty (for preview)"""
    if difficulty not in BOT_DIFFICULTY_CONFIG:
        raise HTTPException(status_code=400, detail="Invalid difficulty")
    
    config = BOT_DIFFICULTY_CONFIG[difficulty]
    
    bot_photos = []
    for i, scenery in enumerate(config["sceneries"]):
        bot_photo = {
            "mint_id": f"preview_bot_{i}",
            "name": f"Bot Photo {i+1}",
            "dollar_value": config["min_dollar_value"] + (i * 50_000_000),
            "scenery_type": scenery,
            "scenery_label": scenery.replace("_", " ").title(),
            "is_bot": True,
        }
        bot_photos.append(bot_photo)
    
    return {
        "difficulty": difficulty,
        "bot_photos": bot_photos,
        "taps_per_second": config["taps_per_second"],
        "fixed_bet": config["fixed_bet"],
    }



# ============================================================================
# BATTLE REPLAY SYSTEM
# ============================================================================

class BattleReplayRound(BaseModel):
    round_number: int
    player_photo: Dict
    opponent_photo: Dict
    player_taps: int
    opponent_taps: int
    player_progress: float
    opponent_progress: float
    player_effective_value: float
    opponent_effective_value: float
    winner: str  # 'player' or 'opponent'
    round_type: str  # 'tapping' or 'rps'
    rps_choice_player: Optional[str] = None
    rps_choice_opponent: Optional[str] = None
    bid_player: Optional[int] = None
    bid_opponent: Optional[int] = None
    duration_ms: int = 10000

class SaveBattleReplayRequest(BaseModel):
    session_id: str
    difficulty: str  # easy, medium, hard, extreme
    player_photos: List[Dict]
    opponent_photos: List[Dict]
    rounds: List[BattleReplayRound]
    final_score_player: int
    final_score_opponent: int
    winner: str  # 'player' or 'opponent'
    bet_amount: int
    winnings: int
    total_duration_ms: int

@game_router.post("/battle-replay/save")
async def save_battle_replay(
    request: SaveBattleReplayRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Save a battle replay for later viewing and sharing"""
    from server import db
    
    user_id = current_user.get("user_id")
    
    # Get user info
    user = await db.users.find_one({"user_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    replay_id = str(uuid.uuid4())[:12]
    
    replay_doc = {
        "replay_id": replay_id,
        "user_id": user_id,
        "username": user.get("username", "Player"),
        "avatar_url": user.get("avatar_url"),
        "session_id": request.session_id,
        "difficulty": request.difficulty,
        "player_photos": request.player_photos,
        "opponent_photos": request.opponent_photos,
        "rounds": [r.dict() for r in request.rounds],
        "final_score_player": request.final_score_player,
        "final_score_opponent": request.final_score_opponent,
        "winner": request.winner,
        "bet_amount": request.bet_amount,
        "winnings": request.winnings,
        "total_duration_ms": request.total_duration_ms,
        "created_at": datetime.now(timezone.utc),
        "views": 0,
        "likes": 0,
        "shares": 0,
        "shared_to_feed": False,
    }
    
    await db.battle_replays.insert_one(replay_doc)
    
    return {
        "success": True,
        "replay_id": replay_id,
        "share_url": f"/replay/{replay_id}",
        "message": "Battle replay saved! You can now share it."
    }


# IMPORTANT: This route MUST be defined BEFORE /battle-replay/{replay_id} to avoid path conflict
@game_router.get("/battle-replay/featured")
async def get_featured_replays(
    category: str = "top_wins",
    limit: int = 10
):
    """Get featured battle replays for the landing page
    
    Categories:
    - top_wins: Highest winnings with wins
    - most_viewed: Most viewed replays
    - recent: Most recent replays
    - longest_streak: Replays with highest win streaks
    - epic_comebacks: Close games (4-3 score)
    """
    from server import db
    
    # Define sort criteria based on category
    sort_criteria = {
        "top_wins": [("winnings", -1), ("views", -1)],
        "most_viewed": [("views", -1), ("likes", -1)],
        "recent": [("created_at", -1)],
        "longest_streak": [("player_win_streak", -1), ("winnings", -1)],
        "epic_comebacks": [("created_at", -1)],
    }
    
    sort_by = sort_criteria.get(category, sort_criteria["top_wins"])
    
    # Build query based on category
    if category == "top_wins":
        query = {"winner": "player", "winnings": {"$gt": 0}}
    elif category == "longest_streak":
        query = {"winner": "player", "player_win_streak": {"$gte": 3}}
    elif category == "epic_comebacks":
        query = {
            "$or": [
                {"final_score_player": 5, "final_score_opponent": 4},
                {"final_score_player": 5, "final_score_opponent": 3},
            ]
        }
    else:
        query = {}
    
    # Aggregation pipeline
    pipeline = [
        {"$match": query},
        {"$sort": dict(sort_by)},
        {"$limit": limit},
        {
            "$lookup": {
                "from": "users",
                "let": {"user_id": "$user_id"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$user_id", "$$user_id"]}}},
                    {"$project": {"username": 1, "profile_image": 1, "_id": 0}}
                ],
                "as": "user_info"
            }
        },
        {"$unwind": {"path": "$user_info", "preserveNullAndEmptyArrays": True}},
        {"$project": {"_id": 0, "rounds": 0}}
    ]
    
    replays = await db.battle_replays.aggregate(pipeline).to_list(length=limit)
    
    for replay in replays:
        if replay.get("created_at"):
            replay["created_at"] = replay["created_at"].isoformat() if hasattr(replay["created_at"], 'isoformat') else str(replay["created_at"])
        user_info = replay.pop("user_info", {})
        replay["player_name"] = user_info.get("username", "Anonymous")
        replay["player_avatar"] = user_info.get("profile_image")
    
    return {"replays": replays, "category": category, "total": len(replays)}


@game_router.get("/battle-replay/{replay_id}")
async def get_battle_replay(replay_id: str):
    """Get a battle replay by ID (public endpoint for sharing)"""
    from server import db
    
    replay = await db.battle_replays.find_one(
        {"replay_id": replay_id},
        {"_id": 0}
    )
    
    if not replay:
        raise HTTPException(status_code=404, detail="Replay not found")
    
    # Increment view count
    await db.battle_replays.update_one(
        {"replay_id": replay_id},
        {"$inc": {"views": 1}}
    )
    
    # Convert datetime to string
    if replay.get("created_at"):
        replay["created_at"] = replay["created_at"].isoformat()
    
    return replay


@game_router.get("/battle-replay/user/list")
async def get_user_replays(
    current_user: dict = Depends(get_current_user_from_request),
    limit: int = 20,
    skip: int = 0
):
    """Get all replays for the current user"""
    from server import db
    
    user_id = current_user.get("user_id")
    
    replays = await db.battle_replays.find(
        {"user_id": user_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    
    # Convert datetime to string
    for replay in replays:
        if replay.get("created_at"):
            replay["created_at"] = replay["created_at"].isoformat()
    
    total = await db.battle_replays.count_documents({"user_id": user_id})
    
    return {
        "replays": replays,
        "total": total,
        "has_more": skip + limit < total
    }


@game_router.post("/battle-replay/{replay_id}/share-to-feed")
async def share_replay_to_feed(
    replay_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Share a replay to the blendlink.net/feed"""
    from server import db
    
    user_id = current_user.get("user_id")
    
    # Get the replay
    replay = await db.battle_replays.find_one({"replay_id": replay_id, "user_id": user_id})
    if not replay:
        raise HTTPException(status_code=404, detail="Replay not found or not owned by user")
    
    # Check if already shared
    if replay.get("shared_to_feed"):
        return {"success": True, "message": "Already shared to feed", "post_id": replay.get("feed_post_id")}
    
    # Get user info
    user = await db.users.find_one({"user_id": user_id})
    
    # Create feed post
    post_id = str(uuid.uuid4())
    
    # Get thumbnail from first player photo
    thumbnail = None
    if replay.get("player_photos") and len(replay["player_photos"]) > 0:
        thumbnail = replay["player_photos"][0].get("image_url")
    
    feed_post = {
        "post_id": post_id,
        "user_id": user_id,
        "username": user.get("username", "Player"),
        "avatar_url": user.get("avatar_url"),
        "type": "battle_replay",
        "content": f"🎮 {replay['winner'].title()} vs {replay['difficulty'].title()} Bot! Score: {replay['final_score_player']}-{replay['final_score_opponent']}",
        "replay_id": replay_id,
        "replay_data": {
            "difficulty": replay["difficulty"],
            "winner": replay["winner"],
            "final_score_player": replay["final_score_player"],
            "final_score_opponent": replay["final_score_opponent"],
            "bet_amount": replay["bet_amount"],
            "winnings": replay["winnings"],
            "rounds_count": len(replay.get("rounds", [])),
        },
        "thumbnail_url": thumbnail,
        "share_url": f"/replay/{replay_id}",
        "created_at": datetime.now(timezone.utc),
        "likes": [],
        "comments": [],
        "shares": 0,
        "visibility": "public",
    }
    
    await db.social_posts.insert_one(feed_post)
    
    # Update replay as shared
    await db.battle_replays.update_one(
        {"replay_id": replay_id},
        {
            "$set": {"shared_to_feed": True, "feed_post_id": post_id},
            "$inc": {"shares": 1}
        }
    )
    
    return {
        "success": True,
        "post_id": post_id,
        "message": "Replay shared to feed!",
        "feed_url": "/feed"
    }


@game_router.post("/battle-replay/{replay_id}/like")
async def like_replay(
    replay_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Like a battle replay"""
    from server import db
    
    result = await db.battle_replays.update_one(
        {"replay_id": replay_id},
        {"$inc": {"likes": 1}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Replay not found")
    
    return {"success": True, "message": "Liked!"}


@game_router.delete("/battle-replay/{replay_id}")
async def delete_replay(
    replay_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Delete a battle replay"""
    from server import db
    
    user_id = current_user.get("user_id")
    
    result = await db.battle_replays.delete_one(
        {"replay_id": replay_id, "user_id": user_id}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Replay not found or not owned by user")
    
    # Also delete associated feed post if exists
    await db.social_posts.delete_one({"replay_id": replay_id})
    
    return {"success": True, "message": "Replay deleted"}


# ============== VIDEO EXPORT ==============

@game_router.get("/battle-replay/{replay_id}/export-video")
async def export_replay_video(
    replay_id: str,
    quality: str = "medium"  # low, medium, high
):
    """
    Export a battle replay as a shareable video/image summary.
    
    Since generating actual frame-by-frame video is complex,
    this endpoint generates a summary image with key stats.
    For full video, the frontend uses canvas recording.
    """
    from server import db
    from fastapi.responses import StreamingResponse
    import io
    from PIL import Image, ImageDraw, ImageFont
    import subprocess
    import tempfile
    import os
    
    # Get replay
    replay = await db.battle_replays.find_one({"replay_id": replay_id}, {"_id": 0})
    if not replay:
        raise HTTPException(status_code=404, detail="Replay not found")
    
    # Quality settings
    quality_settings = {
        "low": {"width": 640, "height": 480},
        "medium": {"width": 1280, "height": 720},
        "high": {"width": 1920, "height": 1080}
    }
    settings = quality_settings.get(quality, quality_settings["medium"])
    width, height = settings["width"], settings["height"]
    
    # Create image
    img = Image.new('RGB', (width, height), color=(26, 26, 46))
    draw = ImageDraw.Draw(img)
    
    # Try to load a font, fall back to default
    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(height * 0.05))
        large_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(height * 0.08))
        normal_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", int(height * 0.03))
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", int(height * 0.025))
    except (IOError, OSError):
        title_font = ImageFont.load_default()
        large_font = ImageFont.load_default()
        normal_font = ImageFont.load_default()
        small_font = ImageFont.load_default()
    
    # Colors
    win_color = (34, 197, 94)  # Green
    lose_color = (239, 68, 68)  # Red
    gold_color = (251, 191, 36)
    purple_color = (167, 139, 250)
    white_color = (255, 255, 255)
    gray_color = (156, 163, 175)
    
    is_winner = replay.get("winner") == "player"
    result_color = win_color if is_winner else lose_color
    
    # Draw gradient background effect (simple version)
    for i in range(height):
        r = int(26 + (40 - 26) * (i / height))
        g = int(26 + (20 - 26) * (i / height))
        b = int(46 + (60 - 46) * (i / height))
        draw.line([(0, i), (width, i)], fill=(r, g, b))
    
    # Draw decorative border
    draw.rectangle([10, 10, width-10, height-10], outline=purple_color, width=3)
    
    # Title
    title = "🎮 MINTED PHOTO BATTLE"
    draw.text((width // 2, height * 0.08), title, fill=white_color, font=title_font, anchor="mm")
    
    # Result
    result_text = "🏆 VICTORY!" if is_winner else "💀 DEFEAT"
    draw.text((width // 2, height * 0.2), result_text, fill=result_color, font=large_font, anchor="mm")
    
    # Score
    score_text = f"{replay.get('final_score_player', 0)} - {replay.get('final_score_opponent', 0)}"
    draw.text((width // 2, height * 0.35), score_text, fill=white_color, font=large_font, anchor="mm")
    
    # Difficulty
    difficulty = replay.get("difficulty", "easy").upper()
    draw.text((width // 2, height * 0.45), f"vs {difficulty} BOT", fill=purple_color, font=normal_font, anchor="mm")
    
    # Stats box
    stats_y = height * 0.55
    stats = [
        f"💰 Bet: {replay.get('bet_amount', 0)} BL",
        f"🎯 Won: {replay.get('winnings', 0)} BL",
        f"📊 Rounds: {len(replay.get('rounds', []))}",
        f"👁 Views: {replay.get('views', 0)}",
    ]
    for i, stat in enumerate(stats):
        draw.text((width // 2, stats_y + i * (height * 0.06)), stat, fill=gold_color, font=normal_font, anchor="mm")
    
    # Watermark
    draw.text((width // 2, height * 0.92), "blendlink.net/photo-game", fill=gray_color, font=small_font, anchor="mm")
    draw.text((width // 2, height * 0.96), f"Replay ID: {replay_id[:8]}...", fill=gray_color, font=small_font, anchor="mm")
    
    # Convert to bytes
    img_bytes = io.BytesIO()
    img.save(img_bytes, format='PNG', optimize=True)
    img_bytes.seek(0)
    
    # Return as streaming response
    return StreamingResponse(
        img_bytes,
        media_type="image/png",
        headers={
            "Content-Disposition": f"attachment; filename=battle_replay_{replay_id}.png"
        }
    )


@game_router.post("/battle-replay/{replay_id}/generate-gif")
async def generate_replay_gif(
    replay_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Generate an animated GIF from replay data.
    Creates frames showing round progression.
    """
    from server import db
    from fastapi.responses import StreamingResponse
    import io
    from PIL import Image, ImageDraw, ImageFont
    import tempfile
    import subprocess
    import os
    
    # Get replay
    replay = await db.battle_replays.find_one({"replay_id": replay_id}, {"_id": 0})
    if not replay:
        raise HTTPException(status_code=404, detail="Replay not found")
    
    rounds = replay.get("rounds", [])
    if not rounds:
        raise HTTPException(status_code=400, detail="Replay has no round data")
    
    # Settings
    width, height = 400, 300
    frames = []
    
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
        small_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
    except (IOError, OSError):
        font = ImageFont.load_default()
        small_font = ImageFont.load_default()
    
    # Create intro frame
    intro = Image.new('RGB', (width, height), color=(26, 26, 46))
    draw = ImageDraw.Draw(intro)
    draw.text((width // 2, 50), "🎮 BATTLE REPLAY", fill=(255, 255, 255), font=font, anchor="mm")
    draw.text((width // 2, 100), f"vs {replay.get('difficulty', 'Bot').upper()}", fill=(167, 139, 250), font=small_font, anchor="mm")
    draw.text((width // 2, 150), "Starting...", fill=(156, 163, 175), font=small_font, anchor="mm")
    frames.append(intro)
    
    # Create frame for each round
    player_score = 0
    opponent_score = 0
    
    for i, round_data in enumerate(rounds):
        img = Image.new('RGB', (width, height), color=(26, 26, 46))
        draw = ImageDraw.Draw(img)
        
        # Update scores
        if round_data.get("round_won"):
            player_score += 1
        else:
            opponent_score += 1
        
        # Round header
        round_type = round_data.get("type", "tapping")
        round_emoji = "👆" if round_type == "tapping" else "✊✋✌️"
        draw.text((width // 2, 30), f"Round {i + 1} {round_emoji}", fill=(255, 255, 255), font=font, anchor="mm")
        
        # Score
        score_color = (34, 197, 94) if player_score > opponent_score else (239, 68, 68) if opponent_score > player_score else (255, 255, 255)
        draw.text((width // 2, 80), f"{player_score} - {opponent_score}", fill=score_color, font=font, anchor="mm")
        
        # Round result
        result = "YOU WIN! ✓" if round_data.get("round_won") else "OPPONENT WINS ✗"
        result_color = (34, 197, 94) if round_data.get("round_won") else (239, 68, 68)
        draw.text((width // 2, 130), result, fill=result_color, font=small_font, anchor="mm")
        
        # Stats if available
        if round_type == "tapping":
            player_taps = round_data.get("player_taps", 0)
            opponent_taps = round_data.get("opponent_taps", 0)
            draw.text((width // 2, 170), f"Taps: {player_taps} vs {opponent_taps}", fill=(156, 163, 175), font=small_font, anchor="mm")
        elif round_type == "rps":
            player_choice = round_data.get("rpsChoicePlayer", "?")
            opponent_choice = round_data.get("rpsChoiceOpponent", "?")
            draw.text((width // 2, 170), f"{player_choice.upper()} vs {opponent_choice.upper()}", fill=(156, 163, 175), font=small_font, anchor="mm")
        
        # Dollar values
        p_val = round_data.get("playerEffectiveValue", 0)
        o_val = round_data.get("opponentEffectiveValue", 0)
        if p_val or o_val:
            p_str = f"${p_val / 1_000_000:.0f}M" if p_val >= 1_000_000 else f"${p_val:,}"
            o_str = f"${o_val / 1_000_000:.0f}M" if o_val >= 1_000_000 else f"${o_val:,}"
            draw.text((width // 2, 200), f"Power: {p_str} vs {o_str}", fill=(251, 191, 36), font=small_font, anchor="mm")
        
        frames.append(img)
    
    # Create final result frame
    final = Image.new('RGB', (width, height), color=(26, 26, 46))
    draw = ImageDraw.Draw(final)
    is_winner = replay.get("winner") == "player"
    draw.text((width // 2, 50), "🏆 VICTORY!" if is_winner else "💀 DEFEAT", fill=(34, 197, 94) if is_winner else (239, 68, 68), font=font, anchor="mm")
    draw.text((width // 2, 100), f"Final: {player_score} - {opponent_score}", fill=(255, 255, 255), font=font, anchor="mm")
    draw.text((width // 2, 150), f"Won: {replay.get('winnings', 0)} BL 💰", fill=(251, 191, 36), font=small_font, anchor="mm")
    draw.text((width // 2, 250), "blendlink.net", fill=(156, 163, 175), font=small_font, anchor="mm")
    frames.append(final)
    
    # Save as GIF
    gif_bytes = io.BytesIO()
    frames[0].save(
        gif_bytes,
        format='GIF',
        save_all=True,
        append_images=frames[1:],
        duration=1500,  # 1.5 seconds per frame
        loop=0
    )
    gif_bytes.seek(0)
    
    return StreamingResponse(
        gif_bytes,
        media_type="image/gif",
        headers={
            "Content-Disposition": f"attachment; filename=battle_replay_{replay_id}.gif"
        }
    )



# ============== MOCK ENGAGEMENT SERVICE ==============
# Simulates social engagement (❤️ likes) until real Facebook Graph API is integrated

class LikePhotoRequest(BaseModel):
    """Request to like/react to a photo"""
    photo_id: str
    reaction_type: str = "heart"  # heart, like, love, wow, etc.


@game_router.post("/engagement/like")
async def like_photo(
    request: LikePhotoRequest,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    Mock engagement service - Like/react to a photo.
    Simulates Facebook-style reactions for testing.
    Can be replaced with real Facebook Graph API later.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user["user_id"]
    photo_id = request.photo_id
    reaction_type = request.reaction_type
    
    # Check if photo exists
    photo = await _db.minted_photos.find_one({"mint_id": photo_id})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Check if user already reacted to this photo
    existing_reaction = await _db.photo_reactions.find_one({
        "photo_id": photo_id,
        "user_id": user_id
    })
    
    if existing_reaction:
        # User already reacted - update reaction type
        await _db.photo_reactions.update_one(
            {"photo_id": photo_id, "user_id": user_id},
            {"$set": {"reaction_type": reaction_type, "updated_at": datetime.now(timezone.utc)}}
        )
        action = "updated"
    else:
        # New reaction
        await _db.photo_reactions.insert_one({
            "photo_id": photo_id,
            "user_id": user_id,
            "reaction_type": reaction_type,
            "created_at": datetime.now(timezone.utc)
        })
        
        # Increment reaction count on photo
        await _db.minted_photos.update_one(
            {"mint_id": photo_id},
            {"$inc": {"reaction_count": 1, f"reactions.{reaction_type}": 1}}
        )
        action = "added"
    
    # Get updated counts
    updated_photo = await _db.minted_photos.find_one({"mint_id": photo_id}, {"_id": 0, "reaction_count": 1, "reactions": 1})
    
    return {
        "success": True,
        "action": action,
        "photo_id": photo_id,
        "reaction_type": reaction_type,
        "total_reactions": updated_photo.get("reaction_count", 0),
        "reactions_breakdown": updated_photo.get("reactions", {})
    }


@game_router.delete("/engagement/unlike/{photo_id}")
async def unlike_photo(
    photo_id: str,
    current_user: dict = Depends(get_current_user_from_request)
):
    """Remove user's reaction from a photo"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    user_id = current_user["user_id"]
    
    # Check if reaction exists
    existing_reaction = await _db.photo_reactions.find_one({
        "photo_id": photo_id,
        "user_id": user_id
    })
    
    if not existing_reaction:
        raise HTTPException(status_code=404, detail="Reaction not found")
    
    reaction_type = existing_reaction.get("reaction_type", "heart")
    
    # Remove reaction
    await _db.photo_reactions.delete_one({
        "photo_id": photo_id,
        "user_id": user_id
    })
    
    # Decrement count on photo
    await _db.minted_photos.update_one(
        {"mint_id": photo_id},
        {"$inc": {"reaction_count": -1, f"reactions.{reaction_type}": -1}}
    )
    
    return {
        "success": True,
        "action": "removed",
        "photo_id": photo_id
    }


@game_router.get("/engagement/photo/{photo_id}")
async def get_photo_engagement(
    photo_id: str,
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """Get engagement stats for a photo"""
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    photo = await _db.minted_photos.find_one(
        {"mint_id": photo_id}, 
        {"_id": 0, "reaction_count": 1, "reactions": 1, "name": 1}
    )
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    # Check if current user has reacted
    user_reaction = None
    if current_user:
        reaction = await _db.photo_reactions.find_one({
            "photo_id": photo_id,
            "user_id": current_user["user_id"]
        })
        if reaction:
            user_reaction = reaction.get("reaction_type")
    
    return {
        "photo_id": photo_id,
        "photo_name": photo.get("name", ""),
        "total_reactions": photo.get("reaction_count", 0),
        "reactions_breakdown": photo.get("reactions", {}),
        "user_reaction": user_reaction
    }


@game_router.post("/engagement/simulate-reactions/{photo_id}")
async def simulate_reactions(
    photo_id: str,
    count: int = 10,
    current_user: dict = Depends(get_current_user_from_request)
):
    """
    [DEV ONLY] Simulate random reactions on a photo for testing.
    This allows easy testing of the ❤️ counter display.
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Only allow photo owner to simulate reactions
    photo = await _db.minted_photos.find_one({"mint_id": photo_id, "user_id": current_user["user_id"]})
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found or not owned by user")
    
    import random
    reaction_types = ["heart", "like", "love", "wow", "haha"]
    
    # Add simulated reactions
    simulated_increment = {
        "reaction_count": count,
    }
    
    # Distribute reactions randomly
    for _ in range(count):
        reaction_type = random.choice(reaction_types)
        key = f"reactions.{reaction_type}"
        simulated_increment[key] = simulated_increment.get(key, 0) + 1
    
    await _db.minted_photos.update_one(
        {"mint_id": photo_id},
        {"$inc": simulated_increment}
    )
    
    # Get updated counts
    updated_photo = await _db.minted_photos.find_one({"mint_id": photo_id}, {"_id": 0, "reaction_count": 1, "reactions": 1})
    
    return {
        "success": True,
        "photo_id": photo_id,
        "simulated_count": count,
        "total_reactions": updated_photo.get("reaction_count", 0),
        "reactions_breakdown": updated_photo.get("reactions", {})
    }


# ============== TOP LIKED PHOTOS LEADERBOARD ==============

@game_router.get("/leaderboard/top-liked-photos")
async def get_top_liked_photos(
    limit: int = 20,
    period: str = "all_time",  # all_time, this_week, this_month
    current_user: Optional[dict] = Depends(get_optional_user)
):
    """
    Get leaderboard of most liked/reacted photos
    
    Periods:
    - all_time: All photos sorted by total reactions
    - this_week: Photos created or reacted to in the last 7 days
    - this_month: Photos created or reacted to in the last 30 days
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Build date filter
    date_filter = {}
    if period == "this_week":
        date_filter = {"created_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=7)}}
    elif period == "this_month":
        date_filter = {"created_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=30)}}
    
    # Aggregation pipeline
    pipeline = [
        {"$match": {
            **date_filter,
            "reaction_count": {"$gt": 0}  # Only photos with reactions
        }},
        {"$sort": {"reaction_count": -1, "dollar_value": -1}},
        {"$limit": limit},
        # Lookup user info
        {
            "$lookup": {
                "from": "users",
                "let": {"user_id": "$user_id"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$user_id", "$$user_id"]}}},
                    {"$project": {"username": 1, "profile_image": 1, "_id": 0}}
                ],
                "as": "owner_info"
            }
        },
        {"$unwind": {"path": "$owner_info", "preserveNullAndEmptyArrays": True}},
        # Project fields
        {
            "$project": {
                "_id": 0,
                "mint_id": 1,
                "name": 1,
                "image_url": 1,
                "dollar_value": 1,
                "level": 1,
                "scenery_type": 1,
                "reaction_count": 1,
                "reactions": 1,
                "created_at": 1,
                "battles_won": 1,
                "battles_lost": 1,
                "current_win_streak": 1,
                "owner_username": "$owner_info.username",
                "owner_avatar": "$owner_info.profile_image",
                "user_id": 1
            }
        }
    ]
    
    photos = await _db.minted_photos.aggregate(pipeline).to_list(length=limit)
    
    # Add rank and check if current user liked each photo
    for i, photo in enumerate(photos):
        photo["rank"] = i + 1
        if photo.get("created_at"):
            photo["created_at"] = photo["created_at"].isoformat() if hasattr(photo["created_at"], 'isoformat') else str(photo["created_at"])
        
        # Check if current user has liked this photo
        if current_user:
            user_reaction = await _db.photo_reactions.find_one({
                "photo_id": photo["mint_id"],
                "user_id": current_user["user_id"]
            })
            photo["user_liked"] = user_reaction is not None
        else:
            photo["user_liked"] = False
    
    return {
        "photos": photos,
        "period": period,
        "total": len(photos)
    }


@game_router.get("/leaderboard/top-players")
async def get_top_players(
    limit: int = 20,
    sort_by: str = "total_wins"  # total_wins, bl_coins, total_photos
):
    """
    Get leaderboard of top players
    
    Sort options:
    - total_wins: Most battle wins
    - bl_coins: Most BL coins
    - total_photos: Most minted photos
    """
    if _db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    
    # Aggregation to get player stats
    pipeline = [
        # Get all minted photos and group by user
        {
            "$group": {
                "_id": "$user_id",
                "total_photos": {"$sum": 1},
                "total_wins": {"$sum": "$battles_won"},
                "total_losses": {"$sum": "$battles_lost"},
                "total_reactions": {"$sum": {"$ifNull": ["$reaction_count", 0]}},
                "total_dollar_value": {"$sum": "$dollar_value"},
            }
        },
        # Lookup user info
        {
            "$lookup": {
                "from": "users",
                "let": {"user_id": "$_id"},
                "pipeline": [
                    {"$match": {"$expr": {"$eq": ["$user_id", "$$user_id"]}}},
                    {"$project": {"username": 1, "profile_image": 1, "bl_coins": 1, "_id": 0}}
                ],
                "as": "user_info"
            }
        },
        {"$unwind": {"path": "$user_info", "preserveNullAndEmptyArrays": True}},
        # Add user fields
        {
            "$project": {
                "_id": 0,
                "user_id": "$_id",
                "username": {"$ifNull": ["$user_info.username", "Anonymous"]},
                "avatar": "$user_info.profile_image",
                "bl_coins": {"$ifNull": ["$user_info.bl_coins", 0]},
                "total_photos": 1,
                "total_wins": 1,
                "total_losses": 1,
                "total_reactions": 1,
                "total_dollar_value": 1,
                "win_rate": {
                    "$cond": [
                        {"$eq": [{"$add": ["$total_wins", "$total_losses"]}, 0]},
                        0,
                        {"$multiply": [
                            {"$divide": ["$total_wins", {"$add": ["$total_wins", "$total_losses"]}]},
                            100
                        ]}
                    ]
                }
            }
        },
        # Sort
        {"$sort": {sort_by: -1, "total_wins": -1}},
        {"$limit": limit}
    ]
    
    players = await _db.minted_photos.aggregate(pipeline).to_list(length=limit)
    
    # Add rank
    for i, player in enumerate(players):
        player["rank"] = i + 1
        player["win_rate"] = round(player.get("win_rate", 0), 1)
    
    return {
        "players": players,
        "sort_by": sort_by,
        "total": len(players)
    }

