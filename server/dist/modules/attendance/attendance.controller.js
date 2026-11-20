"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.correctionSchema = exports.checkOutSchema = exports.checkInSchema = exports.voiceMatchSchema = void 0;
exports.getInstituteLocalDate = getInstituteLocalDate;
exports.generateQrPassToken = generateQrPassToken;
exports.verifyQrPassToken = verifyQrPassToken;
exports.recordCheckIn = recordCheckIn;
exports.voiceMatchStudents = voiceMatchStudents;
exports.recordCheckOut = recordCheckOut;
exports.getAttendanceSummary = getAttendanceSummary;
exports.getAttendanceReports = getAttendanceReports;
exports.getStudentQrPass = getStudentQrPass;
exports.validateScannedQr = validateScannedQr;
exports.correctAttendanceEvent = correctAttendanceEvent;
const shared_1 = require("@tuition/shared");
const prisma_js_1 = require("../../prisma.js");
const zod_1 = require("zod");
const crypto_1 = __importDefault(require("crypto"));
const index_js_1 = require("../../config/index.js");
const inapp_notification_service_js_1 = require("../notifications/inapp-notification.service.js");
const student_authorization_service_js_1 = require("../students/student-authorization.service.js");
// Helper: Get local Date (YYYY-MM-DD) in Asia/Kolkata timezone
function getInstituteLocalDate(date = new Date(), timeZone = 'Asia/Kolkata') {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });
    const dateStr = formatter.format(date); // "YYYY-MM-DD"
    return new Date(`${dateStr}T00:00:00.000Z`);
}
// Helper: Sign QR Code Payload
function generateQrPassToken(studentId, instituteId) {
    const secret = index_js_1.config.jwt.secret;
    const payload = `${studentId}:${instituteId}`;
    const hmac = crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex').substring(0, 16);
    return `TUITION_PASS:${studentId}:${instituteId}:${hmac}`;
}
// Helper: Verify QR Code Payload
function verifyQrPassToken(qrToken) {
    const parts = qrToken.split(':');
    if (parts.length !== 4 || parts[0] !== 'TUITION_PASS') {
        return { valid: false };
    }
    const [, studentId, instituteId, signature] = parts;
    const expectedSig = crypto_1.default.createHmac('sha256', index_js_1.config.jwt.secret).update(`${studentId}:${instituteId}`).digest('hex').substring(0, 16);
    if (signature !== expectedSig) {
        return { valid: false };
    }
    return { valid: true, studentId, instituteId };
}
// Validation Schemas
exports.voiceMatchSchema = zod_1.z.object({
    transcript: zod_1.z.string().trim().min(1, 'Transcript or query text is required'),
    batchId: zod_1.z.string().uuid().optional().nullable(),
    subjectId: zod_1.z.string().uuid().optional().nullable(),
});
exports.checkInSchema = zod_1.z.object({
    studentId: zod_1.z.string().uuid(),
    batchId: zod_1.z.string().uuid().optional(),
    subjectId: zod_1.z.string().uuid().optional(),
    method: zod_1.z.enum(['MANUAL', 'QR_SCAN', 'VOICE_CONFIRMED']).default('MANUAL'),
    isLate: zod_1.z.boolean().default(false),
    remarks: zod_1.z.string().optional(),
    idempotencyKey: zod_1.z.string().optional(),
});
exports.checkOutSchema = zod_1.z.object({
    studentId: zod_1.z.string().uuid(),
    batchId: zod_1.z.string().uuid().optional(),
    subjectId: zod_1.z.string().uuid().optional(),
    method: zod_1.z.enum(['MANUAL', 'QR_SCAN', 'VOICE_CONFIRMED']).default('MANUAL'),
    remarks: zod_1.z.string().optional(),
    idempotencyKey: zod_1.z.string().optional(),
});
exports.correctionSchema = zod_1.z.object({
    remarks: zod_1.z.string().optional(),
    isLate: zod_1.z.boolean().optional(),
    reason: zod_1.z.string().min(3, 'Correction reason is required'),
});
/**
 * Record Student Check-In
 */
