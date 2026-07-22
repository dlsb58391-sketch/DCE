/**
 * Multi-branch domain — pure, database-free helpers.
 *
 * All branch code/label normalization + validation lives here so it can be
 * exhaustively unit-tested without a database (see tests/unit/branches.test.mjs).
 * The DB layer (branches-ops.ts), the seed, and the API routes call these
 * functions at the boundary.
 *
 * A "branch" is a physical location of ONE clinic within ONE database (Sprint 12
 * multi-branch foundation) — not a separate tenant. Operational/financial rows
 * carry an optional `branchId`; shared catalogs (patients, procedures,
 * medications, suppliers) stay clinic-wide.
 */

/** Fixed id + code of the seeded default branch (also created by the migration). */
export const DEFAULT_BRANCH_ID = "branch_main";
export const DEFAULT_BRANCH_CODE = "MAIN";

/** Max length of a branch code (short mnemonic, e.g. MAIN, DT2, CAIRO-1). */
export const MAX_BRANCH_CODE_LEN = 16;
/** Max length of a branch display name. */
export const MAX_BRANCH_NAME_LEN = 120;

/**
 * Normalize a branch code: upper-case, drop everything except A–Z, 0–9, hyphen
 * and underscore, and cap the length. Returns "" when nothing usable remains
 * (callers reject empty codes). Pure; deterministic.
 *
 * Examples: " dt-2 " -> "DT-2"; "cairo branch" -> "CAIROBRANCH"; "a/b" -> "AB".
 */
export function normalizeBranchCode(v: unknown): string {
  if (typeof v !== "string") return "";
  return v
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "")
    .slice(0, MAX_BRANCH_CODE_LEN);
}

/**
 * A valid branch code is 1–MAX_BRANCH_CODE_LEN chars, starts with a letter or
 * digit, and thereafter contains only letters, digits, hyphen or underscore.
 * Validate the ALREADY-normalized code so the stored value and the check agree.
 */
export function isValidBranchCode(v: unknown): boolean {
  return typeof v === "string" && /^[A-Z0-9][A-Z0-9_-]{0,15}$/.test(v);
}

/** Collapse internal whitespace and trim; cap to `max`. Pure. Non-strings -> "". */
export function normalizeName(v: unknown, max = MAX_BRANCH_NAME_LEN): string {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Optional free-text field (phone, address, notes): trim, cap length, and map
 * empty to null so blank input clears the column instead of storing "". Pure.
 */
export function normalizeOptionalText(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s === "" ? null : s;
}

/** Clamp a sort order to a finite non-negative integer (floored). Pure. */
export function normalizeSortOrder(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v;
}

/** True when this is the protected default branch (cannot be deleted). Pure. */
export function isDefaultBranch(id: string | null | undefined): boolean {
  return id === DEFAULT_BRANCH_ID;
}

/**
 * Deterministic display order for a branch list: active before archived, then by
 * ascending sortOrder, then by English name (case-insensitive), then id as a
 * stable tiebreaker. Pure; returns a new sorted array (never mutates input).
 */
export type BranchSortable = {
  id: string;
  nameEn: string;
  sortOrder: number;
  active: boolean;
};

export function sortBranches<T extends BranchSortable>(branches: readonly T[]): T[] {
  return [...branches].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const byName = a.nameEn.localeCompare(b.nameEn, undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Pure selection of the "active branch" id for stamping new rows. Given the raw
 * `bdic_branch` cookie value and the list of selectable (active, non-deleted)
 * branches, return:
 *   1. the cookie's branch when it is still selectable,
 *   2. otherwise the default branch (`branch_main`) when present,
 *   3. otherwise the first selectable branch,
 *   4. otherwise `DEFAULT_BRANCH_ID` as a last resort (always FK-safe — the
 *      default branch row can never be hard-deleted).
 * Pure + deterministic so it can be unit-tested without a database. The caller
 * is responsible for passing `selectable` in its intended priority order.
 */
export function chooseActiveBranchId(
  cookieValue: string | null | undefined,
  selectable: readonly { id: string }[],
): string {
  const ids = new Set(selectable.map((b) => b.id));
  const raw = typeof cookieValue === "string" ? cookieValue.trim() : "";
  if (raw && ids.has(raw)) return raw;
  if (ids.has(DEFAULT_BRANCH_ID)) return DEFAULT_BRANCH_ID;
  return selectable[0]?.id ?? DEFAULT_BRANCH_ID;
}
