/**
 * Runtime Configuration Utility
 */

// BlendLink API on Render
const PRODUCTION_API = 'https://blendlink-api.onrender.com';

export const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    if (hostname === 'blendlink.net' || hostname === 'www.blendlink.net' || hostname.includes('blendlink-web.pages.dev')) {
      return PRODUCTION_API;
    }
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
    }
    
    if (hostname.includes('.preview.emergentagent.com') || hostname.includes('.stage-preview.emergentagent.com')) {
      const protocol = window.location.protocol;
      return `${protocol}//${hostname}`;
    }
  }
  
  return process.env.REACT_APP_BACKEND_URL || PRODUCTION_API;
};

export const getWsUrl = () => {
  const apiUrl = getApiUrl();
  return apiUrl.replace(/^http/, 'ws');
};

export const getFrontendUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return 'https://blendlink.net';
};

export default { getApiUrl, getWsUrl, getFrontendUrl };
