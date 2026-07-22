/**
 * WhatsApp booking agent — a PURE, bilingual (Arabic-first) conversation engine.
 *
 * Flow (matches the clinic's desired UX):
 *   idle → day  : greet, list the next open days (numbered)
 *   day  → slot : show the available time slots for the chosen day
 *   slot → why  : ask the reason for the visit (complaint)
 *   why  → idle : create a PENDING booking and tell the patient we're awaiting
 *                 the doctor's confirmation. When the doctor confirms in the
 *                 dashboard, a separate "confirmed" message is sent (see wa-runtime).
 *
 * It performs NO I/O. The runtime computes availability (open days + slots) from
 * the database and passes it in via `ctx`, so this stays fully unit-testable.
 */

export type WaState = "idle" | "day" | "slot" | "why" | "name" | "followup";

export type WaDraft = {
  dateISO?: string; // chosen day (local midnight ISO)
  dateLabel?: string; // human label for the chosen day
  slot?: string; // "HH:MM"
  timeLabel?: string; // human label for the chosen time
  reason?: string;
  patientName?: string; // who the appointment is for
};

export type WaConv = { state: WaState; draft: WaDraft; lang: "ar" | "en" };

export type DayOption = { dateISO: string; label: string };
export type SlotOption = { value: string; label: string }; // value = "HH:MM"

/** Availability + context the runtime injects (computed from the DB). */
export type AgentCtx = {
  now?: Date;
  name?: string; // WhatsApp contact name (used as the patient name)
  openDays?: DayOption[];
  slotsByDate?: Record<string, SlotOption[]>;
  clinicName?: { en: string; ar: string }; // injected per active clinic
};

export type BookingIntent = {
  name: string;
  phone: string;
  serviceId: string;
  serviceLabelEn: string;
  serviceLabelAr: string;
  scheduledAt: Date;
  reason?: string;
  lang: "ar" | "en";
};

export type AgentResult = {
  reply: string;
  next: WaConv;
  booking?: BookingIntent;
};

/* ---------------- helpers ---------------- */

