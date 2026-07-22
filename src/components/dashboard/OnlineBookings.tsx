"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { site } from "@/lib/site";

type Msg = { id: string; kind: string; status: string; createdAt: string };
type Appt = {
  id: string;
  code: string;
  patientName: string;
  phone: string;
  serviceLabelEn: string;
  serviceLabelAr: string;
  scheduledAt: string;
  status: string;
  stage: string;
  minutesUntil: number;
  complaint?: string | null;
  offerTitle?: string | null;
  messages: Msg[];
};

const STAGE_STYLE: Record<string, string> = {
  pending: "bg-slate-100 text-slate-600",
  reserved: "bg-emerald-100 text-emerald-700",
  reminder: "bg-amber-100 text-amber-700",
  queue: "bg-rose-100 text-rose-700",
  turn: "bg-green-100 text-green-700",
  completed: "bg-primary/15 text-primary",
  declined: "bg-rose-100 text-rose-600",
  cancelled: "bg-slate-100 text-slate-500",
};

const STAGE_LABEL: Record<string, { en: string; ar: string }> = {
  pending: { en: "Awaiting confirmation", ar: "بانتظار التأكيد" },
  reserved: { en: "Reserved", ar: "محجوز" },
  reminder: { en: "Reminder sent", ar: "تم التذكير" },
  queue: { en: "In live queue", ar: "في الطابور" },
  turn: { en: "It's their turn", ar: "حان دوره" },
  completed: { en: "Completed", ar: "مكتمل" },
  declined: { en: "Declined", ar: "مرفوض" },
  cancelled: { en: "Cancelled", ar: "ملغي" },
};

