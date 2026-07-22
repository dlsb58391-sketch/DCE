import { test } from "node:test";
import assert from "node:assert/strict";

// Mirror of src/lib/server/env.ts (checkEnv + typed accessors) for .mjs unit
// testing — same convention as the other unit files (pagination/logger/validation).

const MIN_SECRET_LEN = 32;
const has = (v) => typeof v === "string" && v.trim().length > 0;

function checkEnv(env, nodeEnv = env.NODE_ENV || "development") {
  const errors = [];
  const warnings = [];
  const isProd = nodeEnv === "production";

  if (!has(env.AUTH_SECRET)) {
    errors.push({ key: "AUTH_SECRET", message: "missing" });
  } else if (env.AUTH_SECRET.length < MIN_SECRET_LEN) {
    errors.push({ key: "AUTH_SECRET", message: "too short" });
  }
  if (!has(env.DATABASE_URL)) errors.push({ key: "DATABASE_URL", message: "missing" });

  const provider = env.WHATSAPP_PROVIDER || "mock";
  if (provider === "metaCloud") {
    if (!has(env.WHATSAPP_APP_SECRET)) errors.push({ key: "WHATSAPP_APP_SECRET", message: "required" });
    if (!has(env.WHATSAPP_TOKEN)) errors.push({ key: "WHATSAPP_TOKEN", message: "required" });
    if (!has(env.WHATSAPP_PHONE_ID)) errors.push({ key: "WHATSAPP_PHONE_ID", message: "required" });
    if (!has(env.WHATSAPP_VERIFY_TOKEN)) warnings.push({ key: "WHATSAPP_VERIFY_TOKEN", message: "unset" });
  }

  if (!has(env.WA_AGENT_SECRET)) warnings.push({ key: "WA_AGENT_SECRET", message: "unset" });
  if (!has(env.CRON_SECRET)) warnings.push({ key: "CRON_SECRET", message: "unset" });
  if (isProd && provider !== "mock" && env.WA_SIMULATE_ENABLED === "1") {
    warnings.push({ key: "WA_SIMULATE_ENABLED", message: "enabled in production" });
  }
  if (!has(env.TZ)) warnings.push({ key: "TZ", message: "unset" });

  for (const key of ["REMINDER_LEAD_MIN", "QUEUE_LEAD_MIN"]) {
    const raw = env[key];
    if (has(raw)) {
      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        warnings.push({ key, message: "not a non-negative integer" });
      }
    }
  }
  return { errors, warnings };
}

const keys = (issues) => issues.map((i) => i.key);

// A fully-valid production environment (baseline for the happy path).
const validProd = {
  NODE_ENV: "production",
  AUTH_SECRET: "x".repeat(48),
  DATABASE_URL: "postgresql://u:p@localhost:5432/db",
  WHATSAPP_PROVIDER: "mock",
  WA_AGENT_SECRET: "worker-secret",
  CRON_SECRET: "cron-secret",
  TZ: "Africa/Cairo",
};

test("valid production env produces no errors and no warnings", () => {
  const r = checkEnv(validProd);
  assert.equal(r.errors.length, 0);
  assert.equal(r.warnings.length, 0);
});

test("missing AUTH_SECRET is an error", () => {
  const r = checkEnv({ ...validProd, AUTH_SECRET: undefined });
  assert.ok(keys(r.errors).includes("AUTH_SECRET"));
});

test("short AUTH_SECRET is an error", () => {
  const r = checkEnv({ ...validProd, AUTH_SECRET: "short" });
  assert.ok(keys(r.errors).includes("AUTH_SECRET"));
});

test("exactly 32-char AUTH_SECRET is accepted", () => {
  const r = checkEnv({ ...validProd, AUTH_SECRET: "y".repeat(32) });
  assert.ok(!keys(r.errors).includes("AUTH_SECRET"));
});

test("missing DATABASE_URL is an error", () => {
  const r = checkEnv({ ...validProd, DATABASE_URL: undefined });
  assert.ok(keys(r.errors).includes("DATABASE_URL"));
});

