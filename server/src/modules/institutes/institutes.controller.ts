import { Response } from 'express';
import { prisma } from '../../prisma.js';
import { z } from 'zod';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { hashPassword } from '../../utils/security.js';

// Validation Schemas
export const createInstituteSchema = z.object({
  code: z.string().min(2, 'Code must be at least 2 characters').max(20).regex(/^[A-Z0-9_-]+$/i, 'Alphanumeric, dash or underscore only').optional(),
  name: z.string().min(2, 'Institute name is required').max(100),
  legalName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional().or(z.literal('')),
  email: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.string().email('Invalid institute email').optional().nullable().or(z.literal(''))
  ),
  franchiseId: z.string().uuid().optional().nullable(),
  // Duplicate confirmation flags
  confirmDuplicatePhone: z.boolean().optional(),
  confirmDuplicateName: z.boolean().optional(),
  // Required initial Academic Admin provisioning
  adminFullName: z.string().min(2, 'Academic Admin full name is required').max(100),
  adminEmail: z.string().email('Valid Academic Admin login email is required'),
  adminPhone: z.string().optional().or(z.literal('')),
  adminInitialPassword: z.string().min(8, 'Admin password must be at least 8 characters'),
});

export const updateInstituteSchema = z.object({
  name: z.string().min(2).optional(),
  legalName: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  phone: z.string().optional().nullable().or(z.literal('')),
  email: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.string().email('Invalid institute email').optional().nullable().or(z.literal(''))
  ),
  franchiseId: z.string().uuid().optional().nullable(),
  confirmDuplicatePhone: z.boolean().optional(),
  confirmDuplicateName: z.boolean().optional(),
  settingsJson: z.record(z.any()).optional(),
});

export const checkDuplicatesSchema = z.object({
  name: z.string().optional(),
  email: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.string().email('Invalid institute email').optional().nullable().or(z.literal(''))
  ),
  phone: z.string().optional(),
  franchiseId: z.string().uuid().optional().nullable(),
  city: z.string().optional().nullable(),
  excludeInstituteId: z.string().uuid().optional(),
});

/**
 * Check for duplicate institute email, name, or phone before submission
 */
