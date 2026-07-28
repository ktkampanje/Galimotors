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
  const { status, user } = useAuth();

  if (status === 'checking') {
    return <AuthSplash />;
  }
  if (status === 'authed') {
    const role = user?.role || '';
    return <Navigate to={role === 'SELLER' || role === 'MARKET_ATTENDANT' ? '/inventory' : '/'} replace />;
  }
  return <LoginPage />;
};

/**
 * Route-level role guard. The sidebar already hides links per role, but
 * hiding a link is not access control — anyone could type the URL. A user
 * outside the allow list is bounced to their home page (sellers and
 * attendants live in /inventory; admins on the Overview).
 */
const STAFF = ['SUPER_ADMIN', 'SUB_ADMIN'];
const SUPER = ['SUPER_ADMIN'];
const FIELD = ['SUPER_ADMIN', 'SUB_ADMIN', 'SELLER', 'MARKET_ATTENDANT'];

const RoleRoute = ({ allow, children }: { allow: string[]; children: React.ReactNode }) => {
  const { user } = useAuth();
  const role = user?.role || '';
  if (!allow.includes(role)) {
    return <Navigate to={role === 'SELLER' || role === 'MARKET_ATTENDANT' ? '/inventory' : '/'} replace />;
  }
  return <>{children}</>;
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
            <Route path="/" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><AnalyticsDashboard /></Suspense></RoleRoute>} />
            <Route path="/analytics" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><AnalyticsDashboard /></Suspense></RoleRoute>} />
            <Route path="/inventory" element={<RoleRoute allow={FIELD}><Suspense fallback={<PageLoader />}><CarInventory /></Suspense></RoleRoute>} />
            <Route path="/pending-approval" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><PendingApprovalPage /></Suspense></RoleRoute>} />
            <Route path="/markets" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><MarketManager /></Suspense></RoleRoute>} />
            <Route path="/markets/:id" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><MarketDetail /></Suspense></RoleRoute>} />
            <Route path="/leads" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><LeadManagement /></Suspense></RoleRoute>} />
            <Route path="/viewings" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><ViewingsManager /></Suspense></RoleRoute>} />
            <Route path="/payments" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><PaymentVerificationQueue /></Suspense></RoleRoute>} />
            <Route path="/maker-model" element={<RoleRoute allow={SUPER}><Suspense fallback={<PageLoader />}><MakerModelManager /></Suspense></RoleRoute>} />
            <Route path="/body-type" element={<RoleRoute allow={SUPER}><Suspense fallback={<PageLoader />}><BodyTypeManager /></Suspense></RoleRoute>} />
            <Route path="/categories" element={<RoleRoute allow={SUPER}><Suspense fallback={<PageLoader />}><CategoryManager /></Suspense></RoleRoute>} />
            <Route path="/hero-images" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><HeroImagesManager /></Suspense></RoleRoute>} />
            <Route path="/sell-requests" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><SellRequestsManager /></Suspense></RoleRoute>} />
            <Route path="/content-pages" element={<RoleRoute allow={SUPER}><Suspense fallback={<PageLoader />}><ContentPages /></Suspense></RoleRoute>} />
            <Route path="/commissions" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><CommissionDashboard /></Suspense></RoleRoute>} />
            <Route path="/users" element={<RoleRoute allow={SUPER}><Suspense fallback={<PageLoader />}><UserManagement /></Suspense></RoleRoute>} />
            <Route path="/bulk" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><BulkOperations /></Suspense></RoleRoute>} />
            <Route path="/activity" element={<RoleRoute allow={SUPER}><Suspense fallback={<PageLoader />}><ActivityLog /></Suspense></RoleRoute>} />
            <Route path="/system-errors" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><SystemErrors /></Suspense></RoleRoute>} />
            <Route path="/locations" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><LocationManager /></Suspense></RoleRoute>} />
            <Route path="/settings" element={<RoleRoute allow={STAFF}><Suspense fallback={<PageLoader />}><SettingsPage /></Suspense></RoleRoute>} />
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
