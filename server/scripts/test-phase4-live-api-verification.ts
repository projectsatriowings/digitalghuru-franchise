import app from '../src/index.js';
import http from 'http';
import { prisma } from '../src/prisma.js';

let server: http.Server;
const TEST_PORT = 5099;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string, extra?: any) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    if (extra) console.error('    Detail:', extra);
    failedCount++;
  }
}

async function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(TEST_PORT, '127.0.0.1', () => {
      console.log(`[Test Server] Running on ${BASE_URL}`);
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('[Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function run() {
  console.log('================================================================');
  console.log(' DIGITAL GURU FRANCHISE: PHASE 4 LIVE API & WORKFLOW VERIFICATION');
  console.log('================================================================\n');

  await startServer();

  try {
    // 1. Health check
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200 && healthJson.status === 'healthy', '1. System Health: /api/health reports healthy with Neon PostgreSQL', healthJson);

    // 2. Authentication: Login for every role
    // 2a. Super Admin
    const superAdminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'superadmin@platform.local',
        password: 'AdminSecurePassword#2026',
        role: 'SUPER_ADMIN',
      }),
    });
    const superAdminData = await superAdminRes.json();
    assert(superAdminRes.status === 200 && !!superAdminData.data?.accessToken, '2a. Auth: Super Admin login succeeded', superAdminData);
    const superAdminToken = superAdminData.data?.accessToken;

    // 2b. Academic Admin
    const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@apex.example.com',
        password: 'Password#123',
        role: 'ACADEMIC_ADMIN',
      }),
    });
    const adminData = await adminRes.json();
    assert(adminRes.status === 200 && !!adminData.data?.accessToken, '2b. Auth: Academic Admin login succeeded', adminData);
    const adminToken = adminData.data?.accessToken;
    const instituteId = adminData.data?.institute?.id;

    // 2c. Staff
    const staffRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'teacher@apex.example.com',
        password: 'Password#123',
        role: 'STAFF',
      }),
    });
    const staffData = await staffRes.json();
    assert(staffRes.status === 200 && !!staffData.data?.accessToken, '2c. Auth: Staff login succeeded', staffData);
    const staffToken = staffData.data?.accessToken;

    // 2d. Parent
    const parentRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'parent@apex.example.com',
        password: 'Password#123',
        role: 'PARENT',
      }),
    });
    const parentData = await parentRes.json();
    assert(parentRes.status === 200 && !!parentData.data?.accessToken, '2d. Auth: Parent login succeeded', parentData);
    const parentToken = parentData.data?.accessToken;

    // 2e. Student
    const studentRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'student@apex.example.com',
        password: 'Password#123',
        role: 'STUDENT',
      }),
    });
    const studentData = await studentRes.json();
    assert(studentRes.status === 200 && !!studentData.data?.accessToken, '2e. Auth: Student login succeeded', studentData);
    const studentToken = studentData.data?.accessToken;

    // 3. Security: Role-Based Access Control
    // Student trying to list institutes -> 403
    const forbiddenRes = await fetch(`${BASE_URL}/api/institutes`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(forbiddenRes.status === 403, '3a. RBAC Security: Student cannot access Super Admin /api/institutes (HTTP 403)');

    // Unauthenticated request -> 401
    const unauthRes = await fetch(`${BASE_URL}/api/institutes`);
    assert(unauthRes.status === 401, '3b. RBAC Security: Unauthenticated request rejected (HTTP 401)');

    // 4. Academics: Create Subject & Batch with Academic Admin token
    const subjRes = await fetch(`${BASE_URL}/api/academics/subjects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-institute-id': instituteId,
      },
      body: JSON.stringify({
        name: 'Mathematics Advanced',
        code: `MATH-${Date.now().toString().slice(-4)}`,
        description: 'Advanced Mathematics for Grade 10',
      }),
    });
    const subjData = await subjRes.json();
    const createdSubjectId = subjData.data?.subject?.id || subjData.data?.id;
    assert(subjRes.status === 201 && !!createdSubjectId, '4a. Academics: Create subject via API succeeded', subjData);

    const batchRes = await fetch(`${BASE_URL}/api/academics/batches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-institute-id': instituteId,
      },
      body: JSON.stringify({
        name: `Batch 2026-${Date.now().toString().slice(-4)}`,
        code: `B-${Date.now().toString().slice(-4)}`,
        academicYear: '2026-2027',
        startDate: '2026-06-01',
      }),
    });
    const batchData = await batchRes.json();
    const createdBatchId = batchData.data?.batch?.id || batchData.data?.id;
    assert(batchRes.status === 201 && !!createdBatchId, '4b. Academics: Create batch via API succeeded', batchData);

    // 5. Student CRUD
    const createStudentRes = await fetch(`${BASE_URL}/api/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-institute-id': instituteId,
      },
      body: JSON.stringify({
        firstName: 'Rahul',
        lastName: 'Sharma',
        gender: 'MALE',
        bloodGroup: 'B+',
        notes: 'Enrolled via automated verification test',
        batchId: createdBatchId,
        parentFullName: 'Sunil Sharma',
        parentRelationship: 'FATHER',
        parentPhone: `981${Date.now().toString().slice(-7)}`,
        parentCanReceiveSms: true,
      }),
    });
    const createStudentData = await createStudentRes.json();
    const createdStudentId = createStudentData.data?.student?.id || createStudentData.data?.id;
    assert(createStudentRes.status === 201 && !!createdStudentId, '5a. Student CRUD: Admit new student with parent relation', createStudentData);

    // Retrieve Student
    const getStudentRes = await fetch(`${BASE_URL}/api/students/${createdStudentId}`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-institute-id': instituteId,
      },
    });
    const getStudentData = await getStudentRes.json();
    assert(getStudentRes.status === 200 && (getStudentData.data?.student?.firstName === 'Rahul' || getStudentData.data?.firstName === 'Rahul'), '5b. Student CRUD: Retrieve student details', getStudentData);

    // Update Student
    const patchStudentRes = await fetch(`${BASE_URL}/api/students/${createdStudentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-institute-id': instituteId,
      },
      body: JSON.stringify({
        bloodGroup: 'O+',
        notes: 'Updated blood group during test',
      }),
    });
    const patchStudentData = await patchStudentRes.json();
    assert(patchStudentRes.status === 200 && (patchStudentData.data?.student?.bloodGroup === 'O+' || patchStudentData.data?.bloodGroup === 'O+'), '5c. Student CRUD: Update student details', patchStudentData);

    // 6. Staff Management
    const listStaffRes = await fetch(`${BASE_URL}/api/staff`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-institute-id': instituteId,
      },
    });
    const listStaffData = await listStaffRes.json();
    const staffList = Array.isArray(listStaffData.data) ? listStaffData.data : listStaffData.data?.staff;
    assert(listStaffRes.status === 200 && Array.isArray(staffList), '6. Staff Management: List institute staff profiles', listStaffData);

    // 7. Attendance Workflow
    // 7a. Verify unassigned staff cannot mark attendance in batch (Security validation)
    const staffCheckInRes = await fetch(`${BASE_URL}/api/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
        'x-institute-id': instituteId,
      },
      body: JSON.stringify({
        studentId: createdStudentId,
        batchId: createdBatchId,
        method: 'MANUAL',
        idempotencyKey: `ATT-STAFF-${Date.now()}`,
      }),
    });
    assert(staffCheckInRes.status === 403, '7a. Attendance Security: Unassigned staff rejected with HTTP 403 on unauthorized batch');

    // 7b. Academic Admin records attendance
    const adminCheckInRes = await fetch(`${BASE_URL}/api/attendance/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-institute-id': instituteId,
      },
      body: JSON.stringify({
        studentId: createdStudentId,
        batchId: createdBatchId,
        method: 'MANUAL',
        idempotencyKey: `ATT-ADMIN-${Date.now()}`,
      }),
    });
    const adminCheckInData = await adminCheckInRes.json();
    assert([200, 201].includes(adminCheckInRes.status) && adminCheckInData.success === true, '7b. Attendance: Academic Admin records valid CHECK_IN event', adminCheckInData);

    // 8. Fees Management: Fee Structure & Payments
    const feeStructureRes = await fetch(`${BASE_URL}/api/fees/structures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
        'x-institute-id': instituteId,
      },
      body: JSON.stringify({
        batchId: createdBatchId,
        name: 'Tuition Fee Q1 2026',
        frequency: 'ONE_TIME',
        amount: 4500.00,
        dueDay: 15,
        academicYear: '2026-2027',
      }),
    });
    const feeStructureData = await feeStructureRes.json();
    const createdFeeStructureId = feeStructureData.data?.feeStructure?.id || feeStructureData.data?.id;
    assert(feeStructureRes.status === 201 && !!createdFeeStructureId, '8a. Fees Management: Create fee structure', feeStructureData);

    const listFeeStructRes = await fetch(`${BASE_URL}/api/fees/structures`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-institute-id': instituteId,
      },
    });
    const listFeeStructData = await listFeeStructRes.json();
    const feeStructuresList = Array.isArray(listFeeStructData.data) ? listFeeStructData.data : listFeeStructData.data?.feeStructures;
    assert(listFeeStructRes.status === 200 && Array.isArray(feeStructuresList), '8b. Fees Management: List fee structures', listFeeStructData);

    // 9. In-App Notifications
    const notifRes = await fetch(`${BASE_URL}/api/notifications`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'x-institute-id': instituteId,
      },
    });
    const notifData = await notifRes.json();
    assert(notifRes.status === 200 && Array.isArray(notifData.data?.notifications || notifData.data), '9. Notifications: Query notifications list', notifData);

    // 10. Clean up test records
    await prisma.smsNotification.deleteMany({ where: { studentId: createdStudentId } });
    await prisma.notification.deleteMany({ where: { studentId: createdStudentId } });
    await prisma.attendanceEvent.deleteMany({ where: { studentId: createdStudentId } });
    await prisma.studentEnrollment.deleteMany({ where: { studentId: createdStudentId } });
    await prisma.studentParentRelation.deleteMany({ where: { studentId: createdStudentId } });
    await prisma.student.deleteMany({ where: { id: createdStudentId } });
    if (createdFeeStructureId) {
      await prisma.feeStructure.deleteMany({ where: { id: createdFeeStructureId } });
    }
    if (createdBatchId) {
      await prisma.batch.deleteMany({ where: { id: createdBatchId } });
    }
    if (createdSubjectId) {
      await prisma.subject.deleteMany({ where: { id: createdSubjectId } });
    }

    console.log('\n----------------------------------------------------------------');
    console.log(` VERIFICATION SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of ${passedCount + failedCount} TESTS`);
    console.log('----------------------------------------------------------------\n');

  } catch (err: any) {
    console.error('[Error during verification]', err);
    failedCount++;
  } finally {
    await stopServer();
    await prisma.$disconnect();
  }

  if (failedCount > 0) {
    process.exit(1);
  }
}

run();
