"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";

type ImgSpec = { src: string; alt: string };

/**
 * Drag-to-compare before/after image slider. The "after" image is the base
 * layer; the "before" image sits on top and is clipped to the handle position,
 * so dragging the handle wipes between them. Works with mouse, touch and
 * keyboard (arrow keys), and is RTL-safe (handle uses physical positioning so
 * "before" is always on the left, "after" on the right).
 */
export function BeforeAfterSlider({
  before,
  after,
  beforeLabel,
  afterLabel,
  aspectClass = "aspect-[16/10]",
}: {
  before: ImgSpec;
  after: ImgSpec;
  beforeLabel: string;
  afterLabel: string;
  aspectClass?: string;
}) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    containerRef.current?.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) setFromClientX(e.clientX);
  };
  const endDrag = () => {
    dragging.current = false;
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      setPos((p) => Math.max(0, p - 3));
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      setPos((p) => Math.min(100, p + 3));
      e.preventDefault();
    } else if (e.key === "Home") {
      setPos(0);
      e.preventDefault();
    } else if (e.key === "End") {
      setPos(100);
      e.preventDefault();
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      className={`group relative ${aspectClass} w-full select-none overflow-hidden rounded-2xl border border-primary/15 bg-[#0a0e12] shadow-sm touch-none cursor-ew-resize`}
    >
      {/* after (base layer) */}
      <Image
        src={after.src}
        alt={after.alt}
        fill
        sizes="(max-width: 1024px) 100vw, 50vw"
        className="object-cover"
        draggable={false}
      />
      {/* before (clipped to the handle position) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <Image
          src={before.src}
          alt={before.alt}
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
          draggable={false}
        />
      </div>

      {/* labels */}
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[color:var(--on-primary)]">
        {afterLabel}
      </span>

      {/* handle */}
      <div className="pointer-events-none absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -translate-x-1/2 w-0.5 bg-white/90 shadow-[0_0_10px_rgba(0,0,0,0.4)]" />
        <button
          type="button"
          role="slider"
          aria-label={`${beforeLabel} / ${afterLabel}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          onKeyDown={onKeyDown}
          className="pointer-events-auto absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary/30 bg-white text-primary shadow-lg outline-none transition group-hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 7 4 12l5 5M15 7l5 5-5 5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
