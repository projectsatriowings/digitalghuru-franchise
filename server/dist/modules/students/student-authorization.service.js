"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuthorizedStaffAssignments = getAuthorizedStaffAssignments;
exports.getAuthorizedStudentScope = getAuthorizedStudentScope;
exports.isStudentAuthorized = isStudentAuthorized;
exports.isStaffAssignedToBatch = isStaffAssignedToBatch;
exports.isStaffAssignedToBatchSubject = isStaffAssignedToBatchSubject;
const prisma_js_1 = require("../../prisma.js");
/**
 * Fetch a staff member's authorized batch and subject assignments.
 * For ACADEMIC_ADMIN and SUPER_ADMIN, returns isStaff: false with unrestricted privileges.
 */
async function getAuthorizedStaffAssignments(req, prismaClient = prisma_js_1.prisma) {
    if (!req.user) {
        throw new Error('Unauthorized: Authentication required');
    }
    const role = req.user.role;
    const userId = req.user.userId || req.user.id;
    const instituteId = req.instituteId;
    if (role === 'SUPER_ADMIN' || role === 'ACADEMIC_ADMIN' || role === 'BRANCH_ADMIN' || role === 'FRANCHISE_OWNER') {
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
    if (req._cachedStaffAssignments) {
        return req._cachedStaffAssignments;
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
    const subjectIdsByBatch = {};
    const allSubjectIdsSet = new Set();
    const batchIdSet = new Set();
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
    const result = {
        isStaff: true,
        staffProfileId: staffProfile.id,
        authorizedBatchIds: Array.from(batchIdSet),
        subjectIdsByBatch,
        allAuthorizedSubjectIds: Array.from(allSubjectIdsSet),
    };
    req._cachedStaffAssignments = result;
    return result;
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
async function getAuthorizedStudentScope(req, prismaClient = prisma_js_1.prisma, options) {
    if (!req.user) {
        throw new Error('Unauthorized: Authentication required');
    }
    const role = req.user.role;
    const userId = req.user.userId || req.user.id;
    const instituteId = req.instituteId;
    if (!instituteId && role !== 'SUPER_ADMIN' && role !== 'FRANCHISE_OWNER' && role !== 'PARENT' && role !== 'STUDENT') {
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
    // 2. FRANCHISE_OWNER: consolidated franchise + online scope or specific branch scope
    if (role === 'FRANCHISE_OWNER') {
        const franchiseId = req.franchiseId;
        const assignedBranchIds = req.assignedBranchIds || [];
        if (franchiseId && (!instituteId || req.isConsolidatedBranchView)) {
            return {
                instituteId: instituteId || '',
                isStaff: false,
                assignedBatchIds: [],
                whereClause: {
                    OR: [
                        ...(assignedBranchIds.length > 0 ? [{ instituteId: { in: assignedBranchIds } }] : []),
                        { franchiseId, instituteId: null },
                    ],
                },
            };
        }
        return {
            instituteId: instituteId,
            isStaff: false,
            assignedBatchIds: [],
            whereClause: { instituteId: instituteId },
        };
    }
    // 2b. ACADEMIC_ADMIN / BRANCH_ADMIN: strict single-branch institute scope
    if (role === 'ACADEMIC_ADMIN' || role === 'BRANCH_ADMIN') {
        return {
            instituteId: instituteId,
            isStaff: false,
            assignedBatchIds: [],
            whereClause: { instituteId: instituteId },
        };
    }
    // 3. STAFF: Strict isolation â€” only students enrolled in batches and subjects assigned to this staff
    if (role === 'STAFF') {
        const assignments = await getAuthorizedStaffAssignments(req, prismaClient);
        if (!assignments.staffProfileId || assignments.authorizedBatchIds.length === 0) {
            return {
                instituteId: instituteId,
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
                    instituteId: instituteId,
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
                        instituteId: instituteId,
                        isStaff: true,
                        assignedBatchIds: authorizedBatchIds,
                        whereClause: { id: '__DENIED_UNAUTHORIZED_SUBJECT__' },
                    };
                }
                return {
                    instituteId: instituteId,
                    isStaff: true,
                    assignedBatchIds: authorizedBatchIds,
                    whereClause: {
                        instituteId: instituteId,
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
                    instituteId: instituteId,
                    isStaff: true,
                    assignedBatchIds: authorizedBatchIds,
                    whereClause: {
                        instituteId: instituteId,
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
                instituteId: instituteId,
                isStaff: true,
                assignedBatchIds: authorizedBatchIds,
                whereClause: {
                    instituteId: instituteId,
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
                    instituteId: instituteId,
                    isStaff: true,
                    assignedBatchIds: authorizedBatchIds,
                    whereClause: { id: '__DENIED_UNAUTHORIZED_SUBJECT__' },
                };
            }
            // Find batches where staff teaches this subject
            const matchingBatches = authorizedBatchIds.filter((bId) => (subjectIdsByBatch[bId] || []).includes(options.subjectId));
            return {
                instituteId: instituteId,
                isStaff: true,
                assignedBatchIds: authorizedBatchIds,
                whereClause: {
                    instituteId: instituteId,
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
        const batchSubjectConditions = [];
        for (const bId of authorizedBatchIds) {
            const sids = subjectIdsByBatch[bId] || [];
            if (sids.length > 0) {
                batchSubjectConditions.push({
                    isActive: true,
                    batchId: bId,
                    subjectId: { in: sids },
                });
            }
            else {
                batchSubjectConditions.push({
                    isActive: true,
                    batchId: bId,
                });
            }
        }
        if (batchSubjectConditions.length === 0) {
            return {
                instituteId: instituteId,
                isStaff: true,
                assignedBatchIds: authorizedBatchIds,
                whereClause: { id: '__DENIED_NO_VALID_CONDITIONS__' },
            };
        }
        return {
            instituteId: instituteId,
            isStaff: true,
            assignedBatchIds: authorizedBatchIds,
            whereClause: {
                instituteId: instituteId,
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
async function isStudentAuthorized(req, studentId, prismaClient = prisma_js_1.prisma, options) {
    if (!req.user)
        return false;
    // 1. SUPER_ADMIN: full access (scoped if instituteId header provided)
    if (req.user.role === 'SUPER_ADMIN') {
        const student = await prismaClient.student.findFirst({
            where: {
                id: studentId,
                ...(req.instituteId ? { instituteId: req.instituteId } : {}),
            },
            select: { id: true },
        });
        return !!student;
    }
    // 1b. FRANCHISE_OWNER: any branch in their franchise OR their franchise's online-direct students
    if (req.user.role === 'FRANCHISE_OWNER') {
        let franchiseId = req.franchiseId;
        let assignedBranchIds = req.assignedBranchIds || [];
        if (!franchiseId) {
            const franchise = await prismaClient.franchise.findFirst({
                where: { ownerUserId: req.user.userId },
                include: { branches: { select: { id: true } } },
            });
            franchiseId = franchise?.id;
            assignedBranchIds = franchise?.branches.map((b) => b.id) || [];
        }
        if (!franchiseId)
            return false;
        const student = await prismaClient.student.findFirst({
            where: {
                id: studentId,
                OR: [
                    ...(assignedBranchIds.length > 0 ? [{ instituteId: { in: assignedBranchIds } }] : []),
                    { franchiseId, instituteId: null },
                    { institute: { franchiseId } },
                ],
            },
            select: { id: true, instituteId: true },
        });
        if (!student)
            return false;
        // If a specific branch is active (not consolidated), still allow pure ONLINE students of the franchise
        if (req.instituteId && !req.isConsolidatedBranchView && student.instituteId && student.instituteId !== req.instituteId) {
            return false;
        }
        return true;
    }
    // 1c. ACADEMIC_ADMIN / BRANCH_ADMIN: strict single-branch scope
    if (req.user.role === 'ACADEMIC_ADMIN' ||
        req.user.role === 'BRANCH_ADMIN') {
        if (!req.instituteId)
            return false;
        const student = await prismaClient.student.findFirst({
            where: {
                id: studentId,
                instituteId: req.instituteId,
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
        if (!student)
            return false;
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
async function isStaffAssignedToBatch(req, batchId, prismaClient = prisma_js_1.prisma) {
    if (req.user?.role === 'ACADEMIC_ADMIN' ||
        req.user?.role === 'SUPER_ADMIN' ||
        req.user?.role === 'BRANCH_ADMIN' ||
        req.user?.role === 'FRANCHISE_OWNER') {
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
async function isStaffAssignedToBatchSubject(req, batchId, subjectId, prismaClient = prisma_js_1.prisma) {
    if (req.user?.role === 'ACADEMIC_ADMIN' ||
        req.user?.role === 'SUPER_ADMIN' ||
        req.user?.role === 'BRANCH_ADMIN' ||
        req.user?.role === 'FRANCHISE_OWNER') {
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
