// Favorites Service for Customer
import { api } from './api';
import customerAuthService from './customerAuthService';

const LOCAL_STORAGE_KEY = 'guest_favorites';

class FavoritesService {
  // Get local favorites
  private getLocalFavorites(): string[] {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // Set local favorites
  private setLocalFavorites(favorites: string[]) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(favorites));
    // Dispatch custom event so UserActivityContext can pick it up if needed
    window.dispatchEvent(new Event('localFavoritesUpdated'));
  }

  // Add car to favorites
  async addFavorite(carId: string): Promise<void> {
    if (customerAuthService.isAuthenticated()) {
      await api.post('/customer/favorites', { carId });
    } else {
      const local = this.getLocalFavorites();
      if (!local.includes(carId)) {
        this.setLocalFavorites([...local, carId]);
      }
    }
  }

  // Remove car from favorites
  async removeFavorite(carId: string): Promise<void> {
    if (customerAuthService.isAuthenticated()) {
      await api.delete(`/customer/favorites/${carId}`);
    } else {
      const local = this.getLocalFavorites();
      this.setLocalFavorites(local.filter(id => id !== carId));
    }
  }

  // Toggle favorite status
  async toggleFavorite(carId: string, isFavorited: boolean): Promise<boolean> {
    if (isFavorited) {
      await this.removeFavorite(carId);
      return false;
    } else {
      await this.addFavorite(carId);
      return true;
    }
  }

  // Get all favorites
  async getFavorites(): Promise<any[]> {
    if (customerAuthService.isAuthenticated()) {
      const response = await api.get('/customer/favorites');
      return response.data.favorites || [];
    } else {
      const localIds = this.getLocalFavorites();
      if (localIds.length === 0) return [];
      // Fetch exactly the locally-favorited cars. The old code sent repeated
      // `id=` params the API ignored, so this returned EVERY available car
      // and the guest favorites page showed the whole inventory as liked.
      try {
        const response = await api.get('/cars', {
          params: { ids: localIds.join(','), limit: 50 },
        });
        return (response.data.cars || [])
          // Belt and braces: even if a stale/cached API ignores `ids`, never
          // present a car the guest did not actually favorite.
          .filter((car: any) => localIds.includes(car.id))
          .map((car: any) => ({
            favoriteId: car.id, // using carId as favoriteId for local
            addedAt: new Date().toISOString(),
            car
          }));
      } catch (error) {
        console.error('Failed to fetch local favorites', error);
        return [];
      }
    }
  }

  // Check if car is favorited
  async checkFavorite(carId: string): Promise<boolean> {
    if (customerAuthService.isAuthenticated()) {
      try {
        const response = await api.get(`/customer/favorites/check/${carId}`);
        return response.data.isFavorited;
      } catch (error) {
        return false;
      }
    } else {
      return this.getLocalFavorites().includes(carId);
    }
  }

  // Get just the raw IDs (fast, for context)
  async getFavoriteIds(): Promise<string[]> {
    if (!customerAuthService.isAuthenticated()) {
      return this.getLocalFavorites();
    }
    // For authenticated users, fetch full and extract IDs
    const favs = await this.getFavorites();
    return favs.map(f => f.car.id);
  }

  // Clear all favorites
  async clearAll(): Promise<void> {
    if (customerAuthService.isAuthenticated()) {
      await api.delete('/customer/favorites');
    } else {
      this.setLocalFavorites([]);
    }
  }

  // Sync local favorites to backend
  async syncLocalFavorites(): Promise<void> {
    if (!customerAuthService.isAuthenticated()) return;
    const local = this.getLocalFavorites();
    if (local.length > 0) {
      try {
        await api.post('/customer/favorites/sync', { carIds: local });
        // Clear local storage after successful sync
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch (error) {
        console.error('Failed to sync favorites', error);
      }
    }
  }
}

export default new FavoritesService();
