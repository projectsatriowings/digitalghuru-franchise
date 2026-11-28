"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetAdminPasswordSchema = exports.updateAdminAccountSchema = exports.updateStatusSchema = exports.checkDuplicatesSchema = exports.updateInstituteSchema = exports.createInstituteSchema = void 0;
exports.checkInstituteDuplicates = checkInstituteDuplicates;
exports.listInstitutes = listInstitutes;
exports.createInstitute = createInstitute;
exports.getInstituteById = getInstituteById;
exports.updateInstitute = updateInstitute;
exports.updateInstituteStatus = updateInstituteStatus;
exports.getDashboardSummary = getDashboardSummary;
exports.updateAdminAccount = updateAdminAccount;
exports.resetAdminPassword = resetAdminPassword;
const prisma_js_1 = require("../../prisma.js");
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const security_js_1 = require("../../utils/security.js");
const cache_js_1 = require("../../utils/cache.js");
// Validation Schemas
exports.createInstituteSchema = zod_1.z.object({
    code: zod_1.z.string().min(2, 'Code must be at least 2 characters').max(20).regex(/^[A-Z0-9_-]+$/i, 'Alphanumeric, dash or underscore only').optional(),
    name: zod_1.z.string().min(2, 'Institute name is required').max(100),
    legalName: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    state: zod_1.z.string().optional(),
    postalCode: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional().or(zod_1.z.literal('')),
    email: zod_1.z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), zod_1.z.string().email('Invalid institute email').optional().nullable().or(zod_1.z.literal(''))),
    franchiseId: zod_1.z.string().uuid().optional().nullable(),
    // Duplicate confirmation flags
    confirmDuplicatePhone: zod_1.z.boolean().optional(),
    confirmDuplicateName: zod_1.z.boolean().optional(),
    // Required initial Academic Admin provisioning
    adminFullName: zod_1.z.string().min(2, 'Academic Admin full name is required').max(100),
    adminEmail: zod_1.z.string().email('Valid Academic Admin login email is required'),
    adminPhone: zod_1.z.string().optional().or(zod_1.z.literal('')),
    adminInitialPassword: zod_1.z.string().min(8, 'Admin password must be at least 8 characters'),
});
exports.updateInstituteSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    legalName: zod_1.z.string().optional().nullable(),
    address: zod_1.z.string().optional().nullable(),
    city: zod_1.z.string().optional().nullable(),
    state: zod_1.z.string().optional().nullable(),
    postalCode: zod_1.z.string().optional().nullable(),
    phone: zod_1.z.string().optional().nullable().or(zod_1.z.literal('')),
    email: zod_1.z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), zod_1.z.string().email('Invalid institute email').optional().nullable().or(zod_1.z.literal(''))),
    franchiseId: zod_1.z.string().uuid().optional().nullable(),
    confirmDuplicatePhone: zod_1.z.boolean().optional(),
    confirmDuplicateName: zod_1.z.boolean().optional(),
    settingsJson: zod_1.z.record(zod_1.z.any()).optional(),
});
exports.checkDuplicatesSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    email: zod_1.z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), zod_1.z.string().email('Invalid institute email').optional().nullable().or(zod_1.z.literal(''))),
    phone: zod_1.z.string().optional(),
    franchiseId: zod_1.z.string().uuid().optional().nullable(),
    city: zod_1.z.string().optional().nullable(),
    excludeInstituteId: zod_1.z.string().uuid().optional(),
});
/**
 * Check for duplicate institute email, name, or phone before submission
 */
