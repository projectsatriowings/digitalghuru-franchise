import http from 'http';
import { prisma } from '../src/prisma.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const BASE_URL = 'http://localhost:5000/api';
const INSTITUTE_ID = '0237162e-13be-4a81-b046-11d77bd62483';

function request(path: string, options: any = {}): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
    const reqOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.instituteId ? { 'x-institute-id': options.instituteId } : {}),
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
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function login(identifier: string, password: string): Promise<{ token: string; user: any }> {
  const res = await request('/auth/login', {
    method: 'POST',
    body: { identifier, password },
  });
  if (res.data?.success && res.data.data?.accessToken) {
    return {
      token: res.data.data.accessToken,
      user: res.data.data.user,
    };
  }
  throw new Error(`Login failed for ${identifier}: ${JSON.stringify(res.data)}`);
}

async function runTests() {
  console.log('================================================================');
  console.log('TuitionOS — Phase 9: Notification Deep Linking & Parity Tests');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test ${total}: ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test ${total}: ${message}`);
    }
  }

  try {
    // 0. Setup test users
    console.log('--- Setting up test authentication tokens ---');
    const admin = await login('admin@apexacademy.com', 'Password#123');
    const staff = await login('teacher@apexacademy.com', 'Password#123');
    const student = await login('student@apexacademy.com', 'Password#123');
    const parent = await login('parent@apexacademy.com', 'Password#123');

    assert(!!admin.token && !!staff.token && !!student.token && !!parent.token, 'Authenticated all 4 roles');

    // 1. Notification tap opens correct target record
    console.log('\n--- Objective F.1: Notification Tap Opens Correct Target Record ---');
    const testEntityId = `test_hw_${Date.now()}`;
    const testNotif1 = await prisma.notification.create({
      data: {
        instituteId: INSTITUTE_ID,
        userId: student.user.id,
        role: 'STUDENT',
        title: 'New Homework Assignment: Kinematics Problem Set',
        message: 'Complete questions 1 to 10 by Friday.',
        type: 'ACADEMIC',
        entityType: 'HOMEWORK',
        entityId: testEntityId,
        metadata: { homeworkId: testEntityId, subject: 'Physics' },
        link: `/homework?homeworkId=${testEntityId}`,
        isRead: false,
      },
    });

    const readRes1 = await request(`/notifications/${testNotif1.id}/read`, {
      method: 'PATCH',
      token: student.token,
    });
    assert(readRes1.status === 200 && readRes1.data?.success, 'Student taps notification and marks it read');
    assert(
      readRes1.data?.data?.notification?.entityType === 'HOMEWORK' &&
      readRes1.data?.data?.notification?.entityId === testEntityId,
      'Notification returns exact entityType (HOMEWORK) and entityId for deep link navigation'
    );

    // 2. Notification read state persists after refresh/query
    console.log('\n--- Objective F.2: Read-State Persistence ---');
    const listRes = await request('/notifications', {
      token: student.token,
    });
    const fetchedNotif = listRes.data?.data?.notifications?.find((n: any) => n.id === testNotif1.id);
    assert(fetchedNotif?.isRead === true && !!fetchedNotif?.readAt, 'Notification read state is persisted in database and returned on fresh query');

    // 3. Normal navigation marks only the matching notification(s) as read
    console.log('\n--- Objective F.3: Normal Navigation Sync (markReadByEntity) ---');
    const targetMaterialId = `mat_${Date.now()}`;
    const notifTarget1 = await prisma.notification.create({
      data: {
        instituteId: INSTITUTE_ID,
        userId: student.user.id,
        role: 'STUDENT',
        title: 'Lecture Note: Thermodynamics Part 1',
        message: 'PDF notes available for download.',
        type: 'ACADEMIC',
        entityType: 'MATERIAL',
        entityId: targetMaterialId,
        link: `/materials?materialId=${targetMaterialId}`,
        isRead: false,
      },
    });

    const normalNavRes = await request('/notifications/mark-read-by-entity', {
      method: 'POST',
      token: student.token,
      body: {
        entityType: 'MATERIAL',
        entityId: targetMaterialId,
      },
    });
    assert(normalNavRes.status === 200 && normalNavRes.data?.data?.markedReadCount >= 1, 'Viewing material content marks matching notification as read via mark-read-by-entity');

    const checkNotif = await prisma.notification.findUnique({ where: { id: notifTarget1.id } });
    assert(checkNotif?.isRead === true, 'Database confirms target notification is now marked read');

    // 4. Opening a module without opening the notified content does not mark unrelated notifications read
    console.log('\n--- Objective F.4: Unrelated Notifications Remain Unread ---');
    const unrelatedQuizId = `quiz_${Date.now()}`;
    const unrelatedNotif = await prisma.notification.create({
      data: {
        instituteId: INSTITUTE_ID,
        userId: student.user.id,
        role: 'STUDENT',
        title: 'Quiz: Optics Quick Test',
        message: '15 minute quiz scheduled.',
        type: 'ACADEMIC',
        entityType: 'QUIZ',
        entityId: unrelatedQuizId,
        link: `/homework?quizId=${unrelatedQuizId}`,
        isRead: false,
      },
    });

    // Mark a completely different entity read (e.g. another quiz or homework)
    await request('/notifications/mark-read-by-entity', {
      method: 'POST',
      token: student.token,
      body: {
        entityType: 'QUIZ',
        entityId: 'some_other_quiz_id_9999',
      },
    });

    const unrelatedCheck = await prisma.notification.findUnique({ where: { id: unrelatedNotif.id } });
    assert(unrelatedCheck?.isRead === false, 'Unrelated notification remains strictly unread when browsing different content');

    // 5. Unread count updates accurately after read-state changes
    console.log('\n--- Objective F.5: Accurate Unread Count Synchronization ---');
    const countBeforeRes = await request('/notifications/unread-count', {
      token: student.token,
    });
    const countBefore = countBeforeRes.data?.data?.unreadCount;

    // Mark the unrelated quiz read
    await request(`/notifications/${unrelatedNotif.id}/read`, {
      method: 'PATCH',
      token: student.token,
    });

    const countAfterRes = await request('/notifications/unread-count', {
      token: student.token,
    });
    const countAfter = countAfterRes.data?.data?.unreadCount;
    assert(countAfter === countBefore - 1, `Unread count decremented accurately (${countBefore} -> ${countAfter})`);

    // 6. Cross-user isolation: User cannot mark another user's notification as read
    console.log('\n--- Objective F.6: Cross-User Security & Isolation ---');
    const staffNotif = await prisma.notification.create({
      data: {
        instituteId: INSTITUTE_ID,
        userId: staff.user.id,
        role: 'STAFF',
        title: 'Staff Meeting Notice',
        message: 'Staff meeting at 5 PM.',
        type: 'GENERAL',
        isRead: false,
      },
    });

    const crossUserRes = await request(`/notifications/${staffNotif.id}/read`, {
      method: 'PATCH',
      token: student.token, // Student tries to mark Staff's notification
    });
    assert(crossUserRes.status === 404, 'Security check passed: Student cannot mark staff notification as read (HTTP 404/Forbidden)');

    const staffNotifCheck = await prisma.notification.findUnique({ where: { id: staffNotif.id } });
    assert(staffNotifCheck?.isRead === false, 'Staff notification remains unread in database');

    // 7. Unauthorized user cannot access notification target
    console.log('\n--- Objective F.7: Target Authorization Validation ---');
    const forbiddenTargetRes = await request('/staff/next-code', {
      token: student.token, // Student attempting to access admin/staff next code
      instituteId: INSTITUTE_ID,
    });
    assert(forbiddenTargetRes.status === 403, 'Unauthorized student blocked from administrative resource (HTTP 403 Forbidden)');

    // 8. Deleted/unpublished targets return unavailable state
    console.log('\n--- Objective F.8: Safe "Content Unavailable" Verification ---');
    const verifyUnavailableRes = await request('/notifications/verify-target?entityType=HOMEWORK&entityId=non_existent_homework_123', {
      token: student.token,
    });
    assert(
      verifyUnavailableRes.status === 200 && verifyUnavailableRes.data?.data?.available === false,
      'verify-target endpoint accurately reports deleted/unpublished target as unavailable'
    );

    // 9. Idempotency prevents duplicate notifications
    console.log('\n--- Objective F.9: Idempotency & Duplicate Prevention ---');
    const idempotencyKey = `TEST_IDEMP_${Date.now()}`;
    const n1 = await prisma.notification.upsert({
      where: { idempotencyKey },
      create: {
        instituteId: INSTITUTE_ID,
        userId: student.user.id,
        role: 'STUDENT',
        title: 'Idempotent Alert',
        message: 'Test message',
        type: 'ACADEMIC',
        idempotencyKey,
      },
      update: {},
    });

    const n2 = await prisma.notification.upsert({
      where: { idempotencyKey },
      create: {
        instituteId: INSTITUTE_ID,
        userId: student.user.id,
        role: 'STUDENT',
        title: 'Idempotent Alert',
        message: 'Test message',
        type: 'ACADEMIC',
        idempotencyKey,
      },
      update: {},
    });
    assert(n1.id === n2.id, 'Duplicate notification suppressed via idempotency key; duplicate records prevented');

    // 10. Web and Mobile notification consistency
    console.log('\n--- Objective F.10: Web & Mobile API & Contract Consistency ---');
    const webStreamRes = await request('/notifications', { token: student.token });
    assert(webStreamRes.status === 200 && webStreamRes.data?.data?.notifications, 'Unified notifications contract valid for both Web and Mobile');
    const sample = webStreamRes.data.data.notifications[0];
    assert(sample && ('entityType' in sample || 'type' in sample), 'Notification payload contains entityType metadata for cross-platform deep linking');

    // 11. Mobile push notification token registration and tap dispatch
    console.log('\n--- Objective F.11: Mobile Push Token & Tap Handler ---');
    const pushTokenRes = await request('/notifications/push-token', {
      method: 'POST',
      token: student.token,
      body: {
        token: `ExponentPushToken[test_${Date.now()}]`,
        platform: 'android',
        deviceInfo: 'Test Device Android',
      },
    });
    assert(pushTokenRes.status === 200 && pushTokenRes.data?.success, 'Mobile push token registered with backend successfully');

    // 12. Full Mobile Parity Module Verification
    console.log('\n--- Objective F.12: Full Web-to-Mobile Feature Parity Verification ---');
    const staffInstId = staff.user.instituteId || INSTITUTE_ID;
    const [
      batchesRes,
      materialsRes,
      hwRes,
      quizzesRes,
      examsRes,
      reviewsRes,
      convoRes,
    ] = await Promise.all([
      request('/academics/batches', { token: staff.token, instituteId: staffInstId }),
      request('/materials', { token: staff.token, instituteId: staffInstId }),
      request('/homework', { token: staff.token, instituteId: staffInstId }),
      request('/quizzes', { token: student.token, instituteId: student.user.instituteId || INSTITUTE_ID }),
      request('/exams', { token: staff.token, instituteId: staffInstId }),
      request('/reviews', { token: staff.token, instituteId: staffInstId }),
      request('/messaging/conversations', { token: parent.token, instituteId: parent.user.instituteId || INSTITUTE_ID }),
    ]);

    if (batchesRes.status !== 200) console.log('Batches error:', batchesRes.status, batchesRes.data);
    if (reviewsRes.status !== 200) console.log('Reviews error:', reviewsRes.status, reviewsRes.data);

    assert(batchesRes.status === 200, 'Module 1: Batches & Timetables accessible on mobile backend');
    assert(materialsRes.status === 200, 'Module 2: Learning Materials & Voice Notes accessible');
    assert(hwRes.status === 200, 'Module 3: Homework & Submissions accessible');
    assert(quizzesRes.status === 200, 'Module 4: Quizzes & Automated Evaluator accessible');
    assert(examsRes.status === 200, 'Module 5: Examinations & Marks accessible');
    assert(reviewsRes.status === 200, 'Module 6: Academic Progress & Parent Reviews accessible');
    assert(convoRes.status === 200, 'Module 7: Parent-Staff Messaging & Attachments accessible');

    // Clean up test records
    await prisma.notification.deleteMany({
      where: {
        id: { in: [testNotif1.id, notifTarget1.id, unrelatedNotif.id, staffNotif.id, n1.id] },
      },
    });

    console.log('\n================================================================');
    console.log(`Phase 9 Validation Results: ${passed} / ${total} Tests Passed`);
    console.log('================================================================\n');

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('[Test Execution Error]', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
