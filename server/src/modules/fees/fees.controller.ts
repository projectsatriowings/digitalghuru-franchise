import { Response } from 'express';
import crypto from 'crypto';
import { Prisma, FeeFrequency, PaymentMethod, PaymentStatus  } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { isStudentAuthorized } from '../students/student-authorization.service.js';
import { InAppNotificationService } from '../notifications/inapp-notification.service.js';

// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================

export const createFeeStructureSchema = z.object({
  batchId: z.string().uuid(),
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  academicYear: z.string().min(4).max(20).optional(),
  frequency: z.nativeEnum(FeeFrequency),
  amount: z.number().positive('Fee amount must be greater than zero'),
  dueDay: z.number().int().min(1).max(31).optional(),
  isActive: z.boolean().default(true),
});

export const updateFeeStructureSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  academicYear: z.string().min(4).max(20).optional(),
  amount: z.number().positive().optional(),
  dueDay: z.number().int().min(1).max(31).optional(),
  isActive: z.boolean().optional(),
});

export const assignFeeSchema = z.object({
  studentId: z.string().uuid(),
  feeStructureId: z.string().uuid(),
  termLabel: z.string().min(1).max(100),
  academicYear: z.string().min(4).max(20).optional(),
  baseAmount: z.number().positive('Base amount must be greater than zero').optional(),
  discountAmount: z.number().min(0, 'Discount cannot be negative').default(0),
  dueDate: z.string().min(1, 'Due date is required'),
});

export const batchAssignFeeSchema = z.object({
  batchId: z.string().uuid(),
  feeStructureId: z.string().uuid(),
  termLabel: z.string().min(1).max(100),
  academicYear: z.string().min(4).max(20).optional(),
  dueDate: z.string().min(1, 'Due date is required'),
  defaultDiscount: z.number().min(0).default(0),
});

export const recordPaymentSchema = z.object({
  feeAssignmentId: z.string().uuid(),
  amountPaid: z.number().positive('Payment amount must be greater than zero'),
  method: z.nativeEnum(PaymentMethod),
  transactionReference: z.string().optional(),
  idempotencyKey: z.string().optional(),
  remarks: z.string().optional(),
});

export const refundPaymentSchema = z.object({
  amount: z.number().positive('Refund amount must be greater than zero'),
  reason: z.string().min(3, 'A clear reason for the refund is required'),
});

export const adjustFeeSchema = z.object({
  adjustmentType: z.enum(['DISCOUNT', 'CONCESSION', 'CORRECTION']),
  amount: z.number().positive('Adjustment amount must be positive'),
  reason: z.string().min(3, 'Adjustment reason is required'),
});

// Helper: Calculate net paid and balance for an assignment
function calculateAssignmentFinancials(assignment: any) {
  const finalAmount = new Prisma.Decimal(assignment.finalAmount);
  let totalPayments = new Prisma.Decimal(0);
  let totalRefunds = new Prisma.Decimal(0);

  if (assignment.payments && Array.isArray(assignment.payments)) {
    for (const payment of assignment.payments) {
      if (payment.status !== 'FAILED') {
        totalPayments = totalPayments.plus(new Prisma.Decimal(payment.amountPaid));
        if (payment.adjustments && Array.isArray(payment.adjustments)) {
          for (const adj of payment.adjustments) {
            if (adj.adjustmentType === 'REFUND') {
              totalRefunds = totalRefunds.plus(new Prisma.Decimal(adj.amount));
            }
          }
        }
      }
    }
  }

  // Any direct assignment adjustments
  if (assignment.adjustments && Array.isArray(assignment.adjustments)) {
    for (const adj of assignment.adjustments) {
      if (!adj.paymentId && adj.adjustmentType === 'REFUND') {
        totalRefunds = totalRefunds.plus(new Prisma.Decimal(adj.amount));
      }
    }
  }

  const netPaid = totalPayments.minus(totalRefunds);
  const remainingBalance = finalAmount.minus(netPaid);

  let calculatedStatus: PaymentStatus;
  const now = new Date();
  const dueDate = new Date(assignment.dueDate);

  if (netPaid.greaterThanOrEqualTo(finalAmount)) {
    calculatedStatus = PaymentStatus.PAID;
  } else if (netPaid.greaterThan(0)) {
    calculatedStatus = PaymentStatus.PARTIALLY_PAID;
  } else if (dueDate < now) {
    calculatedStatus = PaymentStatus.OVERDUE;
  } else {
    calculatedStatus = PaymentStatus.PENDING;
  }

  return {
    finalAmount: Number(finalAmount.toFixed(2)),
    totalPayments: Number(totalPayments.toFixed(2)),
    totalRefunds: Number(totalRefunds.toFixed(2)),
    netPaid: Number(netPaid.toFixed(2)),
    remainingBalance: Math.max(0, Number(remainingBalance.toFixed(2))),
    calculatedStatus,
  };
}

// Generate unique receipt number safely
function generateReceiptNumber(): string {
  const year = new Date().getFullYear();
  const timeSuffix = Date.now().toString().slice(-4);
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `REC-${year}-${timeSuffix}${randomSuffix}`;
}

// ============================================================================
// MODULE A: FEE STRUCTURE MANAGEMENT
// ============================================================================

