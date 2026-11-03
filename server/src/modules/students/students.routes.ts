import { Router } from 'express';
import {
  listStudents,
  admitStudent,
  getAdmissionPrefixInfo,
  getStudentById,
  getMyStudentProfile,
  updateStudent,
  updateStudentStatus,
  updateStudentAccountStatus,
  resetStudentPassword,
  updateStudentLoginIdentifier,
  uploadStudentPhoto,
  getStudentPhoto,
  getRawPhoto,
  lookupParent,
  assignStudentBatch,
  lookupExistingStudent,
  enrollExistingStudent,
} from './students.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';
import { fileUpload, photoUpload } from '../../utils/storage.js';

const handlePhotoUpload = (req: any, res: any, next: any) => {
  photoUpload.single('photo')(req, res, (err: any) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'Photo file size exceeds maximum limit of 5MB' });
      }
      return res.status(400).json({ success: false, error: err.message || 'Invalid photo file upload' });
    }
    next();
  });
};

const router = Router();

router.use(authenticateToken);

// Photograph streaming routes (accessible via <img> tags with query token ?token=...)
router.get('/:id/photo', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), getStudentPhoto);
router.get('/photo-raw/:key', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), getRawPhoto);

router.use(requireInstituteContext);

// Student management routes
router.get('/admission-prefix', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), getAdmissionPrefixInfo);
router.get('/lookup', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), lookupExistingStudent);
router.get('/lookup-parent', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), lookupParent);
router.get('/my/profile', requireRole('STUDENT'), getMyStudentProfile);
router.get('/', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), listStudents);
router.post('/', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), admitStudent);
router.post('/:id/enroll', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), enrollExistingStudent);

// Photograph upload routes
router.post('/upload-photo', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), handlePhotoUpload, uploadStudentPhoto);
router.post('/:id/photo', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), handlePhotoUpload, uploadStudentPhoto);

router.get('/:id', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), getStudentById);
router.patch('/:id', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), updateStudent);
router.put('/:id', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), updateStudent);
router.put('/:id/batch-assignment', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), assignStudentBatch);
router.patch('/:id/status', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), updateStudentStatus);

import {
  allocateStudentSubjects,
  getStudentSubjectAllocations,
} from '../academics/academics.controller.js';

// Student Subject Allocations
router.get('/:id/subject-allocations', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), getStudentSubjectAllocations);
router.post('/:id/subject-allocations', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), allocateStudentSubjects);

// Student credential management routes
router.post('/:id/reset-password', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), resetStudentPassword);
router.patch('/:id/account-identifier', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), updateStudentLoginIdentifier);
router.patch('/:id/account-status', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), updateStudentAccountStatus);

export default router;

