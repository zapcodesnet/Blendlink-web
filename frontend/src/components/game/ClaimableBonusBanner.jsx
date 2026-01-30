/**
 * ClaimableBonusBanner Component
 * 
 * Displays claimable one-time BL coin bonuses for bot difficulty unlocks.
 * Features exciting animation when claiming:
 * - Bags of coins flying into wallet
 * - Confetti burst
 * - Haptic vibration (mobile)
 * 
 * Bonuses:
 * - Medium unlock: +20,000 BL
 * - Hard unlock: +100,000 BL
 * - Extreme unlock: +500,000 BL
 * - Extreme mastery (3 wins vs Extreme): +1,000,000 BL
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Coins, Sparkles, X, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import api from '../../services/api';

// Coin bag emoji positions for flying animation
const COIN_BAG_COUNT = 8;

// Confetti particles
const CONFETTI_COUNT = 50;

// Haptic vibration pattern (if supported)
const vibrate = (pattern) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
};

// Flying Coin Animation Component
const FlyingCoinAnimation = ({ isActive, onComplete }) => {
  const [coinBags, setCoinBags] = useState([]);
  const [confetti, setConfetti] = useState([]);
  const [showCounter, setShowCounter] = useState(false);
  
  useEffect(() => {
    if (isActive) {
      // Generate coin bags with random start positions
      const bags = Array.from({ length: COIN_BAG_COUNT }, (_, i) => ({
        id: i,
        startX: Math.random() * 80 + 10, // 10-90% of screen width
        startY: Math.random() * 30 + 60, // 60-90% of screen height (bottom area)
        delay: i * 0.1, // Stagger animation
        duration: 0.8 + Math.random() * 0.4, // 0.8-1.2 seconds
      }));
      setCoinBags(bags);
      
      // Generate confetti
      const confettiPieces = Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#9B59B6', '#3498DB'][Math.floor(Math.random() * 6)],
        delay: Math.random() * 0.3,
        size: Math.random() * 8 + 4,
      }));
      setConfetti(confettiPieces);
      
      // Vibrate on mobile
      vibrate([100, 50, 100, 50, 200, 100, 300]);
      
      // Show counter after bags start flying
      setTimeout(() => setShowCounter(true), 500);
      
      // Complete after animation
      setTimeout(() => {
        onComplete?.();
      }, 3000);
    }
  }, [isActive, onComplete]);
  
  if (!isActive) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center overflow-hidden"
    >
      {/* Confetti rain */}
      {confetti.map((piece) => (
        <motion.div
          key={`confetti-${piece.id}`}
          className="absolute"
          style={{
            left: `${piece.x}%`,
            backgroundColor: piece.color,
            width: piece.size,
            height: piece.size,
            borderRadius: piece.size > 8 ? '50%' : '0',
          }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{
            y: window.innerHeight + 50,
            opacity: [1, 1, 0],
            rotate: 360 * (Math.random() > 0.5 ? 1 : -1),
          }}
          transition={{
            duration: 2 + Math.random(),
            delay: piece.delay,
            ease: 'easeIn',
          }}
        />
      ))}
      
      {/* Coin bags flying to wallet (top-right) */}
      {coinBags.map((bag) => (
        <motion.div
          key={`bag-${bag.id}`}
          className="absolute text-5xl"
          style={{ left: `${bag.startX}%`, top: `${bag.startY}%` }}
          initial={{ scale: 1, opacity: 1 }}
          animate={{
            x: `calc(${90 - bag.startX}vw)`,
            y: `calc(-${bag.startY - 5}vh)`,
            scale: [1, 1.5, 0.5],
            opacity: [1, 1, 0],
          }}
          transition={{
            duration: bag.duration,
            delay: bag.delay,
            ease: 'easeInOut',
          }}
        >
          💰
        </motion.div>
      ))}
      
      {/* Center celebration text */}
      <motion.div
        className="text-center z-10"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', damping: 10, stiffness: 100 }}
      >
        <motion.div
          className="text-8xl mb-4"
          animate={{
            scale: [1, 1.3, 1],
            rotate: [0, -10, 10, 0],
          }}
          transition={{ duration: 0.5, repeat: 3 }}
        >
          🎉
        </motion.div>
        
        <motion.h2
          className="text-4xl font-bold text-yellow-400 mb-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          BONUS CLAIMED!
        </motion.h2>
        
        {showCounter && (
          <motion.div
            className="text-6xl font-bold text-green-400"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ type: 'spring', damping: 8 }}
          >
            <span className="flex items-center justify-center gap-2">
              <Coins className="w-12 h-12" />
              <span className="animate-pulse">+BL</span>
            </span>
          </motion.div>
        )}
      </motion.div>
      
      {/* Sparkles around center */}
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={`sparkle-${i}`}
          className="absolute text-3xl"
          style={{
            left: '50%',
            top: '50%',
          }}
          initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
          animate={{
            x: Math.cos((i * Math.PI * 2) / 8) * 150,
            y: Math.sin((i * Math.PI * 2) / 8) * 150,
            opacity: [0, 1, 0],
            scale: [0, 1.5, 0],
          }}
          transition={{
            duration: 1.5,
            delay: 0.5 + i * 0.1,
            repeat: 2,
          }}
        >
          ✨
        </motion.div>
      ))}
    </motion.div>
  );
};

