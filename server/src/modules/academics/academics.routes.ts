import { Router } from 'express';
import {
  listBatches,
  getBatchDetails,
  createBatch,
  updateBatch,
  toggleBatchStatus,
  deleteBatch,
  assignSubjectsToBatch,
  updateBatchSubject,
  removeSubjectFromBatch,
  assignStaffToBatch,
  removeStaffFromBatch,
  enrollStudentInBatch,
  unenrollStudentFromBatch,
  allocateStudentSubjects,
  getStudentSubjectAllocations,
  listInstituteStaff,
  listSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} from './academics.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(requireInstituteContext);

// Staff helper for dropdown assignment
router.get('/staff', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), listInstituteStaff);

// Batch endpoints
router.get('/batches', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), listBatches);
router.get('/batches/:id', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), getBatchDetails);
router.post('/batches', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), createBatch);
router.put('/batches/:id', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), updateBatch);
router.patch('/batches/:id/status', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), toggleBatchStatus);
router.delete('/batches/:id', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), deleteBatch);

// Batch Curriculum (Subjects)
router.post('/batches/:id/subjects', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), assignSubjectsToBatch);
router.put('/batches/:id/subjects/:subjectId', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), updateBatchSubject);
router.delete('/batches/:id/subjects/:subjectId', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), removeSubjectFromBatch);

// Batch Staff Faculty
router.post('/batches/:id/staff', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), assignStaffToBatch);
router.delete('/batches/:id/staff/:staffProfileId', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), removeStaffFromBatch);

// Batch Student Enrollment & Roster
router.post('/batches/:id/enroll', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), enrollStudentInBatch);
router.delete('/batches/:id/enroll/:studentId', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), unenrollStudentFromBatch);

// Batch Student Subject Allocations
router.get('/batches/:id/students/:studentId/subjects', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), getStudentSubjectAllocations);
router.post('/batches/:id/students/:studentId/subjects', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), allocateStudentSubjects);

// Subject endpoints
router.get('/subjects', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), listSubjects);
router.post('/subjects', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), createSubject);
router.put('/subjects/:id', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), updateSubject);
router.delete('/subjects/:id', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), deleteSubject);

export default router;
