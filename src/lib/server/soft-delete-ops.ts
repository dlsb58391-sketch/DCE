/**
 * Transactional soft-delete execution (the write side of the soft-delete system).
 *
 * `src/lib/server/soft-delete.ts` holds the pure scoping rules + the read
 * extension that hides trashed rows. This module performs the actual delete:
 * it stamps `deletedAt`/`deletedBy` on a record and, in the SAME transaction,
 * cascades that stamp to exactly the child rows today's `ON DELETE CASCADE`
 * would remove — so every financial roll-up stays identical to a hard delete
 * while the data survives for the Recycle Bin.
 *
 * It is kept separate from soft-delete.ts on purpose: this file imports the
 * Prisma client (`@/lib/db`), whereas soft-delete.ts must not (db.ts imports the
 * extension from it, so importing the client back would be circular).
 */
import { prisma } from "@/lib/db";
import {
  cascadeChildrenFor,
  isSoftDeletableModel,
  type CascadeChild,
  type CascadeChildModel,
} from "@/lib/server/soft-delete";
import { deleteStored } from "@/lib/server/storage";

/** Prisma delegate (camelCase) for each soft-deletable model (PascalCase). */
const DELEGATE_BY_MODEL: Readonly<Record<string, string>> = {
  Patient: "patient",
  Procedure: "procedure",
  TreatmentRecord: "treatmentRecord",
  Payment: "payment",
  PatientFile: "patientFile",
  Doctor: "doctor",
  TreatmentDoctor: "treatmentDoctor",
  DoctorPayout: "doctorPayout",
  ClinicExpense: "clinicExpense",
  Supplier: "supplier",
  InventoryItem: "inventoryItem",
  PurchaseOrder: "purchaseOrder",
  Medication: "medication",
  Prescription: "prescription",
  Branch: "branch",
};

/** Inverse map for recursing into a cascade child's own children. */
const MODEL_BY_DELEGATE: Readonly<Record<CascadeChildModel, string>> = {
  treatmentRecord: "TreatmentRecord",
  payment: "Payment",
  treatmentDoctor: "TreatmentDoctor",
  doctorPayout: "DoctorPayout",
  inventoryBatch: "InventoryBatch",
  stockMovement: "StockMovement",
  prescriptionItem: "PrescriptionItem",
};

type IdRow = { id: string };
type TrashedRow = { id: string; deletedAt?: Date | null };

/**
 * Minimal structural view of the Prisma delegate methods this module uses. The
 * interactive-transaction client indexes its delegates by dynamic string, which
 * Prisma's generated types can't express, so the tx is cast to this shape once.
 */
