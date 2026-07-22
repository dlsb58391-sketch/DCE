# Deploy THE BOSS Dental Clinic to Railway (Postgres + Volume for uploads)

This deploys the **landing page + doctor dashboard** for THE BOSS Dental Clinic
(clinic slug `ibrahim`). The WhatsApp booking bot is intentionally **excluded**
(it needs Chromium + a persistent phone session — run it on a VPS later).

Data lives in a **Railway Postgres** service (its own clickable/browsable box on
the canvas). Uploaded x-rays/photos are kept on a **Railway Volume** mounted at
`/data`, so both survive every redeploy.

---

## 0. Prerequisites
- The repo is on GitHub: `moatasemtameromran-crypto/bdic-dental-site`.
  Push your latest commits first: `git push origin main`.
- A Railway account: https://railway.com

---

## 1. Create the project + service
1. Railway → **New Project** → **Deploy from GitHub repo** → pick
   `bdic-dental-site`.
2. Railway detects Nixpacks and starts a first build. It will fail/half-work
   until you add the variables and the volume below — that's expected.

## 2. Add the Postgres database + the uploads Volume
1. **Postgres:** Project canvas → **New → Database → Add PostgreSQL**. Railway
   creates a `Postgres` service. Leave it as-is; you'll reference its URL below.
2. **Volume (for uploads):** open the web service → **Settings → Volumes → New
   Volume** (or the **+ Volume** button on the service canvas).
3. **Mount path:** `/data`  → Create.
   This is where `uploads/` will live permanently (the database is in Postgres).

## 3. Set the service Variables
Service → **Variables** → **Raw Editor** → paste from `.env.railway.example`
and fill in the real values. The essential ones:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_CLINIC` | `ibrahim` |
| `CLINIC` | `ibrahim` |
| `PORT` | `8080` (must match your domain's target port) |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
| `UPLOADS_DIR` | `/data/uploads` |
| `AUTH_SECRET` | a long random string (see below) |
| `SEED_DOCTOR_EMAIL` | `doctor@theboss.clinic` |
| `SEED_DOCTOR_PASSWORD` | a strong password (change after first login) |
| `SEED_DOCTOR_NAME` | `Dr. Ibrahim Salah` |
| `WHATSAPP_PROVIDER` | `mock` |
| `SCHEDULER_ENABLED` | `0` |
| `TZ` | `Africa/Cairo` (clinic timezone — see note below) |

Generate `AUTH_SECRET`:
```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

> `NEXT_PUBLIC_CLINIC` **must** be present before the build — it is compiled
> into the site's branding. Railway applies variables at build + runtime, so
> setting it here is enough; just trigger a fresh deploy after saving.

> **`TZ=Africa/Cairo`** — appointment slot/day math reads the process timezone.
> Railway runs in UTC, which would drift ~2–3h from the Cairo times patients
> see. `instrumentation.ts` defaults `TZ` to `Africa/Cairo` at boot if unset, so
> this variable is a belt-and-suspenders (it also makes container logs/cron use
> Cairo). No data is migrated — stored instants are UTC and unchanged.

## 4. Deploy
- Service → **Deploy** (or push a new commit). Railway will:
  1. `npm ci --include=dev --omit=optional` → install (skips Chromium).
  2. `prisma generate` + `next build` → build the site.
  3. On start: `prisma migrate deploy` (creates the Postgres tables) →
     `node prisma/seed.mjs` (creates your dashboard login) → `next start`.

## 5. Get your URL + finish config
1. Service → **Settings → Networking → Generate Domain**. You'll get
   `https://<something>.up.railway.app`.
2. Add two more variables with that URL, then redeploy once:
   - `APP_URL=https://<something>.up.railway.app`
   - `NEXT_PUBLIC_SITE_URL=https://<something>.up.railway.app`

