/**
 * Purchase Orders — database/transaction operations service.
 *
 * Thin, well-typed layer between the PO API routes and Prisma. All status/value
 * math is delegated to the pure helpers in purchase-orders.ts; this module owns
 * the transactional writes and the read aggregations used by the UI.
 *
 * Invariants enforced here:
 *   - PO code is unique per year (`PO-YYYY-NNNN`), allocated inside the create
 *     transaction and retried on a unique-constraint clash.
 *   - Receiving a line reuses the audited inventory receive path
 *     ({@link postReceipt}) inside ONE transaction that also increments the
 *     line's receivedQty and recomputes the PO status — so stock, ledger, line
 *     progress and header status can never drift apart.
 *   - Over-receipt is rejected (a line can never receive more than it ordered),
 *     accounting for multiple receipts against the same line in one payload.
 *   - Trashing a PO (soft-delete, handled by the route) never touches stock that
 *     was already received — those batches/movements are real inventory.
 *
 * Result shape: every operation returns a discriminated `OpResult` so routes do
 * `if (!r.ok) return errorJson(r.code, r.status, ...)` without throwing.
 */
import { prisma } from "@/lib/db";
import type { TxClient } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { num, type DecimalLike } from "@/lib/server/money";
import { writeAudit } from "@/lib/server/audit";
import type { SessionPayload } from "@/lib/server/auth";
import { postReceipt } from "@/lib/server/inventory-ops";
import { round2, round3 } from "@/lib/server/inventory";
import {
  canCancelPo,
  canEditPoHeader,
  canEditPoLines,
  canReceivePo,
  canSubmitPo,
  computePoStatus,
  isPoLineFullyReceived,
  isPoStatus,
  poOrderedValue,
  poReceivedValue,
  poRemainingValue,
  type PoStatus,
} from "@/lib/server/purchase-orders";

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

/** Include shape shared by every PO read: ordered lines + a light supplier ref. */
const PO_INCLUDE = {
  lines: { orderBy: { sortOrder: "asc" } as const },
  supplier: { select: { id: true, nameEn: true, nameAr: true } },
} as const;

// ---------------------------------------------------------------------------
// Serialization (Decimal -> number for the JSON API contract)
// ---------------------------------------------------------------------------

type RawLine = {
  orderedQty: DecimalLike;
  receivedQty: DecimalLike;
  unitCost: DecimalLike;
};

export function serializePoLine<T extends RawLine>(
  l: T,
): Omit<T, "orderedQty" | "receivedQty" | "unitCost"> & {
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
} {
  return { ...l, orderedQty: num(l.orderedQty), receivedQty: num(l.receivedQty), unitCost: num(l.unitCost) };
}

type RawPo = {
  lines: RawLine[];
  supplier?: { id: string; nameEn: string; nameAr: string } | null;
  [key: string]: unknown;
};

/** Serialize a PO (+ lines) and fold in the ordered/received/remaining totals. */
export function serializePo(po: RawPo) {
  const { lines: rawLines, supplier, ...rest } = po;
  const lines = rawLines.map(serializePoLine);
  return {
    ...rest,
    supplierName: supplier ? supplier.nameEn || supplier.nameAr : null,
    lines,
    lineCount: lines.length,
    receivedLineCount: lines.filter((l) => isPoLineFullyReceived(l)).length,
    orderedValue: poOrderedValue(lines),
    receivedValue: poReceivedValue(lines),
    remainingValue: poRemainingValue(lines),
  };
}

// ---------------------------------------------------------------------------
// Code allocation
// ---------------------------------------------------------------------------

/**
 * Next PO code for the current year: `PO-YYYY-NNNN`, 1 above the highest suffix
 * already used this year. `deletedAt: undefined` opts out of the soft-delete
 * live-only scope so a trashed PO's code is still counted (codes are unique
 * across ALL rows). Runs inside the create transaction; a rare race is caught by
 * the P2002 retry in {@link createPo}.
 */
