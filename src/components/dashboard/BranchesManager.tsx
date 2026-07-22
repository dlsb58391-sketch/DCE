"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/language";

type Branch = {
  id: string;
  nameEn: string;
  nameAr: string;
  code: string;
  phone: string | null;
  whatsappNumber: string | null;
  address: string | null;
  active: boolean;
  sortOrder: number;
  notes: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  nameEn: string;
  nameAr: string;
  code: string;
  phone: string;
  whatsappNumber: string;
  address: string;
  sortOrder: string;
  active: boolean;
  notes: string;
};

const inputCls =
  "w-full rounded-lg border border-primary/15 bg-surface px-3 py-2 text-ink outline-none focus:border-primary";

const emptyForm: FormState = {
  nameEn: "",
  nameAr: "",
  code: "",
  phone: "",
  whatsappNumber: "",
  address: "",
  sortOrder: "0",
  active: true,
  notes: "",
};

export function BranchesManager() {
  const { tr, lang } = useLang();
  const [rows, setRows] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [canWrite, setCanWrite] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const [editing, setEditing] = useState<Branch | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setCanWrite(j?.user?.role === "admin" || j?.user?.role === "doctor"))
      .catch(() => setCanWrite(false));
  }, []);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/branches?includeInactive=1", { cache: "no-store" });
        if (res.ok && alive) {
          const j = await res.json();
          setRows(j.branches ?? []);
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

  const activeCount = useMemo(() => rows.filter((b) => b.active).length, [rows]);

  const remove = useCallback(
    async (b: Branch) => {
      if (b.isDefault) return;
      const msg = tr({
        en: `Delete branch "${b.nameEn || b.nameAr}"? It moves to the Recycle Bin; its records are kept and become unassigned.`,
        ar: `حذف الفرع "${b.nameAr || b.nameEn}"؟ سينتقل إلى سلة المحذوفات؛ تبقى سجلاته بدون فرع.`,
      });
      if (!window.confirm(msg)) return;
      setBusyId(b.id);
      setNotice(null);
      try {
        const res = await fetch(`/api/admin/branches/${b.id}`, { method: "DELETE" });
        if (res.ok) {
          setNotice({ kind: "ok", text: tr({ en: "Branch deleted.", ar: "تم حذف الفرع." }) });
          reload();
        } else {
          const j = await res.json().catch(() => null);
          setNotice({
            kind: "error",
            text: j?.error?.message || tr({ en: "Could not delete branch.", ar: "تعذر حذف الفرع." }),
          });
        }
      } finally {
        setBusyId(null);
      }
    },
    [reload, tr],
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{tr({ en: "Branches", ar: "الفروع" })}</h1>
          <p className="text-sm text-ink/60">
            {tr({
              en: "Manage the physical locations of your clinic.",
              ar: "إدارة الفروع الفعلية لعيادتك.",
            })}
          </p>
        </div>
        {canWrite && (
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setCreating(true);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {tr({ en: "New branch", ar: "فرع جديد" })}
          </button>
        )}
      </header>

      {notice && (
        <div
          role="status"
          className={
            "rounded-lg px-3 py-2 text-sm " +
            (notice.kind === "error"
              ? "bg-red-500/10 text-red-600"
              : "bg-emerald-500/10 text-emerald-600")
          }
        >
          {notice.text}
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-ink/50">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-primary/10 bg-surface p-10 text-center text-ink/60">
          {tr({ en: "No branches yet.", ar: "لا توجد فروع بعد." })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-primary/10 bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/10 text-start text-ink/60">
                <th className="px-3 py-2 text-start font-medium">{tr({ en: "Name", ar: "الاسم" })}</th>
                <th className="px-3 py-2 text-start font-medium">{tr({ en: "Code", ar: "الرمز" })}</th>
                <th className="px-3 py-2 text-start font-medium">{tr({ en: "Phone", ar: "الهاتف" })}</th>
                <th className="px-3 py-2 text-start font-medium">{tr({ en: "WhatsApp", ar: "واتساب" })}</th>
                <th className="px-3 py-2 text-start font-medium">{tr({ en: "Status", ar: "الحالة" })}</th>
                {canWrite && <th className="px-3 py-2 text-end font-medium">{tr({ en: "Actions", ar: "إجراءات" })}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-b border-primary/5 last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-medium text-ink">{lang === "ar" ? b.nameAr || b.nameEn : b.nameEn || b.nameAr}</span>
                    {b.isDefault && (
                      <span className="ms-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                        {tr({ en: "Default", ar: "افتراضي" })}
                      </span>
                    )}
                    {b.address && <div className="text-xs text-ink/50">{b.address}</div>}
                  </td>
                  <td className="px-3 py-2 font-mono text-ink/80">{b.code}</td>
                  <td className="px-3 py-2 text-ink/80">{b.phone || "—"}</td>
                  <td className="px-3 py-2 text-ink/80" dir="ltr">{b.whatsappNumber || "—"}</td>
                  <td className="px-3 py-2">
                    {b.active ? (
                      <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600">
                        {tr({ en: "Active", ar: "نشط" })}
                      </span>
                    ) : (
                      <span className="rounded bg-ink/10 px-2 py-0.5 text-xs text-ink/60">
                        {tr({ en: "Archived", ar: "مؤرشف" })}
                      </span>
                    )}
                  </td>
                  {canWrite && (
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setNotice(null);
                            setEditing(b);
                          }}
                          className="rounded-md border border-primary/20 px-2.5 py-1 text-xs text-ink hover:bg-primary/5"
                        >
                          {tr({ en: "Edit", ar: "تعديل" })}
                        </button>
                        {!b.isDefault && (
                          <button
                            type="button"
                            disabled={busyId === b.id}
                            onClick={() => remove(b)}
                            className="rounded-md border border-red-500/30 px-2.5 py-1 text-xs text-red-600 hover:bg-red-500/5 disabled:opacity-50"
                          >
                            {tr({ en: "Delete", ar: "حذف" })}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ink/40">
        {tr({
          en: `${rows.length} branch(es), ${activeCount} active.`,
          ar: `${rows.length} فرع، ${activeCount} نشط.`,
        })}
      </p>

      {(creating || editing) && (
        <BranchModal
          branch={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(text) => {
            setCreating(false);
            setEditing(null);
            setNotice({ kind: "ok", text });
            reload();
          }}
          onError={(text) => setNotice({ kind: "error", text })}
        />
      )}
    </div>
  );
}

function BranchModal({
  branch,
  onClose,
  onSaved,
  onError,
}: {
  branch: Branch | null;
  onClose: () => void;
  onSaved: (text: string) => void;
  onError: (text: string) => void;
}) {
  const { tr } = useLang();
  const isEdit = !!branch;
  const [form, setForm] = useState<FormState>(
    branch
      ? {
          nameEn: branch.nameEn,
          nameAr: branch.nameAr,
          code: branch.code,
          phone: branch.phone ?? "",
          whatsappNumber: branch.whatsappNumber ?? "",
          address: branch.address ?? "",
          sortOrder: String(branch.sortOrder),
          active: branch.active,
          notes: branch.notes ?? "",
        }
      : emptyForm,
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = useCallback(async () => {
    if (!form.nameEn.trim() && !form.nameAr.trim()) {
      onError(tr({ en: "A branch name is required.", ar: "اسم الفرع مطلوب." }));
      return;
    }
    if (!form.code.trim()) {
      onError(tr({ en: "A branch code is required.", ar: "رمز الفرع مطلوب." }));
      return;
    }
    setSaving(true);
    const payload = {
      nameEn: form.nameEn.trim() || form.nameAr.trim(),
      nameAr: form.nameAr.trim() || form.nameEn.trim(),
      code: form.code.trim(),
      phone: form.phone.trim() || null,
      whatsappNumber: form.whatsappNumber.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      active: form.active,
    };
    try {
      const res = await fetch(isEdit ? `/api/admin/branches/${branch!.id}` : "/api/admin/branches", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onSaved(isEdit ? tr({ en: "Branch updated.", ar: "تم تحديث الفرع." }) : tr({ en: "Branch created.", ar: "تم إنشاء الفرع." }));
      } else {
        const j = await res.json().catch(() => null);
        onError(j?.error?.message || tr({ en: "Could not save branch.", ar: "تعذر حفظ الفرع." }));
      }
    } finally {
      setSaving(false);
    }
  }, [branch, form, isEdit, onError, onSaved, tr]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-ink">
          {isEdit ? tr({ en: "Edit branch", ar: "تعديل الفرع" }) : tr({ en: "New branch", ar: "فرع جديد" })}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">{tr({ en: "Name (EN)", ar: "الاسم (إنجليزي)" })}</span>
            <input className={inputCls} value={form.nameEn} onChange={(e) => set("nameEn", e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">{tr({ en: "Name (AR)", ar: "الاسم (عربي)" })}</span>
            <input className={inputCls} value={form.nameAr} onChange={(e) => set("nameAr", e.target.value)} dir="rtl" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">{tr({ en: "Code", ar: "الرمز" })}</span>
            <input
              className={inputCls}
              value={form.code}
              onChange={(e) => set("code", e.target.value)}
              placeholder="MAIN"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">{tr({ en: "Sort order", ar: "الترتيب" })}</span>
            <input
              type="number"
              min={0}
              className={inputCls}
              value={form.sortOrder}
              onChange={(e) => set("sortOrder", e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">{tr({ en: "Phone", ar: "الهاتف" })}</span>
            <input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">{tr({ en: "WhatsApp number", ar: "رقم واتساب" })}</span>
            <input
              className={inputCls}
              value={form.whatsappNumber}
              onChange={(e) => set("whatsappNumber", e.target.value)}
              placeholder="+20…"
              dir="ltr"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">{tr({ en: "Address", ar: "العنوان" })}</span>
            <input className={inputCls} value={form.address} onChange={(e) => set("address", e.target.value)} />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-ink/70">{tr({ en: "Notes", ar: "ملاحظات" })}</span>
            <textarea
              className={inputCls}
              rows={2}
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
            <span className="text-ink/80">{tr({ en: "Active", ar: "نشط" })}</span>
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-primary/20 px-4 py-2 text-sm text-ink hover:bg-primary/5"
          >
            {tr({ en: "Cancel", ar: "إلغاء" })}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? tr({ en: "Saving…", ar: "جارٍ الحفظ…" }) : tr({ en: "Save", ar: "حفظ" })}
          </button>
        </div>
      </div>
    </div>
  );
}
