import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from './components/AdminLayout';
import LoginPage from './pages/LoginPage';
import { AuthProvider, AuthSplash, useAuth } from './lib/AuthContext';

// Lazy load all pages for instant initial load
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard'));
const CarInventory = lazy(() => import('./pages/CarInventory'));
const PendingApprovalPage = lazy(() => import('./pages/PendingApprovalPage'));
const LeadManagement = lazy(() => import('./pages/LeadManagement'));
const PaymentVerificationQueue = lazy(() => import('./pages/PaymentVerificationQueue'));
const MakerModelManager = lazy(() => import('./pages/MakerModelManager'));
const BodyTypeManager = lazy(() => import('./pages/BodyTypeManager'));
const CategoryManager = lazy(() => import('./pages/CategoryManager'));
const HeroImagesManager = lazy(() => import('./pages/HeroImagesManager'));
const SellRequestsManager = lazy(() => import('./pages/SellRequestsManager'));
const ContentPages = lazy(() => import('./pages/ContentPages'));
const LocationManager = lazy(() => import('./pages/LocationManager'));
const MarketManager = lazy(() => import('./pages/MarketManager'));
const MarketDetail = lazy(() => import('./pages/MarketDetail.tsx'));
const CommissionDashboard = lazy(() => import('./pages/CommissionDashboard'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const BulkOperations = lazy(() => import('./pages/BulkOperations'));
const ActivityLog = lazy(() => import('./pages/ActivityLog'));
const SystemErrors = lazy(() => import('./pages/SystemErrors'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ViewingsManager = lazy(() => import('./pages/ViewingsManager'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-gray-200 border-t-coral rounded-full animate-spin" />
      <span className="text-sm font-medium text-gray-500">Loading...</span>
    </div>
  </div>
);

/**
 * Protected Route Component.
 * SECURITY: renders NOTHING from the protected tree until the server has
 * verified the session (GET /auth/me). While verification is in flight only
 * a neutral splash is shown — no layout, no navigation, no data, not even
 * for a single frame. A token's presence in localStorage is never trusted.
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { status } = useAuth();

  if (status === 'checking') {
    return <AuthSplash />;
  }
  if (status === 'guest') {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

/** Login route: an already-verified admin is sent straight to the dashboard. */
const LoginRoute = () => {
  const { status } = useAuth();

  if (status === 'checking') {
    return <AuthSplash />;
  }
  if (status === 'authed') {
    return <Navigate to="/" replace />;
  }
  return <LoginPage />;
};

import { ModalProvider } from './components/ui/ModalContext';

function App() {
  return (
    <BrowserRouter basename="/admin">
      <AuthProvider>
      <ModalProvider>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginRoute />} />
          
          <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route path="/" element={<Suspense fallback={<PageLoader />}><AnalyticsDashboard /></Suspense>} />
            <Route path="/analytics" element={<Suspense fallback={<PageLoader />}><AnalyticsDashboard /></Suspense>} />
            <Route path="/inventory" element={<Suspense fallback={<PageLoader />}><CarInventory /></Suspense>} />
            <Route path="/pending-approval" element={<Suspense fallback={<PageLoader />}><PendingApprovalPage /></Suspense>} />
            <Route path="/markets" element={<Suspense fallback={<PageLoader />}><MarketManager /></Suspense>} />
            <Route path="/markets/:id" element={<Suspense fallback={<PageLoader />}><MarketDetail /></Suspense>} />
            <Route path="/leads" element={<Suspense fallback={<PageLoader />}><LeadManagement /></Suspense>} />
            <Route path="/viewings" element={<Suspense fallback={<PageLoader />}><ViewingsManager /></Suspense>} />
            <Route path="/payments" element={<Suspense fallback={<PageLoader />}><PaymentVerificationQueue /></Suspense>} />
            <Route path="/maker-model" element={<Suspense fallback={<PageLoader />}><MakerModelManager /></Suspense>} />
            <Route path="/body-type" element={<Suspense fallback={<PageLoader />}><BodyTypeManager /></Suspense>} />
            <Route path="/categories" element={<Suspense fallback={<PageLoader />}><CategoryManager /></Suspense>} />
            <Route path="/hero-images" element={<Suspense fallback={<PageLoader />}><HeroImagesManager /></Suspense>} />
            <Route path="/sell-requests" element={<Suspense fallback={<PageLoader />}><SellRequestsManager /></Suspense>} />
            <Route path="/content-pages" element={<Suspense fallback={<PageLoader />}><ContentPages /></Suspense>} />
            <Route path="/commissions" element={<Suspense fallback={<PageLoader />}><CommissionDashboard /></Suspense>} />
            <Route path="/users" element={<Suspense fallback={<PageLoader />}><UserManagement /></Suspense>} />
            <Route path="/bulk" element={<Suspense fallback={<PageLoader />}><BulkOperations /></Suspense>} />
            <Route path="/activity" element={<Suspense fallback={<PageLoader />}><ActivityLog /></Suspense>} />
            <Route path="/system-errors" element={<Suspense fallback={<PageLoader />}><SystemErrors /></Suspense>} />
            <Route path="/locations" element={<Suspense fallback={<PageLoader />}><LocationManager /></Suspense>} />
            <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
          </Route>

          {/* Unknown paths funnel through the protected gate */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ModalProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
