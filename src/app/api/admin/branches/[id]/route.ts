import { NextResponse } from "next/server";
import { requireSession, requireRole, OWNER_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z } from "@/lib/server/validate";
import { getBranch, updateBranch, deleteBranch } from "@/lib/server/branches-ops";

/**
 * Branch collection (multi-branch foundation).
 *
 * GET is readable by any signed-in staff member; `?search=` matches name/code and
 * `?includeInactive=1` also returns archived branches (soft-deleted rows are
 * always hidden). POST adds a branch (owner-level). This is the Sprint 12
 * foundation: branches exist and are managed here, but no operational write yet
 * stamps `branchId`, so behaviour is unchanged until a later phase.
 */
export const GET = withRoute("admin.branches.id.GET", branchGet);

async function branchGet(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;

  const branch = await getBranch(id);
  if (!branch) return errorJson("branch_not_found", 404, { message: "branch not found" });
  return NextResponse.json({ branch });
}

const BranchUpdateBody = z.object({
  nameEn: z.string().trim().min(1).optional(),
  nameAr: z.string().trim().min(1).optional(),
  code: z.string().trim().min(1).optional(),
  phone: z.string().trim().nullish(),
  whatsappNumber: z.string().trim().nullish(),
  address: z.string().trim().nullish(),
  notes: z.string().trim().nullish(),
  sortOrder: z.coerce.number().optional(),
  active: z.boolean().optional(),
});

export const PATCH = withRoute("admin.branches.id.PATCH", branchPatch);

async function branchPatch(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, BranchUpdateBody);
  if (!parsed.ok) return parsed.response;

  const r = await updateBranch({ id, input: parsed.data, actor: session, ip: auditIp(req) });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}

export const DELETE = withRoute("admin.branches.id.DELETE", branchDelete);

async function branchDelete(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(OWNER_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const r = await deleteBranch({ id, actor: session, ip: auditIp(req) });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json({ ok: true });
}
