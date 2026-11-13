import { Router } from 'express';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listGlobalCourses,
  createGlobalCourse,
  getGlobalCourseById,
  updateGlobalCourse,
  updateDraftChapter,
  replaceDraftCurriculum,
  publishGlobalCourse,
  createCourseDraftVersion,
  updateGlobalCourseStatus,
  deleteGlobalCourse,
  getMyFranchiseCourseContext,
  listFranchiseCourses,
  listFranchiseEnrollments,
  setFranchiseCoursePermission,
  bulkSetFranchisePermissions,
  toggleFranchiseCourseSelection,
  enrollStudentInCourse,
  transferStudentEnrollment,
  listStudentCourseEnrollments,
  getMyLearningDashboard,
  getStudentCoursePlayer,
  completeLesson,
  claimCourseCertificate,
  verifyCourseCertificate,
  listStudentCertificates,
  uploadCourseMedia,
  streamPublicMedia,
  streamProtectedMedia,
  generateMediaTokenController,
} from './courses.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import { courseMediaUpload, isPublicCourseFolder, isProtectedCourseFolder } from '../../utils/storage.js';

const router = Router();

// -------------------------------------------------------------
// 1. MEDIA ASSETS & STREAMING (PHASE 1.1.2 HARDENING)
// -------------------------------------------------------------
// Short-lived media token generator (requires user login)
router.post('/media-token', authenticateToken, generateMediaTokenController);

// Scoped media streaming
router.get('/media/public/:folder/:filename', streamPublicMedia);
router.get('/media/protected/:folder/:filename', streamProtectedMedia);

// Legacy media route with strict scoped routing (no fallback across scopes)
router.get('/media/:folder/:filename', (req, res) => {
  const { folder } = req.params;
  if (isPublicCourseFolder(folder)) {
    return streamPublicMedia(req, res);
  }
  if (isProtectedCourseFolder(folder)) {
    return streamProtectedMedia(req, res);
  }
  return res.status(404).json({ success: false, message: 'Unrecognized media folder partition' });
});

router.post(
  '/upload',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  courseMediaUpload.single('file'),
  uploadCourseMedia
);

// -------------------------------------------------------------
// 2. COURSE CATEGORY ENDPOINTS
// -------------------------------------------------------------
router.get('/categories', authenticateToken, listCategories);
router.post('/categories', authenticateToken, requireRole('SUPER_ADMIN'), createCategory);
router.patch('/categories/:id', authenticateToken, requireRole('SUPER_ADMIN'), updateCategory);
router.delete('/categories/:id', authenticateToken, requireRole('SUPER_ADMIN'), deleteCategory);

// -------------------------------------------------------------
// 3. STUDENT LEARNING PLAYER & XP (ONLINE & OFFLINE LMS ACCESS)
// -------------------------------------------------------------
router.get('/learning/my-dashboard', authenticateToken, getMyLearningDashboard);
router.get('/learning/:courseId', authenticateToken, getStudentCoursePlayer);
router.post('/learning/complete-lesson', authenticateToken, completeLesson);

// -------------------------------------------------------------
// 4. CERTIFICATES & VERIFICATION
// -------------------------------------------------------------
router.post('/certificates/claim', authenticateToken, claimCourseCertificate);
router.get('/certificates/verify/:certificateNumber', verifyCourseCertificate);
router.get('/students/:studentId/certificates', authenticateToken, listStudentCertificates);

// -------------------------------------------------------------
// 5. FRANCHISE OFFERINGS & COURSE SELECTION
// -------------------------------------------------------------
router.get(
  '/my-franchise-context',
  authenticateToken,
  requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN'),
  getMyFranchiseCourseContext
);

router.get(
  '/franchise/:franchiseId',
  authenticateToken,
  requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN'),
  listFranchiseCourses
);

router.get(
  '/franchise/:franchiseId/enrollments',
  authenticateToken,
  requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN'),
  listFranchiseEnrollments
);

router.post(
  '/franchise/:franchiseId/permit',
  authenticateToken,
  requireRole('SUPER_ADMIN'),
  setFranchiseCoursePermission
);

router.post(
  '/franchise/:franchiseId/select',
  authenticateToken,
  requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'),
  toggleFranchiseCourseSelection
);

// -------------------------------------------------------------
// 6. STUDENT COURSE ENROLLMENTS & TRANSFERS
// -------------------------------------------------------------
router.post(
  '/enroll',
  authenticateToken,
  requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN'),
  enrollStudentInCourse
);

router.post(
  '/enrollments/:enrollmentId/transfer',
  authenticateToken,
  requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN'),
  transferStudentEnrollment
);

router.get(
  '/students/:studentId/enrollments',
  authenticateToken,
  listStudentCourseEnrollments
);

// -------------------------------------------------------------
// 7. GLOBAL COURSE CATALOGUE & AUTHORING (SUPER ADMIN)
// -------------------------------------------------------------
router.patch('/chapters/:chapterId', authenticateToken, requireRole('SUPER_ADMIN'), updateDraftChapter);
router.put('/:id/versions/:versionId/curriculum', authenticateToken, requireRole('SUPER_ADMIN'), replaceDraftCurriculum);
router.post('/:id/franchise-permissions', authenticateToken, requireRole('SUPER_ADMIN'), bulkSetFranchisePermissions);
router.get('/', authenticateToken, listGlobalCourses);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN'), createGlobalCourse);
router.get('/:id', authenticateToken, getGlobalCourseById);
router.patch('/:id', authenticateToken, requireRole('SUPER_ADMIN'), updateGlobalCourse);
router.post('/:id/publish', authenticateToken, requireRole('SUPER_ADMIN'), publishGlobalCourse);
router.post('/:id/versions', authenticateToken, requireRole('SUPER_ADMIN'), createCourseDraftVersion);
router.patch('/:id/status', authenticateToken, requireRole('SUPER_ADMIN'), updateGlobalCourseStatus);
router.delete('/:id', authenticateToken, requireRole('SUPER_ADMIN'), deleteGlobalCourse);

export default router;
