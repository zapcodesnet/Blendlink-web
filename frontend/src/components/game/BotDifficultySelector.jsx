/**
 * BotDifficultySelector Component
 * 
 * Allows players to select bot difficulty before starting a match.
 * Per user specs:
 * - Easy: 55% player win rate, slow taps (5/sec), 1-500 BL bet
 * - Medium: 50% player win rate, normal taps (7/sec), 1-500 BL bet
 * - Hard: 40% player win rate, fast taps (9/sec), 1-500 BL bet
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, Zap, Target, Flame, Shield, Trophy, 
  Coins, ChevronRight, X, Info
} from 'lucide-react';
import { Button } from '../ui/button';

// Bot difficulty configurations
const BOT_DIFFICULTIES = [
  {
    id: 'easy',
    name: 'Easy Bot',
    emoji: '🤖',
    description: 'Perfect for beginners',
    winRate: '~55% win rate',
    tapsPerSec: '5 taps/sec',
    strategy: 'Random choices',
    color: 'from-green-500 to-emerald-600',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/50',
    textColor: 'text-green-400',
  },
  {
    id: 'medium',
    name: 'Medium Bot',
    emoji: '🤖',
    description: 'Balanced challenge',
    winRate: '~50% win rate',
    tapsPerSec: '7 taps/sec',
    strategy: 'Basic strategy',
    color: 'from-yellow-500 to-orange-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/50',
    textColor: 'text-yellow-400',
    recommended: true,
  },
  {
    id: 'hard',
    name: 'Hard Bot',
    emoji: '🤖',
    description: 'For experienced players',
    winRate: '~40% win rate',
    tapsPerSec: '9 taps/sec',
    strategy: 'Adaptive counter',
    color: 'from-red-500 to-pink-600',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/50',
    textColor: 'text-red-400',
  },
];

// Max bet for bot matches per spec
const MAX_BOT_BET = 500;
const BET_OPTIONS = [0, 10, 50, 100, 250, 500];

// Difficulty Card Component
const DifficultyCard = ({ difficulty, selected, onSelect }) => {
  return (
    <motion.button
      onClick={() => onSelect(difficulty.id)}
      className={`relative w-full p-4 rounded-xl border-2 transition-all text-left ${
        selected 
          ? `${difficulty.borderColor} ${difficulty.bgColor} ring-2 ring-offset-2 ring-offset-gray-900 ${difficulty.borderColor.replace('border-', 'ring-')}`
          : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      data-testid={`difficulty-${difficulty.id}`}
    >
      {/* Recommended badge */}
      {difficulty.recommended && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-full">
          RECOMMENDED
        </div>
      )}
      
      <div className="flex items-start gap-3">
        {/* Bot icon */}
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${difficulty.color} flex items-center justify-center text-2xl`}>
          {difficulty.emoji}
        </div>
        
        {/* Info */}
        <div className="flex-1">
          <h4 className={`font-bold ${selected ? difficulty.textColor : 'text-white'}`}>
            {difficulty.name}
          </h4>
          <p className="text-xs text-gray-400 mt-0.5">{difficulty.description}</p>
          
          {/* Stats */}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded text-xs ${difficulty.bgColor} ${difficulty.textColor}`}>
              {difficulty.winRate}
            </span>
            <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300">
              {difficulty.tapsPerSec}
            </span>
          </div>
        </div>
        
        {/* Selection indicator */}
        {selected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className={`w-6 h-6 rounded-full bg-gradient-to-br ${difficulty.color} flex items-center justify-center`}
          >
            <span className="text-white text-sm">✓</span>
          </motion.div>
        )}
      </div>
    </motion.button>
  );
};

// Main Component
export const BotDifficultySelector = ({
  isOpen,
  onClose,
  onStart,
  selectedPhoto,
  playerPhotos = [],
  userBalance = 0,
}) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [betAmount, setBetAmount] = useState(0);
  
  // Get current difficulty config
  const currentDifficulty = BOT_DIFFICULTIES.find(d => d.id === selectedDifficulty);
  
  // Check if user can afford bet
  const canAffordBet = userBalance >= betAmount;
  
  // Handle start battle
  const handleStart = () => {
    if (!selectedPhoto) {
      return;
    }
    
    onStart?.({
      difficulty: selectedDifficulty,
      betAmount: betAmount,
      photo: selectedPhoto,
      photos: playerPhotos,
    });
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
          className="bg-gray-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-gray-700"
          data-testid="bot-difficulty-modal"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Bot Battle</h3>
                <p className="text-xs text-gray-400">Choose your opponent difficulty</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
              data-testid="close-difficulty-modal"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-4 space-y-6">
            {/* Selected photo preview */}
            {selectedPhoto && (
              <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700/50">
                {selectedPhoto.image_url ? (
                  <img 
                    src={selectedPhoto.image_url} 
                    alt={selectedPhoto.name}
                    className="w-14 h-14 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-white font-medium">{selectedPhoto.name}</p>
                  <p className="text-yellow-400 text-sm font-bold">
                    ${(selectedPhoto.dollar_value || 0).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Your fighter</p>
                  <p className="text-purple-400 text-sm font-bold">⚔️ Ready</p>
                </div>
              </div>
            )}
            
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
                  />
                ))}
              </div>
            </div>
            
            {/* Bet amount */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-400" />
                Bet Amount (Optional)
                <span className="text-xs text-gray-500 ml-auto">Max: {MAX_BOT_BET} BL</span>
              </h4>
              
              <div className="flex flex-wrap gap-2">
                {BET_OPTIONS.map(amount => (
                  <button
                    key={amount}
                    onClick={() => setBetAmount(amount)}
                    disabled={amount > userBalance}
                    className={`px-4 py-2 rounded-lg font-bold transition-all ${
                      betAmount === amount
                        ? 'bg-yellow-500 text-black'
                        : amount > userBalance
                          ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    data-testid={`bet-${amount}`}
                  >
                    {amount === 0 ? 'Free' : `${amount} BL`}
                  </button>
                ))}
              </div>
              
              {/* Balance display */}
              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-gray-400">Your balance:</span>
                <span className={`font-bold ${userBalance >= betAmount ? 'text-green-400' : 'text-red-400'}`}>
                  {userBalance.toLocaleString()} BL
                </span>
              </div>
            </div>
            
            {/* Info box */}
            <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-gray-300">
                  <p className="font-medium text-purple-300 mb-1">Bot Match Rules:</p>
                  <ul className="space-y-0.5 text-gray-400">
                    <li>• Winner takes the entire pot (your bet × 2)</li>
                    <li>• 5% house fee on winnings</li>
                    <li>• Best of 3 rounds (first to 3 wins)</li>
                    <li>• Bot respects your win/lose streaks</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Start button */}
            <Button
              onClick={handleStart}
              disabled={!selectedPhoto || (betAmount > 0 && !canAffordBet)}
              className="w-full py-6 text-lg font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="start-bot-battle-btn"
            >
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">{currentDifficulty?.emoji}</span>
                <span>Fight {currentDifficulty?.name}</span>
                {betAmount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-black rounded text-sm">
                    {betAmount} BL
                  </span>
                )}
                <ChevronRight className="w-5 h-5" />
              </div>
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BotDifficultySelector;
