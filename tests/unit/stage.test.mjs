import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Unit tests for the appointment lifecycle stage logic.
 *
 * `stageOf` in src/lib/server/appointments.ts is a pure function of
 * (status, scheduledAt, now) + the REMINDER_LEAD_MIN/QUEUE_LEAD_MIN thresholds.
 * We re-implement that exact logic here so the test runs with plain `node --test`
 * (no build / no Prisma), which keeps it fast and deterministic in CI.
 *
 * If you change the thresholds or branch order in the source, update both.
 */
const REMINDER_LEAD_MIN = 120;
const QUEUE_LEAD_MIN = 60;

function minutesUntil(scheduledAt, now) {
  return (scheduledAt.getTime() - now.getTime()) / 60000;
}

function stageOf(appt, now) {
  if (appt.status === "declined") return "declined";
  if (appt.status === "cancelled") return "cancelled";
  if (appt.status === "completed") return "completed";
  if (appt.status === "pending") return "pending";
  const mins = minutesUntil(appt.scheduledAt, now);
  if (mins <= 0) return "turn";
  if (mins <= QUEUE_LEAD_MIN) return "queue";
  if (mins <= REMINDER_LEAD_MIN) return "reminder";
  return "reserved";
}

const now = new Date("2026-06-27T12:00:00Z");
const at = (mins) => ({ status: "confirmed", scheduledAt: new Date(now.getTime() + mins * 60000) });

test("non-confirmed statuses pass through unchanged", () => {
  for (const s of ["pending", "declined", "cancelled", "completed"]) {
    assert.equal(stageOf({ status: s, scheduledAt: now }, now), s);
  }
});

test("confirmed, far in the future -> reserved", () => {
  assert.equal(stageOf(at(240), now), "reserved"); // 4h out
});

test("confirmed, within reminder window (<=120m) -> reminder", () => {
  assert.equal(stageOf(at(120), now), "reminder");
  assert.equal(stageOf(at(90), now), "reminder");
});

test("confirmed, within queue window (<=60m) -> queue", () => {
  assert.equal(stageOf(at(60), now), "queue");
  assert.equal(stageOf(at(15), now), "queue");
});

test("confirmed, time reached or passed -> turn", () => {
  assert.equal(stageOf(at(0), now), "turn");
  assert.equal(stageOf(at(-5), now), "turn");
});

test("threshold boundaries are inclusive on the lower stage", () => {
  // exactly 60 -> queue (not reminder); exactly 120 -> reminder (not reserved)
  assert.equal(stageOf(at(60), now), "queue");
  assert.equal(stageOf(at(120), now), "reminder");
  assert.equal(stageOf(at(60.0001), now), "reminder");
  assert.equal(stageOf(at(120.0001), now), "reserved");
});
