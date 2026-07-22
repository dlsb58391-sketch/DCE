import { NextResponse } from "next/server";
import { requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z } from "@/lib/server/validate";
import { restoreEntity } from "@/lib/server/soft-delete-ops";
import { isTrashType, TRASH_REGISTRY } from "@/lib/server/trash";

const RestoreBody = z.object({
  type: z.string(),
  id: z.string().trim().min(1, "required"),
});

/**
 * Restore a soft-deleted record (and the children trashed with it) from the
 * Recycle Bin. Owner-level roles only. Audited as `<type>.restore`.
 */
export const POST = withRoute("admin.trash.restore.POST", adminTrashRestorePOST);

async function adminTrashRestorePOST(req: Request) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;

  const parsed = await parseJson(req, RestoreBody);
  if (!parsed.ok) return parsed.response;
  const { type, id } = parsed.data;
  if (!isTrashType(type)) return errorJson("invalid_type", 400);

  const model = TRASH_REGISTRY[type].model;
  const restored = await restoreEntity(model, id);
  if (!restored) return errorJson("not_found", 404);

  await writeAudit({
    action: `${type}.restore`,
    actor: session,
    entityType: model,
    entityId: id,
    summary: `Restored ${type} ${id}`,
    ip: auditIp(req),
  });
  return NextResponse.json({ ok: true });
}