export function OnlineBookings() {
  const { tr, lang } = useLang();
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/appointments", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setAppts(j.appointments ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 12000);
    return () => clearInterval(id);
  }, [load]);

  const act = async (code: string, action: "confirm" | "decline" | "complete") => {
    setBusy(code + action);
    try {
      await fetch(`/api/admin/appointments/${code}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const fmtWhen = (iso: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Cairo",
    }).format(new Date(iso));

  const waHref = (a: Appt) => {
    const digits = a.phone.replace(/\D/g, "").replace(/^0/, "20");
    const track = typeof window !== "undefined" ? `${window.location.origin}/track/${a.code}` : "";
    const text = tr({
      en: `Hi ${a.patientName}, your appointment at ${site.name} is reserved \u2705\nTrack it live: ${track}`,
      ar: `\u0623\u0647\u0644\u0627\u064b ${a.patientName}\u060c \u062a\u0645 \u062d\u062c\u0632 \u0645\u0648\u0639\u062f\u0643 \u2705\n\u062a\u0627\u0628\u0639\u0647: ${track}`,
    });
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  };

  const pending = appts.filter((a) => a.status === "pending");
  const active = appts.filter((a) => a.status === "confirmed");
  const past = appts.filter((a) => a.status === "completed" || a.status === "declined" || a.status === "cancelled");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">
            {tr({ en: "Online Bookings", ar: "الحجوزات الأونلاين" })}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {tr({
              en: "Live from the website — confirm to send the WhatsApp & start the queue.",
              ar: "مباشرة من الموقع — أكّد لإرسال الواتساب وبدء الطابور.",
            })}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          {tr({ en: "Live", ar: "مباشر" })}
        </span>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-muted">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : appts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-primary/20 bg-surface py-16 text-center text-sm text-muted">
          {tr({ en: "No online bookings yet. They'll appear here in real time.", ar: "لا توجد حجوزات أونلاين بعد. ستظهر هنا فورًا." })}
        </div>
      ) : (
        <>
          {pending.length > 0 && (
            <Section title={tr({ en: "New — needs your confirmation", ar: "جديدة — بحاجة لتأكيدك" })} count={pending.length}>
              {pending.map((a) => (
                <Card key={a.id} a={a} tr={tr} lang={lang} fmtWhen={fmtWhen}>
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => act(a.code, "confirm")}
                      disabled={busy === a.code + "confirm"}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-3 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 disabled:opacity-60"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      {tr({ en: "Confirm & notify", ar: "تأكيد وإشعار" })}
                    </button>
                    <button
                      onClick={() => act(a.code, "decline")}
                      disabled={busy === a.code + "decline"}
                      className="rounded-lg border border-primary/15 px-3 py-2 text-sm font-semibold text-muted transition hover:border-rose-400/40 hover:text-rose-600 disabled:opacity-60"
                    >
                      {tr({ en: "Decline", ar: "رفض" })}
                    </button>
                  </div>
                </Card>
              ))}
            </Section>
          )}

          {active.length > 0 && (
            <Section title={tr({ en: "Confirmed — live status", ar: "مؤكدة — الحالة المباشرة" })} count={active.length}>
              {active.map((a) => (
                <Card key={a.id} a={a} tr={tr} lang={lang} fmtWhen={fmtWhen}>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={waHref(a)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Z" /></svg>
                      WhatsApp
                    </a>
                    <a
                      href={`/track/${a.code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/5"
                    >
                      {tr({ en: "Live tracker", ar: "المتابعة" })}
                    </a>
                    <button
                      onClick={() => act(a.code, "complete")}
                      disabled={busy === a.code + "complete"}
                      className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-ink disabled:opacity-60"
                    >
                      {tr({ en: "Mark done", ar: "تم" })}
                    </button>
                  </div>
                </Card>
              ))}
            </Section>
          )}

          {past.length > 0 && (
            <Section title={tr({ en: "Past", ar: "السابقة" })} count={past.length}>
              {past.slice(0, 10).map((a) => (
                <Card key={a.id} a={a} tr={tr} lang={lang} fmtWhen={fmtWhen} muted />
              ))}
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-muted">
        {title}
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary/15 px-1.5 text-primary">{count}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Card({
  a,
  tr,
  lang,
  fmtWhen,
  muted,
  children,
}: {
  a: Appt;
  tr: (b: { en: string; ar: string }) => string;
  lang: string;
  fmtWhen: (iso: string) => string;
  muted?: boolean;
  children?: React.ReactNode;
}) {
  const service = lang === "ar" ? a.serviceLabelAr : a.serviceLabelEn;
  return (
    <div className={`rounded-2xl border border-primary/12 bg-surface p-4 ${muted ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{a.patientName}</p>
          <a href={`tel:${a.phone.replace(/\s/g, "")}`} dir="ltr" className="text-xs text-muted transition hover:text-primary">
            {a.phone}
          </a>
        </div>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${STAGE_STYLE[a.stage] ?? "bg-slate-100 text-slate-600"}`}>
          {tr(STAGE_LABEL[a.stage] ?? { en: a.stage, ar: a.stage })}
        </span>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1 font-semibold text-ink/80">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4.5c-2-1.4-5-1.6-6.3.3-1.2 1.8-.6 4.3 0 6.6.5 1.9.3 3 .8 5.2.3 1.4.7 2.9 1.6 2.9 1.1 0 1.1-2 1.6-3.6.3-1 .8-1.7 1.3-1.7s1 .7 1.3 1.7c.5 1.6.5 3.6 1.6 3.6.9 0 1.3-1.5 1.6-2.9.5-2.2.3-3.3.8-5.2.6-2.3 1.2-4.8 0-6.6C17 2.9 14 3.1 12 4.5Z" /></svg>
          {service}
        </span>
        <span className="capitalize">{fmtWhen(a.scheduledAt)}</span>
        <span className="font-mono font-bold tracking-widest text-ink/70">{a.code}</span>
      </div>

      {a.complaint && <p className="mt-2 rounded-lg border border-primary/10 bg-background/50 p-2 text-xs text-ink/80">{a.complaint}</p>}

      {a.messages.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {a.messages.map((m) => (
            <span key={m.id} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
              <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Z" /></svg>
              {m.kind} ✓
            </span>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}
