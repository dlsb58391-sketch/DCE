import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { normalizePhone } from "@/lib/server/phone";
import { sendWhatsApp } from "@/lib/server/whatsapp";
import { logChat } from "@/lib/server/followups";
import { nameByPhone } from "@/lib/server/patient-names";
import { withRoute } from "@/lib/server/http";

const tail = (p: string) => (p || "").replace(/\D/g, "").slice(-9);

/** Pause the booking bot for this long after the doctor sends a manual reply. */
const PAUSE_MINUTES = 12 * 60;

/**
 * Detect a message whose text was mangled by a broken (non-UTF-8) encoder — it
 * shows up as mostly "?" placeholders (e.g. Arabic turned into "?????? ?????").
 * We refuse to send these so a garbled message never reaches a patient.
 */
function looksCorrupted(text: string): boolean {
  const q = (text.match(/\?/g) || []).length;
  const nonSpace = text.replace(/\s/g, "").length;
  return q >= 5 && nonSpace > 0 && q / nonSpace > 0.5;
}


export const GET = withRoute("admin.chats.GET", adminChatsGET);

async function adminChatsGET(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const phoneParam = new URL(req.url).searchParams.get("phone");

  // ---- Single conversation thread ----
  if (phoneParam) {
    const key = normalizePhone(phoneParam).digits || phoneParam.replace(/\D/g, "");
    const t = tail(key);
    const messages = await prisma.chatMessage.findMany({
      where: t.length >= 8 ? { phone: { contains: t } } : { phone: key },
      orderBy: { createdAt: "asc" },
      take: 500,
    });

    // Mark inbound messages as read.
    const unreadIds = messages.filter((m) => m.direction === "in" && !m.readAt).map((m) => m.id);
    if (unreadIds.length) {
      await prisma.chatMessage.updateMany({ where: { id: { in: unreadIds } }, data: { readAt: new Date() } });
    }

    const names = await nameByPhone();
    return NextResponse.json({
      phone: key,
      name: names.get(t) ?? `+${key}`,
      messages: messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        body: m.body,
        kind: m.kind,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  }

  // ---- Conversation list ----
  const recent = await prisma.chatMessage.findMany({ orderBy: { createdAt: "desc" }, take: 1000 });
  const names = await nameByPhone();

  const byPhone = new Map<
    string,
    { phone: string; name: string; lastBody: string; lastAt: string; lastDir: string; unread: number; chatId: string | null }
  >();
  for (const m of recent) {
    const t = tail(m.phone);
    const existing = byPhone.get(m.phone);
    if (!existing) {
      byPhone.set(m.phone, {
        phone: m.phone,
        name: names.get(t) ?? `+${m.phone}`,
        lastBody: m.body,
        lastAt: m.createdAt.toISOString(),
        lastDir: m.direction,
        unread: m.direction === "in" && !m.readAt ? 1 : 0,
        chatId: m.chatId ?? null,
      });
    } else {
      if (m.direction === "in" && !m.readAt) existing.unread += 1;
      if (!existing.chatId && m.chatId) existing.chatId = m.chatId;
    }
  }

  const conversations = [...byPhone.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  const totalUnread = conversations.reduce((n, c) => n + c.unread, 0);
  return NextResponse.json({ conversations, totalUnread });
}

export const POST = withRoute("admin.chats.POST", adminChatsPOST);

async function adminChatsPOST(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  let body: { phone?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const text = String(body.text ?? "").trim();
  const phoneRaw = String(body.phone ?? "").trim();
  if (!phoneRaw || !text) return NextResponse.json({ error: "missing phone or text" }, { status: 400 });
  if (looksCorrupted(text)) {
    return NextResponse.json({ error: "text_encoding_corrupted" }, { status: 400 });
  }

  const to = normalizePhone(phoneRaw).digits || phoneRaw.replace(/\D/g, "");
  const t = tail(to);

  // Find the best chat id to reply to. Match the EXACT normalized phone (loose
  // substring matching could grab a different patient's chat id and misroute the
  // message). Candidates are fetched by tail, then filtered to an exact match.
  const sameNumber = (raw: string) => normalizePhone(raw).digits === to || tail(raw) === t;

  let chatId: string | null = null;
  const cmCandidates = await prisma.chatMessage.findMany({
    where: { phone: { contains: t }, chatId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { phone: true, chatId: true },
  });
  chatId = cmCandidates.find((c) => sameNumber(c.phone))?.chatId ?? null;

  if (!chatId) {
    const convs = await prisma.waConversation.findMany({
      where: { phone: { contains: t }, chatId: { not: null } },
      select: { phone: true, chatId: true },
    });
    chatId = convs.find((c) => sameNumber(c.phone))?.chatId ?? null;
  }
  if (!chatId) {
    const appts = await prisma.appointment.findMany({
      where: { phone: { contains: t }, waChatId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { phone: true, waChatId: true },
    });
    chatId = appts.find((a) => sameNumber(a.phone))?.waChatId ?? null;
  }

  const res = await sendWhatsApp({ to, body: text, chatId });
  await logChat({ phone: to, chatId, direction: "out", body: text, kind: "manual" });

  // Pause the booking bot so the patient's replies don't trigger auto-menus
  // while the doctor is chatting manually.
  const pausedUntil = new Date(Date.now() + PAUSE_MINUTES * 60000);
  await prisma.waConversation.upsert({
    where: { phone: to },
    create: { phone: to, chatId, state: "idle", agentPausedUntil: pausedUntil },
    update: { agentPausedUntil: pausedUntil, chatId: chatId ?? undefined },
  });

  return NextResponse.json({ ok: true, status: res.status, provider: res.provider });
}
