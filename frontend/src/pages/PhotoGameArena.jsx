import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Swords, Trophy, Zap, Users, Bot, Clock, 
  Hand, Scissors, FileText, Sparkles, Crown,
  Shield, Target, TrendingUp, Coins, RefreshCw,
  X, Check, AlertCircle, Loader2, Image, ChevronRight,
  DollarSign, Gavel, Banknote, Volume2, VolumeX, Maximize2
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { AuthContext } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import auctionSounds from '../utils/auctionSounds';

// ============== PHOTO LIGHTBOX MODAL ==============
const PhotoLightbox = ({ photo, isOpen, onClose }) => {
  if (!isOpen || !photo) return null;
  
  const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.natural;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative max-w-3xl w-full max-h-[85vh] bg-gray-900 rounded-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
          
          {/* Full-size image */}
          <div className="relative bg-black flex items-center justify-center" style={{ maxHeight: '55vh' }}>
            {photo.image_url ? (
              <img 
                src={photo.image_url} 
                alt={photo.name}
                className="max-w-full max-h-[55vh] object-contain"
              />
            ) : (
              <div className={`w-full h-64 bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
                <span className="text-8xl opacity-50">{scenery.icon}</span>
              </div>
            )}
          </div>
          
          {/* Photo info below image */}
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">{photo.name}</h2>
              <span className={`px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r ${scenery.color} text-white`}>
                {scenery.label}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Dollar Value</p>
                <p className="text-lg font-bold text-yellow-400">{formatDollarValue(photo.dollar_value)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Power</p>
                <p className="text-lg font-bold text-purple-400">{photo.power?.toFixed(0) || 100}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Stamina</p>
                <p className="text-lg font-bold text-green-400">{Math.round(photo.stamina || 100)}%</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-lg bg-green-500/20 text-green-400 text-sm">
                +25% vs {SCENERY_CONFIG[photo.strength_vs]?.label || 'Water'}
              </span>
              <span className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-sm">
                -25% vs {SCENERY_CONFIG[photo.weakness_vs]?.label || 'Man-made'}
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ============== CONSTANTS ==============
const RPS_CHOICES = [
  { id: 'rock', icon: '🪨', label: 'Rock', beats: 'scissors' },
  { id: 'paper', icon: '📄', label: 'Paper', beats: 'rock' },
  { id: 'scissors', icon: '✂️', label: 'Scissors', beats: 'paper' },
];

const SCENERY_CONFIG = {
  natural: { color: 'from-green-500 to-emerald-600', icon: '🌿', label: 'Natural', strong: 'water', weak: 'manmade' },
  water: { color: 'from-blue-500 to-cyan-600', icon: '🌊', label: 'Water', strong: 'manmade', weak: 'natural' },
  manmade: { color: 'from-orange-500 to-red-600', icon: '🏙️', label: 'Man-made', strong: 'natural', weak: 'water' },
};

const STARTING_BANKROLL = 10_000_000;
const MIN_BID = 1_000_000;
const MAX_BID = 5_000_000;
const BID_INCREMENT = 1_000_000;

// ============== HELPER FUNCTIONS ==============
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value?.toLocaleString()}`;
};

const formatBankroll = (value) => {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value?.toLocaleString()}`;
};

// ============== ANIMATED COMPONENTS ==============

// Animated Gavel Component
const AnimatedGavel = ({ isSlaming }) => {
  return (
    <motion.div
      className="relative"
      animate={isSlaming ? {
        rotate: [-45, 0, -45],
        y: [0, 20, 0],
      } : {}}
      transition={{ duration: 0.3, times: [0, 0.5, 1] }}
    >
      <span className="text-6xl">🔨</span>
    </motion.div>
  );
};

// Animated Auction Paddle
const AuctionPaddle = ({ number, isRaised, color = "purple" }) => {
  return (
    <motion.div
      className="relative flex flex-col items-center"
      animate={isRaised ? { y: -30, scale: 1.1 } : { y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
    >
      {/* Paddle */}
      <motion.div 
        className={`w-20 h-24 rounded-t-full bg-gradient-to-b ${
          color === "purple" ? "from-purple-400 to-purple-600" : "from-red-400 to-red-600"
        } flex items-center justify-center shadow-lg border-4 border-yellow-400`}
        animate={isRaised ? { rotate: [0, -10, 10, 0] } : {}}
        transition={{ duration: 0.5 }}
      >
        <span className="text-2xl font-bold text-white drop-shadow-lg">
          {formatBankroll(number)}
        </span>
      </motion.div>
      {/* Handle */}
      <div className={`w-3 h-16 ${color === "purple" ? "bg-amber-700" : "bg-amber-800"} rounded-b-lg`} />
    </motion.div>
  );
};

// Flying Coins Animation
const FlyingCoins = ({ from, to, amount, onComplete }) => {
  const coins = Array(Math.min(5, Math.ceil(amount / 1_000_000))).fill(0);
  
  return (
    <AnimatePresence>
      {coins.map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-3xl z-50"
          initial={{ 
            x: from?.x || 0, 
            y: from?.y || 0,
            opacity: 1,
            scale: 0.5
          }}
          animate={{ 
            x: to?.x || 0, 
            y: to?.y || 0,
            opacity: [1, 1, 0],
            scale: [0.5, 1.2, 0.8]
          }}
          transition={{ 
            duration: 0.6, 
            delay: i * 0.1,
            ease: "easeOut"
          }}
          onAnimationComplete={() => i === coins.length - 1 && onComplete?.()}
        >
          💰
        </motion.div>
      ))}
    </AnimatePresence>
  );
};

// Stamina Bar with animation
const StaminaBar = ({ stamina, maxStamina = 100, showLabel = true }) => {
  const percent = (stamina / maxStamina) * 100;
  return (
    <div className="flex items-center gap-2">
      <Zap className="w-4 h-4 text-yellow-400" />
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <motion.div 
          className={`h-full ${percent > 20 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : 'bg-red-500'}`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      {showLabel && <span className="text-sm text-gray-400">{Math.round(stamina)}/{maxStamina}</span>}
    </div>
  );
};

// Bankroll Display with coin animation
const BankrollDisplay = ({ bankroll, isPlayer, showChange, changeAmount }) => {
  const [displayValue, setDisplayValue] = useState(bankroll);
  
  useEffect(() => {
    // Animate value change
    const start = displayValue;
    const end = bankroll;
    const duration = 500;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = Math.round(start + (end - start) * progress);
      setDisplayValue(current);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  }, [bankroll]);
  
  return (
    <motion.div 
      className={`relative flex items-center gap-2 px-4 py-2 rounded-lg ${isPlayer ? 'bg-purple-900/50' : 'bg-red-900/50'}`}
      animate={showChange ? { scale: [1, 1.1, 1] } : {}}
      transition={{ duration: 0.3 }}
    >
      <Banknote className={`w-5 h-5 ${isPlayer ? 'text-purple-400' : 'text-red-400'}`} />
      <span className={`font-bold tabular-nums ${isPlayer ? 'text-purple-300' : 'text-red-300'}`}>
        {formatBankroll(displayValue)}
      </span>
      
      {/* Change indicator */}
      <AnimatePresence>
        {showChange && changeAmount !== 0 && (
          <motion.span
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: -20 }}
            exit={{ opacity: 0, y: -40 }}
            className={`absolute -top-2 right-0 text-sm font-bold ${
              changeAmount > 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {changeAmount > 0 ? '+' : ''}{formatBankroll(changeAmount)}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Win Streak Badge
const WinStreakBadge = ({ streak }) => {
  if (streak < 3) return null;
  const multiplier = streak >= 6 ? 2 : streak >= 5 ? 1.75 : streak >= 4 ? 1.5 : 1.25;
  return (
    <motion.div 
      className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full text-white text-xs font-bold"
      animate={{ scale: [1, 1.1, 1] }}
      transition={{ duration: 0.5, repeat: Infinity }}
    >
      <Trophy className="w-3 h-3" />
      {streak} Win Streak! ({multiplier}x)
    </motion.div>
  );
};

// Sound Toggle Button
const SoundToggle = ({ enabled, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 transition-colors"
      title={enabled ? "Mute sounds" : "Enable sounds"}
    >
      {enabled ? (
        <Volume2 className="w-5 h-5 text-purple-400" />
      ) : (
        <VolumeX className="w-5 h-5 text-gray-500" />
      )}
    </button>
  );
};

// ============== PHOTO SELECTION COMPONENT ==============
const PhotoSelectionScreen = ({ photos, loading, onSelectPhoto, selectedPhotoId, onViewPhoto }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!photos || photos.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-800/50 rounded-xl border border-gray-700/50">
        <Image className="w-16 h-16 mx-auto text-gray-600 mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">No Minted Photos</h3>
        <p className="text-gray-400 mb-4">Mint some photos first to enter battles!</p>
        <Button 
          onClick={() => window.location.href = '/minted-photos'}
          className="bg-gradient-to-r from-purple-600 to-pink-600"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Mint Photos
        </Button>
      </div>
    );
  }

  const availablePhotos = photos.filter(p => p.is_available);
  const unavailablePhotos = photos.filter(p => !p.is_available);

  const handlePhotoClick = (photo) => {
    auctionSounds.selectionConfirm();
    onSelectPhoto(photo);
  };
  
  const handleViewFullImage = (e, photo) => {
    e.stopPropagation(); // Don't select the photo, just view it
    if (onViewPhoto) {
      onViewPhoto(photo);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-2">Select Your Battle Photo</h3>
        <p className="text-gray-400">
          Sorted by Dollar Value (Power). 
          <span className="text-yellow-400 ml-1">Higher value = stronger!</span>
        </p>
      </div>

      {availablePhotos.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-green-400 flex items-center gap-2">
            <Check className="w-4 h-4" />
            Available for Battle ({availablePhotos.length})
          </h4>
          <div className="grid gap-3">
            {availablePhotos.map((photo) => {
              const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.natural;
              const isSelected = selectedPhotoId === photo.mint_id;
              
              return (
                <motion.button
                  key={photo.mint_id}
                  onClick={() => handlePhotoClick(photo)}
                  className={`relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected 
                      ? 'bg-purple-900/50 border-purple-500 ring-2 ring-purple-400' 
                      : 'bg-gray-800/50 border-gray-700/50 hover:border-purple-500/50'
                  }`}
                  whileHover={{ scale: 1.01, x: 5 }}
                  whileTap={{ scale: 0.99 }}
                  onHoverStart={() => auctionSounds.buttonHover()}
                  data-testid={`photo-select-${photo.mint_id}`}
                >
                  {/* Photo thumbnail - show actual image if available */}
                  <div className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 ${!photo.image_url ? `bg-gradient-to-br ${scenery.color}` : 'bg-gray-900'}`}>
                    {photo.image_url ? (
                      <img 
                        src={photo.image_url} 
                        alt={photo.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
                        <motion.span 
                          className="text-2xl"
                          animate={isSelected ? { rotate: [0, -10, 10, 0] } : {}}
                          transition={{ duration: 0.5 }}
                        >
                          {scenery.icon}
                        </motion.span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-white truncate">{photo.name}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold bg-gradient-to-r ${scenery.color} text-white`}>
                        {scenery.label}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-yellow-400 font-bold">
                        {formatDollarValue(photo.dollar_value)}
                      </span>
                      <span className="text-gray-400">
                        <Shield className="w-3 h-3 inline mr-1" />
                        Strong vs {SCENERY_CONFIG[photo.strength_vs]?.label || 'Unknown'}
                      </span>
                    </div>
                    
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 max-w-32">
                        <StaminaBar stamina={photo.stamina} showLabel={false} />
                      </div>
                      <span className="text-xs text-gray-400">
                        {Math.round(photo.stamina)}% ({photo.battles_remaining} battles)
                      </span>
                    </div>
                  </div>
                  
                  <motion.div 
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-600'
                    }`}
                    animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.2 }}
                  >
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </motion.div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {unavailablePhotos.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-500 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Resting ({unavailablePhotos.length})
          </h4>
          <div className="grid gap-3">
            {unavailablePhotos.map((photo) => {
              const scenery = SCENERY_CONFIG[photo.scenery_type] || SCENERY_CONFIG.natural;
              
              return (
                <div
                  key={photo.mint_id}
                  className="relative flex items-center gap-4 p-4 rounded-xl border border-gray-700/50 bg-gray-800/30 opacity-50 cursor-not-allowed"
                >
                  {/* Photo thumbnail - show actual image if available */}
                  <div className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 grayscale ${!photo.image_url ? `bg-gradient-to-br ${scenery.color}` : 'bg-gray-900'}`}>
                    {photo.image_url ? (
                      <img 
                        src={photo.image_url} 
                        alt={photo.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
                        <span className="text-2xl">{scenery.icon}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-400 truncate">{photo.name}</h4>
                    <span className="text-gray-500">{formatDollarValue(photo.dollar_value)}</span>
                    <div className="mt-2 text-xs text-red-400">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Available in ~{photo.time_until_available || 60} min
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ============== MILLION DOLLAR RPS AUCTION COMPONENT ==============
const RPSAuctionBattle = ({ 
  session, 
  onMove, 
  playerBankroll, 
  opponentBankroll,
  playerWins,
  opponentWins,
  lastRound,
  isTiebreaker 
}) => {
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [bidAmount, setBidAmount] = useState(MIN_BID);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showGavel, setShowGavel] = useState(false);
  const [playerPaddleRaised, setPlayerPaddleRaised] = useState(false);
  const [opponentPaddleRaised, setOpponentPaddleRaised] = useState(false);
  const [bankrollChange, setBankrollChange] = useState({ player: 0, opponent: 0, show: false });

  useEffect(() => {
    if (lastRound) {
      // Raise paddles
      setPlayerPaddleRaised(true);
      auctionSounds.paddleRaise();
      
      setTimeout(() => {
        setOpponentPaddleRaised(true);
        auctionSounds.paddleRaise();
      }, 300);
      
      // Show result
      setTimeout(() => {
        setShowResult(true);
        auctionSounds.bidPlaced();
        
        // Calculate bankroll changes
        const playerChange = lastRound.player1_bankroll_after - (playerBankroll + (lastRound.winner === 'player1' ? 0 : lastRound.player1_bid));
        const opponentChange = lastRound.player2_bankroll_after - (opponentBankroll + (lastRound.winner === 'player2' ? 0 : lastRound.player2_bid));
        
        setBankrollChange({ 
          player: lastRound.winner === 'player1' ? lastRound.total_pot : -lastRound.player1_bid,
          opponent: lastRound.winner === 'player2' ? lastRound.total_pot : -lastRound.player2_bid,
          show: true 
        });
        
        // Gavel slam
        setTimeout(() => {
          setShowGavel(true);
          auctionSounds.gavelSlam();
        }, 500);
        
        // Play win/lose sound
        setTimeout(() => {
          if (lastRound.winner === 'player1') {
            auctionSounds.roundWin();
            auctionSounds.coinsCount();
          } else if (lastRound.winner === 'player2') {
            auctionSounds.roundLose();
          }
        }, 800);
      }, 600);
      
      // Reset
      const timer = setTimeout(() => {
        setShowResult(false);
        setShowGavel(false);
        setPlayerPaddleRaised(false);
        setOpponentPaddleRaised(false);
        setSelectedChoice(null);
        setBankrollChange({ player: 0, opponent: 0, show: false });
      }, 2500);
      
      return () => clearTimeout(timer);
    }
  }, [lastRound]);

  const handleChoiceSelect = (choiceId) => {
    auctionSounds.selectionConfirm();
    setSelectedChoice(choiceId);
  };

  const handleBidSelect = (bid) => {
    auctionSounds.buttonHover();
    setBidAmount(bid);
  };

  const handleSubmit = async () => {
    if (!selectedChoice || isSubmitting) return;
    setIsSubmitting(true);
    auctionSounds.paddleRaise();
    
    try {
      await onMove(selectedChoice, bidAmount);
    } finally {
      setIsSubmitting(false);
    }
  };

  const maxBid = Math.min(MAX_BID, playerBankroll);
  const bidOptions = [];
  for (let bid = MIN_BID; bid <= maxBid; bid += BID_INCREMENT) {
    bidOptions.push(bid);
  }

  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50 relative overflow-hidden">
      {/* Auction house background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-4 left-4 text-6xl">🏛️</div>
        <div className="absolute bottom-4 right-4 text-6xl">💎</div>
      </div>
      
      <div className="relative z-10">
        {/* Header */}
        <div className="text-center mb-6">
          {isTiebreaker && (
            <motion.div 
              className="inline-flex items-center gap-2 bg-yellow-500/20 text-yellow-400 px-4 py-2 rounded-full text-sm font-bold mb-4"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              <Gavel className="w-4 h-4" />
              ⚡ TIEBREAKER ROUND ⚡
            </motion.div>
          )}
          <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
            <motion.span
              animate={{ rotate: [0, -10, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              🔨
            </motion.span>
            <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
              Million Dollar RPS Auction
            </span>
            <motion.span
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              💰
            </motion.span>
          </h3>
          <p className="text-gray-400">Choose RPS + Bid Amount. First to 3 wins!</p>
        </div>

        {/* Auction Paddles & Bankrolls */}
        <div className="flex justify-between items-end mb-8 px-8">
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-gray-400">Your Bankroll</p>
            <BankrollDisplay 
              bankroll={playerBankroll} 
              isPlayer={true} 
              showChange={bankrollChange.show}
              changeAmount={bankrollChange.player}
            />
            <AuctionPaddle 
              number={bidAmount} 
              isRaised={playerPaddleRaised} 
              color="purple"
            />
            <p className="text-xs text-purple-400 font-bold">YOU</p>
          </div>
          
          {/* Score Display */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-6 mb-4">
              <motion.span 
                className="text-4xl font-bold text-purple-400"
                animate={playerWins > 0 ? { scale: [1, 1.3, 1] } : {}}
                key={playerWins}
              >
                {playerWins}
              </motion.span>
              <span className="text-gray-500 text-2xl">-</span>
              <motion.span 
                className="text-4xl font-bold text-red-400"
                animate={opponentWins > 0 ? { scale: [1, 1.3, 1] } : {}}
                key={opponentWins}
              >
                {opponentWins}
              </motion.span>
            </div>
            <p className="text-sm text-gray-500">First to 3</p>
            
            {/* Gavel Animation */}
            <AnimatePresence>
              {showGavel && (
                <motion.div
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="mt-4"
                >
                  <AnimatedGavel isSlaming={true} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-gray-400">Opponent</p>
            <BankrollDisplay 
              bankroll={opponentBankroll} 
              isPlayer={false}
              showChange={bankrollChange.show}
              changeAmount={bankrollChange.opponent}
            />
            <AuctionPaddle 
              number={lastRound?.player2_bid || MIN_BID} 
              isRaised={opponentPaddleRaised} 
              color="red"
            />
            <p className="text-xs text-red-400 font-bold">OPPONENT</p>
          </div>
        </div>

        {/* Last Round Result */}
        <AnimatePresence>
          {showResult && lastRound && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="mb-6 p-6 bg-gradient-to-r from-gray-900/80 to-gray-800/80 rounded-xl border border-yellow-500/30"
            >
              <div className="flex items-center justify-center gap-12 mb-4">
                <motion.div 
                  className="text-center"
                  animate={{ x: [-10, 10, -10, 0] }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-xs text-gray-400 mb-1">You</p>
                  <motion.span 
                    className="text-5xl block"
                    animate={{ scale: [1, 1.3, 1] }}
                  >
                    {RPS_CHOICES.find(c => c.id === lastRound.player1_choice)?.icon}
                  </motion.span>
                  <p className="text-yellow-400 font-bold mt-1">{formatBankroll(lastRound.player1_bid)}</p>
                </motion.div>
                
                <motion.div 
                  className="text-3xl font-bold"
                  animate={{ scale: [1, 1.5, 1], rotate: [0, 360] }}
                  transition={{ duration: 0.5 }}
                >
                  ⚔️
                </motion.div>
                
                <motion.div 
                  className="text-center"
                  animate={{ x: [10, -10, 10, 0] }}
                  transition={{ duration: 0.3 }}
                >
                  <p className="text-xs text-gray-400 mb-1">Opponent</p>
                  <motion.span 
                    className="text-5xl block"
                    animate={{ scale: [1, 1.3, 1] }}
                  >
                    {RPS_CHOICES.find(c => c.id === lastRound.player2_choice)?.icon}
                  </motion.span>
                  <p className="text-yellow-400 font-bold mt-1">{formatBankroll(lastRound.player2_bid)}</p>
                </motion.div>
              </div>
              
              <motion.div 
                className={`text-center text-xl font-bold ${
                  lastRound.winner === 'player1' ? 'text-green-400' : 
                  lastRound.winner === 'player2' ? 'text-red-400' : 'text-yellow-400'
                }`}
                animate={{ scale: [1, 1.1, 1] }}
              >
                {lastRound.winner === 'player1' 
                  ? `🎉 You won ${formatBankroll(lastRound.total_pot)}!` 
                  : lastRound.winner === 'player2' 
                    ? `😢 Lost ${formatBankroll(lastRound.player1_bid)}` 
                    : '🤝 Tie - No pot change!'}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* RPS Choice & Bid Selection */}
        {!showResult && (
          <>
            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-3 text-center">Choose your move:</p>
              <div className="flex justify-center gap-4">
                {RPS_CHOICES.map((choice) => (
                  <motion.button
                    key={choice.id}
                    onClick={() => handleChoiceSelect(choice.id)}
                    className={`w-28 h-28 rounded-2xl flex flex-col items-center justify-center transition-all shadow-lg ${
                      selectedChoice === choice.id 
                        ? 'bg-purple-600 ring-4 ring-purple-400 ring-offset-2 ring-offset-gray-900' 
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                    data-testid={`rps-choice-${choice.id}`}
                  >
                    <motion.span 
                      className="text-5xl mb-1"
                      animate={selectedChoice === choice.id ? { rotate: [0, -10, 10, 0] } : {}}
                      transition={{ duration: 0.3 }}
                    >
                      {choice.icon}
                    </motion.span>
                    <span className="text-xs text-gray-300">{choice.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-3 text-center">Set your bid:</p>
              <div className="flex flex-wrap justify-center gap-3">
                {bidOptions.map((bid) => (
                  <motion.button
                    key={bid}
                    onClick={() => handleBidSelect(bid)}
                    className={`px-5 py-3 rounded-xl font-bold transition-all shadow-md ${
                      bidAmount === bid 
                        ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black scale-110' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    data-testid={`bid-${bid}`}
                  >
                    💵 {formatBankroll(bid)}
                  </motion.button>
                ))}
              </div>
            </div>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                onClick={handleSubmit}
                disabled={!selectedChoice || isSubmitting || playerBankroll < MIN_BID}
                className="w-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 text-black font-bold text-lg py-6 shadow-lg"
                size="lg"
                data-testid="submit-rps-auction"
              >
                {isSubmitting ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : playerBankroll < MIN_BID ? (
                  <span className="flex items-center gap-2">
                    💸 Bankrupt! Game Over
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Gavel className="w-6 h-6" />
                    Place Bid: {selectedChoice?.toUpperCase() || '???'} + {formatBankroll(bidAmount)}
                    <span className="text-2xl">🎯</span>
                  </span>
                )}
              </Button>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

// ============== BATTLE PHOTO CARD COMPONENT ==============
const BattlePhotoCard = ({ photo, isPlayer, effectiveValue, isAnimating, hasResult }) => {
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  
  return (
    <motion.div
      className={`relative w-48 rounded-xl overflow-hidden border-4 shadow-2xl ${
        isPlayer ? 'border-purple-500' : 'border-red-500'
      }`}
      animate={isAnimating ? { 
        x: isPlayer ? [0, 100, 0] : [0, -100, 0],
        scale: [1, 1.15, 1],
        rotate: isPlayer ? [0, 5, -5, 0] : [0, -5, 5, 0]
      } : {}}
      transition={{ duration: 0.8, repeat: isAnimating ? 2 : 0 }}
    >
      {/* Photo image - show actual photo if available */}
      <div className="aspect-square relative">
        {photo?.image_url ? (
          <img 
            src={photo.image_url} 
            alt={photo.name || 'Photo'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${scenery.color}`}>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.span 
                className="text-7xl opacity-50"
                animate={isAnimating ? { scale: [1, 1.3, 1], rotate: [0, 360] } : {}}
                transition={{ duration: 1 }}
              >
                {scenery.icon}
              </motion.span>
            </div>
          </div>
        )}
      </div>
      
      {/* Info bar at bottom */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-3">
        <p className="text-white font-bold truncate">{photo?.name || 'Photo'}</p>
        <motion.p 
          className="text-yellow-400 font-bold text-lg"
          animate={hasResult && effectiveValue ? { scale: [1, 1.2, 1] } : {}}
        >
          {formatDollarValue(effectiveValue || photo?.dollar_value)}
        </motion.p>
      </div>
      
      {/* Type badge */}
      <div className="absolute top-2 left-2">
        <span className={`px-2 py-0.5 rounded text-xs font-bold bg-gradient-to-r ${scenery.color} text-white`}>
          {scenery.label}
        </span>
      </div>
    </motion.div>
  );
};

// ============== PHOTO BATTLE COMPONENT ==============
const PhotoBattle = ({ playerPhoto, opponentPhoto, result, onBattle }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showClash, setShowClash] = useState(false);
  
  const handleBattle = async () => {
    setIsAnimating(true);
    auctionSounds.paddleRaise();
    
    // Clash animation
    setTimeout(() => {
      setShowClash(true);
      auctionSounds.photoClash();
    }, 800);
    
    await onBattle();
    
    setTimeout(() => {
      setIsAnimating(false);
      setShowClash(false);
    }, 2000);
  };
  
  useEffect(() => {
    if (result) {
      setTimeout(() => {
        if (result.winner === 'player1') {
          auctionSounds.roundWin();
        } else {
          auctionSounds.roundLose();
        }
        auctionSounds.gavelSlam();
      }, 500);
    }
  }, [result]);
  
  return (
    <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700/50 text-center relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 text-8xl">💎</div>
        <div className="absolute bottom-10 right-10 text-8xl">👑</div>
      </div>
      
      <div className="relative z-10">
        <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
          <span className="text-3xl">🖼️</span>
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Photo Dollar Auction Clash
          </span>
          <span className="text-3xl">💰</span>
        </h3>
        <p className="text-gray-400 mb-8">Highest effective value wins the auction!</p>
        
        <div className="flex items-center justify-center gap-8 mb-8">
          <BattlePhotoCard photo={playerPhoto} isPlayer={true} effectiveValue={result?.player1_value} isAnimating={isAnimating} hasResult={!!result} />
          
          <div className="flex flex-col items-center">
            <AnimatePresence>
              {showClash && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: [1, 2, 1], rotate: [0, 180, 360] }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="text-6xl mb-4"
                >
                  💥
                </motion.div>
              )}
            </AnimatePresence>
            
            {!result && !isAnimating && (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  onClick={handleBattle}
                  className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 text-white font-bold px-8 py-4 text-lg shadow-lg"
                  data-testid="battle-button"
                >
                  <Gavel className="w-5 h-5 mr-2" />
                  Start Auction!
                  <span className="ml-2 text-xl">⚔️</span>
                </Button>
              </motion.div>
            )}
            
            {isAnimating && !result && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="text-5xl"
              >
                ⚔️
              </motion.div>
            )}
          </div>
          
          <BattlePhotoCard photo={opponentPhoto} isPlayer={false} effectiveValue={result?.player2_value} isAnimating={isAnimating} hasResult={!!result} />
        </div>
        
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="space-y-4"
            >
              <motion.div 
                className={`text-3xl font-bold ${
                  result.winner === 'player1' ? 'text-green-400' : 'text-red-400'
                }`}
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.5, repeat: 2 }}
              >
                {result.winner === 'player1' ? '🏆 Your Photo Wins! 🎉' : '😢 Opponent Wins!'}
              </motion.div>
              
              <div className="flex justify-center gap-12 text-sm bg-gray-900/50 rounded-xl p-4">
                <div>
                  <p className="text-gray-400 mb-1">Your Value</p>
                  <p className="text-yellow-400 font-bold text-xl">{formatDollarValue(result.player1_value)}</p>
                </div>
                <div className="w-px bg-gray-700" />
                <div>
                  <p className="text-gray-400 mb-1">Opponent Value</p>
                  <p className="text-yellow-400 font-bold text-xl">{formatDollarValue(result.player2_value)}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ============== MATCHMAKING COMPONENT ==============
const Matchmaking = ({ onMatchFound, selectedPhoto, onPhotoSelect, onPracticeStart }) => {
  const [status, setStatus] = useState('photo_select');
  const [betAmount, setBetAmount] = useState(0);
  const [useBotFallback, setUseBotFallback] = useState(true);
  const [practiceMode, setPracticeMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [queueStatus, setQueueStatus] = useState(null);
  const [battlePhotos, setBattlePhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);
  const onMatchFoundRef = useRef(onMatchFound);
  
  // Keep callback ref updated to avoid stale closure
  useEffect(() => {
    onMatchFoundRef.current = onMatchFound;
  }, [onMatchFound]);
  
  useEffect(() => {
    isMountedRef.current = true;
    const fetchData = async () => {
      try {
        setLoadingPhotos(true);
        const [photosRes, queueRes] = await Promise.all([
          api.get('/photo-game/battle-photos'),
          api.get('/photo-game/pvp/queue-status')
        ]);
        if (isMountedRef.current) {
          setBattlePhotos(photosRes.data.photos || []);
          setQueueStatus(queueRes.data);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError('Failed to load your photos');
        }
      } finally {
        if (isMountedRef.current) {
          setLoadingPhotos(false);
        }
      }
    };
    fetchData();
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/photo-game/pvp/queue-status');
        if (isMountedRef.current) {
          setQueueStatus(res.data);
        }
      } catch (err) {
        // Silently ignore queue status polling errors
      }
    }, 5000);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, []);
  
  const startMatchmaking = async () => {
    if (!selectedPhoto) {
      toast.error('Please select a photo first!');
      return;
    }
    
    try {
      setStatus('searching');
      setElapsed(0);
      setError(null);
      auctionSounds.paddleRaise();
      
      const response = await api.post('/photo-game/pvp/find-match', {
        bet_amount: betAmount,
        photo_id: selectedPhoto.mint_id,
        use_bot_fallback: useBotFallback,
      });
      
      if (response.data.status === 'matched' || response.data.status === 'in_match') {
        // Handle both 'matched' (new match) and 'in_match' (existing match)
        setStatus('matched');
        auctionSounds.matchFound();
        onMatchFoundRef.current?.(response.data);
      } else if (response.data.status === 'already_searching') {
        // User is already in queue, start polling
        // Clear any existing interval first
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        
        // Poll for match status every 800ms
        intervalRef.current = setInterval(async () => {
          if (!isMountedRef.current) {
            clearInterval(intervalRef.current);
            return;
          }
          
          try {
            const statusRes = await api.get('/photo-game/pvp/match-status');
            
            if (!isMountedRef.current) return;
            
            setElapsed(statusRes.data.elapsed_seconds || 0);
            auctionSounds.tick();
            
            if (statusRes.data.status === 'matched') {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
              setStatus('matched');
              auctionSounds.matchFound();
              onMatchFoundRef.current?.(statusRes.data);
            } else if (statusRes.data.status === 'not_searching') {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
              setStatus('photo_select');
              toast.error('Matchmaking expired. Please try again.');
            }
          } catch (err) {
            console.error('Match status check failed:', err);
          }
        }, 800);
      } else if (response.data.status === 'searching') {
        // Clear any existing interval first
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        
        // Poll for match status every 800ms (faster than before)
        intervalRef.current = setInterval(async () => {
          if (!isMountedRef.current) {
            clearInterval(intervalRef.current);
            return;
          }
          
          try {
            const statusRes = await api.get('/photo-game/pvp/match-status');
            
            if (!isMountedRef.current) return;
            
            setElapsed(statusRes.data.elapsed_seconds || 0);
            auctionSounds.tick();
            
            if (statusRes.data.status === 'matched') {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
              setStatus('matched');
              auctionSounds.matchFound();
              onMatchFoundRef.current?.(statusRes.data);
            } else if (statusRes.data.status === 'not_searching' || statusRes.data.status === 'not_in_queue') {
              // User is no longer in queue (timeout or error)
              clearInterval(intervalRef.current);
              intervalRef.current = null;
              setStatus('photo_select');
              toast.error('Matchmaking expired. Please try again.');
            }
          } catch (err) {
            console.error('Match status check failed:', err);
          }
        }, 800);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start matchmaking');
      setStatus('photo_select');
      setError(err.response?.data?.detail);
    }
  };
  
  const cancelMatchmaking = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try {
      const res = await api.post('/photo-game/pvp/cancel');
      if (res.data.bet_refunded) {
        toast.success(`Bet refunded: ${res.data.bet_refunded} BL`);
      }
    } catch (err) {
      // Ignore cancel errors
    }
    setStatus('photo_select');
  };
  
  // Start Practice Mode - instant bot battle, no BL bet, no stamina loss
  const startPracticeMode = async () => {
    if (!selectedPhoto) {
      toast.error('Please select a photo first!');
      return;
    }
    
    try {
      setError(null);
      auctionSounds.paddleRaise();
      
      // Start game directly with practice_mode=true
      const response = await api.post('/photo-game/start', {
        opponent_id: 'bot',
        bet_amount: 0,
        photo_id: selectedPhoto.mint_id,
        practice_mode: true,
      });
      
      if (response.data.success) {
        auctionSounds.matchFound();
        onPracticeStart?.(response.data);
      } else {
        setError(response.data.error || 'Failed to start practice');
        toast.error(response.data.error || 'Failed to start practice');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to start practice mode';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };
  
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
  
  if (status === 'searching') {
    return (
      <div className="text-center py-12">
        <motion.div
          className="w-32 h-32 mx-auto mb-6 rounded-full bg-purple-600/20 flex items-center justify-center border-4 border-purple-500/50"
          animate={{ 
            scale: [1, 1.1, 1],
            borderColor: ['rgba(168, 85, 247, 0.5)', 'rgba(168, 85, 247, 1)', 'rgba(168, 85, 247, 0.5)']
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <motion.span
            className="text-5xl"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            🔍
          </motion.span>
        </motion.div>
        
        <h3 className="text-2xl font-bold text-white mb-2">Searching for Opponent...</h3>
        <p className="text-gray-400 mb-2">{Math.round(elapsed)}s / 5s</p>
        
        {selectedPhoto && (
          <p className="text-purple-400 mb-4 font-semibold">
            ⚔️ Fighting with: {selectedPhoto.name}
          </p>
        )}
        
        <div className="w-64 mx-auto h-3 bg-gray-700 rounded-full overflow-hidden mb-6">
          <motion.div 
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
            animate={{ width: `${(elapsed / 5) * 100}%` }}
          />
        </div>
        
        <Button variant="outline" onClick={cancelMatchmaking} className="border-gray-600">
          <X className="w-4 h-4 mr-2" /> Cancel
        </Button>
      </div>
    );
  }
  
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50">
        <PhotoSelectionScreen 
          photos={battlePhotos}
          loading={loadingPhotos}
          onSelectPhoto={onPhotoSelect}
          selectedPhotoId={selectedPhoto?.mint_id}
        />
      </div>
      
      {selectedPhoto && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50"
        >
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-400" />
            Battle Settings
          </h3>
          
          {queueStatus && (
            <div className="bg-gray-700/50 rounded-lg p-3 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Players searching:</span>
                <span className="text-white font-bold">{queueStatus.players_waiting}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Active matches:</span>
                <span className="text-white font-bold">{queueStatus.active_matches}</span>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">BL Coin Bet (optional)</label>
              <Input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="bg-gray-700 border-gray-600"
                data-testid="bet-amount-input"
              />
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-gray-300">Play with bot if no players</span>
              <button
                onClick={() => setUseBotFallback(!useBotFallback)}
                className={`relative w-12 h-6 rounded-full transition-colors ${useBotFallback ? 'bg-purple-600' : 'bg-gray-700'}`}
                disabled={practiceMode}
              >
                <motion.span 
                  className="absolute top-1 w-4 h-4 rounded-full bg-white"
                  animate={{ left: useBotFallback ? 28 : 4 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </div>
          
          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        </motion.div>
      )}
      
      {selectedPhoto && (
        <div className="space-y-3">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              onClick={startMatchmaking} 
              className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 py-6 text-lg font-bold shadow-lg"
              size="lg"
              data-testid="find-match-btn"
            >
              <Swords className="w-6 h-6 mr-2" />
              Find Match with {selectedPhoto.name}
              <span className="ml-2 text-2xl">⚔️</span>
            </Button>
          </motion.div>
          
          <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
            <Button 
              onClick={startPracticeMode}
              variant="outline"
              className="w-full border-2 border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 py-4"
              size="lg"
              data-testid="practice-mode-btn"
            >
              <Target className="w-5 h-5 mr-2" />
              Practice vs Bot (No Risk)
              <span className="ml-2 text-lg">🎯</span>
            </Button>
          </motion.div>
          
          <p className="text-center text-xs text-gray-500">
            Practice mode: No BL bet, no stamina loss, no rewards - just practice!
          </p>
        </div>
      )}
    </div>
  );
};

// ============== MAIN BATTLE ARENA COMPONENT ==============
const PhotoGameArena = () => {
  const { user } = useContext(AuthContext);
  const [gameState, setGameState] = useState('matchmaking');
  const [session, setSession] = useState(null);
  const [stats, setStats] = useState(null);
  const [matchData, setMatchData] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lightboxPhoto, setLightboxPhoto] = useState(null); // For viewing full images
  
  // RPS Auction state
  const [playerBankroll, setPlayerBankroll] = useState(STARTING_BANKROLL);
  const [opponentBankroll, setOpponentBankroll] = useState(STARTING_BANKROLL);
  const [rpsWins, setRpsWins] = useState({ player: 0, opponent: 0 });
  const [lastRound, setLastRound] = useState(null);
  
  // Photo battle state
  const [photoBattleResult, setPhotoBattleResult] = useState(null);
  
  useEffect(() => {
    auctionSounds.init();
    auctionSounds.setEnabled(soundEnabled);
  }, [soundEnabled]);
  
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/photo-game/stats');
        setStats(response.data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);
  
  const handleSoundToggle = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    auctionSounds.setEnabled(newValue);
    if (newValue) {
      auctionSounds.selectionConfirm();
    }
  };
  
  // Handle practice mode start (direct bot battle, no matchmaking)
  const handlePracticeStart = (gameData) => {
    if (gameData.success) {
      setSession(gameData.session);
      setPlayerBankroll(gameData.session?.player1_bankroll || STARTING_BANKROLL);
      setOpponentBankroll(gameData.session?.player2_bankroll || STARTING_BANKROLL);
      setRpsWins({ player: 0, opponent: 0 });
      setGameState('rps_auction');
      auctionSounds.gavelSlam();
      toast.success('🎯 Practice mode started! No risk, just fun.');
    }
  };
  
  const handleMatchFound = async (matchInfo) => {
    setMatchData(matchInfo);
    
    try {
      const response = await api.post(`/photo-game/pvp/match/${matchInfo.match_id}/start`);
      
      if (response.data.success) {
        setSession(response.data.session);
        setPlayerBankroll(response.data.session?.player1_bankroll || STARTING_BANKROLL);
        setOpponentBankroll(response.data.session?.player2_bankroll || STARTING_BANKROLL);
        setRpsWins({ player: 0, opponent: 0 });
        setGameState('rps_auction');
        auctionSounds.gavelSlam();
        toast.success(matchInfo.mode === 'bot' ? '🤖 Bot match started!' : '⚔️ Match found!');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start game');
      setGameState('matchmaking');
    }
  };
  
  const handleRPSAuctionMove = async (choice, bidAmount) => {
    if (!session) return;
    
    try {
      const response = await api.post(`/photo-game/session/${session.session_id}/rps-auction`, {
        choice,
        bid_amount: bidAmount,
      });
      
      const { round, player1_wins, player2_wins, player1_bankroll, player2_bankroll, phase } = response.data;
      
      setLastRound(round);
      setRpsWins({ player: player1_wins, opponent: player2_wins });
      setPlayerBankroll(player1_bankroll);
      setOpponentBankroll(player2_bankroll);
      
      setTimeout(() => {
        setLastRound(null);
        
        if (phase === 'photo_battle') {
          setGameState('photo_battle');
          setRpsWins({ player: 0, opponent: 0 });
        } else if (phase === 'tiebreaker') {
          setGameState('tiebreaker');
          setPlayerBankroll(STARTING_BANKROLL);
          setOpponentBankroll(STARTING_BANKROLL);
          setRpsWins({ player: 0, opponent: 0 });
          auctionSounds.gavelSlam();
        } else if (phase === 'completed') {
          setGameState('result');
          setSession(response.data.session);
          if (response.data.session?.winner_id === user?.user_id) {
            auctionSounds.battleVictory();
          } else {
            auctionSounds.battleDefeat();
          }
        }
      }, 2500);
      
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit move');
    }
  };
  
  const handlePhotoBattle = async () => {
    if (!session) return;
    
    try {
      const response = await api.post(`/photo-game/session/${session.session_id}/photo-battle`);
      
      setPhotoBattleResult(response.data.battle_result);
      
      setTimeout(() => {
        if (response.data.phase === 'tiebreaker') {
          setGameState('tiebreaker');
          setPlayerBankroll(STARTING_BANKROLL);
          setOpponentBankroll(STARTING_BANKROLL);
          setPhotoBattleResult(null);
          auctionSounds.gavelSlam();
        } else if (response.data.phase === 'completed') {
          setGameState('result');
          setSession(response.data.session);
          if (response.data.session?.winner_id === user?.user_id) {
            auctionSounds.battleVictory();
          } else {
            auctionSounds.battleDefeat();
          }
        }
      }, 3000);
      
    } catch (err) {
      toast.error('Failed to execute battle');
    }
  };
  
  const handlePlayAgain = () => {
    setGameState('matchmaking');
    setSession(null);
    setMatchData(null);
    setSelectedPhoto(null);
    setRpsWins({ player: 0, opponent: 0 });
    setLastRound(null);
    setPhotoBattleResult(null);
    setPlayerBankroll(STARTING_BANKROLL);
    setOpponentBankroll(STARTING_BANKROLL);
    api.get('/photo-game/stats').then(res => setStats(res.data)).catch(() => {});
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 pb-24" data-testid="photo-game-arena">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/50 via-pink-900/30 to-orange-900/50 border-b border-gray-700/50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <motion.span animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                  🔨
                </motion.span>
                <span className="bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                  Dollar Auction Arena
                </span>
              </h1>
              <p className="text-gray-400 mt-1 flex items-center gap-1">
                <span>💰</span> Million Dollar RPS + Photo Battles <span>💎</span>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <SoundToggle enabled={soundEnabled} onToggle={handleSoundToggle} />
              {stats && <WinStreakBadge streak={stats.current_win_streak} />}
            </div>
          </div>
          
          {stats && (
            <div className="mt-4 grid grid-cols-4 gap-4">
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">{stats.battles_won}</p>
                <p className="text-xs text-gray-400">Wins</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-white">{stats.battles_lost}</p>
                <p className="text-xs text-gray-400">Losses</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-400">{stats.total_bl_won}</p>
                <p className="text-xs text-gray-400">BL Won</p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-3">
                <StaminaBar stamina={stats.stamina} />
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Main content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {gameState === 'matchmaking' && (
            <motion.div key="matchmaking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Matchmaking 
                onMatchFound={handleMatchFound}
                selectedPhoto={selectedPhoto}
                onPhotoSelect={setSelectedPhoto}
                onPracticeStart={handlePracticeStart}
              />
            </motion.div>
          )}
          
          {(gameState === 'rps_auction' || gameState === 'tiebreaker') && session && (
            <motion.div key="rps_auction" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <RPSAuctionBattle
                session={session}
                onMove={handleRPSAuctionMove}
                playerBankroll={playerBankroll}
                opponentBankroll={opponentBankroll}
                playerWins={rpsWins.player}
                opponentWins={rpsWins.opponent}
                lastRound={lastRound}
                isTiebreaker={gameState === 'tiebreaker'}
              />
            </motion.div>
          )}
          
          {gameState === 'photo_battle' && session && (
            <motion.div key="photo_battle" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <PhotoBattle
                playerPhoto={session?.player1_photo}
                opponentPhoto={session?.player2_photo}
                result={photoBattleResult}
                onBattle={handlePhotoBattle}
              />
            </motion.div>
          )}
          
          {gameState === 'result' && session && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-b from-gray-800/50 to-gray-900/50 rounded-2xl p-8 border border-gray-700/50 text-center relative overflow-hidden"
            >
              {/* Confetti effect for win */}
              {session.winner_id === user?.user_id && (
                <div className="absolute inset-0 pointer-events-none">
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute text-2xl"
                      initial={{ 
                        top: -20, 
                        left: `${Math.random() * 100}%`,
                        rotate: 0
                      }}
                      animate={{ 
                        top: '110%',
                        rotate: 360,
                      }}
                      transition={{ 
                        duration: 2 + Math.random() * 2,
                        delay: Math.random() * 0.5,
                        repeat: 3
                      }}
                    >
                      {['🎉', '✨', '💰', '🏆', '💎'][Math.floor(Math.random() * 5)]}
                    </motion.div>
                  ))}
                </div>
              )}
              
              <div className="relative z-10">
                {session.winner_id === user?.user_id ? (
                  <>
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 0.5, repeat: 5 }}
                      className="text-8xl mb-4"
                    >
                      🏆
                    </motion.div>
                    <h2 className="text-4xl font-bold text-green-400 mb-4">Victory!</h2>
                    {session.bet_amount > 0 && (
                      <motion.p 
                        className="text-yellow-400 text-2xl mb-6"
                        animate={{ scale: [1, 1.2, 1] }}
                      >
                        +{session.bet_amount * 2} BL Coins 💰
                      </motion.p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-8xl mb-4">😢</div>
                    <h2 className="text-4xl font-bold text-red-400 mb-4">Defeat</h2>
                    {session.bet_amount > 0 && (
                      <p className="text-gray-400 text-2xl mb-6">-{session.bet_amount} BL Coins</p>
                    )}
                  </>
                )}
                
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={handlePlayAgain}
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
          )}
        </AnimatePresence>
      </div>
      
      {/* Photo Lightbox for viewing full images */}
      <PhotoLightbox
        photo={lightboxPhoto}
        isOpen={!!lightboxPhoto}
        onClose={() => setLightboxPhoto(null)}
      />
    </div>
  );
};

export default PhotoGameArena;
