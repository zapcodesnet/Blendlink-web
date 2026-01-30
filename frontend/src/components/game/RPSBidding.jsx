/**
 * RPSBidding Component - Rock Paper Scissors Bidding Battle
 * 
 * EXACTLY implements user's specifications for Rounds 2, 4:
 * - $5,000,000 starting money
 * - $1,000,000 minimum bid per choice
 * - Quick buttons ($1M, $2M, $3M, $4M, $5M) - NO slider
 * - Real object graphics (NOT hand signs)
 * - 10-second countdown to round start
 * - 5 seconds to choose + set bid
 * - If tie RPS -> highest bid wins
 * - Warning on $5M selection about potential auto-loss
 * - Out of money = auto-loss for remaining RPS rounds
 * - Dramatic reveal animation
 * - Win/Lose streak indicators on photos
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, DollarSign, Loader2, Trophy, Skull, Flame, Shield } from 'lucide-react';
import { toast } from 'sonner';
import auctionSounds from '../../utils/auctionSounds';
import { StreakIndicator } from './StreakIndicator';

// Constants from user spec
const STARTING_MONEY = 5_000_000;
const MIN_BID = 1_000_000;
const MAX_BID = 5_000_000;
const ADVANTAGE_BONUS = 1_000_000; // $1M bonus for higher Dollar Value
const BID_OPTIONS = [1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000];
const BID_OPTIONS_WITH_ADVANTAGE = [1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000, 6_000_000]; // $6M when player has advantage
const COUNTDOWN_SECONDS = 10;
const CHOICE_TIMEOUT_SECONDS = 5;

// RPS choices with REAL OBJECT IMAGES (not hand signs as per spec)
const RPS_CHOICES = [
  { 
    id: 'rock', 
    name: 'Rock', 
    emoji: '🪨',
    beats: 'scissors',
    losesTo: 'paper',
    color: 'from-gray-500 to-gray-700',
    animation: 'smash', // Rock smashes scissors
  },
  { 
    id: 'paper', 
    name: 'Paper', 
    emoji: '📄',
    beats: 'rock',
    losesTo: 'scissors',
    color: 'from-blue-400 to-blue-600',
    animation: 'cover', // Paper covers rock
  },
  { 
    id: 'scissors', 
    name: 'Scissors', 
    emoji: '✂️',
    beats: 'paper',
    losesTo: 'rock',
    color: 'from-amber-400 to-amber-600',
    animation: 'cut', // Scissors cut paper
  },
];

// Format money
const formatMoney = (value) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  return `$${value.toLocaleString()}`;
};

// Scenery config
const SCENERY_CONFIG = {
  natural: { name: 'Natural', icon: '🌿', strong: 'water', weak: 'manmade' },
  water: { name: 'Water', icon: '🌊', strong: 'manmade', weak: 'natural' },
  manmade: { name: 'Man-made', icon: '🏙️', strong: 'natural', weak: 'water' },
  neutral: { name: 'Neutral', icon: '⬜', strong: null, weak: 'all' },
};

// Win streak multipliers
const WIN_STREAK_MULTIPLIERS = {
  3: 1.25, 4: 1.50, 5: 1.75, 6: 2.00, 7: 2.25, 8: 2.50, 9: 2.75, 10: 3.00
};

// Strength/Weakness multipliers
const STRENGTH_MULTIPLIER = 1.25;
const WEAKNESS_MULTIPLIER = 0.75;

/**
 * Calculate effective dollar value for a photo in battle
 * Mirrors the backend calculate_photo_battle_value function
 */
