"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/language";
import { formatMoney } from "@/lib/patients";
import { PatientPrescriptions } from "./PatientPrescriptions";

export type Procedure = { id: string; nameEn: string; nameAr: string; price: number; cost: number | null; active: boolean };
export type DoctorLite = { id: string; nameEn: string; nameAr: string; commissionPct: number; active: boolean };
type TreatmentDoctor = { doctorId: string; nameEn: string; nameAr: string; commissionPct: number; amount: number };
type Treatment = {
  id: string;
  procedureId: string | null;
  nameEn: string;
  nameAr: string;
  basePrice: number | null;
  discountPct: number;
  price: number;
  cost: number | null;
  paid: number;
  notes: string | null;
  performedAt: string;
  doctors: TreatmentDoctor[];
};
type Payment = {
  id: string;
  amount: number;
  method: string;
  note: string | null;
  treatmentRecordId: string | null;
  paidAt: string;
};
type Totals = { billed: number; paid: number; balance: number };

const METHODS = ["cash", "card", "insurance", "transfer"] as const;
const METHOD_LABEL: Record<string, { en: string; ar: string }> = {
  cash: { en: "Cash", ar: "نقدًا" },
  card: { en: "Card", ar: "بطاقة" },
  insurance: { en: "Insurance", ar: "تأمين" },
  transfer: { en: "Transfer", ar: "تحويل" },
};

