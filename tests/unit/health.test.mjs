import { test } from "node:test";
import assert from "node:assert/strict";

// Mirror of src/lib/server/health.ts (buildHealthPayload + version/commit
// derivation) for .mjs unit testing — same convention as the other unit files.

function appVersion(env) {
  return env.APP_VERSION || env.npm_package_version || "unknown";
}
function appCommit(env) {
  const sha = env.GIT_COMMIT || env.RAILWAY_GIT_COMMIT_SHA || env.SOURCE_COMMIT || env.VERCEL_GIT_COMMIT_SHA || "";
  return sha ? sha.slice(0, 12) : "unknown";
}
function buildHealthPayload(input) {
  const env = input.env ?? {};
  const payload = {
    status: input.db === "up" ? "ok" : "error",
    db: input.db,
    uptimeSec: input.uptimeSec,
    latencyMs: input.latencyMs,
    version: appVersion(env),
    commit: appCommit(env),
    env: env.NODE_ENV || "development",
    time: input.time,
  };
  if (input.error) payload.error = input.error;
  return payload;
}

test("db up yields status ok and no error field", () => {
  const p = buildHealthPayload({ db: "up", latencyMs: 3, uptimeSec: 100, time: "T", env: {} });
  assert.equal(p.status, "ok");
  assert.equal(p.db, "up");
  assert.ok(!("error" in p));
});

test("db down yields status error and preserves the message", () => {
  const p = buildHealthPayload({ db: "down", latencyMs: 9, uptimeSec: 5, time: "T", error: "boom", env: {} });
  assert.equal(p.status, "error");
  assert.equal(p.db, "down");
  assert.equal(p.error, "boom");
});

test("backward-compatible fields are always present", () => {
  const p = buildHealthPayload({ db: "up", latencyMs: 1, uptimeSec: 2, time: "2020-01-01T00:00:00.000Z", env: {} });
  for (const k of ["status", "db", "uptimeSec", "latencyMs", "time"]) assert.ok(k in p, `missing ${k}`);
});

test("version prefers APP_VERSION then npm_package_version then unknown", () => {
  assert.equal(appVersion({ APP_VERSION: "1.2.3", npm_package_version: "9" }), "1.2.3");
  assert.equal(appVersion({ npm_package_version: "9.9" }), "9.9");
  assert.equal(appVersion({}), "unknown");
});

test("commit is shortened to 12 chars from any known source var", () => {
  const long = "abcdef0123456789abcdef";
  assert.equal(appCommit({ RAILWAY_GIT_COMMIT_SHA: long }), long.slice(0, 12));
  assert.equal(appCommit({ GIT_COMMIT: long }), long.slice(0, 12));
  assert.equal(appCommit({}), "unknown");
});

test("env falls back to development when NODE_ENV unset", () => {
  assert.equal(buildHealthPayload({ db: "up", latencyMs: 0, uptimeSec: 0, time: "T", env: {} }).env, "development");
  assert.equal(
    buildHealthPayload({ db: "up", latencyMs: 0, uptimeSec: 0, time: "T", env: { NODE_ENV: "production" } }).env,
    "production",
  );
});
