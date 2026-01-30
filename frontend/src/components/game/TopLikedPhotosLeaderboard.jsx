/**
 * TopLikedPhotosLeaderboard Component
 * 
 * Displays a leaderboard of the most liked/reacted minted photos
 * With period filtering and interactive like buttons
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Heart, Trophy, Crown, Medal, Star, TrendingUp,
  Loader2, Calendar, Users, Image, Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';
import { LikeButton } from './LikeButton';
import api from '../../services/api';

// Format dollar value
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
};

// Rank badge component
const RankBadge = ({ rank }) => {
  if (rank === 1) {
    return (
      <motion.div 
        className="absolute -top-2 -left-2 z-10"
        animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/50">
          <Crown className="w-5 h-5 text-white" />
        </div>
      </motion.div>
    );
  }
  if (rank === 2) {
    return (
      <div className="absolute -top-2 -left-2 z-10">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center shadow-lg">
          <Medal className="w-4 h-4 text-white" />
        </div>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="absolute -top-2 -left-2 z-10">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg">
          <Medal className="w-4 h-4 text-white" />
        </div>
      </div>
    );
  }
  return (
    <div className="absolute -top-1 -left-1 z-10 w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300">
      {rank}
    </div>
  );
};

// Photo card in leaderboard
const LeaderboardPhotoCard = ({ photo, onPhotoClick }) => {
  const [localLikes, setLocalLikes] = useState(photo.reaction_count || 0);
  
  const handleLikeChange = useCallback(({ count }) => {
    setLocalLikes(count);
  }, []);
  
  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      className="relative bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden cursor-pointer group"
      onClick={() => onPhotoClick?.(photo)}
      data-testid={`leaderboard-photo-${photo.mint_id}`}
    >
      <RankBadge rank={photo.rank} />
      
      {/* Photo Image */}
      <div className="aspect-square relative">
        <img 
          src={photo.image_url} 
          alt={photo.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        
        {/* Like count badge */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded-full flex items-center gap-1">
          <Heart className="w-3 h-3 text-red-400 fill-red-400" />
          <span className="text-xs font-bold text-white">{localLikes}</span>
        </div>
        
        {/* Win streak badge */}
        {photo.current_win_streak >= 3 && (
          <div className="absolute top-2 left-8 px-2 py-1 bg-orange-500/80 rounded-full">
            <span className="text-xs font-bold text-white">🔥{photo.current_win_streak}</span>
          </div>
        )}
        
        {/* Bottom info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white font-bold text-sm truncate">{photo.name || 'Untitled'}</p>
          <div className="flex items-center justify-between mt-1">
            <span className="text-yellow-400 font-bold text-sm">
              {formatDollarValue(photo.dollar_value)}
            </span>
            <span className="text-gray-400 text-xs">
              Lv{photo.level || 1}
            </span>
          </div>
        </div>
      </div>
      
      {/* Owner info & Like button */}
      <div className="p-2 flex items-center justify-between bg-gray-800/80">
        <div className="flex items-center gap-2">
          {photo.owner_avatar ? (
            <img 
              src={photo.owner_avatar} 
              alt={photo.owner_username}
              className="w-6 h-6 rounded-full object-cover"
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-purple-500/30 flex items-center justify-center">
              <Users className="w-3 h-3 text-purple-400" />
            </div>
          )}
          <span className="text-xs text-gray-400 truncate max-w-[80px]">
            {photo.owner_username || 'Anonymous'}
          </span>
        </div>
        
        {/* Interactive Like Button */}
        <LikeButton
          photoId={photo.mint_id}
          initialLikes={localLikes}
          initialLiked={photo.user_liked}
          size="sm"
          showCount={false}
          onLikeChange={handleLikeChange}
        />
      </div>
    </motion.div>
  );
};

// Main Leaderboard Component
export const TopLikedPhotosLeaderboard = ({ onPhotoClick }) => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('all_time'); // all_time, this_week, this_month
  
  const PERIODS = [
    { id: 'all_time', label: 'All Time', icon: <Trophy className="w-3 h-3" /> },
    { id: 'this_month', label: 'This Month', icon: <Calendar className="w-3 h-3" /> },
    { id: 'this_week', label: 'This Week', icon: <TrendingUp className="w-3 h-3" /> },
  ];
  
  useEffect(() => {
    fetchTopPhotos();
  }, [period]);
  
  const fetchTopPhotos = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/photo-game/leaderboard/top-liked-photos?period=${period}&limit=12`);
      setPhotos(response.data.photos || []);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="bg-gray-800/30 rounded-2xl p-4 sm:p-6 border border-gray-700/50" data-testid="top-liked-leaderboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center shadow-lg shadow-red-500/30">
            <Heart className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Top Liked Photos
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </h3>
            <p className="text-xs text-gray-400">Most popular minted photos</p>
          </div>
        </div>
        
        {/* Period Tabs */}
        <div className="flex gap-1 p-1 bg-gray-800 rounded-lg">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${
                period === p.id
                  ? 'bg-red-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-red-400" />
        </div>
      )}
      
      {/* Empty State */}
      {!loading && photos.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-700/50 flex items-center justify-center">
            <Image className="w-8 h-8 text-gray-500" />
          </div>
          <p className="text-gray-400 mb-2">No liked photos yet</p>
          <p className="text-gray-500 text-sm">Be the first to mint and get likes!</p>
        </div>
      )}
      
      {/* Photo Grid */}
      {!loading && photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <AnimatePresence mode="popLayout">
            {photos.map((photo, index) => (
              <motion.div
                key={photo.mint_id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ delay: index * 0.05 }}
              >
                <LeaderboardPhotoCard 
                  photo={photo} 
                  onPhotoClick={onPhotoClick}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      
      {/* View All Button */}
      {!loading && photos.length >= 12 && (
        <div className="mt-4 text-center">
          <Button 
            variant="outline" 
            size="sm"
            className="text-gray-400 border-gray-600 hover:text-white hover:border-gray-500"
          >
            View All Rankings
          </Button>
        </div>
      )}
    </div>
  );
};

export default TopLikedPhotosLeaderboard;
