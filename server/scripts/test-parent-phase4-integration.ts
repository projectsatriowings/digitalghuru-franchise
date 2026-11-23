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

async function runParentVerification() {
  console.log('================================================================');
  console.log('Digital Guru Franchise — Phase 4: Parent API Verification');
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
    // 1. Parent Login
    console.log('--- 1. Testing Parent Account Login ---');
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: {
        identifier: 'parent@apex.example.com',
        password: 'Password#123',
        role: 'PARENT',
      },
    });

    assert(loginRes.status === 200 && loginRes.data?.success, 'Parent login returns 200 Success', loginRes.data);
    const token = loginRes.data?.data?.accessToken;
    assert(!!token, 'Access token is present');
    assert(loginRes.data?.data?.user?.role === 'PARENT', 'Authenticated role is PARENT');

    // 2. Linked Children
    console.log('\n--- 2. Testing Linked Children (/parents/my/children) ---');
    const childrenRes = await request('/parents/my/children', { token });
    assert(childrenRes.status === 200 && childrenRes.data?.success, 'Get my children returns 200', childrenRes.data);
    const children = childrenRes.data?.data?.children || [];
    assert(Array.isArray(children) && children.length >= 2, `Parent has multiple linked children (${children.length} found)`);

    const aarav = children.find((c: any) => c.student?.firstName === 'Aarav')?.student;
    const pooja = children.find((c: any) => c.student?.firstName === 'Pooja')?.student;
    assert(!!aarav, 'Child 1: Aarav Kumar is linked');
    assert(!!pooja, 'Child 2: Pooja Kumar is linked');

    const studentId = aarav.id;

    // 3. Parent Dashboard Summary
    console.log('\n--- 3. Testing Parent Dashboard Summary (/parents/my/dashboard-summary) ---');
    const dashboardRes = await request('/parents/my/dashboard-summary', { token });
    assert(dashboardRes.status === 200 && dashboardRes.data?.success, 'Dashboard summary returns 200', dashboardRes.data);
    const dData = dashboardRes.data?.data;
    assert(Array.isArray(dData?.children), 'Dashboard summary provides children array');
    const totalFees = dData?.financialOverview?.totalOutstandingFees ?? dData?.totalOutstandingFees;
    assert(typeof totalFees === 'number', 'Total outstanding fees is numeric', dData);

    // 4. Child Attendance Details
    console.log('\n--- 4. Testing Child Attendance (/parents/students/:studentId/attendance) ---');
    const attRes = await request(`/parents/students/${studentId}/attendance`, { token });
    assert(attRes.status === 200 && attRes.data?.success, 'Child attendance returns 200', attRes.data);
    const calList = attRes.data?.data?.calendar || attRes.data?.data?.calendarDays;
    assert(Array.isArray(calList), 'Calendar days breakdown is provided', attRes.data);
    const attPct = attRes.data?.data?.metrics?.attendancePercentage ?? attRes.data?.data?.attendancePercentage;
    assert(typeof attPct === 'number', 'Attendance percentage is numeric', attRes.data);

    // 5. Child Academics & Report Cards
    console.log('\n--- 5. Testing Child Academics (/parents/students/:studentId/academics) ---');
    const acadRes = await request(`/parents/students/${studentId}/academics`, { token });
    assert(acadRes.status === 200 && acadRes.data?.success, 'Child academics returns 200', acadRes.data);
    assert(Array.isArray(acadRes.data?.data?.subjects), 'Child subjects list is provided');
    assert(Array.isArray(acadRes.data?.data?.marks), 'Child exam marks array is provided');

    // 6. Child Homework Tracking
    console.log('\n--- 6. Testing Child Homework Tracking (/parents/students/:studentId/homework) ---');
    const hwRes = await request(`/parents/students/${studentId}/homework`, { token });
    assert(hwRes.status === 200 && hwRes.data?.success, 'Child homework returns 200', hwRes.data);
    assert(Array.isArray(hwRes.data?.data?.homework), 'Child homework array is provided');

    // 7. Child Timetable
    console.log('\n--- 7. Testing Child Timetable (/parents/students/:studentId/timetable) ---');
    const ttRes = await request(`/parents/students/${studentId}/timetable`, { token });
    assert(ttRes.status === 200 && ttRes.data?.success, 'Child timetable returns 200', ttRes.data);
    assert(Array.isArray(ttRes.data?.data?.timetable?.days), 'Structured 7-day schedule is provided');

    // 8. Assigned Faculty / Teachers
    console.log('\n--- 8. Testing Assigned Faculty (/parents/students/:studentId/teachers) ---');
    const teachersRes = await request(`/parents/students/${studentId}/teachers`, { token });
    assert(teachersRes.status === 200 && teachersRes.data?.success, 'Child teachers endpoint returns 200', teachersRes.data);

    // 9. Fee Statement
    console.log('\n--- 9. Testing Fee Statement (/fees/students/:studentId/statement) ---');
    const feeRes = await request(`/fees/students/${studentId}/statement`, {
      token,
      headers: { 'x-institute-id': aarav.instituteId || 'fe91e4a2-8c89-44d9-8609-3509b6d577d3' },
    });
    assert(feeRes.status === 200 && feeRes.data?.success, 'Fee statement returns 200', feeRes.data);
    const payableAmount = feeRes.data?.data?.summary?.totalPayable ?? feeRes.data?.data?.totalFeeAmount ?? 0;
    assert(typeof payableAmount === 'number', 'Total fee amount is numeric', feeRes.data);

    // 10. Fee Payments History
    console.log('\n--- 10. Testing Fee Payments History (/fees/payments) ---');
    const payRes = await request(`/fees/payments?studentId=${studentId}`, {
      token,
      headers: { 'x-institute-id': aarav.instituteId || 'fe91e4a2-8c89-44d9-8609-3509b6d577d3' },
    });
    assert(payRes.status === 200 && payRes.data?.success, 'Payments history returns 200', payRes.data);

    // 11. Parent-Teacher Feedback Inquiries
    console.log('\n--- 11. Testing Feedback Inquiries (/feedback) ---');
    const feedRes = await request(`/feedback?studentId=${studentId}`, {
      token,
      headers: { 'x-institute-id': aarav.instituteId || 'fe91e4a2-8c89-44d9-8609-3509b6d577d3' },
    });
    assert(feedRes.status === 200 && feedRes.data?.success, 'Feedback inquiries returns 200', feedRes.data);

    // 12. Learning Materials
    console.log('\n--- 12. Testing Learning Materials for Child (/materials) ---');
    const matRes = await request('/materials', {
      token,
      headers: { 'x-institute-id': aarav.instituteId || 'fe91e4a2-8c89-44d9-8609-3509b6d577d3' },
    });
    assert(matRes.status === 200, 'Materials endpoint returns 200 for parent', matRes.data);

    // 13. Notifications
    console.log('\n--- 13. Testing Notifications (/notifications) ---');
    const notifRes = await request('/notifications', { token });
    assert(notifRes.status === 200, 'Notifications endpoint returns 200', notifRes.data);

    // 14. Security: Cross-Parent Isolation (Unauthorized Student ID)
    console.log('\n--- 14. Security: Cross-Parent Isolation Enforcement ---');
    const foreignStudentId = 'e0adcc2a-0dfc-4be6-ae06-2d24a0ddac58'; // Balaji's child (sri B)
    const unauthorizedAtt = await request(`/parents/students/${foreignStudentId}/attendance`, { token });
    assert(
      unauthorizedAtt.status === 403 && !unauthorizedAtt.data?.success,
      'Access to unrelated child attendance is blocked with 403 Forbidden',
      unauthorizedAtt.data
    );

    const unauthorizedHw = await request(`/parents/students/${foreignStudentId}/homework`, { token });
    assert(
      unauthorizedHw.status === 403 && !unauthorizedHw.data?.success,
      'Access to unrelated child homework is blocked with 403 Forbidden',
      unauthorizedHw.data
    );

    const unauthorizedTt = await request(`/parents/students/${foreignStudentId}/timetable`, { token });
    assert(
      unauthorizedTt.status === 403 && !unauthorizedTt.data?.success,
      'Access to unrelated child timetable is blocked with 403 Forbidden',
      unauthorizedTt.data
    );

    // 15. Security: Role Isolation (Parent cannot submit homework)
    console.log('\n--- 15. Security: Role Isolation (Parent cannot submit homework) ---');
    const subAttempt = await request('/homework/some-id/submissions', {
      method: 'POST',
      token,
      headers: { 'x-institute-id': aarav.instituteId || 'fe91e4a2-8c89-44d9-8609-3509b6d577d3' },
      body: { notes: 'Parent submitting' },
    });
    assert(subAttempt.status === 403, 'Parent submitting homework is blocked with 403 Forbidden');

    console.log(`\n================================================================`);
    console.log(`Phase 4 Parent Backend Tests Complete: ${passed}/${total} Passed`);
    console.log(`================================================================\n`);
  } catch (err: any) {
    console.error('Test execution failed:', err);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runParentVerification();
