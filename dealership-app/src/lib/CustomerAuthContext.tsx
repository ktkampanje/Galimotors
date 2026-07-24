/**
 * Customer authentication context for the dealership app.
 *
 * Central source of truth for "is the customer logged in". Components read
 * from here instead of sampling localStorage once on mount, so login / logout
 * / token-expiry propagate everywhere immediately — no page reloads, no stale
 * avatar, no cross-user data leaking on shared devices.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import customerAuthService, { AUTH_CHANGED_EVENT } from './customerAuthService';

interface Customer {
  id: string;
  email: string;
  name: string;
  phone?: string;
  district?: string;
}

interface CustomerAuthContextType {
  isAuthenticated: boolean;
  customer: Customer | null;
  refresh: () => void;
  logout: () => void;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(undefined);

export const useCustomerAuth = () => {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error('useCustomerAuth must be used within CustomerAuthProvider');
  return ctx;
};

const readState = () => ({
  isAuthenticated: customerAuthService.isAuthenticated(),
  customer: customerAuthService.isAuthenticated() ? customerAuthService.getCustomer() : null,
});

export const CustomerAuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState(readState);

  const refresh = useCallback(() => setState(readState()), []);

  const logout = useCallback(() => {
    customerAuthService.logout();
    setState(readState());
  }, []);

  useEffect(() => {
    // In-app auth changes (login/logout/expiry) fire this event.
    const onAuthChanged = () => refresh();
    // Cross-tab: another tab logging in/out mutates localStorage.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'customer_token' || e.key === null) refresh();
    };
    // Passive expiry: re-check when the tab regains focus/visibility, which
    // catches a token that lapsed while the tab was idle or backgrounded.
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };

    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onAuthChanged);
    document.addEventListener('visibilitychange', onVisible);

    // Schedule a re-check exactly when the current token expires, so the UI
    // flips to logged-out the moment it lapses even if the tab stays open.
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const token = localStorage.getItem('customer_token');
    if (token) {
      try {
        const payload = token.split('.')[1];
        const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        if (typeof exp === 'number') {
          const ms = exp * 1000 - Date.now() + 1000; // +1s past the skew buffer
          if (ms > 0 && ms < 2_147_483_647) expiryTimer = setTimeout(refresh, ms);
        }
      } catch { /* malformed token — isAuthenticated() will clear it */ }
    }

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onAuthChanged);
      document.removeEventListener('visibilitychange', onVisible);
      if (expiryTimer) clearTimeout(expiryTimer);
    };
  }, [refresh, state.isAuthenticated]);

  return (
    <CustomerAuthContext.Provider
      value={{ isAuthenticated: state.isAuthenticated, customer: state.customer, refresh, logout }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
};
