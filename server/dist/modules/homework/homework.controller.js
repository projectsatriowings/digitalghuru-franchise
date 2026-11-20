"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gradeSubmissionSchema = exports.submitHomeworkSchema = exports.createHomeworkSchema = void 0;
exports.getCanonicalStudentHomeworkStatus = getCanonicalStudentHomeworkStatus;
exports.createHomework = createHomework;
exports.listHomework = listHomework;
exports.submitHomework = submitHomework;
exports.getSubmissions = getSubmissions;
exports.gradeSubmission = gradeSubmission;
exports.downloadSubmission = downloadSubmission;
const prisma_js_1 = require("../../prisma.js");
const zod_1 = require("zod");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const storage_js_1 = require("../../utils/storage.js");
const student_authorization_service_js_1 = require("../students/student-authorization.service.js");
const inapp_notification_service_js_1 = require("../notifications/inapp-notification.service.js");
/**
 * Canonical helper to derive student assignment status
 */
function getCanonicalStudentHomeworkStatus(dueDate, submission) {
    const isPastDue = dueDate ? new Date(dueDate) < new Date() : false;
    if (submission) {
        const isGraded = submission.status === 'GRADED' || Boolean(submission.grade);
        const isCompleted = submission.status === 'COMPLETED' || isGraded;
        if (isGraded) {
            return {
                studentStatus: 'GRADED',
                displayStatus: submission.grade ? `Graded (${submission.grade})` : 'Graded',
                isSubmitted: true,
                isGraded: true,
                isCompleted: true,
                isOverdue: false,
                isPending: false,
            };
        }
        if (submission.status === 'COMPLETED') {
            return {
                studentStatus: 'COMPLETED',
                displayStatus: 'Completed',
                isSubmitted: true,
                isGraded: false,
                isCompleted: true,
                isOverdue: false,
                isPending: false,
            };
        }
        return {
            studentStatus: 'AWAITING_REVIEW',
            displayStatus: 'Awaiting Review',
            isSubmitted: true,
            isGraded: false,
            isCompleted: false,
            isOverdue: false,
            isPending: false,
        };
    }
    if (isPastDue) {
        return {
            studentStatus: 'OVERDUE',
            displayStatus: 'Overdue',
            isSubmitted: false,
            isGraded: false,
            isCompleted: false,
            isOverdue: true,
            isPending: true,
        };
    }
    return {
        studentStatus: 'NOT_STARTED',
        displayStatus: 'Not Started',
        isSubmitted: false,
        isGraded: false,
        isCompleted: false,
        isOverdue: false,
        isPending: true,
    };
}
exports.createHomeworkSchema = zod_1.z.object({
    batchId: zod_1.z.string().uuid('Valid Batch ID required'),
    subjectId: zod_1.z.string().uuid('Valid Subject ID required').optional().nullable(),
    title: zod_1.z.string().min(2, 'Title must be at least 2 characters').max(150),
    description: zod_1.z.string().optional().nullable(),
    content: zod_1.z.string().optional().nullable(),
    dueDate: zod_1.z.string().min(1, 'Due date is required'), // ISO Date string
    maxMarks: zod_1.z.union([zod_1.z.number(), zod_1.z.string().transform((v) => (v ? parseFloat(v) : null))]).optional().nullable(),
    isPublished: zod_1.z.union([zod_1.z.boolean(), zod_1.z.string().transform((v) => v === 'true' || v === '1')]).optional().default(true),
});
exports.submitHomeworkSchema = zod_1.z.object({
    studentNotes: zod_1.z.string().optional().nullable(),
    content: zod_1.z.string().optional().nullable(),
    isCompleted: zod_1.z.union([zod_1.z.boolean(), zod_1.z.string().transform((v) => v === 'true' || v === '1')]).optional(),
    status: zod_1.z.string().optional(),
});
exports.gradeSubmissionSchema = zod_1.z.object({
    grade: zod_1.z.string().min(1, 'Grade is required').max(20),
    feedback: zod_1.z.string().optional().nullable(),
});
/**
 * Create a new homework assignment (Staff / Admin)
 */
