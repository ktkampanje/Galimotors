import React, { useState, useEffect } from 'react';
import { Plus, X, Edit, Trash2, Save, Map, Fuel, Wallet, Info, Check } from 'lucide-react';
import { api } from '../lib/api';

interface District {
  id: string;
  name: string;
  sortOrder: number;
  chargeDriverAllowance: boolean;
  chargeAccommodation: boolean;
  chargeFuel: boolean;
}

interface Distance {
  id: string;
  fromDistrictId: string;
  toDistrictId: string;
  distanceKm: number;
}

interface GlobalSettings {
  driverAllowance: number;
  accommodationFee: number;
}

import { useModal } from '../components/ui/ModalContext';

const LocationManager: React.FC = () => {
  const { showAlert, showConfirm } = useModal();
  const [districts, setDistricts] = useState<District[]>([]);
  const [distances, setDistances] = useState<Distance[]>([]);
  const [settings, setSettings] = useState<GlobalSettings>({ driverAllowance: 15000, accommodationFee: 25000 });
  const [fuelPrices, setFuelPrices] = useState<{ [key: string]: number }>({ PETROL: 2530, DIESEL: 2730 });
  const [loading, setLoading] = useState(true);
  
  const [showAddDistrict, setShowAddDistrict] = useState(false);
  const [newDistrictName, setNewDistrictName] = useState('');
  
  const [editingDistrict, setEditingDistrict] = useState<{ 
    id: string; 
    name: string; 
    sortOrder: number;
    distanceKm: number;
    chargeDriverAllowance: boolean;
    chargeAccommodation: boolean;
    chargeFuel: boolean;
  } | null>(null);
  
  const [lilongweId, setLilongweId] = useState<string>('');

  const fetchData = async () => {
    try {
      const [districtsRes, distancesRes, settingsRes, fuelRes] = await Promise.all([
        api.get('/locations/districts'),
        api.get('/locations/distances'),
        api.get('/settings/global'),
        api.get('/settings/fuel')
      ]);
      
      const dists = districtsRes.data;
      setDistricts(dists);
      setDistances(distancesRes.data);
      if (settingsRes.data) setSettings(settingsRes.data);
      
      if (fuelRes.data) {
        const prices = fuelRes.data.reduce((acc: any, curr: any) => ({
          ...acc,
          [curr.fuelType]: curr.pricePerLitre
        }), {});
        setFuelPrices(prev => ({ ...prev, ...prices }));
      }
      
      const ll = dists.find((d: any) => d.name.toLowerCase() === 'lilongwe');
      if (ll) setLilongweId(ll.id);
      
    } catch (error) {
      console.error('Failed to fetch logistics data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddDistrict = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/locations/districts', { name: newDistrictName });
      setNewDistrictName('');
      setShowAddDistrict(false);
      fetchData();
      await showAlert({
        title: 'District Added',
        message: `${newDistrictName} has been successfully registered.`,
        variant: 'success'
      });
    } catch (error) {
      console.error('Failed to add district', error);
      await showAlert({
        title: 'Save Failed',
        message: 'Could not add district. Ensure the name is unique.',
        variant: 'error'
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateDistrict = async () => {
    if (!editingDistrict) return;
    try {
      // 1. Update District Details
      await api.put(`/locations/districts/${editingDistrict.id}`, {
        name: editingDistrict.name,
        sortOrder: editingDistrict.sortOrder,
        chargeDriverAllowance: editingDistrict.chargeDriverAllowance,
        chargeAccommodation: editingDistrict.chargeAccommodation,
        chargeFuel: editingDistrict.chargeFuel
      });

      // 2. Update Distance (if not Lilongwe)
      if (editingDistrict.id !== lilongweId) {
        await api.put('/locations/distances', {
          fromDistrictId: lilongweId,
          toDistrictId: editingDistrict.id,
          distanceKm: editingDistrict.distanceKm
        });
      }

      setEditingDistrict(null);
      fetchData();
      await showAlert({
        title: 'Updated',
        message: 'Logistics and distance data updated.',
        variant: 'success'
      });
    } catch (error: any) {
      console.error('Failed to update district data', error);
      if (error.response?.status === 403) {
        await showAlert({
          title: 'Permission Denied',
          message: 'Only Super Admins can modify location data.',
          variant: 'error'
        });
      } else {
        await showAlert({
          title: 'Update Failed',
          message: 'Failed to save changes. Please try again.',
          variant: 'error'
        });
      }
    }
  };

  const handleDeleteDistrict = async (id: string) => {
    const confirmed = await showConfirm({
      title: 'Delete District',
      message: 'Are you sure? This may affect operational fee calculations across the system.',
      variant: 'danger',
      confirmLabel: 'Delete District'
    });

    if (!confirmed) return;

    try {
      await api.delete(`/locations/districts/${id}`);
      fetchData();
    } catch (error: any) {
      console.error('Failed to delete district', error);
      if (error.response?.status === 403) {
        await showAlert({
          title: 'Permission Denied',
          message: 'Only Super Admins can delete districts.',
          variant: 'error'
        });
      } else {
        await showAlert({
          title: 'Deletion Failed',
          message: 'Failed to delete district. It might be in use.',
          variant: 'error'
        });
      }
    }
  };

  const handleUpdateFuelPrice = async (fuelType: string, price: number) => {
    try {
      await api.put('/settings/fuel', { fuelType, pricePerLitre: price });
      setFuelPrices({ ...fuelPrices, [fuelType]: price });
      await showAlert({
        title: 'Price Updated',
        message: `${fuelType} rate has been updated in the logistics system.`,
        variant: 'success'
      });
    } catch (error) {
      console.error('Failed to update fuel price', error);
      await showAlert({
        title: 'Update Failed',
        message: 'Could not save the new fuel rate.',
        variant: 'error'
      });
    }
  };

  const handleUpdateSettings = async (field: keyof GlobalSettings, value: number) => {
    try {
      const newSettings = { ...settings, [field]: value };
      await api.put('/settings/global', newSettings);
      setSettings(newSettings);
      await showAlert({
        title: 'Settings Updated',
        message: 'Global travel variables saved successfully.',
        variant: 'success'
      });
    } catch (error) {
      console.error('Failed to update settings', error);
      await showAlert({
        title: 'Save Failed',
        message: 'Failed to update system settings.',
        variant: 'error'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-sm font-medium text-gray-500 animate-pulse">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin" />
          Loading logistics data...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Districts & Routes</h1>
          <p className="text-sm text-gray-500 font-medium">Manage Malawian districts and calculate travel distances from Lilongwe</p>
        </div>
        <button 
          onClick={() => setShowAddDistrict(true)} 
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Add District
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left/Main Column: District Table */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          <div className="card-widget p-0 overflow-hidden shadow-sm bg-white border border-gray-100">
            <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pharmacore-gray text-dark flex items-center justify-center shadow-sm border border-gray-100">
                  <Map size={18} />
                </div>
                <div className="flex flex-col">
                  <h3 className="text-base font-bold text-gray-900 leading-tight">District Registry</h3>
                  <p className="text-xs font-medium text-gray-500">Manage names, order and travel distances</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{districts.length} Districts</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-white">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 tracking-wider">District Name</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 tracking-wider">Distance from Base (KM)</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 tracking-wider">Fee Settings</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {districts.map((district) => {
                    const isEditing = editingDistrict?.id === district.id;
                    const isBase = district.id === lilongweId;
                    const distance = distances.find(d => d.toDistrictId === district.id || d.fromDistrictId === district.id)?.distanceKm || 0;

                    return (
                      <tr key={district.id} className={`group ${isEditing ? 'bg-pharmacore-gray/20' : 'hover:bg-gray-50'} transition-colors`}>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <input
                              type="number"
                              value={editingDistrict.sortOrder}
                              onChange={(e) => setEditingDistrict({...editingDistrict, sortOrder: parseInt(e.target.value) || 0})}
                              className="w-14 px-2 py-2 text-xs font-bold text-center bg-white border border-gray-200 rounded-lg focus:border-dark outline-none shadow-sm"
                            />
                          ) : (
                            <span className="w-8 h-8 rounded-lg bg-gray-50 text-gray-400 flex items-center justify-center text-xs font-bold tabular-nums">
                              {district.sortOrder}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <input
                              autoFocus
                              type="text"
                              value={editingDistrict.name}
                              onChange={(e) => setEditingDistrict({...editingDistrict, name: e.target.value})}
                              className="w-full max-w-[200px] px-3 py-2 text-sm font-semibold bg-white border border-gray-200 rounded-lg focus:border-dark outline-none shadow-sm"
                            />
                          ) : (
                            <div className="flex items-center gap-2">
                              {isBase && <Check size={14} className="text-dark" />}
                              <span className={`text-sm font-bold ${isBase ? 'text-dark' : 'text-gray-900'}`}>{district.name}</span>
                              {isBase && <span className="text-[10px] bg-dark text-white px-1.5 py-0.5 rounded font-black uppercase tracking-tighter">Base</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            isBase ? (
                              <span className="text-xs font-medium text-gray-400 italic">Base Location</span>
                            ) : (
                              <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="number"
                                    value={editingDistrict.distanceKm}
                                    onChange={(e) => setEditingDistrict({...editingDistrict, distanceKm: parseInt(e.target.value) || 0})}
                                    className="w-24 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-gray-900 focus:border-dark focus:ring-1 focus:ring-dark outline-none shadow-sm transition-all"
                                  />
                                  <span className="text-xs text-gray-400 font-bold">KM</span>
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="flex items-baseline gap-1 bg-gray-50 px-3 py-1.5 rounded-lg w-fit border border-gray-100">
                              <span className="text-sm font-bold text-gray-900 tabular-nums">
                                {isBase ? '0' : distance}
                              </span>
                              <span className="text-xs font-semibold text-gray-500 ml-1">km</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                                <input type="checkbox" checked={editingDistrict.chargeFuel} onChange={(e) => setEditingDistrict({...editingDistrict, chargeFuel: e.target.checked})} className="accent-dark w-4 h-4" /> Charge Fuel
                              </label>
                              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                                <input type="checkbox" checked={editingDistrict.chargeDriverAllowance} onChange={(e) => setEditingDistrict({...editingDistrict, chargeDriverAllowance: e.target.checked})} className="accent-dark w-4 h-4" /> Driver Allowance
                              </label>
                              <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
                                <input type="checkbox" checked={editingDistrict.chargeAccommodation} onChange={(e) => setEditingDistrict({...editingDistrict, chargeAccommodation: e.target.checked})} className="accent-dark w-4 h-4" /> Accommodation
                              </label>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className={`text-xs font-medium ${district.chargeFuel ? 'text-success' : 'text-gray-400 line-through'}`}>Fuel</span>
                              <span className={`text-xs font-medium ${district.chargeDriverAllowance ? 'text-success' : 'text-gray-400 line-through'}`}>Allowance</span>
                              <span className={`text-xs font-medium ${district.chargeAccommodation ? 'text-success' : 'text-gray-400 line-through'}`}>Accommodation</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button 
                                  onClick={handleUpdateDistrict}
                                  className="p-2 rounded-lg bg-pharmacore-gray text-dark hover:bg-pharmacore-gray border border-gray-200 transition-all shadow-sm"
                                  title="Save All Changes"
                                >
                                  <Save size={16} />
                                </button>
                                <button 
                                  onClick={() => setEditingDistrict(null)}
                                  className="p-2 rounded-lg bg-white text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all border border-gray-100"
                                  title="Cancel"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  onClick={() => setEditingDistrict({
                                    id: district.id,
                                    name: district.name,
                                    sortOrder: district.sortOrder,
                                    distanceKm: distance,
                                    chargeDriverAllowance: district.chargeDriverAllowance ?? true,
                                    chargeAccommodation: district.chargeAccommodation ?? true,
                                    chargeFuel: district.chargeFuel ?? true
                                  })}
                                  className="p-2 rounded-lg text-gray-400 hover:text-dark hover:bg-pharmacore-gray transition-all"
                                  title="Edit Everything"
                                >
                                  <Edit size={16} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteDistrict(district.id)}
                                  className="p-2 rounded-lg text-gray-400 hover:text-coral hover:bg-coral/10 transition-all"
                                  title="Delete District"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {districts.length === 0 && (
                <div className="p-16 text-center text-sm font-medium text-gray-400 italic">No districts registered yet. Click "Add District" to begin.</div>
              )}
            </div>
          </div>

          <div className="card-widget bg-gray-900 text-white border-none space-y-4 rounded-xl relative overflow-hidden shadow-md">
            <div className="absolute -right-4 -top-4 text-white/5 pointer-events-none">
                <Map size={120} />
            </div>
            <div className="flex gap-4 items-start relative z-10">
                <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <Info size={24} className="text-white" />
                </div>
                <div className="flex flex-col gap-1">
                  <h4 className="text-base font-bold text-white uppercase tracking-wider">Viewing Fee Logistics</h4>
                  <p className="text-sm text-gray-300 leading-relaxed font-medium">
                      All viewings originate from the center of <strong className="text-white">Lilongwe</strong>. 
                      The viewing fee is dynamic, calculated using the travel distance provided here, fuel consumption rates, 
                      driver allowance, and accommodation (for routes exceeding 200km).
                  </p>
                </div>
            </div>
          </div>
        </div>

        {/* Right Column: Settings */}
        <div className="lg:col-span-4 space-y-6">
          <div className="card-widget overflow-hidden p-0 border border-gray-100 shadow-sm bg-white flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
               <Wallet size={16} className="text-gray-500" /> 
               <h3 className="text-sm font-bold text-gray-900">Travel Variables</h3>
            </div>
            
            <div className="p-6 space-y-6 bg-white border-b border-gray-50">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Driver Allowance (MK)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    value={settings.driverAllowance}
                    onChange={(e) => setSettings({...settings, driverAllowance: parseInt(e.target.value) || 0})}
                    className="flex-1 w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold shadow-sm focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all text-gray-900 tabular-nums"
                  />
                  <button 
                    onClick={() => handleUpdateSettings('driverAllowance', settings.driverAllowance)}
                    className="w-12 h-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 hover:text-dark hover:bg-pharmacore-gray hover:border-gray-200 flex items-center justify-center transition-all"
                    title="Save"
                  >
                    <Save size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-tighter">Accommodation Fee (MK)</label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    value={settings.accommodationFee}
                    onChange={(e) => setSettings({...settings, accommodationFee: parseInt(e.target.value) || 0})}
                    className="flex-1 w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-bold shadow-sm focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all text-gray-900 tabular-nums"
                  />
                  <button 
                    onClick={() => handleUpdateSettings('accommodationFee', settings.accommodationFee)}
                    className="w-12 h-12 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 hover:text-dark hover:bg-pharmacore-gray hover:border-gray-200 flex items-center justify-center transition-all"
                    title="Save"
                  >
                    <Save size={16} />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50/50">
               <div className="flex gap-3 items-start p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                  <div className="mt-0.5"><Info size={16} className="text-dark" /></div>
                  <p className="text-[11px] text-gray-600 leading-relaxed font-semibold">
                    Accommodation fees apply to routes greater than <strong>200KM</strong>.
                  </p>
               </div>
            </div>
          </div>

          <div className="card-widget overflow-hidden p-0 border border-gray-100 shadow-sm bg-white">
             <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                <Fuel size={16} className="text-gray-500" />
                <h3 className="text-sm font-bold text-gray-900">Current Fuel Rates</h3>
             </div>
             <div className="p-6 bg-white space-y-5">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Petrol Rate (MK/L)</label>
                   <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        value={fuelPrices.PETROL}
                        onChange={(e) => setFuelPrices({...fuelPrices, PETROL: parseInt(e.target.value) || 0})}
                        className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all tabular-nums"
                      />
                      <button 
                        onClick={() => handleUpdateFuelPrice('PETROL', fuelPrices.PETROL)}
                        className="w-10 h-10 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 hover:text-dark hover:bg-pharmacore-gray flex items-center justify-center transition-all"
                      >
                        <Save size={14} />
                      </button>
                   </div>
                </div>

                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Diesel Rate (MK/L)</label>
                   <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        value={fuelPrices.DIESEL}
                        onChange={(e) => setFuelPrices({...fuelPrices, DIESEL: parseInt(e.target.value) || 0})}
                        className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all tabular-nums"
                      />
                      <button 
                        onClick={() => handleUpdateFuelPrice('DIESEL', fuelPrices.DIESEL)}
                        className="w-10 h-10 bg-gray-50 border border-gray-200 rounded-xl text-gray-600 hover:text-dark hover:bg-pharmacore-gray flex items-center justify-center transition-all"
                      >
                        <Save size={14} />
                      </button>
                   </div>
                </div>

                <div className="flex items-center gap-2 bg-pharmacore-gray/50 px-3 py-2 rounded-lg w-full mt-2 border border-gray-100">
                   <div className="w-2 h-2 bg-dark rounded-full animate-pulse shadow-sm" />
                   <span className="text-[10px] text-dark font-black uppercase tracking-tighter">Live System Rates Connected</span>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Add District Modal */}
      {showAddDistrict && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl relative overflow-hidden">
            <div className="bg-dark p-6 text-white flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold">Add New District</h2>
                <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-0.5">Location Registry</p>
              </div>
              <button 
                onClick={() => setShowAddDistrict(false)} 
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddDistrict} className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-600">District Name *</label>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. Blantyre, Mzuzu"
                  value={newDistrictName}
                  onChange={(e) => setNewDistrictName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-dark focus:ring-1 focus:ring-dark transition-all font-medium text-sm text-gray-900 placeholder:text-gray-400"
                  required
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddDistrict(false)}
                  className="btn-outline flex-1 py-3 text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary flex-1 py-3 text-xs"
                >
                  Create District
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationManager;
