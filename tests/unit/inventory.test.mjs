// Unit tests for the pure inventory helpers in src/lib/server/inventory.ts.
//
// Following this repo's convention (node --test runs .mjs with no TS loader), the
// pure algorithms are mirrored here and exercised directly. Keep this mirror in
// sync with src/lib/server/inventory.ts — the tests lock the stock-math contract:
// on-hand, valuation, low-stock, expiry, FEFO ordering and FEFO allocation.

import { test } from "node:test";
import assert from "node:assert/strict";

// --- mirror of src/lib/server/inventory.ts -------------------------------
const MOVEMENT_TYPES = [
  "receipt",
  "consumption",
  "wastage",
  "adjustment",
  "transfer_in",
  "transfer_out",
  "return",
];
const INCREASE_TYPES = new Set(["receipt", "transfer_in"]);
const DECREASE_TYPES = new Set(["consumption", "wastage", "transfer_out", "return"]);

const isMovementType = (v) => typeof v === "string" && MOVEMENT_TYPES.includes(v);
function signForType(type) {
  if (INCREASE_TYPES.has(type)) return 1;
  if (DECREASE_TYPES.has(type)) return -1;
  return null;
}
const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const onHand = (batches) => round3(batches.reduce((s, b) => s + (Number(b.remainingQty) || 0), 0));
const valuation = (batches) =>
  round2(batches.reduce((s, b) => s + (Number(b.remainingQty) || 0) * (Number(b.unitCost) || 0), 0));
const isLowStock = (q, level) => level > 0 && q <= level;
function suggestedOrderQty(onHandQty, onOrderQty, reorderLevel, reorderQty) {
  if (!(reorderLevel > 0)) return 0;
  const covered = round3((Number(onHandQty) || 0) + Math.max(0, Number(onOrderQty) || 0));
  if (covered > reorderLevel) return 0;
  const rq = Number(reorderQty);
  if (Number.isFinite(rq) && rq > 0) return round3(rq);
  return round3(Math.max(0, reorderLevel - covered));
}
const toTime = (v) => {
  if (v == null) return null;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};
