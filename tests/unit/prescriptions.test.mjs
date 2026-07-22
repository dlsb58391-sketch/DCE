// Unit tests for the pure prescription helpers in
// src/lib/server/prescriptions.ts.
//
// Following this repo's convention (node --test runs .mjs with no TS loader), the
// pure algorithms are mirrored here and exercised directly. Keep this mirror in
// sync with src/lib/server/prescriptions.ts — the tests lock the prescription
// contract: status guards, refill/duration clamps, RX code formatting, and the
// (intentionally empty) interaction hook.

import { test } from "node:test";
import assert from "node:assert/strict";

// --- mirror of src/lib/server/prescriptions.ts ---------------------------
const RX_STATUSES = ["issued", "cancelled"];
const isRxStatus = (v) => typeof v === "string" && RX_STATUSES.includes(v);
const canCancelRx = (s) => s === "issued";

const MAX_REFILLS = 12;
const MAX_DURATION_DAYS = 365;

const clampRefills = (n) => {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(v, MAX_REFILLS);
};

const clampDurationDays = (n) => {
  if (n === null || n === undefined || n === "") return null;
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.min(v, MAX_DURATION_DAYS);
};

const RX_SEQ_WIDTH = 4;
const buildRxCode = (year, seq) => {
  const y = Math.trunc(Number(year));
  const s = Math.max(1, Math.trunc(Number(seq)) || 1);
  return `RX-${y}-${String(s).padStart(RX_SEQ_WIDTH, "0")}`;
};

const checkInteractions = (_items) => [];

// --- tests ---------------------------------------------------------------

test("RX_STATUSES / isRxStatus", () => {
  assert.deepEqual(RX_STATUSES, ["issued", "cancelled"]);
  assert.equal(isRxStatus("issued"), true);
  assert.equal(isRxStatus("cancelled"), true);
  assert.equal(isRxStatus("draft"), false);
  assert.equal(isRxStatus(""), false);
  assert.equal(isRxStatus(null), false);
  assert.equal(isRxStatus(1), false);
});

test("canCancelRx: only issued can cancel", () => {
  assert.equal(canCancelRx("issued"), true);
  assert.equal(canCancelRx("cancelled"), false);
  assert.equal(canCancelRx("whatever"), false);
});

test("clampRefills: whole number in [0, 12]", () => {
  assert.equal(clampRefills(0), 0);
  assert.equal(clampRefills(3), 3);
  assert.equal(clampRefills(12), 12);
  assert.equal(clampRefills(13), 12); // capped
  assert.equal(clampRefills(999), 12); // capped
  assert.equal(clampRefills(-1), 0); // negative -> 0
  assert.equal(clampRefills(2.9), 2); // floored
  assert.equal(clampRefills("4"), 4); // coerced
  assert.equal(clampRefills("abc"), 0); // NaN -> 0
  assert.equal(clampRefills(null), 0);
  assert.equal(clampRefills(undefined), 0);
});

test("clampDurationDays: [1, 365] or null", () => {
  assert.equal(clampDurationDays(null), null);
  assert.equal(clampDurationDays(undefined), null);
  assert.equal(clampDurationDays(""), null);
  assert.equal(clampDurationDays(0), null); // <=0 -> null
  assert.equal(clampDurationDays(-5), null);
  assert.equal(clampDurationDays(1), 1);
  assert.equal(clampDurationDays(7), 7);
  assert.equal(clampDurationDays(365), 365);
  assert.equal(clampDurationDays(366), 365); // capped
  assert.equal(clampDurationDays(10000), 365); // capped
  assert.equal(clampDurationDays(5.8), 5); // floored
  assert.equal(clampDurationDays("14"), 14); // coerced
  assert.equal(clampDurationDays("nope"), null); // NaN -> null
});

test("buildRxCode: RX-YYYY-NNNN zero padded", () => {
  assert.equal(buildRxCode(2026, 1), "RX-2026-0001");
  assert.equal(buildRxCode(2026, 42), "RX-2026-0042");
  assert.equal(buildRxCode(2026, 9999), "RX-2026-9999");
  assert.equal(buildRxCode(2026, 10000), "RX-2026-10000"); // wider than 4 when needed
  assert.equal(buildRxCode(2026, 0), "RX-2026-0001"); // seq floored to >=1
  assert.equal(buildRxCode("2027", "7"), "RX-2027-0007"); // coerced
});

test("checkInteractions: safe stub returns no warnings", () => {
  assert.deepEqual(checkInteractions([]), []);
  assert.deepEqual(
    checkInteractions([
      { medicationId: "m1", nameEn: "Amoxicillin" },
      { medicationId: "m2", nameEn: "Ibuprofen" },
    ]),
    [],
  );
});
