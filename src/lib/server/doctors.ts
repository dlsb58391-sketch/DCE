/**
 * Doctors + commission accounting.
 *
 * Commission model (confirmed with the clinic owner):
 *   - Every doctor has a default commission percentage on their profile.
 *   - Commission is a percentage of the PATIENT/CHARGED price (TreatmentRecord.price,
 *     i.e. after any discount) — NOT of the profit.
 *   - One operation can have several doctors. Each doctor's percent can be the
 *     profile default or a custom value set at record time. The clinic keeps the
 *     remainder: clinicShare = price − Σ(doctor amounts).
 *   - Amounts + percents are SNAPSHOT on the TreatmentDoctor join row so editing a
 *     doctor's profile later never rewrites past earnings.
 */

export type DoctorAssignmentInput = { doctorId: string; commissionPct: number };
export type DoctorShare = { doctorId: string; commissionPct: number; amount: number };

/** Round to 2 decimals (EGP). */
export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** Clamp a percentage to [0, 100] with 2-decimal precision. */
export function clampPct(n: unknown): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v >= 100 ? 100 : Math.round(v * 100) / 100;
}

/**
 * Split a charged price across the assigned doctors and the clinic.
 * Each doctor's amount = round(price × pct/100). The clinic keeps whatever is
 * left after the doctors (computed by subtraction so doctor + clinic == price
 * exactly, avoiding rounding drift).
 */
export function computeShares(
  price: number,
  assignments: DoctorAssignmentInput[]
): {
  shares: DoctorShare[];
  doctorsTotalPct: number;
  clinicPct: number;
  doctorsAmount: number;
  clinicShare: number;
} {
  const p = Math.max(0, round2(price));
  let doctorsTotalPct = 0;
  const shares: DoctorShare[] = assignments.map((a) => {
    const pct = clampPct(a.commissionPct);
    doctorsTotalPct += pct;
    return { doctorId: a.doctorId, commissionPct: pct, amount: round2(p * (pct / 100)) };
  });
  const doctorsAmount = round2(shares.reduce((s, x) => s + x.amount, 0));
  const clinicShare = round2(p - doctorsAmount);
  const clinicPct = round2(Math.max(0, 100 - doctorsTotalPct));
  return { shares, doctorsTotalPct: round2(doctorsTotalPct), clinicPct, doctorsAmount, clinicShare };
}

/** "YYYY-MM" key for a date (local clinic time). */
export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Start/end Date bounds for a "YYYY-MM" month key (end is exclusive). */
export function monthBounds(monthKey: string): { start: Date; end: Date } {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(y, (m || 1) - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m || 1, 1, 0, 0, 0, 0);
  return { start, end };
}

/** Whether a "YYYY-MM" string is well-formed. */
export function isValidMonthKey(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
}
