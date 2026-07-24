import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  ChevronLeft, ChevronRight, X, MessageSquare, Phone, Check
} from 'lucide-react';
import { api } from '../lib/api';
import {
  generateCanonicalUrl, generateMetaDescription, generateOpenGraphData,
  generateCarJsonLD, generateBreadcrumbs,
} from '../lib/seoRoutes';
import contactService from '../lib/contactService';
import recentlyViewedService from '../lib/recentlyViewedService';
import customerAuthService from '../lib/customerAuthService';
import { useCustomerAuth } from '../lib/CustomerAuthContext';
import { useSettings } from '../hooks/useSettings';
import { getCloudinaryFull, getCloudinaryThumbnail, handleImageError } from '../lib/imageHelper';
import { trackPixel } from '../lib/metaPixel';
import { FavoriteButton } from '../components/FavoriteButton';
import { Calculator } from 'lucide-react';
import CategoryBadges from '../components/CategoryBadges';
import CarGridSection from '../components/CarGridSection';

interface Car {
  id: string; title: string; basePrice: number; year: number;
  mileage: number; fuelType: string; transmission: string; district: string;
  status: string; negotiable?: boolean;
  logbookAvailable: boolean; dutyPaid: boolean; registered: boolean;
  platformInspectedBadge: boolean; urgentSaleBadge: boolean; isFeatured: boolean;
  viewsCount: number; inquiriesCount: number;
  fuelConsumptionKmPL?: number; engineSize?: string; driveTrain?: string;
  steering?: string; exteriorColor?: string; interiorColor?: string;
  seatingCapacity?: number; doors?: number; chassisNumber?: string;
  registrationNumber?: string; registrationYear?: number; condition?: string;
  makerId?: string; bodyTypeId?: string; createdAt: string;
  maker?: { name: string }; model?: { name: string }; bodyType?: { name: string };
  images: Array<{ url: string; isPrimary: boolean }>;
  features?: Array<{ feature: { name: string } }>;
  categories?: Array<{ category: { name: string; emoji: string; color: string; bgColor: string } }>;
  seller: { name: string; location?: string; district?: string; verifiedByPlatform: boolean };
}

// Mirrors the narrower `select` the /similar endpoint returns — it does not
// send the full Car shape, so this must not extend Car.
interface SimilarCar {
  id: string; title: string; basePrice: number; year?: number;
  mileage?: number; negotiable?: boolean; district?: string;
  condition?: string; urgentSaleBadge?: boolean;
  fuelType?: string; transmission?: string;
  maker?: { name: string }; model?: { name: string };
  images: Array<{ url: string; isPrimary: boolean }>;
  categories?: Array<{ category: { name: string; emoji: string; color: string; bgColor: string } }>;
  similarityScore: number;
}
interface SimilarCarsResponse {
  similarCars: SimilarCar[];
  basedOn: { maker: string; model: string; bodyType: string; priceRange: { min: number; max: number }; yearRange: { min: number; max: number } };
  totalFound: number;
}

const fmt = (n: number) => `MK ${n.toLocaleString()}`;
const transLabel = (t: string) => t === 'AUTOMATIC' ? 'Automatic' : t === 'MANUAL' ? 'Manual' : t;

