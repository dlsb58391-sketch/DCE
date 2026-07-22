import { NextResponse } from "next/server";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z, zMoney, zDateString } from "@/lib/server/validate";
import { receivePoLines } from "@/lib/server/purchase-orders-ops";

/**
 * Receive goods against a submitted / partially-received purchase order. Each
 * receipt targets a line and creates an inventory batch + `receipt` movement
 * (tagged referenceType="PurchaseOrder") atomically, advancing the line's
 * receivedQty and the header status. Over-receipt beyond a line's ordered
 * quantity is rejected. Owner-level only.
 */
const ReceiptBody = z.object({
  lineId: z.string().trim().min(1),
  quantity: z.coerce.number().positive("must be greater than 0"),
  lotNumber: z.string().trim().min(1).nullish(),
  expiryDate: zDateString,
  unitCost: zMoney.optional(),
});

const PoReceiveBody = z.object({
  receipts: z.array(ReceiptBody).min(1, "at least one receipt line is required"),
});

export const POST = withRoute("admin.inventory.purchaseOrders.id.receive.POST", receiveHandler);

async function receiveHandler(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, PoReceiveBody);
  if (!parsed.ok) return parsed.response;

  const r = await receivePoLines({
    id,
    receipts: parsed.data.receipts.map((x) => ({
      lineId: x.lineId,
      quantity: x.quantity,
      lotNumber: x.lotNumber ?? null,
      expiryDate: x.expiryDate ? new Date(x.expiryDate) : null,
      unitCost: x.unitCost ?? null,
    })),
    actor: session,
    ip: auditIp(req),
  });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}