export async function checkInstituteDuplicates(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = checkDuplicatesSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.errors[0]?.message || 'Invalid parameters' });
    }

    const { name, email, phone, franchiseId, city, excludeInstituteId } = parse.data;

    let emailConflict: { isDuplicate: boolean; message?: string } = { isDuplicate: false };
    if (email && email.trim()) {
      const normEmail = email.trim().toLowerCase();
      const match = await prisma.institute.findFirst({
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

    let nameConflict: {
      isDuplicate: boolean;
      isSameFranchise: boolean;
      warning?: string;
      message?: string;
      allowCreation: boolean;
    } = { isDuplicate: false, isSameFranchise: false, allowCreation: true };

    if (name && name.trim()) {
      const normName = name.trim();
      const matches = await prisma.institute.findMany({
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
        } else {
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

    let phoneConflict: {
      isDuplicate: boolean;
      warning?: string;
      requiresConfirmation: boolean;
      existingInstitute?: any;
    } = { isDuplicate: false, requiresConfirmation: false };

    if (phone && phone.trim()) {
      const cleanPhone = phone.trim();
      const phoneDigits = cleanPhone.replace(/\D/g, '');
      if (phoneDigits.length >= 7) {
        const last10Digits = phoneDigits.slice(-10);
        const queryParams: any[] = [`%${last10Digits}`];
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

        const matchingRows: any[] = await prisma.$queryRawUnsafe(sql, ...queryParams);
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Failed to check duplicates' });
  }
}

export const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_SETUP']),
  reason: z.string().optional(),
});

export const updateAdminAccountSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100).optional(),
  email: z.string().email('Invalid email address').optional(),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const resetAdminPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

/**
 * List institutes (SUPER_ADMIN only)
 */
export async function listInstitutes(req: AuthenticatedRequest, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
    const search = (req.query.search as string || '').trim();
    const status = req.query.status as any;

    const skip = (page - 1) * limit;

    const where: any = {};
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
      prisma.institute.count({ where }),
      prisma.institute.findMany({
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

    return res.json({
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
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to list institutes' });
  }
}

/**
 * Create a new Institute (SUPER_ADMIN only)
 * Uses a safe transaction to create Institute + initial Academic Admin
 */
export async function createInstitute(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = createInstituteSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Validation error',
      });
    }

    const data = parse.data;

    // 1. Admin Email Validation (globally unique across users)
    const normalizedAdminEmail = data.adminEmail.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
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
      const existingPhone = await prisma.user.findUnique({
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
        const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        const candidate = `INS-${suffix}`;
        const existing = await prisma.institute.findUnique({ where: { code: candidate } });
        if (!existing) {
          instituteCode = candidate;
          break;
        }
      }
      if (!instituteCode) {
        instituteCode = `INS-${Date.now().toString(36).toUpperCase()}`;
      }
    } else {
      // Check unique institute code if manually supplied
      const existingInst = await prisma.institute.findUnique({
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
      const existingInstEmail = await prisma.institute.findFirst({
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

    const sameNameInstitutes = await prisma.institute.findMany({
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

    let nameWarning: string | null = null;
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
    let phoneWarning: string | null = null;

    if (normalizedPhoneDigits.length >= 7) {
      const last10Digits = normalizedPhoneDigits.slice(-10);
      const matchingRows: any[] = await prisma.$queryRawUnsafe(`
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
        } else {
          phoneWarning = `${phoneMsg} (Confirmed by administrator).`;
        }
      }
    }

    // 7. Execute in Transaction with Concurrency Advisory Lock on Normalized Institute Email
    const result = await prisma.$transaction(async (tx) => {
      // Concurrency safety: acquire transaction-scoped advisory lock on hashed normalized email
      if (normalizedInstituteEmail) {
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtext($1))`,
          `inst_email_${normalizedInstituteEmail}`
        );

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
        },
      });

      const passwordHash = await hashPassword(data.adminInitialPassword);

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
  } catch (err: any) {
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
export async function getInstituteById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Academic/Branch admins can view their active institute; Franchise owners can view any assigned branch
    const assignedBranchIds: string[] = (req as any).assignedBranchIds || [];
    const isOwnerBranch = req.user?.role === 'FRANCHISE_OWNER' && assignedBranchIds.includes(id);
    if (req.user?.role !== 'SUPER_ADMIN' && req.instituteId !== id && !isOwnerBranch) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to view another institute',
      });
    }

    const institute = await prisma.institute.findUnique({
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

    const adminAccount = institute.memberships?.[0]?.user || null;

    return res.json({
      success: true,
      data: {
        institute,
        adminAccount,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch institute details' });
  }
}

/**
 * Update Institute details
 */
export async function updateInstitute(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Academic admin can only update their own institute
    if (req.user?.role !== 'SUPER_ADMIN' && req.instituteId !== id) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You cannot modify another institute',
      });
    }

    const parse = updateInstituteSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Invalid input data',
      });
    }

    const data = parse.data;
    const existing = await prisma.institute.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Institute not found' });
    }

    // 1. Email check if changing email (exclude self)
    let normalizedEmail: string | null | undefined = undefined;
    if (data.email !== undefined) {
      const rawEmail = (data.email || '').trim();
      normalizedEmail = rawEmail ? rawEmail.toLowerCase() : null;

      if (normalizedEmail) {
        const conflictInst = await prisma.institute.findFirst({
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
      const sameNameInstitutes = await prisma.institute.findMany({
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
        const matchingRows: any[] = await prisma.$queryRawUnsafe(`
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

    const updatePayload: any = { ...data };
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

    const updated = await prisma.institute.update({
      where: { id },
      data: updatePayload,
    });

    // Record Audit Log
    await prisma.auditLog.create({
      data: {
        instituteId: id,
        userId: req.user?.userId || null,
        action: 'INSTITUTE_UPDATED',
        entityType: 'Institute',
        entityId: id,
        oldValues: existing as any,
        newValues: updated as any,
      },
    });

    return res.json({
      success: true,
      message: 'Institute updated successfully',
      data: { institute: updated },
    });
  } catch (err: any) {
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
export async function updateInstituteStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const parse = updateStatusSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Invalid status',
      });
    }

    const { status, reason } = parse.data;

    const existing = await prisma.institute.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Institute not found' });
    }

    const updated = await prisma.institute.update({
      where: { id },
      data: { status },
    });

    // Record Audit Log
    await prisma.auditLog.create({
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update institute status' });
  }
}

/**
 * Dashboard Summary Metrics
 * Super Admin gets platform counts; Academic Admin gets institute-scoped counts.
 */
export async function getDashboardSummary(req: AuthenticatedRequest, res: Response) {
  try {
    if (req.user?.role === 'SUPER_ADMIN') {
      const [totalInstitutes, activeInstitutes, suspendedInstitutes, totalUsers, totalStudents] = await Promise.all([
        prisma.institute.count(),
        prisma.institute.count({ where: { status: 'ACTIVE' } }),
        prisma.institute.count({ where: { status: 'SUSPENDED' } }),
        prisma.user.count(),
        prisma.student.count(),
      ]);

      return res.json({
        success: true,
        data: {
          role: 'SUPER_ADMIN',
          totalInstitutes,
          activeInstitutes,
          suspendedInstitutes,
          totalUsers,
          totalStudents,
        },
      });
    }

    // Academic Admin or Staff: Institute-scoped metrics
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const [
      studentCounts,
      totalStaff,
      totalBatches,
      totalSubjects,
      institute,
    ] = await Promise.all([
      prisma.student.groupBy({
        by: ['status'],
        where: { instituteId },
        _count: { _all: true },
      }),
      prisma.staffProfile.count({ where: { instituteId } }),
      prisma.batch.count({ where: { instituteId } }),
      prisma.subject.count({ where: { instituteId } }),
      prisma.institute.findUnique({
        where: { id: instituteId },
        select: { id: true, name: true, code: true, status: true },
      }),
    ]);

    let activeStudents = 0;
    let passedOutStudents = 0;
    let discontinuedStudents = 0;
    for (const sc of studentCounts) {
      if (sc.status === 'ACTIVE') activeStudents = sc._count._all;
      else if (sc.status === 'PASSED_OUT') passedOutStudents = sc._count._all;
      else if (sc.status === 'DISCONTINUED') discontinuedStudents = sc._count._all;
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch dashboard summary' });
  }
}

/**
 * Update Academic Admin Account Details (SUPER_ADMIN only)
 * Updates permitted user fields (fullName, email, phone, isActive)
 */
export async function updateAdminAccount(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const parse = updateAdminAccountSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Invalid input data',
      });
    }

    const institute = await prisma.institute.findUnique({ where: { id } });
    if (!institute) {
      return res.status(404).json({ success: false, error: 'Institute not found' });
    }

    const membership = await prisma.instituteMembership.findFirst({
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
      const existing = await prisma.user.findFirst({
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
      const existingPhone = await prisma.user.findFirst({
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

    const updatedUser = await prisma.user.update({
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
    await prisma.auditLog.create({
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
        newValues: updatedUser as any,
      },
    });

    return res.json({
      success: true,
      message: 'Academic Admin account updated successfully',
      data: { adminAccount: updatedUser },
    });
  } catch (err: any) {
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
export async function resetAdminPassword(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const parse = resetAdminPasswordSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Invalid password format',
      });
    }

    const institute = await prisma.institute.findUnique({ where: { id } });
    if (!institute) {
      return res.status(404).json({ success: false, error: 'Institute not found' });
    }

    const membership = await prisma.instituteMembership.findFirst({
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
    const temporaryPassword = parse.data.password?.trim() || `Tuit#${crypto.randomBytes(3).toString('hex').toUpperCase()}!`;
    const passwordHash = await hashPassword(temporaryPassword);

    await prisma.user.update({
      where: { id: membership.userId },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    // Invalidate any existing password reset tokens
    await prisma.passwordResetToken.deleteMany({
      where: { userId: membership.userId },
    });

    // Record Audit Log (Security: never log plaintext password or hash)
    await prisma.auditLog.create({
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
  } catch (err: any) {
    console.error('[Reset Admin Password Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to reset admin password' });
  }
}

