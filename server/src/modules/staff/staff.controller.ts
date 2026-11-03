import { Request, Response } from 'express';
import { prisma } from '../../prisma.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { hashPassword, generateSecureRandomToken } from '../../utils/security.js';
import { generateNextEmployeeCode } from './staff-code.service.js';
import { resolveAbsolutePath, getRelativeStorageKey } from '../../utils/storage.js';


function safeParseDate(dateVal?: string | null): Date | null {
  if (!dateVal || typeof dateVal !== 'string' || !dateVal.trim()) return null;
  const d = new Date(dateVal.trim());
  return isNaN(d.getTime()) ? null : d;
}

export const createStaffSchema = z.object({
  fullName: z.string().min(2, 'Staff full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional().nullable(),
  employeeCode: z.string().optional().nullable(),
  designation: z.string().min(2, 'Designation is required'), // e.g., "Senior Mathematics Faculty"
  qualification: z.string().optional().nullable(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  initialPassword: z.string().min(6, 'Password must be at least 6 characters').optional(),
  permissionsJson: z.record(z.any()).optional().nullable(),
  batchIds: z.array(z.string().uuid()).optional(),
  avatarUrl: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),

  // Personal Details
  dob: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  altPhone: z.string().optional().nullable(),
  personalEmail: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactRelation: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),

  // Addresses
  currentAddressLine1: z.string().optional().nullable(),
  currentAddressLine2: z.string().optional().nullable(),
  currentCity: z.string().optional().nullable(),
  currentState: z.string().optional().nullable(),
  currentPostalCode: z.string().optional().nullable(),
  currentCountry: z.string().optional().nullable(),

  permanentAddressLine1: z.string().optional().nullable(),
  permanentAddressLine2: z.string().optional().nullable(),
  permanentCity: z.string().optional().nullable(),
  permanentState: z.string().optional().nullable(),
  permanentPostalCode: z.string().optional().nullable(),
  permanentCountry: z.string().optional().nullable(),
  sameAsCurrentAddress: z.boolean().optional(),

  // Employment Details
  department: z.string().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  joiningDate: z.string().optional().nullable(),
  probationEndDate: z.string().optional().nullable(),
  workLocation: z.string().optional().nullable(),
  employmentNotes: z.string().optional().nullable(),
});

export const updateStaffSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  employeeCode: z.string().optional(),
  designation: z.string().min(2).optional(),
  qualification: z.string().optional().nullable(),
  permissionsJson: z.record(z.any()).optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),

  // Personal Details
  dob: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  altPhone: z.string().optional().nullable(),
  personalEmail: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactRelation: z.string().optional().nullable(),
  emergencyContactPhone: z.string().optional().nullable(),

  // Addresses
  currentAddressLine1: z.string().optional().nullable(),
  currentAddressLine2: z.string().optional().nullable(),
  currentCity: z.string().optional().nullable(),
  currentState: z.string().optional().nullable(),
  currentPostalCode: z.string().optional().nullable(),
  currentCountry: z.string().optional().nullable(),

  permanentAddressLine1: z.string().optional().nullable(),
  permanentAddressLine2: z.string().optional().nullable(),
  permanentCity: z.string().optional().nullable(),
  permanentState: z.string().optional().nullable(),
  permanentPostalCode: z.string().optional().nullable(),
  permanentCountry: z.string().optional().nullable(),
  sameAsCurrentAddress: z.boolean().optional(),

  // Employment Details
  department: z.string().optional().nullable(),
  employmentType: z.string().optional().nullable(),
  joiningDate: z.string().optional().nullable(),
  probationEndDate: z.string().optional().nullable(),
  workLocation: z.string().optional().nullable(),
  employmentNotes: z.string().optional().nullable(),
});

export const updateStaffStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().optional(),
});

export const resetStaffPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

export const qualificationSchema = z.object({
  degree: z.string().min(1, 'Degree or certification name is required'),
  fieldOfStudy: z.string().optional().nullable(),
  institution: z.string().min(1, 'Institution or university is required'),
  yearOfPassing: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  gradeOrScore: z.string().optional().nullable(),
  certificateUrl: z.string().optional().nullable(),
});

