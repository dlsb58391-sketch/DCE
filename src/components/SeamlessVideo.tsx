"use client";

import { useEffect, useRef } from "react";

/**
 * Seamless hero video with a per-frame canvas luminance key.
 *
 * The source clip has a BLACK background. Instead of relying on an SVG
 * `filter: url(#hero-lumakey)` (ignored by iOS Safari on <video>) or a
 * `mix-blend-mode` hack (which turns into an ugly dark box on a light page),
 * we draw each frame to a canvas and set every pixel's alpha from its
 * perceptual luminance. Black → transparent, the lit 3D model stays — so the
 * model floats on the cream page background identically on desktop AND mobile.
 */
export function SeamlessVideo({
  src,
  poster,
  className,
}: {
  src: string;
  poster?: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Luminance → alpha lookup, matching the old SVG feComponentTransfer
    // tableValues "0 0 0.62 1 1" (5 points across luminance 0..1, linear
    // interpolation between them). Keeps the exact desktop look.
    const points = [0, 0, 0.62, 1, 1];
    const alphaLUT = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      const seg = (i / 255) * (points.length - 1);
      const k = Math.min(points.length - 2, Math.floor(seg));
      const f = seg - k;
      alphaLUT[i] = Math.round((points[k] + (points[k + 1] - points[k]) * f) * 255);
    }

    let raf = 0;
    let stopped = false;
    let lastTime = -1;

    const ensureSize = () => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return false;
      // Cap the internal buffer for readback performance; CSS scales it up.
      const scale = Math.min(1, 600 / vw);
      const cw = Math.max(1, Math.round(vw * scale));
      const ch = Math.max(1, Math.round(vh * scale));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        lastTime = -1; // force a redraw after a resize
      }
      return true;
    };

    const key = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.drawImage(video, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const lum = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) | 0;
        d[i + 3] = alphaLUT[lum];
      }
      ctx.putImageData(img, 0, 0);
    };

    const loop = () => {
      if (stopped) return;
      if (video.readyState >= 2 && ensureSize()) {
        // Only re-key when the frame actually advanced (idle when paused).
        if (video.currentTime !== lastTime) {
          lastTime = video.currentTime;
          try {
            key();
          } catch {
            // Same-origin readback shouldn't throw; if it does, stop keying.
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      video.play().catch(() => {
        // Autoplay blocked (e.g. iOS Low Power Mode): the loop still keys the
        // first/poster frame once, so a static model shows instead of a box.
      });
    };

    if (video.readyState >= 2) start();
    else video.addEventListener("loadeddata", start, { once: true });

    raf = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      video.removeEventListener("loadeddata", start);
    };
  }, [src]);

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden
        tabIndex={-1}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0"
      />
      <canvas ref={canvasRef} className={className} />
    </>
  );
}
