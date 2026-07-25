import { Router } from "express";
import { runSoldCarsCleanup } from "../jobs/soldCarsCleanupJob";
import { runReservationExpiry } from "../jobs/reservationExpiryJob";
import { updateFilterStatsCache } from "../services/filterStatsCacheService";
import { logServerError, pruneOldErrors } from "../services/errorLogService";

/**
 * Scheduled maintenance for serverless hosting.
 *
 * node-cron never fires on Vercel (no always-on process), so without this the
 * sold-car Cloudinary cleanup and reservation expiry simply do not happen in
 * production. vercel.json schedules a daily GET /api/cron/daily; Vercel sends
 * it with `Authorization: Bearer <CRON_SECRET>` automatically when that env
 * var is set on the project — the same guard keeps strangers out.
 */
const router = Router();

const guard = (req: any, res: any): boolean => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    res.status(503).json({ message: "CRON_SECRET is not configured on the server" });
    return false;
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }
  return true;
};

router.get("/daily", async (req, res) => {
  if (!guard(req, res)) return;

  const results: Record<string, string> = {};
  const run = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      results[name] = "ok";
    } catch (error) {
      results[name] = "FAILED";
      logServerError("cron", error, { path: `/api/cron/daily#${name}` });
    }
  };

  await run("soldCarsCleanup", runSoldCarsCleanup);
  await run("reservationExpiry", runReservationExpiry);
  await run("filterStatsRefresh", updateFilterStatsCache);
  await run("errorLogPrune", async () => {
    const pruned = await pruneOldErrors(30);
    results.errorLogPrune = `ok (${pruned} pruned)`;
  });

  const failed = Object.values(results).some((v) => v.startsWith("FAILED"));
  res.status(failed ? 500 : 200).json({ ok: !failed, results, ranAt: new Date().toISOString() });
});

// Deliberately throws: lets the admin confirm end-to-end that error capture
// works ("break the system on purpose, watch it appear on System Errors").
router.get("/test-error", (req, res) => {
  if (!guard(req, res)) return;
  throw new Error("Test error from /api/cron/test-error — if you can read this on the System Errors screen, monitoring works.");
});

export default router;
