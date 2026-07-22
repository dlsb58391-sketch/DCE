# BDIC — Badawi Dental Implant Center — Website

Modern 2026 bilingual (Arabic RTL / English LTR) dental clinic website built with **Next.js 16 + Tailwind CSS v4**, with a real backend (Prisma) and WhatsApp booking automation.

This is **Dashboard 1 of 4**: the main / reception landing page (doctor portfolio, services, cases, team, reviews, contact) plus the doctor operations dashboard. More dashboards will be added step by step.

## 📚 Documentation
Full technical docs live in [`docs/`](./docs):
- [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — stack, request flows, scheduler, folder map
- [API-REFERENCE.md](./docs/API-REFERENCE.md) — all 11 endpoints
- [DATA-MODEL.md](./docs/DATA-MODEL.md) — Prisma models, relations, stage logic
- [REQUIREMENTS-TRACEABILITY.md](./docs/REQUIREMENTS-TRACEABILITY.md) — feature → status map
- [RUNBOOK.md](./docs/RUNBOOK.md) — deploy, env, backup/restore, rollback, troubleshooting
- [HANDOVER.md](./docs/HANDOVER.md) — accounts, known issues, security, checklist
- [WHATSAPP-AGENT.md](./docs/WHATSAPP-AGENT.md) — WhatsApp booking agent: flow, architecture, go-live
- [WHATSAPP-META-SETUP.md](./docs/WHATSAPP-META-SETUP.md) — step-by-step Meta Cloud API credential setup
- [DEPLOY-CLOUD.md](./docs/DEPLOY-CLOUD.md) — free cloud deploy (Render/Railway) to make WhatsApp booking live, no VPS
- [WHATSAPP-FREE-WORKER.md](./docs/WHATSAPP-FREE-WORKER.md) — free WhatsApp bot on your own number (whatsapp-web.js, no Meta/card)
- [CHANGELOG.md](./CHANGELOG.md) — release history

## Features
- Bilingual AR/EN with a live language toggle (auto RTL/LTR, saved in localStorage)
- Sections: Hero, Services, About the doctor, Our Work (cases), Team, Reviews, Contact, Footer
- Modern design: glassmorphism nav, gradient blobs, scroll-reveal animations, hover effects
- Fully responsive with a mobile menu
- All text/data lives in `src/lib/content.ts` (placeholder content — edit there)

## Local development
```bash
npm install
cp .env.example .env        # then edit values (see Backend below)
npm run db:migrate          # create the SQLite database
npm run db:seed             # create the doctor login
npm run dev                 # http://localhost:3000
```

The dashboard lives at `/dashboard` and requires sign-in at `/login`.
Default dev credentials (change for production): `doctor@bdic.clinic` / `bdic12345`.

## Backend, database & WhatsApp automation

The site has a real backend (no longer localStorage-only):

- **Database** — Prisma ORM. SQLite by default (`prisma/dev.db`); switch to
  PostgreSQL on the VPS by changing `provider` in `prisma/schema.prisma` to
  `postgresql` and pointing `DATABASE_URL` at your Postgres, then
  `npm run db:deploy`.
- **Auth** — signed JWT session cookie (`jose`) + hashed passwords (`bcryptjs`).
  `/dashboard` is guarded by `src/proxy.ts`.
- **Booking → confirm → WhatsApp → live queue**
  1. A patient books on the landing page → `POST /api/bookings` (status `pending`)
     and gets a tracking link `/track/<code>`.
  2. The doctor confirms in the dashboard → `PATCH /api/admin/appointments/<code>`
     → a **"reserved"** WhatsApp message is sent immediately.
  3. **2 hours before** the slot → a reminder WhatsApp message.
  4. **1 hour before** → the tracker switches to a live **"patients ahead of you"**
     counter that ticks down until **"It's your turn"**.
- **Scheduler** — `node-cron` started from `instrumentation.ts`, runs every minute
  and fires the timed messages (idempotent). External cron can also hit
  `POST /api/admin/tick` with header `x-cron-secret: $CRON_SECRET`.
- **WhatsApp provider** (`WHATSAPP_PROVIDER` in `.env`):
  - `mock` (default) — logs messages to the DB, nothing is actually sent (great for testing).
  - `metaCloud` — real sending via the **Meta WhatsApp Cloud API**. Set
    `WHATSAPP_TOKEN` (permanent token) and `WHATSAPP_PHONE_ID` (phone number ID).
  - `wa` — no auto-send; the dashboard shows a one-tap `wa.me` link instead.
  - The confirmed booking card in the dashboard always offers a one-tap
    `wa.me` confirmation link as a manual fallback.

Demo helper: signed-in, `POST /api/admin/demo {"minutes":50}` creates a confirmed
appointment 50 min out so you can see the live queue immediately. The tracker also
accepts `/track/<code>?preview=reserved|reminder|queue|turn` to preview any stage.

### Turning on fully-automatic WhatsApp (Meta Cloud API)

By default nothing is actually sent (`mock`). To make real messages go out
automatically — the doctor taps **Confirm** and the patient instantly gets a
WhatsApp, then the reminder and live-queue messages fire on their own — connect
the **Meta WhatsApp Cloud API**. Meta requires **pre-approved templates** for
messages a business starts (you can't send free-form text proactively), so this
is a one-time setup that takes a few days for template review.

**1. Create the WhatsApp app (once)**
1. Go to <https://developers.facebook.com> → create an app → add the
   **WhatsApp** product. This creates a Meta Business account if you don't have one.
2. In **WhatsApp → API Setup** note your **Phone number ID** and generate a token.
   For production create a **permanent** token (System User in Business Settings),
   not the temporary 24-hour one.
3. Add and verify the clinic's sending phone number (a number not already on a
   normal WhatsApp account, or migrate it).

**2. Submit the 4 message templates**
In **WhatsApp Manager → Account tools → Message templates → Create**, make each
template below. Category **Utility**, and add **both** an English and an Arabic
version under the *same name*. Type the `{{n}}` placeholders exactly — the app
fills them in order.

> `bdic_booking_confirmed` — sent the moment the doctor confirms
> - EN body:
>   `Hi {{1}}, your appointment at Badawi Dental Implant Center is confirmed. Service: {{2}}. When: {{3}}. Track your visit live: {{4}}. We'll remind you before your turn.`
> - AR body:
>   `أهلاً {{1}}، تم تأكيد موعدك في مركز بدوي لزراعة الأسنان. الخدمة: {{2}}. الموعد: {{3}}. تابع موعدك مباشرة: {{4}}. سنذكّرك قبل دورك.`
> - Params: 1 = patient name, 2 = service, 3 = date/time, 4 = tracking link

> `bdic_appointment_reminder` — ~2 hours before
> - EN: `Hi {{1}}, reminder: your {{2}} appointment at Badawi Dental Implant Center is in about 2 hours. {{3}}. Follow your place in line live: {{4}}.`
> - AR: `أهلاً {{1}}، تذكير: موعد {{2}} في مركز بدوي لزراعة الأسنان بعد حوالي ساعتين. {{3}}. تابع دورك مباشرة: {{4}}.`
> - Params: 1 = name, 2 = service, 3 = date/time, 4 = tracking link

> `bdic_queue_update` — ~1 hour before (live queue opens)
> - EN: `Hi {{1}}, the doctor is almost ready for you. {{2}}. Follow your turn live: {{3}}.`
> - AR: `أهلاً {{1}}، الطبيب على وشك استقبالك. {{2}}. تابع دورك مباشرة: {{3}}.`
> - Params: 1 = name, 2 = "patients ahead" phrase (auto, e.g. *There are 3 patients ahead of you* / *You're next in line!*), 3 = tracking link

> `bdic_your_turn` — when it's their turn
> - EN: `Hi {{1}}, it's your turn now! The doctor is ready to see you at Badawi Dental Implant Center. Please head to reception.`
> - AR: `أهلاً {{1}}، حان دورك الآن! الطبيب جاهز لاستقبالك في مركز بدوي لزراعة الأسنان. برجاء التوجه إلى الاستقبال.`
> - Params: 1 = name

**3. Put the credentials in `.env`**
```bash
WHATSAPP_PROVIDER="metaCloud"
WHATSAPP_TOKEN="EAAG...your-permanent-token"
WHATSAPP_PHONE_ID="123456789012345"
APP_URL="https://your-domain.com"   # so tracking links are public & correct
# Only change these if you named the templates/languages differently in Meta:
WHATSAPP_TPL_RESERVED="bdic_booking_confirmed"
WHATSAPP_TPL_REMINDER="bdic_appointment_reminder"
WHATSAPP_TPL_QUEUE="bdic_queue_update"
WHATSAPP_TPL_TURN="bdic_your_turn"
WHATSAPP_LANG_EN="en"   # use "en_US" if that's the code Meta shows for your template
WHATSAPP_LANG_AR="ar"
```
Restart the server (`pm2 restart bdic`). That's it — confirming a booking now
sends real WhatsApp messages and the scheduler handles the rest. Until your
templates are **approved**, sends return an error which you can see per message
in the dashboard's **Bookings** tab; switch back to `WHATSAPP_PROVIDER="mock"`
anytime to test the flow without sending.

**Notes**
- Names/dates/links are passed as template *parameters*, so you don't re-submit a
  template per patient — one approved template serves everyone.
- Egyptian numbers are auto-normalised (`01222156274` → `201222156274`).
- The dashboard also keeps a one-tap `wa.me` link on each confirmed booking as a
  manual fallback (works with zero setup, but you tap send yourself).

---

## Deploy on a Hostinger VPS (Ubuntu)

### 1. Install Node + PM2 (once)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

### 2. Upload, configure & build
```bash
cd /var/www/bdic              # upload the project here (git clone or scp)
npm ci
cp .env.example .env          # then edit: set a strong AUTH_SECRET, APP_URL,
                              # WHATSAPP_PROVIDER + creds, DATABASE_URL
npm run db:deploy             # apply migrations to the database
npm run db:seed               # create the doctor user (set SEED_DOCTOR_* envs first)
npm run build
```

Generate a strong secret with:
`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

### 3. Run with PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # follow the printed command to enable on boot
```
The single PM2 process serves the site **and** runs the WhatsApp scheduler.

### 4. Nginx reverse proxy
`/etc/nginx/sites-available/bdic`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/bdic /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. Free SSL (HTTPS)
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
After HTTPS is live, set `APP_URL=https://yourdomain.com` in `.env` so WhatsApp
tracking links are correct, then `pm2 restart bdic`.

### Updating later
```bash
git pull
npm ci
npm run db:deploy
npm run build
pm2 restart bdic
```
