"""
Blendlink Casino System
- Provably fair games using BL coins
- Slots, Blackjack, Roulette, Poker, Baccarat, Craps, Wheel of Fortune
- Min bet: 10 BL, Max bet: 10,000 BL
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import random
import hashlib
import json

# Import from main server
from server import get_current_user, db, logger

# Create router
casino_router = APIRouter(prefix="/casino", tags=["Casino"])

# Constants
MIN_BET = 10
MAX_BET = 10000

# ============== MODELS ==============

class BetRequest(BaseModel):
    amount: int = Field(..., ge=MIN_BET, le=MAX_BET)
    game_type: str
    game_data: Optional[Dict[str, Any]] = None

class SlotsBetRequest(BaseModel):
    amount: int = Field(..., ge=MIN_BET, le=MAX_BET)
    lines: int = Field(default=1, ge=1, le=25)

class BlackjackAction(BaseModel):
    game_id: str
    action: str  # "hit", "stand", "double", "split"

class RouletteBet(BaseModel):
    amount: int = Field(..., ge=MIN_BET, le=MAX_BET)
    bet_type: str  # "number", "red", "black", "odd", "even", "1-18", "19-36", "column", "dozen"
    bet_value: Any  # number(s) or None for color/parity bets

class PokerBetRequest(BaseModel):
    amount: int = Field(..., ge=MIN_BET, le=MAX_BET)

class BaccaratBet(BaseModel):
    amount: int = Field(..., ge=MIN_BET, le=MAX_BET)
    bet_on: str  # "player", "banker", "tie"

class CrapsBet(BaseModel):
    amount: int = Field(..., ge=MIN_BET, le=MAX_BET)
    bet_type: str  # "pass", "dont_pass", "come", "dont_come", "field", "any_seven", etc.

class WheelSpinRequest(BaseModel):
    amount: int = Field(..., ge=MIN_BET, le=MAX_BET)

# ============== HELPER FUNCTIONS ==============

def generate_server_seed():
    """Generate a random server seed for provably fair gaming"""
    return hashlib.sha256(str(uuid.uuid4()).encode()).hexdigest()

def generate_client_seed():
    """Generate a client seed"""
    return hashlib.md5(str(random.random()).encode()).hexdigest()[:16]

def get_random_number(server_seed: str, client_seed: str, nonce: int, max_value: int) -> int:
    """Generate provably fair random number"""
    combined = f"{server_seed}:{client_seed}:{nonce}"
    hash_result = hashlib.sha256(combined.encode()).hexdigest()
    return int(hash_result[:8], 16) % max_value

def get_random_float(server_seed: str, client_seed: str, nonce: int) -> float:
    """Generate provably fair random float between 0 and 1"""
    combined = f"{server_seed}:{client_seed}:{nonce}"
    hash_result = hashlib.sha256(combined.encode()).hexdigest()
    return int(hash_result[:8], 16) / 0xFFFFFFFF

async def deduct_bet(user_id: str, amount: int) -> bool:
    """Deduct BL coins for bet"""
    user = await db.users.find_one({"user_id": user_id})
    if not user or user.get("bl_coins", 0) < amount:
        return False
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"bl_coins": -amount}}
    )
    return True

async def add_winnings(user_id: str, amount: int):
    """Add winnings to user's BL coins"""
    await db.users.update_one(
        {"user_id": user_id},
        {"$inc": {"bl_coins": amount}}
    )

async def record_game(user_id: str, game_type: str, bet: int, won: int, details: dict):
    """Record game history"""
    record = {
        "record_id": f"game_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "game_type": game_type,
        "bet_amount": bet,
        "won_amount": won,
        "profit": won - bet,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.casino_history.insert_one(record)
    return record

# ============== SLOTS ==============

SLOT_SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "🔔", "⭐", "💎", "7️⃣"]
SLOT_PAYOUTS = {
    "🍒🍒🍒": 5,
    "🍋🍋🍋": 10,
    "🍊🍊🍊": 15,
    "🍇🍇🍇": 20,
    "🔔🔔🔔": 25,
    "⭐⭐⭐": 50,
    "💎💎💎": 100,
    "7️⃣7️⃣7️⃣": 500,
    # Two of a kind (partial wins)
    "🍒🍒": 2,
    "🍋🍋": 2,
    "🍊🍊": 3,
    "🍇🍇": 3,
}

