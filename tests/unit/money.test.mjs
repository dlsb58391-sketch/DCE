// Mirror of src/lib/server/money.ts pure logic.
// The project has no TS test loader, so we re-implement num/numOrNull/serialize*
// exactly as in money.ts and verify Decimal->number conversion at every boundary.
// A Prisma.Decimal is faked as an object exposing toNumber().
import { test } from "node:test";
import assert from "node:assert/strict";

const fakeDecimal = (n) => ({ toNumber: () => n });

// --- mirrored implementation ---
function num(v) {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return v.toNumber();
}
function numOrNull(v) {
  return v == null ? null : num(v);
}
function serializeProcedure(p) {
  return { ...p, price: num(p.price), cost: numOrNull(p.cost) };
}
function serializeDoctor(d) {
  return { ...d, commissionPct: num(d.commissionPct) };
}

test("num: null/undefined coerce to 0 (arithmetic-safe)", () => {
  assert.equal(num(null), 0);
  assert.equal(num(undefined), 0);
});

test("num: passes through plain numbers", () => {
  assert.equal(num(0), 0);
  assert.equal(num(1500.5), 1500.5);
  assert.equal(num(-42), -42);
});

test("num: parses numeric strings (JSON body values)", () => {
  assert.equal(num("1500.00"), 1500);
  assert.equal(num("0.30"), 0.3);
});

test("num: unwraps Prisma.Decimal via toNumber()", () => {
  assert.equal(num(fakeDecimal(1500)), 1500);
  assert.equal(num(fakeDecimal(33.33)), 33.33);
});

test("num result supports arithmetic without NaN", () => {
  const total = num(fakeDecimal(100)) + num(fakeDecimal(50)) + num(null);
  assert.equal(total, 150);
  assert.ok(!Number.isNaN(total));
});

test("numOrNull: preserves null but converts values", () => {
  assert.equal(numOrNull(null), null);
  assert.equal(numOrNull(undefined), null);
  assert.equal(numOrNull(fakeDecimal(12.5)), 12.5);
  assert.equal(numOrNull("7.00"), 7);
});

test("serializeProcedure: money fields become numbers, null cost preserved", () => {
  const out = serializeProcedure({
    id: "p1",
    nameEn: "Cleaning",
    price: fakeDecimal(300),
    cost: fakeDecimal(120),
  });
  assert.equal(out.price, 300);
  assert.equal(out.cost, 120);
  assert.equal(out.nameEn, "Cleaning");
  assert.equal(typeof out.price, "number");

  const noCost = serializeProcedure({ id: "p2", price: fakeDecimal(300), cost: null });
  assert.equal(noCost.cost, null);
});

test("serializeDoctor: commissionPct becomes a number", () => {
  const out = serializeDoctor({ id: "d1", nameEn: "Dr A", commissionPct: fakeDecimal(40) });
  assert.equal(out.commissionPct, 40);
  assert.equal(typeof out.commissionPct, "number");
  assert.equal(out.nameEn, "Dr A");
});

test("serialized output is JSON-safe (no Decimal objects leak as strings)", () => {
  const json = JSON.parse(
    JSON.stringify(serializeProcedure({ id: "p1", price: fakeDecimal(1500), cost: fakeDecimal(0) }))
  );
  assert.equal(json.price, 1500);
  assert.equal(typeof json.price, "number");
  assert.notEqual(typeof json.price, "string");
});
