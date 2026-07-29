import React, { useState, useEffect, useMemo } from 'react';
import {
  Megaphone, Copy, Check, ExternalLink, Trash2, RotateCcw, Share2,
  MessageCircle, Link2, BarChart3, Rss, KeyRound, Car as CarIcon
} from 'lucide-react';
import { api } from '../lib/api';
import { useModal } from '../components/ui/ModalContext';
import { useAuth } from '../lib/AuthContext';
import CustomSelect from '../components/ui/CustomSelect';

/**
 * Marketing — compose an ad, see the exact preview WhatsApp/Facebook will
 * show (the server injects these tags for shared car links), send it, and
 * manage the Facebook plumbing (Pixel, page, catalog feed) in one place.
 *
 * Honest boundary: paid campaign placement is confirmed inside Meta Ads
 * Manager — the Boost button lands you there with the creative ready.
 */

interface AdCar {
  id: string;
  title: string;
  basePrice: number;
  year?: number;
  district?: string;
  mileage?: number;
  fuelType?: string;
  transmission?: string;
  status: string;
  maker?: { name: string };
  model?: { name: string };
  images?: { url: string; isPrimary: boolean }[];
}

interface AdPost {
  id: string;
  caption: string;
  carId?: string | null;
  channel: string;
  createdByName?: string | null;
  createdAt: string;
}

const SITE = 'https://galimotors.vercel.app';

