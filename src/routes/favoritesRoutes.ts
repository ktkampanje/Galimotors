import { Router } from 'express';
import {
  addFavorite,
  removeFavorite,
  getFavorites,
  checkFavorite,
  clearFavorites,
  syncFavorites
} from '../controllers/favoritesController';
import { authenticateCustomer } from '../middleware/customerAuth';

const router = Router();

// All routes require customer authentication
router.use(authenticateCustomer);

// Get all favorites
router.get('/', getFavorites);

// Add to favorites
router.post('/', addFavorite);

// Sync local favorites
router.post('/sync', syncFavorites);

// Check if car is favorited
router.get('/check/:carId', checkFavorite);

// Remove from favorites
router.delete('/:carId', removeFavorite);

// Clear all favorites
router.delete('/', clearFavorites);

export default router;
