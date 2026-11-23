"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const staff_controller_js_1 = require("./staff.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const storage_js_1 = require("../../utils/storage.js");
const router = (0, express_1.Router)();
// Staff photo streaming (accessible to browser <img> tags without header requirements)
router.get('/photo-raw/:key', staff_controller_js_1.getRawStaffPhoto);
router.get('/:id/photo', staff_controller_js_1.getStaffPhoto);
// Authenticated endpoints
router.use(auth_js_1.authenticateToken);
router.use(auth_js_1.requireInstituteContext);
// Staff management endpoints (Academic Admin & Super Admin)
router.get('/', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_controller_js_1.listStaff);
router.get('/next-code', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_controller_js_1.getNextEmployeeCodeHandler);
router.post('/', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_controller_js_1.createStaff);
// Teacher Mobile Portal Endpoints
router.get('/my/profile', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), staff_controller_js_1.getMyStaffProfile);
router.get('/my/dashboard', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), staff_controller_js_1.getMyStaffDashboard);
router.get('/my/timetable', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), staff_controller_js_1.getMyStaffTimetable);
router.get('/my/students', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), staff_controller_js_1.getMyStaffStudents);
router.get('/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), staff_controller_js_1.getStaffById);
router.patch('/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_controller_js_1.updateStaff);
router.patch('/:id/status', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_controller_js_1.updateStaffStatus);
router.post('/:id/assignments', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_controller_js_1.assignStaffBatches);
router.post('/:id/reset-password', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_controller_js_1.resetStaffPassword);
// Staff Photo Upload
router.post('/upload-photo', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), storage_js_1.photoUpload.single('photo'), staff_controller_js_1.uploadStaffPhoto);
router.post('/:id/photo', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), storage_js_1.photoUpload.single('photo'), staff_controller_js_1.uploadStaffPhoto);
// Qualifications
router.post('/:id/qualifications', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_controller_js_1.addStaffQualification);
router.put('/:id/qualifications/:qid', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_controller_js_1.updateStaffQualification);
router.delete('/:id/qualifications/:qid', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_controller_js_1.deleteStaffQualification);
// Experiences
router.post('/:id/experiences', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_controller_js_1.addStaffExperience);
router.put('/:id/experiences/:eid', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_controller_js_1.updateStaffExperience);
router.delete('/:id/experiences/:eid', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_controller_js_1.deleteStaffExperience);
// Documents
router.post('/:id/documents', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), storage_js_1.fileUpload.single('file'), staff_controller_js_1.uploadStaffDocument);
router.get('/:id/documents/:docId/download', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), staff_controller_js_1.downloadStaffDocument);
router.delete('/:id/documents/:docId', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_controller_js_1.deleteStaffDocument);
exports.default = router;
