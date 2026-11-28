"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMaterialSchema = exports.createMaterialSchema = void 0;
exports.createMaterial = createMaterial;
exports.listMaterials = listMaterials;
exports.getMaterialById = getMaterialById;
exports.updateMaterial = updateMaterial;
exports.deleteMaterial = deleteMaterial;
exports.downloadMaterial = downloadMaterial;
exports.trackMaterialInteraction = trackMaterialInteraction;
exports.getMaterialInteractions = getMaterialInteractions;
const prisma_js_1 = require("../../prisma.js");
const zod_1 = require("zod");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const storage_js_1 = require("../../utils/storage.js");
const cache_js_1 = require("../../utils/cache.js");
const student_authorization_service_js_1 = require("../students/student-authorization.service.js");
exports.createMaterialSchema = zod_1.z.object({
    batchId: zod_1.z.string().uuid('Valid Batch ID required'),
    subjectId: zod_1.z.string().uuid('Valid Subject ID required').optional().nullable(),
    title: zod_1.z.string().min(2, 'Title must be at least 2 characters').max(150),
    description: zod_1.z.string().optional().nullable(),
    content: zod_1.z.string().optional().nullable(), // For text notes, study instructions, markdown
    type: zod_1.z.enum(['PDF', 'IMAGE', 'AUDIO', 'VOICE_NOTE', 'TEXT', 'DOCUMENT', 'HOMEWORK', 'ANNOUNCEMENT']),
    dueDate: zod_1.z.string().optional().nullable(), // ISO date for homework / assignments
    isPublished: zod_1.z.union([zod_1.z.boolean(), zod_1.z.string().transform((v) => v === 'true' || v === '1')]).optional().default(true),
    maxMarks: zod_1.z.union([zod_1.z.number(), zod_1.z.string().transform((v) => (v ? parseFloat(v) : null))]).optional().nullable(),
});
exports.updateMaterialSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(150).optional(),
    description: zod_1.z.string().optional().nullable(),
    content: zod_1.z.string().optional().nullable(),
    subjectId: zod_1.z.string().uuid().optional().nullable(),
    dueDate: zod_1.z.string().optional().nullable(),
    isPublished: zod_1.z.union([zod_1.z.boolean(), zod_1.z.string().transform((v) => v === 'true' || v === '1')]).optional(),
    maxMarks: zod_1.z.union([zod_1.z.number(), zod_1.z.string().transform((v) => (v ? parseFloat(v) : null))]).optional().nullable(),
});
/**
 * Upload and create new learning material (Staff / Admin)
 */
async function createMaterial(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId) {
            return res.status(400).json({ success: false, error: 'Institute context required' });
        }
        const parse = exports.createMaterialSchema.safeParse(req.body);
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
            const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, data.batchId, prisma_js_1.prisma);
            if (!isAssigned) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
            }
            if (data.subjectId) {
                const isAssignedSub = await (0, student_authorization_service_js_1.isStaffAssignedToBatchSubject)(req, data.batchId, data.subjectId, prisma_js_1.prisma);
                if (!isAssignedSub) {
                    return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to upload materials for this subject' });
                }
            }
        }
        // Verify batch belongs to institute
        const batch = await prisma_js_1.prisma.batch.findFirst({
            where: { id: data.batchId, instituteId },
        });
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        // Verify subject belongs to institute if provided
        if (data.subjectId) {
            const subject = await prisma_js_1.prisma.subject.findFirst({
                where: { id: data.subjectId, instituteId },
            });
            if (!subject) {
                return res.status(404).json({ success: false, error: 'Subject not found in this institute' });
            }
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
        const material = await prisma_js_1.prisma.learningMaterial.create({
            data: {
                instituteId,
                batchId: data.batchId,
                subjectId: data.subjectId || null,
                uploaderId: req.user.userId,
                title: data.title.trim(),
                description: data.description?.trim() || null,
                content,
                type: data.type,
                dueDate: data.dueDate ? new Date(data.dueDate) : null,
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
        // Record audit log
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId,
                userId: req.user.userId,
                action: 'CREATE_LEARNING_MATERIAL',
                entityType: 'LearningMaterial',
                entityId: material.id,
                newValues: {
                    title: material.title,
                    type: material.type,
                    batchId: material.batchId,
                    subjectId: material.subjectId,
                    isPublished: material.isPublished,
                },
            },
        });
        return res.status(201).json({
            success: true,
            message: isPublished ? 'Learning material published successfully' : 'Learning material saved as draft',
            data: { material },
        });
    }
    catch (err) {
        console.error('[Create Material Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to create learning material' });
    }
}
/**
 * List learning materials with scope enforcement
 */
