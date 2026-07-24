/**
 * wa.me URL construction for the admin panel.
 *
 * Mirrors src/lib/whatsapp.ts on the server. Lead phones are stored in local
 * form (0885086757) and must be promoted to international digits-only form
 * before wa.me will resolve a recipient.
 *
 * Returns null rather than a broken link when the number is missing, so
 * callers can hide the button. The previous inline
 * `selectedLead.buyerPhone.replace(/^0/, '265')` threw during render on a lead
 * with no phone, blanking the whole detail modal.
 */
export const toWhatsAppNumber = (phone?: string | null): string | null => {
  if (!phone) return null;

  let digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('0')) digits = `265${digits.slice(1)}`;
  if (digits.length === 9) digits = `265${digits}`;

  if (!/^265\d{9}$/.test(digits)) return null;

  return digits;
};

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

/**
 * Format-tolerant phone search for admin lists.
 *
 * Customers WhatsApp the business from numbers displayed as +265 952 456 789,
 * but leads store the local form 0952456789 — a raw substring test misses.
 * This compares digits only and treats the 0- and 265- prefixes as the same
 * number, so pasting any format finds the lead. Partial digit strings still
 * match (e.g. searching "45678").
 */
export const phoneMatchesQuery = (stored: string | null | undefined, query: string): boolean => {
  const q = (query || '').replace(/\D/g, '');
  if (!q) return false;
  const s = (stored || '').replace(/\D/g, '');
  if (!s) return false;

  // Both sides in both prefix forms, so any combination matches.
  const variants = new Set([s]);
  if (s.startsWith('0')) variants.add(`265${s.slice(1)}`);
  if (s.startsWith('265')) variants.add(`0${s.slice(3)}`);

  const queries = new Set([q]);
  if (q.startsWith('0')) queries.add(`265${q.slice(1)}`);
  if (q.startsWith('265')) queries.add(`0${q.slice(3)}`);

  for (const sv of variants) {
    for (const qv of queries) {
      if (sv.includes(qv)) return true;
    }
  }
  return false;
};