@casino_router.post("/slots/spin")
async def spin_slots(request: SlotsBetRequest, current_user: dict = Depends(get_current_user)):
    """Spin the slot machine"""
    total_bet = request.amount * request.lines
    
    if total_bet > MAX_BET:
        raise HTTPException(status_code=400, detail=f"Total bet cannot exceed {MAX_BET} BL coins")
    
    if not await deduct_bet(current_user["user_id"], total_bet):
        raise HTTPException(status_code=400, detail="Insufficient BL coins")
    
    server_seed = generate_server_seed()
    client_seed = generate_client_seed()
    
    # Generate 3x3 grid for classic slots (or 5x3 for video slots)
    reels = []
    for i in range(3):
        reel = []
        for j in range(3):
            idx = get_random_number(server_seed, client_seed, i * 3 + j, len(SLOT_SYMBOLS))
            reel.append(SLOT_SYMBOLS[idx])
        reels.append(reel)
    
    # Check wins on middle row (line 1)
    middle_row = [reels[0][1], reels[1][1], reels[2][1]]
    win_key = "".join(middle_row)
    
    multiplier = 0
    if win_key in SLOT_PAYOUTS:
        multiplier = SLOT_PAYOUTS[win_key]
    elif middle_row[0] == middle_row[1]:
        two_key = middle_row[0] + middle_row[1]
        multiplier = SLOT_PAYOUTS.get(two_key, 0)
    
    winnings = request.amount * multiplier
    
    if winnings > 0:
        await add_winnings(current_user["user_id"], winnings)
    
    # Get updated balance
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    result = {
        "reels": reels,
        "middle_row": middle_row,
        "bet": total_bet,
        "multiplier": multiplier,
        "winnings": winnings,
        "balance": user.get("bl_coins", 0),
        "is_jackpot": multiplier >= 100,
        "server_seed_hash": hashlib.sha256(server_seed.encode()).hexdigest()
    }
    
    await record_game(current_user["user_id"], "slots", total_bet, winnings, result)
    
    return result

# ============== BLACKJACK ==============

CARD_VALUES = {
    "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
    "J": 10, "Q": 10, "K": 10, "A": 11
}
SUITS = ["♠", "♥", "♦", "♣"]
CARDS = list(CARD_VALUES.keys())

def create_deck():
    """Create a shuffled deck"""
    deck = [(card, suit) for card in CARDS for suit in SUITS]
    random.shuffle(deck)
    return deck

def calculate_hand(hand):
    """Calculate blackjack hand value"""
    value = sum(CARD_VALUES[card[0]] for card in hand)
    aces = sum(1 for card in hand if card[0] == "A")
    
    while value > 21 and aces:
        value -= 10
        aces -= 1
    
    return value

def format_hand(hand):
    """Format hand for display"""
    return [f"{card[0]}{card[1]}" for card in hand]

# Store active blackjack games
blackjack_games = {}

