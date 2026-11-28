"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOFTWARE_ACCESS_DISABLED_ERROR = void 0;
exports.getFranchiseSoftwareAccessMap = getFranchiseSoftwareAccessMap;
exports.getFranchiseSoftwareAccess = getFranchiseSoftwareAccess;
exports.resolveStudentFranchiseId = resolveStudentFranchiseId;
exports.resolveUserCourseSoftwareAccess = resolveUserCourseSoftwareAccess;
const client_1 = require("@prisma/client");
const prisma_js_1 = require("../prisma.js");
exports.SOFTWARE_ACCESS_DISABLED_ERROR = 'Course Management Software access is not included in this franchise agreement.';
/**
 * Resolve Course Software Access status for multiple franchises in a single query.
 * Uses each franchise's latest ACTIVE agreement, falling back to its latest non-draft agreement.
 */
async function getFranchiseSoftwareAccessMap(franchiseIds) {
    const uniqueIds = Array.from(new Set(franchiseIds.filter(Boolean)));
    const result = new Map();
    if (uniqueIds.length === 0)
        return result;
    const agreements = await prisma_js_1.prisma.franchiseAgreement.findMany({
        where: { franchiseId: { in: uniqueIds } },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        select: {
            franchiseId: true,
            status: true,
            courseSoftwareAccessEnabled: true,
            courseSoftwarePricingNotes: true,
        },
    });
    const activeByFranchise = new Map();
    const fallbackByFranchise = new Map();
    for (const agr of agreements) {
        if (agr.status === 'ACTIVE' && !activeByFranchise.has(agr.franchiseId)) {
            activeByFranchise.set(agr.franchiseId, agr);
        }
        if (agr.status !== 'DRAFT' && !fallbackByFranchise.has(agr.franchiseId)) {
            fallbackByFranchise.set(agr.franchiseId, agr);
        }
    }
    for (const fid of uniqueIds) {
        const selected = activeByFranchise.get(fid) || fallbackByFranchise.get(fid);
        result.set(fid, {
            enabled: selected ? selected.courseSoftwareAccessEnabled !== false : true,
            franchiseId: fid,
            pricingNotes: selected?.courseSoftwarePricingNotes || null,
        });
    }
    return result;
}
/**
 * Resolve Course Software Access status for a single franchise.
 */
async function getFranchiseSoftwareAccess(franchiseId) {
    if (!franchiseId) {
        return { enabled: true, franchiseId: null, pricingNotes: null };
    }
    const map = await getFranchiseSoftwareAccessMap([franchiseId]);
    return map.get(franchiseId) || { enabled: true, franchiseId, pricingNotes: null };
}
/**
 * Resolve the franchise ID owning a student record (via campus branch or direct online franchise link).
 */
async function resolveStudentFranchiseId(studentId) {
    if (!studentId)
        return null;
    const student = await prisma_js_1.prisma.student.findUnique({
        where: { id: studentId },
        select: {
            franchiseId: true,
            institute: { select: { franchiseId: true } },
        },
    });
    return student?.institute?.franchiseId || student?.franchiseId || null;
}
/**
 * Resolve whether an authenticated user has Course Software Access under their franchise agreement(s).
 */
async function resolveUserCourseSoftwareAccess(user) {
    if (!user) {
        return { enabled: false, franchiseId: null, pricingNotes: null };
    }
    if (user.role === client_1.UserRole.SUPER_ADMIN) {
        return { enabled: true, franchiseId: null, pricingNotes: null };
    }
    const userId = user.userId || user.id;
    if (!userId) {
        return { enabled: false, franchiseId: null, pricingNotes: null };
    }
    if (user.role === client_1.UserRole.FRANCHISE_OWNER) {
        let franchiseId = user.franchiseId || null;
        if (!franchiseId) {
            const owned = await prisma_js_1.prisma.franchise.findFirst({
                where: {
                    OR: [
                        { ownerUserId: userId },
                        ...(user.email ? [{ email: { equals: user.email.trim(), mode: 'insensitive' } }] : []),
                    ],
                },
                select: { id: true },
            });
            franchiseId = owned?.id || null;
        }
        return franchiseId
            ? getFranchiseSoftwareAccess(franchiseId)
            : { enabled: true, franchiseId: null, pricingNotes: null };
    }
    if (user.role === client_1.UserRole.STUDENT) {
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { userId },
            select: {
                franchiseId: true,
                institute: { select: { franchiseId: true } },
            },
        });
        const franchiseId = student?.institute?.franchiseId || student?.franchiseId || null;
        return franchiseId
            ? getFranchiseSoftwareAccess(franchiseId)
            : { enabled: true, franchiseId: null, pricingNotes: null };
    }
    if (user.role === client_1.UserRole.PARENT) {
        const parent = await prisma_js_1.prisma.parentProfile.findFirst({
            where: { userId },
            select: {
                studentRelations: {
                    select: {
                        student: {
                            select: {
                                franchiseId: true,
                                institute: { select: { franchiseId: true } },
                            },
                        },
                    },
                },
            },
        });
        const franchiseIds = Array.from(new Set((parent?.studentRelations || [])
            .map((r) => r.student?.institute?.franchiseId || r.student?.franchiseId)
            .filter((fid) => Boolean(fid))));
        if (franchiseIds.length === 0) {
            return { enabled: true, franchiseId: null, pricingNotes: null };
        }
        const accessMap = await getFranchiseSoftwareAccessMap(franchiseIds);
        for (const fid of franchiseIds) {
            const status = accessMap.get(fid);
            if (!status || status.enabled) {
                return status || { enabled: true, franchiseId: fid, pricingNotes: null };
            }
        }
        return accessMap.get(franchiseIds[0]);
    }
    // BRANCH_ADMIN, ACADEMIC_ADMIN, STAFF
    if (user.instituteId) {
        const inst = await prisma_js_1.prisma.institute.findUnique({
            where: { id: user.instituteId },
            select: { franchiseId: true },
        });
        if (inst?.franchiseId) {
            return getFranchiseSoftwareAccess(inst.franchiseId);
        }
    }
    const memberships = await prisma_js_1.prisma.instituteMembership.findMany({
        where: { userId, isActive: true },
        select: { institute: { select: { franchiseId: true } } },
    });
    const franchiseIds = Array.from(new Set(memberships
        .map((m) => m.institute?.franchiseId)
        .filter((fid) => Boolean(fid))));
    if (franchiseIds.length === 0) {
        return { enabled: true, franchiseId: null, pricingNotes: null };
    }
    const accessMap = await getFranchiseSoftwareAccessMap(franchiseIds);
    for (const fid of franchiseIds) {
        const status = accessMap.get(fid);
        if (!status || status.enabled) {
            return status || { enabled: true, franchiseId: fid, pricingNotes: null };
        }
    }
    return accessMap.get(franchiseIds[0]);
}
