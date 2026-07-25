import prisma from "../lib/prisma";
import { comparePassword, hashPassword, sanitizeEmail, validatePasswordStrength } from "../utils/auth";

/**
 * The environment IS the super admin.
 *
 * When SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are set, this enforces on
 * every boot that:
 *
 *   1. an account with that email exists and is a SUPER_ADMIN
 *      (created if missing, promoted if it exists under another role);
 *   2. its password is EXACTLY the one in the environment — change the
 *      variable, redeploy, and that is the new password. A password changed
 *      any other way (panel, CLI, direct DB edit) is reverted on the next
 *      boot, which also means an attacker who somehow altered it is locked
 *      back out;
 *   3. no OTHER account holds SUPER_ADMIN — extras are demoted to SUB_ADMIN,
 *      so the env-defined account is the only one with full power.
 *
 * When the variables are NOT set (local development), none of this runs and
 * accounts are managed with `npm run admin` as before. The check itself is
 * one bcrypt compare on a cold start — negligible.
 */
export const bootstrapSuperAdmin = async (): Promise<void> => {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!email || !password) {
    // Nothing to enforce — but a production system with NO super admin at
    // all is unrecoverable from the outside, so at least say so.
    const supers = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
    if (supers === 0) {
      console.warn(
        "⚠️  No SUPER_ADMIN exists and SUPER_ADMIN_EMAIL/PASSWORD are not set — " +
          "nobody can administer this system. Set the variables or run: " +
          'npm run admin -- create <email> "<Name>" SUPER_ADMIN "<password>"',
      );
    }
    return;
  }

  const normalised = sanitizeEmail(email);

  const { valid, errors } = validatePasswordStrength(password);
  if (!valid) {
    // Enforced anyway — refusing would leave nobody able to sign in — but
    // a weak value here is now THE permanent credential, so shout.
    console.warn(
      "⚠️  SUPER_ADMIN_PASSWORD is weak (" + errors.join("; ") + "). " +
        "It is enforced as the live admin password — set a strong value in the environment.",
    );
  }

  // 1 + 2: the env account exists, is SUPER_ADMIN, and has the env password.
  const user = await prisma.user.findUnique({ where: { email: normalised } });
  if (!user) {
    await prisma.user.create({
      data: {
        email: normalised,
        password: await hashPassword(password),
        name: process.env.SUPER_ADMIN_NAME || "Administrator",
        role: "SUPER_ADMIN",
      },
    });
    console.log(`✓ Created SUPER_ADMIN ${normalised} from environment variables`);
  } else {
    const updates: { role?: string; password?: string } = {};
    if (user.role !== "SUPER_ADMIN") updates.role = "SUPER_ADMIN";
    if (!(await comparePassword(password, user.password))) {
      updates.password = await hashPassword(password);
    }
    if (Object.keys(updates).length > 0) {
      await prisma.user.update({ where: { email: normalised }, data: updates });
      console.log(
        `✓ Enforced env super admin on ${normalised}` +
          (updates.role ? " (role -> SUPER_ADMIN)" : "") +
          (updates.password ? " (password synced to environment)" : ""),
      );
    }
  }

  // 3: nobody else keeps SUPER_ADMIN.
  const demoted = await prisma.user.updateMany({
    where: { role: "SUPER_ADMIN", NOT: { email: normalised } },
    data: { role: "SUB_ADMIN" },
  });
  if (demoted.count > 0) {
    console.log(
      `✓ Demoted ${demoted.count} other SUPER_ADMIN account(s) to SUB_ADMIN — ` +
        `${normalised} is the only super admin`,
    );
  }
};
