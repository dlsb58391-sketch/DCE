import { NextResponse } from "next/server";
import { requireRole, ADMIN_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z } from "@/lib/server/validate";
import { updateUser, deleteUser } from "@/lib/server/users-ops";

/**
 * A single staff account (Sprint 15). Admin-only. PATCH updates any subset of
 * fields (a blank password leaves it unchanged); DELETE removes the account
 * (blocked for your own account or the final admin). Passwords are never returned.
 */
const UserUpdateBody = z.object({
  name: z.string().nullish(),
  email: z.string().nullish(),
  username: z.string().nullish(),
  password: z.string().nullish(),
  role: z.string().nullish(),
  branchId: z.string().nullish(),
});

export const PATCH = withRoute("admin.users.id.PATCH", userPatch);

async function userPatch(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const parsed = await parseJson(req, UserUpdateBody);
  if (!parsed.ok) return parsed.response;

  const r = await updateUser({ id, input: parsed.data, actor: session, ip: auditIp(req) });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}

export const DELETE = withRoute("admin.users.id.DELETE", userDelete);

async function userDelete(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { error, session } = await requireRole(ADMIN_ROLES);
  if (error) return error;
  const { id } = await ctx.params;

  const r = await deleteUser({ id, actor: session, ip: auditIp(req) });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json({ ok: true });
}
