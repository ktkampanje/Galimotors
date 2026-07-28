import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { useModal } from '../components/ui/ModalContext';
import PasswordInput from '../components/ui/PasswordInput';
import { User, Shield, Store, Phone, MapPin, KeyRound, Save, Users, Lock } from 'lucide-react';

/**
 * My Profile — every role's own corner of the admin panel.
 *
 * Everyone: sees who they are and changes their password.
 * Sellers: see their seller profile and market, and keep their phone current.
 * Attendants: the same, plus everyone in their market — the sellers they
 * list cars for and their fellow attendants (both lists come from the
 * role-scoped /sellers and /attendants endpoints).
 */

interface MyProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  managed?: boolean;
  sellerProfile?: { id: string; name: string; district: string; phone: string; sellerType: string; market?: { id: string; name: string } | null } | null;
  attendantProfile?: { id: string; name: string; phone: string; market?: { id: string; name: string } | null } | null;
}

const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { showAlert } = useModal();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [phone, setPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [marketSellers, setMarketSellers] = useState<any[]>([]);
  const [marketAttendants, setMarketAttendants] = useState<any[]>([]);

  const role = user?.role || '';
  const isFieldRole = role === 'SELLER' || role === 'MARKET_ATTENDANT';

  const fetchAll = useCallback(async () => {
    try {
      const res = await api.get('/users/profile');
      setProfile(res.data);
      setPhone(res.data?.sellerProfile?.phone || res.data?.attendantProfile?.phone || '');

      if (res.data?.role === 'MARKET_ATTENDANT') {
        const [sellersRes, attendantsRes] = await Promise.allSettled([
          api.get('/sellers'),
          api.get('/attendants'),
        ]);
        if (sellersRes.status === 'fulfilled') setMarketSellers(sellersRes.value.data || []);
        if (attendantsRes.status === 'fulfilled') setMarketAttendants(attendantsRes.value.data || []);
      }
    } catch (error) {
      console.error('Failed to load profile', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      await showAlert({ title: 'Phone Required', message: 'Please enter your phone number.', variant: 'warning' });
      return;
    }
    setSavingPhone(true);
    try {
      await api.put('/users/profile', { phone: phone.trim() });
      await showAlert({ title: 'Phone Updated', message: 'Your phone number has been saved.', variant: 'success' });
      fetchAll();
    } catch (error: any) {
      await showAlert({ title: 'Could Not Save', message: error?.response?.data?.error || 'Please try again.', variant: 'error' });
    } finally {
      setSavingPhone(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      await showAlert({ title: 'Missing Details', message: 'Enter your current password and the new one.', variant: 'warning' });
      return;
    }
    if (newPassword !== confirmPassword) {
      await showAlert({ title: 'Passwords Do Not Match', message: 'The new password and its confirmation are different.', variant: 'warning' });
      return;
    }
    setSavingPassword(true);
    try {
      await api.put('/users/profile', { currentPassword, newPassword });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      await showAlert({ title: 'Password Changed', message: 'Use the new password the next time you sign in.', variant: 'success' });
    } catch (error: any) {
      await showAlert({ title: 'Could Not Change Password', message: error?.response?.data?.error || 'Please try again.', variant: 'error' });
    } finally {
      setSavingPassword(false);
    }
  };

  const roleLabel = (r: string) => (r === 'SUB_ADMIN' ? 'ADMIN' : r.replace(/_/g, ' '));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin" />
      </div>
    );
  }

  const myMarket = profile?.sellerProfile?.market || profile?.attendantProfile?.market || null;
  const inputCls = 'w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all placeholder:text-gray-400';

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-3xl mx-auto">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 font-medium">Your account, contact details and password</p>
      </div>

      {/* ── Identity ── */}
      <div className="card-widget p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-coral to-coral-dark flex items-center justify-center text-white text-lg font-bold shadow-sm shrink-0">
            {(profile?.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-900 truncate">{profile?.name}</p>
            <p className="text-sm text-gray-500 truncate">{profile?.email}</p>
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-coral bg-coral-light px-2 py-0.5 rounded-md uppercase tracking-wide">
              <Shield size={10} /> {roleLabel(profile?.role || '')}
            </span>
          </div>
        </div>
      </div>

      {/* ── Field profile: phone + market ── */}
      {isFieldRole && (
        <div className="card-widget p-6 space-y-5">
          <div className="flex items-center gap-2">
            <User size={16} className="text-gold-dark" />
            <h2 className="text-sm font-bold text-gray-900">
              {role === 'SELLER' ? 'My Seller Profile' : 'My Attendant Profile'}
            </h2>
          </div>

          {(profile?.sellerProfile || profile?.attendantProfile) ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {myMarket && (
                  <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Store size={11} /> My Market</p>
                    <p className="text-sm font-bold text-gray-900">{myMarket.name}</p>
                  </div>
                )}
                {profile?.sellerProfile && (
                  <>
                    {!myMarket && (
                      <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Store size={11} /> My Market</p>
                        <p className="text-sm font-medium text-gray-500">Independent — no market</p>
                      </div>
                    )}
                    <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><MapPin size={11} /> District</p>
                      <p className="text-sm font-bold text-gray-900">{profile.sellerProfile.district}</p>
                    </div>
                    <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Seller Type</p>
                      <p className="text-sm font-bold text-gray-900">{profile.sellerProfile.sellerType === 'DEALER' ? 'Dealer' : 'Individual'}</p>
                    </div>
                  </>
                )}
              </div>

              <form onSubmit={handleSavePhone} className="space-y-2">
                <label className="text-xs font-semibold text-gray-600 flex items-center gap-1"><Phone size={12} /> Phone Number</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className={inputCls}
                    placeholder="0999 000 000"
                  />
                  <button
                    type="submit"
                    disabled={savingPhone}
                    className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-dark text-white text-sm font-bold rounded-xl hover:bg-dark-muted transition-colors disabled:opacity-60"
                  >
                    <Save size={14} /> {savingPhone ? 'Saving…' : 'Save'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400">This is the number admins and customers reach you on.</p>
              </form>
            </>
          ) : (
            <p className="text-sm font-semibold text-coral">No profile is linked to your login yet — ask the administrator to link it.</p>
          )}
        </div>
      )}

      {/* ── Attendant: everyone in my market ── */}
      {role === 'MARKET_ATTENDANT' && (marketSellers.length > 0 || marketAttendants.length > 0) && (
        <div className="card-widget p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-gold-dark" />
            <h2 className="text-sm font-bold text-gray-900">People in {myMarket?.name || 'My Market'}</h2>
          </div>

          {marketSellers.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Sellers ({marketSellers.length})</p>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {marketSellers.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-2.5 bg-white">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                      <p className="text-[11px] text-gray-500">{s.sellerType === 'DEALER' ? 'Dealer' : 'Individual'} · {s.district}</p>
                    </div>
                    <a href={`tel:${s.phone}`} className="text-xs font-semibold text-gray-600 flex items-center gap-1 shrink-0 hover:text-dark">
                      <Phone size={12} /> {s.phone}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {marketAttendants.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Attendants ({marketAttendants.length})</p>
              <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                {marketAttendants.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between px-4 py-2.5 bg-white">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {a.name}
                      {a.id === profile?.attendantProfile?.id && <span className="ml-2 text-[10px] font-bold text-gold-dark bg-gold-light px-1.5 py-0.5 rounded">YOU</span>}
                    </p>
                    <a href={`tel:${a.phone}`} className="text-xs font-semibold text-gray-600 flex items-center gap-1 shrink-0 hover:text-dark">
                      <Phone size={12} /> {a.phone}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Password ── */}
      <div className="card-widget p-6 space-y-5">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-gold-dark" />
          <h2 className="text-sm font-bold text-gray-900">Change Password</h2>
        </div>

        {profile?.managed ? (
          <p className="text-sm text-gray-500 flex items-center gap-2">
            <Lock size={14} className="shrink-0" />
            This account's password is set by the server configuration and cannot be changed here.
          </p>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Current Password</label>
              <PasswordInput value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">New Password</label>
              <PasswordInput value={newPassword} onChange={setNewPassword} required />
              <p className="text-[11px] text-gray-400">At least 8 characters with uppercase, lowercase, a number and a symbol.</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Confirm New Password</label>
              <PasswordInput value={confirmPassword} onChange={setConfirmPassword} required />
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="btn-primary text-sm font-bold disabled:opacity-60"
            >
              {savingPassword ? 'Changing…' : 'Change Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
