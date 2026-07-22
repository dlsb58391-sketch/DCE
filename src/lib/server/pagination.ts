import { NextResponse } from "next/server";

/**
 * Opt-in, backward-compatible pagination for list endpoints.
 *
 * Design goals:
 *  - Zero behaviour change unless the caller passes `?limit` or `?offset`.
 *    When neither is present the returned `take`/`skip` are `undefined`, so an
 *    existing `findMany` runs exactly as before and no headers are emitted.
 *  - When applied, page metadata travels in RESPONSE HEADERS (never the body)
 *    so response shapes stay identical and the frontend keeps working:
 *      X-Total-Count, X-Limit, X-Offset, X-Has-More, X-Next-Offset
 *  - `limit` is clamped to [1, maxLimit] and `offset` to >= 0 to bound cost.
 */

const DEFAULT_MAX_LIMIT = 200;

export type Pagination = {
  /** True only when the caller supplied `?limit` and/or `?offset`. */
  applied: boolean;
  /** Effective page size (only meaningful when `applied`). */
  limit: number;
  /** Effective row offset (only meaningful when `applied`). */
  offset: number;
  /** Pass straight to Prisma `take` — `undefined` when not applied. */
  take: number | undefined;
  /** Pass straight to Prisma `skip` — `undefined` when not applied. */
  skip: number | undefined;
};

export type PaginationOptions = {
  /** Upper bound for `limit` (default 200). */
  maxLimit?: number;
  /** Page size used when only `?offset` is supplied (default = maxLimit). */
  defaultLimit?: number;
};

/**
 * Pure resolver (no Request dependency) so it is trivially unit-testable.
 * Mirrors the lenient coercion used elsewhere: non-numeric / out-of-range
 * values fall back to safe defaults rather than erroring.
 */
export function resolvePagination(
  rawLimit: string | null,
  rawOffset: string | null,
  opts: PaginationOptions = {}
): Pagination {
  const maxLimit = Math.max(1, Math.floor(opts.maxLimit ?? DEFAULT_MAX_LIMIT));
  const fallbackLimit = Math.min(maxLimit, Math.max(1, Math.floor(opts.defaultLimit ?? maxLimit)));

  const hasLimit = rawLimit != null && rawLimit.trim() !== "";
  const hasOffset = rawOffset != null && rawOffset.trim() !== "";

  if (!hasLimit && !hasOffset) {
    return { applied: false, limit: 0, offset: 0, take: undefined, skip: undefined };
  }

  let limit = hasLimit ? Math.floor(Number(rawLimit)) : fallbackLimit;
  if (!Number.isFinite(limit) || limit <= 0) limit = fallbackLimit;
  limit = Math.min(limit, maxLimit);

  let offset = hasOffset ? Math.floor(Number(rawOffset)) : 0;
  if (!Number.isFinite(offset) || offset < 0) offset = 0;

  return { applied: true, limit, offset, take: limit, skip: offset };
}

/** Extract pagination from a Request's query string. */
export function getPagination(req: Request, opts: PaginationOptions = {}): Pagination {
  const sp = new URL(req.url).searchParams;
  return resolvePagination(sp.get("limit"), sp.get("offset"), opts);
}

/** Build page-metadata headers. Empty object when pagination was not applied. */
export function paginationHeaders(total: number, p: Pagination): Record<string, string> {
  if (!p.applied) return {};
  const next = p.offset + p.limit;
  const hasMore = next < total;
  const headers: Record<string, string> = {
    "X-Total-Count": String(total),
    "X-Limit": String(p.limit),
    "X-Offset": String(p.offset),
    "X-Has-More": hasMore ? "true" : "false",
  };
  if (hasMore) headers["X-Next-Offset"] = String(next);
  return headers;
}

/**
 * Respond with JSON plus pagination headers. When `p.applied` is false this is
 * identical to `NextResponse.json(body)` (no extra headers), preserving the
 * exact legacy response.
 */
export function jsonWithPagination(body: unknown, total: number, p: Pagination) {
  return NextResponse.json(body, { headers: paginationHeaders(total, p) });
}
