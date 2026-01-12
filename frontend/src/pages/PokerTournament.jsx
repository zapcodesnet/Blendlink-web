import React, { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { 
  ChevronLeft, Users, Trophy, Clock, Send, 
  Volume2, VolumeX, Maximize2, Minimize2,
  Coins, Crown, Zap, MessageCircle, Eye, RefreshCw
} from "lucide-react";

// ============== CONSTANTS ==============
const BUY_IN = 2000;
const BOUNTY_AMOUNT = 1000;
const STARTING_CHIPS = 2000;

const SUIT_COLORS = {
  hearts: "text-red-500",
  diamonds: "text-red-500",
  clubs: "text-gray-900",
  spades: "text-gray-900",
};

const SUIT_SYMBOLS = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

// Seat positions for 10-player table (percentage from center)
const SEAT_POSITIONS = [
  { left: "50%", top: "95%", transform: "translate(-50%, -50%)" },   // 0 - Bottom center
  { left: "15%", top: "85%", transform: "translate(-50%, -50%)" },   // 1 - Bottom left
  { left: "2%", top: "60%", transform: "translate(-50%, -50%)" },    // 2 - Left middle-bottom
  { left: "2%", top: "35%", transform: "translate(-50%, -50%)" },    // 3 - Left middle-top
  { left: "15%", top: "10%", transform: "translate(-50%, -50%)" },   // 4 - Top left
  { left: "50%", top: "2%", transform: "translate(-50%, -50%)" },    // 5 - Top center
  { left: "85%", top: "10%", transform: "translate(-50%, -50%)" },   // 6 - Top right
  { left: "98%", top: "35%", transform: "translate(-50%, -50%)" },   // 7 - Right middle-top
  { left: "98%", top: "60%", transform: "translate(-50%, -50%)" },   // 8 - Right middle-bottom
  { left: "85%", top: "85%", transform: "translate(-50%, -50%)" },   // 9 - Bottom right
];

// ============== CARD COMPONENT ==============
const Card = ({ card, hidden = false, small = false }) => {
  if (!card || hidden) {
    return (
      <div className={`${small ? 'w-8 h-11' : 'w-12 h-16'} bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-lg border border-blue-400`}>
        <span className={`${small ? 'text-lg' : 'text-2xl'}`}>🂠</span>
      </div>
    );
  }

  const suitColor = card.suit === "hearts" || card.suit === "diamonds" ? "text-red-500" : "text-gray-900";
  
  return (
    <div className={`${small ? 'w-8 h-11' : 'w-12 h-16'} bg-white rounded-lg flex flex-col items-center justify-center shadow-lg border border-gray-200 ${small ? 'text-xs' : 'text-sm'}`}>
      <span className={`font-bold ${suitColor}`}>{card.rank}</span>
      <span className={suitColor}>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
};

// ============== PLAYER SEAT COMPONENT ==============
const PlayerSeat = ({ 
  player, 
  position, 
  isDealer, 
  isSmallBlind, 
  isBigBlind, 
  isCurrentTurn,
  isMe,
  showCards 
}) => {
  if (!player) {
    return (
      <div 
        className="absolute w-24 h-32 flex flex-col items-center justify-center"
        style={SEAT_POSITIONS[position]}
      >
        <div className="w-14 h-14 rounded-full bg-gray-800/50 border-2 border-dashed border-gray-600 flex items-center justify-center">
          <Users className="w-6 h-6 text-gray-600" />
        </div>
        <span className="text-xs text-gray-600 mt-1">Empty</span>
      </div>
    );
  }

  const isActive = player.is_active && !player.is_folded;
  const isAllIn = player.is_all_in;

  return (
    <div 
      className={`absolute w-28 flex flex-col items-center transition-all duration-300 ${
        isCurrentTurn ? 'scale-110 z-20' : 'z-10'
      }`}
      style={SEAT_POSITIONS[position]}
    >
      {/* Position indicators */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-1">
        {isDealer && (
          <div className="w-5 h-5 rounded-full bg-yellow-500 text-black text-xs font-bold flex items-center justify-center shadow-lg">D</div>
        )}
        {isSmallBlind && (
          <div className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">SB</div>
        )}
        {isBigBlind && (
          <div className="w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow-lg">BB</div>
        )}
      </div>

      {/* Avatar */}
      <div className={`relative w-14 h-14 rounded-full border-3 shadow-lg overflow-hidden ${
        isCurrentTurn ? 'border-yellow-400 ring-4 ring-yellow-400/50 animate-pulse' :
        isAllIn ? 'border-purple-500' :
        player.is_folded ? 'border-gray-600 opacity-50' :
        isActive ? 'border-green-500' : 'border-gray-600'
      }`}>
        {player.avatar ? (
          <img src={player.avatar} alt={player.username} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
            {player.username?.charAt(0)?.toUpperCase() || "?"}
          </div>
        )}
        {!player.is_connected && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-red-500 text-xs">DC</span>
          </div>
        )}
      </div>

      {/* Username & chips */}
      <div className={`mt-1 text-center ${player.is_folded ? 'opacity-50' : ''}`}>
        <p className={`text-xs font-semibold truncate max-w-24 ${isMe ? 'text-yellow-400' : 'text-white'}`}>
          {player.username}
          {isMe && " (You)"}
        </p>
        <div className="flex items-center justify-center gap-1 text-xs">
          <Coins className="w-3 h-3 text-amber-400" />
          <span className="text-amber-400 font-mono">{player.chips?.toLocaleString()}</span>
        </div>
        {player.bounty > 0 && (
          <div className="flex items-center justify-center gap-1 text-xs text-green-400">
            <Crown className="w-3 h-3" />
            <span>{player.bounty}</span>
          </div>
        )}
      </div>

      {/* Hole cards */}
      {player.cards && player.cards.length > 0 && (
        <div className="flex gap-0.5 mt-1">
          {player.cards.map((card, i) => (
            <Card 
              key={i} 
              card={card} 
              hidden={!showCards && !isMe && card.rank === "?"} 
              small 
            />
          ))}
        </div>
      )}

      {/* Current bet */}
      {player.current_bet > 0 && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 px-2 py-0.5 rounded-full text-xs text-amber-400 font-mono">
          {player.current_bet}
        </div>
      )}

      {/* Status badges */}
      {player.is_folded && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600/80 px-2 py-0.5 rounded text-xs font-bold">
          FOLD
        </div>
      )}
      {isAllIn && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-purple-600/80 px-2 py-0.5 rounded text-xs font-bold animate-pulse">
          ALL IN
        </div>
      )}
    </div>
  );
};

