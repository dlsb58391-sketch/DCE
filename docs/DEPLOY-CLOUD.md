# BDIC — Free Cloud Deploy (no VPS) → WhatsApp booking live

Goal: put the site + WhatsApp webhook on a **free, always-on public URL** so Meta can
deliver patient messages and the booking bot replies. We use **Render** (clean free tier
with a free Postgres). **Railway** works the same way (notes at the end).

> Why a host at all? Meta only *delivers* WhatsApp messages — it can't run your bot's logic.
> The host runs the code and exposes the webhook Meta calls. (See WHATSAPP-AGENT.md.)

---

## ⚠️ Read first: data persistence
The app defaults to **SQLite** (a file) which **does NOT persist** on free hosts (disk is wiped
on redeploy/restart). For real clinic data you MUST use **Postgres** (free on Render/Railway).
The code already supports it — it's a 1-line schema switch below.

Uploaded files (x-rays) also need persistent storage; on free tiers they're ephemeral. Fine for
testing; for production use a Postgres + an object store (or the VPS) later.

---

## Part A — Switch to Postgres (required for real use)
1. In `prisma/schema.prisma` change:
   ```prisma
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
2. Commit it. (Render will create the DB and run migrations.)

> Keep SQLite for local dev by only changing it on the deploy branch, OR just use Postgres
> locally too. Migrations already exist and apply cleanly to Postgres.

---

## Part B — Push your repo (already on GitHub)
Your code is at `github.com/moatasemtameromran-crypto/bdic-dental-site`. Make sure your latest
commits are pushed (`git push origin main`). Render deploys straight from GitHub.

---

## Part C — Deploy on Render (free)
1. Go to **https://render.com** → sign up with GitHub.
2. **New → Postgres** → free plan → create. Copy its **Internal Database URL**.
3. **New → Web Service** → pick your `bdic-dental-site` repo.
4. Settings:
   - **Runtime:** Node
   - **Build command:** `npm ci && npx prisma generate && npm run build`
   - **Start command:** `npx prisma migrate deploy && node prisma/seed.mjs && npm run start`
   - **Instance type:** Free
5. **Environment variables** (Add from `.env.example`):
   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Render Postgres Internal URL |
   | `AUTH_SECRET` | a long random string |
   | `APP_URL` | `https://your-app.onrender.com` (Render gives this) |
   | `NEXT_PUBLIC_SITE_URL` | same as APP_URL |
   | `WHATSAPP_PROVIDER` | `metaCloud` |
   | `WHATSAPP_TOKEN` | your Meta token |
   | `WHATSAPP_PHONE_ID` | `1146845331854259` |
   | `WHATSAPP_VERIFY_TOKEN` | invent a secret (used in Part D) |
   | `WHATSAPP_APP_SECRET` | Meta → App → Settings → Basic → App Secret |
   | `NEXT_PUBLIC_CLINIC_WHATSAPP` | clinic bot number, digits only |
6. **Create Web Service** → wait for the build → you get a public URL like
   `https://bdic-dental-site.onrender.com`.
7. Open it → the site should load. Login still `doctor@bdic.clinic` / `bdic12345`
   (change the password after first login!).

---

## Part D — Connect Meta webhook (this turns on WhatsApp booking)
1. In Meta → your app → **WhatsApp → Configuration → Webhook → Edit**:
   - **Callback URL:** `https://your-app.onrender.com/api/whatsapp/webhook`
   - **Verify token:** the same `WHATSAPP_VERIFY_TOKEN` you set on Render
   - Click **Verify and save** (our endpoint answers the challenge automatically).
2. Under **Webhook fields**, click **Subscribe** on **messages**.
3. Done. Send "حجز" from any WhatsApp to your clinic bot number → the bot replies and books. ✅

---

## Part E — Verify it's live
```bash
# from anywhere:
curl https://your-app.onrender.com/api/health        # {"status":"ok","db":"up"}
```
- Health OK → server + DB good.
- Send a WhatsApp message → bot replies → check the dashboard's bookings.

---

## Free-tier note (Render)
Render's free web service **sleeps after ~15 min idle** and wakes on the next request (a few
seconds' delay). For a booking bot that's usually fine. To avoid sleeping, use a paid instance
later, or your **Hostinger VPS** (no sleep) — same code, same steps.

---

## Railway alternative (same idea)
1. **https://railway.app** → New Project → Deploy from GitHub repo.
2. Add a **Postgres** plugin → it sets `DATABASE_URL` automatically.
3. Add the same env vars as above.
4. Build: `npm ci && npx prisma generate && npm run build`
   Start: `npx prisma migrate deploy && node prisma/seed.mjs && npm run start`
5. Railway gives a public domain → use it for the Meta webhook (Part D).

---

## What stays the same regardless of host
- Meta webhook URL = `<public-url>/api/whatsapp/webhook`
- The "Confirm on WhatsApp" button + booking agent are already built.
- `npm run whatsapp:check` validates your Meta token anytime.
