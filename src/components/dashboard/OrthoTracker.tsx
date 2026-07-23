"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

/**
 * Orthodontic case tracker — a dedicated workspace inside the patient file for
 * braces/aligner cases. Shows a progress ring + stage label, an arch map, the
 * case details panel, and the adjustment-visit history log with an add-visit
 * form. Backed by /api/admin/ortho and /api/admin/ortho/visits.
 */

type Visit = {
  id: string;
  visitNumber: number;
  date: string;
  upperWire: string;
  lowerWire: string;
  elastics: string;
  powerChain: string;
  hygiene: string;
  painScore: number | null;
  notes: string;
  nextPlan: string;
  nextAppointment: string | null;
};

type OrthoCase = {
  id: string;
  patientId: string;
  startDate: string;
  durationMonths: number | null;
  bracesType: string;
  occlusion: string;
  crowding: string;
  spacing: string;
  overbite: number | null;
  overjet: number | null;
  flags: string[];
  progressScore: number;
  status: string;
  nextAppointment: string | null;
  notes: string;
  visits: Visit[];
};

type Opt = { id: string; label: { en: string; ar: string } };

const BRACES: Opt[] = [
  { id: "metal", label: { en: "Metal", ar: "معدني" } },
  { id: "ceramic", label: { en: "Ceramic", ar: "خزفي" } },
  { id: "lingual", label: { en: "Lingual", ar: "لساني" } },
  { id: "aligners", label: { en: "Aligners", ar: "شفاف" } },
];
const OCCLUSION: Opt[] = [
  { id: "class_i", label: { en: "Class I", ar: "الصنف الأول" } },
  { id: "class_ii", label: { en: "Class II", ar: "الصنف الثاني" } },
  { id: "class_iii", label: { en: "Class III", ar: "الصنف الثالث" } },
];
const SEVERITY: Opt[] = [
  { id: "none", label: { en: "None", ar: "لا يوجد" } },
  { id: "mild", label: { en: "Mild", ar: "بسيط" } },
  { id: "moderate", label: { en: "Moderate", ar: "متوسط" } },
  { id: "severe", label: { en: "Severe", ar: "شديد" } },
];
const STATUS: Opt[] = [
  { id: "active", label: { en: "Active", ar: "نشط" } },
  { id: "paused", label: { en: "Paused", ar: "متوقف" } },
  { id: "completed", label: { en: "Completed", ar: "مكتمل" } },
];
const POWER_CHAIN: Opt[] = [
  { id: "none", label: { en: "None", ar: "لا يوجد" } },
  { id: "upper", label: { en: "Upper only", ar: "علوي فقط" } },
  { id: "lower", label: { en: "Lower only", ar: "سفلي فقط" } },
  { id: "upper_lower", label: { en: "Upper & lower", ar: "علوي وسفلي" } },
];
const HYGIENE: Opt[] = [
  { id: "good", label: { en: "Good", ar: "جيد" } },
  { id: "fair", label: { en: "Fair", ar: "مقبول" } },
  { id: "poor", label: { en: "Poor", ar: "ضعيف" } },
];
const ELASTICS: Opt[] = [
  { id: "none", label: { en: "None", ar: "لا يوجد" } },
  { id: "class_ii", label: { en: "Class II", ar: "الصنف الثاني" } },
  { id: "class_iii", label: { en: "Class III", ar: "الصنف الثالث" } },
  { id: "vertical", label: { en: "Vertical", ar: "رأسي" } },
  { id: "triangle", label: { en: "Triangle", ar: "مثلث" } },
  { id: "box", label: { en: "Box", ar: "صندوقي" } },
];

const FLAGS: Opt[] = [
  { id: "IPR", label: { en: "IPR", ar: "برد مينائي" } },
  { id: "Extractions", label: { en: "Extractions", ar: "خلع" } },
  { id: "TADs", label: { en: "TADs", ar: "دعامات" } },
  { id: "Expander", label: { en: "Expander", ar: "موسّع" } },
  { id: "Elastics", label: { en: "Elastics", ar: "مطاطات" } },
];

const inputCls =
  "w-full rounded-lg border border-primary/15 bg-surface-2 px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20";

const labelOf = (opts: Opt[], id: string) => opts.find((o) => o.id === id)?.label;
const isoToDateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");
const dateInputToIso = (v: string) => (v ? new Date(`${v}T00:00:00`).toISOString() : null);
const fmtDate = (iso: string | null | undefined, lang: string) =>
  iso ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "—";