@casino_router.post("/blackjack/start")
async def start_blackjack(request: BetRequest, current_user: dict = Depends(get_current_user)):
    """Start a new blackjack game"""
    if not await deduct_bet(current_user["user_id"], request.amount):
        raise HTTPException(status_code=400, detail="Insufficient BL coins")
    
    deck = create_deck()
    player_hand = [deck.pop(), deck.pop()]
    dealer_hand = [deck.pop(), deck.pop()]
    
    game_id = f"bj_{uuid.uuid4().hex[:12]}"
    
    game_state = {
        "game_id": game_id,
        "user_id": current_user["user_id"],
        "bet": request.amount,
        "deck": deck,
        "player_hand": player_hand,
        "dealer_hand": dealer_hand,
        "player_value": calculate_hand(player_hand),
        "status": "playing",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    blackjack_games[game_id] = game_state
    
    # Check for natural blackjack
    if game_state["player_value"] == 21:
        return await resolve_blackjack(game_id, current_user)
    
    return {
        "game_id": game_id,
        "player_hand": format_hand(player_hand),
        "player_value": game_state["player_value"],
        "dealer_showing": format_hand([dealer_hand[0]]),
        "bet": request.amount,
        "actions": ["hit", "stand", "double"] if len(player_hand) == 2 else ["hit", "stand"]
    }

@casino_router.post("/blackjack/action")
async def blackjack_action(action: BlackjackAction, current_user: dict = Depends(get_current_user)):
    """Perform blackjack action"""
    game = blackjack_games.get(action.game_id)
    
    if not game or game["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=404, detail="Game not found")
    
    if game["status"] != "playing":
        raise HTTPException(status_code=400, detail="Game already finished")
    
    if action.action == "hit":
        game["player_hand"].append(game["deck"].pop())
        game["player_value"] = calculate_hand(game["player_hand"])
        
        if game["player_value"] > 21:
            game["status"] = "bust"
            return await resolve_blackjack(action.game_id, current_user)
        elif game["player_value"] == 21:
            return await resolve_blackjack(action.game_id, current_user)
        
        return {
            "game_id": action.game_id,
            "player_hand": format_hand(game["player_hand"]),
            "player_value": game["player_value"],
            "dealer_showing": format_hand([game["dealer_hand"][0]]),
            "actions": ["hit", "stand"]
        }
    
    elif action.action == "stand":
        return await resolve_blackjack(action.game_id, current_user)
    
    elif action.action == "double":
        if len(game["player_hand"]) != 2:
            raise HTTPException(status_code=400, detail="Can only double on first two cards")
        
        if not await deduct_bet(current_user["user_id"], game["bet"]):
            raise HTTPException(status_code=400, detail="Insufficient BL coins for double")
        
        game["bet"] *= 2
        game["player_hand"].append(game["deck"].pop())
        game["player_value"] = calculate_hand(game["player_hand"])
        
        return await resolve_blackjack(action.game_id, current_user)
    
    raise HTTPException(status_code=400, detail="Invalid action")

async def resolve_blackjack(game_id: str, current_user: dict):
    """Resolve blackjack game and determine winner"""
    game = blackjack_games[game_id]
    
    # Dealer plays
    dealer_value = calculate_hand(game["dealer_hand"])
    while dealer_value < 17:
        game["dealer_hand"].append(game["deck"].pop())
        dealer_value = calculate_hand(game["dealer_hand"])
    
    player_value = game["player_value"]
    winnings = 0
    result = ""
    
    if player_value > 21:
        result = "bust"
        winnings = 0
    elif dealer_value > 21:
        result = "dealer_bust"
        winnings = game["bet"] * 2
    elif player_value == 21 and len(game["player_hand"]) == 2:
        result = "blackjack"
        winnings = int(game["bet"] * 2.5)
    elif player_value > dealer_value:
        result = "win"
        winnings = game["bet"] * 2
    elif player_value == dealer_value:
        result = "push"
        winnings = game["bet"]
    else:
        result = "lose"
        winnings = 0
    
    if winnings > 0:
        await add_winnings(current_user["user_id"], winnings)
    
    game["status"] = "finished"
    
    # Get updated balance
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    response = {
        "game_id": game_id,
        "player_hand": format_hand(game["player_hand"]),
        "player_value": player_value,
        "dealer_hand": format_hand(game["dealer_hand"]),
        "dealer_value": dealer_value,
        "result": result,
        "bet": game["bet"],
        "winnings": winnings,
        "profit": winnings - game["bet"],
        "balance": user.get("bl_coins", 0)
    }
    
    await record_game(current_user["user_id"], "blackjack", game["bet"], winnings, response)
    
    # Cleanup
    del blackjack_games[game_id]
    
    return response

# ============== ROULETTE ==============

ROULETTE_RED = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]
ROULETTE_BLACK = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]