export async function createFeeStructure(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const parse = createFeeStructureSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const data = parse.data;

    // Verify batch belongs to this institute
    const batch = await prisma.batch.findFirst({
      where: { id: data.batchId, instituteId },
    });
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
    }

    const feeStructure = await prisma.feeStructure.create({
      data: {
        instituteId,
        batchId: data.batchId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        academicYear: data.academicYear || batch.academicYear,
        frequency: data.frequency,
        amount: new Prisma.Decimal(data.amount.toFixed(2)),
        dueDay: data.dueDay || null,
        isActive: data.isActive,
      },
      include: {
        batch: { select: { id: true, name: true, academicYear: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        instituteId,
        userId: req.user?.userId || null,
        action: 'FEE_STRUCTURE_CREATED',
        entityType: 'FeeStructure',
        entityId: feeStructure.id,
        newValues: feeStructure as any,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Fee structure created successfully',
      data: { feeStructure },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to create fee structure' });
  }
}

export async function listFeeStructures(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { batchId, academicYear, isActive } = req.query;

    const where: any = { instituteId };
    if (batchId) where.batchId = String(batchId);
    if (academicYear) where.academicYear = String(academicYear);
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const feeStructures = await prisma.feeStructure.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        batch: { select: { id: true, name: true, academicYear: true } },
        _count: { select: { assignments: true } },
      },
    });

    return res.json({
      success: true,
      data: { feeStructures },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to list fee structures' });
  }
}

export async function getFeeStructureById(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const feeStructure = await prisma.feeStructure.findFirst({
      where: { id, instituteId },
      include: {
        batch: { select: { id: true, name: true, academicYear: true } },
        _count: { select: { assignments: true } },
      },
    });

    if (!feeStructure) {
      return res.status(404).json({ success: false, error: 'Fee structure not found' });
    }

    return res.json({
      success: true,
      data: { feeStructure },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to get fee structure' });
  }
}

export async function updateFeeStructure(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const parse = updateFeeStructureSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const existing = await prisma.feeStructure.findFirst({
      where: { id, instituteId },
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Fee structure not found' });
    }

    const data = parse.data;
    const updated = await prisma.feeStructure.update({
      where: { id },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.academicYear ? { academicYear: data.academicYear } : {}),
        ...(data.amount ? { amount: new Prisma.Decimal(data.amount.toFixed(2)) } : {}),
        ...(data.dueDay !== undefined ? { dueDay: data.dueDay } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        instituteId,
        userId: req.user?.userId || null,
        action: 'FEE_STRUCTURE_UPDATED',
        entityType: 'FeeStructure',
        entityId: id,
        oldValues: existing as any,
        newValues: updated as any,
      },
    });

    return res.json({
      success: true,
      message: 'Fee structure updated successfully',
      data: { feeStructure: updated },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update fee structure' });
  }
}

// ============================================================================
// MODULE B: STUDENT FEE ASSIGNMENT
// ============================================================================

export async function assignFeeToStudent(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const parse = assignFeeSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const data = parse.data;

    // Verify student belongs to institute
    const student = await prisma.student.findFirst({
      where: { id: data.studentId, instituteId },
    });
    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found in this institute' });
    }

    // Verify feeStructure belongs to institute
    const feeStructure = await prisma.feeStructure.findFirst({
      where: { id: data.feeStructureId, instituteId },
    });
    if (!feeStructure) {
      return res.status(404).json({ success: false, error: 'Fee structure not found in this institute' });
    }

    // Check duplicate
    const existing = await prisma.studentFeeAssignment.findUnique({
      where: {
        studentId_feeStructureId_termLabel: {
          studentId: data.studentId,
          feeStructureId: data.feeStructureId,
          termLabel: data.termLabel.trim(),
        },
      },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        error: `Fee already assigned to this student for '${data.termLabel.trim()}'`,
      });
    }

    const baseAmountDecimal = data.baseAmount !== undefined
      ? new Prisma.Decimal(data.baseAmount.toFixed(2))
      : feeStructure.amount;

    const discountDecimal = new Prisma.Decimal(data.discountAmount.toFixed(2));
    if (discountDecimal.greaterThan(baseAmountDecimal)) {
      return res.status(400).json({ success: false, error: 'Discount amount cannot exceed base fee amount' });
    }

    const finalAmountDecimal = baseAmountDecimal.minus(discountDecimal);
    const dueDate = new Date(data.dueDate);
    if (isNaN(dueDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid due date' });
    }

    const assignment = await prisma.studentFeeAssignment.create({
      data: {
        studentId: data.studentId,
        feeStructureId: data.feeStructureId,
        termLabel: data.termLabel.trim(),
        academicYear: data.academicYear || feeStructure.academicYear,
        baseAmount: baseAmountDecimal,
        discountAmount: discountDecimal,
        finalAmount: finalAmountDecimal,
        dueDate,
        status: PaymentStatus.PENDING,
      },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        feeStructure: { select: { id: true, name: true, frequency: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        instituteId,
        userId: req.user?.userId || null,
        action: 'FEE_ASSIGNED',
        entityType: 'StudentFeeAssignment',
        entityId: assignment.id,
        newValues: assignment as any,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Fee assigned to student successfully',
      data: { assignment },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to assign fee to student' });
  }
}

export async function assignFeeToBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const parse = batchAssignFeeSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const data = parse.data;

    // Verify batch belongs to institute
    const batch = await prisma.batch.findFirst({
      where: { id: data.batchId, instituteId },
      include: {
        enrollments: {
          where: { isActive: true },
          include: { student: true },
        },
      },
    });
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }

    // Verify feeStructure belongs to institute
    const feeStructure = await prisma.feeStructure.findFirst({
      where: { id: data.feeStructureId, instituteId },
    });
    if (!feeStructure) {
      return res.status(404).json({ success: false, error: 'Fee structure not found' });
    }

    const dueDate = new Date(data.dueDate);
    if (isNaN(dueDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid due date' });
    }

    const baseAmount = feeStructure.amount;
    const discountAmount = new Prisma.Decimal(data.defaultDiscount.toFixed(2));
    const finalAmount = baseAmount.minus(discountAmount);

    let assignedCount = 0;
    let skippedCount = 0;
    const assignmentsCreated: any[] = [];

    // Process students transactionally
    await prisma.$transaction(async (tx) => {
      for (const enrollment of batch.enrollments) {
        // Check if already assigned
        const exists = await tx.studentFeeAssignment.findUnique({
          where: {
            studentId_feeStructureId_termLabel: {
              studentId: enrollment.studentId,
              feeStructureId: data.feeStructureId,
              termLabel: data.termLabel.trim(),
            },
          },
        });

        if (exists) {
          skippedCount++;
          continue;
        }

        const newAssignment = await tx.studentFeeAssignment.create({
          data: {
            studentId: enrollment.studentId,
            feeStructureId: data.feeStructureId,
            termLabel: data.termLabel.trim(),
            academicYear: data.academicYear || feeStructure.academicYear || batch.academicYear,
            baseAmount,
            discountAmount,
            finalAmount,
            dueDate,
            status: PaymentStatus.PENDING,
          },
        });

        assignmentsCreated.push(newAssignment);
        assignedCount++;
      }

      await tx.auditLog.create({
        data: {
          instituteId,
          userId: req.user?.userId || null,
          action: 'BATCH_FEE_ASSIGNED',
          entityType: 'Batch',
          entityId: data.batchId,
          newValues: {
            feeStructureId: data.feeStructureId,
            termLabel: data.termLabel,
            assignedCount,
            skippedCount,
          },
        },
      });
    }, { maxWait: 15000, timeout: 30000 });

    return res.status(201).json({
      success: true,
      message: `Batch fee assignment complete: ${assignedCount} assigned, ${skippedCount} skipped (duplicates)`,
      data: {
        assignedCount,
        skippedCount,
        totalStudentsInBatch: batch.enrollments.length,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to assign fee to batch' });
  }
}

export async function listFeeAssignments(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const {
      studentId,
      batchId,
      feeStructureId,
      academicYear,
      status,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = Math.max(1, parseInt(String(page)) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit)) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      student: { instituteId },
    };

    if (studentId) where.studentId = String(studentId);
    if (feeStructureId) where.feeStructureId = String(feeStructureId);
    if (academicYear) where.academicYear = String(academicYear);
    if (status) where.status = String(status);
    if (batchId) {
      where.student = {
        ...where.student,
        enrollments: { some: { batchId: String(batchId), isActive: true } },
      };
    }

    const [total, assignments] = await Promise.all([
      prisma.studentFeeAssignment.count({ where }),
      prisma.studentFeeAssignment.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ dueDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
            },
          },
          feeStructure: {
            select: {
              id: true,
              name: true,
              frequency: true,
              batch: { select: { id: true, name: true } },
            },
          },
          payments: {
            select: {
              id: true,
              receiptNumber: true,
              amountPaid: true,
              paidAt: true,
              method: true,
              status: true,
              adjustments: true,
            },
          },
          adjustments: true,
        },
      }),
    ]);

    // Enhance each assignment with recalculated financials
    const enhancedAssignments = assignments.map((assignment) => {
      const financials = calculateAssignmentFinancials(assignment);
      return {
        ...assignment,
        ...financials,
      };
    });

    return res.json({
      success: true,
      data: {
        assignments: enhancedAssignments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to list fee assignments' });
  }
}

export async function getFeeAssignmentById(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const assignment = await prisma.studentFeeAssignment.findFirst({
      where: {
        id,
        student: { instituteId },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
            userId: true,
          },
        },
        feeStructure: {
          include: {
            batch: { select: { id: true, name: true, academicYear: true } },
          },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
          include: {
            recordedBy: { select: { id: true, fullName: true } },
            adjustments: true,
          },
        },
        adjustments: {
          orderBy: { createdAt: 'desc' },
          include: {
            authorizedBy: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Fee assignment not found' });
    }

    // Scoping for student / parent roles
    if (req.user?.role === 'STUDENT') {
      const studentUser = await prisma.student.findFirst({ where: { userId: req.user.userId } });
      if (!studentUser || studentUser.id !== assignment.studentId) {
        return res.status(403).json({ success: false, error: 'Forbidden: Access to another student record denied' });
      }
    } else if (req.user?.role === 'PARENT') {
      const relation = await prisma.studentParentRelation.findFirst({
        where: { studentId: assignment.studentId, parent: { userId: req.user.userId } },
      });
      if (!relation) {
        return res.status(403).json({ success: false, error: 'Forbidden: Student is not linked to parent profile' });
      }
    }

    const financials = calculateAssignmentFinancials(assignment);

    return res.json({
      success: true,
      data: {
        assignment: {
          ...assignment,
          ...financials,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to get fee assignment' });
  }
}

export async function getStudentFeeStatement(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { studentId } = req.params;

    // Check student in institute
    const student = await prisma.student.findFirst({
      where: { id: studentId, instituteId },
      include: {
        enrollments: {
          where: { isActive: true },
          include: { batch: { select: { id: true, name: true, academicYear: true } } },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found in this institute' });
    }

    // Role check
    if (req.user?.role === 'STUDENT') {
      const studentUser = await prisma.student.findFirst({ where: { userId: req.user.userId } });
      if (!studentUser || studentUser.id !== studentId) {
        return res.status(403).json({ success: false, error: 'Forbidden: Cannot view another student statement' });
      }
    } else if (req.user?.role === 'PARENT') {
      const relation = await prisma.studentParentRelation.findFirst({
        where: { studentId, parent: { userId: req.user.userId } },
      });
      if (!relation) {
        return res.status(403).json({ success: false, error: 'Forbidden: Student is not linked to parent profile' });
      }
    } else if (req.user?.role === 'STAFF') {
      const isAuth = await isStudentAuthorized(req, studentId, prisma);
      if (!isAuth) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to view fee statements for this student' });
      }
    }

    const assignments = await prisma.studentFeeAssignment.findMany({
      where: { studentId },
      orderBy: { dueDate: 'asc' },
      include: {
        feeStructure: { select: { id: true, name: true, frequency: true } },
        payments: {
          where: { status: 'SUCCESS' },
          orderBy: { paidAt: 'asc' },
          include: {
            recordedBy: { select: { id: true, fullName: true } },
            adjustments: true,
          },
        },
        adjustments: {
          include: {
            authorizedBy: { select: { id: true, fullName: true } },
          },
        },
      },
    });

    let totalAssigned = new Prisma.Decimal(0);
    let totalDiscount = new Prisma.Decimal(0);
    let totalPayable = new Prisma.Decimal(0);
    let totalPaid = new Prisma.Decimal(0);
    let totalRefunded = new Prisma.Decimal(0);

    const statementItems = assignments.map((a) => {
      const financials = calculateAssignmentFinancials(a);
      totalAssigned = totalAssigned.plus(new Prisma.Decimal(a.baseAmount));
      totalDiscount = totalDiscount.plus(new Prisma.Decimal(a.discountAmount));
      totalPayable = totalPayable.plus(new Prisma.Decimal(a.finalAmount));
      totalPaid = totalPaid.plus(new Prisma.Decimal(financials.netPaid));
      totalRefunded = totalRefunded.plus(new Prisma.Decimal(financials.totalRefunds));

      return {
        ...a,
        ...financials,
      };
    });

    const netOutstanding = totalPayable.minus(totalPaid);

    return res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          admissionNumber: student.admissionNumber,
          batches: student.enrollments.map((e) => e.batch),
        },
        summary: {
          totalAssigned: Number(totalAssigned.toFixed(2)),
          totalDiscount: Number(totalDiscount.toFixed(2)),
          totalPayable: Number(totalPayable.toFixed(2)),
          totalPaid: Number(totalPaid.toFixed(2)),
          totalRefunded: Number(totalRefunded.toFixed(2)),
          netOutstanding: Math.max(0, Number(netOutstanding.toFixed(2))),
        },
        statementItems,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to generate student fee statement' });
  }
}

// ============================================================================
// MODULE C: PAYMENT RECORDING
// ============================================================================

export async function recordPayment(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const parse = recordPaymentSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const data = parse.data;

    // Check idempotency if key is provided
    if (data.idempotencyKey) {
      const existingPayment = await prisma.payment.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
        include: {
          feeAssignment: {
            include: {
              feeStructure: true,
              student: true,
            },
          },
        },
      });

      if (existingPayment) {
        // Return existing payment safely without duplicate charge
        return res.json({
          success: true,
          message: 'Payment already processed (idempotent submission)',
          data: { payment: existingPayment },
        });
      }
    }

    const paymentAmountDecimal = new Prisma.Decimal(data.amountPaid.toFixed(2));
    if (paymentAmountDecimal.lessThanOrEqualTo(0)) {
      return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
    }

    // Atomic transaction for payment recording and balance checking
    const result = await prisma.$transaction(async (tx) => {
      // Fetch assignment with current payments & adjustments
      const assignment = await tx.studentFeeAssignment.findFirst({
        where: {
          id: data.feeAssignmentId,
          student: { instituteId },
        },
        include: {
          student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
          feeStructure: { select: { id: true, name: true } },
          payments: {
            where: { status: 'SUCCESS' },
            include: { adjustments: true },
          },
          adjustments: true,
        },
      });

      if (!assignment) {
        throw { status: 404, message: 'Fee assignment not found in this institute' };
      }

      const currentFinancials = calculateAssignmentFinancials(assignment);

      // Strict validation: Reject overpayment
      if (paymentAmountDecimal.greaterThan(new Prisma.Decimal(currentFinancials.remainingBalance))) {
        throw {
          status: 400,
          message: `Payment amount ₹${paymentAmountDecimal.toFixed(2)} exceeds remaining balance of ₹${currentFinancials.remainingBalance.toFixed(2)}`,
        };
      }

      const receiptNumber = generateReceiptNumber();

      // Create Payment
      const payment = await tx.payment.create({
        data: {
          instituteId,
          studentId: assignment.studentId,
          feeAssignmentId: assignment.id,
          receiptNumber,
          amountPaid: paymentAmountDecimal,
          method: data.method,
          transactionReference: data.transactionReference?.trim() || null,
          idempotencyKey: data.idempotencyKey || null,
          status: 'SUCCESS',
          recordedById: req.user!.userId,
          remarks: data.remarks?.trim() || null,
        },
      });

      // Recalculate status with this new payment
      const newNetPaid = new Prisma.Decimal(currentFinancials.netPaid).plus(paymentAmountDecimal);
      const finalAmount = new Prisma.Decimal(assignment.finalAmount);

      let newStatus: PaymentStatus;
      if (newNetPaid.greaterThanOrEqualTo(finalAmount)) {
        newStatus = PaymentStatus.PAID;
      } else {
        newStatus = PaymentStatus.PARTIALLY_PAID;
      }

      await tx.studentFeeAssignment.update({
        where: { id: assignment.id },
        data: { status: newStatus },
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          instituteId,
          userId: req.user?.userId || null,
          action: 'FEE_PAYMENT_RECORDED',
          entityType: 'Payment',
          entityId: payment.id,
          newValues: {
            receiptNumber,
            amountPaid: Number(payment.amountPaid.toFixed(2)),
            feeAssignmentId: assignment.id,
            studentId: assignment.studentId,
            newStatus,
          },
        },
      });

      const remainingAfter = Math.max(
        0,
        Number(finalAmount.minus(newNetPaid).toFixed(2))
      );

      return {
        payment,
        assignmentStatus: newStatus,
        receiptNumber,
        amountPaid: Number(paymentAmountDecimal.toFixed(2)),
        priorPaid: currentFinancials.netPaid,
        remainingBalanceAfter: remainingAfter,
      };
    }, { maxWait: 15000, timeout: 30000 });

    // Notify parents and student of recorded payment
    if (result?.payment?.id) {
      InAppNotificationService.notifyFeePaymentRecorded(result.payment.id).catch(() => {});
    }

    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      data: result,
    });
  } catch (err: any) {
    console.error('[recordPayment Error]:', err);
    if (err.status) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: err?.message || 'Failed to record payment' });
  }
}

