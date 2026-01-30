/**
 * TappingArena Component - Photo Auction Bidding Battle
 * 
 * Real-time phone tapping game for Rounds 1, 3, 5.
 * EXACTLY implements user's specifications:
 * - Base: 200 taps when equal power/scenery
 * - Max 30 taps/second (anti-cheat) - UPDATED from 25
 * - 10-second countdown before round
 * - Full-screen tap area
 * - Real minted photo images displayed
 * - Dollar meter animation rising with taps
 * - Confetti on win, screen shake on loss
 * - Haptic feedback via navigator.vibrate
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { AlertCircle, Zap, Target, Trophy, Skull, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import auctionSounds from '../../utils/auctionSounds';
import { StreakIndicator } from './StreakIndicator';

// Constants from user spec
const BASE_TAPS_TO_WIN = 200;
const MAX_TAPS_PER_SECOND = 30; // UPDATED: Increased from 20/25 to 30 TPS
const COUNTDOWN_SECONDS = 10;
const ROUND_DURATION_SECONDS = 15;

// Scenery config for strength/weakness display
const SCENERY_CONFIG = {
  natural: { name: 'Natural', color: 'from-green-500 to-emerald-600', icon: '🌿', strong: 'water', weak: 'manmade' },
  water: { name: 'Water', color: 'from-blue-500 to-cyan-600', icon: '🌊', strong: 'manmade', weak: 'natural' },
  manmade: { name: 'Man-made', color: 'from-orange-500 to-red-600', icon: '🏙️', strong: 'natural', weak: 'water' },
  neutral: { name: 'Neutral', color: 'from-gray-500 to-gray-600', icon: '⬜', strong: null, weak: 'all' },
};

// Format dollar value with commas
const formatDollarValue = (value) => {
  if (!value || value === 0) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
};

// Calculate required taps based on power difference
// Per spec: Higher power = fewer taps needed
const calculateRequiredTaps = (playerValue, opponentValue, baseTaps = BASE_TAPS_TO_WIN) => {
  const totalPower = playerValue + opponentValue;
  if (totalPower === 0) return baseTaps;
  
  const playerRatio = playerValue / totalPower;
  // Formula: bids = base_bids * (1.5 - power_ratio)
  // Higher power = lower ratio subtracted = fewer taps
  const requiredTaps = Math.round(baseTaps * (1.5 - playerRatio));
  
  // Clamp between 50 and 400 taps
  return Math.max(50, Math.min(400, requiredTaps));
};

// Win streak multipliers (matching backend)
const WIN_STREAK_MULTIPLIERS_CALC = {
  3: 1.25, 4: 1.50, 5: 1.75, 6: 2.00, 7: 2.25, 8: 2.50, 9: 2.75, 10: 3.00
};

// STRENGTH_MULTIPLIER = 1.25 (25% boost)
// WEAKNESS_MULTIPLIER = 0.75 (25% penalty)
const STRENGTH_MULTIPLIER = 1.25;
const WEAKNESS_MULTIPLIER = 0.75;

/**
 * Calculate effective dollar value for a photo in battle
 * This mirrors the backend calculate_photo_battle_value function
 * 
 * @param {Object} photo - The player's photo
 * @param {Object} opponentPhoto - The opponent's photo
 * @param {Object} playerStats - Player's stats (win/lose streaks)
 * @returns {Object} - { effectiveValue, modifiers[] }
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
      // Neutral is 10% weaker against all
      if (!hasImmunity) {
        sceneryModifier = 0.90;
        modifiers.push({ type: 'weakness', reason: 'Neutral background (-10%)', value: -10 });
      } else {
        modifiers.push({ type: 'immunity', reason: '🛡 Shield negates weakness', value: 0 });
      }
    } else if (opponentType === 'neutral') {
      // Strong against neutral (+10%)
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
    streakModifier = WIN_STREAK_MULTIPLIERS_CALC[cappedStreak] || 3.0;
    modifiers.push({ type: 'streak', reason: `🔥 ${winStreak} win streak (×${streakModifier.toFixed(2)})`, value: Math.round((streakModifier - 1) * 100) });
  }
  
  // 3. Level bonus (1% per level above 1)
  const level = photo?.level || 1;
  if (level > 1) {
    levelModifier = 1 + (level - 1) * 0.01;
    modifiers.push({ type: 'level', reason: `Level ${level} bonus (+${level - 1}%)`, value: level - 1 });
  }
  
  // 4. Age bonus (0.1% per day since minting)
  const createdAt = photo?.created_at;
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
      const monthlyBonus = monthsOld * 1_000_000;
      // This is additive, not multiplicative
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
  
  // Add monthly bonus if applicable
  const monthlyBonus = modifiers.find(m => m.type === 'monthly')?.value || 0;
  effectiveValue += monthlyBonus;
  
  // Minimum value
  effectiveValue = Math.max(effectiveValue, 1_000_000);
  
  return {
    effectiveValue,
    baseValue,
    sceneryModifier,
    streakModifier,
    levelModifier,
    ageModifier,
    likesModifier,
    modifiers,
    hasImmunity,
    photoType,
    opponentType,
  };
};

// Simple seeded random for deterministic values
const seededRandom = (seed) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Confetti particles for win animation
const Confetti = ({ count = 50 }) => {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#DDA0DD'];
  
  // Generate deterministic values based on index
  const particles = [...Array(count)].map((_, i) => ({
    left: seededRandom(i * 1.1) * 100,
    rotate: seededRandom(i * 2.2) * 720 - 360,
    duration: 2.5 + seededRandom(i * 3.3) * 1.5,
    delay: seededRandom(i * 4.4) * 0.5,
  }));
  
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute w-3 h-3 rounded-sm"
          style={{
            backgroundColor: colors[i % colors.length],
            left: `${p.left}%`,
            top: '-5%',
          }}
          initial={{ y: 0, rotate: 0, opacity: 1 }}
          animate={{
            y: '120vh',
            rotate: p.rotate,
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            ease: 'easeIn',
          }}
        />
      ))}
    </div>
  );
};

// Win streak multipliers
const WIN_STREAK_MULTIPLIERS = {
  3: 1.25, 4: 1.50, 5: 1.75, 6: 2.00, 7: 2.25, 8: 2.50, 9: 2.75, 10: 3.00
};

// Photo card display in arena - ENHANCED with Original vs Effective values
const PhotoBattleCard = ({ 
  photo, 
  effectiveValue, 
  originalValue,
  requiredTaps, 
  currentTaps, 
  isPlayer, 
  winStreak = 0, 
  loseStreak = 0,
  sceneryAdvantage = null, // 'strong', 'weak', or null
}) => {
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  const progress = currentTaps / requiredTaps;
  const currentDollarValue = Math.round(effectiveValue * Math.min(progress, 1));
  const baseValue = originalValue || photo?.dollar_value || effectiveValue;
  const level = photo?.level || 1;
  const hasStreakMultiplier = winStreak >= 3;
  const streakMultiplier = hasStreakMultiplier ? WIN_STREAK_MULTIPLIERS[Math.min(winStreak, 10)] : 1;
  const hasImmunity = loseStreak >= 3;
  
  return (
    <motion.div
      className={`relative rounded-2xl overflow-hidden shadow-2xl ${
        isPlayer ? 'border-4 border-purple-500' : 'border-4 border-red-500'
      }`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* EFFECTIVE VALUE - ABOVE PHOTO (Prominently displayed) */}
      <div className={`p-2 text-center ${isPlayer ? 'bg-purple-600' : 'bg-red-600'}`}>
        <p className="text-[10px] text-white/70 uppercase tracking-wide">Effective Power</p>
        <p className="text-lg font-bold text-white drop-shadow-lg">
          {formatDollarValue(effectiveValue)}
        </p>
        {effectiveValue !== baseValue && (
          <p className={`text-[10px] font-bold ${effectiveValue > baseValue ? 'text-green-300' : 'text-red-300'}`}>
            {effectiveValue > baseValue ? '↑' : '↓'} {Math.round(((effectiveValue - baseValue) / baseValue) * 100)}% from base
          </p>
        )}
      </div>
      
      {/* Photo Image */}
      <div className="relative w-32 h-28 sm:w-40 sm:h-32 bg-gray-900">
        {photo?.image_url ? (
          <img 
            src={photo.image_url} 
            alt={photo.name || 'Photo'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
            <span className="text-5xl opacity-60">{scenery.icon}</span>
          </div>
        )}
        
        {/* Scenery advantage indicator */}
        {sceneryAdvantage && (
          <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-bold ${
            sceneryAdvantage === 'strong' 
              ? 'bg-green-500/90 text-white' 
              : 'bg-red-500/90 text-white'
          }`}>
            {sceneryAdvantage === 'strong' ? '+25%' : '-25%'}
          </div>
        )}
      </div>
      
      {/* ORIGINAL STATS - BELOW PHOTO */}
      <div className={`p-2 ${isPlayer ? 'bg-purple-900/90' : 'bg-red-900/90'}`}>
        <p className="text-white font-bold text-sm truncate">{photo?.name || 'Photo'}</p>
        
        {/* Original Base Value */}
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-400">Base:</span>
          <span className="text-yellow-400 font-bold">{formatDollarValue(baseValue)}</span>
        </div>
        
        {/* Scenery Strength/Weakness */}
        <div className="flex items-center justify-between text-xs mb-1">
          <span className={`px-1.5 py-0.5 rounded bg-gradient-to-r ${scenery.color} text-white`}>
            {scenery.icon} {scenery.name}
          </span>
          <span className="text-gray-400 text-[10px]">
            💪{SCENERY_CONFIG[scenery.strong]?.icon || '?'} 😰{SCENERY_CONFIG[scenery.weak]?.icon || '?'}
          </span>
        </div>
        
        {/* Level & Stars */}
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-400">Lv{level} {'★'.repeat(Math.min(Math.floor(level/10), 5))}</span>
          {level >= 10 && (
            <span className="text-yellow-300 text-[10px]">+{Math.min(Math.floor(level/10) * 20, 100)}%</span>
          )}
        </div>
        
        {/* Streak Indicators */}
        <div className="flex items-center gap-2 text-xs">
          {hasStreakMultiplier && (
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-500/30 rounded text-orange-400 border border-orange-500/50">
              🔥 {winStreak} <span className="font-bold">×{streakMultiplier.toFixed(2)}</span>
            </span>
          )}
          {winStreak > 0 && winStreak < 3 && (
            <span className="text-orange-400/60">🔥{winStreak}</span>
          )}
          {hasImmunity && (
            <span className="px-1.5 py-0.5 bg-blue-500/30 rounded text-blue-400 border border-blue-500/50">
              🛡️ Immune
            </span>
          )}
        </div>
        
        {/* Current bid progress */}
        <div className="mt-2 pt-2 border-t border-gray-700">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Bid:</span>
            <span 
              className="text-yellow-400 font-bold tabular-nums transition-transform duration-75"
              style={{ transform: currentTaps > 0 ? 'scale(1.05)' : 'scale(1)' }}
            >
              {formatDollarValue(currentDollarValue)}
            </span>
          </div>
          <p className="text-gray-500 text-[10px] text-right">
            {currentTaps} / {requiredTaps} taps
          </p>
        </div>
      </div>
      
      {/* Progress bar overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
        <div 
          className={`h-full progress-animated ${isPlayer 
            ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500' 
            : 'bg-gradient-to-r from-red-500 to-orange-500'
          }`}
          style={{ 
            width: `${Math.min(progress * 100, 100)}%`,
            transition: 'width 0.08s linear',
          }}
        />
      </div>
    </motion.div>
  );
};

// Main TappingArena Component
export const TappingArena = ({
  playerPhoto,
  opponentPhoto,
  playerStats = {},
  opponentStats = {},
  roundNumber = 1,
  onRoundComplete,
  onTap,
  websocket = null, // WebSocket for real-time updates
  isBot = false,
  botDifficulty = 'medium',
  soundEnabled = true,
}) => {
  // Game state
  const [gamePhase, setGamePhase] = useState('waiting'); // waiting, countdown, active, finished
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [timeRemaining, setTimeRemaining] = useState(ROUND_DURATION_SECONDS);
  
  // Tap tracking
  const [playerTaps, setPlayerTaps] = useState(0);
  const [opponentTaps, setOpponentTaps] = useState(0);
  const [tapsThisSecond, setTapsThisSecond] = useState(0);
  const [showAntiCheatWarning, setShowAntiCheatWarning] = useState(false);
  
  // Calculate effective values with scenery/streak bonuses
  const playerEffectiveValue = playerPhoto?.effective_value || playerPhoto?.dollar_value || 50_000_000;
  const opponentEffectiveValue = opponentPhoto?.effective_value || opponentPhoto?.dollar_value || 50_000_000;
  
  // Calculate required taps for each player
  const playerRequiredTaps = calculateRequiredTaps(playerEffectiveValue, opponentEffectiveValue);
  const opponentRequiredTaps = calculateRequiredTaps(opponentEffectiveValue, playerEffectiveValue);
  
  // Determine scenery advantage
  const playerSceneryType = playerPhoto?.scenery_type || 'natural';
  const opponentSceneryType = opponentPhoto?.scenery_type || 'natural';
  const playerSceneryConfig = SCENERY_CONFIG[playerSceneryType];
  
  let playerSceneryAdvantage = null;
  if (playerSceneryConfig?.strong === opponentSceneryType) {
    playerSceneryAdvantage = 'strong';
  } else if (playerSceneryConfig?.weak === opponentSceneryType || playerSceneryType === 'neutral') {
    playerSceneryAdvantage = 'weak';
  }
  
  // Result state
  const [winner, setWinner] = useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Refs for timers
  const gameTimerRef = useRef(null);
  const botTimerRef = useRef(null);
  const tapResetRef = useRef(null);
  const arenaRef = useRef(null);
  
  // Refs for handlers to avoid stale closure
  const handlePlayerWinRef = useRef(null);
  const handleOpponentWinRef = useRef(null);
  
  // Animation controls
  const shakeControls = useAnimation();
  
  // Vibrate helper (if supported)
  const vibrate = useCallback((pattern) => {
    if (navigator.vibrate && soundEnabled) {
      navigator.vibrate(pattern);
    }
  }, [soundEnabled]);
  
  // Handle player tap
  const handleTap = useCallback((e) => {
    if (gamePhase !== 'active') return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Anti-cheat: Max 30 taps per second (rolling window)
    if (tapsThisSecond >= MAX_TAPS_PER_SECOND) {
      // Show warning toast (debounced to prevent spam)
      if (!showAntiCheatWarning) {
        toast.warning('⚠️ Tap rate exceeded! Slow down.', {
          duration: 1500,
          id: 'tap-rate-warning', // Prevent duplicate toasts
        });
        setShowAntiCheatWarning(true);
        setTimeout(() => setShowAntiCheatWarning(false), 1000);
      }
      // Discard excess taps - they don't count toward meter
      return;
    }
    
    const newTaps = playerTaps + 1;
    setPlayerTaps(newTaps);
    setTapsThisSecond(prev => prev + 1);
    
    // Play tap sound
    if (soundEnabled) {
      auctionSounds.buttonHover();
    }
    
    // Light vibration feedback
    vibrate(10);
    
    // Send to WebSocket if available
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      websocket.send(JSON.stringify({ type: 'tap', count: 1 }));
    }
    
    // Callback
    if (onTap) onTap(newTaps);
    
    // Check win condition (use ref to avoid stale closure)
    if (newTaps >= playerRequiredTaps) {
      handlePlayerWinRef.current?.();
    }
  }, [gamePhase, playerTaps, playerRequiredTaps, tapsThisSecond, soundEnabled, websocket, vibrate, onTap, showAntiCheatWarning]);
  
  // Reset taps counter every second
  useEffect(() => {
    if (gamePhase === 'active') {
      tapResetRef.current = setInterval(() => {
        setTapsThisSecond(0);
      }, 1000);
    }
    
    return () => {
      if (tapResetRef.current) clearInterval(tapResetRef.current);
    };
  }, [gamePhase]);
  
  // Handle player win
  const handlePlayerWin = useCallback(() => {
    if (winner) return; // Prevent duplicate
    
    setGamePhase('finished');
    setWinner('player');
    setShowConfetti(true);
    
    if (soundEnabled) {
      auctionSounds.roundWin();
    }
    
    // Strong vibration for win
    vibrate([100, 50, 100, 50, 200]);
    
    // Cleanup
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (botTimerRef.current) clearInterval(botTimerRef.current);
    
    // Callback after animation
    setTimeout(() => {
      if (onRoundComplete) onRoundComplete('player');
    }, 2500);
  }, [winner, soundEnabled, vibrate, onRoundComplete]);
  
  // Keep refs updated
  useEffect(() => {
    handlePlayerWinRef.current = handlePlayerWin;
  }, [handlePlayerWin]);
  
  // Handle opponent win (bot or real player)
  const handleOpponentWin = useCallback(() => {
    if (winner) return;
    
    setGamePhase('finished');
    setWinner('opponent');
    
    // Screen shake animation
    shakeControls.start({
      x: [-10, 10, -10, 10, -5, 5, 0],
      transition: { duration: 0.5 }
    });
    
    if (soundEnabled) {
      auctionSounds.roundLose();
    }
    
    // Medium vibration for loss
    vibrate([200, 100, 200]);
    
    // Cleanup
    if (gameTimerRef.current) clearInterval(gameTimerRef.current);
    if (botTimerRef.current) clearInterval(botTimerRef.current);
    
    // Callback after animation
    setTimeout(() => {
      if (onRoundComplete) onRoundComplete('opponent');
    }, 2500);
  }, [winner, soundEnabled, vibrate, shakeControls, onRoundComplete]);
  
  // Keep opponent win ref updated
  useEffect(() => {
    handleOpponentWinRef.current = handleOpponentWin;
  }, [handleOpponentWin]);
  
  // Start countdown
  useEffect(() => {
    if (gamePhase === 'waiting') {
      // Auto-start after component mounts
      const startTimeout = setTimeout(() => {
        setGamePhase('countdown');
      }, 500);
      return () => clearTimeout(startTimeout);
    }
  }, [gamePhase]);
  
  // Countdown timer
  useEffect(() => {
    if (gamePhase === 'countdown') {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setGamePhase('active');
            return 0;
          }
          
          if (soundEnabled) {
            auctionSounds.tick();
          }
          
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [gamePhase, soundEnabled]);
  
  // Game timer
  useEffect(() => {
    if (gamePhase === 'active') {
      if (soundEnabled) {
        auctionSounds.paddleRaise();
      }
      
      gameTimerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Time's up - determine winner by progress
            clearInterval(gameTimerRef.current);
            
            const playerProgress = playerTaps / playerRequiredTaps;
            const opponentProgress = opponentTaps / opponentRequiredTaps;
            
            if (playerProgress >= opponentProgress) {
              handlePlayerWinRef.current?.();
            } else {
              handleOpponentWinRef.current?.();
            }
            
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => {
        if (gameTimerRef.current) clearInterval(gameTimerRef.current);
      };
    }
  }, [gamePhase, playerTaps, opponentTaps, playerRequiredTaps, opponentRequiredTaps, soundEnabled]);
  
  // Bot tapping (if bot match) - Updated for 30 TPS max
  useEffect(() => {
    if (gamePhase === 'active' && isBot) {
      // Bot speeds adjusted for 30 TPS max player rate
      // Bots now tap faster to provide proper challenge
      const botSpeeds = {
        easy: { min: 5, max: 10 },      // Casual: 5-10 TPS
        medium: { min: 10, max: 18 },   // Moderate: 10-18 TPS
        hard: { min: 18, max: 28 },     // Challenging: 18-28 TPS (near max)
      };
      
      const speed = botSpeeds[botDifficulty] || botSpeeds.medium;
      
      botTimerRef.current = setInterval(() => {
        setOpponentTaps(prev => {
          const tapsToAdd = Math.floor(Math.random() * (speed.max - speed.min + 1)) + speed.min;
          const newTaps = prev + tapsToAdd;
          
          // Check if bot wins
          if (newTaps >= opponentRequiredTaps && !winner) {
            handleOpponentWinRef.current?.();
          }
          
          return newTaps;
        });
      }, 1000);
      
      return () => {
        if (botTimerRef.current) clearInterval(botTimerRef.current);
      };
    }
  }, [gamePhase, isBot, botDifficulty, opponentRequiredTaps, winner]);
  
  // WebSocket message handler
  useEffect(() => {
    if (websocket && !isBot) {
      const handleMessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'bid_update' && data.player_id !== 'self') {
            setOpponentTaps(data.current_bids || 0);
            
            // Check if opponent wins
            if (data.current_bids >= opponentRequiredTaps && !winner) {
              handleOpponentWinRef.current?.();
            }
          } else if (data.type === 'auction_end') {
            if (data.winner_id === 'player' || data.winner_id === playerStats?.user_id) {
              handlePlayerWinRef.current?.();
            } else {
              handleOpponentWinRef.current?.();
            }
          }
        } catch (e) {
          console.error('WebSocket message error:', e);
        }
      };
      
      websocket.addEventListener('message', handleMessage);
      return () => websocket.removeEventListener('message', handleMessage);
    }
  }, [websocket, isBot, opponentRequiredTaps, winner, playerStats]);
  
  // Calculate progress percentages
  const playerProgress = Math.min((playerTaps / playerRequiredTaps) * 100, 100);
  const opponentProgress = Math.min((opponentTaps / opponentRequiredTaps) * 100, 100);
  
  return (
    <motion.div 
      ref={arenaRef}
      className="relative w-full min-h-[70vh] bg-gradient-to-b from-gray-900 via-purple-900/20 to-gray-900 rounded-3xl overflow-hidden"
      animate={shakeControls}
      data-testid="tapping-arena"
    >
      {/* Confetti on win */}
      <AnimatePresence>
        {showConfetti && <Confetti count={60} />}
      </AnimatePresence>
      
      {/* Header with round info and timer */}
      <div className="absolute top-0 left-0 right-0 p-4 z-20">
        <div className="flex items-center justify-between">
          <div className="text-white font-bold">
            Round {roundNumber}
            <span className="text-purple-400 ml-2">Photo Auction</span>
          </div>
          
          {gamePhase === 'active' && (
            <motion.div 
              className={`px-4 py-2 rounded-full font-bold tabular-nums ${
                timeRemaining <= 5 ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'
              }`}
              animate={timeRemaining <= 5 ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              {timeRemaining}s
            </motion.div>
          )}
        </div>
        
        {/* Streak indicators - top center */}
        <div className="flex justify-center mt-2 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">You:</span>
            <StreakIndicator 
              winStreak={playerStats?.current_win_streak || 0}
              loseStreak={playerStats?.current_lose_streak || 0}
              size="small"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Opp:</span>
            <StreakIndicator 
              winStreak={opponentStats?.current_win_streak || 0}
              loseStreak={opponentStats?.current_lose_streak || 0}
              size="small"
              revealed={true}
            />
          </div>
        </div>
      </div>
      
      {/* Progress meters - MOVED ABOVE PHOTOS */}
      <div className="absolute top-20 left-0 right-0 px-4 z-20">
        <div className="flex gap-4 items-center">
          {/* Player meter */}
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span className="text-purple-300 font-bold">Your Progress</span>
              <span className="text-white font-bold">{Math.round(playerProgress)}%</span>
            </div>
            <div className="h-6 bg-gray-800 rounded-full overflow-hidden border border-purple-500/50">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 progress-animated"
                style={{ 
                  width: `${playerProgress}%`,
                  transition: 'width 0.08s linear',
                }}
              />
            </div>
          </div>
          
          {/* VS */}
          <span className="text-2xl">⚔️</span>
          
          {/* Opponent meter (mirrored) */}
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span className="text-red-300 font-bold">Opponent</span>
              <span className="text-white font-bold">{Math.round(opponentProgress)}%</span>
            </div>
            <div className="h-6 bg-gray-800 rounded-full overflow-hidden border border-red-500/50">
              <div 
                className="h-full bg-gradient-to-r from-red-500 to-orange-500 progress-animated"
                style={{ 
                  width: `${opponentProgress}%`,
                  transition: 'width 0.08s linear',
                }}
              />
            </div>
          </div>
        </div>
        
        {/* Dollar Value Display - PROMINENTLY VISIBLE */}
        <div className="flex justify-between mt-3 px-2">
          <div className="text-center">
            <p 
              className="text-2xl sm:text-3xl font-bold text-yellow-400 tabular-nums drop-shadow-lg"
              style={{ 
                textShadow: '0 0 10px rgba(234, 179, 8, 0.5)',
              }}
            >
              {formatDollarValue(Math.round(playerEffectiveValue * Math.min(playerProgress / 100, 1)))}
            </p>
            <p className="text-xs text-gray-400">Your Bid</p>
          </div>
          <div className="text-center">
            <p 
              className="text-2xl sm:text-3xl font-bold text-orange-400 tabular-nums drop-shadow-lg"
              style={{ 
                textShadow: '0 0 10px rgba(249, 115, 22, 0.5)',
              }}
            >
              {formatDollarValue(Math.round(opponentEffectiveValue * Math.min(opponentProgress / 100, 1)))}
            </p>
            <p className="text-xs text-gray-400">Opponent Bid</p>
          </div>
        </div>
      </div>
      
      {/* Photo cards - side by side - MOVED DOWN */}
      <div className="absolute top-[38%] left-0 right-0 flex justify-center gap-4 sm:gap-8 px-4 z-10">
        <PhotoBattleCard 
          photo={playerPhoto}
          effectiveValue={playerEffectiveValue}
          requiredTaps={playerRequiredTaps}
          currentTaps={playerTaps}
          isPlayer={true}
          winStreak={playerStats?.current_win_streak || 0}
          loseStreak={playerStats?.current_lose_streak || 0}
          sceneryAdvantage={playerSceneryAdvantage}
        />
        
        <PhotoBattleCard 
          photo={opponentPhoto}
          effectiveValue={opponentEffectiveValue}
          requiredTaps={opponentRequiredTaps}
          currentTaps={opponentTaps}
          isPlayer={false}
          winStreak={opponentStats?.current_win_streak || 0}
          loseStreak={opponentStats?.current_lose_streak || 0}
          sceneryAdvantage={playerSceneryAdvantage === 'strong' ? 'weak' : (playerSceneryAdvantage === 'weak' ? 'strong' : null)}
        />
      </div>
      
      {/* Countdown overlay */}
      <AnimatePresence>
        {gamePhase === 'countdown' && (
          <motion.div 
            className="absolute inset-0 flex items-center justify-center z-30 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex flex-col items-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <motion.span 
                className="text-8xl font-bold text-white drop-shadow-lg"
                key={countdown}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {countdown}
              </motion.span>
              <motion.p
                className="text-2xl text-purple-300 mt-4 font-bold"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                Get Ready!
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Full-screen tap area - OPTIMIZED for 60fps with CSS-only animations */}
      <button
        className={`absolute bottom-0 left-0 right-0 h-[45%] bg-gradient-to-t from-purple-600/30 to-transparent flex flex-col items-center justify-center select-none z-10 tap-zone btn-press ${
          gamePhase !== 'active' ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
        onPointerDown={handleTap}
        onTouchStart={handleTap}
        disabled={gamePhase !== 'active'}
        data-testid="tap-area"
        aria-label="Tap to bid"
        style={{ touchAction: 'manipulation', WebkitUserSelect: 'none' }}
      >
        {gamePhase === 'active' && (
          <>
            <div 
              className="text-6xl mb-4"
              style={{ 
                animation: 'pulse 0.6s ease-in-out infinite',
              }}
            >
              👆
            </div>
            <p className="text-2xl text-white font-bold">TAP TO BID!</p>
            <p className="text-sm text-gray-300 mt-2">
              {playerRequiredTaps - playerTaps} taps remaining
            </p>
          </>
        )}
        
        {gamePhase === 'waiting' && (
          <p className="text-xl text-gray-400">Preparing arena...</p>
        )}
      </button>
      
      {/* Anti-cheat warning */}
      <AnimatePresence>
        {showAntiCheatWarning && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500 text-white rounded-lg flex items-center gap-2 z-40"
          >
            <AlertCircle className="w-5 h-5" />
            <span>Slow down! Max {MAX_TAPS_PER_SECOND} taps/sec</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Result overlay */}
      <AnimatePresence>
        {gamePhase === 'finished' && winner && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="flex flex-col items-center"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', duration: 0.5 }}
            >
              {winner === 'player' ? (
                <>
                  <motion.div
                    className="text-8xl mb-4"
                    animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.5, repeat: 3 }}
                  >
                    🏆
                  </motion.div>
                  <motion.p 
                    className="text-4xl font-bold text-yellow-400"
                    animate={{ textShadow: ['0 0 10px gold', '0 0 30px gold', '0 0 10px gold'] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    WIN!
                  </motion.p>
                </>
              ) : (
                <>
                  <motion.div
                    className="text-8xl mb-4 grayscale"
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1, repeat: 2 }}
                  >
                    😢
                  </motion.div>
                  <motion.p 
                    className="text-4xl font-bold text-red-400"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: [1, 0.7, 1] }}
                    transition={{ duration: 0.5, repeat: 3 }}
                  >
                    LOSE
                  </motion.p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default TappingArena;
