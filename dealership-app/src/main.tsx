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
