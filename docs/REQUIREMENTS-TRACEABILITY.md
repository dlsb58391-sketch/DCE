# BDIC — Requirements Traceability

Maps each requested capability to the screen/endpoint that implements it and its current status.
This directly answers the reviewer's "is it complete / does it match the requirements?" question.

**Status key:** ✅ done · 🟡 partial / needs config · 🧪 mock (works, not wired to a live 3rd party) · ⛔ not built yet

---

## 1. Landing page (reception site)

| # | Requirement | Where | Status |
|---|---|---|---|
| 1.1 | Modern bilingual UI (AR RTL / EN LTR) | `layout.tsx`, `lib/language.tsx`, all sections | ✅ |
| 1.2 | Hero with auto-cycling doctor team photos | `components/TeamHero.tsx`, `Hero.tsx` | ✅ |
| 1.3 | Services section | `components/Services.tsx` | ✅ |
| 1.4 | Before/After results gallery | `components/ResultsGallery.tsx` | ✅ |
| 1.5 | Videos section | `components/VideoShowcase.tsx` | ✅ |
| 1.6 | Doctor / team section | `components/Team.tsx` | ✅ |
| 1.7 | Reviews / testimonials | `components/Testimonials.tsx` | ✅ |
| 1.8 | Offers + popup | `components/Offers.tsx`, `OfferPopup.tsx` | ✅ |
| 1.9 | Booking form wired to backend | `components/BookingSection.tsx` → `POST /api/bookings` | ✅ |
| 1.10 | Fully offline-capable (no CDN/font calls) | self-hosted fonts + local images | ✅ |

## 2. Doctor dashboard

| # | Requirement | Where | Status |
|---|---|---|---|
| 2.1 | Secure doctor login | `/login` → `POST /api/auth/login`; guard `src/proxy.ts` | ✅ |
| 2.2 | Daily schedule / today's view | `DoctorDashboard.tsx` (overview), `DaySchedule.tsx` | ✅ |
| 2.3 | Booking management (confirm/decline) | `BookingRequests.tsx`, `OnlineBookings.tsx` → `PATCH /api/admin/appointments/[code]` | ✅ |
| 2.4 | Online bookings tab (live from site) | `OnlineBookings.tsx` → `GET /api/admin/appointments` | ✅ |
| 2.5 | Patient profiles | `PatientsSection.tsx` | ✅ |
| 2.6 | — medical history | `PatientsSection.tsx` (medical block) | ✅ |
| 2.7 | — session history | `PatientsSection.tsx` (sessions) | ✅ |
| 2.8 | — payment tracking | `PatientsSection.tsx` (payments) | ✅ |
| 2.9 | — uploaded files (x-ray/photo/doc) | `PatientFiles.tsx` → `/api/admin/patient-files` | ✅ |
| 2.10 | Offers manager | `OffersManager` (dashboard tab) | ✅ |
| 2.11 | Site content editor | `SiteEditor` (dashboard tab) | ✅ |
| 2.12 | Calendar tab | dashboard | ⛔ "Coming soon" (daily schedule already in Overview) |
| 2.13 | Settings tab | dashboard | ⛔ "Coming soon" |

## 3. Automation flow

| # | Requirement | Where | Status |
|---|---|---|---|
| 3.1 | Patient books from website | `POST /api/bookings` | ✅ |
| 3.1b | **Patient books from WhatsApp** (conversational agent) | `wa-agent.ts` + `/api/whatsapp/webhook` | ✅ logic; 🟡 live needs Meta creds + public URL |
| 3.2 | Doctor clicks confirm | `PATCH …/appointments/[code] {confirm}` | ✅ |
| 3.3 | Auto WhatsApp confirmation | `lib/server/appointments.ts` → `notify.ts`/`whatsapp.ts` | 🧪 mock by default; 🟡 live needs Meta Cloud creds |
| 3.4 | Auto reminder 2h before | scheduler `processTick()` (`REMINDER_LEAD_MIN=120`) | 🧪 / 🟡 |
| 3.5 | Live queue "patients ahead" | `Tracker.tsx`, `patientsAhead()` (`QUEUE_LEAD_MIN=60`) | ✅ logic; 🟡 WhatsApp push needs creds |
| 3.6 | "It's your turn" notification | stage `turn` + `kind:"turn"` message | 🧪 / 🟡 |
| 3.7 | Public live tracker page | `/track/[code]` | ✅ |

## 4. Non-functional / production-readiness

| # | Requirement | Status | Phase |
|---|---|---|---|
| 4.1 | Real backend + database | ✅ Prisma + 11 routes | — |
| 4.2 | Auth + route protection | ✅ JWT + bcrypt + proxy guard | — |
| 4.3 | Version control + clean history + tags | 🟡 being established | **1** |
| 4.4 | Technical documentation | ✅ this bundle | **1** |
| 4.5 | SEO (sitemap/robots/OG/JSON-LD) | ✅ done | **2** |
| 4.6 | Analytics (GA4 / Meta Pixel) | ✅ done (env-gated, off until IDs set) | **2** |
| 4.7 | Automated tests (e2e/unit) | ✅ done (5 e2e + 6 unit, all green) | **3** |
| 4.8 | Backups + restore procedure | ✅ done (`db:backup`/`db:restore`, reversible) | **3** |
| 4.9 | Staging environment | ✅ done (`staging:sync` → real-shaped data) | **3** |
| 4.10 | Monitoring / health checks | ✅ done (`/api/health` + `health` script) | **3** |

---

## How "live WhatsApp" gets turned on (3.3–3.6)

Today messages are generated and logged in the `Message` table with `provider:"mock"`
(nothing is actually sent — safe for demos). To go live:
1. Create a Meta WhatsApp Cloud API app + get a permanent token & phone number ID.
2. Get the 4 message templates approved (`bdic_booking_confirmed`, `bdic_appointment_reminder`,
   `bdic_queue_update`, `bdic_your_turn`).
3. Set `WHATSAPP_PROVIDER=metaCloud`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` in production env.
4. No code change required — see RUNBOOK.md → WhatsApp.
