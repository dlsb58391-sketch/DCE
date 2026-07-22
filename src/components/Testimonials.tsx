"use client";

import { useLang } from "@/lib/language";
import { testimonials, t } from "@/lib/content";
import { Reveal } from "./Reveal";

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5 text-amber-400">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill={i < n ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.1l1-5.8L3.5 9.2l5.9-.9L12 3Z" />
        </svg>
      ))}
    </div>
  );
}

export function Testimonials() {
  const { tr } = useLang();

  return (
    <section id="reviews" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            {tr(t.reviews.eyebrow)}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr(t.reviews.title)}
          </h2>
          <p className="mt-4 text-lg text-muted">{tr(t.reviews.subtitle)}</p>
        </Reveal>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {testimonials.map((r, i) => (
            <Reveal
              key={i}
              delay={(i % 3) * 90}
              className="card-hover relative rounded-2xl border border-primary/15 bg-surface p-7 shadow-sm hover:border-primary/40 hover:bg-surface-2 hover:shadow-xl hover:shadow-primary/10"
            >
              <svg viewBox="0 0 24 24" className="h-9 w-9 text-primary/30" fill="currentColor">
                <path d="M9.5 7C6.5 7 4 9.5 4 12.5V18h6v-6H6.8c0-1.4 1.2-2.5 2.7-2.5V7Zm10 0C16.5 7 14 9.5 14 12.5V18h6v-6h-3.2c0-1.4 1.2-2.5 2.7-2.5V7Z" />
              </svg>
              <p className="mt-4 leading-relaxed text-foreground/80">{tr(r.text)}</p>
              <div className="mt-6 flex items-center justify-between">
                <span className="font-bold text-ink">{tr(r.name)}</span>
                <Stars n={r.rating} />
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
