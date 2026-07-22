# Cliniva Security Hardening

This document describes the security controls implemented during the recovery
sprints and the environment configuration they require. It is written for
operators deploying Cliniva and for engineers extending it.

## Required environment configuration

| Variable | Requirement | Enforced by |
| --- | --- | --- |
| `AUTH_SECRET` | Must be set, **>= 32 chars**, and not a known placeholder (`change-me`, `secret`, ...). Generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. | `secretKey()` in `src/lib/server/jwt.ts` throws on the first JWT operation; `instrumentation.ts` logs a CRITICAL warning at boot. |
| `WHATSAPP_APP_SECRET` | **Mandatory** when `WHATSAPP_PROVIDER=metaCloud`. Without it the webhook rejects every request (fail-closed). | `src/app/api/whatsapp/webhook/route.ts`; boot warning in `instrumentation.ts`. |
| `WA_SIMULATE_ENABLED` | Leave empty in production. Set to `1` only to expose `/api/whatsapp/simulate` for a non-`mock` provider, and even then it requires an authenticated session. | `src/app/api/whatsapp/simulate/route.ts`. |

## Controls implemented (Sprint 1 — Security & Reliability Hardening)

### 1. Dashboard route middleware (SEC-01)
`src/middleware.ts` (renamed from the dead `src/proxy.ts`, which Next.js never
executed) redirects unauthenticated requests for `/dashboard*` to `/login` and
attaches an `x-session-role` header for downstream handlers.

### 2. AUTH_SECRET strength validation (SEC-07)
Weak, short, or placeholder signing secrets are rejected so a copied
`.env.example` can never sign forgeable tokens in a real deployment.

### 3. WhatsApp webhook fail-closed signature check (SEC-06)
Against Meta's Cloud API the `x-hub-signature-256` HMAC is mandatory. A missing
`WHATSAPP_APP_SECRET` returns `503` instead of silently accepting unsigned
payloads that could inject messages into the booking agent.

### 4. Simulate endpoint gating (SEC-06)
`/api/whatsapp/simulate` stays open for the default `mock` provider (local
testing) but is `404` for live providers unless `WA_SIMULATE_ENABLED=1`, and
then only for authenticated sessions.

### 5. Path-traversal containment (SEC-08)
`resolveStored()` resolves the target with `path.resolve` and verifies it stays
strictly inside the uploads directory, throwing `storage_path_traversal`
otherwise. Applied to reads, writes, and deletes.

### 6. Upload content validation (SEC-11)
Uploads are validated by **magic bytes** (`mimeMatchesContent`) so a disguised
file (e.g. an executable renamed to `.png`) is rejected with `415`, and the
sanitized filename is checked for traversal components.

### 7. Safe file downloads (SEC-11)
The raw file stream sends `X-Content-Type-Options: nosniff`, an RFC 5987
`filename*`, and `Cache-Control: private, no-store`.

### 8. Login rate limiting (SEC-04)
`RateLimiter` (`src/lib/server/rate-limit.ts`) throttles login attempts to
**10 per 15 minutes** per client IP + identifier, returning `429` with
`Retry-After`. Successful logins clear the counter.

> Note: the limiter is in-memory and suited to a single-instance deployment.
> Horizontally scaled hosting should back it with a shared store (Redis) using
> the same `RateLimiter` interface.

