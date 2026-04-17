// Central API configuration — one place to change for deployment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:3000';

export const API = {
  BASE: API_URL,
  ANALYZE: `${API_URL}/api/analyze`,
  ANALYZE_REFERENCE: `${API_URL}/api/analyze-reference`,
  ANALYZE_WORD: `${API_URL}/api/analyze-word-hybrid`,
  AUTH_LOGIN: `${API_URL}/api/auth/login-url`,
  AUTH_CALLBACK: `${API_URL}/api/auth/callback`,
  AUTH_REFRESH: `${API_URL}/api/auth/refresh`,
  AUTH_UPSERT: `${API_URL}/api/auth/upsert-user`,
  DASHBOARD_STATS: `${API_URL}/api/dashboard/stats`,
  DASHBOARD_TAJWEED: `${API_URL}/api/dashboard/tajweed`,
  DASHBOARD_AUDIO: (id) => `${API_URL}/api/dashboard/audio/${id}`,
  PRE_WARM: `${API_URL}/api/pre-warm`,
  // Secure Quran Proxy
  QURAN: (path) => `${API_URL}/api/quran${path}`,
};

export const QURAN_CONTENT_BASE = '/content/api/v4';

export const CALLBACK_URI = `${APP_URL}/callback`;
export const APP_BASE_URL = APP_URL;
