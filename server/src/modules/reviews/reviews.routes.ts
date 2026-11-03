import { Router } from 'express';
import {
  createReview,
  listReviews,
  replyToReview,
  updateReviewStatus,
} from './reviews.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(requireInstituteContext);

router.post('/', requireRole('PARENT'), createReview);
router.get('/', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), listReviews);
router.patch('/:id/reply', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), replyToReview);
router.patch('/:id/status', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), updateReviewStatus);

export default router;
