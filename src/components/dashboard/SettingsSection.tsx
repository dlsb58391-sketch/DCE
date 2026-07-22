"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { ClinicExpensesCard } from "./ClinicExpensesCard";

type Config = { enabled: boolean; delaySeconds: number };
type Unit = "seconds" | "minutes" | "hours" | "days";

const UNIT_SECONDS: Record<Unit, number> = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
};

const PRESETS: { label: { en: string; ar: string }; seconds: number }[] = [
  { label: { en: "30 sec (test)", ar: "٣٠ ثانية (تجربة)" }, seconds: 30 },
  { label: { en: "6 hours", ar: "٦ ساعات" }, seconds: 6 * 3600 },
  { label: { en: "12 hours", ar: "١٢ ساعة" }, seconds: 12 * 3600 },
  { label: { en: "1 day", ar: "يوم" }, seconds: 24 * 3600 },
  { label: { en: "2 days", ar: "يومين" }, seconds: 2 * 24 * 3600 },
  { label: { en: "3 days", ar: "٣ أيام" }, seconds: 3 * 24 * 3600 },
  { label: { en: "1 week", ar: "أسبوع" }, seconds: 7 * 24 * 3600 },
];

/** Pick the largest clean unit to display a delay in seconds. */
function splitDelay(seconds: number): { value: number; unit: Unit } {
  if (seconds % 86400 === 0 && seconds >= 86400) return { value: seconds / 86400, unit: "days" };
  if (seconds % 3600 === 0 && seconds >= 3600) return { value: seconds / 3600, unit: "hours" };
  if (seconds % 60 === 0 && seconds >= 60) return { value: seconds / 60, unit: "minutes" };
  return { value: Math.max(1, seconds), unit: "seconds" };
}

export function SettingsSection() {
  const { tr } = useLang();
  const [enabled, setEnabled] = useState(true);
  const [value, setValue] = useState(2);
  const [unit, setUnit] = useState<Unit>("days");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings/followup", { cache: "no-store" });
      if (res.ok) {
        const { config } = (await res.json()) as { config: Config };
        setEnabled(config.enabled);
        const s = splitDelay(config.delaySeconds);
        setValue(s.value);
        setUnit(s.unit);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currentSeconds = value * UNIT_SECONDS[unit];

  const save = async (override?: Partial<Config>) => {
    setSaving(true);
    try {
      const payload: Config = {
        enabled: override?.enabled ?? enabled,
        delaySeconds: override?.delaySeconds ?? currentSeconds,
      };
      const res = await fetch("/api/admin/settings/followup", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const { config } = (await res.json()) as { config: Config };
        setEnabled(config.enabled);
        const s = splitDelay(config.delaySeconds);
        setValue(s.value);
        setUnit(s.unit);
        setSavedAt(Date.now());
      }
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (seconds: number) => {
    const s = splitDelay(seconds);
    setValue(s.value);
    setUnit(s.unit);
    save({ delaySeconds: seconds });
  };

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-ink">
          {tr({ en: "Settings", ar: "الإعدادات" })}
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          {tr({ en: "Automatic patient messages & clinic preferences.", ar: "الرسائل التلقائية للمرضى وتفضيلات العيادة." })}
        </p>
      </div>

      {/* Post-session follow-up card */}
      <div className="rounded-2xl border border-primary/12 bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
                <path d="M8 10h.01M12 10h.01M16 10h.01" />
              </svg>
            </span>
            <div>
              <h3 className="font-bold text-ink">
                {tr({ en: "Post-session follow-up", ar: "متابعة بعد الجلسة" })}
              </h3>
              <p className="mt-0.5 text-sm text-muted">
                {tr({
                  en: "Automatically message each patient after their session to check how they feel. Replies appear in Client Messages.",
                  ar: "إرسال رسالة تلقائية لكل مريض بعد الجلسة للاطمئنان عليه. تظهر ردوده في رسائل العملاء.",
                })}
              </p>
            </div>
          </div>

          {/* on/off toggle */}
          <button
            onClick={() => {
              const next = !enabled;
              setEnabled(next);
              save({ enabled: next });
            }}
            disabled={saving}
            role="switch"
            aria-checked={enabled}
            className={`relative h-7 w-12 shrink-0 rounded-full transition ${enabled ? "bg-primary" : "bg-muted/30"}`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? "start-6" : "start-1"}`}
            />
          </button>
        </div>

        <div className={`mt-5 space-y-4 transition ${enabled ? "" : "pointer-events-none opacity-50"}`}>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink">
              {tr({ en: "Send the message after", ar: "إرسال الرسالة بعد" })}
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={1}
                value={value}
                onChange={(e) => setValue(Math.max(1, parseInt(e.target.value || "1", 10)))}
                className="w-24 rounded-lg border border-primary/15 bg-background px-3 py-2 text-ink outline-none focus:border-primary"
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="rounded-lg border border-primary/15 bg-background px-3 py-2 text-ink outline-none focus:border-primary"
              >
                <option value="seconds">{tr({ en: "seconds", ar: "ثانية" })}</option>
                <option value="minutes">{tr({ en: "minutes", ar: "دقيقة" })}</option>
                <option value="hours">{tr({ en: "hours", ar: "ساعة" })}</option>
                <option value="days">{tr({ en: "days", ar: "يوم" })}</option>
              </select>
              <span className="text-sm text-muted">{tr({ en: "after the session ends", ar: "من انتهاء الجلسة" })}</span>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {tr({ en: "Quick presets", ar: "اختيارات سريعة" })}
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const active = currentSeconds === p.seconds;
                return (
                  <button
                    key={p.seconds}
                    onClick={() => applyPreset(p.seconds)}
                    disabled={saving}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-primary/15 text-muted hover:border-primary/40 hover:text-ink"
                    }`}
                  >
                    {tr(p.label)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => save()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-4 py-2 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {saving ? tr({ en: "Saving…", ar: "جارٍ الحفظ…" }) : tr({ en: "Save", ar: "حفظ" })}
            </button>
            {savedAt && !saving && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                {tr({ en: "Saved", ar: "تم الحفظ" })}
              </span>
            )}
          </div>
        </div>
      </div>

      <ClinicExpensesCard />
    </div>
  );
}
