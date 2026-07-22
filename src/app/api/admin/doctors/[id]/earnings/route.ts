import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { isValidMonthKey, monthBounds, monthKeyOf, round2 } from "@/lib/server/doctors";
import { settleStatus, monthKeysForYear } from "@/lib/server/earnings";
import { num } from "@/lib/server/money";
import { withRoute } from "@/lib/server/http";

/**
 * GET /api/admin/doctors/[id]/earnings?month=YYYY-MM&year=YYYY
 * A doctor's full account:
 *   - profile + settlement summary (current/previous/lifetime earnings, ops,
 *     average per op, pending, paid, clinic profit generated),
 *   - 12-month earnings trend (legacy `months`) + a per-month table for a chosen
 *     `year` (revenue / earnings / clinic / paid / remaining),
 *   - the operation history (enriched: category, clinic share, payment status),
 *   - the payouts recorded against the doctor.
 * Preserves the legacy `totals` + `months` + `operations` shape (used by the
 * existing doctor profile view) and adds `summary`, `yearly`, `payouts`.
 */
export const GET = withRoute("admin.doctors.id.earnings.GET", adminDoctorsIdEarningsGET);

async function adminDoctorsIdEarningsGET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  const sp = new URL(req.url).searchParams;
  const monthParam = sp.get("month");
  const month = isValidMonthKey(monthParam) ? monthParam : null;
  const now = new Date();
  const yearParam = Number(sp.get("year"));
  const year = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : now.getFullYear();

  const [doctor, links, payouts] = await Promise.all([
    prisma.doctor.findUnique({ where: { id } }),
    prisma.treatmentDoctor.findMany({
      where: { doctorId: id },
      include: {
        treatmentRecord: {
          include: {
            patient: { select: { id: true, name: true, phone: true } },
            procedure: { select: { nameEn: true, nameAr: true } },
            doctors: { where: { deletedAt: null }, select: { amount: true } },
            payments: { where: { deletedAt: null }, select: { amount: true, paidAt: true } },
          },
        },
      },
    }),
    prisma.doctorPayout.findMany({ where: { doctorId: id }, orderBy: { paidAt: "desc" } }),
  ]);
  if (!doctor) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // 12-month trend buckets (legacy)
  const months: { key: string; earned: number; count: number }[] = [];
  const idx = new Map<string, number>();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const k = monthKeyOf(d);
    idx.set(k, months.length);
    months.push({ key: k, earned: 0, count: 0 });
  }

  // Per-year monthly table
  const yearKeys = monthKeysForYear(year);
  const yIdx = new Map(yearKeys.map((k, i) => [k, i]));
  const yearly = yearKeys.map((key) => ({
    key,
    operations: 0,
    revenue: 0,
    doctorEarnings: 0,
    materials: 0,
    clinicEarnings: 0,
    paid: 0,
    remaining: 0,
  }));

  const curMonth = monthKeyOf(now);
  const prevMonth = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));

  let allEarned = 0;
  let allCount = 0;
  let monthEarned = 0;
  let monthCount = 0;
  let curMonthEarned = 0;
  let prevMonthEarned = 0;
  let lifetimeRevenue = 0;
  let lifetimeMaterials = 0;
  const bounds = month ? monthBounds(month) : null;

  const operations = links
    .map((l) => {
      const t = l.treatmentRecord;
      const performedAt = t.performedAt;
      const price = num(t.price);
      const cost = num(t.cost);
      const opCommission = t.doctors.reduce((s, d) => s + num(d.amount), 0);
      const paid = t.payments.reduce((s, p) => s + num(p.amount), 0);
      const payStatus = settleStatus(paid, price);
      const lastPayment = t.payments.reduce<Date | null>((acc, p) => (!acc || p.paidAt > acc ? p.paidAt : acc), null);

      allEarned += num(l.amount);
      allCount += 1;
      lifetimeRevenue += price;
      lifetimeMaterials += cost;

      const mk = monthKeyOf(performedAt);
      const mi = idx.get(mk);
      if (mi != null) {
        months[mi].earned += num(l.amount);
        months[mi].count += 1;
      }
      const yi = yIdx.get(mk);
      if (yi != null) {
        const row = yearly[yi];
        row.operations += 1;
        row.revenue += price;
        row.doctorEarnings += num(l.amount);
        row.materials += cost;
      }
      if (mk === curMonth) curMonthEarned += num(l.amount);
      if (mk === prevMonth) prevMonthEarned += num(l.amount);

      const inMonth = bounds ? performedAt >= bounds.start && performedAt < bounds.end : false;
      if (inMonth) {
        monthEarned += num(l.amount);
        monthCount += 1;
      }
      return {
        id: l.id,
        performedAt: performedAt.toISOString(),
        monthKey: mk,
        nameEn: t.nameEn,
        nameAr: t.nameAr,
        category: t.procedure?.nameEn ?? "Custom",
        patientId: t.patient?.id ?? null,
        patientCode: t.patient?.id ? t.patient.id.slice(-5).toUpperCase() : null,
        patientName: t.patient?.name ?? null,
        patientPhone: t.patient?.phone ?? null,
        price,
        cost,
        commissionPct: num(l.commissionPct),
        amount: num(l.amount),
        clinicEarnings: round2(price - opCommission - cost),
        paymentStatus: payStatus,
        paymentDate: payStatus === "paid" && lastPayment ? lastPayment.toISOString() : null,
        notes: t.notes ?? null,
        inMonth,
      };
    })
    .sort((a, b) => (a.performedAt < b.performedAt ? 1 : -1));

  for (const m of months) m.earned = round2(m.earned);

  // Fold payouts into the yearly "paid" column
  for (const p of payouts) {
    const yi = yIdx.get(monthKeyOf(p.paidAt));
    if (yi != null) yearly[yi].paid += num(p.amount);
  }
  for (const row of yearly) {
    row.clinicEarnings = round2(row.revenue - row.doctorEarnings - row.materials);
    row.remaining = round2(row.doctorEarnings - row.paid);
    row.revenue = round2(row.revenue);
    row.doctorEarnings = round2(row.doctorEarnings);
    row.materials = round2(row.materials);
    row.paid = round2(row.paid);
  }

  const paidTotal = round2(payouts.reduce((s, p) => s + num(p.amount), 0));
  const earnedTotal = round2(allEarned);
  const pending = round2(Math.max(0, earnedTotal - paidTotal));
  const clinicProfitGenerated = round2(lifetimeRevenue - earnedTotal - lifetimeMaterials);

  const list = month ? operations.filter((o) => o.inMonth) : operations;

  return NextResponse.json({
    doctor: {
      id: doctor.id,
      nameEn: doctor.nameEn,
      nameAr: doctor.nameAr,
      specialtyEn: doctor.specialtyEn,
      specialtyAr: doctor.specialtyAr,
      photoUrl: doctor.photoUrl,
      phone: doctor.phone,
      email: doctor.email,
      commissionPct: num(doctor.commissionPct),
      active: doctor.active,
      notes: doctor.notes,
    },
    month,
    year,
    totals: {
      allEarned: earnedTotal,
      allCount,
      monthEarned: round2(monthEarned),
      monthCount,
    },
    summary: {
      currentMonthEarnings: round2(curMonthEarned),
      previousMonthEarnings: round2(prevMonthEarned),
      lifetimeEarnings: earnedTotal,
      totalOperations: allCount,
      avgPerOperation: allCount > 0 ? round2(earnedTotal / allCount) : 0,
      pendingPayments: pending,
      paidAmount: paidTotal,
      clinicProfitGenerated,
      status: settleStatus(paidTotal, earnedTotal),
    },
    months,
    yearly,
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: num(p.amount),
      method: p.method,
      reference: p.reference,
      note: p.note,
      paidAt: p.paidAt.toISOString(),
    })),
    operations: list.slice(0, 500),
  });
}
