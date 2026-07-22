"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/language";
import { formatMoney } from "@/lib/patients";
import { BarChart, CHART_COLORS } from "./charts";

type Summary = {
  currentMonthEarnings: number;
  previousMonthEarnings: number;
  lifetimeEarnings: number;
  totalOperations: number;
  avgPerOperation: number;
  pendingPayments: number;
  paidAmount: number;
  clinicProfitGenerated: number;
  status: "paid" | "partial" | "pending" | "none";
};
type YearRow = { key: string; operations: number; revenue: number; doctorEarnings: number; clinicEarnings: number; paid: number; remaining: number };
type Op = {
  id: string;
  performedAt: string;
  monthKey: string;
  nameEn: string;
  nameAr: string;
  category: string;
  patientCode: string | null;
  patientName: string | null;
  patientPhone: string | null;
  price: number;
  commissionPct: number;
  amount: number;
  clinicEarnings: number;
  paymentStatus: "paid" | "partial" | "pending" | "none";
  paymentDate: string | null;
  notes: string | null;
};
type Payout = { id: string; amount: number; method: string; reference: string | null; note: string | null; paidAt: string };
type Detail = {
  doctor: { id: string; nameEn: string; nameAr: string; specialtyEn: string | null; specialtyAr: string | null; photoUrl: string | null; commissionPct: number };
  year: number;
  summary: Summary;
  yearly: YearRow[];
  payouts: Payout[];
  operations: Op[];
};

const PAY_STATUS: Record<Op["paymentStatus"], { en: string; ar: string; cls: string }> = {
  paid: { en: "Paid", ar: "مدفوع", cls: "bg-emerald-100 text-emerald-700" },
  partial: { en: "Partial", ar: "جزئي", cls: "bg-amber-100 text-amber-700" },
  pending: { en: "Pending", ar: "معلّق", cls: "bg-rose-100 text-rose-700" },
  none: { en: "—", ar: "—", cls: "bg-slate-100 text-slate-500" },
};

