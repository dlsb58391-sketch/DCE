"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLang } from "@/lib/language";
import { activeClinic } from "@/lib/clinics";

type RxItem = {
  id: string;
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
};

type Rx = {
  id: string;
  code: string;
  patientName: string;
  doctorName: string | null;
  status: string;
  diagnosis: string | null;
  notes: string | null;
  issuedAt: string;
  items: RxItem[];
};

export default function PrescriptionPrintPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { tr, lang } = useLang();
  const clinic = activeClinic();
  const [rx, setRx] = useState<Rx | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!id) return;
    let alive = true;
    fetch(`/api/admin/prescriptions/${id}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j) => {
        if (!alive) return;
        setRx(j.prescription as Rx);
        setState("ready");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (state === "ready") {
      const t = setTimeout(() => window.print(), 350);
      return () => clearTimeout(t);
    }
  }, [state]);

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));

  if (state === "loading") {
    return <div className="p-10 text-center text-gray-500">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</div>;
  }
  if (state === "error" || !rx) {
    return <div className="p-10 text-center text-red-600">{tr({ en: "Prescription not found.", ar: "الروشتة غير موجودة." })}</div>;
  }

  const cancelled = rx.status === "cancelled";

  return (
    <div className="rx-print mx-auto max-w-3xl bg-white p-8 text-gray-900">
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print {
          .rx-noprint { display: none !important; }
          .rx-print { padding: 0 !important; max-width: none !important; }
          body { background: #fff !important; }
        }
        .rx-print table { border-collapse: collapse; width: 100%; }
        .rx-print th, .rx-print td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: start; vertical-align: top; }
        .rx-print th { background: #f3f4f6; font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
      `}</style>

      <div className="rx-noprint mb-6 flex justify-end gap-2">
        <button onClick={() => window.print()} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
          {tr({ en: "Print", ar: "طباعة" })}
        </button>
        <button onClick={() => window.close()} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">
          {tr({ en: "Close", ar: "إغلاق" })}
        </button>
      </div>

      <header className="mb-6 flex items-start justify-between gap-4 border-b-2 border-gray-900 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold">{tr(clinic.brand)}</h1>
          {clinic.contact?.addressDisplay && <p className="mt-1 text-sm text-gray-600">{tr(clinic.contact.addressDisplay)}</p>}
          {clinic.contact?.phoneDisplay && <p className="text-sm text-gray-600" dir="ltr">{clinic.contact.phoneDisplay}</p>}
        </div>
        <div className="text-end">
          <p className="text-3xl font-black tracking-widest text-gray-300">℞</p>
          <p className="font-mono text-sm font-bold">{rx.code}</p>
        </div>
      </header>

      {cancelled && (
        <p className="mb-4 rounded border-2 border-red-500 px-3 py-2 text-center text-sm font-bold uppercase text-red-600">
          {tr({ en: "Cancelled prescription", ar: "روشتة ملغاة" })}
        </p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div>
          <span className="font-semibold text-gray-500">{tr({ en: "Patient", ar: "المريض" })}: </span>
          <span className="font-bold">{rx.patientName}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-500">{tr({ en: "Date", ar: "التاريخ" })}: </span>
          <span className="font-bold">{fmtDate(rx.issuedAt)}</span>
        </div>
        <div>
          <span className="font-semibold text-gray-500">{tr({ en: "Doctor", ar: "الطبيب" })}: </span>
          <span className="font-bold">{rx.doctorName || "—"}</span>
        </div>
        {rx.diagnosis && (
          <div className="col-span-2">
            <span className="font-semibold text-gray-500">{tr({ en: "Diagnosis", ar: "التشخيص" })}: </span>
            <span className="font-bold">{rx.diagnosis}</span>
          </div>
        )}
      </div>

      <table>
        <thead>
          <tr>
            <th style={{ width: "4%" }}>#</th>
            <th>{tr({ en: "Medication", ar: "الدواء" })}</th>
            <th>{tr({ en: "Dosage", ar: "الجرعة" })}</th>
            <th>{tr({ en: "Frequency", ar: "التكرار" })}</th>
            <th>{tr({ en: "Duration", ar: "المدة" })}</th>
            <th>{tr({ en: "Refills", ar: "الصرف" })}</th>
          </tr>
        </thead>
        <tbody>
          {rx.items.map((it, i) => (
            <tr key={it.id}>
              <td>{i + 1}</td>
              <td>
                <div className="font-bold">
                  {lang === "ar" ? it.nameAr : it.nameEn}
                  {it.strength ? ` — ${it.strength}` : ""}
                  {it.form ? ` (${it.form})` : ""}
                </div>
                {it.instructions && <div className="text-xs text-gray-600">{it.instructions}</div>}
                {it.quantity && (
                  <div className="text-xs text-gray-600">
                    {tr({ en: "Qty", ar: "الكمية" })}: {it.quantity}
                  </div>
                )}
              </td>
              <td>{it.dosage || "—"}</td>
              <td>{it.frequency || "—"}</td>
              <td>{it.durationDays != null ? tr({ en: `${it.durationDays} day(s)`, ar: `${it.durationDays} يوم` }) : "—"}</td>
              <td>{it.refills || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rx.notes && (
        <div className="mt-5 text-sm">
          <p className="font-semibold text-gray-500">{tr({ en: "Notes", ar: "ملاحظات" })}</p>
          <p className="mt-1 whitespace-pre-wrap">{rx.notes}</p>
        </div>
      )}

      <div className="mt-16 flex items-end justify-between">
        <p className="text-xs text-gray-400">{tr({ en: "Generated by", ar: "صادر عن" })} {tr(clinic.brand)}</p>
        <div className="text-center">
          <div className="mb-1 w-56 border-t border-gray-500" />
          <p className="text-sm text-gray-600">{tr({ en: "Doctor's signature", ar: "توقيع الطبيب" })}</p>
        </div>
      </div>
    </div>
  );
}
