"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrollExistingStudentSchema = exports.updateStudentIdentifierSchema = exports.resetStudentPasswordSchema = exports.updateStudentStatusSchema = exports.updateStudentSchema = exports.studentAdmissionSchema = void 0;
exports.formatStudentResponse = formatStudentResponse;
exports.listStudents = listStudents;
exports.admitStudent = admitStudent;
exports.getAdmissionPrefixInfo = getAdmissionPrefixInfo;
exports.getMyStudentProfile = getMyStudentProfile;
exports.getMyStudentDashboard = getMyStudentDashboard;
exports.getMyStudentTimetable = getMyStudentTimetable;
exports.getMyStudentAttendanceHistory = getMyStudentAttendanceHistory;
exports.getStudentById = getStudentById;
exports.updateStudent = updateStudent;
exports.resetStudentPassword = resetStudentPassword;
exports.updateStudentLoginIdentifier = updateStudentLoginIdentifier;
exports.updateStudentStatus = updateStudentStatus;
exports.uploadStudentPhoto = uploadStudentPhoto;
exports.getStudentPhoto = getStudentPhoto;
exports.getRawPhoto = getRawPhoto;
exports.updateStudentAccountStatus = updateStudentAccountStatus;
exports.lookupParent = lookupParent;
exports.assignStudentBatch = assignStudentBatch;
exports.lookupExistingStudent = lookupExistingStudent;
exports.enrollExistingStudent = enrollExistingStudent;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma_js_1 = require("../../prisma.js");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const security_js_1 = require("../../utils/security.js");
const admission_number_service_js_1 = require("./admission-number.service.js");
const timetable_resolver_js_1 = require("./timetable-resolver.js");
function formatStudentResponse(student) {
    if (!student)
        return student;
    let formattedPhoto = student.photoUrl;
    if (formattedPhoto && !formattedPhoto.startsWith('http://') && !formattedPhoto.startsWith('https://') && !formattedPhoto.startsWith('/api/')) {
        const v = student.updatedAt ? new Date(student.updatedAt).getTime() : '';
        formattedPhoto = `/api/students/${student.id}/photo${v ? `?v=${v}` : ''}`;
    }
    let credentialsOnRecord = {
        studentPassword: null,
        parentPassword: null,
    };
    let cleanNotes = student.notes;
    if (student.notes && student.notes.startsWith('{') && (student.notes.includes('studentPassword') || student.notes.includes('parentPassword'))) {
        try {
            const parsed = JSON.parse(student.notes);
            cleanNotes = parsed.userNotes || null;
            credentialsOnRecord.studentPassword = parsed.studentPassword || null;
            credentialsOnRecord.parentPassword = parsed.parentPassword || null;
        }
        catch { }
    }
    return {
        ...student,
        photoUrl: formattedPhoto,
        notes: cleanNotes,
        credentialsOnRecord,
    };
}
const student_authorization_service_js_1 = require("./student-authorization.service.js");
const storage_js_1 = require("../../utils/storage.js");
exports.studentAdmissionSchema = zod_1.z.object({
    admissionNumber: zod_1.z.string().optional(), // Automatically generated on server
    firstName: zod_1.z.string().min(1, 'First name is required').max(50),
    lastName: zod_1.z.string().min(1, 'Last name is required').max(50),
    studentPhone: zod_1.z.string().optional().or(zod_1.z.literal('')),
    dob: zod_1.z.string().optional(), // YYYY-MM-DD
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    bloodGroup: zod_1.z.string().optional(),
    notes: zod_1.z.string().optional(),
    admissionDate: zod_1.z.string().optional(), // YYYY-MM-DD
    // Optional batch enrollment
    batchId: zod_1.z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), zod_1.z.string().uuid().optional()),
    // Optional batch subject enrollments
    subjectIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    // Optional Global LMS Course enrollment & delivery mode during admission
    globalCourseId: zod_1.z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), zod_1.z.string().uuid().optional()),
    learningMode: zod_1.z.enum(['ONLINE', 'OFFLINE']).optional(),
    onlineDirect: zod_1.z.boolean().optional().default(false),
    franchiseId: zod_1.z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), zod_1.z.string().uuid().optional()),
    // Student login account creation (defaults to true for enterprise credentials workflow)
    createLoginAccount: zod_1.z.boolean().default(true),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    studentEmail: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().optional(),
    initialPassword: zod_1.z.string().min(8).optional(),
    studentInitialPassword: zod_1.z.string().min(8).optional(),
    // Parent / Guardian fields during admission (Requirement 3)
    parentFullName: zod_1.z.string().min(2, 'Parent/guardian full name is required').optional(),
    parentRelationship: zod_1.z.enum(['FATHER', 'MOTHER', 'GUARDIAN']).default('GUARDIAN').optional(),
    parentPhone: zod_1.z.string().min(8, 'Parent/guardian phone number is required').optional(),
    parentEmail: zod_1.z.string().email().optional().or(zod_1.z.literal('')).optional(),
    parentInitialPassword: zod_1.z.string().min(8).optional(),
    parentCanReceiveSms: zod_1.z.boolean().default(true).optional(),
    photoUrl: zod_1.z.string().optional(),
});
exports.updateStudentSchema = zod_1.z.object({
    firstName: zod_1.z.string().trim().min(1, 'First name is required').optional(),
    lastName: zod_1.z.string().trim().min(1, 'Last name is required').optional(),
    studentPhone: zod_1.z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), zod_1.z.string().trim().optional().nullable()),
    studentEmail: zod_1.z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), zod_1.z.string().trim().email('Invalid email').optional().nullable()),
    dob: zod_1.z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), zod_1.z.string().trim().optional().nullable()),
    gender: zod_1.z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
    bloodGroup: zod_1.z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), zod_1.z.string().trim().optional().nullable()),
    notes: zod_1.z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), zod_1.z.string().trim().optional().nullable()),
    photoUrl: zod_1.z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), zod_1.z.string().trim().optional().nullable()),
    batchId: zod_1.z.preprocess((val) => (typeof val === 'string' && (val.trim() === '' || val === 'null' || val === 'undefined') ? null : val), zod_1.z.string().uuid('Invalid batch ID').optional().nullable()),
    subjectIds: zod_1.z.preprocess((val) => (Array.isArray(val) ? val.filter((x) => typeof x === 'string' && x.trim() !== '') : val), zod_1.z.array(zod_1.z.string().uuid('Invalid subject ID')).optional().nullable()),
    parentFullName: zod_1.z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), zod_1.z.string().trim().optional().nullable()),
    parentRelationship: zod_1.z.enum(['FATHER', 'MOTHER', 'GUARDIAN']).optional(),
    parentPhone: zod_1.z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), zod_1.z.string().trim().optional().nullable()),
    parentEmail: zod_1.z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), zod_1.z.string().trim().email('Invalid email').optional().nullable()),
});
exports.updateStudentStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['ACTIVE', 'PASSED_OUT', 'DISCONTINUED']),
    reason: zod_1.z.string().optional(),
});
exports.resetStudentPasswordSchema = zod_1.z.object({
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters').optional(),
    newPassword: zod_1.z.string().min(8, 'Password must be at least 8 characters').optional(),
});
exports.updateStudentIdentifierSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address').optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().min(8, 'Phone number must be at least 8 digits').optional().or(zod_1.z.literal('')),
}).refine((data) => data.email !== undefined || data.phone !== undefined, {
    message: 'At least one identifier (email or phone) must be provided',
});
/**
 * List students with filters, search, and pagination
 */
