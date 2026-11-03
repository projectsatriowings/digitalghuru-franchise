import fs from 'fs';
import path from 'path';
import { Response } from 'express';
import { prisma } from '../../prisma.js';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { hashPassword, generateSecureRandomToken } from '../../utils/security.js';
import {
  generateNextAdmissionNumber,
  getOrSetInstitutePrefix,
  getOrSetCompactInstituteCode,
  deriveBatchCode,
  getAdmissionYear,
} from './admission-number.service.js';

export function formatStudentResponse<T extends { id: string; photoUrl?: string | null; notes?: string | null; updatedAt?: Date | string }>(student: T): T & { credentialsOnRecord?: { studentPassword: string | null; parentPassword: string | null } } {
  if (!student) return student;
  let formattedPhoto = student.photoUrl;
  if (formattedPhoto && !formattedPhoto.startsWith('http://') && !formattedPhoto.startsWith('https://') && !formattedPhoto.startsWith('/api/')) {
    const v = (student as any).updatedAt ? new Date((student as any).updatedAt).getTime() : '';
    formattedPhoto = `/api/students/${student.id}/photo${v ? `?v=${v}` : ''}`;
  }

  let credentialsOnRecord = {
    studentPassword: null as string | null,
    parentPassword: null as string | null,
  };
  let cleanNotes = student.notes;

  if (student.notes && student.notes.startsWith('{') && (student.notes.includes('studentPassword') || student.notes.includes('parentPassword'))) {
    try {
      const parsed = JSON.parse(student.notes);
      cleanNotes = parsed.userNotes || null;
      credentialsOnRecord.studentPassword = parsed.studentPassword || null;
      credentialsOnRecord.parentPassword = parsed.parentPassword || null;
    } catch {}
  }

  return {
    ...student,
    photoUrl: formattedPhoto,
    notes: cleanNotes,
    credentialsOnRecord,
  };
}
import {
  getAuthorizedStudentScope,
  isStudentAuthorized,
  isStaffAssignedToBatch,
  isStaffAssignedToBatchSubject,
  getAuthorizedStaffAssignments,
} from './student-authorization.service.js';
import { getRelativeStorageKey, resolveAbsolutePath } from '../../utils/storage.js';

export const studentAdmissionSchema = z.object({
  admissionNumber: z.string().optional(), // Automatically generated on server
  firstName: z.string().min(1, 'First name is required').max(50),
  lastName: z.string().min(1, 'Last name is required').max(50),
  studentPhone: z.string().optional().or(z.literal('')),
  dob: z.string().optional(), // YYYY-MM-DD
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  bloodGroup: z.string().optional(),
  notes: z.string().optional(),
  admissionDate: z.string().optional(), // YYYY-MM-DD
  // Optional batch enrollment
  batchId: z.string().uuid().optional(),
  // Optional batch subject enrollments
  subjectIds: z.array(z.string().uuid()).optional(),
  // Student login account creation (defaults to true for enterprise credentials workflow)
  createLoginAccount: z.boolean().default(true),
  email: z.string().email().optional().or(z.literal('')),
  studentEmail: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  initialPassword: z.string().min(8).optional(),
  studentInitialPassword: z.string().min(8).optional(),
  // Parent / Guardian fields during admission (Requirement 3)
  parentFullName: z.string().min(2, 'Parent/guardian full name is required').optional(),
  parentRelationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN']).default('GUARDIAN').optional(),
  parentPhone: z.string().min(8, 'Parent/guardian phone number is required').optional(),
  parentEmail: z.string().email().optional().or(z.literal('')).optional(),
  parentInitialPassword: z.string().min(8).optional(),
  parentCanReceiveSms: z.boolean().default(true).optional(),
  photoUrl: z.string().optional(),
});

