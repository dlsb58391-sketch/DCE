"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/language";
import { LanguageToggle } from "@/components/LanguageToggle";
import { activeClinic } from "@/lib/clinics";

type Stage =
  | "pending"
  | "reserved"
  | "reminder"
  | "queue"
  | "turn"
  | "completed"
  | "declined"
  | "cancelled";

type TrackData = {
  code: string;
  patientName: string;
  serviceLabel: { en: string; ar: string };
  scheduledAt: string;
  status: string;
  stage: Stage;
  minutesUntil: number;
  ahead: number;
  reminderLeadMin: number;
  queueLeadMin: number;
  now: string;
};

const clinicCfg = activeClinic();
const CLINIC = clinicCfg.doctorName;
const CLINIC_WA = clinicCfg.contact.whatsapp;
const CLINIC_LOGO = clinicCfg.logo || "/bdic-logo.jpg";

export function Tracker({ code }: { code: string }) {
  const { tr, lang } = useLang();
  const [data, setData] = useState<TrackData | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "notfound">("loading");
  const [nowTs, setNowTs] = useState(() => Date.now());
  const previewRef = useRef<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const preview =
        previewRef.current ??
        (previewRef.current = new URLSearchParams(window.location.search).get("preview"));
      const url = `/api/track/${encodeURIComponent(code)}${preview ? `?preview=${preview}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 404) {
        setState("notfound");
        return;
      }
      const json = (await res.json()) as TrackData;
      setData(json);
      setState("ok");
    } catch {
      /* keep last good data */
    }
  }, [code]);

  // poll every 5s
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [fetchData]);

  // 1s ticker for the live countdown
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const fmtNum = (n: number) =>
    new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US").format(n);

  const fmtWhen = (iso: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Cairo",
    }).format(new Date(iso));

  const countdown = (iso: string) => {
    const secs = Math.max(0, Math.floor((new Date(iso).getTime() - nowTs) / 1000));
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${fmtNum(h)}${tr({ en: "h", ar: "س" })} ${fmtNum(m)}${tr({ en: "m", ar: "د" })}`;
    if (m > 0) return `${fmtNum(m)}${tr({ en: "m", ar: "د" })} ${fmtNum(s)}${tr({ en: "s", ar: "ث" })}`;
    return `${fmtNum(s)}${tr({ en: "s", ar: "ث" })}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* top bar */}
      <header className="flex items-center justify-between border-b border-primary/10 bg-surface/70 px-5 py-3 backdrop-blur">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-white p-0.5 shadow">
            <Image src={CLINIC_LOGO} alt={tr(CLINIC)} width={36} height={36} className="h-full w-full object-contain" />
          </span>
          <span className="text-sm font-bold tracking-tight text-ink">{tr(CLINIC)}</span>
        </Link>
        <LanguageToggle />
      </header>

      <main className="mx-auto w-full max-w-lg px-5 py-10">
        {state === "loading" && (
          <div className="grid place-items-center py-24 text-muted">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <p className="mt-4 text-sm">{tr({ en: "Loading your appointment…", ar: "جارٍ تحميل موعدك…" })}</p>
          </div>
        )}

        {state === "notfound" && (
          <div className="rounded-3xl border border-primary/15 bg-surface p-8 text-center shadow-xl shadow-primary/5">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rose-100 text-rose-600">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </div>
            <h1 className="mt-4 text-xl font-bold text-ink">{tr({ en: "Booking not found", ar: "الحجز غير موجود" })}</h1>
            <p className="mt-2 text-sm text-muted">
              {tr({ en: "Check the link in your WhatsApp message, or contact the clinic.", ar: "تأكد من الرابط في رسالة الواتساب، أو تواصل مع العيادة." })}
            </p>
            <a href={`https://wa.me/${CLINIC_WA}`} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-dark px-4 py-2.5 text-sm font-semibold text-[color:var(--on-primary)]">
              {tr({ en: "Contact clinic", ar: "تواصل مع العيادة" })}
            </a>
          </div>
        )}

        {state === "ok" && data && (
          <StageCard
            data={data}
            tr={tr}
            lang={lang}
            fmtNum={fmtNum}
            fmtWhen={fmtWhen}
            countdown={countdown}
          />
        )}
      </main>
    </div>
  );
}