async function createHomework(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId) {
            return res.status(400).json({ success: false, error: 'Institute context required' });
        }
        const parse = exports.createHomeworkSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const data = parse.data;
        const dueDate = new Date(data.dueDate);
        // Verify staff authorization
        if (req.user?.role === 'STAFF') {
            const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, data.batchId, prisma_js_1.prisma);
            if (!isAssigned) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
            }
            if (data.subjectId) {
                const isAssignedSub = await (0, student_authorization_service_js_1.isStaffAssignedToBatchSubject)(req, data.batchId, data.subjectId, prisma_js_1.prisma);
                if (!isAssignedSub) {
                    return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to assign homework for this subject' });
                }
            }
        }
        // Verify batch and subject belong to institute
        const batch = await prisma_js_1.prisma.batch.findFirst({ where: { id: data.batchId, instituteId } });
        if (!batch)
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        if (data.subjectId) {
            const subject = await prisma_js_1.prisma.subject.findFirst({ where: { id: data.subjectId, instituteId } });
            if (!subject)
                return res.status(404).json({ success: false, error: 'Subject not found in this institute' });
        }
        const file = req.file;
        let fileUrl = null;
        let fileName = null;
        let fileSize = null;
        let mimeType = null;
        if (file) {
            fileUrl = (0, storage_js_1.getRelativeStorageKey)(instituteId, file.filename);
            fileName = file.originalname;
            fileSize = file.size;
            mimeType = file.mimetype;
        }
        const isPublished = data.isPublished !== false;
        const content = data.content?.trim() || null;
        const homework = await prisma_js_1.prisma.learningMaterial.create({
            data: {
                instituteId,
                batchId: data.batchId,
                subjectId: data.subjectId || null,
                uploaderId: req.user.userId,
                title: data.title.trim(),
                description: data.description?.trim() || null,
                content,
                type: 'HOMEWORK',
                dueDate,
                isPublished,
                publishedAt: isPublished ? new Date() : null,
                maxMarks: data.maxMarks !== undefined && data.maxMarks !== null ? data.maxMarks : null,
                fileUrl,
                fileName,
                fileSize,
                mimeType,
            },
            include: {
                batch: { select: { id: true, name: true } },
                subject: { select: { id: true, name: true, code: true } },
                uploader: { select: { id: true, fullName: true, role: true } },
            },
        });
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId,
                userId: req.user.userId,
                action: 'CREATE_HOMEWORK',
                entityType: 'LearningMaterial',
                entityId: homework.id,
                newValues: {
                    title: homework.title,
                    dueDate: homework.dueDate,
                    batchId: homework.batchId,
                    subjectId: homework.subjectId,
                    isPublished: homework.isPublished,
                },
            },
        });
        return res.status(201).json({
            success: true,
            message: isPublished ? 'Homework assignment created and published successfully' : 'Homework assignment saved as draft',
            data: { homework },
        });
    }
    catch (err) {
        console.error('[Create Homework Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to create homework' });
    }
}
/**
 * List homework assignments with status calculation and completion metrics
 */
