import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { lastOutboundByKind } from "@/lib/server/wa-send";
import { num } from "@/lib/server/money";
import { withRoute } from "@/lib/server/http";

/**
 * Admin receivables: patients who still owe money (billed − paid > 0), so the
 * doctor can chase outstanding balances. Includes each patient's last visit and
 * when they were last reminded (from the WhatsApp inbox), plus the clinic total.
 *   GET /api/admin/receivables
 */
const tail = (p: string) => (p || "").replace(/\D/g, "").slice(-9);

export const GET = withRoute("admin.receivables.GET", adminReceivablesGET);

async function adminReceivablesGET() {
  const { error } = await requireSession();
  if (error) return error;

  const [patients, treatments, payments, appts, remindedMap] = await Promise.all([
    prisma.patient.findMany({ select: { id: true, name: true, phone: true } }),
    prisma.treatmentRecord.findMany({ select: { patientId: true, price: true, performedAt: true } }),
    prisma.payment.findMany({ select: { patientId: true, amount: true } }),
    prisma.appointment.findMany({ select: { phone: true, scheduledAt: true } }),
    lastOutboundByKind("reminder"),
  ]);

  const billed = new Map<string, number>();
  const lastTreatment = new Map<string, Date>();
  for (const t of treatments) {
    billed.set(t.patientId, (billed.get(t.patientId) ?? 0) + num(t.price));
    const cur = lastTreatment.get(t.patientId);
    if (!cur || t.performedAt > cur) lastTreatment.set(t.patientId, t.performedAt);
  }
  const paid = new Map<string, number>();
  for (const p of payments) paid.set(p.patientId, (paid.get(p.patientId) ?? 0) + num(p.amount));

  // Last appointment per phone tail (a second signal for "last visit").
  const lastApptByTail = new Map<string, Date>();
  for (const a of appts) {
    const t = tail(a.phone);
    if (t.length < 8) continue;
    const cur = lastApptByTail.get(t);
    if (!cur || a.scheduledAt > cur) lastApptByTail.set(t, a.scheduledAt);
  }

  const rows = patients
    .map((p) => {
      const b = billed.get(p.id) ?? 0;
      const pd = paid.get(p.id) ?? 0;
      const balance = Math.round((b - pd) * 100) / 100;
      const t = tail(p.phone);
      const visitDates = [lastTreatment.get(p.id), lastApptByTail.get(t)].filter(Boolean) as Date[];
      const lastVisit = visitDates.length ? new Date(Math.max(...visitDates.map((d) => d.getTime()))) : null;
      return {
        patientId: p.id,
        name: p.name,
        phone: p.phone,
        billed: b,
        paid: pd,
        balance,
        lastVisit: lastVisit ? lastVisit.toISOString() : null,
        lastRemindedAt: remindedMap.get(t) ?? null,
      };
    })
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const totalOutstanding = rows.reduce((s, r) => s + r.balance, 0);
  return NextResponse.json({ receivables: rows, totalOutstanding, count: rows.length });
}