function ProgressRing({ value }: { value: number }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 67 ? "#10b981" : pct >= 34 ? "#3b82f6" : "#f59e0b";
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
      <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" className="text-primary/12" strokeWidth="7" />
      <circle
        cx="40"
        cy="40"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
      />
      <text x="40" y="40" transform="rotate(90 40 40)" textAnchor="middle" dominantBaseline="central" className="fill-ink text-[15px] font-extrabold">
        {pct}
      </text>
    </svg>
  );
}

function ArchMap({ progress }: { progress: number }) {
  const n = 12;
  const pct = Math.max(0, Math.min(100, progress));
  const color = pct >= 67 ? "#10b981" : pct >= 34 ? "#3b82f6" : "#f59e0b";
  const upperY = (t: number) => (1 - t) * (1 - t) * 46 + 2 * (1 - t) * t * 26 + t * t * 46;
  const lowerY = (t: number) => (1 - t) * (1 - t) * 94 + 2 * (1 - t) * t * 114 + t * t * 94;
  const x = (i: number) => 12 + (256 * i) / (n - 1);
  const filled = Math.round((pct / 100) * n);
  const dot = (i: number, y: number) => (
    <circle
      key={y > 70 ? `l${i}` : `u${i}`}
      cx={x(i)}
      cy={y}
      r="4.5"
      fill={i < filled ? color : "currentColor"}
      className={i < filled ? "" : "text-primary/20"}
    />
  );
  return (
    <svg viewBox="0 0 280 130" className="w-full">
      <path d="M12 46 Q140 26 268 46" fill="none" stroke="currentColor" className="text-primary/25" strokeWidth="2" />
      <path d="M12 94 Q140 114 268 94" fill="none" stroke="currentColor" className="text-primary/25" strokeWidth="2" />
      {Array.from({ length: n }, (_, i) => dot(i, upperY(i / (n - 1))))}
      {Array.from({ length: n }, (_, i) => dot(i, lowerY(i / (n - 1))))}
    </svg>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-primary/10 bg-surface px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-ink">{value}</p>
    </div>
  );
}

const emptyVisit = {
  date: new Date().toISOString().slice(0, 10),
  upperWire: "",
  lowerWire: "",
  elastics: "",
  powerChain: "",
  hygiene: "",
  painScore: "",
  notes: "",
  nextPlan: "",
  nextAppointment: "",
};

