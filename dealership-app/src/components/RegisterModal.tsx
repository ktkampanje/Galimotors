import React, { useState } from 'react';
import { X } from 'lucide-react';
import customerAuthService from '../lib/customerAuthService';
import { isValidMalawianPhone, MALAWI_PHONE_HINT } from '../lib/phone';
import { trackPixel } from '../lib/metaPixel';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export const RegisterModal: React.FC<Props> = ({ isOpen, onClose, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    district: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const validateForm = () => {
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    // Phone is mandatory — all follow-up contact runs on WhatsApp.
    if (!formData.phone.trim()) {
      setError('Phone number is required so we can reach you on WhatsApp.');
      return false;
    }
    if (!isValidMalawianPhone(formData.phone)) {
      setError(MALAWI_PHONE_HINT);
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      await customerAuthService.register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        district: formData.district || undefined
      });

      trackPixel('CompleteRegistration');

      // Sync local data to backend
      try {
        const favoritesService = (await import('../lib/favoritesService')).default;
        const recentlyViewedService = (await import('../lib/recentlyViewedService')).default;
        await favoritesService.syncLocalFavorites();
        await recentlyViewedService.syncLocalHistory();
      } catch (syncError) {
        console.error('Failed to sync local data', syncError);
      }

      // Auth state propagates via the customer-auth-changed event — no reload.
      onClose();
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const malawianDistricts = [
    'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Mangochi', 
    'Kasungu', 'Karonga', 'Salima', 'Dedza', 'Nkhotakota'
  ];

  const inputClass = "field";

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white max-w-md w-full my-4 sm:my-8 rounded-2xl shadow-2xl shadow-black/10 overflow-hidden animate-fade-scale">
        {/* Header */}
        <div className="bg-gradient-to-br from-dark to-dark-muted text-white p-6 relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-gold/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-gold/8 rounded-full blur-xl" />
          <div className="flex justify-between items-center relative z-10">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Create Account</h2>
              <p className="text-white/50 text-[13px] mt-0.5">Join GaliMotors today</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200">
              <X size={16} className="text-white/70" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 p-3.5 rounded-xl text-sm animate-fade-up">
                <p className="font-semibold text-xs mb-0.5">Error</p>
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <div>
              <label className="block text-[13px] font-semibold text-text-primary mb-1.5">
                Full Name <span className="text-gold-dark">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="John Doe"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-text-primary mb-1.5">
                Email Address <span className="text-gold-dark">*</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="your@email.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-text-primary mb-1.5">
                Phone Number <span className="text-gold-dark">*</span>
              </label>
              <input
                type="tel"
                inputMode="tel"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                placeholder="0952456789"
                className={inputClass}
              />
              <p className="text-[11px] text-text-tertiary mt-1.5 ml-0.5">
                10 digits starting 08 or 09 — we use this to contact you on WhatsApp.
              </p>
            </div>

            <div>
              <label className="block text-[13px] font-semibold text-text-primary mb-1.5">
                District <span className="text-text-tertiary text-[11px] font-normal">(Optional)</span>
              </label>
              <select
                name="district"
                value={formData.district}
                onChange={handleChange}
                className={`${inputClass} bg-white`}
              >
                <option value="">Select your district</option>
                {malawianDistricts.map(district => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-semibold text-text-primary mb-1.5">
                  Password <span className="text-gold-dark">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Min 6 chars"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[13px] font-semibold text-text-primary mb-1.5">
                  Confirm <span className="text-gold-dark">*</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="Re-enter"
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 text-[14px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating Account…
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          {/* Switch to Login */}
          <div className="mt-6 pt-6 border-t border-border/60 text-center">
            <p className="text-[13px] text-text-secondary mb-2">Already have an account?</p>
            <button
              onClick={onSwitchToLogin}
              className="text-gold-dark font-semibold text-[13px] hover:text-dark transition-colors"
            >
              Sign In →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