async function listHomework(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId) {
            return res.status(400).json({ success: false, error: 'Institute context required' });
        }
        const batchId = req.query.batchId;
        const subjectId = req.query.subjectId;
        const status = req.query.status; // 'PUBLISHED' | 'DRAFT' | 'ALL'
        const where = { instituteId, type: 'HOMEWORK' };
        if (batchId && batchId !== 'ALL')
            where.batchId = batchId;
        if (subjectId && subjectId !== 'ALL')
            where.subjectId = subjectId;
        let studentProfileId = null;
        if (req.user?.role === 'STAFF') {
            const staffAssignments = await (0, student_authorization_service_js_1.getAuthorizedStaffAssignments)(req, prisma_js_1.prisma);
            const allowedBatchIds = staffAssignments.authorizedBatchIds;
            if (allowedBatchIds.length === 0) {
                return res.json({ success: true, data: { homework: [] } });
            }
            if (where.batchId) {
                if (!allowedBatchIds.includes(where.batchId)) {
                    return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
                }
            }
            else {
                where.batchId = { in: allowedBatchIds };
            }
            if (status === 'DRAFT') {
                where.isPublished = false;
                where.uploaderId = req.user.userId;
            }
            else if (status === 'PUBLISHED') {
                where.isPublished = true;
            }
            else {
                where.AND = [
                    ...(where.AND || []),
                    {
                        OR: [
                            { isPublished: true },
                            { uploaderId: req.user.userId },
                        ],
                    },
                ];
            }
        }
        else if (req.user?.role === 'STUDENT') {
            where.isPublished = true;
            const student = await prisma_js_1.prisma.student.findFirst({
                where: { userId: req.user.userId, instituteId },
                include: { enrollments: { where: { isActive: true } } },
            });
            if (!student) {
                return res.json({ success: true, data: { homework: [] } });
            }
            studentProfileId = student.id;
            const batchIds = Array.from(new Set(student.enrollments.map((e) => e.batchId)));
            const subjectIds = Array.from(new Set(student.enrollments.map((e) => e.subjectId).filter(Boolean)));
            if (batchIds.length === 0) {
                return res.json({ success: true, data: { homework: [] } });
            }
            where.batchId = { in: batchIds };
            if (subjectIds.length > 0) {
                where.AND = [
                    ...(where.AND || []),
                    {
                        OR: [
                            { subjectId: null },
                            { subjectId: { in: subjectIds } },
                        ],
                    },
                ];
            }
        }
        else if (req.user?.role === 'PARENT') {
            where.isPublished = true;
            const children = await prisma_js_1.prisma.studentParentRelation.findMany({
                where: { parent: { userId: req.user.userId } },
                include: {
                    student: {
                        include: { enrollments: { where: { isActive: true } } },
                    },
                },
            });
            const batchIds = Array.from(new Set(children.flatMap((c) => c.student.enrollments.map((e) => e.batchId))));
            const subjectIds = Array.from(new Set(children.flatMap((c) => c.student.enrollments.map((e) => e.subjectId).filter(Boolean))));
            if (batchIds.length === 0) {
                return res.json({ success: true, data: { homework: [] } });
            }
            where.batchId = { in: batchIds };
            if (subjectIds.length > 0) {
                where.AND = [
                    ...(where.AND || []),
                    {
                        OR: [
                            { subjectId: null },
                            { subjectId: { in: subjectIds } },
                        ],
                    },
                ];
            }
        }
        else if (req.user?.role === 'ACADEMIC_ADMIN' || req.user?.role === 'SUPER_ADMIN') {
            if (status === 'PUBLISHED') {
                where.isPublished = true;
            }
            else if (status === 'DRAFT') {
                where.isPublished = false;
            }
        }
        const homeworkList = await prisma_js_1.prisma.learningMaterial.findMany({
            where,
            orderBy: { dueDate: 'asc' },
            include: {
                batch: {
                    select: {
                        id: true,
                        name: true,
                        _count: { select: { enrollments: { where: { isActive: true } } } },
                    },
                },
                subject: { select: { id: true, name: true, code: true } },
                uploader: { select: { id: true, fullName: true, role: true } },
                submissions: studentProfileId
                    ? {
                        where: { studentId: studentProfileId },
                        include: {
                            student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
                        },
                    }
                    : {
                        include: {
                            student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
                        },
                    },
            },
        });
        const now = new Date();
        const formatted = homeworkList.map((hw) => {
            // For student caller: find caller's specific submission
            let mySubmission = null;
            if (studentProfileId) {
                const found = hw.submissions.find((s) => s.studentId === studentProfileId);
                if (found) {
                    mySubmission = found;
                }
            }
            const canonical = getCanonicalStudentHomeworkStatus(hw.dueDate, mySubmission);
            // Summary metrics for staff / admin
            const isPastDue = hw.dueDate ? new Date(hw.dueDate) < now : false;
            const totalEligible = hw.batch?._count?.enrollments || 0;
            const submittedCount = hw.submissions.filter((s) => s.status === 'SUBMITTED' || s.status === 'LATE').length;
            const completedCount = hw.submissions.filter((s) => s.status === 'COMPLETED' || s.status === 'GRADED').length;
            const notStartedCount = Math.max(0, totalEligible - hw.submissions.length);
            const overdueCount = isPastDue ? notStartedCount : 0;
            return {
                ...hw,
                ...canonical,
                mySubmission,
                grade: mySubmission?.grade || null,
                feedback: mySubmission?.feedback || null,
                submittedAt: mySubmission?.submittedAt || null,
                summary: {
                    totalEligible,
                    submittedCount,
                    completedCount,
                    notStartedCount,
                    overdueCount,
                },
            };
        });
        return res.json({
            success: true,
            data: { homework: formatted },
        });
    }
    catch (err) {
        console.error('[List Homework Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to list homework' });
    }
}
/**
 * Submit homework assignment or mark completed (Student only)
 */
