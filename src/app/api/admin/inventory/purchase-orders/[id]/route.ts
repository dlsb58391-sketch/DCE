import { NextResponse } from "next/server";
import { requireSession, requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { softDeleteEntity } from "@/lib/server/soft-delete-ops";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z, zMoney, zDateString } from "@/lib/server/validate";
import { getPo, updatePo } from "@/lib/server/purchase-orders-ops";

/**
 * One purchase order: full detail (GET), header/line edit (PATCH) or soft-delete
 * (DELETE). Lines can only be replaced while the PO is a draft; the header is
 * editable in draft or submitted. Received stock is never affected here — a
 * DELETE only trashes the order document (batches + ledger stay intact).
 */
export const GET = withRoute("admin.inventory.purchaseOrders.id.GET", poGet);

async function poGet(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  const r = await getPo(id);
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}

const LineBody = z.object({
  itemId: z.string().trim().min(1),
  orderedQty: z.coerce.number().positive("must be greater than 0"),
  unitCost: zMoney.optional(),
});

const PoUpdateBody = z.object({
  supplierId: z.string().trim().min(1).nullish(),
  branchId: z.string().trim().min(1).nullish(),
  currency: z.string().trim().min(1).max(8).optional(),
  notes: z.string().nullish(),
  expectedAt: zDateString,
  lines: z.array(LineBody).optional(),
});

export const PATCH = withRoute("admin.inventory.purchaseOrders.id.PATCH", poPatch);

async function poPatch(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, PoUpdateBody);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;

  const r = await updatePo({
    id,
    supplierId: b.supplierId === undefined ? undefined : (b.supplierId ?? null),
    branchId: b.branchId === undefined ? undefined : (b.branchId ?? null),
    currency: b.currency,
    notes: b.notes === undefined ? undefined : (b.notes?.trim() || null),
    expectedAt: b.expectedAt === undefined ? undefined : b.expectedAt ? new Date(b.expectedAt) : null,
    lines: b.lines?.map((l) => ({ itemId: l.itemId, orderedQty: l.orderedQty, unitCost: l.unitCost ?? 0 })),
    actor: session,
    ip: auditIp(req),
  });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}

export const DELETE = withRoute("admin.inventory.purchaseOrders.id.DELETE", poDelete);

async function poDelete(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  // Confirm the PO exists (and is live) so a bad id answers 404, not a silent ok.
  const found = await getPo(id);
  if (!found.ok) return errorJson(found.code, found.status, { message: found.message });

  // Soft-delete only: the order document goes to the Recycle Bin; any stock that
  // was already received stays put (its batches/movements are real inventory).
  await softDeleteEntity("PurchaseOrder", id, session?.sub ?? null);
  await writeAudit({
    action: "inventory.po.delete",
    actor: session,
    entityType: "PurchaseOrder",
    entityId: id,
    summary: `Deleted purchase order ${id}`,
    ip: auditIp(req),
  });
  return NextResponse.json({ ok: true });
}
