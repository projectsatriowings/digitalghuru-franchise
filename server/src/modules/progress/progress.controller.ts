import { Response } from 'express';
import { Prisma  } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import {
  isStaffAssignedToBatch,
  isStaffAssignedToBatchSubject,
  getAuthorizedStudentScope,
  isStudentAuthorized,
} from '../students/student-authorization.service.js';
import { InAppNotificationService } from '../notifications/inapp-notification.service.js';

export const createFeedbackSchema = z.object({
  studentId: z.string().uuid('Valid Student ID required'),
  batchId: z.string().uuid('Valid Batch ID required'),
  subjectId: z.string().uuid().optional().nullable(),
  termName: z.string().min(2, 'Term / evaluation period title is required').max(100),
  periodType: z.enum(['WEEKLY', 'MONTHLY', 'TERM', 'ANNUAL']).default('TERM'),
  startDate: z.string().optional().nullable(), // YYYY-MM-DD
  endDate: z.string().optional().nullable(),   // YYYY-MM-DD
  remarks: z.string().min(3, 'Observations and teacher remarks are required').max(2000),
  rating: z.union([z.number(), z.string().transform((v) => parseInt(v, 10))]).optional().nullable(),
  strengths: z.string().optional().nullable(),
  improvements: z.string().optional().nullable(),
  recommendations: z.string().optional().nullable(),
  isPublished: z.union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')]).optional().default(false),
});

export const updateFeedbackSchema = z.object({
  termName: z.string().min(2).max(100).optional(),
  periodType: z.enum(['WEEKLY', 'MONTHLY', 'TERM', 'ANNUAL']).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  remarks: z.string().min(3).max(2000).optional(),
  rating: z.union([z.number(), z.string().transform((v) => parseInt(v, 10))]).optional().nullable(),
  strengths: z.string().optional().nullable(),
  improvements: z.string().optional().nullable(),
  recommendations: z.string().optional().nullable(),
  isPublished: z.union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')]).optional(),
});

/**
 * Derives accurate, real-time database aggregates from Attendance, Homework, and Published Exams
 */
