"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useLang } from "@/lib/language";

type Status = {
  state: "qr" | "authenticated" | "ready" | "disconnected" | "offline";
  fresh: boolean;
  qrDataUrl: string | null;
  at: number;
};

type WaBranch = {
  id: string;
  nameEn: string;
  nameAr: string;
  code: string;
  whatsappNumber: string | null;
  isDefault: boolean;
};

export function WhatsAppLink() {
  const { tr, lang } = useLang();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/worker-status", { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 4000); // QR rotates ~every 20s; poll often
    return () => clearInterval(id);
  }, [load]);

  // Booking-branch routing: only relevant once the clinic has 2+ branches.
  const [branches, setBranches] = useState<WaBranch[]>([]);
  const [bookingBranchId, setBookingBranchId] = useState<string>("");
  const [canWrite, setCanWrite] = useState(false);
  const [savingBranch, setSavingBranch] = useState(false);
  const [branchNotice, setBranchNotice] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCanWrite(j?.user?.role === "admin" || j?.user?.role === "doctor"))
      .catch(() => setCanWrite(false));
  }, []);

  useEffect(() => {
    fetch("/api/admin/whatsapp/branch", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j) return;
        setBranches(j.branches ?? []);
        setBookingBranchId(j.branchId ?? "");
      })
      .catch(() => {});
  }, []);

  const saveBookingBranch = useCallback(
    async (branchId: string) => {
      setSavingBranch(true);
      setBranchNotice(null);
      try {
        const res = await fetch("/api/admin/whatsapp/branch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branchId }),
        });
        if (res.ok) {
          const j = await res.json();
          setBookingBranchId(j.branchId ?? branchId);
          setBranchNotice(tr({ en: "Saved.", ar: "تم الحفظ." }));
        } else {
          setBranchNotice(tr({ en: "Could not save.", ar: "تعذر الحفظ." }));
        }
      } finally {
        setSavingBranch(false);
      }
    },
    [tr],
  );

  const state = status?.state ?? "offline";

  const badge =
    state === "ready"
      ? { txt: tr({ en: "Connected", ar: "متصل" }), cls: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" }
      : state === "qr"
      ? { txt: tr({ en: "Waiting for scan", ar: "بانتظار المسح" }), cls: "bg-amber-100 text-amber-700", dot: "bg-amber-500" }
      : state === "authenticated"
      ? { txt: tr({ en: "Connecting…", ar: "جارٍ الاتصال…" }), cls: "bg-blue-100 text-blue-700", dot: "bg-blue-500" }
      : { txt: tr({ en: "Worker offline", ar: "الخدمة متوقفة" }), cls: "bg-rose-100 text-rose-600", dot: "bg-rose-500" };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-extrabold tracking-tight text-ink">
            {tr({ en: "WhatsApp Booking Bot", ar: "بوت الحجز على واتساب" })}
          </h2>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${badge.cls}`}>
            <span className={`h-2 w-2 rounded-full ${badge.dot} ${state === "qr" ? "animate-pulse" : ""}`} />
            {badge.txt}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">
          {tr({
            en: "Link the clinic's WhatsApp number so patients can book by chatting with the bot.",
            ar: "اربط رقم واتساب العيادة ليتمكن المرضى من الحجز بالدردشة مع البوت.",
          })}
        </p>
      </div>

      <div className="rounded-2xl border border-primary/15 bg-surface p-6">
        {loading ? (
          <div className="grid place-items-center py-16 text-muted">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          </div>
        ) : state === "ready" ? (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
              <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h3 className="mt-4 text-lg font-bold text-ink">{tr({ en: "Bot is live 🎉", ar: "البوت يعمل 🎉" })}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted">
              {tr({
                en: "Patients messaging the clinic number now get the booking bot automatically.",
                ar: "المرضى الذين يراسلون رقم العيادة يحصلون الآن على بوت الحجز تلقائيًا.",
              })}
            </p>
          </div>
        ) : state === "qr" && status?.qrDataUrl ? (
          <div className="flex flex-col items-center text-center">
            <div className="rounded-2xl border border-primary/15 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <Image src={status.qrDataUrl} alt="WhatsApp QR" width={280} height={280} unoptimized />
            </div>
            <h3 className="mt-4 font-bold text-ink">{tr({ en: "Scan to link", ar: "امسح للربط" })}</h3>
            <ol className="mt-2 inline-block space-y-1 text-start text-sm text-muted">
              <li>1. {tr({ en: "Open WhatsApp on the clinic phone", ar: "افتح واتساب على هاتف العيادة" })}</li>
              <li>2. {tr({ en: "Settings → Linked Devices", ar: "الإعدادات ← الأجهزة المرتبطة" })}</li>
              <li>3. {tr({ en: "Tap “Link a Device” and scan this", ar: "اضغط «ربط جهاز» وامسح هذا" })}</li>
            </ol>
          </div>
        ) : state === "authenticated" ? (
          <div className="grid place-items-center py-14 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <p className="mt-3 text-sm text-muted">{tr({ en: "Linking… almost there.", ar: "جارٍ الربط… اقتربنا." })}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-rose-500/10 text-rose-500">
              <svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></svg>
            </div>
            <h3 className="mt-4 font-bold text-ink">{tr({ en: "WhatsApp worker isn't running", ar: "خدمة واتساب غير مُشغّلة" })}</h3>
            <p className="mt-1 max-w-md text-sm text-muted">
              {tr({
                en: "Start it on the server with: npm run whatsapp:worker — the QR to link will appear here.",
                ar: "شغّلها على الخادم بالأمر: npm run whatsapp:worker — وسيظهر هنا رمز الربط.",
              })}
            </p>
          </div>
        )}
      </div>

      {branches.length >= 2 && (
        <div className="rounded-2xl border border-primary/15 bg-surface p-5">
          <h3 className="text-sm font-bold text-ink">
            {tr({ en: "Bookings from the bot go to", ar: "حجوزات البوت تذهب إلى" })}
          </h3>
          <p className="mt-1 text-xs text-muted">
            {tr({
              en: "The bot uses one linked number, so choose which branch its new appointments are saved to.",
              ar: "يستخدم البوت رقمًا واحدًا مرتبطًا، لذا اختر الفرع الذي تُحفظ فيه مواعيده الجديدة.",
            })}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-primary/15 bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary disabled:opacity-60"
              value={bookingBranchId}
              disabled={!canWrite || savingBranch}
              onChange={(e) => saveBookingBranch(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {(lang === "ar" ? b.nameAr || b.nameEn : b.nameEn || b.nameAr) +
                    (b.whatsappNumber ? ` — ${b.whatsappNumber}` : "")}
                </option>
              ))}
            </select>
            {branchNotice && <span className="text-xs text-muted">{branchNotice}</span>}
          </div>
          {!canWrite && (
            <p className="mt-2 text-xs text-muted">
              {tr({ en: "Only owners can change this.", ar: "يمكن للمالكين فقط تغيير هذا." })}
            </p>
          )}
        </div>
      )}

      <p className="text-center text-xs text-muted">
        {tr({
          en: "Free • uses the clinic's own number • no Meta account needed.",
          ar: "مجاني • يستخدم رقم العيادة • بدون حساب Meta.",
        })}
      </p>
    </div>
  );
}
