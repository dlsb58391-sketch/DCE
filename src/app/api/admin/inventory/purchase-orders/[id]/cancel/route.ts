import { NextResponse } from "next/server";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { cancelPo } from "@/lib/server/purchase-orders-ops";

/**
 * Cancel a purchase order (draft / submitted / partially received). Cancelling
 * never reverses stock already received — it only stops expecting the remainder.
 * Owner-level only.
 */
export const POST = withRoute("admin.inventory.purchaseOrders.id.cancel.POST", cancelHandler);

async function cancelHandler(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const r = await cancelPo({ id, actor: session, ip: auditIp(req) });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}
