import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { Plus, Edit2, Trash2, Shield, User, X, Lock, Store, Link2, UserPlus } from 'lucide-react';
import { useModal } from '../components/ui/ModalContext';
import CustomSelect from '../components/ui/CustomSelect';

/**
 * Staff logins and their authority.
 *
 * Every SELLER / MARKET_ATTENDANT login MUST be linked to a seller or
 * attendant profile — that link is what scopes them to "their own cars" /
 * "their market's cars". The form therefore makes the profile part of
 * creation itself: link an existing unclaimed profile, or create one.
 *
 * The super admin is not managed here: it is enforced from the server
 * environment (SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD) on every boot.
 */

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  managed?: boolean;
  sellerProfile?: { id: string; name: string; district: string; phone: string; sellerType: string; market?: { id: string; name: string } | null } | null;
  attendantProfile?: { id: string; name: string; phone: string; market?: { id: string; name: string } | null } | null;
}

interface LinkableProfiles {
  sellers: { id: string; name: string; phone: string; district: string; sellerType: string; market?: { name: string } | null }[];
  attendants: { id: string; name: string; phone: string; market?: { name: string } | null }[];
}

const ROLE_OPTIONS = [
  { id: 'SUB_ADMIN', name: 'Admin — inquiries, stock, approvals' },
  { id: 'SELLER', name: 'Seller — own listings only' },
  { id: 'MARKET_ATTENDANT', name: 'Market Attendant — one market’s cars' },
];

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'SUB_ADMIN',
  profileMode: 'link' as 'link' | 'create',
  linkSellerId: '',
  linkAttendantId: '',
  phone: '',
  district: '',
  sellerType: 'INDIVIDUAL',
  marketId: '',
};

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [markets, setMarkets] = useState<any[]>([]);
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);
  const [linkable, setLinkable] = useState<LinkableProfiles>({ sellers: [], attendants: [] });

  const { showConfirm, showAlert } = useModal();

  const fetchAll = useCallback(async () => {
    try {
      const [usersRes, marketsRes, districtsRes, linkableRes] = await Promise.allSettled([
        api.get('/users'),
        api.get('/markets'),
        api.get('/locations/districts'),
        api.get('/users/linkable-profiles'),
      ]);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data);
      if (marketsRes.status === 'fulfilled') setMarkets(marketsRes.value.data);
      if (districtsRes.status === 'fulfilled') setDistricts(districtsRes.value.data);
      if (linkableRes.status === 'fulfilled') setLinkable(linkableRes.value.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const needsProfile = (role: string) => role === 'SELLER' || role === 'MARKET_ATTENDANT';
  // On edit, the profile section only matters when the role is CHANGING into
  // seller/attendant — the server re-links profiles only on a role change.
  const showProfileSection = needsProfile(formData.role) && (!editingUser || editingUser.role !== formData.role);

  const validate = (): string | null => {
    if (!editingUser && !formData.password) return 'A password is required for a new login.';
    if (showProfileSection) {
      if (formData.role === 'SELLER') {
        if (formData.profileMode === 'link' && !formData.linkSellerId) return 'Choose which seller this login belongs to, or switch to "New profile".';
        if (formData.profileMode === 'create' && (!formData.phone || !formData.district)) return 'A new seller profile needs a phone number and district.';
      }
      if (formData.role === 'MARKET_ATTENDANT') {
        if (formData.profileMode === 'link' && !formData.linkAttendantId) return 'Choose which attendant this login belongs to, or switch to "New profile".';
        if (formData.profileMode === 'create' && (!formData.phone || !formData.marketId)) return 'A new attendant profile needs a phone number and an assigned market.';
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = validate();
    if (problem) {
      await showAlert({ title: 'Missing Details', message: problem, variant: 'warning' });
      return;
    }

    const payload: any = {
      name: formData.name,
      email: formData.email,
      role: formData.role,
    };
    if (formData.password) payload.password = formData.password;
    if (showProfileSection) {
      if (formData.profileMode === 'link') {
        if (formData.role === 'SELLER') payload.linkSellerId = formData.linkSellerId;
        else payload.linkAttendantId = formData.linkAttendantId;
      } else {
        payload.phone = formData.phone;
        if (formData.role === 'SELLER') {
          payload.district = formData.district;
          payload.sellerType = formData.sellerType;
          if (formData.marketId) payload.marketId = formData.marketId;
        } else {
          payload.marketId = formData.marketId;
        }
      }
    }

    setSaving(true);
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, payload);
        await showAlert({ title: 'Saved', message: `${formData.name}'s account has been updated.`, variant: 'success' });
      } else {
        await api.post('/users', payload);
        await showAlert({ title: 'Login Created', message: `${formData.name} can now sign in to the admin panel.`, variant: 'success' });
      }
      resetForm();
      fetchAll();
    } catch (error: any) {
      await showAlert({
        title: editingUser ? 'Could Not Save' : 'Could Not Create Login',
        message: error?.response?.data?.error || 'Something went wrong. Please try again.',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user);
    setFormData({
      ...emptyForm,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    setShowForm(true);
  };

  const handleDelete = async (user: AdminUser) => {
    const confirmed = await showConfirm({
      title: 'Delete Login',
      message: `Remove ${user.name}'s access? Their seller/attendant profile and any cars stay in the system — only the login is deleted.`,
      variant: 'danger',
      confirmLabel: 'Delete Login',
    });
    if (!confirmed) return;

    try {
      await api.delete(`/users/${user.id}`);
      fetchAll();
    } catch (error: any) {
      await showAlert({
        title: 'Could Not Delete',
        message: error?.response?.data?.error || 'Something went wrong. Please try again.',
        variant: 'error',
      });
    }
  };

  const resetForm = () => {
    setFormData({ ...emptyForm });
    setEditingUser(null);
    setShowForm(false);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return <Shield size={16} />;
      case 'SUB_ADMIN': return <Shield size={16} />;
      case 'SELLER': return <User size={16} className="text-coral" />;
      case 'MARKET_ATTENDANT': return <Store size={16} className="text-info" />;
      default: return <User size={16} />;
    }
  };

  const roleLabel = (role: string) =>
    role === 'SUB_ADMIN' ? 'ADMIN' : role.replace(/_/g, ' ');

  const profileLine = (user: AdminUser): string | null => {
    if (user.sellerProfile) {
      const p = user.sellerProfile;
      return `${p.name} · ${p.district}${p.market ? ` · ${p.market.name}` : ''}`;
    }
    if (user.attendantProfile) {
      const p = user.attendantProfile;
      return `${p.name}${p.market ? ` · ${p.market.name}` : ''}`;
    }
    if (user.role === 'SELLER' || user.role === 'MARKET_ATTENDANT') {
      return '⚠ No profile linked — cannot see or add any cars';
    }
    return null;
  };

  const inputCls = 'w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all placeholder:text-gray-400';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm font-medium text-gray-400 animate-pulse flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin"></div>
          Loading personnel records...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 font-medium">Admin, seller and market-attendant logins</p>
        </div>
        <button
          onClick={() => { setEditingUser(null); setFormData({ ...emptyForm }); setShowForm(true); }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Add User
        </button>
      </div>

      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button
               onClick={resetForm}
               className="absolute top-6 right-6 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"
            >
               <X size={16} />
            </button>
            <h2 className="text-lg font-bold text-gray-900 mb-6">
              {editingUser ? 'Edit User' : 'New Staff Login'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Full Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={inputCls}
                  placeholder="John Banda"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Email Address</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className={inputCls}
                  placeholder="user@galimotors.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">
                  Password {editingUser && <span className="text-gray-400 font-medium">(leave blank to keep current)</span>}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className={inputCls}
                  placeholder="••••••••"
                />
                {!editingUser && (
                  <p className="text-[11px] text-gray-400">At least 8 characters with uppercase, lowercase, a number and a symbol.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Role</label>
                <CustomSelect
                  value={formData.role}
                  onChange={(val) => setFormData(prev => ({ ...prev, role: val }))}
                  options={ROLE_OPTIONS}
                  placeholder="Select Role"
                />
                <p className="text-[11px] text-gray-400">The super admin login is fixed by the server configuration and cannot be created here.</p>
              </div>

              {/* Profile link — the part that scopes sellers/attendants to their cars */}
              {showProfileSection && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {formData.role === 'SELLER' ? 'Which seller is this?' : 'Which attendant is this?'}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, profileMode: 'link' }))}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                        formData.profileMode === 'link' ? 'bg-dark text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <Link2 size={13} /> Link existing
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, profileMode: 'create' }))}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors ${
                        formData.profileMode === 'create' ? 'bg-dark text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <UserPlus size={13} /> New profile
                    </button>
                  </div>

                  {formData.profileMode === 'link' ? (
                    formData.role === 'SELLER' ? (
                      linkable.sellers.length > 0 ? (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-600">Existing seller (no login yet)</label>
                          <CustomSelect
                            value={formData.linkSellerId}
                            onChange={(val) => setFormData(prev => ({ ...prev, linkSellerId: val }))}
                            options={linkable.sellers.map(s => ({
                              id: s.id,
                              name: `${s.name} — ${s.district}${s.market ? ` · ${s.market.name}` : ''}`,
                            }))}
                            placeholder="Select seller..."
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Every existing seller already has a login. Use "New profile" instead.</p>
                      )
                    ) : (
                      linkable.attendants.length > 0 ? (
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-gray-600">Existing attendant (no login yet)</label>
                          <CustomSelect
                            value={formData.linkAttendantId}
                            onChange={(val) => setFormData(prev => ({ ...prev, linkAttendantId: val }))}
                            options={linkable.attendants.map(a => ({
                              id: a.id,
                              name: `${a.name}${a.market ? ` — ${a.market.name}` : ''}`,
                            }))}
                            placeholder="Select attendant..."
                          />
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500">Every existing attendant already has a login. Use "New profile" instead.</p>
                      )
                    )
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-600">Phone Number</label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          className={inputCls}
                          placeholder="0999 000 000"
                        />
                      </div>

                      {formData.role === 'SELLER' && (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-600">District</label>
                            <CustomSelect
                              value={formData.district}
                              onChange={(val) => setFormData(prev => ({ ...prev, district: val }))}
                              options={districts.map(d => ({ id: d.name, name: d.name }))}
                              placeholder="Select district..."
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-600">Seller Type</label>
                            <CustomSelect
                              value={formData.sellerType}
                              onChange={(val) => setFormData(prev => ({ ...prev, sellerType: val }))}
                              options={[
                                { id: 'INDIVIDUAL', name: 'Individual' },
                                { id: 'DEALER', name: 'Dealer' },
                              ]}
                              placeholder="Seller type"
                            />
                          </div>
                        </>
                      )}

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-600">
                          Market {formData.role === 'SELLER' && <span className="text-gray-400 font-medium">(optional)</span>}
                        </label>
                        <CustomSelect
                          value={formData.marketId}
                          onChange={(val) => setFormData(prev => ({ ...prev, marketId: val }))}
                          options={markets.map(m => ({ id: m.id, name: `${m.name} (${m.district})` }))}
                          placeholder="Select market..."
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {editingUser && needsProfile(editingUser.role) && editingUser.role === formData.role && (
                <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Linked profile</p>
                  <p className="text-sm font-semibold text-gray-700">{profileLine(editingUser) || '—'}</p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={resetForm} className="btn-outline flex-1 text-sm font-bold">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm font-bold disabled:opacity-60">
                  {saving ? 'Saving…' : editingUser ? 'Save Changes' : 'Create Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="card-widget overflow-hidden p-0 shadow-sm border border-gray-100 bg-white">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-sm font-bold text-gray-900">
            Staff Logins ({users.length})
          </h2>
          <div className="flex gap-2 items-center bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm transition-all">
             <div className="w-2 h-2 bg-dark rounded-full animate-pulse" />
             <span className="text-xs font-semibold text-gray-500">Live System</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-white">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 tracking-wider">Identity</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 tracking-wider">Role & Scope</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 tracking-wider">Date Added</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-pharmacore-gray text-dark flex items-center justify-center font-bold text-lg overflow-hidden border border-gray-100">
                         <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=f0fdf4&color=15803d&rounded=false`} alt={user.name} className="w-full h-full object-cover" />
                       </div>
                       <div className="flex flex-col">
                         <div className="text-sm font-bold text-gray-900">{user.name}</div>
                         <div className="text-xs font-medium text-gray-500">{user.email}</div>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
                        user.role === 'SUPER_ADMIN' ? 'bg-pharmacore-gray text-dark border border-gray-100' :
                        user.role === 'SELLER' ? 'bg-coral/10 text-coral border border-coral/20' :
                        user.role === 'MARKET_ATTENDANT' ? 'bg-info-light text-info border border-info/20' :
                        'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}>
                        {getRoleIcon(user.role)}
                        {roleLabel(user.role)}
                      </span>
                      {profileLine(user) && (
                        <span className="text-[11px] font-medium text-gray-500 pl-1">{profileLine(user)}</span>
                      )}
                      {user.managed && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md uppercase tracking-wide">
                          <Lock size={10} /> Managed by server config
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-700">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {user.managed ? (
                        <span className="p-2 text-gray-300" title="This account is managed by the server environment">
                          <Lock size={16} />
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => handleEdit(user)}
                            className="p-2 rounded-lg bg-gray-50 text-gray-400 hover:text-dark hover:bg-pharmacore-gray transition-colors"
                            title="Edit User"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-2 rounded-lg bg-gray-50 text-gray-400 hover:text-coral hover:bg-coral/10 transition-colors"
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="p-16 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
              <Shield size={32} className="text-gray-300" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-sm font-bold text-gray-900">No Users Found</div>
              <div className="text-xs font-medium text-gray-500">Add staff accounts to grant access to the dashboard.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
