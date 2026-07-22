/**
 * Clinic expenses (rent, electricity, custom) that reduce the clinic's net
 * profit on the Revenue page. Each expense stores a default recurring monthly
 * `amount`; a specific month can be overridden via ClinicExpenseOverride
 * (keyed by "YYYY-MM"). The effective amount for a month is the override when
 * present, otherwise the recurring amount.
 */
import { prisma } from "@/lib/db";
import { num } from "@/lib/server/money";

export type ExpenseKind = "rent" | "electricity" | "custom";

export function normalizeExpenseKind(k: unknown): ExpenseKind {
  return k === "rent" || k === "electricity" ? k : "custom";
}

export type EffectiveExpense = {
  id: string;
  labelEn: string;
  labelAr: string;
  kind: string;
  amount: number; // recurring default
  effective: number; // amount used for the requested month (override or default)
  overridden: boolean;
  active: boolean;
  sortOrder: number;
};

/**
 * Active expenses with the amount that applies to `monthKey` resolved from any
 * override, plus the month total. Used by the Revenue page and Settings.
 */
export async function expensesForMonth(monthKey: string): Promise<{
  expenses: EffectiveExpense[];
  total: number;
}> {
  const rows = await prisma.clinicExpense.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { overrides: { where: { monthKey } } },
  });
  const expenses: EffectiveExpense[] = rows.map((e) => {
    const ov = e.overrides[0];
    const effective = ov ? num(ov.amount) : num(e.amount);
    return {
      id: e.id,
      labelEn: e.labelEn,
      labelAr: e.labelAr,
      kind: e.kind,
      amount: num(e.amount),
      effective,
      overridden: !!ov,
      active: e.active,
      sortOrder: e.sortOrder,
    };
  });
  const total = Math.round(expenses.reduce((s, e) => s + (e.effective || 0), 0) * 100) / 100;
  return { expenses, total };
}
