"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { useConfirm } from "@/components/ui/ConfirmDialog";

type MfaStatus = {
  enabled: boolean;
  pending: boolean;
  enrolledAt: string | null;
  backupCodesRemaining: number;
};

type LoginEvent = {
  id: string;
  userId: string | null;
  email: string | null;
  success: boolean;
  reason: string | null;
  mfaUsed: boolean;
  ip: string | null;
  device: string | null;
  createdAt: string;
};

type EnrollData = { secret: string; otpauthUrl: string; qrDataUrl: string | null };

const inputCls =
  "w-full rounded-lg border border-primary/15 bg-surface px-3 py-2 text-ink outline-none focus:border-primary";
const btnPrimary = "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const btnGhost = "rounded-lg border border-primary/20 px-4 py-2 text-sm text-ink hover:bg-primary/5 disabled:opacity-50";
const btnDanger =
  "rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-600 hover:bg-red-500/5 disabled:opacity-50";

function reasonLabel(reason: string | null, tr: (m: { en: string; ar: string }) => string): string {
  switch (reason) {
    case "ok":
      return tr({ en: "Signed in", ar: "تسجيل دخول" });
    case "mfa_ok":
      return tr({ en: "Signed in (2FA)", ar: "تسجيل دخول (تحقق ثنائي)" });
    case "mfa_required":
      return tr({ en: "2FA prompted", ar: "طُلب التحقق الثنائي" });
    case "mfa_failed":
      return tr({ en: "2FA failed", ar: "فشل التحقق الثنائي" });
    case "invalid_credentials":
      return tr({ en: "Wrong credentials", ar: "بيانات خاطئة" });
    case "rate_limited":
      return tr({ en: "Rate limited", ar: "تم التقييد" });
    default:
      return reason || tr({ en: "—", ar: "—" });
  }
}

/** Group a base32 secret into 4-char blocks for easier manual entry. */
function groupSecret(s: string): string {
  return (s.match(/.{1,4}/g) ?? [s]).join(" ");
}

