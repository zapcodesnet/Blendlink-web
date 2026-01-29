/**
 * BotDifficultySelector Component
 * 
 * Updated: Progressive bot unlock system with 5-photo selection
 * - Easy Bot: Default unlocked, 8 taps/sec, 100 BL fixed bet
 * - Medium Bot: Unlocks after 3 Easy wins, 10 taps/sec, 500 BL fixed bet
 * - Hard Bot: Unlocks after 3 Medium wins, 12 taps/sec, 1000 BL fixed bet
 * - Extremely Hard Bot: Unlocks after 3 Hard wins, 15 taps/sec, 2000 BL fixed bet
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, Zap, Target, Flame, Shield, Trophy, Lock,
  Coins, ChevronRight, X, Info, Check, AlertCircle
} from 'lucide-react';
import { Button } from '../ui/button';

// Bot difficulty configurations with unlock requirements
const BOT_DIFFICULTIES = [
  {
    id: 'easy',
    name: 'Easy Bot',
    emoji: '🤖',
    description: 'Perfect for beginners',
    dollarValue: '$600,000,000',
    minDollarValue: 600000000,
    tapsPerSec: 8,
    tapsDisplay: '8 taps/sec',
    fixedBet: 100,
    color: 'from-green-500 to-emerald-600',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/50',
    textColor: 'text-green-400',
    unlockRequirement: null, // Always unlocked
    requiredWinsField: null,
    winsNeeded: 0,
  },
  {
    id: 'medium',
    name: 'Medium Bot',
    emoji: '🤖',
    description: 'Balanced challenge',
    dollarValue: '$800,000,000',
    minDollarValue: 800000000,
    tapsPerSec: 10,
    tapsDisplay: '10 taps/sec',
    fixedBet: 500,
    color: 'from-yellow-500 to-orange-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/50',
    textColor: 'text-yellow-400',
    unlockRequirement: 'Win 3 games vs Easy Bot',
    requiredWinsField: 'easy_bot_wins',
    winsNeeded: 3,
  },
  {
    id: 'hard',
    name: 'Hard Bot',
    emoji: '🤖',
    description: 'For experienced players',
    dollarValue: '$1,000,000,000',
    minDollarValue: 1000000000,
    tapsPerSec: 12,
    tapsDisplay: '12 taps/sec',
    fixedBet: 1000,
    color: 'from-red-500 to-pink-600',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/50',
    textColor: 'text-red-400',
    unlockRequirement: 'Win 3 games vs Medium Bot',
    requiredWinsField: 'medium_bot_wins',
    winsNeeded: 3,
  },
  {
    id: 'extreme',
    name: 'Extremely Hard Bot',
    emoji: '💀',
    description: 'Ultimate challenge',
    dollarValue: '$2,000,000,000',
    minDollarValue: 2000000000,
    tapsPerSec: 15,
    tapsDisplay: '15 taps/sec',
    fixedBet: 2000,
    color: 'from-purple-600 to-indigo-700',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/50',
    textColor: 'text-purple-400',
    unlockRequirement: 'Win 3 games vs Hard Bot',
    requiredWinsField: 'hard_bot_wins',
    winsNeeded: 3,
  },
];

// Scenery types for bot photos
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
      {/* Lock icon for locked bots */}
      {!isUnlocked && (
        <div className="absolute top-2 right-2">
          <Lock className="w-5 h-5 text-gray-500" />
        </div>
      )}
      
      <div className="flex items-start gap-3">
        {/* Bot icon */}
        <div className={`w-12 h-12 rounded-xl ${isUnlocked ? `bg-gradient-to-br ${difficulty.color}` : 'bg-gray-700'} flex items-center justify-center text-2xl`}>
          {difficulty.emoji}
        </div>
        
        {/* Info */}
        <div className="flex-1">
          <h4 className={`font-bold ${isUnlocked && selected ? difficulty.textColor : isUnlocked ? 'text-white' : 'text-gray-500'}`}>
            {difficulty.name}
          </h4>
          <p className="text-xs text-gray-400 mt-0.5">{difficulty.description}</p>
          
          {/* Stats */}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs ${isUnlocked ? difficulty.bgColor : 'bg-gray-800'} ${isUnlocked ? difficulty.textColor : 'text-gray-500'}`}>
              {difficulty.dollarValue}
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
              {difficulty.tapsDisplay}
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400">
              {difficulty.fixedBet} BL Bet
            </span>
          </div>
          
          {/* Unlock progress for locked bots */}
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
        
        {/* Selection indicator */}
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

// Photo Selection Grid for 5 photos
const PhotoSelectionGrid = ({ photos, selectedPhotos, onTogglePhoto, maxPhotos = 5, colors }) => {
  const getSceneryConfig = (type) => {
    const configs = {
      water: { emoji: '🌊', label: 'Water', color: 'from-blue-500 to-cyan-500' },
      natural: { emoji: '🌿', label: 'Natural', color: 'from-green-500 to-emerald-500' },
      man_made: { emoji: '🏙️', label: 'Man-made', color: 'from-gray-500 to-slate-500' },
      neutral: { emoji: '⚪', label: 'Neutral', color: 'from-gray-400 to-gray-500' },
    };
    return configs[type] || configs.neutral;
  };

  const validPhotos = photos.filter(p => (p.current_stamina || p.stamina || 0) >= 1);
  const needMorePhotos = selectedPhotos.length < maxPhotos;

  return (
    <div className="space-y-3">
      {/* Selection Counter - Prominent */}
      <div className="flex items-center justify-between p-3 bg-gray-800/70 rounded-lg border border-gray-700">
        <div>
          <span className="text-sm text-white font-medium">Photos Selected:</span>
          <p className="text-xs text-gray-400 mt-0.5">Tap photos to select/deselect</p>
        </div>
        <div className={`px-4 py-2 rounded-lg font-bold text-lg ${
          selectedPhotos.length === maxPhotos 
            ? 'bg-green-500/20 text-green-400' 
            : 'bg-yellow-500/20 text-yellow-400'
        }`}>
          {selectedPhotos.length} / {maxPhotos}
        </div>
      </div>
      
      {/* Instruction message */}
      {needMorePhotos && (
        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-center">
          <p className="text-xs text-amber-400">
            ⚠️ Select exactly 5 minted photos with available stamina to play
          </p>
        </div>
      )}
      
      {/* Not enough valid photos warning */}
      {validPhotos.length < 5 && (
        <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-center">
          <p className="text-xs text-red-400">
            ❌ You need at least 5 photos with stamina ≥1 ({validPhotos.length} available)
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto p-1">
        {photos.map(photo => {
          const isSelected = selectedPhotos.some(p => p.mint_id === photo.mint_id);
          const scenery = getSceneryConfig(photo.scenery_type);
          const hasStamina = (photo.current_stamina || photo.stamina || 0) >= 1;
          const canSelect = hasStamina && (isSelected || selectedPhotos.length < maxPhotos);
          
          return (
            <motion.button
              key={photo.mint_id}
              onClick={() => canSelect && onTogglePhoto(photo)}
              disabled={!canSelect}
              className={`relative p-2 rounded-lg border-2 transition-all ${
                !hasStamina
                  ? 'border-gray-700/50 bg-gray-800/30 opacity-50 cursor-not-allowed'
                  : isSelected
                    ? 'border-purple-500 bg-purple-500/20 ring-2 ring-purple-500/50'
                    : canSelect
                      ? 'border-gray-600 bg-gray-800/50 hover:border-gray-500 hover:bg-gray-700/50'
                      : 'border-gray-700/50 bg-gray-800/30 opacity-50 cursor-not-allowed'
              }`}
              whileHover={canSelect ? { scale: 1.02 } : {}}
              whileTap={canSelect ? { scale: 0.98 } : {}}
            >
              {/* Selection number badge */}
              {isSelected && (
                <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-sm font-bold text-white z-10 shadow-lg">
                  {selectedPhotos.findIndex(p => p.mint_id === photo.mint_id) + 1}
                </div>
              )}
              
              {/* Low stamina warning */}
              {!hasStamina && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-lg z-10">
                  <div className="text-center">
                    <span className="text-xs text-red-400 font-bold">⚡ 0 Stamina</span>
                    <p className="text-[10px] text-gray-400">Needs rest</p>
                  </div>
                </div>
              )}
              
              {/* Photo thumbnail */}
              <div className={`w-full aspect-square rounded-md bg-gradient-to-br ${scenery.color} flex items-center justify-center mb-1`}>
                <span className="text-2xl">{scenery.emoji}</span>
              </div>
              
              {/* Photo info */}
              <p className="text-xs text-white truncate font-medium">{photo.name}</p>
              <p className="text-xs text-yellow-400">${((photo.dollar_value || 0) / 1000000).toFixed(0)}M</p>
              
              {/* Stamina indicator */}
              {hasStamina && (
                <div className="mt-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${Math.min((photo.current_stamina || photo.stamina || 0), 100)}%` }}
                  />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
      
      {photos.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p className="text-2xl mb-2">📷</p>
          <p>No minted photos available</p>
          <p className="text-xs mt-1">Mint some photos to start battling!</p>
        </div>
      )}
    </div>
  );
};

