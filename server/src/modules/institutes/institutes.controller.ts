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
  phone: z.string().optional(),
  email: z.string().email('Invalid institute email').optional().or(z.literal('')),
  // Required initial Academic Admin provisioning
  adminFullName: z.string().min(2, 'Academic Admin full name is required').max(100),
  adminEmail: z.string().email('Valid Academic Admin login email is required'),
  adminPhone: z.string().optional().or(z.literal('')),
  adminInitialPassword: z.string().min(8, 'Admin password must be at least 8 characters'),
});

export const updateInstituteSchema = z.object({
  name: z.string().min(2).optional(),
  legalName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  settingsJson: z.record(z.any()).optional(),
});

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

    // Check if admin email already exists before proceeding
    const normalizedAdminEmail = data.adminEmail.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedAdminEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: `User with email '${normalizedAdminEmail}' already exists`,
      });
    }

    // Check duplicate phone if provided
    if (data.adminPhone && data.adminPhone.trim()) {
      const existingPhone = await prisma.user.findUnique({
        where: { phone: data.adminPhone.trim() },
      });
      if (existingPhone) {
        return res.status(409).json({
          success: false,
          error: `User with phone '${data.adminPhone.trim()}' already exists`,
        });
      }
    }

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
          error: `An institute with code '${instituteCode}' already exists`,
        });
      }
    }

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      const institute = await tx.institute.create({
        data: {
          code: instituteCode,
          name: data.name.trim(),
          legalName: data.legalName?.trim() || null,
          address: data.address?.trim() || null,
          city: data.city?.trim() || null,
          state: data.state?.trim() || null,
          postalCode: data.postalCode?.trim() || null,
          phone: data.phone?.trim() || null,
          email: data.email?.trim() || null,
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
    if (err.message && err.message.includes('already exists')) {
      return res.status(409).json({ success: false, error: err.message });
    }
    console.error('[Create Institute Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to create institute' });
  }
}

/**
 * Get Institute details by ID (Super Admin can view any, Academic Admin only their own)
 */
export async function getInstituteById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Academic admins can only view their own institute
    if (req.user?.role !== 'SUPER_ADMIN' && req.instituteId !== id) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You do not have permission to view another institute',
      });
    }

    const institute = await prisma.institute.findUnique({
      where: { id },
      include: {
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

    const existing = await prisma.institute.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Institute not found' });
    }

    const updated = await prisma.institute.update({
      where: { id },
      data: parse.data,
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
    return res.status(500).json({ success: false, error: 'Failed to update institute' });
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

