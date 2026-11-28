"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateParentIdentifierSchema = exports.resetParentPasswordSchema = exports.linkGuardianSchema = exports.updateParentSchema = exports.createParentSchema = void 0;
exports.listParents = listParents;
exports.createParent = createParent;
exports.linkGuardianToStudent = linkGuardianToStudent;
exports.revokeGuardianLink = revokeGuardianLink;
exports.getMyChildren = getMyChildren;
exports.resetParentPassword = resetParentPassword;
exports.updateParentLoginIdentifier = updateParentLoginIdentifier;
exports.updateParentAccountStatus = updateParentAccountStatus;
exports.getParentDashboardSummary = getParentDashboardSummary;
exports.getParentStudentAttendance = getParentStudentAttendance;
exports.getParentStudentTeachers = getParentStudentTeachers;
exports.getParentStudentAcademics = getParentStudentAcademics;
exports.getParentStudentHomework = getParentStudentHomework;
exports.getParentStudentTimetable = getParentStudentTimetable;
const prisma_js_1 = require("../../prisma.js");
const zod_1 = require("zod");
const security_js_1 = require("../../utils/security.js");
const cache_js_1 = require("../../utils/cache.js");
const student_authorization_service_js_1 = require("../students/student-authorization.service.js");
const timetable_resolver_js_1 = require("../students/timetable-resolver.js");
exports.createParentSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2, 'Full name is required'),
    phone: zod_1.z.string().min(10, 'Valid phone number is required'),
    email: zod_1.z.string().email('Invalid email').optional().or(zod_1.z.literal('')),
    occupation: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    altPhone: zod_1.z.string().optional(),
    initialPassword: zod_1.z.string().min(8).optional(),
});
exports.updateParentSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2).optional(),
    phone: zod_1.z.string().min(10).optional(),
    email: zod_1.z.string().email().optional().or(zod_1.z.literal('')),
    occupation: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    altPhone: zod_1.z.string().optional(),
});
exports.linkGuardianSchema = zod_1.z.object({
    parentId: zod_1.z.string().uuid('Valid parent ID required'),
    relation: zod_1.z.enum(['FATHER', 'MOTHER', 'GUARDIAN']).default('GUARDIAN'),
    isPrimaryContact: zod_1.z.boolean().default(false),
    canReceiveSms: zod_1.z.boolean().default(true),
});
/**
 * List parents in institute
 */
async function listParents(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId) {
            return res.status(400).json({ success: false, error: 'Institute context required' });
        }
        const search = (req.query.search || '').trim();
        const where = {
            user: {
                memberships: {
                    some: { instituteId },
                },
            },
        };
        if (search) {
            where.OR = [
                { user: { fullName: { contains: search, mode: 'insensitive' } } },
                { user: { phone: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
            ];
        }
        const parents = await prisma_js_1.prisma.parentProfile.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        phone: true,
                        email: true,
                        isActive: true,
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
                                status: true,
                            },
                        },
                    },
                },
            },
        });
        return res.json({
            success: true,
            data: { parents },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to list parents' });
    }
}
/**
 * Provision new Parent account
 */
async function createParent(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId) {
            return res.status(400).json({ success: false, error: 'Institute context required' });
        }
        const parse = exports.createParentSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message || 'Validation error',
            });
        }
        const data = parse.data;
        const phone = data.phone.trim();
        const email = data.email?.trim().toLowerCase() || null;
        // Check if user with phone or email exists
        const existing = await prisma_js_1.prisma.user.findFirst({
            where: {
                OR: [
                    { phone },
                    ...(email ? [{ email }] : []),
                ],
            },
        });
        if (existing) {
            // Check if existing user is already a parent and add institute membership
            if (existing.role === 'PARENT') {
                const membership = await prisma_js_1.prisma.instituteMembership.findUnique({
                    where: {
                        instituteId_userId: {
                            instituteId,
                            userId: existing.id,
                        },
                    },
                });
                if (!membership) {
                    await prisma_js_1.prisma.instituteMembership.create({
                        data: {
                            instituteId,
                            userId: existing.id,
                            role: 'PARENT',
                            isActive: true,
                        },
                    });
                }
                const parentProfile = await prisma_js_1.prisma.parentProfile.findUnique({
                    where: { userId: existing.id },
                });
                return res.status(200).json({
                    success: true,
                    message: 'Existing parent profile linked to this institute',
                    data: { parentProfile, userId: existing.id },
                });
            }
            return res.status(409).json({
                success: false,
                error: `A user with this phone or email already exists with role '${existing.role}'`,
            });
        }
        const tempPassword = data.initialPassword || `Parent#${(0, security_js_1.generateSecureRandomToken)(4)}2026`;
        const passwordHash = await (0, security_js_1.hashPassword)(tempPassword);
        const result = await prisma_js_1.prisma.$transaction(async (tx) => {
            // 1. Create User
            const user = await tx.user.create({
                data: {
                    fullName: data.fullName.trim(),
                    phone,
                    email,
                    passwordHash,
                    role: 'PARENT',
                    isActive: true,
                    mustChangePassword: false,
                },
            });
            // 2. Create Membership
            await tx.instituteMembership.create({
                data: {
                    instituteId,
                    userId: user.id,
                    role: 'PARENT',
                    isActive: true,
                },
            });
            // 3. Create ParentProfile
            const parentProfile = await tx.parentProfile.create({
                data: {
                    userId: user.id,
                    occupation: data.occupation?.trim() || null,
                    address: data.address?.trim() || null,
                    altPhone: data.altPhone?.trim() || null,
                    isPhoneVerified: true,
                },
            });
            // 4. Audit Log
            await tx.auditLog.create({
                data: {
                    instituteId,
                    userId: req.user?.userId || null,
                    action: 'PARENT_PROVISIONED',
                    entityType: 'ParentProfile',
                    entityId: parentProfile.id,
                    newValues: {
                        fullName: user.fullName,
                        phone: user.phone,
                    },
                },
            });
            return { user, parentProfile };
        });
        return res.status(201).json({
            success: true,
            message: 'Parent profile created successfully',
            data: {
                parent: result.parentProfile,
                user: {
                    id: result.user.id,
                    fullName: result.user.fullName,
                    phone: result.user.phone,
                    email: result.user.email,
                },
                temporaryPassword: tempPassword,
            },
        });
    }
    catch (err) {
        console.error('[Create Parent Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to create parent account' });
    }
}
/**
 * Link Parent/Guardian to Student
 */
