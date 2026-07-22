// Mirror tests for the pure, patient-facing helpers in src/lib/server/messages.ts.
// messages.ts imports @prisma/client and @/lib/site, so it cannot be imported
// directly from a plain .mjs without a build step. Following the repo convention
// (see phone.test.mjs), the pure logic is re-declared here and asserted, guarding
// against accidental future changes to WhatsApp wording / tracking links.

import { test } from "node:test";
import assert from "node:assert/strict";

// --- mirror of aheadPhrase(ahead, ar) -------------------------------------
function aheadPhrase(ahead, ar) {
  const n = Math.max(0, ahead);
  if (ar) return n === 0 ? "أنت التالي في الدور!" : `يوجد ${n} ${n === 1 ? "مريض" : "مرضى"} قبلك`;
  return n === 0 ? "You're next in line!" : `There ${n === 1 ? "is 1 patient" : `are ${n} patients`} ahead of you`;
}

// --- mirror of trackUrl(code) ---------------------------------------------
// The source reads process.env.APP_URL; here an explicit env is injected so the
// tests stay hermetic and do not mutate global process.env.
function trackUrl(code, env = {}) {
  const base = (env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/track/${code}`;
}

test("aheadPhrase: zero means next in line (EN/AR)", () => {
  assert.equal(aheadPhrase(0, false), "You're next in line!");
  assert.equal(aheadPhrase(0, true), "أنت التالي في الدور!");
});

test("aheadPhrase: singular uses '1 patient' / 'مريض'", () => {
  assert.equal(aheadPhrase(1, false), "There is 1 patient ahead of you");
  assert.equal(aheadPhrase(1, true), "يوجد 1 مريض قبلك");
});

test("aheadPhrase: plural uses 'N patients' / 'مرضى'", () => {
  assert.equal(aheadPhrase(2, false), "There are 2 patients ahead of you");
  assert.equal(aheadPhrase(5, false), "There are 5 patients ahead of you");
  assert.equal(aheadPhrase(3, true), "يوجد 3 مرضى قبلك");
});

test("aheadPhrase: negative counts clamp to zero", () => {
  assert.equal(aheadPhrase(-4, false), "You're next in line!");
  assert.equal(aheadPhrase(-1, true), "أنت التالي في الدور!");
});

test("trackUrl: falls back to localhost when APP_URL is unset", () => {
  assert.equal(trackUrl("ABC123"), "http://localhost:3000/track/ABC123");
});

test("trackUrl: uses configured APP_URL", () => {
  assert.equal(
    trackUrl("XYZ", { APP_URL: "https://clinic.example" }),
    "https://clinic.example/track/XYZ",
  );
});

test("trackUrl: strips a single trailing slash from APP_URL", () => {
  assert.equal(
    trackUrl("XYZ", { APP_URL: "https://clinic.example/" }),
    "https://clinic.example/track/XYZ",
  );
});
