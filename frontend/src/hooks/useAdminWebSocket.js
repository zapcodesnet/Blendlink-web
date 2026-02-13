/**
 * useAdminWebSocket Hook
 * Manages WebSocket connection for real-time admin updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { getApiUrl, getWsUrl } from '../utils/runtimeConfig';

const API_BASE = getApiUrl();

// Convert HTTP URL to WebSocket URL
const getWebSocketUrl = () => {
  const baseUrl = getWsUrl();
  return `${baseUrl}/api/realtime/ws/analytics`;
};

export function useAdminWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [connectionError, setConnectionError] = useState(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    const token = localStorage.getItem('blendlink_token');
    if (!token) {
      setConnectionError('No authentication token');
      return;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = `${getWebSocketUrl()}?token=${token}`;
    console.log('[WS] Connecting to:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Connected');
        setIsConnected(true);
        setConnectionError(null);
        setReconnectAttempts(0);
        
        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send('ping');
          }
        }, 30000); // Ping every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[WS] Message received:', data.type);

          switch (data.type) {
            case 'initial':
            case 'metrics':
              setMetrics(data.data);
              break;
            
            case 'notification':
              setNotifications(prev => [data.data, ...prev].slice(0, 20));
              // Show toast for important notifications
              if (data.data.priority === 'high' || data.data.priority === 'critical') {
                toast.info(data.data.title, {
                  description: data.data.body,
                  duration: 5000,
                });
              }
              break;
            
            case 'pong':
              // Connection still alive
              break;
            
            case 'activity':
              // Update specific activity metric
              setMetrics(prev => prev ? { ...prev, ...data.data } : data.data);
              break;
            
            default:
              console.log('[WS] Unknown message type:', data.type);
          }
        } catch (e) {
          console.error('[WS] Failed to parse message:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        setConnectionError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        console.log('[WS] Disconnected:', event.code, event.reason);
        setIsConnected(false);
        
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }

        // Attempt reconnect if not intentionally closed
        if (event.code !== 1000 && event.code !== 4001 && event.code !== 4003) {
          if (reconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.log(`[WS] Reconnecting in ${delay}ms... (attempt ${reconnectAttempts + 1})`);
            
            reconnectTimeoutRef.current = setTimeout(() => {
              setReconnectAttempts(prev => prev + 1);
              connect();
            }, delay);
          } else {
            setConnectionError('Max reconnection attempts reached');
          }
        }
      };

    } catch (error) {
      console.error('[WS] Failed to create connection:', error);
      setConnectionError(error.message);
    }
  }, [reconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  // Reconnect when token changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'blendlink_token') {
        if (e.newValue) {
          connect();
        } else {
          disconnect();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [connect, disconnect]);

  return {
    isConnected,
    metrics,
    notifications,
    connectionError,
    reconnectAttempts,
    connect,
    disconnect,
    sendMessage,
  };
}

export default useAdminWebSocket;
