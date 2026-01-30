// API Service - Connects to the internal Blendlink backend
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';
const API_PREFIX = '/api';

// Token management
const TOKEN_KEY = 'blendlink_token';
const USER_KEY = 'blendlink_user';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const removeToken = () => localStorage.removeItem(TOKEN_KEY);

export const getStoredUser = () => {
  try {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

// Helper to check if a string is a base64 data URL (large)
const isLargeBase64 = (str) => {
  return typeof str === 'string' && str.startsWith('data:') && str.length > 1000;
};

// Store user but exclude large base64 images to prevent quota errors
export const setStoredUser = (user) => {
  if (!user) {
    localStorage.removeItem(USER_KEY);
    return;
  }
  
  // Create a copy without large base64 data
  const userToStore = { ...user };
  
  // If profile_picture is a large base64, store only a flag that it exists
  // The actual image will be fetched from the server when needed
  if (isLargeBase64(userToStore.profile_picture)) {
    userToStore.profile_picture_stored = false; // Flag that we need to fetch it
    userToStore.profile_picture = null; // Don't store the large base64
  }
  
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(userToStore));
  } catch (e) {
    // If storage still fails (quota exceeded), try storing minimal user data
    console.warn('localStorage quota exceeded, storing minimal user data');
    const minimalUser = {
      user_id: user.user_id,
      email: user.email,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      bl_coins: user.bl_coins,
      profile_picture_mint_id: user.profile_picture_mint_id,
      profile_picture_stored: false,
    };
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(minimalUser));
    } catch (e2) {
      console.error('Failed to store even minimal user data:', e2);
    }
  }
};
export const removeStoredUser = () => localStorage.removeItem(USER_KEY);

// API request helper with robust error handling
const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${API_PREFIX}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      removeToken();
      removeStoredUser();
      window.location.href = '/login';
      throw new Error('Unauthorized');
    }

    // Clone response to safely read it
    const responseClone = response.clone();
    let data;
    
    try {
      data = await response.json();
    } catch (parseError) {
      // If JSON parsing fails, try to get text
      const text = await responseClone.text();
      throw new Error(text || 'Invalid server response');
    }
    
    if (!response.ok) {
      // Handle error detail from FastAPI
      const errorMessage = data.detail?.message || data.detail || data.message || 'Request failed';
      throw new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
    }

    return data;
  } catch (error) {
    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      throw new Error('Failed to fetch - Unable to connect to server');
    }
    throw error;
  }
};

// ============== AUTH API ==============
export const authAPI = {
  register: async (data) => {
    const response = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    // Handle both token formats
    const authToken = response.token || response.access_token;
    if (authToken) {
      setToken(authToken);
      if (response.user) {
        setStoredUser(response.user);
      } else {
        setStoredUser({
          user_id: response.user_id,
          email: response.email,
          name: response.name,
          referral_code: response.referral_code,
          bl_coins: response.bl_coins_bonus || 50000,
        });
      }
    }
    return response;
  },

  login: async (email, password) => {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    // Handle both token formats (token or access_token)
    const authToken = response.token || response.access_token;
    if (authToken) {
      setToken(authToken);
      // Store user from response or fetch profile
      if (response.user) {
        setStoredUser(response.user);
      } else {
        const profile = await authAPI.getProfile();
        setStoredUser(profile);
      }
    }
    return response;
  },

  getProfile: async () => {
    return apiRequest('/auth/me');
  },

  logout: () => {
    removeToken();
    removeStoredUser();
    window.location.href = '/login';
  },

  // Google OAuth - REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  googleAuth: () => {
    const redirectUrl = window.location.origin + '/feed';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  },

  // Handle Google OAuth callback - Use backend proxy to avoid CORS issues
  handleGoogleCallback: async (sessionId) => {
    console.log("handleGoogleCallback: Using backend proxy for session verification...");
    
    try {
      // Call our backend which will verify the session with Emergent Auth service
      // This avoids CORS issues when calling demobackend.emergentagent.com directly
      const loginResult = await apiRequest('/auth/google-session', {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId }),
      });
      
      console.log("handleGoogleCallback: Backend verification successful");
      
      const authToken = loginResult.token || loginResult.access_token;
      if (authToken) {
        setToken(authToken);
        if (loginResult.user) {
          setStoredUser(loginResult.user);
        }
      }
      return loginResult;
    } catch (error) {
      console.error("handleGoogleCallback: Backend verification error:", error);
      throw new Error('Google authentication failed: ' + error.message);
    }
  },
};

