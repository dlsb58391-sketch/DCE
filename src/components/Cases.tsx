"use client";

import Image from "next/image";
import { useLang } from "@/lib/language";
import { cases, t } from "@/lib/content";
import { Reveal } from "./Reveal";

export function Cases() {
  const { tr } = useLang();

  return (
    <section id="cases" className="relative py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            {tr(t.cases.eyebrow)}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr(t.cases.title)}
          </h2>
          <p className="mt-4 text-lg text-muted">{tr(t.cases.subtitle)}</p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {cases.map((c, i) => (
            <Reveal
              key={i}
              delay={(i % 3) * 90}
              className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-primary/10 shadow-sm"
            >
              <Image
                src={c.image}
                alt={tr(c.title)}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#04070a] via-[#04070a]/30 to-transparent" />
              <span className="absolute top-4 start-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-[color:var(--on-primary)]">
                {tr(c.tag)}
              </span>
              <h3 className="absolute bottom-4 start-4 end-4 text-lg font-bold text-white">
                {tr(c.title)}
              </h3>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
