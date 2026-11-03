import { Router } from 'express';
import {
  recordCheckIn,
  voiceMatchStudents,
  recordCheckOut,
  getAttendanceSummary,
  getAttendanceReports,
  getStudentQrPass,
  validateScannedQr,
  correctAttendanceEvent,
} from './attendance.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';

const router = Router();

router.use(authenticateToken);
router.use(requireInstituteContext);

// Summary & Reporting
router.get('/summary', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), getAttendanceSummary);
router.get('/reports', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), getAttendanceReports);

// Check-in & Check-out actions (Staff & Admins)
// Voice Matching & Smart Search
router.post('/voice-match', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), voiceMatchStudents);
router.get('/voice-match', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), voiceMatchStudents);

// Check-in & Check-out actions (Staff & Admins)
router.post('/check-in', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), recordCheckIn);
router.post('/check-out', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), recordCheckOut);

// QR Attendance actions
router.get('/students/:studentId/qr', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT'), getStudentQrPass);
router.post('/qr/scan', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), validateScannedQr);

// Corrections
router.patch('/:eventId/correction', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), correctAttendanceEvent);

export default router;
