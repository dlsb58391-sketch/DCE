"use client";

import Image from "next/image";
import { useLang } from "@/lib/language";
import { t } from "@/lib/content";
import { useSite } from "@/lib/siteStore";
import { site } from "@/lib/site";
import { activeClinic } from "@/lib/clinics";
import { Reveal } from "./Reveal";
import { CountUp } from "./CountUp";

function ProfileIcon({ path }: { path: string }) {
  return (
    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </span>
  );
}


export function About() {
  const { tr } = useLang();
  const { settings } = useSite();
  const clinic = activeClinic();
  const aboutImage =
    clinic.slug === "dce" && clinic.logo ? clinic.logo : settings.photo;
  const points = [t.about.point1, t.about.point2, t.about.point3];

  return (
    <section id="about" className="relative overflow-hidden py-20 lg:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute end-[-6rem] top-10 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
      </div>
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 lg:grid-cols-2 lg:px-8">
        <Reveal className="relative mx-auto w-full max-w-md">
          <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-[2rem] border border-primary/15 bg-white p-12 shadow-2xl shadow-primary/20">
            {aboutImage.startsWith("data:") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={aboutImage}
                alt={tr(settings.doctorName)}
                className="h-full w-full object-contain"
              />
            ) : (
              <Image
                src={aboutImage}
                alt={tr(settings.doctorName)}
                width={460}
                height={460}
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="h-full w-full object-contain"
              />
            )}
          </div>
          <div className="glass absolute bottom-5 start-[-1rem] rounded-2xl px-5 py-3 shadow-xl">
            <div className="text-2xl font-extrabold text-primary"><CountUp value="15+" /></div>
            <div className="text-xs font-medium text-muted">Years</div>
          </div>
        </Reveal>

        <Reveal delay={120}>
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            {tr(t.about.eyebrow)}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr(settings.doctorName)}
          </h2>
          <p className="mt-1 text-lg font-semibold text-accent">
            {tr(settings.role)}
          </p>
          <p className="mt-5 text-muted">{tr(t.about.bio1)}</p>
          <p className="mt-4 text-muted">{tr(t.about.bio2)}</p>

          {t.about.credentials.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {t.about.credentials.map((c, i) => (
                <li
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/8 px-3 py-1.5 text-xs font-semibold text-primary"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3Z" /><path d="m9 12 2 2 4-4" />
                  </svg>
                  {tr(c)}
                </li>
              ))}
            </ul>
          )}

          {t.about.profile && (
            <div className="mt-7 rounded-2xl border border-primary/15 bg-surface/70 p-5 shadow-sm">
              <div className="flex items-center gap-3.5">
                <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border border-primary/20 bg-white">
                  {aboutImage.startsWith("data:") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={aboutImage} alt={tr(t.about.profile.name)} className="h-full w-full object-cover" />
                  ) : (
                    <Image
                      src={aboutImage}
                      alt={tr(t.about.profile.name)}
                      width={56}
                      height={56}
                      className="h-full w-full object-cover"
                    />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-base font-extrabold text-ink">{tr(t.about.profile.name)}</div>
                  <div className="mt-0.5 text-sm font-semibold text-primary">{tr(t.about.profile.title)}</div>
                </div>
              </div>

              <dl className="mt-4 grid gap-2.5 text-sm sm:grid-cols-2">
                <div className="flex items-start gap-2.5">
                  <ProfileIcon path="M5 8l6 4 6-4M4 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
                  <div>
                    <dt className="text-xs font-medium text-muted">{tr({ en: "Languages", ar: "اللغات" })}</dt>
                    <dd className="font-semibold text-ink">{tr(t.about.profile.languages)}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <ProfileIcon path="M12 21s-7-5.7-7-11a7 7 0 1 1 14 0c0 5.3-7 11-7 11Z M12 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                  <div>
                    <dt className="text-xs font-medium text-muted">{tr(t.contact.addressLabel)}</dt>
                    <dd className="font-semibold text-ink">{tr(t.contact.address)}</dd>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 sm:col-span-2">
                  <ProfileIcon path="M4 5a1 1 0 0 1 1-1h3l2 5-2 1a11 11 0 0 0 5 5l1-2 5 2v3a1 1 0 0 1-1 1A16 16 0 0 1 4 5Z" />
                  <div>
                    <dt className="text-xs font-medium text-muted">{tr(t.contact.phoneLabel)}</dt>
                    <dd dir="ltr" className="rtl:text-right">
                      <a href={`tel:${site.phone}`} className="font-semibold text-ink transition hover:text-primary">
                        {tr(t.contact.phoneValue)}
                      </a>
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          )}

          <ul className="mt-7 space-y-3">
            {points.map((p, i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <span className="font-medium text-ink">{tr(p)}</span>
              </li>
            ))}
          </ul>

          <a
            href="#contact"
            className="mt-8 inline-block rounded-full bg-gradient-to-r from-primary to-primary-dark px-7 py-3 font-semibold text-[color:var(--on-primary)] shadow-lg shadow-primary/25 transition hover:-translate-y-0.5"
          >
            {tr(t.nav.book)}
          </a>
        </Reveal>
      </div>
    </section>
  );
}
