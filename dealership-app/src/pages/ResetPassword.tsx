import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import customerAuthService from '../lib/customerAuthService';

/**
 * Landing page for the link in the password reset email.
 *
 * A page rather than a modal: the customer arrives here cold from their inbox,
 * often on a different device from the one they were browsing on, so there is
 * no modal stack to open into and a real URL is what the link needs.
 */
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Checked here as well as on the server so the customer is told before a
    // round trip — and so a mistyped confirmation never spends the token,
    // which is single-use and would force them to request a whole new email.
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await customerAuthService.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err.message || 'Could not reset your password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openLogin = () => (window as any).openLoginModal?.();

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      {/* Reset links are single-use and personal; keeping them out of search
          results costs nothing and avoids indexing a dead token page. */}
      <Helmet>
        <title>Reset your password — GaliMotors</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="bg-white w-full max-w-md rounded-2xl border border-border p-6 sm:p-8">
        <h1 className="text-xl font-bold text-dark tracking-tight">Reset your password</h1>

        {!token ? (
          <>
            <p className="text-[13.5px] text-text-secondary leading-relaxed mt-3">
              This link is missing its reset code. Open the link in your email exactly as
              it was sent, or request a new one from the sign-in screen.
            </p>
            <button onClick={openLogin} className="w-full btn-primary py-3 text-[14px] mt-6">
              Go to sign in
            </button>
          </>
        ) : done ? (
          <>
            <div className="bg-green-50 border border-green-100 text-green-800 p-4 rounded-xl text-[13px] leading-relaxed mt-4">
              Your password has been updated. You can now sign in with your new password.
            </div>
            <button onClick={openLogin} className="w-full btn-primary py-3 text-[14px] mt-5">
              Sign in
            </button>
            <div className="text-center mt-4">
              <Link to="/" className="text-[13px] text-text-secondary hover:text-dark transition-colors">
                Back to home
              </Link>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13.5px] text-text-secondary leading-relaxed mt-2 mb-5">
              Choose a new password for your GaliMotors account.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 p-3.5 rounded-xl mb-4">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="field-label">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className="field"
                />
              </div>

              <div>
                <label className="field-label">Confirm new password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter your new password"
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
                    Updating…
                  </span>
                ) : 'Update password'}
              </button>
            </form>

            <p className="text-[12px] text-text-tertiary leading-relaxed mt-5">
              This link expires one hour after it was sent and can only be used once.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
