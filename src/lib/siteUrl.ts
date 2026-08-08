/**
 * The public address of the customer site.
 *
 * Used for links customers actually click — quote and viewing links sent over
 * WhatsApp — and for sitemap and Meta catalog entries. Getting this wrong is
 * not cosmetic: a WhatsApp quote link pointing at localhost is dead for the
 * customer who receives it.
 *
 * Order: explicit configuration wins; otherwise fall back to the URL Vercel
 * injects for the running deployment, so a deploy with neither variable set
 * still produces working links.
 */
export const getSiteUrl = (): string => {
  const explicit = process.env.PUBLIC_SITE_URL || process.env.FRONTEND_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // The PUBLIC production domain (e.g. galimotor.com). This must be
  // preferred over VERCEL_URL: that one is the per-deployment internal host,
  // which Vercel gates behind its own login — a customer who tapped a
  // WhatsApp quote link built from it was asked to "Log in to Vercel".
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // Last-resort deployment host (scheme-less), better than localhost.
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // Local development: the customer site, not the admin panel.
  return "http://localhost:5174";
};
