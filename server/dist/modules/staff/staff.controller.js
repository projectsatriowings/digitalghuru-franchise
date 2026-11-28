"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.experienceSchema = exports.qualificationSchema = exports.resetStaffPasswordSchema = exports.updateStaffStatusSchema = exports.updateStaffSchema = exports.createStaffSchema = void 0;
exports.listStaff = listStaff;
exports.getNextEmployeeCodeHandler = getNextEmployeeCodeHandler;
exports.createStaff = createStaff;
exports.getStaffById = getStaffById;
exports.updateStaff = updateStaff;
exports.updateStaffStatus = updateStaffStatus;
exports.assignStaffBatches = assignStaffBatches;
exports.resetStaffPassword = resetStaffPassword;
exports.uploadStaffPhoto = uploadStaffPhoto;
exports.getRawStaffPhoto = getRawStaffPhoto;
exports.getStaffPhoto = getStaffPhoto;
exports.addStaffQualification = addStaffQualification;
exports.updateStaffQualification = updateStaffQualification;
exports.deleteStaffQualification = deleteStaffQualification;
exports.addStaffExperience = addStaffExperience;
exports.updateStaffExperience = updateStaffExperience;
exports.deleteStaffExperience = deleteStaffExperience;
exports.uploadStaffDocument = uploadStaffDocument;
exports.downloadStaffDocument = downloadStaffDocument;
exports.deleteStaffDocument = deleteStaffDocument;
exports.getMyStaffProfile = getMyStaffProfile;
exports.getMyStaffDashboard = getMyStaffDashboard;
exports.getMyStaffTimetable = getMyStaffTimetable;
exports.getMyStaffStudents = getMyStaffStudents;
const prisma_js_1 = require("../../prisma.js");
const zod_1 = require("zod");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const security_js_1 = require("../../utils/security.js");
const staff_code_service_js_1 = require("./staff-code.service.js");
const storage_js_1 = require("../../utils/storage.js");
const student_authorization_service_js_1 = require("../students/student-authorization.service.js");
const timetable_resolver_js_1 = require("../students/timetable-resolver.js");
const attendance_controller_js_1 = require("../attendance/attendance.controller.js");
const cache_js_1 = require("../../utils/cache.js");
function safeParseDate(dateVal) {
    if (!dateVal || typeof dateVal !== 'string' || !dateVal.trim())
        return null;
    const d = new Date(dateVal.trim());
    return isNaN(d.getTime()) ? null : d;
}
const optionalPhoneValidator = zod_1.z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((val) => {
    if (!val)
        return true;
    if (/[a-zA-Z]/.test(val))
        return false;
    const digits = val.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
}, {
    message: 'Phone number must be between 10 and 15 digits and cannot contain letters',
});
const optionalEmailValidator = zod_1.z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((val) => {
    if (!val)
        return true;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val);
}, {
    message: 'Please enter a valid email address format (e.g. user@example.com)',
});
exports.createStaffSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2, 'Staff full name is required'),
    email: zod_1.z.string().trim().email('Valid email is required'),
    phone: optionalPhoneValidator,
    employeeCode: zod_1.z.string().optional().nullable(),
    designation: zod_1.z.string().min(2, 'Designation is required'), // e.g., "Senior Mathematics Faculty"
    qualification: zod_1.z.string().optional().nullable(),
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters').optional(),
    initialPassword: zod_1.z.string().min(6, 'Password must be at least 6 characters').optional(),
    temporaryPassword: zod_1.z.string().min(6, 'Password must be at least 6 characters').optional(),
    permissionsJson: zod_1.z.record(zod_1.z.any()).optional().nullable(),
    batchIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    avatarUrl: zod_1.z.string().optional().nullable(),
    photoUrl: zod_1.z.string().optional().nullable(),
    // Personal Details
    dob: zod_1.z.string().optional().nullable(),
    gender: zod_1.z.string().optional().nullable(),
    bloodGroup: zod_1.z.string().optional().nullable(),
    altPhone: optionalPhoneValidator,
    personalEmail: optionalEmailValidator,
    emergencyContactName: zod_1.z.string().optional().nullable(),
    emergencyContactRelation: zod_1.z.string().optional().nullable(),
    emergencyContactPhone: optionalPhoneValidator,
    // Addresses
    currentAddressLine1: zod_1.z.string().optional().nullable(),
    currentAddressLine2: zod_1.z.string().optional().nullable(),
    currentCity: zod_1.z.string().optional().nullable(),
    currentState: zod_1.z.string().optional().nullable(),
    currentPostalCode: zod_1.z.string().optional().nullable(),
    currentCountry: zod_1.z.string().optional().nullable(),
    permanentAddressLine1: zod_1.z.string().optional().nullable(),
    permanentAddressLine2: zod_1.z.string().optional().nullable(),
    permanentCity: zod_1.z.string().optional().nullable(),
    permanentState: zod_1.z.string().optional().nullable(),
    permanentPostalCode: zod_1.z.string().optional().nullable(),
    permanentCountry: zod_1.z.string().optional().nullable(),
    sameAsCurrentAddress: zod_1.z.boolean().optional(),
    // Employment Details
    department: zod_1.z.string().optional().nullable(),
    employmentType: zod_1.z.string().optional().nullable(),
    joiningDate: zod_1.z.string().optional().nullable(),
    probationEndDate: zod_1.z.string().optional().nullable(),
    workLocation: zod_1.z.string().optional().nullable(),
    employmentNotes: zod_1.z.string().optional().nullable(),
});
exports.updateStaffSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2).optional(),
    phone: optionalPhoneValidator,
    employeeCode: zod_1.z.string().optional(),
    designation: zod_1.z.string().min(2).optional(),
    qualification: zod_1.z.string().optional().nullable(),
    permissionsJson: zod_1.z.record(zod_1.z.any()).optional().nullable(),
    avatarUrl: zod_1.z.string().optional().nullable(),
    photoUrl: zod_1.z.string().optional().nullable(),
    // Personal Details
    dob: zod_1.z.string().optional().nullable(),
    gender: zod_1.z.string().optional().nullable(),
    bloodGroup: zod_1.z.string().optional().nullable(),
    altPhone: optionalPhoneValidator,
    personalEmail: optionalEmailValidator,
    emergencyContactName: zod_1.z.string().optional().nullable(),
    emergencyContactRelation: zod_1.z.string().optional().nullable(),
    emergencyContactPhone: optionalPhoneValidator,
    // Addresses
    currentAddressLine1: zod_1.z.string().optional().nullable(),
    currentAddressLine2: zod_1.z.string().optional().nullable(),
    currentCity: zod_1.z.string().optional().nullable(),
    currentState: zod_1.z.string().optional().nullable(),
    currentPostalCode: zod_1.z.string().optional().nullable(),
    currentCountry: zod_1.z.string().optional().nullable(),
    permanentAddressLine1: zod_1.z.string().optional().nullable(),
    permanentAddressLine2: zod_1.z.string().optional().nullable(),
    permanentCity: zod_1.z.string().optional().nullable(),
    permanentState: zod_1.z.string().optional().nullable(),
    permanentPostalCode: zod_1.z.string().optional().nullable(),
    permanentCountry: zod_1.z.string().optional().nullable(),
    sameAsCurrentAddress: zod_1.z.boolean().optional(),
    // Employment Details
    department: zod_1.z.string().optional().nullable(),
    employmentType: zod_1.z.string().optional().nullable(),
    joiningDate: zod_1.z.string().optional().nullable(),
    probationEndDate: zod_1.z.string().optional().nullable(),
    workLocation: zod_1.z.string().optional().nullable(),
    employmentNotes: zod_1.z.string().optional().nullable(),
});
exports.updateStaffStatusSchema = zod_1.z.object({
    isActive: zod_1.z.boolean(),
    reason: zod_1.z.string().optional(),
});
exports.resetStaffPasswordSchema = zod_1.z.object({
    password: zod_1.z.string().min(6, 'Password must be at least 6 characters').optional(),
    newPassword: zod_1.z.string().min(6, 'Password must be at least 6 characters').optional(),
    temporaryPassword: zod_1.z.string().min(6, 'Password must be at least 6 characters').optional(),
});
exports.qualificationSchema = zod_1.z.object({
    degree: zod_1.z.string().min(1, 'Degree or certification name is required'),
    fieldOfStudy: zod_1.z.string().optional().nullable(),
    institution: zod_1.z.string().min(1, 'Institution or university is required'),
    yearOfPassing: zod_1.z.coerce.number().int().min(1950).max(2100).optional().nullable(),
    gradeOrScore: zod_1.z.string().optional().nullable(),
    certificateUrl: zod_1.z.string().optional().nullable(),
});
exports.experienceSchema = zod_1.z.object({
    institutionName: zod_1.z.string().min(1, 'Institution / Employer name is required'),
    designation: zod_1.z.string().min(1, 'Designation / Role is required'),
    startYear: zod_1.z.coerce.number().int().min(1950).max(2100).optional().nullable(),
    endYear: zod_1.z.coerce.number().int().min(1950).max(2100).optional().nullable(),
    subjectsTaught: zod_1.z.string().optional().nullable(),
    totalYears: zod_1.z.coerce.number().optional().nullable(),
    notes: zod_1.z.string().optional().nullable(),
});
/**
 * List staff in the active institute
 */
