"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/language";

/** One trashed entity type with its current count (from GET /api/admin/trash). */
type TypeInfo = { type: string; label: string; count: number };

/** One trashed row (from GET /api/admin/trash?type=...). */
type TrashItem = {
  id: string;
  type: string;
  label: string;
  detail: string | null;
  deletedAt: string;
  deletedBy: string | null;
};

/** Bilingual labels for each trash type (server sends English + the counts). */
const TYPE_LABEL: Record<string, { en: string; ar: string }> = {
  patient: { en: "Patients", ar: "المرضى" },
  doctor: { en: "Doctors", ar: "الأطباء" },
  treatment: { en: "Treatments", ar: "العلاجات" },
  payment: { en: "Payments", ar: "المدفوعات" },
  procedure: { en: "Operations", ar: "العمليات" },
  file: { en: "Files", ar: "الملفات" },
  payout: { en: "Doctor payouts", ar: "صرفيات الأطباء" },
  expense: { en: "Expenses", ar: "المصروفات" },
  supplier: { en: "Suppliers", ar: "الموردون" },
  item: { en: "Inventory items", ar: "أصناف المخزون" },
  purchase_order: { en: "Purchase orders", ar: "أوامر الشراء" },
  medication: { en: "Medications", ar: "الأدوية" },
  prescription: { en: "Prescriptions", ar: "الروشتات" },
  branch: { en: "Branches", ar: "الفروع" },
};

const PAGE_LIMIT = 100;

export function RecycleBin() {
  const { tr, lang } = useLang();
  const [types, setTypes] = useState<TypeInfo[]>([]);
  const [total, setTotal] = useState(0);
  const [activeType, setActiveType] = useState<string | null>(null);
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const typeLabel = useCallback(
    (t: string) => (TYPE_LABEL[t] ? tr(TYPE_LABEL[t]) : t),
    [tr],
  );

  const loadOverview = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/trash", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setTypes(j.types ?? []);
        setTotal(j.total ?? 0);
      }
    } finally {
      setLoadingOverview(false);
    }
  }, []);

  const loadItems = useCallback(async (type: string) => {
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/admin/trash?type=${encodeURIComponent(type)}&limit=${PAGE_LIMIT}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const j = await res.json();
        setItems(j.items ?? []);
      } else {
        setItems([]);
      }
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setIsAdmin(j?.user?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, [loadOverview]);

  const selectType = (type: string) => {
    setNotice(null);
    setActiveType(type);
    loadItems(type);
  };

  const refresh = useCallback(async () => {
    await loadOverview();
    if (activeType) await loadItems(activeType);
  }, [loadOverview, loadItems, activeType]);

  const restore = async (item: TrashItem) => {
    setBusyId(item.id);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/trash/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: item.type, id: item.id }),
      });
      if (res.ok) {
        setNotice({ kind: "ok", text: tr({ en: "Restored.", ar: "تمت الاستعادة." }) });
        await refresh();
      } else {
        setNotice({ kind: "error", text: tr({ en: "Could not restore this item.", ar: "تعذّر استعادة هذا العنصر." }) });
      }
    } finally {
      setBusyId(null);
    }
  };

  const purge = async (item: TrashItem) => {
    const first = window.confirm(
      tr({
        en: "Permanently delete this record? This cannot be undone.",
        ar: "حذف هذا السجل نهائيًا؟ لا يمكن التراجع عن ذلك.",
      }),
    );
    if (!first) return;
    setBusyId(item.id);
    setNotice(null);
    try {
      let res = await fetch("/api/admin/trash/purge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: item.type, id: item.id }),
      });
      if (res.status === 409) {
        const forced = window.confirm(
          tr({
            en: "This record is linked to financial or medical history. Delete it anyway?",
            ar: "هذا السجل مرتبط بسجل مالي أو طبي. هل تريد حذفه على أي حال؟",
          }),
        );
        if (!forced) return;
        res = await fetch("/api/admin/trash/purge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: item.type, id: item.id, force: true }),
        });
      }
      if (res.ok) {
        setNotice({ kind: "ok", text: tr({ en: "Permanently deleted.", ar: "تم الحذف نهائيًا." }) });
        await refresh();
      } else if (res.status === 403) {
        setNotice({ kind: "error", text: tr({ en: "Only an admin can permanently delete.", ar: "المدير فقط يمكنه الحذف النهائي." }) });
      } else {
        setNotice({ kind: "error", text: tr({ en: "Could not delete this record.", ar: "تعذّر حذف هذا السجل." }) });
      }
    } finally {
      setBusyId(null);
    }
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(lang === "ar" ? "ar-EG" : "en-GB");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-ink">
            {tr({ en: "Recycle Bin", ar: "سلة المحذوفات" })}
          </h1>
          <p className="mt-0.5 text-sm text-muted">
            {tr({
              en: "Deleted records are kept here. Restore them, or permanently delete (admin only).",
              ar: "السجلات المحذوفة محفوظة هنا. يمكنك استعادتها أو حذفها نهائيًا (للمدير فقط).",
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
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300")
          }
        >
          {notice.text}
        </div>
      )}

      {/* Type selector with counts */}
      {loadingOverview ? (
        <p className="text-sm text-muted">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</p>
      ) : total === 0 ? (
        <div className="rounded-2xl border border-primary/15 bg-surface p-8 text-center">
          <p className="text-base font-semibold text-ink">{tr({ en: "The Recycle Bin is empty.", ar: "سلة المحذوفات فارغة." })}</p>
          <p className="mt-1 text-sm text-muted">
            {tr({ en: "Deleted patients, treatments, payments and more will appear here.", ar: "ستظهر هنا السجلات المحذوفة من المرضى والعلاجات والمدفوعات وغيرها." })}
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              key={t.type}
              onClick={() => selectType(t.type)}
              disabled={t.count === 0}
              className={
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition " +
                (activeType === t.type
                  ? "border-primary bg-primary/10 text-ink"
                  : t.count === 0
                    ? "cursor-not-allowed border-primary/10 text-muted/50"
                    : "border-primary/20 text-ink hover:bg-surface")
              }
            >
              <span>{typeLabel(t.type)}</span>
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-xs text-primary">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Items for the selected type */}
      {activeType && (
        <div className="space-y-2">
          {loadingItems ? (
            <p className="text-sm text-muted">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</p>
          ) : items.length === 0 ? (
            <p className="rounded-xl border border-primary/15 bg-surface px-3.5 py-3 text-sm text-muted">
              {tr({ en: "Nothing here.", ar: "لا يوجد شيء هنا." })}
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/15 bg-surface px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">
                    {item.label}
                    {item.detail ? <span className="text-muted"> · {item.detail}</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {tr({ en: "Deleted", ar: "حُذف" })} {fmtDate(item.deletedAt)}
                    {item.deletedBy ? ` · ${tr({ en: "by", ar: "بواسطة" })} ${item.deletedBy}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => restore(item)}
                    disabled={busyId === item.id}
                    className="rounded-lg bg-gradient-to-r from-primary to-primary-dark px-3 py-1.5 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    {tr({ en: "Restore", ar: "استعادة" })}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => purge(item)}
                      disabled={busyId === item.id}
                      className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {tr({ en: "Delete forever", ar: "حذف نهائي" })}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
