import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Swords, Trophy, Zap, Users, Bot, Clock, 
  Hand, Scissors, FileText, Sparkles, Crown,
  Shield, Target, TrendingUp, Coins, RefreshCw,
  X, Check, AlertCircle, Loader2, Image, ChevronRight,
  DollarSign, Gavel, Banknote
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import { AuthContext } from '../App';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Slider } from '../components/ui/slider';

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

const LIGHT_CONFIG = {
  sunlight_fire: { icon: '☀️', label: 'Sunlight/Fire', strong: 'darkness_night', weak: 'rain_snow_ice' },
  rain_snow_ice: { icon: '❄️', label: 'Rain/Snow/Ice', strong: 'sunlight_fire', weak: 'darkness_night' },
  darkness_night: { icon: '🌙', label: 'Night/Interior', strong: 'rain_snow_ice', weak: 'sunlight_fire' },
};

// Million Dollar RPS Constants
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

// ============== HELPER COMPONENTS ==============
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
        />
      </div>
      {showLabel && <span className="text-sm text-gray-400">{Math.round(stamina)}/{maxStamina}</span>}
    </div>
  );
};

const BankrollDisplay = ({ bankroll, isPlayer }) => {
  return (
    <motion.div 
      className={`flex items-center gap-2 px-4 py-2 rounded-lg ${isPlayer ? 'bg-purple-900/50' : 'bg-red-900/50'}`}
      animate={{ scale: [1, 1.02, 1] }}
      transition={{ duration: 0.3 }}
    >
      <Banknote className={`w-5 h-5 ${isPlayer ? 'text-purple-400' : 'text-red-400'}`} />
      <span className={`font-bold ${isPlayer ? 'text-purple-300' : 'text-red-300'}`}>
        {formatBankroll(bankroll)}
      </span>
    </motion.div>
  );
};

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

