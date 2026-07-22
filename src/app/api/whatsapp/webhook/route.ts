import { NextResponse } from "next/server";
import crypto from "crypto";
import { processInbound } from "@/lib/server/wa-runtime";

/**
 * Meta WhatsApp Cloud API webhook.
 *
 * GET  — verification handshake. Meta calls with ?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
 *        We echo the challenge when the token matches WHATSAPP_VERIFY_TOKEN.
 * POST — inbound messages. We verify the signature (if WHATSAPP_APP_SECRET is set),
 *        extract each text message, and drive the booking agent.
 *
 * Going live needs: WHATSAPP_PROVIDER=metaCloud, a public HTTPS URL for this route,
 * WHATSAPP_VERIFY_TOKEN (any secret you choose, entered in the Meta dashboard), and
 * WHATSAPP_APP_SECRET (the app secret, for signature checks). See docs/RUNBOOK.md.
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (mode === "subscribe" && expected && token === expected) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

function signatureOk(appSecret: string, raw: string, header: string | null): boolean {
  if (!header) return false;
  const expected =
    "sha256=" + crypto.createHmac("sha256", appSecret).update(raw, "utf8").digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

type WaMessage = { from?: string; type?: string; text?: { body?: string } };

export async function POST(req: Request) {
  const raw = await req.text();

  // Signature verification. Against Meta's Cloud API the signature is mandatory:
  // fail closed if the app secret is missing so unsigned payloads can never be
  // injected into the booking agent. Other providers (mock/waweb) keep the
  // previous behaviour but still verify when a secret is configured.
  const provider = process.env.WHATSAPP_PROVIDER || "mock";
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (provider === "metaCloud") {
    if (!appSecret) {
      console.error(
        "[wa-webhook] WHATSAPP_APP_SECRET is not set while WHATSAPP_PROVIDER=metaCloud. " +
          "Rejecting all webhook requests to prevent unsigned payload injection.",
      );
      return new NextResponse("service unavailable", { status: 503 });
    }
    const sig = req.headers.get("x-hub-signature-256");
    if (!signatureOk(appSecret, raw, sig)) {
      return new NextResponse("bad signature", { status: 401 });
    }
  } else if (appSecret) {
    const sig = req.headers.get("x-hub-signature-256");
    if (!signatureOk(appSecret, raw, sig)) {
      return new NextResponse("bad signature", { status: 401 });
    }
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  // Always 200 quickly so Meta doesn't retry; process inline (fast enough here).
  try {
    const entries = (body as { entry?: unknown[] }).entry ?? [];
    for (const entry of entries) {
      const changes = (entry as { changes?: unknown[] }).changes ?? [];
      for (const change of changes) {
        const value = (change as { value?: { messages?: WaMessage[] } }).value;
        const messages = value?.messages ?? [];
        for (const msg of messages) {
          if (msg.type === "text" && msg.from && msg.text?.body) {
            await processInbound(msg.from, msg.text.body);
          }
        }
      }
    }
  } catch (e) {
    console.error("[wa-webhook] processing error:", e);
  }

  return NextResponse.json({ received: true });
}