// Main Component
export const BotDifficultySelector = ({
  isOpen,
  onClose,
  onStart,
  selectedPhoto, // Legacy single photo (for compatibility)
  playerPhotos = [],
  userBalance = 0,
  botWinStats = {}, // { easy_bot_wins: 0, medium_bot_wins: 0, hard_bot_wins: 0, extreme_bot_wins: 0 }
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState('easy');
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [step, setStep] = useState('difficulty'); // 'difficulty' | 'photos'
  
  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('difficulty');
      setSelectedPhotos([]);
      // Default to easy if nothing else unlocked
      setSelectedDifficulty('easy');
    }
  }, [isOpen]);
  
  // Get current difficulty config
  const currentDifficulty = BOT_DIFFICULTIES.find(d => d.id === selectedDifficulty);
  
  // Check if bot is unlocked
  const isBotUnlocked = (difficulty) => {
    if (!difficulty.requiredWinsField) return true; // Easy is always unlocked
    const wins = botWinStats[difficulty.requiredWinsField] || 0;
    return wins >= difficulty.winsNeeded;
  };
  
  // Get wins for unlock progress
  const getWinsForDifficulty = (difficulty) => {
    if (!difficulty.requiredWinsField) return 0;
    return botWinStats[difficulty.requiredWinsField] || 0;
  };
  
  // Check if user can afford the fixed bet
  const canAffordBet = userBalance >= (currentDifficulty?.fixedBet || 0);
  
  // Toggle photo selection
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
  
  // Handle start battle
  const handleStart = () => {
    if (selectedPhotos.length !== 5 || !currentDifficulty) return;
    
    onStart?.({
      difficulty: selectedDifficulty,
      betAmount: currentDifficulty.fixedBet,
      photos: selectedPhotos,
      photo: selectedPhotos[0], // Primary photo for legacy compatibility
      botConfig: {
        tapsPerSec: currentDifficulty.tapsPerSec,
        minDollarValue: currentDifficulty.minDollarValue,
        sceneries: BOT_SCENERIES,
      },
    });
  };
  
  // Proceed to photo selection
  const proceedToPhotos = () => {
    if (isBotUnlocked(currentDifficulty)) {
      setStep('photos');
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-gray-900 rounded-2xl max-w-md w-full max-h-[85vh] overflow-y-auto border border-gray-700 mb-20"
          data-testid="bot-difficulty-modal"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
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
            {/* BL Balance Display */}
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 bg-yellow-500/20 rounded-lg">
                <span className="text-yellow-400 font-bold text-sm">{userBalance.toLocaleString()} BL</span>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors"
                data-testid="close-difficulty-modal"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-4 space-y-6 pb-24">
            {step === 'difficulty' ? (
              <>
                {/* Difficulty selection */}
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
                
                {/* Selected difficulty info */}
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
                
                {/* Info box */}
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
                
                {/* Continue button */}
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
                {/* Back button */}
                <button
                  onClick={() => setStep('difficulty')}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
                >
                  <ChevronRight className="w-4 h-4 rotate-180" />
                  Back to difficulty
                </button>
                
                {/* Selected difficulty summary */}
                <div className={`p-3 rounded-lg ${currentDifficulty?.bgColor} border ${currentDifficulty?.borderColor}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{currentDifficulty?.emoji}</span>
                    <div>
                      <p className={`font-bold ${currentDifficulty?.textColor}`}>{currentDifficulty?.name}</p>
                      <p className="text-xs text-gray-400">
                        {currentDifficulty?.dollarValue} • {currentDifficulty?.tapsDisplay} • {currentDifficulty?.fixedBet} BL Bet
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Photo selection grid */}
                <PhotoSelectionGrid
                  photos={playerPhotos}
                  selectedPhotos={selectedPhotos}
                  onTogglePhoto={togglePhotoSelection}
                  maxPhotos={5}
                />
                
                {/* Selection summary */}
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
                
                {/* Start button */}
                <Button
                  onClick={handleStart}
                  disabled={selectedPhotos.length !== 5}
                  className="w-full py-6 text-lg font-bold bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="start-bot-battle-btn"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl">{currentDifficulty?.emoji}</span>
                    <span>Start Battle vs {currentDifficulty?.name}</span>
                    <span className="ml-2 px-2 py-0.5 bg-black/20 rounded text-sm">
                      {currentDifficulty?.fixedBet} BL
                    </span>
                  </div>
                </Button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BotDifficultySelector;