async function listStaff(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId) {
            return res.status(400).json({ success: false, error: 'Institute context required' });
        }
        const search = (req.query.search || '').trim();
        const isActiveFilter = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
        const where = {
            instituteId,
        };
        if (isActiveFilter !== undefined) {
            where.user = { isActive: isActiveFilter };
        }
        if (search) {
            where.OR = [
                { employeeCode: { contains: search, mode: 'insensitive' } },
                { designation: { contains: search, mode: 'insensitive' } },
                { department: { contains: search, mode: 'insensitive' } },
                { user: { fullName: { contains: search, mode: 'insensitive' } } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
            ];
        }
        const staffList = await prisma_js_1.prisma.staffProfile.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                instituteId: true,
                userId: true,
                employeeCode: true,
                designation: true,
                department: true,
                employmentType: true,
                avatarUrl: true,
                permissionsJson: true,
                createdAt: true,
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        isActive: true,
                        lastLoginAt: true,
                        createdAt: true,
                    },
                },
                assignments: {
                    select: {
                        id: true,
                        batchId: true,
                        batch: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                academicYear: true,
                            },
                        },
                    },
                },
                batchSubjects: {
                    select: {
                        id: true,
                        batchId: true,
                        subjectId: true,
                        batch: { select: { id: true, name: true, code: true } },
                        subject: { select: { id: true, name: true, code: true } },
                    },
                },
            },
        });
        return res.json({
            success: true,
            data: { staff: staffList },
        });
    }
    catch (err) {
        console.error('[listStaff Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to list staff profiles' });
    }
}
/**
 * Get next auto-generated employee code with academy name
 */
async function getNextEmployeeCodeHandler(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId) {
            return res.status(400).json({ success: false, error: 'Institute context required' });
        }
        const employeeCode = await (0, staff_code_service_js_1.generateNextEmployeeCode)(prisma_js_1.prisma, instituteId);
        return res.json({
            success: true,
            data: { employeeCode, nextCode: employeeCode },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to generate next employee code' });
    }
}
/**
 * Create a new staff account (Academic Admin or Super Admin)
 */