async function listMaterials(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId) {
            return res.status(400).json({ success: false, error: 'Institute context required' });
        }
        const cacheKey = `mat:${instituteId}:${req.user?.userId || 'all'}:${req.query.batchId || ''}:${req.query.subjectId || ''}:${req.query.type || ''}:${req.query.search || ''}`;
        if (req.query.refresh !== 'true') {
            const cached = cache_js_1.serverCache.get(cacheKey);
            if (cached) {
                return res.json(cached);
            }
        }
        const batchId = req.query.batchId;
        const subjectId = req.query.subjectId;
        const type = req.query.type;
        const search = (req.query.search || '').trim();
        const status = req.query.status; // 'PUBLISHED' | 'DRAFT' | 'ALL'
        const where = { instituteId };
        if (type && type !== 'ALL') {
            where.type = type;
        }
        else {
            where.type = { not: 'HOMEWORK' };
        }
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
                        { description: { contains: search, mode: 'insensitive' } },
                        { content: { contains: search, mode: 'insensitive' } },
                    ],
                },
            ];
        }
        // Role-based scope isolation
        if (req.user?.role === 'STAFF') {
            const staffAssignments = await (0, student_authorization_service_js_1.getAuthorizedStaffAssignments)(req, prisma_js_1.prisma);
            const allowedBatchIds = staffAssignments.authorizedBatchIds;
            // Staff can see:
            // 1. Any materials they personally created (uploaderId: req.user.userId)
            // 2. OR materials in batches they are assigned to (batchId: { in: allowedBatchIds })
            const uploaderOrBatchCondition = allowedBatchIds.length > 0
                ? {
                    OR: [
                        { uploaderId: req.user.userId },
                        { batchId: { in: allowedBatchIds } },
                    ],
                }
                : { uploaderId: req.user.userId };
            if (where.batchId) {
                // If staff explicitly selected a batch: ensure they are assigned or uploaded to it
                if (!allowedBatchIds.includes(where.batchId)) {
                    const uploadedInBatchCount = await prisma_js_1.prisma.learningMaterial.count({
                        where: { batchId: where.batchId, uploaderId: req.user.userId, instituteId },
                    });
                    if (uploadedInBatchCount === 0) {
                        return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
                    }
                }
            }
            else {
                where.AND = [
                    ...(where.AND || []),
                    uploaderOrBatchCondition,
                ];
            }
            // Staff sees published materials for assigned batches, plus their own drafts
            if (status === 'DRAFT') {
                where.isPublished = false;
                where.uploaderId = req.user.userId;
            }
            else if (status === 'PUBLISHED') {
                where.isPublished = true;
            }
            else {
                // By default, staff sees published materials in their batches OR drafts they created
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
            // Students ONLY see published materials
            where.isPublished = true;
            // Find student's enrolled batches and allocated subjects
            const enrollments = await prisma_js_1.prisma.studentEnrollment.findMany({
                where: {
                    student: { userId: req.user.userId },
                    isActive: true,
                },
                select: { batchId: true, subjectId: true },
            });
            const allowedBatchIds = Array.from(new Set(enrollments.map((e) => e.batchId)));
            if (allowedBatchIds.length === 0) {
                return res.json({ success: true, data: { materials: [] } });
            }
            // Determine which batches have full batch-level enrollment (subjectId is null)
            const fullBatchEnrollmentIds = new Set(enrollments.filter((e) => !e.subjectId).map((e) => e.batchId));
            // Map of subject-specific enrollments for batches without full batch enrollment
            const specificSubjectsByBatch = new Map();
            for (const e of enrollments) {
                if (e.subjectId && !fullBatchEnrollmentIds.has(e.batchId)) {
                    const arr = specificSubjectsByBatch.get(e.batchId) || [];
                    arr.push(e.subjectId);
                    specificSubjectsByBatch.set(e.batchId, arr);
                }
            }
            if (where.batchId) {
                if (!allowedBatchIds.includes(where.batchId)) {
                    return res.status(403).json({ success: false, error: 'Forbidden: You are not enrolled in this batch' });
                }
                if (!fullBatchEnrollmentIds.has(where.batchId)) {
                    const allowedSubs = specificSubjectsByBatch.get(where.batchId) || [];
                    where.AND = [
                        ...(where.AND || []),
                        {
                            OR: [
                                { subjectId: null },
                                { subjectId: { in: allowedSubs } },
                            ],
                        },
                    ];
                }
            }
            else {
                const batchConditions = [];
                for (const bId of allowedBatchIds) {
                    if (fullBatchEnrollmentIds.has(bId)) {
                        batchConditions.push({ batchId: bId });
                    }
                    else {
                        const allowedSubs = specificSubjectsByBatch.get(bId) || [];
                        batchConditions.push({
                            batchId: bId,
                            OR: [
                                { subjectId: null },
                                { subjectId: { in: allowedSubs } },
                            ],
                        });
                    }
                }
                where.AND = [
                    ...(where.AND || []),
                    { OR: batchConditions },
                ];
            }
        }
        else if (req.user?.role === 'PARENT') {
            // Parents ONLY see published materials for their children
            where.isPublished = true;
            const enrollments = await prisma_js_1.prisma.studentEnrollment.findMany({
                where: {
                    student: {
                        parentRelations: {
                            some: { parent: { userId: req.user.userId } },
                        },
                    },
                    isActive: true,
                },
                select: { batchId: true, subjectId: true },
            });
            const allowedBatchIds = Array.from(new Set(enrollments.map((e) => e.batchId)));
            const allowedSubjectIds = Array.from(new Set(enrollments.map((e) => e.subjectId).filter(Boolean)));
            if (allowedBatchIds.length === 0) {
                return res.json({ success: true, data: { materials: [] } });
            }
            where.batchId = { in: allowedBatchIds };
            if (allowedSubjectIds.length > 0) {
                where.AND = [
                    ...(where.AND || []),
                    {
                        OR: [
                            { subjectId: null },
                            { subjectId: { in: allowedSubjectIds } },
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
        const materials = await prisma_js_1.prisma.learningMaterial.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                batch: { select: { id: true, name: true } },
                subject: { select: { id: true, name: true, code: true } },
                uploader: { select: { id: true, fullName: true, role: true } },
                _count: { select: { submissions: true, interactions: true } },
            },
        });
        const responsePayload = {
            success: true,
            data: { materials },
        };
        cache_js_1.serverCache.set(cacheKey, responsePayload, 20000);
        return res.json(responsePayload);
    }
    catch (err) {
        console.error('[List Materials Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch learning materials' });
    }
}
/**
 * Get learning material details by ID
 */
