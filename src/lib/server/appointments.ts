import { Prisma, type Appointment } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dispatchMessage } from "./notify";
import { generateCode } from "./code";
import { DEFAULT_BRANCH_ID } from "./branches";

export type Stage =
  | "pending"
  | "reserved"
  | "reminder"
  | "queue"
  | "turn"
  | "completed"
  | "declined"
  | "cancelled";

export function reminderLeadMin(): number {
  return parseInt(process.env.REMINDER_LEAD_MIN || "120", 10);
}
export function queueLeadMin(): number {
  return parseInt(process.env.QUEUE_LEAD_MIN || "60", 10);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function minutesUntil(appt: Appointment, now = new Date()): number {
  return (appt.scheduledAt.getTime() - now.getTime()) / 60000;
}

/** Current lifecycle stage for the patient-facing tracker. */
export function stageOf(appt: Appointment, now = new Date()): Stage {
  if (appt.status === "declined") return "declined";
  if (appt.status === "cancelled") return "cancelled";
  if (appt.status === "completed") return "completed";
  if (appt.status === "pending") return "pending";
  // confirmed
  const mins = minutesUntil(appt, now);
  if (mins <= 0) return "turn";
  if (mins <= queueLeadMin()) return "queue";
  if (mins <= reminderLeadMin()) return "reminder";
  return "reserved";
}

/** How many confirmed patients are booked before this one, same day, not yet seen. */
export async function patientsAhead(appt: Appointment, now = new Date()): Promise<number> {
  const dayStart = startOfDay(appt.scheduledAt);
  return prisma.appointment.count({
    where: {
      id: { not: appt.id },
      status: "confirmed",
      completedAt: null,
      scheduledAt: { gte: dayStart, lt: appt.scheduledAt },
    },
  });
}

export type PublicAppointment = {
  code: string;
  patientName: string;
  serviceLabel: { en: string; ar: string };
  scheduledAt: string;
  status: string;
  stage: Stage;
  minutesUntil: number;
  ahead: number;
  reminderLeadMin: number;
  queueLeadMin: number;
  now: string;
};

/** Shape an appointment for the public tracker, including live queue position. */
export async function publicView(appt: Appointment, now = new Date()): Promise<PublicAppointment> {
  const stage = stageOf(appt, now);
  const ahead = stage === "queue" || stage === "turn" ? await patientsAhead(appt, now) : 0;
  return {
    code: appt.code,
    patientName: appt.patientName,
    serviceLabel: { en: appt.serviceLabelEn, ar: appt.serviceLabelAr },
    scheduledAt: appt.scheduledAt.toISOString(),
    status: appt.status,
    stage,
    minutesUntil: Math.round(minutesUntil(appt, now)),
    ahead,
    reminderLeadMin: reminderLeadMin(),
    queueLeadMin: queueLeadMin(),
    now: now.toISOString(),
  };
}

export async function findByCode(code: string): Promise<Appointment | null> {
  return prisma.appointment.findUnique({ where: { code: code.toUpperCase() } });
}

/** Confirm a booking: flip to confirmed and fire the "reserved" WhatsApp message. */
export async function confirmAppointment(idOrCode: { id?: string; code?: string }): Promise<Appointment | null> {
  const appt = idOrCode.id
    ? await prisma.appointment.findUnique({ where: { id: idOrCode.id } })
    : idOrCode.code
    ? await findByCode(idOrCode.code)
    : null;
  if (!appt) return null;
  if (appt.status === "confirmed") return appt;

  // Create (or reuse) the patient account now that the doctor has confirmed, and
  // link the booking to it — so confirmed clients appear in the dashboard.
  let patientId = appt.patientId;
  try {
    patientId = await ensurePatient(appt.patientName, appt.phone);
  } catch (e) {
    console.error("[appointments] ensurePatient on confirm failed:", e instanceof Error ? e.message : e);
  }

  const updated = await prisma.appointment.update({
    where: { id: appt.id },
    data: { status: "confirmed", confirmedAt: new Date(), patientId: patientId ?? appt.patientId },
  });
  await dispatchMessage(updated, "reserved");

  // If it's already inside a reminder/queue window, let the next tick catch up.
  return updated;
}

/**
 * Scheduler core: for confirmed appointments, fire the timed WhatsApp messages
 * exactly once each. Idempotent via the *SentAt / queueOpenedAt timestamps.
 */
export async function processTick(now = new Date()): Promise<{ scanned: number; sent: number }> {
  const windowStart = new Date(now.getTime() - 4 * 60 * 60 * 1000); // include just-passed turns
  const appts = await prisma.appointment.findMany({
    where: { status: "confirmed", scheduledAt: { gte: windowStart } },
  });

  let sent = 0;
  const R = reminderLeadMin();
  const Q = queueLeadMin();

  for (const a of appts) {
    const mins = minutesUntil(a, now);

    if (!a.reminderSentAt && mins <= R && mins > Q) {
      if (await claimStage(a.id, "reminderSentAt", now)) {
        await sendClaimed(a.id, "reminderSentAt", now, () => dispatchMessage(a, "reminder"));
        sent++;
      }
    }

    if (!a.queueOpenedAt && mins <= Q && mins > 0) {
      if (await claimStage(a.id, "queueOpenedAt", now)) {
        const ahead = await patientsAhead(a, now);
        await sendClaimed(a.id, "queueOpenedAt", now, () => dispatchMessage(a, "queue", { ahead }));
        sent++;
      }
    }

    if (!a.turnSentAt && mins <= 0) {
      if (await claimStage(a.id, "turnSentAt", now)) {
        await sendClaimed(a.id, "turnSentAt", now, () => dispatchMessage(a, "turn"));
        sent++;
      }
    }
  }

  return { scanned: appts.length, sent };
}

type StageStamp = "reminderSentAt" | "queueOpenedAt" | "turnSentAt";

/**
 * Atomically claim a one-time stage by flipping its timestamp from null → now.
 * Returns true only for the caller that won the claim, so two overlapping ticks
 * (or two server instances) can never both dispatch the same message.
 */
async function claimStage(id: string, field: StageStamp, now: Date): Promise<boolean> {
  const res = await prisma.appointment.updateMany({
    where: { id, [field]: null },
    data: { [field]: now },
  });
  return res.count === 1;
}

/** Run the dispatch for a claimed stage; release the claim on failure so a later
 *  tick retries instead of the message being silently lost. */
async function sendClaimed(id: string, field: StageStamp, now: Date, send: () => Promise<unknown>): Promise<void> {
  try {
    await send();
  } catch (e) {
    await prisma.appointment.updateMany({ where: { id, [field]: now }, data: { [field]: null } });
    throw e;
  }
}

export type NewBooking = {
  name: string;
  phone: string;
  serviceId: string;
  serviceLabelEn: string;
  serviceLabelAr: string;
  scheduledAt: Date;
  durationMin?: number;
  complaint?: string | null;
  offerTitle?: string | null;
  lang?: "en" | "ar";
  source?: string;
  waChatId?: string | null;
  branchId?: string | null;
};

/** A name is "real" if it has at least 2 letters (not just punctuation/digits). */
function isRealName(s: string): boolean {
  const t = (s || "").trim();
  if (t.length < 2) return false;
  return (t.match(/[\p{L}]/gu) || []).length >= 2;
}

/**
 * Find or create the Patient record for a booking's phone, returning its id.
 * Keeps one account per phone number (matched on the trailing digits so +/0/
 * country-code variants collapse) and upgrades a placeholder name once we learn
 * a real one. Every website/WhatsApp booking therefore creates a client account.
 */
export async function ensurePatient(name: string, phone: string): Promise<string | null> {
  const digits = (phone || "").replace(/\D/g, "");
  const tail = digits.slice(-9);

  if (tail.length >= 8) {
    const existing = await prisma.patient.findFirst({
      where: { phone: { contains: tail } },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      if (isRealName(name) && !isRealName(existing.name)) {
        await prisma.patient.update({ where: { id: existing.id }, data: { name } });
      }
      return existing.id;
    }
  }

  const created = await prisma.patient.create({
    data: {
      name: isRealName(name) ? name.trim() : digits ? `+${digits}` : "WhatsApp client",
      phone,
      source: "booking",
    },
  });
  return created.id;
}

/**
 * Create a pending booking with a unique tracking code.
 * Shared by the website form (/api/bookings) and the WhatsApp agent so both
 * paths behave identically (status "pending" → doctor confirms → WhatsApp flow).
 *
 * No client account is created here — that happens when the doctor confirms
 * (see confirmAppointment), so the Clients list only holds confirmed patients.
 */
/**
 * Create an appointment, retrying on the rare unique-code collision. Two bookings
 * can generate the same code between an existence check and the insert, so instead
 * of check-then-create we let the DB's unique constraint arbitrate: catch P2002
 * and retry with a fresh code. This removes the booking-under-load 500s.
 */
export async function createAppointmentWithUniqueCode(
  data: Omit<Prisma.AppointmentUncheckedCreateInput, "code">,
  attempts = 8,
): Promise<Appointment> {
  for (let i = 0; i < attempts; i++) {
    const code = generateCode();
    try {
      return await prisma.appointment.create({ data: { ...data, code } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        continue; // code collision — try a fresh code
      }
      throw e; // any other error is real
    }
  }
  throw new Error("could_not_allocate_appointment_code");
}

export async function createBooking(input: NewBooking): Promise<Appointment> {
  return createAppointmentWithUniqueCode({
    patientName: input.name,
    phone: input.phone,
    serviceId: input.serviceId,
    serviceLabelEn: input.serviceLabelEn,
    serviceLabelAr: input.serviceLabelAr,
    scheduledAt: input.scheduledAt,
    durationMin: input.durationMin ?? 30,
    complaint: input.complaint ?? null,
    offerTitle: input.offerTitle ?? null,
    lang: input.lang === "ar" ? "ar" : "en",
    waChatId: input.waChatId ?? null,
    // Public/background intake (website form, WhatsApp agent) has no staff branch
    // context, so bookings default to the clinic's main branch. Per-branch intake
    // routing is a later phase; this keeps new rows consistent with the backfill.
    branchId: input.branchId ?? DEFAULT_BRANCH_ID,
    status: "pending",
  });
}

