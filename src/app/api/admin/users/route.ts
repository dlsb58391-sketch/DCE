import { NextResponse } from "next/server";
import { requireRole, ADMIN_ROLES } from "@/lib/server/guard";
import { auditIp } from "@/lib/server/audit";
import { withRoute, errorJson } from "@/lib/server/http";
import { parseJson, z } from "@/lib/server/validate";
import { listUsers, createUser } from "@/lib/server/users-ops";

/**
 * Staff accounts (Sprint 15, Multi-branch Phase 4a).
 *
 * Admin-only: creating/reading accounts can escalate privileges, so both verbs
 * require an admin (see ADMIN_ROLES). Passwords are hashed server-side and never
 * returned. A user's optional home branch auto-scopes their reads after login.
 */
export const GET = withRoute("admin.users.GET", usersGet);

async function usersGet() {
  const { error } = await requireRole(ADMIN_ROLES);
  if (error) return error;

  const { users } = await listUsers();
  return NextResponse.json({ users });
}

const UserCreateBody = z.object({
  name: z.string().nullish(),
  email: z.string().nullish(),
  username: z.string().nullish(),
  password: z.string().nullish(),
  role: z.string().nullish(),
  branchId: z.string().nullish(),
});

export const POST = withRoute("admin.users.POST", usersPost);

async function usersPost(req: Request) {
  const { error, session } = await requireRole(ADMIN_ROLES);
  if (error) return error;

  const parsed = await parseJson(req, UserCreateBody);
  if (!parsed.ok) return parsed.response;

  const r = await createUser({ input: parsed.data, actor: session, ip: auditIp(req) });
  if (!r.ok) return errorJson(r.code, r.status, { message: r.message, details: r.details });
  return NextResponse.json(r.data);
}
