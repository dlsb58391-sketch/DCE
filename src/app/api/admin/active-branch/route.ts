import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireSession, OWNER_ROLES } from "@/lib/server/guard";
import { writeAudit, auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z } from "@/lib/server/validate";
import {
  BRANCH_COOKIE,
  ALL_BRANCHES,
  branchCookieOptions,
  resolveActiveBranchId,
  listSelectableBranches,
} from "@/lib/server/branch-context";

/**
 * Active-branch selection (multi-branch Phase 2 + 3).
 *
 * GET returns the branch the current staff member is working in (the one new
 * rows are stamped against), what their switcher should show as selected
 * (`selection` — a branch id, or `__all__` for the owner all-branches view), the
 * list of branches they can switch to, and whether they may pick "All branches".
 * POST records a new selection in the `bdic_branch` cookie so subsequent reads
 * are scoped and writes stamped accordingly. Any signed-in staff member may
 * switch to a specific branch; only owners may choose the all-branches view.
 */
export const GET = withRoute("admin.activeBranch.GET", activeBranchGet);

async function activeBranchGet() {
  const { error, session } = await requireSession();
  if (error) return error;

  const canSelectAll = OWNER_ROLES.includes(session.role as (typeof OWNER_ROLES)[number]);
  const jar = await cookies();
  const cookieVal = (jar.get(BRANCH_COOKIE)?.value ?? "").trim();

  const [branchId, branches] = await Promise.all([
    resolveActiveBranchId(),
    listSelectableBranches(),
  ]);

  // What the switcher highlights: the all-branches view for an owner who chose
  // it, otherwise the resolved working branch.
  const selection = canSelectAll && cookieVal === ALL_BRANCHES ? ALL_BRANCHES : branchId;

  return NextResponse.json({ branchId, selection, branches, canSelectAll });
}

const SelectBody = z.object({ branchId: z.string().trim().min(1) });

export const POST = withRoute("admin.activeBranch.POST", activeBranchPost);

async function activeBranchPost(req: Request) {
  const { error, session } = await requireSession();
  if (error) return error;

  const parsed = await parseJson(req, SelectBody);
  if (!parsed.ok) return parsed.response;
  const { branchId } = parsed.data;

  // Owner "All branches" view: store the sentinel so reads span every branch.
  if (branchId === ALL_BRANCHES) {
    if (!OWNER_ROLES.includes(session.role as (typeof OWNER_ROLES)[number])) {
      return errorJson("forbidden", 403, { message: "Only owners can view all branches." });
    }
    const res = NextResponse.json({ ok: true, branchId: ALL_BRANCHES });
    res.cookies.set(BRANCH_COOKIE, ALL_BRANCHES, branchCookieOptions);
    await writeAudit({
      action: "branch.select",
      actor: session,
      entityType: "Branch",
      entityId: null,
      summary: "Switched to all branches",
      ip: auditIp(req),
    });
    return res;
  }

  // Only allow switching to a branch that actually exists and is selectable.
  const selectable = await listSelectableBranches();
  const target = selectable.find((b) => b.id === branchId);
  if (!target) return errorJson("branch_not_found", 404, { message: "That branch is not available." });

  const res = NextResponse.json({ ok: true, branchId: target.id });
  res.cookies.set(BRANCH_COOKIE, target.id, branchCookieOptions);
  await writeAudit({
    action: "branch.select",
    actor: session,
    entityType: "Branch",
    entityId: target.id,
    summary: `Switched active branch to ${target.nameEn || target.nameAr || target.code}`,
    ip: auditIp(req),
  });
  return res;
}
