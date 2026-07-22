import { prisma } from "@/lib/db";

/** Last 9 digits of a phone — a stable key that ignores country-code formatting. */
export const phoneTail = (p: string) => (p || "").replace(/\D/g, "").slice(-9);

/** A name is "real" if it has at least 2 letters (not just digits/punctuation). */
const isReal = (s: string) => (s || "").trim().replace(/[^\p{L}]/gu, "").length >= 2;

/**
 * Build a phone→display-name map from patients + appointments (best name wins).
 * Keyed by the trailing 9 digits so different formats of the same number match.
 */
export async function nameByPhone(): Promise<Map<string, string>> {
  const [appts, patients] = await Promise.all([
    prisma.appointment.findMany({ orderBy: { createdAt: "desc" }, select: { phone: true, patientName: true } }),
    prisma.patient.findMany({ select: { phone: true, name: true } }),
  ]);
  const map = new Map<string, string>();
  for (const p of patients) {
    const t = phoneTail(p.phone);
    if (t.length >= 8 && isReal(p.name) && !map.has(t)) map.set(t, p.name.trim());
  }
  for (const a of appts) {
    const t = phoneTail(a.phone);
    if (t.length >= 8 && isReal(a.patientName) && !map.has(t)) map.set(t, a.patientName.trim());
  }
  return map;
}
