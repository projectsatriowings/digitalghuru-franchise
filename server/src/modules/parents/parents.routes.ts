import { Router } from 'express';
import {
  listParents,
  createParent,
  linkGuardianToStudent,
  revokeGuardianLink,
  getMyChildren,
  resetParentPassword,
  updateParentLoginIdentifier,
  updateParentAccountStatus,
  getParentDashboardSummary,
  getParentStudentAttendance,
  getParentStudentTeachers,
  getParentStudentAcademics,
} from './parents.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';

const router = Router();

router.use(authenticateToken);

// Parent's own linked children & portal endpoints
router.get('/my/children', getMyChildren);
router.get('/my/dashboard-summary', getParentDashboardSummary);
router.get('/students/:studentId/attendance', getParentStudentAttendance);
router.get('/students/:studentId/teachers', getParentStudentTeachers);
router.get('/students/:studentId/academics', getParentStudentAcademics);

// Institute-scoped parent management
router.use(requireInstituteContext);
router.get('/', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), listParents);
router.post('/', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), createParent);

// Parent credential management by authorized staff/admin
router.post('/:parentId/reset-password', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), resetParentPassword);
router.patch('/:parentId/account-identifier', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), updateParentLoginIdentifier);
router.patch('/:parentId/account-status', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), updateParentAccountStatus);

// Student guardian linking endpoints
router.post('/students/:studentId/guardians', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), linkGuardianToStudent);
router.delete('/students/:studentId/guardians/:parentId', requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), revokeGuardianLink);

export default router;

