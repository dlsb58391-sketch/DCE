"use client";

import { useMemo, useState } from "react";
import { useLang } from "@/lib/language";
import { t } from "@/lib/content";
import { useSite } from "@/lib/siteStore";
import { confirmOnWhatsAppLink, mapUrl, site } from "@/lib/site";
import { Reveal } from "./Reveal";
import {
  sessionTypes,
  sessionTypeById,
  availableSlots,
  isClosed,
  fmtWeekday,
  fmtDayNum,
  fmtDateLong,
  fmtTime,
  hhmmToMin,
  type Bilingual,
} from "@/lib/dashboard";

const DAYS = 14;

type Snapshot = { serviceLabel: Bilingual; dayOffset: number; slot: string; trackCode?: string | null };

export function BookingSection() {
  const { tr, lang } = useLang();
  const { selectedOffer, selectOffer, addLead, addAppointment, appointments } = useSite();
  const base = useMemo(() => new Date(), []);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [dayOffset, setDayOffset] = useState<number | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [done, setDone] = useState<Snapshot | null>(null);

  const service = serviceId ? sessionTypeById(serviceId) : null;

  const slotsFor = (off: number) =>
    service ? availableSlots(appointments, base, off, service.durationMin) : [];
  const daySlots = dayOffset != null ? slotsFor(dayOffset) : [];

  const pickService = (id: string) => {
    setServiceId(id);
    setDayOffset(null);
    setSlot(null);
    setStep(2);
  };
  const pickDay = (off: number) => {
    setDayOffset(off);
    setSlot(null);
  };
  const pickSlot = (s: string) => {
    setSlot(s);
    setStep(3);
  };

  const reset = () => {
    setStep(1);
    setServiceId(null);
    setDayOffset(null);
    setSlot(null);
    setName("");
    setPhone("");
    setEmail("");
    setNotes("");
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service || dayOffset == null || !slot || !name.trim() || !phone.trim()) return;
    const apptId = `bk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    addAppointment({
      id: apptId,
      patient: { en: name.trim(), ar: name.trim() },
      typeId: service.id,
      dayOffset,
      start: slot,
      status: "pending",
      phone: phone.trim(),
    });
    const message = [notes.trim(), email.trim() ? `Email: ${email.trim()}` : ""]
      .filter(Boolean)
      .join(" — ");

    // Persist to the backend (source of truth for the WhatsApp + live-queue flow).
    const when = new Date(base);
    when.setDate(when.getDate() + dayOffset);
    const [hh, mm] = slot.split(":").map(Number);
    when.setHours(hh, mm, 0, 0);
    let trackCode: string | null = null;
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          serviceId: service.id,
          serviceLabelEn: service.label.en,
          serviceLabelAr: service.label.ar,
          scheduledAt: when.toISOString(),
          durationMin: service.durationMin,
          complaint: notes.trim() || null,
          offerTitle: selectedOffer ? selectedOffer.title.en : null,
          lang,
        }),
      });
      if (res.ok) trackCode = (await res.json()).code ?? null;
    } catch {
      /* offline: booking still recorded locally for the dashboard */
    }

    addLead({
      name: name.trim(),
      phone: phone.trim(),
      message,
      offerId: selectedOffer?.id ?? null,
      offerTitle: selectedOffer?.title ?? null,
      serviceId: service.id,
      serviceLabel: service.label,
      dayOffset,
      start: slot,
      appointmentId: apptId,
      trackCode,
    });
    setDone({ serviceLabel: service.label, dayOffset, slot, trackCode });
    selectOffer(null);
    reset();
  };

  const steps = [
    { n: 1, label: { en: "Service", ar: "الخدمة" } },
    { n: 2, label: { en: "Date & Time", ar: "التاريخ والوقت" } },
    { n: 3, label: { en: "Your Details", ar: "بياناتك" } },
  ] as const;

  return (
    <section id="contact" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto mb-12 max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            {tr(t.contact.eyebrow)}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr({ en: "Book Your Appointment", ar: "احجز موعدك" })}
          </h2>
          <p className="mt-4 text-lg text-muted">
            {tr({
              en: "Pick a treatment, choose a free time slot, and we'll confirm your visit.",
              ar: "اختر العلاج، وحدد موعدًا متاحًا، وسنؤكد زيارتك.",
            })}
          </p>
        </Reveal>

        <Reveal className="overflow-hidden rounded-[2rem] border border-primary/15 bg-surface shadow-2xl shadow-primary/10">
          <div className="grid lg:grid-cols-[330px_1fr]">
            {/* ---------- left rail ---------- */}
            <div className="relative overflow-hidden bg-gradient-to-br from-accent to-primary-dark p-7 lg:p-9">
              <div className="pointer-events-none absolute -bottom-16 -end-16 h-64 w-64 rounded-full bg-[color:var(--on-primary)]/10 blur-2xl" />
              <h3 className="text-xl font-extrabold text-[color:var(--on-primary)]">
                {tr({ en: "Quick Booking", ar: "حجز سريع" })}
              </h3>
              <p className="mt-1 text-sm text-[color:var(--on-primary)]/70">
                {tr({ en: "Three simple steps", ar: "ثلاث خطوات بسيطة" })}
              </p>

              {/* stepper */}
              <ol className="mt-7 space-y-1">
                {steps.map((s, i) => {
                  const active = step === s.n;
                  const complete = step > s.n;
                  return (
                    <li key={s.n} className="flex items-center gap-3">
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 text-sm font-bold transition ${
                          active
                            ? "border-[color:var(--on-primary)] bg-[color:var(--on-primary)] text-primary"
                            : complete
                            ? "border-[color:var(--on-primary)] bg-[color:var(--on-primary)]/80 text-primary"
                            : "border-[color:var(--on-primary)]/40 text-[color:var(--on-primary)]/60"
                        }`}
                      >
                        {complete ? (
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        ) : (
                          s.n
                        )}
                      </span>
                      <span className={`text-sm font-bold ${active || complete ? "text-[color:var(--on-primary)]" : "text-[color:var(--on-primary)]/55"}`}>
                        {tr(s.label)}
                      </span>
                    </li>
                  );
                })}
              </ol>

              {/* contact info */}
              <div className="mt-9 space-y-3 border-t border-[color:var(--on-primary)]/15 pt-6 text-sm text-[color:var(--on-primary)]/80">
                <a
                  href={mapUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 transition hover:text-[color:var(--on-primary)]"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.7-7-11a7 7 0 0 1 14 0c0 5.3-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></svg>
                  {tr(t.contact.address)}
                </a>
                <a href={`tel:${site.phone}`} dir="ltr" className="flex items-center gap-2 transition hover:text-[color:var(--on-primary)]">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h3l1.5 5-2 1.5a12 12 0 0 0 5 5l1.5-2 5 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></svg>
                  {tr(t.contact.phoneValue)}
                </a>
                <p className="inline-flex items-center gap-2">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                  {tr(t.contact.hours)}
                </p>
              </div>
            </div>

            {/* ---------- right content ---------- */}
            <div className="p-6 lg:p-9">
              {done ? (
                <SuccessView base={base} snap={done} onAgain={() => setDone(null)} />
              ) : (
                <>
                  {selectedOffer && (
                    <div
                      className="mb-5 flex items-center gap-3 rounded-xl border p-3"
                      style={{ borderColor: `${selectedOffer.color}55`, background: `${selectedOffer.color}14` }}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white" style={{ backgroundColor: selectedOffer.color }}>
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v8H4v-8M2 7h20v5H2zM12 7v13M12 7S10.5 3 8 3a2 2 0 0 0 0 4M12 7s1.5-4 4-4a2 2 0 0 1 0 4" /></svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{tr({ en: "Applying offer", ar: "العرض المطبق" })}</p>
                        <p className="truncate text-sm font-bold text-ink">{tr(selectedOffer.title)}</p>
                      </div>
                      <button type="button" onClick={() => selectOffer(null)} aria-label="Remove offer" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-primary/10 hover:text-ink">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                      </button>
                    </div>
                  )}

                  {/* STEP 1 — service */}
                  {step === 1 && (
                    <div>
                      <h4 className="text-lg font-bold text-ink">{tr({ en: "Choose a treatment", ar: "اختر العلاج" })}</h4>
                      <p className="mt-1 text-sm text-muted">{tr({ en: "Select the service you'd like to book.", ar: "اختر الخدمة التي تريد حجزها." })}</p>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {sessionTypes.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => pickService(s.id)}
                            className={`group flex items-center gap-3 rounded-xl border p-3 text-start transition hover:-translate-y-0.5 ${
                              serviceId === s.id ? "border-primary bg-primary/10" : "border-primary/15 hover:border-primary/40"
                            }`}
                          >
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-sm" style={{ backgroundColor: s.color }}>
                              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon} /></svg>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-bold text-ink">{tr(s.label)}</span>
                              <span className="block text-xs text-muted">
                                {s.durationMin} {tr({ en: "min", ar: "دقيقة" })}
                              </span>
                            </span>
                            <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-primary ${lang === "ar" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* STEP 2 — date & time */}
                  {step === 2 && service && (
                    <div>
                      <button onClick={() => setStep(1)} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted transition hover:text-primary">
                        <svg viewBox="0 0 24 24" className={`h-4 w-4 ${lang === "ar" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
                        {tr({ en: "Back", ar: "رجوع" })}
                      </button>

                      <div className="flex items-center gap-2.5 rounded-xl border border-primary/15 bg-surface-2 p-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white" style={{ backgroundColor: service.color }}>
                          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={service.icon} /></svg>
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-ink">{tr(service.label)}</p>
                          <p className="text-xs text-muted">{service.durationMin} {tr({ en: "min", ar: "دقيقة" })}</p>
                        </div>
                      </div>

                      <h4 className="mt-5 text-sm font-bold text-ink">{tr({ en: "Pick a day", ar: "اختر اليوم" })}</h4>
                      <div className="custom-scroll mt-2 flex gap-2 overflow-x-auto pb-1">
                        {Array.from({ length: DAYS }, (_, off) => {
                          const closed = isClosed(base, off);
                          const count = closed ? 0 : slotsFor(off).length;
                          const disabled = closed || count === 0;
                          const active = dayOffset === off;
                          return (
                            <button
                              key={off}
                              disabled={disabled}
                              onClick={() => pickDay(off)}
                              className={`flex min-w-[4.6rem] shrink-0 flex-col items-center gap-0.5 rounded-2xl border px-3 py-2.5 transition ${
                                active
                                  ? "border-primary bg-primary/15 text-primary"
                                  : disabled
                                  ? "cursor-not-allowed border-primary/10 text-muted/40"
                                  : "border-primary/15 text-muted hover:border-primary/40 hover:text-ink"
                              }`}
                            >
                              <span className="text-[11px] font-semibold uppercase">
                                {off === 0 ? tr({ en: "Today", ar: "اليوم" }) : fmtWeekday(base, off, lang)}
                              </span>
                              <span className="text-lg font-extrabold">{fmtDayNum(base, off, lang)}</span>
                              <span className="text-[10px] font-semibold">
                                {closed ? tr({ en: "Closed", ar: "مغلق" }) : count === 0 ? tr({ en: "Full", ar: "ممتلئ" }) : `${count} ${tr({ en: "slots", ar: "موعد" })}`}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {dayOffset != null && (
                        <>
                          <h4 className="mt-5 text-sm font-bold text-ink">
                            {tr({ en: "Available times", ar: "المواعيد المتاحة" })}
                            <span className="ms-1 font-normal capitalize text-muted">— {fmtDateLong(base, dayOffset, lang)}</span>
                          </h4>
                          {daySlots.length === 0 ? (
                            <p className="mt-3 rounded-xl border border-dashed border-primary/20 py-6 text-center text-sm text-muted">
                              {tr({ en: "No free times this day. Try another.", ar: "لا مواعيد متاحة هذا اليوم. جرّب يومًا آخر." })}
                            </p>
                          ) : (
                            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                              {daySlots.map((s) => (
                                <button
                                  key={s}
                                  onClick={() => pickSlot(s)}
                                  className={`rounded-xl border py-2.5 text-sm font-semibold transition ${
                                    slot === s ? "border-primary bg-primary/15 text-primary" : "border-primary/15 text-ink hover:border-primary/40 hover:bg-primary/5"
                                  }`}
                                >
                                  {fmtTime(base, dayOffset, hhmmToMin(s), lang)}
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* STEP 3 — details */}
                  {step === 3 && service && dayOffset != null && slot && (
                    <form onSubmit={confirm}>
                      <button type="button" onClick={() => setStep(2)} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-muted transition hover:text-primary">
                        <svg viewBox="0 0 24 24" className={`h-4 w-4 ${lang === "ar" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
                        {tr({ en: "Back", ar: "رجوع" })}
                      </button>

                      {/* summary */}
                      <div className="rounded-xl border border-primary/15 bg-surface-2 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{tr({ en: "Booking summary", ar: "ملخص الحجز" })}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
                          <span className="inline-flex items-center gap-1.5 font-bold text-ink">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: service.color }} />
                            {tr(service.label)}
                          </span>
                          <span className="capitalize text-ink/90">{fmtDateLong(base, dayOffset, lang)}</span>
                          <span className="font-semibold text-ink/90">{fmtTime(base, dayOffset, hhmmToMin(slot), lang)}</span>
                        </div>
                      </div>

                      <div className="mt-5 space-y-4">
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-ink">{tr(t.contact.nameLabel)}</label>
                          <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-xl border border-primary/15 bg-surface-2 px-4 py-3 text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-sm font-semibold text-ink">{tr(t.contact.phoneLabel)}</label>
                            <input required type="tel" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-xl border border-primary/15 bg-surface-2 px-4 py-3 text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-sm font-semibold text-ink">{tr({ en: "Email (optional)", ar: "البريد (اختياري)" })}</label>
                            <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-primary/15 bg-surface-2 px-4 py-3 text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-semibold text-ink">{tr({ en: "Notes / symptoms (optional)", ar: "ملاحظات / الأعراض (اختياري)" })}</label>
                          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full resize-none rounded-xl border border-primary/15 bg-surface-2 px-4 py-3 text-ink outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
                        </div>
                        <button type="submit" className="w-full rounded-full bg-gradient-to-r from-primary to-primary-dark px-7 py-3.5 font-semibold text-[color:var(--on-primary)] shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 hover:shadow-xl">
                          {tr({ en: "Confirm Booking", ar: "تأكيد الحجز" })}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function SuccessView({ base, snap, onAgain }: { base: Date; snap: Snapshot; onAgain: () => void }) {
  const { tr, lang } = useLang();
  return (
    <div className="flex h-full min-h-[22rem] flex-col items-center justify-center text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/15 text-primary">
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      </div>
      <h4 className="mt-4 text-xl font-extrabold text-ink">{tr({ en: "Booking requested!", ar: "تم إرسال طلب الحجز!" })}</h4>
      <p className="mt-1 max-w-sm text-muted">
        {tr({ en: "We've reserved your slot. The clinic will confirm your appointment shortly.", ar: "لقد حجزنا موعدك. ستؤكد العيادة الحجز قريبًا." })}
      </p>
      <div className="mt-5 rounded-xl border border-primary/15 bg-surface-2 px-5 py-4 text-sm">
        <div className="flex items-center gap-2 font-bold text-ink">
          {tr(snap.serviceLabel)}
        </div>
        <div className="mt-1 capitalize text-muted">
          {fmtDateLong(base, snap.dayOffset, lang)} · {fmtTime(base, snap.dayOffset, hhmmToMin(snap.slot), lang)}
        </div>
      </div>

      <a
        href={confirmOnWhatsAppLink({
          code: snap.trackCode,
          lang,
          service: tr(snap.serviceLabel),
          when: `${fmtDateLong(base, snap.dayOffset, lang)} · ${fmtTime(base, snap.dayOffset, hhmmToMin(snap.slot), lang)}`,
        })}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-[#25D366]/25 transition hover:-translate-y-0.5"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.7-.1l.9-1c.2-.3.4-.2.7-.1l2 .9c.3.2.5.2.6.4.1.1.1.7-.1 1.2Z" /></svg>
        {tr({ en: "Confirm on WhatsApp", ar: "أكّد عبر واتساب" })}
      </a>
      <p className="mt-2 max-w-xs text-xs text-muted">
        {tr({
          en: "Tap to message us — we'll confirm your appointment right away.",
          ar: "اضغط لمراسلتنا — وسنؤكد موعدك فورًا.",
        })}
      </p>

      {snap.trackCode && (
        <>
          <a
            href={`/track/${snap.trackCode}`}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-dark px-6 py-3 text-sm font-semibold text-[color:var(--on-primary)] shadow-lg shadow-primary/25 transition hover:-translate-y-0.5"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            {tr({ en: "Track your appointment live", ar: "تابع موعدك مباشرة" })}
          </a>
          <p className="mt-2 text-xs text-muted">
            {tr({ en: "Your tracking code", ar: "كود المتابعة" })}:{" "}
            <span className="font-mono font-bold tracking-widest text-ink">{snap.trackCode}</span>
          </p>
        </>
      )}

      <button onClick={onAgain} className="mt-6 rounded-full border border-primary/30 px-6 py-2.5 text-sm font-semibold text-ink transition hover:border-primary hover:text-primary">
        {tr({ en: "Book another appointment", ar: "حجز موعد آخر" })}
      </button>
    </div>
  );
}
