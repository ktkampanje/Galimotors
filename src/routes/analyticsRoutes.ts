import { Router } from 'express';
import {
  getConversionFunnel,
  getListingPerformance,
  getRevenueMetrics,
  getLeadSourceAnalytics,
  getDashboardOverview,
  exportCommissions,
  exportLeads,
  exportSalesReport
} from '../controllers/analyticsController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All analytics endpoints require authentication
router.use(authenticate);

// Dashboard overview
router.get('/dashboard', getDashboardOverview);

// Conversion funnel
router.get('/funnel', getConversionFunnel);

// Listing performance
router.get('/listings', getListingPerformance);

// Revenue and commissions
router.get('/revenue', getRevenueMetrics);

// Lead source analytics
router.get('/leads', getLeadSourceAnalytics);

// CSV Exports (admin only)
router.get('/export/commissions', authorize(['SUPER_ADMIN', 'SUB_ADMIN']), exportCommissions);
router.get('/export/leads', authorize(['SUPER_ADMIN', 'SUB_ADMIN']), exportLeads);
router.get('/export/sales', authorize(['SUPER_ADMIN', 'SUB_ADMIN']), exportSalesReport);

export default router;