async function nextPoCode(tx: TxClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const rows = await tx.purchaseOrder.findMany({
    where: { code: { startsWith: prefix }, deletedAt: undefined },
    select: { code: true },
  });
  let max = 0;
  for (const r of rows) {
    const n = Number.parseInt(r.code.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Line validation (shared by create + draft update)
// ---------------------------------------------------------------------------

type LineInput = { itemId: string; orderedQty: number; unitCost?: number | null };
type LineData = {
  itemId: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  orderedQty: number;
  unitCost: number;
  sortOrder: number;
};

/**
 * Validate PO line inputs and snapshot each item's names. Returns typed line
 * rows ready to `create`, or an OpErr on the first invalid line / missing item.
 */
async function buildLineData(lines: LineInput[]): Promise<OpResult<LineData[]>> {
  if (lines.length === 0) return ok([]);
  const ids = [...new Set(lines.map((l) => l.itemId))];
  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: ids } },
    select: { id: true, nameEn: true, nameAr: true },
  });
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: LineData[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const item = byId.get(l.itemId);
    if (!item) return fail("item_not_found", 404, `inventory item ${l.itemId} not found`, { itemId: l.itemId });
    const orderedQty = round3(Number(l.orderedQty));
    if (!(orderedQty > 0)) return fail("invalid_quantity", 400, "each line quantity must be greater than 0");
    const unitCost = round2(Number(l.unitCost ?? 0));
    if (unitCost < 0) return fail("invalid_cost", 400, "unit cost must be >= 0");
    out.push({
      itemId: item.id,
      descriptionEn: item.nameEn || item.nameAr || null,
      descriptionAr: item.nameAr || item.nameEn || null,
      orderedQty,
      unitCost,
      sortOrder: i,
    });
  }
  return ok(out);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export type PoFilter = { status?: string | null; supplierId?: string | null; search?: string | null };

/** List purchase orders (newest first) with folded totals + supplier name. */
export async function listPos(
  filter: PoFilter,
  take: number | undefined,
  skip: number | undefined,
  branchFilter: Record<string, unknown> = {},
): Promise<{ purchaseOrders: Array<Record<string, unknown>>; total: number }> {
  const where: Record<string, unknown> = {};
  if (filter.status && isPoStatus(filter.status)) where.status = filter.status;
  if (filter.supplierId) where.supplierId = filter.supplierId;
  if (filter.search && filter.search.trim()) where.code = { contains: filter.search.trim(), mode: "insensitive" };
  // Restrict to the active branch's own orders; merge via AND so it never
  // clobbers the status/supplier/search filters above.
  if (Object.keys(branchFilter).length) where.AND = [branchFilter];
  const [rows, total] = await Promise.all([
    prisma.purchaseOrder.findMany({ where, orderBy: { createdAt: "desc" }, take, skip, include: PO_INCLUDE }),
    prisma.purchaseOrder.count({ where }),
  ]);
  return { purchaseOrders: rows.map(serializePo), total };
}

/** Full detail for one purchase order (lines + supplier + totals). */
export async function getPo(id: string): Promise<OpResult<Record<string, unknown>>> {
  const po = await prisma.purchaseOrder.findFirst({ where: { id }, include: PO_INCLUDE });
  if (!po) return fail("po_not_found", 404, "purchase order not found");
  return ok({ purchaseOrder: serializePo(po) });
}

// ---------------------------------------------------------------------------
// Writes (transactional)
// ---------------------------------------------------------------------------

/** Retry a create on a PO-code unique clash (rare concurrent allocation race). */
async function createWithCodeRetry<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
  const MAX = 5;
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction((tx) => fn(tx));
    } catch (e) {
      const clash = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (clash && attempt < MAX) continue;
      throw e;
    }
  }
}

