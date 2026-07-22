/**
 * Multi-branch — database/transaction operations service.
 *
 * Thin, well-typed layer between the branch API routes and Prisma. All code/name
 * normalization + validation is delegated to the pure helpers in branches.ts;
 * this module owns the reads and the transactional writes.
 *
 * Invariants enforced here:
 *   - Branch `code` is unique across ALL rows (including soft-deleted), so a clash
 *     returns 409 rather than throwing (checked proactively + guarded by a P2002
 *     catch on the unique constraint).
 *   - The seeded default branch (branch_main) can be edited but never deleted, so
 *     the backfilled rows always have a valid home.
 *   - Delete is a soft-delete (Recycle Bin). Because every branchId FK is
 *     ON DELETE SET NULL, a branch's records are NEVER removed with it — this is a
 *     foundation phase, so nothing reads branchId for scoping yet.
 *
 * Result shape: every write returns a discriminated `OpResult` so routes do
 * `if (!r.ok) return errorJson(r.code, r.status, ...)` without throwing.
 */
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/server/audit";
import type { SessionPayload } from "@/lib/server/auth";
import { softDeleteEntity } from "@/lib/server/soft-delete-ops";
import {
  isDefaultBranch,
  isValidBranchCode,
  normalizeBranchCode,
  normalizeName,
  normalizeOptionalText,
  normalizeSortOrder,
  sortBranches,
} from "@/lib/server/branches";

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

// ---------------------------------------------------------------------------
// Serialization (Date -> ISO for the JSON API contract; no Decimals here)
// ---------------------------------------------------------------------------

