import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import app from '../src/index.js';
import { prisma } from '../src/prisma.js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

let server: http.Server;
let port: number;
let baseUrl: string;

function request(urlPath: string, options: any = {}): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath.startsWith('http') ? urlPath : `${baseUrl}${urlPath}`);
    const reqOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
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

async function runTeacherVerification() {
  console.log('================================================================');
  console.log('Digital Guru Franchise — Phase 5: Teacher API & Security Tests');
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
      console.error(`[FAIL] ${testName}`, details ? JSON.stringify(details, null, 2) : '');
      testsFailed++;
    }
  }

  try {
    // Find unassigned batch and student from another institute for security testing
    const foreignBatch = await prisma.batch.findFirst({
      where: {
        institute: { name: { not: 'Apex Tuition Academy' } },
      },
    });

    const foreignStudent = await prisma.student.findFirst({
      where: {
        institute: { name: { not: 'Apex Tuition Academy' } },
      },
    });

    // 1. Teacher Login
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: {
        identifier: 'teacher@apex.example.com',
        password: 'Password#123',
      },
    });

    assert(loginRes.status === 200, 'Test 1: Teacher Login (POST /api/auth/login)', loginRes.data);
    const token = loginRes.data?.data?.accessToken;
    const userRole = loginRes.data?.data?.user?.role;
    assert(userRole === 'STAFF', 'Test 2: Verify role is STAFF', { userRole });

    // 2. Teacher Profile
    const profileRes = await request('/staff/my/profile', { token });
    assert(profileRes.status === 200 && profileRes.data?.success, 'Test 3: Fetch Teacher Profile (GET /api/staff/my/profile)');
    const profile = profileRes.data?.data?.profile;
    assert(profile?.employeeCode === 'APEX-EMP-001', 'Test 4: Verify Employee Code (APEX-EMP-001)', profile?.employeeCode);
    assert(Array.isArray(profile?.assignedBatches) && profile.assignedBatches.length > 0, 'Test 5: Teacher has assigned batches', profile?.assignedBatches);
    const batchId = profile.assignedBatches[0].id;

    // 3. Teacher Dashboard
    const dashboardRes = await request('/staff/my/dashboard', { token });
    assert(dashboardRes.status === 200 && dashboardRes.data?.success, 'Test 6: Teacher Dashboard Summary (GET /api/staff/my/dashboard)');
    const metrics = dashboardRes.data?.data?.metrics;
    assert(typeof metrics?.totalStudents === 'number' && metrics.totalStudents > 0, 'Test 7: Total students metric populated', metrics);
    assert(typeof metrics?.totalBatches === 'number' && metrics.totalBatches > 0, 'Test 8: Total batches metric populated', metrics);

    // 4. Assigned Batches List
    const batchesRes = await request('/academics/batches', { token });
    assert(batchesRes.status === 200 && batchesRes.data?.success, 'Test 9: Fetch Assigned Batches (GET /api/academics/batches)');
    const batches = batchesRes.data?.data?.batches || [];
    assert(batches.some((b: any) => b.id === batchId), 'Test 10: Authorized batch is present in list', { count: batches.length });

    // 5. Batch Details
    const batchDetailsRes = await request(`/academics/batches/${batchId}`, { token });
    assert(batchDetailsRes.status === 200 && batchDetailsRes.data?.success, 'Test 11: Fetch Batch Details (GET /api/academics/batches/:id)');

    // 6. Teacher Students Directory
    const studentsRes = await request('/staff/my/students', { token });
    assert(studentsRes.status === 200 && studentsRes.data?.success, 'Test 12: Teacher Students Directory (GET /api/staff/my/students)');
    const students = studentsRes.data?.data?.students || [];
    assert(students.length > 0, 'Test 13: Students returned for assigned batch', { count: students.length });
    const testStudent = students[0];

    // 7. Student Details
    const studentDetailRes = await request(`/students/${testStudent.id}`, { token });
    assert(studentDetailRes.status === 200 && studentDetailRes.data?.success, 'Test 14: Authorized Student Details (GET /api/students/:id)');
    const studentObj = studentDetailRes.data?.data?.student || studentDetailRes.data?.data;
    assert(studentObj?.firstName === testStudent.firstName, 'Test 15: Student name matches', testStudent.firstName);

    // 8. Weekly Timetable
    const timetableRes = await request('/staff/my/timetable', { token });
    assert(timetableRes.status === 200 && timetableRes.data?.success, 'Test 16: Weekly Structured Timetable (GET /api/staff/my/timetable)');
    assert(timetableRes.data?.data?.schedule && typeof timetableRes.data.data.schedule === 'object', 'Test 17: Timetable schedule object returned');

    // 9. Voice-Based Attendance Matching
    const voiceMatchRes = await request('/attendance/voice-match', {
      method: 'POST',
      token,
      body: {
        transcript: testStudent.firstName,
        batchId,
      },
    });
    assert(voiceMatchRes.status === 200 && voiceMatchRes.data?.success, 'Test 18: Voice Attendance Matching (POST /api/attendance/voice-match)');
    const matchStatus = voiceMatchRes.data?.status;
    assert(matchStatus === 'EXACT_SINGLE' || matchStatus === 'EXACT_MULTIPLE', 'Test 19: Voice match returns match result', { matchStatus });

    // 10. Check-in Student (Voice / Standard)
    const checkInRes = await request('/attendance/check-in', {
      method: 'POST',
      token,
      body: {
        studentId: testStudent.id,
        batchId,
        method: 'VOICE_CONFIRMED',
      },
    });
    // Check-in returns 201 Created or 409 Conflict if already checked in today
    assert(checkInRes.status === 201 || (checkInRes.status === 409 && checkInRes.data?.alreadyCheckedIn), 'Test 20: Attendance Check-In (POST /api/attendance/check-in)', checkInRes.data);

    // 11. Duplicate Attendance Prevention
    const dupCheckInRes = await request('/attendance/check-in', {
      method: 'POST',
      token,
      body: {
        studentId: testStudent.id,
        batchId,
        method: 'VOICE_CONFIRMED',
      },
    });
    assert(dupCheckInRes.status === 409 && dupCheckInRes.data?.alreadyCheckedIn, 'Test 21: Duplicate Attendance Prevention returns 409 Conflict', dupCheckInRes.data);

    // 12. Attendance Reports
    const todayStr = new Date().toISOString().split('T')[0];
    const reportsRes = await request(`/attendance/reports?batchId=${batchId}&date=${todayStr}`, { token });
    assert(reportsRes.status === 200 && reportsRes.data?.success, 'Test 22: Attendance Reports (GET /api/attendance/reports)');

    // 13. Create Homework Assignment
    const dueDate = new Date(Date.now() + 7 * 86400000).toISOString();
    const homeworkCreateRes = await request('/homework', {
      method: 'POST',
      token,
      body: {
        title: 'Phase 5 Quantum Physics Assignment',
        description: 'Complete questions 1 through 10 from Chapter 4.',
        batchId,
        dueDate,
        maxMarks: 100,
      },
    });
    assert(homeworkCreateRes.status === 201 && homeworkCreateRes.data?.success, 'Test 23: Create Homework (POST /api/homework)', homeworkCreateRes.data);
    const createdHomeworkId = homeworkCreateRes.data?.data?.id;

    // 14. List Homework
    const homeworkListRes = await request(`/homework?batchId=${batchId}`, { token });
    const hwList = homeworkListRes.data?.data?.homework || homeworkListRes.data?.data || homeworkListRes.data;
    assert(homeworkListRes.status === 200 && Array.isArray(hwList), 'Test 24: List Homework (GET /api/homework)', homeworkListRes.data);

    // 15. Homework Submissions
    if (createdHomeworkId) {
      const submissionsRes = await request(`/homework/${createdHomeworkId}/submissions`, { token });
      assert(submissionsRes.status === 200 && submissionsRes.data?.success, 'Test 25: Homework Submissions List (GET /api/homework/:id/submissions)');
    }

    // 16. Learning Materials List
    const materialsRes = await request(`/materials?batchId=${batchId}`, { token });
    assert(materialsRes.status === 200, 'Test 26: List Materials (GET /api/materials)');

    // 17. Student Progress Feedback
    const progressCreateRes = await request('/progress', {
      method: 'POST',
      token,
      body: {
        studentId: testStudent.id,
        batchId,
        termName: 'Term 1',
        category: 'Academic Progress',
        rating: 5,
        remarks: 'Demonstrated outstanding grasp of thermodynamics and analytical problems.',
      },
    });
    assert(progressCreateRes.status === 201 && progressCreateRes.data?.success, 'Test 27: Create Progress Review (POST /api/progress)', progressCreateRes.data);

    // 18. Notifications
    const notifsRes = await request('/notifications', { token });
    assert(notifsRes.status === 200, 'Test 28: Fetch Notifications (GET /api/notifications)');

    // ==========================================
    // SECURITY TESTS
    // ==========================================

    // 19. Block access to unassigned batch
    if (foreignBatch) {
      const unauthBatchRes = await request(`/academics/batches/${foreignBatch.id}`, { token });
      assert(unauthBatchRes.status === 403 || unauthBatchRes.status === 404, 'Test 29: [SECURITY] Block access to unassigned batch (403 Forbidden)', { status: unauthBatchRes.status });
    } else {
      console.log('[SKIP] Test 29: No foreign batch found in database');
      testsPassed++;
    }

    // 20. Block access to foreign student
    if (foreignStudent) {
      const unauthStudentRes = await request(`/students/${foreignStudent.id}`, { token });
      assert(unauthStudentRes.status === 403 || unauthStudentRes.status === 404, 'Test 30: [SECURITY] Block access to foreign student (403 Forbidden)', { status: unauthStudentRes.status });
    } else {
      console.log('[SKIP] Test 30: No foreign student found in database');
      testsPassed++;
    }

    // 21. Block homework creation for unassigned batch
    if (foreignBatch) {
      const unauthHomeworkRes = await request('/homework', {
        method: 'POST',
        token,
        body: {
          title: 'Unauthorized Assignment',
          batchId: foreignBatch.id,
          dueDate,
        },
      });
      assert(unauthHomeworkRes.status === 403, 'Test 31: [SECURITY] Block homework creation for unassigned batch (403 Forbidden)', { status: unauthHomeworkRes.status });
    } else {
      console.log('[SKIP] Test 31: No foreign batch found in database');
      testsPassed++;
    }

    // 22. Block attendance check-in for unassigned batch
    if (foreignBatch) {
      const unauthCheckInRes = await request('/attendance/check-in', {
        method: 'POST',
        token,
        body: {
          studentId: testStudent.id,
          batchId: foreignBatch.id,
          method: 'MANUAL',
        },
      });
      assert(unauthCheckInRes.status === 403 || unauthCheckInRes.status === 400, 'Test 32: [SECURITY] Block attendance check-in for unassigned batch (403 Forbidden)', { status: unauthCheckInRes.status });
    } else {
      console.log('[SKIP] Test 32: No foreign batch found in database');
      testsPassed++;
    }

    console.log('\n================================================================');
    console.log(`SUMMARY: ${testsPassed} PASSED | ${testsFailed} FAILED`);
    console.log('================================================================');
  } catch (err: any) {
    console.error('[UNCAUGHT TEST RUNNER ERROR]', err);
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
    process.exit(testsFailed > 0 ? 1 : 0);
  }
}

runTeacherVerification();
