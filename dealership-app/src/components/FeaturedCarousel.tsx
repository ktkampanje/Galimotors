import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../lib/api';
import { getCloudinaryThumbnail, getPrimaryImage, handleImageError } from '../lib/imageHelper';
import { generateCarUrl } from '../lib/seoRoutes';

interface Car {
  id: string;
  title: string;
  basePrice: number;
  year?: number;
  mileage?: number;
  district?: string;
  transmission?: string;
  fuelType?: string;
  negotiable?: boolean;
  urgentSaleBadge?: boolean;
  images: { url: string; isPrimary: boolean }[];
  maker?: { name: string };
  model?: { name: string };
}

/**
 * One-row horizontal car strip — the homepage's "one row maximum" pattern,
 * shared by Featured Vehicles and New Arrivals. Cards match BE Forward's
 * discipline: photo, year, title, price, district. No decoration.
 */
interface Props {
  cars?: Car[];
  title?: string;
  seeAllHref?: string;
  /** Parent-driven loading (controlled mode) so the skeleton renders in the
      strip's final position instead of content popping in above sections. */
  loading?: boolean;
}

const fmt = (n: number) => 'MK ' + n.toLocaleString();

const FeaturedCarousel: React.FC<Props> = ({ cars: propCars, title = 'Featured Vehicles', seeAllHref, loading: propLoading }) => {
  const [cars, setCars] = useState<Car[]>(propCars || []);
  const [selfLoading, setSelfLoading] = useState(propCars === undefined);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Controlled when a `cars` prop is given (even an EMPTY one). The old check
  // treated an empty array as "self-fetch featured cars", which under a
  // different title would render the wrong cars entirely.
  const isControlled = propCars !== undefined;

  useEffect(() => {
    if (isControlled) { setCars(propCars || []); return; }
    axios.get(`${API_BASE_URL}/cars`, { params: { featured: true, status: 'AVAILABLE', limit: 12 } })
      .then(r => { setCars(r.data.cars || r.data || []); })
      .catch(() => setCars([]))
      .finally(() => setSelfLoading(false));
  }, [isControlled, propCars]);

  const loading = isControlled ? !!propLoading : selfLoading;

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
  };

  if (loading) return (
    <div className="animate-fade-up mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-40 bg-muted skeleton" />
        <div className="flex gap-2"><div className="w-9 h-9 bg-muted skeleton"/><div className="w-9 h-9 bg-muted skeleton"/></div>
      </div>
      <div className="flex gap-5 overflow-hidden">
        {[1,2,3,4].map(i=>(
          <div key={i} className="shrink-0 w-[46vw] max-w-[220px] sm:w-[260px] sm:max-w-none">
            <div className="aspect-[16/10] bg-muted skeleton mb-3"/>
            <div className="h-3.5 bg-muted skeleton mb-2 w-3/4"/>
            <div className="h-3.5 bg-muted skeleton mb-2 w-1/2"/>
            <div className="h-3 bg-muted skeleton w-1/3"/>
          </div>
        ))}
      </div>
    </div>
  );

  if (!cars.length) return null;

  return (
    <div className="animate-fade-up mb-8">
      {/* Header — same grammar as every browse section: gold bar + title +
          controls, See-all styled identically to the tile strips. */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1 h-5 bg-gold shrink-0" aria-hidden="true" />
          <h2 className="text-[17px] sm:text-[19px] font-extrabold text-dark tracking-tight truncate">{title}</h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => scroll('left')}
            aria-label={`Scroll ${title} left`}
            className="w-9 h-9 flex items-center justify-center text-text-secondary hover:text-dark transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => scroll('right')}
            aria-label={`Scroll ${title} right`}
            className="w-9 h-9 flex items-center justify-center text-text-secondary hover:text-dark transition-colors"
          >
            <ChevronRight size={20} />
          </button>
          {seeAllHref && (
            <Link
              to={seeAllHref}
              className="inline-flex items-center gap-1 border border-border bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-dark hover:border-gold-dark hover:text-gold-dark transition-colors no-underline"
            >
              See all <ChevronRight size={14} />
            </Link>
          )}
        </div>
      </div>

      {/* Scroll strip */}
      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto pb-4 pt-1 scrollbar-hide snap-x snap-mandatory"
      >
        {cars.map(car => {
          const primary = getPrimaryImage(car.images);
          return (
            <Link
              key={car.id}
              to={generateCarUrl(car)}
              className="shrink-0 w-[46vw] max-w-[220px] sm:w-[260px] sm:max-w-none car-item no-underline text-inherit snap-start group"
            >
              {/* Image */}
              <div className="car-item-image aspect-[16/10]">
                <img
                  src={getCloudinaryThumbnail(primary?.url, 500)}
                  alt={car.title}
                  loading="lazy"
                  decoding="async"
                  onError={handleImageError}
                />
                {car.year && (
                  <span className="absolute bottom-2 left-2 bg-white/95 text-dark text-[11px] font-bold px-2.5 py-1 shadow-sm z-10">
                    {car.year}
                  </span>
                )}
                {car.urgentSaleBadge && (
                  <span className="absolute top-2 right-2 bg-coral text-white text-[10px] font-bold px-2.5 py-1 z-10">
                    URGENT
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="px-1 mt-2.5 space-y-1.5">
                <p className="car-item-title group-hover:text-gold-dark transition-colors duration-200 truncate">{car.title}</p>

                {/* Price */}
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="car-item-price">{fmt(car.basePrice)}</span>
                  {car.negotiable && (
                    <span className="text-[11px] text-text-secondary font-medium">Negotiable</span>
                  )}
                </div>

                {/* Location */}
                {car.district && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={11} className="text-text-tertiary shrink-0" />
                    <span className="text-[11.5px] font-medium text-text-secondary">{car.district}</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default FeaturedCarousel;
