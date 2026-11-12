-- ============================================================================
-- DIGITAL GURU FRANCHISE — REMEDIATION MIGRATION SCRIPT
-- Migration: 20261112_remediation
-- Description: Enforces ON DELETE RESTRICT on historical records, adds composite
--              integrity constraints, enrollment mode validation, progress bounds,
--              chapter-course hierarchy validation, and redesigned curriculum
--              immutability triggers (SQLSTATE 55000).
-- ============================================================================

-- 1. FOREIGN KEY REMEDIATION: HISTORICAL DATA RETENTION (ON DELETE RESTRICT)
-- ----------------------------------------------------------------------------
-- CourseCertificate -> Student
ALTER TABLE "CourseCertificate"
  DROP CONSTRAINT IF EXISTS "CourseCertificate_studentId_fkey",
  ADD CONSTRAINT "CourseCertificate_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CourseEnrollment -> Student
ALTER TABLE "CourseEnrollment"
  DROP CONSTRAINT IF EXISTS "CourseEnrollment_studentId_fkey",
  ADD CONSTRAINT "CourseEnrollment_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- StudentLessonProgress -> Student
ALTER TABLE "StudentLessonProgress"
  DROP CONSTRAINT IF EXISTS "StudentLessonProgress_studentId_fkey",
  ADD CONSTRAINT "StudentLessonProgress_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- StudentLessonProgress -> CourseChapter
ALTER TABLE "StudentLessonProgress"
  DROP CONSTRAINT IF EXISTS "StudentLessonProgress_chapterId_fkey",
  ADD CONSTRAINT "StudentLessonProgress_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "CourseChapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- StudentLessonProgress -> GlobalCourse
ALTER TABLE "StudentLessonProgress"
  DROP CONSTRAINT IF EXISTS "StudentLessonProgress_courseId_fkey",
  ADD CONSTRAINT "StudentLessonProgress_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "GlobalCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- StudentXpLedger -> Student
ALTER TABLE "StudentXpLedger"
  DROP CONSTRAINT IF EXISTS "StudentXpLedger_studentId_fkey",
  ADD CONSTRAINT "StudentXpLedger_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CourseCurriculumVersion -> GlobalCourse
ALTER TABLE "CourseCurriculumVersion"
  DROP CONSTRAINT IF EXISTS "CourseCurriculumVersion_courseId_fkey",
  ADD CONSTRAINT "CourseCurriculumVersion_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "GlobalCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CourseChapter -> CourseModule
ALTER TABLE "CourseChapter"
  DROP CONSTRAINT IF EXISTS "CourseChapter_moduleId_fkey",
  ADD CONSTRAINT "CourseChapter_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- LessonAttachment -> CourseChapter
ALTER TABLE "LessonAttachment"
  DROP CONSTRAINT IF EXISTS "LessonAttachment_chapterId_fkey",
  ADD CONSTRAINT "LessonAttachment_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "CourseChapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FranchiseCourseSelection -> Franchise
ALTER TABLE "FranchiseCourseSelection"
  DROP CONSTRAINT IF EXISTS "FranchiseCourseSelection_franchiseId_fkey",
  ADD CONSTRAINT "FranchiseCourseSelection_franchiseId_fkey"
    FOREIGN KEY ("franchiseId") REFERENCES "Franchise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FranchiseCourseSelection -> GlobalCourse
ALTER TABLE "FranchiseCourseSelection"
  DROP CONSTRAINT IF EXISTS "FranchiseCourseSelection_courseId_fkey",
  ADD CONSTRAINT "FranchiseCourseSelection_courseId_fkey"
    FOREIGN KEY ("courseId") REFERENCES "GlobalCourse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- 2. COMPOSITE INTEGRITY & ENROLLMENT RULES
