import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { 
  comparePassword, 
  hashPassword, 
  generateAdminToken, 
  generateAdminRefreshToken,
  verifyAdminRefreshToken,
  blacklistToken,
  checkLoginAttempts,
  recordFailedLogin,
  clearLoginAttempts,
  validatePasswordStrength,
  sanitizeEmail
} from "../utils/auth";

// Security: Login with rate limiting and brute force protection
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Security: Input validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const sanitizedEmail = sanitizeEmail(email);

    // Security: Check for brute force attempts
    const attemptCheck = checkLoginAttempts(sanitizedEmail);
    if (!attemptCheck.allowed) {
      const minutesLeft = Math.ceil((attemptCheck.lockedUntil! - Date.now()) / 60000);
      return res.status(429).json({ 
        message: `Too many failed login attempts. Account locked for ${minutesLeft} minutes.`,
        lockedUntil: attemptCheck.lockedUntil
      });
    }

    // Security: Find user
    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    });

    // Security: Generic error message to prevent user enumeration
    if (!user || !(await comparePassword(password, user.password))) {
      recordFailedLogin(sanitizedEmail);
      const remaining = attemptCheck.remainingAttempts ? attemptCheck.remainingAttempts - 1 : MAX_LOGIN_ATTEMPTS - 1;
      return res.status(401).json({ 
        message: "Invalid credentials",
        remainingAttempts: remaining > 0 ? remaining : 0
      });
    }

    // Security: Clear failed attempts on successful login
    clearLoginAttempts(sanitizedEmail);

    // Security: Generate ADMIN tokens
    const accessToken = generateAdminToken({ userId: user.id, role: user.role });
    const refreshToken = generateAdminRefreshToken({ userId: user.id, role: user.role });

    // Security: Log successful login (for audit trail)
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "LOGIN",
        entityType: "User",
        entityId: user.id,
        ipAddress: req.ip || req.socket.remoteAddress || "unknown",
        userAgent: req.headers["user-agent"] || "unknown"
      }
    });

    res.json({ 
      accessToken, 
      refreshToken,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        role: user.role 
      } 
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed. Please try again." });
  }
};

// Security: Server-side session verification — the admin frontend gates ALL
// rendering on this endpoint so a forged/expired token never opens the UI.
export const getMe = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });

    if (!user) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: "Failed to verify session" });
  }
};

// Security: Logout with token blacklisting
export const logout = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      blacklistToken(token);
    }
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: "Logout failed" });
  }
};

// Security: Refresh token endpoint
export const refreshToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: "Refresh token required" });
    }

    const decoded = verifyAdminRefreshToken(refreshToken) as { userId: string; role: string } | null;

    if (!decoded) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // Security: Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Security: Generate new ADMIN tokens
    const newAccessToken = generateAdminToken({ userId: user.id, role: user.role });
    const newRefreshToken = generateAdminRefreshToken({ userId: user.id, role: user.role });

    // Security: Blacklist old refresh token
    blacklistToken(refreshToken);

    res.json({ 
      accessToken: newAccessToken, 
      refreshToken: newRefreshToken 
    });
  } catch (error) {
    res.status(500).json({ message: "Token refresh failed" });
  }
};

// Security: Register with password strength validation
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = req.body;

    // Security: Input validation
    if (!email || !password || !name) {
      return res.status(400).json({ message: "Email, password, and name are required" });
    }

    const sanitizedEmail = sanitizeEmail(email);

    // Security: Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        message: "Password does not meet security requirements",
        errors: passwordValidation.errors
      });
    }

    // Security: Check if user exists
    const existingUser = await prisma.user.findUnique({ 
      where: { email: sanitizedEmail } 
    });
    
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Security: Hash password with strong algorithm
    const hashedPassword = await hashPassword(password);
    
    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        password: hashedPassword,
        name,
        role: role || "SUB_ADMIN",
      },
    });

    // Security: Generate ADMIN tokens
    const accessToken = generateAdminToken({ userId: user.id, role: user.role });
    const refreshToken = generateAdminRefreshToken({ userId: user.id, role: user.role });

    // Security: Log registration
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "REGISTER",
        entityType: "User",
        entityId: user.id,
        ipAddress: req.ip || req.socket.remoteAddress || "unknown",
        userAgent: req.headers["user-agent"] || "unknown"
      }
    });

    res.status(201).json({ 
      accessToken, 
      refreshToken,
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email,
        role: user.role 
      } 
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed. Please try again." });
  }
};

const MAX_LOGIN_ATTEMPTS = 5;
