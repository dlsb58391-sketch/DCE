import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/server/jwt";
import { logger, describeError } from "@/lib/server/logger";
import { metrics } from "@/lib/server/metrics";

/**
 * Consistent JSON error envelope for API routes.
 *
 * The shape is `{ error: "<code>" }` — matching every existing route — optionally
 * enriched with a human `message` (the dashboard shows `j.message || j.error`)
 * and structured `details`. Keeping `error` as a stable machine code means the
 * frontend's existing error handling keeps working (backward compatible).
 */
export type ErrorExtra = { message?: string; details?: unknown; requestId?: string };

export function errorJson(code: string, status: number, extra?: ErrorExtra): NextResponse {
  return NextResponse.json({ error: code, ...extra }, { status });
}

/** 400 for an unparseable request body. */
export function badJson(): NextResponse {
  return errorJson("bad_json", 400);
}

/** Random id to correlate a client-visible error with the server log line. */
export function newRequestId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * API contract version, surfaced as the `x-api-version` response header on every
 * instrumented route. Bumped only on a breaking change to the API surface;
 * additive changes keep the same version (see docs/API-REFERENCE.md).
 */
export const API_VERSION = "1";

/**
 * Log an unexpected error server-side (structured, with stack + DB-error
 * detection) and return a generic 500 that never leaks a stack trace or
 * internal message to the client. The `requestId` ties the client response to
 * the server log for support.
 */
export function serverError(context: string, err: unknown, requestId: string = newRequestId()): NextResponse {
  logger.error("api_error", { context, requestId, ...describeError(err) });
  return errorJson("internal_error", 500, { requestId });
}

/**
 * Wrap an async route handler so any thrown error becomes a safe 500 instead of
 * Next's default (which can surface internals in dev). Opt-in per route.
 */
export function withErrorHandling<A extends unknown[]>(
  context: string,
  handler: (...args: A) => Promise<NextResponse>,
): (...args: A) => Promise<NextResponse> {
  return async (...args: A): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      return serverError(context, err);
    }
  };
}

function routeInfo(req: unknown): { method: string; route: string } {
  if (req instanceof Request) {
    try {
      return { method: req.method, route: new URL(req.url).pathname };
    } catch {
      return { method: req.method, route: "" };
    }
  }
  return { method: "", route: "" };
}

/** Best-effort user id from the session cookie, for log correlation only. */
async function userIdOf(req: unknown): Promise<string | undefined> {
  if (!(req instanceof Request)) return undefined;
  const cookie = req.headers.get("cookie");
  if (!cookie) return undefined;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return undefined;
  try {
    const session = await verifySessionToken(decodeURIComponent(match[1]));
    return session?.sub;
  } catch {
    return undefined;
  }
}

/** Emit one structured `api_request` line, choosing the level from the status. */
export function logRequest(fields: {
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  userId?: string;
}): void {
  const level = fields.status >= 500 ? "error" : fields.status >= 400 ? "warn" : "info";
  logger[level]("api_request", fields);
  metrics.record({
    method: fields.method,
    route: fields.route,
    status: fields.status,
    durationMs: fields.durationMs,
  });
}

/**
 * Wrap a route handler with structured request logging: assigns a request id
 * (also returned as the `x-request-id` response header), measures execution
 * time, resolves the user id from the session cookie, and logs a single
 * `api_request` line with method, route, status and duration. Uncaught errors
 * are logged (with stack) and converted to a safe 500 via `serverError`.
 *
 * Backward compatible: success responses are returned unchanged apart from the
 * extra `x-request-id` header; only previously-uncaught exceptions change (from
 * Next's default error to the standard `{ error: "internal_error" }` envelope).
 */
export function withRoute<A extends unknown[]>(
  context: string,
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A): Promise<Response> => {
    const requestId = newRequestId();
    const startedAt = Date.now();
    const { method, route } = routeInfo(args[0]);
    const userId = await userIdOf(args[0]);
    try {
      const res = await handler(...args);
      res.headers.set("x-request-id", requestId);
      res.headers.set("x-api-version", API_VERSION);
      logRequest({ requestId, method, route, status: res.status, durationMs: Date.now() - startedAt, userId });
      return res;
    } catch (err) {
      logRequest({ requestId, method, route, status: 500, durationMs: Date.now() - startedAt, userId });
      const res = serverError(context, err, requestId);
      res.headers.set("x-api-version", API_VERSION);
      return res;
    }
  };
}