async function listStudents(req, res) {
    try {
        const instituteId = req.instituteId;
        const franchiseId = req.franchiseId;
        const isConsolidated = Boolean(req.isConsolidatedBranchView);
        const assignedBranchIds = req.assignedBranchIds || [];
        const includeOnline = req.query.includeOnline === 'true';
        const learningMode = req.query.learningMode;
        const globalCourseId = req.query.globalCourseId;
        if (!instituteId && !franchiseId && req.user?.role !== 'SUPER_ADMIN') {
            return res.status(400).json({ success: false, error: 'Institute context required' });
        }
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const search = (req.query.search || '').trim();
        const status = req.query.status;
        const batchId = req.query.batchId;
        const subjectId = req.query.subjectId;
        const skip = (page - 1) * limit;
        // Staff validation if batchId / subjectId is provided
        if (req.user?.role === 'STAFF') {
            if (batchId) {
                const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, batchId, prisma_js_1.prisma);
                if (!isAssigned) {
                    return res.status(403).json({
                        success: false,
                        error: 'Forbidden: You are not authorized to view students in this batch.',
                    });
                }
            }
            if (batchId && subjectId) {
                const isAssignedSub = await (0, student_authorization_service_js_1.isStaffAssignedToBatchSubject)(req, batchId, subjectId, prisma_js_1.prisma);
                if (!isAssignedSub) {
                    return res.status(403).json({
                        success: false,
                        error: 'Forbidden: You are not authorized to view students in this subject.',
                    });
                }
            }
        }
        const scope = await (0, student_authorization_service_js_1.getAuthorizedStudentScope)(req, prisma_js_1.prisma, { batchId, subjectId });
        const andConditions = [];
        if (req.user?.role === 'FRANCHISE_OWNER') {
            if (isConsolidated || !instituteId) {
                andConditions.push(scope.whereClause);
            }
            else if (includeOnline || learningMode === 'ONLINE') {
                andConditions.push({
                    OR: [
                        { instituteId },
                        ...(franchiseId ? [{ franchiseId, instituteId: null }] : []),
                    ],
                });
            }
            else {
                andConditions.push({ instituteId });
            }
        }
        else if (req.user?.role === 'SUPER_ADMIN') {
            if (instituteId) {
                andConditions.push({ instituteId });
            }
            else if (franchiseId) {
                andConditions.push({
                    OR: [
                        { franchiseId },
                        { institute: { franchiseId } },
                    ],
                });
            }
            else {
                andConditions.push(scope.whereClause);
            }
        }
        else {
            andConditions.push({ instituteId });
            andConditions.push(scope.whereClause);
        }
        if (status && ['ACTIVE', 'PASSED_OUT', 'DISCONTINUED'].includes(status)) {
            andConditions.push({ status });
        }
        if (learningMode === 'ONLINE') {
            andConditions.push({
                OR: [
                    { instituteId: null },
                    { courseEnrollments: { some: { mode: client_1.LearningMode.ONLINE, status: { in: [client_1.EnrollmentStatus.ACTIVE, client_1.EnrollmentStatus.COMPLETED] } } } },
                ],
            });
        }
        else if (learningMode === 'OFFLINE') {
            andConditions.push({
                instituteId: { not: null },
            });
        }
        if (globalCourseId) {
            andConditions.push({
                courseEnrollments: {
                    some: {
                        courseId: globalCourseId,
                        status: { in: [client_1.EnrollmentStatus.ACTIVE, client_1.EnrollmentStatus.COMPLETED] },
                    },
                },
            });
        }
        // For admin roles where scope.whereClause is broad, apply explicit query filters
        if (req.user?.role !== 'STAFF') {
            if (batchId) {
                andConditions.push({
                    enrollments: {
                        some: { batchId, isActive: true },
                    },
                });
            }
            if (subjectId) {
                andConditions.push({
                    enrollments: {
                        some: { batchId: batchId || undefined, subjectId, isActive: true },
                    },
                });
            }
        }
        if (search) {
            andConditions.push({
                OR: [
                    { admissionNumber: { contains: search, mode: 'insensitive' } },
                    { firstName: { contains: search, mode: 'insensitive' } },
                    { lastName: { contains: search, mode: 'insensitive' } },
                ],
            });
        }
        const where = andConditions.length > 0 ? { AND: andConditions } : {};
        const [total, students] = await Promise.all([
            prisma_js_1.prisma.student.count({ where }),
            prisma_js_1.prisma.student.findMany({
                where,
                skip,
                take: limit,
                orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
                include: {
                    institute: {
                        select: { id: true, name: true, code: true },
                    },
                    franchise: {
                        select: { id: true, name: true, code: true },
                    },
                    enrollments: {
                        where: { isActive: true },
                        include: {
                            batch: {
                                select: { id: true, name: true, academicYear: true },
                            },
                            subject: {
                                select: { id: true, name: true, code: true },
                            },
                        },
                    },
                    courseEnrollments: {
                        where: { status: { in: [client_1.EnrollmentStatus.ACTIVE, client_1.EnrollmentStatus.COMPLETED] } },
                        orderBy: { enrolledAt: 'desc' },
                        select: {
                            id: true,
                            mode: true,
                            status: true,
                            progress: true,
                            course: { select: { id: true, title: true, slug: true } },
                            batch: { select: { id: true, name: true } },
                        },
                    },
                    user: {
                        select: { id: true, fullName: true, email: true, phone: true, isActive: true, mustChangePassword: true },
                    },
                    parentRelations: {
                        select: {
                            id: true,
                            relation: true,
                            isPrimaryContact: true,
                            parent: {
                                select: {
                                    id: true,
                                    user: {
                                        select: { id: true, fullName: true, phone: true, email: true },
                                    },
                                },
                            },
                        },
                    },
                },
            }),
        ]);
        let formattedStudents = students.map(formatStudentResponse);
        // If caller is STAFF, filter each student's enrollments to only those batches assigned to this staff member
        if (req.user?.role === 'STAFF') {
            const authorizedBatchIds = scope.assignedBatchIds || [];
            formattedStudents = formattedStudents.map((s) => ({
                ...s,
                enrollments: (s.enrollments || []).filter((e) => !e.batchId || authorizedBatchIds.includes(e.batchId)),
            }));
        }
        return res.json({
            success: true,
            data: {
                students: formattedStudents,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to list students' });
    }
}
/**
 * Admit a new student
 */
async function admitStudent(req, res) {
    try {
        const parse = exports.studentAdmissionSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message || 'Validation error',
            });
        }
        const data = parse.data;
        const rawInstHeader = req.headers['x-institute-id'];
        const callerRole = req.user?.role;
        const isOnlineDirectRequest = Boolean(data.onlineDirect) || (!req.instituteId && data.learningMode === 'ONLINE');
        let effectiveInstituteId = req.instituteId || null;
        if (isOnlineDirectRequest) {
            if (callerRole !== 'FRANCHISE_OWNER' && callerRole !== 'SUPER_ADMIN') {
                return res.status(403).json({
                    success: false,
                    error: 'Only Franchise Owner or Super Admin can admit campus-independent Online Direct students.',
                });
            }
            if (data.batchId) {
                return res.status(400).json({
                    success: false,
                    error: 'Online Direct students cannot be assigned to a physical branch batch; select Offline / Hybrid mode instead.',
                });
            }
            effectiveInstituteId = null;
        }
        else if (!effectiveInstituteId) {
            return res.status(400).json({
                success: false,
                error: 'Please select a specific campus branch to admit a branch/offline student, or select Online-Direct mode.',
            });
        }
        // Resolve franchise ownership
        let resolvedFranchiseId = req.franchiseId || data.franchiseId || null;
        let resolvedBranchFranchiseId = null;
        if (effectiveInstituteId) {
            const inst = await prisma_js_1.prisma.institute.findUnique({
                where: { id: effectiveInstituteId },
                select: { id: true, franchiseId: true },
            });
            if (!inst) {
                return res.status(404).json({ success: false, error: 'Selected campus branch not found' });
            }
            resolvedBranchFranchiseId = inst.franchiseId || null;
            if (!resolvedFranchiseId) {
                resolvedFranchiseId = resolvedBranchFranchiseId;
            }
            else if (resolvedBranchFranchiseId && resolvedFranchiseId !== resolvedBranchFranchiseId) {
                return res.status(403).json({ success: false, error: 'Forbidden: Selected branch belongs to a different franchise' });
            }
        }
        else if (!resolvedFranchiseId && rawInstHeader && rawInstHeader !== 'ALL' && rawInstHeader !== 'all') {
            const inst = await prisma_js_1.prisma.institute.findUnique({
                where: { id: rawInstHeader },
                select: { franchiseId: true },
            });
            resolvedFranchiseId = inst?.franchiseId || null;
        }
        if (isOnlineDirectRequest && !resolvedFranchiseId) {
            return res.status(400).json({
                success: false,
                error: 'Franchise context is required for Online Direct student admission',
            });
        }
        let parsedDob = null;
        if (data.dob) {
            parsedDob = new Date(data.dob);
        }
        let parsedAdmissionDate = new Date();
        if (data.admissionDate) {
            parsedAdmissionDate = new Date(data.admissionDate);
        }
        // Verify staff authorization for batch and subjects before proceeding
        if (req.user?.role === 'STAFF') {
            if (data.batchId) {
                const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, data.batchId, prisma_js_1.prisma);
                if (!isAssigned) {
                    return res.status(403).json({
                        success: false,
                        error: 'Forbidden: You are not authorized to admit students into this batch.',
                    });
                }
            }
            if (data.batchId && data.subjectIds && data.subjectIds.length > 0) {
                for (const sid of data.subjectIds) {
                    const isAssignedSub = await (0, student_authorization_service_js_1.isStaffAssignedToBatchSubject)(req, data.batchId, sid, prisma_js_1.prisma);
                    if (!isAssignedSub) {
                        return res.status(403).json({
                            success: false,
                            error: `Forbidden: You are not authorized to enroll students into subject '${sid}' in this batch.`,
                        });
                    }
                }
            }
        }
        // Validate optional Global LMS Course enrollment rules before entering write transaction
        let verifiedGlobalCourse = null;
        let effectiveLearningMode = isOnlineDirectRequest
            ? client_1.LearningMode.ONLINE
            : (data.learningMode === 'ONLINE' ? client_1.LearningMode.ONLINE : data.learningMode === 'OFFLINE' ? client_1.LearningMode.OFFLINE : (data.batchId ? client_1.LearningMode.OFFLINE : client_1.LearningMode.ONLINE));
        if (data.globalCourseId) {
            if (effectiveLearningMode === client_1.LearningMode.OFFLINE && (!effectiveInstituteId || !data.batchId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Class batch allocation is required when enrolling in Offline / Recorded LMS mode.',
                });
            }
            if (!resolvedFranchiseId) {
                return res.status(400).json({
                    success: false,
                    error: 'This campus branch must be linked to a franchise to enroll students in Global Courses.',
                });
            }
            const [globalCourse, franchiseSelection] = await Promise.all([
                prisma_js_1.prisma.globalCourse.findUnique({
                    where: { id: data.globalCourseId },
                    select: { id: true, title: true, slug: true, status: true, activeCurriculumVersionId: true },
                }),
                prisma_js_1.prisma.franchiseCourseSelection.findUnique({
                    where: {
                        franchiseId_courseId: {
                            franchiseId: resolvedFranchiseId,
                            courseId: data.globalCourseId,
                        },
                    },
                    select: { isPermitted: true, isEnabled: true },
                }),
            ]);
            if (!globalCourse || globalCourse.status !== client_1.CourseStatus.PUBLISHED || !globalCourse.activeCurriculumVersionId) {
                return res.status(400).json({
                    success: false,
                    error: 'Selected Global Course is not published or has no active curriculum version.',
                });
            }
            if (!franchiseSelection || !franchiseSelection.isPermitted) {
                return res.status(403).json({
                    success: false,
                    error: 'Selected Global Course is not permitted for this franchise by Super Admin.',
                });
            }
            if (!franchiseSelection.isEnabled) {
                return res.status(400).json({
                    success: false,
                    error: 'Selected Global Course is not enabled for this franchise. Enable it in Franchise Offerings first.',
                });
            }
            verifiedGlobalCourse = {
                id: globalCourse.id,
                title: globalCourse.title,
                slug: globalCourse.slug,
                activeCurriculumVersionId: globalCourse.activeCurriculumVersionId,
            };
        }
        // Check if likely existing student already exists in this institute or franchise
        const cleanPhone = data.studentPhone?.trim() || data.phone?.trim() || null;
        const cleanEmail = data.studentEmail?.trim().toLowerCase() || data.email?.trim().toLowerCase() || null;
        if (cleanPhone || cleanEmail) {
            const scopeMatch = effectiveInstituteId
                ? { instituteId: effectiveInstituteId }
                : { franchiseId: resolvedFranchiseId };
            const existingStudent = await prisma_js_1.prisma.student.findFirst({
                where: {
                    ...scopeMatch,
                    OR: [
                        ...(cleanPhone ? [{ phone: cleanPhone }] : []),
                        ...(cleanPhone ? [{ user: { phone: cleanPhone } }] : []),
                        ...(cleanEmail ? [{ user: { email: cleanEmail } }] : []),
                    ],
                },
                include: {
                    enrollments: {
                        where: { isActive: true },
                        include: { batch: true, subject: true },
                    },
                },
            });
            if (existingStudent) {
                const errorMsg = `A student profile already exists (${existingStudent.firstName} ${existingStudent.lastName}, Admission: ${existingStudent.admissionNumber}). Please use 'Enroll Existing Student' to enroll them without duplicating the account.`;
                return res.status(409).json({
                    success: false,
                    isExistingStudent: true,
                    error: errorMsg,
                    message: errorMsg,
                    existingStudent: {
                        id: existingStudent.id,
                        admissionNumber: existingStudent.admissionNumber,
                        firstName: existingStudent.firstName,
                        lastName: existingStudent.lastName,
                        phone: existingStudent.phone,
                        enrollments: existingStudent.enrollments.map((e) => ({
                            batchId: e.batchId,
                            batchName: e.batch?.name,
                            subjectId: e.subjectId,
                            subjectName: e.subject?.name,
                        })),
                    },
                });
            }
        }
        // Check globally unique student phone number
        if (cleanPhone) {
            const existingPhoneUser = await prisma_js_1.prisma.user.findUnique({
                where: { phone: cleanPhone },
            });
            if (existingPhoneUser) {
                return res.status(409).json({
                    success: false,
                    error: `Student phone number '${cleanPhone}' is already registered with another user (${existingPhoneUser.fullName}). Please use a different phone number.`,
                });
            }
        }
        // Check globally unique student email
        if (cleanEmail) {
            const existingEmailUser = await prisma_js_1.prisma.user.findUnique({
                where: { email: cleanEmail },
            });
            if (existingEmailUser) {
                return res.status(409).json({
                    success: false,
                    error: `Student email '${cleanEmail}' is already registered with another user (${existingEmailUser.fullName}). Please use a different email address.`,
                });
            }
        }
        // Check parent email if provided
        const cleanParentEmail = data.parentEmail?.trim().toLowerCase() || null;
        if (cleanParentEmail) {
            const existingParentUser = await prisma_js_1.prisma.user.findUnique({
                where: { email: cleanParentEmail },
            });
            if (existingParentUser && existingParentUser.role !== 'PARENT') {
                return res.status(409).json({
                    success: false,
                    error: `Parent email '${cleanParentEmail}' is registered to a ${existingParentUser.role.toLowerCase()} account (${existingParentUser.fullName}) and cannot be used as a parent account.`,
                });
            }
        }
        // Execute in transaction with safe retry handling for pooler concurrency and unique-constraint conflicts
        let result;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                result = await prisma_js_1.prisma.$transaction(async (tx) => {
                    // Generate atomic, concurrency-safe admission number (branch 7-char or franchise ON-online format)
                    const admissionInfo = effectiveInstituteId
                        ? await (0, admission_number_service_js_1.generateNextAdmissionNumber)(tx, effectiveInstituteId, data.batchId, parsedAdmissionDate)
                        : await (0, admission_number_service_js_1.generateNextOnlineAdmissionNumber)(tx, resolvedFranchiseId, parsedAdmissionDate);
                    const admissionNumber = admissionInfo.admissionNumber;
                    let studentUser = null;
                    let tempPassword = null;
                    if (data.createLoginAccount !== false) {
                        let cleanEmail = data.studentEmail?.trim().toLowerCase() || data.email?.trim().toLowerCase() || null;
                        let cleanPhone = data.studentPhone?.trim() || data.phone?.trim() || null;
                        const cleanParentPhone = data.parentPhone?.trim() || null;
                        const cleanParentEmail = data.parentEmail?.trim().toLowerCase() || null;
                        if (cleanPhone && cleanParentPhone && cleanPhone === cleanParentPhone) {
                            cleanPhone = null;
                        }
                        if (cleanEmail && cleanParentEmail && cleanEmail === cleanParentEmail) {
                            cleanEmail = null;
                        }
                        if (cleanEmail) {
                            const existing = await tx.user.findFirst({ where: { email: cleanEmail } });
                            if (existing) {
                                throw new Error(`Email '${cleanEmail}' is already registered to another account.`);
                            }
                        }
                        if (cleanPhone) {
                            const existing = await tx.user.findFirst({ where: { phone: cleanPhone } });
                            if (existing) {
                                throw new Error(`Phone number '${cleanPhone}' is already registered to another account.`);
                            }
                        }
                        tempPassword =
                            data.studentInitialPassword?.trim() ||
                                data.initialPassword?.trim() ||
                                `Student#${(0, security_js_1.generateSecureRandomToken)(4)}2026`;
                        const passwordHash = await (0, security_js_1.hashPassword)(tempPassword);
                        studentUser = await tx.user.create({
                            data: {
                                email: cleanEmail,
                                phone: cleanPhone,
                                fullName: `${data.firstName.trim()} ${data.lastName.trim()}`,
                                passwordHash,
                                role: 'STUDENT',
                                isActive: true,
                                mustChangePassword: false, // Staff-managed credentials
                            },
                        });
                        if (effectiveInstituteId) {
                            await tx.instituteMembership.create({
                                data: {
                                    instituteId: effectiveInstituteId,
                                    userId: studentUser.id,
                                    role: 'STUDENT',
                                    isActive: true,
                                },
                            });
                        }
                    }
                    // Create Student profile (populates both franchiseId and nullable instituteId)
                    const student = await tx.student.create({
                        data: {
                            instituteId: effectiveInstituteId,
                            franchiseId: resolvedFranchiseId,
                            userId: studentUser?.id || null,
                            admissionNumber,
                            firstName: data.firstName.trim(),
                            lastName: data.lastName.trim(),
                            phone: data.studentPhone?.trim() || (data.createLoginAccount ? data.phone?.trim() : null) || null,
                            dob: parsedDob,
                            gender: data.gender || null,
                            bloodGroup: data.bloodGroup?.trim() || null,
                            notes: data.notes?.trim() || null,
                            photoUrl: data.photoUrl?.trim() || null,
                            createdByUserId: req.user?.userId || null,
                            admissionDate: parsedAdmissionDate,
                            status: 'ACTIVE',
                        },
                    });
                    // Batch enrollment if provided (only for branch-linked students)
                    if (effectiveInstituteId && data.batchId) {
                        const batch = await tx.batch.findFirst({
                            where: { id: data.batchId, instituteId: effectiveInstituteId },
                        });
                        if (!batch) {
                            throw new Error('Selected batch does not belong to this institute');
                        }
                        await tx.studentEnrollment.create({
                            data: {
                                studentId: student.id,
                                batchId: data.batchId,
                                subjectId: null,
                                isActive: true,
                            },
                        });
                        if (data.subjectIds && data.subjectIds.length > 0) {
                            for (const sid of data.subjectIds) {
                                await tx.studentEnrollment.create({
                                    data: {
                                        studentId: student.id,
                                        batchId: data.batchId,
                                        subjectId: sid,
                                        isActive: true,
                                    },
                                });
                            }
                        }
                    }
                    // Global LMS Course Enrollment if selected during admission
                    let courseEnrollment = null;
                    if (verifiedGlobalCourse && resolvedFranchiseId) {
                        courseEnrollment = await tx.courseEnrollment.create({
                            data: {
                                studentId: student.id,
                                courseId: verifiedGlobalCourse.id,
                                curriculumVersionId: verifiedGlobalCourse.activeCurriculumVersionId,
                                franchiseId: resolvedFranchiseId,
                                instituteId: effectiveLearningMode === client_1.LearningMode.ONLINE ? null : effectiveInstituteId,
                                batchId: effectiveLearningMode === client_1.LearningMode.ONLINE ? null : (data.batchId || null),
                                mode: effectiveLearningMode,
                                status: client_1.EnrollmentStatus.ACTIVE,
                            },
                            include: {
                                course: { select: { id: true, title: true, slug: true } },
                            },
                        });
                    }
                    // Parent Account Creation & Linking (Requirement 3)
                    let parentUser = null;
                    let parentProfile = null;
                    let parentTempPassword = null;
                    let isExistingParentAccount = false;
                    if (data.parentFullName && data.parentPhone) {
                        const cleanParentPhone = data.parentPhone.trim();
                        const cleanParentEmail = data.parentEmail?.trim().toLowerCase() || null;
                        const existingUser = await tx.user.findFirst({
                            where: {
                                AND: [
                                    ...(studentUser ? [{ id: { not: studentUser.id } }] : []),
                                    {
                                        OR: [
                                            { phone: cleanParentPhone },
                                            ...(cleanParentEmail ? [{ email: cleanParentEmail }] : []),
                                        ],
                                    },
                                ],
                            },
                            include: { parentProfile: true },
                        });
                        if (existingUser) {
                            if (existingUser.role === 'STUDENT' && !existingUser.parentProfile) {
                                throw new Error(`Phone or email is registered to a student account and cannot be linked as a parent.`);
                            }
                            parentUser = existingUser;
                            isExistingParentAccount = true;
                            parentTempPassword = null;
                            if (existingUser.parentProfile) {
                                parentProfile = existingUser.parentProfile;
                            }
                            else {
                                parentProfile = await tx.parentProfile.create({
                                    data: { userId: existingUser.id },
                                });
                            }
                            if (effectiveInstituteId) {
                                const existingMembership = await tx.instituteMembership.findUnique({
                                    where: {
                                        instituteId_userId: {
                                            instituteId: effectiveInstituteId,
                                            userId: existingUser.id,
                                        },
                                    },
                                });
                                if (!existingMembership) {
                                    await tx.instituteMembership.create({
                                        data: {
                                            instituteId: effectiveInstituteId,
                                            userId: existingUser.id,
                                            role: 'PARENT',
                                            isActive: true,
                                        },
                                    });
                                }
                            }
                        }
                        else {
                            isExistingParentAccount = false;
                            parentTempPassword = data.parentInitialPassword?.trim() || `Parent#${(0, security_js_1.generateSecureRandomToken)(4)}2026`;
                            const parentPasswordHash = await (0, security_js_1.hashPassword)(parentTempPassword);
                            parentUser = await tx.user.create({
                                data: {
                                    fullName: data.parentFullName.trim(),
                                    phone: cleanParentPhone,
                                    email: cleanParentEmail,
                                    passwordHash: parentPasswordHash,
                                    role: 'PARENT',
                                    isActive: true,
                                    mustChangePassword: false,
                                },
                            });
                            if (effectiveInstituteId) {
                                await tx.instituteMembership.create({
                                    data: {
                                        instituteId: effectiveInstituteId,
                                        userId: parentUser.id,
                                        role: 'PARENT',
                                        isActive: true,
                                    },
                                });
                            }
                            parentProfile = await tx.parentProfile.create({
                                data: {
                                    userId: parentUser.id,
                                    isPhoneVerified: true,
                                },
                            });
                        }
                        await tx.studentParentRelation.upsert({
                            where: {
                                studentId_parentId: {
                                    studentId: student.id,
                                    parentId: parentProfile.id,
                                },
                            },
                            create: {
                                studentId: student.id,
                                parentId: parentProfile.id,
                                relation: data.parentRelationship || 'GUARDIAN',
                                isPrimaryContact: true,
                                canReceiveSms: data.parentCanReceiveSms ?? true,
                            },
                            update: {
                                relation: data.parentRelationship || 'GUARDIAN',
                                isPrimaryContact: true,
                                canReceiveSms: data.parentCanReceiveSms ?? true,
                            },
                        });
                    }
                    // Store initial generated credentials into student.notes
                    const initialCredNotes = {};
                    if (data.notes?.trim()) {
                        initialCredNotes.userNotes = data.notes.trim();
                    }
                    if (tempPassword) {
                        initialCredNotes.studentPassword = tempPassword;
                    }
                    if (parentTempPassword) {
                        initialCredNotes.parentPassword = parentTempPassword;
                    }
                    if (Object.keys(initialCredNotes).length > 0) {
                        const notesJson = JSON.stringify(initialCredNotes);
                        await tx.student.update({
                            where: { id: student.id },
                            data: { notes: notesJson },
                        });
                        student.notes = notesJson;
                    }
                    // Record Audit Log (supports nullable instituteId for online-direct students)
                    await tx.auditLog.create({
                        data: {
                            instituteId: effectiveInstituteId,
                            userId: req.user?.userId || null,
                            action: 'STUDENT_ADMITTED',
                            entityType: 'Student',
                            entityId: student.id,
                            newValues: {
                                admissionNumber: student.admissionNumber,
                                name: `${student.firstName} ${student.lastName}`,
                                franchiseId: resolvedFranchiseId,
                                instituteId: effectiveInstituteId,
                                batchId: data.batchId || null,
                                globalCourseId: verifiedGlobalCourse?.id || null,
                                learningMode: courseEnrollment ? effectiveLearningMode : (isOnlineDirectRequest ? 'ONLINE' : 'OFFLINE'),
                                hasParentAccount: !!parentUser,
                                isExistingParentAccount,
                            },
                        },
                    });
                    return {
                        student,
                        studentUser,
                        tempPassword,
                        admissionInfo,
                        courseEnrollment,
                        parentUser,
                        parentProfile,
                        parentTempPassword,
                        isExistingParentAccount,
                    };
                }, {
                    maxWait: 15000,
                    timeout: 20000,
                });
                break;
            }
            catch (txErr) {
                if (attempt < 3 &&
                    (txErr.code === 'P2028' || txErr.code === 'P2034' || txErr.code === 'P2002')) {
                    await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
                    continue;
                }
                throw txErr;
            }
        }
        const studentIdentifier = result.studentUser?.email || result.studentUser?.phone || result.student.admissionNumber;
        const parentIdentifier = result.parentUser?.phone || result.parentUser?.email;
        return res.status(201).json({
            success: true,
            message: 'Student admitted successfully',
            data: {
                student: formatStudentResponse(result.student),
                admissionNumber: result.student.admissionNumber,
                admissionInfo: result.admissionInfo,
                courseEnrollment: result.courseEnrollment,
                studentCredentials: result.studentUser ? {
                    fullName: result.studentUser.fullName,
                    admissionNumber: result.student.admissionNumber,
                    identifier: studentIdentifier,
                    email: result.studentUser.email,
                    phone: result.studentUser.phone,
                    temporaryPassword: result.tempPassword,
                    mustChangePassword: false,
                } : null,
                parentCredentials: result.parentUser ? {
                    fullName: result.parentUser.fullName,
                    studentName: `${result.student.firstName} ${result.student.lastName}`,
                    identifier: parentIdentifier,
                    phone: result.parentUser.phone,
                    email: result.parentUser.email,
                    isExistingAccount: result.isExistingParentAccount,
                    temporaryPassword: result.parentTempPassword,
                    mustChangePassword: false,
                } : null,
                userAccount: result.studentUser ? {
                    id: result.studentUser.id,
                    email: result.studentUser.email,
                    phone: result.studentUser.phone,
                    temporaryPassword: result.tempPassword,
                } : null,
                parentAccount: result.parentUser ? {
                    id: result.parentUser.id,
                    fullName: result.parentUser.fullName,
                    phone: result.parentUser.phone,
                    email: result.parentUser.email,
                    temporaryPassword: result.parentTempPassword,
                    isExistingAccount: result.isExistingParentAccount,
                } : null,
            },
        });
    }
    catch (err) {
        console.error('[Admit Student Error]', err);
        if (err.code === 'P2002') {
            const target = String(Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : err.meta?.target || '');
            if (target.includes('phone')) {
                return res.status(409).json({
                    success: false,
                    error: `Phone number already exists in the system. Please use a different phone number.`,
                });
            }
            if (target.includes('email')) {
                return res.status(409).json({
                    success: false,
                    error: `Email address already exists in the system. Please use a different email address.`,
                });
            }
            if (target.includes('admissionNumber')) {
                return res.status(409).json({
                    success: false,
                    error: `A student with this admission number already exists in this institute.`,
                });
            }
            return res.status(409).json({
                success: false,
                error: `A record with this ${target || 'information'} already exists.`,
            });
        }
        if (err.message && (err.message.includes('already registered') || err.message.includes('already exists'))) {
            return res.status(409).json({ success: false, error: err.message });
        }
        if (err.message && (err.message.includes('batch does not belong') || err.message.includes('cannot be linked') || err.message.includes('registered to a student account'))) {
            return res.status(400).json({ success: false, error: err.message });
        }
        return res.status(500).json({ success: false, error: err.message || 'Failed to admit student' });
    }
}
/**
 * Get admission number prefix & preview pattern for the active institute (or Online Direct mode)
 */
