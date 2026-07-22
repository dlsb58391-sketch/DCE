/**
 * In-process request metrics (counters + latency quantiles).
 *
 * Deliberately dependency-free and bounded: per-route latency is kept in a
 * fixed-size ring buffer and the number of tracked routes is capped, so memory
 * stays constant regardless of traffic. Suitable for a single-instance clinic
 * deployment; for horizontally scaled hosting, export these into a shared
 * collector (Prometheus/StatsD) using the same `record` inputs.
 *
 * The quantile helper is pure so it can be unit-tested deterministically.
 */

export type RequestSample = {
  method: string;
  route: string;
  status: number;
  durationMs: number;
};

export type RouteMetric = {
  key: string;
  method: string;
  route: string;
  count: number;
  errors: number; // status >= 500
  p50: number;
  p95: number;
  p99: number;
  maxMs: number;
};

export type MetricsSnapshot = {
  since: string;
  uptimeSec: number;
  totals: {
    requests: number;
    byClass: { "2xx": number; "3xx": number; "4xx": number; "5xx": number };
    errors: number;
  };
  routes: RouteMetric[];
};

const MAX_SAMPLES_PER_ROUTE = 500;
const MAX_ROUTES = 300;
const MAX_SNAPSHOT_ROUTES = 100;

/**
 * Nearest-rank percentile of a numeric array (pure). `q` in [0,1].
 * Returns 0 for an empty input. Does not mutate the argument.
 */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const clampedQ = Math.min(1, Math.max(0, q));
  const rank = Math.ceil(clampedQ * sorted.length);
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[idx]!;
}

type RouteState = {
  method: string;
  route: string;
  count: number;
  errors: number;
  maxMs: number;
  samples: number[];
  sampleCursor: number;
};

class MetricsCollector {
  private startedAt = Date.now();
  private requests = 0;
  private byClass = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
  private routes = new Map<string, RouteState>();
  private overflowDropped = 0;

  /** Record one completed request. Never throws. */
  record(sample: RequestSample): void {
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

    // Fixed-size ring buffer of recent durations.
    if (state.samples.length < MAX_SAMPLES_PER_ROUTE) {
      state.samples.push(sample.durationMs);
    } else {
      state.samples[state.sampleCursor] = sample.durationMs;
      state.sampleCursor = (state.sampleCursor + 1) % MAX_SAMPLES_PER_ROUTE;
    }
  }

  /** Serializable point-in-time view (top routes by request count). */
  snapshot(): MetricsSnapshot {
    const routes: RouteMetric[] = [];
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
      since: new Date(this.startedAt).toISOString(),
      uptimeSec: Math.round((Date.now() - this.startedAt) / 1000),
      totals: {
        requests: this.requests,
        byClass: { ...this.byClass },
        errors: this.byClass["5xx"],
      },
      routes: routes.slice(0, MAX_SNAPSHOT_ROUTES),
    };
  }

  /** Reset all counters (used by tests). */
  reset(): void {
    this.startedAt = Date.now();
    this.requests = 0;
    this.byClass = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
    this.routes.clear();
    this.overflowDropped = 0;
  }
}

function statusClass(status: number): "2xx" | "3xx" | "4xx" | "5xx" | null {
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 300 && status < 400) return "3xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500 && status < 600) return "5xx";
  return null;
}

/** Process-wide singleton collector. */
export const metrics = new MetricsCollector();
