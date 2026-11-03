import { InAppNotificationService } from '../notifications/inapp-notification.service.js';
import { Response } from 'express';
import { prisma } from '../../prisma.js';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import {
  isStaffAssignedToBatch,
  getAuthorizedStaffAssignments,
} from '../students/student-authorization.service.js';

export const createQuizSchema = z.object({
  batchId: z.string().uuid('Valid Batch ID required'),
  subjectId: z.string().uuid('Valid Subject ID required').optional().nullable(),
  title: z.string().min(2, 'Title must be at least 2 characters').max(150),
  instructions: z.string().optional().nullable(),
  durationMinutes: z.union([z.number(), z.string().transform((v) => (v ? parseInt(v, 10) : null))]).optional().nullable(),
  totalMarks: z.union([z.number(), z.string().transform((v) => (v ? parseFloat(v) : null))]).optional().nullable(),
  passingMarks: z.union([z.number(), z.string().transform((v) => (v ? parseFloat(v) : null))]).optional().nullable(),
  isPublished: z.union([z.boolean(), z.string().transform((v) => v === 'true' || v === '1')]).optional().default(false),
  maxAttempts: z.union([z.number(), z.string().transform((v) => (v ? parseInt(v, 10) : 1))]).optional().default(1),
  questions: z.array(
    z.object({
      questionText: z.string().min(1, 'Question text required'),
      questionType: z.enum(['SINGLE_CHOICE', 'MULTIPLE_CHOICE']).default('SINGLE_CHOICE'),
      marks: z.number().default(1),
      explanation: z.string().optional().nullable(),
      options: z.array(
        z.object({
          optionText: z.string().min(1, 'Option text required'),
          isCorrect: z.boolean().default(false),
        })
      ).min(2, 'Each question must have at least 2 options'),
    })
  ).min(1, 'Quiz must have at least 1 question'),
});

/**
 * List quizzes with role and scope enforcement
 */
export async function listQuizzes(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const batchId = req.query.batchId as string;
    const subjectId = req.query.subjectId as string;
    const status = req.query.status as string; // 'PUBLISHED' | 'DRAFT' | 'ALL'
    const search = (req.query.search as string || '').trim();

    const where: any = { instituteId };

    if (subjectId && subjectId !== 'ALL') {
      where.subjectId = subjectId;
    }
    if (batchId && batchId !== 'ALL') {
      where.batchId = batchId;
    }
    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { instructions: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    let studentProfile: any = null;

    if (req.user?.role === 'STAFF') {
      const staffAssignments = await getAuthorizedStaffAssignments(req, prisma);
      const allowedBatchIds = staffAssignments.authorizedBatchIds;

      const uploaderOrBatchCondition = allowedBatchIds.length > 0
        ? {
            OR: [
              { creatorId: req.user.userId },
              { batchId: { in: allowedBatchIds } },
            ],
          }
        : { creatorId: req.user.userId };

      if (where.batchId) {
        if (!allowedBatchIds.includes(where.batchId)) {
          const createdInBatchCount = await prisma.quiz.count({
            where: { batchId: where.batchId, creatorId: req.user.userId, instituteId },
          });
          if (createdInBatchCount === 0) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
          }
        }
      } else {
        where.AND = [
          ...(where.AND || []),
          uploaderOrBatchCondition,
        ];
      }

      if (status === 'DRAFT') {
        where.isPublished = false;
        where.creatorId = req.user.userId;
      } else if (status === 'PUBLISHED') {
        where.isPublished = true;
      }
    } else if (req.user?.role === 'STUDENT') {
      // Students ONLY see published quizzes for their enrolled batches
      where.isPublished = true;

      studentProfile = await prisma.student.findFirst({
        where: { userId: req.user.userId, instituteId, status: 'ACTIVE' },
        include: {
          enrollments: {
            where: { isActive: true },
            select: { batchId: true, subjectId: true },
          },
        },
      });

      if (!studentProfile || studentProfile.enrollments.length === 0) {
        return res.json({ success: true, data: { quizzes: [] } });
      }

      const allowedBatchIds = Array.from(new Set(studentProfile.enrollments.map((e: any) => e.batchId))) as string[];
      where.batchId = { in: allowedBatchIds };
    }

    const quizzes = await prisma.quiz.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, fullName: true, role: true } },
        _count: { select: { questions: true, attempts: true } },
        attempts: studentProfile
          ? {
              where: { studentId: studentProfile.id },
              select: {
                id: true,
                status: true,
                score: true,
                totalMarks: true,
                percentage: true,
                startedAt: true,
                submittedAt: true,
              },
            }
          : false,
      },
    });

    return res.json({
      success: true,
      data: {
        quizzes: quizzes.map((q) => ({
          ...q,
          myAttempt: studentProfile && (q as any).attempts?.[0] ? (q as any).attempts[0] : null,
          attempts: undefined,
        })),
      },
    });
  } catch (err: any) {
    console.error('[List Quizzes Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch quizzes' });
  }
}

