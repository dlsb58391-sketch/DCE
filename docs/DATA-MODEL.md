# BDIC — Data Model

ORM: **Prisma**. Source of truth: `prisma/schema.prisma`.
Dev DB: SQLite (`prisma/dev.db`). Production target: PostgreSQL (change `provider` + `DATABASE_URL`, then `npm run db:deploy`).

---

## Entity overview

```
User (clinic staff login)

Patient ──1:N──► Appointment ──1:N──► Message
                     │
PatientFile (linked by patientKey string, not a FK)
Setting (key/value config)
```

---

## Models

### User — clinic staff who can sign in
| Field | Type | Notes |
|---|---|---|
| id | String PK (cuid) | |
| email | String **unique** | lowercased on login |
| passwordHash | String | bcrypt |
| name | String | |
| role | String | `doctor` \| `admin` \| `staff` (default `doctor`) |
| createdAt | DateTime | |

### Patient — a person who has booked
| Field | Type | Notes |
|---|---|---|
| id | String PK (cuid) | |
| name, phone | String | |
| email, gender, notes | String? | gender = `male`\|`female` |
| source | String | `booking` \| `manual` |
| appointments | Appointment[] | relation |
| **index** | `@@index([phone])` | |

### Appointment — drives the whole confirm → WhatsApp → queue flow
| Field | Type | Notes |
|---|---|---|
| id | String PK (cuid) | |
| code | String **unique** | short public code used in `/track/<code>` |
| patientName, phone | String | denormalised for fast display |
| serviceId, serviceLabelEn, serviceLabelAr | String | |
| scheduledAt | DateTime | absolute start; **stage is derived from this** |
| durationMin | Int (30) | |
| status | String | `pending`\|`confirmed`\|`declined`\|`completed`\|`cancelled` |
| complaint, offerTitle, notes | String? | |
| lang | String | patient's message language |
| confirmedAt, reminderSentAt, queueOpenedAt, turnSentAt, completedAt | DateTime? | lifecycle timestamps |
| patientId | String? FK → Patient | optional link |
| messages | Message[] | relation |
| **indexes** | `@@index([status, scheduledAt])`, `@@index([phone])` | |

### Message — WhatsApp audit log + idempotency
| Field | Type | Notes |
|---|---|---|
| id | String PK | |
| appointmentId | FK → Appointment | `onDelete: Cascade` |
| phone | String | |
| kind | String | `reserved`\|`reminder`\|`queue`\|`turn`\|`custom` |
| body | String | rendered message text |
| provider | String | `mock`\|`metaCloud`\|`wa.me` |
| status | String | `queued`\|`sent`\|`delivered`\|`failed` |
| waLink, error | String? | |
| createdAt, sentAt | DateTime | |
| **index** | `@@index([appointmentId, kind])` | one-per-kind lookups = idempotency |

### Setting — key/value config
| Field | Type | Notes |
|---|---|---|
| key | String PK | |
| value | String | JSON-encoded (clinic hours, feature flags…) |
| updatedAt | DateTime | |

### PatientFile — x-ray / photo / document metadata
| Field | Type | Notes |
|---|---|---|
| id | String PK | |
| patientKey | String | local patient id (e.g. `pt-ahmed`) or `Patient.id` — **string link, not a FK** |
| patientName | String? | |
| category | String | `xray`\|`photo`\|`document`\|`medical` (default `xray`) |
| title | String? | |
| fileName, mimeType | String | |
| size | Int | bytes |
| storagePath | String | path on disk under `UPLOADS_DIR` (binary is **off the DB**) |
| createdAt | DateTime | |
| **index** | `@@index([patientKey, createdAt])` | |

> **Note:** `PatientFile.patientKey` is intentionally a loose string so dashboard "seed"
> patients (e.g. `pt-ahmed`) and real `Patient` rows can both own files. A future cleanup
> could promote this to a proper FK once all patients are persisted.

### WaConversation — in-progress WhatsApp booking chat
| Field | Type | Notes |
|---|---|---|
| id | String PK | |
| phone | String **unique** | one row per chat |
| state | String | `idle`\|`service`\|`date`\|`time`\|`name`\|`confirm` |
| draft | String? | JSON of the booking being collected (service, date/time, name) |
| lang | String | `ar` \| `en` (default `ar`) |
| createdAt, updatedAt | DateTime | |
| **index** | `@@index([updatedAt])` | for pruning stale chats |

> Drives the WhatsApp booking agent (see `docs/WHATSAPP-AGENT.md`). On confirm, the draft is
> turned into a normal `Appointment` (status `pending`) via the shared `createBooking()`.

---

## Lifecycle stage logic (computed, not stored)

`stageOf(appointment, now)` in `src/lib/server/appointments.ts`:

| Condition | Stage |
|---|---|
| status `declined` / `cancelled` / `completed` / `pending` | same name |
| confirmed & `minutesUntil ≤ 0` | `turn` |
| confirmed & `≤ QUEUE_LEAD_MIN` (60) | `queue` |
| confirmed & `≤ REMINDER_LEAD_MIN` (120) | `reminder` |
| confirmed, otherwise | `reserved` |

`patientsAhead()` counts confirmed, not-yet-completed appointments earlier the same day —
that's the "N patients ahead of you" number.

---

## Migrations

| Migration | Adds |
|---|---|
| `20260620215010_init` | User, Patient, Appointment, Message, Setting |
| `20260621052309_patient_files` | PatientFile |
| `20260627112143_wa_conversation` | WaConversation |
| `20260709000001_audit_and_token_version` | `AuditLog` table + `User.tokenVersion` (session revocation + audit trail) |
| `20260709000002_money_decimal` | Converts all monetary columns from float to `NUMERIC(12,2)` / percentages to `NUMERIC(5,2)` (exact money) |
| `20260709000003_data_constraints` | Domain CHECK constraints: non-negative money, percentages `0..100`, valid `Appointment.status` and `Payment`/`DoctorPayout.method` |
| `20260709000004_performance_indexes` | Indexes on FKs `TreatmentRecord.procedureId`, `Payment.treatmentRecordId`, `Appointment.patientId`, and `Appointment.scheduledAt` |

**Money is stored as exact `Decimal`** (SQL `NUMERIC`), never float, so balances,
commissions, and revenue cannot drift through binary rounding. The API converts
Decimal↔number at the server boundary (`src/lib/server/money.ts`), so JSON stays
numeric and the frontend is unaffected. See `docs/DEPLOY-RAILWAY.md` for the
money migration deploy order.

**Domain CHECK constraints** (migration `…_data_constraints`) are authored in raw
SQL because Prisma cannot express `CHECK` in `schema.prisma`. Prisma leaves these
unknown constraints untouched on later `migrate dev`/`deploy`, so they persist as
a defence-in-depth backstop behind the application-layer validation. The
migration compares enum columns case-insensitively and drops-if-exists before
adding, so it is safe to re-run; a documented rollback block sits at the bottom
of the migration file.

**List pagination is opt-in and header-based.** Collection endpoints accept
`?limit`/`?offset` (clamped) and return page metadata in the `X-Total-Count`,
`X-Limit`, `X-Offset`, `X-Has-More`, and `X-Next-Offset` response headers. With
no query params the response body and behaviour are identical to before, so the
frontend is unaffected. See `src/lib/server/pagination.ts`.

**Rules**
- Schema changes go through `npm run db:migrate` (dev) → commit the generated migration.
- Production applies them with `npm run db:deploy` (non-interactive).
- **Never** hand-edit a committed migration; add a new one.
- Always **back up before migrating production** (see RUNBOOK.md → Backup/Restore).
