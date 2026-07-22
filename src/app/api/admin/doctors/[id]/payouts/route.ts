import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { round2 } from "@/lib/server/doctors";
import { num } from "@/lib/server/money";
import { resolveActiveBranchId } from "@/lib/server/branch-context";
import { parseJson, z } from "@/lib/server/validate";
import { withRoute } from "@/lib/server/http";

/** GET /api/admin/doctors/[id]/payouts — payouts made to a doctor + running totals. */
export const GET = withRoute("admin.doctors.id.payouts.GET", adminDoctorsIdPayoutsGET);

async function adminDoctorsIdPayoutsGET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  const doctor = await prisma.doctor.findUnique({ where: { id }, select: { id: true } });
  if (!doctor) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [payouts, earnedAgg] = await Promise.all([
    prisma.doctorPayout.findMany({ where: { doctorId: id }, orderBy: { paidAt: "desc" } }),
    prisma.treatmentDoctor.aggregate({ where: { doctorId: id }, _sum: { amount: true } }),
  ]);

  const totalPaid = round2(payouts.reduce((s, p) => s + num(p.amount), 0));
  const totalEarned = round2(num(earnedAgg._sum.amount));

  return NextResponse.json({
    payouts: payouts.map((p) => ({
      id: p.id,
      amount: num(p.amount),
      method: p.method,
      reference: p.reference,
      note: p.note,
      paidAt: p.paidAt.toISOString(),
    })),
    totals: { totalEarned, totalPaid, pending: round2(totalEarned - totalPaid) },
  });
}

const PayoutBody = z.object({
  amount: z.union([z.string(), z.number()]).nullish(),
  method: z.union([z.string(), z.number()]).nullish(),
  reference: z.union([z.string(), z.number()]).nullish(),
  note: z.union([z.string(), z.number()]).nullish(),
  paidAt: z.union([z.string(), z.number()]).nullish(),
});

/** POST /api/admin/doctors/[id]/payouts — record a payment made to the doctor. */
export const POST = withRoute("admin.doctors.id.payouts.POST", adminDoctorsIdPayoutsPOST);

async function adminDoctorsIdPayoutsPOST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const doctor = await prisma.doctor.findUnique({ where: { id }, select: { id: true } });
  if (!doctor) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const parsed = await parseJson(req, PayoutBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const amount = round2(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount_required" }, { status: 400 });
  }

  const allowed = new Set(["cash", "card", "transfer", "other"]);
  const method = allowed.has(String(body.method)) ? String(body.method) : "cash";

  let paidAt = new Date();
  if (body.paidAt) {
    const d = new Date(body.paidAt);
    if (!Number.isNaN(d.getTime())) paidAt = d;
  }

  const payout = await prisma.doctorPayout.create({
    data: {
      doctorId: id,
      amount,
      method,
      reference: body.reference ? String(body.reference).trim() : null,
      note: body.note ? String(body.note).trim() : null,
      paidAt,
      branchId: await resolveActiveBranchId(),
    },
  });

  await writeAudit({
    action: "payout.create",
    actor: session,
    entityType: "DoctorPayout",
    entityId: payout.id,
    summary: `Recorded payout of ${amount} to doctor ${id} via ${method}`,
    metadata: { doctorId: id, amount, method },
    ip: auditIp(req),
  });

  return NextResponse.json({ ok: true, payout: { ...payout, amount: num(payout.amount), paidAt: payout.paidAt.toISOString() } });
}
