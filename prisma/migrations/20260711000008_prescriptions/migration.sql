-- Sprint: Electronic Prescriptions. Adds three tables: Medication (clinic
-- medication library / catalog), Prescription (header) and PrescriptionItem
-- (line items).
--
-- Purely ADDITIVE and NON-DESTRUCTIVE: no existing table, column, row, index or
-- constraint is touched. The only foreign keys point at the new tables or at
-- existing tables via the NEW columns on Prescription (patientId CASCADE,
-- doctorId SET NULL), so this migration cannot affect existing data or behavior.
--
-- Design notes:
--   * Prescription -> Patient is CASCADE: purging a patient removes their
--     prescriptions (matching TreatmentRecord/Payment). Prescription -> Doctor is
--     SET NULL so removing a doctor keeps prescription history (doctorName is
--     snapshotted). patientName/doctorName are snapshots for a stable printout.
--   * PrescriptionItem -> Prescription is CASCADE (lines are part of the
--     document). PrescriptionItem -> Medication is SET NULL so deleting a catalog
--     medication keeps issued prescriptions intact (name/strength/form are
--     snapshotted into the line at issue time).
--   * "appointmentId" is a soft link (nullable, no FK) mirroring
--     TreatmentRecord.appointmentId.
--
-- Reversible:
--   DROP TABLE IF EXISTS "PrescriptionItem", "Prescription", "Medication";

-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "form" TEXT,
    "strength" TEXT,
    "route" TEXT,
    "defaultDosage" TEXT,
    "defaultFrequency" TEXT,
    "defaultDurationDays" INTEGER,
    "defaultInstructions" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "patientName" TEXT NOT NULL,
    "doctorId" TEXT,
    "doctorName" TEXT,
    "appointmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "diagnosis" TEXT,
    "notes" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionItem" (
    "id" TEXT NOT NULL,
    "prescriptionId" TEXT NOT NULL,
    "medicationId" TEXT,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "strength" TEXT,
    "form" TEXT,
    "dosage" TEXT,
    "frequency" TEXT,
    "durationDays" INTEGER,
    "quantity" TEXT,
    "refills" INTEGER NOT NULL DEFAULT 0,
    "instructions" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prescription_code_key" ON "Prescription"("code");

-- CreateIndex
CREATE INDEX "Medication_active_sortOrder_idx" ON "Medication"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "Prescription_patientId_issuedAt_idx" ON "Prescription"("patientId", "issuedAt");

-- CreateIndex
CREATE INDEX "Prescription_doctorId_idx" ON "Prescription"("doctorId");

-- CreateIndex
CREATE INDEX "Prescription_status_issuedAt_idx" ON "Prescription"("status", "issuedAt");

-- CreateIndex
CREATE INDEX "PrescriptionItem_prescriptionId_idx" ON "PrescriptionItem"("prescriptionId");

-- CreateIndex
CREATE INDEX "PrescriptionItem_medicationId_idx" ON "PrescriptionItem"("medicationId");

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionItem" ADD CONSTRAINT "PrescriptionItem_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
