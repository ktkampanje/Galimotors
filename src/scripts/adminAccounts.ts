/**
 * Admin account management + password recovery, from the command line.
 *
 * This is the safe replacement for hand-editing the database when the sole
 * admin is locked out (no self-service reset flow exists — that needs email,
 * which isn't wired up). Run it on the server, or locally against the live
 * database by pointing DATABASE_URL at it:
 *
 *   npm run admin -- list
 *   npm run admin -- reset  <email> "<newPassword>"
 *   npm run admin -- create <email> "<Full Name>" <ROLE> "<password>"
 *   npm run admin -- promote <email> <ROLE>
 *   npm run admin -- delete <email>
 *
 * ROLE ∈ SUPER_ADMIN | SUB_ADMIN | SELLER | MARKET_ATTENDANT
 *
 * Guards: passwords must pass the same strength check as the app; the LAST
 * remaining SUPER_ADMIN can never be deleted or demoted (that would lock
 * everyone out for good).
 */
import prisma from "../lib/prisma";
import { hashPassword, validatePasswordStrength, sanitizeEmail } from "../utils/auth";

const ADMIN_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "SELLER", "MARKET_ATTENDANT"];

// Heuristics for "this looks like a leftover seed/test account, review it".
const SUSPICIOUS = /(test|demo|example|sample|seed|temp|dummy|e2e|admin@admin|foo|bar|changeme)/i;

const log = (s = "") => process.stdout.write(s + "\n");
const die = (s: string): never => { process.stderr.write("✖ " + s + "\n"); process.exit(1); };

const superAdminCount = () => prisma.user.count({ where: { role: "SUPER_ADMIN" } });

async function list() {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  if (users.length === 0) return log("No user accounts exist.");

  log(`\n${users.length} account(s):\n`);
  log("  ROLE              EMAIL                              NAME              CREATED      FLAG");
  log("  " + "-".repeat(92));
  for (const u of users) {
    const flag =
      u.role === "ADMIN" ? "⚠ legacy role" :
      SUSPICIOUS.test(u.email) || SUSPICIOUS.test(u.name) ? "⚠ review (seed/test?)" : "";
    const created = u.createdAt.toISOString().slice(0, 10);
    log(
      "  " +
        u.role.padEnd(17) +
        " " + (u.email.length > 34 ? u.email.slice(0, 31) + "…" : u.email).padEnd(34) +
        " " + (u.name.length > 17 ? u.name.slice(0, 16) + "…" : u.name).padEnd(17) +
        " " + created.padEnd(12) +
        " " + flag,
    );
  }

  const supers = users.filter((u) => u.role === "SUPER_ADMIN").length;
  const flagged = users.filter((u) => u.role === "ADMIN" || SUSPICIOUS.test(u.email) || SUSPICIOUS.test(u.name)).length;
  log("");
  log(`  SUPER_ADMIN accounts: ${supers}${supers === 0 ? "  ⚠ NONE — nobody can fully administer the system" : ""}`);
  if (flagged > 0) log(`  ${flagged} account(s) flagged — remove any that are seed/test logins:  npm run admin -- delete <email>`);
  log("");
}

async function requireStrong(password: string) {
  const { valid, errors } = validatePasswordStrength(password);
  if (!valid) die("Weak password:\n   - " + errors.join("\n   - "));
}

async function reset(email: string, password: string) {
  if (!email || !password) die('Usage: npm run admin -- reset <email> "<newPassword>"');
  const e = sanitizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: e } });
  if (!user) return die(`No account with email ${e}`);
  await requireStrong(password);
  await prisma.user.update({ where: { email: e }, data: { password: await hashPassword(password) } });
  log(`✔ Password reset for ${e} (${user.role}).`);
}

async function create(email: string, name: string, role: string, password: string) {
  if (!email || !name || !role || !password)
    die('Usage: npm run admin -- create <email> "<Full Name>" <ROLE> "<password>"');
  if (!ADMIN_ROLES.includes(role)) die(`Invalid role "${role}". One of: ${ADMIN_ROLES.join(", ")}`);
  const e = sanitizeEmail(email);
  if (await prisma.user.findUnique({ where: { email: e } })) die(`An account with email ${e} already exists.`);
  await requireStrong(password);
  await prisma.user.create({ data: { email: e, name, role, password: await hashPassword(password) } });
  log(`✔ Created ${role} account ${e}.`);
}

async function promote(email: string, role: string) {
  if (!email || !role) die("Usage: npm run admin -- promote <email> <ROLE>");
  if (!ADMIN_ROLES.includes(role)) die(`Invalid role "${role}". One of: ${ADMIN_ROLES.join(", ")}`);
  const e = sanitizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: e } });
  if (!user) return die(`No account with email ${e}`);
  if (user.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN" && (await superAdminCount()) <= 1)
    die("Refusing to demote the last SUPER_ADMIN — you would lock everyone out.");
  await prisma.user.update({ where: { email: e }, data: { role } });
  log(`✔ ${e}: ${user.role} → ${role}.`);
}

async function del(email: string) {
  if (!email) die("Usage: npm run admin -- delete <email>");
  const e = sanitizeEmail(email);
  const user = await prisma.user.findUnique({ where: { email: e } });
  if (!user) return die(`No account with email ${e}`);
  if (user.role === "SUPER_ADMIN" && (await superAdminCount()) <= 1)
    die("Refusing to delete the last SUPER_ADMIN — you would lock everyone out.");
  await prisma.user.delete({ where: { email: e } });
  log(`✔ Deleted ${e} (${user.role}).`);
}

function usage() {
  log(`
Admin account manager

  npm run admin -- list
  npm run admin -- reset   <email> "<newPassword>"
  npm run admin -- create  <email> "<Full Name>" <ROLE> "<password>"
  npm run admin -- promote <email> <ROLE>
  npm run admin -- delete  <email>

  ROLE ∈ ${ADMIN_ROLES.join(" | ")}

Tip: to recover a locked-out live system, run this locally with the
production database:  DATABASE_URL="<neon url>" npm run admin -- reset ...
`);
}

(async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    switch (cmd) {
      case "list": await list(); break;
      case "reset": await reset(rest[0], rest[1]); break;
      case "create": await create(rest[0], rest[1], rest[2], rest[3]); break;
      case "promote": await promote(rest[0], rest[1]); break;
      case "delete": await del(rest[0]); break;
      default: usage(); if (cmd) die(`Unknown command "${cmd}".`);
    }
  } catch (err: any) {
    die(err?.message || String(err));
  } finally {
    await prisma.$disconnect();
  }
})();
