import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { useState, useEffect } from 'react';
import { Navbar } from './components/Structural';
import ScrollToTop from './components/ScrollToTop';
import { MetaPixelManager } from './components/MetaPixelManager';
import HomePage from './pages/HomePage';
import StaticPage from './pages/StaticPage';
import BookViewing from './pages/BookViewing';
import SellYourCar from './pages/SellYourCar';
import CarDetailSEO from './pages/CarDetailSEO';
import FavoritesPage from './pages/FavoritesPage';
import RecentlyViewedPage from './pages/RecentlyViewedPage';
import CustomerDashboard from './pages/CustomerDashboard';
import QuoteView from './pages/QuoteView';
import ViewingView from './pages/ViewingView';
import PWAUpdater from './components/PWAUpdater';
import { LoginModal } from './components/LoginModal';
import { RegisterModal } from './components/RegisterModal';
import { QuickLoginPrompt } from './components/QuickLoginPrompt';

import { ModalProvider } from './components/ui/ModalContext';
import { UserActivityProvider } from './components/UserActivityContext';
import { CustomerAuthProvider } from './lib/CustomerAuthContext';

// Legacy /car/:id URLs redirect to the SEO route; CarDetailSEO resolves the car
// by uuid prefix and replaces the placeholder slugs itself.
const LegacyCarRedirect = () => {
  const { id } = useParams();
  return <Navigate to={`/cars/unknown/unknown/${(id || '').split('-')[0]}`} replace />;
};

function App() {
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);

  useEffect(() => {
    // Make the auth modals available globally for the navbar and for pages
    // that gate on an account (e.g. /book-viewing).
    (window as any).openLoginModal = () => setLoginModalOpen(true);
    (window as any).openRegisterModal = () => setRegisterModalOpen(true);

    return () => {
      delete (window as any).openLoginModal;
      delete (window as any).openRegisterModal;
    };
  }, []);

  const handleSwitchToRegister = () => {
    setLoginModalOpen(false);
    setRegisterModalOpen(true);
  };

  const handleSwitchToLogin = () => {
    setRegisterModalOpen(false);
    setLoginModalOpen(true);
  };

  return (
    <HelmetProvider>
      <BrowserRouter>
        <CustomerAuthProvider>
        <ModalProvider>
          <div className="bg-white min-h-screen">
          <ScrollToTop />
          <MetaPixelManager />
          <PWAUpdater />
          <Navbar />
          
          {/* Auth Modals */}
          <LoginModal
            isOpen={loginModalOpen}
            onClose={() => setLoginModalOpen(false)}
            onSwitchToRegister={handleSwitchToRegister}
          />
          <RegisterModal
            isOpen={registerModalOpen}
            onClose={() => setRegisterModalOpen(false)}
            onSwitchToLogin={handleSwitchToLogin}
          />
          
          {/* Quick Login Prompt */}
          <QuickLoginPrompt onLoginClick={() => setLoginModalOpen(true)} />
          
          <UserActivityProvider>
            <Routes>
              {/* Homepage with featured cars */}
              <Route path="/" element={<HomePage />} />
              {/* Browse/filter page with all filters (same as homepage with instant on-page filtering) */}
              <Route path="/cars" element={<HomePage />} />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/recently-viewed" element={<RecentlyViewedPage />} />
              <Route path="/dashboard" element={<CustomerDashboard />} />
              {/* Quote view page (public - no login required) */}
              <Route path="/quote/:reference" element={<QuoteView />} />
              {/* Viewing view page (public - no login required) */}
              <Route path="/viewing/:reference" element={<ViewingView />} />
              {/* SEO-friendly car detail routes */}
              <Route path="/cars/:makerSlug/:modelSlug/:uuidShort" element={<CarDetailSEO />} />
              {/* Viewing booking is a page, not a modal — it takes payment and
                  benefits from a real URL and a working back button. */}
              <Route path="/book-viewing/:uuidShort" element={<BookViewing />} />
              <Route path="/sell" element={<SellYourCar />} />
              {/* Legacy route for backward compatibility */}
              <Route path="/car/:id" element={<LegacyCarRedirect />} />
              {/* Footer/support pages — copy is edited in the admin panel.
                  Slugs match the StaticPage records seeded in the database. */}
              <Route path="/how-to-buy" element={<StaticPage slug="how-to-buy" />} />
              <Route path="/import-services" element={<StaticPage slug="import-services" />} />
              <Route path="/faqs" element={<StaticPage slug="faqs" />} />
              <Route path="/terms" element={<StaticPage slug="terms" />} />
              <Route path="/privacy" element={<StaticPage slug="privacy" />} />
              <Route path="*" element={<div className="h-screen flex items-center justify-center p-20 text-center font-bold text-dark bg-white">404 - Not Found</div>} />
            </Routes>
          </UserActivityProvider>
        </div>
      </ModalProvider>
        </CustomerAuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;
