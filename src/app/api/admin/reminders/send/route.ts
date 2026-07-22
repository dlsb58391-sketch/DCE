import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { normalizePhone } from "@/lib/server/phone";
import { sendProactive } from "@/lib/server/wa-send";
import { site } from "@/lib/site";
import { withRoute } from "@/lib/server/http";

/**
 * Admin: send a proactive WhatsApp message to a patient — either a payment
 * reminder (outstanding balance) or a recall/reactivation nudge. The message is
 * built in the patient's preferred language and logged to the Client Messages
 * inbox. It does NOT pause the booking bot, so a "book me" reply flows into the
 * booking menu.
 *   POST /api/admin/reminders/send  { phone, name?, type: "payment"|"recall", balance? }
 */
const tail = (p: string) => (p || "").replace(/\D/g, "").slice(-9);

async function preferredLang(phone: string): Promise<"ar" | "en"> {
  const t = tail(phone);
  if (t.length >= 8) {
    const conv = await prisma.waConversation.findFirst({
      where: { phone: { contains: t } },
      orderBy: { updatedAt: "desc" },
      select: { lang: true },
    });
    if (conv?.lang === "en" || conv?.lang === "ar") return conv.lang;
    const appt = await prisma.appointment.findFirst({
      where: { phone: { contains: t } },
      orderBy: { createdAt: "desc" },
      select: { lang: true },
    });
    if (appt?.lang === "en") return "en";
  }
  return "ar";
}

const money = (n: number, lang: "ar" | "en") =>
  new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", { maximumFractionDigits: 0 }).format(n);

function buildMessage(type: "payment" | "recall", name: string, balance: number, lang: "ar" | "en"): string {
  const nm = (name || "").trim();
  const clinic = lang === "ar" ? site.nameAr : site.name;
  if (type === "payment") {
    return lang === "ar"
      ? `أهلاً ${nm} 🌟\nمعاك ${clinic}. حابين نفكّرك إن متبقّي عليك مبلغ ${money(balance, "ar")} جنيه من علاجك.\nتقدر تعدّي العيادة أو تحوّلهولنا في أي وقت يناسبك. لو محتاج أي مساعدة ردّ على الرسالة دي. 💙`
      : `Hi ${nm} 🌟\nThis is ${clinic}. A friendly reminder that you have an outstanding balance of ${money(balance, "en")} EGP from your treatment.\nYou can drop by the clinic or transfer it whenever suits you. Reply here if you need any help. 💙`;
  }
  return lang === "ar"
    ? `أهلاً ${nm} 🌟\nمعاك ${clinic}. بقالك فترة ما زرتناش 🦷\nده وقت كويس لكشف ومتابعة لأسنانك. تحب نحجزلك موعد؟ ردّ «احجز» وهنظبطك. 💙`
    : `Hi ${nm} 🌟\nThis is ${clinic}. It's been a while since your last visit 🦷\nNow's a great time for a check-up. Want us to book you in? Reply "book" and we'll sort it out. 💙`;
}

export const POST = withRoute("admin.reminders.send.POST", adminRemindersSendPOST);

async function adminRemindersSendPOST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  let body: { phone?: string; name?: string; type?: string; balance?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const phoneRaw = String(body.phone ?? "").trim();
  const type = body.type === "recall" ? "recall" : body.type === "payment" ? "payment" : null;
  if (!phoneRaw) return NextResponse.json({ error: "phone_required" }, { status: 400 });
  if (!type) return NextResponse.json({ error: "bad_type" }, { status: 400 });

  const to = normalizePhone(phoneRaw).digits || phoneRaw.replace(/\D/g, "");
  if (tail(to).length < 8) return NextResponse.json({ error: "bad_phone" }, { status: 400 });

  const balance = Math.max(0, Number(body.balance) || 0);
  if (type === "payment" && balance <= 0) {
    return NextResponse.json({ error: "no_balance" }, { status: 400 });
  }

  const lang = await preferredLang(to);
  const message = buildMessage(type, String(body.name ?? ""), balance, lang);
  const kind = type === "payment" ? "reminder" : "recall";

  const res = await sendProactive({ phone: to, body: message, kind });
  return NextResponse.json({ ok: res.ok, status: res.status, provider: res.provider });
}
