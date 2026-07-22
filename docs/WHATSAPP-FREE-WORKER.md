# BDIC — Free WhatsApp Bot (whatsapp-web.js, no Meta, no card)

Runs the booking bot on a **real WhatsApp number** by linking it like **WhatsApp Web** —
no Meta account, no payment card, no business verification. You scan a QR code once.

> ⚠️ **Unofficial.** This automates WhatsApp Web. It's free and uses your number, but
> WhatsApp could ban a number for heavy automated activity. Use a number you're OK
> dedicating to the clinic bot. For light booking traffic the risk is low.

---

## How it works
```
Patient's WhatsApp ──► your linked number (Chrome via whatsapp-web.js)
                              │ forwards the text
                              ▼
                    POST /api/whatsapp/agent  (the booking agent)
                              │ returns replies
                              ▼
                    worker sends the replies back on WhatsApp
```
The bot logic is the same one used everywhere else (`wa-agent`). The worker only adds the
WhatsApp connection.

---

## One-time setup
1. The site must be running (`npm start` or the dev server) — the worker calls it.
2. A shared secret links the two. It's already in `.env`:
   ```
   WA_AGENT_SECRET="...(auto-generated)..."
   APP_BASE_URL="http://localhost:3000"
   ```
3. Chrome is required. The worker auto-detects Google Chrome / Edge; on a Linux VPS set
   `CHROME_PATH=/usr/bin/chromium-browser` (install with `apt install chromium-browser`).

## Run it
```bash
npm run whatsapp:worker
```
- A **QR code** prints in the terminal.
- On the phone with the clinic's WhatsApp number: **WhatsApp → Settings → Linked Devices
  → Link a Device** → scan the QR.
- You'll see `[wa] READY ✅`. The bot is now live on that number.
- The login is saved in `.wwebjs_auth/` — you won't scan again unless you log out.

## Test it
From any other phone, message the linked number: **حجز** → the bot replies with the menu
and walks through the booking. New bookings appear in the doctor dashboard.

---

## Keep it running 24/7 (VPS)
On the Hostinger VPS, run the site **and** the worker under PM2:
```bash
pm2 start npm --name bdic-site   -- start
pm2 start npm --name bdic-worker -- run whatsapp:worker
pm2 save
```
- The worker auto-restarts if it drops.
- The phone must stay connected to the internet (like WhatsApp Web).
- Scan the QR once on the server's first run (PM2 logs show it: `pm2 logs bdic-worker`).

---

## Notes & limits
- **Keep the number's phone online** — if the phone goes offline for ~14 days, WhatsApp
  unlinks the device and you re-scan.
- **Don't commit `.wwebjs_auth/`** — it's your WhatsApp session (already git-ignored).
- This path needs **no `WHATSAPP_PROVIDER` change**; it bypasses the Meta layer entirely.
- If you later want the official route, the Meta Cloud API code is still there — see
  `docs/WHATSAPP-META-SETUP.md`.
