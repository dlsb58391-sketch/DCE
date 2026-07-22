// Unit tests for the pure multi-branch helpers in src/lib/server/branches.ts.
//
// Following this repo's convention (node --test runs .mjs with no TS loader), the
// pure algorithms are mirrored here and exercised directly. Keep this mirror in
// sync with src/lib/server/branches.ts — the tests lock the branch contract:
// code normalization/validation, name + optional-text normalization, sort-order
// clamping, default-branch guard, and deterministic list ordering.

import { test } from "node:test";
import assert from "node:assert/strict";

// --- mirror of src/lib/server/branches.ts --------------------------------
const DEFAULT_BRANCH_ID = "branch_main";
const DEFAULT_BRANCH_CODE = "MAIN";
const MAX_BRANCH_CODE_LEN = 16;
const MAX_BRANCH_NAME_LEN = 120;

const normalizeBranchCode = (v) => {
  if (typeof v !== "string") return "";
  return v
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, "")
    .slice(0, MAX_BRANCH_CODE_LEN);
};

const isValidBranchCode = (v) => typeof v === "string" && /^[A-Z0-9][A-Z0-9_-]{0,15}$/.test(v);

const normalizeName = (v, max = MAX_BRANCH_NAME_LEN) => {
  if (typeof v !== "string") return "";
  return v.replace(/\s+/g, " ").trim().slice(0, max);
};

const normalizeOptionalText = (v, max = 500) => {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s === "" ? null : s;
};

const normalizeSortOrder = (n) => {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v;
};

const isDefaultBranch = (id) => id === DEFAULT_BRANCH_ID;

const chooseActiveBranchId = (cookieValue, selectable) => {
  const ids = new Set(selectable.map((b) => b.id));
  const raw = typeof cookieValue === "string" ? cookieValue.trim() : "";
  if (raw && ids.has(raw)) return raw;
  if (ids.has(DEFAULT_BRANCH_ID)) return DEFAULT_BRANCH_ID;
  return selectable[0]?.id ?? DEFAULT_BRANCH_ID;
};

const sortBranches = (branches) =>
  [...branches].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    const byName = a.nameEn.localeCompare(b.nameEn, undefined, { sensitivity: "base" });
    if (byName !== 0) return byName;
    return a.id.localeCompare(b.id);
  });

// --- tests ---------------------------------------------------------------

test("normalizeBranchCode upper-cases, strips invalid chars, trims", () => {
  assert.equal(normalizeBranchCode(" dt-2 "), "DT-2");
  assert.equal(normalizeBranchCode("cairo branch"), "CAIROBRANCH");
  assert.equal(normalizeBranchCode("a/b.c"), "ABC");
  assert.equal(normalizeBranchCode("main_1"), "MAIN_1");
  assert.equal(normalizeBranchCode(""), "");
  assert.equal(normalizeBranchCode(123), "");
  assert.equal(normalizeBranchCode(null), "");
});

test("normalizeBranchCode caps at MAX_BRANCH_CODE_LEN", () => {
  const long = "A".repeat(40);
  assert.equal(normalizeBranchCode(long).length, MAX_BRANCH_CODE_LEN);
});

test("DEFAULT_BRANCH_CODE normalizes to itself and is valid", () => {
  assert.equal(normalizeBranchCode(DEFAULT_BRANCH_CODE), DEFAULT_BRANCH_CODE);
  assert.equal(isValidBranchCode(DEFAULT_BRANCH_CODE), true);
});

test("isValidBranchCode accepts normalized codes, rejects bad ones", () => {
  assert.equal(isValidBranchCode("MAIN"), true);
  assert.equal(isValidBranchCode("DT-2"), true);
  assert.equal(isValidBranchCode("B1"), true);
  assert.equal(isValidBranchCode("-X"), false); // must start alphanumeric
  assert.equal(isValidBranchCode("_X"), false);
  assert.equal(isValidBranchCode("dt-2"), false); // lower-case not normalized
  assert.equal(isValidBranchCode(""), false);
  assert.equal(isValidBranchCode("A".repeat(17)), false); // too long
  assert.equal(isValidBranchCode(null), false);
});

