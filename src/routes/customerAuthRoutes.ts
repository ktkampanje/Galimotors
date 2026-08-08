import express from 'express';
import {
  registerCustomer,
  loginCustomer,
  getCustomerProfile,
  updateCustomerProfile,
  changePassword,
  quickLoginCheck,
  refreshCustomerToken,
  logoutCustomer,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification
} from '../controllers/customerAuthController';
import { authenticateCustomer } from '../middleware/customerAuth';
import { authRateLimit, strictRateLimit } from '../middleware/security';

const router = express.Router();

// Public routes — same brute-force shield as the admin side.
router.post('/register', authRateLimit, registerCustomer);
router.post('/login', authRateLimit, loginCustomer);
router.post('/refresh', refreshCustomerToken);
router.post('/quick-check', authRateLimit, quickLoginCheck);

/**
 * Password reset and email confirmation.
 *
 * The limiter differs per endpoint on purpose. authRateLimit sets
 * skipSuccessfulRequests, so it only counts FAILED attempts — right for
 * endpoints that reject bad input (guessing a reset token), useless for
 * /forgot-password, which answers 200 to everything by design and would
 * therefore never be throttled at all. Those endpoints send mail on request,
 * so they take strictRateLimit (10 per 15 min per IP) to stop someone using
 * the form to flood a customer's inbox.
 */
router.post('/forgot-password', strictRateLimit, forgotPassword);
router.post('/reset-password', authRateLimit, resetPassword);
router.post('/verify-email', authRateLimit, verifyEmail);

// Protected routes (require authentication)
router.get('/profile', authenticateCustomer, getCustomerProfile);
router.put('/profile', authenticateCustomer, updateCustomerProfile);
router.post('/change-password', authenticateCustomer, changePassword);
router.post('/logout', authenticateCustomer, logoutCustomer);
router.post('/resend-verification', strictRateLimit, authenticateCustomer, resendVerification);

export default router;
