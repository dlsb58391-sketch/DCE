"use client";

export function AnimatedName({
  text,
  className = "",
  start = 0,
  step = 0.05,
}: {
  text: string;
  className?: string;
  start?: number;
  step?: number;
}) {
  const chars = Array.from(text);
  return (
    <span className={className} aria-label={text}>
      {chars.map((ch, i) =>
        ch === " " ? (
          <span key={i} className="letter letter-space" aria-hidden>
            &nbsp;
          </span>
        ) : (
          <span
            key={i}
            aria-hidden
            className="letter"
            style={{ animationDelay: `${start + i * step}s` }}
          >
            {ch}
          </span>
        )
      )}
    </span>
  );
}
