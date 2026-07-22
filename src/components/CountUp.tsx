"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animated number that counts up from 0 to its target the first time it scrolls
 * into view. Accepts display values like "15+", "5K+", "3K+", "98%" — the
 * numeric part is animated while any prefix/suffix (e.g. "K+", "%") is kept.
 * Respects prefers-reduced-motion (renders the final value immediately).
 */
export function CountUp({
  value,
  className,
  duration = 1700,
}: {
  value: string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  const match = value.match(/^(\D*)([\d.,]+)(.*)$/);
  const prefix = match?.[1] ?? "";
  const numToken = match?.[2] ?? "0";
  const suffix = match?.[3] ?? "";
  const target = parseFloat(numToken.replace(/,/g, "")) || 0;
  const decimals = numToken.includes(".") ? numToken.split(".")[1]?.length ?? 0 : 0;

  const [display, setDisplay] = useState(match ? "0" : value);

  useEffect(() => {
    if (!match) return;
    const el = ref.current;
    if (!el) return;

    const run = () => {
      if (started.current) return;
      started.current = true;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setDisplay(target.toFixed(decimals));
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        setDisplay((target * eased).toFixed(decimals));
        if (p < 1) requestAnimationFrame(tick);
        else setDisplay(target.toFixed(decimals));
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [match, target, decimals, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
