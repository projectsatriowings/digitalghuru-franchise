"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const staff_attendance_controller_js_1 = require("./staff-attendance.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const router = (0, express_1.Router)();
// Apply base authentication and institute context across all staff attendance routes
router.use(auth_js_1.authenticateToken);
router.use(auth_js_1.requireInstituteContext);
// 1. Institute Location & Geofence Configuration
router.get('/config', staff_attendance_controller_js_1.getInstituteAttendanceConfig);
router.put('/config', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_attendance_controller_js_1.updateInstituteAttendanceConfig);
// 2. Staff Check-In / Check-Out & Personal History
router.get('/today', (0, auth_js_1.requireRole)('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), staff_attendance_controller_js_1.getStaffTodayStatus);
router.post('/check-in', (0, auth_js_1.requireRole)('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), staff_attendance_controller_js_1.staffCheckIn);
router.post('/check-out', (0, auth_js_1.requireRole)('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), staff_attendance_controller_js_1.staffCheckOut);
router.get('/my-history', (0, auth_js_1.requireRole)('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), staff_attendance_controller_js_1.getStaffPersonalHistory);
// 3. Work From Home (WFH) Staff Routes
router.get('/wfh/eligibility', (0, auth_js_1.requireRole)('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), staff_attendance_controller_js_1.getStaffWfhEligibility);
router.post('/wfh/request', (0, auth_js_1.requireRole)('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), staff_attendance_controller_js_1.submitStaffWfhRequest);
router.get('/wfh/my-requests', (0, auth_js_1.requireRole)('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), staff_attendance_controller_js_1.getStaffMyWfhRequests);
router.get('/wfh/online-classes', (0, auth_js_1.requireRole)('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), staff_attendance_controller_js_1.getStaffOnlineClassesHandler);
router.post('/wfh/online-classes/:batchSubjectId/status', (0, auth_js_1.requireRole)('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), staff_attendance_controller_js_1.updateOnlineClassStatusHandler);
// 4. Work From Home (WFH) Admin Routes
router.get('/wfh/admin/metrics', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_attendance_controller_js_1.getAdminWfhMetricsHandler);
router.get('/wfh/admin/authorizations', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_attendance_controller_js_1.getAdminWfhAuthorizations);
router.post('/wfh/admin/authorizations', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_attendance_controller_js_1.createAdminWfhAuthorization);
router.post('/wfh/admin/authorizations/:id/approve', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_attendance_controller_js_1.approveWfhRequestHandler);
router.post('/wfh/admin/authorizations/:id/reject', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_attendance_controller_js_1.rejectWfhRequestHandler);
router.post('/wfh/admin/authorizations/:id/revoke', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_attendance_controller_js_1.revokeWfhAuthorizationHandler);
// 5. Academic Admin Dashboard, Register, Corrections & Reports
router.get('/admin/dashboard', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_attendance_controller_js_1.getAdminDashboardSummary);
router.get('/admin/daily-register', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_attendance_controller_js_1.getAdminDailyRegister);
router.get('/admin/session/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_attendance_controller_js_1.getAdminSessionDetails);
router.post('/admin/correct', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_attendance_controller_js_1.manualCorrection);
router.get('/admin/monthly-report', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), staff_attendance_controller_js_1.getAdminMonthlyReport);
exports.default = router;
