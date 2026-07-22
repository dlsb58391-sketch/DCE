import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { softDeleteEntity } from "@/lib/server/soft-delete-ops";
import { parseJson, z, zOptText } from "@/lib/server/validate";
import { withRoute, errorJson } from "@/lib/server/http";
import { getItemDetail, serializeItem } from "@/lib/server/inventory-ops";

/**
 * One inventory item: full detail (GET), catalog edit (PATCH) or soft-delete
 * (DELETE). Stock is never changed here — receiving and adjustments have their
 * own transactional endpoints so every quantity change is a ledger movement.
 */
export const GET = withRoute("admin.inventory.items.id.GET", itemGet);

async function itemGet(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  const r = await getItemDetail(id);
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}

const ItemUpdateBody = z.object({
  nameEn: zOptText,
  nameAr: zOptText,
  sku: z.string().nullish(),
  barcode: z.string().nullish(),
  category: z.string().nullish(),
  unit: zOptText,
  notes: z.string().nullish(),
  reorderLevel: z.coerce.number().min(0, "must be >= 0").optional(),
  reorderQty: z.coerce.number().min(0, "must be >= 0").nullish(),
  active: z.boolean().nullish(),
});

function textPatch(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v == null) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

export const PATCH = withRoute("admin.inventory.items.id.PATCH", itemPatch);

async function itemPatch(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, ItemUpdateBody);
  if (!parsed.ok) return parsed.response;
  const b = parsed.data;

  const data: Record<string, unknown> = {};
  if (typeof b.nameEn === "string" && b.nameEn.trim()) data.nameEn = b.nameEn.trim();
  if (typeof b.nameAr === "string" && b.nameAr.trim()) data.nameAr = b.nameAr.trim();
  if (typeof b.unit === "string" && b.unit.trim()) data.unit = b.unit.trim();
  for (const key of ["barcode", "category", "notes"] as const) {
    const patch = textPatch(b[key]);
    if (patch !== undefined) data[key] = patch;
  }
  if (b.reorderLevel !== undefined) data.reorderLevel = b.reorderLevel;
  if (b.reorderQty !== undefined) data.reorderQty = b.reorderQty;
  if (typeof b.active === "boolean") data.active = b.active;

  if (b.sku !== undefined) {
    const sku = b.sku == null ? null : b.sku.trim() || null;
    if (sku) {
      const clash = await prisma.inventoryItem.findFirst({
        where: { sku, deletedAt: undefined, NOT: { id } },
        select: { id: true },
      });
      if (clash) return errorJson("sku_taken", 409, { message: "That SKU is already in use." });
    }
    data.sku = sku;
  }

  const item = await prisma.inventoryItem.update({ where: { id }, data });
  await writeAudit({
    action: "item.update",
    actor: session,
    entityType: "InventoryItem",
    entityId: id,
    summary: `Updated inventory item ${item.nameEn || item.nameAr}`,
    ip: auditIp(req),
  });
  return NextResponse.json({ item: serializeItem(item) });
}

export const DELETE = withRoute("admin.inventory.items.id.DELETE", itemDelete);

async function itemDelete(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  // Soft-delete only: batches + ledger stay intact and hidden with the item, so
  // a restore brings back the exact stock position. Permanent removal (which
  // cascades the ledger) is an admin-only action from the Recycle Bin.
  await softDeleteEntity("InventoryItem", id, session?.sub ?? null);
  await writeAudit({
    action: "item.delete",
    actor: session,
    entityType: "InventoryItem",
    entityId: id,
    summary: `Deleted inventory item ${id}`,
    ip: auditIp(req),
  });
  return NextResponse.json({ ok: true });
}
