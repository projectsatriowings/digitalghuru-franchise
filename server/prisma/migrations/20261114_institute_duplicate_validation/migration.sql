-- ============================================================================
-- DIGITAL GURU FRANCHISE — INSTITUTE EMAIL UNIQUE INDEX MIGRATION
-- Migration: 20261114_institute_duplicate_validation
-- Description: Adds a functional case-insensitive partial unique index on
--              Institute (LOWER(TRIM(email))) where email is non-empty.
-- Safety: Requires prior resolution/remediation of historical duplicate emails.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS "Institute_email_normalized_unique_idx"
  ON "Institute" (LOWER(TRIM("email")))
  WHERE "email" IS NOT NULL AND TRIM("email") <> '';

