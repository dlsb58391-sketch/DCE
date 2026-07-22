"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { api, ApiError } from "./api";
import type { Item, ItemDetail, MovementType, PurchaseHistory, Supplier } from "./types";
import { Badge, btnGhost, btnPrimary, Field, inputCls, Modal, MOVEMENT_LABEL, UNIT_OPTIONS, useFmt } from "./ui";

type Notify = (kind: "ok" | "error", text: string) => void;
type Common = { onClose: () => void; notify: Notify; onDone: () => void };

const numOrNull = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------------------
// Add / edit item
// ---------------------------------------------------------------------------

type ItemForm = {
  nameEn: string;
  nameAr: string;
  sku: string;
  barcode: string;
  category: string;
  unit: string;
  reorderLevel: string;
  reorderQty: string;
  notes: string;
  active: boolean;
};

const emptyItem: ItemForm = {
  nameEn: "",
  nameAr: "",
  sku: "",
  barcode: "",
  category: "",
  unit: "piece",
  reorderLevel: "0",
  reorderQty: "",
  notes: "",
  active: true,
};

function toItemForm(item: Item): ItemForm {
  return {
    nameEn: item.nameEn,
    nameAr: item.nameAr,
    sku: item.sku ?? "",
    barcode: item.barcode ?? "",
    category: item.category ?? "",
    unit: item.unit,
    reorderLevel: String(item.reorderLevel),
    reorderQty: item.reorderQty == null ? "" : String(item.reorderQty),
    notes: item.notes ?? "",
    active: item.active,
  };
}

export function ItemFormModal({ onClose, notify, onDone, item }: Common & { item: Item | null }) {
  const { tr } = useLang();
  const [form, setForm] = useState<ItemForm>(() => (item ? toItemForm(item) : emptyItem));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.nameEn.trim() && !form.nameAr.trim()) {
      notify("error", tr({ en: "An item name is required.", ar: "اسم الصنف مطلوب." }));
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        nameEn: form.nameEn,
        nameAr: form.nameAr,
        sku: form.sku.trim() || null,
        barcode: form.barcode.trim() || null,
        category: form.category.trim() || null,
        unit: form.unit || "piece",
        reorderLevel: numOrNull(form.reorderLevel) ?? 0,
        reorderQty: numOrNull(form.reorderQty),
        notes: form.notes.trim() || null,
        active: form.active,
      };
      if (item) {
        await api.updateItem(item.id, payload);
        notify("ok", tr({ en: "Item updated.", ar: "تم تحديث الصنف." }));
      } else {
        await api.createItem(payload);
        notify("ok", tr({ en: "Item added.", ar: "تمت إضافة الصنف." }));
      }
      onClose();
      onDone();
    } catch (e) {
      notify("error", e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={item ? tr({ en: "Edit item", ar: "تعديل الصنف" }) : tr({ en: "Add item", ar: "إضافة صنف" })} saving={saving} onSave={save}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={tr({ en: "Name (English)", ar: "الاسم (إنجليزي)" })}>
          <input className={inputCls} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
        </Field>
        <Field label={tr({ en: "Name (Arabic)", ar: "الاسم (عربي)" })}>
          <input className={inputCls} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" />
        </Field>
        <Field label={tr({ en: "SKU", ar: "الكود" })}>
          <input className={inputCls} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
        </Field>
        <Field label={tr({ en: "Barcode", ar: "الباركود" })}>
          <input className={inputCls} value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} inputMode="numeric" />
        </Field>
        <Field label={tr({ en: "Category", ar: "التصنيف" })}>
          <input className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        </Field>
        <Field label={tr({ en: "Unit", ar: "الوحدة" })}>
          <input className={inputCls} list="inv-units" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <datalist id="inv-units">
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
        <Field label={tr({ en: "Reorder level", ar: "حد إعادة الطلب" })}>
          <input className={inputCls} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} inputMode="decimal" />
        </Field>
        <Field label={tr({ en: "Reorder quantity", ar: "كمية إعادة الطلب" })}>
          <input className={inputCls} value={form.reorderQty} onChange={(e) => setForm({ ...form, reorderQty: e.target.value })} inputMode="decimal" />
        </Field>
        <div className="sm:col-span-2">
          <Field label={tr({ en: "Notes", ar: "ملاحظات" })}>
            <textarea className={inputCls} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
          <span className="text-sm text-ink">{tr({ en: "Active", ar: "نشط" })}</span>
        </label>
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Receive stock
// ---------------------------------------------------------------------------

