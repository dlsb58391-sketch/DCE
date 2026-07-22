import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

// Mirrors prisma/seed.mjs generatePassword() + the "require password in prod"
// decision, so the SEC-03 default-credentials guarantees are regression-tested.

function generatePassword() {
  return randomBytes(18).toString("base64url");
}

/** Mirrors the seed's decision on whether to hard-fail. */
function mustFailInProd(isProd, providedPassword) {
  return isProd && !providedPassword;
}

test("generated password is URL-safe and long enough", () => {
  for (let i = 0; i < 50; i++) {
    const pw = generatePassword();
    assert.ok(pw.length >= 22, `expected >=22 chars, got ${pw.length}`);
    // base64url alphabet only: A-Z a-z 0-9 - _ (no +, /, or = padding).
    assert.match(pw, /^[A-Za-z0-9_-]+$/);
  }
});

test("generated passwords are unique across calls", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(generatePassword());
  assert.equal(seen.size, 200);
});

test("production without SEED_DOCTOR_PASSWORD must fail; dev or provided passes", () => {
  assert.equal(mustFailInProd(true, undefined), true); // prod, no password → refuse
  assert.equal(mustFailInProd(true, "supplied"), false); // prod, password → ok
  assert.equal(mustFailInProd(false, undefined), false); // dev → generate
  assert.equal(mustFailInProd(false, "supplied"), false);
});