async function submitHomework(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id: materialId } = req.params;
        if (!req.user || req.user.role !== 'STUDENT') {
            return res.status(403).json({ success: false, error: 'Only enrolled students can submit assignments' });
        }
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { userId: req.user.userId, instituteId },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student profile not found' });
        }
        const material = await prisma_js_1.prisma.learningMaterial.findFirst({
            where: { id: materialId, instituteId, type: 'HOMEWORK' },
        });
        if (!material) {
            return res.status(404).json({ success: false, error: 'Homework assignment not found' });
        }
        // Verify active enrollment in batch
        const enrollment = await prisma_js_1.prisma.studentEnrollment.findFirst({
            where: { studentId: student.id, batchId: material.batchId, isActive: true },
        });
        if (!enrollment) {
            return res.status(403).json({ success: false, error: 'You are not enrolled in the batch for this assignment' });
        }
        const now = new Date();
        const isLate = material.dueDate ? now > new Date(material.dueDate) : false;
        const file = req.file;
        let fileUrl = null;
        let fileName = null;
        let fileSize = null;
        let mimeType = null;
        if (file) {
            fileUrl = (0, storage_js_1.getRelativeStorageKey)(instituteId, file.filename);
            fileName = file.originalname;
            fileSize = file.size;
            mimeType = file.mimetype;
        }
        // Accept either studentNotes or content from web/mobile
        const notes = req.body.studentNotes || req.body.content || null;
        const isCompletedFlag = req.body.isCompleted === true || req.body.isCompleted === 'true' || req.body.status === 'COMPLETED';
        // Determine target status
        let submissionStatus = 'SUBMITTED';
        if (isCompletedFlag && !fileUrl && !notes) {
            submissionStatus = 'COMPLETED';
        }
        else if (isLate) {
            submissionStatus = 'LATE';
        }
        else {
            submissionStatus = 'SUBMITTED';
        }
        const submission = await prisma_js_1.prisma.homeworkSubmission.upsert({
            where: {
                materialId_studentId: {
                    materialId,
                    studentId: student.id,
                },
            },
            update: {
                status: submissionStatus,
                submittedAt: now,
                isLate,
                studentNotes: notes,
                ...(fileUrl ? { fileUrl, fileName, fileSize, mimeType } : {}),
            },
            create: {
                materialId,
                studentId: student.id,
                status: submissionStatus,
                submittedAt: now,
                isLate,
                studentNotes: notes,
                fileUrl,
                fileName,
                fileSize,
                mimeType,
            },
            include: {
                material: { select: { id: true, title: true, dueDate: true } },
                student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
            },
        });
        // Notify faculty of new student submission
        inapp_notification_service_js_1.InAppNotificationService.notifyHomeworkSubmitted(submission.id).catch(() => { });
        return res.status(201).json({
            success: true,
            message: submissionStatus === 'COMPLETED'
                ? 'Assignment marked as completed'
                : isLate
                    ? 'Assignment submitted (marked Late)'
                    : 'Assignment submitted successfully',
            data: { submission },
        });
    }
    catch (err) {
        console.error('[Submit Homework Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to submit assignment' });
    }
}
/**
 * List all submissions & full eligible student roster for a homework (Staff / Admin)
 */
