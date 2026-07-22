import { NextResponse } from "next/server";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { cancelPrescription } from "@/lib/server/prescriptions-ops";

/**
 * Cancel an issued prescription (owner-level). Cancelling is terminal: the
 * document stays viewable/printable as history but is marked cancelled.
 */
export const POST = withRoute("admin.prescriptions.id.cancel.POST", cancelHandler);

async function cancelHandler(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const r = await cancelPrescription({ id, actor: session, ip: auditIp(req) });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}
