import { Prisma } from "@prisma/client";

/**
 * Money helpers for the Decimal migration (Sprint 2, DB-01).
 *
 * All monetary columns are stored as SQL NUMERIC(12,2) and surface through the
 * Prisma client as `Prisma.Decimal` (an object, NOT a JS number). Doing math on
 * a Decimal (`d + 1`) throws/NaNs, and returning one in JSON serializes it to a
 * string (`"1500.00"`). To keep the API contract numeric and arithmetic correct,
 * convert at every boundary with these helpers.
 */

export type DecimalLike = Prisma.Decimal | number | string | null | undefined;

/** Decimal | number | string | null → number for arithmetic. null/undefined → 0. */
export function num(v: DecimalLike): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return v.toNumber();
}

/** Serialization helper for nullable money fields: preserves null, else → number. */
export function numOrNull(v: DecimalLike): number | null {
  return v == null ? null : num(v);
}

/** Serialize a Procedure row for JSON: Decimal money → number (cost preserves null). */
export function serializeProcedure<T extends { price: DecimalLike; cost: DecimalLike }>(
  p: T
): Omit<T, "price" | "cost"> & { price: number; cost: number | null } {
  return { ...p, price: num(p.price), cost: numOrNull(p.cost) };
}

/** Serialize a Doctor row for JSON: Decimal commissionPct → number. */
export function serializeDoctor<T extends { commissionPct: DecimalLike }>(
  d: T
): Omit<T, "commissionPct"> & { commissionPct: number } {
  return { ...d, commissionPct: num(d.commissionPct) };
}
