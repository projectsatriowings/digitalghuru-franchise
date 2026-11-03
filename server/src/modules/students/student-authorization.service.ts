import { Prisma } from '@prisma/client';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import { prisma as defaultPrisma } from '../../prisma.js';

export interface StudentScopeResult {
  instituteId: string;
  isStaff: boolean;
  assignedBatchIds: string[];
  whereClause: Prisma.StudentWhereInput;
}

export interface StaffAssignments {
  isStaff: boolean;
  staffProfileId?: string;
  authorizedBatchIds: string[];
  subjectIdsByBatch: Record<string, string[]>;
  allAuthorizedSubjectIds: string[];
}

/**
 * Fetch a staff member's authorized batch and subject assignments.
 * For ACADEMIC_ADMIN and SUPER_ADMIN, returns isStaff: false with unrestricted privileges.
 */
export async function getAuthorizedStaffAssignments(
  req: AuthenticatedRequest,
  prismaClient: any = defaultPrisma
): Promise<StaffAssignments> {
  if (!req.user) {
    throw new Error('Unauthorized: Authentication required');
  }

  const role = req.user.role;
  const userId = req.user.userId || (req.user as any).id;
  const instituteId = req.instituteId;

  if (role === 'SUPER_ADMIN' || role === 'ACADEMIC_ADMIN' || role === 'BRANCH_ADMIN') {
    return {
      isStaff: false,
      authorizedBatchIds: [],
      subjectIdsByBatch: {},
      allAuthorizedSubjectIds: [],
    };
  }

  if (role !== 'STAFF') {
    return {
      isStaff: false,
      authorizedBatchIds: [],
      subjectIdsByBatch: {},
      allAuthorizedSubjectIds: [],
    };
  }

  // Request-scoped cache: Avoid redundant database queries for the same staff user within one HTTP request
  if ((req as any)._cachedStaffAssignments) {
    return (req as any)._cachedStaffAssignments;
  }

  const staffProfile = await prismaClient.staffProfile.findFirst({
    where: { userId, instituteId },
    include: {
      batchSubjects: {
        where: {
          isActive: true,
          batch: { instituteId, isActive: true },
        },
        select: {
          batchId: true,
          subjectId: true,
        },
      },
      assignments: {
        where: {
          batch: { instituteId, isActive: true },
        },
        select: {
          batchId: true,
        },
      },
    },
  });

  if (!staffProfile) {
    return {
      isStaff: true,
      authorizedBatchIds: [],
      subjectIdsByBatch: {},
      allAuthorizedSubjectIds: [],
    };
  }

  const subjectIdsByBatch: Record<string, string[]> = {};
  const allSubjectIdsSet = new Set<string>();
  const batchIdSet = new Set<string>();

  // Add all batchSubjects directly assigned to this staff member
  for (const bs of staffProfile.batchSubjects) {
    batchIdSet.add(bs.batchId);
    allSubjectIdsSet.add(bs.subjectId);
    if (!subjectIdsByBatch[bs.batchId]) {
      subjectIdsByBatch[bs.batchId] = [];
    }
    if (!subjectIdsByBatch[bs.batchId].includes(bs.subjectId)) {
      subjectIdsByBatch[bs.batchId].push(bs.subjectId);
    }
  }

  // Also include any batches assigned via StaffBatchAssignment
  for (const a of staffProfile.assignments) {
    batchIdSet.add(a.batchId);
    if (!subjectIdsByBatch[a.batchId]) {
      subjectIdsByBatch[a.batchId] = [];
    }
  }

  const result: StaffAssignments = {
    isStaff: true,
    staffProfileId: staffProfile.id,
    authorizedBatchIds: Array.from(batchIdSet),
    subjectIdsByBatch,
    allAuthorizedSubjectIds: Array.from(allSubjectIdsSet),
  };

  (req as any)._cachedStaffAssignments = result;
  return result;
}

export interface StudentScopeOptions {
  batchId?: string;
  subjectId?: string;
}

/**
 * Build database-level authorization scope for students based on authenticated user role and assignments.
 * Enforces:
 * 1. Institute tenant isolation
 * 2. Staff-to-batch and staff-to-subject assignment isolation
 * 3. Optional batchId and subjectId filtering
 * 4. Parent child verification
 * 5. Student self-profile restriction
 * 6. Academic Admin full institute scope
 */