async function getAdmissionPrefixInfo(req, res) {
    try {
        const instituteId = req.instituteId;
        const isOnlineDirect = req.query.onlineDirect === 'true';
        if (isOnlineDirect || (!instituteId && req.franchiseId)) {
            const currentYear = (0, admission_number_service_js_1.getAdmissionYear)(new Date());
            const yy = String(currentYear).slice(-2);
            return res.json({
                success: true,
                data: {
                    format: 'Franchise Online Direct [ON][YY][SERIAL 3]',
                    compactInstitute: 'ON',
                    batchCode: yy,
                    prefix: `ON${yy}`,
                    currentYear,
                    previewFormat: `ON${yy}###`,
                    example: `ON${yy}001`,
                    note: 'Auto-generated campus-independent Online Direct admission number',
                },
            });
        }
        if (!instituteId) {
            return res.status(400).json({ success: false, error: 'Institute context required' });
        }
        const batchId = req.query.batchId || undefined;
        const compactInst = await (0, admission_number_service_js_1.getOrSetCompactInstituteCode)(prisma_js_1.prisma, instituteId);
        let batchCode = '00';
        if (batchId) {
            const batch = await prisma_js_1.prisma.batch.findFirst({
                where: { id: batchId, instituteId },
            });
            if (batch) {
                const instituteBatches = await prisma_js_1.prisma.batch.findMany({
                    where: { instituteId },
                    orderBy: { createdAt: 'asc' },
                    select: { id: true },
                });
                const batchIndex = instituteBatches.findIndex((b) => b.id === batchId);
                batchCode = (0, admission_number_service_js_1.deriveBatchCode)(batch, Math.max(0, batchIndex));
            }
        }
        const currentYear = (0, admission_number_service_js_1.getAdmissionYear)(new Date());
        return res.json({
            success: true,
            data: {
                format: '7-character alphanumeric [INST 2][BATCH 2][SERIAL 3]',
                compactInstitute: compactInst,
                batchCode,
                prefix: compactInst,
                currentYear,
                previewFormat: `${compactInst}${batchCode}###`,
                example: `${compactInst}${batchCode}001`,
                note: 'Generated automatically by server upon admission',
            },
        });
    }
    catch (err) {
        console.error('[Get Admission Prefix Error]', err);
        return res.status(500).json({ success: false, error: err.message || 'Failed to get admission prefix' });
    }
}
/**
 * Get profile for currently logged-in student
 */