export const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').optional(),
  lastName: z.string().trim().min(1, 'Last name is required').optional(),
  studentPhone: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().optional().nullable()),
  studentEmail: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().email('Invalid email').optional().nullable()),
  dob: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().optional().nullable()),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  bloodGroup: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().optional().nullable()),
  notes: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().optional().nullable()),
  photoUrl: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().optional().nullable()),
  batchId: z.preprocess((val) => (typeof val === 'string' && (val.trim() === '' || val === 'null' || val === 'undefined') ? null : val), z.string().uuid('Invalid batch ID').optional().nullable()),
  subjectIds: z.preprocess((val) => (Array.isArray(val) ? val.filter((x) => typeof x === 'string' && x.trim() !== '') : val), z.array(z.string().uuid('Invalid subject ID')).optional().nullable()),
  parentFullName: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().optional().nullable()),
  parentRelationship: z.enum(['FATHER', 'MOTHER', 'GUARDIAN']).optional(),
  parentPhone: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().optional().nullable()),
  parentEmail: z.preprocess((val) => (typeof val === 'string' && val.trim() === '' ? null : val), z.string().trim().email('Invalid email').optional().nullable()),
});

export const updateStudentStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PASSED_OUT', 'DISCONTINUED']),
  reason: z.string().optional(),
});

export const resetStudentPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').optional(),
});

export const updateStudentIdentifierSchema = z.object({
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().min(8, 'Phone number must be at least 8 digits').optional().or(z.literal('')),
}).refine((data) => data.email !== undefined || data.phone !== undefined, {
  message: 'At least one identifier (email or phone) must be provided',
});


/**
 * List students with filters, search, and pagination
 */
