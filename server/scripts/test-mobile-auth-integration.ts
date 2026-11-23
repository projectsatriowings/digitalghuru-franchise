import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import app from '../src/index.js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

let server: http.Server;
let port: number;
let baseUrl: string;

function request(path: string, options: any = {}): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${baseUrl}${path}`);
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

async function runMobileAuthVerification() {
  console.log('================================================================');
  console.log('Digital Guru Franchise — Phase 2: Mobile Authentication Verification');
  console.log('================================================================\n');

  // Start ephemeral server
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
    // 1. Student Login
    console.log('--- 1. Testing Student Account Authentication ---');
    const studentRes = await request('/auth/login', {
      method: 'POST',
      body: {
        identifier: 'student@apexacademy.com',
        password: 'Password#123',
        role: 'STUDENT',
      },
    });

    assert(studentRes.status === 200 && studentRes.data?.success, 'Student login returns 200 Success');
    assert(studentRes.data?.data?.user?.role === 'STUDENT', 'Student role is verified server-side');
    assert(!!studentRes.data?.data?.accessToken, 'Access token is returned');
    assert(!!studentRes.data?.data?.refreshToken, 'Refresh token is returned');
    assert(studentRes.data?.data?.user?.mustChangePassword === false, 'Student is exempt from mandatory password change');

    const studentToken = studentRes.data?.data?.accessToken;
    const studentRefreshToken = studentRes.data?.data?.refreshToken;

    // 2. Parent Login
    console.log('\n--- 2. Testing Parent Account Authentication ---');
    const parentRes = await request('/auth/login', {
      method: 'POST',
      body: {
        identifier: 'parent@apexacademy.com',
        password: 'Password#123',
        role: 'PARENT',
      },
    });

    assert(parentRes.status === 200 && parentRes.data?.success, 'Parent login returns 200 Success');
    assert(parentRes.data?.data?.user?.role === 'PARENT', 'Parent role is verified server-side');
    assert(!!parentRes.data?.data?.accessToken, 'Parent access token is returned');

    // 3. Teacher (Staff) Login
    console.log('\n--- 3. Testing Teacher (STAFF) Account Authentication ---');
    const teacherRes = await request('/auth/login', {
      method: 'POST',
      body: {
        identifier: 'teacher@apexacademy.com',
        password: 'Password#123',
        role: 'STAFF',
      },
    });

    assert(teacherRes.status === 200 && teacherRes.data?.success, 'Teacher login returns 200 Success');
    assert(teacherRes.data?.data?.user?.role === 'STAFF', 'Teacher role is STAFF on backend');
    assert(!!teacherRes.data?.data?.accessToken, 'Teacher access token is returned');

    // 4. Role Mismatch Rejection
    console.log('\n--- 4. Testing Role Mismatch Security Enforcement ---');
    const mismatchRes = await request('/auth/login', {
      method: 'POST',
      body: {
        identifier: 'student@apexacademy.com',
        password: 'Password#123',
        role: 'STAFF', // Selecting Teacher for a Student account
      },
    });

    assert(mismatchRes.status === 403, 'Role mismatch is rejected with 403 Forbidden');
    assert(
      mismatchRes.data?.error?.includes('mismatch'),
      'Server explicitly blocks login when selected role mismatches registered role'
    );

    // 5. Invalid Credentials Rejection
    console.log('\n--- 5. Testing Invalid Credentials Rejection ---');
    const invalidRes = await request('/auth/login', {
      method: 'POST',
      body: {
        identifier: 'student@apexacademy.com',
        password: 'WrongPassword#999',
      },
    });

    assert(invalidRes.status === 401, 'Invalid password rejected with 401 Unauthorized');
    assert(invalidRes.data?.error === 'Invalid email, phone, or password', 'Generic error prevents user enumeration');

    // 6. Token Refresh
    console.log('\n--- 6. Testing Token Refresh Flow ---');
    const refreshRes = await request('/auth/refresh', {
      method: 'POST',
      body: {
        refreshToken: studentRefreshToken,
      },
    });

    assert(refreshRes.status === 200 && refreshRes.data?.success, 'Token refresh returns 200 Success');
    assert(!!refreshRes.data?.data?.accessToken, 'New access token generated');
    assert(!!refreshRes.data?.data?.refreshToken, 'New refresh token rotated');

    const newAccessToken = refreshRes.data?.data?.accessToken;

    // 7. Authenticated /api/auth/me using refreshed token
    console.log('\n--- 7. Testing Authenticated User Session Retrieval (/api/auth/me) ---');
    const meRes = await request('/auth/me', {
      token: newAccessToken,
    });

    assert(meRes.status === 200 && meRes.data?.success, 'Authenticated /api/auth/me returns 200 Success');
    assert(meRes.data?.data?.user?.id === studentRes.data?.data?.user?.id, 'Returns sanitized profile matching student user ID');
    assert(meRes.data?.data?.user?.role === 'STUDENT', 'Returns correct STUDENT role in profile');
    assert(!meRes.data?.data?.user?.passwordHash, 'Password hash is strictly omitted from profile response');

    // 8. Self-Service Password Reset Blocked for Student/Parent
    console.log('\n--- 8. Testing Prohibition of Student/Parent Password Modification ---');
    const changePasswordRes = await request('/auth/change-password', {
      method: 'POST',
      token: studentToken,
      body: {
        currentPassword: 'Password#123',
        newPassword: 'NewPassword#456',
      },
    });

    assert(changePasswordRes.status === 403, 'Student cannot self-modify credentials (403 Forbidden)');
    assert(
      changePasswordRes.data?.error?.includes('managed exclusively by institute staff'),
      'Enforces institutional rule: credentials managed exclusively by center staff'
    );

    console.log('\n================================================================');
    console.log(`Results: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
    console.log('================================================================');

    if (passed !== total) {
      process.exit(1);
    }
  } finally {
    if (server) {
      server.close();
      console.log('\n[Test Server] Stopped cleanly.');
    }
  }
}

runMobileAuthVerification().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
