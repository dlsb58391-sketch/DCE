"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/language";

export type MedicationLite = {
  id: string;
  nameEn: string;
  nameAr: string;
  form: string | null;
  strength: string | null;
  route: string | null;
  defaultDosage: string | null;
  defaultFrequency: string | null;
  defaultDurationDays: number | null;
  defaultInstructions: string | null;
  active: boolean;
};

export type RxDoctorLite = { id: string; nameEn: string; nameAr: string; active: boolean };

type RxItem = {
  id: string;
  medicationId: string | null;
  nameEn: string;
  nameAr: string;
  strength: string | null;
  form: string | null;
  dosage: string | null;
  frequency: string | null;
  durationDays: number | null;
  quantity: string | null;
  refills: number;
  instructions: string | null;
  sortOrder: number;
};

type Rx = {
  id: string;
  code: string;
  patientName: string;
  doctorId: string | null;
  doctorName: string | null;
  status: string;
  diagnosis: string | null;
  notes: string | null;
  issuedAt: string;
  items: RxItem[];
  itemCount: number;
};

const inputCls =
  "w-full rounded-lg border border-primary/15 bg-surface px-3 py-2 text-ink outline-none focus:border-primary";

export function PatientPrescriptions({ phone, name }: { phone: string; name: string }) {
  const { tr, lang } = useLang();
  const [rows, setRows] = useState<Rx[]>([]);
  const [medications, setMedications] = useState<MedicationLite[]>([]);
  const [doctors, setDoctors] = useState<RxDoctorLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!phone) return;
    let alive = true;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/prescriptions?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
        if (res.ok && alive) {
          const j = await res.json();
          setRows(j.prescriptions ?? []);
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

  const loadCatalog = useCallback(() => {
    fetch("/api/admin/medications", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { medications: [] }))
      .then((j) => setMedications(j.medications ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCatalog();
    fetch("/api/admin/doctors", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { doctors: [] }))
      .then((j) => setDoctors((j.doctors ?? []).filter((d: RxDoctorLite) => d.active)))
      .catch(() => {});
  }, [loadCatalog]);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

  const printRx = (id: string) => window.open(`/dashboard/prescriptions/${id}/print`, "_blank", "noopener");

  const cancelRx = async (id: string) => {
    if (!window.confirm(tr({ en: "Cancel this prescription?", ar: "إلغاء هذه الروشتة؟" }))) return;
    await fetch(`/api/admin/prescriptions/${id}/cancel`, { method: "POST" });
    reload();
  };

  const deleteRx = async (id: string) => {
    if (!window.confirm(tr({ en: "Delete this prescription?", ar: "حذف هذه الروشتة؟" }))) return;
    await fetch(`/api/admin/prescriptions/${id}`, { method: "DELETE" });
    reload();
  };

  return (
    <section className="rounded-2xl border border-primary/12 bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink">
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h10l6 6v10a0 0 0 0 1 0 0H4zM14 4v6h6M8 13h8M8 17h5" /></svg>
          {tr({ en: "Prescriptions", ar: "الروشتات" })}
        </h4>
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-3 py-1.5 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          {tr({ en: "New prescription", ar: "روشتة جديدة" })}
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-8 text-muted">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-primary/15 py-6 text-center text-sm text-muted">
          {tr({ en: "No prescriptions issued yet.", ar: "لا توجد روشتات صادرة بعد." })}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((rx) => {
            const cancelled = rx.status === "cancelled";
            return (
              <div key={rx.id} className={`rounded-xl border p-3 ${cancelled ? "border-rose-500/20 bg-rose-500/5" : "border-primary/10 bg-surface"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-bold text-ink">
                      <span className="font-mono text-xs text-primary">{rx.code}</span>
                      {cancelled && (
                        <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                          {tr({ en: "Cancelled", ar: "ملغاة" })}
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted">
                      {fmtDate(rx.issuedAt)}
                      {rx.doctorName ? ` · ${rx.doctorName}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => printRx(rx.id)}
                      title={tr({ en: "Print", ar: "طباعة" })}
                      className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-primary/10 hover:text-primary"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" /></svg>
                    </button>
                    {!cancelled && (
                      <button
                        onClick={() => cancelRx(rx.id)}
                        title={tr({ en: "Cancel", ar: "إلغاء" })}
                        className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-amber-500/10 hover:text-amber-600"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    )}
                    <button
                      onClick={() => deleteRx(rx.id)}
                      title={tr({ en: "Delete", ar: "حذف" })}
                      className="grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-rose-600"
                    >
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4h6v3" /></svg>
                    </button>
                  </div>
                </div>
                {rx.diagnosis && <p className="mt-1 text-xs text-ink/75">{rx.diagnosis}</p>}
                <ul className="mt-2 space-y-1">
                  {rx.items.map((it) => (
                    <li key={it.id} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                      <span className="font-semibold text-ink">{lang === "ar" ? it.nameAr : it.nameEn}</span>
                      {it.strength && <span className="text-muted">{it.strength}</span>}
                      {it.dosage && <span className="text-ink/70">· {it.dosage}</span>}
                      {it.frequency && <span className="text-ink/70">· {it.frequency}</span>}
                      {it.durationDays != null && (
                        <span className="text-ink/70">· {tr({ en: `${it.durationDays} day(s)`, ar: `${it.durationDays} يوم` })}</span>
                      )}
                      {it.refills > 0 && (
                        <span className="text-ink/70">· {tr({ en: `${it.refills} refill(s)`, ar: `${it.refills} إعادة صرف` })}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <NewPrescriptionModal
          phone={phone}
          name={name}
          medications={medications}
          doctors={doctors}
          onCatalogChanged={loadCatalog}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            reload();
          }}
        />
      )}
    </section>
  );
}

type LineDraft = {
  key: string;
  medicationId: string;
  name: string;
  strength: string;
  form: string;
  dosage: string;
  frequency: string;
  durationDays: string;
  refills: string;
  instructions: string;
  quantity: string;
};

let lineSeq = 0;
const emptyLine = (): LineDraft => ({
  key: `l${++lineSeq}`,
  medicationId: "",
  name: "",
  strength: "",
  form: "",
  dosage: "",
  frequency: "",
  durationDays: "",
  refills: "",
  instructions: "",
  quantity: "",
});

function NewPrescriptionModal({
  phone,
  name,
  medications,
  doctors,
  onCatalogChanged,
  onClose,
  onSaved,
}: {
  phone: string;
  name: string;
  medications: MedicationLite[];
  doctors: RxDoctorLite[];
  onCatalogChanged: () => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { tr, lang } = useLang();
  const [doctorId, setDoctorId] = useState<string>("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const medById = useMemo(() => new Map(medications.map((m) => [m.id, m])), [medications]);

  const patch = (key: string, next: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...next } : l)));

  const pickMedication = (key: string, medId: string) => {
    if (!medId) {
      patch(key, { medicationId: "" });
      return;
    }
    const m = medById.get(medId);
    if (!m) return;
    patch(key, {
      medicationId: medId,
      name: "",
      strength: m.strength ?? "",
      form: m.form ?? "",
      dosage: m.defaultDosage ?? "",
      frequency: m.defaultFrequency ?? "",
      durationDays: m.defaultDurationDays != null ? String(m.defaultDurationDays) : "",
      instructions: m.defaultInstructions ?? "",
    });
  };

  const saveToLibrary = async (key: string) => {
    const l = lines.find((x) => x.key === key);
    if (!l || !l.name.trim()) return;
    const res = await fetch("/api/admin/medications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameEn: l.name.trim(),
        nameAr: l.name.trim(),
        strength: l.strength.trim() || null,
        form: l.form.trim() || null,
        defaultDosage: l.dosage.trim() || null,
        defaultFrequency: l.frequency.trim() || null,
        defaultInstructions: l.instructions.trim() || null,
      }),
    });
    if (res.ok) {
      const j = await res.json();
      const med = j.medication as MedicationLite | undefined;
      onCatalogChanged();
      if (med?.id) patch(key, { medicationId: med.id, name: "" });
    }
  };

  const submit = async () => {
    setError(null);
    const items = lines
      .map((l) => {
        const custom = !l.medicationId;
        const hasName = l.medicationId || l.name.trim();
        if (!hasName) return null;
        return {
          medicationId: l.medicationId || null,
          nameEn: custom ? l.name.trim() : null,
          nameAr: custom ? l.name.trim() : null,
          strength: custom ? l.strength.trim() || null : null,
          form: custom ? l.form.trim() || null : null,
          dosage: l.dosage.trim() || null,
          frequency: l.frequency.trim() || null,
          durationDays: l.durationDays.trim() ? Number(l.durationDays) : null,
          refills: l.refills.trim() ? Number(l.refills) : null,
          instructions: l.instructions.trim() || null,
          quantity: l.quantity.trim() || null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    if (items.length === 0) {
      setError(tr({ en: "Add at least one medication.", ar: "أضف دواءً واحدًا على الأقل." }));
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          name,
          doctorId: doctorId || null,
          diagnosis: diagnosis.trim() || null,
          notes: notes.trim() || null,
          items,
        }),
      });
      if (res.ok) {
        onSaved();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.message || j.error || tr({ en: "Could not save.", ar: "تعذر الحفظ." }));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-primary/15 bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-extrabold text-ink">{tr({ en: "New prescription", ar: "روشتة جديدة" })}</h3>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">{tr({ en: "Prescribing doctor", ar: "الطبيب" })}</span>
            <select className={inputCls} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">{tr({ en: "— None —", ar: "— بدون —" })}</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{lang === "ar" ? d.nameAr : d.nameEn}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted">{tr({ en: "Diagnosis", ar: "التشخيص" })}</span>
            <input className={inputCls} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
          </label>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">{tr({ en: "Medications", ar: "الأدوية" })}</span>
            <button
              onClick={() => setLines((ls) => [...ls, emptyLine()])}
              className="inline-flex items-center gap-1 rounded-lg border border-primary/20 px-2 py-1 text-xs font-semibold text-primary transition hover:bg-primary/5"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              {tr({ en: "Add line", ar: "إضافة سطر" })}
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((l, idx) => {
              const custom = !l.medicationId;
              return (
                <div key={l.key} className="rounded-xl border border-primary/10 bg-surface p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-muted">#{idx + 1}</span>
                    {lines.length > 1 && (
                      <button
                        onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                        title={tr({ en: "Remove", ar: "إزالة" })}
                        className="grid h-6 w-6 place-items-center rounded-md text-muted transition hover:bg-rose-500/10 hover:text-rose-600"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-[11px] font-semibold text-muted">{tr({ en: "From library", ar: "من المكتبة" })}</span>
                      <select className={inputCls} value={l.medicationId} onChange={(e) => pickMedication(l.key, e.target.value)}>
                        <option value="">{tr({ en: "— Custom medication —", ar: "— دواء مخصص —" })}</option>
                        {medications.map((m) => (
                          <option key={m.id} value={m.id}>
                            {(lang === "ar" ? m.nameAr : m.nameEn)}{m.strength ? ` — ${m.strength}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    {custom && (
                      <>
                        <label className="block sm:col-span-2">
                          <span className="mb-1 block text-[11px] font-semibold text-muted">{tr({ en: "Medication name", ar: "اسم الدواء" })}</span>
                          <div className="flex gap-2">
                            <input className={inputCls} value={l.name} onChange={(e) => patch(l.key, { name: e.target.value })} placeholder={tr({ en: "e.g. Amoxicillin", ar: "مثال: أموكسيسيلين" })} />
                            <button
                              onClick={() => saveToLibrary(l.key)}
                              disabled={!l.name.trim()}
                              title={tr({ en: "Save to library", ar: "حفظ في المكتبة" })}
                              className="shrink-0 rounded-lg border border-primary/20 px-2 text-xs font-semibold text-primary transition hover:bg-primary/5 disabled:opacity-40"
                            >
                              {tr({ en: "Save", ar: "حفظ" })}
                            </button>
                          </div>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold text-muted">{tr({ en: "Strength", ar: "التركيز" })}</span>
                          <input className={inputCls} value={l.strength} onChange={(e) => patch(l.key, { strength: e.target.value })} placeholder="500 mg" />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold text-muted">{tr({ en: "Form", ar: "الشكل" })}</span>
                          <input className={inputCls} value={l.form} onChange={(e) => patch(l.key, { form: e.target.value })} placeholder={tr({ en: "tablet", ar: "قرص" })} />
                        </label>
                      </>
                    )}

                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-muted">{tr({ en: "Dosage", ar: "الجرعة" })}</span>
                      <input className={inputCls} value={l.dosage} onChange={(e) => patch(l.key, { dosage: e.target.value })} placeholder={tr({ en: "1 tablet", ar: "قرص واحد" })} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-muted">{tr({ en: "Frequency", ar: "التكرار" })}</span>
                      <input className={inputCls} value={l.frequency} onChange={(e) => patch(l.key, { frequency: e.target.value })} placeholder={tr({ en: "twice daily", ar: "مرتين يوميًا" })} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-muted">{tr({ en: "Duration (days)", ar: "المدة (أيام)" })}</span>
                      <input className={inputCls} type="number" min="1" value={l.durationDays} onChange={(e) => patch(l.key, { durationDays: e.target.value })} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-muted">{tr({ en: "Refills", ar: "إعادة الصرف" })}</span>
                      <input className={inputCls} type="number" min="0" value={l.refills} onChange={(e) => patch(l.key, { refills: e.target.value })} />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1 block text-[11px] font-semibold text-muted">{tr({ en: "Instructions", ar: "تعليمات" })}</span>
                      <input className={inputCls} value={l.instructions} onChange={(e) => patch(l.key, { instructions: e.target.value })} placeholder={tr({ en: "after meals", ar: "بعد الأكل" })} />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold text-muted">{tr({ en: "Notes", ar: "ملاحظات" })}</span>
          <textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        {error && <p className="mt-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-primary/20 px-4 py-2 text-sm font-semibold text-muted transition hover:bg-primary/5">
            {tr({ en: "Cancel", ar: "إلغاء" })}
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            {saving ? tr({ en: "Saving…", ar: "جارٍ الحفظ…" }) : tr({ en: "Issue prescription", ar: "إصدار الروشتة" })}
          </button>
        </div>
      </div>
    </div>
  );
}
