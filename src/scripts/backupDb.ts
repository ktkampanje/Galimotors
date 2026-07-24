import { runDatabaseBackup, isSqlite } from "../services/backupService";

/**
 * Manual backup: `npm run db:backup`.
 * Safe to run while the server is live (VACUUM INTO is SQLite's
 * online-backup mechanism). Also runs automatically before `npm run db:push`.
 *
 * On Postgres/Neon this exits 0 with a note (so it doesn't block db:push) —
 * the provider owns backups there.
 */
if (!isSqlite()) {
  console.log("ℹ️  Skipping file backup — non-SQLite datasource. Use the provider's backups (Neon: point-in-time restore).");
  process.exit(0);
}

runDatabaseBackup()
  .then((r) => {
    console.log(
      `✅ Backup verified: ${r.file} (${r.sizeMB}MB, ${r.cars} cars, ${r.leads} leads)`,
    );
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Backup FAILED — do not proceed with risky changes:", error);
    process.exit(1);
  });
