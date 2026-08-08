// Customer Authentication Service
import { API_BASE_URL } from './api';

const TOKEN_KEY = 'customer_token';
const REFRESH_KEY = 'customer_refresh_token';
const CUSTOMER_KEY = 'customer_data';
const LAST_EMAIL_KEY = 'customer_last_email';
const LAST_NAME_KEY = 'customer_last_name';

/** Fired on window whenever the customer session changes (login/logout/expiry). */
export const AUTH_CHANGED_EVENT = 'customer-auth-changed';

interface Customer {
  id: string;
  email: string;
  name: string;
  phone?: string;
  district?: string;
}

interface AuthResponse {
  customer: Customer;
  token: string;
  refreshToken?: string;
  message: string;
}

/** Decode a JWT's expiry (seconds since epoch); null when unreadable. */
const decodeTokenExp = (token: string): number | null => {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
};

class CustomerAuthService {
  // Register new customer
  async register(data: {
    email: string;
    password: string;
    name: string;
    phone?: string;
    district?: string;
  }): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/customer/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(await this.readError(response, 'Registration failed'));
    }

    const result = await response.json();
    this.saveAuth(result.token, result.customer, result.refreshToken);
    this.saveLastIdentity(result.customer.email, result.customer.name);
    return result;
  }

  // Login customer
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/customer/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error(await this.readError(response, 'Login failed'));
    }

    const result = await response.json();
    this.saveAuth(result.token, result.customer, result.refreshToken);
    this.saveLastIdentity(email, result.customer?.name);
    return result;
  }

  // Robust error extraction (server may answer with non-JSON on 5xx/proxy errors)
  private async readError(response: Response, fallback: string): Promise<string> {
    try {
      const body = await response.json();
      return body.error || body.message || fallback;
    } catch {
      return response.status === 429
        ? 'Too many attempts. Please try again later.'
        : fallback;
    }
  }

  // Quick check if email exists (boolean only; name comes from local storage)
  async quickCheck(email: string): Promise<{ exists: boolean; name?: string; email?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/customer/auth/quick-check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) return { exists: false };

      const result = await response.json();
      // The server intentionally returns only { exists } — enrich from the
      // identity this device already knows.
      return {
        exists: !!result.exists,
        name: localStorage.getItem(LAST_NAME_KEY) || undefined,
        email,
      };
    } catch (error) {
      return { exists: false };
    }
  }

  /**
   * Verify the session against the server. Returns the fresh profile or null.
   * Use this to gate protected views — never trust localStorage alone.
   */
  async verifySession(): Promise<Customer | null> {
    if (!this.isAuthenticated()) return null;
    try {
      const profile = await this.getProfile();
      this.saveCustomerData(profile);
      return profile;
    } catch {
      return null;
    }
  }

  // Get customer profile
  async getProfile(): Promise<Customer> {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/customer/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        this.clearSession();
      }
      throw new Error('Failed to fetch profile');
    }

    return await response.json();
  }

  // Update profile
  async updateProfile(data: { name?: string; phone?: string; district?: string }): Promise<Customer> {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/customer/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error('Failed to update profile');
    }

    const result = await response.json();
    this.saveCustomerData(result.customer);
    return result.customer;
  }

  /** Attempt a silent token refresh. Returns the new access token or null. */
  async refreshSession(): Promise<string | null> {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (!refreshToken) return null;
    try {
      const response = await fetch(`${API_BASE_URL}/customer/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      if (!response.ok) return null;
      const result = await response.json();
      if (!result.token) return null;
      this.saveAuth(result.token, result.customer, result.refreshToken);
      return result.token;
    } catch {
      return null;
    }
  }

  /**
   * Request a password reset link.
   *
   * Always resolves with the same message whether or not the address is
   * registered — the server refuses to say, so that this form cannot be used
   * to discover which emails have accounts. There is deliberately nothing to
   * branch on here.
   */
  async forgotPassword(email: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/customer/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (!response.ok) {
      throw new Error(await this.readError(response, 'Could not send the reset email'));
    }

    const result = await response.json();
    return result.message as string;
  }

  /** Spend a reset token and set a new password. */
  async resetPassword(token: string, password: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/customer/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password })
    });

    if (!response.ok) {
      throw new Error(await this.readError(response, 'Could not reset your password'));
    }

    const result = await response.json();
    return result.message as string;
  }

  /** Confirm an email address from the link in the signup email. */
  async verifyEmail(token: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/customer/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      throw new Error(await this.readError(response, 'Could not confirm your email address'));
    }

    const result = await response.json();
    return result.message as string;
  }

  /** Re-send the confirmation email to the signed-in customer. */
  async resendVerification(): Promise<string> {
    const token = this.getToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_BASE_URL}/customer/auth/resend-verification`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
      throw new Error(await this.readError(response, 'Could not send the confirmation email'));
    }

    const result = await response.json();
    return result.message as string;
  }

  // Save authentication data
  private saveAuth(token: string, customer: Customer, refreshToken?: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
    this.notifyAuthChanged();
  }

  // Save last used identity (for the quick login prompt on this device)
  private saveLastIdentity(email: string, name?: string): void {
    localStorage.setItem(LAST_EMAIL_KEY, email);
    if (name) localStorage.setItem(LAST_NAME_KEY, name);
  }

  // Get last used email
  getLastEmail(): string | null {
    return localStorage.getItem(LAST_EMAIL_KEY);
  }

  // Save customer data
  private saveCustomerData(customer: Customer): void {
    localStorage.setItem(CUSTOMER_KEY, JSON.stringify(customer));
  }

  // Get token
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  // Get customer data (display cache only — never use for access decisions)
  getCustomer(): Customer | null {
    const data = localStorage.getItem(CUSTOMER_KEY);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Check if authenticated: the token must exist AND not be expired
   * (30s clock-skew buffer). Expired/malformed tokens clear the session so
   * the UI never shows a stale "logged in" state.
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;

    const exp = decodeTokenExp(token);
    if (exp === null || exp * 1000 <= Date.now() + 30_000) {
      this.clearSession();
      return false;
    }
    return true;
  }

  // Logout (revokes the token server-side, best effort)
  logout(): void {
    const token = this.getToken();
    if (token) {
      fetch(`${API_BASE_URL}/customer/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).catch(() => { /* best effort */ });
    }
    this.clearSession();
    // Keep last email/name for quick login
  }

  /** Clear local session state and notify the app. */
  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(CUSTOMER_KEY);
    this.notifyAuthChanged();
  }

  private notifyAuthChanged(): void {
    try {
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
    } catch { /* SSR/test safety */ }
  }

  // Get auth header
  getAuthHeader(): { Authorization: string } | {} {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

export default new CustomerAuthService();
