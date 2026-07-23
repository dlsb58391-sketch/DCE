"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/language";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

/**
 * Interactive dental chart (Universal Numbering System, teeth 1-32). The doctor
 * clicks a tooth to open the side panel and records its condition, affected
 * surfaces, diagnosis, treatment plan/status, estimate and notes. Each tooth is
 * colored by its condition so the whole mouth reads at a glance.
 *
 * Backed by /api/admin/tooth-records (GET list, PUT upsert, DELETE reset).
 */

type Tooth = {
  id: string;
  toothNumber: number;
  condition: string;
  surfaces: string[];
  diagnosis: string;
  treatment: string;
  treatmentStatus: string;
  estimatedPrice: number | null;
  notes: string;
  updatedAt: string;
};

type Condition = {
  id: string;
  label: { en: string; ar: string };
  dot: string; // hex swatch for legend + tooth fill
  text: string; // tailwind text color for the number when set
};

const CONDITIONS: Condition[] = [
  { id: "healthy", label: { en: "Healthy", ar: "سليمة" }, dot: "#e2e8f0", text: "text-slate-500" },
  { id: "watch", label: { en: "Watch", ar: "متابعة" }, dot: "#fbbf24", text: "text-amber-700" },
  { id: "cavity", label: { en: "Cavity", ar: "تسوس" }, dot: "#f97316", text: "text-orange-700" },
  { id: "filled", label: { en: "Filled", ar: "حشو" }, dot: "#3b82f6", text: "text-blue-700" },
  { id: "crown", label: { en: "Crown", ar: "تاج" }, dot: "#a855f7", text: "text-purple-700" },
  { id: "root_canal", label: { en: "Root canal", ar: "عصب" }, dot: "#ec4899", text: "text-pink-700" },
  { id: "extraction", label: { en: "Extraction", ar: "خلع" }, dot: "#ef4444", text: "text-red-700" },
  { id: "missing", label: { en: "Missing", ar: "مفقودة" }, dot: "#94a3b8", text: "text-slate-400" },
  { id: "implant", label: { en: "Implant", ar: "زرعة" }, dot: "#14b8a6", text: "text-teal-700" },
  { id: "bridge", label: { en: "Bridge", ar: "جسر" }, dot: "#6366f1", text: "text-indigo-700" },
];
const CONDITION_BY_ID = Object.fromEntries(CONDITIONS.map((c) => [c.id, c]));

const STATUSES = [
  { id: "planned", label: { en: "Planned", ar: "مخطط" } },
  { id: "in_progress", label: { en: "In progress", ar: "قيد التنفيذ" } },
  { id: "done", label: { en: "Done", ar: "منجز" } },
];

const SURFACES = [
  { id: "M", label: { en: "Mesial", ar: "إنسي" } },
  { id: "O", label: { en: "Occlusal", ar: "إطباقي" } },
  { id: "D", label: { en: "Distal", ar: "وحشي" } },
  { id: "B", label: { en: "Buccal", ar: "دهليزي" } },
  { id: "L", label: { en: "Lingual", ar: "لساني" } },
];

const UPPER = Array.from({ length: 16 }, (_, i) => i + 1); // 1..16
const LOWER = Array.from({ length: 16 }, (_, i) => 32 - i); // 32..17 (aligns quadrants)

const inputCls =
  "w-full rounded-lg border border-primary/15 bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20";

function ToothGlyph({ active, fill }: { active: boolean; fill: string }) {
  return (
    <svg viewBox="0 0 24 28" className={`h-auto w-full transition ${active ? "scale-110" : ""}`} aria-hidden>
      <path
        d="M12 2C7 2 4 5 4 9c0 3 1 4 1.6 7.5C6 19 6.4 26 8 26c1.4 0 1.5-5 2.2-6.4.5-1 2.1-1 2.6 0C13.5 21 13.6 26 15 26c1.6 0 2-7 2.4-9.5C18 13 20 12 20 9c0-4-3-7-8-7Z"
        fill={fill}
        stroke="#0f172a22"
        strokeWidth="1"
      />
    </svg>
  );
}

function toothFill(condition: string): string {
  const c = CONDITION_BY_ID[condition];
  if (!condition || condition === "healthy" || !c) return "#f8fafc";
  return c.dot;
}

