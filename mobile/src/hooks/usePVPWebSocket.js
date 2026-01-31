/**
 * usePVPWebSocket Hook
 * 
 * React hook for PVP game WebSocket communication
 * Manages connection lifecycle and provides event handlers
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { pvpWebSocket } from '../services/pvpWebSocket';

/**
 * Hook for PVP WebSocket connection
 * 
 * @param {string} roomId - The PVP game room ID
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoConnect - Auto-connect when roomId is provided
 * @param {function} options.onMessage - Message callback
 * @param {string} options.username - Username for join message
 * @param {Array} options.photos - Photos for join message (required for join)
 * @param {boolean} options.isCreator - Whether this player is the game creator
 * @returns {Object} WebSocket state and actions
 */
export function usePVPWebSocket(roomId, options = {}) {
  const { autoConnect = true, onMessage, username, photos, isCreator = false } = options;

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [error, setError] = useState(null);

  // Game state from server
  const [gameState, setGameState] = useState({
    currentRound: 1,
    roundType: 'auction',
    roundPhase: 'waiting',
    player1Wins: 0,
    player2Wins: 0,
    myPhoto: null,
    opponentPhoto: null,
    myReady: false,
    opponentReady: false,
    countdown: null,
    opponentTaps: 0,
    roundResult: null,
    gameResult: null,
    // Track used photos and opponent selection status
    usedPhotoIds: [],        // Photos already used in previous rounds
    opponentHasSelected: false,  // Whether opponent has selected their photo
    mySelectedPhotoId: null,     // My current selection (before confirmed)
  });

  // Refs for cleanup
  const unsubscribesRef = useRef([]);
  const joinSentRef = useRef(false);

  // Connect to room
  const connect = useCallback(async () => {
    if (!roomId) return;

    setIsConnecting(true);
    setError(null);
    joinSentRef.current = false;

    try {
      await pvpWebSocket.connect(roomId);
    } catch (err) {
      setError(err);
      setIsConnecting(false);
    }
  }, [roomId]);

  // Disconnect
  const disconnect = useCallback(() => {
    pvpWebSocket.disconnect();
    setIsConnected(false);
    setHasJoined(false);
    joinSentRef.current = false;
  }, []);

  // Join room with photos - MUST be called after connect
  const joinRoom = useCallback((joinUsername, joinPhotos, joinIsCreator) => {
    if (joinSentRef.current) {
      console.log('[usePVPWS] Join already sent');
      return false;
    }
    joinSentRef.current = true;
    return pvpWebSocket.joinRoom(joinUsername || username, joinPhotos || photos, joinIsCreator ?? isCreator);
  }, [username, photos, isCreator]);


  // Setup event listeners
  useEffect(() => {
    if (!roomId) return;

    // Connection events
    const unsubConnected = pvpWebSocket.on('connected', () => {
      console.log('[usePVPWS] Connected to room:', roomId);
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
      
      // Auto-send join message if we have photos
      if (photos && photos.length > 0 && !joinSentRef.current) {
        console.log('[usePVPWS] Auto-sending join with', photos.length, 'photos');
        setTimeout(() => {
          pvpWebSocket.joinRoom(username || 'Player', photos, isCreator);
          joinSentRef.current = true;
        }, 100); // Small delay to ensure connection is stable
      }
    });

    const unsubDisconnected = pvpWebSocket.on('disconnected', (data) => {
      console.log('[usePVPWS] Disconnected:', data);
      setIsConnected(false);
      setIsConnecting(false);
      setHasJoined(false);
    });

    const unsubError = pvpWebSocket.on('error', (data) => {
      console.log('[usePVPWS] Error:', data);
      setError(data.error);
      setIsConnecting(false);
    });

    // Game state events
    const unsubJoinResult = pvpWebSocket.on('join_result', (data) => {
      console.log('[usePVPWS] Join result:', data);
      if (data.success) {
        setHasJoined(true);
        setGameState(prev => ({
          ...prev,
          currentRound: data.current_round || 1,
          roundPhase: data.round_phase || 'waiting',
        }));
      } else {
        setError('Failed to join room');
      }
    });

    const unsubGameState = pvpWebSocket.on('game_state', (data) => {
      setGameState(prev => ({
        ...prev,
        currentRound: data.current_round || prev.currentRound,
        roundType: data.round_type || prev.roundType,
        roundPhase: data.round_phase || prev.roundPhase,
        player1Wins: data.player1_wins ?? prev.player1Wins,
        player2Wins: data.player2_wins ?? prev.player2Wins,
      }));
    });

    const unsubRoundSelecting = pvpWebSocket.on('round_selecting', (data) => {
      setGameState(prev => ({
        ...prev,
        currentRound: data.round || prev.currentRound,
        roundType: data.round_type || prev.roundType,
        roundPhase: 'selecting',
        myPhoto: null,
        opponentPhoto: null,
        myReady: false,
        opponentReady: false,
        countdown: null,
        opponentTaps: 0,
        roundResult: null,
        // Reset selection status for new round
        opponentHasSelected: false,
        mySelectedPhotoId: null,
      }));
    });

    // NEW: Handle opponent photo selection notification
    const unsubPlayerSelected = pvpWebSocket.on('player_selected_photo', (data) => {
      setGameState(prev => ({
        ...prev,
        opponentHasSelected: true,
      }));
    });

    // NEW: Handle my photo selection confirmation
    const unsubPhotoConfirmed = pvpWebSocket.on('photo_selection_confirmed', (data) => {
      setGameState(prev => ({
        ...prev,
        mySelectedPhotoId: data.photo_id,
      }));
    });

    const unsubRoundReady = pvpWebSocket.on('round_ready', (data) => {
      setGameState(prev => ({
        ...prev,
        roundPhase: 'ready',
        myPhoto: data.my_photo || prev.myPhoto,
        opponentPhoto: data.opponent_photo || prev.opponentPhoto,
        // Track used photos - add both photos to used list
        usedPhotoIds: [
          ...prev.usedPhotoIds,
          data.my_photo?.mint_id,
          data.opponent_photo?.mint_id,
        ].filter(Boolean),
      }));
    });

    const unsubPlayerReady = pvpWebSocket.on('player_ready', (data) => {
      setGameState(prev => ({
        ...prev,
        myReady: data.is_me ? true : prev.myReady,
        opponentReady: !data.is_me ? true : prev.opponentReady,
      }));
    });

    const unsubRoundCountdown = pvpWebSocket.on('round_countdown', (data) => {
      setGameState(prev => ({
        ...prev,
        roundPhase: 'countdown',
        countdown: data.seconds,
      }));
    });

    // Also handle countdown_tick for smoother updates
    const unsubCountdownTick = pvpWebSocket.on('countdown_tick', (data) => {
      setGameState(prev => ({
        ...prev,
        roundPhase: 'countdown',
        countdown: data.seconds_remaining,
      }));
    });

    const unsubRoundPlaying = pvpWebSocket.on('round_playing', (data) => {
      setGameState(prev => ({
        ...prev,
        roundPhase: 'playing',
        countdown: null,
      }));
    });

    // Also handle round_start for playing phase
    const unsubRoundStart = pvpWebSocket.on('round_start', (data) => {
      setGameState(prev => ({
        ...prev,
        roundPhase: 'playing',
        countdown: null,
        myPhoto: data.player1?.photo || data.player2?.photo || prev.myPhoto,
        opponentPhoto: data.player2?.photo || data.player1?.photo || prev.opponentPhoto,
      }));
    });

    const unsubTapUpdate = pvpWebSocket.on('tap_update', (data) => {
      if (!data.is_me) {
        setGameState(prev => ({
          ...prev,
          opponentTaps: data.total_taps || prev.opponentTaps,
        }));
      }
    });

    const unsubRoundResult = pvpWebSocket.on('round_result', (data) => {
      setGameState(prev => ({
        ...prev,
        roundPhase: 'result',
        roundResult: data,
        player1Wins: data.player1_wins ?? prev.player1Wins,
        player2Wins: data.player2_wins ?? prev.player2Wins,
      }));
    });

    const unsubGameResult = pvpWebSocket.on('game_result', (data) => {
      setGameState(prev => ({
        ...prev,
        roundPhase: 'game_over',
        gameResult: data,
      }));
    });

    // Handle game_end event (same as game_result)
    const unsubGameEnd = pvpWebSocket.on('game_end', (data) => {
      setGameState(prev => ({
        ...prev,
        roundPhase: 'game_over',
        gameResult: {
          winner_user_id: data.winner_user_id,
          player1_wins: data.player1_wins,
          player2_wins: data.player2_wins,
        },
      }));
    });

    // Generic message handler
    const unsubMessage = pvpWebSocket.on('message', (data) => {
      onMessage?.(data);
    });

    // Store unsubscribes for cleanup
    unsubscribesRef.current = [
      unsubConnected,
      unsubDisconnected,
      unsubError,
      unsubJoinResult,
      unsubGameState,
      unsubRoundSelecting,
      unsubRoundReady,
      unsubPlayerReady,
      unsubRoundCountdown,
      unsubCountdownTick,
      unsubRoundPlaying,
      unsubRoundStart,
      unsubTapUpdate,
      unsubRoundResult,
      unsubGameResult,
      unsubGameEnd,
      unsubPlayerSelected,
      unsubPhotoConfirmed,
      unsubMessage,
    ];

    // Auto-connect if enabled
    if (autoConnect) {
      connect();
    }

    // Cleanup
    return () => {
      unsubscribesRef.current.forEach(unsub => unsub?.());
      unsubscribesRef.current = [];
    };
  }, [roomId, autoConnect, connect, onMessage, username, photos, isCreator]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Actions
  const selectPhoto = useCallback((photoId) => {
    return pvpWebSocket.selectPhoto(photoId);
  }, []);

  const markReady = useCallback(() => {
    return pvpWebSocket.markReady();
  }, []);

  const sendTap = useCallback((count = 1) => {
    return pvpWebSocket.sendTap(count);
  }, []);

  const sendRPSChoice = useCallback((choice) => {
    return pvpWebSocket.sendRPSChoice(choice);
  }, []);

  const requestGameState = useCallback(() => {
    return pvpWebSocket.requestGameState();
  }, []);

  return {
    // State
    isConnected,
    isConnecting,
    hasJoined,
    error,
    gameState,

    // Actions
    connect,
    disconnect,
    joinRoom,
    selectPhoto,
    markReady,
    sendTap,
    sendRPSChoice,
    requestGameState,
  };
}

export default usePVPWebSocket;
