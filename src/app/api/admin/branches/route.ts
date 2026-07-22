import { NextResponse } from "next/server";
import { requireSession, requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z } from "@/lib/server/validate";
import { listBranches, createBranch } from "@/lib/server/branches-ops";

/**
 * Branch collection (multi-branch foundation).
 *
 * GET is readable by any signed-in staff member; `?search=` matches name/code and
 * `?includeInactive=1` also returns archived branches (soft-deleted rows are
 * always hidden). POST adds a branch (owner-level). This is the Sprint 12
 * foundation: branches exist and are managed here, but no operational write yet
 * stamps `branchId`, so behaviour is unchanged until a later phase.
 */
export const GET = withRoute("admin.branches.GET", branchesListGet);

async function branchesListGet(req: Request) {
  const { error } = await requireSession();
  if (error) return error;

  const sp = new URL(req.url).searchParams;
  const includeInactive = sp.get("includeInactive") === "1" || sp.get("includeInactive") === "true";
  const { branches } = await listBranches({ search: sp.get("search"), includeInactive });
  return NextResponse.json({ branches });
}

const BranchBody = z.object({
  nameEn: z.string().trim().min(1).nullish(),
  nameAr: z.string().trim().min(1).nullish(),
  code: z.string().trim().min(1),
  phone: z.string().trim().nullish(),
  whatsappNumber: z.string().trim().nullish(),
  address: z.string().trim().nullish(),
  notes: z.string().trim().nullish(),
  sortOrder: z.coerce.number().nullish(),
  active: z.boolean().nullish(),
});

export const POST = withRoute("admin.branches.POST", branchCreatePost);

async function branchCreatePost(req: Request) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;

  const parsed = await parseJson(req, BranchBody);
  if (!parsed.ok) return parsed.response;

  const r = await createBranch({ input: parsed.data, actor: session, ip: auditIp(req) });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}
