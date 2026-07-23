"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/language";

type CheckStatus = "ok" | "warn" | "fail";

type DiagnosticCheck = { name: string; status: CheckStatus; detail: string };

type Diagnostics = {
  status: CheckStatus;
  checkedAt: string;
  uptimeSec: number;
  version: { commit: string | null; env: string | null };
  counts: { users: number; patients: number; appointments: number };
  lastAuditAt: string | null;
  checks: DiagnosticCheck[];
};

const STATUS_STYLE: Record<CheckStatus, string> = {
  ok: "bg-emerald-500/10 text-emerald-600",
  warn: "bg-amber-500/10 text-amber-600",
  fail: "bg-red-500/10 text-red-600",
};

function statusLabel(s: CheckStatus, tr: (m: { en: string; ar: string }) => string): string {
  switch (s) {
    case "ok":
      return tr({ en: "Healthy", ar: "سليم" });
    case "warn":
      return tr({ en: "Warning", ar: "تحذير" });
    case "fail":
      return tr({ en: "Failing", ar: "خلل" });
  }
}

function checkLabel(name: string, tr: (m: { en: string; ar: string }) => string): string {
  switch (name) {
    case "database":
      return tr({ en: "Database", ar: "قاعدة البيانات" });
    case "scheduler":
      return tr({ en: "Scheduler", ar: "المجدول" });
    case "memory":
      return tr({ en: "Memory", ar: "الذاكرة" });
    default:
      return name;
  }
}

function formatUptime(sec: number, tr: (m: { en: string; ar: string }) => string): string {
  if (!Number.isFinite(sec) || sec < 0) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}${tr({ en: "d", ar: "ي" })}`);
  if (h) parts.push(`${h}${tr({ en: "h", ar: "س" })}`);
  parts.push(`${m}${tr({ en: "m", ar: "د" })}`);
  return parts.join(" ");
}

export function DiagnosticsPanel() {
  const { tr, lang } = useLang();
  const [data, setData] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoading(true);
      setError(false);
      try {
        // The endpoint returns 503 with a JSON body when the verdict is "fail" —
        // that is still a valid payload we want to render, so we parse regardless.
        const res = await fetch("/api/admin/diagnostics", { cache: "no-store" });
        if (res.status === 401 || res.status === 403) {
          if (alive) setForbidden(true);
          return;
        }
        const j = await res.json().catch(() => null);
        if (!alive) return;
        if (j && typeof j.status === "string") {
          setData(j as Diagnostics);
        } else {
          setError(true);
        }
      } catch {
        if (alive) setError(true);
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const fmtTime = useCallback(
    (iso: string | null) => {
      if (!iso) return tr({ en: "never", ar: "أبدًا" });
      try {
        return new Date(iso).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      } catch {
        return iso;
      }
    },
    [lang, tr],
  );

  if (forbidden) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4">
        <div className="rounded-xl border border-primary/10 bg-surface p-10 text-center text-ink/60">
          {tr({ en: "Only an owner can view system diagnostics.", ar: "يمكن للمالك فقط عرض تشخيص النظام." })}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{tr({ en: "System diagnostics", ar: "تشخيص النظام" })}</h1>
          <p className="text-sm text-ink/60">
            {tr({
              en: "Live operational health — database, scheduler, memory, and build.",
              ar: "الحالة التشغيلية الحية — قاعدة البيانات والمجدول والذاكرة والإصدار.",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <span className={"rounded-full px-3 py-1 text-sm font-medium " + STATUS_STYLE[data.status]}>
              {statusLabel(data.status, tr)}
            </span>
          )}
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="rounded-lg border border-primary/20 px-4 py-2 text-sm text-ink hover:bg-primary/5 disabled:opacity-50"
          >
            {loading ? tr({ en: "Refreshing…", ar: "جارٍ التحديث…" }) : tr({ en: "Refresh", ar: "تحديث" })}
          </button>
        </div>
      </header>

      {error && !data && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {tr({ en: "Could not load diagnostics.", ar: "تعذر تحميل التشخيص." })}
        </div>
      )}

      {loading && !data ? (
        <p className="py-10 text-center text-ink/50">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</p>
      ) : data ? (
        <>
          {/* Checks */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.checks.map((c) => (
              <div key={c.name} className="rounded-xl border border-primary/10 bg-surface p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{checkLabel(c.name, tr)}</span>
                  <span className={"rounded px-2 py-0.5 text-xs font-medium " + STATUS_STYLE[c.status]}>
                    {statusLabel(c.status, tr)}
                  </span>
                </div>
                <p dir="ltr" className="mt-2 text-start text-xs text-ink/60">
                  {c.detail}
                </p>
              </div>
            ))}
          </div>

          {/* Counts */}
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { k: "users", label: tr({ en: "Users", ar: "المستخدمون" }) },
                { k: "patients", label: tr({ en: "Patients", ar: "المرضى" }) },
                { k: "appointments", label: tr({ en: "Appointments", ar: "المواعيد" }) },
              ] as const
            ).map((row) => (
              <div key={row.k} className="rounded-xl border border-primary/10 bg-surface p-4 text-center">
                <div className="text-2xl font-semibold text-ink">{data.counts[row.k].toLocaleString()}</div>
                <div className="text-xs text-ink/60">{row.label}</div>
              </div>
            ))}
          </div>

          {/* Meta */}
          <div className="rounded-xl border border-primary/10 bg-surface p-4 text-sm">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <div className="flex justify-between gap-4">
                <dt className="text-ink/60">{tr({ en: "Checked at", ar: "وقت الفحص" })}</dt>
                <dd className="text-ink">{fmtTime(data.checkedAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/60">{tr({ en: "Uptime", ar: "مدة التشغيل" })}</dt>
                <dd className="text-ink">{formatUptime(data.uptimeSec, tr)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/60">{tr({ en: "Last audit entry", ar: "آخر سجل تدقيق" })}</dt>
                <dd className="text-ink">{fmtTime(data.lastAuditAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/60">{tr({ en: "Environment", ar: "البيئة" })}</dt>
                <dd className="text-ink" dir="ltr">
                  {data.version.env || "—"}
                  {data.version.commit ? ` · ${data.version.commit.slice(0, 12)}` : ""}
                </dd>
              </div>
            </dl>
          </div>
        </>
      ) : null}
    </div>
  );
}
