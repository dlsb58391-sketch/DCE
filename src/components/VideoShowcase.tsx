"use client";

import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/language";
import { Reveal } from "./Reveal";
import { activeClinic } from "@/lib/clinics";
import type { ClinicVideo } from "@/lib/clinics/types";

const clinic = activeClinic();

const defaultClips: ClinicVideo[] = [
  { src: "/clinic/videos/case-video-1.mp4", title: { en: "Inside Our Clinic", ar: "من داخل عيادتنا" }, tag: { en: "Reel", ar: "ريـل" }, duration: "0:20", rotate: true },
  { src: "/clinic/videos/case-video-2.mp4", title: { en: "Patient Journey", ar: "رحلة المريض" }, tag: { en: "Showcase", ar: "عرض" }, duration: "0:31", orientation: "landscape", ratio: "1080 / 719" },
];

const workClips: ClinicVideo[] = clinic.videos && clinic.videos.length > 0 ? clinic.videos : defaultClips;
const clientClips: ClinicVideo[] = clinic.testimonialVideos ?? [];
const workIntro = clinic.videosIntro ?? {
  en: "A closer look at the care we provide — real moments from our clinic.",
  ar: "نظرة أقرب على رعايتنا — لحظات حقيقية من داخل عيادتنا.",
};
const clientIntro = clinic.testimonialVideosIntro ?? {
  en: "Real clients sharing their experience with our team and services.",
  ar: "عملاء حقيقيون يشاركون تجربتهم مع فريقنا وخدماتنا.",
};

export function VideoShowcase() {
  const { tr } = useLang();
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const [muted, setMuted] = useState<Record<string, boolean>>(() =>
    [...workClips, ...clientClips].reduce<Record<string, boolean>>((acc, clip) => {
      acc[clip.src] = true;
      return acc;
    }, {})
  );

  // Pause clips while off-screen to stay light on CPU; resume in view.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        });
      },
      { threshold: 0.25 }
    );
    Object.values(videoRefs.current).forEach((v) => v && obs.observe(v));
    return () => obs.disconnect();
  }, []);

  const toggleMute = (src: string) => {
    const v = videoRefs.current[src];
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    if (!next) v.play().catch(() => {});
    setMuted((m) => ({ ...m, [src]: next }));
  };

  const renderClipGrid = (clips: ClinicVideo[]) => {
    const allPortrait = clips.every((c) => c.orientation === "portrait");
    return (
      <div
        className={
          allPortrait
            ? "mx-auto mt-10 flex max-w-6xl flex-wrap justify-center gap-6 sm:gap-8"
            : "mx-auto mt-10 flex max-w-5xl flex-col gap-10"
        }
      >
        {clips.map((c, i) => {
          const isPortrait = c.orientation === "portrait";
          return (
            <Reveal
              key={c.src}
              delay={i * 90}
              as="article"
              className={`video-card group relative overflow-hidden rounded-[1.75rem] border border-primary/15 bg-[#0a0e12] shadow-2xl shadow-primary/10 transition hover:border-primary/40 ${
                isPortrait ? "w-full max-w-[20rem]" : ""
              }`}
            >
              {c.rotate ? (
                <div className="rot-frame">
                  <video
                    ref={(el) => {
                      videoRefs.current[c.src] = el;
                    }}
                    src={c.src}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="rot-video"
                  />
                </div>
              ) : (
                <div className="relative w-full" style={{ aspectRatio: isPortrait ? "9 / 16" : c.ratio }}>
                  <video
                    ref={(el) => {
                      videoRefs.current[c.src] = el;
                    }}
                    src={c.src}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </div>
              )}

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/15" />

              <span className="absolute top-4 start-4 rounded-full bg-primary px-3 py-1 text-xs font-bold text-[color:var(--on-primary)] shadow">
                {tr(c.tag)}
              </span>
              <span className="absolute top-4 end-4 rounded-full bg-black/45 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
                {c.duration}
              </span>

              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                <div>
                  <h3 className="text-lg font-bold text-white drop-shadow sm:text-xl">{tr(c.title)}</h3>
                  <p className="mt-1 text-xs font-semibold text-white/80">{tr({ en: "Tap to turn volume up", ar: "اضغط لرفع الصوت" })}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleMute(c.src)}
                  aria-label={muted[c.src] ? "Unmute" : "Mute"}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-primary hover:text-[color:var(--on-primary)]"
                >
                  {muted[c.src] ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="m23 9-6 6M17 9l6 6" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" />
                    </svg>
                  )}
                </button>
              </div>
            </Reveal>
          );
        })}
      </div>
    );
  };

  return (
    <section id="videos" className="relative overflow-hidden py-20 lg:py-28">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute start-[-6rem] top-16 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute end-[-6rem] bottom-10 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            {tr({ en: "Our Clinical Work", ar: "عملنا داخل العيادة" })}
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            {tr({ en: "Real Work Videos", ar: "فيديوهات من شغلنا الحقيقي" })}
          </h2>
          <p className="mt-4 text-lg text-muted">{tr(workIntro)}</p>
        </Reveal>

        {renderClipGrid(workClips)}

        {clientClips.length > 0 && (
          <>
            <Reveal className="mx-auto mt-20 max-w-2xl text-center">
              <span className="text-sm font-bold uppercase tracking-wider text-primary">
                {tr({ en: "Client Voices", ar: "آراء عملائنا بالفيديو" })}
              </span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
                {tr({ en: "What Our Clients Say", ar: "عملاؤنا بيتكلموا عن تجربتهم" })}
              </h2>
              <p className="mt-4 text-lg text-muted">{tr(clientIntro)}</p>
            </Reveal>
            {renderClipGrid(clientClips)}
          </>
        )}
      </div>
    </section>
  );
}
