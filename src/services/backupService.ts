import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import prisma from "../lib/prisma";

/**
 * Automated SQLite backups — the tolerance layer for a single-file database
 * that IS the business (no other copy exists; it was lost once before).
 *
 * Uses `VACUUM INTO`, SQLite's online-backup mechanism: it writes a
 * consistent snapshot even while the server is answering requests, so
 * backups never require downtime. A plain file copy of a live database can
 * capture a half-written state — never backup that way while the server runs.
 *
 * Every snapshot is verified (integrity_check + row counts) before it counts;
 * a backup that can't be opened is worse than none, because it feels safe.
 */

const BACKUP_DIR = path.resolve(process.cwd(), "backups");
const KEEP_LAST = 14; // two weeks of dailies
const FILE_PATTERN = /^galimotors-\d{8}-\d{6}\.db$/;

/**
 * These routines are SQLite-only: `VACUUM INTO` and the WAL pragmas are
 * SQLite syntax, and file backups assume a local disk. On Postgres/Neon the
 * database provider owns durability (Neon keeps automatic backups + point-in-
 * time restore), and a Vercel-style host has no persistent disk to write to.
 * So everything here no-ops cleanly unless DATABASE_URL is a SQLite file.
 */
export const isSqlite = () => (process.env.DATABASE_URL || "file:").startsWith("file:");

export interface BackupResult {
  file: string;
  sizeMB: number;
  cars: number;
  leads: number;
  prunedCount: number;
}

const timestamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
};

/** Hours since the newest backup, or null if none exist yet. */
export const latestBackupAgeHours = (): number | null => {
  if (!fs.existsSync(BACKUP_DIR)) return null;
  const times = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => FILE_PATTERN.test(f))
    .map((f) => fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs);
  if (times.length === 0) return null;
  return (Date.now() - Math.max(...times)) / 3_600_000;
};

export const runDatabaseBackup = async (): Promise<BackupResult> => {
  if (!isSqlite()) {
    throw new Error(
      "File backups are a SQLite-only feature. On Postgres/Neon, rely on the " +
        "provider's backups (Neon: automatic backups + point-in-time restore).",
    );
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const fileName = `galimotors-${timestamp()}.db`;
  const target = path.join(BACKUP_DIR, fileName);
  // SQLite path literals want forward slashes, even on Windows.
  const sqlPath = target.replace(/\\/g, "/").replace(/'/g, "''");

  await prisma.$executeRawUnsafe(`VACUUM INTO '${sqlPath}'`);

  // Verify the snapshot with an independent connection before trusting it.
  const check = new PrismaClient({
    datasources: { db: { url: `file:${target.replace(/\\/g, "/")}` } },
  });
  try {
    const integrity = await check.$queryRawUnsafe<
      Array<{ integrity_check: string }>
    >("PRAGMA integrity_check");
    if (integrity[0]?.integrity_check !== "ok") {
      throw new Error(
        `integrity_check returned "${integrity[0]?.integrity_check}"`,
      );
    }
    const [cars, leads] = await Promise.all([check.car.count(), check.lead.count()]);

    const sizeMB = fs.statSync(target).size / (1024 * 1024);
    const prunedCount = pruneOldBackups();
    return { file: target, sizeMB: Math.round(sizeMB * 100) / 100, cars, leads, prunedCount };
  } catch (error) {
    // Never keep a snapshot that failed verification.
    try { fs.unlinkSync(target); } catch { /* already gone */ }
    throw error;
  } finally {
    await check.$disconnect();
  }
};

const pruneOldBackups = (): number => {
  const stale = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => FILE_PATTERN.test(f))
    .sort() // timestamp-named → lexicographic == chronological
    .reverse()
    .slice(KEEP_LAST);
  for (const f of stale) fs.unlinkSync(path.join(BACKUP_DIR, f));
  return stale.length;
};

/**
 * SQLite tuning for live traffic, applied at boot:
 *
 * - journal_mode=WAL — readers no longer block the writer and vice versa,
 *   the single biggest concurrency win SQLite offers. Persists in the file.
 * - busy_timeout — a momentarily locked database waits up to 5s instead of
 *   failing the request instantly. Per-connection, so best-effort under
 *   Prisma's pool, but WAL makes lock collisions rare to begin with.
 */
export const applySqlitePragmas = async () => {
  if (!isSqlite()) {
    console.log("ℹ️  Non-SQLite datasource — skipping SQLite pragmas (provider manages durability)");
    return;
  }
  const mode = await prisma.$queryRawUnsafe<Array<{ journal_mode: string }>>(
    "PRAGMA journal_mode=WAL",
  );
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout=5000");
  console.log(
    `✓ SQLite tuned for live traffic (journal_mode=${mode[0]?.journal_mode ?? "?"})`,
  );
};