export async function listStudents(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const page = Math.max(1, parseInt(req.query.page as string || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || '20', 10)));
    const search = (req.query.search as string || '').trim();
    const status = req.query.status as any;
    const batchId = req.query.batchId as string;
    const subjectId = req.query.subjectId as string;

    const skip = (page - 1) * limit;

    // Staff validation if batchId / subjectId is provided
    if (req.user?.role === 'STAFF') {
      if (batchId) {
        const isAssigned = await isStaffAssignedToBatch(req, batchId, prisma);
        if (!isAssigned) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: You are not authorized to view students in this batch.',
          });
        }
      }
      if (batchId && subjectId) {
        const isAssignedSub = await isStaffAssignedToBatchSubject(req, batchId, subjectId, prisma);
        if (!isAssignedSub) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: You are not authorized to view students in this subject.',
          });
        }
      }
    }

    const scope = await getAuthorizedStudentScope(req, prisma, { batchId, subjectId });

    const andConditions: any[] = [
      { instituteId },
      scope.whereClause,
    ];

    if (status && ['ACTIVE', 'PASSED_OUT', 'DISCONTINUED'].includes(status)) {
      andConditions.push({ status });
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

    const where: any = { AND: andConditions };

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        include: {
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
      formattedStudents = formattedStudents.map((s: any) => ({
        ...s,
        enrollments: (s.enrollments || []).filter(
          (e: any) => !e.batchId || authorizedBatchIds.includes(e.batchId)
        ),
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to list students' });
  }
}

/**
 * Admit a new student
 */
export async function admitStudent(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const parse = studentAdmissionSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message || 'Validation error',
      });
    }

    const data = parse.data;

    let parsedDob: Date | null = null;
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
        const isAssigned = await isStaffAssignedToBatch(req, data.batchId, prisma);
        if (!isAssigned) {
          return res.status(403).json({
            success: false,
            error: 'Forbidden: You are not authorized to admit students into this batch.',
          });
        }
      }
      if (data.batchId && data.subjectIds && data.subjectIds.length > 0) {
        for (const sid of data.subjectIds) {
          const isAssignedSub = await isStaffAssignedToBatchSubject(req, data.batchId, sid, prisma);
          if (!isAssignedSub) {
            return res.status(403).json({
              success: false,
              error: `Forbidden: You are not authorized to enroll students into subject '${sid}' in this batch.`,
            });
          }
        }
      }
    }
    // Check if likely existing student already exists in this institute (by phone, email, or admissionNumber)
    const cleanPhone = data.studentPhone?.trim() || data.phone?.trim() || null;
    const cleanEmail = data.studentEmail?.trim().toLowerCase() || data.email?.trim().toLowerCase() || null;

    if (cleanPhone || cleanEmail) {
      const existingStudent = await prisma.student.findFirst({
        where: {
          instituteId,
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
        const errorMsg = `A student profile already exists in this institute (${existingStudent.firstName} ${existingStudent.lastName}, Admission: ${existingStudent.admissionNumber}). Please use 'Enroll Existing Student' to enroll them into another batch or subject without duplicating the account.`;
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
      const existingPhoneUser = await prisma.user.findUnique({
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
      const existingEmailUser = await prisma.user.findUnique({
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
      const existingParentUser = await prisma.user.findUnique({
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
    let result: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        result = await prisma.$transaction(
          async (tx) => {
            // Generate atomic, concurrency-safe institute-based admission number (7-character format)
            const admissionInfo = await generateNextAdmissionNumber(
              tx,
              instituteId,
              data.batchId,
              parsedAdmissionDate
            );
            const admissionNumber = admissionInfo.admissionNumber;

            let studentUser = null;
            let tempPassword = null;

            if (data.createLoginAccount !== false) {
              let cleanEmail = data.studentEmail?.trim().toLowerCase() || data.email?.trim().toLowerCase() || null;
              let cleanPhone = data.studentPhone?.trim() || data.phone?.trim() || null;

              const cleanParentPhone = data.parentPhone?.trim() || null;
              const cleanParentEmail = data.parentEmail?.trim().toLowerCase() || null;

              // If student phone is identical to parent phone, student user account should not take the parent's unique login phone!
              // (The student profile still retains student.phone, while student logs in via admission number, and parent logs in via phone).
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
                `Student#${generateSecureRandomToken(4)}2026`;
              const passwordHash = await hashPassword(tempPassword);

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

              await tx.instituteMembership.create({
                data: {
                  instituteId,
                  userId: studentUser.id,
                  role: 'STUDENT',
                  isActive: true,
                },
              });
            }

            // Create Student profile
            const student = await tx.student.create({
              data: {
                instituteId,
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

            // Batch enrollment if provided
            if (data.batchId) {
              // Validate batch belongs to this institute
              const batch = await tx.batch.findFirst({
                where: { id: data.batchId, instituteId },
              });

              if (!batch) {
                throw new Error('Selected batch does not belong to this institute');
              }

              // Create primary batch enrollment
              await tx.studentEnrollment.create({
                data: {
                  studentId: student.id,
                  batchId: data.batchId,
                  subjectId: null,
                  isActive: true,
                },
              });

              // Create subject enrollments if provided
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

            // Parent Account Creation & Linking (Requirement 3)
            let parentUser = null;
            let parentProfile = null;
            let parentTempPassword = null;
            let isExistingParentAccount = false;

            if (data.parentFullName && data.parentPhone) {
              const cleanParentPhone = data.parentPhone.trim();
              const cleanParentEmail = data.parentEmail?.trim().toLowerCase() || null;

              // Check if a parent user already exists by phone or email (excluding newly created studentUser)
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
                parentTempPassword = null; // Do not reset or expose existing parent's password!

                // Ensure ParentProfile exists
                if (existingUser.parentProfile) {
                  parentProfile = existingUser.parentProfile;
                } else {
                  parentProfile = await tx.parentProfile.create({
                    data: { userId: existingUser.id },
                  });
                }

                // Ensure membership exists for this institute
                const existingMembership = await tx.instituteMembership.findUnique({
                  where: {
                    instituteId_userId: {
                      instituteId,
                      userId: existingUser.id,
                    },
                  },
                });

                if (!existingMembership) {
                  await tx.instituteMembership.create({
                    data: {
                      instituteId,
                      userId: existingUser.id,
                      role: 'PARENT',
                      isActive: true,
                    },
                  });
                }
              } else {
                // Create new parent account
                isExistingParentAccount = false;
                parentTempPassword = data.parentInitialPassword?.trim() || `Parent#${generateSecureRandomToken(4)}2026`;
                const parentPasswordHash = await hashPassword(parentTempPassword);

                parentUser = await tx.user.create({
                  data: {
                    fullName: data.parentFullName.trim(),
                    phone: cleanParentPhone,
                    email: cleanParentEmail,
                    passwordHash: parentPasswordHash,
                    role: 'PARENT',
                    isActive: true,
                    mustChangePassword: false, // Staff-managed credentials
                  },
                });

                await tx.instituteMembership.create({
                  data: {
                    instituteId,
                    userId: parentUser.id,
                    role: 'PARENT',
                    isActive: true,
                  },
                });

                parentProfile = await tx.parentProfile.create({
                  data: {
                    userId: parentUser.id,
                    isPhoneVerified: true,
                  },
                });
              }

              // Link student to parent
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

            // Store initial generated credentials into student.notes so they display permanently on the staff Login & Password page
            const initialCredNotes: Record<string, any> = {};
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

            // Record Audit Log
            await tx.auditLog.create({
              data: {
                instituteId,
                userId: req.user?.userId || null,
                action: 'STUDENT_ADMITTED',
                entityType: 'Student',
                entityId: student.id,
                newValues: {
                  admissionNumber: student.admissionNumber,
                  name: `${student.firstName} ${student.lastName}`,
                  batchId: data.batchId || null,
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
              parentUser,
              parentProfile,
              parentTempPassword,
              isExistingParentAccount,
            };
          },
          {
            maxWait: 15000,
            timeout: 20000,
          }
        );
        break; // Successfully committed, exit retry loop
      } catch (txErr: any) {
        // Retry only on transient pool acquisition timeouts, write conflicts, or unique constraint race
        if (
          attempt < 3 &&
          (txErr.code === 'P2028' || txErr.code === 'P2034' || txErr.code === 'P2002')
        ) {
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
  } catch (err: any) {
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
 * Get admission number prefix & preview pattern for the active institute
 */
export async function getAdmissionPrefixInfo(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }

    const batchId = (req.query.batchId as string) || undefined;
    const compactInst = await getOrSetCompactInstituteCode(prisma, instituteId);
    let batchCode = '00';

    if (batchId) {
      const batch = await prisma.batch.findFirst({
        where: { id: batchId, instituteId },
      });
      if (batch) {
        const instituteBatches = await prisma.batch.findMany({
          where: { instituteId },
          orderBy: { createdAt: 'asc' },
          select: { id: true },
        });
        const batchIndex = instituteBatches.findIndex((b) => b.id === batchId);
        batchCode = deriveBatchCode(batch, Math.max(0, batchIndex));
      }
    }

    const currentYear = getAdmissionYear(new Date());

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
  } catch (err: any) {
    console.error('[Get Admission Prefix Error]', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to get admission prefix' });
  }
}

/**
 * Get profile for currently logged-in student
 */
export async function getMyStudentProfile(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.user || req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Only student accounts can access this profile' });
    }

    const student = await prisma.student.findFirst({
      where: {
        userId: req.user.userId,
      },
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch student profile' });
  }
}

/**
 * Get student details by ID
 */
export async function getStudentById(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    // Enforce strict staff-to-student and role-based data isolation
    const authorized = await isStudentAuthorized(req, id, prisma);
    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to view this student record',
      });
    }

    const student = await prisma.student.findFirst({
      where: {
        id,
        instituteId,
      },
      include: {
        createdByUser: {
          select: { id: true, fullName: true, role: true },
        },
        institute: {
          select: { id: true, name: true, code: true, phone: true, email: true },
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

    let formattedStudent: any = formatStudentResponse(student);
    if (req.user?.role === 'STAFF') {
      const assignments = await getAuthorizedStaffAssignments(req, prisma);
      const authorizedBatchIds = assignments.authorizedBatchIds || [];
      formattedStudent = {
        ...formattedStudent,
        enrollments: (formattedStudent.enrollments || []).filter(
          (e: any) => !e.batchId || authorizedBatchIds.includes(e.batchId)
        ),
      };
    }

    return res.json({
      success: true,
      data: { student: formattedStudent },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to fetch student details' });
  }
}

/**
 * Update student profile
 */
export async function updateStudent(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const parse = updateStudentSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message,
      });
    }

    const authorized = await isStudentAuthorized(req, id, prisma);
    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to update this student',
      });
    }

    const existing = await prisma.student.findFirst({
      where: { id, instituteId },
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
      return res.status(404).json({ success: false, error: 'Student not found in this institute' });
    }

    const data = parse.data;

    // Staff cannot assign batches that are not assigned to them
    if (req.user?.role === 'STAFF' && data.batchId) {
      const isAssigned = await isStaffAssignedToBatch(req, data.batchId, prisma);
      if (!isAssigned) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You are not authorized to assign this batch.',
        });
      }
    }

    const updateData: any = {};

    if (data.firstName) updateData.firstName = data.firstName.trim();
    if (data.lastName) updateData.lastName = data.lastName.trim();
    if (data.studentPhone !== undefined) updateData.phone = data.studentPhone?.trim() || null;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.bloodGroup !== undefined) updateData.bloodGroup = data.bloodGroup?.trim() || null;
    if (data.photoUrl !== undefined) updateData.photoUrl = data.photoUrl?.trim() || null;
    if (data.dob !== undefined) {
      updateData.dob = data.dob && data.dob.trim() ? new Date(data.dob) : null;
    }

    if (data.notes !== undefined) {
      if (existing.notes && existing.notes.startsWith('{') && (existing.notes.includes('studentPassword') || existing.notes.includes('parentPassword'))) {
        try {
          const parsed = JSON.parse(existing.notes);
          parsed.userNotes = data.notes?.trim() || null;
          updateData.notes = JSON.stringify(parsed);
        } catch {
          updateData.notes = data.notes?.trim() || null;
        }
      } else {
        updateData.notes = data.notes?.trim() || null;
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update Student Table
      await tx.student.update({
        where: { id },
        data: updateData,
      });

      // 2. Update Student User Account (if exists)
      if (existing.userId) {
        const userUpdate: any = {};
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
            const parentUserUpdate: any = {};
            if (data.parentFullName) parentUserUpdate.fullName = data.parentFullName.trim();
            if (data.parentPhone) parentUserUpdate.phone = data.parentPhone.trim();
            if (data.parentEmail !== undefined) parentUserUpdate.email = data.parentEmail?.trim().toLowerCase() || null;
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
          instituteId,
          userId: req.user?.userId || null,
          action: 'STUDENT_UPDATED',
          entityType: 'Student',
          entityId: id,
          oldValues: existing as any,
          newValues: { ...updateData, batchId: data.batchId, subjectIds: data.subjectIds },
        },
      });
    });

    const fullUpdated = await prisma.student.findFirst({
      where: { id, instituteId },
      include: {
        user: true,
        enrollments: {
          where: { isActive: true },
          include: { batch: true, subject: true },
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
  } catch (err: any) {
    console.error('Error updating student profile:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to update student profile' });
  }
}

/**
 * Reset student login password (Staff / Academic Admin only)
 */
export async function resetStudentPassword(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }
    const { id } = req.params;

    const parse = resetStudentPasswordSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.errors[0]?.message || 'Invalid input' });
    }

    const authorized = await isStudentAuthorized(req, id, prisma);
    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to reset credentials for this student',
      });
    }

    const student = await prisma.student.findFirst({
      where: { id, instituteId },
      include: { user: true },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found in this institute' });
    }

    let targetUserId = student.userId;
    const temporaryPassword =
      parse.data?.password?.trim() ||
      parse.data?.newPassword?.trim() ||
      `Student#${generateSecureRandomToken(4)}2026`;
    const passwordHash = await hashPassword(temporaryPassword);

    if (!targetUserId) {
      // Create student user account if it did not exist
      const studentUser = await prisma.user.create({
        data: {
          fullName: `${student.firstName} ${student.lastName}`,
          phone: student.phone || null,
          passwordHash,
          role: 'STUDENT',
          isActive: true,
          mustChangePassword: false,
        },
      });

      await prisma.instituteMembership.create({
        data: {
          instituteId,
          userId: studentUser.id,
          role: 'STUDENT',
          isActive: true,
        },
      });

      await prisma.student.update({
        where: { id: student.id },
        data: { userId: studentUser.id },
      });

      targetUserId = studentUser.id;
    } else {
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          passwordHash,
          mustChangePassword: false,
        },
      });
    }

    // Invalidate any password reset tokens
    await prisma.passwordResetToken.deleteMany({
      where: { userId: targetUserId },
    });

    // Update credentialNotes in student.notes
    let credentialNotes: any = {};
    if (student.notes && student.notes.startsWith('{')) {
      try {
        credentialNotes = JSON.parse(student.notes);
      } catch {}
    } else if (student.notes) {
      credentialNotes.userNotes = student.notes;
    }
    credentialNotes.studentPassword = temporaryPassword;

    await prisma.student.update({
      where: { id: student.id },
      data: { notes: JSON.stringify(credentialNotes) },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        instituteId,
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
  } catch (err: any) {
    console.error('[Reset Student Password Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to reset student password' });
  }
}

/**
 * Update student login identifier (email/phone)
 */
export async function updateStudentLoginIdentifier(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }
    const { id } = req.params;

    const parse = updateStudentIdentifierSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.errors[0]?.message || 'Invalid input' });
    }

    const authorized = await isStudentAuthorized(req, id, prisma);
    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to update credentials for this student',
      });
    }

    const student = await prisma.student.findFirst({
      where: { id, instituteId },
      include: { user: true },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: 'Student not found in this institute' });
    }

    const cleanEmail = parse.data.email !== undefined ? (parse.data.email.trim().toLowerCase() || null) : undefined;
    const cleanPhone = parse.data.phone !== undefined ? (parse.data.phone.trim() || null) : undefined;

    // Check duplicate email
    if (cleanEmail) {
      const existingEmail = await prisma.user.findFirst({
        where: { email: cleanEmail, id: { not: student.userId || undefined } },
      });
      if (existingEmail) {
        return res.status(409).json({ success: false, error: `Email '${cleanEmail}' is already in use by another account` });
      }
    }

    // Check duplicate phone
    if (cleanPhone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone: cleanPhone, id: { not: student.userId || undefined } },
      });
      if (existingPhone) {
        return res.status(409).json({ success: false, error: `Phone '${cleanPhone}' is already in use by another account` });
      }
    }

    await prisma.$transaction(async (tx) => {
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
          instituteId,
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
  } catch (err: any) {
    console.error('[Update Student Identifier Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to update student identifier' });
  }
}

