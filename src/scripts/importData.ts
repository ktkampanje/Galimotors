/**
 * Import a data-export.json into whatever database DATABASE_URL points at.
 * This is how the real data reaches Neon:
 *
 *   1. npm run data:export                                  (from SQLite)
 *   2. set DATABASE_URL to the Neon connection string
 *   3. npx prisma db push                                   (create tables)
 *   4. npm run data:import
 *
 * Idempotent: every row is upserted by primary key, so re-running after a
 * partial failure resumes safely rather than duplicating.
 *
 * Rows are written parent-first (see dataOrder.ts). A row whose foreign-key
 * parent is genuinely missing is reported and skipped rather than aborting
 * the whole migration — you get a summary of exactly what didn't land.
 */
import fs from "fs";
import path from "path";
import prisma from "../lib/prisma";
import { EXPORT_ORDER } from "./dataOrder";

const FILE = path.resolve(process.cwd(), process.argv[2] || "data-export.json");

(async () => {
  if (!fs.existsSync(FILE)) {
    console.error(`✖ No export file at ${FILE}. Run: npm run data:export`);
    process.exit(1);
  }

  const parsed = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const data: Record<string, any[]> = parsed.data || parsed;

  const target = process.env.DATABASE_URL || "(unset)";
  console.log(`Importing ${FILE}`);
  console.log(`   exported: ${parsed.exportedAt || "unknown"}`);
  console.log(`   target:   ${target.replace(/:[^:@/]+@/, ":****@")}\n`);

  let written = 0;
  const failures: { model: string; id: string; error: string }[] = [];

  for (const model of EXPORT_ORDER) {
    const rows = data[model];
    if (!rows?.length) continue;
    const client = (prisma as any)[model];
    if (!client?.upsert) {
      console.log(`  ⚠ skipping ${model} (not on the Prisma client)`);
      continue;
    }

    let ok = 0;
    for (const row of rows) {
      try {
        if (row.id !== undefined) {
          await client.upsert({ where: { id: row.id }, create: row, update: row });
        } else {
          // No single-column primary key (join tables) — create, tolerate dupes.
          await client.create({ data: row });
        }
        ok++;
      } catch (e: any) {
        const msg = String(e?.message || e).split("\n").find((l: string) => l.trim()) || "unknown";
        // A duplicate on a keyless join row means it's already there: not a failure.
        if (/Unique constraint/i.test(msg) && row.id === undefined) { ok++; continue; }
        failures.push({ model, id: row.id ?? "(no id)", error: msg.slice(0, 160) });
      }
    }
    written += ok;
    console.log(`  ${String(ok).padStart(5)}/${String(rows.length).padEnd(5)} ${model}`);
  }

  console.log(`\n✔ Imported ${written} rows`);
  if (failures.length) {
    console.log(`\n⚠ ${failures.length} row(s) did not import:`);
    for (const f of failures.slice(0, 20)) console.log(`   ${f.model} ${f.id}: ${f.error}`);
    if (failures.length > 20) console.log(`   …and ${failures.length - 20} more`);
    console.log("\nRe-running is safe — imported rows are upserted, not duplicated.");
  }

  await prisma.$disconnect();
  process.exit(failures.length ? 1 : 0);
})().catch(async (e) => {
  console.error("✖ Import failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
