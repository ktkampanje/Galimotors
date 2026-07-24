import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, X, Trash2, MapPin } from 'lucide-react';
import recentlyViewedService from '../lib/recentlyViewedService';
import { useCustomerAuth } from '../lib/CustomerAuthContext';
import { generateCarUrl } from '../lib/seoRoutes';
import { getCloudinaryThumbnail, getPrimaryImage, handleImageError } from '../lib/imageHelper';
import { useModal } from '../components/ui/ModalContext';

interface Car {
  id: string; title: string; basePrice: number; year: number;
  mileage?: number; transmission?: string; images: { url: string; isPrimary: boolean }[];
  maker?: { name: string }; model?: { name: string };
  makerSlug?: string; modelSlug?: string; uuidShort?: string;
}

const fmt = (n: number) => 'MK ' + n.toLocaleString();

export const RecentlyViewedSection: React.FC = () => {
  const { showConfirm } = useModal();
  const { isAuthenticated } = useCustomerAuth();
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) fetchRecentlyViewed();
    else { setCars([]); setLoading(false); }
  }, [isAuthenticated]);

  const fetchRecentlyViewed = async () => {
    try {
      const viewedCars = await recentlyViewedService.getRecentlyViewed(8);
      setCars(viewedCars);
    } catch (error) {
      console.error('Failed to fetch recently viewed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearAll = async () => {
    const confirmed = await showConfirm({
      title: 'Clear History',
      message: 'Are you sure you want to delete your recently viewed car history?',
      variant: 'warning',
      confirmLabel: 'Clear All'
    });
    if (!confirmed) return;
    try {
      await recentlyViewedService.clearAll();
      setCars([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const handleRemoveCar = async (carId: string) => {
    try {
      await recentlyViewedService.removeRecentlyViewed(carId);
      setCars(cars.filter(car => car.id !== carId));
    } catch (e) { /* ignore */ }
  };

  if (!loading && cars.length === 0) return null;

  return (
    <div className="animate-fade-up mb-10">
      {/* Header */}
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="text-[18px] font-extrabold text-dark tracking-tight flex items-center gap-2">
            Recently Viewed
          </h2>
          <p className="text-[12.5px] font-medium text-text-tertiary mt-0.5">Your browsing history</p>
        </div>
        {cars.length > 0 && (
          <div className="flex items-center gap-3">
            <Link to="/recently-viewed" className="text-[12px] font-bold text-gold-dark hover:text-dark transition-colors tracking-wider">
              see more ...
            </Link>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg text-[11px] font-bold text-text-secondary hover:text-gold-dark hover:bg-gold-light transition-all duration-200 uppercase tracking-wider"
            >
              <Trash2 size={13} /> Clear
            </button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex gap-5 overflow-hidden">
          {[1,2,3,4].map(i => (
            <div key={i} className="shrink-0 w-[220px] sm:w-[260px]">
              <div className="aspect-[16/10] bg-muted rounded-xl skeleton mb-3"/>
              <div className="h-3.5 bg-muted rounded skeleton mb-2 w-3/4"/>
              <div className="h-3.5 bg-muted rounded skeleton mb-2 w-1/2"/>
              <div className="h-3 bg-muted rounded skeleton w-1/3"/>
            </div>
          ))}
        </div>
      )}

      {/* Cars Horizontal Scroll */}
      {!loading && cars.length > 0 && (
        <div className="flex gap-5 overflow-x-auto pb-4 pt-1 scrollbar-hide snap-x snap-mandatory -mx-4 px-4 sm:mx-0 sm:px-0">
          {cars.map((car) => {
            const primaryImage = getPrimaryImage(car.images);
            return (
              <div key={car.id} className="shrink-0 w-[220px] sm:w-[260px] snap-start relative group">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    handleRemoveCar(car.id);
                  }}
                  className="absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm hover:bg-red-500 hover:text-white text-text-secondary rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100 shadow-sm"
                  title="Remove from history"
                >
                  <X size={14} />
                </button>

                <Link
                  to={generateCarUrl(car as any)}
                  className="car-item block no-underline text-inherit h-full"
                >
                  <div className="car-item-image aspect-[16/10]">
                    <img
                      src={getCloudinaryThumbnail(primaryImage?.url, 500)}
                      alt={car.title}
                      loading="lazy"
                      decoding="async"
                      onError={handleImageError}
                      className="w-full h-full object-cover"
                    />
                    {car.year && (
                      <span className="absolute bottom-2.5 left-2.5 bg-dark/60 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-0.5 rounded-lg z-10 shadow-sm">
                        {car.year}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="px-1 mt-2.5 space-y-1.5">
                    <p className="car-item-title group-hover:text-gold-dark transition-colors duration-200 truncate font-bold text-dark">{car.title}</p>

                    {/* Price */}
                    <div className="flex items-baseline gap-2">
                      <span className="car-item-price font-bold text-gold-dark">{fmt(car.basePrice)}</span>
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