export async function calculateStudentPerformanceMetrics(params: {
  studentId: string;
  batchId?: string;
  subjectId?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
  instituteId: string;
}) {
  const { studentId, batchId, subjectId, startDate, endDate, instituteId } = params;

  // 1. Attendance Metrics
  const attWhere: any = {
    studentId,
    instituteId,
    ...(batchId ? { batchId } : {}),
    ...(startDate || endDate ? {
      eventDate: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      },
    } : {}),
  };
  const attendanceEvents = await prisma.attendanceEvent.findMany({
    where: attWhere,
    select: { eventType: true, isLate: true },
  });
  const totalAttendanceEvents = attendanceEvents.length;
  const presentCount = attendanceEvents.filter((e) => e.eventType === 'CHECK_IN').length;
  const lateCount = attendanceEvents.filter((e) => e.isLate).length;
  const attendanceRate = totalAttendanceEvents > 0
    ? parseFloat(((presentCount / totalAttendanceEvents) * 100).toFixed(1))
    : null;

  // 2. Homework / Task Metrics
  const hwWhere: any = {
    instituteId,
    type: 'HOMEWORK',
    isPublished: true,
    ...(batchId ? { batchId } : {}),
    ...(subjectId ? { subjectId } : {}),
    ...(startDate || endDate ? {
      dueDate: {
        ...(startDate ? { gte: startDate } : {}),
        ...(endDate ? { lte: endDate } : {}),
      },
    } : {}),
  };
  const eligibleHomeworks = await prisma.learningMaterial.findMany({
    where: hwWhere,
    select: {
      id: true,
      title: true,
      dueDate: true,
      submissions: {
        where: { studentId },
        select: { id: true, status: true, grade: true, submittedAt: true },
      },
    },
  });
  const totalHomeworks = eligibleHomeworks.length;
  const completedHwCount = eligibleHomeworks.filter(
    (h) => h.submissions.length > 0 && ['COMPLETED', 'GRADED', 'SUBMITTED'].includes(h.submissions[0].status)
  ).length;
  const homeworkRate = totalHomeworks > 0
    ? parseFloat(((completedHwCount / totalHomeworks) * 100).toFixed(1))
    : null;

  // 3. Published Exam Marks Metrics
  const examMarkWhere: any = {
    studentId,
    isPublished: true,
    exam: {
      instituteId,
      isResultsPublished: true,
      ...(batchId ? { batchId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(startDate || endDate ? {
        examDate: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
      } : {}),
    },
  };
  const examMarks = await prisma.examMark.findMany({
    where: examMarkWhere,
    include: {
      exam: { select: { id: true, title: true, totalMarks: true, passingMarks: true } },
    },
  });
  let totalMaxMarks = 0;
  let totalMarksObtained = 0;
  let passedExamsCount = 0;
  for (const m of examMarks) {
    const max = Number(m.exam.totalMarks);
    const score = Number(m.marksObtained);
    totalMaxMarks += max;
    totalMarksObtained += score;
    if (score >= Number(m.exam.passingMarks)) {
      passedExamsCount++;
    }
  }
  const examAverage = totalMaxMarks > 0
    ? parseFloat(((totalMarksObtained / totalMaxMarks) * 100).toFixed(1))
    : null;

  return {
    attendance: {
      totalSessions: totalAttendanceEvents,
      presentCount,
      lateCount,
      attendanceRate,
    },
    homework: {
      totalAssigned: totalHomeworks,
      completedCount: completedHwCount,
      pendingCount: Math.max(0, totalHomeworks - completedHwCount),
      homeworkRate,
    },
    exams: {
      totalExams: examMarks.length,
      passedCount: passedExamsCount,
      totalMaxMarks,
      totalMarksObtained,
      examAverage,
    },
  };
}

/**
 * Preview performance metrics for a student before drafting feedback (Staff / Admin)
 */
export async function getMetricsPreview(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const studentId = req.query.studentId as string;
    const batchId = req.query.batchId as string;
    const subjectId = (req.query.subjectId as string) || null;
    const startDateStr = req.query.startDate as string;
    const endDateStr = req.query.endDate as string;

    if (!studentId) {
      return res.status(400).json({ success: false, error: 'Student ID is required' });
    }

    const startDate = startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;

    const metrics = await calculateStudentPerformanceMetrics({
      studentId,
      batchId,
      subjectId,
      startDate,
      endDate,
      instituteId,
    });

    return res.json({
      success: true,
      data: { metrics },
    });
  } catch (err: any) {
    console.error('[Get Metrics Preview Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to preview metrics' });
  }
}

/**
 * List progress feedbacks with filtering (Staff, Admin, Parent, Student)
 */
