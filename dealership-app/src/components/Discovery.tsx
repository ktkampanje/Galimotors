import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { API_BASE_URL } from '../lib/api';
import { ChevronRight, X, MapPin } from 'lucide-react';
import { useFilterStats } from '../hooks/useFilterStats';

interface Maker  { id: string; name: string; logoUrl?: string; priority?: number; _count?: { cars: number } }
interface BodyType { id: string; name: string; iconUrl?: string | null; priority?: number; _count?: { cars: number } }
interface District { id: string; name: string; priority?: number; _count?: { cars: number } }

const sortByPriority = (a: { priority?: number }, b: { priority?: number }) => (a.priority ?? 99) - (b.priority ?? 99);

// Hide filter options whose stock count is zero — a "(0)" row is a dead link
// to an empty results page. If EVERY count is zero (filter-stats fetch failed
// and the defaults are all zeros), show the full list instead of an empty
// sidebar. An actively selected option always stays visible so it can be
// deselected.
function visibleByCount<T>(items: T[], count: (t: T) => number, isActive: (t: T) => boolean): T[] {
  const total = items.reduce((sum, item) => sum + count(item), 0);
  if (total === 0) return items;
  return items.filter(item => count(item) > 0 || isActive(item));
}

// ── Helper to update URL params while preserving others ──────────────────────
const useFilterNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    
    const path = location.pathname === '/cars' ? '/cars' : '/';
    navigate(`${path}?${params.toString()}`, { replace: false });
  };

  const getCurrentValue = (key: string) => searchParams.get(key) || '';

  return { updateFilter, getCurrentValue };
};

// ── Maker logo helper ────────────────────────────────────────────────────────
const makerDomain = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('toyota'))    return 'toyota.com';
  if (n.includes('nissan'))    return 'nissan-global.com';
  if (n.includes('honda'))     return 'honda.com';
  if (n.includes('mazda'))     return 'mazda.com';
  if (n.includes('ford'))      return 'ford.com';
  if (n.includes('bmw'))       return 'bmw.com';
  if (n.includes('mercedes'))  return 'mercedes-benz.com';
  if (n.includes('audi'))      return 'audi.com';
  if (n.includes('volkswagen') || n === 'vw') return 'vw.com';
  if (n.includes('hyundai'))   return 'hyundai.com';
  if (n.includes('kia'))       return 'kia.com';
  if (n.includes('subaru'))    return 'subaru.com';
  if (n.includes('suzuki'))    return 'globalsuzuki.com';
  if (n.includes('mitsubishi'))return 'mitsubishi-motors.com';
  if (n.includes('isuzu'))     return 'isuzu.co.jp';
  if (n.includes('land rover') || n.includes('landrover')) return 'landrover.com';
  return `${n.replace(/\s+/g, '')}.com`;
};

// ────────────────────────────────────────────────────────────────────────────

