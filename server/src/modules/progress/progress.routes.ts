import { Router } from 'express';
import {
  createFeedback,
  listProgressFeedback,
  getStudentFeedback,
  getMetricsPreview,
  updateFeedback,
  publishFeedback,
  deleteFeedback,
} from './progress.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(requireInstituteContext);

router.get(
  '/',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'),
  listProgressFeedback
);

router.get(
  '/metrics-preview',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  getMetricsPreview
);

router.post(
  '/',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  createFeedback
);

router.get(
  '/students/:studentId',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'),
  getStudentFeedback
);

router.patch(
  '/:id',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  updateFeedback
);

router.patch(
  '/:id/publish',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  publishFeedback
);

router.delete(
  '/:id',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  deleteFeedback
);

export default router;
