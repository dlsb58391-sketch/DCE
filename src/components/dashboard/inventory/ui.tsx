"use client";

import type { ReactNode } from "react";
import { useLang } from "@/lib/language";
import type { MovementType } from "./types";

// Reuse the app's shared modal + form primitives so inventory matches the rest
// of the dashboard exactly (DRY — see components/dashboard/Modal.tsx).
export { Modal, Field, inputCls } from "@/components/dashboard/Modal";

type Bi = { en: string; ar: string };

/** Locale-aware number/date formatters bound to the active language. */
export function useFmt() {
  const { lang } = useLang();
  const locale = lang === "ar" ? "ar-EG" : "en-GB";
  return {
    money: (n: number) => n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    qty: (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 3 }),
    date: (iso: string | null) => {
      if (!iso) return "—";
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(locale);
    },
    dateTime: (iso: string | null) => {
      if (!iso) return "—";
      const d = new Date(iso);
      return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString(locale);
    },
  };
}

export const MOVEMENT_LABEL: Record<MovementType, Bi> = {
  receipt: { en: "Receipt", ar: "استلام" },
  consumption: { en: "Consumption", ar: "استهلاك" },
  wastage: { en: "Wastage", ar: "هدر" },
  adjustment: { en: "Adjustment", ar: "تسوية" },
  transfer: { en: "Transfer", ar: "تحويل" },
  return: { en: "Return", ar: "مرتجع" },
};

export const PO_STATUS_LABEL: Record<import("./types").PoStatus, Bi> = {
  draft: { en: "Draft", ar: "مسودة" },
  submitted: { en: "Submitted", ar: "مُرسل" },
  partially_received: { en: "Partially received", ar: "مستلم جزئياً" },
  received: { en: "Received", ar: "مستلم" },
  cancelled: { en: "Cancelled", ar: "ملغى" },
};

export function poStatusTone(s: import("./types").PoStatus): "muted" | "warn" | "danger" | "ok" {
  if (s === "received") return "ok";
  if (s === "partially_received") return "warn";
  if (s === "cancelled") return "danger";
  return "muted";
}

export const UNIT_OPTIONS = ["piece", "box", "pack", "bottle", "tube", "ml", "g", "kg", "pair", "set"];

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-3 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50";
export const btnGhost =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-primary/20 px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface disabled:opacity-50";
export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50";

export function Badge({ tone = "muted", children }: { tone?: "muted" | "warn" | "danger" | "ok"; children: ReactNode }) {
  const cls =
    tone === "danger"
      ? "border-red-500/30 bg-red-500/10 text-red-600"
      : tone === "warn"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-600"
        : tone === "ok"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
          : "border-primary/20 bg-primary/10 text-primary";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function Hint({ children }: { children: ReactNode }) {
  return <span className="mt-1 block text-[11px] text-muted/80">{children}</span>;
}