async function linkGuardianToStudent(req, res) {
    try {
        const instituteId = req.instituteId;
        const { studentId } = req.params;
        const parse = exports.linkGuardianSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message,
            });
        }
        const { parentId, relation, isPrimaryContact, canReceiveSms } = parse.data;
        // Verify student belongs to this institute and is authorized for caller
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to link guardians to this student' });
        }
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { id: studentId, instituteId },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found in this institute' });
        }
        // Verify parent profile exists
        const parent = await prisma_js_1.prisma.parentProfile.findUnique({
            where: { id: parentId },
            include: { user: true },
        });
        if (!parent) {
            return res.status(404).json({ success: false, error: 'Parent profile not found' });
        }
        // Check duplicate relationship
        const existingLink = await prisma_js_1.prisma.studentParentRelation.findUnique({
            where: {
                studentId_parentId: {
                    studentId,
                    parentId,
                },
            },
        });
        if (existingLink) {
            return res.status(409).json({
                success: false,
                error: 'This parent is already linked to this student',
            });
        }
        // If setting as primary, clear any previous primary flag
        if (isPrimaryContact) {
            await prisma_js_1.prisma.studentParentRelation.updateMany({
                where: { studentId },
                data: { isPrimaryContact: false },
            });
        }
        const link = await prisma_js_1.prisma.studentParentRelation.create({
            data: {
                studentId,
                parentId,
                relation,
                isPrimaryContact,
                canReceiveSms,
            },
            include: {
                parent: {
                    include: {
                        user: {
                            select: { id: true, fullName: true, phone: true },
                        },
                    },
                },
            },
        });
        // Record Audit Log
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId,
                userId: req.user?.userId || null,
                action: 'GUARDIAN_LINKED',
                entityType: 'StudentParentRelation',
                entityId: link.id,
                newValues: { studentId, parentId, relation, isPrimaryContact },
            },
        });
        return res.status(201).json({
            success: true,
            message: 'Guardian linked to student successfully',
            data: { link },
        });
    }
    catch (err) {
        console.error('[Link Guardian Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to link guardian to student' });
    }
}
/**
 * Revoke guardian link
 */
async function revokeGuardianLink(req, res) {
    try {
        const instituteId = req.instituteId;
        const { studentId, parentId } = req.params;
        // Verify student belongs to this institute and is authorized for caller
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to manage guardians for this student' });
        }
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { id: studentId, instituteId },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found in this institute' });
        }
        const existing = await prisma_js_1.prisma.studentParentRelation.findUnique({
            where: {
                studentId_parentId: {
                    studentId,
                    parentId,
                },
            },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Guardian link not found' });
        }
        await prisma_js_1.prisma.studentParentRelation.delete({
            where: { id: existing.id },
        });
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId,
                userId: req.user?.userId || null,
                action: 'GUARDIAN_UNLINKED',
                entityType: 'StudentParentRelation',
                entityId: existing.id,
                oldValues: existing,
            },
        });
        return res.json({
            success: true,
            message: 'Guardian link revoked successfully',
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to revoke guardian link' });
    }
}
/**
 * Get Parent's authorized children (Parent role only)
 */
async function getMyChildren(req, res) {
    try {
        if (req.user?.role !== 'PARENT') {
            return res.status(403).json({ success: false, error: 'Forbidden: Parent access only' });
        }
        const parentProfile = await prisma_js_1.prisma.parentProfile.findUnique({
            where: { userId: req.user.userId },
        });
        if (!parentProfile) {
            return res.status(404).json({ success: false, error: 'Parent profile not found' });
        }
        const relations = await prisma_js_1.prisma.studentParentRelation.findMany({
            where: { parentId: parentProfile.id },
            include: {
                student: {
                    include: {
                        institute: {
                            select: { id: true, name: true, code: true, phone: true },
                        },
                        enrollments: {
                            where: { isActive: true },
                            include: {
                                batch: {
                                    select: { id: true, name: true, academicYear: true },
                                },
                            },
                        },
                        _count: {
                            select: {
                                attendanceEvents: true,
                                examMarks: true,
                            },
                        },
                    },
                },
            },
        });
        const children = relations.map((rel) => ({
            relationship: rel.relation,
            isPrimaryContact: rel.isPrimaryContact,
            canReceiveSms: rel.canReceiveSms,
            student: rel.student,
        }));
        return res.json({
            success: true,
            data: { children },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to fetch linked children' });
    }
}
exports.resetParentPasswordSchema = zod_1.z.object({
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters').optional(),
    newPassword: zod_1.z.string().min(8, 'Password must be at least 8 characters').optional(),
});
exports.updateParentIdentifierSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address').optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().min(8, 'Phone number must be at least 8 digits').optional().or(zod_1.z.literal('')),
}).refine((data) => data.email !== undefined || data.phone !== undefined, {
    message: 'At least one identifier (email or phone) must be provided',
});
/**
 * Reset Parent Password by authorized staff/admin
 */
