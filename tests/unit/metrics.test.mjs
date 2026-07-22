import { test } from "node:test";
import assert from "node:assert/strict";

// Mirror of src/lib/server/metrics.ts (quantile + collector) for .mjs unit
// testing — same convention as the other unit files.

const MAX_SAMPLES_PER_ROUTE = 500;
const MAX_ROUTES = 300;
const MAX_SNAPSHOT_ROUTES = 100;

function quantile(values, q) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const clampedQ = Math.min(1, Math.max(0, q));
  const rank = Math.ceil(clampedQ * sorted.length);
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[idx];
}

function statusClass(status) {
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 300 && status < 400) return "3xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500 && status < 600) return "5xx";
  return null;
}

class MetricsCollector {
  constructor() {
    this.reset();
  }
  record(sample) {
    this.requests += 1;
    const cls = statusClass(sample.status);
    if (cls) this.byClass[cls] += 1;
    const key = `${sample.method} ${sample.route}`;
    let state = this.routes.get(key);
    if (!state) {
      if (this.routes.size >= MAX_ROUTES) {
        this.overflowDropped += 1;
        return;
      }
      state = { method: sample.method, route: sample.route, count: 0, errors: 0, maxMs: 0, samples: [], sampleCursor: 0 };
      this.routes.set(key, state);
    }
    state.count += 1;
    if (sample.status >= 500) state.errors += 1;
    if (sample.durationMs > state.maxMs) state.maxMs = sample.durationMs;
    if (state.samples.length < MAX_SAMPLES_PER_ROUTE) {
      state.samples.push(sample.durationMs);
    } else {
      state.samples[state.sampleCursor] = sample.durationMs;
      state.sampleCursor = (state.sampleCursor + 1) % MAX_SAMPLES_PER_ROUTE;
    }
  }
  snapshot() {
    const routes = [];
    for (const [key, s] of this.routes) {
      routes.push({
        key,
        method: s.method,
        route: s.route,
        count: s.count,
        errors: s.errors,
        p50: Math.round(quantile(s.samples, 0.5)),
        p95: Math.round(quantile(s.samples, 0.95)),
        p99: Math.round(quantile(s.samples, 0.99)),
        maxMs: Math.round(s.maxMs),
      });
    }
    routes.sort((a, b) => b.count - a.count);
    return {
      totals: { requests: this.requests, byClass: { ...this.byClass }, errors: this.byClass["5xx"] },
      routes: routes.slice(0, MAX_SNAPSHOT_ROUTES),
    };
  }
  reset() {
    this.requests = 0;
    this.byClass = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
    this.routes = new Map();
    this.overflowDropped = 0;
  }
}

test("quantile returns 0 for empty input", () => {
  assert.equal(quantile([], 0.5), 0);
});

test("quantile nearest-rank picks expected values", () => {
  const v = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(quantile(v, 0.5), 50);
  assert.equal(quantile(v, 0.95), 100);
  assert.equal(quantile(v, 0.9), 90);
});

test("quantile does not mutate the input array", () => {
  const v = [3, 1, 2];
  quantile(v, 0.5);
  assert.deepEqual(v, [3, 1, 2]);
});

test("quantile clamps out-of-range q", () => {
  const v = [1, 2, 3];
  assert.equal(quantile(v, -1), 1);
  assert.equal(quantile(v, 5), 3);
});

test("collector counts by status class and totals", () => {
  const m = new MetricsCollector();
  m.record({ method: "GET", route: "/a", status: 200, durationMs: 5 });
  m.record({ method: "GET", route: "/a", status: 204, durationMs: 7 });
  m.record({ method: "GET", route: "/a", status: 302, durationMs: 3 });
  m.record({ method: "POST", route: "/b", status: 400, durationMs: 2 });
  m.record({ method: "POST", route: "/b", status: 500, durationMs: 9 });
  const s = m.snapshot();
  assert.equal(s.totals.requests, 5);
  assert.equal(s.totals.byClass["2xx"], 2);
  assert.equal(s.totals.byClass["3xx"], 1);
  assert.equal(s.totals.byClass["4xx"], 1);
  assert.equal(s.totals.byClass["5xx"], 1);
  assert.equal(s.totals.errors, 1);
});

test("collector tracks per-route errors and maxMs", () => {
  const m = new MetricsCollector();
  m.record({ method: "POST", route: "/b", status: 500, durationMs: 40 });
  m.record({ method: "POST", route: "/b", status: 200, durationMs: 12 });
  const route = m.snapshot().routes.find((r) => r.key === "POST /b");
  assert.equal(route.count, 2);
  assert.equal(route.errors, 1);
  assert.equal(route.maxMs, 40);
});

test("snapshot sorts routes by count desc", () => {
  const m = new MetricsCollector();
  for (let i = 0; i < 3; i++) m.record({ method: "GET", route: "/hot", status: 200, durationMs: 1 });
  m.record({ method: "GET", route: "/cold", status: 200, durationMs: 1 });
  const routes = m.snapshot().routes;
  assert.equal(routes[0].route, "/hot");
  assert.equal(routes[1].route, "/cold");
});

test("ring buffer bounds memory at MAX_SAMPLES_PER_ROUTE", () => {
  const m = new MetricsCollector();
  for (let i = 0; i < MAX_SAMPLES_PER_ROUTE + 250; i++) {
    m.record({ method: "GET", route: "/x", status: 200, durationMs: i });
  }
  const state = m.routes.get("GET /x");
  assert.equal(state.samples.length, MAX_SAMPLES_PER_ROUTE);
  assert.equal(state.count, MAX_SAMPLES_PER_ROUTE + 250);
});

test("route cardinality is capped to bound memory", () => {
  const m = new MetricsCollector();
  for (let i = 0; i < MAX_ROUTES + 20; i++) {
    m.record({ method: "GET", route: `/r${i}`, status: 200, durationMs: 1 });
  }
  assert.equal(m.routes.size, MAX_ROUTES);
  assert.equal(m.overflowDropped, 20);
});
