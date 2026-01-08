/**
 * Blendlink Mobile API Service
 * Connects to the same backend as the PWA
 */

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// API Base URL - Uses environment variable (required for deployment)
// Set EXPO_PUBLIC_API_URL in your .env or app.config.js
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE_URL) {
  console.warn('EXPO_PUBLIC_API_URL not set, using default preview URL');
}

// Fallback for development only
const BASE_URL = API_BASE_URL || 'https://blendlink.preview.emergentagent.com';

// Create axios instance
const api = axios.create({
  baseURL: `${BASE_URL}/api`,
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

export default api;