async function recordCheckIn(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const parse = exports.checkInSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });
        }
        const { studentId, batchId, subjectId, method, isLate, remarks, idempotencyKey } = parse.data;
        // Upfront idempotency check to safely handle retries and prevent duplicate records/notifications
        if (idempotencyKey) {
            const existing = await prisma_js_1.prisma.attendanceEvent.findUnique({
                where: { idempotencyKey },
                include: {
                    student: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            admissionNumber: true,
                            photoUrl: true,
                        },
                    },
                    batch: {
                        select: { id: true, name: true },
                    },
                },
            });
            if (existing) {
                const timeStr = new Intl.DateTimeFormat('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                }).format(existing.eventTime);
                return res.status(200).json({
                    success: true,
                    message: `${existing.student.firstName} ${existing.student.lastName} check-in was already processed.`,
                    data: {
                        event: existing,
                        student: {
                            ...existing.student,
                            batchName: existing.batch?.name || null,
                            checkInTimeFormatted: timeStr,
                        },
                        alreadyProcessed: true,
                    },
                });
            }
        }
        // Staff validation for batch and subject
        if (req.user?.role === 'STAFF') {
            if (batchId) {
                const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, batchId, prisma_js_1.prisma);
                if (!isAssigned) {
                    return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to mark attendance in this batch' });
                }
            }
            if (batchId && subjectId) {
                const isAssignedSub = await (0, student_authorization_service_js_1.isStaffAssignedToBatchSubject)(req, batchId, subjectId, prisma_js_1.prisma);
                if (!isAssignedSub) {
                    return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to mark attendance for this subject' });
                }
            }
        }
        // Verify authorization scope for student
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma, { batchId, subjectId });
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to record attendance for this student' });
        }
        // Verify Student belongs to this institute and is ACTIVE
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { id: studentId, instituteId },
            include: {
                enrollments: { where: { isActive: true } },
            },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found in this institute' });
        }
        if (student.status !== 'ACTIVE') {
            return res.status(400).json({ success: false, error: `Cannot record attendance for student in ${student.status} status` });
        }
        if (batchId) {
            const isEnrolledInBatch = student.enrollments.some((e) => e.batchId === batchId);
            if (!isEnrolledInBatch) {
                return res.status(400).json({ success: false, error: 'Student is not enrolled in the specified batch' });
            }
        }
        const assignedBatchId = batchId || student.enrollments[0]?.batchId;
        if (!assignedBatchId) {
            return res.status(400).json({ success: false, error: 'Student is not enrolled in any batch' });
        }
        const serverNow = new Date();
        const eventDate = getInstituteLocalDate(serverNow);
        // Fetch existing attendance events for today
        const todaysEvents = await prisma_js_1.prisma.attendanceEvent.findMany({
            where: {
                studentId,
                eventDate,
            },
            orderBy: { sessionNumber: 'desc' },
        });
        // Check transition validity:
        // If there is an existing CHECK_IN without an intervening CHECK_OUT in the latest session, reject with rich existing status!
        const latestCheckIn = todaysEvents.find((e) => e.eventType === 'CHECK_IN');
        const latestCheckOut = todaysEvents.find((e) => e.eventType === 'CHECK_OUT');
        if (latestCheckIn) {
            if (!latestCheckOut || latestCheckOut.sessionNumber < latestCheckIn.sessionNumber) {
                const timeFormatted = new Intl.DateTimeFormat('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                }).format(latestCheckIn.eventTime);
                return res.status(409).json({
                    success: false,
                    alreadyCheckedIn: true,
                    error: `${student.firstName} ${student.lastName} is already checked in for today at ${timeFormatted}.`,
                    data: {
                        student: {
                            id: student.id,
                            firstName: student.firstName,
                            lastName: student.lastName,
                            admissionNumber: student.admissionNumber,
                            photoUrl: student.photoUrl,
                        },
                        existingEvent: {
                            id: latestCheckIn.id,
                            eventTime: latestCheckIn.eventTime,
                            eventTimeFormatted: timeFormatted,
                            eventType: latestCheckIn.eventType,
                            sessionNumber: latestCheckIn.sessionNumber,
                            method: latestCheckIn.method,
                        },
                    },
                });
            }
        }
        // Determine session number (e.g. 1 for morning, 2 for evening session)
        const nextSessionNumber = latestCheckIn ? latestCheckIn.sessionNumber + 1 : 1;
        // Record Event in transactional scope
        const event = await prisma_js_1.prisma.attendanceEvent.create({
            data: {
                instituteId,
                studentId,
                batchId: assignedBatchId,
                eventDate,
                eventType: 'CHECK_IN',
                eventTime: serverNow,
                sessionNumber: nextSessionNumber,
                method,
                isLate,
                markedById: req.user.userId,
                remarks: remarks || null,
                idempotencyKey: idempotencyKey || null,
            },
            include: {
                batch: { select: { id: true, name: true } },
            },
        });
        // Queue SMS notification for guardians safely outside transaction
        // (Preserves successful attendance record even if telephony provider or template fails)
        let smsNotifications = [];
        try {
            await inapp_notification_service_js_1.InAppNotificationService.createAttendanceNotifications({
                attendanceEventId: event.id,
                studentId,
                instituteId,
                eventType: 'CHECK_IN',
                eventTime: serverNow,
            });
        }
        catch (smsErr) {
            console.error('[NotificationService] Non-blocking SMS enqueue warning:', smsErr.message);
        }
        const checkInTimeStr = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(serverNow);
        return res.status(201).json({
            success: true,
            message: `${student.firstName} ${student.lastName} checked in successfully.`,
            data: {
                event,
                student: {
                    id: student.id,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    admissionNumber: student.admissionNumber,
                    photoUrl: student.photoUrl,
                    batchName: event.batch?.name || null,
                    checkInTimeFormatted: checkInTimeStr,
                },
                smsNotification: smsNotifications.length > 0
                    ? {
                        queued: false,
                        reason: 'In-app notification sent',
                        count: smsNotifications.length,
                        status: smsNotifications[0].status,
                        recipient: smsNotifications[0].phoneNumber.replace(/(\d{2})\d+(\d{2})/, '$1******$2'),
                    }
                    : {
                        queued: false,
                        reason: 'No linked guardian with SMS permission enabled',
                    },
            },
        });
    }
    catch (err) {
        console.error('[Check-in Error]', err);
        // Prisma Unique Constraint Violation (concurrent requests for same student/date/session)
        if (err?.code === 'P2002') {
            try {
                const existing = await prisma_js_1.prisma.attendanceEvent.findFirst({
                    where: {
                        studentId: req.body?.studentId,
                        eventType: 'CHECK_IN',
                    },
                    orderBy: { eventTime: 'desc' },
                });
                const timeStr = existing
                    ? new Intl.DateTimeFormat('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                    }).format(existing.eventTime)
                    : 'earlier today';
                return res.status(409).json({
                    success: false,
                    alreadyCheckedIn: true,
                    error: `Student was already checked in at ${timeStr}. Duplicate attendance prevented.`,
                    data: { existingEvent: existing },
                });
            }
            catch { }
        }
        return res.status(500).json({ success: false, error: 'Failed to record check-in' });
    }
}
/**
 * Voice Match Students:
 * Searches eligible students within the staff member's institute and authorized batches/subjects,
 * matches the spoken transcript, determines if already checked in, and determines if eligible for automatic check-in.
 */
