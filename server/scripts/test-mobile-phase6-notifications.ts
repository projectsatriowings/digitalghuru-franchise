import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import app from '../src/index.js';
import { prisma } from '../src/prisma.js';
import { InAppNotificationService } from '../src/modules/notifications/inapp-notification.service.js';
import { NotificationService } from '../src/modules/notifications/notification.service.js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

let server: http.Server;
let port: number;
let baseUrl: string;

function request(urlPath: string, options: any = {}): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath.startsWith('http') ? urlPath : `${baseUrl}${urlPath}`);
    const bodyStr = options.body != null ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : null;

    const reqOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        ...(options.headers || {}),
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode || 200, data: json });
        } catch {
          resolve({ status: res.statusCode || 200, data });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function runNotificationsVerification() {
  console.log('================================================================');
  console.log('Digital Guru Franchise — Phase 6: Push Notifications & Deep-Link');
  console.log('================================================================\n');

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      port = addr.port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      console.log(`[Test Server] Started on ${baseUrl}\n`);
      resolve();
    });
  });

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition: boolean, testName: string, details?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      testsPassed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error('       Details:', details);
      testsFailed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // 1. AUTHENTICATION (STUDENT, PARENT, TEACHER)
    // -------------------------------------------------------------
    console.log('--- 1. Testing Role Logins for Push Registration ---');

    // Student Login
    const stuLogin = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'student@apexacademy.com', password: 'Password#123', role: 'STUDENT' },
    });
    assert(stuLogin.status === 200 && stuLogin.data?.success, 'Student login returns 200 Success');
    const studentToken = stuLogin.data?.data?.accessToken;
    const studentUserId = stuLogin.data?.data?.user?.id;
    assert(!!studentToken && !!studentUserId, 'Student access token and userId obtained');

    // Parent Login
    const parLogin = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'parent@apex.example.com', password: 'Password#123', role: 'PARENT' },
    });
    assert(parLogin.status === 200 && parLogin.data?.success, 'Parent login returns 200 Success');
    const parentToken = parLogin.data?.data?.accessToken;
    const parentUserId = parLogin.data?.data?.user?.id;
    assert(!!parentToken && !!parentUserId, 'Parent access token and userId obtained');

    // Teacher Login
    const teachLogin = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'teacher@apex.example.com', password: 'Password#123', role: 'STAFF' },
    });
    assert(teachLogin.status === 200 && teachLogin.data?.success, 'Teacher login returns 200 Success');
    const teacherToken = teachLogin.data?.data?.accessToken;
    const teacherUserId = teachLogin.data?.data?.user?.id;
    assert(!!teacherToken && !!teacherUserId, 'Teacher access token and userId obtained');

    // -------------------------------------------------------------
    // 2. DEVICE REGISTRATION & TOKEN LIFECYCLE
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Device Registration & Push Token Lifecycle ---');

    const testToken1 = `ExponentPushToken[TEST_STU_DEV_1_${Date.now()}]`;
    const testToken2 = `ExponentPushToken[TEST_STU_DEV_2_${Date.now()}]`;

    // Register Token 1 for Student
    const regRes1 = await request('/notifications/push-token', {
      method: 'POST',
      token: studentToken,
      body: {
        token: testToken1,
        platform: 'android',
        deviceInfo: 'Pixel 8 Pro (Android 14)',
      },
    });
    assert(regRes1.status === 200 && regRes1.data?.success, 'Register device push token returns 200 Success');

    // Verify token exists in database linked to student user
    const dbToken1 = await prisma.devicePushToken.findUnique({ where: { token: testToken1 } });
    assert(!!dbToken1 && dbToken1.userId === studentUserId, 'Device token 1 recorded in DB for student user');
    assert(dbToken1?.platform === 'android', 'Device token platform recorded as android');

    // Register Token 2 (Multiple devices for one user)
    const regRes2 = await request('/notifications/push-token', {
      method: 'POST',
      token: studentToken,
      body: {
        token: testToken2,
        platform: 'ios',
        deviceInfo: 'iPad Air 5 (iPadOS 17)',
      },
    });
    assert(regRes2.status === 200 && regRes2.data?.success, 'Register second device token returns 200 Success');

    // Verify both tokens exist for student
    const studentTokens = await prisma.devicePushToken.findMany({ where: { userId: studentUserId } });
    assert(studentTokens.length >= 2, `User has multiple active devices (${studentTokens.length} active)`);

    // Duplicate Token Prevention (Updating existing token record)
    const updateRes = await request('/notifications/push-token', {
      method: 'POST',
      token: studentToken,
      body: {
        token: testToken1,
        platform: 'android',
        deviceInfo: 'Pixel 8 Pro Updated',
      },
    });
    assert(updateRes.status === 200, 'Re-registering existing token updates record without error');
    const updatedToken = await prisma.devicePushToken.findUnique({ where: { token: testToken1 } });
    assert(updatedToken?.deviceInfo === 'Pixel 8 Pro Updated', 'Token record metadata updated via upsert');

    // Parent Push Token Registration
    const parentPushToken = `ExponentPushToken[TEST_PAR_DEV_${Date.now()}]`;
    const regParRes = await request('/notifications/push-token', {
      method: 'POST',
      token: parentToken,
      body: {
        token: parentPushToken,
        platform: 'ios',
        deviceInfo: 'iPhone 15 (iOS 17.5)',
      },
    });
    assert(regParRes.status === 200, 'Parent push token registered successfully');

    // Teacher Push Token Registration
    const teacherPushToken = `ExponentPushToken[TEST_TEACH_DEV_${Date.now()}]`;
    const regTeachRes = await request('/notifications/push-token', {
      method: 'POST',
      token: teacherToken,
      body: {
        token: teacherPushToken,
        platform: 'android',
        deviceInfo: 'Samsung Galaxy Tab S9',
      },
    });
    assert(regTeachRes.status === 200, 'Teacher push token registered successfully');

    // -------------------------------------------------------------
    // 3. ROLE-BASED NOTIFICATION DELIVERY
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Role-Based Notification Retrieval ---');

    // Student Notifications
    const stuNotifsRes = await request('/notifications', { token: studentToken });
    assert(stuNotifsRes.status === 200 && stuNotifsRes.data?.success, 'Student get notifications returns 200');
    const stuNotifs = stuNotifsRes.data?.data?.notifications || [];
    assert(Array.isArray(stuNotifs), 'Student notifications returned as array');

    // Parent Notifications
    const parNotifsRes = await request('/notifications', { token: parentToken });
    assert(parNotifsRes.status === 200 && parNotifsRes.data?.success, 'Parent get notifications returns 200');
    const parNotifs = parNotifsRes.data?.data?.notifications || [];
    assert(Array.isArray(parNotifs), 'Parent notifications returned as array');

    // Teacher Notifications
    const teachNotifsRes = await request('/notifications', { token: teacherToken });
    assert(teachNotifsRes.status === 200 && teachNotifsRes.data?.success, 'Teacher get notifications returns 200');
    const teachNotifs = teachNotifsRes.data?.data?.notifications || [];
    assert(Array.isArray(teachNotifs), 'Teacher notifications returned as array');

    // -------------------------------------------------------------
    // 4. UNREAD COUNT, MARK READ, AND MARK ALL READ
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Notification Reads and Counts ---');

    // Unread count
    const unreadCountRes = await request('/notifications/unread-count', { token: studentToken });
    assert(unreadCountRes.status === 200 && typeof unreadCountRes.data?.data?.unreadCount === 'number', 'Get unread count returns number');

    // Mark single as read
    if (stuNotifs.length > 0) {
      const targetNotif = stuNotifs[0];
      const markRes = await request(`/notifications/${targetNotif.id}/read`, {
        method: 'PATCH',
        token: studentToken,
      });
      assert(markRes.status === 200 && markRes.data?.success, 'Mark single notification read returns 200');

      // Verify read state in DB
      const dbNotif = await prisma.notification.findUnique({ where: { id: targetNotif.id } });
      assert(dbNotif?.isRead === true, 'Notification isRead is true in database');
    } else {
      console.log('[SKIP] No student notifications to mark single read');
    }

    // Mark all as read
    const markAllRes = await request('/notifications/mark-all-read', {
      method: 'POST',
      token: studentToken,
    });
    assert(markAllRes.status === 200 && markAllRes.data?.success, 'Mark all notifications read returns 200');

    const freshUnread = await request('/notifications/unread-count', { token: studentToken });
    assert(freshUnread.data?.data?.unreadCount === 0, 'Unread count is 0 after mark-all-read');

    // -------------------------------------------------------------
    // 5. ASYNC PUSH DISPATCHER & IDEMPOTENCY
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Push Dispatcher and Idempotency ---');

    const testIdempotencyKey = `TEST_IDEMP_${Date.now()}`;
    const testNotif = await prisma.notification.create({
      data: {
        instituteId: (await prisma.institute.findFirst())?.id || '',
        userId: studentUserId,
        role: 'STUDENT',
        title: 'Push Delivery Test Alert',
        message: 'This is a test notification for Phase 6 push delivery verification.',
        type: 'ACADEMIC',
        entityType: 'HOMEWORK',
        entityId: 'test-hw-id',
        idempotencyKey: testIdempotencyKey,
      },
    });
    assert(!!testNotif.id, 'Test notification created with idempotency key');

    // Dispatch push using InAppNotificationService.dispatchPushForNotification
    await InAppNotificationService.dispatchPushForNotification(testNotif);

    // Verify notification pushStatus updated
    const updatedTestNotif = await prisma.notification.findUnique({ where: { id: testNotif.id } });
    assert(
      updatedTestNotif?.pushStatus === 'DELIVERED',
      `Push dispatcher marked status as DELIVERED (${updatedTestNotif?.pushStatus})`
    );

    // Test Idempotency: Attempting duplicate notification with same key is rejected by DB unique constraint
    let duplicateRejected = false;
    try {
      await prisma.notification.create({
        data: {
          instituteId: testNotif.instituteId,
          userId: studentUserId,
          role: 'STUDENT',
          title: 'Duplicate Push Alert',
          message: 'Duplicate content',
          idempotencyKey: testIdempotencyKey,
        },
      });
    } catch {
      duplicateRejected = true;
    }
    assert(duplicateRejected, 'Duplicate notification with identical idempotencyKey was rejected');

    // Clean up test notification
    await prisma.notification.delete({ where: { id: testNotif.id } }).catch(() => {});

    // -------------------------------------------------------------
    // 6. INVALID TOKEN CLEANUP & RETRY BEHAVIOR
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Dead/Invalid Token Cleanup ---');

    const deadToken = `ExponentPushToken[DEAD_TOKEN_${Date.now()}]`;
    await prisma.devicePushToken.create({
      data: {
        userId: studentUserId,
        token: deadToken,
        platform: 'android',
        deviceInfo: 'Old Abandoned Phone',
      },
    });

    // Mock send push that returns DeviceNotRegistered
    const originalSend = InAppNotificationService.sendPushNotification;
    InAppNotificationService.sendPushNotification = async (token: string) => {
      if (token === deadToken) {
        return { success: false, error: 'DeviceNotRegistered: The device is no longer registered.' };
      }
      return { success: true, status: 'DELIVERED' };
    };

    const cleanupTestNotif = {
      id: 'mock-cleanup-id',
      userId: studentUserId,
      title: 'Cleanup Test',
      message: 'Testing dead token removal',
    };

    await InAppNotificationService.dispatchPushForNotification(cleanupTestNotif);

    // Check if dead token was automatically removed
    const deadTokenCheck = await prisma.devicePushToken.findUnique({ where: { token: deadToken } });
    assert(deadTokenCheck === null, 'Dead token with DeviceNotRegistered was automatically deleted from DB');

    // Restore original sendPushNotification
    InAppNotificationService.sendPushNotification = originalSend;

    // -------------------------------------------------------------
    // 7. DEEP-LINK TARGET VERIFICATION & SECURITY
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Deep-Link Target Verification & Security ---');

    // Valid target verification (Check existing student / homework)
    const existingHw = await prisma.learningMaterial.findFirst({
      where: { type: 'HOMEWORK' },
      select: { id: true, title: true },
    });

    if (existingHw) {
      const verifyRes = await request(`/notifications/verify-target?entityType=HOMEWORK&entityId=${existingHw.id}`, {
        token: studentToken,
      });
      assert(verifyRes.status === 200 && verifyRes.data?.data?.available === true, 'Verify valid homework target returns available: true');
    } else {
      console.log('[SKIP] No existing homework for verify-target');
    }

    // Invalid target verification (Non-existent entityId)
    const invalidVerifyRes = await request('/notifications/verify-target?entityType=HOMEWORK&entityId=00000000-0000-0000-0000-000000000000', {
      token: studentToken,
    });
    assert(invalidVerifyRes.status === 200 && invalidVerifyRes.data?.data?.available === false, 'Verify non-existent target returns available: false');

    // -------------------------------------------------------------
    // 8. SECURITY & CROSS-USER ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing Security & Cross-User Notification Isolation ---');

    // Cross-user mark read rejection: Student attempts to mark Parent's notification
    if (parNotifs.length > 0) {
      const parentNotifId = parNotifs[0].id;
      const crossMarkRes = await request(`/notifications/${parentNotifId}/read`, {
        method: 'PATCH',
        token: studentToken, // Student token
      });
      assert(crossMarkRes.status === 404, `Cross-user mark read was blocked with 404 (${crossMarkRes.status})`);
    } else {
      console.log('[SKIP] No parent notifications for cross-user test');
    }

    // Unauthenticated access rejection
    const unauthRes = await request('/notifications');
    assert(unauthRes.status === 401, 'Unauthenticated access to /notifications is blocked with 401');

    const unauthPushRes = await request('/notifications/push-token', {
      method: 'POST',
      body: { token: 'unauth-token' },
    });
    assert(unauthPushRes.status === 401, 'Unauthenticated access to /notifications/push-token is blocked with 401');

    // -------------------------------------------------------------
    // 9. SMS SEPARATION & NON-REGRESSION
    // -------------------------------------------------------------
    console.log('\n--- 9. Testing SMS Notification Workflow Separation ---');

    // Verify SMS notifications can still be queued and queried
    const existingAttEvent = await prisma.attendanceEvent.findFirst({
      select: { id: true, studentId: true, instituteId: true },
    });

    if (existingAttEvent) {
      const smsQueueResult = await NotificationService.queueAttendanceNotification({
        attendanceEventId: existingAttEvent.id,
        studentId: existingAttEvent.studentId,
        instituteId: existingAttEvent.instituteId,
        eventType: 'CHECK_IN',
        eventTime: new Date(),
      });
      assert(Array.isArray(smsQueueResult), 'queueAttendanceNotification creates independent SmsNotification records');
    } else {
      console.log('[SKIP] No attendanceEvent found for SMS test');
    }

    // -------------------------------------------------------------
    // 10. TOKEN CLEANUP ON LOGOUT
    // -------------------------------------------------------------
    console.log('\n--- 10. Testing Token Removal on Logout ---');

    const deleteRes = await request('/notifications/push-token', {
      method: 'DELETE',
      token: studentToken,
      body: { token: testToken1 },
    });
    assert(deleteRes.status === 200 && deleteRes.data?.success, 'Remove push token on logout returns 200 Success');

    const checkToken1 = await prisma.devicePushToken.findUnique({ where: { token: testToken1 } });
    assert(checkToken1 === null, 'Push token 1 successfully removed from DB');

    // Clean up other test tokens
    await prisma.devicePushToken.deleteMany({
      where: { token: { in: [testToken2, parentPushToken, teacherPushToken] } },
    });
  } catch (err: any) {
    console.error('[Test Execution Error]', err);
    testsFailed++;
  } finally {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      console.log('\n[Test Server] Stopped.');
    }

    console.log('\n================================================================');
    console.log(`Phase 6 Tests Completed: ${testsPassed} Passed, ${testsFailed} Failed`);
    console.log('================================================================\n');

    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

runNotificationsVerification();
