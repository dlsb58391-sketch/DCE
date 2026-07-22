/**
 * Inventory domain — pure, database-free helpers.
 *
 * All stock math lives here so it can be exhaustively unit-tested without a
 * database (see tests/unit/inventory.test.mjs). The DB/transaction layer
 * (inventory-ops.ts) and the API routes convert Prisma `Decimal` values to plain
 * numbers (via money.ts `num`) at the boundary and then call these functions.
 *
 * Model recap:
 *   - On-hand for an item = Σ InventoryBatch.remainingQty (never a stored field).
 *   - Valuation = Σ remainingQty × unitCost per live batch.
 *   - Consumption/wastage draw down batches FEFO (First-Expiry-First-Out).
 *   - StockMovement.quantityDelta is signed (+in / −out).
 */

/** The complete set of stock-movement types recorded in the ledger. */
export const MOVEMENT_TYPES = [
  "receipt", // goods received into stock (+)
  "consumption", // used up during operations / manual issue (−)
  "wastage", // expired / damaged / lost (−)
  "adjustment", // manual correction of a specific lot (± signed)
  "transfer_in", // received from another branch (+) — reserved for multi-branch
  "transfer_out", // sent to another branch (−) — reserved for multi-branch
  "return", // returned to supplier (−)
] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number];

/** Movement types that increase on-hand. */
export const INCREASE_TYPES: ReadonlySet<MovementType> = new Set(["receipt", "transfer_in"]);
/** Movement types that decrease on-hand. */
export const DECREASE_TYPES: ReadonlySet<MovementType> = new Set([
  "consumption",
  "wastage",
  "transfer_out",
  "return",
]);

/** Suggested units for the UI dropdown (free-text is still allowed). */
export const SUGGESTED_UNITS = [
  "piece",
  "box",
  "pack",
  "bottle",
  "tube",
  "vial",
  "ml",
  "g",
  "kit",
  "set",
  "pair",
] as const;

export function isMovementType(v: unknown): v is MovementType {
  return typeof v === "string" && (MOVEMENT_TYPES as readonly string[]).includes(v);
}

/**
 * The sign a movement type applies to on-hand: +1 (increase), −1 (decrease), or
 * `null` for `adjustment`, whose sign is supplied by the caller (a signed delta).
 */
export function signForType(type: MovementType): 1 | -1 | null {
  if (INCREASE_TYPES.has(type)) return 1;
  if (DECREASE_TYPES.has(type)) return -1;
  return null; // adjustment
}

