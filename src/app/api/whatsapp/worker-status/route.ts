import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { requireSession } from "@/lib/server/guard";
import { setWorkerStatus, getWorkerStatus, type WaWorkerState } from "@/lib/server/wa-status";

/**
 * Bridges the whatsapp-web.js worker and the dashboard "WhatsApp" tab.
 *
 * POST (worker → site, x-agent-secret): report state + optional raw QR string.
 * GET  (dashboard, signed-in doctor): returns the state and, when waiting to
 *      link, a ready-to-render QR image (data URL).
 */

export async function POST(req: Request) {
  const secret = process.env.WA_AGENT_SECRET;
  if (!secret || req.headers.get("x-agent-secret") !== secret) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  let body: { state?: string; qr?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const valid: WaWorkerState[] = ["qr", "authenticated", "ready", "disconnected", "offline"];
  const state = valid.includes(body.state as WaWorkerState) ? (body.state as WaWorkerState) : "offline";
  setWorkerStatus(state, body.qr);
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;

  const s = getWorkerStatus();
  let qrDataUrl: string | null = null;
  if (s.state === "qr" && s.qr) {
    qrDataUrl = await QRCode.toDataURL(s.qr, { margin: 1, width: 320 }).catch(() => null);
  }
  return NextResponse.json({ state: s.state, fresh: s.fresh, qrDataUrl, at: s.at });
}
