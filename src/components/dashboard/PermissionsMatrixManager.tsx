"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/language";

type Role = "admin" | "doctor" | "staff";
type PermissionKey =
  | "finance.day_close.view"
  | "finance.day_close.create"
  | "finance.owner_dashboard.view"
  | "finance.refund.create"
  | "finance.aging.view"
  | "finance.ap_aging.view"
  | "finance.statement.view"
  | "finance.export_pack.create"
  | "admin.permissions.manage";

type EffectivePermission = { permissionKey: PermissionKey; source: "default" | "role_override" | "user_override"; allowed: boolean };
type UserLite = { id: string; name: string; email: string; role: string };

type PermissionsApi = {
  permissionKeys: PermissionKey[];
  roles: Role[];
  roleDefaults: Record<Role, Partial<Record<PermissionKey, boolean>>>;
  roleMatrix: Record<Role, Partial<Record<PermissionKey, boolean>>>;
  userOverrides: Record<string, Partial<Record<PermissionKey, "allow" | "deny">>>;
  users: UserLite[];
  effectiveByUser: Record<string, Record<PermissionKey, EffectivePermission>>;
};

const permissionLabels: Record<PermissionKey, { en: string; ar: string }> = {
  "finance.day_close.view": { en: "Day close: view", ar: "إقفال اليومية: عرض" },
  "finance.day_close.create": { en: "Day close: create", ar: "إقفال اليومية: إنشاء" },
  "finance.owner_dashboard.view": { en: "Owner dashboard: view", ar: "لوحة المالك: عرض" },
  "finance.refund.create": { en: "Refunds: create", ar: "المرتجعات: إنشاء" },
  "finance.aging.view": { en: "AR aging: view", ar: "تقادم الذمم: عرض" },
  "finance.ap_aging.view": { en: "AP aging: view", ar: "تقادم الذمم الدائنة: عرض" },
  "finance.statement.view": { en: "Statements: view", ar: "كشوف الحساب: عرض" },
  "finance.export_pack.create": { en: "Export pack: create", ar: "حزمة التصدير: إنشاء" },
  "admin.permissions.manage": { en: "Permissions admin", ar: "إدارة الصلاحيات" },
};

const roleLabel = (role: Role, tr: (m: { en: string; ar: string }) => string): string => {
  if (role === "admin") return tr({ en: "Admin", ar: "مدير" });
  if (role === "doctor") return tr({ en: "Doctor", ar: "طبيب" });
  return tr({ en: "Staff", ar: "موظف" });
};