export function DentalChart({ patientId }: { patientId: string }) {
  const { tr, dir } = useLang();
  const confirm = useConfirm();
  const toast = useToast();
  const [teeth, setTeeth] = useState<Record<number, Tooth>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Side-panel form state (mirrors the selected tooth's current record).
  const [condition, setCondition] = useState("healthy");
  const [surfaces, setSurfaces] = useState<string[]>([]);
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [treatmentStatus, setTreatmentStatus] = useState("planned");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tooth-records?patientId=${encodeURIComponent(patientId)}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const j = (await res.json()) as { teeth: Tooth[] };
        const map: Record<number, Tooth> = {};
        for (const t of j.teeth) map[t.toothNumber] = t;
        setTeeth(map);
      }
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openTooth = useCallback(
    (n: number) => {
      setSelected(n);
      const t = teeth[n];
      setCondition(t?.condition ?? "healthy");
      setSurfaces(t?.surfaces ?? []);
      setDiagnosis(t?.diagnosis ?? "");
      setTreatment(t?.treatment ?? "");
      setTreatmentStatus(t?.treatmentStatus ?? "planned");
      setEstimatedPrice(t?.estimatedPrice != null ? String(t.estimatedPrice) : "");
      setNotes(t?.notes ?? "");
    },
    [teeth]
  );

  const toggleSurface = (s: string) =>
    setSurfaces((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const save = async () => {
    if (selected == null) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tooth-records", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          toothNumber: selected,
          condition,
          surfaces,
          diagnosis,
          treatment,
          treatmentStatus,
          estimatedPrice: estimatedPrice.trim() === "" ? null : Number(estimatedPrice),
          notes,
        }),
      });
      if (!res.ok) {
        toast.error(tr({ en: "Could not save the tooth.", ar: "تعذر حفظ السن." }));
        return;
      }
      const j = (await res.json()) as { tooth: Tooth };
      setTeeth((prev) => ({ ...prev, [selected]: j.tooth }));
      toast.success(tr({ en: `Tooth ${selected} saved.`, ar: `تم حفظ السن ${selected}.` }));
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (selected == null) return;
    if (!(await confirm({ message: tr({ en: `Reset tooth ${selected} to healthy?`, ar: `إعادة السن ${selected} إلى سليم؟` }), tone: "danger" })))
      return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/tooth-records?patientId=${encodeURIComponent(patientId)}&toothNumber=${selected}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error(tr({ en: "Could not reset the tooth.", ar: "تعذر إعادة تعيين السن." }));
        return;
      }
      setTeeth((prev) => {
        const next = { ...prev };
        delete next[selected];
        return next;
      });
      openTooth(selected);
      toast.success(tr({ en: `Tooth ${selected} reset.`, ar: `تمت إعادة تعيين السن ${selected}.` }));
    } finally {
      setSaving(false);
    }
  };

  const chartedCount = useMemo(
    () => Object.values(teeth).filter((t) => t.condition && t.condition !== "healthy").length,
    [teeth]
  );

  const renderRow = (row: number[]) => (
    <div className="grid gap-px sm:gap-0.5" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
      {row.map((n) => {
        const t = teeth[n];
        const isActive = selected === n;
        const charted = t && t.condition !== "healthy";
        return (
          <button
            key={n}
            type="button"
            onClick={() => openTooth(n)}
            title={`${tr({ en: "Tooth", ar: "سن" })} ${n}${t ? ` — ${tr(CONDITION_BY_ID[t.condition]?.label ?? { en: t.condition, ar: t.condition })}` : ""}`}
            className={`group flex flex-col items-center rounded-md px-0.5 py-1 transition ${
              isActive ? "bg-primary/12 ring-1 ring-primary" : "hover:bg-primary/6"
            }`}
          >
            <span className="w-full max-w-[26px]">
              <ToothGlyph active={isActive} fill={toothFill(t?.condition ?? "healthy")} />
            </span>
            <span className={`mt-0.5 text-[9px] font-bold leading-none ${charted ? CONDITION_BY_ID[t!.condition]?.text : "text-muted"}`}>
              {n}
            </span>
          </button>
        );
      })}
    </div>
  );

  const selectedTooth = selected != null ? teeth[selected] : undefined;

  return (
    <div className="rounded-2xl border border-primary/12 bg-surface-2/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5.5C10 3 6 3 4.5 5.5 3 8 4 11 4.5 13.5 5 16 5 21 6.5 21S8 17 9 16s3-1 4 0 1.5 5 2.5 5 1.5-5 2-7.5C18 11 19 8 17.5 5.5 16 3 14 3 12 5.5Z" />
          </svg>
          {tr({ en: "Dental chart", ar: "مخطط الأسنان" })}
        </p>
        <span className="text-[11px] text-muted">
          {chartedCount > 0
            ? tr({ en: `${chartedCount} teeth charted`, ar: `${chartedCount} سن مسجلة` })
            : tr({ en: "Click a tooth to record its condition", ar: "اضغط على سن لتسجيل حالته" })}
        </span>
      </div>

      {loading ? (
        <div className="grid h-40 place-items-center text-sm text-muted">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {/* chart */}
          <div className="lg:col-span-3">
            <div className="rounded-xl border border-primary/10 bg-surface p-3">
              <div className="overflow-x-auto">
                <div className="mx-auto min-w-[290px] max-w-[430px]">
                  <p className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {tr({ en: "Upper", ar: "علوي" })}
                  </p>
                  {renderRow(UPPER)}
                  <div className="my-2 border-t border-dashed border-primary/15" />
                  {renderRow(LOWER)}
                  <p className="mt-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {tr({ en: "Lower", ar: "سفلي" })}
                  </p>
                </div>
              </div>
            </div>
            {/* legend */}
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
              {CONDITIONS.filter((c) => c.id !== "healthy").map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1 text-[10px] text-muted">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.dot }} />
                  {tr(c.label)}
                </span>
              ))}
            </div>
          </div>

          {/* side panel */}
          <div className="lg:col-span-2">
            {selected == null ? (
              <div className="grid h-full min-h-[12rem] place-items-center rounded-xl border border-dashed border-primary/15 p-4 text-center text-sm text-muted">
                {tr({ en: "Select a tooth to edit its record.", ar: "اختر سنًا لتحرير سجله." })}
              </div>
            ) : (
              <div dir={dir} className="space-y-3 rounded-xl border border-primary/15 bg-surface p-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-ink">
                    {tr({ en: "Tooth", ar: "السن" })} {selected}
                  </h4>
                  {selectedTooth && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-muted">
                      <span className="h-2 w-2 rounded-full" style={{ background: toothFill(selectedTooth.condition) }} />
                      {tr(CONDITION_BY_ID[selectedTooth.condition]?.label ?? { en: selectedTooth.condition, ar: selectedTooth.condition })}
                    </span>
                  )}
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-ink">{tr({ en: "Condition", ar: "الحالة" })}</span>
                  <select className={inputCls} value={condition} onChange={(e) => setCondition(e.target.value)}>
                    {CONDITIONS.map((c) => (
                      <option key={c.id} value={c.id}>{tr(c.label)}</option>
                    ))}
                  </select>
                </label>

                <div>
                  <span className="mb-1 block text-xs font-semibold text-ink">{tr({ en: "Surfaces", ar: "الأسطح" })}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {SURFACES.map((s) => {
                      const on = surfaces.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSurface(s.id)}
                          title={tr(s.label)}
                          className={`h-8 w-8 rounded-lg border text-xs font-bold transition ${
                            on ? "border-primary bg-primary/15 text-primary" : "border-primary/15 text-muted hover:border-primary/40"
                          }`}
                        >
                          {s.id}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-ink">{tr({ en: "Diagnosis", ar: "التشخيص" })}</span>
                  <textarea className={`${inputCls} resize-none`} rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder={tr({ en: "e.g. Mild rotation…", ar: "مثال: دوران بسيط…" })} />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-ink">{tr({ en: "Treatment", ar: "العلاج" })}</span>
                  <textarea className={`${inputCls} resize-none`} rows={2} value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder={tr({ en: "e.g. Orthodontic alignment…", ar: "مثال: تقويم…" })} />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-ink">{tr({ en: "Status", ar: "الحالة" })}</span>
                    <select className={inputCls} value={treatmentStatus} onChange={(e) => setTreatmentStatus(e.target.value)}>
                      {STATUSES.map((s) => (
                        <option key={s.id} value={s.id}>{tr(s.label)}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-ink">{tr({ en: "Est. price", ar: "السعر التقديري" })}</span>
                    <input className={inputCls} type="number" min="0" inputMode="decimal" dir="ltr" value={estimatedPrice} onChange={(e) => setEstimatedPrice(e.target.value)} placeholder="0" />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-ink">{tr({ en: "Notes", ar: "ملاحظات" })}</span>
                  <textarea className={`${inputCls} resize-none`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={reset}
                    disabled={saving || !selectedTooth}
                    className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-rose-400/40 hover:text-rose-600 disabled:opacity-40"
                  >
                    {tr({ en: "Reset", ar: "إعادة تعيين" })}
                  </button>
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-1.5 text-xs font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {saving ? tr({ en: "Saving…", ar: "جارٍ الحفظ…" }) : tr({ en: "Save tooth", ar: "حفظ السن" })}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
