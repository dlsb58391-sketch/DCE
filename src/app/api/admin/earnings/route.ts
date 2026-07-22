import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { expensesForMonth } from "@/lib/server/expenses";
import { num } from "@/lib/server/money";
import {
  settleStatus,
  expensesBetween,
  last12MonthKeys,
  monthBounds,
  monthKeyOf,
  round2,
} from "@/lib/server/earnings";
import { withRoute } from "@/lib/server/http";

/**
 * GET /api/admin/earnings?from=YYYY-MM-DD&to=YYYY-MM-DD
 * The clinic-wide doctor earnings dashboard:
 *   - summary cards (doctors, operations, revenue, doctor earnings, clinic profit,
 *     paid to doctors, pending payments),
 *   - a per-doctor row (ops, revenue, earnings, clinic earnings, current-month
 *     earnings, lifetime paid/pending, last operation, settlement status),
 *   - a 12-month trend (revenue vs doctor earnings vs clinic profit vs ops),
 *   - earnings by operation type.
 * The date range scopes the summary + per-doctor range figures + by-type; the
 * pending/paid/status figures are lifetime (settlement is inherently all-time).
 */
export const GET = withRoute("admin.earnings.GET", adminEarningsGET);

async function adminEarningsGET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const url = new URL(req.url);
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");

  const parseDay = (s: string | null, endOfDay: boolean): Date | null => {
    if (!s) return null;
    const d = new Date(`${s}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const from = parseDay(fromRaw, false);
  const to = parseDay(toRaw, true);

  const rangeWhere =
    from || to ? { performedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};

  const now = new Date();
  const curMonth = monthKeyOf(now);
  const { start: curStart, end: curEnd } = monthBounds(curMonth);
  const trendKeys = last12MonthKeys(now);
  const trendStart = monthBounds(trendKeys[0]).start;

  const [doctors, rangeTreatments, allLinks, allPayouts, trendTreatments] = await Promise.all([
    prisma.doctor.findMany({ orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }),
    prisma.treatmentRecord.findMany({
      where: rangeWhere,
      select: {
        id: true,
        price: true,
        cost: true,
        nameEn: true,
        nameAr: true,
        performedAt: true,
        doctors: { where: { deletedAt: null }, select: { doctorId: true, amount: true } },
      },
    }),
    prisma.treatmentDoctor.findMany({
      select: { doctorId: true, amount: true, treatmentRecord: { select: { performedAt: true } } },
    }),
    prisma.doctorPayout.findMany({ select: { doctorId: true, amount: true, paidAt: true } }),
    prisma.treatmentRecord.findMany({
      where: { performedAt: { gte: trendStart } },
      select: { price: true, cost: true, performedAt: true, doctors: { where: { deletedAt: null }, select: { amount: true } } },
    }),
  ]);

  // ---- Clinic-level summary (each treatment counted once) ----
  let gross = 0;
  let materials = 0;
  let commission = 0;
  for (const t of rangeTreatments) {
    gross += num(t.price);
    materials += num(t.cost);
    commission += t.doctors.reduce((s, d) => s + num(d.amount), 0);
  }
  const rangeStartForExp =
    from ??
    (rangeTreatments.length
      ? rangeTreatments.reduce((min, t) => (t.performedAt < min ? t.performedAt : min), rangeTreatments[0].performedAt)
      : now);
  const rangeEndForExp = to ?? now;
  const expenses = await expensesBetween(rangeStartForExp, rangeEndForExp);
  const clinicProfit = round2(gross - commission - materials - expenses);

  // ---- Per-doctor range aggregates ----
  type DocAgg = { operations: number; revenue: number; earnings: number; materials: number };
  const rangeByDoctor = new Map<string, DocAgg>();
  const ensure = (id: string) => {
    let a = rangeByDoctor.get(id);
    if (!a) {
      a = { operations: 0, revenue: 0, earnings: 0, materials: 0 };
      rangeByDoctor.set(id, a);
    }
    return a;
  };
  const byType = new Map<
    string,
    { name: string; count: number; revenue: number; doctorEarnings: number; clinicEarnings: number }
  >();
  for (const t of rangeTreatments) {
    const price = num(t.price);
    const cost = num(t.cost);
    const opCommission = t.doctors.reduce((s, d) => s + num(d.amount), 0);
    const name = (t.nameEn || t.nameAr || "—").trim();
    const key = name.toLowerCase();
    const e = byType.get(key) ?? { name, count: 0, revenue: 0, doctorEarnings: 0, clinicEarnings: 0 };
    e.count += 1;
    e.revenue += price;
    e.doctorEarnings += opCommission;
    e.clinicEarnings += price - opCommission - cost;
    byType.set(key, e);

    for (const d of t.doctors) {
      const a = ensure(d.doctorId);
      a.operations += 1;
      a.revenue += price;
      a.earnings += num(d.amount);
      a.materials += cost;
    }
  }

  // ---- Lifetime per-doctor: earned, current-month, last op ----
  const earnedLifetime = new Map<string, number>();
  const monthEarned = new Map<string, number>();
  const lastOp = new Map<string, Date>();
  for (const l of allLinks) {
    const amt = num(l.amount);
    earnedLifetime.set(l.doctorId, (earnedLifetime.get(l.doctorId) || 0) + amt);
    const when = l.treatmentRecord.performedAt;
    if (when >= curStart && when < curEnd) monthEarned.set(l.doctorId, (monthEarned.get(l.doctorId) || 0) + amt);
    const prev = lastOp.get(l.doctorId);
    if (!prev || when > prev) lastOp.set(l.doctorId, when);
  }
  const paidLifetime = new Map<string, number>();
  let paidInRange = 0;
  for (const p of allPayouts) {
    paidLifetime.set(p.doctorId, (paidLifetime.get(p.doctorId) || 0) + num(p.amount));
    const inRange = (!from || p.paidAt >= from) && (!to || p.paidAt <= to);
    if (inRange) paidInRange += num(p.amount);
  }

  const doctorRows = doctors.map((d) => {
    const r = rangeByDoctor.get(d.id) ?? { operations: 0, revenue: 0, earnings: 0, materials: 0 };
    const earnedTotal = round2(earnedLifetime.get(d.id) || 0);
    const paidTotal = round2(paidLifetime.get(d.id) || 0);
    const pending = round2(Math.max(0, earnedTotal - paidTotal));
    const last = lastOp.get(d.id);
    return {
      id: d.id,
      nameEn: d.nameEn,
      nameAr: d.nameAr,
      specialtyEn: d.specialtyEn,
      specialtyAr: d.specialtyAr,
      photoUrl: d.photoUrl,
      commissionPct: num(d.commissionPct),
      active: d.active,
      operations: r.operations,
      revenue: round2(r.revenue),
      earnings: round2(r.earnings),
      clinicEarnings: round2(r.revenue - r.earnings - r.materials),
      monthEarnings: round2(monthEarned.get(d.id) || 0),
      earnedTotal,
      paidTotal,
      pending,
      lastOpDate: last ? last.toISOString() : null,
      status: settleStatus(paidTotal, earnedTotal),
    };
  });

  // ---- 12-month trend ----
  const trendIdx = new Map(trendKeys.map((k, i) => [k, i]));
  const monthly = trendKeys.map((key) => ({
    key,
    revenue: 0,
    doctorEarnings: 0,
    materials: 0,
    operations: 0,
    expenses: 0,
    clinicProfit: 0,
  }));
  for (const t of trendTreatments) {
    const i = trendIdx.get(monthKeyOf(t.performedAt));
    if (i == null) continue;
    const m = monthly[i];
    m.revenue += num(t.price);
    m.materials += num(t.cost);
    m.doctorEarnings += t.doctors.reduce((s, d) => s + num(d.amount), 0);
    m.operations += 1;
  }
  const trendExpenses = await Promise.all(monthly.map((m) => expensesForMonth(m.key)));
  monthly.forEach((m, i) => {
    const total = trendExpenses[i].total;
    m.expenses = total;
    m.clinicProfit = round2(m.revenue - m.doctorEarnings - m.materials - total);
    m.revenue = round2(m.revenue);
    m.doctorEarnings = round2(m.doctorEarnings);
    m.materials = round2(m.materials);
  });

  // ---- Lifetime settlement totals for the summary ----
  let totalPaidLifetime = 0;
  for (const v of paidLifetime.values()) totalPaidLifetime += v;
  let totalPending = 0;
  for (const d of doctorRows) totalPending += d.pending;

  return NextResponse.json({
    range: { from: fromRaw, to: toRaw },
    summary: {
      totalDoctors: doctors.filter((d) => d.active).length,
      totalOperations: rangeTreatments.length,
      totalRevenue: round2(gross),
      totalDoctorEarnings: round2(commission),
      totalMaterials: round2(materials),
      totalExpenses: round2(expenses),
      totalClinicProfit: clinicProfit,
      totalPaidToDoctors: round2(from || to ? paidInRange : totalPaidLifetime),
      totalPendingPayments: round2(totalPending),
    },
    doctors: doctorRows,
    monthly,
    byType: [...byType.values()]
      .map((o) => ({
        name: o.name,
        count: o.count,
        revenue: round2(o.revenue),
        doctorEarnings: round2(o.doctorEarnings),
        clinicEarnings: round2(o.clinicEarnings),
      }))
      .sort((a, b) => b.revenue - a.revenue),
  });
}
