import { Router } from 'express';
import {
  createExam,
  updateExam,
  listExams,
  getExamById,
  getExamEligibleStudents,
  enterExamMarks,
  publishExamSchedule,
  publishExamResults,
  toggleExamPublish,
  deleteExam,
  getStudentReportCard,
} from './exams.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';
import { fileUpload } from '../../utils/storage.js';

const router = Router();

router.use(authenticateToken);
router.use(requireInstituteContext);

router.get('/', listExams);
router.post(
  '/',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  fileUpload.single('file'),
  createExam
);
router.get('/:id', getExamById);
router.patch(
  '/:id',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  fileUpload.single('file'),
  updateExam
);
router.delete(
  '/:id',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  deleteExam
);
router.get(
  '/:id/eligible-students',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  getExamEligibleStudents
);
router.post(
  '/:id/marks',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  enterExamMarks
);
router.patch(
  '/:id/publish-schedule',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  publishExamSchedule
);
router.patch(
  '/:id/publish-results',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  publishExamResults
);
router.patch(
  '/:id/publish',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  toggleExamPublish
);
router.get(
  '/students/:studentId/report-card',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'),
  getStudentReportCard
);

export default router;
