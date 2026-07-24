import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Store, Users, UserCircle, MapPin, ArrowLeft, Trash2, Plus, Car
} from 'lucide-react';
import { api } from '../lib/api';
import { useModal } from '../components/ui/ModalContext';
import CustomSelect from '../components/ui/CustomSelect';

const MarketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useModal();
  
  const [market, setMarket] = useState<any | null>(null);
  const [sellers, setSellers] = useState<any[]>([]);
  const [attendants, setAttendants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Registration States
  const [showSellerModal, setShowSellerModal] = useState(false);
  const [showAttendantModal, setShowAttendantModal] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [sellerForm, setSellerForm] = useState({ 
    name: '', phone: '', district: '', marketId: '', 
    sellerType: 'INDIVIDUAL', createUser: false, 
    userEmail: '', userPassword: '', userRole: 'SELLER' 
  });
  
  const [attendantForm, setAttendantForm] = useState({ 
    name: '', phone: '', marketId: '', sellerId: '', 
    createUser: false, userEmail: '', userPassword: '', userRole: 'MARKET_ATTENDANT' 
  });

  useEffect(() => {
    if (id) {
      fetchMarketData();
    }
  }, [id]);

  const fetchMarketData = async () => {
    setLoading(true);
    try {
      const [mRes, sRes, aRes] = await Promise.all([
        api.get('/markets'),
        api.get('/sellers'),
        api.get('/attendants'),
      ]);
      
      const foundMarket = mRes.data.find((m: any) => m.id === id);
      if (foundMarket) {
        setMarket(foundMarket);
        // Filter relationships
        setSellers(sRes.data.filter((s: any) => s.marketId === id));
        setAttendants(aRes.data.filter((a: any) => a.marketId === id));
        // Contextually pre-fill forms
        setSellerForm(prev => ({ ...prev, marketId: id || '', district: foundMarket.district }));
        setAttendantForm(prev => ({ ...prev, marketId: id || '' }));
      } else {
        await showAlert({ title: 'Not Found', message: 'The requested market location could not be located.', variant: 'error' });
        navigate('/markets');
      }
    } catch (error) {
      console.error('Failed to fetch market profile', error);
      await showAlert({ title: 'Error', message: 'Failed to load market data.', variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/sellers', sellerForm);
      await fetchMarketData();
      setShowSellerModal(false);
      setSellerForm({ 
        name: '', phone: '', district: market?.district || '', marketId: id || '', 
        sellerType: 'INDIVIDUAL', createUser: false, userEmail: '', userPassword: '', userRole: 'SELLER' 
      });
      await showAlert({ title: 'Success', message: 'Seller registered successfully.', variant: 'success' });
    } catch (error) {
       console.error(error);
       await showAlert({ title: 'Error', message: 'Failed to register seller.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAttendant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/attendants', attendantForm);
      await fetchMarketData();
      setShowAttendantModal(false);
      setAttendantForm({ 
        name: '', phone: '', marketId: id || '', sellerId: '', 
        createUser: false, userEmail: '', userPassword: '', userRole: 'MARKET_ATTENDANT' 
      });
      await showAlert({ title: 'Success', message: 'Attendant added.', variant: 'success' });
    } catch (error) {
       console.error(error);
       await showAlert({ title: 'Error', message: 'Failed to add attendant.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: string, entityId: string) => {
    const confirmed = await showConfirm({
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete this ${type}?`,
      variant: 'danger',
      confirmLabel: `Delete ${type}`
    });
    if (!confirmed) return;
    try {
      await api.delete(`/${type}s/${entityId}`);
      fetchMarketData();
      await showAlert({ title: 'Removed', message: `${type} removed.`, variant: 'info' });
    } catch (error) {
       console.error(error);
       await showAlert({ title: 'Error', message: `Failed to remove ${type}.`, variant: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="w-full h-[500px] flex flex-col items-center justify-center gap-4 text-gray-400">
        <div className="w-8 h-8 border-4 border-gray-100 border-t-coral rounded-full animate-spin" />
        <span className="font-medium">Loading market profile...</span>
      </div>
    );
  }

  if (!market) return null;

  return (
    <div className="flex flex-col gap-8 w-full animate-in fade-in duration-500 pb-20">
      {/* Page Header */}
      <div className="flex flex-col gap-6">
        <button 
          onClick={() => navigate('/markets')}
          className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-dark transition-colors w-fit group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Ecosystem
        </button>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6 pt-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-dark text-white flex items-center justify-center shadow-lg shadow-dark/10 shrink-0">
              <Store size={24} />
            </div>
            <div className="flex flex-col gap-0.5">
              <h1 className="text-2xl font-black tracking-tight text-gray-900 border-l-[3px] border-coral pl-3">
                {market.name}
              </h1>
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 pl-3">
                <MapPin size={12} /> {market.district} District
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 text-center flex items-center gap-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Inventory</span>
                <span className="text-lg font-black text-gray-900">{market._count?.cars || 0}</span>
             </div>
             <div className="flex items-center gap-2 ml-2">
                <button 
                  onClick={() => navigate(`/inventory?marketId=${id}`)}
                  className="p-2 bg-dark text-white rounded-lg hover:bg-coral transition-colors flex items-center gap-2 text-xs font-bold px-4 group/list"
                >
                  <Car size={14} className="group-hover:scale-110 transition-transform" /> List Car Here
                </button>
                <div className="w-px h-6 bg-gray-200 mx-1"></div>
                <button 
                  onClick={() => setShowSellerModal(true)}
                  className="p-2 bg-coral text-white rounded-lg hover:bg-dark transition-colors flex items-center gap-2 text-xs font-bold px-4"
                >
                  <Plus size={14} /> Add Seller
                </button>
                <button 
                  onClick={() => setShowAttendantModal(true)}
                  className="p-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-xs font-bold px-4"
                >
                  <Plus size={14} /> Add Guide
                </button>
             </div>
          </div>
        </div>
      </div>

      {/* Stats and Description */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-pharmacore-gray text-dark flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Sellers</span>
            <span className="text-xl font-black text-gray-900">{sellers.length}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-pharmacore-gray text-dark flex items-center justify-center shrink-0">
            <UserCircle size={20} />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Guides</span>
            <span className="text-xl font-black text-gray-900">{attendants.length}</span>
          </div>
        </div>

        <div className="col-span-2 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Briefing</span>
          <p className="text-xs font-semibold text-gray-500 line-clamp-2 italic">
            {market.description || 'No specialized briefing provided for this market location.'}
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sellers Section (Left / Main) */}
        <section className="lg:col-span-8 space-y-4">
          <h3 className="text-base font-black text-gray-900 flex items-center gap-2 px-1">
             <span className="w-1.5 h-1.5 rounded-full bg-coral"></span> Assigned Sellers Team
          </h3>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-500 font-bold">
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">Seller</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">Type</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">Contact</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px] w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sellers.map(seller => (
                  <tr key={seller.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 font-bold text-gray-900">{seller.name}</td>
                    <td className="py-4 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-pharmacore-gray text-dark uppercase">{seller.sellerType}</span>
                    </td>
                    <td className="py-4 px-4 font-bold text-gray-500">
                      <a href={`tel:${seller.phone}`} className="hover:text-coral transition-colors">
                        {seller.phone}
                      </a>
                    </td>
                    <td className="py-4 px-4 text-center">
                       <button onClick={() => handleDelete('seller', seller.id)} className="p-1.5 text-gray-300 hover:text-coral transition-colors">
                          <Trash2 size={14} />
                       </button>
                    </td>
                  </tr>
                ))}
                {sellers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-gray-400 italic">No assigned sellers found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Attendants Section (Right / Secondary) */}
        <section className="lg:col-span-4 space-y-4">
          <h3 className="text-base font-black text-gray-900 flex items-center gap-2 px-1">
            <span className="w-1.5 h-1.5 rounded-full bg-pharmacore-gray"></span> Market Guides
          </h3>
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100 text-gray-500 font-bold">
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">Name</th>
                  <th className="py-3 px-4 uppercase tracking-wider text-[10px]">Contact</th>
                  <th className="py-3 px-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {attendants.map(attendant => (
                  <tr key={attendant.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-4 font-bold text-gray-900">{attendant.name}</td>
                    <td className="py-4 px-4 font-bold text-gray-500">{attendant.phone}</td>
                    <td className="py-4 px-4 text-center">
                       <button onClick={() => handleDelete('attendant', attendant.id)} className="p-1.5 text-gray-300 hover:text-coral transition-colors">
                          <Trash2 size={14} />
                       </button>
                    </td>
                  </tr>
                ))}
                {attendants.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-gray-400 italic">No guides registered.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Modals */}
      {showSellerModal && (
        <div className="fixed inset-0 bg-gray-900/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-gray-100">
            <h3 className="font-bold text-xl mb-6 text-gray-900">Register New Seller</h3>
            <form onSubmit={handleSaveSeller} className="flex flex-col gap-5">
               <div className="space-y-1.5">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Full Name *</label>
                 <input required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold focus:border-dark outline-none transition-all" value={sellerForm.name} onChange={e => setSellerForm({...sellerForm, name: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone Number *</label>
                 <input required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold focus:border-dark outline-none transition-all" value={sellerForm.phone} onChange={e => setSellerForm({...sellerForm, phone: e.target.value})} />
               </div>
               
               {/* Market info is fixed based on current page context */}
               <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Assigned Location</span>
                  <span className="text-sm font-bold text-gray-700">{market.name} ({market.district} District)</span>
               </div>

               <div className="pt-2 border-t border-gray-100 mt-2">
                 <label className="flex items-center gap-3 cursor-pointer mb-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                   <input type="checkbox" className="w-5 h-5 text-coral rounded-lg border-gray-300 focus:ring-coral transition-all" checked={sellerForm.createUser} onChange={e => setSellerForm({...sellerForm, createUser: e.target.checked})} />
                   <span className="text-sm font-bold text-gray-800">Provision Login Account</span>
                 </label>
                 
                 {sellerForm.createUser && (
                   <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200 animate-in slide-in-from-top-2 duration-300">
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Email *</label>
                       <input required={sellerForm.createUser} type="email" placeholder="seller@example.com" className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold focus:border-dark outline-none transition-all" value={sellerForm.userEmail} onChange={e => setSellerForm({...sellerForm, userEmail: e.target.value})} />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Password *</label>
                       <input required={sellerForm.createUser} minLength={6} type="password" placeholder="••••••••" className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold focus:border-dark outline-none transition-all" value={sellerForm.userPassword} onChange={e => setSellerForm({...sellerForm, userPassword: e.target.value})} />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Market Role *</label>
                        <CustomSelect 
                          value={sellerForm.userRole}
                          onChange={(val) => setSellerForm({...sellerForm, userRole: val})}
                          options={[
                            { id: 'SELLER', name: 'Standard Seller' },
                            { id: 'ADMIN', name: 'Admin (Executive Seller)' }
                          ]}
                          placeholder="Select role"
                        />
                      </div>
                   </div>
                 )}
               </div>

               <div className="mt-4 flex justify-end gap-3">
                 <button type="button" onClick={() => setShowSellerModal(false)} className="px-5 py-2.5 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                 <button type="submit" disabled={saving} className="btn-primary px-8 font-bold">{saving ? 'Registering...' : 'Register Seller'}</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {showAttendantModal && (
        <div className="fixed inset-0 bg-gray-900/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-gray-100">
            <h3 className="font-bold text-xl mb-6 text-gray-900">Add Market Guide</h3>
            <form onSubmit={handleSaveAttendant} className="flex flex-col gap-5">
               <div className="space-y-1.5">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Full Name *</label>
                 <input required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold focus:border-dark outline-none transition-all" value={attendantForm.name} onChange={e => setAttendantForm({...attendantForm, name: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone Number *</label>
                 <input required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold focus:border-dark outline-none transition-all" value={attendantForm.phone} onChange={e => setAttendantForm({...attendantForm, phone: e.target.value})} />
               </div>
               
               <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Stationed At</span>
                  <span className="text-sm font-bold text-gray-700">{market.name} ({market.district})</span>
               </div>

               <div className="pt-2 border-t border-gray-100 mt-2">
                 <label className="flex items-center gap-3 cursor-pointer mb-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                   <input type="checkbox" className="w-5 h-5 text-coral rounded-lg border-gray-300 focus:ring-coral transition-all" checked={attendantForm.createUser} onChange={e => setAttendantForm({...attendantForm, createUser: e.target.checked})} />
                   <span className="text-sm font-bold text-gray-800">Provision Login Account</span>
                 </label>
                 
                 {attendantForm.createUser && (
                   <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200 animate-in slide-in-from-top-2 duration-300">
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Email *</label>
                       <input required={attendantForm.createUser} type="email" placeholder="guide@example.com" className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold focus:border-dark outline-none transition-all" value={attendantForm.userEmail} onChange={e => setAttendantForm({...attendantForm, userEmail: e.target.value})} />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Password *</label>
                       <input required={attendantForm.createUser} minLength={6} type="password" placeholder="••••••••" className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold focus:border-dark outline-none transition-all" value={attendantForm.userPassword} onChange={e => setAttendantForm({...attendantForm, userPassword: e.target.value})} />
                     </div>
                   </div>
                 )}
               </div>

               <div className="mt-4 flex justify-end gap-3">
                 <button type="button" onClick={() => setShowAttendantModal(false)} className="px-5 py-2.5 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                 <button type="submit" disabled={saving} className="btn-primary px-8 font-bold">{saving ? 'Saving...' : 'Save Guide'}</button>
               </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default MarketDetail;