-- ----------------------------------------------------------------------------
-- Composite FK: CourseEnrollment must reference an authorized FranchiseCourseSelection
ALTER TABLE "CourseEnrollment"
  DROP CONSTRAINT IF EXISTS "fk_enrollment_franchise_course_selection",
  ADD CONSTRAINT "fk_enrollment_franchise_course_selection"
    FOREIGN KEY ("franchiseId", "courseId")
    REFERENCES "FranchiseCourseSelection"("franchiseId", "courseId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial Unique Index: Only 1 ACTIVE enrollment per student, course, and mode
CREATE UNIQUE INDEX IF NOT EXISTS "uq_active_student_course_mode"
  ON "CourseEnrollment"("studentId", "courseId", "mode")
  WHERE "status" = 'ACTIVE';

-- Check Constraint: ONLINE must have null institute/batch; OFFLINE must have both
ALTER TABLE "CourseEnrollment"
  DROP CONSTRAINT IF EXISTS "chk_enrollment_mode_rules",
  ADD CONSTRAINT "chk_enrollment_mode_rules"
    CHECK (
      ("mode" = 'ONLINE' AND "instituteId" IS NULL AND "batchId" IS NULL) OR
      ("mode" = 'OFFLINE' AND "instituteId" IS NOT NULL AND "batchId" IS NOT NULL)
    );

-- Check Constraint: Progress must be between 0 and 100
ALTER TABLE "CourseEnrollment"
  DROP CONSTRAINT IF EXISTS "chk_course_progress_percentage",
  ADD CONSTRAINT "chk_course_progress_percentage"
    CHECK ("progress" >= 0 AND "progress" <= 100);


-- 3. CHAPTER-COURSE HIERARCHY VALIDATION TRIGGER & CERTIFICATE SEQUENCE
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS "course_certificate_seq" START WITH 1 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION validate_lesson_progress_course()
RETURNS TRIGGER
SET search_path FROM CURRENT
AS $$
DECLARE
  v_expected_course_id TEXT;
BEGIN
  SELECT ccv."courseId" INTO v_expected_course_id
  FROM "CourseChapter" cc
  JOIN "CourseModule" cm ON cc."moduleId" = cm."id"
  JOIN "CourseCurriculumVersion" ccv ON cm."curriculumVersionId" = ccv."id"
  WHERE cc."id" = NEW."chapterId";

  IF v_expected_course_id IS NULL OR v_expected_course_id <> NEW."courseId" THEN
    RAISE EXCEPTION 'Foreign key integrity violation: Chapter % does not belong to Course %',
      NEW."chapterId", NEW."courseId"
      USING ERRCODE = '23503';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_lesson_progress_course ON "StudentLessonProgress";
CREATE TRIGGER trg_validate_lesson_progress_course
  BEFORE INSERT OR UPDATE OF "courseId", "chapterId" ON "StudentLessonProgress"
  FOR EACH ROW
  EXECUTE FUNCTION validate_lesson_progress_course();


-- 4. CURRICULUM IMMUTABILITY TRIGGERS (SQLSTATE 55000)
-- ----------------------------------------------------------------------------
-- Trigger Function for CourseCurriculumVersion self-lock
CREATE OR REPLACE FUNCTION fn_prevent_locked_curriculum_version_modification()
RETURNS TRIGGER
SET search_path FROM CURRENT
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."isLocked" = TRUE OR OLD."isPublished" = TRUE THEN
      RAISE EXCEPTION 'Cannot delete locked or published curriculum version (id: %)', OLD."id"
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (OLD."isLocked" = TRUE OR OLD."isPublished" = TRUE) THEN
      -- If previously locked/published, prevent unlocking or unpublishing
      IF NEW."isLocked" = FALSE AND OLD."isLocked" = TRUE THEN
        RAISE EXCEPTION 'Cannot unlock locked curriculum version'
          USING ERRCODE = '55000';
      END IF;
      IF NEW."isPublished" = FALSE AND OLD."isPublished" = TRUE THEN
        RAISE EXCEPTION 'Cannot unpublish published curriculum version'
          USING ERRCODE = '55000';
      END IF;
      -- Prevent modifying courseId
      IF OLD."courseId" <> NEW."courseId" THEN
        RAISE EXCEPTION 'Cannot change courseId on locked curriculum version'
          USING ERRCODE = '55000';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_course_curriculum_version ON "CourseCurriculumVersion";
CREATE TRIGGER trg_lock_course_curriculum_version
  BEFORE UPDATE OR DELETE ON "CourseCurriculumVersion"
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_locked_curriculum_version_modification();

-- Trigger Function for CourseModule
CREATE OR REPLACE FUNCTION fn_prevent_locked_module_modification()
RETURNS TRIGGER
SET search_path FROM CURRENT
AS $$
DECLARE
  v_old_locked BOOLEAN;
  v_new_locked BOOLEAN;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT ("isLocked" OR "isPublished") INTO v_old_locked
    FROM "CourseCurriculumVersion"
    WHERE "id" = OLD."curriculumVersionId";

    IF v_old_locked = TRUE THEN
      RAISE EXCEPTION 'Cannot modify or delete module in locked curriculum version'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT ("isLocked" OR "isPublished") INTO v_new_locked
    FROM "CourseCurriculumVersion"
    WHERE "id" = NEW."curriculumVersionId";

    IF v_new_locked = TRUE THEN
      RAISE EXCEPTION 'Cannot insert or reparent module into locked curriculum version'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_course_module ON "CourseModule";
CREATE TRIGGER trg_lock_course_module
  BEFORE INSERT OR UPDATE OR DELETE ON "CourseModule"
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_locked_module_modification();

-- Trigger Function for CourseChapter
CREATE OR REPLACE FUNCTION fn_prevent_locked_chapter_modification()
RETURNS TRIGGER
SET search_path FROM CURRENT
AS $$
DECLARE
  v_old_locked BOOLEAN;
  v_new_locked BOOLEAN;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT (ccv."isLocked" OR ccv."isPublished") INTO v_old_locked
    FROM "CourseModule" cm
    JOIN "CourseCurriculumVersion" ccv ON cm."curriculumVersionId" = ccv."id"
    WHERE cm."id" = OLD."moduleId";

    IF v_old_locked = TRUE THEN
      RAISE EXCEPTION 'Cannot modify or delete chapter in locked curriculum version'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT (ccv."isLocked" OR ccv."isPublished") INTO v_new_locked
    FROM "CourseModule" cm
    JOIN "CourseCurriculumVersion" ccv ON cm."curriculumVersionId" = ccv."id"
    WHERE cm."id" = NEW."moduleId";

    IF v_new_locked = TRUE THEN
      RAISE EXCEPTION 'Cannot insert or reparent chapter into locked curriculum version'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_course_chapter ON "CourseChapter";
CREATE TRIGGER trg_lock_course_chapter
  BEFORE INSERT OR UPDATE OR DELETE ON "CourseChapter"
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_locked_chapter_modification();

-- Trigger Function for LessonAttachment
CREATE OR REPLACE FUNCTION fn_prevent_locked_attachment_modification()
RETURNS TRIGGER
SET search_path FROM CURRENT
AS $$
DECLARE
  v_old_locked BOOLEAN;
  v_new_locked BOOLEAN;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    SELECT (ccv."isLocked" OR ccv."isPublished") INTO v_old_locked
    FROM "CourseChapter" cc
    JOIN "CourseModule" cm ON cc."moduleId" = cm."id"
    JOIN "CourseCurriculumVersion" ccv ON cm."curriculumVersionId" = ccv."id"
    WHERE cc."id" = OLD."chapterId";

    IF v_old_locked = TRUE THEN
      RAISE EXCEPTION 'Cannot modify or delete attachment in locked curriculum version'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    SELECT (ccv."isLocked" OR ccv."isPublished") INTO v_new_locked
    FROM "CourseChapter" cc
    JOIN "CourseModule" cm ON cc."moduleId" = cm."id"
    JOIN "CourseCurriculumVersion" ccv ON cm."curriculumVersionId" = ccv."id"
    WHERE cc."id" = NEW."chapterId";

    IF v_new_locked = TRUE THEN
      RAISE EXCEPTION 'Cannot insert or reparent attachment into locked curriculum version'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lock_lesson_attachment ON "LessonAttachment";
CREATE TRIGGER trg_lock_lesson_attachment
  BEFORE INSERT OR UPDATE OR DELETE ON "LessonAttachment"
  FOR EACH ROW
  EXECUTE FUNCTION fn_prevent_locked_attachment_modification();
