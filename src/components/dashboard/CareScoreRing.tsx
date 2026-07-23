"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/language";

/**
 * Patient Care Score ring — a compact rule-based health gauge for the patient
 * file header. Fetches /api/admin/patients/care-score and renders a colored
 * circular progress ring (green/amber/red) with the score and a status label.
 */

type CareScore = {
  score: number;
  label: "healthy" | "attention" | "critical";
  color: "green" | "amber" | "red";
  balance: number;
  lastVisit: string | null;
  factors: { key: string; ok: boolean; weight: number }[];
};

const RING = {
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
} as const;

const LABELS: Record<CareScore["label"], { en: string; ar: string }> = {
  healthy: { en: "File is healthy", ar: "الملف سليم" },
  attention: { en: "Needs attention", ar: "يحتاج متابعة" },
  critical: { en: "Critical", ar: "حرِج" },
};

const FACTOR_LABELS: Record<string, { en: string; ar: string }> = {
  upcoming_appointment: { en: "Upcoming appointment", ar: "موعد قادم" },
  no_outstanding_balance: { en: "Balance settled", ar: "الرصيد مسدد" },
  recent_visit: { en: "Visited in last 6 months", ar: "زيارة خلال ٦ أشهر" },
  no_unfinished_treatments: { en: "No unfinished treatments", ar: "لا علاجات معلقة" },
  phone_on_file: { en: "Phone on file", ar: "رقم هاتف مسجل" },
};

export function CareScoreRing({ patientId }: { patientId: string }) {
  const { tr } = useLang();
  const [data, setData] = useState<CareScore | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/patients/care-score?patientId=${encodeURIComponent(patientId)}`, {
          cache: "no-store",
        });
        if (res.ok && alive) setData((await res.json()) as CareScore);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [patientId]);

  if (!data) {
    return <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-primary/10" aria-hidden />;
  }

  const r = 26;
  const c = 2 * Math.PI * r;
  const stroke = RING[data.color];

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group grid place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        title={tr(LABELS[data.label])}
        aria-label={`${tr({ en: "Care score", ar: "مؤشر الرعاية" })}: ${data.score}`}
      >
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" className="text-primary/12" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - data.score / 100)}
          />
          <text x="32" y="32" transform="rotate(90 32 32)" textAnchor="middle" dominantBaseline="central" className="fill-ink text-[16px] font-extrabold">
            {data.score}
          </text>
        </svg>
      </button>
      <p className="mt-0.5 text-center text-[10px] font-bold" style={{ color: stroke }}>
        {tr(LABELS[data.label])}
      </p>

      {open && (
        <div className="absolute top-full z-20 mt-1 w-56 -translate-x-1/2 start-1/2 rounded-xl border border-primary/15 bg-surface p-3 shadow-xl">
          <p className="mb-2 text-xs font-bold text-ink">{tr({ en: "Care score factors", ar: "عوامل مؤشر الرعاية" })}</p>
          <ul className="space-y-1">
            {data.factors.map((f) => (
              <li key={f.key} className="flex items-center gap-2 text-[11px]">
                <span className={`grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold ${f.ok ? "bg-emerald-500/15 text-emerald-700" : "bg-rose-500/15 text-rose-600"}`}>
                  {f.ok ? "✓" : "×"}
                </span>
                <span className={f.ok ? "text-ink" : "text-muted"}>
                  {tr(FACTOR_LABELS[f.key] ?? { en: f.key, ar: f.key })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
