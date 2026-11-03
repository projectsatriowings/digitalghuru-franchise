import { Response } from 'express';
import { Prisma  } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { z } from 'zod';
import fs from 'fs';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { resolveAbsolutePath, getRelativeStorageKey } from '../../utils/storage.js';
import {
  isStaffAssignedToBatch,
  isStaffAssignedToBatchSubject,
  isStudentAuthorized,
} from '../students/student-authorization.service.js';
import { InAppNotificationService } from '../notifications/inapp-notification.service.js';

export const createExamSchema = z.object({
  batchId: z.string().uuid('Valid Batch ID required'),
  subjectId: z.string().uuid('Valid Subject ID required'),
  title: z.string().min(2, 'Title must be at least 2 characters').max(150),
  description: z.string().optional().nullable(),
  examType: z.string().min(2).max(50), // e.g. "Unit Test", "Term Exam", "Monthly Assessment"
  academicYear: z.string().optional().nullable(),
  totalMarks: z.union([z.number(), z.string().transform((v) => parseFloat(v))]),
  passingMarks: z.union([z.number(), z.string().transform((v) => parseFloat(v))]),
  examDate: z.string().min(1, 'Exam date is required'), // YYYY-MM-DD
  startTime: z.string().optional().nullable(), // e.g. "09:30 AM"
  endTime: z.string().optional().nullable(), // e.g. "12:30 PM"
  instructions: z.string().optional().nullable(),
  isPublished: z.union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')]).optional().default(false),
}).refine((data) => data.passingMarks <= data.totalMarks, {
  message: 'Passing marks cannot exceed total marks',
  path: ['passingMarks'],
});

export const updateExamSchema = z.object({
  title: z.string().min(2).max(150).optional(),
  description: z.string().optional().nullable(),
  examType: z.string().min(2).max(50).optional(),
  totalMarks: z.union([z.number(), z.string().transform((v) => parseFloat(v))]).optional(),
  passingMarks: z.union([z.number(), z.string().transform((v) => parseFloat(v))]).optional(),
  examDate: z.string().optional(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  academicYear: z.string().optional().nullable(),
  isPublished: z.union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')]).optional(),
});

export const enterMarksSchema = z.object({
  marks: z.array(
    z.object({
      studentId: z.string().uuid(),
      marksObtained: z.union([z.number(), z.string().transform((v) => parseFloat(v))]).optional().default(0),
      isAbsent: z.boolean().default(false),
      remarks: z.string().optional().nullable(),
    })
  ).min(1, 'At least one student mark entry is required'),
  isDraft: z.boolean().optional().default(true),
});

/**
 * Create a new examination
 */
export async function createExam(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const parse = createExamSchema.safeParse(req.body);
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
      const isAssignedSub = await isStaffAssignedToBatchSubject(req, data.batchId, data.subjectId, prisma);
      if (!isAssignedSub) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to create exams for this subject' });
      }
    }

    // Verify batch and subject belong to institute
    const batch = await prisma.batch.findFirst({ where: { id: data.batchId, instituteId } });
    if (!batch) return res.status(404).json({ success: false, error: 'Batch not found in this institute' });

    const subject = await prisma.subject.findFirst({ where: { id: data.subjectId, instituteId } });
    if (!subject) return res.status(404).json({ success: false, error: 'Subject not found in this institute' });

    const file = req.file;
    let fileUrl: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    let mimeType: string | null = null;

    if (file) {
      fileUrl = getRelativeStorageKey(instituteId, file.filename);
      fileName = file.originalname;
      fileSize = file.size;
      mimeType = file.mimetype;
    }

    const isPublished = data.isPublished === true;

    const exam = await prisma.examination.create({
      data: {
        instituteId,
        batchId: data.batchId,
        subjectId: data.subjectId,
        title: data.title.trim(),
        description: data.description?.trim() || null,
        examType: data.examType.trim(),
        academicYear: data.academicYear || batch.academicYear || '2026-2027',
        totalMarks: new Prisma.Decimal(data.totalMarks),
        passingMarks: new Prisma.Decimal(data.passingMarks),
        examDate: new Date(data.examDate),
        startTime: data.startTime?.trim() || null,
        endTime: data.endTime?.trim() || null,
        instructions: data.instructions?.trim() || null,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
        status: isPublished ? 'PUBLISHED' : 'DRAFT',
        isPublished,
        publishedAt: isPublished ? new Date() : null,
        isResultsPublished: false,
      },
      include: {
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        instituteId,
        userId: req.user!.userId,
        action: 'CREATE_EXAMINATION',
        entityType: 'Examination',
        entityId: exam.id,
        newValues: { title: exam.title, totalMarks: data.totalMarks, isPublished },
      },
    });

    // If published immediately, dispatch schedule notifications
    if (isPublished) {
      InAppNotificationService.notifyExamScheduled(exam.id).catch((err) => {
        console.error('[Notification Dispatch Error]', err);
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Examination created successfully',
      data: { exam },
    });
  } catch (err: any) {
    console.error('[Create Exam Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to create examination' });
  }
}

