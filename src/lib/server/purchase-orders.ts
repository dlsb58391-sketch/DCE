/**
 * Purchase Orders domain — pure, database-free helpers.
 *
 * All PO status/value math lives here so it can be exhaustively unit-tested
 * without a database (see tests/unit/purchase-orders.test.mjs). The DB layer
 * (purchase-orders-ops.ts) and the API routes convert Prisma `Decimal` values to
 * plain numbers at the boundary and then call these functions.
 *
 * Lifecycle:
 *   draft ──submit──▶ submitted ──receive──▶ partially_received ──receive──▶ received
 *     │                   │                        │
 *     └───────── cancel ──┴──────── cancel ────────┘   (cancel never reverses
 *                                                        already-received stock)
 *
 * Money is Decimal(12,2); quantities are Decimal(12,3).
 */

import { round2, round3 } from "./inventory";

/** All purchase-order lifecycle statuses. */
export const PO_STATUSES = [
  "draft", // being composed; fully editable; no supplier commitment yet
  "submitted", // sent to the supplier; header still editable, lines locked
  "partially_received", // some — but not all — lines received into stock
  "received", // every line fully received
  "cancelled", // abandoned; received stock (if any) is retained
] as const;

export type PoStatus = (typeof PO_STATUSES)[number];

export function isPoStatus(v: unknown): v is PoStatus {
  return typeof v === "string" && (PO_STATUSES as readonly string[]).includes(v);
}

// ---------------------------------------------------------------------------
// Allowed transitions (pure guards; the service enforces them before writing)
// ---------------------------------------------------------------------------

/** Lines (items/quantities/costs) may only change while the PO is a draft. */
export function canEditPoLines(status: PoStatus): boolean {
  return status === "draft";
}

/** Header fields (supplier, notes, dates) may change in draft or submitted. */
export function canEditPoHeader(status: PoStatus): boolean {
  return status === "draft" || status === "submitted";
}

/** A PO can be submitted to the supplier only from draft. */
export function canSubmitPo(status: PoStatus): boolean {
  return status === "draft";
}

/**
 * A PO can be cancelled from draft, submitted, or partially_received. Cancelling
 * never reverses stock already received — it only stops expecting the remainder.
 */
export function canCancelPo(status: PoStatus): boolean {
  return status === "draft" || status === "submitted" || status === "partially_received";
}

/** Goods can be received only once a PO is submitted or partially received. */
export function canReceivePo(status: PoStatus): boolean {
  return status === "submitted" || status === "partially_received";
}

// ---------------------------------------------------------------------------
// Line + status math
// ---------------------------------------------------------------------------

export type PoLineLike = {
  orderedQty: number;
  receivedQty: number;
  unitCost?: number;
};

/** Quantity still outstanding on a line: max(0, ordered − received), 3 dp. */
export function poLineRemaining(line: Pick<PoLineLike, "orderedQty" | "receivedQty">): number {
  return round3(Math.max(0, (Number(line.orderedQty) || 0) - (Number(line.receivedQty) || 0)));
}

/** True when every unit ordered on the line has been received (line is closed). */
export function isPoLineFullyReceived(line: Pick<PoLineLike, "orderedQty" | "receivedQty">): boolean {
  const ordered = Number(line.orderedQty) || 0;
  return ordered > 0 && (Number(line.receivedQty) || 0) >= ordered;
}

/**
 * Derive the receiving status from the current lines.
 *   • no lines            → `fallback` (defaults to "submitted")
 *   • all lines closed    → "received"
 *   • some qty received   → "partially_received"
 *   • nothing received    → `fallback`
 * A `cancelled` flag short-circuits to "cancelled". Pure — the service persists
 * the result and stamps receivedAt when it returns "received".
 */
export function computePoStatus(
  lines: ReadonlyArray<Pick<PoLineLike, "orderedQty" | "receivedQty">>,
  opts?: { cancelled?: boolean; fallback?: PoStatus },
): PoStatus {
  if (opts?.cancelled) return "cancelled";
  const fallback = opts?.fallback ?? "submitted";
  if (lines.length === 0) return fallback;
  const anyReceived = lines.some((l) => (Number(l.receivedQty) || 0) > 0);
  const allReceived = lines.every((l) => isPoLineFullyReceived(l));
  if (allReceived) return "received";
  if (anyReceived) return "partially_received";
  return fallback;
}

// ---------------------------------------------------------------------------
// Valuation
// ---------------------------------------------------------------------------

/** Ordered value = Σ orderedQty × unitCost. Rounded to 2 dp (money). */
export function poOrderedValue(lines: ReadonlyArray<PoLineLike>): number {
  return round2(
    lines.reduce((sum, l) => sum + (Number(l.orderedQty) || 0) * (Number(l.unitCost) || 0), 0),
  );
}

/** Received value = Σ receivedQty × unitCost. Rounded to 2 dp (money). */
export function poReceivedValue(lines: ReadonlyArray<PoLineLike>): number {
  return round2(
    lines.reduce((sum, l) => sum + (Number(l.receivedQty) || 0) * (Number(l.unitCost) || 0), 0),
  );
}

/** Outstanding value = Σ remaining × unitCost. Rounded to 2 dp (money). */
export function poRemainingValue(lines: ReadonlyArray<PoLineLike>): number {
  return round2(lines.reduce((sum, l) => sum + poLineRemaining(l) * (Number(l.unitCost) || 0), 0));
}