export async function listPayments(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const {
      studentId,
      feeAssignmentId,
      method,
      startDate,
      endDate,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = Math.max(1, parseInt(String(page)) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit)) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { instituteId };
    if (studentId) where.studentId = String(studentId);
    if (feeAssignmentId) where.feeAssignmentId = String(feeAssignmentId);
    if (method) where.method = String(method);

    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) {
        const s = new Date(String(startDate));
        if (!isNaN(s.getTime())) where.paidAt.gte = s;
      }
      if (endDate) {
        const e = new Date(String(endDate));
        if (!isNaN(e.getTime())) where.paidAt.lte = e;
      }
    }

    // Role scoping
    if (req.user?.role === 'STUDENT') {
      const student = await prisma.student.findFirst({ where: { userId: req.user.userId } });
      if (!student) return res.status(403).json({ success: false, error: 'Student profile not found' });
      where.studentId = student.id;
    } else if (req.user?.role === 'PARENT') {
      const relations = await prisma.studentParentRelation.findMany({
        where: { parent: { userId: req.user.userId } },
        select: { studentId: true },
      });
      const allowedStudentIds = relations.map((r) => r.studentId);
      where.studentId = { in: allowedStudentIds };
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { paidAt: 'desc' },
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
            },
          },
          feeAssignment: {
            select: {
              id: true,
              termLabel: true,
              finalAmount: true,
              feeStructure: { select: { id: true, name: true } },
            },
          },
          recordedBy: { select: { id: true, fullName: true } },
          adjustments: true,
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        payments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to list payments' });
  }
}

