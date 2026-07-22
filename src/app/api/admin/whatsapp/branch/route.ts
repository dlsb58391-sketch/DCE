import { NextResponse } from "next/server";
import { requireSession, requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { withRoute } from "@/lib/server/http";
import { parseJson, z } from "@/lib/server/validate";
import { listBranches } from "@/lib/server/branches-ops";
import {
  whatsappBookingBranchId,
  setWhatsappBookingBranchId,
} from "@/lib/server/branch-context";

/**
 * Which branch the single shared WhatsApp booking bot files new appointments to.
 *
 * The clinic links one WhatsApp number, so bot bookings must land in exactly one
 * branch. GET returns the currently-configured branch id plus the branch list
 * (with each branch's own display WhatsApp number) so the WhatsApp screen can
 * show a selector. POST (owner-only) changes it. Reads are staff-visible; the
 * value is validated + audited on write.
 */
export const GET = withRoute("admin.whatsapp.branch.GET", branchGet);

async function branchGet() {
  const { error } = await requireSession();
  if (error) return error;

  const [branchId, { branches }] = await Promise.all([
    whatsappBookingBranchId(),
    listBranches({ includeInactive: false }),
  ]);
  return NextResponse.json({
    branchId,
    branches: branches.map((b) => ({
      id: b.id,
      nameEn: b.nameEn,
      nameAr: b.nameAr,
      code: b.code,
      whatsappNumber: b.whatsappNumber,
      isDefault: b.isDefault,
    })),
  });
}

const Body = z.object({ branchId: z.string().trim().min(1) });

export const POST = withRoute("admin.whatsapp.branch.POST", branchPost);

async function branchPost(req: Request) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;

  const parsed = await parseJson(req, Body);
  if (!parsed.ok) return parsed.response;

  const resolved = await setWhatsappBookingBranchId(parsed.data.branchId);
  await writeAudit({
    action: "whatsapp.branch.set",
    actor: session,
    entityType: "Setting",
    entityId: "whatsapp.branchId",
    summary: `WhatsApp bot bookings routed to branch ${resolved}`,
    ip: auditIp(req),
  });
  return NextResponse.json({ branchId: resolved });
}
