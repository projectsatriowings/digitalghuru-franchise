"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const academics_controller_js_1 = require("./academics.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticateToken);
router.use(auth_js_1.requireInstituteContext);
// Staff helper for dropdown assignment
router.get('/staff', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.listInstituteStaff);
// Batch endpoints
router.get('/batches', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), academics_controller_js_1.listBatches);
router.get('/batches/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.getBatchDetails);
router.post('/batches', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.createBatch);
router.put('/batches/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.updateBatch);
router.patch('/batches/:id/status', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.toggleBatchStatus);
router.delete('/batches/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.deleteBatch);
// Batch Curriculum (Subjects)
router.post('/batches/:id/subjects', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.assignSubjectsToBatch);
router.put('/batches/:id/subjects/:subjectId', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.updateBatchSubject);
router.delete('/batches/:id/subjects/:subjectId', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.removeSubjectFromBatch);
// Batch Staff Faculty
router.post('/batches/:id/staff', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.assignStaffToBatch);
router.delete('/batches/:id/staff/:staffProfileId', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.removeStaffFromBatch);
// Batch Student Enrollment & Roster
router.post('/batches/:id/enroll', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.enrollStudentInBatch);
router.delete('/batches/:id/enroll/:studentId', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.unenrollStudentFromBatch);
// Batch Student Subject Allocations
router.get('/batches/:id/students/:studentId/subjects', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.getStudentSubjectAllocations);
router.post('/batches/:id/students/:studentId/subjects', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.allocateStudentSubjects);
// Subject endpoints
router.get('/subjects', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), academics_controller_js_1.listSubjects);
router.post('/subjects', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.createSubject);
router.put('/subjects/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.updateSubject);
router.delete('/subjects/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), academics_controller_js_1.deleteSubject);
exports.default = router;
