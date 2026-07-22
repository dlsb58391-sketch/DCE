import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { lastOutboundByKind } from "@/lib/server/wa-send";
import { withRoute } from "@/lib/server/http";

/**
 * Admin recall / reactivation: patients whose last visit was more than `months`
 * ago and who have no upcoming appointment — the ones to win back with a
 * friendly WhatsApp "time for a check-up" nudge.
 *   GET /api/admin/recall?months=6   (default 6, min 1, max 36)
 */
const tail = (p: string) => (p || "").replace(/\D/g, "").slice(-9);

export const GET = withRoute("admin.recall.GET", adminRecallGET);

async function adminRecallGET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  let months = Number(new URL(req.url).searchParams.get("months") || "6");
  if (!Number.isFinite(months) || months < 1) months = 6;
  if (months > 36) months = 36;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - months);

  const [patients, treatments, appts, recalledMap] = await Promise.all([
    prisma.patient.findMany({ select: { id: true, name: true, phone: true, createdAt: true } }),
    prisma.treatmentRecord.findMany({ select: { patientId: true, performedAt: true } }),
    prisma.appointment.findMany({ select: { phone: true, scheduledAt: true, status: true } }),
    lastOutboundByKind("recall"),
  ]);

  const lastTreatment = new Map<string, Date>();
  for (const t of treatments) {
    const cur = lastTreatment.get(t.patientId);
    if (!cur || t.performedAt > cur) lastTreatment.set(t.patientId, t.performedAt);
  }

  // Per phone-tail: last past visit and whether an upcoming appointment exists.
  const lastPastByTail = new Map<string, Date>();
  const hasFutureByTail = new Set<string>();
  for (const a of appts) {
    const t = tail(a.phone);
    if (t.length < 8) continue;
    if (a.scheduledAt >= now) {
      if (a.status === "pending" || a.status === "confirmed") hasFutureByTail.add(t);
    } else {
      const cur = lastPastByTail.get(t);
      if (!cur || a.scheduledAt > cur) lastPastByTail.set(t, a.scheduledAt);
    }
  }

  const rows = patients
    .map((p) => {
      const t = tail(p.phone);
      const dates = [lastTreatment.get(p.id), lastPastByTail.get(t), p.createdAt].filter(Boolean) as Date[];
      const lastVisit = dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : p.createdAt;
      const monthsSince = Math.floor((now.getTime() - lastVisit.getTime()) / (30 * 86400000));
      return {
        patientId: p.id,
        name: p.name,
        phone: p.phone,
        lastVisit: lastVisit.toISOString(),
        monthsSince,
        hasFuture: hasFutureByTail.has(t),
        lastRecalledAt: recalledMap.get(t) ?? null,
      };
    })
    .filter((r) => !r.hasFuture && new Date(r.lastVisit) < cutoff)
    .sort((a, b) => new Date(a.lastVisit).getTime() - new Date(b.lastVisit).getTime());

  return NextResponse.json({ recall: rows, count: rows.length, months });
}
