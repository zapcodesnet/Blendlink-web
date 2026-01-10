import React, { useState, useContext, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../App";
import api from "../services/api";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { 
  Coins, Trophy, ChevronLeft, History, BarChart3, 
  Spade, Heart, Diamond, Club, Dice1, CircleDot,
  RotateCcw, Play, Plus, Minus, X, Check
} from "lucide-react";

// Constants
const MIN_BET = 10;
const MAX_BET = 10000;

// ============== SLOT MACHINE COMPONENT ==============
const SlotMachine = ({ user, onBalanceUpdate }) => {
  const [bet, setBet] = useState(100);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState([
    ["🍒", "🍋", "🍊"],
    ["🍇", "🔔", "⭐"],
    ["💎", "7️⃣", "🍒"]
  ]);
  const [result, setResult] = useState(null);
  const [middleRow, setMiddleRow] = useState(["❓", "❓", "❓"]);

  const spin = async () => {
    if (bet < MIN_BET || bet > MAX_BET) {
      toast.error(`Bet must be between ${MIN_BET} and ${MAX_BET} BL`);
      return;
    }
    if (user.bl_coins < bet) {
      toast.error("Insufficient BL Coins!");
      return;
    }

    setSpinning(true);
    setResult(null);

    // Animate reels
    const symbols = ["🍒", "🍋", "🍊", "🍇", "🔔", "⭐", "💎", "7️⃣"];
    let animationCount = 0;
    const interval = setInterval(() => {
      setReels([
        [symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)]],
        [symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)]],
        [symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)], symbols[Math.floor(Math.random() * symbols.length)]]
      ]);
      animationCount++;
      if (animationCount > 15) clearInterval(interval);
    }, 100);

    try {
      const response = await api.casino.spinSlots(bet, 1);
      setTimeout(() => {
        clearInterval(interval);
        setReels(response.reels);
        setMiddleRow(response.middle_row);
        setResult(response);
        onBalanceUpdate(response.balance);
        if (response.winnings > 0) {
          toast.success(`🎰 Won ${response.winnings.toLocaleString()} BL! (${response.multiplier}x)`);
        }
        setSpinning(false);
      }, 1500);
    } catch (error) {
      clearInterval(interval);
      toast.error(error.message);
      setSpinning(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/30">
      <h3 className="text-xl font-bold text-center mb-4 text-purple-300">🎰 Slot Machine</h3>
      
      {/* Reels Display */}
      <div className="bg-black/50 rounded-xl p-4 mb-4">
        <div className="grid grid-cols-3 gap-2">
          {reels.map((reel, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              {reel.map((symbol, j) => (
                <div 
                  key={j} 
                  className={`w-16 h-16 flex items-center justify-center text-3xl rounded-lg ${
                    j === 1 ? 'bg-yellow-500/20 border-2 border-yellow-500' : 'bg-gray-800'
                  } ${spinning ? 'animate-pulse' : ''}`}
                >
                  {symbol}
                </div>
              ))}
            </div>
          ))}
        </div>
        {result && (
          <div className="text-center mt-3 text-sm">
            <span className="text-yellow-400">Middle: </span>
            <span className="font-mono">{middleRow.join(" ")}</span>
            {result.is_jackpot && <span className="ml-2 text-yellow-400 animate-pulse">🎉 JACKPOT!</span>}
          </div>
        )}
      </div>

      {/* Bet Controls */}
      <div className="flex items-center gap-2 mb-4">
        <Button size="sm" variant="outline" onClick={() => setBet(Math.max(MIN_BET, bet - 50))} disabled={spinning}>
          <Minus className="w-4 h-4" />
        </Button>
        <Input 
          type="number" 
          value={bet} 
          onChange={(e) => setBet(Math.min(MAX_BET, Math.max(MIN_BET, parseInt(e.target.value) || MIN_BET)))}
          className="text-center font-mono"
          disabled={spinning}
        />
        <Button size="sm" variant="outline" onClick={() => setBet(Math.min(MAX_BET, bet + 50))} disabled={spinning}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <Button 
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700" 
        onClick={spin} 
        disabled={spinning}
        data-testid="slots-spin-btn"
      >
        {spinning ? "Spinning..." : `Spin (${bet.toLocaleString()} BL)`}
      </Button>

      {result && (
        <div className={`mt-4 text-center p-3 rounded-lg ${result.winnings > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {result.winnings > 0 ? `Won ${result.winnings.toLocaleString()} BL!` : "No win - try again!"}
        </div>
      )}

      {/* Paytable */}
      <div className="mt-4 text-xs text-gray-400">
        <p className="font-semibold mb-1">Payouts:</p>
        <div className="grid grid-cols-2 gap-1">
          <span>7️⃣7️⃣7️⃣ = 500x</span>
          <span>💎💎💎 = 100x</span>
          <span>⭐⭐⭐ = 50x</span>
          <span>🔔🔔🔔 = 25x</span>
        </div>
      </div>
    </div>
  );
};

// ============== BLACKJACK COMPONENT ==============
const Blackjack = ({ user, onBalanceUpdate }) => {
  const [bet, setBet] = useState(100);
  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(false);

  const startGame = async () => {
    if (bet < MIN_BET || bet > MAX_BET) {
      toast.error(`Bet must be between ${MIN_BET} and ${MAX_BET} BL`);
      return;
    }
    if (user.bl_coins < bet) {
      toast.error("Insufficient BL Coins!");
      return;
    }

    setLoading(true);
    try {
      const response = await api.casino.startBlackjack(bet);
      setGameState(response);
      if (response.result) {
        onBalanceUpdate(response.balance);
      }
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  const performAction = async (action) => {
    if (!gameState?.game_id) return;
    setLoading(true);
    try {
      const response = await api.casino.blackjackAction(gameState.game_id, action);
      setGameState(response);
      if (response.result) {
        onBalanceUpdate(response.balance);
        if (response.winnings > 0) {
          toast.success(`Won ${response.winnings.toLocaleString()} BL!`);
        }
      }
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  const getResultMessage = () => {
    if (!gameState?.result) return null;
    const messages = {
      blackjack: "🎉 BLACKJACK! 3:2 Payout!",
      win: "✅ You Win!",
      dealer_bust: "💥 Dealer Bust! You Win!",
      push: "🤝 Push - Bet Returned",
      lose: "❌ Dealer Wins",
      bust: "💥 Bust! Over 21"
    };
    return messages[gameState.result] || gameState.result;
  };

  return (
    <div className="bg-gradient-to-br from-green-900/40 to-emerald-900/40 rounded-2xl p-6 border border-green-500/30">
      <h3 className="text-xl font-bold text-center mb-4 text-green-300">🃏 Blackjack</h3>

      {!gameState ? (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Button size="sm" variant="outline" onClick={() => setBet(Math.max(MIN_BET, bet - 50))}>
              <Minus className="w-4 h-4" />
            </Button>
            <Input 
              type="number" 
              value={bet} 
              onChange={(e) => setBet(Math.min(MAX_BET, Math.max(MIN_BET, parseInt(e.target.value) || MIN_BET)))}
              className="text-center font-mono"
            />
            <Button size="sm" variant="outline" onClick={() => setBet(Math.min(MAX_BET, bet + 50))}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <Button 
            className="w-full bg-gradient-to-r from-green-600 to-emerald-600" 
            onClick={startGame}
            disabled={loading}
            data-testid="blackjack-deal-btn"
          >
            Deal ({bet.toLocaleString()} BL)
          </Button>
        </>
      ) : (
        <>
          {/* Dealer Hand */}
          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-2">Dealer {gameState.dealer_value ? `(${gameState.dealer_value})` : ""}</p>
            <div className="flex gap-2 flex-wrap">
              {(gameState.dealer_hand || gameState.dealer_showing || []).map((card, i) => (
                <div key={i} className="w-14 h-20 bg-white text-black rounded-lg flex items-center justify-center font-bold text-lg shadow-lg">
                  {card}
                </div>
              ))}
              {!gameState.result && gameState.dealer_showing && (
                <div className="w-14 h-20 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🂠</span>
                </div>
              )}
            </div>
          </div>

          {/* Player Hand */}
          <div className="mb-4">
            <p className="text-sm text-gray-400 mb-2">Your Hand ({gameState.player_value})</p>
            <div className="flex gap-2 flex-wrap">
              {(gameState.player_hand || []).map((card, i) => (
                <div key={i} className="w-14 h-20 bg-white text-black rounded-lg flex items-center justify-center font-bold text-lg shadow-lg">
                  {card}
                </div>
              ))}
            </div>
          </div>

          {/* Result or Actions */}
          {gameState.result ? (
            <div className={`text-center p-4 rounded-lg mb-4 ${
              gameState.winnings > gameState.bet ? 'bg-green-500/20 text-green-400' : 
              gameState.winnings === gameState.bet ? 'bg-yellow-500/20 text-yellow-400' : 
              'bg-red-500/20 text-red-400'
            }`}>
              <p className="font-bold text-lg">{getResultMessage()}</p>
              <p className="text-sm mt-1">
                {gameState.winnings > 0 ? `Won: ${gameState.winnings.toLocaleString()} BL` : `Lost: ${gameState.bet.toLocaleString()} BL`}
              </p>
            </div>
          ) : (
            <div className="flex gap-2 mb-4">
              {(gameState.actions || ["hit", "stand"]).map(action => (
                <Button 
                  key={action}
                  onClick={() => performAction(action)}
                  disabled={loading}
                  variant={action === "stand" ? "outline" : "default"}
                  className="flex-1"
                  data-testid={`blackjack-${action}-btn`}
                >
                  {action.charAt(0).toUpperCase() + action.slice(1)}
                </Button>
              ))}
            </div>
          )}

          <Button variant="outline" onClick={() => setGameState(null)} className="w-full" disabled={loading && !gameState.result}>
            <RotateCcw className="w-4 h-4 mr-2" /> New Game
          </Button>
        </>
      )}

      <p className="text-xs text-gray-500 mt-4 text-center">Blackjack pays 3:2 • Dealer stands on 17</p>
    </div>
  );
};

// ============== ROULETTE COMPONENT ==============
const Roulette = ({ user, onBalanceUpdate }) => {
  const [bet, setBet] = useState(50);
  const [betType, setBetType] = useState("red");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);

  const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

  const betOptions = [
    { type: "red", label: "Red", payout: "2x", color: "bg-red-600" },
    { type: "black", label: "Black", payout: "2x", color: "bg-gray-900" },
    { type: "odd", label: "Odd", payout: "2x", color: "bg-purple-600" },
    { type: "even", label: "Even", payout: "2x", color: "bg-blue-600" },
    { type: "1-18", label: "1-18", payout: "2x", color: "bg-amber-600" },
    { type: "19-36", label: "19-36", payout: "2x", color: "bg-teal-600" },
  ];

  const spin = async () => {
    if (user.bl_coins < bet) {
      toast.error("Insufficient BL Coins!");
      return;
    }

    setSpinning(true);
    setResult(null);

    try {
      const response = await api.casino.spinRoulette([
        { amount: bet, bet_type: betType, bet_value: null }
      ]);
      
      setTimeout(() => {
        setResult(response);
        onBalanceUpdate(response.balance);
        if (response.total_winnings > 0) {
          toast.success(`🎰 Won ${response.total_winnings.toLocaleString()} BL!`);
        }
        setSpinning(false);
      }, 2000);
    } catch (error) {
      toast.error(error.message);
      setSpinning(false);
    }
  };

  const getNumberColor = (num) => {
    if (num === 0) return "green";
    return RED_NUMBERS.includes(num) ? "red" : "black";
  };

  return (
    <div className="bg-gradient-to-br from-amber-900/40 to-orange-900/40 rounded-2xl p-6 border border-amber-500/30">
      <h3 className="text-xl font-bold text-center mb-4 text-amber-300">🎡 Roulette</h3>

      {/* Roulette Wheel Display */}
      <div className="relative w-32 h-32 mx-auto mb-4">
        <div className={`w-full h-full rounded-full bg-gradient-to-br from-green-800 to-green-950 border-4 border-amber-500 flex items-center justify-center ${spinning ? 'animate-spin' : ''}`}>
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center">
            <span className="text-3xl font-bold">
              {result ? result.result_number : "?"}
            </span>
          </div>
        </div>
      </div>

      {result && (
        <div className={`text-center mb-4 p-3 rounded-lg ${
          result.total_winnings > 0 ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          <p className="font-bold">
            <span className={`inline-block w-6 h-6 rounded-full mr-2 ${
              result.result_color === "red" ? "bg-red-600" : 
              result.result_color === "black" ? "bg-gray-900" : "bg-green-600"
            }`}></span>
            {result.result_number} {result.result_color.toUpperCase()}
          </p>
          <p className={result.total_winnings > 0 ? "text-green-400" : "text-red-400"}>
            {result.total_winnings > 0 ? `Won ${result.total_winnings.toLocaleString()} BL!` : "No win"}
          </p>
        </div>
      )}

      {/* Bet Type Selection */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {betOptions.map(option => (
          <button
            key={option.type}
            onClick={() => setBetType(option.type)}
            className={`p-2 rounded-lg text-sm font-semibold transition-all ${
              betType === option.type 
                ? `${option.color} ring-2 ring-white` 
                : `${option.color}/50 hover:${option.color}/70`
            }`}
          >
            {option.label}
            <span className="block text-xs opacity-70">{option.payout}</span>
          </button>
        ))}
      </div>

      {/* Bet Amount */}
      <div className="flex items-center gap-2 mb-4">
        <Button size="sm" variant="outline" onClick={() => setBet(Math.max(MIN_BET, bet - 25))}>
          <Minus className="w-4 h-4" />
        </Button>
        <Input 
          type="number" 
          value={bet} 
          onChange={(e) => setBet(Math.min(MAX_BET, Math.max(MIN_BET, parseInt(e.target.value) || MIN_BET)))}
          className="text-center font-mono"
        />
        <Button size="sm" variant="outline" onClick={() => setBet(Math.min(MAX_BET, bet + 25))}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <Button 
        className="w-full bg-gradient-to-r from-amber-600 to-orange-600"
        onClick={spin}
        disabled={spinning}
        data-testid="roulette-spin-btn"
      >
        {spinning ? "Spinning..." : `Spin (${bet.toLocaleString()} BL on ${betType})`}
      </Button>
    </div>
  );
};

// ============== WHEEL OF FORTUNE COMPONENT ==============
const WheelOfFortune = ({ user, onBalanceUpdate }) => {
  const [bet, setBet] = useState(50);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [rotation, setRotation] = useState(0);

  const segments = [
    { multiplier: 0, label: "LOSE", color: "#1a1a2e" },
    { multiplier: 1, label: "1x", color: "#16213e" },
    { multiplier: 2, label: "2x", color: "#0f3460" },
    { multiplier: 3, label: "3x", color: "#533483" },
    { multiplier: 5, label: "5x", color: "#e94560" },
    { multiplier: 10, label: "10x", color: "#f39c12" },
    { multiplier: 20, label: "20x", color: "#27ae60" },
    { multiplier: 50, label: "JACKPOT", color: "#f1c40f" },
  ];

  const spin = async () => {
    if (user.bl_coins < bet) {
      toast.error("Insufficient BL Coins!");
      return;
    }

    setSpinning(true);
    setResult(null);

    try {
      const response = await api.casino.spinWheel(bet);
      
      // Calculate rotation to land on the result
      const segmentIndex = segments.findIndex(s => s.multiplier === response.multiplier);
      const segmentAngle = 360 / segments.length;
      const targetRotation = rotation + 1440 + (segmentIndex * segmentAngle) + (segmentAngle / 2);
      setRotation(targetRotation);

      setTimeout(() => {
        setResult(response);
        onBalanceUpdate(response.balance);
        if (response.winnings > 0) {
          toast.success(`🎡 Won ${response.winnings.toLocaleString()} BL! (${response.multiplier}x)`);
        }
        setSpinning(false);
      }, 3000);
    } catch (error) {
      toast.error(error.message);
      setSpinning(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-indigo-900/40 to-violet-900/40 rounded-2xl p-6 border border-indigo-500/30">
      <h3 className="text-xl font-bold text-center mb-4 text-indigo-300">🎡 Wheel of Fortune</h3>

      {/* Wheel Display */}
      <div className="relative w-48 h-48 mx-auto mb-4">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
          <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-yellow-400"></div>
        </div>
        
        {/* Wheel */}
        <div 
          className="w-full h-full rounded-full border-4 border-yellow-500 overflow-hidden transition-transform duration-[3000ms] ease-out"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {segments.map((seg, i) => {
              const angle = 360 / segments.length;
              const startAngle = i * angle - 90;
              const endAngle = startAngle + angle;
              const start = {
                x: 50 + 50 * Math.cos(Math.PI * startAngle / 180),
                y: 50 + 50 * Math.sin(Math.PI * startAngle / 180)
              };
              const end = {
                x: 50 + 50 * Math.cos(Math.PI * endAngle / 180),
                y: 50 + 50 * Math.sin(Math.PI * endAngle / 180)
              };
              const largeArc = angle > 180 ? 1 : 0;
              return (
                <path
                  key={i}
                  d={`M 50 50 L ${start.x} ${start.y} A 50 50 0 ${largeArc} 1 ${end.x} ${end.y} Z`}
                  fill={seg.color}
                  stroke="#333"
                  strokeWidth="0.5"
                />
              );
            })}
            {/* Center */}
            <circle cx="50" cy="50" r="15" fill="#1a1a2e" stroke="#f1c40f" strokeWidth="2" />
          </svg>
        </div>
      </div>

      {result && (
        <div className={`text-center mb-4 p-3 rounded-lg ${
          result.winnings > 0 ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          <p className="font-bold text-lg">{result.segment.label}</p>
          <p className={result.winnings > 0 ? "text-green-400" : "text-red-400"}>
            {result.winnings > 0 ? `Won ${result.winnings.toLocaleString()} BL!` : "No win - try again!"}
          </p>
          {result.is_jackpot && <p className="text-yellow-400 animate-pulse">🎉 JACKPOT! 🎉</p>}
        </div>
      )}

      {/* Bet Controls */}
      <div className="flex items-center gap-2 mb-4">
        <Button size="sm" variant="outline" onClick={() => setBet(Math.max(MIN_BET, bet - 25))}>
          <Minus className="w-4 h-4" />
        </Button>
        <Input 
          type="number" 
          value={bet} 
          onChange={(e) => setBet(Math.min(MAX_BET, Math.max(MIN_BET, parseInt(e.target.value) || MIN_BET)))}
          className="text-center font-mono"
        />
        <Button size="sm" variant="outline" onClick={() => setBet(Math.min(MAX_BET, bet + 25))}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <Button 
        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600"
        onClick={spin}
        disabled={spinning}
        data-testid="wheel-spin-btn"
      >
        {spinning ? "Spinning..." : `Spin (${bet.toLocaleString()} BL)`}
      </Button>
    </div>
  );
};

// ============== VIDEO POKER COMPONENT ==============
const VideoPoker = ({ user, onBalanceUpdate }) => {
  const [bet, setBet] = useState(100);
  const [gameState, setGameState] = useState(null);
  const [held, setHeld] = useState([]);
  const [loading, setLoading] = useState(false);

  const deal = async () => {
    if (user.bl_coins < bet) {
      toast.error("Insufficient BL Coins!");
      return;
    }

    setLoading(true);
    setHeld([]);
    try {
      const response = await api.casino.dealPoker(bet);
      setGameState(response);
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  const draw = async () => {
    if (!gameState?.game_id) return;
    setLoading(true);
    try {
      const response = await api.casino.drawPoker(gameState.game_id, held);
      setGameState(response);
      onBalanceUpdate(response.balance);
      if (response.winnings > 0) {
        toast.success(`${response.hand_name}! Won ${response.winnings.toLocaleString()} BL!`);
      }
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  const toggleHold = (index) => {
    if (gameState?.hand_name) return; // Game ended
    setHeld(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="bg-gradient-to-br from-blue-900/40 to-cyan-900/40 rounded-2xl p-6 border border-blue-500/30">
      <h3 className="text-xl font-bold text-center mb-4 text-blue-300">🃏 Video Poker</h3>

      {/* Cards Display */}
      {gameState && (
        <div className="flex gap-2 justify-center mb-4 flex-wrap">
          {(gameState.hand || []).map((card, i) => (
            <button
              key={i}
              onClick={() => toggleHold(i)}
              disabled={!!gameState.hand_name}
              className={`relative w-14 h-20 bg-white text-black rounded-lg flex items-center justify-center font-bold text-lg shadow-lg transition-all ${
                held.includes(i) ? 'ring-4 ring-yellow-400 -translate-y-2' : ''
              }`}
            >
              {card}
              {held.includes(i) && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-xs px-2 rounded">
                  HOLD
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {gameState?.hand_name && (
        <div className={`text-center mb-4 p-3 rounded-lg ${
          gameState.winnings > 0 ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          <p className="font-bold text-lg">{gameState.hand_name}</p>
          <p className={gameState.winnings > 0 ? "text-green-400" : "text-red-400"}>
            {gameState.winnings > 0 ? `Won ${gameState.winnings.toLocaleString()} BL (${gameState.multiplier}x)` : "No winning hand"}
          </p>
        </div>
      )}

      {!gameState ? (
        <>
          <div className="flex items-center gap-2 mb-4">
            <Button size="sm" variant="outline" onClick={() => setBet(Math.max(MIN_BET, bet - 50))}>
              <Minus className="w-4 h-4" />
            </Button>
            <Input 
              type="number" 
              value={bet} 
              onChange={(e) => setBet(Math.min(MAX_BET, Math.max(MIN_BET, parseInt(e.target.value) || MIN_BET)))}
              className="text-center font-mono"
            />
            <Button size="sm" variant="outline" onClick={() => setBet(Math.min(MAX_BET, bet + 50))}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <Button 
            className="w-full bg-gradient-to-r from-blue-600 to-cyan-600"
            onClick={deal}
            disabled={loading}
            data-testid="poker-deal-btn"
          >
            Deal ({bet.toLocaleString()} BL)
          </Button>
        </>
      ) : !gameState.hand_name ? (
        <Button 
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600"
          onClick={draw}
          disabled={loading}
          data-testid="poker-draw-btn"
        >
          Draw ({held.length} held)
        </Button>
      ) : (
        <Button variant="outline" className="w-full" onClick={() => setGameState(null)}>
          <RotateCcw className="w-4 h-4 mr-2" /> New Game
        </Button>
      )}

      {/* Paytable */}
      <div className="mt-4 text-xs text-gray-400">
        <p className="font-semibold mb-1">Payouts:</p>
        <div className="grid grid-cols-2 gap-1">
          <span>Royal Flush: 800x</span>
          <span>Straight Flush: 50x</span>
          <span>4 of a Kind: 25x</span>
          <span>Full House: 9x</span>
          <span>Flush: 6x</span>
          <span>Jacks or Better: 1x</span>
        </div>
      </div>
    </div>
  );
};

// ============== BACCARAT COMPONENT ==============
const Baccarat = ({ user, onBalanceUpdate }) => {
  const [bet, setBet] = useState(100);
  const [betOn, setBetOn] = useState("player");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const play = async () => {
    if (user.bl_coins < bet) {
      toast.error("Insufficient BL Coins!");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await api.casino.playBaccarat(bet, betOn);
      setResult(response);
      onBalanceUpdate(response.balance);
      if (response.winnings > 0) {
        toast.success(`Won ${response.winnings.toLocaleString()} BL!`);
      }
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-rose-900/40 to-pink-900/40 rounded-2xl p-6 border border-rose-500/30">
      <h3 className="text-xl font-bold text-center mb-4 text-rose-300">🎴 Baccarat</h3>

      {result && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-2">Player ({result.player_value})</p>
              <div className="flex gap-1 justify-center flex-wrap">
                {result.player_hand.map((card, i) => (
                  <div key={i} className="w-10 h-14 bg-white text-black rounded flex items-center justify-center font-bold text-sm">
                    {card}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-400 mb-2">Banker ({result.banker_value})</p>
              <div className="flex gap-1 justify-center flex-wrap">
                {result.banker_hand.map((card, i) => (
                  <div key={i} className="w-10 h-14 bg-white text-black rounded flex items-center justify-center font-bold text-sm">
                    {card}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={`text-center p-3 rounded-lg mb-4 ${
            result.winnings > 0 ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            <p className="font-bold">{result.winner.toUpperCase()} WINS!</p>
            <p className={result.winnings > 0 ? "text-green-400" : "text-red-400"}>
              {result.winnings > 0 ? `Won ${result.winnings.toLocaleString()} BL` : `Lost ${bet.toLocaleString()} BL`}
            </p>
          </div>
        </>
      )}

      {/* Bet Selection */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {["player", "banker", "tie"].map(option => (
          <button
            key={option}
            onClick={() => setBetOn(option)}
            className={`p-3 rounded-lg font-semibold transition-all ${
              betOn === option 
                ? 'bg-rose-600 ring-2 ring-white' 
                : 'bg-rose-600/30 hover:bg-rose-600/50'
            }`}
          >
            {option.charAt(0).toUpperCase() + option.slice(1)}
            <span className="block text-xs opacity-70">
              {option === "player" ? "2x" : option === "banker" ? "1.95x" : "9x"}
            </span>
          </button>
        ))}
      </div>

      {/* Bet Amount */}
      <div className="flex items-center gap-2 mb-4">
        <Button size="sm" variant="outline" onClick={() => setBet(Math.max(MIN_BET, bet - 50))}>
          <Minus className="w-4 h-4" />
        </Button>
        <Input 
          type="number" 
          value={bet} 
          onChange={(e) => setBet(Math.min(MAX_BET, Math.max(MIN_BET, parseInt(e.target.value) || MIN_BET)))}
          className="text-center font-mono"
        />
        <Button size="sm" variant="outline" onClick={() => setBet(Math.min(MAX_BET, bet + 50))}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <Button 
        className="w-full bg-gradient-to-r from-rose-600 to-pink-600"
        onClick={play}
        disabled={loading}
        data-testid="baccarat-play-btn"
      >
        {loading ? "Dealing..." : `Play (${bet.toLocaleString()} BL on ${betOn})`}
      </Button>
    </div>
  );
};

// ============== CRAPS COMPONENT ==============
const Craps = ({ user, onBalanceUpdate }) => {
  const [bet, setBet] = useState(50);
  const [betType, setBetType] = useState("pass");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const betOptions = [
    { type: "pass", label: "Pass Line", desc: "7/11 wins, 2/3/12 loses" },
    { type: "dont_pass", label: "Don't Pass", desc: "2/3 wins, 7/11 loses" },
    { type: "field", label: "Field", desc: "3,4,9,10,11 pays 1:1" },
    { type: "any_seven", label: "Any 7", desc: "4:1 payout" },
    { type: "any_craps", label: "Any Craps", desc: "7:1 on 2,3,12" },
  ];

  const roll = async () => {
    if (user.bl_coins < bet) {
      toast.error("Insufficient BL Coins!");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await api.casino.rollCraps(bet, betType);
      setResult(response);
      onBalanceUpdate(response.balance);
      if (response.winnings > 0) {
        toast.success(`🎲 ${response.result}! Won ${response.winnings.toLocaleString()} BL!`);
      }
    } catch (error) {
      toast.error(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="bg-gradient-to-br from-red-900/40 to-orange-900/40 rounded-2xl p-6 border border-red-500/30">
      <h3 className="text-xl font-bold text-center mb-4 text-red-300">🎲 Craps</h3>

      {/* Dice Display */}
      {result && (
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-4xl shadow-lg">
            {["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][result.dice[0] - 1]}
          </div>
          <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center text-4xl shadow-lg">
            {["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][result.dice[1] - 1]}
          </div>
          <div className="text-2xl font-bold text-yellow-400">= {result.total}</div>
        </div>
      )}

      {result && (
        <div className={`text-center p-3 rounded-lg mb-4 ${
          result.winnings > 0 ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          <p className="font-bold">{result.result}</p>
          <p className={result.winnings > 0 ? "text-green-400" : "text-red-400"}>
            {result.winnings > 0 ? `Won ${result.winnings.toLocaleString()} BL` : "No win"}
          </p>
        </div>
      )}

      {/* Bet Type Selection */}
      <div className="space-y-2 mb-4">
        {betOptions.map(option => (
          <button
            key={option.type}
            onClick={() => setBetType(option.type)}
            className={`w-full p-3 rounded-lg text-left transition-all ${
              betType === option.type 
                ? 'bg-red-600 ring-2 ring-white' 
                : 'bg-red-600/30 hover:bg-red-600/50'
            }`}
          >
            <span className="font-semibold">{option.label}</span>
            <span className="block text-xs opacity-70">{option.desc}</span>
          </button>
        ))}
      </div>

      {/* Bet Amount */}
      <div className="flex items-center gap-2 mb-4">
        <Button size="sm" variant="outline" onClick={() => setBet(Math.max(MIN_BET, bet - 25))}>
          <Minus className="w-4 h-4" />
        </Button>
        <Input 
          type="number" 
          value={bet} 
          onChange={(e) => setBet(Math.min(MAX_BET, Math.max(MIN_BET, parseInt(e.target.value) || MIN_BET)))}
          className="text-center font-mono"
        />
        <Button size="sm" variant="outline" onClick={() => setBet(Math.min(MAX_BET, bet + 25))}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      <Button 
        className="w-full bg-gradient-to-r from-red-600 to-orange-600"
        onClick={roll}
        disabled={loading}
        data-testid="craps-roll-btn"
      >
        {loading ? "Rolling..." : `Roll Dice (${bet.toLocaleString()} BL)`}
      </Button>
    </div>
  );
};

// ============== DAILY SPIN COMPONENT WITH STREAK ==============
const DailySpin = ({ user, onBalanceUpdate }) => {
  const [status, setStatus] = useState(null);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);

  const REWARDS = [1000, 5000, 15000, 35000, 80000, 200000];
  const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#a855f7"];

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const data = await api.casino.getDailySpinStatus();
      setStatus(data);
    } catch (error) {
      console.error("Failed to load daily spin status:", error);
    }
    setLoading(false);
  };

  const spin = async () => {
    if (!status?.can_spin) {
      toast.error("Already claimed today! Come back tomorrow.");
      return;
    }

    setSpinning(true);
    setResult(null);

    try {
      const response = await api.casino.claimDailySpin();
      
      // Calculate rotation to land on the reward
      const segmentAngle = 360 / REWARDS.length;
      const targetRotation = rotation + 1800 + (response.reward_index * segmentAngle) + (segmentAngle / 2);
      setRotation(targetRotation);

      setTimeout(() => {
        setResult(response);
        onBalanceUpdate(response.new_balance);
        toast.success(`🎉 ${response.message}`);
        setStatus({ ...status, can_spin: false, streak: response.streak });
        setSpinning(false);
      }, 4000);
    } catch (error) {
      toast.error(error.message || "Failed to spin");
      setSpinning(false);
    }
  };

  const getStreakEmoji = (streak) => {
    if (streak >= 10) return "🔥🔥🔥";
    if (streak >= 7) return "🔥🔥";
    if (streak >= 3) return "🔥";
    return "⭐";
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-yellow-900/40 to-amber-900/40 rounded-2xl p-6 border border-yellow-500/30 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const streak = status?.streak || { current: 0, multiplier: 1.0, next_multiplier: 1.2, max_multiplier: 3.0 };

  return (
    <div className="bg-gradient-to-br from-yellow-900/40 to-amber-900/40 rounded-2xl p-6 border border-yellow-500/30">
      <h3 className="text-xl font-bold text-center mb-2 text-yellow-300">🎁 Daily Bonus Spin</h3>
      <p className="text-center text-sm text-yellow-200/70 mb-2">One FREE spin every day!</p>

      {/* Streak Display */}
      <div className="bg-gradient-to-r from-orange-600/30 to-red-600/30 rounded-xl p-4 mb-4 border border-orange-500/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getStreakEmoji(streak.current)}</span>
              <div>
                <p className="text-sm text-orange-200">Current Streak</p>
                <p className="text-xl font-bold text-white">{streak.current} Day{streak.current !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-orange-200">Multiplier</p>
            <p className="text-2xl font-bold text-yellow-400">{streak.multiplier?.toFixed(1)}x</p>
            {streak.multiplier < streak.max_multiplier && (
              <p className="text-xs text-orange-300">Next: {streak.next_multiplier?.toFixed(1)}x</p>
            )}
            {streak.multiplier >= streak.max_multiplier && (
              <p className="text-xs text-green-400">MAX!</p>
            )}
          </div>
        </div>
        {streak.current > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-orange-300 mb-1">
              <span>Progress to 3.0x</span>
              <span>{Math.min(100, ((streak.multiplier - 1) / 2) * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-black/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all duration-500"
                style={{ width: `${Math.min(100, ((streak.multiplier - 1) / 2) * 100)}%` }}
              />
            </div>
          </div>
        )}
        {!status?.can_spin && streak.current > 0 && (
          <p className="text-center text-xs text-orange-300 mt-2">
            🔥 Don't break your streak! Come back tomorrow.
          </p>
        )}
      </div>

      {/* Wheel */}
      <div className="relative w-64 h-64 mx-auto mb-6">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
          <div className="w-0 h-0 border-l-[16px] border-r-[16px] border-t-[28px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-lg"></div>
        </div>
        
        {/* Wheel SVG */}
        <div 
          className="w-full h-full rounded-full border-8 border-yellow-500 overflow-hidden shadow-2xl transition-transform duration-[4000ms] ease-out"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            {REWARDS.map((reward, i) => {
              const angle = 360 / REWARDS.length;
              const startAngle = i * angle - 90;
              const endAngle = startAngle + angle;
              const midAngle = startAngle + angle / 2;
              const start = {
                x: 50 + 50 * Math.cos(Math.PI * startAngle / 180),
                y: 50 + 50 * Math.sin(Math.PI * startAngle / 180)
              };
              const end = {
                x: 50 + 50 * Math.cos(Math.PI * endAngle / 180),
                y: 50 + 50 * Math.sin(Math.PI * endAngle / 180)
              };
              const textPos = {
                x: 50 + 30 * Math.cos(Math.PI * midAngle / 180),
                y: 50 + 30 * Math.sin(Math.PI * midAngle / 180)
              };
              return (
                <g key={i}>
                  <path
                    d={`M 50 50 L ${start.x} ${start.y} A 50 50 0 0 1 ${end.x} ${end.y} Z`}
                    fill={COLORS[i]}
                    stroke="#1a1a2e"
                    strokeWidth="0.5"
                  />
                  <text
                    x={textPos.x}
                    y={textPos.y}
                    fill="white"
                    fontSize="6"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${midAngle + 90}, ${textPos.x}, ${textPos.y})`}
                  >
                    {reward >= 1000 ? `${reward/1000}K` : reward}
                  </text>
                </g>
              );
            })}
            {/* Center */}
            <circle cx="50" cy="50" r="12" fill="#1a1a2e" stroke="#f1c40f" strokeWidth="3" />
            <text x="50" y="50" fill="#f1c40f" fontSize="6" fontWeight="bold" textAnchor="middle" dominantBaseline="middle">FREE</text>
          </svg>
        </div>

        {/* Decorative lights */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`absolute w-3 h-3 rounded-full ${spinning ? 'animate-pulse' : ''}`}
              style={{
                left: `${50 + 45 * Math.cos(2 * Math.PI * i / 12 - Math.PI / 2)}%`,
                top: `${50 + 45 * Math.sin(2 * Math.PI * i / 12 - Math.PI / 2)}%`,
                backgroundColor: i % 2 === 0 ? '#fbbf24' : '#f97316',
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 0 10px currentColor'
              }}
            />
          ))}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="text-center mb-4 p-4 rounded-xl bg-green-500/20 border border-green-500/50">
          <p className="text-2xl font-bold text-green-400">🎉 {result.reward.toLocaleString()} BL!</p>
          {result.streak?.bonus && (
            <p className="text-sm text-yellow-400 mt-1">Streak Bonus: {result.streak.bonus}</p>
          )}
          <p className="text-sm text-green-300 mt-1">Added to your balance</p>
        </div>
      )}

      {/* Spin Button */}
      <Button 
        className={`w-full text-lg py-6 ${
          status?.can_spin 
            ? 'bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700' 
            : 'bg-gray-600 cursor-not-allowed'
        }`}
        onClick={spin}
        disabled={spinning || !status?.can_spin}
        data-testid="daily-spin-btn"
      >
        {spinning ? (
          <span className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 animate-spin" /> Spinning...
          </span>
        ) : status?.can_spin ? (
          <span>🎁 Claim Free Spin! {streak.multiplier > 1 ? `(${streak.multiplier.toFixed(1)}x)` : ''}</span>
        ) : (
          "Come Back Tomorrow!"
        )}
      </Button>

      {!status?.can_spin && status?.next_spin_time && (
        <p className="text-center text-xs text-yellow-200/60 mt-3">
          Next spin available at midnight UTC
        </p>
      )}

      {/* Rewards Preview with Multiplier */}
      <div className="mt-6">
        <p className="text-xs text-center text-yellow-300 mb-2">
          Base Rewards {streak.multiplier > 1 ? `× ${streak.multiplier.toFixed(1)} streak bonus` : ''}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {REWARDS.map((reward, i) => (
            <div 
              key={i} 
              className="text-center p-2 rounded-lg"
              style={{ backgroundColor: `${COLORS[i]}30` }}
            >
              <span className="text-xs font-bold" style={{ color: COLORS[i] }}>
                {streak.multiplier > 1 
                  ? Math.floor(reward * streak.multiplier).toLocaleString()
                  : reward.toLocaleString()
                }
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Streak Info */}
      <div className="mt-4 text-center text-xs text-yellow-200/60">
        <p>🔥 Spin daily to build your streak! Max 3.0x at Day 11+</p>
      </div>
    </div>
  );
};

// ============== STATS/HISTORY COMPONENT ==============
const CasinoStats = ({ user }) => {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [statsData, historyData] = await Promise.all([
          api.casino.getStats(),
          api.casino.getHistory(20)
        ]);
        setStats(statsData);
        setHistory(historyData.history || []);
      } catch (error) {
        console.error("Failed to load casino data:", error);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Stats */}
      {stats && (
        <div className="bg-card rounded-2xl p-6 border border-border/50">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Your Casino Stats
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted rounded-xl">
              <p className="text-2xl font-bold">{stats.totals.games_played}</p>
              <p className="text-sm text-muted-foreground">Games Played</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-xl">
              <p className="text-2xl font-bold">{stats.totals.total_bets.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Wagered</p>
            </div>
            <div className="text-center p-3 bg-muted rounded-xl">
              <p className="text-2xl font-bold">{stats.totals.total_won.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Won</p>
            </div>
            <div className={`text-center p-3 rounded-xl ${stats.totals.net_profit >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              <p className={`text-2xl font-bold ${stats.totals.net_profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.totals.net_profit >= 0 ? '+' : ''}{stats.totals.net_profit.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Net Profit</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Games */}
      <div className="bg-card rounded-2xl p-6 border border-border/50">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-primary" /> Recent Games
        </h3>
        {history.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No games played yet. Try your luck!</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {history.map((game, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <span className="font-medium capitalize">{game.game_type.replace("_", " ")}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {new Date(game.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-sm text-muted-foreground">Bet: {game.bet_amount}</span>
                  <span className={`ml-3 font-bold ${game.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {game.profit >= 0 ? '+' : ''}{game.profit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============== MAIN CASINO PAGE ==============
export default function Casino() {
  const { user, setUser } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeGame, setActiveGame] = useState(null);
  const [showStats, setShowStats] = useState(false);

  const updateBalance = useCallback((newBalance) => {
    setUser({ ...user, bl_coins: newBalance });
  }, [user, setUser]);

  const games = [
    { id: "daily", name: "Daily Spin", icon: "🎁", color: "from-yellow-500 to-amber-600", desc: "FREE spin every day!" },
    { id: "slots", name: "Slots", icon: "🎰", color: "from-purple-600 to-pink-600", desc: "Spin to win up to 500x!" },
    { id: "blackjack", name: "Blackjack", icon: "🃏", color: "from-green-600 to-emerald-600", desc: "Beat the dealer to 21" },
    { id: "roulette", name: "Roulette", icon: "🎡", color: "from-amber-600 to-orange-600", desc: "Red, black, or lucky number" },
    { id: "wheel", name: "Wheel", icon: "🎡", color: "from-indigo-600 to-violet-600", desc: "Spin for up to 50x jackpot" },
    { id: "poker", name: "Video Poker", icon: "🃏", color: "from-blue-600 to-cyan-600", desc: "Jacks or better to win" },
    { id: "baccarat", name: "Baccarat", icon: "🎴", color: "from-rose-600 to-pink-600", desc: "Player, banker, or tie" },
    { id: "craps", name: "Craps", icon: "🎲", color: "from-red-600 to-orange-600", desc: "Roll the dice!" },
  ];

  if (showStats) {
    return (
      <div className="min-h-screen bg-background">
        <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
          <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
            <button onClick={() => setShowStats(false)} className="flex items-center gap-2 hover:text-primary">
              <ChevronLeft className="w-5 h-5" /> Back to Casino
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10">
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-amber-600">{Math.floor(user?.bl_coins || 0).toLocaleString()}</span>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-4 py-6">
          <CasinoStats user={user} />
        </main>
      </div>
    );
  }

  if (activeGame) {
    const GameComponent = {
      daily: DailySpin,
      slots: SlotMachine,
      blackjack: Blackjack,
      roulette: Roulette,
      wheel: WheelOfFortune,
      poker: VideoPoker,
      baccarat: Baccarat,
      craps: Craps,
    }[activeGame];

    return (
      <div className="min-h-screen bg-background">
        <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <button onClick={() => setActiveGame(null)} className="flex items-center gap-2 hover:text-primary">
              <ChevronLeft className="w-5 h-5" /> Back
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10">
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-amber-600">{Math.floor(user?.bl_coins || 0).toLocaleString()}</span>
            </div>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-6">
          <GameComponent user={user} onBalanceUpdate={updateBalance} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="casino-page">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-border/50 safe-top">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            🎰 Casino
          </h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowStats(true)}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              data-testid="casino-stats-btn"
            >
              <BarChart3 className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10">
              <Coins className="w-4 h-4 text-amber-500" />
              <span className="font-semibold text-amber-600">{Math.floor(user?.bl_coins || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Balance Card */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-6 text-white mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">Your Balance</p>
              <p className="text-3xl font-bold">{Math.floor(user?.bl_coins || 0).toLocaleString()} BL</p>
              <p className="text-sm text-white/70 mt-1">Min: {MIN_BET} BL • Max: {MAX_BET.toLocaleString()} BL</p>
            </div>
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-4xl">🎰</span>
            </div>
          </div>
        </div>

        {/* Games Grid */}
        <h2 className="font-semibold text-lg mb-4">Choose Your Game</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => setActiveGame(game.id)}
              className={`bg-gradient-to-br ${game.color} rounded-2xl p-4 text-white text-left hover:scale-105 transition-transform shadow-lg`}
              data-testid={`game-${game.id}-btn`}
            >
              <span className="text-4xl mb-2 block">{game.icon}</span>
              <h3 className="font-bold text-lg">{game.name}</h3>
              <p className="text-xs text-white/80 mt-1">{game.desc}</p>
            </button>
          ))}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-card rounded-2xl p-6 border border-border/50">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" /> How It Works
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5" />
              All games use provably fair random number generation
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5" />
              Bet between {MIN_BET} and {MAX_BET.toLocaleString()} BL Coins per game
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5" />
              Winnings are instantly credited to your balance
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-4 h-4 text-green-500 mt-0.5" />
              Track your history and stats anytime
            </li>
          </ul>
        </div>

        {/* Link to old games */}
        <div className="mt-6 text-center">
          <button 
            onClick={() => navigate("/games")}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Looking for Memory Match? → Go to Mini Games
          </button>
        </div>
      </main>
    </div>
  );
}
