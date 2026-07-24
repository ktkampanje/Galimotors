import { Router } from "express";
import { login, register, logout, refreshToken, getMe } from "../controllers/authController";
import { authenticate, authorize } from "../middleware/auth";
import { authRateLimit } from "../middleware/security";

const router = Router();

// Public routes — IP throttle on login (failed attempts only) backs the
// per-account lockout in the controller.
router.post("/login", authRateLimit, login);
router.post("/refresh", refreshToken);

// Protected routes
router.get("/me", authenticate, getMe);
router.post("/logout", authenticate, logout);
router.post("/register", authenticate, authorize(["SUPER_ADMIN"]), register);

export default router;
