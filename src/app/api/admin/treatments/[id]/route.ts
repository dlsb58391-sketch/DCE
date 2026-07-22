import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { softDeleteEntity } from "@/lib/server/soft-delete-ops";
import { withRoute } from "@/lib/server/http";

/** Admin: soft-delete a treatment record. Its commission splits are trashed in
 * the same transaction; linked payments survive (they revert to general account
 * credit, matching the schema's ON DELETE SET NULL) and the row is recoverable. */
export const DELETE = withRoute("admin.treatments.id.DELETE", adminTreatmentsIdDELETE);

async function adminTreatmentsIdDELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  await softDeleteEntity("TreatmentRecord", id, session?.sub ?? null);
  await writeAudit({
    action: "treatment.delete",
    actor: session,
    entityType: "TreatmentRecord",
    entityId: id,
    summary: `Deleted treatment ${id}`,
    ip: auditIp(req),
  });
  return NextResponse.json({ ok: true });
}