// ============================================================================
// MODULE D: RECEIPTS
// ============================================================================

export async function getReceipt(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    // Support lookup by either payment ID or receipt number
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [{ id }, { receiptNumber: id }],
        instituteId,
      },
      include: {
        institute: {
          select: {
            id: true,
            name: true,
            code: true,
            phone: true,
            email: true,
            address: true,
            city: true,
            state: true,
            postalCode: true,
            logoUrl: true,
          },
        },
        student: {
          include: {
            enrollments: {
              where: { isActive: true },
              include: { batch: { select: { id: true, name: true, academicYear: true } } },
            },
          },
        },
        feeAssignment: {
          include: {
            feeStructure: true,
            payments: {
              where: { status: 'SUCCESS' },
              orderBy: { paidAt: 'asc' },
              include: { adjustments: true },
            },
          },
        },
        recordedBy: { select: { id: true, fullName: true } },
        adjustments: true,
      },
    });

    if (!payment) {
      return res.status(404).json({ success: false, error: 'Payment receipt not found' });
    }

    // Role-based scope verification
    if (req.user?.role === 'STUDENT') {
      const studentUser = await prisma.student.findFirst({ where: { userId: req.user.userId } });
      if (!studentUser || studentUser.id !== payment.studentId) {
        return res.status(403).json({ success: false, error: 'Forbidden: You cannot view another student receipt' });
      }
    } else if (req.user?.role === 'PARENT') {
      const relation = await prisma.studentParentRelation.findFirst({
        where: { studentId: payment.studentId, parent: { userId: req.user.userId } },
      });
      if (!relation) {
        return res.status(403).json({ success: false, error: 'Forbidden: Student is not linked to parent profile' });
      }
    }

    // Financial breakdown up to this payment
    const assignment = payment.feeAssignment;
    const finalAmount = new Prisma.Decimal(assignment.finalAmount);

    let priorPaid = new Prisma.Decimal(0);
    for (const p of assignment.payments) {
      if (p.id === payment.id) break;
      priorPaid = priorPaid.plus(new Prisma.Decimal(p.amountPaid));
      for (const adj of p.adjustments) {
        if (adj.adjustmentType === 'REFUND') {
          priorPaid = priorPaid.minus(new Prisma.Decimal(adj.amount));
        }
      }
    }

    const currentPaid = new Prisma.Decimal(payment.amountPaid);
    let currentRefunded = new Prisma.Decimal(0);
    for (const adj of payment.adjustments) {
      if (adj.adjustmentType === 'REFUND') {
        currentRefunded = currentRefunded.plus(new Prisma.Decimal(adj.amount));
      }
    }

    const totalPaidUpToThis = priorPaid.plus(currentPaid).minus(currentRefunded);
    const remainingBalanceAfter = Math.max(0, Number(finalAmount.minus(totalPaidUpToThis).toFixed(2)));

    const activeBatch = payment.student.enrollments[0]?.batch;

    const receipt = {
      receiptNumber: payment.receiptNumber,
      receiptDate: payment.paidAt,
      institute: {
        id: payment.institute.id,
        name: payment.institute.name,
        code: payment.institute.code,
        phone: payment.institute.phone,
        email: payment.institute.email,
        address: [
          payment.institute.address,
          payment.institute.city,
          payment.institute.state,
          payment.institute.postalCode,
        ]
          .filter(Boolean)
          .join(', '),
        logoUrl: payment.institute.logoUrl,
      },
      student: {
        id: payment.student.id,
        fullName: `${payment.student.firstName} ${payment.student.lastName}`.trim(),
        admissionNumber: payment.student.admissionNumber,
        batchName: activeBatch?.name || 'N/A',
        academicYear: activeBatch?.academicYear || assignment.academicYear || 'N/A',
      },
      feeDetails: {
        feeName: assignment.feeStructure.name,
        termLabel: assignment.termLabel,
        totalPayable: Number(finalAmount.toFixed(2)),
        priorPaid: Number(priorPaid.toFixed(2)),
        amountPaid: Number(currentPaid.toFixed(2)),
        refundedOnThis: Number(currentRefunded.toFixed(2)),
        netPaidOnThis: Number(currentPaid.minus(currentRefunded).toFixed(2)),
        remainingBalanceAfter,
      },
      payment: {
        id: payment.id,
        method: payment.method,
        transactionReference: payment.transactionReference,
        status: payment.status,
        remarks: payment.remarks,
        recordedBy: payment.recordedBy.fullName,
      },
      disclaimer: 'This is a computer-generated receipt issued by Tuition Management System.',
    };

    return res.json({
      success: true,
      data: { receipt },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to generate receipt' });
  }
}