export async function getAuthorizedStudentScope(
  req: AuthenticatedRequest,
  prismaClient: any = defaultPrisma,
  options?: StudentScopeOptions
): Promise<StudentScopeResult> {
  if (!req.user) {
    throw new Error('Unauthorized: Authentication required');
  }

  const role = req.user.role;
  const userId = req.user.userId || (req.user as any).id;
  const instituteId = req.instituteId;

  if (!instituteId && role !== 'SUPER_ADMIN') {
    throw new Error('Institute context required');
  }

  // 1. SUPER_ADMIN: platform management with institute context
  if (role === 'SUPER_ADMIN') {
    return {
      instituteId: instituteId || '',
      isStaff: false,
      assignedBatchIds: [],
      whereClause: instituteId ? { instituteId } : {},
    };
  }

  // 2. ACADEMIC_ADMIN: full institute scope
  if (role === 'ACADEMIC_ADMIN' || role === 'BRANCH_ADMIN') {
    return {
      instituteId: instituteId!,
      isStaff: false,
      assignedBatchIds: [],
      whereClause: { instituteId: instituteId! },
    };
  }

  // 3. STAFF: Strict isolation â€” only students enrolled in batches and subjects assigned to this staff
  if (role === 'STAFF') {
    const assignments = await getAuthorizedStaffAssignments(req, prismaClient);

    if (!assignments.staffProfileId || assignments.authorizedBatchIds.length === 0) {
      return {
        instituteId: instituteId!,
        isStaff: true,
        assignedBatchIds: [],
        whereClause: { id: '__DENIED_NO_ASSIGNMENTS__' },
      };
    }

    const { authorizedBatchIds, subjectIdsByBatch, allAuthorizedSubjectIds } = assignments;

    // A. Specific batch requested:
    if (options?.batchId) {
      if (!authorizedBatchIds.includes(options.batchId)) {
        return {
          instituteId: instituteId!,
          isStaff: true,
          assignedBatchIds: authorizedBatchIds,
          whereClause: { id: '__DENIED_UNAUTHORIZED_BATCH__' },
        };
      }

      const assignedSubjectsInBatch = subjectIdsByBatch[options.batchId] || [];

      // A1. Specific subject requested in this batch:
      if (options?.subjectId) {
        if (!assignedSubjectsInBatch.includes(options.subjectId)) {
          return {
            instituteId: instituteId!,
            isStaff: true,
            assignedBatchIds: authorizedBatchIds,
            whereClause: { id: '__DENIED_UNAUTHORIZED_SUBJECT__' },
          };
        }

        return {
          instituteId: instituteId!,
          isStaff: true,
          assignedBatchIds: authorizedBatchIds,
          whereClause: {
            instituteId: instituteId!,
            enrollments: {
              some: {
                isActive: true,
                batchId: options.batchId,
                subjectId: options.subjectId,
              },
            },
          },
        };
      }

      // A2. Batch requested without specific subject:
      if (assignedSubjectsInBatch.length > 0) {
        return {
          instituteId: instituteId!,
          isStaff: true,
          assignedBatchIds: authorizedBatchIds,
          whereClause: {
            instituteId: instituteId!,
            enrollments: {
              some: {
                isActive: true,
                batchId: options.batchId,
                subjectId: { in: assignedSubjectsInBatch },
              },
            },
          },
        };
      }

      return {
        instituteId: instituteId!,
        isStaff: true,
        assignedBatchIds: authorizedBatchIds,
        whereClause: {
          instituteId: instituteId!,
          enrollments: {
            some: {
              isActive: true,
              batchId: options.batchId,
            },
          },
        },
      };
    }

    // B. Specific subject requested without batch:
    if (options?.subjectId) {
      if (!allAuthorizedSubjectIds.includes(options.subjectId)) {
        return {
          instituteId: instituteId!,
          isStaff: true,
          assignedBatchIds: authorizedBatchIds,
          whereClause: { id: '__DENIED_UNAUTHORIZED_SUBJECT__' },
        };
      }

      // Find batches where staff teaches this subject
      const matchingBatches = authorizedBatchIds.filter((bId) =>
        (subjectIdsByBatch[bId] || []).includes(options.subjectId!)
      );

      return {
        instituteId: instituteId!,
        isStaff: true,
        assignedBatchIds: authorizedBatchIds,
        whereClause: {
          instituteId: instituteId!,
          enrollments: {
            some: {
              isActive: true,
              batchId: { in: matchingBatches },
              subjectId: options.subjectId,
            },
          },
        },
      };
    }

    // C. No specific batch or subject: student must be in staff's assigned batch and subject
    const batchSubjectConditions: Prisma.StudentEnrollmentWhereInput[] = [];

    for (const bId of authorizedBatchIds) {
      const sids = subjectIdsByBatch[bId] || [];
      if (sids.length > 0) {
        batchSubjectConditions.push({
          isActive: true,
          batchId: bId,
          subjectId: { in: sids },
        });
      } else {
        batchSubjectConditions.push({
          isActive: true,
          batchId: bId,
        });
      }
    }

    if (batchSubjectConditions.length === 0) {
      return {
        instituteId: instituteId!,
        isStaff: true,
        assignedBatchIds: authorizedBatchIds,
        whereClause: { id: '__DENIED_NO_VALID_CONDITIONS__' },
      };
    }

    return {
      instituteId: instituteId!,
      isStaff: true,
      assignedBatchIds: authorizedBatchIds,
      whereClause: {
        instituteId: instituteId!,
        OR: [
          {
            enrollments: {
              some: {
                OR: batchSubjectConditions,
              },
            },
          },
          // Allow staff to view freshly created unassigned students that have no active enrollments yet
          {
            createdByUserId: userId,
            enrollments: {
              none: { isActive: true },
            },
          },
        ],
      },
    };
  }

  // 4. PARENT: only verified linked children
  if (role === 'PARENT') {
    return {
      instituteId: instituteId || '',
      isStaff: false,
      assignedBatchIds: [],
      whereClause: {
        parentRelations: {
          some: {
            parent: { userId },
          },
        },
        ...(instituteId ? { instituteId } : {}),
      },
    };
  }

  // 5. STUDENT: only their own record
  if (role === 'STUDENT') {
    return {
      instituteId: instituteId || '',
      isStaff: false,
      assignedBatchIds: [],
      whereClause: {
        userId,
        ...(instituteId ? { instituteId } : {}),
      },
    };
  }

  return {
    instituteId: instituteId || '',
    isStaff: false,
    assignedBatchIds: [],
    whereClause: { id: '__DENIED_UNKNOWN_ROLE__' },
  };
}

