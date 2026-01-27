import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Shield } from 'lucide-react';

// Win streak multipliers (exact values from spec)
const WIN_STREAK_MULTIPLIERS = {
  3: 1.25,
  4: 1.50,
  5: 1.75,
  6: 2.00,
  7: 2.25,
  8: 2.50,
  9: 2.75,
  10: 3.00,
};

// Streak Indicator Component
export const StreakIndicator = ({ 
  winStreak = 0, 
  loseStreak = 0, 
  isOwner = true,
  showTooltip = true,
  size = "medium" // small, medium, large
}) => {
  const hasFireStreak = winStreak >= 3;
  const hasShieldImmunity = loseStreak >= 3;
  
  const sizeClasses = {
    small: { icon: "w-4 h-4", text: "text-xs", container: "px-2 py-1" },
    medium: { icon: "w-5 h-5", text: "text-sm", container: "px-3 py-1.5" },
    large: { icon: "w-6 h-6", text: "text-base", container: "px-4 py-2" },
  };
  
  const styles = sizeClasses[size] || sizeClasses.medium;
  
  if (!hasFireStreak && !hasShieldImmunity) {
    return null;
  }
  
  const multiplier = hasFireStreak ? WIN_STREAK_MULTIPLIERS[Math.min(winStreak, 10)] : null;
  
  return (
    <div className="flex items-center gap-2">
      {/* Win Streak (Fire) */}
      <AnimatePresence>
        {hasFireStreak && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={`relative flex items-center gap-1 ${styles.container} rounded-full bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/50`}
            title={showTooltip ? `×${multiplier?.toFixed(2)} Power Multiplier` : undefined}
          >
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1],
                rotate: [0, 5, -5, 0],
              }}
              transition={{ 
                duration: 1.5, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Flame className={`${styles.icon} text-orange-500 fill-orange-500`} />
            </motion.div>
            <span className={`${styles.text} font-bold text-orange-400`}>
              {winStreak}
            </span>
            {showTooltip && multiplier && (
              <span className={`${styles.text} text-orange-300 ml-1`}>
                ×{multiplier.toFixed(2)}
              </span>
            )}
            
            {/* Fire particles */}
            <div className="absolute inset-0 overflow-hidden rounded-full pointer-events-none">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-orange-400 rounded-full"
                  initial={{ 
                    x: "50%", 
                    y: "100%", 
                    opacity: 0.8 
                  }}
                  animate={{ 
                    y: "-50%", 
                    opacity: 0,
                    x: `${40 + i * 15}%`
                  }}
                  transition={{ 
                    duration: 1, 
                    delay: i * 0.3, 
                    repeat: Infinity,
                    ease: "easeOut"
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Lose Streak (Shield Immunity) */}
      <AnimatePresence>
        {hasShieldImmunity && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={`relative flex items-center gap-1 ${styles.container} rounded-full bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/50`}
            title={showTooltip ? "Immunity Active - No scenery weakness" : undefined}
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            >
              <Shield className={`${styles.icon} text-blue-400 fill-blue-400/50`} />
            </motion.div>
            {showTooltip && (
              <span className={`${styles.text} text-blue-300`}>
                Immunity
              </span>
            )}
            
            {/* Shield glow effect */}
            <motion.div
              className="absolute inset-0 rounded-full bg-blue-400/20"
              animate={{ 
                opacity: [0.2, 0.5, 0.2],
                scale: [1, 1.1, 1],
              }}
              transition={{ 
                duration: 2, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Compact streak badge for photo cards
export const StreakBadge = ({ winStreak = 0, loseStreak = 0 }) => {
  const hasFireStreak = winStreak >= 3;
  const hasShieldImmunity = loseStreak >= 3;
  
  if (!hasFireStreak && !hasShieldImmunity) {
    return null;
  }
  
  return (
    <div className="absolute top-2 right-2 flex gap-1 z-10">
      {hasFireStreak && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
        >
          <span className="text-lg">🔥</span>
        </motion.div>
      )}
      {hasShieldImmunity && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
        >
          <span className="text-lg">🛡️</span>
        </motion.div>
      )}
    </div>
  );
};

// Star display for level progression
export const StarDisplay = ({ level = 1, size = "medium" }) => {
  const stars = Math.min(5, Math.floor(level / 10));
  const hasGoldenFrame = level >= 60;
  
  const sizeClasses = {
    small: "text-sm gap-0.5",
    medium: "text-lg gap-1",
    large: "text-2xl gap-1.5",
  };
  
  if (stars === 0) return null;
  
  return (
    <div className={`flex items-center ${sizeClasses[size]}`}>
      {[...Array(stars)].map((_, i) => (
        <motion.span
          key={i}
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: i * 0.1 }}
          className={hasGoldenFrame ? "drop-shadow-[0_0_4px_gold]" : ""}
        >
          ⭐
        </motion.span>
      ))}
      {hasGoldenFrame && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="ml-1 text-xs text-yellow-400 font-bold"
        >
          MAX
        </motion.span>
      )}
    </div>
  );
};

// Calculate star bonus percentage
export const calculateStarBonus = (level) => {
  if (level >= 60) return 150; // 5 stars (100%) + golden frame (50%)
  if (level >= 50) return 100; // 5 stars
  if (level >= 40) return 80;  // 4 stars
  if (level >= 30) return 60;  // 3 stars
  if (level >= 20) return 40;  // 2 stars
  if (level >= 10) return 20;  // 1 star
  return 0;
};

// Calculate XP required for next level
export const calculateXPForLevel = (level) => {
  if (level <= 1) return 0;
  if (level === 2) return 10;
  
  // Each level requires 50% more XP than previous level's marginal cost
  let totalXP = 10; // Level 2
  let marginalCost = 10;
  
  for (let i = 3; i <= level; i++) {
    marginalCost = Math.round(marginalCost * 1.5);
    totalXP += marginalCost;
  }
  
  return totalXP;
};

// Calculate level from XP
export const calculateLevelFromXP = (xp) => {
  let level = 1;
  let totalXP = 0;
  let marginalCost = 10;
  
  while (totalXP + marginalCost <= xp && level < 60) {
    totalXP += marginalCost;
    level++;
    if (level > 2) {
      marginalCost = Math.round(marginalCost * 1.5);
    }
  }
  
  return Math.min(level, 60);
};

export default StreakIndicator;