test("metaCloud provider without secrets yields multiple errors", () => {
  const r = checkEnv({ ...validProd, WHATSAPP_PROVIDER: "metaCloud" });
  const k = keys(r.errors);
  assert.ok(k.includes("WHATSAPP_APP_SECRET"));
  assert.ok(k.includes("WHATSAPP_TOKEN"));
  assert.ok(k.includes("WHATSAPP_PHONE_ID"));
  assert.ok(keys(r.warnings).includes("WHATSAPP_VERIFY_TOKEN"));
});

test("metaCloud fully configured produces no whatsapp errors", () => {
  const r = checkEnv({
    ...validProd,
    WHATSAPP_PROVIDER: "metaCloud",
    WHATSAPP_APP_SECRET: "app",
    WHATSAPP_TOKEN: "tok",
    WHATSAPP_PHONE_ID: "pid",
    WHATSAPP_VERIFY_TOKEN: "vt",
  });
  assert.equal(r.errors.length, 0);
});

test("missing worker/cron secrets are warnings, not errors", () => {
  const r = checkEnv({ ...validProd, WA_AGENT_SECRET: undefined, CRON_SECRET: undefined });
  assert.equal(r.errors.length, 0);
  const w = keys(r.warnings);
  assert.ok(w.includes("WA_AGENT_SECRET"));
  assert.ok(w.includes("CRON_SECRET"));
});

test("simulate enabled in production with live provider warns", () => {
  const r = checkEnv({
    ...validProd,
    WHATSAPP_PROVIDER: "metaCloud",
    WHATSAPP_APP_SECRET: "a",
    WHATSAPP_TOKEN: "t",
    WHATSAPP_PHONE_ID: "p",
    WHATSAPP_VERIFY_TOKEN: "v",
    WA_SIMULATE_ENABLED: "1",
  });
  assert.ok(keys(r.warnings).includes("WA_SIMULATE_ENABLED"));
});

test("simulate enabled in development does not warn", () => {
  const r = checkEnv({ ...validProd, NODE_ENV: "development", WA_SIMULATE_ENABLED: "1" });
  assert.ok(!keys(r.warnings).includes("WA_SIMULATE_ENABLED"));
});

test("invalid scheduler lead time is a warning", () => {
  const r = checkEnv({ ...validProd, REMINDER_LEAD_MIN: "abc", QUEUE_LEAD_MIN: "-5" });
  const w = keys(r.warnings);
  assert.ok(w.includes("REMINDER_LEAD_MIN"));
  assert.ok(w.includes("QUEUE_LEAD_MIN"));
});

test("valid scheduler lead time does not warn", () => {
  const r = checkEnv({ ...validProd, REMINDER_LEAD_MIN: "120", QUEUE_LEAD_MIN: "60" });
  const w = keys(r.warnings);
  assert.ok(!w.includes("REMINDER_LEAD_MIN"));
  assert.ok(!w.includes("QUEUE_LEAD_MIN"));
});

test("unset TZ warns (host default not pinned yet)", () => {
  const r = checkEnv({ ...validProd, TZ: undefined });
  assert.ok(keys(r.warnings).includes("TZ"));
});

// --- typed accessors ---

function intEnv(key, fallback, env) {
  const raw = env[key];
  if (!has(raw)) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && Number.isInteger(n) ? n : fallback;
}
function boolEnv(key, fallback, env) {
  const raw = env[key];
  if (!has(raw)) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

test("intEnv parses integers and falls back on garbage", () => {
  assert.equal(intEnv("N", 7, { N: "42" }), 42);
  assert.equal(intEnv("N", 7, { N: "4.5" }), 7);
  assert.equal(intEnv("N", 7, {}), 7);
});

test("boolEnv recognizes truthy tokens case-insensitively", () => {
  assert.equal(boolEnv("F", false, { F: "TRUE" }), true);
  assert.equal(boolEnv("F", false, { F: "on" }), true);
  assert.equal(boolEnv("F", true, { F: "0" }), false);
  assert.equal(boolEnv("F", true, {}), true);
});
