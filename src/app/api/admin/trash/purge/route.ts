import { NextResponse } from "next/server";
import { requireRole } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z } from "@/lib/server/validate";
import { countPurgeReferences, isPurgeBlocked, purgeEntity } from "@/lib/server/soft-delete-ops";
import { isTrashType, TRASH_REGISTRY } from "@/lib/server/trash";

/**
 * Permanent delete is the most destructive action in the app, so it is gated to
 * the `admin` role only (the "Super Admin"), one step above the owner-level
 * roles that can restore.
 */
const PURGE_ROLES = ["admin"] as const;

const PurgeBody = z.object({
  type: z.string(),
  id: z.string().trim().min(1, "required"),
  force: z.boolean().optional(),
});

/**
 * Permanently hard-delete a trashed record. Blocked with 409 when the record is
 * still referenced by financial/medical history, unless `force: true` is sent by
 * a Super Admin. Audited as `<type>.purge`.
 */
export const POST = withRoute("admin.trash.purge.POST", adminTrashPurgePOST);

async function adminTrashPurgePOST(req: Request) {
  const { error, session } = await requireRole(PURGE_ROLES);
  if (error) return error;

  const parsed = await parseJson(req, PurgeBody);
  if (!parsed.ok) return parsed.response;
  const { type, id, force } = parsed.data;
  if (!isTrashType(type)) return errorJson("invalid_type", 400);

  const model = TRASH_REGISTRY[type].model;
  const references = await countPurgeReferences(model, id);
  if (isPurgeBlocked(references, force === true)) {
    return errorJson("has_references", 409, {
      message: "This record is referenced by financial or medical history. Force is required to purge it.",
      details: { references },
    });
  }

  const purged = await purgeEntity(model, id);
  if (!purged) return errorJson("not_found", 404);

  await writeAudit({
    action: `${type}.purge`,
    actor: session,
    entityType: model,
    entityId: id,
    summary: `Permanently deleted ${type} ${id}`,
    metadata: { force: force === true, references },
    ip: auditIp(req),
  });
  return NextResponse.json({ ok: true });
}
