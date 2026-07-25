// Server restarted to clear port conflict: 2026-04-11T19:10:30Z
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

// Load environment variables
dotenv.config();

import authRoutes from "./routes/authRoutes";
import carRoutes from "./routes/carRoutes";
import makerRoutes from "./routes/makerRoutes";
import modelRoutes from "./routes/modelRoutes";
import bodyTypeRoutes from "./routes/bodyTypeRoutes";
import districtRoutes from "./routes/districtRoutes";
import leadRoutes from "./routes/leadRoutes";
import settingsRoutes from "./routes/settingsRoutes";
import sellerRoutes from "./routes/sellerRoutes";
import marketRoutes from "./routes/marketRoutes";
import attendantRoutes from "./routes/attendantRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import analyticsRoutes from "./routes/analyticsRoutes";
import activityRoutes from "./routes/activityRoutes";
import seoRoutes from "./routes/seoRoutes";
import userRoutes from "./routes/userRoutes";
import customerAuthRoutes from "./routes/customerAuthRoutes";
import recentlyViewedRoutes from "./routes/recentlyViewedRoutes";
import favoritesRoutes from "./routes/favoritesRoutes";
import locationRoutes from "./routes/locationRoutes";
import filterStatsRoutes from "./routes/filterStatsRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import heroImageRoutes from "./routes/heroImageRoutes";
import metaFeedRoutes from "./routes/metaFeedRoutes";
import sellRequestRoutes from "./routes/sellRequestRoutes";
import staticPageRoutes from "./routes/staticPageRoutes";
import searchRoutes from "./routes/searchRoutes";
import { initCronJobs } from "./jobs/cronJobs";
import { getFilterStatsFromCache } from "./services/filterStatsCacheService";
import { applySqlitePragmas } from "./services/backupService";
import { bootstrapSuperAdmin } from "./services/adminBootstrap";
import prisma from "./lib/prisma";

// Security middleware
import {
  setSecurityHeaders,
  securityLogger,
  generalRateLimit,
} from "./middleware/security";
import { sanitizeInput, preventSqlInjection } from "./middleware/sanitize";
import { getCsrfToken } from "./middleware/csrf";

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Background Tasks
initCronJobs();

// ==========================================
// SECURITY MIDDLEWARE (Applied First)
// ==========================================

// Security headers
app.use(setSecurityHeaders);

// Security logging
app.use(securityLogger);

// CORS — in production, restrict to known front-end origins. The API also
// serves both SPAs from its own origin (same-origin needs no CORS), so this
// only governs any separately-hosted front-end. Dev allows all for
// convenience. Set CORS_ORIGINS as a comma-separated list at deploy time.
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header = same-origin, curl, or server-to-server: allow.
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin not allowed by CORS policy"));
    },
    credentials: true,
  }),
);

// Body parser
// Image uploads are sent as base64 JSON. Six required photos can exceed 10mb after encoding.
app.use(express.json({ limit: "50mb" }));

// Input sanitization
app.use(sanitizeInput);

// SQL injection prevention
app.use(preventSqlInjection);

// General rate limiting
app.use("/api/", generalRateLimit);

// ==========================================
// API ROUTES
// ==========================================

// Super-admin enforcement runs INSIDE the request path (memoized), not as
// module-load fire-and-forget: a serverless instance freezes the moment a
// response is sent, so a promise started at load time can be suspended
// mid-write and never complete — observed on Vercel, where the env password
// was never synced. Awaiting it here means the first request of every cold
// start cannot finish before enforcement has. Adds one bcrypt compare to
// that first request only; later requests reuse the settled promise.
let adminEnforcement: Promise<void> | null = null;
app.use((_req, _res, next) => {
  if (!adminEnforcement) {
    adminEnforcement = bootstrapSuperAdmin().catch((error) => {
      console.error("⚠️  Admin bootstrap failed:", error);
      // Allow a later request to retry rather than caching the failure.
      adminEnforcement = null;
    }) as Promise<void>;
  }
  adminEnforcement.then(() => next(), () => next());
});

// CSRF token endpoint (public)
app.get("/api/csrf-token", getCsrfToken);

app.use("/api/auth", authRoutes);
app.use("/api/customer/auth", customerAuthRoutes);
app.use("/api/customer/recently-viewed", recentlyViewedRoutes);
app.use("/api/customer/favorites", favoritesRoutes);
app.use("/api/cars", carRoutes);
app.use("/api/makers", makerRoutes);
app.use("/api/models", modelRoutes);
app.use("/api/body-types", bodyTypeRoutes);
app.use("/api/districts", districtRoutes);
app.use("/api/leads", leadRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/sellers", sellerRoutes);
app.use("/api/markets", marketRoutes);
app.use("/api/attendants", attendantRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/users", userRoutes);
app.use("/api/filter-stats", filterStatsRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/hero-images", heroImageRoutes);
app.use("/api/feeds", metaFeedRoutes);
app.use("/api/sell-requests", sellRequestRoutes);
app.use("/api/pages", staticPageRoutes);
app.use("/api/search", searchRoutes);

// SEO Routes (Dynamic Sitemap generation)
app.use("/", seoRoutes);

// Health Check (under /api)
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date(),
    security: {
      csrf: "enabled",
      rateLimit: "enabled",
      sanitization: "enabled",
      headers: "enabled",
    },
  });
});