export const BrowseByMaker: React.FC = () => {
  const [makers, setMakers] = useState<Maker[]>([]);
  const [showAll, setShowAll] = useState(false);
  const { updateFilter, getCurrentValue } = useFilterNavigation();
  const currentMakerId = getCurrentValue('makerId');

  useEffect(() => {
    axios.get(`${API_BASE_URL}/makers`)
      .then(r => setMakers(r.data))
      .catch(() => setMakers([]));
  }, []);

  // A row reading "(0)" is a dead link to an empty result page — hide makes
  // with no stock. If counts are absent entirely (endpoint variant), show all
  // rather than hiding everything. Keep an actively selected make visible.
  const counted = makers.some(m => m._count?.cars !== undefined);
  const inStock = counted
    ? makers.filter(m => (m._count?.cars ?? 0) > 0 || m.id === currentMakerId)
    : makers;
  const sorted  = [...inStock].sort(sortByPriority);
  const visible = showAll ? sorted : sorted.slice(0, 8);

  return (
    <div className="sidebar-section">
      <p className="sidebar-section-title">Shop by Make</p>
      <div className="space-y-0">
        {visible.length === 0 ? (
          <p className="text-xs text-text-tertiary px-4 py-2">No makes available</p>
        ) : (
          visible.map(maker => {
            const fallback = `https://logo.clearbit.com/${makerDomain(maker.name)}`;
            const isActive = currentMakerId === maker.id;
            
            return (
              <button
                key={maker.id}
                onClick={() => updateFilter('makerId', isActive ? '' : maker.id)}
                className={`sidebar-link ${isActive ? 'text-gold-dark font-bold bg-gold-light/60' : ''}`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-9 h-9 flex items-center justify-center shrink-0">
                    <img
                      src={maker.logoUrl || fallback}
                      alt={maker.name}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        const el = e.currentTarget;
                        el.style.display = 'none';
                        const parent = el.parentElement;
                        if (parent) parent.innerHTML = `<span class="text-[14px] font-bold text-text-secondary">${maker.name.substring(0,2).toUpperCase()}</span>`;
                      }}
                    />
                  </span>
                  <span>{maker.name}</span>
                  {maker._count?.cars !== undefined ? (
                    <span className="text-[11px] text-text-tertiary">({maker._count.cars.toLocaleString()})</span>
                  ) : null}
                </span>
                {isActive ? (
                  <X size={13} className="text-gold-dark" />
                ) : (
                  <ChevronRight size={13} className="text-text-tertiary" />
                )}
              </button>
            );
          })
        )}
      </div>
      {sorted.length > 8 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-[12px] font-semibold text-gold-dark hover:underline"
        >
          {showAll ? 'Show less' : `Show all ${sorted.length} makes`}
        </button>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────

export const BrowseByBodyType: React.FC = () => {
  const [types, setTypes] = useState<BodyType[]>([]);
  const [showAll, setShowAll] = useState(false);
  const { updateFilter, getCurrentValue } = useFilterNavigation();
  const currentBodyTypeId = getCurrentValue('bodyTypeId');

  useEffect(() => {
    axios.get(`${API_BASE_URL}/body-types`)
      .then(r => setTypes(r.data))
      .catch(() => setTypes([]));
  }, []);

  // Hide zero-stock body types (see the maker section note).
  const typesCounted = types.some(t => t._count?.cars !== undefined);
  const typesInStock = typesCounted
    ? types.filter(t => (t._count?.cars ?? 0) > 0 || t.id === currentBodyTypeId)
    : types;
  const sorted  = [...typesInStock].sort(sortByPriority);
  const visible = showAll ? sorted : sorted.slice(0, 6);

  return (
    <div className="sidebar-section">
      <p className="sidebar-section-title">Body Type</p>
      <div className="space-y-0">
        {visible.length === 0 ? (
          <p className="text-xs text-text-tertiary px-4 py-2">No body types available</p>
        ) : (
          visible.map(t => {
            const isActive = currentBodyTypeId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => updateFilter('bodyTypeId', isActive ? '' : t.id)}
                className={`sidebar-link ${isActive ? 'text-gold-dark font-bold bg-gold-light/60' : ''}`}
              >
                <span className="flex items-center gap-2.5">
                  {t.iconUrl && (
                    <span className="w-9 h-9 flex items-center justify-center shrink-0">
                      <img
                        src={t.iconUrl}
                        alt={t.name}
                        className="max-w-full max-h-full object-contain opacity-70"
                      />
                    </span>
                  )}
                  <span>{t.name}</span>
                  {t._count?.cars !== undefined ? (
                    <span className="text-[11px] text-text-tertiary">({t._count.cars.toLocaleString()})</span>
                  ) : null}
                </span>
                {isActive ? (
                  <X size={13} className="text-gold-dark" />
                ) : (
                  <ChevronRight size={13} className="text-text-tertiary" />
                )}
              </button>
            );
          })
        )}
      </div>
      {sorted.length > 6 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-[12px] font-semibold text-gold-dark hover:underline"
        >
          {showAll ? 'Show less' : `Show all ${sorted.length} types`}
        </button>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────

const DISTRICT_PRIORITY: Record<string, number> = { Lilongwe: 1, Blantyre: 2, Mzuzu: 3, Zomba: 4 };

export const BrowseByDistrict: React.FC = () => {
  const [districts, setDistricts] = useState<District[]>([]);
  const [showAll, setShowAll] = useState(false);
  const { updateFilter, getCurrentValue } = useFilterNavigation();
  const currentDistrict = getCurrentValue('district');

  useEffect(() => {
    axios.get(`${API_BASE_URL}/locations/districts`)
      .then(r => setDistricts(r.data))
      .catch(() => setDistricts([]));
  }, []);

  // Hide districts with no stock (see the maker section note).
  const districtsCounted = districts.some(d => d._count?.cars !== undefined);
  const districtsInStock = districtsCounted
    ? districts.filter(d => (d._count?.cars ?? 0) > 0 || d.name === currentDistrict)
    : districts;
  const sorted = [...districtsInStock].sort((a, b) => {
    const pa = DISTRICT_PRIORITY[a.name] ?? 99;
    const pb = DISTRICT_PRIORITY[b.name] ?? 99;
    return pa !== pb ? pa - pb : (a.priority ?? 99) - (b.priority ?? 99);
  });
  const visible = showAll ? sorted : sorted.slice(0, 5);

  return (
    <div className="sidebar-section">
      <p className="sidebar-section-title">Location</p>
      <div className="space-y-0">
        {visible.length === 0 ? (
          <p className="text-xs text-text-tertiary px-4 py-2">No locations available</p>
        ) : (
          visible.map(d => {
            const isActive = currentDistrict === d.name;
            return (
              <button
                key={d.id}
                onClick={() => updateFilter('district', isActive ? '' : d.name)}
                className={`sidebar-link ${isActive ? 'text-gold-dark font-bold bg-gold-light/60' : ''}`}
              >
                <span className="flex items-center gap-2.5">
                  <span>{d.name}</span>
                  {d._count?.cars !== undefined ? (
                    <span className="text-[11px] text-text-tertiary">({d._count.cars.toLocaleString()})</span>
                  ) : null}
                </span>
                {isActive ? (
                  <X size={13} className="text-gold-dark" />
                ) : (
                  <ChevronRight size={13} className="text-text-tertiary" />
                )}
              </button>
            );
          })
        )}
      </div>
      {sorted.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-[12px] font-semibold text-gold-dark hover:underline"
        >
          {showAll ? 'Show less' : `Show all ${sorted.length}`}
        </button>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────

export const BrowseByPrice: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { stats } = useFilterStats();

  const handlePriceClick = (min: string, max: string) => {
    const params = new URLSearchParams(searchParams);
    
    if (min) params.set('minPrice', min);
    else params.delete('minPrice');
    
    if (max) params.set('maxPrice', max);
    else params.delete('maxPrice');
    
    const path = location.pathname === '/cars' ? '/cars' : '/';
    navigate(`${path}?${params.toString()}`);
  };

  const currentMin = searchParams.get('minPrice') || '';
  const currentMax = searchParams.get('maxPrice') || '';

  const priceRangesWithCounts = [
    { label: 'Under MK 5M',    min: '',         max: '5000000', count: stats.priceRanges.under_5m },
    { label: 'MK 5M – 15M',   min: '5000000',  max: '15000000', count: stats.priceRanges['5m_15m'] },
    { label: 'MK 15M – 30M',  min: '15000000', max: '30000000', count: stats.priceRanges['15m_30m'] },
    { label: 'MK 30M – 50M',  min: '30000000', max: '50000000', count: stats.priceRanges['30m_50m'] },
    { label: 'Above MK 50M',  min: '50000000', max: '', count: stats.priceRanges.above_50m },
  ];

  const visibleRanges = visibleByCount(
    priceRangesWithCounts,
    r => r.count,
    r => currentMin === r.min && currentMax === r.max && (r.min !== '' || r.max !== '')
  );

  return (
    <div className="sidebar-section">
      <p className="sidebar-section-title">Price Range</p>
      <div className="space-y-0">
        {visibleRanges.map(r => {
          const isActive = currentMin === r.min && currentMax === r.max;
          return (
            <button
              key={r.label}
              onClick={() => handlePriceClick(isActive ? '' : r.min, isActive ? '' : r.max)}
              className={`sidebar-link ${isActive ? 'text-gold-dark font-bold bg-gold-light/60' : ''}`}
            >
              <span className="flex items-center gap-2.5">
                <span>{r.label}</span>
                <span className="text-[11px] text-text-tertiary">({r.count.toLocaleString()})</span>
              </span>
              {isActive ? (
                <X size={13} className="text-gold-dark" />
              ) : (
                <ChevronRight size={13} className="text-text-tertiary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────

// ── Homepage icon strips ─────────────────────────────────────────────
// One tile design for both "Browse by Make" and "Browse by Body Type", so
// the two strips cannot drift apart visually.
//
// - Highest stock first: whoever has the most cars earns the front tiles.
// - Always ONE row (user's call): when tiles overflow, chevron arrows appear
//   in the header to signal and scroll the hidden ones.
interface StripItem {
  id: string;
  name: string;
  imgUrl?: string | null;
  count: number;
  href: string;
}

const TileStrip: React.FC<{
  title: string;
  items: StripItem[];
  /** 'district' renders dark navy location tiles with a gold pin. */
  variant?: 'brand' | 'district';
}> = ({ title, items, variant = 'brand' }) => {
  const railRef = React.useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  const stocked = items
    .filter(i => i.count > 0)
    .sort((a, b) => b.count - a.count);

  // Arrows only when there genuinely is more to see.
  useEffect(() => {
    const check = () => {
      const el = railRef.current;
      if (el) setOverflows(el.scrollWidth > el.clientWidth + 8);
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [stocked.length]);

  if (stocked.length === 0) return null;

  const scroll = (dir: 1 | -1) => {
    railRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' });
  };

  return (
    <div className="mb-10 animate-fade-up">
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1 h-5 bg-gold shrink-0" aria-hidden="true" />
          <h2 className="text-[17px] sm:text-[19px] font-extrabold text-dark tracking-tight truncate">{title}</h2>
        </div>
        {overflows && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => scroll(-1)}
              aria-label={`Scroll ${title} left`}
              className="w-8 h-8 flex items-center justify-center border border-border bg-white text-text-secondary hover:text-dark hover:border-gold-dark transition-colors"
            >
              <ChevronRight size={16} className="rotate-180" />
            </button>
            <button
              onClick={() => scroll(1)}
              aria-label={`Scroll ${title} right`}
              className="w-8 h-8 flex items-center justify-center border border-border bg-white text-text-secondary hover:text-dark hover:border-gold-dark transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
      <div ref={railRef} className="overflow-x-auto pb-2 scrollbar-hide">
        <div className="flex gap-3 w-max">
          {stocked.map(item => (
            variant === 'district' ? (
              /* Location tile — light like the rest of the system; the gold
                 pin is what marks it as a place rather than a brand. */
              <Link
                key={item.id}
                to={item.href}
                className="group shrink-0 min-w-[104px] flex flex-col items-start gap-1.5 bg-white border border-border px-4 py-3.5 hover:border-gold-dark hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200 no-underline"
              >
                <MapPin size={15} className="text-gold-dark" />
                <span className="text-[13px] font-bold text-dark whitespace-nowrap leading-none">{item.name}</span>
                <span className="text-[10.5px] text-text-tertiary leading-none">
                  {item.count.toLocaleString()} car{item.count !== 1 ? 's' : ''}
                </span>
              </Link>
            ) : (
              <Link
                key={item.id}
                to={item.href}
                className="group shrink-0 w-[96px] sm:w-[106px] flex flex-col items-center gap-2 border border-border bg-white px-2.5 py-3.5 hover:border-gold-dark hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200 no-underline"
              >
                <span className="h-9 sm:h-11 flex items-center justify-center">
                  {item.imgUrl ? (
                    <img
                      src={item.imgUrl}
                      alt={item.name}
                      loading="lazy"
                      className="max-h-full max-w-[64px] sm:max-w-[76px] object-contain group-hover:scale-105 transition-transform duration-200"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <span className="w-9 h-9 sm:w-10 sm:h-10 bg-muted flex items-center justify-center text-[13px] font-bold text-text-secondary">
                      {item.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </span>
                <span className="text-[12px] font-bold text-dark whitespace-nowrap leading-none max-w-full truncate">{item.name}</span>
                <span className="text-[10.5px] text-text-tertiary leading-none -mt-0.5">
                  {item.count.toLocaleString()} car{item.count !== 1 ? 's' : ''}
                </span>
              </Link>
            )
          ))}
        </div>
      </div>
    </div>
  );
};

export const MakeStrip: React.FC = () => {
  const [makers, setMakers] = useState<Maker[]>([]);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/makers`)
      .then(r => setMakers(r.data))
      .catch(() => setMakers([]));
  }, []);

  return (
    <TileStrip
      title="Browse by Make"
      items={makers.map(m => ({
        id: m.id,
        name: m.name,
        imgUrl: m.logoUrl || `https://logo.clearbit.com/${makerDomain(m.name)}`,
        count: m._count?.cars ?? 0,
        href: `/cars?makerId=${m.id}`,
      }))}
    />
  );
};

export const BodyTypeStrip: React.FC = () => {
  const [types, setTypes] = useState<BodyType[]>([]);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/body-types`)
      .then(r => setTypes(r.data))
      .catch(() => setTypes([]));
  }, []);

  return (
    <TileStrip
      title="Browse by Body Type"
      items={types.map(t => ({
        id: t.id,
        name: t.name,
        imgUrl: t.iconUrl,
        count: t._count?.cars ?? 0,
        href: `/cars?bodyTypeId=${t.id}`,
      }))}
    />
  );
};

// Malawi's districts as first-class navigation — a local marketplace signal
// no imported template carries. Cars filter by district NAME (getCars'
// `district` param), hence the name-based href.
export const DistrictStrip: React.FC = () => {
  const [list, setList] = useState<District[]>([]);

  useEffect(() => {
    axios.get(`${API_BASE_URL}/locations/districts`)
      .then(r => setList(r.data))
      .catch(() => setList([]));
  }, []);

  return (
    <TileStrip
      title="Browse by District"
      variant="district"
      items={list.map(d => ({
        id: d.id,
        name: d.name,
        count: d._count?.cars ?? 0,
        href: `/cars?district=${encodeURIComponent(d.name)}`,
      }))}
    />
  );
};

// Admin-managed categories (Best Seller, New Arrival, …) as a filter, so the
// homepage's per-category rows and this sidebar drive the same categoryId
// query param on the full listings page.
export const BrowseByCategory: React.FC = () => {
  const [cats, setCats] = useState<Array<{ id: string; name: string; emoji: string; carCount?: number }>>([]);
  const { updateFilter, getCurrentValue } = useFilterNavigation();
  const currentCategoryId = getCurrentValue('categoryId');

  useEffect(() => {
    axios.get(`${API_BASE_URL}/categories`)
      .then(r => setCats(r.data || []))
      .catch(() => setCats([]));
  }, []);

  const withCars = cats.filter(c => (c.carCount ?? 0) > 0 || c.id === currentCategoryId);
  if (withCars.length === 0) return null;

  return (
    <div className="sidebar-section">
      <p className="sidebar-section-title">Shop by Category</p>
      <div className="space-y-0">
        {withCars.map(c => {
          const isActive = currentCategoryId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => updateFilter('categoryId', isActive ? '' : c.id)}
              className={`sidebar-link ${isActive ? 'text-gold-dark font-bold bg-gold-light/60' : ''}`}
            >
              <span className="flex items-center gap-2.5">
                <span>{c.emoji} {c.name}</span>
                {c.carCount !== undefined && (
                  <span className="text-[11px] text-text-tertiary">({c.carCount.toLocaleString()})</span>
                )}
              </span>
              {isActive ? (
                <X size={13} className="text-gold-dark" />
              ) : (
                <ChevronRight size={13} className="text-text-tertiary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const BrowseByCondition: React.FC = () => {
  const { updateFilter, getCurrentValue } = useFilterNavigation();
  const currentCondition = getCurrentValue('condition');
  const { stats } = useFilterStats();
  
  const conditions = [
    { id: 'IT',              label: 'Foreign Used (IT)' },
    { id: 'Brand New',       label: 'Brand New' },
    { id: 'Used In Malawi',  label: 'Used in Malawi' },
  ];
  
  const visibleConditions = visibleByCount(
    conditions,
    c => stats.condition[c.id] ?? 0,
    c => currentCondition === c.id
  );

  return (
    <div className="sidebar-section">
      <p className="sidebar-section-title">Condition</p>
      <div className="space-y-0">
        {visibleConditions.map(c => {
          const isActive = currentCondition === c.id;
          const count = stats.condition[c.id] ?? 0;
          return (
            <button
              key={c.id}
              onClick={() => updateFilter('condition', isActive ? '' : c.id)}
              className={`sidebar-link ${isActive ? 'text-gold-dark font-bold bg-gold-light/60' : ''}`}
            >
              <span className="flex items-center gap-2.5">
                <span>{c.label}</span>
                <span className="text-[11px] text-text-tertiary">({count.toLocaleString()})</span>
              </span>
              {isActive ? (
                <X size={13} className="text-gold-dark" />
              ) : (
                <ChevronRight size={13} className="text-text-tertiary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────

export const BrowseByTransmission: React.FC = () => {
  const { updateFilter, getCurrentValue } = useFilterNavigation();
  const currentTransmission = getCurrentValue('transmission');
  const { stats } = useFilterStats();
  
  const transmissions = [
    { id: 'AUTOMATIC', label: 'Automatic' },
    { id: 'MANUAL',    label: 'Manual' },
  ];
  
  const visibleTransmissions = visibleByCount(
    transmissions,
    t => stats.transmission[t.id] ?? 0,
    t => currentTransmission === t.id
  );

  return (
    <div className="sidebar-section">
      <p className="sidebar-section-title">Transmission</p>
      <div className="space-y-0">
        {visibleTransmissions.map(t => {
          const isActive = currentTransmission === t.id;
          const count = stats.transmission[t.id] ?? 0;
          return (
            <button
              key={t.id}
              onClick={() => updateFilter('transmission', isActive ? '' : t.id)}
              className={`sidebar-link ${isActive ? 'text-gold-dark font-bold bg-gold-light/60' : ''}`}
            >
              <span className="flex items-center gap-2.5">
                <span>{t.label}</span>
                <span className="text-[11px] text-text-tertiary">({count.toLocaleString()})</span>
              </span>
              {isActive ? (
                <X size={13} className="text-gold-dark" />
              ) : (
                <ChevronRight size={13} className="text-text-tertiary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────

export const BrowseByFuelType: React.FC = () => {
  const { updateFilter, getCurrentValue } = useFilterNavigation();
  const currentFuelType = getCurrentValue('fuelType');
  const { stats } = useFilterStats();
  
  const fuelTypes = [
    { id: 'PETROL',   label: 'Petrol' },
    { id: 'DIESEL',   label: 'Diesel' },
    { id: 'HYBRID',   label: 'Hybrid' },
    { id: 'ELECTRIC', label: 'Electric' },
  ];
  
  const visibleFuelTypes = visibleByCount(
    fuelTypes,
    f => stats.fuelType[f.id] ?? 0,
    f => currentFuelType === f.id
  );

  return (
    <div className="sidebar-section">
      <p className="sidebar-section-title">Fuel Type</p>
      <div className="space-y-0">
        {visibleFuelTypes.map(f => {
          const isActive = currentFuelType === f.id;
          const count = stats.fuelType[f.id] ?? 0;
          return (
            <button
              key={f.id}
              onClick={() => updateFilter('fuelType', isActive ? '' : f.id)}
              className={`sidebar-link ${isActive ? 'text-gold-dark font-bold bg-gold-light/60' : ''}`}
            >
              <span className="flex items-center gap-2.5">
                <span>{f.label}</span>
                <span className="text-[11px] text-text-tertiary">({count.toLocaleString()})</span>
              </span>
              {isActive ? (
                <X size={13} className="text-gold-dark" />
              ) : (
                <ChevronRight size={13} className="text-text-tertiary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────

export const BrowseByYear: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { stats } = useFilterStats();

  const handleYearClick = (min: string, max: string) => {
    const params = new URLSearchParams(searchParams);
    
    if (min) params.set('minYear', min);
    else params.delete('minYear');
    
    if (max) params.set('maxYear', max);
    else params.delete('maxYear');
    
    const path = location.pathname === '/cars' ? '/cars' : '/';
    navigate(`${path}?${params.toString()}`);
  };

  const currentMinYear = searchParams.get('minYear') || '';
  const currentMaxYear = searchParams.get('maxYear') || '';

  const yearRangesWithCounts = [
    { label: '2020 and newer', min: '2020', max: '', count: stats.yearRanges['2020_and_newer'] },
    { label: '2015 – 2019',    min: '2015', max: '2019', count: stats.yearRanges['2015_2019'] },
    { label: '2010 – 2014',    min: '2010', max: '2014', count: stats.yearRanges['2010_2014'] },
    { label: '2005 – 2009',    min: '2005', max: '2009', count: stats.yearRanges['2005_2009'] },
    { label: 'Before 2005',    min: '',     max: '2004', count: stats.yearRanges.before_2005 },
  ];

  const visibleYearRanges = visibleByCount(
    yearRangesWithCounts,
    r => r.count,
    r => currentMinYear === r.min && currentMaxYear === r.max && (r.min !== '' || r.max !== '')
  );

  return (
    <div className="sidebar-section">
      <p className="sidebar-section-title">Year</p>
      <div className="space-y-0">
        {visibleYearRanges.map(r => {
          const isActive = currentMinYear === r.min && currentMaxYear === r.max;
          return (
            <button
              key={r.label}
              onClick={() => handleYearClick(isActive ? '' : r.min, isActive ? '' : r.max)}
              className={`sidebar-link ${isActive ? 'text-gold-dark font-bold bg-gold-light/60' : ''}`}
            >
              <span className="flex items-center gap-2.5">
                <span>{r.label}</span>
                <span className="text-[11px] text-text-tertiary">({r.count.toLocaleString()})</span>
              </span>
              {isActive ? (
                <X size={13} className="text-gold-dark" />
              ) : (
                <ChevronRight size={13} className="text-text-tertiary" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Kept for backward-compat imports; no longer rendered on homepage
export const LatestCars: React.FC = () => null;
