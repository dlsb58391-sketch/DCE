"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { t } from "@/lib/content";
import { LanguageToggle } from "./LanguageToggle";

const links = [
  { id: "services", key: "services" },
  { id: "about", key: "about" },
  { id: "offers", key: "offers" },
  { id: "results", key: "cases" },
  { id: "videos", key: "videos" },
  { id: "team", key: "team" },
  { id: "reviews", key: "reviews" },
  { id: "contact", key: "contact" },
] as const;

export function Navbar() {
  const { tr } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass border-b border-primary/10 shadow-sm"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5 lg:px-8">
        <a href="#home" className="flex items-center gap-2 font-bold text-ink">
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primary-dark p-1.5 shadow-lg shadow-primary/25">
            <svg viewBox="0 0 24 24" className="h-full w-full text-white" fill="currentColor" aria-hidden>
              <path d="M12 3.2c-3.4 0-5.6 2-5.6 4.9 0 2 .9 3 .9 6 0 1.9.7 6.9 1.9 6.9 1.2 0 1.1-4 2.8-4s1.6 4 2.8 4c1.2 0 1.9-5 1.9-6.9 0-3 .9-4 .9-6 0-2.9-2.2-4.9-5.6-4.9Z" />
            </svg>
          </span>
          <span className="text-lg font-extrabold tracking-tight">{tr(t.brand)}</span>
        </a>

        <ul className="hidden items-center gap-7 lg:flex">
          {links.map((l) => (
            <li key={l.id}>
              <a
                href={`#${l.id}`}
                className="text-sm font-medium text-ink/70 transition hover:text-primary"
              >
                {tr(t.nav[l.key])}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2.5">
          <LanguageToggle />
          <a
            href="#contact"
            className="hidden rounded-full bg-gradient-to-r from-primary to-primary-dark px-5 py-2 text-sm font-semibold text-[color:var(--on-primary)] shadow-lg shadow-primary/25 transition hover:shadow-xl hover:shadow-primary/40 sm:inline-block"
          >
            {tr(t.nav.book)}
          </a>
          <button
            aria-label="Menu"
            onClick={() => setOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-primary/20 text-ink lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div className="glass border-t border-primary/10 lg:hidden">
          <ul className="flex flex-col gap-1 px-5 py-4">
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={`#${l.id}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink/80 transition hover:bg-primary/10 hover:text-primary"
                >
                  {tr(t.nav[l.key])}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#contact"
                onClick={() => setOpen(false)}
                className="mt-1 block rounded-full bg-gradient-to-r from-primary to-primary-dark px-4 py-2.5 text-center text-sm font-semibold text-[color:var(--on-primary)]"
              >
                {tr(t.nav.book)}
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
