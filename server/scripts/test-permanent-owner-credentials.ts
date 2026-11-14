/**
 * test-permanent-owner-credentials.ts
 *
 * Automated verification test suite for DIGITAL GURU FRANCHISE:
 * Permanent Owner Credential Implementation
 *
 * Covers all 12 test requirements from Section 7:
 * 1. New owner creation returns a permanent password.
 * 2. Database stores only the password hash.
 * 3. First owner login goes directly to the dashboard (mustChangePassword: false).
 * 4. Owner can log in again using the same password.
 * 5. Invalid passwords are rejected (HTTP 401).
 * 6. Super Admin can reset the password.
 * 7. Old password stops working after reset (HTTP 401).
 * 8. New password works after reset (HTTP 200).
 * 9. Owner voluntary password change works (POST /api/auth/change-password).
 * 10. Other roles retain their existing password-change behavior.
 * 11. Non-Super Admin cannot reset owner passwords (HTTP 403 Forbidden).
 * 12. Generated credentials are not written to logs (AuditLog contains no plaintext or hash).
 */

import http from 'http';
import app from '../src/index.js';
import { prisma } from '../src/prisma.js';
import { generateAccessToken, hashPassword, verifyPassword } from '../src/utils/security.js';

interface TestContext {
  server: http.Server;
  baseUrl: string;
  superAdminToken: string;
  createdFranchiseIds: string[];
  createdUserIds: string[];
  createdInstituteIds: string[];
}

const ctx: TestContext = {
  server: null as any,
  baseUrl: '',
  superAdminToken: '',
  createdFranchiseIds: [],
  createdUserIds: [],
  createdInstituteIds: [],
};

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passedCount++;
    console.log(`  [PASS] Test ${passedCount + failedCount}: ${testName}`);
  } else {
    failedCount++;
    console.error(`  [FAIL] Test ${passedCount + failedCount}: ${testName}${details ? ` -> ${details}` : ''}`);
  }
}

async function apiGet(endpoint: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${ctx.baseUrl}${endpoint}`, {
    method: 'GET',
    headers,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, headers: res.headers, data };
}

async function apiPost(endpoint: string, body: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${ctx.baseUrl}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, headers: res.headers, data };
}

async function setup() {
  console.log('========================================================================');
  console.log('DIGITAL GURU FRANCHISE — PERMANENT OWNER CREDENTIAL TEST SUITE');
  console.log('========================================================================\n');

  ctx.server = http.createServer(app);
  await new Promise<void>((resolve) => ctx.server.listen(0, resolve));
  const port = (ctx.server.address() as any).port;
  ctx.baseUrl = `http://127.0.0.1:${port}/api`;
  console.log(`[Setup] Ephemeral test server running at ${ctx.baseUrl}`);

  const superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });
  if (!superAdmin) {
    throw new Error('Super Admin user not found in database.');
  }

  ctx.superAdminToken = generateAccessToken({
    userId: superAdmin.id,
    email: superAdmin.email,
    role: 'SUPER_ADMIN',
  });
  console.log(`[Setup] Super Admin token generated (${superAdmin.email})\n`);
}

async function teardown() {
  console.log('\n[Teardown] Cleaning up test records...');

  for (const fId of ctx.createdFranchiseIds) {
    await prisma.franchiseAgreement.deleteMany({ where: { franchiseId: fId } }).catch(() => {});
    await (prisma as any).franchiseRoyaltyInstallment?.deleteMany({ where: { franchiseId: fId } }).catch(() => {});
    await prisma.institute.updateMany({ where: { franchiseId: fId }, data: { franchiseId: null } }).catch(() => {});
    await prisma.franchise.deleteMany({ where: { id: fId } }).catch(() => {});
  }

  for (const instId of ctx.createdInstituteIds) {
    await prisma.membership.deleteMany({ where: { instituteId: instId } }).catch(() => {});
    await prisma.institute.deleteMany({ where: { id: instId } }).catch(() => {});
  }

  for (const uId of ctx.createdUserIds) {
    await prisma.auditLog.deleteMany({ where: { userId: uId } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { entityId: uId } }).catch(() => {});
    await prisma.passwordResetToken.deleteMany({ where: { userId: uId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: uId } }).catch(() => {});
  }

  if (ctx.server) {
    await new Promise<void>((resolve) => ctx.server.close(() => resolve()));
  }
  await prisma.$disconnect();
  console.log('[Teardown] Cleanup complete.\n');
}

