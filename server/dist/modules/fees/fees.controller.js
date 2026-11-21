"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOnlinePaymentSchema = exports.createOnlineOrderSchema = exports.adjustFeeSchema = exports.refundPaymentSchema = exports.recordPaymentSchema = exports.batchAssignFeeSchema = exports.assignFeeSchema = exports.updateFeeStructureSchema = exports.createFeeStructureSchema = void 0;
exports.createFeeStructure = createFeeStructure;
exports.autoSyncInstituteFeeStructures = autoSyncInstituteFeeStructures;
exports.listFeeStructures = listFeeStructures;
exports.getFeeStructureById = getFeeStructureById;
exports.updateFeeStructure = updateFeeStructure;
exports.calculateCourseFeeMilestones = calculateCourseFeeMilestones;
exports.assignFeeToStudent = assignFeeToStudent;
exports.assignFeeToBatch = assignFeeToBatch;
exports.listFeeAssignments = listFeeAssignments;
exports.getFeeAssignmentById = getFeeAssignmentById;
exports.getStudentFeeStatement = getStudentFeeStatement;
exports.recordPayment = recordPayment;
exports.listPayments = listPayments;
exports.getReceipt = getReceipt;
exports.processRefund = processRefund;
exports.createFeeAdjustment = createFeeAdjustment;
exports.listAdjustments = listAdjustments;
exports.getFinancialSummary = getFinancialSummary;
exports.getCollectionsReport = getCollectionsReport;
exports.getOutstandingReport = getOutstandingReport;
exports.createOnlinePaymentOrder = createOnlinePaymentOrder;
exports.verifyOnlinePayment = verifyOnlinePayment;
exports.handlePaymentWebhook = handlePaymentWebhook;
exports.getStudentMyFees = getStudentMyFees;
const crypto_1 = __importDefault(require("crypto"));
const client_1 = require("@prisma/client");
const prisma_js_1 = require("../../prisma.js");
const zod_1 = require("zod");
const student_authorization_service_js_1 = require("../students/student-authorization.service.js");
const inapp_notification_service_js_1 = require("../notifications/inapp-notification.service.js");
const razorpay_service_js_1 = require("../payments/razorpay.service.js");
const revenue_engine_service_js_1 = require("../payments/revenue-engine.service.js");
// ============================================================================
// VALIDATION SCHEMAS
// ============================================================================
exports.createFeeStructureSchema = zod_1.z.object({
    batchId: zod_1.z.string().uuid(),
    name: zod_1.z.string().min(2).max(100),
    description: zod_1.z.string().optional(),
    academicYear: zod_1.z.string().min(4).max(20).optional(),
    frequency: zod_1.z.nativeEnum(client_1.FeeFrequency),
    amount: zod_1.z.number().positive('Fee amount must be greater than zero'),
    dueDay: zod_1.z.number().int().min(1).max(31).optional(),
    midCourseDueDays: zod_1.z.number().int().min(1).max(365).optional().nullable(),
    isActive: zod_1.z.boolean().default(true),
});
exports.updateFeeStructureSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100).optional(),
    description: zod_1.z.string().optional(),
    academicYear: zod_1.z.string().min(4).max(20).optional(),
    amount: zod_1.z.number().positive().optional(),
    dueDay: zod_1.z.number().int().min(1).max(31).optional(),
    midCourseDueDays: zod_1.z.number().int().min(1).max(365).optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
