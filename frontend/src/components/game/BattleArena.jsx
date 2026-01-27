/**
 * BattleArena Component - Full Photo Auction Bidding Battle
 * 
 * Implements the EXACT game structure per user's specifications:
 * - Game = Best of 3 (first to win 3 rounds)
 * - Fixed round sequence:
 *   1. Photo Auction Bidding (tapping)
 *   2. Rock Paper Scissors Bidding
 *   3. Photo Auction Bidding (can end game if 3-0)
 *   4. Rock Paper Scissors Bidding (if needed)
 *   5. Photo Auction Bidding (tie-breaker if 2-2)
 * 
 * Entry requirements: 1-4 minted photos per player
 * Player selects photos strategically (one used per round)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Skull, Users, Loader2, RefreshCw, 
  Volume2, VolumeX, Image, X, ChevronRight, ChevronLeft,
  DollarSign, Coins, Zap, Target
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { TappingArena } from '../components/game/TappingArena';
import { RPSBidding } from '../components/game/RPSBidding';
import { StreakIndicator, StarDisplay, calculateStarBonus } from '../components/game/StreakIndicator';
import auctionSounds from '../utils/auctionSounds';
import api from '../services/api';

// Constants
const STARTING_RPS_MONEY = 5_000_000;
const MAX_PHOTOS_PER_PLAYER = 4;

// Round types in fixed sequence per spec
const ROUND_SEQUENCE = [
  { type: 'auction', name: 'Photo Auction Bidding', round: 1 },
  { type: 'rps', name: 'Rock Paper Scissors Bidding', round: 2 },
  { type: 'auction', name: 'Photo Auction Bidding', round: 3 },
  { type: 'rps', name: 'Rock Paper Scissors Bidding', round: 4 },
  { type: 'auction', name: 'Photo Auction Bidding (Tiebreaker)', round: 5 },
];

// Scenery config
const SCENERY_CONFIG = {
  natural: { name: 'Natural', color: 'from-green-500 to-emerald-600', icon: '🌿', strong: 'water', weak: 'manmade' },
  water: { name: 'Water', color: 'from-blue-500 to-cyan-600', icon: '🌊', strong: 'manmade', weak: 'natural' },
  manmade: { name: 'Man-made', color: 'from-orange-500 to-red-600', icon: '🏙️', strong: 'natural', weak: 'water' },
  neutral: { name: 'Neutral', color: 'from-gray-500 to-gray-600', icon: '⬜', strong: null, weak: 'all' },
};

// Format dollar value
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value?.toLocaleString()}`;
};

// Photo Selection Card for battle
const PhotoSelectionCard = ({ 
  photo, 
  selected, 
  used, 
  onSelect, 
  disabled 
}) => {
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  const starBonus = calculateStarBonus(photo?.level || 1);
  
  return (
    <motion.button
      onClick={() => !disabled && !used && onSelect(photo)}
      disabled={disabled || used}
      className={`relative w-28 h-36 rounded-xl overflow-hidden transition-all ${
        used 
          ? 'opacity-40 grayscale cursor-not-allowed' 
          : selected 
            ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-gray-900 scale-105' 
            : 'hover:scale-105 cursor-pointer'
      }`}
      whileHover={!disabled && !used ? { y: -4 } : {}}
      data-testid={`photo-select-${photo?.mint_id}`}
    >
      {/* Photo Image */}
      <div className="w-full h-24 bg-gray-800">
        {photo?.image_url ? (
          <img 
            src={photo.image_url} 
            alt={photo.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
            <span className="text-3xl opacity-60">{scenery.icon}</span>
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="p-2 bg-gray-900">
        <p className="text-xs text-white font-bold truncate">{photo?.name || 'Photo'}</p>
        <p className="text-xs text-yellow-400">{formatDollarValue(photo?.dollar_value)}</p>
        {starBonus > 0 && <StarDisplay level={photo?.level || 1} size="small" />}
      </div>
      
      {/* Scenery badge */}
      <div className="absolute top-1 left-1">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r ${scenery.color} text-white`}>
          {scenery.icon}
        </span>
      </div>
      
      {/* Used overlay */}
      {used && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <span className="text-white text-xs font-bold">USED</span>
        </div>
      )}
      
      {/* Selected checkmark */}
      {selected && !used && (
        <motion.div 
          className="absolute top-1 right-1 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <span className="text-white text-sm">✓</span>
        </motion.div>
      )}
    </motion.button>
  );
};

// Photo Selection Phase Component
const PhotoSelectionPhase = ({
  photos,
  usedPhotos,
  selectedPhoto,
  onSelect,
  onConfirm,
  roundInfo,
  opponentSelectedInfo = null,
}) => {
  const availablePhotos = photos.filter(p => !usedPhotos.includes(p.mint_id));
  
  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-2">
          Select Your Photo for Round {roundInfo.round}
        </h3>
        <p className="text-gray-400 text-sm">{roundInfo.name}</p>
        <p className="text-purple-400 text-xs mt-1">
          {availablePhotos.length} photo{availablePhotos.length !== 1 ? 's' : ''} remaining
        </p>
      </div>
      
      {/* Photo grid */}
      <div className="flex flex-wrap justify-center gap-3 mb-6">
        {photos.map((photo) => (
          <PhotoSelectionCard
            key={photo.mint_id}
            photo={photo}
            selected={selectedPhoto?.mint_id === photo.mint_id}
            used={usedPhotos.includes(photo.mint_id)}
            onSelect={onSelect}
            disabled={false}
          />
        ))}
      </div>
      
      {/* Opponent status */}
      {opponentSelectedInfo && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-4">
          {opponentSelectedInfo.ready ? (
            <>
              <span className="text-green-400">✓</span>
              <span>Opponent has selected their photo</span>
            </>
          ) : (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Waiting for opponent...</span>
            </>
          )}
        </div>
      )}
      
      {/* Confirm button */}
      <motion.div className="flex justify-center">
        <Button
          onClick={onConfirm}
          disabled={!selectedPhoto}
          className={`px-8 py-4 font-bold text-lg ${
            selectedPhoto 
              ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-red-600' 
              : 'bg-gray-700 cursor-not-allowed'
          }`}
          data-testid="confirm-photo-btn"
        >
          {selectedPhoto ? (
            <>
              Confirm {selectedPhoto.name} <ChevronRight className="w-5 h-5 ml-2" />
            </>
          ) : (
            'Select a Photo'
          )}
        </Button>
      </motion.div>
    </div>
  );
};

// Score Display Component
const ScoreDisplay = ({ playerWins, opponentWins, winsNeeded = 3 }) => {
  return (
    <div className="flex items-center justify-center gap-8 py-4">
      {/* Player score */}
      <div className="text-center">
        <p className="text-xs text-gray-400 mb-1">YOU</p>
        <div className="flex gap-1">
          {[...Array(winsNeeded)].map((_, i) => (
            <motion.div
              key={i}
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                i < playerWins 
                  ? 'bg-green-500' 
                  : 'bg-gray-700'
              }`}
              initial={{ scale: i < playerWins ? 0 : 1 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 * i }}
            >
              {i < playerWins && <span className="text-white text-sm">✓</span>}
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* VS */}
      <div className="text-2xl font-bold text-gray-500">VS</div>
      
      {/* Opponent score */}
      <div className="text-center">
        <p className="text-xs text-gray-400 mb-1">OPPONENT</p>
        <div className="flex gap-1">
          {[...Array(winsNeeded)].map((_, i) => (
            <motion.div
              key={i}
              className={`w-8 h-8 rounded-full flex items-center justify-center ${
                i < opponentWins 
                  ? 'bg-red-500' 
                  : 'bg-gray-700'
              }`}
              initial={{ scale: i < opponentWins ? 0 : 1 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1 * i }}
            >
              {i < opponentWins && <span className="text-white text-sm">✓</span>}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Round Transition Animation
const RoundTransition = ({ roundInfo, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 0.5 }}
        className="text-center"
      >
        <motion.div 
          className="text-7xl mb-4"
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, -10, 10, 0]
          }}
          transition={{ duration: 0.5, repeat: 2 }}
        >
          {roundInfo.type === 'auction' ? '⚔️' : '🎲'}
        </motion.div>
        <motion.h2 
          className="text-4xl font-bold text-white mb-2"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Round {roundInfo.round}
        </motion.h2>
        <motion.p 
          className="text-xl text-purple-400"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {roundInfo.name}
        </motion.p>
      </motion.div>
    </motion.div>
  );
};

