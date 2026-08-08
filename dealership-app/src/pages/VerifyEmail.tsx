import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import customerAuthService from '../lib/customerAuthService';

type State = 'verifying' | 'done' | 'failed' | 'missing';

/**
 * Landing page for the link in the signup confirmation email.
 *
 * Verification is non-blocking — an unconfirmed account works normally — so
 * this page only reports the outcome. Nothing here gates access.
 */
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [state, setState] = useState<State>(token ? 'verifying' : 'missing');
  const [message, setMessage] = useState('');

  // React 18 StrictMode mounts effects twice in development. The token is
  // single-use, so a second call would always fail and flash an error on a
  // verification that actually succeeded.
  const attempted = useRef(false);

  useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;

    customerAuthService
      .verifyEmail(token)
      .then((result) => {
        setMessage(result);
        setState('done');
      })
      .catch((err: any) => {
        setMessage(err?.message || 'We could not confirm your email address.');
        setState('failed');
      });
  }, [token]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Helmet>
        <title>Confirm your email — GaliMotors</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="bg-white w-full max-w-md rounded-2xl border border-border p-6 sm:p-8 text-center">
        {state === 'verifying' && (
          <>
            <span className="w-8 h-8 border-2 border-border border-t-dark rounded-full animate-spin inline-block" />
            <p className="text-[13.5px] text-text-secondary mt-4">
              Confirming your email address…
            </p>
          </>
        )}

        {state === 'done' && (
          <>
            <div className="w-12 h-12 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto">
              <span className="text-green-600 text-lg font-bold">✓</span>
            </div>
            <h1 className="text-xl font-bold text-dark tracking-tight mt-4">Email confirmed</h1>
            <p className="text-[13.5px] text-text-secondary leading-relaxed mt-2">
              Thanks — your email address is confirmed. Quotes, viewing confirmations and
              password resets will reach you here.
            </p>
            <Link to="/cars" className="block w-full btn-primary py-3 text-[14px] mt-6">
              Browse cars
            </Link>
          </>
        )}

        {(state === 'failed' || state === 'missing') && (
          <>
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto">
              <span className="text-amber-600 text-lg font-bold">!</span>
            </div>
            <h1 className="text-xl font-bold text-dark tracking-tight mt-4">
              Link didn&apos;t work
            </h1>
            <p className="text-[13.5px] text-text-secondary leading-relaxed mt-2">
              {state === 'missing'
                ? 'This link is missing its confirmation code. Open the link in your email exactly as it was sent.'
                : message}
            </p>
            {/* Deliberately reassuring: an expired confirmation link locks
                nobody out, because verification never gated the account. */}
            <p className="text-[12.5px] text-text-tertiary leading-relaxed mt-3">
              Your account still works normally. You can request a fresh confirmation email
              from your dashboard.
            </p>
            <Link to="/dashboard" className="block w-full btn-primary py-3 text-[14px] mt-6">
              Go to my dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
