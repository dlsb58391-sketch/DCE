"use client";

import { useRef, useState } from "react";
import { useLang } from "@/lib/language";
import { Field, inputCls } from "./Modal";
import {
  useSite,
  fileToDataURL,
  type SiteCase,
  type Theme,
} from "@/lib/siteStore";

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-primary/12 bg-surface p-5">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      {desc && <p className="mt-0.5 text-sm text-muted">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BilingualField({
  label,
  valueEn,
  valueAr,
  onEn,
  onAr,
  textarea,
}: {
  label: string;
  valueEn: string;
  valueAr: string;
  onEn: (v: string) => void;
  onAr: (v: string) => void;
  textarea?: boolean;
}) {
  const { tr } = useLang();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={`${label} (${tr({ en: "EN", ar: "إنجليزي" })})`}>
        {textarea ? (
          <textarea className={`${inputCls} resize-none`} rows={2} value={valueEn} onChange={(e) => onEn(e.target.value)} dir="ltr" />
        ) : (
          <input className={inputCls} value={valueEn} onChange={(e) => onEn(e.target.value)} dir="ltr" />
        )}
      </Field>
      <Field label={`${label} (${tr({ en: "AR", ar: "عربي" })})`}>
        {textarea ? (
          <textarea className={`${inputCls} resize-none`} rows={2} value={valueAr} onChange={(e) => onAr(e.target.value)} dir="rtl" />
        ) : (
          <input className={inputCls} value={valueAr} onChange={(e) => onAr(e.target.value)} dir="rtl" />
        )}
      </Field>
    </div>
  );
}

const THEME_FIELDS: { key: keyof Theme; label: { en: string; ar: string } }[] = [
  { key: "primary", label: { en: "Primary (gold)", ar: "الأساسي" } },
  { key: "primaryDark", label: { en: "Primary dark", ar: "الأساسي الغامق" } },
  { key: "accent", label: { en: "Accent", ar: "التمييز" } },
  { key: "background", label: { en: "Background", ar: "الخلفية" } },
  { key: "surface", label: { en: "Surface (cards)", ar: "البطاقات" } },
  { key: "surface2", label: { en: "Surface 2", ar: "سطح ٢" } },
];

