import { Request, Response, NextFunction } from "express";

// Sanitize string to prevent XSS attacks
export const sanitizeString = (str: string): string => {
  if (typeof str !== "string") return str;

  return str
    .replace(/[<>]/g, "") // Remove < and > to prevent HTML injection
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, "") // Remove event handlers like onclick=
    .trim();
};

// Sanitize object recursively
export const sanitizeObject = (obj: any): any => {
  if (typeof obj === "string") {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  if (obj && typeof obj === "object") {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
};

// Middleware to sanitize request body
export const sanitizeInput = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

// Validate Malawian phone number.
//
// 10 digits starting 08 or 09. Deliberately does NOT restrict the third digit:
// the old /^(099|088|098|089)\d{7}$/ allowed only four prefixes and rejected
// valid numbers as operators have issued newer ranges (095…, 086… and others).
// Real customers were being turned away at the booking form.
export const MALAWI_PHONE_LOCAL = /^0[89]\d{8}$/;
export const MALAWI_PHONE_INTERNATIONAL = /^265[89]\d{8}$/;

export const validateMalawianPhone = (phone: string): boolean => {
  return MALAWI_PHONE_LOCAL.test(phone);
};

// Sanitize and validate phone number. Returns the local 0XXXXXXXXX form, which
// is how lead phone numbers are stored, or null if unusable.
export const sanitizePhone = (phone: string): string | null => {
  if (!phone) return null;

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");

  // Normalize international format (265 9xxxxxxxx -> 09xxxxxxxx)
  const normalized = MALAWI_PHONE_INTERNATIONAL.test(cleaned)
    ? "0" + cleaned.slice(3)
    : cleaned;

  // Check if it matches Malawian format
  if (validateMalawianPhone(normalized)) {
    return normalized;
  }

  return null;
};

// SQL Injection prevention (Prisma already handles this, but extra layer)
// Patterns are intentionally narrow to avoid false-positives on legitimate car data
export const detectSqlInjection = (str: string): boolean => {
  const sqlPatterns = [
    // SQL keywords only when preceded by a quote or semicolon (actual injection context)
    /[';]\s*\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b/gi,
    // SQL block comments /* ... */
    /\/\*[\s\S]*?\*\//gi,
    // SQL Server stored procedure prefixes
    /\b(xp_|sp_)\w+/gi,
    // Classic tautology injection: ' OR '1'='1
    /'\s*(OR|AND)\s*'\w*'\s*=\s*'/gi,
  ];

  return sqlPatterns.some((pattern) => pattern.test(str));
};

// Middleware to detect SQL injection attempts
export const preventSqlInjection = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const checkValue = (value: any): boolean => {
    if (typeof value === "string") {
      return detectSqlInjection(value);
    }
    if (Array.isArray(value)) {
      return value.some((item) => checkValue(item));
    }
    if (value && typeof value === "object") {
      return Object.values(value).some((val) => checkValue(val));
    }
    return false;
  };

  if (checkValue(req.body) || checkValue(req.query) || checkValue(req.params)) {
    return res.status(400).json({
      error: "Invalid input detected",
      message: "Your request contains potentially harmful content.",
    });
  }

  next();
};
