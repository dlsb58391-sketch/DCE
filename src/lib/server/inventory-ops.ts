/**
 * Inventory — database/transaction operations service.
 *
 * Thin, well-typed layer between the API routes and Prisma. All stock math is
 * delegated to the pure helpers in inventory.ts; this module owns the
 * transactional writes (create batch + ledger movement + decrement) and the
 * read aggregations (on-hand / valuation / low-stock / expiry) used by the UI.
 *
 * Invariants enforced here:
 *   - On-hand = Σ InventoryBatch.remainingQty and equals Σ StockMovement delta
 *     (every write updates a batch AND appends exactly one movement, atomically).
 *   - remainingQty can never go negative: decrements use a conditional
 *     `updateMany ... where remainingQty >= qty`; a losing race rolls the whole
 *     transaction back and surfaces `insufficient_stock`.
 *   - Every mutation writes an audit row (best-effort, never blocks).
 *
 * Result shape: every operation returns a discriminated `OpResult` so routes do
 * `if (!r.ok) return errorJson(r.code, r.status, ...)` without throwing.
 */
import { prisma } from "@/lib/db";
import type { TxClient } from "@/lib/db";
import type { InventoryBatch } from "@prisma/client";
import { num, type DecimalLike } from "@/lib/server/money";
import { writeAudit } from "@/lib/server/audit";
import type { SessionPayload } from "@/lib/server/auth";
import {
  allocateFefo,
  isExpired,
  isExpiringSoon,
  isLowStock,
  onHand as onHandOf,
  round2,
  round3,
  valuation as valuationOf,
  type MovementType,
} from "@/lib/server/inventory";

type Actor = Pick<SessionPayload, "sub" | "name">;

export type OpOk<T> = { ok: true; data: T };
export type OpErr = { ok: false; code: string; status: number; message: string; details?: unknown };
export type OpResult<T> = OpOk<T> | OpErr;

const ok = <T>(data: T): OpOk<T> => ({ ok: true, data });
const fail = (code: string, status: number, message: string, details?: unknown): OpErr => ({
  ok: false,
  code,
  status,
  message,
  details,
});

/** Thrown inside a transaction to force rollback on a lost decrement race. */
class InsufficientStockError extends Error {}

// ---------------------------------------------------------------------------
// Serialization (Decimal -> number for the JSON API contract)
// ---------------------------------------------------------------------------

export function serializeBatch<
  T extends { unitCost: DecimalLike; receivedQty: DecimalLike; remainingQty: DecimalLike },
>(b: T): Omit<T, "unitCost" | "receivedQty" | "remainingQty"> & {
  unitCost: number;
  receivedQty: number;
  remainingQty: number;
} {
  return { ...b, unitCost: num(b.unitCost), receivedQty: num(b.receivedQty), remainingQty: num(b.remainingQty) };
}

export function serializeMovement<
  T extends { quantityDelta: DecimalLike; unitCost: DecimalLike; totalCost: DecimalLike },
>(m: T): Omit<T, "quantityDelta" | "unitCost" | "totalCost"> & {
  quantityDelta: number;
  unitCost: number | null;
  totalCost: number | null;
} {
  return {
    ...m,
    quantityDelta: num(m.quantityDelta),
    unitCost: m.unitCost == null ? null : num(m.unitCost),
    totalCost: m.totalCost == null ? null : num(m.totalCost),
  };
}

