/**
 * BotDifficultySelector Component
 * 
 * Allows players to select bot difficulty and lock in 5 photos for battle.
 * Bot Difficulties:
 * - Easy Bot: Default unlocked, 200 BL fixed bet
 * - Medium Bot: Unlocks after 3 Easy wins, 1,000 BL fixed bet
 * - Hard Bot: Unlocks after 3 Medium wins, 5,000 BL fixed bet
 * - Extremely Hard Bot: Unlocks after 3 Hard wins, 10,000 BL fixed bet
 * 
 * Claimable One-Time BL Bonuses:
 * - Medium unlock: +20,000 BL
 * - Hard unlock: +100,000 BL
 * - Extreme unlock: +500,000 BL
 * - Extreme mastery (3 wins): +1,000,000 BL
 * 
 * Note: Tap rates are hidden from players to encourage gameplay.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, Zap, Target, Flame, Shield, Trophy, Lock,
  Coins, ChevronRight, X, Info, Check, AlertCircle, Loader2
} from 'lucide-react';
import { Button } from '../ui/button';
import { StreakBadge } from './StreakIndicator';
import { LikeButtonCompact } from './LikeButton';
import { ClaimableBonusBanner } from './ClaimableBonusBanner';

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

// Bot difficulty configurations with fixed bets and unlock requirements
const BOT_DIFFICULTIES = [
  {
    id: 'easy',
    name: 'Easy Bot',
    emoji: '🤖',
    description: 'Perfect for beginners',
    dollarValue: '$1B',
    minDollarValue: 1_000_000_000, // $1B minimum
    // Tap rate: 12 TPS (hidden from players)
    fixedBet: 200,
    color: 'from-green-500 to-emerald-600',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/50',
    textColor: 'text-green-400',
    unlockRequirement: null,
    requiredWinsField: null,
    winsNeeded: 0,
    unlockBonus: 0,
  },
  {
    id: 'medium',
    name: 'Medium Bot',
    emoji: '🤖',
    description: 'Balanced challenge',
    dollarValue: '$2B',
    minDollarValue: 2_000_000_000, // $2B minimum
    // Tap rate: 18 TPS (hidden from players)
    fixedBet: 1000,
    color: 'from-yellow-500 to-orange-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/50',
    textColor: 'text-yellow-400',
    unlockRequirement: 'Win 3 games vs Easy Bot',
    requiredWinsField: 'easy_bot_wins',
    winsNeeded: 3,
    unlockBonus: 20000,
  },
  {
    id: 'hard',
    name: 'Hard Bot',
    emoji: '🤖',
    description: 'For experienced players',
    dollarValue: '$5B',
    minDollarValue: 5_000_000_000, // $5B minimum
    // Tap rate: 20 TPS (hidden from players)
    fixedBet: 5000,
    color: 'from-red-500 to-pink-600',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/50',
    textColor: 'text-red-400',
    unlockRequirement: 'Win 3 games vs Medium Bot',
    requiredWinsField: 'medium_bot_wins',
    winsNeeded: 3,
    unlockBonus: 100000,
  },
  {
    id: 'extreme',
    name: 'Extremely Hard Bot',
    emoji: '💀',
    description: 'Ultimate challenge',
    dollarValue: '$10B',
    minDollarValue: 10_000_000_000, // $10B minimum
    // Tap rate: 25 TPS (hidden from players)
    fixedBet: 10000,
    color: 'from-purple-600 to-indigo-700',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/50',
    textColor: 'text-purple-400',
    unlockRequirement: 'Win 3 games vs Hard Bot',
    requiredWinsField: 'hard_bot_wins',
    winsNeeded: 3,
    unlockBonus: 500000,
  },
];

// Bot scenery distributions for each difficulty
const BOT_SCENERY_CONFIG = {
  easy: ['water', 'natural', 'manmade', 'neutral', 'neutral'],     // 1W, 1N, 1M, 2Neu
  medium: ['water', 'natural', 'manmade', 'manmade', 'neutral'],   // 1W, 1N, 2M, 1Neu
  hard: ['water', 'natural', 'natural', 'manmade', 'neutral'],     // 1W, 2N, 1M, 1Neu
  extreme: ['water', 'water', 'natural', 'manmade', 'neutral'],    // 2W, 1N, 1M, 1Neu
};

// One-time bonuses for difficulty unlocks (claimable)
const UNLOCK_BONUSES = {
  medium: { amount: 20000, label: '+20,000 BL' },
  hard: { amount: 100000, label: '+100,000 BL' },
  extreme: { amount: 500000, label: '+500,000 BL' },
  extreme_mastery: { amount: 1000000, label: '+1,000,000 BL' }, // 3 wins vs Extremely Hard
};

const BOT_SCENERIES = ['water', 'natural', 'man_made', 'neutral', 'neutral'];

// Difficulty Card Component
const DifficultyCard = ({ difficulty, selected, onSelect, isUnlocked, currentWins }) => {
  const progress = difficulty.winsNeeded > 0 ? Math.min(currentWins / difficulty.winsNeeded, 1) : 1;
  
  return (
    <motion.button
      onClick={() => isUnlocked && onSelect(difficulty.id)}
      className={`relative w-full p-4 rounded-xl border-2 transition-all text-left ${
        !isUnlocked
          ? 'border-gray-700/50 bg-gray-800/30 cursor-not-allowed opacity-60'
          : selected 
            ? `${difficulty.borderColor} ${difficulty.bgColor} ring-2 ring-offset-2 ring-offset-gray-900 ${difficulty.borderColor.replace('border-', 'ring-')}`
            : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
      }`}
      whileHover={isUnlocked ? { scale: 1.02 } : {}}
      whileTap={isUnlocked ? { scale: 0.98 } : {}}
      disabled={!isUnlocked}
      data-testid={`difficulty-${difficulty.id}`}
    >
      {!isUnlocked && (
        <div className="absolute top-2 right-2">
          <Lock className="w-5 h-5 text-gray-500" />
        </div>
      )}
      
      <div className="flex items-start gap-3">
        <div className={`w-12 h-12 rounded-xl ${isUnlocked ? `bg-gradient-to-br ${difficulty.color}` : 'bg-gray-700'} flex items-center justify-center text-2xl`}>
          {difficulty.emoji}
        </div>
        
        <div className="flex-1">
          <h4 className={`font-bold ${isUnlocked && selected ? difficulty.textColor : isUnlocked ? 'text-white' : 'text-gray-500'}`}>
            {difficulty.name}
          </h4>
          <p className="text-xs text-gray-400 mt-0.5">{difficulty.description}</p>
          
          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs ${isUnlocked ? difficulty.bgColor : 'bg-gray-800'} ${isUnlocked ? difficulty.textColor : 'text-gray-500'}`}>
              {difficulty.dollarValue}
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">
              {difficulty.fixedBet} BL Bet
            </span>
          </div>
          
          {!isUnlocked && difficulty.unlockRequirement && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500">{difficulty.unlockRequirement}</span>
                <span className="text-gray-400">{currentWins}/{difficulty.winsNeeded}</span>
              </div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${difficulty.color} transition-all duration-300`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        {isUnlocked && selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`w-6 h-6 rounded-full bg-gradient-to-br ${difficulty.color} flex items-center justify-center`}
          >
            <Check className="w-4 h-4 text-white" />
          </motion.div>
        )}
      </div>
    </motion.button>
  );
};

// Photo Card Component - Optimized for performance
const PhotoCard = React.memo(({ photo, isSelected, selectionIndex, canSelect, onToggle }) => {
  const getSceneryConfig = (type) => {
    const configs = {
      water: { emoji: '🌊', label: 'Water', color: 'from-blue-500 to-cyan-500', strong: 'Natural', weak: 'Man-made' },
      natural: { emoji: '🌿', label: 'Natural', color: 'from-green-500 to-emerald-500', strong: 'Man-made', weak: 'Water' },
      man_made: { emoji: '🏙️', label: 'Man-made', color: 'from-gray-500 to-slate-500', strong: 'Water', weak: 'Natural' },
      neutral: { emoji: '⚪', label: 'Neutral', color: 'from-gray-400 to-gray-500', strong: 'None', weak: 'None' },
    };
    return configs[type] || configs.neutral;
  };

  const formatValue = (value) => {
    if (!value) return '$0';
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
  };

  const scenery = getSceneryConfig(photo.scenery_type);
  const hasStamina = (photo.current_stamina || photo.stamina || 0) >= 1;
  const stamina = Math.min((photo.current_stamina || photo.stamina || 0), 100);
  const level = photo.level || 1;
  const hearts = photo.hearts || photo.reaction_count || 0;
  const winStreak = photo.current_win_streak || 0;
  const loseStreak = photo.current_lose_streak || 0;
  const imageUrl = photo.image_url || photo.thumbnail_url;

  return (
    <motion.button
      onClick={() => canSelect && onToggle(photo)}
      disabled={!canSelect}
      className={`relative rounded-xl border-2 transition-all overflow-hidden ${
        !hasStamina
          ? 'border-gray-700/50 bg-gray-800/30 opacity-50 cursor-not-allowed'
          : isSelected
            ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500/50 shadow-lg shadow-purple-500/20'
            : canSelect
              ? 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-700/50'
              : 'border-gray-700/50 bg-gray-800/30 opacity-50 cursor-not-allowed'
      }`}
      whileHover={canSelect ? { scale: 1.02 } : {}}
      whileTap={canSelect ? { scale: 0.98 } : {}}
      data-testid={`photo-card-${photo.mint_id}`}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 w-7 h-7 bg-purple-500 rounded-full flex items-center justify-center text-sm font-bold text-white z-20 shadow-lg">
          {selectionIndex + 1}
        </div>
      )}
      
      {!hasStamina && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-20">
          <div className="text-center">
            <span className="text-sm text-red-400 font-bold">⚡ 0 Stamina</span>
            <p className="text-xs text-gray-400">Regenerating...</p>
          </div>
        </div>
      )}
      
      <div className="relative aspect-square w-full">
        {imageUrl ? (
          <img 
            src={imageUrl} 
            alt={photo.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
              e.target.parentElement.classList.add('bg-gradient-to-br', ...scenery.color.split(' '));
            }}
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
            <span className="text-4xl opacity-50">{scenery.emoji}</span>
          </div>
        )}
        
        <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 rounded-lg flex items-center gap-1 z-10">
          <span className="text-yellow-400 text-xs font-bold">Lv{level}</span>
          <span className="text-yellow-300 text-xs">{'★'.repeat(Math.min(level, 5))}</span>
        </div>
        
        {/* Streak Badge - Top Right */}
        <StreakBadge winStreak={winStreak} loseStreak={loseStreak} />
        
        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 rounded-lg z-10">
          <span className="text-xs">
            <span className="mr-1">{scenery.emoji}</span>
            <span className="text-gray-300">{scenery.label}</span>
          </span>
        </div>
      </div>
      
      <div className="p-2 space-y-1.5">
        <p className="text-sm text-white font-semibold truncate">{photo.name}</p>
        
        <div className="text-center py-1 bg-yellow-500/10 rounded-lg">
          <span className="text-lg font-bold text-yellow-400">{formatValue(photo.dollar_value)}</span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          <span className="text-green-400">💪 vs {scenery.strong}</span>
          <span className="text-red-400">😰 vs {scenery.weak}</span>
        </div>
        
        <div className="flex items-center justify-between text-xs">
          {/* Interactive Like Button */}
          <LikeButtonCompact 
            photoId={photo.mint_id} 
            initialLikes={hearts}
            initialLiked={false}
          />
          <div className="flex items-center gap-2">
            {winStreak >= 3 && (
              <span 
                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-orange-500/20 rounded-full text-orange-400 border border-orange-500/50" 
                title={`${winStreak} win streak - ×${WIN_STREAK_MULTIPLIERS[Math.min(winStreak, 10)]?.toFixed(2)} Power Multiplier`}
              >
                🔥 {winStreak} <span className="text-orange-300 font-bold">×{WIN_STREAK_MULTIPLIERS[Math.min(winStreak, 10)]?.toFixed(2)}</span>
              </span>
            )}
            {winStreak > 0 && winStreak < 3 && (
              <span className="text-orange-400/60" title={`${winStreak} wins - Need ${3 - winStreak} more for multiplier`}>
                🔥{winStreak}
              </span>
            )}
            {loseStreak >= 3 && (
              <span 
                className="flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-500/20 rounded-full text-blue-400 border border-blue-500/50" 
                title="Immunity active! No scenery weakness penalty"
              >
                🛡️ Immunity
              </span>
            )}
          </div>
        </div>
        
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">Stamina</span>
            <span className={`font-medium ${stamina > 50 ? 'text-green-400' : stamina > 20 ? 'text-yellow-400' : 'text-red-400'}`}>
              {stamina.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${
                stamina > 50 ? 'bg-green-500' : stamina > 20 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${stamina}%` }}
            />
          </div>
        </div>
      </div>
    </motion.button>
  );
});

PhotoCard.displayName = 'PhotoCard';

// Loading Screen Component
const LoadingScreen = ({ difficulty }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/95 flex flex-col items-center justify-center z-[100]"
  >
    <motion.div
      animate={{ 
        scale: [1, 1.2, 1],
        rotate: [0, 360]
      }}
      transition={{ 
        scale: { duration: 1.5, repeat: Infinity },
        rotate: { duration: 2, repeat: Infinity, ease: "linear" }
      }}
      className="text-8xl mb-6"
    >
      {difficulty?.emoji || '🤖'}
    </motion.div>
    
    <h2 className="text-2xl font-bold text-white mb-2">Loading Bot Battle...</h2>
    <p className="text-gray-400 mb-6">Preparing your battle against {difficulty?.name || 'Bot'}</p>
    
    <div className="flex items-center gap-3">
      <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
      <span className="text-purple-400">Initializing game...</span>
    </div>
    
    <div className="mt-8 w-64 h-2 bg-gray-800 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-red-500"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        style={{ width: '50%' }}
      />
    </div>
  </motion.div>
);

// Main Component
export const BotDifficultySelector = ({
  isOpen,
  onClose,
  onStart,
  selectedPhoto,
  playerPhotos = [],
  userBalance = 0,
  botWinStats = {},
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState('easy');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [step, setStep] = useState('difficulty');
  const [isLoading, setIsLoading] = useState(false);
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('difficulty');
      setSelectedPhotos([]);
      setSelectedDifficulty('easy');
      setIsLoading(false);
    }
  }, [isOpen]);
  
  const currentDifficulty = BOT_DIFFICULTIES.find(d => d.id === selectedDifficulty);
  
  const isBotUnlocked = (difficulty) => {
    if (!difficulty.requiredWinsField) return true;
    const wins = botWinStats[difficulty.requiredWinsField] || 0;
    return wins >= difficulty.winsNeeded;
  };
  
  const getWinsForDifficulty = (difficulty) => {
    if (!difficulty.requiredWinsField) return 0;
    return botWinStats[difficulty.requiredWinsField] || 0;
  };
  
  const canAffordBet = userBalance >= (currentDifficulty?.fixedBet || 0);
  
  // Get top 5 photos by dollar value with valid stamina
  const top5Photos = useMemo(() => {
    return playerPhotos
      .filter(p => (p.current_stamina || p.stamina || 0) >= 1)
      .sort((a, b) => (b.dollar_value || 0) - (a.dollar_value || 0))
      .slice(0, 5);
  }, [playerPhotos]);
  
  const validPhotosCount = useMemo(() => {
    return playerPhotos.filter(p => (p.current_stamina || p.stamina || 0) >= 1).length;
  }, [playerPhotos]);
  
  const togglePhotoSelection = (photo) => {
    setSelectedPhotos(prev => {
      const isSelected = prev.some(p => p.mint_id === photo.mint_id);
      if (isSelected) {
        return prev.filter(p => p.mint_id !== photo.mint_id);
      } else if (prev.length < 5) {
        return [...prev, photo];
      }
      return prev;
    });
  };
  
  // Quick Play - Auto-select top 5 photos
  const handleQuickPlay = () => {
    if (top5Photos.length === 5) {
      setSelectedPhotos(top5Photos);
    }
  };
  
  const handleStart = async () => {
    if (selectedPhotos.length !== 5 || !currentDifficulty) return;
    
    setIsLoading(true);
    
    // Small delay for loading screen visibility
    await new Promise(resolve => setTimeout(resolve, 500));
    
    onStart?.({
      difficulty: selectedDifficulty,
      betAmount: currentDifficulty.fixedBet,
      photos: selectedPhotos,
      photo: selectedPhotos[0],
      botConfig: {
        // Note: Tap rates are handled internally in TappingArena based on difficulty
        minDollarValue: currentDifficulty.minDollarValue,
        sceneries: BOT_SCENERIES,
      },
    });
  };
  
  const proceedToPhotos = () => {
    if (isBotUnlocked(currentDifficulty)) {
      setStep('photos');
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Loading Screen */}
      <AnimatePresence>
        {isLoading && <LoadingScreen difficulty={currentDifficulty} />}
      </AnimatePresence>
      
      {/* Main Modal */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 z-50"
          onClick={(e) => e.target === e.currentTarget && !isLoading && onClose()}
        >
          {/* Single scrollable container - FIXED: No nested scroll */}
          <div className="h-full overflow-y-auto pb-32">
            <div className="min-h-full flex items-start justify-center p-4 pt-8">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-gray-900 rounded-2xl max-w-md w-full border border-gray-700"
                data-testid="bot-difficulty-modal"
              >
                {/* Header - Sticky */}
                <div className="p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-900 z-10 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Bot Battle</h3>
                      <p className="text-xs text-gray-400">
                        {step === 'difficulty' ? 'Choose your opponent' : 'Select 5 photos'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 bg-yellow-500/20 rounded-lg">
                      <span className="text-yellow-400 font-bold text-sm">{userBalance.toLocaleString()} BL</span>
                    </div>
                    <button
                      onClick={onClose}
                      disabled={isLoading}
                      className="p-2 hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50"
                      data-testid="close-difficulty-modal"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>
                
                {/* Content - No inner scroll */}
                <div className="p-4 space-y-4">
                  {step === 'difficulty' ? (
                    <>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                          <Target className="w-4 h-4" />
                          Select Difficulty
                        </h4>
                        <div className="space-y-3">
                          {BOT_DIFFICULTIES.map(difficulty => (
                            <DifficultyCard
                              key={difficulty.id}
                              difficulty={difficulty}
                              selected={selectedDifficulty === difficulty.id}
                              onSelect={setSelectedDifficulty}
                              isUnlocked={isBotUnlocked(difficulty)}
                              currentWins={getWinsForDifficulty(difficulty)}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {currentDifficulty && isBotUnlocked(currentDifficulty) && (
                        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-gray-400">Fixed Bet Amount:</span>
                            <span className="text-lg font-bold text-yellow-400">{currentDifficulty.fixedBet} BL</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">Your balance:</span>
                            <span className={`font-bold ${canAffordBet ? 'text-green-400' : 'text-red-400'}`}>
                              {userBalance.toLocaleString()} BL
                            </span>
                          </div>
                          {!canAffordBet && (
                            <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              Insufficient balance for this difficulty
                            </p>
                          )}
                        </div>
                      )}
                      
                      <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <div className="flex items-start gap-2">
                          <Info className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                          <div className="text-xs text-gray-300">
                            <p className="font-medium text-purple-300 mb-1">Bot Battle Rules:</p>
                            <ul className="space-y-0.5 text-gray-400">
                              <li>• Select exactly 5 minted photos (stamina ≥1)</li>
                              <li>• First to 3 rounds wins the game</li>
                              <li>• Winner takes entire pot (your bet + bot bet)</li>
                              <li>• All PVP mechanics apply (scenery, streaks, level)</li>
                              <li>• Win 3 games to unlock next difficulty</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                      
                      <Button
                        onClick={proceedToPhotos}
                        disabled={!isBotUnlocked(currentDifficulty) || !canAffordBet}
                        className="w-full py-6 text-lg font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        data-testid="continue-to-photos-btn"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span>Continue to Photo Selection</span>
                          <ChevronRight className="w-5 h-5" />
                        </div>
                      </Button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setStep('difficulty')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
                      >
                        <ChevronRight className="w-4 h-4 rotate-180" />
                        Back to difficulty
                      </button>
                      
                      <div className={`p-3 rounded-lg ${currentDifficulty?.bgColor} border ${currentDifficulty?.borderColor}`}>
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{currentDifficulty?.emoji}</span>
                          <div>
                            <p className={`font-bold ${currentDifficulty?.textColor}`}>{currentDifficulty?.name}</p>
                            <p className="text-xs text-gray-400">
                              {currentDifficulty?.dollarValue} • {currentDifficulty?.fixedBet} BL Bet
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {playerPhotos.length === 0 ? (
                        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-xl text-center">
                          <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
                            <AlertCircle className="w-8 h-8 text-red-400" />
                          </div>
                          <h4 className="text-lg font-bold text-red-400 mb-2">No Minted Photos</h4>
                          <p className="text-sm text-gray-400 mb-4">
                            You need at least 5 minted photos with stamina to play Bot Battle.
                          </p>
                          <p className="text-xs text-gray-500">
                            Go to the <span className="text-purple-400 font-bold">Minting</span> section to create your photos first.
                          </p>
                        </div>
                      ) : validPhotosCount < 5 ? (
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-bold text-yellow-400 mb-1">Not Enough Photos with Stamina</h4>
                              <p className="text-xs text-gray-400">
                                You need 5 photos with stamina ≥1 to play. You have {validPhotosCount} valid photos.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Selection Counter */}
                          <div className="flex items-center justify-between p-3 bg-gray-800/70 rounded-lg border border-gray-700">
                            <div>
                              <span className="text-sm text-white font-medium">Photos Selected:</span>
                              <p className="text-xs text-gray-400 mt-0.5">Tap photos to select/deselect</p>
                            </div>
                            <div className={`px-4 py-2 rounded-lg font-bold text-lg ${
                              selectedPhotos.length === 5 
                                ? 'bg-green-500/20 text-green-400' 
                                : 'bg-yellow-500/20 text-yellow-400'
                            }`}>
                              {selectedPhotos.length} / 5
                            </div>
                          </div>
                          
                          {/* Quick Play Button */}
                          {top5Photos.length === 5 && selectedPhotos.length === 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                            >
                              <Button
                                onClick={handleQuickPlay}
                                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:opacity-90"
                                data-testid="quick-play-btn"
                              >
                                <Zap className="w-4 h-4 mr-2" />
                                ⚡ Quick Play - Auto-Select Top 5 Photos
                              </Button>
                            </motion.div>
                          )}
                          
                          {selectedPhotos.length < 5 && selectedPhotos.length > 0 && (
                            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-center">
                              <p className="text-xs text-amber-400">
                                ⚠️ Select {5 - selectedPhotos.length} more photo{5 - selectedPhotos.length > 1 ? 's' : ''} to start
                              </p>
                            </div>
                          )}
                          
                          {/* Photo Grid - No inner scroll, part of main scroll */}
                          <div className="grid grid-cols-2 gap-3">
                            {playerPhotos.map(photo => {
                              const isSelected = selectedPhotos.some(p => p.mint_id === photo.mint_id);
                              const selectionIndex = selectedPhotos.findIndex(p => p.mint_id === photo.mint_id);
                              const hasStamina = (photo.current_stamina || photo.stamina || 0) >= 1;
                              const canSelect = hasStamina && (isSelected || selectedPhotos.length < 5);
                              
                              return (
                                <PhotoCard
                                  key={photo.mint_id}
                                  photo={photo}
                                  isSelected={isSelected}
                                  selectionIndex={selectionIndex}
                                  canSelect={canSelect}
                                  onToggle={togglePhotoSelection}
                                />
                              );
                            })}
                          </div>
                          
                          {playerPhotos.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                              <p className="text-2xl mb-2">📷</p>
                              <p>No minted photos available</p>
                              <p className="text-xs mt-1">Mint some photos to start battling!</p>
                            </div>
                          )}
                        </>
                      )}
                      
                      {selectedPhotos.length > 0 && (
                        <div className="p-3 bg-gray-800/50 rounded-lg">
                          <p className="text-xs text-gray-400 mb-2">Selected Photos:</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedPhotos.map((photo, idx) => (
                              <span key={photo.mint_id} className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded">
                                {idx + 1}. {photo.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
          
          {/* Fixed Start Button - Always visible above bottom nav */}
          {step === 'photos' && validPhotosCount >= 5 && (
            <div className="fixed bottom-20 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/95 to-transparent z-50">
              <div className="max-w-md mx-auto">
                <Button
                  onClick={handleStart}
                  disabled={selectedPhotos.length !== 5 || isLoading}
                  className="w-full py-6 text-lg font-bold bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl"
                  data-testid="start-bot-battle-btn"
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Starting Battle...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-2xl">{currentDifficulty?.emoji}</span>
                      <span>Start Battle vs {currentDifficulty?.name}</span>
                      <span className="ml-2 px-2 py-0.5 bg-black/20 rounded text-sm">
                        {currentDifficulty?.fixedBet} BL
                      </span>
                    </div>
                  )}
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default BotDifficultySelector;