async function createStaff(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId) {
            return res.status(400).json({ success: false, error: 'Institute context required' });
        }
        const parse = exports.createStaffSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message || 'Validation failed',
            });
        }
        const data = parse.data;
        const email = data.email.trim().toLowerCase();
        // Check unique email
        const existingUser = await prisma_js_1.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: `User with email '${email}' already exists in the system`,
            });
        }
        // Check unique phone if provided
        const phone = data.phone?.trim() || null;
        if (phone) {
            const existingPhone = await prisma_js_1.prisma.user.findUnique({ where: { phone } });
            if (existingPhone) {
                return res.status(409).json({
                    success: false,
                    error: `Phone number '${phone}' is already registered with another user (${existingPhone.fullName})`,
                });
            }
        }
        // Auto-generate employee code with academy name if not supplied
        let employeeCode = data.employeeCode?.trim() || '';
        if (!employeeCode) {
            employeeCode = await (0, staff_code_service_js_1.generateNextEmployeeCode)(prisma_js_1.prisma, instituteId);
        }
        else {
            // Check employee code uniqueness within institute
            const existingCode = await prisma_js_1.prisma.staffProfile.findUnique({
                where: {
                    instituteId_employeeCode: {
                        instituteId,
                        employeeCode,
                    },
                },
            });
            if (existingCode) {
                return res.status(409).json({
                    success: false,
                    error: `Employee code '${employeeCode}' already exists in this institute`,
                });
            }
        }
        const permanentPassword = data.password?.trim() ||
            data.initialPassword?.trim() ||
            data.temporaryPassword?.trim() ||
            `Staff@${(0, security_js_1.generateSecureRandomToken)(4)}2026`;
        const passwordHash = await (0, security_js_1.hashPassword)(permanentPassword);
        // Address sync logic
        const sameAsCurrent = data.sameAsCurrentAddress ?? false;
        const permLine1 = sameAsCurrent ? data.currentAddressLine1 : data.permanentAddressLine1;
        const permLine2 = sameAsCurrent ? data.currentAddressLine2 : data.permanentAddressLine2;
        const permCity = sameAsCurrent ? data.currentCity : data.permanentCity;
        const permState = sameAsCurrent ? data.currentState : data.permanentState;
        const permPostal = sameAsCurrent ? data.currentPostalCode : data.permanentPostalCode;
        const permCountry = sameAsCurrent ? (data.currentCountry || 'India') : (data.permanentCountry || 'India');
        const result = await prisma_js_1.prisma.$transaction(async (tx) => {
            // 1. Create User
            const user = await tx.user.create({
                data: {
                    email,
                    phone: data.phone?.trim() || null,
                    fullName: data.fullName.trim(),
                    passwordHash,
                    role: 'STAFF',
                    isActive: true,
                    mustChangePassword: false,
                },
            });
            // 2. Create Institute Membership
            await tx.instituteMembership.create({
                data: {
                    instituteId,
                    userId: user.id,
                    role: 'STAFF',
                    isActive: true,
                },
            });
            // 3. Create Staff Profile
            const staffPermissions = {
                ...(data.permissionsJson || {}),
                permanentPassword,
            };
            const staffProfile = await tx.staffProfile.create({
                data: {
                    instituteId,
                    userId: user.id,
                    employeeCode,
                    designation: data.designation.trim(),
                    qualification: data.qualification?.trim() || null,
                    permissionsJson: result.staffProfile.permissionsJson,
                    avatarUrl: data.avatarUrl?.trim() || data.photoUrl?.trim() || null,
                    // Personal Details
                    dob: safeParseDate(data.dob),
                    gender: data.gender || null,
                    bloodGroup: data.bloodGroup?.trim() || null,
                    altPhone: data.altPhone?.trim() || null,
                    personalEmail: data.personalEmail?.trim() || null,
                    emergencyContactName: data.emergencyContactName?.trim() || null,
                    emergencyContactRelation: data.emergencyContactRelation?.trim() || null,
                    emergencyContactPhone: data.emergencyContactPhone?.trim() || null,
                    // Current Address
                    currentAddressLine1: data.currentAddressLine1?.trim() || null,
                    currentAddressLine2: data.currentAddressLine2?.trim() || null,
                    currentCity: data.currentCity?.trim() || null,
                    currentState: data.currentState?.trim() || null,
                    currentPostalCode: data.currentPostalCode?.trim() || null,
                    currentCountry: data.currentCountry?.trim() || 'India',
                    // Permanent Address
                    permanentAddressLine1: permLine1?.trim() || null,
                    permanentAddressLine2: permLine2?.trim() || null,
                    permanentCity: permCity?.trim() || null,
                    permanentState: permState?.trim() || null,
                    permanentPostalCode: permPostal?.trim() || null,
                    permanentCountry: permCountry?.trim() || 'India',
                    sameAsCurrentAddress: sameAsCurrent,
                    // Employment Details
                    department: data.department?.trim() || null,
                    employmentType: data.employmentType || 'FULL_TIME',
                    joiningDate: safeParseDate(data.joiningDate) || new Date(),
                    probationEndDate: safeParseDate(data.probationEndDate),
                    workLocation: data.workLocation?.trim() || null,
                    employmentNotes: data.employmentNotes?.trim() || null,
                },
            });
            // 4. Batch assignments if supplied
            if (data.batchIds && data.batchIds.length > 0) {
                await tx.staffBatchAssignment.createMany({
                    data: data.batchIds.map((batchId) => ({
                        staffProfileId: staffProfile.id,
                        batchId,
                    })),
                });
            }
            // 5. Initial qualification if supplied
            if (data.qualification?.trim()) {
                await tx.staffQualification.create({
                    data: {
                        staffProfileId: staffProfile.id,
                        degree: data.qualification.trim(),
                        institution: 'Registered on Profile Provisioning',
                        fieldOfStudy: data.department?.trim() || null,
                    },
                });
            }
            // 6. Audit Log
            await tx.auditLog.create({
                data: {
                    instituteId,
                    userId: req.user?.userId || null,
                    action: 'STAFF_PROVISIONED',
                    entityType: 'StaffProfile',
                    entityId: staffProfile.id,
                    newValues: {
                        userId: user.id,
                        employeeCode: staffProfile.employeeCode,
                        designation: staffProfile.designation,
                    },
                },
            });
            return { user, staffProfile };
        });
        const institute = await prisma_js_1.prisma.institute.findUnique({
            where: { id: instituteId },
            select: { id: true, code: true, name: true },
        });
        return res.status(201).json({
            success: true,
            message: 'Permanent staff login created successfully',
            data: {
                staffId: result.staffProfile.id,
                employeeCode: result.staffProfile.employeeCode,
                user: {
                    id: result.user.id,
                    fullName: result.user.fullName,
                    email: result.user.email,
                    role: result.user.role,
                    mustChangePassword: false,
                },
                institute: institute || null,
                permanentPassword,
                temporaryPassword: permanentPassword,
                staff: {
                    id: result.staffProfile.id,
                    instituteId,
                    userId: result.user.id,
                    employeeCode: result.staffProfile.employeeCode,
                    designation: result.staffProfile.designation,
                    qualification: result.staffProfile.qualification,
                    department: result.staffProfile.department,
                    employmentType: result.staffProfile.employmentType,
                    permissionsJson: result.staffProfile.permissionsJson,
                    user: result.user,
                },
            },
        });
    }
    catch (err) {
        console.error('[Create Staff Error]', err);
        if (err.code === 'P2002') {
            const target = String(Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : err.meta?.target || '');
            if (target.includes('phone')) {
                const phone = req.body?.phone ? `'${req.body.phone}' ` : '';
                return res.status(409).json({
                    success: false,
                    error: `Phone number ${phone}already exists in the system. Please use a different phone number.`,
                });
            }
            if (target.includes('email')) {
                const email = req.body?.email ? `'${req.body.email}' ` : '';
                return res.status(409).json({
                    success: false,
                    error: `Email address ${email}is already registered with another user.`,
                });
            }
            if (target.includes('employeeCode')) {
                const code = req.body?.employeeCode ? `'${req.body.employeeCode}' ` : '';
                return res.status(409).json({
                    success: false,
                    error: `Employee code ${code}already exists in this institute. Please auto-generate or use a different code.`,
                });
            }
            return res.status(409).json({
                success: false,
                error: `A user or staff member with this ${target || 'information'} already exists.`,
            });
        }
        // Clean, user-friendly error message without leaking raw stack traces or Prisma internals
        let friendlyMessage = 'Failed to create staff account. Please verify all profile information and try again.';
        if (err.name === 'PrismaClientValidationError' || (err.message && (err.message.includes('invocation') || err.message.includes('Unknown argument')))) {
            friendlyMessage = 'Invalid staff profile details. Please check the entered dates and required fields.';
        }
        else if (err.message && !err.message.includes('\n') && !err.message.includes('Prisma') && !err.message.includes('C:\\')) {
            friendlyMessage = err.message;
        }
        return res.status(500).json({ success: false, error: friendlyMessage });
    }
}
/**
 * Get staff profile by ID with all relations
 */
async function getStaffById(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const staff = await prisma_js_1.prisma.staffProfile.findFirst({
            where: {
                id,
                instituteId, // strict institute isolation
            },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        isActive: true,
                        lastLoginAt: true,
                        createdAt: true,
                    },
                },
                assignments: {
                    select: {
                        id: true,
                        batchId: true,
                        batch: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                academicYear: true,
                            },
                        },
                    },
                },
                batchSubjects: {
                    include: {
                        batch: { select: { id: true, name: true, code: true } },
                        subject: { select: { id: true, name: true, code: true } },
                    },
                },
                qualifications: {
                    orderBy: { yearOfPassing: 'desc' },
                },
                experiences: {
                    orderBy: { startYear: 'desc' },
                },
                documents: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!staff) {
            return res.status(404).json({ success: false, error: 'Staff member not found in this institute' });
        }
        if (req.user?.role === 'STAFF' && staff.userId !== req.user.userId) {
            return res.status(403).json({ success: false, error: 'Forbidden: You can only view your own staff profile' });
        }
        return res.json({
            success: true,
            data: { staff },
        });
    }
    catch (err) {
        console.error('[getStaffById Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch staff profile' });
    }
}
/**
 * Update staff profile
 */