async function voiceMatchStudents(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const rawInput = req.method === 'GET' ? req.query : req.body;
        const parse = exports.voiceMatchSchema.safeParse(rawInput);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });
        }
        const { transcript, batchId, subjectId } = parse.data;
        // Staff validation for batch and subject
        if (req.user?.role === 'STAFF') {
            if (batchId) {
                const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, batchId, prisma_js_1.prisma);
                if (!isAssigned) {
                    return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to view students in this batch' });
                }
            }
            if (batchId && subjectId) {
                const isAssignedSub = await (0, student_authorization_service_js_1.isStaffAssignedToBatchSubject)(req, batchId, subjectId, prisma_js_1.prisma);
                if (!isAssignedSub) {
                    return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to view students for this subject' });
                }
            }
        }
        const scope = await (0, student_authorization_service_js_1.getAuthorizedStudentScope)(req, prisma_js_1.prisma, {
            batchId: batchId || undefined,
            subjectId: subjectId || undefined,
        });
        const andConditions = [
            { instituteId, status: 'ACTIVE' },
            scope.whereClause,
        ];
        if (req.user?.role !== 'STAFF') {
            if (batchId) {
                andConditions.push({
                    enrollments: { some: { batchId, isActive: true } },
                });
            }
            if (subjectId) {
                andConditions.push({
                    enrollments: { some: { batchId: batchId || undefined, subjectId, isActive: true } },
                });
            }
        }
        const serverNow = new Date();
        const targetDate = getInstituteLocalDate(serverNow);
        const students = await prisma_js_1.prisma.student.findMany({
            where: { AND: andConditions },
            include: {
                enrollments: {
                    where: { isActive: true },
                    include: {
                        batch: { select: { id: true, name: true, code: true } },
                        subject: { select: { id: true, name: true, code: true } },
                    },
                },
                attendanceEvents: {
                    where: {
                        instituteId,
                        eventDate: targetDate,
                        ...(batchId ? { batchId } : {}),
                    },
                    orderBy: { sessionNumber: 'desc' },
                    select: {
                        id: true,
                        eventType: true,
                        eventTime: true,
                        sessionNumber: true,
                        method: true,
                    },
                },
            },
            orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
        });
        const timeFormatter = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
        const candidates = students.map((s) => {
            const latestCheckIn = s.attendanceEvents.find((e) => e.eventType === 'CHECK_IN');
            const latestCheckOut = s.attendanceEvents.find((e) => e.eventType === 'CHECK_OUT');
            const isCheckedIn = !!(latestCheckIn &&
                (!latestCheckOut || latestCheckOut.sessionNumber < latestCheckIn.sessionNumber));
            const isCheckedOut = !!(latestCheckIn &&
                latestCheckOut &&
                latestCheckOut.sessionNumber >= latestCheckIn.sessionNumber);
            const checkInTimeFormatted = latestCheckIn ? timeFormatter.format(latestCheckIn.eventTime) : null;
            const checkOutTimeFormatted = latestCheckOut ? timeFormatter.format(latestCheckOut.eventTime) : null;
            const targetEnrollment = batchId
                ? s.enrollments.find((e) => e.batchId === batchId) || s.enrollments[0]
                : s.enrollments[0];
            const todayStatus = isCheckedIn ? 'CHECKED_IN' : isCheckedOut ? 'CHECKED_OUT' : 'ABSENT';
            const recommendedAction = todayStatus === 'ABSENT' ? 'CHECK_IN' : todayStatus === 'CHECKED_IN' ? 'CHECK_OUT' : 'COMPLETED';
            return {
                id: s.id,
                firstName: s.firstName,
                lastName: s.lastName,
                admissionNumber: s.admissionNumber,
                rollNumber: s.rollNumber || null,
                phone: s.phone,
                photoUrl: s.photoUrl,
                status: s.status,
                batchId: targetEnrollment?.batchId,
                batchName: targetEnrollment?.batch?.name || 'Unassigned',
                subjectId: targetEnrollment?.subjectId || null,
                subjectName: targetEnrollment?.subject?.name || null,
                alreadyCheckedIn: isCheckedIn,
                alreadyCheckedOut: isCheckedOut,
                checkInTimeFormatted,
                checkOutTimeFormatted,
                todayStatus,
                recommendedAction,
            };
        });
        // Run voice matching
        const matchResult = (0, shared_1.matchStudentVoice)(transcript, candidates);
        if (matchResult.status === 'EXACT_SINGLE' && matchResult.bestMatch) {
            const match = matchResult.bestMatch;
            const proposedAction = match.recommendedAction || 'CHECK_IN';
            const autoActionEligible = proposedAction === 'CHECK_IN'; // Fast path for check-in; check-out requires deliberate confirm or single tap
            let message = `Exact match found for ${match.firstName} ${match.lastName}. Ready to check in.`;
            if (proposedAction === 'CHECK_OUT') {
                message = `${match.firstName} ${match.lastName} is checked in at ${match.checkInTimeFormatted}. Ready to check out.`;
            }
            else if (proposedAction === 'COMPLETED') {
                message = `${match.firstName} ${match.lastName} has already checked out for today at ${match.checkOutTimeFormatted || 'earlier'}.`;
            }
            return res.json({
                success: true,
                status: 'EXACT_SINGLE',
                matchCount: 1,
                bestMatch: match,
                matches: [match],
                proposedAction,
                autoActionEligible,
                autoCheckInEligible: autoActionEligible,
                alreadyCheckedIn: !!match.alreadyCheckedIn,
                alreadyCheckedOut: !!match.alreadyCheckedOut,
                checkInTimeFormatted: match.checkInTimeFormatted,
                checkOutTimeFormatted: match.checkOutTimeFormatted,
                message,
                cleanedQuery: matchResult.cleanedQuery,
            });
        }
        if (matchResult.status === 'EXACT_MULTIPLE') {
            const matches = matchResult.allMatches || matchResult.exactMatches;
            return res.json({
                success: true,
                status: 'EXACT_MULTIPLE',
                matchCount: matches.length,
                bestMatch: null,
                matches,
                proposedAction: 'MULTIPLE_CANDIDATES',
                autoActionEligible: false,
                autoCheckInEligible: false,
                message: `Multiple students matched '${transcript}'. Please select the intended student.`,
                cleanedQuery: matchResult.cleanedQuery,
            });
        }
        if (matchResult.status === 'FUZZY_SINGLE' && matchResult.bestMatch) {
            const match = matchResult.bestMatch;
            const confidence = matchResult.fuzzyMatches[0]?.score || 0.8;
            const proposedAction = match.recommendedAction || 'CHECK_IN';
            let message = `Possible match for ${match.firstName} ${match.lastName} (${Math.round(confidence * 100)}% confidence). Please confirm action.`;
            if (proposedAction === 'CHECK_OUT') {
                message = `Possible match for ${match.firstName} ${match.lastName} (currently checked in). Please confirm check-out.`;
            }
            else if (proposedAction === 'COMPLETED') {
                message = `${match.firstName} ${match.lastName} has already checked out today.`;
            }
            return res.json({
                success: true,
                status: 'FUZZY_SINGLE',
                matchCount: 1,
                bestMatch: match,
                matches: [match],
                proposedAction,
                autoActionEligible: false, // Never auto action low/fuzzy confidence! Requires staff confirmation
                autoCheckInEligible: false,
                requiresConfirmation: true,
                confidenceScore: Math.round(confidence * 100),
                alreadyCheckedIn: !!match.alreadyCheckedIn,
                alreadyCheckedOut: !!match.alreadyCheckedOut,
                checkInTimeFormatted: match.checkInTimeFormatted,
                checkOutTimeFormatted: match.checkOutTimeFormatted,
                message,
                cleanedQuery: matchResult.cleanedQuery,
            });
        }
        if (matchResult.status === 'FUZZY_MULTIPLE') {
            const matches = matchResult.allMatches || matchResult.fuzzyMatches.map((f) => f.student);
            return res.json({
                success: true,
                status: 'FUZZY_MULTIPLE',
                matchCount: matches.length,
                bestMatch: null,
                matches,
                proposedAction: 'MULTIPLE_CANDIDATES',
                autoActionEligible: false,
                autoCheckInEligible: false,
                message: `Multiple students have similar names to '${transcript}'. Please select the intended student.`,
                cleanedQuery: matchResult.cleanedQuery,
            });
        }
        return res.json({
            success: true,
            status: 'NO_MATCH',
            matchCount: 0,
            bestMatch: null,
            matches: [],
            proposedAction: 'NONE',
            autoActionEligible: false,
            autoCheckInEligible: false,
            message: `No matching student found for '${transcript}'.`,
            cleanedQuery: matchResult.cleanedQuery,
        });
    }
    catch (err) {
        console.error('[Voice Match Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to process voice matching' });
    }
}
async function recordCheckOut(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const parse = exports.checkOutSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });
        }
        const { studentId, method, remarks, idempotencyKey } = parse.data;
        // Idempotency check
        if (idempotencyKey) {
            const existing = await prisma_js_1.prisma.attendanceEvent.findUnique({
                where: { idempotencyKey },
            });
            if (existing) {
                return res.status(200).json({
                    success: true,
                    message: 'Check-out request was previously processed',
                    data: { event: existing },
                });
            }
        }
        // Verify authorization scope for student
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to record check-out for this student' });
        }
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { id: studentId, instituteId },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found in this institute' });
        }
        const serverNow = new Date();
        const eventDate = getInstituteLocalDate(serverNow);
        // Fetch existing attendance events for today
        const todaysEvents = await prisma_js_1.prisma.attendanceEvent.findMany({
            where: { studentId, eventDate },
            orderBy: { sessionNumber: 'desc' },
        });
        // Check transition validity:
        // Student CANNOT check out if they have no active check-in today!
        const activeCheckIn = todaysEvents.find((e) => e.eventType === 'CHECK_IN');
        const existingCheckOut = todaysEvents.find((e) => e.eventType === 'CHECK_OUT' && e.sessionNumber === activeCheckIn?.sessionNumber);
        if (!activeCheckIn) {
            return res.status(400).json({
                success: false,
                error: 'Cannot check out: Student has no active check-in record for today.',
            });
        }
        if (existingCheckOut) {
            const timeFormatted = new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            }).format(existingCheckOut.eventTime);
            return res.status(409).json({
                success: false,
                alreadyCheckedOut: true,
                error: `${student.firstName} ${student.lastName} has already checked out for today at ${timeFormatted}.`,
                data: {
                    existingEvent: existingCheckOut,
                },
            });
        }
        // Record Check-out Event + queue notification
        const event = await prisma_js_1.prisma.$transaction(async (tx) => {
            const createdEvent = await tx.attendanceEvent.create({
                data: {
                    instituteId,
                    studentId,
                    batchId: activeCheckIn.batchId,
                    eventDate,
                    eventType: 'CHECK_OUT',
                    eventTime: serverNow,
                    sessionNumber: activeCheckIn.sessionNumber,
                    method,
                    isLate: false,
                    markedById: req.user.userId,
                    remarks: remarks || null,
                    idempotencyKey: idempotencyKey || null,
                },
            });
            // Queue SMS notification for guardians
            await inapp_notification_service_js_1.InAppNotificationService.createAttendanceNotifications({
                attendanceEventId: createdEvent.id,
                studentId,
                instituteId,
                eventType: 'CHECK_OUT',
                eventTime: serverNow,
                tx,
            });
            return createdEvent;
        }, { timeout: 15000, maxWait: 10000 });
        const checkOutTimeFormatted = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(serverNow);
        return res.status(201).json({
            success: true,
            message: `${student.firstName} ${student.lastName} checked out successfully.`,
            data: {
                event,
                student: {
                    id: student.id,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    admissionNumber: student.admissionNumber,
                    photoUrl: student.photoUrl,
                    checkOutTimeFormatted,
                },
                smsNotification: {
                    queued: false,
                    reason: 'In-app notification sent',
                    eventType: 'CHECK_OUT',
                },
            },
        });
    }
    catch (err) {
        console.error('[Check-out Error]', err);
        return res.status(500).json({ success: false, error: 'Failed to record check-out' });
    }
}
/**
 * Get Today's Attendance State for a Batch / Institute
 */
