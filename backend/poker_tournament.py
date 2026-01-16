"""
Blendlink Poker Tournament System
Texas Hold'em Progressive Knockout (PKO) Tournament
- Modeled after The Venom GTD at ACR Poker
- Real-time WebSocket synchronization
- Virtual BL coins only (no real money)
"""

from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Set
from datetime import datetime, timezone, timedelta
from enum import Enum
import uuid
import secrets
import asyncio
import json
from collections import defaultdict

# Import from main server
from server import get_current_user, db, logger

# Create router
poker_router = APIRouter(prefix="/poker", tags=["Poker Tournament"])

# ============== CONSTANTS ==============

BUY_IN = 2000  # BL coins per player
BOUNTY_AMOUNT = 1000  # Platform-funded bounty per player
STARTING_CHIPS = 2000  # Starting stack
MIN_PLAYERS = 2  # Minimum players to start (testing mode - normally 10)
MAX_PLAYERS = 10  # Maximum players per table
ACTION_TIMEOUT = 30  # Seconds per action
DISCONNECT_TIMEOUT = 60  # Seconds before auto-fold on disconnect
REBUY_MINUTES = 60  # Minutes for rebuy phase
REBUY_BLIND_LEVEL = 5  # Rebuy until this blind level

# AI Bot personalities
AI_BOT_NAMES = [
    "DeepStack", "PokerMind", "CardShark", "BluffMaster", "ChipKing",
    "AceHunter", "RiverRat", "NittyGritty", "LAGgy", "TightTerry"
]
AI_BOT_PERSONALITIES = ["tight-aggressive", "loose-aggressive", "tight-passive", "loose-passive", "balanced"]
AI_BOT_SKILL_LEVELS = ["medium", "hard", "expert"]

# Blind levels (duration in minutes)
BLIND_LEVELS = [
    {"small": 25, "big": 50, "ante": 0, "duration": 20},
    {"small": 50, "big": 100, "ante": 0, "duration": 20},
    {"small": 75, "big": 150, "ante": 0, "duration": 20},
    {"small": 100, "big": 200, "ante": 25, "duration": 20},
    {"small": 150, "big": 300, "ante": 25, "duration": 20},
    {"small": 200, "big": 400, "ante": 50, "duration": 20},
    {"small": 300, "big": 600, "ante": 75, "duration": 20},
    {"small": 400, "big": 800, "ante": 100, "duration": 15},
    {"small": 500, "big": 1000, "ante": 100, "duration": 15},
    {"small": 600, "big": 1200, "ante": 150, "duration": 15},
    {"small": 800, "big": 1600, "ante": 200, "duration": 10},
    {"small": 1000, "big": 2000, "ante": 250, "duration": 10},
]

# Card constants
SUITS = ['hearts', 'diamonds', 'clubs', 'spades']
SUIT_SYMBOLS = {'hearts': '♥', 'diamonds': '♦', 'clubs': '♣', 'spades': '♠'}
RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
RANK_VALUES = {r: i for i, r in enumerate(RANKS)}

# Hand rankings
HAND_RANKINGS = {
    "royal_flush": 10,
    "straight_flush": 9,
    "four_of_a_kind": 8,
    "full_house": 7,
    "flush": 6,
    "straight": 5,
    "three_of_a_kind": 4,
    "two_pair": 3,
    "one_pair": 2,
    "high_card": 1,
}

# ============== ENUMS ==============

class GamePhase(str, Enum):
    WAITING = "waiting"
    PRE_FLOP = "pre_flop"
    FLOP = "flop"
    TURN = "turn"
    RIVER = "river"
    SHOWDOWN = "showdown"
    HAND_COMPLETE = "hand_complete"

class PlayerAction(str, Enum):
    FOLD = "fold"
    CHECK = "check"
    CALL = "call"
    BET = "bet"
    RAISE = "raise"
    ALL_IN = "all_in"

class TournamentStatus(str, Enum):
    REGISTERING = "registering"
    STARTING = "starting"
    IN_PROGRESS = "in_progress"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

# ============== MODELS ==============

class Card:
    def __init__(self, rank: str, suit: str):
        self.rank = rank
        self.suit = suit
        self.value = RANK_VALUES[rank]
    
    def to_dict(self):
        return {"rank": self.rank, "suit": self.suit, "symbol": f"{self.rank}{SUIT_SYMBOLS[self.suit]}"}
    
    def __repr__(self):
        return f"{self.rank}{SUIT_SYMBOLS[self.suit]}"

class Deck:
    def __init__(self):
        self.cards = []
        self.reset()
    
    def reset(self):
        """Create and shuffle a new deck using crypto-secure random"""
        self.cards = [Card(rank, suit) for suit in SUITS for rank in RANKS]
        # Use secrets for cryptographically secure shuffle
        for i in range(len(self.cards) - 1, 0, -1):
            j = secrets.randbelow(i + 1)
            self.cards[i], self.cards[j] = self.cards[j], self.cards[i]
    
    def deal(self, count: int = 1) -> List[Card]:
        """Deal cards from the deck"""
        dealt = self.cards[:count]
        self.cards = self.cards[count:]
        return dealt

class TournamentRegistration(BaseModel):
    tournament_id: str

class PlayerActionRequest(BaseModel):
    tournament_id: str
    action: str
    amount: Optional[int] = 0

class CreateTournamentRequest(BaseModel):
    name: Optional[str] = "PKO Tournament"
    
class RebuyRequest(BaseModel):
    tournament_id: str

# ============== HAND EVALUATION ==============

def evaluate_hand(cards: List[Card]) -> tuple:
    """
    Evaluate best 5-card hand from 7 cards (2 hole + 5 community)
    Returns: (hand_rank, hand_name, tiebreaker_values, best_5_cards)
    """
    if len(cards) < 5:
        return (0, "incomplete", [], cards)
    
    from itertools import combinations
    
    best_hand = None
    best_rank = 0
    best_tiebreaker = []
    best_cards = []
    
    # Try all combinations of 5 cards from 7
    for combo in combinations(cards, 5):
        rank, name, tiebreaker = evaluate_five_cards(list(combo))
        if rank > best_rank or (rank == best_rank and tiebreaker > best_tiebreaker):
            best_rank = rank
            best_hand = name
            best_tiebreaker = tiebreaker
            best_cards = list(combo)
    
    return (best_rank, best_hand, best_tiebreaker, best_cards)

def evaluate_five_cards(cards: List[Card]) -> tuple:
    """Evaluate exactly 5 cards"""
    ranks = sorted([c.value for c in cards], reverse=True)
    suits = [c.suit for c in cards]
    
    # Check flush
    is_flush = len(set(suits)) == 1
    
    # Check straight
    is_straight = False
    straight_high = 0
    
    # Normal straight check
    unique_ranks = sorted(set(ranks), reverse=True)
    if len(unique_ranks) >= 5:
        for i in range(len(unique_ranks) - 4):
            if unique_ranks[i] - unique_ranks[i + 4] == 4:
                is_straight = True
                straight_high = unique_ranks[i]
                break
    
    # Ace-low straight (A,2,3,4,5)
    if not is_straight and set([12, 0, 1, 2, 3]).issubset(set(ranks)):
        is_straight = True
        straight_high = 3  # 5-high straight
    
    # Count ranks
    rank_counts = defaultdict(int)
    for r in ranks:
        rank_counts[r] += 1
    
    counts = sorted(rank_counts.values(), reverse=True)
    unique_by_count = sorted(rank_counts.items(), key=lambda x: (x[1], x[0]), reverse=True)
    
    # Determine hand type
    if is_straight and is_flush:
        if straight_high == 12 and min(ranks) == 8:  # Royal flush (10-A)
            return (HAND_RANKINGS["royal_flush"], "Royal Flush", [12])
        return (HAND_RANKINGS["straight_flush"], "Straight Flush", [straight_high])
    
    if counts == [4, 1]:
        quad_rank = unique_by_count[0][0]
        kicker = unique_by_count[1][0]
        return (HAND_RANKINGS["four_of_a_kind"], "Four of a Kind", [quad_rank, kicker])
    
    if counts == [3, 2]:
        trips_rank = unique_by_count[0][0]
        pair_rank = unique_by_count[1][0]
        return (HAND_RANKINGS["full_house"], "Full House", [trips_rank, pair_rank])
    
    if is_flush:
        return (HAND_RANKINGS["flush"], "Flush", ranks)
    
    if is_straight:
        return (HAND_RANKINGS["straight"], "Straight", [straight_high])
    
    if counts == [3, 1, 1]:
        trips_rank = unique_by_count[0][0]
        kickers = sorted([r for r, c in unique_by_count if c == 1], reverse=True)
        return (HAND_RANKINGS["three_of_a_kind"], "Three of a Kind", [trips_rank] + kickers)
    
    if counts == [2, 2, 1]:
        pairs = sorted([r for r, c in unique_by_count if c == 2], reverse=True)
        kicker = [r for r, c in unique_by_count if c == 1][0]
        return (HAND_RANKINGS["two_pair"], "Two Pair", pairs + [kicker])
    
    if counts == [2, 1, 1, 1]:
        pair_rank = unique_by_count[0][0]
        kickers = sorted([r for r, c in unique_by_count if c == 1], reverse=True)
        return (HAND_RANKINGS["one_pair"], "One Pair", [pair_rank] + kickers)
    
    return (HAND_RANKINGS["high_card"], "High Card", ranks)