async function updateStaff(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId) {
            return res.status(403).json({ success: false, error: 'Institute context required' });
        }
        const { id } = req.params;
        const parse = exports.updateStaffSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message || 'Validation failed',
            });
        }
        const existing = await prisma_js_1.prisma.staffProfile.findFirst({
            where: { id, instituteId },
            include: { user: true },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Staff member not found' });
        }
        const data = parse.data;
        // Check employee code uniqueness if changed
        if (data.employeeCode && data.employeeCode.trim() !== existing.employeeCode) {
            const codeTaken = await prisma_js_1.prisma.staffProfile.findUnique({
                where: {
                    instituteId_employeeCode: {
                        instituteId,
                        employeeCode: data.employeeCode.trim(),
                    },
                },
            });
            if (codeTaken) {
                return res.status(409).json({
                    success: false,
                    error: `Employee code '${data.employeeCode.trim()}' is already used by another staff member`,
                });
            }
        }
        // Address sync logic
        const sameAsCurrent = data.sameAsCurrentAddress !== undefined ? data.sameAsCurrentAddress : existing.sameAsCurrentAddress;
        let permLine1 = data.permanentAddressLine1;
        let permLine2 = data.permanentAddressLine2;
        let permCity = data.permanentCity;
        let permState = data.permanentState;
        let permPostal = data.permanentPostalCode;
        let permCountry = data.permanentCountry;
        if (sameAsCurrent) {
            permLine1 = data.currentAddressLine1 !== undefined ? data.currentAddressLine1 : existing.currentAddressLine1;
            permLine2 = data.currentAddressLine2 !== undefined ? data.currentAddressLine2 : existing.currentAddressLine2;
            permCity = data.currentCity !== undefined ? data.currentCity : existing.currentCity;
            permState = data.currentState !== undefined ? data.currentState : existing.currentState;
            permPostal = data.currentPostalCode !== undefined ? data.currentPostalCode : existing.currentPostalCode;
            permCountry = data.currentCountry !== undefined ? data.currentCountry : existing.currentCountry;
        }
        await prisma_js_1.prisma.$transaction(async (tx) => {
            if (data.fullName || data.phone !== undefined) {
                await tx.user.update({
                    where: { id: existing.userId },
                    data: {
                        ...(data.fullName && { fullName: data.fullName.trim() }),
                        ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
                    },
                });
            }
            await tx.staffProfile.update({
                where: { id },
                data: {
                    ...(data.employeeCode !== undefined && { employeeCode: data.employeeCode?.trim() || null }),
                    ...(data.designation && { designation: data.designation.trim() }),
                    ...(data.qualification !== undefined && { qualification: data.qualification?.trim() || null }),
                    ...(data.permissionsJson && {
                        permissionsJson: {
                            ...(existing.permissionsJson || {}),
                            ...data.permissionsJson,
                            // Never wipe the stored permanentPassword during general profile updates
                            ...((existing.permissionsJson?.permanentPassword) && {
                                permanentPassword: existing.permissionsJson.permanentPassword,
                            }),
                        },
                    }),
                    ...((data.avatarUrl !== undefined || data.photoUrl !== undefined) && { avatarUrl: data.avatarUrl?.trim() || data.photoUrl?.trim() || null }),
                    // Personal Details
                    ...(data.dob !== undefined && { dob: data.dob ? new Date(data.dob) : null }),
                    ...(data.gender !== undefined && { gender: data.gender || null }),
                    ...(data.bloodGroup !== undefined && { bloodGroup: data.bloodGroup?.trim() || null }),
                    ...(data.altPhone !== undefined && { altPhone: data.altPhone?.trim() || null }),
                    ...(data.personalEmail !== undefined && { personalEmail: data.personalEmail?.trim() || null }),
                    ...(data.emergencyContactName !== undefined && { emergencyContactName: data.emergencyContactName?.trim() || null }),
                    ...(data.emergencyContactRelation !== undefined && { emergencyContactRelation: data.emergencyContactRelation?.trim() || null }),
                    ...(data.emergencyContactPhone !== undefined && { emergencyContactPhone: data.emergencyContactPhone?.trim() || null }),
                    // Current Address
                    ...(data.currentAddressLine1 !== undefined && { currentAddressLine1: data.currentAddressLine1?.trim() || null }),
                    ...(data.currentAddressLine2 !== undefined && { currentAddressLine2: data.currentAddressLine2?.trim() || null }),
                    ...(data.currentCity !== undefined && { currentCity: data.currentCity?.trim() || null }),
                    ...(data.currentState !== undefined && { currentState: data.currentState?.trim() || null }),
                    ...(data.currentPostalCode !== undefined && { currentPostalCode: data.currentPostalCode?.trim() || null }),
                    ...(data.currentCountry !== undefined && { currentCountry: data.currentCountry?.trim() || 'India' }),
                    // Permanent Address
                    ...(data.permanentAddressLine1 !== undefined || sameAsCurrent ? { permanentAddressLine1: permLine1?.trim() || null } : {}),
                    ...(data.permanentAddressLine2 !== undefined || sameAsCurrent ? { permanentAddressLine2: permLine2?.trim() || null } : {}),
                    ...(data.permanentCity !== undefined || sameAsCurrent ? { permanentCity: permCity?.trim() || null } : {}),
                    ...(data.permanentState !== undefined || sameAsCurrent ? { permanentState: permState?.trim() || null } : {}),
                    ...(data.permanentPostalCode !== undefined || sameAsCurrent ? { permanentPostalCode: permPostal?.trim() || null } : {}),
                    ...(data.permanentCountry !== undefined || sameAsCurrent ? { permanentCountry: permCountry?.trim() || 'India' } : {}),
                    ...(data.sameAsCurrentAddress !== undefined && { sameAsCurrentAddress: data.sameAsCurrentAddress }),
                    // Employment Details
                    ...(data.department !== undefined && { department: data.department?.trim() || null }),
                    ...(data.employmentType !== undefined && { employmentType: data.employmentType }),
                    ...(data.joiningDate !== undefined && { joiningDate: data.joiningDate ? new Date(data.joiningDate) : null }),
                    ...(data.probationEndDate !== undefined && { probationEndDate: data.probationEndDate ? new Date(data.probationEndDate) : null }),
                    ...(data.workLocation !== undefined && { workLocation: data.workLocation?.trim() || null }),
                    ...(data.employmentNotes !== undefined && { employmentNotes: data.employmentNotes?.trim() || null }),
                },
            });
            // Record Audit Log
            await tx.auditLog.create({
                data: {
                    instituteId,
                    userId: req.user?.userId || null,
                    action: 'STAFF_UPDATED',
                    entityType: 'StaffProfile',
                    entityId: id,
                    oldValues: { designation: existing.designation, employeeCode: existing.employeeCode },
                    newValues: data,
                },
            });
        });
        return res.json({
            success: true,
            message: 'Staff profile updated successfully',
        });
    }
    catch (err) {
        console.error('[updateStaff Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to update staff profile' });
    }
}
/**
 * Update Staff Status (Activate or Deactivate account)
 */
async function updateStaffStatus(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const parse = exports.updateStaffStatusSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message,
            });
        }
        const { isActive, reason } = parse.data;
        const staff = await prisma_js_1.prisma.staffProfile.findFirst({
            where: { id, instituteId },
            include: { user: true },
        });
        if (!staff) {
            return res.status(404).json({ success: false, error: 'Staff member not found' });
        }
        // Cannot deactivate yourself
        if (staff.userId === req.user?.userId) {
            return res.status(400).json({
                success: false,
                error: 'You cannot deactivate your own account',
            });
        }
        await prisma_js_1.prisma.$transaction([
            prisma_js_1.prisma.user.update({
                where: { id: staff.userId },
                data: { isActive },
            }),
            prisma_js_1.prisma.instituteMembership.updateMany({
                where: { instituteId, userId: staff.userId },
                data: { isActive },
            }),
            prisma_js_1.prisma.auditLog.create({
                data: {
                    instituteId,
                    userId: req.user?.userId || null,
                    action: isActive ? 'STAFF_ACTIVATED' : 'STAFF_DEACTIVATED',
                    entityType: 'StaffProfile',
                    entityId: id,
                    newValues: { isActive, reason },
                },
            }),
        ]);
        return res.json({
            success: true,
            message: `Staff account ${isActive ? 'activated' : 'deactivated'} successfully`,
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to update staff status' });
    }
}
/**
 * Assign batches and subjects to staff (Academic Admin & Super Admin)
 */
