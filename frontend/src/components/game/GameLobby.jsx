/**
 * GameLobby Component
 * 
 * Ready screen after both players join:
 * - Shows both players' 5 photos
 * - Ready button for each player
 * - 10-second transparent countdown when both ready
 * - Real-time sync via WebSocket for instant updates
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Check, Clock, Users, Zap, Trophy, Shield,
  Loader2, X, ChevronRight, Bell, Wifi, WifiOff
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import api from '../../services/api';

// Constants
const COUNTDOWN_SECONDS = 10;

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

// Mini photo card for lobby display
const MiniPhotoCard = ({ photo, index }) => {
  const scenery = SCENERY_CONFIG[photo?.scenery_type] || SCENERY_CONFIG.natural;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.1 }}
      className="relative rounded-lg overflow-hidden border border-gray-700 bg-gray-800"
    >
      <div className="aspect-square w-20 sm:w-24">
        {photo?.image_url ? (
          <img 
            src={photo.image_url} 
            alt={photo.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${scenery.color} flex items-center justify-center`}>
            <span className="text-2xl opacity-60">{scenery.icon}</span>
          </div>
        )}
      </div>
      <div className="p-1 text-center bg-gray-900">
        <p className="text-yellow-400 text-xs font-bold">
          {formatDollarValue(photo?.dollar_value)}
        </p>
      </div>
      
      {/* Streak indicators */}
      {photo?.win_streak >= 3 && (
        <div className="absolute top-1 right-1 px-1 py-0.5 bg-orange-500/90 rounded text-[8px] text-white">
          🔥{photo.win_streak}
        </div>
      )}
    </motion.div>
  );
};

// Player Panel
const PlayerPanel = ({ 
  username, 
  photos, 
  isReady, 
  isCurrentUser, 
  onReady,
  side = 'left' // 'left' or 'right'
}) => {
  const borderColor = side === 'left' ? 'border-purple-500' : 'border-red-500';
  const bgGradient = side === 'left' 
    ? 'from-purple-500/10 to-transparent' 
    : 'from-red-500/10 to-transparent';
  
  return (
    <div className={`flex-1 p-4 rounded-xl border-2 ${isReady ? 'border-green-500' : 'border-gray-700'} bg-gradient-to-b ${bgGradient}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isReady ? 'bg-green-500' : 'bg-gray-500'}`} />
          <h3 className="text-white font-bold">{username || 'Player'}</h3>
          {isCurrentUser && (
            <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-xs rounded">YOU</span>
          )}
        </div>
        {isReady && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-1 px-2 py-1 bg-green-500/20 border border-green-500/50 rounded"
          >
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm font-bold">READY</span>
          </motion.div>
        )}
      </div>
      
      {/* Photos */}
      <div className="flex flex-wrap gap-2 justify-center mb-4">
        {(photos || []).slice(0, 5).map((photo, index) => (
          <MiniPhotoCard key={photo.mint_id || index} photo={photo} index={index} />
        ))}
      </div>
      
      {/* Ready button */}
      {isCurrentUser && !isReady && (
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onReady}
            className="w-full py-4 font-bold bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500"
            size="lg"
            data-testid="ready-btn"
          >
            <Zap className="w-5 h-5 mr-2" />
            Ready to Battle!
          </Button>
        </motion.div>
      )}
      
      {!isCurrentUser && !isReady && (
        <div className="flex items-center justify-center gap-2 py-4 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Waiting for player...</span>
        </div>
      )}
    </div>
  );
};

