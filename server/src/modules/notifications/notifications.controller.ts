import { Response } from 'express';
import { prisma } from '../../prisma.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { InAppNotificationService } from './inapp-notification.service.js';
import { NotificationService } from './notification.service.js';

/**
 * List unified notifications for the authenticated user
 */
export async function listNotifications(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const unreadOnly = req.query.unreadOnly === 'true';
    const studentId = req.query.studentId as string;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '30', 10)));
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }
    if (studentId) {
      where.studentId = studentId;
    }

    const [total, unreadCount, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
      prisma.notification.findMany({
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
        ? InAppNotificationService.formatKolkataTime(n.eventTime)
        : InAppNotificationService.formatKolkataTime(n.createdAt);
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
  } catch (err: any) {
    console.error('[List Notifications Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to list notifications' });
  }
}

/**
 * Get quick count of unread notifications
 */
export async function getUnreadCount(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return res.json({
      success: true,
      data: { unreadCount: count },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to get unread count' });
  }
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const notif = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notif) {
      // Also check fallback inAppNotification table if migrating
      const fallback = await prisma.inAppNotification.findFirst({
        where: { id, userId },
      });
      if (fallback) {
        const updated = await prisma.inAppNotification.update({
          where: { id },
          data: { isRead: true, readAt: new Date() },
        });
        return res.json({ success: true, data: { notification: updated } });
      }

      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    return res.json({
      success: true,
      data: { notification: updated },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
}

/**
 * Mark all notifications as read for current user
 */

/**
 * Mark notifications as read for a specific target entity (Normal Navigation Sync)
 */
export async function markReadByEntity(req: AuthenticatedRequest, res: Response) {
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

    const whereClause: any = {
      userId,
      entityType: normalizedType,
      entityId: normalizedId,
      isRead: false,
    };
    if (studentId) {
      whereClause.studentId = String(studentId);
    }

    const [updatedNotifs, updatedInApps] = await Promise.all([
      prisma.notification.updateMany({
        where: whereClause,
        data: { isRead: true, readAt: now },
      }),
      prisma.inAppNotification.updateMany({
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

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    // Notify connected SSE sessions about the updated unread count
    InAppNotificationService.broadcastToUser(userId, {
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
  } catch (err: any) {
    console.error('[markReadByEntity Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to mark entity notifications as read' });
  }
}

/**
 * Verify whether a notification target exists and is accessible
 */
export async function verifyNotificationTarget(req: AuthenticatedRequest, res: Response) {
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
    let details: any = null;

    switch (entityType) {
      case 'HOMEWORK': {
        const hw = await prisma.learningMaterial.findUnique({
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
        const mat = await prisma.learningMaterial.findUnique({
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
        const quiz = await prisma.quiz.findUnique({
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
        const exam = await prisma.examination.findUnique({
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
        const att = await prisma.attendanceEvent.findUnique({
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
        const payment = await prisma.payment.findUnique({
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
        const convo = await prisma.conversation.findUnique({
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
        const report = await prisma.progressFeedback.findUnique({
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
  } catch (err: any) {
    console.error('[verifyNotificationTarget Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to verify notification target' });
  }
}

export async function markAllNotificationsRead(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const now = new Date();
    await Promise.all([
      prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: now },
      }),
      prisma.inAppNotification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true, readAt: now },
      }),
    ]);

    return res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' });
  }
}

/**
 * Real-Time SSE Stream for Notifications
 */
export async function streamNotifications(req: AuthenticatedRequest, res: Response) {
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

  InAppNotificationService.addSseClient(userId, res);

  // Periodic heartbeat every 25 seconds
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeatTimer);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeatTimer);
    InAppNotificationService.removeSseClient(userId, res);
  });
}

/**
 * Register mobile/device push notification token
 */
export async function registerPushToken(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { token, platform = 'android', deviceInfo } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Push token string is required' });
    }

    const record = await prisma.devicePushToken.upsert({
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
  } catch (err: any) {
    console.error('[Register Push Token Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to register push token' });
  }
}

/**
 * Remove device push notification token on logout
 */
export async function removePushToken(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Push token is required' });
    }

    await prisma.devicePushToken.deleteMany({
      where: { token, ...(userId ? { userId } : {}) },
    });

    return res.json({ success: true, message: 'Push token unregistered successfully' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to unregister push token' });
  }
}

// -------------------------------------------------------------
// BACKWARD COMPATIBILITY ENDPOINTS (SMS & IN-APP LEGACY)
// -------------------------------------------------------------

export async function listSmsNotifications(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const status = req.query.status as any;
    const studentId = req.query.studentId as string;

    const skip = (page - 1) * limit;

    const where: any = { instituteId };
    if (status) where.status = status;
    if (studentId) where.studentId = studentId;

    const [total, notifications] = await Promise.all([
      prisma.smsNotification.count({ where }),
      prisma.smsNotification.findMany({
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to list SMS notifications' });
  }
}

export async function getSmsNotificationById(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const notif = await prisma.smsNotification.findFirst({
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch notification' });
  }
}

export async function retrySmsNotification(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });
    const { id } = req.params;

    const result = await NotificationService.retryNotification(id, instituteId);
    return res.json({ success: true, message: result.message });
  } catch (err: any) {
    return res.status(400).json({ success: false, error: err.message });
  }
}

/**
 * Legacy in-app notifications endpoint (supports existing ParentNotificationsView)
 */
export async function listInAppNotifications(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '30', 10)));

    const where: any = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    // Query both unified Notification and legacy InAppNotification
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({
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
  } catch (err: any) {
    console.error('[List InApp Notifications Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to list in-app notifications' });
  }
}

export async function markInAppNotificationRead(req: AuthenticatedRequest, res: Response) {
  return markNotificationRead(req, res);
}

export async function markAllInAppNotificationsRead(req: AuthenticatedRequest, res: Response) {
  return markAllNotificationsRead(req, res);
}
