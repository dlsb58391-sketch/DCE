-- AlterTable
ALTER TABLE "Procedure" ADD COLUMN     "cost" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "TreatmentRecord" ADD COLUMN     "cost" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "Doctor" (
    "id" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "specialtyEn" TEXT,
    "specialtyAr" TEXT,
    "photoUrl" TEXT,
    "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Doctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentDoctor" (
    "id" TEXT NOT NULL,
    "treatmentRecordId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentDoctor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicExpense" (
    "id" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'custom',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicExpenseOverride" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicExpenseOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Doctor_active_sortOrder_idx" ON "Doctor"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "TreatmentDoctor_doctorId_idx" ON "TreatmentDoctor"("doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentDoctor_treatmentRecordId_doctorId_key" ON "TreatmentDoctor"("treatmentRecordId", "doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicExpenseOverride_expenseId_monthKey_key" ON "ClinicExpenseOverride"("expenseId", "monthKey");

-- AddForeignKey
ALTER TABLE "TreatmentDoctor" ADD CONSTRAINT "TreatmentDoctor_treatmentRecordId_fkey" FOREIGN KEY ("treatmentRecordId") REFERENCES "TreatmentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentDoctor" ADD CONSTRAINT "TreatmentDoctor_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicExpenseOverride" ADD CONSTRAINT "ClinicExpenseOverride_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "ClinicExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
