import prisma from "./prisma";
import { toWhatsAppNumber } from "./whatsapp";

/**
 * Resolves the business's own contact numbers.
 *
 * These previously came straight from process.env.ADMIN_WHATSAPP at seven
 * call sites, which meant the number saved on the admin Settings page was
 * written but never read — changing it there had no effect, and a real change
 * required editing .env and restarting the server.
 *
 * Resolution order: GlobalSettings row -> environment -> hardcoded default.
 *
 * Values are normalised through toWhatsAppNumber on the way out, so a stored
 * value in any format still yields a usable wa.me number. Null is returned
 * when nothing usable is configured, so callers can skip rather than send to
 * a placeholder that reaches nobody.
 */

// Deliberately no hardcoded fallback number. Defaulting to a placeholder like
// 265990000000 produces links and notifications that look valid but reach
// nobody, hiding the misconfiguration. Callers get null and skip instead.
//
// Notifications fire in loops (the reservation expiry job walks every expired
// lead), so the singleton row is cached briefly rather than read per message.
// Short enough that a number changed in the admin panel takes effect promptly.
const CACHE_TTL_MS = 30_000;

let warnedUnconfigured = false;

let cache: {
  whatsApp: string | null;
  phone: string | null;
  email: string | null;
  at: number;
} | null = null;

export const invalidateBusinessContactCache = () => {
  cache = null;
  warnedUnconfigured = false;
};

const loadFromDatabase = async () => {
  try {
    const settings = await prisma.globalSettings.findUnique({
      where: { id: "SETTINGS_SINGLETON" },
      select: { adminWhatsApp: true, adminPhone: true, businessEmail: true },
    });
    return settings;
  } catch (error) {
    // A settings read failure must not take down a notification path.
    console.warn("[businessContact] Could not read settings, falling back to env:", error);
    return null;
  }
};

const resolve = async () => {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache;

  const settings = await loadFromDatabase();

  const whatsApp = toWhatsAppNumber(
    settings?.adminWhatsApp || process.env.ADMIN_WHATSAPP
  );
  const phone = toWhatsAppNumber(
    settings?.adminPhone || process.env.ADMIN_PHONE || process.env.ADMIN_WHATSAPP
  );

  // Where admin alerts land. Validated loosely — the aim is to reject the
  // empty string and obvious junk, not to police address syntax, since a
  // rejected address here means a new lead reaches nobody.
  const rawEmail = (settings?.businessEmail || process.env.ADMIN_EMAIL || "").trim();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : null;

  if (!whatsApp && !warnedUnconfigured) {
    warnedUnconfigured = true;
    console.warn(
      "[businessContact] No usable business WhatsApp number is configured. " +
      "Set it on the admin Settings page or via ADMIN_WHATSAPP. " +
      "Admin notifications will be skipped until it is."
    );
  }

  cache = { whatsApp, phone, email, at: Date.now() };
  return cache;
};

/** The business WhatsApp number in wa.me form, or null if unusable. */
export const getAdminWhatsApp = async (): Promise<string | null> => {
  return (await resolve()).whatsApp;
};

/** The business phone number in international digits form, or null. */
export const getAdminPhone = async (): Promise<string | null> => {
  return (await resolve()).phone;
};

/**
 * The inbox that receives admin alerts — new inquiries, quote requests,
 * viewing bookings, sell submissions.
 *
 * This is the businessEmail from the admin Settings page, so it moves with
 * the business rather than being pinned to whoever set the server up.
 */
export const getAdminEmail = async (): Promise<string | null> => {
  return (await resolve()).email;
};
