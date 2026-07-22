-- DB-01: Store all monetary values as fixed-precision NUMERIC instead of double
-- precision FLOAT. Float cannot represent decimal cents exactly (e.g. 0.1 + 0.2),
-- which drifts patient balances, doctor commissions and revenue over time.
-- NUMERIC(12,2) holds amounts up to 9,999,999,999.99; percentages use NUMERIC(5,2).
--
-- Existing values are rounded to 2 decimals on conversion (they were already
-- entered/displayed at 2 decimals, so this is loss-free in practice).

-- AlterTable: Procedure
ALTER TABLE "Procedure"
  ALTER COLUMN "price" TYPE NUMERIC(12,2) USING round("price"::numeric, 2),
  ALTER COLUMN "price" SET DEFAULT 0,
  ALTER COLUMN "cost" TYPE NUMERIC(12,2) USING round("cost"::numeric, 2);

-- AlterTable: TreatmentRecord
ALTER TABLE "TreatmentRecord"
  ALTER COLUMN "basePrice" TYPE NUMERIC(12,2) USING round("basePrice"::numeric, 2),
  ALTER COLUMN "discountPct" TYPE NUMERIC(5,2) USING round("discountPct"::numeric, 2),
  ALTER COLUMN "discountPct" SET DEFAULT 0,
  ALTER COLUMN "price" TYPE NUMERIC(12,2) USING round("price"::numeric, 2),
  ALTER COLUMN "price" SET DEFAULT 0,
  ALTER COLUMN "cost" TYPE NUMERIC(12,2) USING round("cost"::numeric, 2);

-- AlterTable: Payment
ALTER TABLE "Payment"
  ALTER COLUMN "amount" TYPE NUMERIC(12,2) USING round("amount"::numeric, 2),
  ALTER COLUMN "amount" SET DEFAULT 0;

-- AlterTable: Doctor
ALTER TABLE "Doctor"
  ALTER COLUMN "commissionPct" TYPE NUMERIC(5,2) USING round("commissionPct"::numeric, 2),
  ALTER COLUMN "commissionPct" SET DEFAULT 0;

-- AlterTable: TreatmentDoctor
ALTER TABLE "TreatmentDoctor"
  ALTER COLUMN "commissionPct" TYPE NUMERIC(5,2) USING round("commissionPct"::numeric, 2),
  ALTER COLUMN "commissionPct" SET DEFAULT 0,
  ALTER COLUMN "amount" TYPE NUMERIC(12,2) USING round("amount"::numeric, 2),
  ALTER COLUMN "amount" SET DEFAULT 0;

-- AlterTable: DoctorPayout
ALTER TABLE "DoctorPayout"
  ALTER COLUMN "amount" TYPE NUMERIC(12,2) USING round("amount"::numeric, 2),
  ALTER COLUMN "amount" SET DEFAULT 0;

-- AlterTable: ClinicExpense
ALTER TABLE "ClinicExpense"
  ALTER COLUMN "amount" TYPE NUMERIC(12,2) USING round("amount"::numeric, 2),
  ALTER COLUMN "amount" SET DEFAULT 0;

-- AlterTable: ClinicExpenseOverride
ALTER TABLE "ClinicExpenseOverride"
  ALTER COLUMN "amount" TYPE NUMERIC(12,2) USING round("amount"::numeric, 2),
  ALTER COLUMN "amount" SET DEFAULT 0;
