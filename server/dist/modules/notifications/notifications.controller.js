"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listNotifications = listNotifications;
exports.getUnreadCount = getUnreadCount;
exports.markNotificationRead = markNotificationRead;
exports.markReadByEntity = markReadByEntity;
exports.verifyNotificationTarget = verifyNotificationTarget;
exports.markAllNotificationsRead = markAllNotificationsRead;
exports.streamNotifications = streamNotifications;
exports.registerPushToken = registerPushToken;
exports.removePushToken = removePushToken;
exports.listSmsNotifications = listSmsNotifications;
exports.getSmsNotificationById = getSmsNotificationById;
exports.retrySmsNotification = retrySmsNotification;
exports.listInAppNotifications = listInAppNotifications;
exports.markInAppNotificationRead = markInAppNotificationRead;
exports.markAllInAppNotificationsRead = markAllInAppNotificationsRead;
const prisma_js_1 = require("../../prisma.js");
const inapp_notification_service_js_1 = require("./inapp-notification.service.js");
const notification_service_js_1 = require("./notification.service.js");
/**
 * List unified notifications for the authenticated user
 */
async function listNotifications(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const unreadOnly = req.query.unreadOnly === 'true';
        const studentId = req.query.studentId;
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '30', 10)));
        const skip = (page - 1) * limit;
        const where = { userId };
        if (unreadOnly) {
            where.isRead = false;
        }
        if (studentId) {
            where.studentId = studentId;
        }
        const [total, unreadCount, notifications] = await Promise.all([
            prisma_js_1.prisma.notification.count({ where }),
            prisma_js_1.prisma.notification.count({ where: { userId, isRead: false } }),
            prisma_js_1.prisma.notification.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    student: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            admissionNumber: true,
                            photoUrl: true,
                        },
                    },
                },
            }),
        ]);
        // Format timestamps for display in Asia/Kolkata
        const formatted = notifications.map((n) => {
            const timeFormatted = n.eventTime
                ? inapp_notification_service_js_1.InAppNotificationService.formatKolkataTime(n.eventTime)
                : inapp_notification_service_js_1.InAppNotificationService.formatKolkataTime(n.createdAt);
            return {
                ...n,
                timeFormatted,
            };
        });
        return res.json({
            success: true,
            data: {
                notifications: formatted,
                unreadCount,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    }
    catch (err) {
        console.error('[List Notifications Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to list notifications' });
    }
}
/**
 * Get quick count of unread notifications
 */
