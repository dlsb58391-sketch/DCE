"use client";

import { useEffect, useRef, useState } from "react";

export function TypingName({
  text,
  className = "",
  speed = 110,
  eraseSpeed = 55,
  startDelay = 350,
  holdFull = 1800,
  holdEmpty = 500,
  loop = true,
}: {
  text: string;
  className?: string;
  speed?: number;
  eraseSpeed?: number;
  startDelay?: number;
  holdFull?: number;
  holdEmpty?: number;
  loop?: boolean;
}) {
  const [count, setCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setCount(0);
    let i = 0;
    let phase: "typing" | "erasing" = "typing";

    const step = () => {
      if (phase === "typing") {
        i += 1;
        setCount(i);
        if (i < text.length) {
          timer.current = setTimeout(step, speed);
        } else if (loop) {
          phase = "erasing";
          timer.current = setTimeout(step, holdFull);
        }
      } else {
        i -= 1;
        setCount(i);
        if (i > 0) {
          timer.current = setTimeout(step, eraseSpeed);
        } else {
          phase = "typing";
          timer.current = setTimeout(step, holdEmpty);
        }
      }
    };

    timer.current = setTimeout(step, startDelay);
    return () => clearTimeout(timer.current);
  }, [text, speed, eraseSpeed, startDelay, holdFull, holdEmpty, loop]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{text.slice(0, count)}</span>
      <span aria-hidden className="type-caret type-caret-blink" />
    </span>
  );
}
