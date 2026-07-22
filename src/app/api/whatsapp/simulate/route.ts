import { NextResponse } from "next/server";
import { processInbound } from "@/lib/server/wa-runtime";
import { requireSession } from "@/lib/server/guard";

/**
 * Local simulator for the WhatsApp booking agent — lets you test the whole
 * conversation WITHOUT Meta credentials or a public URL.
 *
 *   POST /api/whatsapp/simulate  { "phone": "+201000000000", "text": "حجز" }
 *   -> { replies: [ "...bot reply..." ], bookingCode?: "ABC123" }
 *
 * Access rules (fail-closed for live providers):
 *   - provider "mock" (default dev/local): open, for frictionless local testing.
 *   - WA_SIMULATE_ENABLED=1: allowed but requires an authenticated session.
 *   - otherwise (metaCloud / waweb / wa without the flag): 404, so it can never
 *     be reached against a live WhatsApp line in production.
 */
export async function POST(req: Request) {
  const provider = process.env.WHATSAPP_PROVIDER || "mock";
  const explicitlyEnabled = process.env.WA_SIMULATE_ENABLED === "1";

  if (provider !== "mock" && !explicitlyEnabled) {
    return new NextResponse("not found", { status: 404 });
  }
  // When enabled outside the mock provider, require an authenticated session.
  if (provider !== "mock") {
    const { error } = await requireSession();
    if (error) return error;
  }

  let body: { phone?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const phone = String(body.phone ?? "").trim();
  const text = String(body.text ?? "");
  if (!phone || !text) {
    return NextResponse.json({ error: "missing phone or text" }, { status: 400 });
  }

  const result = await processInbound(phone, text);
  return NextResponse.json(result);
}
