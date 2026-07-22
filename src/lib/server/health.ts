/**
 * Health-probe payload construction (pure, dependency-free) so the shape can be
 * unit-tested without a live database or HTTP layer. The route handler supplies
 * the measured DB state and timings; this module assembles the JSON body and
 * derives build metadata from the environment.
 */

export type DbState = "up" | "down";
export type HealthStatus = "ok" | "error";

export type HealthPayload = {
  status: HealthStatus;
  db: DbState;
  uptimeSec: number;
  latencyMs: number;
  version: string;
  commit: string;
  env: string;
  time: string;
  error?: string;
};

export type HealthInput = {
  db: DbState;
  latencyMs: number;
  uptimeSec: number;
  time: string;
  env?: Record<string, string | undefined>;
  error?: string;
};

/** Build/release version, best-effort from common CI/host variables. */
export function appVersion(env: Record<string, string | undefined> = process.env): string {
  return env.APP_VERSION || env.npm_package_version || "unknown";
}

/** Short commit SHA, best-effort across Railway/Vercel/Docker conventions. */
export function appCommit(env: Record<string, string | undefined> = process.env): string {
  const sha =
    env.GIT_COMMIT || env.RAILWAY_GIT_COMMIT_SHA || env.SOURCE_COMMIT || env.VERCEL_GIT_COMMIT_SHA || "";
  return sha ? sha.slice(0, 12) : "unknown";
}

/** Assemble the health JSON body. Pure: no I/O, no clock, no process reads beyond env. */
export function buildHealthPayload(input: HealthInput): HealthPayload {
  const env = input.env ?? process.env;
  const payload: HealthPayload = {
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
