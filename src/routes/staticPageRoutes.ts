import { Router } from 'express';
import {
  getStaticPages,
  getStaticPageBySlug,
  updateStaticPage,
} from '../controllers/staticPageController';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public — the footer pages are readable by anyone.
router.get('/', getStaticPages);
router.get('/:slug', getStaticPageBySlug);

// Admin — copy is edited from the admin panel.
router.patch('/:slug', authenticate, authorize(['SUPER_ADMIN']), updateStaticPage);

export default router;
