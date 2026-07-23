"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/language";
import { formatMoney } from "@/lib/patients";

type OwnerSummary = {
  grossRevenue: number;
  collected: number;
  refunds: number;
  netCollected: number;
  expenses: number;
  netProfit: number;
  monthDelta: number;
};

type Debtor = { patientId: string; name: string; phone: string; outstanding: number };
type AgingRow = { patientId: string; name: string; phone: string; outstanding: number; ageDays: number; bucket: "0-30" | "31-60" | "61-90" | "90+" };
type ApAgingBucket = "0-30" | "31-60" | "61-90" | "90+";
type ApSupplierRow = {
  supplierId: string | null;
  supplierName: string;
  outstanding: number;
  purchaseOrderCount: number;
  oldestDays: number;
  bucket: ApAgingBucket;
};
type ApPoRow = {
  purchaseOrderId: string;
  code: string;
  supplierId: string | null;
  supplierName: string;
  status: string;
  dueAt: string;
  ageDays: number;
  bucket: ApAgingBucket;
  outstanding: number;
  currency: string;
};

export function OwnerFinanceDashboard({ enabled }: { enabled: boolean }) {
  const { tr, lang } = useLang();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [summary, setSummary] = useState<OwnerSummary | null>(null);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [aging, setAging] = useState<{ buckets: Record<string, number>; receivables: AgingRow[] } | null>(null);
  const [apAging, setApAging] = useState<{
    buckets: Record<ApAgingBucket, number>;
    suppliers: ApSupplierRow[];
    purchaseOrders: ApPoRow[];
    totalOutstanding: number;
  } | null>(null);
  const [apSupplierId, setApSupplierId] = useState<string | null>(null);

  const qs = useMemo(() => {
    const q = new URLSearchParams();
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    const s = q.toString();
    return s ? `?${s}` : "";
  }, [from, to]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    setForbidden(false);
    const apQ = new URLSearchParams();
    if (to) apQ.set("asOf", to);
    const apQs = apQ.toString();
    Promise.all([
      fetch(`/api/admin/finance/owner-dashboard${qs}`, { cache: "no-store" }),
      fetch("/api/admin/finance/aging", { cache: "no-store" }),
      fetch(`/api/admin/finance/ap-aging${apQs ? `?${apQs}` : ""}`, { cache: "no-store" }),
    ])
      .then(async ([ownerRes, agingRes, apRes]) => {
        if (!alive) return;
        if (ownerRes.status === 401 || ownerRes.status === 403) {
          setForbidden(true);
          setSummary(null);
          setAging(null);
          setApAging(null);
          setDebtors([]);
          return;
        }
        if (!ownerRes.ok) throw new Error("owner_dashboard_failed");
        const owner = await ownerRes.json();
        const agingBody = agingRes.ok ? await agingRes.json() : null;
        const apBody = apRes.ok ? await apRes.json() : null;
        setSummary(owner.summary as OwnerSummary);
        setDebtors((owner.topDebtors ?? []) as Debtor[]);
        if (agingBody) {
          setAging({
            buckets: agingBody.buckets ?? { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
            receivables: (agingBody.receivables ?? []) as AgingRow[],
          });
        } else {
          setAging(null);
        }
        if (apBody) {
          const suppliers = (apBody.suppliers ?? []) as ApSupplierRow[];
          setApAging({
            buckets: apBody.buckets ?? { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 },
            suppliers,
            purchaseOrders: (apBody.purchaseOrders ?? []) as ApPoRow[],
            totalOutstanding: Number(apBody.totalOutstanding ?? 0),
          });
          setApSupplierId((prev) => (prev && suppliers.some((row) => row.supplierId === prev) ? prev : null));
        } else {
          setApAging(null);
          setApSupplierId(null);
        }
      })
      .catch(() => {
        if (!alive) return;
        setSummary(null);
        setAging(null);
        setApAging(null);
        setApSupplierId(null);
        setDebtors([]);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [enabled, qs]);

  if (!enabled) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-primary/15 bg-surface p-6 text-sm text-muted">
        {tr({ en: "Finance dashboard is disabled by feature flag.", ar: "لوحة المالية معطّلة عبر إعدادات الميزة." })}
      </div>
    );
  }
  if (forbidden) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-rose-300/30 bg-rose-50 p-6 text-sm text-rose-700">
        {tr({ en: "This screen is available to owner roles only.", ar: "هذه الشاشة متاحة فقط لمالكي النظام." })}
      </div>
    );
  }

  const m = (v: number) => formatMoney(v ?? 0, lang);
  const apOrders = apAging?.purchaseOrders ?? [];
  const apFiltered = apSupplierId
    ? apOrders.filter((row) => row.supplierId === apSupplierId)
    : apOrders.slice(0, 30);
  const deltaTone =
    (summary?.monthDelta ?? 0) > 0 ? "text-emerald-700 bg-emerald-100" : (summary?.monthDelta ?? 0) < 0 ? "text-rose-700 bg-rose-100" : "text-slate-600 bg-slate-100";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink lg:text-2xl">{tr({ en: "Owner Finance", ar: "مالية العيادة" })}</h2>
          <p className="mt-0.5 text-sm text-muted">{tr({ en: "Revenue, collections, refunds, expenses and receivables aging.", ar: "الإيرادات والتحصيلات والمرتجعات والمصروفات وأعمار المديونيات." })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => window.location.assign("/dashboard/finance/day-close")}
            className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/15"
          >
            {tr({ en: "Day-end cash close", ar: "إقفال اليومية النقدية" })}
          </button>
          <button
            onClick={() => {
              const q = new URLSearchParams();
              if (from) q.set("from", from);
              if (to) q.set("to", to);
              const s = q.toString();
              window.location.assign(`/dashboard/finance/export-pack${s ? `?${s}` : ""}`);
            }}
            className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/15"
          >
            {tr({ en: "Export pack", ar: "حزمة التصدير" })}
          </button>
          <label className="text-xs text-muted">
            {tr({ en: "From", ar: "من" })}
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="ms-1 rounded-lg border border-primary/15 bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-primary" />
          </label>
          <label className="text-xs text-muted">
            {tr({ en: "To", ar: "إلى" })}
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="ms-1 rounded-lg border border-primary/15 bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-primary" />
          </label>
          {(from || to) && (
            <button onClick={() => { setFrom(""); setTo(""); }} className="rounded-lg border border-primary/15 px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-ink">
              {tr({ en: "Current month", ar: "الشهر الحالي" })}
            </button>
          )}
        </div>
      </div>

      {loading && !summary ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-2" />)}</div>
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={tr({ en: "Gross revenue", ar: "إجمالي الإيراد" })} value={m(summary.grossRevenue)} />
            <Kpi label={tr({ en: "Collected", ar: "المحصّل" })} value={m(summary.collected)} />
            <Kpi label={tr({ en: "Refunds", ar: "المرتجعات" })} value={m(summary.refunds)} />
            <Kpi label={tr({ en: "Net collected", ar: "صافي التحصيل" })} value={m(summary.netCollected)} primary />
            <Kpi label={tr({ en: "Expenses", ar: "المصروفات" })} value={m(summary.expenses)} />
            <Kpi label={tr({ en: "Net profit", ar: "صافي الربح" })} value={m(summary.netProfit)} primary />
            <Kpi
              label={tr({ en: "Collection margin", ar: "هامش التحصيل" })}
              value={`${summary.collected > 0 ? ((summary.netCollected / summary.collected) * 100).toFixed(1) : "0.0"}%`}
            />
            <div className="rounded-2xl border border-primary/12 bg-surface p-4">
              <p className="text-xs font-medium text-muted">{tr({ en: "Month delta", ar: "فرق الشهر" })}</p>
              <p className="mt-1 text-2xl font-extrabold text-ink">{summary.monthDelta.toFixed(1)}%</p>
              <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${deltaTone}`}>
                {summary.monthDelta > 0 ? tr({ en: "Up", ar: "ارتفاع" }) : summary.monthDelta < 0 ? tr({ en: "Down", ar: "انخفاض" }) : tr({ en: "Flat", ar: "ثابت" })}
              </span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-primary/12 bg-surface p-4">
              <h3 className="text-sm font-bold text-ink">{tr({ en: "Top debtors", ar: "أعلى المدينين" })}</h3>
              <p className="mt-0.5 text-xs text-muted">{tr({ en: "Outstanding balances (refund-adjusted).", ar: "الأرصدة المتبقية بعد احتساب المرتجعات." })}</p>
              <div className="mt-3 space-y-2">
                {debtors.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">{tr({ en: "No outstanding balances.", ar: "لا توجد أرصدة مستحقة." })}</p>
                ) : (
                  debtors.map((d) => (
                    <div key={d.patientId} className="flex items-center justify-between gap-2 rounded-xl border border-primary/10 bg-surface-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-ink">{d.name}</p>
                        <p className="truncate text-[11px] text-muted" dir="ltr">{d.phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-rose-100 px-2 py-1 text-sm font-bold text-rose-700">{m(d.outstanding)}</span>
                        <button
                          onClick={() => window.open(`/dashboard/finance/statements/${d.patientId}/print`, "_blank", "noopener")}
                          className="rounded-lg border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10"
                        >
                          {tr({ en: "Statement", ar: "كشف حساب" })}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-primary/12 bg-surface p-4">
              <h3 className="text-sm font-bold text-ink">{tr({ en: "AR aging buckets", ar: "تقادم المديونيات" })}</h3>
              <p className="mt-0.5 text-xs text-muted">{tr({ en: "Grouped by account age in days.", ar: "مجمّعة حسب عمر الرصيد بالأيام." })}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <BucketCard label="0-30" value={m(aging?.buckets?.["0-30"] ?? 0)} />
                <BucketCard label="31-60" value={m(aging?.buckets?.["31-60"] ?? 0)} />
                <BucketCard label="61-90" value={m(aging?.buckets?.["61-90"] ?? 0)} />
                <BucketCard label="90+" value={m(aging?.buckets?.["90+"] ?? 0)} />
              </div>
              <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-primary/10">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
                    <tr>
                      <th className="px-2 py-2 text-start">{tr({ en: "Patient", ar: "المريض" })}</th>
                      <th className="px-2 py-2 text-center">{tr({ en: "Bucket", ar: "الفئة" })}</th>
                      <th className="px-2 py-2 text-end">{tr({ en: "Outstanding", ar: "المتبقي" })}</th>
                      <th className="px-2 py-2 text-end">{tr({ en: "Statement", ar: "كشف" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(aging?.receivables ?? []).slice(0, 30).map((r) => (
                      <tr key={r.patientId} className="border-t border-primary/8">
                        <td className="px-2 py-2">
                          <p className="font-semibold text-ink">{r.name}</p>
                          <p className="text-[11px] text-muted" dir="ltr">{r.phone}</p>
                        </td>
                        <td className="px-2 py-2 text-center text-muted">{r.bucket}</td>
                        <td className="px-2 py-2 text-end font-semibold text-rose-700">{m(r.outstanding)}</td>
                        <td className="px-2 py-2 text-end">
                          <button
                            onClick={() => window.open(`/dashboard/finance/statements/${r.patientId}/print`, "_blank", "noopener")}
                            className="rounded border border-primary/20 px-1.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/10"
                          >
                            {tr({ en: "Open", ar: "فتح" })}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <section className="rounded-2xl border border-primary/12 bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-ink">{tr({ en: "Supplier AP aging", ar: "تقادم مستحقات الموردين" })}</h3>
                <p className="mt-0.5 text-xs text-muted">{tr({ en: "Outstanding purchase-order commitments by supplier and age.", ar: "الالتزامات المفتوحة من أوامر الشراء حسب المورد والعمر." })}</p>
              </div>
              <button
                onClick={() => window.location.assign("/dashboard/inventory")}
                className="rounded-lg border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
              >
                {tr({ en: "Open inventory", ar: "فتح المخزون" })}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <BucketCard label="0-30" value={m(apAging?.buckets?.["0-30"] ?? 0)} />
              <BucketCard label="31-60" value={m(apAging?.buckets?.["31-60"] ?? 0)} />
              <BucketCard label="61-90" value={m(apAging?.buckets?.["61-90"] ?? 0)} />
              <BucketCard label="90+" value={m(apAging?.buckets?.["90+"] ?? 0)} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {tr({ en: "Total outstanding", ar: "إجمالي المستحق" })}:{" "}
              <span className="font-bold text-ink">{m(apAging?.totalOutstanding ?? 0)}</span>
            </p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="max-h-72 overflow-auto rounded-xl border border-primary/10">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
                    <tr>
                      <th className="px-2 py-2 text-start">{tr({ en: "Supplier", ar: "المورد" })}</th>
                      <th className="px-2 py-2 text-center">{tr({ en: "Aging", ar: "العمر" })}</th>
                      <th className="px-2 py-2 text-end">{tr({ en: "Outstanding", ar: "المستحق" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(apAging?.suppliers ?? []).map((row) => (
                      <tr key={row.supplierId ?? "none"} className="border-t border-primary/8">
                        <td className="px-2 py-2">
                          <button
                            onClick={() => setApSupplierId((prev) => (prev === row.supplierId ? null : row.supplierId))}
                            className={`text-start text-sm font-semibold ${apSupplierId === row.supplierId ? "text-primary" : "text-ink"}`}
                          >
                            {row.supplierName}
                          </button>
                          <p className="text-[11px] text-muted">{row.purchaseOrderCount} PO</p>
                        </td>
                        <td className="px-2 py-2 text-center text-muted">{row.bucket}</td>
                        <td className="px-2 py-2 text-end font-semibold text-amber-700">{m(row.outstanding)}</td>
                      </tr>
                    ))}
                    {(apAging?.suppliers ?? []).length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted">
                          {tr({ en: "No supplier payables.", ar: "لا توجد مستحقات موردين." })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-primary/10">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface-2 text-xs text-muted">
                    <tr>
                      <th className="px-2 py-2 text-start">{tr({ en: "PO", ar: "أمر الشراء" })}</th>
                      <th className="px-2 py-2 text-center">{tr({ en: "Bucket", ar: "الفئة" })}</th>
                      <th className="px-2 py-2 text-end">{tr({ en: "Outstanding", ar: "المستحق" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apFiltered.map((row) => (
                      <tr key={row.purchaseOrderId} className="border-t border-primary/8">
                        <td className="px-2 py-2">
                          <p className="font-semibold text-ink">{row.code}</p>
                          <p className="text-[11px] text-muted">{row.supplierName}</p>
                        </td>
                        <td className="px-2 py-2 text-center text-muted">{row.bucket}</td>
                        <td className="px-2 py-2 text-end font-semibold text-amber-700">{m(row.outstanding)}</td>
                      </tr>
                    ))}
                    {apFiltered.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-sm text-muted">
                          {tr({ en: "No open purchase-order commitments.", ar: "لا توجد التزامات مفتوحة من أوامر الشراء." })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      ) : (
        <p className="rounded-2xl border border-primary/12 bg-surface p-8 text-center text-sm text-muted">
          {tr({ en: "Could not load finance dashboard.", ar: "تعذّر تحميل لوحة المالية." })}
        </p>
      )}
    </div>
  );
}

function Kpi({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${primary ? "border-primary/30 bg-primary/10" : "border-primary/12 bg-surface"}`}>
      <p className={`text-xs font-semibold ${primary ? "text-primary" : "text-muted"}`}>{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

function BucketCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-primary/12 bg-surface-2 p-3">
      <p className="text-[11px] font-bold text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-ink">{value}</p>
    </div>
  );
}
