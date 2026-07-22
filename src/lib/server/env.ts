/**
 * Centralized environment configuration and validation.
 *
 * Two responsibilities:
 *  1. `checkEnv` — a pure, dependency-free validator that inspects a plain
 *     environment record and returns every problem it finds (errors that will
 *     break core functionality, plus softer warnings). It is pure so it can be
 *     unit-tested deterministically without touching `process.env`.
 *  2. Thin typed accessors (`requireEnv`, `optionalEnv`, `intEnv`, `boolEnv`)
 *     used by boot code. Existing inline `process.env.X` reads elsewhere keep
 *     working unchanged — this module is additive, not a refactor.
 *
 * Non-destructive: validation only reports; it never throws at boot so a
 * misconfigured-but-runnable process still starts and logs loudly.
 */

export type EnvIssue = { key: string; message: string };
export type EnvReport = { errors: EnvIssue[]; warnings: EnvIssue[] };

export type EnvRecord = Record<string, string | undefined>;

const MIN_SECRET_LEN = 32;

function has(v: string | undefined): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/**
 * Validate an environment record. Pure: pass any record (e.g. `process.env`),
 * get back the full list of problems. `nodeEnv` gates production-only checks.
 */
export function checkEnv(env: EnvRecord, nodeEnv: string = env.NODE_ENV || "development"): EnvReport {
  const errors: EnvIssue[] = [];
  const warnings: EnvIssue[] = [];
  const isProd = nodeEnv === "production";

  // --- Always-critical: auth signing key ---
  if (!has(env.AUTH_SECRET)) {
    errors.push({ key: "AUTH_SECRET", message: "missing — sessions cannot be signed or verified" });
  } else if (env.AUTH_SECRET!.length < MIN_SECRET_LEN) {
    errors.push({
      key: "AUTH_SECRET",
      message: `too short (${env.AUTH_SECRET!.length} < ${MIN_SECRET_LEN}) — generate 48 random bytes (base64url)`,
    });
  }

  // --- Database connection (Prisma) ---
  if (!has(env.DATABASE_URL)) {
    errors.push({ key: "DATABASE_URL", message: "missing — the database client cannot connect" });
  }

  // --- WhatsApp provider wiring (only when the Meta Cloud path is selected) ---
  const provider = env.WHATSAPP_PROVIDER || "mock";
  if (provider === "metaCloud") {
    if (!has(env.WHATSAPP_APP_SECRET)) {
      errors.push({
        key: "WHATSAPP_APP_SECRET",
        message: "required for provider=metaCloud — inbound webhooks are rejected without it",
      });
    }
    if (!has(env.WHATSAPP_TOKEN)) {
      errors.push({ key: "WHATSAPP_TOKEN", message: "required for provider=metaCloud — outbound sends will fail" });
    }
    if (!has(env.WHATSAPP_PHONE_ID)) {
      errors.push({ key: "WHATSAPP_PHONE_ID", message: "required for provider=metaCloud — outbound sends will fail" });
    }
    if (!has(env.WHATSAPP_VERIFY_TOKEN)) {
      warnings.push({
        key: "WHATSAPP_VERIFY_TOKEN",
        message: "unset — Meta webhook subscription (GET verification) will fail",
      });
    }
  }

  // --- Soft warnings: degraded/less-secure but still runnable ---
  if (!has(env.WA_AGENT_SECRET)) {
    warnings.push({
      key: "WA_AGENT_SECRET",
      message: "unset — WhatsApp worker endpoints (agent/outbox/status) will reject all calls",
    });
  }
  if (!has(env.CRON_SECRET)) {
    warnings.push({
      key: "CRON_SECRET",
      message: "unset — external cron cannot trigger /api/admin/tick (signed-in refresh still works)",
    });
  }
  if (isProd && provider !== "mock" && env.WA_SIMULATE_ENABLED === "1") {
    warnings.push({
      key: "WA_SIMULATE_ENABLED",
      message: "enabled in production with a live provider — the inbound simulate endpoint injects unsigned messages",
    });
  }
  if (!has(env.TZ)) {
    warnings.push({ key: "TZ", message: "unset — process timezone will default to Africa/Cairo" });
  }

  // --- Numeric sanity for scheduler lead times ---
  for (const key of ["REMINDER_LEAD_MIN", "QUEUE_LEAD_MIN"] as const) {
    const raw = env[key];
    if (has(raw)) {
      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
        warnings.push({ key, message: `not a non-negative integer ("${raw}") — the built-in default will be used` });
      }
    }
  }

  return { errors, warnings };
}

/** Human-readable one-line summary of a report (for logs/tests). */
export function formatEnvReport(report: EnvReport): string {
  const parts: string[] = [];
  for (const e of report.errors) parts.push(`ERROR ${e.key}: ${e.message}`);
  for (const w of report.warnings) parts.push(`WARN ${w.key}: ${w.message}`);
  return parts.length ? parts.join("; ") : "environment OK";
}

/**
 * Validate `process.env` and emit a structured log line per issue.
 * Returns the report so callers/tests can inspect it. Never throws.
 */
export async function validateEnvAndLog(env: EnvRecord = process.env): Promise<EnvReport> {
  const report = checkEnv(env);
  // Lazy import keeps this module usable in contexts where the logger's
  // console sinks are undesirable (e.g. pure unit tests call checkEnv directly).
  const { logger } = await import("./logger");
  for (const e of report.errors) {
    logger.error("startup_env_error", { key: e.key, detail: e.message });
  }
  for (const w of report.warnings) {
    logger.warn("startup_env_warning", { key: w.key, detail: w.message });
  }
  if (report.errors.length === 0 && report.warnings.length === 0) {
    logger.info("startup_env_ok", {});
  }
  return report;
}

// --- Typed accessors (additive; existing inline reads are untouched) ---

/** Read a required variable or throw. Use only where absence is unrecoverable. */
export function requireEnv(key: string, env: EnvRecord = process.env): string {
  const v = env[key];
  if (!has(v)) throw new Error(`Missing required environment variable: ${key}`);
  return v!;
}

/** Read an optional variable with a fallback default. */
export function optionalEnv(key: string, fallback = "", env: EnvRecord = process.env): string {
  const v = env[key];
  return has(v) ? v! : fallback;
}

/** Parse an integer variable, returning `fallback` when unset or invalid. */
export function intEnv(key: string, fallback: number, env: EnvRecord = process.env): number {
  const raw = env[key];
  if (!has(raw)) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && Number.isInteger(n) ? n : fallback;
}

/** Parse a boolean flag ("1"/"true"/"yes" → true), else `fallback`. */
export function boolEnv(key: string, fallback = false, env: EnvRecord = process.env): boolean {
  const raw = env[key];
  if (!has(raw)) return fallback;
  return ["1", "true", "yes", "on"].includes(raw!.toLowerCase());
}

export function isProduction(env: EnvRecord = process.env): boolean {
  return env.NODE_ENV === "production";
}
