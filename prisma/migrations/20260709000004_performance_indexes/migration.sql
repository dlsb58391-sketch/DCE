-- Sprint 3 (s3-indexes): add indexes on unindexed foreign keys and a hot
-- sort/filter column. These target real query paths in the app:
--
--   * TreatmentRecord.procedureId   - joined/filtered when listing a procedure's
--                                      usage and set-null on procedure delete.
--   * Payment.treatmentRecordId     - aggregated per treatment (paid-so-far) and
--                                      set-null on treatment delete.
--   * Appointment.patientId         - patient timelines and bulk detach on
--                                      patient delete (updateMany where patientId).
--   * Appointment.scheduledAt       - calendar/day range scans and ORDER BY.
--
-- Only genuinely missing indexes are added; columns already covered by an
-- existing @@index (e.g. Appointment(status, scheduledAt), Payment(patientId,
-- paidAt), TreatmentRecord(patientId, performedAt)) are intentionally left
-- alone to avoid redundant indexes and write amplification.
--
-- Index names match Prisma's default @@index naming so schema.prisma and the
-- database stay in sync (no drift). IF NOT EXISTS keeps the migration
-- re-runnable.
--
-- Note: these run inside Prisma's migration transaction (no CONCURRENTLY). The
-- brief ACCESS SHARE/lock is negligible at expected table sizes; for very large
-- existing tables, create them out-of-band with CREATE INDEX CONCURRENTLY.
--
-- Reversible: DROP INDEX IF EXISTS "<name>"; for each index below.

CREATE INDEX IF NOT EXISTS "TreatmentRecord_procedureId_idx" ON "TreatmentRecord"("procedureId");
CREATE INDEX IF NOT EXISTS "Payment_treatmentRecordId_idx" ON "Payment"("treatmentRecordId");
CREATE INDEX IF NOT EXISTS "Appointment_patientId_idx" ON "Appointment"("patientId");
CREATE INDEX IF NOT EXISTS "Appointment_scheduledAt_idx" ON "Appointment"("scheduledAt");
