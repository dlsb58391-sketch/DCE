// Unit tests for the pure purchase-order helpers in
// src/lib/server/purchase-orders.ts.
//
// Following this repo's convention (node --test runs .mjs with no TS loader), the
// pure algorithms are mirrored here and exercised directly. Keep this mirror in
// sync with src/lib/server/purchase-orders.ts — the tests lock the PO contract:
// status guards, line-remaining math, status derivation, and value roll-ups.

import { test } from "node:test";
import assert from "node:assert/strict";

// --- mirror of src/lib/server/purchase-orders.ts -------------------------
const PO_STATUSES = ["draft", "submitted", "partially_received", "received", "cancelled"];
const isPoStatus = (v) => typeof v === "string" && PO_STATUSES.includes(v);

const round3 = (n) => Math.round((n + Number.EPSILON) * 1000) / 1000;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const canEditPoLines = (s) => s === "draft";
const canEditPoHeader = (s) => s === "draft" || s === "submitted";
const canSubmitPo = (s) => s === "draft";
const canCancelPo = (s) => s === "draft" || s === "submitted" || s === "partially_received";
const canReceivePo = (s) => s === "submitted" || s === "partially_received";

const poLineRemaining = (l) => round3(Math.max(0, (Number(l.orderedQty) || 0) - (Number(l.receivedQty) || 0)));
const isPoLineFullyReceived = (l) => {
  const ordered = Number(l.orderedQty) || 0;
  return ordered > 0 && (Number(l.receivedQty) || 0) >= ordered;
};
function computePoStatus(lines, opts) {
  if (opts?.cancelled) return "cancelled";
  const fallback = opts?.fallback ?? "submitted";
  if (lines.length === 0) return fallback;
  const anyReceived = lines.some((l) => (Number(l.receivedQty) || 0) > 0);
  const allReceived = lines.every((l) => isPoLineFullyReceived(l));
  if (allReceived) return "received";
  if (anyReceived) return "partially_received";
  return fallback;
}
const poOrderedValue = (lines) =>
  round2(lines.reduce((s, l) => s + (Number(l.orderedQty) || 0) * (Number(l.unitCost) || 0), 0));
const poReceivedValue = (lines) =>
  round2(lines.reduce((s, l) => s + (Number(l.receivedQty) || 0) * (Number(l.unitCost) || 0), 0));
const poRemainingValue = (lines) =>
  round2(lines.reduce((s, l) => s + poLineRemaining(l) * (Number(l.unitCost) || 0), 0));

// --- tests ---------------------------------------------------------------

test("isPoStatus: recognizes the five lifecycle statuses only", () => {
  for (const s of PO_STATUSES) assert.equal(isPoStatus(s), true);
  assert.equal(isPoStatus("open"), false);
  assert.equal(isPoStatus(""), false);
  assert.equal(isPoStatus(null), false);
  assert.equal(isPoStatus(3), false);
});

test("canEditPoLines: only drafts allow line edits", () => {
  assert.equal(canEditPoLines("draft"), true);
  for (const s of ["submitted", "partially_received", "received", "cancelled"]) {
    assert.equal(canEditPoLines(s), false);
  }
});

test("canEditPoHeader: draft and submitted allow header edits", () => {
  assert.equal(canEditPoHeader("draft"), true);
  assert.equal(canEditPoHeader("submitted"), true);
  for (const s of ["partially_received", "received", "cancelled"]) {
    assert.equal(canEditPoHeader(s), false);
  }
});

test("canSubmitPo: only from draft", () => {
  assert.equal(canSubmitPo("draft"), true);
  for (const s of ["submitted", "partially_received", "received", "cancelled"]) {
    assert.equal(canSubmitPo(s), false);
  }
});

test("canCancelPo: draft, submitted, partially_received", () => {
  assert.equal(canCancelPo("draft"), true);
  assert.equal(canCancelPo("submitted"), true);
  assert.equal(canCancelPo("partially_received"), true);
  assert.equal(canCancelPo("received"), false);
  assert.equal(canCancelPo("cancelled"), false);
});

