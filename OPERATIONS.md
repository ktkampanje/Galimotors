# GaliMotors — Live Operations Playbook

How to change a system people are actively using without losing data or
trust. Read the three rules; everything else follows from them.

## The three rules

1. **Every change reaches production through git.** Test locally → commit →
   deploy. Never edit files directly on the server; if the server's code
   differs from git, you can no longer roll back.
2. **Schema changes are additive first.** Add the new thing, deploy, migrate
   usage, and only remove the old thing in a *later* deploy (details below).
   The database must always work with both the previous and the current code
   version — that is what makes deploys and rollbacks safe.
3. **A backup precedes every risky step.** This is now automated (below),
   but before anything that scares you, run `npm run db:backup` and wait for
   `✅ Backup verified`.

## What is now automatic

| Protection | What it does |
|---|---|
| Nightly backup (3:00 AM) | Verified snapshot to `backups/`, keeps the last 14 |
| Startup backup | Every deploy/restart snapshots first (skipped if one is <6h old) |
| `npm run db:push` | Backs up **before** pushing schema changes — the pre-push copy is no longer a manual habit |
| Online snapshots | Backups use SQLite `VACUUM INTO` — safe *while the server is live*, no downtime needed |
| Verified backups | Each snapshot is opened, integrity-checked and row-counted; a corrupt snapshot is deleted and the backup FAILS loudly |
| WAL mode | Readers and the writer no longer block each other — customers browsing don't collide with an admin saving |
| Graceful shutdown | On restart, in-flight requests finish before the process exits (10s cap) |
| Crash tolerance | A stray failed promise is logged, not fatal; a real crash exits cleanly for the process manager to restart |

**`backups/` lives on the same disk as the database.** Once deployed, copy it
off the server periodically (download, or sync to Drive/S3) — a dead disk
takes both otherwise.

## Pushing a code change while live

```
# locally
npm run build            # prove all three apps still build
git add ... && git commit

# on the server
git pull
npm install              # only if package.json changed
npm run build
pm2 restart galimotors   # or however the process is managed
```

Impact on live users: a **2–5 second** gap while the process restarts.
Customers already on the site don't notice (the SPA is loaded in their
browser); a request landing exactly in the gap fails once and works on
retry. For a dealership this is fine — do deploys at quiet hours anyway,
and never deploy something you haven't run locally.

## Changing the database while live (expand → migrate → contract)

`npm run db:push` (never raw `npx prisma db push` — the npm script backs up
first). What makes a schema change safe or dangerous:

**Safe in one deploy (additive):**
- New table
- New column that is optional (`String?`) or has a `@default(...)`
- New index

**Never in one deploy (destructive):** renaming or dropping a column/table
the running code still uses. Split it:

1. **Expand** — add the new column/table alongside the old. Deploy.
2. **Migrate** — new code writes to the new place (and backfills old rows if
   needed). Deploy. Both old and new columns exist; nothing is lost if you
   roll back.
3. **Contract** — once the new path has run quietly for days, remove the old
   column in its own tiny deploy.

If step 3 feels like effort you'd rather skip: skip it. An unused column is
harmless; a dropped column is forever.

## When something goes wrong

**A deploy broke behaviour (data is fine)** — roll the code back:
```
git revert <bad-commit>   # a new commit that undoes it — never git reset
npm run build
pm2 restart galimotors
```

**Data is damaged** — restore the newest good backup:
```
pm2 stop galimotors
copy backups\galimotors-<newest>.db prisma\dev.db     # (cp on Linux)
del prisma\dev.db-wal prisma\dev.db-shm               # stale WAL must not be replayed
pm2 start galimotors
```
Then check `/api/health` and one car page. Anything written between that
backup and the restore is lost — that window is at most a day (nightly), and
minutes if you ran `npm run db:backup` before the risky step, which is the
whole point of rule 3.

**Not sure which?** Restore-from-backup loses recent writes; revert-the-code
loses nothing. Prefer revert unless data is definitely damaged.

## Deploying on Vercel + Neon (the chosen stack)

The app also runs serverless on Vercel with the database on Neon (Postgres).
A few things behave differently there than on a persistent VPS — none fatal,
but know them:

- **Backups are Neon's job.** The SQLite backup routines here detect a
  non-SQLite `DATABASE_URL` and cleanly disable themselves (nightly job,
  startup snapshot, `npm run db:backup`, WAL pragmas — all no-op). Neon keeps
  automatic backups with **point-in-time restore**; check the retention on
  your plan (free tier is short). For an independent off-site copy, schedule
  a `pg_dump` (GitHub Actions on a cron, or Vercel Cron hitting a small
  protected endpoint) to S3/Drive.
