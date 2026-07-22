# BDIC — Runbook (Operations)

Practical procedures for running, deploying, backing up, and recovering the system.
Answers reviewer questions about deployment, rollback, and **testing without harming live data**.

---

## 1. Local development

```bash
cd dental-site
npm install
copy .env.example .env        # then edit values
npm run db:migrate            # create/upgrade the SQLite schema
npm run db:seed               # create the doctor login + demo data
npm run dev                   # http://localhost:3000
```
Login: `doctor@bdic.clinic` / `bdic12345` (dev only — **rotate for production**).

## 2. Local production-style run (current clinic demo setup)

```bash
npm run build
npm run start                 # or: pm2 start ecosystem.config.js
```
Helper `start-bdic.cmd` runs `next start` in an auto-restart loop. For a always-on
local machine, keep it plugged in and disable sleep (otherwise the server stops on sleep).

PM2 quick reference: `pm2 status` · `pm2 restart bdic` · `pm2 logs bdic` · `pm2 stop bdic`.

---

## 3. Environment variables

| Var | Purpose | Dev default |
|---|---|---|
| `DATABASE_URL` | DB connection | `file:./dev.db` |
| `AUTH_SECRET` | JWT signing secret | **set a strong unique value in prod** |
| `APP_URL` | base URL for links in messages | `http://localhost:3000` |
| `WHATSAPP_PROVIDER` | `mock` \| `metaCloud` \| `wa` | `mock` |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` | Meta Cloud API creds | empty |
| `WHATSAPP_USE_TEMPLATES`, `WHATSAPP_TPL_*`, `WHATSAPP_LANG_*` | template names/langs | preset |
| `WHATSAPP_DEFAULT_CC` | default country code | `20` |
| `REMINDER_LEAD_MIN` / `QUEUE_LEAD_MIN` | scheduler thresholds | `120` / `60` |
| `SCHEDULER_ENABLED` | in-process cron on/off | `1` |
| `CRON_SECRET` | guards `POST /api/admin/tick` | (set in prod if using external cron) |
| `UPLOADS_DIR` | patient-file storage dir | `./private-uploads` |

`.env` is git-ignored. Only `.env.example` (no secrets) is committed.

---

## 4. Production deploy (VPS + PostgreSQL)

1. **Provision Postgres**, set `DATABASE_URL` to it.
2. In `prisma/schema.prisma` set `provider = "postgresql"`.
3. Build & migrate:
   ```bash
   npm ci
   npm run build
   npm run db:deploy       # applies migrations non-interactively
   node prisma/seed.mjs    # first deploy only (creates the login)
   ```
4. Start under PM2 (`ecosystem.config.js`) behind Nginx (TLS).
5. Set production env: strong `AUTH_SECRET`, `APP_URL=https://…`, WhatsApp creds, `CRON_SECRET`.

---

## 5. Backup & restore  ← reviewer #6/#7

### SQLite (current)
```bash
# Backup (safe to run live): copy the DB file with a timestamp
copy prisma\dev.db backups\dev-YYYYMMDD-HHMM.db
# also back up patient binaries:
robocopy private-uploads backups\uploads-YYYYMMDD /E
```

### PostgreSQL (production)

**Automated tool (recommended):** `scripts/pg-backup.mjs` wraps `pg_dump` with
timestamped filenames, retention and an optional integrity check. It reads
`BACKUP_DATABASE_URL` (falling back to `DATABASE_URL`) and writes custom-format
dumps to `BACKUP_DIR` (default `./backups/postgres`).

```bash
npm run db:pg-backup                 # one snapshot -> backups/postgres/cliniva-<ts>.dump
npm run db:pg-backup -- --keep 30    # keep the 30 newest, prune older ones
npm run db:pg-backup -- --verify     # also run `pg_restore --list` on the new dump
```

- The dump is `-Fc` (custom, compressed) and includes **soft-deleted rows** — the
  Recycle Bin survives a restore. Each dump gets a `.manifest.json` sidecar.
- Requires the PostgreSQL client tools (`pg_dump`/`pg_restore`) on `PATH`. The
  script refuses to run against a SQLite URL (use the SQLite flow above instead).

