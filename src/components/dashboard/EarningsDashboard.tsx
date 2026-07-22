"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/language";
import { formatMoney } from "@/lib/patients";
import { BarChart, GroupedBars, HBars, Donut, Legend, CHART_COLORS } from "./charts";
import { DoctorEarningsDetail } from "./DoctorEarningsDetail";

type Summary = {
  totalDoctors: number;
  totalOperations: number;
  totalRevenue: number;
  totalDoctorEarnings: number;
  totalMaterials: number;
  totalExpenses: number;
  totalClinicProfit: number;
  totalPaidToDoctors: number;
  totalPendingPayments: number;
};
type DoctorRow = {
  id: string;
  nameEn: string;
  nameAr: string;
  specialtyEn: string | null;
  specialtyAr: string | null;
  photoUrl: string | null;
  commissionPct: number;
  active: boolean;
  operations: number;
  revenue: number;
  earnings: number;
  clinicEarnings: number;
  monthEarnings: number;
  earnedTotal: number;
  paidTotal: number;
  pending: number;
  lastOpDate: string | null;
  status: "paid" | "partial" | "pending" | "none";
};
type Monthly = { key: string; revenue: number; doctorEarnings: number; clinicProfit: number; operations: number };
type ByType = { name: string; count: number; revenue: number; doctorEarnings: number; clinicEarnings: number };
type Data = { summary: Summary; doctors: DoctorRow[]; monthly: Monthly[]; byType: ByType[] };

type SortField = "earnings" | "revenue" | "operations" | "lastOp";
const PAGE_SIZE = 10;

const STATUS_STYLE: Record<DoctorRow["status"], { en: string; ar: string; cls: string }> = {
  paid: { en: "Paid", ar: "مدفوع", cls: "bg-emerald-100 text-emerald-700" },
  partial: { en: "Partially Paid", ar: "مدفوع جزئيًا", cls: "bg-amber-100 text-amber-700" },
  pending: { en: "Pending", ar: "معلّق", cls: "bg-rose-100 text-rose-700" },
  none: { en: "—", ar: "—", cls: "bg-slate-100 text-slate-500" },
};