// ============== PHOTO SELECTION COMPONENT ==============
const PhotoSelectionScreen = ({ photos, loading, onSelectPhoto, selectedPhotoId }) => {
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

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-bold text-white mb-2">Select Your Battle Photo</h3>
        <p className="text-gray-400">
          Sorted by Dollar Value (Power). 
          <span className="text-yellow-400 ml-1">Higher value = stronger!</span>
        </p>
      </div>

      {/* Available Photos */}
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
                  onClick={() => onSelectPhoto(photo)}
                  className={`relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected 
                      ? 'bg-purple-900/50 border-purple-500 ring-2 ring-purple-400' 
                      : 'bg-gray-800/50 border-gray-700/50 hover:border-purple-500/50'
                  }`}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  data-testid={`photo-select-${photo.mint_id}`}
                >
                  {/* Thumbnail */}
                  <div className={`w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br ${scenery.color} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-2xl">{scenery.icon}</span>
                  </div>
                  
                  {/* Photo Info */}
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
                    
                    {/* Stamina Bar */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 max-w-32">
                        <StaminaBar stamina={photo.stamina} showLabel={false} />
                      </div>
                      <span className="text-xs text-gray-400">
                        {Math.round(photo.stamina)}% ({photo.battles_remaining} battles)
                      </span>
                    </div>
                  </div>
                  
                  {/* Selection indicator */}
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-600'
                  }`}>
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Unavailable Photos (Grayed Out) */}
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
                  <div className={`w-16 h-16 rounded-lg overflow-hidden bg-gradient-to-br ${scenery.color} flex items-center justify-center flex-shrink-0 grayscale`}>
                    <span className="text-2xl">{scenery.icon}</span>
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

  useEffect(() => {
    if (lastRound) {
      setShowResult(true);
      const timer = setTimeout(() => {
        setShowResult(false);
        setSelectedChoice(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [lastRound]);

  const handleSubmit = async () => {
    if (!selectedChoice || isSubmitting) return;
    setIsSubmitting(true);
    
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
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50">
      {/* Header */}
      <div className="text-center mb-6">
        {isTiebreaker && (
          <div className="inline-flex items-center gap-2 bg-yellow-500/20 text-yellow-400 px-4 py-2 rounded-full text-sm font-bold mb-4">
            <Gavel className="w-4 h-4" />
            TIEBREAKER ROUND
          </div>
        )}
        <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
          <DollarSign className="w-6 h-6 text-yellow-400" />
          Million Dollar RPS Auction
        </h3>
        <p className="text-gray-400">Choose RPS + Bid Amount. First to 3 wins!</p>
      </div>

      {/* Bankrolls Display */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-center">
          <p className="text-sm text-gray-400 mb-1">Your Bankroll</p>
          <BankrollDisplay bankroll={playerBankroll} isPlayer={true} />
        </div>
        
        {/* Score */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <span className="text-3xl font-bold text-purple-400">{playerWins}</span>
          </div>
          <span className="text-gray-500 text-xl">-</span>
          <div className="text-center">
            <span className="text-3xl font-bold text-red-400">{opponentWins}</span>
          </div>
        </div>
        
        <div className="text-center">
          <p className="text-sm text-gray-400 mb-1">Opponent</p>
          <BankrollDisplay bankroll={opponentBankroll} isPlayer={false} />
        </div>
      </div>

      {/* Last Round Result */}
      <AnimatePresence>
        {showResult && lastRound && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="mb-6 p-4 bg-gray-900/50 rounded-xl"
          >
            <div className="flex items-center justify-center gap-8 mb-3">
              <div className="text-center">
                <p className="text-xs text-gray-400">You</p>
                <span className="text-4xl">{RPS_CHOICES.find(c => c.id === lastRound.player1_choice)?.icon}</span>
                <p className="text-yellow-400 font-bold">{formatBankroll(lastRound.player1_bid)}</p>
              </div>
              <div className="text-2xl font-bold text-gray-400">VS</div>
              <div className="text-center">
                <p className="text-xs text-gray-400">Opponent</p>
                <span className="text-4xl">{RPS_CHOICES.find(c => c.id === lastRound.player2_choice)?.icon}</span>
                <p className="text-yellow-400 font-bold">{formatBankroll(lastRound.player2_bid)}</p>
              </div>
            </div>
            <div className={`text-center font-bold text-lg ${
              lastRound.winner === 'player1' ? 'text-green-400' : 
              lastRound.winner === 'player2' ? 'text-red-400' : 'text-yellow-400'
            }`}>
              {lastRound.winner === 'player1' ? `🎉 You won ${formatBankroll(lastRound.total_pot)}!` : 
               lastRound.winner === 'player2' ? `😢 Lost ${formatBankroll(lastRound.total_pot)}` : '🤝 Tie!'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RPS Choice */}
      {!showResult && (
        <>
          <div className="mb-6">
            <p className="text-sm text-gray-400 mb-3 text-center">Choose your move:</p>
            <div className="flex justify-center gap-4">
              {RPS_CHOICES.map((choice) => (
                <motion.button
                  key={choice.id}
                  onClick={() => setSelectedChoice(choice.id)}
                  className={`w-24 h-24 rounded-2xl flex flex-col items-center justify-center transition-all ${
                    selectedChoice === choice.id 
                      ? 'bg-purple-600 ring-4 ring-purple-400' 
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  data-testid={`rps-choice-${choice.id}`}
                >
                  <span className="text-4xl mb-1">{choice.icon}</span>
                  <span className="text-xs text-gray-300">{choice.label}</span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Bid Amount */}
          <div className="mb-6">
            <p className="text-sm text-gray-400 mb-3 text-center">Set your bid:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {bidOptions.map((bid) => (
                <motion.button
                  key={bid}
                  onClick={() => setBidAmount(bid)}
                  className={`px-4 py-2 rounded-lg font-bold transition-all ${
                    bidAmount === bid 
                      ? 'bg-yellow-500 text-black' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  data-testid={`bid-${bid}`}
                >
                  {formatBankroll(bid)}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!selectedChoice || isSubmitting || playerBankroll < MIN_BID}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold"
            size="lg"
            data-testid="submit-rps-auction"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : playerBankroll < MIN_BID ? (
              'Bankrupt! 😢'
            ) : (
              <>
                <Gavel className="w-5 h-5 mr-2" />
                Place Bid: {selectedChoice?.toUpperCase()} + {formatBankroll(bidAmount)}
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
};

// ============== PHOTO BATTLE COMPONENT ==============
const PhotoBattle = ({ playerPhoto, opponentPhoto, result, onBattle }) => {
  const [isAnimating, setIsAnimating] = useState(false);
  
  const handleBattle = async () => {
    setIsAnimating(true);
    await onBattle();
    setTimeout(() => setIsAnimating(false), 2000);
  };
  
  const PhotoCard = ({ photo, isPlayer, effectiveValue }) => {
    const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
    
    return (
      <motion.div
        className={`relative w-48 rounded-xl overflow-hidden border-4 ${
          isPlayer ? 'border-purple-500' : 'border-red-500'
        }`}
        animate={isAnimating ? { x: isPlayer ? [0, 50, 0] : [0, -50, 0], scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.5, repeat: isAnimating ? Infinity : 0 }}
      >
        <div className={`aspect-square bg-gradient-to-br ${scenery.color}`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl opacity-50">{scenery.icon}</span>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 p-2">
          <p className="text-white font-bold text-sm truncate">{photo?.name || 'Photo'}</p>
          <p className="text-yellow-400 font-bold">{formatDollarValue(photo?.dollar_value)}</p>
          {effectiveValue && effectiveValue !== photo?.dollar_value && (
            <p className="text-green-400 text-xs">Effective: {formatDollarValue(effectiveValue)}</p>
          )}
        </div>
        
        <div className="absolute top-2 left-2">
          <span className={`px-2 py-0.5 rounded text-xs font-bold bg-gradient-to-r ${scenery.color} text-white`}>
            {scenery.label}
          </span>
        </div>
      </motion.div>
    );
  };
  
  return (
    <div className="bg-gray-800/50 rounded-2xl p-6 border border-gray-700/50 text-center">
      <h3 className="text-2xl font-bold text-white mb-2 flex items-center justify-center gap-2">
        <DollarSign className="w-6 h-6 text-yellow-400" />
        Photo Dollar Auction Clash
      </h3>
      <p className="text-gray-400 mb-6">Highest effective value wins!</p>
      
      <div className="flex items-center justify-center gap-8 mb-8">
        <PhotoCard photo={playerPhoto} isPlayer={true} effectiveValue={result?.player1_value} />
        
        <div className="flex flex-col items-center">
          <motion.div
            className="text-4xl font-bold text-white mb-4"
            animate={isAnimating ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.5, repeat: isAnimating ? Infinity : 0 }}
          >
            ⚔️
          </motion.div>
          
          {!result && !isAnimating && (
            <Button 
              onClick={handleBattle}
              className="bg-gradient-to-r from-purple-600 to-pink-600"
              data-testid="battle-button"
            >
              <Gavel className="w-4 h-4 mr-2" />
              Start Auction!
            </Button>
          )}
        </div>
        
        <PhotoCard photo={opponentPhoto} isPlayer={false} effectiveValue={result?.player2_value} />
      </div>
      
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className={`text-2xl font-bold ${
              result.winner === 'player1' ? 'text-green-400' : 'text-red-400'
            }`}>
              {result.winner === 'player1' ? '🏆 Your Photo Wins!' : '😢 Opponent Wins!'}
            </div>
            
            <div className="flex justify-center gap-8 text-sm">
              <div>
                <p className="text-gray-400">Your Value</p>
                <p className="text-yellow-400 font-bold">{formatDollarValue(result.player1_value)}</p>
              </div>
              <div>
                <p className="text-gray-400">Opponent Value</p>
                <p className="text-yellow-400 font-bold">{formatDollarValue(result.player2_value)}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============== MATCHMAKING COMPONENT ==============
const Matchmaking = ({ onMatchFound, selectedPhoto, onPhotoSelect }) => {
  const [status, setStatus] = useState('photo_select');
  const [betAmount, setBetAmount] = useState(0);
  const [useBotFallback, setUseBotFallback] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [queueStatus, setQueueStatus] = useState(null);
  const [battlePhotos, setBattlePhotos] = useState([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingPhotos(true);
        const [photosRes, queueRes] = await Promise.all([
          api.get('/photo-game/battle-photos'),
          api.get('/photo-game/pvp/queue-status')
        ]);
        setBattlePhotos(photosRes.data.photos || []);
        setQueueStatus(queueRes.data);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load your photos');
      } finally {
        setLoadingPhotos(false);
      }
    };
    
    fetchData();
    const interval = setInterval(async () => {
      try {
        const res = await api.get('/photo-game/pvp/queue-status');
        setQueueStatus(res.data);
      } catch (err) {}
    }, 5000);
    
    return () => clearInterval(interval);
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
      
      const response = await api.post('/photo-game/pvp/find-match', {
        bet_amount: betAmount,
        photo_id: selectedPhoto.mint_id,
        use_bot_fallback: useBotFallback,
      });
      
      if (response.data.status === 'matched') {
        setStatus('matched');
        onMatchFound?.(response.data);
      } else if (response.data.status === 'searching') {
        intervalRef.current = setInterval(async () => {
          try {
            const statusRes = await api.get('/photo-game/pvp/match-status');
            setElapsed(statusRes.data.elapsed_seconds || 0);
            
            if (statusRes.data.status === 'matched') {
              clearInterval(intervalRef.current);
              setStatus('matched');
              onMatchFound?.(statusRes.data);
            }
          } catch (err) {}
        }, 2000);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to start matchmaking');
      setStatus('photo_select');
      setError(err.response?.data?.detail);
    }
  };
  
  const cancelMatchmaking = async () => {
    clearInterval(intervalRef.current);
    try {
      const res = await api.post('/photo-game/pvp/cancel');
      if (res.data.bet_refunded) {
        toast.success(`Bet refunded: ${res.data.bet_refunded} BL`);
      }
    } catch (err) {}
    setStatus('photo_select');
  };
  
  useEffect(() => () => clearInterval(intervalRef.current), []);
  
  if (status === 'searching') {
    return (
      <div className="text-center py-12">
        <motion.div
          className="w-24 h-24 mx-auto mb-6 rounded-full bg-purple-600/20 flex items-center justify-center"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Users className="w-12 h-12 text-purple-400" />
        </motion.div>
        
        <h3 className="text-xl font-bold text-white mb-2">Searching for Opponent...</h3>
        <p className="text-gray-400 mb-4">{Math.round(elapsed)}s / 30s</p>
        
        {selectedPhoto && (
          <p className="text-purple-400 mb-4">
            Fighting with: <span className="font-bold">{selectedPhoto.name}</span>
          </p>
        )}
        
        <div className="w-48 mx-auto h-2 bg-gray-700 rounded-full overflow-hidden mb-6">
          <motion.div className="h-full bg-purple-500" animate={{ width: `${(elapsed / 30) * 100}%` }} />
        </div>
        
        <Button variant="outline" onClick={cancelMatchmaking}>
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
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${useBotFallback ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
          </div>
          
          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        </motion.div>
      )}
      
      {selectedPhoto && (
        <Button 
          onClick={startMatchmaking} 
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
          size="lg"
          data-testid="find-match-btn"
        >
          <Swords className="w-5 h-5 mr-2" />
          Find Match with {selectedPhoto.name}
        </Button>
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
  
  // RPS Auction state
  const [playerBankroll, setPlayerBankroll] = useState(STARTING_BANKROLL);
  const [opponentBankroll, setOpponentBankroll] = useState(STARTING_BANKROLL);
  const [rpsWins, setRpsWins] = useState({ player: 0, opponent: 0 });
  const [lastRound, setLastRound] = useState(null);
  
  // Photo battle state
  const [photoBattleResult, setPhotoBattleResult] = useState(null);
  
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
        toast.success(matchInfo.mode === 'bot' ? 'Bot match started!' : 'Match found!');
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
        if (phase === 'photo_battle') {
          setGameState('photo_battle');
          setRpsWins({ player: 0, opponent: 0 });
          setLastRound(null);
        } else if (phase === 'tiebreaker') {
          setGameState('tiebreaker');
          setPlayerBankroll(STARTING_BANKROLL);
          setOpponentBankroll(STARTING_BANKROLL);
          setRpsWins({ player: 0, opponent: 0 });
          setLastRound(null);
        } else if (phase === 'completed') {
          setGameState('result');
          setSession(response.data.session);
        }
      }, 2000);
      
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
        } else if (response.data.phase === 'completed') {
          setGameState('result');
          setSession(response.data.session);
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
    
    // Refresh stats
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
      <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-b border-gray-700/50">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Gavel className="w-6 h-6 text-yellow-400" />
                Dollar Auction Arena
              </h1>
              <p className="text-gray-400 mt-1">Million Dollar RPS + Photo Battles</p>
            </div>
            {stats && <WinStreakBadge streak={stats.current_win_streak} />}
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
              />
            </motion.div>
          )}
          
          {(gameState === 'rps_auction' || gameState === 'tiebreaker') && session && (
            <motion.div key="rps_auction" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
            <motion.div key="photo_battle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
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
              className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700/50 text-center"
            >
              {session.winner_id === user?.user_id ? (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 0.5, repeat: 3 }}
                    className="text-6xl mb-4"
                  >
                    🏆
                  </motion.div>
                  <h2 className="text-3xl font-bold text-green-400 mb-2">Victory!</h2>
                  {session.bet_amount > 0 && (
                    <p className="text-yellow-400 text-xl mb-4">+{session.bet_amount * 2} BL Coins</p>
                  )}
                </>
              ) : (
                <>
                  <div className="text-6xl mb-4">😢</div>
                  <h2 className="text-3xl font-bold text-red-400 mb-2">Defeat</h2>
                  {session.bet_amount > 0 && (
                    <p className="text-gray-400 text-xl mb-4">-{session.bet_amount} BL Coins</p>
                  )}
                </>
              )}
              
              <Button
                onClick={handlePlayAgain}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
                size="lg"
                data-testid="play-again-btn"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                Play Again
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PhotoGameArena;