/**
 * Check if the caller is authorized to view or modify a specific student
 */
export async function isStudentAuthorized(
  req: AuthenticatedRequest,
  studentId: string,
  prismaClient: any = defaultPrisma,
  options?: StudentScopeOptions
): Promise<boolean> {
  if (!req.user) return false;

  // 1. SUPER_ADMIN / ACADEMIC_ADMIN: full institute scope
  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'ACADEMIC_ADMIN' || req.user.role === 'BRANCH_ADMIN') {
    const student = await prismaClient.student.findFirst({
      where: {
        id: studentId,
        ...(req.instituteId ? { instituteId: req.instituteId } : {}),
      },
      select: { id: true },
    });
    return !!student;
  }

  // 2. STAFF
  if (req.user.role === 'STAFF') {
    const student = await prismaClient.student.findFirst({
      where: {
        id: studentId,
        ...(req.instituteId ? { instituteId: req.instituteId } : {}),
      },
      select: { id: true, createdByUserId: true },
    });

    if (!student) return false;

    // If options specify batchId or subjectId (e.g. marking attendance or enrolling in subject),
    // strictly enforce enrollment in that batch/subject:
    if (options?.batchId || options?.subjectId) {
      const scope = await getAuthorizedStudentScope(req, prismaClient, options);
      const scopedStudent = await prismaClient.student.findFirst({
        where: {
          AND: [
            { id: studentId },
            scope.whereClause,
          ],
        },
        select: { id: true },
      });
      return !!scopedStudent;
    }

    // For general profile / credential management without batch/subject filter:
    const scope = await getAuthorizedStudentScope(req, prismaClient);
    const scopedStudent = await prismaClient.student.findFirst({
      where: {
        AND: [
          { id: studentId },
          scope.whereClause,
        ],
      },
      select: { id: true },
    });
    return !!scopedStudent;
  }

  // 3. PARENT / STUDENT / OTHER
  const scope = await getAuthorizedStudentScope(req, prismaClient, options);
  const student = await prismaClient.student.findFirst({
    where: {
      AND: [
        { id: studentId },
        scope.whereClause,
      ],
    },
    select: { id: true },
  });
  return !!student;
}

/**
 * Check if a staff member is assigned to a specific batch
 */
export async function isStaffAssignedToBatch(
  req: AuthenticatedRequest,
  batchId: string,
  prismaClient: any = defaultPrisma
): Promise<boolean> {
  if (req.user?.role === 'ACADEMIC_ADMIN' || req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'BRANCH_ADMIN') {
    return true;
  }
  if (req.user?.role !== 'STAFF') {
    return false;
  }

  const assignments = await getAuthorizedStaffAssignments(req, prismaClient);
  return assignments.authorizedBatchIds.includes(batchId);
}

/**
 * Check if a staff member is assigned to a specific subject within a batch
 */
export async function isStaffAssignedToBatchSubject(
  req: AuthenticatedRequest,
  batchId: string,
  subjectId: string,
  prismaClient: any = defaultPrisma
): Promise<boolean> {
  if (req.user?.role === 'ACADEMIC_ADMIN' || req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'BRANCH_ADMIN') {
    return true;
  }
  if (req.user?.role !== 'STAFF') {
    return false;
  }

  const assignments = await getAuthorizedStaffAssignments(req, prismaClient);
  if (!assignments.authorizedBatchIds.includes(batchId)) {
    return false;
  }
  const assignedSubjects = assignments.subjectIdsByBatch[batchId] || [];
  // If staff has no specific subject restrictions in this batch (assigned to whole batch), they are authorized for all subjects in it
  if (assignedSubjects.length === 0) {
    return true;
  }
  if (assignedSubjects.includes(subjectId)) {
    return true;
  }

  // Fallback: Check if the staff member is directly allocated to this batch and subject
  if (assignments.staffProfileId) {
    const directAllocation = await prismaClient.batchSubject.findFirst({
      where: {
        batchId,
        subjectId,
        staffProfileId: assignments.staffProfileId,
      },
    });
    if (directAllocation) {
      return true;
    }
  }

  return false;
}