exports.assignFeeSchema = zod_1.z.object({
    studentId: zod_1.z.string().uuid(),
    feeStructureId: zod_1.z.string().uuid(),
    termLabel: zod_1.z.string().max(100).optional().nullable().transform((v) => (v && v.trim() ? v.trim() : undefined)),
    academicYear: zod_1.z.string().max(20).optional().nullable().transform((v) => (v && v.trim() ? v.trim() : undefined)),
    baseAmount: zod_1.z.number().positive('Base amount must be greater than zero').optional(),
    discountAmount: zod_1.z.number().min(0, 'Discount cannot be negative').default(0),
    dueDate: zod_1.z.string().min(1, 'Due date is required'),
    midCourseDueDate: zod_1.z.string().optional().nullable(),
});
exports.batchAssignFeeSchema = zod_1.z.object({
    batchId: zod_1.z.string().uuid(),
    feeStructureId: zod_1.z.string().uuid(),
    termLabel: zod_1.z.string().max(100).optional().nullable().transform((v) => (v && v.trim() ? v.trim() : undefined)),
    academicYear: zod_1.z.string().max(20).optional().nullable().transform((v) => (v && v.trim() ? v.trim() : undefined)),
    dueDate: zod_1.z.string().min(1, 'Due date is required'),
    midCourseDueDate: zod_1.z.string().optional().nullable(),
    defaultDiscount: zod_1.z.number().min(0).default(0),
});
exports.recordPaymentSchema = zod_1.z.object({
    feeAssignmentId: zod_1.z.string().uuid(),
    amountPaid: zod_1.z.number().positive('Payment amount must be greater than zero'),
    method: zod_1.z.nativeEnum(client_1.PaymentMethod),
    transactionReference: zod_1.z.string().optional(),
    idempotencyKey: zod_1.z.string().optional(),
    remarks: zod_1.z.string().optional(),
});
exports.refundPaymentSchema = zod_1.z.object({
    amount: zod_1.z.number().positive('Refund amount must be greater than zero'),
    reason: zod_1.z.string().min(3, 'A clear reason for the refund is required'),
});
exports.adjustFeeSchema = zod_1.z.object({
    adjustmentType: zod_1.z.enum(['DISCOUNT', 'CONCESSION', 'CORRECTION']),
    amount: zod_1.z.number().positive('Adjustment amount must be positive'),
    reason: zod_1.z.string().min(3, 'Adjustment reason is required'),
});
// Helper: Calculate net paid and balance for an assignment
function calculateAssignmentFinancials(assignment) {
    const finalAmount = new client_1.Prisma.Decimal(assignment.finalAmount);
    let totalPayments = new client_1.Prisma.Decimal(0);
    let totalRefunds = new client_1.Prisma.Decimal(0);
    if (assignment.payments && Array.isArray(assignment.payments)) {
        for (const payment of assignment.payments) {
            if (payment.status !== 'FAILED') {
                totalPayments = totalPayments.plus(new client_1.Prisma.Decimal(payment.amountPaid));
                if (payment.adjustments && Array.isArray(payment.adjustments)) {
                    for (const adj of payment.adjustments) {
                        if (adj.adjustmentType === 'REFUND') {
                            totalRefunds = totalRefunds.plus(new client_1.Prisma.Decimal(adj.amount));
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
                totalRefunds = totalRefunds.plus(new client_1.Prisma.Decimal(adj.amount));
            }
        }
    }
    const netPaid = totalPayments.minus(totalRefunds);
    const remainingBalance = finalAmount.minus(netPaid);
    let calculatedStatus;
    const now = new Date();
    const dueDate = new Date(assignment.dueDate);
    if (netPaid.greaterThanOrEqualTo(finalAmount)) {
        calculatedStatus = client_1.PaymentStatus.PAID;
    }
    else if (netPaid.greaterThan(0)) {
        calculatedStatus = client_1.PaymentStatus.PARTIALLY_PAID;
    }
    else if (dueDate < now) {
        calculatedStatus = client_1.PaymentStatus.OVERDUE;
    }
    else {
        calculatedStatus = client_1.PaymentStatus.PENDING;
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
function generateReceiptNumber() {
    const year = new Date().getFullYear();
    const timeSuffix = Date.now().toString().slice(-4);
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `REC-${year}-${timeSuffix}${randomSuffix}`;
}
// ============================================================================
// MODULE A: FEE STRUCTURE MANAGEMENT
// ============================================================================
async function createFeeStructure(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const parse = exports.createFeeStructureSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const data = parse.data;
        // Verify batch belongs to this institute
        const batch = await prisma_js_1.prisma.batch.findFirst({
            where: { id: data.batchId, instituteId },
        });
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        const feeStructure = await prisma_js_1.prisma.feeStructure.create({
            data: {
                instituteId,
                batchId: data.batchId,
                name: data.name.trim(),
                description: data.description?.trim() || null,
                academicYear: data.academicYear || batch.academicYear,
                frequency: data.frequency,
                amount: new client_1.Prisma.Decimal(data.amount.toFixed(2)),
                dueDay: data.dueDay || null,
                midCourseDueDays: data.midCourseDueDays !== undefined ? data.midCourseDueDays : null,
                isActive: data.isActive,
            },
            include: {
                batch: { select: { id: true, name: true, academicYear: true } },
            },
        });
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId,
                userId: req.user?.userId || null,
                action: 'FEE_STRUCTURE_CREATED',
                entityType: 'FeeStructure',
                entityId: feeStructure.id,
                newValues: feeStructure,
            },
        });
        return res.status(201).json({
            success: true,
            message: 'Fee structure created successfully',
            data: { feeStructure },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to create fee structure' });
    }
}
async function autoSyncInstituteFeeStructures(instituteId) {
    try {
        const institute = await prisma_js_1.prisma.institute.findUnique({
            where: { id: instituteId },
            include: {
                franchise: {
                    include: {
                        courseSelections: {
                            where: { isEnabled: true },
                            include: { course: true },
                        },
                    },
                },
                batches: {
                    where: { isActive: true },
                    include: { feeStructures: true },
                },
            },
        });
        if (!institute || !institute.batches || institute.batches.length === 0)
            return;
        let standardCourseFee = 30000;
        const enabledCourse = institute.franchise?.courseSelections?.[0];
        if (enabledCourse) {
            const local = enabledCourse.localFeeOverride ? Number(enabledCourse.localFeeOverride) : null;
            const global = enabledCourse.course?.price ? Number(enabledCourse.course.price) : null;
            if (local && local > 0)
                standardCourseFee = local;
            else if (global && global > 0)
                standardCourseFee = global;
        }
        const courseTitle = enabledCourse?.course?.title || 'Course';
        for (const batch of institute.batches) {
            const hasFull = batch.feeStructures.some((fs) => fs.frequency === client_1.FeeFrequency.FULL_PAYMENT);
            const hasInstallments = batch.feeStructures.some((fs) => fs.frequency === client_1.FeeFrequency.TWO_INSTALLMENTS);
            if (!hasFull) {
                await prisma_js_1.prisma.feeStructure.create({
                    data: {
                        institute: { connect: { id: instituteId } },
                        batch: { connect: { id: batch.id } },
                        name: `${batch.name} - Full Course Payment (100%)`,
                        academicYear: batch.academicYear,
                        frequency: client_1.FeeFrequency.FULL_PAYMENT,
                        amount: standardCourseFee,
                        description: `100% upfront course fee for ${courseTitle}`,
                        isActive: true,
                    },
                });
            }
            if (!hasInstallments) {
                await prisma_js_1.prisma.feeStructure.create({
                    data: {
                        institute: { connect: { id: instituteId } },
                        batch: { connect: { id: batch.id } },
                        name: `${batch.name} - 2 Installments Plan (50% + 50%)`,
                        academicYear: batch.academicYear,
                        frequency: client_1.FeeFrequency.TWO_INSTALLMENTS,
                        amount: standardCourseFee,
                        midCourseDueDays: 45,
                        description: `2 installments: 50% upfront before course starts and 50% mid-course for ${courseTitle}`,
                        isActive: true,
                    },
                });
            }
        }
    }
    catch (err) {
        console.error('[AutoSync Fee Structures Error]', err);
    }
}
async function listFeeStructures(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        // Automatically ensure standard 2-type fee structures exist for all active batches
        await autoSyncInstituteFeeStructures(instituteId);
        const { batchId, academicYear, isActive } = req.query;
        const where = { instituteId };
        if (batchId)
            where.batchId = String(batchId);
        if (academicYear)
            where.academicYear = String(academicYear);
        if (isActive !== undefined)
            where.isActive = isActive === 'true';
        const feeStructures = await prisma_js_1.prisma.feeStructure.findMany({
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
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to list fee structures' });
    }
}
async function getFeeStructureById(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const feeStructure = await prisma_js_1.prisma.feeStructure.findFirst({
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
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to get fee structure' });
    }
}
async function updateFeeStructure(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const parse = exports.updateFeeStructureSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const existing = await prisma_js_1.prisma.feeStructure.findFirst({
            where: { id, instituteId },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Fee structure not found' });
        }
        const data = parse.data;
        const updated = await prisma_js_1.prisma.feeStructure.update({
            where: { id },
            data: {
                ...(data.name ? { name: data.name.trim() } : {}),
                ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
                ...(data.academicYear ? { academicYear: data.academicYear } : {}),
                ...(data.amount ? { amount: new client_1.Prisma.Decimal(data.amount.toFixed(2)) } : {}),
                ...(data.dueDay !== undefined ? { dueDay: data.dueDay } : {}),
                ...(data.midCourseDueDays !== undefined ? { midCourseDueDays: data.midCourseDueDays } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            },
        });
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId,
                userId: req.user?.userId || null,
                action: 'FEE_STRUCTURE_UPDATED',
                entityType: 'FeeStructure',
                entityId: id,
                oldValues: existing,
                newValues: updated,
            },
        });
        return res.json({
            success: true,
            message: 'Fee structure updated successfully',
            data: { feeStructure: updated },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to update fee structure' });
    }
}
// ============================================================================
// MODULE B: STUDENT FEE ASSIGNMENT
// ============================================================================
function calculateCourseFeeMilestones(feeStructure, batch, options) {
    const totalBase = options?.customBaseAmount !== undefined
        ? new client_1.Prisma.Decimal(options.customBaseAmount.toFixed(2))
        : feeStructure.amount;
    const totalDiscount = new client_1.Prisma.Decimal((options?.customDiscountAmount || 0).toFixed(2));
    if (totalDiscount.greaterThan(totalBase)) {
        throw new Error('Discount amount cannot exceed base fee amount');
    }
    const preCourseDueDate = options?.customDueDate
        ? new Date(options.customDueDate)
        : (batch?.startDate ? new Date(batch.startDate) : new Date());
    if (isNaN(preCourseDueDate.getTime())) {
        throw new Error('Invalid initial due date');
    }
    // 1. Two Installments (50% Upfront + 50% Mid-Course)
    if (feeStructure.frequency === client_1.FeeFrequency.TWO_INSTALLMENTS) {
        const halfBase = new client_1.Prisma.Decimal((Number(totalBase) / 2).toFixed(2));
        const remBase = totalBase.minus(halfBase);
        const halfDiscount = new client_1.Prisma.Decimal((Number(totalDiscount) / 2).toFixed(2));
        const remDiscount = totalDiscount.minus(halfDiscount);
        let midCourseDueDate;
        if (options?.customMidCourseDueDate) {
            midCourseDueDate = new Date(options.customMidCourseDueDate);
        }
        else if (batch?.startDate && batch?.endDate) {
            const startMs = new Date(batch.startDate).getTime();
            const endMs = new Date(batch.endDate).getTime();
            const midMs = startMs + Math.max(0, (endMs - startMs) / 2);
            midCourseDueDate = new Date(midMs);
        }
        else if (feeStructure.midCourseDueDays) {
            midCourseDueDate = new Date(preCourseDueDate.getTime() + feeStructure.midCourseDueDays * 86400000);
        }
        else {
            midCourseDueDate = new Date(preCourseDueDate.getTime() + 45 * 86400000); // 45 days default
        }
        if (isNaN(midCourseDueDate.getTime())) {
            midCourseDueDate = new Date(preCourseDueDate.getTime() + 45 * 86400000);
        }
        const basePrefix = options?.customTermLabel?.trim();
        return [
            {
                termLabel: basePrefix ? `${basePrefix} - Inst 1` : 'Installment 1 of 2 (Initial / Pre-Course)',
                baseAmount: halfBase,
                discountAmount: halfDiscount,
                finalAmount: halfBase.minus(halfDiscount),
                dueDate: preCourseDueDate,
            },
            {
                termLabel: basePrefix ? `${basePrefix} - Inst 2` : 'Installment 2 of 2 (Mid-Course)',
                baseAmount: remBase,
                discountAmount: remDiscount,
                finalAmount: remBase.minus(remDiscount),
                dueDate: midCourseDueDate,
            },
        ];
    }
    // 2. Full Course Payment or legacy frequency
    const termLabel = options?.customTermLabel?.trim() ||
        (feeStructure.frequency === client_1.FeeFrequency.FULL_PAYMENT ? 'Full Course Payment' : 'Full Course Fee');
    return [
        {
            termLabel,
            baseAmount: totalBase,
            discountAmount: totalDiscount,
            finalAmount: totalBase.minus(totalDiscount),
            dueDate: preCourseDueDate,
        },
    ];
}
async function assignFeeToStudent(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const parse = exports.assignFeeSchema.safeParse(req.body);
        if (!parse.success) {
            const msg = parse.error.errors[0]?.message || 'Validation failed';
            return res.status(400).json({ success: false, error: msg, details: parse.error.errors });
        }
        const data = parse.data;
        // Verify student belongs to institute
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { id: data.studentId, instituteId },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found in this institute' });
        }
        // Verify feeStructure belongs to institute and load batch info
        const feeStructure = await prisma_js_1.prisma.feeStructure.findFirst({
            where: { id: data.feeStructureId, instituteId },
            include: { batch: true },
        });
        if (!feeStructure) {
            return res.status(404).json({ success: false, error: 'Fee structure not found in this institute' });
        }
        const milestones = calculateCourseFeeMilestones(feeStructure, feeStructure.batch, {
            customBaseAmount: data.baseAmount,
            customDiscountAmount: data.discountAmount,
            customDueDate: data.dueDate,
            customMidCourseDueDate: data.midCourseDueDate,
            customTermLabel: data.termLabel,
        });
        // Check if any milestone already exists for this student
        const existingChecks = await Promise.all(milestones.map((ms) => prisma_js_1.prisma.studentFeeAssignment.findUnique({
            where: {
                studentId_feeStructureId_termLabel: {
                    studentId: data.studentId,
                    feeStructureId: data.feeStructureId,
                    termLabel: ms.termLabel,
                },
            },
        })));
        const alreadyAssigned = existingChecks.filter(Boolean);
        if (alreadyAssigned.length === milestones.length) {
            return res.status(409).json({
                success: false,
                error: `Fee already fully assigned to this student for '${milestones.map((m) => m.termLabel).join(', ')}'`,
            });
        }
        const assignments = await prisma_js_1.prisma.$transaction(async (tx) => {
            const created = [];
            for (const ms of milestones) {
                const exists = await tx.studentFeeAssignment.findUnique({
                    where: {
                        studentId_feeStructureId_termLabel: {
                            studentId: data.studentId,
                            feeStructureId: data.feeStructureId,
                            termLabel: ms.termLabel,
                        },
                    },
                });
                if (exists) {
                    created.push(exists);
                    continue;
                }
                const assignment = await tx.studentFeeAssignment.create({
                    data: {
                        studentId: data.studentId,
                        feeStructureId: data.feeStructureId,
                        termLabel: ms.termLabel,
                        academicYear: data.academicYear || feeStructure.academicYear,
                        baseAmount: ms.baseAmount,
                        discountAmount: ms.discountAmount,
                        finalAmount: ms.finalAmount,
                        dueDate: ms.dueDate,
                        status: client_1.PaymentStatus.PENDING,
                    },
                    include: {
                        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
                        feeStructure: { select: { id: true, name: true, frequency: true } },
                    },
                });
                await tx.auditLog.create({
                    data: {
                        instituteId,
                        userId: req.user?.userId || null,
                        action: 'FEE_ASSIGNED',
                        entityType: 'StudentFeeAssignment',
                        entityId: assignment.id,
                        newValues: assignment,
                    },
                });
                created.push(assignment);
            }
            return created;
        });
        return res.status(201).json({
            success: true,
            message: assignments.length > 1
                ? 'Course fee assigned in 2 installments successfully'
                : 'Course fee assigned to student successfully',
            data: {
                assignment: assignments[0],
                assignments,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Failed to assign fee to student' });
    }
}
async function assignFeeToBatch(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const parse = exports.batchAssignFeeSchema.safeParse(req.body);
        if (!parse.success) {
            const msg = parse.error.errors[0]?.message || 'Validation failed';
            return res.status(400).json({ success: false, error: msg, details: parse.error.errors });
        }
        const data = parse.data;
        // Verify batch belongs to institute
        const batch = await prisma_js_1.prisma.batch.findFirst({
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
        const feeStructure = await prisma_js_1.prisma.feeStructure.findFirst({
            where: { id: data.feeStructureId, instituteId },
        });
        if (!feeStructure) {
            return res.status(404).json({ success: false, error: 'Fee structure not found' });
        }
        const milestones = calculateCourseFeeMilestones(feeStructure, batch, {
            customDiscountAmount: data.defaultDiscount,
            customDueDate: data.dueDate,
            customMidCourseDueDate: data.midCourseDueDate,
            customTermLabel: data.termLabel,
        });
        let assignedCount = 0;
        let skippedCount = 0;
        const assignmentsCreated = [];
        // Process students transactionally
        await prisma_js_1.prisma.$transaction(async (tx) => {
            for (const enrollment of batch.enrollments) {
                let studentGotCreated = false;
                for (const ms of milestones) {
                    const exists = await tx.studentFeeAssignment.findUnique({
                        where: {
                            studentId_feeStructureId_termLabel: {
                                studentId: enrollment.studentId,
                                feeStructureId: data.feeStructureId,
                                termLabel: ms.termLabel,
                            },
                        },
                    });
                    if (exists) {
                        continue;
                    }
                    const newAssignment = await tx.studentFeeAssignment.create({
                        data: {
                            studentId: enrollment.studentId,
                            feeStructureId: data.feeStructureId,
                            termLabel: ms.termLabel,
                            academicYear: data.academicYear || feeStructure.academicYear || batch.academicYear,
                            baseAmount: ms.baseAmount,
                            discountAmount: ms.discountAmount,
                            finalAmount: ms.finalAmount,
                            dueDate: ms.dueDate,
                            status: client_1.PaymentStatus.PENDING,
                        },
                    });
                    assignmentsCreated.push(newAssignment);
                    studentGotCreated = true;
                }
                if (studentGotCreated) {
                    assignedCount++;
                }
                else {
                    skippedCount++;
                }
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
                        milestones: milestones.map((m) => m.termLabel),
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
                totalSchedulesCreated: assignmentsCreated.length,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Failed to assign fee to batch' });
    }
}
async function listFeeAssignments(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { studentId, batchId, feeStructureId, academicYear, status, page = '1', limit = '50', } = req.query;
        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(String(limit)) || 50));
        const skip = (pageNum - 1) * limitNum;
        const where = {
            student: { instituteId },
        };
        if (studentId)
            where.studentId = String(studentId);
        if (feeStructureId)
            where.feeStructureId = String(feeStructureId);
        if (academicYear)
            where.academicYear = String(academicYear);
        if (status)
            where.status = String(status);
        if (batchId) {
            where.student = {
                ...where.student,
                enrollments: { some: { batchId: String(batchId), isActive: true } },
            };
        }
        const [total, assignments] = await Promise.all([
            prisma_js_1.prisma.studentFeeAssignment.count({ where }),
            prisma_js_1.prisma.studentFeeAssignment.findMany({
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
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to list fee assignments' });
    }
}
async function getFeeAssignmentById(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const assignment = await prisma_js_1.prisma.studentFeeAssignment.findFirst({
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
            const studentUser = await prisma_js_1.prisma.student.findFirst({ where: { userId: req.user.userId } });
            if (!studentUser || studentUser.id !== assignment.studentId) {
                return res.status(403).json({ success: false, error: 'Forbidden: Access to another student record denied' });
            }
        }
        else if (req.user?.role === 'PARENT') {
            const relation = await prisma_js_1.prisma.studentParentRelation.findFirst({
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
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to get fee assignment' });
    }
}
async function getStudentFeeStatement(req, res) {
    try {
        const instituteId = req.instituteId;
        const { studentId } = req.params;
        // Check student in institute
        const student = await prisma_js_1.prisma.student.findFirst({
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
            const studentUser = await prisma_js_1.prisma.student.findFirst({ where: { userId: req.user.userId } });
            if (!studentUser || studentUser.id !== studentId) {
                return res.status(403).json({ success: false, error: 'Forbidden: Cannot view another student statement' });
            }
        }
        else if (req.user?.role === 'PARENT') {
            const relation = await prisma_js_1.prisma.studentParentRelation.findFirst({
                where: { studentId, parent: { userId: req.user.userId } },
            });
            if (!relation) {
                return res.status(403).json({ success: false, error: 'Forbidden: Student is not linked to parent profile' });
            }
        }
        else if (req.user?.role === 'STAFF') {
            const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
            if (!isAuth) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to view fee statements for this student' });
            }
        }
        const assignments = await prisma_js_1.prisma.studentFeeAssignment.findMany({
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
        let totalAssigned = new client_1.Prisma.Decimal(0);
        let totalDiscount = new client_1.Prisma.Decimal(0);
        let totalPayable = new client_1.Prisma.Decimal(0);
        let totalPaid = new client_1.Prisma.Decimal(0);
        let totalRefunded = new client_1.Prisma.Decimal(0);
        const statementItems = assignments.map((a) => {
            const financials = calculateAssignmentFinancials(a);
            totalAssigned = totalAssigned.plus(new client_1.Prisma.Decimal(a.baseAmount));
            totalDiscount = totalDiscount.plus(new client_1.Prisma.Decimal(a.discountAmount));
            totalPayable = totalPayable.plus(new client_1.Prisma.Decimal(a.finalAmount));
            totalPaid = totalPaid.plus(new client_1.Prisma.Decimal(financials.netPaid));
            totalRefunded = totalRefunded.plus(new client_1.Prisma.Decimal(financials.totalRefunds));
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
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to generate student fee statement' });
    }
}
// ============================================================================
// MODULE C: PAYMENT RECORDING
// ============================================================================
async function recordPayment(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const parse = exports.recordPaymentSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const data = parse.data;
        // Business Rule A.2: Franchise owners and branch administrators cannot manually collect or confirm online payments
        if (data.method === client_1.PaymentMethod.ONLINE) {
            return res.status(400).json({
                success: false,
                error: 'Online payments cannot be manually confirmed or collected by administrators; students must pay through the centralized Razorpay gateway.',
            });
        }
        // Check idempotency if key is provided
        if (data.idempotencyKey) {
            const existingPayment = await prisma_js_1.prisma.payment.findUnique({
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
        const paymentAmountDecimal = new client_1.Prisma.Decimal(data.amountPaid.toFixed(2));
        if (paymentAmountDecimal.lessThanOrEqualTo(0)) {
            return res.status(400).json({ success: false, error: 'Payment amount must be greater than zero' });
        }
        // Atomic transaction for payment recording and balance checking
        const result = await prisma_js_1.prisma.$transaction(async (tx) => {
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
            if (paymentAmountDecimal.greaterThan(new client_1.Prisma.Decimal(currentFinancials.remainingBalance))) {
                throw {
                    status: 400,
                    message: `Payment amount ₹${paymentAmountDecimal.toFixed(2)} exceeds remaining balance of ₹${currentFinancials.remainingBalance.toFixed(2)}`,
                };
            }
            const receiptNumber = generateReceiptNumber();
            // Resolve Franchise and Snapshot applicable revenue sharing percentage (Rules 3-9)
            const institute = await tx.institute.findUnique({
                where: { id: instituteId },
                include: { franchise: true },
            });
            const franchiseId = institute?.franchiseId || null;
            const franchisePercentage = institute?.franchise?.revenueSharePercentage !== null && institute?.franchise?.revenueSharePercentage !== undefined
                ? Number(institute.franchise.revenueSharePercentage)
                : 50.00;
            const shares = revenue_engine_service_js_1.revenueEngineService.calculateShares(Number(paymentAmountDecimal), franchisePercentage);
            // Create Payment
            const payment = await tx.payment.create({
                data: {
                    instituteId,
                    studentId: assignment.studentId,
                    feeAssignmentId: assignment.id,
                    franchiseId,
                    receiptNumber,
                    amountPaid: paymentAmountDecimal,
                    method: data.method,
                    transactionReference: data.transactionReference?.trim() || null,
                    idempotencyKey: data.idempotencyKey || null,
                    status: 'SUCCESS',
                    recordedById: req.user.userId,
                    remarks: data.remarks?.trim() || null,
                    franchisePercentage: new client_1.Prisma.Decimal(shares.franchisePercentage),
                    digitalGuruPercentage: new client_1.Prisma.Decimal(shares.digitalGuruPercentage),
                    franchiseShareAmount: new client_1.Prisma.Decimal(shares.franchiseShareAmount),
                    digitalGuruShareAmount: new client_1.Prisma.Decimal(shares.digitalGuruShareAmount),
                    netEligibleAmount: new client_1.Prisma.Decimal(shares.netEligibleAmount),
                    feeDeduction: new client_1.Prisma.Decimal(shares.feeDeduction),
                    transferStatus: 'PENDING',
                },
            });
            // Recalculate status with this new payment
            const newNetPaid = new client_1.Prisma.Decimal(currentFinancials.netPaid).plus(paymentAmountDecimal);
            const finalAmount = new client_1.Prisma.Decimal(assignment.finalAmount);
            let newStatus;
            if (newNetPaid.greaterThanOrEqualTo(finalAmount)) {
                newStatus = client_1.PaymentStatus.PAID;
            }
            else {
                newStatus = client_1.PaymentStatus.PARTIALLY_PAID;
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
            const remainingAfter = Math.max(0, Number(finalAmount.minus(newNetPaid).toFixed(2)));
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
            inapp_notification_service_js_1.InAppNotificationService.notifyFeePaymentRecorded(result.payment.id).catch(() => { });
        }
        return res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            data: result,
        });
    }
    catch (err) {
        console.error('[recordPayment Error]:', err);
        if (err.status) {
            return res.status(err.status).json({ success: false, error: err.message });
        }
        return res.status(500).json({ success: false, error: err?.message || 'Failed to record payment' });
    }
}
async function listPayments(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { studentId, feeAssignmentId, method, startDate, endDate, page = '1', limit = '50', } = req.query;
        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(String(limit)) || 50));
        const skip = (pageNum - 1) * limitNum;
        const where = { instituteId };
        if (studentId)
            where.studentId = String(studentId);
        if (feeAssignmentId)
            where.feeAssignmentId = String(feeAssignmentId);
        if (method)
            where.method = String(method);
        if (startDate || endDate) {
            where.paidAt = {};
            if (startDate) {
                const s = new Date(String(startDate));
                if (!isNaN(s.getTime()))
                    where.paidAt.gte = s;
            }
            if (endDate) {
                const e = new Date(String(endDate));
                if (!isNaN(e.getTime()))
                    where.paidAt.lte = e;
            }
        }
        // Role scoping
        if (req.user?.role === 'STUDENT') {
            const student = await prisma_js_1.prisma.student.findFirst({ where: { userId: req.user.userId } });
            if (!student)
                return res.status(403).json({ success: false, error: 'Student profile not found' });
            where.studentId = student.id;
        }
        else if (req.user?.role === 'PARENT') {
            const relations = await prisma_js_1.prisma.studentParentRelation.findMany({
                where: { parent: { userId: req.user.userId } },
                select: { studentId: true },
            });
            const allowedStudentIds = relations.map((r) => r.studentId);
            where.studentId = { in: allowedStudentIds };
        }
        const [total, payments] = await Promise.all([
            prisma_js_1.prisma.payment.count({ where }),
            prisma_js_1.prisma.payment.findMany({
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
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to list payments' });
    }
}
// ============================================================================
// MODULE D: RECEIPTS
// ============================================================================
async function getReceipt(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        // Support lookup by either payment ID or receipt number
        const payment = await prisma_js_1.prisma.payment.findFirst({
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
            const studentUser = await prisma_js_1.prisma.student.findFirst({ where: { userId: req.user.userId } });
            if (!studentUser || studentUser.id !== payment.studentId) {
                return res.status(403).json({ success: false, error: 'Forbidden: You cannot view another student receipt' });
            }
        }
        else if (req.user?.role === 'PARENT') {
            const relation = await prisma_js_1.prisma.studentParentRelation.findFirst({
                where: { studentId: payment.studentId, parent: { userId: req.user.userId } },
            });
            if (!relation) {
                return res.status(403).json({ success: false, error: 'Forbidden: Student is not linked to parent profile' });
            }
        }
        // Financial breakdown up to this payment
        const assignment = payment.feeAssignment;
        const finalAmount = new client_1.Prisma.Decimal(assignment.finalAmount);
        let priorPaid = new client_1.Prisma.Decimal(0);
        for (const p of assignment.payments) {
            if (p.id === payment.id)
                break;
            priorPaid = priorPaid.plus(new client_1.Prisma.Decimal(p.amountPaid));
            for (const adj of p.adjustments) {
                if (adj.adjustmentType === 'REFUND') {
                    priorPaid = priorPaid.minus(new client_1.Prisma.Decimal(adj.amount));
                }
            }
        }
        const currentPaid = new client_1.Prisma.Decimal(payment.amountPaid);
        let currentRefunded = new client_1.Prisma.Decimal(0);
        for (const adj of payment.adjustments) {
            if (adj.adjustmentType === 'REFUND') {
                currentRefunded = currentRefunded.plus(new client_1.Prisma.Decimal(adj.amount));
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
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to generate receipt' });
    }
}
// ============================================================================
// MODULE E: REFUNDS, ADJUSTMENTS AND AUDIT TRAIL
// ============================================================================
async function processRefund(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params; // payment id
        const parse = exports.refundPaymentSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const { amount, reason } = parse.data;
        const refundAmountDecimal = new client_1.Prisma.Decimal(amount.toFixed(2));
        const result = await prisma_js_1.prisma.$transaction(async (tx) => {
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
            let existingRefundTotal = new client_1.Prisma.Decimal(0);
            for (const adj of payment.adjustments) {
                if (adj.adjustmentType === 'REFUND') {
                    existingRefundTotal = existingRefundTotal.plus(new client_1.Prisma.Decimal(adj.amount));
                }
            }
            const netPaidOnThisPayment = new client_1.Prisma.Decimal(payment.amountPaid).minus(existingRefundTotal);
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
                    authorizedById: req.user.userId,
                },
            });
            // Recalculate status of the fee assignment
            const assignment = payment.feeAssignment;
            const currentFinancials = calculateAssignmentFinancials(assignment);
            // Deduct this new refund
            const newNetPaid = new client_1.Prisma.Decimal(currentFinancials.netPaid).minus(refundAmountDecimal);
            const finalAmount = new client_1.Prisma.Decimal(assignment.finalAmount);
            const dueDate = new Date(assignment.dueDate);
            const now = new Date();
            let newStatus;
            if (newNetPaid.greaterThanOrEqualTo(finalAmount)) {
                newStatus = client_1.PaymentStatus.PAID;
            }
            else if (newNetPaid.greaterThan(0)) {
                newStatus = client_1.PaymentStatus.PARTIALLY_PAID;
            }
            else if (dueDate < now) {
                newStatus = client_1.PaymentStatus.OVERDUE;
            }
            else {
                newStatus = client_1.PaymentStatus.PENDING;
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
    }
    catch (err) {
        if (err.status) {
            return res.status(err.status).json({ success: false, error: err.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to process refund' });
    }
}
async function createFeeAdjustment(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params; // fee assignment id
        const parse = exports.adjustFeeSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const { adjustmentType, amount, reason } = parse.data;
        const adjustAmountDecimal = new client_1.Prisma.Decimal(amount.toFixed(2));
        const result = await prisma_js_1.prisma.$transaction(async (tx) => {
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
            let newDiscount = new client_1.Prisma.Decimal(assignment.discountAmount);
            let newFinalAmount = new client_1.Prisma.Decimal(assignment.finalAmount);
            if (adjustmentType === 'DISCOUNT' || adjustmentType === 'CONCESSION') {
                newDiscount = newDiscount.plus(adjustAmountDecimal);
                const base = new client_1.Prisma.Decimal(assignment.baseAmount);
                if (newDiscount.greaterThan(base)) {
                    throw { status: 400, message: 'Total discount cannot exceed base fee amount' };
                }
                newFinalAmount = base.minus(newDiscount);
            }
            else if (adjustmentType === 'CORRECTION') {
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
                    authorizedById: req.user.userId,
                },
            });
            // Recalculate status
            const financials = calculateAssignmentFinancials(assignment);
            const netPaid = new client_1.Prisma.Decimal(financials.netPaid);
            let newStatus;
            if (netPaid.greaterThanOrEqualTo(newFinalAmount)) {
                newStatus = client_1.PaymentStatus.PAID;
            }
            else if (netPaid.greaterThan(0)) {
                newStatus = client_1.PaymentStatus.PARTIALLY_PAID;
            }
            else if (new Date(assignment.dueDate) < new Date()) {
                newStatus = client_1.PaymentStatus.OVERDUE;
            }
            else {
                newStatus = client_1.PaymentStatus.PENDING;
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
    }
    catch (err) {
        if (err.status) {
            return res.status(err.status).json({ success: false, error: err.message });
        }
        return res.status(500).json({ success: false, error: 'Failed to record fee adjustment' });
    }
}
async function listAdjustments(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { adjustmentType, page = '1', limit = '50' } = req.query;
        const pageNum = Math.max(1, parseInt(String(page)) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(String(limit)) || 50));
        const skip = (pageNum - 1) * limitNum;
        const where = { instituteId };
        if (adjustmentType)
            where.adjustmentType = String(adjustmentType);
        const [total, adjustments] = await Promise.all([
            prisma_js_1.prisma.paymentAdjustment.count({ where }),
            prisma_js_1.prisma.paymentAdjustment.findMany({
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
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to list adjustments' });
    }
}
// ============================================================================
// MODULE F: FINANCIAL DASHBOARD & REPORTS
// ============================================================================
async function getFinancialSummary(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { academicYear, batchId } = req.query;
        const assignmentWhere = { student: { instituteId } };
        if (academicYear)
            assignmentWhere.academicYear = String(academicYear);
        if (batchId) {
            assignmentWhere.student = {
                ...assignmentWhere.student,
                enrollments: { some: { batchId: String(batchId), isActive: true } },
            };
        }
        const assignments = await prisma_js_1.prisma.studentFeeAssignment.findMany({
            where: assignmentWhere,
            include: {
                payments: { where: { status: 'SUCCESS' }, include: { adjustments: true } },
                adjustments: true,
            },
        });
        let totalAssigned = new client_1.Prisma.Decimal(0);
        let totalCollected = new client_1.Prisma.Decimal(0);
        let totalRefunds = new client_1.Prisma.Decimal(0);
        let totalOverdue = new client_1.Prisma.Decimal(0);
        let totalOutstanding = new client_1.Prisma.Decimal(0);
        let fullyPaidCount = 0;
        let partiallyPaidCount = 0;
        let pendingCount = 0;
        let overdueCount = 0;
        for (const a of assignments) {
            const financials = calculateAssignmentFinancials(a);
            totalAssigned = totalAssigned.plus(new client_1.Prisma.Decimal(a.finalAmount));
            totalCollected = totalCollected.plus(new client_1.Prisma.Decimal(financials.netPaid));
            totalRefunds = totalRefunds.plus(new client_1.Prisma.Decimal(financials.totalRefunds));
            totalOutstanding = totalOutstanding.plus(new client_1.Prisma.Decimal(financials.remainingBalance));
            if (financials.calculatedStatus === client_1.PaymentStatus.PAID) {
                fullyPaidCount++;
            }
            else if (financials.calculatedStatus === client_1.PaymentStatus.PARTIALLY_PAID) {
                partiallyPaidCount++;
            }
            else if (financials.calculatedStatus === client_1.PaymentStatus.OVERDUE) {
                overdueCount++;
                totalOverdue = totalOverdue.plus(new client_1.Prisma.Decimal(financials.remainingBalance));
            }
            else {
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
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to generate financial summary' });
    }
}
async function getCollectionsReport(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { startDate, endDate, method } = req.query;
        const where = { instituteId, status: 'SUCCESS' };
        if (method)
            where.method = String(method);
        if (startDate || endDate) {
            where.paidAt = {};
            if (startDate) {
                const s = new Date(String(startDate));
                if (isNaN(s.getTime()))
                    return res.status(400).json({ success: false, error: 'Invalid start date' });
                where.paidAt.gte = s;
            }
            if (endDate) {
                const e = new Date(String(endDate));
                if (isNaN(e.getTime()))
                    return res.status(400).json({ success: false, error: 'Invalid end date' });
                where.paidAt.lte = e;
            }
        }
        const payments = await prisma_js_1.prisma.payment.findMany({
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
        const methodBreakdown = {
            CASH: { count: 0, total: 0 },
            UPI: { count: 0, total: 0 },
            BANK_TRANSFER: { count: 0, total: 0 },
            CHEQUE: { count: 0, total: 0 },
            ONLINE: { count: 0, total: 0 },
        };
        let grandTotalCollected = new client_1.Prisma.Decimal(0);
        let grandTotalRefunded = new client_1.Prisma.Decimal(0);
        for (const p of payments) {
            const amount = new client_1.Prisma.Decimal(p.amountPaid);
            grandTotalCollected = grandTotalCollected.plus(amount);
            let pRefunded = new client_1.Prisma.Decimal(0);
            for (const adj of p.adjustments) {
                if (adj.adjustmentType === 'REFUND') {
                    pRefunded = pRefunded.plus(new client_1.Prisma.Decimal(adj.amount));
                }
            }
            grandTotalRefunded = grandTotalRefunded.plus(pRefunded);
            if (methodBreakdown[p.method]) {
                methodBreakdown[p.method].count += 1;
                methodBreakdown[p.method].total = Number((methodBreakdown[p.method].total + Number(amount.toFixed(2))).toFixed(2));
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
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to generate collections report' });
    }
}
async function getOutstandingReport(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { batchId, academicYear, isOverdueOnly } = req.query;
        const where = {
            student: { instituteId },
            status: { in: [client_1.PaymentStatus.PENDING, client_1.PaymentStatus.PARTIALLY_PAID, client_1.PaymentStatus.OVERDUE] },
        };
        if (academicYear)
            where.academicYear = String(academicYear);
        if (batchId) {
            where.student = {
                ...where.student,
                enrollments: { some: { batchId: String(batchId), isActive: true } },
            };
        }
        const assignments = await prisma_js_1.prisma.studentFeeAssignment.findMany({
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
        const result = [];
        let totalOutstandingAmount = new client_1.Prisma.Decimal(0);
        for (const a of assignments) {
            const financials = calculateAssignmentFinancials(a);
            if (financials.remainingBalance <= 0)
                continue;
            const isOverdue = new Date(a.dueDate) < now;
            if (isOverdueOnly === 'true' && !isOverdue)
                continue;
            totalOutstandingAmount = totalOutstandingAmount.plus(new client_1.Prisma.Decimal(financials.remainingBalance));
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
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to generate outstanding report' });
    }
}
// ============================================================================
// MODULE G: ONLINE PAYMENT WORKFLOW (RAZORPAY INTEGRATION)
// ============================================================================
exports.createOnlineOrderSchema = zod_1.z.object({
    studentId: zod_1.z.string().uuid('Valid student ID is required'),
    feeAssignmentId: zod_1.z.string().uuid('Valid fee assignment ID is required'),
    amount: zod_1.z.number().positive('Payment amount must be greater than zero'),
});
exports.verifyOnlinePaymentSchema = zod_1.z.object({
    orderId: zod_1.z.string().min(1, 'Order ID is required'),
    paymentId: zod_1.z.string().min(1, 'Payment ID is required'),
    signature: zod_1.z.string().min(1, 'Gateway signature is required'),
});
/**
 * Create a verified payment order on the server
 */
async function createOnlinePaymentOrder(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const parse = exports.createOnlineOrderSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const { studentId, feeAssignmentId, amount } = parse.data;
        // Strict student authorization check
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized for this student' });
        }
        // Verify fee assignment
        const assignment = await prisma_js_1.prisma.studentFeeAssignment.findFirst({
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
        const receipt = `rcpt_${Date.now().toString().slice(-8)}`;
        const orderResult = await razorpay_service_js_1.razorpayService.createOrder({
            amountInPaise: Math.round(amount * 100),
            currency: 'INR',
            receipt,
            notes: {
                studentId,
                feeAssignmentId,
                instituteId,
            },
        });
        const gatewayOrderId = orderResult.id;
        const currency = 'INR';
        // Record pending order
        const paymentOrder = await prisma_js_1.prisma.onlinePaymentOrder.create({
            data: {
                instituteId,
                studentId,
                feeAssignmentId,
                orderId: gatewayOrderId,
                amount: new client_1.Prisma.Decimal(amount),
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
                keyId: razorpay_service_js_1.razorpayService.getKeyId(),
                studentId,
                feeAssignmentId,
                studentName: `${assignment.student.firstName} ${assignment.student.lastName}`,
                feeName: assignment.feeStructure.name,
                termLabel: assignment.termLabel,
                isSimulated: orderResult.isSimulated,
            },
        });
    }
    catch (err) {
        console.error('[Create Online Payment Order Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to initiate payment order' });
    }
}
/**
 * Server-side signature verification & atomic payment recording
 */
async function verifyOnlinePayment(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const parse = exports.verifyOnlinePaymentSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const { orderId, paymentId, signature } = parse.data;
        // Retrieve pending order
        const order = await prisma_js_1.prisma.onlinePaymentOrder.findUnique({
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
        // Verify cryptographic signature (Rule C)
        const isSignatureValid = razorpay_service_js_1.razorpayService.verifySignature(orderId, paymentId, signature);
        if (!isSignatureValid) {
            await prisma_js_1.prisma.onlinePaymentOrder.update({
                where: { id: order.id },
                data: { status: 'FAILED', gatewayPaymentId: paymentId, gatewaySignature: signature },
            });
            return res.status(400).json({ success: false, error: 'Invalid payment signature verification failed' });
        }
        // Atomic credit transaction
        const receiptNumber = `REC-ONL-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
        const result = await prisma_js_1.prisma.$transaction(async (tx) => {
            // 1. Re-check anti-replay inside transaction
            const freshOrder = await tx.onlinePaymentOrder.findUnique({ where: { id: order.id } });
            if (freshOrder?.status === 'VERIFIED') {
                throw new Error('ORDER_ALREADY_VERIFIED');
            }
            // 2. Resolve Franchise and Snapshot applicable revenue sharing percentage (Rules 3-9)
            const institute = await tx.institute.findUnique({
                where: { id: instituteId },
                include: { franchise: true },
            });
            const franchiseId = institute?.franchiseId || null;
            const franchisePercentage = institute?.franchise?.revenueSharePercentage !== null && institute?.franchise?.revenueSharePercentage !== undefined
                ? Number(institute.franchise.revenueSharePercentage)
                : 50.00;
            // Calculate shares using integer paise
            const shares = revenue_engine_service_js_1.revenueEngineService.calculateShares(Number(order.amount), franchisePercentage);
            // 3. Create official Payment record with immutable percentage snapshots
            const payment = await tx.payment.create({
                data: {
                    instituteId,
                    studentId: order.studentId,
                    feeAssignmentId: order.feeAssignmentId,
                    franchiseId,
                    receiptNumber,
                    amountPaid: order.amount,
                    method: client_1.PaymentMethod.ONLINE,
                    transactionReference: paymentId,
                    gatewayPaymentId: paymentId,
                    gatewayOrderId: orderId,
                    gatewaySignature: signature,
                    idempotencyKey: `online_${orderId}_${paymentId}`,
                    status: 'SUCCESS',
                    recordedById: req.user.userId,
                    remarks: `Online Payment Gateway verified (Order: ${orderId})`,
                    franchisePercentage: new client_1.Prisma.Decimal(shares.franchisePercentage),
                    digitalGuruPercentage: new client_1.Prisma.Decimal(shares.digitalGuruPercentage),
                    franchiseShareAmount: new client_1.Prisma.Decimal(shares.franchiseShareAmount),
                    digitalGuruShareAmount: new client_1.Prisma.Decimal(shares.digitalGuruShareAmount),
                    feeDeduction: new client_1.Prisma.Decimal(shares.feeDeduction),
                    netEligibleAmount: new client_1.Prisma.Decimal(shares.netEligibleAmount),
                    transferStatus: 'PENDING',
                },
            });
            // 4. Recalculate and update fee assignment status
            const existingPayments = await tx.payment.findMany({
                where: { feeAssignmentId: order.feeAssignmentId, status: 'SUCCESS' },
            });
            const totalPaid = existingPayments.reduce((acc, p) => acc.plus(p.amountPaid), new client_1.Prisma.Decimal(0));
            const finalAmount = order.feeAssignment.finalAmount;
            const newStatus = totalPaid.greaterThanOrEqualTo(finalAmount)
                ? client_1.PaymentStatus.PAID
                : totalPaid.greaterThan(0)
                    ? client_1.PaymentStatus.PARTIALLY_PAID
                    : client_1.PaymentStatus.PENDING;
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
                    userId: req.user.userId,
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
                    userId: req.user.userId,
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
    }
    catch (err) {
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
async function handlePaymentWebhook(req, res) {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];
        if (webhookSecret && signature) {
            const bodyStr = JSON.stringify(req.body);
            const expectedSignature = crypto_1.default
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
    }
    catch (err) {
        console.error('[Payment Webhook Error]', err);
        return res.status(500).json({ success: false, error: 'Webhook processing error' });
    }
}
/**
 * Logged-in Student fee view (Section J)
 */
async function getStudentMyFees(req, res) {
    try {
        const userId = req.user.userId;
        const student = await prisma_js_1.prisma.student.findUnique({
            where: { userId },
            include: {
                institute: { select: { id: true, name: true, code: true } },
                feeAssignments: {
                    include: {
                        feeStructure: true,
                        payments: {
                            where: { status: 'SUCCESS' },
                            include: { adjustments: { where: { adjustmentType: 'REFUND' } } },
                            orderBy: { paidAt: 'desc' },
                        },
                        adjustments: true,
                    },
                    orderBy: { dueDate: 'asc' },
                },
            },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student profile not found for this account' });
        }
        // Calculate financials for each assignment
        const assignmentsWithFinancials = student.feeAssignments.map((assignment) => {
            const fin = calculateAssignmentFinancials(assignment);
            return {
                ...assignment,
                ...fin,
            };
        });
        const totalFees = assignmentsWithFinancials.reduce((acc, a) => acc + a.finalAmount, 0);
        const totalPaid = assignmentsWithFinancials.reduce((acc, a) => acc + a.netPaid, 0);
        const totalPending = assignmentsWithFinancials.reduce((acc, a) => acc + a.remainingBalance, 0);
        return res.json({
            success: true,
            data: {
                student: {
                    id: student.id,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    admissionNumber: student.admissionNumber,
                    branchName: student.institute?.name || 'Main Campus',
                    instituteId: student.instituteId,
                },
                summary: {
                    totalFees: Number(totalFees.toFixed(2)),
                    totalPaid: Number(totalPaid.toFixed(2)),
                    totalPending: Number(totalPending.toFixed(2)),
                },
                assignments: assignmentsWithFinancials,
            },
        });
    }
    catch (err) {
        console.error('[Get Student My Fees Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve fee records' });
    }
}
