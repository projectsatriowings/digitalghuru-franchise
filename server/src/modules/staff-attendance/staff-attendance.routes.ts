import { Router } from 'express';
import {
  getInstituteAttendanceConfig,
  updateInstituteAttendanceConfig,
  getStaffTodayStatus,
  staffCheckIn,
  staffCheckOut,
  getStaffPersonalHistory,
  getAdminDashboardSummary,
  getAdminDailyRegister,
  getAdminSessionDetails,
  manualCorrection,
  getAdminMonthlyReport,
  getStaffWfhEligibility,
  submitStaffWfhRequest,
  getStaffMyWfhRequests,
  getAdminWfhAuthorizations,
  createAdminWfhAuthorization,
  approveWfhRequestHandler,
  rejectWfhRequestHandler,
  revokeWfhAuthorizationHandler,
  getAdminWfhMetricsHandler,
  getStaffOnlineClassesHandler,
  updateOnlineClassStatusHandler,
} from './staff-attendance.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';

const router = Router();

// Apply base authentication and institute context across all staff attendance routes
router.use(authenticateToken);
router.use(requireInstituteContext);

// 1. Institute Location & Geofence Configuration
router.get('/config', getInstituteAttendanceConfig);
router.put('/config', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), updateInstituteAttendanceConfig);

// 2. Staff Check-In / Check-Out & Personal History
router.get('/today', requireRole('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), getStaffTodayStatus);
router.post('/check-in', requireRole('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), staffCheckIn);
router.post('/check-out', requireRole('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), staffCheckOut);
router.get('/my-history', requireRole('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), getStaffPersonalHistory);

// 3. Work From Home (WFH) Staff Routes
router.get('/wfh/eligibility', requireRole('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), getStaffWfhEligibility);
router.post('/wfh/request', requireRole('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), submitStaffWfhRequest);
router.get('/wfh/my-requests', requireRole('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), getStaffMyWfhRequests);
router.get('/wfh/online-classes', requireRole('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), getStaffOnlineClassesHandler);
router.post('/wfh/online-classes/:batchSubjectId/status', requireRole('STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), updateOnlineClassStatusHandler);

// 4. Work From Home (WFH) Admin Routes
router.get('/wfh/admin/metrics', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), getAdminWfhMetricsHandler);
router.get('/wfh/admin/authorizations', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), getAdminWfhAuthorizations);
router.post('/wfh/admin/authorizations', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), createAdminWfhAuthorization);
router.post('/wfh/admin/authorizations/:id/approve', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), approveWfhRequestHandler);
router.post('/wfh/admin/authorizations/:id/reject', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), rejectWfhRequestHandler);
router.post('/wfh/admin/authorizations/:id/revoke', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), revokeWfhAuthorizationHandler);

// 5. Academic Admin Dashboard, Register, Corrections & Reports
router.get('/admin/dashboard', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), getAdminDashboardSummary);
router.get('/admin/daily-register', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), getAdminDailyRegister);
router.get('/admin/session/:id', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), getAdminSessionDetails);
router.post('/admin/correct', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), manualCorrection);
router.get('/admin/monthly-report', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), getAdminMonthlyReport);

export default router;
