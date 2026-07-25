import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  Image as ImageIcon, MapPin, User, Phone, CheckCircle2,
  ChevronRight, AlertCircle, ArrowLeft, Check, FileText
} from 'lucide-react';
import { useModal } from '../components/ui/ModalContext';
import { api } from '../lib/api';
import customerAuthService from '../lib/customerAuthService';
import imageCompression from 'browser-image-compression';
import { useCustomerAuth } from '../lib/CustomerAuthContext';
import { getCloudinaryThumbnail, getPrimaryImage, handleImageError } from '../lib/imageHelper';
import { generateCarUrl } from '../lib/seoRoutes';
import { isValidMalawianPhone, normaliseMalawianPhone, MALAWI_PHONE_HINT } from '../lib/phone';
import { trackPixel } from '../lib/metaPixel';

/**
 * Book Official Viewing — a full page rather than a modal.
 *
 * This was a fixed-overlay dialog. On a phone the three-step form plus a
 * payment step filled the viewport and read as a bottom sheet, which is not
 * the right treatment for a flow that takes money. As a page it gets a real
 * URL, working back button, no scroll trapping, and room to breathe.
 */

const STEPS = [
  { n: 1, label: 'Your details' },
  { n: 2, label: 'Payment' },
  { n: 3, label: 'Upload receipt' },
] as const;

