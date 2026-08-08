import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Car, Lock, Mail, AlertCircle, Eye, EyeOff, ShieldCheck, BarChart3, Users } from 'lucide-react';
import { API_BASE_URL } from '../lib/api';
import { useAuth } from '../lib/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email,
        password
      });

      // Establish the verified session (validates role, stores tokens)
      login({
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
        user: response.data.user,
      });

      // Redirect to dashboard
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Login error:', err);

      if (err.message === 'This account does not have admin panel access.') {
        setError(err.message);
      } else if (err.response?.status === 429) {
        setError(err.response.data.message || 'Too many failed attempts. Please try again later.');
      } else if (err.response?.status === 401) {
        setError(err.response.data.message || 'Invalid credentials');
        if (err.response.data.remainingAttempts !== undefined) {
          setRemainingAttempts(err.response.data.remainingAttempts);
        }
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-surface">
      {/* ── Brand panel (desktop) ─────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-1/2 relative overflow-hidden bg-gradient-to-br from-dark via-coral to-dark-muted">
        {/* Ambient gold glows */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 text-white w-full">
          {/* Brand mark */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/15">
              <Car size={22} className="text-gold" />
            </div>
            <div>
              <div className="text-lg font-extrabold tracking-tight leading-none">GaliMotors</div>
              <div className="text-[11px] font-medium text-white/50 uppercase tracking-widest mt-1">Admin Console</div>
            </div>
          </div>

          {/* Headline */}
          <div className="max-w-md">
            <h2 className="text-3xl xl:text-4xl font-black leading-tight tracking-tight mb-4">
              Manage your dealership with confidence.
            </h2>
            <p className="text-white/60 text-[15px] leading-relaxed">
              Inventory, leads, viewings and payments — one secure workspace for the GaliMotors team.
            </p>

            <div className="mt-10 space-y-4">
              {[
                { icon: BarChart3, label: 'Sales & inventory analytics' },
                { icon: Users, label: 'Leads, viewings & payments' },
                { icon: ShieldCheck, label: 'Secure team access' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center ring-1 ring-white/10 shrink-0">
                    <Icon size={17} className="text-gold" />
                  </div>
                  <span className="text-sm font-medium text-white/80">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[12px] text-white/40 font-medium">
            © {new Date().getFullYear()} GaliMotors. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── Form panel ─────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-muted lg:bg-surface">
        <div className="w-full max-w-sm">
          {/* Mobile brand mark */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-coral flex items-center justify-center shadow-lg shadow-coral/25 mb-4">
              <Car size={28} className="text-gold" />
            </div>
            <h1 className="text-2xl font-black text-text-primary">GaliMotors Admin</h1>
          </div>

          {/* Header */}
          <div className="mb-8 hidden lg:block">
            <h1 className="text-2xl font-black text-text-primary tracking-tight">Welcome back</h1>
            <p className="text-sm text-text-secondary font-medium mt-1.5">Sign in to your admin account to continue.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Error Message */}
            {error && (
              <div className="bg-danger-light border border-danger/20 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle size={20} className="text-danger shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-danger">{error}</p>
                  {remainingAttempts !== null && remainingAttempts > 0 && (
                    <p className="text-xs text-danger/80 mt-1">
                      {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label className="block text-[13px] font-semibold text-text-primary mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-surface border border-border rounded-xl font-medium text-text-primary placeholder:text-text-tertiary focus:border-coral focus:ring-2 focus:ring-coral/15 outline-none transition-all"
                  placeholder="admin@galimotor.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-[13px] font-semibold text-text-primary mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 bg-surface border border-border rounded-xl font-medium text-text-primary placeholder:text-text-tertiary focus:border-coral focus:ring-2 focus:ring-coral/15 outline-none transition-all"
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-coral hover:bg-coral-dark text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-coral/20 hover:shadow-xl hover:shadow-coral/25 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
