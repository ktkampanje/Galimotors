import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store, Users, Plus, Trash2, MapPin, ChevronRight, Edit, Phone, X, KeyRound
} from 'lucide-react';
import { api } from '../lib/api';
import { useModal } from '../components/ui/ModalContext';
import { useAuth } from '../lib/AuthContext';
import CustomSelect from '../components/ui/CustomSelect';
import PasswordInput from '../components/ui/PasswordInput';

/**
 * Markets & sellers, two clean levels:
 *  - Markets tab: one card per market (click → the market's own page where
 *    its sellers and attendants are managed).
 *  - Sellers tab: the full seller directory — including independent
 *    sellers who belong to no market — with edit and (super admin) delete.
 * Buttons the server would refuse for this role are not rendered at all;
 * the old page showed sub-admins market/attendant buttons that always 403'd.
 */

const inputCls = 'w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all placeholder:text-gray-400';

const MarketManager = () => {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useModal();
  const { user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] = useState<'markets' | 'sellers'>('markets');
  const [loading, setLoading] = useState(true);

  const [markets, setMarkets] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);

  const [showMarketModal, setShowMarketModal] = useState(false);
  const [marketForm, setMarketForm] = useState({ name: '', district: '', description: '' });

  const [showSellerModal, setShowSellerModal] = useState(false);
  const [editingSeller, setEditingSeller] = useState<any | null>(null);
  const [sellerForm, setSellerForm] = useState({ name: '', phone: '', district: '', marketId: '', sellerType: 'INDIVIDUAL', createUser: false, userEmail: '', userPassword: '' });

  const [saving, setSaving] = useState(false);

  const refreshData = async () => {
    try {
      const [dRes, mRes, sRes] = await Promise.allSettled([
        api.get('/locations/districts'),
        api.get('/markets'),
        api.get('/sellers'),
      ]);
      if (dRes.status === 'fulfilled') setDistricts(dRes.value.data);
      if (mRes.status === 'fulfilled') setMarkets(mRes.value.data);
      if (sRes.status === 'fulfilled') setSellers(sRes.value.data);
    } catch (error) {
      console.error('Failed to refresh data', error);
    }
  };

  useEffect(() => { (async () => { setLoading(true); await refreshData(); setLoading(false); })(); }, []);

  // ── Markets ──
  const handleSaveMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!marketForm.name || !marketForm.district) {
      await showAlert({ title: 'Incomplete Data', message: 'Name and District are required.', variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/markets', marketForm);
      refreshData();
      setShowMarketModal(false);
      setMarketForm({ name: '', district: '', description: '' });
    } catch (error: any) {
      await showAlert({ title: 'Save Failed', message: error.response?.data?.message || error.response?.data?.error || 'Could not register the market.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMarket = async (market: any) => {
    const confirmed = await showConfirm({
      title: 'Delete Market',
      message: `Delete "${market.name}"? Its attendants are removed with it; sellers and cars stay but lose the market link.`,
      variant: 'danger',
      confirmLabel: 'Delete Market',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/markets/${market.id}`);
      refreshData();
    } catch (error: any) {
      await showAlert({ title: 'Delete Failed', message: error.response?.data?.message || error.response?.data?.error || 'Could not delete the market.', variant: 'error' });
    }
  };

  // ── Sellers ──
  const openAddSeller = () => {
    setEditingSeller(null);
    setSellerForm({ name: '', phone: '', district: '', marketId: '', sellerType: 'INDIVIDUAL', createUser: false, userEmail: '', userPassword: '' });
    setShowSellerModal(true);
  };

  const openEditSeller = (seller: any) => {
    setEditingSeller(seller);
    setSellerForm({
      name: seller.name, phone: seller.phone, district: seller.district || '',
      marketId: seller.marketId || '', sellerType: seller.sellerType || 'INDIVIDUAL',
      createUser: false, userEmail: '', userPassword: '',
    });
    setShowSellerModal(true);
  };

  const handleSaveSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerForm.name || !sellerForm.phone || !sellerForm.district) {
      await showAlert({ title: 'Incomplete Data', message: 'Name, Phone and District are required.', variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      if (editingSeller) {
        await api.put(`/sellers/${editingSeller.id}`, {
          name: sellerForm.name, phone: sellerForm.phone, district: sellerForm.district,
          marketId: sellerForm.marketId || null, sellerType: sellerForm.sellerType,
        });
      } else {
        await api.post('/sellers', { ...sellerForm, userRole: 'SELLER' });
      }
      refreshData();
      setShowSellerModal(false);
    } catch (error: any) {
      await showAlert({ title: 'Save Failed', message: error.response?.data?.message || error.response?.data?.error || 'Could not save the seller.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSeller = async (seller: any) => {
    const confirmed = await showConfirm({
      title: 'Delete Seller',
      message: `Delete "${seller.name}"? This only works when they have no cars and no login linked.`,
      variant: 'danger',
      confirmLabel: 'Delete Seller',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/sellers/${seller.id}`);
      refreshData();
    } catch (error: any) {
      await showAlert({ title: 'Cannot Delete', message: error.response?.data?.error || error.response?.data?.message || 'Failed to delete the seller.', variant: 'error' });
    }
  };

  const filteredMarketsForSeller = useMemo(() => {
    if (!sellerForm.district) return [];
    return markets.filter(m => m.district === sellerForm.district);
  }, [markets, sellerForm.district]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Markets Ecosystem</h1>
          <p className="text-sm text-gray-500 font-medium">
            {markets.length} market{markets.length === 1 ? '' : 's'} · {sellers.length} seller{sellers.length === 1 ? '' : 's'} — tap a market to manage its people
          </p>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'markets' && isSuper && (
            <button onClick={() => setShowMarketModal(true)} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Add Market
            </button>
          )}
          {activeTab === 'sellers' && (
            <button onClick={openAddSeller} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Add Seller
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {([['markets', 'Markets', Store, markets.length], ['sellers', 'All Sellers', Users, sellers.length]] as const).map(([id, label, Icon, count]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold transition-colors ${
              activeTab === id ? 'bg-coral text-white' : 'bg-muted text-text-primary hover:bg-coral-light'
            }`}
          >
            <Icon size={15} /> {label}
            <span className={activeTab === id ? 'opacity-80' : 'text-text-tertiary'}>({count})</span>
          </button>
        ))}
      </div>

      {/* ── Markets grid ── */}
      {activeTab === 'markets' && (
        markets.length === 0 ? (
          <div className="card-widget p-12 text-center">
            <Store className="mx-auto text-gray-300 mb-4" size={48} />
            <p className="text-sm font-medium text-gray-600">No markets yet{isSuper ? ' — add the first one.' : '.'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {markets.map(market => (
              <div
                key={market.id}
                onClick={() => navigate(`/markets/${market.id}`)}
                className="card-widget p-5 group cursor-pointer hover:shadow-lg hover:border-gray-200 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-dark text-gold flex items-center justify-center shrink-0">
                      <Store size={19} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{market.name}</p>
                      <p className="text-xs font-semibold text-gray-400 flex items-center gap-1"><MapPin size={11} /> {market.district}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSuper && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteMarket(market); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-danger hover:bg-danger-light transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete market"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-dark group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {[
                    [market._count?.sellers ?? 0, 'Sellers'],
                    [market._count?.attendants ?? 0, 'Attendants'],
                    [market._count?.cars ?? 0, 'Cars'],
                  ].map(([n, label]) => (
                    <div key={label as string} className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-2 text-center">
                      <p className="text-base font-bold text-gray-900 leading-none">{n}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-1">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Sellers directory ── */}
      {activeTab === 'sellers' && (
        <div className="card-widget p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 tracking-wider">Seller</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 tracking-wider hidden sm:table-cell">Market</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 tracking-wider hidden md:table-cell">District</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 tracking-wider">Phone</th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-500 tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sellers.map(seller => {
                  const market = markets.find(m => m.id === seller.marketId);
                  return (
                    <tr key={seller.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{seller.name}</p>
                            <p className="text-[11px] font-semibold text-gray-400">
                              {seller.sellerType === 'DEALER' ? 'Dealer' : 'Individual'}
                              {seller.sellerStatus !== 'APPROVED' && <span className="text-warning"> · {seller.sellerStatus}</span>}
                            </p>
                          </div>
                          {seller.userId && (
                            <span title="Has a login account" className="w-5 h-5 rounded-md bg-gold-light text-gold-dark flex items-center justify-center shrink-0">
                              <KeyRound size={11} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className="text-xs font-semibold text-gray-600">{market?.name || <span className="text-gray-300">Independent</span>}</span>
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <span className="text-xs font-semibold text-gray-600">{seller.district}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <a href={`tel:${seller.phone}`} className="text-xs font-semibold text-gray-600 hover:text-dark flex items-center gap-1 no-underline">
                          <Phone size={11} /> {seller.phone}
                        </a>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditSeller(seller)}
                            className="p-2 rounded-lg text-gray-400 hover:text-dark hover:bg-gray-100 transition-colors"
                            title="Edit seller"
                          >
                            <Edit size={14} />
                          </button>
                          {isSuper && (
                            <button
                              onClick={() => handleDeleteSeller(seller)}
                              className="p-2 rounded-lg text-gray-400 hover:text-danger hover:bg-danger-light transition-colors"
                              title="Delete seller"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sellers.length === 0 && (
            <div className="p-12 text-center">
              <Users className="mx-auto text-gray-300 mb-3" size={40} />
              <p className="text-sm font-medium text-gray-600">No sellers yet — add the first one.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Add Market modal (super admin) ── */}
      {showMarketModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl relative">
            <button onClick={() => setShowMarketModal(false)} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"><X size={16} /></button>
            <h2 className="text-lg font-bold text-gray-900 mb-5">Add Market</h2>
            <form onSubmit={handleSaveMarket} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Market Name</label>
                <input className={inputCls} required value={marketForm.name} onChange={e => setMarketForm({ ...marketForm, name: e.target.value })} placeholder="e.g. Area 18 Auto Market" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">District</label>
                <CustomSelect
                  value={marketForm.district}
                  onChange={val => setMarketForm({ ...marketForm, district: val })}
                  options={districts.map((d: any) => ({ id: d.name, name: d.name }))}
                  placeholder="Select district…"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Description (optional)</label>
                <textarea className={`${inputCls} min-h-[70px]`} value={marketForm.description} onChange={e => setMarketForm({ ...marketForm, description: e.target.value })} placeholder="Where is it, what is it known for…" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowMarketModal(false)} className="btn-secondary flex-1 text-sm font-bold">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm font-bold disabled:opacity-60">{saving ? 'Saving…' : 'Add Market'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add / Edit Seller modal ── */}
      {showSellerModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl relative my-8">
            <button onClick={() => setShowSellerModal(false)} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"><X size={16} /></button>
            <h2 className="text-lg font-bold text-gray-900 mb-5">{editingSeller ? 'Edit Seller' : 'Add Seller'}</h2>
            <form onSubmit={handleSaveSeller} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Full Name</label>
                <input className={inputCls} required value={sellerForm.name} onChange={e => setSellerForm({ ...sellerForm, name: e.target.value })} placeholder="e.g. John Banda" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Phone</label>
                  <input className={inputCls} required type="tel" value={sellerForm.phone} onChange={e => setSellerForm({ ...sellerForm, phone: e.target.value })} placeholder="0999 000 000" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Type</label>
                  <CustomSelect
                    value={sellerForm.sellerType}
                    onChange={val => setSellerForm({ ...sellerForm, sellerType: val })}
                    options={[{ id: 'INDIVIDUAL', name: 'Individual' }, { id: 'DEALER', name: 'Dealer' }]}
                    placeholder="Type"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">District</label>
                <CustomSelect
                  value={sellerForm.district}
                  onChange={val => setSellerForm({ ...sellerForm, district: val, marketId: '' })}
                  options={districts.map((d: any) => ({ id: d.name, name: d.name }))}
                  placeholder="Select district…"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Market (optional)</label>
                <CustomSelect
                  value={sellerForm.marketId}
                  onChange={val => setSellerForm({ ...sellerForm, marketId: val })}
                  options={filteredMarketsForSeller.map((m: any) => ({ id: m.id, name: m.name }))}
                  placeholder={sellerForm.district ? 'Independent — no market' : 'Select district first'}
                />
              </div>

              {!editingSeller && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sellerForm.createUser}
                      onChange={e => setSellerForm({ ...sellerForm, createUser: e.target.checked })}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><KeyRound size={12} /> Also create a login for this seller</span>
                  </label>
                  {sellerForm.createUser && (
                    <div className="space-y-3 pt-1">
                      <input className={inputCls} type="email" required placeholder="Login email" value={sellerForm.userEmail} onChange={e => setSellerForm({ ...sellerForm, userEmail: e.target.value })} />
                      <PasswordInput required value={sellerForm.userPassword} onChange={val => setSellerForm({ ...sellerForm, userPassword: val })} placeholder="Login password" />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSellerModal(false)} className="btn-secondary flex-1 text-sm font-bold">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm font-bold disabled:opacity-60">
                  {saving ? 'Saving…' : editingSeller ? 'Save Changes' : 'Add Seller'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketManager;
