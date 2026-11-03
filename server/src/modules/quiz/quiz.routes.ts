import { Router } from 'express';
import {
  listQuizzes,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
  startQuizAttempt,
  submitQuizAttempt,
  getQuizSubmissions,
} from './quiz.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(requireInstituteContext);

router.get('/', listQuizzes);
router.post(
  '/',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  createQuiz
);
router.get('/:id', getQuizById);
router.patch(
  '/:id',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  updateQuiz
);
router.delete(
  '/:id',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  deleteQuiz
);

// Student Quiz Attempt Routes
router.post(
  '/:id/start',
  requireRole('STUDENT'),
  startQuizAttempt
);
router.post(
  '/:id/submit',
  requireRole('STUDENT'),
  submitQuizAttempt
);

// Staff / Admin Submissions Analytics
router.get(
  '/:id/submissions',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  getQuizSubmissions
);

export default router;