async function getMyStudentProfile(req, res) {
    try {
        if (!req.user || req.user.role !== 'STUDENT') {
            return res.status(403).json({ success: false, error: 'Only student accounts can access this profile' });
        }
        const student = await prisma_js_1.prisma.student.findFirst({
            where: {
                userId: req.user.userId,
            },
            include: {
                institute: {
                    select: { id: true, name: true, code: true, address: true, phone: true },
                },
                franchise: {
                    select: { id: true, name: true, code: true },
                },
                user: {
                    select: { id: true, email: true, xpPoints: true, level: true },
                },
                enrollments: {
                    where: { isActive: true },
                    include: {
                        batch: {
                            include: {
                                batchSubjects: {
                                    include: {
                                        subject: true,
                                        staffProfile: {
                                            include: {
                                                user: {
                                                    select: { id: true, fullName: true, email: true },
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        subject: true,
                    },
                },
                parentRelations: {
                    include: {
                        parent: {
                            include: {
                                user: {
                                    select: { id: true, fullName: true, phone: true, email: true },
                                },
                            },
                        },
                    },
                },
                attendanceEvents: {
                    take: 10,
                    orderBy: { eventTime: 'desc' },
                },
            },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'No student record associated with this account' });
        }
        return res.json({
            success: true,
            data: { student: formatStudentResponse(student) },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to fetch student profile' });
    }
}
/**
 * GET /api/students/my/dashboard
 * High-performance mobile aggregator endpoint for authenticated student.
 */
async function getMyStudentDashboard(req, res) {
    try {
        if (!req.user || req.user.role !== 'STUDENT') {
            return res.status(403).json({ success: false, error: 'Only student accounts can access this dashboard' });
        }
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { userId: req.user.userId },
            include: {
                institute: {
                    select: { id: true, name: true, code: true, address: true, phone: true },
                },
                enrollments: {
                    where: { isActive: true },
                    include: {
                        batch: {
                            include: {
                                batchSubjects: {
                                    where: { isActive: true },
                                    include: {
                                        subject: true,
                                        staffProfile: {
                                            include: {
                                                user: { select: { id: true, fullName: true, email: true } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        subject: true,
                    },
                },
            },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student record not found for this account' });
        }
        const primaryEnrollment = student.enrollments[0] || null;
        const activeBatch = primaryEnrollment?.batch || null;
        const enrolledBatchIds = Array.from(new Set(student.enrollments.map((e) => e.batchId).filter(Boolean)));
        // Concurrent single-pass queries for attendance, homework, materials, exams, and notifications
        const [allAttendanceEvents, homeworkList, submissions, recentMaterials, recentMarks, unreadNotifCount, recentNotifs,] = await Promise.all([
            // 1. Attendance events for this student
            prisma_js_1.prisma.attendanceEvent.findMany({
                where: { studentId: student.id },
                orderBy: [{ eventDate: 'desc' }, { eventTime: 'desc' }],
                take: 50,
                select: {
                    id: true,
                    eventType: true,
                    isLate: true,
                    eventDate: true,
                    eventTime: true,
                    remarks: true,
                    method: true,
                },
            }),
            // 2. Active homework assignments for enrolled batches
            enrolledBatchIds.length > 0
                ? prisma_js_1.prisma.learningMaterial.findMany({
                    where: {
                        type: 'HOMEWORK',
                        batchId: { in: enrolledBatchIds },
                        isPublished: true,
                    },
                    orderBy: { dueDate: 'asc' },
                    take: 10,
                    include: {
                        subject: { select: { id: true, name: true, code: true } },
                    },
                })
                : Promise.resolve([]),
            // 3. Submissions by this student
            prisma_js_1.prisma.homeworkSubmission.findMany({
                where: { studentId: student.id },
                select: {
                    materialId: true,
                    status: true,
                    submittedAt: true,
                    grade: true,
                    feedback: true,
                },
            }),
            // 4. Recent learning materials (non-homework)
            enrolledBatchIds.length > 0
                ? prisma_js_1.prisma.learningMaterial.findMany({
                    where: {
                        type: { not: 'HOMEWORK' },
                        batchId: { in: enrolledBatchIds },
                        isPublished: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    include: {
                        subject: { select: { id: true, name: true, code: true } },
                    },
                })
                : Promise.resolve([]),
            // 5. Recent exam marks
            prisma_js_1.prisma.examMark.findMany({
                where: { studentId: student.id },
                orderBy: { exam: { examDate: 'desc' } },
                take: 5,
                include: {
                    exam: {
                        select: {
                            id: true,
                            title: true,
                            examDate: true,
                            totalMarks: true,
                            passingMarks: true,
                            subject: { select: { id: true, name: true, code: true } },
                        },
                    },
                },
            }),
            // 6. Unread notifications count
            prisma_js_1.prisma.notification.count({
                where: { userId: req.user.userId, isRead: false },
            }),
            // 7. Recent notifications (last 5)
            prisma_js_1.prisma.notification.findMany({
                where: { userId: req.user.userId },
                orderBy: { createdAt: 'desc' },
                take: 5,
            }),
        ]);
        // Calculate attendance totals from check-ins
        const checkIns = allAttendanceEvents.filter((e) => e.eventType === 'CHECK_IN');
        const presentCount = checkIns.length;
        const lateCount = checkIns.filter((e) => e.isLate).length;
        const absentCount = 0;
        const totalAttendanceDays = presentCount;
        const attendancePercentage = totalAttendanceDays > 0 ? 100 : 0;
        const recentAttendance = allAttendanceEvents.slice(0, 5);
        // Map homework submission states
        const submissionMap = new Map();
        for (const sub of submissions) {
            submissionMap.set(sub.materialId, sub);
        }
        let pendingHomeworkCount = 0;
        let submittedHomeworkCount = 0;
        const mappedUpcomingHomework = homeworkList.map((hw) => {
            const sub = submissionMap.get(hw.id);
            const isSubmitted = !!sub;
            if (isSubmitted) {
                submittedHomeworkCount++;
            }
            else {
                pendingHomeworkCount++;
            }
            return {
                id: hw.id,
                title: hw.title,
                description: hw.description,
                subject: hw.subject?.name || 'General',
                dueDate: hw.dueDate,
                isSubmitted,
                submissionStatus: sub?.status || 'PENDING',
                grade: sub?.grade ?? null,
                feedback: sub?.feedback ?? null,
            };
        });
        // Resolve today's timetable
        const timetable = (0, timetable_resolver_js_1.resolveStructuredTimetable)(activeBatch);
        return res.json({
            success: true,
            data: {
                student: {
                    id: student.id,
                    admissionNumber: student.admissionNumber,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    fullName: `${student.firstName} ${student.lastName}`.trim(),
                    photoUrl: formatStudentResponse(student).photoUrl,
                    status: student.status,
                },
                institute: student.institute,
                batch: activeBatch
                    ? {
                        id: activeBatch.id,
                        name: activeBatch.name,
                        academicYear: activeBatch.academicYear,
                        rawSchedule: activeBatch.schedule,
                    }
                    : null,
                todayClasses: timetable.todaySlots,
                attendanceOverview: {
                    totalDays: totalAttendanceDays,
                    presentCount,
                    absentCount,
                    lateCount,
                    percentage: attendancePercentage,
                    recentEvents: recentAttendance,
                },
                homeworkOverview: {
                    totalCount: homeworkList.length,
                    pendingCount: pendingHomeworkCount,
                    submittedCount: submittedHomeworkCount,
                    upcoming: mappedUpcomingHomework.slice(0, 5),
                },
                recentMaterials: recentMaterials.map((m) => ({
                    id: m.id,
                    title: m.title,
                    description: m.description,
                    type: m.type,
                    fileSize: m.fileSize,
                    mimeType: m.mimeType,
                    subject: m.subject?.name || 'General',
                    createdAt: m.createdAt,
                })),
                academicProgress: {
                    recentMarks: recentMarks.map((rm) => ({
                        id: rm.id,
                        examTitle: rm.exam.title,
                        subjectName: rm.exam.subject?.name || 'Exam',
                        examDate: rm.exam.examDate,
                        marksObtained: Number(rm.marksObtained),
                        totalMarks: Number(rm.exam.totalMarks),
                        passingMarks: Number(rm.exam.passingMarks),
                        isAbsent: rm.isAbsent,
                        remarks: rm.remarks,
                    })),
                },
                notificationsOverview: {
                    unreadCount: unreadNotifCount,
                    recent: recentNotifs,
                },
            },
        });
    }
    catch (err) {
        console.error('[Student Dashboard Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to aggregate student dashboard data' });
    }
}
/**
 * GET /api/students/my/timetable
 * Structured day-by-day timetable for authenticated student.
 */
async function getMyStudentTimetable(req, res) {
    try {
        if (!req.user || req.user.role !== 'STUDENT') {
            return res.status(403).json({ success: false, error: 'Only student accounts can access this timetable' });
        }
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { userId: req.user.userId },
            include: {
                enrollments: {
                    where: { isActive: true },
                    include: {
                        batch: {
                            include: {
                                batchSubjects: {
                                    where: { isActive: true },
                                    include: {
                                        subject: true,
                                        staffProfile: {
                                            include: {
                                                user: { select: { id: true, fullName: true, email: true } },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student record not found for this account' });
        }
        const activeBatch = student.enrollments[0]?.batch || null;
        const timetable = (0, timetable_resolver_js_1.resolveStructuredTimetable)(activeBatch);
        return res.json({
            success: true,
            data: {
                timetable,
            },
        });
    }
    catch (err) {
        console.error('[Student Timetable Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve structured student timetable' });
    }
}
/**
 * GET /api/students/my/attendance-history
 * Complete date-wise attendance events and statistics for authenticated student.
 */
async function getMyStudentAttendanceHistory(req, res) {
    try {
        if (!req.user || req.user.role !== 'STUDENT') {
            return res.status(403).json({ success: false, error: 'Only student accounts can access attendance history' });
        }
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { userId: req.user.userId },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student record not found for this account' });
        }
        const events = await prisma_js_1.prisma.attendanceEvent.findMany({
            where: { studentId: student.id },
            orderBy: [{ eventDate: 'desc' }, { eventTime: 'desc' }],
            take: 100,
            select: {
                id: true,
                eventType: true,
                eventDate: true,
                eventTime: true,
                sessionNumber: true,
                method: true,
                isLate: true,
                remarks: true,
                batch: {
                    select: { id: true, name: true },
                },
            },
        });
        const checkIns = events.filter((e) => e.eventType === 'CHECK_IN');
        const presentDays = checkIns.length;
        const lateDays = checkIns.filter((e) => e.isLate).length;
        const absentDays = 0;
        const totalDays = presentDays;
        const percentage = totalDays > 0 ? 100 : 0;
        return res.json({
            success: true,
            data: {
                stats: {
                    totalDays,
                    presentDays,
                    absentDays,
                    lateDays,
                    percentage,
                },
                events,
            },
        });
    }
    catch (err) {
        console.error('[Student Attendance History Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch attendance history' });
    }
}
/**
 * Get student details by ID
 */
async function getStudentById(req, res) {
    try {
        const { id } = req.params;
        // Enforce strict staff-to-student and role-based data isolation (supports branch & online-direct students)
        const authorized = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, id, prisma_js_1.prisma);
        if (!authorized) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: You are not authorized to view this student record',
            });
        }
        const student = await prisma_js_1.prisma.student.findUnique({
            where: { id },
            include: {
                createdByUser: {
                    select: { id: true, fullName: true, role: true },
                },
                institute: {
                    select: { id: true, name: true, code: true, phone: true, email: true },
                },
                franchise: {
                    select: { id: true, name: true, code: true },
                },
                courseEnrollments: {
                    orderBy: { enrolledAt: 'desc' },
                    include: {
                        course: { select: { id: true, title: true, slug: true } },
                        batch: { select: { id: true, name: true } },
                        institute: { select: { id: true, name: true, code: true } },
                    },
                },
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        role: true,
                        isActive: true,
                        mustChangePassword: true,
                        createdAt: true,
                        lastLoginAt: true,
                    },
                },
                enrollments: {
                    where: { isActive: true },
                    include: {
                        batch: true,
                        subject: true,
                    },
                },
                parentRelations: {
                    include: {
                        parent: {
                            include: {
                                user: {
                                    select: {
                                        id: true,
                                        fullName: true,
                                        phone: true,
                                        email: true,
                                        role: true,
                                        isActive: true,
                                        mustChangePassword: true,
                                        createdAt: true,
                                        lastLoginAt: true,
                                    },
                                },
                                studentRelations: {
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
                                },
                            },
                        },
                    },
                },
                attendanceEvents: {
                    take: 10,
                    orderBy: { eventTime: 'desc' },
                    select: { id: true, eventTime: true, eventType: true, isLate: true, remarks: true },
                },
                feeAssignments: {
                    include: { feeStructure: true },
                },
                _count: {
                    select: {
                        attendanceEvents: true,
                        examMarks: true,
                        feeAssignments: true,
                    },
                },
            },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found in this institute' });
        }
        let formattedStudent = formatStudentResponse(student);
        if (req.user?.role === 'STAFF') {
            const assignments = await (0, student_authorization_service_js_1.getAuthorizedStaffAssignments)(req, prisma_js_1.prisma);
            const authorizedBatchIds = assignments.authorizedBatchIds || [];
            formattedStudent = {
                ...formattedStudent,
                enrollments: (formattedStudent.enrollments || []).filter((e) => !e.batchId || authorizedBatchIds.includes(e.batchId)),
            };
        }
        return res.json({
            success: true,
            data: { student: formattedStudent },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to fetch student details' });
    }
}
/**
 * Update student profile
 */
async function updateStudent(req, res) {
    try {
        const { id } = req.params;
        const parse = exports.updateStudentSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message,
            });
        }
        const authorized = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, id, prisma_js_1.prisma);
        if (!authorized) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: You are not authorized to update this student',
            });
        }
        const existing = await prisma_js_1.prisma.student.findUnique({
            where: { id },
            include: {
                user: true,
                parentRelations: {
                    include: {
                        parent: {
                            include: { user: true },
                        },
                    },
                },
            },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Student not found' });
        }
        const auditInstituteId = existing.instituteId || req.instituteId || null;
        const data = parse.data;
        // Staff cannot assign batches that are not assigned to them
        if (req.user?.role === 'STAFF' && data.batchId) {
            const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, data.batchId, prisma_js_1.prisma);
            if (!isAssigned) {
                return res.status(403).json({
                    success: false,
                    error: 'Forbidden: You are not authorized to assign this batch.',
                });
            }
        }
        const updateData = {};
        if (data.firstName)
            updateData.firstName = data.firstName.trim();
        if (data.lastName)
            updateData.lastName = data.lastName.trim();
        if (data.studentPhone !== undefined)
            updateData.phone = data.studentPhone?.trim() || null;
        if (data.gender !== undefined)
            updateData.gender = data.gender;
        if (data.bloodGroup !== undefined)
            updateData.bloodGroup = data.bloodGroup?.trim() || null;
        if (data.photoUrl !== undefined)
            updateData.photoUrl = data.photoUrl?.trim() || null;
        if (data.dob !== undefined) {
            updateData.dob = data.dob && data.dob.trim() ? new Date(data.dob) : null;
        }
        if (data.notes !== undefined) {
            if (existing.notes && existing.notes.startsWith('{') && (existing.notes.includes('studentPassword') || existing.notes.includes('parentPassword'))) {
                try {
                    const parsed = JSON.parse(existing.notes);
                    parsed.userNotes = data.notes?.trim() || null;
                    updateData.notes = JSON.stringify(parsed);
                }
                catch {
                    updateData.notes = data.notes?.trim() || null;
                }
            }
            else {
                updateData.notes = data.notes?.trim() || null;
            }
        }
        await prisma_js_1.prisma.$transaction(async (tx) => {
            // 1. Update Student Table
            await tx.student.update({
                where: { id },
                data: updateData,
            });
            // 2. Update Student User Account (if exists)
            if (existing.userId) {
                const userUpdate = {};
                if (data.firstName || data.lastName) {
                    const newFirst = data.firstName ? data.firstName.trim() : existing.firstName;
                    const newLast = data.lastName ? data.lastName.trim() : existing.lastName;
                    userUpdate.fullName = `${newFirst} ${newLast}`;
                }
                if (data.studentPhone !== undefined) {
                    userUpdate.phone = data.studentPhone?.trim() || null;
                }
                if (data.studentEmail !== undefined) {
                    userUpdate.email = data.studentEmail?.trim().toLowerCase() || null;
                }
                if (Object.keys(userUpdate).length > 0) {
                    await tx.user.update({
                        where: { id: existing.userId },
                        data: userUpdate,
                    });
                }
            }
            // 3. Update Batch & Subjects if specified (strictly scoped to this batchId, preserving other batches)
            if (data.batchId !== undefined) {
                if (data.batchId) {
                    await tx.studentEnrollment.updateMany({
                        where: { studentId: id, batchId: data.batchId, isActive: true },
                        data: { isActive: false },
                    });
                    await tx.studentEnrollment.create({
                        data: {
                            studentId: id,
                            batchId: data.batchId,
                            subjectId: null,
                            isActive: true,
                        },
                    });
                    if (Array.isArray(data.subjectIds) && data.subjectIds.length > 0) {
                        for (const sid of data.subjectIds) {
                            await tx.studentEnrollment.create({
                                data: {
                                    studentId: id,
                                    batchId: data.batchId,
                                    subjectId: sid,
                                    isActive: true,
                                },
                            });
                        }
                    }
                }
            }
            // 4. Update Parent Relation & Parent User Account if specified
            if (data.parentFullName || data.parentPhone || data.parentEmail !== undefined || data.parentRelationship) {
                const primaryRel = existing.parentRelations?.[0];
                if (primaryRel) {
                    if (data.parentRelationship) {
                        await tx.studentParentRelation.update({
                            where: { id: primaryRel.id },
                            data: { relation: data.parentRelationship },
                        });
                    }
                    if (primaryRel.parent?.user) {
                        const parentUserUpdate = {};
                        if (data.parentFullName)
                            parentUserUpdate.fullName = data.parentFullName.trim();
                        if (data.parentPhone)
                            parentUserUpdate.phone = data.parentPhone.trim();
                        if (data.parentEmail !== undefined)
                            parentUserUpdate.email = data.parentEmail?.trim().toLowerCase() || null;
                        if (Object.keys(parentUserUpdate).length > 0) {
                            await tx.user.update({
                                where: { id: primaryRel.parent.user.id },
                                data: parentUserUpdate,
                            });
                        }
                    }
                }
            }
            // 5. Record Audit Log
            await tx.auditLog.create({
                data: {
                    instituteId: auditInstituteId,
                    userId: req.user?.userId || null,
                    action: 'STUDENT_UPDATED',
                    entityType: 'Student',
                    entityId: id,
                    oldValues: existing,
                    newValues: { ...updateData, batchId: data.batchId, subjectIds: data.subjectIds },
                },
            });
        });
        const fullUpdated = await prisma_js_1.prisma.student.findUnique({
            where: { id },
            include: {
                user: true,
                institute: { select: { id: true, name: true, code: true } },
                franchise: { select: { id: true, name: true, code: true } },
                enrollments: {
                    where: { isActive: true },
                    include: { batch: true, subject: true },
                },
                courseEnrollments: {
                    where: { status: { in: [client_1.EnrollmentStatus.ACTIVE, client_1.EnrollmentStatus.COMPLETED] } },
                    include: { course: { select: { id: true, title: true, slug: true } } },
                },
                parentRelations: {
                    include: {
                        parent: {
                            include: { user: true },
                        },
                    },
                },
            },
        });
        return res.json({
            success: true,
            message: 'Student profile updated successfully',
            data: { student: formatStudentResponse(fullUpdated || existing) },
        });
    }
    catch (err) {
        console.error('Error updating student profile:', err);
        return res.status(500).json({ success: false, error: err.message || 'Failed to update student profile' });
    }
}
/**
 * Reset student login password (Staff / Academic Admin only)
 */
async function resetStudentPassword(req, res) {
    try {
        const { id } = req.params;
        const parse = exports.resetStudentPasswordSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message || 'Invalid input' });
        }
        const authorized = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, id, prisma_js_1.prisma);
        if (!authorized) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: You are not authorized to reset credentials for this student',
            });
        }
        const student = await prisma_js_1.prisma.student.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found' });
        }
        const targetInstituteId = student.instituteId || req.instituteId || null;
        let targetUserId = student.userId;
        const temporaryPassword = parse.data?.password?.trim() ||
            parse.data?.newPassword?.trim() ||
            `Student#${(0, security_js_1.generateSecureRandomToken)(4)}2026`;
        const passwordHash = await (0, security_js_1.hashPassword)(temporaryPassword);
        if (!targetUserId) {
            // Create student user account if it did not exist
            const studentUser = await prisma_js_1.prisma.user.create({
                data: {
                    fullName: `${student.firstName} ${student.lastName}`,
                    phone: student.phone || null,
                    passwordHash,
                    role: 'STUDENT',
                    isActive: true,
                    mustChangePassword: false,
                },
            });
            if (targetInstituteId) {
                await prisma_js_1.prisma.instituteMembership.create({
                    data: {
                        instituteId: targetInstituteId,
                        userId: studentUser.id,
                        role: 'STUDENT',
                        isActive: true,
                    },
                });
            }
            await prisma_js_1.prisma.student.update({
                where: { id: student.id },
                data: { userId: studentUser.id },
            });
            targetUserId = studentUser.id;
        }
        else {
            await prisma_js_1.prisma.user.update({
                where: { id: targetUserId },
                data: {
                    passwordHash,
                    mustChangePassword: false,
                },
            });
        }
        // Invalidate any password reset tokens
        await prisma_js_1.prisma.passwordResetToken.deleteMany({
            where: { userId: targetUserId },
        });
        // Update credentialNotes in student.notes
        let credentialNotes = {};
        if (student.notes && student.notes.startsWith('{')) {
            try {
                credentialNotes = JSON.parse(student.notes);
            }
            catch { }
        }
        else if (student.notes) {
            credentialNotes.userNotes = student.notes;
        }
        credentialNotes.studentPassword = temporaryPassword;
        await prisma_js_1.prisma.student.update({
            where: { id: student.id },
            data: { notes: JSON.stringify(credentialNotes) },
        });
        // Record audit log
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId: targetInstituteId,
                userId: req.user?.userId || null,
                action: 'STUDENT_PASSWORD_RESET',
                entityType: 'Student',
                entityId: student.id,
                newValues: {
                    studentId: student.id,
                    userId: targetUserId,
                    resetBy: req.user?.userId,
                },
            },
        });
        return res.json({
            success: true,
            message: 'Student password reset successfully',
            data: {
                temporaryPassword,
                permanentPassword: temporaryPassword,
                mustChangePassword: false,
            },
        });
    }
    catch (err) {
        console.error('[Reset Student Password Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to reset student password' });
    }
}
/**
 * Update student login identifier (email/phone)
 */