async function assignStaffBatches(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const { batchIds = [], assignments } = req.body;
        const staff = await prisma_js_1.prisma.staffProfile.findFirst({
            where: { id, instituteId },
        });
        if (!staff) {
            return res.status(404).json({ success: false, error: 'Staff member not found' });
        }
        // Determine all batch IDs involved
        let allBatchIds = Array.isArray(batchIds) ? [...batchIds] : [];
        if (Array.isArray(assignments)) {
            for (const a of assignments) {
                if (a.batchId && !allBatchIds.includes(a.batchId)) {
                    allBatchIds.push(a.batchId);
                }
            }
        }
        // Verify all batches belong to this institute
        if (allBatchIds.length > 0) {
            const batches = await prisma_js_1.prisma.batch.findMany({
                where: { id: { in: allBatchIds }, instituteId },
                include: { batchSubjects: true },
            });
            if (batches.length !== allBatchIds.length) {
                return res.status(400).json({ success: false, error: 'One or more invalid batch IDs provided' });
            }
            // If assignments provided, validate that each subject belongs to the selected batch
            if (Array.isArray(assignments)) {
                for (const a of assignments) {
                    const batch = batches.find((b) => b.id === a.batchId);
                    if (!batch) {
                        return res.status(400).json({ success: false, error: `Batch '${a.batchId}' not found` });
                    }
                    const validSubjectIds = batch.batchSubjects.map((bs) => bs.subjectId);
                    if (Array.isArray(a.subjectIds)) {
                        for (const sid of a.subjectIds) {
                            if (!validSubjectIds.includes(sid)) {
                                return res.status(400).json({
                                    success: false,
                                    error: `Subject '${sid}' does not belong to batch '${batch.name}'`,
                                });
                            }
                        }
                    }
                }
            }
        }
        await prisma_js_1.prisma.$transaction(async (tx) => {
            // 1. Update StaffBatchAssignment
            await tx.staffBatchAssignment.deleteMany({
                where: { staffProfileId: id },
            });
            if (allBatchIds.length > 0) {
                await tx.staffBatchAssignment.createMany({
                    data: allBatchIds.map((batchId) => ({
                        staffProfileId: id,
                        batchId,
                    })),
                });
            }
            // 2. Update BatchSubject assignments if assignments array is provided
            if (Array.isArray(assignments)) {
                await tx.batchSubject.updateMany({
                    where: { staffProfileId: id },
                    data: { staffProfileId: null },
                });
                for (const a of assignments) {
                    if (Array.isArray(a.subjectIds) && a.subjectIds.length > 0) {
                        await tx.batchSubject.updateMany({
                            where: {
                                batchId: a.batchId,
                                subjectId: { in: a.subjectIds },
                            },
                            data: { staffProfileId: id },
                        });
                    }
                }
            }
            await tx.auditLog.create({
                data: {
                    instituteId,
                    userId: req.user?.userId || null,
                    action: 'STAFF_BATCHES_ASSIGNED',
                    entityType: 'StaffProfile',
                    entityId: id,
                    newValues: { batchIds: allBatchIds, assignments },
                },
            });
        });
        return res.json({
            success: true,
            message: 'Staff batch and subject assignments updated successfully',
        });
    }
    catch (err) {
        console.error('[assignStaffBatches error]', err);
        return res.status(500).json({ success: false, error: 'Failed to assign batches and subjects to staff' });
    }
}
/**
 * Reset / Set permanent login password for a staff member (Academic Admin & Super Admin)
 */
async function resetStaffPassword(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const staff = await prisma_js_1.prisma.staffProfile.findFirst({
            where: { id, instituteId },
            include: { user: true },
        });
        if (!staff) {
            return res.status(404).json({ success: false, error: 'Staff member not found in this institute' });
        }
        if (req.user?.role === 'STAFF' && staff.userId !== req.user.userId) {
            return res.status(403).json({ success: false, error: 'Forbidden: Only administrators can reset staff passwords' });
        }
        const parse = exports.resetStaffPasswordSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message || 'Validation failed',
            });
        }
        const newPassword = parse.data.password?.trim() ||
            parse.data.newPassword?.trim() ||
            parse.data.temporaryPassword?.trim() ||
            `Staff@${(0, security_js_1.generateSecureRandomToken)(4)}2026`;
        const passwordHash = await (0, security_js_1.hashPassword)(newPassword);
        const existingPerms = staff.permissionsJson || {};
        const updatedPerms = {
            ...existingPerms,
            permanentPassword: newPassword,
        };
        await prisma_js_1.prisma.$transaction([
            prisma_js_1.prisma.user.update({
                where: { id: staff.userId },
                data: {
                    passwordHash,
                    mustChangePassword: false,
                },
            }),
            prisma_js_1.prisma.staffProfile.update({
                where: { id: staff.id },
                data: {
                    permissionsJson: updatedPerms,
                },
            }),
            prisma_js_1.prisma.auditLog.create({
                data: {
                    instituteId,
                    userId: req.user?.userId || null,
                    action: 'STAFF_PASSWORD_RESET',
                    entityType: 'StaffProfile',
                    entityId: staff.id,
                    newValues: { resetBy: req.user?.userId },
                },
            }),
        ]);
        const institute = await prisma_js_1.prisma.institute.findUnique({
            where: { id: instituteId },
            select: { id: true, code: true, name: true },
        });
        return res.json({
            success: true,
            message: 'Staff permanent password updated successfully',
            data: {
                staffId: staff.id,
                email: staff.user.email,
                permanentPassword: newPassword,
                institute: institute || null,
            },
        });
    }
    catch (err) {
        console.error('[Reset Staff Password Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to reset staff password' });
    }
}
/**
 * Upload Staff Photograph
 */
async function uploadStaffPhoto(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId) {
            return res.status(403).json({ success: false, error: 'Institute context required' });
        }
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image file uploaded' });
        }
        const relativeKey = (0, storage_js_1.getRelativeStorageKey)(instituteId, req.file.filename);
        if (id && id !== 'upload' && id !== 'upload-photo') {
            const staff = await prisma_js_1.prisma.staffProfile.findFirst({
                where: { id, instituteId },
            });
            if (!staff) {
                return res.status(404).json({ success: false, error: 'Staff member not found' });
            }
            await prisma_js_1.prisma.staffProfile.update({
                where: { id },
                data: { avatarUrl: relativeKey },
            });
            const photoUrl = `/api/staff/${id}/photo?v=${Date.now()}`;
            return res.json({
                success: true,
                message: 'Staff photograph uploaded successfully',
                data: { photoUrl, photoStorageKey: relativeKey, key: relativeKey },
            });
        }
        // Direct pre-creation upload (for staff onboarding modal)
        return res.json({
            success: true,
            message: 'Staff photograph uploaded successfully',
            data: {
                photoStorageKey: relativeKey,
                key: relativeKey,
                photoUrl: `/api/staff/photo-raw/${encodeURIComponent(relativeKey)}`,
            },
        });
    }
    catch (err) {
        console.error('[uploadStaffPhoto Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to upload staff photo' });
    }
}
/**
 * Stream Staff Photograph
 */
/**
 * Stream Raw Staff Photograph by Storage Key (for pre-creation preview or direct streaming)
 */