### 9. Baseline security headers (SEC-09)
`next.config.ts` emits `X-Content-Type-Options`, `X-Frame-Options: SAMEORIGIN`,
`Referrer-Policy`, `X-DNS-Prefetch-Control`, and `Permissions-Policy` on every
response, plus `Strict-Transport-Security` on hosted HTTPS builds. A full
Content-Security-Policy (needs per-request nonces for Next's inline runtime) is
tracked as a follow-up.

## Controls implemented (Sprint 2 — Access Control & Financial Integrity)

### 10. Role-based access control (SEC-02)
`requireRole()` in `src/lib/server/guard.ts` enforces coarse roles on admin
routes; `OWNER_ROLES` gates owner-only financial and destructive operations.
Roles are read from the authenticated session, not from client input.

### 11. Session revocation via `tokenVersion` (SEC-12)
Each user row carries a `tokenVersion`; the JWT embeds it as `ver`. `guard.ts`
rejects any token whose `ver` no longer matches the database, so logout and
forced sign-out revoke **already-issued** tokens (DB-backed revocation rather
than stateless-until-expiry). Login/logout bump the version.

### 12. IDOR scoping on record reads (SEC-05)
`[id]` routes that return patient files resolve the record **scoped to its
owner** and reject cross-patient ids instead of trusting the path parameter,
closing insecure direct object references.

### 13. Audit trail (SEC-12)
An `AuditLog` table records actor, action, entity, and metadata for destructive
and financial operations (deletes, payouts, expense/price changes) via a shared
helper, giving a tamper-evident history for investigations.

### 14. Seed without default credentials (SEC-03)
`prisma/seed.mjs` refuses to create the first user with a baked-in password: in
production `SEED_DOCTOR_PASSWORD` is mandatory, so a fresh deployment can never
ship with a guessable default login.

### 15. Money stored as exact Decimal (DB-01)
All monetary columns are SQL `NUMERIC` (Prisma `Decimal`), not float, so
balances, commissions, and revenue cannot drift through binary rounding. See
`docs/DATA-MODEL.md` and `docs/DEPLOY-RAILWAY.md` (migration deploy order).

## Controls implemented (Sprint 3 — Data Integrity & API Robustness)

### 16. Server-side input validation
Every write endpoint parses its body through a `zod` schema
(`src/lib/server/validate.ts`) before touching the database, rejecting malformed
input with a consistent `{ error, message, details }` envelope instead of relying
on ad-hoc per-field checks. Schemas are intentionally at least as permissive as
the previous hand-rolled parsing, so no previously-valid request is now refused.

### 17. Database CHECK constraints
Migration `…_data_constraints` adds domain CHECK constraints (non-negative money,
percentages `0..100`, valid appointment status and payment method) as a
defence-in-depth backstop that holds even if a future code path or manual SQL
tries to write invalid values. See `docs/DATA-MODEL.md`.

### 18. Structured logging with secret redaction
`src/lib/server/logger.ts` emits JSON-Lines logs whose fields are deep-scrubbed
for credential-like keys (password, token, secret, cookie, authorization, otp,
card numbers, connection strings) and length/depth-bounded, so request logs never
leak secrets or unbounded payloads. `http.ts` `withRoute()` correlates each
request with an `x-request-id` and records method, route, user id, status and
duration; error stacks and DB error codes are logged server-side only and never
returned to the client.

## Controls implemented (Sprint 4 — Enterprise Readiness)

### 16. Centralized environment validation
`src/lib/server/env.ts` `checkEnv()` validates all critical configuration at boot
(`AUTH_SECRET` strength, `DATABASE_URL`, Meta-provider secrets) and flags
less-secure setups as warnings (`WA_SIMULATE_ENABLED` on a live provider, missing
`WA_AGENT_SECRET`/`CRON_SECRET`). `instrumentation.ts` reports each finding through
the structured logger, so misconfiguration is visible immediately and in one place.

### 17. Owner-only operational metrics
`GET /api/admin/metrics` is gated by `requireRole(OWNER_ROLES)` and returns only
aggregate request counts and latency quantiles — no patient, financial, or
credential data. Latency is held in a bounded in-memory buffer that resets on
restart.

### 18. Uniform request instrumentation and safe error envelopes
`withRoute()` is applied across the app's own API (34 additional handlers). Every
wrapped route emits a redacted `api_request` log line, records metrics, returns
`x-request-id`/`x-api-version`, and converts any uncaught exception into a generic
`{ "error": "internal_error", "requestId" }` 500 — stacks and DB error codes stay
server-side. High-frequency WhatsApp worker-polling routes and the Meta webhook are
intentionally excluded to avoid log flooding and preserve their response contracts.

## Controls implemented (Sprint 6 — Data Safety: Soft-Delete, Recycle Bin, Backups)

### 19. Recoverable deletes (soft-delete) with audit
Deletes of sensitive records now stamp `deletedAt`/`deletedBy` instead of physically
removing rows, and a Prisma client extension hides trashed rows from all normal reads.
This prevents accidental or malicious permanent data loss and preserves financial and
medical history for recovery. Every delete, restore, and purge is written to `AuditLog`
with the acting user, so destructive actions are attributable.

### 20. Least-privilege Trash controls
The Trash API enforces role separation: listing and restoring require owner roles
(`requireRole(OWNER_ROLES)`), while **permanent** deletion (`POST /api/admin/trash/purge`)
is restricted to the Super Admin (`admin`) role. Purge is refused with `409` when the
record is still referenced by financial/medical history unless a Super Admin explicitly
forces it, so irreversible removal can't happen by accident or via a lower-privileged
account. Purging a patient file also deletes its stored bytes so no orphaned PHI remains.

### 21. Automated database backups
`npm run db:pg-backup` produces `pg_dump -Fc` snapshots (including soft-deleted rows)
with a manifest and retention pruning, and **redacts database credentials** from all log
output. RUNBOOK section 5 documents scheduling, offsite copy, and a verified restore
drill, reducing the blast radius of data loss or ransomware.

## Controls implemented (Sprint 7–8 — Enterprise Inventory)

### 22. Authorization, validation and audit on inventory writes
Every inventory mutation (suppliers/items CRUD, receive, adjust, delete) requires owner
roles (`requireRole(OWNER_ROLES)`); reads require an authenticated session. All request
bodies are Zod-validated (rejecting negative quantities/costs and malformed input with
`422`), and each write is recorded in `AuditLog` with the acting user. The dashboard hides
write controls from non-owner roles, but enforcement is server-side.

### 23. Ledger integrity and oversell prevention
Stock levels are derived from an append-only `StockMovement` ledger and per-batch
`remainingQty`; they are never stored on the item, so a tampered or racing request cannot
silently desynchronize the quantity. Decrements run inside a `$transaction` with a
conditional update (`remainingQty >= qty`), so concurrent draws can never drive stock
negative — the losing transaction rolls back with `insufficient_stock` (409). Soft-deleted
suppliers/items follow the same least-privilege Recycle Bin controls (§19–20).

### 24. Purchase-order authorization and receive integrity (Sprint 8)
Every purchase-order mutation (create, edit, submit, cancel, delete, receive) requires
owner roles; reads require an authenticated session, and each write is Zod-validated and
audited. Receiving is gated by the server-side lifecycle guards (only `submitted` /
`partially_received` POs can receive) and rejects over-receipt — a line can never be
received beyond its ordered quantity, even when the same line is repeated within one
payload (`over_receipt`, 400), validated before any write. All receipts for a request are
applied in a single `$transaction` through the same audited stock-receipt path as manual
receiving, so a partial failure leaves neither phantom stock nor an advanced
`receivedQty`. Deleting a PO is a soft delete of the order document only; received stock,
batches, and ledger movements are never reversed.

## Testing

Pure security logic is covered by `node --test` unit tests:

- `tests/unit/storage-path.test.mjs` — traversal containment
- `tests/unit/auth-secret.test.mjs` — secret validation
- `tests/unit/magic-byte.test.mjs` — upload signature checks
- `tests/unit/rate-limit.test.mjs` — throttling window/reset
- `tests/unit/rbac.test.mjs` — role/owner gating
- `tests/unit/seed-password.test.mjs` — no default credentials
- `tests/unit/money.test.mjs` — exact Decimal money conversion
- `tests/unit/timezone.test.mjs` — Cairo timezone slot consistency
- `tests/unit/appointment-code.test.mjs` — unique-code allocation race
- `tests/unit/validation.test.mjs` — zod input-validation primitives
- `tests/unit/pagination.test.mjs` — limit/offset clamping + page headers
- `tests/unit/logger.test.mjs` — secret redaction + error/DB describe
- `tests/unit/env.test.mjs` — boot env validation (errors vs warnings)
- `tests/unit/health.test.mjs` — readiness payload + build metadata
- `tests/unit/metrics.test.mjs` — quantiles + bounded metric collection
- `tests/unit/soft-delete.test.mjs` — read-scoping transform + cascade map
- `tests/unit/soft-delete-cascade.test.mjs` — delete cascade child selection
- `tests/unit/soft-delete-restore.test.mjs` — restore/purge/reference-block logic
- `tests/unit/pg-backup.test.mjs` — dump args, URL redaction, retention pruning
- `tests/unit/inventory.test.mjs` — on-hand/valuation, FEFO allocation, low-stock/expiry
- `tests/unit/purchase-orders.test.mjs` — PO lifecycle guards + ordered/received/remaining roll-ups

Run: `npm run test:unit`

## Dependency advisories (production)

Tracked via `npm audit --omit=dev`. Current disposition:

- **postcss GHSA-qx2v-qp2m-jg93 (moderate) - FIXED.** A `package.json`
  `overrides` pins `postcss` to `^8.5.15`, deduping the tree to the patched
  `8.5.16`. The `npm audit fix --force` remedy was rejected because it downgrades
  Next 16 to 9; the same-major override is verified with a full `next build`.
- **uuid GHSA-w5hq-g745-h8pq (moderate) - ACCEPTED (not reachable).** The bounds
  issue triggers only for `uuid` v3/v5/v6 with a caller-supplied `buf`. The lone
  consumer `exceljs@4.4.0` calls only `v4()` without a buffer and the app uses no
  `uuid` directly, so no code path reaches the flaw. A `uuid@>=11` override would
  violate exceljs's `^8.3.0` range; deferred until exceljs supports uuid v11.

## Deferred / follow-up (require Product Owner approval — see roadmap)

- **Content-Security-Policy** — needs nonce integration with the app shell.
- **Timezone rewrite for multi-region** — the current fix pins the process to
  `Africa/Cairo` (see `docs/DEPLOY-RAILWAY.md`); true per-clinic timezones are a
  future enhancement.
