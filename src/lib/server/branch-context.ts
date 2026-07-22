/**
 * Multi-branch request context (Sprint 13, Phase 2 — write stamping).
 *
 * The "active branch" is the physical location a signed-in staff member is
 * currently working in. It is stored in a dedicated `bdic_branch` cookie — NOT
 * in the JWT — so switching branches never requires re-authentication and never
 * invalidates the session token.
 *
 * `resolveActiveBranchId()` is the single boundary helper request handlers call
 * to decide which `branchId` to stamp on new rows. It is deliberately
 * conservative and backward-compatible:
 *   - When no cookie is set (the default for every clinic today) it returns the
 *     seeded default branch (`branch_main`) WITHOUT touching the database, so a
 *     single-branch clinic keeps byte-identical behaviour and pays no extra
 *     query cost.
 *   - When a non-default cookie is present it validates it against the live
 *     (active, non-deleted) branches and falls back to the default via the pure
 *     {@link chooseActiveBranchId} selector.
 *
 * The returned id is always a real, FK-safe branch id: the default branch row
 * can never be hard-deleted, so stamping it can never violate the foreign key.
 *
 * Background/public writers (website bookings, the WhatsApp agent) have no
 * request cookie context and must NOT call this — they stamp `DEFAULT_BRANCH_ID`
 * directly (see appointments.ts).
 */
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { DEFAULT_BRANCH_ID, chooseActiveBranchId } from "./branches";

/** Cookie that holds the staff member's currently selected branch id. */
export const BRANCH_COOKIE = "bdic_branch";

/**
 * Sentinel cookie value meaning "show every branch at once" (owner-only). It is
 * never a real branch id, so it can only ever appear via an owner explicitly
 * choosing the all-branches view; writers collapse it back to the default
 * branch because you cannot stamp a row against "all".
 */
export const ALL_BRANCHES = "__all__";

/** One year — the active branch is a durable preference, not a session token. */
const MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Cookie options for the active-branch selection. Mirrors the session cookie's
 * Secure handling (opt out on the desktop app served over plain http) but the
 * value itself (a branch id) is not sensitive.
 */
export const branchCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.DESKTOP !== "1",
  path: "/",
  maxAge: MAX_AGE,
};

/**
 * Resolve the branch id to stamp on new rows for the current request. Reads the
 * `bdic_branch` cookie and validates it against the live branch list; falls back
 * to the seeded default branch. Never throws for a missing/unknown cookie.
 */
export async function resolveActiveBranchId(): Promise<string> {
  const jar = await cookies();
  const cookieVal = jar.get(BRANCH_COOKIE)?.value ?? null;

  // Fast path: no selection, the default is already selected, or the owner is in
  // the all-branches view — all stamp against the default branch. You cannot
  // stamp a row against "all", so writes made while viewing every branch land on
  // the clinic's main branch (identical to the historical backfill).
  if (!cookieVal || cookieVal.trim() === DEFAULT_BRANCH_ID || cookieVal.trim() === ALL_BRANCHES) {
    return DEFAULT_BRANCH_ID;
  }

  const selectable = await listSelectableBranches();
  return chooseActiveBranchId(cookieVal, selectable);
}

/**
 * A branch scope for READS. Either every branch (owner all-branches view) or a
 * single branch. `includeNull` is set only for the default branch so it also
 * shows legacy rows whose `branchId` was never stamped (or was unassigned when a
 * branch was removed), preserving the pre-multi-branch "see everything" view for
 * a single-branch clinic.
 */
export type BranchScope =
  | { mode: "all" }
  | { mode: "one"; branchId: string; includeNull: boolean };

/**
 * Resolve the branch scope to filter reads by for the current request. Reads the
 * `bdic_branch` cookie and the caller's role:
 *   - owner + `__all__` cookie → every branch (no filter),
 *   - default / empty cookie   → the main branch, including unstamped/null rows,
 *   - any other cookie         → that single branch (validated; falls back to the
 *     default via {@link chooseActiveBranchId}).
 * Non-owners can never reach the all-branches view even if they forge the cookie.
 */
