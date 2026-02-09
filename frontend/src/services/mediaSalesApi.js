// Media Sales API Service - Watermarks, Offers, Contracts, Payments
const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || '';

// Get token from localStorage
const getToken = () => localStorage.getItem('blendlink_token');

// PRODUCTION-SAFE API request helper with text-first pattern
const apiRequest = async (endpoint, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (networkError) {
    throw new Error('Network error - please check your connection');
  }

  // PRODUCTION FIX: Read body as text first, then parse JSON
  let responseText;
  try {
    responseText = await response.text();
  } catch (readError) {
    throw new Error('Failed to read server response');
  }

  let data;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (parseError) {
    throw new Error('Server returned invalid response');
  }

  if (!response.ok) {
    throw new Error(data.detail || data.message || 'Request failed');
  }

  return data;
};

// ============== WATERMARK API ==============
export const watermarkAPI = {
  createTemplate: async (data) => {
    return apiRequest('/api/watermark/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getTemplates: async () => {
    return apiRequest('/api/watermark/templates');
  },

  getTemplate: async (watermarkId) => {
    return apiRequest(`/api/watermark/templates/${watermarkId}`);
  },

  updateTemplate: async (watermarkId, data) => {
    return apiRequest(`/api/watermark/templates/${watermarkId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteTemplate: async (watermarkId) => {
    return apiRequest(`/api/watermark/templates/${watermarkId}`, {
      method: 'DELETE',
    });
  },
};

// ============== MEDIA API ==============
export const mediaAPI = {
  upload: async (data) => {
    return apiRequest('/api/media/upload', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getMyMedia: async (skip = 0, limit = 20, status = 'active') => {
    return apiRequest(`/api/media/my-media?skip=${skip}&limit=${limit}&status=${status}`);
  },

  getForSale: async (skip = 0, limit = 20, mediaType = null) => {
    const params = new URLSearchParams({ skip, limit });
    if (mediaType) params.append('media_type', mediaType);
    return apiRequest(`/api/media/for-sale?${params}`);
  },

  getDetail: async (mediaId) => {
    return apiRequest(`/api/media/${mediaId}`);
  },

  delete: async (mediaId) => {
    return apiRequest(`/api/media/${mediaId}`, {
      method: 'DELETE',
    });
  },
};

// ============== OFFERS API ==============
export const offersAPI = {
  create: async (data) => {
    return apiRequest('/api/offers/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getReceived: async (status = null) => {
    const params = status ? `?status=${status}` : '';
    return apiRequest(`/api/offers/received${params}`);
  },

  getSent: async () => {
    return apiRequest('/api/offers/sent');
  },

  accept: async (offerId) => {
    return apiRequest(`/api/offers/${offerId}/accept`, {
      method: 'POST',
    });
  },

  reject: async (offerId) => {
    return apiRequest(`/api/offers/${offerId}/reject`, {
      method: 'POST',
    });
  },
};

// ============== PAYMENTS API ==============
export const paymentsAPI = {
  createCheckout: async (offerId) => {
    return apiRequest(`/api/payments/checkout/${offerId}`, {
      method: 'POST',
      body: JSON.stringify({ origin_url: window.location.origin }),
    });
  },

  getStatus: async (sessionId) => {
    return apiRequest(`/api/payments/status/${sessionId}`);
  },
};

// ============== CONTRACTS API ==============
export const contractsAPI = {
  get: async (contractId) => {
    return apiRequest(`/api/contracts/${contractId}`);
  },

  signAsSeller: async (contractId, signature, signatureType = 'typed') => {
    return apiRequest(`/api/contracts/${contractId}/sign/seller`, {
      method: 'POST',
      body: JSON.stringify({ signature, signature_type: signatureType }),
    });
  },

  signAsBuyer: async (contractId, signature, signatureType = 'typed') => {
    return apiRequest(`/api/contracts/${contractId}/sign/buyer`, {
      method: 'POST',
      body: JSON.stringify({ signature, signature_type: signatureType }),
    });
  },

  download: async (contractId) => {
    return apiRequest(`/api/contracts/${contractId}/download`);
  },

  getSellerContracts: async () => {
    return apiRequest('/api/contracts/my/seller');
  },

  getBuyerContracts: async () => {
    return apiRequest('/api/contracts/my/buyer');
  },
};

export default {
  watermark: watermarkAPI,
  media: mediaAPI,
  offers: offersAPI,
  payments: paymentsAPI,
  contracts: contractsAPI,
};
