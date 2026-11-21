import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import {
  listSettlements,
  getSettlementById,
  generateMonthlySettlements,
  approveSettlement,
  updateSettlementStatus,
  initiateTransfers,
  executeDirectPayout,
  addAdjustment,
} from './settlement.controller.js';

const router = Router();

// Base authentication for all settlement endpoints
router.use(authenticateToken);

// Read endpoints: SUPER_ADMIN and FRANCHISE_OWNER (controller enforces franchise ownership)
router.get('/', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'), listSettlements);
router.get('/:id', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'), getSettlementById);

// Super Admin actions (Section F & G)
router.post('/generate', requireRole('SUPER_ADMIN'), generateMonthlySettlements);
router.post('/:id/approve', requireRole('SUPER_ADMIN'), approveSettlement);
router.post('/:id/status', requireRole('SUPER_ADMIN'), updateSettlementStatus);
router.post('/:id/transfers/initiate', requireRole('SUPER_ADMIN'), initiateTransfers);
router.post('/:id/transfers/direct', requireRole('SUPER_ADMIN'), executeDirectPayout);
router.post('/:id/adjustments', requireRole('SUPER_ADMIN'), addAdjustment);

export default router;
