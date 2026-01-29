/**
 * BattleReplayList Component
 * 
 * Shows list of user's battle replays with thumbnails
 * Quick access to view, share, and delete replays
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Trash2, Share2, Trophy, Skull, Eye, Heart,
  Clock, Loader2, ChevronRight, Film
} from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import api from '../../api';
import { BattleReplayViewer } from './BattleReplayViewer';

const BOT_EMOJIS = {
  easy: '🤖',
  medium: '🤖',
  hard: '🤖',
  extreme: '💀',
};

const BOT_COLORS = {
  easy: 'from-green-500 to-emerald-600',
  medium: 'from-yellow-500 to-orange-500',
  hard: 'from-red-500 to-pink-600',
  extreme: 'from-purple-600 to-indigo-700',
};

// Replay Card
const ReplayCard = ({ replay, onView, onShare, onDelete }) => {
  const thumbnail = replay.player_photos?.[0]?.image_url;
  const isWin = replay.winner === 'player';
  const botColor = BOT_COLORS[replay.difficulty] || BOT_COLORS.easy;
  const botEmoji = BOT_EMOJIS[replay.difficulty] || '🤖';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`bg-gray-800/50 rounded-xl border ${
        isWin ? 'border-green-500/30' : 'border-red-500/30'
      } overflow-hidden hover:border-purple-500/50 transition-all cursor-pointer group`}
      onClick={() => onView(replay)}
    >
      <div className="flex">
        {/* Thumbnail */}
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex-shrink-0">
          {thumbnail ? (
            <img 
              src={thumbnail} 
              alt="Battle" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${botColor} flex items-center justify-center`}>
              <span className="text-3xl">{botEmoji}</span>
            </div>
          )}
          
          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center">
              <Play className="w-6 h-6 text-white ml-1" />
            </div>
          </div>
          
          {/* Result badge */}
          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-bold ${
            isWin ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
          }`}>
            {isWin ? 'WIN' : 'LOSS'}
          </div>
        </div>
        
        {/* Info */}
        <div className="flex-1 p-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{botEmoji}</span>
              <h4 className="font-bold text-white capitalize">
                {replay.difficulty} Bot
              </h4>
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <span className={`font-bold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                {replay.final_score_player} - {replay.final_score_opponent}
              </span>
              <span className="text-gray-500">•</span>
              <span className="text-yellow-400">
                {isWin ? `+${replay.winnings}` : `-${replay.bet_amount}`} BL
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {replay.views || 0}
              </span>
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {replay.likes || 0}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {replay.rounds?.length || 0} rounds
              </span>
            </div>
            
            <div className="flex gap-1">
              <Button
                onClick={(e) => { e.stopPropagation(); onShare(replay); }}
                variant="ghost"
                size="sm"
                className="p-2 h-auto"
              >
                <Share2 className="w-4 h-4 text-purple-400" />
              </Button>
              <Button
                onClick={(e) => { e.stopPropagation(); onDelete(replay); }}
                variant="ghost"
                size="sm"
                className="p-2 h-auto"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// Main List Component
export const BattleReplayList = ({ onViewReplay }) => {
  const [replays, setReplays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReplay, setSelectedReplay] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  
  const fetchReplays = async (skip = 0) => {
    try {
      setLoading(true);
      const response = await api.get(`/photo-game/battle-replay/user/list?skip=${skip}&limit=10`);
      
      if (skip === 0) {
        setReplays(response.data.replays);
      } else {
        setReplays(prev => [...prev, ...response.data.replays]);
      }
      
      setHasMore(response.data.has_more);
    } catch (err) {
      console.error('Failed to fetch replays:', err);
      toast.error('Failed to load replays');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchReplays(0);
  }, []);
  
  const handleLoadMore = () => {
    const newPage = page + 1;
    setPage(newPage);
    fetchReplays(newPage * 10);
  };
  
  const handleView = (replay) => {
    if (onViewReplay) {
      onViewReplay(replay);
    } else {
      setSelectedReplay(replay);
    }
  };
  
  const handleShare = async (replay) => {
    try {
      await api.post(`/photo-game/battle-replay/${replay.replay_id}/share-to-feed`);
      toast.success('Shared to Blendlink Feed!');
    } catch (err) {
      // Open share modal as fallback
      setSelectedReplay(replay);
    }
  };
  
  const handleDelete = async (replay) => {
    if (!confirm('Delete this replay?')) return;
    
    try {
      await api.delete(`/photo-game/battle-replay/${replay.replay_id}`);
      setReplays(prev => prev.filter(r => r.replay_id !== replay.replay_id));
      toast.success('Replay deleted');
    } catch (err) {
      toast.error('Failed to delete replay');
    }
  };
  
  if (loading && replays.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }
  
  if (!loading && replays.length === 0) {
    return (
      <div className="text-center py-12">
        <Film className="w-16 h-16 mx-auto mb-4 text-gray-600" />
        <h3 className="text-lg font-bold text-gray-400 mb-2">No Replays Yet</h3>
        <p className="text-gray-500 text-sm">
          Complete a bot battle to save your first replay!
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <Film className="w-5 h-5 text-purple-400" />
          Battle Replays
        </h3>
        <span className="text-sm text-gray-400">{replays.length} replays</span>
      </div>
      
      <AnimatePresence>
        {replays.map((replay, index) => (
          <ReplayCard
            key={replay.replay_id}
            replay={replay}
            onView={handleView}
            onShare={handleShare}
            onDelete={handleDelete}
          />
        ))}
      </AnimatePresence>
      
      {hasMore && (
        <Button
          onClick={handleLoadMore}
          disabled={loading}
          variant="outline"
          className="w-full"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <ChevronRight className="w-4 h-4 mr-2" />
          )}
          Load More
        </Button>
      )}
      
      {/* Replay Viewer Modal */}
      <AnimatePresence>
        {selectedReplay && (
          <BattleReplayViewer
            replay={selectedReplay}
            isModal={true}
            onClose={() => setSelectedReplay(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default BattleReplayList;
