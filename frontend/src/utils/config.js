/**
 * Runtime environment configuration
 * 
 * This module provides runtime detection of the current environment
 * to ensure production deployments use production URLs even if the
 * build was done with preview environment variables.
 */

/**
 * Get the API base URL with runtime detection
 * - On production domain (blendlink.net), always use production URL
 * - Otherwise, use the build-time environment variable
 * - Falls back to empty string for relative URLs
 */
export const getApiBaseUrl = () => {
  // Runtime detection: If on production domain, use production URL
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Production domain
    if (hostname === 'blendlink.net' || hostname === 'www.blendlink.net') {
      return 'https://blendlink.net';
    }
    
    // Staging/preview domains can use their respective env vars
    // For localhost, use env var or empty string
  }
  
  // Use build-time env var or empty string for relative URLs
  return process.env.REACT_APP_BACKEND_URL || '';
};

/**
 * Get WebSocket URL based on current environment
 */
export const getWsBaseUrl = () => {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    // Use current host for WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  return baseUrl.replace(/^https?:/, 'wss:');
};

// Export a constant that can be used directly
export const API_BASE_URL = getApiBaseUrl();