async function getRawStaffPhoto(req, res) {
    try {
        const rawKey = decodeURIComponent(req.params.key);
        const absPath = (0, storage_js_1.resolveAbsolutePath)(rawKey);
        if (!absPath || !fs_1.default.existsSync(absPath)) {
            return res.status(404).send('Photograph file not found');
        }
        const ext = path_1.default.extname(absPath).toLowerCase();
        const mimeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
        };
        res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return fs_1.default.createReadStream(absPath).pipe(res);
    }
    catch (err) {
        console.error('[getRawStaffPhoto Error]', err);
        return res.status(500).send('Error streaming photograph');
    }
}
async function getStaffPhoto(req, res) {
    try {
        const { id } = req.params;
        const staff = await prisma_js_1.prisma.staffProfile.findUnique({
            where: { id },
            select: { avatarUrl: true },
        });
        if (!staff || !staff.avatarUrl) {
            return res.status(404).send('Photograph not found');
        }
        const absPath = (0, storage_js_1.resolveAbsolutePath)(staff.avatarUrl);
        if (!absPath || !fs_1.default.existsSync(absPath)) {
            return res.status(404).send('Photograph file not found on disk');
        }
        const ext = path_1.default.extname(absPath).toLowerCase();
        const mimeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp',
        };
        res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return fs_1.default.createReadStream(absPath).pipe(res);
    }
    catch (err) {
        console.error('[getStaffPhoto Error]', err);
        return res.status(500).send('Error streaming photograph');
    }
}
/**
 * Add Qualification
 */
async function addStaffQualification(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const parse = exports.qualificationSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message || 'Validation failed',
            });
        }
        const staff = await prisma_js_1.prisma.staffProfile.findFirst({
            where: { id, instituteId },
        });
        if (!staff) {
            return res.status(404).json({ success: false, error: 'Staff member not found' });
        }
        const qual = await prisma_js_1.prisma.staffQualification.create({
            data: {
                staffProfileId: id,
                ...parse.data,
            },
        });
        return res.status(201).json({
            success: true,
            message: 'Qualification added successfully',
            data: { qualification: qual },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to add qualification' });
    }
}
/**
 * Update Qualification
 */
async function updateStaffQualification(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id, qid } = req.params;
        const parse = exports.qualificationSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message || 'Validation failed',
            });
        }
        const qual = await prisma_js_1.prisma.staffQualification.findFirst({
            where: { id: qid, staffProfileId: id, staffProfile: { instituteId } },
        });
        if (!qual) {
            return res.status(404).json({ success: false, error: 'Qualification record not found' });
        }
        const updated = await prisma_js_1.prisma.staffQualification.update({
            where: { id: qid },
            data: parse.data,
        });
        return res.json({
            success: true,
            message: 'Qualification updated successfully',
            data: { qualification: updated },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to update qualification' });
    }
}
/**
 * Delete Qualification
 */
async function deleteStaffQualification(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id, qid } = req.params;
        const qual = await prisma_js_1.prisma.staffQualification.findFirst({
            where: { id: qid, staffProfileId: id, staffProfile: { instituteId } },
        });
        if (!qual) {
            return res.status(404).json({ success: false, error: 'Qualification record not found' });
        }
        await prisma_js_1.prisma.staffQualification.delete({ where: { id: qid } });
        return res.json({
            success: true,
            message: 'Qualification deleted successfully',
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to delete qualification' });
    }
}
/**
 * Add Experience
 */
async function addStaffExperience(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id } = req.params;
        const parse = exports.experienceSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message || 'Validation failed',
            });
        }
        const staff = await prisma_js_1.prisma.staffProfile.findFirst({
            where: { id, instituteId },
        });
        if (!staff) {
            return res.status(404).json({ success: false, error: 'Staff member not found' });
        }
        const exp = await prisma_js_1.prisma.staffExperience.create({
            data: {
                staffProfileId: id,
                ...parse.data,
            },
        });
        return res.status(201).json({
            success: true,
            message: 'Experience entry added successfully',
            data: { experience: exp },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to add experience' });
    }
}
/**
 * Update Experience
 */
async function updateStaffExperience(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id, eid } = req.params;
        const parse = exports.experienceSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message || 'Validation failed',
            });
        }
        const exp = await prisma_js_1.prisma.staffExperience.findFirst({
            where: { id: eid, staffProfileId: id, staffProfile: { instituteId } },
        });
        if (!exp) {
            return res.status(404).json({ success: false, error: 'Experience record not found' });
        }
        const updated = await prisma_js_1.prisma.staffExperience.update({
            where: { id: eid },
            data: parse.data,
        });
        return res.json({
            success: true,
            message: 'Experience entry updated successfully',
            data: { experience: updated },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to update experience' });
    }
}
/**
 * Delete Experience
 */
async function deleteStaffExperience(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id, eid } = req.params;
        const exp = await prisma_js_1.prisma.staffExperience.findFirst({
            where: { id: eid, staffProfileId: id, staffProfile: { instituteId } },
        });
        if (!exp) {
            return res.status(404).json({ success: false, error: 'Experience record not found' });
        }
        await prisma_js_1.prisma.staffExperience.delete({ where: { id: eid } });
        return res.json({
            success: true,
            message: 'Experience entry deleted successfully',
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to delete experience' });
    }
}
/**
 * Upload Staff Document
 */
async function uploadStaffDocument(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId) {
            return res.status(403).json({ success: false, error: 'Institute context required' });
        }
        const { id } = req.params;
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No document file uploaded' });
        }
        const staff = await prisma_js_1.prisma.staffProfile.findFirst({
            where: { id, instituteId },
        });
        if (!staff) {
            return res.status(404).json({ success: false, error: 'Staff member not found' });
        }
        const documentType = req.body.documentType?.trim() || 'OTHER';
        const displayName = req.body.displayName?.trim() || req.file.originalname;
        const notes = req.body.notes?.trim() || null;
        const expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;
        const relativeKey = (0, storage_js_1.getRelativeStorageKey)(instituteId, req.file.filename);
        const doc = await prisma_js_1.prisma.staffDocument.create({
            data: {
                staffProfileId: id,
                instituteId,
                documentType,
                displayName,
                fileUrl: relativeKey,
                fileName: req.file.originalname,
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                expiryDate,
                notes,
            },
        });
        return res.status(201).json({
            success: true,
            message: 'Document uploaded successfully',
            data: { document: doc },
        });
    }
    catch (err) {
        console.error('[uploadStaffDocument Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to upload document' });
    }
}
/**
 * Download / Stream Staff Document
 */
async function downloadStaffDocument(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id, docId } = req.params;
        const doc = await prisma_js_1.prisma.staffDocument.findFirst({
            where: { id: docId, staffProfileId: id, instituteId },
            include: { staffProfile: { select: { userId: true } } },
        });
        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }
        if (req.user?.role === 'STAFF' && doc.staffProfile?.userId !== req.user.userId) {
            return res.status(403).json({ success: false, error: 'Forbidden: You can only download your own documents' });
        }
        const absPath = (0, storage_js_1.resolveAbsolutePath)(doc.fileUrl);
        if (!absPath || !fs_1.default.existsSync(absPath)) {
            return res.status(404).json({ success: false, error: 'Document file not found on disk' });
        }
        res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
        return fs_1.default.createReadStream(absPath).pipe(res);
    }
    catch (err) {
        console.error('[downloadStaffDocument Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to download document' });
    }
}
/**
 * Delete Staff Document
 */
