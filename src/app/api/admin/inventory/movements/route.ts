import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/server/guard";
import { getPagination, jsonWithPagination } from "@/lib/server/pagination";
import { withRoute } from "@/lib/server/http";
import { serializeMovement } from "@/lib/server/inventory-ops";
import { isMovementType } from "@/lib/server/inventory";
import { resolveBranchScope, branchWhereFilter } from "@/lib/server/branch-context";

/**
 * Stock movement ledger (append-only history), newest first. Readable by any
 * signed-in staff member. Optional filters: `?itemId=` and `?type=` (receipt |
 * consumption | wastage | adjustment | transfer | return). Each row carries its
 * item's name/unit for display. Defaults to the 50 most recent; `?limit`/
 * `?offset` page further and add the standard `X-Total-Count` header. Scoped to
 * the caller's active branch (owners in the all-branches view see all).
 */
export const GET = withRoute("admin.inventory.movements.GET", movementsGet);

async function movementsGet(req: Request) {
  const { error, session } = await requireSession();
  if (error) return error;

  const sp = new URL(req.url).searchParams;
  const where: Record<string, unknown> = {};
  const itemId = sp.get("itemId");
  if (itemId && itemId.trim()) where.itemId = itemId.trim();
  const type = sp.get("type");
  if (type && isMovementType(type)) where.type = type;

  // Restrict to the active branch's own movements; merge via AND so it never
  // clobbers the itemId/type filters above.
  const scope = await resolveBranchScope({ role: session?.role });
  const branchFilter = branchWhereFilter(scope);
  if (Object.keys(branchFilter).length) where.AND = [branchFilter];

  const pg = getPagination(req, { defaultLimit: 50, maxLimit: 200 });
  const take = pg.take ?? 50;
  const skip = pg.skip ?? 0;
  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: { item: { select: { nameEn: true, nameAr: true, unit: true } } },
    }),
    prisma.stockMovement.count({ where }),
  ]);
  return jsonWithPagination({ movements: rows.map(serializeMovement) }, total, pg);
}
