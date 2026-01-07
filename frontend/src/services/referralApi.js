// Referral System API Service
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';
const API_PREFIX = '/api';

// Get token from localStorage
const getToken = () => localStorage.getItem('blendlink_token');

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

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || error.message || 'Request failed');
  }

  return response.json();
};

// ============== REFERRAL NETWORK API ==============
export const networkAPI = {
  getMyNetwork: async () => {
    return apiRequest('/referral-system/my-network');
  },

  getStats: async () => {
    return apiRequest('/referral-system/stats');
  },

  applyReferralCode: async (referralCode) => {
    return apiRequest('/referral-system/apply-code', {
      method: 'POST',
      body: JSON.stringify({ referral_code: referralCode }),
    });
  },
};

// ============== COMMISSIONS API ==============
export const commissionsAPI = {
  getMyCommissions: async (skip = 0, limit = 50, status = null) => {
    const params = new URLSearchParams({ skip, limit });
    if (status) params.append('status', status);
    return apiRequest(`/commissions/my-commissions?${params}`);
  },

  getPending: async () => {
    return apiRequest('/commissions/pending');
  },
};

// ============== DIAMOND LEADER API ==============
export const diamondAPI = {
  getStatus: async () => {
    return apiRequest('/diamond/status');
  },

  checkQualification: async () => {
    return apiRequest('/diamond/check-qualification', { method: 'POST' });
  },
};

// ============== ORPHAN QUEUE API ==============
export const orphanAPI = {
  getQueueStatus: async () => {
    return apiRequest('/orphans/queue-status');
  },

  joinQueue: async () => {
    return apiRequest('/orphans/join-queue', { method: 'POST' });
  },
};

// ============== WITHDRAWALS API ==============
export const withdrawalsAPI = {
  checkEligibility: async () => {
    return apiRequest('/withdrawals/eligibility');
  },

  request: async (amount, paymentMethod, paymentDetails = {}) => {
    return apiRequest('/withdrawals/request', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        payment_method: paymentMethod,
        payment_details: paymentDetails,
      }),
    });
  },

  getHistory: async (skip = 0, limit = 20) => {
    return apiRequest(`/withdrawals/history?skip=${skip}&limit=${limit}`);
  },

  startIDVerification: async () => {
    return apiRequest('/withdrawals/verify-id/start', { method: 'POST' });
  },

  getIDVerificationStatus: async () => {
    return apiRequest('/withdrawals/verify-id/status');
  },
};

// ============== ADMIN API ==============
export const adminAPI = {
  getDashboard: async () => {
    return apiRequest('/admin/dashboard');
  },

  getPendingWithdrawals: async () => {
    return apiRequest('/admin/withdrawals/pending');
  },

  approveWithdrawal: async (withdrawalId) => {
    return apiRequest(`/admin/withdrawals/${withdrawalId}/approve`, { method: 'POST' });
  },

  rejectWithdrawal: async (withdrawalId, reason) => {
    return apiRequest(`/admin/withdrawals/${withdrawalId}/reject?reason=${encodeURIComponent(reason)}`, {
      method: 'POST',
    });
  },

  getUsers: async (skip = 0, limit = 50) => {
    return apiRequest(`/admin/users?skip=${skip}&limit=${limit}`);
  },

  setUserAdmin: async (userId, isAdmin) => {
    return apiRequest(`/admin/users/${userId}/set-admin?is_admin=${isAdmin}`, {
      method: 'POST',
    });
  },

  getAnalytics: async () => {
    return apiRequest('/admin/analytics');
  },
};

export default {
  network: networkAPI,
  commissions: commissionsAPI,
  diamond: diamondAPI,
  orphan: orphanAPI,
  withdrawals: withdrawalsAPI,
  admin: adminAPI,
};
