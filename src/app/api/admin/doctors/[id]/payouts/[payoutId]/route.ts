import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { softDeleteEntity } from "@/lib/server/soft-delete-ops";
import { withRoute } from "@/lib/server/http";

/** DELETE /api/admin/doctors/[id]/payouts/[payoutId] — remove a doctor payout. */
export const DELETE = withRoute("admin.doctors.id.payouts.payoutId.DELETE", adminDoctorsIdPayoutsPayoutIdDELETE);

async function adminDoctorsIdPayoutsPayoutIdDELETE(req: Request, ctx: { params: Promise<{ id: string; payoutId: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id, payoutId } = await ctx.params;

  const payout = await prisma.doctorPayout.findUnique({ where: { id: payoutId }, select: { id: true, doctorId: true, amount: true } });
  if (!payout || payout.doctorId !== id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await softDeleteEntity("DoctorPayout", payoutId, session?.sub ?? null);
  await writeAudit({
    action: "payout.delete",
    actor: session,
    entityType: "DoctorPayout",
    entityId: payoutId,
    summary: `Deleted payout of ${Number(payout.amount)} for doctor ${id}`,
    metadata: { doctorId: id, amount: Number(payout.amount) },
    ip: auditIp(req),
  });
  return NextResponse.json({ ok: true });
}
