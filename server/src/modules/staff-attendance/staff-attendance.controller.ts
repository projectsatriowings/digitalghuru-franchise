// In-memory cache for institute timezone & hours to eliminate 250ms cross-continent round trips
interface CachedInstituteSettings {
  timezone: string;
  workEndTime: string | null;
  expiry: number;
}
const instituteSettingsCache = new Map<string, CachedInstituteSettings>();

async function getCachedInstituteSettings(instituteId: string): Promise<CachedInstituteSettings> {
  const cached = instituteSettingsCache.get(instituteId);
  if (cached && cached.expiry > Date.now()) {
    return cached;
  }
  const inst = await prisma.institute.findUnique({
    where: { id: instituteId },
    select: { timezone: true, workEndTime: true },
  });
  const val: CachedInstituteSettings = {
    timezone: inst?.timezone || 'Asia/Kolkata',
    workEndTime: inst?.workEndTime || null,
    expiry: Date.now() + 300000,
  };
  instituteSettingsCache.set(instituteId, val);
  return val;
}

import { Response } from 'express';
import { StaffAttendanceStatus, StaffAttendanceEventType } from '@prisma/client';
import { prisma } from '../../prisma.js';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth.js';
import {
  validateStaffLocation,
  isCheckInLate,
  calculateHaversineDistance,
  isValidCoordinate,
} from './geofence.service.js';
import {
  isStaffWfhAuthorized,
  createWfhAuthorization,
  reviewWfhRequest,
  revokeWfhAuthorization,
  getWfhMetrics,
  getStaffTodayOnlineClasses,
  updateOnlineClassStatus,
  StaffAttendanceMode,
  WFHAuthorizationScope,
  WFHAuthorizationStatus,
  WFHReasonCategory,
} from './wfh.service.js';



// Helper to get local date in Institute timezone as a UTC midnight Date
export function getLocalDateForInstitute(date = new Date(), timezone = 'Asia/Kolkata'): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = formatter.format(date); // "YYYY-MM-DD"
  return new Date(`${dateStr}T00:00:00.000Z`);
}

// Validation schemas
const updateConfigSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  geofenceRadius: z.number().min(10).max(5000).default(200),
  gpsAccuracyThreshold: z.number().min(5).max(500).default(50),
  workStartTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Format must be HH:mm (24h)'),
  workEndTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Format must be HH:mm (24h)'),
  lateGraceMinutes: z.number().min(0).max(120).default(15),
  requireCheckoutGeofence: z.boolean().default(true),
  workingDays: z.string().default('MON,TUE,WED,THU,FRI,SAT'),
  timezone: z.string().default('Asia/Kolkata'),
  address: z.string().optional(),
});

const checkInSchema = z.object({
  mode: z.enum(['ON_SITE', 'WFH']).default('ON_SITE'),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  accuracy: z.number().optional().nullable(),
  deviceInfo: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

const createWfhAuthSchema = z.object({
  scope: z.enum(['INSTITUTE_WIDE', 'INDIVIDUAL', 'GROUP']),
  staffId: z.string().uuid().optional().nullable(),
  staffIds: z.array(z.string().uuid()).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  reasonCategory: z.nativeEnum(WFHReasonCategory),
  reason: z.string().trim().min(3, 'Reason of at least 3 characters is required'),
  notes: z.string().optional().nullable(),
});

const submitWfhRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  reasonCategory: z.nativeEnum(WFHReasonCategory).default('INDIVIDUAL_REQUEST'),
  reason: z.string().trim().min(3, 'Reason of at least 3 characters is required'),
  notes: z.string().optional().nullable(),
});

const rejectWfhRequestSchema = z.object({
  reason: z.string().optional(),
});

const revokeWfhAuthSchema = z.object({
  revocationReason: z.string().trim().min(3, 'Mandatory revocation reason is required'),
});

const updateClassStatusSchema = z.object({
  status: z.enum(['SCHEDULED', 'CONDUCTED', 'CANCELLED', 'RESCHEDULED']),
  notes: z.string().optional().nullable(),
  meetingLink: z.string().url().optional().nullable(),
});

const checkOutSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracy: z.number().optional().nullable(),
  deviceInfo: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

const manualCorrectionSchema = z.object({
  sessionId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  checkInTime: z.string().datetime().optional().nullable(),
  checkOutTime: z.string().datetime().optional().nullable(),
  status: z.nativeEnum(StaffAttendanceStatus),
  reason: z.string().trim().min(3, 'Mandatory reason of at least 3 characters is required'),
});

// ==========================================
// 1. GET & UPDATE INSTITUTE CONFIG
// ==========================================

export async function getInstituteAttendanceConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      res.status(400).json({ success: false, message: 'Institute context required' });
      return;
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        postalCode: true,
        latitude: true,
        longitude: true,
        geofenceRadius: true,
        locationVerified: true,
        workingDays: true,
        workStartTime: true,
        workEndTime: true,
        lateGraceMinutes: true,
        gpsAccuracyThreshold: true,
        requireCheckoutGeofence: true,
        allowStaffWfhRequests: true,
        timezone: true,
      },
    });

    if (!institute) {
      res.status(404).json({ success: false, message: 'Institute not found' });
      return;
    }

    res.json({
      success: true,
      data: institute,
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error getting config:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to retrieve attendance config' });
  }
}