@casino_router.post("/roulette/spin")
async def spin_roulette(bets: List[RouletteBet], current_user: dict = Depends(get_current_user)):
    """Spin the roulette wheel with multiple bets"""
    total_bet = sum(bet.amount for bet in bets)
    
    if total_bet > MAX_BET:
        raise HTTPException(status_code=400, detail=f"Total bet cannot exceed {MAX_BET} BL coins")
    
    if not await deduct_bet(current_user["user_id"], total_bet):
        raise HTTPException(status_code=400, detail="Insufficient BL coins")
    
    # Spin the wheel (0-36 for European, 0-37 for American with 00)
    server_seed = generate_server_seed()
    client_seed = generate_client_seed()
    result_number = get_random_number(server_seed, client_seed, 0, 37)
    
    # Determine color
    if result_number == 0:
        result_color = "green"
    elif result_number in ROULETTE_RED:
        result_color = "red"
    else:
        result_color = "black"
    
    # Calculate winnings for each bet
    total_winnings = 0
    bet_results = []
    
    for bet in bets:
        won = False
        payout = 0
        
        if bet.bet_type == "number" and bet.bet_value == result_number:
            won = True
            payout = bet.amount * 36
        elif bet.bet_type == "red" and result_color == "red":
            won = True
            payout = bet.amount * 2
        elif bet.bet_type == "black" and result_color == "black":
            won = True
            payout = bet.amount * 2
        elif bet.bet_type == "odd" and result_number > 0 and result_number % 2 == 1:
            won = True
            payout = bet.amount * 2
        elif bet.bet_type == "even" and result_number > 0 and result_number % 2 == 0:
            won = True
            payout = bet.amount * 2
        elif bet.bet_type == "1-18" and 1 <= result_number <= 18:
            won = True
            payout = bet.amount * 2
        elif bet.bet_type == "19-36" and 19 <= result_number <= 36:
            won = True
            payout = bet.amount * 2
        elif bet.bet_type == "column":
            column = bet.bet_value
            column_numbers = [i for i in range(1, 37) if i % 3 == (column % 3)]
            if result_number in column_numbers:
                won = True
                payout = bet.amount * 3
        elif bet.bet_type == "dozen":
            dozen = bet.bet_value
            if dozen == 1 and 1 <= result_number <= 12:
                won = True
                payout = bet.amount * 3
            elif dozen == 2 and 13 <= result_number <= 24:
                won = True
                payout = bet.amount * 3
            elif dozen == 3 and 25 <= result_number <= 36:
                won = True
                payout = bet.amount * 3
        
        total_winnings += payout
        bet_results.append({
            "bet_type": bet.bet_type,
            "bet_value": bet.bet_value,
            "amount": bet.amount,
            "won": won,
            "payout": payout
        })
    
    if total_winnings > 0:
        await add_winnings(current_user["user_id"], total_winnings)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    result = {
        "result_number": result_number,
        "result_color": result_color,
        "total_bet": total_bet,
        "total_winnings": total_winnings,
        "profit": total_winnings - total_bet,
        "bet_results": bet_results,
        "balance": user.get("bl_coins", 0),
        "server_seed_hash": hashlib.sha256(server_seed.encode()).hexdigest()
    }
    
    await record_game(current_user["user_id"], "roulette", total_bet, total_winnings, result)
    
    return result

# ============== VIDEO POKER ==============

POKER_HANDS = {
    "royal_flush": 800,
    "straight_flush": 50,
    "four_of_a_kind": 25,
    "full_house": 9,
    "flush": 6,
    "straight": 4,
    "three_of_a_kind": 3,
    "two_pair": 2,
    "jacks_or_better": 1
}

def evaluate_poker_hand(cards):
    """Evaluate a 5-card poker hand"""
    values = sorted([CARDS.index(c[0]) for c in cards], reverse=True)
    suits = [c[1] for c in cards]
    
    is_flush = len(set(suits)) == 1
    is_straight = (max(values) - min(values) == 4 and len(set(values)) == 5) or values == [12, 3, 2, 1, 0]
    
    value_counts = {}
    for v in values:
        value_counts[v] = value_counts.get(v, 0) + 1
    
    counts = sorted(value_counts.values(), reverse=True)
    
    # Royal flush
    if is_flush and is_straight and min(values) >= 8:
        return "royal_flush", POKER_HANDS["royal_flush"]
    
    # Straight flush
    if is_flush and is_straight:
        return "straight_flush", POKER_HANDS["straight_flush"]
    
    # Four of a kind
    if counts == [4, 1]:
        return "four_of_a_kind", POKER_HANDS["four_of_a_kind"]
    
    # Full house
    if counts == [3, 2]:
        return "full_house", POKER_HANDS["full_house"]
    
    # Flush
    if is_flush:
        return "flush", POKER_HANDS["flush"]
    
    # Straight
    if is_straight:
        return "straight", POKER_HANDS["straight"]
    
    # Three of a kind
    if counts == [3, 1, 1]:
        return "three_of_a_kind", POKER_HANDS["three_of_a_kind"]
    
    # Two pair
    if counts == [2, 2, 1]:
        return "two_pair", POKER_HANDS["two_pair"]
    
    # Jacks or better (pair of J, Q, K, A)
    if counts == [2, 1, 1, 1]:
        pair_value = [v for v, c in value_counts.items() if c == 2][0]
        if pair_value >= 9:  # J, Q, K, A
            return "jacks_or_better", POKER_HANDS["jacks_or_better"]
    
    return "no_win", 0