/**
 * Get single quiz by ID (strips isCorrect answers for active student taking)
 */
export async function getQuizById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const instituteId = req.instituteId;

    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true, code: true } },
        creator: { select: { id: true, fullName: true } },
        questions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            options: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });

    if (!quiz || (instituteId && quiz.instituteId !== instituteId)) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    // Role-specific stripping
    if (req.user?.role === 'STUDENT') {
      const student = await prisma.student.findFirst({
        where: { userId: req.user.userId, instituteId: quiz.instituteId },
      });
      if (!student) {
        return res.status(403).json({ success: false, error: 'Student profile not found' });
      }

      // Check student's attempts
      const myAttempt = await prisma.quizAttempt.findFirst({
        where: { quizId: id, studentId: student.id },
        include: { answers: true },
        orderBy: { attemptNumber: 'desc' },
      });

      const isFinished = myAttempt?.status === 'SUBMITTED' || myAttempt?.status === 'EVALUATED';
      const canSeeAnswers = isFinished;

      const myAnswersByQuestionId = new Map<string, any>();
      if (myAttempt?.answers) {
        for (const ans of myAttempt.answers) {
          myAnswersByQuestionId.set(ans.questionId, ans);
        }
      }

      let correctCount = 0;
      const sanitizedQuestions = quiz.questions.map((q) => {
        const studentAns = myAnswersByQuestionId.get(q.id);
        const selectedIds = Array.isArray(studentAns?.selectedOptionIds) ? studentAns.selectedOptionIds : [];
        if (studentAns?.isCorrect) {
          correctCount++;
        }
        return {
          id: q.id,
          questionText: q.questionText,
          questionType: q.questionType,
          marks: q.marks,
          orderIndex: q.orderIndex,
          explanation: canSeeAnswers ? q.explanation : undefined,
          isCorrect: canSeeAnswers ? studentAns?.isCorrect : undefined,
          marksAwarded: canSeeAnswers ? studentAns?.marksAwarded : undefined,
          selectedOptionIds: canSeeAnswers ? selectedIds : undefined,
          options: q.options.map((opt) => ({
            id: opt.id,
            optionText: opt.optionText,
            orderIndex: opt.orderIndex,
            isCorrect: canSeeAnswers ? opt.isCorrect : undefined,
          })),
        };
      });

      return res.json({
        success: true,
        data: {
          quiz: {
            ...quiz,
            questions: sanitizedQuestions,
            myAttempt: myAttempt ? {
              ...myAttempt,
              correctCount,
              totalQuestions: quiz.questions.length,
            } : null,
            resultsReleased: quiz.resultsReleased,
          },
        },
      });
    }

    return res.json({
      success: true,
      data: { quiz },
    });
  } catch (err: any) {
    console.error('[Get Quiz By Id Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch quiz' });
  }
}

/**
 * Create a new quiz with questions and answer keys
 */