export async function updateInstituteAttendanceConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const userId = req.user?.userId;
    if (!instituteId || !userId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    const parsed = updateConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.format(),
      });
      return;
    }

    const data = parsed.data;

    // Fetch existing institute to record previous values in audit log
    const prev = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: { latitude: true, longitude: true, geofenceRadius: true, address: true },
    });

    const updated = await prisma.institute.update({
      where: { id: instituteId },
      data: {
        latitude: data.latitude,
        longitude: data.longitude,
        geofenceRadius: data.geofenceRadius,
        locationVerified: true,
        workingDays: data.workingDays,
        workStartTime: data.workStartTime,
        workEndTime: data.workEndTime,
        lateGraceMinutes: data.lateGraceMinutes,
        gpsAccuracyThreshold: data.gpsAccuracyThreshold,
        requireCheckoutGeofence: data.requireCheckoutGeofence,
        timezone: data.timezone,
        ...(data.address ? { address: data.address } : {}),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        instituteId,
        userId,
        action: 'UPDATE_STAFF_GEOFENCE_CONFIG',
        entityType: 'Institute',
        entityId: instituteId,
        oldValues: { lat: prev?.latitude, lng: prev?.longitude, radius: prev?.geofenceRadius },
        newValues: { lat: data.latitude, lng: data.longitude, radius: data.geofenceRadius, workHours: `${data.workStartTime} - ${data.workEndTime}` },
      },
    });

    res.json({
      success: true,
      message: 'Institute location and geofence configuration updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error updating config:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update attendance config' });
  }
}

// ==========================================
// 2. STAFF TODAY STATUS & CHECK-IN / CHECK-OUT
// ==========================================

export async function getStaffTodayStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const userId = req.user?.userId;
    if (!instituteId || !userId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    // Find staff profile
    const staff = await prisma.staffProfile.findFirst({
      where: { userId, instituteId },
      include: { user: { select: { fullName: true, email: true, phone: true } } },
    });

    if (!staff) {
      res.status(404).json({ success: false, message: 'Staff profile not found for current user' });
      return;
    }

    // Get institute config
    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: {
        name: true,
        latitude: true,
        longitude: true,
        geofenceRadius: true,
        gpsAccuracyThreshold: true,
        workStartTime: true,
        workEndTime: true,
        lateGraceMinutes: true,
        requireCheckoutGeofence: true,
        timezone: true,
      },
    });

    const timezone = institute?.timezone || 'Asia/Kolkata';
    const today = getLocalDateForInstitute(new Date(), timezone);

    // Find session for today
    const session = await prisma.staffAttendanceSession.findUnique({
      where: {
        instituteId_staffId_attendanceDate: {
          instituteId,
          staffId: staff.id,
          attendanceDate: today,
        },
      },
      include: {
        events: {
          orderBy: { serverTimestamp: 'desc' },
          take: 5,
        },
      },
    });

    res.json({
      success: true,
      data: {
        staff: {
          id: staff.id,
          name: staff.user.fullName,
          employeeCode: staff.employeeCode,
          designation: staff.designation,
          department: staff.department,
        },
        institute: {
          name: institute?.name,
          latitude: institute?.latitude,
          longitude: institute?.longitude,
          geofenceRadius: institute?.geofenceRadius ?? 200,
          gpsAccuracyThreshold: institute?.gpsAccuracyThreshold ?? 50,
          workStartTime: institute?.workStartTime ?? '09:00',
          workEndTime: institute?.workEndTime ?? '18:00',
          requireCheckoutGeofence: institute?.requireCheckoutGeofence ?? true,
          timezone,
        },
        todayDateStr: today.toISOString().split('T')[0],
        session: session || null,
        status: session ? session.status : 'NOT_CHECKED_IN',
      },
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error getting today status:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get today attendance status' });
  }
}