async function runTests() {
  await setup();

  const uniqueSuffix = Date.now().toString().slice(-6);
  const ownerEmail = `owner.perm.${uniqueSuffix}@dg-test.local`;
  const franchiseCode = `DGP${uniqueSuffix.slice(-3)}`;
  const franchiseName = `DG Test Permanent Center ${uniqueSuffix}`;
  let createdPermanentPassword = '';
  let createdOwnerUserId = '';
  let createdFranchiseId = '';

  // --------------------------------------------------------------------------
  // TEST 1: New owner creation returns a permanent password
  // --------------------------------------------------------------------------
  console.log('--- Test 1: New Owner Creation Returns Permanent Password ---');
  const createPayload = {
    code: franchiseCode,
    name: franchiseName,
    ownerName: `Owner Person ${uniqueSuffix}`,
    email: ownerEmail,
    phone: `+9198111${uniqueSuffix.slice(-5)}`,
    address: '123 Enterprise Avenue, Tech Park',
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500081',
    country: 'India',
    initialAgreement: {
      agreementType: 'BRAND_AND_COURSE_SUPPORT',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
      calculationMethod: 'FIXED_ANNUAL',
      annualRoyaltyAmount: 250000,
      dueDay: 10,
    },
  };

  const createRes = await apiPost('/franchises', createPayload, ctx.superAdminToken);
  assert(createRes.status === 201, 'Franchise and Owner created with HTTP 201', `Status: ${createRes.status}`);

  const ownerCreds = createRes.data?.data?.ownerCredentials;
  assert(!!ownerCreds, 'Response contains ownerCredentials object');

  createdPermanentPassword = ownerCreds?.permanentPassword || ownerCreds?.password;
  assert(
    typeof createdPermanentPassword === 'string' && createdPermanentPassword.length >= 20,
    `Permanent password generated with >= 16 bytes entropy (length: ${createdPermanentPassword?.length})`,
    `Received: ${createdPermanentPassword}`
  );
  assert(
    ownerCreds?.mustChangePassword === false,
    'ownerCredentials.mustChangePassword is false (no forced first-login change)'
  );

  createdFranchiseId = createRes.data?.data?.franchise?.id;
  if (createdFranchiseId) ctx.createdFranchiseIds.push(createdFranchiseId);

  // --------------------------------------------------------------------------
  // TEST 2: Database stores only the password hash
  // --------------------------------------------------------------------------
  console.log('\n--- Test 2: Database Stores Only Argon2id Hash (No Plaintext) ---');
  const dbOwner = await prisma.user.findFirst({
    where: { email: { equals: ownerEmail, mode: 'insensitive' } },
  });
  assert(!!dbOwner, 'Owner User found in database');
  if (dbOwner) {
    createdOwnerUserId = dbOwner.id;
    ctx.createdUserIds.push(dbOwner.id);

    assert(
      dbOwner.passwordHash.startsWith('$argon2id$'),
      'Password hash uses Argon2id algorithm ($argon2id$ prefix)'
    );
    assert(
      dbOwner.passwordHash !== createdPermanentPassword,
      'Database passwordHash does not equal plaintext password'
    );
    assert(
      !(dbOwner as any).password && !(dbOwner as any).temporaryPassword,
      'No plaintext password stored anywhere in User schema'
    );
    assert(
      dbOwner.mustChangePassword === false,
      'Database mustChangePassword column is false'
    );

    const matchesHash = await verifyPassword(dbOwner.passwordHash, createdPermanentPassword);
    assert(matchesHash, 'Stored Argon2id hash successfully validates the generated permanent password');
  }

  // --------------------------------------------------------------------------
  // TEST 3: First owner login goes directly to the dashboard
  // --------------------------------------------------------------------------
  console.log('\n--- Test 3: First Owner Login Goes Directly to Dashboard ---');
  const login1Res = await apiPost('/auth/login', {
    identifier: ownerEmail,
    password: createdPermanentPassword,
  });
  assert(login1Res.status === 200, 'First owner login succeeds with HTTP 200', `Status: ${login1Res.status}`);
  assert(
    login1Res.data?.data?.mustChangePassword === false,
    'Login response mustChangePassword is false (exempt from forced change)'
  );
  assert(
    login1Res.data?.data?.user?.role === 'FRANCHISE_OWNER',
    'User role is verified as FRANCHISE_OWNER'
  );

  const ownerAccessToken1 = login1Res.data?.data?.accessToken;
  assert(!!ownerAccessToken1, 'Owner received valid JWT access token');

  // Verify access to franchise owner dashboard
  const dashRes = await apiGet('/franchises/dashboard/owner', ownerAccessToken1);
  assert(dashRes.status === 200, 'Owner access token loads Franchise Owner Dashboard successfully (HTTP 200)');

  // --------------------------------------------------------------------------
  // TEST 4: Owner can log in again using the same password
  // --------------------------------------------------------------------------
  console.log('\n--- Test 4: Owner Can Log In Repeatedly With Same Password ---');
  const login2Res = await apiPost('/auth/login', {
    identifier: ownerEmail,
    password: createdPermanentPassword,
  });
  assert(login2Res.status === 200, 'Second owner login succeeds with HTTP 200');
  assert(login2Res.data?.data?.mustChangePassword === false, 'Second login remains mustChangePassword: false');

  // --------------------------------------------------------------------------
  // TEST 5: Invalid passwords are rejected
  // --------------------------------------------------------------------------
  console.log('\n--- Test 5: Invalid Passwords Are Rejected ---');
  const badLoginRes = await apiPost('/auth/login', {
    identifier: ownerEmail,
    password: 'IncorrectPassword#9999',
  });
  assert(badLoginRes.status === 401, 'Invalid password rejected with HTTP 401', `Status: ${badLoginRes.status}`);

  // --------------------------------------------------------------------------
  // TEST 6: Super Admin can reset the password
  // --------------------------------------------------------------------------
  console.log('\n--- Test 6: Super Admin Resets Owner Password ---');
  const resetRes = await apiPost(
    `/franchises/${createdFranchiseId}/owner/reset-password`,
    {},
    ctx.superAdminToken
  );
  assert(resetRes.status === 200, 'Password reset by Super Admin succeeds with HTTP 200', `Status: ${resetRes.status}`);

  const resetData = resetRes.data?.data;
  const newPermanentPassword = resetData?.permanentPassword || resetData?.password;
  assert(
    typeof newPermanentPassword === 'string' && newPermanentPassword.length >= 20,
    `New permanent password returned with >= 16 bytes entropy (length: ${newPermanentPassword?.length})`
  );
  assert(
    newPermanentPassword !== createdPermanentPassword,
    'New permanent password is fundamentally different from original password'
  );
  assert(
    resetData?.mustChangePassword === false,
    'Reset data specifies mustChangePassword: false'
  );

  const cacheHeader = resetRes.headers.get('cache-control');
  assert(
    cacheHeader?.includes('no-store'),
    'Reset response includes Cache-Control: no-store header to prevent credential caching'
  );

  // --------------------------------------------------------------------------
  // TEST 7: Old password stops working after reset
  // --------------------------------------------------------------------------
  console.log('\n--- Test 7: Old Password Stops Working Immediately ---');
  const oldLoginRes = await apiPost('/auth/login', {
    identifier: ownerEmail,
    password: createdPermanentPassword,
  });
  assert(
    oldLoginRes.status === 401,
    'Old password is immediately invalidated (HTTP 401)',
    `Status: ${oldLoginRes.status}`
  );

  // --------------------------------------------------------------------------
  // TEST 8: New password works after reset
  // --------------------------------------------------------------------------
  console.log('\n--- Test 8: New Password Works for Direct Login ---');
  const newLoginRes = await apiPost('/auth/login', {
    identifier: ownerEmail,
    password: newPermanentPassword,
  });
  assert(newLoginRes.status === 200, 'New permanent password logs in successfully (HTTP 200)');
  assert(
    newLoginRes.data?.data?.mustChangePassword === false,
    'New login goes directly to dashboard with mustChangePassword: false'
  );

  const ownerAccessTokenAfterReset = newLoginRes.data?.data?.accessToken;

  // --------------------------------------------------------------------------
  // TEST 9: Owner voluntary password change works
  // --------------------------------------------------------------------------
  console.log('\n--- Test 9: Owner Voluntary Password Change Works ---');
  const voluntaryPassword = `VoluntaryPass#${Date.now()}!`;
  const changeRes = await apiPost(
    '/auth/change-password',
    {
      currentPassword: newPermanentPassword,
      newPassword: voluntaryPassword,
    },
    ownerAccessTokenAfterReset
  );
  assert(changeRes.status === 200, 'Owner can change password voluntarily (HTTP 200)');

  // Verify voluntary password works
  const voluntaryLoginRes = await apiPost('/auth/login', {
    identifier: ownerEmail,
    password: voluntaryPassword,
  });
  assert(voluntaryLoginRes.status === 200, 'Login with voluntarily updated password succeeds (HTTP 200)');

  // --------------------------------------------------------------------------
  // TEST 10: Other roles retain existing password-change behavior
  // --------------------------------------------------------------------------
  console.log('\n--- Test 10: Other Roles Retain Mandatory Password-Change Behavior ---');
  // Create an ACADEMIC_ADMIN user with mustChangePassword: true
  const staffEmail = `staff.admin.${uniqueSuffix}@dg-test.local`;
  const staffPwd = 'StaffAdminTempPass#2026';
  const staffHash = await hashPassword(staffPwd);

  const staffUser = await prisma.user.create({
    data: {
      email: staffEmail,
      fullName: `Staff Admin ${uniqueSuffix}`,
      passwordHash: staffHash,
      role: 'ACADEMIC_ADMIN',
      isActive: true,
      mustChangePassword: true, // Non-exempt role
    },
  });
  ctx.createdUserIds.push(staffUser.id);

  const staffLoginRes = await apiPost('/auth/login', {
    identifier: staffEmail,
    password: staffPwd,
  });
  assert(staffLoginRes.status === 200, 'Staff user login succeeds');
  assert(
    staffLoginRes.data?.data?.mustChangePassword === true,
    'Non-exempt ACADEMIC_ADMIN role retains mustChangePassword: true enforcement'
  );

  // --------------------------------------------------------------------------
  // TEST 11: Non-Super Admin cannot reset owner passwords
  // --------------------------------------------------------------------------
  console.log('\n--- Test 11: Non-Super Admin Cannot Reset Owner Passwords ---');
  const unauthorizedResetRes = await apiPost(
    `/franchises/${createdFranchiseId}/owner/reset-password`,
    {},
    ownerAccessTokenAfterReset // Owner attempting to call Super Admin reset endpoint
  );
  assert(
    unauthorizedResetRes.status === 403,
    'Non-Super Admin reset attempt rejected with HTTP 403 Forbidden',
    `Status: ${unauthorizedResetRes.status}`
  );

  const anonResetRes = await apiPost(
    `/franchises/${createdFranchiseId}/owner/reset-password`,
    {}
    // No token
  );
  assert(
    anonResetRes.status === 401,
    'Unauthenticated reset attempt rejected with HTTP 401 Unauthorized',
    `Status: ${anonResetRes.status}`
  );

  // --------------------------------------------------------------------------
  // TEST 12: Generated credentials are not written to logs
  // --------------------------------------------------------------------------
  console.log('\n--- Test 12: Generated Credentials Never Stored in Audit Logs ---');
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityId: createdOwnerUserId,
      action: 'FRANCHISE_OWNER_PASSWORD_RESET',
    },
  });
  assert(auditLogs.length > 0, 'AuditLog entry created for FRANCHISE_OWNER_PASSWORD_RESET');

  let sensitiveDataFoundInLogs = false;
  for (const log of auditLogs) {
    const logStr = JSON.stringify(log);
    if (
      logStr.includes(newPermanentPassword) ||
      logStr.includes(createdPermanentPassword) ||
      logStr.includes('$argon2id$')
    ) {
      sensitiveDataFoundInLogs = true;
    }
  }
  assert(
    !sensitiveDataFoundInLogs,
    'Audit logs contain ZERO occurrences of plaintext passwords or password hashes'
  );

  // Summary
  console.log('\n========================================================================');
  console.log(`TEST SUITE RESULTS: ${passedCount} PASSED / ${failedCount} FAILED`);
  console.log('========================================================================');

  await teardown();

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(async (err) => {
  console.error('[Fatal Error in Test Suite]', err);
  await teardown();
  process.exit(1);
});
