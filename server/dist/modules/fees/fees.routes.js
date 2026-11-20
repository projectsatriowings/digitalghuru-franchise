"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const fees_controller_js_1 = require("./fees.controller.js");
const router = (0, express_1.Router)();
// Apply base authentication and institute context to all fee routes
router.use(auth_js_1.authenticateToken);
router.use(auth_js_1.requireInstituteContext);
// ============================================================================
// MODULE A: FEE STRUCTURES
// ============================================================================
router.post('/structures', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), fees_controller_js_1.createFeeStructure);
router.get('/structures', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), fees_controller_js_1.listFeeStructures);
router.get('/structures/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), fees_controller_js_1.getFeeStructureById);
router.patch('/structures/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), fees_controller_js_1.updateFeeStructure);
// ============================================================================
// MODULE B: STUDENT FEE ASSIGNMENTS
// ============================================================================
router.post('/assignments', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), fees_controller_js_1.assignFeeToStudent);
router.post('/assignments/batch', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), fees_controller_js_1.assignFeeToBatch);
router.get('/assignments', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'PARENT', 'STUDENT'), fees_controller_js_1.listFeeAssignments);
router.get('/assignments/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'PARENT', 'STUDENT'), fees_controller_js_1.getFeeAssignmentById);
router.get('/students/:studentId/statement', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'PARENT', 'STUDENT'), fees_controller_js_1.getStudentFeeStatement);
// ============================================================================
// MODULE C & D: PAYMENTS & RECEIPTS
// ============================================================================
router.post('/payments', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), fees_controller_js_1.recordPayment);
router.get('/payments', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'PARENT', 'STUDENT'), fees_controller_js_1.listPayments);
router.get('/payments/:id/receipt', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'PARENT', 'STUDENT'), fees_controller_js_1.getReceipt);
// ============================================================================
// MODULE E: REFUNDS & ADJUSTMENTS (STRICT RBAC: ADMIN ONLY)
// ============================================================================
router.post('/payments/:id/refunds', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), fees_controller_js_1.processRefund);
router.post('/assignments/:id/adjustments', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), fees_controller_js_1.createFeeAdjustment);
router.get('/adjustments', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), fees_controller_js_1.listAdjustments);
// ============================================================================
// MODULE F: FINANCIAL REPORTS & DASHBOARD
// ============================================================================
router.get('/reports/summary', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), fees_controller_js_1.getFinancialSummary);
router.get('/reports/collections', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), fees_controller_js_1.getCollectionsReport);
router.get('/reports/outstanding', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), fees_controller_js_1.getOutstandingReport);
// ============================================================================
// MODULE G: ONLINE PAYMENT WORKFLOW (RAZORPAY)
// ============================================================================
router.post('/online/create-order', (0, auth_js_1.requireRole)('PARENT', 'STUDENT', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), fees_controller_js_1.createOnlinePaymentOrder);
router.post('/online/verify-payment', (0, auth_js_1.requireRole)('PARENT', 'STUDENT', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'), fees_controller_js_1.verifyOnlinePayment);
router.post('/online/webhook', fees_controller_js_1.handlePaymentWebhook);
exports.default = router;
