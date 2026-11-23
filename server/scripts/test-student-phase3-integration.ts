import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import app from '../src/index.js';

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

async function runStudentVerification() {
  console.log('================================================================');
  console.log('Digital Guru Franchise — Phase 3: Student API Verification');
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

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, message: string, details?: any) {
    total++;
    if (condition) {
      console.log(`  [PASS] Test ${total}: ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] Test ${total}: ${message}`);
      if (details) console.error('         Details:', JSON.stringify(details, null, 2));
    }
  }

  try {
    // 1. Student Login
    console.log('--- 1. Testing Student Account Login ---');
    const studentRes = await request('/auth/login', {
      method: 'POST',
      body: {
        identifier: 'student@apexacademy.com',
        password: 'Password#123',
        role: 'STUDENT',
      },
    });

    assert(studentRes.status === 200 && studentRes.data?.success, 'Student login returns 200 Success', studentRes.data);
    const token = studentRes.data?.data?.accessToken;
    assert(!!token, 'Access token is present');

    // 2. Student Profile
    console.log('\n--- 2. Testing Student Profile (/students/my/profile) ---');
    const profileRes = await request('/students/my/profile', { token });
    assert(profileRes.status === 200 && profileRes.data?.success, 'Profile endpoint returns 200', profileRes.data);
    const studentObj = profileRes.data?.data?.student || profileRes.data?.data;
    assert(studentObj?.admissionNumber === 'ADM-2026-001', 'Admission number matches ADM-2026-001', studentObj);
    assert(studentObj?.firstName === 'Aarav', 'Student first name is Aarav', studentObj);

    // 3. Student Dashboard
    console.log('\n--- 3. Testing Student Dashboard (/students/my/dashboard) ---');
    const dashboardRes = await request('/students/my/dashboard', { token });
    assert(dashboardRes.status === 200 && dashboardRes.data?.success, 'Dashboard endpoint returns 200', dashboardRes.data);
    const dData = dashboardRes.data?.data;
    assert(dData?.student?.fullName === 'Aarav Kumar', 'Dashboard contains student full name');
    assert(Array.isArray(dData?.todayClasses), 'Dashboard contains todayClasses array');
    assert(typeof dData?.attendanceOverview?.percentage === 'number', 'Attendance percentage is numeric');
    assert(typeof dData?.homeworkOverview?.pendingCount === 'number', 'Pending homework count is numeric');
    assert(Array.isArray(dData?.recentMaterials), 'Recent materials array is returned');
    assert(Array.isArray(dData?.academicProgress?.recentMarks), 'Academic progress recent marks array is returned');
    assert(typeof dData?.notificationsOverview?.unreadCount === 'number', 'Unread notification count is returned');

    // 4. Student Timetable
    console.log('\n--- 4. Testing Student Timetable (/students/my/timetable) ---');
    const timetableRes = await request('/students/my/timetable', { token });
    assert(timetableRes.status === 200 && timetableRes.data?.success, 'Timetable endpoint returns 200', timetableRes.data);
    const tData = timetableRes.data?.data?.timetable;
    assert(Array.isArray(tData?.todaySlots), 'Timetable provides todaySlots');
    assert(Array.isArray(tData?.days) && tData.days.length === 7, 'Timetable provides 7 day schedules');

    // 5. Student Attendance History
    console.log('\n--- 5. Testing Student Attendance History (/students/my/attendance-history) ---');
    const attRes = await request('/students/my/attendance-history', { token });
    assert(attRes.status === 200 && attRes.data?.success, 'Attendance history endpoint returns 200', attRes.data);
    assert(Array.isArray(attRes.data?.data?.events), 'Attendance history returns events array');
    assert(typeof attRes.data?.data?.stats?.totalDays === 'number', 'Attendance stats totalDays is numeric');

    // 6. Learning Materials
    console.log('\n--- 6. Testing Learning Materials (/materials) ---');
    const matRes = await request('/materials', { token });
    assert(matRes.status === 200, 'Materials endpoint returns 200', matRes.data);

    // 7. Homework List
    console.log('\n--- 7. Testing Homework List (/homework) ---');
    const hwRes = await request('/homework', { token });
    assert(hwRes.status === 200, 'Homework endpoint returns 200', hwRes.data);

    // 8. Notifications
    console.log('\n--- 8. Testing Notifications (/notifications) ---');
    const notifRes = await request('/notifications', { token });
    assert(notifRes.status === 200, 'Notifications endpoint returns 200', notifRes.data);

    console.log(`\n================================================================`);
    console.log(`Phase 3 Student Backend Tests Complete: ${passed}/${total} Passed`);
    console.log(`================================================================\n`);
  } catch (err: any) {
    console.error('Test execution failed:', err);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runStudentVerification();
