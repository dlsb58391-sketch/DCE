import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Mirrors secretKey() validation in src/lib/server/jwt.ts. Re-implemented per the
 * tests/unit/stage.test.mjs convention (this repo runs unit tests with plain
 * `node --test` and has no TypeScript loader). Keep in sync with the source.
 */
const KNOWN_WEAK = new Set([
  "change-me",
  "changeme",
  "secret",
  "password",
  "test",
  "your-secret",
  "mysecret",
  "jwt-secret",
  "auth-secret",
  "12345678901234567890123456789012",
]);

function validateSecret(s) {
  if (!s || s.length === 0) throw new Error("[AUTH_SECRET] Not set");
  if (s.length < 32) throw new Error("[AUTH_SECRET] Too short");
  if (KNOWN_WEAK.has(s.toLowerCase())) throw new Error("[AUTH_SECRET] placeholder");
  return true;
}

test("missing secret throws", () => {
  assert.throws(() => validateSecret(undefined), /Not set/);
  assert.throws(() => validateSecret(""), /Not set/);
});

test("short secret throws", () => {
  assert.throws(() => validateSecret("abcdef"), /Too short/);
  assert.throws(() => validateSecret("x".repeat(31)), /Too short/);
});

test("known placeholder is rejected", () => {
  // "change-me" is also < 32 chars, so it trips the length check first.
  assert.throws(() => validateSecret("change-me"), /Too short|placeholder/);
  // 32-char known-weak string passes length but must trip the placeholder check.
  assert.throws(() => validateSecret("12345678901234567890123456789012"), /placeholder/);
});

test("strong random secret passes", () => {
  assert.equal(validateSecret("k".repeat(48)), true);
  assert.equal(validateSecret("aB3xY7mK9pQr-strong-random-secret-value-1234567890"), true);
});
