"use client";

import Image from "next/image";
import { useLang } from "@/lib/language";
import { team, t } from "@/lib/content";
import { Reveal } from "./Reveal";

export function Team() {
  const { tr } = useLang();
  if (team.length === 0) return null;

  return (
    <section
      id="team"
      className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-transparent py-20 lg:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            {tr(t.team.eyebrow)}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr(t.team.title)}
          </h2>
          <p className="mt-4 text-lg text-muted">{tr(t.team.subtitle)}</p>
        </Reveal>

        <div className="mx-auto mt-14 grid max-w-3xl gap-6 sm:grid-cols-2">
          {team.map((m, i) => (
            <Reveal
              key={i}
              delay={(i % 2) * 90}
              className="card-hover group overflow-hidden rounded-2xl border border-primary/15 bg-surface text-center shadow-sm hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden">
                <Image
                  src={m.photo}
                  alt={tr(m.name)}
                  fill
                  sizes="(max-width: 640px) 100vw, 40vw"
                  className="object-cover object-top transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e12]/80 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-start">
                  <h3 className="text-lg font-bold text-white">{tr(m.name)}</h3>
                  <p className="text-sm font-medium text-accent">{tr(m.role)}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