// ==========================================
// STATIC FILE SERVING (Production)
// ==========================================

const rootDir = process.cwd();
const adminDistPath = path.resolve(rootDir, "admin-panel/dist");
const dealershipDistPath = path.resolve(rootDir, "dealership-app/dist");

console.log("📁 Root directory:", rootDir);
console.log("📁 Admin panel path:", adminDistPath);
console.log("📁 Dealership app path:", dealershipDistPath);

// Debug middleware for /admin paths
app.use((req, res, next) => {
  if (req.path.startsWith("/admin")) {
    console.log(`🔍 [DEBUG] Admin Request: ${req.method} ${req.path}`);
  }
  next();
});

// ✅ 1. Serve admin panel static ASSETS at /admin (js, css, images)
app.use("/admin", express.static(adminDistPath));

// ✅ 2. Admin SPA fallback — ALL /admin and /admin/* routes serve admin's index.html
// This MUST come before dealership static middleware
app.get(["/admin", "/admin/*"], (req, res, next) => {
  const indexPath = path.join(adminDistPath, "index.html");
  console.log(`📦 [DEBUG] Attempting to serve Admin index: ${indexPath}`);

  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error(`❌ [ERROR] Failed to send Admin index: ${err.message}`);
      next(); // Important: fall through to the next handler if this fails
    }
  });
});

// ✅ 3. Serve dealership static ASSETS at root (AFTER admin routes are claimed)
app.use(express.static(dealershipDistPath));

// ✅ 4. Dealership SPA fallback — must be last
app.get("*", (req, res) => {
  // Do not override API routes
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  // IMPORTANT: prevent dealership from catching /admin (Safety net)
  if (req.path.startsWith("/admin")) {
    const indexPath = path.join(adminDistPath, "index.html");
    console.log(`📦 [DEBUG] Catch-all Admin fallback: ${indexPath}`);
    return res.sendFile(indexPath, (err) => {
      if (err) {
        console.error(
          `❌ [ERROR] Catch-all failed to send Admin index: ${err.message}`,
        );
        res.status(404).send("Admin Panel Not Found");
      }
    });
  }

  res.sendFile(path.join(dealershipDistPath, "index.html"));
});

// ==========================================
// SERVER INITIALIZATION
// ==========================================

// Tune SQLite for live traffic (WAL mode etc.) before requests arrive
applySqlitePragmas().catch((error) => {
  console.error("⚠️  Failed to apply SQLite pragmas:", error);
});

// (Super-admin enforcement middleware is registered before the API routes —
// see the top of the API ROUTES section.)

// Initialize filter stats cache on startup
getFilterStatsFromCache()
  .then(() => {
    console.log('✅ Filter statistics cache initialized');
  })
  .catch((error) => {
    console.error('⚠️  Failed to initialize filter cache:', error);
  });

// On Vercel the app is NOT a long-lived server: api/index.js imports this
// module and hands the Express app to the platform as a serverless function.
// Listening on a port there would be meaningless (and the process-level
// shutdown handling belongs to the platform). Everything below only applies
// when running as a real server (local dev, VPS under PM2).
if (!process.env.VERCEL) {
  const server = app.listen(PORT, () => {
    console.log(
      `🚀 Malawian Brokerage System API running on http://localhost:${PORT}`,
    );
    console.log(
      `🔒 Security features enabled: CSRF, Rate Limiting, Input Sanitization, CSP Headers`,
    );
  });

  // ==========================================
  // GRACEFUL SHUTDOWN & CRASH TOLERANCE
  // ==========================================
  // Deploys restart this process while customers are mid-request. Instead of
  // cutting them off: stop accepting NEW connections, let in-flight requests
  // finish, checkpoint the WAL so dev.db is a complete file on disk, then
  // exit. A process manager (PM2/systemd) brings the new version up — the
  // visible gap is a couple of seconds.

  let shuttingDown = false;
  const shutdown = (reason: string, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n🛑 ${reason} — draining in-flight requests...`);

    server.close(async () => {
      try {
        // Fold the WAL into dev.db so the file alone is a complete database.
        await prisma.$queryRawUnsafe("PRAGMA wal_checkpoint(TRUNCATE)");
      } catch {
        /* pragma is best-effort on shutdown */
      }
      await prisma.$disconnect();
      console.log("✓ Clean shutdown complete");
      process.exit(exitCode);
    });

    // Failsafe: a stuck connection must not block the deploy forever.
    setTimeout(() => process.exit(exitCode), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM received"));
  process.on("SIGINT", () => shutdown("SIGINT received"));

  // A single failed promise somewhere must not take down the whole site
  // (Node's default since v15 is to crash the process).
  process.on("unhandledRejection", (reason) => {
    console.error("⚠️  Unhandled promise rejection (server continues):", reason);
  });

  // After an uncaught synchronous error the process state is unknown — log,
  // exit nonzero, and let the process manager restart a clean instance.
  process.on("uncaughtException", (error) => {
    console.error("💥 Uncaught exception — exiting for clean restart:", error);
    shutdown("Uncaught exception", 1);
  });
}

export default app;