export async function createQuiz(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const parse = createQuizSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Invalid quiz data',
      });
    }

    const data = parse.data;

    // Check staff batch permission
    if (req.user?.role === 'STAFF') {
      const isAssigned = await isStaffAssignedToBatch(req, data.batchId, prisma);
      if (!isAssigned) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
      }
    }

    // Calculate sum of question marks if totalMarks not explicitly passed
    let calculatedMarks = 0;
    for (const q of data.questions) {
      calculatedMarks += Number(q.marks || 1);
    }
    const totalMarks = data.totalMarks || calculatedMarks || (data.questions.length || 1);

    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Authentication required' });
    }

    const quiz = await prisma.quiz.create({
      data: {
        instituteId,
        batchId: data.batchId,
        subjectId: data.subjectId || null,
        creatorId: req.user.userId,
        title: data.title.trim(),
        instructions: data.instructions?.trim() || null,
        durationMinutes: data.durationMinutes || null,
        totalMarks,
        passingMarks: data.passingMarks || null,
        status: data.isPublished ? 'PUBLISHED' : 'DRAFT',
        isPublished: data.isPublished,
        publishedAt: data.isPublished ? new Date() : null,
        maxAttempts: data.maxAttempts || 1,
        questions: {
          create: data.questions.map((q, qIdx) => ({
            questionText: q.questionText.trim(),
            questionType: q.questionType,
            marks: q.marks || 1,
            orderIndex: qIdx,
            explanation: q.explanation?.trim() || null,
            options: {
              create: q.options.map((opt, oIdx) => ({
                optionText: opt.optionText.trim(),
                isCorrect: opt.isCorrect || false,
                orderIndex: oIdx,
              })),
            },
          })),
        },
      },
      include: {
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
        questions: {
          include: { options: true },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: data.isPublished ? 'Quiz created and published to students!' : 'Quiz saved as draft',
      data: { quiz },
    });
  } catch (err: any) {
    console.error('[Create Quiz Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to create quiz' });
  }
}

/**
 * Update quiz (toggle published, toggle results release, edit metadata)
 */
export async function updateQuiz(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const instituteId = req.instituteId;

    const existing = await prisma.quiz.findUnique({
      where: { id },
    });
    if (!existing || (instituteId && existing.instituteId !== instituteId)) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    if (req.user?.role === 'STAFF' && existing.creatorId !== req.user.userId) {
      const isAssigned = await isStaffAssignedToBatch(req, existing.batchId, prisma);
      if (!isAssigned) {
        return res.status(403).json({ success: false, error: 'Forbidden: You cannot modify this quiz' });
      }
    }

    const {
      title,
      instructions,
      durationMinutes,
      isPublished,
      resultsReleased,
      totalMarks,
      passingMarks,
    } = req.body;

    const isPublishingNow = !existing.isPublished && isPublished === true;
    const isReleasingNow = !existing.resultsReleased && resultsReleased === true;

    const updated = await prisma.quiz.update({
      where: { id },
      data: {
        ...(title ? { title: title.trim() } : {}),
        ...(instructions !== undefined ? { instructions: instructions?.trim() || null } : {}),
        ...(durationMinutes !== undefined ? { durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : null } : {}),
        ...(isPublished !== undefined
          ? {
              isPublished,
              status: isPublished ? 'PUBLISHED' : 'DRAFT',
              publishedAt: isPublishingNow ? new Date() : existing.publishedAt,
            }
          : {}),
        ...(resultsReleased !== undefined
          ? {
              resultsReleased,
              resultsReleasedAt: isReleasingNow ? new Date() : existing.resultsReleasedAt,
            }
          : {}),
        ...(totalMarks !== undefined ? { totalMarks } : {}),
        ...(passingMarks !== undefined ? { passingMarks } : {}),
      },
      include: {
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    return res.json({
      success: true,
      message: 'Quiz updated successfully',
      data: { quiz: updated },
    });
  } catch (err: any) {
    console.error('[Update Quiz Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to update quiz' });
  }
}

/**
 * Delete a quiz
 */
export async function deleteQuiz(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const instituteId = req.instituteId;

    const existing = await prisma.quiz.findUnique({
      where: { id },
    });
    if (!existing || (instituteId && existing.instituteId !== instituteId)) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    if (req.user?.role === 'STAFF' && existing.creatorId !== req.user.userId) {
      return res.status(403).json({ success: false, error: 'Forbidden: You can only delete quizzes you created' });
    }

    await prisma.quiz.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: 'Quiz deleted successfully',
    });
  } catch (err: any) {
    console.error('[Delete Quiz Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to delete quiz' });
  }
}

/**
 * Start a student quiz attempt
 */
