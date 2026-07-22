import test from "node:test";
import assert from "node:assert/strict";

// Mirrors the pure authorization decisions in src/lib/server/guard.ts. The guard
// itself is TypeScript and does DB I/O, so we unit-test the branch logic here.

const OWNER_ROLES = ["admin", "doctor"];

/** requireRole's membership check. */
function roleAllowed(role, allowed) {
  return allowed.includes(role);
}

/** Token version resolution: legacy tokens without `ver` map to 1. */
function resolveVer(ver) {
  return ver ?? 1;
}

/** requireSession's revocation decision. */
function isRevoked(tokenVer, dbTokenVersion) {
  return resolveVer(tokenVer) !== dbTokenVersion;
}

test("OWNER_ROLES admits admin and doctor, rejects others", () => {
  assert.equal(roleAllowed("admin", OWNER_ROLES), true);
  assert.equal(roleAllowed("doctor", OWNER_ROLES), true);
  assert.equal(roleAllowed("staff", OWNER_ROLES), false);
  assert.equal(roleAllowed("reception", OWNER_ROLES), false);
  assert.equal(roleAllowed("", OWNER_ROLES), false);
});

test("legacy tokens (no ver) are treated as version 1", () => {
  assert.equal(resolveVer(undefined), 1);
  assert.equal(resolveVer(null), 1);
  assert.equal(resolveVer(5), 5);
});

test("revocation: matching versions pass, mismatched fail", () => {
  // Old cookie (no ver) against a fresh user (tokenVersion 1) still works.
  assert.equal(isRevoked(undefined, 1), false);
  assert.equal(isRevoked(1, 1), false);
  // After a logout bumped tokenVersion to 2, the old ver-1 cookie is revoked.
  assert.equal(isRevoked(1, 2), true);
  // A cookie minted at ver 2 works against user tokenVersion 2.
  assert.equal(isRevoked(2, 2), false);
  // Legacy cookie after any bump is revoked.
  assert.equal(isRevoked(undefined, 3), true);
});
