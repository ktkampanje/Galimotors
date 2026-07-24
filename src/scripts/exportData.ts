/**
 * Export the entire database to a single JSON file.
 *
 * Purpose: move real data (districts, distances, makers + their Cloudinary
 * logo URLs, body types + icons, categories, content pages, global settings,
 * admin accounts, sellers, markets, cars, leads…) from the local SQLite
 * database into Neon Postgres, WITHOUT losing anything.
 *
 * `prisma db push` only creates empty tables, and `db:seed` would recreate a
 * much smaller reference set (11 makers vs the 29 real ones) after wiping
 * what's there — so neither is a migration. This is.
 *
 *   npm run data:export                    # writes data-export.json
 *   DATABASE_URL="<neon>" npm run data:import
 *
 * The export contains customer names and phone numbers: it is gitignored and
 * must never be committed or shared.
 */
import fs from "fs";
import path from "path";
import prisma from "../lib/prisma";
import { EXPORT_ORDER } from "./dataOrder";

const OUT = path.resolve(process.cwd(), process.argv[2] || "data-export.json");

(async () => {
  const data: Record<string, any[]> = {};
  let total = 0;

  for (const model of EXPORT_ORDER) {
    const client = (prisma as any)[model];
    if (!client?.findMany) {
      console.log(`  ⚠ skipping ${model} (not on the Prisma client)`);
      continue;
    }
    const rows = await client.findMany();
    data[model] = rows;
    total += rows.length;
    if (rows.length) console.log(`  ${String(rows.length).padStart(5)}  ${model}`);
  }

  fs.writeFileSync(
    OUT,
    JSON.stringify({ exportedAt: new Date().toISOString(), data }, null, 2),
  );

  const mb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
  console.log(`\n✔ Exported ${total} rows to ${OUT} (${mb}MB)`);
  console.log("  Contains customer PII — never commit or share this file.");
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error("✖ Export failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});