async function updateStudentLoginIdentifier(req, res) {
    try {
        const { id } = req.params;
        const parse = exports.updateStudentIdentifierSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message || 'Invalid input' });
        }
        const authorized = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, id, prisma_js_1.prisma);
        if (!authorized) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: You are not authorized to update credentials for this student',
            });
        }
        const student = await prisma_js_1.prisma.student.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found' });
        }
        const auditInstId = student.instituteId || req.instituteId || null;
        const cleanEmail = parse.data.email !== undefined ? (parse.data.email.trim().toLowerCase() || null) : undefined;
        const cleanPhone = parse.data.phone !== undefined ? (parse.data.phone.trim() || null) : undefined;
        // Check duplicate email
        if (cleanEmail) {
            const existingEmail = await prisma_js_1.prisma.user.findFirst({
                where: { email: cleanEmail, id: { not: student.userId || undefined } },
            });
            if (existingEmail) {
                return res.status(409).json({ success: false, error: `Email '${cleanEmail}' is already in use by another account` });
            }
        }
        // Check duplicate phone
        if (cleanPhone) {
            const existingPhone = await prisma_js_1.prisma.user.findFirst({
                where: { phone: cleanPhone, id: { not: student.userId || undefined } },
            });
            if (existingPhone) {
                return res.status(409).json({ success: false, error: `Phone '${cleanPhone}' is already in use by another account` });
            }
        }
        await prisma_js_1.prisma.$transaction(async (tx) => {
            if (student.userId) {
                await tx.user.update({
                    where: { id: student.userId },
                    data: {
                        ...(cleanEmail !== undefined ? { email: cleanEmail } : {}),
                        ...(cleanPhone !== undefined ? { phone: cleanPhone } : {}),
                    },
                });
            }
            if (cleanPhone !== undefined) {
                await tx.student.update({
                    where: { id: student.id },
                    data: { phone: cleanPhone },
                });
            }
            await tx.auditLog.create({
                data: {
                    instituteId: auditInstId,
                    userId: req.user?.userId || null,
                    action: 'STUDENT_IDENTIFIER_UPDATED',
                    entityType: 'Student',
                    entityId: student.id,
                    newValues: {
                        email: cleanEmail,
                        phone: cleanPhone,
                    },
                },
            });
        });
        return res.json({
            success: true,
            message: 'Student login credentials updated successfully',
        });
    }
    catch (err) {
        console.error('[Update Student Identifier Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to update student identifier' });
    }
}
/**
 * Update Student Status (ACTIVE, PASSED_OUT, DISCONTINUED)
 */
