"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/language";
import { sessionTypeById, tint, clinic } from "@/lib/dashboard";

type DbAppt = {
  code: string;
  patientName: string;
  phone: string;
  serviceId: string;
  serviceLabelEn: string;
  serviceLabelAr: string;
  scheduledAt: string;
  durationMin?: number;
  status: string;
  complaint?: string | null;
  doctorNameEn?: string | null;
  doctorNameAr?: string | null;
};

type CalItem = {
  code: string;
  date: Date;
  patient: string;
  phone: string;
  typeId: string;
  serviceLabel: { en: string; ar: string };
  status: string;
  doctorName?: string;
  complaint?: string | null;
};

const DAY_MS = 86400000;
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
// Week starts on Saturday (Egypt): Sat=0 … Fri=6.
const col = (d: Date) => (d.getDay() + 1) % 7;

const statusMeta: Record<string, { cls: string; label: { en: string; ar: string } }> = {
  confirmed: { cls: "bg-emerald-500/12 text-emerald-700 border-emerald-500/30", label: { en: "Confirmed", ar: "مؤكد" } },
  pending: { cls: "bg-amber-500/12 text-amber-700 border-amber-500/30", label: { en: "Pending", ar: "بانتظار" } },
  completed: { cls: "bg-slate-500/12 text-slate-600 border-slate-500/30", label: { en: "Completed", ar: "مكتمل" } },
};