function StageCard({
  data,
  tr,
  lang,
  fmtNum,
  fmtWhen,
  countdown,
}: {
  data: TrackData;
  tr: (b: { en: string; ar: string }) => string;
  lang: string;
  fmtNum: (n: number) => string;
  fmtWhen: (iso: string) => string;
  countdown: (iso: string) => string;
}) {
  const service = lang === "ar" ? data.serviceLabel.ar : data.serviceLabel.en;
  const when = fmtWhen(data.scheduledAt);
  const stage = data.stage;

  const StepBadge = (
    <div className="mb-6 flex items-center justify-center gap-2">
      {(["reserved", "reminder", "queue", "turn"] as Stage[]).map((s, i) => {
        const order = ["reserved", "reminder", "queue", "turn"];
        const active = order.indexOf(stage) >= i || stage === "completed";
        return (
          <span
            key={s}
            className={`h-1.5 rounded-full transition-all ${
              active ? "w-8 bg-primary" : "w-4 bg-primary/20"
            }`}
          />
        );
      })}
    </div>
  );

  // shared info row
  const InfoRow = (
    <div className="mt-6 space-y-2 rounded-2xl border border-primary/12 bg-background/60 p-4 text-sm">
      <div className="flex items-center gap-2 text-ink">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4.5c-2-1.4-5-1.6-6.3.3-1.2 1.8-.6 4.3 0 6.6.5 1.9.3 3 .8 5.2.3 1.4.7 2.9 1.6 2.9 1.1 0 1.1-2 1.6-3.6.3-1 .8-1.7 1.3-1.7s1 .7 1.3 1.7c.5 1.6.5 3.6 1.6 3.6.9 0 1.3-1.5 1.6-2.9.5-2.2.3-3.3.8-5.2.6-2.3 1.2-4.8 0-6.6C17 2.9 14 3.1 12 4.5Z" /></svg>
        <span className="font-semibold">{service}</span>
      </div>
      <div className="flex items-center gap-2 text-muted">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4.5" width="18" height="17" rx="2" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>
        <span className="capitalize">{when}</span>
      </div>
      <div className="flex items-center gap-2 text-muted">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-primary" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 7h6M9 11h6M9 15h4M5 4h14v17l-3-2-2 2-2-2-2 2-2-2-2 2V4Z" /></svg>
        <span>{tr({ en: "Code", ar: "كود" })}: <span className="font-mono font-bold tracking-widest text-ink">{data.code}</span></span>
      </div>
    </div>
  );

  let body: React.ReactNode = null;

  if (stage === "pending") {
    body = (
      <Hero
        ring="bg-amber-100 text-amber-600"
        icon={<svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>}
        title={tr({ en: "Booking received", ar: "تم استلام الحجز" })}
        subtitle={tr({ en: "We'll confirm shortly. You'll get a WhatsApp message the moment the doctor confirms your appointment.", ar: "سنؤكد قريبًا. ستصلك رسالة واتساب فور تأكيد الطبيب لموعدك." })}
      />
    );
  } else if (stage === "reserved") {
    body = (
      <>
        <Hero
          ring="bg-emerald-100 text-emerald-600"
          icon={<svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
          title={tr({ en: "Your booking is reserved 🎉", ar: "تم تأكيد حجزك 🎉" })}
          subtitle={tr({ en: "We've sent a confirmation to your WhatsApp. We'll remind you 2 hours before your turn.", ar: "أرسلنا تأكيدًا إلى واتساب الخاص بك. سنذكّرك قبل دورك بساعتين." })}
        />
        <WhatsAppBubble
          tr={tr}
          text={tr({
            en: `Hi ${data.patientName}, your appointment is reserved ✅`,
            ar: `أهلاً ${data.patientName}، تم حجز موعدك ✅`,
          })}
        />
      </>
    );
  } else if (stage === "reminder") {
    body = (
      <Hero
        ring="bg-primary/15 text-primary"
        icon={<svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>}
        title={tr({ en: "Your appointment is coming up", ar: "اقترب موعدك" })}
        subtitle={tr({ en: "Get ready! The live queue opens 1 hour before your slot.", ar: "استعد! يبدأ عداد الانتظار المباشر قبل موعدك بساعة." })}
        big={countdown(data.scheduledAt)}
        bigLabel={tr({ en: "until your appointment", ar: "حتى موعدك" })}
      />
    );
  } else if (stage === "queue") {
    body = <QueueView data={data} tr={tr} fmtNum={fmtNum} countdown={countdown} />;
  } else if (stage === "turn") {
    body = (
      <div className="text-center">
        <div className="relative mx-auto grid h-28 w-28 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40" />
          <span className="absolute inset-0 rounded-full bg-emerald-500/20" />
          <span className="relative grid h-20 w-20 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40">
            <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </span>
        </div>
        <h1 className="mt-6 text-2xl font-extrabold text-ink">{tr({ en: "It's your turn! 🟢", ar: "حان دورك! 🟢" })}</h1>
        <p className="mt-2 text-muted">
          {tr({ en: "The doctor is ready to see you now. Please head to reception.", ar: "الطبيب جاهز لاستقبالك الآن. برجاء التوجه إلى الاستقبال." })}
        </p>
      </div>
    );
  } else if (stage === "completed") {
    body = (
      <Hero
        ring="bg-emerald-100 text-emerald-600"
        icon={<svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
        title={tr({ en: "Visit complete — thank you! 🦷", ar: "انتهت الزيارة — شكرًا لك! 🦷" })}
        subtitle={tr({ en: "We hope to see your bright smile again soon.", ar: "نتمنى رؤية ابتسامتك المشرقة قريبًا." })}
      />
    );
  } else {
    body = (
      <Hero
        ring="bg-rose-100 text-rose-600"
        icon={<svg viewBox="0 0 24 24" className="h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>}
        title={tr({ en: "Booking not confirmed", ar: "لم يتم تأكيد الحجز" })}
        subtitle={tr({ en: "Please contact the clinic to reschedule.", ar: "برجاء التواصل مع العيادة لإعادة الجدولة." })}
      />
    );
  }

  const showStepBadge = ["reserved", "reminder", "queue", "turn"].includes(stage);
  const showInfo = stage !== "declined" && stage !== "cancelled";

  return (
    <div className="rounded-3xl border border-primary/15 bg-surface p-7 shadow-2xl shadow-primary/10 sm:p-8">
      {showStepBadge && StepBadge}
      {body}
      {showInfo && InfoRow}

      <a
        href={`https://wa.me/${CLINIC_WA}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.6-.6-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8s.7-2 .9-2.2c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5l-.4.5-.3.3c-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.7-.1l.9-1c.2-.3.4-.2.7-.1l2 .9c.3.2.5.2.6.4.1.1.1.7-.1 1.2Z" /></svg>
        {tr({ en: "Message the clinic on WhatsApp", ar: "راسل العيادة على واتساب" })}
      </a>
    </div>
  );
}

function Hero({
  ring,
  icon,
  title,
  subtitle,
  big,
  bigLabel,
}: {
  ring: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  big?: string;
  bigLabel?: string;
}) {
  return (
    <div className="text-center">
      <div className={`mx-auto grid h-20 w-20 place-items-center rounded-full ${ring}`}>{icon}</div>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
      <p className="mx-auto mt-2 max-w-sm text-muted">{subtitle}</p>
      {big && (
        <div className="mt-5">
          <div className="text-4xl font-extrabold tabular-nums text-primary">{big}</div>
          {bigLabel && <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">{bigLabel}</div>}
        </div>
      )}
    </div>
  );
}

function QueueView({
  data,
  tr,
  fmtNum,
  countdown,
}: {
  data: TrackData;
  tr: (b: { en: string; ar: string }) => string;
  fmtNum: (n: number) => string;
  countdown: (iso: string) => string;
}) {
  const ahead = data.ahead;
  const estMin = ahead * 20;

  return (
    <div className="text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-rose-600">
        <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
        {tr({ en: "Live queue", ar: "الطابور المباشر" })}
      </span>

      <div className="relative mx-auto mt-6 grid h-44 w-44 place-items-center">
        <span className="absolute inset-0 rounded-full border-8 border-primary/10" />
        <span className="absolute inset-0 animate-[spin_8s_linear_infinite] rounded-full border-8 border-transparent border-t-primary" />
        <div className="text-center">
          <div className="text-6xl font-extrabold tabular-nums text-ink">{fmtNum(ahead)}</div>
          <div className="mt-1 px-4 text-xs font-semibold uppercase tracking-wide text-muted">
            {ahead === 0
              ? tr({ en: "You're next!", ar: "أنت التالي!" })
              : tr({ en: ahead === 1 ? "patient ahead" : "patients ahead", ar: "قبلك في الدور" })}
          </div>
        </div>
      </div>

      <p className="mt-6 text-muted">
        {ahead === 0
          ? tr({ en: "Please get ready — the doctor will call you any moment now.", ar: "استعد — سيناديك الطبيب في أي لحظة الآن." })
          : tr({ en: "We'll send you a WhatsApp message the moment it's your turn.", ar: "سنرسل لك رسالة واتساب فور أن يحين دورك." })}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-primary/12 bg-background/60 p-3">
          <div className="text-lg font-extrabold text-ink">~{fmtNum(estMin)} {tr({ en: "min", ar: "د" })}</div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{tr({ en: "Est. wait", ar: "الانتظار المتوقع" })}</div>
        </div>
        <div className="rounded-2xl border border-primary/12 bg-background/60 p-3">
          <div className="text-lg font-extrabold text-ink">{countdown(data.scheduledAt)}</div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{tr({ en: "Your slot", ar: "موعدك" })}</div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppBubble({
  tr,
  text,
}: {
  tr: (b: { en: string; ar: string }) => string;
  text: string;
}) {
  return (
    <div className="mt-6 rounded-2xl p-3" style={{ background: "#e8f8ef" }}>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Z" /></svg>
        WhatsApp
      </div>
      <p className="text-sm text-ink/90">{text}</p>
      <p className="mt-1 text-end text-[10px] text-muted">{tr({ en: "delivered", ar: "تم التسليم" })} ✓✓</p>
    </div>
  );
}
