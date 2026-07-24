import React, { createContext, useContext, useState, useEffect } from 'react';
import favoritesService from '../lib/favoritesService';
import recentlyViewedService, { type RecentlyViewedCar } from '../lib/recentlyViewedService';

interface UserActivityContextType {
  favoriteCarIds: string[];
  recentlyViewedCars: RecentlyViewedCar[];
  toggleFavorite: (carId: string) => Promise<boolean>;
  refreshActivity: () => Promise<void>;
  clearFavorites: () => Promise<void>;
  clearRecentlyViewed: () => Promise<void>;
}

const UserActivityContext = createContext<UserActivityContextType | undefined>(undefined);

export const UserActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [favoriteCarIds, setFavoriteCarIds] = useState<string[]>([]);
  const [recentlyViewedCars, setRecentlyViewedCars] = useState<RecentlyViewedCar[]>([]);

  const fetchFavorites = async () => {
    try {
      const ids = await favoritesService.getFavoriteIds();
      setFavoriteCarIds(ids);
    } catch (e) {
      console.error('Failed to fetch favorite ids in context', e);
    }
  };

  const fetchRecentlyViewed = async () => {
    try {
      const cars = await recentlyViewedService.getRecentlyViewed(8);
      setRecentlyViewedCars(cars);
    } catch (e) {
      console.error('Failed to fetch recently viewed in context', e);
    }
  };

  const refreshActivity = async () => {
    await Promise.all([fetchFavorites(), fetchRecentlyViewed()]);
  };

  useEffect(() => {
    refreshActivity();

    // Listen to local storage updates from guests
    const handleLocalUpdate = () => {
      refreshActivity();
    };

    window.addEventListener('localFavoritesUpdated', handleLocalUpdate);
    window.addEventListener('localRecentlyViewedUpdated', handleLocalUpdate);
    // Reload activity when the customer logs in/out/expires so favorites and
    // recently-viewed never belong to a previous user.
    window.addEventListener('customer-auth-changed', handleLocalUpdate);

    return () => {
      window.removeEventListener('localFavoritesUpdated', handleLocalUpdate);
      window.removeEventListener('localRecentlyViewedUpdated', handleLocalUpdate);
      window.removeEventListener('customer-auth-changed', handleLocalUpdate);
    };
  }, []);

  const toggleFavorite = async (carId: string) => {
    const isFavorited = favoriteCarIds.includes(carId);
    
    // Optimistic update
    if (isFavorited) {
      setFavoriteCarIds(prev => prev.filter(id => id !== carId));
    } else {
      setFavoriteCarIds(prev => [...prev, carId]);
    }

    try {
      const newStatus = await favoritesService.toggleFavorite(carId, isFavorited);
      // Ensure sync
      if (newStatus !== !isFavorited) {
        await fetchFavorites();
      }
      return newStatus;
    } catch (error) {
      // Revert on failure
      await fetchFavorites();
      throw error;
    }
  };

  const clearFavorites = async () => {
    setFavoriteCarIds([]);
    await favoritesService.clearAll();
  };

  const clearRecentlyViewed = async () => {
    setRecentlyViewedCars([]);
    await recentlyViewedService.clearAll();
  };

  return (
    <UserActivityContext.Provider value={{
      favoriteCarIds,
      recentlyViewedCars,
      toggleFavorite,
      refreshActivity,
      clearFavorites,
      clearRecentlyViewed
    }}>
      {children}
    </UserActivityContext.Provider>
  );
};

export const useUserActivity = () => {
  const context = useContext(UserActivityContext);
  if (context === undefined) {
    throw new Error('useUserActivity must be used within a UserActivityProvider');
  }
  return context;
};