export function serializeItem<T extends { reorderLevel: DecimalLike; reorderQty: DecimalLike }>(
  i: T,
): Omit<T, "reorderLevel" | "reorderQty"> & { reorderLevel: number; reorderQty: number | null } {
  return { ...i, reorderLevel: num(i.reorderLevel), reorderQty: i.reorderQty == null ? null : num(i.reorderQty) };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

type BatchAgg = { itemId: string; remainingQty: DecimalLike; unitCost: DecimalLike };

/** Group live-stock batches by item and fold into on-hand + valuation maps. */
function foldStock(rows: BatchAgg[]): { onHand: Map<string, number>; value: Map<string, number> } {
  const byItem = new Map<string, { remainingQty: number; unitCost: number }[]>();
  for (const r of rows) {
    const arr = byItem.get(r.itemId) ?? [];
    arr.push({ remainingQty: num(r.remainingQty), unitCost: num(r.unitCost) });
    byItem.set(r.itemId, arr);
  }
  const onHand = new Map<string, number>();
  const value = new Map<string, number>();
  for (const [itemId, arr] of byItem) {
    onHand.set(itemId, onHandOf(arr));
    value.set(itemId, valuationOf(arr));
  }
  return { onHand, value };
}

export type ItemFilter = { search?: string | null; includeInactive?: boolean; lowOnly?: boolean };

/**
 * List items with derived on-hand, valuation and low-stock flag. Soft-deleted
 * items are hidden automatically by the Prisma extension; `includeInactive`
 * controls whether archived (active=false) items are shown.
 */
export async function listItemsWithStock(
  filter: ItemFilter,
  take: number | undefined,
  skip: number | undefined,
  branchFilter: Record<string, unknown> = {},
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
  const where: Record<string, unknown> = {};
  if (!filter.includeInactive) where.active = true;
  if (filter.search && filter.search.trim()) {
    const q = filter.search.trim();
    where.OR = [
      { nameEn: { contains: q, mode: "insensitive" } },
      { nameAr: { contains: q } },
      { sku: { contains: q, mode: "insensitive" } },
      { barcode: { contains: q } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }
  // Restrict to the active branch's own items (owners viewing all pass `{}`).
  // Combined via AND so it never clobbers the search `OR` above.
  if (Object.keys(branchFilter).length) where.AND = [branchFilter];
  const [items, total] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
      take,
      skip,
    }),
    prisma.inventoryItem.count({ where }),
  ]);
  const ids = items.map((i) => i.id);
  const batches = ids.length
    ? await prisma.inventoryBatch.findMany({
        where: { itemId: { in: ids }, remainingQty: { gt: 0 } },
        select: { itemId: true, remainingQty: true, unitCost: true },
      })
    : [];
  const { onHand, value } = foldStock(batches);
  let out = items.map((i) => {
    const oh = onHand.get(i.id) ?? 0;
    const reorderLevel = num(i.reorderLevel);
    return {
      ...serializeItem(i),
      onHand: oh,
      valuation: value.get(i.id) ?? 0,
      lowStock: isLowStock(oh, reorderLevel),
    };
  });
  if (filter.lowOnly) out = out.filter((r) => r.lowStock);
  return { items: out, total };
}

/** Full detail for one item: catalog + live/depleted batches + recent movements. */
export async function getItemDetail(
  itemId: string,
  movementLimit = 50,
): Promise<OpResult<Record<string, unknown>>> {
  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId } });
  if (!item) return fail("item_not_found", 404, "inventory item not found");
  const [batches, movements] = await Promise.all([
    prisma.inventoryBatch.findMany({
      where: { itemId },
      orderBy: [{ remainingQty: "desc" }, { expiryDate: "asc" }, { receivedAt: "asc" }],
    }),
    prisma.stockMovement.findMany({
      where: { itemId },
      orderBy: { createdAt: "desc" },
      take: movementLimit,
    }),
  ]);
  const live = batches.filter((b) => num(b.remainingQty) > 0);
  const oh = onHandOf(live.map((b) => ({ remainingQty: num(b.remainingQty) })));
  const reorderLevel = num(item.reorderLevel);
  return ok({
    item: {
      ...serializeItem(item),
      onHand: oh,
      valuation: valuationOf(live.map((b) => ({ remainingQty: num(b.remainingQty), unitCost: num(b.unitCost) }))),
      lowStock: isLowStock(oh, reorderLevel),
    },
    batches: batches.map(serializeBatch),
    movements: movements.map(serializeMovement),
  });
}

