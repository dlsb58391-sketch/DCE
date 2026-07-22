import { NextResponse } from "next/server";
import { requireSession, requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { getPagination, jsonWithPagination } from "@/lib/server/pagination";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z, zMoney, zDateString } from "@/lib/server/validate";
import { createPo, listPos } from "@/lib/server/purchase-orders-ops";
import { resolveActiveBranchId, resolveBranchScope, branchWhereFilter } from "@/lib/server/branch-context";

/**
 * Purchase orders collection.
 *
 * GET is readable by any signed-in staff member; `?status=`, `?supplierId=` and
 * `?search=` (matches the PO code) filter the list. Soft-deleted POs are
 * auto-hidden. POST creates a draft (owner-level) and snapshots each line item's
 * name so order history survives a later item rename/delete.
 */
export const GET = withRoute("admin.inventory.purchaseOrders.GET", poListGet);

async function poListGet(req: Request) {
  const { error, session } = await requireSession();
  if (error) return error;

  const sp = new URL(req.url).searchParams;
  const pg = getPagination(req, { defaultLimit: 100, maxLimit: 200 });
  const scope = await resolveBranchScope({ role: session?.role });
  const { purchaseOrders, total } = await listPos(
    { status: sp.get("status"), supplierId: sp.get("supplierId"), search: sp.get("search") },
    pg.take,
    pg.skip,
    branchWhereFilter(scope),
  );
  return jsonWithPagination({ purchaseOrders }, total, pg);
}

const LineBody = z.object({
  itemId: z.string().trim().min(1),
  orderedQty: z.coerce.number().positive("must be greater than 0"),
  unitCost: zMoney.optional(),
});

const PoCreateBody = z.object({
  supplierId: z.string().trim().min(1).nullish(),
  branchId: z.string().trim().min(1).nullish(),
  currency: z.string().trim().min(1).max(8).nullish(),
  notes: z.string().trim().min(1).nullish(),
  expectedAt: zDateString,
  lines: z.array(LineBody).optional(),
});

export const POST = withRoute("admin.inventory.purchaseOrders.POST", poCreatePost);

async function poCreatePost(req: Request) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;

  const parsed = await parseJson(req, PoCreateBody);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;

  const r = await createPo({
    supplierId: b.supplierId ?? null,
    branchId: b.branchId ?? (await resolveActiveBranchId()),
    currency: b.currency ?? null,
    notes: b.notes ?? null,
    expectedAt: b.expectedAt ? new Date(b.expectedAt) : null,
    lines: b.lines?.map((l) => ({ itemId: l.itemId, orderedQty: l.orderedQty, unitCost: l.unitCost ?? 0 })),
    actor: session,
    ip: auditIp(req),
  });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}
