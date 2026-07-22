/** WhatsApp delivery layer. Swappable providers behind one function. */

import type { TemplateSpec } from "./messages";

export type WaResult = {
  ok: boolean;
  provider: string;
  status: "sent" | "queued" | "failed";
  waLink?: string;
  error?: string;
};

/** Build a click-to-chat link that opens WhatsApp with the message pre-filled. */
export function waMeLink(digits: string, text: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Are templates enabled for the Meta Cloud provider? (default yes) */
export function templatesEnabled(): boolean {
  return (process.env.WHATSAPP_USE_TEMPLATES ?? "1") !== "0";
}

/**
 * Build the exact JSON body POSTed to the Meta WhatsApp Cloud API.
 * Pure + exported so it can be unit-tested without real credentials.
 *
 * - With a template (required for business-initiated messages): type "template".
 * - Without (e.g. inside a 24h service window, or templates disabled): type "text".
 */
export function buildMetaPayload(
  to: string,
  text: string,
  template?: TemplateSpec | null
): Record<string, unknown> {
  if (template && templatesEnabled()) {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.languageCode },
        components: template.bodyParams.length
          ? [
              {
                type: "body",
                parameters: template.bodyParams.map((t) => ({ type: "text", text: t })),
              },
            ]
          : [],
      },
    };
  }
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { preview_url: true, body: text },
  };
}

/**
 * Send a WhatsApp message. Provider chosen by WHATSAPP_PROVIDER:
 * - "metaCloud": real send via Meta WhatsApp Cloud API (uses templates by default).
 * - "wa":        no auto-send; returns a wa.me link for one-tap manual sending.
 * - "mock":      pretend-send (logs only) — default for dev so the flow is testable.
 */
export async function sendWhatsApp({
  to,
  body,
  template,
  chatId,
}: {
  to: string;
  body: string;
  template?: TemplateSpec | null;
  chatId?: string | null;
}): Promise<WaResult> {
  const provider = process.env.WHATSAPP_PROVIDER || "mock";
  const link = waMeLink(to, body);

  if (provider === "metaCloud") {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    const version = process.env.WHATSAPP_API_VERSION || "v21.0";
    if (!token || !phoneId) {
      return { ok: false, provider, status: "failed", error: "WHATSAPP_TOKEN/PHONE_ID missing", waLink: link };
    }
    try {
      const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(buildMetaPayload(to, body, template)),
      });
      if (!res.ok) {
        const t = await res.text();
        return { ok: false, provider, status: "failed", error: t.slice(0, 500), waLink: link };
      }
      return { ok: true, provider, status: "sent", waLink: link };
    } catch (e) {
      return { ok: false, provider, status: "failed", error: String((e as Error)?.message ?? e), waLink: link };
    }
  }

  if (provider === "wa") {
    // Manual one-tap mode: the dashboard surfaces the link; nothing auto-sends.
    return { ok: true, provider: "wa", status: "queued", waLink: link };
  }

  if (provider === "waweb") {
    // Unofficial WhatsApp-Web worker: queue the message; the worker polls the
    // outbox, sends it over the linked number, and marks it sent.
    try {
      const { prisma } = await import("@/lib/db");
      await prisma.waOutbox.create({ data: { phone: to, chatId: chatId ?? null, body, status: "queued" } });
      return { ok: true, provider: "waweb", status: "queued", waLink: link };
    } catch (e) {
      return { ok: false, provider: "waweb", status: "failed", error: String((e as Error)?.message ?? e), waLink: link };
    }
  }

  // mock
  return { ok: true, provider: "mock", status: "sent", waLink: link };
}
