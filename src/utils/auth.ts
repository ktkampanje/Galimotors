import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Separate secrets for admin and customer authentication
const JWT_SECRET_ADMIN = process.env.JWT_SECRET_ADMIN || process.env.JWT_SECRET || "fallback_admin_secret_change_me";
const JWT_REFRESH_SECRET_ADMIN = process.env.JWT_REFRESH_SECRET_ADMIN || process.env.JWT_REFRESH_SECRET || "fallback_admin_refresh_secret_change_me";

const JWT_SECRET_CUSTOMER = process.env.JWT_SECRET_CUSTOMER || "fallback_customer_secret_change_me";
const JWT_REFRESH_SECRET_CUSTOMER = process.env.JWT_REFRESH_SECRET_CUSTOMER || "fallback_customer_refresh_secret_change_me";

// Security: refuse to boot in production with fallback secrets — anyone who
// reads this source could otherwise forge valid tokens.
if (process.env.NODE_ENV === "production") {
  const required = [
    "JWT_SECRET_ADMIN",
    "JWT_REFRESH_SECRET_ADMIN",
    "JWT_SECRET_CUSTOMER",
    "JWT_REFRESH_SECRET_CUSTOMER",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `FATAL: JWT secrets must be set in production. Missing: ${missing.join(", ")}`,
    );
  }
}

// Security: Track failed login attempts to prevent brute force attacks
const loginAttempts = new Map<string, { count: number; lastAttempt: number; lockedUntil?: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes window

// Security: Token blacklist for logout functionality
const tokenBlacklist = new Set<string>();

export const hashPassword = async (password: string) => {
  // Security: Use bcrypt with cost factor 12 (more secure than default 10)
  return await bcrypt.hash(password, 12);
};

export const comparePassword = async (password: string, hash: string) => {
  return await bcrypt.compare(password, hash);
};

// ==========================================
// ADMIN TOKEN FUNCTIONS
// ==========================================

export const generateAdminToken = (payload: { userId: string; role: string }) => {
  // Security: Short-lived access tokens (1 hour)
  return jwt.sign({ ...payload, type: "ADMIN" }, JWT_SECRET_ADMIN, { expiresIn: "1h" });
};

export const generateAdminRefreshToken = (payload: { userId: string; role: string }) => {
  // Security: Longer-lived refresh tokens (7 days)
  return jwt.sign({ ...payload, type: "ADMIN" }, JWT_REFRESH_SECRET_ADMIN, { expiresIn: "7d" });
};

export const verifyAdminToken = (token: string) => {
  try {
    // Security: Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      return null;
    }
    const decoded = jwt.verify(token, JWT_SECRET_ADMIN) as any;
    
    // Security: Validate token type
    if (decoded.type !== "ADMIN") {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
};

export const verifyAdminRefreshToken = (token: string) => {
  try {
    if (tokenBlacklist.has(token)) {
      return null;
    }
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET_ADMIN) as any;
    
    // Security: Validate token type
    if (decoded.type !== "ADMIN") {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
};

// ==========================================
// CUSTOMER TOKEN FUNCTIONS
// ==========================================

export const generateCustomerToken = (payload: { customerId: string }) => {
  // Security: Short-lived access tokens (1 hour)
  return jwt.sign({ ...payload, type: "CUSTOMER", role: "CUSTOMER" }, JWT_SECRET_CUSTOMER, { expiresIn: "1h" });
};

export const generateCustomerRefreshToken = (payload: { customerId: string }) => {
  // Security: Longer-lived refresh tokens (7 days)
  return jwt.sign({ ...payload, type: "CUSTOMER", role: "CUSTOMER" }, JWT_REFRESH_SECRET_CUSTOMER, { expiresIn: "7d" });
};

export const verifyCustomerToken = (token: string) => {
  try {
    // Security: Check if token is blacklisted
    if (tokenBlacklist.has(token)) {
      return null;
    }
    const decoded = jwt.verify(token, JWT_SECRET_CUSTOMER) as any;
    
    // Security: Validate token type
    if (decoded.type !== "CUSTOMER") {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
};

export const verifyCustomerRefreshToken = (token: string) => {
  try {
    if (tokenBlacklist.has(token)) {
      return null;
    }
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET_CUSTOMER) as any;
    
    // Security: Validate token type
    if (decoded.type !== "CUSTOMER") {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
};

// ==========================================
// LEGACY FUNCTIONS (for backward compatibility)
// ==========================================

export const generateToken = generateAdminToken;
export const generateRefreshToken = generateAdminRefreshToken;
export const verifyToken = verifyAdminToken;
export const verifyRefreshToken = verifyAdminRefreshToken;

export const blacklistToken = (token: string) => {
  tokenBlacklist.add(token);
  // Security: Auto-cleanup after token expiry (1 hour)
  setTimeout(() => tokenBlacklist.delete(token), 60 * 60 * 1000);
};

// Security: Rate limiting for login attempts
export const checkLoginAttempts = (identifier: string): { allowed: boolean; remainingAttempts?: number; lockedUntil?: number } => {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);

  if (!attempts) {
    return { allowed: true };
  }

  // Check if account is locked
  if (attempts.lockedUntil && now < attempts.lockedUntil) {
    return { 
      allowed: false, 
      lockedUntil: attempts.lockedUntil 
    };
  }

  // Reset if outside attempt window
  if (now - attempts.lastAttempt > ATTEMPT_WINDOW) {
    loginAttempts.delete(identifier);
    return { allowed: true };
  }

  // Check if max attempts reached
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    const lockedUntil = now + LOCKOUT_DURATION;
    loginAttempts.set(identifier, { ...attempts, lockedUntil });
    return { 
      allowed: false, 
      lockedUntil 
    };
  }

  return { 
    allowed: true, 
    remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts.count 
  };
};

export const recordFailedLogin = (identifier: string) => {
  const now = Date.now();
  const attempts = loginAttempts.get(identifier);

  if (!attempts || now - attempts.lastAttempt > ATTEMPT_WINDOW) {
    loginAttempts.set(identifier, { count: 1, lastAttempt: now });
  } else {
    loginAttempts.set(identifier, { 
      count: attempts.count + 1, 
      lastAttempt: now 
    });
  }
};

export const clearLoginAttempts = (identifier: string) => {
  loginAttempts.delete(identifier);
};

// Security: Generate secure random tokens for password reset, etc.
export const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Security: Validate password strength
export const validatePasswordStrength = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("Password must contain at least one special character");
  }

  return { valid: errors.length === 0, errors };
};

// Security: Sanitize email to prevent injection
export const sanitizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};
