import { Router } from 'express';
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  streamNotifications,
  registerPushToken,
  removePushToken,
  listInAppNotifications,
  markInAppNotificationRead,
  markAllInAppNotificationsRead,
  markReadByEntity,
  verifyNotificationTarget,
  listSmsNotifications,
  getSmsNotificationById,
  retrySmsNotification,
} from './notifications.controller.js';
import { authenticateToken, requireRole, requireInstituteContext } from '../../middleware/auth.js';

const router = Router();

// All notification routes require authenticated user
router.use(authenticateToken);

// -------------------------------------------------------------
// UNIFIED NOTIFICATION ENDPOINTS (Web & Mobile)
// -------------------------------------------------------------

router.get('/', listNotifications);
router.get('/unread-count', getUnreadCount);
router.get('/stream', streamNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.post('/mark-all-read', markAllNotificationsRead);
router.patch('/:id/read', markNotificationRead);
router.post('/mark-read-by-entity', markReadByEntity);
router.get('/verify-target', verifyNotificationTarget);

// Device Push Token registration
router.post('/push-token', registerPushToken);
router.delete('/push-token', removePushToken);

// -------------------------------------------------------------
// LEGACY COMPATIBILITY ENDPOINTS
// -------------------------------------------------------------

// /in-app endpoints
router.get('/in-app', listInAppNotifications);
router.patch('/in-app/:id/read', markInAppNotificationRead);
router.post('/in-app/mark-all-read', markAllInAppNotificationsRead);

// /sms endpoints (Staff and Admin historical outbox)
router.get('/sms', requireInstituteContext, requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), listSmsNotifications);
router.get('/sms/:id', requireInstituteContext, requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF'), getSmsNotificationById);
router.post('/sms/:id/retry', requireInstituteContext, requireRole('SUPER_ADMIN', 'ACADEMIC_ADMIN'), retrySmsNotification);

export default router;
