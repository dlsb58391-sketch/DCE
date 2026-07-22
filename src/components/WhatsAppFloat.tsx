"use client";

import { useLang } from "@/lib/language";
import { site } from "@/lib/site";

/**
 * Big floating WhatsApp button. Opens WhatsApp with a prefilled booking message
 * FROM the patient, which starts the clinic's booking bot flow (the bot replies
 * with the available days → times → confirmation). Because the patient sends the
 * first message, it opens WhatsApp's free 24-hour window for the clinic's replies.
 */
export function WhatsAppFloat() {
  const { tr } = useLang();

  const message = tr({
    en: "Hello, can I book an appointment?",
    ar: "مرحبًا، ممكن أحجز موعد؟",
  });
  const href = `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(message)}`;
  const label = tr({ en: "Book on WhatsApp", ar: "احجز على واتساب" });

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="group fixed bottom-5 end-5 z-50 flex items-center gap-3 rounded-full bg-[#25D366] p-4 text-white shadow-2xl shadow-[#25D366]/40 transition hover:-translate-y-0.5 hover:bg-[#20bd5a] sm:bottom-6 sm:end-6"
    >
      {/* pulsing ring */}
      <span className="pointer-events-none absolute inset-0 rounded-full bg-[#25D366] opacity-70 motion-safe:animate-ping" />
      <svg viewBox="0 0 32 32" className="relative h-8 w-8" fill="currentColor" aria-hidden>
        <path d="M16 0C7.2 0 0 7.2 0 16c0 2.8.7 5.5 2.1 7.9L0 32l8.3-2.2c2.3 1.3 4.9 1.9 7.7 1.9 8.8 0 16-7.2 16-16S24.8 0 16 0zm0 29.3c-2.5 0-4.9-.7-7-1.9l-.5-.3-4.9 1.3 1.3-4.8-.3-.5c-1.4-2.2-2.1-4.7-2.1-7.1C2.5 8.7 8.7 2.5 16 2.5S29.5 8.7 29.5 16 23.3 29.3 16 29.3zm7.4-9.9c-.4-.2-2.4-1.2-2.7-1.3-.4-.1-.6-.2-.9.2s-1 1.3-1.3 1.5c-.2.2-.5.3-.9.1-.4-.2-1.7-.6-3.2-2-1.2-1.1-2-2.4-2.2-2.8-.2-.4 0-.6.2-.8.2-.2.4-.5.6-.7.2-.2.3-.4.4-.7.1-.3 0-.5 0-.7-.1-.2-.9-2.2-1.2-3-.3-.8-.7-.7-.9-.7h-.8c-.3 0-.7.1-1.1.5-.4.4-1.4 1.4-1.4 3.4s1.5 3.9 1.7 4.2c.2.3 2.9 4.5 7.1 6.3 1 .4 1.8.7 2.4.9 1 .3 1.9.3 2.6.2.8-.1 2.4-1 2.8-2 .3-1 .3-1.8.2-2-.1-.2-.4-.3-.8-.5z" />
      </svg>
      <span className="relative hidden pe-1 text-sm font-bold sm:inline">{label}</span>
    </a>
  );
}
