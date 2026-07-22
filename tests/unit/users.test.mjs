// Unit tests for the pure staff-account helpers in src/lib/server/users.ts
// (Sprint 15, multi-branch Phase 4a).
//
// Per this repo's convention (node --test runs .mjs with no TS loader), the pure
// normalization + guard logic is mirrored here and exercised directly. Keep this
// mirror in sync with users.ts. These lock the contracts that (a) an invalid role
// collapses to the least-privileged "staff", (b) email/username shape checks match
// the service, (c) the password length policy is enforced, and (d) you can never
// delete yourself or remove the final admin.

import { test } from "node:test";
import assert from "node:assert/strict";

// --- mirror of the helpers -----------------------------------------------
const USER_ROLES = ["admin", "doctor", "staff"];
const MIN_PASSWORD_LEN = 8;
const MAX_PASSWORD_LEN = 200;

const isValidRole = (role) => typeof role === "string" && USER_ROLES.includes(role);
const normalizeRole = (role) => {
  const r = typeof role === "string" ? role.trim().toLowerCase() : "";
  return isValidRole(r) ? r : "staff";
};
const normalizeEmail = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const normalizeUsername = (username) => {
  if (typeof username !== "string") return null;
  const u = username.trim().toLowerCase();
  return u.length ? u : null;
};
const isValidUsername = (username) => {
  if (username === null) return true;
  return /^[a-z0-9._-]{3,32}$/.test(username);
};
const isValidPassword = (password) =>
  typeof password === "string" && password.length >= MIN_PASSWORD_LEN && password.length <= MAX_PASSWORD_LEN;

const deleteUserBlock = (p) => {
  if (p.actorId === p.targetId) return "cannot_delete_self";
  if (normalizeRole(p.targetRole) === "admin" && p.adminCount <= 1) return "last_admin";
  return null;
};
const changeRoleBlock = (p) => {
  const from = normalizeRole(p.currentRole);
  const to = normalizeRole(p.newRole);
  if (from === "admin" && to !== "admin" && p.adminCount <= 1) return "last_admin";
  return null;
};

// --- tests ---------------------------------------------------------------

test("normalizeRole: valid roles pass through, anything else becomes staff", () => {
  assert.equal(normalizeRole("admin"), "admin");
  assert.equal(normalizeRole(" Doctor "), "doctor");
  assert.equal(normalizeRole("STAFF"), "staff");
  for (const bad of ["", "owner", "root", null, undefined, 3, {}]) {
    assert.equal(normalizeRole(bad), "staff", `role=${String(bad)}`);
  }
});

test("isValidRole is strict about the three known roles", () => {
  assert.equal(isValidRole("admin"), true);
  assert.equal(isValidRole("reception"), false);
  assert.equal(isValidRole(undefined), false);
});

test("normalizeEmail lowercases + trims; isValidEmail checks shape", () => {
  assert.equal(normalizeEmail("  Dr@Clinic.COM "), "dr@clinic.com");
  assert.equal(isValidEmail("dr@clinic.com"), true);
  for (const bad of ["nope", "a@b", "a b@c.com", "@c.com", "a@.com"]) {
    assert.equal(isValidEmail(bad), false, `email=${bad}`);
  }
});

test("normalizeUsername: blank becomes null; isValidUsername enforces charset/length", () => {
  assert.equal(normalizeUsername("  "), null);
  assert.equal(normalizeUsername("Reception_1"), "reception_1");
  assert.equal(normalizeUsername(42), null);
  assert.equal(isValidUsername(null), true); // no username is allowed
  assert.equal(isValidUsername("recep"), true);
  assert.equal(isValidUsername("ab"), false); // too short
  assert.equal(isValidUsername("has space"), false);
  assert.equal(isValidUsername("a".repeat(33)), false); // too long
});

test("password policy enforces the length window", () => {
  assert.equal(isValidPassword("1234567"), false); // 7 < 8
  assert.equal(isValidPassword("12345678"), true);
  assert.equal(isValidPassword("x".repeat(MAX_PASSWORD_LEN)), true);
  assert.equal(isValidPassword("x".repeat(MAX_PASSWORD_LEN + 1)), false);
  assert.equal(isValidPassword(123456789), false); // not a string
});

test("deleteUserBlock: cannot delete self", () => {
  assert.equal(
    deleteUserBlock({ actorId: "u1", targetId: "u1", targetRole: "staff", adminCount: 3 }),
    "cannot_delete_self",
  );
});

test("deleteUserBlock: cannot delete the final admin, but can delete a non-last admin", () => {
  assert.equal(deleteUserBlock({ actorId: "u1", targetId: "u2", targetRole: "admin", adminCount: 1 }), "last_admin");
  assert.equal(deleteUserBlock({ actorId: "u1", targetId: "u2", targetRole: "admin", adminCount: 2 }), null);
  assert.equal(deleteUserBlock({ actorId: "u1", targetId: "u2", targetRole: "staff", adminCount: 1 }), null);
});

test("changeRoleBlock: demoting the only admin is blocked; other changes allowed", () => {
  assert.equal(changeRoleBlock({ currentRole: "admin", newRole: "staff", adminCount: 1 }), "last_admin");
  assert.equal(changeRoleBlock({ currentRole: "admin", newRole: "doctor", adminCount: 1 }), "last_admin");
  assert.equal(changeRoleBlock({ currentRole: "admin", newRole: "admin", adminCount: 1 }), null); // still admin
  assert.equal(changeRoleBlock({ currentRole: "admin", newRole: "staff", adminCount: 2 }), null); // another admin exists
  assert.equal(changeRoleBlock({ currentRole: "staff", newRole: "admin", adminCount: 1 }), null); // promotion
});
