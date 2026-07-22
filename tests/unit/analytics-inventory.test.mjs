// Unit tests for the pure inventory-analytics helpers in
// src/lib/server/analytics-inventory.ts.
//
// Following this repo's convention (node --test runs .mjs with no TS loader), the
// pure algorithms are mirrored here and exercised directly. Keep this mirror in
// sync with src/lib/server/analytics-inventory.ts — the tests lock the
// consumption/wastage roll-up contract used by the Analytics dashboard.

import { test } from "node:test";
import assert from "node:assert/strict";

// --- mirror of src/lib/server/analytics-inventory.ts ---------------------
const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function rangeStart(range, now = new Date()) {
  if (range === "30d") return new Date(now.getTime() - 30 * 86400000);
  if (range === "90d") return new Date(now.getTime() - 90 * 86400000);
  if (range === "12m") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 12);
    return d;
  }
  return null;
}
const RANGES = ["30d", "90d", "12m", "all"];
const normalizeRange = (v) => (typeof v === "string" && RANGES.includes(v) ? v : "12m");

function movementValue(m) {
  const tc = m.totalCost == null ? null : Number(m.totalCost);
  if (tc != null && Number.isFinite(tc)) return round2(Math.abs(tc));
  const qty = Math.abs(Number(m.quantityDelta) || 0);
  const uc = Number(m.unitCost) || 0;
  return round2(qty * uc);
}
function accumulate(map, m, qty, value) {
  const row =
    map.get(m.itemId) ??
    { itemId: m.itemId, nameEn: m.item?.nameEn ?? "", nameAr: m.item?.nameAr ?? "", unit: m.item?.unit ?? "", qty: 0, value: 0 };
  row.qty += qty;
  row.value += value;
  map.set(m.itemId, row);
}
function topList(map, topN) {
  return [...map.values()]
    .map((r) => ({ ...r, qty: round3(r.qty), value: round2(r.value) }))
    .sort((a, b) => b.value - a.value || b.qty - a.qty || a.nameEn.localeCompare(b.nameEn))
    .slice(0, topN);
}
function summarizeConsumption(movements, topN = 6) {
  let consumptionValue = 0, consumptionQty = 0, wastageValue = 0, wastageQty = 0;
  const consumed = new Map();
  const wasted = new Map();
  for (const m of movements) {
    const qty = Math.abs(Number(m.quantityDelta) || 0);
    const value = movementValue(m);
    if (m.type === "consumption") {
      consumptionValue += value;
      consumptionQty += qty;
      accumulate(consumed, m, qty, value);
    } else if (m.type === "wastage") {
      wastageValue += value;
      wastageQty += qty;
      accumulate(wasted, m, qty, value);
    }
  }
  return {
    consumptionValue: round2(consumptionValue),
    consumptionQty: round3(consumptionQty),
    wastageValue: round2(wastageValue),
    wastageQty: round3(wastageQty),
    topConsumed: topList(consumed, topN),
    topWasted: topList(wasted, topN),
  };
}

// --- tests ---------------------------------------------------------------

test("normalizeRange: valid passes through, junk -> 12m", () => {
  assert.equal(normalizeRange("30d"), "30d");
  assert.equal(normalizeRange("90d"), "90d");
  assert.equal(normalizeRange("12m"), "12m");
  assert.equal(normalizeRange("all"), "all");
  assert.equal(normalizeRange("bogus"), "12m");
  assert.equal(normalizeRange(null), "12m");
  assert.equal(normalizeRange(7), "12m");
});

test("rangeStart: day windows subtract, 12m subtracts months, all is null", () => {
  const now = new Date("2026-06-15T00:00:00Z");
  assert.equal(rangeStart("all", now), null);
  assert.equal(rangeStart("30d", now).getTime(), now.getTime() - 30 * 86400000);
  assert.equal(rangeStart("90d", now).getTime(), now.getTime() - 90 * 86400000);
  const y = rangeStart("12m", now);
  assert.equal(y.getFullYear(), 2025);
  assert.equal(y.getMonth(), 5); // June (0-based)
});