export async function resolveBranchScope(opts?: { role?: string }): Promise<BranchScope> {
  const jar = await cookies();
  const cookieVal = (jar.get(BRANCH_COOKIE)?.value ?? "").trim();
  const isOwner = opts?.role === "admin" || opts?.role === "doctor";

  if (cookieVal === ALL_BRANCHES) {
    // Only owners may see every branch at once; everyone else is pinned to main.
    return isOwner ? { mode: "all" } : { mode: "one", branchId: DEFAULT_BRANCH_ID, includeNull: true };
  }

  if (!cookieVal || cookieVal === DEFAULT_BRANCH_ID) {
    return { mode: "one", branchId: DEFAULT_BRANCH_ID, includeNull: true };
  }

  const selectable = await listSelectableBranches();
  const branchId = chooseActiveBranchId(cookieVal, selectable);
  return { mode: "one", branchId, includeNull: branchId === DEFAULT_BRANCH_ID };
}

/**
 * Build a Prisma `where` fragment that restricts a `branchId` column to a scope.
 * Returns `{}` for the all-branches view (no restriction). For a single branch it
 * matches that id — plus NULL for the default branch, so unstamped legacy rows
 * stay visible on the main branch. Combine with any existing `where` via `AND`
 * (e.g. `where.AND = [branchWhereFilter(scope)]`) so it never clobbers an `OR`.
 */
export function branchWhereFilter(scope: BranchScope): Record<string, unknown> {
  if (scope.mode === "all") return {};
  if (scope.includeNull) return { OR: [{ branchId: scope.branchId }, { branchId: null }] };
  return { branchId: scope.branchId };
}

/** Setting key holding which branch the shared WhatsApp bot books new rows into. */
export const WHATSAPP_BRANCH_SETTING = "whatsapp.branchId";

/**
 * The branch id that appointments created by the shared WhatsApp booking bot are
 * stamped against. The bot is a single linked number, so a clinic points it at
 * one branch via the `whatsapp.branchId` setting (owner-managed on the WhatsApp
 * screen). Falls back to the clinic's main branch, and always returns a real,
 * FK-safe id (an unknown/deleted setting value collapses to the default).
 */
export async function whatsappBookingBranchId(): Promise<string> {
  let raw: string | null = null;
  try {
    const row = await prisma.setting.findUnique({ where: { key: WHATSAPP_BRANCH_SETTING }, select: { value: true } });
    raw = row?.value ? String(JSON.parse(row.value)) : null;
  } catch {
    raw = null;
  }
  if (!raw || raw === DEFAULT_BRANCH_ID) return DEFAULT_BRANCH_ID;
  const selectable = await listSelectableBranches();
  return chooseActiveBranchId(raw, selectable);
}

/**
 * Point the shared WhatsApp booking bot at a branch. Validates the target against
 * the live selectable branches (an unknown/deleted id collapses to the default),
 * then persists it in the `whatsapp.branchId` setting. Returns the id actually
 * stored so callers can reflect the resolved value back to the UI.
 */
export async function setWhatsappBookingBranchId(branchId: string): Promise<string> {
  const trimmed = (branchId ?? "").trim();
  let resolved = DEFAULT_BRANCH_ID;
  if (trimmed && trimmed !== DEFAULT_BRANCH_ID) {
    const selectable = await listSelectableBranches();
    resolved = chooseActiveBranchId(trimmed, selectable);
  }
  await prisma.setting.upsert({
    where: { key: WHATSAPP_BRANCH_SETTING },
    create: { key: WHATSAPP_BRANCH_SETTING, value: JSON.stringify(resolved) },
    update: { value: JSON.stringify(resolved) },
  });
  return resolved;
}

/**
 * The branches a staff member may work in / stamp against: active and not
 * soft-deleted, in a deterministic priority order (sortOrder, then name, then
 * id). Used by both the resolver and the active-branch API.
 */
export async function listSelectableBranches(): Promise<Array<{ id: string; nameEn: string; nameAr: string; code: string }>> {
  return prisma.branch.findMany({
    where: { active: true, deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }, { id: "asc" }],
    select: { id: true, nameEn: true, nameAr: true, code: true },
  });
}