// ============================================================================
// MODULE E: REFUNDS, ADJUSTMENTS AND AUDIT TRAIL
// ============================================================================

export async function processRefund(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params; // payment id

    const parse = refundPaymentSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const { amount, reason } = parse.data;
    const refundAmountDecimal = new Prisma.Decimal(amount.toFixed(2));

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: { id, instituteId },
        include: {
          feeAssignment: {
            include: {
              payments: { where: { status: 'SUCCESS' }, include: { adjustments: true } },
            },
          },
          adjustments: true,
        },
      });

      if (!payment) {
        throw { status: 404, message: 'Payment not found in this institute' };
      }

      // Calculate already refunded amount on this specific payment
      let existingRefundTotal = new Prisma.Decimal(0);
      for (const adj of payment.adjustments) {
        if (adj.adjustmentType === 'REFUND') {
          existingRefundTotal = existingRefundTotal.plus(new Prisma.Decimal(adj.amount));
        }
      }

      const netPaidOnThisPayment = new Prisma.Decimal(payment.amountPaid).minus(existingRefundTotal);

      if (refundAmountDecimal.greaterThan(netPaidOnThisPayment)) {
        throw {
          status: 400,
          message: `Refund amount ₹${refundAmountDecimal.toFixed(2)} exceeds refundable balance of ₹${netPaidOnThisPayment.toFixed(2)} on this payment`,
        };
      }

      // Create PaymentAdjustment record
      const adjustment = await tx.paymentAdjustment.create({
        data: {
          instituteId,
          paymentId: payment.id,
          feeAssignmentId: payment.feeAssignmentId,
          adjustmentType: 'REFUND',
          amount: refundAmountDecimal,
          reason: reason.trim(),
          authorizedById: req.user!.userId,
        },
      });

      // Recalculate status of the fee assignment
      const assignment = payment.feeAssignment;
      const currentFinancials = calculateAssignmentFinancials(assignment);

      // Deduct this new refund
      const newNetPaid = new Prisma.Decimal(currentFinancials.netPaid).minus(refundAmountDecimal);
      const finalAmount = new Prisma.Decimal(assignment.finalAmount);
      const dueDate = new Date(assignment.dueDate);
      const now = new Date();

      let newStatus: PaymentStatus;
      if (newNetPaid.greaterThanOrEqualTo(finalAmount)) {
        newStatus = PaymentStatus.PAID;
      } else if (newNetPaid.greaterThan(0)) {
        newStatus = PaymentStatus.PARTIALLY_PAID;
      } else if (dueDate < now) {
        newStatus = PaymentStatus.OVERDUE;
      } else {
        newStatus = PaymentStatus.PENDING;
      }

      await tx.studentFeeAssignment.update({
        where: { id: assignment.id },
        data: { status: newStatus },
      });

      // Record Audit Log
      await tx.auditLog.create({
        data: {
          instituteId,
          userId: req.user?.userId || null,
          action: 'PAYMENT_REFUNDED',
          entityType: 'PaymentAdjustment',
          entityId: adjustment.id,
          newValues: {
            paymentId: payment.id,
            receiptNumber: payment.receiptNumber,
            refundAmount: Number(adjustment.amount.toFixed(2)),
            reason: adjustment.reason,
            newAssignmentStatus: newStatus,
          },
        },
      });

      return {
        adjustment,
        newStatus,
        netRetainedOnPayment: Number(netPaidOnThisPayment.minus(refundAmountDecimal).toFixed(2)),
      };
    }, { maxWait: 15000, timeout: 30000 });

    return res.status(201).json({
      success: true,
      message: 'Payment refund processed successfully',
      data: result,
    });
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: 'Failed to process refund' });
  }
}

