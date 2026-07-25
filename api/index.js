/**
 * Vercel serverless entrypoint.
 *
 * Vercel turns every file in api/ into a function; this one wraps the whole
 * Express app, so every /api/* route (plus sitemap.xml and robots.txt) is
 * served by the same code that runs on a normal server. vercel.json rewrites
 * point here; the two SPAs are served as static files from public-build/,
 * assembled at build time by scripts/vercel-assemble.js.
 *
 * Requires the compiled server (dist/), which `npm run vercel-build` produces
 * before this bundle is created.
 */
const app = require("../dist/index.js").default;

module.exports = app;
