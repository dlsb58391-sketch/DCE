"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/language";
import { ItemsTab } from "./ItemsTab";
import { MovementsTab } from "./MovementsTab";
import { OverviewTab } from "./OverviewTab";
import { PurchaseOrdersTab } from "./PurchaseOrdersTab";
import { SuppliersTab } from "./SuppliersTab";

type TabKey = "overview" | "items" | "purchase-orders" | "suppliers" | "movements";
type Notice = { kind: "ok" | "error"; text: string };

const OWNER_ROLES = new Set(["admin", "doctor"]);

export function Inventory() {
  const { tr } = useLang();
  const [tab, setTab] = useState<TabKey>("overview");
  const [canWrite, setCanWrite] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((kind: "ok" | "error", text: string) => {
    setNotice({ kind, text });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), 3500);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCanWrite(OWNER_ROLES.has(j?.user?.role)))
      .catch(() => setCanWrite(false));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const tabs: { key: TabKey; label: { en: string; ar: string } }[] = [
    { key: "overview", label: { en: "Overview", ar: "نظرة عامة" } },
    { key: "items", label: { en: "Items", ar: "الأصناف" } },
    { key: "purchase-orders", label: { en: "Purchase Orders", ar: "أوامر الشراء" } },
    { key: "suppliers", label: { en: "Suppliers", ar: "الموردون" } },
    { key: "movements", label: { en: "Movements", ar: "الحركات" } },
  ];

  return (
    <div className="dash-light min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-ink">{tr({ en: "Inventory", ar: "المخزون" })}</h1>
            <p className="mt-0.5 text-sm text-muted">
              {tr({
                en: "Track stock, batches, expiry and supplier receipts. On-hand is derived from batch quantities.",
                ar: "تتبّع المخزون والتشغيلات وتواريخ الانتهاء واستلامات الموردين. الرصيد محسوب من كميات التشغيلات.",
              })}
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/20 px-3 py-2 text-sm font-semibold text-ink transition hover:bg-surface"
          >
            {tr({ en: "Back to dashboard", ar: "العودة للوحة" })}
          </Link>
        </div>

        {notice && (
          <div
            role="status"
            className={
              "rounded-xl border px-3.5 py-2.5 text-sm " +
              (notice.kind === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                : "border-red-500/30 bg-red-500/10 text-red-600")
            }
          >
            {notice.text}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition " +
                (tab === t.key ? "border-primary bg-primary/10 text-ink" : "border-primary/20 text-ink hover:bg-surface")
              }
            >
              {tr(t.label)}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab notify={notify} />}
        {tab === "items" && <ItemsTab notify={notify} canWrite={canWrite} />}
        {tab === "purchase-orders" && <PurchaseOrdersTab notify={notify} canWrite={canWrite} />}
        {tab === "suppliers" && <SuppliersTab notify={notify} canWrite={canWrite} />}
        {tab === "movements" && <MovementsTab notify={notify} />}
      </div>
    </div>
  );
}
