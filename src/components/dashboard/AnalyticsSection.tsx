"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { formatMoney } from "@/lib/patients";

type Analytics = {
  range: string;
  kpis: {
    collected: number;
    billedInRange: number;
    outstanding: number;
    totalAppts: number;
    completed: number;
    newPatients: number;
    noShowRate: number;
  };
  apptsBreakdown: { completed: number; upcoming: number; missed: number; pending: number; declined: number; cancelled: number };
  topProcedures: { name: string; count: number; revenue: number }[];
  monthly: { key: string; revenue: number; appts: number }[];
  methodMix: { method: string; amount: number }[];
  newVsReturning: { new: number; returning: number };
  doctorEarnings: { doctorId: string; nameEn: string; nameAr: string; amount: number; count: number }[];
  doctorProcedures: { doctorId: string; nameEn: string; nameAr: string; items: { name: string; count: number }[] }[];
};

type ConsumedItem = { itemId: string; nameEn: string; nameAr: string; unit: string; qty: number; value: number };
type InventoryAnalytics = {
  range: string;
  consumptionValue: number;
  consumptionQty: number;
  wastageValue: number;
  wastageQty: number;
  topConsumed: ConsumedItem[];
  topWasted: ConsumedItem[];
};

const RANGES = [
  { id: "30d", label: { en: "30 days", ar: "٣٠ يوم" } },
  { id: "90d", label: { en: "90 days", ar: "٩٠ يوم" } },
  { id: "12m", label: { en: "12 months", ar: "١٢ شهر" } },
  { id: "all", label: { en: "All time", ar: "كل الفترة" } },
] as const;

const METHOD_LABEL: Record<string, { en: string; ar: string }> = {
  cash: { en: "Cash", ar: "نقدًا" },
  card: { en: "Card", ar: "بطاقة" },
  insurance: { en: "Insurance", ar: "تأمين" },
  transfer: { en: "Transfer", ar: "تحويل" },
};

const BREAKDOWN_META: { key: keyof Analytics["apptsBreakdown"]; label: { en: string; ar: string }; color: string }[] = [
  { key: "completed", label: { en: "Completed", ar: "مكتملة" }, color: "#10b981" },
  { key: "upcoming", label: { en: "Upcoming", ar: "قادمة" }, color: "#3b82f6" },
  { key: "pending", label: { en: "Pending", ar: "بانتظار" }, color: "#f59e0b" },
  { key: "missed", label: { en: "Missed", ar: "فائتة" }, color: "#f43f5e" },
  { key: "declined", label: { en: "Declined", ar: "مرفوضة" }, color: "#94a3b8" },
  { key: "cancelled", label: { en: "Cancelled", ar: "ملغاة" }, color: "#cbd5e1" },
];

