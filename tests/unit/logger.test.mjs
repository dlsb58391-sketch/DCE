import { test } from "node:test";
import assert from "node:assert/strict";

// Mirror of src/lib/server/logger.ts (redact + describeError) for .mjs unit
// testing — same convention as the other unit files.

const SENSITIVE_KEYS = new Set([
  "password", "pass", "pwd", "currentpassword", "newpassword",
  "token", "accesstoken", "refreshtoken", "idtoken", "sessiontoken", "jwt",
  "secret", "clientsecret", "apikey", "authorization", "auth",
  "cookie", "setcookie", "otp", "pin", "cvv", "ssn", "creditcard", "cardnumber",
  "authsecret", "waagentsecret", "databaseurl", "connectionstring",
]);
const REDACTED = "[redacted]";
const MAX_STRING = 2000;
const MAX_DEPTH = 5;
const MAX_ARRAY = 50;

const normalizeKey = (k) => k.toLowerCase().replace(/[_-]/g, "");

function scrub(value, depth) {
  if (value == null) return value;
  const t = typeof value;
  if (t === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[truncated]` : value;
  if (t === "number" || t === "boolean") return value;
  if (t === "bigint") return value.toString();
  if (depth >= MAX_DEPTH) return "[depth-limit]";
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((v) => scrub(v, depth + 1));
  if (t === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEYS.has(normalizeKey(k)) ? REDACTED : scrub(v, depth + 1);
    }
    return out;
  }
  return String(value);
}
const redact = (fields) => scrub(fields, 0);

function describeError(err) {
  if (err instanceof Error) {
    const name = err.name || "Error";
    const code = err.code;
    const codeStr = typeof code === "string" ? code : undefined;
    const isDb = name.startsWith("PrismaClient") || (codeStr != null && /^P\d{4}$/.test(codeStr));
    return {
      errName: name,
      errMessage: err.message,
      errStack: err.stack,
      ...(isDb ? { dbError: true, dbCode: codeStr } : {}),
    };
  }
  return { errName: "NonError", errMessage: typeof err === "string" ? err : undefined };
}

test("redact replaces sensitive keys across casings/separators", () => {
  const out = redact({ password: "x", api_key: "y", "Refresh-Token": "z", note: "ok" });
  assert.equal(out.password, REDACTED);
  assert.equal(out.api_key, REDACTED);
  assert.equal(out["Refresh-Token"], REDACTED);
  assert.equal(out.note, "ok");
});

test("redact scrubs nested objects and arrays", () => {
  const out = redact({ user: { secret: "s", name: "Sam" }, list: [{ token: "t" }] });
  assert.equal(out.user.secret, REDACTED);
  assert.equal(out.user.name, "Sam");
  assert.equal(out.list[0].token, REDACTED);
});

test("redact truncates very long strings", () => {
  const out = redact({ blob: "a".repeat(5000) });
  assert.ok(out.blob.endsWith("…[truncated]"));
  assert.ok(out.blob.length < 5000);
});

test("redact enforces a depth limit", () => {
  const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
  const out = redact(deep);
  assert.equal(out.a.b.c.d.e, "[depth-limit]");
});

test("describeError extracts name/message/stack for Error", () => {
  const info = describeError(new TypeError("boom"));
  assert.equal(info.errName, "TypeError");
  assert.equal(info.errMessage, "boom");
  assert.ok(typeof info.errStack === "string");
  assert.equal(info.dbError, undefined);
});

test("describeError flags Prisma error code as DB error", () => {
  const e = new Error("unique");
  e.code = "P2002";
  const info = describeError(e);
  assert.equal(info.dbError, true);
  assert.equal(info.dbCode, "P2002");
});

test("describeError flags PrismaClient* error names as DB error", () => {
  const e = new Error("bad");
  e.name = "PrismaClientValidationError";
  const info = describeError(e);
  assert.equal(info.dbError, true);
});

test("describeError handles non-Error throwables", () => {
  const info = describeError("just a string");
  assert.equal(info.errName, "NonError");
  assert.equal(info.errMessage, "just a string");
});