export async function staffCheckIn(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const userId = req.user?.userId;
    if (!instituteId || !userId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    const parsed = checkInSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid payload or format', errors: parsed.error.format() });
      return;
    }

    const { mode = 'ON_SITE', latitude, longitude, accuracy, deviceInfo, idempotencyKey } = parsed.data;

    // Check staff profile
    const staff = await prisma.staffProfile.findFirst({
      where: { userId, instituteId },
      include: { user: { select: { fullName: true, isActive: true } } },
    });

    if (!staff) {
      res.status(404).json({ success: false, message: 'Staff profile not found' });
      return;
    }

    if (!staff.user.isActive) {
      res.status(403).json({ success: false, message: 'Your staff account is currently inactive' });
      return;
    }

    // Fetch Institute configuration
    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
    });

    if (!institute) {
      res.status(404).json({ success: false, message: 'Institute record not found' });
      return;
    }

    const serverNow = new Date();
    const today = getLocalDateForInstitute(serverNow, institute.timezone);

    let validationOutcome = 'VERIFIED_INSIDE_GEOFENCE';
    let distanceMetres: number | null = null;
    let isWithinGeofence = true;
    let wfhAuthorizationId: string | null = null;

    if (mode === 'WFH') {
      // Secure Backend Verification: Verify staff member is actively authorized for WFH today
      const wfhCheck = await isStaffWfhAuthorized({
        instituteId,
        staffId: staff.id,
        date: today,
      });

      if (!wfhCheck.isAuthorized || !wfhCheck.authorization) {
        res.status(403).json({
          success: false,
          code: 'NO_ACTIVE_WFH_AUTHORIZATION',
          message:
            'Work From Home is not approved for today. Please check in at the institute or submit a WFH request if your institute permits requests.',
          reason: wfhCheck.reason,
        });
        return;
      }

      wfhAuthorizationId = wfhCheck.authorization.id;
      validationOutcome = 'WFH_AUTHORIZED_REMOTE';
      isWithinGeofence = false; // Remote attendance
    } else {
      // ON_SITE Mode: Strict Geofence and GPS Accuracy Validation
      if (latitude == null || longitude == null) {
        res.status(400).json({
          success: false,
          message: 'GPS coordinates (latitude and longitude) are required for on-site attendance.',
          code: 'COORDINATES_MISSING',
        });
        return;
      }

      const validation = validateStaffLocation({
        staffCoords: { latitude, longitude, accuracy },
        instituteCoords: { latitude: institute.latitude, longitude: institute.longitude },
        geofenceRadius: institute.geofenceRadius,
        gpsAccuracyThreshold: institute.gpsAccuracyThreshold,
      });

      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          message: validation.reason,
          code: validation.code,
          distanceMetres: validation.distanceMetres,
          permittedRadius: institute.geofenceRadius,
          reportedAccuracy: accuracy,
        });
        return;
      }

      distanceMetres = validation.distanceMetres;
      validationOutcome = 'VERIFIED_INSIDE_GEOFENCE';
      isWithinGeofence = true;
    }

    // Check if session already exists
    const existingSession = await prisma.staffAttendanceSession.findUnique({
      where: {
        instituteId_staffId_attendanceDate: {
          instituteId,
          staffId: staff.id,
          attendanceDate: today,
        },
      },
    });

    if (existingSession && existingSession.checkInTime) {
      res.status(409).json({
        success: false,
        message: 'You have already checked in for today',
        session: existingSession,
      });
      return;
    }

    // Determine lateness
    const isLate = isCheckInLate({
      checkInTime: serverNow,
      workStartTimeStr: institute.workStartTime || '09:00',
      lateGraceMinutes: institute.lateGraceMinutes ?? 15,
      timezone: institute.timezone || 'Asia/Kolkata',
    });

    const status: StaffAttendanceStatus = isLate ? 'LATE' : 'CHECKED_IN';

    // Execute atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.staffAttendanceSession.upsert({
        where: {
          instituteId_staffId_attendanceDate: {
            instituteId,
            staffId: staff.id,
            attendanceDate: today,
          },
        },
        create: {
          instituteId,
          staffId: staff.id,
          attendanceDate: today,
          status,
          checkInTime: serverNow,
          isLate,
          attendanceMode: mode,
          wfhAuthorizationId,
        },
        update: {
          status,
          checkInTime: serverNow,
          isLate,
          attendanceMode: mode,
          wfhAuthorizationId,
        },
      });

      const event = await tx.staffAttendanceEvent.create({
        data: {
          sessionId: session.id,
          instituteId,
          staffId: staff.id,
          eventType: 'CHECK_IN',
          serverTimestamp: serverNow,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          accuracy: accuracy ?? null,
          distanceFromCenter: distanceMetres,
          isWithinGeofence,
          validationOutcome,
          deviceInfo,
          idempotencyKey: idempotencyKey || null,
          attendanceMode: mode,
          wfhAuthorizationId,
        },
      });

      return { session, event };
    });

    const successMsg =
      mode === 'WFH'
        ? isLate
          ? 'Checked in successfully via Work From Home (Recorded as Late arrival).'
          : 'Checked in successfully via Work From Home!'
        : isLate
        ? `Checked in successfully (Recorded as Late arrival). Distance: ${Math.round(distanceMetres ?? 0)}m`
        : `Checked in successfully! Distance: ${Math.round(distanceMetres ?? 0)}m`;

    res.json({
      success: true,
      message: successMsg,
      data: {
        session: result.session,
        checkInTime: serverNow.toISOString(),
        isLate,
        mode,
        distanceMetres,
      },
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error during check-in:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to complete check-in' });
  }
}

export async function staffCheckOut(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const userId = req.user?.userId;
    if (!instituteId || !userId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    const parsed = checkOutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid payload', errors: parsed.error.format() });
      return;
    }

    const { latitude, longitude, accuracy, deviceInfo, idempotencyKey } = parsed.data;

    const staff = await prisma.staffProfile.findFirst({
      where: { userId, instituteId },
    });

    if (!staff) {
      res.status(404).json({ success: false, message: 'Staff profile not found' });
      return;
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
    });

    if (!institute) {
      res.status(404).json({ success: false, message: 'Institute record not found' });
      return;
    }

    const serverNow = new Date();
    const today = getLocalDateForInstitute(serverNow, institute.timezone);

    // Find active session
    const session = await prisma.staffAttendanceSession.findUnique({
      where: {
        instituteId_staffId_attendanceDate: {
          instituteId,
          staffId: staff.id,
          attendanceDate: today,
        },
      },
    });

    if (!session || !session.checkInTime) {
      res.status(400).json({
        success: false,
        message: 'No active check-in found for today. You cannot check out without checking in first.',
      });
      return;
    }

    if (session.checkOutTime) {
      res.status(409).json({
        success: false,
        message: 'You have already checked out for today.',
        session,
      });
      return;
    }

    // Check if session is WFH mode (WFH does not require on-site geofencing)
    const isWfhSession = session.attendanceMode === 'WFH';

    let distanceMetres: number | null = null;
    let isWithin = true;

    if (!isWfhSession && institute.requireCheckoutGeofence) {
      if (latitude == null || longitude == null) {
        res.status(400).json({
          success: false,
          message: 'Institute checkout policy requires GPS verification, but no coordinates were provided.',
        });
        return;
      }

      const validation = validateStaffLocation({
        staffCoords: { latitude, longitude, accuracy },
        instituteCoords: { latitude: institute.latitude, longitude: institute.longitude },
        geofenceRadius: institute.geofenceRadius,
        gpsAccuracyThreshold: institute.gpsAccuracyThreshold,
      });

      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          message: validation.reason,
          code: validation.code,
          distanceMetres: validation.distanceMetres,
        });
        return;
      }

      distanceMetres = validation.distanceMetres;
      isWithin = validation.isWithinRadius;
    } else if (!isWfhSession && latitude != null && longitude != null && institute.latitude != null && institute.longitude != null) {
      distanceMetres = calculateHaversineDistance(institute.latitude, institute.longitude, latitude, longitude);
      isWithin = distanceMetres <= institute.geofenceRadius;
    }

    // Calculate duration in minutes from server timestamps
    const durationMinutes = Math.max(0, Math.round((serverNow.getTime() - session.checkInTime.getTime()) / 60000));

    // Update session and record event in atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedSession = await tx.staffAttendanceSession.update({
        where: { id: session.id },
        data: {
          checkOutTime: serverNow,
          workDurationMinutes: durationMinutes,
          status: 'CHECKED_OUT',
        },
      });

      const event = await tx.staffAttendanceEvent.create({
        data: {
          sessionId: session.id,
          instituteId,
          staffId: staff.id,
          eventType: 'CHECK_OUT',
          serverTimestamp: serverNow,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          accuracy: accuracy ?? null,
          distanceFromCenter: distanceMetres,
          isWithinGeofence: isWfhSession ? false : isWithin,
          validationOutcome: isWfhSession ? 'WFH_CHECKOUT' : isWithin ? 'VERIFIED_INSIDE_GEOFENCE' : 'CHECKOUT_OUTSIDE_GEOFENCE',
          deviceInfo,
          idempotencyKey: idempotencyKey || null,
          attendanceMode: session.attendanceMode,
          wfhAuthorizationId: session.wfhAuthorizationId,
        },
      });

      return { session: updatedSession, event };
    });

    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const formattedDuration = `${hours}h ${mins}m`;

    res.json({
      success: true,
      message: `Checked out successfully! Work duration: ${formattedDuration}.`,
      data: {
        session: result.session,
        status: result.session.status,
        checkOutTime: serverNow.toISOString(),
        durationMinutes,
        formattedDuration,
      },
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error during check-out:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to complete check-out' });
  }
}

