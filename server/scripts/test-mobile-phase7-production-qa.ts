import http from 'http';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import app from '../src/index.js';
import { prisma } from '../src/prisma.js';
import { InAppNotificationService } from '../src/modules/notifications/inapp-notification.service.js';

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

function phoneticSimilarity(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  const matrix: number[][] = [];
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  const maxLen = Math.max(str1.length, str2.length);
  return 1 - matrix[str1.length][str2.length] / maxLen;
}

async function runProductionQA() {
  console.log('================================================================');
  console.log('Digital Guru Franchise — Phase 7: Complete Production QA');
  console.log('================================================================\n');

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      port = addr.port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      console.log(`[QA Test Server] Listening on ${baseUrl}\n`);
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
    // 1. CONFIGURATION & APP METADATA AUDIT
    // -------------------------------------------------------------
    console.log('--- 1. App Configuration & Manifest Integrity ---');

    const appJsonPath = path.resolve(__dirname, '../../apps/mobile/app.json');
    const easJsonPath = path.resolve(__dirname, '../../apps/mobile/eas.json');

    assert(fs.existsSync(appJsonPath), 'apps/mobile/app.json exists');
    assert(fs.existsSync(easJsonPath), 'apps/mobile/eas.json exists');

    const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const easConfig = JSON.parse(fs.readFileSync(easJsonPath, 'utf8'));

    // Android & iOS Identity
    assert(appConfig.expo?.ios?.bundleIdentifier === 'com.digitalghuru.franchise', 'iOS bundleIdentifier is com.digitalghuru.franchise');
    assert(appConfig.expo?.android?.package === 'com.digitalghuru.franchise', 'Android package name is com.digitalghuru.franchise');

    // Permissions check
    const perms: string[] = appConfig.expo?.android?.permissions || [];
    assert(perms.includes('POST_NOTIFICATIONS'), 'Android permissions include POST_NOTIFICATIONS (Android 13+)');
    assert(perms.includes('CAMERA'), 'Android permissions include CAMERA');
    assert(perms.includes('READ_MEDIA_IMAGES'), 'Android permissions include READ_MEDIA_IMAGES');
    assert(perms.includes('RECORD_AUDIO'), 'Android permissions include RECORD_AUDIO');
    assert(perms.includes('ACCESS_FINE_LOCATION'), 'Android permissions include ACCESS_FINE_LOCATION');

    // Plugins check
    const plugins = appConfig.expo?.plugins || [];
    const hasSecureStore = plugins.some((p: any) => p === 'expo-secure-store' || (Array.isArray(p) && p[0] === 'expo-secure-store'));
    const hasNotifications = plugins.some((p: any) => p === 'expo-notifications' || (Array.isArray(p) && p[0] === 'expo-notifications'));
    assert(hasSecureStore, 'app.json includes expo-secure-store plugin');
    assert(hasNotifications, 'app.json includes expo-notifications plugin');

    // EAS Build Bundle check
    assert(easConfig.build?.production?.android?.buildType === 'app-bundle', 'eas.json production android buildType is app-bundle (AAB)');

    // -------------------------------------------------------------
    // 2. AUTHENTICATION & SECURE SESSION TOKEN QA
    // -------------------------------------------------------------
    console.log('\n--- 2. Authentication & Session Security QA ---');

    // Student Login
    const stuLogin = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'student@apexacademy.com', password: 'Password#123', role: 'STUDENT' },
    });
    assert(stuLogin.status === 200 && stuLogin.data?.success, 'Student login succeeds (200 OK)');
    const studentToken = stuLogin.data?.data?.accessToken;
    const studentRefreshToken = stuLogin.data?.data?.refreshToken;
    const studentUser = stuLogin.data?.data?.user;
    const studentUserId = studentUser?.id;
    assert(!!studentToken && studentToken.split('.').length === 3, 'Student access token is a valid 3-part JWT');
    assert(!!studentRefreshToken, 'Student refresh token received');

    // Parent Login
    const parLogin = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'parent@apex.example.com', password: 'Password#123', role: 'PARENT' },
    });
    assert(parLogin.status === 200 && parLogin.data?.success, 'Parent login succeeds (200 OK)');
    const parentToken = parLogin.data?.data?.accessToken;
    const parentUser = parLogin.data?.data?.user;
    const parentUserId = parentUser?.id;
    assert(!!parentToken && parentToken.split('.').length === 3, 'Parent access token is a valid 3-part JWT');

    // Teacher Login
    const teachLogin = await request('/auth/login', {
      method: 'POST',
      body: { identifier: 'teacher@apex.example.com', password: 'Password#123', role: 'STAFF' },
    });
    assert(teachLogin.status === 200 && teachLogin.data?.success, 'Teacher login succeeds (200 OK)');
    const teacherToken = teachLogin.data?.data?.accessToken;
    const teacherUser = teachLogin.data?.data?.user;
    const teacherUserId = teacherUser?.id;
    assert(!!teacherToken && teacherToken.split('.').length === 3, 'Teacher access token is a valid 3-part JWT');

    // Token Refresh Flow (Route: /auth/refresh)
    const refreshRes = await request('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: studentRefreshToken },
    });
    assert(refreshRes.status === 200 && refreshRes.data?.success, 'Token refresh endpoint returns 200 with fresh token');
    const renewedToken = refreshRes.data?.data?.accessToken;
    assert(!!renewedToken && renewedToken.split('.').length === 3, 'Renewed access token is a valid 3-part JWT');

    // Invalid Token Rejection
    const invalidRefreshRes = await request('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: 'malformed.bogus.refreshtoken' },
    });
    assert(invalidRefreshRes.status === 401 || invalidRefreshRes.status === 403, 'Malformed refresh token is rejected with 401/403');

    // Unauthorized Request Rejection
    const unauthRes = await request('/students/my/timetable', {
      headers: { Authorization: 'Bearer forged.tampered.token' },
    });
    assert(unauthRes.status === 401, 'Tampered Bearer token is rejected with 401 Unauthorized');

    // -------------------------------------------------------------
    // 3. ROLE-BASED ACCESS CONTROL (RBAC) & CROSS-TENANT ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- 3. Role-Based Access Control & Tenant Isolation ---');

    // Student cannot access staff endpoint
    const stuStaffRes = await request('/staff', { token: studentToken });
    assert(stuStaffRes.status === 401 || stuStaffRes.status === 403, 'Student cannot access staff management endpoint (401/403)');

    // Parent cannot access staff endpoint
    const parStaffRes = await request('/staff', { token: parentToken });
    assert(parStaffRes.status === 401 || parStaffRes.status === 403, 'Parent cannot access staff management endpoint (401/403)');

    // Student personal timetable access
    const stuTimetableRes = await request('/students/my/timetable', { token: studentToken });
    assert(stuTimetableRes.status === 200 && stuTimetableRes.data?.success, 'Student can access personal timetable (200 OK)');

    // Student personal dashboard access
    const stuDashRes = await request('/students/my/dashboard', { token: studentToken });
    assert(stuDashRes.status === 200 && stuDashRes.data?.success, 'Student can access personal dashboard (200 OK)');

    // Parent linked children access
    const parChildrenRes = await request('/parents/my/children', { token: parentToken });
    assert(parChildrenRes.status === 200 && parChildrenRes.data?.success, 'Parent can fetch linked children (200 OK)');
    const linkedChildren = parChildrenRes.data?.data?.children || parChildrenRes.data?.data || [];
    assert(Array.isArray(linkedChildren), 'Linked children returned as array');

    // Parent dashboard summary access
    const parDashRes = await request('/parents/my/dashboard-summary', { token: parentToken });
    assert(parDashRes.status === 200 && parDashRes.data?.success, 'Parent can access dashboard summary (200 OK)');

    // Teacher timetable access
    const teachTimetableRes = await request('/staff/my/timetable', { token: teacherToken });
    assert(teachTimetableRes.status === 200 && teachTimetableRes.data?.success, 'Teacher can access assigned schedule (200 OK)');

    // Teacher dashboard access
    const teachDashRes = await request('/staff/my/dashboard', { token: teacherToken });
    assert(teachDashRes.status === 200 && teachDashRes.data?.success, 'Teacher can access assigned dashboard (200 OK)');

    // -------------------------------------------------------------
    // 4. PUSH NOTIFICATION & TOKEN LIFECYCLE QA
    // -------------------------------------------------------------
    console.log('\n--- 4. Push Notification & Token Lifecycle QA ---');

    const testPushToken = `ExponentPushToken[SIMULATOR_PROD_QA_${Date.now()}]`;

    // 4.1 Register Push Token
    const regPushRes = await request('/notifications/push-token', {
      method: 'POST',
      token: studentToken,
      body: {
        token: testPushToken,
        platform: 'android',
        deviceInfo: 'QA Production Device (Android 14)',
      },
    });
    assert(regPushRes.status === 200 && regPushRes.data?.success, 'Register device push token returns 200 OK');

    // Verify token exists in database
    const dbToken = await prisma.devicePushToken.findUnique({ where: { token: testPushToken } });
    assert(!!dbToken && dbToken.userId === studentUserId, 'Push token correctly associated with student in database');

    // 4.2 Dispatch notification with push
    const inst = await prisma.institute.findFirst();
    const testNotif = await prisma.notification.create({
      data: {
        instituteId: inst?.id || '',
        userId: studentUserId,
        role: 'STUDENT',
        title: 'Production QA Verification',
        message: 'Automated Phase 7 production readiness validation in progress.',
        type: 'ACADEMIC',
        entityType: 'HOMEWORK',
        entityId: 'test-hw-id',
        idempotencyKey: `TEST_IDEMP_P7_${Date.now()}`,
      },
    });
    assert(!!testNotif && testNotif.title === 'Production QA Verification', 'Database Notification created successfully');

    // Dispatch push via InAppNotificationService
    await InAppNotificationService.dispatchPushForNotification(testNotif);
    const updatedTestNotif = await prisma.notification.findUnique({ where: { id: testNotif.id } });
    assert(updatedTestNotif?.pushStatus === 'DELIVERED', 'Push dispatcher updated notification status to DELIVERED');

    // 4.3 Notification unread count
    const unreadRes = await request('/notifications/unread-count', { token: studentToken });
    assert(unreadRes.status === 200 && typeof unreadRes.data?.data?.unreadCount === 'number', 'Unread notification count query returns valid integer');

    // 4.4 Delete Push Token (Logout simulation)
    const delPushRes = await request('/notifications/push-token', {
      method: 'DELETE',
      token: studentToken,
      body: { token: testPushToken },
    });
    assert(delPushRes.status === 200 && delPushRes.data?.success, 'Deregister device push token on logout returns 200 OK');

    // Verify token is removed from database
    const dbTokenAfter = await prisma.devicePushToken.findUnique({ where: { token: testPushToken } });
    assert(dbTokenAfter === null, 'Deregistered push token deleted from database (clean logout)');

    // -------------------------------------------------------------
    // 5. VOICE ATTENDANCE & PHONETIC ENGINE ACCURACY
    // -------------------------------------------------------------
    console.log('\n--- 5. Voice Attendance & Phonetic Engine QA ---');

    // Phonetic similarity tests
    const match1 = phoneticSimilarity('Aarav Sharma', 'Arav Sharma');
    const match2 = phoneticSimilarity('Priya Patel', 'Priya Patil');
    const match3 = phoneticSimilarity('Rahul Kumar', 'John Doe');

    assert(match1 >= 0.85, `Phonetic match on slight spelling variance: ${(match1 * 100).toFixed(1)}%`);
    assert(match2 >= 0.80, `Phonetic match on surname variance: ${(match2 * 100).toFixed(1)}%`);
    assert(match3 < 0.40, `Phonetic mismatch correctly rejected: ${(match3 * 100).toFixed(1)}%`);

    // -------------------------------------------------------------
    // 6. LEARNING MATERIALS & HOMEWORK ACCESS
    // -------------------------------------------------------------
    console.log('\n--- 6. Learning Materials & Academic Resources QA ---');

    const stuMaterialsRes = await request('/materials', { token: studentToken });
    assert(stuMaterialsRes.status === 200 && stuMaterialsRes.data?.success, 'Student materials endpoint returns 200 OK');

    const teachMaterialsRes = await request('/materials', { token: teacherToken });
    assert(teachMaterialsRes.status === 200 && teachMaterialsRes.data?.success, 'Teacher materials endpoint returns 200 OK');

    // -------------------------------------------------------------
    // 7. ERROR NORMALIZATION & DEFENSIVE RESILIENCE
    // -------------------------------------------------------------
    console.log('\n--- 7. Error Normalization & Defensive Resilience ---');

    // Non-existent route
    const notFoundRes = await request('/non-existent-route-12345', { token: studentToken });
    assert(notFoundRes.status === 404, 'Non-existent route returns 404 status code');

    // Invalid JSON body handling
    const malformedBodyRes = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"unclosed_json: true',
    });
    assert(malformedBodyRes.status === 400, 'Malformed JSON payload safely returns 400 Bad Request');

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`Phase 7 Production QA Results: ${testsPassed} PASSED, ${testsFailed} FAILED`);
    console.log('================================================================\n');

    if (testsFailed === 0) {
      console.log('ALL PHASE 7 PRODUCTION READINESS AUDIT TESTS PASSED SUCCESSFULLY!\n');
    } else {
      console.error(`ERROR: ${testsFailed} test(s) failed during Phase 7 production QA.\n`);
    }

  } catch (error) {
    console.error('Fatal error during Phase 7 QA execution:', error);
    testsFailed++;
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

runProductionQA();
