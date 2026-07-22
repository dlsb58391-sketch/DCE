/**
 * Staff-account service (Sprint 15, Multi-branch Phase 4a).
 *
 * The layer between the /api/admin/users routes and Prisma. Pure normalization +
 * validation lives in users.ts; this module owns the reads and the writes
 * (password hashing, uniqueness, audit). It NEVER returns a passwordHash.
 *
 * Invariants enforced here:
 *   - email is unique; a provided username is unique (proactive check + P2002 guard).
 *   - the clinic always keeps at least one admin (cannot delete/demote the last one).
 *   - you cannot delete your own account.
 *   - a home branch, if set, must be a real live branch (FK-safe; ON DELETE SET NULL).
 *   - changing a password bumps tokenVersion, revoking that user's old sessions.
 *
 * Result shape mirrors branches-ops: a discriminated OpResult so routes do
 * `if (!r.ok) return errorJson(r.code, r.status, ...)` without throwing.
 */
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/server/audit";
import type { SessionPayload } from "@/lib/server/auth";
import {
  changeRoleBlock,
  deleteUserBlock,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  normalizeEmail,
  normalizeName,
  normalizeRole,
  normalizeUsername,
  type UserRole,
} from "@/lib/server/users";

type Actor = Pick<SessionPayload, "sub" | "name">;

export type OpOk<T> = { ok: true; data: T };
export type OpErr = { ok: false; code: string; status: number; message: string; details?: unknown };
export type OpResult<T> = OpOk<T> | OpErr;

const ok = <T>(data: T): OpOk<T> => ({ ok: true, data });
const fail = (code: string, status: number, message: string, details?: unknown): OpErr => ({
  ok: false,
  code,
  status,
  message,
  details,
});

const BCRYPT_ROUNDS = 12;

// ---------------------------------------------------------------------------
// Serialization — never leaks passwordHash or tokenVersion.
// ---------------------------------------------------------------------------

type RawUser = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  role: string;
  branchId: string | null;
  createdAt: Date;
  branch?: { nameEn: string; nameAr: string; code: string } | null;
};

export type PublicUser = {
  id: string;
  email: string;
  username: string | null;
  name: string;
  role: string;
  branchId: string | null;
  branch: { nameEn: string; nameAr: string; code: string } | null;
  createdAt: string;
};

