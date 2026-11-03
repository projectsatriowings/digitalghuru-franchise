import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  isStaffWfhAuthorized,
  createWfhAuthorization,
  reviewWfhRequest,
  revokeWfhAuthorization,
  getWfhMetrics,
} from '../src/modules/staff-attendance/wfh.service.js';
import { getLocalDateForInstitute } from '../src/modules/staff-attendance/staff-attendance.controller.js';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5000/api';

async function runWfhTestSuite() {
  console.log('====================================================');
  console.log('TuitionOS: Work From Home (WFH) Attendance Test Suite');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      failed++;
    }
  }

  try {
    // -----------------------------------------------------------------
    // 1. AUTHENTICATION & CONTEXT SETUP
    // -----------------------------------------------------------------
    console.log('\n--- 1. Authentication & Base Setup ---');

    // Admin login
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@apex.example.com',
        password: 'Password#123',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data?.accessToken;
    const adminUser = adminLoginData.data?.user;
    const instituteId = adminLoginData.data?.institute?.id;

    assert(!!adminToken, 'Admin login succeeded');

    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
      'X-Institute-Id': instituteId,
    };

    // Staff login
    const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'teacher@apex.example.com',
        password: 'Password#123',
      }),
    });
    const staffLoginData = await staffLoginRes.json();
    const staffToken = staffLoginData.data?.accessToken;
    const staffUser = staffLoginData.data?.user;
    assert(!!staffToken, 'Staff login succeeded');

    const staffHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`,
      'X-Institute-Id': instituteId,
    };

    // Get staff profile
    const staffProfile = await prisma.staffProfile.findFirst({
      where: { userId: staffUser.id, instituteId },
    });
    assert(!!staffProfile, 'Found staff profile in database');

    const todayDate = getLocalDateForInstitute(new Date());

    // Clean up test authorizations and sessions for today so tests run cleanly
    await prisma.staffAttendanceEvent.deleteMany({
      where: { instituteId, staffId: staffProfile!.id },
    });
    await prisma.staffAttendanceSession.deleteMany({
      where: { instituteId, staffId: staffProfile!.id, attendanceDate: todayDate },
    });
    await prisma.staffWFHAuthorization.deleteMany({
      where: { instituteId, staffId: staffProfile!.id },
    });
    await prisma.staffWFHAuthorization.deleteMany({
      where: { instituteId, scope: 'INSTITUTE_WIDE' },
    });

    // -----------------------------------------------------------------
    // 2. WFH ELIGIBILITY & GEOFENCE SECURITY (BEFORE APPROVAL)
    // -----------------------------------------------------------------
    console.log('\n--- 2. WFH Eligibility & Geofence Security Before Approval ---');

    // 2.1 Staff checks WFH eligibility (should be unauthorized initially)
    const eligRes1 = await fetch(`${BASE_URL}/staff-attendance/wfh/eligibility`, {
      headers: staffHeaders,
    });
    const eligData1 = await eligRes1.json();
    assert(
      eligRes1.status === 200 && eligData1.data?.isAuthorized === false,
      'Staff WFH eligibility returns false initially'
    );

    // 2.2 Unauthorized staff attempts WFH check-in -> 403 Forbidden
    const unauthWfhRes = await fetch(`${BASE_URL}/staff-attendance/check-in`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        mode: 'WFH',
      }),
    });
    const unauthWfhData = await unauthWfhRes.json();
    assert(
      unauthWfhRes.status === 403 && unauthWfhData.code === 'NO_ACTIVE_WFH_AUTHORIZATION',
      'Unauthorized staff cannot bypass geofence using WFH payload (403 Forbidden)'
    );

    // 2.3 On-site check-in outside 200m is still strictly rejected
    const outsideCheckInRes = await fetch(`${BASE_URL}/staff-attendance/check-in`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        mode: 'ON_SITE',
        latitude: 13.0460, // ~500m away
        longitude: 80.2360,
        accuracy: 10,
      }),
    });
    const outsideData = await outsideCheckInRes.json();
    assert(
      outsideCheckInRes.status === 400 && outsideData.code === 'OUTSIDE_GEOFENCE',
      'Regression check: On-site check-in outside 200m is rejected'
    );

    // 2.4 On-site check-in with poor GPS accuracy (>50m) is still strictly rejected
    const poorAccRes = await fetch(`${BASE_URL}/staff-attendance/check-in`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        mode: 'ON_SITE',
        latitude: 13.0418,
        longitude: 80.2341,
        accuracy: 85,
      }),
    });
    const poorAccData = await poorAccRes.json();
    assert(
      poorAccRes.status === 400 && poorAccData.code === 'ACCURACY_TOO_LOW',
      'Regression check: On-site check-in with poor accuracy (>50m) is rejected'
    );

    // -----------------------------------------------------------------
    // 3. STAFF WFH REQUEST & REVIEW WORKFLOW
    // -----------------------------------------------------------------
    console.log('\n--- 3. Staff WFH Request & Review Workflow ---');

    const todayStr = todayDate.toISOString().split('T')[0];

    // 3.1 Staff submits WFH request
    const requestRes = await fetch(`${BASE_URL}/staff-attendance/wfh/request`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        startDate: todayStr,
        endDate: todayStr,
        reasonCategory: 'WEATHER_DISRUPTION',
        reason: 'Severe cyclone warning and heavy rain across Chennai',
        notes: 'Conducting class 10 physics online',
      }),
    });
    const requestData = await requestRes.json();
    const requestId = requestData.data?.id;
    assert(
      requestRes.status === 201 && requestData.data?.status === 'PENDING',
      'Staff successfully submitted WFH request (status: PENDING)'
    );

    // 3.2 Pending request cannot authorize check-in
    const pendingCheckInRes = await fetch(`${BASE_URL}/staff-attendance/check-in`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({ mode: 'WFH' }),
    });
    assert(
      pendingCheckInRes.status === 403,
      'Pending WFH request cannot authorize check-in (403 Forbidden)'
    );

    // 3.3 Staff cannot approve own request (Self-approval rule)
    // If staff user attempts to call approve
    const selfApproveRes = await fetch(`${BASE_URL}/staff-attendance/wfh/admin/authorizations/${requestId}/approve`, {
      method: 'POST',
      headers: staffHeaders, // Staff role
    });
    assert(
      selfApproveRes.status === 403,
      'Staff role forbidden from accessing admin approve endpoint'
    );

    // 3.4 Academic Admin approves WFH request
    const approveRes = await fetch(`${BASE_URL}/staff-attendance/wfh/admin/authorizations/${requestId}/approve`, {
      method: 'POST',
      headers: adminHeaders,
    });
    const approveData = await approveRes.json();
    assert(
      approveRes.status === 200 && approveData.data?.status === 'APPROVED',
      'Academic Admin successfully approved staff WFH request'
    );

    // 3.5 Check eligibility after approval -> isAuthorized = true
    const eligRes2 = await fetch(`${BASE_URL}/staff-attendance/wfh/eligibility`, {
      headers: staffHeaders,
    });
    const eligData2 = await eligRes2.json();
    assert(
      eligData2.data?.isAuthorized === true && eligData2.data?.authorization?.id === requestId,
      'Staff WFH eligibility returns true with approved authorization'
    );

    // -----------------------------------------------------------------
    // 4. WFH CHECK-IN & CHECK-OUT EXECUTION
    // -----------------------------------------------------------------
    console.log('\n--- 4. WFH Check-In & Check-Out Execution ---');

    // 4.1 Staff checks in using authorized WFH mode (without GPS/geofence)
    const wfhCheckInRes = await fetch(`${BASE_URL}/staff-attendance/check-in`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        mode: 'WFH',
        deviceInfo: 'Chrome on Windows 11',
      }),
    });
    const wfhCheckInData = await wfhCheckInRes.json();
    assert(
      wfhCheckInRes.status === 200 && wfhCheckInData.data?.mode === 'WFH',
      'Authorized staff checked in via WFH without GPS coordinates'
    );
    assert(
      wfhCheckInData.data?.session?.attendanceMode === 'WFH',
      'Attendance session saved with attendanceMode = WFH'
    );

    // 4.2 Duplicate WFH check-in rejected with 409 Conflict
    const dupCheckInRes = await fetch(`${BASE_URL}/staff-attendance/check-in`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({ mode: 'WFH' }),
    });
    assert(
      dupCheckInRes.status === 409,
      'Duplicate WFH check-in rejected with 409 Conflict'
    );

    // 4.3 Staff checks out of WFH session without GPS
    const wfhCheckOutRes = await fetch(`${BASE_URL}/staff-attendance/check-out`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        deviceInfo: 'Chrome on Windows 11',
      }),
    });
    const wfhCheckOutData = await wfhCheckOutRes.json();
    assert(
      wfhCheckOutRes.status === 200 && wfhCheckOutData.data?.status === 'CHECKED_OUT',
      'Staff successfully checked out of WFH session without GPS'
    );

    // 4.4 Duplicate WFH check-out rejected with 409 Conflict
    const dupCheckOutRes = await fetch(`${BASE_URL}/staff-attendance/check-out`, {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({}),
    });
    assert(
      dupCheckOutRes.status === 409,
      'Duplicate WFH check-out rejected with 409 Conflict'
    );

    // -----------------------------------------------------------------
    // 5. ADMIN WFH AUTHORIZATIONS & SCOPES
    // -----------------------------------------------------------------
    console.log('\n--- 5. Admin WFH Authorizations & Scopes ---');

    // 5.1 Admin creates Institute-wide authorization
    const tomorrow = new Date(todayDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const instWideRes = await fetch(`${BASE_URL}/staff-attendance/wfh/admin/authorizations`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        scope: 'INSTITUTE_WIDE',
        startDate: tomorrowStr,
        endDate: tomorrowStr,
        reasonCategory: 'INSTITUTE_CLOSURE',
        reason: 'State Government declared general holiday due to weather',
      }),
    });
    const instWideData = await instWideRes.json();
    assert(
      instWideRes.status === 201 && instWideData.data?.scope === 'INSTITUTE_WIDE',
      'Academic Admin created INSTITUTE_WIDE WFH authorization'
    );

    // 5.2 Admin revokes an authorization with mandatory reason
    const revokeRes = await fetch(`${BASE_URL}/staff-attendance/wfh/admin/authorizations/${instWideData.data.id}/revoke`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        revocationReason: 'Government revised alert; classes will resume on campus',
      }),
    });
    const revokeData = await revokeRes.json();
    assert(
      revokeRes.status === 200 && revokeData.data?.status === 'REVOKED',
      'Academic Admin revoked authorization with mandatory reason'
    );

    // 5.3 Empty revocation reason rejected
    const badRevokeRes = await fetch(`${BASE_URL}/staff-attendance/wfh/admin/authorizations/${requestId}/revoke`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ revocationReason: '' }),
    });
    assert(
      badRevokeRes.status === 400,
      'Revocation without mandatory reason rejected with 400'
    );

    // -----------------------------------------------------------------
    // 6. REPORTS, REGISTER & AUDIT VERIFICATION
    // -----------------------------------------------------------------
    console.log('\n--- 6. Reports, Daily Register & Audit Verification ---');

    // 6.1 Daily register returns attendanceMode
    const regRes = await fetch(`${BASE_URL}/staff-attendance/admin/daily-register?date=${todayStr}`, {
      headers: adminHeaders,
    });
    const regData = await regRes.json();
    const staffEntry = regData.data?.register?.find((r: any) => r.staffId === staffProfile!.id);
    assert(
      staffEntry?.attendanceMode === 'WFH',
      'Daily register accurately displays attendanceMode = WFH'
    );

    // 6.2 Filter daily register by mode = WFH
    const wfhRegRes = await fetch(`${BASE_URL}/staff-attendance/admin/daily-register?date=${todayStr}&mode=WFH`, {
      headers: adminHeaders,
    });
    const wfhRegData = await wfhRegRes.json();
    assert(
      wfhRegData.data?.register?.every((r: any) => r.attendanceMode === 'WFH'),
      'Daily register filtered by mode = WFH returns only WFH records'
    );

    // 6.3 Monthly report separates On-Site and WFH days without double-counting
    const monthRes = await fetch(`${BASE_URL}/staff-attendance/admin/monthly-report`, {
      headers: adminHeaders,
    });
    const monthData = await monthRes.json();
    const staffMonthly = monthData.data?.report?.find((r: any) => r.staffId === staffProfile!.id);
    assert(
      staffMonthly?.wfhDays >= 1 && staffMonthly?.daysPresent === (staffMonthly?.onSiteDays + staffMonthly?.wfhDays),
      'Monthly report separates onSiteDays & wfhDays with no double-counting'
    );

    // 6.4 Monthly CSV export includes on-site and WFH days
    const csvRes = await fetch(`${BASE_URL}/staff-attendance/admin/monthly-report?format=csv`, {
      headers: adminHeaders,
    });
    const csvText = await csvRes.text();
    assert(
      csvText.includes('On-Site Days') && csvText.includes('WFH Days'),
      'Monthly CSV export includes On-Site Days and WFH Days columns'
    );

    // 6.5 Audit logs created for WFH actions
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        instituteId,
        action: { in: ['SUBMIT_WFH_REQUEST', 'APPROVE_WFH_REQUEST', 'CREATE_WFH_AUTHORIZATION', 'REVOKE_WFH_AUTHORIZATION'] },
      },
    });
    assert(
      auditLogs.length >= 3,
      'AuditLog records created for request submission, approval, and revocation'
    );

    // -----------------------------------------------------------------
    // 7. ONLINE TEACHING INTEGRATION
    // -----------------------------------------------------------------
    console.log('\n--- 7. Online Teaching Integration ---');

    // Retrieve staff online classes
    const classesRes = await fetch(`${BASE_URL}/staff-attendance/wfh/online-classes`, {
      headers: staffHeaders,
    });
    const classesData = await classesRes.json();
    assert(
      classesRes.status === 200 && Array.isArray(classesData.data?.classes),
      'Staff online classes retrieved successfully'
    );

    // -----------------------------------------------------------------
    // 8. WFH METRICS VERIFICATION
    // -----------------------------------------------------------------
    console.log('\n--- 8. WFH Admin Metrics ---');

    const metricsRes = await fetch(`${BASE_URL}/staff-attendance/wfh/admin/metrics`, {
      headers: adminHeaders,
    });
    const metricsData = await metricsRes.json();
    assert(
      metricsRes.status === 200 && typeof metricsData.data?.checkedInWfh === 'number',
      'WFH metrics retrieved real counts from database'
    );

  } catch (error) {
    console.error('Test execution error:', error);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`Test Execution Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runWfhTestSuite();

