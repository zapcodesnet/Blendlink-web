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
export const setStoredUser = (user) => localStorage.setItem(USER_KEY, JSON.stringify(user));
export const removeStoredUser = () => localStorage.removeItem(USER_KEY);

// API request helper
const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

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

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.detail || data.message || 'Request failed');
  }

  return data;
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

  // Handle Google OAuth callback
  handleGoogleCallback: async (sessionId) => {
    // Get user data from Emergent Auth service
    const response = await fetch(
      'https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data',
      { headers: { 'X-Session-ID': sessionId } }
    );
    if (!response.ok) throw new Error('Google auth failed');
    const googleData = await response.json();
    
    // Try to login with Google email first
    try {
      const loginResult = await apiRequest('/auth/google', {
        method: 'POST',
        body: JSON.stringify({
          email: googleData.email,
          name: googleData.name,
          picture: googleData.picture,
          google_id: googleData.id,
        }),
      });
      
      const authToken = loginResult.token || loginResult.access_token;
      if (authToken) {
        setToken(authToken);
        if (loginResult.user) {
          setStoredUser(loginResult.user);
        }
      }
      return loginResult;
    } catch (error) {
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
      // Return default categories
      return [
        { id: 'electronics', name: 'Electronics', icon: 'Smartphone' },
        { id: 'fashion', name: 'Fashion', icon: 'Shirt' },
        { id: 'home', name: 'Home & Garden', icon: 'Home' },
        { id: 'vehicles', name: 'Vehicles', icon: 'Car' },
        { id: 'sports', name: 'Sports', icon: 'Dumbbell' },
        { id: 'digital', name: 'Digital Goods', icon: 'Download' },
        { id: 'services', name: 'Services', icon: 'Wrench' },
        { id: 'other', name: 'Other', icon: 'Package' },
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
  getToken,
  setToken,
  removeToken,
  getStoredUser,
  setStoredUser,
};