type DelegateOps = {
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<IdRow>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  findMany(args: { where: Record<string, unknown>; select: Record<string, true> }): Promise<TrashedRow[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  delete(args: { where: { id: string } }): Promise<IdRow>;
};
type DelegateMap = Record<string, DelegateOps>;

/**
 * Recursively stamp `deletedAt` on the cascade children of `parentModel` whose
 * FK points at `parentIds`. Only currently-live children are touched
 * (`deletedAt: null`), so a child already trashed on its own (e.g. a split
 * removed with its doctor) keeps its original timestamp and is NOT re-linked to
 * this parent's deletion.
 */
async function cascadeSoftDelete(
  tx: DelegateMap,
  parentModel: string,
  parentIds: string[],
  deletedBy: string | null,
  deletedAt: Date,
): Promise<void> {
  if (parentIds.length === 0) return;
  for (const child of cascadeChildrenFor(parentModel)) {
    const delegate = tx[child.model];
    const live = await delegate.findMany({
      where: { [child.fk]: { in: parentIds }, deletedAt: null },
      select: { id: true },
    });
    if (live.length === 0) continue;
    const ids = live.map((r) => r.id);
    await delegate.updateMany({ where: { id: { in: ids }, deletedAt: null }, data: { deletedAt, deletedBy } });
    await cascadeSoftDelete(tx, MODEL_BY_DELEGATE[child.model], ids, deletedBy, deletedAt);
  }
}

/**
 * Soft-delete one record and its cascade children inside a caller-provided
 * transaction. Use this when the route needs additional writes in the same
 * transaction; otherwise call {@link softDeleteEntity}.
 *
 * The parent uses `update` (not `updateMany`) so a missing id throws exactly as
 * the old `delete()` did. Children share the parent's single `deletedAt`, which
 * a later restore matches to re-link precisely this delete's rows.
 */
export async function softDeleteInTransaction(
  tx: unknown,
  model: string,
  id: string,
  deletedBy: string | null,
  deletedAt: Date,
): Promise<void> {
  if (!isSoftDeletableModel(model)) {
    throw new Error(`softDelete: model "${model}" is not soft-deletable`);
  }
  const map = tx as DelegateMap;
  await map[DELEGATE_BY_MODEL[model]].update({ where: { id }, data: { deletedAt, deletedBy } });
  await cascadeSoftDelete(map, model, [id], deletedBy, deletedAt);
}

/**
 * Soft-delete one record (+ cascade) in its own transaction. Convenience wrapper
 * around {@link softDeleteInTransaction} for the common single-record case.
 */
export async function softDeleteEntity(
  model: string,
  id: string,
  deletedBy: string | null,
  deletedAt: Date = new Date(),
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await softDeleteInTransaction(tx, model, id, deletedBy, deletedAt);
  });
}

// ---------------------------------------------------------------------------
// Restore (Recycle Bin -> live)
// ---------------------------------------------------------------------------

/**
 * Recursively clear `deletedAt` on the cascade children that were trashed
 * TOGETHER with this parent — i.e. those whose `deletedAt` equals the parent's
 * exact deletion timestamp. Children trashed independently (a different
 * timestamp, e.g. a split removed on its own earlier) keep their own state and
 * are deliberately NOT revived, mirroring how the delete cascade only ever
 * stamped currently-live children.
 */
async function cascadeRestore(
  tx: DelegateMap,
  parentModel: string,
  parentIds: string[],
  deletedAt: Date,
): Promise<void> {
  if (parentIds.length === 0) return;
  for (const child of cascadeChildrenFor(parentModel)) {
    const delegate = tx[child.model];
    const rows = await delegate.findMany({
      where: { [child.fk]: { in: parentIds }, deletedAt },
      select: { id: true },
    });
    if (rows.length === 0) continue;
    const ids = rows.map((r) => r.id);
    await delegate.updateMany({ where: { id: { in: ids } }, data: { deletedAt: null, deletedBy: null } });
    await cascadeRestore(tx, MODEL_BY_DELEGATE[child.model], ids, deletedAt);
  }
}

/**
 * Restore one trashed record and the children that were trashed with it, inside
 * a caller-provided transaction. Returns false (no-op) when the id is not
 * currently in the Recycle Bin, so the route can answer 404.
 */
export async function restoreInTransaction(tx: unknown, model: string, id: string): Promise<boolean> {
  if (!isSoftDeletableModel(model)) {
    throw new Error(`restore: model "${model}" is not soft-deletable`);
  }
  const map = tx as DelegateMap;
  const delegate = map[DELEGATE_BY_MODEL[model]];
  const found = await delegate.findMany({
    where: { id, deletedAt: { not: null } },
    select: { id: true, deletedAt: true },
  });
  const parent = found[0];
  if (!parent || !parent.deletedAt) return false;
  const deletedAt = parent.deletedAt;
  await delegate.updateMany({ where: { id: { in: [id] } }, data: { deletedAt: null, deletedBy: null } });
  await cascadeRestore(map, model, [id], deletedAt);
  return true;
}

/** Restore one record (+ its co-trashed children) in its own transaction. */
export async function restoreEntity(model: string, id: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => restoreInTransaction(tx, model, id));
}

// ---------------------------------------------------------------------------
// Permanent delete (purge) — hard delete a trashed record
// ---------------------------------------------------------------------------

