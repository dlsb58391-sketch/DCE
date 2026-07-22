/**
 * Operations (procedures) catalog + patient treatment/payment helpers.
 *
 * Money model:
 *   - Procedure: the clinic's catalog of operations, each with a default price.
 *   - TreatmentRecord: an operation actually performed for a patient (price is a
 *     snapshot of what was charged).
 *   - Payment: money received (may be tied to a treatment or general).
 *   - Balance for a patient = Σ treatment.price − Σ payment.amount.
 */
import { prisma } from "@/lib/db";
import { sessionTypes } from "@/lib/dashboard";
import { num, type DecimalLike } from "@/lib/server/money";

export type PaymentMethod = "cash" | "card" | "insurance" | "transfer";

export function normalizeMethod(m: unknown): PaymentMethod {
  return m === "card" || m === "insurance" || m === "transfer" ? m : "cash";
}

/**
 * Ensure the catalog has entries. On first use we seed it from the built-in
 * session types (كشف، خلع، تركيب…) so the doctor starts with sensible defaults
 * and can edit/add from there. Idempotent — only seeds when the table is empty.
 */
export async function ensureProceduresSeeded(): Promise<void> {
  const count = await prisma.procedure.count();
  if (count > 0) return;
  await prisma.procedure.createMany({
    data: sessionTypes.map((s, i) => ({
      nameEn: s.label.en,
      nameAr: s.label.ar,
      price: s.price,
      active: true,
      sortOrder: i,
    })),
  });
}

/** Per-patient money totals from their treatments + payments. */
export function computeTotals(
  treatments: { price: DecimalLike }[],
  payments: { amount: DecimalLike }[]
): { billed: number; paid: number; balance: number } {
  const billed = treatments.reduce((s, t) => s + num(t.price), 0);
  const paid = payments.reduce((s, p) => s + num(p.amount), 0);
  return { billed, paid, balance: billed - paid };
}