async function getSubmissions(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id: materialId } = req.params;
        const material = await prisma_js_1.prisma.learningMaterial.findFirst({
            where: { id: materialId, instituteId, type: 'HOMEWORK' },
            include: {
                batch: { select: { id: true, name: true } },
                subject: { select: { id: true, name: true, code: true } },
            },
        });
        if (!material) {
            return res.status(404).json({ success: false, error: 'Homework not found' });
        }
        // Authorization: Staff must be assigned to this batch
        if (req.user?.role === 'STAFF') {
            const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, material.batchId, prisma_js_1.prisma);
            if (!isAssigned && material.uploaderId !== req.user.userId) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
            }
        }
        // 1. Get all active enrolled students in this batch
        const enrollments = await prisma_js_1.prisma.studentEnrollment.findMany({
            where: {
                batchId: material.batchId,
                isActive: true,
                ...(material.subjectId ? { OR: [{ subjectId: null }, { subjectId: material.subjectId }] } : {}),
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
        // Deduplicate students
        const studentMap = new Map();
        for (const e of enrollments) {
            if (!studentMap.has(e.student.id)) {
                studentMap.set(e.student.id, e.student);
            }
        }
        const eligibleStudents = Array.from(studentMap.values());
        // 2. Get existing submissions for this homework
        const submissions = await prisma_js_1.prisma.homeworkSubmission.findMany({
            where: { materialId },
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
                gradedBy: { select: { id: true, fullName: true } },
            },
            orderBy: { submittedAt: 'desc' },
        });
        const submissionByStudentId = new Map();
        for (const sub of submissions) {
            submissionByStudentId.set(sub.studentId, sub);
        }
        const now = new Date();
        const isPastDue = material.dueDate ? new Date(material.dueDate) < now : false;
        // 3. Construct unified student completion roster
        const roster = eligibleStudents.map((st) => {
            const sub = submissionByStudentId.get(st.id);
            let submissionType = 'NONE';
            if (sub?.fileUrl) {
                submissionType = 'FILE_UPLOAD';
            }
            else if (sub?.studentNotes) {
                submissionType = 'TEXT_SUBMISSION';
            }
            else if (sub?.status === 'COMPLETED') {
                submissionType = 'SELF_MARKED';
            }
            let status = 'NOT_COMPLETED';
            const isOverdue = !sub ? isPastDue : (sub.isLate || false);
            if (sub) {
                if (sub.status === 'GRADED' || sub.gradedAt) {
                    status = 'GRADED';
                }
                else if (sub.status === 'COMPLETED') {
                    status = 'SELF_COMPLETED';
                }
                else if (sub.status === 'SUBMITTED' || sub.status === 'LATE') {
                    status = 'AWAITING_REVIEW';
                }
                else {
                    status = 'SUBMITTED';
                }
            }
            else if (isPastDue) {
                status = 'OVERDUE';
            }
            else {
                status = 'NOT_COMPLETED';
            }
            return {
                student: st,
                status,
                rawStatus: sub?.status || 'PENDING',
                submissionType,
                isSelfMarked: submissionType === 'SELF_MARKED',
                isOverdue,
                isSubmitted: !!sub,
                isGraded: !!sub?.gradedAt,
                isAwaitingReview: status === 'AWAITING_REVIEW',
                dueDate: material.dueDate,
                submittedAt: sub?.submittedAt || null,
                submission: sub || null,
            };
        });
        // 4. Calculate accurate database-derived counts
        const totalEligible = eligibleStudents.length;
        const completedCount = roster.filter((r) => r.status === 'GRADED' || r.status === 'SELF_COMPLETED').length;
        const submittedCount = roster.filter((r) => r.isSubmitted).length;
        const awaitingReviewCount = roster.filter((r) => r.isAwaitingReview).length;
        const gradedCount = roster.filter((r) => r.isGraded).length;
        const notCompletedCount = roster.filter((r) => !r.isSubmitted).length;
        const overdueCount = roster.filter((r) => !r.isSubmitted && r.isOverdue).length;
        // Optional query filtering for API consumer convenience
        let filteredRoster = roster;
        const filterStatus = (req.query.status || '').toUpperCase();
        if (filterStatus && filterStatus !== 'ALL') {
            if (filterStatus === 'COMPLETED') {
                filteredRoster = filteredRoster.filter((r) => r.status === 'GRADED' || r.status === 'SELF_COMPLETED');
            }
            else if (filterStatus === 'NOT_COMPLETED') {
                filteredRoster = filteredRoster.filter((r) => !r.isSubmitted);
            }
            else if (filterStatus === 'AWAITING_REVIEW') {
                filteredRoster = filteredRoster.filter((r) => r.isAwaitingReview);
            }
            else if (filterStatus === 'SUBMITTED') {
                filteredRoster = filteredRoster.filter((r) => r.isSubmitted);
            }
            else if (filterStatus === 'OVERDUE') {
                filteredRoster = filteredRoster.filter((r) => !r.isSubmitted && r.isOverdue);
            }
            else if (filterStatus === 'IN_PROGRESS') {
                filteredRoster = filteredRoster.filter((r) => r.status === 'SUBMITTED' || r.isAwaitingReview);
            }
        }
        const searchQuery = (req.query.search || '').trim().toLowerCase();
        if (searchQuery) {
            filteredRoster = filteredRoster.filter((r) => r.student.firstName.toLowerCase().includes(searchQuery) ||
                r.student.lastName.toLowerCase().includes(searchQuery) ||
                r.student.admissionNumber.toLowerCase().includes(searchQuery));
        }
        return res.json({
            success: true,
            data: {
                homework: material,
                summary: {
                    totalEligible,
                    completedCount,
                    submittedCount,
                    awaitingReviewCount,
                    gradedCount,
                    notCompletedCount,
                    overdueCount,
                },
                roster: filteredRoster,
                allRoster: roster,
                submissions,
            },
        });
    }
    catch (err) {
        console.error('[Get Submissions Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch submissions' });
    }
}
/**
 * Grade student submission (Staff / Admin)
 */
