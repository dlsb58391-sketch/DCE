"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { api, ApiError } from "./api";
import type { Item, Supplier } from "./types";
import { AdjustModal, DetailModal, ItemFormModal, ReceiveModal } from "./ItemModals";
import { Badge, btnGhost, btnPrimary, inputCls, useFmt } from "./ui";

type Notify = (kind: "ok" | "error", text: string) => void;
type ModalKind = "edit" | "receive" | "adjust" | "detail" | null;

export function ItemsTab({ notify, canWrite }: { notify: Notify; canWrite: boolean }) {
  const { tr } = useLang();
  const fmt = useFmt();
  const [items, setItems] = useState<Item[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalKind>(null);
  const [target, setTarget] = useState<Item | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [it, sup] = await Promise.all([
        api.listItems({ search: search.trim() || undefined, low: lowOnly || undefined, inactive: showInactive || undefined }),
        api.listSuppliers().catch(() => ({ suppliers: [] as Supplier[] })),
      ]);
      setItems(it.items);
      setSuppliers(sup.suppliers);
    } catch (e) {
      notify("error", e instanceof ApiError ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [notify, search, lowOnly, showInactive]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const open = (kind: ModalKind, item: Item | null) => {
    setTarget(item);
    setModal(kind);
  };
  const closeModal = () => setModal(null);

  const remove = async (item: Item) => {
    if (!window.confirm(tr({ en: "Move this item to the Recycle Bin?", ar: "نقل هذا الصنف إلى سلة المحذوفات؟" }))) return;
    setBusyId(item.id);
    try {
      await api.deleteItem(item.id);
      notify("ok", tr({ en: "Item deleted.", ar: "تم حذف الصنف." }));
      await load();
    } catch (e) {
      notify("error", e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">{tr({ en: "Items", ar: "الأصناف" })}</h2>
        {canWrite && (
          <button className={btnPrimary} onClick={() => open("edit", null)}>
            {tr({ en: "Add item", ar: "إضافة صنف" })}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          className={`${inputCls} max-w-[18rem]`}
          placeholder={tr({ en: "Search name, SKU, barcode…", ar: "بحث بالاسم أو الكود أو الباركود…" })}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          {tr({ en: "Low stock only", ar: "المنخفض فقط" })}
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          {tr({ en: "Include archived", ar: "إظهار المؤرشف" })}
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-muted">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</p>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-primary/15 bg-surface px-3.5 py-3 text-sm text-muted">
          {tr({ en: "No items match.", ar: "لا توجد أصناف مطابقة." })}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-primary/15 bg-surface">
          <table className="w-full min-w-[44rem] text-sm">
            <thead>
              <tr className="border-b border-primary/10 text-xs text-muted">
                <th className="px-3.5 py-2.5 text-start font-semibold">{tr({ en: "Item", ar: "الصنف" })}</th>
                <th className="px-3.5 py-2.5 text-start font-semibold">{tr({ en: "SKU", ar: "الكود" })}</th>
                <th className="px-3.5 py-2.5 text-end font-semibold">{tr({ en: "On hand", ar: "المتاح" })}</th>
                <th className="px-3.5 py-2.5 text-end font-semibold">{tr({ en: "Value", ar: "القيمة" })}</th>
                <th className="px-3.5 py-2.5 text-end font-semibold">{tr({ en: "Actions", ar: "إجراءات" })}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b border-primary/5 last:border-0">
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{tr({ en: it.nameEn, ar: it.nameAr })}</span>
                      {it.lowStock && <Badge tone="warn">{tr({ en: "Low", ar: "منخفض" })}</Badge>}
                      {!it.active && <Badge>{tr({ en: "Archived", ar: "مؤرشف" })}</Badge>}
                    </div>
                    {it.category && <span className="text-xs text-muted">{it.category}</span>}
                  </td>
                  <td className="px-3.5 py-2.5 text-muted">{it.sku || "—"}</td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-end font-semibold text-ink">
                    {fmt.qty(it.onHand)} <span className="text-xs font-normal text-muted">{it.unit}</span>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-2.5 text-end text-muted">{fmt.money(it.valuation)}</td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      <button className={btnGhost} onClick={() => open("detail", it)}>
                        {tr({ en: "Details", ar: "تفاصيل" })}
                      </button>
                      {canWrite && (
                        <>
                          <button className={btnGhost} onClick={() => open("receive", it)}>
                            {tr({ en: "Receive", ar: "استلام" })}
                          </button>
                          <button className={btnGhost} onClick={() => open("adjust", it)}>
                            {tr({ en: "Adjust", ar: "تعديل" })}
                          </button>
                          <button className={btnGhost} onClick={() => open("edit", it)}>
                            {tr({ en: "Edit", ar: "تحرير" })}
                          </button>
                          <button className={btnGhost} disabled={busyId === it.id} onClick={() => remove(it)}>
                            {tr({ en: "Delete", ar: "حذف" })}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === "edit" && <ItemFormModal onClose={closeModal} notify={notify} onDone={load} item={target} />}
      {modal === "receive" && target && <ReceiveModal onClose={closeModal} notify={notify} onDone={load} item={target} suppliers={suppliers} />}
      {modal === "adjust" && target && <AdjustModal onClose={closeModal} notify={notify} onDone={load} item={target} />}
      {modal === "detail" && target && <DetailModal onClose={closeModal} notify={notify} item={target} />}
    </div>
  );
}
