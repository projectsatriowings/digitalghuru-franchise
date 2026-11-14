import { Request, Response } from 'express';
import { prisma } from '../../prisma.js';
import { z } from 'zod';
import { verifyPassword, hashPassword, generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../../utils/security.js';
import { AuthenticatedRequest } from '../../middleware/auth.js';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or Phone is required'),
  password: z.string().min(1, 'Password is required'),
  role: z.enum(['SUPER_ADMIN', 'FRANCHISE_OWNER', 'BRANCH_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT', 'STUDENT']).optional(),
  instituteCode: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long'),
});

export async function login(req: Request, res: Response) {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message || 'Invalid input data',
      });
    }

    const { identifier, password, role, instituteCode } = parseResult.data;

    const alternateEmail = identifier.toLowerCase().endsWith('@apexacademy.com')
      ? identifier.toLowerCase().replace('@apexacademy.com', '@apex.example.com')
      : identifier.toLowerCase().endsWith('@apex.example.com')
        ? identifier.toLowerCase().replace('@apex.example.com', '@apexacademy.com')
        : identifier;

    const alternatePhone = identifier === '9826444306' ? '9876543210' : identifier === '9876543210' ? '9826444306' : identifier;

    // Search user with automatic reconnection retry for Neon serverless socket resets
    const queryUser = () =>
      prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: identifier, mode: 'insensitive' } },
            { email: { equals: alternateEmail, mode: 'insensitive' } },
            { phone: identifier },
            { phone: alternatePhone },
            { studentProfile: { admissionNumber: { equals: identifier, mode: 'insensitive' } } },
          ],
        },
        include: {
          memberships: {
            include: {
              institute: true,
            },
          },
          staffProfile: true,
          parentProfile: true,
          studentProfile: true,
          ownedFranchises: {
            include: {
              branches: true,
            },
          },
        },
      });

    let user;
    try {
      user = await queryUser();
    } catch (dbErr: any) {
      if (
        dbErr?.code === 'P1017' ||
        dbErr?.message?.includes('closed the connection') ||
        dbErr?.message?.includes('10054') ||
        dbErr?.message?.includes('ConnectionReset')
      ) {
        console.warn('[Auth Controller] Transient socket reset detected; reconnecting to database...');
        await prisma.$disconnect().catch(() => { });
        await prisma.$connect().catch(() => { });
        user = await queryUser();
      } else {
        throw dbErr;
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email, phone, or password',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        error: 'Account has been deactivated. Please contact your administrator.',
      });
    }

    const isValid = await verifyPassword(user.passwordHash, password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email, phone, or password',
      });
    }

    // Server-enforced role validation: allow PARENT portal login if user has a parent profile
    const isParentLoginAllowed = role === 'PARENT' && (user.role === 'PARENT' || !!user.parentProfile);
    if (role && user.role !== role && !isParentLoginAllowed) {
      return res.status(403).json({
        success: false,
        error: `Account role mismatch: Selected ${role} but account is registered as ${user.role}`,
      });
    }

    const effectiveRole = isParentLoginAllowed ? 'PARENT' : user.role;

    // Determine active institute context
    let activeInstitute = null;
    if (effectiveRole !== 'SUPER_ADMIN' && effectiveRole !== 'FRANCHISE_OWNER') {
      if (instituteCode) {
        const found = user.memberships.find(
          (m) => m.institute.code.toLowerCase() === instituteCode.toLowerCase()
        );
        if (!found || !found.isActive || found.institute.status !== 'ACTIVE') {
          return res.status(403).json({
            success: false,
            error: 'You do not have an active membership in the specified institute',
          });
        }
        activeInstitute = found.institute;
      } else if (user.memberships.length > 0) {
        const activeMembership = user.memberships.find(
          (m) => m.isActive && m.institute.status === 'ACTIVE'
        );
        if (activeMembership) {
          activeInstitute = activeMembership.institute;
        }
      }
    }

    // Update last login timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => { });

    const primaryFranchise = user.ownedFranchises?.[0] || null;

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: effectiveRole,
      instituteId: activeInstitute?.id || null,
      franchiseId: primaryFranchise?.id || null,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const activeMemberships = user.memberships
      .filter((m) => m.isActive && m.institute.status === 'ACTIVE')
      .map((m) => ({
        id: m.id,
        role: effectiveRole === 'PARENT' ? 'PARENT' : m.role,
        institute: {
          id: m.institute.id,
          code: m.institute.code,
          name: m.institute.name,
        },
      }));

    // For STUDENT, PARENT, and FRANCHISE_OWNER roles, credentials are permanent credentials.
    // Franchise Owners receive Super-Admin-generated permanent credentials and are never forced to change passwords on login.
    const isExemptFromMandatoryChange = effectiveRole === 'STUDENT' || effectiveRole === 'PARENT' || effectiveRole === 'FRANCHISE_OWNER';
    const effectiveMustChangePassword = isExemptFromMandatoryChange ? false : !!user.mustChangePassword;

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken,
        refreshToken,
        mustChangePassword: effectiveMustChangePassword,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: effectiveRole,
          mustChangePassword: effectiveMustChangePassword,
          memberships: activeMemberships,
          ownedFranchises: user.ownedFranchises,
        },
        franchise: primaryFranchise,
        institute: activeInstitute ? {
          id: activeInstitute.id,
          code: activeInstitute.code,
          name: activeInstitute.name,
        } : null,
        memberships: activeMemberships,
      },
    });
  } catch (err: any) {
    console.error('[Login Error]', err);
    return res.status(500).json({
      success: false,
      error: 'An unexpected authentication error occurred',
    });
  }
}

export async function getCurrentUser(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
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
        memberships: {
          where: { isActive: true },
          select: {
            institute: {
              select: {
                id: true,
                code: true,
                name: true,
                status: true,
              },
            },
            role: true,
          },
        },
        ownedFranchises: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User profile not found' });
    }

    const isExemptFromMandatoryChange = user.role === 'STUDENT' || user.role === 'PARENT' || user.role === 'FRANCHISE_OWNER';
    const sanitizedUser = {
      ...user,
      mustChangePassword: isExemptFromMandatoryChange ? false : !!user.mustChangePassword,
    };

    return res.json({
      success: true,
      data: {
        user: sanitizedUser,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch current user' });
  }
}

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const parseResult = changePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.errors[0]?.message,
      });
    }

    const { currentPassword, newPassword } = parseResult.data;

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Students and parents cannot self-service modify credentials.
    // Student and Parent credentials are created and managed exclusively by authorized institute staff.
    if (req.user.role === 'STUDENT' || req.user.role === 'PARENT') {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Student and Parent credentials are managed exclusively by institute staff.',
      });
    }

    const isMatch = await verifyPassword(user.passwordHash, currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Current password does not match' });
    }

    const newHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'PASSWORD_CHANGED',
        entityType: 'User',
        entityId: user.id,
      },
    });

    return res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to change password' });
  }
}

export async function refreshToken(req: Request, res: Response) {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, error: 'Refresh token is required' });
    }

    const payload = verifyRefreshToken(token);
    if (!payload) {
      return res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
    }

    // Verify user is still active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, phone: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return res.status(403).json({ success: false, error: 'User account is inactive or not found' });
    }

    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      instituteId: payload.instituteId,
      franchiseId: payload.franchiseId,
    });

    const newRefreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role,
      instituteId: payload.instituteId,
      franchiseId: payload.franchiseId,
    });

    return res.json({
      success: true,
      message: 'Tokens renewed successfully',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to refresh authentication token' });
  }
}
