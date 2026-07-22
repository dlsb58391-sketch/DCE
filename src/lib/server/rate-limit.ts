/**
 * Lightweight in-memory rate limiter (fixed window).
 *
 * Suitable for a single-instance clinic deployment. For horizontally scaled
 * hosting, back this with a shared store (Redis) using the same interface.
 * The clock is injectable so the logic is deterministically unit-testable.
 */
export type RateLimitResult = { ok: boolean; remaining: number; retryAfterMs: number };

type Bucket = { count: number; resetAt: number };

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Record an attempt for `key` and report whether it is allowed. */
  check(key: string): RateLimitResult {
    const t = this.now();
    const bucket = this.buckets.get(key);

    if (!bucket || t >= bucket.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: t + this.windowMs });
      return { ok: true, remaining: this.limit - 1, retryAfterMs: 0 };
    }

    if (bucket.count >= this.limit) {
      return { ok: false, remaining: 0, retryAfterMs: bucket.resetAt - t };
    }

    bucket.count += 1;
    return { ok: true, remaining: this.limit - bucket.count, retryAfterMs: 0 };
  }

  /** Clear a key's counter (e.g. after a successful login). */
  reset(key: string): void {
    this.buckets.delete(key);
  }

  /** Drop expired buckets to bound memory. */
  sweep(): void {
    const t = this.now();
    for (const [key, bucket] of this.buckets) {
      if (t >= bucket.resetAt) this.buckets.delete(key);
    }
  }
}

/** Shared limiter for login attempts: 10 tries / 15 minutes per IP+identifier. */
export const loginRateLimiter = new RateLimiter(10, 15 * 60 * 1000);

/** Best-effort client IP from proxy headers (Railway / reverse proxies). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}
