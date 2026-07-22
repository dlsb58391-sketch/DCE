import { NextResponse } from "next/server";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { withRoute, errorJson } from "@/lib/server/http";
import { resolvePagination, jsonWithPagination } from "@/lib/server/pagination";
import { isTrashType, listTrash, trashCounts, TRASH_REGISTRY, TRASH_TYPES } from "@/lib/server/trash";

/**
 * Recycle Bin listing.
 *  - GET /api/admin/trash            -> per-type counts overview
 *  - GET /api/admin/trash?type=xxx   -> paginated trashed rows for one type
 *
 * Owner-level roles only. Read-only; restore/purge are separate POST routes.
 */
export const GET = withRoute("admin.trash.GET", adminTrashGET);

async function adminTrashGET(req: Request) {
  const { error } = await requireRole(OWNER_ROLES);
  if (error) return error;

  const sp = new URL(req.url).searchParams;
  const type = sp.get("type");

  if (!type) {
    const counts = await trashCounts();
    const types = TRASH_TYPES.map((t) => ({ type: t, label: TRASH_REGISTRY[t].label, count: counts[t] }));
    const total = types.reduce((sum, t) => sum + t.count, 0);
    return NextResponse.json({ types, total });
  }

  if (!isTrashType(type)) return errorJson("invalid_type", 400);

  // Always paginated (default 50, max 100) — the Recycle Bin can grow large.
  const pg = resolvePagination(sp.get("limit") ?? "50", sp.get("offset"), { defaultLimit: 50, maxLimit: 100 });
  const { items, total } = await listTrash(type, pg.limit, pg.offset);
  return jsonWithPagination({ type, items, total }, total, pg);
}
