/**
 * UnifiedPhotoCard Component
 * 
 * A consistent, reusable photo card component used across all pages:
 * - Minted Photos page
 * - Photo Game Arena
 * - Battle Arena (PVP/Bot)
 * - Profile & Settings
 * 
 * Design Rules:
 * - Front: Clean image ONLY (no overlays, text, icons on image)
 * - Back: All stats displayed BELOW the image including new progression stats
 * - XP meter bar shown below Base Value
 * - Golden sparkling frame animation for Seniority Level 60
 * - Uniform design across all pages
 * 
 * CARD FRONT LAYOUT (Top to Bottom):
 * 1. Photo Image (75% of card height)
 * 2. Name
 * 3. Dollar Value & Stars
 * 4. Scenery & Level
 * 5. Stamina
 * 6. Streaks (Win/Loss)
 * 7. Small "Tap to flip" button at bottom
 * 
 * SCROLLING FIX (v3 - Robust):
 * - Default touch-action: pan-y on all elements - NEVER prevents scroll by default
 * - Swipe gesture detection happens WITHOUT preventDefault - scroll always works
 * - Only flip is triggered when horizontal swipe threshold is met
 * - No touch event cancellation - let browser handle scroll natively
 */

import React, { useState, memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Star, Zap, Shield, Flame, Heart, TrendingUp,
  Award, Calendar, Coins, Camera, Lock, Eye, Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';

// Golden Sparkling Frame Animation Component for Level 60 Seniority
const GoldenSparklingFrame = ({ children }) => {
  return (
    <div className="relative">
      {/* Animated sparkle particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1.5 h-1.5 bg-yellow-300 rounded-full shadow-[0_0_6px_2px_rgba(250,204,21,0.8)]"
            initial={{
              x: `${(i % 4) * 33}%`,
              y: i < 4 ? '-10%' : i < 8 ? '110%' : `${(i - 8) * 50}%`,
              opacity: 0
            }}
            animate={{
              x: [
                `${(i % 4) * 33}%`,
                `${((i + 1) % 4) * 33}%`,
                `${((i + 2) % 4) * 33}%`,
              ],
              y: i < 4 
                ? ['-10%', '110%']
                : i < 8 
                  ? ['110%', '-10%'] 
                  : [`${(i - 8) * 50}%`, `${100 - (i - 8) * 50}%`],
              opacity: [0, 1, 1, 0],
            }}
            transition={{
              duration: 3 + (i * 0.3),
              repeat: Infinity,
              delay: i * 0.25,
              ease: "linear"
            }}
          />
        ))}
      </div>
      
      {/* Pulsing golden border */}
      <motion.div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: 'linear-gradient(45deg, rgba(250,204,21,0.3), rgba(234,179,8,0.1), rgba(250,204,21,0.3))',
          boxShadow: '0 0 20px rgba(250,204,21,0.4), inset 0 0 15px rgba(250,204,21,0.2)',
        }}
        animate={{
          boxShadow: [
            '0 0 20px rgba(250,204,21,0.4), inset 0 0 15px rgba(250,204,21,0.2)',
            '0 0 35px rgba(250,204,21,0.6), inset 0 0 25px rgba(250,204,21,0.3)',
            '0 0 20px rgba(250,204,21,0.4), inset 0 0 15px rgba(250,204,21,0.2)',
          ]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      
      {children}
    </div>
  );
};

// Scenery configuration - matches backend
export const SCENERY_CONFIG = {
  natural: { 
    gradient: 'from-emerald-500 to-green-600', 
    bgGradient: 'from-emerald-500/20 to-green-600/20',
    emoji: '🌿', 
    label: 'Natural',
    color: '#22C55E',
    strong: 'Water',
    weak: 'Man-made'
  },
  water: { 
    gradient: 'from-blue-500 to-cyan-500', 
    bgGradient: 'from-blue-500/20 to-cyan-500/20',
    emoji: '🌊', 
    label: 'Water',
    color: '#3B82F6',
    strong: 'Man-made',
    weak: 'Natural'
  },
  manmade: { 
    gradient: 'from-orange-500 to-red-500', 
    bgGradient: 'from-orange-500/20 to-red-500/20',
    emoji: '🏙️', 
    label: 'Man-made',
    color: '#F97316',
    strong: 'Natural',
    weak: 'Water'
  },
  neutral: {
    gradient: 'from-gray-500 to-gray-600',
    bgGradient: 'from-gray-500/20 to-gray-600/20',
    emoji: '⬜',
    label: 'Neutral',
    color: '#6B7280',
    strong: null,
    weak: null
  }
};

// Format dollar value
export const formatDollarValue = (value) => {
  if (!value || value === 0) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
};

// Format XP
export const formatXP = (xp) => {
  if (xp >= 1000) return `${(xp / 1000).toFixed(1)}K`;
  return xp.toString();
};

// Calculate stars from level
export const getStarsFromLevel = (level) => {
  if (level >= 60) return 5;
  if (level >= 40) return 4;
  if (level >= 25) return 3;
  if (level >= 15) return 2;
  if (level >= 5) return 1;
  return 0;
};

// Stars display component
const StarsDisplay = ({ count, hasGoldenFrame }) => {
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          size={12}
          className={cn(
            "transition-all",
            i < count 
              ? hasGoldenFrame 
                ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.6)]"
                : "fill-amber-400 text-amber-400"
              : "text-gray-600"
          )}
        />
      ))}
    </div>
  );
};

