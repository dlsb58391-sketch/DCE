import type { Lang } from "./content";

export type Bilingual = { en: string; ar: string };

/* ---------------- Session types (نوع الجلسة) ---------------- */
export type SessionType = {
  id: string;
  label: Bilingual;
  color: string; // hex accent used for chips / left borders
  durationMin: number;
  price: number; // default price in EGP
  icon: string; // SVG path data for a recognizable glyph
};

export const sessionTypes: SessionType[] = [
  { id: "checkup", label: { en: "Check-up", ar: "كشف" }, color: "#3b82f6", durationMin: 30, price: 300, icon: "M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm9.5 16-5-5" },
  { id: "cleaning", label: { en: "Scaling & Polish", ar: "تنظيف وجلي" }, color: "#10b981", durationMin: 45, price: 600, icon: "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6Z" },
  { id: "filling", label: { en: "Filling", ar: "حشو" }, color: "#c9a24b", durationMin: 45, price: 800, icon: "M12 4.5c-2-1.4-5-1.6-6.3.3-1.2 1.8-.6 4.3 0 6.6.5 1.9.3 3 .8 5.2.3 1.4.7 2.9 1.6 2.9 1.1 0 1.1-2 1.6-3.6.3-1 .8-1.7 1.3-1.7s1 .7 1.3 1.7c.5 1.6.5 3.6 1.6 3.6.9 0 1.3-1.5 1.6-2.9.5-2.2.3-3.3.8-5.2.6-2.3 1.2-4.8 0-6.6C17 2.9 14 3.1 12 4.5Z" },
  { id: "hard_filling", label: { en: "Complex Filling", ar: "حشو صعب" }, color: "#f59e0b", durationMin: 60, price: 1200, icon: "M13 2 4 14h6v8l8-12h-6z" },
  { id: "whitening", label: { en: "Teeth Whitening", ar: "تبييض" }, color: "#0ea5b7", durationMin: 60, price: 3500, icon: "M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 8.7l5.4-.8z" },
  { id: "root_canal", label: { en: "Root Canal", ar: "علاج عصب" }, color: "#ef4444", durationMin: 90, price: 2500, icon: "M3 12h4l2 5 4-12 2 7h6" },
  { id: "extraction", label: { en: "Extraction", ar: "خلع" }, color: "#8b5cf6", durationMin: 30, price: 700, icon: "M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" },
  { id: "implant", label: { en: "Implant", ar: "زراعة" }, color: "#0891b2", durationMin: 90, price: 12000, icon: "M12 2v20M8 6h8M8 10h8M9 14h6M10 18h4" },
  { id: "crown", label: { en: "Crown / Veneer", ar: "تركيبة / عدسات" }, color: "#ec4899", durationMin: 60, price: 4500, icon: "M4 17 2 7l6 4 4-7 4 7 6-4-2 10z" },
];

export function sessionTypeById(id: string): SessionType {
  return sessionTypes.find((s) => s.id === id) ?? sessionTypes[0];
}

/* ---------------- Clinic working hours ---------------- */
export const clinic = {
  openMin: 10 * 60, // 10:00
  closeMin: 22 * 60, // 22:00
  slotMin: 30,
  closedWeekday: 5, // Friday (0 = Sunday … 6 = Saturday)
};

/* ---------------- Appointments (الجلسات المؤكدة) ---------------- */
export type Status = "confirmed" | "pending";

export type Appointment = {
  id: string;
  patient: Bilingual;
  typeId: string;
  dayOffset: number; // 0 = today, 1 = tomorrow …
  start: string; // "HH:MM" 24h
  status: Status;
  phone: string;
  code?: string; // booking code (DB-backed online/WhatsApp bookings)
  online?: boolean; // true if it comes from the DB (website/WhatsApp), not local seed
  done?: boolean; // true once the doctor marks the session finished (completed)
  doctorName?: string; // assigned doctor (DB appointments booked from the dashboard)
};

export const seedAppointments: Appointment[] = [];

/* ---------------- Booking requests (حجوزات جديدة) ---------------- */
export type RequestStatus = "new" | "confirmed" | "declined";

export type BookingRequest = {
  id: string;
  patient: Bilingual;
  phone: string;
  complaint: Bilingual; // what the patient suffers from
  typeId: string; // requested session type
  dayOffset: number; // day the patient chose
  start: string; // hour the patient chose "HH:MM"
  createdAgoMin: number; // received N minutes ago
  status: RequestStatus;
};

