import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, UserPlus } from 'lucide-react';
import customerAuthService from '../lib/customerAuthService';

interface Props {
  onLoginClick: () => void;
}

// A dismissal stays respected for a week. The old sessionStorage flag reset
// on every new tab/session, so the popup nagged returning visitors daily.
const DISMISS_KEY = 'quickLoginDismissedAt';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const recentlyDismissed = (): boolean => {
  const at = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return at > 0 && Date.now() - at < DISMISS_COOLDOWN_MS;
};

export const QuickLoginPrompt: React.FC<Props> = ({ onLoginClick }) => {
  const [show, setShow] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [isReturning, setIsReturning] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { pathname } = useLocation();

  // Never interrupt the booking/payment flow.
  const onConversionPage = pathname.startsWith('/book-viewing');

  useEffect(() => {
    // Slight delay so it doesn't pop up instantly jarring the user
    const timer = setTimeout(() => {
      checkUserStatus();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const checkUserStatus = async () => {
    if (customerAuthService.isAuthenticated()) return;
    if (recentlyDismissed()) return;

    const lastEmail = customerAuthService.getLastEmail();
    
    if (lastEmail) {
      try {
        const result = await customerAuthService.quickCheck(lastEmail);
        if (result.exists && result.name) {
          setUserEmail(result.email || lastEmail);
          setUserName(result.name);
          setIsReturning(true);
        }
      } catch (error) {
        // Fall back to generic guest prompt
      }
    }
    
    setShow(true);
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  const handleLoginClick = () => {
    setShow(false);
    onLoginClick();
  };

  if (!show || dismissed || onConversionPage) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-sm animate-slide-up">
      <div className="bg-white rounded-2xl border border-border shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-coral text-white p-3 flex justify-between items-center rounded-t-2xl">
          <p className="text-sm font-semibold">
            {isReturning ? 'Welcome Back!' : 'Welcome to GaliMotors!'}
          </p>
          <button onClick={handleDismiss} className="text-white hover:text-dark transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm font-bold text-dark mb-1">
            {isReturning ? `Hi ${userName}! 👋` : 'Save Your Favorites 🚗'}
          </p>
          <p className="text-xs text-gray-600 mb-4">
            {isReturning 
              ? 'Login to access your recently viewed cars and favorites.' 
              : 'Sign in to access your recently viewed cars and favorites across all your devices.'}
          </p>

          <div className="flex gap-2">
            <button onClick={handleLoginClick} className="flex-1 btn-primary py-2 text-sm flex items-center justify-center gap-2">
              <UserPlus size={16} /> Sign In
            </button>
            <button onClick={handleDismiss} className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-dark transition-colors">
              Not now
            </button>
          </div>

          {isReturning && (
            <p className="text-xs text-gray-500 mt-3 text-center">
              {userEmail}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
