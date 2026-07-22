import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";
import { withRoute, errorJson } from "@/lib/server/http";
import { itemPurchaseHistory } from "@/lib/server/purchasing-insights";

/**
 * Supplier price history for one item: its most recent receipts (newest first)
 * with supplier, unit cost, quantity and date. Read-only; any signed-in staff.
 * `?limit=` caps the rows (default 20, max 100).
 */
export const GET = withRoute("admin.inventory.items.id.purchaseHistory.GET", purchaseHistoryGet);

async function purchaseHistoryGet(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  const raw = new URL(req.url).searchParams.get("limit");
  const limit = raw != null && Number.isFinite(Number(raw)) ? Math.floor(Number(raw)) : 20;

  const r = await itemPurchaseHistory(id, limit);
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message });
  return NextResponse.json(r.data);
}
