/**
 * Core API utility bridging the React Frontend to the Express.js Backend.
 * Automatically switches between Localhost dev backend and Production URL.
 *
 * Auth behavior:
 * - Every request carries the customer token when present.
 * - On 401 the client attempts ONE silent refresh via /customer/auth/refresh
 *   and retries the original request; if that fails the stale session is
 *   cleared so the UI immediately reflects the logged-out state.
 */
import axios from 'axios';

// Production default is SAME-ORIGIN /api — the Vercel project serves the SPA
// and the API from one domain. Without this, a build made without
// VITE_API_URL shipped pointing at the developer's localhost, so the live
// site asked each visitor's own machine for data and every list came back
// empty.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  // Use customer token for dealership app
  const customerToken = localStorage.getItem('customer_token');
  if (customerToken) {
    config.headers.Authorization = `Bearer ${customerToken}`;
  }

  return config;
});

// Single-flight refresh: concurrent 401s share one refresh request.
let refreshPromise: Promise<string | null> | null = null;

const refreshCustomerToken = (): Promise<string | null> => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = localStorage.getItem('customer_refresh_token');
      if (!refreshToken) return null;
      try {
        const res = await axios.post(`${API_BASE_URL}/customer/auth/refresh`, { refreshToken });
        const { token, refreshToken: newRefreshToken, customer } = res.data;
        if (!token) return null;
        localStorage.setItem('customer_token', token);
        if (newRefreshToken) localStorage.setItem('customer_refresh_token', newRefreshToken);
        if (customer) localStorage.setItem('customer_data', JSON.stringify(customer));
        return token;
      } catch {
        return null;
      } finally {
        setTimeout(() => { refreshPromise = null; }, 0);
      }
    })();
  }
  return refreshPromise;
};

const clearCustomerSession = () => {
  localStorage.removeItem('customer_token');
  localStorage.removeItem('customer_refresh_token');
  localStorage.removeItem('customer_data');
  try {
    window.dispatchEvent(new Event('customer-auth-changed'));
  } catch { /* no-op */ }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const url = String(original.url || '');
    const isAuthCall = url.includes('/customer/auth/');

    // A 401 only says something about the CUSTOMER session when the endpoint
    // actually authenticates customers. Admin-only endpoints 401 customers by
    // design — treating that as "session expired" logged people out of the
    // site because an unrelated upload was rejected.
    const isCustomerScoped = url.includes('/customer/') || url.includes('/my-inquiries');
    if (status === 401 && !isCustomerScoped) {
      return Promise.reject(error);
    }

    if (status === 401 && !original._retried && !isAuthCall) {
      original._retried = true;
      const newToken = await refreshCustomerToken();
      if (newToken) {
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return api.request(original);
      }
      // Refresh failed — the session is genuinely dead.
      clearCustomerSession();
    } else if (status === 401 && original._retried && !isAuthCall) {
      // Refresh succeeded earlier but the retried request still 401'd — the
      // session is unusable, so clear it rather than leaving a stale UI.
      clearCustomerSession();
    }

    return Promise.reject(error);
  }
);

/**
 * Generic fetcher to handle the CORS and JSON parsing
 */
export async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('customer_token');

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}
