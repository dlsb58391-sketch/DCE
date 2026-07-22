"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { formatMoney } from "@/lib/patients";

type Expense = {
  id: string;
  labelEn: string;
  labelAr: string;
  kind: string;
  amount: number; // recurring default
  effective: number; // for the selected month
  overridden: boolean;
  active: boolean;
  sortOrder: number;
};

const KINDS = ["rent", "electricity", "custom"] as const;
const KIND_LABEL: Record<string, { en: string; ar: string }> = {
  rent: { en: "Rent", ar: "إيجار" },
  electricity: { en: "Electricity", ar: "كهرباء" },
  custom: { en: "Other", ar: "أخرى" },
};

const monthKeyNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/** Clinic expenses (rent, electricity, custom): recurring monthly with an
 * optional per-month override. Feeds the Revenue page's net-profit numbers. */
export function ClinicExpensesCard() {
  const { tr, lang } = useLang();
  const [month, setMonth] = useState(monthKeyNow());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ labelEn: "", labelAr: "", kind: "custom", amount: "" });

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/expenses?month=${encodeURIComponent(m)}`, { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setExpenses(j.expenses ?? []);
        setTotal(j.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [load, month]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/admin/expenses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await load(month);
  };

  const addExpense = async () => {
    if (!draft.labelEn.trim() && !draft.labelAr.trim()) return;
    await fetch("/api/admin/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        labelEn: draft.labelEn.trim(),
        labelAr: draft.labelAr.trim(),
        kind: draft.kind,
        amount: Number(draft.amount) || 0,
      }),
    });
    setDraft({ labelEn: "", labelAr: "", kind: "custom", amount: "" });
    setAdding(false);
    await load(month);
  };

  const remove = async (e: Expense) => {
    if (!window.confirm(tr({ en: `Delete "${e.labelEn || e.labelAr}"?`, ar: `حذف "${e.labelAr || e.labelEn}"؟` }))) return;
    await fetch(`/api/admin/expenses/${e.id}`, { method: "DELETE" });
    await load(month);
  };

  return (
    <div className="rounded-2xl border border-primary/12 bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 10h18M3 6h18v12H3zM7 15h5" />
            </svg>
          </span>
          <div>
            <h3 className="font-bold text-ink">{tr({ en: "Clinic expenses", ar: "مصروفات العيادة" })}</h3>
            <p className="mt-0.5 text-sm text-muted">
              {tr({
                en: "Rent, electricity and other monthly costs. Recurring by default — you can override a specific month. Subtracted from clinic profit on the Revenue page.",
                ar: "الإيجار والكهرباء والمصروفات الشهرية الأخرى. متكررة تلقائيًا — يمكنك تعديل شهر معيّن. تُخصم من ربح العيادة في صفحة الإيرادات.",
              })}
            </p>
          </div>
        </div>
        <label className="text-xs font-semibold text-muted">
          <span className="mb-1 block">{tr({ en: "Month", ar: "الشهر" })}</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value || monthKeyNow())}
            className="rounded-lg border border-primary/15 bg-background px-3 py-2 text-ink outline-none focus:border-primary"
            dir="ltr"
          />
        </label>
      </div>

      {loading ? (
        <div className="grid place-items-center py-10 text-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {expenses.length === 0 && !adding && (
            <p className="rounded-xl border border-dashed border-primary/15 py-6 text-center text-sm text-muted">
              {tr({ en: "No expenses yet. Add rent, electricity, etc.", ar: "لا توجد مصروفات بعد. أضف الإيجار والكهرباء وغيرها." })}
            </p>
          )}

          {expenses.map((e) => (
            <div key={e.id} className="rounded-xl border border-primary/10 bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-bold text-ink">{lang === "ar" ? e.labelAr : e.labelEn}</p>
                  <span className="rounded-md bg-primary/8 px-1.5 py-0.5 text-[10px] font-semibold text-muted">{tr(KIND_LABEL[e.kind] ?? KIND_LABEL.custom)}</span>
                </div>
                <button onClick={() => remove(e)} title={tr({ en: "Delete", ar: "حذف" })} className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-rose-600">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4h6v3" /></svg>
                </button>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-muted">
                  <span className="mb-1 block">{tr({ en: "Recurring monthly (EGP)", ar: "شهري متكرر (ج.م)" })}</span>
                  <input
                    type="number"
                    min={0}
                    dir="ltr"
                    defaultValue={e.amount}
                    onBlur={(ev) => {
                      const v = Number(ev.target.value);
                      if (Number.isFinite(v) && v >= 0 && v !== e.amount) patch(e.id, { amount: v });
                    }}
                    className="w-full rounded-lg border border-primary/15 bg-background px-3 py-2 text-ink outline-none focus:border-primary"
                  />
                </label>
                <label className="text-xs font-semibold text-muted">
                  <span className="mb-1 flex items-center gap-1.5">
                    {tr({ en: "This month", ar: "هذا الشهر" })}
                    {e.overridden && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{tr({ en: "overridden", ar: "معدّل" })}</span>}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      dir="ltr"
                      key={`${e.id}-${month}-${e.effective}`}
                      defaultValue={e.effective}
                      onBlur={(ev) => {
                        const v = Number(ev.target.value);
                        if (Number.isFinite(v) && v >= 0 && v !== e.effective) patch(e.id, { monthKey: month, monthAmount: v });
                      }}
                      className="w-full rounded-lg border border-primary/15 bg-background px-3 py-2 text-ink outline-none focus:border-primary"
                    />
                    {e.overridden && (
                      <button
                        onClick={() => patch(e.id, { monthKey: month, monthAmount: null })}
                        title={tr({ en: "Reset to recurring", ar: "إرجاع للمتكرر" })}
                        className="shrink-0 rounded-lg border border-primary/15 px-2 py-2 text-[11px] font-semibold text-muted transition hover:text-ink"
                      >
                        {tr({ en: "Reset", ar: "إرجاع" })}
                      </button>
                    )}
                  </div>
                </label>
              </div>
            </div>
          ))}

          {adding ? (
            <div className="rounded-xl border border-primary/20 bg-surface-2 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <input className="rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary" placeholder={tr({ en: "Label (Arabic)", ar: "الاسم بالعربي" })} value={draft.labelAr} onChange={(ev) => setDraft({ ...draft, labelAr: ev.target.value })} />
                <input className="rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary" placeholder={tr({ en: "Label (English)", ar: "الاسم بالإنجليزي" })} value={draft.labelEn} onChange={(ev) => setDraft({ ...draft, labelEn: ev.target.value })} dir="ltr" />
                <select className="rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary" value={draft.kind} onChange={(ev) => setDraft({ ...draft, kind: ev.target.value })}>
                  {KINDS.map((k) => <option key={k} value={k}>{tr(KIND_LABEL[k])}</option>)}
                </select>
                <input type="number" min={0} dir="ltr" className="rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary" placeholder={tr({ en: "Monthly amount (EGP)", ar: "المبلغ الشهري (ج.م)" })} value={draft.amount} onChange={(ev) => setDraft({ ...draft, amount: ev.target.value })} />
              </div>
              <div className="mt-2 flex gap-2">
                <button onClick={addExpense} className="rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5">{tr({ en: "Add", ar: "إضافة" })}</button>
                <button onClick={() => setAdding(false)} className="rounded-lg border border-primary/15 px-4 py-2 text-sm font-semibold text-muted transition hover:text-ink">{tr({ en: "Cancel", ar: "إلغاء" })}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-primary/20 px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/5">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              {tr({ en: "Add expense", ar: "إضافة مصروف" })}
            </button>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-primary/10 pt-3">
            <span className="text-sm font-bold text-ink">{tr({ en: "Total this month", ar: "إجمالي هذا الشهر" })}</span>
            <span className="rounded-lg bg-primary/10 px-3 py-1 text-sm font-extrabold text-primary">{formatMoney(total, lang)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
