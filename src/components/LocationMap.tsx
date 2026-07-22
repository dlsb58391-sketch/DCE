"use client";

import { useLang } from "@/lib/language";
import { t } from "@/lib/content";
import { site, mapUrl } from "@/lib/site";
import { activeClinic } from "@/lib/clinics";
import { Reveal } from "./Reveal";

const clinic = activeClinic();
const { lat, lng } = clinic.contact.geo;
// A small bounding box around the clinic so the embedded map is nicely zoomed.
const pad = 0.006;
const bbox = `${lng - pad}%2C${lat - pad}%2C${lng + pad}%2C${lat + pad}`;
const embedSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;

export function LocationMap() {
  const { tr } = useLang();

  return (
    <section id="location" className="relative overflow-hidden py-20 lg:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute start-[-6rem] top-10 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            {tr({ en: "Find Us", ar: "موقعنا" })}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr({ en: "Visit the Clinic", ar: "تفضل بزيارة العيادة" })}
          </h2>
          <p className="mt-4 text-muted">
            {tr({
              en: "We're easy to reach — tap for directions and come say hello.",
              ar: "الوصول إلينا سهل — اضغط للاتجاهات وتفضل بزيارتنا.",
            })}
          </p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <Reveal className="flex flex-col gap-4">
            <div className="rounded-2xl border border-primary/15 bg-surface p-6 shadow-sm">
              <InfoRow
                label={tr(t.contact.addressLabel)}
                value={tr(t.contact.address)}
                path="M12 21s-7-5.7-7-11a7 7 0 1 1 14 0c0 5.3-7 11-7 11Z M12 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
              />
              <div className="my-4 h-px bg-primary/10" />
              <InfoRow
                label={tr(t.contact.hoursLabel)}
                value={tr(t.contact.hours)}
                path="M12 7v5l3 2 M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Z"
              />
              <div className="my-4 h-px bg-primary/10" />
              <InfoRow
                label={tr(t.contact.phoneLabel)}
                value={
                  <a href={`tel:${site.phone}`} dir="ltr" className="transition hover:text-primary">
                    {tr(t.contact.phoneValue)}
                  </a>
                }
                path="M4 5a1 1 0 0 1 1-1h3l2 5-2 1a11 11 0 0 0 5 5l1-2 5 2v3a1 1 0 0 1-1 1A16 16 0 0 1 4 5Z"
              />
            </div>

            <a
              href={mapUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-primary to-primary-dark px-7 py-3.5 text-center font-semibold text-[color:var(--on-primary)] shadow-lg shadow-primary/25 transition hover:-translate-y-0.5"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l19-9-9 19-2-8-8-2Z" />
              </svg>
              {tr({ en: "Get Directions", ar: "احصل على الاتجاهات" })}
            </a>
          </Reveal>

          <Reveal delay={120}>
            <div className="overflow-hidden rounded-2xl border border-primary/15 shadow-lg shadow-primary/10">
              <iframe
                title={tr({ en: "Clinic location map", ar: "خريطة موقع العيادة" })}
                src={embedSrc}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="h-[340px] w-full sm:h-[420px]"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function InfoRow({
  label,
  value,
  path,
}: {
  label: string;
  value: React.ReactNode;
  path: string;
}) {
  return (
    <div className="flex items-start gap-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d={path} />
        </svg>
      </span>
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
        <div className="mt-0.5 font-semibold text-ink">{value}</div>
      </div>
    </div>
  );
}
