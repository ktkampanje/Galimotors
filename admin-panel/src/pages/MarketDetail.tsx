import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Store, Users, Plus, Trash2, MapPin, ArrowLeft, Edit, Phone, X, KeyRound, Car, UserCircle
} from 'lucide-react';
import { api } from '../lib/api';
import { useModal } from '../components/ui/ModalContext';
import { useAuth } from '../lib/AuthContext';
import CustomSelect from '../components/ui/CustomSelect';
import PasswordInput from '../components/ui/PasswordInput';

/**
 * One market's page: identity + everyone working in it. Sellers and
 * attendants are added here with the market already fixed — no dropdown
 * to pick the wrong one.
 */

const inputCls = 'w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all placeholder:text-gray-400';

const MarketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useModal();
  const { user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN';

  const [loading, setLoading] = useState(true);
  const [market, setMarket] = useState<any | null>(null);
  const [sellers, setSellers] = useState<any[]>([]);
  const [attendants, setAttendants] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);

  const [showMarketEdit, setShowMarketEdit] = useState(false);
  const [marketForm, setMarketForm] = useState({ name: '', district: '', description: '' });

  const [showSellerModal, setShowSellerModal] = useState(false);
  const [editingSeller, setEditingSeller] = useState<any | null>(null);
  const [sellerForm, setSellerForm] = useState({ name: '', phone: '', sellerType: 'INDIVIDUAL', createUser: false, userEmail: '', userPassword: '' });

  const [showAttendantModal, setShowAttendantModal] = useState(false);
  const [attendantForm, setAttendantForm] = useState({ name: '', phone: '', createUser: false, userEmail: '', userPassword: '' });

  const [saving, setSaving] = useState(false);

  const refreshData = useCallback(async () => {
    try {
      const [mRes, sRes, aRes, dRes] = await Promise.allSettled([
        api.get('/markets'),
        api.get('/sellers'),
        api.get('/attendants'),
        api.get('/locations/districts'),
      ]);
      if (mRes.status === 'fulfilled') setMarket((mRes.value.data as any[]).find(m => m.id === id) || null);
      if (sRes.status === 'fulfilled') setSellers((sRes.value.data as any[]).filter(s => s.marketId === id));
      if (aRes.status === 'fulfilled') setAttendants((aRes.value.data as any[]).filter(a => a.marketId === id));
      if (dRes.status === 'fulfilled') setDistricts(dRes.value.data);
    } catch (error) {
      console.error('Failed to load market', error);
    }
  }, [id]);

  useEffect(() => { (async () => { setLoading(true); await refreshData(); setLoading(false); })(); }, [refreshData]);

  // ── Market edit (super admin) ──
  const handleSaveMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/markets/${id}`, marketForm);
      setShowMarketEdit(false);
      refreshData();
    } catch (error: any) {
      await showAlert({ title: 'Save Failed', message: error.response?.data?.message || error.response?.data?.error || 'Could not update the market.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ── Sellers ──
  const openAddSeller = () => {
    setEditingSeller(null);
    setSellerForm({ name: '', phone: '', sellerType: 'INDIVIDUAL', createUser: false, userEmail: '', userPassword: '' });
    setShowSellerModal(true);
  };

  const openEditSeller = (seller: any) => {
    setEditingSeller(seller);
    setSellerForm({ name: seller.name, phone: seller.phone, sellerType: seller.sellerType || 'INDIVIDUAL', createUser: false, userEmail: '', userPassword: '' });
    setShowSellerModal(true);
  };

  const handleSaveSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerForm.name || !sellerForm.phone) {
      await showAlert({ title: 'Incomplete Data', message: 'Name and Phone are required.', variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      if (editingSeller) {
        await api.put(`/sellers/${editingSeller.id}`, { name: sellerForm.name, phone: sellerForm.phone, sellerType: sellerForm.sellerType });
      } else {
        await api.post('/sellers', {
          name: sellerForm.name, phone: sellerForm.phone, sellerType: sellerForm.sellerType,
          district: market?.district, marketId: id,
          createUser: sellerForm.createUser, userEmail: sellerForm.userEmail, userPassword: sellerForm.userPassword, userRole: 'SELLER',
        });
      }
      setShowSellerModal(false);
      refreshData();
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

  // ── Attendants (super admin manages) ──
  const handleSaveAttendant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attendantForm.name || !attendantForm.phone) {
      await showAlert({ title: 'Incomplete Data', message: 'Name and Phone are required.', variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/attendants', {
        name: attendantForm.name, phone: attendantForm.phone, marketId: id,
        createUser: attendantForm.createUser, userEmail: attendantForm.userEmail, userPassword: attendantForm.userPassword, userRole: 'MARKET_ATTENDANT',
      });
      setShowAttendantModal(false);
      setAttendantForm({ name: '', phone: '', createUser: false, userEmail: '', userPassword: '' });
      refreshData();
    } catch (error: any) {
      await showAlert({ title: 'Save Failed', message: error.response?.data?.message || error.response?.data?.error || 'Could not add the attendant.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAttendant = async (attendant: any) => {
    const confirmed = await showConfirm({
      title: 'Remove Attendant',
      message: `Remove "${attendant.name}" from ${market?.name}?${attendant.userId ? ' Their login account stays and should be re-linked or deleted on the Users page.' : ''}`,
      variant: 'danger',
      confirmLabel: 'Remove',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/attendants/${attendant.id}`);
      refreshData();
    } catch (error: any) {
      await showAlert({ title: 'Cannot Remove', message: error.response?.data?.error || error.response?.data?.message || 'Failed to remove the attendant.', variant: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin" />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="card-widget p-12 text-center max-w-lg mx-auto mt-12">
        <p className="text-sm font-semibold text-gray-600 mb-4">This market no longer exists.</p>
        <Link to="/markets" className="btn-primary inline-flex items-center gap-2 text-sm font-bold no-underline">
          <ArrowLeft size={15} /> All markets
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto animate-in fade-in duration-500 pb-12">
      <Link to="/markets" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors no-underline w-fit">
        <ArrowLeft size={15} /> All markets
      </Link>

      {/* Market header */}
      <div className="card-widget p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-dark text-gold flex items-center justify-center shrink-0">
            <Store size={26} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 truncate">{market.name}</h1>
            <p className="text-sm text-gray-500 font-medium flex items-center gap-1"><MapPin size={13} /> {market.district}</p>
            {market.description && <p className="text-[13px] text-gray-500 mt-1.5 leading-snug">{market.description}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => navigate(`/inventory?viewMarket=${id}`)}
              className="btn-secondary flex items-center gap-1.5 text-sm font-bold"
            >
              <Car size={14} /> {market._count?.cars ?? 0} Cars
            </button>
            {isSuper && (
              <button
                onClick={() => { setMarketForm({ name: market.name, district: market.district, description: market.description || '' }); setShowMarketEdit(true); }}
                className="btn-secondary flex items-center gap-1.5 text-sm font-bold"
              >
                <Edit size={14} /> <span className="hidden sm:inline">Edit</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Sellers ── */}
        <div className="lg:col-span-2 card-widget p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Users size={15} className="text-gold-dark" /> Sellers ({sellers.length})</h2>
            <button onClick={openAddSeller} className="btn-primary flex items-center gap-1.5 text-xs font-bold px-3 py-2">
              <Plus size={14} /> Add Seller
            </button>
          </div>
          {sellers.length === 0 ? (
            <p className="text-sm font-medium text-gray-400 text-center py-10">No sellers in this market yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {sellers.map(seller => (
                <div key={seller.id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{seller.name}</p>
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
                  <div className="flex items-center gap-1 shrink-0">
                    <a href={`tel:${seller.phone}`} className="text-xs font-semibold text-gray-500 hover:text-dark flex items-center gap-1 no-underline mr-2">
                      <Phone size={11} /> <span className="hidden sm:inline">{seller.phone}</span>
                    </a>
                    <button onClick={() => openEditSeller(seller)} className="p-2 rounded-lg text-gray-400 hover:text-dark hover:bg-gray-100 transition-colors" title="Edit">
                      <Edit size={13} />
                    </button>
                    {isSuper && (
                      <button onClick={() => handleDeleteSeller(seller)} className="p-2 rounded-lg text-gray-400 hover:text-danger hover:bg-danger-light transition-colors" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Attendants ── */}
        <div className="card-widget p-0 overflow-hidden h-fit">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><UserCircle size={15} className="text-gold-dark" /> Attendants ({attendants.length})</h2>
            {isSuper && (
              <button onClick={() => setShowAttendantModal(true)} className="btn-primary flex items-center gap-1.5 text-xs font-bold px-3 py-2">
                <Plus size={14} /> Add
              </button>
            )}
          </div>
          {attendants.length === 0 ? (
            <p className="text-sm font-medium text-gray-400 text-center py-10">No attendants yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {attendants.map(attendant => (
                <div key={attendant.id} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{attendant.name}</p>
                      <a href={`tel:${attendant.phone}`} className="text-[11px] font-semibold text-gray-400 hover:text-dark flex items-center gap-1 no-underline">
                        <Phone size={10} /> {attendant.phone}
                      </a>
                    </div>
                    {attendant.userId && (
                      <span title="Has a login account" className="w-5 h-5 rounded-md bg-gold-light text-gold-dark flex items-center justify-center shrink-0">
                        <KeyRound size={11} />
                      </span>
                    )}
                  </div>
                  {isSuper && (
                    <button onClick={() => handleDeleteAttendant(attendant)} className="p-2 rounded-lg text-gray-400 hover:text-danger hover:bg-danger-light transition-colors shrink-0" title="Remove">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Market modal ── */}
      {showMarketEdit && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl relative">
            <button onClick={() => setShowMarketEdit(false)} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"><X size={16} /></button>
            <h2 className="text-lg font-bold text-gray-900 mb-5">Edit Market</h2>
            <form onSubmit={handleSaveMarket} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Market Name</label>
                <input className={inputCls} required value={marketForm.name} onChange={e => setMarketForm({ ...marketForm, name: e.target.value })} />
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
                <label className="text-xs font-semibold text-gray-600">Description</label>
                <textarea className={`${inputCls} min-h-[70px]`} value={marketForm.description} onChange={e => setMarketForm({ ...marketForm, description: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowMarketEdit(false)} className="btn-secondary flex-1 text-sm font-bold">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm font-bold disabled:opacity-60">{saving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add / Edit Seller modal (market fixed) ── */}
      {showSellerModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl relative my-8">
            <button onClick={() => setShowSellerModal(false)} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"><X size={16} /></button>
            <h2 className="text-lg font-bold text-gray-900 mb-1">{editingSeller ? 'Edit Seller' : 'Add Seller'}</h2>
            <p className="text-xs font-semibold text-gray-400 mb-5 flex items-center gap-1"><Store size={11} /> {market.name}</p>
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

      {/* ── Add Attendant modal (super admin, market fixed) ── */}
      {showAttendantModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-7 max-w-md w-full shadow-2xl relative my-8">
            <button onClick={() => setShowAttendantModal(false)} className="absolute top-5 right-5 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"><X size={16} /></button>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Add Attendant</h2>
            <p className="text-xs font-semibold text-gray-400 mb-5 flex items-center gap-1"><Store size={11} /> {market.name}</p>
            <form onSubmit={handleSaveAttendant} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Full Name</label>
                <input className={inputCls} required value={attendantForm.name} onChange={e => setAttendantForm({ ...attendantForm, name: e.target.value })} placeholder="e.g. Grace Phiri" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Phone</label>
                <input className={inputCls} required type="tel" value={attendantForm.phone} onChange={e => setAttendantForm({ ...attendantForm, phone: e.target.value })} placeholder="0999 000 000" />
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attendantForm.createUser}
                    onChange={e => setAttendantForm({ ...attendantForm, createUser: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300"
                  />
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5"><KeyRound size={12} /> Also create a login for this attendant</span>
                </label>
                {attendantForm.createUser && (
                  <div className="space-y-3 pt-1">
                    <input className={inputCls} type="email" required placeholder="Login email" value={attendantForm.userEmail} onChange={e => setAttendantForm({ ...attendantForm, userEmail: e.target.value })} />
                    <PasswordInput required value={attendantForm.userPassword} onChange={val => setAttendantForm({ ...attendantForm, userPassword: val })} placeholder="Login password" />
                  </div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowAttendantModal(false)} className="btn-secondary flex-1 text-sm font-bold">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm font-bold disabled:opacity-60">{saving ? 'Saving…' : 'Add Attendant'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketDetail;
