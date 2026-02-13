/**
 * Game Lobby WebSocket Service for Mobile
 * 
 * Handles real-time WebSocket communication for the game lobby (before PVP starts)
 * 
 * Protocol:
 * - Connect to: wss://{host}/api/ws/lobby/{gameId}/{token}
 * - Messages: JSON with 'type' field
 * 
 * Message Types (Server -> Client):
 * - connected: Initial connection successful
 * - player_joined: Opponent joined the lobby
 * - player_ready: A player marked ready
 * - countdown_start: Both ready, countdown beginning
 * - countdown_tick: Countdown update
 * - game_start: Game starting (includes pvp_room_id)
 * - player_disconnected: Player left
 * 
 * Message Types (Client -> Server):
 * - ready: Mark self as ready
 */

import { getToken } from './api';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://orphan-dashboard.preview.emergentagent.com';

class LobbyWebSocketService {
  constructor() {
    this.ws = null;
    this.gameId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.messageHandlers = new Map();
    this.isConnecting = false;
    this.heartbeatInterval = null;
  }

  /**
   * Connect to a game lobby
   */
  async connect(gameId) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log('[LobbyWS] Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    this.gameId = gameId;

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No auth token');
      }

      // Build WebSocket URL - CRITICAL: Must use /api prefix for ingress routing
      const wsProtocol = API_URL.startsWith('https') ? 'wss' : 'ws';
      const wsHost = API_URL.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/api/ws/lobby/${gameId}/${token}`;

      console.log('[LobbyWS] Connecting to:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[LobbyWS] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected', { gameId });
      };

      this.ws.onclose = (event) => {
        console.log('[LobbyWS] Closed:', event.code, event.reason);
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit('disconnected', { code: event.code, reason: event.reason });
        
        // Auto-reconnect if not intentional close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('[LobbyWS] Error:', error);
        this.isConnecting = false;
        this.emit('error', { error });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[LobbyWS] Message:', data.type, data);
          
          // Emit to all handlers
          this.emit(data.type, data);
          this.emit('message', data);
        } catch (err) {
          console.error('[LobbyWS] Failed to parse message:', err);
        }
      };
    } catch (err) {
      console.error('[LobbyWS] Failed to connect:', err);
      this.isConnecting = false;
      this.emit('error', { error: err });
    }
  }

  /**
   * Disconnect from lobby
   */
  disconnect() {
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    
    this.gameId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[LobbyWS] Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.gameId && !this.ws) {
        this.connect(this.gameId);
      }
    }, delay);
  }

  /**
   * Start heartbeat ping
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send({ type: 'ping' });
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Send message to server
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[LobbyWS] Not connected, cannot send:', message);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error('[LobbyWS] Failed to send:', err);
      return false;
    }
  }

  // ============== LOBBY ACTIONS ==============

  /**
   * Mark self as ready
   */
  markReady() {
    return this.send({ type: 'ready' });
  }

  // ============== EVENT HANDLERS ==============

  /**
   * Register event handler
   */
  on(event, handler) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, new Set());
    }
    this.messageHandlers.get(event).add(handler);
    
    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Remove event handler
   */
  off(event, handler) {
    this.messageHandlers.get(event)?.delete(handler);
  }

  /**
   * Emit event to handlers
   */
  emit(event, data) {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[LobbyWS] Handler error for ${event}:`, err);
        }
      });
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
export const lobbyWebSocket = new LobbyWebSocketService();

export default lobbyWebSocket;
