"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { api, ApiError } from "./api";
import type { ReorderReport, Report } from "./types";
import { Badge, btnGhost, useFmt } from "./ui";

type Notify = (kind: "ok" | "error", text: string) => void;

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" | "danger" }) {
  const ring = tone === "danger" ? "border-red-500/30" : tone === "warn" ? "border-amber-500/30" : "border-primary/15";
  return (
    <div className={`rounded-2xl border ${ring} bg-surface p-4`}>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

export function OverviewTab({ notify }: { notify: Notify }) {
  const { tr } = useLang();
  const fmt = useFmt();
  const [report, setReport] = useState<Report | null>(null);
  const [reorder, setReorder] = useState<ReorderReport | null>(null);
  const [loading, setLoading] = useState(true);

  // Manual refresh (button) — event-driven, so setState here is fine.
  const load = useCallback(() => {
    api
      .report()
      .then(setReport)
      .catch((e) => notify("error", e instanceof ApiError ? e.message : String(e)));
    api
      .reorder()
      .then(setReorder)
      .catch((e) => notify("error", e instanceof ApiError ? e.message : String(e)));
  }, [notify]);

  // Initial load: inline the fetch so state is only set from the async callback.
  useEffect(() => {
    let alive = true;
    Promise.all([api.report(), api.reorder()])
      .then(([r, ro]) => {
        if (alive) {
          setReport(r);
          setReorder(ro);
        }
      })
      .catch((e) => notify("error", e instanceof ApiError ? e.message : String(e)))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [notify]);

  if (loading && !report) return <p className="text-sm text-muted">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</p>;
  if (!report) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">{tr({ en: "Overview", ar: "نظرة عامة" })}</h2>
        <button className={btnGhost} onClick={load}>
          {tr({ en: "Refresh", ar: "تحديث" })}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Kpi label={tr({ en: "Active items", ar: "أصناف نشطة" })} value={fmt.qty(report.totalItems)} />
        <Kpi label={tr({ en: "Stock value (EGP)", ar: "قيمة المخزون (ج.م)" })} value={fmt.money(report.totalValuation)} />
        <Kpi label={tr({ en: "Low stock", ar: "مخزون منخفض" })} value={fmt.qty(report.lowStockCount)} tone={report.lowStockCount ? "warn" : undefined} />
        <Kpi label={tr({ en: "Expiring soon", ar: "قرب الانتهاء" })} value={fmt.qty(report.expiringCount)} tone={report.expiringCount ? "warn" : undefined} />
        <Kpi label={tr({ en: "Expired", ar: "منتهية" })} value={fmt.qty(report.expiredCount)} tone={report.expiredCount ? "danger" : undefined} />
      </div>

      <Section
        title={tr({ en: "To reorder", ar: "للطلب" })}
        empty={tr({ en: "Nothing needs reordering.", ar: "لا يوجد ما يحتاج إعادة طلب." })}
        rows={reorder?.items.length ?? 0}
      >
        {(reorder?.items ?? []).map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{tr({ en: r.nameEn, ar: r.nameAr })}</p>
              <p className="text-xs text-muted">
                {tr({ en: "On hand", ar: "المتاح" })} {fmt.qty(r.onHand)} / {fmt.qty(r.reorderLevel)} {r.unit}
                {r.onOrder > 0 ? ` · ${tr({ en: "on order", ar: "قيد الطلب" })} ${fmt.qty(r.onOrder)}` : ""}
                {r.lastSupplier
                  ? ` · ${tr({ en: "last", ar: "آخر" })} ${tr({ en: r.lastSupplier.nameEn, ar: r.lastSupplier.nameAr })}${
                      r.lastUnitCost != null ? ` @ ${fmt.money(r.lastUnitCost)}` : ""
                    }`
                  : ""}
              </p>
            </div>
            <span className="shrink-0 text-sm">
              {r.suggestedQty > 0 ? (
                <Badge tone="ok">
                  {tr({ en: "Order", ar: "اطلب" })} {fmt.qty(r.suggestedQty)} {r.unit}
                </Badge>
              ) : (
                <Badge tone="muted">{tr({ en: "On order", ar: "قيد الطلب" })}</Badge>
              )}
            </span>
          </div>
        ))}
      </Section>

      <Section title={tr({ en: "Low stock", ar: "مخزون منخفض" })} empty={tr({ en: "Nothing is low on stock.", ar: "لا يوجد نقص في المخزون." })} rows={report.lowStock.length}>
        {report.lowStock.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
            <span className="truncate font-semibold text-ink">{tr({ en: r.nameEn, ar: r.nameAr })}</span>
            <span className="shrink-0 text-sm">
              <Badge tone="warn">
                {fmt.qty(r.onHand)} / {fmt.qty(r.reorderLevel)} {r.unit}
              </Badge>
            </span>
          </div>
        ))}
      </Section>

      <Section title={tr({ en: "Expiring soon (30 days)", ar: "قرب الانتهاء (٣٠ يوم)" })} empty={tr({ en: "No batches expiring soon.", ar: "لا توجد دفعات قرب الانتهاء." })} rows={report.expiring.length}>
        {report.expiring.map((r) => (
          <BatchRow key={r.batchId} name={r.name} unit={r.unit} lot={r.lotNumber} date={fmt.date(r.expiryDate)} qty={fmt.qty(r.remainingQty)} tone="warn" />
        ))}
      </Section>

      <Section title={tr({ en: "Expired", ar: "منتهية الصلاحية" })} empty={tr({ en: "No expired batches.", ar: "لا توجد دفعات منتهية." })} rows={report.expired.length}>
        {report.expired.map((r) => (
          <BatchRow key={r.batchId} name={r.name} unit={r.unit} lot={r.lotNumber} date={fmt.date(r.expiryDate)} qty={fmt.qty(r.remainingQty)} tone="danger" />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, empty, rows, children }: { title: string; empty: string; rows: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      {rows === 0 ? (
        <p className="rounded-xl border border-primary/15 bg-surface px-3.5 py-3 text-sm text-muted">{empty}</p>
      ) : (
        <div className="divide-y divide-primary/10 rounded-xl border border-primary/15 bg-surface">{children}</div>
      )}
    </div>
  );
}

function BatchRow({ name, unit, lot, date, qty, tone }: { name: string; unit: string; lot: string | null; date: string; qty: string; tone: "warn" | "danger" }) {
  const { tr } = useLang();
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="truncate font-semibold text-ink">{name}</p>
        <p className="text-xs text-muted">
          {lot ? `${tr({ en: "Lot", ar: "تشغيلة" })} ${lot} · ` : ""}
          {tr({ en: "Exp", ar: "انتهاء" })} {date}
        </p>
      </div>
      <Badge tone={tone}>
        {qty} {unit}
      </Badge>
    </div>
  );
}
