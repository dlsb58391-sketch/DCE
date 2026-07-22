/**
 * Production-grade structured logging.
 *
 * Emits one JSON object per line (JSON Lines) to the console, which every log
 * aggregator (Railway, Grafana Loki, Datadog, CloudWatch) can parse. Levels map
 * to the right stream so platform log levels are correct:
 *   info  -> console.info   (requests, lifecycle)
 *   warn  -> console.warn   (4xx, recoverable)
 *   error -> console.error  (5xx, thrown/DB errors, with stack)
 *
 * Sensitive data is never logged: every field object is deep-scrubbed for
 * credential-like keys (password, token, secret, cookie, authorization, otp,
 * card numbers, connection strings, ...) before serialization, and long strings
 * are truncated to keep log volume bounded.
 */

export type LogLevel = "info" | "warn" | "error";

// Compared case-insensitively with separators removed, so "api_key",
// "apiKey" and "API-KEY" all match "apikey".
const SENSITIVE_KEYS = new Set([
  "password",
  "pass",
  "pwd",
  "currentpassword",
  "newpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "sessiontoken",
  "jwt",
  "secret",
  "clientsecret",
  "apikey",
  "authorization",
  "auth",
  "cookie",
  "setcookie",
  "otp",
  "pin",
  "cvv",
  "ssn",
  "creditcard",
  "cardnumber",
  "authsecret",
  "waagentsecret",
  "databaseurl",
  "connectionstring",
]);

const REDACTED = "[redacted]";
const MAX_STRING = 2000;
const MAX_DEPTH = 5;
const MAX_ARRAY = 50;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, "");
}

function scrub(value: unknown, depth: number): unknown {
  if (value == null) return value;
  const t = typeof value;
  if (t === "string") {
    const s = value as string;
    return s.length > MAX_STRING ? `${s.slice(0, MAX_STRING)}…[truncated]` : s;
  }
  if (t === "number" || t === "boolean") return value;
  if (t === "bigint") return (value as bigint).toString();
  if (depth >= MAX_DEPTH) return "[depth-limit]";
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY).map((v) => scrub(v, depth + 1));
  }
  if (t === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(normalizeKey(k)) ? REDACTED : scrub(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

/** Deep-clone `fields`, replacing sensitive values with "[redacted]". */
export function redact(fields: Record<string, unknown>): Record<string, unknown> {
  return scrub(fields, 0) as Record<string, unknown>;
}

export type ErrorInfo = {
  errName: string;
  errMessage?: string;
  errStack?: string;
  dbError?: boolean;
  dbCode?: string;
};

/**
 * Extract safe, structured diagnostics from a thrown value. Recognises Prisma
 * errors (name prefix `PrismaClient*` or a `P####` code) and flags them as DB
 * errors with their code — without echoing query parameters or `meta` (which
 * can contain patient data).
 */
export function describeError(err: unknown): ErrorInfo {
  if (err instanceof Error) {
    const name = err.name || "Error";
    const code = (err as { code?: unknown }).code;
    const codeStr = typeof code === "string" ? code : undefined;
    const isDb = name.startsWith("PrismaClient") || (codeStr != null && /^P\d{4}$/.test(codeStr));
    return {
      errName: name,
      errMessage: err.message,
      errStack: err.stack,
      ...(isDb ? { dbError: true, dbCode: codeStr } : {}),
    };
  }
  return {
    errName: "NonError",
    errMessage: typeof err === "string" ? err : undefined,
  };
}

function emit(level: LogLevel, event: string, fields: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...redact(fields),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export const logger = {
  info: (event: string, fields: Record<string, unknown> = {}) => emit("info", event, fields),
  warn: (event: string, fields: Record<string, unknown> = {}) => emit("warn", event, fields),
  error: (event: string, fields: Record<string, unknown> = {}) => emit("error", event, fields),
};
