import { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../lib/api';

interface GlobalSettings {
  adminWhatsApp: string;
  adminPhone: string;
  businessEmail: string;
  driverAllowance: number;
  accommodationFee: number;
  facebookUrl?: string;
  businessAddress?: string;
  metaPixelId?: string;
}

const defaultSettings: GlobalSettings = {
  adminWhatsApp: '265990000000',
  adminPhone: '265990000000',
  businessEmail: 'info@galimotors.com',
  driverAllowance: 15000,
  accommodationFee: 25000,
  facebookUrl: '',
  businessAddress: ''
};

export const useSettings = () => {
  const [settings, setSettings] = useState<GlobalSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/settings/global`);
        setSettings(response.data);
      } catch (error) {
        console.error('Failed to fetch settings, using defaults:', error);
        // Keep default settings if fetch fails
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  // Format phone for tel: links (remove spaces, ensure + and tel: protocol)
  const formatPhoneLink = (phone: string) => {
    const cleaned = phone.replace(/\s+/g, '');
    const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    return `tel:${withPlus}`;
  };

  // Format phone for WhatsApp (remove + and spaces)
  const formatWhatsAppNumber = (phone: string) => {
    return phone.replace(/[\s+]/g, '');
  };

  // Format for display: 265885086757 -> +265 885 086 757.
  // Malawi numbers are a 265 country code plus 9 digits. Also accepts a
  // leading 0 (local form) or an existing +. Anything unrecognised is
  // returned untouched rather than mangled.
  const formatPhoneDisplay = (phone: string) => {
    if (!phone) return phone;
    let digits = phone.replace(/[^\d]/g, '');
    if (digits.startsWith('0')) digits = `265${digits.slice(1)}`;
    if (!digits.startsWith('265') || digits.length !== 12) return phone;
    const local = digits.slice(3);
    return `+265 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  };

  return {
    settings,
    loading,
    phoneLink: formatPhoneLink(settings.adminPhone),
    whatsappLink: `https://wa.me/${formatWhatsAppNumber(settings.adminWhatsApp)}`,
    whatsappNumber: formatWhatsAppNumber(settings.adminWhatsApp),
    phoneDisplay: formatPhoneDisplay(settings.adminPhone),
    email: settings.businessEmail,
    // Both admin-managed in Settings; the footer hides the Facebook icon
    // when the URL is empty.
    facebookUrl: (settings.facebookUrl || '').trim(),
    businessAddress: (settings.businessAddress || '').trim(),
    metaPixelId: (settings.metaPixelId || '').trim()
  };
};
