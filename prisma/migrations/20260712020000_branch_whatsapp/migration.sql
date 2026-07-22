-- Sprint 14: Multi-Branch Phase 3 (branch-scoped operations).
-- Adds ONE optional column so each branch can store its own WhatsApp contact
-- number (shown in the branch card and used to route the booking bot's new
-- appointments to the branch that owns the linked number).
--
-- Purely ADDITIVE and NON-DESTRUCTIVE:
--   * "whatsappNumber" is a NULLABLE TEXT column with no default; existing rows
--     stay NULL and every current query keeps working unchanged.
--   * No column, row, index, or constraint is dropped or altered.
--
-- The "which branch the bot books into" pointer is stored in the existing
-- key/value "Setting" table (key = 'whatsapp.branchId'), so it needs no schema
-- change here.
--
-- Reversible (dev only):
--   ALTER TABLE "Branch" DROP COLUMN "whatsappNumber";

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN "whatsappNumber" TEXT;
