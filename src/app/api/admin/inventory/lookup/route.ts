import { NextResponse } from "next/server";
import { requireSession } from "@/lib/server/guard";
import { withRoute, errorJson } from "@/lib/server/http";
import { lookupItem } from "@/lib/server/inventory-ops";

/**
 * Barcode / SKU lookup for scanning workflows. Returns the matching item with
 * its current stock (same shape as the item-detail endpoint). Readable by any
 * signed-in staff member. Accepts `?barcode=`, `?sku=` or a generic `?code=`.
 */
export const GET = withRoute("admin.inventory.lookup.GET", lookupGet);

async function lookupGet(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const sp = new URL(req.url).searchParams;
  const code = sp.get("code") ?? sp.get("barcode") ?? sp.get("sku") ?? "";
  const r = await lookupItem(code);
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}