// ============== BL COINS / WALLET API ==============
export const walletAPI = {
  getBalance: async () => {
    return apiRequest('/wallet/balance');
  },

  getTransactions: async (skip = 0, limit = 50) => {
    return apiRequest(`/wallet/transactions?skip=${skip}&limit=${limit}`);
  },

  claimDaily: async () => {
    return apiRequest('/wallet/claim-daily', { method: 'POST' });
  },

  getStats: async () => {
    const balance = await walletAPI.getBalance();
    const transactions = await walletAPI.getTransactions(0, 100);
    
    // Calculate stats from transactions
    const stats = {
      referrals: 0,
      games: 0,
      daily: 0,
    };
    
    transactions.transactions?.forEach(txn => {
      if (txn.transaction_type?.includes('referral')) {
        stats.referrals += txn.amount;
      } else if (txn.transaction_type?.includes('game')) {
        stats.games += txn.amount;
      } else if (txn.transaction_type?.includes('daily') || txn.transaction_type?.includes('login')) {
        stats.daily += txn.amount;
      }
    });

    return {
      balance: balance.balance,
      earnings: stats,
      spent: {
        raffles: 0,
        games_bet: 0,
      },
    };
  },
};

// ============== REFERRALS API ==============
export const referralsAPI = {
  getStats: async () => {
    const profile = await authAPI.getProfile();
    return {
      referral_code: profile.referral_code,
      level1_count: profile.direct_recruits_count || 0,
      level2_count: profile.total_downline_count || 0,
      total_earned: profile.downline_commissions_total || 0,
      level1_referrals: [],
      level2_referrals: [],
    };
  },
};

