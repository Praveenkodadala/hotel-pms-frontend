/**
 * Axios API instance
 *
 * FIXES from v2:
 *  - Request interceptor sends X-Property-ID header automatically
 *  - Response interceptor handles PROPERTY_ACCESS_DENIED + NO_PROPERTY_SELECTED
 *  - VITE_API_URL properly used (no hardcoded backend hostname)
 */

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor — attach token + property header ──────────
api.interceptors.request.use((config) => {
  const token      = localStorage.getItem('pms_token');
  const propertyId = localStorage.getItem('pms_active_property_id');

  if (token)      config.headers['Authorization']  = `Bearer ${token}`;
  // This header is read by propertyScope middleware on the backend
  if (propertyId) config.headers['X-Property-ID'] = propertyId;

  return config;
});

// ── Response interceptor — handle auth / property errors ──────────
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const code   = err.response?.data?.code;

    if (status === 401) {
      localStorage.removeItem('pms_token');
      localStorage.removeItem('pms_active_property_id');
      window.location.href = '/login';
    }

    if (status === 403 && code === 'PROPERTY_ACCESS_DENIED') {
      // Cross-property attempt blocked by backend — clear stored property
      console.error('[API] Property access denied by backend. Clearing stored property ID.');
      localStorage.removeItem('pms_active_property_id');
      window.location.href = '/';
    }

    if (status === 400 && code === 'NO_PROPERTY_SELECTED') {
      window.location.href = '/';
    }

    return Promise.reject(err);
  }
);

export default api;
