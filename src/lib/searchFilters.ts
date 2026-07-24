/**
 * Case-insensitive `contains` for Prisma across both providers.
 *
 * SQLite's `contains` is case-insensitive by default; Postgres' is
 * case-SENSITIVE, so after the move to Neon a search for "toyota" would stop
 * matching "Toyota". Postgres needs Prisma's `mode: "insensitive"` — but the
 * SQLite-generated client rejects that key, so it must only be sent when the
 * datasource really is Postgres.
 *
 * Typed loosely on purpose: `mode` exists only in the Postgres-generated
 * client types, and this code must compile against either.
 */
const IS_POSTGRES = /^postgres(ql)?:/i.test(process.env.DATABASE_URL || "");

export const ciContains = (value: string): any =>
  IS_POSTGRES ? { contains: value, mode: "insensitive" } : { contains: value };