function Card({ label, value, accent, hint, primary }: { label: string; value: string; accent?: string; hint?: string; primary?: boolean }) {
  return (
    <div title={hint} className={`rounded-2xl border p-4 ${primary ? "border-primary/30 bg-primary/10" : "border-primary/12 bg-surface"}`}>
      <p className={`text-xs font-semibold ${primary ? "text-primary" : "text-muted"}`}>{label}</p>
      <p className="mt-1 text-xl font-extrabold" style={{ color: accent }}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export function DoctorEarningsDetail({ doctorId, onBack }: { doctorId: string; onBack: () => void }) {
  const { tr, lang } = useLang();
  const money = (n: number) => formatMoney(n, lang);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState<string | null>(null);
  const [opSearch, setOpSearch] = useState("");
  const [opStatus, setOpStatus] = useState("");

  // payout form
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [posting, setPosting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/admin/doctors/${doctorId}/earnings?year=${year}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setData(j))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [doctorId, year, reloadKey]);

  const dName = (d: { nameEn: string; nameAr: string }) => (lang === "ar" ? d.nameAr : d.nameEn) || d.nameEn || d.nameAr;
  const opName = (o: Op) => (lang === "ar" ? o.nameAr : o.nameEn) || o.nameEn || o.nameAr;
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "short" }).format(new Date(y, m - 1, 1));
  };
  const dateLabel = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)) : "—";

  const years = useMemo(() => {
    const set = new Set<number>([now.getFullYear()]);
    data?.operations.forEach((o) => set.add(Number(o.monthKey.split("-")[0])));
    return [...set].sort((a, b) => b - a);
  }, [data, now]);

  const visibleOps = useMemo(() => {
    if (!data) return [];
    const q = opSearch.trim().toLowerCase();
    return data.operations.filter((o) => {
      if (monthFilter && o.monthKey !== monthFilter) return false;
      if (opStatus && o.paymentStatus !== opStatus) return false;
      if (q && !(o.patientName || "").toLowerCase().includes(q) && !opName(o).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, monthFilter, opStatus, opSearch, lang]);

  async function submitPayout(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/admin/doctors/${doctorId}/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, method, reference: reference || undefined, note: note || undefined, paidAt: paidAt || undefined }),
      });
      if (res.ok) {
        setAmount("");
        setReference("");
        setNote("");
        setPaidAt("");
        setReloadKey((k) => k + 1);
      }
    } finally {
      setPosting(false);
    }
  }

  async function deletePayout(id: string) {
    const res = await fetch(`/api/admin/doctors/${doctorId}/payouts/${id}`, { method: "DELETE" });
    if (res.ok) setReloadKey((k) => k + 1);
  }

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <div className="h-10 w-40 animate-pulse rounded-xl bg-surface-2" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-2" />)}</div>
        <div className="h-72 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <BackBtn onBack={onBack} label={tr({ en: "Back", ar: "رجوع" })} />
        <p className="py-16 text-center text-sm text-muted">{tr({ en: "Could not load doctor.", ar: "تعذّر تحميل الطبيب." })}</p>
      </div>
    );
  }

  const su = data.summary;
  const spec = (lang === "ar" ? data.doctor.specialtyAr : data.doctor.specialtyEn) || "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackBtn onBack={onBack} label={tr({ en: "Back to earnings", ar: "العودة للأرباح" })} />
        <div className="flex items-center gap-2">
          <a href={`/api/admin/earnings/export?doctorId=${doctorId}`} className="rounded-lg border border-primary/20 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10">{tr({ en: "Export Excel", ar: "تصدير Excel" })}</a>
          <button onClick={() => window.print()} className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-[#0a0e12] hover:bg-primary-dark">{tr({ en: "Print / PDF", ar: "طباعة / PDF" })}</button>
        </div>
      </div>

      {/* Doctor header */}
      <div className="flex items-center gap-4 rounded-2xl border border-primary/12 bg-surface p-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-2 text-xl font-extrabold text-primary">
          {data.doctor.photoUrl ? <img src={data.doctor.photoUrl} alt="" className="h-full w-full object-cover" /> : dName(data.doctor).slice(0, 1)}
        </span>
        <div>
          <h2 className="text-xl font-extrabold text-ink">{dName(data.doctor)}</h2>
          <p className="text-sm text-muted">{spec || tr({ en: "Doctor", ar: "طبيب" })} · {tr({ en: "Commission", ar: "العمولة" })} {data.doctor.commissionPct}%</p>
        </div>
      </div>

      {/* 9 summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Card label={tr({ en: "Current Month", ar: "الشهر الحالي" })} value={money(su.currentMonthEarnings)} accent="#a87f2b" primary hint={tr({ en: "earned this month", ar: "المكتسب هذا الشهر" })} />
        <Card label={tr({ en: "Previous Month", ar: "الشهر السابق" })} value={money(su.previousMonthEarnings)} accent="#1c2127" hint={tr({ en: "earned last month", ar: "المكتسب الشهر الماضي" })} />
        <Card label={tr({ en: "Lifetime Earnings", ar: "إجمالي الأرباح" })} value={money(su.lifetimeEarnings)} accent="#8b5cf6" hint={tr({ en: "all-time commission", ar: "كل العمولات" })} />
        <Card label={tr({ en: "Total Operations", ar: "إجمالي العمليات" })} value={String(su.totalOperations)} accent="#3b82f6" hint={tr({ en: "operations performed", ar: "العمليات المنفّذة" })} />
        <Card label={tr({ en: "Avg / Operation", ar: "متوسط/عملية" })} value={money(su.avgPerOperation)} accent="#0ea5e9" hint={tr({ en: "average earning per op", ar: "متوسط الربح للعملية" })} />
        <Card label={tr({ en: "Pending Payments", ar: "مدفوعات معلّقة" })} value={money(su.pendingPayments)} accent="#e11d48" hint={tr({ en: "earned − paid", ar: "المكتسب − المدفوع" })} />
        <Card label={tr({ en: "Paid Amount", ar: "المبلغ المدفوع" })} value={money(su.paidAmount)} accent="#10b981" hint={tr({ en: "payouts received", ar: "الدفعات المستلمة" })} />
        <Card label={tr({ en: "Clinic Profit", ar: "ربح العيادة" })} value={money(su.clinicProfitGenerated)} accent="#10b981" hint={tr({ en: "clinic share from their ops", ar: "حصة العيادة من عملياته" })} />
        <Card label={tr({ en: "Status", ar: "الحالة" })} value={tr(PAY_STATUS[su.status] ?? PAY_STATUS.none)} hint={tr({ en: "settlement status", ar: "حالة التسوية" })} />
      </div>

      {/* Monthly earnings */}
      <div className="rounded-2xl border border-primary/12 bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-ink">{tr({ en: "Monthly Earnings", ar: "الأرباح الشهرية" })}</h3>
            <p className="mt-0.5 text-xs text-muted">{tr({ en: "Click a month to filter the operations below.", ar: "اضغط شهرًا لتصفية العمليات بالأسفل." })}</p>
          </div>
          <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setMonthFilter(null); }} className="rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="mt-4">
          <BarChart
            data={data.yearly.map((m) => ({ key: m.key, label: monthLabel(m.key), value: m.doctorEarnings, sub: tr({ en: "earnings", ar: "الأرباح" }) }))}
            color={CHART_COLORS.gold}
            format={money}
            onSelect={(key) => setMonthFilter((cur) => (cur === key ? null : key))}
            activeKey={monthFilter}
          />
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/10 text-xs text-muted">
                <th className="px-2 py-2 text-start font-semibold">{tr({ en: "Month", ar: "الشهر" })}</th>
                <th className="px-2 py-2 text-center font-semibold">{tr({ en: "Ops", ar: "عمليات" })}</th>
                <th className="px-2 py-2 text-end font-semibold">{tr({ en: "Revenue", ar: "الإيراد" })}</th>
                <th className="px-2 py-2 text-end font-semibold">{tr({ en: "Doctor", ar: "الطبيب" })}</th>
                <th className="px-2 py-2 text-end font-semibold">{tr({ en: "Clinic", ar: "العيادة" })}</th>
                <th className="px-2 py-2 text-end font-semibold">{tr({ en: "Paid", ar: "المدفوع" })}</th>
                <th className="px-2 py-2 text-end font-semibold">{tr({ en: "Remaining", ar: "المتبقي" })}</th>
              </tr>
            </thead>
            <tbody>
              {data.yearly.map((m) => {
                const active = monthFilter === m.key;
                return (
                  <tr key={m.key} onClick={() => setMonthFilter((cur) => (cur === m.key ? null : m.key))} className={`cursor-pointer border-b border-primary/6 last:border-0 ${active ? "bg-primary/10" : "hover:bg-primary/5"}`}>
                    <td className="px-2 py-2 font-semibold text-ink">{monthLabel(m.key)} {m.key.split("-")[0]}</td>
                    <td className="px-2 py-2 text-center text-muted">{m.operations}</td>
                    <td className="px-2 py-2 text-end text-ink">{money(m.revenue)}</td>
                    <td className="px-2 py-2 text-end text-violet-600">{money(m.doctorEarnings)}</td>
                    <td className="px-2 py-2 text-end text-emerald-700">{money(m.clinicEarnings)}</td>
                    <td className="px-2 py-2 text-end text-ink">{money(m.paid)}</td>
                    <td className={`px-2 py-2 text-end font-semibold ${m.remaining > 0 ? "text-rose-600" : "text-emerald-700"}`}>{money(m.remaining)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Operation history */}
      <div className="rounded-2xl border border-primary/12 bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-ink">
            {tr({ en: "Operation History", ar: "سجل العمليات" })}
            {monthFilter && <span className="ms-2 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">{monthLabel(monthFilter)} {monthFilter.split("-")[0]} ✕</span>}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {monthFilter && <button onClick={() => setMonthFilter(null)} className="rounded-lg border border-primary/15 px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-ink">{tr({ en: "Clear month", ar: "مسح الشهر" })}</button>}
            <input value={opSearch} onChange={(e) => setOpSearch(e.target.value)} placeholder={tr({ en: "Search…", ar: "بحث…" })} className="rounded-lg border border-primary/15 bg-background px-3 py-1.5 text-sm text-ink outline-none focus:border-primary" />
            <select value={opStatus} onChange={(e) => setOpStatus(e.target.value)} className="rounded-lg border border-primary/15 bg-background px-2.5 py-1.5 text-sm text-ink outline-none focus:border-primary">
              <option value="">{tr({ en: "All", ar: "الكل" })}</option>
              <option value="paid">{tr(PAY_STATUS.paid)}</option>
              <option value="partial">{tr(PAY_STATUS.partial)}</option>
              <option value="pending">{tr(PAY_STATUS.pending)}</option>
            </select>
          </div>
        </div>

        <div className="mt-3 max-h-[520px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-surface-2">
              <tr className="text-xs text-muted">
                <th className="whitespace-nowrap px-2 py-2 text-start font-semibold">{tr({ en: "Date", ar: "التاريخ" })}</th>
                <th className="whitespace-nowrap px-2 py-2 text-start font-semibold">{tr({ en: "Patient", ar: "المريض" })}</th>
                <th className="whitespace-nowrap px-2 py-2 text-start font-semibold">{tr({ en: "Operation", ar: "العملية" })}</th>
                <th className="whitespace-nowrap px-2 py-2 text-start font-semibold">{tr({ en: "Category", ar: "التصنيف" })}</th>
                <th className="whitespace-nowrap px-2 py-2 text-end font-semibold">{tr({ en: "Price", ar: "السعر" })}</th>
                <th className="whitespace-nowrap px-2 py-2 text-center font-semibold">{tr({ en: "%", ar: "%" })}</th>
                <th className="whitespace-nowrap px-2 py-2 text-end font-semibold">{tr({ en: "Doctor", ar: "الطبيب" })}</th>
                <th className="whitespace-nowrap px-2 py-2 text-end font-semibold">{tr({ en: "Clinic", ar: "العيادة" })}</th>
                <th className="whitespace-nowrap px-2 py-2 text-center font-semibold">{tr({ en: "Payment", ar: "الدفع" })}</th>
                <th className="whitespace-nowrap px-2 py-2 text-center font-semibold">{tr({ en: "Paid On", ar: "تاريخ الدفع" })}</th>
                <th className="whitespace-nowrap px-2 py-2 text-start font-semibold">{tr({ en: "Notes", ar: "ملاحظات" })}</th>
              </tr>
            </thead>
            <tbody>
              {visibleOps.length === 0 ? (
                <tr><td colSpan={11} className="py-10 text-center text-muted">{tr({ en: "No operations.", ar: "لا عمليات." })}</td></tr>
              ) : (
                visibleOps.map((o) => {
                  const st = PAY_STATUS[o.paymentStatus] ?? PAY_STATUS.none;
                  return (
                    <tr key={o.id} className="border-t border-primary/8 hover:bg-primary/5">
                      <td className="whitespace-nowrap px-2 py-2 text-muted">{dateLabel(o.performedAt)}</td>
                      <td className="px-2 py-2">
                        <span className="font-semibold text-ink">{o.patientName || "—"}</span>
                        {o.patientCode && <span className="ms-1 text-[11px] text-muted">#{o.patientCode}</span>}
                      </td>
                      <td className="px-2 py-2 text-ink">{opName(o)}</td>
                      <td className="px-2 py-2 text-muted">{o.category}</td>
                      <td className="px-2 py-2 text-end text-ink">{money(o.price)}</td>
                      <td className="px-2 py-2 text-center text-muted">{o.commissionPct}%</td>
                      <td className="px-2 py-2 text-end font-semibold text-violet-600">{money(o.amount)}</td>
                      <td className="px-2 py-2 text-end text-emerald-700">{money(o.clinicEarnings)}</td>
                      <td className="px-2 py-2 text-center"><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{tr(st)}</span></td>
                      <td className="whitespace-nowrap px-2 py-2 text-center text-muted">{dateLabel(o.paymentDate)}</td>
                      <td className="max-w-40 truncate px-2 py-2 text-muted" title={o.notes || ""}>{o.notes || "—"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment management */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-primary/12 bg-surface p-5 lg:col-span-1">
          <h3 className="text-sm font-bold text-ink">{tr({ en: "Record a Payout", ar: "تسجيل دفعة" })}</h3>
          <p className="mt-0.5 text-xs text-muted">{tr({ en: "Pay the doctor against their pending earnings.", ar: "ادفع للطبيب من أرباحه المعلّقة." })}</p>
          <form onSubmit={submitPayout} className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold text-muted">{tr({ en: "Amount (EGP)", ar: "المبلغ (ج.م)" })}</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.01" required dir="ltr" className="mt-1 w-full rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-muted">{tr({ en: "Method", ar: "الطريقة" })}</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-lg border border-primary/15 bg-background px-2 py-2 text-sm text-ink outline-none focus:border-primary">
                  <option value="cash">{tr({ en: "Cash", ar: "نقدًا" })}</option>
                  <option value="card">{tr({ en: "Card", ar: "بطاقة" })}</option>
                  <option value="transfer">{tr({ en: "Transfer", ar: "تحويل" })}</option>
                  <option value="other">{tr({ en: "Other", ar: "أخرى" })}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted">{tr({ en: "Date", ar: "التاريخ" })}</label>
                <input value={paidAt} onChange={(e) => setPaidAt(e.target.value)} type="date" dir="ltr" className="mt-1 w-full rounded-lg border border-primary/15 bg-background px-2 py-2 text-sm text-ink outline-none focus:border-primary" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted">{tr({ en: "Reference (optional)", ar: "مرجع (اختياري)" })}</label>
              <input value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1 w-full rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted">{tr({ en: "Note (optional)", ar: "ملاحظة (اختياري)" })}</label>
              <input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
            </div>
            <button disabled={posting} className="w-full rounded-lg bg-primary py-2.5 text-sm font-bold text-[#0a0e12] transition hover:bg-primary-dark disabled:opacity-50">
              {posting ? tr({ en: "Saving…", ar: "جارٍ الحفظ…" }) : tr({ en: "Record Payout", ar: "تسجيل الدفعة" })}
            </button>
          </form>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-emerald-50 p-3 text-center">
              <p className="text-[11px] font-semibold text-emerald-700">{tr({ en: "Total Paid", ar: "إجمالي المدفوع" })}</p>
              <p className="text-lg font-extrabold text-emerald-700">{money(su.paidAmount)}</p>
            </div>
            <div className="rounded-xl bg-rose-50 p-3 text-center">
              <p className="text-[11px] font-semibold text-rose-700">{tr({ en: "Pending", ar: "المتبقي" })}</p>
              <p className="text-lg font-extrabold text-rose-700">{money(su.pendingPayments)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/12 bg-surface p-5 lg:col-span-2">
          <h3 className="text-sm font-bold text-ink">{tr({ en: "Payment History", ar: "سجل الدفعات" })}</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary/10 text-xs text-muted">
                  <th className="px-2 py-2 text-start font-semibold">{tr({ en: "Date", ar: "التاريخ" })}</th>
                  <th className="px-2 py-2 text-end font-semibold">{tr({ en: "Amount", ar: "المبلغ" })}</th>
                  <th className="px-2 py-2 text-start font-semibold">{tr({ en: "Method", ar: "الطريقة" })}</th>
                  <th className="px-2 py-2 text-start font-semibold">{tr({ en: "Reference", ar: "المرجع" })}</th>
                  <th className="px-2 py-2 text-start font-semibold">{tr({ en: "Note", ar: "ملاحظة" })}</th>
                  <th className="px-2 py-2 text-center font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-muted">{tr({ en: "No payouts yet.", ar: "لا دفعات بعد." })}</td></tr>
                ) : (
                  data.payouts.map((p) => (
                    <tr key={p.id} className="border-b border-primary/6 last:border-0">
                      <td className="whitespace-nowrap px-2 py-2 text-muted">{dateLabel(p.paidAt)}</td>
                      <td className="px-2 py-2 text-end font-bold text-emerald-700">{money(p.amount)}</td>
                      <td className="px-2 py-2 capitalize text-ink">{p.method}</td>
                      <td className="px-2 py-2 text-muted">{p.reference || "—"}</td>
                      <td className="max-w-40 truncate px-2 py-2 text-muted" title={p.note || ""}>{p.note || "—"}</td>
                      <td className="px-2 py-2 text-center">
                        <button onClick={() => deletePayout(p.id)} className="rounded-md border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50">{tr({ en: "Delete", ar: "حذف" })}</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function BackBtn({ onBack, label }: { onBack: () => void; label: string }) {
  return (
    <button onClick={onBack} className="flex items-center gap-1.5 rounded-lg border border-primary/15 px-3 py-2 text-sm font-semibold text-ink transition hover:border-primary hover:text-primary">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      {label}
    </button>
  );
}
