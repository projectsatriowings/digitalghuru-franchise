import { Router } from 'express';
import {
  listStaff,
  getNextEmployeeCodeHandler,
  createStaff,
  getStaffById,
  updateStaff,
  updateStaffStatus,
  assignStaffBatches,
  resetStaffPassword,
  uploadStaffPhoto,
  getStaffPhoto,
  getRawStaffPhoto,
  addStaffQualification,
  updateStaffQualification,
  deleteStaffQualification,
  addStaffExperience,
  updateStaffExperience,
  deleteStaffExperience,
  uploadStaffDocument,
  downloadStaffDocument,
  deleteStaffDocument,
} from './staff.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';
import { photoUpload, fileUpload } from '../../utils/storage.js';

const router = Router();

// Staff photo streaming (accessible to browser <img> tags without header requirements)
router.get('/photo-raw/:key', getRawStaffPhoto);
router.get('/:id/photo', getStaffPhoto);

// Authenticated endpoints
router.use(authenticateToken);
router.use(requireInstituteContext);

// Staff management endpoints (Academic Admin & Super Admin)
router.get('/', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), listStaff);
router.get('/next-code', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), getNextEmployeeCodeHandler);
router.post('/', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), createStaff);
router.get('/:id', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), getStaffById);
router.patch('/:id', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), updateStaff);
router.patch('/:id/status', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), updateStaffStatus);
router.post('/:id/assignments', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), assignStaffBatches);
router.post('/:id/reset-password', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), resetStaffPassword);

// Staff Photo Upload
router.post(
  '/upload-photo',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'),
  photoUpload.single('photo'),
  uploadStaffPhoto
);
router.post(
  '/:id/photo',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'),
  photoUpload.single('photo'),
  uploadStaffPhoto
);

// Qualifications
router.post('/:id/qualifications', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), addStaffQualification);
router.put('/:id/qualifications/:qid', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), updateStaffQualification);
router.delete('/:id/qualifications/:qid', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), deleteStaffQualification);

// Experiences
router.post('/:id/experiences', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), addStaffExperience);
router.put('/:id/experiences/:eid', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), updateStaffExperience);
router.delete('/:id/experiences/:eid', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), deleteStaffExperience);

// Documents
router.post(
  '/:id/documents',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'),
  fileUpload.single('file'),
  uploadStaffDocument
);
router.get(
  '/:id/documents/:docId/download',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'),
  downloadStaffDocument
);
router.delete(
  '/:id/documents/:docId',
  requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'),
  deleteStaffDocument
);

export default router;
