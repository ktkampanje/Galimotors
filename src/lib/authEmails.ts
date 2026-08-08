/**
 * The two account-lifecycle emails: password reset and address verification.
 *
 * Both build their link from getSiteUrl(), so a misconfigured PUBLIC_SITE_URL
 * shows up as a broken link rather than a link to the wrong site.
 */
import { escapeHtml, renderEmail, sendMail } from "./email";
import { getSiteUrl } from "./siteUrl";

/** First name only — "Hi Chikondi" reads better than the full legal name. */
const firstName = (name?: string | null): string => {
  const first = String(name || "").trim().split(/\s+/)[0];
  return first || "there";
};

export const sendPasswordResetEmail = async (
  to: string,
  name: string | null,
  rawToken: string,
): Promise<boolean> => {
  const url = `${getSiteUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const greeting = escapeHtml(firstName(name));

  const html = await renderEmail({
    heading: "Reset your password",
    paragraphs: [
      `Hi ${greeting},`,
      "We received a request to reset the password on your GaliMotors account. Click the button below to choose a new one.",
      "This link expires in one hour and can only be used once.",
    ],
    button: { label: "Reset password", url },
    note:
      "If you did not request this, you can safely ignore this email — your " +
      "password will not change until someone opens the link above and sets a new one.",
  });

  const text = [
    `Hi ${firstName(name)},`,
    "",
    "We received a request to reset the password on your GaliMotors account.",
    "Open this link to choose a new one:",
    "",
    url,
    "",
    "This link expires in one hour and can only be used once.",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const result = await sendMail({
    to,
    subject: "Reset your password - GaliMotors",
    html,
    text,
  });

  return result.success;
};

export const sendVerificationEmail = async (
  to: string,
  name: string | null,
  rawToken: string,
): Promise<boolean> => {
  const url = `${getSiteUrl()}/verify-email?token=${encodeURIComponent(rawToken)}`;
  const greeting = escapeHtml(firstName(name));

  const html = await renderEmail({
    heading: "Confirm your email address",
    paragraphs: [
      `Hi ${greeting},`,
      "Thanks for creating a GaliMotors account. Confirming your email address lets us send you quotes, viewing confirmations and password resets.",
      "This link expires in seven days.",
    ],
    button: { label: "Confirm email address", url },
    note:
      "You can keep using your account in the meantime — nothing is locked " +
      "until you confirm.",
  });

  const text = [
    `Hi ${firstName(name)},`,
    "",
    "Thanks for creating a GaliMotors account.",
    "Confirm your email address by opening this link:",
    "",
    url,
    "",
    "This link expires in seven days. You can keep using your account in the meantime.",
  ].join("\n");

  const result = await sendMail({
    to,
    subject: "Confirm your email address - GaliMotors",
    html,
    text,
  });

  return result.success;
};
