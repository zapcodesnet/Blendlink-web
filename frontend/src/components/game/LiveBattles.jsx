/**
 * LiveBattles Component
 * Shows list of ongoing PVP battles that can be spectated
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, Users, Trophy, Swords, RefreshCw, Radio,
  Play, Clock, ChevronRight, Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';
import api from '../../services/api';
import { toast } from 'sonner';

const LiveBattles = ({ onSpectate, onClose }) => {
  const [battles, setBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Fetch live battles
  const fetchBattles = useCallback(async (showToast = false) => {
    try {
      const res = await api.get('/photo-game/live-battles');
      setBattles(res.data.battles || []);
      if (showToast && res.data.battles?.length > 0) {
        toast.success(`Found ${res.data.battles.length} live battle(s)!`);
      }
    } catch (err) {
      console.error('Failed to fetch live battles:', err);
      if (showToast) {
        toast.error('Failed to load live battles');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  // Initial load
  useEffect(() => {
    fetchBattles();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(() => fetchBattles(), 10000);
    return () => clearInterval(interval);
  }, [fetchBattles]);
  
  const handleRefresh = () => {
    setRefreshing(true);
    fetchBattles(true);
  };
  
  // Get phase display text
  const getPhaseText = (phase) => {
    switch (phase) {
      case 'selecting': return 'Selecting Photos';
      case 'ready': return 'Photos Locked';
      case 'countdown': return 'Starting Soon';
      case 'playing': return 'In Battle!';
      case 'result': return 'Round Complete';
      default: return 'Waiting';
    }
  };
  
  // Get phase color
  const getPhaseColor = (phase) => {
    switch (phase) {
      case 'selecting': return 'text-yellow-400 bg-yellow-500/20';
      case 'ready': return 'text-blue-400 bg-blue-500/20';
      case 'countdown': return 'text-orange-400 bg-orange-500/20';
      case 'playing': return 'text-green-400 bg-green-500/20';
      case 'result': return 'text-purple-400 bg-purple-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };
  
  return (
    <div className="space-y-6" data-testid="live-battles">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <Radio className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Live Battles</h2>
            <p className="text-sm text-gray-400">Watch ongoing PVP matches</p>
          </div>
        </div>
        
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          disabled={refreshing}
          className="text-gray-400 hover:text-white"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {/* Live indicator */}
      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        <span className="text-red-400 text-sm font-medium">
          {battles.length > 0 ? `${battles.length} battle${battles.length > 1 ? 's' : ''} happening now` : 'No live battles at the moment'}
        </span>
      </div>
      
      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
          <p className="text-gray-400">Finding live battles...</p>
        </div>
      )}
      
      {/* Empty state */}
      {!loading && battles.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12 bg-gray-800/30 rounded-xl border border-gray-700/50"
        >
          <Swords className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Live Battles</h3>
          <p className="text-gray-400 mb-4">
            There are no ongoing PVP battles to watch right now.
          </p>
          <p className="text-gray-500 text-sm">
            Check back soon or start your own battle!
          </p>
        </motion.div>
      )}
      
      {/* Battle list */}
      <div className="space-y-3">
        <AnimatePresence>
          {battles.map((battle, index) => (
            <motion.div
              key={battle.room_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.1 }}
              className="relative overflow-hidden bg-gradient-to-r from-gray-800/80 to-gray-900/80 rounded-xl border border-gray-700/50 hover:border-purple-500/50 transition-all"
            >
              {/* Live badge */}
              <div className="absolute top-3 right-3">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="flex items-center gap-1 px-2 py-1 bg-red-500/20 rounded-full"
                >
                  <div className="w-2 h-2 bg-red-500 rounded-full" />
                  <span className="text-red-400 text-xs font-bold">LIVE</span>
                </motion.div>
              </div>
              
              <div className="p-4">
                {/* Players */}
                <div className="flex items-center justify-between mb-4">
                  {/* Player 1 */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
                      {battle.player1?.username?.charAt(0)?.toUpperCase() || 'P'}
                    </div>
                    <div>
                      <p className="font-semibold text-white">{battle.player1?.username || 'Player 1'}</p>
                      <p className="text-sm text-yellow-400 flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        {battle.player1?.wins || 0} wins
                      </p>
                    </div>
                  </div>
                  
                  {/* VS */}
                  <div className="px-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                      <span className="text-white font-bold text-sm">VS</span>
                    </div>
                  </div>
                  
                  {/* Player 2 */}
                  <div className="flex items-center gap-3 flex-row-reverse">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center text-white font-bold">
                      {battle.player2?.username?.charAt(0)?.toUpperCase() || 'P'}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-white">{battle.player2?.username || 'Player 2'}</p>
                      <p className="text-sm text-yellow-400 flex items-center gap-1 justify-end">
                        <Trophy className="w-3 h-3" />
                        {battle.player2?.wins || 0} wins
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Battle info */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                  <div className="flex items-center gap-4">
                    {/* Round */}
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Swords className="w-4 h-4" />
                      Round {battle.current_round}/{battle.max_rounds}
                    </div>
                    
                    {/* Phase */}
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getPhaseColor(battle.round_phase)}`}>
                      {getPhaseText(battle.round_phase)}
                    </div>
                    
                    {/* Spectators */}
                    <div className="flex items-center gap-1 text-sm text-gray-400">
                      <Eye className="w-4 h-4" />
                      {battle.spectator_count || 0}
                    </div>
                  </div>
                  
                  {/* Watch button */}
                  <Button
                    onClick={() => onSpectate(battle.room_id)}
                    size="sm"
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Watch
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Back button */}
      {onClose && (
        <div className="pt-4">
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full text-gray-400 hover:text-white"
          >
            Back to Menu
          </Button>
        </div>
      )}
    </div>
  );
};

export default LiveBattles;
