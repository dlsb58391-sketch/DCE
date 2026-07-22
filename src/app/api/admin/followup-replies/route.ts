import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { nameByPhone, phoneTail } from "@/lib/server/patient-names";
import { withRoute } from "@/lib/server/http";

/**
 * Admin: the post-session follow-up (متابعة) replies that still need attention.
 *
 * When a patient answers the automatic "how are you feeling after your visit?"
 * message, that inbound reply is logged with kind="reply". It stays unread until
 * the doctor opens the chat thread (which marks it read). This endpoint returns
 * those unread replies grouped by client so the dashboard can show one prominent
 * alert per patient. Opening the client's chat clears the alert.
 */
export const GET = withRoute("admin.followup-replies.GET", adminFollowuprepliesGET);

async function adminFollowuprepliesGET() {
  const { error } = await requireSession();
  if (error) return error;

  const rows = await prisma.chatMessage.findMany({
    where: { direction: "in", kind: "reply", readAt: null },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const names = await nameByPhone();

  type Alert = {
    phone: string;
    name: string;
    chatId: string | null;
    lastBody: string;
    lastAt: string;
    count: number;
  };
  const byClient = new Map<string, Alert>();
  for (const m of rows) {
    const t = phoneTail(m.phone);
    const key = t.length >= 8 ? t : m.phone;
    const existing = byClient.get(key);
    if (!existing) {
      byClient.set(key, {
        phone: m.phone,
        name: names.get(t) ?? `+${m.phone}`,
        chatId: m.chatId ?? null,
        lastBody: m.body,
        lastAt: m.createdAt.toISOString(),
        count: 1,
      });
    } else {
      existing.count += 1;
      if (!existing.chatId && m.chatId) existing.chatId = m.chatId;
    }
  }

  const replies = [...byClient.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  return NextResponse.json({ replies, total: replies.length });
}