async function resetParentPassword(req, res) {
    try {
        const instituteId = req.instituteId;
        const { parentId } = req.params;
        const parse = exports.resetParentPasswordSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message || 'Invalid input' });
        }
        // Verify parent exists
        const parentProfile = await prisma_js_1.prisma.parentProfile.findUnique({
            where: { id: parentId },
            include: {
                user: true,
                studentRelations: {
                    include: { student: true },
                },
            },
        });
        if (!parentProfile) {
            return res.status(404).json({ success: false, error: 'Parent profile not found' });
        }
        // Check institute scope: parent has student in this institute or membership
        const isInstStudent = parentProfile.studentRelations.some((r) => r.student.instituteId === instituteId);
        const membership = await prisma_js_1.prisma.instituteMembership.findUnique({
            where: {
                instituteId_userId: {
                    instituteId: instituteId,
                    userId: parentProfile.userId,
                },
            },
        });
        if (!isInstStudent && !membership) {
            return res.status(403).json({ success: false, error: 'Forbidden: Parent is not linked to this institute' });
        }
        // For staff, ensure at least one linked student is in staff scope
        if (req.user?.role === 'STAFF') {
            let hasAuthorizedStudent = false;
            for (const rel of parentProfile.studentRelations) {
                if (await (0, student_authorization_service_js_1.isStudentAuthorized)(req, rel.studentId, prisma_js_1.prisma)) {
                    hasAuthorizedStudent = true;
                    break;
                }
            }
            if (!hasAuthorizedStudent) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to reset credentials for this parent' });
            }
        }
        const temporaryPassword = parse.data?.password?.trim() ||
            parse.data?.newPassword?.trim() ||
            `Parent#${(0, security_js_1.generateSecureRandomToken)(4)}2026`;
        const passwordHash = await (0, security_js_1.hashPassword)(temporaryPassword);
        await prisma_js_1.prisma.user.update({
            where: { id: parentProfile.userId },
            data: {
                passwordHash,
                mustChangePassword: false,
            },
        });
        // Invalidate reset tokens
        await prisma_js_1.prisma.passwordResetToken.deleteMany({
            where: { userId: parentProfile.userId },
        });
        // Update parent password in linked students' notes
        for (const rel of parentProfile.studentRelations) {
            try {
                const st = await prisma_js_1.prisma.student.findUnique({ where: { id: rel.studentId }, select: { id: true, notes: true } });
                if (st) {
                    let cNotes = {};
                    if (st.notes && st.notes.startsWith('{')) {
                        try {
                            cNotes = JSON.parse(st.notes);
                        }
                        catch { }
                    }
                    else if (st.notes) {
                        cNotes.userNotes = st.notes;
                    }
                    cNotes.parentPassword = temporaryPassword;
                    await prisma_js_1.prisma.student.update({
                        where: { id: st.id },
                        data: { notes: JSON.stringify(cNotes) },
                    });
                }
            }
            catch { }
        }
        // Record audit log
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId,
                userId: req.user?.userId || null,
                action: 'PARENT_PASSWORD_RESET',
                entityType: 'ParentProfile',
                entityId: parentProfile.id,
                newValues: {
                    parentId: parentProfile.id,
                    userId: parentProfile.userId,
                    resetBy: req.user?.userId,
                },
            },
        });
        return res.json({
            success: true,
            message: 'Parent password reset successfully',
            data: {
                temporaryPassword,
                permanentPassword: temporaryPassword,
                mustChangePassword: false,
            },
        });
    }
    catch (err) {
        console.error('[Reset Parent Password Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to reset parent password' });
    }
}
/**
 * Update Parent Login Identifier (phone/email)
 */
async function updateParentLoginIdentifier(req, res) {
    try {
        const instituteId = req.instituteId;
        const { parentId } = req.params;
        const parse = exports.updateParentIdentifierSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message || 'Invalid input' });
        }
        const parentProfile = await prisma_js_1.prisma.parentProfile.findUnique({
            where: { id: parentId },
            include: {
                user: true,
                studentRelations: {
                    include: { student: true },
                },
            },
        });
        if (!parentProfile) {
            return res.status(404).json({ success: false, error: 'Parent profile not found' });
        }
        // Check institute scope
        const isInstStudent = parentProfile.studentRelations.some((r) => r.student.instituteId === instituteId);
        const membership = await prisma_js_1.prisma.instituteMembership.findUnique({
            where: {
                instituteId_userId: {
                    instituteId: instituteId,
                    userId: parentProfile.userId,
                },
            },
        });
        if (!isInstStudent && !membership) {
            return res.status(403).json({ success: false, error: 'Forbidden: Parent is not linked to this institute' });
        }
        // For staff, ensure at least one linked student is in staff scope
        if (req.user?.role === 'STAFF') {
            let hasAuthorizedStudent = false;
            for (const rel of parentProfile.studentRelations) {
                if (await (0, student_authorization_service_js_1.isStudentAuthorized)(req, rel.studentId, prisma_js_1.prisma)) {
                    hasAuthorizedStudent = true;
                    break;
                }
            }
            if (!hasAuthorizedStudent) {
                return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to update credentials for this parent' });
            }
        }
        const cleanEmail = parse.data.email !== undefined ? (parse.data.email.trim().toLowerCase() || null) : undefined;
        const cleanPhone = parse.data.phone !== undefined ? (parse.data.phone.trim() || null) : undefined;
        // Check duplicate email
        if (cleanEmail) {
            const existingEmail = await prisma_js_1.prisma.user.findFirst({
                where: { email: cleanEmail, id: { not: parentProfile.userId } },
            });
            if (existingEmail) {
                return res.status(409).json({ success: false, error: `Email '${cleanEmail}' is already registered to another account` });
            }
        }
        // Check duplicate phone
        if (cleanPhone) {
            const existingPhone = await prisma_js_1.prisma.user.findFirst({
                where: { phone: cleanPhone, id: { not: parentProfile.userId } },
            });
            if (existingPhone) {
                return res.status(409).json({ success: false, error: `Phone '${cleanPhone}' is already registered to another account` });
            }
        }
        await prisma_js_1.prisma.user.update({
            where: { id: parentProfile.userId },
            data: {
                ...(cleanEmail !== undefined ? { email: cleanEmail } : {}),
                ...(cleanPhone !== undefined ? { phone: cleanPhone } : {}),
            },
        });
        // Record audit log
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId,
                userId: req.user?.userId || null,
                action: 'PARENT_IDENTIFIER_UPDATED',
                entityType: 'ParentProfile',
                entityId: parentProfile.id,
                newValues: {
                    email: cleanEmail,
                    phone: cleanPhone,
                },
            },
        });
        return res.json({
            success: true,
            message: 'Parent contact / login identifier updated successfully',
        });
    }
    catch (err) {
        console.error('[Update Parent Identifier Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to update parent login identifier' });
    }
}
/**
 * Activate or deactivate a parent login account
 */