export async function getStaffPersonalHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const userId = req.user?.userId;
    if (!instituteId || !userId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    const staff = await prisma.staffProfile.findFirst({
      where: { userId, instituteId },
    });

    if (!staff) {
      res.status(404).json({ success: false, message: 'Staff profile not found' });
      return;
    }

    const { startDate, endDate, limit = '30' } = req.query;

    const where: any = {
      instituteId,
      staffId: staff.id,
    };

    if (startDate && typeof startDate === 'string') {
      where.attendanceDate = { ...where.attendanceDate, gte: new Date(startDate) };
    }
    if (endDate && typeof endDate === 'string') {
      where.attendanceDate = { ...where.attendanceDate, lte: new Date(endDate) };
    }

    const sessions = await prisma.staffAttendanceSession.findMany({
      where,
      orderBy: { attendanceDate: 'desc' },
      take: Math.min(parseInt(limit as string, 10) || 30, 100),
      include: {
        events: {
          orderBy: { serverTimestamp: 'asc' },
        },
      },
    });

    // Calculate aggregated metrics
    const totalSessions = sessions.length;
    const daysPresent = sessions.filter((s) => ['CHECKED_IN', 'CHECKED_OUT', 'LATE', 'MANUALLY_CORRECTED'].includes(s.status)).length;
    const daysLate = sessions.filter((s) => s.isLate).length;
    const totalMinutes = sessions.reduce((acc, s) => acc + (s.workDurationMinutes || 0), 0);

    res.json({
      success: true,
      data: {
        sessions,
        metrics: {
          totalSessions,
          daysPresent,
          daysLate,
          totalWorkHours: Math.round((totalMinutes / 60) * 10) / 10,
        },
      },
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error getting personal history:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load attendance history' });
  }
}

// ==========================================
// 3. ACADEMIC ADMIN DASHBOARD & REGISTER
// ==========================================

export async function getAdminDashboardSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      res.status(400).json({ success: false, message: 'Institute context required' });
      return;
    }

    const instSettings = await getCachedInstituteSettings(instituteId);
    const today = getLocalDateForInstitute(new Date(), instSettings.timezone);

    // Concurrently fetch active staff count and today's sessions
    const [totalActiveStaff, todaySessions] = await Promise.all([
      prisma.staffProfile.count({
        where: {
          instituteId,
          user: { isActive: true },
        },
      }),
      prisma.staffAttendanceSession.findMany({
        where: {
          instituteId,
          attendanceDate: today,
        },
        select: {
          id: true,
          status: true,
          isLate: true,
          checkOutTime: true,
        },
      }),
    ]);

    const presentToday = todaySessions.filter((s) =>
      ['CHECKED_IN', 'CHECKED_OUT', 'LATE', 'MANUALLY_CORRECTED'].includes(s.status)
    ).length;

    const lateArrivals = todaySessions.filter((s) => s.isLate).length;

    const checkedOutCount = todaySessions.filter((s) => s.status === 'CHECKED_OUT').length;

    // Missing checkouts: checked in but not checked out, when workEndTime has passed
    const missingCheckouts = todaySessions.filter((s) => s.status === 'CHECKED_IN' && !s.checkOutTime).length;

    const onLeave = todaySessions.filter((s) => s.status === 'ON_LEAVE').length;

    const notCheckedIn = Math.max(0, totalActiveStaff - presentToday - onLeave);

    res.json({
      success: true,
      data: {
        dateStr: today.toISOString().split('T')[0],
        totalActiveStaff,
        presentToday,
        lateArrivals,
        checkedOutCount,
        missingCheckouts,
        notCheckedIn,
        onLeave,
      },
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error getting admin summary:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get summary' });
  }
}