/**
 * Update an existing examination
 */
export async function updateExam(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const existing = await prisma.examination.findFirst({
      where: { id, instituteId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Examination not found' });
    }

    // Role check
    if (req.user?.role === 'STAFF') {
      const isAssigned = await isStaffAssignedToBatch(req, existing.batchId, prisma);
      if (!isAssigned) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
      }
    }

    const parse = updateExamSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parse.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    const data = parse.data;
    const file = req.file;

    let fileUrl = existing.fileUrl;
    let fileName = existing.fileName;
    let fileSize = existing.fileSize;
    let mimeType = existing.mimeType;

    if (file) {
      fileUrl = getRelativeStorageKey(instituteId!, file.filename);
      fileName = file.originalname;
      fileSize = file.size;
      mimeType = file.mimetype;
    }

    // Check if schedule dates/times changed on an already-published exam
    const dateChanged = data.examDate && new Date(data.examDate).getTime() !== new Date(existing.examDate).getTime();
    const timeChanged = (data.startTime !== undefined && data.startTime !== existing.startTime) ||
                        (data.endTime !== undefined && data.endTime !== existing.endTime);
    const shouldNotifyReschedule = existing.isPublished && (dateChanged || timeChanged);

    const updated = await prisma.examination.update({
      where: { id },
      data: {
        title: data.title?.trim() || existing.title,
        description: data.description !== undefined ? data.description?.trim() || null : existing.description,
        examType: data.examType?.trim() || existing.examType,
        academicYear: data.academicYear || existing.academicYear,
        totalMarks: data.totalMarks ? new Prisma.Decimal(data.totalMarks) : existing.totalMarks,
        passingMarks: data.passingMarks ? new Prisma.Decimal(data.passingMarks) : existing.passingMarks,
        examDate: data.examDate ? new Date(data.examDate) : existing.examDate,
        startTime: data.startTime !== undefined ? data.startTime?.trim() || null : existing.startTime,
        endTime: data.endTime !== undefined ? data.endTime?.trim() || null : existing.endTime,
        instructions: data.instructions !== undefined ? data.instructions?.trim() || null : existing.instructions,
        fileUrl,
        fileName,
        fileSize,
        mimeType,
      },
      include: {
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
      },
    });

    if (shouldNotifyReschedule) {
      InAppNotificationService.notifyExamScheduled(updated.id, true).catch((err) => {
        console.error('[Reschedule Notification Error]', err);
      });
    }

    return res.json({
      success: true,
      message: 'Examination updated successfully',
      data: { exam: updated },
    });
  } catch (err: any) {
    console.error('[Update Exam Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to update examination' });
  }
}

/**
 * List examinations with robust role scoping & privacy
 */