// Transparent Countdown Overlay
const CountdownOverlay = ({ seconds, onComplete }) => {
  const [count, setCount] = useState(seconds);
  
  useEffect(() => {
    if (count <= 0) {
      onComplete?.();
      return;
    }
    
    const timer = setTimeout(() => {
      setCount(c => c - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [count, onComplete]);
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex items-center justify-center z-40 pointer-events-none"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} // Semi-transparent, not blocking
    >
      <motion.div className="text-center">
        {/* Countdown number */}
        <motion.div
          key={count}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.5, opacity: 0 }}
          className="relative"
        >
          <span className="text-[120px] sm:text-[180px] font-bold text-white drop-shadow-[0_0_50px_rgba(168,85,247,0.8)]">
            {count}
          </span>
        </motion.div>
        
        {/* Pulsing text */}
        <motion.p
          className="text-3xl sm:text-4xl font-bold text-purple-300 mt-4"
          animate={{ 
            opacity: [0.5, 1, 0.5],
            scale: [0.95, 1.05, 0.95],
          }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          Get Ready!
        </motion.p>
      </motion.div>
    </motion.div>
  );
};

// Main Component
export const GameLobby = ({
  game,
  currentUserId,
  onGameStart,
  onLeave,
}) => {
  const [gameState, setGameState] = useState(game);
  const [loading, setLoading] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const intentionalCloseRef = useRef(false);  // Track if close was intentional
  
  // Determine current user's role
  const isCreator = gameState?.creator_id === currentUserId;
  const isOpponent = gameState?.opponent_id === currentUserId;
  
  // Get ready status
  const creatorReady = gameState?.creator_ready;
  const opponentReady = gameState?.opponent_ready;
  const bothReady = creatorReady && opponentReady;
  
  // Get WebSocket URL
  const getWebSocketUrl = useCallback(() => {
    const token = localStorage.getItem('blendlink_token');
    if (!token || !gameState?.game_id) return null;
    
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    // Convert HTTP(S) to WS(S)
    const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = backendUrl.replace(/^https?:\/\//, '');
    
    return `${wsProtocol}://${wsHost}/api/ws/lobby/${gameState.game_id}/${token}`;
  }, [gameState?.game_id]);
  
  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'joined':
          // Connection confirmation from server
          console.log('Lobby WebSocket connected to game:', data.game_id);
          setWsConnected(true);
          break;
          
        case 'player_joined':
          // Update game state with new player
          setGameState(prev => ({
            ...prev,
            opponent_id: data.user_id,
            opponent_username: data.username,
            opponent_photos: data.photos,
            status: 'ready'
          }));
          toast.success(
            `🎮 ${data.username || 'Player'} has joined your game!`,
            { duration: 5000 }
          );
          break;
          
        case 'ready_status_changed':
          // Update ready status instantly
          setGameState(prev => ({
            ...prev,
            creator_ready: data.is_creator ? data.is_ready : prev.creator_ready,
            opponent_ready: !data.is_creator ? data.is_ready : prev.opponent_ready,
          }));
          if (data.user_id !== currentUserId) {
            toast.info(`⚡ ${data.username || 'Player'} is ready!`);
          }
          break;
          
        case 'countdown_start':
          setShowCountdown(true);
          setGameState(prev => ({ ...prev, status: 'starting' }));
          toast.success('🔥 Both players ready! Starting countdown...');
          break;
          
        case 'game_start':
          // Game has started - transition to battle
          console.log('[GameLobby] game_start received:', {
            session_id: data.session_id,
            pvp_room_id: data.pvp_room_id,
            session: data.session,
          });
          onGameStart?.(data.session_id, data.session, data.pvp_room_id);
          break;
          
        case 'pvp_room_created':
          // PVP room created - store for later use
          setGameState(prev => ({ 
            ...prev, 
            pvp_room_id: data.room_id,
            active_session_id: data.session_id,
          }));
          break;
          
        case 'game_state':
          // Full state update
          setGameState(prev => ({ ...prev, ...data.state }));
          break;
          
        case 'player_disconnected':
          toast.warning(`${data.user_id === gameState?.opponent_id ? 'Opponent' : 'Creator'} disconnected`);
          break;
          
        case 'pong':
          // Heartbeat response
          break;
          
        default:
          console.log('Unknown WebSocket message:', data);
      }
    } catch (err) {
      console.error('Failed to parse WebSocket message:', err);
    }
  }, [currentUserId, gameState?.opponent_id, onGameStart]);
  
  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    const wsUrl = getWebSocketUrl();
    if (!wsUrl) return;
    
    // Close existing connection (mark as intentional)
    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
    }
    
    try {
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('Lobby WebSocket connected');
        setWsConnected(true);
        reconnectAttempts.current = 0;
        intentionalCloseRef.current = false;
      };
      
      ws.onmessage = handleWebSocketMessage;
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsConnected(false);
      };
      
      ws.onclose = (event) => {
        console.log('WebSocket closed, code:', event.code, 'intentional:', intentionalCloseRef.current);
        setWsConnected(false);
        
        // Only attempt reconnection if close was NOT intentional
        if (!intentionalCloseRef.current && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
          setTimeout(connectWebSocket, delay);
        }
        intentionalCloseRef.current = false;
      };
      
      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setWsConnected(false);
    }
  }, [getWebSocketUrl, handleWebSocketMessage]);
  
  // Setup WebSocket connection
  useEffect(() => {
    connectWebSocket();
    
    // Heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);  // Send ping every 25 seconds
    
    return () => {
      clearInterval(heartbeat);
      if (wsRef.current) {
        intentionalCloseRef.current = true;  // Mark as intentional cleanup
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);
  
  // Fallback polling - ALWAYS poll to ensure state consistency even with WebSocket issues
  // This is necessary because the Kubernetes ingress may not properly support WebSockets
  useEffect(() => {
    const pollGameState = async () => {
      if (!gameState?.game_id) return;
      
      try {
        const res = await api.get(`/photo-game/open-games/${gameState.game_id}`);
        const newState = res.data;
        
        // Check for state changes (only update if different)
        if (JSON.stringify(newState) !== JSON.stringify(gameState)) {
          setGameState(newState);
          
          // Check if countdown should start
          if (newState.status === 'starting' && !showCountdown) {
            setShowCountdown(true);
            toast.success('🔥 Both players ready! Starting countdown...');
          }
          
          // Check if game started - also get pvp_room_id from state
          if (newState.status === 'in_progress' && newState.active_session_id) {
            // Try to get pvp_room_id from state or make an API call
            const roomId = newState.pvp_room_id || gameState?.pvp_room_id;
            onGameStart?.(newState.active_session_id, newState, roomId);
          }
        }
      } catch (err) {
        console.error('Failed to poll game state:', err);
      }
    };
    
    // Poll every 2 seconds for responsive updates (WebSocket may be unreliable)
    const pollInterval = setInterval(pollGameState, 2000);
    pollGameState(); // Initial poll
    return () => clearInterval(pollInterval);
  }, [gameState, showCountdown, onGameStart]);
  
  // Handle ready
  const handleReady = async () => {
    try {
      setLoading(true);
      await api.post('/photo-game/open-games/ready', { game_id: gameState.game_id });
      
      // Optimistically update local state
      if (isCreator) {
        setGameState(prev => ({ ...prev, creator_ready: true }));
      } else {
        setGameState(prev => ({ ...prev, opponent_ready: true }));
      }
      
      toast.success('You are ready!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to mark ready');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle countdown complete
  const handleCountdownComplete = async () => {
    try {
      // Try to start the game
      const res = await api.post(`/photo-game/open-games/start/${gameState.game_id}`);
      if (res.data.success && res.data.session_id) {
        // CRITICAL: Pass pvp_room_id to onGameStart
        onGameStart?.(res.data.session_id, res.data.session, res.data.pvp_room_id);
      }
    } catch (err) {
      // Might already be started by the other player - WebSocket will handle it
      console.log('Game may have been started by opponent');
    }
  };
  
  return (
    <div className="space-y-6 relative" data-testid="game-lobby">
      {/* Countdown overlay (transparent per spec) */}
      <AnimatePresence>
        {showCountdown && (
          <CountdownOverlay 
            seconds={COUNTDOWN_SECONDS} 
            onComplete={handleCountdownComplete}
          />
        )}
      </AnimatePresence>
      
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
          <Trophy className="w-6 h-6 text-yellow-400" />
          Battle Lobby
          {/* WebSocket status indicator */}
          <span 
            className={`ml-2 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              wsConnected 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-yellow-500/20 text-yellow-400'
            }`}
            title={wsConnected ? 'Real-time connected' : 'Using fallback polling'}
          >
            {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {wsConnected ? 'Live' : 'Sync'}
          </span>
        </h2>
        <p className="text-gray-400 mt-1">
          {bothReady 
            ? 'Both players ready! Starting...' 
            : 'Waiting for both players to be ready'}
        </p>
        
        {/* Bet amount */}
        {gameState?.bet_amount > 0 && (
          <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
            <span className="text-yellow-400 font-bold text-lg">
              💰 {gameState.bet_amount} BL Bet
            </span>
          </div>
        )}
      </div>
      
      {/* Players panels */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Creator panel */}
        <PlayerPanel
          username={gameState?.creator_username}
          photos={gameState?.creator_photos}
          isReady={creatorReady}
          isCurrentUser={isCreator}
          onReady={handleReady}
          side="left"
        />
        
        {/* VS divider */}
        <div className="flex md:flex-col items-center justify-center py-4 md:py-0">
          <motion.div 
            className="text-4xl font-bold text-gray-500"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            VS
          </motion.div>
        </div>
        
        {/* Opponent panel */}
        <PlayerPanel
          username={gameState?.opponent_username}
          photos={gameState?.opponent_photos}
          isReady={opponentReady}
          isCurrentUser={isOpponent}
          onReady={handleReady}
          side="right"
        />
      </div>
      
      {/* Status indicator */}
      <div className="flex justify-center">
        <div className={`px-6 py-3 rounded-full ${
          bothReady 
            ? 'bg-green-500/20 border border-green-500/50' 
            : 'bg-gray-700/50'
        }`}>
          {bothReady ? (
            <span className="text-green-400 font-bold flex items-center gap-2">
              <Check className="w-5 h-5" />
              Both players ready! Game starting...
            </span>
          ) : (
            <span className="text-gray-400 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Waiting for {!creatorReady && !opponentReady ? 'both players' : (creatorReady ? 'opponent' : 'creator')} to ready up
            </span>
          )}
        </div>
      </div>
      
      {/* Leave button */}
      <div className="flex justify-center">
        <Button
          onClick={onLeave}
          variant="outline"
          className="border-red-500/50 text-red-400 hover:bg-red-500/10"
        >
          <X className="w-4 h-4 mr-2" />
          Leave Lobby
        </Button>
      </div>
    </div>
  );
};

export default GameLobby;
