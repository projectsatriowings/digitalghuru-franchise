import { Router } from 'express';
import {
  listRecordedSessions,
  createRecordedSession,
  deleteRecordedSession,
  uploadSessionVideo,
} from './recorded-sessions.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { courseMediaUpload } from '../../utils/storage.js';

const router = Router();

// List recorded sessions (Students, Parents, Trainers, Admins, Franchise Owners)
router.get('/', authenticateToken, listRecordedSessions);

// Direct video file upload from the system
router.post(
  '/upload',
  authenticateToken,
  requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'BRANCH_ADMIN', 'STAFF'),
  courseMediaUpload.single('file'),
  uploadSessionVideo
);

// Create / Publish a recorded session (via direct link or uploaded video URL)
router.post(
  '/',
  authenticateToken,
  requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'BRANCH_ADMIN', 'STAFF'),
  createRecordedSession
);

// Delete a recorded session
router.delete(
  '/:id',
  authenticateToken,
  requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'BRANCH_ADMIN', 'STAFF'),
  deleteRecordedSession
);

export default router;