async function gradeSubmission(req, res) {
    try {
        const { submissionId } = req.params;
        const parse = exports.gradeSubmissionSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const submission = await prisma_js_1.prisma.homeworkSubmission.findUnique({
            where: { id: submissionId },
            include: { material: true },
        });
        if (!submission || submission.material.instituteId !== req.instituteId) {
            return res.status(404).json({ success: false, error: 'Submission not found' });
        }
        // Role check: Staff must be assigned to batch
        if (req.user?.role === 'STAFF') {
            const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, submission.material.batchId, prisma_js_1.prisma);
            if (!isAssigned && submission.material.uploaderId !== req.user.userId) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
            }
        }
        const updated = await prisma_js_1.prisma.homeworkSubmission.update({
            where: { id: submissionId },
            data: {
                grade: parse.data.grade.trim(),
                feedback: parse.data.feedback?.trim() || null,
                status: 'GRADED',
                gradedById: req.user.userId,
                gradedAt: new Date(),
            },
            include: {
                student: { select: { id: true, firstName: true, lastName: true } },
                gradedBy: { select: { id: true, fullName: true } },
            },
        });
        // Notify student & linked parents of graded homework
        inapp_notification_service_js_1.InAppNotificationService.notifyHomeworkGraded(updated.id).catch(() => { });
        return res.json({
            success: true,
            message: 'Submission graded successfully',
            data: { submission: updated },
        });
    }
    catch (err) {
        console.error('[Grade Submission Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to grade submission' });
    }
}
/**
 * Secure download of a student's submitted assignment file
 */
async function downloadSubmission(req, res) {
    try {
        const instituteId = req.instituteId || req.user?.instituteId;
        const { submissionId } = req.params;
        const submission = await prisma_js_1.prisma.homeworkSubmission.findUnique({
            where: { id: submissionId },
            include: {
                material: true,
                student: true,
            },
        });
        if (!submission || (instituteId && submission.material.instituteId !== instituteId)) {
            return res.status(404).json({ success: false, error: 'Submission not found' });
        }
        if (!submission.fileUrl) {
            return res.status(404).json({ success: false, error: 'No file was uploaded with this submission' });
        }
        // Authorization check
        if (req.user?.role === 'STUDENT') {
            if (submission.student.userId !== req.user.userId) {
                return res.status(403).json({ success: false, error: 'Forbidden: You cannot view another student\'s submission' });
            }
        }
        else if (req.user?.role === 'PARENT') {
            const isLinked = await prisma_js_1.prisma.studentParentRelation.findFirst({
                where: {
                    studentId: submission.studentId,
                    parent: { userId: req.user.userId },
                },
            });
            if (!isLinked) {
                return res.status(403).json({ success: false, error: 'Forbidden: You can only view your own child\'s submissions' });
            }
        }
        else if (req.user?.role === 'STAFF') {
            const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, submission.material.batchId, prisma_js_1.prisma);
            if (!isAssigned && submission.material.uploaderId !== req.user.userId) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
            }
        }
        const absPath = (0, storage_js_1.resolveAbsolutePath)(submission.fileUrl);
        if (!absPath || !fs_1.default.existsSync(absPath)) {
            return res.status(404).json({ success: false, error: 'Submission file not found on disk' });
        }
        const isDownload = req.query.download === 'true' || req.query.attachment === 'true';
        const dispositionType = isDownload ? 'attachment' : 'inline';
        const filename = submission.fileName || 'submission';
        res.setHeader('Content-Type', submission.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Accept-Ranges', 'bytes');
        return res.sendFile(path_1.default.resolve(absPath), {
            acceptRanges: true,
            maxAge: 0,
        });
    }
    catch (err) {
        console.error('[Download Submission Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to stream submission file' });
    }
}
