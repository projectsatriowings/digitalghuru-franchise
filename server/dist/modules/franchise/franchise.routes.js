"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const franchise_controller_js_1 = require("./franchise.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const router = (0, express_1.Router)();
// All franchise routes require authentication
router.use(auth_js_1.authenticateToken);
// -------------------------------------------------------------
// DASHBOARD & ASSIGNED BRANCH ENDPOINTS
// -------------------------------------------------------------
router.get('/dashboard/super-admin', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.getSuperAdminFranchiseDashboard);
router.get('/dashboard/owner', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.getFranchiseOwnerDashboard);
router.get('/my-branches', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.getMyAssignedBranches);
router.get('/unassigned-branches', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.getUnassignedBranches);
router.get('/agreement-templates', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.getAgreementTemplates);
// -------------------------------------------------------------
// CORE FRANCHISE CRUD
// -------------------------------------------------------------
router.post('/check-duplicates', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.checkFranchiseDuplicates);
router.post('/', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.createFranchise);
router.get('/', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.listFranchises);
router.get('/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.getFranchiseById);
router.patch('/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.updateFranchise);
router.patch('/:id/status', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.updateFranchiseStatus);
router.patch('/:id/revenue-share', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.updateRevenueShare);
router.put('/:id/beneficiary-account', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.updateBeneficiaryAccount);
router.get('/:id/revenue-dashboard', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.getFranchiseRevenueDashboard);
router.post('/:id/owner/reset-password', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.resetFranchiseOwnerPassword);
// -------------------------------------------------------------
// BRANCH MANAGEMENT (Strictly SUPER_ADMIN only)
// -------------------------------------------------------------
router.post('/:id/branches', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.addBranchToFranchise);
router.get('/:id/branches', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.listFranchiseBranches);
router.delete('/:id/branches/:branchId', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.removeBranchFromFranchise);
// -------------------------------------------------------------
// AGREEMENT & CONTRACT MANAGEMENT
// -------------------------------------------------------------
router.post('/:id/agreements', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.createAgreement);
router.post('/:id/agreements/:agreementId/renew', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.renewAgreement);
router.post('/:id/agreements/:agreementId/revise', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.reviseAgreement);
router.get('/:id/agreements', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.listAgreements);
router.patch('/:id/agreements/:agreementId/status', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.updateAgreementStatus);
router.post('/:id/agreements/:agreementId/amendments', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.addAgreementAmendment);
router.get('/:id/agreements/:agreementId/pdf', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.getAgreementPdfData);
// -------------------------------------------------------------
// 2-INSTALLMENT ANNUAL ROYALTY WORKFLOW
// -------------------------------------------------------------
router.get('/:id/installments', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.listFranchiseInstallments);
router.get('/:id/agreements/:agreementId/installments', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.listAgreementInstallments);
router.post('/:id/installments/:installmentId/payments', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.recordInstallmentPayment);
router.get('/:id/payments/:paymentId/receipt', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.getRoyaltyPaymentReceipt);
// -------------------------------------------------------------
// LEGACY / MONTHLY ROYALTY MANAGEMENT & PAYMENTS
// -------------------------------------------------------------
router.post('/:id/royalty/calculate', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.calculateRoyalty);
router.post('/:id/royalties/calculate', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.calculateRoyalty);
router.get('/:id/royalty', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.listRoyaltyRecords);
router.get('/:id/royalties', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), franchise_controller_js_1.listRoyaltyRecords);
router.post('/:id/royalty/payments', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.recordRoyaltyPayment);
router.post('/:id/royalties/payments', (0, auth_js_1.requireRole)('SUPER_ADMIN'), franchise_controller_js_1.recordRoyaltyPayment);
exports.default = router;
