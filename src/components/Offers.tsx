"use client";

import { useLang } from "@/lib/language";
import { useSite, offerIcons, type Offer } from "@/lib/siteStore";
import { Reveal } from "./Reveal";

function goToBooking(offer: Offer, selectOffer: (o: Offer | null) => void) {
  selectOffer(offer);
  const el = document.getElementById("contact");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Offers() {
  const { tr, lang } = useLang();
  const { settings, selectOffer } = useSite();
  const active = settings.offers.filter((o) => o.active);

  if (active.length === 0) return null;

  return (
    <section id="offers" className="relative overflow-hidden py-20 lg:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute start-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-bold uppercase tracking-wider text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {tr({ en: "Limited-Time Offers", ar: "عروض لفترة محدودة" })}
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr({ en: "Special Deals on Your Smile", ar: "عروض خاصة على ابتسامتك" })}
          </h2>
          <p className="mt-4 text-lg text-muted">
            {tr({
              en: "Book now and save — tap any offer to claim it instantly.",
              ar: "احجز الآن ووفّر — اضغط على أي عرض للحصول عليه فورًا.",
            })}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((offer, i) => (
            <Reveal key={offer.id} delay={i * 110}>
              <button
                onClick={() => goToBooking(offer, selectOffer)}
                className="group relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-primary/15 bg-surface p-6 text-start shadow-lg transition hover:-translate-y-1.5 hover:shadow-2xl"
                style={{ boxShadow: `0 10px 40px -18px ${offer.color}` }}
              >
                {/* glow corner */}
                <span
                  className="pointer-events-none absolute -end-10 -top-10 h-32 w-32 rounded-full opacity-25 blur-2xl transition group-hover:opacity-40"
                  style={{ background: offer.color }}
                />

                {/* discount badge */}
                <span
                  className="absolute end-5 top-5 animate-glow rounded-full px-3 py-1 text-xs font-extrabold text-white shadow-md"
                  style={{ backgroundColor: offer.color }}
                >
                  {tr(offer.badge)}
                </span>

                <span
                  className="grid h-14 w-14 place-items-center rounded-2xl text-white shadow-md"
                  style={{ backgroundColor: offer.color }}
                >
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d={offerIcons[offer.icon] ?? offerIcons.sparkle} />
                  </svg>
                </span>

                <h3 className="mt-5 text-xl font-extrabold text-ink">{tr(offer.title)}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{tr(offer.desc)}</p>

                <span
                  className="mt-5 inline-flex items-center gap-2 text-sm font-bold transition group-hover:gap-3"
                  style={{ color: offer.color }}
                >
                  {tr({ en: "Claim this offer", ar: "احجز هذا العرض" })}
                  <svg
                    viewBox="0 0 24 24"
                    className={`h-4 w-4 ${lang === "ar" ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
