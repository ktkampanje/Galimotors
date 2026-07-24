import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Store, Users, UserCircle, Plus, Trash2, MapPin, ChevronRight
} from 'lucide-react';
import { api } from '../lib/api';

import { useModal } from '../components/ui/ModalContext';
import CustomSelect from '../components/ui/CustomSelect';

const MarketManager = () => {
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useModal();
  const [activeTab, setActiveTab] = useState('markets');
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [markets, setMarkets] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [attendants, setAttendants] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);

  // Modals
  const [showMarketModal, setShowMarketModal] = useState(false);
  const [showAttendantModal, setShowAttendantModal] = useState(false);
  const [showSellerModal, setShowSellerModal] = useState(false);
  
  // Forms
  const [marketForm, setMarketForm] = useState({ name: '', district: '', description: '' });
  const [attendantForm, setAttendantForm] = useState({ name: '', phone: '', marketId: '', sellerId: '', createUser: false, userEmail: '', userPassword: '', userRole: 'MARKET_ATTENDANT' });
  const [sellerForm, setSellerForm] = useState({ name: '', phone: '', district: '', marketId: '', sellerType: 'INDIVIDUAL', createUser: false, userEmail: '', userPassword: '', userRole: 'SELLER' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    await refreshData();
    setLoading(false);
  };

  const refreshData = async () => {
    try {
      try {
        const dRes = await api.get('/locations/districts');
        setDistricts(dRes.data);
      } catch (err) {
        console.error('Failed to fetch districts', err);
      }

      const [mRes, sRes, aRes] = await Promise.all([
        api.get('/markets'),
        api.get('/sellers'),
        api.get('/attendants'),
      ]);
      
      setMarkets(mRes.data);
      setSellers(sRes.data);
      setAttendants(aRes.data);
    } catch (error) {
      console.error('Failed to refresh data', error);
    }
  };

  const handleSaveMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!marketForm.name || !marketForm.district) {
      await showAlert({ title: 'Incomplete Data', message: 'Name and District are mandatory.', variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/markets', marketForm);
      refreshData();
      setShowMarketModal(false);
      setMarketForm({ name: '', district: '', description: '' });
      await showAlert({
        title: 'Market Added',
        message: 'The new market location has been registered successfully.',
        variant: 'success'
      });
    } catch (error: any) {
       console.error(error);
       await showAlert({
         title: 'Save Failed',
         message: error.response?.data?.message || 'Could not register the market.',
         variant: 'error'
       });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAttendant = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/attendants', attendantForm);
      refreshData();
      setShowAttendantModal(false);
      setAttendantForm({ name: '', phone: '', marketId: '', sellerId: '', createUser: false, userEmail: '', userPassword: '', userRole: 'MARKET_ATTENDANT' });
      await showAlert({
        title: 'Attendant Registered',
        message: 'The market attendant has been added to the registry.',
        variant: 'success'
      });
    } catch (error) {
       console.error(error);
       await showAlert({
         title: 'Save Failed',
         message: 'Could not register the attendant.',
         variant: 'error'
       });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerForm.name || !sellerForm.phone || !sellerForm.district) {
      await showAlert({ title: 'Incomplete Data', message: 'Name, Phone, and District are mandatory.', variant: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/sellers', sellerForm);
      refreshData();
      setShowSellerModal(false);
      setSellerForm({ name: '', phone: '', district: '', marketId: '', sellerType: 'INDIVIDUAL', createUser: false, userEmail: '', userPassword: '', userRole: 'SELLER' });
      await showAlert({
        title: 'Seller Account Created',
        message: 'The seller profile has been synchronized.',
        variant: 'success'
      });
    } catch (error) {
       console.error(error);
       await showAlert({ title: 'Save Failed', message: 'Error creating seller profile.', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    const confirmed = await showConfirm({
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete this ${type}?`,
      variant: 'danger',
      confirmLabel: `Delete ${type}`
    });
    if (!confirmed) return;
    try {
      await api.delete(`/${type}s/${id}`);
      refreshData();
      await showAlert({ title: 'Removed', message: `${type} removed.`, variant: 'info' });
    } catch (error) {
       console.error(error);
       await showAlert({ title: 'Error', message: `Failed to remove ${type}.`, variant: 'error' });
    }
  };

  const filteredMarketsForSeller = useMemo(() => {
    if (!sellerForm.district) return [];
    return markets.filter(m => m.district === sellerForm.district);
  }, [markets, sellerForm.district]);

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-100 pb-6 pt-2">
        <div className="flex flex-col gap-1">
           <h1 className="text-2xl font-black tracking-tight text-gray-900 border-l-[3px] border-coral pl-3">Markets Ecosystem</h1>
           <p className="text-sm text-gray-500 font-medium pl-3">Manage physical car markets, sellers, and on-ground attendants.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowMarketModal(true)} className="btn-primary py-2 px-4 flex items-center gap-2 font-bold">
            <Plus size={16} /> Add Market
          </button>
          <button onClick={() => setShowSellerModal(true)} className="btn-secondary py-2 px-4 flex items-center gap-2 bg-white text-gray-700 border border-gray-200 font-bold">
            <Plus size={16} /> Add Seller
          </button>
          <button onClick={() => setShowAttendantModal(true)} className="btn-secondary py-2 px-4 flex items-center gap-2 bg-white text-gray-700 border border-gray-200 font-bold">
            <Plus size={16} /> Add Attendant
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100/50 rounded-xl w-fit">
         {[
           { id: 'markets', label: 'Markets', icon: Store, count: markets.length },
           { id: 'sellers', label: 'Registered Sellers', icon: Users, count: sellers.length },
           { id: 'attendants', label: 'Market Attendants', icon: UserCircle, count: attendants.length }
         ].map(tab => (
           <button
             key={tab.id}
             onClick={() => setActiveTab(tab.id)}
             className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
           >
             <tab.icon size={16} className={activeTab === tab.id ? 'text-coral' : ''} />
             {tab.label}
             <span className="ml-1 bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full text-xs">{tab.count}</span>
           </button>
         ))}
      </div>

      <div className="flex-1 w-full bg-white rounded-2xl border border-gray-100 p-6 shadow-sm overflow-hidden min-h-[500px]">
         {loading ? (
           <div className="w-full h-[400px] flex flex-col items-center justify-center gap-4 text-gray-400">
             <div className="w-8 h-8 border-4 border-gray-100 border-t-coral rounded-full animate-spin" />
             <span className="font-medium">Loading ecosystem data...</span>
           </div>
         ) : (
           <>
             {/* MARKETS TAB */}
             {activeTab === 'markets' && (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {markets.map(market => (
                   <div 
                    key={market.id} 
                    onClick={() => navigate(`/markets/${market.id}`)}
                    className="border border-gray-100 rounded-xl p-5 hover:border-dark hover:shadow-xl transition-all group relative bg-white cursor-pointer"
                   >
                     <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); handleDelete('market', market.id); }} className="text-gray-400 hover:text-coral bg-gray-50 p-1.5 rounded-lg"><Trash2 size={14} /></button>
                     </div>
                     <div className="w-10 h-10 rounded-lg bg-pharmacore-gray text-dark flex items-center justify-center mb-4 group-hover:bg-dark group-hover:text-white transition-colors"><Store size={20} /></div>
                     <h3 className="font-bold text-gray-900 text-lg group-hover:text-dark">{market.name}</h3>
                     <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-1 mb-4">
                       <MapPin size={14} /> {market.district}
                     </div>
                     <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-4 mt-2">
                        <div className="flex flex-col items-center justify-center bg-gray-50 py-2 rounded-lg">
                           <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Sellers</span>
                           <span className="font-bold text-gray-900">{market._count?.sellers || 0}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-gray-50 py-2 rounded-lg">
                           <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Guides</span>
                           <span className="font-bold text-gray-900">{market._count?.attendants || 0}</span>
                        </div>
                        <div className="flex flex-col items-center justify-center bg-gray-50 py-2 rounded-lg">
                           <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Cars</span>
                           <span className="font-bold text-gray-900">{market._count?.cars || 0}</span>
                        </div>
                     </div>
                     <div className="mt-4 flex items-center justify-end text-xs font-bold text-coral opacity-0 group-hover:opacity-100 transition-opacity">
                        View Profile <ChevronRight size={14} />
                     </div>
                   </div>
                 ))}
                 {markets.length === 0 && <div className="col-span-full py-12 text-center text-gray-500">No markets registered yet. Click "Add Market" to begin.</div>}
               </div>
             )}

             {/* ATTENDANTS TAB */}
             {activeTab === 'attendants' && (
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead>
                     <tr className="border-b border-gray-100 text-gray-500 bg-gray-50/50">
                       <th className="font-bold py-4 px-4 rounded-tl-xl w-1/4">Attendant / Guide</th>
                       <th className="font-bold py-4 px-4">Contact</th>
                       <th className="font-bold py-4 px-4">Associated Market</th>
                       <th className="font-bold py-4 px-4 w-20 rounded-tr-xl">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {attendants.map(attendant => (
                       <tr key={attendant.id} className="hover:bg-gray-50 transition-colors group">
                         <td className="py-4 px-4 font-medium text-gray-900 flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-pharmacore-gray text-dark flex items-center justify-center">
                             <UserCircle size={16} />
                           </div>
                           {attendant.name}
                         </td>
                         <td className="py-4 px-4 text-gray-600 font-medium">{attendant.phone}</td>
                         <td className="py-4 px-4">
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-pharmacore-gray text-dark text-[10px] font-bold uppercase tracking-wider">
                             <Store size={12} /> {attendant.market?.name || 'Unknown Market'}
                           </span>
                         </td>
                         <td className="py-4 px-4">
                           <button onClick={() => handleDelete('attendant', attendant.id)} className="p-1.5 text-gray-400 hover:text-coral bg-white border border-gray-200 hover:border-coral/30 rounded-lg shadow-sm transition-all"><Trash2 size={14} /></button>
                         </td>
                       </tr>
                     ))}
                     {attendants.length === 0 && (
                       <tr><td colSpan={4} className="py-8 text-center text-gray-500">No attendants found.</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
             )}

             {/* SELLERS TAB */}
             {activeTab === 'sellers' && (
                <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead>
                     <tr className="border-b border-gray-100 text-gray-500 bg-gray-50/50">
                       <th className="font-bold py-4 px-4 rounded-tl-xl w-1/4">Seller Details</th>
                       <th className="font-bold py-4 px-4">Type</th>
                       <th className="font-bold py-4 px-4">Operating Market</th>
                       <th className="font-bold py-4 px-4">District</th>
                       <th className="font-bold py-4 px-4 w-20 rounded-tr-xl">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                     {sellers.map(seller => (
                       <tr key={seller.id} className="hover:bg-gray-50 transition-colors group">
                         <td className="py-4 px-4 font-medium text-gray-900 flex flex-col">
                           <span className="font-bold">{seller.name}</span>
                           <span className="text-xs text-gray-500 font-medium">{seller.phone}</span>
                         </td>
                         <td className="py-4 px-4"><span className="text-[10px] font-bold px-2 py-1 rounded bg-pharmacore-gray text-dark uppercase tracking-wider">{seller.sellerType}</span></td>
                         <td className="py-4 px-4">
                           <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-pharmacore-gray text-dark text-[10px] font-bold uppercase tracking-wider">
                             <Store size={12} /> {seller.market?.name || markets.find(m => m.id === seller.marketId)?.name || 'Independent / Direct'}
                           </span>
                         </td>
                         <td className="py-4 px-4 text-gray-600 font-medium">{seller.district}</td>
                         <td className="py-4 px-4">
                           <button onClick={() => handleDelete('seller', seller.id)} className="p-1.5 text-gray-400 hover:text-coral bg-white border border-gray-200 hover:border-coral/30 rounded-lg shadow-sm transition-all"><Trash2 size={14} /></button>
                         </td>
                       </tr>
                     ))}
                     {sellers.length === 0 && (
                       <tr><td colSpan={5} className="py-8 text-center text-gray-500">No sellers registered. Add them when listing cars.</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
             )}
           </>
         )}
      </div>

      {/* Modals */}
      {showMarketModal && (
        <div className="fixed inset-0 bg-gray-900/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-gray-100">
            <h3 className="font-bold text-xl mb-6 text-gray-900">Register New Market</h3>
            <form onSubmit={handleSaveMarket} className="flex flex-col gap-5">
               <div className="space-y-1.5">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Market Name *</label>
                 <input required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold focus:border-dark outline-none transition-all placeholder:text-gray-400" placeholder="e.g. Biwi Market" value={marketForm.name} onChange={e => setMarketForm({...marketForm, name: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">District *</label>
                  <CustomSelect 
                    value={districts.find(d => d.name === marketForm.district)?.id || ''}
                    onChange={(val) => {
                      const name = districts.find(d => d.id === val)?.name || '';
                      setMarketForm({...marketForm, district: name});
                    }}
                    options={districts.map(d => ({ id: d.id, name: d.name }))}
                    placeholder="Select district"
                  />
                  {districts.length === 0 && (
                    <p className="text-[10px] text-coral font-bold mt-1">⚠️ No districts found. Add districts first.</p>
                  )}
                </div>
               <div className="space-y-1.5">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Description (Optional)</label>
                 <textarea className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold focus:border-dark outline-none transition-all resize-none" rows={2} placeholder="Brief location details..." value={marketForm.description} onChange={e => setMarketForm({...marketForm, description: e.target.value})} />
               </div>
               <div className="mt-4 flex justify-end gap-3">
                 <button type="button" onClick={() => setShowMarketModal(false)} className="px-5 py-2.5 font-bold text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                 <button type="submit" disabled={saving} className="btn-primary px-8 font-bold">{saving ? 'Saving...' : 'Save Market'}</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {showAttendantModal && (
        <div className="fixed inset-0 bg-gray-900/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-gray-100">
            <h3 className="font-bold text-xl mb-6 text-gray-900">Register Attendant</h3>
            <form onSubmit={handleSaveAttendant} className="flex flex-col gap-5">
               <div className="space-y-1.5">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Full Name *</label>
                 <input required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold focus:border-dark outline-none transition-all" value={attendantForm.name} onChange={e => setAttendantForm({...attendantForm, name: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone Number *</label>
                 <input required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold focus:border-dark outline-none transition-all" value={attendantForm.phone} onChange={e => setAttendantForm({...attendantForm, phone: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Operating Market *</label>
                  <CustomSelect 
                    value={attendantForm.marketId}
                    onChange={(val) => setAttendantForm({...attendantForm, marketId: val})}
                    options={markets.map(m => ({ id: m.id, name: `${m.name} (${m.district})` }))}
                    placeholder="Select market"
                  />
                </div>
               
               <div className="pt-2 border-t border-gray-100 mt-2">
                 <label className="flex items-center gap-3 cursor-pointer mb-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                   <input type="checkbox" className="w-5 h-5 text-coral rounded-lg border-gray-300 focus:ring-coral transition-all" checked={attendantForm.createUser} onChange={e => setAttendantForm({...attendantForm, createUser: e.target.checked})} />
                   <span className="text-sm font-bold text-gray-800">Provision System Login Account</span>
                 </label>
                 
                 {attendantForm.createUser && (
                   <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200 animate-in slide-in-from-top-2 duration-300">
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Email Address *</label>
                       <input required={attendantForm.createUser} type="email" placeholder="attendant@example.com" className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold focus:border-dark outline-none transition-all" value={attendantForm.userEmail} onChange={e => setAttendantForm({...attendantForm, userEmail: e.target.value})} />
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
                 <button type="submit" disabled={saving} className="btn-primary px-8 font-bold">{saving ? 'Saving...' : 'Save Attendant'}</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {showSellerModal && (
        <div className="fixed inset-0 bg-gray-900/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-gray-100">
            <h3 className="font-bold text-xl mb-6 text-gray-900">Register New Seller</h3>
            <form onSubmit={handleSaveSeller} className="flex flex-col gap-5">
               <div className="space-y-1.5">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Full Name *</label>
                 <input required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold focus:border-dark outline-none" value={sellerForm.name} onChange={e => setSellerForm({...sellerForm, name: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Phone Number *</label>
                 <input required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-semibold focus:border-dark outline-none" value={sellerForm.phone} onChange={e => setSellerForm({...sellerForm, phone: e.target.value})} />
               </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">District *</label>
                  <CustomSelect 
                    value={districts.find(d => d.name === sellerForm.district)?.id || ''}
                    onChange={(val) => {
                      const name = districts.find(d => d.id === val)?.name || '';
                      setSellerForm({...sellerForm, district: name, marketId: ''}); // Cascading reset
                    }}
                    options={districts.map(d => ({ id: d.id, name: d.name }))}
                    placeholder="Select district"
                  />
                  {districts.length === 0 && (
                    <p className="text-[10px] text-coral font-bold mt-1">⚠️ No districts found.</p>
                  )}
                </div>
               <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Market (Optional)</label>
                  <CustomSelect 
                    value={sellerForm.marketId}
                    onChange={(val) => setSellerForm({...sellerForm, marketId: val})}
                    options={filteredMarketsForSeller.map(m => ({ id: m.id, name: m.name }))}
                    placeholder={sellerForm.district ? "Assign to market" : "Select district first"}
                    disabled={!sellerForm.district}
                  />
                  {sellerForm.district && filteredMarketsForSeller.length === 0 && (
                     <p className="text-[10px] text-gray-400 font-bold mt-1 italic">No markets registered in {sellerForm.district}.</p>
                  )}
                </div>

               <div className="pt-2 border-t border-gray-100 mt-2">
                 <label className="flex items-center gap-3 cursor-pointer mb-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                   <input type="checkbox" className="w-5 h-5 text-coral rounded-lg border-gray-300 focus:ring-coral transition-all" checked={sellerForm.createUser} onChange={e => setSellerForm({...sellerForm, createUser: e.target.checked})} />
                   <span className="text-sm font-bold text-gray-800">Provision System Login Account</span>
                 </label>
                 
                 {sellerForm.createUser && (
                   <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200 animate-in slide-in-from-top-2 duration-300">
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Email Address *</label>
                       <input required={sellerForm.createUser} type="email" placeholder="seller@example.com" className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold focus:border-dark outline-none transition-all" value={sellerForm.userEmail} onChange={e => setSellerForm({...sellerForm, userEmail: e.target.value})} />
                     </div>
                     <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Password *</label>
                       <input required={sellerForm.createUser} minLength={6} type="password" placeholder="••••••••" className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold focus:border-dark outline-none transition-all" value={sellerForm.userPassword} onChange={e => setSellerForm({...sellerForm, userPassword: e.target.value})} />
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">System Role *</label>
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
                 <button type="submit" disabled={saving} className="btn-primary px-8 font-bold">{saving ? 'Saving...' : 'Save Seller'}</button>
               </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default MarketManager;