export async function listExams(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const batchId = req.query.batchId as string;
    const subjectId = req.query.subjectId as string;
    const status = (req.query.status as string || '').toUpperCase();
    const search = (req.query.search as string || '').trim().toLowerCase();

    const where: any = { instituteId };
    if (batchId && batchId !== 'ALL') where.batchId = batchId;
    if (subjectId && subjectId !== 'ALL') where.subjectId = subjectId;

    if (status && status !== 'ALL') {
      if (status === 'DRAFT') {
        where.isPublished = false;
      } else if (status === 'PUBLISHED') {
        where.isPublished = true;
        where.isResultsPublished = false;
      } else if (status === 'RESULTS_PUBLISHED') {
        where.isResultsPublished = true;
      }
    }

    let studentProfile: any = null;

    if (req.user?.role === 'STAFF') {
      const staffProfile = await prisma.staffProfile.findFirst({
        where: { userId: req.user.userId, instituteId },
      });
      if (!staffProfile) {
        return res.json({ success: true, data: { exams: [] } });
      }

      const batchSubjects = await prisma.batchSubject.findMany({
        where: { staffProfileId: staffProfile.id },
        select: { batchId: true, subjectId: true },
      });
      const staffAssignments = await prisma.staffBatchAssignment.findMany({
        where: { staffProfileId: staffProfile.id },
        select: { batchId: true },
      });
      const allowedBatchIds = Array.from(new Set([
        ...staffAssignments.map((a) => a.batchId),
        ...batchSubjects.map((bs) => bs.batchId),
      ]));

      if (allowedBatchIds.length === 0) {
        return res.json({ success: true, data: { exams: [] } });
      }

      if (where.batchId) {
        if (!allowedBatchIds.includes(where.batchId)) {
          return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
        }
      } else {
        where.batchId = { in: allowedBatchIds };
      }

      if (batchSubjects.length > 0) {
        const allowedSubjectIds = batchSubjects.map((bs) => bs.subjectId);
        if (where.subjectId) {
          if (!allowedSubjectIds.includes(where.subjectId)) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this subject' });
          }
        } else {
          where.subjectId = { in: allowedSubjectIds };
        }
      }
    } else if (req.user?.role === 'STUDENT') {
      // Students only see published exams
      where.isPublished = true;
      studentProfile = await prisma.student.findFirst({
        where: { userId: req.user.userId },
        include: { enrollments: { where: { isActive: true } } },
      });
      if (!studentProfile) {
        return res.json({ success: true, data: { exams: [] } });
      }

      const batchIds = Array.from(new Set(studentProfile.enrollments.map((e: any) => e.batchId)));
      const subjectIds = Array.from(new Set(studentProfile.enrollments.map((e: any) => e.subjectId).filter(Boolean) as string[]));
      where.batchId = { in: batchIds };
      if (subjectIds.length > 0) {
        where.subjectId = { in: subjectIds };
      }
    } else if (req.user?.role === 'PARENT') {
      where.isPublished = true;
      const children = await prisma.studentParentRelation.findMany({
        where: { parent: { userId: req.user.userId } },
        include: { student: { include: { enrollments: { where: { isActive: true } } } } },
      });
      const batchIds = Array.from(new Set(children.flatMap((c) => c.student.enrollments.map((e) => e.batchId))));
      const subjectIds = Array.from(new Set(children.flatMap((c) => c.student.enrollments.map((e) => e.subjectId).filter(Boolean) as string[])));
      where.batchId = { in: batchIds };
      if (subjectIds.length > 0) {
        where.subjectId = { in: subjectIds };
      }
    }

    const rawExams = await prisma.examination.findMany({
      where,
      orderBy: { examDate: 'desc' },
      include: {
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        marks: {
          select: {
            id: true,
            studentId: true,
            marksObtained: true,
            isAbsent: true,
            remarks: true,
            isPublished: true,
          },
        },
      },
    });

    // Transform and sanitize for privacy:
    // If results are NOT published, students and parents MUST NOT see marks!
    const sanitizedExams = rawExams.map((ex) => {
      const isResultsPublished = ex.isResultsPublished;
      let studentMark: any = null;

      if (studentProfile) {
        const found = ex.marks.find((m) => m.studentId === studentProfile.id);
        if (found && isResultsPublished) {
          const maxMarks = Number(ex.totalMarks);
          const obtained = Number(found.marksObtained);
          const percentage = maxMarks > 0 ? Math.round((obtained / maxMarks) * 100) : 0;
          const passingMarks = Number(ex.passingMarks);
          const isPassed = !found.isAbsent && obtained >= passingMarks;

          studentMark = {
            marksObtained: obtained,
            isAbsent: found.isAbsent,
            remarks: found.remarks,
            percentage,
            isPassed,
            status: found.isAbsent ? 'ABSENT' : isPassed ? 'PASSED' : 'FAILED',
          };
        }
      }

      const totalStudents = ex.marks.length;
      const enteredCount = ex.marks.filter((m) => !m.isAbsent || m.marksObtained).length;

      return {
        id: ex.id,
        instituteId: ex.instituteId,
        batchId: ex.batchId,
        subjectId: ex.subjectId,
        title: ex.title,
        name: ex.title, // Backward compatibility for mobile app
        description: ex.description,
        examType: ex.examType,
        academicYear: ex.academicYear,
        totalMarks: Number(ex.totalMarks),
        passingMarks: Number(ex.passingMarks),
        examDate: ex.examDate,
        startTime: ex.startTime,
        endTime: ex.endTime,
        instructions: ex.instructions,
        fileUrl: ex.fileUrl,
        fileName: ex.fileName,
        status: ex.isResultsPublished ? 'RESULTS_PUBLISHED' : ex.isPublished ? 'PUBLISHED' : 'DRAFT',
        isPublished: ex.isPublished,
        publishedAt: ex.publishedAt,
        isResultsPublished: ex.isResultsPublished,
        resultsPublishedAt: ex.resultsPublishedAt,
        batch: ex.batch,
        subject: ex.subject,
        studentMark: isResultsPublished ? studentMark : null,
        stats: {
          totalMarksEntered: ex.marks.length,
          resultsPublished: isResultsPublished,
        },
      };
    });

    // Apply search filter if present
    const filtered = search
      ? sanitizedExams.filter((ex) =>
          ex.title.toLowerCase().includes(search) ||
          ex.subject?.name?.toLowerCase().includes(search) ||
          ex.batch?.name?.toLowerCase().includes(search)
        )
      : sanitizedExams;

    return res.json({ success: true, data: { exams: filtered } });
  } catch (err: any) {
    console.error('[List Exams Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to list examinations' });
  }
}

