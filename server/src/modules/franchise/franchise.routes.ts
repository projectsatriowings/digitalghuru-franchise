import { Router } from 'express';
import {
  createFranchise,
  listFranchises,
  getFranchiseById,
  updateFranchise,
  updateFranchiseStatus,
  resetFranchiseOwnerPassword,
  addBranchToFranchise,
  listFranchiseBranches,
  removeBranchFromFranchise,
  createAgreement,
  renewAgreement,
  listAgreements,
  updateAgreementStatus,
  addAgreementAmendment,
  getAgreementPdfData,
  calculateRoyalty,
  listRoyaltyRecords,
  recordRoyaltyPayment,
  listFranchiseInstallments,
  listAgreementInstallments,
  recordInstallmentPayment,
  getRoyaltyPaymentReceipt,
  getSuperAdminFranchiseDashboard,
  getFranchiseOwnerDashboard,
} from './franchise.controller.js';
import { authenticateToken, requireRole } from '../../middleware/auth.js';

const router = Router();

// All franchise routes require authentication
router.use(authenticateToken);

// -------------------------------------------------------------
// DASHBOARD ENDPOINTS
// -------------------------------------------------------------
router.get('/dashboard/super-admin', requireRole('SUPER_ADMIN'), getSuperAdminFranchiseDashboard);
router.get('/dashboard/owner', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'), getFranchiseOwnerDashboard);

// -------------------------------------------------------------
// CORE FRANCHISE CRUD
// -------------------------------------------------------------
router.post('/', requireRole('SUPER_ADMIN'), createFranchise);
router.get('/', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'), listFranchises);
router.get('/:id', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'), getFranchiseById);
router.patch('/:id', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'), updateFranchise);
router.patch('/:id/status', requireRole('SUPER_ADMIN'), updateFranchiseStatus);
router.post('/:id/owner/reset-password', requireRole('SUPER_ADMIN'), resetFranchiseOwnerPassword);

// -------------------------------------------------------------
// BRANCH MANAGEMENT (Strictly SUPER_ADMIN only)
// -------------------------------------------------------------
router.post('/:id/branches', requireRole('SUPER_ADMIN'), addBranchToFranchise);
router.get('/:id/branches', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'), listFranchiseBranches);
router.delete('/:id/branches/:branchId', requireRole('SUPER_ADMIN'), removeBranchFromFranchise);

// -------------------------------------------------------------
// AGREEMENT & CONTRACT MANAGEMENT
// -------------------------------------------------------------
router.post('/:id/agreements', requireRole('SUPER_ADMIN'), createAgreement);
router.post('/:id/agreements/:agreementId/renew', requireRole('SUPER_ADMIN'), renewAgreement);
router.get('/:id/agreements', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'), listAgreements);
router.patch('/:id/agreements/:agreementId/status', requireRole('SUPER_ADMIN'), updateAgreementStatus);
router.post('/:id/agreements/:agreementId/amendments', requireRole('SUPER_ADMIN'), addAgreementAmendment);
router.get('/:id/agreements/:agreementId/pdf', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'), getAgreementPdfData);

// -------------------------------------------------------------
// 2-INSTALLMENT ANNUAL ROYALTY WORKFLOW
// -------------------------------------------------------------
router.get('/:id/installments', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'), listFranchiseInstallments);
router.get('/:id/agreements/:agreementId/installments', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'), listAgreementInstallments);
router.post('/:id/installments/:installmentId/payments', requireRole('SUPER_ADMIN'), recordInstallmentPayment);
router.get('/:id/payments/:paymentId/receipt', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'), getRoyaltyPaymentReceipt);

// -------------------------------------------------------------
// LEGACY / MONTHLY ROYALTY MANAGEMENT & PAYMENTS
// -------------------------------------------------------------
router.post('/:id/royalty/calculate', requireRole('SUPER_ADMIN'), calculateRoyalty);
router.get('/:id/royalty', requireRole('SUPER_ADMIN', 'FRANCHISE_OWNER'), listRoyaltyRecords);
router.post('/:id/royalty/payments', requireRole('SUPER_ADMIN'), recordRoyaltyPayment);

export default router;