async function getAttendanceSummary(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const batchId = req.query.batchId;
        const subjectId = req.query.subjectId;
        const dateQuery = req.query.date;
        // Authoritative date rule: For normal staff attendance workflow, the date is strictly TODAY
        // derived in the institute's timezone (Asia/Kolkata). Client-side historical or future overrides are ignored.
        const todayLocalDate = getInstituteLocalDate(new Date(), 'Asia/Kolkata');
        const targetDate = req.user?.role === 'STAFF' ? todayLocalDate : dateQuery ? new Date(dateQuery) : todayLocalDate;
        // Staff authorization check on batchId & subjectId
        if (req.user?.role === 'STAFF') {
            if (batchId) {
                const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, batchId, prisma_js_1.prisma);
                if (!isAssigned) {
                    return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to access this batch' });
                }
            }
            if (batchId && subjectId) {
                const isAssignedSub = await (0, student_authorization_service_js_1.isStaffAssignedToBatchSubject)(req, batchId, subjectId, prisma_js_1.prisma);
                if (!isAssignedSub) {
                    return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to access this subject' });
                }
            }
        }
        const scope = await (0, student_authorization_service_js_1.getAuthorizedStudentScope)(req, prisma_js_1.prisma, { batchId, subjectId });
        const andConditions = [
            { instituteId, status: 'ACTIVE' },
            scope.whereClause,
        ];
        if (req.user?.role !== 'STAFF') {
            if (batchId) {
                andConditions.push({
                    enrollments: { some: { batchId, isActive: true } },
                });
            }
            if (subjectId) {
                andConditions.push({
                    enrollments: { some: { batchId: batchId || undefined, subjectId, isActive: true } },
                });
            }
        }
        const studentWhere = { AND: andConditions };
        const [students, events] = await Promise.all([
            prisma_js_1.prisma.student.findMany({
                where: studentWhere,
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    admissionNumber: true,
                    photoUrl: true,
                    enrollments: {
                        where: { isActive: true },
                        select: {
                            batch: { select: { id: true, name: true } },
                        },
                    },
                },
                orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
            }),
            prisma_js_1.prisma.attendanceEvent.findMany({
                where: {
                    instituteId,
                    eventDate: targetDate,
                    ...(batchId ? { batchId } : {}),
                },
                select: {
                    id: true,
                    studentId: true,
                    eventType: true,
                    eventTime: true,
                    method: true,
                    batchId: true,
                    isLate: true,
                    markedBy: { select: { fullName: true } },
                },
            }),
        ]);
        const timeFormatter = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
        // Map each student's current status for today
        const studentStatusMap = students.map((student) => {
            const studentEvents = events.filter((e) => e.studentId === student.id);
            const checkInEvent = studentEvents.find((e) => e.eventType === 'CHECK_IN');
            const checkOutEvent = studentEvents.find((e) => e.eventType === 'CHECK_OUT');
            let status = 'ABSENT';
            if (checkInEvent && !checkOutEvent) {
                status = 'CHECKED_IN';
            }
            else if (checkInEvent && checkOutEvent) {
                status = 'CHECKED_OUT';
            }
            return {
                student: {
                    id: student.id,
                    name: `${student.firstName} ${student.lastName}`,
                    admissionNumber: student.admissionNumber,
                    photoUrl: student.photoUrl,
                    batchName: student.enrollments[0]?.batch?.name || 'Unassigned',
                },
                status,
                isLate: checkInEvent?.isLate || false,
                checkInTime: checkInEvent?.eventTime || null,
                checkInTimeFormatted: checkInEvent ? timeFormatter.format(checkInEvent.eventTime) : null,
                checkOutTime: checkOutEvent?.eventTime || null,
                checkOutTimeFormatted: checkOutEvent ? timeFormatter.format(checkOutEvent.eventTime) : null,
                method: checkInEvent?.method || null,
                markedBy: checkInEvent?.markedBy?.fullName || null,
                eventId: checkInEvent?.id || null,
            };
        });
        const totalStudents = students.length;
        const checkedInCount = studentStatusMap.filter((s) => s.status === 'CHECKED_IN').length;
        const checkedOutCount = studentStatusMap.filter((s) => s.status === 'CHECKED_OUT').length;
        const presentTotal = checkedInCount + checkedOutCount;
        const lateCount = studentStatusMap.filter((s) => s.isLate).length;
        const absentCount = totalStudents - presentTotal;
        const formattedDate = new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            weekday: 'long',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }).format(new Date());
        return res.json({
            success: true,
            data: {
                date: targetDate.toISOString().split('T')[0],
                formattedDate,
                timeZone: 'Asia/Kolkata',
                isTodayOnly: true,
                counts: {
                    totalStudents,
                    presentTotal,
                    checkedInCount,
                    checkedOutCount,
                    lateCount,
                    absentCount,
                },
                records: studentStatusMap,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to fetch attendance summary' });
    }
}
/**
 * Attendance Reports with Filters (Date range, Batch-wise, Student-wise, Missing Checkouts)
 */
async function getAttendanceReports(req, res) {
    try {
        const instituteId = req.instituteId;
        if (!instituteId)
            return res.status(400).json({ success: false, error: 'Institute context required' });
        const startDateStr = req.query.startDate;
        const endDateStr = req.query.endDate;
        const batchId = req.query.batchId;
        const subjectId = req.query.subjectId;
        const reportType = req.query.type; // 'daily' | 'weekly' | 'monthly' | 'missing_checkout' | 'late'
        // Staff validation for reports
        if (req.user?.role === 'STAFF') {
            if (batchId) {
                const isAssigned = await (0, student_authorization_service_js_1.isStaffAssignedToBatch)(req, batchId, prisma_js_1.prisma);
                if (!isAssigned) {
                    return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to access reports for this batch' });
                }
            }
            if (batchId && subjectId) {
                const isAssignedSub = await (0, student_authorization_service_js_1.isStaffAssignedToBatchSubject)(req, batchId, subjectId, prisma_js_1.prisma);
                if (!isAssignedSub) {
                    return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to access reports for this subject' });
                }
            }
        }
        const now = new Date();
        let startDate = startDateStr ? new Date(startDateStr) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        let endDate = endDateStr ? new Date(endDateStr) : now;
        const scope = await (0, student_authorization_service_js_1.getAuthorizedStudentScope)(req, prisma_js_1.prisma, { batchId, subjectId });
        const where = {
            instituteId,
            student: scope.whereClause,
            eventDate: {
                gte: getInstituteLocalDate(startDate),
                lte: getInstituteLocalDate(endDate),
            },
        };
        if (batchId)
            where.batchId = batchId;
        if (reportType === 'late')
            where.isLate = true;
        const events = await prisma_js_1.prisma.attendanceEvent.findMany({
            where,
            orderBy: [{ eventDate: 'desc' }, { eventTime: 'desc' }],
            include: {
                student: {
                    select: { id: true, firstName: true, lastName: true, admissionNumber: true },
                },
                batch: { select: { id: true, name: true } },
                markedBy: { select: { id: true, fullName: true } },
            },
        });
        return res.json({
            success: true,
            data: {
                totalEvents: events.length,
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                events,
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to generate attendance report' });
    }
}
/**
 * Generate Student QR Pass
 */
async function getStudentQrPass(req, res) {
    try {
        const instituteId = req.instituteId;
        const { studentId } = req.params;
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to view this student QR pass' });
        }
        const student = await prisma_js_1.prisma.student.findFirst({
            where: { id: studentId, instituteId },
            include: {
                institute: { select: { id: true, name: true, code: true } },
                enrollments: { include: { batch: true } },
            },
        });
        if (!student) {
            return res.status(404).json({ success: false, error: 'Student not found in this institute' });
        }
        if (!student.instituteId || !student.institute) {
            return res.status(400).json({ success: false, error: 'Campus QR passes are only available for offline branch students.' });
        }
        const qrToken = generateQrPassToken(student.id, student.instituteId);
        return res.json({
            success: true,
            data: {
                qrToken,
                student: {
                    id: student.id,
                    fullName: `${student.firstName} ${student.lastName}`,
                    admissionNumber: student.admissionNumber,
                    instituteName: student.institute.name,
                    batchName: student.enrollments[0]?.batch?.name || 'Unassigned',
                },
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to generate QR pass' });
    }
}
/**
 * Validate Scanned QR Token
 */
async function validateScannedQr(req, res) {
    try {
        const callerInstituteId = req.instituteId;
        const { qrToken } = req.body;
        if (!qrToken) {
            return res.status(400).json({ success: false, error: 'qrToken is required' });
        }
        const verification = verifyQrPassToken(qrToken);
        if (!verification.valid || !verification.studentId || !verification.instituteId) {
            return res.status(400).json({ success: false, error: 'Invalid or forged QR attendance pass' });
        }
        if (callerInstituteId && verification.instituteId !== callerInstituteId) {
            return res.status(403).json({ success: false, error: 'This QR pass belongs to another institute' });
        }
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, verification.studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to scan QR for this student' });
        }
        const student = await prisma_js_1.prisma.student.findUnique({
            where: { id: verification.studentId },
            include: {
                enrollments: { where: { isActive: true }, include: { batch: true } },
            },
        });
        if (!student || student.status !== 'ACTIVE') {
            return res.status(400).json({ success: false, error: 'Student account is inactive or not found' });
        }
        // Check current state for today
        const today = getInstituteLocalDate();
        const todaysEvents = await prisma_js_1.prisma.attendanceEvent.findMany({
            where: { studentId: student.id, eventDate: today },
            orderBy: { eventTime: 'desc' },
        });
        const isCheckedIn = todaysEvents.some((e) => e.eventType === 'CHECK_IN');
        const isCheckedOut = todaysEvents.some((e) => e.eventType === 'CHECK_OUT');
        const recommendedAction = !isCheckedIn ? 'CHECK_IN' : !isCheckedOut ? 'CHECK_OUT' : 'SESSION_COMPLETED';
        return res.json({
            success: true,
            data: {
                student: {
                    id: student.id,
                    name: `${student.firstName} ${student.lastName}`,
                    admissionNumber: student.admissionNumber,
                    batchName: student.enrollments[0]?.batch?.name || 'Unassigned',
                    batchId: student.enrollments[0]?.batchId,
                },
                todayStatus: {
                    isCheckedIn,
                    isCheckedOut,
                    recommendedAction,
                },
            },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to validate QR token' });
    }
}
/**
 * Correct Attendance Event
 */
async function correctAttendanceEvent(req, res) {
    try {
        const instituteId = req.instituteId;
        const { eventId } = req.params;
        const parse = exports.correctionSchema.safeParse(req.body);
        if (!parse.success) {
            return res.status(400).json({ success: false, error: parse.error.errors[0]?.message });
        }
        const { remarks, isLate, reason } = parse.data;
        const existing = await prisma_js_1.prisma.attendanceEvent.findFirst({
            where: { id: eventId, instituteId },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Attendance record not found' });
        }
        // Verify caller is authorized to correct attendance for this student
        const isAuth = await (0, student_authorization_service_js_1.isStudentAuthorized)(req, existing.studentId, prisma_js_1.prisma);
        if (!isAuth) {
            return res.status(403).json({ success: false, error: 'Forbidden: You are not authorized to correct attendance for this student' });
        }
        const updated = await prisma_js_1.prisma.$transaction(async (tx) => {
            const event = await tx.attendanceEvent.update({
                where: { id: eventId },
                data: {
                    ...(remarks !== undefined && { remarks }),
                    ...(isLate !== undefined && { isLate }),
                    isCorrected: true,
                    correctionNote: reason,
                },
            });
            // Audit Log for manual correction
            await tx.auditLog.create({
                data: {
                    instituteId,
                    userId: req.user.userId,
                    action: 'ATTENDANCE_CORRECTED',
                    entityType: 'AttendanceEvent',
                    entityId: eventId,
                    oldValues: { isLate: existing.isLate, remarks: existing.remarks },
                    newValues: { isLate, remarks, reason },
                },
            });
            return event;
        });
        return res.json({
            success: true,
            message: 'Attendance record corrected successfully',
            data: { event: updated },
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: 'Failed to correct attendance record' });
    }
}