const BookViewing: React.FC = () => {
  const { uuidShort } = useParams<{ uuidShort: string }>();
  const { showAlert } = useModal();
  const navigate = useNavigate();
  const { isAuthenticated } = useCustomerAuth();
  const [continueAsGuest, setContinueAsGuest] = useState(false);

  const [car, setCar] = useState<any>(null);
  const [carLoading, setCarLoading] = useState(true);
  const [carError, setCarError] = useState<string | null>(null);

  const [viewingFormStep, setViewingFormStep] = useState<1 | 2 | 3>(1);
  const [userDistrict, setUserDistrict] = useState('');
  const [selectedDistance, setSelectedDistance] = useState(0);
  const [viewingCost, setViewingCost] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState({ fuel: 0, driver: 0, accommodation: 0 });
  const [popImageFile, setPopImageFile] = useState<File | null>(null);
  const [popImagePreview, setPopImagePreview] = useState('');
  const [isSubmittingPop, setIsSubmittingPop] = useState(false);
  const [uploadedProofUrl, setUploadedProofUrl] = useState<string | null>(null);
  const [inquiryForm, setInquiryForm] = useState({ buyerName: '', buyerPhone: '', message: '' });

  const [districts, setDistricts] = useState<any[]>([]);
  const [distances, setDistances] = useState<any[]>([]);
  const [fuelPrices, setFuelPrices] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [lilongweId, setLilongweId] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Load the car from the URL so the page works on refresh and when shared.
  useEffect(() => {
    let cancelled = false;
    if (!uuidShort) return;

    (async () => {
      try {
        setCarLoading(true);
        const s = await api.get(`/cars?reference=${uuidShort}&limit=1`);
        if (!s.data.cars?.length) {
          if (!cancelled) setCarError('Car not found');
          return;
        }
        const full = await api.get(`/cars/${s.data.cars[0].id}`);
        if (!cancelled) setCar(full.data);
      } catch {
        if (!cancelled) setCarError('Failed to load vehicle details');
      } finally {
        if (!cancelled) setCarLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [uuidShort]);

  // Prefill from the signed-in customer. Re-runs when the customer signs in
  // through the modal mid-flow.
  useEffect(() => {
    const user = customerAuthService.getCustomer();
    if (user) {
      setInquiryForm(prev => ({ ...prev, buyerName: user.name || '', buyerPhone: user.phone || '' }));
    }
  }, [isAuthenticated]);

  // Logistics reference data. Waits for the car so the base distance is right.
  useEffect(() => {
    if (!car) return;
    let cancelled = false;

    (async () => {
      setIsLoadingData(true);
      try {
        const [setRes, fuelRes, distsRes, distancesRes] = await Promise.all([
          api.get('/settings/global'),
          api.get('/settings/fuel'),
          api.get('/locations/districts'),
          api.get('/locations/distances')
        ]);
        if (cancelled) return;

        if (setRes.data) setSettings(setRes.data);
        if (fuelRes.data) setFuelPrices(fuelRes.data);
        if (distsRes.data) {
          setDistricts(distsRes.data);
          const ll = distsRes.data.find((d: any) => d.name.toLowerCase() === 'lilongwe');
          if (ll) setLilongweId(ll.id);
          if (distancesRes.data) setDistances(distancesRes.data);
        }
      } catch (error) {
        console.error('Failed to fetch settings for viewing', error);
      } finally {
        if (!cancelled) setIsLoadingData(false);
      }
    })();

    return () => { cancelled = true; };
  }, [car]);

  // Recalculate cost whenever relevant state changes
  useEffect(() => {
    if (!settings) return;

    const carFuelType = (car?.fuelType || 'PETROL').toUpperCase();
    const fuelPriceObj = fuelPrices.find(p => p.fuelType === carFuelType)
                      || fuelPrices.find(p => p.fuelType === 'PETROL')
                      || { pricePerLitre: 2530 };

    const pricePerLitre = fuelPriceObj.pricePerLitre;
    const distanceToUse = userDistrict ? selectedDistance : 0;
    const roundTrip = distanceToUse * 2;
    const consumption = Number(car?.fuelConsumptionKmPL) || 8;

    const selectedDistrictObj = districts.find(d => d.name === userDistrict);

    let fuelCost = 0;
    let driverAllowance = 0;
    let accommodation = 0;

    if (!selectedDistrictObj || selectedDistrictObj.chargeFuel !== false) {
      fuelCost = (roundTrip / consumption) * pricePerLitre;
    }
    if (!selectedDistrictObj || selectedDistrictObj.chargeDriverAllowance !== false) {
      driverAllowance = Number(settings.driverAllowance) || 15000;
    }
    if (!selectedDistrictObj || selectedDistrictObj.chargeAccommodation !== false) {
      accommodation = distanceToUse > 200 ? (Number(settings.accommodationFee) || 25000) : 0;
    }

    setBreakdown({
      fuel: Math.round(fuelCost),
      driver: Math.round(driverAllowance),
      accommodation: Math.round(accommodation)
    });
    setViewingCost(Math.round(fuelCost + driverAllowance + accommodation));
  }, [car, fuelPrices, settings, selectedDistance, userDistrict, districts]);

  // Distance between two districts, direction-agnostic. Null when no row
  // exists for the pair.
  const findKm = (aId: string, bId: string): number | null => {
    const row = distances.find(d =>
      (d.fromDistrictId === aId && d.toDistrictId === bId) ||
      (d.fromDistrictId === bId && d.toDistrictId === aId)
    );
    return row ? row.distanceKm : null;
  };

  // The trip that actually happens: the car travels from ITS OWN district to
  // the customer. The old logic always measured Lilongwe -> customer, which
  // billed a Blantyre car's viewing as if it started from base.
  //
  // Distances are admin-entered mostly as Lilongwe <-> X (base is Lilongwe),
  // so when the direct car<->customer pair is not recorded, the route is
  // approximated via base: car -> Lilongwe -> customer. Same district: 0 km.
  const handleDistrictChange = (districtName: string) => {
    setUserDistrict(districtName);
    if (!districtName) {
      setSelectedDistance(0);
      return;
    }

    const customer = districts.find(d => d.name === districtName);
    const carDistrictName = (car?.district || 'Lilongwe').toLowerCase();
    const carD = districts.find(d => d.name.toLowerCase() === carDistrictName);

    if (!customer || !carD) {
      setSelectedDistance(0);
      return;
    }

    if (customer.id === carD.id) {
      setSelectedDistance(0);
      return;
    }

    const direct = findKm(carD.id, customer.id);
    if (direct !== null) {
      setSelectedDistance(direct);
      return;
    }

    if (lilongweId) {
      const carToBase = carD.id === lilongweId ? 0 : findKm(carD.id, lilongweId);
      const baseToCustomer = customer.id === lilongweId ? 0 : findKm(lilongweId, customer.id);
      if (carToBase !== null && baseToCustomer !== null) {
        setSelectedDistance(carToBase + baseToCustomer);
        return;
      }
    }

    setSelectedDistance(0);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf';
    if (!file.type.startsWith('image/') && !isPdf) {
      showAlert({ title: 'Invalid File', message: 'Please select an image or a PDF receipt', variant: 'warning' });
      return;
    }
    // PDFs cannot be compressed client-side, so their cap must respect the
    // upload body limit directly; images shrink to ~0.8MB below.
    if (file.size > (isPdf ? 3 * 1024 * 1024 : 10 * 1024 * 1024)) {
      showAlert({ title: 'File Too Large', message: isPdf ? 'Please select a PDF smaller than 3MB' : 'Please select an image smaller than 10MB', variant: 'warning' });
      return;
    }

    // Receipts are photos of text — 1280px is ample. Compressing before the
    // base64 upload cuts both the customer's data cost and Cloudinary storage.
    const compressed = isPdf ? file : await imageCompression(file, {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1280,
      useWebWorker: true,
    }).catch(() => file);

    setPopImageFile(compressed);
    setUploadedProofUrl(null); // New receipt must be re-uploaded
    const reader = new FileReader();
    reader.onload = () => setPopImagePreview(reader.result as string);
    reader.readAsDataURL(compressed);
  };

  const handleContinueToPayment = () => {
    // Shared validator — the old inline regex accepted only 099/088/098/089
    // and rejected valid numbers on newer ranges such as 095.
    if (!isValidMalawianPhone(inquiryForm.buyerPhone)) {
      showAlert({ title: 'Invalid Phone Number', message: MALAWI_PHONE_HINT, variant: 'warning' });
      return;
    }

    setInquiryForm(prev => ({ ...prev, buyerPhone: normaliseMalawianPhone(prev.buyerPhone) }));
    setViewingFormStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goToStep = (step: 1 | 2 | 3) => {
    setViewingFormStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePopSubmit = async () => {
    if (!inquiryForm.buyerName.trim() || !inquiryForm.buyerPhone.trim() || !userDistrict) {
      await showAlert({ title: 'Missing Details', message: 'Please complete all required fields.', variant: 'warning' });
      return;
    }
    if (!popImagePreview && !uploadedProofUrl) {
      await showAlert({ title: 'Missing Proof', message: 'Please upload proof of payment', variant: 'warning' });
      return;
    }
    if (viewingCost == null) {
      await showAlert({ title: 'Cost Not Ready', message: 'The viewing cost could not be calculated yet. Please re-select your district and try again.', variant: 'warning' });
      return;
    }

    setIsSubmittingPop(true);
    try {
      // Step 1: upload the receipt first (skipped on retry if already uploaded).
      // Nothing is saved server-side until the booking call below succeeds.
      let proofUrl = uploadedProofUrl;
      if (!proofUrl) {
        try {
          // The dedicated public receipt endpoint — /upload/images is
          // admin-only, and calling it as a customer both failed the upload
          // AND tripped the 401 interceptor into wiping the login session.
          const uploadResponse = await api.post('/upload/receipt', {
            image: popImagePreview,
          });
          proofUrl = uploadResponse.data.url;
          setUploadedProofUrl(proofUrl);
        } catch (uploadError) {
          console.error('Failed to upload proof of payment:', uploadError);
          await showAlert({
            title: 'Receipt Upload Failed',
            message: 'We could not upload your receipt. Please check your connection and tap "Submit Request" again — your details have been kept.',
            variant: 'error'
          });
          return;
        }
      }

      // Step 2: create the viewing request in one atomic call
      const leadResponse = await api.post('/leads/inquire', {
        carId: car.id,
        buyerName: inquiryForm.buyerName,
        buyerPhone: inquiryForm.buyerPhone,
        message: `Viewing Request - From ${userDistrict} to ${car.district || 'Lilongwe'}, Round trip: ${selectedDistance * 2}km`,
        leadSource: 'car_detail_viewing',
        buyerDistrict: userDistrict,
        carDistrict: car.district || 'Lilongwe',
        roundTripDistanceKm: selectedDistance * 2,
        calculatedTotalCost: viewingCost,
        paymentAmount: viewingCost,
        proofOfPaymentUrl: proofUrl
      });

      // Meta ads: a paid viewing booking is the strongest conversion signal
      // short of a sale — "Schedule" is the matching standard event.
      trackPixel('Schedule', {
        content_ids: [car.id],
        content_name: car.title,
        value: viewingCost,
        currency: 'MWK',
      });

      navigate(`/viewing/${leadResponse.data.lead.referenceNumber}`);
    } catch (error: any) {
      console.error('Failed to submit viewing request:', error);
      await showAlert({
        title: 'Submission Failed',
        message: error.response?.data?.message || 'Failed to submit your viewing request. Nothing was booked — please tap "Submit Request" to try again.',
        variant: 'error'
      });
    } finally {
      setIsSubmittingPop(false);
    }
  };

  if (carLoading) {
    return (
      <div className="page-container py-10 max-w-3xl">
        <div className="h-4 w-32 bg-muted skeleton mb-6" />
        <div className="h-8 w-72 bg-muted skeleton mb-3" />
        <div className="h-24 w-full bg-muted skeleton mb-8" />
        <div className="h-64 w-full bg-muted skeleton" />
      </div>
    );
  }

  if (carError || !car) {
    return (
      <div className="page-container py-20 max-w-3xl text-center">
        <h1 className="text-[22px] font-extrabold text-dark mb-2">{carError || 'Car not found'}</h1>
        <p className="text-text-secondary text-[14px] mb-6">
          This vehicle may have been sold or removed.
        </p>
        <Link to="/cars" className="btn-outline text-[13px]">Browse available cars</Link>
      </div>
    );
  }

  const primary = getPrimaryImage(car.images);

  return (
    <>
      <Helmet>
        <title>Book a Viewing — {car.title} | GaliMotors</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="page-container py-6 sm:py-10 max-w-3xl">
        <Link
          to={generateCarUrl(car)}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-text-secondary hover:text-dark transition-colors mb-5"
        >
          <ArrowLeft size={14} /> Back to vehicle
        </Link>

        <h1 className="text-[22px] sm:text-[26px] font-extrabold text-dark tracking-tight leading-tight">
          Book an Official Viewing
        </h1>
        <p className="text-[14px] text-text-secondary mt-1.5">
          We bring the vehicle to you. The fee below covers the logistics of getting it there.
        </p>

        {/* What is being booked */}
        <div className="flex items-center gap-3.5 mt-6 p-3 bg-muted border border-border">
          <img
            src={getCloudinaryThumbnail(primary?.url, 200)}
            alt={car.title}
            onError={handleImageError}
            className="w-20 h-16 object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[14px] font-bold text-dark truncate">{car.title}</p>
            <p className="text-[13px] font-semibold text-gold-dark mt-0.5">
              MK {Number(car.basePrice).toLocaleString()}
            </p>
            <p className="text-[11.5px] text-text-secondary mt-0.5 flex items-center gap-1">
              <MapPin size={11} className="text-text-tertiary" /> {car.district || 'Lilongwe'}
            </p>
          </div>
        </div>

        {/* Guests may book with just name + phone — forcing registration
            loses customers here. A sign-in nudge stays because an account
            keeps the booking findable without the reference URL; guest
            history is claimed by phone if they register later. */}
        {!isAuthenticated && !continueAsGuest && (
          <div className="mt-8 p-6 sm:p-8 border border-border bg-muted/40 text-center">
            <User size={28} className="mx-auto text-text-tertiary mb-3" />
            <h2 className="text-[16px] font-bold text-dark">How would you like to continue?</h2>
            <p className="text-[13px] text-text-secondary mt-1.5 max-w-sm mx-auto leading-relaxed">
              Sign in to keep this booking, its payment status and messages on
              your account — or continue as a guest with just your name and
              phone number.
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mt-5">
              <button
                onClick={() => setContinueAsGuest(true)}
                className="btn-primary px-6"
              >
                Continue as Guest
              </button>
              <button
                onClick={() => (window as any).openLoginModal?.()}
                className="btn-outline px-6"
              >
                Sign In
              </button>
            </div>
            <p className="text-[11.5px] text-text-tertiary mt-4 max-w-sm mx-auto">
              Booking as a guest? Keep your reference number safe — if you create
              an account later with the same phone number, this booking will
              appear in it automatically.
            </p>
          </div>
        )}

        {(isAuthenticated || continueAsGuest) && (
        <>
        {/* Stepper */}
        <div className="flex items-center gap-2 sm:gap-3 mt-8 mb-7">
          {STEPS.map((s, i) => {
            const done = viewingFormStep > s.n;
            const active = viewingFormStep === s.n;
            return (
              <React.Fragment key={s.n}>
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-7 h-7 shrink-0 flex items-center justify-center text-[12px] font-bold transition-colors ${
                      done ? 'bg-success text-white'
                        : active ? 'bg-coral text-white'
                        : 'bg-muted text-text-tertiary'
                    }`}
                  >
                    {done ? <Check size={14} /> : s.n}
                  </span>
                  <span
                    className={`text-[12.5px] font-semibold truncate ${
                      active ? 'text-dark' : 'text-text-tertiary'
                    } ${active ? '' : 'hidden sm:inline'}`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <span className={`h-px flex-1 ${viewingFormStep > s.n ? 'bg-success' : 'bg-border'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* ── Step 1: details ───────────────────────────────── */}
        {viewingFormStep === 1 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary">Full Name</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    required
                    value={inquiryForm.buyerName}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, buyerName: e.target.value })}
                    className="field pl-10"
                    placeholder="John Banda"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-text-secondary">Phone Number</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                    <Phone size={16} />
                  </div>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    value={inquiryForm.buyerPhone}
                    onChange={(e) => setInquiryForm({ ...inquiryForm, buyerPhone: e.target.value })}
                    className="field pl-10"
                    placeholder="0952456789"
                  />
                </div>
                <p className="text-[11.5px] text-text-tertiary">
                  10 digits starting 08 or 09.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-text-secondary">Your Current District</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
                  <MapPin size={16} />
                </div>
                <select
                  value={userDistrict}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="field pl-10 appearance-none cursor-pointer"
                >
                  <option value="">Select district...</option>
                  {districts.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cost */}
            <div className="bg-white p-5 border border-border space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-border/60">
                <span className="text-[13px] font-medium text-text-secondary">Vehicle Location</span>
                <span className="text-[13px] font-bold text-dark">{car?.district || 'Lilongwe'}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-border/60">
                <span className="text-[13px] font-medium text-text-secondary">Round Trip Distance</span>
                <span className="text-[13px] font-bold text-dark">
                  {userDistrict ? (selectedDistance * 2) : 0} KM
                </span>
              </div>

              {userDistrict && viewingCost !== null && viewingCost > 0 && (
                <div className="bg-muted p-3 border border-border/60 space-y-2">
                  {breakdown.fuel > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-text-secondary">Fuel Cost (Round Trip)</span>
                      <span className="text-[12px] font-semibold text-text-primary">MK {breakdown.fuel.toLocaleString()}</span>
                    </div>
                  )}
                  {breakdown.driver > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-text-secondary">Driver Allowance</span>
                      <span className="text-[12px] font-semibold text-text-primary">MK {breakdown.driver.toLocaleString()}</span>
                    </div>
                  )}
                  {breakdown.accommodation > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[12px] text-text-secondary">Driver Accommodation (&gt; 200km)</span>
                      <span className="text-[12px] font-semibold text-text-primary">MK {breakdown.accommodation.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between items-end pt-1">
                <span className="text-[13px] font-semibold text-text-secondary">Viewing Cost</span>
                {isLoadingData ? (
                  <div className="h-7 w-24 bg-muted animate-pulse" />
                ) : !userDistrict ? (
                  <span className="text-[13px] font-medium text-text-tertiary">Select your district</span>
                ) : (
                  <span className="text-2xl font-black text-gold-dark tracking-tight">
                    MK {viewingCost?.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={handleContinueToPayment}
              disabled={!userDistrict || !inquiryForm.buyerName || !inquiryForm.buyerPhone}
              className="w-full bg-coral text-white py-3.5 text-[14px] font-bold hover:bg-coral-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
            >
              Continue to Payment
              <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}

        {/* ── Step 2: payment ───────────────────────────────── */}
        {viewingFormStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[16px] font-bold text-dark mb-1">Make Payment</h2>
              <p className="text-sm text-text-secondary">Transfer the viewing fee to our official account, then continue.</p>
            </div>

            <div className="space-y-3">
              {settings?.bankAccountNumber && (
                <div className="bg-dark p-5 text-white">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-white/10">
                      <h3 className="font-bold text-sm text-white/90">Bank Transfer</h3>
                      <span className="text-[10px] bg-white/10 px-2 py-0.5 font-medium">Primary</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider block mb-0.5">Bank</span>
                      <span className="text-[13px] font-bold text-white">{settings?.bankName || 'National Bank of Malawi'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider block mb-0.5">Account Name</span>
                      <span className="text-[13px] font-bold text-white">{settings?.bankAccountName || 'GaliMotors Ltd'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider block mb-0.5">Account Number</span>
                      <span className="text-lg font-mono tracking-wider font-bold text-gold">{settings?.bankAccountNumber}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {settings?.airtelMoneyNumber && (
                  <div className="bg-[#ff0000]/10 p-4 border border-[#ff0000]/20">
                    <div className="space-y-2">
                      <h3 className="font-bold text-sm text-[#cc0000]">Airtel Money</h3>
                      <div>
                        <span className="text-[10px] font-medium text-[#cc0000]/70 uppercase tracking-wider block mb-0.5">Registered Name</span>
                        <span className="text-[12.5px] font-bold text-dark">{settings?.airtelMoneyName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-medium text-[#cc0000]/70 uppercase tracking-wider block mb-0.5">Phone Number</span>
                        <span className="text-base font-mono tracking-wider font-black text-dark">{settings?.airtelMoneyNumber}</span>
                      </div>
                    </div>
                  </div>
                )}

                {settings?.tnmMpambaNumber && (
                  <div className="bg-[#009933]/10 p-4 border border-[#009933]/20">
                    <div className="space-y-2">
                      <h3 className="font-bold text-sm text-[#009933]">TNM Mpamba</h3>
                      <div>
                        <span className="text-[10px] font-medium text-[#009933]/70 uppercase tracking-wider block mb-0.5">Registered Name</span>
                        <span className="text-[12.5px] font-bold text-dark">{settings?.tnmMpambaName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-medium text-[#009933]/70 uppercase tracking-wider block mb-0.5">Phone Number</span>
                        <span className="text-base font-mono tracking-wider font-black text-dark">{settings?.tnmMpambaNumber}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-muted p-4 flex justify-between items-center border border-border">
                <span className="text-sm font-semibold text-text-secondary">Total Amount Due</span>
                <span className="text-xl font-black text-dark">MK {viewingCost?.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-warning-light p-4 flex gap-3 border border-warning/20">
              <AlertCircle size={20} className="text-warning shrink-0" />
              <p className="text-[13px] text-warning font-medium">
                Save your transfer receipt or screenshot — you will upload it in the next step.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => goToStep(1)}
                className="px-5 py-3.5 bg-white border border-border text-sm font-semibold text-text-secondary hover:bg-muted transition-colors"
              >
                Back
              </button>
              <button
                onClick={() => goToStep(3)}
                className="flex-1 bg-dark text-white py-3.5 text-sm font-bold hover:bg-black transition-colors"
              >
                I have made the payment
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: receipt ───────────────────────────────── */}
        {viewingFormStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-[16px] font-bold text-dark mb-1">Upload Receipt</h2>
              <p className="text-sm text-text-secondary">Provide proof of payment to finalise your viewing request.</p>
            </div>

            <div className="border-2 border-dashed border-border bg-white hover:bg-muted transition-colors relative group overflow-hidden">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />

              {popImagePreview ? (
                popImagePreview.startsWith('data:application/pdf') ? (
                  <div className="relative h-56 w-full p-2 flex flex-col items-center justify-center gap-2 text-text-secondary">
                    <FileText size={40} className="text-gold-dark" />
                    <span className="text-[13px] font-semibold text-dark max-w-full truncate px-4">{popImageFile?.name || 'PDF receipt'}</span>
                    <span className="text-[11px]">PDF attached — tap to change</span>
                  </div>
                ) : (
                <div className="relative h-56 w-full p-2">
                  <img src={popImagePreview} alt="Proof of payment" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-dark/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity m-2 backdrop-blur-[2px]">
                    <span className="bg-white text-dark font-bold px-4 py-2 text-xs">Change Image</span>
                  </div>
                </div>
                )
              ) : (
                <div className="h-56 flex flex-col items-center justify-center text-center p-6">
                  <div className="w-14 h-14 bg-muted flex items-center justify-center mb-4 text-text-tertiary group-hover:text-gold-dark transition-colors">
                    <ImageIcon size={24} />
                  </div>
                  <p className="text-sm font-bold text-text-primary">Tap to upload your receipt</p>
                  <p className="text-xs text-text-tertiary mt-1">PNG or JPG, up to 5MB</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => goToStep(2)}
                disabled={isSubmittingPop}
                className="px-5 py-3.5 bg-white border border-border text-sm font-semibold text-text-secondary hover:bg-muted transition-colors disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handlePopSubmit}
                disabled={!popImageFile || isSubmittingPop}
                className="flex-1 bg-coral text-white py-3.5 text-sm font-bold hover:bg-coral-dark transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmittingPop ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} /> Submit Request
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        </>
        )}

        <p className="text-[11.5px] text-text-secondary leading-relaxed text-center mt-8 pt-6 border-t border-border">
          GaliMotors processes all requests within 24 hours. Your fee is fully refundable if the
          vehicle is sold before your viewing takes place.
        </p>
      </div>
    </>
  );
};

export default BookViewing;