export function serializeUser(u: RawUser): PublicUser {
  return {
    id: u.id,
    email: u.email,
    username: u.username,
    name: u.name,
    role: u.role,
    branchId: u.branchId,
    branch: u.branch ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

const SELECT = {
  id: true,
  email: true,
  username: true,
  name: true,
  role: true,
  branchId: true,
  createdAt: true,
  branch: { select: { nameEn: true, nameAr: true, code: true } },
} as const;

export type UserInput = {
  name?: string | null;
  email?: string | null;
  username?: string | null;
  password?: string | null;
  role?: string | null;
  branchId?: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function emailTaken(email: string, exceptId?: string): Promise<boolean> {
  const row = await prisma.user.findFirst({
    where: { email, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  return !!row;
}

async function usernameTaken(username: string, exceptId?: string): Promise<boolean> {
  const row = await prisma.user.findFirst({
    where: { username, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  return !!row;
}

/** Resolve a requested home branch id to a real live branch, or null to unassign. */
async function resolveBranchId(branchId: string | null | undefined): Promise<
  { ok: true; value: string | null } | { ok: false }
> {
  const trimmed = (branchId ?? "").trim();
  if (!trimmed) return { ok: true, value: null };
  const row = await prisma.branch.findFirst({ where: { id: trimmed }, select: { id: true } });
  return row ? { ok: true, value: row.id } : { ok: false };
}

async function countAdmins(): Promise<number> {
  return prisma.user.count({ where: { role: "admin" } });
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** List all staff accounts, owners first then by name. Never includes secrets. */
export async function listUsers(): Promise<{ users: PublicUser[] }> {
  const rows = await prisma.user.findMany({
    select: SELECT,
    orderBy: [{ role: "asc" }, { name: "asc" }, { createdAt: "asc" }],
  });
  return { users: rows.map(serializeUser) };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Create a staff account. Requires name, a valid unique email, and a password. */
export async function createUser(p: {
  input: UserInput;
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<{ user: PublicUser }>> {
  const name = normalizeName(p.input.name);
  if (!name) return fail("name_required", 400, "a name is required");

  const email = normalizeEmail(p.input.email);
  if (!isValidEmail(email)) return fail("invalid_email", 400, "a valid email is required");

  const username = normalizeUsername(p.input.username);
  if (!isValidUsername(username)) {
    return fail("invalid_username", 400, "username must be 3-32 chars of letters, digits, . _ -");
  }

  const password = p.input.password ?? "";
  if (!isValidPassword(password)) return fail("invalid_password", 400, "password must be at least 8 characters");

  const role: UserRole = normalizeRole(p.input.role);

  const branch = await resolveBranchId(p.input.branchId);
  if (!branch.ok) return fail("invalid_branch", 400, "home branch not found");

  if (await emailTaken(email)) return fail("email_taken", 409, "email is already in use");
  if (username && (await usernameTaken(username))) return fail("username_taken", 409, "username is already in use");

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const row = await prisma.user.create({
      data: {
        name,
        email,
        username,
        passwordHash,
        role,
        branchId: branch.value ?? null,
      },
      select: SELECT,
    });
    await writeAudit({
      action: "user.create",
      actor: p.actor,
      entityType: "User",
      entityId: row.id,
      summary: `Created ${role} account ${name} (${email})`,
      metadata: { role, branchId: row.branchId },
      ip: p.ip ?? null,
    });
    return ok({ user: serializeUser(row) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String((e.meta?.target as string[] | string | undefined) ?? "");
      if (target.includes("username")) return fail("username_taken", 409, "username is already in use");
      return fail("email_taken", 409, "email is already in use");
    }
    throw e;
  }
}

/** Update a staff account. Any field left undefined is unchanged. */
export async function updateUser(p: {
  id: string;
  input: UserInput;
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<{ user: PublicUser }>> {
  const existing = await prisma.user.findUnique({
    where: { id: p.id },
    select: { id: true, role: true, tokenVersion: true },
  });
  if (!existing) return fail("user_not_found", 404, "user not found");

  const data: Record<string, unknown> = {};

  if (p.input.name !== undefined) {
    const name = normalizeName(p.input.name);
    if (!name) return fail("name_required", 400, "a name is required");
    data.name = name;
  }

  if (p.input.email !== undefined) {
    const email = normalizeEmail(p.input.email);
    if (!isValidEmail(email)) return fail("invalid_email", 400, "a valid email is required");
    if (await emailTaken(email, p.id)) return fail("email_taken", 409, "email is already in use");
    data.email = email;
  }

  if (p.input.username !== undefined) {
    const username = normalizeUsername(p.input.username);
    if (!isValidUsername(username)) {
      return fail("invalid_username", 400, "username must be 3-32 chars of letters, digits, . _ -");
    }
    if (username && (await usernameTaken(username, p.id))) {
      return fail("username_taken", 409, "username is already in use");
    }
    data.username = username;
  }

  if (p.input.role !== undefined) {
    const newRole = normalizeRole(p.input.role);
    const block = changeRoleBlock({ currentRole: existing.role, newRole, adminCount: await countAdmins() });
    if (block) return fail("last_admin", 409, "the clinic must keep at least one admin");
    data.role = newRole;
  }

  if (p.input.branchId !== undefined) {
    const branch = await resolveBranchId(p.input.branchId);
    if (!branch.ok) return fail("invalid_branch", 400, "home branch not found");
    data.branchId = branch.value ?? null;
  }

  if (p.input.password !== undefined && p.input.password !== null && p.input.password !== "") {
    if (!isValidPassword(p.input.password)) {
      return fail("invalid_password", 400, "password must be at least 8 characters");
    }
    data.passwordHash = await bcrypt.hash(p.input.password, BCRYPT_ROUNDS);
    // Revoke every previously issued token for this user on a password change.
    data.tokenVersion = existing.tokenVersion + 1;
  }

  try {
    const row = await prisma.user.update({ where: { id: p.id }, data, select: SELECT });
    await writeAudit({
      action: "user.update",
      actor: p.actor,
      entityType: "User",
      entityId: row.id,
      summary: `Updated account ${row.name} (${row.email})`,
      metadata: { fields: Object.keys(data) },
      ip: p.ip ?? null,
    });
    return ok({ user: serializeUser(row) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = String((e.meta?.target as string[] | string | undefined) ?? "");
      if (target.includes("username")) return fail("username_taken", 409, "username is already in use");
      return fail("email_taken", 409, "email is already in use");
    }
    throw e;
  }
}

/** Delete a staff account. Cannot delete yourself or the final admin. */
export async function deleteUser(p: {
  id: string;
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<{ id: string }>> {
  const existing = await prisma.user.findUnique({
    where: { id: p.id },
    select: { id: true, role: true, name: true, email: true },
  });
  if (!existing) return fail("user_not_found", 404, "user not found");

  const block = deleteUserBlock({
    actorId: p.actor.sub ?? "",
    targetId: existing.id,
    targetRole: existing.role,
    adminCount: await countAdmins(),
  });
  if (block === "cannot_delete_self") return fail("cannot_delete_self", 409, "you cannot delete your own account");
  if (block === "last_admin") return fail("last_admin", 409, "the clinic must keep at least one admin");

  await prisma.user.delete({ where: { id: p.id } });
  await writeAudit({
    action: "user.delete",
    actor: p.actor,
    entityType: "User",
    entityId: existing.id,
    summary: `Deleted account ${existing.name} (${existing.email})`,
    ip: p.ip ?? null,
  });
  return ok({ id: existing.id });
}
