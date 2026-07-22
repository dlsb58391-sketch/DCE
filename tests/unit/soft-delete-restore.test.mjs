// Mirror tests for the restore + purge helpers in src/lib/server/soft-delete-ops.ts.
// That module imports the Prisma client, so the algorithms + maps are re-declared
// here and exercised against an in-memory fake client. These lock two contracts:
//  1. Restore revives ONLY the children trashed together with the parent (same
//     deletedAt timestamp); children trashed independently stay in the bin.
//  2. The purge reference guard blocks a permanent delete when history points at
//     the record, unless an admin forces it.

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

// Purge reference guard (mirror of PURGE_REFERENCES + the two pure functions).
const PURGE_REFERENCES = {
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
};
const purgeReferencesFor = (m) => PURGE_REFERENCES[m] ?? [];
const isPurgeBlocked = (referenceCount, force) => referenceCount > 0 && !force;

async function cascadeRestore(tx, parentModel, parentIds, deletedAt) {
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
async function restoreInTransaction(tx, model, id) {
  if (!SOFT_DELETABLE_MODELS.has(model)) throw new Error(`not soft-deletable: ${model}`);
  const delegate = tx[DELEGATE_BY_MODEL[model]];
  const found = await delegate.findMany({
    where: { id, deletedAt: { not: null } },
    select: { id: true, deletedAt: true },
  });
  const parent = found[0];
  if (!parent || !parent.deletedAt) return false;
  const deletedAt = parent.deletedAt;
  await delegate.updateMany({ where: { id: { in: [id] } }, data: { deletedAt: null, deletedBy: null } });
  await cascadeRestore(tx, model, [id], deletedAt);
  return true;
}

// --- in-memory fake client -----------------------------------------------
function matchWhere(row, where) {
  for (const [k, v] of Object.entries(where)) {
    if (v === undefined) continue; // absent filter
    if (k === "deletedAt") {
      if (v === null) {
        if (row.deletedAt != null) return false;
      } else if (v && typeof v === "object" && "not" in v) {
        if (v.not === null && row.deletedAt == null) return false;
      } else if (v instanceof Date) {
        if (!(row.deletedAt instanceof Date) || row.deletedAt.getTime() !== v.getTime()) return false;
      } else if (row.deletedAt !== v) {
        return false;
      }
      continue;
    }
    if (v && typeof v === "object" && Array.isArray(v.in)) {
      if (!v.in.includes(row[k])) return false;
    } else if (row[k] !== v) {
      return false;
    }
  }
  return true;
}

function makeTx(seed) {
  const store = structuredClone(seed);
  const delegateFor = (name) => {
    store[name] = store[name] ?? [];
    const rows = store[name];
    return {
      async findMany({ where, select }) {
        return rows.filter((r) => matchWhere(r, where)).map((r) => {
          const out = { id: r.id };
          if (select?.deletedAt) out.deletedAt = r.deletedAt;
          return out;
        });
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const row of rows) {
          if (matchWhere(row, where)) { Object.assign(row, data); count++; }
        }
        return { count };
      },
      async count({ where }) {
        return rows.filter((r) => matchWhere(r, where)).length;
      },
    };
  };
  const tx = new Proxy({}, { get: (_t, prop) => delegateFor(String(prop)) });
  return { tx, store };
}

const AT = new Date("2026-02-01T10:00:00.000Z");
const EARLIER = new Date("2026-01-01T00:00:00.000Z");
const live = (r) => r.deletedAt == null;
const trashedAt = (r, when) => r.deletedAt instanceof Date && r.deletedAt.getTime() === when.getTime();

// --- restore: patient graph, co-trashed only -----------------------------
test("restore revives the patient graph trashed together, not independent rows", async () => {
  const { tx, store } = makeTx({
    patient: [{ id: "p1", deletedAt: AT, deletedBy: "u" }],
    treatmentRecord: [
      { id: "t1", patientId: "p1", deletedAt: AT, deletedBy: "u" },
      { id: "t2", patientId: "p1", deletedAt: EARLIER, deletedBy: "prior" }, // trashed on its own earlier
    ],
    treatmentDoctor: [
      { id: "td1", treatmentRecordId: "t1", deletedAt: AT, deletedBy: "u" },
      { id: "td2", treatmentRecordId: "t2", deletedAt: EARLIER, deletedBy: "prior" },
    ],
    payment: [
      { id: "pay1", patientId: "p1", deletedAt: AT, deletedBy: "u" },
      { id: "pay2", patientId: "p1", deletedAt: EARLIER, deletedBy: "prior" },
    ],
  });

  const ok = await restoreInTransaction(tx, "Patient", "p1");
  assert.equal(ok, true);

  assert.ok(live(store.patient.find((r) => r.id === "p1")), "patient restored");
  assert.ok(live(store.treatmentRecord.find((r) => r.id === "t1")), "co-trashed treatment restored");
  assert.ok(live(store.treatmentDoctor.find((r) => r.id === "td1")), "co-trashed split restored");
  assert.ok(live(store.payment.find((r) => r.id === "pay1")), "co-trashed payment restored");
  // Independently-trashed rows stay in the bin with their original timestamp.
  assert.ok(trashedAt(store.treatmentRecord.find((r) => r.id === "t2"), EARLIER), "earlier treatment kept");
  assert.ok(trashedAt(store.treatmentDoctor.find((r) => r.id === "td2"), EARLIER), "earlier split kept");
  assert.ok(trashedAt(store.payment.find((r) => r.id === "pay2"), EARLIER), "earlier payment kept");
});

