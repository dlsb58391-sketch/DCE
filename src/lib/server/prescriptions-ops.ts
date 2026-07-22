/**
 * Electronic Prescriptions — database/transaction operations service.
 *
 * Thin, well-typed layer between the prescription/medication API routes and
 * Prisma. All status/normalization math is delegated to the pure helpers in
 * prescriptions.ts; this module owns the transactional writes and the read
 * aggregations used by the UI.
 *
 * Invariants enforced here:
 *   - Prescription code is unique per year (`RX-YYYY-NNNN`), allocated inside the
 *     create transaction and retried on a unique-constraint clash.
 *   - A prescription snapshots the patient/doctor NAME and each line snapshots the
 *     medication name/strength/form at issue time, so a later edit or deletion of
 *     the catalog/patient/doctor never rewrites an already-printed document.
 *   - Cancelling is only allowed while the prescription is `issued` (pure guard).
 *   - Delete is a soft-delete (Recycle Bin): history is never physically lost from
 *     the normal flow.
 *
 * Result shape: every write returns a discriminated `OpResult` so routes do
 * `if (!r.ok) return errorJson(r.code, r.status, ...)` without throwing.
 */
import { prisma } from "@/lib/db";
import type { TxClient } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/server/audit";
import type { SessionPayload } from "@/lib/server/auth";
import { normalizePhone } from "@/lib/server/phone";
import { ensurePatient } from "@/lib/server/appointments";
import { softDeleteEntity } from "@/lib/server/soft-delete-ops";
import {
  buildRxCode,
  canCancelRx,
  clampDurationDays,
  clampRefills,
  type RxStatus,
} from "@/lib/server/prescriptions";

type Actor = Pick<SessionPayload, "sub" | "name">;

export type OpOk<T> = { ok: true; data: T };
export type OpErr = { ok: false; code: string; status: number; message: string; details?: unknown };
export type OpResult<T> = OpOk<T> | OpErr;

const ok = <T>(data: T): OpOk<T> => ({ ok: true, data });
const fail = (code: string, status: number, message: string, details?: unknown): OpErr => ({
  ok: false,
  code,
  status,
  message,
  details,
});

const trimOrNull = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};
const firstText = (...vals: unknown[]): string => {
  for (const v of vals) {
    const s = trimOrNull(v);
    if (s) return s;
  }
  return "";
};
const tail = (p: string) => (p || "").replace(/\D/g, "").slice(-9);

// ---------------------------------------------------------------------------
// Serialization (Date -> ISO for the JSON API contract; no Decimals here)
// ---------------------------------------------------------------------------

type RawRxItem = {
  id: string;
  medicationId: string | null;
  nameEn: string;
  nameAr: string;
  strength: string | null;
  form: string | null;
  dosage: string | null;
  frequency: string | null;
  durationDays: number | null;
  quantity: string | null;
  refills: number;
  instructions: string | null;
  sortOrder: number;
};

export function serializeRxItem(it: RawRxItem) {
  return {
    id: it.id,
    medicationId: it.medicationId,
    nameEn: it.nameEn,
    nameAr: it.nameAr,
    strength: it.strength,
    form: it.form,
    dosage: it.dosage,
    frequency: it.frequency,
    durationDays: it.durationDays,
    quantity: it.quantity,
    refills: it.refills,
    instructions: it.instructions,
    sortOrder: it.sortOrder,
  };
}

type RawRx = {
  id: string;
  code: string;
  patientId: string;
  patientName: string;
  doctorId: string | null;
  doctorName: string | null;
  appointmentId: string | null;
  status: string;
  diagnosis: string | null;
  notes: string | null;
  issuedAt: Date;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: RawRxItem[];
};

