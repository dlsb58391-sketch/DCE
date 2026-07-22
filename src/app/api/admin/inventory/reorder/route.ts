import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";
import { withRoute } from "@/lib/server/http";
import { reorderReport } from "@/lib/server/purchasing-insights";

/**
 * Reorder suggestions: active items at/below their reorder level, each annotated
 * with quantity already on order (open POs), a suggested quantity to buy, and the
 * last purchase (supplier + unit cost + date). Read-only; any signed-in staff.
 */
export const GET = withRoute("admin.inventory.reorder.GET", reorderGet);

async function reorderGet() {
  const { error } = await requireSession();
  if (error) return error;

  const report = await reorderReport();
  return NextResponse.json(report);
}
