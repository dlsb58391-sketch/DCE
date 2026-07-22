"use client";

import { useEffect, useRef } from "react";
import { useLang } from "@/lib/language";
import { Reveal } from "./Reveal";

/**
 * Implant animation showcase.
 *
 * The source clip has a WHITE background, so it's composited with
 * `mix-blend-mode: multiply` over the page-coloured stage: the white turns into
 * the page colour (vanishes) and only the lit 3D implant model shows — it reads
 * as a seamless animation that's part of the page, not an embedded video (no
 * controls, autoplay, muted, loops). The section keeps a flat background (no
 * ambient tint) so the stage matches its surroundings and no frame/box shows.
 */
export function ImplantShowcase() {
  const { tr } = useLang();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Only play while in view — keeps it light on the CPU.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.2 }
    );
    obs.observe(v);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="implant" className="relative overflow-hidden bg-background py-20 lg:py-28">
      <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            {tr({ en: "Implant Technology", ar: "تقنية الزراعة" })}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr({ en: "Full-Mouth Dental Implants", ar: "زراعة الأسنان الكاملة" })}
          </h2>
          <p className="mt-4 text-lg text-muted">
            {tr({
              en: "A closer look at how we rebuild a complete, natural smile — precision implants placed to look, feel and function like your own teeth.",
              ar: "نظرة أقرب على كيفية استعادة ابتسامتك كاملة — زرعات دقيقة تبدو وتُحَسّ وتعمل تمامًا كأسنانك الطبيعية.",
            })}
          </p>
        </Reveal>

        <Reveal delay={120} className="mx-auto mt-10 max-w-4xl">
          <div className="implant-stage">
            <video
              ref={videoRef}
              src="/clinic/videos/implant-animation.mp4"
              className="implant-anim"
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              aria-label={tr({ en: "Dental implant 3D animation", ar: "رسوم متحركة ثلاثية الأبعاد لزراعة الأسنان" })}
            />
          </div>
        </Reveal>

        {/* supporting points */}
        <Reveal delay={200} className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-3">
          {[
            { en: "Fixed, natural-looking teeth", ar: "أسنان ثابتة بمظهر طبيعي" },
            { en: "Precision-guided placement", ar: "زرع دقيق وموجَّه" },
            { en: "A confident, lasting smile", ar: "ابتسامة واثقة تدوم" },
          ].map((f) => (
            <div
              key={f.en}
              className="flex items-center gap-2.5 rounded-xl border border-primary/12 bg-surface px-4 py-3 text-sm font-semibold text-ink/85 shadow-sm"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/12 text-primary">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
              {tr(f)}
            </div>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
