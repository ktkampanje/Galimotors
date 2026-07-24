/**
 * Single place that builds wa.me click-to-chat URLs.
 *
 * wa.me requires digits only in international form — no leading +, no spaces,
 * no punctuation. Lead phones are stored in local form (0885086757) by
 * sanitizePhone, so they need promoting to 265… before use.
 *
 * This previously existed as four hand-written copies of
 * `phone.replace(/^0/, "265")` that had already drifted: two guarded against a
 * null phone and two did not, producing a `wa.me/undefined` link in one place
 * and a 500 in another.
 */

/** Normalise a Malawian number to the digits-only international form wa.me needs. */
export const toWhatsAppNumber = (phone?: string | null): string | null => {
  if (!phone) return null;

  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;

  // Local form (0885086757) -> international (265885086757).
  if (digits.startsWith('0')) digits = `265${digits.slice(1)}`;

  // A bare 9-digit subscriber number with no country code or trunk zero.
  if (digits.length === 9) digits = `265${digits}`;

  // Anything that isn't a plausible Malawian mobile is rejected rather than
  // turned into a link that silently reaches nobody.
  if (!/^265\d{9}$/.test(digits)) return null;

  return digits;
};

/**
 * Build a wa.me URL, or null when the number is missing or unusable.
 *
 * Returning null lets callers omit the button entirely instead of rendering
 * one that opens WhatsApp with no recipient.
 */
export const buildWhatsAppUrl = (
  phone?: string | null,
  message?: string
): string | null => {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;

  return message
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${number}`;
};
