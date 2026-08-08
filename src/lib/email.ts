/**
 * Outbound email, via Resend.
 *
 * This replaced a nodemailer/SMTP transport. SMTP on Vercel's serverless
 * functions is a known source of hangs — outbound ports are unreliable and a
 * blocked connection ties up the function until it times out. Resend is a
 * plain HTTPS call, so it either returns or fails fast.
 *
 * Nothing here throws. Email is a side effect of registration, password reset
 * and lead capture; a provider outage must never turn a successful signup into
 * a 500. Callers get `{ success: false }` and decide what to do.
 */
import { Resend } from "resend";
import { getAdminWhatsApp } from "./businessContact";

/**
 * Sender identity. Must be an address on a domain verified in Resend —
 * galimotor.com (singular; galimotors.com is a different owner's domain).
 * An unverified sender is rejected by the API, not silently dropped.
 */
const FROM = process.env.RESEND_FROM || "GaliMotors <info@galimotor.com>";

// Brand navy, matching the admin panel and customer site.
const BRAND = "#13293D";

let client: Resend | null = null;

const getClient = (): Resend | null => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
};

export const isEmailConfigured = (): boolean => !!process.env.RESEND_API_KEY;

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Escape text that will be interpolated into email HTML.
 *
 * Customer names, car titles and rejection reasons all reach these templates
 * from user input. Without escaping, a name containing markup would render as
 * markup in the recipient's mail client.
 */
export const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

interface LayoutOptions {
  /** Bold line at the top of the card. */
  heading: string;
  /** Paragraphs. Values are escaped unless the caller passes pre-escaped HTML. */
  paragraphs: string[];
  /** Optional call-to-action button. */
  button?: { label: string; url: string };
  /** Small print under the divider, above the automated-message notice. */
  note?: string;
}

/**
 * Renders the shared email shell.
 *
 * Table-based with inline styles on purpose: Outlook and most webmail clients
 * strip <style> blocks and have patchy flexbox support, so a stylesheet-driven
 * layout collapses in exactly the clients Malawian customers use most.
 */
export const renderEmail = async ({
  heading,
  paragraphs,
  button,
  note,
}: LayoutOptions): Promise<string> => {
  // Sourced from settings so it tracks the admin panel rather than drifting.
  const businessNumber = await getAdminWhatsApp();

  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#374151;">${p}</p>`,
    )
    .join("");

  const cta = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
         <tr><td style="border-radius:8px;background:${BRAND};">
           <a href="${escapeHtml(button.url)}"
              style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
             ${escapeHtml(button.label)}
           </a>
         </td></tr>
       </table>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px;font-family:Arial,Helvetica,sans-serif;">
        <tr><td>
          <p style="margin:0 0 24px;font-size:20px;font-weight:700;color:${BRAND};">GaliMotors</p>
          <p style="margin:0 0 16px;font-size:17px;font-weight:600;color:#111827;">${heading}</p>
          ${body}
          ${cta}
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;">
          ${note ? `<p style="margin:0 0 8px;font-size:12px;line-height:1.5;color:#6b7280;">${note}</p>` : ""}
          <p style="margin:0;font-size:12px;line-height:1.5;color:#9ca3af;">
            This is an automated message from GaliMotors.${
              businessNumber
                ? `<br>For anything urgent, WhatsApp us on +${escapeHtml(businessNumber)}.`
                : ""
            }
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
};

/**
 * Send one email. Returns a result rather than throwing.
 *
 * An unconfigured provider reports failure honestly instead of pretending to
 * have sent — the previous notification layer returned a fake success id, so
 * every caller believed customers had been contacted when nothing was sent.
 */
export const sendMail = async (options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<EmailResult> => {
  const resend = getClient();

  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY is not set — message NOT sent to %s (%s)",
      options.to,
      options.subject,
    );
    return { success: false, error: "Email provider is not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      ...(options.replyTo ? { replyTo: options.replyTo } : {}),
    });

    // Resend reports delivery problems in `error` rather than by throwing, so
    // this branch is the common failure path (unverified sender, bad address).
    if (error) {
      console.error("[email] Resend rejected message to %s:", options.to, error);
      return { success: false, error: error.message || "Send failed" };
    }

    return { success: true, messageId: data?.id };
  } catch (err: any) {
    // Network-level failure. Logged, not thrown: the caller's request succeeds.
    console.error("[email] Send failed for %s:", options.to, err);
    return { success: false, error: err?.message || "Send failed" };
  }
};
