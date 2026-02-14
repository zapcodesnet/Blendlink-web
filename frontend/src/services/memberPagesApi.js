/**
 * Member Pages API Service
 * 
 * Centralized API service for all member page operations.
 * Uses production-safe "text-first" pattern to prevent body-already-read errors.
 * 
 * Usage:
 *   import { memberPagesApi, safeFetch } from '../services/memberPagesApi';
 *   const pages = await memberPagesApi.getMyPages();
 *   const newPage = await memberPagesApi.createPage({ name: 'My Store', page_type: 'store' });
 *   
 *   // For custom fetch calls in components:
 *   const data = await safeFetch('/api/some-endpoint', { method: 'POST', body: JSON.stringify(data) });
 */

import { getApiUrl } from '../utils/runtimeConfig';

const API_URL = getApiUrl();

// ============== CORE REQUEST HELPER ==============
// Production-safe fetch wrapper with text-first JSON parsing

const getToken = () => localStorage.getItem('blendlink_token');

/**
 * PRODUCTION-SAFE FETCH HELPER
 * Use this for any custom fetch calls in components.
 * Reads response body as text first, then parses to JSON.
 * This prevents "body already used" errors in production proxies.
 * 
 * @param {string} url - Full URL to fetch (use API_URL + endpoint)
 * @param {Object} options - Fetch options (method, body, headers)
 * @returns {Promise<Object>} Parsed JSON response
 */
