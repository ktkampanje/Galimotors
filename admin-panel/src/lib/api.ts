/**
 * Core API utility bridging the React Frontend to the Express.js Backend.
 * Automatically switches between Localhost dev backend and Production URL.
 *
 * Auth behavior:
 * - Every request carries the admin access token.
 * - On 401 the client attempts ONE silent refresh via /auth/refresh and
 *   retries the original request; if that fails the session is cleared and
 *   the browser is sent to the login page (unless already there).
 */
import axios from 'axios';

// Production default is SAME-ORIGIN /api — the Vercel project serves the SPA
// and the API from one domain. A build made without VITE_API_URL used to
// ship pointing at the developer's localhost.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

export const api = axios.create({
  baseURL: API_BASE_URL,
});

const isOnLoginPage = () => window.location.pathname.replace(/\/$/, '').endsWith('/login');

const getAdminLoginPath = () =>
  window.location.pathname.startsWith('/admin') ? '/admin/login' : '/login';

export const clearAdminSession = () => {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_refreshToken');
  localStorage.removeItem('admin_user');
};

const redirectToLogin = () => {
  if (!isOnLoginPage()) {
    window.location.href = getAdminLoginPath();
  }
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Cache-buster on GETs: public endpoints are edge-cached for speed
  // (vercel.json s-maxage), but the admin must always see fresh data —
  // especially their own edit reflected in the refetch right after saving.
  // A unique URL per request bypasses every cache layer.
  if ((config.method || 'get').toLowerCase() === 'get') {
    config.params = { ...(config.params || {}), _t: Date.now() };
  }
  return config;
});

// Single-flight refresh: concurrent 401s share one refresh request.
let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem('admin_refreshToken');
      if (!refreshToken) return null;
      try {
        // Raw axios (not `api`) so interceptors cannot recurse.
        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = res.data;
        if (!accessToken) return null;
        localStorage.setItem('admin_token', accessToken);
        if (newRefreshToken) localStorage.setItem('admin_refreshToken', newRefreshToken);
        return accessToken;
      } catch {
        return null;
      } finally {
        // Allow the next expiry to trigger a fresh attempt.
        setTimeout(() => { refreshPromise = null; }, 0);
      }
    })();
  }
  return refreshPromise;
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const url = String(original.url || '');
    const isAuthCall = url.includes('/auth/refresh') || url.includes('/auth/login');

    if (status === 401 && !original._retried && !isAuthCall) {
      original._retried = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return api.request(original);
      }
    }

    if (status === 401) {
      clearAdminSession();
      // /auth/me failures are handled by AuthProvider (soft SPA redirect);
      // everything else gets a hard redirect to login.
      if (!url.includes('/auth/me')) {
        redirectToLogin();
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Generic fetcher to handle the CORS and JSON parsing
 */
export async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  // Get JWT token from localStorage with admin_ prefix
  const token = localStorage.getItem('admin_token');

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    // Handle 401 Unauthorized - redirect to login
    if (response.status === 401) {
      clearAdminSession();
      redirectToLogin();
    }
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}
