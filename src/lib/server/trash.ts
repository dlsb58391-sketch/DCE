/**
 * Recycle Bin (Trash) read model.
 *
 * Maps the UI-facing trash "type" slugs to their soft-deletable Prisma model +
 * delegate, and renders trashed rows into a small, uniform list shape for the
 * admin Recycle Bin. Writes (restore / permanent-delete) live in
 * `soft-delete-ops.ts`; this module is read-only.
 *
 * Only the ten independently-managed entities are exposed. `TreatmentDoctor`
 * (commission split) is intentionally omitted: it is a cascade-only join row
 * that always trashes and restores together with its parent treatment/doctor,
 * so it is never surfaced as its own Recycle Bin entry. Inventory batches and
 * stock movements are likewise cascade-only children of an inventory item.
 *
 * Every query filters `deletedAt: { not: null }`, which also opts out of the
 * soft-delete read extension's live-only scoping (see soft-delete.ts).
 */
import { prisma } from "@/lib/db";
import { num, type DecimalLike } from "@/lib/server/money";

export type TrashType =
  | "patient"
  | "doctor"
  | "treatment"
  | "payment"
  | "procedure"
  | "file"
  | "payout"
  | "expense"
  | "supplier"
  | "item"
  | "purchase_order"
  | "medication"
  | "prescription"
  | "branch";

type TrashRegistryEntry = {
  /** PascalCase Prisma model name (matches soft-delete model registry). */
  model: string;
  /** camelCase Prisma delegate name. */
  delegate: string;
  /** Human label for the type (English; UI localizes separately). */
  label: string;
};

export const TRASH_REGISTRY: Readonly<Record<TrashType, TrashRegistryEntry>> = {
  patient: { model: "Patient", delegate: "patient", label: "Patients" },
  doctor: { model: "Doctor", delegate: "doctor", label: "Doctors" },
  treatment: { model: "TreatmentRecord", delegate: "treatmentRecord", label: "Treatments" },
  payment: { model: "Payment", delegate: "payment", label: "Payments" },
  procedure: { model: "Procedure", delegate: "procedure", label: "Procedures" },
  file: { model: "PatientFile", delegate: "patientFile", label: "Files" },
  payout: { model: "DoctorPayout", delegate: "doctorPayout", label: "Payouts" },
  expense: { model: "ClinicExpense", delegate: "clinicExpense", label: "Expenses" },
  supplier: { model: "Supplier", delegate: "supplier", label: "Suppliers" },
  item: { model: "InventoryItem", delegate: "inventoryItem", label: "Inventory items" },
  purchase_order: { model: "PurchaseOrder", delegate: "purchaseOrder", label: "Purchase orders" },
  medication: { model: "Medication", delegate: "medication", label: "Medications" },
  prescription: { model: "Prescription", delegate: "prescription", label: "Prescriptions" },
  branch: { model: "Branch", delegate: "branch", label: "Branches" },
};

export const TRASH_TYPES = Object.keys(TRASH_REGISTRY) as TrashType[];

export function isTrashType(v: string | null | undefined): v is TrashType {
  return !!v && Object.prototype.hasOwnProperty.call(TRASH_REGISTRY, v);
}

/** One Recycle Bin row, uniform across entity types. */
export type TrashItem = {
  id: string;
  type: TrashType;
  label: string;
  detail: string | null;
  deletedAt: string;
  deletedBy: string | null;
};

type Row = Record<string, unknown>;

/** Read-only structural view of the delegate methods used here (dynamic index). */
type ReadDelegate = {
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, unknown>;
    take?: number;
    skip?: number;
    select?: Record<string, true>;
  }): Promise<Row[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
};
type ReadDelegateMap = Record<string, ReadDelegate>;

const str = (v: unknown): string | null => (typeof v === "string" ? v : v == null ? null : String(v));
const money = (v: unknown): string => String(num(v as DecimalLike));
const firstText = (...vals: unknown[]): string => {
  for (const v of vals) {
    const s = str(v);
    if (s && s.trim()) return s;
  }
  return "";
};

/** Per-type projection: which columns to read + how to render label/detail. */
type TrashView = {
  select: Record<string, true>;
  label: (r: Row) => string;
  detail: (r: Row) => string | null;
};

