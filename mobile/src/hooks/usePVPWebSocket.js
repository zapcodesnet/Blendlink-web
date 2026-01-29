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
 * @returns {Object} WebSocket state and actions
 */
export function usePVPWebSocket(roomId, options = {}) {
  const { autoConnect = true, onMessage } = options;

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
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
    // NEW: Track used photos and opponent selection status
    usedPhotoIds: [],        // Photos already used in previous rounds
    opponentHasSelected: false,  // Whether opponent has selected their photo
    mySelectedPhotoId: null,     // My current selection (before confirmed)
  });

  // Refs for cleanup
  const unsubscribesRef = useRef([]);

  // Connect to room
  const connect = useCallback(async () => {
    if (!roomId) return;

    setIsConnecting(true);
    setError(null);

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
  }, []);

  // Setup event listeners
  useEffect(() => {
    if (!roomId) return;

    // Connection events
    const unsubConnected = pvpWebSocket.on('connected', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
    });

    const unsubDisconnected = pvpWebSocket.on('disconnected', (data) => {
      setIsConnected(false);
      setIsConnecting(false);
    });

    const unsubError = pvpWebSocket.on('error', (data) => {
      setError(data.error);
      setIsConnecting(false);
    });

    // Game state events
    const unsubJoinResult = pvpWebSocket.on('join_result', (data) => {
      if (data.success) {
        setGameState(prev => ({
          ...prev,
          currentRound: data.current_round || 1,
          roundPhase: data.round_phase || 'waiting',
        }));
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
  }, [roomId, autoConnect, connect, onMessage]);

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
    error,
    gameState,

    // Actions
    connect,
    disconnect,
    selectPhoto,
    markReady,
    sendTap,
    sendRPSChoice,
    requestGameState,
  };
}

export default usePVPWebSocket;
