"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { formatMoney } from "@/lib/patients";

type Procedure = {
  id: string;
  nameEn: string;
  nameAr: string;
  price: number;
  cost: number | null;
  active: boolean;
};

type Draft = { id?: string; nameEn: string; nameAr: string; price: string; cost: string };

export function OperationsManager() {
  const { tr, lang } = useLang();
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/procedures", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setProcedures(j.procedures ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startAdd = () => setEditing({ nameEn: "", nameAr: "", price: "", cost: "" });
  const startEdit = (p: Procedure) =>
    setEditing({ id: p.id, nameEn: p.nameEn, nameAr: p.nameAr, price: String(p.price), cost: p.cost == null ? "" : String(p.cost) });

  const save = async () => {
    if (!editing) return;
    const price = Number(editing.price);
    if ((!editing.nameEn.trim() && !editing.nameAr.trim()) || !Number.isFinite(price) || price < 0) return;
    const costTrim = editing.cost.trim();
    const cost = costTrim === "" ? null : Number(costTrim);
    if (cost != null && (!Number.isFinite(cost) || cost < 0)) return;
    setSaving(true);
    try {
      const payload = { nameEn: editing.nameEn.trim(), nameAr: editing.nameAr.trim(), price, cost };
      if (editing.id) {
        await fetch(`/api/admin/procedures/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch("/api/admin/procedures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Procedure) => {
    await fetch(`/api/admin/procedures/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    load();
  };

  const remove = async (p: Procedure) => {
    if (!window.confirm(tr({ en: `Delete "${p.nameEn}"?`, ar: `حذف "${p.nameAr}"؟` }))) return;
    await fetch(`/api/admin/procedures/${p.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">
            {tr({ en: "Operations", ar: "العمليات" })}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {tr({ en: "Your procedures and their prices — used when recording a patient's treatment.", ar: "العمليات وأسعارها — تُستخدم عند تسجيل علاج المريض." })}
          </p>
        </div>
        <button
          onClick={startAdd}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-3.5 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          {tr({ en: "Add operation", ar: "إضافة عملية" })}
        </button>
      </div>

      {editing && (
        <div className="rounded-2xl border border-primary/20 bg-surface p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-ink">{tr({ en: "Name (Arabic)", ar: "الاسم بالعربي" })}</span>
              <input
                className="w-full rounded-lg border border-primary/15 bg-background px-3 py-2 text-ink outline-none focus:border-primary"
                value={editing.nameAr}
                onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })}
                placeholder="خلع، تركيب…"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-ink">{tr({ en: "Name (English)", ar: "الاسم بالإنجليزي" })}</span>
              <input
                className="w-full rounded-lg border border-primary/15 bg-background px-3 py-2 text-ink outline-none focus:border-primary"
                value={editing.nameEn}
                onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })}
                placeholder="Extraction, Crown…"
                dir="ltr"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-ink">{tr({ en: "Patient price (EGP)", ar: "سعر المريض (ج.م)" })}</span>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-primary/15 bg-background px-3 py-2 text-ink outline-none focus:border-primary"
                value={editing.price}
                onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                dir="ltr"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-semibold text-ink">
                {tr({ en: "Net cost (optional)", ar: "التكلفة الصافية (اختياري)" })}
              </span>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-primary/15 bg-background px-3 py-2 text-ink outline-none focus:border-primary"
                value={editing.cost}
                onChange={(e) => setEditing({ ...editing, cost: e.target.value })}
                placeholder={tr({ en: "materials/lab", ar: "خامات/معمل" })}
                dir="ltr"
              />
              <span className="mt-1 block text-[11px] text-muted">
                {tr({
                  en: "Cost before profit (materials, lab). Used to show your exact net profit — leave blank if unknown.",
                  ar: "التكلفة قبل الربح (خامات، معمل). تُستخدم لحساب صافي ربحك بدقة — اتركها فارغة إن لم تُعرف.",
                })}
              </span>
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {saving ? tr({ en: "Saving…", ar: "جارٍ الحفظ…" }) : tr({ en: "Save", ar: "حفظ" })}
            </button>
            <button
              onClick={() => setEditing(null)}
              className="rounded-lg border border-primary/15 px-4 py-2 text-sm font-semibold text-muted transition hover:text-ink"
            >
              {tr({ en: "Cancel", ar: "إلغاء" })}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-16 text-muted">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : procedures.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-primary/20 bg-surface py-14 text-center text-sm text-muted">
          {tr({ en: "No operations yet. Add your first one.", ar: "لا توجد عمليات بعد. أضف أول عملية." })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-primary/12 bg-surface">
          {procedures.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-primary/8" : ""} ${p.active ? "" : "opacity-50"}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold text-ink">{lang === "ar" ? p.nameAr : p.nameEn}</p>
                <p className="truncate text-xs text-muted" dir={lang === "ar" ? "ltr" : "rtl"}>{lang === "ar" ? p.nameEn : p.nameAr}</p>
              </div>
              <div className="shrink-0 text-right">
                <span className="inline-block rounded-lg bg-primary/10 px-3 py-1 text-sm font-extrabold text-primary">
                  {formatMoney(p.price, lang)}
                </span>
                {p.cost != null && (
                  <span className="mt-0.5 block text-[11px] font-semibold text-emerald-600">
                    {tr({ en: "profit", ar: "ربح" })} {formatMoney(Math.max(0, p.price - p.cost), lang)}
                  </span>
                )}
              </div>
              <button
                onClick={() => toggleActive(p)}
                title={p.active ? tr({ en: "Active", ar: "مفعّلة" }) : tr({ en: "Hidden", ar: "مخفية" })}
                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${p.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
              >
                {p.active ? tr({ en: "Active", ar: "مفعّلة" }) : tr({ en: "Hidden", ar: "مخفية" })}
              </button>
              <button
                onClick={() => startEdit(p)}
                title={tr({ en: "Edit", ar: "تعديل" })}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-primary/10 hover:text-primary"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              </button>
              <button
                onClick={() => remove(p)}
                title={tr({ en: "Delete", ar: "حذف" })}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-rose-600"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4h6v3" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
