"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notifications_controller_js_1 = require("./notifications.controller.js");
const auth_js_1 = require("../../middleware/auth.js");
const router = (0, express_1.Router)();
// All notification routes require authenticated user
router.use(auth_js_1.authenticateToken);
// -------------------------------------------------------------
// UNIFIED NOTIFICATION ENDPOINTS (Web & Mobile)
// -------------------------------------------------------------
router.get('/', notifications_controller_js_1.listNotifications);
router.get('/unread-count', notifications_controller_js_1.getUnreadCount);
router.get('/stream', notifications_controller_js_1.streamNotifications);
router.patch('/read-all', notifications_controller_js_1.markAllNotificationsRead);
router.post('/mark-all-read', notifications_controller_js_1.markAllNotificationsRead);
router.patch('/:id/read', notifications_controller_js_1.markNotificationRead);
router.post('/mark-read-by-entity', notifications_controller_js_1.markReadByEntity);
router.get('/verify-target', notifications_controller_js_1.verifyNotificationTarget);
// Device Push Token registration
router.post('/push-token', notifications_controller_js_1.registerPushToken);
router.delete('/push-token', notifications_controller_js_1.removePushToken);
// -------------------------------------------------------------
// LEGACY COMPATIBILITY ENDPOINTS
// -------------------------------------------------------------
// /in-app endpoints
router.get('/in-app', notifications_controller_js_1.listInAppNotifications);
router.patch('/in-app/:id/read', notifications_controller_js_1.markInAppNotificationRead);
router.post('/in-app/mark-all-read', notifications_controller_js_1.markAllInAppNotificationsRead);
// /sms endpoints (Staff and Admin historical outbox)
router.get('/sms', auth_js_1.requireInstituteContext, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), notifications_controller_js_1.listSmsNotifications);
router.get('/sms/:id', auth_js_1.requireInstituteContext, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), notifications_controller_js_1.getSmsNotificationById);
router.post('/sms/:id/retry', auth_js_1.requireInstituteContext, (0, auth_js_1.requireRole)('SUPER_ADMIN', 'ACADEMIC_ADMIN'), notifications_controller_js_1.retrySmsNotification);
exports.default = router;
