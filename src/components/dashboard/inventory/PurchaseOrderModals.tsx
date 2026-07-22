"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/language";
import { api, ApiError } from "./api";
import type { Item, PurchaseOrder, Supplier } from "./types";
import { Badge, btnDanger, btnGhost, btnPrimary, Field, inputCls, Modal, PO_STATUS_LABEL, poStatusTone, useFmt } from "./ui";

type Notify = (kind: "ok" | "error", text: string) => void;
type Common = { onClose: () => void; notify: Notify; onDone: () => void };

const numOrNull = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

// Client-side mirrors of the server lifecycle guards (src/lib/server/purchase-orders.ts).
const canSubmit = (s: PurchaseOrder["status"]) => s === "draft";
const canReceive = (s: PurchaseOrder["status"]) => s === "submitted" || s === "partially_received";
const canCancel = (s: PurchaseOrder["status"]) => s === "draft" || s === "submitted" || s === "partially_received";

// ---------------------------------------------------------------------------
// Create purchase order (draft) — header + line picker
// ---------------------------------------------------------------------------

type LineDraft = { itemId: string; nameEn: string; nameAr: string; unit: string; orderedQty: string; unitCost: string };

export function PoCreateModal({ onClose, notify, onDone, suppliers, items }: Common & { suppliers: Supplier[]; items: Item[] }) {
  const { tr } = useLang();
  const fmt = useFmt();
  const [supplierId, setSupplierId] = useState("");
  const [currency, setCurrency] = useState("EGP");
  const [expectedAt, setExpectedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [pick, setPick] = useState("");
  const [saving, setSaving] = useState(false);

  const available = useMemo(() => items.filter((i) => !lines.some((l) => l.itemId === i.id)), [items, lines]);

  const addLine = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    setLines((prev) => [
      ...prev,
      { itemId: item.id, nameEn: item.nameEn, nameAr: item.nameAr, unit: item.unit, orderedQty: "1", unitCost: "" },
    ]);
    setPick("");
  };
  const setLine = (itemId: string, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l) => (l.itemId === itemId ? { ...l, ...patch } : l)));
  const removeLine = (itemId: string) => setLines((prev) => prev.filter((l) => l.itemId !== itemId));

  const estTotal = useMemo(
    () => lines.reduce((sum, l) => sum + (numOrNull(l.orderedQty) ?? 0) * (numOrNull(l.unitCost) ?? 0), 0),
    [lines],
  );

  const save = async () => {
    for (const l of lines) {
      const q = numOrNull(l.orderedQty);
      if (q == null || q <= 0) {
        notify("error", tr({ en: "Each line needs a quantity greater than 0.", ar: "كل بند يحتاج كمية أكبر من صفر." }));
        return;
      }
      const c = numOrNull(l.unitCost);
      if (c != null && c < 0) {
        notify("error", tr({ en: "Unit cost cannot be negative.", ar: "تكلفة الوحدة لا يمكن أن تكون سالبة." }));
        return;
      }
    }
    setSaving(true);
    try {
      await api.createPurchaseOrder({
        supplierId: supplierId || null,
        currency: currency.trim() || "EGP",
        notes: notes.trim() || null,
        expectedAt: expectedAt || null,
        lines: lines.map((l) => ({ itemId: l.itemId, orderedQty: numOrNull(l.orderedQty) ?? 0, unitCost: numOrNull(l.unitCost) ?? 0 })),
      });
      notify("ok", tr({ en: "Purchase order created.", ar: "تم إنشاء أمر الشراء." }));
      onClose();
      onDone();
    } catch (e) {
      notify("error", e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={tr({ en: "New purchase order", ar: "أمر شراء جديد" })}
      footer={
        <>
          <button className={btnGhost} onClick={onClose} disabled={saving}>
            {tr({ en: "Cancel", ar: "إلغاء" })}
          </button>
          <button className={btnPrimary} onClick={save} disabled={saving}>
            {saving ? tr({ en: "Saving…", ar: "جارٍ الحفظ…" }) : tr({ en: "Create draft", ar: "إنشاء مسودة" })}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr({ en: "Supplier", ar: "المورّد" })}>
            <select className={inputCls} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">{tr({ en: "— none —", ar: "— بدون —" })}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {tr({ en: s.nameEn, ar: s.nameAr })}
                </option>
              ))}
            </select>
          </Field>
          <Field label={tr({ en: "Expected date", ar: "التاريخ المتوقع" })}>
            <input className={inputCls} type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
          </Field>
          <Field label={tr({ en: "Currency", ar: "العملة" })}>
            <input className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={8} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={tr({ en: "Notes", ar: "ملاحظات" })}>
              <textarea className={inputCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <h4 className="text-sm font-bold text-ink">{tr({ en: "Lines", ar: "البنود" })}</h4>
            <select
              className={`${inputCls} max-w-[16rem]`}
              value={pick}
              onChange={(e) => addLine(e.target.value)}
              disabled={available.length === 0}
            >
              <option value="">{tr({ en: "+ Add item…", ar: "+ إضافة صنف…" })}</option>
              {available.map((i) => (
                <option key={i.id} value={i.id}>
                  {tr({ en: i.nameEn, ar: i.nameAr })}
                </option>
              ))}
            </select>
          </div>

          {lines.length === 0 ? (
            <p className="rounded-lg border border-primary/10 bg-surface px-3 py-2.5 text-sm text-muted">
              {tr({ en: "No lines yet. Add items above (or create an empty draft).", ar: "لا توجد بنود بعد. أضف أصنافاً بالأعلى (أو أنشئ مسودة فارغة)." })}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-primary/10">
              <table className="w-full min-w-[34rem] text-sm">
                <thead>
                  <tr className="border-b border-primary/10 text-xs text-muted">
                    <th className="px-3 py-2 text-start font-semibold">{tr({ en: "Item", ar: "الصنف" })}</th>
                    <th className="px-3 py-2 text-end font-semibold">{tr({ en: "Quantity", ar: "الكمية" })}</th>
                    <th className="px-3 py-2 text-end font-semibold">{tr({ en: "Unit cost", ar: "تكلفة الوحدة" })}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.itemId} className="border-b border-primary/5 last:border-0">
                      <td className="px-3 py-2">
                        <span className="font-semibold text-ink">{tr({ en: l.nameEn, ar: l.nameAr })}</span>
                        <span className="ms-1 text-xs text-muted">{l.unit}</span>
                      </td>
                      <td className="px-3 py-2 text-end">
                        <input
                          className={`${inputCls} w-24 text-end`}
                          value={l.orderedQty}
                          onChange={(e) => setLine(l.itemId, { orderedQty: e.target.value })}
                          inputMode="decimal"
                        />
                      </td>
                      <td className="px-3 py-2 text-end">
                        <input
                          className={`${inputCls} w-28 text-end`}
                          value={l.unitCost}
                          onChange={(e) => setLine(l.itemId, { unitCost: e.target.value })}
                          inputMode="decimal"
                          placeholder="0.00"
                        />
                      </td>
                      <td className="px-3 py-2 text-end">
                        <button className={btnGhost} onClick={() => removeLine(l.itemId)}>
                          {tr({ en: "Remove", ar: "إزالة" })}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-primary/10 text-sm">
                    <td className="px-3 py-2 font-semibold text-ink" colSpan={2}>
                      {tr({ en: "Estimated total", ar: "الإجمالي التقديري" })}
                    </td>
                    <td className="px-3 py-2 text-end font-bold text-ink" colSpan={2}>
                      {fmt.money(estTotal)} {currency.trim() || "EGP"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Receive goods against a submitted / partially-received PO
// ---------------------------------------------------------------------------

type ReceiveRow = { lineId: string; label: string; unit: string; remaining: number; quantity: string; lotNumber: string; expiryDate: string; unitCost: string };

export function PoReceiveModal({ onClose, notify, onDone, po }: Common & { po: PurchaseOrder }) {
  const { tr } = useLang();
  const { lang } = useLang();
  const [rows, setRows] = useState<ReceiveRow[]>(() =>
    po.lines
      .map((l) => {
        const remaining = Math.max(0, l.orderedQty - l.receivedQty);
        return {
          lineId: l.id,
          label: (lang === "ar" ? l.descriptionAr : l.descriptionEn) || l.descriptionEn || l.descriptionAr || l.itemId || "—",
          unit: "",
          remaining,
          quantity: remaining > 0 ? String(remaining) : "",
          lotNumber: "",
          expiryDate: "",
          unitCost: l.unitCost ? String(l.unitCost) : "",
        };
      })
      .filter((r) => r.remaining > 0),
  );
  const [saving, setSaving] = useState(false);

  const setRow = (lineId: string, patch: Partial<ReceiveRow>) =>
    setRows((prev) => prev.map((r) => (r.lineId === lineId ? { ...r, ...patch } : r)));

  const save = async () => {
    const receipts: Array<Record<string, unknown>> = [];
    for (const r of rows) {
      const q = numOrNull(r.quantity);
      if (q == null || q === 0) continue; // skip untouched lines
      if (q < 0) {
        notify("error", tr({ en: "Quantity cannot be negative.", ar: "الكمية لا يمكن أن تكون سالبة." }));
        return;
      }
      if (q > r.remaining) {
        notify("error", tr({ en: "Cannot receive more than the remaining quantity.", ar: "لا يمكن استلام أكثر من الكمية المتبقية." }));
        return;
      }
      const c = numOrNull(r.unitCost);
      if (c != null && c < 0) {
        notify("error", tr({ en: "Unit cost cannot be negative.", ar: "تكلفة الوحدة لا يمكن أن تكون سالبة." }));
        return;
      }
      receipts.push({
        lineId: r.lineId,
        quantity: q,
        lotNumber: r.lotNumber.trim() || null,
        expiryDate: r.expiryDate || null,
        unitCost: c,
      });
    }
    if (receipts.length === 0) {
      notify("error", tr({ en: "Enter a quantity to receive on at least one line.", ar: "أدخل كمية للاستلام في بند واحد على الأقل." }));
      return;
    }
    setSaving(true);
    try {
      await api.receivePurchaseOrder(po.id, { receipts });
      notify("ok", tr({ en: "Goods received into stock.", ar: "تم استلام البضاعة في المخزون." }));
      onClose();
      onDone();
    } catch (e) {
      notify("error", e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${tr({ en: "Receive goods", ar: "استلام بضاعة" })} · ${po.code}`}
      footer={
        <>
          <button className={btnGhost} onClick={onClose} disabled={saving}>
            {tr({ en: "Cancel", ar: "إلغاء" })}
          </button>
          <button className={btnPrimary} onClick={save} disabled={saving || rows.length === 0}>
            {saving ? tr({ en: "Receiving…", ar: "جارٍ الاستلام…" }) : tr({ en: "Receive", ar: "استلام" })}
          </button>
        </>
      }
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{tr({ en: "Every line has already been fully received.", ar: "تم استلام جميع البنود بالكامل." })}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            {tr({
              en: "Enter the quantity actually delivered per line. Leave a line at 0 to skip it. Each receipt creates a stock batch.",
              ar: "أدخل الكمية المستلمة فعلياً لكل بند. اترك البند على 0 لتخطيه. كل استلام يُنشئ تشغيلة مخزون.",
            })}
          </p>
          {rows.map((r) => (
            <div key={r.lineId} className="rounded-lg border border-primary/10 bg-surface p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold text-ink">{r.label}</span>
                <span className="text-xs text-muted">
                  {tr({ en: "Remaining", ar: "المتبقي" })}: <span className="font-semibold text-ink">{r.remaining}</span>
                </span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field label={tr({ en: "Receive quantity", ar: "كمية الاستلام" })}>
                  <input className={inputCls} value={r.quantity} onChange={(e) => setRow(r.lineId, { quantity: e.target.value })} inputMode="decimal" />
                </Field>
                <Field label={tr({ en: "Unit cost", ar: "تكلفة الوحدة" })}>
                  <input className={inputCls} value={r.unitCost} onChange={(e) => setRow(r.lineId, { unitCost: e.target.value })} inputMode="decimal" placeholder="0.00" />
                </Field>
                <Field label={tr({ en: "Lot / batch no.", ar: "رقم التشغيلة" })}>
                  <input className={inputCls} value={r.lotNumber} onChange={(e) => setRow(r.lineId, { lotNumber: e.target.value })} />
                </Field>
                <Field label={tr({ en: "Expiry date", ar: "تاريخ الانتهاء" })}>
                  <input className={inputCls} type="date" value={r.expiryDate} onChange={(e) => setRow(r.lineId, { expiryDate: e.target.value })} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Purchase order detail (+ lifecycle actions)
// ---------------------------------------------------------------------------

export function PoDetailModal({ onClose, notify, onDone, id, canWrite }: Common & { id: string; canWrite: boolean }) {
  const { tr, lang } = useLang();
  const fmt = useFmt();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [receiving, setReceiving] = useState(false);

  const reload = useMemo(
    () => async () => {
      try {
        const d = await api.purchaseOrder(id);
        setPo(d.purchaseOrder);
      } catch (e) {
        notify("error", e instanceof ApiError ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    },
    [id, notify],
  );

  useEffect(() => {
    let alive = true;
    api
      .purchaseOrder(id)
      .then((d) => {
        if (alive) setPo(d.purchaseOrder);
      })
      .catch((e) => notify("error", e instanceof ApiError ? e.message : String(e)))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, notify]);

  const runAction = async (fn: () => Promise<unknown>, okMsg: { en: string; ar: string }) => {
    setBusy(true);
    try {
      await fn();
      notify("ok", tr(okMsg));
      await reload();
      onDone();
    } catch (e) {
      notify("error", e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = () => runAction(() => api.submitPurchaseOrder(id), { en: "Purchase order submitted.", ar: "تم إرسال أمر الشراء." });
  const cancel = () => {
    if (!window.confirm(tr({ en: "Cancel this purchase order? Received stock is kept.", ar: "إلغاء أمر الشراء؟ يتم الاحتفاظ بالمخزون المستلم." }))) return;
    void runAction(() => api.cancelPurchaseOrder(id), { en: "Purchase order cancelled.", ar: "تم إلغاء أمر الشراء." });
  };
  const remove = () => {
    if (!window.confirm(tr({ en: "Move this purchase order to the Recycle Bin?", ar: "نقل أمر الشراء إلى سلة المحذوفات؟" }))) return;
    void runAction(async () => {
      await api.deletePurchaseOrder(id);
      onClose();
    }, { en: "Purchase order deleted.", ar: "تم حذف أمر الشراء." });
  };

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={po ? `${po.code}` : tr({ en: "Purchase order", ar: "أمر شراء" })}
        footer={
          <div className="flex w-full flex-wrap items-center justify-end gap-1.5">
            <button className={btnGhost} onClick={onClose} disabled={busy}>
              {tr({ en: "Close", ar: "إغلاق" })}
            </button>
            {canWrite && po && (
              <>
                {canSubmit(po.status) && (
                  <button className={btnGhost} onClick={submit} disabled={busy}>
                    {tr({ en: "Submit", ar: "إرسال" })}
                  </button>
                )}
                {canReceive(po.status) && (
                  <button className={btnPrimary} onClick={() => setReceiving(true)} disabled={busy}>
                    {tr({ en: "Receive goods", ar: "استلام بضاعة" })}
                  </button>
                )}
                {canCancel(po.status) && (
                  <button className={btnGhost} onClick={cancel} disabled={busy}>
                    {tr({ en: "Cancel PO", ar: "إلغاء الأمر" })}
                  </button>
                )}
                <button className={btnDanger} onClick={remove} disabled={busy}>
                  {tr({ en: "Delete", ar: "حذف" })}
                </button>
              </>
            )}
          </div>
        }
      >
        {loading || !po ? (
          <p className="text-sm text-muted">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm">
              <Badge tone={poStatusTone(po.status)}>{tr(PO_STATUS_LABEL[po.status])}</Badge>
              <span>
                {tr({ en: "Supplier", ar: "المورّد" })}: <span className="font-semibold text-ink">{po.supplierName || tr({ en: "—", ar: "—" })}</span>
              </span>
              <span>
                {tr({ en: "Expected", ar: "المتوقع" })}: <span className="font-semibold text-ink">{fmt.date(po.expectedAt)}</span>
              </span>
              {po.orderedAt && (
                <span>
                  {tr({ en: "Ordered", ar: "تاريخ الطلب" })}: <span className="font-semibold text-ink">{fmt.date(po.orderedAt)}</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-4 rounded-lg border border-primary/10 bg-surface px-3.5 py-2.5 text-sm">
              <span>
                {tr({ en: "Ordered value", ar: "قيمة الطلب" })}: <span className="font-bold text-ink">{fmt.money(po.orderedValue)} {po.currency}</span>
              </span>
              <span>
                {tr({ en: "Received", ar: "المستلم" })}: <span className="font-bold text-ink">{fmt.money(po.receivedValue)} {po.currency}</span>
              </span>
              <span>
                {tr({ en: "Remaining", ar: "المتبقي" })}: <span className="font-bold text-ink">{fmt.money(po.remainingValue)} {po.currency}</span>
              </span>
            </div>

            <div>
              <h4 className="mb-1.5 text-sm font-bold text-ink">
                {tr({ en: "Lines", ar: "البنود" })} · {po.receivedLineCount}/{po.lineCount}
              </h4>
              {po.lines.length === 0 ? (
                <p className="text-sm text-muted">{tr({ en: "No lines.", ar: "لا توجد بنود." })}</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-primary/10">
                  <table className="w-full min-w-[32rem] text-sm">
                    <thead>
                      <tr className="border-b border-primary/10 text-xs text-muted">
                        <th className="px-3 py-2 text-start font-semibold">{tr({ en: "Item", ar: "الصنف" })}</th>
                        <th className="px-3 py-2 text-end font-semibold">{tr({ en: "Ordered", ar: "المطلوب" })}</th>
                        <th className="px-3 py-2 text-end font-semibold">{tr({ en: "Received", ar: "المستلم" })}</th>
                        <th className="px-3 py-2 text-end font-semibold">{tr({ en: "Unit cost", ar: "تكلفة الوحدة" })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.lines.map((l) => {
                        const full = l.receivedQty >= l.orderedQty;
                        return (
                          <tr key={l.id} className="border-b border-primary/5 last:border-0">
                            <td className="px-3 py-2 text-ink">
                              {(lang === "ar" ? l.descriptionAr : l.descriptionEn) || l.descriptionEn || l.descriptionAr || "—"}
                            </td>
                            <td className="px-3 py-2 text-end text-ink">{fmt.qty(l.orderedQty)}</td>
                            <td className={`px-3 py-2 text-end font-semibold ${full ? "text-emerald-600" : "text-ink"}`}>{fmt.qty(l.receivedQty)}</td>
                            <td className="px-3 py-2 text-end text-muted">{fmt.money(l.unitCost)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {po.notes && (
              <div>
                <h4 className="mb-1 text-sm font-bold text-ink">{tr({ en: "Notes", ar: "ملاحظات" })}</h4>
                <p className="whitespace-pre-wrap text-sm text-muted">{po.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {receiving && po && (
        <PoReceiveModal
          po={po}
          onClose={() => setReceiving(false)}
          notify={notify}
          onDone={async () => {
            await reload();
            onDone();
          }}
        />
      )}
    </>
  );
}