export function serializeRx(rx: RawRx) {
  const items = rx.items.map(serializeRxItem);
  return {
    id: rx.id,
    code: rx.code,
    patientId: rx.patientId,
    patientName: rx.patientName,
    doctorId: rx.doctorId,
    doctorName: rx.doctorName,
    appointmentId: rx.appointmentId,
    status: rx.status,
    diagnosis: rx.diagnosis,
    notes: rx.notes,
    issuedAt: rx.issuedAt.toISOString(),
    createdBy: rx.createdBy,
    createdByName: rx.createdByName,
    createdAt: rx.createdAt.toISOString(),
    updatedAt: rx.updatedAt.toISOString(),
    items,
    itemCount: items.length,
  };
}

const RX_INCLUDE = { items: { orderBy: { sortOrder: "asc" } as const } } as const;

// ---------------------------------------------------------------------------
// Medication catalog
// ---------------------------------------------------------------------------

type MedicationInput = {
  nameEn?: string | null;
  nameAr?: string | null;
  form?: string | null;
  strength?: string | null;
  route?: string | null;
  defaultDosage?: string | null;
  defaultFrequency?: string | null;
  defaultDurationDays?: number | null;
  defaultInstructions?: string | null;
  notes?: string | null;
  active?: boolean | null;
};

/** List catalog medications (live rows only via the soft-delete read scope). */
export async function listMedications(opts: {
  search?: string | null;
  includeInactive?: boolean;
}): Promise<{ medications: Array<Record<string, unknown>> }> {
  const where: Record<string, unknown> = {};
  if (!opts.includeInactive) where.active = true;
  const search = opts.search?.trim();
  if (search) {
    where.OR = [
      { nameEn: { contains: search, mode: "insensitive" } },
      { nameAr: { contains: search, mode: "insensitive" } },
      { strength: { contains: search, mode: "insensitive" } },
    ];
  }
  const rows = await prisma.medication.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { nameEn: "asc" }],
  });
  return { medications: rows };
}

