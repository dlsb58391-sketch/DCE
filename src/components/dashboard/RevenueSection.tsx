"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { formatMoney } from "@/lib/patients";

type Revenue = {
  month: string;
  clinic: {
    gross: number;
    collected: number;
    materialsCost: number;
    doctorsCommission: number;
    expenses: number;
    net: number;
    operations: number;
  };
  doctors: { doctorId: string; nameEn: string; nameAr: string; amount: number; count: number }[];
  operations: { name: string; count: number; gross: number; materialsCost: number; doctorsCommission: number; clinicNet: number }[];
  expenseItems: { id: string; labelEn: string; labelAr: string; kind: string; effective: number; overridden: boolean }[];
};

const monthKeyNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function KpiCard({ label, value, accent, hint }: { label: string; value: string; accent: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-primary/12 bg-surface p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold" style={{ color: accent }}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export function RevenueSection() {
  const { tr, lang } = useLang();
  const [month, setMonth] = useState(monthKeyNow());
  const [data, setData] = useState<Revenue | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/admin/revenue?month=${encodeURIComponent(month)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setData(j))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [month]);

  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink lg:text-2xl">{tr({ en: "Revenue", ar: "الإيرادات" })}</h2>
          <p className="mt-0.5 text-sm text-muted">{tr({ en: "Clinic profit after doctor commissions, materials and expenses.", ar: "ربح العيادة بعد عمولات الأطباء والخامات والمصروفات." })}</p>
        </div>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value || monthKeyNow())} dir="ltr" className="rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
      </div>

      {loading && !data ? (
        <div className="grid place-items-center py-20 text-muted"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /></div>
      ) : data ? (
        <>
          <p className="text-sm font-semibold text-muted">{monthLabel(data.month)} · {data.clinic.operations} {tr({ en: "operations", ar: "عملية" })}</p>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard label={tr({ en: "Billed (gross)", ar: "الإجمالي (فواتير)" })} value={formatMoney(data.clinic.gross, lang)} accent="#a87f2b" hint={tr({ en: "patient prices this month", ar: "أسعار المرضى هذا الشهر" })} />
            <KpiCard label={tr({ en: "Collected", ar: "المحصّل" })} value={formatMoney(data.clinic.collected, lang)} accent="#10b981" hint={tr({ en: "payments received", ar: "المدفوعات المستلمة" })} />
            <KpiCard label={tr({ en: "Doctor commissions", ar: "عمولات الأطباء" })} value={formatMoney(data.clinic.doctorsCommission, lang)} accent="#8b5cf6" />
            <KpiCard label={tr({ en: "Materials cost", ar: "تكلفة الخامات" })} value={formatMoney(data.clinic.materialsCost, lang)} accent="#e11d48" hint={tr({ en: "on operations with a cost set", ar: "للعمليات ذات التكلفة المحددة" })} />
            <KpiCard label={tr({ en: "Expenses", ar: "المصروفات" })} value={formatMoney(data.clinic.expenses, lang)} accent="#e11d48" hint={tr({ en: "rent, electricity, etc.", ar: "إيجار، كهرباء، إلخ" })} />
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
              <p className="text-xs font-bold text-primary">{tr({ en: "Clinic net profit", ar: "صافي ربح العيادة" })}</p>
              <p className="mt-1 text-2xl font-extrabold text-primary">{formatMoney(data.clinic.net, lang)}</p>
              <p className="mt-0.5 text-[11px] text-muted">{tr({ en: "gross − commissions − materials − expenses", ar: "الإجمالي − العمولات − الخامات − المصروفات" })}</p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Clinic profit breakdown */}
            <div className="rounded-2xl border border-primary/12 bg-surface p-5">
              <h3 className="text-sm font-bold text-ink">{tr({ en: "Profit breakdown", ar: "تفصيل الربح" })}</h3>
              <p className="mt-0.5 text-xs text-muted">{tr({ en: "How this month's billing becomes clinic profit.", ar: "كيف تتحوّل فواتير هذا الشهر إلى ربح للعيادة." })}</p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">{tr({ en: "Billed (gross)", ar: "الإجمالي (فواتير)" })}</span>
                  <span className="font-bold text-ink">{formatMoney(data.clinic.gross, lang)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">− {tr({ en: "Doctor commissions", ar: "عمولات الأطباء" })}</span>
                  <span className="font-semibold text-violet-600">−{formatMoney(data.clinic.doctorsCommission, lang)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">− {tr({ en: "Materials cost", ar: "تكلفة الخامات" })}</span>
                  <span className="font-semibold text-rose-600">−{formatMoney(data.clinic.materialsCost, lang)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted">− {tr({ en: "Expenses", ar: "المصروفات" })}</span>
                  <span className="font-semibold text-rose-600">−{formatMoney(data.clinic.expenses, lang)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between border-t border-primary/10 pt-2">
                  <span className="font-bold text-primary">= {tr({ en: "Clinic net profit", ar: "صافي ربح العيادة" })}</span>
                  <span className="text-lg font-extrabold text-primary">{formatMoney(data.clinic.net, lang)}</span>
                </div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary/10">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary-dark" style={{ width: `${data.clinic.gross > 0 ? Math.max(0, Math.min(100, (data.clinic.net / data.clinic.gross) * 100)) : 0}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-muted">{tr({ en: "Per-doctor commissions & payouts are in the Doctor Earnings tab.", ar: "عمولات ومدفوعات كل طبيب في تبويب أرباح الأطباء." })}</p>
            </div>

            {/* Expenses breakdown */}
            <div className="rounded-2xl border border-primary/12 bg-surface p-5">
              <h3 className="text-sm font-bold text-ink">{tr({ en: "Expenses this month", ar: "مصروفات هذا الشهر" })}</h3>
              <div className="mt-4 space-y-2">
                {data.expenseItems.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted">{tr({ en: "No expenses set. Add them in Settings.", ar: "لا مصروفات. أضِفها في الإعدادات." })}</p>
                ) : (
                  data.expenseItems.map((e) => (
                    <div key={e.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-ink">
                        {lang === "ar" ? e.labelAr : e.labelEn}
                        {e.overridden && <span className="ms-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{tr({ en: "overridden", ar: "معدّل" })}</span>}
                      </span>
                      <span className="font-bold text-rose-600">{formatMoney(e.effective, lang)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Per-operation profit table */}
          <div className="rounded-2xl border border-primary/12 bg-surface p-5">
            <h3 className="text-sm font-bold text-ink">{tr({ en: "By operation", ar: "حسب العملية" })}</h3>
            <p className="mt-0.5 text-xs text-muted">{tr({ en: "How many times each operation ran and the clinic's net after commission & materials.", ar: "عدد مرات كل عملية وصافي العيادة بعد العمولة والخامات." })}</p>
            {data.operations.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">{tr({ en: "No operations this month.", ar: "لا عمليات هذا الشهر." })}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary/10 text-start text-xs text-muted">
                      <th className="py-2 pe-2 text-start font-semibold">{tr({ en: "Operation", ar: "العملية" })}</th>
                      <th className="px-2 py-2 text-center font-semibold">{tr({ en: "Count", ar: "العدد" })}</th>
                      <th className="px-2 py-2 text-end font-semibold">{tr({ en: "Gross", ar: "الإجمالي" })}</th>
                      <th className="px-2 py-2 text-end font-semibold">{tr({ en: "Commission", ar: "العمولة" })}</th>
                      <th className="px-2 py-2 text-end font-semibold">{tr({ en: "Materials", ar: "الخامات" })}</th>
                      <th className="ps-2 py-2 text-end font-semibold">{tr({ en: "Clinic net", ar: "صافي العيادة" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.operations.map((o) => (
                      <tr key={o.name} className="border-b border-primary/6 last:border-0">
                        <td className="py-2 pe-2 font-semibold text-ink">{o.name}</td>
                        <td className="px-2 py-2 text-center text-muted">{o.count}</td>
                        <td className="px-2 py-2 text-end text-ink">{formatMoney(o.gross, lang)}</td>
                        <td className="px-2 py-2 text-end text-violet-600">{formatMoney(o.doctorsCommission, lang)}</td>
                        <td className="px-2 py-2 text-end text-rose-600">{formatMoney(o.materialsCost, lang)}</td>
                        <td className="ps-2 py-2 text-end font-bold text-emerald-700">{formatMoney(o.clinicNet, lang)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="py-20 text-center text-sm text-muted">{tr({ en: "Could not load revenue.", ar: "تعذّر تحميل الإيرادات." })}</p>
      )}
    </div>
  );
}
