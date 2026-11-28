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

// Read endpoints: SUPER_ADMIN, FRANCHISE_OWNER, and BRANCH_ADMIN (controller enforces franchise ownership)
router.get('/', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN'), listSettlements);
router.get('/:id', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN'), getSettlementById);
router.get('/:id/transfers', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN'), getSettlementTransfers);

// Settlement Generation: Allowed for Super Admin (all or single) and Franchise Owner / Branch Admin (own franchise)
router.post('/generate', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN'), generateMonthlySettlements);
router.post('/:id/approve', requireRole('SUPER_ADMIN'), approveSettlement);
router.post('/:id/status', requireRole('SUPER_ADMIN'), updateSettlementStatus);
router.post('/:id/transfers/manual', requireRole('SUPER_ADMIN'), recordManualTransfer);
router.post('/transfers/:transferId/verify', requireRole('SUPER_ADMIN'), verifyManualTransfer);
router.post('/:id/transfers/direct', requireRole('SUPER_ADMIN'), executeDirectPayout);
router.post('/:id/adjustments', requireRole('SUPER_ADMIN'), addAdjustment);

// Route-based transfers (Isolated behind feature flag)
router.post('/:id/transfers/initiate', requireRole('SUPER_ADMIN'), initiateTransfers);

export default router;
