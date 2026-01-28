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
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Clock, DollarSign, Loader2, Trophy, Skull } from 'lucide-react';
import { toast } from 'sonner';
import auctionSounds from '../../utils/auctionSounds';

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

// Dramatic Reveal Animation Component
const RevealAnimation = ({ playerChoice, opponentChoice, result, onComplete }) => {
  const [phase, setPhase] = useState('countdown'); // countdown, reveal, result
  
  const playerChoiceData = RPS_CHOICES.find(c => c.id === playerChoice);
  const opponentChoiceData = RPS_CHOICES.find(c => c.id === opponentChoice);
  
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
    }, 4000);
    
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
    >
      <div className="flex flex-col items-center">
        {/* VS Header */}
        <motion.div 
          className="text-2xl text-gray-400 mb-8"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          REVEALING...
        </motion.div>
        
        {/* Choices */}
        <div className="flex items-center gap-8 sm:gap-16">
          {/* Player choice */}
          <motion.div 
            className="flex flex-col items-center"
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <span className="text-xs text-purple-400 mb-2">YOU</span>
            <motion.div 
              className={`w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br ${playerChoiceData?.color} flex items-center justify-center shadow-2xl ${
                phase === 'result' && result === 'player1' ? 'ring-4 ring-green-500' : ''
              } ${
                phase === 'result' && result === 'player2' ? 'ring-4 ring-red-500' : ''
              }`}
              animate={phase === 'reveal' ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <motion.span 
                className="text-6xl sm:text-7xl"
                animate={phase === 'result' && result === 'player1' ? {
                  rotate: [0, -15, 15, 0],
                  scale: [1, 1.1, 1]
                } : {}}
                transition={{ duration: 0.5, repeat: 2 }}
              >
                {playerChoiceData?.emoji}
              </motion.span>
            </motion.div>
          </motion.div>
          
          {/* VS */}
          <motion.div 
            className="text-4xl font-bold text-white"
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
              className={`w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br ${opponentChoiceData?.color} flex items-center justify-center shadow-2xl ${
                phase === 'result' && result === 'player2' ? 'ring-4 ring-green-500' : ''
              } ${
                phase === 'result' && result === 'player1' ? 'ring-4 ring-red-500' : ''
              }`}
              animate={phase === 'reveal' ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <motion.span 
                className="text-6xl sm:text-7xl"
                animate={phase === 'result' && result === 'player2' ? {
                  rotate: [0, -15, 15, 0],
                  scale: [1, 1.1, 1]
                } : {}}
                transition={{ duration: 0.5, repeat: 2 }}
              >
                {opponentChoiceData?.emoji}
              </motion.span>
            </motion.div>
          </motion.div>
        </div>
        
        {/* Result text */}
        <AnimatePresence>
          {phase === 'result' && (
            <motion.div
              className="mt-8"
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
                  🤝 TIE - Higher Bid Wins!
                </motion.div>
              )}
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
  powerAdvantage = null, // { advantage: 'player'|'opponent'|'none', bonus_amount, player_effective_value, opponent_effective_value }
}) => {
  // Determine if player has the $1M advantage
  const hasPlayerAdvantage = powerAdvantage?.advantage === 'player';
  const hasOpponentAdvantage = powerAdvantage?.advantage === 'opponent';
  const playerEffectiveValue = powerAdvantage?.player_effective_value;
  const opponentEffectiveValue = powerAdvantage?.opponent_effective_value;
  
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
