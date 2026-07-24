import prisma from "../lib/prisma";
import { hashPassword, sanitizeEmail, validatePasswordStrength } from "../utils/auth";

/**
 * Create the first SUPER_ADMIN from environment variables.
 *
 * On a serverless host there is no shell to run `npm run admin -- create`, so
 * a freshly-migrated database would have no way in. This closes that gap.
 *
 * Deliberately conservative:
 *  - runs only when SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are both set
 *  - creates nothing if ANY super admin already exists, so it can never
 *    overwrite a real account or resurrect a deleted one
 *  - never changes an existing user's password
 *
 * Once you have logged in, remove SUPER_ADMIN_PASSWORD from the environment
 * and manage accounts through the panel or `npm run admin`.
 */
export const bootstrapSuperAdmin = async (): Promise<void> => {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) return;

  const existing = await prisma.user.count({ where: { role: "SUPER_ADMIN" } });
  if (existing > 0) return; // already administered — do nothing

  const normalised = sanitizeEmail(email);
  const clash = await prisma.user.findUnique({ where: { email: normalised } });
  if (clash) {
    console.warn(
      `⚠️  Admin bootstrap skipped: ${normalised} exists with role ${clash.role}. ` +
        "Promote it instead: npm run admin -- promote <email> SUPER_ADMIN",
    );
    return;
  }

  const { valid, errors } = validatePasswordStrength(password);
  if (!valid) {
    // Still created — refusing would leave nobody able to sign in — but say so.
    console.warn(
      "⚠️  SUPER_ADMIN_PASSWORD is weak (" + errors.join("; ") + "). " +
        "Change it after first login: npm run admin -- reset <email> \"<strong>\"",
    );
  }

  await prisma.user.create({
    data: {
      email: normalised,
      password: await hashPassword(password),
      name: process.env.SUPER_ADMIN_NAME || "Administrator",
      role: "SUPER_ADMIN",
    },
  });

  console.log(`✓ Created initial SUPER_ADMIN ${normalised} from environment variables`);
  console.log("  Remove SUPER_ADMIN_PASSWORD from the environment once you have signed in.");
};
