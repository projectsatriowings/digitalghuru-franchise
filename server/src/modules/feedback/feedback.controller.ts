import { Response } from 'express';

import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { InAppNotificationService } from '../notifications/inapp-notification.service.js';
import { getAuthorizedStudentScope, isStudentAuthorized } from '../students/student-authorization.service.js';

import { prisma } from '../../prisma.js';

export const FEEDBACK_CATEGORIES = [
  'Academic Progress',
  'Teaching Method',
  'Attendance',
  'Student Behaviour',
  'Homework',
  'General Feedback',
] as const;

export const submitFeedbackSchema = z.object({
  studentId: z.string().uuid('Valid Student ID is required'),
  staffId: z.string().uuid('Valid Teacher ID required').optional().nullable(),
  category: z.enum(FEEDBACK_CATEGORIES, {
    errorMap: () => ({ message: 'Invalid category. Choose from: Academic Progress, Teaching Method, Attendance, Student Behaviour, Homework, General Feedback' }),
  }),
  feedbackText: z.string().min(5, 'Feedback must be at least 5 characters').max(2000, 'Feedback must not exceed 2000 characters'),
});

export const respondFeedbackSchema = z.object({
  response: z.string().min(2, 'Response must be at least 2 characters').max(2000, 'Response must not exceed 2000 characters'),
  status: z.enum(['RESPONDED', 'RESOLVED']).default('RESPONDED'),
});

export const updateFeedbackStatusSchema = z.object({
  status: z.enum(['OPEN', 'RESPONDED', 'RESOLVED'], {
    errorMap: () => ({ message: 'Status must be OPEN, RESPONDED, or RESOLVED' }),
  }),
});

/**
 * 1. Submit structured parent feedback
 */
export async function submitFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    if (req.user?.role !== 'PARENT') {
      return res.status(403).json({ success: false, error: 'Only authorized parents can submit feedback' });
    }

    const parse = submitFeedbackSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Validation failed',
        details: parse.error.errors,
      });
    }

    const { studentId, staffId, category, feedbackText } = parse.data;

    // Verify parent profile exists for caller
    const parentProfile = await prisma.parentProfile.findFirst({
      where: { userId: req.user.userId },
    });
    if (!parentProfile) {
      return res.status(404).json({ success: false, error: 'Parent profile not found' });
    }

    // Verify parent-student relationship & institute match
    const relation = await prisma.studentParentRelation.findFirst({
      where: {
        studentId,
        parentId: parentProfile.id,
      },
      include: {
        student: {
          select: { id: true, firstName: true, lastName: true, instituteId: true },
        },
      },
    });

    if (!relation || relation.student.instituteId !== instituteId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to submit feedback for this student',
      });
    }

    // If a specific staffId was designated, verify they belong to the same institute
    if (staffId) {
      const staffMember = await prisma.instituteMembership.findFirst({
        where: {
          instituteId,
          userId: staffId,
          isActive: true,
          role: { in: ['STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'] },
        },
      });
      if (!staffMember) {
        return res.status(404).json({ success: false, error: 'Target faculty member not found in this institute' });
      }
    }

    const feedback = await prisma.parentFeedback.create({
      data: {
        instituteId,
        parentId: parentProfile.id,
        studentId,
        staffId: staffId || null,
        category,
        feedbackText: feedbackText.trim(),
        status: 'OPEN',
      },
      include: {
        parent: { include: { user: { select: { fullName: true, email: true, phone: true } } } },
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        staff: { select: { id: true, fullName: true, role: true } },
      },
    });

    // Record Audit Log
    await prisma.auditLog.create({
      data: {
        instituteId,
        userId: req.user.userId,
        action: 'SUBMIT_PARENT_FEEDBACK',
        entityType: 'ParentFeedback',
        entityId: feedback.id,
        newValues: { studentId, category, staffId },
      },
    }).catch(() => {});

    // If teacher target was specified, create in-app notification & dispatch real-time SSE
    if (staffId) {
      try {
        const notif = await prisma.notification.create({
          data: {
            instituteId,
            userId: staffId,
            role: 'STAFF',
            title: 'New Parent Feedback Received',
            message: `Feedback received regarding ${relation.student.firstName} on ${category}.`,
            type: 'GENERAL',
            studentId,
            link: '/feedback',
            isRead: false,
          },
        });

        InAppNotificationService.broadcastToUser(staffId, {
          type: 'NOTIFICATION_CREATED',
          data: notif,
        });

        InAppNotificationService.broadcastToUser(staffId, {
          type: 'FEEDBACK_CREATED',
          data: feedback,
        });
      } catch (err: any) {
        console.warn('[Feedback Notification Warning]:', err.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: { feedback },
    });
  } catch (err: any) {
    console.error('[Submit Feedback Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to submit feedback' });
  }
}

/**
 * 2. List feedback with strict role-based access control
 */
export async function listFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const { role, userId } = req.user!;
    const studentIdFilter = req.query.studentId as string | undefined;
    const statusFilter = req.query.status as string | undefined;
    const categoryFilter = req.query.category as string | undefined;

    const where: any = { instituteId };

    if (studentIdFilter) where.studentId = studentIdFilter;
    if (statusFilter) where.status = statusFilter;
    if (categoryFilter) where.category = categoryFilter;

    if (role === 'PARENT') {
      const parentProfile = await prisma.parentProfile.findFirst({
        where: { userId },
      });
      if (!parentProfile) {
        return res.json({ success: true, data: { feedbacks: [] } });
      }
      where.parentId = parentProfile.id;
    } else if (role === 'STAFF') {
      // Staff can see feedback assigned to them OR feedback for students in their assigned batches
      const scope = await getAuthorizedStudentScope(req, prisma);
      where.OR = [
        { staffId: userId },
        { student: scope.whereClause },
      ];
    } else if (role === 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Forbidden: Students cannot view parent feedback' });
    }
    // SUPER_ADMIN and ACADEMIC_ADMIN see all feedback within institute

    const feedbacks = await prisma.parentFeedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        parent: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        staff: { select: { id: true, fullName: true, role: true } },
        respondedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    return res.json({
      success: true,
      data: { feedbacks },
    });
  } catch (err: any) {
    console.error('[List Feedback Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve feedback list' });
  }
}