// Game Result Screen
const GameResultScreen = ({ 
  winner, 
  playerWins, 
  opponentWins, 
  betAmount = 0, 
  onPlayAgain 
}) => {
  const isWinner = winner === 'player';
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-b from-gray-800/50 to-gray-900/50 rounded-2xl p-8 border border-gray-700/50 text-center relative overflow-hidden"
    >
      {/* Confetti for win */}
      {isWinner && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute text-2xl"
              initial={{ top: -20, left: `${Math.random() * 100}%`, rotate: 0 }}
              animate={{ top: '110%', rotate: 360 }}
              transition={{ 
                duration: 2 + Math.random() * 2,
                delay: Math.random() * 0.5,
                repeat: Infinity
              }}
            >
              {['🎉', '✨', '💰', '🏆', '💎'][Math.floor(Math.random() * 5)]}
            </motion.div>
          ))}
        </div>
      )}
      
      <div className="relative z-10">
        {isWinner ? (
          <>
            <motion.div
              animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: 5 }}
              className="text-8xl mb-4"
            >
              🏆
            </motion.div>
            <h2 className="text-4xl font-bold text-green-400 mb-4">Victory!</h2>
            <p className="text-gray-400 mb-2">
              You won {playerWins} - {opponentWins}
            </p>
            {betAmount > 0 && (
              <motion.p 
                className="text-yellow-400 text-2xl mb-6"
                animate={{ scale: [1, 1.2, 1] }}
              >
                +{betAmount * 2} BL Coins 💰
              </motion.p>
            )}
          </>
        ) : (
          <>
            <div className="text-8xl mb-4">😢</div>
            <h2 className="text-4xl font-bold text-red-400 mb-4">Defeat</h2>
            <p className="text-gray-400 mb-2">
              You lost {playerWins} - {opponentWins}
            </p>
            {betAmount > 0 && (
              <p className="text-gray-400 text-2xl mb-6">-{betAmount} BL Coins</p>
            )}
          </>
        )}
        
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={onPlayAgain}
            className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 px-12 py-6 text-xl font-bold shadow-lg"
            size="lg"
            data-testid="play-again-btn"
          >
            <RefreshCw className="w-6 h-6 mr-2" />
            Play Again
            <span className="ml-2 text-2xl">🎮</span>
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
};

