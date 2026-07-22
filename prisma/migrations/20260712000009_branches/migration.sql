-- Sprint 12: Multi-Branch foundation (Phase 1). Adds one table (Branch) and an
-- OPTIONAL "branchId" foreign key to every operational/financial + staff table so
-- one clinic can run several physical locations from a single database.
--
-- Purely ADDITIVE and NON-DESTRUCTIVE:
--   * The only new table is "Branch".
--   * "branchId" is added as a NULLABLE column (no NOT NULL, no default) to nine
--     tables; three tables (InventoryBatch, StockMovement, PurchaseOrder) already
--     carried a reserved, FK-less "branchId String?" column from earlier sprints,
--     so they are only given the FK constraint + index here (no ADD COLUMN).
--   * All existing rows are backfilled to a single seeded default branch
--     ("branch_main") so nothing is left dangling, but the column stays nullable —
--     new writes are NOT yet stamped in this phase, so behaviour is unchanged.
--   * Every FK is ON DELETE SET NULL: removing a branch never deletes its records,
--     it only unassigns them. No existing column, row, index, or constraint is
--     dropped or altered.
--
-- Reversible (dev only):
--   ALTER TABLE "Appointment"     DROP COLUMN "branchId"; -- (and the 8 other new cols)
--   ALTER TABLE "InventoryBatch"  DROP CONSTRAINT "InventoryBatch_branchId_fkey"; -- (+ StockMovement, PurchaseOrder)
--   DROP TABLE "Branch";

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_active_sortOrder_idx" ON "Branch"("active", "sortOrder");

-- Seed the default branch. Idempotent: prisma/seed.mjs also upserts this row, but
-- creating it here guarantees the backfill below has a valid FK target on first deploy.
INSERT INTO "Branch" ("id", "nameEn", "nameAr", "code", "active", "sortOrder", "createdAt", "updatedAt")
VALUES ('branch_main', 'Main Branch', 'الفرع الرئيسي', 'MAIN', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- AddColumn: nine tables gain a new nullable branchId. (InventoryBatch,
-- StockMovement and PurchaseOrder already have the column and are skipped here.)
ALTER TABLE "User" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "branchId" TEXT;
ALTER TABLE "TreatmentRecord" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Doctor" ADD COLUMN "branchId" TEXT;
ALTER TABLE "DoctorPayout" ADD COLUMN "branchId" TEXT;
ALTER TABLE "ClinicExpense" ADD COLUMN "branchId" TEXT;
ALTER TABLE "InventoryItem" ADD COLUMN "branchId" TEXT;
ALTER TABLE "Prescription" ADD COLUMN "branchId" TEXT;

-- Backfill: assign every existing scoped row to the default branch. Left nullable
-- so future rows may legitimately be unassigned until Phase 2 stamps them.
UPDATE "User" SET "branchId" = 'branch_main' WHERE "branchId" IS NULL;
UPDATE "Appointment" SET "branchId" = 'branch_main' WHERE "branchId" IS NULL;
UPDATE "TreatmentRecord" SET "branchId" = 'branch_main' WHERE "branchId" IS NULL;
UPDATE "Payment" SET "branchId" = 'branch_main' WHERE "branchId" IS NULL;
UPDATE "Doctor" SET "branchId" = 'branch_main' WHERE "branchId" IS NULL;
UPDATE "DoctorPayout" SET "branchId" = 'branch_main' WHERE "branchId" IS NULL;
UPDATE "ClinicExpense" SET "branchId" = 'branch_main' WHERE "branchId" IS NULL;
UPDATE "InventoryItem" SET "branchId" = 'branch_main' WHERE "branchId" IS NULL;
UPDATE "Prescription" SET "branchId" = 'branch_main' WHERE "branchId" IS NULL;
UPDATE "InventoryBatch" SET "branchId" = 'branch_main' WHERE "branchId" IS NULL;
UPDATE "StockMovement" SET "branchId" = 'branch_main' WHERE "branchId" IS NULL;
UPDATE "PurchaseOrder" SET "branchId" = 'branch_main' WHERE "branchId" IS NULL;

-- CreateIndex: one index per branchId column (all twelve tables).
CREATE INDEX "User_branchId_idx" ON "User"("branchId");
CREATE INDEX "Appointment_branchId_idx" ON "Appointment"("branchId");
CREATE INDEX "TreatmentRecord_branchId_idx" ON "TreatmentRecord"("branchId");
CREATE INDEX "Payment_branchId_idx" ON "Payment"("branchId");
CREATE INDEX "Doctor_branchId_idx" ON "Doctor"("branchId");
CREATE INDEX "DoctorPayout_branchId_idx" ON "DoctorPayout"("branchId");
CREATE INDEX "ClinicExpense_branchId_idx" ON "ClinicExpense"("branchId");
CREATE INDEX "InventoryItem_branchId_idx" ON "InventoryItem"("branchId");
CREATE INDEX "Prescription_branchId_idx" ON "Prescription"("branchId");
CREATE INDEX "InventoryBatch_branchId_idx" ON "InventoryBatch"("branchId");
CREATE INDEX "StockMovement_branchId_idx" ON "StockMovement"("branchId");
CREATE INDEX "PurchaseOrder_branchId_idx" ON "PurchaseOrder"("branchId");

-- AddForeignKey: all twelve branchId columns reference Branch(id) ON DELETE SET NULL.
ALTER TABLE "User" ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TreatmentRecord" ADD CONSTRAINT "TreatmentRecord_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DoctorPayout" ADD CONSTRAINT "DoctorPayout_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicExpense" ADD CONSTRAINT "ClinicExpense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
