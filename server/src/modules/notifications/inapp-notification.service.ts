import { UserRole, AttendanceType } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { Response } from 'express';

// In-memory active SSE subscriber connections: userId -> Set<Response>
const activeSseClients = new Map<string, Set<Response>>();

export class InAppNotificationService {
  /**
   * Register an SSE response stream for a user
   */
  static addSseClient(userId: string, res: Response) {
    if (!activeSseClients.has(userId)) {
      activeSseClients.set(userId, new Set());
    }
    activeSseClients.get(userId)!.add(res);
  }

  /**
   * Remove an SSE response stream for a user
   */
  static removeSseClient(userId: string, res: Response) {
    const clients = activeSseClients.get(userId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        activeSseClients.delete(userId);
      }
    }
  }

  /**
   * Broadcast an event to connected SSE clients for a specific user
   */
  static broadcastToUser(userId: string, payload: any) {
    const clients = activeSseClients.get(userId);
    if (!clients || clients.size === 0) return;

    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of clients) {
      try {
        res.write(data);
      } catch (err) {
        // Socket closed or errored
        clients.delete(res);
      }
    }
  }

  /**
   * Format time in Asia/Kolkata timezone (e.g. "04:05 PM")
   */
  static formatKolkataTime(date: Date): string {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
      .format(date)
      .replace(/[\u202F\u00A0\s]+/g, ' ')
      .toUpperCase();
  }

  /**
   * Dispatch push notification to device tokens via Expo Push API
   */
  static async sendPushNotification(token: string, title: string, body: string, dataPayload: any) {
    try {
      if (!token || typeof token !== 'string') {
        return { success: false, error: 'Empty token' };
      }

      // Check for valid Expo push token format
      if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
        // For local development, tests, or mock tokens
        return { success: true, status: 'DELIVERED', mock: true };
      }

      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          to: token,
          sound: 'default',
          title,
          body,
          data: dataPayload,
          priority: 'high',
        }),
      });

      const json: any = await res.json();
      if (res.ok && json.data?.status === 'ok') {
        return { success: true, status: 'DELIVERED' };
      } else {
        return {
          success: false,
          error: json.errors?.[0]?.message || json.data?.message || 'Push gateway rejected payload',
        };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Push dispatch failed' };
    }
  }

  /**
   * Create Attendance In-App and Push Notifications for verified parent(s) and student
   * Formats exact required message strings:
   *   - Check-in: "Your child [Student Name] checked in at [Time]."
   *   - Check-out: "Your child [Student Name] checked out at [Time]."
   */
  static async createAttendanceNotifications(params: {
    attendanceEventId: string;
    studentId: string;
    instituteId: string;
    eventType: 'CHECK_IN' | 'CHECK_OUT';
    eventTime: Date;
    tx?: any;
  }) {
    const db = params.tx || prisma;
    const { attendanceEventId, studentId, instituteId, eventType, eventTime } = params;

    // 1. Fetch Student, active parent relations, and student user account
    const student = await db.student.findUnique({
      where: { id: studentId },
      include: {
        institute: { select: { id: true, name: true } },
        user: { select: { id: true, role: true, isActive: true } },
        parentRelations: {
          include: {
            parent: {
              include: {
                user: { select: { id: true, role: true, isActive: true, fullName: true } },
              },
            },
          },
        },
      },
    });

    if (!student) {
      console.warn(`[InAppNotificationService] Student ${studentId} not found`);
      return [];
    }

    const timeStr = this.formatKolkataTime(eventTime);
    const title = eventType === 'CHECK_IN' ? 'Student Check-in Alert' : 'Student Check-out Alert';
    const studentFullName = `${student.firstName} ${student.lastName}`.trim();

    // Collect eligible recipient accounts with role-specific message formatting
    const recipients: { userId: string; role: UserRole; message: string }[] = [];

    // Linked parents: "Your child [Student Name] checked in at [Time]."
    if (student.parentRelations && student.parentRelations.length > 0) {
      for (const rel of student.parentRelations) {
        if (rel.canReceiveSms !== false && rel.parent?.user?.isActive) {
          recipients.push({
            userId: rel.parent.user.id,
            role: 'PARENT',
            message: eventType === 'CHECK_IN'
              ? `Your child ${studentFullName} checked in at ${timeStr}.`
              : `Your child ${studentFullName} checked out at ${timeStr}.`,
          });
        }
      }
    }

    // Student account (if student has an active login user)
    if (student.user && student.user.isActive) {
      recipients.push({
        userId: student.user.id,
        role: 'STUDENT',
        message: eventType === 'CHECK_IN'
          ? `You checked in at ${timeStr}.`
          : `You checked out at ${timeStr}.`,
      });
    }

    const createdNotifications = [];

    for (const recipient of recipients) {
      const idempotencyKey = `ATT_${attendanceEventId}_USER_${recipient.userId}`;

      // Idempotency: skip if already created for this attendance event & recipient
      const existing = await db.notification.findUnique({
        where: { idempotencyKey },
      });

      if (existing) {
        createdNotifications.push(existing);
        continue;
      }

      // Check device push tokens for push delivery
      const deviceTokens = await prisma.devicePushToken.findMany({
        where: { userId: recipient.userId },
      });

      let pushStatus: 'PENDING' | 'DELIVERED' | 'FAILED' | 'NOT_CONFIGURED' =
        deviceTokens.length > 0 ? 'PENDING' : 'NOT_CONFIGURED';
      let pushError: string | null = null;

      const notif = await db.notification.create({
        data: {
          instituteId,
          userId: recipient.userId,
          role: recipient.role,
          title,
          message: recipient.message,
          type: 'ATTENDANCE',
          studentId,
          attendanceEventId,
          eventType: eventType as AttendanceType,
          eventTime,
          isRead: false,
          link: '/attendance',
          entityType: 'ATTENDANCE',
          entityId: attendanceEventId,
          metadata: { attendanceEventId, studentId, eventType, eventTime: eventTime.toISOString() },
          pushStatus,
          pushError,
          idempotencyKey,
        },
      });

      createdNotifications.push(notif);

      // Real-time SSE dispatch to active sessions
      this.broadcastToUser(recipient.userId, {
        type: 'NOTIFICATION_CREATED',
        data: {
          ...notif,
          timeFormatted: timeStr,
        },
      });

      // Also dispatch dedicated ATTENDANCE_RECORDED event for immediate dashboard live update
      this.broadcastToUser(recipient.userId, {
        type: 'ATTENDANCE_RECORDED',
        data: {
          studentId,
          studentName: studentFullName,
          eventType,
          eventTime,
          timeFormatted: timeStr,
          message: recipient.message,
        },
      });

      // Background push delivery if tokens configured
      if (deviceTokens.length > 0) {
        setTimeout(async () => {
          for (const dt of deviceTokens) {
            const pushResult = await this.sendPushNotification(dt.token, title, recipient.message, {
              notificationId: notif.id,
              studentId,
              attendanceEventId,
              eventType,
            });

            await prisma.notification.update({
              where: { id: notif.id },
              data: {
                pushStatus: pushResult.status === 'DELIVERED' ? 'DELIVERED' : 'FAILED',
                pushError: pushResult.error || null,
              },
            }).catch(() => { });
          }
        }, 50);
      }
    }

    return createdNotifications;
  }

  /**
   * Send in-app notification when an examination schedule is published or rescheduled.
   * Targets all enrolled students in the batch/subject and their linked parents.
   */
  static async notifyExamScheduled(examId: string, isReschedule = false) {
    const exam = await prisma.examination.findUnique({
      where: { id: examId },
      include: {
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });
    if (!exam) return [];

    const examDateStr = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(exam.examDate));

    const timeStr = exam.startTime ? ` (${exam.startTime}${exam.endTime ? ' - ' + exam.endTime : ''})` : '';
    const title = isReschedule ? `Exam Rescheduled: ${exam.title}` : `New Exam Scheduled: ${exam.title}`;
    const message = `${exam.title} for ${exam.subject.name} in batch ${exam.batch.name} is scheduled on ${examDateStr}${timeStr}. Max Marks: ${Number(exam.totalMarks)}.`;

    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        batchId: exam.batchId,
        isActive: true,
        ...(exam.subjectId ? { OR: [{ subjectId: null }, { subjectId: exam.subjectId }] } : {}),
      },
      include: {
        student: {
          include: {
            user: { select: { id: true, fullName: true } },
            parentRelations: {
              include: {
                parent: {
                  include: {
                    user: { select: { id: true, fullName: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const notifications = [];
    const notifPrefix = isReschedule ? `EXAM_RESCHED_${exam.id}_${Date.now()}` : `EXAM_SCHED_${exam.id}`;

    for (const e of enrollments) {
      const student = e.student;
      if (student.userId) {
        const idempotencyKey = `${notifPrefix}_STU_${student.userId}`;
        const existing = await prisma.notification.findUnique({ where: { idempotencyKey } });
        if (!existing) {
          const notif = await prisma.notification.create({
            data: {
              instituteId: exam.instituteId,
              userId: student.userId,
              role: 'STUDENT',
              title,
              message,
              type: 'ACADEMIC',
              studentId: student.id,
              entityType: 'EXAM',
              entityId: exam.id,
              metadata: { examId: exam.id, batchId: exam.batchId, subjectId: exam.subjectId },
              link: `/exams?examId=${exam.id}`,
              idempotencyKey,
            },
          });
          notifications.push(notif);
          this.broadcastToUser(student.userId, { type: 'NOTIFICATION_CREATED', data: notif });
        }
      }

      for (const pr of student.parentRelations) {
        const parentUser = pr.parent?.user;
        if (parentUser?.id) {
          const idempotencyKey = `${notifPrefix}_PAR_${parentUser.id}_STU_${student.id}`;
          const existing = await prisma.notification.findUnique({ where: { idempotencyKey } });
          if (!existing) {
            const notif = await prisma.notification.create({
              data: {
                instituteId: exam.instituteId,
                userId: parentUser.id,
                role: 'PARENT',
                title,
                message: `${student.firstName}'s ${exam.title} (${exam.subject.name}) is scheduled on ${examDateStr}${timeStr}.`,
                type: 'ACADEMIC',
                studentId: student.id,
                entityType: 'EXAM',
                entityId: exam.id,
                metadata: { examId: exam.id, studentId: student.id, batchId: exam.batchId },
                link: `/exams?examId=${exam.id}&studentId=${student.id}`,
                idempotencyKey,
              },
            });
            notifications.push(notif);
            this.broadcastToUser(parentUser.id, { type: 'NOTIFICATION_CREATED', data: notif });
          }
        }
      }
    }
    return notifications;
  }

  /**
   * Send in-app notification when results are officially published for an examination.
   */
  static async notifyExamResultsPublished(examId: string) {
    const exam = await prisma.examination.findUnique({
      where: { id: examId },
      include: {
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        marks: {
          include: {
            student: {
              include: {
                user: { select: { id: true } },
                parentRelations: {
                  include: {
                    parent: {
                      include: {
                        user: { select: { id: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!exam) return [];

    const notifications = [];
    const maxMarks = Number(exam.totalMarks);

    for (const mark of exam.marks) {
      const student = mark.student;
      const scoreText = mark.isAbsent
        ? 'Absent'
        : `${Number(mark.marksObtained)} / ${maxMarks} (${Math.round((Number(mark.marksObtained) / maxMarks) * 100)}%)`;
      const title = `Exam Results Published: ${exam.title}`;
      const studentMsg = `Results for ${exam.title} (${exam.subject.name}) have been published. Your score: ${scoreText}.`;
      const parentMsg = `Results for ${student.firstName}'s ${exam.title} (${exam.subject.name}) have been published. Score: ${scoreText}.`;

      if (student.userId) {
        const idempotencyKey = `EXAM_RES_${exam.id}_STU_${student.userId}`;
        const existing = await prisma.notification.findUnique({ where: { idempotencyKey } });
        if (!existing) {
          const notif = await prisma.notification.create({
            data: {
              instituteId: exam.instituteId,
              userId: student.userId,
              role: 'STUDENT',
              title,
              message: studentMsg,
              type: 'ACADEMIC',
              studentId: student.id,
              entityType: 'EXAM',
              entityId: exam.id,
              metadata: { examId: exam.id, marksObtained: mark.marksObtained },
              link: `/exams?examId=${exam.id}&results=true`,
              idempotencyKey,
            },
          });
          notifications.push(notif);
          this.broadcastToUser(student.userId, { type: 'NOTIFICATION_CREATED', data: notif });
        }
      }

      for (const pr of student.parentRelations) {
        const parentUser = pr.parent?.user;
        if (parentUser?.id) {
          const idempotencyKey = `EXAM_RES_${exam.id}_PAR_${parentUser.id}_STU_${student.id}`;
          const existing = await prisma.notification.findUnique({ where: { idempotencyKey } });
          if (!existing) {
            const notif = await prisma.notification.create({
              data: {
                instituteId: exam.instituteId,
                userId: parentUser.id,
                role: 'PARENT',
                title,
                message: parentMsg,
                type: 'ACADEMIC',
                studentId: student.id,
                entityType: 'EXAM',
                entityId: exam.id,
                metadata: { examId: exam.id, studentId: student.id, marksObtained: mark.marksObtained },
                link: `/exams?examId=${exam.id}&studentId=${student.id}&results=true`,
                idempotencyKey,
              },
            });
            notifications.push(notif);
            this.broadcastToUser(parentUser.id, { type: 'NOTIFICATION_CREATED', data: notif });
          }
        }
      }
    }
    return notifications;
  }

  /**
   * Send in-app notification when an academic progress report is published.
   */
  static async notifyProgressReportPublished(feedbackId: string, isUpdate = false) {
    const feedback = await prisma.progressFeedback.findUnique({
      where: { id: feedbackId },
      include: {
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        staff: { select: { id: true, fullName: true } },
        student: {
          include: {
            user: { select: { id: true } },
            parentRelations: {
              include: {
                parent: {
                  include: {
                    user: { select: { id: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!feedback) return [];

    const notifications = [];
    const student = feedback.student;
    const subjectName = feedback.subject?.name ? ` - ${feedback.subject.name}` : '';
    const title = isUpdate
      ? `Progress Report Updated: ${feedback.termName}`
      : `New Progress Report: ${feedback.termName}`;

    const studentMsg = `Your academic progress report for ${feedback.termName}${subjectName} is now available. Evaluated by ${feedback.staff.fullName}.`;
    const parentMsg = `Academic progress report for ${student.firstName} (${feedback.termName}${subjectName}) has been published by ${feedback.staff.fullName}.`;
    const notifPrefix = isUpdate ? `PROG_REP_${feedback.id}_${Date.now()}` : `PROG_REP_${feedback.id}`;

    // 1. Notify Student
    if (student.userId) {
      const idempotencyKey = `${notifPrefix}_STU_${student.userId}`;
      const existing = await prisma.notification.findUnique({ where: { idempotencyKey } });
      if (!existing) {
        const notif = await prisma.notification.create({
          data: {
            instituteId: feedback.instituteId,
            userId: student.userId,
            role: 'STUDENT',
            title,
            message: studentMsg,
            type: 'ACADEMIC',
            studentId: student.id,
            entityType: 'PROGRESS_REPORT',
            entityId: feedback.id,
            metadata: { feedbackId: feedback.id, termName: feedback.termName },
            link: `/progress_reviews?reportId=${feedback.id}`,
            idempotencyKey,
          },
        });
        notifications.push(notif);
        this.broadcastToUser(student.userId, { type: 'NOTIFICATION_CREATED', data: notif });
      }
    }

    // 2. Notify linked Parents
    for (const pr of student.parentRelations) {
      const parentUser = pr.parent?.user;
      if (parentUser?.id) {
        const idempotencyKey = `${notifPrefix}_PAR_${parentUser.id}_STU_${student.id}`;
        const existing = await prisma.notification.findUnique({ where: { idempotencyKey } });
        if (!existing) {
          const notif = await prisma.notification.create({
            data: {
              instituteId: feedback.instituteId,
              userId: parentUser.id,
              role: 'PARENT',
              title,
              message: parentMsg,
              type: 'ACADEMIC',
              studentId: student.id,
              entityType: 'PROGRESS_REPORT',
              entityId: feedback.id,
              metadata: { feedbackId: feedback.id, studentId: student.id, termName: feedback.termName },
              link: `/parent_academics?reportId=${feedback.id}&studentId=${student.id}`,
              idempotencyKey,
            },
          });
          notifications.push(notif);
          this.broadcastToUser(parentUser.id, { type: 'NOTIFICATION_CREATED', data: notif });
        }
      }
    }

    return notifications;
  }

  /**
   * Send notification to parent when staff replies to their feedback
   */
  static async notifyParentFeedbackReplied(reviewId: string) {
    const review = await prisma.parentReview.findUnique({
      where: { id: reviewId },
      include: {
        parent: { include: { user: { select: { id: true, fullName: true } } } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!review || !review.parent?.user?.id) return null;

    const parentUserId = review.parent.user.id;
    const title = `Reply to Your Feedback: ${review.subject || 'Faculty Response'}`;
    const preview = (review.replyText || '').slice(0, 100);
    const message = `Faculty / Administration replied: "${preview}${review.replyText && review.replyText.length > 100 ? '...' : ''}"`;
    const idempotencyKey = `FEEDBACK_REPLY_${review.id}_${Date.now()}`;

    const notif = await prisma.notification.create({
      data: {
        instituteId: review.instituteId,
        userId: parentUserId,
        role: 'PARENT',
        title,
        message,
        type: 'GENERAL',
        studentId: review.studentId || null,
        entityType: 'PROGRESS_REPORT',
        entityId: review.id,
        metadata: { reviewId: review.id, studentId: review.studentId },
        link: `/progress_reviews?reviewId=${review.id}`,
        idempotencyKey,
      },
    });

    this.broadcastToUser(parentUserId, { type: 'NOTIFICATION_CREATED', data: notif });
    return notif;
  }

  /**
   * Dispatch in-app notification and SSE alert for new chat message
   */
  static async notifyNewChatMessage(params: {
    conversationId: string;
    messageId: string;
    senderId: string;
    senderName: string;
    recipientUserId: string;
    recipientRole: UserRole;
    instituteId: string;
    studentId?: string | null;
    body: string;
    attachmentType?: string | null;
  }) {
    try {
      const {
        conversationId,
        messageId,
        senderId,
        senderName,
        recipientUserId,
        recipientRole,
        instituteId,
        studentId,
        body,
        attachmentType,
      } = params;

      if (!recipientUserId || recipientUserId === senderId) return null;

      let preview = body ? (body.length > 80 ? body.slice(0, 80) + '...' : body) : '';
      if (!preview) {
        if (attachmentType === 'AUDIO') preview = '🎤 Sent a voice message';
        else if (attachmentType === 'IMAGE') preview = '📷 Sent an image attachment';
        else if (attachmentType === 'DOCUMENT') preview = '📄 Sent a document attachment';
        else preview = 'Sent an attachment';
      }

      const title = `Message from ${senderName}`;
      const idempotencyKey = `CHAT_MSG_${messageId}_RECIPIENT_${recipientUserId}`;

      const notif = await prisma.notification.upsert({
        where: { idempotencyKey },
        create: {
          instituteId,
          userId: recipientUserId,
          role: recipientRole,
          title,
          message: preview,
          type: 'MESSAGE',
          studentId: studentId || null,
          entityType: 'MESSAGE',
          entityId: conversationId,
          metadata: { conversationId, messageId, senderId, senderName, studentId: studentId || null },
          link: `/messaging?conversationId=${conversationId}`,
          idempotencyKey,
        },
        update: {},
      });

      this.broadcastToUser(recipientUserId, {
        type: 'NEW_CHAT_MESSAGE',
        conversationId,
        notification: notif,
        messageId,
      });

      this.broadcastToUser(recipientUserId, {
        type: 'MESSAGE_CREATED',
        data: {
          conversationId,
          message: {
            id: messageId,
            conversationId,
            senderId,
            body,
            attachmentType,
            createdAt: new Date().toISOString(),
            sender: { fullName: senderName, role: 'STAFF' },
          },
        },
      });

      this.broadcastToUser(recipientUserId, {
        type: 'NOTIFICATION_CREATED',
        data: notif,
      });

      return notif;
    } catch (err) {
      console.warn('[notifyNewChatMessage Warning]', err);
      return null;
    }
  }

  /**
   * Dispatch in-app notification when a student submits homework
   */
  static async notifyHomeworkSubmitted(submissionId: string) {
    try {
      const sub = await prisma.homeworkSubmission.findUnique({
        where: { id: submissionId },
        include: {
          material: {
            include: {
              batch: { select: { id: true, name: true } },
              uploader: { select: { id: true, role: true } },
            },
          },
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              instituteId: true,
            },
          },
        },
      });

      if (!sub || !sub.material.uploaderId) return null;

      const teacherUserId = sub.material.uploaderId;
      const teacherRole = sub.material.uploader?.role || 'STAFF';
      const studentName = `${sub.student.firstName} ${sub.student.lastName}`.trim();
      const idempotencyKey = `hw_sub_${sub.id}`;

      const notif = await prisma.notification.upsert({
        where: { idempotencyKey },
        create: {
          instituteId: sub.student.instituteId,
          userId: teacherUserId,
          role: teacherRole as UserRole,
          title: `Homework Submitted: ${sub.material.title}`,
          message: `${studentName} submitted work for ${sub.material.title} (${sub.material.batch?.name || 'Batch'}).`,
          type: 'ACADEMIC',
          studentId: sub.student.id,
          entityType: 'HOMEWORK',
          entityId: sub.materialId,
          metadata: { homeworkId: sub.materialId, submissionId: sub.id, studentId: sub.student.id },
          link: `/homework?homeworkId=${sub.materialId}&submissionId=${sub.id}`,
          idempotencyKey,
        },
        update: {},
      });

      this.broadcastToUser(teacherUserId, {
        type: 'NOTIFICATION_RECEIVED',
        notification: notif,
      });

      return notif;
    } catch (err) {
      console.warn('[notifyHomeworkSubmitted Warning]', err);
      return null;
    }
  }

  /**
   * Dispatch in-app notifications to student and linked parents when homework is graded
   */
  static async notifyHomeworkGraded(submissionId: string) {
    try {
      const sub = await prisma.homeworkSubmission.findUnique({
        where: { id: submissionId },
        include: {
          material: { select: { id: true, title: true, instituteId: true } },
          student: {
            include: {
              user: { select: { id: true, role: true } },
              parentRelations: {
                include: {
                  parent: { include: { user: { select: { id: true, role: true } } } },
                },
              },
            },
          },
        },
      });

      if (!sub) return null;

      const studentName = `${sub.student.firstName} ${sub.student.lastName}`.trim();
      const gradeText = sub.grade ? `Grade: ${sub.grade}` : 'Completed';
      const feedbackText = sub.feedback ? ` • "${sub.feedback}"` : '';

      // 1. Notify Student
      if (sub.student.userId) {
        const studentKey = `hw_grade_${sub.id}_student`;
        const studentNotif = await prisma.notification.upsert({
          where: { idempotencyKey: studentKey },
          create: {
            instituteId: sub.student.instituteId,
            userId: sub.student.userId,
            role: 'STUDENT',
            title: `Homework Graded: ${sub.material.title}`,
            message: `Your assignment has been graded. ${gradeText}${feedbackText}`,
            type: 'ACADEMIC',
            studentId: sub.student.id,
            entityType: 'HOMEWORK',
            entityId: sub.materialId,
            metadata: { homeworkId: sub.materialId, submissionId: sub.id, grade: sub.grade },
            link: `/homework?homeworkId=${sub.materialId}`,
            idempotencyKey: studentKey,
          },
          update: {},
        });

        this.broadcastToUser(sub.student.userId, {
          type: 'NOTIFICATION_RECEIVED',
          notification: studentNotif,
        });
      }

      // 2. Notify Linked Parents
      for (const rel of sub.student.parentRelations) {
        const parentUserId = rel.parent?.userId;
        if (!parentUserId) continue;

        const parentKey = `hw_grade_${sub.id}_parent_${parentUserId}`;
        const parentNotif = await prisma.notification.upsert({
          where: { idempotencyKey: parentKey },
          create: {
            instituteId: sub.student.instituteId,
            userId: parentUserId,
            role: 'PARENT',
            title: `Homework Graded: ${sub.material.title}`,
            message: `${studentName}'s assignment was graded. ${gradeText}${feedbackText}`,
            type: 'ACADEMIC',
            studentId: sub.student.id,
            entityType: 'HOMEWORK',
            entityId: sub.materialId,
            metadata: { homeworkId: sub.materialId, submissionId: sub.id, studentId: sub.student.id, grade: sub.grade },
            link: `/parent_academics?homeworkId=${sub.materialId}&studentId=${sub.student.id}`,
            idempotencyKey: parentKey,
          },
          update: {},
        });

        this.broadcastToUser(parentUserId, {
          type: 'NOTIFICATION_RECEIVED',
          notification: parentNotif,
        });
      }

      return true;
    } catch (err) {
      console.warn('[notifyHomeworkGraded Warning]', err);
      return null;
    }
  }

  /**
   * Dispatch in-app notification when a fee payment is recorded
   */
  static async notifyFeePaymentRecorded(paymentId: string) {
    try {
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
          feeAssignment: {
            include: {
              feeStructure: { select: { name: true } },
            },
          },
          student: {
            include: {
              user: { select: { id: true, role: true } },
              parentRelations: {
                include: {
                  parent: { include: { user: { select: { id: true, role: true } } } },
                },
              },
            },
          },
        },
      });

      if (!payment) return null;

      const student = payment.student;
      const feeName = payment.feeAssignment.feeStructure.name;
      const amountStr = Number(payment.amountPaid).toLocaleString('en-IN');
      const studentName = `${student.firstName} ${student.lastName}`.trim();

      // Notify Linked Parents
      for (const rel of student.parentRelations) {
        const parentUserId = rel.parent?.userId;
        if (!parentUserId) continue;

        const parentKey = `fee_pay_${payment.id}_parent_${parentUserId}`;
        const parentNotif = await prisma.notification.upsert({
          where: { idempotencyKey: parentKey },
          create: {
            instituteId: student.instituteId,
            userId: parentUserId,
            role: 'PARENT',
            title: `Fee Payment Recorded: ₹${amountStr}`,
            message: `Payment of ₹${amountStr} for ${feeName} (${studentName}) was recorded successfully. Receipt #${payment.receiptNumber || payment.id.slice(0, 8)}.`,
            type: 'GENERAL',
            studentId: student.id,
            entityType: 'FEE',
            entityId: payment.id,
            metadata: { paymentId: payment.id, receiptNumber: payment.receiptNumber, studentId: student.id },
            link: `/parent_fees?paymentId=${payment.id}&receipt=true`,
            idempotencyKey: parentKey,
          },
          update: {},
        });

        this.broadcastToUser(parentUserId, {
          type: 'NOTIFICATION_RECEIVED',
          notification: parentNotif,
        });
      }

      return true;
    } catch (err) {
      console.warn('[notifyFeePaymentRecorded Warning]', err);
      return null;
    }
  }


  /**
   * Dispatch in-app notifications when learning material is published
   */
  static async notifyMaterialPublished(materialId: string) {
    try {
      const material = await prisma.learningMaterial.findUnique({
        where: { id: materialId },
        include: {
          batch: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
        },
      });

      if (!material || !material.isPublished) return [];

      const enrollments = await prisma.studentEnrollment.findMany({
        where: {
          batchId: material.batchId,
          isActive: true,
          ...(material.subjectId ? { OR: [{ subjectId: null }, { subjectId: material.subjectId }] } : {}),
        },
        include: {
          student: {
            include: {
              user: { select: { id: true } },
              parentRelations: {
                include: {
                  parent: { include: { user: { select: { id: true } } } },
                },
              },
            },
          },
        },
      });

      const notifications = [];
      const mediaLabel = material.type === 'VOICE_NOTE' ? 'Voice Lesson' : 'Learning Material';
      const title = `New ${mediaLabel}: ${material.title}`;
      const message = `New ${mediaLabel.toLowerCase()} published for ${material.subject?.name || 'Class'} in ${material.batch.name}.`;

      for (const e of enrollments) {
        const student = e.student;
        // 1. Notify Student
        if (student.userId) {
          const studentKey = `MAT_PUB_${material.id}_STU_${student.userId}`;
          const notif = await prisma.notification.upsert({
            where: { idempotencyKey: studentKey },
            create: {
              instituteId: material.instituteId,
              userId: student.userId,
              role: 'STUDENT',
              title,
              message,
              type: 'ACADEMIC',
              studentId: student.id,
              entityType: 'MATERIAL',
              entityId: material.id,
              metadata: { materialId: material.id, mediaType: material.type, title: material.title },
              link: `/materials?materialId=${material.id}`,
              idempotencyKey: studentKey,
            },
            update: {},
          });
          notifications.push(notif);
          this.broadcastToUser(student.userId, { type: 'NOTIFICATION_CREATED', data: notif });
        }

        // 2. Notify Parents
        for (const pr of student.parentRelations) {
          const parentUser = pr.parent?.user;
          if (parentUser?.id) {
            const parentKey = `MAT_PUB_${material.id}_PAR_${parentUser.id}_STU_${student.id}`;
            const notif = await prisma.notification.upsert({
              where: { idempotencyKey: parentKey },
              create: {
                instituteId: material.instituteId,
                userId: parentUser.id,
                role: 'PARENT',
                title,
                message: `${student.firstName}'s class has new ${mediaLabel.toLowerCase()}: "${material.title}"`,
                type: 'ACADEMIC',
                studentId: student.id,
                entityType: 'MATERIAL',
                entityId: material.id,
                metadata: { materialId: material.id, studentId: student.id, mediaType: material.type },
                link: `/parent_academics?materialId=${material.id}&studentId=${student.id}`,
                idempotencyKey: parentKey,
              },
              update: {},
            });
            notifications.push(notif);
            this.broadcastToUser(parentUser.id, { type: 'NOTIFICATION_CREATED', data: notif });
          }
        }
      }
      return notifications;
    } catch (err) {
      console.warn('[notifyMaterialPublished Warning]', err);
      return [];
    }
  }

  /**
   * Dispatch in-app notifications when a quiz is published
   */
  static async notifyQuizPublished(quizId: string) {
    try {
      const quiz = await prisma.quiz.findUnique({
        where: { id: quizId },
        include: {
          batch: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true } },
        },
      });

      if (!quiz || !quiz.isPublished) return [];

      const enrollments = await prisma.studentEnrollment.findMany({
        where: {
          batchId: quiz.batchId,
          isActive: true,
          ...(quiz.subjectId ? { OR: [{ subjectId: null }, { subjectId: quiz.subjectId }] } : {}),
        },
        include: {
          student: {
            include: {
              user: { select: { id: true } },
            },
          },
        },
      });

      const notifications = [];
      const title = `New Interactive Quiz: ${quiz.title}`;
      const timeStr = quiz.durationMinutes ? ` (${quiz.durationMinutes} mins)` : '';
      const message = `Interactive quiz${timeStr} for ${quiz.subject?.name || 'Class'} is ready to take.`;

      for (const e of enrollments) {
        const student = e.student;
        if (student.userId) {
          const studentKey = `QUIZ_PUB_${quiz.id}_STU_${student.userId}`;
          const notif = await prisma.notification.upsert({
            where: { idempotencyKey: studentKey },
            create: {
              instituteId: quiz.instituteId,
              userId: student.userId,
              role: 'STUDENT',
              title,
              message,
              type: 'ACADEMIC',
              studentId: student.id,
              entityType: 'QUIZ',
              entityId: quiz.id,
              metadata: { quizId: quiz.id, durationMinutes: quiz.durationMinutes, title: quiz.title },
              link: `/homework?quizId=${quiz.id}`,
              idempotencyKey: studentKey,
            },
            update: {},
          });
          notifications.push(notif);
          this.broadcastToUser(student.userId, { type: 'NOTIFICATION_CREATED', data: notif });
        }
      }
      return notifications;
    } catch (err) {
      console.warn('[notifyQuizPublished Warning]', err);
      return [];
    }
  }

}
