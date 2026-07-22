/**
 * Doctor earnings dashboard aggregation helpers.
 *
 * Earnings model recap (see server/doctors.ts):
 *   - A doctor earns TreatmentDoctor.amount per operation (snapshot commission).
 *   - Payouts (DoctorPayout) draw those earnings down.
 *   - Outstanding balance (pending) = Σ(earnings) − Σ(payouts), floored at 0.
 *
 * Money attribution:
 *   - Clinic-level totals count each treatment ONCE (no double counting when an
 *     operation is shared by multiple doctors).
 *   - Per-doctor "revenue generated" counts the full operation price for every
 *     operation the doctor took part in (can overlap across doctors — it's a
 *     per-doctor view, documented via tooltips in the UI).
 */
import { prisma } from "@/lib/db";
import { expensesForMonth } from "@/lib/server/expenses";
import { monthBounds, monthKeyOf, round2 } from "@/lib/server/doctors";

export type SettleStatus = "paid" | "partial" | "pending" | "none";

/** Settlement status from a paid amount against a total owed. */
export function settleStatus(paid: number, total: number): SettleStatus {
  if (total <= 0) return "none";
  if (paid <= 0) return "pending";
  if (paid + 0.001 >= total) return "paid";
  return "partial";
}

/** Sum the clinic's effective monthly expenses across every month in [start, end). */
export async function expensesBetween(start: Date, end: Date, capMonths = 36): Promise<number> {
  const keys: string[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const stop = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cur <= stop && keys.length < capMonths) {
    keys.push(monthKeyOf(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  let total = 0;
  for (const k of keys) {
    const { total: t } = await expensesForMonth(k);
    total += t;
  }
  return round2(total);
}

/** The 12 month keys ending at (and including) the current month, oldest first. */
export function last12MonthKeys(now = new Date()): string[] {
  const out: string[] = [];
  for (let i = 11; i >= 0; i--) {
    out.push(monthKeyOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  return out;
}

/** The month keys of a calendar year, oldest first. */
export function monthKeysForYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

export { monthBounds, monthKeyOf, round2 };