export async function startQuizAttempt(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: quizId } = req.params;
    const instituteId = req.instituteId;

    const student = await prisma.student.findFirst({
      where: { userId: req.user?.userId, instituteId, status: 'ACTIVE' },
    });
    if (!student) {
      return res.status(403).json({ success: false, error: 'Student record not found' });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            options: {
              orderBy: { orderIndex: 'asc' },
              select: { id: true, optionText: true, orderIndex: true }, // Never send isCorrect to taker!
            },
          },
        },
      },
    });

    if (!quiz || !quiz.isPublished || (instituteId && quiz.instituteId !== instituteId)) {
      return res.status(404).json({ success: false, error: 'Quiz is not available' });
    }

    // Verify enrollment in batch
    const enrollment = await prisma.studentEnrollment.findFirst({
      where: {
        studentId: student.id,
        batchId: quiz.batchId,
        isActive: true,
      },
    });
    if (!enrollment) {
      return res.status(403).json({ success: false, error: 'You are not enrolled in this batch' });
    }

    // Check existing attempts
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId, studentId: student.id },
      orderBy: { attemptNumber: 'desc' },
    });

    const activeAttempt = attempts.find((a) => a.status === 'IN_PROGRESS');
    if (activeAttempt) {
      return res.json({
        success: true,
        message: 'Resumed in-progress attempt',
        data: { attempt: activeAttempt, quiz },
      });
    }

    if (attempts.length >= quiz.maxAttempts) {
      return res.status(400).json({
        success: false,
        error: `Maximum attempts (${quiz.maxAttempts}) reached for this quiz`,
      });
    }

    const nextAttemptNumber = attempts.length + 1;
    const newAttempt = await prisma.quizAttempt.create({
      data: {
        quizId,
        studentId: student.id,
        attemptNumber: nextAttemptNumber,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Quiz attempt started',
      data: { attempt: newAttempt, quiz },
    });
  } catch (err: any) {
    console.error('[Start Quiz Attempt Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to start quiz attempt' });
  }
}

/**
 * Submit answers for auto-grading
 */
export async function submitQuizAttempt(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: quizId } = req.params;
    const { attemptId, answers } = req.body as {
      attemptId: string;
      answers: Array<{ questionId: string; selectedOptionIds: string[] }>;
    };

    const student = await prisma.student.findFirst({
      where: { userId: req.user?.userId, status: 'ACTIVE' },
    });
    if (!student) {
      return res.status(403).json({ success: false, error: 'Student record not found' });
    }

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: { quiz: { include: { questions: { include: { options: true } } } } },
    });

    if (!attempt || attempt.studentId !== student.id || attempt.quizId !== quizId) {
      return res.status(404).json({ success: false, error: 'Quiz attempt not found' });
    }

    if (attempt.status !== 'IN_PROGRESS') {
      return res.status(400).json({ success: false, error: 'Attempt is already submitted or closed' });
    }

    // Auto-grading
    let totalScore = 0;
    let maxQuizMarks = 0;
    let correctCount = 0;
    const answerRecords: any[] = [];
    const reviewQuestions: any[] = [];

    const answersByQuestionId = new Map<string, string[]>();
    for (const a of answers || []) {
      answersByQuestionId.set(a.questionId, a.selectedOptionIds || []);
    }

    for (const question of attempt.quiz.questions) {
      const qMarks = Number(question.marks || 1);
      maxQuizMarks += qMarks;

      const selectedIds = answersByQuestionId.get(question.id) || [];
      const correctOptionIds = question.options.filter((o) => o.isCorrect).map((o) => o.id);

      let isCorrect = false;
      if (selectedIds.length > 0 && selectedIds.length === correctOptionIds.length) {
        isCorrect = selectedIds.every((id) => correctOptionIds.includes(id));
      }

      if (isCorrect) {
        correctCount++;
      }

      const marksAwarded = isCorrect ? qMarks : 0;
      totalScore += marksAwarded;

      answerRecords.push({
        attemptId,
        questionId: question.id,
        selectedOptionIds: selectedIds,
        isCorrect,
        marksAwarded,
      });

      reviewQuestions.push({
        id: question.id,
        questionText: question.questionText,
        questionType: question.questionType,
        marks: qMarks,
        marksAwarded,
        isCorrect,
        selectedOptionIds: selectedIds,
        correctOptionIds,
        explanation: question.explanation,
        options: question.options.map((opt) => ({
          id: opt.id,
          optionText: opt.optionText,
          orderIndex: opt.orderIndex,
          isCorrect: opt.isCorrect,
        })),
      });
    }

    const percentage = maxQuizMarks > 0 ? (totalScore / maxQuizMarks) * 100 : 0;

    // Use Prisma transaction to save all answers and update attempt
    const [, updatedAttempt] = await prisma.$transaction([
      prisma.quizAnswer.createMany({
        data: answerRecords,
      }),
      prisma.quizAttempt.update({
        where: { id: attemptId },
        data: {
          status: 'EVALUATED',
          submittedAt: new Date(),
          score: totalScore,
          totalMarks: maxQuizMarks,
          percentage,
        },
      }),
    ]);

    return res.json({
      success: true,
      message: 'Quiz submitted and evaluated successfully!',
      data: {
        score: totalScore,
        totalMarks: maxQuizMarks,
        percentage: Number(percentage.toFixed(1)),
        correctCount,
        totalQuestions: attempt.quiz.questions.length,
        resultsReleased: true,
        questions: reviewQuestions,
      },
    });
  } catch (err: any) {
    console.error('[Submit Quiz Attempt Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to submit quiz attempt' });
  }
}

