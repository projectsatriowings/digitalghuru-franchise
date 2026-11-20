"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const attendance_controller_js_1 = require("./attendance.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticateToken);
router.use(auth_js_1.requireInstituteContext);
// Summary & Reporting
router.get('/summary', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), attendance_controller_js_1.getAttendanceSummary);
router.get('/reports', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), attendance_controller_js_1.getAttendanceReports);
// Check-in & Check-out actions (Staff & Admins)
// Voice Matching & Smart Search
router.post('/voice-match', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), attendance_controller_js_1.voiceMatchStudents);
router.get('/voice-match', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), attendance_controller_js_1.voiceMatchStudents);
// Check-in & Check-out actions (Staff & Admins)
router.post('/check-in', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), attendance_controller_js_1.recordCheckIn);
router.post('/check-out', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), attendance_controller_js_1.recordCheckOut);
// QR Attendance actions
router.get('/students/:studentId/qr', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), attendance_controller_js_1.getStudentQrPass);
router.post('/qr/scan', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), attendance_controller_js_1.validateScannedQr);
// Corrections
router.patch('/:eventId/correction', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), attendance_controller_js_1.correctAttendanceEvent);
exports.default = router;
