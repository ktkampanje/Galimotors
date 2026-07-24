/**
 * Malawian phone number validation, defined once for the customer app.
 *
 * A Malawian mobile number is 10 digits starting 08 or 09.
 *
 * The third digit is deliberately NOT constrained. Earlier copies of this
 * check hardcoded prefix lists — /^(099|088|098|089)\d{7}$/ in the booking
 * form and an even narrower /^(088|099)\d{7}$/ at registration — which
 * rejected valid numbers on ranges issued since those lists were written
 * (095…, 086… and others). Real customers were blocked from booking.
 *
 * Mirrors validateMalawianPhone in src/middleware/sanitize.ts on the server.
 */
export const MALAWI_PHONE_LOCAL = /^0[89]\d{8}$/;
export const MALAWI_PHONE_INTERNATIONAL = /^265[89]\d{8}$/;

/** Strip formatting and convert international form to local 0XXXXXXXXX. */
export const normaliseMalawianPhone = (input: string): string => {
  const digits = (input || '').replace(/\D/g, '');
  if (MALAWI_PHONE_INTERNATIONAL.test(digits)) return `0${digits.slice(3)}`;
  return digits;
};

/** True if the input is a usable Malawian mobile number in any accepted form. */
export const isValidMalawianPhone = (input: string): boolean => {
  return MALAWI_PHONE_LOCAL.test(normaliseMalawianPhone(input));
};

/** Shared copy for validation messages, so the guidance is consistent. */
export const MALAWI_PHONE_HINT =
  'Enter a 10-digit Malawian number starting with 08 or 09, e.g. 0952456789.';
