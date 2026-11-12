-- ============================================================================
-- DIGITAL GURU FRANCHISE — GLOBAL COURSE GOVERNANCE MIGRATION
-- Migration: 20261113_course_governance
-- Description: Adds Super Admin course permission controls on
--              FranchiseCourseSelection (isPermitted, permittedAt, permittedById)
--              so franchises can only enable and enroll students in courses
--              explicitly permitted by Super Admin.
-- ============================================================================

ALTER TABLE "FranchiseCourseSelection"
  ADD COLUMN IF NOT EXISTS "isPermitted" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "permittedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "permittedById" TEXT;

UPDATE "FranchiseCourseSelection"
SET "permittedAt" = COALESCE("permittedAt", "selectedAt")
WHERE "isPermitted" = true AND "permittedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "FranchiseCourseSelection_franchiseId_isPermitted_isEnabled_idx"
  ON "FranchiseCourseSelection"("franchiseId", "isPermitted", "isEnabled");

