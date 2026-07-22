"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { activeClinic } from "@/lib/clinics";
import type { Bi } from "@/lib/clinics/types";

type Person = {
  src: string;
  name?: Bi;
  role?: Bi;
};

const clinic = activeClinic();

// A clinic either shows a whole team lineup (e.g. Badawi's five cutouts) or a
// single spotlighted doctor (e.g. Dr. Ibrahim). Solo figures render much larger.
const lineup = clinic.hero.lineup ?? [];
const isLineup = lineup.length > 0;
// For a solo hero, prefer the explicit figure label (e.g. the lead doctor when
// the brand/doctorName is the clinic itself), falling back to doctorName.
const soloName: Bi = clinic.hero.figureName ?? clinic.doctorName;
const soloRole: Bi = clinic.hero.figureRole ?? clinic.role;
const people: Person[] = isLineup
  ? lineup.map((f) => ({ src: f.photo, name: f.name, role: f.role }))
  : [{ src: clinic.hero.photo, name: soloName, role: soloRole }];

const fallbackLabel: Bi = clinic.hero.lineupLabel ?? clinic.doctorName;
const tagline: Bi =
  clinic.hero.tagline ?? { en: "Crafting confident, natural smiles", ar: "نصنع ابتسامات طبيعية وواثقة" };

export function TeamHero() {
  const { tr } = useLang();
  // Default-focus the centre figure so the stage looks alive.
  const [active, setActive] = useState<number>(isLineup ? Math.floor(people.length / 2) : 0);

  // Auto-cycle focus so each doctor is highlighted in turn (no-op for a solo figure).
  useEffect(() => {
    if (people.length < 2) return;
    const id = window.setInterval(() => {
      setActive((prev) => (prev + 1) % people.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="team-stage relative mx-auto w-full max-w-[95rem]">
      {/* stage glow + floor reflection */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 -z-10 mx-auto h-36 max-w-6xl rounded-[50%] bg-primary/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-10 bottom-7 -z-10 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

      {/* dir=ltr keeps the lineup order stable (men left, women right) in both Arabic and English */}
      <div dir="ltr" className="flex items-end justify-center">
        {people.map((p, i) => {
          const isActive = active === i;
          const label = p.name ? tr(p.name) : tr(fallbackLabel);
          return (
            <button
              key={p.src}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-label={label}
              className={`stage-figure group relative -mx-3 sm:-mx-4 ${
                isActive ? "z-20" : "z-10"
              }`}
              data-active={isActive}
            >
              {/* spotlight halo behind the active figure */}
              <span className="figure-halo" aria-hidden />

              <span className={`figure-frame${isLineup ? "" : " figure-frame--solo"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={label} className="figure-img" />
              </span>

              {/* label pill */}
              <span className="figure-label">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {label}
                </span>
                {p.role && <span className="block text-[10px] font-medium text-primary/80">{tr(p.role)}</span>}
              </span>
            </button>
          );
        })}
      </div>

      {/* hint */}
      <p className="mt-14 text-center text-xs font-medium text-muted">{tr(tagline)}</p>
    </div>
  );
}
