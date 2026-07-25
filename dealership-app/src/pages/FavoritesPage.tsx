import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Trash2, ArrowLeft, MapPin } from 'lucide-react';
import favoritesService from '../lib/favoritesService';
import { generateCarUrl } from '../lib/seoRoutes';
import { getCloudinaryThumbnail, getPrimaryImage, handleImageError } from '../lib/imageHelper';
import { useModal } from '../components/ui/ModalContext';
import { useUserActivity } from '../components/UserActivityContext';

interface FavoriteCar {
  favoriteId: string;
  addedAt: string;
  car: {
    id: string; title: string; basePrice: number; year: number;
    mileage?: number; transmission?: string; fuelType?: string;
    district?: string; locationCity?: string; status: string;
    maker?: { name: string }; model?: { name: string };
    images: { url: string; isPrimary: boolean }[];
    makerSlug?: string; modelSlug?: string; uuidShort?: string;
  };
}

const fmt = (n: number) => 'MK ' + n.toLocaleString();

const FavoritesPage: React.FC = () => {
  const { showConfirm } = useModal();
  const { toggleFavorite, clearFavorites } = useUserActivity();
  const [favorites, setFavorites] = useState<FavoriteCar[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchFavorites();
  }, []);

  const fetchFavorites = async () => {
    try {
      const data = await favoritesService.getFavorites();
      setFavorites(data);
    } catch (error) {
      console.error('Failed to fetch favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (carId: string) => {
    try {
      await toggleFavorite(carId);
      setFavorites(favorites.filter(fav => fav.car.id !== carId));
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  };

  const handleClearAll = async () => {
    const confirmed = await showConfirm({
      title: 'Clear Favorites',
      message: 'Are you sure you want to remove all saved vehicles? This action cannot be reversed.',
      variant: 'danger',
      confirmLabel: 'Clear All'
    });
    if (!confirmed) return;
    try {
      await clearFavorites();
      setFavorites([]);
    } catch (error) {
      console.error('Failed to clear favorites:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-border sticky top-[64px] sm:top-[100px] z-30 transition-all shadow-sm">
        <div className="page-container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-muted rounded-xl transition-colors border border-transparent hover:border-border"
              >
                <ArrowLeft size={20} className="text-text-secondary" />
              </button>
              <div>
                <h1 className="text-[18px] font-extrabold text-dark flex items-center gap-2 tracking-tight">
                  <div className="w-8 h-8 rounded-lg bg-gold-light flex items-center justify-center">
                    <Heart size={16} className="text-gold-dark fill-gold/30" />
                  </div>
                  Saved Vehicles
                </h1>
                <p className="text-[12px] font-bold text-text-tertiary uppercase tracking-wider mt-0.5 ml-[42px]">
                  {loading ? '…' : `${favorites.length} ${favorites.length === 1 ? 'car' : 'cars'}`}
                </p>
              </div>
            </div>
            {favorites.length > 0 && !loading && (
              <button
                onClick={handleClearAll}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-bold text-[11px] uppercase tracking-wider transition-colors"
              >
                <Trash2 size={13} /> Clear All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="page-container py-8">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6 stagger-children">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i}>
                <div className="aspect-[16/10] bg-muted rounded-xl skeleton mb-3" />
                <div className="h-3 bg-muted skeleton rounded w-1/3 mb-2" />
                <div className="h-4 bg-muted skeleton rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted skeleton rounded w-1/2 mb-2" />
                <div className="h-5 bg-muted skeleton rounded w-2/5" />
              </div>
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="py-24 text-center flex flex-col items-center animate-fade-in">
            <div className="w-16 h-16 bg-coral-light rounded-full flex items-center justify-center mb-4">
              <Heart size={28} className="text-gold-dark opacity-50" />
            </div>
            <h2 className="text-[18px] font-extrabold text-dark tracking-tight mb-2">No Favorites Yet</h2>
            <p className="text-[13px] text-text-secondary mb-6 max-w-sm">Start adding cars to your favorites to see them here.</p>
            <Link to="/cars" className="btn-primary">Browse Vehicles</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6 stagger-children">
            {favorites.map((favorite) => {
              const car = favorite.car;
              const primaryImage = getPrimaryImage(car.images);
              const locationName = car.district || car.locationCity;

              return (
                <div key={favorite.favoriteId} className="car-item relative group block">
                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemove(car.id);
                    }}
                    className="absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm hover:bg-red-500 hover:text-white text-text-tertiary rounded-full transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                    title="Remove from favorites"
                  >
                    <Trash2 size={14} />
                  </button>

                  <Link to={generateCarUrl(car as any)} className="no-underline text-inherit block">
                    {/* Image */}
                    <div className="car-item-image">
                      <img
                        src={getCloudinaryThumbnail(primaryImage?.url, 480)}
                        alt={car.title}
                        loading="lazy"
                        decoding="async"
                        onError={handleImageError}
                      />
                      {car.year && (
                        <span className="absolute bottom-2.5 left-2.5 bg-dark/60 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-0.5 rounded-lg shadow-sm z-10">
                          {car.year}
                        </span>
                      )}
                      {car.status !== 'AVAILABLE' && (
                        <span className="absolute top-2.5 left-2.5 bg-red-600/90 backdrop-blur-md text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm z-10 uppercase tracking-widest">
                          {car.status}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="px-1 mt-2.5 space-y-1.5">
                      <p className="car-item-title group-hover:text-gold-dark transition-colors duration-200 truncate">{car.title}</p>

                      <div className="flex items-baseline gap-2">
                        <span className="car-item-price">{fmt(car.basePrice)}</span>
                      </div>

                      {locationName && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={11} className="text-text-tertiary shrink-0" />
                          <span className="text-[11.5px] font-medium text-text-secondary">{locationName}</span>
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
    </div>
  );
};

export default FavoritesPage;