/** Aggregate inventory report: totals + low-stock, expiring and expired lists. */
export async function inventoryReport(
  expiringDays = 30,
  branchFilter: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const itemWhere = Object.keys(branchFilter).length ? { active: true, AND: [branchFilter] } : { active: true };
  const batchWhere = Object.keys(branchFilter).length
    ? { remainingQty: { gt: 0 }, item: { deletedAt: null }, AND: [branchFilter] }
    : { remainingQty: { gt: 0 }, item: { deletedAt: null } };
  const [items, batches] = await Promise.all([
    prisma.inventoryItem.findMany({ where: itemWhere, select: { id: true, nameEn: true, nameAr: true, unit: true, reorderLevel: true } }),
    prisma.inventoryBatch.findMany({
      where: batchWhere,
      select: { itemId: true, remainingQty: true, unitCost: true, expiryDate: true, lotNumber: true, id: true, item: { select: { nameEn: true, nameAr: true, unit: true } } },
    }),
  ]);
  const { onHand, value } = foldStock(batches);
  const totalValuation = round2([...value.values()].reduce((s, v) => s + v, 0));
  const lowStock = items
    .map((i) => ({ id: i.id, nameEn: i.nameEn, nameAr: i.nameAr, unit: i.unit, onHand: onHand.get(i.id) ?? 0, reorderLevel: num(i.reorderLevel) }))
    .filter((r) => isLowStock(r.onHand, r.reorderLevel));
  const now = new Date();
  const expiring = batches
    .filter((b) => isExpiringSoon(b.expiryDate, expiringDays, now))
    .map((b) => ({ batchId: b.id, itemId: b.itemId, name: b.item.nameEn || b.item.nameAr, unit: b.item.unit, lotNumber: b.lotNumber, expiryDate: b.expiryDate, remainingQty: num(b.remainingQty) }));
  const expired = batches
    .filter((b) => isExpired(b.expiryDate, now))
    .map((b) => ({ batchId: b.id, itemId: b.itemId, name: b.item.nameEn || b.item.nameAr, unit: b.item.unit, lotNumber: b.lotNumber, expiryDate: b.expiryDate, remainingQty: num(b.remainingQty) }));
  return {
    totalItems: items.length,
    totalValuation,
    lowStockCount: lowStock.length,
    expiringCount: expiring.length,
    expiredCount: expired.length,
    lowStock,
    expiring,
    expired,
  };
}

/** Barcode/SKU lookup for scanning: first live item whose barcode or sku matches. */
export async function lookupItem(code: string): Promise<OpResult<Record<string, unknown>>> {
  const c = code.trim();
  if (!c) return fail("code_required", 400, "a barcode or sku is required");
  const item = await prisma.inventoryItem.findFirst({ where: { OR: [{ barcode: c }, { sku: c }] } });
  if (!item) return fail("item_not_found", 404, "no item matches that code");
  const detail = await getItemDetail(item.id, 1);
  return detail;
}

// ---------------------------------------------------------------------------
// Writes (transactional)
// ---------------------------------------------------------------------------

/**
 * Post a goods receipt onto an existing transaction: create one InventoryBatch
 * and append the matching `receipt` StockMovement (the two writes that together
 * add stock). Extracted so both manual receiving ({@link receiveStock}) and
 * purchase-order receiving share ONE atomic code path — the caller owns the
 * transaction and any surrounding writes (e.g. advancing a PO line + status).
 *
 * `referenceType`/`referenceId` tag the movement's provenance: "Manual" (the
 * default) for ad-hoc receiving, or "PurchaseOrder" + the PO id when receiving
 * against an order. Returns the created batch plus the normalized qty/cost so
 * the caller can write its audit row without re-rounding.
 */
export async function postReceipt(
  tx: TxClient,
  p: {
    itemId: string;
    supplierId?: string | null;
    lotNumber?: string | null;
    expiryDate?: Date | null;
    unitCost: number;
    quantity: number;
    branchId?: string | null;
    notes?: string | null;
    actor: Actor;
    referenceType?: string | null;
    referenceId?: string | null;
  },
): Promise<{ batch: InventoryBatch; qty: number; cost: number }> {
  const qty = round3(p.quantity);
  const cost = round2(p.unitCost);
  const batch = await tx.inventoryBatch.create({
    data: {
      itemId: p.itemId,
      supplierId: p.supplierId ?? null,
      branchId: p.branchId ?? null,
      lotNumber: p.lotNumber ?? null,
      expiryDate: p.expiryDate ?? null,
      unitCost: cost,
      receivedQty: qty,
      remainingQty: qty,
      notes: p.notes ?? null,
    },
  });
  await tx.stockMovement.create({
    data: {
      itemId: p.itemId,
      batchId: batch.id,
      branchId: p.branchId ?? null,
      type: "receipt",
      quantityDelta: qty,
      unitCost: cost,
      totalCost: round2(qty * cost),
      reason: p.notes ?? null,
      referenceType: p.referenceType ?? "Manual",
      referenceId: p.referenceId ?? null,
      actorId: p.actor.sub,
      actorName: p.actor.name,
    },
  });
  return { batch, qty, cost };
}

