import { NextResponse } from "next/server";
import { processInbound } from "@/lib/server/wa-runtime";

/**
 * Internal endpoint the whatsapp-web.js worker calls to drive the booking agent.
 *
 *   POST /api/whatsapp/agent
 *   headers: x-agent-secret: $WA_AGENT_SECRET
 *   body: { "phone": "2011...", "text": "حجز" }
 *   -> { replies: string[], bookingCode?: string }
 *
 * The worker (worker/whatsapp-web.mjs) owns the WhatsApp connection and SENDS the
 * replies itself, so here we just compute them: pass a no-op sender so the agent
 * doesn't also try to send via the Meta/mock layer.
 *
 * Guarded by a shared secret (WA_AGENT_SECRET) since it can create bookings.
 */
export async function POST(req: Request) {
  const secret = process.env.WA_AGENT_SECRET;
  if (!secret || req.headers.get("x-agent-secret") !== secret) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  let body: { phone?: string; text?: string; name?: string; chatId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const phone = String(body.phone ?? "").trim();
  const text = String(body.text ?? "");
  const name = body.name ? String(body.name).trim() : undefined;
  const chatId = body.chatId ? String(body.chatId).trim() : undefined;
  if (!phone || !text) {
    return NextResponse.json({ error: "missing phone or text" }, { status: 400 });
  }

  // The worker delivers conversation replies itself; we just compute them.
  const result = await processInbound(phone, text, new Date(), name, chatId);
  return NextResponse.json(result);
}