/**
 * Get exam details with full analytics and enrolled student roster
 */
export async function getExamById(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const exam = await prisma.examination.findFirst({
      where: { id, instituteId },
      include: {
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        marks: {
          include: {
            student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true, photoUrl: true } },
          },
          orderBy: { marksObtained: 'desc' },
        },
      },
    });

    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found' });

    // For students and parents: only show student's own marks if published
    if (req.user?.role === 'STUDENT') {
      const student = await prisma.student.findFirst({ where: { userId: req.user.userId } });
      const myMark = exam.isResultsPublished && student ? exam.marks.find((m) => m.studentId === student.id) : null;

      return res.json({
        success: true,
        data: {
          exam: {
            ...exam,
            totalMarks: Number(exam.totalMarks),
            passingMarks: Number(exam.passingMarks),
            marks: myMark ? [myMark] : [],
          },
        },
      });
    }

    // Analytics for staff & admin
    const validScores = exam.marks.filter((m) => !m.isAbsent).map((m) => Number(m.marksObtained));
    const highestScore = validScores.length > 0 ? Math.max(...validScores) : 0;
    const averageScore = validScores.length > 0 ? validScores.reduce((a, b) => a + b, 0) / validScores.length : 0;
    const passingMark = Number(exam.passingMarks);
    const passedCount = validScores.filter((s) => s >= passingMark).length;
    const passPercentage = validScores.length > 0 ? Math.round((passedCount / validScores.length) * 100) : 0;

    return res.json({
      success: true,
      data: {
        exam: {
          ...exam,
          totalMarks: Number(exam.totalMarks),
          passingMarks: Number(exam.passingMarks),
        },
        analytics: {
          totalEntries: exam.marks.length,
          absentCount: exam.marks.filter((m) => m.isAbsent).length,
          highestScore,
          averageScore: parseFloat(averageScore.toFixed(2)),
          passPercentage,
          isResultsPublished: exam.isResultsPublished,
        },
      },
    });
  } catch (err: any) {
    console.error('[Get Exam Details Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch examination' });
  }
}

/**
 * Get all eligible enrolled students for an exam, including existing marks
 */
