"use client";

import { useLang } from "@/lib/language";

export function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { lang, toggle } = useLang();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle language"
      className={`group inline-flex items-center gap-2 rounded-full border border-primary/30 bg-surface/70 px-3 py-1.5 text-sm font-semibold text-ink transition hover:border-primary hover:bg-primary hover:text-[color:var(--on-primary)] ${
        compact ? "" : ""
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </svg>
      {lang === "en" ? "العربية" : "English"}
    </button>
  );
}