// Streak badge component
const StreakBadge = ({ winStreak, loseStreak }) => {
  if (winStreak >= 3) {
    const multiplier = 1 + (winStreak * 0.1); // 10% per win streak
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 rounded-full text-orange-400 text-xs">
        <Flame size={12} className="fill-orange-400" />
        <span>{winStreak}🔥</span>
        <span className="text-orange-300 text-[10px]">×{multiplier.toFixed(1)}</span>
      </div>
    );
  }
  
  if (loseStreak >= 3) {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 rounded-full text-blue-400 text-xs">
        <Shield size={12} className="fill-blue-400" />
        <span>🛡️ Immunity</span>
      </div>
    );
  }
  
  return null;
};

// Subscription multiplier badge (temporary display)
const XPMultiplierBadge = ({ multiplier, tier }) => {
  if (!multiplier || multiplier <= 1) return null;
  
  const tierColors = {
    bronze: 'from-amber-600 to-amber-800',
    silver: 'from-gray-400 to-gray-600',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-purple-400 to-purple-600'
  };
  
  return (
    <div className={cn(
      "absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-bold",
      "bg-gradient-to-r backdrop-blur-sm bg-opacity-80",
      tierColors[tier] || 'from-gray-500 to-gray-700',
      "text-white shadow-lg"
    )}>
      ×{multiplier} XP
    </div>
  );
};

