// Mirror test for the transactional cascade in src/lib/server/soft-delete-ops.ts.
// That module imports the Prisma client, so it can't load in a plain .mjs; the
// cascade algorithm + maps are re-declared here and exercised against an
// in-memory fake transaction client. This locks the contract that a soft-delete
// stamps exactly the rows today's ON DELETE CASCADE would remove, with one
// shared timestamp, while leaving independently-trashed children untouched.

import { test } from "node:test";
import assert from "node:assert/strict";

// --- mirrors of soft-delete.ts + soft-delete-ops.ts ----------------------
const SOFT_DELETABLE_MODELS = new Set([
  "Patient", "Procedure", "TreatmentRecord", "Payment", "PatientFile",
  "Doctor", "TreatmentDoctor", "DoctorPayout", "ClinicExpense",
]);
const SOFT_DELETE_CASCADE = {
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
const DELEGATE_BY_MODEL = {
  Patient: "patient", Procedure: "procedure", TreatmentRecord: "treatmentRecord",
  Payment: "payment", PatientFile: "patientFile", Doctor: "doctor",
  TreatmentDoctor: "treatmentDoctor", DoctorPayout: "doctorPayout", ClinicExpense: "clinicExpense",
};
const MODEL_BY_DELEGATE = {
  treatmentRecord: "TreatmentRecord", payment: "Payment",
  treatmentDoctor: "TreatmentDoctor", doctorPayout: "DoctorPayout",
};
const cascadeChildrenFor = (m) => SOFT_DELETE_CASCADE[m] ?? [];

async function cascadeSoftDelete(tx, parentModel, parentIds, deletedBy, deletedAt) {
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
async function softDeleteInTransaction(tx, model, id, deletedBy, deletedAt) {
  if (!SOFT_DELETABLE_MODELS.has(model)) throw new Error(`not soft-deletable: ${model}`);
  await tx[DELEGATE_BY_MODEL[model]].update({ where: { id }, data: { deletedAt, deletedBy } });
  await cascadeSoftDelete(tx, model, [id], deletedBy, deletedAt);
}

// --- in-memory fake transaction client -----------------------------------
function makeTx(seed) {
  const store = structuredClone(seed);
  const delegateFor = (name) => {
    store[name] = store[name] ?? [];
    const rows = store[name];
    return {
      async update({ where, data }) {
        const row = rows.find((r) => r.id === where.id);
        if (!row) throw new Error(`P2025: ${name} ${where.id} not found`);
        Object.assign(row, data);
        return { id: row.id };
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const row of rows) {
          const idOk = where.id?.in ? where.id.in.includes(row.id) : true;
          const liveOk = where.deletedAt === null ? row.deletedAt == null : true;
          if (idOk && liveOk) { Object.assign(row, data); count++; }
        }
        return { count };
      },
      async findMany({ where }) {
        const fkKey = Object.keys(where).find((k) => k !== "deletedAt");
        return rows.filter((row) => {
          const fkOk = fkKey ? where[fkKey].in.includes(row[fkKey]) : true;
          const liveOk = where.deletedAt === null ? row.deletedAt == null : true;
          return fkOk && liveOk;
        }).map((r) => ({ id: r.id }));
      },
    };
  };
  const tx = new Proxy({}, { get: (_t, prop) => delegateFor(String(prop)) });
  return { tx, store };
}

const AT = new Date("2026-02-01T10:00:00.000Z");
const stamped = (r) => r.deletedAt instanceof Date && r.deletedAt.getTime() === AT.getTime();

// --- patient cascade (deepest: patient -> treatments -> splits, + payments) --
test("soft-delete patient cascades to treatments, splits and payments", async () => {
  const { tx, store } = makeTx({
    patient: [{ id: "p1" }, { id: "p2" }],
    treatmentRecord: [{ id: "t1", patientId: "p1" }, { id: "t2", patientId: "p1" }, { id: "t3", patientId: "p2" }],
    treatmentDoctor: [
      { id: "td1", treatmentRecordId: "t1", doctorId: "d1" },
      { id: "td2", treatmentRecordId: "t2", doctorId: "d1" },
      { id: "td3", treatmentRecordId: "t3", doctorId: "d1" },
    ],
    payment: [{ id: "pay1", patientId: "p1" }, { id: "pay2", patientId: "p1" }, { id: "pay3", patientId: "p2" }],
  });

  await softDeleteInTransaction(tx, "Patient", "p1", "user-1", AT);

  assert.ok(stamped(store.patient.find((r) => r.id === "p1")), "p1 stamped");
  assert.ok(store.treatmentRecord.filter((r) => r.patientId === "p1").every(stamped), "p1 treatments stamped");
  assert.ok(store.treatmentDoctor.filter((r) => ["td1", "td2"].includes(r.id)).every(stamped), "p1 splits stamped");
  assert.ok(store.payment.filter((r) => r.patientId === "p1").every(stamped), "p1 payments stamped");
  // p2 and its graph are untouched.
  assert.equal(store.patient.find((r) => r.id === "p2").deletedAt, undefined);
  assert.equal(store.treatmentRecord.find((r) => r.id === "t3").deletedAt, undefined);
  assert.equal(store.treatmentDoctor.find((r) => r.id === "td3").deletedAt, undefined);
  assert.equal(store.payment.find((r) => r.id === "pay3").deletedAt, undefined);
  // Every stamped row shares the exact same timestamp (needed for restore).
  assert.ok(store.treatmentDoctor.find((r) => r.id === "td1").deletedBy === "user-1");
});

// --- doctor cascade (splits + payouts) -----------------------------------
test("soft-delete doctor cascades to its splits and payouts", async () => {
  const { tx, store } = makeTx({
    doctor: [{ id: "d1" }, { id: "d2" }],
    treatmentDoctor: [{ id: "td1", doctorId: "d1" }, { id: "td2", doctorId: "d2" }],
    doctorPayout: [{ id: "po1", doctorId: "d1" }, { id: "po2", doctorId: "d2" }],
  });

  await softDeleteInTransaction(tx, "Doctor", "d1", "user-1", AT);

  assert.ok(stamped(store.doctor.find((r) => r.id === "d1")));
  assert.ok(stamped(store.treatmentDoctor.find((r) => r.id === "td1")));
  assert.ok(stamped(store.doctorPayout.find((r) => r.id === "po1")));
  assert.equal(store.doctor.find((r) => r.id === "d2").deletedAt, undefined);
  assert.equal(store.treatmentDoctor.find((r) => r.id === "td2").deletedAt, undefined);
  assert.equal(store.doctorPayout.find((r) => r.id === "po2").deletedAt, undefined);
});

// --- an already-trashed child keeps its original timestamp ----------------
test("cascade does not re-stamp a child already soft-deleted on its own", async () => {
  const earlier = new Date("2026-01-01T00:00:00.000Z");
  const { tx, store } = makeTx({
    doctor: [{ id: "d1" }],
    treatmentDoctor: [
      { id: "td1", doctorId: "d1" },
      { id: "td2", doctorId: "d1", deletedAt: earlier, deletedBy: "prior" },
    ],
    doctorPayout: [],
  });

  await softDeleteInTransaction(tx, "Doctor", "d1", "user-1", AT);

  assert.ok(stamped(store.treatmentDoctor.find((r) => r.id === "td1")), "live split stamped now");
  const kept = store.treatmentDoctor.find((r) => r.id === "td2");
  assert.equal(kept.deletedAt.getTime(), earlier.getTime(), "prior split keeps its timestamp");
  assert.equal(kept.deletedBy, "prior", "prior split keeps its actor");
});

// --- leaf entities do not cascade ----------------------------------------
test("soft-delete of a leaf entity touches only that row", async () => {
  const { tx, store } = makeTx({
    payment: [{ id: "pay1", patientId: "p1" }, { id: "pay2", patientId: "p1" }],
  });
  await softDeleteInTransaction(tx, "Payment", "pay1", null, AT);
  assert.ok(stamped(store.payment.find((r) => r.id === "pay1")));
  assert.equal(store.payment.find((r) => r.id === "pay2").deletedAt, undefined);
});

// --- guard: non-soft-deletable model is rejected -------------------------
test("soft-delete rejects a non-soft-deletable model", async () => {
  const { tx } = makeTx({ appointment: [{ id: "a1" }] });
  await assert.rejects(() => softDeleteInTransaction(tx, "Appointment", "a1", null, AT), /not soft-deletable/);
});
