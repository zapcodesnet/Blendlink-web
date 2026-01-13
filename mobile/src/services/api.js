/**
 * Blendlink Mobile API Service
 * Connects to the same backend as the PWA
 */

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// API Base URL - Uses environment variable (required for deployment)
// Set EXPO_PUBLIC_API_URL in your .env or app.config.js
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// Validate API URL is set (fail fast in production)
if (!API_BASE_URL) {
  console.warn('WARNING: EXPO_PUBLIC_API_URL not set. Using preview URL for development.');
}

// Use environment variable - require it in production
const BASE_URL = API_BASE_URL;
if (!BASE_URL) {
  console.error('EXPO_PUBLIC_API_URL environment variable is required');
  // For development, show warning but continue with a placeholder
  // In production, this will fail properly
}

// Create axios instance
const api = axios.create({
  baseURL: `${BASE_URL || ''}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Token management
const TOKEN_KEY = 'blendlink_token';
const USER_KEY = 'blendlink_user';

export const getToken = async () => {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.error('Error getting token:', error);
    return null;
  }
};

export const setToken = async (token) => {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch (error) {
    console.error('Error setting token:', error);
  }
};

export const removeToken = async () => {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch (error) {
    console.error('Error removing token:', error);
  }
};

export const getStoredUser = async () => {
  try {
    const user = await SecureStore.getItemAsync(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

export const setStoredUser = async (user) => {
  try {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.error('Error setting user:', error);
  }
};

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await removeToken();
    }
    return Promise.reject(error);
  }
);

// ============== AUTH API ==============

export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.token) {
      await setToken(response.data.token);
      await setStoredUser(response.data.user);
    }
    return response.data;
  },

  // Admin login - simple password-based authentication
  adminLogin: async (email, password) => {
    const response = await api.post('/admin-auth/secure/login', { email, password });
    if (response.data.token) {
      await setToken(response.data.token);
      await setStoredUser(response.data.user);
    }
    return response.data;
  },

  // Check admin session
  checkAdminSession: async () => {
    const response = await api.get('/admin-auth/secure/check-session');
    return response.data;
  },

  register: async (data) => {
    const response = await api.post('/auth/register', data);
    if (response.data.token) {
      await setToken(response.data.token);
    }
    return response.data;
  },

  logout: async () => {
    await removeToken();
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// ============== SOCIAL API ==============

export const socialAPI = {
  // Feed
  getFeed: async (skip = 0, limit = 20) => {
    const response = await api.get(`/social/feed?skip=${skip}&limit=${limit}`);
    return response.data;
  },

  // Posts
  createPost: async (data) => {
    const response = await api.post('/social/posts', data);
    return response.data;
  },

  getPost: async (postId) => {
    const response = await api.get(`/social/posts/${postId}`);
    return response.data;
  },

  deletePost: async (postId) => {
    const response = await api.delete(`/social/posts/${postId}`);
    return response.data;
  },

  // Reactions
  reactToPost: async (postId, reactionType) => {
    const response = await api.post(`/social/posts/${postId}/react`, { reaction_type: reactionType });
    return response.data;
  },

  getReactions: async (postId) => {
    const response = await api.get(`/social/posts/${postId}/reactions`);
    return response.data;
  },

  // Comments
  createComment: async (postId, content, parentId = null) => {
    const response = await api.post(`/social/posts/${postId}/comments`, {
      content,
      parent_comment_id: parentId,
    });
    return response.data;
  },

  getComments: async (postId) => {
    const response = await api.get(`/social/posts/${postId}/comments`);
    return response.data;
  },

  // Share
  sharePost: async (postId, content = '', privacy = 'public') => {
    const response = await api.post(`/social/posts/${postId}/share`, { content, privacy });
    return response.data;
  },

  // Stories
  getStories: async () => {
    const response = await api.get('/stories/');
    return response.data;
  },

  createStory: async (mediaType, mediaUrl, privacy = 'public') => {
    const response = await api.post('/stories/', { media_type: mediaType, media_url: mediaUrl, privacy });
    return response.data;
  },

  viewStory: async (storyId) => {
    const response = await api.post(`/stories/${storyId}/view`);
    return response.data;
  },

  // User posts
  getUserPosts: async (userId, skip = 0, limit = 20) => {
    const response = await api.get(`/social/user/${userId}/posts?skip=${skip}&limit=${limit}`);
    return response.data;
  },
};

// ============== FRIENDS API ==============

export const friendsAPI = {
  getFriends: async () => {
    const response = await api.get('/friends/');
    return response.data;
  },

  getFriendRequests: async () => {
    const response = await api.get('/friends/requests');
    return response.data;
  },

  sendFriendRequest: async (userId) => {
    const response = await api.post(`/friends/request/${userId}`);
    return response.data;
  },

  acceptFriendRequest: async (requestId) => {
    const response = await api.post(`/friends/accept/${requestId}`);
    return response.data;
  },

  declineFriendRequest: async (requestId) => {
    const response = await api.post(`/friends/decline/${requestId}`);
    return response.data;
  },

  unfriend: async (friendId) => {
    const response = await api.delete(`/friends/${friendId}`);
    return response.data;
  },

  searchUsers: async (query) => {
    const response = await api.get(`/friends/search?query=${encodeURIComponent(query)}`);
    return response.data;
  },
};

// ============== GROUPS API ==============

export const groupsAPI = {
  getGroups: async () => {
    const response = await api.get('/groups/');
    return response.data;
  },

  createGroup: async (data) => {
    const response = await api.post('/groups/', data);
    return response.data;
  },

  joinGroup: async (groupId) => {
    const response = await api.post(`/groups/${groupId}/join`);
    return response.data;
  },

  leaveGroup: async (groupId) => {
    const response = await api.post(`/groups/${groupId}/leave`);
    return response.data;
  },
};

// ============== PAGES API ==============

export const pagesAPI = {
  getPages: async () => {
    const response = await api.get('/pages/');
    return response.data;
  },

  createPage: async (data) => {
    const response = await api.post('/pages/', data);
    return response.data;
  },

  subscribe: async (pageId) => {
    const response = await api.post(`/pages/${pageId}/subscribe`);
    return response.data;
  },

  unsubscribe: async (pageId) => {
    const response = await api.post(`/pages/${pageId}/unsubscribe`);
    return response.data;
  },
};

// ============== EVENTS API ==============

export const eventsAPI = {
  getEvents: async () => {
    const response = await api.get('/events/');
    return response.data;
  },

  createEvent: async (data) => {
    const response = await api.post('/events/', data);
    return response.data;
  },

  rsvp: async (eventId, status) => {
    const response = await api.post(`/events/${eventId}/rsvp?status=${status}`);
    return response.data;
  },
};

// ============== WALLET API ==============

export const walletAPI = {
  getBalance: async () => {
    const response = await api.get('/wallet/balance');
    return response.data;
  },

  getTransactions: async () => {
    const response = await api.get('/wallet/transactions');
    return response.data;
  },

  claimDaily: async () => {
    const response = await api.post('/wallet/claim-daily');
    return response.data;
  },
};

// ============== AI MEDIA API ==============

export const aiMediaAPI = {
  estimateCost: async (prompt, mediaType, duration = null) => {
    const response = await api.post('/ai-media/estimate-cost', { prompt, media_type: mediaType, duration });
    return response.data;
  },

  generate: async (prompt, mediaType, duration = null) => {
    const response = await api.post('/ai-media/generate', { prompt, media_type: mediaType, duration });
    return response.data;
  },

  getMyGenerations: async () => {
    const response = await api.get('/ai-media/my-generations');
    return response.data;
  },
};

// ============== MARKETPLACE API ==============

export const marketplaceAPI = {
  getListings: async (category = null) => {
    const url = category ? `/marketplace/listings?category=${category}` : '/marketplace/listings';
    const response = await api.get(url);
    return response.data;
  },

  getListing: async (id) => {
    const response = await api.get(`/marketplace/listings/${id}`);
    return response.data;
  },

  createListing: async (data) => {
    const response = await api.post('/marketplace/listings', data);
    return response.data;
  },

  getCategories: async () => {
    const response = await api.get('/marketplace/categories');
    return response.data;
  },
};

// ============== REFERRAL API ==============

export const referralAPI = {
  getMyNetwork: async () => {
    const response = await api.get('/referral-system/my-network');
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/referral-system/stats');
    return response.data;
  },

  applyCode: async (code) => {
    const response = await api.post('/referral-system/apply-code', { referral_code: code });
    return response.data;
  },
};

// ============== NOTIFICATIONS API ==============

export const notificationsAPI = {
  getNotifications: async (skip = 0, limit = 50, unreadOnly = false) => {
    const response = await api.get(`/notifications/?skip=${skip}&limit=${limit}&unread_only=${unreadOnly}`);
    return response.data;
  },

  markAsRead: async (notificationIds) => {
    const response = await api.post('/notifications/mark-read', { notification_ids: notificationIds });
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.post('/notifications/mark-all-read');
    return response.data;
  },

  deleteNotification: async (notificationId) => {
    const response = await api.delete(`/notifications/${notificationId}`);
    return response.data;
  },

  registerPushToken: async (expoPushToken, deviceType = 'unknown') => {
    const response = await api.post('/notifications/register-token', { 
      expo_push_token: expoPushToken, 
      device_type: deviceType 
    });
    return response.data;
  },

  getSettings: async () => {
    const response = await api.get('/notifications/settings');
    return response.data;
  },

  updateSettings: async (settings) => {
    const response = await api.put('/notifications/settings', settings);
    return response.data;
  },
};

// ============== ANALYTICS API ==============

export const analyticsAPI = {
  getSummary: async () => {
    const response = await api.get('/analytics/summary');
    return response.data;
  },

  getMyStats: async (days = 30) => {
    const response = await api.get(`/analytics/my-stats?days=${days}`);
    return response.data;
  },

  getTrends: async (days = 30) => {
    const response = await api.get(`/analytics/trends?days=${days}`);
    return response.data;
  },

  getLeaderboard: async (metric = 'bl_coins_earned', days = 7, limit = 20) => {
    const response = await api.get(`/analytics/leaderboard?metric=${metric}&days=${days}&limit=${limit}`);
    return response.data;
  },

  trackSession: async () => {
    const response = await api.post('/analytics/track-session');
    return response.data;
  },

  trackTime: async (minutes) => {
    const response = await api.post(`/analytics/track-time?minutes=${minutes}`);
    return response.data;
  },
};

// ============== CASINO API ==============

export const casinoAPI = {
  // Slots
  spinSlots: async (amount, lines = 1) => {
    const response = await api.post('/casino/slots/spin', { amount, lines });
    return response.data;
  },

  // Blackjack
  startBlackjack: async (amount) => {
    const response = await api.post('/casino/blackjack/start', { amount, game_type: 'blackjack' });
    return response.data;
  },

  blackjackAction: async (gameId, action) => {
    const response = await api.post('/casino/blackjack/action', { game_id: gameId, action });
    return response.data;
  },

  // Roulette
  spinRoulette: async (bets) => {
    const response = await api.post('/casino/roulette/spin', bets);
    return response.data;
  },

  // Video Poker
  dealPoker: async (amount) => {
    const response = await api.post('/casino/poker/deal', { amount });
    return response.data;
  },

  drawPoker: async (gameId, hold) => {
    const params = new URLSearchParams();
    params.append('game_id', gameId);
    hold.forEach(h => params.append('hold', h));
    const response = await api.post(`/casino/poker/draw?${params}`);
    return response.data;
  },

  // Baccarat
  playBaccarat: async (amount, betOn) => {
    const response = await api.post('/casino/baccarat/play', { amount, bet_on: betOn });
    return response.data;
  },

  // Craps
  rollCraps: async (amount, betType) => {
    const response = await api.post('/casino/craps/roll', { amount, bet_type: betType });
    return response.data;
  },

  // Wheel of Fortune
  spinWheel: async (amount) => {
    const response = await api.post('/casino/wheel/spin', { amount });
    return response.data;
  },

  // Daily Spin
  getDailySpinStatus: async () => {
    const response = await api.get('/casino/daily-spin/status');
    return response.data;
  },

  claimDailySpin: async () => {
    const response = await api.post('/casino/daily-spin/claim');
    return response.data;
  },

  // History & Stats
  getHistory: async (limit = 50, gameType = null) => {
    const params = new URLSearchParams();
    params.append('limit', limit);
    if (gameType) params.append('game_type', gameType);
    const response = await api.get(`/casino/history?${params}`);
    return response.data;
  },

  getStats: async () => {
    const response = await api.get('/casino/stats');
    return response.data;
  },

  getLeaderboard: async (gameType = null) => {
    const params = new URLSearchParams();
    if (gameType) params.append('game_type', gameType);
    const response = await api.get(`/casino/leaderboard?${params}`);
    return response.data;
  },
};

// ============== ADMIN API ==============

export const adminAPI = {
  // ============== NEW PRODUCTION ADMIN API ==============
  // Uses the new /api/admin/* endpoints for real-time production data
  
  // Profile & Dashboard (keep legacy endpoint for basic dashboard)
  getProfile: async () => {
    const response = await api.get('/admin-system/profile');
    return response.data;
  },

  getDashboard: async () => {
    const response = await api.get('/admin-system/dashboard');
    return response.data;
  },

  // Real-time Metrics
  getRealtimeMetrics: async () => {
    const response = await api.get('/realtime/metrics');
    return response.data;
  },

  // ============== USER MANAGEMENT (NEW ENDPOINTS) ==============
  searchUsers: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.query) queryParams.append('query', params.query);
    if (params.status) queryParams.append('status', params.status);
    if (params.skip !== undefined) queryParams.append('skip', params.skip);
    if (params.limit !== undefined) queryParams.append('limit', params.limit);
    const response = await api.get(`/admin/users/search?${queryParams}`);
    return response.data;
  },

  getUser: async (userId) => {
    const response = await api.get(`/admin/users/${userId}`);
    return response.data;
  },

  suspendUser: async (userId, reason, days = 7) => {
    const response = await api.post(`/admin/users/${userId}/suspend`, { reason, days });
    return response.data;
  },

  unsuspendUser: async (userId) => {
    const response = await api.post(`/admin/users/${userId}/unsuspend`);
    return response.data;
  },

  banUser: async (userId, reason) => {
    const response = await api.post(`/admin/users/${userId}/ban`, { reason });
    return response.data;
  },

  unbanUser: async (userId) => {
    const response = await api.post(`/admin/users/${userId}/unban`);
    return response.data;
  },

  resetUserPassword: async (userId, newPassword) => {
    const response = await api.post(`/admin/users/${userId}/reset-password`, { new_password: newPassword });
    return response.data;
  },

  forceLogout: async (userId) => {
    const response = await api.post(`/admin/users/${userId}/force-logout`);
    return response.data;
  },

  // Legacy endpoint for backward compatibility
  getUsers: async (skip = 0, limit = 50, status = null, search = null) => {
    const params = { skip, limit };
    if (status) params.status = status;
    if (search) params.query = search;
    return adminAPI.searchUsers(params);
  },

  updateUserStatus: async (userId, action) => {
    const response = await api.put(`/admin-system/users/${userId}/status`, { action });
    return response.data;
  },

  // ============== FINANCIAL MANAGEMENT (NEW ENDPOINTS) ==============
  getFinancialOverview: async () => {
    const response = await api.get('/admin/finance/overview');
    return response.data;
  },

  adjustBalance: async (userId, currency, amount, reason) => {
    const response = await api.post(`/admin/finance/adjust-balance/${userId}`, { currency, amount, reason });
    return response.data;
  },

  getTransactions: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.user_id) queryParams.append('user_id', params.user_id);
    if (params.type) queryParams.append('type', params.type);
    if (params.skip !== undefined) queryParams.append('skip', params.skip);
    if (params.limit !== undefined) queryParams.append('limit', params.limit);
    const response = await api.get(`/admin/finance/transactions?${queryParams}`);
    return response.data;
  },

  // ============== GENEALOGY MANAGEMENT (NEW ENDPOINTS) ==============
  getGenealogyTree: async (userId = null, maxDepth = 3) => {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId);
    params.append('max_depth', maxDepth);
    const response = await api.get(`/admin/genealogy/tree?${params}`);
    return response.data;
  },

  getUserNetwork: async (userId) => {
    const response = await api.get(`/admin/genealogy/user/${userId}/network`);
    return response.data;
  },

  getOrphans: async () => {
    const response = await api.get('/admin/genealogy/orphans');
    return response.data;
  },

  reassignDownline: async (userId, newUplineId, reason) => {
    const response = await api.post('/admin/genealogy/reassign', { user_id: userId, new_upline_id: newUplineId, reason });
    return response.data;
  },

  // ============== ADMIN ROLE MANAGEMENT (NEW ENDPOINTS) ==============
  listAdmins: async () => {
    const response = await api.get('/admin/roles/admins');
    return response.data;
  },

  createAdmin: async (userId, role, permissions = {}) => {
    const response = await api.post('/admin/roles/admins', { user_id: userId, role, permissions });
    return response.data;
  },

  updateAdmin: async (adminId, updates) => {
    const response = await api.put(`/admin/roles/admins/${adminId}`, updates);
    return response.data;
  },

  deleteAdmin: async (adminId) => {
    const response = await api.delete(`/admin/roles/admins/${adminId}`);
    return response.data;
  },

  // Legacy endpoint for backward compatibility
  getAdmins: async () => {
    return adminAPI.listAdmins();
  },

  updateAdminRole: async (adminId, role) => {
    return adminAPI.updateAdmin(adminId, { role });
  },

  // ============== SYSTEM & ANALYTICS (NEW ENDPOINTS) ==============
  getAnalytics: async (period = '7d') => {
    const response = await api.get(`/admin/system/analytics?period=${period}`);
    return response.data;
  },

  getActivityFeed: async (limit = 50) => {
    const response = await api.get(`/admin/system/activity-feed?limit=${limit}`);
    return response.data;
  },

  getSystemHealth: async () => {
    const response = await api.get('/admin/system/health');
    return response.data;
  },

  // Legacy audit logs endpoint
  getAuditLogs: async (skip = 0, limit = 50, action = null) => {
    const params = new URLSearchParams();
    params.append('skip', skip);
    params.append('limit', limit);
    if (action) params.append('action', action);
    const response = await api.get(`/admin-system/audit-logs?${params}`);
    return response.data;
  },

  // ============== WITHDRAWALS (NEW ENDPOINTS) ==============
  getWithdrawals: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.skip !== undefined) queryParams.append('skip', params.skip);
    if (params.limit !== undefined) queryParams.append('limit', params.limit);
    const response = await api.get(`/admin/withdrawals/list?${queryParams}`);
    return response.data;
  },

  getWithdrawalStats: async () => {
    const response = await api.get('/admin/withdrawals/stats/summary');
    return response.data;
  },

  getPendingKYC: async () => {
    const response = await api.get('/admin/withdrawals/kyc/pending');
    return response.data;
  },

  approveKYC: async (userId) => {
    const response = await api.post(`/admin/withdrawals/kyc/${userId}/approve`);
    return response.data;
  },

  rejectKYC: async (userId, reason) => {
    const response = await api.post(`/admin/withdrawals/kyc/${userId}/reject`, { reason });
    return response.data;
  },

  approveWithdrawal: async (withdrawalId) => {
    const response = await api.post(`/admin/withdrawals/${withdrawalId}/approve`);
    return response.data;
  },

  rejectWithdrawal: async (withdrawalId, reason) => {
    const response = await api.post(`/admin/withdrawals/${withdrawalId}/reject`, { reason });
    return response.data;
  },

  // ============== SETTINGS ==============
  getSettings: async () => {
    const response = await api.get('/admin-system/settings');
    return response.data;
  },

  updateSettings: async (settings) => {
    const response = await api.put('/admin-system/settings', settings);
    return response.data;
  },

  // ============== A/B TESTING ==============
  getABTests: async (status = null) => {
    const url = status ? `/ab-testing/tests?status=${status}` : '/ab-testing/tests';
    const response = await api.get(url);
    return response.data;
  },

  getABTest: async (testId) => {
    const response = await api.get(`/ab-testing/tests/${testId}`);
    return response.data;
  },

  createABTest: async (data) => {
    const response = await api.post('/ab-testing/tests', data);
    return response.data;
  },

  updateABTestStatus: async (testId, status) => {
    const response = await api.put(`/ab-testing/tests/${testId}/status?status=${status}`);
    return response.data;
  },

  deleteABTest: async (testId) => {
    const response = await api.delete(`/ab-testing/tests/${testId}`);
    return response.data;
  },

  getMyABAssignment: async (testId) => {
    const response = await api.get(`/ab-testing/assignment/${testId}`);
    return response.data;
  },

  trackABConversion: async (testId, conversionType = 'default') => {
    const response = await api.post(`/ab-testing/conversion/${testId}?conversion_type=${conversionType}`);
    return response.data;
  },

  // Biometric Authentication
  registerBiometric: async (deviceId, deviceName, credentialType, publicKey, platform) => {
    const response = await api.post('/biometric/register', {
      device_id: deviceId,
      device_name: deviceName,
      credential_type: credentialType,
      public_key: publicKey,
      platform: platform,
    });
    return response.data;
  },

  getBiometricChallenge: async (deviceId) => {
    const response = await api.get(`/biometric/challenge?device_id=${deviceId}`);
    return response.data;
  },

  authenticateBiometric: async (deviceId, credentialId, signature) => {
    const response = await api.post('/biometric/authenticate', {
      device_id: deviceId,
      credential_id: credentialId,
      signature: signature,
    });
    return response.data;
  },

  getBiometricCredentials: async () => {
    const response = await api.get('/biometric/credentials');
    return response.data;
  },

  revokeBiometricCredential: async (credentialId) => {
    const response = await api.delete(`/biometric/credentials/${credentialId}`);
    return response.data;
  },
};

// ============== POKER TOURNAMENT API ==============

export const pokerAPI = {
  // Get open tournaments
  getTournaments: async () => {
    const response = await api.get('/poker/tournaments');
    return response.data;
  },

  // Get specific tournament
  getTournament: async (tournamentId) => {
    const response = await api.get(`/poker/tournaments/${tournamentId}`);
    return response.data;
  },

  // Get my current tournament
  getMyTournament: async () => {
    const response = await api.get('/poker/my-tournament');
    return response.data;
  },

  // Create new tournament
  createTournament: async (name = 'PKO Tournament') => {
    const response = await api.post('/poker/tournaments/create', { name });
    return response.data;
  },

  // Register for tournament
  registerForTournament: async (tournamentId) => {
    const response = await api.post('/poker/tournaments/register', { tournament_id: tournamentId });
    return response.data;
  },

  // Add AI bots (creator only)
  addBots: async (tournamentId, botCount) => {
    const response = await api.post(`/poker/tournaments/${tournamentId}/add-bots?bot_count=${botCount}`);
    return response.data;
  },

  // Force start tournament
  forceStart: async (tournamentId) => {
    const response = await api.post(`/poker/tournaments/${tournamentId}/force-start`);
    return response.data;
  },

  // Player action (fold, check, call, bet, raise, all_in)
  playerAction: async (tournamentId, action, amount = 0) => {
    const response = await api.post('/poker/tournaments/action', {
      tournament_id: tournamentId,
      action: action,
      amount: amount,
    });
    return response.data;
  },

  // Rebuy
  rebuy: async (tournamentId) => {
    const response = await api.post('/poker/tournaments/rebuy', { tournament_id: tournamentId });
    return response.data;
  },

  // Leave tournament
  leaveTournament: async (tournamentId) => {
    const response = await api.post('/poker/tournaments/leave', { tournament_id: tournamentId });
    return response.data;
  },

  // Send chat message
  sendChat: async (tournamentId, message) => {
    const response = await api.post('/poker/tournaments/chat', {
      tournament_id: tournamentId,
      message: message,
    });
    return response.data;
  },

  // Get leaderboard
  getLeaderboard: async () => {
    const response = await api.get('/poker/leaderboard');
    return response.data;
  },

  // Get player history
  getHistory: async () => {
    const response = await api.get('/poker/my-history');
    return response.data;
  },
};

export default api;