// --- restore: doctor graph, leaves other doctors alone -------------------
test("restore revives a doctor's splits and payouts, not another doctor's", async () => {
  const { tx, store } = makeTx({
    doctor: [{ id: "d1", deletedAt: AT, deletedBy: "u" }, { id: "d2" }],
    treatmentDoctor: [
      { id: "td1", doctorId: "d1", deletedAt: AT, deletedBy: "u" },
      { id: "td2", doctorId: "d2" },
    ],
    doctorPayout: [
      { id: "po1", doctorId: "d1", deletedAt: AT, deletedBy: "u" },
      { id: "po3", doctorId: "d1", deletedAt: EARLIER, deletedBy: "prior" },
      { id: "po2", doctorId: "d2" },
    ],
  });

  await restoreInTransaction(tx, "Doctor", "d1");

  assert.ok(live(store.doctor.find((r) => r.id === "d1")));
  assert.ok(live(store.treatmentDoctor.find((r) => r.id === "td1")));
  assert.ok(live(store.doctorPayout.find((r) => r.id === "po1")));
  // Independent earlier payout stays trashed; d2's rows were always live.
  assert.ok(trashedAt(store.doctorPayout.find((r) => r.id === "po3"), EARLIER));
  assert.ok(live(store.doctorPayout.find((r) => r.id === "po2")));
});

// --- restore: leaf entity -------------------------------------------------
test("restore of a leaf entity clears just that row", async () => {
  const { tx, store } = makeTx({
    payment: [{ id: "pay1", patientId: "p1", deletedAt: AT, deletedBy: "u" }, { id: "pay2", patientId: "p1" }],
  });
  const ok = await restoreInTransaction(tx, "Payment", "pay1");
  assert.equal(ok, true);
  assert.ok(live(store.payment.find((r) => r.id === "pay1")));
  assert.ok(live(store.payment.find((r) => r.id === "pay2")));
});

// --- restore: not in the bin ---------------------------------------------
test("restore returns false when the record is not trashed", async () => {
  const { tx, store } = makeTx({ patient: [{ id: "p1" }] }); // already live
  const ok = await restoreInTransaction(tx, "Patient", "p1");
  assert.equal(ok, false);
  assert.ok(live(store.patient.find((r) => r.id === "p1")));
});

test("restore rejects a non-soft-deletable model", async () => {
  const { tx } = makeTx({ appointment: [{ id: "a1", deletedAt: AT }] });
  await assert.rejects(() => restoreInTransaction(tx, "Appointment", "a1"), /not soft-deletable/);
});

// --- purge guard: pure decision ------------------------------------------
test("isPurgeBlocked blocks only when referenced and not forced", () => {
  assert.equal(isPurgeBlocked(0, false), false, "no references -> allowed");
  assert.equal(isPurgeBlocked(3, false), true, "referenced, no force -> blocked");
  assert.equal(isPurgeBlocked(3, true), false, "referenced, forced -> allowed");
  assert.equal(isPurgeBlocked(0, true), false, "no references, forced -> allowed");
});

// --- purge guard: reference relations per model --------------------------
test("purgeReferencesFor lists financial/medical relations, incl. SET NULL", () => {
  assert.deepEqual(purgeReferencesFor("Patient"), [
    { model: "treatmentRecord", fk: "patientId" },
    { model: "payment", fk: "patientId" },
  ]);
  assert.deepEqual(purgeReferencesFor("Doctor"), [
    { model: "treatmentDoctor", fk: "doctorId" },
    { model: "doctorPayout", fk: "doctorId" },
  ]);
  // SET NULL relations are still guarded: payments/procedures sever history.
  assert.deepEqual(purgeReferencesFor("TreatmentRecord"), [
    { model: "treatmentDoctor", fk: "treatmentRecordId" },
    { model: "payment", fk: "treatmentRecordId" },
  ]);
  assert.deepEqual(purgeReferencesFor("Procedure"), [{ model: "treatmentRecord", fk: "procedureId" }]);
  assert.deepEqual(purgeReferencesFor("Payment"), [], "leaf has no guard refs");
});

// --- purge guard: counts live AND trashed referencers --------------------
test("reference count includes trashed rows (deletedAt undefined opt-out)", async () => {
  const { tx } = makeTx({
    treatmentRecord: [
      { id: "t1", patientId: "p1" },                       // live
      { id: "t2", patientId: "p1", deletedAt: AT },         // trashed
      { id: "t3", patientId: "p9" },                        // other patient
    ],
    payment: [{ id: "pay1", patientId: "p1", deletedAt: EARLIER }],
  });
  // Mirror countPurgeReferences: sum over refs, deletedAt undefined = count all.
  let total = 0;
  for (const ref of purgeReferencesFor("Patient")) {
    total += await tx[ref.model].count({ where: { [ref.fk]: "p1", deletedAt: undefined } });
  }
  assert.equal(total, 3, "2 treatments (1 trashed) + 1 trashed payment");
});
