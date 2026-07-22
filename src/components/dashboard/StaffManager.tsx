"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/language";

type Branch = {
  id: string;
  nameEn: string;
  nameAr: string;
  code: string;
};

type StaffUser = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  role: string;
  branchId: string | null;
  branch: { nameEn: string; nameAr: string; code: string } | null;
  createdAt: string;
};

type FormState = {
  name: string;
  email: string;
  username: string;
  password: string;
  role: string;
  branchId: string;
};

const inputCls =
  "w-full rounded-lg border border-primary/15 bg-surface px-3 py-2 text-ink outline-none focus:border-primary";

const emptyForm: FormState = {
  name: "",
  email: "",
  username: "",
  password: "",
  role: "staff",
  branchId: "",
};

const ROLE_OPTIONS = ["admin", "doctor", "staff"] as const;

function roleLabel(role: string, tr: (m: { en: string; ar: string }) => string): string {
  switch (role) {
    case "admin":
      return tr({ en: "Admin / Owner", ar: "مدير / مالك" });
    case "doctor":
      return tr({ en: "Doctor", ar: "طبيب" });
    default:
      return tr({ en: "Staff / Reception", ar: "موظف / استقبال" });
  }
}

export function StaffManager() {
  const { tr, lang } = useLang();
  const [rows, setRows] = useState<StaffUser[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        setIsAdmin(j?.user?.role === "admin");
        setMeId(j?.user?.sub ?? null);
      })
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    if (isAdmin !== true) return;
    let alive = true;
    const run = async () => {
      setLoading(true);
      try {
        const [usersRes, branchesRes] = await Promise.all([
          fetch("/api/admin/users", { cache: "no-store" }),
          fetch("/api/admin/branches?includeInactive=1", { cache: "no-store" }),
        ]);
        if (alive && usersRes.ok) {
          const j = await usersRes.json();
          setRows(j.users ?? []);
        }
        if (alive && branchesRes.ok) {
          const j = await branchesRes.json();
          setBranches((j.branches ?? []) as Branch[]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [reloadKey, isAdmin]);

  const branchName = useCallback(
    (b: { nameEn: string; nameAr: string } | null) =>
      b ? (lang === "ar" ? b.nameAr || b.nameEn : b.nameEn || b.nameAr) : null,
    [lang],
  );

  const remove = useCallback(
    async (u: StaffUser) => {
      const msg = tr({
        en: `Delete account "${u.name}" (${u.email})? This cannot be undone.`,
        ar: `حذف حساب "${u.name}" (${u.email})؟ لا يمكن التراجع عن هذا.`,
      });
      if (!window.confirm(msg)) return;
      setBusyId(u.id);
      setNotice(null);
      try {
        const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
        if (res.ok) {
          setNotice({ kind: "ok", text: tr({ en: "Account deleted.", ar: "تم حذف الحساب." }) });
          reload();
        } else {
          const j = await res.json().catch(() => null);
          setNotice({
            kind: "error",
            text: j?.error?.message || tr({ en: "Could not delete account.", ar: "تعذر حذف الحساب." }),
          });
        }
      } finally {
        setBusyId(null);
      }
    },
    [reload, tr],
  );

  if (isAdmin === false) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4">
        <div className="rounded-xl border border-primary/10 bg-surface p-10 text-center text-ink/60">
          {tr({
            en: "Only an admin can manage staff accounts.",
            ar: "يمكن لمدير فقط إدارة حسابات الموظفين.",
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">{tr({ en: "Staff accounts", ar: "حسابات الموظفين" })}</h1>
          <p className="text-sm text-ink/60">
            {tr({
              en: "Manage who can sign in. Assign a home branch to scope their view.",
              ar: "إدارة من يمكنه تسجيل الدخول. عيّن فرعًا رئيسيًا لتحديد نطاق عرضه.",
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setNotice(null);
            setCreating(true);
          }}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {tr({ en: "New account", ar: "حساب جديد" })}
        </button>
      </header>

      {notice && (
        <div
          role="status"
          className={
            "rounded-lg px-3 py-2 text-sm " +
            (notice.kind === "error" ? "bg-red-500/10 text-red-600" : "bg-emerald-500/10 text-emerald-600")
          }
        >
          {notice.text}
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-ink/50">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-primary/10 bg-surface p-10 text-center text-ink/60">
          {tr({ en: "No accounts yet.", ar: "لا توجد حسابات بعد." })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-primary/10 bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-primary/10 text-start text-ink/60">
                <th className="px-3 py-2 text-start font-medium">{tr({ en: "Name", ar: "الاسم" })}</th>
                <th className="px-3 py-2 text-start font-medium">{tr({ en: "Login", ar: "الدخول" })}</th>
                <th className="px-3 py-2 text-start font-medium">{tr({ en: "Role", ar: "الدور" })}</th>
                <th className="px-3 py-2 text-start font-medium">{tr({ en: "Branch", ar: "الفرع" })}</th>
                <th className="px-3 py-2 text-end font-medium">{tr({ en: "Actions", ar: "إجراءات" })}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-primary/5 last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-medium text-ink">{u.name}</span>
                    {meId === u.id && (
                      <span className="ms-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                        {tr({ en: "You", ar: "أنت" })}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-ink/80">
                    <div dir="ltr" className="text-start">{u.email}</div>
                    {u.username && <div className="text-xs text-ink/50" dir="ltr">@{u.username}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">{roleLabel(u.role, tr)}</span>
                  </td>
                  <td className="px-3 py-2 text-ink/80">
                    {branchName(u.branch) || tr({ en: "All / none", ar: "الكل / لا شيء" })}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setNotice(null);
                          setEditing(u);
                        }}
                        className="rounded-md border border-primary/20 px-2.5 py-1 text-xs text-ink hover:bg-primary/5"
                      >
                        {tr({ en: "Edit", ar: "تعديل" })}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === u.id || meId === u.id}
                        onClick={() => remove(u)}
                        className="rounded-md border border-red-500/30 px-2.5 py-1 text-xs text-red-600 hover:bg-red-500/5 disabled:opacity-40"
                        title={meId === u.id ? tr({ en: "You cannot delete your own account.", ar: "لا يمكنك حذف حسابك." }) : undefined}
                      >
                        {tr({ en: "Delete", ar: "حذف" })}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ink/40">
        {tr({ en: `${rows.length} account(s).`, ar: `${rows.length} حساب.` })}
      </p>

      {(creating || editing) && (
        <StaffModal
          user={editing}
          branches={branches}
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

function StaffModal({
  user,
  branches,
  onClose,
  onSaved,
  onError,
}: {
  user: StaffUser | null;
  branches: Branch[];
  onClose: () => void;
  onSaved: (text: string) => void;
  onError: (text: string) => void;
}) {
  const { tr, lang } = useLang();
  const isEdit = !!user;
  const [form, setForm] = useState<FormState>(
    user
      ? {
          name: user.name,
          email: user.email,
          username: user.username ?? "",
          password: "",
          role: user.role,
          branchId: user.branchId ?? "",
        }
      : emptyForm,
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const branchLabel = useMemo(
    () => (b: Branch) => (lang === "ar" ? b.nameAr || b.nameEn : b.nameEn || b.nameAr),
    [lang],
  );

  const submit = useCallback(async () => {
    if (!form.name.trim()) {
      onError(tr({ en: "A name is required.", ar: "الاسم مطلوب." }));
      return;
    }
    if (!form.email.trim()) {
      onError(tr({ en: "An email is required.", ar: "البريد الإلكتروني مطلوب." }));
      return;
    }
    if (!isEdit && form.password.length < 8) {
      onError(tr({ en: "Password must be at least 8 characters.", ar: "يجب أن تكون كلمة المرور 8 أحرف على الأقل." }));
      return;
    }
    setSaving(true);
    // On edit, only send a password when the admin actually typed one.
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      email: form.email.trim(),
      username: form.username.trim() || null,
      role: form.role,
      branchId: form.branchId || null,
    };
    if (!isEdit || form.password.length > 0) payload.password = form.password;
    try {
      const res = await fetch(isEdit ? `/api/admin/users/${user!.id}` : "/api/admin/users", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        onSaved(isEdit ? tr({ en: "Account updated.", ar: "تم تحديث الحساب." }) : tr({ en: "Account created.", ar: "تم إنشاء الحساب." }));
      } else {
        const j = await res.json().catch(() => null);
        onError(j?.error?.message || tr({ en: "Could not save account.", ar: "تعذر حفظ الحساب." }));
      }
    } finally {
      setSaving(false);
    }
  }, [form, isEdit, onError, onSaved, tr, user]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-ink">
          {isEdit ? tr({ en: "Edit account", ar: "تعديل الحساب" }) : tr({ en: "New account", ar: "حساب جديد" })}
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-ink/70">{tr({ en: "Name", ar: "الاسم" })}</span>
            <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">{tr({ en: "Email", ar: "البريد الإلكتروني" })}</span>
            <input
              className={inputCls}
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              dir="ltr"
              autoComplete="off"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">
              {tr({ en: "Username (optional)", ar: "اسم المستخدم (اختياري)" })}
            </span>
            <input
              className={inputCls}
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              dir="ltr"
              autoComplete="off"
              placeholder="reception"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">{tr({ en: "Role", ar: "الدور" })}</span>
            <select className={inputCls} value={form.role} onChange={(e) => set("role", e.target.value)}>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r, tr)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-ink/70">{tr({ en: "Home branch", ar: "الفرع الرئيسي" })}</span>
            <select className={inputCls} value={form.branchId} onChange={(e) => set("branchId", e.target.value)}>
              <option value="">{tr({ en: "— No home branch —", ar: "— بدون فرع رئيسي —" })}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {branchLabel(b)} ({b.code})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-ink/70">
              {isEdit
                ? tr({ en: "New password (leave blank to keep)", ar: "كلمة مرور جديدة (اتركها فارغة للإبقاء)" })
                : tr({ en: "Password", ar: "كلمة المرور" })}
            </span>
            <input
              className={inputCls}
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              dir="ltr"
              autoComplete="new-password"
              placeholder={isEdit ? "••••••••" : ""}
            />
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
