/**
 * Single-use tokens for password reset and email verification.
 *
 * The raw token exists in exactly one place — the link in the customer's
 * email. Only its SHA-256 hash reaches the database, so a stolen dump cannot
 * be turned into working reset links. This mirrors how passwords are handled:
 * verify by comparing hashes, never by storing the secret.
 */
import crypto from "crypto";
import prisma from "./prisma";

export type TokenPurpose = "PASSWORD_RESET" | "EMAIL_VERIFY";

/**
 * Lifetimes differ by risk. A reset token grants account takeover, so it is
 * deliberately short. A verification token grants only a "yes, this address
 * works" flag, and customers here often read mail days later on a shared
 * phone — an hour-long window would strand them.
 */
const TOKEN_TTL_MS: Record<TokenPurpose, number> = {
  PASSWORD_RESET: 60 * 60 * 1000, // 1 hour
  EMAIL_VERIFY: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const hashToken = (raw: string): string =>
  crypto.createHash("sha256").update(raw).digest("hex");

/**
 * Issue a token, invalidating any outstanding one for the same purpose.
 *
 * Superseding matters: without it, every "resend" request leaves another live
 * link in another inbox, and an old forwarded email stays dangerous forever.
 */
export const createVerificationToken = async (
  customerId: string,
  purpose: TokenPurpose,
): Promise<string> => {
  await prisma.verificationToken.updateMany({
    where: { customerId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  // 32 bytes from the CSPRNG — not guessable by brute force. base64url keeps
  // it safe to drop straight into a query string without escaping.
  const raw = crypto.randomBytes(32).toString("base64url");

  await prisma.verificationToken.create({
    data: {
      customerId,
      purpose,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS[purpose]),
    },
  });

  return raw;
};

/**
 * Validate and spend a token. Returns the customer id, or null for anything
 * wrong — unknown, expired, already used, or issued for a different purpose.
 *
 * The purpose check is not ceremonial: without it a long-lived verification
 * token from a signup email could be replayed against the reset endpoint to
 * change the password.
 */
export const consumeVerificationToken = async (
  raw: unknown,
  purpose: TokenPurpose,
): Promise<string | null> => {
  if (typeof raw !== "string" || !raw) return null;

  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashToken(raw) },
  });

  if (!record) return null;
  if (record.purpose !== purpose) return null;
  if (record.usedAt) return null;
  if (record.expiresAt.getTime() < Date.now()) return null;

  // Spend it with the `usedAt: null` guard still in the WHERE clause, so two
  // concurrent requests with the same link cannot both succeed. The loser
  // updates zero rows and is rejected.
  const claimed = await prisma.verificationToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  if (claimed.count === 0) return null;

  return record.customerId;
};

/** Drop spent and expired rows. Called by the daily cleanup cron. */
export const pruneVerificationTokens = async (): Promise<number> => {
  const { count } = await prisma.verificationToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        { usedAt: { not: null } },
      ],
    },
  });
  return count;
};
