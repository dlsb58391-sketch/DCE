import { NextResponse } from "next/server";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z } from "@/lib/server/validate";
import { decreaseStock, adjustBatch } from "@/lib/server/inventory-ops";

/**
 * Adjust an item's stock. One endpoint, two shapes selected by `type`:
 *   - consumption | wastage | return -> draw down FEFO across batches
 *     (`quantity` > 0; optional `batchId` restricts to one batch).
 *   - adjustment -> correct a single batch by a signed `delta` (needs `batchId`
 *     and a `reason`); e.g. a physical stock-count fix.
 * Both write an append-only ledger movement; owner-level only.
 */
const AdjustBody = z.object({
  type: z.enum(["consumption", "wastage", "return", "adjustment"]),
  quantity: z.coerce.number().optional(),
  delta: z.coerce.number().optional(),
  reason: z.string().trim().min(1).optional(),
  batchId: z.string().trim().min(1).optional(),
});

export const POST = withRoute("admin.inventory.items.id.adjust.POST", adjustPost);

async function adjustPost(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, AdjustBody);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;
  const ip = auditIp(req);

  if (b.type === "adjustment") {
    if (!b.batchId) return errorJson("batch_required", 400, { message: "batchId is required for an adjustment." });
    if (b.delta == null) return errorJson("delta_required", 400, { message: "A non-zero delta is required." });
    if (!b.reason) return errorJson("reason_required", 400, { message: "A reason is required for an adjustment." });
    const r = await adjustBatch({ batchId: b.batchId, delta: b.delta, reason: b.reason, actor: session, ip });
    if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
    return NextResponse.json(r.data);
  }

  if (b.quantity == null) return errorJson("quantity_required", 400, { message: "A positive quantity is required." });
  const r = await decreaseStock({
    itemId: id,
    type: b.type,
    quantity: b.quantity,
    reason: b.reason ?? null,
    batchId: b.batchId ?? null,
    actor: session,
    ip,
  });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}
