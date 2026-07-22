import { test } from "node:test";
import assert from "node:assert/strict";

// Mirror of src/lib/server/pagination.ts (resolvePagination + paginationHeaders).
// Unit files run as plain .mjs and cannot import the TS module, so the intended
// semantics are re-declared here and asserted — same pattern as validation.test.mjs.

const DEFAULT_MAX_LIMIT = 200;

function resolvePagination(rawLimit, rawOffset, opts = {}) {
  const maxLimit = Math.max(1, Math.floor(opts.maxLimit ?? DEFAULT_MAX_LIMIT));
  const fallbackLimit = Math.min(maxLimit, Math.max(1, Math.floor(opts.defaultLimit ?? maxLimit)));

  const hasLimit = rawLimit != null && rawLimit.trim() !== "";
  const hasOffset = rawOffset != null && rawOffset.trim() !== "";

  if (!hasLimit && !hasOffset) {
    return { applied: false, limit: 0, offset: 0, take: undefined, skip: undefined };
  }

  let limit = hasLimit ? Math.floor(Number(rawLimit)) : fallbackLimit;
  if (!Number.isFinite(limit) || limit <= 0) limit = fallbackLimit;
  limit = Math.min(limit, maxLimit);

  let offset = hasOffset ? Math.floor(Number(rawOffset)) : 0;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  return { applied: true, limit, offset, take: limit, skip: offset };
}

function paginationHeaders(total, p) {
  if (!p.applied) return {};
  const next = p.offset + p.limit;
  const hasMore = next < total;
  const headers = {
    "X-Total-Count": String(total),
    "X-Limit": String(p.limit),
    "X-Offset": String(p.offset),
    "X-Has-More": hasMore ? "true" : "false",
  };
  if (hasMore) headers["X-Next-Offset"] = String(next);
  return headers;
}

test("no params -> not applied, take/skip undefined (legacy behaviour)", () => {
  const p = resolvePagination(null, null);
  assert.equal(p.applied, false);
  assert.equal(p.take, undefined);
  assert.equal(p.skip, undefined);
});

test("empty-string params -> not applied", () => {
  const p = resolvePagination("", "  ");
  assert.equal(p.applied, false);
});

test("limit only -> take=limit, skip=0", () => {
  const p = resolvePagination("25", null, { maxLimit: 500 });
  assert.deepEqual(p, { applied: true, limit: 25, offset: 0, take: 25, skip: 0 });
});

test("offset only -> limit falls back to defaultLimit", () => {
  const p = resolvePagination(null, "40", { maxLimit: 500, defaultLimit: 100 });
  assert.equal(p.applied, true);
  assert.equal(p.limit, 100);
  assert.equal(p.skip, 40);
});

test("limit above maxLimit is clamped", () => {
  const p = resolvePagination("100000", "0", { maxLimit: 500 });
  assert.equal(p.limit, 500);
  assert.equal(p.take, 500);
});

test("non-numeric limit falls back; negative offset becomes 0", () => {
  const p = resolvePagination("abc", "-5", { maxLimit: 500, defaultLimit: 50 });
  assert.equal(p.limit, 50);
  assert.equal(p.offset, 0);
});

test("zero / negative limit falls back to default", () => {
  assert.equal(resolvePagination("0", null, { defaultLimit: 30 }).limit, 30);
  assert.equal(resolvePagination("-9", null, { defaultLimit: 30 }).limit, 30);
});

test("headers empty when not applied", () => {
  assert.deepEqual(paginationHeaders(123, resolvePagination(null, null)), {});
});

test("headers include next-offset when more pages remain", () => {
  const p = resolvePagination("10", "0", { maxLimit: 500 });
  const h = paginationHeaders(35, p);
  assert.equal(h["X-Total-Count"], "35");
  assert.equal(h["X-Has-More"], "true");
  assert.equal(h["X-Next-Offset"], "10");
});

test("headers omit next-offset on the last page", () => {
  const p = resolvePagination("10", "30", { maxLimit: 500 });
  const h = paginationHeaders(35, p);
  assert.equal(h["X-Has-More"], "false");
  assert.equal(h["X-Next-Offset"], undefined);
});