export async function getExamEligibleStudents(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id: examId } = req.params;

    const exam = await prisma.examination.findFirst({
      where: { id: examId, instituteId },
    });
    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found' });

    // 1. Fetch all actively enrolled students in the exam batch
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        batchId: exam.batchId,
        isActive: true,
        ...(exam.subjectId ? { OR: [{ subjectId: null }, { subjectId: exam.subjectId }] } : {}),
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            photoUrl: true,
            phone: true,
          },
        },
      },
    });

    const studentMap = new Map<string, any>();
    for (const e of enrollments) {
      if (!studentMap.has(e.student.id)) {
        studentMap.set(e.student.id, e.student);
      }
    }
    const eligibleStudents = Array.from(studentMap.values());

    // 2. Fetch existing marks for this exam
    const existingMarks = await prisma.examMark.findMany({
      where: { examId },
    });
    const markByStudentId = new Map<string, any>();
    for (const m of existingMarks) {
      markByStudentId.set(m.studentId, m);
    }

    const roster = eligibleStudents.map((st) => {
      const mark = markByStudentId.get(st.id);
      return {
        student: st,
        hasMarks: !!mark,
        marksObtained: mark ? Number(mark.marksObtained) : null,
        isAbsent: mark ? mark.isAbsent : false,
        remarks: mark?.remarks || '',
        isPublished: mark?.isPublished || false,
      };
    });

    const totalEligible = eligibleStudents.length;
    const enteredCount = roster.filter((r) => r.hasMarks).length;
    const pendingCount = roster.filter((r) => !r.hasMarks).length;
    const absentCount = roster.filter((r) => r.isAbsent).length;

    return res.json({
      success: true,
      data: {
        exam: {
          id: exam.id,
          title: exam.title,
          totalMarks: Number(exam.totalMarks),
          passingMarks: Number(exam.passingMarks),
          isPublished: exam.isPublished,
          isResultsPublished: exam.isResultsPublished,
        },
        summary: {
          totalEligible,
          enteredCount,
          pendingCount,
          absentCount,
          isResultsPublished: exam.isResultsPublished,
        },
        roster,
      },
    });
  } catch (err: any) {
    console.error('[Get Exam Eligible Students Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch student roster' });
  }
}

/**
 * Record or update student marks in batch (Default: Draft mode)
 */
export async function enterExamMarks(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id: examId } = req.params;

    const exam = await prisma.examination.findFirst({
      where: { id: examId, instituteId },
    });
    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found' });

    // Verify staff authorization
    if (req.user?.role === 'STAFF') {
      const isAssigned = await isStaffAssignedToBatch(req, exam.batchId, prisma);
      if (!isAssigned) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
      }
      const isAssignedSub = await isStaffAssignedToBatchSubject(req, exam.batchId, exam.subjectId, prisma);
      if (!isAssignedSub) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to enter marks for this subject' });
      }
    }

    const parse = enterMarksSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parse.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })),
      });
    }

    const maxMarks = Number(exam.totalMarks);

    // Validate bounds
    for (const item of parse.data.marks) {
      const score = Number(item.marksObtained || 0);
      if (!item.isAbsent && (score < 0 || score > maxMarks)) {
        return res.status(400).json({
          success: false,
          error: `Marks obtained (${score}) cannot exceed maximum exam marks (${maxMarks}) or be negative.`,
        });
      }
    }

    // Save as draft (isPublished: false unless exam already has results officially published)
    const isPublished = exam.isResultsPublished;

    const results = await prisma.$transaction(
      parse.data.marks.map((item) => {
        const score = item.isAbsent ? 0 : Number(item.marksObtained || 0);
        return prisma.examMark.upsert({
          where: {
            examId_studentId: {
              examId,
              studentId: item.studentId,
            },
          },
          update: {
            marksObtained: new Prisma.Decimal(score),
            isAbsent: item.isAbsent,
            remarks: item.remarks?.trim() || null,
            isPublished,
            evaluatedById: req.user!.userId,
          },
          create: {
            examId,
            studentId: item.studentId,
            marksObtained: new Prisma.Decimal(score),
            isAbsent: item.isAbsent,
            remarks: item.remarks?.trim() || null,
            isPublished,
            evaluatedById: req.user!.userId,
          },
        });
      })
    );

    await prisma.auditLog.create({
      data: {
        instituteId,
        userId: req.user!.userId,
        action: 'UPDATE_EXAM_MARKS',
        entityType: 'Examination',
        entityId: examId,
        newValues: { count: results.length, isDraft: !isPublished },
      },
    });

    return res.json({
      success: true,
      message: isPublished
        ? `Successfully updated ${results.length} published student marks`
        : `Saved ${results.length} student marks as Draft (confidential until published)`,
      data: { count: results.length, isDraft: !isPublished },
    });
  } catch (err: any) {
    console.error('[Enter Marks Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to record marks' });
  }
}