type RawBranch = {
  id: string;
  nameEn: string;
  nameAr: string;
  code: string;
  phone: string | null;
  whatsappNumber: string | null;
  address: string | null;
  active: boolean;
  sortOrder: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeBranch(b: RawBranch) {
  return {
    id: b.id,
    nameEn: b.nameEn,
    nameAr: b.nameAr,
    code: b.code,
    phone: b.phone,
    whatsappNumber: b.whatsappNumber,
    address: b.address,
    active: b.active,
    sortOrder: b.sortOrder,
    notes: b.notes,
    isDefault: isDefaultBranch(b.id),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

type BranchInput = {
  nameEn?: string | null;
  nameAr?: string | null;
  code?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  address?: string | null;
  notes?: string | null;
  sortOrder?: number | null;
  active?: boolean | null;
};

const SELECT = {
  id: true,
  nameEn: true,
  nameAr: true,
  code: true,
  phone: true,
  whatsappNumber: true,
  address: true,
  active: true,
  sortOrder: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Is `code` already used by a live-or-trashed branch other than `exceptId`? */
async function codeTaken(code: string, exceptId?: string): Promise<boolean> {
  const row = await prisma.branch.findFirst({
    // deletedAt: undefined opts out of the live-only scope so a trashed branch
    // still reserves its (globally unique) code.
    where: { code, deletedAt: undefined, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  return !!row;
}

/** List branches (live rows only via the soft-delete read scope), deterministically ordered. */
export async function listBranches(opts: {
  search?: string | null;
  includeInactive?: boolean;
}): Promise<{ branches: Array<ReturnType<typeof serializeBranch>> }> {
  const where: Record<string, unknown> = {};
  if (!opts.includeInactive) where.active = true;
  const search = opts.search?.trim();
  if (search) {
    where.OR = [
      { nameEn: { contains: search, mode: "insensitive" } },
      { nameAr: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
    ];
  }
  const rows = await prisma.branch.findMany({ where, select: SELECT });
  return { branches: sortBranches(rows).map(serializeBranch) };
}

/** Fetch one live branch by id, or null. */
export async function getBranch(id: string): Promise<ReturnType<typeof serializeBranch> | null> {
  const row = await prisma.branch.findFirst({ where: { id }, select: SELECT });
  return row ? serializeBranch(row) : null;
}

/** Create a branch. Requires a name + a valid, unique code. */
export async function createBranch(p: {
  input: BranchInput;
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<{ branch: ReturnType<typeof serializeBranch> }>> {
  const nameEn = normalizeName(p.input.nameEn) || normalizeName(p.input.nameAr);
  const nameAr = normalizeName(p.input.nameAr) || normalizeName(p.input.nameEn);
  if (!nameEn && !nameAr) return fail("name_required", 400, "a branch name is required");

  const code = normalizeBranchCode(p.input.code);
  if (!isValidBranchCode(code)) {
    return fail("invalid_code", 400, "branch code must be 1-16 letters/digits (may include - or _)");
  }
  if (await codeTaken(code)) return fail("code_taken", 409, "branch code is already in use");

  try {
    const row = await prisma.branch.create({
      data: {
        nameEn,
        nameAr,
        code,
        phone: normalizeOptionalText(p.input.phone, 40),
        whatsappNumber: normalizeOptionalText(p.input.whatsappNumber, 40),
        address: normalizeOptionalText(p.input.address, 300),
        notes: normalizeOptionalText(p.input.notes, 1000),
        sortOrder: normalizeSortOrder(p.input.sortOrder),
        active: p.input.active === false ? false : true,
      },
      select: SELECT,
    });
    await writeAudit({
      action: "branch.create",
      actor: p.actor,
      entityType: "Branch",
      entityId: row.id,
      summary: `Added branch ${row.nameEn || row.nameAr} (${row.code})`,
      ip: p.ip ?? null,
    });
    return ok({ branch: serializeBranch(row) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("code_taken", 409, "branch code is already in use");
    }
    throw e;
  }
}

/** Update a branch. Any field left undefined is unchanged. Code stays unique. */
export async function updateBranch(p: {
  id: string;
  input: BranchInput;
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<{ branch: ReturnType<typeof serializeBranch> }>> {
  const existing = await prisma.branch.findFirst({ where: { id: p.id }, select: { id: true } });
  if (!existing) return fail("branch_not_found", 404, "branch not found");

  const data: Record<string, unknown> = {};
  if (p.input.nameEn !== undefined) data.nameEn = normalizeName(p.input.nameEn) || normalizeName(p.input.nameAr);
  if (p.input.nameAr !== undefined) data.nameAr = normalizeName(p.input.nameAr) || normalizeName(p.input.nameEn);
  if (p.input.phone !== undefined) data.phone = normalizeOptionalText(p.input.phone, 40);
  if (p.input.whatsappNumber !== undefined) data.whatsappNumber = normalizeOptionalText(p.input.whatsappNumber, 40);
  if (p.input.address !== undefined) data.address = normalizeOptionalText(p.input.address, 300);
  if (p.input.notes !== undefined) data.notes = normalizeOptionalText(p.input.notes, 1000);
  if (p.input.sortOrder !== undefined) data.sortOrder = normalizeSortOrder(p.input.sortOrder);
  if (p.input.active !== undefined && p.input.active !== null) data.active = !!p.input.active;

  if (p.input.code !== undefined) {
    const code = normalizeBranchCode(p.input.code);
    if (!isValidBranchCode(code)) {
      return fail("invalid_code", 400, "branch code must be 1-16 letters/digits (may include - or _)");
    }
    if (await codeTaken(code, p.id)) return fail("code_taken", 409, "branch code is already in use");
    data.code = code;
  }

  try {
    const row = await prisma.branch.update({ where: { id: p.id }, data, select: SELECT });
    await writeAudit({
      action: "branch.update",
      actor: p.actor,
      entityType: "Branch",
      entityId: row.id,
      summary: `Updated branch ${row.nameEn || row.nameAr} (${row.code})`,
      metadata: { fields: Object.keys(data) },
      ip: p.ip ?? null,
    });
    return ok({ branch: serializeBranch(row) });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("code_taken", 409, "branch code is already in use");
    }
    throw e;
  }
}

/**
 * Soft-delete a branch (Recycle Bin). The default branch is protected. Records
 * that referenced the branch keep their history — their branchId FK is
 * ON DELETE SET NULL, and a soft-delete only hides the Branch row, so nothing is
 * unlinked until an actual purge, which itself only nulls the FK.
 */
export async function deleteBranch(p: {
  id: string;
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<{ id: string }>> {
  if (isDefaultBranch(p.id)) return fail("default_branch", 400, "the default branch cannot be deleted");
  const existing = await prisma.branch.findFirst({
    where: { id: p.id },
    select: { id: true, nameEn: true, nameAr: true, code: true },
  });
  if (!existing) return fail("branch_not_found", 404, "branch not found");
  await softDeleteEntity("Branch", p.id, p.actor.sub ?? null);
  await writeAudit({
    action: "branch.delete",
    actor: p.actor,
    entityType: "Branch",
    entityId: p.id,
    summary: `Deleted branch ${existing.nameEn || existing.nameAr} (${existing.code})`,
    ip: p.ip ?? null,
  });
  return ok({ id: p.id });
}
