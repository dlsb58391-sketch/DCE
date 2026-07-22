# BDIC — WhatsApp Booking Agent

A conversational agent that lets patients **book an appointment entirely from WhatsApp**.
The bot greets, shows the service menu, asks for the day/time, takes the name, confirms,
and creates a booking — which then flows into the existing doctor-confirm → reminder →
live-queue automation, exactly like a website booking.

---

## Conversation flow

```
Patient: حجز / book / hi
Bot:     welcome + numbered service menu (Check-up, Cleaning, … Implant, Crown)
Patient: 8                      (or the service name)
Bot:     "You chose: Implant. Which day?"  (e.g. بكرة / 30/6 / السبت)
Patient: بكرة
Bot:     "What time? (12 PM–10 PM)"        (e.g. 5 مساءً / 17:00)
Patient: 5 مساءً
Bot:     "Your full name?"
Patient: أحمد كمال
Bot:     confirmation summary → "تأكيد / إلغاء"
Patient: تأكيد
Bot:     "✅ Booking received! Code: ABC123. Track: <url>/track/ABC123"
```

- **Bilingual**: replies in Arabic or English, auto-detected from the patient's first message.
- **Validates**: rejects past dates, Fridays (clinic closed), and times outside 12:00–22:00.
- **Cancel anytime**: "إلغاء" / "cancel" resets the conversation.
- The booking is created with status **pending** — the doctor confirms it in the dashboard,
  which triggers the WhatsApp confirmation + reminder + live-queue messages already built.

---

## Architecture

| Piece | File | Role |
|---|---|---|
| Conversation engine | `src/lib/server/wa-agent.ts` | **Pure** bilingual state machine + date/time parsers (no I/O → unit-testable) |
| Runtime | `src/lib/server/wa-runtime.ts` | Loads/saves conversation, creates the booking, sends replies |
| Webhook | `src/app/api/whatsapp/webhook/route.ts` | Meta verification (GET) + inbound messages (POST) + signature check |
| Simulator | `src/app/api/whatsapp/simulate/route.ts` | Local testing without Meta (mock mode only) |
| State storage | `WaConversation` model | One row per phone: current step + draft JSON |
| Booking creation | `createBooking()` in `appointments.ts` | Shared with the website form (DRY) |

State machine: `idle → service → date → time → name → confirm → (create) → idle`.

---

## Testing locally (no Meta account needed)

The agent runs fully offline in `mock` mode (the default). Drive a conversation via the simulator:

```bash
# each call returns the bot's reply texts (+ bookingCode on confirm)
curl -X POST http://localhost:3000/api/whatsapp/simulate \
  -H "Content-Type: application/json" \
  -d '{"phone":"+201000000000","text":"حجز"}'
```

Automated coverage: `tests/e2e/whatsapp-agent.spec.ts` runs a full booking conversation and
the validation/cancel paths against the real agent. Run `npm test`.

> The simulator route returns **404 automatically when `WHATSAPP_PROVIDER` is not `mock`**,
> so it can never be reached in a live deployment.

---

## Going live (Meta WhatsApp Cloud API)

> **Cost note (the "free trick"):** Replies you send **within 24h of the patient messaging you**
> are free on Meta. So the website shows a **"Confirm on WhatsApp"** button that makes the
> *customer* message the clinic first (`confirmOnWhatsAppLink()` in `src/lib/site.ts`), opening
> that free window — the clinic's confirmation reply then costs **$0**. Only messages you send
> *first*, or more than 24h later, need a paid utility template. Set the clinic's number in
> `site.whatsapp`.

Requirements: a Meta WhatsApp Cloud API app, a verified sending number, and this route
reachable at a **public HTTPS URL** (i.e. deploy to the VPS — localhost won't work).

1. Set env:
   ```bash
   WHATSAPP_PROVIDER="metaCloud"
   WHATSAPP_TOKEN="...permanent token..."
   WHATSAPP_PHONE_ID="...phone number id..."
   WHATSAPP_VERIFY_TOKEN="...any secret you choose..."
   WHATSAPP_APP_SECRET="...Meta app secret..."
   APP_URL="https://your-domain.com"
   ```
2. In the Meta dashboard → WhatsApp → Configuration → **Webhook**:
   - Callback URL: `https://your-domain.com/api/whatsapp/webhook`
   - Verify token: the same `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to the **messages** field.
3. Meta calls the webhook `GET` to verify (we echo the challenge), then `POST`s incoming
   messages. Replies are sent as free-form text (allowed within the 24-hour customer-service
   window that opens when the patient messages you — no template needed for replies).

Security: when `WHATSAPP_APP_SECRET` is set, every POST is verified against the
`X-Hub-Signature-256` header before processing.

> Note on time zone: the agent builds appointment times in the server's local time. On the
> VPS, set `TZ=Africa/Cairo` so "5 PM" means 5 PM Cairo. The clinic's local PC is already
> in Egypt time.
