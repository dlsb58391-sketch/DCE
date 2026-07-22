/**
 * WhatsApp agent runtime: the side-effecting layer around the pure `wa-agent`.
 * Loads/saves conversation state, computes availability from the DB, creates the
 * booking, and returns replies. Shared by the worker endpoint and the simulator.
 */
import { prisma } from "@/lib/db";
import {
  handleMessage,
  wantsBooking,
  type WaConv,
  type WaState,
  type DayOption,
  type SlotOption,
} from "./wa-agent";
import { createBooking } from "./appointments";
import { logChat } from "./followups";
import { activeClinic } from "@/lib/clinics";
import { whatsappBookingBranchId, branchWhereFilter } from "./branch-context";
import { DEFAULT_BRANCH_ID } from "./branches";

const VALID_STATES: WaState[] = ["idle", "day", "slot", "why", "name", "followup"];

/* ---------------- clinic hours ---------------- */
const OPEN_MIN = 12 * 60; // 12:00
const CLOSE_MIN = 22 * 60; // 22:00
const SLOT_MIN = 30;
const VISIT_MIN = 30; // default consultation length
const CLOSED_WEEKDAY = 5; // Friday
const TZ = "Africa/Cairo";
const OPEN_DAYS_COUNT = 6; // how many upcoming open days to offer

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function minToHHMM(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function dayLabel(d: Date, lang: "ar" | "en"): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TZ,
  }).format(d);
}
function timeLabel(d: Date, lang: "ar" | "en"): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: TZ,
  }).format(d);
}

