import cron from "node-cron";
import { runDatabaseBackup, latestBackupAgeHours, isSqlite } from "../services/backupService";

const logResult = (label: string, r: Awaited<ReturnType<typeof runDatabaseBackup>>) => {
  console.log(
    `   ✅ ${label}: ${r.file} (${r.sizeMB}MB, ${r.cars} cars, ${r.leads} leads` +
      (r.prunedCount ? `, pruned ${r.prunedCount} old` : "") +
      ")",
  );
};

export const startDatabaseBackupJob = () => {
  if (!isSqlite()) {
    console.log("ℹ️  Database backup job disabled — non-SQLite datasource (provider handles backups)");
    return;
  }

  // Daily at 3:00 AM — after the 2:00 AM sold-cars cleanup, so the snapshot
  // includes that job's changes.
  cron.schedule("0 3 * * *", async () => {
    try {
      console.log("🕐 [CRON] Running database backup...");
      logResult("Nightly backup", await runDatabaseBackup());
    } catch (error) {
      console.error("❌ [CRON] Database backup FAILED:", error);
    }
  });

  // Also snapshot on startup, so every deploy/restart begins from a saved
  // state. Guarded: dev restarts happen constantly, so skip when a backup
  // from the last 6 hours already exists.
  setTimeout(async () => {
    try {
      const age = latestBackupAgeHours();
      if (age !== null && age < 6) return;
      logResult("Startup backup", await runDatabaseBackup());
    } catch (error) {
      console.error("❌ Startup backup FAILED:", error);
    }
  }, 5000);

  console.log("✓ Database backup job scheduled (daily 3:00 AM + on startup)");
};