export function CalendarSection() {
  const { tr, lang } = useLang();
  const locale = lang === "ar" ? "ar-EG" : "en-US";
  const today = useMemo(() => startOfDay(new Date()), []);

  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [items, setItems] = useState<CalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Date>(today);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/appointments", { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      const mapped: CalItem[] = ((j.appointments ?? []) as DbAppt[])
        .filter((a) => a.status !== "declined" && a.status !== "cancelled")
        .map((a) => ({
          code: a.code,
          date: new Date(a.scheduledAt),
          patient: a.patientName,
          phone: a.phone,
          typeId: a.serviceId,
          serviceLabel: { en: a.serviceLabelEn, ar: a.serviceLabelAr },
          status: a.status,
          doctorName: (lang === "ar" ? a.doctorNameAr : a.doctorNameEn) || a.doctorNameEn || a.doctorNameAr || undefined,
          complaint: a.complaint,
        }));
      setItems(mapped);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [lang]);

  useEffect(() => {
    load();
  }, [load]);

  const act = useCallback(
    async (code: string, action: "complete" | "decline") => {
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
    },
    [load]
  );

  // Build the visible month grid (leading blanks + all days).
  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const lead = col(first);
    const cells: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalItem[]>();
    for (const it of items) {
      if (it.date.getFullYear() !== cursor.getFullYear() || it.date.getMonth() !== cursor.getMonth()) continue;
      const k = startOfDay(it.date).getTime().toString();
      const arr = m.get(k) ?? [];
      arr.push(it);
      m.set(k, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.date.getTime() - b.date.getTime());
    return m;
  }, [items, cursor]);

  const monthStats = useMemo(() => {
    let total = 0,
      confirmed = 0,
      pending = 0,
      completed = 0;
    for (const arr of byDay.values())
      for (const it of arr) {
        total++;
        if (it.status === "confirmed") confirmed++;
        else if (it.status === "pending") pending++;
        else if (it.status === "completed") completed++;
      }
    return { total, confirmed, pending, completed };
  }, [byDay]);

  const selectedItems = byDay.get(startOfDay(selected).getTime().toString()) ?? [];
  const weekdays = useMemo(() => {
    // Saturday-first weekday short names in the active locale.
    const base = new Date(2026, 0, 3); // a Saturday
    return Array.from({ length: 7 }, (_, i) =>
      new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(base.getTime() + i * DAY_MS))
    );
  }, [locale]);

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(cursor);
  const fmtTime = (d: Date) => new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(d);
  const shift = (n: number) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + n, 1));
  const goToday = () => {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(today);
  };

  return (
    <div className="space-y-5">
      {/* header + stats */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shift(-1)}
            aria-label={tr({ en: "Previous month", ar: "الشهر السابق" })}
            className="grid h-9 w-9 place-items-center rounded-lg border border-primary/15 bg-surface text-ink transition hover:border-primary/40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <h2 className="min-w-[10rem] text-center text-lg font-extrabold capitalize text-ink">{monthLabel}</h2>
          <button
            onClick={() => shift(1)}
            aria-label={tr({ en: "Next month", ar: "الشهر التالي" })}
            className="grid h-9 w-9 place-items-center rounded-lg border border-primary/15 bg-surface text-ink transition hover:border-primary/40"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <button
            onClick={goToday}
            className="ms-1 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/20"
          >
            {tr({ en: "Today", ar: "اليوم" })}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary">
            {monthStats.total} {tr({ en: "sessions", ar: "جلسة" })}
          </span>
          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-emerald-700">
            {monthStats.confirmed} {tr({ en: "confirmed", ar: "مؤكد" })}
          </span>
          <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-amber-700">
            {monthStats.pending} {tr({ en: "pending", ar: "بانتظار" })}
          </span>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* month grid */}
        <div className="rounded-2xl border border-primary/12 bg-surface p-4 lg:col-span-2">
          <div className="grid grid-cols-7 gap-1.5">
            {weekdays.map((w, i) => (
              <div key={i} className="pb-1 text-center text-[11px] font-bold uppercase text-muted">
                {w}
              </div>
            ))}
            {grid.map((d, i) => {
              if (!d) return <div key={`b-${i}`} className="min-h-[4.5rem] rounded-lg" />;
              const dayItems = byDay.get(startOfDay(d).getTime().toString()) ?? [];
              const isToday = sameDay(d, today);
              const isSel = sameDay(d, selected);
              const closed = d.getDay() === clinic.closedWeekday;
              return (
                <button
                  key={d.getTime()}
                  onClick={() => setSelected(d)}
                  className={`flex min-h-[4.5rem] flex-col gap-1 rounded-lg border p-1.5 text-start transition ${
                    isSel ? "border-primary bg-primary/10" : "border-primary/10 hover:border-primary/30"
                  } ${closed ? "bg-rose-500/[0.04]" : ""}`}
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      isToday ? "bg-primary text-white" : "text-ink"
                    }`}
                  >
                    {new Intl.NumberFormat(locale).format(d.getDate())}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {dayItems.slice(0, 2).map((it) => {
                      const type = sessionTypeById(it.typeId);
                      return (
                        <span
                          key={it.code}
                          className="truncate rounded px-1 py-0.5 text-[10px] font-semibold leading-tight"
                          style={{ background: tint(type.color, 0.16), color: type.color, borderInlineStart: `2px solid ${type.color}` }}
                          title={`${fmtTime(it.date)} · ${it.patient}`}
                        >
                          {fmtTime(it.date)} {it.patient}
                        </span>
                      );
                    })}
                    {dayItems.length > 2 && (
                      <span className="ps-1 text-[10px] font-bold text-muted">
                        +{new Intl.NumberFormat(locale).format(dayItems.length - 2)} {tr({ en: "more", ar: "المزيد" })}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {loading && <p className="mt-3 text-center text-xs text-muted">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</p>}
        </div>

        {/* selected-day detail */}
        <div className="flex h-full flex-col rounded-2xl border border-primary/12 bg-surface">
          <div className="border-b border-primary/10 p-4">
            <h3 className="font-bold capitalize text-ink">
              {new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(selected)}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {selectedItems.length
                ? `${new Intl.NumberFormat(locale).format(selectedItems.length)} ${tr({ en: "sessions", ar: "جلسة" })}`
                : tr({ en: "No sessions", ar: "لا جلسات" })}
            </p>
          </div>
          <div className="custom-scroll flex-1 space-y-2.5 overflow-y-auto p-3">
            {selectedItems.length === 0 ? (
              <div className="grid h-full min-h-40 place-items-center text-center text-muted">
                <div>
                  <svg viewBox="0 0 24 24" className="mx-auto h-9 w-9 opacity-40" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
                  </svg>
                  <p className="mt-2 text-sm font-semibold">{tr({ en: "Nothing booked", ar: "لا يوجد حجوزات" })}</p>
                </div>
              </div>
            ) : (
              selectedItems.map((it) => {
                const type = sessionTypeById(it.typeId);
                const st = statusMeta[it.status];
                const canAct = it.status === "confirmed" || it.status === "pending";
                return (
                  <div
                    key={it.code}
                    className="rounded-xl border p-3"
                    style={{ borderColor: tint(type.color, 0.3), background: tint(type.color, 0.05) }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-extrabold text-white" style={{ backgroundColor: type.color }}>
                        {fmtTime(it.date)} · {tr(type.label)}
                      </span>
                      {st && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>{tr(st.label)}</span>}
                    </div>
                    <p className="mt-1.5 font-bold text-ink">{it.patient}</p>
                    <p className="text-[11px] text-muted" dir="ltr">{it.phone}</p>
                    {it.doctorName && (
                      <p className="mt-0.5 text-[11px] font-semibold text-primary">{tr({ en: "Dr.", ar: "د." })} {it.doctorName}</p>
                    )}
                    {it.complaint && <p className="mt-1 text-[11px] text-muted">{it.complaint}</p>}
                    {canAct && (
                      <div className="mt-2.5 flex gap-2">
                        <button
                          onClick={() => act(it.code, "complete")}
                          disabled={busy === it.code + "complete"}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                          {tr({ en: "Complete", ar: "إنهاء" })}
                        </button>
                        <button
                          onClick={() => act(it.code, "decline")}
                          disabled={busy === it.code + "decline"}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                          {tr({ en: "Cancel", ar: "إلغاء" })}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
