import { prisma } from '../../prisma.js';
import { getSmsProvider, getSmsProviderStatus } from './sms.provider.js';

export class NotificationService {
  private static workerTimer: NodeJS.Timeout | null = null;
  private static isProcessing = false;

  /**
   * Start recurring background worker to poll and process outbox queue
   */
  static startWorker(intervalMs = 15000) {
    if (this.workerTimer) return;
    const providerStatus = getSmsProviderStatus();
    console.log(
      `[NotificationService] SMS Background Worker started (polling every ${intervalMs / 1000}s, active provider: ${providerStatus.providerName})`
    );

    this.workerTimer = setInterval(() => {
      this.processPendingNotifications().catch((err) => {
        console.error('[NotificationService Worker Polling Error]', err.message);
      });
    }, intervalMs);

    // Immediate initial tick
    setTimeout(() => {
      this.processPendingNotifications().catch((err) => {
        console.error('[NotificationService Worker Initial Error]', err.message);
      });
    }, 500);
  }

  /**
   * Stop recurring background worker
   */
  static stopWorker() {
    if (this.workerTimer) {
      clearInterval(this.workerTimer);
      this.workerTimer = null;
      console.log('[NotificationService] SMS Background Worker stopped');
    }
  }

  /**
   * Enqueue SMS notifications for verified guardians on Check-in/Check-out
   */
  static async queueAttendanceNotification(params: {
    attendanceEventId: string;
    studentId: string;
    instituteId: string;
    eventType: 'CHECK_IN' | 'CHECK_OUT';
    eventTime: Date;
    tx?: any; // Optional Prisma transaction client
  }) {
    const db = params.tx || prisma;
    const { attendanceEventId, studentId, instituteId, eventType, eventTime } = params;

    // 1. Fetch Student, Institute, and Guardians with SMS enabled
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: {
        institute: {
          select: { id: true, name: true, settingsJson: true },
        },
        parentRelations: {
          where: { canReceiveSms: true },
          include: {
            parent: {
              include: {
                user: { select: { id: true, fullName: true, phone: true } },
              },
            },
          },
        },
      },
    });

    if (!student || !student.parentRelations || student.parentRelations.length === 0) {
      console.log(`[NotificationService] No SMS-eligible guardians found for student ${studentId}.`);
      return [];
    }

    // Format IST Date & Time (Asia/Kolkata timezone safe)
    const timeFormatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    const dateFormatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const timeStr = timeFormatter.format(eventTime);
    const dateStr = dateFormatter.format(eventTime);
    const instituteName = student.institute.name;
    const studentName = `${student.firstName} ${student.lastName}`;

    const templateName = eventType === 'CHECK_IN' ? 'CHECK_IN_NOTIFICATION' : 'CHECK_OUT_NOTIFICATION';
    const actionWord = eventType === 'CHECK_IN' ? 'checked in' : 'checked out';
    const messageBody = `Dear Parent, ${studentName} ${actionWord} at ${timeStr} on ${dateStr}. - ${instituteName}`;

    const createdNotifications = [];

    for (const rel of student.parentRelations) {
      const parentPhone = rel.parent.user.phone;
      if (!parentPhone) continue;

      const idempotencyKey = `ATT_${attendanceEventId}_${rel.parent.id}`;

      // Check existing notification to prevent duplicates
      const existing = await db.smsNotification.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        createdNotifications.push(existing);
        continue;
      }

      const notif = await db.smsNotification.create({
        data: {
          instituteId,
          parentId: rel.parent.id,
          studentId,
          attendanceEventId,
          phoneNumber: parentPhone,
          templateName,
          messageBody,
          status: 'QUEUED',
          idempotencyKey,
          maxRetries: 3,
        },
      });

      createdNotifications.push(notif);
    }

    // Trigger immediate outbox processing in background without blocking response
    setTimeout(() => {
      NotificationService.processPendingNotifications().catch((err) => {
        console.error('[NotificationService] Background dispatch error:', err.message);
      });
    }, 100);

    return createdNotifications;
  }

  /**
   * Process pending / queued notifications safely with concurrency lock and backoff
   */
  static async processPendingNotifications() {
    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgres')) {
      return;
    }
    if (this.isProcessing) {
      return; // Concurrency protection: already executing an outbox batch
    }

    this.isProcessing = true;
    try {
      const provider = getSmsProvider();
      const now = new Date();

      // Find pending notifications:
      // 1. Newly QUEUED
      // 2. FAILED with scheduledRetryAt <= now and retryCount < maxRetries
      const pending = await prisma.smsNotification.findMany({
        where: {
          OR: [
            { status: 'QUEUED' },
            {
              status: 'FAILED',
              retryCount: { lt: 3 },
              scheduledRetryAt: { lte: now },
            },
          ],
        },
        take: 25,
        orderBy: { createdAt: 'asc' },
      });

      if (pending.length === 0) return;

      for (const notif of pending) {
        // Atomic status transition to SENDING to prevent concurrent worker duplicate send
        const locked = await prisma.smsNotification.updateMany({
          where: {
            id: notif.id,
            status: { in: ['QUEUED', 'FAILED'] },
          },
          data: {
            status: 'SENDING',
          },
        });

        if (locked.count === 0) {
          continue; // Another process or thread claimed this notification
        }

        try {
          const result = await provider.send(notif.phoneNumber, notif.messageBody, notif.templateName);

          if (result.success) {
            // STRICT SAFETY: Do NOT mark DELIVERED unless provider confirmed real delivery!
            // When gateway accepts message, status is SENT.
            const isConfirmedDelivered = result.delivered === true;

            await prisma.smsNotification.update({
              where: { id: notif.id },
              data: {
                status: isConfirmedDelivered ? 'DELIVERED' : 'SENT',
                provider: result.provider,
                providerRef: result.providerRef || null,
                sentAt: new Date(),
                deliveredAt: isConfirmedDelivered ? new Date() : null,
                failureReason: null,
                scheduledRetryAt: null,
              },
            });
          } else {
            const nextRetryCount = notif.retryCount + 1;
            const isPermanentError =
              result.error?.includes('not configured') ||
              result.error?.includes('Invalid destination') ||
              result.error?.includes('rejected template');

            // Exponential backoff: 2m, 4m, 8m
            const retryDelayMinutes = Math.pow(2, nextRetryCount);
            const nextRetryAt =
              !isPermanentError && nextRetryCount < notif.maxRetries
                ? new Date(Date.now() + retryDelayMinutes * 60 * 1000)
                : null;

            await prisma.smsNotification.update({
              where: { id: notif.id },
              data: {
                status: 'FAILED',
                provider: result.provider,
                failureReason: result.error || 'Provider rejected delivery',
                retryCount: nextRetryCount,
                scheduledRetryAt: nextRetryAt,
              },
            });
          }
        } catch (err: any) {
          const nextRetryCount = notif.retryCount + 1;
          const retryDelayMinutes = Math.pow(2, nextRetryCount);
          const nextRetryAt =
            nextRetryCount < notif.maxRetries
              ? new Date(Date.now() + retryDelayMinutes * 60 * 1000)
              : null;

          await prisma.smsNotification.update({
            where: { id: notif.id },
            data: {
              status: 'FAILED',
              failureReason: err.message || 'Unexpected delivery failure',
              retryCount: nextRetryCount,
              scheduledRetryAt: nextRetryAt,
            },
          });
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Manually trigger a retry for an eligible failed notification
   */
  static async retryNotification(notificationId: string, instituteId: string) {
    const notif = await prisma.smsNotification.findFirst({
      where: { id: notificationId, instituteId },
    });

    if (!notif) {
      throw new Error('Notification not found in this institute');
    }

    if (notif.status === 'SENT' || notif.status === 'DELIVERED') {
      throw new Error('Notification has already been accepted/delivered successfully');
    }

    await prisma.smsNotification.update({
      where: { id: notificationId },
      data: {
        status: 'QUEUED',
        scheduledRetryAt: new Date(),
        failureReason: null,
      },
    });

    // Dispatch background processor immediately
    NotificationService.processPendingNotifications().catch(console.error);

    return { message: 'Notification re-queued for delivery' };
  }
}
