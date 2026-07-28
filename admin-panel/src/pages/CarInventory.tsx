import React, { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import {
  Plus, Edit, Trash2, Car, X, Send, Users, Images, CheckCircle,
  ChevronLeft, SlidersHorizontal, ShieldCheck
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import imageCompression from 'browser-image-compression';
import { useModal } from '../components/ui/ModalContext';
import { useAuth } from '../lib/AuthContext';
import CustomSelect from '../components/ui/CustomSelect';

const MAX_IMAGES = 20;

// One shared input style: same face and coral focus as CustomSelect, so a
// form full of mixed selects and inputs reads as one component family.
const inputCls = 'w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl font-medium focus:border-coral focus:ring-1 focus:ring-coral/20 outline-none transition-all text-gray-900 placeholder:text-gray-400';

interface CarItem {
  id: string;
  title: string;
  basePrice: number;
  status: string;
  condition?: string;
  maker?: { name: string };
  model?: { name: string };
  year?: number;
  images?: { url: string; isPrimary: boolean }[];
  sellerAskingPrice?: number;
  makerId?: string;
  modelId?: string;
  bodyTypeId?: string;
  fuelType?: string;
  transmission?: string;
  mileage?: number;
  district?: string;
  negotiable?: boolean;
  sellerId?: string;
  marketId?: string;
  attendantId?: string;
  soldRequestedAt?: string | null;
  soldRequestedByName?: string | null;
  logbookAvailable?: boolean;
  dutyPaid?: boolean;
  registered?: boolean;
  registrationNumber?: string;
  registrationYear?: number;
  engineSize?: string;
  chassisNumber?: string;
  modelCode?: string;
  steering?: string;
  exteriorColor?: string;
  interiorColor?: string;
  seatingCapacity?: number;
  doors?: number;
  driveTrain?: string;
  platformInspectedBadge?: boolean;
  isFeatured?: boolean;
  urgentSaleBadge?: boolean;
  fuelConsumptionKmPL?: number;
  categories?: { category: Category }[];
}

interface Maker { id: string; name: string; models: { id: string; name: string }[] }
interface BodyType { id: string; name: string; }
interface Category { id: string; name: string; emoji: string; description?: string; color: string; bgColor: string; }

// ─── SVG Car Icons ────────────────────────────────────────────────────────────
const CarIcons = {
  Front: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a2 2 0 0 0-1.6-.8H8.3a2 2 0 0 0-1.6.8L4 11l-5.16.86a1 1 0 0 0-.84.99V16h3"/><circle cx="16.5" cy="16.5" r="2.5"/><circle cx="6.5" cy="16.5" r="2.5"/></svg>,
  Back: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a2 2 0 0 0-1.6-.8H8.3a2 2 0 0 0-1.6.8L4 11l-5.16.86a1 1 0 0 0-.84.99V16h3"/><circle cx="16.5" cy="16.5" r="2.5"/><circle cx="6.5" cy="16.5" r="2.5"/><path d="M9 16v-2h6v2"/></svg>,
  Side: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 11h14v3a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-3z"/><path d="M7 11l2-4h6l2 4"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2"/></svg>,
  Seat: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 13V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v7"/><path d="M4 14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2z"/><path d="M8 22v-6"/><path d="M16 22v-6"/></svg>,
  Dash: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v5"/><path d="M22 12h-5"/><path d="M2 12h5"/><path d="M12 22v-5"/><circle cx="12" cy="12" r="2"/></svg>,
  Engine: () => <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
};

const PHOTO_SLOTS = [
  { key: 'front',     label: 'Front Full',    hint: 'Show bumper & grille',   icon: <CarIcons.Front />,  required: true },
  { key: 'back',      label: 'Back Full',     hint: 'Show bumper & boot',     icon: <CarIcons.Back />,   required: true },
  { key: 'side',      label: 'Side Profile',  hint: 'Show doors & wheels',    icon: <CarIcons.Side />,   required: true },
  { key: 'interior',  label: 'Driver Seat',   hint: 'Show front seats',       icon: <CarIcons.Seat />,   required: true },
  { key: 'dashboard', label: 'Dashboard',     hint: 'Show steering & radio',  icon: <CarIcons.Dash />,   required: true },
  { key: 'bonnet',    label: 'Engine Bay',    hint: 'Open hood & engine',     icon: <CarIcons.Engine />, required: true },
];

// 0.8MB/1600px: matches the server's stored ceiling and roughly halves
// upload time on Malawian connections; the server transform is the backstop.
const COMPRESS_OPTIONS = { maxSizeMB: 0.8, maxWidthOrHeight: 1600, useWebWorker: true };

// Photos are uploaded in small batches so slow connections get steady
// progress instead of one huge request that gives no feedback until it
// finishes (or dies). Three per request, not four: Vercel rejects bodies
// over ~4.5MB, and 4 × 0.8MB compressed × 1.37 base64 overhead ≈ 4.4MB —
// close enough to fail intermittently. 3 keeps the worst case ~3.3MB.
const UPLOAD_CHUNK = 3;

// Content hash of the ORIGINAL file — duplicate photos are caught even if
// renamed, and regardless of what compression later does to the bytes.
const hashFile = async (file: File): Promise<string> => {
  if (!window.crypto?.subtle) return `${file.name}:${file.size}`; // non-secure-context fallback
  const buffer = await file.arrayBuffer();
  const digest = await window.crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
};

// ─── Section header (one style for all five steps) ───────────────────────────
const SectionHeader: React.FC<{ step: number; icon: React.ReactNode; title: string; sub: string }> = ({ step, icon, title, sub }) => (
  <div className="flex items-center gap-3 mb-5">
    <div className="w-10 h-10 rounded-xl bg-coral text-white flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div>
      <h3 className="text-base font-bold text-gray-900">
        <span className="text-gray-400 font-semibold mr-1.5">{step}.</span>{title}
      </h3>
      <p className="text-xs text-gray-500 font-medium">{sub}</p>
    </div>
  </div>
);

// ─── Image Viewer Modal ───────────────────────────────────────────────────────
const ImageViewerModal: React.FC<{ images: { url: string; isPrimary: boolean }[]; title: string; onClose: () => void }> = ({ images, title, onClose }) => {
  const [selected, setSelected] = useState(0);
  return (
    <div className="fixed inset-0 bg-black/90 z-[200] flex flex-col" onClick={onClose}>
      <div className="flex items-center justify-between px-6 py-4 bg-black/50" onClick={e => e.stopPropagation()}>
        <div>
          <p className="text-white font-bold text-lg">{title}</p>
          <p className="text-gray-400 text-xs">{images.length} photo{images.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20">
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
        <img src={images[selected]?.url} alt={`${title} ${selected + 1}`} className="max-h-full max-w-full object-contain rounded-lg" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto px-6 py-4 bg-black/50" onClick={e => e.stopPropagation()}>
          {images.map((img, i) => (
            <button key={i} onClick={() => setSelected(i)} className={`shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === selected ? 'border-coral' : 'border-transparent opacity-60 hover:opacity-100'}`}>
              <img src={img.url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const CarInventory: React.FC = () => {
  const { showAlert, showConfirm } = useModal();
  const [cars, setCars] = useState<CarItem[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCar, setEditingCar] = useState<CarItem | null>(null);
  const [sellers, setSellers] = useState<any[]>([]);
  const [markets, setMarkets] = useState<any[]>([]);
  const [attendants, setAttendants] = useState<any[]>([]);
  const [selectedCars, setSelectedCars] = useState<string[]>([]);
  // Inventory list controls — with every status in one list, a growing
  // inventory is unmanageable without a status split and a search box.
  const [invStatusFilter, setInvStatusFilter] = useState('ALL');
  const [searchParams] = useSearchParams();
  const [invSearch, setInvSearch] = useState(searchParams.get('search') || '');
  // ?viewMarket=<id> — arriving from a market's page to see ITS cars only.
  // (?marketId= is different: it opens the add-car form pre-filled.)
  const [viewMarketId, setViewMarketId] = useState(searchParams.get('viewMarket') || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [viewingCar, setViewingCar] = useState<CarItem | null>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const userRole = user?.role || '';
  // Field roles (seller / market attendant) get a narrowed inventory: the
  // server scopes /cars and /sellers to them, identity fields are assigned
  // server-side, and SOLD only happens via an admin-approved request.
  const isStaff = userRole === 'SUPER_ADMIN' || userRole === 'SUB_ADMIN';
  const isFieldRole = userRole === 'SELLER' || userRole === 'MARKET_ATTENDANT';

  // Seller modal
  const [showSellerModal, setShowSellerModal] = useState(false);
  const [savingSeller, setSavingSeller] = useState(false);
  const [sellerForm, setSellerForm] = useState({ name: '', phone: '', district: '', marketId: '', sellerType: 'INDIVIDUAL' });

  // Dropdown data
  const [makers, setMakers] = useState<Maker[]>([]);
  const [bodyTypes, setBodyTypes] = useState<BodyType[]>([]);
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const defaultForm = {
    title: '', basePrice: '', sellerAskingPrice: '', makerId: '', modelId: '', bodyTypeId: '',
    year: '', fuelType: 'PETROL', transmission: 'AUTOMATIC', mileage: '',
    district: 'Lilongwe', negotiable: true, status: 'AVAILABLE',
    condition: 'IT', // IT, Brand New, Used In Malawi
    marketId: '', sellerId: '', attendantId: '',
    logbookAvailable: false, dutyPaid: false, registered: false,
    registrationNumber: '', registrationYear: String(new Date().getFullYear()),
    engineSize: '', chassisNumber: '', modelCode: '',
    steering: 'RIGHT', exteriorColor: '', interiorColor: '',
    seatingCapacity: '5', doors: '4', driveTrain: '2WD',
    platformInspectedBadge: false, isFeatured: false, urgentSaleBadge: false,
    fuelConsumptionKmPL: '',
  };
  const [form, setForm] = useState(defaultForm);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // For SELLER the scoped /sellers response is exactly their own profile;
  // for MARKET_ATTENDANT the scoped /attendants response is their market's
  // team, so any row carries the market. The server enforces the same
  // assignment regardless of what the client sends — this is display + UX.
  const mySeller = userRole === 'SELLER' ? sellers[0] : undefined;
  const myMarket = userRole === 'MARKET_ATTENDANT' && attendants[0]
    ? { id: attendants[0].marketId, name: attendants[0].market?.name || 'Your market', district: attendants[0].market?.district || '' }
    : undefined;

  useEffect(() => {
    if (!showAddForm || editingCar) return;
    if (userRole === 'SELLER' && mySeller) {
      setForm(prev => ({
        ...prev,
        sellerId: mySeller.id,
        marketId: mySeller.marketId || '',
        district: prev.district || mySeller.district || '',
      }));
    } else if (userRole === 'MARKET_ATTENDANT' && myMarket) {
      setForm(prev => ({
        ...prev,
        marketId: myMarket.id,
        district: prev.district || myMarket.district || '',
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAddForm, editingCar, userRole, sellers, attendants]);

  // Photo state
  const [photoSlots, setPhotoSlots] = useState<Record<string, File | string | null>>({
    front: null, back: null, side: null, interior: null, dashboard: null, bonnet: null,
  });
  // Extra photos beyond the 6 slots (File for new, string URL for existing)
  const [extraPhotos, setExtraPhotos] = useState<(File | string)[]>([]);
  // Per-slot "compressing" flags + one for the extras batch — big phone
  // photos take seconds to optimise and a silent wait feels like a dead click.
  const [busySlots, setBusySlots] = useState<Record<string, boolean>>({});
  const [extrasBusy, setExtrasBusy] = useState(false);

  // File → original-content hash (for duplicate detection) and
  // File → object URL (previews created once, not on every render — the
  // old code leaked a new blob URL per photo per keystroke).
  const fileHashes = useRef(new Map<File, string>());
  const previewUrls = useRef(new Map<File, string>());

  const releaseAllPreviews = () => {
    previewUrls.current.forEach(url => URL.revokeObjectURL(url));
    previewUrls.current.clear();
    fileHashes.current.clear();
  };
  useEffect(() => releaseAllPreviews, []);

  const releaseFile = (file: File) => {
    const url = previewUrls.current.get(file);
    if (url) URL.revokeObjectURL(url);
    previewUrls.current.delete(file);
    fileHashes.current.delete(file);
  };

  // ── helpers ──────────────────────────────────────────────────────────────────
  const totalImageCount = () => {
    const slotCount = PHOTO_SLOTS.filter(s => photoSlots[s.key]).length;
    return slotCount + extraPhotos.length;
  };
  const requiredCount = () => PHOTO_SLOTS.filter(s => photoSlots[s.key]).length;

  const getAllImages = (): (File | string)[] => {
    const slotImages = PHOTO_SLOTS.map(s => photoSlots[s.key]).filter(Boolean) as (File | string)[];
    return [...slotImages, ...extraPhotos];
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  // browser-image-compression returns a File OR a Blob depending on the
  // browser. Everything downstream (the upload filter, the identity maps)
  // assumes File — on browsers that hand back a Blob, photos silently
  // skipped the upload and publishing died with "Argument url is missing".
  // Normalize once, here.
  const asFile = (out: File | Blob, original: File): File =>
    out instanceof File ? out : new File([out], original.name, { type: out.type || original.type });

  const getPreviewUrl = (img: File | string): string => {
    if (typeof img === 'string') return img;
    let url = previewUrls.current.get(img);
    if (!url) {
      url = URL.createObjectURL(img);
      previewUrls.current.set(img, url);
    }
    return url;
  };

  // Where is this photo already used? Checks every slot AND every extra, so
  // the same shot can't sneak in as both "Front Full" and an extra photo.
  const findDuplicateLocation = (hash: string, excludeSlotKey?: string): string | null => {
    for (const slot of PHOTO_SLOTS) {
      if (slot.key === excludeSlotKey) continue;
      const img = photoSlots[slot.key];
      if (img instanceof File && fileHashes.current.get(img) === hash) return slot.label;
    }
    const extraIdx = extraPhotos.findIndex(p => p instanceof File && fileHashes.current.get(p) === hash);
    if (extraIdx !== -1) return `Additional Photo ${extraIdx + 1}`;
    return null;
  };

  // Helper to convert simple arrays to CustomSelect format
  const toSelectOptions = (items: any[], valueKey = 'id', labelKey = 'name') =>
    items.map(item => ({ id: item[valueKey] || item, name: item[labelKey] || item }));

  // ── data fetching ─────────────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);
    try {
      const [makersRes, bodyTypesRes, districtsRes, categoriesRes] = await Promise.all([
        api.get('/makers'),
        api.get('/body-types'),
        api.get('/locations/districts'),
        api.get('/categories'),
      ]);
      setMakers(makersRes.data);
      setBodyTypes(bodyTypesRes.data);
      setDistricts(districtsRes.data);
      setCategories(categoriesRes.data);
    } catch (err) { console.error('Failed to fetch dropdowns', err); }

    try {
      const requests = [
        { name: 'cars', request: api.get('/cars?limit=500') },
        { name: 'sellers', request: api.get('/sellers') },
        { name: 'markets', request: api.get('/markets') },
        { name: 'attendants', request: api.get('/attendants') },
      ] as const;

      const results = await Promise.allSettled(requests.map(item => item.request));
      const failedIndex = results.findIndex(result => result.status === 'rejected');

      if (failedIndex !== -1) {
        const failedName = requests[failedIndex].name;
        const failedResult = results[failedIndex] as PromiseRejectedResult;
        const error = failedResult.reason as {
          response?: { status?: number; data?: { message?: string; error?: string } };
          message?: string;
        };
        const status = error.response?.status;
        const serverMessage = error.response?.data?.message || error.response?.data?.error || error.message;

        console.error(`Failed to fetch ${failedName}`, error);

        if (status === 401) {
          await showAlert({
            title: 'Session Expired',
            message: 'Please sign in again to continue.',
            variant: 'warning'
          });
          return;
        }

        await showAlert({
          title: 'Data Loading Error',
          message: `Failed to load ${failedName}${status ? ` (HTTP ${status})` : ''}.${serverMessage ? ` ${serverMessage}` : ''}`,
          variant: 'error'
        });
        return;
      }

      const [carsRes, sellersRes, marketsRes, attendantsRes] = results.map(
        result => (result as PromiseFulfilledResult<any>).value
      );

      setCars(carsRes.data.cars || carsRes.data);
      setSellers(sellersRes.data);
      setMarkets(marketsRes.data);
      setAttendants(attendantsRes.data);
    } catch (err) {
      console.error('Failed to fetch secured data', err);
      await showAlert({
        title: 'Data Loading Error',
        message: 'Unexpected error while loading inventory data. Please refresh the page.',
        variant: 'error'
      });
    }

    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Deep-link from Market Profiles
  useEffect(() => {
    const marketId = searchParams.get('marketId');
    if (marketId && markets.length > 0 && !showAddForm && !editingCar) {
      const m = markets.find(m => m.id === marketId);
      if (m) { setShowAddForm(true); setForm(prev => ({ ...prev, marketId, district: m.district })); }
    }
  }, [searchParams, markets]);

  // Deep-link from Global Search
  useEffect(() => {
    const s = searchParams.get('search');
    if (s) {
      setInvSearch(s);
      setInvStatusFilter('ALL');
    }
  }, [searchParams]);

  // ── image handlers ────────────────────────────────────────────────────────────
  const handleSlotImageChange = async (slotKey: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const original = e.target.files?.[0];
    // Always clear the input so picking the same file again still fires.
    e.target.value = '';
    if (!original) return;

    setBusySlots(prev => ({ ...prev, [slotKey]: true }));
    try {
      const hash = await hashFile(original);
      const usedAt = findDuplicateLocation(hash, slotKey);
      if (usedAt) {
        await showAlert({
          title: 'Duplicate Photo',
          message: `This exact photo is already used as “${usedAt}”. Each angle needs its own shot.`,
          variant: 'warning'
        });
        return;
      }

      let stored: File = original;
      try {
        stored = asFile(await imageCompression(original, COMPRESS_OPTIONS), original);
      } catch {
        // Keep the original — the server-side transform is the backstop.
      }
      fileHashes.current.set(stored, hash);

      setPhotoSlots(prev => {
        const old = prev[slotKey];
        if (old instanceof File) releaseFile(old);
        return { ...prev, [slotKey]: stored };
      });
    } finally {
      setBusySlots(prev => ({ ...prev, [slotKey]: false }));
    }
  };

  const handleExtraPhotosChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;

    const remaining = MAX_IMAGES - totalImageCount();
    if (remaining <= 0) {
      await showAlert({ title: 'Image Limit Reached', message: `Maximum ${MAX_IMAGES} images allowed.`, variant: 'warning' });
      return;
    }
    const capped = files.slice(0, remaining);
    const skippedForLimit = files.length - capped.length;

    setExtrasBusy(true);
    try {
      // Signatures of everything currently in the form (slots + extras)…
      const seen = new Set<string>();
      for (const img of getAllImages()) {
        if (img instanceof File) {
          const h = fileHashes.current.get(img);
          if (h) seen.add(h);
        }
      }

      // …screen the batch against them (and against itself) BEFORE compressing.
      const unique: { file: File; hash: string }[] = [];
      let duplicates = 0;
      for (const file of capped) {
        const hash = await hashFile(file);
        if (seen.has(hash)) { duplicates++; continue; }
        seen.add(hash);
        unique.push({ file, hash });
      }

      const compressed = await Promise.all(unique.map(async u => {
        let stored = u.file;
        try { stored = asFile(await imageCompression(u.file, COMPRESS_OPTIONS), u.file); } catch { /* keep original */ }
        fileHashes.current.set(stored, u.hash);
        return stored;
      }));

      if (compressed.length > 0) setExtraPhotos(prev => [...prev, ...compressed]);

      if (duplicates > 0 || skippedForLimit > 0) {
        const parts: string[] = [];
        if (duplicates > 0) parts.push(`${duplicates} duplicate photo${duplicates > 1 ? 's' : ''} skipped`);
        if (skippedForLimit > 0) parts.push(`${skippedForLimit} over the ${MAX_IMAGES}-photo limit`);
        await showAlert({
          title: 'Some Photos Skipped',
          message: `${parts.join('; ')}. ${compressed.length > 0 ? `${compressed.length} new photo${compressed.length > 1 ? 's' : ''} added.` : 'No new photos added.'}`,
          variant: 'warning'
        });
      }
    } finally {
      setExtrasBusy(false);
    }
  };

  const removeExtraPhoto = (index: number) => {
    setExtraPhotos(prev => {
      const target = prev[index];
      if (target instanceof File) releaseFile(target);
      return prev.filter((_, i) => i !== index);
    });
  };

  // ── form reset / discard ──────────────────────────────────────────────────────
  const resetForm = () => {
    setForm(defaultForm);
    setPhotoSlots({ front: null, back: null, side: null, interior: null, dashboard: null, bonnet: null });
    setExtraPhotos([]);
    setSelectedCategoryIds([]);
    setIsSubmitting(false);
    setUploadProgress(null);
    releaseAllPreviews();
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingCar(null);
    resetForm();
  };

  // Closing a half-filled form throws away photos that took real time to
  // pick and optimise — ask first unless it's genuinely empty.
  const requestDiscard = async () => {
    const untouched = !editingCar && !form.title.trim() && !form.basePrice && totalImageCount() === 0;
    if (untouched) { closeForm(); return; }
    const confirmed = await showConfirm({
      title: 'Discard Changes?',
      message: editingCar ? 'Any unsaved edits to this vehicle will be lost.' : 'This listing has not been published. Photos and details will be lost.',
      variant: 'danger',
      confirmLabel: 'Discard'
    });
    if (confirmed) closeForm();
  };

  // ── submit ────────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Validation (ordered to match the form top-to-bottom)
    if (!form.title.trim()) { await showAlert({ title: 'Validation Error', message: 'Car name is required.', variant: 'warning' }); return; }
    if (!form.makerId) { await showAlert({ title: 'Validation Error', message: 'Please select a car maker.', variant: 'warning' }); return; }
    if (!form.modelId) { await showAlert({ title: 'Validation Error', message: 'Please select a car model.', variant: 'warning' }); return; }
    if (!form.bodyTypeId) { await showAlert({ title: 'Validation Error', message: 'Please select a body type.', variant: 'warning' }); return; }
    const year = parseInt(form.year, 10);
    const currentYear = new Date().getFullYear();
    if (!form.year || Number.isNaN(year) || year < 1990 || year > currentYear + 1) {
      await showAlert({ title: 'Invalid Year', message: `Year of make must be between 1990 and ${currentYear + 1}.`, variant: 'warning' }); return;
    }
    const price = parseFloat(form.basePrice.toString().replace(/,/g, ''));
    if (!price || price < 100000) { await showAlert({ title: 'Invalid Price', message: 'Price must be at least MK 100,000.', variant: 'warning' }); return; }
    if (price > 2000000000) { await showAlert({ title: 'Invalid Price', message: 'Price cannot exceed MK 2,000,000,000.', variant: 'warning' }); return; }
    if (form.mileage && (parseInt(form.mileage) < 0 || parseInt(form.mileage) > 500000)) { await showAlert({ title: 'Invalid Mileage', message: 'Mileage must be between 0 and 500,000 km.', variant: 'warning' }); return; }
    if (!editingCar) {
      const missing = PHOTO_SLOTS.filter(s => s.required && !photoSlots[s.key]).map(s => s.label);
      if (missing.length > 0) { await showAlert({ title: 'Missing Required Photos', message: `Please add: ${missing.join(', ')}`, variant: 'warning' }); return; }
    }
    if (!form.district.trim()) { await showAlert({ title: 'Validation Error', message: 'District is required.', variant: 'warning' }); return; }
    if (userRole !== 'SELLER' && !form.sellerId) { await showAlert({ title: 'Validation Error', message: 'Please select a seller.', variant: 'warning' }); return; }
    if (form.registered && !form.registrationNumber?.trim()) { await showAlert({ title: 'Documentation Error', message: 'Registration number is required for registered vehicles.', variant: 'warning' }); return; }

    setIsSubmitting(true);
    try {
      // Upload new photos in small batches, preserving display order so the
      // FIRST slot (Front Full) is always the primary image — even in edit
      // mode where existing URLs and fresh files are interleaved.
      const allImages = getAllImages();
      let imageUrls: { url: string; isPrimary: boolean }[] = [];

      if (allImages.length > 0) {
        // "Not a URL string" — NOT instanceof File. Some browsers' image
        // compression yields Blobs; an instanceof File filter silently left
        // those photos un-uploaded and the publish failed server-side.
        const newFiles = allImages.filter((img): img is File => typeof img !== 'string');
        const uploadedByFile = new Map<File, string>();

        if (newFiles.length > 0) {
          setUploadProgress({ done: 0, total: newFiles.length });
          for (let i = 0; i < newFiles.length; i += UPLOAD_CHUNK) {
            const chunk = newFiles.slice(i, i + UPLOAD_CHUNK);
            const base64s = await Promise.all(chunk.map(fileToBase64));
            const uploadRes = await api.post('/upload/images', {
              images: base64s,
              folderPath: `galimotors/cars/${form.makerId || 'unassigned'}`,
            });
            const uploaded: { url: string }[] = uploadRes.data.images;
            if (!uploaded || uploaded.length !== chunk.length) {
              throw new Error('Image upload returned an unexpected result. Please try again.');
            }
            chunk.forEach((file, j) => uploadedByFile.set(file, uploaded[j].url));

            // Lock finished uploads into state immediately: if a later batch
            // (or the save itself) fails, retrying reuses these URLs instead
            // of re-uploading to Cloudinary.
            setPhotoSlots(prev => {
              const next = { ...prev };
              for (const key of Object.keys(next)) {
                const v = next[key];
                if (v instanceof File && uploadedByFile.has(v)) next[key] = uploadedByFile.get(v)!;
              }
              return next;
            });
            setExtraPhotos(prev => prev.map(p => (p instanceof File && uploadedByFile.has(p) ? uploadedByFile.get(p)! : p)));

            setUploadProgress({ done: Math.min(i + chunk.length, newFiles.length), total: newFiles.length });
          }
        }

        imageUrls = allImages.map((img, idx) => ({
          url: typeof img === 'string' ? img : uploadedByFile.get(img)!,
          isPrimary: idx === 0,
        }));

        // Never send a broken payload: every entry must carry a real URL.
        if (imageUrls.some(entry => !entry.url)) {
          throw new Error('Some photos did not finish uploading. Please press publish again — already-uploaded photos are kept.');
        }
      }
      setUploadProgress(null);

      const carData = {
        ...form,
        basePrice: price,
        // Sent as a digits-only string: the server parses numbers itself and
        // maps an empty string to null, which is how the field is cleared.
        sellerAskingPrice: form.sellerAskingPrice.toString().replace(/,/g, ''),
        mileage: parseInt(form.mileage) || 0,
        year,
        registrationYear: form.registrationYear ? parseInt(form.registrationYear, 10) : undefined,
        seatingCapacity: parseInt(form.seatingCapacity.toString()) || 5,
        doors: parseInt(form.doors.toString()) || 4,
        fuelConsumptionKmPL: parseFloat(form.fuelConsumptionKmPL) || null,
        marketId: form.marketId || null,
        attendantId: form.attendantId || null,
        images: imageUrls.length > 0 ? imageUrls : undefined,
      };

      let savedCarId = editingCar?.id;

      if (editingCar) {
        await api.put(`/cars/${editingCar.id}`, carData);
      } else {
        const createRes = await api.post('/cars', carData);
        savedCarId = createRes.data.id;
      }

      // Assign categories if any selected
      if (savedCarId && selectedCategoryIds.length > 0) {
        try {
          await Promise.all(
            selectedCategoryIds.map(categoryId =>
              api.post(`/cars/${savedCarId}/categories`, { categoryId }).catch(err => {
                // Ignore 409 errors (category already assigned)
                if (err.response?.status !== 409) throw err;
              })
            )
          );
        } catch (err) {
          console.error('Failed to assign categories:', err);
          await showAlert({ title: 'Warning', message: 'Car saved but some categories failed to assign.', variant: 'warning' });
        }
      }

      await showAlert(
        editingCar
          ? { title: 'Updated Successfully', message: 'Vehicle details have been refreshed.', variant: 'success' }
          : isFieldRole
            ? { title: 'Submitted for Approval', message: 'Your car has been sent to the admin. It will appear on the site once approved.', variant: 'success' }
            : { title: 'Listing Published', message: 'Vehicle is now live on the marketplace.', variant: 'success' }
      );

      closeForm();
      fetchData();
    } catch (error: unknown) {
      console.error('Submission failed', error);
      const apiError = error as {
        response?: { data?: { message?: string; error?: string; details?: { message?: string } } };
        message?: string;
      };
      const serverMessage =
        apiError.response?.data?.message ||
        apiError.response?.data?.error ||
        apiError.response?.data?.details?.message ||
        apiError.message;
      await showAlert({
        title: 'Save Failed',
        message: `${serverMessage || 'Failed to save car. Please check all fields.'} Your photos and details are still here — fix the issue and publish again.`,
        variant: 'error'
      });
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  // ── edit ──────────────────────────────────────────────────────────────────────
  const handleEdit = (car: CarItem) => {
    releaseAllPreviews();
    setEditingCar(car);
    setForm({
      title: car.title,
      basePrice: car.basePrice ? car.basePrice.toLocaleString('en-US') : '',
      sellerAskingPrice: car.sellerAskingPrice ? car.sellerAskingPrice.toLocaleString('en-US') : '',
      makerId: car.makerId || '',
      modelId: car.modelId || '',
      bodyTypeId: car.bodyTypeId || '',
      year: car.year?.toString() || '',
      fuelType: car.fuelType || 'PETROL',
      transmission: car.transmission || 'AUTOMATIC',
      mileage: car.mileage?.toString() || '',
      district: car.district || 'Lilongwe',
      negotiable: car.negotiable ?? true,
      status: car.status,
      condition: car.condition || 'Used In Malawi',
      sellerId: car.sellerId || '',
      marketId: car.marketId || '',
      attendantId: car.attendantId || '',
      logbookAvailable: car.logbookAvailable || false,
      dutyPaid: car.dutyPaid || false,
      registered: car.registered || false,
      registrationNumber: car.registrationNumber || '',
      registrationYear: (car.registrationYear || car.year || new Date().getFullYear()).toString(),
      engineSize: car.engineSize || '',
      chassisNumber: car.chassisNumber || '',
      modelCode: car.modelCode || '',
      steering: car.steering || 'RIGHT',
      exteriorColor: car.exteriorColor || '',
      interiorColor: car.interiorColor || '',
      seatingCapacity: car.seatingCapacity?.toString() || '5',
      doors: car.doors?.toString() || '4',
      driveTrain: car.driveTrain || '2WD',
      platformInspectedBadge: car.platformInspectedBadge || false,
      isFeatured: car.isFeatured || false,
      urgentSaleBadge: car.urgentSaleBadge || false,
      fuelConsumptionKmPL: car.fuelConsumptionKmPL?.toString() || '',
    });

    // Map existing images: first 6 go to slots, rest go to extras
    const slots: Record<string, string | null> = { front: null, back: null, side: null, interior: null, dashboard: null, bonnet: null };
    const extras: string[] = [];
    if (car.images && car.images.length > 0) {
      const sorted = [...car.images].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
      const slotKeys = PHOTO_SLOTS.map(s => s.key);
      sorted.forEach((img, i) => {
        if (i < slotKeys.length) slots[slotKeys[i]] = img.url;
        else extras.push(img.url);
      });
    }
    setPhotoSlots(slots as any);
    setExtraPhotos(extras);

    // Load existing categories
    if (car.categories && car.categories.length > 0) {
      setSelectedCategoryIds(car.categories.map(cc => cc.category.id));
    } else {
      setSelectedCategoryIds([]);
    }

    setShowAddForm(true);
  };

  // ── delete ────────────────────────────────────────────────────────────────────
  const handleDelete = async (carId: string) => {
    const confirmed = await showConfirm({ title: 'Move to Trash', message: 'The car will disappear from the site immediately. It stays in the Trash tab for 7 days, where you can restore it — after that it is removed for good.', variant: 'danger', confirmLabel: 'Move to Trash' });
    if (!confirmed) return;
    try {
      await api.delete(`/cars/${carId}`);
      fetchData();
      fetchTrash();
      await showAlert({ title: 'Moved to Trash', message: 'The car is off the site. Restore it from the Trash tab within 7 days if this was a mistake.', variant: 'info' });
    } catch { await showAlert({ title: 'Delete Failed', message: 'Could not remove the vehicle.', variant: 'error' }); }
  };

  // ── Trash (staff only): deleted cars waiting out their 7-day window ──
  const [trashCars, setTrashCars] = useState<CarItem[]>([]);
  const isStaffRole = userRole === 'SUPER_ADMIN' || userRole === 'SUB_ADMIN';

  const fetchTrash = async () => {
    if (!isStaffRole) return;
    try {
      const res = await api.get('/cars?trash=true&limit=500');
      setTrashCars(res.data.cars || []);
    } catch { /* trash list is non-critical */ }
  };

  useEffect(() => { fetchTrash(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userRole]);

  const handleRestore = async (carId: string) => {
    try {
      await api.post(`/cars/${carId}/restore`);
      fetchData();
      fetchTrash();
      await showAlert({ title: 'Restored', message: 'The car is back in the inventory (same status it had before).', variant: 'success' });
    } catch { await showAlert({ title: 'Restore Failed', message: 'Could not restore the vehicle.', variant: 'error' }); }
  };

  // ── sold request (sellers/attendants) ────────────────────────────────────────
  const handleRequestSold = async (car: CarItem) => {
    const confirmed = await showConfirm({
      title: 'Mark as Sold?',
      message: `Tell the admin "${car.title}" has been sold? The listing stays on the site until an admin confirms the sale.`,
      variant: 'info',
      confirmLabel: 'Send Request',
    });
    if (!confirmed) return;
    try {
      await api.post(`/cars/${car.id}/request-sold`);
      await showAlert({ title: 'Request Sent', message: 'An admin will confirm the sale. The car leaves the site once approved.', variant: 'success' });
      fetchData();
    } catch (error) {
      const apiError = error as { response?: { data?: { message?: string } } };
      await showAlert({ title: 'Could Not Send Request', message: apiError.response?.data?.message || 'Please try again.', variant: 'error' });
    }
  };

  const handleCancelSoldRequest = async (car: CarItem) => {
    const confirmed = await showConfirm({
      title: 'Withdraw Sold Request',
      message: `Withdraw the pending sold request for "${car.title}"? The listing simply stays live.`,
      variant: 'info',
      confirmLabel: 'Withdraw',
    });
    if (!confirmed) return;
    try {
      await api.post(`/cars/${car.id}/cancel-sold-request`);
      fetchData();
    } catch (error) {
      const apiError = error as { response?: { data?: { message?: string } } };
      await showAlert({ title: 'Could Not Withdraw', message: apiError.response?.data?.message || 'Please try again.', variant: 'error' });
    }
  };

  // ── bulk ──────────────────────────────────────────────────────────────────────
  const handleBulkStatusUpdate = async (status: string) => {
    const confirmed = await showConfirm({ title: 'Bulk Status Update', message: `Update ${selectedCars.length} cars to ${status}?`, variant: 'info', confirmLabel: 'Update Status' });
    if (!confirmed) return;
    try {
      await api.post('/cars/bulk/update-status', { carIds: selectedCars, status });
      setSelectedCars([]);
      fetchData();
      await showAlert({ title: 'Batch Update Success', message: 'Selected vehicles updated.', variant: 'success' });
    } catch { await showAlert({ title: 'Update Error', message: 'Bulk update failed.', variant: 'error' }); }
  };

  // ── seller create ─────────────────────────────────────────────────────────────
  const handleCreateSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerForm.name || !sellerForm.phone || !sellerForm.district) {
      await showAlert({ title: 'Missing Fields', message: 'Name, Phone, and District are required.', variant: 'warning' });
      return;
    }
    setSavingSeller(true);
    try {
      const res = await api.post('/sellers', sellerForm);
      setSellers(prev => [res.data, ...prev]);
      setForm(prev => ({ ...prev, sellerId: res.data.id }));
      setShowSellerModal(false);
      setSellerForm({ name: '', phone: '', district: '', marketId: '', sellerType: 'INDIVIDUAL' });
      await showAlert({ title: 'Seller Added', message: 'Seller account created.', variant: 'success' });
    } catch { await showAlert({ title: 'Error', message: 'Could not create seller.', variant: 'error' }); }
    finally { setSavingSeller(false); }
  };

  const anyPhotoBusy = extrasBusy || Object.values(busySlots).some(Boolean);
  const submitLabel = uploadProgress
    ? `Uploading photo ${uploadProgress.done}/${uploadProgress.total}…`
    : isSubmitting
      ? (editingCar ? 'Saving…' : isFieldRole ? 'Submitting…' : 'Publishing…')
      : (editingCar ? 'Save Changes' : isFieldRole ? 'Submit for Approval' : 'Publish Listing');

  // ── return ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-7xl mx-auto">

      {/* ── Image Viewer Modal ── */}
      {viewingCar && viewingCar.images && viewingCar.images.length > 0 && (
        <ImageViewerModal
          images={viewingCar.images}
          title={viewingCar.title}
          onClose={() => setViewingCar(null)}
        />
      )}

      {/* ── Seller Quick-Create Modal ── */}
      {showSellerModal && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Add New Seller</h2>
                <p className="text-sm text-gray-500 mt-0.5">Create a seller account quickly</p>
              </div>
              <button onClick={() => setShowSellerModal(false)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateSeller} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Full Name *</label>
                <input className={inputCls} placeholder="e.g. John Banda" value={sellerForm.name} onChange={e => setSellerForm({ ...sellerForm, name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Phone Number *</label>
                <input className={inputCls} placeholder="0999 000 000" value={sellerForm.phone} onChange={e => setSellerForm({ ...sellerForm, phone: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">District *</label>
                <CustomSelect
                  value={sellerForm.district}
                  onChange={val => setSellerForm({ ...sellerForm, district: val })}
                  options={toSelectOptions(districts, 'name', 'name')}
                  placeholder="Select district"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Seller Type</label>
                <CustomSelect
                  value={sellerForm.sellerType}
                  onChange={val => setSellerForm({ ...sellerForm, sellerType: val })}
                  options={[
                    { id: 'INDIVIDUAL', name: 'Individual' },
                    { id: 'DEALER', name: 'Dealer' },
                  ]}
                  placeholder="Select type"
                />
              </div>
              {userRole === 'MARKET_ATTENDANT' ? (
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2.5">
                  The seller will be registered under <span className="font-bold text-gray-700">{myMarket?.name || 'your market'}</span>.
                </p>
              ) : (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Market (Optional)</label>
                <CustomSelect
                  value={sellerForm.marketId}
                  onChange={val => setSellerForm({ ...sellerForm, marketId: val })}
                  options={toSelectOptions(markets)}
                  placeholder="Select market"
                />
              </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSellerModal(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="submit" disabled={savingSeller} className="flex-1 py-2.5 bg-coral text-white font-semibold rounded-xl hover:bg-coral/90 shadow-md shadow-coral/20 transition-colors disabled:opacity-60">
                  {savingSeller ? 'Saving...' : 'Create Seller'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add / Edit Form ── */}
      {(showAddForm || editingCar) && (
        <div className="w-full max-w-5xl mx-auto animate-in fade-in duration-300">

          {/* Form header — who am I, where am I, how do I get out */}
          <div className="flex items-center gap-3 mb-5">
            <button
              type="button"
              onClick={requestDiscard}
              className="w-10 h-10 shrink-0 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors"
              title="Back to inventory"
            >
              <ChevronLeft size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-gray-900">{editingCar ? 'Edit Vehicle' : 'Add New Car'}</h1>
              <p className="text-sm text-gray-500 truncate">
                {editingCar ? editingCar.title : 'Five steps — good photos are what sell the car.'}
              </p>
            </div>
          </div>

          <form onSubmit={e => { e.preventDefault(); handleSubmit(); }} className="flex flex-col gap-4">

            {/* ── Step 1: Vehicle Identity ── */}
            <div className="card-widget p-4 md:p-6">
              <SectionHeader step={1} icon={<Car size={20} />} title="Vehicle Identity" sub="What the car is and what it costs" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-sm font-semibold text-gray-700">Car Title *</label>
                  <input
                    list="car-titles"
                    className={inputCls}
                    placeholder="e.g. 2022 TOYOTA LAND CRUISER 300"
                    value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                  />
                  <datalist id="car-titles">
                    {Array.from(new Set(cars.map(c => c.title))).map((title, i) => (
                      <option key={`title-${i}`} value={title} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Make *</label>
                  <CustomSelect
                    value={form.makerId}
                    onChange={val => setForm({ ...form, makerId: val, modelId: '' })}
                    options={toSelectOptions(makers)}
                    placeholder="Select make"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Model *</label>
                  <CustomSelect
                    value={form.modelId}
                    onChange={val => setForm({ ...form, modelId: val })}
                    options={toSelectOptions(makers.find(m => m.id === form.makerId)?.models || [])}
                    placeholder={form.makerId ? 'Select model' : 'Select make first'}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Body Type *</label>
                  <CustomSelect
                    value={form.bodyTypeId}
                    onChange={val => setForm({ ...form, bodyTypeId: val })}
                    options={toSelectOptions(bodyTypes)}
                    placeholder="Select body type"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Year of Make *</label>
                  <input
                    className={inputCls}
                    type="number"
                    inputMode="numeric"
                    placeholder="e.g. 2018"
                    value={form.year}
                    onChange={e => setForm({ ...form, year: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Condition *</label>
                  <CustomSelect
                    value={form.condition}
                    onChange={val => setForm({ ...form, condition: val })}
                    options={[
                      { id: 'IT', name: 'IT' },
                      { id: 'Brand New', name: 'Brand New' },
                      { id: 'Used In Malawi', name: 'Used In Malawi' }
                    ]}
                    placeholder="Select condition"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Listed Price (MK) *</label>
                  <input
                    className={`${inputCls} font-bold`}
                    type="text"
                    inputMode="numeric"
                    placeholder="32,500,000"
                    value={form.basePrice}
                    onChange={e => { const digits = e.target.value.replace(/\D/g, ''); setForm({ ...form, basePrice: digits ? parseInt(digits, 10).toLocaleString('en-US') : '' }); }}
                  />
                  <p className="text-xs text-gray-500">What customers see on the site.</p>
                </div>
                {/* The seller's bottom line. Margin = agreed price minus this,
                    not a fixed percentage. Internal — admins only; the API
                    never sends it to the public site. */}
                {(userRole === 'SUPER_ADMIN' || userRole === 'SUB_ADMIN') && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Seller's Final Price (MK)</label>
                    <input
                      className="w-full px-4 py-2.5 bg-gold-light/40 border border-gold/30 rounded-xl font-bold focus:border-gold-dark focus:ring-1 focus:ring-gold-dark outline-none transition-all text-gray-900"
                      type="text"
                      inputMode="numeric"
                      placeholder="30,000,000"
                      value={form.sellerAskingPrice}
                      onChange={e => { const digits = e.target.value.replace(/\D/g, ''); setForm({ ...form, sellerAskingPrice: digits ? parseInt(digits, 10).toLocaleString('en-US') : '' }); }}
                    />
                    {(() => {
                      const asking = parseInt(form.sellerAskingPrice.replace(/,/g, ''), 10);
                      const listed = parseInt(form.basePrice.replace(/,/g, ''), 10);
                      if (!asking) {
                        return <p className="text-xs text-gray-500">What the seller takes. Never shown to customers.</p>;
                      }
                      if (!listed) return null;
                      const margin = listed - asking;
                      return margin >= 0 ? (
                        <p className="text-xs font-semibold text-success">
                          Room to negotiate: MK {margin.toLocaleString()} at full listed price
                        </p>
                      ) : (
                        <p className="text-xs font-semibold text-danger">
                          Listed BELOW the seller's price by MK {Math.abs(margin).toLocaleString()} — you lose money at list
                        </p>
                      );
                    })()}
                  </div>
                )}
                <div className="flex items-center gap-3 pt-2 md:col-span-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={form.negotiable} onChange={e => setForm({ ...form, negotiable: e.target.checked })} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-coral"></div>
                  </label>
                  <span className="text-sm font-semibold text-gray-700">Price Negotiable</span>
                </div>
              </div>
            </div>

            {/* ── Step 2: Specifications ── */}
            <div className="card-widget p-4 md:p-6">
              <SectionHeader step={2} icon={<SlidersHorizontal size={20} />} title="Specifications" sub="Technical details customers filter by" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Fuel Type *</label>
                  <CustomSelect
                    value={form.fuelType}
                    onChange={val => setForm({ ...form, fuelType: val })}
                    options={[
                      { id: 'PETROL', name: 'Petrol' },
                      { id: 'DIESEL', name: 'Diesel' },
                      { id: 'HYBRID', name: 'Hybrid' },
                      { id: 'ELECTRIC', name: 'Electric' },
                    ]}
                    placeholder="Select fuel type"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Transmission *</label>
                  <CustomSelect
                    value={form.transmission}
                    onChange={val => setForm({ ...form, transmission: val })}
                    options={[
                      { id: 'AUTOMATIC', name: 'Automatic' },
                      { id: 'MANUAL', name: 'Manual' },
                    ]}
                    placeholder="Select transmission"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Mileage (km)</label>
                  <input className={inputCls} type="number" placeholder="e.g. 45000" value={form.mileage} onChange={e => setForm({ ...form, mileage: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Engine Size</label>
                  <input className={inputCls} type="text" placeholder="e.g. 2.0L" value={form.engineSize} onChange={e => setForm({ ...form, engineSize: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Steering</label>
                  <CustomSelect
                    value={form.steering}
                    onChange={val => setForm({ ...form, steering: val })}
                    options={[
                      { id: 'RIGHT', name: 'Right Hand Drive' },
                      { id: 'LEFT', name: 'Left Hand Drive' },
                    ]}
                    placeholder="Select steering"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Drive Train</label>
                  <CustomSelect
                    value={form.driveTrain}
                    onChange={val => setForm({ ...form, driveTrain: val })}
                    options={[
                      { id: '2WD', name: '2WD' },
                      { id: '4WD', name: '4WD' },
                      { id: 'AWD', name: 'AWD' },
                    ]}
                    placeholder="Select drive train"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Exterior Color</label>
                  <input className={inputCls} type="text" placeholder="e.g. Silver" value={form.exteriorColor} onChange={e => setForm({ ...form, exteriorColor: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Interior Color</label>
                  <input className={inputCls} type="text" placeholder="e.g. Black Leather" value={form.interiorColor} onChange={e => setForm({ ...form, interiorColor: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Fuel Consumption (km/L)</label>
                  <input className={inputCls} type="number" step="0.1" placeholder="e.g. 12.5" value={form.fuelConsumptionKmPL} onChange={e => setForm({ ...form, fuelConsumptionKmPL: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Seating Capacity</label>
                  <input className={inputCls} type="number" value={form.seatingCapacity} onChange={e => setForm({ ...form, seatingCapacity: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Doors</label>
                  <input className={inputCls} type="number" value={form.doors} onChange={e => setForm({ ...form, doors: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Chassis Number</label>
                  <input className={inputCls} type="text" placeholder="e.g. JN1TANT31U0123456" value={form.chassisNumber} onChange={e => setForm({ ...form, chassisNumber: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Model Code</label>
                  <input className={inputCls} type="text" placeholder="e.g. NZE141" value={form.modelCode} onChange={e => setForm({ ...form, modelCode: e.target.value })} />
                </div>
              </div>
            </div>

            {/* ── Step 3: Photos ── */}
            <div className="card-widget p-4 md:p-6">
              <SectionHeader
                step={3}
                icon={<Images size={20} />}
                title="Photos"
                sub={`${requiredCount()}/6 required angles • ${totalImageCount()}/${MAX_IMAGES} photos total`}
              />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {PHOTO_SLOTS.map(slot => (
                  <div key={slot.key} className="relative group">
                    <input
                      type="file"
                      accept="image/*"
                      id={`photo-${slot.key}`}
                      className="hidden"
                      disabled={!!busySlots[slot.key]}
                      onChange={e => handleSlotImageChange(slot.key, e)}
                    />
                    <label
                      htmlFor={`photo-${slot.key}`}
                      className={`block aspect-[4/3] rounded-xl border-2 border-dashed cursor-pointer transition-all overflow-hidden ${
                        photoSlots[slot.key]
                          ? 'border-coral bg-coral/5'
                          : 'border-gray-300 bg-gray-50 hover:border-coral hover:bg-coral/5'
                      }`}
                    >
                      {photoSlots[slot.key] ? (
                        <div className="relative w-full h-full">
                          <img
                            src={getPreviewUrl(photoSlots[slot.key]!)}
                            alt={slot.label}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-3">
                            <p className="text-white font-bold text-xs">{slot.label}</p>
                          </div>
                          <button
                            type="button"
                            onClick={e => {
                              e.preventDefault();
                              setPhotoSlots(prev => {
                                const old = prev[slot.key];
                                if (old instanceof File) releaseFile(old);
                                return { ...prev, [slot.key]: null };
                              });
                            }}
                            className="absolute top-2 right-2 w-7 h-7 bg-danger rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-3">
                          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-coral">
                            {slot.icon}
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-bold text-gray-900">{slot.label}</p>
                            <p className="text-[10px] text-gray-500 mt-0.5">{slot.hint}</p>
                          </div>
                          {slot.required && <span className="text-[10px] font-bold text-coral">Required</span>}
                        </div>
                      )}
                      {busySlots[slot.key] && (
                        <div className="absolute inset-0 bg-white/75 flex flex-col items-center justify-center gap-2">
                          <div className="w-6 h-6 border-2 border-coral/30 border-t-coral rounded-full animate-spin" />
                          <p className="text-[10px] font-bold text-coral">Optimising photo…</p>
                        </div>
                      )}
                    </label>
                  </div>
                ))}
              </div>

              {/* Additional photos — same card, clearly optional */}
              <div className="mt-6 pt-5 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Additional Photos</p>
                    <p className="text-xs text-gray-500 font-medium">Optional • wheels, boot, damage close-ups • {Math.max(0, MAX_IMAGES - totalImageCount())} slots left</p>
                  </div>
                  {totalImageCount() < MAX_IMAGES && (
                    <button
                      type="button"
                      disabled={extrasBusy}
                      onClick={() => extraInputRef.current?.click()}
                      className="px-4 py-2 bg-coral text-white font-semibold rounded-xl hover:bg-coral-dark transition-colors text-sm flex items-center gap-2 disabled:opacity-60"
                    >
                      {extrasBusy ? (
                        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Optimising…</>
                      ) : (
                        <><Plus size={16} /> Add Photos</>
                      )}
                    </button>
                  )}
                </div>
                <input
                  ref={extraInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleExtraPhotosChange}
                />
                {extraPhotos.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {extraPhotos.map((photo, i) => (
                      <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                        <img src={getPreviewUrl(photo)} alt={`Extra ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeExtraPhoto(i)}
                          className="absolute top-1 right-1 w-6 h-6 bg-danger rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                    No additional photos yet.
                  </div>
                )}
              </div>
            </div>

            {/* ── Step 4: Source & Seller ── */}
            <div className="card-widget p-4 md:p-6">
              <SectionHeader step={4} icon={<Users size={20} />} title="Source & Seller" sub="Where the car is and who is selling it" />
              {userRole === 'SELLER' ? (
                /* A seller only ever lists as themselves — identity is fixed
                   server-side; they just say where the car is. */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Listing as</p>
                    {mySeller ? (
                      <>
                        <p className="text-sm font-bold text-gray-900">{mySeller.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{mySeller.district}{mySeller.marketId ? ` · ${markets.find(m => m.id === mySeller.marketId)?.name || 'your market'}` : ''}</p>
                      </>
                    ) : (
                      <p className="text-sm font-semibold text-coral">No seller profile is linked to your login yet — ask the administrator to link it before adding cars.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">District *</label>
                    <CustomSelect
                      value={form.district}
                      onChange={val => setForm({ ...form, district: val })}
                      options={toSelectOptions(districts, 'name', 'name')}
                      placeholder="Select district"
                    />
                    <p className="text-xs text-gray-500">Where the car currently is — viewing distances are calculated from here.</p>
                  </div>
                </div>
              ) : userRole === 'MARKET_ATTENDANT' ? (
                /* An attendant lists into their own market only; the seller
                   must belong to that market (list already comes scoped). */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Your market</p>
                    {myMarket ? (
                      <p className="text-sm font-bold text-gray-900">{myMarket.name} <span className="text-xs text-gray-500 font-medium">· {myMarket.district}</span></p>
                    ) : (
                      <p className="text-sm font-semibold text-coral">No attendant profile is linked to your login yet — ask the administrator to link it before adding cars.</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">District *</label>
                    <CustomSelect
                      value={form.district}
                      onChange={val => setForm({ ...form, district: val })}
                      options={toSelectOptions(districts, 'name', 'name')}
                      placeholder="Select district"
                    />
                    <p className="text-xs text-gray-500">Viewing distances are calculated from here.</p>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                      Seller *
                      <button type="button" onClick={() => setShowSellerModal(true)} className="text-xs text-coral hover:underline font-semibold">+ New Seller</button>
                    </label>
                    <CustomSelect
                      value={form.sellerId}
                      onChange={val => setForm({ ...form, sellerId: val })}
                      options={sellers.map(s => ({ id: s.id, name: `${s.name} (${s.phone})` }))}
                      placeholder="Select a seller from your market"
                    />
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Market *</label>
                  <CustomSelect
                    value={form.marketId}
                    onChange={val => {
                      const selectedMarket = markets.find(m => m.id === val);
                      setForm({
                        ...form,
                        marketId: val,
                        sellerId: '',
                        attendantId: '',
                        district: selectedMarket ? selectedMarket.district : form.district
                      });
                    }}
                    options={markets.map(m => ({ id: m.id, name: `${m.name} — ${m.district}` }))}
                    placeholder="Select market"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">District *</label>
                  <CustomSelect
                    value={form.district}
                    onChange={val => setForm({ ...form, district: val })}
                    options={toSelectOptions(districts, 'name', 'name')}
                    placeholder="Select district"
                  />
                  <p className="text-xs text-gray-500">Viewing distances are calculated from here.</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                    Seller *
                    <button type="button" onClick={() => setShowSellerModal(true)} className="text-xs text-coral hover:underline font-semibold">+ New Seller</button>
                  </label>
                  <CustomSelect
                    value={form.sellerId}
                    onChange={val => setForm({ ...form, sellerId: val })}
                    options={sellers
                      .filter(s => !form.marketId || s.marketId === form.marketId)
                      .map(s => ({ id: s.id, name: `${s.name} (${s.phone})` }))}
                    placeholder={form.marketId ? "Select seller" : "Select market first"}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Attendant (Optional)</label>
                  <CustomSelect
                    value={form.attendantId}
                    onChange={val => setForm({ ...form, attendantId: val })}
                    options={attendants
                      .filter((a: any) => !form.marketId || a.marketId === form.marketId)
                      .map((a: any) => ({ id: a.id, name: a.name }))}
                    placeholder={form.marketId ? "Select attendant" : "Select market first"}
                  />
                </div>
              </div>
              )}
            </div>

            {/* ── Step 5: Documentation & Status ── */}
            <div className="card-widget p-4 md:p-6">
              <SectionHeader step={5} icon={<ShieldCheck size={20} />} title="Documentation & Status" sub="Legal papers, badges and visibility" />
              <div className="space-y-5">
                {/* Legal */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Legal Status</h4>
                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={form.registered} onChange={e => setForm({ ...form, registered: e.target.checked })} className="w-5 h-5 text-coral border-gray-300 rounded focus:ring-coral" />
                      <span className="text-sm font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">Registered</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={form.logbookAvailable} onChange={e => setForm({ ...form, logbookAvailable: e.target.checked })} className="w-5 h-5 text-coral border-gray-300 rounded focus:ring-coral" />
                      <span className="text-sm font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">Blue Book Available</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={form.dutyPaid} onChange={e => setForm({ ...form, dutyPaid: e.target.checked })} className="w-5 h-5 text-coral border-gray-300 rounded focus:ring-coral" />
                      <span className="text-sm font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">Duty Paid</span>
                    </label>
                  </div>
                  {form.registered && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Registration Number *</label>
                        <input
                          className={inputCls}
                          type="text"
                          placeholder="e.g. BT 1234"
                          value={form.registrationNumber}
                          onChange={e => setForm({ ...form, registrationNumber: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Registration Year</label>
                        <input
                          className={inputCls}
                          type="number"
                          inputMode="numeric"
                          value={form.registrationYear}
                          onChange={e => setForm({ ...form, registrationYear: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Badges */}
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Marketplace Badges</h4>
                  <div className="flex flex-wrap gap-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={form.platformInspectedBadge} onChange={e => setForm({ ...form, platformInspectedBadge: e.target.checked })} className="w-5 h-5 text-coral border-gray-300 rounded focus:ring-coral" />
                      <span className="text-sm font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">Platform Inspected</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={form.isFeatured} onChange={e => setForm({ ...form, isFeatured: e.target.checked })} className="w-5 h-5 text-coral border-gray-300 rounded focus:ring-coral" />
                      <span className="text-sm font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">Featured Listing</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={form.urgentSaleBadge} onChange={e => setForm({ ...form, urgentSaleBadge: e.target.checked })} className="w-5 h-5 text-coral border-gray-300 rounded focus:ring-coral" />
                      <span className="text-sm font-semibold text-gray-600 group-hover:text-gray-900 transition-colors">Urgent Sale</span>
                    </label>
                  </div>
                </div>

                {/* Categories */}
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Categories</h4>
                  {categories.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {categories.map(category => (
                        <label key={category.id} className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors border ${selectedCategoryIds.includes(category.id) ? 'bg-coral/5 border-coral/40' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.includes(category.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setSelectedCategoryIds(prev => [...prev, category.id]);
                              } else {
                                setSelectedCategoryIds(prev => prev.filter(id => id !== category.id));
                              }
                            }}
                            className="w-5 h-5 text-coral border-gray-300 rounded focus:ring-coral mt-0.5 flex-shrink-0"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{category.emoji}</span>
                              <span className="font-semibold text-gray-900">{category.name}</span>
                            </div>
                            {category.description && (
                              <p className="text-xs text-gray-500 mt-1">{category.description}</p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No categories available</p>
                  )}
                </div>

                {/* Visibility */}
                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Visibility</h4>
                  {userRole !== 'SELLER' && userRole !== 'MARKET_ATTENDANT' ? (
                    <div className="max-w-xs space-y-1.5">
                      <label className="text-sm font-semibold text-gray-700">Status</label>
                      <CustomSelect
                        value={form.status}
                        onChange={val => setForm({ ...form, status: val })}
                        options={[
                          { id: 'AVAILABLE', name: 'Available' },
                          { id: 'RESERVED', name: 'Reserved' },
                          { id: 'SOLD', name: 'Sold' },
                          { id: 'HIDDEN', name: 'Hidden' },
                        ]}
                        placeholder="Select status"
                      />
                    </div>
                  ) : (
                    <div className="max-w-md px-4 py-3 bg-gold-light border border-gold/30 text-gold-dark rounded-xl font-medium text-sm flex items-center gap-2">
                      <CheckCircle size={16} className="text-gold-dark" />
                      Requires Admin Approval before publishing
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Sticky action bar — publish is always reachable ── */}
            <div className="sticky bottom-0 z-40 pt-1">
              <div className="card-widget px-4 py-3 md:px-5 flex items-center gap-3 shadow-lg bg-white/95 backdrop-blur">
                <p className="hidden sm:block text-xs font-semibold text-gray-500">
                  {requiredCount() === 6
                    ? <span className="text-success">✓ All 6 required photos added</span>
                    : `${requiredCount()}/6 required photos`}
                  <span className="text-gray-300 mx-1.5">•</span>
                  {totalImageCount()}/{MAX_IMAGES} total
                </p>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={requestDiscard}
                  className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || anyPhotoBusy}
                  className="flex items-center gap-2 px-6 py-2.5 bg-coral text-white font-bold rounded-xl hover:bg-coral-dark shadow-lg shadow-coral/20 transition-all disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {submitLabel}</>
                  ) : (
                    <><Send size={16} /> {submitLabel}</>
                  )}
                </button>
              </div>
            </div>

          </form>
        </div>
      )}

      {/* ── Car Inventory Grid ── */}
      {!showAddForm && !editingCar && (() => {
        const STATUS_TABS = [
          { id: 'ALL', label: 'All' },
          { id: 'AVAILABLE', label: 'Available' },
          { id: 'PENDING_APPROVAL', label: 'Pending' },
          { id: 'RESERVED', label: 'Reserved' },
          { id: 'SOLD', label: 'Sold' },
          { id: 'HIDDEN', label: 'Hidden' },
          // Deleted cars wait here for 7 days before the nightly purge —
          // the safety net that makes Delete recoverable.
          ...(isStaffRole ? [{ id: 'TRASH', label: 'Trash' }] : []),
        ];
        const inTrashTab = invStatusFilter === 'TRASH';
        const countFor = (id: string) =>
          id === 'TRASH' ? trashCars.length :
          id === 'ALL' ? cars.length : cars.filter(c => c.status === id).length;

        const q = invSearch.toLowerCase().trim();
        const sourceCars = inTrashTab ? trashCars : cars;
        const filteredCars = sourceCars.filter(c => {
          if (viewMarketId && c.marketId !== viewMarketId) return false;
          if (!inTrashTab && invStatusFilter !== 'ALL' && c.status !== invStatusFilter) return false;
          if (!q) return true;
          return (
            c.title.toLowerCase().includes(q) ||
            (c.maker?.name || '').toLowerCase().includes(q) ||
            (c.model?.name || '').toLowerCase().includes(q) ||
            (c.district || '').toLowerCase().includes(q) ||
            (c.registrationNumber || '').toLowerCase().includes(q) ||
            (c.chassisNumber || '').toLowerCase().includes(q) ||
            c.id.startsWith(q)
          );
        });

        return (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Car Inventory</h1>
              <p className="text-sm text-gray-500 mt-1">
                {filteredCars.length === cars.length
                  ? `${cars.length} vehicles in system`
                  : `${filteredCars.length} of ${cars.length} vehicles shown`}
              </p>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-2 px-5 py-3 bg-coral text-white font-bold rounded-xl hover:bg-coral/90 shadow-lg shadow-coral/20 transition-all"
            >
              <Plus size={20} />
              Add New Car
            </button>
          </div>

          {/* Status tabs + search — the controls that keep a large inventory
              manageable. Counts come from the loaded set. */}
          <div className="card-widget p-3 sm:p-4 space-y-3">
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {STATUS_TABS.map(t => {
                const active = invStatusFilter === t.id;
                const count = countFor(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => setInvStatusFilter(t.id)}
                    className={`shrink-0 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-colors ${
                      active
                        ? 'bg-coral text-white'
                        : count === 0
                          ? 'bg-muted text-text-tertiary'
                          : 'bg-muted text-text-primary hover:bg-coral-light'
                    }`}
                  >
                    {t.label} <span className={active ? 'opacity-80' : 'text-text-tertiary'}>({count})</span>
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={invSearch}
              onChange={e => setInvSearch(e.target.value)}
              placeholder="Search title, make, model, district, reg or chassis number…"
              className="filter-select w-full"
            />
            {viewMarketId && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-coral-light text-coral text-[12px] font-bold rounded-lg">
                  Market: {markets.find(m => m.id === viewMarketId)?.name || 'Unknown'}
                  <button onClick={() => setViewMarketId('')} className="hover:text-coral-dark" title="Show all cars">
                    <X size={13} />
                  </button>
                </span>
              </div>
            )}
          </div>

          {selectedCars.length > 0 && (
            <div className="card-widget p-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-700">{selectedCars.length} car(s) selected</p>
              {userRole !== 'SELLER' && userRole !== 'MARKET_ATTENDANT' && (
                <div className="flex items-center gap-2 border-l border-gray-200 pl-4 ml-4">
                  <span className="text-sm font-medium text-gray-500 mr-2">Set Status:</span>
                  <button onClick={() => handleBulkStatusUpdate('AVAILABLE')} className="px-4 py-2 bg-success text-white font-semibold rounded-lg hover:bg-success hover:brightness-110 transition-colors text-sm">
                    Available
                  </button>
                  <button onClick={() => handleBulkStatusUpdate('SOLD')} className="px-4 py-2 bg-info text-white font-semibold rounded-lg hover:opacity-90 transition-colors text-sm">
                    Sold
                  </button>
                </div>
              )}
              <button onClick={() => setSelectedCars([])} className="px-4 py-2 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition-colors text-sm ml-auto">
                Clear
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-coral/20 border-t-coral rounded-full animate-spin" />
            </div>
          ) : cars.length === 0 ? (
            <div className="card-widget p-12 text-center">
              <Car className="mx-auto text-gray-300 mb-4" size={64} />
              <h3 className="text-lg font-bold text-gray-900 mb-2">No Cars Yet</h3>
              <p className="text-sm text-gray-500 mb-6">Start by adding your first vehicle to the inventory.</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 px-5 py-3 bg-coral text-white font-bold rounded-xl hover:bg-coral/90 shadow-lg shadow-coral/20 transition-all"
              >
                <Plus size={20} />
                Add First Car
              </button>
            </div>
          ) : filteredCars.length === 0 ? (
            <div className="card-widget p-12 text-center">
              <Car className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-sm font-medium text-gray-600">
                No {invStatusFilter === 'ALL' ? '' : `${invStatusFilter.replace(/_/g, ' ').toLowerCase()} `}
                cars{invSearch ? ` matching “${invSearch}”` : ''}.
              </p>
              <button
                onClick={() => { setInvStatusFilter('ALL'); setInvSearch(''); }}
                className="mt-4 px-4 py-2 bg-muted text-text-primary text-sm font-semibold rounded-lg hover:bg-coral-light transition-colors"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredCars.map(car => (
                <div key={car.id} className="card-widget overflow-hidden group hover:shadow-lg hover:border-gray-200 transition-all duration-200">
                  {/* Compact image — 16:10 ratio keeps cards short */}
                  <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                    {car.images && car.images.length > 0 ? (
                      <img
                        src={car.images.find(img => img.isPrimary)?.url || car.images[0].url}
                        alt={car.title}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                        onError={e => { e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23f3f4f6" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-family="sans-serif" font-size="18"%3ENo Image%3C/text%3E%3C/svg%3E'; }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <Car size={32} />
                      </div>
                    )}
                    {/* Status badge — top-left */}
                    <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                      car.status === 'AVAILABLE' ? 'bg-success text-white' :
                      car.status === 'SOLD' ? 'bg-info text-white' :
                      car.status === 'RESERVED' ? 'bg-warning text-white' :
                      car.status === 'PENDING_APPROVAL' ? 'bg-gold text-dark' :
                      'bg-gray-500 text-white'
                    }`}>
                      {car.status === 'PENDING_APPROVAL' ? 'PENDING' : car.status}
                    </span>
                    {car.soldRequestedAt && car.status !== 'SOLD' && (
                      <span className="absolute top-8 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-warning text-white">
                        SOLD REQUESTED
                      </span>
                    )}
                    {inTrashTab && (
                      <span className="absolute top-8 left-2 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white">
                        IN TRASH
                      </span>
                    )}
                    {/* Checkbox — top-right (staff only; bulk ops are admin tools) */}
                    {isStaff && !inTrashTab && (
                    <label className="absolute top-2 right-2 cursor-pointer" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedCars.includes(car.id)}
                        onChange={e => {
                          if (e.target.checked) setSelectedCars(prev => [...prev, car.id]);
                          else setSelectedCars(prev => prev.filter(id => id !== car.id));
                        }}
                        className="w-4 h-4 text-coral border-gray-300 rounded focus:ring-coral cursor-pointer"
                      />
                    </label>
                    )}
                    {/* Image count + zoom — bottom-right */}
                    {car.images && car.images.length > 0 && (
                      <button
                        onClick={() => setViewingCar(car)}
                        className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md text-white text-[10px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/80"
                      >
                        <Images size={12} />
                        {car.images.length}
                      </button>
                    )}
                  </div>
                  {/* Card body — compact info */}
                  <div className="p-3">
                    <h3 className="text-sm font-bold text-gray-900 line-clamp-1 leading-tight">{car.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                      {car.maker?.name} {car.model?.name} • {car.year}
                    </p>
                    <div className="flex items-center justify-between mt-2.5">
                      <p className="text-sm font-bold text-gray-900">
                        MK {car.basePrice?.toLocaleString('en-US')}
                      </p>
                      <div className="flex items-center gap-1">
                        {inTrashTab ? (
                          <button
                            onClick={() => handleRestore(car.id)}
                            className="px-2.5 py-1.5 rounded-md bg-success text-white text-[11px] font-bold hover:brightness-110 transition-all"
                            title="Put this car back in the inventory"
                          >
                            Restore
                          </button>
                        ) : isStaff ? (
                          <>
                            <button
                              onClick={() => handleEdit(car)}
                              className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                              title="Edit"
                            >
                              <Edit size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(car.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        ) : car.soldRequestedAt && car.status !== 'SOLD' ? (
                          <button
                            onClick={() => handleCancelSoldRequest(car)}
                            className="px-2.5 py-1.5 rounded-md bg-warning/10 text-warning text-[10px] font-bold hover:bg-warning/20 transition-colors"
                            title="Withdraw the pending sold request"
                          >
                            Withdraw request
                          </button>
                        ) : ['AVAILABLE', 'RESERVED', 'VIEWING_SCHEDULED'].includes(car.status) ? (
                          <button
                            onClick={() => handleRequestSold(car)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-success text-white text-[11px] font-bold hover:brightness-110 transition-all"
                            title="Ask the admin to confirm this car is sold"
                          >
                            <CheckCircle size={12} /> Mark sold
                          </button>
                        ) : car.status === 'PENDING_APPROVAL' ? (
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Awaiting approval</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
        );
      })()}
    </div>
  );
};

export default CarInventory;
