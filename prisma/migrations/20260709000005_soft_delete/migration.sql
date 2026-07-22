-- Sprint 6 (s6a-schema): soft-delete support. Adds a nullable "deletedAt"
-- timestamp (non-null => the row is hidden from all normal queries and lives in
-- the Recycle Bin) and "deletedBy" (User.id snapshot of who soft-deleted it) to
-- every financially/medically sensitive model.
--
-- Purely ADDITIVE and NON-DESTRUCTIVE: no existing column, row, or constraint is
-- touched; both columns default to NULL, so every existing row is "not deleted"
-- and current behavior is unchanged until a DELETE route sets them.
--
-- Cascade parity: TreatmentDoctor gets the columns too so that soft-deleting a
-- treatment or a doctor can hide the commission-split rows exactly as today's
-- ON DELETE CASCADE removes them (keeps all financial roll-ups identical).
--
-- No index is added: the common filter is "deletedAt IS NULL" (matches almost
-- every row), which an index would not help; the rare Recycle-Bin scan
-- ("deletedAt IS NOT NULL") runs on admin-only pages over small result sets.
-- Revisit if a Trash listing ever becomes hot.
--
-- Reversible: ALTER TABLE "<Table>" DROP COLUMN IF EXISTS "deletedAt", DROP
-- COLUMN IF EXISTS "deletedBy"; for each table below.

ALTER TABLE "Patient"         ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "Procedure"       ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "TreatmentRecord" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "Payment"         ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "PatientFile"     ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "Doctor"          ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "TreatmentDoctor" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "DoctorPayout"    ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
ALTER TABLE "ClinicExpense"   ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3), ADD COLUMN IF NOT EXISTS "deletedBy" TEXT;
