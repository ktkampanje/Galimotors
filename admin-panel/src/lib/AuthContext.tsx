/**
 * Admin authentication context.
 *
 * SECURITY MODEL: nothing inside a ProtectedRoute renders — not even for one
 * frame — until the server has confirmed the token via GET /auth/me. A token's
 * mere presence in localStorage is never trusted; while verification is in
 * flight only a neutral splash screen is shown.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { api, clearAdminSession } from './api';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

type AuthStatus = 'checking' | 'authed' | 'guest';

interface AuthContextType {
  status: AuthStatus;
  user: AdminUser | null;
  login: (data: { accessToken: string; refreshToken: string; user: AdminUser }) => void;
  logout: () => Promise<void>;
}

const VALID_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN', 'SELLER', 'MARKET_ATTENDANT'];

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [user, setUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    const verify = async () => {
      const token = localStorage.getItem('admin_token');
      if (!token) {
        setStatus('guest');
        return;
      }
      try {
        // Server-side verification — signature, expiry, blacklist, user
        // existence and role are all checked by the backend.
        const res = await api.get('/auth/me');
        if (cancelled) return;
        const verifiedUser: AdminUser = res.data.user;
        if (!verifiedUser || !VALID_ROLES.includes(verifiedUser.role)) {
          clearAdminSession();
          setStatus('guest');
          return;
        }
        localStorage.setItem('admin_user', JSON.stringify(verifiedUser));
        setUser(verifiedUser);
        setStatus('authed');
      } catch {
        if (cancelled) return;
        // 401s are already cleared by the api interceptor; clear again for
        // any other failure mode so a bad token can never linger.
        clearAdminSession();
        setStatus('guest');
      }
    };

    verify();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback((data: { accessToken: string; refreshToken: string; user: AdminUser }) => {
    if (!data.user || !VALID_ROLES.includes(data.user.role)) {
      clearAdminSession();
      throw new Error('This account does not have admin panel access.');
    }
    localStorage.setItem('admin_token', data.accessToken);
    localStorage.setItem('admin_refreshToken', data.refreshToken);
    localStorage.setItem('admin_user', JSON.stringify(data.user));
    setUser(data.user);
    setStatus('authed');
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Best effort — the session is cleared locally regardless.
    }
    clearAdminSession();
    setUser(null);
    setStatus('guest');
  }, []);

  return (
    <AuthContext.Provider value={{ status, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

/** Neutral full-screen splash shown while the session is being verified. */
export const AuthSplash = () => (
  <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-white">
    <div className="w-12 h-12 rounded-2xl bg-coral flex items-center justify-center shadow-lg shadow-coral/25 mb-4">
      <span className="text-gold font-extrabold text-xl">G</span>
    </div>
    <div className="w-6 h-6 border-2 border-gray-200 border-t-coral rounded-full animate-spin" />
  </div>
);