- **The cron jobs do NOT run on Vercel.** `node-cron` needs a always-on
  process; serverless functions only wake on a request. That means the
  **sold-car Cloudinary cleanup and reservation-expiry jobs won't fire on
  their own** — important, because the Cloudinary free tier is the only image
  store and won't self-clean. Fix when you deploy: add a **Vercel Cron** entry
  that calls a protected endpoint which runs `runSoldCarsCleanup()` /
  reservation expiry (guard it with a secret header). Ask and this can be
  wired up.
- **In-memory state resets per cold start** — the login lockout and token
  blacklist live in memory, so on serverless they're best-effort. The
  per-account lockout still slows a sustained attack; the IP rate-limit is the
  durable layer. Fine to launch with; move to Redis if abuse appears.
- **Switch the Prisma datasource to `postgresql`** and set `DATABASE_URL` to
  the Neon connection string (pooled URL for the app). Run `prisma db push`
  against Neon once to create the schema. Smoke-test again on Neon after the
  switch — the local smoke test runs against SQLite.

## Admin accounts & password recovery

**In production the environment IS the super admin.** With
`SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD` set (they are permanent
variables, not one-time bootstrap), every boot enforces: that account
exists, holds the ONLY `SUPER_ADMIN` role (others are demoted to
`SUB_ADMIN`), and has exactly that password. To change the live admin
password: change the variable in Vercel and redeploy. Locked out? The
variables ARE the recovery — set them and redeploy.

There is no self-service "forgot password" (it needs email, which isn't
wired). A SUPER_ADMIN can reset any teammate's password in the Users
screen. Locally (variables unset), use the CLI instead of editing the
database by hand:

```
npm run admin -- list                              # who exists, flags seed/test logins
npm run admin -- reset  <email> "<NewStrongPass1!>"  # recover a login
npm run admin -- create <email> "<Name>" SUPER_ADMIN "<pass>"
npm run admin -- promote <email> SUB_ADMIN
npm run admin -- delete <email>
```

To fix a locked-out **live** system, run it locally pointed at production:
`DATABASE_URL="<neon url>" npm run admin -- reset <email> "<newpass>"`.
It refuses to delete or demote the last SUPER_ADMIN, and enforces the same
password strength as the app.

## Deployment notes (when we go live)

- Run under a process manager so crashes self-heal:
  `pm2 start dist/index.js --name galimotors && pm2 save`
- Env on the server: `DATABASE_URL`, `JWT_SECRET`, Cloudinary keys,
  `PUBLIC_SITE_URL=https://<real-domain>` (feed + sitemap links).
- SQLite is the right size for one dealership on one server. The signal to
  move to Postgres: sustained "database is locked" errors in logs, or the
  day a second server/replica is needed. The Prisma schema ports almost
  unchanged; the playbook above stays the same.

## Security env & launch checklist

The server **refuses to boot in production** without the four JWT secrets —
that guard is intentional; do not add fallbacks. Set on the server:

- `NODE_ENV=production` — turns on HSTS, the CORS allowlist, and hides
  server error details from clients.
- `JWT_SECRET_ADMIN`, `JWT_REFRESH_SECRET_ADMIN`, `JWT_SECRET_CUSTOMER`,
  `JWT_REFRESH_SECRET_CUSTOMER` — four DIFFERENT long random strings.
  Generate each with: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
- `CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com` — the
  front-end origins allowed to call the API. Empty in production means
  "same-origin only" (fine when the API serves the built site itself).
- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
  `CLOUDINARY_API_SECRET`.

**Rotate before any public git remote.** `.env` is no longer tracked, but
older commits in local history still contain the previous secrets. Before
pushing anywhere public, generate fresh JWT secrets and rotate the
Cloudinary key, or the history leaks them.

**What's enforced now (verified live):** every admin/analytics/user/upload
route rejects unauthenticated calls (401); sellers and market attendants
cannot list/create users, approve cars, or edit a listing's status;
seller-created cars are forced to PENDING_APPROVAL regardless of what the
request sends; pending/hidden cars are invisible to the public API even by
direct ID; login is IP-throttled on failed attempts and per-account
locked; server errors no longer leak stack traces or DB internals to
clients.
