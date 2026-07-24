import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../lib/api';
import { getCloudinaryThumbnail, getPrimaryImage, handleImageError } from '../lib/imageHelper';
import { generateCarUrl } from '../lib/seoRoutes';
import CategoryBadges from './CategoryBadges';

interface Car {
  id: string;
  title: string;
  basePrice: number;
  year?: number;
  mileage?: number;
  district?: string;
  transmission?: string;
  fuelType?: string;
  images: { url: string; isPrimary: boolean }[];
  maker?: { name: string };
  model?: { name: string };
  categories?: Array<{ category: { name: string; emoji: string; color: string; bgColor: string } }>;
}

interface Props { cars?: Car[] }

const fmt = (n: number) => 'MK ' + n.toLocaleString();

const FeaturedCarousel: React.FC<Props> = ({ cars: propCars }) => {
  const [cars, setCars] = useState<Car[]>(propCars || []);
  const [loading, setLoading] = useState(!propCars);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (propCars && propCars.length > 0) { setCars(propCars); setLoading(false); return; }
    axios.get(`${API_BASE_URL}/cars`, { params: { featured: true, status: 'AVAILABLE', limit: 12 } })
      .then(r => { setCars(r.data.cars || r.data || []); })
      .catch(() => setCars([]))
      .finally(() => setLoading(false));
  }, [propCars]);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -280 : 280, behavior: 'smooth' });
  };

  if (loading) return (
    <div className="animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-40 bg-muted rounded skeleton" />
        <div className="flex gap-2"><div className="w-9 h-9 rounded-full bg-muted skeleton"/><div className="w-9 h-9 rounded-full bg-muted skeleton"/></div>
      </div>
      <div className="flex gap-5 overflow-hidden">
        {[1,2,3,4].map(i=>(
          <div key={i} className="shrink-0 w-[220px] sm:w-[260px]">
            <div className="aspect-[16/10] bg-muted rounded-xl skeleton mb-3"/>
            <div className="h-3.5 bg-muted rounded skeleton mb-2 w-3/4"/>
            <div className="h-3.5 bg-muted rounded skeleton mb-2 w-1/2"/>
            <div className="h-3 bg-muted rounded skeleton w-1/3"/>
          </div>
        ))}
      </div>
    </div>
  );

  if (!cars.length) return null;

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-5 bg-gold shrink-0" aria-hidden="true" />
          <h2 className="text-[17px] sm:text-[19px] font-extrabold text-dark tracking-tight">Featured Vehicles</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scroll('left')}
            aria-label="Scroll left"
            className="w-9 h-9 flex items-center justify-center text-text-secondary hover:text-dark transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => scroll('right')}
            aria-label="Scroll right"
            className="w-9 h-9 flex items-center justify-center text-text-secondary hover:text-dark transition-colors"
          >
            <ChevronRight size={20} />
          </button>
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
              className="shrink-0 w-[220px] sm:w-[260px] car-item no-underline text-inherit snap-start group"
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
              </div>

              {/* Info */}
              <div className="px-1 mt-2.5 space-y-1.5">
                <p className="car-item-title group-hover:text-gold-dark transition-colors duration-200 truncate">{car.title}</p>

                {/* Price */}
                <div className="flex items-baseline gap-2">
                  <span className="car-item-price">{fmt(car.basePrice)}</span>
                </div>

                {/* Location */}
                {car.district && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={11} className="text-text-tertiary shrink-0" />
                    <span className="text-[11.5px] font-medium text-text-secondary">{car.district}</span>
                  </div>
                )}

                {/* Categories */}
                {car.categories && car.categories.length > 0 && (
                  <div className="pt-1 mt-1 border-t border-border">
                    <CategoryBadges categories={car.categories} max={1} size="sm" />
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