const VIEW: Readonly<Record<TrashType, TrashView>> = {
  patient: {
    select: { id: true, name: true, phone: true, deletedAt: true, deletedBy: true },
    label: (r) => firstText(r.name) || "Unnamed patient",
    detail: (r) => str(r.phone),
  },
  doctor: {
    select: { id: true, nameEn: true, nameAr: true, deletedAt: true, deletedBy: true },
    label: (r) => firstText(r.nameEn, r.nameAr) || "Doctor",
    detail: () => null,
  },
  treatment: {
    select: { id: true, nameEn: true, nameAr: true, price: true, deletedAt: true, deletedBy: true },
    label: (r) => firstText(r.nameEn, r.nameAr) || "Treatment",
    detail: (r) => money(r.price),
  },
  payment: {
    select: { id: true, amount: true, method: true, deletedAt: true, deletedBy: true },
    label: (r) => money(r.amount),
    detail: (r) => str(r.method),
  },
  procedure: {
    select: { id: true, nameEn: true, nameAr: true, price: true, deletedAt: true, deletedBy: true },
    label: (r) => firstText(r.nameEn, r.nameAr) || "Procedure",
    detail: (r) => money(r.price),
  },
  file: {
    select: { id: true, fileName: true, category: true, deletedAt: true, deletedBy: true },
    label: (r) => firstText(r.fileName) || "File",
    detail: (r) => str(r.category),
  },
  payout: {
    select: { id: true, amount: true, method: true, deletedAt: true, deletedBy: true },
    label: (r) => money(r.amount),
    detail: (r) => str(r.method),
  },
  expense: {
    select: { id: true, labelEn: true, labelAr: true, amount: true, deletedAt: true, deletedBy: true },
    label: (r) => firstText(r.labelEn, r.labelAr) || "Expense",
    detail: (r) => money(r.amount),
  },
  supplier: {
    select: { id: true, nameEn: true, nameAr: true, phone: true, deletedAt: true, deletedBy: true },
    label: (r) => firstText(r.nameEn, r.nameAr) || "Supplier",
    detail: (r) => str(r.phone),
  },
  item: {
    select: { id: true, nameEn: true, nameAr: true, sku: true, deletedAt: true, deletedBy: true },
    label: (r) => firstText(r.nameEn, r.nameAr) || "Item",
    detail: (r) => str(r.sku),
  },
  purchase_order: {
    select: { id: true, code: true, status: true, deletedAt: true, deletedBy: true },
    label: (r) => firstText(r.code) || "Purchase order",
    detail: (r) => str(r.status),
  },
  medication: {
    select: { id: true, nameEn: true, nameAr: true, strength: true, deletedAt: true, deletedBy: true },
    label: (r) => firstText(r.nameEn, r.nameAr) || "Medication",
    detail: (r) => str(r.strength),
  },
  prescription: {
    select: { id: true, code: true, patientName: true, deletedAt: true, deletedBy: true },
    label: (r) => firstText(r.code) || "Prescription",
    detail: (r) => str(r.patientName),
  },
  branch: {
    select: { id: true, nameEn: true, nameAr: true, code: true, deletedAt: true, deletedBy: true },
    label: (r) => firstText(r.nameEn, r.nameAr) || "Branch",
    detail: (r) => str(r.code),
  },
};

const TRASHED_WHERE = { deletedAt: { not: null } } as const;

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** One trashed page for a type, newest-deleted first, plus the total count. */
export async function listTrash(
  type: TrashType,
  limit: number,
  offset: number,
): Promise<{ items: TrashItem[]; total: number }> {
  const view = VIEW[type];
  const delegate = (prisma as unknown as ReadDelegateMap)[TRASH_REGISTRY[type].delegate];
  const [rows, total] = await Promise.all([
    delegate.findMany({
      where: TRASHED_WHERE,
      orderBy: { deletedAt: "desc" },
      take: limit,
      skip: offset,
      select: view.select,
    }),
    delegate.count({ where: TRASHED_WHERE }),
  ]);
  const items = rows.map((r) => ({
    id: String(r.id),
    type,
    label: view.label(r),
    detail: view.detail(r),
    deletedAt: toIso(r.deletedAt),
    deletedBy: str(r.deletedBy),
  }));
  return { items, total };
}

/** Count of trashed rows per type (drives the Recycle Bin overview). */
export async function trashCounts(): Promise<Record<TrashType, number>> {
  const map = prisma as unknown as ReadDelegateMap;
  const entries = await Promise.all(
    TRASH_TYPES.map(async (t) => {
      const n = await map[TRASH_REGISTRY[t].delegate].count({ where: TRASHED_WHERE });
      return [t, n] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<TrashType, number>;
}