/** Create a draft purchase order (optionally with lines, each item snapshotted). */
export async function createPo(p: {
  supplierId?: string | null;
  branchId?: string | null;
  currency?: string | null;
  notes?: string | null;
  expectedAt?: Date | null;
  lines?: LineInput[];
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<Record<string, unknown>>> {
  if (p.supplierId) {
    const s = await prisma.supplier.findFirst({ where: { id: p.supplierId }, select: { id: true } });
    if (!s) return fail("supplier_not_found", 404, "supplier not found");
  }
  const built = await buildLineData(p.lines ?? []);
  if (!built.ok) return built;

  const po = await createWithCodeRetry(async (tx) => {
    const code = await nextPoCode(tx);
    return tx.purchaseOrder.create({
      data: {
        code,
        supplierId: p.supplierId ?? null,
        branchId: p.branchId ?? null,
        status: "draft",
        currency: p.currency?.trim() || "EGP",
        notes: p.notes ?? null,
        expectedAt: p.expectedAt ?? null,
        createdBy: p.actor.sub ?? null,
        createdByName: p.actor.name ?? null,
        lines: { create: built.data },
      },
      include: PO_INCLUDE,
    });
  });
  await writeAudit({
    action: "inventory.po.create",
    actor: p.actor,
    entityType: "PurchaseOrder",
    entityId: po.id,
    summary: `Created purchase order ${po.code}`,
    metadata: { code: po.code, supplierId: p.supplierId ?? null, lineCount: built.data.length },
    ip: p.ip ?? null,
  });
  return ok({ purchaseOrder: serializePo(po) });
}

/**
 * Update a PO header (draft or submitted) and/or replace its lines (draft only).
 * Any field left `undefined` is unchanged; `lines` undefined leaves lines as-is.
 */
export async function updatePo(p: {
  id: string;
  supplierId?: string | null;
  branchId?: string | null;
  currency?: string;
  notes?: string | null;
  expectedAt?: Date | null;
  lines?: LineInput[];
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<Record<string, unknown>>> {
  const existing = await prisma.purchaseOrder.findFirst({ where: { id: p.id }, select: { id: true, status: true } });
  if (!existing) return fail("po_not_found", 404, "purchase order not found");
  const status = existing.status as PoStatus;
  if (!canEditPoHeader(status)) return fail("po_not_editable", 409, `a ${status} purchase order cannot be edited`);
  if (p.lines !== undefined && !canEditPoLines(status)) {
    return fail("po_lines_locked", 409, "lines can only be changed while the purchase order is a draft");
  }
  if (p.supplierId) {
    const s = await prisma.supplier.findFirst({ where: { id: p.supplierId }, select: { id: true } });
    if (!s) return fail("supplier_not_found", 404, "supplier not found");
  }
  let built: LineData[] | null = null;
  if (p.lines !== undefined) {
    const r = await buildLineData(p.lines);
    if (!r.ok) return r;
    built = r.data;
  }

  const data: Record<string, unknown> = {};
  if (p.supplierId !== undefined) data.supplierId = p.supplierId ?? null;
  if (p.branchId !== undefined) data.branchId = p.branchId ?? null;
  if (p.currency !== undefined && p.currency.trim()) data.currency = p.currency.trim();
  if (p.notes !== undefined) data.notes = p.notes ?? null;
  if (p.expectedAt !== undefined) data.expectedAt = p.expectedAt ?? null;

  const po = await prisma.$transaction(async (tx) => {
    if (built !== null) {
      await tx.purchaseOrderLine.deleteMany({ where: { purchaseOrderId: p.id } });
      if (built.length > 0) {
        await tx.purchaseOrderLine.createMany({
          data: built.map((l) => ({ ...l, purchaseOrderId: p.id })),
        });
      }
    }
    await tx.purchaseOrder.update({ where: { id: p.id }, data });
    return tx.purchaseOrder.findFirst({ where: { id: p.id }, include: PO_INCLUDE });
  });
  await writeAudit({
    action: "inventory.po.update",
    actor: p.actor,
    entityType: "PurchaseOrder",
    entityId: p.id,
    summary: `Updated purchase order ${po?.code ?? p.id}`,
    metadata: { fields: Object.keys(data), linesReplaced: built !== null },
    ip: p.ip ?? null,
  });
  return ok({ purchaseOrder: po ? serializePo(po) : null });
}

/** Submit a draft to the supplier (requires >= 1 line); stamps orderedAt. */
export async function submitPo(p: { id: string; actor: Actor; ip?: string | null }): Promise<OpResult<Record<string, unknown>>> {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: p.id },
    select: { id: true, code: true, status: true, _count: { select: { lines: true } } },
  });
  if (!po) return fail("po_not_found", 404, "purchase order not found");
  const status = po.status as PoStatus;
  if (!canSubmitPo(status)) return fail("po_not_submittable", 409, `a ${status} purchase order cannot be submitted`);
  if (po._count.lines === 0) return fail("po_empty", 400, "add at least one line before submitting");
  const updated = await prisma.purchaseOrder.update({
    where: { id: p.id },
    data: { status: "submitted", orderedAt: new Date() },
    include: PO_INCLUDE,
  });
  await writeAudit({
    action: "inventory.po.submit",
    actor: p.actor,
    entityType: "PurchaseOrder",
    entityId: p.id,
    summary: `Submitted purchase order ${po.code}`,
    metadata: { code: po.code },
    ip: p.ip ?? null,
  });
  return ok({ purchaseOrder: serializePo(updated) });
}

/** Cancel a PO (draft / submitted / partially received). Received stock is kept. */
export async function cancelPo(p: { id: string; actor: Actor; ip?: string | null }): Promise<OpResult<Record<string, unknown>>> {
  const po = await prisma.purchaseOrder.findFirst({ where: { id: p.id }, select: { id: true, code: true, status: true } });
  if (!po) return fail("po_not_found", 404, "purchase order not found");
  const status = po.status as PoStatus;
  if (!canCancelPo(status)) return fail("po_not_cancellable", 409, `a ${status} purchase order cannot be cancelled`);
  const updated = await prisma.purchaseOrder.update({
    where: { id: p.id },
    data: { status: "cancelled" },
    include: PO_INCLUDE,
  });
  await writeAudit({
    action: "inventory.po.cancel",
    actor: p.actor,
    entityType: "PurchaseOrder",
    entityId: p.id,
    summary: `Cancelled purchase order ${po.code}`,
    metadata: { code: po.code, previousStatus: status },
    ip: p.ip ?? null,
  });
  return ok({ purchaseOrder: serializePo(updated) });
}

type ReceiptInput = {
  lineId: string;
  quantity: number;
  lotNumber?: string | null;
  expiryDate?: Date | null;
  unitCost?: number | null;
};

/**
 * Receive one or more lines of a submitted / partially-received PO. Validates
 * everything up front (lines belong to the PO, item still exists, quantity > 0,
 * and no line — even across repeats in the same payload — exceeds what it
 * ordered), then in ONE transaction: posts each receipt via {@link postReceipt}
 * (batch + `receipt` movement tagged referenceType="PurchaseOrder"), increments
 * each line's receivedQty, and recomputes the header status (→ partially_received
 * or received). One audit row is written after the transaction commits.
 */
export async function receivePoLines(p: {
  id: string;
  receipts: ReceiptInput[];
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<Record<string, unknown>>> {
  if (p.receipts.length === 0) return fail("no_receipts", 400, "no receipt lines were provided");
  const po = await prisma.purchaseOrder.findFirst({ where: { id: p.id }, include: { lines: true } });
  if (!po) return fail("po_not_found", 404, "purchase order not found");
  const status = po.status as PoStatus;
  if (!canReceivePo(status)) return fail("po_not_receivable", 409, `a ${status} purchase order cannot receive stock`);

  const lineById = new Map(po.lines.map((l) => [l.id, l]));
  const plannedByLine = new Map<string, number>();
  const planned: Array<{
    lineId: string;
    itemId: string;
    qty: number;
    cost: number;
    lotNumber: string | null;
    expiryDate: Date | null;
  }> = [];

  for (const r of p.receipts) {
    const line = lineById.get(r.lineId);
    if (!line) return fail("line_not_found", 404, `line ${r.lineId} does not belong to this purchase order`, { lineId: r.lineId });
    if (line.itemId == null) return fail("line_item_missing", 409, "the item for a line was deleted; it can no longer be received", { lineId: r.lineId });
    const qty = round3(Number(r.quantity));
    if (!(qty > 0)) return fail("invalid_quantity", 400, "quantity must be greater than 0", { lineId: r.lineId });
    const ordered = num(line.orderedQty);
    const already = num(line.receivedQty);
    const prevPlanned = plannedByLine.get(line.id) ?? 0;
    if (round3(already + prevPlanned + qty) > ordered) {
      return fail("over_receipt", 400, "cannot receive more than was ordered on a line", {
        lineId: line.id,
        ordered,
        alreadyReceived: already,
        requested: round3(prevPlanned + qty),
        remaining: round3(Math.max(0, ordered - already - prevPlanned)),
      });
    }
    const cost = r.unitCost != null ? round2(Number(r.unitCost)) : num(line.unitCost);
    if (cost < 0) return fail("invalid_cost", 400, "unit cost must be >= 0", { lineId: r.lineId });
    plannedByLine.set(line.id, round3(prevPlanned + qty));
    planned.push({ lineId: line.id, itemId: line.itemId, qty, cost, lotNumber: r.lotNumber ?? null, expiryDate: r.expiryDate ?? null });
  }

  const updated = await prisma.$transaction(async (tx) => {
    for (const pr of planned) {
      await postReceipt(tx, {
        itemId: pr.itemId,
        supplierId: po.supplierId,
        lotNumber: pr.lotNumber,
        expiryDate: pr.expiryDate,
        unitCost: pr.cost,
        quantity: pr.qty,
        branchId: po.branchId,
        notes: `PO ${po.code}`,
        actor: p.actor,
        referenceType: "PurchaseOrder",
        referenceId: po.id,
      });
      await tx.purchaseOrderLine.update({
        where: { id: pr.lineId },
        data: { receivedQty: { increment: pr.qty } },
      });
    }
    const fresh = await tx.purchaseOrderLine.findMany({
      where: { purchaseOrderId: po.id },
      select: { orderedQty: true, receivedQty: true },
    });
    const nextStatus = computePoStatus(
      fresh.map((l) => ({ orderedQty: num(l.orderedQty), receivedQty: num(l.receivedQty) })),
      { fallback: "partially_received" },
    );
    return tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: nextStatus, receivedAt: nextStatus === "received" ? new Date() : (po.receivedAt ?? null) },
      include: PO_INCLUDE,
    });
  });
  await writeAudit({
    action: "inventory.po.receive",
    actor: p.actor,
    entityType: "PurchaseOrder",
    entityId: po.id,
    summary: `Received ${planned.length} line(s) on ${po.code}`,
    metadata: {
      code: po.code,
      status: updated.status,
      receipts: planned.map((pr) => ({ lineId: pr.lineId, itemId: pr.itemId, quantity: pr.qty, unitCost: pr.cost })),
    },
    ip: p.ip ?? null,
  });
  return ok({ purchaseOrder: serializePo(updated) });
}