const CarDetailSEO: React.FC = () => {
  const { makerSlug, modelSlug, uuidShort } = useParams<{ makerSlug: string; modelSlug: string; uuidShort: string }>();
  const navigate = useNavigate();
  const { phoneLink } = useSettings();
  const { isAuthenticated } = useCustomerAuth();

  const [car, setCar]       = useState<Car | null>(null);
  const [similar, setSimilar] = useState<SimilarCarsResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [simLoading, setSimLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [imgIndex, setImgIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', message: '', negotiationPrice: '' });
  const [wantsToNegotiate, setWantsToNegotiate] = useState(false);
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [showForm, setShowForm] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  // Prefill from the account. Re-runs on auth change so a visitor who signs
  // in via the Get a Quote gate lands in a form already filled in.
  useEffect(() => {
    const user = customerAuthService.getCustomer();
    if (user) {
      setForm(prev => ({ ...prev, name: user.name || '', phone: user.phone || '' }));
    }
  }, [isAuthenticated]);

  useEffect(() => { if (uuidShort) fetchCar(uuidShort); }, [uuidShort]);
  useEffect(() => { if (car) fetchSimilar(car.id); }, [car]);

  const fetchCar = async (uuid: string) => {
    try {
      setLoading(true);
      const s = await api.get(`/cars?reference=${uuid}&limit=1`);
      if (s.data.cars?.length) {
        const full = await api.get(`/cars/${s.data.cars[0].id}`);
        setCar(full.data);
        try { await recentlyViewedService.trackView(full.data.id); } catch { /* silent */ }
        // Meta ads: the retargeting signal — "this person looked at this car".
        trackPixel('ViewContent', {
          content_ids: [full.data.id],
          content_type: 'product',
          content_name: full.data.title,
          value: full.data.basePrice,
          currency: 'MWK',
        });
        const ems = full.data.maker?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown';
        const emd = full.data.model?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown';
        if (makerSlug !== ems || modelSlug !== emd)
          navigate(`/cars/${ems}/${emd}/${uuid}`, { replace: true });
      } else { setError('Car not found'); }
    } catch { setError('Failed to load car details'); }
    finally { setLoading(false); }
  };

  const fetchSimilar = async (id: string) => {
    try { setSimLoading(true); setSimilar((await api.get(`/cars/${id}/similar?limit=8`)).data); }
    catch { /* silent */ } finally { setSimLoading(false); }
  };

  const submitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!car) return;
    setFormStatus('sending');
    try {
      await api.post('/leads/inquire', { 
        carId: car.id, 
        buyerName: form.name, 
        buyerPhone: form.phone, 
        message: form.message || `I'm interested in the ${car.title}`, 
        leadSource: 'car_detail_page',
        negotiationPrice: wantsToNegotiate ? form.negotiationPrice : undefined
      });
      setFormStatus('sent');
      trackPixel('Lead', {
        content_name: car.title,
        value: car.basePrice,
        currency: 'MWK',
      });
      setForm({ name: '', phone: '', message: '', negotiationPrice: '' });
      setWantsToNegotiate(false);
    } catch { setFormStatus('error'); }
  };

  const next = useCallback(() => { if (car) setImgIndex(i => (i + 1) % car.images.length); }, [car]);
  const prev = useCallback(() => { if (car) setImgIndex(i => (i - 1 + car.images.length) % car.images.length); }, [car]);

  useEffect(() => {
    if (!lightbox) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'ArrowRight') next(); else if (e.key === 'ArrowLeft') prev(); else if (e.key === 'Escape') setLightbox(false); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [lightbox, next, prev]);

  /* ── Loading ── */
  if (loading) return (
    <div className="min-h-screen bg-white page-container py-10">
      <div className="flex flex-col lg:flex-row gap-8 animate-pulse">
        <div className="flex-1 space-y-3">
          <div className="aspect-[16/10]  bg-muted skeleton" />
          <div className="grid grid-cols-6 gap-2">
            {[...Array(6)].map((_, i) => <div key={i} className="aspect-[4/3] bg-muted  skeleton" />)}
          </div>
        </div>
        <div className="w-full lg:w-80 space-y-4">
          <div className="h-3 bg-muted  skeleton w-1/3" />
          <div className="h-7 bg-muted  skeleton w-3/4" />
          <div className="h-8 bg-muted  skeleton w-1/2" />
          <div className="h-12 bg-muted  skeleton" />
        </div>
      </div>
    </div>
  );

  /* ── Error ── */
  if (error || !car) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <p className="text-[16px] font-semibold text-dark mb-3">{error || 'Car not found'}</p>
        <button onClick={() => navigate('/cars')} className="btn-primary">Browse Cars</button>
      </div>
    </div>
  );

  const imgs   = car.images || [];
  const loc    = car.district || 'Malawi';
  const specRows = [
    ['Year',          car.year],
    ['Make / Model',  `${car.maker?.name || ''} ${car.model?.name || ''}`.trim() || '—'],
    ['Body Type',     car.bodyType?.name || '—'],
    ['Mileage',       car.mileage ? `${car.mileage.toLocaleString()} km` : '—'],
    ['Fuel',          car.fuelType || '—'],
    ['Transmission',  car.transmission ? transLabel(car.transmission) : '—'],
    ['Engine',        car.engineSize || '—'],
    ['Drive',         car.driveTrain || '—'],
    ['Steering',      car.steering || '—'],
    ['Seats',         car.seatingCapacity || '—'],
    ['Doors',         car.doors || '—'],
    ['Ext. Colour',   car.exteriorColor || '—'],
    ['Int. Colour',   car.interiorColor || '—'],
    // Chassis number is deliberately NOT listed publicly: it identifies the
    // exact vehicle and would let a buyer trace the seller around GaliMotors.
    ['Condition',     car.condition || '—'],
    // "Blue Book" is the Malawian term for the vehicle registration book.
    ['Blue Book',     car.logbookAvailable ? 'Available' : 'Not available'],
    ['Duty',          car.dutyPaid ? 'Paid' : 'Pending'],
    ['Registered',    car.registered ? (car.registrationNumber || 'Yes') : 'No'],
    ['Location',      loc],
  ];

  return (
    <>
      <Helmet>
        <title>{car.title} — GaliMotors</title>
        <meta name="description" content={generateMetaDescription(car)} />
        <link rel="canonical" href={generateCanonicalUrl(car)} />
        <meta property="og:title" content={generateOpenGraphData(car).title} />
        <meta property="og:description" content={generateOpenGraphData(car).description} />
        <meta property="og:image" content={generateOpenGraphData(car).image} />
        <meta property="og:type" content="product" />
        <script type="application/ld+json">{JSON.stringify(generateCarJsonLD(car))}</script>
      </Helmet>

      {/* ── Lightbox ──────────────────────────────────── */}
      {lightbox && imgs.length > 0 && (
        <div className="fixed inset-0 z-[9999] bg-dark/95 flex items-center justify-center" onClick={() => setLightbox(false)}>
          <button onClick={e => { e.stopPropagation(); setLightbox(false); }} className="absolute top-5 right-5 w-10 h-10  bg-white/10 hover:bg-white/20 text-white flex items-center justify-center">
            <X size={20} />
          </button>
          <button onClick={e => { e.stopPropagation(); prev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center  transition-colors">
            <ChevronLeft size={24} />
          </button>
          <img
            src={getCloudinaryFull(imgs[imgIndex]?.url)}
            alt={car.title}
            className="max-h-[85vh] max-w-[90vw] object-contain"
            onError={handleImageError}
            onClick={e => e.stopPropagation()}
          />
          <button onClick={e => { e.stopPropagation(); next(); }} className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center  transition-colors">
            <ChevronRight size={24} />
          </button>
          <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/50 text-[12px]">{imgIndex + 1} / {imgs.length}</p>
        </div>
      )}

      <div className="min-h-screen bg-white">
        {/* ── Breadcrumb ────────────────────────────── */}
        <div className="border-b border-border">
          <nav className="page-container flex items-center gap-2 text-[12px] font-medium text-text-tertiary py-3">
            {generateBreadcrumbs(car).map((b, i, arr) => (
              <React.Fragment key={i}>
                {i > 0 && <span>/</span>}
                {i === arr.length - 1
                  ? <span className="text-text-primary truncate max-w-[200px]">{b.name}</span>
                  : <a href={b.url} className="hover:text-gold-dark transition-colors">{b.name}</a>
                }
              </React.Fragment>
            ))}
          </nav>
        </div>

        {/* ── Title bar ─────────────────────────────── */}
        <div className="page-container pt-6 pb-4 border-b border-border">
          <p className="text-[12px] font-semibold text-gold-dark uppercase tracking-widest mb-1">{car.year} · {car.maker?.name}</p>
          <h1 className="text-[20px] lg:text-[24px] font-bold text-dark leading-tight">{car.title}</h1>
          {/* Dot separators so the facts read as a list, not one run-on line */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[12.5px] text-text-secondary [&>span+span]:before:content-['·'] [&>span+span]:before:mr-2 [&>span+span]:before:text-text-tertiary">
            {car.mileage > 0 && <span>{car.mileage.toLocaleString()} km</span>}
            {car.fuelType && <span>{car.fuelType.charAt(0)+car.fuelType.slice(1).toLowerCase()}</span>}
            <span>{loc}</span>
            {car.platformInspectedBadge && <span className="text-gold-dark font-semibold">✓ Verified</span>}
            {car.urgentSaleBadge && <span className="text-gold-dark font-semibold">Urgent Sale</span>}
          </div>
        </div>

        {/* ── Main content ──────────────────────────── */}
        <div className="page-container py-6 lg:py-8 max-w-6xl mx-auto">
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8 lg:gap-10">

            {/* ── Gallery ───────────────────── */}
            <div className="lg:col-span-8 order-1 w-full">
              {/* Main image */}
              <div
                className="relative aspect-[4/3] lg:aspect-[16/10] overflow-hidden  bg-muted cursor-pointer group"
                onClick={() => imgs.length > 0 && setLightbox(true)}
              >
                {imgs.length > 0 ? (
                  <img
                    src={getCloudinaryFull(imgs[imgIndex]?.url)}
                    alt={`${car.title} — ${imgIndex + 1}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    onError={handleImageError}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-text-tertiary text-sm">No image available</div>
                )}
                {imgs.length > 1 && (
                  <>
                    <button onClick={e => { e.stopPropagation(); prev(); }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10  bg-white/80 hover:bg-white backdrop-blur-sm text-dark flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronLeft size={20} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); next(); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10  bg-white/80 hover:bg-white backdrop-blur-sm text-dark flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight size={20} />
                    </button>
                  </>
                )}
                <div className="absolute bottom-4 right-4 bg-dark/70 backdrop-blur-md text-white text-[12px] font-medium px-3 py-1.5 ">
                  {imgIndex + 1} / {imgs.length}
                </div>
              </div>

              {/* Thumbnails. On phones this is a single horizontal strip —
                  the old 4-column grid stacked ~4 rows of thumbs and pushed
                  the price and CTAs two screens down. Grid from sm: up. */}
              {imgs.length > 1 && (
                <div className="flex overflow-x-auto scrollbar-hide sm:grid sm:grid-cols-6 lg:grid-cols-8 gap-2 mt-3 pb-1 sm:pb-0">
                  {imgs.slice(0, showAllPhotos ? imgs.length : 15).map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setImgIndex(i)}
                      className={`w-20 shrink-0 sm:w-auto sm:shrink aspect-[4/3] overflow-hidden border-2 transition-all ${i === imgIndex ? 'border-coral' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    >
                      <img src={getCloudinaryThumbnail(img.url, 200)} alt="" className="w-full h-full object-cover" loading="lazy" onError={handleImageError} />
                    </button>
                  ))}
                  {!showAllPhotos && imgs.length > 15 && (
                    <button onClick={() => setShowAllPhotos(true)} className="w-20 shrink-0 sm:w-auto sm:shrink aspect-[4/3] bg-muted flex items-center justify-center text-[12px] font-semibold text-text-secondary hover:text-gold-dark transition-colors border-2 border-transparent hover:border-coral">
                      +{imgs.length - 15} More
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ── RIGHT COLUMN (Pricing & Actions) ── */}
            {/* Sticky so the price and CTAs ride alongside the specs instead
                of leaving the right half of the viewport empty on desktop. */}
            <div className="lg:col-span-4 order-2 lg:row-span-2 w-full shrink-0 lg:sticky lg:top-24 lg:self-start">
              <div className="sticky top-6">
                <div className="bg-white border border-border p-5">
                  <div className="space-y-4 mb-5">
                    {/* flex-wrap lets "Negotiable" drop under the price when
                        the card is narrow, instead of escaping the box. */}
                    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1 pb-4 border-b border-border">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-widest mb-1.5">Price</p>
                        <p className="text-[22px] font-extrabold text-dark leading-none tracking-tight whitespace-nowrap">{fmt(car.basePrice)}</p>
                      </div>
                      {car.negotiable && <span className="text-[11px] font-semibold text-text-secondary shrink-0 pb-0.5">Negotiable</span>}
                    </div>

                    {(car.dutyPaid || car.logbookAvailable || car.platformInspectedBadge || car.categories?.length) && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {car.dutyPaid && <span className="bg-coral text-white text-[11px] font-semibold px-3 py-1">Duty Paid</span>}
                          {car.logbookAvailable && <span className="bg-muted text-dark text-[11px] font-semibold px-3 py-1 border border-border">Blue Book Available</span>}
                          {car.platformInspectedBadge && <span className="bg-gold text-dark text-[11px] font-semibold px-3 py-1">✓ GaliMotors Verified</span>}
                        </div>
                        {car.categories && car.categories.length > 0 && (
                          <CategoryBadges categories={car.categories} size="sm" />
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-3 border border-border divide-x divide-border">
                      <div className="px-2.5 py-2.5 min-w-0">
                        <p className="text-[9.5px] font-semibold text-text-tertiary uppercase tracking-wide mb-0.5">Year</p>
                        <p className="text-[13px] font-bold text-dark">{car.year}</p>
                      </div>
                      <div className="px-2.5 py-2.5 min-w-0">
                        <p className="text-[9.5px] font-semibold text-text-tertiary uppercase tracking-wide mb-0.5">Mileage</p>
                        <p className="text-[13px] font-bold text-dark leading-tight">{car.mileage ? `${car.mileage.toLocaleString()}` : '—'}<span className="text-[10px] font-semibold text-text-tertiary"> km</span></p>
                      </div>
                      <div className="px-2.5 py-2.5 min-w-0">
                        <p className="text-[9.5px] font-semibold text-text-tertiary uppercase tracking-wide mb-0.5">Trans.</p>
                        <p className="text-[13px] font-bold text-dark">{car.transmission === 'AUTOMATIC' ? 'Auto' : 'Manual'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="w-full">
                    {formStatus === 'sent' ? (
                      <div className="py-4 text-center bg-success-light/50  border border-success/20">
                        <div className="w-10 h-10 bg-success-light  flex items-center justify-center mx-auto mb-2">
                          <Check size={16} className="text-success" />
                        </div>
                        <p className="text-[14px] font-semibold text-dark">Inquiry Sent!</p>
                        <p className="text-[12px] text-text-secondary mt-1 mb-3">We'll contact you shortly.</p>
                        <button
                          onClick={async () => {
                            setWhatsappLoading(true);
                            try {
                              await contactService.contactAboutCar(car, 'inquiry');
                            } catch (err) {
                              console.error('Error opening WhatsApp:', err);
                            } finally {
                              setWhatsappLoading(false);
                            }
                          }}
                          disabled={whatsappLoading}
                          className="btn-primary w-full max-w-[220px] mx-auto text-[13px] py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <MessageSquare size={14} className="mr-2" />
                          {whatsappLoading ? 'Opening...' : 'Chat on WhatsApp'}
                        </button>
                      </div>
                    ) : showForm ? (
                      <form onSubmit={submitInquiry} className="space-y-3 bg-muted/30 p-4 border border-border">
                        {/* Light nudge, not a gate — signing in prefills and
                            keeps the quote conversation on their account. */}
                        {!isAuthenticated && formStatus !== 'sent' && (
                          <p className="text-[11.5px] text-text-secondary">
                            Have an account?{' '}
                            <button
                              type="button"
                              onClick={() => (window as any).openLoginModal?.()}
                              className="font-semibold text-coral hover:underline"
                            >
                              Sign in
                            </button>{' '}
                            to auto-fill and track this quote.
                          </p>
                        )}
                        {/* Note: the 'sent' state renders the success card
                            above this form entirely — no branch needed here. */}
                          <>
                            <input
                              required placeholder="Full Name"
                              value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                              className="filter-select text-[13px]"
                            />
                            <input
                              required type="tel" inputMode="tel" placeholder="Phone e.g. 0995 456 789"
                              value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                              className="filter-select text-[13px]"
                            />
                            
                            {/* Negotiation Toggle */}
                            <div className="flex items-center gap-2 mt-1">
                              <input 
                                type="checkbox" 
                                id="negotiate" 
                                checked={wantsToNegotiate} 
                                onChange={e => {
                                  setWantsToNegotiate(e.target.checked);
                                  if (e.target.checked && !form.negotiationPrice) {
                                    setForm(p => ({ ...p, negotiationPrice: car.basePrice.toString() }));
                                  }
                                }} 
                                className="accent-coral w-4 h-4 cursor-pointer"
                              />
                              <label htmlFor="negotiate" className="text-[12.5px] font-bold text-dark cursor-pointer">I want to negotiate the price</label>
                            </div>

                            {/* Negotiation Input */}
                            {wantsToNegotiate && (
                              <div className="animate-fade-in pl-6 border-l-2 border-coral/30 ml-2 py-1">
                                <label className="block text-[10px] font-bold text-gold-dark uppercase tracking-wider mb-1.5">Your Proposed Price (MK)</label>
                                <input
                                  type="number"
                                  required
                                  value={form.negotiationPrice} 
                                  onChange={e => setForm(p => ({ ...p, negotiationPrice: e.target.value }))}
                                  className="filter-select text-[13px] font-bold border-coral/40 focus:border-coral focus:ring-coral/20 bg-white"
                                />
                              </div>
                            )}

                            <textarea
                              placeholder="Your message (optional)"
                              rows={2}
                              value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                              className="filter-select resize-none text-[13px]"
                            />
                            {formStatus === 'error' && <p className="text-[11px] text-red-500">Failed to send. Please try again.</p>}
                            <div className="flex gap-2 pt-1">
                              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1 text-[13px] py-2">Cancel</button>
                              <button type="submit" disabled={formStatus === 'sending'} className="btn-primary flex-1 text-[13px] py-2">
                                {formStatus === 'sending' ? 'Sending…' : 'Send'}
                              </button>
                            </div>
                          </>
                      </form>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="flex gap-2">
                          {/* Guests may request a quote with name + phone;
                              registering later claims their leads by phone. */}
                          <button onClick={() => setShowForm(true)} className="btn-primary flex-1 py-2.5 text-[13px]">
                            Get a Quote
                          </button>
                          <FavoriteButton 
                            carId={car.id} 
                            className="px-4 border border-border bg-white shadow-sm hover:border-coral rounded-lg transition-colors flex items-center justify-center" 
                            size={18} 
                          />
                        </div>
                        {/* Navigates to a dedicated page rather than opening a
                            modal — see pages/BookViewing.tsx */}
                        <Link
                          to={`/book-viewing/${car.id.split('-')[0]}`}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-dark text-[14px] font-bold text-white hover:bg-black transition-all rounded-lg shadow-md hover:shadow-lg mt-3 no-underline"
                        >
                          <Calculator size={18} className="text-gold" /> Book Official Viewing
                        </Link>
                        <button
                          onClick={async () => {
                            setWhatsappLoading(true);
                            try {
                              await contactService.contactAboutCar(car, 'inquiry');
                            } catch (err) {
                              console.error('Error opening WhatsApp:', err);
                            } finally {
                              setWhatsappLoading(false);
                            }
                          }}
                          disabled={whatsappLoading}
                          className="w-full flex items-center justify-center gap-2 py-2.5 border border-border  text-[13px] font-semibold text-text-primary hover:border-coral hover:bg-coral-light transition-all shadow-sm bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <MessageSquare size={16} className="text-[#25D366]" />
                          {whatsappLoading ? 'Opening...' : 'Chat on WhatsApp'}
                        </button>
                        <a
                          href={phoneLink}
                          className="w-full flex items-center justify-center gap-2 py-2.5 bg-muted  text-[13px] font-medium text-text-secondary hover:bg-border transition-colors"
                        >
                          <Phone size={16} className="text-gold-dark" />
                          Call Agent
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Specs & Features ───────────────────── */}
            <div className="lg:col-span-8 order-3 grid grid-cols-1 gap-8 mt-2 lg:mt-0">
              {/* Specs table */}
              <div>
                <h2 className="text-[16px] font-bold text-dark mb-4">
                  Specifications
                </h2>
                {/* Two columns on desktop so the table uses the width instead
                    of running a long single column beside empty space. */}
                <div className="border border-border overflow-hidden">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-x-px lg:bg-border">
                    {specRows.map(([label, value]) => (
                      <div key={label} className="flex border-b border-border last:border-b-0 lg:[&:nth-last-child(2)]:border-b-0 bg-white">
                        <div className="w-2/5 bg-muted/40 px-4 py-2.5 text-[12.5px] font-semibold text-text-secondary flex items-center">{label}</div>
                        <div className="w-3/5 px-4 py-2.5 text-[13px] font-medium text-dark flex items-center">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Features — rendered only when there are features recorded.
                  The old placeholder box ("Standard equipment included…")
                  showed filler on every car without a feature list. */}
              {car.features && car.features.length > 0 && (
                <div>
                  <h2 className="text-[16px] font-bold text-dark mb-4">
                    Features & Equipment
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5 border border-border bg-white">
                    {car.features.map((f, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-[13px] text-dark">
                        <Check size={16} className="text-gold-dark shrink-0 mt-0.5" />
                        <span className="leading-snug">{f.feature.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ── Similar Cars ──────────────────────────── */}
        {/* Rendered only while loading or when there are results. An empty
            "No similar cars found" box was noise the customer never asked
            for — professional sites simply omit the section. */}
        {(simLoading || (similar?.similarCars && similar.similarCars.length > 0)) && (
        <section className="border-t border-border pt-10">
          <div className="page-container">
            {simLoading ? (
              <div className="pb-10">
                <div className="h-5 w-40 bg-muted rounded skeleton mb-5" />
                <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6">
                  {[...Array(5)].map((_, i) => (
                    <div key={i}>
                      <div className="aspect-[4/3] bg-muted skeleton mb-3" />
                      <div className="h-3 bg-muted skeleton mb-2 w-2/3" />
                      <div className="h-4 bg-muted skeleton w-full" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <CarGridSection
                title="Similar Cars"
                cars={similar!.similarCars}
                seeMoreLink="/cars"
              />
            )}
          </div>
        </section>
        )}
      </div>
    </>
  );
};

export default CarDetailSEO;


