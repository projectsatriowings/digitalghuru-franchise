import { Router } from 'express';
import {
  createHomework,
  listHomework,
  submitHomework,
  getSubmissions,
  gradeSubmission,
  downloadSubmission,
} from './homework.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';
import { fileUpload } from '../../utils/storage.js';

const router = Router();

router.use(authenticateToken);
router.use(requireInstituteContext);

router.get('/', listHomework);
router.post(
  '/',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  fileUpload.single('file'),
  createHomework
);
router.post(
  '/:id/submissions',
  requireRole('STUDENT'),
  fileUpload.single('file'),
  submitHomework
);
router.get(
  '/:id/submissions',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  getSubmissions
);
router.patch(
  '/submissions/:submissionId/grade',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  gradeSubmission
);
router.get(
  '/submissions/:submissionId/download',
  downloadSubmission
);

export default router;
