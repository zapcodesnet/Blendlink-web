/**
 * useLobbyWebSocket Hook
 * 
 * React hook for Game Lobby WebSocket communication
 * Manages connection lifecycle and provides event handlers for pre-game lobby
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { lobbyWebSocket } from '../services/lobbyWebSocket';

/**
 * Hook for Lobby WebSocket connection
 * 
 * @param {string} gameId - The open game ID
 * @param {Object} options - Configuration options
 * @returns {Object} WebSocket state and actions
 */
export function useLobbyWebSocket(gameId, options = {}) {
  const { autoConnect = true, onMessage, onGameStart } = options;

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState(null);

  // Lobby state
  const [lobbyState, setLobbyState] = useState({
    creatorReady: false,
    opponentReady: false,
    countdown: null,
    countdownActive: false,
    opponentJoined: false,
    opponentUsername: null,
  });

  // Refs for cleanup
  const unsubscribesRef = useRef([]);

  // Connect to lobby
  const connect = useCallback(async () => {
    if (!gameId) return;

    setIsConnecting(true);
    setError(null);

    try {
      await lobbyWebSocket.connect(gameId);
    } catch (err) {
      setError(err);
      setIsConnecting(false);
    }
  }, [gameId]);

  // Disconnect
  const disconnect = useCallback(() => {
    lobbyWebSocket.disconnect();
    setIsConnected(false);
  }, []);

  // Setup event listeners
  useEffect(() => {
    if (!gameId) return;

    // Connection events
    const unsubConnected = lobbyWebSocket.on('connected', (data) => {
      console.log('[useLobbyWS] Connected to lobby:', data);
      setIsConnected(true);
      setIsConnecting(false);
      setError(null);
    });

    const unsubDisconnected = lobbyWebSocket.on('disconnected', (data) => {
      console.log('[useLobbyWS] Disconnected:', data);
      setIsConnected(false);
      setIsConnecting(false);
    });

    const unsubError = lobbyWebSocket.on('error', (data) => {
      console.log('[useLobbyWS] Error:', data);
      setError(data.error);
      setIsConnecting(false);
    });

    // Lobby events
    const unsubPlayerJoined = lobbyWebSocket.on('player_joined', (data) => {
      console.log('[useLobbyWS] Player joined:', data);
      setLobbyState(prev => ({
        ...prev,
        opponentJoined: true,
        opponentUsername: data.username || data.player?.username,
      }));
    });

    const unsubPlayerReady = lobbyWebSocket.on('player_ready', (data) => {
      console.log('[useLobbyWS] Player ready:', data);
      // Determine if it's creator or opponent based on user_id
      setLobbyState(prev => ({
        ...prev,
        creatorReady: data.is_creator ? true : prev.creatorReady,
        opponentReady: !data.is_creator ? true : prev.opponentReady,
      }));
    });

    const unsubReadyState = lobbyWebSocket.on('ready_state', (data) => {
      console.log('[useLobbyWS] Ready state:', data);
      setLobbyState(prev => ({
        ...prev,
        creatorReady: data.creator_ready ?? prev.creatorReady,
        opponentReady: data.opponent_ready ?? prev.opponentReady,
      }));
    });

    const unsubCountdownStart = lobbyWebSocket.on('countdown_start', (data) => {
      console.log('[useLobbyWS] Countdown start:', data);
      setLobbyState(prev => ({
        ...prev,
        countdownActive: true,
        countdown: data.seconds || 10,
      }));
    });

    const unsubCountdownTick = lobbyWebSocket.on('countdown_tick', (data) => {
      setLobbyState(prev => ({
        ...prev,
        countdown: data.seconds_remaining ?? data.seconds ?? prev.countdown,
      }));
    });

    // CRITICAL: Game start event - contains pvp_room_id
    const unsubGameStart = lobbyWebSocket.on('game_start', (data) => {
      console.log('[useLobbyWS] GAME START:', data);
      setLobbyState(prev => ({
        ...prev,
        countdownActive: false,
      }));
      
      // Call the callback with game data including pvp_room_id
      if (onGameStart) {
        onGameStart({
          pvpRoomId: data.pvp_room_id,
          sessionId: data.session_id,
          session: data.session,
        });
      }
    });

    const unsubPlayerDisconnected = lobbyWebSocket.on('player_disconnected', (data) => {
      console.log('[useLobbyWS] Player disconnected:', data);
      setLobbyState(prev => ({
        ...prev,
        opponentJoined: false,
        opponentReady: false,
        countdownActive: false,
      }));
    });

    // Generic message handler
    const unsubMessage = lobbyWebSocket.on('message', (data) => {
      onMessage?.(data);
    });

    // Store unsubscribes for cleanup
    unsubscribesRef.current = [
      unsubConnected,
      unsubDisconnected,
      unsubError,
      unsubPlayerJoined,
      unsubPlayerReady,
      unsubReadyState,
      unsubCountdownStart,
      unsubCountdownTick,
      unsubGameStart,
      unsubPlayerDisconnected,
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
  }, [gameId, autoConnect, connect, onMessage, onGameStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Actions
  const markReady = useCallback(() => {
    return lobbyWebSocket.markReady();
  }, []);

  return {
    // State
    isConnected,
    isConnecting,
    error,
    lobbyState,

    // Actions
    connect,
    disconnect,
    markReady,
  };
}

export default useLobbyWebSocket;