/**
 * Update Student Status (ACTIVE, PASSED_OUT, DISCONTINUED)
 */
export async function updateStudentStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;

    const parse = updateStudentStatusSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: parse.error.errors[0]?.message,
      });
    }

    const { status, reason } = parse.data;

    const authorized = await isStudentAuthorized(req, id, prisma);
    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to update status for this student',
      });
    }

    const existing = await prisma.student.findFirst({
      where: { id, instituteId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Student not found in this institute' });
    }

    const updated = await prisma.$transaction(async (tx) => {
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
          instituteId,
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update student status' });
  }
}

/**
 * Upload student photograph (for an existing student or direct admission upload)
 */
export async function uploadStudentPhoto(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });
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

    const relativeKey = getRelativeStorageKey(instituteId, req.file.filename);

    if (id && id !== 'admission') {
      const authorized = await isStudentAuthorized(req, id, prisma);
      if (!authorized) {
        return res.status(403).json({ success: false, error: 'Forbidden: Not authorized to update this student photograph' });
      }

      const updatedStudent = await prisma.student.update({
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to upload student photograph' });
  }
}

/**
 * Get student photograph with authorized access control
 */
export async function getStudentPhoto(req: AuthenticatedRequest, res: Response) {
  try {
    const targetInstituteId = req.instituteId || (req.query.instituteId as string);
    const { id } = req.params;

    const authorized = await isStudentAuthorized(req, id, prisma);
    if (!authorized) {
      return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to view this student photograph' });
    }

    const student = await prisma.student.findUnique({
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

    const absPath = resolveAbsolutePath(student.photoUrl);
    if (!absPath || !fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, error: 'Photograph file not found on server' });
    }

    const ext = path.extname(absPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
    res.setHeader('Cache-Control', 'no-cache, private');
    return fs.createReadStream(absPath).pipe(res);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to stream student photograph' });
  }
}

/**
 * Stream photograph by storage key (tenant verified)
 */
export async function getRawPhoto(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });
    const rawKey = decodeURIComponent(req.params.key);
    const key = rawKey.startsWith(`${instituteId}/`) ? rawKey : `${instituteId}/${rawKey}`;

    if (!key.startsWith(`${instituteId}/`)) {
      return res.status(403).json({ success: false, error: 'Forbidden: Cross-institute photograph access rejected' });
    }

    const absPath = resolveAbsolutePath(key);
    if (!absPath || !fs.existsSync(absPath)) {
      return res.status(404).json({ success: false, error: 'Photograph file not found' });
    }

    const ext = path.extname(absPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
    return fs.createReadStream(absPath).pipe(res);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to stream photograph' });
  }
}

/**
 * Activate or deactivate a student login account
 */
export async function updateStudentAccountStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      return res.status(400).json({ success: false, error: 'Institute context required' });
    }
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'isActive boolean flag is required' });
    }

    const authorized = await isStudentAuthorized(req, id, prisma);
    if (!authorized) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: You are not authorized to update account status for this student',
      });
    }

    const student = await prisma.student.findFirst({
      where: { id, instituteId },
      include: { user: true },
    });

    if (!student || !student.userId) {
      return res.status(404).json({ success: false, error: 'Student login account not found' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: student.userId! },
        data: { isActive },
      });

      await tx.instituteMembership.updateMany({
        where: { instituteId, userId: student.userId! },
        data: { isActive },
      });

      await tx.auditLog.create({
        data: {
          instituteId,
          userId: req.user?.userId || null,
          action: 'STUDENT_ACCOUNT_STATUS_CHANGED',
          entityType: 'User',
          entityId: student.userId!,
          newValues: { isActive, studentId: student.id },
        },
      });
    });

    return res.json({
      success: true,
      message: `Student account has been ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: { isActive },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to update student account status' });
  }
}

/**
 * Real-time parent account lookup by phone or email for sibling auto-linking during admission
 */
export async function lookupParent(req: AuthenticatedRequest, res: Response) {
  try {
    const query = ((req.query.query || req.query.phone || req.query.email || '') as string).trim();
    if (!query || query.length < 3) {
      return res.json({ success: true, data: { found: false } });
    }

    const cleanQuery = query.toLowerCase();
    const existingUser = await prisma.user.findFirst({
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
  } catch (err: any) {
    console.error('Error looking up parent:', err);
    return res.status(500).json({ success: false, error: 'Failed to lookup parent' });
  }
}

/**
 * Assign or update student batch and subject allocations
 */
export async function assignStudentBatch(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id } = req.params;
    const { batchId, subjectIds = [] } = req.body;

    const student = await prisma.student.findFirst({
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
      const authorized = await isStudentAuthorized(req, id, prisma);
      if (!authorized) {
        return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to manage this student' });
      }
      if (batchId) {
        const isAssigned = await isStaffAssignedToBatch(req, batchId, prisma);
        if (!isAssigned) {
          return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized for this batch' });
        }
      }
      if (batchId && Array.isArray(subjectIds) && subjectIds.length > 0) {
        for (const sid of subjectIds) {
          const isAssignedSub = await isStaffAssignedToBatchSubject(req, batchId, sid, prisma);
          if (!isAssignedSub) {
            return res.status(403).json({ success: false, error: `Forbidden: You are not authorized for subject '${sid}' in this batch` });
          }
        }
      }
    }

    // Verify batch if provided
    let batch: any = null;
    if (batchId) {
      batch = await prisma.batch.findFirst({
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

    await prisma.$transaction(async (tx) => {
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
          const validSubjectIds = (batch?.batchSubjects || []).map((bs: any) => bs.subjectId);
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
  } catch (err: any) {
    console.error('Error assigning student batch:', err);
    return res.status(500).json({ success: false, error: 'Failed to assign student batch' });
  }
}

/**
 * Lookup existing students within the current institute (for enrollment and deduplication)
 */
export async function lookupExistingStudent(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const search = ((req.query.search || req.query.query || req.query.q || req.query.phone || req.query.admissionNumber || '') as string).trim();
    if (!search || search.length < 2) {
      return res.status(400).json({ success: false, error: 'Search term must be at least 2 characters' });
    }

    const students = await prisma.student.findMany({
      where: {
        instituteId,
        OR: [
          { admissionNumber: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { user: { phone: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
        ],
      },
      take: 20,
      include: {
        user: { select: { id: true, email: true, phone: true, fullName: true, isActive: true } },
        enrollments: {
          where: { isActive: true },
          include: {
            batch: { select: { id: true, name: true, code: true } },
            subject: { select: { id: true, name: true, code: true } },
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
      admissionNumber: s.admissionNumber,
      firstName: s.firstName,
      lastName: s.lastName,
      fullName: `${s.firstName} ${s.lastName}`,
      phone: s.phone || s.user?.phone || null,
      email: s.user?.email || null,
      status: s.status,
      photoUrl: s.photoUrl,
      activeEnrollments: s.enrollments.map((e) => ({
        batchId: e.batchId,
        batchName: e.batch?.name,
        batchCode: e.batch?.code,
        subjectId: e.subjectId,
        subjectName: e.subject?.name,
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
  } catch (err: any) {
    console.error('[lookupExistingStudent error]', err);
    return res.status(500).json({ success: false, error: 'Failed to lookup students' });
  }
}

export const enrollExistingStudentSchema = z.object({
  batchId: z.string().uuid('Valid batch ID is required'),
  subjectIds: z.array(z.string().uuid()).optional().default([]),
});

/**
 * Enroll an existing canonical student profile into an authorized batch and subject(s)
 */
export async function enrollExistingStudent(req: AuthenticatedRequest, res: Response) {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) return res.status(400).json({ success: false, error: 'Institute context required' });

    const { id } = req.params;
    const parse = enrollExistingStudentSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.errors[0]?.message || 'Validation error' });
    }

    const { batchId, subjectIds } = parse.data;

    // 1. Verify student exists in this institute
    const student = await prisma.student.findFirst({
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
    const batch = await prisma.batch.findFirst({
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
      const isAssignedBatch = await isStaffAssignedToBatch(req, batchId, prisma);
      if (!isAssignedBatch) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You are not authorized to enroll students into this batch',
        });
      }

      if (subjectIds.length > 0) {
        for (const sid of subjectIds) {
          const isAssignedSub = await isStaffAssignedToBatchSubject(req, batchId, sid, prisma);
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
    const existingEnrollments = await prisma.studentEnrollment.findMany({
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
    await prisma.$transaction(async (tx) => {
      // Primary batch enrollment
      const primary = await tx.studentEnrollment.findFirst({
        where: { studentId: id, batchId, subjectId: null },
      });
      if (!primary) {
        await tx.studentEnrollment.create({
          data: { studentId: id, batchId, subjectId: null, isActive: true },
        });
      } else if (!primary.isActive) {
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
        } else if (!subEnr.isActive) {
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
    const updatedEnrollments = await prisma.studentEnrollment.findMany({
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
  } catch (err: any) {
    console.error('[enrollExistingStudent error]', err);
    return res.status(500).json({ success: false, error: 'Failed to enroll student' });
  }
}