export async function getAdminDailyRegister(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      res.status(400).json({ success: false, message: 'Institute context required' });
      return;
    }

    const { date, search, status, department, mode } = req.query;

    const instSettings = await getCachedInstituteSettings(instituteId);

    const targetDate = date && typeof date === 'string'
      ? new Date(`${date}T00:00:00.000Z`)
      : getLocalDateForInstitute(new Date(), instSettings.timezone);

    // Fetch all active staff
    const staffWhere: any = {
      instituteId,
      user: { isActive: true },
    };

    if (department && typeof department === 'string') {
      staffWhere.department = department;
    }

    if (search && typeof search === 'string') {
      const q = search.trim();
      staffWhere.OR = [
        { employeeCode: { contains: q, mode: 'insensitive' } },
        { designation: { contains: q, mode: 'insensitive' } },
        { user: { fullName: { contains: q, mode: 'insensitive' } } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // Parallel fetch: Staff Profiles + Sessions in 1 concurrent round trip
    const [allStaff, sessions] = await Promise.all([
      prisma.staffProfile.findMany({
        where: staffWhere,
        select: {
          id: true,
          employeeCode: true,
          designation: true,
          department: true,
          workLocation: true,
          avatarUrl: true,
          user: { select: { fullName: true, email: true, phone: true } },
        },
        orderBy: { employeeCode: 'asc' },
      }),
      prisma.staffAttendanceSession.findMany({
        where: {
          instituteId,
          attendanceDate: targetDate,
        },
        select: {
          id: true,
          staffId: true,
          status: true,
          attendanceMode: true,
          checkInTime: true,
          checkOutTime: true,
          workDurationMinutes: true,
          isLate: true,
          isManuallyCorrected: true,
          correctionReason: true,
          wfhAuthorizationId: true,
          correctedBy: {
            select: { fullName: true, email: true },
          },
          events: {
            select: {
              eventType: true,
              serverTimestamp: true,
              distanceFromCenter: true,
              accuracy: true,
              isWithinGeofence: true,
              validationOutcome: true,
            },
            orderBy: { serverTimestamp: 'asc' },
          },
        },
      }),
    ]);

    const sessionMap = new Map(sessions.map((s) => [s.staffId, s]));

    // Combine staff with their session
    let register = allStaff.map((staff) => {
      const sess = sessionMap.get(staff.id);
      const derivedStatus = sess ? sess.status : 'NOT_CHECKED_IN';

      const checkInEvent = sess?.events.find((e) => e.eventType === 'CHECK_IN');
      const checkOutEvent = sess?.events.find((e) => e.eventType === 'CHECK_OUT');

      return {
        staffId: staff.id,
        fullName: staff.user.fullName,
        email: staff.user.email,
        phone: staff.user.phone,
        employeeCode: staff.employeeCode,
        designation: staff.designation,
        department: staff.department,
        status: derivedStatus,
        attendanceMode: sess?.attendanceMode || 'ON_SITE',
        wfhAuthorizationId: sess?.wfhAuthorizationId || null,
        sessionId: sess?.id || null,
        checkInTime: sess?.checkInTime ? sess.checkInTime.toISOString() : null,
        checkOutTime: sess?.checkOutTime ? sess.checkOutTime.toISOString() : null,
        workDurationMinutes: sess?.workDurationMinutes ?? 0,
        isLate: sess?.isLate ?? false,
        isManuallyCorrected: sess?.isManuallyCorrected ?? false,
        correctionReason: sess?.correctionReason || null,
        correctedBy: sess?.correctedBy?.fullName || null,
        checkInDistance: checkInEvent?.distanceFromCenter ?? null,
        checkInAccuracy: checkInEvent?.accuracy ?? null,
        checkOutDistance: checkOutEvent?.distanceFromCenter ?? null,
      };
    });

    if (status && typeof status === 'string' && status !== 'ALL') {
      register = register.filter((r) => r.status === status);
    }

    if (mode && typeof mode === 'string' && mode !== 'ALL') {
      if (mode === 'WFH') {
        register = register.filter((r) => r.attendanceMode === 'WFH' && r.sessionId != null);
      } else if (mode === 'ON_SITE') {
        register = register.filter((r) => r.attendanceMode === 'ON_SITE' || r.sessionId == null);
      }
    }

    res.json({
      success: true,
      data: {
        dateStr: targetDate.toISOString().split('T')[0],
        totalCount: register.length,
        register,
      },
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error getting daily register:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get register' });
  }
}

export async function getAdminSessionDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const { id } = req.params;
    if (!instituteId) {
      res.status(400).json({ success: false, message: 'Institute context required' });
      return;
    }

    const session = await prisma.staffAttendanceSession.findFirst({
      where: { id, instituteId },
      include: {
        staff: {
          include: {
            user: { select: { fullName: true, email: true, phone: true } },
          },
        },
        events: {
          orderBy: { serverTimestamp: 'asc' },
        },
        correctedBy: {
          select: { fullName: true, email: true },
        },
      },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Session record not found' });
      return;
    }

    res.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error getting session details:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to load details' });
  }
}

// ==========================================
// 4. MANUAL AUDITED CORRECTION
// ==========================================

export async function manualCorrection(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const adminUserId = req.user?.userId;
    if (!instituteId || !adminUserId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    const parsed = manualCorrectionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.format(),
      });
      return;
    }

    const { sessionId, staffId, date, checkInTime, checkOutTime, status, reason } = parsed.data;

    let targetSessionId = sessionId;
    let targetStaffId = staffId;
    let attendanceDate: Date;

    if (targetSessionId) {
      const existing = await prisma.staffAttendanceSession.findFirst({
        where: { id: targetSessionId, instituteId },
      });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Attendance session not found' });
        return;
      }
      targetStaffId = existing.staffId;
      attendanceDate = existing.attendanceDate;
    } else if (staffId && date) {
      attendanceDate = new Date(`${date}T00:00:00.000Z`);
    } else {
      res.status(400).json({
        success: false,
        message: 'Either sessionId or (staffId and date) must be provided',
      });
      return;
    }

    const inTime = checkInTime ? new Date(checkInTime) : null;
    const outTime = checkOutTime ? new Date(checkOutTime) : null;

    let durationMinutes = 0;
    if (inTime && outTime && outTime >= inTime) {
      durationMinutes = Math.round((outTime.getTime() - inTime.getTime()) / 60000);
    }

    const serverNow = new Date();

    const result = await prisma.$transaction(async (tx) => {
      const session = await tx.staffAttendanceSession.upsert({
        where: {
          instituteId_staffId_attendanceDate: {
            instituteId,
            staffId: targetStaffId!,
            attendanceDate,
          },
        },
        create: {
          instituteId,
          staffId: targetStaffId!,
          attendanceDate,
          status,
          checkInTime: inTime,
          checkOutTime: outTime,
          workDurationMinutes: durationMinutes,
          isManuallyCorrected: true,
          correctionReason: reason,
          correctedById: adminUserId,
          correctedAt: serverNow,
        },
        update: {
          status,
          checkInTime: inTime,
          checkOutTime: outTime,
          workDurationMinutes: durationMinutes,
          isManuallyCorrected: true,
          correctionReason: reason,
          correctedById: adminUserId,
          correctedAt: serverNow,
        },
      });

      // Add audit event
      await tx.staffAttendanceEvent.create({
        data: {
          sessionId: session.id,
          instituteId,
          staffId: targetStaffId!,
          eventType: 'MANUAL_CORRECTION',
          serverTimestamp: serverNow,
          isWithinGeofence: true,
          validationOutcome: 'MANUALLY_ADJUSTED_BY_ADMIN',
          remarks: `Corrected by Admin: ${reason}`,
        },
      });

      // System Audit Log
      await tx.auditLog.create({
        data: {
          instituteId,
          userId: adminUserId,
          action: 'MANUAL_STAFF_ATTENDANCE_CORRECTION',
          entityType: 'StaffAttendanceSession',
          entityId: session.id,
          newValues: {
            staffId: targetStaffId,
            date: attendanceDate.toISOString().split('T')[0],
            newStatus: status,
            checkInTime: inTime?.toISOString() || null,
            checkOutTime: outTime?.toISOString() || null,
            reason,
          },
        },
      });

      return session;
    });

    res.json({
      success: true,
      message: 'Attendance record manually corrected and logged successfully',
      data: result,
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error in manual correction:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to correct record' });
  }
}