const isExpired = (d, asOf = new Date()) => {
  const t = toTime(d);
  return t != null && t < asOf.getTime();
};
const isExpiringSoon = (d, days, asOf = new Date()) => {
  const t = toTime(d);
  if (t == null) return false;
  const now = asOf.getTime();
  return t >= now && t <= now + days * 86400000;
};
function fefoOrder(batches) {
  return [...batches].sort((a, b) => {
    const ea = toTime(a.expiryDate);
    const eb = toTime(b.expiryDate);
    if (ea !== eb) {
      if (ea == null) return 1;
      if (eb == null) return -1;
      return ea - eb;
    }
    const ra = toTime(a.receivedAt) ?? 0;
    const rb = toTime(b.receivedAt) ?? 0;
    if (ra !== rb) return ra - rb;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
function allocateFefo(batches, qtyNeeded) {
  let need = round3(Math.max(0, qtyNeeded));
  const allocations = [];
  for (const b of fefoOrder(batches)) {
    if (need <= 0) break;
    const avail = round3(Math.max(0, Number(b.remainingQty) || 0));
    if (avail <= 0) continue;
    const take = round3(Math.min(avail, need));
    if (take > 0) {
      allocations.push({ batchId: b.id, qty: take });
      need = round3(need - take);
    }
  }
  return { allocations, shortfall: round3(Math.max(0, need)) };
}

// --- tests ---------------------------------------------------------------

test("signForType: increases, decreases, and signed adjustment", () => {
  assert.equal(signForType("receipt"), 1);
  assert.equal(signForType("transfer_in"), 1);
  assert.equal(signForType("consumption"), -1);
  assert.equal(signForType("wastage"), -1);
  assert.equal(signForType("transfer_out"), -1);
  assert.equal(signForType("return"), -1);
  assert.equal(signForType("adjustment"), null);
});

test("isMovementType guards valid/invalid values", () => {
  assert.equal(isMovementType("receipt"), true);
  assert.equal(isMovementType("consumption"), true);
  assert.equal(isMovementType("teleport"), false);
  assert.equal(isMovementType(""), false);
  assert.equal(isMovementType(null), false);
  assert.equal(isMovementType(42), false);
});

test("round3 / round2 avoid float drift", () => {
  assert.equal(round3(0.1 + 0.2), 0.3);
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(round3(1.0005), 1.001);
  assert.equal(round2(2.005), 2.01);
  assert.equal(round2(19.999), 20);
});

test("onHand sums remaining quantities and tolerates junk", () => {
  assert.equal(onHand([]), 0);
  assert.equal(onHand([{ remainingQty: 5 }, { remainingQty: 2.5 }]), 7.5);
  assert.equal(onHand([{ remainingQty: 1.111 }, { remainingQty: 2.222 }]), 3.333);
  assert.equal(onHand([{ remainingQty: NaN }, { remainingQty: 3 }]), 3);
});

test("valuation multiplies remaining × unitCost and rounds to money", () => {
  assert.equal(valuation([]), 0);
  assert.equal(valuation([{ remainingQty: 10, unitCost: 2.5 }]), 25);
  assert.equal(
    valuation([
      { remainingQty: 3, unitCost: 1.335 },
      { remainingQty: 2, unitCost: 4 },
    ]),
    round2(3 * 1.335 + 8),
  );
});

test("isLowStock only fires when a reorder level is set", () => {
  assert.equal(isLowStock(0, 0), false); // untracked
  assert.equal(isLowStock(3, 5), true); // below
  assert.equal(isLowStock(5, 5), true); // at reorder point
  assert.equal(isLowStock(6, 5), false); // above
  assert.equal(isLowStock(0, 5), true); // out of stock
});

test("suggestedOrderQty: nets on-order and respects reorder policy", () => {
  // No reorder level → never suggests an order.
  assert.equal(suggestedOrderQty(0, 0, 0, null), 0);
  // Above the reorder level on-hand alone → nothing to order.
  assert.equal(suggestedOrderQty(10, 0, 5, null), 0);
  // Low and no configured batch size → order the shortfall back to the level.
  assert.equal(suggestedOrderQty(2, 0, 5, null), 3);
  assert.equal(suggestedOrderQty(0, 0, 5, null), 5);
  // Low but an open PO already covers the level → do not double-order.
  assert.equal(suggestedOrderQty(2, 4, 5, null), 0);
  // Low, partial coverage on order → order only the remaining shortfall.
  assert.equal(suggestedOrderQty(1, 1, 5, null), 3);
  // Configured reorderQty (batch size) wins over the raw shortfall when low.
  assert.equal(suggestedOrderQty(2, 0, 5, 20), 20);
  // reorderQty is ignored once coverage already exceeds the level.
  assert.equal(suggestedOrderQty(6, 0, 5, 20), 0);
  // At the reorder point exactly is still low; suggest the batch size.
  assert.equal(suggestedOrderQty(5, 0, 5, 12), 12);
  // Fractional quantities round to 3 dp.
  assert.equal(suggestedOrderQty(1.111, 0, 3.333, null), 2.222);
  // Junk on-order is clamped to zero, not treated as coverage.
  assert.equal(suggestedOrderQty(2, NaN, 5, null), 3);
});

test("isExpired: past yes, future no, missing no", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  assert.equal(isExpired("2026-05-31T00:00:00Z", now), true);
  assert.equal(isExpired("2026-06-02T00:00:00Z", now), false);
  assert.equal(isExpired(null, now), false);
  assert.equal(isExpired(undefined, now), false);
});

test("isExpiringSoon: within horizon only, excludes already-expired", () => {
  const now = new Date("2026-06-01T00:00:00Z");
  assert.equal(isExpiringSoon("2026-06-10T00:00:00Z", 30, now), true);
  assert.equal(isExpiringSoon("2026-08-01T00:00:00Z", 30, now), false); // beyond
  assert.equal(isExpiringSoon("2026-05-01T00:00:00Z", 30, now), false); // already expired
  assert.equal(isExpiringSoon(null, 30, now), false);
});

test("fefoOrder: soonest expiry first, undated last, tie-break by received then id", () => {
  const batches = [
    { id: "b-none", remainingQty: 1, unitCost: 1, expiryDate: null, receivedAt: "2026-01-01" },
    { id: "b-late", remainingQty: 1, unitCost: 1, expiryDate: "2026-12-01", receivedAt: "2026-01-01" },
    { id: "b-early", remainingQty: 1, unitCost: 1, expiryDate: "2026-06-01", receivedAt: "2026-01-01" },
  ];
  assert.deepEqual(
    fefoOrder(batches).map((b) => b.id),
    ["b-early", "b-late", "b-none"],
  );
});

test("fefoOrder: same expiry breaks ties by earliest receivedAt then id", () => {
  const batches = [
    { id: "b2", remainingQty: 1, unitCost: 1, expiryDate: "2026-06-01", receivedAt: "2026-02-01" },
    { id: "b1", remainingQty: 1, unitCost: 1, expiryDate: "2026-06-01", receivedAt: "2026-01-01" },
    { id: "b3", remainingQty: 1, unitCost: 1, expiryDate: "2026-06-01", receivedAt: "2026-01-01" },
  ];
  assert.deepEqual(
    fefoOrder(batches).map((b) => b.id),
    ["b1", "b3", "b2"],
  );
});

test("allocateFefo: fully satisfied across batches in FEFO order", () => {
  const batches = [
    { id: "late", remainingQty: 10, unitCost: 1, expiryDate: "2026-12-01" },
    { id: "early", remainingQty: 4, unitCost: 1, expiryDate: "2026-06-01" },
  ];
  const r = allocateFefo(batches, 6);
  assert.equal(r.shortfall, 0);
  assert.deepEqual(r.allocations, [
    { batchId: "early", qty: 4 },
    { batchId: "late", qty: 2 },
  ]);
});

test("allocateFefo: reports shortfall when stock is insufficient", () => {
  const batches = [{ id: "a", remainingQty: 3, unitCost: 1, expiryDate: "2026-06-01" }];
  const r = allocateFefo(batches, 5);
  assert.deepEqual(r.allocations, [{ batchId: "a", qty: 3 }]);
  assert.equal(r.shortfall, 2);
});

test("allocateFefo: skips depleted batches and stops when satisfied", () => {
  const batches = [
    { id: "empty", remainingQty: 0, unitCost: 1, expiryDate: "2026-05-01" },
    { id: "use", remainingQty: 8, unitCost: 1, expiryDate: "2026-06-01" },
    { id: "untouched", remainingQty: 8, unitCost: 1, expiryDate: "2026-07-01" },
  ];
  const r = allocateFefo(batches, 5);
  assert.deepEqual(r.allocations, [{ batchId: "use", qty: 5 }]);
  assert.equal(r.shortfall, 0);
});

test("allocateFefo: zero or negative need yields no allocations", () => {
  const batches = [{ id: "a", remainingQty: 3, unitCost: 1, expiryDate: null }];
  assert.deepEqual(allocateFefo(batches, 0), { allocations: [], shortfall: 0 });
  assert.deepEqual(allocateFefo(batches, -5), { allocations: [], shortfall: 0 });
});

test("allocateFefo: fractional quantities allocate without drift", () => {
  const batches = [
    { id: "x", remainingQty: 1.111, unitCost: 1, expiryDate: "2026-06-01" },
    { id: "y", remainingQty: 2.222, unitCost: 1, expiryDate: "2026-07-01" },
  ];
  const r = allocateFefo(batches, 2.5);
  assert.equal(r.shortfall, 0);
  assert.deepEqual(r.allocations, [
    { batchId: "x", qty: 1.111 },
    { batchId: "y", qty: 1.389 },
  ]);
});
