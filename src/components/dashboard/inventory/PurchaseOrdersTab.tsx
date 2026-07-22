"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { api, ApiError } from "./api";
import type { Item, PurchaseOrder, Supplier } from "./types";
import { PoCreateModal, PoDetailModal } from "./PurchaseOrderModals";
import { Badge, btnGhost, btnPrimary, inputCls, PO_STATUS_LABEL, poStatusTone, useFmt } from "./ui";
import type { PoStatus } from "./types";

type Notify = (kind: "ok" | "error", text: string) => void;
type ModalKind = "create" | "detail" | null;

const STATUS_FILTERS: Array<{ value: "" | PoStatus; label: { en: string; ar: string } }> = [
  { value: "", label: { en: "All", ar: "الكل" } },
  { value: "draft", label: PO_STATUS_LABEL.draft },
  { value: "submitted", label: PO_STATUS_LABEL.submitted },
  { value: "partially_received", label: PO_STATUS_LABEL.partially_received },
  { value: "received", label: PO_STATUS_LABEL.received },
  { value: "cancelled", label: PO_STATUS_LABEL.cancelled },
];

export function PurchaseOrdersTab({ notify, canWrite }: { notify: Notify; canWrite: boolean }) {
  const { tr } = useLang();
  const fmt = useFmt();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | PoStatus>("");

  const [modal, setModal] = useState<ModalKind>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listPurchaseOrders({ search: search.trim() || undefined, status: status || undefined });
      setOrders(res.purchaseOrders);
    } catch (e) {
      notify("error", e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [notify, search, status]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  // Reference data for the create modal (loaded once; refreshed lazily on open).
  const ensureRefData = useCallback(async () => {
    try {
      const [sup, it] = await Promise.all([
        api.listSuppliers().catch(() => ({ suppliers: [] as Supplier[] })),
        api.listItems({}).catch(() => ({ items: [] as Item[] })),
      ]);
      setSuppliers(sup.suppliers);
      setItems(it.items);
    } catch {
      /* non-fatal — modal still opens with whatever loaded */
    }
  }, []);

  const openCreate = async () => {
    await ensureRefData();
    setModal("create");
  };
  const openDetail = (id: string) => {
    setDetailId(id);
    setModal("detail");
  };
  const closeModal = () => {
    setModal(null);
    setDetailId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">{tr({ en: "Purchase orders", ar: "أوامر الشراء" })}</h2>
        {canWrite && (
          <button className={btnPrimary} onClick={openCreate}>
            {tr({ en: "New purchase order", ar: "أمر شراء جديد" })}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputCls} max-w-[16rem]`}
          placeholder={tr({ en: "Search by PO code…", ar: "بحث بكود الأمر…" })}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={`${inputCls} max-w-[12rem]`} value={status} onChange={(e) => setStatus(e.target.value as "" | PoStatus)}>
          {STATUS_FILTERS.map((s) => (
            <option key={s.value || "all"} value={s.value}>
              {tr(s.label)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</p>
      ) : orders.length === 0 ? (
        <p className="rounded-xl border border-primary/15 bg-surface px-3.5 py-3 text-sm text-muted">
          {tr({ en: "No purchase orders yet.", ar: "لا توجد أوامر شراء بعد." })}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-primary/15 bg-surface">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-primary/10 text-xs text-muted">
                <th className="px-3.5 py-2.5 text-start font-semibold">{tr({ en: "PO", ar: "الأمر" })}</th>
                <th className="px-3.5 py-2.5 text-start font-semibold">{tr({ en: "Supplier", ar: "المورّد" })}</th>
                <th className="px-3.5 py-2.5 text-start font-semibold">{tr({ en: "Status", ar: "الحالة" })}</th>
                <th className="px-3.5 py-2.5 text-end font-semibold">{tr({ en: "Lines", ar: "البنود" })}</th>
                <th className="px-3.5 py-2.5 text-end font-semibold">{tr({ en: "Value", ar: "القيمة" })}</th>
                <th className="px-3.5 py-2.5 text-end font-semibold">{tr({ en: "Actions", ar: "إجراءات" })}</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => (
                <tr key={po.id} className="border-b border-primary/5 last:border-0">
                  <td className="px-3.5 py-2.5">
                    <span className="font-semibold text-ink">{po.code}</span>
                    <span className="block text-xs text-muted">{fmt.date(po.expectedAt)}</span>
                  </td>
                  <td className="px-3.5 py-2.5 text-muted">{po.supplierName || "—"}</td>
                  <td className="px-3.5 py-2.5">
                    <Badge tone={poStatusTone(po.status)}>{tr(PO_STATUS_LABEL[po.status])}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-end text-ink">
                    {po.receivedLineCount}/{po.lineCount}
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-end text-muted">
                    {fmt.money(po.orderedValue)} <span className="text-xs">{po.currency}</span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center justify-end">
                      <button className={btnGhost} onClick={() => openDetail(po.id)}>
                        {tr({ en: "Open", ar: "فتح" })}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === "create" && (
        <PoCreateModal onClose={closeModal} notify={notify} onDone={load} suppliers={suppliers} items={items} />
      )}
      {modal === "detail" && detailId && (
        <PoDetailModal onClose={closeModal} notify={notify} onDone={load} id={detailId} canWrite={canWrite} />
      )}
    </div>
  );
}
