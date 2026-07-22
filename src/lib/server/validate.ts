import { NextResponse } from "next/server";
import { z } from "zod";
import { errorJson } from "./http";

/**
 * Centralised request-body validation built on zod.
 *
 * Every write route hand-parsed `req.json()` and hand-checked fields, which was
 * inconsistent and let malformed input reach Prisma (500s / bad rows). `parseJson`
 * gives one path: unparseable body -> 400 `bad_json`; schema violation -> 400
 * `validation_failed` with field-level `details`; success -> typed `data`.
 *
 * Backward compatible: valid requests behave exactly as before; only previously
 * un-rejected bad input now gets a clean 400 instead of a 500.
 */

/** Compact, client-safe representation of a validation issue. */
export type FieldIssue = { path: string; message: string };

function formatIssues(err: z.ZodError): FieldIssue[] {
  return err.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message }));
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/**
 * Read and validate a JSON request body against `schema`.
 * Returns a discriminated result so callers do: `if (!r.ok) return r.response;`
 */
export async function parseJson<T>(req: Request, schema: z.ZodType<T>): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, response: errorJson("bad_json", 400) };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const details = formatIssues(result.error);
    const message = details[0]?.message ?? "Invalid input";
    return { ok: false, response: errorJson("validation_failed", 400, { message, details }) };
  }
  return { ok: true, data: result.data };
}

// ---------------------------------------------------------------------------
// Reusable field schemas. Money/percent rules mirror the DB CHECK constraints
// (NUMERIC(12,2) >= 0, percentages 0–100) so the API and database agree.
// `coerce` preserves the previous behaviour of accepting numeric strings.
// ---------------------------------------------------------------------------

/** Monetary amount: >= 0, within NUMERIC(12,2). Accepts number or numeric string. */
export const zMoney = z.coerce.number().min(0, "must be >= 0").max(9_999_999_999.99, "amount too large");

/** Percentage: 0–100. Accepts number or numeric string. */
export const zPct = z.coerce.number().min(0, "must be >= 0").max(100, "must be <= 100");

/** Non-empty trimmed string. */
export const zNonEmpty = z.string().trim().min(1, "required");

/**
 * Coerce JSON scalars to string the way `String(x)` did in the hand-rolled
 * routes (numbers/booleans → string), but reject objects/arrays. `null`/
 * `undefined` become `undefined` so `.optional()` short-circuits and required
 * variants report "required" — matching the previous `*_required` 400s.
 */
const toStr = (v: unknown): unknown =>
  v == null ? undefined : typeof v === "number" || typeof v === "boolean" ? String(v) : v;

/** Required free text: trims, rejects empty. Accepts number/boolean (coerced). */
export const zReqText = z.preprocess(toStr, z.string().trim().min(1, "required"));

/** Optional free text: trims. Absent/null → undefined (handler keeps its default). */
export const zOptText = z.preprocess(toStr, z.string().trim().optional());

/** Optional ISO date string that, if present, must parse to a real date. */
export const zDateString = z
  .string()
  .refine((s) => !Number.isNaN(new Date(s).getTime()), "invalid date")
  .nullish();

/** Required date string that must parse (mirrors routes that 400 on bad dates). */
export const zRequiredDateString = z
  .string()
  .refine((s) => !Number.isNaN(new Date(s).getTime()), "invalid date");

/** Optional monetary amount that preserves null/undefined (e.g. optional cost). */
export const zMoneyOptional = zMoney.nullish();

export { z };