# ============== PLAYER STATE ==============

class PokerPlayer:
    def __init__(self, user_id: str, username: str, avatar: str, seat: int, is_bot: bool = False):
        self.user_id = user_id
        self.username = username
        self.avatar = avatar
        self.seat = seat
        self.chips = STARTING_CHIPS
        self.hole_cards: List[Card] = []
        self.bounty = BOUNTY_AMOUNT
        self.bounties_won = 0
        self.total_bounty_bl = 0  # Total BL coins from bounties
        self.is_active = True
        self.is_folded = False
        self.is_all_in = False
        self.current_bet = 0
        self.total_invested = 0
        self.has_acted = False
        self.is_connected = True
        self.last_action = None
        self.last_action_time = None
        self.elimination_position = None
        self.rebuys = 0
        # AI Bot properties
        self.is_bot = is_bot
        self.bot_personality = None
        self.bot_skill = None
    
    def to_dict(self, show_cards: bool = False, viewer_id: str = None):
        """Convert player to dict, optionally hiding cards"""
        cards = []
        if show_cards or (viewer_id and viewer_id == self.user_id):
            cards = [c.to_dict() for c in self.hole_cards]
        elif self.hole_cards:
            cards = [{"rank": "?", "suit": "?", "symbol": "🂠"} for _ in self.hole_cards]
        
        return {
            "user_id": self.user_id,
            "username": self.username,
            "avatar": self.avatar,
            "seat": self.seat,
            "chips": self.chips,
            "cards": cards,
            "bounty": self.bounty,
            "bounties_won": self.bounties_won,
            "total_bounty_bl": self.total_bounty_bl,
            "is_active": self.is_active,
            "is_folded": self.is_folded,
            "is_all_in": self.is_all_in,
            "current_bet": self.current_bet,
            "has_acted": self.has_acted,
            "is_connected": self.is_connected,
            "last_action": self.last_action,
            "elimination_position": self.elimination_position,
            "is_bot": self.is_bot,
        }
    
    def reset_for_hand(self):
        """Reset player state for a new hand"""
        self.hole_cards = []
        self.is_folded = False
        self.is_all_in = False
        self.current_bet = 0
        self.total_invested = 0
        self.has_acted = False
        self.last_action = None

# ============== AI BOT ENGINE ==============

class AIBotEngine:
    """AI Bot decision-making engine with human-like behaviors"""
    
    @staticmethod
    def calculate_hand_strength(hole_cards: List[Card], community_cards: List[Card]) -> float:
        """Calculate relative hand strength (0-1)"""
        all_cards = hole_cards + community_cards
        
        if len(community_cards) == 0:
            # Pre-flop strength based on hole cards
            return AIBotEngine.preflop_strength(hole_cards)
        else:
            # Post-flop strength
            rank, hand_name, tiebreaker, best = evaluate_hand(all_cards)
            # Normalize hand rank to 0-1
            return (rank / 10) + (sum(tiebreaker[:2]) / 100 if tiebreaker else 0)
    
    @staticmethod
    def preflop_strength(hole_cards: List[Card]) -> float:
        """Calculate pre-flop hand strength"""
        if len(hole_cards) != 2:
            return 0.3
        
        c1, c2 = hole_cards
        r1, r2 = c1.value, c2.value
        
        # Pairs
        if r1 == r2:
            return 0.5 + (r1 / 26)  # 0.5 to 0.96 for pairs
        
        # High cards
        high = max(r1, r2)
        low = min(r1, r2)
        suited = c1.suit == c2.suit
        
        base = (high + low) / 26  # 0 to 1 based on card values
        
        # Suited bonus
        if suited:
            base += 0.05
        
        # Connected bonus
        gap = high - low
        if gap == 1:
            base += 0.05
        elif gap == 2:
            base += 0.03
        
        # Premium hands
        if high == 12:  # Ace
            if low >= 9:  # AK, AQ, AJ, AT
                base += 0.15
        
        return min(base, 0.95)
    
    @staticmethod
    def decide_action(
        player: 'PokerPlayer',
        tournament: 'PokerTournament',
        personality: str = "balanced",
        skill: str = "medium"
    ) -> tuple:
        """Decide bot action based on hand strength, personality, and game state"""
        
        hand_strength = AIBotEngine.calculate_hand_strength(
            player.hole_cards, 
            tournament.community_cards
        )
        
        pot_odds = AIBotEngine.calculate_pot_odds(
            tournament.current_bet - player.current_bet,
            tournament.pot
        )
        
        # Personality adjustments
        aggression = {
            "tight-aggressive": 0.6,
            "loose-aggressive": 0.8,
            "tight-passive": 0.3,
            "loose-passive": 0.5,
            "balanced": 0.5
        }.get(personality, 0.5)
        
        looseness = {
            "tight-aggressive": 0.3,
            "loose-aggressive": 0.7,
            "tight-passive": 0.3,
            "loose-passive": 0.7,
            "balanced": 0.5
        }.get(personality, 0.5)
        
        # Skill-based randomness (lower skill = more variance)
        skill_factor = {"medium": 0.3, "hard": 0.15, "expert": 0.05}.get(skill, 0.2)
        
        # Add human-like randomness
        import random
        rand = random.random() * skill_factor
        effective_strength = hand_strength + (rand - skill_factor/2)
        
        to_call = tournament.current_bet - player.current_bet
        
        # Decision logic
        if to_call == 0:
            # Can check
            if effective_strength > 0.6 + (1 - aggression) * 0.2:
                # Bet with strong hands
                bet_size = int(tournament.pot * (0.5 + effective_strength * 0.5))
                bet_size = min(bet_size, player.chips)
                bet_size = max(bet_size, tournament.big_blind)
                return ("bet", bet_size)
            else:
                return ("check", 0)
        else:
            # Must call, raise, or fold
            call_threshold = looseness * 0.5 + pot_odds
            
            if effective_strength < call_threshold - 0.2:
                return ("fold", 0)
            elif effective_strength > 0.7 and random.random() < aggression:
                # Raise with strong hands
                raise_amount = to_call + int(tournament.pot * (0.5 + effective_strength * 0.5))
                raise_amount = min(raise_amount, player.chips + player.current_bet)
                return ("raise", raise_amount)
            elif effective_strength >= call_threshold - 0.2:
                return ("call", 0)
            else:
                return ("fold", 0)
    
    @staticmethod
    def calculate_pot_odds(to_call: int, pot: int) -> float:
        """Calculate pot odds (0-1)"""
        if to_call <= 0:
            return 1.0
        return pot / (pot + to_call)
    
    @staticmethod
    async def think_delay():
        """Add human-like thinking delay"""
        import random
        delay = random.uniform(1.5, 4.0)
        await asyncio.sleep(delay)

# ============== TOURNAMENT STATE ==============

