import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import customerAuthService from '../lib/customerAuthService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
}

export const LoginModal: React.FC<Props> = ({ isOpen, onClose, onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Reset lives inside this modal rather than as another entry in App's modal
  // plumbing: it is the same email field in the same frame, and someone who
  // has just failed to sign in is already looking at it.
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [notice, setNotice] = useState('');

  // Reopening always lands on sign-in, never on whatever state the previous
  // visit was abandoned in.
  useEffect(() => {
    if (isOpen) {
      setMode('login');
      setError('');
      setNotice('');
      setPassword('');
    }
  }, [isOpen]);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);

    try {
      // The server answers identically for known and unknown addresses, so
      // this message is shown verbatim — there is no success/failure to tell
      // apart, by design.
      setNotice(await customerAuthService.forgotPassword(email));
    } catch (err: any) {
      setError(err.message || 'Could not send the reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await customerAuthService.login(email, password);
      
      // Sync local data to backend
      try {
        const favoritesService = (await import('../lib/favoritesService')).default;
        const recentlyViewedService = (await import('../lib/recentlyViewedService')).default;
        await favoritesService.syncLocalFavorites();
        await recentlyViewedService.syncLocalHistory();
      } catch (syncError) {
        console.error('Failed to sync local data', syncError);
      }

      // Auth state propagates via the customer-auth-changed event (Navbar,
      // UserActivityContext, dashboard all react) — no page reload needed.
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl shadow-black/10 overflow-hidden animate-fade-scale">
        {/* Header */}
        <div className="bg-gradient-to-br from-dark to-dark-muted text-white p-6 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-gold/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-gold/8 rounded-full blur-xl" />
          <div className="flex justify-between items-center relative z-10">
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                {mode === 'login' ? 'Welcome back' : 'Reset your password'}
              </h2>
              <p className="text-white/50 text-[13px] mt-0.5">
                {mode === 'login'
                  ? 'Sign in to your GaliMotors account'
                  : 'We will email you a link to set a new one'}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200">
              <X size={16} className="text-white/70" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-4 sm:p-6">
          {error && (
            <div className="bg-red-50 border border-red-100 text-red-700 p-3.5 rounded-xl text-sm animate-fade-up mb-4">
              <p className="font-semibold text-xs mb-0.5">
                {mode === 'login' ? 'Login failed' : 'Could not send the email'}
              </p>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {mode === 'login' ? (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="field-label">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="your@email.com"
                    className="field"
                  />
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="field-label">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(''); }}
                      className="text-[12px] font-semibold text-gold-dark hover:text-dark transition-colors mb-1.5"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="field"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full btn-primary py-3 text-[14px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Signing in…
                    </span>
                  ) : 'Sign In'}
                </button>
              </form>

              {/* Switch to Register */}
              <div className="mt-6 pt-6 border-t border-border/60 text-center">
                <p className="text-[13px] text-text-secondary mb-2">Don't have an account?</p>
                <button
                  onClick={onSwitchToRegister}
                  className="text-gold-dark font-semibold text-[13px] hover:text-dark transition-colors"
                >
                  Create Account →
                </button>
              </div>

              {/* Benefits */}
              <div className="mt-5 bg-muted p-4 border border-border">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary mb-3">
                  Member Benefits
                </p>
                <ul className="space-y-2.5">
                  {[
                    'Track recently viewed cars',
                    'Save favorite listings',
                    'Faster inquiry submissions'
                  ].map((benefit) => (
                    <li key={benefit} className="flex items-center gap-2.5 text-[12.5px] text-text-secondary">
                      <span className="w-5 h-5 rounded-lg bg-gold-light flex items-center justify-center shrink-0">
                        <span className="text-gold-dark text-[11px] font-bold">✓</span>
                      </span>
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <>
              {notice ? (
                <div className="bg-green-50 border border-green-100 text-green-800 p-4 rounded-xl text-[13px] leading-relaxed animate-fade-up">
                  {notice}
                  <p className="text-[12px] text-green-700/80 mt-2">
                    The link expires in one hour. Check your spam folder if it does not arrive.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <p className="text-[13px] text-text-secondary leading-relaxed">
                    Enter the email address on your account and we will send you a link to
                    choose a new password.
                  </p>

                  <div>
                    <label className="field-label">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="your@email.com"
                      className="field"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full btn-primary py-3 text-[14px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending…
                      </span>
                    ) : 'Send reset link'}
                  </button>
                </form>
              )}

              <div className="mt-6 pt-6 border-t border-border/60 text-center">
                <button
                  onClick={() => { setMode('login'); setError(''); setNotice(''); }}
                  className="text-gold-dark font-semibold text-[13px] hover:text-dark transition-colors"
                >
                  ← Back to sign in
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
