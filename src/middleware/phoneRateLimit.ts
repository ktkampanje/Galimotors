import { Request, Response, NextFunction } from 'express';

// In-memory store for phone number rate limiting
// In production, use Redis for distributed rate limiting
interface PhoneRateLimitEntry {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

const phoneRateLimitStore = new Map<string, PhoneRateLimitEntry>();

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [phone, entry] of phoneRateLimitStore.entries()) {
    if (now - entry.lastAttempt > oneHour) {
      phoneRateLimitStore.delete(phone);
    }
  }
}, 10 * 60 * 1000);

// Phone number rate limiting configuration
const PHONE_RATE_LIMIT = {
  maxInquiriesPerHour: 5, // Max 5 inquiries per hour per phone
  maxInquiriesPer10Min: 3, // Max 3 inquiries per 10 minutes per phone
  windowMs: 60 * 60 * 1000, // 1 hour
  shortWindowMs: 10 * 60 * 1000, // 10 minutes
};

// Check if phone number should show CAPTCHA
export const shouldShowCaptcha = (phone: string): boolean => {
  const entry = phoneRateLimitStore.get(phone);
  if (!entry) return false;
  
  const now = Date.now();
  const timeSinceFirst = now - entry.firstAttempt;
  
  // Show CAPTCHA on 3rd inquiry within 10 minutes
  if (timeSinceFirst < PHONE_RATE_LIMIT.shortWindowMs && entry.count >= 3) {
    return true;
  }
  
  return false;
};

// Phone rate limiting middleware
export const phoneRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const phone = req.body.buyerPhone || req.body.phone;
  
  if (!phone) {
    return res.status(400).json({ 
      error: 'Phone number required',
      message: 'Please provide a valid phone number.'
    });
  }
  
  const now = Date.now();
  let entry = phoneRateLimitStore.get(phone);
  
  // Initialize entry if doesn't exist
  if (!entry) {
    entry = {
      count: 0,
      firstAttempt: now,
      lastAttempt: now
    };
    phoneRateLimitStore.set(phone, entry);
  }
  
  // Reset counter if outside the window
  if (now - entry.firstAttempt > PHONE_RATE_LIMIT.windowMs) {
    entry.count = 0;
    entry.firstAttempt = now;
  }
  
  // Check short window (10 minutes)
  const timeSinceFirst = now - entry.firstAttempt;
  if (timeSinceFirst < PHONE_RATE_LIMIT.shortWindowMs) {
    if (entry.count >= PHONE_RATE_LIMIT.maxInquiriesPer10Min) {
      // Check if CAPTCHA was provided and validated
      const captchaToken = req.body.captchaToken || req.headers['x-captcha-token'];
      
      if (!captchaToken) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'Too many inquiries. Please complete CAPTCHA to continue.',
          requiresCaptcha: true,
          retryAfter: Math.ceil((PHONE_RATE_LIMIT.shortWindowMs - timeSinceFirst) / 1000)
        });
      }
      
      // Validate CAPTCHA (simplified - in production use Google reCAPTCHA)
      if (!validateCaptcha(captchaToken)) {
        return res.status(400).json({
          error: 'Invalid CAPTCHA',
          message: 'CAPTCHA validation failed. Please try again.',
          requiresCaptcha: true
        });
      }
    }
  }
  
  // Check hourly limit
  if (entry.count >= PHONE_RATE_LIMIT.maxInquiriesPerHour) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Maximum ${PHONE_RATE_LIMIT.maxInquiriesPerHour} inquiries per hour reached. Please try again later.`,
      retryAfter: Math.ceil((PHONE_RATE_LIMIT.windowMs - timeSinceFirst) / 1000)
    });
  }
  
  // Increment counter
  entry.count++;
  entry.lastAttempt = now;
  
  // Add flag to request if CAPTCHA should be shown on next attempt
  if (entry.count >= 2) {
    (req as any).showCaptchaWarning = true;
  }
  
  next();
};

// Simple CAPTCHA validation (in production, use Google reCAPTCHA)
const validateCaptcha = (token: string): boolean => {
  // TODO: Implement Google reCAPTCHA validation
  // For now, accept any non-empty token
  return !!token && token.length > 10;
};

// Get rate limit info for a phone number
export const getRateLimitInfo = (phone: string) => {
  const entry = phoneRateLimitStore.get(phone);
  if (!entry) {
    return {
      count: 0,
      remaining: PHONE_RATE_LIMIT.maxInquiriesPerHour,
      requiresCaptcha: false
    };
  }
  
  const now = Date.now();
  const timeSinceFirst = now - entry.firstAttempt;
  
  return {
    count: entry.count,
    remaining: Math.max(0, PHONE_RATE_LIMIT.maxInquiriesPerHour - entry.count),
    requiresCaptcha: shouldShowCaptcha(phone),
    resetIn: Math.ceil((PHONE_RATE_LIMIT.windowMs - timeSinceFirst) / 1000)
  };
};
