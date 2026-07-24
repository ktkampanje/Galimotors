import { Router } from 'express';
import { getFilterStats } from '../controllers/filterStatsController';

const router = Router();

// Public endpoint - no authentication required
router.get('/', getFilterStats);

export default router;
