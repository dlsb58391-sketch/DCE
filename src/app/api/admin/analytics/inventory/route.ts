import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { num } from "@/lib/server/money";
import { withRoute } from "@/lib/server/http";
import { normalizeRange, rangeStart, summarizeConsumption } from "@/lib/server/analytics-inventory";

/**
 * Inventory consumption analytics: how much stock the clinic used (and wasted) in
 * a time range, plus the top items by value. Derived read-only from the append-only
 * StockMovement ledger — no stock is changed. `range` matches the Analytics
 * dashboard selector (default 12m). Readable by any signed-in staff member.
 *   GET /api/admin/analytics/inventory?range=30d|90d|12m|all
 *
 * Separate from /api/admin/analytics so that route's response stays unchanged.
 */
export const GET = withRoute("admin.analytics.inventory.GET", inventoryAnalyticsGet);

async function inventoryAnalyticsGet(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const range = normalizeRange(new URL(req.url).searchParams.get("range"));
  const since = rangeStart(range);

  const movements = await prisma.stockMovement.findMany({
    where: {
      type: { in: ["consumption", "wastage"] },
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    select: {
      itemId: true,
      type: true,
      quantityDelta: true,
      unitCost: true,
      totalCost: true,
      item: { select: { nameEn: true, nameAr: true, unit: true } },
    },
  });

  const summary = summarizeConsumption(
    movements.map((m) => ({
      itemId: m.itemId,
      type: m.type,
      quantityDelta: num(m.quantityDelta),
      unitCost: m.unitCost == null ? null : num(m.unitCost),
      totalCost: m.totalCost == null ? null : num(m.totalCost),
      item: m.item,
    })),
  );

  return NextResponse.json({ range, ...summary });
}