class PokerTournament:
    def __init__(self, tournament_id: str, name: str = "PKO Tournament", creator_id: str = None):
        self.tournament_id = tournament_id
        self.name = name
        self.creator_id = creator_id  # First player who created the table
        self.status = TournamentStatus.REGISTERING
        self.created_at = datetime.now(timezone.utc)
        self.started_at = None
        self.ended_at = None
        
        # Players
        self.players: Dict[str, PokerPlayer] = {}
        self.eliminated_players: List[str] = []
        self.seat_order: List[int] = list(range(MAX_PLAYERS))
        secrets.SystemRandom().shuffle(self.seat_order)
        
        # AI Bots
        self.bot_count = 0
        self.used_bot_names: Set[str] = set()
        
        # Blinds
        self.blind_level = 0
        self.blind_timer_start = None
        self.small_blind = BLIND_LEVELS[0]["small"]
        self.big_blind = BLIND_LEVELS[0]["big"]
        self.ante = BLIND_LEVELS[0]["ante"]
        
        # Hand state
        self.hand_number = 0
        self.phase = GamePhase.WAITING
        self.deck = Deck()
        self.community_cards: List[Card] = []
        self.pot = 0
        self.side_pots: List[Dict] = []
        
        # Position tracking
        self.dealer_seat = 0
        self.small_blind_seat = 0
        self.big_blind_seat = 0
        self.current_player_seat = 0
        self.last_raiser_seat = None
        
        # Betting state
        self.current_bet = 0
        self.min_raise = 0
        self.action_timer_task = None
        self.rebuy_phase = True  # Allow rebuys in early levels
        self.rebuy_end_time = None  # Set when tournament starts
        
        # Prize pool
        self.total_buy_ins = 0
        self.total_bounties = 0
        
        # Chat messages
        self.chat_messages: List[Dict] = []
        
        # WebSocket connections
        self.connections: Dict[str, WebSocket] = {}
        self.spectator_connections: Dict[str, WebSocket] = {}
    
    def get_available_seat(self) -> Optional[int]:
        """Get next available seat"""
        used_seats = {p.seat for p in self.players.values()}
        for seat in self.seat_order:
            if seat not in used_seats:
                return seat
        return None
    
    def get_active_players(self) -> List[PokerPlayer]:
        """Get players still in the tournament (not eliminated)"""
        return [p for p in self.players.values() if p.is_active]
    
    def get_players_in_hand(self) -> List[PokerPlayer]:
        """Get players still active in current hand"""
        return [p for p in self.players.values() if p.is_active and not p.is_folded]
    
    def get_player_by_seat(self, seat: int) -> Optional[PokerPlayer]:
        """Get player at a specific seat"""
        for p in self.players.values():
            if p.seat == seat and p.is_active:
                return p
        return None
    
    def get_next_active_seat(self, current_seat: int, include_all_in: bool = True) -> Optional[int]:
        """Get next active player's seat clockwise"""
        active_players = self.get_players_in_hand()
        if not include_all_in:
            active_players = [p for p in active_players if not p.is_all_in]
        
        if not active_players:
            return None
        
        seats = sorted([p.seat for p in active_players])
        for seat in seats:
            if seat > current_seat:
                return seat
        return seats[0] if seats else None
    
    def advance_positions(self):
        """Move dealer button and blinds for new hand"""
        active_players = self.get_active_players()
        if len(active_players) < 2:
            return
        
        seats = sorted([p.seat for p in active_players])
        
        # Find next dealer
        current_idx = 0
        for i, seat in enumerate(seats):
            if seat >= self.dealer_seat:
                current_idx = i
                break
        
        next_idx = (current_idx + 1) % len(seats)
        self.dealer_seat = seats[next_idx]
        
        # Set blinds (heads-up special case)
        if len(active_players) == 2:
            self.small_blind_seat = self.dealer_seat
            self.big_blind_seat = seats[(next_idx + 1) % len(seats)]
        else:
            self.small_blind_seat = seats[(next_idx + 1) % len(seats)]
            self.big_blind_seat = seats[(next_idx + 2) % len(seats)]
    
    def calculate_side_pots(self):
        """Calculate side pots when players are all-in"""
        players_in = self.get_players_in_hand()
        if not players_in:
            return
        
        # Get all unique bet levels
        bet_levels = sorted(set(p.total_invested for p in players_in if p.total_invested > 0))
        
        self.side_pots = []
        previous_level = 0
        
        for level in bet_levels:
            eligible = [p for p in players_in if p.total_invested >= level]
            pot_amount = (level - previous_level) * len([p for p in self.players.values() if p.total_invested >= level])
            
            if pot_amount > 0:
                self.side_pots.append({
                    "amount": pot_amount,
                    "eligible": [p.user_id for p in eligible],
                    "level": level
                })
            
            previous_level = level
    
    def can_rebuy(self) -> bool:
        """Check if rebuys are still available"""
        if not self.rebuy_phase:
            return False
        if self.blind_level >= REBUY_BLIND_LEVEL:
            return False
        if self.rebuy_end_time and datetime.now(timezone.utc) > self.rebuy_end_time:
            return False
        return True
    
    def to_dict(self, viewer_id: str = None) -> Dict:
        """Convert tournament state to dict"""
        show_cards = self.phase == GamePhase.SHOWDOWN or self.phase == GamePhase.HAND_COMPLETE
        
        return {
            "tournament_id": self.tournament_id,
            "name": self.name,
            "status": self.status,
            "creator_id": self.creator_id,
            "created_at": self.created_at.isoformat(),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            
            "players": {uid: p.to_dict(show_cards, viewer_id) for uid, p in self.players.items()},
            "player_count": len(self.players),
            "human_player_count": len([p for p in self.players.values() if not p.is_bot]),
            "bot_count": len([p for p in self.players.values() if p.is_bot]),
            "active_player_count": len(self.get_active_players()),
            "eliminated_count": len(self.eliminated_players),
            "max_players": MAX_PLAYERS,
            
            "blind_level": self.blind_level,
            "small_blind": self.small_blind,
            "big_blind": self.big_blind,
            "ante": self.ante,
            "next_blind_increase": self.get_next_blind_time(),
            
            "hand_number": self.hand_number,
            "phase": self.phase,
            "community_cards": [c.to_dict() for c in self.community_cards],
            "pot": self.pot,
            "side_pots": self.side_pots,
            
            "dealer_seat": self.dealer_seat,
            "small_blind_seat": self.small_blind_seat,
            "big_blind_seat": self.big_blind_seat,
            "current_player_seat": self.current_player_seat,
            
            "current_bet": self.current_bet,
            "min_raise": self.min_raise,
            
            "total_prize_pool": self.total_buy_ins,
            "total_bounties": self.total_bounties,
            
            "rebuy_available": self.can_rebuy(),
            "rebuy_phase": self.rebuy_phase,
            
            "chat_messages": self.chat_messages[-50:],  # Last 50 messages
        }
    
    def get_next_blind_time(self) -> Optional[str]:
        """Get time until next blind increase"""
        if not self.blind_timer_start or self.blind_level >= len(BLIND_LEVELS) - 1:
            return None
        
        duration = BLIND_LEVELS[self.blind_level]["duration"] * 60  # Convert to seconds
        elapsed = (datetime.now(timezone.utc) - self.blind_timer_start).total_seconds()
        remaining = max(0, duration - elapsed)
        
        mins = int(remaining // 60)
        secs = int(remaining % 60)
        return f"{mins:02d}:{secs:02d}"

# ============== TOURNAMENT MANAGER ==============

class TournamentManager:
    def __init__(self):
        self.tournaments: Dict[str, PokerTournament] = {}
        self.player_tournament_map: Dict[str, str] = {}  # user_id -> tournament_id
    
    def create_tournament(self, name: str = "PKO Tournament", creator_id: str = None) -> PokerTournament:
        """Create a new tournament"""
        tournament_id = f"pko_{uuid.uuid4().hex[:12]}"
        tournament = PokerTournament(tournament_id, name, creator_id)
        self.tournaments[tournament_id] = tournament
        return tournament
    
    def get_tournament(self, tournament_id: str) -> Optional[PokerTournament]:
        """Get tournament by ID"""
        return self.tournaments.get(tournament_id)
    
    def get_player_tournament(self, user_id: str) -> Optional[PokerTournament]:
        """Get tournament a player is currently in"""
        tournament_id = self.player_tournament_map.get(user_id)
        if tournament_id:
            return self.tournaments.get(tournament_id)
        return None
    
    def get_open_tournaments(self) -> List[PokerTournament]:
        """Get tournaments accepting registrations"""
        return [t for t in self.tournaments.values() if t.status == TournamentStatus.REGISTERING]
    
    async def add_ai_bots(self, tournament: PokerTournament, bot_count: int) -> List[PokerPlayer]:
        """Add AI bots to fill remaining seats"""
        if tournament.status != TournamentStatus.REGISTERING:
            raise HTTPException(status_code=400, detail="Cannot add bots after tournament starts")
        
        available_seats = MAX_PLAYERS - len(tournament.players)
        bot_count = min(bot_count, available_seats, 9)  # Max 9 bots
        
        bots_added = []
        
        for i in range(bot_count):
            # Get unique bot name
            available_names = [n for n in AI_BOT_NAMES if n not in tournament.used_bot_names]
            if not available_names:
                available_names = [f"Bot_{i+1}"]
            
            bot_name = secrets.choice(available_names)
            tournament.used_bot_names.add(bot_name)
            
            bot_id = f"bot_{uuid.uuid4().hex[:8]}"
            seat = tournament.get_available_seat()
            
            if seat is None:
                break
            
            # Create bot player
            bot = PokerPlayer(bot_id, bot_name, "", seat, is_bot=True)
            bot.bot_personality = secrets.choice(AI_BOT_PERSONALITIES)
            bot.bot_skill = secrets.choice(AI_BOT_SKILL_LEVELS)
            bot.is_connected = True  # Bots are always connected
            
            tournament.players[bot_id] = bot
            tournament.total_buy_ins += BUY_IN
            tournament.total_bounties += BOUNTY_AMOUNT
            tournament.bot_count += 1
            
            bots_added.append(bot)
        
        return bots_added
    
    async def register_player(self, tournament: PokerTournament, user_id: str, username: str, avatar: str) -> PokerPlayer:
        """Register a player in a tournament"""
        if user_id in tournament.players:
            raise HTTPException(status_code=400, detail="Already registered")
        
        if len(tournament.players) >= MAX_PLAYERS:
            raise HTTPException(status_code=400, detail="Tournament is full")
        
        if tournament.status != TournamentStatus.REGISTERING:
            raise HTTPException(status_code=400, detail="Tournament not accepting registrations")
        
        # Get available seat
        seat = tournament.get_available_seat()
        if seat is None:
            raise HTTPException(status_code=400, detail="No seats available")
        
        # Create player
        player = PokerPlayer(user_id, username, avatar, seat, is_bot=False)
        tournament.players[user_id] = player
        self.player_tournament_map[user_id] = tournament.tournament_id
        
        # Set creator if first player
        if tournament.creator_id is None:
            tournament.creator_id = user_id
        
        # Update prize pool
        tournament.total_buy_ins += BUY_IN
        tournament.total_bounties += BOUNTY_AMOUNT
        
        # Check if tournament should start
        if len(tournament.players) >= MIN_PLAYERS:
            # Start after a short delay to allow more players
            asyncio.create_task(self.auto_start_countdown(tournament))
        
        return player
    
    async def auto_start_countdown(self, tournament: PokerTournament):
        """Start tournament after countdown if minimum players reached"""
        if tournament.status != TournamentStatus.REGISTERING:
            return
        
        # Wait 30 seconds for more players
        await asyncio.sleep(30)
        
        if tournament.status == TournamentStatus.REGISTERING and len(tournament.players) >= MIN_PLAYERS:
            await self.start_tournament(tournament)
    
    async def start_tournament(self, tournament: PokerTournament):
        """Start the tournament"""
        if len(tournament.players) < MIN_PLAYERS:
            raise HTTPException(status_code=400, detail=f"Need at least {MIN_PLAYERS} players")
        
        tournament.status = TournamentStatus.IN_PROGRESS
        tournament.started_at = datetime.now(timezone.utc)
        tournament.blind_timer_start = datetime.now(timezone.utc)
        tournament.rebuy_end_time = datetime.now(timezone.utc) + timedelta(minutes=REBUY_MINUTES)
        
        # Assign random dealer button
        active_seats = [p.seat for p in tournament.players.values()]
        tournament.dealer_seat = secrets.choice(active_seats)
        
        # Broadcast start
        await self.broadcast_to_tournament(tournament, {
            "type": "tournament_started",
            "data": tournament.to_dict()
        })
        
        # Start first hand
        await self.start_new_hand(tournament)
    
    async def start_new_hand(self, tournament: PokerTournament):
        """Start a new hand"""
        active_players = tournament.get_active_players()
        
        # Check for winner
        if len(active_players) == 1:
            await self.end_tournament(tournament)
            return
        
        if len(active_players) == 0:
            return
        
        # Increment hand number
        tournament.hand_number += 1
        
        # Reset deck and community cards
        tournament.deck.reset()
        tournament.community_cards = []
        tournament.pot = 0
        tournament.side_pots = []
        tournament.current_bet = 0
        tournament.last_raiser_seat = None
        
        # Reset player states
        for player in active_players:
            player.reset_for_hand()
        
        # Advance button
        tournament.advance_positions()
        
        # Check blind level
        await self.check_blind_level(tournament)
        
        # Collect antes if applicable
        if tournament.ante > 0:
            for player in active_players:
                ante_amount = min(tournament.ante, player.chips)
                player.chips -= ante_amount
                player.current_bet += ante_amount
                player.total_invested += ante_amount
                tournament.pot += ante_amount
        
        # Post blinds
        sb_player = tournament.get_player_by_seat(tournament.small_blind_seat)
        bb_player = tournament.get_player_by_seat(tournament.big_blind_seat)
        
        if sb_player:
            sb_amount = min(tournament.small_blind, sb_player.chips)
            sb_player.chips -= sb_amount
            sb_player.current_bet = sb_amount
            sb_player.total_invested = sb_amount
            tournament.pot += sb_amount
            if sb_player.chips == 0:
                sb_player.is_all_in = True
        
        if bb_player:
            bb_amount = min(tournament.big_blind, bb_player.chips)
            bb_player.chips -= bb_amount
            bb_player.current_bet = bb_amount
            bb_player.total_invested = bb_amount
            tournament.pot += bb_amount
            tournament.current_bet = bb_amount
            if bb_player.chips == 0:
                bb_player.is_all_in = True
        
        tournament.min_raise = tournament.big_blind
        
        # Deal hole cards
        for player in active_players:
            player.hole_cards = tournament.deck.deal(2)
        
        # Set phase and determine first actor
        tournament.phase = GamePhase.PRE_FLOP
        
        # First to act is UTG (left of big blind)
        tournament.current_player_seat = tournament.get_next_active_seat(tournament.big_blind_seat, include_all_in=False)
        
        # If everyone is all-in, run out the board
        if tournament.current_player_seat is None:
            await self.run_out_board(tournament)
            return
        
        # Broadcast hand start
        await self.broadcast_game_state(tournament)
        
        # Check if first player is a bot
        first_player = tournament.get_player_by_seat(tournament.current_player_seat)
        if first_player and first_player.is_bot:
            # Bot plays first - handle bot turn
            await self.handle_bot_turn(tournament, first_player)
        else:
            # Human player - start action timer
            await self.start_action_timer(tournament)
    
    async def check_blind_level(self, tournament: PokerTournament):
        """Check and update blind level if needed"""
        if not tournament.blind_timer_start:
            return
        
        current_level = tournament.blind_level
        duration = BLIND_LEVELS[current_level]["duration"] * 60
        elapsed = (datetime.now(timezone.utc) - tournament.blind_timer_start).total_seconds()
        
        if elapsed >= duration and current_level < len(BLIND_LEVELS) - 1:
            tournament.blind_level += 1
            new_level = BLIND_LEVELS[tournament.blind_level]
            tournament.small_blind = new_level["small"]
            tournament.big_blind = new_level["big"]
            tournament.ante = new_level["ante"]
            tournament.blind_timer_start = datetime.now(timezone.utc)
            
            # Disable rebuys after level 3
            if tournament.blind_level >= 3:
                tournament.rebuy_phase = False
            
            await self.broadcast_to_tournament(tournament, {
                "type": "blind_increase",
                "data": {
                    "level": tournament.blind_level,
                    "small_blind": tournament.small_blind,
                    "big_blind": tournament.big_blind,
                    "ante": tournament.ante,
                }
            })
    
    async def process_action(self, tournament: PokerTournament, user_id: str, action: str, amount: int = 0):
        """Process a player action"""
        player = tournament.players.get(user_id)
        if not player:
            raise HTTPException(status_code=400, detail="Player not in tournament")
        
        if player.seat != tournament.current_player_seat:
            raise HTTPException(status_code=400, detail="Not your turn")
        
        if player.is_folded or player.is_all_in:
            raise HTTPException(status_code=400, detail="Cannot act")
        
        # Cancel action timer
        if tournament.action_timer_task:
            tournament.action_timer_task.cancel()
        
        # Process action
        action = action.lower()
        
        if action == PlayerAction.FOLD:
            player.is_folded = True
            player.last_action = "fold"
        
        elif action == PlayerAction.CHECK:
            if tournament.current_bet > player.current_bet:
                raise HTTPException(status_code=400, detail="Cannot check, must call or raise")
            player.last_action = "check"
        
        elif action == PlayerAction.CALL:
            call_amount = tournament.current_bet - player.current_bet
            if call_amount <= 0:
                raise HTTPException(status_code=400, detail="Nothing to call")
            
            actual_call = min(call_amount, player.chips)
            player.chips -= actual_call
            player.current_bet += actual_call
            player.total_invested += actual_call
            tournament.pot += actual_call
            
            if player.chips == 0:
                player.is_all_in = True
                player.last_action = "all_in"
            else:
                player.last_action = f"call {actual_call}"
        
        elif action == PlayerAction.BET or action == PlayerAction.RAISE:
            if action == PlayerAction.BET and tournament.current_bet > 0:
                action = PlayerAction.RAISE
            
            min_bet = tournament.current_bet + tournament.min_raise
            
            if amount < min_bet and amount < player.chips:
                raise HTTPException(status_code=400, detail=f"Minimum bet/raise is {min_bet}")
            
            # Calculate total to put in
            to_call = tournament.current_bet - player.current_bet
            raise_amount = amount - tournament.current_bet if action == PlayerAction.RAISE else amount
            total_needed = to_call + raise_amount
            
            actual_bet = min(total_needed, player.chips)
            player.chips -= actual_bet
            
            new_bet = player.current_bet + actual_bet
            raise_size = new_bet - tournament.current_bet
            
            if raise_size > tournament.min_raise:
                tournament.min_raise = raise_size
            
            tournament.current_bet = new_bet
            player.current_bet = new_bet
            player.total_invested += actual_bet
            tournament.pot += actual_bet
            tournament.last_raiser_seat = player.seat
            
            if player.chips == 0:
                player.is_all_in = True
                player.last_action = f"all_in ({new_bet})"
            else:
                player.last_action = f"{'raise' if action == PlayerAction.RAISE else 'bet'} {new_bet}"
        
        elif action == PlayerAction.ALL_IN:
            all_in_amount = player.chips
            player.chips = 0
            player.current_bet += all_in_amount
            player.total_invested += all_in_amount
            tournament.pot += all_in_amount
            player.is_all_in = True
            
            if player.current_bet > tournament.current_bet:
                raise_size = player.current_bet - tournament.current_bet
                if raise_size >= tournament.min_raise:
                    tournament.min_raise = raise_size
                tournament.current_bet = player.current_bet
                tournament.last_raiser_seat = player.seat
            
            player.last_action = f"all_in ({player.current_bet})"
        
        else:
            raise HTTPException(status_code=400, detail=f"Invalid action: {action}")
        
        player.has_acted = True
        player.last_action_time = datetime.now(timezone.utc)
        
        # Check if betting round is complete
        await self.check_betting_round(tournament)
    
    async def check_betting_round(self, tournament: PokerTournament):
        """Check if betting round is complete"""
        players_in_hand = tournament.get_players_in_hand()
        
        # Only one player left
        if len(players_in_hand) == 1:
            await self.award_pot_to_winner(tournament, players_in_hand[0])
            return
        
        # Check if all players have acted and bets are matched
        players_can_act = [p for p in players_in_hand if not p.is_all_in]
        
        all_acted = all(p.has_acted for p in players_can_act)
        all_matched = all(p.current_bet == tournament.current_bet or p.is_all_in for p in players_in_hand)
        
        if all_acted and all_matched:
            # Move to next phase
            await self.advance_phase(tournament)
        else:
            # Move to next player
            tournament.current_player_seat = tournament.get_next_active_seat(
                tournament.current_player_seat, 
                include_all_in=False
            )
            
            if tournament.current_player_seat is None:
                # All remaining players are all-in
                await self.run_out_board(tournament)
            else:
                await self.broadcast_game_state(tournament)
                # Check if current player is a bot
                current_player = tournament.get_player_by_seat(tournament.current_player_seat)
                if current_player and current_player.is_bot:
                    await self.handle_bot_turn(tournament, current_player)
                else:
                    await self.start_action_timer(tournament)
    
    async def handle_bot_turn(self, tournament: PokerTournament, bot: PokerPlayer):
        """Handle AI bot's turn with human-like thinking delay"""
        # Add thinking delay
        await AIBotEngine.think_delay()
        
        # Get bot's decision
        action, amount = AIBotEngine.decide_action(
            bot, 
            tournament,
            bot.bot_personality or "balanced",
            bot.bot_skill or "medium"
        )
        
        # Process the action
        try:
            await self.process_action(tournament, bot.user_id, action, amount)
        except Exception as e:
            # If action fails, default to fold
            logger.error(f"Bot action failed: {e}")
            await self.process_action(tournament, bot.user_id, "fold", 0)
    
    async def advance_phase(self, tournament: PokerTournament):
        """Advance to next betting phase"""
        # Reset betting state
        tournament.current_bet = 0
        tournament.min_raise = tournament.big_blind
        for player in tournament.get_players_in_hand():
            player.current_bet = 0
            player.has_acted = False
        
        players_can_act = [p for p in tournament.get_players_in_hand() if not p.is_all_in]
        
        if tournament.phase == GamePhase.PRE_FLOP:
            tournament.phase = GamePhase.FLOP
            tournament.community_cards = tournament.deck.deal(3)
        
        elif tournament.phase == GamePhase.FLOP:
            tournament.phase = GamePhase.TURN
            tournament.community_cards.extend(tournament.deck.deal(1))
        
        elif tournament.phase == GamePhase.TURN:
            tournament.phase = GamePhase.RIVER
            tournament.community_cards.extend(tournament.deck.deal(1))
        
        elif tournament.phase == GamePhase.RIVER:
            tournament.phase = GamePhase.SHOWDOWN
            await self.showdown(tournament)
            return
        
        # If all players are all-in, run out the board
        if len(players_can_act) <= 1:
            await self.run_out_board(tournament)
            return
        
        # First to act is left of dealer
        tournament.current_player_seat = tournament.get_next_active_seat(
            tournament.dealer_seat, 
            include_all_in=False
        )
        
        await self.broadcast_game_state(tournament)
        
        # Check if first player is a bot
        first_player = tournament.get_player_by_seat(tournament.current_player_seat)
        if first_player and first_player.is_bot:
            await self.handle_bot_turn(tournament, first_player)
        else:
            await self.start_action_timer(tournament)
    
    async def run_out_board(self, tournament: PokerTournament):
        """Deal remaining community cards when all players are all-in"""
        tournament.calculate_side_pots()
        
        while len(tournament.community_cards) < 5:
            if len(tournament.community_cards) == 0:
                tournament.community_cards = tournament.deck.deal(3)
                tournament.phase = GamePhase.FLOP
            elif len(tournament.community_cards) == 3:
                tournament.community_cards.extend(tournament.deck.deal(1))
                tournament.phase = GamePhase.TURN
            elif len(tournament.community_cards) == 4:
                tournament.community_cards.extend(tournament.deck.deal(1))
                tournament.phase = GamePhase.RIVER
            
            # Broadcast each street
            await self.broadcast_game_state(tournament)
            await asyncio.sleep(1.5)  # Dramatic pause
        
        tournament.phase = GamePhase.SHOWDOWN
        await self.showdown(tournament)
    
    async def showdown(self, tournament: PokerTournament):
        """Determine winner(s) at showdown"""
        players_in = tournament.get_players_in_hand()
        
        if len(players_in) == 1:
            await self.award_pot_to_winner(tournament, players_in[0])
            return
        
        # Calculate side pots if any all-ins
        tournament.calculate_side_pots()
        
        # Evaluate all hands
        hand_results = []
        for player in players_in:
            all_cards = player.hole_cards + tournament.community_cards
            rank, hand_name, tiebreaker, best_cards = evaluate_hand(all_cards)
            hand_results.append({
                "player": player,
                "rank": rank,
                "hand_name": hand_name,
                "tiebreaker": tiebreaker,
                "best_cards": best_cards,
            })
        
        # Sort by hand strength
        hand_results.sort(key=lambda x: (x["rank"], x["tiebreaker"]), reverse=True)
        
        # Broadcast showdown
        await self.broadcast_to_tournament(tournament, {
            "type": "showdown",
            "data": {
                "hands": [
                    {
                        "user_id": hr["player"].user_id,
                        "username": hr["player"].username,
                        "cards": [c.to_dict() for c in hr["player"].hole_cards],
                        "hand_name": hr["hand_name"],
                        "best_cards": [c.to_dict() for c in hr["best_cards"]],
                    }
                    for hr in hand_results
                ],
                "community_cards": [c.to_dict() for c in tournament.community_cards],
            }
        })
        
        await asyncio.sleep(2)  # Let players see the hands
        
        # Award pots
        if tournament.side_pots:
            for pot in tournament.side_pots:
                eligible = [hr for hr in hand_results if hr["player"].user_id in pot["eligible"]]
                if eligible:
                    # Find winner(s) among eligible
                    best = max(eligible, key=lambda x: (x["rank"], x["tiebreaker"]))
                    winners = [e for e in eligible if e["rank"] == best["rank"] and e["tiebreaker"] == best["tiebreaker"]]
                    
                    split_amount = pot["amount"] // len(winners)
                    for winner in winners:
                        winner["player"].chips += split_amount
                        await self.broadcast_to_tournament(tournament, {
                            "type": "pot_awarded",
                            "data": {
                                "user_id": winner["player"].user_id,
                                "username": winner["player"].username,
                                "amount": split_amount,
                                "hand_name": winner["hand_name"],
                                "pot_type": "side_pot" if len(tournament.side_pots) > 1 else "main_pot",
                            }
                        })
        else:
            # Single pot
            best = hand_results[0]
            winners = [hr for hr in hand_results if hr["rank"] == best["rank"] and hr["tiebreaker"] == best["tiebreaker"]]
            
            split_amount = tournament.pot // len(winners)
            for winner in winners:
                winner["player"].chips += split_amount
                await self.broadcast_to_tournament(tournament, {
                    "type": "pot_awarded",
                    "data": {
                        "user_id": winner["player"].user_id,
                        "username": winner["player"].username,
                        "amount": split_amount,
                        "hand_name": winner["hand_name"],
                        "pot_type": "main_pot",
                    }
                })
        
        # Check for eliminations
        await self.check_eliminations(tournament, hand_results[0]["player"])
        
        # Start next hand
        tournament.phase = GamePhase.HAND_COMPLETE
        await asyncio.sleep(3)
        await self.start_new_hand(tournament)
    
    async def award_pot_to_winner(self, tournament: PokerTournament, winner: PokerPlayer):
        """Award pot when all others fold"""
        winner.chips += tournament.pot
        
        await self.broadcast_to_tournament(tournament, {
            "type": "pot_awarded",
            "data": {
                "user_id": winner.user_id,
                "username": winner.username,
                "amount": tournament.pot,
                "hand_name": "others_folded",
                "pot_type": "main_pot",
            }
        })
        
        # Check for eliminations
        await self.check_eliminations(tournament, winner)
        
        tournament.phase = GamePhase.HAND_COMPLETE
        await asyncio.sleep(2)
        await self.start_new_hand(tournament)
    
    async def check_eliminations(self, tournament: PokerTournament, winner: PokerPlayer):
        """Check for and process player eliminations with PKO progressive bounty"""
        for player in tournament.players.values():
            if player.is_active and player.chips == 0 and not player.is_all_in:
                # Player is eliminated
                player.is_active = False
                player.elimination_position = len(tournament.get_active_players()) + 1
                tournament.eliminated_players.append(player.user_id)
                
                # PKO Progressive Bounty System:
                # - Winner gets 50% of eliminated player's bounty (immediate BL coins)
                # - Winner's own bounty increases by the other 50%
                bounty_award = player.bounty // 2
                bounty_add_to_winner = player.bounty - bounty_award  # Other half
                
                winner.bounties_won += 1
                winner.total_bounty_bl += bounty_award
                winner.bounty += bounty_add_to_winner  # Progressive - add to winner's bounty
                
                # Add bounty to winner's BL coins wallet (platform-funded)
                if not winner.is_bot:
                    await self.add_bounty_to_wallet(winner.user_id, bounty_award)
                
                # Broadcast elimination with bounty details
                await self.broadcast_to_tournament(tournament, {
                    "type": "player_eliminated",
                    "data": {
                        "eliminated_user_id": player.user_id,
                        "eliminated_username": player.username,
                        "eliminated_bounty": player.bounty,
                        "eliminator_user_id": winner.user_id,
                        "eliminator_username": winner.username,
                        "bounty_awarded": bounty_award,
                        "bounty_added_to_eliminator": bounty_add_to_winner,
                        "eliminator_new_bounty": winner.bounty,
                        "position": player.elimination_position,
                        "remaining_players": len(tournament.get_active_players()),
                    }
                })
                
                # Check if tournament should end
                active_players = tournament.get_active_players()
                if len(active_players) == 1:
                    await self.end_tournament(tournament)
                    return
    
    async def add_bounty_to_wallet(self, user_id: str, amount: int):
        """Add bounty to player's BL coins wallet"""
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"bl_coins": amount}}
        )
    
    async def end_tournament(self, tournament: PokerTournament):
        """End tournament and distribute prizes"""
        tournament.status = TournamentStatus.COMPLETED
        tournament.ended_at = datetime.now(timezone.utc)
        
        # Get final standings
        active_players = tournament.get_active_players()
        
        if active_players:
            winner = active_players[0]
            winner.elimination_position = 1
            
            # Calculate prizes
            first_place = int(tournament.total_buy_ins * 0.65)
            second_place = int(tournament.total_buy_ins * 0.35)
            
            # Award prizes
            await db.users.update_one(
                {"user_id": winner.user_id},
                {"$inc": {"bl_coins": first_place}}
            )
            
            # Second place (last eliminated)
            if tournament.eliminated_players:
                second_user_id = tournament.eliminated_players[-1]
                await db.users.update_one(
                    {"user_id": second_user_id},
                    {"$inc": {"bl_coins": second_place}}
                )
            
            # Record tournament in database
            await db.poker_tournaments.insert_one({
                "tournament_id": tournament.tournament_id,
                "name": tournament.name,
                "status": tournament.status,
                "started_at": tournament.started_at,
                "ended_at": tournament.ended_at,
                "player_count": len(tournament.players),
                "prize_pool": tournament.total_buy_ins,
                "winner": {
                    "user_id": winner.user_id,
                    "username": winner.username,
                    "prize": first_place,
                    "bounties_won": winner.bounties_won,
                },
                "final_standings": [
                    {
                        "position": p.elimination_position or 1,
                        "user_id": p.user_id,
                        "username": p.username,
                        "bounties_won": p.bounties_won,
                    }
                    for p in sorted(tournament.players.values(), key=lambda x: x.elimination_position or 0)
                ],
            })
            
            await self.broadcast_to_tournament(tournament, {
                "type": "tournament_ended",
                "data": {
                    "winner": {
                        "user_id": winner.user_id,
                        "username": winner.username,
                        "prize": first_place,
                        "bounties_won": winner.bounties_won,
                    },
                    "prize_pool": tournament.total_buy_ins,
                    "final_standings": [
                        {
                            "position": p.elimination_position or 1,
                            "user_id": p.user_id,
                            "username": p.username,
                            "bounties_won": p.bounties_won,
                        }
                        for p in sorted(tournament.players.values(), key=lambda x: x.elimination_position or 0)
                    ],
                }
            })
        
        # Clean up player mappings
        for user_id in tournament.players:
            if user_id in self.player_tournament_map:
                del self.player_tournament_map[user_id]
    
    async def start_action_timer(self, tournament: PokerTournament):
        """Start timer for current player's action"""
        tournament.action_timer_task = asyncio.create_task(
            self.action_timeout(tournament)
        )
    
    async def action_timeout(self, tournament: PokerTournament):
        """Handle action timeout - auto fold"""
        await asyncio.sleep(ACTION_TIMEOUT)
        
        player = tournament.get_player_by_seat(tournament.current_player_seat)
        if player and not player.is_folded and not player.is_all_in:
            # Auto-fold on timeout
            player.is_folded = True
            player.last_action = "timeout_fold"
            
            await self.broadcast_to_tournament(tournament, {
                "type": "player_timeout",
                "data": {
                    "user_id": player.user_id,
                    "username": player.username,
                }
            })
            
            await self.check_betting_round(tournament)
    
    async def broadcast_game_state(self, tournament: PokerTournament):
        """Broadcast current game state to all connected players"""
        for user_id, ws in tournament.connections.items():
            try:
                await ws.send_json({
                    "type": "game_state",
                    "data": tournament.to_dict(viewer_id=user_id)
                })
            except Exception as e:
                logger.error(f"Failed to send game state to {user_id}: {e}")
        
        # Send to spectators (no hole cards visible)
        for user_id, ws in tournament.spectator_connections.items():
            try:
                await ws.send_json({
                    "type": "game_state",
                    "data": tournament.to_dict()
                })
            except Exception as e:
                logger.error(f"Failed to send game state to spectator {user_id}: {e}")
    
    async def broadcast_to_tournament(self, tournament: PokerTournament, message: Dict):
        """Broadcast message to all connections in tournament"""
        all_connections = {**tournament.connections, **tournament.spectator_connections}
        for user_id, ws in all_connections.items():
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.error(f"Failed to broadcast to {user_id}: {e}")
    
    async def handle_chat(self, tournament: PokerTournament, user_id: str, message: str):
        """Handle chat message"""
        player = tournament.players.get(user_id)
        username = player.username if player else "Spectator"
        
        chat_msg = {
            "user_id": user_id,
            "username": username,
            "message": message[:200],  # Limit message length
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        tournament.chat_messages.append(chat_msg)
        
        await self.broadcast_to_tournament(tournament, {
            "type": "chat_message",
            "data": chat_msg
        })
    
    async def handle_rebuy(self, tournament: PokerTournament, user_id: str):
        """Handle rebuy request"""
        # Check if rebuys are still available
        if not tournament.can_rebuy():
            raise HTTPException(status_code=400, detail="Rebuys no longer available (60 minutes elapsed or blind level 5+ reached)")
        
        player = tournament.players.get(user_id)
        if not player:
            raise HTTPException(status_code=400, detail="Player not in tournament")
        
        if player.is_bot:
            raise HTTPException(status_code=400, detail="Bots cannot rebuy")
        
        if player.is_active and player.chips > 0:
            raise HTTPException(status_code=400, detail="Cannot rebuy with chips remaining")
        
        if player.rebuys >= 1:  # Limit to 1 rebuy
            raise HTTPException(status_code=400, detail="Maximum rebuys reached")
        
        # Deduct buy-in from wallet
        user = await db.users.find_one({"user_id": user_id})
        if not user or user.get("bl_coins", 0) < BUY_IN:
            raise HTTPException(status_code=400, detail="Insufficient BL coins for rebuy")
        
        await db.users.update_one(
            {"user_id": user_id},
            {"$inc": {"bl_coins": -BUY_IN}}
        )
        
        # Add chips and reset bounty
        player.chips = STARTING_CHIPS
        player.is_active = True
        player.rebuys += 1
        player.bounty = BOUNTY_AMOUNT  # Reset bounty on rebuy
        tournament.total_buy_ins += BUY_IN
        
        # Remove from eliminated list if present
        if user_id in tournament.eliminated_players:
            tournament.eliminated_players.remove(user_id)
        
        await self.broadcast_to_tournament(tournament, {
            "type": "player_rebuy",
            "data": {
                "user_id": user_id,
                "username": player.username,
                "new_chips": STARTING_CHIPS,
                "new_bounty": BOUNTY_AMOUNT,
                "prize_pool": tournament.total_buy_ins,
            }
        })
        
        return {"success": True, "chips": player.chips, "bounty": player.bounty}

# Global tournament manager
tournament_manager = TournamentManager()

# ============== API ENDPOINTS ==============

@poker_router.get("/tournaments")
async def list_tournaments(user: dict = Depends(get_current_user)):
    """List all available tournaments"""
    open_tournaments = tournament_manager.get_open_tournaments()
    return {
        "tournaments": [
            {
                "tournament_id": t.tournament_id,
                "name": t.name,
                "status": t.status,
                "player_count": len(t.players),
                "max_players": MAX_PLAYERS,
                "buy_in": BUY_IN,
                "bounty": BOUNTY_AMOUNT,
                "prize_pool": t.total_buy_ins,
                "created_at": t.created_at.isoformat(),
            }
            for t in open_tournaments
        ]
    }

@poker_router.post("/tournaments/create")
async def create_tournament(
    request: CreateTournamentRequest,
    user: dict = Depends(get_current_user)
):
    """Create a new tournament"""
    # Check if user is already in a tournament
    existing = tournament_manager.get_player_tournament(user["user_id"])
    if existing:
        raise HTTPException(status_code=400, detail="Already in a tournament")
    
    tournament = tournament_manager.create_tournament(request.name)
    return {
        "tournament_id": tournament.tournament_id,
        "name": tournament.name,
        "buy_in": BUY_IN,
        "bounty": BOUNTY_AMOUNT,
    }

@poker_router.post("/tournaments/register")
async def register_for_tournament(
    request: TournamentRegistration,
    user: dict = Depends(get_current_user)
):
    """Register for a tournament"""
    tournament = tournament_manager.get_tournament(request.tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # Check if user has enough BL coins
    user_data = await db.users.find_one({"user_id": user["user_id"]})
    if not user_data or user_data.get("bl_coins", 0) < BUY_IN:
        raise HTTPException(status_code=400, detail=f"Insufficient BL coins. Need {BUY_IN}")
    
    # Deduct buy-in
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"bl_coins": -BUY_IN}}
    )
    
    try:
        player = await tournament_manager.register_player(
            tournament,
            user["user_id"],
            user.get("name", user.get("username", "Player")),
            user.get("avatar", "")
        )
        
        # Broadcast registration
        await tournament_manager.broadcast_to_tournament(tournament, {
            "type": "player_registered",
            "data": {
                "user_id": player.user_id,
                "username": player.username,
                "seat": player.seat,
                "player_count": len(tournament.players),
            }
        })
        
        return {
            "success": True,
            "seat": player.seat,
            "tournament": tournament.to_dict(viewer_id=user["user_id"])
        }
    except Exception as e:
        # Refund buy-in on error
        await db.users.update_one(
            {"user_id": user["user_id"]},
            {"$inc": {"bl_coins": BUY_IN}}
        )
        raise e