async function getMaterialById(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const material = await prisma_js_1.prisma.learningMaterial.findFirst({
            where: { id, instituteId },
            include: {
                batch: { select: { id: true, name: true } },
                subject: { select: { id: true, name: true, code: true } },
                uploader: { select: { id: true, fullName: true, role: true } },
                submissions: {
                    include: {
                        student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
                    },
                },
            },
        });
        if (!material) {
            return res.status(404).json({ success: false, error: 'Material not found in this institute' });
        }
        // Role-based visibility check
        if (req.user?.role === 'STUDENT') {
            if (!material.isPublished) {
                return res.status(403).json({ success: false, error: 'This material is currently in draft' });
            }
            const enrollment = await prisma_js_1.prisma.studentEnrollment.findFirst({
                where: {
                    batchId: material.batchId,
                    student: { userId: req.user.userId },
                    isActive: true,
                },
            });
            if (!enrollment) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not enrolled in this batch' });
            }
        }
        else if (req.user?.role === 'PARENT') {
            if (!material.isPublished) {
                return res.status(403).json({ success: false, error: 'This material is currently in draft' });
            }
            const enrollment = await prisma_js_1.prisma.studentEnrollment.findFirst({
                where: {
                    batchId: material.batchId,
                    student: {
                        parentRelations: {
                            some: { parent: { userId: req.user.userId } },
                        },
                    },
                    isActive: true,
                },
            });
            if (!enrollment) {
                return res.status(403).json({ success: false, error: 'Forbidden: You do not have an enrolled child in this batch' });
            }
        }
        else if (req.user?.role === 'STAFF') {
            const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, material.batchId, prisma_js_1.prisma);
            if (!isAssigned && material.uploaderId !== req.user.userId) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
            }
        }
        return res.json({
            success: true,
            data: { material },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to fetch material' });
    }
}
/**
 * Update learning material
 */