/**
 * Relations that block a permanent delete unless an admin forces it. This is
 * intentionally BROADER than the soft-delete cascade: it also lists SET NULL
 * relations (payments -> treatment, treatments -> procedure). A hard delete
 * wouldn't remove those rows, but it WOULD sever real financial/medical history
 * (a payment losing its treatment link, a treatment losing its procedure), so
 * the Recycle Bin refuses to purge a referenced record without an explicit
 * force from a Super Admin.
 */
export const PURGE_REFERENCES: Readonly<Record<string, readonly CascadeChild[]>> = {
  Patient: [
    { model: "treatmentRecord", fk: "patientId" },
    { model: "payment", fk: "patientId" },
  ],
  Doctor: [
    { model: "treatmentDoctor", fk: "doctorId" },
    { model: "doctorPayout", fk: "doctorId" },
  ],
  TreatmentRecord: [
    { model: "treatmentDoctor", fk: "treatmentRecordId" },
    { model: "payment", fk: "treatmentRecordId" },
  ],
  Procedure: [{ model: "treatmentRecord", fk: "procedureId" }],
  // Inventory: warn before a permanent purge would take stock history with it.
  // An item's batches + ledger CASCADE on force-purge; a supplier's batches only
  // SET NULL (history survives), but we still warn since the link is lost.
  InventoryItem: [
    { model: "inventoryBatch", fk: "itemId" },
    { model: "stockMovement", fk: "itemId" },
  ],
  Supplier: [{ model: "inventoryBatch", fk: "supplierId" }],
  // Medication -> PrescriptionItem is ON DELETE SET NULL: a purge severs the
  // catalog link on issued prescription lines (their name/strength/form are
  // snapshotted, so the printout survives) — warn unless a Super Admin forces it.
  Medication: [{ model: "prescriptionItem", fk: "medicationId" }],
};

/** Reference relations that guard a purge for a model (empty if none). Pure. */
export function purgeReferencesFor(model: string): readonly CascadeChild[] {
  return PURGE_REFERENCES[model] ?? [];
}

/** Pure decision: a purge is blocked when references exist and force is off. */
export function isPurgeBlocked(referenceCount: number, force: boolean): boolean {
  return referenceCount > 0 && !force;
}

/**
 * Count every row (live AND trashed) that references `id` through any of the
 * model's purge-reference relations. `deletedAt: undefined` keeps the key
 * present so the read extension opts out of its live-only filter, yet applies no
 * constraint — so trashed history still counts toward the guard.
 */
export async function countPurgeReferences(model: string, id: string): Promise<number> {
  const map = prisma as unknown as DelegateMap;
  let total = 0;
  for (const ref of purgeReferencesFor(model)) {
    total += await map[ref.model].count({ where: { [ref.fk]: id, deletedAt: undefined } });
  }
  return total;
}

/**
 * Permanently hard-delete a trashed record. The database's ON DELETE rules do
 * the cascading (the same ones a normal delete would trigger), so this matches
 * the pre-soft-delete behaviour exactly. Returns false when the id is not in the
 * Recycle Bin. For PatientFile the on-disk binary is removed first (it was kept
 * on soft-delete so a restore could recover it).
 *
 * Callers MUST enforce the reference guard ({@link isPurgeBlocked}) before
 * calling this; purge itself is unconditional so an admin force can go through.
 */
export async function purgeEntity(model: string, id: string): Promise<boolean> {
  if (!isSoftDeletableModel(model)) {
    throw new Error(`purge: model "${model}" is not soft-deletable`);
  }
  const map = prisma as unknown as DelegateMap;
  const delegate = map[DELEGATE_BY_MODEL[model]];
  const trashed = await delegate.findMany({ where: { id, deletedAt: { not: null } }, select: { id: true } });
  if (trashed.length === 0) return false;
  if (model === "PatientFile") {
    const file = await prisma.patientFile.findUnique({ where: { id }, select: { storagePath: true } });
    if (file) await deleteStored(file.storagePath);
  }
  await delegate.delete({ where: { id } });
  return true;
}
