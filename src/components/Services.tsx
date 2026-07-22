"use client";

import { useLang } from "@/lib/language";
import { services, t } from "@/lib/content";
import { ServiceIcon } from "./ServiceIcon";
import { Reveal } from "./Reveal";

export function Services() {
  const { tr } = useLang();

  return (
    <section id="services" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            {tr(t.services.eyebrow)}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr(t.services.title)}
          </h2>
          <p className="mt-4 text-lg text-muted">{tr(t.services.subtitle)}</p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((s, i) => (
            <Reveal
              key={s.icon}
              delay={(i % 4) * 80}
              className="group card-hover rounded-2xl border border-primary/15 bg-surface p-6 shadow-sm hover:border-primary/40 hover:bg-surface-2 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-accent/10 text-primary transition group-hover:from-primary group-hover:to-primary-dark group-hover:text-[color:var(--on-primary)]">
                <ServiceIcon name={s.icon} className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-lg font-bold text-ink">{tr(s.title)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {tr(s.desc)}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