/**
 * Publish Exam Schedule (Makes exam visible to students & parents and sends schedule notification)
 */
export async function publishExamSchedule(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id: examId } = req.params;

    const exam = await prisma.examination.findFirst({
      where: { id: examId, instituteId },
    });
    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found' });

    const updated = await prisma.examination.update({
      where: { id: examId },
      data: {
        isPublished: true,
        publishedAt: new Date(),
        status: exam.isResultsPublished ? 'RESULTS_PUBLISHED' : 'PUBLISHED',
      },
      include: {
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    // Send notifications to students & parents
    InAppNotificationService.notifyExamScheduled(examId).catch((err) => {
      console.error('[Schedule Notification Error]', err);
    });

    return res.json({
      success: true,
      message: 'Exam schedule published and notifications dispatched to students and parents',
      data: { exam: updated },
    });
  } catch (err: any) {
    console.error('[Publish Exam Schedule Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to publish exam schedule' });
  }
}

/**
 * Publish Exam Results (Atomically exposes marks to students & parents with notification)
 */
export async function publishExamResults(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id: examId } = req.params;

    const exam = await prisma.examination.findFirst({
      where: { id: examId, instituteId },
      include: { marks: true },
    });
    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found' });

    if (exam.marks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot publish results: No student marks have been entered yet. Please enter marks first.',
      });
    }

    // Atomically mark exam results and individual marks as published
    const updated = await prisma.$transaction(async (tx) => {
      const ex = await tx.examination.update({
        where: { id: examId },
        data: {
          isPublished: true, // ensure schedule is published too
          isResultsPublished: true,
          resultsPublishedAt: new Date(),
          status: 'RESULTS_PUBLISHED',
        },
      });

      await tx.examMark.updateMany({
        where: { examId },
        data: { isPublished: true },
      });

      return ex;
    });

    // Notify affected students and parents
    InAppNotificationService.notifyExamResultsPublished(examId).catch((err) => {
      console.error('[Results Notification Error]', err);
    });

    await prisma.auditLog.create({
      data: {
        instituteId,
        userId: req.user!.userId,
        action: 'PUBLISH_EXAM_RESULTS',
        entityType: 'Examination',
        entityId: examId,
        newValues: { totalMarksPublished: exam.marks.length },
      },
    });

    return res.json({
      success: true,
      message: `Successfully published ${exam.marks.length} results. Notifications sent to students & parents.`,
      data: { exam: updated },
    });
  } catch (err: any) {
    console.error('[Publish Exam Results Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to publish results' });
  }
}

/**
 * Backward-compatible publish toggle
 */
export async function toggleExamPublish(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id: examId } = req.params;

    const exam = await prisma.examination.findFirst({
      where: { id: examId, instituteId },
    });
    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found' });

    const newPublished = !exam.isPublished;

    const updated = await prisma.examination.update({
      where: { id: examId },
      data: {
        isPublished: newPublished,
        publishedAt: newPublished ? new Date() : null,
        status: newPublished ? 'PUBLISHED' : 'DRAFT',
      },
    });

    if (newPublished) {
      InAppNotificationService.notifyExamScheduled(examId).catch(console.error);
    }

    return res.json({
      success: true,
      message: newPublished ? 'Exam schedule published' : 'Exam schedule reverted to Draft',
      data: { isPublished: updated.isPublished },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to toggle publication' });
  }
}

/**
 * Delete examination
 */
