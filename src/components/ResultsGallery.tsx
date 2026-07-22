"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { Reveal } from "./Reveal";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { activeClinic } from "@/lib/clinics";

const clinic = activeClinic();
const gallery = clinic.gallery;
const cases = gallery.cases;

export function ResultsGallery() {
  const { tr, lang } = useLang();
  const [active, setActive] = useState<number | null>(null);

  // Lightbox keyboard nav (grid style only; harmless otherwise since `active`
  // stays null in slider mode).
  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
      if (e.key === "ArrowRight") setActive((i) => (i === null ? null : (i + 1) % cases.length));
      if (e.key === "ArrowLeft") setActive((i) => (i === null ? null : (i - 1 + cases.length) % cases.length));
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [active]);

  return (
    <section id="results" className="relative overflow-hidden py-20 lg:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute end-[-6rem] top-20 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute start-[-6rem] bottom-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            {tr({ en: "Before & After", ar: "قبل وبعد" })}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr(gallery.headline)}
          </h2>
          <p className="mt-4 text-lg text-muted">{tr(gallery.subtitle)}</p>
        </Reveal>

        {gallery.style === "slider" ? (
          <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:gap-8">
            {cases.map((p, i) => (
              <Reveal key={p.before ?? i} delay={(i % 2) * 100} as="article">
                <BeforeAfterSlider
                  before={{ src: p.before!, alt: `${tr(p.title)} — ${tr({ en: "before", ar: "قبل" })}` }}
                  after={{ src: p.after!, alt: `${tr(p.title)} — ${tr({ en: "after", ar: "بعد" })}` }}
                  beforeLabel={tr({ en: "Before", ar: "قبل" })}
                  afterLabel={tr({ en: "After", ar: "بعد" })}
                  aspectClass={p.aspect}
                />
                <div className="mt-3 flex items-center justify-between gap-2 px-1">
                  <h3 className="text-sm font-bold text-ink">{tr(p.title)}</h3>
                  <span className="shrink-0 rounded-full bg-primary/12 px-2.5 py-1 text-[11px] font-bold text-primary">
                    {tr(p.tag)}
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
        ) : (
          <div className="mt-14 gap-4 sm:gap-5 [column-fill:_balance] columns-2 lg:columns-3">
            {cases.map((c, i) => (
              <Reveal
                key={c.src ?? i}
                delay={(i % 3) * 80}
                as="article"
                className="group relative mb-4 block cursor-pointer break-inside-avoid overflow-hidden rounded-2xl border border-primary/15 bg-surface shadow-sm transition hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 sm:mb-5"
              >
                <button onClick={() => setActive(i)} className="block w-full text-start" aria-label={tr(c.title)}>
                  <div className="relative overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.src!}
                      alt={tr(c.title)}
                      loading="lazy"
                      className="block w-full h-auto transition duration-700 group-hover:scale-[1.03]"
                    />
                    <span className="absolute top-3 start-3 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-[color:var(--on-primary)] shadow">
                      {tr(c.tag)}
                    </span>
                    <span className="absolute top-3 end-3 grid h-8 w-8 place-items-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="7" /><path d="m20 20-3-3M11 8v6M8 11h6" />
                      </svg>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <h3 className="text-sm font-bold text-ink">{tr(c.title)}</h3>
                    <span className="shrink-0 text-[11px] font-semibold text-muted">
                      {tr({ en: "Before / After", ar: "قبل / بعد" })}
                    </span>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted">
          {tr({
            en: "Results vary from patient to patient. Photos shared with patient consent.",
            ar: "النتائج تختلف من مريض لآخر. الصور منشورة بموافقة المرضى.",
          })}
        </p>
      </div>

      {/* lightbox (grid style) */}
      {gallery.style === "grid" && active !== null && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setActive(null)}
        >
          <button
            onClick={() => setActive(null)}
            aria-label="Close"
            className="absolute end-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setActive((i) => (i === null ? null : (i - 1 + cases.length) % cases.length)); }}
            aria-label="Previous"
            className="absolute start-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setActive((i) => (i === null ? null : (i + 1) % cases.length)); }}
            aria-label="Next"
            className="absolute end-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>

          <figure className="relative max-h-[88vh] w-auto" onClick={(e) => e.stopPropagation()} dir={lang === "ar" ? "rtl" : "ltr"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cases[active].src!}
              alt={tr(cases[active].title)}
              className="max-h-[82vh] w-auto rounded-2xl border border-white/10 object-contain"
            />
            <figcaption className="mt-3 text-center">
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-[color:var(--on-primary)]">{tr(cases[active].tag)}</span>
              <p className="mt-2 text-sm font-semibold text-white">{tr(cases[active].title)}</p>
            </figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