/** Round a quantity to 3 decimals (matches Decimal(12,3)); avoids float drift. */
export function round3(n: number): number {
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

/** Round money to 2 decimals (matches Decimal(12,2)). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Batch aggregates
// ---------------------------------------------------------------------------

export type BatchLike = {
  id: string;
  remainingQty: number;
  unitCost: number;
  expiryDate?: Date | string | null;
  receivedAt?: Date | string | null;
};

/** Sum of remaining quantity across batches (on-hand). Rounded to 3 dp. */
export function onHand(batches: ReadonlyArray<Pick<BatchLike, "remainingQty">>): number {
  return round3(batches.reduce((sum, b) => sum + (Number(b.remainingQty) || 0), 0));
}

/** Inventory valuation = Σ remainingQty × unitCost. Rounded to 2 dp (EGP). */
export function valuation(batches: ReadonlyArray<Pick<BatchLike, "remainingQty" | "unitCost">>): number {
  return round2(
    batches.reduce((sum, b) => sum + (Number(b.remainingQty) || 0) * (Number(b.unitCost) || 0), 0),
  );
}

/**
 * Low-stock test: true when a reorder level is set (> 0) and on-hand has fallen
 * to or below it. Items with no reorder level (0) are never flagged.
 */
export function isLowStock(onHandQty: number, reorderLevel: number): boolean {
  return reorderLevel > 0 && onHandQty <= reorderLevel;
}

/**
 * Suggested quantity to order for an item, netting out stock already on order.
 *
 * Returns 0 when no reorder level is set, or when on-hand plus what is already
 * on open purchase orders keeps the item above its reorder level (never
 * double-order what a submitted PO will deliver). Otherwise, when the item has a
 * configured `reorderQty` batch size, that value is suggested; when it does not,
 * the suggestion is the shortfall needed to climb back to the reorder level.
 * Pure — the caller supplies on-hand and on-order from the DB. Rounded to 3 dp.
 */
export function suggestedOrderQty(
  onHandQty: number,
  onOrderQty: number,
  reorderLevel: number,
  reorderQty: number | null | undefined,
): number {
  if (!(reorderLevel > 0)) return 0;
  const covered = round3((Number(onHandQty) || 0) + Math.max(0, Number(onOrderQty) || 0));
  if (covered > reorderLevel) return 0;
  const rq = Number(reorderQty);
  if (Number.isFinite(rq) && rq > 0) return round3(rq);
  return round3(Math.max(0, reorderLevel - covered));
}

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

/** Parse a date-like to epoch ms, or null if absent/invalid. */
export function toTime(v: Date | string | null | undefined): number | null {
  if (v == null) return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

/** True when a batch has an expiry date in the past (as of `asOf`). */
export function isExpired(expiryDate: Date | string | null | undefined, asOf: Date = new Date()): boolean {
  const t = toTime(expiryDate);
  return t != null && t < asOf.getTime();
}

/** True when a batch expires within the next `days` days (and is not already expired). */
export function isExpiringSoon(
  expiryDate: Date | string | null | undefined,
  days: number,
  asOf: Date = new Date(),
): boolean {
  const t = toTime(expiryDate);
  if (t == null) return false;
  const now = asOf.getTime();
  const horizon = now + days * 24 * 60 * 60 * 1000;
  return t >= now && t <= horizon;
}

// ---------------------------------------------------------------------------
// FEFO allocation
// ---------------------------------------------------------------------------

/**
 * Order batches First-Expiry-First-Out: soonest expiry first, undated lots last,
 * ties broken by earliest received, then id (stable/deterministic). Pure — does
 * not mutate the input array.
 */
export function fefoOrder<T extends BatchLike>(batches: ReadonlyArray<T>): T[] {
  return [...batches].sort((a, b) => {
    const ea = toTime(a.expiryDate);
    const eb = toTime(b.expiryDate);
    if (ea !== eb) {
      if (ea == null) return 1; // undated after dated
      if (eb == null) return -1;
      return ea - eb;
    }
    const ra = toTime(a.receivedAt) ?? 0;
    const rb = toTime(b.receivedAt) ?? 0;
    if (ra !== rb) return ra - rb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export type Allocation = { batchId: string; qty: number };
export type AllocationResult = {
  /** Per-batch draw-down plan (only batches actually touched, qty > 0). */
  allocations: Allocation[];
  /** Quantity that could NOT be satisfied from available stock (0 when fully met). */
  shortfall: number;
};

/**
 * Plan how to remove `qtyNeeded` units from the given batches, consuming in FEFO
 * order and never taking more than a batch's remaining quantity. Returns the
 * allocation plan plus any shortfall (when total on-hand < qtyNeeded). Pure — it
 * computes the plan only; the caller applies it in a transaction.
 */
export function allocateFefo(batches: ReadonlyArray<BatchLike>, qtyNeeded: number): AllocationResult {
  let need = round3(Math.max(0, qtyNeeded));
  const allocations: Allocation[] = [];
  for (const b of fefoOrder(batches)) {
    if (need <= 0) break;
    const avail = round3(Math.max(0, Number(b.remainingQty) || 0));
    if (avail <= 0) continue;
    const take = round3(Math.min(avail, need));
    if (take > 0) {
      allocations.push({ batchId: b.id, qty: take });
      need = round3(need - take);
    }
  }
  return { allocations, shortfall: round3(Math.max(0, need)) };
}
