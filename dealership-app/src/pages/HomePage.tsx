import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useLocation, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  BrowseByMaker, BrowseByBodyType, BrowseByDistrict,
  BrowseByPrice, BrowseByCondition, BrowseByCategory, MakeStrip, BodyTypeStrip, DistrictStrip,
  BrowseByTransmission, BrowseByFuelType, BrowseByYear,
} from '../components/Discovery';
import FeaturedCarousel from '../components/FeaturedCarousel';
import CarGridSection from '../components/CarGridSection';
import { RecentlyViewedSection } from '../components/RecentlyViewedSection';
import { WhatsAppFloat } from '../components/HomepageSections';
import { Loader2, SlidersHorizontal, X, MessageCircle, Phone, Mail, MapPin, Search, ChevronRight } from 'lucide-react';
import { API_BASE_URL } from '../lib/api';
import { useSettings } from '../hooks/useSettings';
import { getCloudinaryThumbnail, getPrimaryImage } from '../lib/imageHelper';
import { trackPixel } from '../lib/metaPixel';

interface Car {
  id: string; title: string; basePrice: number; year?: number;
  mileage?: number; fuelType?: string; transmission?: string;
  district?: string; negotiable?: boolean; urgentSaleBadge?: boolean;
  images: { url: string; isPrimary: boolean }[];
  maker?: { name: string }; model?: { name: string };
}

const SkeletonGrid: React.FC = () => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6 stagger-children">
    {Array.from({ length: 10 }).map((_, i) => (
      <div key={i}>
        <div className="aspect-[4/3] bg-muted skeleton mb-3" />
        <div className="h-3 bg-muted skeleton w-1/3 mb-2" />
        <div className="h-4 bg-muted skeleton w-3/4 mb-2" />
        <div className="h-3 bg-muted skeleton w-1/2 mb-3" />
        <div className="h-5 bg-muted skeleton w-2/5" />
      </div>
    ))}
  </div>
);

const HomePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [heroQuery, setHeroQuery] = useState('');
  const hasFilters = Array.from(searchParams.keys()).length > 0;
  // Two modes on one component so the filter machinery is shared:
  //  - "/" with no filters  -> curated showroom: 8-car rows per section
  //  - "/cars" or filtered  -> the full grid with infinite scroll
  const isGrid = location.pathname === '/cars' || hasFilters;
  const { whatsappLink, phoneDisplay, phoneLink, email, facebookUrl, businessAddress } = useSettings();

  const [featuredCars, setFeaturedCars] = useState<Car[]>([]);
  const [previewCars, setPreviewCars]   = useState<Car[]>([]);
  const [recentCars, setRecentCars]     = useState<Car[]>([]);
  const [additionalCars, setAdditionalCars] = useState<Car[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [currentPage, setCurrentPage]   = useState(1);
  const [hasMore, setHasMore]           = useState(false);
  const [totalCars, setTotalCars]       = useState(0);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Store filter metadata for display
  const [makers, setMakers] = useState<Array<{ id: string; name: string }>>([]);
  const [bodyTypes, setBodyTypes] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; emoji: string }>>([]);
  const [adminHeroImages, setAdminHeroImages] = useState<string[]>([]);

  /* ── Load filter metadata ── */
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [makersRes, bodyTypesRes, categoriesRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/makers`),
          axios.get(`${API_BASE_URL}/body-types`),
          axios.get(`${API_BASE_URL}/categories`),
        ]);
        setMakers(makersRes.data || []);
        setBodyTypes(bodyTypesRes.data || []);
        setCategories(categoriesRes.data || []);
      } catch {
        // Silent fail - not critical
      }
    };
    fetchMetadata();

    // Hand-picked hero photos, curated in the admin panel. Fetched separately
    // so a failure here never blocks the filter metadata.
    axios.get(`${API_BASE_URL}/hero-images`)
      .then(r => setAdminHeroImages((r.data || []).map((h: { url: string }) => h.url)))
      .catch(() => setAdminHeroImages([]));
  }, []);

  /* ── data ── */
  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        if (isGrid) {
          // Full listings: 24 per page, filters straight from the URL.
          const params = Object.fromEntries(searchParams.entries());
          const res = await axios.get(`${API_BASE_URL}/cars`, {
            params: { ...params, status: 'AVAILABLE', limit: 24 },
          });
          setFeaturedCars([]);
          setPreviewCars([]);
          const items = res.data.cars || res.data || [];
          setRecentCars(Array.isArray(items) ? items : []);
          setHasMore(res.data.pagination?.hasMore ?? false);
          setTotalCars(res.data.pagination?.total ?? items.length ?? 0);
          setAdditionalCars([]);
          setCurrentPage(1);
        } else {
          // Curated showroom: Featured strip, New Arrivals strip, and a
          // two-row All Vehicles preview. Client-side slices keep the row
          // caps honest even against a stale-cached payload shape.
          const res = await axios.get(`${API_BASE_URL}/cars/homepage`);
          setFeaturedCars((res.data.featured || []).slice(0, 8));
          setPreviewCars((res.data.preview || []).slice(0, 10));
          setRecentCars((res.data.recent || []).slice(0, 8));
          setHasMore(false);
          setTotalCars(res.data.total ?? 0);
          setAdditionalCars([]);
          setCurrentPage(1);
        }
      } catch { setFeaturedCars([]); setPreviewCars([]); setRecentCars([]); }
      finally { setLoading(false); }
    };
    fetch();
  }, [searchParams, isGrid]);

  /* ── infinite scroll (grid mode only) ── */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !isGrid) return;
    setLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const res = await axios.get(`${API_BASE_URL}/cars`, {
        params: { ...Object.fromEntries(searchParams.entries()), status: 'AVAILABLE', page: nextPage, limit: 24 },
      });
      const newCars: Car[] = res.data.cars || res.data || [];
      // De-dupe by id. Offset pagination shifts when a car is added or sold
      // between batches, so a page boundary can repeat a car — which also
      // collides React keys. The first 24 (recentCars) count as seen too.
      setAdditionalCars(prev => {
        const seen = new Set([...recentCars, ...prev].map(c => c.id));
        return [...prev, ...newCars.filter(c => !seen.has(c.id))];
      });
      setCurrentPage(nextPage);
      setHasMore(res.data.pagination?.hasMore ?? false);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  }, [currentPage, hasMore, loadingMore, isGrid, searchParams, recentCars]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !loadingMore) loadMore(); },
      // rootMargin starts the fetch ~400px before the sentinel is visible, so
      // the next batch is usually in by the time the user reaches the bottom.
      { threshold: 0, rootMargin: '400px 0px' },
    );
    const el = observerTarget.current;
    if (el) obs.observe(el);
    return () => { if (el) obs.unobserve(el); };
  }, [hasMore, loadingMore, loadMore]);

  const chunk = <T,>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  // ── Active filters management ──────────────────────────
  const getActiveFilters = () => {
    const filters: Array<{ key: string; label: string; value: string; displayValue: string }> = [];
    
    searchParams.forEach((value, key) => {
      if (key === 'search') {
        filters.push({ key, label: 'Search', value, displayValue: `"${value}"` });
      } else if (key === 'featured') {
        filters.push({ key, label: 'Featured', value, displayValue: 'Featured' });
      } else if (key === 'condition') {
        const display = value === 'IT' ? 'Foreign Used (IT)' : value;
        filters.push({ key, label: 'Condition', value, displayValue: display });
      } else if (key === 'district') {
        filters.push({ key, label: 'Location', value, displayValue: value });
      } else if (key === 'makerId') {
        const maker = makers.find(m => m.id === value);
        const display = maker ? maker.name : 'Selected Make';
        filters.push({ key, label: 'Make', value, displayValue: display });
      } else if (key === 'bodyTypeId') {
        const bodyType = bodyTypes.find(bt => bt.id === value);
        const display = bodyType ? bodyType.name : 'Selected Type';
        filters.push({ key, label: 'Body Type', value, displayValue: display });
      } else if (key === 'categoryId') {
        const category = categories.find(c => c.id === value);
        const display = category ? category.name : 'Selected Category';
        filters.push({ key, label: 'Category', value, displayValue: display });
      } else if (key === 'transmission') {
        const display = value === 'AUTOMATIC' ? 'Automatic' : 'Manual';
        filters.push({ key, label: 'Transmission', value, displayValue: display });
      } else if (key === 'fuelType') {
        filters.push({ key, label: 'Fuel Type', value, displayValue: value });
      } else if (key === 'minPrice' || key === 'maxPrice') {
        const min = searchParams.get('minPrice');
        const max = searchParams.get('maxPrice');
        if (key === 'minPrice' && !filters.some(f => f.key === 'price')) {
          const display = min && max 
            ? `MK ${parseInt(min).toLocaleString()} - ${parseInt(max).toLocaleString()}`
            : min 
            ? `Above MK ${parseInt(min).toLocaleString()}`
            : `Under MK ${parseInt(max!).toLocaleString()}`;
          filters.push({ key: 'price', label: 'Price', value: '', displayValue: display });
        }
      } else if (key === 'minYear' || key === 'maxYear') {
        const minYear = searchParams.get('minYear');
        const maxYear = searchParams.get('maxYear');
        if (key === 'minYear' && !filters.some(f => f.key === 'year')) {
          const display = minYear && maxYear 
            ? `${minYear} - ${maxYear}`
            : minYear 
            ? `${minYear} and newer`
            : `Before ${maxYear}`;
          filters.push({ key: 'year', label: 'Year', value: '', displayValue: display });
        }
      }
    });
    
    return filters;
  };

  const removeFilter = (key: string) => {
    const params = new URLSearchParams(searchParams);
    
    if (key === 'price') {
      params.delete('minPrice');
      params.delete('maxPrice');
    } else if (key === 'year') {
      params.delete('minYear');
      params.delete('maxYear');
    } else {
      params.delete(key);
    }
    
    window.history.pushState({}, '', params.toString() ? `?${params.toString()}` : '/');
    window.location.reload();
  };

  const clearAllFilters = () => {
    window.location.href = '/';
  };

  const activeFilters = getActiveFilters();

  // Backdrop photos for the hero marquee. Admin-curated photos win; inventory
  // primary images are the fallback so the band never renders bare. The list
  // is then tiled until the strip is long enough to cover any viewport —
  // with only a few photos the strip used to end mid-screen, leaving the
  // right half of the band flat.
  const heroImages = React.useMemo(() => {
    let urls: string[] = adminHeroImages;

    if (urls.length === 0) {
      const derived: string[] = [];
      for (const car of [...featuredCars, ...recentCars, ...previewCars]) {
        const img = getPrimaryImage(car.images);
        if (img?.url && !derived.includes(img.url)) derived.push(img.url);
        if (derived.length >= 8) break;
      }
      urls = derived;
    }

    if (urls.length === 0) return [];

    // ~10 images x ~400px each ≈ a 4000px half-strip — wider than any screen.
    const tiled: string[] = [];
    while (tiled.length < 10) tiled.push(...urls);
    return tiled;
  }, [adminHeroImages, featuredCars, recentCars, previewCars]);

  /* ── render ── */
  return (
    <div className="min-h-screen bg-white">

      {/* ── Showroom header (curated mode) ───────────── */}
      {/* Dark band with a slow sliding strip of inventory photos behind the
          headline and search — the flat band before read as empty space. */}
      {!isGrid && (
        <div className="relative overflow-hidden bg-dark border-b border-border">
          {heroImages.length > 0 && (
            <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
              <div className="flex h-full w-max animate-hero-marquee">
                {[...heroImages, ...heroImages].map((url, i) => (
                  <img
                    key={i}
                    src={getCloudinaryThumbnail(url, 640)}
                    alt=""
                    draggable={false}
                    className="h-full w-auto object-cover opacity-45"
                  />
                ))}
              </div>
              {/* Scrim keeps the headline and search legible over any photo */}
              <div className="absolute inset-0 bg-gradient-to-b from-dark/80 via-dark/65 to-dark/85" />
            </div>
          )}

          <div className="relative page-container py-10 sm:py-16 text-center animate-fade-up">
            <h1 className="text-[24px] sm:text-[34px] font-extrabold text-white tracking-tight leading-tight">
              Verified cars across Malawi
            </h1>
            {/* Both paths spelled out — "we bring the car to you" alone read
                as if home viewings were the only way to buy. */}
            <p className="text-[13.5px] sm:text-[15px] text-white/75 mt-2 max-w-2xl mx-auto">
              Every vehicle inspected before listing. Buy directly with a free
              quote, or book a viewing and we bring the car to you.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const q = heroQuery.trim();
                if (q) trackPixel('Search', { search_string: q });
                navigate(q ? `/cars?search=${encodeURIComponent(q)}` : '/cars');
              }}
              className="flex items-center max-w-xl mx-auto mt-7 h-12 bg-white shadow-lg shadow-black/20 border border-transparent focus-within:border-gold-dark focus-within:ring-2 focus-within:ring-gold/30 transition-all"
            >
              <Search size={17} className="ml-4 text-text-tertiary shrink-0" />
              <input
                type="text"
                value={heroQuery}
                onChange={(e) => setHeroQuery(e.target.value)}
                placeholder="Search by make, model, or year…"
                className="search-input flex-1 px-3 h-full text-[15px] sm:text-[14px] min-w-0"
              />
              <button type="submit" className="bg-coral text-white text-[13px] font-semibold px-6 h-full hover:bg-coral-dark transition-colors shrink-0">
                Search
              </button>
            </form>

            <div className="flex items-center justify-center gap-2 mt-5 flex-wrap">
              {[
                { label: 'Foreign Used (IT)', value: 'IT' },
                { label: 'Brand New', value: 'Brand New' },
                { label: 'Used in Malawi', value: 'Used In Malawi' },
              ].map(c => (
                <Link
                  key={c.value}
                  to={`/cars?condition=${encodeURIComponent(c.value)}`}
                  className="px-3.5 py-1.5 border border-white/30 bg-white/10 text-[12.5px] font-semibold text-white hover:bg-white hover:text-dark transition-colors no-underline backdrop-blur-sm"
                >
                  {c.label}
                </Link>
              ))}
              {/* The full-catalog entry, at the very top where mobile users
                  actually see it — the old sole entry sat below every
                  section, several screens down. Gold: it is THE call to
                  action of the homepage. */}
              <Link
                to="/cars"
                className="px-3.5 py-1.5 bg-gold text-dark text-[12.5px] font-bold hover:bg-white transition-colors no-underline inline-flex items-center gap-1"
              >
                Browse all cars <ChevronRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Main layout ──────────────────────────────── */}
      <div className="page-container py-8">
        <div className="flex gap-12">

          {/* ── Sidebar (desktop, listings mode only) ──
              The filter rail is a listings tool; on the curated homepage it
              read as clutter and squeezed the showroom into half the width. */}
          {isGrid && (
          <aside className="hidden lg:block w-52 xl:w-56 shrink-0">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain pr-1 scroll-smooth">
              {hasFilters && (
                <div className="mb-6">
                  <button 
                    onClick={clearAllFilters} 
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-coral text-white text-[12px] font-semibold hover:bg-coral-dark transition-colors duration-200 shadow-sm"
                  >
                    <X size={14} />
                    Clear all filters
                  </button>
                </div>
              )}
              <BrowseByCategory />
              <BrowseByCondition />
              <BrowseByDistrict />
              <BrowseByMaker />
              <BrowseByBodyType />
              <BrowseByPrice />
              <BrowseByYear />
              <BrowseByTransmission />
              <BrowseByFuelType />

              {/* Trust signals */}
              <div className="sidebar-section mt-2">
                <p className="sidebar-section-title">Why GaliMotors</p>
                <div className="space-y-4 mt-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                      <span className="text-[16px] font-bold text-gold-dark">✓</span>
                    </div>
                    <p className="text-[12px] font-medium text-text-secondary leading-snug pt-0.5">All cars inspected before listing</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                      <span className="text-[16px] font-bold text-gold-dark">✓</span>
                    </div>
                    <p className="text-[12px] font-medium text-text-secondary leading-snug pt-0.5">Transparent viewing cost calculator</p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
          )}

          {/* ── Content ─────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Active Filters Bar */}
            {activeFilters.length > 0 && (
              <div className="mb-6 border-b border-border pb-4 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[13px] font-semibold text-text-secondary flex items-center gap-2">
                    <span>{activeFilters.length} filter{activeFilters.length !== 1 ? 's' : ''} active</span>
                  </p>
                  <button
                    onClick={clearAllFilters}
                    className="text-[12px] font-semibold text-text-secondary hover:text-dark transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeFilters.map((filter, idx) => (
                    <div
                      key={`${filter.key}-${idx}`}
                      className="inline-flex items-center gap-2 bg-white border border-border px-3 py-1.5 text-[13px] hover:border-dark transition-colors"
                    >
                      <span className="font-medium text-dark">
                        {filter.displayValue}
                      </span>
                      <button
                        onClick={() => removeFilter(filter.key)}
                        className="text-text-tertiary hover:text-dark transition-colors"
                        aria-label={`Remove ${filter.label} filter`}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mobile filter button and results count — listings mode only.
                On the curated homepage the bare count read as debug text. */}
            {isGrid && (
            <div className="flex items-center justify-between mb-6 lg:hidden">
              <p className="text-[13px] font-medium text-text-secondary">
                {hasFilters ? `${totalCars} result${totalCars !== 1 ? 's' : ''}` : `${totalCars} vehicle${totalCars !== 1 ? 's' : ''}`}
              </p>
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 border border-border text-[13px] font-medium text-text-primary hover:border-coral transition-colors"
              >
                <SlidersHorizontal size={15} className="text-gold-dark" /> Filter
              </button>
            </div>
            )}

            {/* ── Curated showroom (/), owner-specified order ──
                Featured strip → New Arrivals strip → the three browse strips
                → a TWO-ROW All Vehicles preview → Browse-all CTA. One row
                per car section, no per-category rows, no card pills — the
                catalog does the talking. Strips render their own skeletons
                so nothing pops in above already-visible sections. */}
            {!isGrid && (
              <FeaturedCarousel
                cars={featuredCars}
                loading={loading}
                seeAllHref="/cars?featured=true"
              />
            )}

            {!isGrid && (
              <FeaturedCarousel
                cars={recentCars}
                loading={loading}
                title="New Arrivals"
                seeAllHref="/cars"
              />
            )}

            {!isGrid && <DistrictStrip />}
            {!isGrid && <MakeStrip />}
            {!isGrid && <BodyTypeStrip />}

            {/* Loading (preview slot) */}
            {loading && <SkeletonGrid />}

            {!isGrid && !loading && (
              <>
                {previewCars.length > 0 && (
                  <CarGridSection
                    title="All Vehicles"
                    cars={previewCars}
                    maxRows={2}
                    seeMoreLink="/cars"
                  />
                )}

                {totalCars > 0 && (
                  <div className="flex justify-center pt-2 pb-8">
                    <Link
                      to="/cars"
                      className="btn-dark px-8 no-underline"
                    >
                      Browse all {totalCars.toLocaleString()} vehicle{totalCars !== 1 ? 's' : ''}
                    </Link>
                  </div>
                )}

                {/* Returning-user utility at the natural stopping point —
                    self-hides for guests. */}
                <RecentlyViewedSection />
              </>
            )}

            {/* ── Full grid (/cars or any filter active) ── */}
            {isGrid && !loading && recentCars.length > 0 && (
              <>
                <CarGridSection
                  title={hasFilters ? `Search Results (${totalCars})` : `All Vehicles (${totalCars})`}
                  cars={recentCars}
                  seeMoreLink=""
                />

                {chunk(additionalCars, 24).map((chunk, idx) => (
                  <CarGridSection
                    key={`more-${idx}`}
                    title={idx === 0 ? 'More Vehicles' : `More Vehicles (${idx + 1})`}
                    cars={chunk}
                    seeMoreLink=""
                  />
                ))}

                {/* Infinite scroll sentinel */}
                <div ref={observerTarget} className="py-8 flex items-center justify-center">
                  {loadingMore && (
                    <div className="flex items-center gap-2 text-text-tertiary text-[13px] font-medium">
                      <Loader2 size={16} className="animate-spin" />
                      Loading more…
                    </div>
                  )}
                  {!hasMore && additionalCars.length > 0 && (
                    <p className="text-[12px] font-medium text-text-tertiary">
                      {recentCars.length + additionalCars.length} of {totalCars} vehicles shown
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Empty — filter copy only makes sense in grid mode; on the
                showroom it used to tell visitors to clear filters they
                never set. */}
            {!loading && recentCars.length === 0 && (
              <div className="h-full flex flex-col justify-center items-center p-8  border border-border bg-muted/20 text-center">
                <Search size={32} className="text-text-tertiary mb-3 opacity-40" />
                <p className="text-[14px] font-medium text-text-secondary">
                  {isGrid ? 'No vehicles found' : 'No vehicles available yet'}
                </p>
                <p className="text-[12px] text-text-tertiary mt-1">
                  {isGrid ? 'Try adjusting or clearing your filters to see more results.' : 'Check back soon — new stock is on the way.'}
                </p>
                {isGrid && (
                  <button onClick={clearAllFilters} className="btn-primary mt-4">Clear All Filters</button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>



      {/* ── Footer ───────────────────────────────────── */}
      <footer className="bg-gradient-to-b from-dark to-dark-muted text-white mt-8 border-t border-dark-muted">
        {/* Mobile: two columns — Quick Links and Support sit side by side,
            brand and contact span full width. Stacking everything in one
            column made the footer three screens of mostly whitespace. */}
        <div className="page-container py-7 sm:py-12 md:py-10 grid grid-cols-2 md:grid-cols-4 gap-y-6 sm:gap-y-10 gap-x-5 md:gap-8 text-[13px] md:text-[12px]">

          {/* Brand Info */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 bg-coral flex items-center justify-center ring-1 ring-white/10">
                <span className="text-gold font-extrabold text-[14px]">G</span>
              </div>
              <span className="font-extrabold text-white text-[16px] tracking-tight">GaliMotors</span>
            </div>
            <p className="text-white/50 leading-relaxed mb-4 pr-4 text-[13px]">
              Malawi's premier platform for buying and selling verified vehicles. We ensure transparency, quality, and a seamless process from start to finish.
            </p>
            {/* Official brand marks as solid filled paths. The previous icons
                were a thin outline glyph and lucide's generic MessageCircle,
                which read as placeholders rather than real social links. */}
            <div className="flex items-center gap-3">
              {/* Admin-managed (Settings -> Facebook Page Link); hidden when
                  no URL is set — a wrong page is worse than no icon. */}
              {facebookUrl && (
              <a
                href={facebookUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="GaliMotors on Facebook"
                title="Facebook"
                className="w-9 h-9 bg-white/5 flex items-center justify-center text-white/70 hover:bg-[#1877F2] hover:text-white transition-colors"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.412c0-3.025 1.792-4.696 4.533-4.696 1.313 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.931-1.956 1.886v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
                </svg>
              </a>
              )}
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                aria-label="Chat with GaliMotors on WhatsApp"
                title="WhatsApp"
                className="w-9 h-9 bg-white/5 flex items-center justify-center text-white/70 hover:bg-[#25D366] hover:text-white transition-colors"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.174.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.83 9.83 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.82 11.82 0 0 0 20.465 3.49" />
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <p className="font-bold text-white text-[13px] mb-3 tracking-wide">Quick Links</p>
            <ul className="space-y-2 text-white/60">
              <li><a href="/cars" className="hover:text-gold transition-colors flex items-center gap-2 py-0.5"><span className="w-1.5 h-1.5 bg-gold rounded-full"></span> Browse Inventory</a></li>
              <li><a href="/cars?condition=Brand%20New" className="hover:text-gold transition-colors flex items-center gap-2 py-0.5"><span className="w-1.5 h-1.5 bg-gold rounded-full"></span> Brand New Cars</a></li>
              <li><a href="/cars?condition=IT" className="hover:text-gold transition-colors flex items-center gap-2 py-0.5"><span className="w-1.5 h-1.5 bg-gold rounded-full"></span> Foreign Used (IT)</a></li>
              <li><a href="/cars?condition=Used%20In%20Malawi" className="hover:text-gold transition-colors flex items-center gap-2 py-0.5"><span className="w-1.5 h-1.5 bg-gold rounded-full"></span> Locally Used</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <p className="font-bold text-white text-[13px] mb-3 tracking-wide">Support</p>
            <ul className="space-y-2 text-white/60">
              <li><Link to="/how-to-buy" className="hover:text-gold transition-colors block py-0.5">How to Buy</Link></li>
              <li><Link to="/import-services" className="hover:text-gold transition-colors block py-0.5">Import Services</Link></li>
              <li><Link to="/faqs" className="hover:text-gold transition-colors block py-0.5">FAQs</Link></li>
              <li><Link to="/terms" className="hover:text-gold transition-colors block py-0.5">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="col-span-2 md:col-span-1">
            <p className="font-bold text-white text-[13px] mb-3 tracking-wide">Contact Us</p>
            {/* Contact rows are links, not plain text — on a phone the number
                should dial and the address should open maps. */}
            <ul className="space-y-2.5 text-white/60">
              {businessAddress && (
              <li>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(businessAddress)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-2.5 hover:text-gold transition-colors py-0.5"
                >
                  <MapPin size={14} className="text-gold shrink-0 mt-0.5" />
                  <span className="leading-tight">{businessAddress}</span>
                </a>
              </li>
              )}
              <li>
                <a href={phoneLink} className="flex items-center gap-2.5 hover:text-gold transition-colors py-0.5">
                  <Phone size={14} className="text-gold shrink-0" />
                  <span className="tabular-nums">{phoneDisplay}</span>
                </a>
              </li>
              <li>
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 hover:text-gold transition-colors py-0.5"
                >
                  <MessageCircle size={14} className="text-gold shrink-0" />
                  <span>Chat on WhatsApp</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${email}`} className="flex items-center gap-2.5 hover:text-gold transition-colors py-0.5">
                  <Mail size={14} className="text-gold shrink-0" />
                  <span className="break-all">{email}</span>
                </a>
              </li>
            </ul>
          </div>

        </div>
        
        {/* Bottom bar */}
        <div className="border-t border-white/5 bg-black/20">
          <div className="page-container py-5 sm:py-4 text-[11.5px] text-white/35 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-2 text-center sm:text-left">
            <span>© {new Date().getFullYear()} GaliMotors. All rights reserved.</span>
            <div className="flex items-center justify-center gap-4">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <span className="w-1 h-1 bg-white/15 rounded-full"></span>
              {/* Was a second, separate "Terms of Use" link pointing nowhere —
                  there is one Terms page, so both entries resolve to it. */}
              <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Mobile sidebar overlay ────────────────────── */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative ml-auto w-[85%] max-w-[288px] bg-white h-full overflow-y-auto shadow-2xl p-4 sm:p-6 animate-slide-in-r">
            <div className="flex items-center justify-between mb-6">
              <p className="text-[16px] font-bold text-dark">Filters</p>
              <button onClick={() => setMobileSidebarOpen(false)} className="p-1.5 bg-muted hover:bg-gray-200 transition-colors">
                <X size={18} />
              </button>
            </div>
            <BrowseByCategory />
            <BrowseByCondition />
            <BrowseByDistrict />
            <BrowseByMaker />
            <BrowseByBodyType />
            <BrowseByPrice />
            <BrowseByYear />
            <BrowseByTransmission />
            <BrowseByFuelType />
          </aside>
        </div>
      )}

      <WhatsAppFloat />
    </div>
  );
};



export default HomePage;