// Main UnifiedPhotoCard component
const UnifiedPhotoCard = memo(function UnifiedPhotoCard({
  photo,
  onClick,
  onFlip,
  onFlipStateChange,
  selected = false,
  disabled = false,
  showStats = true,
  showStamina = true,
  showFaceMatch = false,
  onFaceMatchClick,
  onUpgradeClick,
  size = 'medium',
  className,
  flipped = false,
  subscription = null,
}) {
  const [showXPMultiplier, setShowXPMultiplier] = useState(false);
  const cardRef = useRef(null);
  
  // Use flipped prop directly instead of internal state
  const isFlipped = flipped;
  
  // SCROLL FIX: Removed all touch event handlers and onClick from card container
  // Card flipping now ONLY works via "Tap to flip" button
  // pointer-events: none on most elements allows touch events to pass through for scrolling
  
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  
  // Size configurations - INCREASED by 3% to fit Name and Tap to flip
  // Original: small=128x208, medium=160x256, large=208x320
  // +3%: small=132x214, medium=165x264, large=214x330
  const sizeConfig = {
    small: { width: 'w-[132px]', height: 'h-[214px]' },
    medium: { width: 'w-[165px]', height: 'h-[264px]' },
    large: { width: 'w-[214px]', height: 'h-[330px]' },
    full: { width: 'w-full', height: 'h-auto' },
  };
  const config = sizeConfig[size] || sizeConfig.medium;
  
  // Photo stats
  const dollarValue = photo?.dollar_value || photo?.base_dollar_value || 0;
  const level = photo?.level || 1;
  const xp = photo?.xp || 0;
  const stars = photo?.stars || getStarsFromLevel(level);
  const hasGoldenFrame = photo?.has_golden_frame || level >= 60;
  const maxStamina = photo?.max_stamina || 24;
  // Normalize stamina to not exceed max
  const rawStamina = photo?.current_stamina ?? photo?.stamina ?? maxStamina;
  const stamina = Math.min(rawStamina, maxStamina);
  const staminaPercent = Math.min((stamina / maxStamina) * 100, 100);
  
  // Win/Loss streaks
  const winStreak = photo?.win_streak || 0;
  const loseStreak = photo?.lose_streak || 0;
  
  // Reactions and bonuses
  const reactions = photo?.total_reactions || 0;
  const reactionBonus = photo?.reaction_bonus_value || 0;
  const monthlyGrowth = photo?.monthly_growth_value || 0;
  const upgradeValue = photo?.total_upgrade_value || 0;
  
  // New stats from back-card
  const ageBonus = photo?.age_bonus_value || photo?.age_bonus || 0;
  const xpProgress = photo?.xp_progress?.progress_percent || photo?.xp_progress_percent || 0;
  const baseDollarValue = photo?.base_dollar_value || dollarValue;
  
  // Authenticity
  const faceScore = photo?.face_detection_score || 0;
  const selfieScore = photo?.selfie_match_score || 0;
  const selfieCompleted = photo?.selfie_match_completed || false;
  const hasFace = photo?.has_face || false;
  
  // Level bonus
  const levelBonus = photo?.level_bonus_percent || Math.floor(level / 5) * 2;
  
  // New stats from API - Prefer server-calculated values
  const ageDays = photo?.age_days ?? 0;
  const starBonusValue = photo?.star_bonus_value || 0;
  const seniorityAchieved = photo?.seniority_achieved || level >= 60;
  const seniorityBonusValue = photo?.seniority_bonus_value || 0;
  const levelsToSeniority = photo?.levels_to_seniority || Math.max(0, 60 - level);
  const blCoinsSpent = photo?.bl_coins_spent || upgradeValue || 0;
  const reactionsToNextBonus = photo?.reactions_to_next_bonus || (100 - (reactions % 100));
  
  // XP Progress data
  const xpProgressData = photo?.xp_progress || {};
  const xpToNextLevel = xpProgressData.remaining || photo?.xp_to_next_level || 10;
  const xpForNextLevel = xpProgressData.xp_for_next_level || photo?.xp_for_next_level || 10;
  
  const handleClick = useCallback((e) => {
    if (disabled) return;
    // Don't trigger onClick if the card is flipped (back side showing)
    // This prevents lightbox from opening when interacting with back content
    if (isFlipped) {
      return;
    }
    // Don't trigger onClick if the click was on the flip button or flip back button
    if (e?.target?.closest('[data-testid="flip-card-btn"]') || 
        e?.target?.closest('[data-testid="flip-back-btn"]')) {
      return;
    }
    onClick?.(photo);
  }, [disabled, onClick, photo, isFlipped]);
  
  const handleFlip = useCallback((e) => {
    // SCROLL FIX: Only stop propagation, NOT preventDefault
    // This allows the browser to continue handling scroll events
    if (e) {
      e.stopPropagation();
    }
    const newFlippedState = !isFlipped;
    setShowXPMultiplier(true);
    setTimeout(() => setShowXPMultiplier(false), 3000);
    onFlipStateChange?.(newFlippedState);
    onFlip?.(newFlippedState);
  }, [isFlipped, onFlip, onFlipStateChange]);
  
  // Card content - SCROLL FIX: Minimal framer-motion, no touch interference
  const cardContent = (
    <motion.div
      className={cn(
        "relative w-full preserve-3d",
        config.height,
        isFlipped && "shadow-2xl shadow-black/50"
      )}
      animate={{ 
        rotateY: isFlipped ? 180 : 0,
        scale: isFlipped ? 1.05 : 1,
      }}
      transition={{ duration: 0.5 }}
      style={{ 
        transformStyle: 'preserve-3d',
        zIndex: isFlipped ? 100 : 1,
      }}
    >
      {/* FRONT: Photo + Stats - 70% image / 30% details */}
      <div 
        className={cn(
          "absolute inset-0 backface-hidden rounded-xl overflow-hidden flex flex-col",
          "bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700",
          hasGoldenFrame && !seniorityAchieved && "ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]"
        )}
        style={{ backfaceVisibility: 'hidden' }}
      >
        {/* Photo Image - 70% of card height - NO pointer events */}
        <div 
          className="relative w-full pointer-events-none"
          style={{ height: '70%', minHeight: '70%' }}
        >
          <img
            src={photo?.image_url || photo?.thumbnail_url || '/placeholder-photo.jpg'}
            alt={photo?.name || 'Minted Photo'}
            className="w-full h-full object-cover select-none pointer-events-none"
            loading="lazy"
            draggable={false}
          />
          {/* Seniority Level 60 sparkle indicator */}
          {seniorityAchieved && (
            <div className="absolute top-1 right-1 pointer-events-none">
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Sparkles size={16} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
              </motion.div>
            </div>
          )}
        </div>
        
        {/* Stats Section - 30% of card height - ALL TEXT VISIBLE including "Tap to flip" */}
        {showStats && (
          <div 
            className="bg-gradient-to-b from-black/90 to-black/70 flex flex-col px-1.5 py-1 pointer-events-none"
            style={{ 
              height: '30%', 
              maxHeight: '30%', 
              overflow: 'hidden',
            }}
          >
            {/* NAME - Top of details, directly below image - YELLOW PROMINENT */}
            <div className="text-yellow-400 font-bold truncate text-center text-[11px] sm:text-[10px] leading-tight bg-black/50 rounded mb-0.5 py-0.5 min-h-[14px]">
              {photo?.name || photo?.title || 'Unnamed Photo'}
            </div>
            
            {/* DOLLAR VALUE & STARS - Single row */}
            <div className="flex items-center justify-between">
              <span className={cn(
                "font-bold bg-gradient-to-r bg-clip-text text-transparent text-[9px]",
                scenery.gradient
              )}>
                {formatDollarValue(dollarValue)}
              </span>
              <StarsDisplay count={stars} hasGoldenFrame={hasGoldenFrame} />
            </div>
            
            {/* SCENERY & LEVEL - Single row */}
            <div className="flex items-center justify-between">
              <div className={cn(
                "flex items-center gap-0.5 px-1 rounded-full",
                `bg-gradient-to-r ${scenery.bgGradient}`
              )}>
                <span className="text-[7px]">{scenery.emoji}</span>
                <span className="text-[7px] text-white/90">{scenery.label}</span>
              </div>
              <span className="text-purple-400 font-bold text-[8px]">Lv{level}</span>
            </div>
            
            {/* STAMINA BAR - Compact */}
            {showStamina && (
              <div className="flex items-center gap-0.5">
                <span className="text-[7px] text-gray-400">⚡</span>
                <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full",
                      staminaPercent > 50 ? "bg-green-500" : 
                      staminaPercent > 25 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${staminaPercent}%` }}
                  />
                </div>
                <span className="text-[7px] text-gray-400">{stamina}/{maxStamina}</span>
              </div>
            )}
            
            {/* WIN/LOSE STREAKS - Only show if significant */}
            {(winStreak >= 3 || loseStreak >= 3) && (
              <div className="flex items-center justify-center gap-1">
                {winStreak >= 3 && <span className="text-[7px] text-orange-400">🔥{winStreak}</span>}
                {loseStreak >= 3 && <span className="text-[7px] text-blue-400">🛡️</span>}
              </div>
            )}
            
            {/* TAP TO FLIP - VISIBLE on mobile with larger text - HAS pointer-events */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleFlip(e);
              }}
              className="text-center text-[9px] text-gray-300 hover:text-white border-t border-gray-500 pt-1 mt-auto -mx-1.5 px-1.5 font-medium pointer-events-auto"
              data-testid="flip-card-btn"
              style={{ minHeight: '18px' }}
            >
              Tap to flip →
            </button>
          </div>
        )}
      </div>
        
      {/* BACK: Stats view */}
      <div 
        className={cn(
          "absolute inset-0 rounded-xl overflow-hidden pointer-events-none",
          "bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700",
          hasGoldenFrame && !seniorityAchieved && "ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]"
        )}
        style={{ 
          backfaceVisibility: 'hidden', 
          transform: 'rotateY(180deg)',
        }}
      >
        {/* Small preview image at top */}
        <div className="relative h-12 w-full pointer-events-none">
          <img
            src={photo?.image_url || photo?.thumbnail_url}
            alt={photo?.name}
            className="w-full h-full object-cover opacity-50 pointer-events-none"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-900" />
        </div>
        
        {/* Stats content - Scrollable */}
        <div 
          className="p-2 space-y-1 text-[10px] overflow-y-auto"
          style={{ maxHeight: 'calc(100% - 3rem)' }}
        >
          {/* ========== BASE VALUE SECTION ========== */}
          <div className="text-center border-b border-gray-700/50 pb-2">
            <div className="text-gray-500 text-[10px] mb-1">Base Value</div>
            <div className={cn(
              "text-lg font-bold bg-gradient-to-r bg-clip-text text-transparent",
              scenery.gradient
            )}>
              {formatDollarValue(baseDollarValue)}
            </div>
          </div>
            
            {/* ========== XP METER BAR (Below Base Value) ========== */}
            <div className="bg-gray-800/50 rounded-lg p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award size={14} className="text-purple-400" />
                  <span className="font-semibold">Lv {level}</span>
                  <StarsDisplay count={stars} hasGoldenFrame={hasGoldenFrame} />
                </div>
                <div className="text-gray-400 text-[10px]">
                  {formatXP(xp)} / {formatXP(xpForNextLevel)} XP
                </div>
              </div>
              
              {/* XP Progress Bar with percentage */}
              <div className="space-y-0.5">
                <div className="h-2.5 bg-gray-700 rounded-full overflow-hidden relative">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 relative"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(xpProgress || 0, 100)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  >
                    {/* Shimmer effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                  </motion.div>
                  {/* Percentage text inside bar */}
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white drop-shadow-md">
                    {Math.round(xpProgress || 0)}%
                  </span>
                </div>
                <div className="flex justify-between text-[9px] text-gray-500">
                  <span>{xpToNextLevel} XP to Lv{level + 1}</span>
                  {levelBonus > 0 && <span className="text-green-400">+{levelBonus}% boost</span>}
                </div>
              </div>
            </div>
            
            {/* ========== TOTAL POWER (All bonuses combined) ========== */}
            <div className="text-center py-2 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 rounded-lg">
              <div className="text-gray-400 text-[10px]">Total Dollar Value (Core Power)</div>
              <div className={cn(
                "text-2xl font-bold bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-400 bg-clip-text text-transparent"
              )}>
                {formatDollarValue(dollarValue)}
              </div>
            </div>
            
            {/* ========== AUTHENTICITY SECTION ========== */}
            <div className="border-t border-gray-700 pt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400 flex items-center gap-1">
                  <Shield size={12} />
                  Authenticity
                </span>
                <span className="text-green-400 font-medium">
                  {faceScore + selfieScore}%
                </span>
              </div>
              
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between text-gray-500">
                  <span>Face Detection</span>
                  <span>{faceScore}% / 5%</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Selfie Match</span>
                  <span>{selfieScore > 0 ? `${selfieScore}% / 5%` : 'Not done'}</span>
                </div>
              </div>
              
              {/* Face Match Button */}
              {showFaceMatch && hasFace && !selfieCompleted && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFaceMatchClick?.(photo);
                  }}
                  className={cn(
                    "w-full mt-2 py-2.5 px-3 rounded-lg",
                    "bg-gradient-to-r from-purple-500 to-pink-500",
                    "text-white text-xs font-semibold",
                    "flex items-center justify-center gap-2",
                    "hover:from-purple-600 hover:to-pink-600 transition-all",
                    "shadow-lg shadow-purple-500/20",
                    "min-h-[44px]"
                  )}
                  data-testid="face-match-button"
                >
                  <Camera size={16} />
                  Face Match (+5%)
                </button>
              )}
              
              {selfieCompleted && (
                <div className="flex items-center justify-center gap-1.5 text-green-400 text-xs mt-2 py-1.5 bg-green-500/10 rounded-lg">
                  <Lock size={12} />
                  Authenticity Locked Forever
                </div>
              )}
            </div>
            
            {/* ========== NEW STATS SECTION (Below Authenticity) ========== */}
            <div className="border-t border-gray-700 pt-3 space-y-2">
              <div className="text-xs font-semibold text-gray-300 flex items-center gap-1 mb-2">
                <Sparkles size={12} className="text-amber-400" />
                Photo Stats & Bonuses
              </div>
              
              {/* 1. Stars - +$1M + 10% per star milestone */}
              <div className="flex items-center justify-between bg-gray-800/30 rounded-lg px-2 py-1.5">
                <span className="text-gray-400 flex items-center gap-1.5 text-xs">
                  <Star size={12} className="text-amber-400 fill-amber-400" />
                  Stars
                </span>
                <div className="flex items-center gap-2">
                  <StarsDisplay count={stars} hasGoldenFrame={hasGoldenFrame} />
                  {starBonusValue > 0 && (
                    <span className="text-green-400 text-[10px] font-medium">
                      +{formatDollarValue(starBonusValue)}
                    </span>
                  )}
                </div>
              </div>
              
              {/* 2. Level (already shown above in XP meter) */}
              <div className="flex items-center justify-between bg-gray-800/30 rounded-lg px-2 py-1.5">
                <span className="text-gray-400 flex items-center gap-1.5 text-xs">
                  <Award size={12} className="text-purple-400" />
                  Level
                </span>
                <div className="text-right">
                  <span className="text-white font-bold">Lv {level}</span>
                  {levelBonus > 0 && (
                    <span className="text-green-400 text-[10px] ml-1">+{levelBonus}%</span>
                  )}
                </div>
              </div>
              
              {/* 3. Age - +$1M every 30 days */}
              <div className="flex items-center justify-between bg-gray-800/30 rounded-lg px-2 py-1.5">
                <span className="text-gray-400 flex items-center gap-1.5 text-xs">
                  <Calendar size={12} className="text-blue-400" />
                  Age
                </span>
                <div className="text-right">
                  <span className="text-white text-xs">{ageDays} days</span>
                  {ageBonus > 0 && (
                    <span className="text-green-400 text-[10px] ml-1">
                      +{formatDollarValue(ageBonus)}
                    </span>
                  )}
                </div>
              </div>
              
              {/* 4. Reactions - +$1M per 100 reactions */}
              <div className="flex items-center justify-between bg-gray-800/30 rounded-lg px-2 py-1.5">
                <span className="text-gray-400 flex items-center gap-1.5 text-xs">
                  <Heart size={12} className="text-pink-400 fill-pink-400" />
                  Reactions
                </span>
                <div className="text-right">
                  <span className="text-white text-xs">❤️ {reactions}</span>
                  {reactionBonus > 0 && (
                    <span className="text-green-400 text-[10px] ml-1">
                      +{formatDollarValue(reactionBonus)}
                    </span>
                  )}
                  {reactions > 0 && reactionsToNextBonus < 100 && (
                    <div className="text-[9px] text-gray-500">
                      {reactionsToNextBonus} to next +$1M
                    </div>
                  )}
                </div>
              </div>
              
              {/* 5. BL Coins - Dollar Value boost */}
              <div className="flex items-center justify-between bg-gray-800/30 rounded-lg px-2 py-1.5">
                <span className="text-gray-400 flex items-center gap-1.5 text-xs">
                  <Coins size={12} className="text-yellow-400" />
                  BL Coins
                </span>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="text-yellow-400 text-xs">
                      {blCoinsSpent.toLocaleString()} BL
                    </span>
                    {upgradeValue > 0 && (
                      <span className="text-green-400 text-[10px] ml-1">
                        +{formatDollarValue(upgradeValue)}
                      </span>
                    )}
                  </div>
                  {/* Upgrade Button */}
                  {onUpgradeClick && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpgradeClick?.(photo);
                      }}
                      className={cn(
                        "px-2 py-1 rounded text-[10px] font-bold",
                        "bg-gradient-to-r from-yellow-500 to-amber-500",
                        "hover:from-yellow-600 hover:to-amber-600",
                        "text-black transition-all",
                        "shadow-md shadow-yellow-500/30"
                      )}
                      data-testid="upgrade-dollar-value-btn"
                    >
                      Upgrade
                    </button>
                  )}
                </div>
              </div>
              
              {/* 6. Seniority - Level 60 bonus (+$1M + 20%) */}
              <div className={cn(
                "flex items-center justify-between rounded-lg px-2 py-1.5",
                seniorityAchieved 
                  ? "bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-500/20 border border-yellow-500/30" 
                  : "bg-gray-800/30"
              )}>
                <span className={cn(
                  "flex items-center gap-1.5 text-xs",
                  seniorityAchieved ? "text-yellow-400" : "text-gray-400"
                )}>
                  <Zap size={12} className={seniorityAchieved ? "text-yellow-400 fill-yellow-400" : "text-gray-500"} />
                  Seniority
                </span>
                <div className="text-right">
                  {seniorityAchieved ? (
                    <div className="flex items-center gap-1">
                      <motion.span
                        className="text-yellow-400 text-xs font-bold"
                        animate={{ 
                          textShadow: [
                            '0 0 4px rgba(250,204,21,0.4)',
                            '0 0 12px rgba(250,204,21,0.8)',
                            '0 0 4px rgba(250,204,21,0.4)'
                          ]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        ✨ MAX
                      </motion.span>
                      <span className="text-green-400 text-[10px]">
                        +{formatDollarValue(seniorityBonusValue)}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-500 text-xs">
                      {levelsToSeniority} levels to max
                    </span>
                  )}
                </div>
              </div>
              
              {/* Scenery & Streaks */}
              <div className="border-t border-gray-700/50 pt-2 mt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    {scenery.emoji} {scenery.label}
                  </span>
                  <span className="text-gray-400 text-[10px]">
                    {scenery.strong && `💪 vs ${scenery.strong}`}
                  </span>
                </div>
                
                {/* Win/Lose Streak */}
                <StreakBadge winStreak={winStreak} loseStreak={loseStreak} />
              </div>
            </div>
            
            {/* Flip back */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleFlip(e);
              }}
              className="w-full text-center text-[10px] text-gray-500 hover:text-gray-300 transition-colors mt-2 pointer-events-auto"
              data-testid="flip-back-btn"
            >
              ← Tap to flip back
            </button>
          </div>
        </div>
      </motion.div>
  );
  
  return (
    <div 
      className={cn(
        "relative perspective-1000",
        config.width,
        disabled && "opacity-50 cursor-not-allowed",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        className
      )}
      style={{ 
        zIndex: isFlipped ? 50 : 'auto',
      }}
      data-testid={`photo-card-${photo?.mint_id}`}
      data-flipped={isFlipped}
    >
      {seniorityAchieved ? (
        <GoldenSparklingFrame>
          {cardContent}
        </GoldenSparklingFrame>
      ) : (
        cardContent
      )}
    </div>
  );
});

export default UnifiedPhotoCard;
