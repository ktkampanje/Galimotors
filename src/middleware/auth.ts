import { Request, Response, NextFunction } from "express";
import { verifyAdminToken } from "../utils/auth";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
    type: string;
  };
}

/**
 * Attach the admin identity when a valid token is present; never reject.
 *
 * For routes that serve both the public site and the admin panel (GET /cars).
 * Without this, req.user was never set on those routes, so getCars' role
 * branches — sellers restricted to their own stock, admins seeing all
 * statuses — were dead code and every caller got the public view.
 */
export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    const decoded = verifyAdminToken(token) as { userId: string; role: string; type: string } | null;
    const validAdminRoles = ["SUPER_ADMIN", "SUB_ADMIN", "SELLER", "MARKET_ATTENDANT"];
    if (decoded && decoded.type === "ADMIN" && validAdminRoles.includes(decoded.role)) {
      req.user = decoded;
    }
  }
  next();
};

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  const decoded = verifyAdminToken(token) as { userId: string; role: string; type: string } | null;

  if (!decoded) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // Security: Validate token type
  if (decoded.type !== "ADMIN") {
    return res.status(403).json({ message: "Invalid token type. Admin access required." });
  }

  // Security: Validate role is an admin role
  const validAdminRoles = ["SUPER_ADMIN", "SUB_ADMIN", "SELLER", "MARKET_ATTENDANT"];
  if (!validAdminRoles.includes(decoded.role)) {
    return res.status(403).json({ message: "Invalid role for admin access" });
  }

  req.user = decoded;
  next();
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions" });
    }
    next();
  };
};