// ============== POKER TABLE COMPONENT ==============
const PokerTable = ({ tournament, userId, onAction }) => {
  const players = tournament?.players || {};
  const communityCards = tournament?.community_cards || [];
  const pot = tournament?.pot || 0;
  const phase = tournament?.phase;
  
  // Create seat array with players
  const seats = Array(10).fill(null);
  Object.values(players).forEach(player => {
    if (player.seat >= 0 && player.seat < 10) {
      seats[player.seat] = player;
    }
  });

  return (
    <div className="relative w-full aspect-[16/10] max-w-4xl mx-auto">
      {/* Table felt */}
      <div className="absolute inset-[10%] bg-gradient-to-br from-green-800 to-green-900 rounded-[50%] border-8 border-amber-900 shadow-2xl">
        {/* Table edge highlight */}
        <div className="absolute inset-2 rounded-[50%] border-2 border-green-700/50"></div>
        
        {/* Center area */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Pot */}
          {pot > 0 && (
            <div className="bg-black/60 px-4 py-2 rounded-full mb-2">
              <span className="text-amber-400 font-bold text-lg">
                Pot: {pot.toLocaleString()} BL
              </span>
            </div>
          )}
          
          {/* Community cards */}
          {communityCards.length > 0 && (
            <div className="flex gap-2">
              {communityCards.map((card, i) => (
                <Card key={i} card={card} />
              ))}
              {/* Placeholder for remaining cards */}
              {Array(5 - communityCards.length).fill(null).map((_, i) => (
                <div key={`empty-${i}`} className="w-12 h-16 rounded-lg border-2 border-dashed border-green-700/50"></div>
              ))}
            </div>
          )}
          
          {/* Phase indicator */}
          {phase && phase !== "waiting" && (
            <div className="mt-2 text-sm text-green-300 uppercase tracking-wider">
              {phase.replace("_", " ")}
            </div>
          )}
        </div>
      </div>

      {/* Player seats */}
      {seats.map((player, i) => (
        <PlayerSeat
          key={i}
          player={player}
          position={i}
          isDealer={tournament?.dealer_seat === i}
          isSmallBlind={tournament?.small_blind_seat === i}
          isBigBlind={tournament?.big_blind_seat === i}
          isCurrentTurn={tournament?.current_player_seat === i && player?.is_active && !player?.is_folded}
          isMe={player?.user_id === userId}
          showCards={phase === "showdown" || phase === "hand_complete"}
        />
      ))}
    </div>
  );
};

