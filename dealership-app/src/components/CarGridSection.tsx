import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { generateCarUrl } from '../lib/seoRoutes';
import { getCloudinaryThumbnail, getPrimaryImage, handleImageError } from '../lib/imageHelper';
import CategoryBadges from './CategoryBadges';
import { MapPin, Zap, ChevronRight } from 'lucide-react';

interface Car {
  id: string;
  title: string;
  basePrice: number;
  year?: number;
  mileage?: number;
  fuelType?: string;
  transmission?: string;
  district?: string;
  negotiable?: boolean;
  urgentSaleBadge?: boolean;
  condition?: string;
  images: { url: string; isPrimary: boolean }[];
  maker?: { name: string };
  model?: { name: string };
  categories?: Array<{ category: { name: string; emoji: string; color: string; bgColor: string } }>;
}

interface CarGridSectionProps {
  title: string;
  cars: Car[];
  seeMoreLink?: string;
  showRank?: boolean;
}

// Non-breaking space: "MK" must never wrap onto its own line above the amount
// on narrow screens.
const fmt = (n: number) => 'MK ' + n.toLocaleString();

const CarGridSection: React.FC<CarGridSectionProps> = ({
  title,
  cars,
  seeMoreLink = '/cars',
  showRank = false,
}) => {
  const navigate = useNavigate();
  if (!cars.length) return null;

  return (
    <section className="mb-8 sm:mb-10 animate-fade-up">
      {/* Section header — the gold bar is the brand's mark on every section */}
      <div className="flex items-center justify-between mb-4 sm:mb-5 gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1 h-5 bg-gold shrink-0" aria-hidden="true" />
          <h2 className="text-[17px] sm:text-[19px] font-extrabold text-dark tracking-tight truncate">{title}</h2>
        </div>
        {/* A real bordered control — the bare gold text before read as a
            label, not a link, and customers missed it. */}
        {seeMoreLink && (
          <button
            onClick={() => navigate(seeMoreLink)}
            className="inline-flex items-center gap-1 border border-border bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-dark hover:border-gold-dark hover:text-gold-dark transition-colors shrink-0"
          >
            See all <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Grid */}
      {/* One column under 400px: fold cover screens and split view cannot fit
          two cards without clipping titles and prices. */}
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-3 sm:gap-x-4 gap-y-5 sm:gap-y-6 stagger-children">
        {cars.map((car, index) => {
          const primary = getPrimaryImage(car.images);
          const transLabel = car.transmission === 'AUTOMATIC' ? 'Auto' : car.transmission === 'MANUAL' ? 'Manual' : car.transmission;

          return (
            <Link
              to={generateCarUrl(car)}
              key={car.id}
              className="car-item no-underline text-inherit group"
            >
              {/* Image */}
              <div className="car-item-image">
                <img
                  src={getCloudinaryThumbnail(primary?.url, 480)}
                  alt={car.title}
                  loading="lazy"
                  decoding="async"
                  onError={handleImageError}
                />

                {/* Year badge - sharp, no rounding */}
                {car.year && (
                  <span className="absolute bottom-2 left-2 bg-white/95 text-dark text-[11px] font-bold px-2.5 py-1 shadow-sm">
                    {car.year}
                  </span>
                )}

                {/* Rank badge - sharp, no rounding */}
                {showRank && (
                  <span className="absolute top-2 left-2 w-7 h-7 flex items-center justify-center bg-coral text-white text-[12px] font-bold">
                    {index + 1}
                  </span>
                )}

                {/* Urgent badge - sharp, no rounding */}
                {car.urgentSaleBadge && (
                  <span className="absolute top-2 right-2 bg-coral text-white text-[10px] font-bold px-2.5 py-1">
                    URGENT
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="mt-2.5 space-y-1">
                <p className="car-item-title group-hover:text-gold-dark transition-colors duration-200">{car.title}</p>

                {/* Price */}
                <div className="flex items-baseline gap-2">
                  <span className="car-item-price">{fmt(car.basePrice)}</span>
                  {car.negotiable && (
                    <span className="text-[11px] text-text-secondary font-medium">Negotiable</span>
                  )}
                </div>

                {/* Location */}
                {car.district && (
                  <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                    <MapPin size={12} className="text-text-tertiary" />
                    <span>{car.district}</span>
                  </div>
                )}

                {/* Categories */}
                {car.categories && car.categories.length > 0 && (
                  <div className="mt-1.5 pt-1.5 border-t border-border">
                    <CategoryBadges categories={car.categories} max={2} size="sm" />
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default CarGridSection;
