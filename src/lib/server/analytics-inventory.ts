/**
 * Inventory analytics — pure, database-free helpers.
 *
 * Consumption/wastage roll-ups for the Analytics dashboard live here so the math
 * is unit-tested without a database (see tests/unit/analytics-inventory.test.mjs).
 * The API route fetches StockMovement rows (Decimal -> number at the boundary) and
 * calls these functions. Read-only: nothing here mutates stock or the ledger.
 *
 * Value convention: a movement's monetary value is its snapshot `totalCost` when
 * present (|quantityDelta| x unitCost captured at posting time), else recomputed
 * from |quantityDelta| x unitCost. Always non-negative.
 */
import { round2, round3 } from "@/lib/server/inventory";

export type ConsumptionMovementLike = {
  itemId: string;
  type: string;
  quantityDelta: number;
  unitCost?: number | null;
  totalCost?: number | null;
  item?: { nameEn: string; nameAr: string; unit: string } | null;
};

export type ConsumedItemRow = {
  itemId: string;
  nameEn: string;
  nameAr: string;
  unit: string;
  qty: number;
  value: number;
};

export type ConsumptionSummary = {
  consumptionValue: number;
  consumptionQty: number;
  wastageValue: number;
  wastageQty: number;
  topConsumed: ConsumedItemRow[];
  topWasted: ConsumedItemRow[];
};

/** Analytics time windows (mirror the dashboard's range selector). */
export type Range = "30d" | "90d" | "12m" | "all";

/**
 * Start of a range relative to `now`, or null for "all" (no lower bound).
 * 30d/90d subtract days; 12m subtracts 12 calendar months.
 */
export function rangeStart(range: Range, now: Date = new Date()): Date | null {
  if (range === "30d") return new Date(now.getTime() - 30 * 86400000);
  if (range === "90d") return new Date(now.getTime() - 90 * 86400000);
  if (range === "12m") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 12);
    return d;
  }
  return null; // all
}

const RANGES: readonly Range[] = ["30d", "90d", "12m", "all"];

/** Narrow an untrusted query value to a valid Range (default 12m). */
export function normalizeRange(v: unknown): Range {
  return typeof v === "string" && (RANGES as readonly string[]).includes(v) ? (v as Range) : "12m";
}

/** Non-negative monetary value of one consumption/wastage movement. */
export function movementValue(m: Pick<ConsumptionMovementLike, "quantityDelta" | "unitCost" | "totalCost">): number {
  const tc = m.totalCost == null ? null : Number(m.totalCost);
  if (tc != null && Number.isFinite(tc)) return round2(Math.abs(tc));
  const qty = Math.abs(Number(m.quantityDelta) || 0);
  const uc = Number(m.unitCost) || 0;
  return round2(qty * uc);
}

function accumulate(map: Map<string, ConsumedItemRow>, m: ConsumptionMovementLike, qty: number, value: number): void {
  const row =
    map.get(m.itemId) ??
    {
      itemId: m.itemId,
      nameEn: m.item?.nameEn ?? "",
      nameAr: m.item?.nameAr ?? "",
      unit: m.item?.unit ?? "",
      qty: 0,
      value: 0,
    };
  row.qty += qty;
  row.value += value;
  map.set(m.itemId, row);
}

function topList(map: Map<string, ConsumedItemRow>, topN: number): ConsumedItemRow[] {
  return [...map.values()]
    .map((r) => ({ ...r, qty: round3(r.qty), value: round2(r.value) }))
    .sort((a, b) => b.value - a.value || b.qty - a.qty || a.nameEn.localeCompare(b.nameEn))
    .slice(0, topN);
}

/**
 * Fold consumption and wastage movements into totals plus per-item top lists
 * (by value). Non-consumption/wastage rows are ignored. Pure — the caller filters
 * by time range before calling. `topN` caps each returned list (default 6).
 */
export function summarizeConsumption(
  movements: ReadonlyArray<ConsumptionMovementLike>,
  topN = 6,
): ConsumptionSummary {
  let consumptionValue = 0;
  let consumptionQty = 0;
  let wastageValue = 0;
  let wastageQty = 0;
  const consumed = new Map<string, ConsumedItemRow>();
  const wasted = new Map<string, ConsumedItemRow>();

  for (const m of movements) {
    const qty = Math.abs(Number(m.quantityDelta) || 0);
    const value = movementValue(m);
    if (m.type === "consumption") {
      consumptionValue += value;
      consumptionQty += qty;
      accumulate(consumed, m, qty, value);
    } else if (m.type === "wastage") {
      wastageValue += value;
      wastageQty += qty;
      accumulate(wasted, m, qty, value);
    }
  }

  return {
    consumptionValue: round2(consumptionValue),
    consumptionQty: round3(consumptionQty),
    wastageValue: round2(wastageValue),
    wastageQty: round3(wastageQty),
    topConsumed: topList(consumed, topN),
    topWasted: topList(wasted, topN),
  };
}
