/**
 * SpectatorView Component
 * Real-time view of an ongoing PVP battle for spectators
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, Users, Trophy, Swords, Clock, ArrowLeft,
  Wifi, WifiOff, Crown, Star, Zap
} from 'lucide-react';
import { Button } from '../ui/button';
import { getToken } from '../../services/api';
import { toast } from 'sonner';

const SpectatorView = ({ roomId, onExit }) => {
  const [gameState, setGameState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  
  // Connect to spectator WebSocket
  useEffect(() => {
    if (!roomId) return;
    
    const token = getToken();
    if (!token) {
      setError('Please log in to spectate');
      return;
    }
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsHost = process.env.REACT_APP_BACKEND_URL?.replace(/^https?:\/\//, '') || window.location.host;
    const wsUrl = `${wsProtocol}://${wsHost}/api/ws/spectate/${roomId}/${token}`;
    
    console.log('[SpectatorView] Connecting to:', wsUrl);
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('[SpectatorView] WebSocket connected');
      setConnected(true);
      setError(null);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(data);
      } catch (err) {
        console.error('[SpectatorView] Parse error:', err);
      }
    };
    
    ws.onerror = (error) => {
      console.error('[SpectatorView] WebSocket error:', error);
      setError('Connection error');
    };
    
    ws.onclose = (event) => {
      console.log('[SpectatorView] WebSocket closed:', event.code, event.reason);
      setConnected(false);
      if (event.code !== 1000) {
        setError('Disconnected from game');
      }
    };
    
    // Heartbeat
    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 15000);
    
    return () => {
      clearInterval(heartbeat);
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [roomId]);
  
  const handleMessage = useCallback((data) => {
    console.log('[SpectatorView] Received:', data.type);
    
    switch (data.type) {
      case 'spectator_state':
      case 'game_state':
        setGameState(data);
        if (data.spectator_count !== undefined) {
          setSpectatorCount(data.spectator_count);
        }
        break;
        
      case 'spectator_connected':
        toast.success('Now spectating this battle!');
        break;
        
      case 'spectator_count':
        setSpectatorCount(data.count);
        break;
        
      case 'round_selecting':
        setGameState(prev => ({
          ...prev,
          round_phase: 'selecting',
          current_round: data.round
        }));
        break;
        
      case 'round_ready':
      case 'both_ready':
        setGameState(prev => ({
          ...prev,
          round_phase: 'ready',
          player1: { ...prev?.player1, selected_photo: data.player1_photo },
          player2: { ...prev?.player2, selected_photo: data.player2_photo }
        }));
        break;
        
      case 'countdown_start':
      case 'countdown_tick':
        setGameState(prev => ({
          ...prev,
          round_phase: 'countdown',
          countdown: data.seconds_remaining || data.count
        }));
        break;
        
      case 'round_start':
        setGameState(prev => ({
          ...prev,
          round_phase: 'playing'
        }));
        break;
        
      case 'round_result':
        setGameState(prev => ({
          ...prev,
          round_phase: 'result',
          player1_wins: data.player1_wins,
          player2_wins: data.player2_wins,
          round_winner: data.winner_id
        }));
        break;
        
      case 'game_over':
        setGameState(prev => ({
          ...prev,
          round_phase: 'game_over',
          winner: data.winner
        }));
        toast.info(`Game Over! ${data.winner?.username || 'Unknown'} wins!`);
        break;
        
      case 'error':
        setError(data.message);
        break;
        
      default:
        // Handle other events silently
        break;
    }
  }, []);
  
  // Render player card
  const PlayerCard = ({ player, wins, isWinner, position }) => {
    if (!player) return null;
    
    return (
      <div className={`flex flex-col items-center p-4 rounded-xl ${
        isWinner ? 'bg-yellow-500/20 border border-yellow-500/50' : 'bg-gray-800/50 border border-gray-700/50'
      }`}>
        {/* Player name */}
        <div className="flex items-center gap-2 mb-3">
          {isWinner && <Crown className="w-5 h-5 text-yellow-400" />}
          <span className="font-bold text-white text-lg">{player.username || 'Player'}</span>
        </div>
        
        {/* Score */}
        <div className="flex items-center gap-2 mb-4">
          <Trophy className={`w-5 h-5 ${wins > 0 ? 'text-yellow-400' : 'text-gray-500'}`} />
          <span className="text-2xl font-bold text-white">{wins}</span>
          <span className="text-gray-400">wins</span>
        </div>
        
        {/* Selected photo */}
        {player.selected_photo && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative"
          >
            <img 
              src={player.selected_photo.image_url || '/placeholder-photo.jpg'}
              alt={player.selected_photo.title || 'Battle Photo'}
              className="w-32 h-32 object-cover rounded-lg border-2 border-purple-500/50"
            />
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-purple-600 rounded-full text-xs font-bold text-white">
              ${(player.selected_photo.dollar_value / 1000000).toFixed(1)}M
            </div>
          </motion.div>
        )}
        
        {/* Status */}
        <div className="mt-3 flex items-center gap-2">
          {player.is_connected ? (
            <span className="flex items-center gap-1 text-green-400 text-sm">
              <Wifi className="w-3 h-3" /> Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-red-400 text-sm">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
        </div>
        
        {/* Selection status */}
        {gameState?.round_phase === 'selecting' && (
          <div className="mt-2 text-sm">
            {player.has_selected ? (
              <span className="text-green-400">✓ Photo selected</span>
            ) : (
              <span className="text-yellow-400 animate-pulse">Selecting...</span>
            )}
          </div>
        )}
      </div>
    );
  };
  
  // Error state
  if (error) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
        <div className="text-red-400 text-lg">{error}</div>
        <Button onClick={onExit} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }
  
  // Loading state
  if (!gameState) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
        <p className="text-gray-400">Connecting to battle...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6" data-testid="spectator-view">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button onClick={onExit} variant="ghost" className="text-gray-400 hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Exit
        </Button>
        
        <div className="flex items-center gap-4">
          {/* Connection status */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {connected ? 'Live' : 'Disconnected'}
          </div>
          
          {/* Spectator count */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 text-sm">
            <Eye className="w-4 h-4" />
            {spectatorCount} watching
          </div>
        </div>
      </div>
      
      {/* Live badge */}
      <div className="text-center">
        <motion.div 
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded-full"
        >
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-400 font-bold">LIVE BATTLE</span>
        </motion.div>
      </div>
      
      {/* Round info */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">
          Round {gameState.current_round} of {gameState.max_rounds}
        </h2>
        <p className="text-gray-400 capitalize">
          {gameState.round_phase === 'selecting' && 'Players are selecting photos...'}
          {gameState.round_phase === 'ready' && 'Photos locked in! Get ready...'}
          {gameState.round_phase === 'countdown' && `Starting in ${gameState.countdown || '...'}s`}
          {gameState.round_phase === 'playing' && 'Battle in progress!'}
          {gameState.round_phase === 'result' && 'Round complete!'}
          {gameState.round_phase === 'game_over' && 'Game Over!'}
        </p>
      </div>
      
      {/* Players */}
      <div className="grid grid-cols-2 gap-6">
        <PlayerCard 
          player={gameState.player1}
          wins={gameState.player1_wins || 0}
          isWinner={gameState.round_phase === 'game_over' && gameState.player1_wins >= 3}
          position="left"
        />
        
        {/* VS divider */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center"
          >
            <Swords className="w-8 h-8 text-white" />
          </motion.div>
        </div>
        
        <PlayerCard 
          player={gameState.player2}
          wins={gameState.player2_wins || 0}
          isWinner={gameState.round_phase === 'game_over' && gameState.player2_wins >= 3}
          position="right"
        />
      </div>
      
      {/* Game type indicator */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800/50 rounded-lg text-gray-300">
          <Zap className="w-4 h-4 text-yellow-400" />
          {gameState.round_type === 'auction' ? 'RPS Auction Battle' : 'Rock Paper Scissors'}
        </div>
      </div>
      
      {/* Countdown overlay */}
      <AnimatePresence>
        {gameState.round_phase === 'countdown' && gameState.countdown && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-black/50 z-50"
          >
            <motion.div
              key={gameState.countdown}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              className="text-8xl font-bold text-white"
            >
              {gameState.countdown}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SpectatorView;
