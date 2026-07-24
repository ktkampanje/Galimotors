import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import {
  generateCustomerToken,
  generateCustomerRefreshToken,
  verifyCustomerRefreshToken,
  hashPassword,
  comparePassword,
  sanitizeEmail,
  blacklistToken,
  checkLoginAttempts,
  recordFailedLogin,
  clearLoginAttempts,
} from "../utils/auth";
import { sanitizePhone } from "../middleware/sanitize";

const getCustomerId = (req: Request) =>
  (req as any).customer?.customerId || (req as any).customer?.id;

// Register new customer
export const registerCustomer = async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone, district } = req.body;

    // Validate required fields. Phone is mandatory: leads, viewings and all
    // follow-up contact run on WhatsApp, so an account without a phone number
    // cannot actually be reached.
    if (!email || !password || !name || !phone) {
      return res
        .status(400)
        .json({ error: "Email, password, name and phone number are required" });
    }

    // Normalised to local 0XXXXXXXXX form — same as lead phone storage.
    const sanitizedPhone = sanitizePhone(String(phone));
    if (!sanitizedPhone) {
      return res.status(400).json({
        error:
          "Invalid Malawian phone number. Enter 10 digits starting with 08 or 09, e.g. 0952456789.",
      });
    }

    // Security: server-side password policy (client validation is not security)
    if (typeof password !== "string" || password.length < 8) {
      return res
        .status(400)
        .json({ error: "Password must be at least 8 characters long" });
    }

    // Check if customer already exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingCustomer) {
      return res.status(400).json({ error: "Email already registered" });
    }

    // Hash password using secure method
    const hashedPassword = await hashPassword(password);

    // Create customer
    const customer = await prisma.customer.create({
      data: {
        email: sanitizeEmail(email),
        password: hashedPassword,
        name,
        phone: sanitizedPhone,
        district: district || null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        district: true,
        createdAt: true,
      },
    });

    // Claim guest history. Guests inquire and book viewings with just a
    // phone number; the phone is the identity that links them to those
    // leads when they later create an account. Both sides store the
    // normalised local 0XXXXXXXXX form, so this is an exact match.
    let claimedLeads = 0;
    try {
      const claimed = await prisma.lead.updateMany({
        where: { customerId: null, buyerPhone: sanitizedPhone },
        data: { customerId: customer.id },
      });
      claimedLeads = claimed.count;
    } catch (claimError) {
      // Claiming is best-effort; never fail a registration over it.
      console.error("Failed to claim guest leads for new customer:", claimError);
    }

    // Generate CUSTOMER tokens
    const accessToken = generateCustomerToken({ customerId: customer.id });
    const refreshToken = generateCustomerRefreshToken({
      customerId: customer.id,
    });

    res.status(201).json({
      message: "Registration successful",
      customer,
      claimedLeads,
      token: accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Customer registration error:", error);
    res.status(500).json({ error: "Registration failed" });
  }
};

// Login customer
export const loginCustomer = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const sanitizedEmail = sanitizeEmail(email);

    // Security: brute-force protection (same machinery as admin login)
    const attemptCheck = checkLoginAttempts(`customer:${sanitizedEmail}`);
    if (!attemptCheck.allowed) {
      const minutesLeft = Math.ceil((attemptCheck.lockedUntil! - Date.now()) / 60000);
      return res.status(429).json({
        error: `Too many failed login attempts. Try again in ${minutesLeft} minutes.`,
      });
    }

    // Find customer
    const customer = await prisma.customer.findUnique({
      where: { email: sanitizedEmail },
    });

    // Security: generic error + failed-attempt tracking (no user enumeration)
    if (!customer || !(await comparePassword(password, customer.password))) {
      recordFailedLogin(`customer:${sanitizedEmail}`);
      return res.status(401).json({ error: "Invalid email or password" });
    }

    clearLoginAttempts(`customer:${sanitizedEmail}`);

    // Generate CUSTOMER tokens
    const accessToken = generateCustomerToken({ customerId: customer.id });
    const refreshToken = generateCustomerRefreshToken({
      customerId: customer.id,
    });

    res.json({
      message: "Login successful",
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        district: customer.district,
      },
      token: accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Customer login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

// Get current customer profile
export const getCustomerProfile = async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        district: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(customer);
  } catch (error) {
    console.error("Get customer profile error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

// Update customer profile
export const updateCustomerProfile = async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);
    const { name, phone, district } = req.body;

    // A provided phone must be valid — otherwise a profile edit could
    // overwrite the mandatory registration number with junk.
    let sanitizedPhone: string | undefined;
    if (phone) {
      const cleaned = sanitizePhone(String(phone));
      if (!cleaned) {
        return res.status(400).json({
          error:
            "Invalid Malawian phone number. Enter 10 digits starting with 08 or 09, e.g. 0952456789.",
        });
      }
      sanitizedPhone = cleaned;
    }

    // A newly added phone also claims any guest leads made with it.
    if (sanitizedPhone) {
      try {
        await prisma.lead.updateMany({
          where: { customerId: null, buyerPhone: sanitizedPhone },
          data: { customerId },
        });
      } catch (claimError) {
        console.error("Failed to claim guest leads on profile update:", claimError);
      }
    }

    const customer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        ...(name && { name }),
        ...(sanitizedPhone && { phone: sanitizedPhone }),
        ...(district && { district }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        district: true,
        createdAt: true,
      },
    });

    res.json({
      message: "Profile updated successfully",
      customer,
    });
  } catch (error) {
    console.error("Update customer profile error:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

// Change password
export const changePassword = async (req: Request, res: Response) => {
  try {
    const customerId = getCustomerId(req);
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ error: "Current and new password are required" });
    }

    // Get customer with password
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Verify current password
    const isValidPassword = await comparePassword(
      currentPassword,
      customer.password,
    );

    if (!isValidPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await prisma.customer.update({
      where: { id: customerId },
      data: { password: hashedPassword },
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
};

// Quick login check (for auto-login prompt).
// Security: returns ONLY a boolean — never names or emails — so this cannot
// be used as an account-enumeration/phishing oracle. The prompt UI derives
// the display name from data already stored on the customer's own device.
export const quickLoginCheck = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const customer = await prisma.customer.findUnique({
      where: { email: sanitizeEmail(email) },
      select: { id: true },
    });

    res.json({ exists: !!customer });
  } catch (error) {
    console.error("Quick login check error:", error);
    res.status(500).json({ error: "Check failed" });
  }
};

// Security: refresh endpoint — rotates the customer token pair so sessions
// survive past the 1h access-token expiry without re-login.
export const refreshCustomerToken = async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    const decoded = verifyCustomerRefreshToken(refreshToken) as { customerId: string } | null;

    if (!decoded) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: decoded.customerId },
      select: { id: true, email: true, name: true, phone: true, district: true },
    });

    if (!customer) {
      return res.status(401).json({ error: "Account no longer exists" });
    }

    const newAccessToken = generateCustomerToken({ customerId: customer.id });
    const newRefreshToken = generateCustomerRefreshToken({ customerId: customer.id });

    // Rotate: the old refresh token can never be reused
    blacklistToken(refreshToken);

    res.json({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      customer,
    });
  } catch (error) {
    console.error("Customer token refresh error:", error);
    res.status(500).json({ error: "Token refresh failed" });
  }
};

// Security: logout with token blacklisting (server-side revocation)
export const logoutCustomer = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (token) {
      blacklistToken(token);
    }
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ error: "Logout failed" });
  }
};
