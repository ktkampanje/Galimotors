/**
 * Assemble the static half of the Vercel deployment.
 *
 * One Vercel project serves the whole system. The API runs as a serverless
 * function (api/index.js); the two SPAs are plain static files. Vercel serves
 * one output directory, so this copies both builds into it:
 *
 *   dealership-app/dist  ->  public-build/          (customer site at /)
 *   admin-panel/dist     ->  public-build/admin/    (admin at /admin)
 *
 * The admin bundle is built with base "/admin/", so its asset URLs already
 * point inside the subfolder. Runs as the last step of `npm run vercel-build`.
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "public-build");
const dealership = path.join(root, "dealership-app", "dist");
const admin = path.join(root, "admin-panel", "dist");

for (const [name, dir] of [["dealership-app", dealership], ["admin-panel", admin]]) {
  if (!fs.existsSync(path.join(dir, "index.html"))) {
    console.error(`✖ ${name}/dist/index.html missing — build order broken`);
    process.exit(1);
  }
}

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(dealership, out, { recursive: true });
fs.cpSync(admin, path.join(out, "admin"), { recursive: true });

const count = (dir) =>
  fs.readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).length;
console.log(`✔ public-build assembled: ${count(out)} files (customer site at /, admin at /admin)`);
