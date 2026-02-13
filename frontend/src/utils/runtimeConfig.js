/**
 * Runtime Configuration Utility
 * 
 * Provides runtime URL detection to ensure the app works correctly
 * regardless of build-time environment variables.
 * 
 * This is critical because React bakes env variables at build time,
 * meaning a preview build would have preview URLs baked in even when
 * deployed to production.
 * 
 * Usage:
 *   import { getApiUrl, getWsUrl } from '../utils/runtimeConfig';
 *   const API_URL = getApiUrl();
 */

/**
 * Get the API base URL with runtime detection
 * @returns {string} The correct API base URL for the current environment
 */
export const getApiUrl = () => {
  // Runtime production detection
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production - always use production URL
    if (hostname === 'blendlink.net' || hostname === 'www.blendlink.net') {
      return 'https://blendlink.net';
    }
    
    // If on localhost, use localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
    }
  }
  
  // Fallback to env variable (for preview/development)
  // Final fallback to production if nothing is set
  return process.env.REACT_APP_BACKEND_URL || 'https://blendlink.net';
};

/**
 * Get the WebSocket base URL with runtime detection
 * @returns {string} The correct WebSocket base URL for the current environment
 */
export const getWsUrl = () => {
  const apiUrl = getApiUrl();
  return apiUrl.replace(/^http/, 'ws');
};

/**
 * Get the frontend base URL with runtime detection
 * @returns {string} The correct frontend base URL for the current environment
 */
export const getFrontendUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://blendlink.net';
};

// Export as default object for convenience
export default {
  getApiUrl,
  getWsUrl,
  getFrontendUrl,
};