export const safeFetch = async (url, options = {}) => {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token && !options.skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 1. Make the fetch request
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (networkError) {
    console.error(`[safeFetch] Network error:`, networkError);
    throw new Error('Network error - please check your connection');
  }

  // 2. Read body as TEXT first (production-safe)
  // Handle case where body may have been consumed by proxy/ingress
  let responseText = '';
  try {
    // Check if body is available before trying to read
    if (response.body && !response.bodyUsed) {
      responseText = await response.text();
    } else {
      // Body already consumed (by proxy, service worker, etc.)
      // Create a synthetic error response based on status
      responseText = '';
    }
  } catch (readError) {
    // Body stream error - handle gracefully
    console.warn(`[safeFetch] Body read warning for ${response.status}:`, readError.message);
    responseText = '';
  }

  // 3. Parse text as JSON
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch (parseError) {
    // Some endpoints may return empty or non-JSON
    data = { _rawText: responseText, success: response.ok };
  }

  // 4. Handle HTTP errors
  if (!response.ok) {
    const errorMessage = data?.detail?.message || data?.detail || data?.message || `Request failed (${response.status})`;
    const error = new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

/**
 * Makes an API request with production-safe response handling.
 * Reads response body as text first, then parses to JSON.
 * This prevents "body already used" errors in production proxies.
 * 
 * @param {string} endpoint - API endpoint (will be prefixed with /api)
 * @param {Object} options - Fetch options (method, body, headers)
 * @returns {Promise<Object>} Parsed JSON response
 */
const apiRequest = async (endpoint, options = {}) => {
  return safeFetch(`${API_URL}/api${endpoint}`, options);
};

/**
 * Makes a request that may return empty body (DELETE, etc.)
 */
const apiRequestAllowEmpty = async (endpoint, options = {}) => {
  try {
    return await safeFetch(`${API_URL}/api${endpoint}`, options);
  } catch (error) {
    // For DELETE requests, empty response is OK
    if (error.status === 200 || error.status === 204) {
      return { success: true };
    }
    throw error;
  }
};

// ============== MEMBER PAGES API ==============

export const memberPagesApi = {
  // -------- Pages CRUD --------
  
  /**
   * Get all pages owned by the current user
   */
  getMyPages: () => apiRequest('/member-pages/my-pages'),

  /**
   * Get discoverable/public pages
   */
  getDiscoverPages: () => apiRequest('/member-pages/discover'),

  /**
   * Get a single page by ID
   */
  getPage: (pageId) => apiRequest(`/member-pages/${pageId}`),

  /**
   * Get a public page by slug
   */
  getPublicPage: (slug) => apiRequest(`/member-pages/public/${slug}`),

  /**
   * Create a new member page
   */
  createPage: (pageData) => apiRequest('/member-pages/', {
    method: 'POST',
    body: JSON.stringify(pageData),
  }),

  /**
   * Update a page
   */
  updatePage: (pageId, pageData) => apiRequest(`/member-pages/${pageId}`, {
    method: 'PUT',
    body: JSON.stringify(pageData),
  }),

  /**
   * Delete a page
   */
  deletePage: (pageId) => apiRequestAllowEmpty(`/member-pages/${pageId}`, {
    method: 'DELETE',
  }),

  /**
   * Check if a slug is available
   */
  checkSlug: (slug) => apiRequest(`/member-pages/check-slug/${slug}`),

  // -------- Subscriptions --------
  
  /**
   * Subscribe/follow a page
   */
  followPage: (pageId) => apiRequest(`/member-pages/${pageId}/subscribe`, {
    method: 'POST',
  }),

  /**
   * Unsubscribe/unfollow a page
   */
  unfollowPage: (pageId) => apiRequest(`/member-pages/${pageId}/unsubscribe`, {
    method: 'POST',
  }),

  // -------- Products --------
  
  getProducts: (pageId) => apiRequest(`/page-products/${pageId}`),
  
  createProduct: (pageId, productData) => apiRequest(`/page-products/${pageId}`, {
    method: 'POST',
    body: JSON.stringify(productData),
  }),

  updateProduct: (pageId, productId, productData) => apiRequest(`/page-products/${pageId}/${productId}`, {
    method: 'PUT',
    body: JSON.stringify(productData),
  }),

  deleteProduct: (pageId, productId) => apiRequestAllowEmpty(`/page-products/${pageId}/${productId}`, {
    method: 'DELETE',
  }),

  // -------- Menu Items --------
  
  getMenuItems: (pageId) => apiRequest(`/page-menu/${pageId}`),
  
  createMenuItem: (pageId, menuData) => apiRequest(`/page-menu/${pageId}`, {
    method: 'POST',
    body: JSON.stringify(menuData),
  }),

  updateMenuItem: (pageId, menuId, menuData) => apiRequest(`/page-menu/${pageId}/${menuId}`, {
    method: 'PUT',
    body: JSON.stringify(menuData),
  }),

  deleteMenuItem: (pageId, menuId) => apiRequestAllowEmpty(`/page-menu/${pageId}/${menuId}`, {
    method: 'DELETE',
  }),

  // -------- Services --------
  
  getServices: (pageId) => apiRequest(`/page-services/${pageId}`),
  
  createService: (pageId, serviceData) => apiRequest(`/page-services/${pageId}`, {
    method: 'POST',
    body: JSON.stringify(serviceData),
  }),

  updateService: (pageId, serviceId, serviceData) => apiRequest(`/page-services/${pageId}/${serviceId}`, {
    method: 'PUT',
    body: JSON.stringify(serviceData),
  }),

  deleteService: (pageId, serviceId) => apiRequestAllowEmpty(`/page-services/${pageId}/${serviceId}`, {
    method: 'DELETE',
  }),

  // -------- Rentals --------
  
  getRentals: (pageId) => apiRequest(`/page-rentals/${pageId}`),
  
  createRental: (pageId, rentalData) => apiRequest(`/page-rentals/${pageId}`, {
    method: 'POST',
    body: JSON.stringify(rentalData),
  }),

  updateRental: (pageId, rentalId, rentalData) => apiRequest(`/page-rentals/${pageId}/${rentalId}`, {
    method: 'PUT',
    body: JSON.stringify(rentalData),
  }),

  deleteRental: (pageId, rentalId) => apiRequestAllowEmpty(`/page-rentals/${pageId}/${rentalId}`, {
    method: 'DELETE',
  }),

  // -------- Inventory --------
  
  getInventory: (pageId, lowStockOnly = false) => {
    const params = lowStockOnly ? '?low_stock_only=true' : '';
    return apiRequest(`/page-inventory/${pageId}${params}`);
  },

  updateInventory: (pageId, inventoryData) => apiRequest(`/page-inventory/${pageId}`, {
    method: 'PUT',
    body: JSON.stringify(inventoryData),
  }),

  // -------- Analytics --------
  
  getAnalytics: (pageId, period = '7d') => apiRequest(`/page-analytics/${pageId}?period=${period}`),

  getDailyReport: (pageId, date) => {
    const params = date ? `?date=${date}` : '';
    return apiRequest(`/pages/${pageId}/analytics/daily_report${params}`);
  },

  // -------- POS --------
  
  processTransaction: (pageId, transactionData) => apiRequest(`/pages/${pageId}/pos/transaction`, {
    method: 'POST',
    body: JSON.stringify(transactionData),
  }),

  createStripeCheckout: (pageId, checkoutData) => apiRequest(`/pages/${pageId}/pos/stripe-checkout`, {
    method: 'POST',
    body: JSON.stringify(checkoutData),
  }),

  // -------- Orders --------
  
  getOrders: (pageId, status = null) => {
    const params = status ? `?status=${status}` : '';
    return apiRequest(`/pages/${pageId}/orders${params}`);
  },

  updateOrderStatus: (pageId, orderId, status) => apiRequest(`/pages/${pageId}/orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }),

  // -------- Email Reports --------
  
  getEmailReportSettings: (pageId) => apiRequest(`/pages/${pageId}/email_report_settings`),

  updateEmailReportSettings: (pageId, settings) => apiRequest(`/pages/${pageId}/email_report_settings`, {
    method: 'POST',
    body: JSON.stringify(settings),
  }),

  // -------- Referrals --------
  
  getReferralStats: (pageId) => apiRequest(`/pages/${pageId}/referrals/stats`),

  // -------- Customer Options --------
  
  getCustomerOptions: (pageId) => apiRequest(`/pages/${pageId}/customer_options`),

  updateCustomerOptions: (pageId, options) => apiRequest(`/pages/${pageId}/customer_options`, {
    method: 'PUT',
    body: JSON.stringify(options),
  }),

  // -------- Team Members / Authorized Users --------
  
  getTeamMembers: (pageId) => apiRequest(`/member-pages/${pageId}/team`),

  addTeamMember: (pageId, email) => apiRequest(`/member-pages/${pageId}/team`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),

  removeTeamMember: (pageId, userId) => apiRequestAllowEmpty(`/member-pages/${pageId}/team/${userId}`, {
    method: 'DELETE',
  }),

  checkAuthorization: (pageId) => apiRequest(`/member-pages/${pageId}/authorization`),

  // -------- Platform Fees --------
  
  getPageFees: (pageId) => apiRequest(`/member-pages/${pageId}/fees`),

  // -------- Currency --------
  
  getSupportedCurrencies: () => apiRequest(`/member-pages/currencies/supported`),

  updatePageCurrency: (pageId, currency) => apiRequest(`/member-pages/${pageId}/currency`, {
    method: 'PUT',
    body: JSON.stringify({ currency }),
  }),
};

// Export individual functions for destructuring imports
export const {
  getMyPages,
  getDiscoverPages,
  getPage,
  getPublicPage,
  createPage,
  updatePage,
  deletePage,
  checkSlug,
  followPage,
  unfollowPage,
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  getServices,
  createService,
  updateService,
  deleteService,
  getRentals,
  createRental,
  updateRental,
  deleteRental,
  getInventory,
  updateInventory,
  getAnalytics,
  getDailyReport,
  processTransaction,
  createStripeCheckout,
  getOrders,
  updateOrderStatus,
  getEmailReportSettings,
  updateEmailReportSettings,
  getReferralStats,
  getCustomerOptions,
  updateCustomerOptions,
} = memberPagesApi;

export default memberPagesApi;
