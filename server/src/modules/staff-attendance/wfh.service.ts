import {
  StaffWFHAuthorization,
  WFHAuthorizationScope,
  WFHAuthorizationStatus,
  WFHReasonCategory,
  StaffAttendanceMode,
} from '@prisma/client';
import { prisma } from '../../prisma.js';

export {
  StaffWFHAuthorization,
  WFHAuthorizationScope,
  WFHAuthorizationStatus,
  WFHReasonCategory,
  StaffAttendanceMode,
};

export interface WFHCheckResult {
  isAuthorized: boolean;
  authorization: StaffWFHAuthorization | null;
  scope?: WFHAuthorizationScope;
  reason?: string;
}

/**
 * Checks if a specific staff member is authorized for Work From Home on a given date.
 * Validates active APPROVED authorizations covering the date:
 * 1. Scope INSTITUTE_WIDE for the institute
 * 2. Scope INDIVIDUAL for this staff profile
 * 3. Scope GROUP where the staff is assigned to the authorization
 */
export async function isStaffWfhAuthorized(params: {
  instituteId: string;
  staffId: string;
  date: Date;
}): Promise<WFHCheckResult> {
  const { instituteId, staffId, date } = params;

  // Search for an active APPROVED authorization covering the date
  const auth = await prisma.staffWFHAuthorization.findFirst({
    where: {
      instituteId,
      status: 'APPROVED',
      startDate: { lte: date },
      endDate: { gte: date },
      OR: [
        { scope: 'INSTITUTE_WIDE' },
        { scope: 'INDIVIDUAL', staffId },
        {
          scope: 'GROUP',
          groupAssignments: {
            some: { staffId },
          },
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!auth) {
    return {
      isAuthorized: false,
      authorization: null,
      reason: 'No active approved WFH authorization found for this date.',
    };
  }

  return {
    isAuthorized: true,
    authorization: auth,
    scope: auth.scope,
    reason: auth.reason,
  };
}

/**
 * Create a new WFH authorization (Admin direct authorization or Staff request).
 */
export async function createWfhAuthorization(params: {
  instituteId: string;
  scope: WFHAuthorizationScope;
  staffId?: string | null;
  staffIds?: string[]; // For GROUP scope
  startDate: Date;
  endDate: Date;
  reasonCategory: WFHReasonCategory;
  reason: string;
  notes?: string | null;
  status?: WFHAuthorizationStatus;
  requestedById?: string | null;
  approvedById?: string | null;
  actingUserId: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const {
    instituteId,
    scope,
    staffId,
    staffIds,
    startDate,
    endDate,
    reasonCategory,
    reason,
    notes,
    status = 'APPROVED',
    requestedById,
    approvedById,
    actingUserId,
    ipAddress,
    userAgent,
  } = params;

  if (startDate > endDate) {
    throw new Error('Start date cannot be after end date');
  }

  if (scope === 'INDIVIDUAL' && !staffId) {
    throw new Error('Staff selection is required for individual authorization');
  }

  if (scope === 'GROUP' && (!staffIds || staffIds.length === 0)) {
    throw new Error('At least one staff member must be selected for group authorization');
  }

  return await prisma.$transaction(async (tx) => {
    const auth = await tx.staffWFHAuthorization.create({
      data: {
        instituteId,
        scope,
        staffId: scope === 'INDIVIDUAL' ? staffId : null,
        startDate,
        endDate,
        reasonCategory,
        reason,
        notes: notes || null,
        status,
        requestedById: requestedById || null,
        approvedById: status === 'APPROVED' ? approvedById || actingUserId : null,
        approvedAt: status === 'APPROVED' ? new Date() : null,
      },
    });

    // If GROUP scope, create assignments
    if (scope === 'GROUP' && staffIds && staffIds.length > 0) {
      const distinctStaffIds = Array.from(new Set(staffIds));
      await tx.wFHAuthorizationStaff.createMany({
        data: distinctStaffIds.map((sid) => ({
          authorizationId: auth.id,
          staffId: sid,
        })),
        skipDuplicates: true,
      });
    }

    // Audit log
    await tx.auditLog.create({
      data: {
        instituteId,
        userId: actingUserId,
        action: status === 'APPROVED' ? 'CREATE_WFH_AUTHORIZATION' : 'SUBMIT_WFH_REQUEST',
        entityType: 'StaffWFHAuthorization',
        entityId: auth.id,
        newValues: {
          scope,
          staffId,
          staffIdsCount: staffIds?.length || 0,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          reasonCategory,
          reason,
          status,
        },
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return auth;
  });
}

/**
 * Review (Approve or Reject) a pending WFH request.
 * Enforces: Staff cannot approve their own requests.
 */
export async function reviewWfhRequest(params: {
  authorizationId: string;
  instituteId: string;
  adminUserId: string;
  action: 'APPROVE' | 'REJECT';
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const { authorizationId, instituteId, adminUserId, action, reason, ipAddress, userAgent } = params;

  const auth = await prisma.staffWFHAuthorization.findFirst({
    where: { id: authorizationId, instituteId },
    include: { staff: true },
  });

  if (!auth) {
    throw new Error('WFH authorization record not found or does not belong to your institute');
  }

  if (auth.status !== 'PENDING') {
    throw new Error(`Cannot ${action.toLowerCase()} request. Current status is already ${auth.status}`);
  }

  // Business rule: Staff must not approve their own requests
  if (action === 'APPROVE') {
    if (auth.requestedById === adminUserId) {
      throw new Error('Self-approval is strictly prohibited. You cannot approve your own WFH request.');
    }
    if (auth.staff && auth.staff.userId === adminUserId) {
      throw new Error('Self-approval is strictly prohibited. You cannot approve your own WFH request.');
    }
  }

  const serverNow = new Date();

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.staffWFHAuthorization.update({
      where: { id: auth.id },
      data: {
        status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approvedById: action === 'APPROVE' ? adminUserId : null,
        approvedAt: action === 'APPROVE' ? serverNow : null,
        rejectedById: action === 'REJECT' ? adminUserId : null,
        rejectedAt: action === 'REJECT' ? serverNow : null,
        rejectionReason: action === 'REJECT' ? reason || 'Request rejected by academic administrator' : null,
      },
    });

    await tx.auditLog.create({
      data: {
        instituteId,
        userId: adminUserId,
        action: action === 'APPROVE' ? 'APPROVE_WFH_REQUEST' : 'REJECT_WFH_REQUEST',
        entityType: 'StaffWFHAuthorization',
        entityId: auth.id,
        oldValues: { status: auth.status },
        newValues: {
          status: updated.status,
          rejectionReason: updated.rejectionReason,
        },
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return updated;
  });
}

/**
 * Revoke an active WFH authorization.
 * Requires a mandatory revocation reason.
 * Preserves already-recorded attendance sessions.
 */
export async function revokeWfhAuthorization(params: {
  authorizationId: string;
  instituteId: string;
  adminUserId: string;
  revocationReason: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const { authorizationId, instituteId, adminUserId, revocationReason, ipAddress, userAgent } = params;

  if (!revocationReason || revocationReason.trim().length === 0) {
    throw new Error('A mandatory revocation reason is required to revoke WFH authorization');
  }

  const auth = await prisma.staffWFHAuthorization.findFirst({
    where: { id: authorizationId, instituteId },
  });

  if (!auth) {
    throw new Error('WFH authorization record not found or does not belong to your institute');
  }

  if (auth.status === 'REVOKED') {
    throw new Error('This authorization is already revoked');
  }

  const serverNow = new Date();

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.staffWFHAuthorization.update({
      where: { id: auth.id },
      data: {
        status: 'REVOKED',
        revokedById: adminUserId,
        revokedAt: serverNow,
        revocationReason: revocationReason.trim(),
      },
    });

    await tx.auditLog.create({
      data: {
        instituteId,
        userId: adminUserId,
        action: 'REVOKE_WFH_AUTHORIZATION',
        entityType: 'StaffWFHAuthorization',
        entityId: auth.id,
        oldValues: { status: auth.status },
        newValues: {
          status: 'REVOKED',
          revocationReason: revocationReason.trim(),
        },
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return updated;
  });
}

/**
 * Retrieve real database metrics for WFH dashboard summary.
 */
export async function getWfhMetrics(instituteId: string, targetDate: Date) {
  // 1. All active staff in institute
  const activeStaff = await prisma.staffProfile.findMany({
    where: {
      instituteId,
      user: { isActive: true },
    },
    select: { id: true },
  });

  const activeStaffIds = new Set(activeStaff.map((s) => s.id));

  // 2. Authorizations valid today
  const activeAuthorizations = await prisma.staffWFHAuthorization.findMany({
    where: {
      instituteId,
      status: 'APPROVED',
      startDate: { lte: targetDate },
      endDate: { gte: targetDate },
    },
    include: {
      groupAssignments: { select: { staffId: true } },
    },
  });

  // Calculate distinct staff authorized today
  const authorizedStaffIds = new Set<string>();
  for (const auth of activeAuthorizations) {
    if (auth.scope === 'INSTITUTE_WIDE') {
      activeStaffIds.forEach((id) => authorizedStaffIds.add(id));
      break;
    } else if (auth.scope === 'INDIVIDUAL' && auth.staffId && activeStaffIds.has(auth.staffId)) {
      authorizedStaffIds.add(auth.staffId);
    } else if (auth.scope === 'GROUP') {
      auth.groupAssignments.forEach((ga) => {
        if (activeStaffIds.has(ga.staffId)) {
          authorizedStaffIds.add(ga.staffId);
        }
      });
    }
  }

  // 3. WFH sessions for targetDate
  const wfhSessions = await prisma.staffAttendanceSession.findMany({
    where: {
      instituteId,
      attendanceDate: targetDate,
      attendanceMode: 'WFH',
    },
    select: {
      id: true,
      checkInTime: true,
      checkOutTime: true,
      status: true,
    },
  });

  const checkedInWfh = wfhSessions.filter((s) => s.checkInTime != null).length;
  const checkedOutWfh = wfhSessions.filter((s) => s.checkOutTime != null).length;

  // 4. Request counts
  const pendingRequests = await prisma.staffWFHAuthorization.count({
    where: {
      instituteId,
      status: 'PENDING',
    },
  });

  const rejectedRequests = await prisma.staffWFHAuthorization.count({
    where: {
      instituteId,
      status: 'REJECTED',
    },
  });

  const revokedAuthorizations = await prisma.staffWFHAuthorization.count({
    where: {
      instituteId,
      status: 'REVOKED',
    },
  });

  return {
    authorizedToday: authorizedStaffIds.size,
    checkedInWfh,
    checkedOutWfh,
    pendingRequests,
    rejectedRequests,
    revokedAuthorizations,
  };
}

/**
 * Get online classes for a staff member for today.
 */
export async function getStaffTodayOnlineClasses(params: {
  staffProfileId: string;
  instituteId: string;
  targetDate: Date;
}) {
  const { staffProfileId, instituteId, targetDate } = params;

  // Find all BatchSubjects assigned to this staff
  const assignedSubjects = await prisma.batchSubject.findMany({
    where: {
      staffProfileId,
      isActive: true,
      batch: {
        instituteId,
        isActive: true,
      },
    },
    include: {
      batch: { select: { id: true, name: true } },
      subject: { select: { id: true, name: true, code: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Query any delivery status logs for today
  const logs = await prisma.staffOnlineClassLog.findMany({
    where: {
      staffId: staffProfileId,
      deliveryDate: targetDate,
    },
  });

  const logMap = new Map<string, (typeof logs)[0]>();
  logs.forEach((l) => logMap.set(l.batchSubjectId, l));

  return assignedSubjects.map((bs) => {
    const log = logMap.get(bs.id);
    return {
      batchSubjectId: bs.id,
      batchId: bs.batch.id,
      batchName: bs.batch.name,
      subjectId: bs.subject.id,
      subjectName: bs.subject.name,
      subjectCode: bs.subject.code,
      schedule: bs.schedule || 'Scheduled Today',
      meetingLink: log?.meetingLink || bs.meetingLink || 'https://meet.google.com/new',
      status: log?.status || 'SCHEDULED',
      notes: log?.notes || null,
      updatedAt: log?.updatedAt || null,
    };
  });
}

/**
 * Update class delivery status for today.
 */
export async function updateOnlineClassStatus(params: {
  instituteId: string;
  staffProfileId: string;
  batchSubjectId: string;
  targetDate: Date;
  status: string;
  notes?: string;
  meetingLink?: string;
  actingUserId: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const {
    instituteId,
    staffProfileId,
    batchSubjectId,
    targetDate,
    status,
    notes,
    meetingLink,
    actingUserId,
    ipAddress,
    userAgent,
  } = params;

  // Verify batchSubject ownership
  const bs = await prisma.batchSubject.findFirst({
    where: {
      id: batchSubjectId,
      staffProfileId,
      batch: { instituteId },
    },
    include: { batch: true, subject: true },
  });

  if (!bs) {
    throw new Error('Assigned online class not found or not assigned to you');
  }

  return await prisma.$transaction(async (tx) => {
    const classLog = await tx.staffOnlineClassLog.upsert({
      where: {
        staffId_batchSubjectId_deliveryDate: {
          staffId: staffProfileId,
          batchSubjectId,
          deliveryDate: targetDate,
        },
      },
      create: {
        instituteId,
        staffId: staffProfileId,
        batchSubjectId,
        deliveryDate: targetDate,
        status,
        notes: notes || null,
        meetingLink: meetingLink || bs.meetingLink || null,
      },
      update: {
        status,
        notes: notes || null,
        meetingLink: meetingLink || bs.meetingLink || null,
      },
    });

    await tx.auditLog.create({
      data: {
        instituteId,
        userId: actingUserId,
        action: 'UPDATE_ONLINE_CLASS_STATUS',
        entityType: 'StaffOnlineClassLog',
        entityId: classLog.id,
        newValues: {
          batchName: bs.batch.name,
          subjectName: bs.subject.name,
          status,
          notes,
        },
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      },
    });

    return classLog;
  });
}
