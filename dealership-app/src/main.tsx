import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import pwaService from './lib/pwaService'

// Initialize PWA features only in production. In development, an old service
// worker can serve stale bundles and make UI fixes look like they did not apply.
if (import.meta.env.PROD) {
  pwaService.init().catch((error) => {
    console.error('PWA initialization failed:', error);
  });

  if ('serviceWorker' in navigator) {
    // Deploys must reach customers without them doing anything. The service
    // worker activates new versions immediately (skipWaiting+clientsClaim),
    // but the RUNNING page keeps executing the old bundle until a reload —
    // previously nothing performed one, so phones stayed on stale UI for
    // days. When a NEW worker replaces an OLD one, reload once. The
    // hadController guard keeps first-ever visits (no old worker) reload-free.
    const hadController = !!navigator.serviceWorker.controller;
    let refreshed = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || refreshed) return;
      refreshed = true;
      window.location.reload();
    });

    // Check for a new version whenever the app returns to the foreground —
    // phones keep PWAs alive for days, and registration updates otherwise
    // only happen on a full navigation.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {});
      }
    });
  }
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