// ============== POSTS/SOCIAL API ==============
// Note: These endpoints may not exist in the mobile API yet
// We'll use local storage as fallback for demo purposes
export const postsAPI = {
  getFeed: async (skip = 0, limit = 20) => {
    try {
      return await apiRequest(`/posts/feed?skip=${skip}&limit=${limit}`);
    } catch {
      // Return empty feed if endpoint doesn't exist
      return [];
    }
  },

  getExplore: async (skip = 0, limit = 20) => {
    try {
      return await apiRequest(`/posts/explore?skip=${skip}&limit=${limit}`);
    } catch {
      return [];
    }
  },

  getStories: async () => {
    try {
      return await apiRequest('/posts/stories');
    } catch {
      return [];
    }
  },

  createPost: async (data) => {
    try {
      return await apiRequest('/posts', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      throw new Error('Social features coming soon to mobile API');
    }
  },

  likePost: async (postId) => {
    try {
      return await apiRequest(`/posts/${postId}/like`, { method: 'POST' });
    } catch {
      throw new Error('Social features coming soon');
    }
  },

  getComments: async (postId) => {
    try {
      return await apiRequest(`/posts/${postId}/comments`);
    } catch {
      return [];
    }
  },

  addComment: async (postId, content) => {
    try {
      return await apiRequest(`/posts/${postId}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    } catch {
      throw new Error('Social features coming soon');
    }
  },
};

// ============== USERS API ==============
export const usersAPI = {
  getUser: async (userId) => {
    try {
      return await apiRequest(`/users/${userId}`);
    } catch {
      // Return current user as fallback
      return getStoredUser();
    }
  },

  getUserPosts: async (userId, skip = 0, limit = 20) => {
    try {
      return await apiRequest(`/users/${userId}/posts?skip=${skip}&limit=${limit}`);
    } catch {
      return [];
    }
  },

  followUser: async (userId) => {
    try {
      return await apiRequest(`/users/${userId}/follow`, { method: 'POST' });
    } catch {
      throw new Error('Social features coming soon');
    }
  },

  getFollowing: async (userId) => {
    try {
      return await apiRequest(`/users/${userId}/following`);
    } catch {
      return [];
    }
  },
};

// ============== MESSAGES API ==============
export const messagesAPI = {
  getConversations: async () => {
    try {
      return await apiRequest('/messages/conversations');
    } catch {
      return [];
    }
  },

  getMessages: async (userId) => {
    try {
      return await apiRequest(`/messages/${userId}`);
    } catch {
      return [];
    }
  },

  sendMessage: async (userId, content, mediaUrl = null, mediaType = null) => {
    try {
      return await apiRequest(`/messages/${userId}`, {
        method: 'POST',
        body: JSON.stringify({ content, media_url: mediaUrl, media_type: mediaType }),
      });
    } catch {
      throw new Error('Messaging coming soon');
    }
  },
};

// ============== MARKETPLACE API ==============
export const marketplaceAPI = {
  getListings: async (category = null, search = null, skip = 0, limit = 20) => {
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (search) params.append('search', search);
      params.append('skip', skip);
      params.append('limit', limit);
      return await apiRequest(`/marketplace/listings?${params}`);
    } catch {
      return [];
    }
  },

  getListing: async (listingId) => {
    try {
      return await apiRequest(`/marketplace/listings/${listingId}`);
    } catch {
      return null;
    }
  },

  createListing: async (data) => {
    try {
      return await apiRequest('/marketplace/listings', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      throw new Error('Marketplace coming soon to mobile API');
    }
  },

  getCategories: async () => {
    try {
      return await apiRequest('/marketplace/categories');
    } catch {
      // Return default categories matching backend
      return [
        { id: 'electronics', name: 'Electronics', icon: 'Smartphone' },
        { id: 'fashion', name: 'Fashion', icon: 'Shirt' },
        { id: 'home', name: 'Home & Garden', icon: 'Home' },
        { id: 'vehicles', name: 'Vehicles', icon: 'Car' },
        { id: 'sports', name: 'Sports', icon: 'Dumbbell' },
        { id: 'digital', name: 'Digital Goods & NFTs', icon: 'Download' },
        { id: 'services', name: 'Services', icon: 'Wrench' },
        { id: 'jewelry', name: 'Jewelry & Watches', icon: 'Watch' },
        { id: 'collectibles', name: 'Collectibles & Art', icon: 'Palette' },
        { id: 'health', name: 'Health & Beauty', icon: 'Heart' },
        { id: 'toys', name: 'Toys & Hobbies', icon: 'Gamepad2' },
        { id: 'business', name: 'Business & Industrial', icon: 'Building2' },
        { id: 'pets', name: 'Pet Supplies', icon: 'PawPrint' },
        { id: 'baby', name: 'Baby Essentials', icon: 'Baby' },
        { id: 'giftcards', name: 'Gift Cards & Coupons', icon: 'Gift' },
        { id: 'tickets', name: 'Tickets & Travel', icon: 'Ticket' },
        { id: 'general', name: 'General', icon: 'Package' },
      ];
    }
  },
};

// ============== RENTALS API ==============
export const rentalsAPI = {
  getProperties: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      return await apiRequest(`/rentals/properties?${params}`);
    } catch {
      return [];
    }
  },

  getProperty: async (propertyId) => {
    try {
      return await apiRequest(`/rentals/properties/${propertyId}`);
    } catch {
      return null;
    }
  },

  createProperty: async (data) => {
    try {
      return await apiRequest('/rentals/properties', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      throw new Error('Rentals coming soon to mobile API');
    }
  },
};

// ============== SERVICES API ==============
export const servicesAPI = {
  getServices: async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== '') params.append(key, value);
      });
      return await apiRequest(`/services?${params}`);
    } catch {
      return [];
    }
  },

  getService: async (serviceId) => {
    try {
      return await apiRequest(`/services/${serviceId}`);
    } catch {
      return null;
    }
  },

  createService: async (data) => {
    try {
      return await apiRequest('/services', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      throw new Error('Services coming soon to mobile API');
    }
  },

  getCategories: async () => {
    try {
      return await apiRequest('/services/categories/list');
    } catch {
      return [
        { id: 'healthcare', name: 'Healthcare', icon: 'Heart' },
        { id: 'home-services', name: 'Home Services', icon: 'Home' },
        { id: 'education', name: 'Education & Tutoring', icon: 'GraduationCap' },
        { id: 'tech', name: 'Tech & IT', icon: 'Laptop' },
        { id: 'beauty', name: 'Beauty & Wellness', icon: 'Sparkles' },
        { id: 'transport', name: 'Transportation', icon: 'Car' },
        { id: 'legal', name: 'Legal Services', icon: 'Scale' },
        { id: 'creative', name: 'Creative Services', icon: 'Palette' },
      ];
    }
  },
};

// ============== GAMES API ==============
export const gamesAPI = {
  spinWheel: async () => {
    try {
      return await apiRequest('/games/spin-wheel', { method: 'POST' });
    } catch {
      throw new Error('Games coming soon to mobile API');
    }
  },

  scratchCard: async () => {
    try {
      return await apiRequest('/games/scratch-card', { method: 'POST' });
    } catch {
      throw new Error('Games coming soon to mobile API');
    }
  },

  memoryMatch: async (moves, timeSeconds) => {
    try {
      return await apiRequest('/games/memory-match', {
        method: 'POST',
        body: JSON.stringify({ moves, time_seconds: timeSeconds }),
      });
    } catch {
      throw new Error('Games coming soon to mobile API');
    }
  },
};

// ============== RAFFLES API ==============
export const rafflesAPI = {
  getRaffles: async (status = 'active') => {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      return await apiRequest(`/raffles?${params}`);
    } catch {
      return [];
    }
  },

  getRaffle: async (raffleId) => {
    try {
      return await apiRequest(`/raffles/${raffleId}`);
    } catch {
      return null;
    }
  },

  enterRaffle: async (raffleId) => {
    try {
      return await apiRequest(`/raffles/${raffleId}/enter`, { method: 'POST' });
    } catch {
      throw new Error('Raffles coming soon to mobile API');
    }
  },
};

// ============== CASINO API ==============
export const casinoAPI = {
  // Slots
  spinSlots: async (amount, lines = 1) => {
    return await apiRequest('/casino/slots/spin', {
      method: 'POST',
      body: JSON.stringify({ amount, lines }),
    });
  },

  // Blackjack
  startBlackjack: async (amount) => {
    return await apiRequest('/casino/blackjack/start', {
      method: 'POST',
      body: JSON.stringify({ amount, game_type: 'blackjack' }),
    });
  },

  blackjackAction: async (gameId, action) => {
    return await apiRequest('/casino/blackjack/action', {
      method: 'POST',
      body: JSON.stringify({ game_id: gameId, action }),
    });
  },

  // Roulette
  spinRoulette: async (bets) => {
    return await apiRequest('/casino/roulette/spin', {
      method: 'POST',
      body: JSON.stringify(bets),
    });
  },

  // Video Poker
  dealPoker: async (amount) => {
    return await apiRequest('/casino/poker/deal', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  drawPoker: async (gameId, hold) => {
    const params = new URLSearchParams();
    params.append('game_id', gameId);
    hold.forEach(h => params.append('hold', h));
    return await apiRequest(`/casino/poker/draw?${params}`, {
      method: 'POST',
    });
  },

  // Baccarat
  playBaccarat: async (amount, betOn) => {
    return await apiRequest('/casino/baccarat/play', {
      method: 'POST',
      body: JSON.stringify({ amount, bet_on: betOn }),
    });
  },

  // Craps
  rollCraps: async (amount, betType) => {
    return await apiRequest('/casino/craps/roll', {
      method: 'POST',
      body: JSON.stringify({ amount, bet_type: betType }),
    });
  },

  // Wheel of Fortune
  spinWheel: async (amount) => {
    return await apiRequest('/casino/wheel/spin', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  },

  // History & Stats
  getHistory: async (limit = 50, gameType = null) => {
    const params = new URLSearchParams();
    params.append('limit', limit);
    if (gameType) params.append('game_type', gameType);
    return await apiRequest(`/casino/history?${params}`);
  },

  getStats: async () => {
    return await apiRequest('/casino/stats');
  },

  getLeaderboard: async (gameType = null) => {
    const params = new URLSearchParams();
    if (gameType) params.append('game_type', gameType);
    return await apiRequest(`/casino/leaderboard?${params}`);
  },

  // Daily Spin
  getDailySpinStatus: async () => {
    return await apiRequest('/casino/daily-spin/status');
  },

  claimDailySpin: async () => {
    return await apiRequest('/casino/daily-spin/claim', { method: 'POST' });
  },
};

// Minting API
export const mintingAPI = {
  // Get current user's minted photos
  getPhotos: async () => {
    return await apiRequest('/minting/photos');
  },
  
  // Get a user's public photos (for profile display)
  getUserPhotos: async (userId) => {
    return await apiRequest(`/minting/photos?user_id=${userId}`);
  },
  
  // Get full stats for a single photo
  getPhotoFullStats: async (mintId) => {
    return await apiRequest(`/minting/photo/${mintId}/full-stats`);
  },
  
  // Get single photo
  getPhoto: async (mintId) => {
    return await apiRequest(`/minting/photo/${mintId}`);
  },
  
  // Mint a new photo
  mintPhoto: async (data) => {
    return await apiRequest('/minting/photo', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  // Submit selfie match
  submitSelfieMatch: async (mintId, selfieData) => {
    return await apiRequest(`/minting/photo/${mintId}/selfie-match`, {
      method: 'POST',
      body: JSON.stringify(selfieData),
    });
  },
  
  // Get authenticity status
  getAuthenticityStatus: async (mintId) => {
    return await apiRequest(`/minting/photo/${mintId}/authenticity`);
  },
};

export default {
  auth: authAPI,
  wallet: walletAPI,
  referrals: referralsAPI,
  posts: postsAPI,
  users: usersAPI,
  messages: messagesAPI,
  marketplace: marketplaceAPI,
  rentals: rentalsAPI,
  services: servicesAPI,
  games: gamesAPI,
  raffles: rafflesAPI,
  casino: casinoAPI,
  minting: mintingAPI,
  getToken,
  setToken,
  removeToken,
  getStoredUser,
  setStoredUser,
  
  // HTTP methods for direct API calls
  get: async (endpoint) => {
    const response = await apiRequest(endpoint, { method: 'GET' });
    return { data: response };
  },
  post: async (endpoint, data, config = {}) => {
    // Handle FormData separately - don't stringify, don't set Content-Type (browser sets it with boundary)
    if (data instanceof FormData) {
      const token = getToken();
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      // Merge any custom headers except Content-Type (let browser handle multipart boundary)
      if (config.headers) {
        Object.keys(config.headers).forEach(key => {
          if (key.toLowerCase() !== 'content-type') {
            headers[key] = config.headers[key];
          }
        });
      }
      
      try {
        const response = await fetch(`${API_BASE_URL}${API_PREFIX}${endpoint}`, {
          method: 'POST',
          headers,
          body: data, // Send FormData directly, not stringified
        });
        
        if (response.status === 401) {
          removeToken();
          removeStoredUser();
          window.location.href = '/login';
          throw new Error('Unauthorized');
        }
        
        const result = await response.json();
        
        if (!response.ok) {
          const errorMessage = result.detail?.message || result.detail || result.message || 'Request failed';
          const error = new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
          error.response = { data: result, status: response.status };
          throw error;
        }
        
        return { data: result };
      } catch (error) {
        if (error.response) throw error;
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
          throw new Error('Failed to fetch - Unable to connect to server');
        }
        throw error;
      }
    }
    
    // Regular JSON request
    const response = await apiRequest(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return { data: response };
  },
  put: async (endpoint, data) => {
    const response = await apiRequest(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return { data: response };
  },
  delete: async (endpoint) => {
    const response = await apiRequest(endpoint, { method: 'DELETE' });
    return { data: response };
  },
};