export const experienceSchema = z.object({
  institutionName: z.string().min(1, 'Institution / Employer name is required'),
  designation: z.string().min(1, 'Designation / Role is required'),
  startYear: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  endYear: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  subjectsTaught: z.string().optional().nullable(),
  totalYears: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * List staff in the active institute
 */
export async function listStaff(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const search = (req.query.search as string || '').trim();
    const isActiveFilter = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;

    const where: any = {
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

    const staffList = await prisma.staffProfile.findMany({
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
  } catch (err: any) {
    console.error('[listStaff Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to list staff profiles' });
  }
}

/**
 * Get next auto-generated employee code with academy name
 */
export async function getNextEmployeeCodeHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const employeeCode = await generateNextEmployeeCode(prisma, instituteId);
    return res.json({
      success: true,
      data: { employeeCode, nextCode: employeeCode },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to generate next employee code' });
  }
}

/**
 * Create a new staff account (Academic Admin or Super Admin)
 */
export async function createStaff(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const parse = createStaffSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Validation failed',
      });
    }

    const data = parse.data;
    const email = data.email.trim().toLowerCase();

    // Check unique email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: `User with email '${email}' already exists in the system`,
      });
    }

    // Check unique phone if provided
    const phone = data.phone?.trim() || null;
    if (phone) {
      const existingPhone = await prisma.user.findUnique({ where: { phone } });
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
      employeeCode = await generateNextEmployeeCode(prisma, instituteId);
    } else {
      // Check employee code uniqueness within institute
      const existingCode = await prisma.staffProfile.findUnique({
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

    const permanentPassword = data.password?.trim() || data.initialPassword?.trim() || `Staff@${generateSecureRandomToken(4)}2026`;
    const passwordHash = await hashPassword(permanentPassword);

    // Address sync logic
    const sameAsCurrent = data.sameAsCurrentAddress ?? false;
    const permLine1 = sameAsCurrent ? data.currentAddressLine1 : data.permanentAddressLine1;
    const permLine2 = sameAsCurrent ? data.currentAddressLine2 : data.permanentAddressLine2;
    const permCity = sameAsCurrent ? data.currentCity : data.permanentCity;
    const permState = sameAsCurrent ? data.currentState : data.permanentState;
    const permPostal = sameAsCurrent ? data.currentPostalCode : data.permanentPostalCode;
    const permCountry = sameAsCurrent ? (data.currentCountry || 'India') : (data.permanentCountry || 'India');

    const result = await prisma.$transaction(async (tx) => {
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
          permissionsJson: staffPermissions,
          avatarUrl: data.avatarUrl?.trim() || data.photoUrl?.trim() || null,

          // Personal Details
          dob: safeParseDate(data.dob),
          gender: data.gender || null,
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

    const institute = await prisma.institute.findUnique({
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
          user: result.user,
        },
      },
    });
  } catch (err: any) {
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
    } else if (err.message && !err.message.includes('\n') && !err.message.includes('Prisma') && !err.message.includes('C:\\')) {
      friendlyMessage = err.message;
    }

    return res.status(500).json({ success: false, error: friendlyMessage });
  }
}

/**
 * Get staff profile by ID with all relations
 */
export async function getStaffById(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const staff = await prisma.staffProfile.findFirst({
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

    return res.json({
      success: true,
      data: { staff },
    });
  } catch (err: any) {
    console.error('[getStaffById Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch staff profile' });
  }
}

/**
 * Update staff profile
 */