test("movementValue: prefers snapshot totalCost, else qty x unitCost, always >= 0", () => {
  assert.equal(movementValue({ quantityDelta: -3, unitCost: 10, totalCost: 30 }), 30);
  // totalCost wins even if it disagrees with qty x unitCost (it is the snapshot).
  assert.equal(movementValue({ quantityDelta: -3, unitCost: 10, totalCost: 25 }), 25);
  // Missing totalCost -> recompute from |qty| x unitCost.
  assert.equal(movementValue({ quantityDelta: -3, unitCost: 10, totalCost: null }), 30);
  assert.equal(movementValue({ quantityDelta: -2.5, unitCost: 4, totalCost: undefined }), 10);
  // No cost data at all -> 0.
  assert.equal(movementValue({ quantityDelta: -5, unitCost: null, totalCost: null }), 0);
  // Negative snapshot is normalized to its magnitude.
  assert.equal(movementValue({ quantityDelta: -1, unitCost: 0, totalCost: -12 }), 12);
});

test("summarizeConsumption: splits consumption vs wastage, ignores other types", () => {
  const mv = [
    { itemId: "a", type: "consumption", quantityDelta: -2, unitCost: 5, totalCost: 10, item: { nameEn: "Anesthetic", nameAr: "بنج", unit: "vial" } },
    { itemId: "a", type: "consumption", quantityDelta: -1, unitCost: 5, totalCost: 5, item: { nameEn: "Anesthetic", nameAr: "بنج", unit: "vial" } },
    { itemId: "b", type: "consumption", quantityDelta: -4, unitCost: 2, totalCost: 8, item: { nameEn: "Gloves", nameAr: "قفازات", unit: "pair" } },
    { itemId: "b", type: "wastage", quantityDelta: -1, unitCost: 2, totalCost: 2, item: { nameEn: "Gloves", nameAr: "قفازات", unit: "pair" } },
    { itemId: "c", type: "receipt", quantityDelta: 100, unitCost: 1, totalCost: 100, item: { nameEn: "X", nameAr: "س", unit: "box" } },
    { itemId: "c", type: "adjustment", quantityDelta: -3, unitCost: 1, totalCost: 3, item: { nameEn: "X", nameAr: "س", unit: "box" } },
  ];
  const s = summarizeConsumption(mv);
  assert.equal(s.consumptionValue, 23); // 10 + 5 + 8
  assert.equal(s.consumptionQty, 7); // 2 + 1 + 4
  assert.equal(s.wastageValue, 2);
  assert.equal(s.wastageQty, 1);
  // Top consumed by value: Anesthetic (15) before Gloves (8).
  assert.deepEqual(
    s.topConsumed.map((r) => [r.itemId, r.qty, r.value]),
    [
      ["a", 3, 15],
      ["b", 4, 8],
    ],
  );
  assert.deepEqual(
    s.topWasted.map((r) => [r.itemId, r.qty, r.value]),
    [["b", 1, 2]],
  );
});

test("summarizeConsumption: empty input yields zeroed summary", () => {
  const s = summarizeConsumption([]);
  assert.deepEqual(s, {
    consumptionValue: 0,
    consumptionQty: 0,
    wastageValue: 0,
    wastageQty: 0,
    topConsumed: [],
    topWasted: [],
  });
});

test("summarizeConsumption: topN caps the returned lists", () => {
  const mv = [];
  for (let i = 0; i < 10; i++) {
    mv.push({ itemId: `i${i}`, type: "consumption", quantityDelta: -(i + 1), unitCost: 1, totalCost: i + 1, item: { nameEn: `I${i}`, nameAr: `ع${i}`, unit: "piece" } });
  }
  const s = summarizeConsumption(mv, 3);
  assert.equal(s.topConsumed.length, 3);
  // Highest value first: i9 (9), i8 (8), i7 (7).
  assert.deepEqual(s.topConsumed.map((r) => r.itemId), ["i9", "i8", "i7"]);
});