async function deleteStaffDocument(req, res) {
    try {
        const instituteId = req.instituteId;
        const { id, docId } = req.params;
        const doc = await prisma_js_1.prisma.staffDocument.findFirst({
            where: { id: docId, staffProfileId: id, instituteId },
            include: { staffProfile: { select: { userId: true } } },
        });
        if (!doc) {
            return res.status(404).json({ success: false, error: 'Document not found' });
        }
        if (req.user?.role === 'STAFF' && doc.staffProfile?.userId !== req.user.userId) {
            return res.status(403).json({ success: false, error: 'Forbidden: You can only download your own documents' });
        }
        // Attempt to remove file from disk safely
        const absPath = (0, storage_js_1.resolveAbsolutePath)(doc.fileUrl);
        if (absPath && fs_1.default.existsSync(absPath)) {
            try {
                fs_1.default.unlinkSync(absPath);
            }
            catch (e) {
                console.warn('[deleteStaffDocument] File unlink failed:', e);
            }
        }
        await prisma_js_1.prisma.staffDocument.delete({ where: { id: docId } });
        return res.json({
            success: true,
            message: 'Document deleted successfully',
        });
    }
    catch (err) {
        console.error('[deleteStaffDocument Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to delete document' });
    }
}
/**
 * Get authenticated staff member's profile
 * GET /api/staff/my/profile
 */
async function getMyStaffProfile(req, res) {
    try {
        const instituteId = req.instituteId;
        const userId = req.user?.userId || req.user?.id;
        if (!instituteId || !userId) {
            return res.status(400).json({ success: false, error: 'Institute and user context required' });
        }
        const staff = await prisma_js_1.prisma.staffProfile.findFirst({
            where: {
                userId,
                instituteId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        phone: true,
                        role: true,
                        isActive: true,
                        lastLoginAt: true,
                        createdAt: true,
                    },
                },
                institute: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        phone: true,
                        email: true,
                        address: true,
                    },
                },
                assignments: {
                    include: {
                        batch: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                academicYear: true,
                                schedule: true,
                            },
                        },
                    },
                },
                batchSubjects: {
                    include: {
                        batch: { select: { id: true, name: true, code: true } },
                        subject: { select: { id: true, name: true, code: true } },
                    },
                },
                qualifications: {
                    orderBy: { yearOfPassing: 'desc' },
                },
                experiences: {
                    orderBy: { startYear: 'desc' },
                },
            },
        });
        if (!staff) {
            return res.status(404).json({ success: false, error: 'Staff profile not found' });
        }
        const assignedBatches = staff.assignments.map((a) => a.batch);
        const assignedSubjects = staff.batchSubjects.map((bs) => ({
            batchId: bs.batchId,
            batchName: bs.batch.name,
            subjectId: bs.subjectId,
            subjectName: bs.subject.name,
            subjectCode: bs.subject.code,
        }));
        return res.json({
            success: true,
            data: {
                profile: {
                    ...staff,
                    assignedBatches,
                    assignedSubjects,
                },
            },
        });
    }
    catch (err) {
        console.error('[getMyStaffProfile Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve staff profile' });
    }
}
/**
 * Get aggregated mobile dashboard data for authenticated teacher
 * GET /api/staff/my/dashboard
 */
async function getMyStaffDashboard(req, res) {
    try {
        const instituteId = req.instituteId;
        const userId = req.user?.userId || req.user?.id;
        if (!instituteId || !userId) {
            return res.status(400).json({ success: false, error: 'Institute and user context required' });
        }
        const cacheKey = `dashboard:staff:${userId}:${instituteId}`;
        if (req.query.refresh !== 'true') {
            const cached = cache_js_1.serverCache.get(cacheKey);
            if (cached) {
                return res.json(cached);
            }
        }
        const assignments = await (0, student_authorization_service_js_1.getAuthorizedStaffAssignments)(req, prisma_js_1.prisma);
        const authorizedBatchIds = assignments.authorizedBatchIds;
        const staffProfile = await prisma_js_1.prisma.staffProfile.findFirst({
            where: { userId, instituteId },
            include: {
                user: { select: { id: true, fullName: true, email: true, phone: true } },
                institute: { select: { id: true, name: true, code: true } },
                batchSubjects: {
                    include: {
                        batch: { select: { id: true, name: true, code: true, schedule: true } },
                        subject: { select: { id: true, name: true, code: true } },
                    },
                },
                assignments: {
                    include: {
                        batch: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                schedule: true,
                                _count: { select: { enrollments: { where: { isActive: true } } } },
                            },
                        },
                    },
                },
            },
        });
        if (!staffProfile) {
            return res.status(404).json({ success: false, error: 'Staff profile not found' });
        }
        const serverNow = new Date();
        const eventDate = (0, attendance_controller_js_1.getInstituteLocalDate)(serverNow);
        // Concurrently fetch all independent teacher dashboard sub-queries in parallel
        const [studentCount, pendingHomeworkCount, todayCheckIns, allBatches, recentNotifications,] = await Promise.all([
            // 1. Unique active students enrolled in teacher's batches
            prisma_js_1.prisma.student.count({
                where: {
                    instituteId,
                    status: 'ACTIVE',
                    enrollments: {
                        some: {
                            batchId: { in: authorizedBatchIds },
                            isActive: true,
                        },
                    },
                },
            }),
            // 2. Pending homework submissions needing evaluation
            prisma_js_1.prisma.homeworkSubmission.count({
                where: {
                    material: {
                        instituteId,
                        batchId: { in: authorizedBatchIds },
                    },
                    gradedAt: null,
                },
            }),
            // 3. Today's attendance summary in teacher's batches
            prisma_js_1.prisma.attendanceEvent.findMany({
                where: {
                    instituteId,
                    batchId: { in: authorizedBatchIds },
                    eventDate,
                    eventType: 'CHECK_IN',
                },
                select: { studentId: true, isLate: true },
            }),
            // 4. Today's scheduled periods for this staff
            prisma_js_1.prisma.batch.findMany({
                where: {
                    id: { in: authorizedBatchIds },
                    instituteId,
                    isActive: true,
                },
                include: {
                    batchSubjects: {
                        include: {
                            subject: true,
                            staffProfile: { include: { user: true } },
                        },
                    },
                },
            }),
            // 5. Recent notifications
            prisma_js_1.prisma.inAppNotification.findMany({
                where: {
                    userId,
                },
                orderBy: { createdAt: 'desc' },
                take: 5,
            }),
        ]);
        const uniquePresentStudents = new Set(todayCheckIns.map((e) => e.studentId)).size;
        const lateStudentsCount = todayCheckIns.filter((e) => e.isLate).length;
        const attendancePercentage = studentCount > 0 ? Math.round((uniquePresentStudents / studentCount) * 100) : 0;
        const todayClasses = [];
        for (const b of allBatches) {
            const timetable = (0, timetable_resolver_js_1.resolveStructuredTimetable)(b, serverNow);
            for (const slot of timetable.todaySlots) {
                const isThisStaff = slot.teacherName?.toLowerCase() === staffProfile.user.fullName.toLowerCase() ||
                    slot.staffProfileId === staffProfile.id ||
                    !slot.teacherName;
                if (isThisStaff) {
                    todayClasses.push({
                        ...slot,
                        batchId: b.id,
                        batchName: b.name,
                    });
                }
            }
        }
        todayClasses.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        const responsePayload = {
            success: true,
            data: {
                teacher: {
                    id: staffProfile.id,
                    fullName: staffProfile.user.fullName,
                    email: staffProfile.user.email,
                    phone: staffProfile.user.phone,
                    employeeCode: staffProfile.employeeCode,
                    designation: staffProfile.designation,
                    avatarUrl: staffProfile.avatarUrl,
                },
                institute: {
                    id: staffProfile.institute.id,
                    name: staffProfile.institute.name,
                    code: staffProfile.institute.code,
                },
                metrics: {
                    totalBatches: authorizedBatchIds.length,
                    totalSubjects: staffProfile.batchSubjects.length,
                    totalStudents: studentCount,
                    pendingHomeworkEvaluations: pendingHomeworkCount,
                    todayClassesCount: todayClasses.length,
                    todayAttendance: {
                        presentCount: uniquePresentStudents,
                        lateCount: lateStudentsCount,
                        totalEnrolled: studentCount,
                        percentage: attendancePercentage,
                    },
                },
                todayClasses,
                recentNotifications,
            },
        };
        cache_js_1.serverCache.set(cacheKey, responsePayload, 20000);
        return res.json(responsePayload);
    }
    catch (err) {
        console.error('[getMyStaffDashboard Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve staff dashboard' });
    }
}
/**
 * Get weekly structured timetable for authenticated teacher
 * GET /api/staff/my/timetable
 */
