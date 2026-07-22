"use client";

import { useLang } from "@/lib/language";
import { useSite, type Lead } from "@/lib/siteStore";
import { site } from "@/lib/site";
import {
  type BookingRequest,
  sessionTypeById,
  fmtTime,
  fmtDateLong,
  hhmmToMin,
  formatAgo,
  initials,
  tint,
} from "@/lib/dashboard";

function LeadCard({
  base,
  lead,
  onConfirm,
  onDecline,
}: {
  base: Date;
  lead: Lead;
  onConfirm: (lead: Lead) => void;
  onDecline: (lead: Lead) => void;
}) {
  const { tr, lang } = useLang();
  const mins = Math.max(0, Math.round((Date.now() - lead.createdAt) / 60000));
  const done = lead.status === "seen";
  const type = lead.serviceId ? sessionTypeById(lead.serviceId) : null;
  const hasSlot = lead.dayOffset != null && lead.start;

  // One-tap WhatsApp: prefilled "reserved" confirmation + live tracker link.
  const waDigits = lead.phone.replace(/\D/g, "").replace(/^0/, "20");
  const trackUrl =
    lead.trackCode && typeof window !== "undefined"
      ? `${window.location.origin}/track/${lead.trackCode}`
      : "";
  const waText = tr({
    en: `Hi ${lead.name || "there"}, your appointment at ${site.name} is reserved \u2705${trackUrl ? `\nTrack it live: ${trackUrl}` : ""}`,
    ar: `\u0623\u0647\u0644\u0627\u064b ${lead.name || ""}\u060c \u062a\u0645 \u062d\u062c\u0632 \u0645\u0648\u0639\u062f\u0643 \u0641\u064a ${site.nameAr} \u2705${trackUrl ? `\n\u062a\u0627\u0628\u0639\u0647 \u0645\u0628\u0627\u0634\u0631\u0629: ${trackUrl}` : ""}`,
  });
  const waHref = `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}`;

  return (
    <div className={`rounded-2xl border p-4 transition ${done ? "border-primary/8 opacity-60" : "border-primary/30 bg-primary/[0.04]"}`}>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
          {initials(lead.name || "?")}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-bold text-ink">{lead.name || tr({ en: "Unknown", ar: "غير معروف" })}</p>
            <span className="shrink-0 text-[11px] text-muted">{formatAgo(mins, lang)}</span>
          </div>
          <a href={`tel:${lead.phone.replace(/\s/g, "")}`} dir="ltr" className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted transition hover:text-primary">
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h3l1.5 5-2 1.5a12 12 0 0 0 5 5l1.5-2 5 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
            </svg>
            {lead.phone}
          </a>
        </div>
      </div>

      {/* requested service + slot */}
      {(type || hasSlot) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          {type && (
            <span
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-bold text-white"
              style={{ backgroundColor: type.color }}
            >
              {tr(type.label)}
            </span>
          )}
          {hasSlot && (
            <>
              <span className="inline-flex items-center gap-1.5 text-muted">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4.5" width="18" height="17" rx="2" />
                  <path d="M3 9h18M8 2.5v4M16 2.5v4" />
                </svg>
                <span className="capitalize text-ink/90">{fmtDateLong(base, lead.dayOffset!, lang)}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7.5V12l3 2" />
                </svg>
                <span className="text-ink/90">{fmtTime(base, lead.dayOffset!, hhmmToMin(lead.start!), lang)}</span>
              </span>
            </>
          )}
        </div>
      )}

      {lead.offerTitle && (
        <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-primary/12 px-2.5 py-1 text-xs font-bold text-primary">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12v8H4v-8M2 7h20v5H2zM12 7v13M12 7S10.5 3 8 3a2 2 0 0 0 0 4M12 7s1.5-4 4-4a2 2 0 0 1 0 4" />
          </svg>
          {tr({ en: "Offer: ", ar: "عرض: " })}{tr(lead.offerTitle)}
        </div>
      )}

      {lead.message && (
        <p className="mt-2 rounded-lg border border-primary/10 bg-background/40 p-2.5 text-sm text-ink/90">
          {lead.message}
        </p>
      )}

      {done ? (
        <div className="mt-3 space-y-2.5">
          <p className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            {tr({ en: "Confirmed & added to clients", ar: "تم التأكيد وأُضيف للعملاء" })}
          </p>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.7-.1l.9-1c.2-.3.4-.2.7-.1l2 .9c.3.2.5.2.6.4.1.1.1.7-.1 1.2Z" /></svg>
            {tr({ en: "Send WhatsApp confirmation", ar: "إرسال تأكيد واتساب" })}
          </a>
          {lead.trackCode && (
            <a href={`/track/${lead.trackCode}`} target="_blank" rel="noopener noreferrer" className="block text-center text-[11px] font-medium text-muted transition hover:text-primary">
              {tr({ en: "View live tracker", ar: "عرض المتابعة المباشرة" })} · <span className="font-mono font-bold tracking-widest text-ink">{lead.trackCode}</span>
            </a>
          )}
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <button onClick={() => onConfirm(lead)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-3 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            {tr({ en: "Confirm", ar: "تأكيد" })}
          </button>
          <button onClick={() => onDecline(lead)} className="flex items-center justify-center rounded-lg border border-primary/15 px-3 py-2 text-sm font-semibold text-muted transition hover:border-rose-400/40 hover:text-rose-600">
            {tr({ en: "Decline", ar: "رفض" })}
          </button>
        </div>
      )}
    </div>
  );
}

