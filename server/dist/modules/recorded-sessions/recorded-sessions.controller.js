"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadSessionVideo = uploadSessionVideo;
exports.createRecordedSession = createRecordedSession;
exports.deleteRecordedSession = deleteRecordedSession;
exports.listRecordedSessions = listRecordedSessions;
const prisma_js_1 = require("../../prisma.js");
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const storage_js_1 = require("../../utils/storage.js");
async function uploadSessionVideo(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No video file provided for upload' });
        }
        const actualSavedFolder = req.file.destination
            ? path_1.default.basename(req.file.destination)
            : (req.file.path ? path_1.default.basename(path_1.default.dirname(req.file.path)) : 'recorded-sessions');
        const folder = actualSavedFolder.replace(/[^a-zA-Z0-9_-]/g, '') || 'recorded-sessions';
        const isPublic = (0, storage_js_1.isPublicCourseFolder)(folder);
        const scope = isPublic ? 'public' : 'protected';
        const fileUrl = `/api/courses/media/${scope}/${folder}/${req.file.filename}`;
        return res.status(201).json({
            success: true,
            data: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size,
                fileUrl,
                folder,
            },
        });
    }
    catch (error) {
        console.error('[Upload Session Video Error]', error);
        return res.status(500).json({ success: false, message: error.message || 'Upload failed' });
    }
}
async function createRecordedSession(req, res) {
    try {
        const { title, description, courseId, batchId, videoUrl, videoSource, duration, sessionDate } = req.body;
        if (!title || typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({ success: false, error: 'Session title is required' });
        }
        if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.trim()) {
            return res.status(400).json({ success: false, error: 'Valid video URL or uploaded file is required' });
        }
        let instituteId = req.instituteId;
        if (!instituteId || instituteId === 'ALL') {
            const staffProfile = await prisma_js_1.prisma.staffProfile.findFirst({
                where: { userId: req.user.userId },
                select: { instituteId: true },
            });
            instituteId = staffProfile?.instituteId || req.user.instituteId;
        }
        if (!instituteId) {
            return res.status(400).json({ success: false, error: 'Franchise institute context required' });
        }
        const newId = crypto_1.default.randomUUID();
        const cleanDuration = duration && duration.trim() ? duration.trim() : '45:00';
        const parsedDate = sessionDate ? new Date(sessionDate) : new Date();
        await prisma_js_1.prisma.$executeRawUnsafe(`INSERT INTO "RecordedSession" (
        "id", "instituteId", "courseId", "batchId", "trainerId", "title", "description",
        "videoUrl", "videoSource", "duration", "sessionDate", "isPublished", "createdAt", "updatedAt"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, NOW(), NOW())`, newId, instituteId, courseId || null, batchId || null, req.user.userId, title.trim(), description ? description.trim() : null, videoUrl.trim(), videoSource === 'SYSTEM_UPLOAD' ? 'SYSTEM_UPLOAD' : 'LINK', cleanDuration, parsedDate);
        return res.status(201).json({
            success: true,
            message: 'Recorded session successfully published',
            data: {
                id: newId,
                instituteId,
                courseId: courseId || null,
                batchId: batchId || null,
                trainerId: req.user.userId,
                title: title.trim(),
                description: description ? description.trim() : null,
                videoUrl: videoUrl.trim(),
                videoSource: videoSource === 'SYSTEM_UPLOAD' ? 'SYSTEM_UPLOAD' : 'LINK',
                duration: cleanDuration,
                sessionDate: parsedDate,
            },
        });
    }
    catch (error) {
        console.error('[Create Recorded Session Error]', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to create recorded session' });
    }
}
async function deleteRecordedSession(req, res) {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ success: false, error: 'Session ID is required' });
        }
        const isSuperAdmin = req.user?.role === 'SUPER_ADMIN';
        const isOwnerOrAdmin = ['FRANCHISE_OWNER', 'ACADEMIC_ADMIN', 'BRANCH_ADMIN'].includes(req.user?.role || '');
        if (isSuperAdmin) {
            await prisma_js_1.prisma.$executeRawUnsafe(`DELETE FROM "RecordedSession" WHERE "id" = $1`, id);
        }
        else if (isOwnerOrAdmin) {
            await prisma_js_1.prisma.$executeRawUnsafe(`DELETE FROM "RecordedSession" WHERE "id" = $1 AND "instituteId" = $2`, id, req.instituteId);
        }
        else {
            // Trainer can only delete sessions they uploaded
            await prisma_js_1.prisma.$executeRawUnsafe(`DELETE FROM "RecordedSession" WHERE "id" = $1 AND "trainerId" = $2`, id, req.user.userId);
        }
        return res.json({ success: true, message: 'Recorded session deleted successfully' });
    }
    catch (error) {
        console.error('[Delete Recorded Session Error]', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to delete recorded session' });
    }
}
async function listRecordedSessions(req, res) {
    try {
        const userRole = req.user?.role;
        const userId = req.user?.userId;
        let instituteId = req.instituteId;
        if (!instituteId || instituteId === 'ALL') {
            if (userRole === 'STAFF') {
                const staff = await prisma_js_1.prisma.staffProfile.findFirst({
                    where: { userId },
                    select: { instituteId: true },
                });
                if (staff)
                    instituteId = staff.instituteId;
            }
            else if (userRole === 'STUDENT') {
                const student = await prisma_js_1.prisma.student.findFirst({
                    where: { userId },
                    select: { instituteId: true },
                });
                if (student && student.instituteId)
                    instituteId = student.instituteId;
            }
        }
        // 1. Fetch rows from RecordedSession table
        let recordedRows = [];
        try {
            if (userRole === 'STUDENT') {
                const [courseEnrs, batchEnrs] = await Promise.all([
                    prisma_js_1.prisma.courseEnrollment.findMany({
                        where: { student: { userId } },
                        select: { batchId: true, courseId: true },
                    }),
                    prisma_js_1.prisma.studentEnrollment.findMany({
                        where: { student: { userId } },
                        select: { batchId: true },
                    }),
                ]);
                const enrolledBatchIds = Array.from(new Set([...courseEnrs.map((e) => e.batchId), ...batchEnrs.map((e) => e.batchId)].filter(Boolean)));
                const enrolledCourseIds = Array.from(new Set(courseEnrs.map((e) => e.courseId).filter(Boolean)));
                recordedRows = (await prisma_js_1.prisma.$queryRawUnsafe(`SELECT rs.*,
                  u."fullName" as "trainerName",
                  gc."title" as "courseTitle",
                  gc."thumbnailUrl" as "courseThumbnail",
                  b."name" as "batchName"
           FROM "RecordedSession" rs
           LEFT JOIN "User" u ON rs."trainerId" = u."id"
           LEFT JOIN "GlobalCourse" gc ON rs."courseId" = gc."id"
           LEFT JOIN "Batch" b ON rs."batchId" = b."id"
           WHERE rs."instituteId" = $1
             AND (rs."batchId" = ANY($2::text[]) OR rs."courseId" = ANY($3::text[]) OR (rs."batchId" IS NULL AND rs."courseId" IS NULL))
           ORDER BY rs."sessionDate" DESC, rs."createdAt" DESC`, instituteId || '', enrolledBatchIds, enrolledCourseIds));
            }
            else if (userRole === 'PARENT') {
                const parentRecord = await prisma_js_1.prisma.parentProfile.findFirst({
                    where: { userId },
                    include: {
                        studentRelations: {
                            include: {
                                student: {
                                    include: {
                                        courseEnrollments: true,
                                        enrollments: true,
                                    },
                                },
                            },
                        },
                    },
                });
                const allStudents = (parentRecord?.studentRelations || []).map((r) => r.student);
                const enrolledBatchIds = Array.from(new Set(allStudents.flatMap((st) => [
                    ...(st?.courseEnrollments || []).map((e) => e.batchId),
                    ...(st?.enrollments || []).map((e) => e.batchId),
                ]).filter(Boolean)));
                const enrolledCourseIds = Array.from(new Set(allStudents.flatMap((st) => (st?.courseEnrollments || []).map((e) => e.courseId)).filter(Boolean)));
                recordedRows = (await prisma_js_1.prisma.$queryRawUnsafe(`SELECT rs.*,
                  u."fullName" as "trainerName",
                  gc."title" as "courseTitle",
                  gc."thumbnailUrl" as "courseThumbnail",
                  b."name" as "batchName"
           FROM "RecordedSession" rs
           LEFT JOIN "User" u ON rs."trainerId" = u."id"
           LEFT JOIN "GlobalCourse" gc ON rs."courseId" = gc."id"
           LEFT JOIN "Batch" b ON rs."batchId" = b."id"
           WHERE rs."instituteId" = $1
             AND (rs."batchId" = ANY($2::text[]) OR rs."courseId" = ANY($3::text[]) OR (rs."batchId" IS NULL AND rs."courseId" IS NULL))
           ORDER BY rs."sessionDate" DESC, rs."createdAt" DESC`, instituteId || allStudents[0]?.instituteId || '', enrolledBatchIds, enrolledCourseIds));
            }
            else if (userRole === 'STAFF') {
                // Trainer / Staff sees all sessions for their institute, highlighting ones they uploaded
                recordedRows = (await prisma_js_1.prisma.$queryRawUnsafe(`SELECT rs.*,
                  u."fullName" as "trainerName",
                  gc."title" as "courseTitle",
                  gc."thumbnailUrl" as "courseThumbnail",
                  b."name" as "batchName"
           FROM "RecordedSession" rs
           LEFT JOIN "User" u ON rs."trainerId" = u."id"
           LEFT JOIN "GlobalCourse" gc ON rs."courseId" = gc."id"
           LEFT JOIN "Batch" b ON rs."batchId" = b."id"
           WHERE rs."instituteId" = $1 OR rs."trainerId" = $2
           ORDER BY rs."sessionDate" DESC, rs."createdAt" DESC`, instituteId || '', userId || ''));
            }
            else {
                // Admin / Franchise Owner / Super Admin
                if (instituteId && instituteId !== 'ALL') {
                    recordedRows = (await prisma_js_1.prisma.$queryRawUnsafe(`SELECT rs.*,
                    u."fullName" as "trainerName",
                    gc."title" as "courseTitle",
                    gc."thumbnailUrl" as "courseThumbnail",
                    b."name" as "batchName"
             FROM "RecordedSession" rs
             LEFT JOIN "User" u ON rs."trainerId" = u."id"
             LEFT JOIN "GlobalCourse" gc ON rs."courseId" = gc."id"
             LEFT JOIN "Batch" b ON rs."batchId" = b."id"
             WHERE rs."instituteId" = $1
             ORDER BY rs."sessionDate" DESC, rs."createdAt" DESC`, instituteId));
                }
                else {
                    recordedRows = (await prisma_js_1.prisma.$queryRawUnsafe(`SELECT rs.*,
                    u."fullName" as "trainerName",
                    gc."title" as "courseTitle",
                    gc."thumbnailUrl" as "courseThumbnail",
                    b."name" as "batchName"
             FROM "RecordedSession" rs
             LEFT JOIN "User" u ON rs."trainerId" = u."id"
             LEFT JOIN "GlobalCourse" gc ON rs."courseId" = gc."id"
             LEFT JOIN "Batch" b ON rs."batchId" = b."id"
             ORDER BY rs."sessionDate" DESC, rs."createdAt" DESC`));
                }
            }
        }
        catch (e) {
            console.warn('[RecordedSession DB Query Warning]', e.message);
            recordedRows = [];
        }
        // 2. Also format trainer recorded sessions into standard unified format
        const formattedSessions = recordedRows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            videoUrl: row.videoUrl,
            videoSource: row.videoSource || 'LINK',
            duration: row.duration || '45:00',
            sessionDate: row.sessionDate,
            courseId: row.courseId || null,
            courseTitle: row.courseTitle || 'Interactive Classroom Session',
            courseThumbnail: row.courseThumbnail || null,
            batchId: row.batchId || null,
            batchName: row.batchName || null,
            trainerId: row.trainerId,
            trainerName: row.trainerName || 'Trainer',
            isCurriculumLesson: false,
            canDelete: userRole === 'SUPER_ADMIN' || userRole === 'FRANCHISE_OWNER' || row.trainerId === userId,
        }));
        return res.json({
            success: true,
            data: formattedSessions,
        });
    }
    catch (error) {
        console.error('[List Recorded Sessions Error]', error);
        return res.status(500).json({ success: false, error: error.message || 'Failed to list recorded sessions' });
    }
}