**Restore** a custom-format dump into a target database:
```bash
# Into a fresh/empty DB (recommended): create it, then restore.
createdb cliniva_restore
pg_restore --no-owner --no-privileges -d "$RESTORE_DATABASE_URL" backups/postgres/cliniva-<ts>.dump

# Into an existing DB, replacing objects (DANGER — take a fresh backup first):
pg_restore --clean --if-exists --no-owner --no-privileges -d "$DATABASE_URL" backups/postgres/cliniva-<ts>.dump
```

**Manual one-liners** (if you prefer plain SQL dumps):
```bash
pg_dump "$DATABASE_URL" > backups/cliniva-YYYYMMDD-HHMM.sql      # backup
psql "$DATABASE_URL" < backups/cliniva-YYYYMMDD-HHMM.sql         # restore
```

**Golden rules**
- **Always back up immediately before** any `db:deploy` / migration / bulk edit.
- **Schedule** daily backups with retention and copy them **off-machine**
  (cron/Task Scheduler): `npm run db:pg-backup -- --keep 30 --verify`, then sync
  `backups/postgres/` to object storage (e.g. a free-tier S3/R2 bucket) or another host.
- **Test a restore** into a staging DB at least once before go-live, and
  periodically after (a backup you have never restored is not a backup).

---

## 6. Making changes safely against live data  ← reviewer #5/#7

Never test edits or migrations directly on production data.

```
1. Snapshot prod  → pg_dump (or copy dev.db)
2. Restore into a STAGING database/instance
3. Apply the change + test on staging (real-shaped data, zero risk)
4. Back up prod  → apply the SAME migration to prod  → smoke-test
5. If anything fails → restore the pre-change backup (see §7)
```

- Migrations are **additive and ordered**; prefer non-destructive changes
  (add column/table) over destructive ones. For destructive changes, do a
  data-migration step first and keep the backup.
- Feature-flag risky behaviour via the `Setting` table so it can be toggled off
  without a redeploy.

---

## 7. Rollback  ← reviewer #6

| Problem | Action |
|---|---|
| Bad code release | `git checkout <previous tag>` (e.g. `v1.0.0`) → rebuild → restart |
| Bad migration / data | restore the pre-change DB backup (§5) |
| Server won't stay up | `pm2 logs bdic` / check `bdic-run.log`; restart; verify port 3000 |

Because releases are **git-tagged**, rolling back to a known-good build is one checkout.

---

## 8. WhatsApp: mock → live

1. Meta WhatsApp Cloud API app → permanent `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID`.
2. Get templates approved: `bdic_booking_confirmed`, `bdic_appointment_reminder`,
   `bdic_queue_update`, `bdic_your_turn`.
3. Set `WHATSAPP_PROVIDER=metaCloud` (+ token/phone id) and restart. No code change.
4. Verify with one real test booking; check the `Message` table rows flip to `sent`.

---

## 9. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `ERR_CONNECTION_REFUSED` on :3000 | server not running (laptop slept/rebooted) | restart `start-bdic.cmd` / PM2; disable sleep |
| Dashboard redirects to /login | no/expired session cookie | sign in again; check `AUTH_SECRET` unchanged |
| Bookings tab empty | no pending appointments | seed demo bookings or wait for real ones |
| WhatsApp not sending | provider is `mock` or missing creds | set `metaCloud` + token/phone id |
| Images missing offline | external URL slipped in | keep assets under `/public`, no CDN links |
| Scheduler not firing | `SCHEDULER_ENABLED=0` | set `1`, or drive via `POST /api/admin/tick` |

---

## 10. Health check

```bash
curl -s -o NUL -w "%{http_code}" http://localhost:3000          # expect 200
curl -s -o NUL -w "%{http_code}" http://localhost:3000/login    # expect 200
```

---

## 11. Testing & CI (Phase 3)

```bash
npm run test:unit     # unit tests for the lifecycle stage logic (node --test)
npm test              # Playwright e2e (landing, SEO, health, booking->confirm->tracker)
npm run health        # ping /api/health on the running server
npm run db:backup     # timestamped snapshot of DB + uploads -> backups/
npm run db:restore    # restore newest backup (auto-saves current state first)
npm run staging:sync  # clone live DB -> prisma/staging.db for safe migration tests
```

**CI:** `.github/workflows/ci.yml` runs install -> lint -> migrate+seed -> unit -> build -> e2e on every push/PR to `main`.

**Recommended cadence:** schedule `npm run db:backup -- --keep 30` daily (Task Scheduler/cron); run `npm run health` from your monitor every few minutes.