export function SecurityManager() {
  const { tr, lang } = useLang();
  const confirm = useConfirm();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [scope, setScope] = useState<"self" | "all">("self");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  // Enrollment / disable flow state.
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [code, setCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [showDisable, setShowDisable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [freshCodes, setFreshCodes] = useState<string[] | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoading(true);
      try {
        const [mfaRes, histRes] = await Promise.all([
          fetch("/api/admin/mfa", { cache: "no-store" }),
          fetch("/api/admin/login-history?limit=50", { cache: "no-store" }),
        ]);
        if (alive && mfaRes.ok) setStatus((await mfaRes.json()) as MfaStatus);
        if (alive && histRes.ok) {
          const j = await histRes.json();
          setEvents((j.events ?? []) as LoginEvent[]);
          setScope(j.scope === "all" ? "all" : "self");
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const beginEnroll = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    setFreshCodes(null);
    try {
      const res = await fetch("/api/admin/mfa", { method: "POST" });
      const j = await res.json().catch(() => null);
      if (res.ok) {
        setEnroll(j as EnrollData);
        setCode("");
      } else {
        setNotice({ kind: "error", text: j?.error?.message || tr({ en: "Could not start setup.", ar: "تعذر بدء الإعداد." }) });
      }
    } finally {
      setBusy(false);
    }
  }, [tr]);

  const confirmEnroll = useCallback(async () => {
    if (code.trim().length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/mfa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok) {
        setEnroll(null);
        setCode("");
        setFreshCodes((j?.backupCodes ?? []) as string[]);
        setNotice({ kind: "ok", text: tr({ en: "Two-factor authentication is on.", ar: "تم تفعيل التحقق الثنائي." }) });
        reload();
      } else {
        setNotice({ kind: "error", text: j?.error?.message || tr({ en: "That code is not valid.", ar: "الرمز غير صحيح." }) });
      }
    } finally {
      setBusy(false);
    }
  }, [code, reload, tr]);

  const cancelEnroll = useCallback(() => {
    setEnroll(null);
    setCode("");
  }, []);

  const disable = useCallback(async () => {
    if (disableCode.trim().length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/mfa", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode.trim() }),
      });
      const j = await res.json().catch(() => null);
      if (res.ok) {
        setShowDisable(false);
        setDisableCode("");
        setFreshCodes(null);
        setNotice({ kind: "ok", text: tr({ en: "Two-factor authentication is off.", ar: "تم إيقاف التحقق الثنائي." }) });
        reload();
      } else {
        setNotice({ kind: "error", text: j?.error?.message || tr({ en: "That code is not valid.", ar: "الرمز غير صحيح." }) });
      }
    } finally {
      setBusy(false);
    }
  }, [disableCode, reload, tr]);

  const regenerate = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/mfa/backup-codes", { method: "POST" });
      const j = await res.json().catch(() => null);
      if (res.ok) {
        setFreshCodes((j?.backupCodes ?? []) as string[]);
        setNotice({ kind: "ok", text: tr({ en: "New backup codes generated.", ar: "تم إنشاء رموز احتياطية جديدة." }) });
        reload();
      } else {
        setNotice({ kind: "error", text: j?.error?.message || tr({ en: "Could not regenerate codes.", ar: "تعذر إنشاء الرموز." }) });
      }
    } finally {
      setBusy(false);
    }
  }, [reload, tr]);

  const signOutEverywhere = useCallback(async () => {
    const msg = tr({
      en: "Sign out of all devices? You will need to sign in again.",
      ar: "تسجيل الخروج من كل الأجهزة؟ ستحتاج لتسجيل الدخول مرة أخرى.",
    });
    if (!(await confirm({ message: msg, tone: "danger", confirmLabel: tr({ en: "Sign out", ar: "تسجيل الخروج" }) }))) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/sessions", { method: "DELETE" });
      if (res.ok) {
        window.location.href = "/login";
      } else {
        setNotice({ kind: "error", text: tr({ en: "Could not sign out everywhere.", ar: "تعذر تسجيل الخروج." }) });
        setBusy(false);
      }
    } catch {
      setBusy(false);
    }
  }, [confirm, tr]);

  const fmtTime = useCallback(
    (iso: string) => {
      try {
        return new Date(iso).toLocaleString(lang === "ar" ? "ar-EG" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
        });
      } catch {
        return iso;
      }
    },
    [lang],
  );

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4">
      <header>
        <h1 className="text-xl font-semibold text-ink">{tr({ en: "Security", ar: "الأمان" })}</h1>
        <p className="text-sm text-ink/60">
          {tr({
            en: "Protect your account with two-factor authentication and review recent sign-ins.",
            ar: "احمِ حسابك بالتحقق الثنائي وراجع عمليات الدخول الأخيرة.",
          })}
        </p>
      </header>

      {notice && (
        <div
          role="status"
          className={
            "rounded-lg px-3 py-2 text-sm " +
            (notice.kind === "error" ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-600")
          }
        >
          {notice.text}
        </div>
      )}

      {/* One-time backup codes display (after enroll or regenerate). */}
      {freshCodes && freshCodes.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="mb-1 text-sm font-semibold text-ink">
            {tr({ en: "Save your backup codes", ar: "احفظ الرموز الاحتياطية" })}
          </h2>
          <p className="mb-3 text-xs text-ink/60">
            {tr({
              en: "Each code works once if you lose your authenticator. They will not be shown again.",
              ar: "كل رمز يُستخدم مرة واحدة إذا فقدت تطبيق المصادقة. لن تظهر مرة أخرى.",
            })}
          </p>
          <div dir="ltr" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {freshCodes.map((c) => (
              <code key={c} className="rounded-md bg-surface px-3 py-1.5 text-center font-mono text-sm text-ink">
                {c}
              </code>
            ))}
          </div>
          <button type="button" onClick={() => setFreshCodes(null)} className={"mt-3 " + btnGhost}>
            {tr({ en: "I saved them", ar: "لقد حفظتها" })}
          </button>
        </div>
      )}

      {/* Two-factor section. */}
      <section className="rounded-xl border border-primary/10 bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              {tr({ en: "Two-factor authentication (2FA)", ar: "التحقق الثنائي (2FA)" })}
            </h2>
            <p className="text-xs text-ink/60">
              {loading
                ? tr({ en: "Loading…", ar: "جارٍ التحميل…" })
                : status?.enabled
                  ? tr({ en: "On — a code is required at each sign-in.", ar: "مفعّل — يُطلب رمز عند كل تسجيل دخول." })
                  : tr({ en: "Off — your account is protected by password only.", ar: "غير مفعّل — حسابك محمي بكلمة المرور فقط." })}
            </p>
          </div>
          {!loading && status && (
            <span
              className={
                "rounded-full px-2.5 py-0.5 text-xs font-medium " +
                (status.enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-ink/10 text-ink/60")
              }
            >
              {status.enabled ? tr({ en: "Enabled", ar: "مفعّل" }) : tr({ en: "Disabled", ar: "غير مفعّل" })}
            </span>
          )}
        </div>

        {!loading && status && (
          <div className="mt-4">
            {/* Enabled state: manage. */}
            {status.enabled && !showDisable && (
              <div className="space-y-3">
                <p className="text-xs text-ink/60">
                  {tr({ en: "Backup codes remaining:", ar: "الرموز الاحتياطية المتبقية:" })}{" "}
                  <strong className="text-ink">{status.backupCodesRemaining}</strong>
                  {status.enrolledAt && (
                    <>
                      {" · "}
                      {tr({ en: "Enabled", ar: "مُفعّل منذ" })} {fmtTime(status.enrolledAt)}
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy} onClick={regenerate} className={btnGhost}>
                    {tr({ en: "Regenerate backup codes", ar: "إنشاء رموز احتياطية جديدة" })}
                  </button>
                  <button type="button" disabled={busy} onClick={() => setShowDisable(true)} className={btnDanger}>
                    {tr({ en: "Disable 2FA", ar: "إيقاف التحقق الثنائي" })}
                  </button>
                </div>
              </div>
            )}

            {/* Disable confirmation (requires a code). */}
            {status.enabled && showDisable && (
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-ink/70">
                    {tr({ en: "Enter a current code or backup code to disable", ar: "أدخل رمزًا حاليًا أو رمزًا احتياطيًا للإيقاف" })}
                  </span>
                  <input
                    className={inputCls + " max-w-xs"}
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    dir="ltr"
                    placeholder="123456"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={busy || !disableCode.trim()} onClick={disable} className={btnDanger}>
                    {busy ? tr({ en: "Working…", ar: "جارٍ…" }) : tr({ en: "Confirm disable", ar: "تأكيد الإيقاف" })}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setShowDisable(false);
                      setDisableCode("");
                    }}
                    className={btnGhost}
                  >
                    {tr({ en: "Cancel", ar: "إلغاء" })}
                  </button>
                </div>
              </div>
            )}

            {/* Disabled state: enroll. */}
            {!status.enabled && !enroll && (
              <button type="button" disabled={busy} onClick={beginEnroll} className={btnPrimary}>
                {busy ? tr({ en: "Working…", ar: "جارٍ…" }) : tr({ en: "Enable 2FA", ar: "تفعيل التحقق الثنائي" })}
              </button>
            )}

            {/* Enrollment: scan + confirm. */}
            {!status.enabled && enroll && (
              <div className="space-y-4">
                <ol className="list-decimal space-y-3 ps-5 text-sm text-ink/80">
                  <li>
                    {tr({
                      en: "Scan this QR in an authenticator app (Google Authenticator, Authy, 1Password…).",
                      ar: "امسح رمز QR في تطبيق مصادقة (Google Authenticator أو Authy أو 1Password…).",
                    })}
                    <div className="mt-2 flex flex-col items-start gap-2">
                      {enroll.qrDataUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={enroll.qrDataUrl}
                          alt={tr({ en: "2FA QR code", ar: "رمز QR للتحقق الثنائي" })}
                          width={200}
                          height={200}
                          className="rounded-lg border border-primary/10 bg-white p-2"
                        />
                      ) : null}
                      <div className="text-xs text-ink/60">
                        {tr({ en: "Or enter this key manually:", ar: "أو أدخل هذا المفتاح يدويًا:" })}
                        <code dir="ltr" className="ms-1 select-all rounded bg-primary/5 px-1.5 py-0.5 font-mono text-ink">
                          {groupSecret(enroll.secret)}
                        </code>
                      </div>
                    </div>
                  </li>
                  <li>
                    {tr({ en: "Enter the 6-digit code it shows:", ar: "أدخل الرمز المكوّن من 6 أرقام:" })}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <input
                        className={inputCls + " max-w-[10rem]"}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        dir="ltr"
                        placeholder="123456"
                      />
                      <button type="button" disabled={busy || !code.trim()} onClick={confirmEnroll} className={btnPrimary}>
                        {busy ? tr({ en: "Verifying…", ar: "جارٍ التحقق…" }) : tr({ en: "Verify & enable", ar: "تحقق وتفعيل" })}
                      </button>
                      <button type="button" disabled={busy} onClick={cancelEnroll} className={btnGhost}>
                        {tr({ en: "Cancel", ar: "إلغاء" })}
                      </button>
                    </div>
                  </li>
                </ol>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Recent logins & devices. */}
      <section className="rounded-xl border border-primary/10 bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              {tr({ en: "Recent sign-ins & devices", ar: "عمليات الدخول والأجهزة الأخيرة" })}
            </h2>
            <p className="text-xs text-ink/60">
              {scope === "all"
                ? tr({ en: "All accounts (admin view).", ar: "كل الحسابات (عرض المدير)." })
                : tr({ en: "Your recent activity.", ar: "نشاطك الأخير." })}
            </p>
          </div>
          <button type="button" disabled={busy} onClick={signOutEverywhere} className={btnDanger}>
            {tr({ en: "Sign out all devices", ar: "تسجيل الخروج من كل الأجهزة" })}
          </button>
        </div>

        {loading ? (
          <p className="py-6 text-center text-ink/50">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</p>
        ) : events.length === 0 ? (
          <p className="py-6 text-center text-ink/50">{tr({ en: "No sign-in activity yet.", ar: "لا يوجد نشاط دخول بعد." })}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-primary/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary/10 text-ink/60">
                  <th className="px-3 py-2 text-start font-medium">{tr({ en: "When", ar: "الوقت" })}</th>
                  <th className="px-3 py-2 text-start font-medium">{tr({ en: "Result", ar: "النتيجة" })}</th>
                  {scope === "all" && (
                    <th className="px-3 py-2 text-start font-medium">{tr({ en: "Account", ar: "الحساب" })}</th>
                  )}
                  <th className="px-3 py-2 text-start font-medium">{tr({ en: "Device", ar: "الجهاز" })}</th>
                  <th className="px-3 py-2 text-start font-medium">{tr({ en: "IP", ar: "IP" })}</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-b border-primary/5 last:border-0">
                    <td className="whitespace-nowrap px-3 py-2 text-ink/80">{fmtTime(e.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          "rounded px-2 py-0.5 text-xs " +
                          (e.success ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")
                        }
                      >
                        {reasonLabel(e.reason, tr)}
                      </span>
                      {e.mfaUsed && (
                        <span className="ms-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">2FA</span>
                      )}
                    </td>
                    {scope === "all" && (
                      <td className="px-3 py-2 text-ink/70" dir="ltr">
                        {e.email || tr({ en: "unknown", ar: "غير معروف" })}
                      </td>
                    )}
                    <td className="px-3 py-2 text-ink/70">{e.device || tr({ en: "—", ar: "—" })}</td>
                    <td className="px-3 py-2 text-ink/60" dir="ltr">
                      {e.ip || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
