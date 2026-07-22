import type { Lang } from "./content";
import type { Bilingual } from "./dashboard";

export type SessionStatus = "completed" | "scheduled" | "cancelled";
export type PaymentMethod = "cash" | "card" | "insurance" | "transfer";

export type PatientSession = {
  id: string;
  typeId: string; // links to sessionTypes
  date: string; // YYYY-MM-DD
  cost: number; // EGP
  status: SessionStatus;
  notes?: string;
};

export type Payment = {
  id: string;
  amount: number; // EGP
  date: string; // YYYY-MM-DD
  method: PaymentMethod;
  note?: string;
};

export type Patient = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  gender?: "male" | "female";
  source: "manual" | "booking";
  createdAt: string; // YYYY-MM-DD
  notes?: string;
  medical?: MedicalHistory;
  sessions: PatientSession[];
  payments: Payment[];
};

export type MedicalHistory = {
  bloodType?: string;
  allergies?: string; // e.g. penicillin, latex
  conditions?: string; // chronic conditions: diabetes, hypertension…
  medications?: string; // current medications
  notes?: string; // free-form medical notes
};

/* ---------------- Labels ---------------- */
export const sessionStatusLabel: Record<SessionStatus, Bilingual> = {
  completed: { en: "Completed", ar: "مكتملة" },
  scheduled: { en: "Scheduled", ar: "مجدولة" },
  cancelled: { en: "Cancelled", ar: "ملغاة" },
};

export const sessionStatusStyle: Record<SessionStatus, string> = {
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25",
  scheduled: "bg-amber-500/10 text-amber-700 border-amber-500/25",
  cancelled: "bg-rose-500/10 text-rose-600 border-rose-500/25",
};

export const paymentMethodLabel: Record<PaymentMethod, Bilingual> = {
  cash: { en: "Cash", ar: "نقدًا" },
  card: { en: "Card", ar: "بطاقة" },
  insurance: { en: "Insurance", ar: "تأمين" },
  transfer: { en: "Bank Transfer", ar: "تحويل بنكي" },
};

/* ---------------- Financial helpers ---------------- */
export function totalBilled(p: Patient): number {
  return p.sessions
    .filter((s) => s.status !== "cancelled")
    .reduce((sum, s) => sum + s.cost, 0);
}

export function totalPaid(p: Patient): number {
  return p.payments.reduce((sum, x) => sum + x.amount, 0);
}

export function balance(p: Patient): number {
  return totalBilled(p) - totalPaid(p);
}

export function lastVisit(p: Patient): string | null {
  const done = p.sessions
    .filter((s) => s.status !== "cancelled")
    .map((s) => s.date)
    .sort();
  return done.length ? done[done.length - 1] : null;
}

/* ---------------- Search ---------------- */
export function searchPatients(list: Patient[], q: string): Patient[] {
  const query = q.trim().toLowerCase();
  if (!query) return list;
  const digits = query.replace(/\D/g, "");
  return list.filter((p) => {
    const nameMatch = p.name.toLowerCase().includes(query);
    const phoneDigits = p.phone.replace(/\D/g, "");
    const phoneMatch = digits.length >= 2 && phoneDigits.includes(digits);
    return nameMatch || phoneMatch;
  });
}

/* ---------------- Formatting ---------------- */
export function formatMoney(amount: number, lang: Lang): string {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateStr(date: string, lang: Lang): string {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00`);
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function uid(prefix = "pt"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

/* ---------------- Build a patient from a confirmed booking ---------------- */
export function newPatient(init: Partial<Patient> & { name: string; phone: string }): Patient {
  return {
    id: uid(),
    email: "",
    gender: undefined,
    source: "manual",
    createdAt: init.createdAt ?? new Date().toISOString().slice(0, 10),
    notes: "",
    sessions: [],
    payments: [],
    ...init,
  };
}

/* ---------------- Seed clients ---------------- */
export const seedPatients: Patient[] = [];