export async function listProgressFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const batchId = req.query.batchId as string;
    const subjectId = req.query.subjectId as string;
    const studentId = req.query.studentId as string;
    const status = req.query.status as string; // 'DRAFT', 'PUBLISHED', 'ALL'
    const search = (req.query.search as string || '').trim().toLowerCase();

    const where: any = { instituteId };

    // 1. Role-based scoping
    if (req.user?.role === 'STAFF') {
      const scope = await getAuthorizedStudentScope(req, prisma, { batchId, subjectId });
      const authorizedBatchIds = scope.assignedBatchIds || [];

      if (batchId) {
        if (!authorizedBatchIds.includes(batchId)) {
          return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
        }
        where.batchId = batchId;
      } else {
        where.batchId = { in: authorizedBatchIds };
      }

      if (subjectId) {
        where.subjectId = subjectId;
      }
      if (studentId) {
        where.studentId = studentId;
      }
      if (status === 'DRAFT') {
        where.isPublished = false;
      } else if (status === 'PUBLISHED') {
        where.isPublished = true;
      }
    } else if (req.user?.role === 'PARENT') {
      // Parents ONLY see published reports for linked children
      where.isPublished = true;
      const relations = await prisma.studentParentRelation.findMany({
        where: { parent: { userId: req.user.userId } },
        select: { studentId: true },
      });
      const linkedStudentIds = relations.map((r) => r.studentId);
      if (linkedStudentIds.length === 0) {
        return res.json({ success: true, data: { feedbacks: [] } });
      }

      if (studentId) {
        if (!linkedStudentIds.includes(studentId)) {
          return res.status(403).json({ success: false, error: 'Forbidden: You are not linked to this student' });
        }
        where.studentId = studentId;
      } else {
        where.studentId = { in: linkedStudentIds };
      }
    } else if (req.user?.role === 'STUDENT') {
      // Students ONLY see published reports for themselves
      where.isPublished = true;
      const student = await prisma.student.findFirst({ where: { userId: req.user.userId } });
      if (!student) {
        return res.json({ success: true, data: { feedbacks: [] } });
      }
      // If studentId was explicitly passed in query, reject cross-student probing
      if (studentId && studentId !== student.id) {
        return res.status(403).json({ success: false, error: 'Forbidden: You can only view your own progress' });
      }
      where.studentId = student.id;
    } else {
      // Super Admin / Academic Admin
      if (batchId) where.batchId = batchId;
      if (subjectId) where.subjectId = subjectId;
      if (studentId) where.studentId = studentId;
      if (status === 'DRAFT') where.isPublished = false;
      if (status === 'PUBLISHED') where.isPublished = true;
    }

    if (search) {
      where.OR = [
        { termName: { contains: search, mode: 'insensitive' } },
        { remarks: { contains: search, mode: 'insensitive' } },
        { student: { firstName: { contains: search, mode: 'insensitive' } } },
        { student: { lastName: { contains: search, mode: 'insensitive' } } },
        { student: { admissionNumber: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const feedbacks = await prisma.progressFeedback.findMany({
      where,
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
        batch: { select: { id: true, name: true, academicYear: true } },
        subject: { select: { id: true, name: true, code: true } },
        staff: { select: { id: true, fullName: true, role: true } },
      },
    });

    return res.json({
      success: true,
      data: { feedbacks },
    });
  } catch (err: any) {
    console.error('[List Progress Feedback Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch progress feedback' });
  }
}

/**
 * List progress feedback for a specific student (Retains backward compatibility)
 */
