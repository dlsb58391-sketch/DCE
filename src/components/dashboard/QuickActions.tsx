"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/language";
import { sessionTypes } from "@/lib/dashboard";
import { OperationModal, type Procedure, type DoctorLite } from "./PatientOperations";

const inputCls =
  "w-full rounded-lg border border-primary/15 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary";

export type PickedClient = { name: string; phone: string; patientId: string | null };
type Found = { id: string; name: string; phone: string; createdAt?: string };

const tail = (p: string) => (p || "").replace(/\D/g, "").slice(-9);

/** Modal shell shared by the quick-add appointment / operation dialogs. */
function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div className="custom-scroll max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-primary/15 bg-background p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-extrabold text-ink">{title}</h3>
        {children}
      </div>
    </div>
  );
}

/**
 * Pick a client for an appointment/operation: search existing accounts by name
 * or phone, or add a new one. When adding new, a matching phone triggers a
 * duplicate prompt so the doctor can reuse the existing profile instead.
 */
export function ClientPicker({
  onPick,
  allowLater,
  onLater,
}: {
  onPick: (c: PickedClient) => void;
  allowLater?: boolean;
  onLater?: () => void;
}) {
  const { tr } = useLang();
  const [mode, setMode] = useState<"search" | "new">("search");

  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  const [searching, setSearching] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [dup, setDup] = useState<Found | null>(null);

  // Debounced type-ahead search over all client accounts.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/patients/search?q=${encodeURIComponent(term)}`, { cache: "no-store" });
        const j = await res.json();
        setResults((j.patients ?? []) as Found[]);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // While entering a new client, warn if the phone already belongs to someone.
  useEffect(() => {
    if (mode !== "new") return;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) {
      setDup(null);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/patients/search?q=${encodeURIComponent(digits)}`, { cache: "no-store" });
        const j = await res.json();
        const list = (j.patients ?? []) as Found[];
        setDup(list.find((p) => tail(p.phone) === tail(phone)) ?? null);
      } catch {
        setDup(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [phone, mode]);

  return (
    <div className="space-y-3">
      {/* mode toggle */}
      <div className="flex rounded-xl border border-primary/15 bg-surface-2 p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setMode("search")}
          className={`flex-1 rounded-lg px-3 py-1.5 transition ${mode === "search" ? "bg-primary text-[#0a0e12]" : "text-muted hover:text-ink"}`}
        >
          {tr({ en: "Existing client", ar: "عميل موجود" })}
        </button>
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`flex-1 rounded-lg px-3 py-1.5 transition ${mode === "new" ? "bg-primary text-[#0a0e12]" : "text-muted hover:text-ink"}`}
        >
          {tr({ en: "New client", ar: "عميل جديد" })}
        </button>
      </div>

      {mode === "search" ? (
        <div className="space-y-2">
          <input
            autoFocus
            className={inputCls}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tr({ en: "Search by name or number…", ar: "ابحث بالاسم أو الرقم…" })}
          />
          <div className="custom-scroll max-h-52 space-y-1.5 overflow-y-auto">
            {searching && <p className="py-2 text-center text-xs text-muted">{tr({ en: "Searching…", ar: "جارٍ البحث…" })}</p>}
            {!searching && q.trim().length >= 2 && results.length === 0 && (
              <div className="rounded-xl border border-dashed border-primary/20 bg-surface-2 p-3 text-center text-xs text-muted">
                {tr({ en: "No match. Add as a new client.", ar: "لا يوجد تطابق. أضِفه كعميل جديد." })}
                <button
                  type="button"
                  onClick={() => {
                    const digits = q.replace(/\D/g, "");
                    setMode("new");
                    if (digits.length >= 5) setPhone(q.trim());
                    else setName(q.trim());
                  }}
                  className="mt-2 block w-full rounded-lg bg-primary/10 px-3 py-1.5 font-bold text-primary hover:bg-primary/15"
                >
                  {tr({ en: "+ New client", ar: "+ عميل جديد" })}
                </button>
              </div>
            )}
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPick({ name: p.name, phone: p.phone, patientId: p.id })}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-primary/12 bg-surface px-3 py-2 text-start transition hover:border-primary/40 hover:bg-primary/5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-ink">{p.name}</span>
                  <span className="block truncate text-[11px] text-muted" dir="ltr">{p.phone}</span>
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-primary">{tr({ en: "Select", ar: "اختيار" })}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">{tr({ en: "Full name", ar: "الاسم" })}</span>
            <input autoFocus className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder={tr({ en: "Client name", ar: "اسم العميل" })} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">{tr({ en: "Phone number", ar: "رقم الهاتف" })}</span>
            <input dir="ltr" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+20 1XX XXX XXXX" />
          </label>

          {dup && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-50 p-3 text-sm">
              <p className="font-semibold text-amber-800">
                {tr({ en: "This number is already registered to", ar: "هذا الرقم مسجّل بالفعل لـ" })} <b>{dup.name}</b>.
              </p>
              <button
                type="button"
                onClick={() => onPick({ name: dup.name, phone: dup.phone, patientId: dup.id })}
                className="mt-2 w-full rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-amber-600"
              >
                {tr({ en: "Use this profile", ar: "استخدام هذا الملف" })}
              </button>
            </div>
          )}

          <button
            type="button"
            disabled={!name.trim() || phone.replace(/\D/g, "").length < 6}
            onClick={() => onPick({ name: name.trim(), phone: phone.trim(), patientId: null })}
            className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-[#0a0e12] transition hover:brightness-95 disabled:opacity-40"
          >
            {dup ? tr({ en: "Create a new profile anyway", ar: "إنشاء ملف جديد على أي حال" }) : tr({ en: "Continue", ar: "متابعة" })}
          </button>
        </div>
      )}

      {allowLater && (
        <button type="button" onClick={onLater} className="w-full rounded-lg border border-primary/15 px-3 py-2 text-sm font-semibold text-muted transition hover:bg-primary/5">
          {tr({ en: "Set the client later", ar: "تحديد العميل لاحقًا" })}
        </button>
      )}
    </div>
  );
}

/** A compact summary chip for the client chosen in a quick-add flow. */
function ClientSummary({ client, onChange }: { client: PickedClient | "later"; onChange: () => void }) {
  const { tr } = useLang();
  const later = client === "later";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/15 bg-surface-2 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-ink">
          {later ? tr({ en: "Client — set later", ar: "العميل — لاحقًا" }) : client.name}
          {!later && client.patientId && (
            <span className="ms-2 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">{tr({ en: "existing", ar: "موجود" })}</span>
          )}
        </p>
        {!later && <p className="truncate text-[11px] text-muted" dir="ltr">{client.phone}</p>}
      </div>
      <button type="button" onClick={onChange} className="shrink-0 text-xs font-semibold text-primary hover:underline">
        {tr({ en: "Change", ar: "تغيير" })}
      </button>
    </div>
  );
}

/** Quick-add: book an appointment (client + day/time + doctor + service). */
export function AddAppointmentModal({
  procedures,
  doctors,
  initialDate,
  initialTime,
  onClose,
  onSaved,
}: {
  procedures: Procedure[];
  doctors: DoctorLite[];
  initialDate?: string;
  initialTime?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { tr, lang } = useLang();
  const [client, setClient] = useState<PickedClient | "later" | null>(null);

  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const [date, setDate] = useState(initialDate ?? `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`);
  const [time, setTime] = useState(initialTime ?? "10:00");
  const serviceOptions = useMemo(() => {
    const active = procedures.filter((p) => p.active);
    if (active.length > 0) {
      return active.map((p) => ({
        id: p.id,
        labelEn: p.nameEn,
        labelAr: p.nameAr,
        durationMin: 30,
      }));
    }
    return sessionTypes.map((s) => ({
      id: s.id,
      labelEn: s.label.en,
      labelAr: s.label.ar,
      durationMin: s.durationMin,
    }));
  }, [procedures]);
  const [serviceId, setServiceId] = useState(serviceOptions[0]?.id ?? "checkup");
  const [doctorId, setDoctorId] = useState("");
  const [complaint, setComplaint] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const selectedServiceId = serviceOptions.some((s) => s.id === serviceId)
    ? serviceId
    : (serviceOptions[0]?.id ?? "checkup");
  const service = serviceOptions.find((s) => s.id === selectedServiceId) ?? serviceOptions[0];

  const save = async () => {
    if (!client) return;
    setSaving(true);
    setErr("");
    try {
      const scheduledAt = new Date(`${date}T${time}`);
      if (Number.isNaN(scheduledAt.getTime())) {
        setErr(tr({ en: "Pick a valid date and time.", ar: "اختر تاريخًا ووقتًا صحيحين." }));
        setSaving(false);
        return;
      }
      const isLater = client === "later";
      const payload = {
        name: isLater ? tr({ en: "Walk-in", ar: "بدون اسم" }) : client.name,
        phone: isLater ? "" : client.phone,
        scheduledAt: scheduledAt.toISOString(),
        durationMin: service?.durationMin ?? 30,
        serviceId: selectedServiceId,
        serviceLabelEn: service?.labelEn ?? serviceId,
        serviceLabelAr: service?.labelAr ?? serviceId,
        doctorId: doctorId || undefined,
        patientId: isLater ? undefined : client.patientId ?? undefined,
        createAccount: !isLater,
        complaint: complaint.trim() || undefined,
        lang,
      };
      if (isLater && !payload.phone) {
        // An appointment still needs a phone; block "later" without a number.
        setErr(tr({ en: "A phone number is required to book.", ar: "رقم الهاتف مطلوب للحجز." }));
        setSaving(false);
        return;
      }
      const res = await fetch("/api/admin/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setErr(tr({ en: "Could not save the appointment.", ar: "تعذّر حفظ الموعد." }));
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setErr(tr({ en: "Could not save the appointment.", ar: "تعذّر حفظ الموعد." }));
      setSaving(false);
    }
  };

  const activeDoctors = doctors.filter((d) => d.active);

  return (
    <Overlay title={tr({ en: "New appointment", ar: "موعد جديد" })} onClose={onClose}>
      {!client ? (
        <ClientPicker onPick={setClient} />
      ) : (
        <div className="space-y-3">
          <ClientSummary client={client} onChange={() => setClient(null)} />

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">{tr({ en: "Date", ar: "التاريخ" })}</span>
              <input type="date" dir="ltr" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold text-ink">{tr({ en: "Time", ar: "الوقت" })}</span>
              <input type="time" dir="ltr" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">{tr({ en: "Service", ar: "الخدمة" })}</span>
            <select className={inputCls} value={selectedServiceId} onChange={(e) => setServiceId(e.target.value)}>
              {serviceOptions.map((s) => (
                <option key={s.id} value={s.id}>{lang === "ar" ? s.labelAr : s.labelEn}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">{tr({ en: "Doctor (optional)", ar: "الطبيب (اختياري)" })}</span>
            <select className={inputCls} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
              <option value="">{tr({ en: "— Any doctor —", ar: "— أي طبيب —" })}</option>
              {activeDoctors.map((d) => (
                <option key={d.id} value={d.id}>{lang === "ar" ? d.nameAr : d.nameEn}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-ink">{tr({ en: "Note (optional)", ar: "ملاحظة (اختياري)" })}</span>
            <input className={inputCls} value={complaint} onChange={(e) => setComplaint(e.target.value)} placeholder={tr({ en: "Reason / complaint", ar: "السبب / الشكوى" })} />
          </label>

          {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{err}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-primary/15 px-3 py-2 text-sm font-semibold text-muted transition hover:bg-primary/5">
              {tr({ en: "Cancel", ar: "إلغاء" })}
            </button>
            <button type="button" disabled={saving} onClick={save} className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-bold text-[#0a0e12] transition hover:brightness-95 disabled:opacity-40">
              {saving ? tr({ en: "Saving…", ar: "جارٍ الحفظ…" }) : tr({ en: "Book appointment", ar: "حجز الموعد" })}
            </button>
          </div>
        </div>
      )}
    </Overlay>
  );
}

/**
 * Quick-add an operation that was just performed: first pick/create the client,
 * then reuse the full operation form (doctors, price, discount, payment).
 */
export function QuickOperationModal({
  procedures,
  doctors,
  onClose,
  onSaved,
}: {
  procedures: Procedure[];
  doctors: DoctorLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { tr } = useLang();
  const [client, setClient] = useState<PickedClient | null>(null);

  if (client) {
    return (
      <OperationModal
        phone={client.phone}
        name={client.name}
        procedures={procedures}
        doctors={doctors}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  return (
    <Overlay title={tr({ en: "Record an operation — choose client", ar: "تسجيل عملية — اختر العميل" })} onClose={onClose}>
      <ClientPicker onPick={setClient} />
    </Overlay>
  );
}