// ============== ACTION PANEL COMPONENT ==============
const ActionPanel = ({ tournament, userId, onAction, disabled }) => {
  const [betAmount, setBetAmount] = useState(0);
  const player = tournament?.players?.[userId];
  const isMyTurn = tournament?.current_player_seat === player?.seat && player?.is_active && !player?.is_folded;
  const currentBet = tournament?.current_bet || 0;
  const minRaise = tournament?.min_raise || tournament?.big_blind || 50;
  const myBet = player?.current_bet || 0;
  const toCall = currentBet - myBet;
  const chips = player?.chips || 0;

  useEffect(() => {
    setBetAmount(Math.max(currentBet + minRaise, tournament?.big_blind || 50));
  }, [currentBet, minRaise, tournament?.big_blind]);

  if (!player || player.is_folded || player.is_all_in) {
    return (
      <div className="bg-gray-900/80 rounded-xl p-4 text-center">
        <p className="text-gray-400">
          {player?.is_folded ? "You folded this hand" : 
           player?.is_all_in ? "You're all-in" : 
           "Waiting for game to start..."}
        </p>
      </div>
    );
  }

  const canCheck = currentBet === myBet;
  const canCall = toCall > 0 && toCall < chips;
  const canRaise = chips > toCall;

  return (
    <div className={`bg-gray-900/80 rounded-xl p-4 ${isMyTurn ? 'ring-2 ring-yellow-400' : ''}`}>
      {isMyTurn && (
        <div className="text-center mb-3">
          <span className="text-yellow-400 font-bold animate-pulse">Your Turn!</span>
          <div className="text-sm text-gray-400">Time remaining: 30s</div>
        </div>
      )}
      
      <div className="grid grid-cols-4 gap-2 mb-3">
        <Button 
          variant="destructive" 
          onClick={() => onAction("fold")}
          disabled={disabled || !isMyTurn}
          data-testid="poker-fold-btn"
        >
          Fold
        </Button>
        
        {canCheck ? (
          <Button 
            variant="outline" 
            onClick={() => onAction("check")}
            disabled={disabled || !isMyTurn}
            data-testid="poker-check-btn"
          >
            Check
          </Button>
        ) : canCall ? (
          <Button 
            variant="secondary" 
            onClick={() => onAction("call")}
            disabled={disabled || !isMyTurn}
            data-testid="poker-call-btn"
          >
            Call {toCall}
          </Button>
        ) : null}
        
        {canRaise && (
          <Button 
            onClick={() => onAction("raise", betAmount)}
            disabled={disabled || !isMyTurn || betAmount < currentBet + minRaise}
            data-testid="poker-raise-btn"
          >
            Raise
          </Button>
        )}
        
        <Button 
          variant="secondary"
          className="bg-purple-600 hover:bg-purple-700"
          onClick={() => onAction("all_in")}
          disabled={disabled || !isMyTurn}
          data-testid="poker-allin-btn"
        >
          All In
        </Button>
      </div>

      {/* Bet slider */}
      {canRaise && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400 w-16">{currentBet + minRaise}</span>
          <input
            type="range"
            min={currentBet + minRaise}
            max={chips + myBet}
            value={betAmount}
            onChange={(e) => setBetAmount(parseInt(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm text-gray-400 w-16 text-right">{chips + myBet}</span>
          <Input
            type="number"
            value={betAmount}
            onChange={(e) => setBetAmount(parseInt(e.target.value) || 0)}
            className="w-24 text-center"
          />
        </div>
      )}
      
      {/* Quick bet buttons */}
      <div className="flex gap-2 mt-2">
        {[0.5, 0.75, 1, 1.5].map(mult => {
          const amount = Math.floor((tournament?.pot || 0) * mult);
          if (amount >= currentBet + minRaise && amount <= chips + myBet) {
            return (
              <Button
                key={mult}
                size="sm"
                variant="outline"
                onClick={() => setBetAmount(amount)}
                disabled={!isMyTurn}
              >
                {mult === 1 ? "Pot" : `${mult * 100}%`}
              </Button>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};

// ============== CHAT COMPONENT ==============
const ChatPanel = ({ messages, onSend }) => {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (message.trim()) {
      onSend(message.trim());
      setMessage("");
    }
  };

  return (
    <div className="bg-gray-900/80 rounded-xl p-3 h-48 flex flex-col">
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-300">
        <MessageCircle className="w-4 h-4" />
        Table Chat
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-1 text-sm">
        {messages?.map((msg, i) => (
          <div key={i} className="text-gray-400">
            <span className="text-blue-400 font-semibold">{msg.username}: </span>
            {msg.message}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="flex gap-2 mt-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type message..."
          className="flex-1 h-8 text-sm"
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
        />
        <Button size="sm" onClick={handleSend}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

// ============== TOURNAMENT INFO PANEL ==============
const TournamentInfo = ({ tournament }) => {
  return (
    <div className="bg-gray-900/80 rounded-xl p-4">
      <h3 className="font-bold text-lg mb-3">{tournament?.name || "PKO Tournament"}</h3>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <span className="text-gray-400">Players:</span>
          <span className="ml-2 font-semibold">{tournament?.active_player_count || 0}/{tournament?.player_count || 0}</span>
        </div>
        <div>
          <span className="text-gray-400">Hand:</span>
          <span className="ml-2 font-semibold">#{tournament?.hand_number || 0}</span>
        </div>
        <div>
          <span className="text-gray-400">Blinds:</span>
          <span className="ml-2 font-semibold text-amber-400">
            {tournament?.small_blind}/{tournament?.big_blind}
            {tournament?.ante > 0 && ` (${tournament.ante})`}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Level:</span>
          <span className="ml-2 font-semibold">{(tournament?.blind_level || 0) + 1}</span>
        </div>
        <div>
          <span className="text-gray-400">Prize Pool:</span>
          <span className="ml-2 font-semibold text-green-400">{tournament?.total_prize_pool?.toLocaleString() || 0} BL</span>
        </div>
        <div>
          <span className="text-gray-400">Next Blind:</span>
          <span className="ml-2 font-semibold">{tournament?.next_blind_increase || "--:--"}</span>
        </div>
      </div>
      
      {tournament?.rebuy_available && (
        <div className="mt-3 p-2 bg-purple-600/20 rounded text-center text-sm text-purple-300">
          Rebuys available!
        </div>
      )}
    </div>
  );
};

// ============== MAIN POKER TOURNAMENT PAGE ==============
export default function PokerTournament() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { tournamentId } = useParams();
  
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const wsRef = useRef(null);
  const reconnectAttempts = useRef(0);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (!tournamentId || !user) return;
    
    const token = localStorage.getItem("blendlink_token");
    const wsUrl = `${process.env.REACT_APP_BACKEND_URL?.replace("https://", "wss://").replace("http://", "ws://")}/api/poker/ws/${tournamentId}?token=${token}`;
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log("Poker WebSocket connected");
        reconnectAttempts.current = 0;
      };
      
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };
      
      wsRef.current.onclose = () => {
        console.log("Poker WebSocket disconnected");
        // Attempt reconnect
        if (reconnectAttempts.current < 5) {
          reconnectAttempts.current++;
          setTimeout(connectWebSocket, 2000 * reconnectAttempts.current);
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    } catch (error) {
      console.error("Failed to connect WebSocket:", error);
    }
  }, [tournamentId, user]);

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case "connected":
      case "game_state":
        setTournament(data.data);
        setLoading(false);
        break;
      
      case "tournament_started":
        setTournament(data.data);
        toast.success("Tournament has started!");
        break;
      
      case "player_registered":
        toast.info(`${data.data.username} joined the table`);
        break;
      
      case "blind_increase":
        toast.warning(`Blinds increased: ${data.data.small_blind}/${data.data.big_blind}`);
        break;
      
      case "showdown":
        // Handle showdown display
        break;
      
      case "pot_awarded":
        if (data.data.user_id === user?.user_id) {
          toast.success(`You won ${data.data.amount} BL! (${data.data.hand_name})`);
        } else {
          toast.info(`${data.data.username} wins ${data.data.amount} BL`);
        }
        break;
      
      case "player_eliminated":
        if (data.data.eliminated_user_id === user?.user_id) {
          toast.error(`You were eliminated in position ${data.data.position}`);
        } else {
          toast.warning(`${data.data.eliminated_username} eliminated by ${data.data.eliminator_username}! Bounty: ${data.data.bounty_awarded} BL`);
        }
        break;
      
      case "tournament_ended":
        toast.success(`Tournament ended! Winner: ${data.data.winner.username}`);
        break;
      
      case "player_timeout":
        toast.warning(`${data.data.username} timed out`);
        break;
      
      case "chat_message":
        // Chat handled by state update
        break;
      
      default:
        console.log("Unknown message type:", data.type);
    }
  };

  // Load tournament and connect WebSocket
  useEffect(() => {
    if (tournamentId) {
      connectWebSocket();
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [tournamentId, connectWebSocket]);

  // Fallback: Load tournament via REST if WebSocket fails
  useEffect(() => {
    const loadTournament = async () => {
      if (!tournamentId) return;
      try {
        const response = await api.get(`/poker/tournaments/${tournamentId}`);
        setTournament(response.data);
      } catch (error) {
        toast.error("Failed to load tournament");
        navigate("/casino");
      }
      setLoading(false);
    };
    
    if (loading && !wsRef.current?.readyState === WebSocket.OPEN) {
      loadTournament();
    }
  }, [tournamentId, loading, navigate]);

  // Handle player action
  const handleAction = async (action, amount = 0) => {
    if (!tournament || actionLoading) return;
    
    setActionLoading(true);
    try {
      // Send via WebSocket if connected
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "action",
          action,
          amount,
        }));
      } else {
        // Fallback to REST
        await api.post("/poker/tournaments/action", {
          tournament_id: tournament.tournament_id,
          action,
          amount,
        });
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || "Action failed");
    }
    setActionLoading(false);
  };

  // Handle chat
  const handleChat = (message) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "chat",
        message,
      }));
    }
  };

  // Handle rebuy
  const handleRebuy = async () => {
    try {
      await api.post("/poker/tournaments/rebuy", {
        tournament_id: tournament.tournament_id,
      });
      toast.success("Rebuy successful!");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Rebuy failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading tournament...</p>
        </div>
      </div>
    );
  }

  const myPlayer = tournament?.players?.[user?.user_id];
  const canRebuy = tournament?.rebuy_available && myPlayer && !myPlayer.is_active && myPlayer.chips === 0;

  return (
    <div className={`min-h-screen bg-gray-950 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`} data-testid="poker-tournament-page">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate("/casino")} className="flex items-center gap-2 hover:text-primary">
            <ChevronLeft className="w-5 h-5" /> Casino
          </button>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-lg hover:bg-gray-800"
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-lg hover:bg-gray-800"
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10">
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-amber-600">{Math.floor(user?.bl_coins || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* Waiting for players */}
        {tournament?.status === "registering" && (
          <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl p-4 mb-4 text-center">
            <p className="text-blue-300">
              Waiting for players... {tournament.player_count}/10 registered
            </p>
            <p className="text-sm text-blue-400 mt-1">
              Tournament will start when 10 players join (or after 30s with minimum players)
            </p>
          </div>
        )}

        {/* Rebuy option */}
        {canRebuy && (
          <div className="bg-purple-600/20 border border-purple-500/30 rounded-xl p-4 mb-4 text-center">
            <p className="text-purple-300 mb-2">You've been eliminated! Want to rebuy?</p>
            <Button onClick={handleRebuy} className="bg-purple-600 hover:bg-purple-700">
              <RefreshCw className="w-4 h-4 mr-2" /> Rebuy ({BUY_IN} BL)
            </Button>
          </div>
        )}

        <div className="grid lg:grid-cols-4 gap-4">
          {/* Main table area */}
          <div className="lg:col-span-3">
            <PokerTable 
              tournament={tournament} 
              userId={user?.user_id}
              onAction={handleAction}
            />
            
            {/* Action panel */}
            <div className="mt-4">
              <ActionPanel
                tournament={tournament}
                userId={user?.user_id}
                onAction={handleAction}
                disabled={actionLoading}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <TournamentInfo tournament={tournament} />
            <ChatPanel 
              messages={tournament?.chat_messages} 
              onSend={handleChat}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

