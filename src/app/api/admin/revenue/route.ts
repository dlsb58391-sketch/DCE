import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { expensesForMonth } from "@/lib/server/expenses";
import { isValidMonthKey, monthBounds, monthKeyOf, round2 } from "@/lib/server/doctors";
import { num } from "@/lib/server/money";
import { withRoute } from "@/lib/server/http";

/**
 * GET /api/admin/revenue?month=YYYY-MM
 * The clinic's monthly profit picture:
 *   - clinic gross (billed), materials cost, doctor commissions, expenses, net.
 *   - per-doctor amount owed (+ operation count) for the month.
 *   - per-operation-type counts, revenue, materials, commissions and clinic net.
 * Net = gross − doctor commissions − materials cost − monthly expenses.
 */
export const GET = withRoute("admin.revenue.GET", adminRevenueGET);

async function adminRevenueGET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const p = new URL(req.url).searchParams.get("month");
  const month = isValidMonthKey(p) ? p : monthKeyOf(new Date());
  const { start, end } = monthBounds(month);

  const [treatments, payments, exp] = await Promise.all([
    prisma.treatmentRecord.findMany({
      where: { performedAt: { gte: start, lt: end } },
      include: { doctors: { where: { deletedAt: null }, include: { doctor: { select: { nameEn: true, nameAr: true } } } } },
    }),
    prisma.payment.findMany({ where: { paidAt: { gte: start, lt: end } }, select: { amount: true } }),
    expensesForMonth(month),
  ]);

  let gross = 0;
  let materialsCost = 0;
  let doctorsCommission = 0;

  const byDoctor = new Map<string, { doctorId: string; nameEn: string; nameAr: string; amount: number; count: number }>();
  const byOp = new Map<
    string,
    { name: string; count: number; gross: number; materialsCost: number; doctorsCommission: number; clinicNet: number }
  >();

  for (const t of treatments) {
    const price = num(t.price);
    const cost = num(t.cost);
    const commission = t.doctors.reduce((s, d) => s + num(d.amount), 0);
    gross += price;
    materialsCost += cost;
    doctorsCommission += commission;

    const name = (t.nameEn || t.nameAr || "—").trim();
    const key = name.toLowerCase();
    const e = byOp.get(key) ?? { name, count: 0, gross: 0, materialsCost: 0, doctorsCommission: 0, clinicNet: 0 };
    e.count += 1;
    e.gross += price;
    e.materialsCost += cost;
    e.doctorsCommission += commission;
    e.clinicNet += price - commission - cost;
    byOp.set(key, e);

    for (const d of t.doctors) {
      const cur =
        byDoctor.get(d.doctorId) ??
        { doctorId: d.doctorId, nameEn: d.doctor?.nameEn ?? "", nameAr: d.doctor?.nameAr ?? "", amount: 0, count: 0 };
      cur.amount += num(d.amount);
      cur.count += 1;
      byDoctor.set(d.doctorId, cur);
    }
  }

  const collected = payments.reduce((s, x) => s + num(x.amount), 0);
  const net = gross - doctorsCommission - materialsCost - exp.total;

  const doctors = [...byDoctor.values()]
    .map((d) => ({ ...d, amount: round2(d.amount) }))
    .sort((a, b) => b.amount - a.amount);
  const operations = [...byOp.values()]
    .map((o) => ({
      name: o.name,
      count: o.count,
      gross: round2(o.gross),
      materialsCost: round2(o.materialsCost),
      doctorsCommission: round2(o.doctorsCommission),
      clinicNet: round2(o.clinicNet),
    }))
    .sort((a, b) => b.gross - a.gross);

  return NextResponse.json({
    month,
    clinic: {
      gross: round2(gross),
      collected: round2(collected),
      materialsCost: round2(materialsCost),
      doctorsCommission: round2(doctorsCommission),
      expenses: round2(exp.total),
      net: round2(net),
      operations: treatments.length,
    },
    doctors,
    operations,
    expenseItems: exp.expenses,
  });
}