// ==========================================
// 5. MONTHLY REPORTS & CSV EXPORT
// ==========================================

export async function getAdminMonthlyReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      res.status(400).json({ success: false, message: 'Institute context required' });
      return;
    }

    const { year, month, format = 'json' } = req.query;

    const currentYear = year ? parseInt(year as string, 10) : new Date().getFullYear();
    const currentMonth = month ? parseInt(month as string, 10) : new Date().getMonth() + 1;

    // Start & End date for the month
    const startStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01T00:00:00.000Z`;
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    const endStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`;

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    // Fetch all active staff
    const allStaff = await prisma.staffProfile.findMany({
      where: { instituteId },
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
      },
      orderBy: { employeeCode: 'asc' },
    });

    // Fetch all sessions in month
    const sessions = await prisma.staffAttendanceSession.findMany({
      where: {
        instituteId,
        attendanceDate: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const reportData = allStaff.map((staff) => {
      const staffSessions = sessions.filter((s) => s.staffId === staff.id);

      const onSiteDays = staffSessions.filter((s) =>
        ['CHECKED_IN', 'CHECKED_OUT', 'LATE', 'MANUALLY_CORRECTED'].includes(s.status) &&
        s.attendanceMode === 'ON_SITE'
      ).length;

      const wfhDays = staffSessions.filter((s) =>
        ['CHECKED_IN', 'CHECKED_OUT', 'LATE', 'MANUALLY_CORRECTED'].includes(s.status) &&
        s.attendanceMode === 'WFH'
      ).length;

      const daysPresent = onSiteDays + wfhDays;

      const daysLate = staffSessions.filter((s) => s.isLate).length;

      const missingCheckouts = staffSessions.filter((s) => s.status === 'CHECKED_IN' && !s.checkOutTime).length;

      const onLeaveDays = staffSessions.filter((s) => s.status === 'ON_LEAVE').length;

      const totalMinutes = staffSessions.reduce((sum, s) => sum + (s.workDurationMinutes || 0), 0);
      const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

      const attendancePercentage = lastDay > 0 ? Math.round((daysPresent / lastDay) * 100) : 0;

      return {
        staffId: staff.id,
        employeeCode: staff.employeeCode || 'N/A',
        fullName: staff.user.fullName,
        designation: staff.designation || 'Staff',
        department: staff.department || 'General',
        daysPresent,
        onSiteDays,
        wfhDays,
        daysLate,
        missingCheckouts,
        onLeaveDays,
        totalHours,
        attendancePercentage,
      };
    });

    if (format === 'csv') {
      const headers = [
        'Employee Code',
        'Staff Name',
        'Designation',
        'Department',
        'Total Days Present',
        'On-Site Days',
        'WFH Days',
        'Late Arrivals',
        'Missing Check-Outs',
        'Approved Leave Days',
        'Total Work Hours',
        'Attendance Rate (%)',
      ];

      const rows = reportData.map((r) => [
        `"${r.employeeCode}"`,
        `"${r.fullName}"`,
        `"${r.designation}"`,
        `"${r.department}"`,
        r.daysPresent,
        r.daysLate,
        r.missingCheckouts,
        r.onLeaveDays,
        r.totalHours,
        `${r.attendancePercentage}%`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Staff_Attendance_Report_${currentYear}_${currentMonth}.csv"`
      );
      res.status(200).send(csvContent);
      return;
    }

    res.json({
      success: true,
      data: {
        year: currentYear,
        month: currentMonth,
        totalDaysInMonth: lastDay,
        report: reportData,
      },
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error generating monthly report:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to generate report' });
  }
}


// ==========================================
// 6. WORK FROM HOME (WFH) CONTROLLERS
// ==========================================

export async function getStaffWfhEligibility(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const userId = req.user?.userId;
    if (!instituteId || !userId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    const { date } = req.query;

    const staff = await prisma.staffProfile.findFirst({
      where: { userId, instituteId },
    });

    if (!staff) {
      res.status(404).json({ success: false, message: 'Staff profile not found' });
      return;
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: { timezone: true, allowStaffWfhRequests: true },
    });

    const targetDate = date && typeof date === 'string'
      ? new Date(`${date}T00:00:00.000Z`)
      : getLocalDateForInstitute(new Date(), institute?.timezone || 'Asia/Kolkata');

    const wfhCheck = await isStaffWfhAuthorized({
      instituteId,
      staffId: staff.id,
      date: targetDate,
    });

    res.json({
      success: true,
      data: {
        isAuthorized: wfhCheck.isAuthorized,
        scope: wfhCheck.scope || null,
        reason: wfhCheck.reason || null,
        authorization: wfhCheck.authorization || null,
        allowStaffWfhRequests: institute?.allowStaffWfhRequests ?? true,
        dateStr: targetDate.toISOString().split('T')[0],
      },
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error checking WFH eligibility:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to check WFH eligibility' });
  }
}

export async function submitStaffWfhRequest(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const userId = req.user?.userId;
    if (!instituteId || !userId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: { allowStaffWfhRequests: true },
    });

    if (!institute?.allowStaffWfhRequests) {
      res.status(403).json({
        success: false,
        message: 'Staff Work From Home requests are currently disabled by institute administration.',
      });
      return;
    }

    const parsed = submitWfhRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid request data', errors: parsed.error.format() });
      return;
    }

    const staff = await prisma.staffProfile.findFirst({
      where: { userId, instituteId },
    });

    if (!staff) {
      res.status(404).json({ success: false, message: 'Staff profile not found' });
      return;
    }

    const { startDate, endDate, reasonCategory, reason, notes } = parsed.data;

    const request = await createWfhAuthorization({
      instituteId,
      scope: 'INDIVIDUAL',
      staffId: staff.id,
      startDate: new Date(`${startDate}T00:00:00.000Z`),
      endDate: new Date(`${endDate}T00:00:00.000Z`),
      reasonCategory,
      reason,
      notes,
      status: 'PENDING',
      requestedById: userId,
      actingUserId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({
      success: true,
      message: 'Work From Home request submitted successfully! Academic Admin will review your request.',
      data: request,
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error submitting WFH request:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to submit WFH request' });
  }
}

export async function getStaffMyWfhRequests(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const userId = req.user?.userId;
    if (!instituteId || !userId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    const staff = await prisma.staffProfile.findFirst({
      where: { userId, instituteId },
    });

    if (!staff) {
      res.status(404).json({ success: false, message: 'Staff profile not found' });
      return;
    }

    const requests = await prisma.staffWFHAuthorization.findMany({
      where: {
        instituteId,
        OR: [
          { staffId: staff.id },
          { groupAssignments: { some: { staffId: staff.id } } },
          { scope: 'INSTITUTE_WIDE' },
        ],
      },
      include: {
        approvedBy: { select: { fullName: true } },
        rejectedBy: { select: { fullName: true } },
        revokedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error fetching my WFH requests:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch WFH requests' });
  }
}

export async function getAdminWfhAuthorizations(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      res.status(400).json({ success: false, message: 'Institute context required' });
      return;
    }

    const { status, scope, reasonCategory, staffId, date, search } = req.query;

    const where: any = { instituteId };

    if (status && typeof status === 'string' && status !== 'ALL') {
      where.status = status;
    }

    if (scope && typeof scope === 'string' && scope !== 'ALL') {
      where.scope = scope;
    }

    if (reasonCategory && typeof reasonCategory === 'string' && reasonCategory !== 'ALL') {
      where.reasonCategory = reasonCategory;
    }

    if (staffId && typeof staffId === 'string') {
      where.OR = [
        { staffId },
        { groupAssignments: { some: { staffId } } },
      ];
    }

    if (date && typeof date === 'string') {
      const targetDate = new Date(`${date}T00:00:00.000Z`);
      where.startDate = { lte: targetDate };
      where.endDate = { gte: targetDate };
    }

    if (search && typeof search === 'string') {
      const q = search.trim();
      where.OR = [
        { reason: { contains: q, mode: 'insensitive' } },
        { staff: { employeeCode: { contains: q, mode: 'insensitive' } } },
        { staff: { user: { fullName: { contains: q, mode: 'insensitive' } } } },
      ];
    }

    const authorizations = await prisma.staffWFHAuthorization.findMany({
      where,
      include: {
        staff: {
          include: {
            user: { select: { fullName: true, email: true } },
          },
        },
        requestedBy: { select: { fullName: true, email: true } },
        approvedBy: { select: { fullName: true, email: true } },
        rejectedBy: { select: { fullName: true, email: true } },
        revokedBy: { select: { fullName: true, email: true } },
        groupAssignments: {
          include: {
            staff: {
              include: { user: { select: { fullName: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: authorizations,
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error listing WFH authorizations:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to list WFH authorizations' });
  }
}

export async function createAdminWfhAuthorization(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const adminUserId = req.user?.userId;
    if (!instituteId || !adminUserId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    const parsed = createWfhAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid payload', errors: parsed.error.format() });
      return;
    }

    const { scope, staffId, staffIds, startDate, endDate, reasonCategory, reason, notes } = parsed.data;

    const auth = await createWfhAuthorization({
      instituteId,
      scope,
      staffId,
      staffIds,
      startDate: new Date(`${startDate}T00:00:00.000Z`),
      endDate: new Date(`${endDate}T00:00:00.000Z`),
      reasonCategory,
      reason,
      notes,
      status: 'APPROVED',
      approvedById: adminUserId,
      actingUserId: adminUserId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({
      success: true,
      message: 'Work From Home authorization created successfully!',
      data: auth,
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error creating WFH authorization:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to create authorization' });
  }
}

export async function approveWfhRequestHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const adminUserId = req.user?.userId;
    const { id } = req.params;

    if (!instituteId || !adminUserId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    const updated = await reviewWfhRequest({
      authorizationId: id,
      instituteId,
      adminUserId,
      action: 'APPROVE',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: 'WFH request approved successfully!',
      data: updated,
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error approving WFH request:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to approve request' });
  }
}

export async function rejectWfhRequestHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const adminUserId = req.user?.userId;
    const { id } = req.params;

    if (!instituteId || !adminUserId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    const parsed = rejectWfhRequestSchema.safeParse(req.body);
    const reason = parsed.success ? parsed.data.reason : undefined;

    const updated = await reviewWfhRequest({
      authorizationId: id,
      instituteId,
      adminUserId,
      action: 'REJECT',
      reason,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: 'WFH request rejected.',
      data: updated,
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error rejecting WFH request:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to reject request' });
  }
}

export async function revokeWfhAuthorizationHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const adminUserId = req.user?.userId;
    const { id } = req.params;

    if (!instituteId || !adminUserId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    const parsed = revokeWfhAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: 'A mandatory revocation reason of at least 3 characters is required',
        errors: parsed.error.format(),
      });
      return;
    }

    const updated = await revokeWfhAuthorization({
      authorizationId: id,
      instituteId,
      adminUserId,
      revocationReason: parsed.data.revocationReason,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: 'WFH authorization revoked successfully. Existing attendance records have been preserved.',
      data: updated,
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error revoking WFH authorization:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to revoke authorization' });
  }
}

export async function getAdminWfhMetricsHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    if (!instituteId) {
      res.status(400).json({ success: false, message: 'Institute context required' });
      return;
    }

    const { date } = req.query;

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: { timezone: true },
    });

    const targetDate = date && typeof date === 'string'
      ? new Date(`${date}T00:00:00.000Z`)
      : getLocalDateForInstitute(new Date(), institute?.timezone || 'Asia/Kolkata');

    const metrics = await getWfhMetrics(instituteId, targetDate);

    res.json({
      success: true,
      data: {
        dateStr: targetDate.toISOString().split('T')[0],
        ...metrics,
      },
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error getting WFH metrics:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get WFH metrics' });
  }
}

export async function getStaffOnlineClassesHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const userId = req.user?.userId;
    if (!instituteId || !userId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    const { date } = req.query;

    const staff = await prisma.staffProfile.findFirst({
      where: { userId, instituteId },
    });

    if (!staff) {
      res.status(404).json({ success: false, message: 'Staff profile not found' });
      return;
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: { timezone: true },
    });

    const targetDate = date && typeof date === 'string'
      ? new Date(`${date}T00:00:00.000Z`)
      : getLocalDateForInstitute(new Date(), institute?.timezone || 'Asia/Kolkata');

    const classes = await getStaffTodayOnlineClasses({
      staffProfileId: staff.id,
      instituteId,
      targetDate,
    });

    res.json({
      success: true,
      data: {
        dateStr: targetDate.toISOString().split('T')[0],
        totalClasses: classes.length,
        classes,
      },
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error fetching online classes:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch online classes' });
  }
}

export async function updateOnlineClassStatusHandler(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const instituteId = req.instituteId;
    const userId = req.user?.userId;
    const { batchSubjectId } = req.params;

    if (!instituteId || !userId) {
      res.status(400).json({ success: false, message: 'Institute and user context required' });
      return;
    }

    const parsed = updateClassStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: 'Invalid payload', errors: parsed.error.format() });
      return;
    }

    const staff = await prisma.staffProfile.findFirst({
      where: { userId, instituteId },
    });

    if (!staff) {
      res.status(404).json({ success: false, message: 'Staff profile not found' });
      return;
    }

    const institute = await prisma.institute.findUnique({
      where: { id: instituteId },
      select: { timezone: true },
    });

    const today = getLocalDateForInstitute(new Date(), institute?.timezone || 'Asia/Kolkata');

    const updated = await updateOnlineClassStatus({
      instituteId,
      staffProfileId: staff.id,
      batchSubjectId,
      targetDate: today,
      status: parsed.data.status,
      notes: parsed.data.notes || undefined,
      meetingLink: parsed.data.meetingLink || undefined,
      actingUserId: userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: `Online class marked as ${parsed.data.status}`,
      data: updated,
    });
  } catch (error: any) {
    console.error('[StaffAttendance] Error updating online class status:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update class status' });
  }
}