@poker_router.get("/tournaments/{tournament_id}")
async def get_tournament(
    tournament_id: str,
    user: dict = Depends(get_current_user)
):
    """Get tournament state"""
    tournament = tournament_manager.get_tournament(tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    return tournament.to_dict(viewer_id=user["user_id"])

@poker_router.post("/tournaments/{tournament_id}/add-bots")
async def add_bots_to_tournament(
    tournament_id: str,
    bot_count: int = Query(default=1, ge=1, le=9),
    user: dict = Depends(get_current_user)
):
    """Add AI bots to fill remaining seats (only creator can do this)"""
    tournament = tournament_manager.get_tournament(tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # Only creator can add bots
    if tournament.creator_id != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only tournament creator can add bots")
    
    if tournament.status != TournamentStatus.REGISTERING:
        raise HTTPException(status_code=400, detail="Cannot add bots after tournament starts")
    
    bots_added = await tournament_manager.add_ai_bots(tournament, bot_count)
    
    # Broadcast bot additions
    for bot in bots_added:
        await tournament_manager.broadcast_to_tournament(tournament, {
            "type": "bot_added",
            "data": {
                "user_id": bot.user_id,
                "username": bot.username,
                "seat": bot.seat,
                "is_bot": True,
                "personality": bot.bot_personality,
                "skill": bot.bot_skill,
                "player_count": len(tournament.players),
            }
        })
    
    return {
        "success": True,
        "bots_added": len(bots_added),
        "total_players": len(tournament.players),
        "bots": [{"username": b.username, "seat": b.seat, "personality": b.bot_personality} for b in bots_added]
    }

@poker_router.post("/tournaments/action")
async def perform_action(
    request: PlayerActionRequest,
    user: dict = Depends(get_current_user)
):
    """Perform a game action"""
    tournament = tournament_manager.get_tournament(request.tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    await tournament_manager.process_action(
        tournament,
        user["user_id"],
        request.action,
        request.amount
    )
    
    return {"success": True}

@poker_router.post("/tournaments/rebuy")
async def rebuy(
    request: RebuyRequest,
    user: dict = Depends(get_current_user)
):
    """Request a rebuy"""
    tournament = tournament_manager.get_tournament(request.tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    return await tournament_manager.handle_rebuy(tournament, user["user_id"])

@poker_router.post("/tournaments/chat")
async def send_chat(
    tournament_id: str,
    message: str,
    user: dict = Depends(get_current_user)
):
    """Send chat message"""
    tournament = tournament_manager.get_tournament(tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    await tournament_manager.handle_chat(tournament, user["user_id"], message)
    return {"success": True}

@poker_router.get("/my-tournament")
async def get_my_tournament(user: dict = Depends(get_current_user)):
    """Get current tournament player is in"""
    tournament = tournament_manager.get_player_tournament(user["user_id"])
    if not tournament:
        return {"in_tournament": False}
    
    return {
        "in_tournament": True,
        "tournament": tournament.to_dict(viewer_id=user["user_id"])
    }

@poker_router.post("/tournaments/leave")
async def leave_tournament(user: dict = Depends(get_current_user)):
    """Leave a tournament (only works during waiting/registering phase)"""
    tournament = tournament_manager.get_player_tournament(user["user_id"])
    if not tournament:
        raise HTTPException(status_code=404, detail="Not in any tournament")
    
    # Can only leave during registration/waiting phase
    if tournament.status not in [TournamentStatus.REGISTERING]:
        raise HTTPException(
            status_code=400, 
            detail="Cannot leave tournament after it has started. You can fold and wait for elimination."
        )
    
    player = tournament.players.get(user["user_id"])
    if not player:
        raise HTTPException(status_code=404, detail="Player not found in tournament")
    
    # Remove player from tournament
    del tournament.players[user["user_id"]]
    
    # Remove from player mapping
    if user["user_id"] in tournament_manager.player_tournament_map:
        del tournament_manager.player_tournament_map[user["user_id"]]
    
    # Refund buy-in
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$inc": {"bl_coins": BUY_IN}}
    )
    
    # Update prize pool
    tournament.total_buy_ins -= BUY_IN
    tournament.total_bounties -= BOUNTY_AMOUNT
    
    # Broadcast player left
    await tournament_manager.broadcast_to_tournament(tournament, {
        "type": "player_left",
        "data": {
            "user_id": user["user_id"],
            "username": player.username,
            "player_count": len(tournament.players),
        }
    })
    
    # If tournament is empty or creator left, cancel it
    if len(tournament.players) == 0:
        tournament.status = TournamentStatus.CANCELLED
    
    return {
        "success": True,
        "message": "Left tournament successfully. Buy-in refunded.",
        "refund": BUY_IN
    }

@poker_router.post("/tournaments/{tournament_id}/force-start")
async def force_start_tournament(
    tournament_id: str,
    user: dict = Depends(get_current_user)
):
    """Force start a tournament (for testing with 2+ players)"""
    tournament = tournament_manager.get_tournament(tournament_id)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    if tournament.status != TournamentStatus.REGISTERING:
        raise HTTPException(status_code=400, detail="Tournament already started")
    
    if len(tournament.players) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 players")
    
    # Check if requesting user is in the tournament
    if user["user_id"] not in tournament.players:
        raise HTTPException(status_code=403, detail="Only players can start the tournament")
    
    await tournament_manager.start_tournament(tournament)
    
    return {
        "success": True,
        "message": "Tournament started!",
        "tournament": tournament.to_dict(viewer_id=user["user_id"])
    }

@poker_router.get("/leaderboard")
async def get_leaderboard(
    limit: int = Query(default=20, le=100),
    user: dict = Depends(get_current_user)
):
    """Get bounty leaderboard"""
    # Aggregate bounties from completed tournaments
    pipeline = [
        {"$unwind": "$final_standings"},
        {"$group": {
            "_id": "$final_standings.user_id",
            "username": {"$first": "$final_standings.username"},
            "total_bounties": {"$sum": "$final_standings.bounties_won"},
            "tournaments_played": {"$sum": 1},
            "wins": {"$sum": {"$cond": [{"$eq": ["$final_standings.position", 1]}, 1, 0]}},
        }},
        {"$sort": {"total_bounties": -1}},
        {"$limit": limit}
    ]
    
    results = await db.poker_tournaments.aggregate(pipeline).to_list(length=limit)
    
    return {
        "leaderboard": [
            {
                "rank": i + 1,
                "user_id": r["_id"],
                "username": r["username"],
                "total_bounties": r["total_bounties"],
                "tournaments_played": r["tournaments_played"],
                "wins": r["wins"],
            }
            for i, r in enumerate(results)
        ]
    }

# ============== WEBSOCKET ==============

@poker_router.websocket("/ws/{tournament_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    tournament_id: str,
    token: str = Query(...)
):
    """WebSocket connection for real-time game updates"""
    await websocket.accept()
    
    # Verify token and get user
    try:
        from server import decode_token
        payload = decode_token(token)
        user_id = payload.get("user_id") or payload.get("sub")
    except Exception as e:
        await websocket.close(code=4001, reason="Invalid token")
        return
    
    tournament = tournament_manager.get_tournament(tournament_id)
    if not tournament:
        await websocket.close(code=4004, reason="Tournament not found")
        return
    
    # Determine if player or spectator
    is_player = user_id in tournament.players
    
    if is_player:
        tournament.connections[user_id] = websocket
        tournament.players[user_id].is_connected = True
    else:
        tournament.spectator_connections[user_id] = websocket
    
    # Send initial state
    await websocket.send_json({
        "type": "connected",
        "data": tournament.to_dict(viewer_id=user_id if is_player else None)
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "action":
                await tournament_manager.process_action(
                    tournament,
                    user_id,
                    data.get("action"),
                    data.get("amount", 0)
                )
            
            elif data.get("type") == "chat":
                await tournament_manager.handle_chat(
                    tournament,
                    user_id,
                    data.get("message", "")
                )
            
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        if is_player:
            del tournament.connections[user_id]
            tournament.players[user_id].is_connected = False
            
            # Notify others
            await tournament_manager.broadcast_to_tournament(tournament, {
                "type": "player_disconnected",
                "data": {"user_id": user_id}
            })
        else:
            if user_id in tournament.spectator_connections:
                del tournament.spectator_connections[user_id]
    
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        if is_player and user_id in tournament.connections:
            del tournament.connections[user_id]
        elif user_id in tournament.spectator_connections:
            del tournament.spectator_connections[user_id]
