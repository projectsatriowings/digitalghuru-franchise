import { Router } from 'express';
import { authenticateToken, requireRole } from '../../middleware/auth.js';
import {
  listSettlements,
  getSettlementById,
  generateMonthlySettlements,
  approveSettlement,
  updateSettlementStatus,
  recordManualTransfer,
  getSettlementTransfers,
  verifyManualTransfer,
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
router.get('/:id/transfers', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'), getSettlementTransfers);

// Super Admin actions (Manual Settlement Workflow)
router.post('/generate', requireRole('SUPER_ADMIN'), generateMonthlySettlements);
router.post('/:id/approve', requireRole('SUPER_ADMIN'), approveSettlement);
router.post('/:id/status', requireRole('SUPER_ADMIN'), updateSettlementStatus);
router.post('/:id/transfers/manual', requireRole('SUPER_ADMIN'), recordManualTransfer);
router.post('/transfers/:transferId/verify', requireRole('SUPER_ADMIN'), verifyManualTransfer);
router.post('/:id/transfers/direct', requireRole('SUPER_ADMIN'), executeDirectPayout);
router.post('/:id/adjustments', requireRole('SUPER_ADMIN'), addAdjustment);

// Route-based transfers (Isolated behind feature flag)
router.post('/:id/transfers/initiate', requireRole('SUPER_ADMIN'), initiateTransfers);

export default router;
