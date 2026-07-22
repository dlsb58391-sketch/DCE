# BDIC — Meta WhatsApp Cloud API Setup (step by step)

This maps Meta's official "Cloud API Get Started" steps to **the exact `.env` values**
this project needs. The integration code is already built — you only paste credentials.

> 💡 **Your flow is free.** Patients message you first (via the website's
> "Confirm on WhatsApp" button), which opens WhatsApp's 24-hour window. Replies inside
> it — including your confirmation — cost **$0**. See `docs/WHATSAPP-AGENT.md`.

---

## What you'll collect

| Meta gives you | Goes into `.env` as |
|---|---|
| Phone Number ID | `WHATSAPP_PHONE_ID` |
| Access token (temp to test, **permanent** for production) | `WHATSAPP_TOKEN` |
| A verify token **you invent** | `WHATSAPP_VERIFY_TOKEN` |
| App Secret (App → Settings → Basic) | `WHATSAPP_APP_SECRET` |
| — set this yourself — | `WHATSAPP_PROVIDER="metaCloud"` |

---

## Step 1 — Create the app (Meta steps 1–2)
1. Go to **https://developers.facebook.com/apps** → **Create App**.
2. Add app name + email.
3. Use case: **"Connect with customers through WhatsApp"** → **Next**.
4. Pick or create a **Business portfolio** → **Create app**.
5. You land on **Customize use case → Connect on WhatsApp → Quickstart**.

## Step 2 — Get Phone Number ID + a test token (Meta steps 2–3)
1. Click **Start using the API** → you're on **API Setup**.
2. Connect/create a **WhatsApp Business account** (Meta may auto-create one).
3. Copy the **Phone number ID** → this is `WHATSAPP_PHONE_ID`.
4. Click **Generate access token** → copy it → this is `WHATSAPP_TOKEN` (temporary, 24h — fine for first test).
5. Note the free **test "From" number** Meta provides.

## Step 3 — Put them in `.env` and verify
Edit `dental-site/.env`:
```bash
WHATSAPP_PROVIDER="metaCloud"
WHATSAPP_TOKEN="EAAG...your-token"
WHATSAPP_PHONE_ID="1234567890"
```
Then run the checker (tells you instantly if it works):
```bash
npm run whatsapp:check                  # validates token + phone id
npm run whatsapp:check +20100xxxxxxx    # also sends a test message to your number
```
> For the free test number, the recipient must be **added as a test number** in Meta
> API Setup (or have messaged you first). The checker explains any error it hits.

## Step 4 — Connect the webhook (Meta step 4)
This is how patient replies reach the bot. Needs a **public HTTPS URL**, so do this
**after deploying to the VPS** (localhost can't receive Meta webhooks).
1. Invent a secret string → set `WHATSAPP_VERIFY_TOKEN="some-secret"` in `.env`.
2. From **App → Settings → Basic**, copy **App Secret** → `WHATSAPP_APP_SECRET`.
3. In Meta → **WhatsApp → Configuration → Webhook**:
   - Callback URL: `https://YOUR-DOMAIN/api/whatsapp/webhook`
   - Verify token: the same `WHATSAPP_VERIFY_TOKEN`
   - **Subscribe** to the **messages** field.
4. Meta calls the URL to verify; our route echoes the challenge automatically.

## Step 5 — Permanent token for production (Meta step 5)
The temp token dies in 24h. For a token that lasts:
1. **Business Settings → System users → Add** → create one.
2. **Assign Assets** → your app (Manage app) + your WhatsApp account (Full control).
3. **Generate token** with permissions: `whatsapp_business_messaging`,
   `whatsapp_business_management`, `business_management`.
4. Put that token in `WHATSAPP_TOKEN`, restart, re-run `npm run whatsapp:check`.

## Step 6 — Done
- Patient taps **Confirm on WhatsApp** on the site → messages you → bot replies free.
- Or patient messages your number "حجز" → the booking agent runs the whole flow.
- Every message is logged in the `Message` table; check the dashboard.

---

## Quick troubleshooting (the checker decodes these for you)
| Symptom | Meaning | Fix |
|---|---|---|
| HTTP 190 | token expired/invalid | generate a fresh (or permanent) token |
| 131030 | recipient not allowed | add them as a test number, or have them message you first |
| webhook won't verify | token mismatch / not public | match `WHATSAPP_VERIFY_TOKEN`, use the HTTPS VPS URL |
| messages send but no replies arrive | webhook not subscribed | subscribe to **messages** in Configuration |

> Time zone: set `TZ=Africa/Cairo` on the VPS so "5 PM" means Cairo time.