const calculateEffectiveValue = (photo, opponentPhoto, playerStats = {}) => {
  const baseValue = photo?.dollar_value || 1_000_000;
  const modifiers = [];
  
  let sceneryModifier = 1.0;
  let streakModifier = 1.0;
  let levelModifier = 1.0;
  let ageModifier = 1.0;
  let likesModifier = 1.0;
  
  const photoType = photo?.scenery_type || 'natural';
  const opponentType = opponentPhoto?.scenery_type || 'natural';
  
  // Check for shield immunity
  const loseStreak = playerStats?.current_lose_streak || photo?.current_lose_streak || 0;
  const hasImmunity = loseStreak >= 3;
  
  // 1. Scenery strength/weakness (25%)
  if (photoType !== opponentType) {
    const playerScenery = SCENERY_CONFIG[photoType] || SCENERY_CONFIG.natural;
    
    if (photoType === 'neutral') {
      if (!hasImmunity) {
        sceneryModifier = 0.90;
        modifiers.push({ type: 'weakness', reason: 'Neutral background (-10%)', value: -10 });
      } else {
        modifiers.push({ type: 'immunity', reason: '🛡 Shield negates weakness', value: 0 });
      }
    } else if (opponentType === 'neutral') {
      sceneryModifier = 1.10;
      modifiers.push({ type: 'strength', reason: `${playerScenery.name} vs Neutral (+10%)`, value: 10 });
    } else if (playerScenery.strong === opponentType) {
      sceneryModifier = STRENGTH_MULTIPLIER;
      modifiers.push({ type: 'strength', reason: `${playerScenery.name} strong vs ${SCENERY_CONFIG[opponentType]?.name || opponentType} (+25%)`, value: 25 });
    } else if (playerScenery.weak === opponentType) {
      if (hasImmunity) {
        modifiers.push({ type: 'immunity', reason: '🛡 Shield negates weakness', value: 0 });
      } else {
        sceneryModifier = WEAKNESS_MULTIPLIER;
        modifiers.push({ type: 'weakness', reason: `${playerScenery.name} weak vs ${SCENERY_CONFIG[opponentType]?.name || opponentType} (-25%)`, value: -25 });
      }
    }
  }
  
  // 2. Win streak multiplier (🔥)
  const winStreak = playerStats?.current_win_streak || photo?.current_win_streak || 0;
  if (winStreak >= 3) {
    const cappedStreak = Math.min(winStreak, 10);
    streakModifier = WIN_STREAK_MULTIPLIERS[cappedStreak] || 3.0;
    modifiers.push({ type: 'streak', reason: `🔥 ${winStreak} win streak (×${streakModifier.toFixed(2)})`, value: Math.round((streakModifier - 1) * 100) });
  }
  
  // 3. Level bonus (1% per level above 1)
  const level = photo?.level || 1;
  if (level > 1) {
    levelModifier = 1 + (level - 1) * 0.01;
    modifiers.push({ type: 'level', reason: `Level ${level} bonus (+${level - 1}%)`, value: level - 1 });
  }
  
  // 4. Age bonus & monthly $1M increase
  const createdAt = photo?.created_at;
  let monthlyBonus = 0;
  if (createdAt) {
    const created = new Date(createdAt);
    const now = new Date();
    const daysOld = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    if (daysOld > 0) {
      const ageBonus = daysOld * 0.001;
      ageModifier += ageBonus;
      modifiers.push({ type: 'age', reason: `Age bonus (${daysOld} days)`, value: Math.round(ageBonus * 100 * 10) / 10 });
    }
    
    // Every 30 days = $1M permanent increase
    const monthsOld = Math.floor(daysOld / 30);
    if (monthsOld > 0) {
      monthlyBonus = monthsOld * 1_000_000;
      modifiers.push({ type: 'monthly', reason: `+$${monthsOld}M (${monthsOld}x 30 days)`, value: monthlyBonus });
    }
  }
  
  // 5. Likes bonus (0.05% per like)
  const likes = photo?.likes_count || 0;
  if (likes > 0) {
    const likesBonus = likes * 0.0005;
    likesModifier += likesBonus;
    modifiers.push({ type: 'likes', reason: `Likes bonus (${likes} likes)`, value: Math.round(likesBonus * 100 * 10) / 10 });
  }
  
  // Calculate final effective value
  let effectiveValue = Math.round(baseValue * sceneryModifier * streakModifier * levelModifier * ageModifier * likesModifier);
  effectiveValue += monthlyBonus;
  effectiveValue = Math.max(effectiveValue, 1_000_000);
  
  return {
    effectiveValue,
    baseValue,
    modifiers,
    hasImmunity,
  };
};

// Determine RPS winner
const determineWinner = (choice1, choice2) => {
  if (choice1 === choice2) return 'tie';
  const c1 = RPS_CHOICES.find(c => c.id === choice1);
  if (c1.beats === choice2) return 'player1';
  return 'player2';
};

