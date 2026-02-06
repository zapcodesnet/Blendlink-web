/**
 * PhotoSelector Component
 * 
 * Mandatory 5-photo selection with stamina validation.
 * - Gray out photos with stamina = 0
 * - Show warning when selecting low-stamina photos
 * - Display stamina bar and stats on each photo
 * - Lock in exactly 5 photos before creating/joining
 * - Integrated "Create Game" flow with bet input
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, X, AlertTriangle, Zap, Battery, 
  ChevronRight, Loader2, RefreshCw, Filter,
  Trophy, Shield, Flame, Star, Info, Coins, Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import api from '../../services/api';
import UnifiedPhotoCard from '../photo/UnifiedPhotoCard';

// Constants
const REQUIRED_PHOTOS = 5;
const MAX_STAMINA = 24;

// Format dollar value
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
};

// Scenery config
const SCENERY_CONFIG = {
  natural: { name: 'Natural', color: 'from-green-500 to-emerald-600', icon: '🌿' },
  water: { name: 'Water', color: 'from-blue-500 to-cyan-600', icon: '🌊' },
  manmade: { name: 'Man-made', color: 'from-orange-500 to-red-600', icon: '🏙️' },
  neutral: { name: 'Neutral', color: 'from-gray-500 to-gray-600', icon: '⬜' },
};

// Photo Card with stamina display
const SelectablePhotoCard = ({ photo, selected, disabled, onSelect }) => {
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  const currentStamina = photo?.current_stamina ?? MAX_STAMINA;
  const staminaPercent = (currentStamina / MAX_STAMINA) * 100;
  const isLowStamina = currentStamina < 5;
  const hasNoStamina = currentStamina < 1;
  
  return (
    <motion.button
      onClick={() => !disabled && !hasNoStamina && onSelect(photo)}
      disabled={disabled || hasNoStamina}
      className={`relative rounded-xl overflow-hidden transition-all ${
        hasNoStamina 
          ? 'opacity-40 grayscale cursor-not-allowed'
          : selected
            ? 'ring-4 ring-purple-500 ring-offset-2 ring-offset-gray-900 scale-[1.02]'
            : 'hover:scale-[1.02] cursor-pointer'
      }`}
      whileHover={!disabled && !hasNoStamina ? { y: -4 } : {}}
      whileTap={!disabled && !hasNoStamina ? { scale: 0.98 } : {}}
      data-testid={`selectable-photo-${photo?.mint_id}`}
    >
      {/* Photo image */}
      <div className="aspect-[3/4] bg-gray-800">
        {photo?.image_url ? (
          <img 
            src={photo.image_url} 
            alt={photo.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
            <span className="text-4xl opacity-60">{scenery.icon}</span>
          </div>
        )}
        
        {/* Selection overlay */}
        {selected && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-purple-500/30 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center shadow-lg"
            >
              <Check className="w-6 h-6 text-white" />
            </motion.div>
          </motion.div>
        )}
        
        {/* No stamina overlay */}
        {hasNoStamina && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center">
            <Battery className="w-10 h-10 text-red-400 mb-2" />
            <p className="text-red-400 font-bold text-sm">No Stamina</p>
            <p className="text-gray-400 text-xs">Regenerating...</p>
          </div>
        )}
        
        {/* Dollar value badge */}
        <div className="absolute top-2 left-2">
          <span className="px-2 py-1 bg-black/70 rounded text-yellow-400 font-bold text-sm">
            {formatDollarValue(photo?.dollar_value)}
          </span>
        </div>
        
        {/* Scenery badge */}
        <div className="absolute top-2 right-2">
          <span className={`px-2 py-0.5 rounded text-xs font-bold bg-gradient-to-r ${scenery.color} text-white`}>
            {scenery.icon}
          </span>
        </div>
        
        {/* Streaks */}
        {(photo?.win_streak >= 3 || photo?.lose_streak >= 3) && (
          <div className="absolute top-10 right-2 flex flex-col gap-1">
            {photo?.win_streak >= 3 && (
              <span className="px-1.5 py-0.5 bg-orange-500/90 rounded text-[10px] text-white font-bold">
                🔥{photo.win_streak}
              </span>
            )}
            {photo?.lose_streak >= 3 && (
              <span className="px-1.5 py-0.5 bg-blue-500/90 rounded text-[10px] text-white">
                🛡️
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Info bar with stamina */}
      <div className="p-2 bg-gray-900">
        {/* Name with Medal */}
        <div className="flex items-center gap-1">
          <p className="text-white font-medium text-sm truncate">{photo?.name || 'Photo'}</p>
          {/* Medal Display */}
          {(photo?.medals?.ten_win_streak > 0) && (
            <span 
              className="flex items-center text-yellow-400 text-[10px] font-bold shrink-0"
              title={`${photo.medals.ten_win_streak} x 10-Win Streak Medal(s)`}
            >
              🏅x{photo.medals.ten_win_streak}
            </span>
          )}
        </div>
        
        {/* Stamina bar */}
        <div className="mt-2">
          <div className="flex justify-between items-center text-[10px] mb-1">
            <span className={`font-bold ${isLowStamina ? 'text-red-400' : 'text-gray-400'}`}>
              Stamina
            </span>
            <span className={`font-bold ${isLowStamina ? 'text-red-400' : 'text-green-400'}`}>
              {currentStamina}/{MAX_STAMINA}
            </span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
            <motion.div 
              className={`h-full rounded-full ${
                staminaPercent > 50 ? 'bg-green-500' :
                staminaPercent > 20 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${staminaPercent}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
        
        {/* Level badge */}
        {photo?.level > 1 && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[10px] text-purple-400 font-bold">Lv.{photo.level}</span>
            {photo?.level >= 10 && (
              <span className="text-yellow-400 text-[10px]">
                {'⭐'.repeat(Math.min(Math.floor(photo.level / 10), 5))}
              </span>
            )}
          </div>
        )}
      </div>
      
      {/* Low stamina warning */}
      {isLowStamina && !hasNoStamina && (
        <div className="absolute bottom-16 left-0 right-0 px-2">
          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded text-[10px] text-yellow-400">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            <span>Low stamina</span>
          </div>
        </div>
      )}
    </motion.button>
  );
};

// Main Component
export const PhotoSelector = ({
  onConfirm,
  onCancel,
  onCreateGame,
  onBrowseGames,
  title = "Select Your Battle Team",
  subtitle = "Choose exactly 5 minted photos for this battle",
  confirmText = "Confirm Selection",
  mode = "select", // "select" | "create" - create mode shows bet input & create button
}) => {
  const [photos, setPhotos] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sortBy, setSortBy] = useState('dollar_value'); // dollar_value, stamina, level
  const [betAmount, setBetAmount] = useState(0);
  // REMOVED: useBotFallback - PVP is strictly player-vs-player only
  
  // Fetch user's minted photos with stamina
  const fetchPhotos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/photo-game/battle-photos');
      const photosWithStamina = res.data.photos || [];
      
      // Fetch stamina for each photo
      const enrichedPhotos = await Promise.all(
        photosWithStamina.map(async (photo) => {
          try {
            const staminaRes = await api.get(`/photo-game/photo-stamina/${photo.mint_id}`);
            return { ...photo, ...staminaRes.data };
          } catch {
            return { 
              ...photo, 
              current_stamina: MAX_STAMINA, 
              max_stamina: MAX_STAMINA,
              level: 1,
              xp: 0,
              win_streak: 0,
              lose_streak: 0,
            };
          }
        })
      );
      
      setPhotos(enrichedPhotos);
    } catch (err) {
      toast.error('Failed to load your photos');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);
  
  // Toggle photo selection
  const togglePhoto = (photo) => {
    const id = photo.mint_id;
    
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      if (selectedIds.length >= REQUIRED_PHOTOS) {
        toast.error(`Maximum ${REQUIRED_PHOTOS} photos allowed`);
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };
  
  // Get selected photos data
  const selectedPhotos = photos.filter(p => selectedIds.includes(p.mint_id));
  const totalDollarValue = selectedPhotos.reduce((sum, p) => sum + (p.dollar_value || 0), 0);
  const canConfirm = selectedIds.length === REQUIRED_PHOTOS;
  
  // Sort photos
  const sortedPhotos = [...photos].sort((a, b) => {
    if (sortBy === 'dollar_value') return (b.dollar_value || 0) - (a.dollar_value || 0);
    if (sortBy === 'stamina') return (b.current_stamina || 0) - (a.current_stamina || 0);
    if (sortBy === 'level') return (b.level || 1) - (a.level || 1);
    return 0;
  });
  
  // Count available photos (stamina >= 1)
  const availablePhotos = photos.filter(p => (p.current_stamina ?? MAX_STAMINA) >= 1).length;
  
  // Handle Create Game
  const handleCreateGame = async () => {
    if (!canConfirm) return;
    
    try {
      setCreating(true);
      const res = await api.post('/photo-game/open-games/create', {
        photo_ids: selectedIds,
        bet_amount: betAmount,
        is_bot_allowed: useBotFallback,
        bot_difficulty: 'medium',
      });
      
      if (res.data.success) {
        toast.success('🎮 Game created! Waiting for opponent...');
        onCreateGame?.(res.data.game, selectedIds, selectedPhotos);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };
  
  return (
    <div className="space-y-6" data-testid="photo-selector">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        <p className="text-gray-400 mt-1">{subtitle}</p>
      </div>
      
      {/* Selection counter */}
      <div className="flex flex-wrap gap-4 justify-center items-center">
        <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <span className="text-gray-400">Selected:</span>
          <span className={`font-bold text-xl ${
            canConfirm ? 'text-green-400' : 'text-purple-400'
          }`}>
            {selectedIds.length}/{REQUIRED_PHOTOS}
          </span>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <span className="text-gray-400">Total Value:</span>
          <span className="text-yellow-400 font-bold">
            {formatDollarValue(totalDollarValue)}
          </span>
        </div>
        
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 rounded-lg">
          <span className="text-gray-400">Available:</span>
          <span className="text-gray-300 font-bold">{availablePhotos} photos</span>
        </div>
      </div>
      
      {/* Sort options */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-400">Sort by:</span>
        </div>
        <div className="flex gap-2">
          {[
            { id: 'dollar_value', label: 'Value' },
            { id: 'stamina', label: 'Stamina' },
            { id: 'level', label: 'Level' },
          ].map(option => (
            <button
              key={option.id}
              onClick={() => setSortBy(option.id)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                sortBy === option.id
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Photos grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : photos.length === 0 ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <p className="text-white font-bold">No minted photos found</p>
          <p className="text-gray-400 text-sm mt-1">
            You need at least {REQUIRED_PHOTOS} minted photos to play
          </p>
        </div>
      ) : availablePhotos < REQUIRED_PHOTOS ? (
        <div className="text-center py-8">
          <Battery className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-400 font-bold">Not enough stamina</p>
          <p className="text-gray-400 text-sm mt-1">
            Only {availablePhotos} photos have stamina. Need {REQUIRED_PHOTOS}.
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Photos regenerate 1 battle per hour
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {sortedPhotos.map((photo) => (
            <SelectablePhotoCard
              key={photo.mint_id}
              photo={photo}
              selected={selectedIds.includes(photo.mint_id)}
              disabled={false}
              onSelect={togglePhoto}
            />
          ))}
        </div>
      )}
      
      {/* Info box */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-blue-300 font-medium mb-1">Battle Info</p>
            <ul className="text-gray-400 space-y-1 text-xs">
              <li>• Win a round: -1 stamina</li>
              <li>• Lose a round: -2 stamina</li>
              <li>• Photos regenerate +1 stamina per hour</li>
              <li>• First to 3 round wins takes the pot</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Create Game Mode - Bet Input & Options */}
      {mode === 'create' && canConfirm && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl space-y-4"
        >
          <h3 className="text-white font-bold flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-400" />
            Game Settings
          </h3>
          
          {/* Bet Amount */}
          <div>
            <label className="text-sm text-gray-400 mb-2 block">BL Coin Bet (optional)</label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                value={betAmount}
                onChange={(e) => setBetAmount(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="bg-gray-800 border-gray-700 text-white"
                data-testid="bet-amount-input"
              />
              <div className="flex gap-1">
                {[10, 50, 100].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setBetAmount(amt)}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-yellow-400 text-sm font-bold transition-colors"
                  >
                    +{amt}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {/* Bot fallback toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 font-medium">Play with bot if no opponents</p>
              <p className="text-gray-500 text-xs">Bot will match your bet amount</p>
            </div>
            <button
              onClick={() => setUseBotFallback(!useBotFallback)}
              className={`relative w-12 h-6 rounded-full transition-colors ${useBotFallback ? 'bg-purple-500' : 'bg-gray-700'}`}
              data-testid="bot-fallback-toggle"
            >
              <motion.span 
                className="absolute top-1 w-4 h-4 rounded-full bg-white"
                animate={{ left: useBotFallback ? 28 : 4 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </motion.div>
      )}
      
      {/* Action buttons */}
      <div className="flex flex-col gap-3">
        {/* Create mode buttons */}
        {mode === 'create' && (
          <>
            <motion.div whileHover={{ scale: canConfirm ? 1.01 : 1 }} whileTap={{ scale: canConfirm ? 0.99 : 1 }}>
              <Button
                onClick={handleCreateGame}
                disabled={!canConfirm || creating}
                className={`w-full py-6 text-lg font-bold ${
                  canConfirm
                    ? 'bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 hover:opacity-90'
                    : 'bg-gray-700 cursor-not-allowed'
                }`}
                size="lg"
                data-testid="create-game-btn"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-6 h-6 mr-2 animate-spin" />
                    Creating Game...
                  </>
                ) : canConfirm ? (
                  <>
                    <Plus className="w-6 h-6 mr-2" />
                    {betAmount > 0 ? `Create Game (${betAmount} BL Bet)` : 'Create Free Game'}
                    <ChevronRight className="w-6 h-6 ml-2" />
                  </>
                ) : (
                  <>Select {REQUIRED_PHOTOS - selectedIds.length} more photos</>
                )}
              </Button>
            </motion.div>
            
            {/* Browse games button */}
            <Button
              onClick={onBrowseGames}
              variant="outline"
              className="w-full py-4 border-gray-600 text-gray-300 hover:bg-gray-800"
              size="lg"
              data-testid="browse-games-btn"
            >
              <Trophy className="w-5 h-5 mr-2" />
              Browse Open Games
            </Button>
            
            <Button
              onClick={onCancel}
              variant="ghost"
              className="text-gray-500 hover:text-gray-300"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </>
        )}
        
        {/* Default select mode buttons */}
        {mode === 'select' && (
          <div className="flex gap-3">
            <Button
              onClick={onCancel}
              variant="outline"
              className="flex-1 py-4 border-gray-700"
              size="lg"
            >
              <X className="w-5 h-5 mr-2" />
              Cancel
            </Button>
            
            <Button
              onClick={() => onConfirm(selectedIds, selectedPhotos)}
              disabled={!canConfirm}
              className={`flex-1 py-4 font-bold ${
                canConfirm
                  ? 'bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500'
                  : 'bg-gray-700 cursor-not-allowed'
              }`}
              size="lg"
              data-testid="confirm-photos-btn"
            >
              {canConfirm ? (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  {confirmText}
                  <ChevronRight className="w-5 h-5 ml-2" />
                </>
              ) : (
                <>Select {REQUIRED_PHOTOS - selectedIds.length} more</>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoSelector;
