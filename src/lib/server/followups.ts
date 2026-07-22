/**
 * Post-session follow-up: a "how are you feeling after your visit?" WhatsApp
 * message sent automatically a configurable time after a session ends, plus the
 * helper that logs every clinic↔patient message into the doctor's chat inbox.
 *
 * Timing is doctor-configurable (Settings → stored in the Setting table under
 * "followup"): an on/off switch + a delay in minutes (e.g. 6h, 1 day, 2 days).
 */
import type { Appointment } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendWhatsApp } from "./whatsapp";
import { normalizePhone } from "./phone";
import { site } from "@/lib/site";

const SETTING_KEY = "followup";

export type FollowupConfig = {
  enabled: boolean;
  delaySeconds: number;
};

const DEFAULT_CONFIG: FollowupConfig = {
  enabled: true,
  delaySeconds: 2 * 24 * 60 * 60, // 2 days
};

/** Only scan sessions that ended within this window, so enabling the feature
 *  never retro-blasts very old bookings. */
const MAX_AGE_MINUTES = 7 * 24 * 60; // 7 days

export async function getFollowupConfig(): Promise<FollowupConfig> {
  const row = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(row.value) as { enabled?: boolean; delaySeconds?: number; delayMinutes?: number };
    // Prefer delaySeconds; fall back to the legacy delayMinutes for older configs.
    let delay = Number(parsed.delaySeconds);
    if (!Number.isFinite(delay) || delay <= 0) {
      const mins = Number(parsed.delayMinutes);
      delay = Number.isFinite(mins) && mins > 0 ? mins * 60 : DEFAULT_CONFIG.delaySeconds;
    }
    return {
      enabled: parsed.enabled !== false,
      delaySeconds: Math.max(1, Math.round(delay)),
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function setFollowupConfig(input: Partial<FollowupConfig>): Promise<FollowupConfig> {
  const current = await getFollowupConfig();
  const next: FollowupConfig = {
    enabled: input.enabled ?? current.enabled,
    delaySeconds:
      input.delaySeconds != null && Number.isFinite(input.delaySeconds) && input.delaySeconds > 0
        ? Math.round(input.delaySeconds)
        : current.delaySeconds,
  };
  await prisma.setting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}

/** When a session is considered finished: the doctor-marked completion time, or
 *  else the scheduled start plus its duration. */
export function sessionEnd(appt: Appointment): Date {
  if (appt.completedAt) return appt.completedAt;
  return new Date(appt.scheduledAt.getTime() + (appt.durationMin || 30) * 60000);
}

function buildFollowupMessage(appt: Appointment): string {
  const ar = appt.lang === "ar";
  const name = appt.patientName || "";
  const clinic = ar ? site.nameAr : site.name;
  return ar
    ? `أهلاً ${name} 🌟\nمعاك ${clinic}. عاملين معاك متابعة بعد الجلسة 🦷\nعامل/ة إيه دلوقتي؟ حاسس/ة بإيه بعد الجلسة، وبقيت أحسن؟\n\nردّك يهمنا — اكتبلنا هنا وهنتابع معاك. 💙`
    : `Hi ${name} 🌟\nThis is ${clinic} checking in after your visit 🦷\nHow are you feeling now — any better since the session?\n\nYour reply matters to us — just message us here and we'll follow up. 💙`;
}

/** Append a message to the patient's chat thread (the doctor's inbox). */
export async function logChat(input: {
  phone: string;
  chatId?: string | null;
  direction: "in" | "out";
  body: string;
  kind?: string;
  readAt?: Date | null;
}): Promise<void> {
  await prisma.chatMessage.create({
    data: {
      phone: normalizePhone(input.phone).digits || input.phone,
      chatId: input.chatId ?? null,
      direction: input.direction,
      body: input.body,
      kind: input.kind ?? "chat",
      readAt: input.readAt ?? null,
    },
  });
}

/**
 * Scheduler step: send the post-session follow-up to every eligible appointment
 * exactly once. Eligible = confirmed/completed, not yet followed up, session
 * ended at least `delayMinutes` ago (and within the recency window).
 */
export async function processFollowups(now = new Date()): Promise<{ scanned: number; sent: number }> {
  const cfg = await getFollowupConfig();
  if (!cfg.enabled) return { scanned: 0, sent: 0 };

  // Earliest scheduledAt worth scanning (bounded by the recency window).
  const earliest = new Date(now.getTime() - MAX_AGE_MINUTES * 60000);

  const appts = await prisma.appointment.findMany({
    where: {
      status: { in: ["confirmed", "completed"] },
      followupSentAt: null,
      scheduledAt: { gte: earliest },
    },
    take: 200,
  });

  let sent = 0;
  for (const appt of appts) {
    const end = sessionEnd(appt);
    const dueAt = end.getTime() + cfg.delaySeconds * 1000;
    if (dueAt > now.getTime()) continue; // not time yet
    if (end.getTime() < earliest.getTime()) continue; // ended too long ago

    // Atomically claim the send (null → now) so overlapping runs or multiple
    // instances can never double-send the same follow-up. Only the winner sends.
    const claim = await prisma.appointment.updateMany({
      where: { id: appt.id, followupSentAt: null },
      data: { followupSentAt: now },
    });
    if (claim.count !== 1) continue;

    const body = buildFollowupMessage(appt);
    const to = normalizePhone(appt.phone).digits;
    try {
      await sendWhatsApp({ to, body, chatId: appt.waChatId ?? null });
      await logChat({ phone: to, chatId: appt.waChatId ?? null, direction: "out", body, kind: "followup" });

      // Mark the conversation so the patient's next reply is treated as a
      // follow-up reply (a friendly ack) rather than starting a new booking.
      await prisma.waConversation.upsert({
        where: { phone: to },
        create: { phone: to, chatId: appt.waChatId ?? null, state: "followup", lang: appt.lang === "ar" ? "ar" : "en" },
        update: { state: "followup", chatId: appt.waChatId ?? undefined },
      });
      sent++;
    } catch (e) {
      // Release the claim so a later run can retry this follow-up.
      await prisma.appointment.updateMany({ where: { id: appt.id, followupSentAt: now }, data: { followupSentAt: null } });
      console.error("[followup] send failed:", e instanceof Error ? e.message : e);
    }
  }

  return { scanned: appts.length, sent };
}
