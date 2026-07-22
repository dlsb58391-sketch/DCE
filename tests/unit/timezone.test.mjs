// s2-tz: verify the timezone-pinning strategy from instrumentation.ts.
// The fix pins the process TZ to Africa/Cairo so appointment slot/day math
// (Date.getHours/setHours) agrees with the Cairo-formatted labels shown to
// patients. These tests mirror the guard's decision and exercise the real
// Node Date/Intl behavior the fix depends on.
import { test } from "node:test";
import assert from "node:assert/strict";

// Mirror of the instrumentation.ts guard: default to Africa/Cairo only if unset.
function resolveTz(currentTz) {
  return currentTz ? currentTz : "Africa/Cairo";
}

test("guard defaults to Africa/Cairo only when TZ is unset", () => {
  assert.equal(resolveTz(undefined), "Africa/Cairo");
  assert.equal(resolveTz(""), "Africa/Cairo");
  assert.equal(resolveTz("UTC"), "UTC");
  assert.equal(resolveTz("America/New_York"), "America/New_York");
});

test("under Africa/Cairo, Date.getHours matches the Cairo label hour", () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = "Africa/Cairo";
    // A fixed UTC instant; slot math uses getHours(), labels use Intl+Cairo.
    const instant = new Date("2026-07-08T09:30:00Z");
    const labelHour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Africa/Cairo",
      }).format(instant)
    );
    // The computation path (getHours) must equal the display path (Intl Cairo).
    assert.equal(instant.getHours(), labelHour);
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});

test("a UTC host WOULD drift (regression rationale)", () => {
  const original = process.env.TZ;
  try {
    process.env.TZ = "UTC";
    const instant = new Date("2026-07-08T09:30:00Z");
    const cairoHour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        hour12: false,
        timeZone: "Africa/Cairo",
      }).format(instant)
    );
    // Without pinning, computation (UTC getHours) != Cairo label -> the bug.
    assert.notEqual(instant.getHours(), cairoHour);
  } finally {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  }
});
