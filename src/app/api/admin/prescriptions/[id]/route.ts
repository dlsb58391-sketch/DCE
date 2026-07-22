import { NextResponse } from "next/server";
import { requireSession, requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { getPrescription, deletePrescription } from "@/lib/server/prescriptions-ops";

/**
 * One prescription: full detail (GET, any signed-in staff — used by the printable
 * page) or soft-delete (DELETE, owner-level). A DELETE moves the document to the
 * Recycle Bin; it is never physically removed from the normal flow.
 */
export const GET = withRoute("admin.prescriptions.id.GET", rxGet);

async function rxGet(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  const r = await getPrescription(id);
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}

export const DELETE = withRoute("admin.prescriptions.id.DELETE", rxDelete);

async function rxDelete(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const r = await deletePrescription({ id, actor: session, ip: auditIp(req) });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json({ ok: true });
}
