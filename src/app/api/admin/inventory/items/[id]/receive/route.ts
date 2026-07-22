import { NextResponse } from "next/server";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z, zMoney, zDateString } from "@/lib/server/validate";
import { receiveStock } from "@/lib/server/inventory-ops";
import { resolveActiveBranchId } from "@/lib/server/branch-context";

/**
 * Receive stock into an item: creates a batch and appends a `receipt` movement
 * atomically (see inventory-ops.receiveStock). Owner-level only.
 */
const ReceiveBody = z.object({
  supplierId: z.string().trim().min(1).nullish(),
  lotNumber: z.string().trim().min(1).nullish(),
  expiryDate: zDateString,
  unitCost: zMoney,
  quantity: z.coerce.number().positive("must be greater than 0"),
  branchId: z.string().trim().min(1).nullish(),
  notes: z.string().trim().min(1).nullish(),
});

export const POST = withRoute("admin.inventory.items.id.receive.POST", receivePost);

async function receivePost(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, ReceiveBody);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;

  const r = await receiveStock({
    itemId: id,
    supplierId: b.supplierId ?? null,
    lotNumber: b.lotNumber ?? null,
    expiryDate: b.expiryDate ? new Date(b.expiryDate) : null,
    unitCost: b.unitCost,
    quantity: b.quantity,
    branchId: b.branchId ?? (await resolveActiveBranchId()),
    notes: b.notes ?? null,
    actor: session,
    ip: auditIp(req),
  });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}
