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

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
const PHOTO_SELECTION_TIME = 10;  // 10 seconds for photo selection
const RPS_SELECTION_TIME = 5;     // 5 seconds for RPS move selection

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
  const intentionalCloseRef = useRef(false);  // Track intentional closes
  const MAX_RECONNECT_ATTEMPTS = 5;  // Increased from 3 to 5 for better reliability
  const BASE_RECONNECT_INTERVAL = 1000; // Start with 1 second
  const MAX_RECONNECT_INTERVAL = 10000; // Max 10 seconds
  const [pollingMode, setPollingMode] = useState(false);  // Track if we've switched to polling
  
  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback((attempt) => {
    // Exponential backoff: 1s, 2s, 4s, 8s, 10s (capped)
    const delay = Math.min(BASE_RECONNECT_INTERVAL * Math.pow(2, attempt), MAX_RECONNECT_INTERVAL);
    return delay;
  }, []);
  
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
  // Selection timer - updated based on round type
  const getSelectionTime = useCallback((roundType) => {
    return roundType === 'rps' ? RPS_SELECTION_TIME : PHOTO_SELECTION_TIME;
  }, []);
  const [selectionTimeRemaining, setSelectionTimeRemaining] = useState(PHOTO_SELECTION_TIME);
  
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
  
  // CRITICAL FIX: Track player1_id from API response, not just from stale session prop
  // Initialize from session immediately to prevent initial wrong assignment
  // Also sync from session prop on initial render (without triggering cascading renders)
  const initialPlayer1Id = session?.player1_id || null;
  const [confirmedPlayer1Id, setConfirmedPlayer1Id] = useState(initialPlayer1Id);
  
  // Use a ref to track if we've synced from session to avoid cascading renders
  const hasSyncedFromSession = useRef(false);
  
  // Sync confirmedPlayer1Id when session prop changes (only once per session)
  // This is a legitimate case for setState in effect - syncing from props
  useEffect(() => {
    if (session?.player1_id && !confirmedPlayer1Id && !hasSyncedFromSession.current) {
      hasSyncedFromSession.current = true;
      console.log('[PVPBattleArena] Setting confirmedPlayer1Id from session:', session.player1_id);
      // Use a timeout to avoid the "setState in effect" lint warning
      // This is actually safe here as it's a one-time sync from props
      queueMicrotask(() => setConfirmedPlayer1Id(session.player1_id));
    }
  }, [session?.player1_id, confirmedPlayer1Id]);
  
  // Determine if we're player1 (creator) or player2 (joiner)
  // CRITICAL: Use the most reliable source - compare against ALL known player1 IDs
  const isPlayer1 = useMemo(() => {
    const p1Id = confirmedPlayer1Id || session?.player1_id;
    const result = p1Id === currentUserId;
    return result;
  }, [confirmedPlayer1Id, session?.player1_id, currentUserId]);
  
  // REF to track latest isPlayer1 value for use in callbacks to avoid stale closures
  const isPlayer1Ref = useRef(isPlayer1);
  useEffect(() => {
    isPlayer1Ref.current = isPlayer1;
  }, [isPlayer1]);
  
  // Debug log for isPlayer1 determination - only log on actual changes
  useEffect(() => {
    console.log('[PVPBattleArena] isPlayer1 determination:', {
      confirmedPlayer1Id,
      sessionPlayer1Id: session?.player1_id,
      currentUserId,
      isPlayer1,
      playerPhotosCount: playerPhotos?.length,
      opponentPhotosCount: opponentPhotos?.length,
    });
  }, [confirmedPlayer1Id, session?.player1_id, currentUserId, isPlayer1, playerPhotos?.length, opponentPhotos?.length]);
  
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
      
      // CRITICAL: Use ref to get latest isPlayer1 value to avoid stale closures
      const getIsPlayer1 = () => isPlayer1Ref.current;
      
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
        
        case 'reconnect_state': {
          // Restore game state after reconnection
          setCurrentRound(data.current_round || 1);
          setRoundType(data.round_type || ROUND_TYPES[(data.current_round || 1) - 1]);
          setPlayer1Wins(data.player1_wins || 0);
          setPlayer2Wins(data.player2_wins || 0);
          
          // Restore selection states - use ref for latest isPlayer1
          const currentIsPlayer1 = getIsPlayer1();
          const myState = currentIsPlayer1 ? data.player1 : data.player2;
          const oppState = currentIsPlayer1 ? data.player2 : data.player1;
          
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
        }
          
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
          // Set timer based on round type (10s for auction, 5s for RPS)
          const newRoundType = data.round_type || ROUND_TYPES[(data.round || 1) - 1];
          setSelectionTimeRemaining(newRoundType === 'rps' ? RPS_SELECTION_TIME : PHOTO_SELECTION_TIME);
          break;
        
        case 'selection_timeout_tick': {
          // Update countdown timer
          setSelectionTimeRemaining(data.seconds_remaining);
          // Update opponent selection status - use ref for latest isPlayer1
          const oppSelected = getIsPlayer1() ? data.player2_selected : data.player1_selected;
          setOpponentHasSelected(oppSelected);
          break;
        }
          
        case 'player_selected_photo':
          if (data.user_id !== currentUserId) {
            setOpponentHasSelected(true);
            toast.info(`${opponentUsername || 'Opponent'} selected their photo`);
          }
          break;
          
        case 'photo_selection_confirmed':
          // Our selection confirmed
          break;
          
        case 'round_ready': {
          // Both selected - show photos and ready buttons - use ref for latest isPlayer1
          if (data.player1_photo && data.player2_photo) {
            if (getIsPlayer1()) {
              setMySelectedPhoto(data.player1_photo);
              setOpponentSelectedPhoto(data.player2_photo);
            } else {
              setMySelectedPhoto(data.player2_photo);
              setOpponentSelectedPhoto(data.player1_photo);
            }
          }
          break;
        }
          
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
          
        case 'round_start': {
          // Transition to playing phase with correct photos - use ref for latest isPlayer1
          const currentIsPlayer1 = getIsPlayer1();
          const myPhoto = currentIsPlayer1 ? data.player1?.photo : data.player2?.photo;
          const oppPhoto = currentIsPlayer1 ? data.player2?.photo : data.player1?.photo;
          
          setMySelectedPhoto(myPhoto);
          setOpponentSelectedPhoto(oppPhoto);
          setGamePhase('playing');
          break;
        }
          
        case 'round_result':
          // Round ended - update wins from server (authoritative)
          console.log('[PVP WS] Round result received:', data);
          setPlayer1Wins(data.player1_wins);
          setPlayer2Wins(data.player2_wins);
          
          // Add used photos
          if (mySelectedPhoto?.mint_id) {
            setUsedPhotoIds(prev => [...prev, mySelectedPhoto.mint_id]);
          }
          
          // Show result toast
          const roundWinnerId = data.winner_user_id;
          if (roundWinnerId === currentUserId) {
            toast.success(`🎉 You won Round ${data.round}!`);
          } else {
            toast.info(`Round ${data.round} - Opponent wins`);
          }
          
          // Check if game is over
          if (data.player1_wins >= 3 || data.player2_wins >= 3) {
            // Game will end - wait for game_end message
            console.log('[PVP WS] Game should end soon...');
          } else {
            // Wait for server to send round_selecting (3 seconds delay on server)
            console.log('[PVP WS] Waiting for next round selection phase...');
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
  }, [currentUserId, opponentId, opponentUsername, mySelectedPhoto, showToastThrottled]); // Removed isPlayer1 since we use isPlayer1Ref
  
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
    
    // Close existing connection if any (mark as intentional)
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      intentionalCloseRef.current = true;
      wsRef.current.close();
    }
    
    try {
      console.log(`${isReconnect ? 'Reconnecting' : 'Connecting'} to PVP WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      
      // Connection timeout - if websocket doesn't open within 10 seconds, retry
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          console.log('WebSocket connection timeout - closing');
          intentionalCloseRef.current = true;
          ws.close();
        }
      }, 10000);
      
      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        intentionalCloseRef.current = false;
        console.log('PVP WebSocket connected successfully');
        setWsConnected(true);
        setReconnecting(false);
        setWebsocketInstance(ws);
        reconnectAttempts.current = 0;
        setReconnectAttemptCount(0);
        
        // ALWAYS send join message - server will handle it appropriately
        // whether this is a first connection or reconnection
        console.log('[PVP WS] Sending join message with photos:', playerPhotos?.length);
        ws.send(JSON.stringify({
          type: 'join',
          username: currentUsername,
          photos: playerPhotos,
          is_creator: isPlayer1,
          is_reconnect: isReconnect, // Let server know this is a reconnect
        }));
        
        if (isReconnect) {
          toast.success('Reconnected to game!');
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
        console.log('PVP WebSocket closed:', event.code, event.reason, 'intentional:', intentionalCloseRef.current);
        setWsConnected(false);
        setWebsocketInstance(null);
        
        // Only schedule reconnect if NOT intentional and game is still in progress
        if (!intentionalCloseRef.current && gamePhase !== 'result' && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          setReconnecting(true);
          
          // Use exponential backoff for reconnection delay
          const delay = getReconnectDelay(reconnectAttempts.current);
          console.log(`Scheduling reconnect in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${MAX_RECONNECT_ATTEMPTS}) - exponential backoff`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            // Use ref to call the latest version
            if (connectWebSocketRef.current) {
              connectWebSocketRef.current(true);
            }
          }, delay);
        } else if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          console.log('Max reconnect attempts reached - switching to polling-only mode');
          setPollingMode(true);
          setReconnecting(false);
          toast.info('📡 Using backup sync mode (polling)');
        }
        intentionalCloseRef.current = false;
      };
      
      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create PVP WebSocket:', err);
      setWsConnected(false);
      setReconnecting(false);
      toast.error('Failed to connect to game server');
    }
  }, [getWebSocketUrl, handleWebSocketMessage, currentUsername, playerPhotos, isPlayer1, gamePhase, showToastThrottled, getReconnectDelay]);
  
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
    
    // Store sessionId for API calls (polling fallback)
    if (pvpRoomId) {
      localStorage.setItem('current_pvp_session', pvpRoomId);
      if (gameId) {
        localStorage.setItem('current_pvp_game_id', gameId);
      }
    }
    
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
  }, [pvpRoomId, wsConnected, playerPhotos?.length, gameId]); // Re-run when pvpRoomId or photos change
  
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
        // Not connected and not reconnecting - check if we should try again or switch to polling
        if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          console.log(`WebSocket not open - attempting reconnect ${reconnectAttempts.current + 1}/${MAX_RECONNECT_ATTEMPTS}`);
          connectWebSocketRef.current?.(true);
        } else if (!pollingMode) {
          // Max attempts reached - switch to polling mode permanently
          console.log('Max reconnect attempts reached - switching to polling mode');
          setPollingMode(true);
          setReconnecting(false);
          showToastThrottled('info', 'Connection unstable - using backup sync');
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
  
  // Selection countdown timer with auto-select logic
  useEffect(() => {
    // Only run during 'ready' phase when player hasn't selected yet
    if (gamePhase !== 'ready' || mySelectedPhoto) return;
    
    const timer = setInterval(() => {
      setSelectionTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          
          // Auto-select: Find the photo with highest dollar value
          if (playerPhotos && playerPhotos.length > 0 && !mySelectedPhoto) {
            const sortedPhotos = [...playerPhotos].sort((a, b) => 
              (b.dollar_value || 0) - (a.dollar_value || 0)
            );
            const bestPhoto = sortedPhotos[0];
            
            console.log('[AutoSelect] Time expired - selecting best photo:', bestPhoto?.mint_id);
            toast.warning('⏰ Time expired - auto-selecting your best photo');
            
            // Set the selected photo (this triggers the confirmation flow)
            setMySelectedPhoto(bestPhoto);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gamePhase, mySelectedPhoto, playerPhotos]);
  
  // Polling fallback for game state synchronization
  // This ensures the game stays in sync even when WebSocket is unreliable
  useEffect(() => {
    if (!pvpRoomId || !gameId) return;
    
    const pollGameState = async () => {
      try {
        // Get the current session state from the API
        const response = await api.get(`/photo-game/pvp/session/${gameId}`);
        const sessionData = response.data;
        
        if (sessionData) {
          // CRITICAL FIX: Save player1_id from API response for correct photo assignment
          if (sessionData.player1_id && !confirmedPlayer1Id) {
            console.log('[Polling] Confirmed player1_id from API:', sessionData.player1_id);
            setConfirmedPlayer1Id(sessionData.player1_id);
          }
          
          // Use the correct isPlayer1 based on API response - this is the authoritative source
          const actualIsPlayer1 = (sessionData.player1_id || confirmedPlayer1Id || session?.player1_id) === currentUserId;
          
          // CRITICAL: Also update the ref for WebSocket handlers if they were using stale value
          if (actualIsPlayer1 !== isPlayer1Ref.current) {
            console.log('[Polling] Updating isPlayer1Ref:', actualIsPlayer1, '(was:', isPlayer1Ref.current, ')');
            isPlayer1Ref.current = actualIsPlayer1;
          }
          
          console.log('[Polling] Session state:', {
            status: sessionData.status,
            round: sessionData.current_round,
            p1_selected: sessionData.player1_selected,
            p2_selected: sessionData.player2_selected,
            player1_id: sessionData.player1_id,
            currentUserId,
            actualIsPlayer1,
          });
          
          // Update opponent selection status using correct player determination
          const oppSelected = actualIsPlayer1 ? sessionData.player2_selected : sessionData.player1_selected;
          if (oppSelected && !opponentHasSelected) {
            setOpponentHasSelected(true);
            toast.info(`${opponentUsername || 'Opponent'} has selected their photo`);
          }
          
          // Check if both players have selected - transition to playing phase
          // Allow transition from 'ready' or any state where we're still selecting
          const canTransitionToPlaying = gamePhase === 'ready' || 
            (sessionData.player1_selected && sessionData.player2_selected && gamePhase !== 'playing' && gamePhase !== 'result');
            
          if (sessionData.player1_selected && sessionData.player2_selected && canTransitionToPlaying) {
            console.log('[Polling] Both players selected! Transitioning to playing...', { gamePhase, actualIsPlayer1 });
            
            // Get the photos from round result or direct fields - use actualIsPlayer1
            let myPhoto = null;
            let oppPhoto = null;
            
            if (sessionData.round_result) {
              myPhoto = actualIsPlayer1 ? sessionData.round_result.player1_photo : sessionData.round_result.player2_photo;
              oppPhoto = actualIsPlayer1 ? sessionData.round_result.player2_photo : sessionData.round_result.player1_photo;
            } else if (sessionData.player1_photo && sessionData.player2_photo) {
              myPhoto = actualIsPlayer1 ? sessionData.player1_photo : sessionData.player2_photo;
              oppPhoto = actualIsPlayer1 ? sessionData.player2_photo : sessionData.player1_photo;
            }
            
            if (myPhoto) setMySelectedPhoto(myPhoto);
            if (oppPhoto) setOpponentSelectedPhoto(oppPhoto);
            
            // Transition to playing phase if we have both photos and status is 'tapping'
            if (myPhoto && oppPhoto && sessionData.status === 'tapping') {
              console.log('[Polling] Both players selected - transitioning to tapping phase');
              setGamePhase('playing');
            }
          }
          
          // Handle tapping status (both selected, ready to tap)
          if (sessionData.status === 'tapping') {
            console.log('[Polling] Tapping phase detected');
            
            // Get photos from session - use actualIsPlayer1 for correct assignment
            let myPhoto = actualIsPlayer1 ? sessionData.player1_photo : sessionData.player2_photo;
            let oppPhoto = actualIsPlayer1 ? sessionData.player2_photo : sessionData.player1_photo;
            
            if (myPhoto && oppPhoto) {
              console.log('[Polling] Setting photos for tapping:', {
                myPhotoId: myPhoto?.mint_id,
                oppPhotoId: oppPhoto?.mint_id,
                actualIsPlayer1
              });
              setMySelectedPhoto(myPhoto);
              setOpponentSelectedPhoto(oppPhoto);
              if (gamePhase !== 'playing') {
                console.log('[Polling] Transitioning to playing phase for tapping');
                setGamePhase('playing');
              }
            }
          }
          
          // Handle round result status
          if (sessionData.status === 'round_result' && sessionData.round_result) {
            console.log('[Polling] Round result detected:', sessionData.round_result);
            
            // Update scores
            setPlayer1Wins(sessionData.player1_wins || 0);
            setPlayer2Wins(sessionData.player2_wins || 0);
            
            // Check if game is complete
            if (sessionData.player1_wins >= 3 || sessionData.player2_wins >= 3) {
              setGameWinner(sessionData.winner_id === currentUserId ? 'player1' : 'player2');
              setGamePhase('result');
            }
          }
          
          // Handle complete status
          if (sessionData.status === 'complete' || sessionData.status === 'finished') {
            console.log('[Polling] Game complete! Winner:', sessionData.winner_id);
            setGameWinner(sessionData.winner_id === currentUserId ? 'player1' : 'player2');
            setGamePhase('result');
          }
          
          // Update round info
          if (sessionData.current_round && sessionData.current_round !== currentRound) {
            setCurrentRound(sessionData.current_round);
            // Reset for new round
            setOpponentHasSelected(false);
            setMySelectedPhoto(null);
            setOpponentSelectedPhoto(null);
          }
          
          // Update scores
          if (sessionData.player1_wins !== undefined) {
            setPlayer1Wins(sessionData.player1_wins);
            setPlayer2Wins(sessionData.player2_wins);
          }
        }
      } catch (err) {
        // Silently fail polling - don't spam errors
        console.debug('[Polling] Failed to fetch game state:', err.message);
      }
    };
    
    // Poll every 1.5 seconds for responsive updates
    const pollInterval = setInterval(pollGameState, 1500);
    pollGameState(); // Initial poll
    
    return () => clearInterval(pollInterval);
  }, [pvpRoomId, gameId, gamePhase, currentRound, isPlayer1, opponentHasSelected, opponentUsername, currentUserId]);
  
  // Handle photo selection - use API when WebSocket is unreliable
  const handlePhotoSelect = useCallback((photo) => {
    setMySelectedPhoto(photo);
  }, []);
  
  // Confirm photo selection via API (polling fallback)
  const confirmPhotoSelection = useCallback(async () => {
    if (!mySelectedPhoto || !gameId) return;
    
    try {
      const response = await api.post('/photo-game/pvp/select-photo', {
        session_id: gameId,
        photo_id: mySelectedPhoto.mint_id
      });
      
      if (response.data.success) {
        console.log('[PVP] Photo selection confirmed:', response.data);
        
        // Check if both players selected
        if (response.data.both_selected && response.data.round_result) {
          // Both selected - show round result
          const result = response.data.round_result;
          setOpponentSelectedPhoto(isPlayer1 ? result.player2_photo : result.player1_photo);
          setPlayer1Wins(response.data.player1_wins || 0);
          setPlayer2Wins(response.data.player2_wins || 0);
          
          // Determine if we won this round
          const iWon = (isPlayer1 && result.winner === 'player1') || (!isPlayer1 && result.winner === 'player2');
          
          // Show result phase
          setGamePhase('round_end');
          
          if (response.data.game_over) {
            // Game is complete
            setTimeout(() => {
              setGamePhase('result');
            }, 3000);
          }
        }
        
        return response.data;
      }
    } catch (err) {
      console.error('[PVP] Failed to confirm selection:', err);
      toast.error('Failed to confirm selection. Retrying...');
    }
  }, [mySelectedPhoto, gameId, isPlayer1]);
  
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
            <span className="text-xs text-yellow-400 animate-pulse">
              Reconnecting... {reconnectAttemptCount}/{MAX_RECONNECT_ATTEMPTS}
            </span>
          )}
          {pollingMode && !wsConnected && (
            <span className="text-xs text-blue-400">
              Polling sync
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
              sessionId={gameId || pvpRoomId}
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
              sessionId={gameId || pvpRoomId}
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