/**
 * 3. Retrieve single feedback item with privacy check
 */
export async function getFeedbackById(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const { id } = req.params;
    const { role, userId } = req.user!;

    const feedback = await prisma.parentFeedback.findFirst({
      where: { id, instituteId },
      include: {
        parent: { include: { user: { select: { id: true, fullName: true, phone: true } } } },
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        staff: { select: { id: true, fullName: true, role: true } },
        respondedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    if (!feedback) {
      return res.status(404).json({ success: false, error: 'Feedback record not found' });
    }

    // Role-based privacy verification
    if (role === 'PARENT') {
      const parentProfile = await prisma.parentProfile.findFirst({ where: { userId } });
      if (!parentProfile || feedback.parentId !== parentProfile.id) {
        return res.status(403).json({ success: false, error: 'Forbidden: You cannot access this feedback' });
      }
    } else if (role === 'STAFF') {
      if (feedback.staffId !== userId) {
        const isAuth = await isStudentAuthorized(req, feedback.studentId, prisma);
        if (!isAuth) {
          return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this student' });
        }
      }
    } else if (role === 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    return res.json({
      success: true,
      data: { feedback },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to retrieve feedback' });
  }
}

/**
 * 4. Teacher / Admin responds to parent feedback
 */
export async function respondToFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const { id } = req.params;
    const { role, userId } = req.user!;

    if (role === 'PARENT' || role === 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Only authorized faculty or admin can respond to feedback' });
    }

    const parse = respondFeedbackSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Validation failed',
      });
    }

    const { response, status } = parse.data;

    const feedback = await prisma.parentFeedback.findFirst({
      where: { id, instituteId },
      include: {
        parent: { include: { user: { select: { id: true, fullName: true } } } },
        student: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!feedback) {
      return res.status(404).json({ success: false, error: 'Feedback record not found' });
    }

    // If STAFF, verify they are assigned or target
    if (role === 'STAFF') {
      if (feedback.staffId && feedback.staffId !== userId) {
        const isStudentAuth = await isStudentAuthorized(req, feedback.studentId, prisma);
        if (!isStudentAuth) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: You are not assigned to this student or feedback item',
          });
        }
      }
    }

    const serverNow = new Date();

    const updated = await prisma.parentFeedback.update({
      where: { id },
      data: {
        teacherResponse: response.trim(),
        respondedAt: serverNow,
        respondedById: userId,
        status: status || 'RESPONDED',
      },
      include: {
        parent: { include: { user: { select: { id: true, fullName: true } } } },
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        staff: { select: { id: true, fullName: true, role: true } },
        respondedBy: { select: { id: true, fullName: true, role: true } },
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        instituteId,
        userId,
        action: 'RESPOND_PARENT_FEEDBACK',
        entityType: 'ParentFeedback',
        entityId: id,
        newValues: { status: updated.status, respondedAt: serverNow },
      },
    }).catch(() => {});

    // Create in-app notification for the parent
    const parentUserId = feedback.parent.user.id;
    try {
      const notif = await prisma.notification.create({
        data: {
          instituteId,
          userId: parentUserId,
          role: 'PARENT',
          title: 'Teacher Responded to Feedback',
          message: `Faculty responded to your feedback on ${feedback.category} for ${feedback.student.firstName}.`,
          type: 'GENERAL',
          studentId: feedback.studentId,
          link: '/communication',
          isRead: false,
        },
      });

      // Deliver via real-time SSE to parent
      InAppNotificationService.broadcastToUser(parentUserId, {
        type: 'NOTIFICATION_CREATED',
        data: notif,
      });

      InAppNotificationService.broadcastToUser(parentUserId, {
        type: 'FEEDBACK_UPDATED',
        data: updated,
      });
    } catch (notifErr: any) {
      console.warn('[Feedback Notification Error]:', notifErr.message);
    }

    return res.json({
      success: true,
      message: 'Response posted successfully',
      data: { feedback: updated },
    });
  } catch (err: any) {
    console.error('[Respond Feedback Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to post response' });
  }
}

/**
 * 5. Update feedback status (e.g. mark RESOLVED)
 */
export async function updateFeedbackStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const { id } = req.params;
    const { role, userId } = req.user!;

    const parse = updateFeedbackStatusSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });
    }

    const feedback = await prisma.parentFeedback.findFirst({
      where: { id, instituteId },
      include: {
        parent: { include: { user: { select: { id: true } } } },
      },
    });

    if (!feedback) {
      return res.status(404).json({ success: false, error: 'Feedback record not found' });
    }

    // Authorization: parent of student OR staff/admin
    if (role === 'PARENT') {
      if (feedback.parent.user.id !== userId) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
    } else if (role === 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const updated = await prisma.parentFeedback.update({
      where: { id },
      data: { status: parse.data.status },
    });

    return res.json({
      success: true,
      message: `Feedback status updated to ${parse.data.status}`,
      data: { feedback: updated },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update feedback status' });
  }
}
