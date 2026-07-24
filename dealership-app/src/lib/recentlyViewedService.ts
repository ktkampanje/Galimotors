// Recently Viewed Cars Service (Backend-based for authenticated users)
import { API_BASE_URL, api } from './api';
import customerAuthService from './customerAuthService';

const LOCAL_STORAGE_KEY = 'guest_recently_viewed';
const MAX_LOCAL_ITEMS = 20;

export interface RecentlyViewedCar {
  id: string;
  title: string;
  basePrice: number;
  year: number;
  maker?: { name: string };
  model?: { name: string };
  images: { url: string; isPrimary: boolean }[];
  isFeatured?: boolean;
  urgentSaleBadge?: boolean;
  mileage?: number;
  district?: string;
}

class RecentlyViewedService {
  // Get local recently viewed IDs
  private getLocalRecentlyViewed(): string[] {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // Set local recently viewed IDs
  private setLocalRecentlyViewed(carIds: string[]) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(carIds));
    window.dispatchEvent(new Event('localRecentlyViewedUpdated'));
  }

  // Track car view
  async trackView(carId: string): Promise<void> {
    if (customerAuthService.isAuthenticated()) {
      try {
        await fetch(`${API_BASE_URL}/customer/recently-viewed/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...customerAuthService.getAuthHeader()
          },
          body: JSON.stringify({ carId })
        });
      } catch (error) {
        console.warn('Failed to track view:', error);
      }
    } else {
      let local = this.getLocalRecentlyViewed();
      // Remove if it exists to bump it to the front
      local = local.filter(id => id !== carId);
      // Add to front
      local.unshift(carId);
      // Trim to max
      if (local.length > MAX_LOCAL_ITEMS) {
        local = local.slice(0, MAX_LOCAL_ITEMS);
      }
      this.setLocalRecentlyViewed(local);
    }
  }

  // Get recently viewed cars
  async getRecentlyViewed(limit: number = 12): Promise<RecentlyViewedCar[]> {
    if (customerAuthService.isAuthenticated()) {
      try {
        const response = await fetch(`${API_BASE_URL}/customer/recently-viewed?limit=${limit}`, {
          headers: customerAuthService.getAuthHeader()
        });

        if (!response.ok) return [];
        const data = await response.json();
        return data.recentlyViewed || [];
      } catch (error) {
        console.error('Failed to fetch recently viewed:', error);
        return [];
      }
    } else {
      let localIds = this.getLocalRecentlyViewed();
      if (localIds.length === 0) return [];
      
      // limit local ids
      localIds = localIds.slice(0, limit);

      try {
        const query = localIds.map(id => `id=${id}`).join('&');
        const response = await api.get(`/cars?${query}&limit=${limit}`);
        
        // Ensure they are returned in the same order as localIds
        const carsMap = new Map(response.data.cars.map((c: any) => [c.id, c]));
        return localIds.map(id => carsMap.get(id)).filter(Boolean) as RecentlyViewedCar[];
      } catch (error) {
        console.error('Failed to fetch local recently viewed cars', error);
        return [];
      }
    }
  }

  // Clear all recently viewed
  async clearAll(): Promise<void> {
    if (customerAuthService.isAuthenticated()) {
      try {
        await fetch(`${API_BASE_URL}/customer/recently-viewed/clear`, {
          method: 'DELETE',
          headers: customerAuthService.getAuthHeader()
        });
      } catch (error) {
        console.error('Failed to clear recently viewed:', error);
      }
    } else {
      this.setLocalRecentlyViewed([]);
    }
  }

  // Remove specific car
  async removeCar(carId: string): Promise<void> {
    if (customerAuthService.isAuthenticated()) {
      try {
        await fetch(`${API_BASE_URL}/customer/recently-viewed/${carId}`, {
          method: 'DELETE',
          headers: customerAuthService.getAuthHeader()
        });
      } catch (error) {
        console.error('Failed to remove car:', error);
      }
    } else {
      const local = this.getLocalRecentlyViewed();
      this.setLocalRecentlyViewed(local.filter(id => id !== carId));
    }
  }

  // Sync local history to backend
  async syncLocalHistory(): Promise<void> {
    if (!customerAuthService.isAuthenticated()) return;
    const local = this.getLocalRecentlyViewed();
    if (local.length > 0) {
      try {
        await fetch(`${API_BASE_URL}/customer/recently-viewed/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...customerAuthService.getAuthHeader()
          },
          body: JSON.stringify({ carIds: local.reverse() }) // oldest first to maintain correct sort after upsert
        });
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch (error) {
        console.error('Failed to sync history', error);
      }
    }
  }
}

export default new RecentlyViewedService();
