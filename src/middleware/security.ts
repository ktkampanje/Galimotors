import { Request, Response, NextFunction } from 'express';

// Content Security Policy headers
export const setSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: http:",
      "connect-src 'self' https://api.cloudinary.com https://*.neon.tech",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  );
  
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions policy
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=()'
  );
  
  // HSTS (HTTP Strict Transport Security) - only in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
  
  next();
};

// Request logging for security monitoring
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.socket.remoteAddress;
  const method = req.method;
  const path = req.path;
  const userAgent = req.headers['user-agent'];
  
  // Log suspicious activity
  const suspiciousPatterns = [
    /\.\.\//,  // Directory traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /exec\(/i, // Code execution
  ];
  
  const isSuspicious = suspiciousPatterns.some(pattern => 
    pattern.test(req.url) || 
    pattern.test(JSON.stringify(req.body)) ||
    pattern.test(JSON.stringify(req.query))
  );
  
  if (isSuspicious) {
    console.warn(`⚠️  [SECURITY] Suspicious request detected:`, {
      timestamp,
      ip,
      method,
      path,
      userAgent,
      body: req.body,
      query: req.query
    });
  }
  
  next();
};

// Rate limiting for general API endpoints
import rateLimit from 'express-rate-limit';

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased for development/demo testing
  message: {
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: 900 // seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many requests',
    message: 'Too many attempts. Please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Brute-force shield for authentication endpoints (login, register).
 *
 * `skipSuccessfulRequests` is the key: only FAILED attempts count, so a
 * legitimate user who signs in correctly never trips it, while an attacker
 * guessing passwords burns the budget fast. Pairs with the per-account
 * lockout in utils/auth (that stops one account being hammered; this stops
 * one IP hammering many accounts). Generous enough for Malawi's shared
 * carrier-NAT, where many real users share an IP.
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many attempts',
    message: 'Too many failed attempts from this network. Please wait 15 minutes and try again.',
    retryAfter: 900,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Light throttle for unauthenticated guest actions that write (quote
 * accept/decline/counter, viewing messages, payment-proof upload). These
 * are reached with an unguessable reference/id, so this only blunts spam.
 */
export const guestActionRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: {
    error: 'Too many requests',
    message: 'Too many requests. Please slow down and try again shortly.',
    retryAfter: 300,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// IP-based rate limiting for inquiries
export const inquiryRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3, // Max 3 inquiries per minute per IP
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many inquiries. Please wait a moment before trying again.',
    retryAfter: 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});