async function updateParentAccountStatus(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId) {
            return res.status(400).json({ success: false, error: 'Institute context required' });
        }
        const { parentId } = req.params;
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            return res.status(400).json({ success: false, error: 'isActive boolean flag is required' });
        }
        const parentProfile = await prisma_js_1.prisma.parentProfile.findUnique({
            where: { id: parentId },
            include: {
                user: true,
                studentRelations: {
                    include: { student: true },
                },
            },
        });
        if (!parentProfile) {
            return res.status(404).json({ success: false, error: 'Parent profile not found' });
        }
        // Check institute scope
        const isInstStudent = parentProfile.studentRelations.some((r) => r.student.instituteId === instituteId);
        if (!isInstStudent) {
            return res.status(403).json({ success: false, error: 'Forbidden: Parent is not linked to this institute' });
        }
        // For staff, ensure at least one linked student is in staff scope
        if (req.user?.role === 'STAFF') {
            let hasAuthorizedStudent = false;
            for (const rel of parentProfile.studentRelations) {
                if (await (0, student_authorization_service_js_1.isStudentAuthorized)(req, rel.studentId, prisma_js_1.prisma)) {
                    hasAuthorizedStudent = true;
                    break;
                }
            }
            if (!hasAuthorizedStudent) {
                return res.status(403).json({
                    success: false,
                    error: 'Forbidden: You are not authorized to manage this parent account',
                });
            }
        }
        await prisma_js_1.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: parentProfile.userId },
                data: { isActive },
            });
            await tx.instituteMembership.updateMany({
                where: { instituteId, userId: parentProfile.userId },
                data: { isActive },
            });
            await tx.auditLog.create({
                data: {
                    instituteId,
                    userId: req.user?.userId || null,
                    action: 'PARENT_ACCOUNT_STATUS_CHANGED',
                    entityType: 'User',
                    entityId: parentProfile.userId,
                    newValues: { isActive, parentId },
                },
            });
        });
        return res.json({
            success: true,
            message: `Parent account has been ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: { isActive },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to update parent account status' });
    }
}
/**
 * Aggregated dashboard summary for authenticated parent
 */
async function getParentDashboardSummary(req, res) {
    try {
        if (req.user?.role !== 'PARENT') {
            return res.status(403).json({ success: false, error: 'Forbidden: Parent access only' });
        }
        const cacheKey = `dashboard:parent:${req.user.userId}`;
        if (req.query.refresh !== 'true') {
            const cached = cache_js_1.serverCache.get(cacheKey);
            if (cached) {
                return res.json(cached);
            }
        }
        const parentProfile = await prisma_js_1.prisma.parentProfile.findUnique({
            where: { userId: req.user.userId },
            include: {
                user: { select: { id: true, fullName: true, email: true, phone: true } },
            },
        });
        if (!parentProfile) {
            return res.status(404).json({ success: false, error: 'Parent profile not found' });
        }
        // Get linked children
        const relations = await prisma_js_1.prisma.studentParentRelation.findMany({
            where: { parentId: parentProfile.id },
            include: {
                student: {
                    include: {
                        institute: { select: { id: true, name: true, code: true } },
                        enrollments: {
                            where: { isActive: true },
                            include: { batch: { select: { id: true, name: true, academicYear: true, schedule: true } } },
                        },
                    },
                },
            },
        });
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        let totalOutstandingFees = 0;
        let nextUpcomingDueDate = null;
        const [childrenSummaries, parentConversations, unreadNotificationsCount] = await Promise.all([
            Promise.all(relations.map(async (rel) => {
                const student = rel.student;
                const batchId = student.enrollments[0]?.batch?.id;
                // Fetch all child sub-metrics concurrently in parallel
                const [todayEvents, monthEvents, distinctBatchDays, feeAssignments, latestMark] = await Promise.all([
                    // 1. Today's attendance
                    prisma_js_1.prisma.attendanceEvent.findMany({
                        where: {
                            studentId: student.id,
                            eventDate: { gte: todayStart, lte: todayEnd },
                        },
                        orderBy: { eventTime: 'asc' },
                    }),
                    // 2. Monthly check-in events
                    prisma_js_1.prisma.attendanceEvent.findMany({
                        where: {
                            studentId: student.id,
                            eventType: 'CHECK_IN',
                            eventDate: { gte: monthStart, lte: todayEnd },
                        },
                        select: { eventDate: true, isLate: true },
                    }),
                    // 3. Batch working days in this month
                    batchId
                        ? prisma_js_1.prisma.attendanceEvent.findMany({
                            where: {
                                batchId,
                                eventDate: { gte: monthStart, lte: todayEnd },
                            },
                            distinct: ['eventDate'],
                            select: { eventDate: true },
                        })
                        : Promise.resolve([]),
                    // 4. Fee Dues
                    prisma_js_1.prisma.studentFeeAssignment.findMany({
                        where: {
                            studentId: student.id,
                            status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
                        },
                        include: {
                            feeStructure: { select: { name: true } },
                            payments: { where: { status: 'SUCCESS' }, select: { amountPaid: true } },
                        },
                        orderBy: { dueDate: 'asc' },
                    }),
                    // 5. Latest Exam Result
                    prisma_js_1.prisma.examMark.findFirst({
                        where: {
                            studentId: student.id,
                            exam: { isPublished: true },
                        },
                        include: {
                            exam: {
                                include: { subject: { select: { name: true } } },
                            },
                        },
                        orderBy: { exam: { examDate: 'desc' } },
                    }),
                ]);
                const checkIn = todayEvents.find((e) => e.eventType === 'CHECK_IN');
                const checkOut = todayEvents.find((e) => e.eventType === 'CHECK_OUT');
                let todayStatus = 'NOT_MARKED';
                if (checkOut) {
                    todayStatus = 'CHECKED_OUT';
                }
                else if (checkIn) {
                    todayStatus = checkIn.isLate ? 'LATE' : 'CHECKED_IN';
                }
                const totalWorkingDays = distinctBatchDays.length;
                const presentDays = monthEvents.length;
                const attendancePercentage = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;
                let studentPendingFees = 0;
                for (const fa of feeAssignments) {
                    const totalPaid = fa.payments.reduce((acc, p) => acc + Number(p.amountPaid), 0);
                    const remaining = Math.max(0, Number(fa.finalAmount) - totalPaid);
                    studentPendingFees += remaining;
                    if (!nextUpcomingDueDate || fa.dueDate < nextUpcomingDueDate) {
                        nextUpcomingDueDate = fa.dueDate;
                    }
                }
                totalOutstandingFees += studentPendingFees;
                const latestExamResult = latestMark
                    ? {
                        examTitle: latestMark.exam.title,
                        subject: latestMark.exam.subject.name,
                        score: Number(latestMark.marksObtained),
                        totalMarks: Number(latestMark.exam.totalMarks),
                        percentage: Number(latestMark.exam.totalMarks) > 0
                            ? Math.round((Number(latestMark.marksObtained) / Number(latestMark.exam.totalMarks)) * 100)
                            : 0,
                        examDate: latestMark.exam.examDate,
                        isAbsent: latestMark.isAbsent,
                    }
                    : null;
                return {
                    studentId: student.id,
                    fullName: `${student.firstName} ${student.lastName}`,
                    admissionNumber: student.admissionNumber,
                    gender: student.gender,
                    photoUrl: student.photoUrl,
                    batchName: student.enrollments[0]?.batch?.name || 'Class',
                    relationship: rel.relation,
                    todayAttendance: {
                        status: todayStatus,
                        checkInTime: checkIn?.eventTime || null,
                        checkOutTime: checkOut?.eventTime || null,
                        isLate: checkIn?.isLate || false,
                    },
                    monthlyAttendance: {
                        presentDays,
                        totalWorkingDays,
                        percentage: attendancePercentage,
                    },
                    fees: {
                        pendingAmount: studentPendingFees,
                        pendingAssignmentsCount: feeAssignments.length,
                    },
                    latestExamResult,
                };
            })),
            // Unread messages count
            prisma_js_1.prisma.conversation.findMany({
                where: {
                    members: { some: { userId: req.user.userId } },
                },
                include: {
                    members: { where: { userId: req.user.userId } },
                    messages: {
                        take: 1,
                        orderBy: { createdAt: 'desc' },
                    },
                },
            }),
            // Unread in-app notifications count
            prisma_js_1.prisma.inAppNotification.count({
                where: {
                    userId: req.user.userId,
                    isRead: false,
                },
            }),
        ]);
        let unreadMessagesCount = 0;
        for (const conv of parentConversations) {
            const myMembership = conv.members[0];
            const lastMessage = conv.messages[0];
            if (lastMessage &&
                lastMessage.senderId !== req.user.userId &&
                (!myMembership?.lastReadAt || new Date(myMembership.lastReadAt) < new Date(lastMessage.createdAt))) {
                unreadMessagesCount++;
            }
        }
        const responsePayload = {
            success: true,
            data: {
                parent: {
                    id: parentProfile.id,
                    fullName: parentProfile.user.fullName,
                    email: parentProfile.user.email,
                    phone: parentProfile.user.phone,
                },
                children: childrenSummaries,
                financialOverview: {
                    totalOutstandingFees,
                    nextUpcomingDueDate,
                },
                unreadCounts: {
                    messages: unreadMessagesCount,
                    notifications: unreadNotificationsCount,
                },
            },
        };
        cache_js_1.serverCache.set(cacheKey, responsePayload, 20000);
        return res.json(responsePayload);
    }
    catch (err) {
        console.error('[Parent Dashboard Summary Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to generate parent dashboard summary' });
    }
}
/**
 * Monthly attendance calendar and stats for parent's linked child
 */
async function getParentStudentAttendance(req, res) {
    try {
        if (req.user?.role !== 'PARENT') {
            return res.status(403).json({ success: false, error: 'Forbidden: Parent access only' });
        }
        const { studentId } = req.params;
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized for this student' });
        }
        const now = new Date();
        const month = parseInt(req.query.month || String(now.getMonth() + 1), 10);
        const year = parseInt(req.query.year || String(now.getFullYear()), 10);
        if (month < 1 || month > 12 || year < 2000 || year > 2100) {
            return res.status(400).json({ success: false, error: 'Invalid month or year parameter' });
        }
        const startDate = new Date(year, month - 1, 1, 0, 0, 0);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        const student = await prisma_js_1.prisma.student.findUnique({
            where: { id: studentId },
            include: {
                enrollments: {
                    where: { isActive: true },
                    include: { batch: { select: { id: true, name: true } } },
                },
            },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found' });
        }
        const batchId = student.enrollments[0]?.batch?.id;
        // Fetch all attendance events for this student in this month
        const studentEvents = await prisma_js_1.prisma.attendanceEvent.findMany({
            where: {
                studentId,
                eventDate: { gte: startDate, lte: endDate },
            },
            orderBy: { eventTime: 'asc' },
        });
        // Determine batch working days in this month
        let distinctWorkingDates = [];
        if (batchId) {
            const batchEvents = await prisma_js_1.prisma.attendanceEvent.findMany({
                where: {
                    batchId,
                    eventDate: { gte: startDate, lte: endDate },
                },
                distinct: ['eventDate'],
                select: { eventDate: true },
            });
            distinctWorkingDates = batchEvents.map((e) => e.eventDate.toISOString().split('T')[0]);
        }
        // Map student events by date string YYYY-MM-DD
        const dailyRecords = {};
        for (const ev of studentEvents) {
            const dateKey = ev.eventDate.toISOString().split('T')[0];
            if (!dailyRecords[dateKey]) {
                dailyRecords[dateKey] = {
                    date: dateKey,
                    checkIn: null,
                    checkOut: null,
                    isLate: false,
                    remarks: null,
                    status: 'PRESENT',
                };
            }
            if (ev.eventType === 'CHECK_IN') {
                dailyRecords[dateKey].checkIn = ev.eventTime;
                dailyRecords[dateKey].isLate = ev.isLate;
                dailyRecords[dateKey].remarks = ev.remarks;
                if (ev.isLate)
                    dailyRecords[dateKey].status = 'LATE';
            }
            else if (ev.eventType === 'CHECK_OUT') {
                dailyRecords[dateKey].checkOut = ev.eventTime;
            }
        }
        // Build complete daily timeline including absent days for working days
        let presentDaysCount = 0;
        let lateDaysCount = 0;
        let absentDaysCount = 0;
        const daysInMonth = new Date(year, month, 0).getDate();
        const calendarDays = [];
        const todayStr = now.toISOString().split('T')[0];
        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(year, month - 1, day);
            const dateKey = dayDate.toISOString().split('T')[0];
            const isPastOrToday = dateKey <= todayStr;
            const isBatchWorkingDay = distinctWorkingDates.includes(dateKey);
            const record = dailyRecords[dateKey];
            if (record) {
                presentDaysCount++;
                if (record.isLate)
                    lateDaysCount++;
                calendarDays.push({
                    date: dateKey,
                    day,
                    status: record.isLate ? 'LATE' : 'PRESENT',
                    checkIn: record.checkIn,
                    checkOut: record.checkOut,
                    isLate: record.isLate,
                    remarks: record.remarks,
                });
            }
            else if (isBatchWorkingDay && isPastOrToday) {
                absentDaysCount++;
                calendarDays.push({
                    date: dateKey,
                    day,
                    status: 'ABSENT',
                    checkIn: null,
                    checkOut: null,
                    isLate: false,
                    remarks: 'Marked Absent',
                });
            }
            else {
                calendarDays.push({
                    date: dateKey,
                    day,
                    status: 'HOLIDAY_OR_NO_SESSION',
                    checkIn: null,
                    checkOut: null,
                    isLate: false,
                    remarks: null,
                });
            }
        }
        const totalWorkingDays = presentDaysCount + absentDaysCount;
        const attendancePercentage = totalWorkingDays > 0 ? Math.round((presentDaysCount / totalWorkingDays) * 100) : 0;
        return res.json({
            success: true,
            data: {
                month,
                year,
                student: {
                    id: student.id,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    admissionNumber: student.admissionNumber,
                    batchName: student.enrollments[0]?.batch?.name || 'Class',
                },
                metrics: {
                    totalWorkingDays,
                    presentDays: presentDaysCount,
                    absentDays: absentDaysCount,
                    lateDays: lateDaysCount,
                    attendancePercentage,
                },
                calendar: calendarDays,
            },
        });
    }
    catch (err) {
        console.error('[Parent Student Attendance Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch student attendance records' });
    }
}
/**
 * Retrieve teachers assigned to student's class / batch for direct communication
 */
async function getParentStudentTeachers(req, res) {
    try {
        if (req.user?.role !== 'PARENT') {
            return res.status(403).json({ success: false, error: 'Forbidden: Parent access only' });
        }
        const { studentId } = req.params;
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized for this student' });
        }
        const student = await prisma_js_1.prisma.student.findUnique({
            where: { id: studentId },
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
                                                user: { select: { id: true, fullName: true, email: true, phone: true } },
                                            },
                                        },
                                    },
                                },
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
                        },
                    },
                },
            },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found' });
        }
        const teachersMap = new Map();
        for (const enrollment of student.enrollments) {
            const batch = enrollment.batch;
            if (!batch)
                continue;
            // Subject-specific teachers
            for (const bs of batch.batchSubjects) {
                if (bs.staffProfile && bs.staffProfile.user) {
                    const staffUserId = bs.staffProfile.user.id;
                    if (!teachersMap.has(staffUserId)) {
                        teachersMap.set(staffUserId, {
                            staffProfileId: bs.staffProfile.id,
                            userId: staffUserId,
                            fullName: bs.staffProfile.user.fullName,
                            email: bs.staffProfile.user.email,
                            phone: bs.staffProfile.user.phone,
                            designation: bs.staffProfile.designation || 'Faculty Teacher',
                            qualification: bs.staffProfile.qualification || null,
                            batchName: batch.name,
                            subjects: [bs.subject.name],
                        });
                    }
                    else {
                        const existing = teachersMap.get(staffUserId);
                        if (!existing.subjects.includes(bs.subject.name)) {
                            existing.subjects.push(bs.subject.name);
                        }
                    }
                }
            }
            // General batch coordinators / assigned staff
            for (const sa of batch.staffAssignments) {
                if (sa.staffProfile && sa.staffProfile.user) {
                    const staffUserId = sa.staffProfile.user.id;
                    if (!teachersMap.has(staffUserId)) {
                        teachersMap.set(staffUserId, {
                            staffProfileId: sa.staffProfile.id,
                            userId: staffUserId,
                            fullName: sa.staffProfile.user.fullName,
                            email: sa.staffProfile.user.email,
                            phone: sa.staffProfile.user.phone,
                            designation: sa.staffProfile.designation || 'Class Coordinator',
                            qualification: sa.staffProfile.qualification || null,
                            batchName: batch.name,
                            subjects: ['General Academics'],
                        });
                    }
                }
            }
        }
        const teachers = Array.from(teachersMap.values());
        return res.json({
            success: true,
            data: {
                teachers,
                student: {
                    id: student.id,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    admissionNumber: student.admissionNumber,
                },
            },
        });
    }
    catch (err) {
        console.error('[Parent Student Teachers Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch teachers for student' });
    }
}
/**
 * Consolidated academic report: timetable, subjects, homework, and progress feedback
 */
async function getParentStudentAcademics(req, res) {
    try {
        if (req.user?.role !== 'PARENT') {
            return res.status(403).json({ success: false, error: 'Forbidden: Parent access only' });
        }
        const { studentId } = req.params;
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized for this student' });
        }
        const student = await prisma_js_1.prisma.student.findUnique({
            where: { id: studentId },
            include: {
                institute: { select: { id: true, name: true, code: true } },
                enrollments: {
                    where: { isActive: true },
                    include: {
                        batch: {
                            include: {
                                batchSubjects: {
                                    where: { isActive: true },
                                    include: {
                                        subject: true,
                                        staffProfile: { include: { user: { select: { fullName: true } } } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found' });
        }
        const activeBatch = student.enrollments[0]?.batch;
        const batchId = activeBatch?.id;
        // Subjects & Timetable
        const subjects = activeBatch?.batchSubjects.map((bs) => ({
            id: bs.subject.id,
            name: bs.subject.name,
            code: bs.subject.code,
            schedule: bs.schedule || activeBatch.schedule || 'Scheduled session',
            teacher: bs.staffProfile?.user.fullName || 'Assigned Faculty',
        })) || [];
        // Active Homework & Tasks
        let homework = [];
        if (batchId) {
            const materials = await prisma_js_1.prisma.learningMaterial.findMany({
                where: {
                    batchId,
                    type: { in: ['HOMEWORK', 'PDF'] },
                },
                include: {
                    subject: { select: { name: true } },
                    uploader: { select: { fullName: true } },
                    submissions: {
                        where: { studentId },
                        select: { status: true, submittedAt: true, grade: true, feedback: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 20,
            });
            homework = materials.map((m) => {
                const sub = m.submissions[0];
                return {
                    id: m.id,
                    title: m.title,
                    description: m.description,
                    type: m.type,
                    subject: m.subject?.name || 'General',
                    teacher: m.uploader.fullName,
                    dueDate: m.dueDate,
                    createdAt: m.createdAt,
                    submissionStatus: sub?.status || 'PENDING',
                    submittedAt: sub?.submittedAt || null,
                    grade: sub?.grade || null,
                    teacherFeedback: sub?.feedback || null,
                };
            });
        }
        // Teacher Progress Feedbacks
        const feedbacks = await prisma_js_1.prisma.progressFeedback.findMany({
            where: {
                studentId,
                isPublished: true,
            },
            include: {
                staff: { select: { fullName: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
        const formattedFeedbacks = feedbacks.map((f) => ({
            id: f.id,
            termName: f.termName,
            periodType: f.periodType || 'TERM',
            teacher: f.staff.fullName,
            remarks: f.remarks,
            rating: f.rating,
            strengths: f.strengths,
            improvements: f.improvements,
            recommendations: f.recommendations,
            attendanceRate: f.attendanceRate !== null ? Number(f.attendanceRate) : null,
            homeworkRate: f.homeworkRate !== null ? Number(f.homeworkRate) : null,
            examAverage: f.examAverage !== null ? Number(f.examAverage) : null,
            date: f.createdAt,
        }));
        // Upcoming Examinations
        let upcomingExams = [];
        if (batchId) {
            const exams = await prisma_js_1.prisma.examination.findMany({
                where: {
                    batchId,
                    examDate: { gte: new Date() },
                },
                include: {
                    subject: { select: { name: true } },
                },
                orderBy: { examDate: 'asc' },
                take: 10,
            });
            upcomingExams = exams.map((e) => ({
                id: e.id,
                title: e.title,
                examType: e.examType,
                subject: e.subject.name,
                examDate: e.examDate,
                totalMarks: Number(e.totalMarks),
                passingMarks: Number(e.passingMarks),
            }));
        }
        // Published Examination Marks (Report Cards)
        const examMarks = await prisma_js_1.prisma.examMark.findMany({
            where: {
                studentId,
                exam: { isPublished: true },
            },
            include: {
                exam: {
                    select: {
                        id: true,
                        title: true,
                        examType: true,
                        examDate: true,
                        totalMarks: true,
                        passingMarks: true,
                        subject: { select: { id: true, name: true, code: true } },
                    },
                },
            },
            orderBy: { exam: { examDate: 'desc' } },
        });
        const formattedMarks = examMarks.map((m) => {
            const total = Number(m.exam.totalMarks);
            const score = Number(m.marksObtained);
            const passing = Number(m.exam.passingMarks);
            const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
            const isPassed = !m.isAbsent && score >= passing;
            return {
                id: m.id,
                examTitle: m.exam.title,
                examType: m.exam.examType,
                subject: m.exam.subject.name,
                examDate: m.exam.examDate,
                marksObtained: score,
                totalMarks: total,
                passingMarks: passing,
                percentage,
                isPassed,
                isAbsent: m.isAbsent,
                remarks: m.remarks,
            };
        });
        return res.json({
            success: true,
            data: {
                student: {
                    id: student.id,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    admissionNumber: student.admissionNumber,
                    batchName: activeBatch?.name || 'Class',
                    batchSchedule: activeBatch?.schedule || null,
                },
                subjects,
                homework,
                feedbacks: formattedFeedbacks,
                upcomingExams,
                marks: formattedMarks,
            },
        });
    }
    catch (err) {
        console.error('[Parent Student Academics Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch academic report' });
    }
}
/**
 * GET /api/parents/students/:studentId/homework
 * Child-specific homework tracking enriched with submission, grading, and overdue status.
 */
async function getParentStudentHomework(req, res) {
    try {
        if (req.user?.role !== 'PARENT') {
            return res.status(403).json({ success: false, error: 'Forbidden: Parent access only' });
        }
        const { studentId } = req.params;
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized for this student' });
        }
        const student = await prisma_js_1.prisma.student.findUnique({
            where: { id: studentId },
            include: {
                enrollments: {
                    where: { isActive: true },
                    select: { batchId: true },
                },
            },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found' });
        }
        const enrolledBatchIds = student.enrollments.map((e) => e.batchId).filter(Boolean);
        if (enrolledBatchIds.length === 0) {
            return res.json({ success: true, data: { homework: [] } });
        }
        const materials = await prisma_js_1.prisma.learningMaterial.findMany({
            where: {
                batchId: { in: enrolledBatchIds },
                type: 'HOMEWORK',
                isPublished: true,
            },
            include: {
                subject: { select: { id: true, name: true, code: true } },
                uploader: { select: { id: true, fullName: true } },
                submissions: {
                    where: { studentId },
                    select: {
                        id: true,
                        status: true,
                        submittedAt: true,
                        grade: true,
                        feedback: true,
                        fileUrl: true,
                        fileName: true,
                        isLate: true,
                    },
                },
            },
            orderBy: { dueDate: 'asc' },
        });
        const now = new Date();
        const homework = materials.map((m) => {
            const sub = m.submissions[0];
            const isSubmitted = !!sub;
            let status = 'PENDING';
            if (sub?.status === 'GRADED' || sub?.status === 'EVALUATED') {
                status = 'EVALUATED';
            }
            else if (isSubmitted) {
                status = 'SUBMITTED';
            }
            else if (m.dueDate && new Date(m.dueDate) < now) {
                status = 'OVERDUE';
            }
            return {
                id: m.id,
                title: m.title,
                description: m.description,
                subject: m.subject?.name || 'General',
                teacherName: m.uploader.fullName,
                dueDate: m.dueDate,
                createdAt: m.createdAt,
                fileUrl: m.fileUrl,
                fileName: m.fileName,
                isSubmitted,
                submissionStatus: status,
                submittedAt: sub?.submittedAt || null,
                grade: sub?.grade || null,
                feedback: sub?.feedback || null,
                submissionFileUrl: sub?.fileUrl || null,
                isLate: sub?.isLate || false,
            };
        });
        return res.json({
            success: true,
            data: { homework },
        });
    }
    catch (err) {
        console.error('[Parent Student Homework Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch student homework' });
    }
}
/**
 * GET /api/parents/students/:studentId/timetable
 * Child-specific structured weekly timetable reusing the core timetable resolver.
 */
async function getParentStudentTimetable(req, res) {
    try {
        if (req.user?.role !== 'PARENT') {
            return res.status(403).json({ success: false, error: 'Forbidden: Parent access only' });
        }
        const { studentId } = req.params;
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized for this student' });
        }
        const student = await prisma_js_1.prisma.student.findUnique({
            where: { id: studentId },
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
            return res.status(404).json({ success: false, error: 'Student not found' });
        }
        const activeBatch = student.enrollments[0]?.batch || null;
        const timetable = (0, timetable_resolver_js_1.resolveStructuredTimetable)(activeBatch);
        return res.json({
            success: true,
            data: { timetable },
        });
    }
    catch (err) {
        console.error('[Parent Student Timetable Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch student timetable' });
    }
}
