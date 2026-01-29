/**
 * FeaturedReplays Component
 * 
 * Shows the best community bot battle replays on the Photo Game landing page
 * - Highest BL won
 * - Longest win streaks
 * - Most viewed
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Eye, Heart, Play, Flame, Coins, Star,
  ChevronLeft, ChevronRight, Loader2, Film
} from 'lucide-react';
import { Button } from '../ui/button';
import api from '../../api';

const BOT_EMOJIS = {
  easy: '🤖',
  medium: '🤖',
  hard: '🤖',
  extreme: '💀',
};

const BOT_COLORS = {
  easy: 'border-green-500/50 bg-green-500/10',
  medium: 'border-yellow-500/50 bg-yellow-500/10',
  hard: 'border-red-500/50 bg-red-500/10',
  extreme: 'border-purple-500/50 bg-purple-500/10',
};

// Featured Replay Card
const FeaturedReplayCard = ({ replay, rank, onWatch }) => {
  const thumbnail = replay.player_photos?.[0]?.image_url;
  const isWin = replay.winner === 'player';
  const botEmoji = BOT_EMOJIS[replay.difficulty] || '🤖';
  const botColor = BOT_COLORS[replay.difficulty] || BOT_COLORS.easy;
  
  const getRankBadge = () => {
    if (rank === 1) return { bg: 'bg-yellow-500', text: '🥇', label: '1st' };
    if (rank === 2) return { bg: 'bg-gray-400', text: '🥈', label: '2nd' };
    if (rank === 3) return { bg: 'bg-amber-600', text: '🥉', label: '3rd' };
    return null;
  };
  
  const rankBadge = getRankBadge();
  
  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -5 }}
      whileTap={{ scale: 0.98 }}
      className={`relative rounded-xl border-2 ${botColor} overflow-hidden cursor-pointer group min-w-[200px] sm:min-w-[240px]`}
      onClick={() => onWatch(replay)}
    >
      {/* Rank Badge */}
      {rankBadge && (
        <div className={`absolute top-2 left-2 z-20 ${rankBadge.bg} rounded-full px-2 py-1 flex items-center gap-1`}>
          <span className="text-sm">{rankBadge.text}</span>
        </div>
      )}
      
      {/* Play Overlay */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
        <div className="w-14 h-14 rounded-full bg-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/50">
          <Play className="w-7 h-7 text-white ml-1" />
        </div>
      </div>
      
      {/* Thumbnail */}
      <div className="relative h-28 sm:h-32">
        {thumbnail ? (
          <img 
            src={thumbnail} 
            alt="Battle" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
            <span className="text-4xl">{botEmoji}</span>
          </div>
        )}
        
        {/* Win/Loss badge */}
        <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold ${
          isWin ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {isWin ? '🏆 WIN' : 'LOSS'}
        </div>
        
        {/* Difficulty badge */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 rounded-full text-xs text-white flex items-center gap-1">
          <span>{botEmoji}</span>
          <span className="capitalize">{replay.difficulty}</span>
        </div>
      </div>
      
      {/* Info */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          {replay.avatar_url ? (
            <img src={replay.avatar_url} alt="" className="w-6 h-6 rounded-full" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs text-white font-bold">
              {replay.username?.charAt(0)?.toUpperCase() || 'P'}
            </div>
          )}
          <span className="text-sm text-white font-medium truncate">{replay.username || 'Player'}</span>
        </div>
        
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-purple-400">
            {replay.final_score_player} - {replay.final_score_opponent}
          </span>
          <span className={`text-sm font-bold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
            {isWin ? '+' : '-'}{replay.winnings || replay.bet_amount} BL
          </span>
        </div>
        
        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {replay.views || 0}
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3" />
            {replay.likes || 0}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// Main Component
export const FeaturedReplays = () => {
  const [replays, setReplays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('top_wins'); // top_wins, most_viewed, recent
  const [scrollPosition, setScrollPosition] = useState(0);
  
  useEffect(() => {
    fetchFeaturedReplays();
  }, [category]);
  
  const fetchFeaturedReplays = async () => {
    try {
      setLoading(true);
      // Fetch public replays (those shared to feed)
      const response = await api.get(`/photo-game/battle-replay/featured?category=${category}&limit=10`);
      setReplays(response.data.replays || []);
    } catch (err) {
      console.error('Failed to fetch featured replays:', err);
      // Try to get any available replays
      try {
        const fallback = await api.get('/photo-game/battle-replay/user/list?limit=10');
        setReplays(fallback.data.replays || []);
      } catch {
        setReplays([]);
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleWatch = (replay) => {
    window.open(`/replay/${replay.replay_id}`, '_blank');
  };
  
  const scrollLeft = () => {
    const container = document.getElementById('featured-replays-container');
    if (container) {
      container.scrollBy({ left: -260, behavior: 'smooth' });
    }
  };
  
  const scrollRight = () => {
    const container = document.getElementById('featured-replays-container');
    if (container) {
      container.scrollBy({ left: 260, behavior: 'smooth' });
    }
  };
  
  if (loading) {
    return (
      <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
        </div>
      </div>
    );
  }
  
  if (replays.length === 0) {
    return (
      <div className="bg-gray-800/30 rounded-2xl p-6 border border-gray-700/50">
        <div className="flex items-center gap-3 mb-4">
          <Film className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-white">Featured Replays</h3>
        </div>
        <div className="text-center py-6">
          <p className="text-gray-500 text-sm">No featured replays yet</p>
          <p className="text-gray-600 text-xs mt-1">Complete a bot battle to be featured!</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800/30 rounded-2xl p-4 sm:p-6 border border-gray-700/50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Star className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Featured Replays</h3>
            <p className="text-xs text-gray-400">Watch the best community battles</p>
          </div>
        </div>
        
        {/* Category Tabs */}
        <div className="flex gap-1 p-1 bg-gray-800 rounded-lg">
          <button
            onClick={() => setCategory('top_wins')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              category === 'top_wins'
                ? 'bg-purple-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3 h-3 inline mr-1" />
            Top Wins
          </button>
          <button
            onClick={() => setCategory('most_viewed')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              category === 'most_viewed'
                ? 'bg-purple-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3 inline mr-1" />
            Popular
          </button>
          <button
            onClick={() => setCategory('recent')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              category === 'recent'
                ? 'bg-purple-500 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Flame className="w-3 h-3 inline mr-1" />
            Recent
          </button>
        </div>
      </div>
      
      {/* Replays Carousel */}
      <div className="relative">
        {/* Scroll buttons */}
        <button
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-gray-900/80 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-all -ml-3 hidden sm:flex"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <button
          onClick={scrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-gray-900/80 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-800 transition-all -mr-3 hidden sm:flex"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        
        {/* Scrollable container */}
        <div
          id="featured-replays-container"
          className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {replays.map((replay, index) => (
            <FeaturedReplayCard
              key={replay.replay_id}
              replay={replay}
              rank={category === 'top_wins' ? index + 1 : null}
              onWatch={handleWatch}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeaturedReplays;
