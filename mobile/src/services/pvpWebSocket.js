/**
 * PVP Game WebSocket Service for Mobile
 * 
 * Handles real-time WebSocket communication for PVP battles
 * 
 * Protocol:
 * - Connect to: wss://{host}/api/ws/pvp-game/{roomId}/{token}
 * - Messages: JSON with 'type' field
 * 
 * Message Types (Server -> Client):
 * - join_result: Connection confirmed
 * - player_connected: Opponent joined
 * - player_disconnected: Opponent left
 * - game_forfeit: Game ended (disconnect/forfeit)
 * - round_selecting: Start photo selection
 * - round_ready: Both selected, show ready buttons
 * - player_ready: Player marked ready
 * - round_countdown: Countdown started
 * - round_playing: Round active
 * - tap_update: Opponent tap count (auction rounds)
 * - round_result: Round ended
 * - game_result: Game ended
 * 
 * Message Types (Client -> Server):
 * - select_photo: Select photo for round
 * - ready: Mark ready for round
 * - tap: Send tap (auction rounds)
 * - rps_choice: Send RPS choice
 */

import { getToken } from './api';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://pages-enhance.preview.emergentagent.com';

class PVPWebSocketService {
  constructor() {
    this.ws = null;
    this.roomId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.messageHandlers = new Map();
    this.isConnecting = false;
    this.heartbeatInterval = null;
  }

  /**
   * Connect to a PVP game room
   */
  async connect(roomId) {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log('Already connected or connecting');
      return;
    }

    this.isConnecting = true;
    this.roomId = roomId;

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No auth token');
      }

      // Build WebSocket URL - CRITICAL: Must use /api prefix for ingress routing
      const wsProtocol = API_URL.startsWith('https') ? 'wss' : 'ws';
      const wsHost = API_URL.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}://${wsHost}/api/ws/pvp-game/${roomId}/${token}`;

      console.log('Connecting to PVP WebSocket:', wsUrl);

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('PVP WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.emit('connected', { roomId });
        
        // NOTE: The caller MUST send a 'join' message with photos after connection
        // Use joinRoom(username, photos, isCreator) method
      };

      this.ws.onclose = (event) => {
        console.log('PVP WebSocket closed:', event.code, event.reason);
        this.isConnecting = false;
        this.stopHeartbeat();
        this.emit('disconnected', { code: event.code, reason: event.reason });
        
        // Auto-reconnect if not intentional close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('PVP WebSocket error:', error);
        this.isConnecting = false;
        this.emit('error', { error });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('PVP WS message:', data.type, data);
          
          // Emit to all handlers
          this.emit(data.type, data);
          this.emit('message', data);
        } catch (err) {
          console.error('Failed to parse WS message:', err);
        }
      };
    } catch (err) {
      console.error('Failed to connect WebSocket:', err);
      this.isConnecting = false;
      this.emit('error', { error: err });
    }
  }

  /**
   * Disconnect from room
   */
  disconnect() {
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    
    this.roomId = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.roomId && !this.ws) {
        this.connect(this.roomId);
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
      console.warn('WebSocket not connected, cannot send:', message);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (err) {
      console.error('Failed to send WS message:', err);
      return false;
    }
  }

  // ============== GAME ACTIONS ==============

  /**
   * Join the PVP room - MUST be called after connect() succeeds
   * This registers the player with the backend and sends their photos
   * Can also be used for reconnection - server will handle appropriately
   */
  joinRoom(username, photos, isCreator, isReconnect = false) {
    console.log('[PVP WS] Sending join message:', { username, photosCount: photos?.length, isCreator, isReconnect });
    return this.send({
      type: 'join',
      username: username,
      photos: photos,
      is_creator: isCreator,
      is_reconnect: isReconnect,
    });
  }

  /**
   * Reconnect to room - now just uses joinRoom with is_reconnect flag
   */
  reconnectToRoom(username, photos, isCreator) {
    return this.joinRoom(username, photos, isCreator, true);
  }

  /**
   * Select photo for current round
   */
  selectPhoto(photoId) {
    return this.send({
      type: 'select_photo',
      photo_id: photoId,
    });
  }

  /**
   * Mark ready for round
   */
  markReady() {
    return this.send({
      type: 'ready',
    });
  }

  /**
   * Send tap (auction rounds)
   */
  sendTap(count = 1) {
    return this.send({
      type: 'tap',
      count,
    });
  }

  /**
   * Send RPS choice
   */
  sendRPSChoice(choice) {
    return this.send({
      type: 'rps_choice',
      choice, // 'rock', 'paper', or 'scissors'
    });
  }

  /**
   * Request current game state
   */
  requestGameState() {
    return this.send({
      type: 'get_state',
    });
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
          console.error(`Handler error for ${event}:`, err);
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
export const pvpWebSocket = new PVPWebSocketService();

export default pvpWebSocket;