/** Create a catalog medication. Requires at least one of nameEn/nameAr. */
export async function createMedication(p: {
  input: MedicationInput;
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<Record<string, unknown>>> {
  const nameEn = firstText(p.input.nameEn, p.input.nameAr);
  const nameAr = firstText(p.input.nameAr, p.input.nameEn);
  if (!nameEn && !nameAr) return fail("name_required", 400, "a medication name is required");
  const med = await prisma.medication.create({
    data: {
      nameEn,
      nameAr,
      form: trimOrNull(p.input.form),
      strength: trimOrNull(p.input.strength),
      route: trimOrNull(p.input.route),
      defaultDosage: trimOrNull(p.input.defaultDosage),
      defaultFrequency: trimOrNull(p.input.defaultFrequency),
      defaultDurationDays: clampDurationDays(p.input.defaultDurationDays),
      defaultInstructions: trimOrNull(p.input.defaultInstructions),
      notes: trimOrNull(p.input.notes),
      active: p.input.active === false ? false : true,
    },
  });
  await writeAudit({
    action: "prescription.medication.create",
    actor: p.actor,
    entityType: "Medication",
    entityId: med.id,
    summary: `Added medication ${med.nameEn || med.nameAr}`,
    ip: p.ip ?? null,
  });
  return ok({ medication: med });
}

/** Update a catalog medication. Any field left undefined is unchanged. */
export async function updateMedication(p: {
  id: string;
  input: MedicationInput;
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<Record<string, unknown>>> {
  const existing = await prisma.medication.findFirst({ where: { id: p.id }, select: { id: true } });
  if (!existing) return fail("medication_not_found", 404, "medication not found");
  const data: Record<string, unknown> = {};
  if (p.input.nameEn !== undefined) data.nameEn = firstText(p.input.nameEn, p.input.nameAr);
  if (p.input.nameAr !== undefined) data.nameAr = firstText(p.input.nameAr, p.input.nameEn);
  if (p.input.form !== undefined) data.form = trimOrNull(p.input.form);
  if (p.input.strength !== undefined) data.strength = trimOrNull(p.input.strength);
  if (p.input.route !== undefined) data.route = trimOrNull(p.input.route);
  if (p.input.defaultDosage !== undefined) data.defaultDosage = trimOrNull(p.input.defaultDosage);
  if (p.input.defaultFrequency !== undefined) data.defaultFrequency = trimOrNull(p.input.defaultFrequency);
  if (p.input.defaultDurationDays !== undefined) data.defaultDurationDays = clampDurationDays(p.input.defaultDurationDays);
  if (p.input.defaultInstructions !== undefined) data.defaultInstructions = trimOrNull(p.input.defaultInstructions);
  if (p.input.notes !== undefined) data.notes = trimOrNull(p.input.notes);
  if (p.input.active !== undefined && p.input.active !== null) data.active = !!p.input.active;
  const med = await prisma.medication.update({ where: { id: p.id }, data });
  await writeAudit({
    action: "prescription.medication.update",
    actor: p.actor,
    entityType: "Medication",
    entityId: med.id,
    summary: `Updated medication ${med.nameEn || med.nameAr}`,
    metadata: { fields: Object.keys(data) },
    ip: p.ip ?? null,
  });
  return ok({ medication: med });
}

/** Soft-delete a catalog medication (Recycle Bin). Issued prescriptions keep their snapshots. */
export async function deleteMedication(p: {
  id: string;
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<Record<string, unknown>>> {
  const existing = await prisma.medication.findFirst({ where: { id: p.id }, select: { id: true, nameEn: true, nameAr: true } });
  if (!existing) return fail("medication_not_found", 404, "medication not found");
  await softDeleteEntity("Medication", p.id, p.actor.sub ?? null);
  await writeAudit({
    action: "prescription.medication.delete",
    actor: p.actor,
    entityType: "Medication",
    entityId: p.id,
    summary: `Deleted medication ${existing.nameEn || existing.nameAr}`,
    ip: p.ip ?? null,
  });
  return ok({ id: p.id });
}

// ---------------------------------------------------------------------------
// Prescription code allocation
// ---------------------------------------------------------------------------

/**
 * Next RX code for the current year: `RX-YYYY-NNNN`, 1 above the highest suffix
 * already used this year. `deletedAt: undefined` opts out of the soft-delete
 * live-only scope so a trashed prescription's code is still counted (codes are
 * unique across ALL rows). A rare race is caught by the P2002 retry in
 * {@link createWithCodeRetry}.
 */
async function nextRxCode(tx: TxClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `RX-${year}-`;
  const rows = await tx.prescription.findMany({
    where: { code: { startsWith: prefix }, deletedAt: undefined },
    select: { code: true },
  });
  let max = 0;
  for (const r of rows) {
    const n = Number.parseInt(r.code.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return buildRxCode(year, max + 1);
}

/** Retry a create on an RX-code unique clash (rare concurrent allocation race). */
async function createWithCodeRetry<T>(fn: (tx: TxClient) => Promise<T>): Promise<T> {
  const MAX = 5;
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction((tx) => fn(tx));
    } catch (e) {
      const clash = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (clash && attempt < MAX) continue;
      throw e;
    }
  }
}

// ---------------------------------------------------------------------------
// Prescription line building (snapshots + clamps)
// ---------------------------------------------------------------------------

export type RxItemInput = {
  medicationId?: string | null;
  nameEn?: string | null;
  nameAr?: string | null;
  strength?: string | null;
  form?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  durationDays?: number | null;
  quantity?: string | null;
  refills?: number | null;
  instructions?: string | null;
};

type RxItemData = {
  medicationId: string | null;
  nameEn: string;
  nameAr: string;
  strength: string | null;
  form: string | null;
  dosage: string | null;
  frequency: string | null;
  durationDays: number | null;
  quantity: string | null;
  refills: number;
  instructions: string | null;
  sortOrder: number;
};

/**
 * Validate prescription line inputs and snapshot each medication's names /
 * strength / form (falling back to explicit line values). A medicationId that no
 * longer resolves is treated as a custom line (link nulled), mirroring how
 * treatments handle a stale procedureId. Returns typed line rows ready to
 * `create`, or an OpErr on the first line with no usable name.
 */
async function buildItemData(lines: RxItemInput[]): Promise<OpResult<RxItemData[]>> {
  if (lines.length === 0) return fail("no_items", 400, "add at least one medication");
  const ids = [...new Set(lines.map((l) => l.medicationId).filter((v): v is string => !!v))];
  const meds = ids.length
    ? await prisma.medication.findMany({
        where: { id: { in: ids } },
        select: { id: true, nameEn: true, nameAr: true, strength: true, form: true },
      })
    : [];
  const byId = new Map(meds.map((m) => [m.id, m]));
  const out: RxItemData[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const med = l.medicationId ? byId.get(l.medicationId) ?? null : null;
    const nameEn = firstText(l.nameEn, med?.nameEn, l.nameAr, med?.nameAr);
    const nameAr = firstText(l.nameAr, med?.nameAr, l.nameEn, med?.nameEn);
    if (!nameEn && !nameAr) return fail("item_name_required", 400, "each medication line needs a name", { index: i });
    out.push({
      medicationId: med ? med.id : null,
      nameEn,
      nameAr,
      strength: firstText(l.strength, med?.strength) || null,
      form: firstText(l.form, med?.form) || null,
      dosage: trimOrNull(l.dosage),
      frequency: trimOrNull(l.frequency),
      durationDays: clampDurationDays(l.durationDays),
      quantity: trimOrNull(l.quantity),
      refills: clampRefills(l.refills),
      instructions: trimOrNull(l.instructions),
      sortOrder: i,
    });
  }
  return ok(out);
}

// ---------------------------------------------------------------------------
// Prescription reads
// ---------------------------------------------------------------------------

/** List a patient's prescriptions (newest first) by phone; empty for unknown phone. */
export async function listPrescriptionsByPhone(
  phone: string,
  take: number | undefined,
  skip: number | undefined,
): Promise<{ prescriptions: Array<Record<string, unknown>>; total: number }> {
  const key = normalizePhone(phone).digits || phone.replace(/\D/g, "");
  const t = tail(key);
  if (t.length < 8) return { prescriptions: [], total: 0 };
  const patients = await prisma.patient.findMany({ where: { phone: { contains: t } }, select: { id: true } });
  const patientIds = patients.map((x) => x.id);
  if (patientIds.length === 0) return { prescriptions: [], total: 0 };
  const [rows, total] = await Promise.all([
    prisma.prescription.findMany({
      where: { patientId: { in: patientIds } },
      orderBy: { issuedAt: "desc" },
      take,
      skip,
      include: RX_INCLUDE,
    }),
    prisma.prescription.count({ where: { patientId: { in: patientIds } } }),
  ]);
  return { prescriptions: rows.map(serializeRx), total };
}

/** Full detail for one prescription (with its lines). */
export async function getPrescription(id: string): Promise<OpResult<Record<string, unknown>>> {
  const rx = await prisma.prescription.findFirst({ where: { id }, include: RX_INCLUDE });
  if (!rx) return fail("prescription_not_found", 404, "prescription not found");
  return ok({ prescription: serializeRx(rx) });
}

// ---------------------------------------------------------------------------
// Prescription writes (transactional)
// ---------------------------------------------------------------------------

/**
 * Create an issued prescription for a patient (creating/looking up the patient by
 * phone), snapshotting the patient + doctor names and each line's medication
 * details. Allocates the RX code inside the transaction with a P2002 retry.
 */
export async function createPrescription(p: {
  phone: string;
  name?: string | null;
  doctorId?: string | null;
  appointmentId?: string | null;
  diagnosis?: string | null;
  notes?: string | null;
  branchId?: string | null;
  items: RxItemInput[];
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<Record<string, unknown>>> {
  const phoneRaw = String(p.phone ?? "").trim();
  if (!phoneRaw) return fail("phone_required", 400, "a patient phone is required");

  const built = await buildItemData(p.items ?? []);
  if (!built.ok) return built;

  // Optional prescribing doctor — snapshot the name for a stable printout.
  let doctorName: string | null = null;
  if (p.doctorId) {
    const doc = await prisma.doctor.findFirst({
      where: { id: p.doctorId },
      select: { id: true, nameEn: true, nameAr: true },
    });
    if (!doc) return fail("doctor_not_found", 404, "doctor not found");
    doctorName = firstText(doc.nameEn, doc.nameAr) || null;
  }

  const to = normalizePhone(phoneRaw).digits || phoneRaw.replace(/\D/g, "");
  const patientId = await ensurePatient(String(p.name ?? "").trim() || "Patient", to);
  if (!patientId) return fail("patient_failed", 400, "could not resolve the patient");
  const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { name: true } });
  const patientName = firstText(p.name, patient?.name) || "Patient";

  const rx = await createWithCodeRetry(async (tx) => {
    const code = await nextRxCode(tx);
    return tx.prescription.create({
      data: {
        code,
        patientId,
        patientName,
        doctorId: p.doctorId ?? null,
        doctorName,
        appointmentId: trimOrNull(p.appointmentId),
        branchId: p.branchId ?? null,
        status: "issued",
        diagnosis: trimOrNull(p.diagnosis),
        notes: trimOrNull(p.notes),
        createdBy: p.actor.sub ?? null,
        createdByName: p.actor.name ?? null,
        items: { create: built.data },
      },
      include: RX_INCLUDE,
    });
  });
  await writeAudit({
    action: "prescription.create",
    actor: p.actor,
    entityType: "Prescription",
    entityId: rx.id,
    summary: `Issued prescription ${rx.code} for ${patientName}`,
    metadata: { code: rx.code, itemCount: built.data.length, doctorId: p.doctorId ?? null },
    ip: p.ip ?? null,
  });
  return ok({ prescription: serializeRx(rx) });
}

/** Cancel an issued prescription (terminal). Received/printed copies stay valid history. */
export async function cancelPrescription(p: {
  id: string;
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<Record<string, unknown>>> {
  const rx = await prisma.prescription.findFirst({ where: { id: p.id }, select: { id: true, code: true, status: true } });
  if (!rx) return fail("prescription_not_found", 404, "prescription not found");
  if (!canCancelRx(rx.status)) {
    return fail("prescription_not_cancellable", 409, `a ${rx.status} prescription cannot be cancelled`);
  }
  const updated = await prisma.prescription.update({
    where: { id: p.id },
    data: { status: "cancelled" as RxStatus },
    include: RX_INCLUDE,
  });
  await writeAudit({
    action: "prescription.cancel",
    actor: p.actor,
    entityType: "Prescription",
    entityId: p.id,
    summary: `Cancelled prescription ${rx.code}`,
    metadata: { code: rx.code },
    ip: p.ip ?? null,
  });
  return ok({ prescription: serializeRx(updated) });
}

/** Soft-delete a prescription (Recycle Bin). */
export async function deletePrescription(p: {
  id: string;
  actor: Actor;
  ip?: string | null;
}): Promise<OpResult<Record<string, unknown>>> {
  const rx = await prisma.prescription.findFirst({ where: { id: p.id }, select: { id: true, code: true } });
  if (!rx) return fail("prescription_not_found", 404, "prescription not found");
  await softDeleteEntity("Prescription", p.id, p.actor.sub ?? null);
  await writeAudit({
    action: "prescription.delete",
    actor: p.actor,
    entityType: "Prescription",
    entityId: p.id,
    summary: `Deleted prescription ${rx.code}`,
    ip: p.ip ?? null,
  });
  return ok({ id: p.id });
}
