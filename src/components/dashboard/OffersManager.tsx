"use client";

import { useState } from "react";
import { useLang } from "@/lib/language";
import { Modal, Field, inputCls } from "./Modal";
import {
  useSite,
  offerIcons,
  type Offer,
} from "@/lib/siteStore";

const COLOR_CHOICES = ["#c9a24b", "#10b981", "#0ea5b7", "#3b82f6", "#8b5cf6", "#ec4899", "#ef4444", "#f59e0b"];
const ICON_CHOICES = Object.keys(offerIcons);

function emptyOffer(): Offer {
  return {
    id: `of-${Date.now().toString(36)}`,
    title: { en: "", ar: "" },
    desc: { en: "", ar: "" },
    badge: { en: "", ar: "" },
    color: COLOR_CHOICES[0],
    icon: "sparkle",
    active: true,
  };
}

function OfferForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Offer;
  onSave: (o: Offer) => void;
  onCancel: () => void;
}) {
  const { tr } = useLang();
  const [o, setO] = useState<Offer>(initial);
  const set = (patch: Partial<Offer>) => setO((p) => ({ ...p, ...patch }));
  const valid = o.title.en.trim() && o.title.ar.trim() && o.badge.en.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(o);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr({ en: "Title (English)", ar: "العنوان (إنجليزي)" })}>
          <input className={inputCls} value={o.title.en} onChange={(e) => set({ title: { ...o.title, en: e.target.value } })} dir="ltr" required />
        </Field>
        <Field label={tr({ en: "Title (Arabic)", ar: "العنوان (عربي)" })}>
          <input className={inputCls} value={o.title.ar} onChange={(e) => set({ title: { ...o.title, ar: e.target.value } })} dir="rtl" required />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={tr({ en: "Description (English)", ar: "الوصف (إنجليزي)" })}>
          <textarea className={`${inputCls} resize-none`} rows={2} value={o.desc.en} onChange={(e) => set({ desc: { ...o.desc, en: e.target.value } })} dir="ltr" />
        </Field>
        <Field label={tr({ en: "Description (Arabic)", ar: "الوصف (عربي)" })}>
          <textarea className={`${inputCls} resize-none`} rows={2} value={o.desc.ar} onChange={(e) => set({ desc: { ...o.desc, ar: e.target.value } })} dir="rtl" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={tr({ en: "Badge (English) e.g. 25% OFF", ar: "الشارة (إنجليزي)" })}>
          <input className={inputCls} value={o.badge.en} onChange={(e) => set({ badge: { ...o.badge, en: e.target.value } })} dir="ltr" required />
        </Field>
        <Field label={tr({ en: "Badge (Arabic) مثال خصم ٢٥٪", ar: "الشارة (عربي)" })}>
          <input className={inputCls} value={o.badge.ar} onChange={(e) => set({ badge: { ...o.badge, ar: e.target.value } })} dir="rtl" />
        </Field>
      </div>

      {/* color */}
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-ink">{tr({ en: "Color", ar: "اللون" })}</span>
        <div className="flex flex-wrap gap-2">
          {COLOR_CHOICES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => set({ color: c })}
              className={`h-8 w-8 rounded-full transition ${o.color === c ? "ring-2 ring-offset-2 ring-offset-surface" : ""}`}
              style={{ backgroundColor: c, boxShadow: o.color === c ? `0 0 0 2px ${c}` : undefined }}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      {/* icon */}
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-ink">{tr({ en: "Icon", ar: "الأيقونة" })}</span>
        <div className="flex flex-wrap gap-2">
          {ICON_CHOICES.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => set({ icon: key })}
              className={`grid h-10 w-10 place-items-center rounded-xl border transition ${
                o.icon === key ? "border-primary bg-primary/10 text-primary" : "border-primary/15 text-muted hover:text-ink"
              }`}
              aria-label={key}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={offerIcons[key]} />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2.5">
        <input type="checkbox" checked={o.active} onChange={(e) => set({ active: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
        <span className="text-sm font-semibold text-ink">{tr({ en: "Active (show on landing page)", ar: "مفعّل (يظهر في الصفحة الرئيسية)" })}</span>
      </label>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="rounded-lg border border-primary/15 px-4 py-2 text-sm font-semibold text-muted transition hover:text-ink">
          {tr({ en: "Cancel", ar: "إلغاء" })}
        </button>
        <button type="submit" disabled={!valid} className="rounded-lg bg-gradient-to-r from-primary to-primary-dark px-5 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50">
          {tr({ en: "Save Offer", ar: "حفظ العرض" })}
        </button>
      </div>
    </form>
  );
}

export function OffersManager() {
  const { tr, lang } = useLang();
  const { settings, update } = useSite();
  const [editing, setEditing] = useState<Offer | null>(null);
  const [open, setOpen] = useState(false);

  const startAdd = () => {
    setEditing(emptyOffer());
    setOpen(true);
  };
  const startEdit = (o: Offer) => {
    setEditing(o);
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setEditing(null);
  };

  const save = (o: Offer) => {
    const exists = settings.offers.some((x) => x.id === o.id);
    const offers = exists
      ? settings.offers.map((x) => (x.id === o.id ? o : x))
      : [...settings.offers, o];
    update({ offers });
    close();
  };

  const toggle = (id: string) =>
    update({ offers: settings.offers.map((x) => (x.id === id ? { ...x, active: !x.active } : x)) });

  const remove = (id: string) => {
    if (!window.confirm(tr({ en: "Delete this offer?", ar: "حذف هذا العرض؟" }))) return;
    update({ offers: settings.offers.filter((x) => x.id !== id) });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight lg:text-2xl">
            {tr({ en: "Offers & Discounts", ar: "العروض والخصومات" })}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {tr({ en: "Create promotions that appear on your landing page.", ar: "أنشئ عروضًا تظهر في صفحتك الرئيسية." })}
          </p>
        </div>
        <button onClick={startAdd} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-dark px-5 py-2.5 text-sm font-semibold text-[#0a0e12] shadow-lg shadow-primary/25 transition hover:-translate-y-0.5">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          {tr({ en: "Add Offer", ar: "إضافة عرض" })}
        </button>
      </div>

      {settings.offers.length === 0 ? (
        <div className="grid min-h-[20rem] place-items-center rounded-2xl border border-dashed border-primary/15 bg-surface text-center text-muted">
          <p>{tr({ en: "No offers yet. Add your first promotion.", ar: "لا توجد عروض بعد. أضف أول عرض." })}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {settings.offers.map((o) => (
            <div key={o.id} className="relative flex flex-col overflow-hidden rounded-2xl border border-primary/12 bg-surface p-5">
              <span className="pointer-events-none absolute -end-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: o.color }} />
              <div className="flex items-start justify-between gap-2">
                <span className="grid h-12 w-12 place-items-center rounded-xl text-white shadow-sm" style={{ backgroundColor: o.color }}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d={offerIcons[o.icon] ?? offerIcons.sparkle} />
                  </svg>
                </span>
                <span className="rounded-full px-2.5 py-1 text-xs font-extrabold text-white" style={{ backgroundColor: o.color }}>
                  {tr(o.badge)}
                </span>
              </div>
              <h3 className="mt-4 font-extrabold text-ink">{tr(o.title)}</h3>
              <p className="mt-1 flex-1 text-sm text-muted line-clamp-2">{tr(o.desc)}</p>

              <div className="mt-4 flex items-center justify-between border-t border-primary/10 pt-3">
                <button
                  onClick={() => toggle(o.id)}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold ${o.active ? "text-emerald-700" : "text-muted"}`}
                >
                  <span className={`relative h-4 w-7 rounded-full transition ${o.active ? "bg-emerald-500" : "bg-muted/40"}`}>
                    <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition ${o.active ? "end-0.5" : "start-0.5"}`} />
                  </span>
                  {o.active ? tr({ en: "Active", ar: "مفعّل" }) : tr({ en: "Hidden", ar: "مخفي" })}
                </button>
                <span className="flex gap-1">
                  <button onClick={() => startEdit(o)} title={tr({ en: "Edit", ar: "تعديل" })} className="grid h-7 w-7 place-items-center rounded-lg border border-primary/12 text-muted transition hover:border-primary/40 hover:text-primary">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                  <button onClick={() => remove(o.id)} title={tr({ en: "Delete", ar: "حذف" })} className="grid h-7 w-7 place-items-center rounded-lg border border-primary/12 text-muted transition hover:border-rose-400/40 hover:text-rose-600">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                    </svg>
                  </button>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={close} title={editing && settings.offers.some((x) => x.id === editing.id) ? tr({ en: "Edit Offer", ar: "تعديل العرض" }) : tr({ en: "Add Offer", ar: "إضافة عرض" })}>
        {editing && <OfferForm initial={editing} onSave={save} onCancel={close} />}
      </Modal>
    </div>
  );
}
