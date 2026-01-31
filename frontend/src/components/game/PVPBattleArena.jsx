/**
 * PVPBattleArena Component
 * 
 * Real-time synchronized PVP gameplay with:
 * - Per-round photo selection
 * - Ready button BEFORE every round
 * - WebSocket-synced countdown
 * - Proper opponent photo display
 * - Disconnect handling
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, Wifi, WifiOff, X, RefreshCw, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { PVPRoundReady } from './PVPRoundReady';
import { TappingArena } from './TappingArena';
import { RPSBidding } from './RPSBidding';
import MedalCelebration from '../MedalCelebration';
import api from '../../services/api';

// Constants
const STARTING_RPS_MONEY = 5_000_000;
const WINS_NEEDED = 3;

// Round types
const ROUND_TYPES = ['auction', 'rps', 'auction', 'rps', 'auction'];

// Format dollar value
const formatDollarValue = (value) => {
  if (!value) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value?.toLocaleString()}`;
};

// Game Result Screen
const GameResultScreen = ({ winner, player1Wins, player2Wins, betAmount, onPlayAgain, onExit }) => {
  const isWinner = winner === 'player1';
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-b from-gray-800/50 to-gray-900/50 rounded-2xl p-8 border border-gray-700/50 text-center"
    >
      <div className="relative z-10">
        {isWinner ? (
          <>
            <motion.div
              animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, repeat: 5 }}
              className="text-8xl mb-4"
            >
              🏆
            </motion.div>
            <h2 className="text-4xl font-bold text-green-400 mb-4">Victory!</h2>
            <p className="text-gray-400 mb-2">You won {player1Wins} - {player2Wins}</p>
            {betAmount > 0 && (
              <motion.p className="text-yellow-400 text-2xl mb-6" animate={{ scale: [1, 1.2, 1] }}>
                +{betAmount * 2} BL Coins 💰
              </motion.p>
            )}
          </>
        ) : (
          <>
            <div className="text-8xl mb-4">😢</div>
            <h2 className="text-4xl font-bold text-red-400 mb-4">Defeat</h2>
            <p className="text-gray-400 mb-2">You lost {player1Wins} - {player2Wins}</p>
            {betAmount > 0 && (
              <p className="text-gray-400 text-2xl mb-6">-{betAmount} BL Coins</p>
            )}
          </>
        )}
        
        <div className="flex gap-4 justify-center">
          <Button onClick={onPlayAgain} className="bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 px-8 py-4">
            <RefreshCw className="w-5 h-5 mr-2" /> Play Again
          </Button>
          <Button onClick={onExit} variant="outline" className="border-gray-600">
            <X className="w-5 h-5 mr-2" /> Exit
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

// Main Component
export const PVPBattleArena = ({
  gameId,
  session,
  currentUserId,
  currentUsername,
  playerPhotos,  // Current user's 5 photos
  opponentPhotos, // Opponent's 5 photos
  opponentId,
  opponentUsername,
  betAmount = 0,
  pvpRoomId: propPvpRoomId,
  onGameComplete,
  onExit,
}) => {
  // CRITICAL: Resolve pvpRoomId from props OR session for robustness
  // This handles the case where the prop might be stale/undefined on initial render
  const pvpRoomId = propPvpRoomId || session?.pvp_room_id || session?.active_session_id || gameId;
  
  // Log props on mount and when they change
  useEffect(() => {
    console.log('[PVPBattleArena] Props received:', {
      gameId,
      propPvpRoomId,
      resolvedPvpRoomId: pvpRoomId,
      currentUserId,
      opponentId,
      hasSession: !!session,
      sessionPvpRoomId: session?.pvp_room_id,
    });
  }, [gameId, propPvpRoomId, pvpRoomId, currentUserId, opponentId, session]);
  
  // WebSocket connection
  const wsRef = useRef(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttemptCount, setReconnectAttemptCount] = useState(0);
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_INTERVAL = 5000; // 5 seconds
  
  // Toast spam prevention
  const lastToastTimeRef = useRef(0);
  const MIN_TOAST_INTERVAL = 5000; // 5 seconds between toasts
  
  const showToastThrottled = useCallback((type, message) => {
    const now = Date.now();
    if (now - lastToastTimeRef.current > MIN_TOAST_INTERVAL) {
      lastToastTimeRef.current = now;
      if (type === 'error') toast.error(message);
      else if (type === 'success') toast.success(message);
      else if (type === 'info') toast.info(message);
      else toast(message);
    }
  }, []);
  
  // Websocket instance for passing to children (synced from ref)
  const [websocketInstance, setWebsocketInstance] = useState(null);
  
  // Selection timeout
  const [selectionTimeRemaining, setSelectionTimeRemaining] = useState(30);
  
  // Game state
  const [gamePhase, setGamePhase] = useState('ready'); // ready, playing, result
  const [currentRound, setCurrentRound] = useState(1);
  const [roundType, setRoundType] = useState('auction');
  
  // Scores
  const [player1Wins, setPlayer1Wins] = useState(0);
  const [player2Wins, setPlayer2Wins] = useState(0);
  
  // Photo selections
  const [mySelectedPhoto, setMySelectedPhoto] = useState(null);
  const [opponentSelectedPhoto, setOpponentSelectedPhoto] = useState(null);
  const [opponentHasSelected, setOpponentHasSelected] = useState(false);
  const [usedPhotoIds, setUsedPhotoIds] = useState([]);
  
  // Ready states
  const [myReady, setMyReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  
  // RPS money
  const [playerRPSMoney, setPlayerRPSMoney] = useState(STARTING_RPS_MONEY);
  const [opponentRPSMoney, setOpponentRPSMoney] = useState(STARTING_RPS_MONEY);
  
  // Stats for streak calculations
  const [playerStats, setPlayerStats] = useState({ current_win_streak: 0, current_lose_streak: 0 });
  const [opponentStats, setOpponentStats] = useState({ current_win_streak: 0, current_lose_streak: 0 });
  
  // Game winner
  const [gameWinner, setGameWinner] = useState(null);
  
  // Medal celebration
  const [showMedalCelebration, setShowMedalCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState(null);
  
  // Determine if we're player1 (creator) or player2 (joiner)
  const isPlayer1 = session?.player1_id === currentUserId;
  
  // Get WebSocket URL
  const getWebSocketUrl = useCallback(() => {
    if (!pvpRoomId) return null;
    
    const token = localStorage.getItem('blendlink_token');
    if (!token) return null;
    
    const backendUrl = process.env.REACT_APP_BACKEND_URL || '';
    const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws';
    const wsHost = backendUrl.replace(/^https?:\/\//, '');
    
    return `${wsProtocol}://${wsHost}/api/ws/pvp-game/${pvpRoomId}/${token}`;
  }, [pvpRoomId]);
  
  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('PVP WS message:', data.type, data);
      
      switch (data.type) {
        case 'connected':
          // Initial connection confirmation from server
          console.log('PVP WebSocket connected to room:', data.room_id);
          setWsConnected(true);
          setReconnecting(false);
          reconnectAttempts.current = 0;
          setReconnectAttemptCount(0);
          break;
        
        case 'join_result':
          if (data.success) {
            toast.success('Connected to game room');
            setReconnecting(false);
            reconnectAttempts.current = 0;
          } else {
            // Use throttled toast to avoid spam
            showToastThrottled('error', 'Failed to join game room - retrying...');
          }
          break;
        
        case 'reconnect_result':
          if (data.success) {
            toast.success('Reconnected to game');
            setReconnecting(false);
            reconnectAttempts.current = 0;
          }
          break;
        
        case 'reconnect_state':
          // Restore game state after reconnection
          setCurrentRound(data.current_round || 1);
          setRoundType(data.round_type || ROUND_TYPES[(data.current_round || 1) - 1]);
          setPlayer1Wins(data.player1_wins || 0);
          setPlayer2Wins(data.player2_wins || 0);
          
          // Restore selection states
          const myState = isPlayer1 ? data.player1 : data.player2;
          const oppState = isPlayer1 ? data.player2 : data.player1;
          
          if (myState?.selected_photo) {
            setMySelectedPhoto(myState.selected_photo);
          }
          if (oppState?.selected_photo) {
            setOpponentSelectedPhoto(oppState.selected_photo);
          }
          setOpponentHasSelected(oppState?.has_selected || false);
          setMyReady(myState?.is_ready || false);
          setOpponentReady(oppState?.is_ready || false);
          
          // Set correct phase based on round_phase
          if (data.round_phase === 'playing') {
            setGamePhase('playing');
          } else if (data.round_phase === 'result') {
            setGamePhase('result');
          } else {
            setGamePhase('ready');
          }
          break;
          
        case 'player_connected':
          toast.success(`${data.username} connected`);
          break;
        
        case 'player_reconnected':
          toast.success(`${data.username} reconnected`);
          break;
          
        case 'player_disconnected':
          toast.warning(`${data.user_id === opponentId ? 'Opponent' : 'Player'} disconnected`);
          break;
          
        case 'game_forfeit':
          setGameWinner(data.winner_id === currentUserId ? 'player1' : 'player2');
          setGamePhase('result');
          toast.info(`Game ended - ${data.reason}`);
          break;
          
        case 'round_selecting':
        case 'game_state':
          setCurrentRound(data.round || data.current_round || 1);
          setRoundType(data.round_type || ROUND_TYPES[(data.round || 1) - 1]);
          setPlayer1Wins(data.player1_wins || data.player1_score || 0);
          setPlayer2Wins(data.player2_wins || data.player2_score || 0);
          setGamePhase('ready');
          // Reset ready states for new round
          setMyReady(false);
          setOpponentReady(false);
          setMySelectedPhoto(null);
          setOpponentSelectedPhoto(null);
          setOpponentHasSelected(false);
          setSelectionTimeRemaining(30);
          break;
        
        case 'selection_timeout_tick':
          // Update countdown timer
          setSelectionTimeRemaining(data.seconds_remaining);
          // Update opponent selection status
          const oppSelected = isPlayer1 ? data.player2_selected : data.player1_selected;
          setOpponentHasSelected(oppSelected);
          break;
          
        case 'player_selected_photo':
          if (data.user_id !== currentUserId) {
            setOpponentHasSelected(true);
            toast.info(`${opponentUsername || 'Opponent'} selected their photo`);
          }
          break;
          
        case 'photo_selection_confirmed':
          // Our selection confirmed
          break;
          
        case 'round_ready':
          // Both selected - show photos and ready buttons
          if (data.player1_photo && data.player2_photo) {
            if (isPlayer1) {
              setMySelectedPhoto(data.player1_photo);
              setOpponentSelectedPhoto(data.player2_photo);
            } else {
              setMySelectedPhoto(data.player2_photo);
              setOpponentSelectedPhoto(data.player1_photo);
            }
          }
          break;
          
        case 'player_ready':
          if (data.user_id === currentUserId) {
            setMyReady(true);
          } else {
            setOpponentReady(true);
            toast.info(`${opponentUsername || 'Opponent'} is ready!`);
          }
          break;
          
        case 'countdown_start':
          toast.success('🔥 Both ready! Starting countdown...');
          break;
          
        case 'round_start':
          // Transition to playing phase with correct photos
          const myPhoto = isPlayer1 ? data.player1?.photo : data.player2?.photo;
          const oppPhoto = isPlayer1 ? data.player2?.photo : data.player1?.photo;
          
          setMySelectedPhoto(myPhoto);
          setOpponentSelectedPhoto(oppPhoto);
          setGamePhase('playing');
          break;
          
        case 'round_result':
          // Round ended
          setPlayer1Wins(data.player1_wins);
          setPlayer2Wins(data.player2_wins);
          
          // Add used photos
          if (mySelectedPhoto?.mint_id) {
            setUsedPhotoIds(prev => [...prev, mySelectedPhoto.mint_id]);
          }
          break;
          
        case 'game_end':
          setGameWinner(data.winner_user_id === currentUserId ? 'player1' : 'player2');
          setPlayer1Wins(data.player1_wins);
          setPlayer2Wins(data.player2_wins);
          setGamePhase('result');
          break;
          
        case 'auto_selected':
          if (data.user_id === currentUserId) {
            toast.warning('Time ran out - photo auto-selected');
          }
          break;
          
        case 'auto_ready':
          if (data.user_id === currentUserId) {
            toast.warning('Auto-readied due to timeout');
          }
          break;
          
        case 'pong':
          // Connection is alive - update last pong time (ref is defined below)
          break;
          
        default:
          console.log('Unknown PVP message:', data);
      }
    } catch (err) {
      console.error('Failed to parse PVP WebSocket message:', err);
    }
  }, [currentUserId, opponentId, opponentUsername, isPlayer1, mySelectedPhoto, showToastThrottled]);
  
  // Connect to WebSocket ref to avoid circular dependency
  const connectWebSocketRef = useRef(null);
  
  // Track last pong time for connection health monitoring
  const lastPongTimeRef = useRef(0);
  
  // Initialize lastPongTime on mount
  useEffect(() => {
    lastPongTimeRef.current = Date.now();
  }, []);
  
  // Connect to WebSocket
  const connectWebSocket = useCallback((isReconnect = false) => {
    const wsUrl = getWebSocketUrl();
    if (!wsUrl) {
      // Don't show error toast during initial load - just log and wait
      console.log('WebSocket URL not ready yet - waiting for pvpRoomId');
      // Only show toast if this is a manual reconnect attempt (throttled)
      if (isReconnect) {
        showToastThrottled('info', 'Waiting for room...');
      }
      setReconnecting(false);
      return;
    }
    
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Update attempt count BEFORE connecting so UI shows current attempt
    if (isReconnect) {
      reconnectAttempts.current++;
      setReconnectAttemptCount(reconnectAttempts.current);
      console.log(`Reconnect attempt ${reconnectAttempts.current}/${MAX_RECONNECT_ATTEMPTS}`);
    }
    
    // Close existing connection if any
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }
    
    try {
      console.log(`${isReconnect ? 'Reconnecting' : 'Connecting'} to PVP WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      
      // Connection timeout - if websocket doesn't open within 10 seconds, retry
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log('WebSocket connection timeout - closing');
          ws.close();
        }
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('PVP WebSocket connected successfully');
        setWsConnected(true);
        setReconnecting(false);
        setWebsocketInstance(ws);
        reconnectAttempts.current = 0;
        setReconnectAttemptCount(0);
        
        if (isReconnect) {
          // Send reconnect message to restore state
          ws.send(JSON.stringify({
            type: 'reconnect',
          }));
          toast.success('Reconnected to game!');
        } else {
          // Join the room
          ws.send(JSON.stringify({
            type: 'join',
            username: currentUsername,
            photos: playerPhotos,
            is_creator: isPlayer1,
          }));
        }
      };
      
      ws.onmessage = (event) => {
        // Update last pong time on any message (indicates connection is alive)
        lastPongTimeRef.current = Date.now();
        handleWebSocketMessage(event);
      };
      
      ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('PVP WebSocket error:', error);
        setWsConnected(false);
        setWebsocketInstance(null);
      };
      
      ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.log('PVP WebSocket closed:', event.code, event.reason);
        setWsConnected(false);
        setWebsocketInstance(null);
        
        // Schedule reconnect if game is still in progress
        if (gamePhase !== 'result' && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          setReconnecting(true);
          
          const delay = RECONNECT_INTERVAL;
          console.log(`Scheduling reconnect in ${delay}ms`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            // Use ref to call the latest version
            if (connectWebSocketRef.current) {
              connectWebSocketRef.current(true);
            }
          }, delay);
        } else if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          toast.error('Connection lost after 5 attempts. Please rejoin or create a new game.');
          setReconnecting(false);
        }
      };
      
      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create PVP WebSocket:', err);
      setWsConnected(false);
      setReconnecting(false);
      toast.error('Failed to connect to game server');
    }
  }, [getWebSocketUrl, handleWebSocketMessage, currentUsername, playerPhotos, isPlayer1, gamePhase, showToastThrottled]);
  
  // Keep ref updated
  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);
  
  // Manual reconnect function
  const handleManualReconnect = useCallback(() => {
    if (wsConnected) return;
    
    // Reset attempts for manual reconnect
    reconnectAttempts.current = 0;
    setReconnectAttemptCount(0);
    setReconnecting(true);
    toast.info('Reconnecting to game...');
    connectWebSocket(true);
  }, [connectWebSocket, wsConnected]);
  
  // Track if already connected on mount
  const hasConnectedRef = useRef(false);
  
  // Connect when pvpRoomId becomes available AND we have photos
  useEffect(() => {
    console.log('[PVPBattleArena] Effect check - pvpRoomId:', pvpRoomId, 'hasConnected:', hasConnectedRef.current, 'wsConnected:', wsConnected, 'photosCount:', playerPhotos?.length);
    
    // Only connect once when pvpRoomId is available AND we have photos to play with
    if (pvpRoomId && playerPhotos?.length > 0 && !hasConnectedRef.current && !wsConnected) {
      hasConnectedRef.current = true;
      console.log('[PVPBattleArena] pvpRoomId available, connecting:', pvpRoomId, 'with', playerPhotos.length, 'photos');
      // Defer connection slightly to ensure state is ready
      const timeoutId = setTimeout(() => {
        connectWebSocketRef.current?.(false);
      }, 200); // Increased from 100ms to 200ms for more reliability
      return () => clearTimeout(timeoutId);
    }
  }, [pvpRoomId, wsConnected, playerPhotos?.length]); // Re-run when pvpRoomId or photos change
  
  // Reset connection state if pvpRoomId changes (e.g., new game)
  useEffect(() => {
    if (!pvpRoomId) {
      hasConnectedRef.current = false;
    }
  }, [pvpRoomId]);
  
  // Heartbeat effect with connection health monitoring
  useEffect(() => {
    // Don't start heartbeat until connected
    if (!pvpRoomId) return;
    
    // Heartbeat - every 10 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
        
        // Check if we haven't received a pong in too long (30 seconds)
        const timeSinceLastPong = Date.now() - lastPongTimeRef.current;
        if (timeSinceLastPong > 30000 && wsConnected) {
          console.log('Connection appears stale - no pong in 30s, forcing reconnect');
          wsRef.current.close();
        }
      } else if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        // Still connecting, wait
        console.log('WebSocket still connecting...');
      } else if (!wsConnected && !reconnecting && gamePhase !== 'result') {
        // Not connected and not reconnecting - trigger reconnect
        console.log('WebSocket not open and not reconnecting - triggering reconnect');
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          connectWebSocketRef.current?.(true);
        }
      }
    }, 10000); // Every 10 seconds
    
    return () => {
      clearInterval(heartbeat);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [wsConnected, reconnecting, gamePhase, pvpRoomId]);
  
  // Handle visibility change (tab switch, app background)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !wsConnected && gamePhase !== 'result') {
        console.log('Tab became visible, checking connection...');
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          reconnectAttempts.current = 0;
          setReconnectAttemptCount(0);
          connectWebSocketRef.current?.(true);
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [wsConnected, gamePhase]);
  
  // Handle photo selection
  const handlePhotoSelect = useCallback((photo) => {
    setMySelectedPhoto(photo);
  }, []);
  
  // Handle ready
  const handleReady = useCallback(() => {
    setMyReady(true);
  }, []);
  
  // Handle round start (from PVPRoundReady)
  const handleRoundStart = useCallback((data) => {
    const myPhoto = isPlayer1 ? data.player1?.photo : data.player2?.photo;
    const oppPhoto = isPlayer1 ? data.player2?.photo : data.player1?.photo;
    
    setMySelectedPhoto(myPhoto);
    setOpponentSelectedPhoto(oppPhoto);
    setGamePhase('playing');
  }, [isPlayer1]);
  
  // Handle round completion (from TappingArena or RPSBidding)
  const handleRoundComplete = useCallback(async (winner) => {
    // Record round result for medal tracking
    if (mySelectedPhoto?.mint_id) {
      try {
        const res = await api.post('/photo-game/record-round-result', {
          photo_id: mySelectedPhoto.mint_id,
          round_won: winner === 'player',
        });
        
        if (res.data.medal_earned) {
          setCelebrationData({
            photoName: mySelectedPhoto.name || 'Your Photo',
            totalMedals: res.data.total_medals || 1,
            bonusCoins: res.data.bonus_coins || 10000,
          });
          setShowMedalCelebration(true);
        }
      } catch (err) {
        console.error('Failed to record round result:', err);
      }
    }
    
    // Send result to WebSocket for sync
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const winnerUserId = winner === 'player' ? currentUserId : opponentId;
      
      wsRef.current.send(JSON.stringify({
        type: 'round_result',
        winner_user_id: winnerUserId,
        player1_score: isPlayer1 ? (winner === 'player' ? player1Wins + 1 : player1Wins) : (winner === 'player' ? player1Wins : player1Wins + 1),
        player2_score: isPlayer1 ? (winner === 'player' ? player2Wins : player2Wins + 1) : (winner === 'player' ? player2Wins + 1 : player2Wins),
        round_data: {
          round: currentRound,
          type: roundType,
          winner,
        },
      }));
    }
    
    // Update local scores
    if (winner === 'player') {
      const newWins = (isPlayer1 ? player1Wins : player2Wins) + 1;
      if (isPlayer1) {
        setPlayer1Wins(newWins);
      } else {
        setPlayer2Wins(newWins);
      }
      
      // Check for game win
      if (newWins >= WINS_NEEDED) {
        setGameWinner('player1');
        setGamePhase('result');
        return;
      }
    } else {
      const newWins = (isPlayer1 ? player2Wins : player1Wins) + 1;
      if (isPlayer1) {
        setPlayer2Wins(newWins);
      } else {
        setPlayer1Wins(newWins);
      }
      
      // Check for game loss
      if (newWins >= WINS_NEEDED) {
        setGameWinner('player2');
        setGamePhase('result');
        return;
      }
    }
    
    // Add used photo
    if (mySelectedPhoto?.mint_id) {
      setUsedPhotoIds(prev => [...prev, mySelectedPhoto.mint_id]);
    }
    
    // Move to next round (WebSocket will trigger the transition)
  }, [mySelectedPhoto, currentUserId, opponentId, isPlayer1, player1Wins, player2Wins, currentRound, roundType]);
  
  // Handle RPS round complete
  const handleRPSRoundComplete = useCallback((winner, newPlayerMoney, newOpponentMoney) => {
    setPlayerRPSMoney(newPlayerMoney);
    setOpponentRPSMoney(newOpponentMoney);
    handleRoundComplete(winner);
  }, [handleRoundComplete]);
  
  // Handle play again
  const handlePlayAgain = useCallback(() => {
    onGameComplete?.(gameWinner);
  }, [gameWinner, onGameComplete]);
  
  // Build player data for PVPRoundReady
  const player1Data = {
    userId: session?.player1_id,
    username: isPlayer1 ? currentUsername : opponentUsername,
    photos: isPlayer1 ? playerPhotos : opponentPhotos,
    selectedPhotoId: isPlayer1 ? mySelectedPhoto?.mint_id : opponentSelectedPhoto?.mint_id,
    selectedPhoto: isPlayer1 ? mySelectedPhoto : opponentSelectedPhoto,
    isReady: isPlayer1 ? myReady : opponentReady,
  };
  
  const player2Data = {
    userId: session?.player2_id,
    username: isPlayer1 ? opponentUsername : currentUsername,
    photos: isPlayer1 ? opponentPhotos : playerPhotos,
    selectedPhotoId: isPlayer1 ? opponentSelectedPhoto?.mint_id : mySelectedPhoto?.mint_id,
    selectedPhoto: isPlayer1 ? opponentSelectedPhoto : mySelectedPhoto,
    isReady: isPlayer1 ? opponentReady : myReady,
  };
  
  return (
    <div className="min-h-[70vh]" data-testid="pvp-battle-arena">
      {/* Connection status header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          <span className="text-white font-bold">{opponentUsername || 'Opponent'}</span>
        </div>
        <div className="flex items-center gap-2">
          {reconnecting && (
            <span className="text-xs text-yellow-400">
              Attempt {reconnectAttemptCount}/{MAX_RECONNECT_ATTEMPTS}
            </span>
          )}
          <button 
            onClick={handleManualReconnect}
            disabled={wsConnected}
            className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full transition-colors ${
              wsConnected 
                ? 'bg-green-500/20 text-green-400 cursor-default' 
                : reconnecting
                  ? 'bg-yellow-500/20 text-yellow-400 animate-pulse'
                  : 'bg-red-500/20 text-red-400 hover:bg-red-500/30 cursor-pointer'
            }`}
          >
            {wsConnected ? (
              <>
                <Wifi className="w-3 h-3" />
                <span>Synced ✅</span>
              </>
            ) : !pvpRoomId ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Initializing...</span>
              </>
            ) : reconnecting ? (
              <>
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Reconnecting...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3" />
                <span>Tap to reconnect</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      <AnimatePresence mode="wait">
        {/* Ready phase - photo selection and ready buttons */}
        {gamePhase === 'ready' && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <PVPRoundReady
              websocket={websocketInstance}
              currentUserId={currentUserId}
              currentRound={currentRound}
              roundType={roundType}
              player1={player1Data}
              player2={player2Data}
              player1Wins={player1Wins}
              player2Wins={player2Wins}
              usedPhotoIds={usedPhotoIds}
              selectionTimeRemaining={selectionTimeRemaining}
              opponentHasSelected={opponentHasSelected}
              onRoundStart={handleRoundStart}
              onPhotoSelect={handlePhotoSelect}
              onReady={handleReady}
            />
          </motion.div>
        )}
        
        {/* Playing phase - Tapping Arena */}
        {gamePhase === 'playing' && roundType === 'auction' && (
          <motion.div
            key={`auction-${currentRound}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <TappingArena
              playerPhoto={mySelectedPhoto}
              opponentPhoto={opponentSelectedPhoto}
              playerStats={playerStats}
              opponentStats={opponentStats}
              roundNumber={currentRound}
              onRoundComplete={handleRoundComplete}
              websocket={websocketInstance}
              isBot={false}
              soundEnabled={true}
            />
          </motion.div>
        )}
        
        {/* Playing phase - RPS Bidding */}
        {gamePhase === 'playing' && roundType === 'rps' && (
          <motion.div
            key={`rps-${currentRound}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <RPSBidding
              roundNumber={currentRound}
              playerMoney={playerRPSMoney}
              opponentMoney={opponentRPSMoney}
              playerWins={isPlayer1 ? player1Wins : player2Wins}
              opponentWins={isPlayer1 ? player2Wins : player1Wins}
              onRoundComplete={handleRPSRoundComplete}
              isBot={false}
              soundEnabled={true}
              playerPhoto={mySelectedPhoto}
              opponentPhoto={opponentSelectedPhoto}
            />
          </motion.div>
        )}
        
        {/* Game Result */}
        {gamePhase === 'result' && gameWinner && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <GameResultScreen
              winner={gameWinner}
              player1Wins={isPlayer1 ? player1Wins : player2Wins}
              player2Wins={isPlayer1 ? player2Wins : player1Wins}
              betAmount={betAmount}
              onPlayAgain={handlePlayAgain}
              onExit={onExit}
            />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Medal Celebration */}
      <MedalCelebration
        isVisible={showMedalCelebration}
        photoName={celebrationData?.photoName || 'Photo'}
        totalMedals={celebrationData?.totalMedals || 1}
        bonusCoins={celebrationData?.bonusCoins || 10000}
        onComplete={() => setShowMedalCelebration(false)}
      />
    </div>
  );
};

export default PVPBattleArena;