async function checkInstituteDuplicates(req, res) {
    try {
        const parse = exports.checkDuplicatesSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message || 'Invalid parameters' });
        }
        const { name, email, phone, franchiseId, city, excludeInstituteId } = parse.data;
        let emailConflict = { isDuplicate: false };
        if (email && email.trim()) {
            const normEmail = email.trim().toLowerCase();
            const match = await prisma_js_1.prisma.institute.findFirst({
                where: {
                    email: { equals: normEmail, mode: 'insensitive' },
                    ...(excludeInstituteId ? { NOT: { id: excludeInstituteId } } : {}),
                },
                select: { id: true, code: true, name: true },
            });
            if (match) {
                emailConflict = {
                    isDuplicate: true,
                    message: `An institute with email '${normEmail}' already exists (${match.name} [${match.code}])`,
                };
            }
        }
        let nameConflict = { isDuplicate: false, isSameFranchise: false, allowCreation: true };
        if (name && name.trim()) {
            const normName = name.trim();
            const matches = await prisma_js_1.prisma.institute.findMany({
                where: {
                    name: { equals: normName, mode: 'insensitive' },
                    ...(excludeInstituteId ? { NOT: { id: excludeInstituteId } } : {}),
                },
                include: { franchise: { select: { id: true, code: true, name: true } } },
            });
            if (matches.length > 0) {
                const targetFranchiseId = franchiseId || null;
                const targetCity = (city || '').trim().toLowerCase();
                const sameScopeMatch = matches.find((m) => {
                    if (targetFranchiseId) {
                        return m.franchiseId === targetFranchiseId;
                    }
                    if (!m.franchiseId && !targetFranchiseId) {
                        const mCity = (m.city || '').trim().toLowerCase();
                        return mCity === targetCity || (!mCity && !targetCity);
                    }
                    return false;
                });
                if (sameScopeMatch) {
                    const scopeDesc = targetFranchiseId
                        ? `this franchise center (${sameScopeMatch.franchise?.code || ''})`
                        : `standalone campuses in ${sameScopeMatch.city || 'this location'}`;
                    nameConflict = {
                        isDuplicate: true,
                        isSameFranchise: true,
                        allowCreation: false,
                        message: `An institute named '${normName}' already exists within ${scopeDesc} (${sameScopeMatch.code}). Duplicate names in the same center are not permitted.`,
                    };
                }
                else {
                    const first = matches[0];
                    const loc = [first.city, first.state].filter(Boolean).join(', ');
                    nameConflict = {
                        isDuplicate: true,
                        isSameFranchise: false,
                        allowCreation: true,
                        warning: `Notice: Another institute named '${first.name}' exists at ${loc || 'another center'} (${first.franchise?.code || 'Standalone'} — ${first.code}). Legitimate creation is permitted.`,
                    };
                }
            }
        }
        let phoneConflict = { isDuplicate: false, requiresConfirmation: false };
        if (phone && phone.trim()) {
            const cleanPhone = phone.trim();
            const phoneDigits = cleanPhone.replace(/\D/g, '');
            if (phoneDigits.length >= 7) {
                const last10Digits = phoneDigits.slice(-10);
                const queryParams = [`%${last10Digits}`];
                let sql = `
          SELECT id, code, name, phone, city, state
          FROM "Institute"
          WHERE REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE $1
        `;
                if (excludeInstituteId) {
                    sql += ` AND id <> $2`;
                    queryParams.push(excludeInstituteId);
                }
                sql += ` LIMIT 1`;
                const matchingRows = await prisma_js_1.prisma.$queryRawUnsafe(sql, ...queryParams);
                const match = matchingRows[0] || null;
                if (match) {
                    const loc = [match.city, match.state].filter(Boolean).join(', ');
                    phoneConflict = {
                        isDuplicate: true,
                        requiresConfirmation: true,
                        warning: `Institute phone '${cleanPhone}' is already registered to ${match.name} (${match.code})${loc ? ` in ${loc}` : ''}. Explicit confirmation is required to use this shared phone number.`,
                        existingInstitute: {
                            id: match.id,
                            name: match.name,
                            code: match.code,
                            location: loc,
                        },
                    };
                }
            }
        }
        return res.json({
            success: true,
            data: {
                emailConflict,
                nameConflict,
                phoneConflict,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || 'Failed to check duplicates' });
    }
}
exports.updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_SETUP']),
    reason: zod_1.z.string().optional(),
});
exports.updateAdminAccountSchema = zod_1.z.object({
    fullName: zod_1.z.string().min(2, 'Full name must be at least 2 characters').max(100).optional(),
    email: zod_1.z.string().email('Invalid email address').optional(),
    phone: zod_1.z.string().optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
exports.resetAdminPasswordSchema = zod_1.z.object({
    password: zod_1.z.string().min(8, 'Password must be at least 8 characters').optional(),
});
/**
 * List institutes (SUPER_ADMIN only)
 */
async function listInstitutes(req, res) {
    try {
        const page = Math.max(1, parseInt(req.query.page || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
        const search = (req.query.search || '').trim();
        const status = req.query.status;
        const skip = (page - 1) * limit;
        const cacheKey = `institutes:list:${page}:${limit}:${status || ''}:${search}`;
        const cached = cache_js_1.serverCache.get(cacheKey);
        if (cached) {
            return res.json(cached);
        }
        const where = {};
        if (status && ['ACTIVE', 'SUSPENDED', 'PENDING_SETUP'].includes(status)) {
            where.status = status;
        }
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { city: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [total, institutes] = await Promise.all([
            prisma_js_1.prisma.institute.count({ where }),
            prisma_js_1.prisma.institute.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    franchise: {
                        select: {
                            id: true,
                            code: true,
                            name: true,
                            city: true,
                        },
                    },
                    _count: {
                        select: {
                            students: true,
                            staffProfiles: true,
                            batches: true,
                        },
                    },
                },
            }),
        ]);
        const responsePayload = {
            success: true,
            data: {
                institutes,
                pagination: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            },
        };
        cache_js_1.serverCache.set(cacheKey, responsePayload, 15000);
        return res.json(responsePayload);
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to list institutes' });
    }
}
/**
 * Create a new Institute (SUPER_ADMIN only)
 * Uses a safe transaction to create Institute + initial Academic Admin
 */
async function createInstitute(req, res) {
    try {
        const parse = exports.createInstituteSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message || 'Validation error',
            });
        }
        const data = parse.data;
        // 1. Admin Email Validation (globally unique across users)
        const normalizedAdminEmail = data.adminEmail.trim().toLowerCase();
        const existingUser = await prisma_js_1.prisma.user.findUnique({
            where: { email: normalizedAdminEmail },
        });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                conflictField: 'adminEmail',
                error: `User with email '${normalizedAdminEmail}' already exists`,
            });
        }
        // 2. Admin Phone Validation (globally unique across users if provided)
        if (data.adminPhone && data.adminPhone.trim()) {
            const cleanAdminPhone = data.adminPhone.trim();
            const existingPhone = await prisma_js_1.prisma.user.findUnique({
                where: { phone: cleanAdminPhone },
            });
            if (existingPhone) {
                return res.status(409).json({
                    success: false,
                    conflictField: 'adminPhone',
                    error: `User with phone '${cleanAdminPhone}' already exists`,
                });
            }
        }
        // 3. Institute Code Validation & Auto-generation
        let instituteCode = data.code?.toUpperCase().trim();
        if (!instituteCode) {
            // Securely generate unique readable institute code: INS-XXXXXX
            for (let attempt = 0; attempt < 15; attempt++) {
                const suffix = crypto_1.default.randomBytes(3).toString('hex').toUpperCase();
                const candidate = `INS-${suffix}`;
                const existing = await prisma_js_1.prisma.institute.findUnique({ where: { code: candidate } });
                if (!existing) {
                    instituteCode = candidate;
                    break;
                }
            }
            if (!instituteCode) {
                instituteCode = `INS-${Date.now().toString(36).toUpperCase()}`;
            }
        }
        else {
            // Check unique institute code if manually supplied
            const existingInst = await prisma_js_1.prisma.institute.findUnique({
                where: { code: instituteCode },
            });
            if (existingInst) {
                return res.status(409).json({
                    success: false,
                    conflictField: 'code',
                    error: `An institute with code '${instituteCode}' already exists`,
                });
            }
        }
        // 4. Institute Contact Email Validation (Globally unique, trimmed, case-insensitive)
        const rawEmail = (data.email || '').trim();
        const normalizedInstituteEmail = rawEmail ? rawEmail.toLowerCase() : null;
        if (normalizedInstituteEmail) {
            const existingInstEmail = await prisma_js_1.prisma.institute.findFirst({
                where: {
                    email: { equals: normalizedInstituteEmail, mode: 'insensitive' },
                },
                select: { id: true, code: true, name: true, email: true },
            });
            if (existingInstEmail) {
                return res.status(409).json({
                    success: false,
                    conflictField: 'email',
                    error: `An institute with email '${normalizedInstituteEmail}' already exists (${existingInstEmail.name} [${existingInstEmail.code}])`,
                });
            }
        }
        // 5. Institute Name Validation (Case-insensitive check within same franchise or standalone scope)
        const trimmedName = data.name.trim();
        const targetFranchiseId = data.franchiseId || null;
        const sameNameInstitutes = await prisma_js_1.prisma.institute.findMany({
            where: {
                name: { equals: trimmedName, mode: 'insensitive' },
            },
            select: {
                id: true,
                code: true,
                name: true,
                city: true,
                state: true,
                franchiseId: true,
                franchise: { select: { code: true, name: true } },
            },
        });
        let nameWarning = null;
        if (sameNameInstitutes.length > 0) {
            const sameScopeMatch = sameNameInstitutes.find((inst) => {
                if (targetFranchiseId) {
                    return inst.franchiseId === targetFranchiseId;
                }
                if (!inst.franchiseId && !targetFranchiseId) {
                    const instCity = (inst.city || '').trim().toLowerCase();
                    const targetCity = (data.city || '').trim().toLowerCase();
                    return instCity === targetCity || (!instCity && !targetCity);
                }
                return false;
            });
            if (sameScopeMatch) {
                const scopeDesc = targetFranchiseId
                    ? `this franchise center (${sameScopeMatch.franchise?.code || ''})`
                    : `standalone campuses in ${sameScopeMatch.city || 'this location'}`;
                return res.status(409).json({
                    success: false,
                    conflictField: 'name',
                    error: `An institute with name '${trimmedName}' already exists within ${scopeDesc} (${sameScopeMatch.code})`,
                });
            }
            // If matching in different franchise or different location:
            const firstMatch = sameNameInstitutes[0];
            const loc = [firstMatch.city, firstMatch.state].filter(Boolean).join(', ');
            nameWarning = `Notice: Another institute named '${firstMatch.name}' exists at ${loc || 'another center'} (${firstMatch.franchise?.code || 'Standalone'} — ${firstMatch.code}). Legitimate creation is permitted.`;
        }
        // 6. Institute Phone Validation (Whitespace & format normalization, duplicate warning with explicit confirmation)
        const rawPhone = (data.phone || '').trim();
        const normalizedPhoneDigits = rawPhone.replace(/\D/g, '');
        let phoneWarning = null;
        if (normalizedPhoneDigits.length >= 7) {
            const last10Digits = normalizedPhoneDigits.slice(-10);
            const matchingRows = await prisma_js_1.prisma.$queryRawUnsafe(`
        SELECT id, code, name, phone, city, state
        FROM "Institute"
        WHERE REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE $1
        LIMIT 1
      `, `%${last10Digits}`);
            const matchingPhoneInst = matchingRows[0] || null;
            if (matchingPhoneInst) {
                const loc = [matchingPhoneInst.city, matchingPhoneInst.state].filter(Boolean).join(', ');
                const phoneMsg = `Institute phone '${rawPhone}' is already registered to ${matchingPhoneInst.name} (${matchingPhoneInst.code})${loc ? ` in ${loc}` : ''}.`;
                if (data.confirmDuplicatePhone !== true) {
                    return res.status(409).json({
                        success: false,
                        requiresConfirmation: true,
                        warningType: 'DUPLICATE_PHONE',
                        conflictField: 'phone',
                        error: `${phoneMsg} Explicit confirmation is required to proceed with this shared phone number.`,
                        existingInstitute: {
                            id: matchingPhoneInst.id,
                            name: matchingPhoneInst.name,
                            code: matchingPhoneInst.code,
                            location: loc,
                        },
                    });
                }
                else {
                    phoneWarning = `${phoneMsg} (Confirmed by administrator).`;
                }
            }
        }
        // 7. Execute in Transaction with Concurrency Advisory Lock on Normalized Institute Email
        const result = await prisma_js_1.prisma.$transaction(async (tx) => {
            // Concurrency safety: acquire transaction-scoped advisory lock on hashed normalized email
            if (normalizedInstituteEmail) {
                await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext($1))`, `inst_email_${normalizedInstituteEmail}`);
                // Re-verify inside lock to prevent concurrent insert race condition
                const doubleCheck = await tx.institute.findFirst({
                    where: {
                        email: { equals: normalizedInstituteEmail, mode: 'insensitive' },
                    },
                });
                if (doubleCheck) {
                    throw new Error(`An institute with email '${normalizedInstituteEmail}' already exists (${doubleCheck.name} [${doubleCheck.code}])`);
                }
            }
            const institute = await tx.institute.create({
                data: {
                    code: instituteCode,
                    name: trimmedName,
                    legalName: data.legalName?.trim() || null,
                    address: data.address?.trim() || null,
                    city: data.city?.trim() || null,
                    state: data.state?.trim() || null,
                    postalCode: data.postalCode?.trim() || null,
                    phone: rawPhone || null,
                    email: normalizedInstituteEmail,
                    franchiseId: targetFranchiseId,
                    status: 'ACTIVE',
                    settingsJson: {
                        initialPassword: data.adminInitialPassword,
                    },
                },
            });
            const passwordHash = await (0, security_js_1.hashPassword)(data.adminInitialPassword);
            const adminUser = await tx.user.create({
                data: {
                    email: normalizedAdminEmail,
                    phone: data.adminPhone?.trim() || null,
                    fullName: data.adminFullName.trim(),
                    passwordHash,
                    role: 'ACADEMIC_ADMIN',
                    isActive: true,
                    mustChangePassword: true, // Forces password change on initial login
                },
            });
            // Create membership
            await tx.instituteMembership.create({
                data: {
                    instituteId: institute.id,
                    userId: adminUser.id,
                    role: 'ACADEMIC_ADMIN',
                    isActive: true,
                },
            });
            // Record Audit Log
            await tx.auditLog.create({
                data: {
                    instituteId: institute.id,
                    userId: req.user?.userId || null,
                    action: 'INSTITUTE_CREATED',
                    entityType: 'Institute',
                    entityId: institute.id,
                    newValues: {
                        code: institute.code,
                        name: institute.name,
                        adminUserId: adminUser.id,
                        adminEmail: adminUser.email,
                    },
                },
            });
            return { institute, adminUser };
        });
        return res.status(201).json({
            success: true,
            message: 'Institute and initial Academic Admin created successfully',
            warnings: [nameWarning, phoneWarning].filter(Boolean),
            data: {
                institute: result.institute,
                initialAdmin: {
                    id: result.adminUser.id,
                    email: result.adminUser.email,
                    fullName: result.adminUser.fullName,
                    phone: result.adminUser.phone,
                    role: result.adminUser.role,
                    isActive: result.adminUser.isActive,
                    mustChangePassword: result.adminUser.mustChangePassword,
                },
            },
        });
    }
    catch (err) {
        if (err.code === 'P2002') {
            const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'unique constraint';
            return res.status(409).json({
                success: false,
                error: `A record with this ${target} already exists. Please verify institute email, code, and admin credentials.`,
            });
        }
        if (err.message && err.message.includes('already exists')) {
            return res.status(409).json({ success: false, error: err.message });
        }
        console.error('[Create Institute Error]', err);
        return res.status(500).json({ success: false, error: err.message || 'Failed to create institute' });
    }
}
/**
 * Get Institute details by ID (Super Admin can view any, Academic Admin only their own)
 */
async function getInstituteById(req, res) {
    try {
        const { id } = req.params;
        // Academic/Branch admins can view their active institute; Franchise owners can view any assigned branch
        const assignedBranchIds = req.assignedBranchIds || [];
        const isOwnerBranch = req.user?.role === 'FRANCHISE_OWNER' && assignedBranchIds.includes(id);
        if (req.user?.role !== 'SUPER_ADMIN' && req.instituteId !== id && !isOwnerBranch) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: You do not have permission to view another institute',
            });
        }
        const institute = await prisma_js_1.prisma.institute.findUnique({
            where: { id },
            include: {
                franchise: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        city: true,
                        ownerName: true,
                    },
                },
                _count: {
                    select: {
                        students: true,
                        staffProfiles: true,
                        batches: true,
                        subjects: true,
                    },
                },
                memberships: {
                    where: { role: 'ACADEMIC_ADMIN' },
                    include: {
                        user: {
                            select: {
                                id: true,
                                fullName: true,
                                email: true,
                                phone: true,
                                role: true,
                                isActive: true,
                                mustChangePassword: true,
                                lastLoginAt: true,
                                createdAt: true,
                            },
                        },
                    },
                    orderBy: { joinedAt: 'asc' },
                },
            },
        });
        if (!institute) {
            return res.status(404).json({ success: false, error: 'Institute not found' });
        }
        const adminUser = institute.memberships?.[0]?.user || null;
        const settings = institute.settingsJson || {};
        const adminAccount = adminUser
            ? {
                ...adminUser,
                initialPassword: settings.initialPassword ||
                    (adminUser.mustChangePassword ? 'Password#123' : null),
            }
            : null;
        return res.json({
            success: true,
            data: {
                institute,
                adminAccount,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to fetch institute details' });
    }
}
/**
 * Update Institute details
 */
async function updateInstitute(req, res) {
    try {
        const { id } = req.params;
        // Academic admin can only update their own institute
        if (req.user?.role !== 'SUPER_ADMIN' && req.instituteId !== id) {
            return res.status(403).json({
                success: false,
                error: 'Forbidden: You cannot modify another institute',
            });
        }
        const parse = exports.updateInstituteSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message || 'Invalid input data',
            });
        }
        const data = parse.data;
        const existing = await prisma_js_1.prisma.institute.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Institute not found' });
        }
        // 1. Email check if changing email (exclude self)
        let normalizedEmail = undefined;
        if (data.email !== undefined) {
            const rawEmail = (data.email || '').trim();
            normalizedEmail = rawEmail ? rawEmail.toLowerCase() : null;
            if (normalizedEmail) {
                const conflictInst = await prisma_js_1.prisma.institute.findFirst({
                    where: {
                        email: { equals: normalizedEmail, mode: 'insensitive' },
                        NOT: { id },
                    },
                    select: { id: true, code: true, name: true, email: true },
                });
                if (conflictInst) {
                    return res.status(409).json({
                        success: false,
                        conflictField: 'email',
                        error: `An institute with email '${normalizedEmail}' already exists (${conflictInst.name} [${conflictInst.code}])`,
                    });
                }
            }
        }
        // 2. Name check if changing name or franchise (exclude self)
        const targetName = data.name !== undefined ? data.name.trim() : existing.name;
        const targetFranchiseId = data.franchiseId !== undefined ? data.franchiseId : existing.franchiseId;
        const targetCity = data.city !== undefined ? (data.city || '').trim().toLowerCase() : (existing.city || '').trim().toLowerCase();
        if (data.name !== undefined || data.franchiseId !== undefined) {
            const sameNameInstitutes = await prisma_js_1.prisma.institute.findMany({
                where: {
                    name: { equals: targetName, mode: 'insensitive' },
                    NOT: { id },
                },
                select: { id: true, code: true, name: true, city: true, franchiseId: true, franchise: { select: { code: true } } },
            });
            if (sameNameInstitutes.length > 0) {
                const sameScopeMatch = sameNameInstitutes.find((inst) => {
                    if (targetFranchiseId) {
                        return inst.franchiseId === targetFranchiseId;
                    }
                    if (!inst.franchiseId && !targetFranchiseId) {
                        const instCity = (inst.city || '').trim().toLowerCase();
                        return instCity === targetCity || (!instCity && !targetCity);
                    }
                    return false;
                });
                if (sameScopeMatch) {
                    const scopeDesc = targetFranchiseId ? 'this franchise center' : `standalone campuses in ${sameScopeMatch.city || 'this location'}`;
                    return res.status(409).json({
                        success: false,
                        conflictField: 'name',
                        error: `An institute with name '${targetName}' already exists within ${scopeDesc} (${sameScopeMatch.code})`,
                    });
                }
            }
        }
        // 3. Phone check if changing phone (exclude self)
        if (data.phone !== undefined) {
            const rawPhone = (data.phone || '').trim();
            const phoneDigits = rawPhone.replace(/\D/g, '');
            if (phoneDigits.length >= 7) {
                const last10Digits = phoneDigits.slice(-10);
                const matchingRows = await prisma_js_1.prisma.$queryRawUnsafe(`
          SELECT id, code, name, phone, city, state
          FROM "Institute"
          WHERE REGEXP_REPLACE(COALESCE(phone, ''), '\\D', '', 'g') LIKE $1
            AND id <> $2
          LIMIT 1
        `, `%${last10Digits}`, id);
                const matchingPhoneInst = matchingRows[0] || null;
                if (matchingPhoneInst && data.confirmDuplicatePhone !== true) {
                    const loc = matchingPhoneInst.city ? ` in ${matchingPhoneInst.city}` : '';
                    return res.status(409).json({
                        success: false,
                        requiresConfirmation: true,
                        warningType: 'DUPLICATE_PHONE',
                        conflictField: 'phone',
                        error: `Institute phone '${rawPhone}' is already registered to ${matchingPhoneInst.name} (${matchingPhoneInst.code})${loc}. Explicit confirmation is required to proceed with this shared phone number.`,
                    });
                }
            }
        }
        const updatePayload = { ...data };
        if (normalizedEmail !== undefined) {
            updatePayload.email = normalizedEmail;
        }
        if (data.name !== undefined) {
            updatePayload.name = data.name.trim();
        }
        if (data.legalName !== undefined) {
            updatePayload.legalName = data.legalName ? data.legalName.trim() : null;
        }
        if (data.address !== undefined) {
            updatePayload.address = data.address ? data.address.trim() : null;
        }
        if (data.city !== undefined) {
            updatePayload.city = data.city ? data.city.trim() : null;
        }
        if (data.state !== undefined) {
            updatePayload.state = data.state ? data.state.trim() : null;
        }
        if (data.postalCode !== undefined) {
            updatePayload.postalCode = data.postalCode ? data.postalCode.trim() : null;
        }
        if (data.phone !== undefined) {
            updatePayload.phone = data.phone ? data.phone.trim() : null;
        }
        delete updatePayload.confirmDuplicatePhone;
        delete updatePayload.confirmDuplicateName;
        const updated = await prisma_js_1.prisma.institute.update({
            where: { id },
            data: updatePayload,
        });
        // Record Audit Log
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId: id,
                userId: req.user?.userId || null,
                action: 'INSTITUTE_UPDATED',
                entityType: 'Institute',
                entityId: id,
                oldValues: existing,
                newValues: updated,
            },
        });
        return res.json({
            success: true,
            message: 'Institute updated successfully',
            data: { institute: updated },
        });
    }
    catch (err) {
        if (err.code === 'P2002') {
            const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'unique constraint';
            return res.status(409).json({
                success: false,
                error: `A record with this ${target} already exists.`,
            });
        }
        console.error('[Update Institute Error]', err);
        return res.status(500).json({ success: false, error: err.message || 'Failed to update institute' });
    }
}
/**
 * Update Institute Status (Activate or Suspend - SUPER_ADMIN only)
 */
async function updateInstituteStatus(req, res) {
    try {
        const { id } = req.params;
        const parse = exports.updateStatusSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message || 'Invalid status',
            });
        }
        const { status, reason } = parse.data;
        const existing = await prisma_js_1.prisma.institute.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Institute not found' });
        }
        const updated = await prisma_js_1.prisma.institute.update({
            where: { id },
            data: { status },
        });
        cache_js_1.serverCache.invalidate();
        // Record Audit Log
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId: id,
                userId: req.user?.userId || null,
                action: status === 'ACTIVE' ? 'INSTITUTE_ACTIVATED' : 'INSTITUTE_SUSPENDED',
                entityType: 'Institute',
                entityId: id,
                oldValues: { status: existing.status },
                newValues: { status, reason },
            },
        });
        return res.json({
            success: true,
            message: `Institute status updated to ${status}`,
            data: { institute: updated },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to update institute status' });
    }
}
/**
 * Dashboard Summary Metrics
 * Super Admin gets platform counts; Academic Admin gets institute-scoped counts.
 */
async function getDashboardSummary(req, res) {
    try {
        if (req.user?.role === 'SUPER_ADMIN') {
            const cacheKey = 'institutes:dashboard:super-admin';
            const cached = cache_js_1.serverCache.get(cacheKey);
            if (cached) {
                return res.json(cached);
            }
            const [totalInstitutes, activeInstitutes, suspendedInstitutes, totalUsers, totalStudents, totalFranchises, activeFranchises, totalCourses, publishedCourses,] = await Promise.all([
                prisma_js_1.prisma.institute.count(),
                prisma_js_1.prisma.institute.count({ where: { status: 'ACTIVE' } }),
                prisma_js_1.prisma.institute.count({ where: { status: 'SUSPENDED' } }),
                prisma_js_1.prisma.user.count(),
                prisma_js_1.prisma.student.count(),
                prisma_js_1.prisma.franchise.count(),
                prisma_js_1.prisma.franchise.count({ where: { status: 'ACTIVE' } }),
                prisma_js_1.prisma.globalCourse.count(),
                prisma_js_1.prisma.globalCourse.count({ where: { status: 'PUBLISHED' } }),
            ]);
            const responsePayload = {
                success: true,
                data: {
                    role: 'SUPER_ADMIN',
                    totalInstitutes,
                    activeInstitutes,
                    suspendedInstitutes,
                    totalUsers,
                    totalStudents,
                    totalFranchises,
                    activeFranchises,
                    totalCourses,
                    publishedCourses,
                },
            };
            cache_js_1.serverCache.set(cacheKey, responsePayload, 15000);
            return res.json(responsePayload);
        }
        // Academic Admin or Staff: Institute-scoped metrics
        const instituteId = req.instituteId;
        if (!instituteId) {
            return res.status(400).json({ success: false, error: 'Institute context required' });
        }
        const [studentCounts, totalStaff, totalBatches, totalSubjects, institute,] = await Promise.all([
            prisma_js_1.prisma.student.groupBy({
                by: ['status'],
                where: { instituteId },
                _count: { _all: true },
            }),
            prisma_js_1.prisma.staffProfile.count({ where: { instituteId } }),
            prisma_js_1.prisma.batch.count({ where: { instituteId } }),
            prisma_js_1.prisma.subject.count({ where: { instituteId } }),
            prisma_js_1.prisma.institute.findUnique({
                where: { id: instituteId },
                select: { id: true, name: true, code: true, status: true },
            }),
        ]);
        let activeStudents = 0;
        let passedOutStudents = 0;
        let discontinuedStudents = 0;
        for (const sc of studentCounts) {
            if (sc.status === 'ACTIVE')
                activeStudents = sc._count._all;
            else if (sc.status === 'PASSED_OUT')
                passedOutStudents = sc._count._all;
            else if (sc.status === 'DISCONTINUED')
                discontinuedStudents = sc._count._all;
        }
        return res.json({
            success: true,
            data: {
                role: req.user?.role,
                institute,
                metrics: {
                    totalStudents: activeStudents + passedOutStudents + discontinuedStudents,
                    activeStudents,
                    passedOutStudents,
                    discontinuedStudents,
                    totalStaff,
                    totalBatches,
                    totalSubjects,
                },
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to fetch dashboard summary' });
    }
}
/**
 * Update Academic Admin Account Details (SUPER_ADMIN only)
 * Updates permitted user fields (fullName, email, phone, isActive)
 */
async function updateAdminAccount(req, res) {
    try {
        const { id } = req.params;
        const parse = exports.updateAdminAccountSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message || 'Invalid input data',
            });
        }
        const institute = await prisma_js_1.prisma.institute.findUnique({ where: { id } });
        if (!institute) {
            return res.status(404).json({ success: false, error: 'Institute not found' });
        }
        const membership = await prisma_js_1.prisma.instituteMembership.findFirst({
            where: { instituteId: id, role: 'ACADEMIC_ADMIN' },
            include: { user: true },
            orderBy: { joinedAt: 'asc' },
        });
        if (!membership || !membership.user) {
            return res.status(404).json({
                success: false,
                error: 'No Academic Admin account found for this institute',
            });
        }
        const data = parse.data;
        // Check duplicate email if changing
        if (data.email) {
            const normalizedEmail = data.email.trim().toLowerCase();
            const existing = await prisma_js_1.prisma.user.findFirst({
                where: {
                    email: normalizedEmail,
                    NOT: { id: membership.userId },
                },
            });
            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: `User with email '${normalizedEmail}' already exists`,
                });
            }
        }
        // Check duplicate phone if changing
        if (data.phone) {
            const cleanPhone = data.phone.trim();
            const existingPhone = await prisma_js_1.prisma.user.findFirst({
                where: {
                    phone: cleanPhone,
                    NOT: { id: membership.userId },
                },
            });
            if (existingPhone) {
                return res.status(409).json({
                    success: false,
                    error: `User with phone '${cleanPhone}' already exists`,
                });
            }
        }
        const updatedUser = await prisma_js_1.prisma.user.update({
            where: { id: membership.userId },
            data: {
                ...(data.fullName ? { fullName: data.fullName.trim() } : {}),
                ...(data.email ? { email: data.email.trim().toLowerCase() } : {}),
                ...(data.phone !== undefined ? { phone: data.phone ? data.phone.trim() : null } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                role: true,
                isActive: true,
                mustChangePassword: true,
                lastLoginAt: true,
                createdAt: true,
            },
        });
        // Record Audit Log
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId: id,
                userId: req.user?.userId || null,
                action: 'ADMIN_ACCOUNT_UPDATED',
                entityType: 'User',
                entityId: membership.userId,
                oldValues: {
                    fullName: membership.user.fullName,
                    email: membership.user.email,
                    phone: membership.user.phone,
                    isActive: membership.user.isActive,
                },
                newValues: updatedUser,
            },
        });
        return res.json({
            success: true,
            message: 'Academic Admin account updated successfully',
            data: { adminAccount: updatedUser },
        });
    }
    catch (err) {
        console.error('[Update Admin Account Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to update admin account' });
    }
}
/**
 * Reset Academic Admin Password (SUPER_ADMIN only)
 * Accepts an optional Super Admin specified password or generates a secure 12-char random string.
 * Hashes with Argon2id, sets mustChangePassword: true, invalidates reset tokens, logs audit event.
 * Returns the temporary password once for the Super Admin copy modal.
 */
async function resetAdminPassword(req, res) {
    try {
        const { id } = req.params;
        const parse = exports.resetAdminPasswordSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({
                success: false,
                error: parse.error.errors[0]?.message || 'Invalid password format',
            });
        }
        const institute = await prisma_js_1.prisma.institute.findUnique({ where: { id } });
        if (!institute) {
            return res.status(404).json({ success: false, error: 'Institute not found' });
        }
        const membership = await prisma_js_1.prisma.instituteMembership.findFirst({
            where: { instituteId: id, role: 'ACADEMIC_ADMIN' },
            include: { user: true },
            orderBy: { joinedAt: 'asc' },
        });
        if (!membership || !membership.user) {
            return res.status(404).json({
                success: false,
                error: 'No Academic Admin account found for this institute',
            });
        }
        // Determine temporary password
        const temporaryPassword = parse.data.password?.trim() || `Tuit#${crypto_1.default.randomBytes(3).toString('hex').toUpperCase()}!`;
        const passwordHash = await (0, security_js_1.hashPassword)(temporaryPassword);
        await prisma_js_1.prisma.user.update({
            where: { id: membership.userId },
            data: {
                passwordHash,
                mustChangePassword: true,
            },
        });
        // Save temporary password in institute settingsJson for administrative display
        const currentSettings = institute.settingsJson || {};
        await prisma_js_1.prisma.institute.update({
            where: { id },
            data: {
                settingsJson: {
                    ...currentSettings,
                    initialPassword: temporaryPassword,
                },
            },
        });
        // Invalidate any existing password reset tokens
        await prisma_js_1.prisma.passwordResetToken.deleteMany({
            where: { userId: membership.userId },
        });
        // Record Audit Log (Security: never log plaintext password or hash)
        await prisma_js_1.prisma.auditLog.create({
            data: {
                instituteId: id,
                userId: req.user?.userId || null,
                action: 'ADMIN_PASSWORD_RESET',
                entityType: 'User',
                entityId: membership.userId,
                newValues: {
                    mustChangePassword: true,
                    resetBy: req.user?.userId || 'SUPER_ADMIN',
                    resetAt: new Date().toISOString(),
                },
            },
        });
        return res.json({
            success: true,
            message: 'Admin password reset successfully',
            data: {
                temporaryPassword,
                mustChangePassword: true,
            },
        });
    }
    catch (err) {
        console.error('[Reset Admin Password Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to reset admin password' });
    }
}
