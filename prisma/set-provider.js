/**
 * Point the Prisma datasource provider at whatever DATABASE_URL actually is.
 *
 * Prisma requires `provider` to be a literal in the schema — it cannot read
 * an env var — yet this project runs on SQLite locally and Postgres (Neon)
 * in production. This script runs before `prisma generate` (wired into
 * postinstall/vercel-build) and rewrites the provider line to match the URL,
 * so the same repository deploys to either without hand-editing.
 *
 * file:...        -> provider = "sqlite"
 * postgres(ql)... -> provider = "postgresql"
 */
const fs = require("fs");
const path = require("path");

// Load .env when present (no-op on Vercel, where env comes from the platform).
try { require("dotenv").config(); } catch { /* dotenv not installed in prod prune */ }

const url = process.env.DATABASE_URL || "file:./dev.db";
const provider = /^postgres(ql)?:/i.test(url) ? "postgresql" : "sqlite";

const schemaPath = path.join(__dirname, "schema.prisma");
const schema = fs.readFileSync(schemaPath, "utf8");
const updated = schema.replace(
  /provider\s*=\s*"(sqlite|postgresql)"/,
  `provider = "${provider}"`,
);

if (updated !== schema) {
  fs.writeFileSync(schemaPath, updated);
  console.log(`[prisma] datasource provider set to "${provider}" (from DATABASE_URL)`);
} else {
  console.log(`[prisma] datasource provider already "${provider}"`);
}
