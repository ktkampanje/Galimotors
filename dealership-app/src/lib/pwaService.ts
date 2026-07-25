// PWA Service for offline functionality and app-like features

interface OfflineInquiry {
  id: string;
  data: any;
  timestamp: number;
}

class PWAService {
  private dbName = 'GaliMotorsDB';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  // Initialize PWA features. Service worker registration is handled by
  // vite-plugin-pwa's PWAUpdater component to avoid duplicate registrations.
  async init() {
    await this.initDB();
    this.setupInstallPrompt();
    this.setupOfflineDetection();
  }

  // Register service worker
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');

        // Listen for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.showUpdateNotification();
              }
            });
          }
        });
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  // Initialize IndexedDB for offline storage
  async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = () => {
        const db = request.result;

        // Create object stores
        if (!db.objectStoreNames.contains('inquiries')) {
          db.createObjectStore('inquiries', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('favorites')) {
          db.createObjectStore('favorites', { keyPath: 'carId' });
        }

        if (!db.objectStoreNames.contains('searches')) {
          db.createObjectStore('searches', { keyPath: 'id' });
        }
      };
    });
  }

  // Save inquiry for offline sync
  async saveOfflineInquiry(inquiryData: any): Promise<string> {
    const inquiry: OfflineInquiry = {
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data: inquiryData,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['inquiries'], 'readwrite');
      const store = transaction.objectStore('inquiries');
      const request = store.add(inquiry);

      request.onsuccess = () => {
        resolve(inquiry.id);

        // Request background sync
        this.requestBackgroundSync('inquiry-sync');
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Request background sync
  async requestBackgroundSync(tag: string) {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        const registration = await navigator.serviceWorker.ready;
        // Background Sync is not in TypeScript's DOM lib yet; the feature
        // check above guards real availability.
        await (registration as ServiceWorkerRegistration & { sync: { register(tag: string): Promise<void> } }).sync.register(tag);
      } catch (error) {
        console.error('Background sync failed:', error);
      }
    }
  }

  // Save car to favorites (offline)
  async saveFavorite(car: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['favorites'], 'readwrite');
      const store = transaction.objectStore('favorites');
      const request = store.put({
        carId: car.id,
        car: car,
        savedAt: Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get favorites
  async getFavorites(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['favorites'], 'readonly');
      const store = transaction.objectStore('favorites');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  // Remove from favorites
  async removeFavorite(carId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['favorites'], 'readwrite');
      const store = transaction.objectStore('favorites');
      const request = store.delete(carId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Setup install prompt
  setupInstallPrompt() {
    let deferredPrompt: any = null;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      this.showInstallButton();
    });

    // Handle install button click
    (window as any).installApp = async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        this.hideInstallButton();
      }
    };
  }

  // Show install button
  showInstallButton() {
    const installButton = document.getElementById('install-button');
    if (installButton) {
      installButton.style.display = 'block';
    } else {
      // Create install button if it doesn't exist
      const button = document.createElement('button');
      button.id = 'install-button';
      button.innerHTML = '📱 Install App';
      button.className = 'fixed bottom-4 right-4 bg-coral text-white px-4 py-2 rounded-lg shadow-lg z-50 font-bold text-sm';
      button.onclick = () => (window as any).installApp();
      document.body.appendChild(button);
    }
  }

  // Hide install button
  hideInstallButton() {
    const installButton = document.getElementById('install-button');
    if (installButton) {
      installButton.style.display = 'none';
    }
  }

  // Setup offline detection
  setupOfflineDetection() {
    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine;
      const statusElement = document.getElementById('offline-status');

      if (!isOnline) {
        if (!statusElement) {
          const div = document.createElement('div');
          div.id = 'offline-status';
          div.className = 'fixed top-0 left-0 right-0 bg-yellow-500 text-white text-center py-2 z-50 font-bold text-sm';
          div.innerHTML = '📡 You are offline. Some features may be limited.';
          document.body.appendChild(div);
        }
      } else {
        if (statusElement) {
          statusElement.remove();
        }
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus(); // Check initial status
  }

  // Show update notification
  showUpdateNotification() {
    const notification = document.createElement('div');
    notification.className = 'fixed bottom-4 left-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg z-50 max-w-sm';
    notification.innerHTML = `
      <div class="font-bold mb-2">App Update Available</div>
      <div class="text-sm mb-3">A new version is available. Refresh to update.</div>
      <button onclick="window.location.reload()" class="bg-white text-blue-500 px-3 py-1 rounded font-bold text-sm mr-2">Update</button>
      <button onclick="this.parentElement.remove()" class="text-white underline text-sm">Later</button>
    `;
    document.body.appendChild(notification);

    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 10000);
  }

  // Check if app is running as PWA
  isPWA(): boolean {
    return window.matchMedia('(display-mode: standalone)').matches ||
           (window.navigator as any).standalone ||
           document.referrer.includes('android-app://');
  }

  // Get network status
  getNetworkStatus() {
    return {
      online: navigator.onLine,
      connection: (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection,
      effectiveType: ((navigator as any).connection || {}).effectiveType || 'unknown'
    };
  }

  // Preload critical resources
  async preloadCriticalResources() {
    const criticalUrls = [
      '/api/makers',
      '/api/body-types',
      '/api/cars?limit=20'
    ];

    for (const url of criticalUrls) {
      try {
        await fetch(url);
      } catch (error) {
        console.warn('Failed to preload:', url, error);
      }
    }
  }
}

export default new PWAService();
