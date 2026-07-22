"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { useSite, offerIcons } from "@/lib/siteStore";

export function OfferPopup() {
  const { tr, lang } = useLang();
  const { settings, selectOffer, ready } = useSite();
  const active = settings.offers.filter((o) => o.active);
  const offer = active[0];

  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!ready || !offer || dismissed) return;
    const seen = sessionStorage.getItem("offer_popup_seen");
    if (seen) return;
    const timer = setTimeout(() => setOpen(true), 3500);
    return () => clearTimeout(timer);
  }, [ready, offer, dismissed]);

  const close = () => {
    setOpen(false);
    setDismissed(true);
    try {
      sessionStorage.setItem("offer_popup_seen", "1");
    } catch {
      /* ignore */
    }
  };

  const claim = () => {
    if (!offer) return;
    selectOffer(offer);
    close();
    const el = document.getElementById("contact");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!open || !offer) return null;

  return (
    <div className="fixed bottom-4 end-4 z-[55] w-[calc(100%-2rem)] max-w-sm animate-[fade-up_0.5s_ease]">
      <div
        className="relative overflow-hidden rounded-2xl border border-primary/25 bg-surface p-5 shadow-2xl"
        style={{ boxShadow: `0 18px 50px -20px ${offer.color}` }}
      >
        <span
          className="pointer-events-none absolute -end-12 -top-12 h-36 w-36 rounded-full opacity-30 blur-2xl"
          style={{ background: offer.color }}
        />

        <button
          onClick={close}
          aria-label="Close"
          className="absolute end-3 top-3 grid h-7 w-7 place-items-center rounded-lg text-muted transition hover:bg-primary/10 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-start gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-white shadow-md"
            style={{ backgroundColor: offer.color }}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d={offerIcons[offer.icon] ?? offerIcons.sparkle} />
            </svg>
          </span>
          <div className="min-w-0 pe-4">
            <span
              className="inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold text-white"
              style={{ backgroundColor: offer.color }}
            >
              {tr(offer.badge)}
            </span>
            <h4 className="mt-1.5 text-base font-extrabold text-ink">{tr(offer.title)}</h4>
            <p className="mt-1 line-clamp-2 text-xs text-muted">{tr(offer.desc)}</p>
          </div>
        </div>

        <button
          onClick={claim}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5"
          style={{ backgroundColor: offer.color }}
        >
          {tr({ en: "Book this offer now", ar: "احجز هذا العرض الآن" })}
          <svg viewBox="0 0 24 24" className={`h-4 w-4 ${lang === "ar" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
