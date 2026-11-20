"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const institutes_controller_js_1 = require("./institutes.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const router = (0, express_1.Router)();
// Dashboard summary (Super Admin gets platform metrics, Academic Admin gets institute-scoped metrics)
router.get('/dashboard/summary', auth_js_1.authenticateToken, auth_js_1.requireInstituteContext, institutes_controller_js_1.getDashboardSummary);
// Institute Duplicate Pre-check (SUPER_ADMIN only)
router.post('/check-duplicates', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), institutes_controller_js_1.checkInstituteDuplicates);
// Institute CRUD
router.get('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), institutes_controller_js_1.listInstitutes);
router.post('/', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), institutes_controller_js_1.createInstitute);
router.get('/:id', auth_js_1.authenticateToken, auth_js_1.requireInstituteContext, institutes_controller_js_1.getInstituteById);
router.patch('/:id', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), auth_js_1.requireInstituteContext, institutes_controller_js_1.updateInstitute);
router.patch('/:id/status', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), institutes_controller_js_1.updateInstituteStatus);
// Academic Admin Account Management (SUPER_ADMIN only)
router.patch('/:id/admin-account', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), institutes_controller_js_1.updateAdminAccount);
router.post('/:id/admin-account/reset-password', auth_js_1.authenticateToken, (0, auth_js_1.requireRole)('SUPER_ADMIN'), institutes_controller_js_1.resetAdminPassword);
exports.default = router;
