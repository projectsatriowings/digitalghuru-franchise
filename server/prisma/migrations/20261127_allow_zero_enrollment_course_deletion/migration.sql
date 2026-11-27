-- Drop duplicate legacy trigger that unconditionally blocked deleting curriculum versions
DROP TRIGGER IF EXISTS trg_check_curriculum_version_self_lock ON "CourseCurriculumVersion";
DROP FUNCTION IF EXISTS check_curriculum_version_self_lock();

-- Ensure fn_prevent_locked_curriculum_version_modification allows deletion when no student enrollments exist
CREATE OR REPLACE FUNCTION fn_prevent_locked_curriculum_version_modification()
RETURNS TRIGGER
SET search_path FROM CURRENT
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- Strictly forbid deleting if any student enrollments exist
    IF EXISTS (SELECT 1 FROM "CourseEnrollment" WHERE "curriculumVersionId" = OLD."id" LIMIT 1) THEN
      RAISE EXCEPTION 'Cannot delete curriculum version with active or historical student enrollments (id: %)', OLD."id"
        USING ERRCODE = '55000';
    END IF;
    IF EXISTS (SELECT 1 FROM "CourseEnrollment" WHERE "courseId" = OLD."courseId" LIMIT 1) THEN
      RAISE EXCEPTION 'Cannot delete curriculum version for course with student enrollments (courseId: %)', OLD."courseId"
        USING ERRCODE = '55000';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (OLD."isLocked" = TRUE OR OLD."isPublished" = TRUE) THEN
      IF NEW."isLocked" = FALSE AND OLD."isLocked" = TRUE THEN
        RAISE EXCEPTION 'Cannot unlock locked curriculum version'
          USING ERRCODE = '55000';
      END IF;
      IF NEW."isPublished" = FALSE AND OLD."isPublished" = TRUE THEN
        RAISE EXCEPTION 'Cannot unpublish published curriculum version'
          USING ERRCODE = '55000';
      END IF;
      IF OLD."courseId" <> NEW."courseId" THEN
        RAISE EXCEPTION 'Cannot change courseId on locked curriculum version'
          USING ERRCODE = '55000';
      END IF;
      IF OLD."version" <> NEW."version" THEN
        RAISE EXCEPTION 'Cannot change version number on locked curriculum version'
          USING ERRCODE = '55000';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