async function updateMaterial(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const parse = exports.updateMaterialSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: 'Validation failed', details: parse.error.errors });
        }
        const existing = await prisma_js_1.prisma.learningMaterial.findFirst({
            where: { id, instituteId },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Material not found' });
        }
        // Staff can only update their own material or assigned batch
        if (req.user?.role === 'STAFF') {
            const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, existing.batchId, prisma_js_1.prisma);
            if (!isAssigned && existing.uploaderId !== req.user.userId) {
                return res.status(403).json({ success: false, error: 'Forbidden: You cannot edit this material' });
            }
        }
        const data = parse.data;
        const isPublishingNow = !existing.isPublished && data.isPublished === true;
        const updated = await prisma_js_1.prisma.learningMaterial.update({
            where: { id },
            data: {
                ...(data.title ? { title: data.title.trim() } : {}),
                ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
                ...(data.content !== undefined ? { content: data.content?.trim() || null } : {}),
                ...(data.subjectId !== undefined ? { subjectId: data.subjectId || null } : {}),
                ...(data.dueDate ? { dueDate: new Date(data.dueDate) } : {}),
                ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
                ...(isPublishingNow ? { publishedAt: new Date() } : {}),
                ...(data.maxMarks !== undefined ? { maxMarks: data.maxMarks } : {}),
            },
            include: {
                batch: { select: { id: true, name: true } },
                subject: { select: { id: true, name: true, code: true } },
                uploader: { select: { id: true, fullName: true, role: true } },
            },
        });
        return res.json({
            success: true,
            message: 'Material updated successfully',
            data: { material: updated },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to update material' });
    }
}
/**
 * Delete learning material
 */
async function deleteMaterial(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const existing = await prisma_js_1.prisma.learningMaterial.findFirst({
            where: { id, instituteId },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Material not found' });
        }
        // Role check: Only uploader or Admin can delete
        if (req.user?.role === 'STAFF' && existing.uploaderId !== req.user.userId) {
            return res.status(403).json({ success: false, error: 'Forbidden: You can only delete materials you uploaded' });
        }
        // Clean up local file if stored
        if (existing.fileUrl) {
            const absPath = (0, storage_js_1.resolveAbsolutePath)(existing.fileUrl);
            if (absPath && fs_1.default.existsSync(absPath)) {
                try {
                    fs_1.default.unlinkSync(absPath);
                }
                catch (e) {
                    console.warn('[Storage Cleanup Warning]', e);
                }
            }
        }
        await prisma_js_1.prisma.learningMaterial.delete({
            where: { id },
        });
        return res.json({
            success: true,
            message: 'Material deleted successfully',
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to delete material' });
    }
}
/**
 * Authorized download or streaming of learning material file
 */
async function downloadMaterial(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const material = await prisma_js_1.prisma.learningMaterial.findUnique({
            where: { id },
        });
        if (!material || !material.fileUrl) {
            return res.status(404).json({ success: false, error: 'File attachment not found' });
        }
        const effectiveInstituteId = instituteId || req.user?.instituteId;
        if (effectiveInstituteId && material.instituteId !== effectiveInstituteId && req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Forbidden: Material does not belong to your institute' });
        }
        // Scope check: Student must be in enrolled batch and material must be published
        if (req.user?.role === 'STUDENT') {
            if (!material.isPublished) {
                return res.status(403).json({ success: false, error: 'Forbidden: Material is not published' });
            }
            const enrollment = await prisma_js_1.prisma.studentEnrollment.findFirst({
                where: {
                    batchId: material.batchId,
                    student: { userId: req.user.userId },
                    isActive: true,
                },
            });
            if (!enrollment) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not enrolled in this batch' });
            }
        }
        else if (req.user?.role === 'PARENT') {
            if (!material.isPublished) {
                return res.status(403).json({ success: false, error: 'Forbidden: Material is not published' });
            }
            const enrollment = await prisma_js_1.prisma.studentEnrollment.findFirst({
                where: {
                    batchId: material.batchId,
                    student: {
                        parentRelations: {
                            some: { parent: { userId: req.user.userId } },
                        },
                    },
                    isActive: true,
                },
            });
            if (!enrollment) {
                return res.status(403).json({ success: false, error: 'Forbidden: You do not have an enrolled child in this batch' });
            }
        }
        else if (req.user?.role === 'STAFF') {
            const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, material.batchId, prisma_js_1.prisma);
            if (!isAssigned && material.uploaderId !== req.user.userId) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
            }
        }
        const absPath = (0, storage_js_1.resolveAbsolutePath)(material.fileUrl);
        if (!absPath || !fs_1.default.existsSync(absPath)) {
            return res.status(404).json({ success: false, error: 'Attachment file not found on server' });
        }
        const isDownload = req.query.download === 'true' || req.query.attachment === 'true';
        const dispositionType = isDownload ? 'attachment' : 'inline';
        const filename = material.fileName || 'material';
        res.setHeader('Content-Type', material.mimeType || 'application/pdf');
        res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Accept-Ranges', 'bytes');
        return res.sendFile(path_1.default.resolve(absPath), {
            acceptRanges: true,
            maxAge: 0,
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to stream file' });
    }
}
/**
 * Track student interaction with learning material (Modal Open, Audio Progress, Audio Completion)
 * Preserves requirement: Opening preview does NOT mark audio completion.
 */
