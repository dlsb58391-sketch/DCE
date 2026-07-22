import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * LID repair bridge for the whatsapp-web.js worker.
 *
 * Some WhatsApp accounts message from a privacy "@lid" alias, so older bookings
 * saved the alias digits as the phone instead of the real number. Only the
 * worker (which holds the WhatsApp session) can resolve a LID to a real phone,
 * so it drives this repair:
 *
 *   GET  (worker, x-agent-secret): returns distinct waChatIds ending in "@lid"
 *        with the phone currently stored, so the worker can resolve each.
 *   POST (worker, x-agent-secret): { fixes: [{ chatId, phone, name? }] } updates
 *        the matching appointments and their patient accounts to the real number.
 */
function authed(req: Request): boolean {
  const secret = process.env.WA_AGENT_SECRET;
  return !!secret && req.headers.get("x-agent-secret") === secret;
}

export async function GET(req: Request) {
  if (!authed(req)) return new NextResponse("unauthorized", { status: 401 });

  const rows = await prisma.appointment.findMany({
    where: { waChatId: { endsWith: "@lid" } },
    select: { waChatId: true, phone: true },
  });

  const seen = new Map<string, string>();
  for (const r of rows) {
    if (r.waChatId && !seen.has(r.waChatId)) seen.set(r.waChatId, r.phone);
  }
  const pending = [...seen.entries()].map(([chatId, phone]) => ({ chatId, phone }));
  return NextResponse.json({ pending });
}

export async function POST(req: Request) {
  if (!authed(req)) return new NextResponse("unauthorized", { status: 401 });

  let body: { fixes?: { chatId: string; phone: string; name?: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const fixes = Array.isArray(body.fixes) ? body.fixes : [];

  let appts = 0;
  let patients = 0;

  for (const f of fixes) {
    const realDigits = (f.phone || "").replace(/\D/g, "");
    if (!f.chatId || realDigits.length < 8) continue;

    // The alias digits we may have stored as the phone (e.g. "5209828888623").
    const aliasDigits = f.chatId.split("@")[0].replace(/\D/g, "");
    const aliasTail = aliasDigits.slice(-9);

    // Fix bookings tied to this chat id OR still carrying the alias as their phone
    // (older rows created before we captured the chat id have a null waChatId).
    const where =
      aliasTail.length >= 8
        ? { OR: [{ waChatId: f.chatId }, { phone: { contains: aliasTail } }] }
        : { waChatId: f.chatId };
    const r = await prisma.appointment.updateMany({ where, data: { phone: realDigits } });
    appts += r.count;

    // Fix the patient account(s) that were keyed on the alias number.
    if (aliasTail.length >= 8) {
      const p = await prisma.patient.updateMany({
        where: { phone: { contains: aliasTail } },
        data: { phone: realDigits },
      });
      patients += p.count;
    }
  }

  return NextResponse.json({ ok: true, appts, patients });
}