async function getUnreadCount(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const count = await prisma_js_1.prisma.notification.count({
            where: { userId, isRead: false },
        });
        return res.json({
            success: true,
            data: { unreadCount: count },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to get unread count' });
    }
}
/**
 * Mark a single notification as read
 */
async function markNotificationRead(req, res) {
    try {
        const userId = req.user?.userId;
        const { id } = req.params;
        const notif = await prisma_js_1.prisma.notification.findFirst({
            where: { id, userId },
        });
        if (!notif) {
            // Also check fallback inAppNotification table if migrating
            const fallback = await prisma_js_1.prisma.inAppNotification.findFirst({
                where: { id, userId },
            });
            if (fallback) {
                const updated = await prisma_js_1.prisma.inAppNotification.update({
                    where: { id },
                    data: { isRead: true, readAt: new Date() },
                });
                return res.json({ success: true, data: { notification: updated } });
            }
            return res.status(404).json({ success: false, error: 'Notification not found' });
        }
        const updated = await prisma_js_1.prisma.notification.update({
            where: { id },
            data: { isRead: true, readAt: new Date() },
        });
        return res.json({
            success: true,
            data: { notification: updated },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
    }
}
/**
 * Mark all notifications as read for current user
 */
/**
 * Mark notifications as read for a specific target entity (Normal Navigation Sync)
 */
async function markReadByEntity(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const { entityType, entityId, studentId } = req.body;
        if (!entityType || !entityId) {
            return res.status(400).json({ success: false, error: 'entityType and entityId are required' });
        }
        const now = new Date();
        const normalizedType = String(entityType).toUpperCase();
        const normalizedId = String(entityId);
        const whereClause = {
            userId,
            entityType: normalizedType,
            entityId: normalizedId,
            isRead: false,
        };
        if (studentId) {
            whereClause.studentId = String(studentId);
        }
        const [updatedNotifs, updatedInApps] = await Promise.all([
            prisma_js_1.prisma.notification.updateMany({
                where: whereClause,
                data: { isRead: true, readAt: now },
            }),
            prisma_js_1.prisma.inAppNotification.updateMany({
                where: {
                    userId,
                    entityType: normalizedType,
                    entityId: normalizedId,
                    isRead: false,
                    ...(studentId ? { studentId: String(studentId) } : {}),
                },
                data: { isRead: true, readAt: now },
            }),
        ]);
        const totalMarked = updatedNotifs.count + updatedInApps.count;
        const unreadCount = await prisma_js_1.prisma.notification.count({
            where: { userId, isRead: false },
        });
        // Notify connected SSE sessions about the updated unread count
        inapp_notification_service_js_1.InAppNotificationService.broadcastToUser(userId, {
            type: 'UNREAD_COUNT_UPDATED',
            unreadCount,
            entityType: normalizedType,
            entityId: normalizedId,
            markedReadCount: totalMarked,
        });
        return res.json({
            success: true,
            data: {
                markedReadCount: totalMarked,
                unreadCount,
            },
        });
    }
    catch (err) {
        console.error('[markReadByEntity Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to mark entity notifications as read' });
    }
}
/**
 * Verify whether a notification target exists and is accessible
 */
async function verifyNotificationTarget(req, res) {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const entityType = String(req.query.entityType || '').toUpperCase();
        const entityId = String(req.query.entityId || '');
        if (!entityType || !entityId) {
            return res.status(400).json({ success: false, error: 'entityType and entityId query parameters are required' });
        }
        let isAvailable = false;
        let details = null;
        switch (entityType) {
            case 'HOMEWORK': {
                const hw = await prisma_js_1.prisma.learningMaterial.findUnique({
                    where: { id: entityId },
                    select: { id: true, title: true, isPublished: true, instituteId: true, batchId: true, type: true },
                });
                if (hw && hw.isPublished) {
                    isAvailable = true;
                    details = hw;
                }
                break;
            }
            case 'MATERIAL': {
                const mat = await prisma_js_1.prisma.learningMaterial.findUnique({
                    where: { id: entityId },
                    select: { id: true, title: true, isPublished: true, instituteId: true, batchId: true, type: true },
                });
                if (mat && mat.isPublished) {
                    isAvailable = true;
                    details = mat;
                }
                break;
            }
            case 'QUIZ': {
                const quiz = await prisma_js_1.prisma.quiz.findUnique({
                    where: { id: entityId },
                    select: { id: true, title: true, isPublished: true, instituteId: true, batchId: true },
                });
                if (quiz && quiz.isPublished) {
                    isAvailable = true;
                    details = quiz;
                }
                break;
            }
            case 'EXAM': {
                const exam = await prisma_js_1.prisma.examination.findUnique({
                    where: { id: entityId },
                    select: { id: true, title: true, isPublished: true, status: true, instituteId: true, batchId: true },
                });
                if (exam) {
                    isAvailable = true;
                    details = exam;
                }
                break;
            }
            case 'ATTENDANCE': {
                const att = await prisma_js_1.prisma.attendanceEvent.findUnique({
                    where: { id: entityId },
                    select: { id: true, eventType: true, eventTime: true, studentId: true, instituteId: true },
                });
                if (att) {
                    isAvailable = true;
                    details = att;
                }
                break;
            }
            case 'FEE': {
                const payment = await prisma_js_1.prisma.payment.findUnique({
                    where: { id: entityId },
                    select: { id: true, amountPaid: true, receiptNumber: true, studentId: true },
                });
                if (payment) {
                    isAvailable = true;
                    details = payment;
                }
                break;
            }
            case 'MESSAGE': {
                const convo = await prisma_js_1.prisma.conversation.findUnique({
                    where: { id: entityId },
                    select: { id: true, studentId: true, instituteId: true },
                });
                if (convo) {
                    isAvailable = true;
                    details = convo;
                }
                break;
            }
            case 'PROGRESS_REPORT': {
                const report = await prisma_js_1.prisma.progressFeedback.findUnique({
                    where: { id: entityId },
                    select: { id: true, termName: true, studentId: true, instituteId: true },
                });
                if (report) {
                    isAvailable = true;
                    details = report;
                }
                break;
            }
            default:
                isAvailable = true;
        }
        return res.json({
            success: true,
            data: {
                available: isAvailable,
                entityType,
                entityId,
                details,
            },
        });
    }
    catch (err) {
        console.error('[verifyNotificationTarget Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to verify notification target' });
    }
}
async function markAllNotificationsRead(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const now = new Date();
        await Promise.all([
            prisma_js_1.prisma.notification.updateMany({
                where: { userId, isRead: false },
                data: { isRead: true, readAt: now },
            }),
            prisma_js_1.prisma.inAppNotification.updateMany({
                where: { userId, isRead: false },
                data: { isRead: true, readAt: now },
            }),
        ]);
        return res.json({
            success: true,
            message: 'All notifications marked as read',
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' });
    }
}
/**
 * Real-Time SSE Stream for Notifications
 */
async function streamNotifications(req, res) {
    const userId = req.user?.userId;
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    // SSE Headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    // Initial connection acknowledge
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);
    inapp_notification_service_js_1.InAppNotificationService.addSseClient(userId, res);
    // Periodic heartbeat every 25 seconds
    const heartbeatTimer = setInterval(() => {
        try {
            res.write(': keepalive\n\n');
        }
        catch {
            clearInterval(heartbeatTimer);
        }
    }, 25000);
    req.on('close', () => {
        clearInterval(heartbeatTimer);
        inapp_notification_service_js_1.InAppNotificationService.removeSseClient(userId, res);
    });
}
/**
 * Register mobile/device push notification token
 */