const slug = (s?: string) => (s || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-');
const carUrl = (car: AdCar) => `${SITE}/cars/${slug(car.maker?.name)}/${slug(car.model?.name)}/${car.id.split('-')[0]}`;
const ogImage = (url?: string) => {
  if (!url) return `${SITE}/og-image.png`;
  return url.includes('/upload/') && !url.includes('/upload/w_')
    ? url.replace('/upload/', '/upload/w_1200,h_630,c_fill,q_auto/')
    : url;
};

const buildCaption = (car: AdCar): string => {
  const price = `MK ${Number(car.basePrice).toLocaleString('en-US')}`;
  const specs = [car.year, car.transmission, car.fuelType, car.mileage ? `${car.mileage.toLocaleString()} km` : null]
    .filter(Boolean).join(' · ');
  return [
    `🚗 ${car.title}`,
    ``,
    `💰 ${price}`,
    specs ? `✅ ${specs}` : null,
    car.district ? `📍 ${car.district}` : null,
    ``,
    `View photos & book a viewing:`,
    carUrl(car),
  ].filter(line => line !== null).join('\n');
};

const Marketing: React.FC = () => {
  const { showAlert, showConfirm } = useModal();
  const { user } = useAuth();
  const isSuper = user?.role === 'SUPER_ADMIN';

  const [cars, setCars] = useState<AdCar[]>([]);
  const [ads, setAds] = useState<AdPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCarId, setSelectedCarId] = useState('');
  const [caption, setCaption] = useState('');
  const [copied, setCopied] = useState(false);

  const [pixelId, setPixelId] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [feedCopied, setFeedCopied] = useState(false);

  const feedUrl = `${SITE}/api/feeds/meta-catalog.csv`;

  const fetchAll = async () => {
    try {
      const [carsRes, adsRes, settingsRes] = await Promise.allSettled([
        api.get('/cars?status=AVAILABLE&limit=500'),
        api.get('/marketing/ads'),
        api.get('/settings/global'),
      ]);
      if (carsRes.status === 'fulfilled') setCars(carsRes.value.data.cars || []);
      if (adsRes.status === 'fulfilled') setAds(adsRes.value.data || []);
      if (settingsRes.status === 'fulfilled') {
        setPixelId(settingsRes.value.data?.metaPixelId || '');
        setFacebookUrl(settingsRes.value.data?.facebookUrl || '');
      }
    } catch (error) {
      console.error('Failed to load marketing data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const selectedCar = useMemo(() => cars.find(c => c.id === selectedCarId) || null, [cars, selectedCarId]);

  const handlePickCar = (id: string) => {
    setSelectedCarId(id);
    const car = cars.find(c => c.id === id);
    if (car) setCaption(buildCaption(car));
  };

  const recordAd = async (channel: string) => {
    if (!caption.trim()) return;
    try {
      const res = await api.post('/marketing/ads', { caption, carId: selectedCarId || null, channel });
      setAds(prev => [res.data, ...prev].slice(0, 30));
    } catch { /* history is best-effort */ }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      recordAd('BOTH');
    } catch {
      await showAlert({ title: 'Copy Failed', message: 'Select the text and copy it manually.', variant: 'warning' });
    }
  };

  const handleWhatsApp = () => {
    recordAd('WHATSAPP');
    window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, '_blank');
  };

  const handleFacebook = () => {
    recordAd('FACEBOOK');
    const url = selectedCar ? carUrl(selectedCar) : SITE;
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(caption)}`,
      '_blank', 'width=680,height=560',
    );
  };

  const handleDeleteAd = async (ad: AdPost) => {
    const confirmed = await showConfirm({
      title: 'Remove Ad', message: 'Remove this ad from the history?', variant: 'danger', confirmLabel: 'Remove',
    });
    if (!confirmed) return;
    try {
      await api.delete(`/marketing/ads/${ad.id}`);
      setAds(prev => prev.filter(a => a.id !== ad.id));
    } catch { /* non-fatal */ }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.put('/marketing/settings', { metaPixelId: pixelId, facebookUrl });
      await showAlert({ title: 'Saved', message: 'Facebook settings updated. The site picks them up automatically.', variant: 'success' });
    } catch (error: any) {
      await showAlert({ title: 'Could Not Save', message: error?.response?.data?.message || 'Please try again.', variant: 'error' });
    } finally {
      setSavingSettings(false);
    }
  };

  const previewImage = selectedCar
    ? ogImage(selectedCar.images?.find(i => i.isPrimary)?.url || selectedCar.images?.[0]?.url)
    : `${SITE}/og-image.png`;

  const inputCls = 'w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all placeholder:text-gray-400';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-6xl mx-auto animate-in fade-in duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
          <Megaphone size={22} className="text-gold-dark" /> Marketing
        </h1>
        <p className="text-sm text-gray-500 font-medium">Create ads, share them to WhatsApp and Facebook, and manage your Facebook setup</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
        {/* ── Ad Composer ── */}
        <div className="lg:col-span-3 card-widget p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-bold text-gray-900">Ad Composer</h2>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Car to promote</label>
              <CustomSelect
                value={selectedCarId}
                onChange={handlePickCar}
                options={cars.map(c => ({ id: c.id, name: `${c.title} — MK ${Number(c.basePrice).toLocaleString('en-US')}` }))}
                placeholder={cars.length ? 'Pick a car (or write a general promo below)…' : 'No available cars yet'}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600">Caption — edit freely before sharing</label>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder={'Write your ad…\n\nPick a car above to prefill the caption with its price, specs and link.'}
                className={`${inputCls} min-h-[190px] leading-relaxed`}
              />
            </div>

            {/* Preview — what WhatsApp/Facebook will show for the link */}
            {selectedCar && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Link preview (what the audience sees)</label>
                <div className="border border-gray-200 rounded-xl overflow-hidden max-w-md bg-gray-50">
                  <div className="aspect-[1200/630] bg-gray-100">
                    <img src={previewImage} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="px-3.5 py-2.5 bg-gray-100/80">
                    <p className="text-[13px] font-bold text-gray-900 truncate">{selectedCar.title} — GaliMotors</p>
                    <p className="text-[11px] text-gray-500 truncate">
                      {selectedCar.year} {selectedCar.maker?.name} {selectedCar.model?.name} for sale in {selectedCar.district || 'Malawi'}. Price: MK {Number(selectedCar.basePrice).toLocaleString('en-US')}.
                    </p>
                    <p className="text-[10px] text-gray-400 uppercase mt-0.5">galimotors.vercel.app</p>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                onClick={handleCopy}
                disabled={!caption.trim()}
                className="btn-secondary flex items-center gap-1.5 text-sm font-bold disabled:opacity-50"
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy caption'}
              </button>
              <button
                onClick={handleWhatsApp}
                disabled={!caption.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-success text-white text-sm font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
              >
                <MessageCircle size={14} /> Share to WhatsApp
              </button>
              <button
                onClick={handleFacebook}
                disabled={!caption.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-info text-white text-sm font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
              >
                <Share2 size={14} /> Post to Facebook
              </button>
              <a
                href="https://www.facebook.com/adsmanager/creation/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-dark text-white text-sm font-bold rounded-lg hover:bg-dark-muted transition-colors no-underline"
              >
                <BarChart3 size={14} /> Boost as paid ad <ExternalLink size={11} className="opacity-60" />
              </a>
            </div>
            <p className="text-[11px] text-gray-400 leading-snug">
              Paid campaigns (budget, audience, duration) are confirmed inside Meta Ads Manager — copy the caption first, then paste it there with the car link.
            </p>
          </div>
        </div>

        {/* ── Right column: Facebook setup + feed ── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-widget p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><KeyRound size={14} className="text-gold-dark" /> Facebook Setup</h2>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wide ${pixelId ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                {pixelId ? 'Pixel active' : 'Pixel not set'}
              </span>
            </div>
            <form onSubmit={handleSaveSettings} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Meta Pixel ID</label>
                <input
                  className={inputCls}
                  value={pixelId}
                  onChange={e => setPixelId(e.target.value)}
                  placeholder="15–16 digits from Meta Events Manager"
                />
                <p className="text-[11px] text-gray-400">Once set, the site automatically reports visits, searches, car views and leads to Facebook — that data powers ad targeting.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Facebook Page URL</label>
                <input
                  className={inputCls}
                  value={facebookUrl}
                  onChange={e => setFacebookUrl(e.target.value)}
                  placeholder="https://facebook.com/galimotors"
                />
              </div>
              <button type="submit" disabled={savingSettings} className="btn-primary w-full text-sm font-bold disabled:opacity-60">
                {savingSettings ? 'Saving…' : 'Save Facebook Settings'}
              </button>
            </form>
          </div>

          <div className="card-widget p-5 space-y-3">
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Rss size={14} className="text-gold-dark" /> Catalog Feed</h2>
            <p className="text-[12px] text-gray-500 leading-snug">
              Give this link to Facebook once and it keeps your ads in sync with the inventory automatically:
              Meta Commerce Manager → Catalog → Data sources → <b>Scheduled feed</b>.
            </p>
            <div className="flex gap-2">
              <input readOnly value={feedUrl} className={`${inputCls} text-[11px] bg-gray-50`} onFocus={e => e.target.select()} />
              <button
                onClick={async () => { try { await navigator.clipboard.writeText(feedUrl); setFeedCopied(true); setTimeout(() => setFeedCopied(false), 2000); } catch { /* */ } }}
                className="shrink-0 btn-secondary flex items-center gap-1.5 text-xs font-bold"
              >
                {feedCopied ? <Check size={13} className="text-success" /> : <Link2 size={13} />} {feedCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-[11px] text-gray-400">{cars.length} available car{cars.length === 1 ? '' : 's'} currently in the feed.</p>
          </div>
        </div>
      </div>

      {/* ── Recent ads ── */}
      <div className="card-widget p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-sm font-bold text-gray-900">Recent Ads ({ads.length})</h2>
        </div>
        {ads.length === 0 ? (
          <p className="text-sm font-medium text-gray-400 text-center py-10">Ads you compose and share will appear here for reuse.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {ads.map(ad => (
              <div key={ad.id} className="flex items-start justify-between gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-gray-700 line-clamp-2 whitespace-pre-line">{ad.caption}</p>
                  <p className="text-[11px] font-semibold text-gray-400 mt-1 flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      ad.channel === 'WHATSAPP' ? 'bg-success/10 text-success' :
                      ad.channel === 'FACEBOOK' ? 'bg-info-light text-info' : 'bg-gray-100 text-gray-500'
                    }`}>{ad.channel}</span>
                    {ad.carId && <span className="flex items-center gap-1"><CarIcon size={10} /> car ad</span>}
                    {ad.createdByName && <span>by {ad.createdByName}</span>}
                    <span>{new Date(ad.createdAt).toLocaleDateString()} {new Date(ad.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setCaption(ad.caption); if (ad.carId) setSelectedCarId(ad.carId); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="p-2 rounded-lg text-gray-400 hover:text-dark hover:bg-gray-100 transition-colors"
                    title="Load into the composer"
                  >
                    <RotateCcw size={13} />
                  </button>
                  {isSuper && (
                    <button onClick={() => handleDeleteAd(ad)} className="p-2 rounded-lg text-gray-400 hover:text-danger hover:bg-danger-light transition-colors" title="Remove">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Marketing;
