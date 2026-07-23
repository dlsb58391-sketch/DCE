"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/language";
import { formatMoney } from "@/lib/patients";

type ExportPack = {
  generatedAt: string;
  filters: {
    from: string;
    toExclusive: string;
    asOf: string;
    scope: { mode: "all" } | { mode: "one"; branchId: string };
  };
  summary: {
    grossRevenue: number;
    collected: number;
    refunds: number;
    netCollected: number;
    expenses: number;
    netProfit: number;
    monthDelta: number;
  };
  arAging: {
    buckets: Record<string, number>;
    totalOutstanding: number;
    count: number;
    receivables: Array<{ patientId: string; name: string; phone: string; outstanding: number; bucket: string }>;
  };
  apAging: {
    buckets: Record<string, number>;
    totalOutstanding: number;
    supplierCount: number;
    purchaseOrderCount: number;
    suppliers: Array<{ supplierId: string | null; supplierName: string; outstanding: number; purchaseOrderCount: number; bucket: string }>;
  };
  dayCloseSessions: Array<{
    id: string;
    branchId: string;
    closeDate: string;
    expectedCash: number;
    countedCash: number;
    variance: number;
  }>;
  topDebtors: Array<{ patientId: string; name: string; phone: string; outstanding: number }>;
  topSuppliers: Array<{ supplierId: string | null; supplierName: string; outstanding: number; purchaseOrderCount: number; bucket: string }>;
};

