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
 * - Back: All stats displayed BELOW the image
 * - Uniform design across all pages
 */

import React, { useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, Zap, Shield, Flame, Heart, TrendingUp,
  Award, Calendar, Coins, Camera, Lock, Eye
} from 'lucide-react';
import { cn } from '../../lib/utils';

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
  const stamina = photo?.current_stamina ?? photo?.stamina ?? 24;
  const maxStamina = photo?.max_stamina || 24;
  const staminaPercent = (stamina / maxStamina) * 100;
  
  // Win/Loss streaks
  const winStreak = photo?.win_streak || 0;
  const loseStreak = photo?.lose_streak || 0;
  
  // Reactions and bonuses
  const reactions = photo?.total_reactions || 0;
  const reactionBonus = photo?.reaction_bonus_value || 0;
  const monthlyGrowth = photo?.monthly_growth_value || 0;
  const upgradeValue = photo?.total_upgrade_value || 0;
  
  // Authenticity
  const faceScore = photo?.face_detection_score || 0;
  const selfieScore = photo?.selfie_match_score || 0;
  const selfieCompleted = photo?.selfie_match_completed || false;
  const hasFace = photo?.has_face || false;
  
  // Level bonus
  const levelBonus = photo?.level_bonus_percent || Math.floor(level / 5) * 2;
  
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
            hasGoldenFrame && "ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]"
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
        
        {/* BACK: All stats */}
        <div 
          className={cn(
            "absolute w-full backface-hidden rounded-xl overflow-hidden",
            "bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700",
            hasGoldenFrame && "ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.3)]"
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
            
            {/* XP Multiplier (temporary on tap) */}
            {showXPMultiplier && subscription?.xp_multiplier > 1 && (
              <XPMultiplierBadge 
                multiplier={subscription.xp_multiplier} 
                tier={subscription.tier} 
              />
            )}
          </div>
          
          {/* Stats content */}
          <div className="p-3 space-y-2 text-xs">
            {/* Core Dollar Value */}
            <div className="text-center">
              <div className={cn(
                "text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
                scenery.gradient
              )}>
                {formatDollarValue(dollarValue)}
              </div>
              <div className="text-gray-500 text-[10px]">Total Power</div>
            </div>
            
            {/* Level & XP */}
            <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-2">
              <div className="flex items-center gap-2">
                <Award size={14} className="text-amber-400" />
                <span>Lv {level}</span>
                <StarsDisplay count={stars} hasGoldenFrame={hasGoldenFrame} />
              </div>
              <div className="text-gray-400">
                {formatXP(xp)} XP
              </div>
            </div>
            
            {/* Level Bonus */}
            {levelBonus > 0 && (
              <div className="flex items-center justify-between text-green-400">
                <span className="flex items-center gap-1">
                  <TrendingUp size={12} />
                  Level Bonus
                </span>
                <span>+{levelBonus}%</span>
              </div>
            )}
            
            {/* Scenery */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                {scenery.emoji} {scenery.label}
              </span>
              <span className="text-gray-400 text-[10px]">
                {scenery.strong && `Strong vs ${scenery.strong}`}
              </span>
            </div>
            
            {/* Win/Lose Streak */}
            <StreakBadge winStreak={winStreak} loseStreak={loseStreak} />
            
            {/* Reactions Bonus */}
            {reactions > 0 && (
              <div className="flex items-center justify-between text-pink-400">
                <span className="flex items-center gap-1">
                  <Heart size={12} className="fill-pink-400" />
                  {reactions} Reactions
                </span>
                <span>+{formatDollarValue(reactionBonus)}</span>
              </div>
            )}
            
            {/* Monthly Growth */}
            {monthlyGrowth > 0 && (
              <div className="flex items-center justify-between text-blue-400">
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  Monthly Growth
                </span>
                <span>+{formatDollarValue(monthlyGrowth)}</span>
              </div>
            )}
            
            {/* Upgrades */}
            {upgradeValue > 0 && (
              <div className="flex items-center justify-between text-purple-400">
                <span className="flex items-center gap-1">
                  <Coins size={12} />
                  Upgrades
                </span>
                <span>+{formatDollarValue(upgradeValue)}</span>
              </div>
            )}
            
            {/* Authenticity Section */}
            <div className="border-t border-gray-700 pt-2 mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-400">Authenticity</span>
                <span className="text-green-400">
                  {faceScore + selfieScore}%
                </span>
              </div>
              
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between text-gray-500">
                  <span>Face Detection</span>
                  <span>{faceScore}%</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Selfie Match</span>
                  <span>{selfieScore > 0 ? `${selfieScore}%` : 'Not done'}</span>
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
                    "w-full mt-2 py-2 px-3 rounded-lg",
                    "bg-gradient-to-r from-purple-500 to-pink-500",
                    "text-white text-xs font-medium",
                    "flex items-center justify-center gap-2",
                    "hover:from-purple-600 hover:to-pink-600 transition-all",
                    "shadow-lg shadow-purple-500/20"
                  )}
                  data-testid="face-match-button"
                >
                  <Camera size={14} />
                  Face Match (+5%)
                </button>
              )}
              
              {selfieCompleted && (
                <div className="flex items-center justify-center gap-1 text-green-400 text-[10px] mt-1">
                  <Lock size={10} />
                  Authenticity Locked
                </div>
              )}
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
