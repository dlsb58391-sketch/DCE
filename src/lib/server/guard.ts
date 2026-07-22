import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "./auth";
import { prisma } from "@/lib/db";

/**
 * Owner-level roles. In Cliniva the signing doctor is also the clinic owner, so
 * both "admin" and "doctor" have full back-office access. Narrower roles added
 * later (e.g. "staff"/"reception") are excluded from sensitive routes by default,
 * so gating a route with these values is backward-compatible today and becomes a
 * real restriction the moment limited accounts exist.
 */
export const OWNER_ROLES = ["admin", "doctor"] as const;

/**
 * Admin-only roles. User/staff-account management can escalate privileges (create
 * an admin, reset a password, reassign a branch), so it is restricted to "admin"
 * rather than all owner roles. The seeded clinic owner is an admin, so this is a
 * real least-privilege boundary the moment additional doctor/staff accounts exist.
 */
export const ADMIN_ROLES = ["admin"] as const;

export type GuardOk = { error: null; session: SessionPayload };
export type GuardErr = { error: NextResponse; session: null };
export type GuardResult = GuardOk | GuardErr;

function unauthorized(reason: string): GuardErr {
  return { error: NextResponse.json({ error: reason }, { status: 401 }), session: null };
}

/**
 * Guard for admin routes. Verifies the signed JWT, then re-reads the user's role
 * and tokenVersion from the database. This makes the cookie *non-authoritative*
 * for privileges: a logout or role change invalidates every previously issued
 * token immediately (stateless JWTs otherwise stay valid until they expire).
 *
 * Backward compatibility: tokens minted before this change carry no `ver`; they
 * are treated as version 1, which matches the default `User.tokenVersion`, so
 * existing sessions keep working until the next logout.
 */
export async function requireSession(): Promise<GuardResult> {
  const session = await getSession();
  if (!session) return unauthorized("unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { role: true, tokenVersion: true, name: true, email: true },
  });
  if (!user) return unauthorized("unauthorized");

  const tokenVer = session.ver ?? 1;
  if (tokenVer !== user.tokenVersion) return unauthorized("session_revoked");

  // Return the session with authoritative identity/role from the DB.
  return {
    error: null,
    session: { ...session, role: user.role, name: user.name, email: user.email },
  };
}

/**
 * Guard that additionally requires one of `allowed` roles. Use `OWNER_ROLES` for
 * destructive or financial endpoints.
 */
export async function requireRole(allowed: readonly string[]): Promise<GuardResult> {
  const res = await requireSession();
  if (res.error) return res;
  if (!allowed.includes(res.session.role)) {
    return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }), session: null };
  }
  return res;
}
