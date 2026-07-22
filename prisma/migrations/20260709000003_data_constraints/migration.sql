-- Sprint 3 (s3-constraints): domain CHECK constraints for data integrity.
--
-- These guard the database against invalid values that the application layer
-- already rejects/normalizes (non-negative money, percentages within 0-100,
-- known appointment statuses and payment methods). They are a defence-in-depth
-- backstop against bad writes from future code paths, manual SQL, or bugs.
--
-- Prisma cannot express CHECK constraints declaratively, so they are authored
-- here in raw SQL. Prisma leaves unknown CHECK constraints untouched on later
-- `migrate dev`/`migrate deploy`, so this is safe and additive.
--
-- Enum columns are compared with lower(...) so historical case drift cannot
-- fail the migration. Each constraint is dropped-if-exists first so the
-- migration is safely re-runnable. NULLs pass CHECK constraints automatically,
-- so nullable columns (cost, basePrice) need no explicit "IS NULL" guard.
--
-- Reversible: run the matching "DROP CONSTRAINT IF EXISTS" statements below the
-- fence at the bottom of this file to fully roll back.

-- Procedure -----------------------------------------------------------------
ALTER TABLE "Procedure" DROP CONSTRAINT IF EXISTS "Procedure_price_nonneg";
ALTER TABLE "Procedure" ADD  CONSTRAINT "Procedure_price_nonneg" CHECK ("price" >= 0);
ALTER TABLE "Procedure" DROP CONSTRAINT IF EXISTS "Procedure_cost_nonneg";
ALTER TABLE "Procedure" ADD  CONSTRAINT "Procedure_cost_nonneg" CHECK ("cost" >= 0);

-- TreatmentRecord -----------------------------------------------------------
ALTER TABLE "TreatmentRecord" DROP CONSTRAINT IF EXISTS "TreatmentRecord_basePrice_nonneg";
ALTER TABLE "TreatmentRecord" ADD  CONSTRAINT "TreatmentRecord_basePrice_nonneg" CHECK ("basePrice" >= 0);
ALTER TABLE "TreatmentRecord" DROP CONSTRAINT IF EXISTS "TreatmentRecord_price_nonneg";
ALTER TABLE "TreatmentRecord" ADD  CONSTRAINT "TreatmentRecord_price_nonneg" CHECK ("price" >= 0);
ALTER TABLE "TreatmentRecord" DROP CONSTRAINT IF EXISTS "TreatmentRecord_cost_nonneg";
ALTER TABLE "TreatmentRecord" ADD  CONSTRAINT "TreatmentRecord_cost_nonneg" CHECK ("cost" >= 0);
ALTER TABLE "TreatmentRecord" DROP CONSTRAINT IF EXISTS "TreatmentRecord_discountPct_range";
ALTER TABLE "TreatmentRecord" ADD  CONSTRAINT "TreatmentRecord_discountPct_range" CHECK ("discountPct" >= 0 AND "discountPct" <= 100);

-- Payment -------------------------------------------------------------------
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_amount_nonneg";
ALTER TABLE "Payment" ADD  CONSTRAINT "Payment_amount_nonneg" CHECK ("amount" >= 0);
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_method_valid";
ALTER TABLE "Payment" ADD  CONSTRAINT "Payment_method_valid" CHECK (lower("method") IN ('cash', 'card', 'insurance', 'transfer'));

-- Appointment ---------------------------------------------------------------
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_durationMin_nonneg";
ALTER TABLE "Appointment" ADD  CONSTRAINT "Appointment_durationMin_nonneg" CHECK ("durationMin" >= 0);
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_status_valid";
ALTER TABLE "Appointment" ADD  CONSTRAINT "Appointment_status_valid" CHECK (lower("status") IN ('pending', 'confirmed', 'declined', 'completed', 'cancelled'));

-- Doctor --------------------------------------------------------------------
ALTER TABLE "Doctor" DROP CONSTRAINT IF EXISTS "Doctor_commissionPct_range";
ALTER TABLE "Doctor" ADD  CONSTRAINT "Doctor_commissionPct_range" CHECK ("commissionPct" >= 0 AND "commissionPct" <= 100);