async function updateStudentStatus(req, res) {
    try {
        const { id } = req.params;
        const parse = exports.updateStudentStatusSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message,
            });
        }
        const { status, reason } = parse.data;
        const authorized = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, id, prisma_js_1.prisma);
        if (!authorized) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: You are not authorized to update status for this student',
            });
        }
        const existing = await prisma_js_1.prisma.student.findUnique({
            where: { id },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Student not found' });
        }
        const auditInstId = existing.instituteId || req.instituteId || null;
        const updated = await prisma_js_1.prisma.$transaction(async (tx) => {
            const student = await tx.student.update({
                where: { id },
                data: { status },
            });
            // Deactivate active batch enrollments if student is passing out or discontinued
            if (status === 'PASSED_OUT' || status === 'DISCONTINUED') {
                await tx.studentEnrollment.updateMany({
                    where: { studentId: id, isActive: true },
                    data: { isActive: false },
                });
            }
            // Record Audit Log
            await tx.auditLog.create({
                data: {
                    instituteId: auditInstId,
                    userId: req.user?.userId || null,
                    action: 'STUDENT_STATUS_CHANGED',
                    entityType: 'Student',
                    entityId: id,
                    oldValues: { status: existing.status },
                    newValues: { status, reason: reason || 'Status updated by authorized staff' },
                },
            });
            return student;
        });
        return res.json({
            success: true,
            message: `Student status updated to ${status}`,
            data: { student: updated },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to update student status' });
    }
}
/**
 * Upload student photograph (for an existing student or direct admission upload)
 */
async function uploadStudentPhoto(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No photograph file was uploaded' });
        }
        // Server-side validation for file type and size (5MB max)
        const allowedPhotoMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedPhotoMimes.includes(req.file.mimetype)) {
            return res.status(400).json({ success: false, error: `Invalid photograph type: ${req.file.mimetype}. Allowed types: JPEG, PNG, WebP.` });
        }
        if (req.file.size > 5 * 1024 * 1024) {
            return res.status(400).json({ success: false, error: 'Photo file size exceeds maximum limit of 5MB' });
        }
        const relativeKey = (0, storage_js_1.getRelativeStorageKey)(instituteId, req.file.filename);
        if (id && id !== 'admission') {
            const authorized = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, id, prisma_js_1.prisma);
            if (!authorized) {
                return res.status(403).json({ success: false, error: 'Forbidden: Not authorized to update this student photograph' });
            }
            const updatedStudent = await prisma_js_1.prisma.student.update({
                where: { id },
                data: { photoUrl: relativeKey },
            });
            return res.json({
                success: true,
                message: 'Student photograph uploaded successfully',
                data: {
                    photoStorageKey: relativeKey,
                    photoUrl: `/api/students/${id}/photo?v=${new Date(updatedStudent.updatedAt).getTime()}`,
                },
            });
        }
        // Direct pre-admission upload
        return res.json({
            success: true,
            message: 'Photograph uploaded for admission form',
            data: {
                photoStorageKey: relativeKey,
                photoUrl: `/api/students/photo-raw/${encodeURIComponent(relativeKey)}`,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to upload student photograph' });
    }
}
/**
 * Get student photograph with authorized access control
 */
async function getStudentPhoto(req, res) {
    try {
        const targetInstituteId = req.instituteId || req.query.instituteId;
        const { id } = req.params;
        const authorized = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, id, prisma_js_1.prisma);
        if (!authorized) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to view this student photograph' });
        }
        const student = await prisma_js_1.prisma.student.findUnique({
            where: { id },
            select: { photoUrl: true, instituteId: true },
        });
        if (!student || !student.photoUrl) {
            return res.status(404).json({ success: false, error: 'No photograph on file for this student' });
        }
        if (targetInstituteId && student.instituteId !== targetInstituteId && req.user?.role !== 'SUPER_ADMIN') {
            return res.status(403).json({ success: false, error: 'Forbidden: Cross-institute photograph access rejected' });
        }
        if (student.photoUrl.startsWith('http://') || student.photoUrl.startsWith('https://')) {
            return res.redirect(student.photoUrl);
        }
        const absPath = (0, storage_js_1.resolveAbsolutePath)(student.photoUrl);
        if (!absPath || !fs_1.default.existsSync(absPath)) {
            return res.status(404).json({ success: false, error: 'Photograph file not found on server' });
        }
        const ext = path_1.default.extname(absPath).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
        };
        res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
        res.setHeader('Cache-Control', 'no-cache, private');
        return fs_1.default.createReadStream(absPath).pipe(res);
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to stream student photograph' });
    }
}
/**
 * Stream photograph by storage key (tenant verified)
 */
