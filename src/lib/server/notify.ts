import type { Appointment } from "@prisma/client";
import { prisma } from "@/lib/db";
import { sendWhatsApp } from "./whatsapp";
import { buildMessage, buildTemplate, type MsgKind, type MsgCtx } from "./messages";
import { normalizePhone } from "./phone";

/** Build, send (per provider) and persist a WhatsApp message for an appointment. */
export async function dispatchMessage(appt: Appointment, kind: MsgKind, ctx: MsgCtx = {}) {
  const body = buildMessage(kind, appt, ctx);
  const template = buildTemplate(kind, appt, ctx);
  const to = normalizePhone(appt.phone).digits;
  const res = await sendWhatsApp({ to, body, template, chatId: appt.waChatId ?? null });

  return prisma.message.create({
    data: {
      appointmentId: appt.id,
      phone: to,
      kind,
      body,
      provider: res.provider,
      status: res.status,
      waLink: res.waLink ?? null,
      error: res.error ?? null,
      sentAt: res.status === "sent" ? new Date() : null,
    },
  });
}