export async function updateStaff(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(403).json({ success: false, error: 'Institute context required' });
    }
    const { id } = req.params;

    const parse = updateStaffSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Validation failed',
      });
    }

    const existing = await prisma.staffProfile.findFirst({
      where: { id, instituteId },
      include: { user: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    const data = parse.data;

    // Check employee code uniqueness if changed
    if (data.employeeCode && data.employeeCode.trim() !== existing.employeeCode) {
      const codeTaken = await prisma.staffProfile.findUnique({
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

    await prisma.$transaction(async (tx) => {
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
          ...(data.permissionsJson && { permissionsJson: data.permissionsJson }),
          ...((data.avatarUrl !== undefined || data.photoUrl !== undefined) && { avatarUrl: data.avatarUrl?.trim() || data.photoUrl?.trim() || null }),

          // Personal Details
          ...(data.dob !== undefined && { dob: data.dob ? new Date(data.dob) : null }),
          ...(data.gender !== undefined && { gender: data.gender || null }),
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
  } catch (err: any) {
    console.error('[updateStaff Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to update staff profile' });
  }
}

/**
 * Update Staff Status (Activate or Deactivate account)
 */
export async function updateStaffStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const parse = updateStaffStatusSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message,
      });
    }

    const { isActive, reason } = parse.data;

    const staff = await prisma.staffProfile.findFirst({
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

    await prisma.$transaction([
      prisma.user.update({
        where: { id: staff.userId },
        data: { isActive },
      }),
      prisma.instituteMembership.updateMany({
        where: { instituteId, userId: staff.userId },
        data: { isActive },
      }),
      prisma.auditLog.create({
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update staff status' });
  }
}

/**
 * Assign batches and subjects to staff (Academic Admin & Super Admin)
 */
export async function assignStaffBatches(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;
    const { batchIds = [], assignments } = req.body;

    const staff = await prisma.staffProfile.findFirst({
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
      const batches = await prisma.batch.findMany({
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

    await prisma.$transaction(async (tx) => {
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
  } catch (err: any) {
    console.error('[assignStaffBatches error]', err);
    return res.status(500).json({ success: false, error: 'Failed to assign batches and subjects to staff' });
  }
}

/**
 * Reset / Set permanent login password for a staff member (Academic Admin & Super Admin)
 */
export async function resetStaffPassword(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const staff = await prisma.staffProfile.findFirst({
      where: { id, instituteId },
      include: { user: true },
    });

    if (!staff) {
      return res.status(404).json({ success: false, error: 'Staff member not found in this institute' });
    }

    const parse = resetStaffPasswordSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Validation failed',
      });
    }

    const newPassword = parse.data.password?.trim() || `Staff@${generateSecureRandomToken(4)}2026`;
    const passwordHash = await hashPassword(newPassword);

    const existingPerms = (staff.permissionsJson as Record<string, any>) || {};
    const updatedPerms = {
      ...existingPerms,
      permanentPassword: newPassword,
    };

    await prisma.$transaction([
      prisma.user.update({
        where: { id: staff.userId },
        data: {
          passwordHash,
          mustChangePassword: false,
        },
      }),
      prisma.staffProfile.update({
        where: { id: staff.id },
        data: {
          permissionsJson: updatedPerms,
        },
      }),
      prisma.auditLog.create({
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

    const institute = await prisma.institute.findUnique({
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
  } catch (err: any) {
    console.error('[Reset Staff Password Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to reset staff password' });
  }
}

/**
 * Upload Staff Photograph
 */
export async function uploadStaffPhoto(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(403).json({ success: false, error: 'Institute context required' });
    }
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }

    const relativeKey = getRelativeStorageKey(instituteId, req.file.filename);

    if (id && id !== 'upload' && id !== 'upload-photo') {
      const staff = await prisma.staffProfile.findFirst({
        where: { id, instituteId },
      });

      if (!staff) {
        return res.status(404).json({ success: false, error: 'Staff member not found' });
      }

      await prisma.staffProfile.update({
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
  } catch (err: any) {
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
export async function getRawStaffPhoto(req: Request, res: Response) {
  try {
    const rawKey = decodeURIComponent(req.params.key);
    const absPath = resolveAbsolutePath(rawKey);
    if (!absPath || !fs.existsSync(absPath)) {
      return res.status(404).send('Photograph file not found');
    }

    const ext = path.extname(absPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return fs.createReadStream(absPath).pipe(res);
  } catch (err: any) {
    console.error('[getRawStaffPhoto Error]', err);
    return res.status(500).send('Error streaming photograph');
  }
}

export async function getStaffPhoto(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const staff = await prisma.staffProfile.findUnique({
      where: { id },
      select: { avatarUrl: true },
    });

    if (!staff || !staff.avatarUrl) {
      return res.status(404).send('Photograph not found');
    }

    const absPath = resolveAbsolutePath(staff.avatarUrl);
    if (!absPath || !fs.existsSync(absPath)) {
      return res.status(404).send('Photograph file not found on disk');
    }

    const ext = path.extname(absPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    res.setHeader('Content-Type', mimeMap[ext] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return fs.createReadStream(absPath).pipe(res);
  } catch (err: any) {
    console.error('[getStaffPhoto Error]', err);
    return res.status(500).send('Error streaming photograph');
  }
}

/**
 * Add Qualification
 */
export async function addStaffQualification(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const parse = qualificationSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Validation failed',
      });
    }

    const staff = await prisma.staffProfile.findFirst({
      where: { id, instituteId },
    });
    if (!staff) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    const qual = await prisma.staffQualification.create({
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to add qualification' });
  }
}

/**
 * Update Qualification
 */
export async function updateStaffQualification(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id, qid } = req.params;

    const parse = qualificationSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Validation failed',
      });
    }

    const qual = await prisma.staffQualification.findFirst({
      where: { id: qid, staffProfileId: id, staffProfile: { instituteId } },
    });
    if (!qual) {
      return res.status(404).json({ success: false, error: 'Qualification record not found' });
    }

    const updated = await prisma.staffQualification.update({
      where: { id: qid },
      data: parse.data,
    });

    return res.json({
      success: true,
      message: 'Qualification updated successfully',
      data: { qualification: updated },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update qualification' });
  }
}

/**
 * Delete Qualification
 */
export async function deleteStaffQualification(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id, qid } = req.params;

    const qual = await prisma.staffQualification.findFirst({
      where: { id: qid, staffProfileId: id, staffProfile: { instituteId } },
    });
    if (!qual) {
      return res.status(404).json({ success: false, error: 'Qualification record not found' });
    }

    await prisma.staffQualification.delete({ where: { id: qid } });

    return res.json({
      success: true,
      message: 'Qualification deleted successfully',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to delete qualification' });
  }
}

/**
 * Add Experience
 */
export async function addStaffExperience(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const parse = experienceSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Validation failed',
      });
    }

    const staff = await prisma.staffProfile.findFirst({
      where: { id, instituteId },
    });
    if (!staff) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    const exp = await prisma.staffExperience.create({
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to add experience' });
  }
}

/**
 * Update Experience
 */
export async function updateStaffExperience(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id, eid } = req.params;

    const parse = experienceSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Validation failed',
      });
    }

    const exp = await prisma.staffExperience.findFirst({
      where: { id: eid, staffProfileId: id, staffProfile: { instituteId } },
    });
    if (!exp) {
      return res.status(404).json({ success: false, error: 'Experience record not found' });
    }

    const updated = await prisma.staffExperience.update({
      where: { id: eid },
      data: parse.data,
    });

    return res.json({
      success: true,
      message: 'Experience entry updated successfully',
      data: { experience: updated },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update experience' });
  }
}

/**
 * Delete Experience
 */
export async function deleteStaffExperience(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id, eid } = req.params;

    const exp = await prisma.staffExperience.findFirst({
      where: { id: eid, staffProfileId: id, staffProfile: { instituteId } },
    });
    if (!exp) {
      return res.status(404).json({ success: false, error: 'Experience record not found' });
    }

    await prisma.staffExperience.delete({ where: { id: eid } });

    return res.json({
      success: true,
      message: 'Experience entry deleted successfully',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to delete experience' });
  }
}

/**
 * Upload Staff Document
 */
export async function uploadStaffDocument(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(403).json({ success: false, error: 'Institute context required' });
    }
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No document file uploaded' });
    }

    const staff = await prisma.staffProfile.findFirst({
      where: { id, instituteId },
    });
    if (!staff) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    const documentType = req.body.documentType?.trim() || 'OTHER';
    const displayName = req.body.displayName?.trim() || req.file.originalname;
    const notes = req.body.notes?.trim() || null;
    const expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;

    const relativeKey = getRelativeStorageKey(instituteId, req.file.filename);

    const doc = await prisma.staffDocument.create({
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
  } catch (err: any) {
    console.error('[uploadStaffDocument Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to upload document' });
  }
}

/**
 * Download / Stream Staff Document
 */
export async function downloadStaffDocument(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id, docId } = req.params;

    const doc = await prisma.staffDocument.findFirst({
      where: { id: docId, staffProfileId: id, instituteId },
    });

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const absPath = resolveAbsolutePath(doc.fileUrl);
    if (!absPath || !fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, error: 'Document file not found on disk' });
    }

    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
    return fs.createReadStream(absPath).pipe(res);
  } catch (err: any) {
    console.error('[downloadStaffDocument Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to download document' });
  }
}

/**
 * Delete Staff Document
 */
export async function deleteStaffDocument(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id, docId } = req.params;

    const doc = await prisma.staffDocument.findFirst({
      where: { id: docId, staffProfileId: id, instituteId },
    });

    if (!doc) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    // Attempt to remove file from disk safely
    const absPath = resolveAbsolutePath(doc.fileUrl);
    if (absPath && fs.existsSync(absPath)) {
      try {
        fs.unlinkSync(absPath);
      } catch (e) {
        console.warn('[deleteStaffDocument] File unlink failed:', e);
      }
    }

    await prisma.staffDocument.delete({ where: { id: docId } });

    return res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (err: any) {
    console.error('[deleteStaffDocument Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to delete document' });
  }
}
