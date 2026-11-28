"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrollStudentSchema = exports.assignStaffSchema = exports.assignSubjectsSchema = exports.updateSubjectSchema = exports.createSubjectSchema = exports.updateBatchSchema = exports.createBatchSchema = void 0;
exports.listBatches = listBatches;
exports.getBatchDetails = getBatchDetails;
exports.createBatch = createBatch;
exports.updateBatch = updateBatch;
exports.toggleBatchStatus = toggleBatchStatus;
exports.deleteBatch = deleteBatch;
exports.assignSubjectsToBatch = assignSubjectsToBatch;
exports.updateBatchSubject = updateBatchSubject;
exports.allocateStudentSubjects = allocateStudentSubjects;
exports.getStudentSubjectAllocations = getStudentSubjectAllocations;
exports.removeSubjectFromBatch = removeSubjectFromBatch;
exports.assignStaffToBatch = assignStaffToBatch;
exports.removeStaffFromBatch = removeStaffFromBatch;
exports.enrollStudentInBatch = enrollStudentInBatch;
exports.unenrollStudentFromBatch = unenrollStudentFromBatch;
exports.listInstituteStaff = listInstituteStaff;
exports.listSubjects = listSubjects;
exports.createSubject = createSubject;
exports.updateSubject = updateSubject;
exports.deleteSubject = deleteSubject;
const prisma_js_1 = require("../../prisma.js");
const zod_1 = require("zod");
const cache_js_1 = require("../../utils/cache.js");
const student_authorization_service_js_1 = require("../students/student-authorization.service.js");
exports.createBatchSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Batch name is required'),
    code: zod_1.z.string().trim().optional().nullable().or(zod_1.z.literal('')),
    academicYear: zod_1.z.string().min(4, 'Academic year is required'), // e.g., "2026-2027"
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    schedule: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
    courseId: zod_1.z.string().uuid().optional().nullable().or(zod_1.z.literal('')),
    staffProfileId: zod_1.z.string().uuid().optional(),
    staffProfileIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
});
exports.updateBatchSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Batch name is required').optional(),
    code: zod_1.z.string().trim().optional().nullable().or(zod_1.z.literal('')),
    academicYear: zod_1.z.string().min(4, 'Academic year is required').optional(),
    startDate: zod_1.z.string().optional(),
    endDate: zod_1.z.string().nullable().optional(),
    description: zod_1.z.string().nullable().optional(),
    schedule: zod_1.z.string().nullable().optional(),
    isActive: zod_1.z.boolean().optional(),
    courseId: zod_1.z.string().uuid().optional().nullable().or(zod_1.z.literal('')),
});
exports.createSubjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Subject name is required'),
    code: zod_1.z.string().trim().optional().nullable().or(zod_1.z.literal('')),
    description: zod_1.z.string().optional(),
});
exports.updateSubjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Subject name is required').optional(),
    code: zod_1.z.string().trim().optional().nullable().or(zod_1.z.literal('')),
    description: zod_1.z.string().optional(),
});
exports.assignSubjectsSchema = zod_1.z.object({
    subjectIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    subjectId: zod_1.z.string().uuid().optional(),
    name: zod_1.z.string().min(2).optional(),
    code: zod_1.z.string().trim().optional().nullable().or(zod_1.z.literal('')),
    description: zod_1.z.string().optional(),
    staffProfileId: zod_1.z.string().uuid().optional(),
    schedule: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
exports.assignStaffSchema = zod_1.z.object({
    staffProfileIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    staffProfileId: zod_1.z.string().uuid().optional(),
});
exports.enrollStudentSchema = zod_1.z.object({
    studentId: zod_1.z.string().uuid('Valid student ID required'),
    subjectId: zod_1.z.string().uuid().optional(),
});
// List Batches
async function listBatches(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const cacheKey = `batches:${instituteId}:${req.user?.userId || 'all'}`;
        if (req.query.refresh !== 'true') {
            const cached = cache_js_1.serverCache.get(cacheKey);
            if (cached) {
                return res.json(cached);
            }
        }
        const isStaff = req.user?.role === 'STAFF';
        let batchWhere = { instituteId };
        let authorizedSubjectIds = null;
        let staffProfileId = null;
        let assignments = null;
        if (isStaff) {
            assignments = await (0, student_authorization_service_js_1.getAuthorizedStaffAssignments)(req, prisma_js_1.prisma);
            if (assignments.authorizedBatchIds.length === 0) {
                return res.json({ success: true, data: { batches: [] } });
            }
            batchWhere = {
                instituteId,
                id: { in: assignments.authorizedBatchIds },
                isActive: true,
            };
            authorizedSubjectIds = assignments.allAuthorizedSubjectIds;
            staffProfileId = assignments.staffProfileId || null;
        }
        const batches = await prisma_js_1.prisma.batch.findMany({
            where: batchWhere,
            orderBy: { createdAt: 'desc' },
            include: {
                course: {
                    select: {
                        id: true,
                        title: true,
                        slug: true,
                        thumbnailUrl: true,
                        format: true,
                    },
                },
                staffAssignments: {
                    include: {
                        staffProfile: {
                            include: {
                                user: { select: { fullName: true, email: true, phone: true } },
                            },
                        },
                    },
                },
                batchSubjects: {
                    select: {
                        id: true,
                        batchId: true,
                        subjectId: true,
                        staffProfileId: true,
                        subject: {
                            select: { id: true, name: true, code: true },
                        },
                    },
                },
                _count: {
                    select: {
                        enrollments: true,
                        staffAssignments: true,
                        batchSubjects: true,
                    },
                },
            },
        });
        // If caller is STAFF, filter each batch's batchSubjects to those assigned to this staff member.
        // If staff is assigned to the whole batch with no specific subject restriction, include all subjects in that batch.
        const filteredBatches = isStaff
            ? batches.map((b) => {
                const assignedSubIds = assignments?.subjectIdsByBatch?.[b.id] || [];
                const staffSubjects = assignedSubIds.length === 0
                    ? b.batchSubjects
                    : b.batchSubjects.filter((bs) => (staffProfileId && bs.staffProfileId === staffProfileId) ||
                        assignedSubIds.includes(bs.subjectId));
                return {
                    ...b,
                    batchSubjects: staffSubjects,
                };
            })
            : batches;
        const responsePayload = { success: true, data: { batches: filteredBatches } };
        cache_js_1.serverCache.set(cacheKey, responsePayload, 30000);
        return res.json(responsePayload);
    }
    catch (err) {
        console.error('[listBatches error]', err);
        return res.status(500).json({ success: false, error: 'Failed to list batches' });
    }
}
// Get Batch Details (Roster, Curriculum, Staff, Allocations)
async function getBatchDetails(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id } = req.params;
        // If caller is STAFF, verify staff assignment to this batch
        if (req.user?.role === 'STAFF') {
            const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, id, prisma_js_1.prisma);
            if (!isAssigned) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not assigned to this batch' });
            }
        }
        let batch = await prisma_js_1.prisma.batch.findFirst({
            where: { id, instituteId },
            include: {
                course: true,
                batchSubjects: {
                    include: {
                        subject: true,
                        staffProfile: {
                            include: {
                                user: {
                                    select: { id: true, fullName: true, email: true, phone: true },
                                },
                            },
                        },
                    },
                },
                staffAssignments: {
                    include: {
                        staffProfile: {
                            include: {
                                user: {
                                    select: { id: true, fullName: true, email: true, phone: true },
                                },
                            },
                        },
                    },
                },
                enrollments: {
                    where: { isActive: true },
                    include: {
                        student: {
                            select: {
                                id: true,
                                admissionNumber: true,
                                firstName: true,
                                lastName: true,
                                phone: true,
                                status: true,
                                photoUrl: true,
                            },
                        },
                        subject: {
                            select: { id: true, name: true, code: true },
                        },
                    },
                    orderBy: { enrolledAt: 'desc' },
                },
            },
        });
        if (!batch && req.user?.role === 'STAFF') {
            batch = await prisma_js_1.prisma.batch.findUnique({
                where: { id },
                include: {
                    course: true,
                    batchSubjects: {
                        include: {
                            subject: true,
                            staffProfile: {
                                include: {
                                    user: {
                                        select: { id: true, fullName: true, email: true, phone: true },
                                    },
                                },
                            },
                        },
                    },
                    staffAssignments: {
                        include: {
                            staffProfile: {
                                include: {
                                    user: {
                                        select: { id: true, fullName: true, email: true, phone: true },
                                    },
                                },
                            },
                        },
                    },
                    enrollments: {
                        where: { isActive: true },
                        include: {
                            student: {
                                select: {
                                    id: true,
                                    admissionNumber: true,
                                    firstName: true,
                                    lastName: true,
                                    phone: true,
                                    status: true,
                                    photoUrl: true,
                                },
                            },
                            subject: {
                                select: { id: true, name: true, code: true },
                            },
                        },
                        orderBy: { enrolledAt: 'desc' },
                    },
                },
            });
        }
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        let filteredEnrollments = batch.enrollments;
        let filteredBatchSubjects = batch.batchSubjects;
        if (req.user?.role === 'STAFF') {
            const staffSubjects = await prisma_js_1.prisma.batchSubject.findMany({
                where: {
                    batchId: id,
                    staffProfile: { userId: req.user.userId },
                },
                select: { subjectId: true },
            });
            const staffSubjectIds = new Set(staffSubjects.map((s) => s.subjectId));
            if (staffSubjectIds.size > 0) {
                // Staff only sees students enrolled in their assigned subjects
                filteredBatchSubjects = batch.batchSubjects.filter((bs) => staffSubjectIds.has(bs.subjectId));
                const authorizedStudentIds = new Set(batch.enrollments
                    .filter((e) => e.subjectId && staffSubjectIds.has(e.subjectId) && e.student)
                    .map((e) => e.student.id));
                filteredEnrollments = batch.enrollments.filter((e) => e.student && authorizedStudentIds.has(e.student.id));
            }
        }
        // Build consolidated enrolled students map with their allocated subjects
        const enrolledStudentsMap = new Map();
        for (const enr of filteredEnrollments) {
            if (!enr.student)
                continue;
            if (!enrolledStudentsMap.has(enr.student.id)) {
                enrolledStudentsMap.set(enr.student.id, {
                    ...enr.student,
                    photoUrl: (enr.student.photoUrl && !enr.student.photoUrl.startsWith('http') && !enr.student.photoUrl.startsWith('/api')) ? `/api/students/${enr.student.id}/photo` : enr.student.photoUrl,
                    enrolledAt: enr.enrolledAt,
                    allocatedSubjects: [],
                });
            }
            if (enr.subject) {
                enrolledStudentsMap.get(enr.student.id).allocatedSubjects.push(enr.subject);
            }
        }
        const enrolledStudents = Array.from(enrolledStudentsMap.values());
        return res.json({
            success: true,
            data: {
                batch: {
                    ...batch,
                    batchSubjects: filteredBatchSubjects,
                    enrolledStudents,
                    studentAllocations: enrolledStudents,
                },
            },
        });
    }
    catch (err) {
        console.error('[getBatchDetails error]', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch batch details' });
    }
}
// Create Batch
async function createBatch(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const parse = exports.createBatchSchema.safeParse(req.body);
        if (!parse.success)
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });
        const { name, code, academicYear, startDate, endDate, description, schedule, isActive, staffProfileId, staffProfileIds, courseId } = parse.data;
        // Check unique name + academicYear
        const existing = await prisma_js_1.prisma.batch.findUnique({
            where: {
                instituteId_name_academicYear: {
                    instituteId,
                    name: name.trim(),
                    academicYear: academicYear.trim(),
                },
            },
        });
        if (existing) {
            return res.status(409).json({ success: false, error: `Batch '${name}' (${academicYear}) already exists in this institute` });
        }
        // Check unique code within institute if provided
        if (code && code.trim()) {
            const codeCollision = await prisma_js_1.prisma.batch.findFirst({
                where: { instituteId, code: code.trim() },
            });
            if (codeCollision) {
                return res.status(409).json({ success: false, error: `Batch code '${code.trim()}' is already in use in this institute` });
            }
        }
        const batch = await prisma_js_1.prisma.batch.create({
            data: {
                instituteId,
                courseId: courseId?.trim() || null,
                name: name.trim(),
                code: code?.trim() || null,
                academicYear: academicYear.trim(),
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: endDate ? new Date(endDate) : null,
                description: description?.trim() || null,
                schedule: schedule?.trim() || null,
                isActive: typeof isActive === 'boolean' ? isActive : true,
            },
        });
        // Collect all initial staff profiles to assign to this batch
        const targetStaffIds = new Set();
        if (Array.isArray(staffProfileIds)) {
            staffProfileIds.filter(Boolean).forEach((id) => targetStaffIds.add(id));
        }
        if (staffProfileId) {
            targetStaffIds.add(staffProfileId);
        }
        if (targetStaffIds.size === 0 && req.user?.role === 'STAFF') {
            const callerStaff = await prisma_js_1.prisma.staffProfile.findFirst({
                where: { userId: req.user.userId, instituteId },
            });
            if (callerStaff) {
                targetStaffIds.add(callerStaff.id);
            }
        }
        if (targetStaffIds.size > 0) {
            const validStaff = await prisma_js_1.prisma.staffProfile.findMany({
                where: {
                    id: { in: Array.from(targetStaffIds) },
                    instituteId,
                },
                select: { id: true },
            });
            for (const st of validStaff) {
                await prisma_js_1.prisma.staffBatchAssignment.upsert({
                    where: {
                        staffProfileId_batchId: {
                            staffProfileId: st.id,
                            batchId: batch.id,
                        },
                    },
                    create: {
                        staffProfileId: st.id,
                        batchId: batch.id,
                    },
                    update: {},
                }).catch((err) => console.warn('[createBatch staff assignment warn]', err.message));
            }
        }
        // Auto-create or link subject for the course if courseId provided
        if (courseId) {
            const globalCourse = await prisma_js_1.prisma.globalCourse.findUnique({
                where: { id: courseId.trim() },
                select: { id: true, title: true },
            });
            if (globalCourse) {
                let subj = await prisma_js_1.prisma.subject.findFirst({
                    where: { instituteId, name: globalCourse.title },
                });
                if (!subj) {
                    subj = await prisma_js_1.prisma.subject.create({
                        data: {
                            instituteId,
                            name: globalCourse.title,
                            code: code?.trim() || null,
                            description: `Course curriculum for ${globalCourse.title}`,
                        },
                    });
                }
                const primaryTrainerId = staffProfileId || (staffProfileIds && staffProfileIds[0]) || (targetStaffIds.size > 0 ? Array.from(targetStaffIds)[0] : null);
                await prisma_js_1.prisma.batchSubject.create({
                    data: {
                        batchId: batch.id,
                        subjectId: subj.id,
                        staffProfileId: primaryTrainerId,
                        schedule: schedule?.trim() || null,
                        isActive: true,
                    },
                }).catch((err) => console.warn('[createBatch batchSubject warn]', err.message));
            }
        }
        cache_js_1.serverCache.invalidate();
        return res.status(201).json({ success: true, message: 'Batch created successfully', data: { batch } });
    }
    catch (err) {
        console.error('[createBatch error]', err);
        return res.status(500).json({ success: false, error: 'Failed to create batch' });
    }
}
// Update Batch
async function updateBatch(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id } = req.params;
        const parse = exports.updateBatchSchema.safeParse(req.body);
        if (!parse.success)
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });
        const existing = await prisma_js_1.prisma.batch.findFirst({
            where: { id, instituteId },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        const { name, code, academicYear, startDate, endDate, description, schedule, isActive, courseId } = parse.data;
        // Check collision if name or academicYear changed
        if ((name && name.trim() !== existing.name) || (academicYear && academicYear.trim() !== existing.academicYear)) {
            const checkName = name ? name.trim() : existing.name;
            const checkYear = academicYear ? academicYear.trim() : existing.academicYear;
            const collision = await prisma_js_1.prisma.batch.findFirst({
                where: {
                    instituteId,
                    name: checkName,
                    academicYear: checkYear,
                    id: { not: id },
                },
            });
            if (collision) {
                return res.status(409).json({ success: false, error: `Batch '${checkName}' (${checkYear}) already exists` });
            }
        }
        // Check code collision
        if (code && code.trim() !== existing.code) {
            const codeCollision = await prisma_js_1.prisma.batch.findFirst({
                where: {
                    instituteId,
                    code: code.trim(),
                    id: { not: id },
                },
            });
            if (codeCollision) {
                return res.status(409).json({ success: false, error: `Batch code '${code.trim()}' is already in use in this institute` });
            }
        }
        const updated = await prisma_js_1.prisma.batch.update({
            where: { id },
            data: {
                ...(name ? { name: name.trim() } : {}),
                ...(code !== undefined ? { code: code ? code.trim() : null } : {}),
                ...(academicYear ? { academicYear: academicYear.trim() } : {}),
                ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
                ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
                ...(description !== undefined ? { description: description ? description.trim() : null } : {}),
                ...(schedule !== undefined ? { schedule: schedule ? schedule.trim() : null } : {}),
                ...(courseId !== undefined ? { courseId: courseId ? courseId.trim() : null } : {}),
                ...(isActive !== undefined ? { isActive } : {}),
            },
        });
        return res.json({ success: true, message: 'Batch updated successfully', data: { batch: updated } });
    }
    catch (err) {
        console.error('[updateBatch error]', err);
        return res.status(500).json({ success: false, error: 'Failed to update batch' });
    }
}
// Toggle Batch Active Status
async function toggleBatchStatus(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id } = req.params;
        const { isActive } = req.body;
        const existing = await prisma_js_1.prisma.batch.findFirst({
            where: { id, instituteId },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        const nextState = typeof isActive === 'boolean' ? isActive : !existing.isActive;
        const updated = await prisma_js_1.prisma.batch.update({
            where: { id },
            data: { isActive: nextState },
        });
        return res.json({
            success: true,
            message: `Batch ${nextState ? 'activated' : 'deactivated'} successfully`,
            data: { batch: updated },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to toggle batch status' });
    }
}
// Delete Batch
async function deleteBatch(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id } = req.params;
        const existing = await prisma_js_1.prisma.batch.findFirst({
            where: { id, instituteId },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        // Safely delete associated records and the batch
        await prisma_js_1.prisma.$transaction([
            prisma_js_1.prisma.batchSubject.deleteMany({ where: { batchId: id } }),
            prisma_js_1.prisma.staffBatchAssignment.deleteMany({ where: { batchId: id } }),
            prisma_js_1.prisma.studentEnrollment.deleteMany({ where: { batchId: id } }),
            prisma_js_1.prisma.attendanceEvent.deleteMany({ where: { batchId: id } }),
            prisma_js_1.prisma.batch.delete({ where: { id } }),
        ]);
        return res.json({
            success: true,
            message: `Batch '${existing.name}' deleted successfully`,
        });
    }
    catch (err) {
        console.error('[deleteBatch error]', err);
        return res.status(500).json({ success: false, error: err.message || 'Failed to delete batch' });
    }
}
// Assign or Create Subjects inside Batch
async function assignSubjectsToBatch(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id: batchId } = req.params;
        const parse = exports.assignSubjectsSchema.safeParse(req.body);
        if (!parse.success)
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });
        const batch = await prisma_js_1.prisma.batch.findFirst({
            where: { id: batchId, instituteId },
        });
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        // Direct Subject Creation / Addition inside Batch
        if (parse.data.name && parse.data.name.trim()) {
            const subjectName = parse.data.name.trim();
            const subjectCode = parse.data.code && parse.data.code.trim() ? parse.data.code.trim().toUpperCase() : null;
            // Validate subject code uniqueness within the institute if code is supplied
            if (subjectCode) {
                const codeCollision = await prisma_js_1.prisma.subject.findFirst({
                    where: {
                        instituteId,
                        code: subjectCode,
                        NOT: { name: { equals: subjectName, mode: 'insensitive' } },
                    },
                });
                if (codeCollision) {
                    return res.status(409).json({
                        success: false,
                        error: `Subject code '${subjectCode}' is already in use by '${codeCollision.name}' in this institute`,
                    });
                }
            }
            // Find or create reusable subject in this institute
            let subject = await prisma_js_1.prisma.subject.findFirst({
                where: {
                    instituteId,
                    name: { equals: subjectName, mode: 'insensitive' },
                },
            });
            if (!subject && subjectCode) {
                subject = await prisma_js_1.prisma.subject.findFirst({
                    where: { instituteId, code: subjectCode },
                });
            }
            if (!subject) {
                subject = await prisma_js_1.prisma.subject.create({
                    data: {
                        instituteId,
                        name: subjectName,
                        code: subjectCode,
                        description: parse.data.description ? parse.data.description.trim() : null,
                    },
                });
            }
            // Check if already assigned to this batch
            const existingAssignment = await prisma_js_1.prisma.batchSubject.findUnique({
                where: {
                    batchId_subjectId: {
                        batchId,
                        subjectId: subject.id,
                    },
                },
            });
            if (existingAssignment) {
                return res.status(409).json({
                    success: false,
                    error: `Subject '${subject.name}' is already assigned to this batch`,
                });
            }
            const batchSubject = await prisma_js_1.prisma.batchSubject.create({
                data: {
                    batchId,
                    subjectId: subject.id,
                    staffProfileId: parse.data.staffProfileId || null,
                    description: parse.data.description ? parse.data.description.trim() : null,
                    schedule: parse.data.schedule ? parse.data.schedule.trim() : null,
                    isActive: parse.data.isActive !== false,
                },
                include: {
                    subject: true,
                    staffProfile: {
                        include: {
                            user: { select: { id: true, fullName: true, email: true, phone: true } },
                        },
                    },
                },
            });
            // Ensure staff is also assigned to batch if specified
            if (parse.data.staffProfileId) {
                await prisma_js_1.prisma.staffBatchAssignment.upsert({
                    where: {
                        staffProfileId_batchId: {
                            staffProfileId: parse.data.staffProfileId,
                            batchId,
                        },
                    },
                    create: {
                        staffProfileId: parse.data.staffProfileId,
                        batchId,
                    },
                    update: {},
                });
            }
            return res.status(201).json({
                success: true,
                message: `Subject '${subject.name}' added to batch successfully`,
                data: { batchSubject },
            });
        }
        const subjectIds = parse.data.subjectIds || (parse.data.subjectId ? [parse.data.subjectId] : []);
        if (subjectIds.length === 0) {
            return res.status(400).json({ success: false, error: 'Subject name or subjectId must be provided' });
        }
        // Check for duplicate assignments
        const existingLinks = await prisma_js_1.prisma.batchSubject.findMany({
            where: {
                batchId,
                subjectId: { in: subjectIds },
            },
            include: { subject: true },
        });
        if (existingLinks.length > 0) {
            const names = existingLinks.map((l) => l.subject.name).join(', ');
            return res.status(409).json({
                success: false,
                error: `Subject(s) ${names} already assigned to this batch`,
            });
        }
        // Verify all subjects belong to this institute
        const subjects = await prisma_js_1.prisma.subject.findMany({
            where: {
                id: { in: subjectIds },
                instituteId,
            },
        });
        if (subjects.length !== subjectIds.length) {
            return res.status(400).json({ success: false, error: 'One or more subjects do not exist in this institute' });
        }
        for (const sid of subjectIds) {
            await prisma_js_1.prisma.batchSubject.create({
                data: {
                    batchId,
                    subjectId: sid,
                    staffProfileId: parse.data.staffProfileId || null,
                    description: parse.data.description ? parse.data.description.trim() : null,
                    schedule: parse.data.schedule ? parse.data.schedule.trim() : null,
                    isActive: parse.data.isActive !== false,
                },
            });
        }
        if (parse.data.staffProfileId) {
            await prisma_js_1.prisma.staffBatchAssignment.upsert({
                where: {
                    staffProfileId_batchId: {
                        staffProfileId: parse.data.staffProfileId,
                        batchId,
                    },
                },
                create: {
                    staffProfileId: parse.data.staffProfileId,
                    batchId,
                },
                update: {},
            });
        }
        const updatedBatch = await prisma_js_1.prisma.batch.findUnique({
            where: { id: batchId },
            include: {
                batchSubjects: {
                    include: {
                        subject: true,
                        staffProfile: {
                            include: { user: { select: { id: true, fullName: true, email: true } } },
                        },
                    },
                },
            },
        });
        return res.json({
            success: true,
            message: `${subjectIds.length} subject(s) assigned to batch successfully`,
            data: { batch: updatedBatch },
        });
    }
    catch (err) {
        console.error('[assignSubjectsToBatch error]', err);
        return res.status(500).json({ success: false, error: 'Failed to assign subjects to batch' });
    }
}
// Update Subject Inside Batch
async function updateBatchSubject(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id: batchId, subjectId } = req.params;
        const { name, code, description, staffProfileId, schedule, isActive } = req.body;
        const batch = await prisma_js_1.prisma.batch.findFirst({
            where: { id: batchId, instituteId },
        });
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        const existing = await prisma_js_1.prisma.batchSubject.findUnique({
            where: {
                batchId_subjectId: {
                    batchId,
                    subjectId,
                },
            },
            include: { subject: true },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Subject is not assigned to this batch' });
        }
        // Optionally update Subject title/code if provided
        if (name || code !== undefined) {
            if (code && code.trim()) {
                const cleanCode = code.trim().toUpperCase();
                const codeCollision = await prisma_js_1.prisma.subject.findFirst({
                    where: { instituteId, code: cleanCode, id: { not: subjectId } },
                });
                if (codeCollision) {
                    return res.status(409).json({ success: false, error: `Subject code '${cleanCode}' is already in use in this institute` });
                }
            }
            await prisma_js_1.prisma.subject.update({
                where: { id: subjectId },
                data: {
                    ...(name ? { name: name.trim() } : {}),
                    ...(code !== undefined ? { code: (code && code.trim()) ? code.trim().toUpperCase() : null } : {}),
                },
            });
        }
        const updated = await prisma_js_1.prisma.batchSubject.update({
            where: {
                batchId_subjectId: {
                    batchId,
                    subjectId,
                },
            },
            data: {
                ...(description !== undefined ? { description: description ? description.trim() : null } : {}),
                ...(schedule !== undefined ? { schedule: schedule ? schedule.trim() : null } : {}),
                ...(staffProfileId !== undefined ? { staffProfileId: staffProfileId || null } : {}),
                ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
            },
            include: {
                subject: true,
                staffProfile: {
                    include: {
                        user: { select: { id: true, fullName: true, email: true, phone: true } },
                    },
                },
            },
        });
        if (staffProfileId) {
            await prisma_js_1.prisma.staffBatchAssignment.upsert({
                where: {
                    staffProfileId_batchId: {
                        staffProfileId,
                        batchId,
                    },
                },
                create: {
                    staffProfileId,
                    batchId,
                },
                update: {},
            });
        }
        return res.json({
            success: true,
            message: 'Batch subject updated successfully',
            data: { batchSubject: updated },
        });
    }
    catch (err) {
        console.error('[updateBatchSubject error]', err);
        return res.status(500).json({ success: false, error: 'Failed to update batch subject' });
    }
}
// Allocate Student Subjects within Batch
async function allocateStudentSubjects(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const batchId = req.params.id || req.body.batchId;
        const studentId = req.params.studentId || req.body.studentId;
        const { subjectIds } = req.body;
        if (!batchId)
            return res.status(400).json({ success: false, error: 'Batch ID is required' });
        if (!studentId)
            return res.status(400).json({ success: false, error: 'Student ID is required' });
        if (!Array.isArray(subjectIds)) {
            return res.status(400).json({ success: false, error: 'subjectIds array is required' });
        }
        // 1. Verify batch in institute
        const batch = await prisma_js_1.prisma.batch.findFirst({
            where: { id: batchId, instituteId },
        });
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        // 2. Verify student in institute
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { id: studentId, instituteId },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found in this institute' });
        }
        // 3. Staff authorization check: Staff cannot allocate subjects for unauthorized students
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to allocate subjects for this student' });
        }
        // 4. Verify ALL subjectIds are assigned to THIS batch
        if (subjectIds.length > 0) {
            const batchSubjects = await prisma_js_1.prisma.batchSubject.findMany({
                where: {
                    batchId,
                    subjectId: { in: subjectIds },
                },
            });
            if (batchSubjects.length !== subjectIds.length) {
                return res.status(400).json({
                    success: false,
                    error: 'One or more subjects are not assigned to this batch. Students can only be allocated to subjects assigned to their batch.',
                });
            }
            // If caller is STAFF, verify staff is assigned to teach ALL requested subjects in this batch
            if (req.user?.role === 'STAFF') {
                for (const sid of subjectIds) {
                    const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatchSubject)(req, batchId, sid, prisma_js_1.prisma);
                    if (!isAssigned) {
                        return res.status(403).json({
                            success: false,
                            error: `Forbidden: You are not authorized to allocate subject '${sid}' in this batch.`,
                        });
                    }
                }
            }
        }
        // 5. Transactionally update student subject allocations
        await prisma_js_1.prisma.$transaction(async (tx) => {
            // Ensure primary batch enrollment exists
            const existingPrimary = await tx.studentEnrollment.findFirst({
                where: { studentId, batchId, subjectId: null },
            });
            if (!existingPrimary) {
                await tx.studentEnrollment.create({
                    data: { studentId, batchId, subjectId: null, isActive: true },
                });
            }
            else if (!existingPrimary.isActive) {
                await tx.studentEnrollment.update({
                    where: { id: existingPrimary.id },
                    data: { isActive: true },
                });
            }
            // Remove subject enrollments for this batch that are not in subjectIds
            // If caller is STAFF, only remove subjects that this staff member is assigned to teach!
            if (req.user?.role === 'STAFF') {
                const staffSubjects = await tx.batchSubject.findMany({
                    where: {
                        batchId,
                        staffProfile: { userId: req.user.userId },
                    },
                    select: { subjectId: true },
                });
                const staffSubjectIds = staffSubjects.map((s) => s.subjectId);
                if (staffSubjectIds.length > 0) {
                    await tx.studentEnrollment.deleteMany({
                        where: {
                            studentId,
                            batchId,
                            subjectId: { in: staffSubjectIds, notIn: subjectIds },
                        },
                    });
                }
            }
            else {
                await tx.studentEnrollment.deleteMany({
                    where: {
                        studentId,
                        batchId,
                        subjectId: { not: null, notIn: subjectIds },
                    },
                });
            }
            // Upsert/create each allocated subject enrollment
            for (const sid of subjectIds) {
                const existingSubEnrollment = await tx.studentEnrollment.findFirst({
                    where: { studentId, batchId, subjectId: sid },
                });
                if (!existingSubEnrollment) {
                    await tx.studentEnrollment.create({
                        data: { studentId, batchId, subjectId: sid, isActive: true },
                    });
                }
                else if (!existingSubEnrollment.isActive) {
                    await tx.studentEnrollment.update({
                        where: { id: existingSubEnrollment.id },
                        data: { isActive: true },
                    });
                }
            }
        });
        // Fetch updated allocations
        const currentAllocations = await prisma_js_1.prisma.studentEnrollment.findMany({
            where: {
                studentId,
                batchId,
                subjectId: { not: null },
                isActive: true,
            },
            include: {
                subject: { select: { id: true, name: true, code: true } },
            },
        });
        return res.json({
            success: true,
            message: 'Student subject allocations updated successfully',
            data: {
                studentId,
                batchId,
                allocatedSubjects: currentAllocations.map((a) => a.subject),
            },
        });
    }
    catch (err) {
        console.error('[allocateStudentSubjects error]', err);
        return res.status(500).json({ success: false, error: 'Failed to allocate student subjects' });
    }
}
// Get Student Subject Allocations within Batch
async function getStudentSubjectAllocations(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const batchId = req.params.id || req.query.batchId;
        const studentId = req.params.studentId || req.query.studentId;
        if (!studentId)
            return res.status(400).json({ success: false, error: 'Student ID is required' });
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to access this student' });
        }
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { id: studentId, instituteId },
            select: {
                id: true,
                admissionNumber: true,
                firstName: true,
                lastName: true,
                photoUrl: true,
            },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found in this institute' });
        }
        // Determine target batch
        let targetBatchId = batchId;
        if (!targetBatchId) {
            const primaryEnrollment = await prisma_js_1.prisma.studentEnrollment.findFirst({
                where: { studentId, isActive: true },
                orderBy: { enrolledAt: 'desc' },
            });
            if (primaryEnrollment) {
                targetBatchId = primaryEnrollment.batchId;
            }
        }
        if (!targetBatchId) {
            return res.json({
                success: true,
                data: {
                    student,
                    batch: null,
                    batchSubjects: [],
                    allocatedSubjectIds: [],
                },
            });
        }
        const batch = await prisma_js_1.prisma.batch.findFirst({
            where: { id: targetBatchId, instituteId },
            include: {
                batchSubjects: {
                    include: {
                        subject: true,
                        staffProfile: {
                            include: {
                                user: { select: { fullName: true, email: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        const activeAllocations = await prisma_js_1.prisma.studentEnrollment.findMany({
            where: {
                studentId,
                batchId: targetBatchId,
                subjectId: { not: null },
                isActive: true,
            },
        });
        const allocatedSubjectIds = activeAllocations.map((a) => a.subjectId);
        return res.json({
            success: true,
            data: {
                student,
                batch: {
                    id: batch.id,
                    name: batch.name,
                    code: batch.code,
                    academicYear: batch.academicYear,
                },
                batchSubjects: batch.batchSubjects.map((bs) => ({
                    id: bs.subjectId,
                    name: bs.subject.name,
                    code: bs.subject.code,
                    description: bs.description || bs.subject.description,
                    schedule: bs.schedule,
                    teacherName: bs.staffProfile?.user?.fullName || null,
                    isActive: bs.isActive,
                })),
                allocatedSubjectIds,
            },
        });
    }
    catch (err) {
        console.error('[getStudentSubjectAllocations error]', err);
        return res.status(500).json({ success: false, error: 'Failed to get student subject allocations' });
    }
}
// Remove Subject from Batch
async function removeSubjectFromBatch(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id: batchId, subjectId } = req.params;
        const batch = await prisma_js_1.prisma.batch.findFirst({
            where: { id: batchId, instituteId },
        });
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        await prisma_js_1.prisma.batchSubject.deleteMany({
            where: {
                batchId,
                subjectId,
            },
        });
        return res.json({ success: true, message: 'Subject removed from batch successfully' });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to remove subject from batch' });
    }
}
// Assign Staff to Batch
async function assignStaffToBatch(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id: batchId } = req.params;
        const parse = exports.assignStaffSchema.safeParse(req.body);
        if (!parse.success)
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });
        const batch = await prisma_js_1.prisma.batch.findFirst({
            where: { id: batchId, instituteId },
        });
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        const staffProfileIds = parse.data.staffProfileIds || (parse.data.staffProfileId ? [parse.data.staffProfileId] : []);
        if (staffProfileIds.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one staffProfileId must be provided' });
        }
        // Verify all staff belong to this institute
        const staffList = await prisma_js_1.prisma.staffProfile.findMany({
            where: {
                id: { in: staffProfileIds },
                instituteId,
            },
        });
        if (staffList.length !== staffProfileIds.length) {
            return res.status(400).json({ success: false, error: 'One or more staff members do not belong to this institute' });
        }
        for (const spId of staffProfileIds) {
            await prisma_js_1.prisma.staffBatchAssignment.upsert({
                where: {
                    staffProfileId_batchId: {
                        staffProfileId: spId,
                        batchId,
                    },
                },
                create: {
                    staffProfileId: spId,
                    batchId,
                },
                update: {},
            });
        }
        const updatedBatch = await prisma_js_1.prisma.batch.findUnique({
            where: { id: batchId },
            include: {
                staffAssignments: {
                    include: {
                        staffProfile: {
                            include: {
                                user: { select: { id: true, fullName: true, email: true, phone: true } },
                            },
                        },
                    },
                },
            },
        });
        cache_js_1.serverCache.invalidate();
        return res.json({
            success: true,
            message: 'Staff assigned to batch successfully',
            data: { batch: updatedBatch },
        });
    }
    catch (err) {
        console.error('[assignStaffToBatch error]', err);
        return res.status(500).json({ success: false, error: 'Failed to assign staff to batch' });
    }
}
// Remove Staff from Batch
async function removeStaffFromBatch(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id: batchId, staffProfileId } = req.params;
        const batch = await prisma_js_1.prisma.batch.findFirst({
            where: { id: batchId, instituteId },
        });
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        await prisma_js_1.prisma.staffBatchAssignment.deleteMany({
            where: {
                batchId,
                staffProfileId,
            },
        });
        cache_js_1.serverCache.invalidate();
        return res.json({ success: true, message: 'Staff removed from batch successfully' });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to remove staff from batch' });
    }
}
// Enroll Student in Batch
async function enrollStudentInBatch(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id: batchId } = req.params;
        const parse = exports.enrollStudentSchema.safeParse(req.body);
        if (!parse.success)
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });
        const { studentId, subjectId } = parse.data;
        // Verify batch
        const batch = await prisma_js_1.prisma.batch.findFirst({
            where: { id: batchId, instituteId },
        });
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        // Verify student belongs to this institute and is authorized for caller
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to enroll this student' });
        }
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { id: studentId, instituteId },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found in this institute' });
        }
        if (student.status !== 'ACTIVE') {
            return res.status(400).json({ success: false, error: `Cannot enroll student in ${student.status} status` });
        }
        // If subjectId is given, verify it belongs to this institute
        if (subjectId) {
            const subject = await prisma_js_1.prisma.subject.findFirst({
                where: { id: subjectId, instituteId },
            });
            if (!subject) {
                return res.status(404).json({ success: false, error: 'Subject not found in this institute' });
            }
        }
        // Upsert enrollment
        const existing = await prisma_js_1.prisma.studentEnrollment.findFirst({
            where: {
                studentId,
                batchId,
                subjectId: subjectId || null,
            },
        });
        let enrollment;
        if (existing) {
            enrollment = await prisma_js_1.prisma.studentEnrollment.update({
                where: { id: existing.id },
                data: { isActive: true },
            });
        }
        else {
            enrollment = await prisma_js_1.prisma.studentEnrollment.create({
                data: {
                    studentId,
                    batchId,
                    subjectId: subjectId || null,
                    isActive: true,
                },
            });
        }
        return res.status(201).json({
            success: true,
            message: `${student.firstName} ${student.lastName} enrolled in batch successfully`,
            data: { enrollment },
        });
    }
    catch (err) {
        console.error('[enrollStudentInBatch error]', err);
        return res.status(500).json({ success: false, error: 'Failed to enroll student in batch' });
    }
}
// Unenroll Student from Batch
async function unenrollStudentFromBatch(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id: batchId, studentId } = req.params;
        const batch = await prisma_js_1.prisma.batch.findFirst({
            where: { id: batchId, instituteId },
        });
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to unenroll this student' });
        }
        await prisma_js_1.prisma.studentEnrollment.updateMany({
            where: {
                batchId,
                studentId,
            },
            data: { isActive: false },
        });
        return res.json({ success: true, message: 'Student unenrolled from batch successfully' });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to unenroll student from batch' });
    }
}
// List Institute Staff (for dropdown assignment)
async function listInstituteStaff(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const staffMembers = await prisma_js_1.prisma.staffProfile.findMany({
            where: { instituteId },
            include: {
                user: {
                    select: { id: true, fullName: true, email: true, phone: true, isActive: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const formatted = staffMembers
            .filter((s) => s.user.isActive)
            .map((s) => ({
            staffProfileId: s.id,
            userId: s.user.id,
            fullName: s.user.fullName,
            email: s.user.email,
            phone: s.user.phone,
            employeeCode: s.employeeCode,
            designation: s.designation,
        }));
        return res.json({ success: true, data: { staff: formatted } });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to list institute staff' });
    }
}
// List Subjects
async function listSubjects(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const subjects = await prisma_js_1.prisma.subject.findMany({
            where: { instituteId },
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: {
                        batchSubjects: true,
                        enrollments: true,
                    },
                },
            },
        });
        return res.json({ success: true, data: { subjects } });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to list subjects' });
    }
}
// Create Subject
async function createSubject(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const parse = exports.createSubjectSchema.safeParse(req.body);
        if (!parse.success)
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });
        const { name, code, description } = parse.data;
        const existing = await prisma_js_1.prisma.subject.findUnique({
            where: {
                instituteId_name: {
                    instituteId,
                    name: name.trim(),
                },
            },
        });
        if (existing) {
            return res.status(409).json({ success: false, error: `Subject '${name}' already exists in this institute` });
        }
        if (code && code.trim()) {
            const codeCollision = await prisma_js_1.prisma.subject.findFirst({
                where: { instituteId, code: code.trim().toUpperCase() },
            });
            if (codeCollision) {
                return res.status(409).json({ success: false, error: `Subject code '${code.trim().toUpperCase()}' is already in use in this institute` });
            }
        }
        const subject = await prisma_js_1.prisma.subject.create({
            data: {
                instituteId,
                name: name.trim(),
                code: (code && code.trim()) ? code.trim().toUpperCase() : null,
                description: description?.trim() || null,
            },
        });
        return res.status(201).json({ success: true, message: 'Subject created successfully', data: { subject } });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to create subject' });
    }
}
// Update Subject
async function updateSubject(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id } = req.params;
        const parse = exports.updateSubjectSchema.safeParse(req.body);
        if (!parse.success)
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });
        const existing = await prisma_js_1.prisma.subject.findFirst({
            where: { id, instituteId },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Subject not found in this institute' });
        }
        const { name, code, description } = parse.data;
        if (name && name.trim() !== existing.name) {
            const collision = await prisma_js_1.prisma.subject.findFirst({
                where: {
                    instituteId,
                    name: name.trim(),
                    id: { not: id },
                },
            });
            if (collision) {
                return res.status(409).json({ success: false, error: `Subject '${name.trim()}' already exists in this institute` });
            }
        }
        const cleanCode = code !== undefined ? ((code && code.trim()) ? code.trim().toUpperCase() : null) : undefined;
        if (cleanCode) {
            const codeCollision = await prisma_js_1.prisma.subject.findFirst({
                where: {
                    instituteId,
                    code: cleanCode,
                    id: { not: id },
                },
            });
            if (codeCollision) {
                return res.status(409).json({ success: false, error: `Subject code '${cleanCode}' is already in use in this institute` });
            }
        }
        const updated = await prisma_js_1.prisma.subject.update({
            where: { id },
            data: {
                ...(name ? { name: name.trim() } : {}),
                ...(code !== undefined ? { code: cleanCode } : {}),
                ...(description !== undefined ? { description: description ? description.trim() : null } : {}),
            },
        });
        return res.json({ success: true, message: 'Subject updated successfully', data: { subject: updated } });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to update subject' });
    }
}
// Delete Subject
async function deleteSubject(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id } = req.params;
        const existing = await prisma_js_1.prisma.subject.findFirst({
            where: { id, instituteId },
            include: {
                _count: {
                    select: { batchSubjects: true, enrollments: true },
                },
            },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Subject not found in this institute' });
        }
        if (existing._count.batchSubjects > 0 || existing._count.enrollments > 0) {
            return res.status(400).json({
                success: false,
                error: `Cannot delete subject '${existing.name}' because it is linked to active batches or student enrollments. Remove it from batches first.`,
            });
        }
        await prisma_js_1.prisma.subject.delete({ where: { id } });
        return res.json({ success: true, message: 'Subject deleted successfully' });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to delete subject' });
    }
}