test("canReceivePo: submitted and partially_received", () => {
  assert.equal(canReceivePo("submitted"), true);
  assert.equal(canReceivePo("partially_received"), true);
  for (const s of ["draft", "received", "cancelled"]) {
    assert.equal(canReceivePo(s), false);
  }
});

test("poLineRemaining: outstanding qty, never negative, 3 dp", () => {
  assert.equal(poLineRemaining({ orderedQty: 10, receivedQty: 3 }), 7);
  assert.equal(poLineRemaining({ orderedQty: 5, receivedQty: 5 }), 0);
  assert.equal(poLineRemaining({ orderedQty: 5, receivedQty: 8 }), 0); // over-received clamps
  assert.equal(poLineRemaining({ orderedQty: 1.005, receivedQty: 1 }), 0.005);
});

test("isPoLineFullyReceived: closed only when received >= ordered > 0", () => {
  assert.equal(isPoLineFullyReceived({ orderedQty: 4, receivedQty: 4 }), true);
  assert.equal(isPoLineFullyReceived({ orderedQty: 4, receivedQty: 5 }), true);
  assert.equal(isPoLineFullyReceived({ orderedQty: 4, receivedQty: 3.999 }), false);
  assert.equal(isPoLineFullyReceived({ orderedQty: 0, receivedQty: 0 }), false);
});

test("computePoStatus: cancelled flag short-circuits", () => {
  assert.equal(computePoStatus([{ orderedQty: 5, receivedQty: 5 }], { cancelled: true }), "cancelled");
});

test("computePoStatus: no lines returns fallback", () => {
  assert.equal(computePoStatus([]), "submitted");
  assert.equal(computePoStatus([], { fallback: "draft" }), "draft");
});

test("computePoStatus: all lines fully received => received", () => {
  const lines = [
    { orderedQty: 5, receivedQty: 5 },
    { orderedQty: 2, receivedQty: 2 },
  ];
  assert.equal(computePoStatus(lines), "received");
});

test("computePoStatus: some received => partially_received", () => {
  const lines = [
    { orderedQty: 5, receivedQty: 2 },
    { orderedQty: 2, receivedQty: 0 },
  ];
  assert.equal(computePoStatus(lines), "partially_received");
});

test("computePoStatus: nothing received keeps fallback", () => {
  const lines = [
    { orderedQty: 5, receivedQty: 0 },
    { orderedQty: 2, receivedQty: 0 },
  ];
  assert.equal(computePoStatus(lines, { fallback: "submitted" }), "submitted");
  assert.equal(computePoStatus(lines, { fallback: "draft" }), "draft");
});

test("computePoStatus: one fully received, one untouched => partially_received", () => {
  const lines = [
    { orderedQty: 5, receivedQty: 5 },
    { orderedQty: 2, receivedQty: 0 },
  ];
  assert.equal(computePoStatus(lines), "partially_received");
});

test("poOrderedValue / poReceivedValue / poRemainingValue roll-ups", () => {
  const lines = [
    { orderedQty: 10, receivedQty: 4, unitCost: 2.5 },
    { orderedQty: 3, receivedQty: 3, unitCost: 10 },
  ];
  assert.equal(poOrderedValue(lines), 55); // 10*2.5 + 3*10 = 25 + 30
  assert.equal(poReceivedValue(lines), 40); // 4*2.5 + 3*10 = 10 + 30
  assert.equal(poRemainingValue(lines), 15); // 6*2.5 + 0*10 = 15
});

test("value roll-ups: missing unitCost treated as 0", () => {
  const lines = [{ orderedQty: 10, receivedQty: 4 }];
  assert.equal(poOrderedValue(lines), 0);
  assert.equal(poReceivedValue(lines), 0);
  assert.equal(poRemainingValue(lines), 0);
});