export async function deleteExam(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const exam = await prisma.examination.findFirst({
      where: { id, instituteId },
    });
    if (!exam) return res.status(404).json({ success: false, error: 'Exam not found' });

    if (req.user?.role === 'STAFF') {
      const isAssigned = await isStaffAssignedToBatch(req, exam.batchId, prisma);
      if (!isAssigned) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
      }
    }

    await prisma.examination.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        instituteId,
        userId: req.user!.userId,
        action: 'DELETE_EXAMINATION',
        entityType: 'Examination',
        entityId: id,
      },
    });

    return res.json({ success: true, message: 'Examination deleted successfully' });
  } catch (err: any) {
    console.error('[Delete Exam Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to delete examination' });
  }
}

/**
 * Student Report Card (Cumulative across all officially published exams)
 */
export async function getStudentReportCard(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { studentId } = req.params;

    // Verify Authorization: Student itself, Linked Parent, or Staff/Admin
    if (req.user?.role === 'STUDENT') {
      const student = await prisma.student.findFirst({ where: { userId: req.user.userId } });
      if (!student || student.id !== studentId) {
        return res.status(403).json({ success: false, error: 'Forbidden: You can only view your own report card' });
      }
    } else if (req.user?.role === 'PARENT') {
      const relation = await prisma.studentParentRelation.findFirst({
        where: { studentId, parent: { userId: req.user.userId } },
      });
      if (!relation) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized for this student' });
      }
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, instituteId },
      include: {
        institute: { select: { name: true, code: true } },
        enrollments: { include: { batch: true } },
      },
    });
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });

    // ONLY fetch marks where exam results have been officially published
    const marks = await prisma.examMark.findMany({
      where: {
        studentId,
        isPublished: true,
        exam: { instituteId, isResultsPublished: true },
      },
      include: {
        exam: {
          include: {
            subject: { select: { name: true, code: true } },
          },
        },
      },
      orderBy: { exam: { examDate: 'desc' } },
    });

    let totalMaxMarks = 0;
    let totalMarksObtained = 0;
    let totalExams = marks.length;
    let totalPassed = 0;

    const formattedMarks = marks.map((m) => {
      const maxMarks = Number(m.exam.totalMarks);
      const marksObtained = Number(m.marksObtained);
      const passingMarks = Number(m.exam.passingMarks);
      const isPassed = !m.isAbsent && marksObtained >= passingMarks;

      if (!m.isAbsent) {
        totalMaxMarks += maxMarks;
        totalMarksObtained += marksObtained;
        if (isPassed) totalPassed++;
      }

      const percentage = maxMarks > 0 ? Math.round((marksObtained / maxMarks) * 100) : 0;

      let grade = 'F';
      if (percentage >= 90) grade = 'A+';
      else if (percentage >= 80) grade = 'A';
      else if (percentage >= 70) grade = 'B';
      else if (percentage >= 60) grade = 'C';
      else if (percentage >= 50) grade = 'D';

      return {
        id: m.id,
        examId: m.examId,
        examTitle: m.exam.title,
        examType: m.exam.examType,
        examDate: m.exam.examDate,
        subject: m.exam.subject.name,
        subjectCode: m.exam.subject.code,
        marksObtained,
        maxMarks,
        passingMarks,
        isAbsent: m.isAbsent,
        isPassed,
        percentage,
        grade,
        remarks: m.remarks,
      };
    });

    const cumulativePercentage = totalMaxMarks > 0 ? parseFloat(((totalMarksObtained / totalMaxMarks) * 100).toFixed(2)) : 0;

    let overallStatus = 'NEEDS_IMPROVEMENT';
    if (cumulativePercentage >= 80) overallStatus = 'DISTINCTION';
    else if (cumulativePercentage >= 60) overallStatus = 'FIRST_CLASS';
    else if (cumulativePercentage >= 40) overallStatus = 'PASS';

    return res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          fullName: `${student.firstName} ${student.lastName}`,
          admissionNumber: student.admissionNumber,
          batches: student.enrollments.map((e) => e.batch.name),
        },
        summary: {
          totalExams,
          totalPassed,
          totalMaxMarks,
          totalMarksObtained,
          cumulativePercentage,
          status: overallStatus,
        },
        marks: formattedMarks,
      },
    });
  } catch (err: any) {
    console.error('[Student Report Card Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to generate report card' });
  }
}
