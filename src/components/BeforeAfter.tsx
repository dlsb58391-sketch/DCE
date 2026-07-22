"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import { useLang } from "@/lib/language";

/** One side of the comparison. Hoisted to module scope so it isn't recreated on
 *  every render of BeforeAfter (react-hooks/static-components). */
function Pic({ src, label, alt }: { src: string; label: string; alt: string }) {
  return src.startsWith("data:") ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={`${alt} - ${label}`} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
  ) : (
    <Image
      src={src}
      alt={`${alt} - ${label}`}
      fill
      sizes="(max-width: 768px) 100vw, 50vw"
      className="object-cover"
      draggable={false}
    />
  );
}

export function BeforeAfter({
  before,
  after,
  beforeLabel,
  afterLabel,
  alt,
}: {
  before: string;
  after: string;
  beforeLabel: string;
  afterLabel: string;
  alt: string;
}) {
  const { dir } = useLang();
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let pct = ((clientX - rect.left) / rect.width) * 100;
    pct = Math.max(0, Math.min(100, pct));
    setPos(pct);
  }, []);

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setFromClientX(e.clientX);
  };
  const onUp = () => {
    dragging.current = false;
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 4));
    if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 4));
  };

  // In RTL the visual "after" (clipped) should still read naturally
  const clipStart = dir === "rtl" ? 100 - pos : pos;

  return (
    <div
      ref={ref}
      className="group relative aspect-[4/3] w-full select-none overflow-hidden rounded-2xl border border-primary/20 shadow-xl"
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    >
      {/* AFTER (base, full) */}
      <Pic src={after} label={afterLabel} alt={alt} />
      <span className="pointer-events-none absolute bottom-3 end-3 rounded-full bg-primary px-3 py-1 text-xs font-bold text-[color:var(--on-primary)]">
        {afterLabel}
      </span>

      {/* BEFORE (clipped overlay) */}
      <div
        className="absolute inset-0"
        style={{
          clipPath:
            dir === "rtl"
              ? `inset(0 0 0 ${100 - clipStart}%)`
              : `inset(0 ${100 - clipStart}% 0 0)`,
        }}
      >
        <Pic src={before} label={beforeLabel} alt={alt} />
        <span className="pointer-events-none absolute bottom-3 start-3 rounded-full bg-[#0a0e12]/80 px-3 py-1 text-xs font-bold text-white">
          {beforeLabel}
        </span>
      </div>

      {/* Handle */}
      <div
        className="absolute inset-y-0 z-10 w-0.5 bg-primary"
        style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
      >
        <button
          type="button"
          aria-label="Drag to compare before and after"
          aria-valuenow={Math.round(pos)}
          aria-valuemin={0}
          aria-valuemax={100}
          role="slider"
          tabIndex={0}
          onPointerDown={onDown}
          onKeyDown={onKey}
          className="absolute top-1/2 left-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border-2 border-primary bg-[#0a0e12]/80 text-primary shadow-lg backdrop-blur transition group-hover:scale-105"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 7l-4 5 4 5M16 7l4 5-4 5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