async function getRawPhoto(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const rawKey = decodeURIComponent(req.params.key);
        const key = rawKey.startsWith(`${instituteId}/`) ? rawKey : `${instituteId}/${rawKey}`;
        if (!key.startsWith(`${instituteId}/`)) {
            return res.status(403).json({ success: false, error: 'Forbidden: Cross-institute photograph access rejected' });
        }
        const absPath = (0, storage_js_1.resolveAbsolutePath)(key);
        if (!absPath || !fs_1.default.existsSync(absPath)) {
            return res.status(404).json({ success: false, error: 'Photograph file not found' });
        }
        const ext = path_1.default.extname(absPath).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
        };
        res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
        return fs_1.default.createReadStream(absPath).pipe(res);
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to stream photograph' });
    }
}
/**
 * Activate or deactivate a student login account
 */
async function updateStudentAccountStatus(req, res) {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ success: false, error: 'isActive boolean flag is required' });
        }
        const authorized = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, id, prisma_js_1.prisma);
        if (!authorized) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: You are not authorized to update account status for this student',
            });
        }
        const student = await prisma_js_1.prisma.student.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!student || !student.userId) {
            return res.status(404).json({ success: false, error: 'Student login account not found' });
        }
        await prisma_js_1.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: student.userId },
                data: { isActive },
            });
            if (student.instituteId) {
                await tx.instituteMembership.updateMany({
                    where: { instituteId: student.instituteId, userId: student.userId },
                    data: { isActive },
                });
            }
            await tx.auditLog.create({
                data: {
                    instituteId: student.instituteId || req.instituteId || null,
                    userId: req.user?.userId || null,
                    action: 'STUDENT_ACCOUNT_STATUS_CHANGED',
                    entityType: 'User',
                    entityId: student.userId,
                    newValues: { isActive, studentId: student.id },
                },
            });
        });
        return res.json({
            success: true,
            message: `Student account has been ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: { isActive },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to update student account status' });
    }
}
/**
 * Real-time parent account lookup by phone or email for sibling auto-linking during admission
 */
async function lookupParent(req, res) {
    try {
        const query = (req.query.query || req.query.phone || req.query.email || '').trim();
        if (!query || query.length < 3) {
            return res.json({ success: true, data: { found: false } });
        }
        const cleanQuery = query.toLowerCase();
        const existingUser = await prisma_js_1.prisma.user.findFirst({
            where: {
                OR: [
                    { phone: { equals: query, mode: 'insensitive' } },
                    { email: { equals: cleanQuery, mode: 'insensitive' } },
                ],
            },
            include: {
                parentProfile: {
                    include: {
                        studentRelations: {
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
                        },
                    },
                },
            },
        });
        if (!existingUser) {
            return res.json({ success: true, data: { found: false } });
        }
        if (existingUser.role === 'STUDENT' && !existingUser.parentProfile) {
            return res.json({
                success: true,
                data: {
                    found: true,
                    isStudent: true,
                    message: 'Phone or email is registered to a student account and cannot be linked as a parent.',
                },
            });
        }
        const children = (existingUser.parentProfile?.studentRelations || []).map((r) => ({
            name: `${r.student.firstName} ${r.student.lastName}`,
            admissionNumber: r.student.admissionNumber,
            relation: r.relation,
        }));
        return res.json({
            success: true,
            data: {
                found: true,
                isStudent: false,
                user: {
                    id: existingUser.id,
                    fullName: existingUser.fullName,
                    phone: existingUser.phone,
                    email: existingUser.email,
                    role: existingUser.role,
                },
                children,
            },
        });
    }
    catch (err) {
        console.error('Error looking up parent:', err);
        return res.status(500).json({ success: false, error: 'Failed to lookup parent' });
    }
}
/**
 * Assign or update student batch and subject allocations
 */
async function assignStudentBatch(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id } = req.params;
        const { batchId, subjectIds = [] } = req.body;
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { id, instituteId },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found in this institute' });
        }
        if (student.status !== 'ACTIVE') {
            return res.status(400).json({ success: false, error: `Cannot assign batch to student in ${student.status} status` });
        }
        // Staff authorization check
        if (req.user?.role === 'STAFF') {
            const authorized = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, id, prisma_js_1.prisma);
            if (!authorized) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to manage this student' });
            }
            if (batchId) {
                const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, batchId, prisma_js_1.prisma);
                if (!isAssigned) {
                    return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized for this batch' });
                }
            }
            if (batchId && Array.isArray(subjectIds) && subjectIds.length > 0) {
                for (const sid of subjectIds) {
                    const isAssignedSub = await (0, student_authorization_service_js_1.isStaffAssignedToBatchSubject)(req, batchId, sid, prisma_js_1.prisma);
                    if (!isAssignedSub) {
                        return res.status(403).json({ success: false, error: `Forbidden: You are not authorized for subject '${sid}' in this batch` });
                    }
                }
            }
        }
        // Verify batch if provided
        let batch = null;
        if (batchId) {
            batch = await prisma_js_1.prisma.batch.findFirst({
                where: { id: batchId, instituteId },
                include: {
                    batchSubjects: {
                        include: { subject: true },
                    },
                },
            });
            if (!batch) {
                return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
            }
        }
        await prisma_js_1.prisma.$transaction(async (tx) => {
            if (batchId) {
                // Deactivate existing active enrollments for this specific batch only, preserving other batches!
                await tx.studentEnrollment.updateMany({
                    where: { studentId: id, batchId, isActive: true },
                    data: { isActive: false },
                });
                // 2. Create primary batch enrollment
                await tx.studentEnrollment.create({
                    data: {
                        studentId: id,
                        batchId,
                        subjectId: null,
                        isActive: true,
                    },
                });
                // 3. Create subject enrollments for specified subjectIds
                if (Array.isArray(subjectIds) && subjectIds.length > 0) {
                    const validSubjectIds = (batch?.batchSubjects || []).map((bs) => bs.subjectId);
                    for (const sid of subjectIds) {
                        if (validSubjectIds.includes(sid)) {
                            await tx.studentEnrollment.create({
                                data: {
                                    studentId: id,
                                    batchId,
                                    subjectId: sid,
                                    isActive: true,
                                },
                            });
                        }
                    }
                }
            }
            // 4. Audit Log
            await tx.auditLog.create({
                data: {
                    instituteId,
                    userId: req.user?.userId || null,
                    action: 'STUDENT_BATCH_ASSIGNED',
                    entityType: 'Student',
                    entityId: id,
                    newValues: { batchId, subjectIds },
                },
            });
        });
        return res.json({
            success: true,
            message: batchId
                ? `Student assigned to ${batch?.name} successfully`
                : 'Student batch unassigned successfully',
        });
    }
    catch (err) {
        console.error('Error assigning student batch:', err);
        return res.status(500).json({ success: false, error: 'Failed to assign student batch' });
    }
}
/**
 * Lookup existing students within the current institute (for enrollment and deduplication)
 */
async function lookupExistingStudent(req, res) {
    try {
        const scope = await (0, student_authorization_service_js_1.getAuthorizedStudentScope)(req, prisma_js_1.prisma);
        const search = (req.query.search || req.query.query || req.query.q || req.query.phone || req.query.admissionNumber || '').trim();
        if (!search || search.length < 2) {
            return res.status(400).json({ success: false, error: 'Search term must be at least 2 characters' });
        }
        const students = await prisma_js_1.prisma.student.findMany({
            where: {
                AND: [
                    scope.whereClause,
                    {
                        OR: [
                            { admissionNumber: { contains: search, mode: 'insensitive' } },
                            { firstName: { contains: search, mode: 'insensitive' } },
                            { lastName: { contains: search, mode: 'insensitive' } },
                            { phone: { contains: search, mode: 'insensitive' } },
                            { user: { phone: { contains: search, mode: 'insensitive' } } },
                            { user: { email: { contains: search, mode: 'insensitive' } } },
                        ],
                    },
                ],
            },
            take: 20,
            include: {
                user: { select: { id: true, email: true, phone: true, fullName: true, isActive: true } },
                institute: { select: { id: true, name: true, code: true } },
                enrollments: {
                    where: { isActive: true },
                    include: {
                        batch: { select: { id: true, name: true, code: true } },
                        subject: { select: { id: true, name: true, code: true } },
                    },
                },
                courseEnrollments: {
                    where: { status: { in: [client_1.EnrollmentStatus.ACTIVE, client_1.EnrollmentStatus.COMPLETED] } },
                    include: {
                        course: { select: { id: true, title: true, slug: true } },
                    },
                },
                parentRelations: {
                    include: {
                        parent: {
                            include: {
                                user: { select: { id: true, fullName: true, phone: true, email: true } },
                            },
                        },
                    },
                },
            },
        });
        const formatted = students.map((s) => ({
            id: s.id,
            instituteId: s.instituteId,
            franchiseId: s.franchiseId,
            admissionNumber: s.admissionNumber,
            firstName: s.firstName,
            lastName: s.lastName,
            fullName: `${s.firstName} ${s.lastName}`,
            phone: s.phone || s.user?.phone || null,
            email: s.user?.email || null,
            status: s.status,
            photoUrl: s.photoUrl,
            institute: s.institute,
            activeEnrollments: s.enrollments.map((e) => ({
                batchId: e.batchId,
                batchName: e.batch?.name,
                batchCode: e.batch?.code,
                subjectId: e.subjectId,
                subjectName: e.subject?.name,
            })),
            courseEnrollments: s.courseEnrollments.map((ce) => ({
                id: ce.id,
                courseId: ce.courseId,
                mode: ce.mode,
                status: ce.status,
                course: ce.course,
            })),
            parents: s.parentRelations.map((pr) => ({
                fullName: pr.parent?.user?.fullName,
                phone: pr.parent?.user?.phone,
                email: pr.parent?.user?.email,
                relation: pr.relation,
            })),
        }));
        return res.json({
            success: true,
            data: { students: formatted },
        });
    }
    catch (err) {
        console.error('[lookupExistingStudent error]', err);
        return res.status(500).json({ success: false, error: 'Failed to lookup students' });
    }
}
exports.enrollExistingStudentSchema = zod_1.z.object({
    batchId: zod_1.z.string().uuid('Valid batch ID is required'),
    subjectIds: zod_1.z.array(zod_1.z.string().uuid()).optional().default([]),
});
/**
 * Enroll an existing canonical student profile into an authorized batch and subject(s)
 */
async function enrollExistingStudent(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const { id } = req.params;
        const parse = exports.enrollExistingStudentSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message || 'Validation error' });
        }
        const { batchId, subjectIds } = parse.data;
        // 1. Verify student exists in this institute
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { id, instituteId },
            include: {
                user: { select: { id: true, fullName: true, email: true, phone: true } },
            },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found in this institute' });
        }
        if (student.status !== 'ACTIVE') {
            return res.status(400).json({ success: false, error: `Cannot enroll student in ${student.status} status` });
        }
        // 2. Verify batch in this institute
        const batch = await prisma_js_1.prisma.batch.findFirst({
            where: { id: batchId, instituteId },
            include: {
                batchSubjects: { include: { subject: true } },
            },
        });
        if (!batch) {
            return res.status(404).json({ success: false, error: 'Batch not found in this institute' });
        }
        // 3. Verify subjects belong to batch
        if (subjectIds.length > 0) {
            const validSubjectIds = (batch.batchSubjects || []).map((bs) => bs.subjectId);
            for (const sid of subjectIds) {
                if (!validSubjectIds.includes(sid)) {
                    return res.status(400).json({
                        success: false,
                        error: `Subject '${sid}' does not belong to batch '${batch.name}'`,
                    });
                }
            }
        }
        // 4. If caller is STAFF, verify staff authorization
        if (req.user?.role === 'STAFF') {
            const isAssignedBatch = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, batchId, prisma_js_1.prisma);
            if (!isAssignedBatch) {
                return res.status(403).json({
                    success: false,
                    error: 'Forbidden: You are not authorized to enroll students into this batch',
                });
            }
            if (subjectIds.length > 0) {
                for (const sid of subjectIds) {
                    const isAssignedSub = await (0, student_authorization_service_js_1.isStaffAssignedToBatchSubject)(req, batchId, sid, prisma_js_1.prisma);
                    if (!isAssignedSub) {
                        return res.status(403).json({
                            success: false,
                            error: `Forbidden: You are not authorized to enroll students into subject '${sid}' in this batch`,
                        });
                    }
                }
            }
        }
        // 5. Check if student is ALREADY actively enrolled in this batch and all requested subjects
        const existingEnrollments = await prisma_js_1.prisma.studentEnrollment.findMany({
            where: { studentId: id, batchId, isActive: true },
        });
        const hasActivePrimary = existingEnrollments.some((e) => e.subjectId === null);
        const existingActiveSubjectIds = new Set(existingEnrollments.map((e) => e.subjectId).filter(Boolean));
        const allSubjectsAlreadyEnrolled = subjectIds.every((sid) => existingActiveSubjectIds.has(sid));
        if (hasActivePrimary && (subjectIds.length === 0 || allSubjectsAlreadyEnrolled)) {
            return res.status(200).json({
                success: true,
                duplicate: true,
                message: `${student.firstName} ${student.lastName} is already actively enrolled in ${batch.name}${subjectIds.length > 0 ? ' with all selected subjects' : ''}. No duplicate allocation was created.`,
                data: {
                    studentId: id,
                    batchId,
                    batchName: batch.name,
                    existingEnrollments,
                },
            });
        }
        // 6. In a transaction, add or reactivate missing enrollments without deactivating other batches!
        await prisma_js_1.prisma.$transaction(async (tx) => {
            // Primary batch enrollment
            const primary = await tx.studentEnrollment.findFirst({
                where: { studentId: id, batchId, subjectId: null },
            });
            if (!primary) {
                await tx.studentEnrollment.create({
                    data: { studentId: id, batchId, subjectId: null, isActive: true },
                });
            }
            else if (!primary.isActive) {
                await tx.studentEnrollment.update({
                    where: { id: primary.id },
                    data: { isActive: true },
                });
            }
            // Subject enrollments
            for (const sid of subjectIds) {
                const subEnr = await tx.studentEnrollment.findFirst({
                    where: { studentId: id, batchId, subjectId: sid },
                });
                if (!subEnr) {
                    await tx.studentEnrollment.create({
                        data: { studentId: id, batchId, subjectId: sid, isActive: true },
                    });
                }
                else if (!subEnr.isActive) {
                    await tx.studentEnrollment.update({
                        where: { id: subEnr.id },
                        data: { isActive: true },
                    });
                }
            }
            // Audit Log
            await tx.auditLog.create({
                data: {
                    instituteId,
                    userId: req.user?.userId || null,
                    action: 'STUDENT_ENROLLED_EXISTING',
                    entityType: 'Student',
                    entityId: id,
                    newValues: {
                        batchId,
                        batchName: batch.name,
                        subjectIds,
                    },
                },
            });
        });
        // Fetch updated enrollments
        const updatedEnrollments = await prisma_js_1.prisma.studentEnrollment.findMany({
            where: { studentId: id, isActive: true },
            include: {
                batch: { select: { id: true, name: true, code: true } },
                subject: { select: { id: true, name: true, code: true } },
            },
        });
        return res.status(200).json({
            success: true,
            duplicate: false,
            message: `${student.firstName} ${student.lastName} successfully enrolled into ${batch.name}.`,
            data: {
                student: {
                    id: student.id,
                    admissionNumber: student.admissionNumber,
                    fullName: `${student.firstName} ${student.lastName}`,
                    phone: student.phone,
                },
                batch: { id: batch.id, name: batch.name },
                enrollments: updatedEnrollments,
            },
        });
    }
    catch (err) {
        console.error('[enrollExistingStudent error]', err);
        return res.status(500).json({ success: false, error: 'Failed to enroll student' });
    }
}