export async function createFeeAdjustment(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params; // fee assignment id

    const parse = adjustFeeSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const { adjustmentType, amount, reason } = parse.data;
    const adjustAmountDecimal = new Prisma.Decimal(amount.toFixed(2));

    const result = await prisma.$transaction(async (tx) => {
      const assignment = await tx.studentFeeAssignment.findFirst({
        where: { id, student: { instituteId } },
        include: {
          payments: { where: { status: 'SUCCESS' }, include: { adjustments: true } },
          adjustments: true,
        },
      });

      if (!assignment) {
        throw { status: 404, message: 'Fee assignment not found' };
      }

      let newDiscount = new Prisma.Decimal(assignment.discountAmount);
      let newFinalAmount = new Prisma.Decimal(assignment.finalAmount);

      if (adjustmentType === 'DISCOUNT' || adjustmentType === 'CONCESSION') {
        newDiscount = newDiscount.plus(adjustAmountDecimal);
        const base = new Prisma.Decimal(assignment.baseAmount);
        if (newDiscount.greaterThan(base)) {
          throw { status: 400, message: 'Total discount cannot exceed base fee amount' };
        }
        newFinalAmount = base.minus(newDiscount);
      } else if (adjustmentType === 'CORRECTION') {
        // Direct correction reducing payable
        newFinalAmount = newFinalAmount.minus(adjustAmountDecimal);
        if (newFinalAmount.lessThan(0)) {
          throw { status: 400, message: 'Final payable amount cannot be negative' };
        }
      }

      // Record adjustment
      const adjustment = await tx.paymentAdjustment.create({
        data: {
          instituteId,
          feeAssignmentId: assignment.id,
          adjustmentType,
          amount: adjustAmountDecimal,
          reason: reason.trim(),
          authorizedById: req.user!.userId,
        },
      });

      // Recalculate status
      const financials = calculateAssignmentFinancials(assignment);
      const netPaid = new Prisma.Decimal(financials.netPaid);
      let newStatus: PaymentStatus;

      if (netPaid.greaterThanOrEqualTo(newFinalAmount)) {
        newStatus = PaymentStatus.PAID;
      } else if (netPaid.greaterThan(0)) {
        newStatus = PaymentStatus.PARTIALLY_PAID;
      } else if (new Date(assignment.dueDate) < new Date()) {
        newStatus = PaymentStatus.OVERDUE;
      } else {
        newStatus = PaymentStatus.PENDING;
      }

      const updatedAssignment = await tx.studentFeeAssignment.update({
        where: { id: assignment.id },
        data: {
          discountAmount: newDiscount,
          finalAmount: newFinalAmount,
          status: newStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          instituteId,
          userId: req.user?.userId || null,
          action: 'FEE_ADJUSTMENT_RECORDED',
          entityType: 'StudentFeeAssignment',
          entityId: assignment.id,
          newValues: {
            adjustmentId: adjustment.id,
            adjustmentType,
            amount: Number(adjustment.amount.toFixed(2)),
            newFinalAmount: Number(newFinalAmount.toFixed(2)),
            newStatus,
          },
        },
      });

      return {
        adjustment,
        updatedAssignment,
      };
    }, { maxWait: 15000, timeout: 30000 });

    return res.status(201).json({
      success: true,
      message: 'Fee adjustment recorded successfully',
      data: result,
    });
  } catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ success: false, error: err.message });
    }
    return res.status(500).json({ success: false, error: 'Failed to record fee adjustment' });
  }
}

