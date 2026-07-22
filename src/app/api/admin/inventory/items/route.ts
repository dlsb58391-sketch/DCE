import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { getPagination, jsonWithPagination } from "@/lib/server/pagination";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z, zOptText } from "@/lib/server/validate";
import { listItemsWithStock, serializeItem } from "@/lib/server/inventory-ops";
import { resolveActiveBranchId, resolveBranchScope, branchWhereFilter } from "@/lib/server/branch-context";

/** Truthy query flag: `1`, `true`, `yes` (case-insensitive) all enable. */
function flag(v: string | null): boolean {
  return v === "1" || v?.toLowerCase() === "true" || v?.toLowerCase() === "yes";
}

/**
 * Inventory items catalog with derived on-hand / valuation / low-stock.
 *
 * GET is readable by any signed-in staff member. `?search=` matches name/sku/
 * barcode/category; `?inactive=1` includes archived items; `?low=1` returns only
 * items at or below their reorder level. Soft-deleted items are auto-hidden.
 */
export const GET = withRoute("admin.inventory.items.GET", itemsGet);

async function itemsGet(req: Request) {
  const { error, session } = await requireSession();
  if (error) return error;

  const sp = new URL(req.url).searchParams;
  const pg = getPagination(req, { defaultLimit: 200, maxLimit: 500 });
  const scope = await resolveBranchScope({ role: session?.role });
  const { items, total } = await listItemsWithStock(
    { search: sp.get("search"), includeInactive: flag(sp.get("inactive")), lowOnly: flag(sp.get("low")) },
    pg.take,
    pg.skip,
    branchWhereFilter(scope),
  );
  return jsonWithPagination({ items }, total, pg);
}

const ItemCreateBody = z
  .object({
    nameEn: zOptText,
    nameAr: zOptText,
    sku: zOptText,
    barcode: zOptText,
    category: zOptText,
    unit: zOptText,
    notes: zOptText,
    reorderLevel: z.coerce.number().min(0, "must be >= 0").optional(),
    reorderQty: z.coerce.number().min(0, "must be >= 0").nullish(),
    active: z.boolean().optional(),
  })
  .refine((b) => Boolean(b.nameEn || b.nameAr), { message: "name_required", path: ["nameEn"] });

export const POST = withRoute("admin.inventory.items.POST", itemsPost);

async function itemsPost(req: Request) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;

  const parsed = await parseJson(req, ItemCreateBody);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;

  const sku = b.sku?.trim() || null;
  // sku is @unique across ALL rows including soft-deleted, so opt out of the
  // live-only scope (`deletedAt: undefined`) to catch a clash with a trashed item.
  if (sku) {
    const clash = await prisma.inventoryItem.findFirst({ where: { sku, deletedAt: undefined }, select: { id: true } });
    if (clash) return errorJson("sku_taken", 409, { message: "That SKU is already in use." });
  }

  const nameEn = b.nameEn ?? "";
  const nameAr = b.nameAr ?? "";
  const max = await prisma.inventoryItem.aggregate({ _max: { sortOrder: true } });
  const item = await prisma.inventoryItem.create({
    data: {
      nameEn: nameEn || nameAr,
      nameAr: nameAr || nameEn,
      sku,
      barcode: b.barcode ?? null,
      category: b.category ?? null,
      unit: b.unit || "piece",
      reorderLevel: b.reorderLevel ?? 0,
      reorderQty: b.reorderQty ?? null,
      notes: b.notes ?? null,
      active: b.active ?? true,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      branchId: await resolveActiveBranchId(),
    },
  });
  await writeAudit({
    action: "item.create",
    actor: session,
    entityType: "InventoryItem",
    entityId: item.id,
    summary: `Created inventory item ${item.nameEn || item.nameAr}`,
    ip: auditIp(req),
  });
  // A fresh item has no batches yet: on-hand and valuation are 0.
  return NextResponse.json({ item: { ...serializeItem(item), onHand: 0, valuation: 0, lowStock: false } });
}
