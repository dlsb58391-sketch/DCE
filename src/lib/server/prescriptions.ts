/**
 * Electronic Prescriptions domain — pure, database-free helpers.
 *
 * All prescription code/status/normalization logic lives here so it can be
 * exhaustively unit-tested without a database (see
 * tests/unit/prescriptions.test.mjs). The DB layer (prescriptions-ops.ts) and
 * the API routes call these functions at the boundary.
 *
 * Lifecycle:
 *   issued ──cancel──▶ cancelled     (cancelling is terminal; a cancelled
 *                                      prescription can still be viewed/printed)
 */

/** All prescription lifecycle statuses. */
export const RX_STATUSES = [
  "issued", // active prescription handed to the patient
  "cancelled", // voided by the clinic; retained for history/audit
] as const;

export type RxStatus = (typeof RX_STATUSES)[number];

export function isRxStatus(v: unknown): v is RxStatus {
  return typeof v === "string" && (RX_STATUSES as readonly string[]).includes(v);
}

/** A prescription can be cancelled only while it is still issued. */
export function canCancelRx(status: string): boolean {
  return status === "issued";
}

// ---------------------------------------------------------------------------
// Field normalization (defensive clamps applied before persisting)
// ---------------------------------------------------------------------------

/** Max repeats a single prescription line may authorize. */
export const MAX_REFILLS = 12;
/** Max course length (days) a single line may specify. */
export const MAX_DURATION_DAYS = 365;

/**
 * Clamp a refill count to a whole number in [0, MAX_REFILLS]. Non-finite or
 * negative input becomes 0; fractional input is floored.
 */
export function clampRefills(n: unknown): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.min(v, MAX_REFILLS);
}

/**
 * Clamp a duration (days) to a whole number in [1, MAX_DURATION_DAYS], or null
 * when omitted/invalid. Fractional input is floored.
 */
export function clampDurationDays(n: unknown): number | null {
  if (n === null || n === undefined || n === "") return null;
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v <= 0) return null;
  return Math.min(v, MAX_DURATION_DAYS);
}

// ---------------------------------------------------------------------------
// Human-readable prescription code: RX-YYYY-NNNN
// ---------------------------------------------------------------------------

/** Zero-padded sequence width in an RX code (RX-2026-0001). */
export const RX_SEQ_WIDTH = 4;

/**
 * Build a human prescription number `RX-<year>-<seq>` with the sequence
 * zero-padded to at least RX_SEQ_WIDTH digits (wider when the clinic issues more
 * than 9999 in a year). The service allocates `seq` per-year and retries on the
 * unique-code collision.
 */
export function buildRxCode(year: number, seq: number): string {
  const y = Math.trunc(Number(year));
  const s = Math.max(1, Math.trunc(Number(seq)) || 1);
  return `RX-${y}-${String(s).padStart(RX_SEQ_WIDTH, "0")}`;
}

// ---------------------------------------------------------------------------
// Drug-interaction hook (SAFE STUB — intentionally returns no warnings)
// ---------------------------------------------------------------------------

export type RxInteractionItem = {
  medicationId?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
};

export type RxInteractionWarning = {
  level: "info" | "warning" | "danger";
  message: string;
  a?: string;
  b?: string;
};

/**
 * Extension point for drug–drug interaction checking.
 *
 * This is a deliberate, side-effect-free stub that ALWAYS returns an empty list.
 * Cliniva does not ship a clinical interaction database and MUST NOT fabricate
 * medical advice, so no warnings are generated here. A future integration with a
 * vetted interaction dataset (e.g. an external drug-interaction API) can replace
 * this body; the surrounding service/UI already renders whatever warnings it
 * returns, so wiring a real provider requires no other code changes.
 */
export function checkInteractions(_items: ReadonlyArray<RxInteractionItem>): RxInteractionWarning[] {
  return [];
}
