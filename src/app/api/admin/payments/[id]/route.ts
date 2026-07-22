import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { softDeleteEntity } from "@/lib/server/soft-delete-ops";
import { withRoute } from "@/lib/server/http";

/** Admin: soft-delete a payment (recoverable from the Recycle Bin). */
export const DELETE = withRoute("admin.payments.id.DELETE", adminPaymentsIdDELETE);

async function adminPaymentsIdDELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  await softDeleteEntity("Payment", id, session?.sub ?? null);
  await writeAudit({
    action: "payment.delete",
    actor: session,
    entityType: "Payment",
    entityId: id,
    summary: `Deleted payment ${id}`,
    ip: auditIp(req),
  });
  return NextResponse.json({ ok: true });
}
