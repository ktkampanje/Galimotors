import express from 'express';
import {
  registerCustomer,
  loginCustomer,
  getCustomerProfile,
  updateCustomerProfile,
  changePassword,
  quickLoginCheck,
  refreshCustomerToken,
  logoutCustomer
} from '../controllers/customerAuthController';
import { authenticateCustomer } from '../middleware/customerAuth';
import { authRateLimit } from '../middleware/security';

const router = express.Router();

// Public routes — same brute-force shield as the admin side.
router.post('/register', authRateLimit, registerCustomer);
router.post('/login', authRateLimit, loginCustomer);
router.post('/refresh', refreshCustomerToken);
router.post('/quick-check', authRateLimit, quickLoginCheck);

// Protected routes (require authentication)
router.get('/profile', authenticateCustomer, getCustomerProfile);
router.put('/profile', authenticateCustomer, updateCustomerProfile);
router.post('/change-password', authenticateCustomer, changePassword);
router.post('/logout', authenticateCustomer, logoutCustomer);

export default router;