async function getMyStaffTimetable(req, res) {
    try {
        const instituteId = req.instituteId;
        const userId = req.user?.userId || req.user?.id;
        if (!instituteId || !userId) {
            return res.status(400).json({ success: false, error: 'Institute and user context required' });
        }
        const assignments = await (0, student_authorization_service_js_1.getAuthorizedStaffAssignments)(req, prisma_js_1.prisma);
        const authorizedBatchIds = assignments.authorizedBatchIds;
        const staffProfile = await prisma_js_1.prisma.staffProfile.findFirst({
            where: { userId, instituteId },
            include: { user: true },
        });
        if (!staffProfile) {
            return res.status(404).json({ success: false, error: 'Staff profile not found' });
        }
        const batches = await prisma_js_1.prisma.batch.findMany({
            where: {
                id: { in: authorizedBatchIds },
                instituteId,
                isActive: true,
            },
            include: {
                batchSubjects: {
                    include: {
                        subject: true,
                        staffProfile: { include: { user: true } },
                    },
                },
            },
        });
        const daysSchedule = {
            MONDAY: [],
            TUESDAY: [],
            WEDNESDAY: [],
            THURSDAY: [],
            FRIDAY: [],
            SATURDAY: [],
            SUNDAY: [],
        };
        const serverNow = new Date();
        for (const b of batches) {
            const timetable = (0, timetable_resolver_js_1.resolveStructuredTimetable)(b, serverNow);
            for (const day of timetable.days) {
                for (const slot of day.slots) {
                    const isThisStaff = slot.teacherName?.toLowerCase() === staffProfile.user.fullName.toLowerCase() ||
                        slot.staffProfileId === staffProfile.id ||
                        !slot.teacherName;
                    if (isThisStaff) {
                        daysSchedule[day.day].push({
                            ...slot,
                            batchId: b.id,
                            batchName: b.name,
                        });
                    }
                }
            }
        }
        for (const day of Object.keys(daysSchedule)) {
            daysSchedule[day].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        }
        return res.json({
            success: true,
            data: {
                schedule: daysSchedule,
                totalBatches: batches.length,
            },
        });
    }
    catch (err) {
        console.error('[getMyStaffTimetable Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve staff timetable' });
    }
}
/**
 * Get students list under the teacher's authorized scope
 * GET /api/staff/my/students
 */
async function getMyStaffStudents(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const assignments = await (0, student_authorization_service_js_1.getAuthorizedStaffAssignments)(req, prisma_js_1.prisma);
        const authorizedBatchIds = assignments.authorizedBatchIds;
        const batchIdFilter = req.query.batchId;
        const search = (req.query.search || '').trim().toLowerCase();
        const targetBatchIds = batchIdFilter
            ? authorizedBatchIds.filter((id) => id === batchIdFilter)
            : authorizedBatchIds;
        if (batchIdFilter && targetBatchIds.length === 0) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized for this batch' });
        }
        const serverNow = new Date();
        const eventDate = (0, attendance_controller_js_1.getInstituteLocalDate)(serverNow);
        const studentWhere = {
            instituteId,
            status: 'ACTIVE',
            enrollments: {
                some: {
                    batchId: { in: targetBatchIds },
                    isActive: true,
                },
            },
        };
        if (search) {
            const searchWords = search.trim().split(/\s+/).filter(Boolean);
            const searchConditions = [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { admissionNumber: { contains: search, mode: 'insensitive' } },
                { user: { fullName: { contains: search, mode: 'insensitive' } } },
            ];
            if (searchWords.length > 1) {
                searchConditions.push({
                    AND: searchWords.map((w) => ({
                        OR: [
                            { firstName: { contains: w, mode: 'insensitive' } },
                            { lastName: { contains: w, mode: 'insensitive' } },
                            { user: { fullName: { contains: w, mode: 'insensitive' } } },
                            { admissionNumber: { contains: w, mode: 'insensitive' } },
                        ],
                    })),
                });
            }
            studentWhere.OR = searchConditions;
        }
        const students = await prisma_js_1.prisma.student.findMany({
            where: studentWhere,
            include: {
                enrollments: {
                    where: { isActive: true, batchId: { in: targetBatchIds } },
                    include: {
                        batch: { select: { id: true, name: true, code: true } },
                        subject: { select: { id: true, name: true, code: true } },
                    },
                },
                attendanceEvents: {
                    where: {
                        instituteId,
                        eventDate,
                        batchId: { in: targetBatchIds },
                    },
                    orderBy: { sessionNumber: 'desc' },
                    select: {
                        id: true,
                        eventType: true,
                        eventTime: true,
                        sessionNumber: true,
                        method: true,
                        isLate: true,
                    },
                },
            },
            orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        });
        const timeFormatter = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
        const mapped = students.map((s) => {
            const latestCheckIn = s.attendanceEvents?.find((e) => e.eventType === 'CHECK_IN');
            const latestCheckOut = s.attendanceEvents?.find((e) => e.eventType === 'CHECK_OUT');
            const isCheckedIn = !!(latestCheckIn &&
                (!latestCheckOut || latestCheckOut.sessionNumber < latestCheckIn.sessionNumber));
            const isCheckedOut = !!(latestCheckIn &&
                latestCheckOut &&
                latestCheckOut.sessionNumber >= latestCheckIn.sessionNumber);
            const checkInTimeFormatted = latestCheckIn ? timeFormatter.format(latestCheckIn.eventTime) : null;
            const primaryEnrollment = s.enrollments[0];
            return {
                id: s.id,
                firstName: s.firstName,
                lastName: s.lastName,
                fullName: `${s.firstName} ${s.lastName}`.trim(),
                admissionNumber: s.admissionNumber,
                photoUrl: s.photoUrl,
                phone: s.phone,
                status: s.status,
                batchId: primaryEnrollment?.batchId,
                batchName: primaryEnrollment?.batch?.name || 'Unassigned',
                subjectName: primaryEnrollment?.subject?.name || null,
                todayStatus: isCheckedIn ? 'PRESENT' : isCheckedOut ? 'DEPARTED' : 'NOT_MARKED',
                isLate: latestCheckIn?.isLate || false,
                checkInTimeFormatted,
            };
        });
        return res.json({
            success: true,
            data: {
                students: mapped,
                total: mapped.length,
            },
        });
    }
    catch (err) {
        console.error('[getMyStaffStudents Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve staff students' });
    }
}