async function trackMaterialInteraction(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id: materialId } = req.params;
        const { eventType, progressPercent, durationSeconds, lastPositionSec } = req.body;
        if (!eventType) {
            return res.status(400).json({ success: false, error: 'eventType is required (OPENED, AUDIO_PLAYING, AUDIO_COMPLETED, DOWNLOADED)' });
        }
        const material = await prisma_js_1.prisma.learningMaterial.findUnique({
            where: { id: materialId },
        });
        if (!material) {
            return res.status(404).json({ success: false, error: 'Material not found' });
        }
        // Identify student
        let studentId = null;
        if (req.user?.role === 'STUDENT') {
            const student = await prisma_js_1.prisma.student.findFirst({
                where: { userId: req.user.userId },
            });
            if (!student) {
                return res.status(403).json({ success: false, error: 'Student profile not found' });
            }
            studentId = student.id;
        }
        else if (req.body.studentId) {
            studentId = req.body.studentId;
        }
        if (!studentId) {
            // For staff previewing, just acknowledge success
            return res.json({ success: true, message: 'Interaction acknowledged for staff/preview' });
        }
        // Guard: Prevent audio tracking telemetry on non-audio materials (e.g. PDF, Image)
        const isAudioMaterial = material.type === 'VOICE_NOTE';
        if ((eventType === 'AUDIO_PLAYING' || eventType === 'AUDIO_COMPLETED') && !isAudioMaterial) {
            return res.status(400).json({
                success: false,
                error: `Cannot record audio playback telemetry for non-audio material (material type is '${material.type}')`,
            });
        }
        // Determine completion state
        let isCompleted = false;
        let validInteractionType = eventType;
        if (eventType === 'AUDIO_COMPLETED') {
            isCompleted = true;
            validInteractionType = 'AUDIO_COMPLETED';
        }
        else if (eventType === 'OPENED') {
            // For non-audio materials, viewing/opening marks completed
            isCompleted = !isAudioMaterial;
            validInteractionType = 'OPENED';
        }
        else if (eventType === 'AUDIO_PLAYING') {
            isCompleted = (progressPercent || 0) >= 95;
            validInteractionType = 'AUDIO_PLAYING';
        }
        const interaction = await prisma_js_1.prisma.materialInteraction.upsert({
            where: {
                materialId_studentId_interactionType: {
                    materialId,
                    studentId,
                    interactionType: validInteractionType,
                },
            },
            update: {
                progressPercent: progressPercent !== undefined ? Number(progressPercent) : undefined,
                durationSeconds: durationSeconds !== undefined ? Number(durationSeconds) : undefined,
                lastPositionSec: lastPositionSec !== undefined ? Number(lastPositionSec) : undefined,
                isCompleted: isCompleted,
            },
            create: {
                materialId,
                studentId,
                interactionType: validInteractionType,
                progressPercent: progressPercent !== undefined ? Number(progressPercent) : null,
                durationSeconds: durationSeconds !== undefined ? Number(durationSeconds) : null,
                lastPositionSec: lastPositionSec !== undefined ? Number(lastPositionSec) : null,
                isCompleted: isCompleted,
            },
        });
        return res.json({
            success: true,
            message: 'Interaction recorded successfully',
            data: { interaction },
        });
    }
    catch (err) {
        console.error('[Track Material Interaction Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to record interaction' });
    }
}
/**
 * Get student interactions for a material (Staff / Admin / Student)
 */
async function getMaterialInteractions(req, res) {
    try {
        const { id: materialId } = req.params;
        const material = await prisma_js_1.prisma.learningMaterial.findUnique({ where: { id: materialId } });
        if (!material)
            return res.status(404).json({ success: false, error: 'Material not found' });
        let where = { materialId };
        if (req.user?.role === 'STUDENT') {
            const student = await prisma_js_1.prisma.student.findFirst({ where: { userId: req.user.userId } });
            if (student)
                where.studentId = student.id;
        }
        const interactions = await prisma_js_1.prisma.materialInteraction.findMany({
            where,
            include: {
                student: {
                    select: { id: true, firstName: true, lastName: true, admissionNumber: true },
                },
            },
            orderBy: { updatedAt: 'desc' },
        });
        return res.json({
            success: true,
            data: { interactions },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to fetch interactions' });
    }
}
