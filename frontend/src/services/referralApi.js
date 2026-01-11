// Referral System API Service - Updated for new compensation system
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

// ============== REFERRAL/GENEALOGY API ==============
export const referralAPI = {
  // Get genealogy tree (L1 + L2 downlines)
  getGenealogy: async () => {
    return apiRequest('/referral/genealogy');
  },

  // Get commission rates
  getRates: async () => {
    return apiRequest('/referral/commission-rates');
  },

  // Get dashboard overview
  getDashboard: async () => {
    return apiRequest('/referral/dashboard');
  },

  // Claim daily BL coins
  claimDaily: async () => {
    return apiRequest('/referral/daily-claim', { method: 'POST' });
  },

  // Get disclaimer
  getDisclaimer: async () => {
    return apiRequest('/diamond/disclaimer');
  },
};

// ============== DIAMOND LEADER API ==============
export const diamondAPI = {
  // Get diamond status and progress
  getStatus: async () => {
    return apiRequest('/diamond/status');
  },

  // Check and potentially promote to diamond
  checkQualification: async () => {
    return apiRequest('/diamond/check-qualification', { method: 'POST' });
  },
};

// ============== KYC VERIFICATION API ==============
export const kycAPI = {
  // Get KYC status
  getStatus: async () => {
    return apiRequest('/kyc/status');
  },

  // Initialize KYC verification (Stripe Identity)
  initVerification: async (returnUrl) => {
    return apiRequest('/kyc/init', {
      method: 'POST',
      body: JSON.stringify({ return_url: returnUrl }),
    });
  },
};

// ============== WITHDRAWAL API ==============
export const withdrawalAPI = {
  // Get withdrawal eligibility status
  getStatus: async () => {
    return apiRequest('/withdrawal/status');
  },

  // Request withdrawal
  request: async (amount, payoutMethod, bankDetails = {}) => {
    return apiRequest('/withdrawal/request', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        payout_method: payoutMethod,
        bank_name: bankDetails.bank_name,
        account_number: bankDetails.account_number,
        routing_number: bankDetails.routing_number,
        card_last_four: bankDetails.card_last_four,
      }),
    });
  },

  // Get withdrawal history
  getHistory: async (skip = 0, limit = 50) => {
    return apiRequest(`/withdrawal/history?skip=${skip}&limit=${limit}`);
  },
};

// ============== REASSIGNMENT API (Admin) ==============
export const reassignmentAPI = {
  // Request reassignment (admin only)
  request: async (inactiveUserId, newUplineId, reason = '5_year_inactivity') => {
    return apiRequest('/reassignment/request', {
      method: 'POST',
      body: JSON.stringify({
        inactive_user_id: inactiveUserId,
        new_upline_id: newUplineId,
        reason,
      }),
    });
  },

  // List pending reassignment requests (admin only)
  list: async (status = null) => {
    const params = status ? `?status=${status}` : '';
    return apiRequest(`/reassignment/admin/list${params}`);
  },

  // Approve reassignment (admin only)
  approve: async (reassignmentId) => {
    return apiRequest(`/reassignment/admin/approve/${reassignmentId}`, { method: 'POST' });
  },

  // Reject reassignment (admin only)
  reject: async (reassignmentId, reason = 'Rejected by admin') => {
    return apiRequest(`/reassignment/admin/reject/${reassignmentId}?reason=${encodeURIComponent(reason)}`, {
      method: 'POST',
    });
  },
};

export default {
  referral: referralAPI,
  diamond: diamondAPI,
  kyc: kycAPI,
  withdrawal: withdrawalAPI,
  reassignment: reassignmentAPI,
};
