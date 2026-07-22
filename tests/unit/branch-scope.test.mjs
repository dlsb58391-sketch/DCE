// Unit tests for the pure branch READ-scope logic in
// src/lib/server/branch-context.ts (Sprint 14, multi-branch Phase 3).
//
// Following this repo's convention (node --test runs .mjs with no TS loader), the
// pure decision + filter algorithms are mirrored here and exercised directly.
// Keep this mirror in sync with branch-context.ts: resolveBranchScope's role/
// cookie decision and branchWhereFilter's Prisma-where shaping. These lock the
// contract that (a) only owners ever get the all-branches view, (b) the default
// branch also sees legacy/unstamped NULL rows, and (c) a non-default branch is
// filtered to exactly its own rows.

import { test } from "node:test";
import assert from "node:assert/strict";

// --- mirror of the relevant helpers --------------------------------------
const DEFAULT_BRANCH_ID = "branch_main";
const ALL_BRANCHES = "__all__";

const chooseActiveBranchId = (cookieValue, selectable) => {
  const ids = new Set(selectable.map((b) => b.id));
  const raw = typeof cookieValue === "string" ? cookieValue.trim() : "";
  if (raw && ids.has(raw)) return raw;
  if (ids.has(DEFAULT_BRANCH_ID)) return DEFAULT_BRANCH_ID;
  return selectable[0]?.id ?? DEFAULT_BRANCH_ID;
};

// Mirror of resolveBranchScope's pure decision (cookie + role -> scope).
const decideScope = (cookieVal, isOwner, selectable) => {
  const v = typeof cookieVal === "string" ? cookieVal.trim() : "";
  if (v === ALL_BRANCHES) {
    return isOwner ? { mode: "all" } : { mode: "one", branchId: DEFAULT_BRANCH_ID, includeNull: true };
  }
  if (!v || v === DEFAULT_BRANCH_ID) {
    return { mode: "one", branchId: DEFAULT_BRANCH_ID, includeNull: true };
  }
  const branchId = chooseActiveBranchId(v, selectable);
  return { mode: "one", branchId, includeNull: branchId === DEFAULT_BRANCH_ID };
};

// Mirror of branchWhereFilter(scope).
const branchWhereFilter = (scope) => {
  if (scope.mode === "all") return {};
  if (scope.includeNull) return { OR: [{ branchId: scope.branchId }, { branchId: null }] };
  return { branchId: scope.branchId };
};

const SELECTABLE = [{ id: DEFAULT_BRANCH_ID }, { id: "branch_dt2" }];

// --- tests ---------------------------------------------------------------

test("owner with __all__ cookie sees every branch (no filter)", () => {
  const scope = decideScope(ALL_BRANCHES, true, SELECTABLE);
  assert.deepEqual(scope, { mode: "all" });
  assert.deepEqual(branchWhereFilter(scope), {});
});

test("non-owner can never reach the all-branches view (forged cookie)", () => {
  const scope = decideScope(ALL_BRANCHES, false, SELECTABLE);
  assert.deepEqual(scope, { mode: "one", branchId: DEFAULT_BRANCH_ID, includeNull: true });
  // Pinned to main, and still sees legacy NULL rows.
  assert.deepEqual(branchWhereFilter(scope), {
    OR: [{ branchId: DEFAULT_BRANCH_ID }, { branchId: null }],
  });
});

test("empty / default cookie scopes to main AND includes unstamped NULL rows", () => {
  for (const cookie of ["", "   ", null, undefined, DEFAULT_BRANCH_ID]) {
    const scope = decideScope(cookie, false, SELECTABLE);
    assert.deepEqual(scope, { mode: "one", branchId: DEFAULT_BRANCH_ID, includeNull: true }, `cookie=${cookie}`);
    assert.deepEqual(branchWhereFilter(scope), {
      OR: [{ branchId: DEFAULT_BRANCH_ID }, { branchId: null }],
    });
  }
});

test("a selectable non-default branch is filtered to exactly its own rows", () => {
  const scope = decideScope("branch_dt2", true, SELECTABLE);
  assert.deepEqual(scope, { mode: "one", branchId: "branch_dt2", includeNull: false });
  // No NULL rows leak into a secondary branch.
  assert.deepEqual(branchWhereFilter(scope), { branchId: "branch_dt2" });
});

test("an unknown cookie branch falls back to main (with NULL rows)", () => {
  const scope = decideScope("branch_gone", true, SELECTABLE);
  assert.deepEqual(scope, { mode: "one", branchId: DEFAULT_BRANCH_ID, includeNull: true });
  assert.deepEqual(branchWhereFilter(scope), {
    OR: [{ branchId: DEFAULT_BRANCH_ID }, { branchId: null }],
  });
});

test("branchWhereFilter is safe to AND-merge (all view adds no keys)", () => {
  const all = branchWhereFilter({ mode: "all" });
  assert.equal(Object.keys(all).length, 0);
  // A single-branch filter always contributes exactly one top-level key.
  assert.equal(Object.keys(branchWhereFilter({ mode: "one", branchId: "b", includeNull: false })).length, 1);
  assert.equal(Object.keys(branchWhereFilter({ mode: "one", branchId: "b", includeNull: true })).length, 1);
});