export function PatientOperations({ phone, name }: { phone: string; name: string }) {
  const { tr, lang } = useLang();
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totals, setTotals] = useState<Totals>({ billed: 0, paid: 0, balance: 0 });
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [doctors, setDoctors] = useState<DoctorLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "operation" | "payment">(null);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!phone) return;
    let alive = true;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/treatments?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
        if (res.ok && alive) {
          const j = await res.json();
          setTreatments(j.treatments ?? []);
          setPayments(j.payments ?? []);
          setTotals(j.totals ?? { billed: 0, paid: 0, balance: 0 });
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [phone, reloadKey]);

  useEffect(() => {
    fetch("/api/admin/procedures", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { procedures: [] }))
      .then((j) => setProcedures((j.procedures ?? []).filter((p: Procedure) => p.active)))
      .catch(() => {});
    fetch("/api/admin/doctors", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { doctors: [] }))
      .then((j) => setDoctors((j.doctors ?? []).filter((d: DoctorLite) => d.active)))
      .catch(() => {});
  }, []);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

  const deleteTreatment = async (id: string) => {
    if (!window.confirm(tr({ en: "Delete this operation?", ar: "حذف هذه العملية؟" }))) return;
    await fetch(`/api/admin/treatments/${id}`, { method: "DELETE" });
    reload();
  };
  const deletePayment = async (id: string) => {
    if (!window.confirm(tr({ en: "Delete this payment?", ar: "حذف هذه الدفعة؟" }))) return;
    await fetch(`/api/admin/payments/${id}`, { method: "DELETE" });
    reload();
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-primary/12 bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M12 11v6M9 14h6" /></svg>
          {tr({ en: "Operations & Payments", ar: "العمليات والمدفوعات" })}
        </h4>
      </div>

      {/* money summary */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Stat label={tr({ en: "Billed", ar: "الإجمالي" })} value={formatMoney(totals.billed, lang)} tone="gold" />
        <Stat label={tr({ en: "Paid", ar: "المدفوع" })} value={formatMoney(totals.paid, lang)} tone="green" />
        <Stat label={tr({ en: "Owed", ar: "المتبقي" })} value={formatMoney(totals.balance, lang)} tone={totals.balance > 0 ? "red" : "green"} />
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <button
          onClick={() => setModal("operation")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-3 py-1.5 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          {tr({ en: "Add operation", ar: "إضافة عملية" })}
        </button>
        <button
          onClick={() => setModal("payment")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/5"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h18M3 6h18v12H3zM7 15h4" /></svg>
          {tr({ en: "Record payment", ar: "تسجيل دفعة" })}
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-8 text-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : (
        <>
          {/* operations list */}
          {treatments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-primary/15 py-6 text-center text-sm text-muted">
              {tr({ en: "No operations recorded yet.", ar: "لا توجد عمليات مسجلة بعد." })}
            </p>
          ) : (
            <div className="space-y-2">
              {treatments.map((t) => {
                const remaining = Math.max(0, t.price - t.paid);
                const settled = remaining <= 0;
                const hasDiscount = t.discountPct > 0 && t.basePrice != null && t.basePrice > t.price;
                return (
                  <div key={t.id} className="rounded-xl border border-primary/10 bg-surface p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-ink">{lang === "ar" ? t.nameAr : t.nameEn}</p>
                        <p className="text-[11px] text-muted">{fmtDate(t.performedAt)}</p>
                      </div>
                      <button
                        onClick={() => deleteTreatment(t.id)}
                        title={tr({ en: "Delete", ar: "حذف" })}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-rose-600"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4h6v3" /></svg>
                      </button>
                    </div>
                    {t.notes && <p className="mt-1 text-xs text-ink/75">{t.notes}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="font-semibold text-ink/80">
                        {tr({ en: "Price", ar: "السعر" })}:{" "}
                        {hasDiscount && (
                          <span className="text-muted line-through">{formatMoney(t.basePrice!, lang)}</span>
                        )}{" "}
                        {formatMoney(t.price, lang)}
                      </span>
                      {hasDiscount && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-700">
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 9h.01M15 15h.01M16 8 8 16M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /></svg>
                          {tr({ en: `Discount ${t.discountPct}%`, ar: `خصم ${t.discountPct}٪` })}
                        </span>
                      )}
                      <span className="text-emerald-700">{tr({ en: "Paid", ar: "مدفوع" })}: {formatMoney(t.paid, lang)}</span>
                      {settled ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">
                          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                          {tr({ en: "Paid in full", ar: "مدفوعة بالكامل" })}
                        </span>
                      ) : (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 font-bold text-rose-600">
                          {tr({ en: "Remaining", ar: "متبقي" })}: {formatMoney(remaining, lang)}
                        </span>
                      )}
                    </div>
                    {t.doctors.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-primary/8 pt-2 text-[11px]">
                        <span className="font-semibold text-muted">{tr({ en: "Doctors", ar: "الأطباء" })}:</span>
                        {t.doctors.map((d) => (
                          <span key={d.doctorId} className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-2 py-0.5 font-semibold text-primary">
                            {lang === "ar" ? d.nameAr : d.nameEn} · {d.commissionPct}% · {formatMoney(d.amount, lang)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* payments list */}
          {payments.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">{tr({ en: "Payments", ar: "المدفوعات" })}</p>
              <div className="space-y-1.5">
                {payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border border-primary/8 bg-surface px-3 py-2 text-sm">
                    <span className="inline-flex items-center gap-2">
                      <span className="font-bold text-emerald-700">{formatMoney(p.amount, lang)}</span>
                      <span className="rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-semibold text-muted">{tr(METHOD_LABEL[p.method] ?? { en: p.method, ar: p.method })}</span>
                      <span className="text-[11px] text-muted">{fmtDate(p.paidAt)}</span>
                    </span>
                    <button
                      onClick={() => deletePayment(p.id)}
                      title={tr({ en: "Delete", ar: "حذف" })}
                      className="grid h-6 w-6 place-items-center rounded-md text-muted transition hover:bg-rose-500/10 hover:text-rose-600"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4h6v3" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {modal === "operation" && (
        <OperationModal
          phone={phone}
          name={name}
          procedures={procedures}
          doctors={doctors}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
      {modal === "payment" && (
        <PaymentModal
          phone={phone}
          name={name}
          treatments={treatments}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            reload();
          }}
        />
      )}
    </section>
      <PatientPrescriptions phone={phone} name={name} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "gold" | "green" | "red" }) {
  const map = {
    gold: "border-primary/20 bg-primary/8 text-primary",
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
    red: "border-rose-500/25 bg-rose-500/10 text-rose-600",
  } as const;
  return (
    <div className={`rounded-xl border p-2.5 text-center ${map[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold">{value}</p>
    </div>
  );
}

function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-primary/15 bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-extrabold text-ink">{title}</h3>
        {children}
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-primary/15 bg-surface px-3 py-2 text-ink outline-none focus:border-primary";

export function OperationModal({
  phone,
  name,
  procedures,
  doctors,
  onClose,
  onSaved,
}: {
  phone: string;
  name: string;
  procedures: Procedure[];
  doctors: DoctorLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { tr, lang } = useLang();
  const [procId, setProcId] = useState<string>(procedures[0]?.id ?? "custom");
  const [customName, setCustomName] = useState("");
  const [price, setPrice] = useState<string>(procedures[0] ? String(procedures[0].price) : "");
  const [discount, setDiscount] = useState("");
  const [assigned, setAssigned] = useState<{ doctorId: string; pct: string }[]>([]);
  const [payChoice, setPayChoice] = useState<"none" | "full" | "partial">("none");
  const [partial, setPartial] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const isCustom = procId === "custom";
  const priceNum = Number(price);
  const discountPct = Math.min(100, Math.max(0, Number(discount) || 0));
  // Net price after the percentage discount — this is what the patient owes.
  const netPrice = useMemo(
    () => (Number.isFinite(priceNum) ? Math.round(priceNum * (1 - discountPct / 100) * 100) / 100 : 0),
    [priceNum, discountPct]
  );

  // Commission preview: each assigned doctor takes pct% of the net price; the
  // clinic keeps the remainder. Σ doctor % must stay ≤ 100.
  const docName = (id: string) => {
    const d = doctors.find((x) => x.id === id);
    return d ? (lang === "ar" ? d.nameAr : d.nameEn) : "";
  };
  const preview = useMemo(() => {
    let totalPct = 0;
    const rows = assigned.map((a) => {
      const pct = Math.min(100, Math.max(0, Number(a.pct) || 0));
      totalPct += pct;
      return { doctorId: a.doctorId, pct, amount: Math.round(netPrice * (pct / 100) * 100) / 100 };
    });
    const docAmount = Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100;
    const clinicShare = Math.round((netPrice - docAmount) * 100) / 100;
    return { rows, totalPct: Math.round(totalPct * 100) / 100, docAmount, clinicShare };
  }, [assigned, netPrice]);
  const overCommission = preview.totalPct > 100;

  const availableDoctors = doctors.filter((d) => !assigned.some((a) => a.doctorId === d.id));
  const addDoctor = (id: string) => {
    const d = doctors.find((x) => x.id === id);
    if (!d) return;
    setAssigned((prev) => [...prev, { doctorId: id, pct: String(d.commissionPct || 0) }]);
  };
  const removeDoctor = (id: string) => setAssigned((prev) => prev.filter((a) => a.doctorId !== id));
  const setDoctorPct = (id: string, pct: string) =>
    setAssigned((prev) => prev.map((a) => (a.doctorId === id ? { ...a, pct } : a)));

  const paidNow = useMemo(() => {
    if (payChoice === "full") return netPrice;
    if (payChoice === "partial") return Number(partial) || 0;
    return 0;
  }, [payChoice, netPrice, partial]);

  const onPickProc = (id: string) => {
    setProcId(id);
    const p = procedures.find((x) => x.id === id);
    if (p) {
      setPrice(String(p.price));
    }
  };

  const save = async () => {
    if (!Number.isFinite(priceNum) || priceNum < 0) return;
    if (isCustom && !customName.trim()) return;
    if (overCommission) return;
    setSaving(true);
    try {
      const proc = procedures.find((x) => x.id === procId);
      const payload = {
        phone,
        name,
        procedureId: isCustom ? null : procId,
        nameEn: isCustom ? customName.trim() : proc?.nameEn ?? customName.trim(),
        nameAr: isCustom ? customName.trim() : proc?.nameAr ?? customName.trim(),
        price: priceNum, // list price (backend applies the discount)
        discountPct,
        doctors: assigned
          .filter((a) => (Number(a.pct) || 0) > 0)
          .map((a) => ({ doctorId: a.doctorId, commissionPct: Number(a.pct) || 0 })),
        notes: notes.trim() || undefined,
        paidNow: paidNow > 0 ? Math.min(paidNow, netPrice) : undefined,
        method,
      };
      await fetch("/api/admin/treatments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay title={tr({ en: "Add operation", ar: "إضافة عملية" })} onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">{tr({ en: "Operation", ar: "العملية" })}</span>
          <select className={inputCls} value={procId} onChange={(e) => onPickProc(e.target.value)}>
            {procedures.map((p) => (
              <option key={p.id} value={p.id}>
                {(lang === "ar" ? p.nameAr : p.nameEn)} — {p.price}
              </option>
            ))}
            <option value="custom">{tr({ en: "Custom…", ar: "أخرى…" })}</option>
          </select>
        </label>

        {isCustom && (
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">{tr({ en: "Operation name", ar: "اسم العملية" })}</span>
            <input className={inputCls} value={customName} onChange={(e) => setCustomName(e.target.value)} />
          </label>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">{tr({ en: "Price (EGP)", ar: "السعر (ج.م)" })}</span>
            <input type="number" min={0} dir="ltr" className={inputCls} value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">{tr({ en: "Discount %", ar: "الخصم ٪" })}</span>
            <input type="number" min={0} max={100} dir="ltr" className={inputCls} value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
          </label>
        </div>

        {doctors.length > 0 && (
          <div className="rounded-xl border border-primary/12 bg-surface-2 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-ink">{tr({ en: "Doctors", ar: "الأطباء" })}</span>
              {availableDoctors.length > 0 && (
                <select
                  className="rounded-lg border border-primary/15 bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-primary"
                  value=""
                  onChange={(e) => e.target.value && addDoctor(e.target.value)}
                >
                  <option value="">{tr({ en: "+ Add doctor", ar: "+ إضافة طبيب" })}</option>
                  {availableDoctors.map((d) => (
                    <option key={d.id} value={d.id}>{lang === "ar" ? d.nameAr : d.nameEn}</option>
                  ))}
                </select>
              )}
            </div>

            {assigned.length === 0 ? (
              <p className="py-1 text-xs text-muted">{tr({ en: "No doctor assigned. Add who performed this operation to track commission.", ar: "لم يُسند طبيب. أضف من أجرى هذه العملية لحساب العمولة." })}</p>
            ) : (
              <div className="space-y-1.5">
                {preview.rows.map((r) => (
                  <div key={r.doctorId} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{docName(r.doctorId)}</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        dir="ltr"
                        className="w-16 rounded-lg border border-primary/15 bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-primary"
                        value={assigned.find((a) => a.doctorId === r.doctorId)?.pct ?? ""}
                        onChange={(e) => setDoctorPct(r.doctorId, e.target.value)}
                      />
                      <span className="text-xs text-muted">%</span>
                    </div>
                    <span className="w-20 shrink-0 text-right text-xs font-bold text-primary">{formatMoney(r.amount, lang)}</span>
                    <button onClick={() => removeDoctor(r.doctorId)} title={tr({ en: "Remove", ar: "إزالة" })} className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted transition hover:bg-rose-500/10 hover:text-rose-600">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
                <div className="mt-1 flex items-center justify-between border-t border-primary/10 pt-1.5 text-xs">
                  <span className={`font-semibold ${overCommission ? "text-rose-600" : "text-muted"}`}>
                    {tr({ en: "Doctors", ar: "الأطباء" })}: {preview.totalPct}% · {formatMoney(preview.docAmount, lang)}
                  </span>
                  <span className="font-bold text-emerald-700">
                    {tr({ en: "Clinic", ar: "العيادة" })}: {formatMoney(preview.clinicShare, lang)}
                  </span>
                </div>
                {overCommission && (
                  <p className="text-[11px] font-semibold text-rose-600">{tr({ en: "Total commission can't exceed 100%.", ar: "لا يمكن أن يتجاوز إجمالي العمولة 100٪." })}</p>
                )}
              </div>
            )}
          </div>
        )}

        {discountPct > 0 && priceNum > 0 && (
          <p className="rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {tr({ en: "After discount", ar: "بعد الخصم" })}:{" "}
            <span className="text-muted line-through" dir="ltr">{priceNum}</span>{" "}
            <span className="font-bold" dir="ltr">{netPrice} {tr({ en: "EGP", ar: "ج.م" })}</span>{" "}
            <span className="font-semibold">({tr({ en: `−${discountPct}%`, ar: `خصم ${discountPct}٪` })})</span>
          </p>
        )}

        <div className="text-sm">
          <span className="mb-1 block font-semibold text-ink">{tr({ en: "Payment now", ar: "الدفع الآن" })}</span>
          <div className="flex gap-2">
            {(["none", "partial", "full"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setPayChoice(c)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
                  payChoice === c ? "border-primary bg-primary/15 text-primary" : "border-primary/15 text-muted hover:text-ink"
                }`}
              >
                {c === "none" ? tr({ en: "Nothing", ar: "لا شيء" }) : c === "partial" ? tr({ en: "Partial", ar: "جزئي" }) : tr({ en: "Full", ar: "بالكامل" })}
              </button>
            ))}
          </div>
        </div>

        {payChoice === "partial" && (
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">{tr({ en: "Amount paid now", ar: "المبلغ المدفوع الآن" })}</span>
            <input type="number" min={0} dir="ltr" className={inputCls} value={partial} onChange={(e) => setPartial(e.target.value)} />
          </label>
        )}

        {payChoice !== "none" && (
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">{tr({ en: "Method", ar: "طريقة الدفع" })}</span>
            <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m} value={m}>{tr(METHOD_LABEL[m])}</option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">{tr({ en: "Notes (optional)", ar: "ملاحظات (اختياري)" })}</span>
          <textarea rows={2} className={`${inputCls} resize-none`} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {netPrice > 0 && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-muted">
            {tr({ en: "Remaining after this", ar: "المتبقي بعد ذلك" })}:{" "}
            <span className="font-bold text-ink">{Math.max(0, netPrice - paidNow)} {tr({ en: "EGP", ar: "ج.م" })}</span>
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving || overCommission}
            className="flex-1 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {saving ? tr({ en: "Saving…", ar: "جارٍ الحفظ…" }) : tr({ en: "Save operation", ar: "حفظ العملية" })}
          </button>
          <button onClick={onClose} className="rounded-lg border border-primary/15 px-4 py-2 text-sm font-semibold text-muted transition hover:text-ink">
            {tr({ en: "Cancel", ar: "إلغاء" })}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function PaymentModal({
  phone,
  name,
  treatments,
  onClose,
  onSaved,
}: {
  phone: string;
  name: string;
  treatments: Treatment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { tr, lang } = useLang();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>("cash");
  const [treatmentRecordId, setTreatmentRecordId] = useState<string>("general");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const unpaid = treatments.filter((t) => t.price - t.paid > 0.001);

  const save = async () => {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    setSaving(true);
    try {
      await fetch("/api/admin/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          name,
          amount: amt,
          method,
          note: note.trim() || undefined,
          treatmentRecordId: treatmentRecordId === "general" ? undefined : treatmentRecordId,
        }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay title={tr({ en: "Record payment", ar: "تسجيل دفعة" })} onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">{tr({ en: "Amount (EGP)", ar: "المبلغ (ج.م)" })}</span>
          <input type="number" min={0} dir="ltr" className={inputCls} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </label>

        {unpaid.length > 0 && (
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">{tr({ en: "Toward", ar: "مقابل" })}</span>
            <select className={inputCls} value={treatmentRecordId} onChange={(e) => setTreatmentRecordId(e.target.value)}>
              <option value="general">{tr({ en: "General account", ar: "حساب عام" })}</option>
              {unpaid.map((t) => (
                <option key={t.id} value={t.id}>
                  {(lang === "ar" ? t.nameAr : t.nameEn)} — {tr({ en: "remaining", ar: "متبقي" })} {Math.max(0, t.price - t.paid)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">{tr({ en: "Method", ar: "طريقة الدفع" })}</span>
          <select className={inputCls} value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m} value={m}>{tr(METHOD_LABEL[m])}</option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-ink">{tr({ en: "Note (optional)", ar: "ملاحظة (اختياري)" })}</span>
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <div className="flex gap-2 pt-1">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {saving ? tr({ en: "Saving…", ar: "جارٍ الحفظ…" }) : tr({ en: "Save payment", ar: "حفظ الدفعة" })}
          </button>
          <button onClick={onClose} className="rounded-lg border border-primary/15 px-4 py-2 text-sm font-semibold text-muted transition hover:text-ink">
            {tr({ en: "Cancel", ar: "إلغاء" })}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
