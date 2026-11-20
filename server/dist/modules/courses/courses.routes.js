"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const courses_controller_js_1 = require("./courses.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const storage_js_1 = require("../../utils/storage.js");
const router = (0, express_1.Router)();
// -------------------------------------------------------------
// 1. MEDIA ASSETS & STREAMING (PHASE 1.1.2 HARDENING)
// -------------------------------------------------------------
// Short-lived media token generator (requires user login)
router.post('/media-token', auth_js_1.authenticateToken, courses_controller_js_1.generateMediaTokenController);
// Scoped media streaming
router.get('/media/public/:folder/:filename', courses_controller_js_1.streamPublicMedia);
router.get('/media/protected/:folder/:filename', courses_controller_js_1.streamProtectedMedia);
// Legacy media route with strict scoped routing (no fallback across scopes)
router.get('/media/:folder/:filename', (req, res) => {
    const { folder } = req.params;
    if ((0, storage_js_1.isPublicCourseFolder)(folder)) {
        return (0, courses_controller_js_1.streamPublicMedia)(req, res);
    }
    if ((0, storage_js_1.isProtectedCourseFolder)(folder)) {
        return (0, courses_controller_js_1.streamProtectedMedia)(req, res);
    }
    return res.status(404).json({ success: false, message: 'Unrecognized media folder partition' });
});
router.post('/upload', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), storage_js_1.courseMediaUpload.single('file'), courses_controller_js_1.uploadCourseMedia);
// -------------------------------------------------------------
// 2. COURSE CATEGORY ENDPOINTS
// -------------------------------------------------------------
router.get('/categories', auth_js_1.authenticateToken, courses_controller_js_1.listCategories);
router.post('/categories', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), courses_controller_js_1.createCategory);
router.patch('/categories/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), courses_controller_js_1.updateCategory);
router.delete('/categories/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), courses_controller_js_1.deleteCategory);
// -------------------------------------------------------------
// 3. STUDENT LEARNING PLAYER & XP (ONLINE & OFFLINE LMS ACCESS)
// -------------------------------------------------------------
router.get('/learning/my-dashboard', auth_js_1.authenticateToken, courses_controller_js_1.getMyLearningDashboard);
router.get('/learning/:courseId', auth_js_1.authenticateToken, courses_controller_js_1.getStudentCoursePlayer);
router.post('/learning/complete-lesson', auth_js_1.authenticateToken, courses_controller_js_1.completeLesson);
// -------------------------------------------------------------
// 4. CERTIFICATES & VERIFICATION
// -------------------------------------------------------------
router.post('/certificates/claim', auth_js_1.authenticateToken, courses_controller_js_1.claimCourseCertificate);
router.get('/certificates/verify/:certificateNumber', courses_controller_js_1.verifyCourseCertificate);
router.get('/students/:studentId/certificates', auth_js_1.authenticateToken, courses_controller_js_1.listStudentCertificates);
// -------------------------------------------------------------
// 5. FRANCHISE OFFERINGS & COURSE SELECTION
// -------------------------------------------------------------
router.get('/my-franchise-context', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN'), courses_controller_js_1.getMyFranchiseCourseContext);
router.get('/franchise/:franchiseId', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN'), courses_controller_js_1.listFranchiseCourses);
router.get('/franchise/:franchiseId/enrollments', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN'), courses_controller_js_1.listFranchiseEnrollments);
router.post('/franchise/:franchiseId/permit', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), courses_controller_js_1.setFranchiseCoursePermission);
router.post('/franchise/:franchiseId/select', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), courses_controller_js_1.toggleFranchiseCourseSelection);
// -------------------------------------------------------------
// 6. STUDENT COURSE ENROLLMENTS & TRANSFERS
// -------------------------------------------------------------
router.post('/enroll', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN'), courses_controller_js_1.enrollStudentInCourse);
router.post('/enrollments/:enrollmentId/transfer', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN'), courses_controller_js_1.transferStudentEnrollment);
router.get('/students/:studentId/enrollments', auth_js_1.authenticateToken, courses_controller_js_1.listStudentCourseEnrollments);
// -------------------------------------------------------------
// 7. GLOBAL COURSE CATALOGUE & AUTHORING (SUPER ADMIN)
// -------------------------------------------------------------
router.patch('/chapters/:chapterId', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), courses_controller_js_1.updateDraftChapter);
router.put('/:id/versions/:versionId/curriculum', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), courses_controller_js_1.replaceDraftCurriculum);
router.get('/:id/franchise-matrix', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), courses_controller_js_1.getCourseFranchiseMatrix);
router.post('/:id/franchise-permissions', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), courses_controller_js_1.bulkSetFranchisePermissions);
router.get('/', auth_js_1.authenticateToken, courses_controller_js_1.listGlobalCourses);
router.post('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), courses_controller_js_1.createGlobalCourse);
router.get('/:id', auth_js_1.authenticateToken, courses_controller_js_1.getGlobalCourseById);
router.patch('/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), courses_controller_js_1.updateGlobalCourse);
router.post('/:id/publish', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), courses_controller_js_1.publishGlobalCourse);
router.post('/:id/versions', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), courses_controller_js_1.createCourseDraftVersion);
router.patch('/:id/status', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), courses_controller_js_1.updateGlobalCourseStatus);
router.delete('/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), courses_controller_js_1.deleteGlobalCourse);
exports.default = router;