export async function listAdjustments(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { adjustmentType, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(String(page)) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit)) || 50));
    const skip = (pageNum - 1) * limitNum;

    const where: any = { instituteId };
    if (adjustmentType) where.adjustmentType = String(adjustmentType);

    const [total, adjustments] = await Promise.all([
      prisma.paymentAdjustment.count({ where }),
      prisma.paymentAdjustment.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          authorizedBy: { select: { id: true, fullName: true, role: true } },
          payment: {
            select: {
              id: true,
              receiptNumber: true,
              amountPaid: true,
              student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
            },
          },
          feeAssignment: {
            select: {
              id: true,
              termLabel: true,
              student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
            },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        adjustments,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to list adjustments' });
  }
}

// ============================================================================
// MODULE F: FINANCIAL DASHBOARD & REPORTS
// ============================================================================

export async function getFinancialSummary(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { academicYear, batchId } = req.query;

    const assignmentWhere: any = { student: { instituteId } };
    if (academicYear) assignmentWhere.academicYear = String(academicYear);
    if (batchId) {
      assignmentWhere.student = {
        ...assignmentWhere.student,
        enrollments: { some: { batchId: String(batchId), isActive: true } },
      };
    }

    const assignments = await prisma.studentFeeAssignment.findMany({
      where: assignmentWhere,
      include: {
        payments: { where: { status: 'SUCCESS' }, include: { adjustments: true } },
        adjustments: true,
      },
    });

    let totalAssigned = new Prisma.Decimal(0);
    let totalCollected = new Prisma.Decimal(0);
    let totalRefunds = new Prisma.Decimal(0);
    let totalOverdue = new Prisma.Decimal(0);
    let totalOutstanding = new Prisma.Decimal(0);

    let fullyPaidCount = 0;
    let partiallyPaidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;

    for (const a of assignments) {
      const financials = calculateAssignmentFinancials(a);
      totalAssigned = totalAssigned.plus(new Prisma.Decimal(a.finalAmount));
      totalCollected = totalCollected.plus(new Prisma.Decimal(financials.netPaid));
      totalRefunds = totalRefunds.plus(new Prisma.Decimal(financials.totalRefunds));
      totalOutstanding = totalOutstanding.plus(new Prisma.Decimal(financials.remainingBalance));

      if (financials.calculatedStatus === PaymentStatus.PAID) {
        fullyPaidCount++;
      } else if (financials.calculatedStatus === PaymentStatus.PARTIALLY_PAID) {
        partiallyPaidCount++;
      } else if (financials.calculatedStatus === PaymentStatus.OVERDUE) {
        overdueCount++;
        totalOverdue = totalOverdue.plus(new Prisma.Decimal(financials.remainingBalance));
      } else {
        pendingCount++;
      }
    }

    return res.json({
      success: true,
      data: {
        totalAssigned: Number(totalAssigned.toFixed(2)),
        totalCollected: Number(totalCollected.toFixed(2)),
        totalRefunds: Number(totalRefunds.toFixed(2)),
        netRetained: Number(totalCollected.toFixed(2)), // net collected
        totalOutstanding: Number(totalOutstanding.toFixed(2)),
        totalOverdue: Number(totalOverdue.toFixed(2)),
        counts: {
          totalAssignments: assignments.length,
          fullyPaid: fullyPaidCount,
          partiallyPaid: partiallyPaidCount,
          pending: pendingCount,
          overdue: overdueCount,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to generate financial summary' });
  }
}

export async function getCollectionsReport(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { startDate, endDate, method } = req.query;

    const where: any = { instituteId, status: 'SUCCESS' };
    if (method) where.method = String(method);

    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) {
        const s = new Date(String(startDate));
        if (isNaN(s.getTime())) return res.status(400).json({ success: false, error: 'Invalid start date' });
        where.paidAt.gte = s;
      }
      if (endDate) {
        const e = new Date(String(endDate));
        if (isNaN(e.getTime())) return res.status(400).json({ success: false, error: 'Invalid end date' });
        where.paidAt.lte = e;
      }
    }

    const payments = await prisma.payment.findMany({
      where,
      orderBy: { paidAt: 'desc' },
      include: {
        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
        feeAssignment: {
          select: {
            id: true,
            termLabel: true,
            feeStructure: { select: { name: true } },
          },
        },
        adjustments: true,
      },
    });

    const methodBreakdown: Record<string, { count: number; total: number }> = {
      CASH: { count: 0, total: 0 },
      UPI: { count: 0, total: 0 },
      BANK_TRANSFER: { count: 0, total: 0 },
      CHEQUE: { count: 0, total: 0 },
      ONLINE: { count: 0, total: 0 },
    };

    let grandTotalCollected = new Prisma.Decimal(0);
    let grandTotalRefunded = new Prisma.Decimal(0);

    for (const p of payments) {
      const amount = new Prisma.Decimal(p.amountPaid);
      grandTotalCollected = grandTotalCollected.plus(amount);

      let pRefunded = new Prisma.Decimal(0);
      for (const adj of p.adjustments) {
        if (adj.adjustmentType === 'REFUND') {
          pRefunded = pRefunded.plus(new Prisma.Decimal(adj.amount));
        }
      }
      grandTotalRefunded = grandTotalRefunded.plus(pRefunded);

      if (methodBreakdown[p.method]) {
        methodBreakdown[p.method].count += 1;
        methodBreakdown[p.method].total = Number(
          (methodBreakdown[p.method].total + Number(amount.toFixed(2))).toFixed(2)
        );
      }
    }

    return res.json({
      success: true,
      data: {
        totalCollected: Number(grandTotalCollected.toFixed(2)),
        totalRefunded: Number(grandTotalRefunded.toFixed(2)),
        netCollected: Number(grandTotalCollected.minus(grandTotalRefunded).toFixed(2)),
        transactionCount: payments.length,
        methodBreakdown,
        payments,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to generate collections report' });
  }
}

export async function getOutstandingReport(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { batchId, academicYear, isOverdueOnly } = req.query;

    const where: any = {
      student: { instituteId },
      status: { in: [PaymentStatus.PENDING, PaymentStatus.PARTIALLY_PAID, PaymentStatus.OVERDUE] },
    };

    if (academicYear) where.academicYear = String(academicYear);
    if (batchId) {
      where.student = {
        ...where.student,
        enrollments: { some: { batchId: String(batchId), isActive: true } },
      };
    }

    const assignments = await prisma.studentFeeAssignment.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
        feeStructure: { select: { id: true, name: true, frequency: true } },
        payments: { where: { status: 'SUCCESS' }, include: { adjustments: true } },
        adjustments: true,
      },
    });

    const now = new Date();
    const result: any[] = [];
    let totalOutstandingAmount = new Prisma.Decimal(0);

    for (const a of assignments) {
      const financials = calculateAssignmentFinancials(a);
      if (financials.remainingBalance <= 0) continue;

      const isOverdue = new Date(a.dueDate) < now;
      if (isOverdueOnly === 'true' && !isOverdue) continue;

      totalOutstandingAmount = totalOutstandingAmount.plus(new Prisma.Decimal(financials.remainingBalance));

      result.push({
        id: a.id,
        student: a.student,
        feeName: a.feeStructure.name,
        termLabel: a.termLabel,
        academicYear: a.academicYear,
        finalAmount: financials.finalAmount,
        netPaid: financials.netPaid,
        remainingBalance: financials.remainingBalance,
        dueDate: a.dueDate,
        isOverdue,
        status: financials.calculatedStatus,
      });
    }

    return res.json({
      success: true,
      data: {
        totalOutstandingAmount: Number(totalOutstandingAmount.toFixed(2)),
        recordCount: result.length,
        records: result,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to generate outstanding report' });
  }
}

// ============================================================================
// MODULE G: ONLINE PAYMENT WORKFLOW (RAZORPAY INTEGRATION)
// ============================================================================

export const createOnlineOrderSchema = z.object({
  studentId: z.string().uuid('Valid student ID is required'),
  feeAssignmentId: z.string().uuid('Valid fee assignment ID is required'),
  amount: z.number().positive('Payment amount must be greater than zero'),
});

export const verifyOnlinePaymentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  paymentId: z.string().min(1, 'Payment ID is required'),
  signature: z.string().min(1, 'Gateway signature is required'),
});

/**
 * Create a verified payment order on the server
 */
export async function createOnlinePaymentOrder(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const parse = createOnlineOrderSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const { studentId, feeAssignmentId, amount } = parse.data;

    // Strict student authorization check
    const isAuth = await isStudentAuthorized(req, studentId, prisma);
    if (!isAuth) {
      return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized for this student' });
    }

    // Verify fee assignment
    const assignment = await prisma.studentFeeAssignment.findFirst({
      where: {
        id: feeAssignmentId,
        studentId,
        student: { instituteId },
      },
      include: {
        feeStructure: { select: { name: true } },
        student: { select: { firstName: true, lastName: true, admissionNumber: true } },
        payments: { where: { status: 'SUCCESS' }, select: { amountPaid: true } },
        adjustments: true,
      },
    });

    if (!assignment) {
      return res.status(404).json({ success: false, error: 'Fee assignment not found' });
    }

    const financials = calculateAssignmentFinancials(assignment);
    if (financials.remainingBalance <= 0) {
      return res.status(400).json({ success: false, error: 'Fee is already fully paid' });
    }

    if (amount > financials.remainingBalance) {
      return res.status(400).json({
        success: false,
        error: `Requested amount (₹${amount}) exceeds remaining balance of ₹${financials.remainingBalance}`,
      });
    }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    let gatewayOrderId = '';
    const currency = 'INR';

    if (razorpayKeyId && razorpayKeySecret) {
      // Call real Razorpay API
      const authHeader = 'Basic ' + Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString('base64');
      const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // in paise
          currency,
          receipt: `rcpt_${Date.now().toString().slice(-8)}`,
          notes: {
            studentId,
            feeAssignmentId,
            instituteId,
          },
        }),
      });

      if (!orderRes.ok) {
        const errorData = await orderRes.json().catch(() => ({}));
        console.error('[Razorpay Order Creation Failed]', errorData);
        return res.status(502).json({ success: false, error: 'Failed to create payment order with gateway' });
      }

      const orderData = (await orderRes.json()) as any;
      gatewayOrderId = orderData.id;
    } else {
      // Development simulated order with cryptographic seed
      gatewayOrderId = `order_sim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }

    // Record pending order
    const paymentOrder = await prisma.onlinePaymentOrder.create({
      data: {
        instituteId,
        studentId,
        feeAssignmentId,
        orderId: gatewayOrderId,
        amount: new Prisma.Decimal(amount),
        currency,
        status: 'PENDING',
        metadata: {
          feeName: assignment.feeStructure.name,
          termLabel: assignment.termLabel,
          studentName: `${assignment.student.firstName} ${assignment.student.lastName}`,
        },
      },
    });

    return res.json({
      success: true,
      message: 'Payment order created successfully',
      data: {
        orderId: gatewayOrderId,
        amount,
        currency,
        keyId: razorpayKeyId || 'rzp_test_simulated',
        studentId,
        feeAssignmentId,
        studentName: `${assignment.student.firstName} ${assignment.student.lastName}`,
        feeName: assignment.feeStructure.name,
        termLabel: assignment.termLabel,
        isSimulated: !razorpayKeyId,
      },
    });
  } catch (err: any) {
    console.error('[Create Online Payment Order Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to initiate payment order' });
  }
}

/**
 * Server-side signature verification & atomic payment recording
 */
export async function verifyOnlinePayment(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const parse = verifyOnlinePaymentSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
    }

    const { orderId, paymentId, signature } = parse.data;

    // Retrieve pending order
    const order = await prisma.onlinePaymentOrder.findUnique({
      where: { orderId },
      include: {
        feeAssignment: {
          include: {
            feeStructure: true,
            student: true,
            payments: { where: { status: 'SUCCESS' } },
            adjustments: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, error: 'Payment order not found' });
    }

    if (order.instituteId !== instituteId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Order institute mismatch' });
    }

    if (order.status === 'VERIFIED') {
      return res.status(409).json({
        success: false,
        error: 'Payment for this order has already been processed and credited',
        receiptNumber: order.receiptNumber,
      });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({ success: false, error: `Invalid order state: ${order.status}` });
    }

    // Verify cryptographic signature if secret is configured
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
    if (razorpayKeySecret && !orderId.startsWith('order_sim_')) {
      const generatedSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const isSignatureValid = crypto.timingSafeEqual(
        Buffer.from(generatedSignature, 'utf8'),
        Buffer.from(signature, 'utf8')
      );

      if (!isSignatureValid) {
        await prisma.onlinePaymentOrder.update({
          where: { id: order.id },
          data: { status: 'FAILED', gatewayPaymentId: paymentId, gatewaySignature: signature },
        });
        return res.status(400).json({ success: false, error: 'Invalid payment signature verification failed' });
      }
    }

    // Atomic credit transaction
    const receiptNumber = `REC-ONL-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Re-check anti-replay inside transaction
      const freshOrder = await tx.onlinePaymentOrder.findUnique({ where: { id: order.id } });
      if (freshOrder?.status === 'VERIFIED') {
        throw new Error('ORDER_ALREADY_VERIFIED');
      }

      // 2. Create official Payment record
      const payment = await tx.payment.create({
        data: {
          instituteId,
          studentId: order.studentId,
          feeAssignmentId: order.feeAssignmentId,
          receiptNumber,
          amountPaid: order.amount,
          method: PaymentMethod.ONLINE,
          transactionReference: paymentId,
          idempotencyKey: `online_${orderId}_${paymentId}`,
          status: 'SUCCESS',
          recordedById: req.user!.userId,
          remarks: `Online Payment Gateway verified (Order: ${orderId})`,
        },
      });

      // 3. Recalculate and update fee assignment status
      const existingPayments = await tx.payment.findMany({
        where: { feeAssignmentId: order.feeAssignmentId, status: 'SUCCESS' },
      });
      const totalPaid = existingPayments.reduce((acc, p) => acc.plus(p.amountPaid), new Prisma.Decimal(0));
      const finalAmount = order.feeAssignment.finalAmount;

      const newStatus = totalPaid.greaterThanOrEqualTo(finalAmount)
        ? PaymentStatus.PAID
        : totalPaid.greaterThan(0)
        ? PaymentStatus.PARTIALLY_PAID
        : PaymentStatus.PENDING;

      await tx.studentFeeAssignment.update({
        where: { id: order.feeAssignmentId },
        data: { status: newStatus },
      });

      // 4. Update online order status
      const updatedOrder = await tx.onlinePaymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'VERIFIED',
          gatewayPaymentId: paymentId,
          gatewaySignature: signature,
          receiptNumber,
          paymentId: payment.id,
        },
      });

      // 5. In-app notification
      await tx.inAppNotification.create({
        data: {
          instituteId,
          userId: req.user!.userId,
          studentId: order.studentId,
          type: 'FEE_PAID',
          title: 'Fee Payment Verified',
          message: `Your online payment of ₹${order.amount} for ${order.feeAssignment.feeStructure.name} was successfully verified (Receipt: ${receiptNumber}).`,
          link: `/parent_portal?tab=fees&receipt=${payment.id}`,
        },
      });

      // 6. Audit log
      await tx.auditLog.create({
        data: {
          instituteId,
          userId: req.user!.userId,
          action: 'ONLINE_FEE_PAYMENT_VERIFIED',
          entityType: 'Payment',
          entityId: payment.id,
          newValues: {
            orderId,
            paymentId,
            receiptNumber,
            amount: Number(order.amount),
          },
        },
      });

      return { payment, updatedOrder };
    });

    return res.json({
      success: true,
      message: 'Online payment verified and credited successfully',
      data: {
        payment: result.payment,
        receiptNumber,
      },
    });
  } catch (err: any) {
    if (err.message === 'ORDER_ALREADY_VERIFIED') {
      return res.status(409).json({ success: false, error: 'Order has already been processed' });
    }
    console.error('[Verify Online Payment Error]', err);
    return res.status(500).json({ success: false, error: 'Payment verification failed' });
  }
}

/**
 * Gateway Webhook listener for asynchronous confirmation
 */
export async function handlePaymentWebhook(req: AuthenticatedRequest, res: Response) {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'] as string;

    if (webhookSecret && signature) {
      const bodyStr = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(bodyStr)
        .digest('hex');

      if (signature !== expectedSignature) {
        return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
      }
    }

    const event = req.body?.event;
    console.log(`[Payment Webhook Received] event: ${event}`);

    return res.json({ status: 'ok' });
  } catch (err: any) {
    console.error('[Payment Webhook Error]', err);
    return res.status(500).json({ success: false, error: 'Webhook processing error' });
  }
}

