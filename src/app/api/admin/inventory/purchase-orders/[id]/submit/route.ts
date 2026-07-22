import { NextResponse } from "next/server";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { submitPo } from "@/lib/server/purchase-orders-ops";

/**
 * Submit a draft purchase order to the supplier. Requires at least one line;
 * stamps orderedAt and moves the status draft → submitted. Owner-level only.
 */
export const POST = withRoute("admin.inventory.purchaseOrders.id.submit.POST", submitHandler);

async function submitHandler(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const r = await submitPo({ id, actor: session, ip: auditIp(req) });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}
