import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { useUserActivity } from './UserActivityContext';
import { useModal } from './ui/ModalContext';
import customerAuthService from '../lib/customerAuthService';
import { trackPixel } from '../lib/metaPixel';

interface Props {
  carId: string;
  className?: string;
  size?: number;
  withLabel?: boolean;
  showTooltip?: boolean;
}

export const FavoriteButton: React.FC<Props> = ({ carId, className = '', size = 20, withLabel = false, showTooltip = true }) => {
  const { favoriteCarIds, toggleFavorite } = useUserActivity();
  const { showToast } = useModal();
  const [loading, setLoading] = useState(false);

  const isFavorited = favoriteCarIds.includes(carId);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;

    setLoading(true);
    try {
      const added = await toggleFavorite(carId);
      if (added) {
        trackPixel('AddToWishlist', { content_ids: [carId], content_type: 'product' });
        if (!customerAuthService.isAuthenticated()) {
           showToast('Saved to local favorites. Login to sync across devices.', 'success');
        } else {
           showToast('Saved to your favorites', 'success');
        }
      } else {
        showToast('Removed from favorites', 'info');
      }
    } catch (error) {
      showToast('Failed to update favorites', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`
        transition-all disabled:opacity-50 disabled:cursor-not-allowed
        ${className || 'p-2 rounded-full bg-white/80 backdrop-blur-sm border border-border hover:border-coral hover:bg-white'}
        ${isFavorited ? '!bg-coral !border-coral hover:!bg-coral text-white' : ''}
      `}
      title={showTooltip ? (isFavorited ? 'Remove from favorites' : 'Add to favorites') : undefined}
    >
      <Heart
        size={size}
        className={`transition-colors ${
          isFavorited ? 'fill-white text-white scale-110' : 'text-text-secondary group-hover:text-gold-dark'
        }`}
      />
      {withLabel && (
        <span className={`font-semibold text-sm ml-2 ${isFavorited ? 'text-white' : 'text-text-primary'}`}>
          {isFavorited ? 'Saved' : 'Save'}
        </span>
      )}
    </button>
  );
};