export function SiteEditor() {
  const { tr } = useLang();
  const { settings, update, resetSettings } = useSite();
  const photoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const flash = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const data = await fileToDataURL(file, 1100, 0.9);
      update({ photo: data });
      flash();
    } finally {
      setBusy(false);
    }
  };

  const setTheme = (key: keyof Theme, value: string) =>
    update({ theme: { ...settings.theme, [key]: value } });

  /* cases */
  const addCase = () => {
    const c: SiteCase = {
      id: `case-${Date.now().toString(36)}`,
      before: "/cases/before-1-v4.png",
      after: "/cases/after-1-v4.png",
      label: { en: "New case", ar: "حالة جديدة" },
    };
    update({ cases: [...settings.cases, c] });
  };
  const updateCase = (id: string, patch: Partial<SiteCase>) =>
    update({ cases: settings.cases.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const removeCase = (id: string) =>
    update({ cases: settings.cases.filter((c) => c.id !== id) });
  const onCaseImage = async (id: string, side: "before" | "after", file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const data = await fileToDataURL(file, 1000, 0.85);
      updateCase(id, { [side]: data } as Partial<SiteCase>);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight lg:text-2xl">
            {tr({ en: "Landing Page Editor", ar: "محرر الصفحة الرئيسية" })}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {tr({ en: "Edit your photo, colors, text and cases — changes show on the public site.", ar: "عدّل صورتك وألوانك ونصوصك وحالاتك — تظهر التغييرات في الموقع." })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedFlash && (
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              {tr({ en: "Saved", ar: "تم الحفظ" })}
            </span>
          )}
          <a href="/" target="_blank" className="inline-flex items-center gap-1.5 rounded-lg border border-primary/15 px-3 py-2 text-sm font-semibold text-muted transition hover:border-primary/40 hover:text-primary">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 5h5v5M19 5l-9 9M10 5H5v14h14v-5" />
            </svg>
            {tr({ en: "Preview", ar: "معاينة" })}
          </a>
          <button onClick={() => { if (window.confirm(tr({ en: "Reset all landing content to defaults?", ar: "إعادة كل المحتوى للوضع الافتراضي؟" }))) resetSettings(); }} className="rounded-lg border border-primary/15 px-3 py-2 text-sm font-semibold text-muted transition hover:border-rose-400/40 hover:text-rose-600">
            {tr({ en: "Reset", ar: "إعادة تعيين" })}
          </button>
        </div>
      </div>

      {/* profile + identity */}
      <Section title={tr({ en: "Doctor Profile", ar: "ملف الطبيب" })}>
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="shrink-0">
            <div className="relative h-40 w-32 overflow-hidden rounded-2xl border border-primary/15 bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={settings.photo} alt="doctor" className="h-full w-full object-contain object-bottom" />
            </div>
            <input ref={photoInput} type="file" accept="image/*" hidden onChange={(e) => onPhoto(e.target.files?.[0])} />
            <button onClick={() => photoInput.current?.click()} disabled={busy} className="mt-2 w-full rounded-lg border border-primary/20 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50">
              {busy ? tr({ en: "Uploading…", ar: "جارٍ الرفع…" }) : tr({ en: "Change Photo", ar: "تغيير الصورة" })}
            </button>
          </div>

          <div className="flex-1 space-y-4">
            <BilingualField
              label={tr({ en: "Doctor name", ar: "اسم الطبيب" })}
              valueEn={settings.doctorName.en}
              valueAr={settings.doctorName.ar}
              onEn={(v) => update({ doctorName: { ...settings.doctorName, en: v } })}
              onAr={(v) => update({ doctorName: { ...settings.doctorName, ar: v } })}
            />
            <BilingualField
              label={tr({ en: "Role / title", ar: "التخصص" })}
              valueEn={settings.role.en}
              valueAr={settings.role.ar}
              onEn={(v) => update({ role: { ...settings.role, en: v } })}
              onAr={(v) => update({ role: { ...settings.role, ar: v } })}
            />
          </div>
        </div>
      </Section>

      {/* hero text */}
      <Section title={tr({ en: "Hero Text", ar: "نص الواجهة" })}>
        <div className="space-y-4">
          <BilingualField
            label={tr({ en: "Headline line 1", ar: "العنوان السطر ١" })}
            valueEn={settings.heroTitle1.en}
            valueAr={settings.heroTitle1.ar}
            onEn={(v) => update({ heroTitle1: { ...settings.heroTitle1, en: v } })}
            onAr={(v) => update({ heroTitle1: { ...settings.heroTitle1, ar: v } })}
          />
          <BilingualField
            label={tr({ en: "Headline line 2 (highlighted)", ar: "العنوان السطر ٢ (مميّز)" })}
            valueEn={settings.heroTitle2.en}
            valueAr={settings.heroTitle2.ar}
            onEn={(v) => update({ heroTitle2: { ...settings.heroTitle2, en: v } })}
            onAr={(v) => update({ heroTitle2: { ...settings.heroTitle2, ar: v } })}
          />
          <BilingualField
            label={tr({ en: "Subtitle", ar: "النص الفرعي" })}
            valueEn={settings.subtitle.en}
            valueAr={settings.subtitle.ar}
            onEn={(v) => update({ subtitle: { ...settings.subtitle, en: v } })}
            onAr={(v) => update({ subtitle: { ...settings.subtitle, ar: v } })}
            textarea
          />
        </div>
      </Section>

      {/* theme colors */}
      <Section title={tr({ en: "Theme Colors", ar: "ألوان الموقع" })} desc={tr({ en: "Applies to the public landing page.", ar: "تُطبّق على الصفحة الرئيسية." })}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {THEME_FIELDS.map((f) => (
            <div key={f.key}>
              <span className="mb-1.5 block text-sm font-semibold text-ink">{tr(f.label)}</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.theme[f.key]}
                  onChange={(e) => setTheme(f.key, e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded-lg border border-primary/15 bg-surface-2"
                />
                <input
                  value={settings.theme[f.key]}
                  onChange={(e) => setTheme(f.key, e.target.value)}
                  dir="ltr"
                  className={`${inputCls} font-mono text-xs`}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* before/after cases */}
      <Section title={tr({ en: "Before & After Cases", ar: "حالات قبل وبعد" })} desc={tr({ en: "Upload real results to showcase on the site.", ar: "ارفع نتائج حقيقية لعرضها في الموقع." })}>
        <div className="space-y-4">
          {settings.cases.map((c) => (
            <div key={c.id} className="rounded-xl border border-primary/12 bg-surface-2 p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {(["before", "after"] as const).map((side) => (
                  <div key={side}>
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-muted">
                      {side === "before" ? tr({ en: "Before", ar: "قبل" }) : tr({ en: "After", ar: "بعد" })}
                    </span>
                    <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-primary/15 bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c[side]} alt={side} className="h-full w-full object-cover" />
                      <label className="absolute inset-0 grid cursor-pointer place-items-center bg-black/0 text-white opacity-0 transition hover:bg-black/45 hover:opacity-100">
                        <input type="file" accept="image/*" hidden onChange={(e) => onCaseImage(c.id, side, e.target.files?.[0])} />
                        <span className="rounded-lg bg-black/60 px-3 py-1.5 text-xs font-semibold">
                          {tr({ en: "Upload", ar: "رفع صورة" })}
                        </span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-end gap-3">
                <div className="flex-1">
                  <BilingualField
                    label={tr({ en: "Label", ar: "الوصف" })}
                    valueEn={c.label.en}
                    valueAr={c.label.ar}
                    onEn={(v) => updateCase(c.id, { label: { ...c.label, en: v } })}
                    onAr={(v) => updateCase(c.id, { label: { ...c.label, ar: v } })}
                  />
                </div>
                <button onClick={() => removeCase(c.id)} title={tr({ en: "Delete case", ar: "حذف الحالة" })} className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-primary/12 text-muted transition hover:border-rose-400/40 hover:text-rose-600">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          <button onClick={addCase} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/25 py-3 text-sm font-semibold text-primary transition hover:bg-primary/5">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            {tr({ en: "Add Before/After Case", ar: "إضافة حالة قبل/بعد" })}
          </button>
        </div>
      </Section>

      <p className="px-1 text-center text-xs text-muted">
        {tr({ en: "All changes are saved automatically.", ar: "يتم حفظ كل التغييرات تلقائيًا." })}
      </p>
    </div>
  );
}
