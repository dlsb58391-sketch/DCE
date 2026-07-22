"use client";

import { useLang } from "@/lib/language";
import { t } from "@/lib/content";
import { useSite } from "@/lib/siteStore";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import { Reveal } from "./Reveal";

export function BeforeAfterSection() {
  const { tr } = useLang();
  const { settings } = useSite();
  const pairs = settings.cases;

  if (pairs.length === 0) return null;

  return (
    <section id="before-after" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            {tr(t.beforeAfter.eyebrow)}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr(t.beforeAfter.title)}
          </h2>
          <p className="mt-4 text-lg text-muted">{tr(t.beforeAfter.subtitle)}</p>
        </Reveal>

        <div className="mt-14 grid gap-8 md:grid-cols-2">
          {pairs.map((p, i) => (
            <Reveal key={p.id} delay={i * 120}>
              <BeforeAfterSlider
                before={{ src: p.before, alt: `${tr(p.label)} ${tr(t.beforeAfter.before)}` }}
                after={{ src: p.after, alt: `${tr(p.label)} ${tr(t.beforeAfter.after)}` }}
                beforeLabel={tr(t.beforeAfter.before)}
                afterLabel={tr(t.beforeAfter.after)}
                aspectClass="aspect-[16/10]"
              />
              <div className="mt-3 px-1 text-sm font-semibold text-ink">{tr(p.label)}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