export const seedRequests: BookingRequest[] = [];

/* ---------------- Time helpers ---------------- */
export function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const locale = (lang: Lang) => (lang === "ar" ? "ar-EG" : "en-US");

/** Build a Date for a given day offset and minute-of-day, based on a stable "today". */
export function dateAt(base: Date, dayOffset: number, minOfDay = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minOfDay);
  return d;
}

/** Local YYYY-MM-DD string for a given day offset from base. */
export function isoDate(base: Date, dayOffset = 0): string {
  const d = dateAt(base, dayOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fmtTime(base: Date, dayOffset: number, minOfDay: number, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(dateAt(base, dayOffset, minOfDay));
}

export function fmtDateLong(base: Date, dayOffset: number, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dateAt(base, dayOffset));
}

export function fmtWeekday(base: Date, dayOffset: number, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { weekday: "short" }).format(
    dateAt(base, dayOffset)
  );
}

export function fmtDayNum(base: Date, dayOffset: number, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { day: "numeric" }).format(
    dateAt(base, dayOffset)
  );
}

export function isClosed(base: Date, dayOffset: number): boolean {
  return dateAt(base, dayOffset).getDay() === clinic.closedWeekday;
}

export function formatAgo(min: number, lang: Lang): string {
  if (min < 60) {
    return lang === "ar" ? `منذ ${min} دقيقة` : `${min}m ago`;
  }
  if (min < 60 * 24) {
    const h = Math.floor(min / 60);
    return lang === "ar" ? `منذ ${h} ساعة` : `${h}h ago`;
  }
  const d = Math.floor(min / (60 * 24));
  return lang === "ar" ? `منذ ${d} يوم` : `${d}d ago`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

/** rgba tint from a hex color. */
export function tint(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ---------------- Day timeline (sessions + free slots) ---------------- */
export type TimelineEntry =
  | { kind: "appt"; appt: Appointment; startMin: number; endMin: number }
  | { kind: "free"; startMin: number; endMin: number };

export function dayTimeline(appts: Appointment[]): TimelineEntry[] {
  const sorted = [...appts].sort((a, b) => hhmmToMin(a.start) - hhmmToMin(b.start));
  const entries: TimelineEntry[] = [];
  let cursor = clinic.openMin;

  const pushFree = (from: number, to: number) => {
    let c = from;
    while (c + clinic.slotMin <= to) {
      entries.push({ kind: "free", startMin: c, endMin: c + clinic.slotMin });
      c += clinic.slotMin;
    }
    if (c < to) entries.push({ kind: "free", startMin: c, endMin: to });
  };

  for (const a of sorted) {
    const s = hhmmToMin(a.start);
    const end = s + sessionTypeById(a.typeId).durationMin;
    if (s > cursor) pushFree(cursor, s);
    entries.push({ kind: "appt", appt: a, startMin: s, endMin: end });
    cursor = Math.max(cursor, end);
  }
  if (cursor < clinic.closeMin) pushFree(cursor, clinic.closeMin);

  return entries;
}

export function freeSlotCount(appts: Appointment[]): number {
  return dayTimeline(appts).filter((e) => e.kind === "free").length;
}

/**
 * Bookable start times (HH:MM) for a given day, honoring the doctor's existing
 * appointments, the service duration, clinic hours, day off, and (for today)
 * a minimum lead time so past hours can't be booked.
 */
export function availableSlots(
  appts: Appointment[],
  base: Date,
  dayOffset: number,
  durationMin: number
): string[] {
  if (isClosed(base, dayOffset)) return [];

  const busy = appts
    .filter((a) => a.dayOffset === dayOffset)
    .map((a) => {
      const s = hhmmToMin(a.start);
      return [s, s + sessionTypeById(a.typeId).durationMin] as const;
    });

  // For today, require the slot to start at least 30 min from now.
  const nowMin =
    dayOffset === 0 ? base.getHours() * 60 + base.getMinutes() + 30 : -1;

  const slots: string[] = [];
  for (
    let start = clinic.openMin;
    start + durationMin <= clinic.closeMin;
    start += clinic.slotMin
  ) {
    if (start < nowMin) continue;
    const end = start + durationMin;
    const clash = busy.some(([bs, be]) => start < be && end > bs);
    if (!clash) slots.push(minToHHMM(start));
  }
  return slots;
}