/** The next N open (non-Friday) days, starting today. */
function nextOpenDays(now: Date, lang: "ar" | "en", count = OPEN_DAYS_COUNT): DayOption[] {
  const days: DayOption[] = [];
  const cursor = startOfDay(now);
  let guard = 0;
  while (days.length < count && guard < 21) {
    guard++;
    if (cursor.getDay() !== CLOSED_WEEKDAY) {
      days.push({ dateISO: cursor.toISOString(), label: dayLabel(cursor, lang) });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/**
 * A Prisma `branchId` filter for the branch the WhatsApp bot books into, so slot
 * availability is computed only against that branch's schedule (the main branch
 * also includes legacy/unstamped rows). Keeps one branch's bookings from
 * blocking another branch's times. Delegates to the shared scope helper so the
 * "default branch also sees null rows" rule stays in one place.
 */
function waBranchFilter(hostBranchId: string): Record<string, unknown> {
  return branchWhereFilter({
    mode: "one",
    branchId: hostBranchId,
    includeNull: hostBranchId === DEFAULT_BRANCH_ID,
  });
}

/** Free 30-min slots for a given day, excluding already-booked times. */
async function computeDaySlots(
  dateISO: string,
  now: Date,
  lang: "ar" | "en",
  branchFilter: Record<string, unknown>,
): Promise<SlotOption[]> {
  const day = new Date(dateISO);
  if (day.getDay() === CLOSED_WEEKDAY) return [];
  const dayStart = startOfDay(day);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const appts = await prisma.appointment.findMany({
    where: {
      AND: [
        {
          status: { in: ["pending", "confirmed"] },
          scheduledAt: { gte: dayStart, lt: dayEnd },
        },
        branchFilter,
      ],
    },
    select: { scheduledAt: true, durationMin: true },
  });

  const busy = appts.map((a) => {
    const s = a.scheduledAt.getHours() * 60 + a.scheduledAt.getMinutes();
    return [s, s + (a.durationMin || VISIT_MIN)] as const;
  });

  const isToday = startOfDay(now).getTime() === dayStart.getTime();
  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() + 30 : -1;

  const slots: SlotOption[] = [];
  for (let start = OPEN_MIN; start + VISIT_MIN <= CLOSE_MIN; start += SLOT_MIN) {
    if (start < nowMin) continue;
    const end = start + VISIT_MIN;
    const clash = busy.some(([bs, be]) => start < be && end > bs);
    if (clash) continue;
    const slotDate = new Date(dayStart);
    slotDate.setHours(Math.floor(start / 60), start % 60, 0, 0);
    slots.push({ value: minToHHMM(start), label: timeLabel(slotDate, lang) });
  }
  return slots.slice(0, 12); // keep the menu readable
}

export async function loadConv(phone: string): Promise<WaConv> {
  const row = await prisma.waConversation.findUnique({ where: { phone } });
  if (!row) return { state: "idle", draft: {}, lang: "ar" };
  const state = (VALID_STATES.includes(row.state as WaState) ? row.state : "idle") as WaState;
  let draft = {};
  try {
    draft = row.draft ? JSON.parse(row.draft) : {};
  } catch {
    draft = {};
  }
  return { state, draft, lang: row.lang === "en" ? "en" : "ar" };
}

async function saveConv(phone: string, conv: WaConv): Promise<void> {
  await prisma.waConversation.upsert({
    where: { phone },
    create: { phone, state: conv.state, draft: JSON.stringify(conv.draft), lang: conv.lang },
    update: { state: conv.state, draft: JSON.stringify(conv.draft), lang: conv.lang },
  });
}

/**
 * Decide the patient's display name for a WhatsApp booking:
 *   1. an existing Patient/Appointment with this phone (returning patient), else
 *   2. the WhatsApp contact name if it's a real name (not junk like "." or digits), else
 *   3. a readable label built from the phone number.
 */
async function resolvePatientName(
  phone: string,
  contactName: string | undefined,
  lang: "ar" | "en"
): Promise<string> {
  const digits = phone.replace(/\D/g, "");

  // 1) returning patient by phone (match on the trailing digits to dodge +/0/cc variants)
  const tail = digits.slice(-9);
  if (tail.length >= 8) {
    const prior = await prisma.appointment.findFirst({
      where: { phone: { contains: tail }, patientName: { not: "" } },
      orderBy: { createdAt: "desc" },
      select: { patientName: true },
    });
    if (prior?.patientName && isRealName(prior.patientName)) return prior.patientName;

    const patient = await prisma.patient.findFirst({
      where: { phone: { contains: tail } },
      orderBy: { createdAt: "desc" },
      select: { name: true },
    });
    if (patient?.name && isRealName(patient.name)) return patient.name;
  }

  // 2) a usable WhatsApp contact name
  if (contactName && isRealName(contactName)) return contactName.trim();

  // 3) fall back to a phone-based label
  const pretty = digits ? `+${digits}` : phone;
  return lang === "ar" ? `عميل ${pretty}` : `Client ${pretty}`;
}

/** A name is "real" if it has at least 2 letters and isn't just punctuation/digits. */
function isRealName(s: string): boolean {
  const t = (s || "").trim();
  if (t.length < 2) return false;
  const letters = (t.match(/[\p{L}]/gu) || []).length;
  return letters >= 2;
}

/**
 * Process one inbound message end-to-end. Computes availability, runs the agent,
 * persists state, creates the booking on completion, and returns the reply texts.
 * The caller (worker / simulator) delivers the replies.
 */
export async function processInbound(
  phone: string,
  text: string,
  now = new Date(),
  name?: string,
  chatId?: string
): Promise<{ replies: string[]; bookingCode?: string }> {
  const conv = await loadConv(phone);
  const lang = conv.lang;

  // Log every inbound message into the doctor's chat inbox. If we were awaiting a
  // post-session follow-up reply, tag it as such so it stands out.
  const inboundKind = conv.state === "followup" ? "reply" : "chat";
  try {
    await logChat({ phone, chatId: chatId ?? null, direction: "in", body: text, kind: inboundKind });
  } catch (e) {
    console.error("[wa] logChat inbound failed:", e instanceof Error ? e.message : e);
  }

  // If the booking bot is paused (the doctor is chatting manually), stay silent —
  // unless the patient is mid-booking or explicitly wants to book.
  const meta = await prisma.waConversation.findUnique({
    where: { phone },
    select: { agentPausedUntil: true },
  });
  const paused = meta?.agentPausedUntil ? meta.agentPausedUntil.getTime() > now.getTime() : false;
  const inBookingFlow = ["day", "slot", "why", "name"].includes(conv.state);
  if (paused && !inBookingFlow && !wantsBooking(text)) {
    return { replies: [] };
  }

  // Resolve a good patient name (returning patient → contact name → phone label).
  const resolvedName = await resolvePatientName(phone, name, lang);

  // The single WhatsApp bot books into one configured branch; scope availability
  // and the new booking to it so branches keep separate schedules.
  const hostBranchId = await whatsappBookingBranchId();
  const branchFilter = waBranchFilter(hostBranchId);

  // Build availability context the agent needs.
  const openDays = nextOpenDays(now, lang);
  const slotsByDate: Record<string, SlotOption[]> = {};
  // Only compute slots we might show: all open days when about to list, or the
  // chosen day when in "slot". Computing all is cheap (<=6 small queries).
  for (const d of openDays) {
    slotsByDate[d.dateISO] = await computeDaySlots(d.dateISO, now, lang, branchFilter);
  }
  if (conv.draft.dateISO && !slotsByDate[conv.draft.dateISO]) {
    slotsByDate[conv.draft.dateISO] = await computeDaySlots(conv.draft.dateISO, now, lang, branchFilter);
  }

  const clinic = activeClinic();
  const result = handleMessage(conv, text, phone, {
    now,
    name: resolvedName,
    openDays,
    slotsByDate,
    clinicName: { en: clinic.doctorName.en, ar: clinic.doctorName.ar },
  });
  await saveConv(phone, result.next);

  const replies: string[] = [];
  if (result.reply) replies.push(result.reply);

  // Log the bot's replies as outbound so the chat thread reads naturally.
  for (const body of replies) {
    try {
      await logChat({ phone, chatId: chatId ?? null, direction: "out", body, kind: "bot" });
    } catch (e) {
      console.error("[wa] logChat outbound failed:", e instanceof Error ? e.message : e);
    }
  }

  let bookingCode: string | undefined;
  if (result.booking) {
    const b = result.booking;
    const appt = await createBooking({
      name: b.name,
      phone: b.phone,
      serviceId: b.serviceId,
      serviceLabelEn: b.serviceLabelEn,
      serviceLabelAr: b.serviceLabelAr,
      scheduledAt: b.scheduledAt,
      complaint: b.reason ?? null,
      lang: b.lang,
      waChatId: chatId ?? null,
      branchId: hostBranchId,
    });
    bookingCode = appt.code;
  }

  return { replies, bookingCode };
}
