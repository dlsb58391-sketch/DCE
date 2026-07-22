# BDIC — Handover

Everything a new engineer/owner needs to take over the project. Read this first, then
`ARCHITECTURE.md` → `API-REFERENCE.md` → `DATA-MODEL.md` → `RUNBOOK.md`.

---

## 1. What this project is
Bilingual (AR/EN) dental clinic website + doctor operations dashboard + booking/WhatsApp
automation for **Badawi Dental Implant Center**. See `REQUIREMENTS-TRACEABILITY.md` for the
full feature→status map.

## 2. Repository
- Stack & layout: `docs/ARCHITECTURE.md`.
- Source of truth for data: `prisma/schema.prisma`.
- Tagged releases (e.g. `v1.0.0`) mark known-good builds for rollback.

## 3. Run it
See `docs/RUNBOOK.md` §1–2. TL;DR: `npm install` → `npm run db:migrate` → `npm run db:seed`
→ `npm run dev`. Login `doctor@bdic.clinic` / `bdic12345`.

---

## 4. Credentials & accounts to set up / rotate

| Item | Where | Action on handover |
|---|---|---|
| Doctor login | DB (`User`) seeded `doctor@bdic.clinic` / `bdic12345` | **change password before production** |
| `AUTH_SECRET` | `.env` | generate a fresh strong secret in prod |
| `CRON_SECRET` | `.env` | set if using external cron for `/api/admin/tick` |
| WhatsApp (Meta Cloud) | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | create Meta app, approve templates, set creds |
| Database | `DATABASE_URL` | provision Postgres on the VPS for production |
| Hosting | Hostinger VPS (target) | domain + TLS (Nginx) |
| Analytics (Phase 2) | GA4 + Meta Pixel IDs | create properties, add IDs |

> No real secrets are committed. `.env` is git-ignored; `.env.example` documents every key.

---

## 5. Known issues / limitations (honest)

| Area | Note | Planned |
|---|---|---|
| Tests | No automated tests yet (Playwright is installed and used for recording) | Phase 3 |
| Lint debt | `npm run build` passes, but `npm run lint` reports ~15 `react-hooks/set-state-in-effect` errors (state hydrated from localStorage inside effects). Non-blocking at runtime; worth refactoring. | Phase 3 |
| SEO | No sitemap/robots/Open Graph/JSON-LD | Phase 2 |
| Analytics | No GA4 / Meta Pixel | Phase 2 |
| Staging | Single environment; no staging mirror | Phase 3 |
| Backups | Manual procedure documented; not yet automated | Phase 3 |
| Calendar/Settings tabs | "Coming soon" placeholders (daily schedule lives in Overview) | later dashboard |
| WhatsApp | `mock` by default; live needs Meta creds + approved templates | when clinic provides creds |
| `PatientFile.patientKey` | loose string link, not a FK (lets seed + real patients coexist) | promote to FK later |
| Local hosting | server stops if the laptop sleeps; needs VPS for 24/7 | move to VPS |
| 3rd-party photo branding | a couple of supplied team/case photos carry other clinics' marks | replace with clinic-owned media |

## 6. Security notes
- Passwords hashed with **bcrypt**; sessions are **signed JWT** in an HTTP-only cookie.
- `/dashboard` guarded by `src/proxy.ts`; all `/api/admin/*` call `requireSession()`.
- Patient binaries stored **outside** the DB under `UPLOADS_DIR` (git-ignored) and served
  only through an auth-guarded route.
- Before production: rotate `AUTH_SECRET` + doctor password, serve over HTTPS, set a real
  `CRON_SECRET`, lock down the uploads directory permissions.

## 7. TODO backlog (post Phase 1)
- **Phase 2:** sitemap.ts, robots.ts, Open Graph image, JSON-LD `LocalBusiness`,
  GA4 + Meta Pixel wiring, metadata per page.
- **Phase 3:** e2e tests (booking→confirm→tracker), unit tests for `stageOf`/`patientsAhead`,
  automated nightly backups, staging environment, health-check/monitoring.
- **Product:** build Calendar + Settings tabs; remaining 3 dashboards; replace branded stock media.

## 8. Handover checklist
- [ ] Repo access granted (private GitHub repo)
- [ ] `.env` provisioned from `.env.example` (secrets set)
- [ ] Postgres provisioned, `db:deploy` run, login seeded + password changed
- [ ] WhatsApp creds set (or left on `mock` intentionally)
- [ ] Domain + TLS configured on the VPS
- [ ] First backup taken and a restore tested
- [ ] Smoke test: book → confirm → tracker shows queue → "your turn"
