/**
 * Proactive WhatsApp sends from the clinic to a patient (payment reminders,
 * recall/reactivation campaigns). Centralizes: resolving the best chat id to
 * reach the patient, queueing the message for the worker, and logging it into
 * the doctor's Client Messages inbox so the conversation stays in one place.
 *
 * Unlike a manual reply, these do NOT pause the booking bot — a patient who
 * answers "yes, book me" should flow straight into the WhatsApp booking menu.
 */
import { prisma } from "@/lib/db";
import { normalizePhone } from "./phone";
import { sendWhatsApp } from "./whatsapp";
import { logChat } from "./followups";

const tail = (p: string) => (p || "").replace(/\D/g, "").slice(-9);

/**
 * Find the exact whatsapp-web.js chat id to reach this phone, matching the
 * trailing digits across chat history, live conversations and appointments.
 * Returns null when we only know the plain number (the worker then resolves it).
 */
export async function resolveChatId(phone: string): Promise<string | null> {
  const to = normalizePhone(phone).digits || phone.replace(/\D/g, "");
  const t = tail(to);
  if (t.length < 8) return null;
  const sameNumber = (raw: string) => normalizePhone(raw).digits === to || tail(raw) === t;

  const cm = await prisma.chatMessage.findMany({
    where: { phone: { contains: t }, chatId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { phone: true, chatId: true },
  });
  const fromChat = cm.find((c) => sameNumber(c.phone))?.chatId;
  if (fromChat) return fromChat;

  const conv = await prisma.waConversation.findMany({
    where: { phone: { contains: t }, chatId: { not: null } },
    select: { phone: true, chatId: true },
  });
  const fromConv = conv.find((c) => sameNumber(c.phone))?.chatId;
  if (fromConv) return fromConv;

  const appts = await prisma.appointment.findMany({
    where: { phone: { contains: t }, waChatId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { phone: true, waChatId: true },
  });
  return appts.find((a) => sameNumber(a.phone))?.waChatId ?? null;
}

/**
 * Send a proactive message to a patient and record it in the inbox.
 * `kind` tags the message (e.g. "reminder", "recall") for later reporting.
 */
export async function sendProactive(input: {
  phone: string;
  body: string;
  kind: string;
}): Promise<{ ok: boolean; status: string; provider: string }> {
  const to = normalizePhone(input.phone).digits || input.phone.replace(/\D/g, "");
  const chatId = await resolveChatId(to);
  const res = await sendWhatsApp({ to, body: input.body, chatId });
  await logChat({ phone: to, chatId, direction: "out", body: input.body, kind: input.kind });
  return { ok: res.ok, status: res.status, provider: res.provider };
}

/**
 * Map of phone-tail -> most recent outbound ChatMessage time for a given kind.
 * Used to show "last reminded / last recalled" without a schema change.
 */
export async function lastOutboundByKind(kind: string): Promise<Map<string, string>> {
  const rows = await prisma.chatMessage.findMany({
    where: { direction: "out", kind },
    orderBy: { createdAt: "desc" },
    select: { phone: true, createdAt: true },
  });
  const map = new Map<string, string>();
  for (const r of rows) {
    const t = tail(r.phone);
    if (t.length >= 8 && !map.has(t)) map.set(t, r.createdAt.toISOString());
  }
  return map;
}
