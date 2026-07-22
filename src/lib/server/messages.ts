import type { Appointment } from "@prisma/client";
import { site } from "@/lib/site";

export type MsgKind = "reserved" | "reminder" | "queue" | "turn";
export type MsgCtx = { ahead?: number };

const CLINIC = { en: site.name, ar: site.nameAr };

function langOf(appt: Appointment): "en" | "ar" {
  return appt.lang === "ar" ? "ar" : "en";
}

function fmtWhen(dt: Date, lang: "en" | "ar"): string {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Cairo",
  }).format(dt);
}

export function trackUrl(code: string): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/track/${code}`;
}

/** Build the WhatsApp message body for a given stage, in the patient's language. */
export function buildMessage(kind: MsgKind, appt: Appointment, ctx: MsgCtx = {}): string {
  const lang = langOf(appt);
  const ar = lang === "ar";
  const clinic = ar ? CLINIC.ar : CLINIC.en;
  const service = ar ? appt.serviceLabelAr : appt.serviceLabelEn;
  const when = fmtWhen(appt.scheduledAt, lang);
  const name = appt.patientName;
  const link = trackUrl(appt.code);
  const ahead = Math.max(0, ctx.ahead ?? 0);

  switch (kind) {
    case "reserved":
      return ar
        ? `✅ *تم تأكيد حجزك!*\nأهلاً ${name}، تم حجز موعدك في ${clinic}.\n\n🦷 ${service}\n📅 ${when}\n\nتابع موعدك مباشرةً من هنا:\n${link}\n\nسنرسل لك تذكيرًا قبل دورك. — ${clinic}`
        : `✅ *Booking confirmed!*\nHi ${name}, your appointment at ${clinic} is reserved.\n\n🦷 ${service}\n📅 ${when}\n\nTrack your visit live here:\n${link}\n\nWe'll remind you before your turn. — ${clinic}`;

    case "reminder":
      return ar
        ? `⏰ *تذكير بالموعد*\nأهلاً ${name}، نذكّرك بموعد ${service} في ${clinic} بعد حوالي ساعتين.\n📅 ${when}\n\nتابع دورك في الانتظار مباشرةً:\n${link}`
        : `⏰ *Appointment reminder*\nHi ${name}, your ${service} appointment at ${clinic} is in about 2 hours.\n📅 ${when}\n\nFollow your place in line live:\n${link}`;

    case "queue": {
      const aheadEn =
        ahead === 0 ? "You're next in line" : `There ${ahead === 1 ? "is 1 patient" : `are ${ahead} patients`} ahead of you`;
      const aheadAr =
        ahead === 0 ? "أنت التالي في الدور" : `يوجد ${ahead} ${ahead === 1 ? "مريض" : "مرضى"} قبلك`;
      return ar
        ? `🔔 *اقترب دورك!*\nأهلاً ${name}، الطبيب على وشك استقبالك. ${aheadAr} الآن.\nتابع دورك لحظة بلحظة:\n${link}`
        : `🔔 *Your turn is coming up!*\nHi ${name}, the doctor is almost ready. ${aheadEn} right now.\nFollow your turn live:\n${link}`;
    }

    case "turn":
      return ar
        ? `🟢 *حان دورك الآن!*\nأهلاً ${name}، الطبيب جاهز لاستقبالك في ${clinic}. برجاء التوجه إلى الاستقبال.\nنراك الآن! 🦷`
        : `🟢 *It's your turn!*\nHi ${name}, the doctor is ready to see you now at ${clinic}. Please head to reception.\nSee you now! 🦷`;
  }
}

/* ------------------------------------------------------------------ *
 * Meta WhatsApp Cloud API templates                                   *
 * ------------------------------------------------------------------ *
 * Business-initiated messages (sent proactively, outside a 24h reply  *
 * window) MUST use a pre-approved template — free-form text is        *
 * rejected. Each kind maps to a template name + ordered body params.  *
 * Submit the matching templates in Meta (see WHATSAPP_SETUP.md).      *
 * Body parameters must be single-line (no newlines / tabs).           */

export type TemplateSpec = {
  name: string;
  languageCode: string;
  bodyParams: string[];
};

/** Template names — overridable via env so they can match what Meta approves. */
const TPL = {
  reserved: () => process.env.WHATSAPP_TPL_RESERVED || "bdic_booking_confirmed",
  reminder: () => process.env.WHATSAPP_TPL_REMINDER || "bdic_appointment_reminder",
  queue: () => process.env.WHATSAPP_TPL_QUEUE || "bdic_queue_update",
  turn: () => process.env.WHATSAPP_TPL_TURN || "bdic_your_turn",
};

function languageCode(appt: Appointment): string {
  const ar = process.env.WHATSAPP_LANG_AR || "ar";
  const en = process.env.WHATSAPP_LANG_EN || "en";
  return langOf(appt) === "ar" ? ar : en;
}

/** A single-line "patients ahead" phrase for the queue template parameter. */
export function aheadPhrase(ahead: number, ar: boolean): string {
  const n = Math.max(0, ahead);
  if (ar) return n === 0 ? "أنت التالي في الدور!" : `يوجد ${n} ${n === 1 ? "مريض" : "مرضى"} قبلك`;
  return n === 0 ? "You're next in line!" : `There ${n === 1 ? "is 1 patient" : `are ${n} patients`} ahead of you`;
}

/**
 * Build the Meta template spec for a stage. The ordered `bodyParams` must match
 * the {{1}}, {{2}}, … placeholders in the approved template body.
 */
export function buildTemplate(kind: MsgKind, appt: Appointment, ctx: MsgCtx = {}): TemplateSpec {
  const ar = langOf(appt) === "ar";
  const service = ar ? appt.serviceLabelAr : appt.serviceLabelEn;
  const when = fmtWhen(appt.scheduledAt, ar ? "ar" : "en");
  const name = appt.patientName;
  const link = trackUrl(appt.code);
  const lc = languageCode(appt);

  switch (kind) {
    case "reserved":
      // {{1}} name · {{2}} service · {{3}} date/time · {{4}} tracking link
      return { name: TPL.reserved(), languageCode: lc, bodyParams: [name, service, when, link] };
    case "reminder":
      // {{1}} name · {{2}} service · {{3}} date/time · {{4}} tracking link
      return { name: TPL.reminder(), languageCode: lc, bodyParams: [name, service, when, link] };
    case "queue":
      // {{1}} name · {{2}} "patients ahead" phrase · {{3}} tracking link
      return { name: TPL.queue(), languageCode: lc, bodyParams: [name, aheadPhrase(ctx.ahead ?? 0, ar), link] };
    case "turn":
      // {{1}} name
      return { name: TPL.turn(), languageCode: lc, bodyParams: [name] };
  }
}