// ============== POKER LOBBY PAGE ==============
export function PokerLobby() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [myTournament, setMyTournament] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tournamentsRes, myTournamentRes] = await Promise.all([
        api.get("/poker/tournaments"),
        api.get("/poker/my-tournament"),
      ]);
      setTournaments(tournamentsRes.data.tournaments || []);
      if (myTournamentRes.data.in_tournament) {
        setMyTournament(myTournamentRes.data.tournament);
      }
    } catch (error) {
      console.error("Failed to load poker data:", error);
    }
    setLoading(false);
  };

  const createTournament = async () => {
    if (user.bl_coins < BUY_IN) {
      toast.error(`Need ${BUY_IN} BL coins to create a tournament`);
      return;
    }
    
    setCreating(true);
    try {
      const response = await api.post("/poker/tournaments/create", { name: "PKO Tournament" });
      const registerResponse = await api.post("/poker/tournaments/register", { 
        tournament_id: response.data.tournament_id 
      });
      navigate(`/poker/${response.data.tournament_id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create tournament");
    }
    setCreating(false);
  };

  const joinTournament = async (tournamentId) => {
    if (user.bl_coins < BUY_IN) {
      toast.error(`Need ${BUY_IN} BL coins to join`);
      return;
    }
    
    try {
      await api.post("/poker/tournaments/register", { tournament_id: tournamentId });
      navigate(`/poker/${tournamentId}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to join tournament");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // If player is in a tournament, redirect
  if (myTournament) {
    return (
      <div className="min-h-screen bg-gray-950">
        <header className="glass sticky top-0 z-40 border-b border-border/50">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <button onClick={() => navigate("/casino")} className="flex items-center gap-2 hover:text-primary">
              <ChevronLeft className="w-5 h-5" /> Casino
            </button>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-8 text-center">
          <div className="bg-green-600/20 border border-green-500/30 rounded-xl p-8">
            <Trophy className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">You're in a Tournament!</h2>
            <p className="text-gray-400 mb-4">
              {myTournament.name} - {myTournament.status}
            </p>
            <Button onClick={() => navigate(`/poker/${myTournament.tournament_id}`)} size="lg">
              Return to Table
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950" data-testid="poker-lobby-page">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <button onClick={() => navigate("/casino")} className="flex items-center gap-2 hover:text-primary">
            <ChevronLeft className="w-5 h-5" /> Casino
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10">
            <Coins className="w-4 h-4 text-amber-500" />
            <span className="font-semibold text-amber-600">{Math.floor(user?.bl_coins || 0).toLocaleString()}</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Hero Banner */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl p-8 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-6xl">🃏</span>
            <div>
              <h1 className="text-3xl font-bold text-white">PKO Poker Tournament</h1>
              <p className="text-white/80">Texas Hold'em Progressive Knockout</p>
              <div className="flex gap-4 mt-2 text-sm text-white/70">
                <span>Buy-in: {BUY_IN} BL</span>
                <span>•</span>
                <span>Bounty: {BOUNTY_AMOUNT} BL</span>
                <span>•</span>
                <span>10 Players</span>
              </div>
            </div>
          </div>
        </div>

        {/* Create Tournament */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Start a New Tournament</h2>
          <div className="flex items-center justify-between">
            <div className="text-gray-400">
              <p>Create a table and wait for players to join.</p>
              <p className="text-sm">1st Place: 65% + Bounties | 2nd Place: 35% + Bounties</p>
            </div>
            <Button 
              onClick={createTournament} 
              disabled={creating || user.bl_coins < BUY_IN}
              size="lg"
              className="bg-gradient-to-r from-amber-500 to-orange-500"
              data-testid="create-tournament-btn"
            >
              {creating ? "Creating..." : `Create Table (${BUY_IN} BL)`}
            </Button>
          </div>
        </div>

        {/* Available Tournaments */}
        <div className="bg-gray-900 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Available Tables</h2>
            <Button variant="ghost" size="sm" onClick={loadData}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>

          {tournaments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No tables available. Create one to get started!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tournaments.map(t => (
                <div 
                  key={t.tournament_id}
                  className="flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-750"
                >
                  <div>
                    <h3 className="font-semibold">{t.name}</h3>
                    <div className="text-sm text-gray-400 flex gap-3">
                      <span>Players: {t.player_count}/{t.max_players}</span>
                      <span>Prize Pool: {t.prize_pool} BL</span>
                    </div>
                  </div>
                  <Button 
                    onClick={() => joinTournament(t.tournament_id)}
                    disabled={user.bl_coins < BUY_IN || t.player_count >= t.max_players}
                  >
                    Join ({BUY_IN} BL)
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How to Play */}
        <div className="bg-gray-900 rounded-xl p-6 mt-6">
          <h2 className="text-xl font-bold mb-4">How to Play</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-400">
            <div>
              <h3 className="font-semibold text-white mb-2">Tournament Rules</h3>
              <ul className="space-y-1">
                <li>• 10 players per table</li>
                <li>• Starting stack: {STARTING_CHIPS} chips</li>
                <li>• Blinds increase every 20 minutes</li>
                <li>• Rebuys allowed in early levels</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-2">Prizes</h3>
              <ul className="space-y-1">
                <li>• 1st Place: 65% of buy-ins + bounties collected</li>
                <li>• 2nd Place: 35% of buy-ins + bounties collected</li>
                <li>• Each elimination = {BOUNTY_AMOUNT} BL bounty</li>
                <li>• Bounties paid from platform (unlimited)</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
