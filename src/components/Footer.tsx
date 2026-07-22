"use client";

import { useLang } from "@/lib/language";
import { t } from "@/lib/content";
import { activeClinic } from "@/lib/clinics";

const links = [
  { id: "services", key: "services" },
  { id: "about", key: "about" },
  { id: "cases", key: "cases" },
  { id: "team", key: "team" },
  { id: "reviews", key: "reviews" },
  { id: "contact", key: "contact" },
] as const;

/** Derive the footer social icons from the active clinic's social URLs. */
function socialKind(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("facebook")) return "facebook";
  if (u.includes("instagram")) return "instagram";
  if (u.includes("wa.me") || u.includes("whatsapp")) return "whatsapp";
  if (u.includes("tiktok")) return "tiktok";
  if (u.includes("youtu")) return "youtube";
  return "link";
}

const socials: { name: string; href: string }[] = activeClinic().contact.social.map((href) => ({
  name: socialKind(href),
  href,
}));

function SocialIcon({ name }: { name: string }) {
  const common = {
    fill: "currentColor",
    viewBox: "0 0 24 24",
    className: "h-4 w-4",
  };
  if (name === "facebook")
    return (
      <svg {...common}>
        <path d="M13.5 9V7.5c0-.7.3-1 1-1H16V4h-2.3C11.5 4 11 5.5 11 7v2H9v2.5h2V20h2.5v-8.5h2L16 9h-2.5Z" />
      </svg>
    );
  if (name === "instagram")
    return (
      <svg {...common}>
        <path d="M12 8.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8Zm0 5.3a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2Zm4.1-5.4a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18 8.7c0-1.1-.3-2-1-2.7-.7-.7-1.6-1-2.7-1H9.7c-1.1 0-2 .3-2.7 1-.7.7-1 1.6-1 2.7v4.6c0 1.1.3 2 1 2.7.7.7 1.6 1 2.7 1h4.6c1.1 0 2-.3 2.7-1 .7-.7 1-1.6 1-2.7V8.7Zm-1.2 4.6c0 .8-.2 1.4-.6 1.8-.4.4-1 .6-1.8.6H9.6c-.8 0-1.4-.2-1.8-.6-.4-.4-.6-1-.6-1.8V8.7c0-.8.2-1.4.6-1.8.4-.4 1-.6 1.8-.6h4.8c.8 0 1.4.2 1.8.6.4.4.6 1 .6 1.8v4.6Z" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M12 4a8 8 0 0 0-6.9 12l-1 3.6 3.7-1A8 8 0 1 0 12 4Zm4.3 11.2c-.2.5-1 .9-1.4 1-.4 0-.8.2-2.6-.6-2.2-.9-3.6-3.2-3.7-3.3-.1-.2-.9-1.2-.9-2.3s.6-1.6.8-1.8c.2-.2.4-.3.6-.3h.4c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4 0 .5l-.3.4c-.2.2-.3.3-.1.6.1.2.6 1 1.3 1.6.9.8 1.6 1 1.8 1.1.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.5.7c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" />
    </svg>
  );
}

export function Footer() {
  const { tr } = useLang();

  return (
    <footer className="border-t border-primary/15 bg-[#070a0d] text-white/75">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        <div className="sm:col-span-2 lg:col-span-2">
          <div className="flex items-center gap-2 font-bold text-white">
            <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary-dark p-1.5">
              <svg viewBox="0 0 24 24" className="h-full w-full text-white" fill="currentColor" aria-hidden>
                <path d="M12 3.2c-3.4 0-5.6 2-5.6 4.9 0 2 .9 3 .9 6 0 1.9.7 6.9 1.9 6.9 1.2 0 1.1-4 2.8-4s1.6 4 2.8 4c1.2 0 1.9-5 1.9-6.9 0-3 .9-4 .9-6 0-2.9-2.2-4.9-5.6-4.9Z" />
              </svg>
            </span>
            <span className="text-lg">{tr(t.brand)}</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
            {tr(t.footer.tagline)}
          </p>
          <div className="mt-5 flex gap-3">
            {socials.map((s) => (
              <a
                key={s.name}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.name}
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-primary hover:text-[color:var(--on-primary)]"
              >
                <SocialIcon name={s.name} />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-bold text-white">{tr(t.footer.quickLinks)}</h4>
          <ul className="mt-4 space-y-2.5 text-sm">
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  className="text-white/60 transition hover:text-primary"
                >
                  {tr(t.nav[l.key])}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white">{tr(t.footer.contactInfo)}</h4>
          <ul className="mt-4 space-y-2.5 text-sm text-white/60">
            <li>{tr(t.contact.address)}</li>
            <li dir="ltr" className="rtl:text-right">{tr(t.contact.phoneValue)}</li>
            <li>{tr(t.contact.hours)}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-5 py-5 text-center text-sm text-white/50 lg:px-8">
          © {new Date().getFullYear()} {tr(t.brand)}. {tr(t.footer.rights)}
        </div>
      </div>
    </footer>
  );
}
