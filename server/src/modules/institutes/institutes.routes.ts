import { Router } from 'express';
import {
  listInstitutes,
  createInstitute,
  getInstituteById,
  updateInstitute,
  updateInstituteStatus,
  getDashboardSummary,
  updateAdminAccount,
  resetAdminPassword,
} from './institutes.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';

const router = Router();

// Dashboard summary (Super Admin gets platform metrics, Academic Admin gets institute-scoped metrics)
router.get('/dashboard/summary', authenticateToken, requireInstituteContext, getDashboardSummary);

// Institute CRUD
router.get('/', authenticateToken, requireRole('SUPER_ADMIN'), listInstitutes);
router.post('/', authenticateToken, requireRole('SUPER_ADMIN'), createInstitute);
router.get('/:id', authenticateToken, requireInstituteContext, getInstituteById);
router.patch('/:id', authenticateToken, requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), requireInstituteContext, updateInstitute);
router.patch('/:id/status', authenticateToken, requireRole('SUPER_ADMIN'), updateInstituteStatus);

// Academic Admin Account Management (SUPER_ADMIN only)
router.patch('/:id/admin-account', authenticateToken, requireRole('SUPER_ADMIN'), updateAdminAccount);
router.post('/:id/admin-account/reset-password', authenticateToken, requireRole('SUPER_ADMIN'), resetAdminPassword);

export default router;

