import React, { useState, useEffect } from 'react';
import { DollarSign, Phone, Mail, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { toWhatsAppNumber } from '../lib/whatsapp';

interface GlobalSettings {
  id: string;
  driverAllowance: number;
  accommodationFee: number;
}

import { useModal } from '../components/ui/ModalContext';

const SettingsPage: React.FC = () => {
  const { showAlert } = useModal();
  const [, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userRole, setUserRole] = useState<string>('');

  const [form, setForm] = useState({
    driverAllowance: 0,
    accommodationFee: 0,
    minViewingFee: 5000,
    maxViewingFee: 200000,
    petrolPrice: 1200,
    adminWhatsApp: '265990000000',
    adminPhone: '265990000000',
    businessEmail: 'admin@galimotor.com',
    bankName: 'National Bank of Malawi',
    bankAccountName: 'GaliMotors Ltd',
    bankAccountNumber: '100 234 5678',
    airtelMoneyName: '',
    airtelMoneyNumber: '',
    tnmMpambaName: '',
    tnmMpambaNumber: '',
    facebookUrl: '',
    businessAddress: '',
    metaPixelId: ''
  });

  // Derived, so the message tracks what is currently typed. An empty field is
  // not flagged — that is handled as a required-field concern, not a format one.
  const NUMBER_HINT =
    'Enter a Malawian mobile number, e.g. 0885086757, 265885086757 or +265 885 086 757.';
  const whatsAppError =
    form.adminWhatsApp.trim() && !toWhatsAppNumber(form.adminWhatsApp)
      ? `That WhatsApp number is not usable. ${NUMBER_HINT}`
      : '';
  const phoneError =
    form.adminPhone.trim() && !toWhatsAppNumber(form.adminPhone)
      ? `That hotline number is not usable. ${NUMBER_HINT}`
      : '';

  // Check user role
  useEffect(() => {
    const userStr = localStorage.getItem('admin_user');
    if (userStr) {
      const user = JSON.parse(userStr);
      setUserRole(user.role || '');
    }
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings/global');
      
      if (response.data) {
        setSettings(response.data);
        setForm({
          driverAllowance: response.data.driverAllowance || 15000,
          accommodationFee: response.data.accommodationFee || 25000,
          minViewingFee: 5000,
          maxViewingFee: 200000,
          petrolPrice: 1200,
          adminWhatsApp: response.data.adminWhatsApp || '265990000000',
          adminPhone: response.data.adminPhone || '265990000000',
          businessEmail: response.data.businessEmail || 'info@galimotor.com',
          bankName: response.data.bankName || 'National Bank of Malawi',
          bankAccountName: response.data.bankAccountName || 'GaliMotors Ltd',
          bankAccountNumber: response.data.bankAccountNumber || '100 234 5678',
          airtelMoneyName: response.data.airtelMoneyName || '',
          airtelMoneyNumber: response.data.airtelMoneyNumber || '',
          tnmMpambaName: response.data.tnmMpambaName || '',
          tnmMpambaNumber: response.data.tnmMpambaNumber || '',
          facebookUrl: response.data.facebookUrl || '',
          businessAddress: response.data.businessAddress || '',
          metaPixelId: response.data.metaPixelId || ''
        });
      }
    } catch (error) {
      console.error('Failed to fetch settings', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    // Blocked here as well as server-side. Saving an unusable number would
    // silently break every wa.me link and every admin notification.
    if (whatsAppError || phoneError) {
      await showAlert({
        title: 'Check the contact numbers',
        message: whatsAppError || phoneError || '',
        variant: 'warning'
      });
      return;
    }

    setSaving(true);

    try {
      await api.put('/settings/global', {
        driverAllowance: form.driverAllowance,
        accommodationFee: form.accommodationFee,
        adminWhatsApp: form.adminWhatsApp,
        adminPhone: form.adminPhone,
        businessEmail: form.businessEmail,
        bankName: form.bankName,
        bankAccountName: form.bankAccountName,
        bankAccountNumber: form.bankAccountNumber,
        airtelMoneyName: form.airtelMoneyName,
        airtelMoneyNumber: form.airtelMoneyNumber,
        tnmMpambaName: form.tnmMpambaName,
        tnmMpambaNumber: form.tnmMpambaNumber,
        facebookUrl: form.facebookUrl,
        businessAddress: form.businessAddress,
        metaPixelId: form.metaPixelId
      });
      
      await showAlert({
        title: 'Settings Saved',
        message: 'Global system parameters have been updated successfully.',
        variant: 'success'
      });
      fetchSettings();
    } catch (error) {
      console.error('Failed to save settings', error);
      await showAlert({
        title: 'Save Failed',
        message: 'Could not update system settings. Please check your connection.',
        variant: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const isSuperAdmin = userRole === 'SUPER_ADMIN';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          <div className="text-sm font-semibold text-gray-500">Loading Configuration...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">System Settings</h1>
        <p className="text-sm text-gray-500 font-medium">Configure global application logic and administrative parameters</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Viewing Fee Configuration */}
        <div className="card-widget p-0 border border-gray-100 shadow-sm bg-white overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-pharmacore-gray text-dark flex items-center justify-center">
              <DollarSign size={16} />
            </div>
            <h2 className="text-sm font-bold text-gray-900">
              Viewing Fee Parameters
            </h2>
          </div>
          
          <form onSubmit={handleSave} className="p-6 md:p-8 space-y-6 flex-1 flex flex-col">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-gray-600">Driver Allowance (MK)</label>
                 <input className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-900 focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all tabular-nums shadow-sm" type="number" placeholder="15000" value={form.driverAllowance} onChange={(e) => setForm({ ...form, driverAllowance: parseInt(e.target.value) || 0 })} required />
              </div>
              
              <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-gray-600">Accommodation Unit (MK)</label>
                 <input className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-900 focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all tabular-nums shadow-sm" type="number" placeholder="25000" value={form.accommodationFee} onChange={(e) => setForm({ ...form, accommodationFee: parseInt(e.target.value) || 0 })} required />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-gray-600">Min Fee Floor (MK)</label>
                 <input className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-semibold text-gray-500 outline-none cursor-not-allowed tabular-nums" type="number" value={form.minViewingFee} disabled />
              </div>
              <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-gray-600">Max Fee Ceiling (MK)</label>
                 <input className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-semibold text-gray-500 outline-none cursor-not-allowed tabular-nums" type="number" value={form.maxViewingFee} disabled />
              </div>
            </div>
            
            <div className="space-y-1.5">
               <label className="text-xs font-semibold text-gray-600">Petrol Index Price (MK/L)</label>
               <input className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl font-semibold text-gray-500 outline-none cursor-not-allowed tabular-nums" type="number" value={form.petrolPrice} disabled />
            </div>
            
            <div className="bg-pharmacore-gray/50 p-5 rounded-xl border border-gray-100 mt-2 space-y-2">
              <h3 className="text-sm font-bold text-dark flex items-center gap-2">
                <FileText size={16} className="text-dark" /> Computation Logic
              </h3>
              <p className="text-xs font-medium text-dark leading-relaxed">
                Viewing Fee calculation is standardized as: <br/>
                <span className="font-mono bg-white px-2 py-1 rounded inline-block my-1 border border-gray-100">(Distance * 2 * Petrol Price) + Driver Allowance</span>
                <br />
                <span className="text-dark/80 mt-1 block">Note: If distance exceeds 200KM, an Accommodation fee is automatically added.</span>
              </p>
            </div>

            <div className="pt-4 mt-auto">
               <button 
                 type="submit" 
                 disabled={saving} 
                 className="btn-primary w-full py-3.5 shadow-md flex justify-center items-center"
               >
                 {saving ? 'Updating System...' : 'Save Configuration'}
               </button>
            </div>
          </form>
        </div>

        {/* Contact Information */}
        <div className="card-widget p-0 border border-gray-100 shadow-sm bg-white overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-coral/10 text-coral flex items-center justify-center">
                <Phone size={16} />
              </div>
              <h2 className="text-sm font-bold text-gray-900">
                Admin Contact Registry
              </h2>
            </div>
            {isSuperAdmin && (
              <div className="px-3 py-1 bg-dark text-white text-xs font-bold rounded-full">
                EDITABLE
              </div>
            )}
          </div>
          
          <div className="p-6 md:p-8 space-y-6">
            {/* These two numbers drive every wa.me link and every admin
                notification, so they are validated here as well as on the
                server before anything is saved. */}
            <div className="space-y-1.5">
               <label className="text-xs font-semibold text-gray-600">Admin WhatsApp Number</label>
               <input
                 type="tel"
                 inputMode="tel"
                 className={`w-full px-4 py-3 border rounded-xl font-medium text-sm outline-none tabular-nums transition-all ${
                   !isSuperAdmin
                     ? 'bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed'
                     : whatsAppError
                       ? 'bg-white border-danger text-gray-900 focus:border-danger focus:ring-1 focus:ring-danger'
                       : 'bg-white border-gray-200 text-gray-900 focus:border-dark focus:ring-1 focus:ring-dark'
                 }`}
                 placeholder="0885086757"
                 value={form.adminWhatsApp}
                 onChange={(e) => setForm({ ...form, adminWhatsApp: e.target.value })}
                 disabled={!isSuperAdmin}
               />
               {whatsAppError ? (
                 <p className="text-xs font-semibold text-danger">{whatsAppError}</p>
               ) : (
                 <p className="text-xs text-gray-500">
                   Customers reach you here. Accepts 0885086757, 265885086757 or
                   +265 885 086 757 — stored as{' '}
                   <span className="font-mono">{toWhatsAppNumber(form.adminWhatsApp) || '…'}</span>
                 </p>
               )}
            </div>

            <div className="space-y-1.5">
               <label className="text-xs font-semibold text-gray-600">Company Hotline</label>
               <input
                 type="tel"
                 inputMode="tel"
                 className={`w-full px-4 py-3 border rounded-xl font-medium text-sm outline-none tabular-nums transition-all ${
                   !isSuperAdmin
                     ? 'bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed'
                     : phoneError
                       ? 'bg-white border-danger text-gray-900 focus:border-danger focus:ring-1 focus:ring-danger'
                       : 'bg-white border-gray-200 text-gray-900 focus:border-dark focus:ring-1 focus:ring-dark'
                 }`}
                 placeholder="0885086757"
                 value={form.adminPhone}
                 onChange={(e) => setForm({ ...form, adminPhone: e.target.value })}
                 disabled={!isSuperAdmin}
               />
               {phoneError && (
                 <p className="text-xs font-semibold text-danger">{phoneError}</p>
               )}
            </div>
            
            <div className="space-y-1.5">
               <label className="text-xs font-semibold text-gray-600">Support Email Address</label>
               <input 
                 className={`w-full px-4 py-3 border rounded-xl font-medium text-sm outline-none transition-all ${
                   isSuperAdmin 
                     ? 'bg-white border-gray-200 text-gray-900 focus:border-dark focus:ring-1 focus:ring-dark' 
                     : 'bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed'
                 }`}
                 type="email"
                 placeholder="admin@galimotor.com"
                 value={form.businessEmail}
                 onChange={(e) => setForm({ ...form, businessEmail: e.target.value })}
                 disabled={!isSuperAdmin}
               />
            </div>

            <div className="space-y-1.5">
               <label className="text-xs font-semibold text-gray-600">Facebook Page Link</label>
               <input
                 className={`w-full px-4 py-3 border rounded-xl font-medium text-sm outline-none transition-all ${
                   isSuperAdmin
                     ? 'bg-white border-gray-200 text-gray-900 focus:border-dark focus:ring-1 focus:ring-dark'
                     : 'bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed'
                 }`}
                 type="url"
                 placeholder="https://facebook.com/yourpage"
                 value={form.facebookUrl}
                 onChange={(e) => setForm({ ...form, facebookUrl: e.target.value })}
                 disabled={!isSuperAdmin}
               />
               <p className="text-xs text-gray-500">
                 Shown as the Facebook icon in the website footer. Leave empty to hide the icon.
               </p>
            </div>

            <div className="space-y-1.5">
               <label className="text-xs font-semibold text-gray-600">Business Address</label>
               <input
                 className={`w-full px-4 py-3 border rounded-xl font-medium text-sm outline-none transition-all ${
                   isSuperAdmin
                     ? 'bg-white border-gray-200 text-gray-900 focus:border-dark focus:ring-1 focus:ring-dark'
                     : 'bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed'
                 }`}
                 type="text"
                 placeholder="e.g. Area 47, Lilongwe"
                 value={form.businessAddress}
                 onChange={(e) => setForm({ ...form, businessAddress: e.target.value })}
                 disabled={!isSuperAdmin}
               />
               <p className="text-xs text-gray-500">Shown in the website footer contact section.</p>
            </div>

            <div className="space-y-1.5">
               <label className="text-xs font-semibold text-gray-600">Meta Pixel ID</label>
               <input
                 className={`w-full px-4 py-3 border rounded-xl font-medium text-sm outline-none tabular-nums transition-all ${
                   isSuperAdmin
                     ? 'bg-white border-gray-200 text-gray-900 focus:border-dark focus:ring-1 focus:ring-dark'
                     : 'bg-gray-50 border-gray-100 text-gray-500 cursor-not-allowed'
                 }`}
                 type="text"
                 inputMode="numeric"
                 placeholder="e.g. 123456789012345"
                 value={form.metaPixelId}
                 onChange={(e) => setForm({ ...form, metaPixelId: e.target.value })}
                 disabled={!isSuperAdmin}
               />
               <p className="text-xs text-gray-500">
                 The 15–16 digit Pixel ID from Meta Events Manager. Powers Facebook
                 ad tracking on the website. Leave empty to disable tracking.
               </p>
            </div>
            
            {!isSuperAdmin && (
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 mt-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Mail size={16} className="text-gray-500" />
                  Access Restricted
                </h3>
                <p className="text-xs font-medium text-gray-600 leading-relaxed">
                  Only <span className="font-bold text-dark">SUPER_ADMIN</span> users can modify platform contact information. These settings control how customers reach your support team across the platform.
                </p>
              </div>
            )}

            {isSuperAdmin && (
              <div className="pt-4">
                <button 
                  type="button"
                  onClick={handleSave}
                  disabled={saving} 
                  className="btn-primary w-full py-3.5 shadow-md flex justify-center items-center"
                >
                  {saving ? 'Updating Contacts...' : 'Save Contact Information'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Methods Configuration */}
      <div className="card-widget p-0 border border-gray-100 shadow-sm bg-white overflow-hidden mt-2">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
           <div className="w-8 h-8 rounded-lg bg-pharmacore-gray text-dark flex items-center justify-center">
              <DollarSign size={16} />
           </div>
          <h2 className="text-sm font-bold text-gray-900">
            Payment Methods
          </h2>
        </div>
        
        <div className="p-6 md:p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Bank Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800 border-b pb-2">Bank Transfer</h3>
              <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-gray-600">Bank Name</label>
                 <input className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-medium text-sm focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all" type="text" placeholder="National Bank of Malawi" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-gray-600">Account Name</label>
                 <input className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-medium text-sm focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all" type="text" placeholder="GaliMotors Ltd" value={form.bankAccountName} onChange={(e) => setForm({ ...form, bankAccountName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-gray-600">Account Number</label>
                 <input className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold font-mono text-sm focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all tabular-nums" type="text" placeholder="100 234 5678" value={form.bankAccountNumber} onChange={(e) => setForm({ ...form, bankAccountNumber: e.target.value })} />
              </div>
            </div>

            {/* Airtel Money */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800 border-b pb-2">Airtel Money</h3>
              <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-gray-600">Registered Name</label>
                 <input className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-medium text-sm focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all" type="text" placeholder="GaliMotors" value={form.airtelMoneyName} onChange={(e) => setForm({ ...form, airtelMoneyName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-gray-600">Phone Number</label>
                 <input className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold font-mono text-sm focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all tabular-nums" type="text" placeholder="099..." value={form.airtelMoneyNumber} onChange={(e) => setForm({ ...form, airtelMoneyNumber: e.target.value })} />
              </div>
            </div>

            {/* TNM Mpamba */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-800 border-b pb-2">TNM Mpamba</h3>
              <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-gray-600">Registered Name</label>
                 <input className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-medium text-sm focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all" type="text" placeholder="GaliMotors" value={form.tnmMpambaName} onChange={(e) => setForm({ ...form, tnmMpambaName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                 <label className="text-xs font-semibold text-gray-600">Phone Number</label>
                 <input className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl font-bold font-mono text-sm focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all tabular-nums" type="text" placeholder="088..." value={form.tnmMpambaNumber} onChange={(e) => setForm({ ...form, tnmMpambaNumber: e.target.value })} />
              </div>
            </div>
            
          </div>
          
          <div className="pt-8 flex justify-end">
             <button type="button" onClick={handleSave} disabled={saving} className="btn-primary py-3.5 px-8 shadow-md flex justify-center items-center">
                {saving ? 'Saving...' : 'Save Payment Methods'}
             </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SettingsPage;

