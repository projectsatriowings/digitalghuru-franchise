"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const feedback_controller_js_1 = require("./feedback.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const router = (0, express_1.Router)();
// All feedback operations require authenticated user & institute context
router.use(auth_js_1.authenticateToken);
router.use(auth_js_1.requireInstituteContext);
// Submit feedback (Parents)
router.post('/', (0, auth_js_1.requireRole)('PARENT'), feedback_controller_js_1.submitFeedback);
// List feedback (Parents see own children; Staff sees assigned; Admins see institute)
router.get('/', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT'), feedback_controller_js_1.listFeedback);
// Get single feedback item
router.get('/:id', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT'), feedback_controller_js_1.getFeedbackById);
// Respond to feedback (Teachers / Admins)
router.post('/:id/respond', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), feedback_controller_js_1.respondToFeedback);
router.patch('/:id/respond', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), feedback_controller_js_1.respondToFeedback);
// Update status (e.g. resolve)
router.patch('/:id/status', (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT'), feedback_controller_js_1.updateFeedbackStatus);
exports.default = router;