// Main BattleArena Component
export const BattleArena = ({
  playerPhotos,
  opponentPhotos,
  session,
  isBot = false,
  botDifficulty = 'medium',
  betAmount = 0,
  soundEnabled = true,
  websocket = null,
  onGameComplete,
  onExit,
}) => {
  // Game state
  const [gamePhase, setGamePhase] = useState('photo_selection'); // photo_selection, transition, playing, result
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  
  // Scores
  const [playerWins, setPlayerWins] = useState(0);
  const [opponentWins, setOpponentWins] = useState(0);
  
  // Photo selection
  const [playerUsedPhotos, setPlayerUsedPhotos] = useState([]);
  const [opponentUsedPhotos, setOpponentUsedPhotos] = useState([]);
  const [selectedPlayerPhoto, setSelectedPlayerPhoto] = useState(null);
  const [selectedOpponentPhoto, setSelectedOpponentPhoto] = useState(null);
  
  // RPS money
  const [playerRPSMoney, setPlayerRPSMoney] = useState(STARTING_RPS_MONEY);
  const [opponentRPSMoney, setOpponentRPSMoney] = useState(STARTING_RPS_MONEY);
  
  // Streak and stats
  const [playerStats, setPlayerStats] = useState({
    current_win_streak: 0,
    current_lose_streak: 0,
  });
  const [opponentStats, setOpponentStats] = useState({
    current_win_streak: 0,
    current_lose_streak: 0,
  });
  
  // Winner
  const [gameWinner, setGameWinner] = useState(null);
  
  // Get current round info
  const currentRound = ROUND_SEQUENCE[currentRoundIndex];
  const WINS_NEEDED = 3;
  
  // Select bot photo for opponent
  const selectBotPhoto = useCallback(() => {
    if (!isBot || !opponentPhotos) return null;
    
    const availablePhotos = opponentPhotos.filter(p => !opponentUsedPhotos.includes(p.mint_id));
    if (availablePhotos.length === 0) return opponentPhotos[0];
    
    // Bot strategy based on difficulty
    if (botDifficulty === 'hard') {
      // Hard bot picks highest value
      return availablePhotos.sort((a, b) => (b.dollar_value || 0) - (a.dollar_value || 0))[0];
    } else if (botDifficulty === 'easy') {
      // Easy bot picks randomly
      return availablePhotos[Math.floor(Math.random() * availablePhotos.length)];
    } else {
      // Medium bot picks mid-tier
      const sorted = availablePhotos.sort((a, b) => (b.dollar_value || 0) - (a.dollar_value || 0));
      return sorted[Math.floor(sorted.length / 2)] || sorted[0];
    }
  }, [isBot, opponentPhotos, opponentUsedPhotos, botDifficulty]);
  
  // Handle photo confirmation
  const handlePhotoConfirm = useCallback(() => {
    if (!selectedPlayerPhoto) return;
    
    // Mark player photo as used
    setPlayerUsedPhotos(prev => [...prev, selectedPlayerPhoto.mint_id]);
    
    // Bot selects opponent photo
    const botPhoto = selectBotPhoto();
    if (botPhoto) {
      setSelectedOpponentPhoto(botPhoto);
      setOpponentUsedPhotos(prev => [...prev, botPhoto.mint_id]);
    }
    
    // Play sound
    if (soundEnabled) {
      auctionSounds.selectionConfirm();
    }
    
    // Transition to game
    setGamePhase('transition');
  }, [selectedPlayerPhoto, selectBotPhoto, soundEnabled]);
  
  // Handle round completion
  const handleRoundComplete = useCallback((winner) => {
    // Update scores
    if (winner === 'player') {
      const newWins = playerWins + 1;
      setPlayerWins(newWins);
      
      // Update streaks
      setPlayerStats(prev => ({
        current_win_streak: prev.current_win_streak + 1,
        current_lose_streak: 0,
      }));
      
      // Check for game win
      if (newWins >= WINS_NEEDED) {
        setGameWinner('player');
        setGamePhase('result');
        if (soundEnabled) auctionSounds.battleVictory();
        return;
      }
    } else if (winner === 'opponent') {
      const newWins = opponentWins + 1;
      setOpponentWins(newWins);
      
      // Update streaks
      setPlayerStats(prev => ({
        current_win_streak: 0,
        current_lose_streak: prev.current_lose_streak + 1,
      }));
      
      // Check for game loss
      if (newWins >= WINS_NEEDED) {
        setGameWinner('opponent');
        setGamePhase('result');
        if (soundEnabled) auctionSounds.battleDefeat();
        return;
      }
    }
    // Tie in RPS: no score change
    
    // Move to next round
    const nextIndex = currentRoundIndex + 1;
    if (nextIndex < ROUND_SEQUENCE.length) {
      setCurrentRoundIndex(nextIndex);
      setSelectedPlayerPhoto(null);
      setSelectedOpponentPhoto(null);
      setGamePhase('photo_selection');
    } else {
      // Shouldn't happen with proper game logic, but handle edge case
      setGameWinner(playerWins > opponentWins ? 'player' : 'opponent');
      setGamePhase('result');
    }
  }, [playerWins, opponentWins, currentRoundIndex, soundEnabled]);
  
  // Handle RPS round complete (with money tracking)
  const handleRPSRoundComplete = useCallback((winner, newPlayerMoney, newOpponentMoney) => {
    setPlayerRPSMoney(newPlayerMoney);
    setOpponentRPSMoney(newOpponentMoney);
    handleRoundComplete(winner);
  }, [handleRoundComplete]);
  
  // Handle transition complete
  const handleTransitionComplete = useCallback(() => {
    setGamePhase('playing');
  }, []);
  
  // Handle play again
  const handlePlayAgain = useCallback(() => {
    // Reset all state
    setCurrentRoundIndex(0);
    setPlayerWins(0);
    setOpponentWins(0);
    setPlayerUsedPhotos([]);
    setOpponentUsedPhotos([]);
    setSelectedPlayerPhoto(null);
    setSelectedOpponentPhoto(null);
    setPlayerRPSMoney(STARTING_RPS_MONEY);
    setOpponentRPSMoney(STARTING_RPS_MONEY);
    setPlayerStats({ current_win_streak: 0, current_lose_streak: 0 });
    setOpponentStats({ current_win_streak: 0, current_lose_streak: 0 });
    setGameWinner(null);
    setGamePhase('photo_selection');
    
    if (onGameComplete) {
      onGameComplete(gameWinner);
    }
  }, [gameWinner, onGameComplete]);
  
  return (
    <div className="min-h-[70vh]" data-testid="battle-arena">
      {/* Score display */}
      <ScoreDisplay 
        playerWins={playerWins} 
        opponentWins={opponentWins} 
        winsNeeded={WINS_NEEDED} 
      />
      
      {/* Round indicator */}
      {gamePhase !== 'result' && (
        <div className="text-center mb-4">
          <span className="text-gray-500 text-sm">
            Round {currentRound?.round || 1} of 5 (max)
          </span>
        </div>
      )}
      
      {/* Main game content */}
      <AnimatePresence mode="wait">
        {/* Photo Selection Phase */}
        {gamePhase === 'photo_selection' && (
          <motion.div
            key="photo-selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <PhotoSelectionPhase
              photos={playerPhotos}
              usedPhotos={playerUsedPhotos}
              selectedPhoto={selectedPlayerPhoto}
              onSelect={setSelectedPlayerPhoto}
              onConfirm={handlePhotoConfirm}
              roundInfo={currentRound}
              opponentSelectedInfo={isBot ? { ready: true } : null}
            />
          </motion.div>
        )}
        
        {/* Round Transition */}
        {gamePhase === 'transition' && (
          <RoundTransition 
            roundInfo={currentRound} 
            onComplete={handleTransitionComplete} 
          />
        )}
        
        {/* Playing - Tapping Arena (Rounds 1, 3, 5) */}
        {gamePhase === 'playing' && currentRound?.type === 'auction' && (
          <motion.div
            key={`auction-${currentRound.round}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <TappingArena
              playerPhoto={selectedPlayerPhoto}
              opponentPhoto={selectedOpponentPhoto}
              playerStats={playerStats}
              opponentStats={opponentStats}
              roundNumber={currentRound.round}
              onRoundComplete={handleRoundComplete}
              websocket={websocket}
              isBot={isBot}
              botDifficulty={botDifficulty}
              soundEnabled={soundEnabled}
            />
          </motion.div>
        )}
        
        {/* Playing - RPS Bidding (Rounds 2, 4) */}
        {gamePhase === 'playing' && currentRound?.type === 'rps' && (
          <motion.div
            key={`rps-${currentRound.round}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <RPSBidding
              roundNumber={currentRound.round}
              playerMoney={playerRPSMoney}
              opponentMoney={opponentRPSMoney}
              playerWins={playerWins}
              opponentWins={opponentWins}
              onRoundComplete={handleRPSRoundComplete}
              isBot={isBot}
              botDifficulty={botDifficulty}
              soundEnabled={soundEnabled}
            />
          </motion.div>
        )}
        
        {/* Game Result */}
        {gamePhase === 'result' && gameWinner && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <GameResultScreen
              winner={gameWinner}
              playerWins={playerWins}
              opponentWins={opponentWins}
              betAmount={betAmount}
              onPlayAgain={handlePlayAgain}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BattleArena;
