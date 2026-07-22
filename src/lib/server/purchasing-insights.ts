/**
 * Purchasing insights — read-only reporting derived from existing inventory data.
 *
 * Nothing here writes or changes stock; every figure is computed from the same
 * tables the stock foundation already maintains:
 *   - on-hand      = Σ InventoryBatch.remainingQty (live batches)
 *   - on-order     = Σ (orderedQty − receivedQty) over open PurchaseOrder lines
 *                    (status submitted | partially_received; trashed POs excluded
 *                    automatically by the soft-delete read extension)
 *   - last price   = the most recent InventoryBatch for the item (its supplier +
 *                    unit cost + received date) → supplier price history
 *
 * Pure math (reorder suggestion) lives in inventory.ts and is unit-tested; this
 * module only fetches and shapes rows for the API.
 */
import { prisma } from "@/lib/db";
import { num } from "@/lib/server/money";
import { isLowStock, round2, round3, suggestedOrderQty } from "@/lib/server/inventory";

export type OpResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; status: number; message: string };

const ok = <T>(data: T): OpResult<T> => ({ ok: true, data });
const fail = (code: string, status: number, message: string): OpResult<never> => ({
  ok: false,
  code,
  status,
  message,
});

type SupplierRef = { id: string; nameEn: string; nameAr: string } | null;

export type ReorderRow = {
  id: string;
  nameEn: string;
  nameAr: string;
  unit: string;
  onHand: number;
  onOrder: number;
  reorderLevel: number;
  reorderQty: number | null;
  suggestedQty: number;
  lastUnitCost: number | null;
  lastPurchaseAt: string | null;
  lastSupplier: SupplierRef;
};

/** Statuses whose outstanding lines still count as "on order" (yet to arrive). */
const OPEN_PO_STATUSES = ["submitted", "partially_received"] as const;

/**
 * Reorder suggestions: every active item at/below its reorder level, annotated
 * with how much is already on order and a suggested quantity to buy (netting out
 * open POs). Includes the last purchase (supplier + unit cost + date) so a buyer
 * can act without leaving the screen. Items with no reorder level are ignored.
 */
export async function reorderReport(): Promise<{ count: number; items: ReorderRow[] }> {
  const items = await prisma.inventoryItem.findMany({
    where: { active: true, reorderLevel: { gt: 0 } },
    select: { id: true, nameEn: true, nameAr: true, unit: true, reorderLevel: true, reorderQty: true },
  });
  if (items.length === 0) return { count: 0, items: [] };

  const ids = items.map((i) => i.id);
  const idSet = new Set(ids);

  const [batches, openPos, lastBatches] = await Promise.all([
    prisma.inventoryBatch.findMany({
      where: { itemId: { in: ids }, remainingQty: { gt: 0 } },
      select: { itemId: true, remainingQty: true },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: [...OPEN_PO_STATUSES] } },
      select: { lines: { select: { itemId: true, orderedQty: true, receivedQty: true } } },
    }),
    prisma.inventoryBatch.findMany({
      where: { itemId: { in: ids } },
      orderBy: [{ itemId: "asc" }, { receivedAt: "desc" }],
      distinct: ["itemId"],
      select: {
        itemId: true,
        unitCost: true,
        receivedAt: true,
        supplier: { select: { id: true, nameEn: true, nameAr: true } },
      },
    }),
  ]);

  const onHandByItem = new Map<string, number>();
  for (const b of batches) {
    onHandByItem.set(b.itemId, round3((onHandByItem.get(b.itemId) ?? 0) + num(b.remainingQty)));
  }

  const onOrderByItem = new Map<string, number>();
  for (const po of openPos) {
    for (const l of po.lines) {
      if (!l.itemId || !idSet.has(l.itemId)) continue;
      const remaining = Math.max(0, num(l.orderedQty) - num(l.receivedQty));
      onOrderByItem.set(l.itemId, round3((onOrderByItem.get(l.itemId) ?? 0) + remaining));
    }
  }

  const lastByItem = new Map<string, (typeof lastBatches)[number]>();
  for (const b of lastBatches) lastByItem.set(b.itemId, b);

  const rows: ReorderRow[] = items
    .map((i) => {
      const onHand = onHandByItem.get(i.id) ?? 0;
      const onOrder = onOrderByItem.get(i.id) ?? 0;
      const reorderLevel = num(i.reorderLevel);
      const reorderQty = i.reorderQty == null ? null : num(i.reorderQty);
      const last = lastByItem.get(i.id);
      return {
        id: i.id,
        nameEn: i.nameEn,
        nameAr: i.nameAr,
        unit: i.unit,
        onHand,
        onOrder,
        reorderLevel,
        reorderQty,
        suggestedQty: suggestedOrderQty(onHand, onOrder, reorderLevel, reorderQty),
        lastUnitCost: last ? round2(num(last.unitCost)) : null,
        lastPurchaseAt: last ? last.receivedAt.toISOString() : null,
        lastSupplier: last?.supplier
          ? { id: last.supplier.id, nameEn: last.supplier.nameEn, nameAr: last.supplier.nameAr }
          : null,
      };
    })
    .filter((r) => isLowStock(r.onHand, r.reorderLevel));

  // Most actionable first: biggest suggested buy, then most depleted, then name.
  rows.sort(
    (a, b) => b.suggestedQty - a.suggestedQty || a.onHand - b.onHand || a.nameEn.localeCompare(b.nameEn),
  );

  return { count: rows.length, items: rows };
}

export type PurchaseHistoryRow = {
  batchId: string;
  lotNumber: string | null;
  unitCost: number;
  receivedQty: number;
  receivedAt: string;
  supplier: SupplierRef;
};

/**
 * Supplier price history for one item: its most recent receipts (newest first),
 * each with the supplier, unit cost, quantity and date. Read-only; useful for
 * negotiating and spotting price creep. `limit` caps the rows returned.
 */
export async function itemPurchaseHistory(
  itemId: string,
  limit = 20,
): Promise<OpResult<{ item: { id: string; nameEn: string; nameAr: string; unit: string }; purchaseHistory: PurchaseHistoryRow[] }>> {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: itemId },
    select: { id: true, nameEn: true, nameAr: true, unit: true },
  });
  if (!item) return fail("item_not_found", 404, "inventory item not found");

  const take = Math.min(100, Math.max(1, Math.floor(limit)));
  const batches = await prisma.inventoryBatch.findMany({
    where: { itemId },
    orderBy: { receivedAt: "desc" },
    take,
    select: {
      id: true,
      lotNumber: true,
      unitCost: true,
      receivedQty: true,
      receivedAt: true,
      supplier: { select: { id: true, nameEn: true, nameAr: true } },
    },
  });

  const purchaseHistory: PurchaseHistoryRow[] = batches.map((b) => ({
    batchId: b.id,
    lotNumber: b.lotNumber,
    unitCost: round2(num(b.unitCost)),
    receivedQty: round3(num(b.receivedQty)),
    receivedAt: b.receivedAt.toISOString(),
    supplier: b.supplier
      ? { id: b.supplier.id, nameEn: b.supplier.nameEn, nameAr: b.supplier.nameAr }
      : null,
  }));

  return ok({ item, purchaseHistory });
}