/** Receive stock: create a batch and append a `receipt` movement. */
export async function receiveStock(p: {
  itemId: string;
  supplierId?: string | null;
  lotNumber?: string | null;
  expiryDate?: Date | null;
  unitCost: number;
  quantity: number;
  branchId?: string | null;
  notes?: string | null;
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<Record<string, unknown>>> {
  if (!(p.quantity > 0)) return fail("invalid_quantity", 400, "quantity must be greater than 0");
  if (p.unitCost < 0) return fail("invalid_cost", 400, "unitCost must be >= 0");
  const item = await prisma.inventoryItem.findFirst({ where: { id: p.itemId }, select: { id: true, nameEn: true, nameAr: true } });
  if (!item) return fail("item_not_found", 404, "inventory item not found");
  if (p.supplierId) {
    const s = await prisma.supplier.findFirst({ where: { id: p.supplierId }, select: { id: true } });
    if (!s) return fail("supplier_not_found", 404, "supplier not found");
  }
  const { batch, qty, cost } = await prisma.$transaction((tx) =>
    postReceipt(tx, {
      itemId: item.id,
      supplierId: p.supplierId ?? null,
      lotNumber: p.lotNumber ?? null,
      expiryDate: p.expiryDate ?? null,
      unitCost: p.unitCost,
      quantity: p.quantity,
      branchId: p.branchId ?? null,
      notes: p.notes ?? null,
      actor: p.actor,
      referenceType: "Manual",
    }),
  );
  await writeAudit({
    action: "inventory.receive",
    actor: p.actor,
    entityType: "InventoryItem",
    entityId: item.id,
    summary: `Received ${qty} into ${item.nameEn || item.nameAr}`,
    metadata: { batchId: batch.id, quantity: qty, unitCost: cost, supplierId: p.supplierId ?? null },
    ip: p.ip ?? null,
  });
  return ok({ batch: serializeBatch(batch) });
}

/** Decrease stock (consumption / wastage / return) drawing down batches FEFO. */
export async function decreaseStock(p: {
  itemId: string;
  type: Extract<MovementType, "consumption" | "wastage" | "return">;
  quantity: number;
  reason?: string | null;
  batchId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<Record<string, unknown>>> {
  if (!(p.quantity > 0)) return fail("invalid_quantity", 400, "quantity must be greater than 0");
  const item = await prisma.inventoryItem.findFirst({ where: { id: p.itemId }, select: { id: true, nameEn: true, nameAr: true } });
  if (!item) return fail("item_not_found", 404, "inventory item not found");

  const where: Record<string, unknown> = { itemId: item.id, remainingQty: { gt: 0 } };
  if (p.batchId) where.id = p.batchId;
  const rows = await prisma.inventoryBatch.findMany({
    where,
    select: { id: true, remainingQty: true, unitCost: true, expiryDate: true, receivedAt: true, branchId: true },
  });
  const available = onHandOf(rows.map((b) => ({ remainingQty: num(b.remainingQty) })));
  const plan = allocateFefo(
    rows.map((b) => ({ id: b.id, remainingQty: num(b.remainingQty), unitCost: num(b.unitCost), expiryDate: b.expiryDate, receivedAt: b.receivedAt })),
    p.quantity,
  );
  if (plan.shortfall > 0) {
    return fail("insufficient_stock", 409, `not enough stock: requested ${p.quantity}, available ${available}`, {
      requested: p.quantity,
      available,
      shortfall: plan.shortfall,
    });
  }
  const costByBatch = new Map(rows.map((b) => [b.id, num(b.unitCost)]));
  // A movement belongs to the branch that physically holds the drawn-down batch,
  // so consumption/wastage/return ledger rows inherit each batch's branchId.
  const branchByBatch = new Map(rows.map((b) => [b.id, b.branchId ?? null]));

  let movements: Array<Record<string, unknown>>;
  try {
    movements = await prisma.$transaction(async (tx) => {
      const created: Array<Record<string, unknown>> = [];
      for (const a of plan.allocations) {
        const upd = await tx.inventoryBatch.updateMany({
          where: { id: a.batchId, remainingQty: { gte: a.qty } },
          data: { remainingQty: { decrement: a.qty } },
        });
        if (upd.count !== 1) throw new InsufficientStockError();
        const unitCost = costByBatch.get(a.batchId) ?? 0;
        const m = await tx.stockMovement.create({
          data: {
            itemId: item.id,
            batchId: a.batchId,
            branchId: branchByBatch.get(a.batchId) ?? null,
            type: p.type,
            quantityDelta: -a.qty,
            unitCost,
            totalCost: round2(a.qty * unitCost),
            reason: p.reason ?? null,
            referenceType: p.referenceType ?? "Manual",
            referenceId: p.referenceId ?? null,
            actorId: p.actor.sub,
            actorName: p.actor.name,
          },
        });
        created.push(serializeMovement(m));
      }
      return created;
    });
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return fail("insufficient_stock", 409, "stock changed during the operation, please retry", { requested: p.quantity });
    }
    throw e;
  }
  await writeAudit({
    action: `inventory.${p.type}`,
    actor: p.actor,
    entityType: "InventoryItem",
    entityId: item.id,
    summary: `${p.type} ${p.quantity} from ${item.nameEn || item.nameAr}`,
    metadata: { quantity: p.quantity, allocations: plan.allocations, reason: p.reason ?? null },
    ip: p.ip ?? null,
  });
  return ok({ movements, allocations: plan.allocations });
}

/** Correct a single batch's remaining quantity by a signed delta (audited). */
export async function adjustBatch(p: {
  batchId: string;
  delta: number;
  reason: string;
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<Record<string, unknown>>> {
  if (!Number.isFinite(p.delta) || p.delta === 0) return fail("invalid_quantity", 400, "delta must be a non-zero number");
  if (!p.reason || !p.reason.trim()) return fail("reason_required", 400, "a reason is required for adjustments");
  const batch = await prisma.inventoryBatch.findUnique({
    where: { id: p.batchId },
    select: { id: true, itemId: true, remainingQty: true, unitCost: true, branchId: true },
  });
  if (!batch) return fail("batch_not_found", 404, "batch not found");
  const item = await prisma.inventoryItem.findFirst({ where: { id: batch.itemId }, select: { id: true, nameEn: true, nameAr: true } });
  if (!item) return fail("item_not_found", 404, "inventory item not found");
  const delta = round3(p.delta);
  const current = num(batch.remainingQty);
  if (round3(current + delta) < 0) {
    return fail("insufficient_stock", 409, "adjustment would make stock negative", { current, delta });
  }
  const unitCost = num(batch.unitCost);
  let movement: Record<string, unknown> | null;
  try {
    movement = await prisma.$transaction(async (tx) => {
      // Guard: for a decrease, require enough remaining; for an increase, always ok.
      const guard = delta < 0 ? { gte: -delta } : { gte: 0 };
      const upd = await tx.inventoryBatch.updateMany({
        where: { id: batch.id, remainingQty: guard },
        data: { remainingQty: { increment: delta } },
      });
      if (upd.count !== 1) throw new InsufficientStockError();
      const m = await tx.stockMovement.create({
        data: {
          itemId: item.id,
          batchId: batch.id,
          branchId: batch.branchId ?? null,
          type: "adjustment",
          quantityDelta: delta,
          unitCost,
          totalCost: round2(Math.abs(delta) * unitCost),
          reason: p.reason,
          referenceType: "Manual",
          actorId: p.actor.sub,
          actorName: p.actor.name,
        },
      });
      return serializeMovement(m);
    });
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return fail("insufficient_stock", 409, "adjustment would make stock negative", { current, delta });
    }
    throw e;
  }
  await writeAudit({
    action: "inventory.adjustment",
    actor: p.actor,
    entityType: "InventoryItem",
    entityId: item.id,
    summary: `Adjusted ${item.nameEn || item.nameAr} by ${delta}`,
    metadata: { batchId: batch.id, delta, reason: p.reason },
    ip: p.ip ?? null,
  });
  return ok({ movement });
}
