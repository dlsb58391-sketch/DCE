"use client";

import { useLang } from "@/lib/language";
import {
  type Appointment,
  dayTimeline,
  fmtDateLong,
  fmtTime,
  sessionTypeById,
  tint,
  isClosed,
  clinic,
} from "@/lib/dashboard";

function StatusBadge({ status }: { status: Appointment["status"] }) {
  const { tr } = useLang();
  const map = {
    confirmed: {
      cls: "bg-emerald-500/10 text-emerald-700 border-emerald-500/25",
      label: { en: "Confirmed", ar: "مؤكد" },
    },
    pending: {
      cls: "bg-amber-500/10 text-amber-700 border-amber-500/25",
      label: { en: "Pending", ar: "بانتظار" },
    },
  } as const;
  const s = map[status];
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.cls}`}>
      {tr(s.label)}
    </span>
  );
}

export function DaySchedule({
  base,
  dayOffset,
  appointments,
  onFinish,
  onBookSlot,
}: {
  base: Date;
  dayOffset: number;
  appointments: Appointment[];
  onFinish?: (code: string) => void;
  onBookSlot?: (slot: { dayOffset: number; startMin: number }) => void;
}) {
  const { tr, lang } = useLang();
  const dayAppts = appointments.filter((a) => a.dayOffset === dayOffset);
  const timeline = dayTimeline(dayAppts);
  const closed = isClosed(base, dayOffset);
  const freeCount = timeline.filter((e) => e.kind === "free").length;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-primary/12 bg-surface">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/10 p-5">
        <div>
          <h2 className="text-lg font-bold text-ink">
            {tr({ en: "Daily Schedule", ar: "جدول اليوم" })}
          </h2>
          <p className="mt-0.5 text-sm capitalize text-muted">
            {fmtDateLong(base, dayOffset, lang)}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary">
            {dayAppts.length} {tr({ en: "sessions", ar: "جلسة" })}
          </span>
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-emerald-700">
            {freeCount} {tr({ en: "free", ar: "متاح" })}
          </span>
        </div>
      </div>

      {/* timeline */}
      <div className="custom-scroll flex-1 space-y-2.5 overflow-y-auto p-4">
        {closed && dayAppts.length === 0 ? (
          <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-muted">
            <svg viewBox="0 0 24 24" className="h-10 w-10 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12h8" strokeLinecap="round" />
            </svg>
            <p className="mt-3 font-semibold">{tr({ en: "Clinic closed", ar: "العيادة مغلقة" })}</p>
            <p className="text-sm">{tr({ en: "Day off", ar: "يوم إجازة" })}</p>
          </div>
        ) : (
          timeline.map((e, i) => {
            if (e.kind === "free") {
              return (
                <button
                  key={`free-${i}`}
                  type="button"
                  onClick={() => onBookSlot?.({ dayOffset, startMin: e.startMin })}
                  disabled={!onBookSlot}
                  className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/15 px-4 py-2.5 text-start transition hover:border-primary/40 hover:bg-primary/5 disabled:cursor-default disabled:hover:border-primary/15 disabled:hover:bg-transparent"
                >
                  <span className="w-20 shrink-0 text-xs font-semibold text-muted">
                    {fmtTime(base, dayOffset, e.startMin, lang)}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-muted/70">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    {tr({ en: "Available", ar: "موعد متاح" })}
                  </span>
                </button>
              );
            }
            const type = sessionTypeById(e.appt.typeId);
            const done = !!e.appt.done;
            const canFinish = !!onFinish && !!e.appt.code && !!e.appt.online && !done && e.appt.status === "confirmed";
            return (
              <div
                key={e.appt.id}
                className={`flex items-stretch gap-3 rounded-xl border p-3 transition hover:shadow-sm ${done ? "opacity-60" : ""}`}
                style={{
                  borderColor: tint(type.color, 0.35),
                  background: tint(type.color, 0.07),
                  borderInlineStartWidth: "5px",
                  borderInlineStartColor: type.color,
                }}
              >
                {/* time column */}
                <div className="flex w-16 shrink-0 flex-col justify-center text-center">
                  <span className="text-sm font-bold text-ink">
                    {fmtTime(base, dayOffset, e.startMin, lang)}
                  </span>
                  <span className="text-[11px] text-muted">
                    {fmtTime(base, dayOffset, e.endMin, lang)}
                  </span>
                </div>

                {/* solid color-coded type icon */}
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-sm"
                  style={{ backgroundColor: type.color }}
                  title={tr(type.label)}
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={type.icon} />
                  </svg>
                </div>

                {/* details */}
                <div className="min-w-0 flex-1">
                  {/* session type as the headline */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-extrabold text-white shadow-sm"
                      style={{ backgroundColor: type.color }}
                    >
                      {tr(type.label)}
                    </span>
                    {done ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        {tr({ en: "Done", ar: "تمت" })}
                      </span>
                    ) : (
                      <StatusBadge status={e.appt.status} />
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className="truncate font-bold text-ink">{tr(e.appt.patient)}</p>
                    <span className="shrink-0 text-[11px] font-semibold text-muted">
                      {type.durationMin} {tr({ en: "min", ar: "د" })}
                    </span>
                  </div>
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted" dir="ltr">
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 4h3l1.5 5-2 1.5a12 12 0 0 0 5 5l1.5-2 5 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
                    </svg>
                    {e.appt.phone}
                  </span>
                  {e.appt.doctorName && (
                    <span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-primary">
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
                      </svg>
                      {tr({ en: "Dr.", ar: "د." })} {e.appt.doctorName}
                    </span>
                  )}
                  {canFinish && (
                    <button
                      onClick={() => onFinish!(e.appt.code!)}
                      className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      {tr({ en: "Finish session", ar: "إنهاء الجلسة" })}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* footer legend */}
      <div className="flex items-center gap-4 border-t border-primary/10 px-5 py-3 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          {tr({ en: "Available slot", ar: "موعد متاح" })}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          {tr({ en: "Booked session", ar: "جلسة محجوزة" })}
        </span>
        <span className="ms-auto">
          {tr({ en: "Working hours", ar: "مواعيد العمل" })}:{" "}
          {fmtTime(base, dayOffset, clinic.openMin, lang)} –{" "}
          {fmtTime(base, dayOffset, clinic.closeMin, lang)}
        </span>
      </div>
    </div>
  );
}
