"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/language";
import { api, ApiError } from "./api";
import type { Movement, MovementType } from "./types";
import { Badge, inputCls, MOVEMENT_LABEL, useFmt } from "./ui";

type Notify = (kind: "ok" | "error", text: string) => void;

const TYPES: MovementType[] = ["receipt", "consumption", "wastage", "adjustment", "transfer", "return"];

export function MovementsTab({ notify }: { notify: Notify }) {
  const { tr } = useLang();
  const fmt = useFmt();
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<string>("");

  // Re-fetch whenever the type filter changes; state is set only from the
  // async callback so the effect body itself never calls setState.
  useEffect(() => {
    let alive = true;
    api
      .listMovements({ type: type || undefined, limit: 100 })
      .then((r) => {
        if (alive) setMovements(r.movements);
      })
      .catch((e) => notify("error", e instanceof ApiError ? e.message : String(e)))
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [type, notify]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink">{tr({ en: "Stock movements", ar: "حركات المخزون" })}</h2>
        <select className={`${inputCls} max-w-[14rem]`} value={type} onChange={(e) => { setLoading(true); setType(e.target.value); }}>
          <option value="">{tr({ en: "All types", ar: "كل الأنواع" })}</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {tr(MOVEMENT_LABEL[t])}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted">{tr({ en: "Loading…", ar: "جارٍ التحميل…" })}</p>
      ) : movements.length === 0 ? (
        <p className="rounded-xl border border-primary/15 bg-surface px-3.5 py-3 text-sm text-muted">
          {tr({ en: "No movements recorded yet.", ar: "لا توجد حركات مسجلة بعد." })}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-primary/15 bg-surface">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-primary/10 text-start text-xs text-muted">
                <th className="px-3.5 py-2.5 text-start font-semibold">{tr({ en: "When", ar: "التاريخ" })}</th>
                <th className="px-3.5 py-2.5 text-start font-semibold">{tr({ en: "Item", ar: "الصنف" })}</th>
                <th className="px-3.5 py-2.5 text-start font-semibold">{tr({ en: "Type", ar: "النوع" })}</th>
                <th className="px-3.5 py-2.5 text-end font-semibold">{tr({ en: "Qty", ar: "الكمية" })}</th>
                <th className="px-3.5 py-2.5 text-end font-semibold">{tr({ en: "Value", ar: "القيمة" })}</th>
                <th className="px-3.5 py-2.5 text-start font-semibold">{tr({ en: "By / reason", ar: "بواسطة / السبب" })}</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const positive = m.quantityDelta >= 0;
                return (
                  <tr key={m.id} className="border-b border-primary/5 last:border-0">
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-muted">{fmt.dateTime(m.createdAt)}</td>
                    <td className="px-3.5 py-2.5 font-semibold text-ink">
                      {m.item ? tr({ en: m.item.nameEn, ar: m.item.nameAr }) : "—"}
                    </td>
                    <td className="px-3.5 py-2.5">
                      <Badge tone={m.type === "wastage" ? "danger" : m.type === "receipt" ? "ok" : "muted"}>{tr(MOVEMENT_LABEL[m.type])}</Badge>
                    </td>
                    <td className={`whitespace-nowrap px-3.5 py-2.5 text-end font-semibold ${positive ? "text-emerald-600" : "text-red-600"}`}>
                      {positive ? "+" : ""}
                      {fmt.qty(m.quantityDelta)} {m.item?.unit ?? ""}
                    </td>
                    <td className="whitespace-nowrap px-3.5 py-2.5 text-end text-muted">{m.totalCost == null ? "—" : fmt.money(m.totalCost)}</td>
                    <td className="px-3.5 py-2.5 text-muted">
                      {[m.actorName, m.reason].filter(Boolean).join(" · ") || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