export function OrthoTracker({ patientId }: { patientId: string }) {
  const { tr, lang, dir } = useLang();
  const confirm = useConfirm();
  const toast = useToast();
  const [cases, setCases] = useState<OrthoCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingVisit, setAddingVisit] = useState(false);
  const [vf, setVf] = useState({ ...emptyVisit });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ortho?patientId=${encodeURIComponent(patientId)}`, { cache: "no-store" });
      if (res.ok) {
        const j = (await res.json()) as { cases: OrthoCase[] };
        setCases(j.cases);
        setActiveId((prev) => prev ?? j.cases[0]?.id ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = cases.find((c) => c.id === activeId) ?? cases[0] ?? null;

  const startCase = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ortho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, startDate: new Date().toISOString(), bracesType: "metal", status: "active" }),
      });
      if (!res.ok) {
        toast.error(tr({ en: "Could not start the case.", ar: "تعذر بدء الحالة." }));
        return;
      }
      const j = (await res.json()) as { case: OrthoCase };
      setCases((prev) => [j.case, ...prev]);
      setActiveId(j.case.id);
      toast.success(tr({ en: "Orthodontic case started.", ar: "تم بدء حالة التقويم." }));
    } finally {
      setBusy(false);
    }
  };

  const patchCase = async (patch: Partial<OrthoCase>) => {
    if (!active) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ortho", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: active.id, ...patch }),
      });
      if (!res.ok) {
        toast.error(tr({ en: "Could not update the case.", ar: "تعذر تحديث الحالة." }));
        return;
      }
      const j = (await res.json()) as { case: OrthoCase };
      setCases((prev) => prev.map((c) => (c.id === j.case.id ? j.case : c)));
      setEditing(false);
      toast.success(tr({ en: "Case updated.", ar: "تم تحديث الحالة." }));
    } finally {
      setBusy(false);
    }
  };

  const deleteCase = async () => {
    if (!active) return;
    if (!(await confirm({ message: tr({ en: "Delete this orthodontic case and its visits?", ar: "حذف حالة التقويم وكل زياراتها؟" }), tone: "danger" }))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/ortho?id=${encodeURIComponent(active.id)}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(tr({ en: "Could not delete the case.", ar: "تعذر حذف الحالة." }));
        return;
      }
      setCases((prev) => prev.filter((c) => c.id !== active.id));
      setActiveId(null);
      toast.success(tr({ en: "Case deleted.", ar: "تم حذف الحالة." }));
    } finally {
      setBusy(false);
    }
  };

  const addVisit = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/ortho/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: active.id,
          date: dateInputToIso(vf.date),
          upperWire: vf.upperWire,
          lowerWire: vf.lowerWire,
          elastics: vf.elastics,
          powerChain: vf.powerChain,
          hygiene: vf.hygiene,
          painScore: vf.painScore === "" ? null : Number(vf.painScore),
          notes: vf.notes,
          nextPlan: vf.nextPlan,
          nextAppointment: dateInputToIso(vf.nextAppointment),
        }),
      });
      if (!res.ok) {
        toast.error(tr({ en: "Could not add the visit.", ar: "تعذر إضافة الزيارة." }));
        return;
      }
      setAddingVisit(false);
      setVf({ ...emptyVisit });
      await load();
      toast.success(tr({ en: "Visit added.", ar: "تمت إضافة الزيارة." }));
    } finally {
      setBusy(false);
    }
  };

  const deleteVisit = async (id: string) => {
    if (!(await confirm({ message: tr({ en: "Delete this visit?", ar: "حذف هذه الزيارة؟" }), tone: "danger" }))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/ortho/visits?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error(tr({ en: "Could not delete the visit.", ar: "تعذر حذف الزيارة." }));
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-primary/12 bg-surface-2/60 p-4">
        <div className="grid h-24 place-items-center text-sm text-muted">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</div>
      </div>
    );
  }

  const stageLabel = (p: number) =>
    p >= 67 ? tr({ en: "Final stage", ar: "المرحلة النهائية" }) : p >= 34 ? tr({ en: "Mid treatment", ar: "منتصف العلاج" }) : tr({ en: "Early stage", ar: "المرحلة المبكرة" });

  return (
    <div dir={dir} className="rounded-2xl border border-primary/12 bg-surface-2/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 8c4-3 12-3 16 0M4 16c4 3 12 3 16 0M4 8v8M20 8v8" />
          </svg>
          {tr({ en: "Orthodontic tracker", ar: "متابعة التقويم" })}
        </p>
        {cases.length > 1 && (
          <select className="rounded-lg border border-primary/15 bg-surface px-2 py-1 text-xs text-ink" value={active?.id} onChange={(e) => setActiveId(e.target.value)}>
            {cases.map((c, i) => (
              <option key={c.id} value={c.id}>
                {tr({ en: "Case", ar: "حالة" })} {cases.length - i} — {fmtDate(c.startDate, lang)}
              </option>
            ))}
          </select>
        )}
      </div>

      {!active ? (
        <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-primary/15 p-6 text-center">
          <p className="text-sm text-muted">{tr({ en: "No orthodontic case yet.", ar: "لا توجد حالة تقويم بعد." })}</p>
          <button
            type="button"
            onClick={startCase}
            disabled={busy}
            className="rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {tr({ en: "Start orthodontic case", ar: "بدء حالة تقويم" })}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* progress + arch */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-4 rounded-xl border border-primary/10 bg-surface p-3">
              <ProgressRing value={active.progressScore} />
              <div>
                <p className="text-sm font-bold text-ink">{stageLabel(active.progressScore)}</p>
                <p className="text-xs text-muted">{tr({ en: "Treatment progress", ar: "تقدّم العلاج" })}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  active.status === "completed" ? "bg-emerald-500/10 text-emerald-700" : active.status === "paused" ? "bg-amber-500/10 text-amber-700" : "bg-primary/10 text-primary"
                }`}>
                  {tr(labelOf(STATUS, active.status) ?? { en: active.status, ar: active.status })}
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-primary/10 bg-surface p-3">
              <ArchMap progress={active.progressScore} />
            </div>
          </div>

          {/* metadata */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Chip label={tr({ en: "Start date", ar: "تاريخ البدء" })} value={fmtDate(active.startDate, lang)} />
            <Chip label={tr({ en: "Duration", ar: "المدة" })} value={active.durationMonths ? `${active.durationMonths} ${tr({ en: "mo", ar: "شهر" })}` : "—"} />
            <Chip label={tr({ en: "Total visits", ar: "عدد الزيارات" })} value={String(active.visits.length)} />
            <Chip label={tr({ en: "Next appt", ar: "الموعد القادم" })} value={fmtDate(active.nextAppointment, lang)} />
          </div>

          {/* details / edit */}
          {editing ? (
            <CaseForm
              value={active}
              busy={busy}
              onCancel={() => setEditing(false)}
              onSave={patchCase}
            />
          ) : (
            <div className="rounded-xl border border-primary/10 bg-surface p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">{tr({ en: "Case details", ar: "تفاصيل الحالة" })}</p>
                <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-primary hover:underline">
                  {tr({ en: "Edit", ar: "تعديل" })}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
                <Detail label={tr({ en: "Braces", ar: "النوع" })} value={tr(labelOf(BRACES, active.bracesType) ?? { en: active.bracesType, ar: active.bracesType })} />
                <Detail label={tr({ en: "Occlusion", ar: "الإطباق" })} value={active.occlusion ? tr(labelOf(OCCLUSION, active.occlusion)!) : "—"} />
                <Detail label={tr({ en: "Crowding", ar: "التزاحم" })} value={active.crowding ? tr(labelOf(SEVERITY, active.crowding)!) : "—"} />
                <Detail label={tr({ en: "Spacing", ar: "الفراغات" })} value={active.spacing ? tr(labelOf(SEVERITY, active.spacing)!) : "—"} />
                <Detail label={tr({ en: "Overbite", ar: "التغطية" })} value={active.overbite != null ? `${active.overbite} mm` : "—"} />
                <Detail label={tr({ en: "Overjet", ar: "البروز" })} value={active.overjet != null ? `${active.overjet} mm` : "—"} />
              </div>
              {active.flags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {active.flags.map((f) => (
                    <span key={f} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {tr(labelOf(FLAGS, f) ?? { en: f, ar: f })}
                    </span>
                  ))}
                </div>
              )}
              {active.notes && <p className="mt-2 border-t border-primary/10 pt-2 text-sm text-ink/85">{active.notes}</p>}
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={deleteCase} disabled={busy} className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-40">
                  {tr({ en: "Delete case", ar: "حذف الحالة" })}
                </button>
              </div>
            </div>
          )}

          {/* adjustment log */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">{tr({ en: "Adjustment history", ar: "سجل التعديلات" })}</p>
              <button
                type="button"
                onClick={() => setAddingVisit((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {tr({ en: "Add visit", ar: "إضافة زيارة" })}
              </button>
            </div>

            {addingVisit && (
              <div className="mb-3 space-y-2 rounded-xl border border-primary/15 bg-surface p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <LabeledInput label={tr({ en: "Date", ar: "التاريخ" })} type="date" value={vf.date} onChange={(v) => setVf({ ...vf, date: v })} />
                  <LabeledInput label={tr({ en: "Upper wire", ar: "السلك العلوي" })} value={vf.upperWire} onChange={(v) => setVf({ ...vf, upperWire: v })} placeholder="016 NiTi" />
                  <LabeledInput label={tr({ en: "Lower wire", ar: "السلك السفلي" })} value={vf.lowerWire} onChange={(v) => setVf({ ...vf, lowerWire: v })} placeholder="016 NiTi" />
                  <LabeledSelect label={tr({ en: "Elastics", ar: "المطاطات" })} opts={ELASTICS} value={vf.elastics} onChange={(v) => setVf({ ...vf, elastics: v })} placeholder />
                  <LabeledSelect label={tr({ en: "Power chain", ar: "السلسلة" })} opts={POWER_CHAIN} value={vf.powerChain} onChange={(v) => setVf({ ...vf, powerChain: v })} placeholder />
                  <LabeledSelect label={tr({ en: "Hygiene", ar: "النظافة" })} opts={HYGIENE} value={vf.hygiene} onChange={(v) => setVf({ ...vf, hygiene: v })} placeholder />
                  <LabeledInput label={tr({ en: "Pain (1-10)", ar: "الألم (1-10)" })} type="number" value={vf.painScore} onChange={(v) => setVf({ ...vf, painScore: v })} />
                  <LabeledInput label={tr({ en: "Next appt", ar: "الموعد القادم" })} type="date" value={vf.nextAppointment} onChange={(v) => setVf({ ...vf, nextAppointment: v })} />
                </div>
                <LabeledInput label={tr({ en: "Notes", ar: "ملاحظات" })} value={vf.notes} onChange={(v) => setVf({ ...vf, notes: v })} />
                <LabeledInput label={tr({ en: "Next visit plan", ar: "خطة الزيارة القادمة" })} value={vf.nextPlan} onChange={(v) => setVf({ ...vf, nextPlan: v })} />
                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => { setAddingVisit(false); setVf({ ...emptyVisit }); }} className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink">
                    {tr({ en: "Cancel", ar: "إلغاء" })}
                  </button>
                  <button type="button" onClick={addVisit} disabled={busy} className="rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-1.5 text-xs font-semibold text-[#0a0e12] disabled:opacity-50">
                    {tr({ en: "Save visit", ar: "حفظ الزيارة" })}
                  </button>
                </div>
              </div>
            )}

            {active.visits.length === 0 ? (
              <p className="rounded-xl border border-dashed border-primary/15 py-6 text-center text-sm text-muted">
                {tr({ en: "No visits recorded yet.", ar: "لا توجد زيارات مسجلة بعد." })}
              </p>
            ) : (
              <div className="space-y-2">
                {[...active.visits].reverse().map((v) => (
                  <div key={v.id} className="rounded-xl border border-primary/10 bg-surface p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-ink">
                        #{v.visitNumber} · {fmtDate(v.date, lang)}
                      </p>
                      <button type="button" onClick={() => deleteVisit(v.id)} className="text-[11px] font-semibold text-rose-600 hover:underline">
                        {tr({ en: "Delete", ar: "حذف" })}
                      </button>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                      {(v.upperWire || v.lowerWire) && (
                        <span>{tr({ en: "Wire", ar: "سلك" })}: {[v.upperWire, v.lowerWire].filter(Boolean).join(" / ")}</span>
                      )}
                      {v.elastics && <span>{tr({ en: "Elastics", ar: "مطاط" })}: {tr(labelOf(ELASTICS, v.elastics) ?? { en: v.elastics, ar: v.elastics })}</span>}
                      {v.powerChain && <span>{tr({ en: "Chain", ar: "سلسلة" })}: {tr(labelOf(POWER_CHAIN, v.powerChain) ?? { en: v.powerChain, ar: v.powerChain })}</span>}
                      {v.hygiene && <span>{tr({ en: "Hygiene", ar: "نظافة" })}: {tr(labelOf(HYGIENE, v.hygiene) ?? { en: v.hygiene, ar: v.hygiene })}</span>}
                      {v.painScore != null && <span>{tr({ en: "Pain", ar: "ألم" })}: {v.painScore}/10</span>}
                      {v.nextAppointment && <span>{tr({ en: "Next", ar: "التالي" })}: {fmtDate(v.nextAppointment, lang)}</span>}
                    </div>
                    {(v.notes || v.nextPlan) && (
                      <div className="mt-1.5 space-y-0.5 border-t border-primary/10 pt-1.5 text-xs text-ink/80">
                        {v.notes && <p>{v.notes}</p>}
                        {v.nextPlan && <p><span className="font-semibold text-muted">{tr({ en: "Plan: ", ar: "الخطة: " })}</span>{v.nextPlan}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-muted">{label}:</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-ink">{label}</span>
      <input
        className={inputCls}
        type={type}
        dir={type === "date" || type === "number" ? "ltr" : undefined}
        min={type === "number" ? "0" : undefined}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function LabeledSelect({
  label,
  opts,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  opts: Opt[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: boolean;
}) {
  const { tr } = useLang();
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-ink">{label}</span>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder && <option value="">{tr({ en: "—", ar: "—" })}</option>}
        {opts.map((o) => (
          <option key={o.id} value={o.id}>{tr(o.label)}</option>
        ))}
      </select>
    </label>
  );
}

function CaseForm({
  value,
  busy,
  onCancel,
  onSave,
}: {
  value: OrthoCase;
  busy: boolean;
  onCancel: () => void;
  onSave: (patch: Partial<OrthoCase>) => void;
}) {
  const { tr } = useLang();
  const [startDate, setStartDate] = useState(isoToDateInput(value.startDate));
  const [durationMonths, setDurationMonths] = useState(value.durationMonths != null ? String(value.durationMonths) : "");
  const [bracesType, setBracesType] = useState(value.bracesType);
  const [occlusion, setOcclusion] = useState(value.occlusion);
  const [crowding, setCrowding] = useState(value.crowding);
  const [spacing, setSpacing] = useState(value.spacing);
  const [overbite, setOverbite] = useState(value.overbite != null ? String(value.overbite) : "");
  const [overjet, setOverjet] = useState(value.overjet != null ? String(value.overjet) : "");
  const [flags, setFlags] = useState<string[]>(value.flags);
  const [progressScore, setProgressScore] = useState(value.progressScore);
  const [status, setStatus] = useState(value.status);
  const [nextAppointment, setNextAppointment] = useState(isoToDateInput(value.nextAppointment));
  const [notes, setNotes] = useState(value.notes);

  const toggleFlag = (f: string) => setFlags((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));

  return (
    <div className="space-y-3 rounded-xl border border-primary/15 bg-surface p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <LabeledInput label={tr({ en: "Start date", ar: "تاريخ البدء" })} type="date" value={startDate} onChange={setStartDate} />
        <LabeledInput label={tr({ en: "Duration (months)", ar: "المدة (شهور)" })} type="number" value={durationMonths} onChange={setDurationMonths} />
        <LabeledSelect label={tr({ en: "Braces type", ar: "نوع التقويم" })} opts={BRACES} value={bracesType} onChange={setBracesType} />
        <LabeledSelect label={tr({ en: "Occlusion", ar: "الإطباق" })} opts={OCCLUSION} value={occlusion} onChange={setOcclusion} placeholder />
        <LabeledSelect label={tr({ en: "Crowding", ar: "التزاحم" })} opts={SEVERITY} value={crowding} onChange={setCrowding} placeholder />
        <LabeledSelect label={tr({ en: "Spacing", ar: "الفراغات" })} opts={SEVERITY} value={spacing} onChange={setSpacing} placeholder />
        <LabeledInput label={tr({ en: "Overbite (mm)", ar: "التغطية (مم)" })} type="number" value={overbite} onChange={setOverbite} />
        <LabeledInput label={tr({ en: "Overjet (mm)", ar: "البروز (مم)" })} type="number" value={overjet} onChange={setOverjet} />
        <LabeledSelect label={tr({ en: "Status", ar: "الحالة" })} opts={STATUS} value={status} onChange={setStatus} />
      </div>

      <div>
        <span className="mb-1 block text-[11px] font-semibold text-ink">{tr({ en: "Flags", ar: "علامات" })}</span>
        <div className="flex flex-wrap gap-1.5">
          {FLAGS.map((f) => {
            const on = flags.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => toggleFlag(f.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  on ? "border-primary bg-primary/15 text-primary" : "border-primary/15 text-muted hover:border-primary/40"
                }`}
              >
                {tr(f.label)}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="mb-1 block text-[11px] font-semibold text-ink">
          {tr({ en: "Progress", ar: "التقدّم" })}: {progressScore}
        </span>
        <input type="range" min="0" max="100" value={progressScore} onChange={(e) => setProgressScore(Number(e.target.value))} className="w-full accent-primary" />
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-ink">{tr({ en: "Next appointment", ar: "الموعد القادم" })}</span>
        <input className={inputCls} type="date" dir="ltr" value={nextAppointment} onChange={(e) => setNextAppointment(e.target.value)} />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-semibold text-ink">{tr({ en: "Notes", ar: "ملاحظات" })}</span>
        <textarea className={`${inputCls} resize-none`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-primary/15 px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink">
          {tr({ en: "Cancel", ar: "إلغاء" })}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            onSave({
              startDate: dateInputToIso(startDate) ?? undefined,
              durationMonths: durationMonths === "" ? null : Number(durationMonths),
              bracesType,
              occlusion,
              crowding,
              spacing,
              overbite: overbite === "" ? null : Number(overbite),
              overjet: overjet === "" ? null : Number(overjet),
              flags,
              progressScore,
              status,
              nextAppointment: dateInputToIso(nextAppointment),
              notes,
            } as Partial<OrthoCase>)
          }
          className="rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-1.5 text-xs font-semibold text-[#0a0e12] disabled:opacity-50"
        >
          {tr({ en: "Save details", ar: "حفظ التفاصيل" })}
        </button>
      </div>
    </div>
  );
}
