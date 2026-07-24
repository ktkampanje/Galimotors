# GaliMotors

A car marketplace and brokerage platform built for the Malawian market.
Customers browse verified cars, request quotes, and book paid viewings;
admins run the inventory, negotiate, and manage each deal through to the
sale. WhatsApp is the primary communication channel throughout.

## Repository layout

| Path | What it is |
|---|---|
| `src/` | Express + Prisma API (TypeScript) |
| `dealership-app/` | Customer-facing site — React + Vite, mobile-first |
| `admin-panel/` | Admin panel — React + Vite, served under `/admin` |
| `prisma/` | Schema and reference-data seed |
| `OPERATIONS.md` | **Live-operations playbook** — deploys, schema changes, restore, admin recovery |

**Stack:** React 18 · TypeScript · Vite · TailwindCSS · Express · Prisma ·
SQLite (dev) / Postgres–Neon (prod) · Cloudinary for images · JWT auth with
separate admin and customer token secrets.

## Getting started

Requires Node.js 20+ and a Cloudinary account (the only image store).

```bash
npm install                 # installs all three workspaces
cp .env.example .env        # then fill it in — see the notes below
npm run db:setup            # create schema + seed reference data
npm run dev                 # API :5000 · admin :5173 · customer site :5174
```

The admin panel uses the `/admin` base path, so locally it lives at
`http://localhost:5173/admin`.

Create your first admin account (no default login ships with the project):

```bash
npm run admin -- create you@example.com "Your Name" SUPER_ADMIN "AStrongPass1!"
```

## Common commands

```bash
npm run dev              # all three apps together
npm run dev:server       # API only  (also dev:admin, dev:app)
npm run build            # production build of all three
npm start                # run the built server

npm run db:push          # apply schema changes (auto-backs up first on SQLite)
npm run db:backup        # manual verified backup (SQLite only)
npm run db:seed          # reference data — DESTRUCTIVE, wipes settings first

npm run admin -- list    # list admin accounts, flags seed/test logins
npm run admin -- reset <email> "<newPassword>"
```

`npm run admin` is also the recovery path when the only admin is locked out —
there is no self-service password reset. See `OPERATIONS.md`.

## Configuration

All configuration is via environment variables; `.env.example` documents every
one. Three that commonly bite:

- **JWT secrets are mandatory in production.** The server deliberately refuses
  to boot without them rather than falling back to a known default.
- **On Neon, use the pooled connection string**, or serverless functions will
  exhaust the connection limit.
- **`PUBLIC_SITE_URL` must be the real domain** in production, or sitemap and
  Facebook catalog links point at localhost.

Settings that change over time — WhatsApp number, Facebook page, trading
address, Meta Pixel ID — are edited in the admin **Settings** screen, not in
code.

## Deployment

Runs either as a long-lived Node server (VPS behind PM2) or serverless on
Vercel with the database on Neon. Those two differ in ways that matter —
backups, cron jobs, and in-memory state. **Read `OPERATIONS.md` before the
first deploy.**

## A note on data

The database holds real customer names and phone numbers. It is deliberately
**not** in version control and must stay that way — back it up with
`npm run db:backup` locally, or rely on the provider's backups on Neon.

## License

Proprietary — GaliMotors Malawi.
