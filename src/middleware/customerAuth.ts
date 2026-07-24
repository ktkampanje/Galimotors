import { Request, Response, NextFunction } from 'express';
import { verifyCustomerToken } from '../utils/auth';

interface CustomerPayload {
  customerId: string;
  type: string;
  role: string;
}

// Middleware to authenticate customer (required)
export const authenticateCustomer = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyCustomerToken(token) as CustomerPayload | null;

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Security: Validate token type
    if (decoded.type !== 'CUSTOMER') {
      return res.status(403).json({ error: 'Invalid token type. Customer access required.' });
    }

    (req as any).customer = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to optionally authenticate customer (doesn't fail if not authenticated)
export const optionalCustomerAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyCustomerToken(token) as CustomerPayload | null;

      if (decoded && decoded.type === 'CUSTOMER') {
        (req as any).customer = decoded;
      }
    }

    next();
  } catch (error) {
    // Silently fail - customer is just not authenticated
    next();
  }
};