function RequestCard({
  base,
  req,
  onConfirm,
  onDecline,
}: {
  base: Date;
  req: BookingRequest;
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
}) {
  const { tr, lang } = useLang();
  const type = sessionTypeById(req.typeId);
  const decided = req.status !== "new";

  return (
    <div
      className={`rounded-2xl border bg-surface-2 p-4 transition ${
        decided ? "border-primary/8 opacity-60" : "border-primary/12 hover:border-primary/25"
      }`}
    >
      {/* head */}
      <div className="flex items-start gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold"
          style={{ backgroundColor: tint(type.color, 0.16), color: type.color }}
        >
          {initials(req.patient.en)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-bold text-ink">{tr(req.patient)}</p>
            <span className="shrink-0 text-[11px] text-muted">
              {formatAgo(req.createdAgoMin, lang)}
            </span>
          </div>
          <a
            href={`tel:${req.phone.replace(/\s/g, "")}`}
            dir="ltr"
            className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted transition hover:text-primary"
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 4h3l1.5 5-2 1.5a12 12 0 0 0 5 5l1.5-2 5 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
            </svg>
            {req.phone}
          </a>
        </div>
      </div>

      {/* complaint */}
      <div className="mt-3 rounded-xl border border-primary/8 bg-background/40 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">
          {tr({ en: "Chief complaint", ar: "الشكوى" })}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-ink/90">{tr(req.complaint)}</p>
      </div>

      {/* chosen slot */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span
          className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
          style={{ backgroundColor: tint(type.color, 0.14), color: type.color }}
        >
          {tr(type.label)}
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4.5" width="18" height="17" rx="2" />
            <path d="M3 9h18M8 2.5v4M16 2.5v4" />
          </svg>
          <span className="capitalize text-ink/90">{fmtDateLong(base, req.dayOffset, lang)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-primary" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.5V12l3 2" />
          </svg>
          <span className="text-ink/90">{fmtTime(base, req.dayOffset, hhmmToMin(req.start), lang)}</span>
        </span>
      </div>

      {/* actions */}
      {decided ? (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold">
          {req.status === "confirmed" ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {tr({ en: "Added to schedule", ar: "أُضيف للجدول" })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-rose-600">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
              {tr({ en: "Declined", ar: "مرفوض" })}
            </span>
          )}
        </div>
      ) : (
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onConfirm(req.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-3 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/25"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            {tr({ en: "Confirm", ar: "تأكيد" })}
          </button>
          <button
            onClick={() => onDecline(req.id)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/15 px-3 py-2 text-sm font-semibold text-muted transition hover:border-rose-400/40 hover:text-rose-600"
          >
            {tr({ en: "Decline", ar: "رفض" })}
          </button>
        </div>
      )}
    </div>
  );
}

export function BookingRequests({
  base,
  requests,
  extraLeads = [],
  onConfirm,
  onDecline,
  onLeadConfirm,
  onLeadDecline,
}: {
  base: Date;
  requests: BookingRequest[];
  extraLeads?: Lead[];
  onConfirm: (id: string) => void;
  onDecline: (id: string) => void;
  onLeadConfirm: (lead: Lead) => void;
  onLeadDecline: (lead: Lead) => void;
}) {
  const { tr } = useLang();
  const { leads } = useSite();
  // Website leads (in-memory) + DB-backed WhatsApp/website bookings, newest first.
  const sortedLeads = [...leads, ...extraLeads].sort((a, b) => b.createdAt - a.createdAt);
  const sorted = [...requests].sort((a, b) => a.createdAgoMin - b.createdAgoMin);
  const newCount =
    requests.filter((r) => r.status === "new").length +
    leads.filter((l) => l.status === "new").length +
    extraLeads.length;

  const empty = sorted.length === 0 && sortedLeads.length === 0;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-primary/12 bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-primary/10 p-5">
        <div>
          <h2 className="text-lg font-bold text-ink">
            {tr({ en: "Recent Bookings", ar: "أحدث الحجوزات" })}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {tr({ en: "Patient requests to review", ar: "طلبات المرضى للمراجعة" })}
          </p>
        </div>
        {newCount > 0 && (
          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-primary px-2 text-xs font-bold text-[#0a0e12]">
            {newCount}
          </span>
        )}
      </div>

      <div className="custom-scroll flex-1 space-y-3 overflow-y-auto p-4">
        {empty ? (
          <p className="py-10 text-center text-sm text-muted">
            {tr({ en: "No booking requests.", ar: "لا توجد حجوزات." })}
          </p>
        ) : (
          <>
            {sortedLeads.length > 0 && (
              <>
                <p className="flex items-center gap-2 px-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 5h16v10H7l-3 3V5Z" />
                  </svg>
                  {tr({ en: "Online requests", ar: "طلبات أونلاين" })}
                </p>
                {sortedLeads.map((lead) => (
                  <LeadCard key={lead.id} base={base} lead={lead} onConfirm={onLeadConfirm} onDecline={onLeadDecline} />
                ))}
                {sorted.length > 0 && (
                  <p className="px-1 pt-1 text-[11px] font-bold uppercase tracking-wide text-muted">
                    {tr({ en: "Scheduled requests", ar: "طلبات مجدولة" })}
                  </p>
                )}
              </>
            )}
            {sorted.map((req) => (
              <RequestCard
                key={req.id}
                base={base}
                req={req}
                onConfirm={onConfirm}
                onDecline={onDecline}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