function fmtDate(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function FinanceExportPackPage() {
  const { tr, lang } = useLang();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [data, setData] = useState<ExportPack | null>(null);

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const s = q.toString();
    return s ? `?${s}` : "";
  }, [from, to]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    const fromQ = q.get("from");
    const toQ = q.get("to");
    if (fromQ) setFrom(fromQ);
    if (toQ) setTo(toQ);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setForbidden(false);
    fetch(`/api/admin/finance/export-pack${qs}`, { cache: "no-store" })
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 401 || res.status === 403) {
          setForbidden(true);
          setData(null);
          return;
        }
        if (!res.ok) throw new Error("load_failed");
        setData((await res.json()) as ExportPack);
      })
      .catch(() => {
        if (!alive) return;
        setData(null);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [qs]);

  const money = (n: number) => formatMoney(n ?? 0, lang);

  const downloadJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-export-pack-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (forbidden) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-rose-300/30 bg-rose-50 p-6 text-sm text-rose-700">
        {tr({ en: "Export pack is available to owner roles with export permission.", ar: "حزمة التصدير متاحة فقط لأدوار المالك بصلاحية التصدير." })}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink lg:text-2xl">{tr({ en: "Accountant Export Pack", ar: "حزمة المحاسب" })}</h1>
          <p className="text-sm text-muted">{tr({ en: "Finance summary, AR/AP aging, and day-close reconciliation in one report.", ar: "ملخص مالي وتقادم ذمم وإقفال يومي في تقرير واحد." })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted">
            {tr({ en: "From", ar: "من" })}
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ms-1 rounded-lg border border-primary/15 bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-primary" />
          </label>
          <label className="text-xs text-muted">
            {tr({ en: "To", ar: "إلى" })}
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ms-1 rounded-lg border border-primary/15 bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-primary" />
          </label>
          <button onClick={downloadJson} className="rounded-lg border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10">
            {tr({ en: "Download JSON", ar: "تنزيل JSON" })}
          </button>
          <button onClick={() => window.print()} className="rounded-lg border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10">
            {tr({ en: "Print", ar: "طباعة" })}
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-2" />)}</div>
      ) : data ? (
        <>
          <div className="rounded-2xl border border-primary/12 bg-surface p-4 text-xs text-muted">
            <p>{tr({ en: "Generated", ar: "تاريخ الإنشاء" })}: <span className="font-semibold text-ink">{fmtDate(data.generatedAt, lang)}</span></p>
            <p>{tr({ en: "Range", ar: "الفترة" })}: <span className="font-semibold text-ink">{fmtDate(data.filters.from, lang)} — {fmtDate(data.filters.toExclusive, lang)}</span></p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi label={tr({ en: "Gross revenue", ar: "إجمالي الإيراد" })} value={money(data.summary.grossRevenue)} />
            <Kpi label={tr({ en: "Collected", ar: "المحصّل" })} value={money(data.summary.collected)} />
            <Kpi label={tr({ en: "Refunds", ar: "المرتجعات" })} value={money(data.summary.refunds)} />
            <Kpi label={tr({ en: "Net collected", ar: "صافي التحصيل" })} value={money(data.summary.netCollected)} />
            <Kpi label={tr({ en: "Expenses", ar: "المصروفات" })} value={money(data.summary.expenses)} />
            <Kpi label={tr({ en: "Net profit", ar: "صافي الربح" })} value={money(data.summary.netProfit)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-primary/12 bg-surface p-4">
              <h2 className="text-sm font-bold text-ink">{tr({ en: "AR aging snapshot", ar: "لقطة تقادم الذمم المدينة" })}</h2>
              <p className="mt-1 text-xs text-muted">{tr({ en: "Total outstanding", ar: "إجمالي المستحق" })}: <span className="font-semibold text-ink">{money(data.arAging.totalOutstanding)}</span></p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Bucket label="0-30" value={money(data.arAging.buckets["0-30"] ?? 0)} />
                <Bucket label="31-60" value={money(data.arAging.buckets["31-60"] ?? 0)} />
                <Bucket label="61-90" value={money(data.arAging.buckets["61-90"] ?? 0)} />
                <Bucket label="90+" value={money(data.arAging.buckets["90+"] ?? 0)} />
              </div>
            </section>
            <section className="rounded-2xl border border-primary/12 bg-surface p-4">
              <h2 className="text-sm font-bold text-ink">{tr({ en: "AP aging snapshot", ar: "لقطة تقادم الذمم الدائنة" })}</h2>
              <p className="mt-1 text-xs text-muted">{tr({ en: "Total outstanding", ar: "إجمالي المستحق" })}: <span className="font-semibold text-ink">{money(data.apAging.totalOutstanding)}</span></p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Bucket label="0-30" value={money(data.apAging.buckets["0-30"] ?? 0)} />
                <Bucket label="31-60" value={money(data.apAging.buckets["31-60"] ?? 0)} />
                <Bucket label="61-90" value={money(data.apAging.buckets["61-90"] ?? 0)} />
                <Bucket label="90+" value={money(data.apAging.buckets["90+"] ?? 0)} />
              </div>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-primary/12 bg-surface p-4">
              <h2 className="text-sm font-bold text-ink">{tr({ en: "Top debtors", ar: "أعلى المدينين" })}</h2>
              <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-primary/10">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
                    <tr>
                      <th className="px-2 py-2 text-start">{tr({ en: "Patient", ar: "المريض" })}</th>
                      <th className="px-2 py-2 text-end">{tr({ en: "Outstanding", ar: "المتبقي" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topDebtors.map((row) => (
                      <tr key={row.patientId} className="border-t border-primary/8">
                        <td className="px-2 py-2">
                          <p className="font-semibold text-ink">{row.name}</p>
                          <p className="text-[11px] text-muted" dir="ltr">{row.phone}</p>
                        </td>
                        <td className="px-2 py-2 text-end font-semibold text-rose-700">{money(row.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section className="rounded-2xl border border-primary/12 bg-surface p-4">
              <h2 className="text-sm font-bold text-ink">{tr({ en: "Top suppliers", ar: "أعلى الموردين استحقاقاً" })}</h2>
              <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-primary/10">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
                    <tr>
                      <th className="px-2 py-2 text-start">{tr({ en: "Supplier", ar: "المورد" })}</th>
                      <th className="px-2 py-2 text-center">{tr({ en: "Bucket", ar: "الفئة" })}</th>
                      <th className="px-2 py-2 text-end">{tr({ en: "Outstanding", ar: "المستحق" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topSuppliers.map((row, idx) => (
                      <tr key={`${row.supplierId ?? "none"}-${idx}`} className="border-t border-primary/8">
                        <td className="px-2 py-2 text-ink">{row.supplierName}</td>
                        <td className="px-2 py-2 text-center text-muted">{row.bucket}</td>
                        <td className="px-2 py-2 text-end font-semibold text-amber-700">{money(row.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-primary/12 bg-surface p-4">
            <h2 className="text-sm font-bold text-ink">{tr({ en: "Day-close sessions", ar: "جلسات إقفال اليومية" })}</h2>
            <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-primary/10">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
                  <tr>
                    <th className="px-2 py-2 text-start">{tr({ en: "Date", ar: "التاريخ" })}</th>
                    <th className="px-2 py-2 text-start">{tr({ en: "Branch", ar: "الفرع" })}</th>
                    <th className="px-2 py-2 text-end">{tr({ en: "Expected", ar: "المتوقع" })}</th>
                    <th className="px-2 py-2 text-end">{tr({ en: "Counted", ar: "المعدود" })}</th>
                    <th className="px-2 py-2 text-end">{tr({ en: "Variance", ar: "الفارق" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dayCloseSessions.map((row) => (
                    <tr key={row.id} className="border-t border-primary/8">
                      <td className="px-2 py-2 text-ink">{fmtDate(row.closeDate, lang)}</td>
                      <td className="px-2 py-2 text-muted">{row.branchId}</td>
                      <td className="px-2 py-2 text-end">{money(row.expectedCash)}</td>
                      <td className="px-2 py-2 text-end">{money(row.countedCash)}</td>
                      <td className={`px-2 py-2 text-end font-semibold ${row.variance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{money(row.variance)}</td>
                    </tr>
                  ))}
                  {data.dayCloseSessions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted">
                        {tr({ en: "No day-close sessions in range.", ar: "لا توجد جلسات إقفال ضمن الفترة." })}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <p className="rounded-2xl border border-primary/12 bg-surface p-8 text-center text-sm text-muted">
          {tr({ en: "Could not load export pack.", ar: "تعذّر تحميل حزمة التصدير." })}
        </p>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-primary/12 bg-surface p-4">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

function Bucket({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-primary/12 bg-surface-2 p-3">
      <p className="text-[11px] font-bold text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-ink">{value}</p>
    </div>
  );
}
