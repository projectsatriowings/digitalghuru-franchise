"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const parents_controller_js_1 = require("./parents.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticateToken);
// Parent's own linked children & portal endpoints
router.get('/my/children', parents_controller_js_1.getMyChildren);
router.get('/my/dashboard-summary', parents_controller_js_1.getParentDashboardSummary);
router.get('/students/:studentId/attendance', parents_controller_js_1.getParentStudentAttendance);
router.get('/students/:studentId/teachers', parents_controller_js_1.getParentStudentTeachers);
router.get('/students/:studentId/academics', parents_controller_js_1.getParentStudentAcademics);
// Institute-scoped parent management
router.use(auth_js_1.requireInstituteContext);
router.get('/', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), parents_controller_js_1.listParents);
router.post('/', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), parents_controller_js_1.createParent);
// Parent credential management by authorized staff/admin
router.post('/:parentId/reset-password', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), parents_controller_js_1.resetParentPassword);
router.patch('/:parentId/account-identifier', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), parents_controller_js_1.updateParentLoginIdentifier);
router.patch('/:parentId/account-status', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), parents_controller_js_1.updateParentAccountStatus);
// Student guardian linking endpoints
router.post('/students/:studentId/guardians', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), parents_controller_js_1.linkGuardianToStudent);
router.delete('/students/:studentId/guardians/:parentId', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), parents_controller_js_1.revokeGuardianLink);
exports.default = router;