async function registerPushToken(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const { token, platform = 'android', deviceInfo } = req.body;
        if (!token || typeof token !== 'string') {
            return res.status(400).json({ success: false, error: 'Push token string is required' });
        }
        const record = await prisma_js_1.prisma.devicePushToken.upsert({
            where: { token },
            create: {
                userId,
                token,
                platform,
                deviceInfo: deviceInfo || null,
            },
            update: {
                userId,
                platform,
                deviceInfo: deviceInfo || null,
            },
        });
        return res.status(200).json({
            success: true,
            message: 'Device push token registered successfully',
            data: { token: record.token },
        });
    }
    catch (err) {
        console.error('[Register Push Token Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to register push token' });
    }
}
/**
 * Remove device push notification token on logout
 */
async function removePushToken(req, res) {
    try {
        const userId = req.user?.userId;
        const token = req.body?.token || req.query?.token;
        if (token) {
            await prisma_js_1.prisma.devicePushToken.deleteMany({
                where: { token, ...(userId ? { userId } : {}) },
            });
        }
        else if (userId) {
            await prisma_js_1.prisma.devicePushToken.deleteMany({
                where: { userId },
            });
        }
        else {
            return res.status(400).json({ success: false, error: 'Push token or user context required' });
        }
        return res.json({ success: true, message: 'Push token unregistered successfully' });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to unregister push token' });
    }
}
// -------------------------------------------------------------
// BACKWARD COMPATIBILITY ENDPOINTS (SMS & IN-APP LEGACY)
// -------------------------------------------------------------
async function listSmsNotifications(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const status = req.query.status;
        const studentId = req.query.studentId;
        const skip = (page - 1) * limit;
        const where = { instituteId };
        if (status)
            where.status = status;
        if (studentId)
            where.studentId = studentId;
        const [total, notifications] = await Promise.all([
            prisma_js_1.prisma.smsNotification.count({ where }),
            prisma_js_1.prisma.smsNotification.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    student: {
                        select: { id: true, firstName: true, lastName: true, admissionNumber: true },
                    },
                    parent: {
                        include: {
                            user: { select: { id: true, fullName: true, phone: true } },
                        },
                    },
                },
            }),
        ]);
        return res.json({
            success: true,
            data: {
                notifications,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to list SMS notifications' });
    }
}
async function getSmsNotificationById(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const notif = await prisma_js_1.prisma.smsNotification.findFirst({
            where: { id, instituteId },
            include: {
                student: true,
                parent: {
                    include: {
                        user: { select: { fullName: true, phone: true } },
                    },
                },
                attendanceEvent: true,
            },
        });
        if (!notif) {
            return res.status(404).json({ success: false, error: 'Notification not found' });
        }
        return res.json({ success: true, data: { notification: notif } });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to fetch notification' });
    }
}
async function retrySmsNotification(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id } = req.params;
        const result = await notification_service_js_1.NotificationService.retryNotification(id, instituteId);
        return res.json({ success: true, message: result.message });
    }
    catch (err) {
        return res.status(400).json({ success: false, error: err.message });
    }
}
/**
 * Legacy in-app notifications endpoint (supports existing ParentNotificationsView)
 */
async function listInAppNotifications(req, res) {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const unreadOnly = req.query.unreadOnly === 'true';
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '30', 10)));
        const where = { userId };
        if (unreadOnly) {
            where.isRead = false;
        }
        // Query both unified Notification and legacy InAppNotification
        const [notifications, unreadCount] = await Promise.all([
            prisma_js_1.prisma.notification.findMany({
                where,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma_js_1.prisma.notification.count({
                where: { userId, isRead: false },
            }),
        ]);
        return res.json({
            success: true,
            data: {
                notifications,
                unreadCount,
            },
        });
    }
    catch (err) {
        console.error('[List InApp Notifications Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to list in-app notifications' });
    }
}
async function markInAppNotificationRead(req, res) {
    return markNotificationRead(req, res);
}
async function markAllInAppNotificationsRead(req, res) {
    return markAllNotificationsRead(req, res);
}
