import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Simple CSRF token generation and validation
// In production, consider using 'csurf' package for more robust protection

const CSRF_SECRET = process.env.CSRF_SECRET || 'galimotors-csrf-secret-change-in-production';

// Generate CSRF token
export const generateCsrfToken = (): string => {
  return crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(crypto.randomBytes(32).toString('hex'))
    .digest('hex');
};

// Validate CSRF token
export const validateCsrfToken = (token: string): boolean => {
  if (!token) return false;
  // In a simple implementation, we just check if token exists and has correct format
  // For production, implement proper token validation with expiry
  return token.length === 64 && /^[a-f0-9]+$/.test(token);
};

// CSRF middleware for state-changing operations
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // Skip CSRF for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for authenticated API calls (JWT provides protection)
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return next();
  }

  const token = req.headers['x-csrf-token'] as string || req.body._csrf;

  if (!validateCsrfToken(token)) {
    return res.status(403).json({ 
      error: 'Invalid CSRF token',
      message: 'CSRF validation failed. Please refresh and try again.'
    });
  }

  next();
};

// Endpoint to get CSRF token
export const getCsrfToken = (req: Request, res: Response) => {
  const token = generateCsrfToken();
  res.json({ csrfToken: token });
};