function Kpi({ label, value, accent, hint, primary }: { label: string; value: string; accent: string; hint: string; primary?: boolean }) {
  return (
    <div
      title={hint}
      className={`rounded-2xl border p-4 ${primary ? "border-primary/30 bg-primary/10" : "border-primary/12 bg-surface"}`}
    >
      <p className={`text-xs font-semibold ${primary ? "text-primary" : "text-muted"}`}>{label}</p>
      <p className="mt-1 text-2xl font-extrabold" style={{ color: accent }}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{hint}</p>
    </div>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-primary/12 bg-surface p-5">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function EarningsDashboard() {
  const { tr, lang } = useLang();
  const money = (n: number) => formatMoney(n, lang);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortField, setSortField] = useState<SortField>("earnings");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    fetch(`/api/admin/earnings?${qs.toString()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setData(j))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [from, to]);

  const dName = (d: { nameEn: string; nameAr: string }) => (lang === "ar" ? d.nameAr : d.nameEn) || d.nameEn || d.nameAr;
  const dSpec = (d: DoctorRow) => (lang === "ar" ? d.specialtyAr : d.specialtyEn) || d.specialtyEn || d.specialtyAr || "";
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "short" }).format(new Date(y, m - 1, 1));
  };
  const dateLabel = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso)) : "—";

  const specialties = useMemo(() => {
    const set = new Set<string>();
    data?.doctors.forEach((d) => {
      const s = dSpec(d);
      if (s) set.add(s);
    });
    return [...set];
  }, [data, lang]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    let rows = data.doctors.filter((d) => {
      if (q && !dName(d).toLowerCase().includes(q) && !(d.nameEn + d.nameAr).toLowerCase().includes(q)) return false;
      if (specialty && dSpec(d) !== specialty) return false;
      if (statusFilter && d.status !== statusFilter) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      let av: number, bv: number;
      if (sortField === "revenue") [av, bv] = [a.revenue, b.revenue];
      else if (sortField === "operations") [av, bv] = [a.operations, b.operations];
      else if (sortField === "lastOp") [av, bv] = [a.lastOpDate ? Date.parse(a.lastOpDate) : 0, b.lastOpDate ? Date.parse(b.lastOpDate) : 0];
      else [av, bv] = [a.earnedTotal, b.earnedTotal];
      return (av - bv) * dir;
    });
    return rows;
  }, [data, search, specialty, statusFilter, sortField, sortDir, lang]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [search, specialty, statusFilter, sortField, sortDir, from, to]);

  const topEarners = useMemo(
    () => (data ? [...data.doctors].filter((d) => d.earnedTotal > 0).sort((a, b) => b.earnedTotal - a.earnedTotal).slice(0, 10) : []),
    [data],
  );

  if (selected) {
    return <DoctorEarningsDetail doctorId={selected} onBack={() => setSelected(null)} />;
  }

  const s = data?.summary;

  return (
    <div className="space-y-5">
      {/* Header + range + export */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink lg:text-2xl">{tr({ en: "Doctor Earnings", ar: "أرباح الأطباء" })}</h2>
          <p className="mt-0.5 text-sm text-muted">{tr({ en: "Doctor payroll — commissions earned, paid and pending, with per-doctor payouts.", ar: "رواتب الأطباء — العمولات المستحقة والمدفوعة والمعلّقة، مع دفعات كل طبيب." })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted">
            {tr({ en: "From", ar: "من" })}
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" className="rounded-lg border border-primary/15 bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-primary" />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted">
            {tr({ en: "To", ar: "إلى" })}
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" className="rounded-lg border border-primary/15 bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-primary" />
          </label>
          {(from || to) && (
            <button onClick={() => { setFrom(""); setTo(""); }} className="rounded-lg border border-primary/15 px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-ink">
              {tr({ en: "All time", ar: "كل الوقت" })}
            </button>
          )}
          <a href="/api/admin/earnings/export" className="rounded-lg bg-primary px-3 py-2 text-sm font-bold text-[#0a0e12] transition hover:bg-primary-dark">
            {tr({ en: "Export Excel", ar: "تصدير Excel" })}
          </a>
        </div>
      </div>

      {loading && !data ? (
        <SkeletonDashboard />
      ) : !s || !data ? (
        <p className="py-20 text-center text-sm text-muted">{tr({ en: "Could not load earnings.", ar: "تعذّر تحميل الأرباح." })}</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={tr({ en: "Total Doctors", ar: "عدد الأطباء" })} value={String(s.totalDoctors)} accent="#3b82f6" hint={tr({ en: "active doctors", ar: "الأطباء النشطون" })} />
            <Kpi label={tr({ en: "Total Operations", ar: "عدد العمليات" })} value={String(s.totalOperations)} accent="#1c2127" hint={tr({ en: "operations in range", ar: "العمليات في المدة" })} />
            <Kpi label={tr({ en: "Total Revenue", ar: "إجمالي الإيراد" })} value={money(s.totalRevenue)} accent="#a87f2b" hint={tr({ en: "patient prices billed", ar: "أسعار المرضى" })} />
            <Kpi label={tr({ en: "Doctor Earnings", ar: "أرباح الأطباء" })} value={money(s.totalDoctorEarnings)} accent="#8b5cf6" hint={tr({ en: "commissions accrued", ar: "العمولات المستحقة" })} />
            <Kpi label={tr({ en: "Clinic Profit", ar: "ربح العيادة" })} value={money(s.totalClinicProfit)} accent="#10b981" hint={tr({ en: "revenue − commissions − materials − expenses", ar: "الإيراد − العمولات − الخامات − المصروفات" })} />
            <Kpi label={tr({ en: "Paid to Doctors", ar: "المدفوع للأطباء" })} value={money(s.totalPaidToDoctors)} accent="#0ea5e9" hint={tr({ en: "payouts recorded", ar: "الدفعات المسجّلة" })} />
            <Kpi label={tr({ en: "Pending Payments", ar: "مدفوعات معلّقة" })} value={money(s.totalPendingPayments)} accent="#e11d48" hint={tr({ en: "earned − paid (lifetime)", ar: "المكتسب − المدفوع (الإجمالي)" })} />
            <Kpi label={tr({ en: "Clinic Expenses", ar: "مصروفات العيادة" })} value={money(s.totalExpenses)} accent="#e11d48" hint={tr({ en: "rent, electricity, etc.", ar: "إيجار، كهرباء، إلخ" })} />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title={tr({ en: "Revenue vs Doctor Earnings vs Clinic Profit", ar: "الإيراد مقابل أرباح الأطباء وربح العيادة" })} hint={tr({ en: "Last 12 months", ar: "آخر ١٢ شهر" })}>
              <Legend items={[{ name: tr({ en: "Revenue", ar: "الإيراد" }), color: CHART_COLORS.gold }, { name: tr({ en: "Doctor", ar: "الطبيب" }), color: CHART_COLORS.violet }, { name: tr({ en: "Clinic", ar: "العيادة" }), color: CHART_COLORS.emerald }]} />
              <div className="mt-3">
                <GroupedBars
                  data={data.monthly.map((m) => ({ key: m.key, label: monthLabel(m.key), values: [m.revenue, m.doctorEarnings, m.clinicProfit] }))}
                  series={[{ name: tr({ en: "Revenue", ar: "الإيراد" }), color: CHART_COLORS.gold }, { name: tr({ en: "Doctor", ar: "الطبيب" }), color: CHART_COLORS.violet }, { name: tr({ en: "Clinic", ar: "العيادة" }), color: CHART_COLORS.emerald }]}
                  format={money}
                />
              </div>
            </ChartCard>

            <ChartCard title={tr({ en: "Operations per Month", ar: "العمليات شهريًا" })} hint={tr({ en: "Last 12 months", ar: "آخر ١٢ شهر" })}>
              <BarChart data={data.monthly.map((m) => ({ key: m.key, label: monthLabel(m.key), value: m.operations, sub: tr({ en: "operations", ar: "عملية" }) }))} color={CHART_COLORS.blue} format={(n) => String(n)} />
            </ChartCard>

            <ChartCard title={tr({ en: "Top 10 Earning Doctors", ar: "أعلى ١٠ أطباء دخلاً" })} hint={tr({ en: "Lifetime earnings", ar: "الأرباح الإجمالية" })}>
              {topEarners.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">{tr({ en: "No earnings yet.", ar: "لا أرباح بعد." })}</p>
              ) : (
                <HBars data={topEarners.map((d) => ({ key: d.id, label: dName(d), value: d.earnedTotal }))} format={money} onSelect={(id) => setSelected(id)} />
              )}
            </ChartCard>

            <ChartCard title={tr({ en: "Earnings by Operation Type", ar: "الأرباح حسب نوع العملية" })} hint={tr({ en: "Doctor earnings per operation type", ar: "أرباح الأطباء لكل نوع" })}>
              {data.byType.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">{tr({ en: "No operations yet.", ar: "لا عمليات بعد." })}</p>
              ) : (
                <HBars data={data.byType.slice(0, 10).map((t) => ({ key: t.name, label: t.name, value: t.doctorEarnings }))} color={CHART_COLORS.violet} format={money} />
              )}
            </ChartCard>

            <ChartCard title={tr({ en: "Payment Status (Paid vs Pending)", ar: "حالة السداد (مدفوع/معلّق)" })} hint={tr({ en: "Doctor payouts settlement", ar: "تسوية دفعات الأطباء" })}>
              <Donut
                slices={[
                  { key: "paid", label: tr({ en: "Paid", ar: "مدفوع" }), value: s.totalPaidToDoctors, color: CHART_COLORS.emerald },
                  { key: "pending", label: tr({ en: "Pending", ar: "معلّق" }), value: s.totalPendingPayments, color: CHART_COLORS.rose },
                ]}
                format={money}
              />
            </ChartCard>

            <ChartCard title={tr({ en: "Clinic Profit by Month", ar: "ربح العيادة شهريًا" })} hint={tr({ en: "Net after commissions, materials & expenses", ar: "الصافي بعد العمولات والخامات والمصروفات" })}>
              <BarChart data={data.monthly.map((m) => ({ key: m.key, label: monthLabel(m.key), value: Math.max(0, m.clinicProfit), sub: tr({ en: "clinic profit", ar: "ربح العيادة" }) }))} color={CHART_COLORS.emerald} format={money} />
            </ChartCard>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/12 bg-surface p-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr({ en: "Search doctor…", ar: "ابحث عن طبيب…" })}
              className="min-w-40 flex-1 rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary"
            />
            <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary">
              <option value="">{tr({ en: "All specialties", ar: "كل التخصصات" })}</option>
              {specialties.map((sp) => <option key={sp} value={sp}>{sp}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary">
              <option value="">{tr({ en: "All statuses", ar: "كل الحالات" })}</option>
              <option value="paid">{tr(STATUS_STYLE.paid)}</option>
              <option value="partial">{tr(STATUS_STYLE.partial)}</option>
              <option value="pending">{tr(STATUS_STYLE.pending)}</option>
            </select>
            <select value={sortField} onChange={(e) => setSortField(e.target.value as SortField)} className="rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary">
              <option value="earnings">{tr({ en: "Sort: Earnings", ar: "ترتيب: الأرباح" })}</option>
              <option value="revenue">{tr({ en: "Sort: Revenue", ar: "ترتيب: الإيراد" })}</option>
              <option value="operations">{tr({ en: "Sort: Operations", ar: "ترتيب: العمليات" })}</option>
              <option value="lastOp">{tr({ en: "Sort: Last Operation", ar: "ترتيب: آخر عملية" })}</option>
            </select>
            <button onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))} className="rounded-lg border border-primary/15 px-2.5 py-2 text-sm font-semibold text-ink hover:border-primary" title={tr({ en: "Toggle direction", ar: "عكس الاتجاه" })}>
              {sortDir === "asc" ? "↑" : "↓"}
            </button>
          </div>

          {/* Doctors table */}
          <div className="overflow-hidden rounded-2xl border border-primary/12 bg-surface">
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-surface-2">
                  <tr className="text-xs text-muted">
                    <Th>{tr({ en: "Doctor", ar: "الطبيب" })}</Th>
                    <Th>{tr({ en: "Specialty", ar: "التخصص" })}</Th>
                    <Th center>{tr({ en: "Ops", ar: "عمليات" })}</Th>
                    <Th end>{tr({ en: "Revenue", ar: "الإيراد" })}</Th>
                    <Th end>{tr({ en: "Doctor Earnings", ar: "أرباح الطبيب" })}</Th>
                    <Th end>{tr({ en: "Clinic Earnings", ar: "أرباح العيادة" })}</Th>
                    <Th end>{tr({ en: "This Month", ar: "هذا الشهر" })}</Th>
                    <Th end>{tr({ en: "Pending", ar: "المعلّق" })}</Th>
                    <Th center>{tr({ en: "Last Op", ar: "آخر عملية" })}</Th>
                    <Th center>{tr({ en: "Status", ar: "الحالة" })}</Th>
                    <Th center>{tr({ en: "Details", ar: "التفاصيل" })}</Th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr><td colSpan={11} className="py-12 text-center text-muted">{tr({ en: "No doctors match.", ar: "لا أطباء مطابقون." })}</td></tr>
                  ) : (
                    pageRows.map((d) => {
                      const st = STATUS_STYLE[d.status];
                      return (
                        <tr key={d.id} className="border-t border-primary/8 hover:bg-primary/5">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 text-xs font-bold text-primary">
                                {d.photoUrl ? <img src={d.photoUrl} alt="" className="h-full w-full object-cover" /> : dName(d).slice(0, 1)}
                              </span>
                              <span className="font-semibold text-ink">{dName(d)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-muted">{dSpec(d) || "—"}</td>
                          <td className="px-3 py-2.5 text-center text-ink">{d.operations}</td>
                          <td className="px-3 py-2.5 text-end text-ink">{money(d.revenue)}</td>
                          <td className="px-3 py-2.5 text-end font-semibold text-violet-600">{money(d.earnings)}</td>
                          <td className="px-3 py-2.5 text-end text-emerald-700">{money(d.clinicEarnings)}</td>
                          <td className="px-3 py-2.5 text-end text-ink">{money(d.monthEarnings)}</td>
                          <td className="px-3 py-2.5 text-end font-semibold text-rose-600">{money(d.pending)}</td>
                          <td className="px-3 py-2.5 text-center text-muted">{dateLabel(d.lastOpDate)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}>{tr(st)}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <button onClick={() => setSelected(d.id)} className="rounded-lg border border-primary/25 px-2.5 py-1 text-xs font-bold text-primary transition hover:bg-primary hover:text-[#0a0e12]">
                              {tr({ en: "View", ar: "عرض" })}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-between gap-3 border-t border-primary/10 px-4 py-3 text-sm">
                <span className="text-muted">{tr({ en: `Page ${page} of ${pageCount}`, ar: `صفحة ${page} من ${pageCount}` })} · {filtered.length} {tr({ en: "doctors", ar: "طبيب" })}</span>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-primary/15 px-3 py-1.5 font-semibold text-ink disabled:opacity-40">{tr({ en: "Prev", ar: "السابق" })}</button>
                  <button disabled={page >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))} className="rounded-lg border border-primary/15 px-3 py-1.5 font-semibold text-ink disabled:opacity-40">{tr({ en: "Next", ar: "التالي" })}</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Th({ children, center, end }: { children: React.ReactNode; center?: boolean; end?: boolean }) {
  return <th className={`whitespace-nowrap px-3 py-2.5 font-semibold ${center ? "text-center" : end ? "text-end" : "text-start"}`}>{children}</th>;
}

function SkeletonDashboard() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-2" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-surface-2" />)}
      </div>
      <div className="h-96 animate-pulse rounded-2xl bg-surface-2" />
    </div>
  );
}