// Single Bonus Card Component
const BonusCard = ({ bonus, onClaim, isClaiming }) => {
  const formatAmount = (amount) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(0)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return amount.toString();
  };
  
  // Color based on amount
  const getCardStyle = (amount) => {
    if (amount >= 1000000) return {
      gradient: 'from-purple-600 via-pink-600 to-red-600',
      glow: 'shadow-purple-500/50',
      border: 'border-purple-400',
    };
    if (amount >= 500000) return {
      gradient: 'from-amber-500 via-orange-500 to-red-500',
      glow: 'shadow-amber-500/50',
      border: 'border-amber-400',
    };
    if (amount >= 100000) return {
      gradient: 'from-yellow-500 via-amber-500 to-orange-500',
      glow: 'shadow-yellow-500/50',
      border: 'border-yellow-400',
    };
    return {
      gradient: 'from-green-500 via-emerald-500 to-teal-500',
      glow: 'shadow-green-500/50',
      border: 'border-green-400',
    };
  };
  
  const style = getCardStyle(bonus.amount);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className={`relative p-4 rounded-xl bg-gradient-to-r ${style.gradient} border-2 ${style.border} shadow-lg ${style.glow}`}
      data-testid={`bonus-card-${bonus.id}`}
    >
      {/* Animated glow effect */}
      <motion.div
        className="absolute inset-0 rounded-xl bg-white/20"
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      
      <div className="relative z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Gift icon with animation */}
          <motion.div
            className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"
            animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Gift className="w-6 h-6 text-white" />
          </motion.div>
          
          <div>
            <h4 className="font-bold text-white text-sm sm:text-base">{bonus.label}</h4>
            <p className="text-white/80 text-xs">{bonus.description}</p>
          </div>
        </div>
        
        <Button
          onClick={() => onClaim(bonus)}
          disabled={isClaiming}
          className="bg-white/20 hover:bg-white/30 border border-white/40 text-white font-bold px-4 py-2 text-lg min-w-[120px]"
          data-testid={`claim-btn-${bonus.id}`}
        >
          {isClaiming ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            >
              <Sparkles className="w-5 h-5" />
            </motion.div>
          ) : (
            <span className="flex items-center gap-1">
              <span>+{formatAmount(bonus.amount)}</span>
              <span className="text-yellow-300">BL</span>
            </span>
          )}
        </Button>
      </div>
    </motion.div>
  );
};

// Main ClaimableBonusBanner Component
export const ClaimableBonusBanner = ({
  claimableBonuses = [],
  onBonusClaimed,
  onBalanceUpdate,
}) => {
  const [showAnimation, setShowAnimation] = useState(false);
  const [claimingBonusId, setClaimingBonusId] = useState(null);
  const [claimedAmount, setClaimedAmount] = useState(0);
  const [localBonuses, setLocalBonuses] = useState(claimableBonuses);
  
  // Update local bonuses when prop changes
  useEffect(() => {
    setLocalBonuses(claimableBonuses);
  }, [claimableBonuses]);
  
  const handleClaim = useCallback(async (bonus) => {
    if (claimingBonusId) return;
    
    setClaimingBonusId(bonus.id);
    setClaimedAmount(bonus.amount);
    
    try {
      // Call backend to claim bonus
      const response = await api.post(`/photo-game/bot-battle/claim-bonus?bonus_id=${bonus.id}`);
      
      if (response.data.success) {
        // Show celebration animation
        setShowAnimation(true);
        
        // Play sound if available
        try {
          const audio = new Audio('/sounds/coin-claim.mp3');
          audio.volume = 0.5;
          audio.play().catch(() => {});
        } catch (e) {}
        
        // Update balance in parent
        if (onBalanceUpdate) {
          onBalanceUpdate(response.data.new_bl_balance);
        }
        
        // Remove from local list
        setLocalBonuses(prev => prev.filter(b => b.id !== bonus.id));
        
        // Notify parent
        if (onBonusClaimed) {
          onBonusClaimed(bonus.id, bonus.amount);
        }
        
        toast.success(`🎉 Claimed ${bonus.amount.toLocaleString()} BL coins!`);
      }
    } catch (error) {
      console.error('Failed to claim bonus:', error);
      toast.error(error.response?.data?.detail || 'Failed to claim bonus');
    } finally {
      setClaimingBonusId(null);
    }
  }, [claimingBonusId, onBalanceUpdate, onBonusClaimed]);
  
  const handleAnimationComplete = useCallback(() => {
    setShowAnimation(false);
    setClaimedAmount(0);
  }, []);
  
  // Don't render if no bonuses
  if (!localBonuses || localBonuses.length === 0) {
    return null;
  }
  
  return (
    <>
      {/* Celebration Animation Overlay */}
      <AnimatePresence>
        {showAnimation && (
          <FlyingCoinAnimation
            isActive={showAnimation}
            onComplete={handleAnimationComplete}
            amount={claimedAmount}
          />
        )}
      </AnimatePresence>
      
      {/* Bonus Banner */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 space-y-3"
        data-testid="claimable-bonus-banner"
      >
        {/* Header */}
        <div className="flex items-center gap-2 text-sm text-yellow-400 font-semibold">
          <motion.div
            animate={{ rotate: [0, 15, -15, 0] }}
            transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
          >
            <Gift className="w-5 h-5" />
          </motion.div>
          <span>🎁 Unclaimed Rewards Available!</span>
        </div>
        
        {/* Bonus Cards */}
        <div className="space-y-2">
          <AnimatePresence>
            {localBonuses.map((bonus) => (
              <BonusCard
                key={bonus.id}
                bonus={bonus}
                onClaim={handleClaim}
                isClaiming={claimingBonusId === bonus.id}
              />
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
};

export default ClaimableBonusBanner;