/**
 * List roster of student attempts for a quiz (Staff / Admin analytics)
 */
export async function getQuizSubmissions(req: AuthenticatedRequest, res: Response) {
  try {
    const { id: quizId } = req.params;
    const instituteId = req.instituteId;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        batch: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    });

    if (!quiz || (instituteId && quiz.instituteId !== instituteId)) {
      return res.status(404).json({ success: false, error: 'Quiz not found' });
    }

    // Authorization
    if (req.user?.role === 'STAFF') {
      const isAssigned = await isStaffAssignedToBatch(req, quiz.batchId, prisma);
      if (!isAssigned && quiz.creatorId !== req.user.userId) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
      }
    }

    // 1. Get all active enrolled students in this batch
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        batchId: quiz.batchId,
        isActive: true,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            phone: true,
            photoUrl: true,
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

    // 2. Get student attempts
    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId },
      orderBy: { submittedAt: 'desc' },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
      },
    });

    const attemptByStudentId = new Map<string, any>();
    for (const att of attempts) {
      if (!attemptByStudentId.has(att.studentId)) {
        attemptByStudentId.set(att.studentId, att);
      }
    }

    const roster = eligibleStudents.map((st) => {
      const att = attemptByStudentId.get(st.id);
      let status: 'COMPLETED' | 'IN_PROGRESS' | 'NOT_STARTED' = 'NOT_STARTED';

      if (att) {
        if (att.status === 'EVALUATED' || att.status === 'SUBMITTED') {
          status = 'COMPLETED';
        } else if (att.status === 'IN_PROGRESS') {
          status = 'IN_PROGRESS';
        }
      }

      return {
        student: st,
        status,
        attempt: att || null,
        score: att?.score !== null && att?.score !== undefined ? Number(att.score) : null,
        totalMarks: att?.totalMarks !== null && att?.totalMarks !== undefined ? Number(att.totalMarks) : Number(quiz.totalMarks),
        percentage: att?.percentage !== null && att?.percentage !== undefined ? Number(att.percentage) : null,
        submittedAt: att?.submittedAt || null,
      };
    });

    const totalEligible = eligibleStudents.length;
    const completedCount = roster.filter((r) => r.status === 'COMPLETED').length;
    const inProgressCount = roster.filter((r) => r.status === 'IN_PROGRESS').length;
    const notStartedCount = roster.filter((r) => r.status === 'NOT_STARTED').length;
    const avgScore = completedCount > 0
      ? (roster.filter((r) => r.score !== null).reduce((acc, curr) => acc + (curr.score || 0), 0) / completedCount).toFixed(1)
      : '0';

    return res.json({
      success: true,
      data: {
        quiz,
        roster,
        analytics: {
          totalEligible,
          completedCount,
          inProgressCount,
          notStartedCount,
          avgScore,
        },
      },
    });
  } catch (err: any) {
    console.error('[Get Quiz Submissions Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch quiz submissions' });
  }
}
