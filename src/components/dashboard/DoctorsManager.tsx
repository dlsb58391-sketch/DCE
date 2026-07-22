"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { formatMoney } from "@/lib/patients";

type Doctor = {
  id: string;
  nameEn: string;
  nameAr: string;
  phone: string | null;
  email: string | null;
  specialtyEn: string | null;
  specialtyAr: string | null;
  photoUrl: string | null;
  commissionPct: number;
  active: boolean;
  notes: string | null;
};

type Draft = {
  id?: string;
  nameEn: string;
  nameAr: string;
  phone: string;
  email: string;
  specialtyEn: string;
  specialtyAr: string;
  commissionPct: string;
  notes: string;
  photoUrl: string | null;
};

const emptyDraft = (): Draft => ({
  nameEn: "",
  nameAr: "",
  phone: "",
  email: "",
  specialtyEn: "",
  specialtyAr: "",
  commissionPct: "",
  notes: "",
  photoUrl: null,
});

/** Downscale a picked image to a square-ish thumbnail data URL to keep the DB small. */
function fileToDataUrl(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no ctx"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}

export function DoctorsManager() {
  const { tr, lang } = useLang();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/doctors", { cache: "no-store" });
      if (res.ok) setDoctors((await res.json()).doctors ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dName = (d: { nameEn: string; nameAr: string }) => (lang === "ar" ? d.nameAr : d.nameEn) || d.nameEn || d.nameAr;

  const startAdd = () => setEditing(emptyDraft());
  const startEdit = (d: Doctor) =>
    setEditing({
      id: d.id,
      nameEn: d.nameEn,
      nameAr: d.nameAr,
      phone: d.phone ?? "",
      email: d.email ?? "",
      specialtyEn: d.specialtyEn ?? "",
      specialtyAr: d.specialtyAr ?? "",
      commissionPct: String(d.commissionPct ?? 0),
      notes: d.notes ?? "",
      photoUrl: d.photoUrl ?? null,
    });

  const save = async () => {
    if (!editing) return;
    if (!editing.nameEn.trim() && !editing.nameAr.trim()) return;
    setSaving(true);
    try {
      const payload = {
        nameEn: editing.nameEn.trim(),
        nameAr: editing.nameAr.trim(),
        phone: editing.phone.trim(),
        email: editing.email.trim(),
        specialtyEn: editing.specialtyEn.trim(),
        specialtyAr: editing.specialtyAr.trim(),
        commissionPct: Number(editing.commissionPct) || 0,
        notes: editing.notes.trim(),
        photoUrl: editing.photoUrl,
      };
      if (editing.id) {
        await fetch(`/api/admin/doctors/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await fetch("/api/admin/doctors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (d: Doctor) => {
    await fetch(`/api/admin/doctors/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !d.active }) });
    load();
  };

  const remove = async (d: Doctor) => {
    if (!window.confirm(tr({ en: `Delete Dr. ${dName(d)}? Their past earnings history will be removed from reports.`, ar: `حذف د. ${dName(d)}؟ سيُزال سجل أرباحه من التقارير.` }))) return;
    await fetch(`/api/admin/doctors/${d.id}`, { method: "DELETE" });
    load();
  };

  const onPickPhoto = async (file: File | null) => {
    if (!file || !editing) return;
    try {
      const url = await fileToDataUrl(file);
      setEditing((e) => (e ? { ...e, photoUrl: url } : e));
    } catch {
      /* ignore bad image */
    }
  };

  if (profileId) {
    return <DoctorProfile id={profileId} onBack={() => setProfileId(null)} onEdit={(d) => { setProfileId(null); startEdit(d); }} />;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">{tr({ en: "Doctors", ar: "الأطباء" })}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {tr({ en: "Your practitioners and their commission. Assign them to operations to track earnings.", ar: "الأطباء ونسبة عمولتهم. أسندهم للعمليات لتتبّع الأرباح." })}
          </p>
        </div>
        <button onClick={startAdd} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-3.5 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          {tr({ en: "Add doctor", ar: "إضافة طبيب" })}
        </button>
      </div>

      {editing && (
        <div className="rounded-2xl border border-primary/20 bg-surface p-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-2xl border border-primary/15 bg-surface-2">
                {editing.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editing.photoUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <svg viewBox="0 0 24 24" className="h-10 w-10 text-muted/50" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 19a4 4 0 0 0-8 0M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /></svg>
                )}
              </div>
              <label className="cursor-pointer rounded-lg border border-primary/15 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/5">
                {tr({ en: "Photo", ar: "صورة" })}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)} />
              </label>
              {editing.photoUrl && (
                <button onClick={() => setEditing({ ...editing, photoUrl: null })} className="text-[11px] font-semibold text-rose-600">{tr({ en: "Remove", ar: "إزالة" })}</button>
              )}
            </div>

            <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
              <Field label={tr({ en: "Name (Arabic)", ar: "الاسم بالعربي" })}>
                <input className={inputCls} value={editing.nameAr} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} placeholder="د. حسن…" />
              </Field>
              <Field label={tr({ en: "Name (English)", ar: "الاسم بالإنجليزي" })}>
                <input className={inputCls} value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} placeholder="Dr. Hassan…" dir="ltr" />
              </Field>
              <Field label={tr({ en: "Specialty (Arabic)", ar: "التخصص بالعربي" })}>
                <input className={inputCls} value={editing.specialtyAr} onChange={(e) => setEditing({ ...editing, specialtyAr: e.target.value })} placeholder="زراعة، تقويم…" />
              </Field>
              <Field label={tr({ en: "Specialty (English)", ar: "التخصص بالإنجليزي" })}>
                <input className={inputCls} value={editing.specialtyEn} onChange={(e) => setEditing({ ...editing, specialtyEn: e.target.value })} placeholder="Implants, Ortho…" dir="ltr" />
              </Field>
              <Field label={tr({ en: "Commission %", ar: "نسبة العمولة ٪" })}>
                <input type="number" min={0} max={100} dir="ltr" className={inputCls} value={editing.commissionPct} onChange={(e) => setEditing({ ...editing, commissionPct: e.target.value })} placeholder="50" />
              </Field>
              <Field label={tr({ en: "Phone", ar: "الهاتف" })}>
                <input dir="ltr" className={inputCls} value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </Field>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button onClick={save} disabled={saving} className="rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 disabled:opacity-60">
              {saving ? tr({ en: "Saving…", ar: "جارٍ الحفظ…" }) : tr({ en: "Save", ar: "حفظ" })}
            </button>
            <button onClick={() => setEditing(null)} className="rounded-lg border border-primary/15 px-4 py-2 text-sm font-semibold text-muted transition hover:text-ink">{tr({ en: "Cancel", ar: "إلغاء" })}</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid place-items-center py-16 text-muted"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /></div>
      ) : doctors.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-primary/20 bg-surface py-14 text-center text-sm text-muted">{tr({ en: "No doctors yet. Add your first one.", ar: "لا يوجد أطباء بعد. أضف أول طبيب." })}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {doctors.map((d) => (
            <div key={d.id} className={`rounded-2xl border border-primary/12 bg-surface p-4 ${d.active ? "" : "opacity-60"}`}>
              <div className="flex items-start gap-3">
                <button onClick={() => setProfileId(d.id)} className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl border border-primary/15 bg-surface-2">
                  {d.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-7 w-7 text-muted/50" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 19a4 4 0 0 0-8 0M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /></svg>
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <button onClick={() => setProfileId(d.id)} className="block truncate text-start font-bold text-ink hover:text-primary">{dName(d)}</button>
                  {(d.specialtyEn || d.specialtyAr) && <p className="truncate text-xs text-muted">{lang === "ar" ? d.specialtyAr : d.specialtyEn}</p>}
                  <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">{d.commissionPct}% {tr({ en: "commission", ar: "عمولة" })}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <button onClick={() => setProfileId(d.id)} className="rounded-lg border border-primary/15 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/5">{tr({ en: "Profile & earnings", ar: "الملف والأرباح" })}</button>
                <button onClick={() => toggleActive(d)} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${d.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{d.active ? tr({ en: "Active", ar: "مفعّل" }) : tr({ en: "Hidden", ar: "مخفي" })}</button>
                <div className="ms-auto flex items-center gap-1">
                  <button onClick={() => startEdit(d)} title={tr({ en: "Edit", ar: "تعديل" })} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-primary/10 hover:text-primary">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                  </button>
                  <button onClick={() => remove(d)} title={tr({ en: "Delete", ar: "حذف" })} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-rose-600">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4h6v3" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-primary/15 bg-background px-3 py-2 text-sm text-ink outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

// ---- Doctor profile: earnings history + month filter ----

type EarningsOp = {
  id: string;
  performedAt: string;
  monthKey: string;
  nameEn: string;
  nameAr: string;
  patientName: string | null;
  patientPhone: string | null;
  price: number;
  commissionPct: number;
  amount: number;
  inMonth: boolean;
};
type Earnings = {
  doctor: Doctor;
  month: string | null;
  totals: { allEarned: number; allCount: number; monthEarned: number; monthCount: number };
  months: { key: string; earned: number; count: number }[];
  operations: EarningsOp[];
};

const monthKeyNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function DoctorProfile({ id, onBack, onEdit }: { id: string; onBack: () => void; onEdit: (d: Doctor) => void }) {
  const { tr, lang } = useLang();
  const [month, setMonth] = useState(monthKeyNow());
  const [data, setData] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/admin/doctors/${id}/earnings?month=${encodeURIComponent(month)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setData(j))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, month]);

  const dName = (d: { nameEn: string; nameAr: string }) => (lang === "ar" ? d.nameAr : d.nameEn) || d.nameEn || d.nameAr;
  const fmtDate = (iso: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { month: "short" }).format(new Date(y, m - 1, 1));
  };
  const maxEarned = data ? Math.max(1, ...data.months.map((m) => m.earned)) : 1;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-ink">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        {tr({ en: "All doctors", ar: "كل الأطباء" })}
      </button>

      {loading && !data ? (
        <div className="grid place-items-center py-16 text-muted"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /></div>
      ) : data ? (
        <>
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-primary/12 bg-surface p-5">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-primary/15 bg-surface-2">
              {data.doctor.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.doctor.photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-9 w-9 text-muted/50" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 19a4 4 0 0 0-8 0M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /></svg>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold text-ink">{dName(data.doctor)}</h2>
              {(data.doctor.specialtyEn || data.doctor.specialtyAr) && <p className="text-sm text-muted">{lang === "ar" ? data.doctor.specialtyAr : data.doctor.specialtyEn}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">{data.doctor.commissionPct}% {tr({ en: "commission", ar: "عمولة" })}</span>
                {data.doctor.phone && <span dir="ltr" className="text-muted">{data.doctor.phone}</span>}
              </div>
            </div>
            <button onClick={() => onEdit(data.doctor)} className="rounded-lg border border-primary/15 px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/5">{tr({ en: "Edit", ar: "تعديل" })}</button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={tr({ en: "This month", ar: "هذا الشهر" })} value={formatMoney(data.totals.monthEarned, lang)} accent="#a87f2b" />
            <Stat label={tr({ en: "Operations (month)", ar: "عمليات (الشهر)" })} value={String(data.totals.monthCount)} accent="#1c2127" />
            <Stat label={tr({ en: "All-time earned", ar: "إجمالي الأرباح" })} value={formatMoney(data.totals.allEarned, lang)} accent="#10b981" />
            <Stat label={tr({ en: "Operations (all)", ar: "عمليات (الكل)" })} value={String(data.totals.allCount)} accent="#3b82f6" />
          </div>

          <div className="rounded-2xl border border-primary/12 bg-surface p-5">
            <h3 className="text-sm font-bold text-ink">{tr({ en: "Earnings — last 12 months", ar: "الأرباح — آخر ١٢ شهر" })}</h3>
            <div className="mt-4 flex h-40 items-stretch gap-2">
              {data.months.map((m) => (
                <div key={m.key} className="flex h-full flex-1 flex-col items-center gap-1.5" title={`${formatMoney(m.earned, lang)} · ${m.count}`}>
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t-md bg-gradient-to-t from-primary/40 to-primary" style={{ height: `${m.earned > 0 ? Math.max(3, (m.earned / maxEarned) * 100) : 0}%` }} />
                  </div>
                  <span className="text-[10px] font-medium text-muted">{monthLabel(m.key)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-primary/12 bg-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-ink">{tr({ en: "Operations in", ar: "العمليات في" })} {monthLabel(month)}</h3>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value || monthKeyNow())} dir="ltr" className="rounded-lg border border-primary/15 bg-background px-3 py-1.5 text-sm text-ink outline-none focus:border-primary" />
            </div>
            <div className="mt-3 space-y-2">
              {data.operations.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">{tr({ en: "No operations this month.", ar: "لا عمليات هذا الشهر." })}</p>
              ) : (
                data.operations.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-primary/10 bg-surface-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{o.patientName || o.patientPhone || tr({ en: "Client", ar: "عميل" })}</p>
                      <p className="truncate text-[11px] text-muted">{lang === "ar" ? o.nameAr : o.nameEn} · {fmtDate(o.performedAt)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-primary">{formatMoney(o.amount, lang)}</p>
                      <p className="text-[11px] text-muted" dir="ltr">{o.commissionPct}% × {formatMoney(o.price, lang)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="py-16 text-center text-sm text-muted">{tr({ en: "Could not load this doctor.", ar: "تعذّر تحميل بيانات الطبيب." })}</p>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-primary/12 bg-surface p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-extrabold" style={{ color: accent }}>{value}</p>
    </div>
  );
}
