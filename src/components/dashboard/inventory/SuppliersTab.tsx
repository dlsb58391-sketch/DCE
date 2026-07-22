"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { api, ApiError } from "./api";
import type { Supplier } from "./types";
import { Badge, btnDanger, btnGhost, btnPrimary, Field, inputCls, Modal } from "./ui";

type Notify = (kind: "ok" | "error", text: string) => void;

type FormState = {
  nameEn: string;
  nameAr: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  taxId: string;
  paymentTerms: string;
  notes: string;
  active: boolean;
};

const empty: FormState = {
  nameEn: "",
  nameAr: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  taxId: "",
  paymentTerms: "",
  notes: "",
  active: true,
};

function toForm(s: Supplier): FormState {
  return {
    nameEn: s.nameEn,
    nameAr: s.nameAr,
    contactName: s.contactName ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
    address: s.address ?? "",
    taxId: s.taxId ?? "",
    paymentTerms: s.paymentTerms ?? "",
    notes: s.notes ?? "",
    active: s.active,
  };
}

export function SuppliersTab({ notify, canWrite }: { notify: Notify; canWrite: boolean }) {
  const { tr } = useLang();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Refresh after mutations — event-driven; awaited by save/delete handlers.
  const load = useCallback(async () => {
    try {
      setSuppliers((await api.listSuppliers()).suppliers);
    } catch (e) {
      notify("error", e instanceof ApiError ? e.message : String(e));
    }
  }, [notify]);

  // Initial load: inline the fetch so state is only set from the async callback.
  useEffect(() => {
    let alive = true;
    api
      .listSuppliers()
      .then((r) => {
        if (alive) setSuppliers(r.suppliers);
      })
      .catch((e) => notify("error", e instanceof ApiError ? e.message : String(e)))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [notify]);

  const openCreate = () => {
    setForm(empty);
    setEditing(null);
    setCreating(true);
  };
  const openEdit = (s: Supplier) => {
    setForm(toForm(s));
    setEditing(s);
    setCreating(false);
  };
  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const save = async () => {
    if (!form.nameEn.trim() && !form.nameAr.trim()) {
      notify("error", tr({ en: "A supplier name is required.", ar: "اسم المورّد مطلوب." }));
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing) {
        await api.updateSupplier(editing.id, payload);
        notify("ok", tr({ en: "Supplier updated.", ar: "تم تحديث المورّد." }));
      } else {
        await api.createSupplier(payload);
        notify("ok", tr({ en: "Supplier added.", ar: "تمت إضافة المورّد." }));
      }
      close();
      await load();
    } catch (e) {
      notify("error", e instanceof ApiError ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Supplier) => {
    if (!window.confirm(tr({ en: "Move this supplier to the Recycle Bin?", ar: "نقل هذا المورّد إلى سلة المحذوفات؟" }))) return;
    setBusyId(s.id);
    try {
      await api.deleteSupplier(s.id);
      notify("ok", tr({ en: "Supplier deleted.", ar: "تم حذف المورّد." }));
      await load();
    } catch (e) {
      notify("error", e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">{tr({ en: "Suppliers", ar: "الموردون" })}</h2>
        {canWrite && (
          <button className={btnPrimary} onClick={openCreate}>
            {tr({ en: "Add supplier", ar: "إضافة مورّد" })}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</p>
      ) : suppliers.length === 0 ? (
        <p className="rounded-xl border border-primary/15 bg-surface px-3.5 py-3 text-sm text-muted">
          {tr({ en: "No suppliers yet.", ar: "لا يوجد موردون بعد." })}
        </p>
      ) : (
        <div className="divide-y divide-primary/10 rounded-xl border border-primary/15 bg-surface">
          {suppliers.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">
                  {tr({ en: s.nameEn, ar: s.nameAr })}
                  {!s.active && (
                    <span className="ms-2">
                      <Badge>{tr({ en: "Archived", ar: "مؤرشف" })}</Badge>
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {[s.contactName, s.phone, s.email].filter(Boolean).join(" · ") || tr({ en: "No contact details", ar: "لا توجد بيانات تواصل" })}
                </p>
              </div>
              {canWrite && (
                <div className="flex shrink-0 items-center gap-2">
                  <button className={btnGhost} onClick={() => openEdit(s)}>
                    {tr({ en: "Edit", ar: "تعديل" })}
                  </button>
                  <button className={btnDanger} disabled={busyId === s.id} onClick={() => remove(s)}>
                    {tr({ en: "Delete", ar: "حذف" })}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={close}
        title={editing ? tr({ en: "Edit supplier", ar: "تعديل المورّد" }) : tr({ en: "Add supplier", ar: "إضافة مورّد" })}
        footer={
          <>
            <button className={btnGhost} onClick={close} disabled={saving}>
              {tr({ en: "Cancel", ar: "إلغاء" })}
            </button>
            <button className={btnPrimary} onClick={save} disabled={saving}>
              {saving ? tr({ en: "Saving…", ar: "جارٍ الحفظ…" }) : tr({ en: "Save", ar: "حفظ" })}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr({ en: "Name (English)", ar: "الاسم (إنجليزي)" })}>
            <input className={inputCls} value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} />
          </Field>
          <Field label={tr({ en: "Name (Arabic)", ar: "الاسم (عربي)" })}>
            <input className={inputCls} value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} dir="rtl" />
          </Field>
          <Field label={tr({ en: "Contact person", ar: "مسؤول التواصل" })}>
            <input className={inputCls} value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
          </Field>
          <Field label={tr({ en: "Phone", ar: "الهاتف" })}>
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" />
          </Field>
          <Field label={tr({ en: "Email", ar: "البريد" })}>
            <input className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} inputMode="email" />
          </Field>
          <Field label={tr({ en: "Payment terms", ar: "شروط الدفع" })}>
            <input className={inputCls} value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} placeholder="cash, net30…" />
          </Field>
          <Field label={tr({ en: "Tax / registration no.", ar: "الرقم الضريبي / السجل" })}>
            <input className={inputCls} value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
          </Field>
          <Field label={tr({ en: "Address", ar: "العنوان" })}>
            <input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
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
      </Modal>
    </div>
  );
}