function KpiCard({ label, value, accent, hint }: { label: string; value: string; accent: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-primary/12 bg-surface p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-ink" style={{ color: accent }}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export function AnalyticsSection() {
  const { tr, lang } = useLang();
  const [range, setRange] = useState("12m");
  const [data, setData] = useState<Analytics | null>(null);
  const [inv, setInv] = useState<InventoryAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/admin/analytics?range=${range}`, { cache: "no-store" });
      if (res.ok && alive) setData((await res.json()) as Analytics);
      if (alive) setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range]);

  // Inventory consumption — independent, non-blocking fetch keyed on the same range.
  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/admin/analytics/inventory?range=${range}`, { cache: "no-store" });
      if (res.ok && alive) setInv((await res.json()) as InventoryAnalytics);
    })();
    return () => {
      alive = false;
    };
  }, [range]);

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "short" }).format(new Date(y, m - 1, 1));
  };

  const maxAppts = data ? Math.max(1, ...data.monthly.map((m) => m.appts)) : 1;
  const maxProc = data ? Math.max(1, ...data.topProcedures.map((p) => p.count)) : 1;
  const totalMethods = data ? data.methodMix.reduce((s, m) => s + m.amount, 0) : 0;
  const breakdownTotal = data ? BREAKDOWN_META.reduce((s, b) => s + data.apptsBreakdown[b.key], 0) : 0;
  const nvr = data ? data.newVsReturning.new + data.newVsReturning.returning : 0;
  const doctorProcedures = data?.doctorProcedures ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink lg:text-2xl">
            {tr({ en: "Analytics", ar: "التحليلات" })}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {tr({ en: "Appointments, patients & operations — how your clinic runs.", ar: "المواعيد والمرضى والعمليات — كيف تعمل عيادتك." })}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                range === r.id
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-primary/15 text-muted hover:border-primary/40 hover:text-ink"
              }`}
            >
              {tr(r.label)}
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="grid place-items-center py-20 text-muted">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : data ? (
        <>
          {/* KPI cards — operational only (money lives in Revenue) */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard label={tr({ en: "Appointments", ar: "المواعيد" })} value={String(data.kpis.totalAppts)} accent="#1c2127" hint={`${data.kpis.completed} ${tr({ en: "completed", ar: "مكتملة" })}`} />
            <KpiCard label={tr({ en: "New patients", ar: "مرضى جدد" })} value={String(data.kpis.newPatients)} accent="#3b82f6" />
            <KpiCard label={tr({ en: "New vs returning", ar: "جدد مقابل عائدين" })} value={`${data.newVsReturning.new} / ${data.newVsReturning.returning}`} accent="#8b5cf6" />
            <KpiCard label={tr({ en: "No-show rate", ar: "نسبة عدم الحضور" })} value={`${data.kpis.noShowRate}%`} accent={data.kpis.noShowRate > 20 ? "#e11d48" : "#10b981"} hint={tr({ en: "missed of scheduled", ar: "فائتة من المجدولة" })} />
            <KpiCard label={tr({ en: "Collection rate", ar: "نسبة التحصيل" })} value={data.kpis.billedInRange > 0 ? `${Math.round((data.kpis.collected / data.kpis.billedInRange) * 100)}%` : "—"} accent="#10b981" hint={tr({ en: "paid of billed", ar: "مدفوع من المُفوتر" })} />
            <KpiCard label={tr({ en: "Outstanding", ar: "المتبقّي" })} value={formatMoney(data.kpis.outstanding, lang)} accent={data.kpis.outstanding > 0 ? "#e11d48" : "#10b981"} hint={tr({ en: "unpaid balances", ar: "أرصدة غير مدفوعة" })} />
          </div>

          {/* Monthly appointments chart (operational volume; revenue trend lives in Earnings) */}
          <div className="rounded-2xl border border-primary/12 bg-surface p-5">
            <h3 className="text-sm font-bold text-ink">{tr({ en: "Appointments — last 12 months", ar: "المواعيد — آخر ١٢ شهر" })}</h3>
            <div className="mt-4 flex h-44 items-stretch gap-2">
              {data.monthly.map((m) => (
                <div key={m.key} className="flex h-full flex-1 flex-col items-center gap-1.5" title={`${m.appts} ${tr({ en: "appointments", ar: "موعد" })}`}>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-primary/40 to-primary transition-all"
                      style={{ height: `${m.appts > 0 ? Math.max(3, (m.appts / maxAppts) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-muted">{monthLabel(m.key)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Top procedures by volume */}
            <div className="rounded-2xl border border-primary/12 bg-surface p-5">
              <h3 className="text-sm font-bold text-ink">{tr({ en: "Most performed procedures", ar: "أكثر العمليات إجراءً" })}</h3>
              <div className="mt-4 space-y-3">
                {data.topProcedures.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">{tr({ en: "No treatments yet.", ar: "لا توجد علاجات بعد." })}</p>
                ) : (
                  data.topProcedures.map((p) => (
                    <div key={p.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-semibold text-ink">{p.name}</span>
                        <span className="font-bold text-primary">×{p.count}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-primary/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dark" style={{ width: `${(p.count / maxProc) * 100}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Appointment breakdown + method mix */}
            <div className="space-y-5">
              <div className="rounded-2xl border border-primary/12 bg-surface p-5">
                <h3 className="text-sm font-bold text-ink">{tr({ en: "Appointments breakdown", ar: "توزيع المواعيد" })}</h3>
                <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-primary/5">
                  {BREAKDOWN_META.map((b) => {
                    const v = data.apptsBreakdown[b.key];
                    if (!v || breakdownTotal === 0) return null;
                    return <div key={b.key} style={{ width: `${(v / breakdownTotal) * 100}%`, background: b.color }} title={`${tr(b.label)}: ${v}`} />;
                  })}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  {BREAKDOWN_META.map((b) => (
                    <span key={b.key} className="inline-flex items-center gap-1.5 text-muted">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                      {tr(b.label)} <span className="font-bold text-ink">{data.apptsBreakdown[b.key]}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-primary/12 bg-surface p-5">
                <h3 className="text-sm font-bold text-ink">{tr({ en: "Payment methods", ar: "طرق الدفع" })}</h3>
                <div className="mt-3 space-y-2">
                  {data.methodMix.length === 0 ? (
                    <p className="py-3 text-center text-sm text-muted">{tr({ en: "No payments in this range.", ar: "لا مدفوعات في هذه الفترة." })}</p>
                  ) : (
                    data.methodMix.map((m) => (
                      <div key={m.method} className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-ink">{tr(METHOD_LABEL[m.method] ?? { en: m.method, ar: m.method })}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted">{totalMethods > 0 ? Math.round((m.amount / totalMethods) * 100) : 0}%</span>
                          <span className="font-bold text-primary">{formatMoney(m.amount, lang)}</span>
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Operations by doctor — who performs which operation most (operational) */}
          {doctorProcedures.length > 0 && (
            <div className="rounded-2xl border border-primary/12 bg-surface p-5">
              <h3 className="text-sm font-bold text-ink">{tr({ en: "Operations by doctor", ar: "العمليات حسب الطبيب" })}</h3>
              <p className="mt-0.5 text-xs text-muted">{tr({ en: "Which operation each doctor performed most. Earnings live in the Doctor Earnings tab.", ar: "أكثر عملية أجراها كل طبيب. الأرباح في تبويب أرباح الأطباء." })}</p>
              <div className="mt-4 grid gap-x-8 gap-y-4 lg:grid-cols-2">
                {doctorProcedures.map((d) => {
                  const maxCount = Math.max(1, ...d.items.map((i) => i.count));
                  return (
                    <div key={d.doctorId}>
                      <p className="mb-1.5 text-sm font-bold text-ink">{(lang === "ar" ? d.nameAr : d.nameEn) || "—"}</p>
                      <div className="space-y-1.5">
                        {d.items.map((i) => (
                          <div key={i.name} className="flex items-center gap-2">
                            <span className="w-28 shrink-0 truncate text-xs text-muted" title={i.name}>{i.name}</span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/10">
                              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${(i.count / maxCount) * 100}%` }} />
                            </div>
                            <span className="w-6 shrink-0 text-right text-xs font-bold text-ink">{i.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {inv && (inv.consumptionValue > 0 || inv.wastageValue > 0 || inv.topConsumed.length > 0) && (
            <div className="rounded-2xl border border-primary/12 bg-surface p-5">
              <h3 className="text-sm font-bold text-ink">{tr({ en: "Inventory consumption", ar: "استهلاك المخزون" })}</h3>
              <p className="mt-0.5 text-xs text-muted">{tr({ en: "Stock used and wasted in this range, valued at cost.", ar: "المخزون المستخدم والمهدر في هذه الفترة، مُقيَّم بالتكلفة." })}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-primary/10 p-3">
                  <p className="text-xs text-muted">{tr({ en: "Consumed", ar: "مستهلك" })}</p>
                  <p className="mt-0.5 text-xl font-extrabold text-ink">{formatMoney(inv.consumptionValue, lang)}</p>
                  <p className="text-[11px] text-muted">{inv.consumptionQty} {tr({ en: "units", ar: "وحدة" })}</p>
                </div>
                <div className="rounded-xl border border-primary/10 p-3">
                  <p className="text-xs text-muted">{tr({ en: "Wasted", ar: "مهدر" })}</p>
                  <p className="mt-0.5 text-xl font-extrabold" style={{ color: inv.wastageValue > 0 ? "#e11d48" : undefined }}>{formatMoney(inv.wastageValue, lang)}</p>
                  <p className="text-[11px] text-muted">{inv.wastageQty} {tr({ en: "units", ar: "وحدة" })}</p>
                </div>
              </div>
              {inv.topConsumed.length > 0 && (() => {
                const maxConsumed = Math.max(1, ...inv.topConsumed.map((i) => i.value));
                return (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold text-muted">{tr({ en: "Top consumed items", ar: "أكثر الأصناف استهلاكًا" })}</p>
                    <div className="space-y-2">
                      {inv.topConsumed.map((it) => (
                        <div key={it.itemId} className="flex items-center gap-2">
                          <span className="w-28 shrink-0 truncate text-xs text-ink" title={(lang === "ar" ? it.nameAr : it.nameEn) || ""}>{(lang === "ar" ? it.nameAr : it.nameEn) || "—"}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-primary/10">
                            <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dark" style={{ width: `${(it.value / maxConsumed) * 100}%` }} />
                          </div>
                          <span className="w-20 shrink-0 text-right text-xs font-bold text-primary">{formatMoney(it.value, lang)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {nvr === 0 && (
            <p className="text-center text-xs text-muted">{tr({ en: "Tip: numbers grow as bookings, treatments and payments are recorded.", ar: "ملاحظة: الأرقام تكبر مع تسجيل الحجوزات والعلاجات والمدفوعات." })}</p>
          )}
        </>
      ) : (
        <p className="py-20 text-center text-sm text-muted">{tr({ en: "Could not load analytics.", ar: "تعذّر تحميل التحليلات." })}</p>
      )}
    </div>
  );
}