-- TreatmentDoctor -----------------------------------------------------------
ALTER TABLE "TreatmentDoctor" DROP CONSTRAINT IF EXISTS "TreatmentDoctor_commissionPct_range";
ALTER TABLE "TreatmentDoctor" ADD  CONSTRAINT "TreatmentDoctor_commissionPct_range" CHECK ("commissionPct" >= 0 AND "commissionPct" <= 100);
ALTER TABLE "TreatmentDoctor" DROP CONSTRAINT IF EXISTS "TreatmentDoctor_amount_nonneg";
ALTER TABLE "TreatmentDoctor" ADD  CONSTRAINT "TreatmentDoctor_amount_nonneg" CHECK ("amount" >= 0);

-- DoctorPayout --------------------------------------------------------------
ALTER TABLE "DoctorPayout" DROP CONSTRAINT IF EXISTS "DoctorPayout_amount_nonneg";
ALTER TABLE "DoctorPayout" ADD  CONSTRAINT "DoctorPayout_amount_nonneg" CHECK ("amount" >= 0);
ALTER TABLE "DoctorPayout" DROP CONSTRAINT IF EXISTS "DoctorPayout_method_valid";
ALTER TABLE "DoctorPayout" ADD  CONSTRAINT "DoctorPayout_method_valid" CHECK (lower("method") IN ('cash', 'card', 'transfer', 'other'));

-- ClinicExpense -------------------------------------------------------------
ALTER TABLE "ClinicExpense" DROP CONSTRAINT IF EXISTS "ClinicExpense_amount_nonneg";
ALTER TABLE "ClinicExpense" ADD  CONSTRAINT "ClinicExpense_amount_nonneg" CHECK ("amount" >= 0);

-- ClinicExpenseOverride -----------------------------------------------------
ALTER TABLE "ClinicExpenseOverride" DROP CONSTRAINT IF EXISTS "ClinicExpenseOverride_amount_nonneg";
ALTER TABLE "ClinicExpenseOverride" ADD  CONSTRAINT "ClinicExpenseOverride_amount_nonneg" CHECK ("amount" >= 0);

-- ===========================================================================
-- ROLLBACK (reversible): execute the block below to remove every constraint.
-- ===========================================================================
-- ALTER TABLE "Procedure" DROP CONSTRAINT IF EXISTS "Procedure_price_nonneg";
-- ALTER TABLE "Procedure" DROP CONSTRAINT IF EXISTS "Procedure_cost_nonneg";
-- ALTER TABLE "TreatmentRecord" DROP CONSTRAINT IF EXISTS "TreatmentRecord_basePrice_nonneg";
-- ALTER TABLE "TreatmentRecord" DROP CONSTRAINT IF EXISTS "TreatmentRecord_price_nonneg";
-- ALTER TABLE "TreatmentRecord" DROP CONSTRAINT IF EXISTS "TreatmentRecord_cost_nonneg";
-- ALTER TABLE "TreatmentRecord" DROP CONSTRAINT IF EXISTS "TreatmentRecord_discountPct_range";
-- ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_amount_nonneg";
-- ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_method_valid";
-- ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_durationMin_nonneg";
-- ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_status_valid";
-- ALTER TABLE "Doctor" DROP CONSTRAINT IF EXISTS "Doctor_commissionPct_range";
-- ALTER TABLE "TreatmentDoctor" DROP CONSTRAINT IF EXISTS "TreatmentDoctor_commissionPct_range";
-- ALTER TABLE "TreatmentDoctor" DROP CONSTRAINT IF EXISTS "TreatmentDoctor_amount_nonneg";
-- ALTER TABLE "DoctorPayout" DROP CONSTRAINT IF EXISTS "DoctorPayout_amount_nonneg";
-- ALTER TABLE "DoctorPayout" DROP CONSTRAINT IF EXISTS "DoctorPayout_method_valid";
-- ALTER TABLE "ClinicExpense" DROP CONSTRAINT IF EXISTS "ClinicExpense_amount_nonneg";
-- ALTER TABLE "ClinicExpenseOverride" DROP CONSTRAINT IF EXISTS "ClinicExpenseOverride_amount_nonneg";