## 6. Verify
```
curl https://<something>.up.railway.app/api/health
# {"status":"ok","db":"up",...}
```
- Open the URL → THE BOSS landing page loads.
- Go to `/login` → sign in with `SEED_DOCTOR_EMAIL` / `SEED_DOCTOR_PASSWORD`
  → the doctor dashboard opens. **Change the password after first login.**

---

## Custom domain (optional)
Service → **Settings → Networking → Custom Domain** → add e.g.
`app.theboss.clinic`, then create the shown CNAME at your DNS provider. After it
verifies, update `APP_URL` + `NEXT_PUBLIC_SITE_URL` to the custom domain and
redeploy.

---

## Troubleshooting: "Healthcheck failure"
The build succeeded but Railway can't get a `200` from `/api/health`. Almost
always one of these:

1. **Port mismatch (most common).** Railway routes to a single target port and
   the healthcheck uses it too. The app must listen on that same port. This app
   binds to `$PORT` (start command: `next start -H 0.0.0.0 -p ${PORT:-8080}`).
   Make all three agree:
   - Domain → **target port = 8080** (you set this).
   - Service **Variable `PORT=8080`**.
   - That's it — app, domain, and healthcheck are all 8080.
2. **`DATABASE_URL` wrong / Postgres not reachable.** On boot the app runs
   `prisma migrate deploy` against Postgres. If `DATABASE_URL` doesn't point at
   the Postgres service, migrate crashes before the server starts. Fix: set
   `DATABASE_URL=${{Postgres.DATABASE_URL}}` (reference the Postgres service) and
   make sure that service is running. Uploads use the **Volume at `/data`**; if
   it's missing, `UPLOADS_DIR=/data/uploads` writes fail — add the volume.
3. **First boot is slow.** migrate + seed + start can take a bit; the healthcheck
   timeout is set to 300s, which is plenty. If it still times out, check the
   Deploy logs for the real error.

Check the **Deploy Logs** tab — the failing line (crash vs. wrong port) tells you
which of the above it is.

---

## Notes & gotchas
- **Money migration deploy order (recovery sprint).** The `20260709000002_money_decimal`
  migration converts all monetary columns from float to `NUMERIC(12,2)` in place
  via `ALTER COLUMN ... USING round(col, 2)`. It runs automatically as part of
  `prisma migrate deploy` on start (before `next start`), preserves existing
  values, and needs no app downtime. If you run migrations manually, apply it
  **before** deploying the new app build (the code expects Decimal columns).
- **Sprint 3 constraints & indexes.** `20260709000003_data_constraints` (domain
  CHECK constraints) and `20260709000004_performance_indexes` (FK + scheduledAt
  indexes) apply automatically with `prisma migrate deploy`, in sequence after
  the money migration. Both are additive and reversible (each migration documents
  its rollback), preserve existing rows, and need no downtime. The CHECK
  constraints only reject values the app already refused, so conforming data
  passes unchanged. For a very large existing `Appointment`/`Payment` table you
  may prefer to create the indexes out-of-band with `CREATE INDEX CONCURRENTLY`
  before deploy to avoid a brief write lock.
- **Single instance still recommended.** The uploads Volume at `/data` is a
  single disk, and the in-process reminder scheduler assumes one instance, so
  keep the web service at one replica. (Postgres itself handles concurrency
  fine, but multiple replicas would each get a separate uploads disk.)
- **Backups.** Postgres → Railway's **Backups** tab (or `pg_dump` via the
  service shell). Uploaded files live under `/data/uploads` on the Volume.
- **The bot / reminders.** `WHATSAPP_PROVIDER=mock` logs messages to the DB and
  the "Confirm on WhatsApp" wa.me links still work for patients. To run the real
  booking bot + scheduled reminders, deploy `worker/` on a machine with Chromium
  (a VPS) pointed at the same database — not Railway.
- **/product page.** The Clinva sales page is still bundled at `/product`. It's
  harmless but public; tell me if you want it blocked on this domain.