export function PermissionsMatrixManager() {
  const { tr } = useLang();
  const [data, setData] = useState<PermissionsApi | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const res = await fetch("/api/admin/permissions", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }
      if (!res.ok) throw new Error("load_failed");
      const body = (await res.json()) as PermissionsApi;
      setData(body);
      setSelectedUserId((prev) => prev || body.users[0]?.id || "");
    } catch {
      setError(tr({ en: "Could not load permissions.", ar: "تعذر تحميل الصلاحيات." }));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tr]);

  useEffect(() => {
    load();
  }, [load]);

  const patch = useCallback(
    async (payload: { rolePermissions?: Array<{ role: Role; permissionKey: PermissionKey; allowed: boolean | null }>; userOverrides?: Array<{ userId: string; permissionKey: PermissionKey; effect: "allow" | "deny" | "inherit" }> }) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/permissions", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.status === 401 || res.status === 403) {
          setForbidden(true);
          return;
        }
        if (!res.ok) throw new Error("save_failed");
        const body = (await res.json()) as PermissionsApi;
        setData(body);
      } catch {
        setError(tr({ en: "Could not save permission changes.", ar: "تعذر حفظ تغييرات الصلاحيات." }));
      } finally {
        setSaving(false);
      }
    },
    [tr],
  );

  const effectiveRows = useMemo(() => {
    if (!data || !selectedUserId) return [] as EffectivePermission[];
    const record = data.effectiveByUser[selectedUserId] ?? {};
    return data.permissionKeys.map((k) => record[k]).filter(Boolean) as EffectivePermission[];
  }, [data, selectedUserId]);

  if (forbidden) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-rose-300/30 bg-rose-50 p-6 text-sm text-rose-700">
        {tr({ en: "This screen is restricted to admins with permission management access.", ar: "هذه الشاشة متاحة فقط للمديرين بصلاحية إدارة الصلاحيات." })}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-extrabold text-ink">{tr({ en: "Permissions Matrix", ar: "مصفوفة الصلاحيات" })}</h1>
        <p className="text-sm text-muted">{tr({ en: "Role defaults with per-user allow/deny overrides.", ar: "افتراضات الأدوار مع تجاوزات السماح/المنع لكل مستخدم." })}</p>
      </div>

      {error ? <div className="rounded-lg border border-rose-300/30 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
      {loading && !data ? <div className="rounded-2xl border border-primary/12 bg-surface p-6 text-sm text-muted">{tr({ en: "Loading...", ar: "جارٍ التحميل..." })}</div> : null}

      {data ? (
        <>
          <section className="rounded-2xl border border-primary/12 bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">{tr({ en: "Role permission matrix", ar: "مصفوفة صلاحيات الأدوار" })}</h2>
              {saving ? <span className="text-xs text-muted">{tr({ en: "Saving...", ar: "جارٍ الحفظ..." })}</span> : null}
            </div>
            <div className="overflow-auto rounded-xl border border-primary/10">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-surface-2 text-xs text-muted">
                  <tr>
                    <th className="px-3 py-2 text-start">{tr({ en: "Permission", ar: "الصلاحية" })}</th>
                    {data.roles.map((role) => (
                      <th key={role} className="px-3 py-2 text-center">{roleLabel(role, tr)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.permissionKeys.map((key) => (
                    <tr key={key} className="border-t border-primary/8">
                      <td className="px-3 py-2 text-ink">{tr(permissionLabels[key])}</td>
                      {data.roles.map((role) => {
                        const override = data.roleMatrix[role]?.[key];
                        const base = data.roleDefaults[role]?.[key] ?? false;
                        const value = override ?? base;
                        return (
                          <td key={`${role}:${key}`} className="px-3 py-2 text-center">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={!!value}
                                onChange={(e) => patch({ rolePermissions: [{ role, permissionKey: key, allowed: e.target.checked }] })}
                                className="h-4 w-4 accent-primary"
                              />
                              <button
                                type="button"
                                onClick={() => patch({ rolePermissions: [{ role, permissionKey: key, allowed: null }] })}
                                className="rounded border border-primary/20 px-1.5 py-0.5 text-[10px] text-muted hover:bg-primary/10"
                              >
                                {tr({ en: "Inherit", ar: "توريث" })}
                              </button>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-primary/12 bg-surface p-4">
            <h2 className="mb-3 text-sm font-bold text-ink">{tr({ en: "User overrides", ar: "تجاوزات المستخدم" })}</h2>
            <div className="mb-3">
              <label className="text-xs text-muted">
                {tr({ en: "User", ar: "المستخدم" })}
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="ms-2 rounded-lg border border-primary/15 bg-background px-2 py-1.5 text-sm text-ink outline-none focus:border-primary"
                >
                  {data.users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </label>
            </div>
            {selectedUserId ? (
              <div className="overflow-auto rounded-xl border border-primary/10">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-surface-2 text-xs text-muted">
                    <tr>
                      <th className="px-3 py-2 text-start">{tr({ en: "Permission", ar: "الصلاحية" })}</th>
                      <th className="px-3 py-2 text-center">{tr({ en: "Override", ar: "التجاوز" })}</th>
                      <th className="px-3 py-2 text-center">{tr({ en: "Effective", ar: "الفعّال" })}</th>
                      <th className="px-3 py-2 text-center">{tr({ en: "Source", ar: "المصدر" })}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.permissionKeys.map((key) => {
                      const userOverride = data.userOverrides[selectedUserId]?.[key] ?? "inherit";
                      const eff = data.effectiveByUser[selectedUserId]?.[key];
                      return (
                        <tr key={`user:${key}`} className="border-t border-primary/8">
                          <td className="px-3 py-2 text-ink">{tr(permissionLabels[key])}</td>
                          <td className="px-3 py-2 text-center">
                            <select
                              value={userOverride}
                              onChange={(e) =>
                                patch({
                                  userOverrides: [
                                    {
                                      userId: selectedUserId,
                                      permissionKey: key,
                                      effect: e.target.value as "allow" | "deny" | "inherit",
                                    },
                                  ],
                                })
                              }
                              className="rounded border border-primary/15 bg-background px-2 py-1 text-xs text-ink"
                            >
                              <option value="inherit">{tr({ en: "Inherit", ar: "توريث" })}</option>
                              <option value="allow">{tr({ en: "Allow", ar: "سماح" })}</option>
                              <option value="deny">{tr({ en: "Deny", ar: "منع" })}</option>
                            </select>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`rounded px-2 py-0.5 text-xs font-bold ${eff?.allowed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                              {eff?.allowed ? tr({ en: "Allowed", ar: "مسموح" }) : tr({ en: "Denied", ar: "ممنوع" })}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center text-xs text-muted">{eff?.source ?? "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted">{tr({ en: "No users available.", ar: "لا يوجد مستخدمون." })}</p>
            )}
          </section>

          <section className="rounded-2xl border border-primary/12 bg-surface p-4">
            <h2 className="mb-2 text-sm font-bold text-ink">{tr({ en: "Effective permissions snapshot", ar: "لقطة الصلاحيات الفعالة" })}</h2>
            <p className="text-xs text-muted">{tr({ en: "Resolved using: user override > role override > default policy.", ar: "يتم الحسم حسب: تجاوز المستخدم > تجاوز الدور > الافتراضي." })}</p>
            <div className="mt-2 text-xs text-muted">{effectiveRows.length} {tr({ en: "permissions resolved", ar: "صلاحية محسوبة" })}</div>
          </section>
        </>
      ) : null}
    </div>
  );
}
