import { PrismaClient } from '@prisma/client';
import {
  calculateHaversineDistance,
  validateStaffLocation,
  isCheckInLate,
} from '../src/modules/staff-attendance/geofence.service.js';

const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:5000/api';

async function runTestSuite() {
  console.log('====================================================');
  console.log('TuitionOS: Staff GPS Geofence & Attendance Test Suite');
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

  // -----------------------------------------------------------------
  // 1. UNIT TESTS: HAVERSINE & GEOFENCE VALIDATION
  // -----------------------------------------------------------------
  console.log('\n--- 1. Geospatial Haversine & Geofence Math ---');

  // Institute center: T. Nagar, Chennai: 13.0418, 80.2341
  const centerLat = 13.0418;
  const centerLng = 80.2341;

  // Point A: ~50 metres away (13.0422, 80.2343)
  const distInside = calculateHaversineDistance(centerLat, centerLng, 13.0422, 80.2343);
  assert(distInside < 60 && distInside > 40, 'Haversine distance inside ~50m', `Computed: ${distInside}m`);

  // Point B: ~500 metres away (13.0460, 80.2360)
  const distOutside = calculateHaversineDistance(centerLat, centerLng, 13.0460, 80.2360);
  assert(distOutside > 400 && distOutside < 600, 'Haversine distance outside ~500m', `Computed: ${distOutside}m`);

  // Validation: Inside 200m with good accuracy
  const valInside = validateStaffLocation({
    staffCoords: { latitude: 13.0422, longitude: 80.2343, accuracy: 15 },
    instituteCoords: { latitude: centerLat, longitude: centerLng },
    geofenceRadius: 200,
    gpsAccuracyThreshold: 50,
  });
  assert(valInside.isValid === true && valInside.isWithinRadius === true, 'Location inside 200m valid');

  // Validation: Outside 200m
  const valOutside = validateStaffLocation({
    staffCoords: { latitude: 13.0460, longitude: 80.2360, accuracy: 15 },
    instituteCoords: { latitude: centerLat, longitude: centerLng },
    geofenceRadius: 200,
    gpsAccuracyThreshold: 50,
  });
  assert(valOutside.isValid === false && valOutside.code === 'OUTSIDE_GEOFENCE', 'Location outside 200m rejected');

  // Validation: Poor accuracy (accuracy = 85m > threshold 50m)
  const valPoorAcc = validateStaffLocation({
    staffCoords: { latitude: 13.0422, longitude: 80.2343, accuracy: 85 },
    instituteCoords: { latitude: centerLat, longitude: centerLng },
    geofenceRadius: 200,
    gpsAccuracyThreshold: 50,
  });
  assert(valPoorAcc.isValid === false && valPoorAcc.code === 'ACCURACY_TOO_LOW', 'Poor accuracy (>50m) rejected');

  // Validation: Invalid coords
  const valInvalid = validateStaffLocation({
    staffCoords: { latitude: 195, longitude: 80.2343 },
    instituteCoords: { latitude: centerLat, longitude: centerLng },
    geofenceRadius: 200,
    gpsAccuracyThreshold: 50,
  });
  assert(valInvalid.isValid === false && valInvalid.code === 'INVALID_COORDINATES', 'Invalid latitude (>90) rejected');

  // -----------------------------------------------------------------
  // 2. UNIT TESTS: LATENESS CALCULATION
  // -----------------------------------------------------------------
  console.log('\n--- 2. Work Hours & Lateness Calculation ---');

  const lateCheck1 = isCheckInLate({
    checkInTime: new Date(2026, 9, 29, 9, 10),
    workStartTimeStr: '09:00',
    lateGraceMinutes: 15,
    timezone: 'Asia/Kolkata',
  });
  assert(lateCheck1 === false, 'Check-in before grace period is not late');

  const lateCheck2 = isCheckInLate({
    checkInTime: new Date(2026, 9, 29, 9, 25),
    workStartTimeStr: '09:00',
    lateGraceMinutes: 15,
    timezone: 'Asia/Kolkata',
  });
  assert(lateCheck2 === true, 'Check-in after grace period is flagged late');

  // -----------------------------------------------------------------
  // 3. INTEGRATION TESTS VIA API
  // -----------------------------------------------------------------
  console.log('\n--- 3. End-to-End API Workflows & Permissions ---');

  // 3.1 Unauthenticated access rejection
  const unauthRes = await fetch(`${BASE_URL}/staff-attendance/config`);
  assert(unauthRes.status === 401, 'Unauthenticated request returns 401');

  // Log in as Academic Admin
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
  const instituteId = adminLoginData.data?.institute?.id;

  assert(!!adminToken, 'Admin login succeeded');

  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
    'X-Institute-Id': instituteId,
  };

  // 3.2 Update Institute Geofence & Location
  const updateConfigRes = await fetch(`${BASE_URL}/staff-attendance/config`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      latitude: centerLat,
      longitude: centerLng,
      geofenceRadius: 200,
      gpsAccuracyThreshold: 50,
      workStartTime: '09:00',
      workEndTime: '18:00',
      lateGraceMinutes: 15,
      requireCheckoutGeofence: true,
      timezone: 'Asia/Kolkata',
      address: '12 Main Road, T. Nagar, Chennai',
    }),
  });
  const updateConfigData = await updateConfigRes.json();
  assert(updateConfigRes.status === 200 && updateConfigData.success === true, 'Admin successfully updated institute 200m geofence');

  // Check config via GET
  const getConfigRes = await fetch(`${BASE_URL}/staff-attendance/config`, {
    headers: adminHeaders,
  });
  const getConfigData = await getConfigRes.json();
  assert(getConfigData.data?.geofenceRadius === 200, 'Institute geofence radius verified as 200m');

  // Log in as Staff
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
  assert(!!staffToken, 'Staff login succeeded');

  const staffHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${staffToken}`,
    'X-Institute-Id': instituteId,
  };

  // 3.3 Staff today attendance status
  const staffTodayRes = await fetch(`${BASE_URL}/staff-attendance/today`, {
    headers: staffHeaders,
  });
  const staffTodayData = await staffTodayRes.json();
  assert(staffTodayRes.status === 200 && staffTodayData.success === true, 'Staff today status retrieved');

  // Clear existing session for today if any (so test is idempotent)
  const staffProfile = await prisma.staffProfile.findFirst({
    where: { user: { email: 'teacher@apex.example.com' }, instituteId },
  });
  if (staffProfile) {
    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);
    await prisma.staffAttendanceSession.deleteMany({
      where: {
        staffId: staffProfile.id,
        instituteId,
        attendanceDate: todayMidnight,
      },
    });
  }

  // 3.4 Staff check-in outside 200m geofence -> Rejection
  const outsideCheckInRes = await fetch(`${BASE_URL}/staff-attendance/check-in`, {
    method: 'POST',
    headers: staffHeaders,
    body: JSON.stringify({
      latitude: 13.0460, // ~500m away
      longitude: 80.2360,
      accuracy: 10,
    }),
  });
  const outsideCheckInData = await outsideCheckInRes.json();
  assert(outsideCheckInRes.status === 400 && outsideCheckInData.code === 'OUTSIDE_GEOFENCE', 'Check-in outside 200m rejected by server');

  // 3.5 Staff check-in with poor GPS accuracy (> 50m) -> Rejection
  const poorAccCheckInRes = await fetch(`${BASE_URL}/staff-attendance/check-in`, {
    method: 'POST',
    headers: staffHeaders,
    body: JSON.stringify({
      latitude: 13.0420, // Inside
      longitude: 80.2342,
      accuracy: 95, // Poor accuracy
    }),
  });
  const poorAccCheckInData = await poorAccCheckInRes.json();
  assert(poorAccCheckInRes.status === 400 && poorAccCheckInData.code === 'ACCURACY_TOO_LOW', 'Check-in with accuracy > 50m rejected');

  // 3.6 Successful check-in inside 200m with good accuracy
  const validCheckInRes = await fetch(`${BASE_URL}/staff-attendance/check-in`, {
    method: 'POST',
    headers: staffHeaders,
    body: JSON.stringify({
      latitude: 13.0420, // ~25m away from center
      longitude: 80.2342,
      accuracy: 12,
      deviceInfo: 'Mozilla Test Runner',
      idempotencyKey: `test_ci_${Date.now()}`,
    }),
  });
  const validCheckInData = await validCheckInRes.json();
  assert(validCheckInRes.status === 200 && validCheckInData.success === true, 'Staff successfully checked in inside 200m');

  // 3.7 Duplicate check-in attempt -> Rejection
  const dupCheckInRes = await fetch(`${BASE_URL}/staff-attendance/check-in`, {
    method: 'POST',
    headers: staffHeaders,
    body: JSON.stringify({
      latitude: 13.0420,
      longitude: 80.2342,
      accuracy: 12,
    }),
  });
  assert(dupCheckInRes.status === 409, 'Duplicate check-in rejected with 409 Conflict');

  // 3.8 Successful check-out
  const checkOutRes = await fetch(`${BASE_URL}/staff-attendance/check-out`, {
    method: 'POST',
    headers: staffHeaders,
    body: JSON.stringify({
      latitude: 13.0420,
      longitude: 80.2342,
      accuracy: 10,
    }),
  });
  const checkOutData = await checkOutRes.json();
  assert(checkOutRes.status === 200 && checkOutData.success === true, 'Staff successfully checked out');

  // 3.9 Duplicate check-out attempt -> Rejection
  const dupCheckOutRes = await fetch(`${BASE_URL}/staff-attendance/check-out`, {
    method: 'POST',
    headers: staffHeaders,
    body: JSON.stringify({
      latitude: 13.0420,
      longitude: 80.2342,
      accuracy: 10,
    }),
  });
  assert(dupCheckOutRes.status === 409, 'Duplicate check-out rejected with 409 Conflict');

  // 3.10 Admin Daily Register
  const registerRes = await fetch(`${BASE_URL}/staff-attendance/admin/daily-register`, {
    headers: adminHeaders,
  });
  const registerData = await registerRes.json();
  assert(registerRes.status === 200 && Array.isArray(registerData.data?.register), 'Admin daily register loaded');

  // 3.11 Admin Dashboard Summary
  const summaryRes = await fetch(`${BASE_URL}/staff-attendance/admin/dashboard`, {
    headers: adminHeaders,
  });
  const summaryData = await summaryRes.json();
  assert(summaryRes.status === 200 && summaryData.data?.presentToday >= 1, 'Admin dashboard reflects today present count');

  // 3.12 Admin Manual Audited Correction
  const correctRes = await fetch(`${BASE_URL}/staff-attendance/admin/correct`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      staffId: staffProfile?.id,
      date: new Date().toISOString().split('T')[0],
      status: 'MANUALLY_CORRECTED',
      reason: 'Verified staff presence during network outage in Block B',
      checkInTime: new Date(Date.now() - 3600000).toISOString(),
      checkOutTime: new Date().toISOString(),
    }),
  });
  const correctData = await correctRes.json();
  assert(correctRes.status === 200 && correctData.data?.isManuallyCorrected === true, 'Admin manual correction succeeded with audit record');

  // 3.13 Monthly Report CSV Export
  const csvRes = await fetch(
    `${BASE_URL}/staff-attendance/admin/monthly-report?year=${new Date().getFullYear()}&month=${new Date().getMonth() + 1}&format=csv`,
    {
      headers: adminHeaders,
    }
  );
  const csvText = await csvRes.text();
  assert(csvRes.status === 200 && csvText.includes('Employee Code') && csvText.includes('Staff Name'), 'Monthly attendance CSV generated');

  // -----------------------------------------------------------------
  // RESULTS SUMMARY
  // -----------------------------------------------------------------
  console.log('\n====================================================');
  console.log(`Test Execution Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite()
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
