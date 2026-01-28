"""
Blendlink Photo Game API Routes v3.0
- Open Games (PVP matchmaking)
- Game sessions
- RPS battles with power advantage
- Photo auction bidding (tapping)
- Stamina system
- Leaderboards
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import logging
import uuid
from datetime import datetime, timezone

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
        
        # Build photo data for preview
        photo_data = {
            "mint_id": photo.get("mint_id"),
            "name": photo.get("name"),
            "image_url": photo.get("image_url"),
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
        
        photo_data = {
            "mint_id": photo.get("mint_id"),
            "name": photo.get("name"),
            "image_url": photo.get("image_url"),
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
    
    # Broadcast game start via WebSocket
    try:
        from lobby_websocket import lobby_manager
        await lobby_manager.broadcast_game_start(
            game_id=game_id,
            session_id=session.session_id,
            session_data=session.model_dump()
        )
    except Exception as e:
        logger.warning(f"Could not broadcast game start: {e}")
    
    # Create PVP game room for real-time synchronized gameplay
    try:
        from pvp_game_websocket import pvp_game_manager
        room_id = await pvp_game_manager.create_room(game_id)
        
        # Broadcast room creation
        try:
            from lobby_websocket import lobby_manager
            await lobby_manager.broadcast_to_lobby(game_id, {
                "type": "pvp_room_created",
                "room_id": room_id,
                "session_id": session.session_id,
            })
        except Exception as e:
            logger.warning(f"Could not broadcast room creation: {e}")
        
        return {
            "success": True,
            "session_id": session.session_id,
            "session": session.model_dump(),
            "pvp_room_id": room_id,
            "websocket_url": f"/ws/pvp-game/{room_id}",
        }
    except Exception as e:
        logger.warning(f"Could not create PVP game room: {e}")
        return {
            "success": True,
            "session_id": session.session_id,
            "session": session.model_dump()
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
    
    return {
        "success": True,
        "photo_id": mint_id,
        "round_won": round_won,
        "new_win_streak": new_win_streak if round_won else 0,
        "medal_earned": medal_earned,
        "total_medals": medals.get("ten_win_streak", 0),
        "bonus_coins": bonus_coins,
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
        if stamina_record:
            medals = stamina_record.get("medals", {"ten_win_streak": 0})
            win_streak = stamina_record.get("win_streak", 0)
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
            "image_url": photo.get("image_url", ""),
            "medals": medals,
            "win_streak": win_streak,
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
    
    # Get player's photo
    player_photo = await _db.minted_photos.find_one(
        {"mint_id": request.photo_id, "user_id": current_user["user_id"]},
        {"_id": 0, "image_data": 0}
    )
    
    if not player_photo:
        raise HTTPException(status_code=404, detail="Photo not found or not owned by you")
    
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