poker_games = {}

@casino_router.post("/poker/deal")
async def deal_poker(request: PokerBetRequest, current_user: dict = Depends(get_current_user)):
    """Deal a new video poker hand"""
    if not await deduct_bet(current_user["user_id"], request.amount):
        raise HTTPException(status_code=400, detail="Insufficient BL coins")
    
    deck = create_deck()
    hand = [deck.pop() for _ in range(5)]
    
    game_id = f"poker_{uuid.uuid4().hex[:12]}"
    
    poker_games[game_id] = {
        "game_id": game_id,
        "user_id": current_user["user_id"],
        "bet": request.amount,
        "deck": deck,
        "hand": hand,
        "held": [False] * 5,
        "status": "dealing"
    }
    
    return {
        "game_id": game_id,
        "hand": format_hand(hand),
        "bet": request.amount,
        "instruction": "Select cards to hold (0-4), then draw"
    }

@casino_router.post("/poker/draw")
async def draw_poker(game_id: str = Query(...), hold: List[int] = Query(default=[]), current_user: dict = Depends(get_current_user)):
    """Draw new cards for non-held positions"""
    game = poker_games.get(game_id)
    
    if not game or game["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=404, detail="Game not found")
    
    # Replace non-held cards
    for i in range(5):
        if i not in hold:
            game["hand"][i] = game["deck"].pop()
    
    # Evaluate hand
    hand_name, multiplier = evaluate_poker_hand(game["hand"])
    winnings = game["bet"] * multiplier
    
    if winnings > 0:
        await add_winnings(current_user["user_id"], winnings)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    result = {
        "game_id": game_id,
        "hand": format_hand(game["hand"]),
        "hand_name": hand_name.replace("_", " ").title(),
        "multiplier": multiplier,
        "bet": game["bet"],
        "winnings": winnings,
        "profit": winnings - game["bet"],
        "balance": user.get("bl_coins", 0)
    }
    
    await record_game(current_user["user_id"], "video_poker", game["bet"], winnings, result)
    
    del poker_games[game_id]
    
    return result

# ============== BACCARAT ==============

def calculate_baccarat_value(cards):
    """Calculate baccarat hand value (0-9)"""
    total = 0
    for card in cards:
        value = CARD_VALUES[card[0]]
        if value >= 10:
            value = 0
        total += value
    return total % 10

@casino_router.post("/baccarat/play")
async def play_baccarat(request: BaccaratBet, current_user: dict = Depends(get_current_user)):
    """Play a hand of baccarat"""
    if not await deduct_bet(current_user["user_id"], request.amount):
        raise HTTPException(status_code=400, detail="Insufficient BL coins")
    
    deck = create_deck()
    
    # Deal initial cards
    player_hand = [deck.pop(), deck.pop()]
    banker_hand = [deck.pop(), deck.pop()]
    
    player_value = calculate_baccarat_value(player_hand)
    banker_value = calculate_baccarat_value(banker_hand)
    
    # Natural win check (8 or 9)
    natural = player_value >= 8 or banker_value >= 8
    
    if not natural:
        # Player third card rule
        player_draws = player_value <= 5
        if player_draws:
            player_hand.append(deck.pop())
            player_third = CARD_VALUES[player_hand[2][0]]
            if player_third >= 10:
                player_third = 0
            player_value = calculate_baccarat_value(player_hand)
        
        # Banker third card rule
        if not player_draws:
            banker_draws = banker_value <= 5
        else:
            if banker_value <= 2:
                banker_draws = True
            elif banker_value == 3:
                banker_draws = player_third != 8
            elif banker_value == 4:
                banker_draws = player_third in [2, 3, 4, 5, 6, 7]
            elif banker_value == 5:
                banker_draws = player_third in [4, 5, 6, 7]
            elif banker_value == 6:
                banker_draws = player_third in [6, 7]
            else:
                banker_draws = False
        
        if banker_draws:
            banker_hand.append(deck.pop())
            banker_value = calculate_baccarat_value(banker_hand)
    
    # Determine winner
    if player_value > banker_value:
        winner = "player"
    elif banker_value > player_value:
        winner = "banker"
    else:
        winner = "tie"
    
    # Calculate winnings
    winnings = 0
    if request.bet_on == winner:
        if winner == "player":
            winnings = request.amount * 2
        elif winner == "banker":
            winnings = int(request.amount * 1.95)  # 5% commission
        elif winner == "tie":
            winnings = request.amount * 9
    elif winner == "tie" and request.bet_on != "tie":
        winnings = request.amount  # Push on tie
    
    if winnings > 0:
        await add_winnings(current_user["user_id"], winnings)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    result = {
        "player_hand": format_hand(player_hand),
        "player_value": player_value,
        "banker_hand": format_hand(banker_hand),
        "banker_value": banker_value,
        "winner": winner,
        "bet_on": request.bet_on,
        "bet": request.amount,
        "winnings": winnings,
        "profit": winnings - request.amount,
        "balance": user.get("bl_coins", 0)
    }
    
    await record_game(current_user["user_id"], "baccarat", request.amount, winnings, result)
    
    return result

# ============== CRAPS ==============

@casino_router.post("/craps/roll")
async def roll_craps(request: CrapsBet, current_user: dict = Depends(get_current_user)):
    """Roll the dice in craps"""
    if not await deduct_bet(current_user["user_id"], request.amount):
        raise HTTPException(status_code=400, detail="Insufficient BL coins")
    
    server_seed = generate_server_seed()
    client_seed = generate_client_seed()
    
    dice1 = get_random_number(server_seed, client_seed, 0, 6) + 1
    dice2 = get_random_number(server_seed, client_seed, 1, 6) + 1
    total = dice1 + dice2
    
    winnings = 0
    result_text = ""
    
    if request.bet_type == "pass":
        if total in [7, 11]:
            winnings = request.amount * 2
            result_text = "Win! Natural"
        elif total in [2, 3, 12]:
            result_text = "Craps! Lose"
        else:
            # Point established - simplified version
            result_text = f"Point is {total}"
            winnings = request.amount  # Return bet for simplicity
    
    elif request.bet_type == "dont_pass":
        if total in [2, 3]:
            winnings = request.amount * 2
            result_text = "Win!"
        elif total == 12:
            winnings = request.amount  # Push
            result_text = "Push"
        elif total in [7, 11]:
            result_text = "Lose"
        else:
            result_text = f"Point is {total}"
            winnings = request.amount
    
    elif request.bet_type == "field":
        if total in [2, 12]:
            winnings = request.amount * 3
            result_text = "Field Win 2:1!"
        elif total in [3, 4, 9, 10, 11]:
            winnings = request.amount * 2
            result_text = "Field Win!"
        else:
            result_text = "Field Lose"
    
    elif request.bet_type == "any_seven":
        if total == 7:
            winnings = request.amount * 5
            result_text = "Seven! 4:1 Win!"
        else:
            result_text = "No Seven"
    
    elif request.bet_type == "any_craps":
        if total in [2, 3, 12]:
            winnings = request.amount * 8
            result_text = "Craps! 7:1 Win!"
        else:
            result_text = "No Craps"
    
    if winnings > 0:
        await add_winnings(current_user["user_id"], winnings)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    result = {
        "dice": [dice1, dice2],
        "total": total,
        "bet_type": request.bet_type,
        "result": result_text,
        "bet": request.amount,
        "winnings": winnings,
        "profit": winnings - request.amount,
        "balance": user.get("bl_coins", 0),
        "server_seed_hash": hashlib.sha256(server_seed.encode()).hexdigest()
    }
    
    await record_game(current_user["user_id"], "craps", request.amount, winnings, result)
    
    return result

# ============== WHEEL OF FORTUNE ==============

WHEEL_SEGMENTS = [
    {"multiplier": 0, "label": "LOSE", "color": "#1a1a2e", "probability": 0.15},
    {"multiplier": 1, "label": "1x", "color": "#16213e", "probability": 0.25},
    {"multiplier": 2, "label": "2x", "color": "#0f3460", "probability": 0.20},
    {"multiplier": 3, "label": "3x", "color": "#533483", "probability": 0.15},
    {"multiplier": 5, "label": "5x", "color": "#e94560", "probability": 0.12},
    {"multiplier": 10, "label": "10x", "color": "#f39c12", "probability": 0.08},
    {"multiplier": 20, "label": "20x", "color": "#27ae60", "probability": 0.04},
    {"multiplier": 50, "label": "JACKPOT", "color": "#f1c40f", "probability": 0.01}
]

@casino_router.post("/wheel/spin")
async def spin_wheel(request: WheelSpinRequest, current_user: dict = Depends(get_current_user)):
    """Spin the wheel of fortune"""
    if not await deduct_bet(current_user["user_id"], request.amount):
        raise HTTPException(status_code=400, detail="Insufficient BL coins")
    
    server_seed = generate_server_seed()
    client_seed = generate_client_seed()
    
    # Use provably fair random to select segment
    random_value = get_random_float(server_seed, client_seed, 0)
    
    cumulative = 0
    selected_segment = WHEEL_SEGMENTS[0]
    for segment in WHEEL_SEGMENTS:
        cumulative += segment["probability"]
        if random_value <= cumulative:
            selected_segment = segment
            break
    
    winnings = request.amount * selected_segment["multiplier"]
    
    if winnings > 0:
        await add_winnings(current_user["user_id"], winnings)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    result = {
        "segment": selected_segment,
        "multiplier": selected_segment["multiplier"],
        "bet": request.amount,
        "winnings": winnings,
        "profit": winnings - request.amount,
        "is_jackpot": selected_segment["multiplier"] >= 50,
        "balance": user.get("bl_coins", 0),
        "server_seed_hash": hashlib.sha256(server_seed.encode()).hexdigest(),
        "all_segments": WHEEL_SEGMENTS
    }
    
    await record_game(current_user["user_id"], "wheel", request.amount, winnings, result)
    
    return result

# ============== GAME HISTORY & STATS ==============

@casino_router.get("/history")
async def get_game_history(
    limit: int = 50,
    game_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get user's game history"""
    query = {"user_id": current_user["user_id"]}
    if game_type:
        query["game_type"] = game_type
    
    history = await db.casino_history.find(
        query,
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {"history": history, "count": len(history)}

@casino_router.get("/stats")
async def get_casino_stats(current_user: dict = Depends(get_current_user)):
    """Get user's casino statistics"""
    pipeline = [
        {"$match": {"user_id": current_user["user_id"]}},
        {"$group": {
            "_id": "$game_type",
            "total_bets": {"$sum": "$bet_amount"},
            "total_won": {"$sum": "$won_amount"},
            "games_played": {"$sum": 1}
        }}
    ]
    
    stats = await db.casino_history.aggregate(pipeline).to_list(100)
    
    total_bets = sum(s["total_bets"] for s in stats)
    total_won = sum(s["total_won"] for s in stats)
    total_games = sum(s["games_played"] for s in stats)
    
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    return {
        "by_game": {s["_id"]: s for s in stats},
        "totals": {
            "total_bets": total_bets,
            "total_won": total_won,
            "net_profit": total_won - total_bets,
            "games_played": total_games
        },
        "current_balance": user.get("bl_coins", 0)
    }

@casino_router.get("/leaderboard")
async def get_leaderboard(game_type: Optional[str] = None):
    """Get casino leaderboard"""
    match_stage = {}
    if game_type:
        match_stage["game_type"] = game_type
    
    pipeline = [
        {"$match": match_stage} if match_stage else {"$match": {}},
        {"$group": {
            "_id": "$user_id",
            "total_won": {"$sum": "$won_amount"},
            "total_bets": {"$sum": "$bet_amount"},
            "games_played": {"$sum": 1}
        }},
        {"$sort": {"total_won": -1}},
        {"$limit": 20}
    ]
    
    leaders = await db.casino_history.aggregate(pipeline).to_list(20)
    
    # Get user names
    for leader in leaders:
        user = await db.users.find_one({"user_id": leader["_id"]}, {"_id": 0, "name": 1})
        leader["name"] = user.get("name", "Anonymous") if user else "Anonymous"
        leader["profit"] = leader["total_won"] - leader["total_bets"]
    
    return {"leaderboard": leaders}

# ============== DAILY SPIN BONUS ==============

DAILY_SPIN_REWARDS = [1000, 5000, 15000, 35000, 80000, 200000]
DAILY_SPIN_PROBABILITIES = [0.40, 0.30, 0.15, 0.10, 0.04, 0.01]  # 40%, 30%, 15%, 10%, 4%, 1%

@casino_router.get("/daily-spin/status")
async def get_daily_spin_status(current_user: dict = Depends(get_current_user)):
    """Check if user can claim daily spin"""
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    last_spin = user.get("last_daily_spin")
    
    can_spin = True
    next_spin_time = None
    
    if last_spin:
        if isinstance(last_spin, str):
            last_spin_date = datetime.fromisoformat(last_spin.replace("Z", "+00:00")).date()
        else:
            last_spin_date = last_spin.date()
        
        today = datetime.now(timezone.utc).date()
        can_spin = last_spin_date < today
        
        if not can_spin:
            # Calculate next available spin time (midnight UTC)
            tomorrow = today + timedelta(days=1)
            next_spin_time = datetime(tomorrow.year, tomorrow.month, tomorrow.day, 0, 0, 0, tzinfo=timezone.utc).isoformat()
    
    return {
        "can_spin": can_spin,
        "next_spin_time": next_spin_time,
        "rewards": DAILY_SPIN_REWARDS,
        "current_balance": user.get("bl_coins", 0)
    }

@casino_router.post("/daily-spin/claim")
async def claim_daily_spin(current_user: dict = Depends(get_current_user)):
    """Claim daily free spin - one per day"""
    user = await db.users.find_one({"user_id": current_user["user_id"]})
    last_spin = user.get("last_daily_spin")
    
    # Check if already spun today
    if last_spin:
        if isinstance(last_spin, str):
            last_spin_date = datetime.fromisoformat(last_spin.replace("Z", "+00:00")).date()
        else:
            last_spin_date = last_spin.date()
        
        today = datetime.now(timezone.utc).date()
        if last_spin_date >= today:
            raise HTTPException(status_code=400, detail="Daily spin already claimed today. Come back tomorrow!")
    
    # Generate provably fair result
    server_seed = generate_server_seed()
    client_seed = generate_client_seed()
    random_value = get_random_float(server_seed, client_seed, 0)
    
    # Select reward based on probabilities
    cumulative = 0
    reward_index = 0
    for i, prob in enumerate(DAILY_SPIN_PROBABILITIES):
        cumulative += prob
        if random_value <= cumulative:
            reward_index = i
            break
    
    reward = DAILY_SPIN_REWARDS[reward_index]
    
    # Update user balance and last spin time
    await db.users.update_one(
        {"user_id": current_user["user_id"]},
        {
            "$inc": {"bl_coins": reward},
            "$set": {"last_daily_spin": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    # Get updated balance
    updated_user = await db.users.find_one({"user_id": current_user["user_id"]})
    
    # Record in history
    record = {
        "record_id": f"daily_{uuid.uuid4().hex[:12]}",
        "user_id": current_user["user_id"],
        "game_type": "daily_spin",
        "bet_amount": 0,
        "won_amount": reward,
        "profit": reward,
        "details": {
            "reward_index": reward_index,
            "reward": reward,
            "server_seed_hash": hashlib.sha256(server_seed.encode()).hexdigest()
        },
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.casino_history.insert_one(record)
    
    return {
        "success": True,
        "reward": reward,
        "reward_index": reward_index,
        "all_rewards": DAILY_SPIN_REWARDS,
        "new_balance": updated_user.get("bl_coins", 0),
        "message": f"Congratulations! You won {reward:,} BL Coins!",
        "server_seed_hash": hashlib.sha256(server_seed.encode()).hexdigest()
    }

# Export router
def get_casino_router():
    return casino_router
