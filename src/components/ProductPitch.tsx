"use client";

import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/language";
import { site } from "@/lib/site";
import { LanguageToggle } from "./LanguageToggle";
import { Reveal } from "./Reveal";

/** Prefilled inbound WhatsApp link — the clinic messages first (opt-in). */
function waLink(message: string): string {
  return `https://wa.me/${SALES_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

/** Sales/demo WhatsApp number (digits only). Defaults to the clinic line; set
 *  NEXT_PUBLIC_SALES_WHATSAPP to route product enquiries to a separate number. */
const SALES_WHATSAPP = process.env.NEXT_PUBLIC_SALES_WHATSAPP || site.whatsapp;

/** Product name — change this one constant to rebrand the pitch. */
const PRODUCT = "Clinva";

/** The Clinva logo mark: a chat bubble (soft "C") holding a medical plus. */
function ClinvaMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Clinva">
      <defs>
        <linearGradient id="clinvaGoldMark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9a24b" />
          <stop offset="1" stopColor="#a87f2b" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#clinvaGoldMark)" />
      <path d="M32 15.5c-9.7 0-17.6 6.9-17.6 15.4 0 4.8 2.5 9 6.4 11.9v6.4c0 1.2 1.3 1.9 2.3 1.2l6.2-4.1c.9.1 1.8.2 2.7.2 9.7 0 17.6-6.9 17.6-15.6S41.7 15.5 32 15.5z" fill="#fff" />
      <path d="M29.4 23.6h5.2v14.8h-5.2z" fill="url(#clinvaGoldMark)" />
      <path d="M24.6 28.4h14.8v5.2H24.6z" fill="url(#clinvaGoldMark)" />
    </svg>
  );
}

/** The wordmark: "Clin" in ink + "va" in the brand gold. */
function ClinvaWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      Clin<span className="text-primary">va</span>
    </span>
  );
}

export function ProductPitch() {
  const { tr } = useLang();

  const demoMsg = tr({
    en: `Hi! I run a dental clinic and I'd like a live demo of ${PRODUCT}. My clinic: `,
    ar: `مرحبًا! عندي عيادة أسنان وأريد عرضًا مباشرًا لنظام ${PRODUCT}. اسم العيادة: `,
  });

  const features = [
    {
      icon: "M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Z",
      title: { en: "WhatsApp booking bot", ar: "بوت حجز على واتساب" },
      desc: {
        en: "Patients book by chatting on WhatsApp — the bot offers open slots, confirms, and sends reminders automatically. No app to install.",
        ar: "المرضى يحجزون بالدردشة على واتساب — البوت يعرض المواعيد المتاحة ويؤكد ويرسل تذكيرات تلقائيًا. بدون تطبيق.",
      },
    },
    {
      icon: "M3 9h18M7 3v4m10-4v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
      title: { en: "Smart daily schedule", ar: "جدول يومي ذكي" },
      desc: {
        en: "Every booking — website and WhatsApp — lands in one calendar. Confirm or decline in a tap and see free slots at a glance.",
        ar: "كل الحجوزات — من الموقع وواتساب — في تقويم واحد. أكِّد أو ارفض بضغطة، وشاهد المواعيد المتاحة بلمحة.",
      },
    },
    {
      icon: "M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M12 11v6M9 14h6",
      title: { en: "Operations & payments", ar: "العمليات والمدفوعات" },
      desc: {
        en: "A price list of your procedures, per-visit treatment records with discounts, and partial-payment tracking so you always see the balance owed.",
        ar: "قائمة أسعار لإجراءاتك، وتسجيل العلاج لكل زيارة مع خصومات، وتتبّع الدفع الجزئي لتعرف المتبقي دائمًا.",
      },
    },
    {
      icon: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z",
      title: { en: "Automatic follow-ups", ar: "متابعات تلقائية" },
      desc: {
        en: "A day or two after each visit, patients get a caring “how are you feeling?” message. Their replies pop up as alerts so nobody is forgotten.",
        ar: "بعد كل زيارة بيوم أو اثنين، يصل للمريض رسالة «عامل إيه بعد الجلسة؟». وردودهم تظهر كتنبيهات حتى لا يُنسى أحد.",
      },
    },
    {
      icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z",
      title: { en: "Unified messages inbox", ar: "صندوق رسائل موحّد" },
      desc: {
        en: "Chat with every patient over WhatsApp from inside the dashboard. Unread replies are counted and highlighted.",
        ar: "راسل كل مريض عبر واتساب من داخل اللوحة. الردود غير المقروءة تُعدّ وتُميَّز.",
      },
    },
    {
      icon: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
      title: { en: "Excel export & records", ar: "تصدير إكسل وسجلات" },
      desc: {
        en: "Own your data. One click exports classified spreadsheets — patient profiles & interactions in one file, the schedule in another.",
        ar: "بياناتك ملكك. بضغطة واحدة تُصدِّر ملفات إكسل مصنّفة — ملفات المرضى وتفاعلاتهم في ملف، والجدول في ملف آخر.",
      },
    },
  ];

  const shots = [
    {
      src: "/product/dash-overview.png",
      title: { en: "One clear overview", ar: "نظرة شاملة واضحة" },
      desc: {
        en: "Today’s sessions, new requests, free slots and your next patient — the moment you sign in.",
        ar: "جلسات اليوم والطلبات الجديدة والمواعيد المتاحة ومريضك القادم — بمجرد الدخول.",
      },
    },
    {
      src: "/product/dash-operations.png",
      title: { en: "Procedures & prices", ar: "الإجراءات والأسعار" },
      desc: {
        en: "Keep your operations list and prices tidy — reused every time you record a patient’s treatment.",
        ar: "حافظ على قائمة عملياتك وأسعارها منظمة — تُستخدم في كل مرة تسجّل فيها علاج مريض.",
      },
    },
    {
      src: "/product/dash-messages.png",
      title: { en: "Talk to patients", ar: "تواصل مع المرضى" },
      desc: {
        en: "Every WhatsApp conversation in one inbox, with follow-up replies highlighted.",
        ar: "كل محادثات واتساب في صندوق واحد، مع تمييز ردود المتابعة.",
      },
    },
    {
      src: "/product/dash-settings.png",
      title: { en: "You’re in control", ar: "التحكم بين يديك" },
      desc: {
        en: "Set when follow-ups go out and export your whole database whenever you want.",
        ar: "حدّد وقت إرسال المتابعات، وصدّر قاعدة بياناتك كاملة وقتما تشاء.",
      },
    },
  ];

  const stats = [
    { value: "24/7", label: { en: "Bookings on autopilot", ar: "حجوزات تلقائية طوال الوقت" } },
    { value: "AR / EN", label: { en: "Fully bilingual + RTL", ar: "ثنائي اللغة بالكامل + RTL" } },
    { value: "0", label: { en: "Apps for patients to install", ar: "تطبيقات على المريض تثبيتها" } },
  ];

  return (
    <div className="dash-light min-h-screen bg-background text-ink">
      {/* header */}
      <header className="sticky top-0 z-40 border-b border-primary/10 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <div className="flex items-center gap-2">
            <ClinvaMark className="h-9 w-9 shrink-0" />
            <span className="text-lg">
              <ClinvaWordmark />
              <span className="ms-1 text-xs font-semibold text-muted">{tr({ en: "for clinics", ar: "للعيادات" })}</span>
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <LanguageToggle />
            <a
              href={waLink(demoMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-dark px-5 py-2 text-sm font-semibold text-[color:var(--on-primary)] shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 sm:inline-flex"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Z" /></svg>
              {tr({ en: "Book a demo", ar: "احجز عرضًا" })}
            </a>
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute start-1/2 top-[-6rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-primary/[0.08] blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-4xl px-5 py-20 text-center lg:py-28">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-surface px-4 py-1.5 text-sm font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {tr({ en: "The all-in-one clinic management system", ar: "نظام إدارة العيادة المتكامل" })}
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-6xl">
              {tr({
                en: "Run your dental clinic on WhatsApp — bookings, patients & payments in one place.",
                ar: "أدِر عيادة أسنانك عبر واتساب — الحجوزات والمرضى والمدفوعات في مكان واحد.",
              })}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
              {tr({
                en: `${PRODUCT} turns WhatsApp into your front desk: patients book and confirm by chat, you manage the whole day from one dashboard, and every treatment, payment and follow-up is tracked automatically.`,
                ar: `${PRODUCT} يحوّل واتساب إلى موظف الاستقبال: المرضى يحجزون ويؤكدون بالدردشة، وأنت تدير يومك من لوحة واحدة، وكل علاج ودفعة ومتابعة يُتتبّع تلقائيًا.`,
              })}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={waLink(demoMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-dark px-7 py-3.5 text-base font-semibold text-[color:var(--on-primary)] shadow-xl shadow-primary/25 transition hover:-translate-y-0.5"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Z" /></svg>
                {tr({ en: "Message us on WhatsApp", ar: "راسلنا على واتساب" })}
              </a>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-surface px-7 py-3.5 text-base font-semibold text-ink transition hover:border-primary/50"
              >
                {tr({ en: "See what it does", ar: "شاهد ماذا يفعل" })}
                <svg viewBox="0 0 24 24" className="h-4 w-4 rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </a>
            </div>
          </Reveal>

          {/* hero screenshot */}
          <Reveal delay={140} className="mt-14">
            <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-primary/15 bg-surface shadow-2xl shadow-primary/10">
              <div className="flex items-center gap-1.5 border-b border-primary/10 bg-surface-2 px-4 py-2.5">
                <span className="h-3 w-3 rounded-full bg-rose-400/70" />
                <span className="h-3 w-3 rounded-full bg-amber-400/70" />
                <span className="h-3 w-3 rounded-full bg-emerald-400/70" />
              </div>
              <Image
                src="/product/dash-overview.png"
                alt={tr({ en: "Clinic dashboard overview", ar: "لوحة إدارة العيادة" })}
                width={2880}
                height={1800}
                priority
                className="h-auto w-full"
              />
            </div>
          </Reveal>

          {/* stats */}
          <Reveal delay={200} className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-4">
            {stats.map((s) => (
              <div key={s.value} className="rounded-2xl border border-primary/12 bg-surface px-3 py-5">
                <p className="text-2xl font-extrabold text-primary sm:text-3xl">{s.value}</p>
                <p className="mt-1 text-xs text-muted sm:text-sm">{tr(s.label)}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* features */}
      <section id="features" className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            {tr({ en: "Everything in one system", ar: "كل شيء في نظام واحد" })}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr({ en: "Built for how modern clinics actually work", ar: "مصمَّم لطريقة عمل العيادات الحديثة فعلًا" })}
          </h2>
        </Reveal>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <Reveal
              key={f.title.en}
              delay={(i % 3) * 80}
              className="card-hover rounded-2xl border border-primary/15 bg-surface p-6 shadow-sm hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 text-primary">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={f.icon} />
                </svg>
              </div>
              <h3 className="mt-5 text-lg font-bold text-ink">{tr(f.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{tr(f.desc)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* screenshot showcase */}
      <section className="border-y border-primary/10 bg-surface/40 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-bold uppercase tracking-wider text-primary">
              {tr({ en: "A closer look", ar: "نظرة أقرب" })}
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              {tr({ en: "Simple enough for the whole team", ar: "بسيط بما يكفي لكل الفريق" })}
            </h2>
          </Reveal>
          <div className="mt-14 space-y-16">
            {shots.map((s, i) => (
              <Reveal
                key={s.src}
                className={`grid items-center gap-8 lg:grid-cols-2 ${i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""}`}
              >
                <div className="overflow-hidden rounded-2xl border border-primary/15 bg-surface shadow-xl shadow-primary/10">
                  <div className="flex items-center gap-1.5 border-b border-primary/10 bg-surface-2 px-4 py-2.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                  </div>
                  <Image src={s.src} alt={tr(s.title)} width={2880} height={1800} className="h-auto w-full" />
                </div>
                <div className="px-1">
                  <h3 className="text-2xl font-extrabold tracking-tight text-ink">{tr(s.title)}</h3>
                  <p className="mt-3 text-lg text-muted">{tr(s.desc)}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* benefits */}
      <section className="mx-auto max-w-5xl px-5 py-20 lg:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr({ en: "Why clinics choose it", ar: "لماذا تختاره العيادات" })}
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {[
            { en: "Fewer no-shows — automatic reminders and follow-ups keep patients engaged.", ar: "غياب أقل — التذكيرات والمتابعات التلقائية تُبقي المرضى على تواصل." },
            { en: "Less admin — the bot handles booking so your reception isn’t glued to the phone.", ar: "أعمال إدارية أقل — البوت يتولى الحجز فلا يبقى الاستقبال مشغولًا بالهاتف." },
            { en: "Clear cash flow — see exactly what each patient paid and still owes.", ar: "تدفّق نقدي واضح — اعرف بالضبط ما دفعه كل مريض وما تبقّى عليه." },
            { en: "Own your data — export everything to Excel any time, no lock-in.", ar: "بياناتك ملكك — صدّر كل شيء إلى إكسل في أي وقت، دون احتكار." },
            { en: "Works in Arabic & English — full RTL, so it feels native to your patients.", ar: "يعمل بالعربية والإنجليزية — دعم RTL كامل ليكون طبيعيًا لمرضاك." },
            { en: "Your own branded website included — patients book from a site that’s truly yours.", ar: "موقع خاص بعلامتك مشمول — يحجز المرضى من موقع يخصّك أنت." },
          ].map((b) => (
            <Reveal key={b.en} className="flex items-start gap-3 rounded-2xl border border-primary/12 bg-surface p-5">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              </span>
              <p className="text-sm font-medium leading-relaxed text-ink/85">{tr(b)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* final CTA */}
      <section className="mx-auto max-w-4xl px-5 pb-24">
        <Reveal className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/12 to-surface p-10 text-center shadow-xl shadow-primary/10 lg:p-14">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr({ en: "See it running on your clinic in minutes", ar: "شاهده يعمل على عيادتك في دقائق" })}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            {tr({
              en: "Send us one message and we’ll walk you through a live demo, set up with your services and prices.",
              ar: "أرسل لنا رسالة واحدة وسنعرض لك النظام مباشرةً، مُهيّأً بخدماتك وأسعارك.",
            })}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={waLink(demoMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-dark px-8 py-4 text-base font-semibold text-[color:var(--on-primary)] shadow-xl shadow-primary/25 transition hover:-translate-y-0.5"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Z" /></svg>
              {tr({ en: "Message us on WhatsApp", ar: "راسلنا على واتساب" })}
            </a>
            <a
              href={`tel:${site.phone}`}
              dir="ltr"
              className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-surface px-8 py-4 text-base font-semibold text-ink transition hover:border-primary/50"
            >
              {site.phoneDisplay}
            </a>
          </div>
          <p className="mt-6 text-xs text-muted">
            {tr({
              en: "No spam, ever. We only reply when you reach out first.",
              ar: "بلا إزعاج إطلاقًا. نردّ فقط عندما تتواصل أنت أولًا.",
            })}
          </p>
        </Reveal>
      </section>

      {/* footer */}
      <footer className="border-t border-primary/10 bg-surface/50">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-5 py-8 text-sm text-muted sm:flex-row lg:px-8">
          <p className="flex items-center gap-2">
            <ClinvaMark className="h-5 w-5" />
            © {new Date().getFullYear()} {PRODUCT}. {tr({ en: "All rights reserved.", ar: "جميع الحقوق محفوظة." })}
          </p>
          <Link href="/" className="transition hover:text-primary">{tr({ en: "View a live clinic site →", ar: "شاهد موقع عيادة مباشر →" })}</Link>
        </div>
      </footer>
    </div>
  );
}
