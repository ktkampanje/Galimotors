import express from 'express';
import {
  trackCarView,
  getRecentlyViewed,
  clearRecentlyViewed,
  removeFromRecentlyViewed,
  syncRecentlyViewed
} from '../controllers/recentlyViewedController';
import { authenticateCustomer } from '../middleware/customerAuth';

const router = express.Router();

// All routes require authentication
router.post('/track', authenticateCustomer, trackCarView);
router.post('/sync', authenticateCustomer, syncRecentlyViewed);
router.get('/', authenticateCustomer, getRecentlyViewed);
router.delete('/clear', authenticateCustomer, clearRecentlyViewed);
router.delete('/:carId', authenticateCustomer, removeFromRecentlyViewed);

export default router;
