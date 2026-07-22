import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Mirrors RateLimiter in src/lib/server/rate-limit.ts (fixed window), using an
 * injectable clock so the window/reset behavior is deterministic. Re-implemented
 * per the tests/unit convention (plain `node --test`, no TypeScript loader).
 */
class RateLimiter {
  constructor(limit, windowMs, now = () => Date.now()) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    this.buckets = new Map();
  }
  check(key) {
    const t = this.now();
    const b = this.buckets.get(key);
    if (!b || t >= b.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: t + this.windowMs });
      return { ok: true, remaining: this.limit - 1, retryAfterMs: 0 };
    }
    if (b.count >= this.limit) return { ok: false, remaining: 0, retryAfterMs: b.resetAt - t };
    b.count += 1;
    return { ok: true, remaining: this.limit - b.count, retryAfterMs: 0 };
  }
  reset(key) {
    this.buckets.delete(key);
  }
}

test("allows up to the limit then blocks", () => {
  const rl = new RateLimiter(3, 1000, () => 0);
  assert.equal(rl.check("k").ok, true);
  assert.equal(rl.check("k").ok, true);
  assert.equal(rl.check("k").ok, true);
  const blocked = rl.check("k");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.retryAfterMs, 1000);
});

test("window reset allows attempts again", () => {
  let t = 0;
  const rl = new RateLimiter(2, 1000, () => t);
  assert.equal(rl.check("k").ok, true);
  assert.equal(rl.check("k").ok, true);
  assert.equal(rl.check("k").ok, false);
  t = 1000; // window elapsed
  assert.equal(rl.check("k").ok, true);
});

test("reset() clears the counter (successful login)", () => {
  const rl = new RateLimiter(2, 1000, () => 0);
  rl.check("k");
  rl.check("k");
  assert.equal(rl.check("k").ok, false);
  rl.reset("k");
  assert.equal(rl.check("k").ok, true);
});

test("keys are isolated", () => {
  const rl = new RateLimiter(1, 1000, () => 0);
  assert.equal(rl.check("a").ok, true);
  assert.equal(rl.check("a").ok, false);
  assert.equal(rl.check("b").ok, true); // different key unaffected
});

test("remaining counts down correctly", () => {
  const rl = new RateLimiter(3, 1000, () => 0);
  assert.equal(rl.check("k").remaining, 2);
  assert.equal(rl.check("k").remaining, 1);
  assert.equal(rl.check("k").remaining, 0);
});
