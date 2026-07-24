import { Router } from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
  addCategoryToCar,
  removeCategoryFromCar,
  seedCategories,
} from '../controllers/categoryController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', getCategories);

// Admin routes (must come before /:id to avoid param conflicts)
router.post('/', authenticate, authorize(['SUPER_ADMIN']), createCategory);
router.post('/seed', authenticate, authorize(['SUPER_ADMIN']), seedCategories);
router.patch('/reorder', authenticate, authorize(['SUPER_ADMIN']), reorderCategories);

// Get single category
router.get('/:id', getCategoryById);
router.patch('/:id', authenticate, authorize(['SUPER_ADMIN']), updateCategory);
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN']), deleteCategory);

export default router;
