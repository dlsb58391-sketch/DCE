"use client";

import { useId, useRef, type ReactNode } from "react";
import { useLang } from "@/lib/language";
import { useModalA11y } from "@/hooks/useModalA11y";

const SIZE_CLS: Record<"md" | "lg" | "xl", string> = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Panel max-width. Defaults to `lg` (max-w-lg). */
  size?: "md" | "lg" | "xl";
}) {
  const { dir } = useLang();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useModalA11y({ open, onClose, containerRef: panelRef });

  if (!open) return null;

  return (
    <div dir={dir} className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`dash-light relative z-10 max-h-[92vh] w-full ${SIZE_CLS[size]} overflow-hidden rounded-t-2xl border border-primary/15 bg-surface text-ink shadow-2xl outline-none sm:rounded-2xl`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-primary/10 p-4">
          <h3 id={titleId} className="text-base font-bold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={dir === "rtl" ? "إغلاق" : "Close"}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-primary/10 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="custom-scroll max-h-[68vh] overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-primary/10 p-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* Shared field primitives so every form looks consistent */
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-primary/15 bg-surface-2 px-3.5 py-2.5 text-ink outline-none transition placeholder:text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20";