test("a normalized non-empty code is always valid (round-trip)", () => {
  for (const raw of ["main", " Dt 2 ", "clinic#1", "north-wing"]) {
    const code = normalizeBranchCode(raw);
    if (code.length > 0) assert.equal(isValidBranchCode(code), true, `code=${code}`);
  }
});

test("normalizeName collapses whitespace, trims, and caps length", () => {
  assert.equal(normalizeName("  Main   Branch  "), "Main Branch");
  assert.equal(normalizeName("A\n\tB"), "A B");
  assert.equal(normalizeName(""), "");
  assert.equal(normalizeName(42), "");
  assert.equal(normalizeName("x".repeat(200)).length, MAX_BRANCH_NAME_LEN);
});

test("normalizeOptionalText maps blank to null, trims, caps", () => {
  assert.equal(normalizeOptionalText("  0100  "), "0100");
  assert.equal(normalizeOptionalText("   "), null);
  assert.equal(normalizeOptionalText(""), null);
  assert.equal(normalizeOptionalText(undefined), null);
  assert.equal(normalizeOptionalText("y".repeat(600), 500).length, 500);
});

test("normalizeSortOrder floors to a non-negative integer", () => {
  assert.equal(normalizeSortOrder(3), 3);
  assert.equal(normalizeSortOrder(2.9), 2);
  assert.equal(normalizeSortOrder(-5), 0);
  assert.equal(normalizeSortOrder("7"), 7);
  assert.equal(normalizeSortOrder("nope"), 0);
  assert.equal(normalizeSortOrder(null), 0);
});

test("isDefaultBranch only matches the protected default id", () => {
  assert.equal(isDefaultBranch(DEFAULT_BRANCH_ID), true);
  assert.equal(isDefaultBranch("branch_other"), false);
  assert.equal(isDefaultBranch(null), false);
  assert.equal(isDefaultBranch(undefined), false);
});

test("sortBranches orders active-first, then sortOrder, name, id", () => {
  const input = [
    { id: "b", nameEn: "Beta", sortOrder: 1, active: true },
    { id: "z", nameEn: "Archived", sortOrder: 0, active: false },
    { id: "a", nameEn: "Alpha", sortOrder: 1, active: true },
    { id: "c", nameEn: "Gamma", sortOrder: 0, active: true },
  ];
  const out = sortBranches(input).map((x) => x.id);
  assert.deepEqual(out, ["c", "a", "b", "z"]);
  // pure: original array untouched
  assert.equal(input[0].id, "b");
});

test("chooseActiveBranchId honors a selectable cookie branch", () => {
  const selectable = [{ id: "branch_main" }, { id: "branch_dt2" }];
  assert.equal(chooseActiveBranchId("branch_dt2", selectable), "branch_dt2");
  assert.equal(chooseActiveBranchId("  branch_dt2  ", selectable), "branch_dt2");
});

test("chooseActiveBranchId falls back to the default branch", () => {
  const selectable = [{ id: "branch_main" }, { id: "branch_dt2" }];
  // cookie missing / blank / unknown -> default
  assert.equal(chooseActiveBranchId(null, selectable), DEFAULT_BRANCH_ID);
  assert.equal(chooseActiveBranchId("", selectable), DEFAULT_BRANCH_ID);
  assert.equal(chooseActiveBranchId("   ", selectable), DEFAULT_BRANCH_ID);
  assert.equal(chooseActiveBranchId("branch_gone", selectable), DEFAULT_BRANCH_ID);
  assert.equal(chooseActiveBranchId(123, selectable), DEFAULT_BRANCH_ID);
});

test("chooseActiveBranchId falls back to first selectable when default absent", () => {
  const selectable = [{ id: "branch_north" }, { id: "branch_south" }];
  // unknown cookie, no default in list -> first selectable (caller pre-sorts)
  assert.equal(chooseActiveBranchId("branch_gone", selectable), "branch_north");
  // a selectable cookie still wins
  assert.equal(chooseActiveBranchId("branch_south", selectable), "branch_south");
});

test("chooseActiveBranchId returns the default id when nothing is selectable", () => {
  assert.equal(chooseActiveBranchId("anything", []), DEFAULT_BRANCH_ID);
  assert.equal(chooseActiveBranchId(null, []), DEFAULT_BRANCH_ID);
});
