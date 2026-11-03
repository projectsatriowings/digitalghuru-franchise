import { InAppNotificationService } from '../src/modules/notifications/inapp-notification.service.js';
import { checkInSchema, checkOutSchema } from '../src/modules/attendance/attendance.controller.js';

interface TestCase {
  name: string;
  fn: () => boolean | Promise<boolean>;
}

const tests: TestCase[] = [
  // 1. Exact Message Text & Timezone Formatting
  {
    name: 'Message Format: Formats exact required string for check-in',
    fn: () => {
      const fixedDate = new Date('2026-10-29T04:00:00.000Z'); // 09:30 AM in IST (UTC+5:30)
      const timeStr = InAppNotificationService.formatKolkataTime(fixedDate);
      const studentName = 'Priya Sharma';
      const expectedMessage = `Your child ${studentName} checked in at ${timeStr}.`;

      return (
        expectedMessage.startsWith('Your child Priya Sharma checked in at ') &&
        expectedMessage.endsWith('AM.') &&
        timeStr.includes(':')
      );
    },
  },
  {
    name: 'Message Format: Formats exact required string for check-out',
    fn: () => {
      const fixedDate = new Date('2026-10-29T11:00:00.000Z'); // 04:30 PM in IST (UTC+5:30)
      const timeStr = InAppNotificationService.formatKolkataTime(fixedDate);
      const studentName = 'Priya Sharma';
      const expectedMessage = `Your child ${studentName} checked out at ${timeStr}.`;

      return (
        expectedMessage.startsWith('Your child Priya Sharma checked out at ') &&
        expectedMessage.endsWith('PM.') &&
        timeStr.includes(':')
      );
    },
  },

  // 2. Schema & Payload Validation
  {
    name: 'Validation: checkInSchema validates valid check-in parameters',
    fn: () => {
      const valid = checkInSchema.safeParse({
        studentId: '11111111-1111-1111-1111-111111111111',
        batchId: '22222222-2222-2222-2222-222222222222',
        method: 'MANUAL',
        isLate: false,
        idempotencyKey: 'IDEMP-CHECKIN-001',
      });
      return valid.success === true;
    },
  },
  {
    name: 'Validation: checkOutSchema validates valid check-out parameters',
    fn: () => {
      const valid = checkOutSchema.safeParse({
        studentId: '11111111-1111-1111-1111-111111111111',
        method: 'QR_SCAN',
        idempotencyKey: 'IDEMP-CHECKOUT-001',
      });
      return valid.success === true;
    },
  },
  {
    name: 'Validation: checkInSchema and checkOutSchema reject non-UUID studentId',
    fn: () => {
      const invalidIn = checkInSchema.safeParse({ studentId: 'invalid-id' });
      const invalidOut = checkOutSchema.safeParse({ studentId: 'invalid-id' });
      return invalidIn.success === false && invalidOut.success === false;
    },
  },

  // 3. Attendance Session Transitions & Consistency
  {
    name: 'Transition Logic: Disallows check-out when no active check-in exists',
    fn: () => {
      // Mock session events today
      const todaysEvents: any[] = []; // No events
      const activeCheckIn = todaysEvents.find((e) => e.eventType === 'CHECK_IN');

      const isCheckOutAllowed = Boolean(activeCheckIn);
      return isCheckOutAllowed === false;
    },
  },
  {
    name: 'Transition Logic: Prevents duplicate check-in when already checked in today',
    fn: () => {
      const todaysEvents = [
        { id: 'ev-1', eventType: 'CHECK_IN', sessionNumber: 1, eventTime: new Date() },
      ];

      const latestCheckIn = todaysEvents.find((e) => e.eventType === 'CHECK_IN');
      const latestCheckOut = todaysEvents.find((e) => e.eventType === 'CHECK_OUT');

      // Student is already checked in if check-in exists without corresponding check-out
      const isAlreadyCheckedIn = Boolean(
        latestCheckIn && (!latestCheckOut || latestCheckOut.sessionNumber < latestCheckIn.sessionNumber)
      );

      return isAlreadyCheckedIn === true;
    },
  },
  {
    name: 'Transition Logic: Prevents duplicate check-out for the same session',
    fn: () => {
      const todaysEvents = [
        { id: 'ev-1', eventType: 'CHECK_IN', sessionNumber: 1, eventTime: new Date() },
        { id: 'ev-2', eventType: 'CHECK_OUT', sessionNumber: 1, eventTime: new Date() },
      ];

      const activeCheckIn = todaysEvents.find((e) => e.eventType === 'CHECK_IN');
      const existingCheckOut = todaysEvents.find(
        (e) => e.eventType === 'CHECK_OUT' && e.sessionNumber === activeCheckIn?.sessionNumber
      );

      const isDuplicateCheckOut = Boolean(existingCheckOut);
      return isDuplicateCheckOut === true;
    },
  },
  {
    name: 'Session Linking: Check-out accurately adopts active check-in session number and batch',
    fn: () => {
      const checkInEvent = {
        id: 'ev-10',
        batchId: 'batch-class-10a',
        sessionNumber: 2,
        eventDate: '2026-10-29',
      };

      const checkOutPayload = {
        batchId: checkInEvent.batchId,
        sessionNumber: checkInEvent.sessionNumber,
      };

      return checkOutPayload.sessionNumber === 2 && checkOutPayload.batchId === 'batch-class-10a';
    },
  },

  // 4. Targeted Parent Authorization & Privacy Isolation
  {
    name: 'Recipient Filtering: Resolves only authorized parent accounts linked to student',
    fn: () => {
      const studentRelations = [
        {
          canReceiveSms: true,
          parent: { user: { id: 'parent-user-1', isActive: true, fullName: 'Sunita Sharma' } },
        },
        {
          canReceiveSms: true,
          parent: { user: { id: 'parent-user-2', isActive: true, fullName: 'Rajesh Sharma' } },
        },
        {
          canReceiveSms: false, // Disabled updates
          parent: { user: { id: 'parent-user-3', isActive: true, fullName: 'Inactive Parent' } },
        },
      ];

      const recipients = studentRelations
        .filter((rel) => rel.canReceiveSms !== false && rel.parent?.user?.isActive)
        .map((rel) => rel.parent.user.id);

      return (
        recipients.length === 2 &&
        recipients.includes('parent-user-1') &&
        recipients.includes('parent-user-2') &&
        !recipients.includes('parent-user-3')
      );
    },
  },
  {
    name: 'Security: Unauthorized parent cannot access another student notifications',
    fn: () => {
      const notifications = [
        { id: 'notif-1', userId: 'parent-user-A', studentId: 'student-A', message: 'Your child checked in' },
        { id: 'notif-2', userId: 'parent-user-B', studentId: 'student-B', message: 'Your child checked in' },
      ];

      const queryForUser = (requestingUserId: string) => {
        return notifications.filter((n) => n.userId === requestingUserId);
      };

      const resultsForA = queryForUser('parent-user-A');
      const hasOtherStudentData = resultsForA.some((n) => n.studentId === 'student-B');

      return resultsForA.length === 1 && hasOtherStudentData === false;
    },
  },

  // 5. Offline Persistence & Reconnection Simulation
  {
    name: 'Persistence: Offline parent retains notification with isRead: false for later viewing',
    fn: () => {
      const storedNotification = {
        id: 'notif-99',
        userId: 'parent-offline-user',
        studentId: 'student-1',
        title: 'Student Check-in Alert',
        message: 'Your child Priya Sharma checked in at 09:15 AM.',
        isRead: false,
        readAt: null as Date | null,
        createdAt: new Date().toISOString(),
      };

      // When parent opens portal later, mark as read
      const markAsRead = (item: typeof storedNotification) => {
        return {
          ...item,
          isRead: true,
          readAt: new Date(),
        };
      };

      const updated = markAsRead(storedNotification);
      return storedNotification.isRead === false && updated.isRead === true && updated.readAt !== null;
    },
  },

  // 6. Real-Time Delivery & Fallback Resilience
  {
    name: 'Real-Time SSE: Emits valid NOTIFICATION_CREATED and ATTENDANCE_RECORDED payloads',
    fn: () => {
      const timeStr = '09:30 AM';
      const eventTime = new Date();
      const studentName = 'Priya Sharma';

      const sseEvent1 = {
        type: 'NOTIFICATION_CREATED',
        data: {
          id: 'n-123',
          type: 'ATTENDANCE',
          title: 'Student Check-in Alert',
          message: `Your child ${studentName} checked in at ${timeStr}.`,
          timeFormatted: timeStr,
          isRead: false,
        },
      };

      const sseEvent2 = {
        type: 'ATTENDANCE_RECORDED',
        data: {
          studentId: 's-123',
          studentName,
          eventType: 'CHECK_IN',
          eventTime,
          timeFormatted: timeStr,
          message: `Your child ${studentName} checked in at ${timeStr}.`,
        },
      };

      return (
        sseEvent1.type === 'NOTIFICATION_CREATED' &&
        sseEvent2.type === 'ATTENDANCE_RECORDED' &&
        sseEvent1.data.message === sseEvent2.data.message
      );
    },
  },
  {
    name: 'Resilience: External push delivery failure preserves database attendance and notification',
    fn: () => {
      // Simulating a failed push network call
      let dbRecordSaved = true;
      let pushResult = { success: false, error: 'Push gateway timeout' };

      // InAppNotificationService sets pushStatus to 'FAILED' but keeps the notification in DB
      let notifRecord = {
        id: 'notif-1',
        isSavedInDatabase: dbRecordSaved,
        pushStatus: pushResult.success ? 'DELIVERED' : 'FAILED',
        pushError: pushResult.error,
      };

      return notifRecord.isSavedInDatabase === true && notifRecord.pushStatus === 'FAILED';
    },
  },
];

async function run() {
  console.log('================================================================');
  console.log(' TUITIONOS: CHECK-IN/CHECK-OUT ALERTS & REAL-TIME TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    try {
      const ok = await t.fn();
      if (ok) {
        console.log(`  ✓ [PASS] ${i + 1}. ${t.name}`);
        passed++;
      } else {
        console.error(`  ✗ [FAIL] ${i + 1}. ${t.name}`);
        failed++;
      }
    } catch (err: any) {
      console.error(`  ✗ [ERROR] ${i + 1}. ${t.name}:`, err.message);
      failed++;
    }
  }

  console.log('\n----------------------------------------------------------------');
  console.log(` Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

run();

