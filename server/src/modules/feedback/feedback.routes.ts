import { Router } from 'express';
import {
  submitFeedback,
  listFeedback,
  getFeedbackById,
  respondToFeedback,
  updateFeedbackStatus,
} from './feedback.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';

const router = Router();

// All feedback operations require authenticated user & institute context
router.use(authenticateToken);
router.use(requireInstituteContext);

// Submit feedback (Parents)
router.post('/', requireRole('PARENT'), submitFeedback);

// List feedback (Parents see own children; Staff sees assigned; Admins see institute)
router.get('/', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT'), listFeedback);

// Get single feedback item
router.get('/:id', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT'), getFeedbackById);

// Respond to feedback (Teachers / Admins)
router.post('/:id/respond', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), respondToFeedback);
router.patch('/:id/respond', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), respondToFeedback);

// Update status (e.g. resolve)
router.patch('/:id/status', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT'), updateFeedbackStatus);

export default router;