// RPS Choice Button Component
const ChoiceButton = ({ choice, selected, onSelect, disabled, showResult, isWinner, isLoser }) => {
  return (
    <motion.button
      onClick={() => onSelect(choice.id)}
      disabled={disabled}
      className={`relative w-24 h-28 sm:w-28 sm:h-32 rounded-2xl flex flex-col items-center justify-center transition-all shadow-lg ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${
        selected 
          ? `bg-gradient-to-br ${choice.color} ring-4 ring-white ring-offset-2 ring-offset-gray-900` 
          : 'bg-gray-700 hover:bg-gray-600'
      } ${
        showResult && isWinner ? 'ring-4 ring-green-500' : ''
      } ${
        showResult && isLoser ? 'ring-4 ring-red-500 opacity-60' : ''
      }`}
      whileHover={!disabled ? { scale: 1.05, rotate: 2 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      data-testid={`rps-choice-${choice.id}`}
    >
      <motion.span 
        className="text-5xl sm:text-6xl"
        animate={selected ? { 
          rotate: [0, -10, 10, -10, 0],
          scale: [1, 1.1, 1]
        } : {}}
        transition={{ duration: 0.5 }}
      >
        {choice.emoji}
      </motion.span>
      <span className="text-xs sm:text-sm text-white mt-2 font-bold">{choice.name}</span>
      
      {/* Winner/Loser indicator */}
      {showResult && isWinner && (
        <motion.div 
          className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <Trophy className="w-5 h-5 text-white" />
        </motion.div>
      )}
      {showResult && isLoser && (
        <motion.div 
          className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <Skull className="w-4 h-4 text-white" />
        </motion.div>
      )}
    </motion.button>
  );
};

// Bid Button Component
const BidButton = ({ amount, selected, onSelect, disabled, playerMoney }) => {
  const isAffordable = playerMoney >= amount;
  
  return (
    <motion.button
      onClick={() => isAffordable && onSelect(amount)}
      disabled={disabled || !isAffordable}
      className={`px-3 py-2 sm:px-5 sm:py-3 rounded-xl font-bold transition-all shadow-md ${
        !isAffordable
          ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
          : selected 
            ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black scale-105' 
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
      whileHover={isAffordable && !disabled ? { scale: 1.05, y: -2 } : {}}
      whileTap={isAffordable && !disabled ? { scale: 0.95 } : {}}
      data-testid={`bid-${amount}`}
    >
      💵 {formatMoney(amount)}
    </motion.button>
  );
};

// Dramatic Reveal Animation Component - ENHANCED with bid amounts display
const RevealAnimation = ({ 
  playerChoice, 
  opponentChoice, 
  playerBid,
  opponentBid,
  result, 
  onComplete 
}) => {
  const [phase, setPhase] = useState('countdown'); // countdown, reveal, result
  
  const playerChoiceData = RPS_CHOICES.find(c => c.id === playerChoice);
  const opponentChoiceData = RPS_CHOICES.find(c => c.id === opponentChoice);
  
  // Determine who has the higher bid (for highlighting)
  const playerHasHigherBid = playerBid > opponentBid;
  const opponentHasHigherBid = opponentBid > playerBid;
  const sameBid = playerBid === opponentBid;
  const sameChoice = playerChoice === opponentChoice;
  
  useEffect(() => {
    // Countdown phase
    const countdownTimer = setTimeout(() => {
      setPhase('reveal');
      auctionSounds.photoClash();
    }, 1000);
    
    // Result phase
    const resultTimer = setTimeout(() => {
      setPhase('result');
      if (result === 'player1') {
        auctionSounds.roundWin();
      } else if (result === 'player2') {
        auctionSounds.roundLose();
      } else {
        auctionSounds.bidPlaced();
      }
    }, 2500);
    
    // Complete
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 4500);
    
    return () => {
      clearTimeout(countdownTimer);
      clearTimeout(resultTimer);
      clearTimeout(completeTimer);
    };
  }, [result, onComplete]);
  
  return (
    <motion.div 
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      data-testid="rps-reveal-animation"
    >
      <div className="flex flex-col items-center px-4">
        {/* VS Header */}
        <motion.div 
          className="text-2xl text-gray-400 mb-6"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          REVEALING...
        </motion.div>
        
        {/* Choices with Bid Amounts */}
        <div className="flex items-center gap-6 sm:gap-12">
          {/* Player choice */}
          <motion.div 
            className="flex flex-col items-center"
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <span className="text-xs text-purple-400 mb-2">YOU</span>
            <motion.div 
              className={`relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br ${playerChoiceData?.color} flex items-center justify-center shadow-2xl ${
                phase === 'result' && result === 'player1' ? 'ring-4 ring-green-500' : ''
              } ${
                phase === 'result' && result === 'player2' ? 'ring-4 ring-red-500' : ''
              }`}
              animate={phase === 'reveal' ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <motion.span 
                className="text-5xl sm:text-6xl"
                animate={phase === 'result' && result === 'player1' ? {
                  rotate: [0, -15, 15, 0],
                  scale: [1, 1.1, 1]
                } : {}}
                transition={{ duration: 0.5, repeat: 2 }}
              >
                {playerChoiceData?.emoji}
              </motion.span>
            </motion.div>
            
            {/* Player Bid Amount - PROMINENT DISPLAY */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className={`mt-3 px-4 py-2 rounded-xl font-bold text-lg ${
                sameChoice && playerHasHigherBid 
                  ? 'bg-green-500/30 border-2 border-green-500 text-green-300 shadow-lg shadow-green-500/30' 
                  : sameChoice && sameBid
                    ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-300'
                    : 'bg-purple-500/20 border border-purple-500/50 text-purple-300'
              }`}
              data-testid="player-bid-display"
            >
              💵 {formatMoney(playerBid)}
              {sameChoice && playerHasHigherBid && (
                <span className="ml-2 text-green-400 text-sm">⬆️ HIGHER</span>
              )}
            </motion.div>
          </motion.div>
          
          {/* VS */}
          <motion.div 
            className="text-3xl sm:text-4xl font-bold text-white"
            animate={{ scale: [1, 1.5, 1], rotate: [0, 360] }}
            transition={{ duration: 0.5, delay: 1 }}
          >
            ⚔️
          </motion.div>
          
          {/* Opponent choice */}
          <motion.div 
            className="flex flex-col items-center"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <span className="text-xs text-red-400 mb-2">OPPONENT</span>
            <motion.div 
              className={`relative w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br ${opponentChoiceData?.color} flex items-center justify-center shadow-2xl ${
                phase === 'result' && result === 'player2' ? 'ring-4 ring-green-500' : ''
              } ${
                phase === 'result' && result === 'player1' ? 'ring-4 ring-red-500' : ''
              }`}
              animate={phase === 'reveal' ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <motion.span 
                className="text-5xl sm:text-6xl"
                animate={phase === 'result' && result === 'player2' ? {
                  rotate: [0, -15, 15, 0],
                  scale: [1, 1.1, 1]
                } : {}}
                transition={{ duration: 0.5, repeat: 2 }}
              >
                {opponentChoiceData?.emoji}
              </motion.span>
            </motion.div>
            
            {/* Opponent Bid Amount - PROMINENT DISPLAY */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
              className={`mt-3 px-4 py-2 rounded-xl font-bold text-lg ${
                sameChoice && opponentHasHigherBid 
                  ? 'bg-green-500/30 border-2 border-green-500 text-green-300 shadow-lg shadow-green-500/30' 
                  : sameChoice && sameBid
                    ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-300'
                    : 'bg-red-500/20 border border-red-500/50 text-red-300'
              }`}
              data-testid="opponent-bid-display"
            >
              💵 {formatMoney(opponentBid)}
              {sameChoice && opponentHasHigherBid && (
                <span className="ml-2 text-green-400 text-sm">⬆️ HIGHER</span>
              )}
            </motion.div>
          </motion.div>
        </div>
        
        {/* Tie Explanation - Shows when same RPS choice */}
        <AnimatePresence>
          {phase === 'reveal' && sameChoice && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg"
            >
              <span className="text-yellow-300 text-sm font-medium">
                🎲 Same choice! Higher bid wins this round.
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Result text */}
        <AnimatePresence>
          {phase === 'result' && (
            <motion.div
              className="mt-6 text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {result === 'player1' && (
                <motion.div 
                  className="text-3xl font-bold text-green-400"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.5, repeat: 2 }}
                >
                  🎉 YOU WIN!
                </motion.div>
              )}
              {result === 'player2' && (
                <motion.div 
                  className="text-3xl font-bold text-red-400"
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 0.3, repeat: 3 }}
                >
                  😢 YOU LOSE
                </motion.div>
              )}
              {result === 'tie' && (
                <motion.div className="text-3xl font-bold text-yellow-400">
                  🤝 TIE - Same Bids!
                </motion.div>
              )}
              
              {/* Win reason explanation */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-2 text-sm text-gray-400"
              >
                {sameChoice ? (
                  sameBid ? (
                    'Both chose same option with same bid - Complete tie!'
                  ) : playerHasHigherBid ? (
                    `Your higher bid (${formatMoney(playerBid)} vs ${formatMoney(opponentBid)}) won the tie!`
                  ) : (
                    `Opponent's higher bid (${formatMoney(opponentBid)} vs ${formatMoney(playerBid)}) won the tie.`
                  )
                ) : result === 'player1' ? (
                  `${playerChoiceData?.name} beats ${opponentChoiceData?.name}!`
                ) : (
                  `${opponentChoiceData?.name} beats ${playerChoiceData?.name}.`
                )}
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

// Main RPSBidding Component
export const RPSBidding = ({
  roundNumber = 1,
  playerMoney = STARTING_MONEY,
  opponentMoney = STARTING_MONEY,
  playerWins = 0,
  opponentWins = 0,
  onRoundComplete,
  isBot = false,
  botDifficulty = 'medium',
  soundEnabled = true,
  // NEW: Power Advantage props
  playerPhoto = null,
  opponentPhoto = null,
  playerStats = {},
  opponentStats = {},
  powerAdvantage = null, // { advantage: 'player'|'opponent'|'none', bonus_amount, player_effective_value, opponent_effective_value }
}) => {
  // Calculate effective values with ALL modifiers
  const playerValueCalc = calculateEffectiveValue(playerPhoto, opponentPhoto, playerStats);
  const opponentValueCalc = calculateEffectiveValue(opponentPhoto, playerPhoto, opponentStats);
  
  // Use calculated values or provided power advantage values
  const playerEffectiveValue = powerAdvantage?.player_effective_value || playerValueCalc.effectiveValue;
  const opponentEffectiveValue = powerAdvantage?.opponent_effective_value || opponentValueCalc.effectiveValue;
  const playerBaseValue = playerValueCalc.baseValue;
  const opponentBaseValue = opponentValueCalc.baseValue;
  const playerModifiers = playerValueCalc.modifiers;
  const opponentModifiers = opponentValueCalc.modifiers;
  
  // Determine if player has the $1M advantage (higher effective value)
  const hasPlayerAdvantage = powerAdvantage?.advantage === 'player' || playerEffectiveValue > opponentEffectiveValue;
  const hasOpponentAdvantage = powerAdvantage?.advantage === 'opponent' || opponentEffectiveValue > playerEffectiveValue;
  
  // Use $6M bid options if player has advantage
  const currentBidOptions = hasPlayerAdvantage ? BID_OPTIONS_WITH_ADVANTAGE : BID_OPTIONS;
  const currentMaxBid = hasPlayerAdvantage ? 6_000_000 : MAX_BID;
  
  // Game state
  const [gamePhase, setGamePhase] = useState('countdown'); // countdown, choosing, revealing, finished
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [choiceTimer, setChoiceTimer] = useState(CHOICE_TIMEOUT_SECONDS);
  
  // Player choices
  const [playerChoice, setPlayerChoice] = useState(null);
  const [playerBid, setPlayerBid] = useState(MIN_BID);
  const [opponentChoice, setOpponentChoice] = useState(null);
  const [opponentBid, setOpponentBid] = useState(MIN_BID);
  
  // Result
  const [roundResult, setRoundResult] = useState(null);
  const [showReveal, setShowReveal] = useState(false);
  
  // Warning state
  const [showMaxBidWarning, setShowMaxBidWarning] = useState(false);
  
  // Ref for submit handler to avoid stale closures
  const handleSubmitRef = useRef(null);
  
  // Check if player is bankrupt
  const playerBankrupt = playerMoney < MIN_BID;
  const opponentBankrupt = opponentMoney < MIN_BID;
  
  // Generate bot choice - defined early to use in handleSubmit
  const generateBotChoice = useCallback(() => {
    const strategies = {
      easy: () => {
        const choice = RPS_CHOICES[Math.floor(Math.random() * 3)].id;
        const bid = Math.min(opponentMoney, MIN_BID * (Math.floor(Math.random() * 2) + 1));
        return { choice, bid };
      },
      medium: () => {
        const choice = RPS_CHOICES[Math.floor(Math.random() * 3)].id;
        const maxAffordable = Math.min(opponentMoney, MAX_BID);
        const affordableBids = BID_OPTIONS.filter(b => b <= maxAffordable);
        const bid = affordableBids[Math.floor(Math.random() * affordableBids.length)] || MIN_BID;
        return { choice, bid };
      },
      hard: () => {
        const choice = RPS_CHOICES[Math.floor(Math.random() * 3)].id;
        const maxAffordable = Math.min(opponentMoney, MAX_BID);
        const highBids = BID_OPTIONS.filter(b => b <= maxAffordable && b >= 3_000_000);
        const bid = highBids.length > 0 
          ? highBids[Math.floor(Math.random() * highBids.length)]
          : Math.min(opponentMoney, MIN_BID * 2);
        return { choice, bid };
      },
    };
    return (strategies[botDifficulty] || strategies.medium)();
  }, [botDifficulty, opponentMoney]);
  
  // Handle submit - defined early
  const handleSubmit = useCallback((timeout = false) => {
    if (gamePhase !== 'choosing') return;
    
    const botMove = isBot ? generateBotChoice() : { choice: 'rock', bid: MIN_BID };
    setOpponentChoice(botMove.choice);
    setOpponentBid(botMove.bid);
    
    const finalPlayerChoice = timeout ? null : playerChoice;
    
    if (!finalPlayerChoice) {
      setGamePhase('revealing');
      setShowReveal(true);
      setRoundResult('player2');
      return;
    }
    
    const rpsResult = determineWinner(finalPlayerChoice, botMove.choice);
    
    if (rpsResult === 'player1') {
      setRoundResult('player1');
    } else if (rpsResult === 'player2') {
      setRoundResult('player2');
    } else {
      // Tie - higher bid wins
      if (playerBid > botMove.bid) {
        setRoundResult('player1');
      } else if (botMove.bid > playerBid) {
        setRoundResult('player2');
      } else {
        setRoundResult('tie');
      }
    }
    
    setGamePhase('revealing');
    setShowReveal(true);
    
    if (soundEnabled) auctionSounds.bidPlaced();
  }, [gamePhase, playerChoice, playerBid, isBot, generateBotChoice, soundEnabled]);
  
  // Keep ref updated
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);
  
  // Countdown timer
  useEffect(() => {
    if (gamePhase === 'countdown') {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            
            // Check bankruptcy
            if (playerBankrupt) {
              // Auto-loss
              setGamePhase('finished');
              setRoundResult('player2');
              if (soundEnabled) auctionSounds.bankrupt();
              setTimeout(() => onRoundComplete?.('opponent', 0, 0), 2000);
              return 0;
            }
            
            setGamePhase('choosing');
            if (soundEnabled) auctionSounds.paddleRaise();
            return 0;
          }
          if (soundEnabled) auctionSounds.tick();
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [gamePhase, playerBankrupt, soundEnabled, onRoundComplete]);
  
  // Choice timer
  useEffect(() => {
    if (gamePhase === 'choosing') {
      const timer = setInterval(() => {
        setChoiceTimer(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            
            // Timeout - auto-loss if no choice made (use ref to avoid stale closure)
            if (!playerChoice) {
              toast.error('Time out! You lose this round.');
              handleSubmitRef.current?.(true);
            } else {
              handleSubmitRef.current?.(false);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [gamePhase, playerChoice]);
  
  // Handle max bid warning
  const handleBidSelect = useCallback((amount) => {
    setPlayerBid(amount);
    if (soundEnabled) auctionSounds.buttonHover();
    
    // Show warning on max bid (either $5M or $6M depending on advantage)
    if (amount === currentMaxBid && playerMoney <= currentMaxBid) {
      setShowMaxBidWarning(true);
      toast.warning(`⚠️ Warning: Bidding all ${formatMoney(currentMaxBid)}. You may auto-lose future RPS rounds if you run out of money!`);
    } else {
      setShowMaxBidWarning(false);
    }
  }, [playerMoney, soundEnabled, currentMaxBid]);
  
  // Handle choice select
  const handleChoiceSelect = useCallback((choiceId) => {
    setPlayerChoice(choiceId);
    if (soundEnabled) auctionSounds.selectionConfirm();
  }, [soundEnabled]);
  
  // Handle reveal complete
  const handleRevealComplete = useCallback(() => {
    setShowReveal(false);
    setGamePhase('finished');
    
    // Calculate money changes
    let newPlayerMoney = playerMoney;
    let newOpponentMoney = opponentMoney;
    
    if (roundResult === 'player1') {
      newPlayerMoney = playerMoney - playerBid + (playerBid + opponentBid);
      newOpponentMoney = opponentMoney - opponentBid;
    } else if (roundResult === 'player2') {
      newPlayerMoney = playerMoney - playerBid;
      newOpponentMoney = opponentMoney - opponentBid + (playerBid + opponentBid);
    }
    // Tie: no change
    
    // Callback with result
    setTimeout(() => {
      onRoundComplete?.(
        roundResult === 'player1' ? 'player' : (roundResult === 'player2' ? 'opponent' : 'tie'),
        newPlayerMoney,
        newOpponentMoney
      );
    }, 500);
  }, [playerMoney, opponentMoney, playerBid, opponentBid, roundResult, onRoundComplete]);
  
  return (
    <div className="relative bg-gray-800/50 rounded-2xl p-4 sm:p-6 border border-gray-700/50" data-testid="rps-bidding">
      {/* Reveal animation overlay */}
      <AnimatePresence>
        {showReveal && (
          <RevealAnimation
            playerChoice={playerChoice}
            opponentChoice={opponentChoice}
            playerBid={playerBid}
            opponentBid={opponentBid}
            result={roundResult}
            onComplete={handleRevealComplete}
          />
        )}
      </AnimatePresence>
      
      {/* Header */}
      <div className="text-center mb-6">
        <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
          <span className="text-2xl">🪨</span>
          <span className="bg-gradient-to-r from-gray-400 to-amber-400 bg-clip-text text-transparent">
            Rock Paper Scissors Bidding
          </span>
          <span className="text-2xl">✂️</span>
        </h3>
        <p className="text-gray-400 text-sm">Round {roundNumber} • First to 3 wins!</p>
      </div>
      
      {/* Power Advantage Indicator - NEW */}
      {powerAdvantage && powerAdvantage.advantage !== 'none' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-4 p-3 rounded-xl border ${
            hasPlayerAdvantage 
              ? 'bg-green-500/10 border-green-500/50' 
              : 'bg-red-500/10 border-red-500/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{hasPlayerAdvantage ? '⚡' : '⚠️'}</span>
              <span className={`font-bold ${hasPlayerAdvantage ? 'text-green-400' : 'text-red-400'}`}>
                {hasPlayerAdvantage ? 'Power Advantage!' : 'Opponent has Power Advantage'}
              </span>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-bold ${
              hasPlayerAdvantage ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}>
              +$1M
            </span>
          </div>
          {playerEffectiveValue && opponentEffectiveValue && (
            <div className="mt-2 flex items-center justify-center gap-4 text-xs">
              <span className={`${hasPlayerAdvantage ? 'text-green-300' : 'text-gray-400'}`}>
                Your Value: ${playerEffectiveValue?.toLocaleString()}
              </span>
              <span className="text-gray-500">vs</span>
              <span className={`${hasOpponentAdvantage ? 'text-red-300' : 'text-gray-400'}`}>
                Opponent: ${opponentEffectiveValue?.toLocaleString()}
              </span>
            </div>
          )}
          {hasPlayerAdvantage && (
            <p className="text-green-300/80 text-xs mt-2 text-center">
              Higher photo value = +$1M extra bidding money (Start with $6M!)
            </p>
          )}
        </motion.div>
      )}
      
      {/* Photo Display - ENHANCED with Original vs Effective Dollar Values */}
      {(playerPhoto || opponentPhoto) && (
        <div className="flex justify-center gap-3 sm:gap-6 mb-6" data-testid="rps-photo-display">
          {/* Player Photo Card */}
          {playerPhoto && (
            <div className="relative flex flex-col items-center" data-testid="player-photo-card">
              {/* EFFECTIVE VALUE - ABOVE PHOTO (Prominent) */}
              <div className="mb-2 px-3 py-1.5 bg-purple-600/80 rounded-lg border border-purple-400/50 shadow-lg shadow-purple-500/20">
                <p className="text-[10px] text-purple-200 text-center uppercase tracking-wide">Effective Power</p>
                <p className="text-lg font-bold text-white text-center drop-shadow" data-testid="player-effective-value">
                  {formatMoney(playerEffectiveValue || playerPhoto.dollar_value)}
                </p>
                {playerEffectiveValue && playerEffectiveValue !== playerPhoto.dollar_value && (
                  <p className={`text-[10px] text-center font-bold ${
                    playerEffectiveValue > playerPhoto.dollar_value ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {playerEffectiveValue > playerPhoto.dollar_value ? '↑' : '↓'}
                    {Math.abs(Math.round(((playerEffectiveValue - playerPhoto.dollar_value) / playerPhoto.dollar_value) * 100))}%
                  </p>
                )}
              </div>
              
              <p className="text-xs text-purple-400 text-center mb-1">Your Photo</p>
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-purple-500 shadow-lg relative">
                {playerPhoto.image_url ? (
                  <img 
                    src={playerPhoto.image_url} 
                    alt={playerPhoto.name || 'Player Photo'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <span className="text-3xl">📷</span>
                  </div>
                )}
                {/* Streak badge overlay */}
                {(playerPhoto.current_win_streak >= 3 || playerPhoto.current_lose_streak >= 3) && (
                  <div className="absolute top-1 right-1">
                    {playerPhoto.current_win_streak >= 3 && (
                      <span className="text-lg" title={`${playerPhoto.current_win_streak} win streak`}>🔥</span>
                    )}
                    {playerPhoto.current_lose_streak >= 3 && (
                      <span className="text-lg" title="Immunity active">🛡️</span>
                    )}
                  </div>
                )}
              </div>
              
              {/* ORIGINAL STATS - BELOW PHOTO */}
              <div className="mt-2 w-full max-w-[100px] sm:max-w-[120px]" data-testid="player-original-stats">
                {/* Base Dollar Value */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">Base:</span>
                  <span className="text-yellow-500 font-bold" data-testid="player-base-value">
                    {formatMoney(playerPhoto.dollar_value)}
                  </span>
                </div>
                
                {/* Scenery */}
                <div className="flex items-center justify-between text-[10px] mt-0.5">
                  <span className="text-gray-500">Scenery:</span>
                  <span className="text-gray-300">
                    {playerPhoto.scenery_type === 'natural' && '🌿 Natural'}
                    {playerPhoto.scenery_type === 'water' && '🌊 Water'}
                    {playerPhoto.scenery_type === 'manmade' && '🏙️ Man-made'}
                    {playerPhoto.scenery_type === 'neutral' && '⬜ Neutral'}
                    {!playerPhoto.scenery_type && '🌿 Natural'}
                  </span>
                </div>
                
                {/* Level & Stars */}
                <div className="flex items-center justify-between text-[10px] mt-0.5">
                  <span className="text-gray-500">Level:</span>
                  <span className="text-gray-300">
                    Lv{playerPhoto.level || 1} {'★'.repeat(Math.min(Math.floor((playerPhoto.level || 1)/10), 5))}
                  </span>
                </div>
                
                {/* Streak indicator */}
                <div className="mt-1 flex justify-center">
                  <StreakIndicator 
                    winStreak={playerPhoto.current_win_streak || 0} 
                    loseStreak={playerPhoto.current_lose_streak || 0}
                    size="small"
                    showTooltip={true}
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* VS Divider */}
          <div className="flex items-center">
            <span className="text-2xl text-gray-500">⚔️</span>
          </div>
          
          {/* Opponent Photo Card */}
          {opponentPhoto && (
            <div className="relative flex flex-col items-center" data-testid="opponent-photo-card">
              {/* EFFECTIVE VALUE - ABOVE PHOTO (Prominent) */}
              <div className="mb-2 px-3 py-1.5 bg-red-600/80 rounded-lg border border-red-400/50 shadow-lg shadow-red-500/20">
                <p className="text-[10px] text-red-200 text-center uppercase tracking-wide">Effective Power</p>
                <p className="text-lg font-bold text-white text-center drop-shadow" data-testid="opponent-effective-value">
                  {formatMoney(opponentEffectiveValue || opponentPhoto.dollar_value)}
                </p>
                {opponentEffectiveValue && opponentEffectiveValue !== opponentPhoto.dollar_value && (
                  <p className={`text-[10px] text-center font-bold ${
                    opponentEffectiveValue > opponentPhoto.dollar_value ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {opponentEffectiveValue > opponentPhoto.dollar_value ? '↑' : '↓'}
                    {Math.abs(Math.round(((opponentEffectiveValue - opponentPhoto.dollar_value) / opponentPhoto.dollar_value) * 100))}%
                  </p>
                )}
              </div>
              
              <p className="text-xs text-red-400 text-center mb-1">Opponent</p>
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-red-500 shadow-lg relative">
                {opponentPhoto.image_url ? (
                  <img 
                    src={opponentPhoto.image_url} 
                    alt={opponentPhoto.name || 'Opponent Photo'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
                    <span className="text-3xl">🤖</span>
                  </div>
                )}
                {/* Streak badge overlay */}
                {(opponentPhoto.current_win_streak >= 3 || opponentPhoto.current_lose_streak >= 3) && (
                  <div className="absolute top-1 right-1">
                    {opponentPhoto.current_win_streak >= 3 && (
                      <span className="text-lg" title={`${opponentPhoto.current_win_streak} win streak`}>🔥</span>
                    )}
                    {opponentPhoto.current_lose_streak >= 3 && (
                      <span className="text-lg" title="Immunity active">🛡️</span>
                    )}
                  </div>
                )}
              </div>
              
              {/* ORIGINAL STATS - BELOW PHOTO */}
              <div className="mt-2 w-full max-w-[100px] sm:max-w-[120px]" data-testid="opponent-original-stats">
                {/* Base Dollar Value */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-500">Base:</span>
                  <span className="text-yellow-500 font-bold" data-testid="opponent-base-value">
                    {formatMoney(opponentPhoto.dollar_value)}
                  </span>
                </div>
                
                {/* Scenery */}
                <div className="flex items-center justify-between text-[10px] mt-0.5">
                  <span className="text-gray-500">Scenery:</span>
                  <span className="text-gray-300">
                    {opponentPhoto.scenery_type === 'natural' && '🌿 Natural'}
                    {opponentPhoto.scenery_type === 'water' && '🌊 Water'}
                    {opponentPhoto.scenery_type === 'manmade' && '🏙️ Man-made'}
                    {opponentPhoto.scenery_type === 'neutral' && '⬜ Neutral'}
                    {!opponentPhoto.scenery_type && '🌿 Natural'}
                  </span>
                </div>
                
                {/* Level & Stars */}
                <div className="flex items-center justify-between text-[10px] mt-0.5">
                  <span className="text-gray-500">Level:</span>
                  <span className="text-gray-300">
                    Lv{opponentPhoto.level || 1} {'★'.repeat(Math.min(Math.floor((opponentPhoto.level || 1)/10), 5))}
                  </span>
                </div>
                
                {/* Streak indicator */}
                <div className="mt-1 flex justify-center">
                  <StreakIndicator 
                    winStreak={opponentPhoto.current_win_streak || 0} 
                    loseStreak={opponentPhoto.current_lose_streak || 0}
                    size="small"
                    showTooltip={true}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Score and Money Display */}
      <div className="flex justify-between items-center mb-6 px-2">
        {/* Player */}
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">YOU</p>
          <div className={`px-3 py-2 rounded-lg ${
            playerMoney < 2_000_000 ? 'bg-red-900/50 border border-red-500/50' : 'bg-purple-900/50'
          }`}>
            <p className={`font-bold ${playerMoney < 2_000_000 ? 'text-red-400' : 'text-green-400'}`}>
              {formatMoney(playerMoney)}
            </p>
          </div>
          <p className="text-purple-400 font-bold text-2xl mt-2">{playerWins}</p>
        </div>
        
        {/* VS */}
        <div className="text-center">
          <span className="text-gray-500 text-xl">vs</span>
        </div>
        
        {/* Opponent */}
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-1">OPPONENT</p>
          <div className={`px-3 py-2 rounded-lg ${
            opponentMoney < 2_000_000 ? 'bg-red-900/50 border border-red-500/50' : 'bg-red-900/50'
          }`}>
            <p className={`font-bold ${opponentMoney < 2_000_000 ? 'text-red-400' : 'text-orange-400'}`}>
              {formatMoney(opponentMoney)}
            </p>
          </div>
          <p className="text-red-400 font-bold text-2xl mt-2">{opponentWins}</p>
        </div>
      </div>
      
      {/* Countdown phase */}
      {gamePhase === 'countdown' && (
        <div className="text-center py-8">
          <motion.div
            className="text-7xl font-bold text-white mb-4"
            key={countdown}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
          >
            {countdown}
          </motion.div>
          <motion.p
            className="text-xl text-purple-300"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            Get Ready to Choose!
          </motion.p>
        </div>
      )}
      
      {/* Choosing phase */}
      {gamePhase === 'choosing' && !playerBankrupt && (
        <>
          {/* Timer */}
          <div className="flex justify-center mb-4">
            <motion.div 
              className={`flex items-center gap-2 px-4 py-2 rounded-full ${
                choiceTimer <= 2 ? 'bg-red-500' : 'bg-gray-700'
              }`}
              animate={choiceTimer <= 2 ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <Clock className="w-5 h-5 text-white" />
              <span className="text-white font-bold tabular-nums">{choiceTimer}s</span>
            </motion.div>
          </div>
          
          {/* RPS Choices */}
          <div className="mb-6">
            <p className="text-sm text-gray-400 mb-3 text-center">Choose your move:</p>
            <div className="flex justify-center gap-3 sm:gap-4">
              {RPS_CHOICES.map((choice) => (
                <ChoiceButton
                  key={choice.id}
                  choice={choice}
                  selected={playerChoice === choice.id}
                  onSelect={handleChoiceSelect}
                  disabled={false}
                  showResult={false}
                />
              ))}
            </div>
          </div>
          
          {/* Bid Selection */}
          <div className="mb-6">
            <p className="text-sm text-gray-400 mb-3 text-center">
              Set your bid (min $1M{hasPlayerAdvantage ? ', max $6M with advantage' : ''}):
            </p>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {currentBidOptions.map((amount) => (
                <BidButton
                  key={amount}
                  amount={amount}
                  selected={playerBid === amount}
                  onSelect={handleBidSelect}
                  disabled={false}
                  playerMoney={playerMoney}
                />
              ))}
            </div>
            {hasPlayerAdvantage && (
              <p className="text-center text-xs text-green-400 mt-2">
                ⚡ $6M bid unlocked from Power Advantage!
              </p>
            )}
          </div>
          
          {/* Max bid warning */}
          <AnimatePresence>
            {showMaxBidWarning && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-2 justify-center mb-4 px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg"
              >
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-300 text-sm">
                  Betting all $5M! May auto-lose future rounds.
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Submit Button */}
          <motion.button
            onClick={() => handleSubmit(false)}
            disabled={!playerChoice}
            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
              playerChoice
                ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white hover:opacity-90'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
            whileHover={playerChoice ? { scale: 1.02 } : {}}
            whileTap={playerChoice ? { scale: 0.98 } : {}}
            data-testid="submit-rps"
          >
            {playerChoice ? (
              <span className="flex items-center justify-center gap-2">
                <span className="text-2xl">{RPS_CHOICES.find(c => c.id === playerChoice)?.emoji}</span>
                Place Bid: {formatMoney(playerBid)}
                <span className="text-2xl">💰</span>
              </span>
            ) : (
              'Select a move first'
            )}
          </motion.button>
        </>
      )}
      
      {/* Bankrupt state */}
      {playerBankrupt && gamePhase !== 'finished' && (
        <div className="text-center py-8">
          <motion.div
            className="text-6xl mb-4"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            💸
          </motion.div>
          <p className="text-2xl font-bold text-red-400 mb-2">Bankrupt!</p>
          <p className="text-gray-400">Not enough money to continue.</p>
          <p className="text-red-300 mt-2">Auto-losing remaining RPS rounds.</p>
        </div>
      )}
      
      {/* Finished state (before reveal complete) */}
      {gamePhase === 'finished' && !showReveal && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Preparing next round...</p>
        </div>
      )}
    </div>
  );
};

export default RPSBidding;
