"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { formatMoney } from "@/lib/patients";

type Debtor = {
  patientId: string;
  name: string;
  phone: string;
  billed: number;
  paid: number;
  balance: number;
  lastVisit: string | null;
  lastRemindedAt: string | null;
};
type RecallRow = {
  patientId: string;
  name: string;
  phone: string;
  lastVisit: string;
  monthsSince: number;
  lastRecalledAt: string | null;
};

const MONTHS = [3, 6, 12];

function Avatar({ name }: { name: string }) {
  const ch = (name || "?").trim().charAt(0).toUpperCase();
  return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">{ch}</span>;
}

export function RemindersSection() {
  const { tr, lang } = useLang();
  const [tab, setTab] = useState<"payments" | "recall">("payments");
  const [months, setMonths] = useState(6);

  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [recall, setRecall] = useState<RecallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowTs, setNowTs] = useState(0);
  const [sending, setSending] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (tab === "payments") {
          const res = await fetch("/api/admin/receivables", { cache: "no-store" });
          if (res.ok && alive) {
            const j = await res.json();
            setDebtors(j.receivables ?? []);
            setTotalOutstanding(j.totalOutstanding ?? 0);
          }
        } else {
          const res = await fetch(`/api/admin/recall?months=${months}`, { cache: "no-store" });
          if (res.ok && alive) {
            const j = await res.json();
            setRecall(j.recall ?? []);
          }
        }
      } finally {
        if (alive) {
          setNowTs(Date.now());
          setLoading(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [tab, months]);

  const fmtDate = (iso: string | null) => {
    if (!iso) return tr({ en: "never", ar: "لا يوجد" });
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
  };
  const ago = (iso: string | null) => {
    if (!iso) return null;
    const days = Math.max(0, Math.round((nowTs - new Date(iso).getTime()) / 86400000));
    if (days === 0) return tr({ en: "today", ar: "اليوم" });
    if (days === 1) return tr({ en: "yesterday", ar: "أمس" });
    return tr({ en: `${days}d ago`, ar: `منذ ${days} يوم` });
  };

  const send = async (row: { phone: string; name: string }, type: "payment" | "recall", balance?: number) => {
    setSending((s) => ({ ...s, [row.phone]: true }));
    try {
      const res = await fetch("/api/admin/reminders/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: row.phone, name: row.name, type, balance }),
      });
      if (res.ok) {
        const nowIso = new Date().toISOString();
        if (type === "payment") setDebtors((prev) => prev.map((d) => (d.phone === row.phone ? { ...d, lastRemindedAt: nowIso } : d)));
        else setRecall((prev) => prev.map((d) => (d.phone === row.phone ? { ...d, lastRecalledAt: nowIso } : d)));
      }
    } finally {
      setSending((s) => ({ ...s, [row.phone]: false }));
    }
  };

  const WaButton = ({ onClick, busy, label }: { onClick: () => void; busy: boolean; label: string }) => (
    <button
      onClick={onClick}
      disabled={busy}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Z" /></svg>
      {busy ? tr({ en: "Sending…", ar: "جارٍ الإرسال…" }) : label}
    </button>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-ink lg:text-2xl">
          {tr({ en: "Reminders", ar: "التذكيرات" })}
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          {tr({ en: "Chase unpaid balances and win back patients — over WhatsApp.", ar: "حصّل المبالغ المتبقّية واستعد المرضى — عبر واتساب." })}
        </p>
      </div>

      {/* tabs */}
      <div className="flex gap-2">
        {([
          { id: "payments", label: { en: "Payments due", ar: "مبالغ متبقّية" } },
          { id: "recall", label: { en: "Recall patients", ar: "استرجاع المرضى" } },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.id ? "border-primary bg-primary/15 text-primary" : "border-primary/15 text-muted hover:border-primary/40 hover:text-ink"
            }`}
          >
            {tr(t.label)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-muted">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : tab === "payments" ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/12 bg-surface p-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose-500/12 text-rose-600">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
            </span>
            <div>
              <p className="text-xs font-medium text-muted">{tr({ en: "Total outstanding", ar: "إجمالي المتبقّي" })}</p>
              <p className="text-2xl font-extrabold text-rose-600">{formatMoney(totalOutstanding, lang)}</p>
            </div>
            <span className="ms-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {debtors.length} {tr({ en: "patients", ar: "مريض" })}
            </span>
          </div>

          {debtors.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-primary/20 bg-surface py-16 text-center text-sm text-muted">
              {tr({ en: "No outstanding balances. Everyone's paid up! 🎉", ar: "لا توجد مبالغ متبقّية. الجميع سدّد! 🎉" })}
            </p>
          ) : (
            <div className="space-y-2">
              {debtors.map((d) => (
                <div key={d.patientId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/12 bg-surface p-3">
                  <Avatar name={d.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{d.name}</p>
                    <p className="truncate text-xs text-muted" dir="ltr">{d.phone}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {tr({ en: "Last visit", ar: "آخر زيارة" })}: {fmtDate(d.lastVisit)}
                      {d.lastRemindedAt && <> · <span className="text-amber-700">{tr({ en: "reminded", ar: "تم التذكير" })} {ago(d.lastRemindedAt)}</span></>}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-[11px] text-muted">{tr({ en: "Owes", ar: "عليه" })}</p>
                    <p className="text-lg font-extrabold text-rose-600">{formatMoney(d.balance, lang)}</p>
                  </div>
                  <WaButton onClick={() => send(d, "payment", d.balance)} busy={!!sending[d.phone]} label={tr({ en: "Remind", ar: "تذكير" })} />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted">{tr({ en: "Not seen in", ar: "لم يزُر منذ" })}:</span>
            {MONTHS.map((m) => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  months === m ? "border-primary bg-primary/15 text-primary" : "border-primary/15 text-muted hover:border-primary/40 hover:text-ink"
                }`}
              >
                {tr({ en: `${m}+ months`, ar: `${m}+ شهور` })}
              </button>
            ))}
            <span className="ms-auto rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {recall.length} {tr({ en: "to win back", ar: "لاسترجاعهم" })}
            </span>
          </div>

          {recall.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-primary/20 bg-surface py-16 text-center text-sm text-muted">
              {tr({ en: "No lapsed patients in this window. 👍", ar: "لا يوجد مرضى متأخرون في هذه الفترة. 👍" })}
            </p>
          ) : (
            <div className="space-y-2">
              {recall.map((r) => (
                <div key={r.patientId} className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/12 bg-surface p-3">
                  <Avatar name={r.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{r.name}</p>
                    <p className="truncate text-xs text-muted" dir="ltr">{r.phone}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {tr({ en: "Last visit", ar: "آخر زيارة" })}: {fmtDate(r.lastVisit)}
                      {r.lastRecalledAt && <> · <span className="text-amber-700">{tr({ en: "recalled", ar: "تم الاسترجاع" })} {ago(r.lastRecalledAt)}</span></>}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                    {r.monthsSince} {tr({ en: "mo", ar: "شهر" })}
                  </span>
                  <WaButton onClick={() => send(r, "recall")} busy={!!sending[r.phone]} label={tr({ en: "Send recall", ar: "استرجاع" })} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