/** Convert Arabic-Indic digits to ASCII and trim. */
export function normalizeDigits(s: string): string {
  return (s || "")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

function detectLang(text: string): "ar" | "en" {
  return /[\u0600-\u06ff]/.test(text) ? "ar" : "en";
}

const isCancel = (t: string) => /^(إلغاء|الغاء|cancel|stop|الغ)/i.test((t || "").trim());

/** Does the message express intent to (re)start a booking? */
export function wantsBooking(text: string): boolean {
  return /(حجز|احجز|أحجز|موعد|book|appointment|reserve|عايز.*ميعاد|عايز.*موعد)/i.test((text || "").trim());
}

/** Detects a "confirm my booking" message (from the website's WhatsApp button). */
export function detectConfirm(text: string): { isConfirm: boolean; code?: string } {
  const t = text || "";
  const mentions =
    /(تأكيد|أكّد|اكد|confirm).*(حجز|موعد|booking|appointment)|(حجز|موعد|booking|appointment).*(تأكيد|أكّد|اكد|confirm)/i.test(
      t
    );
  const m = t.match(/\b([A-Z2-9]{6})\b/);
  return { isConfirm: mentions || /كود الحجز|booking code/i.test(t), code: m ? m[1] : undefined };
}

const CLINIC_NAME_DEFAULT = { ar: "مركز بدوي لزراعة الأسنان", en: "Badawi Dental Implant Center" };

const T = {
  greet: {
    ar: "أهلاً بك في {clinic} 🦷\nهنحجزلك موعد بسرعة. اختر اليوم المناسب بالرد بالرقم:",
    en: "Welcome to {clinic} 🦷\nLet's book your visit. Choose a day by replying with its number:",
  },
  noDays: {
    ar: "لا توجد أيام متاحة حاليًا. برجاء التواصل مع العيادة مباشرة.",
    en: "No open days available right now. Please contact the clinic directly.",
  },
  pickDayAgain: {
    ar: "من فضلك اختر رقم اليوم من القائمة 👆",
    en: "Please reply with a day number from the list 👆",
  },
  daySlotsHead: {
    ar: "📅 المواعيد المتاحة يوم ",
    en: "📅 Available times on ",
  },
  pickSlot: {
    ar: "\nاختر الموعد بالرد بالرقم:",
    en: "\nChoose a time by replying with its number:",
  },
  noSlots: {
    ar: "للأسف مفيش مواعيد متاحة في اليوم ده. اختر يوم تاني من فضلك:",
    en: "Sorry, no free times that day. Please pick another day:",
  },
  pickSlotAgain: {
    ar: "من فضلك اختر رقم الموعد من القائمة 👆",
    en: "Please reply with a time number from the list 👆",
  },
  askwhy: {
    ar: "تمام ✅\nاكتب سبب الزيارة باختصار (مثلاً: ألم، كشف، تنظيف، استشارة) 🦷",
    en: "Great ✅\nBriefly, what's the reason for your visit? (e.g. pain, check-up, cleaning, consultation) 🦷",
  },
  askName: {
    ar: "والموعد باسم مين؟ اكتب اسم المريض من فضلك ✍️",
    en: "And whose appointment is this? Please type the patient's name ✍️",
  },
  waiting: {
    ar: "تم استلام طلب حجزك ✅\n\n👤 {name}\n📅 {day}\n🕐 {time}\n📝 {reason}\n\n⏳ في انتظار تأكيد الطبيب — هنبعتلك رسالة فور التأكيد.",
    en: "Your booking request is received ✅\n\n👤 {name}\n📅 {day}\n🕐 {time}\n📝 {reason}\n\n⏳ Waiting for the doctor's confirmation — we'll message you the moment it's confirmed.",
  },
  cancelled: {
    ar: "تم الإلغاء. اكتب «حجز» في أي وقت للبدء من جديد 🌟",
    en: "Cancelled. Type \"book\" anytime to start again 🌟",
  },
  confirmAck: {
    ar: "شكرًا لك! ✅ وصلنا طلب تأكيد حجزك، وسيؤكده الطبيب قريبًا وتصلك رسالة بالتفاصيل.",
    en: "Thank you! ✅ We've received your confirmation request. The doctor will confirm shortly and you'll get the details here.",
  },
  followupAck: {
    ar: "شكرًا لردّك واهتمامك 🌟\nوصلت رسالتك للدكتور وهيتابع معاك. لو محتاج أي حاجة تانية احنا موجودين 💙\nولو حابب تحجز موعد جديد اكتب «حجز».",
    en: "Thank you for your reply 🌟\nThe doctor has received your message and will follow up. We're here if you need anything 💙\nTo book a new appointment, type \"book\".",
  },
};

function dayMenu(days: DayOption[]): string {
  return days.map((d, i) => `${i + 1}. ${d.label}`).join("\n");
}
function slotMenu(slots: SlotOption[]): string {
  return slots.map((s, i) => `${i + 1}. ${s.label}`).join("\n");
}

/* ---------------- the state machine ---------------- */

export function handleMessage(
  conv: WaConv,
  textRaw: string,
  phone: string,
  ctx: AgentCtx = {}
): AgentResult {
  const text = (textRaw || "").trim();
  const now = ctx.now ?? new Date();
  const openDays = ctx.openDays ?? [];
  const slotsByDate = ctx.slotsByDate ?? {};
  const lang = conv.lang || detectLang(text);
  const tr = (k: keyof typeof T) => T[k][lang];
  const clinicName = ctx.clinicName ?? CLINIC_NAME_DEFAULT;
  const greet = (l: "ar" | "en") => T.greet[l].replace("{clinic}", clinicName[l]);

  // cancel from anywhere
  if (isCancel(text) && conv.state !== "idle") {
    return { reply: tr("cancelled"), next: { state: "idle", draft: {}, lang } };
  }

  // While waiting on a follow-up reply, treat the patient's message as a reply to
  // the doctor (friendly ack) — unless they explicitly want to book again.
  if (conv.state === "followup") {
    const l = detectLang(text);
    if (wantsBooking(text)) {
      if (openDays.length === 0) {
        return { reply: T.noDays[l], next: { state: "idle", draft: {}, lang: l } };
      }
      return {
        reply: `${greet(l)}\n\n${dayMenu(openDays)}`,
        next: { state: "day", draft: {}, lang: l },
      };
    }
    return { reply: T.followupAck[l], next: { state: "idle", draft: {}, lang: l } };
  }

  switch (conv.state) {
    case "idle": {
      const l = detectLang(text);
      // Website "confirm my booking" message → acknowledge, don't start a new flow.
      if (detectConfirm(text).isConfirm) {
        return { reply: T.confirmAck[l], next: { state: "idle", draft: {}, lang: l } };
      }
      if (openDays.length === 0) {
        return { reply: T.noDays[l], next: { state: "idle", draft: {}, lang: l } };
      }
      return {
        reply: `${greet(l)}\n\n${dayMenu(openDays)}`,
        next: { state: "day", draft: {}, lang: l },
      };
    }

    case "day": {
      const n = parseInt(normalizeDigits(text), 10);
      const day = Number.isFinite(n) ? openDays[n - 1] : undefined;
      if (!day) return { reply: tr("pickDayAgain"), next: conv };
      const slots = slotsByDate[day.dateISO] ?? [];
      if (slots.length === 0) {
        return {
          reply: `${tr("noSlots")}\n\n${dayMenu(openDays)}`,
          next: { state: "day", draft: {}, lang },
        };
      }
      return {
        reply: `${tr("daySlotsHead")}${day.label}${T.pickSlot[lang]}\n\n${slotMenu(slots)}`,
        next: { state: "slot", lang, draft: { dateISO: day.dateISO, dateLabel: day.label } },
      };
    }

    case "slot": {
      const slots = conv.draft.dateISO ? slotsByDate[conv.draft.dateISO] ?? [] : [];
      const n = parseInt(normalizeDigits(text), 10);
      const slot = Number.isFinite(n) ? slots[n - 1] : undefined;
      if (!slot) return { reply: tr("pickSlotAgain"), next: conv };
      return {
        reply: tr("askwhy"),
        next: {
          state: "why",
          lang,
          draft: { ...conv.draft, slot: slot.value, timeLabel: slot.label },
        },
      };
    }

    case "why": {
      const reason = text.replace(/\s+/g, " ").trim();
      if (reason.length < 2) return { reply: tr("askwhy"), next: conv };
      // Move on to ask who the appointment is for.
      return {
        reply: tr("askName"),
        next: { state: "name", lang, draft: { ...conv.draft, reason } },
      };
    }

    case "name": {
      const patientName = text.replace(/\s+/g, " ").trim();
      if (patientName.length < 2) return { reply: tr("askName"), next: conv };

      const d = conv.draft;
      const [hh, mm] = (d.slot ?? "12:00").split(":").map((x) => parseInt(x, 10));
      const when = d.dateISO ? new Date(d.dateISO) : new Date(now);
      when.setHours(hh, mm, 0, 0);

      const booking: BookingIntent = {
        name: patientName,
        phone,
        serviceId: "checkup",
        serviceLabelEn: "Consultation",
        serviceLabelAr: "كشف",
        scheduledAt: when,
        reason: d.reason,
        lang,
      };

      const reply = tr("waiting")
        .replace("{name}", patientName)
        .replace("{day}", d.dateLabel ?? "")
        .replace("{time}", d.timeLabel ?? d.slot ?? "")
        .replace("{reason}", d.reason ?? "");

      return { reply, next: { state: "idle", draft: {}, lang }, booking };
    }

    default:
      return {
        reply: `${greet(lang)}\n\n${dayMenu(openDays)}`,
        next: { state: "day", draft: {}, lang },
      };
  }
}
