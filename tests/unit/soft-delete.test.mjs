// Mirror tests for the pure soft-delete helpers in src/lib/server/soft-delete.ts.
// The module imports `@prisma/client` (for the extension), so it can't be loaded
// from a plain .mjs; following the repo convention the pure logic is re-declared
// and asserted here. This guards the exact scoping + cascade rules that keep
// soft-deleted rows hidden and financial roll-ups identical to a hard delete.

import { test } from "node:test";
import assert from "node:assert/strict";

// --- mirrors of soft-delete.ts -------------------------------------------
const SOFT_DELETABLE_MODELS = new Set([
  "Patient", "Procedure", "TreatmentRecord", "Payment", "PatientFile",
  "Doctor", "TreatmentDoctor", "DoctorPayout", "ClinicExpense",
]);
const SCOPED_READ_OPS = new Set([
  "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy",
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

const isSoftDeletableModel = (m) => !!m && SOFT_DELETABLE_MODELS.has(m);
const shouldScope = (m, op) => isSoftDeletableModel(m) && SCOPED_READ_OPS.has(op);
function scopeWhere(where) {
  if (where && typeof where === "object" && Object.prototype.hasOwnProperty.call(where, "deletedAt")) return where;
  const base = where && typeof where === "object" ? where : {};
  return { ...base, deletedAt: null };
}
function scopeArgs(args) {
  const a = args && typeof args === "object" ? { ...args } : {};
  a.where = scopeWhere(a.where);
  return a;
}
const cascadeChildrenFor = (m) => SOFT_DELETE_CASCADE[m] ?? [];

// --- shouldScope ----------------------------------------------------------
test("shouldScope: soft-deletable model + list/aggregate op scopes", () => {
  for (const op of ["findFirst", "findMany", "count", "aggregate", "groupBy", "findFirstOrThrow"]) {
    assert.equal(shouldScope("Patient", op), true, `${op} should scope`);
  }
});

test("shouldScope: findUnique/findUniqueOrThrow are NOT scoped", () => {
  // Prisma forbids non-unique fields in findUnique where; these stay explicit.
  assert.equal(shouldScope("Patient", "findUnique"), false);
  assert.equal(shouldScope("Patient", "findUniqueOrThrow"), false);
});

test("shouldScope: write ops are NOT scoped", () => {
  for (const op of ["update", "updateMany", "delete", "deleteMany", "create", "upsert"]) {
    assert.equal(shouldScope("Payment", op), false, `${op} must not scope`);
  }
});

test("shouldScope: non-soft-deletable models are never scoped", () => {
  for (const m of ["User", "Appointment", "Message", "AuditLog", "Setting", "WaOutbox"]) {
    assert.equal(shouldScope(m, "findMany"), false, `${m} must not scope`);
  }
  assert.equal(shouldScope(undefined, "findMany"), false);
  assert.equal(shouldScope(null, "findMany"), false);
});

// --- scopeWhere -----------------------------------------------------------
test("scopeWhere: empty/undefined yields the live-rows filter", () => {
  assert.deepEqual(scopeWhere(undefined), { deletedAt: null });
  assert.deepEqual(scopeWhere({}), { deletedAt: null });
});

test("scopeWhere: preserves existing conditions and adds the filter", () => {
  assert.deepEqual(scopeWhere({ patientId: "p1" }), { patientId: "p1", deletedAt: null });
  assert.deepEqual(scopeWhere({ OR: [{ a: 1 }, { b: 2 }] }), { OR: [{ a: 1 }, { b: 2 }], deletedAt: null });
});

test("scopeWhere: caller that set deletedAt opts out (Recycle Bin / restore)", () => {
  const trash = { deletedAt: { not: null } };
  assert.equal(scopeWhere(trash), trash); // returned unchanged (same reference)
  const explicitLive = { deletedAt: null, doctorId: "d1" };
  assert.equal(scopeWhere(explicitLive), explicitLive);
});

test("scopeWhere: does not mutate the input object", () => {
  const input = { patientId: "p1" };
  scopeWhere(input);
  assert.deepEqual(input, { patientId: "p1" });
});

// --- scopeArgs ------------------------------------------------------------
test("scopeArgs: undefined args become a scoped where", () => {
  assert.deepEqual(scopeArgs(undefined), { where: { deletedAt: null } });
});

test("scopeArgs: preserves select/orderBy/take and scopes where", () => {
  const out = scopeArgs({ where: { doctorId: "d1" }, select: { id: true }, orderBy: { createdAt: "desc" }, take: 5 });
  assert.deepEqual(out, {
    where: { doctorId: "d1", deletedAt: null },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
});

// --- cascadeChildrenFor ---------------------------------------------------
test("cascadeChildrenFor: patient cascades to treatments + payments", () => {
  assert.deepEqual(cascadeChildrenFor("Patient"), [
    { model: "treatmentRecord", fk: "patientId" },
    { model: "payment", fk: "patientId" },
  ]);
});

test("cascadeChildrenFor: treatment cascades to commission splits only", () => {
  assert.deepEqual(cascadeChildrenFor("TreatmentRecord"), [{ model: "treatmentDoctor", fk: "treatmentRecordId" }]);
});

test("cascadeChildrenFor: doctor cascades to splits + payouts", () => {
  assert.deepEqual(cascadeChildrenFor("Doctor"), [
    { model: "treatmentDoctor", fk: "doctorId" },
    { model: "doctorPayout", fk: "doctorId" },
  ]);
});

test("cascadeChildrenFor: leaf entities cascade to nothing", () => {
  for (const m of ["Payment", "Procedure", "PatientFile", "DoctorPayout", "ClinicExpense", "TreatmentDoctor"]) {
    assert.deepEqual(cascadeChildrenFor(m), [], `${m} has no cascade`);
  }
});