export function ReceiveModal({ onClose, notify, onDone, item, suppliers }: Common & { item: Item; suppliers: Supplier[] }) {
  const { tr } = useLang();
  const [supplierId, setSupplierId] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const qty = numOrNull(quantity);
    const cost = numOrNull(unitCost);
    if (qty == null || qty <= 0) {
      notify("error", tr({ en: "Enter a quantity greater than 0.", ar: "أدخل كمية أكبر من صفر." }));
      return;
    }
    if (cost == null || cost < 0) {
      notify("error", tr({ en: "Enter a valid unit cost.", ar: "أدخل تكلفة وحدة صحيحة." }));
      return;
    }
    setSaving(true);
    try {
      await api.receive(item.id, {
        supplierId: supplierId || null,
        lotNumber: lotNumber.trim() || null,
        expiryDate: expiryDate || null,
        unitCost: cost,
        quantity: qty,
        notes: notes.trim() || null,
      });
      notify("ok", tr({ en: "Stock received.", ar: "تم استلام المخزون." }));
      onClose();
      onDone();
    } catch (e) {
      notify("error", e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell onClose={onClose} title={`${tr({ en: "Receive stock", ar: "استلام مخزون" })} · ${tr({ en: item.nameEn, ar: item.nameAr })}`} saving={saving} onSave={save}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={tr({ en: "Quantity", ar: "الكمية" })}>
          <input className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" autoFocus />
        </Field>
        <Field label={tr({ en: "Unit cost (EGP)", ar: "تكلفة الوحدة (ج.م)" })}>
          <input className={inputCls} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label={tr({ en: "Supplier", ar: "المورّد" })}>
          <select className={inputCls} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">{tr({ en: "— none —", ar: "— بدون —" })}</option>
            {suppliers.filter((s) => s.active).map((s) => (
              <option key={s.id} value={s.id}>
                {tr({ en: s.nameEn, ar: s.nameAr })}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tr({ en: "Lot / batch no.", ar: "رقم التشغيلة" })}>
          <input className={inputCls} value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
        </Field>
        <Field label={tr({ en: "Expiry date", ar: "تاريخ الانتهاء" })}>
          <input type="date" className={inputCls} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label={tr({ en: "Notes", ar: "ملاحظات" })}>
            <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </div>
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Adjust stock (consume / waste / return / correct a batch)
// ---------------------------------------------------------------------------

const ADJUST_TYPES: MovementType[] = ["consumption", "wastage", "return", "adjustment"];

export function AdjustModal({ onClose, notify, onDone, item }: Common & { item: Item }) {
  const { tr } = useLang();
  const fmt = useFmt();
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [type, setType] = useState<MovementType>("consumption");
  const [quantity, setQuantity] = useState("");
  const [delta, setDelta] = useState("");
  const [batchId, setBatchId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .itemDetail(item.id)
      .then((d) => {
        if (alive) setDetail(d);
      })
      .catch((e) => notify("error", e instanceof ApiError ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [item.id, notify]);

  const isAdjust = type === "adjustment";
  const liveBatches = (detail?.batches ?? []).filter((b) => b.remainingQty > 0);

  const save = async () => {
    setSaving(true);
    try {
      if (isAdjust) {
        const d = numOrNull(delta);
        if (!batchId) throw new ApiError(tr({ en: "Choose a batch to adjust.", ar: "اختر التشغيلة المراد تسويتها." }), 400, "batch_required");
        if (d == null || d === 0) throw new ApiError(tr({ en: "Enter a non-zero delta.", ar: "أدخل قيمة تغيير غير صفرية." }), 400, "delta_required");
        if (!reason.trim()) throw new ApiError(tr({ en: "A reason is required.", ar: "السبب مطلوب." }), 400, "reason_required");
        await api.adjust(item.id, { type, batchId, delta: d, reason: reason.trim() });
      } else {
        const q = numOrNull(quantity);
        if (q == null || q <= 0) throw new ApiError(tr({ en: "Enter a quantity greater than 0.", ar: "أدخل كمية أكبر من صفر." }), 400, "quantity_required");
        await api.adjust(item.id, { type, quantity: q, batchId: batchId || null, reason: reason.trim() || null });
      }
      notify("ok", tr({ en: "Stock adjusted.", ar: "تم تعديل المخزون." }));
      onClose();
      onDone();
    } catch (e) {
      notify("error", e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const batchLabel = (b: (typeof liveBatches)[number]) =>
    `${b.lotNumber ? b.lotNumber : tr({ en: "batch", ar: "تشغيلة" })} · ${fmt.qty(b.remainingQty)} ${item.unit}${b.expiryDate ? ` · ${tr({ en: "exp", ar: "انتهاء" })} ${fmt.date(b.expiryDate)}` : ""}`;

  return (
    <ModalShell onClose={onClose} title={`${tr({ en: "Adjust stock", ar: "تعديل المخزون" })} · ${tr({ en: item.nameEn, ar: item.nameAr })}`} saving={saving} onSave={save}>
      <p className="mb-3 text-sm text-muted">
        {tr({ en: "On hand", ar: "المتاح" })}: <span className="font-semibold text-ink">{fmt.qty(item.onHand)} {item.unit}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={tr({ en: "Action", ar: "الإجراء" })}>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as MovementType)}>
            {ADJUST_TYPES.map((t) => (
              <option key={t} value={t}>
                {tr(MOVEMENT_LABEL[t])}
              </option>
            ))}
          </select>
        </Field>

        {isAdjust ? (
          <>
            <Field label={tr({ en: "Batch", ar: "التشغيلة" })}>
              <select className={inputCls} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">{tr({ en: "— choose —", ar: "— اختر —" })}</option>
                {liveBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {batchLabel(b)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tr({ en: "Change (+/-)", ar: "التغيير (+/-)" })}>
              <input className={inputCls} value={delta} onChange={(e) => setDelta(e.target.value)} inputMode="decimal" placeholder="-2, 5…" />
            </Field>
          </>
        ) : (
          <>
            <Field label={tr({ en: "Quantity", ar: "الكمية" })}>
              <input className={inputCls} value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" autoFocus />
            </Field>
            <Field label={tr({ en: "Batch (optional — else FEFO)", ar: "التشغيلة (اختياري — وإلا FEFO)" })}>
              <select className={inputCls} value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                <option value="">{tr({ en: "Auto (earliest expiry)", ar: "تلقائي (الأقرب انتهاءً)" })}</option>
                {liveBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {batchLabel(b)}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        <div className="sm:col-span-2">
          <Field label={isAdjust ? tr({ en: "Reason (required)", ar: "السبب (مطلوب)" }) : tr({ en: "Reason", ar: "السبب" })}>
            <input className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Item detail (batches + recent movements) — read only
// ---------------------------------------------------------------------------

export function DetailModal({ onClose, notify, item }: Omit<Common, "onDone"> & { item: Item }) {
  const { tr } = useLang();
  const fmt = useFmt();
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [history, setHistory] = useState<PurchaseHistory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .itemDetail(item.id)
      .then((d) => {
        if (alive) setDetail(d);
      })
      .catch((e) => notify("error", e instanceof ApiError ? e.message : String(e)))
      .finally(() => {
        if (alive) setLoading(false);
      });
    // Purchase (supplier price) history — independent, non-blocking.
    api
      .itemPurchaseHistory(item.id)
      .then((h) => {
        if (alive) setHistory(h);
      })
      .catch((e) => notify("error", e instanceof ApiError ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [item.id, notify]);

  return (
    <ModalShell onClose={onClose} title={tr({ en: item.nameEn, ar: item.nameAr })} saving={false} onSave={null}>
      {loading || !detail ? (
        <p className="text-sm text-muted">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>
              {tr({ en: "On hand", ar: "المتاح" })}: <span className="font-bold text-ink">{fmt.qty(detail.item.onHand)} {detail.item.unit}</span>
            </span>
            <span>
              {tr({ en: "Value", ar: "القيمة" })}: <span className="font-bold text-ink">{fmt.money(detail.item.valuation)}</span>
            </span>
            {detail.item.lowStock && <Badge tone="warn">{tr({ en: "Low stock", ar: "مخزون منخفض" })}</Badge>}
          </div>

          <div>
            <h4 className="mb-1.5 text-sm font-bold text-ink">{tr({ en: "Batches", ar: "التشغيلات" })}</h4>
            {detail.batches.length === 0 ? (
              <p className="text-sm text-muted">{tr({ en: "No batches.", ar: "لا توجد تشغيلات." })}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-primary/10">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="border-b border-primary/10 text-xs text-muted">
                      <th className="px-3 py-2 text-start font-semibold">{tr({ en: "Lot", ar: "التشغيلة" })}</th>
                      <th className="px-3 py-2 text-end font-semibold">{tr({ en: "Remaining", ar: "المتبقي" })}</th>
                      <th className="px-3 py-2 text-end font-semibold">{tr({ en: "Unit cost", ar: "تكلفة الوحدة" })}</th>
                      <th className="px-3 py-2 text-start font-semibold">{tr({ en: "Expiry", ar: "الانتهاء" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.batches.map((b) => (
                      <tr key={b.id} className="border-b border-primary/5 last:border-0">
                        <td className="px-3 py-2 text-ink">{b.lotNumber || "—"}</td>
                        <td className="px-3 py-2 text-end text-ink">{fmt.qty(b.remainingQty)}</td>
                        <td className="px-3 py-2 text-end text-muted">{fmt.money(b.unitCost)}</td>
                        <td className="px-3 py-2 text-muted">{fmt.date(b.expiryDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-1.5 text-sm font-bold text-ink">{tr({ en: "Recent movements", ar: "أحدث الحركات" })}</h4>
            {detail.movements.length === 0 ? (
              <p className="text-sm text-muted">{tr({ en: "No movements.", ar: "لا توجد حركات." })}</p>
            ) : (
              <div className="divide-y divide-primary/10 rounded-lg border border-primary/10">
                {detail.movements.map((m) => {
                  const positive = m.quantityDelta >= 0;
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <div className="min-w-0">
                        <Badge tone={m.type === "wastage" ? "danger" : m.type === "receipt" ? "ok" : "muted"}>{tr(MOVEMENT_LABEL[m.type])}</Badge>
                        <span className="ms-2 text-xs text-muted">{fmt.dateTime(m.createdAt)}</span>
                      </div>
                      <span className={`shrink-0 font-semibold ${positive ? "text-emerald-600" : "text-red-600"}`}>
                        {positive ? "+" : ""}
                        {fmt.qty(m.quantityDelta)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h4 className="mb-1.5 text-sm font-bold text-ink">{tr({ en: "Purchase history", ar: "سجل الشراء" })}</h4>
            {!history || history.purchaseHistory.length === 0 ? (
              <p className="text-sm text-muted">{tr({ en: "No purchases recorded.", ar: "لا توجد مشتريات مسجلة." })}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-primary/10">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b border-primary/10 text-xs text-muted">
                      <th className="px-3 py-2 text-start font-semibold">{tr({ en: "Date", ar: "التاريخ" })}</th>
                      <th className="px-3 py-2 text-start font-semibold">{tr({ en: "Supplier", ar: "المورد" })}</th>
                      <th className="px-3 py-2 text-end font-semibold">{tr({ en: "Qty", ar: "الكمية" })}</th>
                      <th className="px-3 py-2 text-end font-semibold">{tr({ en: "Unit cost", ar: "تكلفة الوحدة" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.purchaseHistory.map((p) => (
                      <tr key={p.batchId} className="border-b border-primary/5 last:border-0">
                        <td className="px-3 py-2 text-muted">{fmt.date(p.receivedAt)}</td>
                        <td className="px-3 py-2 text-ink">
                          {p.supplier ? tr({ en: p.supplier.nameEn, ar: p.supplier.nameAr }) : "—"}
                        </td>
                        <td className="px-3 py-2 text-end text-ink">{fmt.qty(p.receivedQty)}</td>
                        <td className="px-3 py-2 text-end text-muted">{fmt.money(p.unitCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Shared modal shell with Save/Cancel footer (Save omitted when onSave is null)
// ---------------------------------------------------------------------------

function ModalShell({
  onClose,
  title,
  saving,
  onSave,
  children,
}: {
  onClose: () => void;
  title: string;
  saving: boolean;
  onSave: (() => void) | null;
  children: React.ReactNode;
}) {
  const { tr } = useLang();
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className={btnGhost} onClick={onClose} disabled={saving}>
            {onSave ? tr({ en: "Cancel", ar: "إلغاء" }) : tr({ en: "Close", ar: "إغلاق" })}
          </button>
          {onSave && (
            <button className={btnPrimary} onClick={onSave} disabled={saving}>
              {saving ? tr({ en: "Saving…", ar: "جارٍ الحفظ…" }) : tr({ en: "Save", ar: "حفظ" })}
            </button>
          )}
        </>
      }
    >
      {children}
    </Modal>
  );
}
