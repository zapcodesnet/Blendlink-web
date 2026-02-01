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
 */

import React, { useState, memo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  selected = false,
  disabled = false,
  showStats = true,
  showStamina = true,
  showFaceMatch = false,
  onFaceMatchClick,
  size = 'medium', // 'small' | 'medium' | 'large' | 'full'
  className,
  flipped = false,
  subscription = null, // User's subscription for XP multiplier display
}) {
  const [isFlipped, setIsFlipped] = useState(flipped);
  const [showXPMultiplier, setShowXPMultiplier] = useState(false);
  
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  
  // Size configurations
  const sizeConfig = {
    small: { width: 'w-24', height: 'h-32', imageH: 'h-20', textSize: 'text-xs' },
    medium: { width: 'w-36', height: 'h-48', imageH: 'h-28', textSize: 'text-sm' },
    large: { width: 'w-48', height: 'h-64', imageH: 'h-40', textSize: 'text-base' },
    full: { width: 'w-full', height: 'h-auto', imageH: 'aspect-[3/4]', textSize: 'text-base' },
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
  
  // New stats from API
  const ageDays = photo?.age_days || Math.floor((Date.now() - new Date(photo?.minted_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
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
  
  const handleClick = () => {
    if (disabled) return;
    onClick?.(photo);
  };
  
  const handleFlip = (e) => {
    e?.stopPropagation();
    setIsFlipped(!isFlipped);
    setShowXPMultiplier(true);
    // Hide XP multiplier after 3 seconds
    setTimeout(() => setShowXPMultiplier(false), 3000);
    onFlip?.(!isFlipped);
  };
  
  // Card content (shared between normal and golden frame versions)
  const cardContent = (
    <motion.div
      className="relative w-full preserve-3d cursor-pointer"
      animate={{ rotateY: isFlipped ? 180 : 0 }}
      transition={{ duration: 0.5 }}
      style={{ transformStyle: 'preserve-3d' }}
    >
      {/* FRONT: Clean image only */}
      <div 
        className={cn(
          "absolute w-full backface-hidden rounded-xl overflow-hidden",
          "bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700",
          hasGoldenFrame && !seniorityAchieved && "ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]"
        )}
        style={{ backfaceVisibility: 'hidden' }}
      >
        {/* Clean image - NO overlays */}
        <div className={cn("relative w-full", config.imageH)}>
          <img
            src={photo?.image_url || photo?.thumbnail_url || '/placeholder-photo.jpg'}
            alt={photo?.name || 'Minted Photo'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Seniority Level 60 sparkle indicator */}
          {seniorityAchieved && (
            <div className="absolute top-1 right-1">
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Sparkles size={20} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
              </motion.div>
            </div>
          )}
        </div>
        
        {/* Stats BELOW image only */}
        {showStats && (
          <div className="p-2 space-y-1 bg-black/60">
            {/* Dollar Value & Level */}
            <div className="flex items-center justify-between">
              <span className={cn(
                "font-bold bg-gradient-to-r bg-clip-text text-transparent",
                scenery.gradient,
                config.textSize
              )}>
                {formatDollarValue(dollarValue)}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-gray-400 text-xs">Lv{level}</span>
                <StarsDisplay count={stars} hasGoldenFrame={hasGoldenFrame} />
              </div>
            </div>
            
            {/* Scenery Badge */}
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full w-fit",
              `bg-gradient-to-r ${scenery.bgGradient}`
            )}>
              <span className="text-sm">{scenery.emoji}</span>
              <span className="text-xs text-white/90">{scenery.label}</span>
            </div>
            
            {/* Stamina Bar */}
            {showStamina && (
              <div className="space-y-0.5">
                <div className="flex justify-between text-[10px] text-gray-400">
                  <span>⚡ Stamina</span>
                  <span>{stamina}/{maxStamina}</span>
                </div>
                <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all",
                      staminaPercent > 50 ? "bg-green-500" : 
                      staminaPercent > 25 ? "bg-yellow-500" : "bg-red-500"
                    )}
                    style={{ width: `${staminaPercent}%` }}
                  />
                </div>
              </div>
            )}
            
            {/* Flip indicator */}
            <button 
              onClick={handleFlip}
              className="w-full text-center text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              Tap to flip →
            </button>
          </div>
        )}
      </div>
        
        {/* BACK: All stats - Scrollable content for smaller cards */}
        <div 
          className={cn(
            "absolute w-full backface-hidden rounded-xl overflow-hidden",
            "bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700",
            hasGoldenFrame && !seniorityAchieved && "ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]"
          )}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {/* Small preview image at top */}
          <div className="relative h-16 w-full">
            <img
              src={photo?.image_url || photo?.thumbnail_url}
              alt={photo?.name}
              className="w-full h-full object-cover opacity-50"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-gray-900" />
            
            {/* Seniority Level 60 sparkle on back too */}
            {seniorityAchieved && (
              <div className="absolute top-1 right-1">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Sparkles size={20} className="text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
                </motion.div>
              </div>
            )}
            
            {/* XP Multiplier (temporary on tap) */}
            {showXPMultiplier && subscription?.xp_multiplier > 1 && (
              <XPMultiplierBadge 
                multiplier={subscription.xp_multiplier} 
                tier={subscription.tier} 
              />
            )}
          </div>
          
          {/* Stats content - Scrollable */}
          <div className="p-3 space-y-2 text-xs max-h-[calc(100%-4rem)] overflow-y-auto custom-scrollbar">
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
              onClick={handleFlip}
              className="w-full text-center text-[10px] text-gray-500 hover:text-gray-300 transition-colors mt-2"
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
      onClick={handleClick}
      data-testid={`photo-card-${photo?.mint_id}`}
    >
      {/* Wrap in Golden Sparkling Frame for Level 60 Seniority */}
      {seniorityAchieved ? (
        <GoldenSparklingFrame>
          {cardContent}
        </GoldenSparklingFrame>
      ) : (
        cardContent
      )}
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
                    "min-h-[48px]" // Large touch target for mobile
                  )}
                  title="Take a quick live selfie to add up to 5% Authenticity bonus (optional, one-time per photo)"
                  data-testid="face-match-button"
                >
                  <Camera size={16} />
                  Face Match (+5%)
                </button>
              )}
              
              {/* Show locked state after successful match */}
              {selfieCompleted && (
                <div className="flex items-center justify-center gap-1.5 text-green-400 text-xs mt-2 py-1.5 bg-green-500/10 rounded-lg">
                  <Lock size={12} />
                  Authenticity Locked Forever
                </div>
              )}
              
              {/* Show hint if face detected but no selfie done yet */}
              {hasFace && !selfieCompleted && !showFaceMatch && (
                <div className="text-[10px] text-purple-400/70 text-center mt-1">
                  Flip card to access Face Match
                </div>
              )}
            </div>
            
            {/* ========== NEW STATS SECTION (below Authenticity) ========== */}
            <div className="border-t border-gray-700 pt-3 mt-3 space-y-2">
              <div className="text-xs font-semibold text-gray-300 flex items-center gap-1 mb-2">
                <Award size={12} className="text-amber-400" />
                Photo Stats & Progression
              </div>
              
              {/* Stars */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1.5 text-xs">
                  <Star size={12} className="text-amber-400" />
                  Stars
                </span>
                <div className="flex items-center gap-1">
                  <StarsDisplay count={stars} hasGoldenFrame={hasGoldenFrame} />
                  {stars > 0 && (
                    <span className="text-green-400 text-[10px]">
                      +{formatDollarValue(stars * 1_000_000)}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Level with XP Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 flex items-center gap-1.5 text-xs">
                    <Award size={12} className="text-purple-400" />
                    Level
                  </span>
                  <span className="text-white font-bold">
                    Lv {level}
                    {levelBonus > 0 && (
                      <span className="text-green-400 text-[10px] ml-1">+{levelBonus}%</span>
                    )}
                  </span>
                </div>
                
                {/* XP Progress Bar */}
                <div className="space-y-0.5">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(xpProgress || 0, 100)}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-500">
                    <span>{formatXP(xp)} XP</span>
                    <span>{Math.round(xpProgress || 0)}%</span>
                  </div>
                </div>
              </div>
              
              {/* Age */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1.5 text-xs">
                  <Calendar size={12} className="text-blue-400" />
                  Age
                </span>
                <div className="text-right">
                  <span className="text-white text-xs">
                    {photo.age_days || Math.floor((Date.now() - new Date(photo.minted_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24))} days
                  </span>
                  {(photo.age_bonus || ageBonus || 0) > 0 && (
                    <span className="text-green-400 text-[10px] ml-1">
                      +{formatDollarValue(photo.age_bonus || ageBonus || 0)}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Reactions */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1.5 text-xs">
                  <Heart size={12} className="text-pink-400 fill-pink-400" />
                  Reactions
                </span>
                <div className="text-right">
                  <span className="text-white text-xs">❤️ {reactions || 0}</span>
                  {(reactionBonus || 0) > 0 && (
                    <span className="text-green-400 text-[10px] ml-1">
                      +{formatDollarValue(reactionBonus || 0)}
                    </span>
                  )}
                </div>
              </div>
              
              {/* BL Coins */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1.5 text-xs">
                  <Coins size={12} className="text-yellow-400" />
                  BL Coins Spent
                </span>
                <div className="text-right">
                  <span className="text-yellow-400 text-xs">
                    {(photo.bl_coins_spent || upgradeValue || 0).toLocaleString()} BL
                  </span>
                  {(upgradeValue || 0) > 0 && (
                    <span className="text-green-400 text-[10px] ml-1">
                      +{formatDollarValue(upgradeValue || 0)}
                    </span>
                  )}
                </div>
              </div>
              
              {/* Seniority */}
              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1.5 text-xs">
                  <Zap size={12} className={level >= 60 ? "text-yellow-400" : "text-gray-500"} />
                  Seniority
                </span>
                <div className="text-right">
                  {level >= 60 ? (
                    <span className="text-yellow-400 text-xs font-bold animate-pulse">
                      ✨ MAX (+20%)
                    </span>
                  ) : (
                    <span className="text-gray-500 text-xs">
                      {60 - level} levels to max
                    </span>
                  )}
                </div>
              </div>
              
              {/* Base Value reminder */}
              <div className="border-t border-gray-700/50 pt-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-[10px]">Base Value</span>
                  <span className="text-gray-400 text-xs">{formatDollarValue(baseDollarValue)}</span>
                </div>
              </div>
            </div>
            
            {/* Flip back */}
            <button 
              onClick={handleFlip}
              className="w-full text-center text-[10px] text-gray-500 hover:text-gray-300 transition-colors mt-2"
            >
              ← Tap to flip back
            </button>
          </div>
        </div>
      </motion.div>
      
      {/* Static height placeholder to prevent layout shift */}
      <div className={cn(config.height, "invisible")} />
    </div>
  );
});

export default UnifiedPhotoCard;