export async function getStudentFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { studentId } = req.params;

    // Strict authorization check
    if (req.user?.role === 'STUDENT') {
      const student = await prisma.student.findFirst({ where: { userId: req.user.userId } });
      if (!student || student.id !== studentId) {
        return res.status(403).json({ success: false, error: 'Forbidden: You can only view your own progress' });
      }
    } else if (req.user?.role === 'PARENT') {
      const relation = await prisma.studentParentRelation.findFirst({
        where: { studentId, parent: { userId: req.user.userId } },
      });
      if (!relation) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized for this student' });
      }
    } else if (req.user?.role === 'STAFF') {
      const isAuth = await isStudentAuthorized(req, studentId, prisma);
      if (!isAuth) {
        return res.status(403).json({ success: false, error: 'Forbidden: Student is not in your assigned batches' });
      }
    }

    const where: any = { studentId, instituteId };
    if (req.user?.role === 'STUDENT' || req.user?.role === 'PARENT') {
      where.isPublished = true;
    }

    const feedbacks = await prisma.progressFeedback.findMany({
      where,
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
        staff: { select: { id: true, fullName: true, role: true } },
        batch: { select: { id: true, name: true, academicYear: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    return res.json({
      success: true,
      data: { feedbacks },
    });
  } catch (err: any) {
    console.error('[Get Student Feedback Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch student feedback' });
  }
}

/**
 * Record student progress feedback (Draft or Published)
 */
export async function createFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const parse = createFeedbackSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parse.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    const data = parse.data;

    // Verify staff authorization
    if (req.user?.role === 'STAFF') {
      const isAssigned = await isStaffAssignedToBatch(req, data.batchId, prisma);
      if (!isAssigned) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
      }
      if (data.subjectId) {
        const isAssignedSub = await isStaffAssignedToBatchSubject(req, data.batchId, data.subjectId, prisma);
        if (!isAssignedSub) {
          return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized for this subject' });
        }
      }
    }

    // Verify student belongs to this batch
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId: data.studentId,
        batchId: data.batchId,
        isActive: true,
      },
    });
    if (!enrollment) {
      return res.status(400).json({ success: false, error: 'Student is not actively enrolled in the selected batch' });
    }

    // Calculate real-time performance indicators
    const startDate = data.startDate ? new Date(data.startDate) : null;
    const endDate = data.endDate ? new Date(data.endDate) : null;

    const metrics = await calculateStudentPerformanceMetrics({
      studentId: data.studentId,
      batchId: data.batchId,
      subjectId: data.subjectId,
      startDate,
      endDate,
      instituteId,
    });

    const isPublished = data.isPublished === true;
    const status = isPublished ? 'PUBLISHED' : 'DRAFT';

    const feedback = await prisma.progressFeedback.create({
      data: {
        instituteId,
        studentId: data.studentId,
        batchId: data.batchId,
        subjectId: data.subjectId || null,
        staffId: req.user!.userId,
        termName: data.termName.trim(),
        periodType: data.periodType,
        startDate,
        endDate,
        remarks: data.remarks.trim(),
        rating: data.rating || null,
        strengths: data.strengths?.trim() || null,
        improvements: data.improvements?.trim() || null,
        recommendations: data.recommendations?.trim() || null,
        attendanceRate: metrics.attendance.attendanceRate !== null ? new Prisma.Decimal(metrics.attendance.attendanceRate) : null,
        homeworkRate: metrics.homework.homeworkRate !== null ? new Prisma.Decimal(metrics.homework.homeworkRate) : null,
        examAverage: metrics.exams.examAverage !== null ? new Prisma.Decimal(metrics.exams.examAverage) : null,
        status,
        isPublished,
        publishedAt: isPublished ? new Date() : null,
      },
      include: {
        staff: { select: { id: true, fullName: true, role: true } },
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    // If published immediately, dispatch notifications to student and linked parents
    if (isPublished) {
      InAppNotificationService.notifyProgressReportPublished(feedback.id, false).catch((err) => {
        console.error('[Notification dispatch error]', err);
      });
    }

    await prisma.auditLog.create({
      data: {
        instituteId,
        userId: req.user!.userId,
        action: isPublished ? 'PUBLISH_PROGRESS_FEEDBACK' : 'CREATE_PROGRESS_FEEDBACK_DRAFT',
        entityType: 'ProgressFeedback',
        entityId: feedback.id,
        newValues: {
          studentId: data.studentId,
          termName: data.termName,
          isPublished,
          status,
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: isPublished ? 'Academic progress report published successfully' : 'Progress report saved as draft',
      data: { feedback },
    });
  } catch (err: any) {
    console.error('[Create Progress Feedback Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to record feedback' });
  }
}

/**
 * Update existing feedback
 */
export async function updateFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const parse = updateFeedbackSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const existing = await prisma.progressFeedback.findFirst({
      where: { id, instituteId },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Progress report not found' });

    // Authorization check: Staff can only edit reports they authored or for their assigned batches
    if (req.user?.role === 'STAFF') {
      const isAssigned = await isStaffAssignedToBatch(req, existing.batchId, prisma);
      if (!isAssigned && existing.staffId !== req.user.userId) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to edit this report' });
      }
    }

    const data = parse.data;
    const wasPublished = existing.isPublished;
    const isNowPublished = data.isPublished !== undefined ? data.isPublished : existing.isPublished;
    const status = isNowPublished ? 'PUBLISHED' : 'DRAFT';

    const updated = await prisma.progressFeedback.update({
      where: { id },
      data: {
        ...(data.termName ? { termName: data.termName.trim() } : {}),
        ...(data.periodType ? { periodType: data.periodType } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate ? new Date(data.startDate) : null } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate ? new Date(data.endDate) : null } : {}),
        ...(data.remarks ? { remarks: data.remarks.trim() } : {}),
        ...(data.rating !== undefined ? { rating: data.rating } : {}),
        ...(data.strengths !== undefined ? { strengths: data.strengths?.trim() || null } : {}),
        ...(data.improvements !== undefined ? { improvements: data.improvements?.trim() || null } : {}),
        ...(data.recommendations !== undefined ? { recommendations: data.recommendations?.trim() || null } : {}),
        isPublished: isNowPublished,
        status,
        ...(!wasPublished && isNowPublished ? { publishedAt: new Date() } : {}),
      },
      include: {
        staff: { select: { id: true, fullName: true, role: true } },
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    // Notify if publishing newly or materially updated
    if (!wasPublished && isNowPublished) {
      InAppNotificationService.notifyProgressReportPublished(updated.id, false).catch((err) => {
        console.error('[Notification dispatch error]', err);
      });
    } else if (wasPublished && isNowPublished) {
      InAppNotificationService.notifyProgressReportPublished(updated.id, true).catch((err) => {
        console.error('[Notification update dispatch error]', err);
      });
    }

    await prisma.auditLog.create({
      data: {
        instituteId,
        userId: req.user!.userId,
        action: 'UPDATE_PROGRESS_FEEDBACK',
        entityType: 'ProgressFeedback',
        entityId: id,
        newValues: { isPublished: isNowPublished, status },
      },
    });

    return res.json({
      success: true,
      message: 'Progress report updated successfully',
      data: { feedback: updated },
    });
  } catch (err: any) {
    console.error('[Update Progress Feedback Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to update feedback' });
  }
}

/**
 * Publish progress feedback report explicitly
 */
export async function publishFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const existing = await prisma.progressFeedback.findFirst({
      where: { id, instituteId },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Progress report not found' });

    if (req.user?.role === 'STAFF') {
      const isAssigned = await isStaffAssignedToBatch(req, existing.batchId, prisma);
      if (!isAssigned && existing.staffId !== req.user.userId) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to publish this report' });
      }
    }

    const updated = await prisma.progressFeedback.update({
      where: { id },
      data: {
        status: 'PUBLISHED',
        isPublished: true,
        publishedAt: new Date(),
      },
      include: {
        staff: { select: { id: true, fullName: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    InAppNotificationService.notifyProgressReportPublished(updated.id, false).catch((err) => {
      console.error('[Notification dispatch error]', err);
    });

    await prisma.auditLog.create({
      data: {
        instituteId,
        userId: req.user!.userId,
        action: 'PUBLISH_PROGRESS_FEEDBACK',
        entityType: 'ProgressFeedback',
        entityId: id,
        newValues: { status: 'PUBLISHED', isPublished: true },
      },
    });

    return res.json({
      success: true,
      message: 'Academic progress report published to student and guardian',
      data: { feedback: updated },
    });
  } catch (err: any) {
    console.error('[Publish Progress Feedback Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to publish progress report' });
  }
}

/**
 * Delete feedback report
 */
export async function deleteFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const existing = await prisma.progressFeedback.findFirst({
      where: { id, instituteId },
    });
    if (!existing) return res.status(404).json({ success: false, error: 'Feedback report not found' });

    if (req.user?.role === 'STAFF' && existing.staffId !== req.user.userId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You can only delete feedback you authored' });
    }

    await prisma.progressFeedback.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        instituteId,
        userId: req.user!.userId,
        action: 'DELETE_PROGRESS_FEEDBACK',
        entityType: 'ProgressFeedback',
        entityId: id,
      },
    });

    return res.json({ success: true, message: 'Progress report deleted' });
  } catch (err: any) {
    console.error('[Delete Progress Feedback Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to delete feedback' });
  }
}
