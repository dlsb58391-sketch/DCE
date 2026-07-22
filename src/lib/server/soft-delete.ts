/**
 * Soft-delete infrastructure.
 *
 * Sensitive records (patients, treatments, payments, doctors, commission splits,
 * payouts, expenses, files, catalog procedures) are never hard-deleted from the
 * normal app flow. Instead their `deletedAt` timestamp is set; a Prisma client
 * extension then hides them from every list/aggregate read so the UI and all
 * financial roll-ups behave exactly as if the row were gone — but the data
 * survives in the database, backups, and the Recycle Bin for recovery.
 *
 * Two mechanisms live here:
 *   1. Pure helpers (`scopeWhere`, `scopeArgs`, `shouldScope`, cascade map) —
 *      exhaustively unit-tested, DB-independent.
 *   2. `softDeleteExtension` — wires those helpers into Prisma so scoping is
 *      automatic and cannot be forgotten at a call site.
 *
 * Opt-out: a caller that explicitly sets `deletedAt` in its `where` (e.g. the
 * Recycle Bin listing with `deletedAt: { not: null }`) is left untouched.
 */
import { Prisma } from "@prisma/client";

/** Prisma model names (as the client extension reports them) that soft-delete. */
export const SOFT_DELETABLE_MODELS: ReadonlySet<string> = new Set([
  "Patient",
  "Procedure",
  "TreatmentRecord",
  "Payment",
  "PatientFile",
  "Doctor",
  "TreatmentDoctor",
  "DoctorPayout",
  "ClinicExpense",
  "Supplier",
  "InventoryItem",
  "PurchaseOrder",
  "Medication",
  "Prescription",
  "Branch",
]);

/**
 * Read operations that are auto-scoped to non-deleted rows. Deliberately excludes
 * `findUnique`/`findUniqueOrThrow` (Prisma forbids non-unique fields like
 * `deletedAt` in their `where`) and all write ops (`update`/`delete`/`*Many`) —
 * those stay explicit so soft-delete, restore, and permanent-delete can target
 * already-deleted rows without the filter fighting them.
 */
export const SCOPED_READ_OPS: ReadonlySet<string> = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

/** WHERE fragment: only live rows. Spread into an explicit query where needed. */
export const notDeleted = { deletedAt: null } as const;
/** WHERE fragment: only trashed rows (Recycle Bin). Opts out of auto-scoping. */
export const onlyDeleted = { deletedAt: { not: null } } as const;

export function isSoftDeletableModel(model: string | undefined | null): boolean {
  return !!model && SOFT_DELETABLE_MODELS.has(model);
}

/** True when a (model, operation) pair should be auto-scoped to live rows. Pure. */
export function shouldScope(model: string | undefined | null, operation: string): boolean {
  return isSoftDeletableModel(model) && SCOPED_READ_OPS.has(operation);
}

/**
 * Merge `deletedAt: null` into a where clause — unless the caller already
 * referenced `deletedAt` (explicit opt-out). Pure; never mutates the input.
 */
export function scopeWhere(where: unknown): Record<string, unknown> {
  if (where && typeof where === "object" && Object.prototype.hasOwnProperty.call(where, "deletedAt")) {
    return where as Record<string, unknown>;
  }
  const base = where && typeof where === "object" ? (where as Record<string, unknown>) : {};
  return { ...base, deletedAt: null };
}

/** Inject the live-rows scope into a read operation's args. Pure. */
export function scopeArgs(args: unknown): Record<string, unknown> {
  const a: Record<string, unknown> = args && typeof args === "object" ? { ...(args as Record<string, unknown>) } : {};
  a.where = scopeWhere(a.where);
  return a;
}

/**
 * Cascade map: soft-deleting a parent must also hide the child rows that today's
 * `ON DELETE CASCADE` would remove, so every financial roll-up (earnings,
 * revenue, doctor balances, patient balances) stays byte-for-byte identical to a
 * hard delete. Children are addressed by their Prisma delegate name + the foreign
 * key that points at the parent. All cascade rows share the parent's exact
 * `deletedAt` timestamp so a later restore can re-link precisely those rows.
 *
 * Not cascaded (matches current schema semantics):
 *   - Payment.treatmentRecordId is ON DELETE SET NULL, so payments SURVIVE a
 *     treatment delete (they become general account payments) — never cascaded.
 *   - TreatmentRecord.procedureId is ON DELETE SET NULL — deleting a catalog
 *     procedure never removes treatments.
 */
export type CascadeChildModel =
  | "treatmentRecord"
  | "payment"
  | "treatmentDoctor"
  | "doctorPayout"
  | "inventoryBatch"
  | "stockMovement"
  | "prescriptionItem";
export type CascadeChild = { model: CascadeChildModel; fk: string };

export const SOFT_DELETE_CASCADE: Readonly<Record<string, readonly CascadeChild[]>> = {
  Patient: [
    { model: "treatmentRecord", fk: "patientId" },
    { model: "payment", fk: "patientId" },
  ],
  TreatmentRecord: [{ model: "treatmentDoctor", fk: "treatmentRecordId" }],
  Doctor: [
    { model: "treatmentDoctor", fk: "doctorId" },
    { model: "doctorPayout", fk: "doctorId" },
  ],
};

/** Child soft-delete targets for a parent model (empty if it has none). Pure. */
export function cascadeChildrenFor(model: string): readonly CascadeChild[] {
  return SOFT_DELETE_CASCADE[model] ?? [];
}

/**
 * Prisma client extension: transparently scopes list/aggregate reads on
 * soft-deletable models to live rows. Applied once in src/lib/db.ts.
 */
export const softDeleteExtension = Prisma.defineExtension({
  name: "soft-delete-filter",
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        if (shouldScope(model, operation)) {
          return query(scopeArgs(args) as typeof args);
        }
        return query(args);
      },
    },
  },
});
