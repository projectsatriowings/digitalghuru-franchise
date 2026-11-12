-- ============================================================================
-- DIGITAL GURU FRANCHISE — STUDENT ALPHA FORENSIC RESTORATION SCRIPT
-- Target Database: Dedicated Digital Guru Franchise Neon PostgreSQL database
-- Script: server/scripts/remediation_recover_student_a210001.sql
--
-- Objective: Restore authentic institute association for UAT Student Alpha
--            without guesswork, based on immutable AuditLog and Batch evidence.
--
-- Authentic Institute: 8a90b546-0a9e-42fd-a60b-ec17aafbcd87 (Alpha Anna Nagar Campus, BR-ANN-0269)
-- Mutated Institute:   94aaa68f-1318-4b67-9617-634b2773d92e (Digital Guru Anna Nagar Campus, DG-ANN-5438)
-- ============================================================================

BEGIN;

-- 1. VERIFY PRE-CONDITIONS
DO $$
DECLARE
  v_current_inst_id TEXT;
  v_student_name TEXT;
BEGIN
  SELECT "instituteId", ("firstName" || ' ' || "lastName") INTO v_current_inst_id, v_student_name
  FROM "Student"
  WHERE "id" = '257efe60-93f8-417e-abf6-69b27ac2b6f1' AND "admissionNumber" = 'A210001';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target student A210001 (257efe60-93f8-417e-abf6-69b27ac2b6f1) not found!';
  END IF;

  RAISE NOTICE 'Found Student: % (Current Institute: %)', v_student_name, v_current_inst_id;
END $$;

-- 2. APPLY RESTORATION UPDATE
UPDATE "Student"
SET
  "instituteId" = '8a90b546-0a9e-42fd-a60b-ec17aafbcd87',
  "updatedAt" = NOW()
WHERE
  "id" = '257efe60-93f8-417e-abf6-69b27ac2b6f1'
  AND "admissionNumber" = 'A210001';

-- 3. RECORD AUDIT LOG ENTRY
INSERT INTO "AuditLog" (
  "id",
  "instituteId",
  "userId",
  "action",
  "entityType",
  "entityId",
  "oldValues",
  "newValues",
  "createdAt"
) VALUES (
  gen_random_uuid()::text,
  '8a90b546-0a9e-42fd-a60b-ec17aafbcd87',
  NULL,
  'RESTORE_INSTITUTE_ASSOCIATION',
  'Student',
  '257efe60-93f8-417e-abf6-69b27ac2b6f1',
  jsonb_build_object('instituteId', '94aaa68f-1318-4b67-9617-634b2773d92e', 'reason', 'Milestone 2 premature test script mutation'),
  jsonb_build_object('instituteId', '8a90b546-0a9e-42fd-a60b-ec17aafbcd87', 'actor', 'system-remediation', 'evidence', 'AuditLog 065e9ee8-0f1b-4d94-8ecb-0fbe77a3dfa0 & Batch Enrollment c0d076c5-9a5c-4291-8723-83da6e684359'),
  NOW()
);

-- 4. VERIFY POST-CONDITIONS
DO $$
DECLARE
  v_verified_inst_id TEXT;
  v_inst_name TEXT;
  v_inst_code TEXT;
BEGIN
  SELECT s."instituteId", i."name", i."code"
  INTO v_verified_inst_id, v_inst_name, v_inst_code
  FROM "Student" s
  JOIN "Institute" i ON s."instituteId" = i."id"
  WHERE s."id" = '257efe60-93f8-417e-abf6-69b27ac2b6f1';

  IF v_verified_inst_id <> '8a90b546-0a9e-42fd-a60b-ec17aafbcd87' THEN
    RAISE EXCEPTION 'Restoration failed! Verified institute % does not match target 8a90b546-0a9e-42fd-a60b-ec17aafbcd87', v_verified_inst_id;
  END IF;

  RAISE NOTICE 'Restoration SUCCESSFUL! Student A210001 restored to % (Code: %)', v_inst_name, v_inst_code;
END $$;

COMMIT;

