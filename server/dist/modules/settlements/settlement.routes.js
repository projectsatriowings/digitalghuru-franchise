"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_js_1 = require("../../middleware/auth.js");
const settlement_controller_js_1 = require("./settlement.controller.js");
const router = (0, express_1.Router)();
// Base authentication for all settlement endpoints
router.use(auth_js_1.authenticateToken);
// Read endpoints: SUPER_ADMIN and FRANCHISE_OWNER (controller enforces franchise ownership)
router.get('/', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), settlement_controller_js_1.listSettlements);
router.get('/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'FRANCHISE_OWNER'), settlement_controller_js_1.getSettlementById);
// Super Admin actions (Section F & G)
router.post('/generate', (0, auth_js_1.requireRole)('SUPER_ADMIN'), settlement_controller_js_1.generateMonthlySettlements);
router.post('/:id/approve', (0, auth_js_1.requireRole)('SUPER_ADMIN'), settlement_controller_js_1.approveSettlement);
router.post('/:id/status', (0, auth_js_1.requireRole)('SUPER_ADMIN'), settlement_controller_js_1.updateSettlementStatus);
router.post('/:id/transfers/initiate', (0, auth_js_1.requireRole)('SUPER_ADMIN'), settlement_controller_js_1.initiateTransfers);
router.post('/:id/transfers/direct', (0, auth_js_1.requireRole)('SUPER_ADMIN'), settlement_controller_js_1.executeDirectPayout);
router.post('/:id/adjustments', (0, auth_js_1.requireRole)('SUPER_ADMIN'), settlement_controller_js_1.addAdjustment);
exports.default = router;
