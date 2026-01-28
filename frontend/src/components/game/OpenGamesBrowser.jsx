/**
 * OpenGamesBrowser Component
 * 
 * PVP Open Games listing with:
 * - Grid/list view of open games
 * - Search by username or game ID
 * - Thumbnail showing creator's strongest photo
 * - Click to open preview modal with all 5 photos (flip cards)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, RefreshCw, Users, Coins, DollarSign, 
  X, Eye, ChevronRight, Zap, Filter, Grid, List,
  Trophy, Shield, Flame, Star, Clock, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import api from '../../services/api';

// Format dollar value
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
};

// Format time ago
const timeAgo = (date) => {
  if (!date) return '';
  const now = new Date();
  const created = new Date(date);
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
};

// Scenery config
const SCENERY_CONFIG = {
  natural: { name: 'Natural', color: 'from-green-500 to-emerald-600', icon: '🌿' },
  water: { name: 'Water', color: 'from-blue-500 to-cyan-600', icon: '🌊' },
  manmade: { name: 'Man-made', color: 'from-orange-500 to-red-600', icon: '🏙️' },
  neutral: { name: 'Neutral', color: 'from-gray-500 to-gray-600', icon: '⬜' },
};

// Flip Card Component for Photo Preview
const FlipCard = ({ photo, index }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  
  // Double-tap/double-click to flip
  const handleDoubleClick = () => {
    setIsFlipped(!isFlipped);
  };
  
  return (
    <motion.div
      className="relative w-full aspect-[3/4] cursor-pointer perspective-1000"
      onDoubleClick={handleDoubleClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      data-testid={`flip-card-${photo?.mint_id}`}
    >
      <motion.div
        className="relative w-full h-full"
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring' }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front - Photo Image */}
        <div 
          className="absolute inset-0 rounded-xl overflow-hidden border-2 border-gray-700 bg-gray-800 shadow-lg"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {photo?.image_url ? (
            <img 
              src={photo.image_url} 
              alt={photo.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
              <span className="text-5xl opacity-60">{scenery.icon}</span>
            </div>
          )}
          
          {/* Overlay info */}
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-white font-bold text-sm truncate">{photo?.name || 'Photo'}</p>
            <p className="text-yellow-400 font-bold text-lg">{formatDollarValue(photo?.dollar_value)}</p>
          </div>
          
          {/* Scenery badge */}
          <div className="absolute top-2 left-2">
            <span className={`px-2 py-1 rounded text-xs font-bold bg-gradient-to-r ${scenery.color} text-white shadow`}>
              {scenery.icon} {scenery.name}
            </span>
          </div>
          
          {/* Flip hint */}
          <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 rounded text-[10px] text-gray-300">
            Double-tap to flip
          </div>
          
          {/* Streaks */}
          <div className="absolute top-10 right-2 flex flex-col gap-1">
            {photo?.win_streak >= 3 && (
              <span className="px-2 py-0.5 bg-orange-500/80 rounded text-xs text-white">
                🔥 {photo.win_streak}
              </span>
            )}
            {photo?.lose_streak >= 3 && (
              <span className="px-2 py-0.5 bg-blue-500/80 rounded text-xs text-white">
                🛡️ Immunity
              </span>
            )}
          </div>
        </div>
        
        {/* Back - Stats */}
        <div 
          className="absolute inset-0 rounded-xl overflow-hidden border-2 border-purple-500 bg-gray-900 shadow-lg p-4"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <h4 className="text-white font-bold text-lg mb-3 truncate">{photo?.name || 'Photo'}</h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Dollar Value:</span>
              <span className="text-yellow-400 font-bold">{formatDollarValue(photo?.dollar_value)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Scenery:</span>
              <span className={`font-bold bg-gradient-to-r ${scenery.color} bg-clip-text text-transparent`}>
                {scenery.icon} {scenery.name}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Stamina:</span>
              <span className={`font-bold ${photo?.current_stamina < 5 ? 'text-red-400' : 'text-green-400'}`}>
                {photo?.current_stamina || 24}/{photo?.max_stamina || 24}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Level:</span>
              <span className="text-purple-400 font-bold">Lv. {photo?.level || 1}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">XP:</span>
              <span className="text-blue-400">{photo?.xp || 0}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Win Streak:</span>
              <span className="text-orange-400">
                {photo?.win_streak >= 3 ? `🔥 ${photo.win_streak}` : photo?.win_streak || 0}
              </span>
            </div>
            
            {/* Star display */}
            {photo?.level >= 10 && (
              <div className="flex justify-between">
                <span className="text-gray-400">Stars:</span>
                <span className="text-yellow-400">
                  {'⭐'.repeat(Math.min(Math.floor(photo.level / 10), 5))}
                </span>
              </div>
            )}
          </div>
          
          <div className="absolute bottom-2 right-2 text-[10px] text-gray-500">
            Double-tap to flip back
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

// Game Preview Modal
const GamePreviewModal = ({ game, isOpen, onClose, onJoin }) => {
  const [loading, setLoading] = useState(false);
  const [fullGame, setFullGame] = useState(null);
  
  useEffect(() => {
    if (isOpen && game?.game_id) {
      setLoading(true);
      api.get(`/photo-game/open-games/${game.game_id}`)
        .then(res => setFullGame(res.data))
        .catch(err => toast.error('Failed to load game details'))
        .finally(() => setLoading(false));
    }
  }, [isOpen, game?.game_id]);
  
  if (!isOpen) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700"
          data-testid="game-preview-modal"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                {fullGame?.creator_username || game?.creator_username}&apos;s Battle
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Game ID: {game?.game_id}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-full transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-4">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              </div>
            ) : (
              <>
                {/* Game info */}
                <div className="flex flex-wrap gap-4 mb-6">
                  <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <Coins className="w-5 h-5 text-yellow-400" />
                    <span className="text-yellow-400 font-bold">
                      {game?.bet_amount > 0 ? `${game.bet_amount} BL Bet` : 'Free Game'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <DollarSign className="w-5 h-5 text-purple-400" />
                    <span className="text-purple-400 font-bold">
                      Total Value: {formatDollarValue(fullGame?.total_dollar_value || game?.total_dollar_value)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 rounded-lg">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-400 text-sm">
                      {timeAgo(fullGame?.created_at || game?.created_at)}
                    </span>
                  </div>
                </div>
                
                {/* Creator's 5 photos */}
                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  {fullGame?.creator_username || game?.creator_username}&apos;s Photos
                </h4>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
                  {(fullGame?.creator_photos || []).map((photo, index) => (
                    <FlipCard key={photo.mint_id} photo={photo} index={index} />
                  ))}
                </div>
                
                {/* Join button */}
                <motion.div className="flex justify-center pt-4" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button
                    onClick={() => onJoin(game)}
                    className="w-full sm:w-auto px-12 py-6 text-lg font-bold bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 hover:opacity-90 shadow-lg"
                    size="lg"
                    data-testid="join-game-btn"
                  >
                    <Zap className="w-6 h-6 mr-2" />
                    Join This Battle
                    <ChevronRight className="w-6 h-6 ml-2" />
                  </Button>
                </motion.div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Game Card for grid view
const GameCard = ({ game, onClick }) => {
  const scenery = SCENERY_CONFIG[game?.thumbnail_photo?.scenery_type] || SCENERY_CONFIG.natural;
  
  return (
    <motion.div
      onClick={() => onClick(game)}
      className="relative rounded-xl overflow-hidden cursor-pointer group border-2 border-gray-700 hover:border-purple-500 transition-all bg-gray-800"
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      data-testid={`game-card-${game.game_id}`}
    >
      {/* Thumbnail image */}
      <div className="aspect-square relative">
        {game?.thumbnail_photo?.image_url ? (
          <img 
            src={game.thumbnail_photo.image_url} 
            alt="Strongest Photo"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
            <span className="text-6xl opacity-40">{scenery.icon}</span>
          </div>
        )}
        
        {/* Bet overlay */}
        <div className="absolute top-2 right-2">
          {game.bet_amount > 0 ? (
            <span className="px-3 py-1 bg-yellow-500 text-black font-bold rounded-full text-sm shadow-lg">
              💰 {game.bet_amount} BL
            </span>
          ) : (
            <span className="px-3 py-1 bg-green-500 text-white font-bold rounded-full text-sm shadow-lg">
              FREE
            </span>
          )}
        </div>
        
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white font-bold flex items-center gap-2">
            <Eye className="w-5 h-5" />
            View Details
          </span>
        </div>
      </div>
      
      {/* Info bar */}
      <div className="p-3 bg-gray-900">
        <p className="text-white font-bold truncate">{game.creator_username || 'Player'}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-yellow-400 text-sm font-bold">
            {formatDollarValue(game.total_dollar_value)}
          </span>
          <span className="text-gray-500 text-xs">
            {timeAgo(game.created_at)}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// Main Component
export const OpenGamesBrowser = ({ onJoinGame, onCreateGame }) => {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  
  // Fetch open games
  const fetchGames = useCallback(async () => {
    try {
      setLoading(true);
      const params = searchQuery ? { search: searchQuery } : {};
      const res = await api.get('/photo-game/open-games', { params });
      setGames(res.data.games || []);
    } catch (err) {
      toast.error('Failed to load open games');
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);
  
  useEffect(() => {
    fetchGames();
    
    // Poll for new games every 10 seconds
    const interval = setInterval(fetchGames, 10000);
    return () => clearInterval(interval);
  }, [fetchGames]);
  
  // Handle search
  const handleSearch = (e) => {
    e.preventDefault();
    fetchGames();
  };
  
  // Handle join
  const handleJoin = (game) => {
    setSelectedGame(null);
    onJoinGame?.(game);
  };
  
  return (
    <div className="space-y-6" data-testid="open-games-browser">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            Open Games
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            Join a battle or create your own
          </p>
        </div>
        
        {/* View toggle and refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
          >
            {viewMode === 'grid' ? (
              <List className="w-5 h-5 text-gray-400" />
            ) : (
              <Grid className="w-5 h-5 text-gray-400" />
            )}
          </button>
          
          <button
            onClick={fetchGames}
            disabled={loading}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <Input
            type="text"
            placeholder="Search by username or game ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-700"
          />
        </div>
        <Button type="submit" variant="outline" className="border-gray-700">
          Search
        </Button>
      </form>
      
      {/* Create game button */}
      <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
        <Button
          onClick={onCreateGame}
          className="w-full py-6 text-lg font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 hover:opacity-90 shadow-lg"
          size="lg"
          data-testid="create-game-btn"
        >
          <Zap className="w-6 h-6 mr-2" />
          Create New Game
          <ChevronRight className="w-6 h-6 ml-2" />
        </Button>
      </motion.div>
      
      {/* Games grid/list */}
      {loading && games.length === 0 ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : games.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No open games found</p>
          <p className="text-gray-500 text-sm mt-1">Be the first to create one!</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {games.map((game) => (
            <GameCard
              key={game.game_id}
              game={game}
              onClick={setSelectedGame}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {games.map((game) => (
            <motion.div
              key={game.game_id}
              onClick={() => setSelectedGame(game)}
              className="flex items-center gap-4 p-4 bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-700 transition-colors"
              whileHover={{ x: 4 }}
            >
              {/* Thumbnail */}
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                {game?.thumbnail_photo?.image_url ? (
                  <img 
                    src={game.thumbnail_photo.image_url} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500" />
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold truncate">{game.creator_username}</p>
                <p className="text-yellow-400 text-sm">{formatDollarValue(game.total_dollar_value)}</p>
              </div>
              
              {/* Bet */}
              <div className="flex-shrink-0">
                {game.bet_amount > 0 ? (
                  <span className="px-3 py-1 bg-yellow-500 text-black font-bold rounded-full text-sm">
                    {game.bet_amount} BL
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-green-500 text-white font-bold rounded-full text-sm">
                    FREE
                  </span>
                )}
              </div>
              
              <ChevronRight className="w-5 h-5 text-gray-500" />
            </motion.div>
          ))}
        </div>
      )}
      
      {/* Preview modal */}
      <GamePreviewModal
        game={selectedGame}
        isOpen={!!selectedGame}
        onClose={() => setSelectedGame(null)}
        onJoin={handleJoin}
      />
    </div>
  );
};

export default OpenGamesBrowser;
