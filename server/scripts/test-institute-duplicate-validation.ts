/**
 * test-institute-duplicate-validation.ts
 *
 * Automated verification test suite for DIGITAL GURU FRANCHISE - A08:
 * Tests all 14 duplicate validation and lifecycle requirements:
 * 1. New unique institute email — PASS.
 * 2. Duplicate institute email with same capitalization — REJECT.
 * 3. Duplicate institute email with different capitalization — REJECT.
 * 4. Duplicate institute email with surrounding whitespace — REJECT.
 * 5. Same institute name in same franchise — REJECT (collision in same center).
 * 6. Same institute name in a different franchise — WARNING, legitimate creation allowed.
 * 7. Same institute name in a different location — WARNING, legitimate creation allowed.
 * 8. Duplicate institute phone — WARNING and explicit confirmation required.
 * 9. Duplicate admin email — existing rejection preserved.
 * 10. Duplicate admin phone — existing rejection preserved.
 * 11. Duplicate institute code — REJECT.
 * 12. Concurrent duplicate institute email submissions — only one succeeds.
 * 13. Editing an institute without changing its own email — PASS.
 * 14. Editing an institute to another institute's email — REJECT.
 */

import http from 'http';
import app from '../src/index.js';
import { prisma } from '../src/prisma.js';
import { generateAccessToken } from '../src/utils/security.js';

interface TestContext {
  server: http.Server;
  baseUrl: string;
  superAdminToken: string;
  createdInstituteIds: string[];
  createdUserIds: string[];
  createdFranchiseIds: string[];
}

const ctx: TestContext = {
  server: null as any,
  baseUrl: '',
  superAdminToken: '',
  createdInstituteIds: [],
  createdUserIds: [],
  createdFranchiseIds: [],
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

async function apiPost(endpoint: string, body: any, token = ctx.superAdminToken) {
  const res = await fetch(`${ctx.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function apiPatch(endpoint: string, body: any, token = ctx.superAdminToken) {
  const res = await fetch(`${ctx.baseUrl}${endpoint}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function setup() {
  console.log('================================================================');
  console.log('DIGITAL GURU FRANCHISE — A08 DUPLICATE INSTITUTE VALIDATION TEST');
  console.log('================================================================\n');

  // Start ephemeral server
  ctx.server = http.createServer(app);
  await new Promise<void>((resolve) => ctx.server.listen(0, resolve));
  const port = (ctx.server.address() as any).port;
  ctx.baseUrl = `http://127.0.0.1:${port}/api`;
  console.log(`[Setup] Ephemeral test server running at ${ctx.baseUrl}`);

  // Fetch or setup super admin user
  let superAdmin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN' },
  });

  if (!superAdmin) {
    throw new Error('Super Admin user not found in database. Please seed super admin first.');
  }

  ctx.superAdminToken = generateAccessToken({
    userId: superAdmin.id,
    email: superAdmin.email,
    role: 'SUPER_ADMIN',
  });
  console.log(`[Setup] Authenticated as Super Admin (${superAdmin.email})\n`);
}

async function cleanup() {
  console.log('\n[Cleanup] Removing temporary test records safely...');

  // Delete memberships and audit logs for created institutes
  for (const id of ctx.createdInstituteIds) {
    try {
      await prisma.auditLog.deleteMany({ where: { instituteId: id } });
      await prisma.instituteMembership.deleteMany({ where: { instituteId: id } });
      await prisma.institute.delete({ where: { id } }).catch(() => {});
    } catch {
      // ignore
    }
  }

  // Delete created admin users
  for (const uid of ctx.createdUserIds) {
    try {
      await prisma.instituteMembership.deleteMany({ where: { userId: uid } });
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    } catch {
      // ignore
    }
  }

  // Delete created test franchises
  for (const fid of ctx.createdFranchiseIds) {
    try {
      await prisma.franchise.delete({ where: { id: fid } }).catch(() => {});
    } catch {
      // ignore
    }
  }

  if (ctx.server) {
    await new Promise<void>((resolve) => ctx.server.close(() => resolve()));
  }

  await prisma.$disconnect();
  console.log('[Cleanup] Test teardown complete.');
}

async function runTests() {
  const nonce = Date.now().toString(36);

  // Create two temporary test franchises for testing same vs cross franchise name collisions
  const frA = await prisma.franchise.create({
    data: {
      name: `Test Franchise Alpha ${nonce}`,
      code: `FR-A-${nonce.toUpperCase()}`.slice(0, 15),
      ownerName: 'Owner Alpha',
      email: `owner.alpha.${nonce}@example.com`,
      phone: `9111${Math.floor(100000 + Math.random() * 900000)}`,
      city: 'Chennai',
      state: 'Tamil Nadu',
      status: 'ACTIVE',
    },
  });
  ctx.createdFranchiseIds.push(frA.id);

  const frB = await prisma.franchise.create({
    data: {
      name: `Test Franchise Beta ${nonce}`,
      code: `FR-B-${nonce.toUpperCase()}`.slice(0, 15),
      ownerName: 'Owner Beta',
      email: `owner.beta.${nonce}@example.com`,
      phone: `9222${Math.floor(100000 + Math.random() * 900000)}`,
      city: 'Madurai',
      state: 'Tamil Nadu',
      status: 'ACTIVE',
    },
  });
  ctx.createdFranchiseIds.push(frB.id);

  console.log(`[Setup] Created Test Franchise A (${frA.code}) and Franchise B (${frB.code})`);

  // =========================================================================
  // TEST 1: New unique institute email — PASS
  // =========================================================================
  const email1 = `primary.${nonce}@dg-test-campus.edu`;
  const adminEmail1 = `admin.t1.${nonce}@test.edu`;
  const res1 = await apiPost('/institutes', {
    name: `DG Test Campus One ${nonce}`,
    email: email1,
    phone: `9840${Math.floor(100000 + Math.random() * 900000)}`,
    city: 'Chennai',
    state: 'Tamil Nadu',
    adminFullName: 'Admin One',
    adminEmail: adminEmail1,
    adminPhone: `9101${Math.floor(100000 + Math.random() * 900000)}`,
    adminInitialPassword: 'Password#123!',
  });

  const inst1Id = res1.data?.data?.institute?.id;
  const admin1Id = res1.data?.data?.initialAdmin?.id;
  if (inst1Id) ctx.createdInstituteIds.push(inst1Id);
  if (admin1Id) ctx.createdUserIds.push(admin1Id);

  assert(res1.status === 201 && res1.data?.success === true, '1. New unique institute email — PASS', JSON.stringify(res1.data));

  // =========================================================================
  // TEST 2: Duplicate institute email with same capitalization — REJECT (HTTP 409)
  // =========================================================================
  const res2 = await apiPost('/institutes', {
    name: `DG Test Campus Two ${nonce}`,
    email: email1, // exact duplicate
    city: 'Chennai',
    adminFullName: 'Admin Two',
    adminEmail: `admin.t2.${nonce}@test.edu`,
    adminInitialPassword: 'Password#123!',
  });
  if (res2.data?.data?.institute?.id) ctx.createdInstituteIds.push(res2.data.data.institute.id);
  if (res2.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res2.data.data.initialAdmin.id);

  assert(
    res2.status === 409 &&
      res2.data?.success === false &&
      res2.data?.error?.includes('already exists'),
    '2. Duplicate institute email with same capitalization — REJECT (HTTP 409)',
    JSON.stringify(res2.data)
  );

  // =========================================================================
  // TEST 3: Duplicate institute email with different capitalization — REJECT (HTTP 409)
  // =========================================================================
  const res3 = await apiPost('/institutes', {
    name: `DG Test Campus Three ${nonce}`,
    email: email1.toUpperCase(), // UPPERCASE DUPLICATE
    city: 'Chennai',
    adminFullName: 'Admin Three',
    adminEmail: `admin.t3.${nonce}@test.edu`,
    adminInitialPassword: 'Password#123!',
  });
  if (res3.data?.data?.institute?.id) ctx.createdInstituteIds.push(res3.data.data.institute.id);
  if (res3.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res3.data.data.initialAdmin.id);

  assert(
    res3.status === 409 &&
      res3.data?.success === false &&
      res3.data?.error?.includes('already exists'),
    '3. Duplicate institute email with different capitalization — REJECT (HTTP 409)',
    JSON.stringify(res3.data)
  );

  // =========================================================================
  // TEST 4: Duplicate institute email with surrounding whitespace — REJECT (HTTP 409)
  // =========================================================================
  const res4 = await apiPost('/institutes', {
    name: `DG Test Campus Four ${nonce}`,
    email: `   ${email1}   `, // whitespace padded
    city: 'Chennai',
    adminFullName: 'Admin Four',
    adminEmail: `admin.t4.${nonce}@test.edu`,
    adminInitialPassword: 'Password#123!',
  });
  if (res4.data?.data?.institute?.id) ctx.createdInstituteIds.push(res4.data.data.institute.id);
  if (res4.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res4.data.data.initialAdmin.id);

  assert(
    res4.status === 409 &&
      res4.data?.success === false &&
      res4.data?.error?.includes('already exists'),
    '4. Duplicate institute email with surrounding whitespace — REJECT (HTTP 409)',
    JSON.stringify(res4.data)
  );

  // =========================================================================
  // TEST 5: Same institute name in same franchise — REJECT (HTTP 409)
  // =========================================================================
  const franchiseCampusName = `Excellence Academy ${nonce}`;
  const res5a = await apiPost('/institutes', {
    name: franchiseCampusName,
    franchiseId: frA.id,
    city: 'Chennai',
    adminFullName: 'Admin Five A',
    adminEmail: `admin.t5a.${nonce}@test.edu`,
    adminInitialPassword: 'Password#123!',
  });
  if (res5a.data?.data?.institute?.id) ctx.createdInstituteIds.push(res5a.data.data.institute.id);
  if (res5a.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res5a.data.data.initialAdmin.id);

  const res5b = await apiPost('/institutes', {
    name: franchiseCampusName.toLowerCase(), // same name in same franchise
    franchiseId: frA.id,
    city: 'Chennai',
    adminFullName: 'Admin Five B',
    adminEmail: `admin.t5b.${nonce}@test.edu`,
    adminInitialPassword: 'Password#123!',
  });
  if (res5b.data?.data?.institute?.id) ctx.createdInstituteIds.push(res5b.data.data.institute.id);
  if (res5b.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res5b.data.data.initialAdmin.id);

  assert(
    res5a.status === 201 &&
      res5b.status === 409 &&
      res5b.data?.error?.includes('already exists within this franchise center'),
    '5. Same institute name in same franchise — REJECT (HTTP 409)',
    `5a status=${res5a.status}, 5b status=${res5b.status}`
  );

  // =========================================================================
  // TEST 6: Same institute name in a different franchise — WARNING, legitimate creation allowed
  // =========================================================================
  const res6 = await apiPost('/institutes', {
    name: franchiseCampusName, // same name, but in Franchise B
    franchiseId: frB.id,
    city: 'Madurai',
    adminFullName: 'Admin Six',
    adminEmail: `admin.t6.${nonce}@test.edu`,
    adminInitialPassword: 'Password#123!',
  });
  if (res6.data?.data?.institute?.id) ctx.createdInstituteIds.push(res6.data.data.institute.id);
  if (res6.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res6.data.data.initialAdmin.id);

  assert(
    res6.status === 201 &&
      res6.data?.success === true &&
      Array.isArray(res6.data?.warnings) &&
      res6.data.warnings.some((w: string) => w.includes('Notice: Another institute named')),
    '6. Same institute name in a different franchise — WARNING, legitimate creation allowed (HTTP 201)',
    JSON.stringify(res6.data)
  );

  // =========================================================================
  // TEST 7: Same institute name in a different location (Standalone) — WARNING, legitimate creation allowed
  // =========================================================================
  const standaloneName = `Pioneer Science Campus ${nonce}`;
  const res7a = await apiPost('/institutes', {
    name: standaloneName,
    city: 'Coimbatore',
    adminFullName: 'Admin Seven A',
    adminEmail: `admin.t7a.${nonce}@test.edu`,
    adminInitialPassword: 'Password#123!',
  });
  if (res7a.data?.data?.institute?.id) ctx.createdInstituteIds.push(res7a.data.data.institute.id);
  if (res7a.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res7a.data.data.initialAdmin.id);

  const res7b = await apiPost('/institutes', {
    name: standaloneName, // same name, but in Tirunelveli
    city: 'Tirunelveli',
    adminFullName: 'Admin Seven B',
    adminEmail: `admin.t7b.${nonce}@test.edu`,
    adminInitialPassword: 'Password#123!',
  });
  if (res7b.data?.data?.institute?.id) ctx.createdInstituteIds.push(res7b.data.data.institute.id);
  if (res7b.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res7b.data.data.initialAdmin.id);

  assert(
    res7a.status === 201 &&
      res7b.status === 201 &&
      res7b.data?.success === true &&
      res7b.data.warnings?.some((w: string) => w.includes('Notice: Another institute named')),
    '7. Same institute name in a different location — WARNING, legitimate creation allowed (HTTP 201)',
    `7a=${res7a.status}, 7b=${res7b.status}`
  );

  // =========================================================================
  // TEST 8: Duplicate institute phone — WARNING and explicit confirmation required
  // =========================================================================
  const sharedPhone = `+91 94444 ${Math.floor(10000 + Math.random() * 90000)}`;
  const res8a = await apiPost('/institutes', {
    name: `Phone Campus A ${nonce}`,
    phone: sharedPhone,
    adminFullName: 'Admin Eight A',
    adminEmail: `admin.t8a.${nonce}@test.edu`,
    adminInitialPassword: 'Password#123!',
  });
  if (res8a.data?.data?.institute?.id) ctx.createdInstituteIds.push(res8a.data.data.institute.id);
  if (res8a.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res8a.data.data.initialAdmin.id);

  // Attempt duplicate phone without confirmation flag
  const res8b = await apiPost('/institutes', {
    name: `Phone Campus B ${nonce}`,
    phone: sharedPhone.replace(/\s+/g, ''), // formatted without spaces
    adminFullName: 'Admin Eight B',
    adminEmail: `admin.t8b.${nonce}@test.edu`,
    adminInitialPassword: 'Password#123!',
  });
  if (res8b.data?.data?.institute?.id) ctx.createdInstituteIds.push(res8b.data.data.institute.id);
  if (res8b.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res8b.data.data.initialAdmin.id);

  // Attempt duplicate phone WITH explicit confirmation flag
  const res8c = await apiPost('/institutes', {
    name: `Phone Campus C ${nonce}`,
    phone: sharedPhone,
    confirmDuplicatePhone: true, // EXPLICIT CONFIRMATION
    adminFullName: 'Admin Eight C',
    adminEmail: `admin.t8c.${nonce}@test.edu`,
    adminInitialPassword: 'Password#123!',
  });
  if (res8c.data?.data?.institute?.id) ctx.createdInstituteIds.push(res8c.data.data.institute.id);
  if (res8c.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res8c.data.data.initialAdmin.id);

  assert(
    res8a.status === 201 &&
      res8b.status === 409 &&
      res8b.data?.requiresConfirmation === true &&
      res8c.status === 201 &&
      res8c.data?.success === true,
    '8. Duplicate institute phone — WARNING and explicit confirmation required (HTTP 409 -> HTTP 201)',
    `8a=${res8a.status}, 8b=${res8b.status}, 8c=${res8c.status}`
  );

  // =========================================================================
  // TEST 9: Duplicate admin email — existing rejection preserved
  // =========================================================================
  const res9 = await apiPost('/institutes', {
    name: `DG Test Campus Nine ${nonce}`,
    adminFullName: 'Admin Nine',
    adminEmail: adminEmail1, // existing admin user from Test 1
    adminInitialPassword: 'Password#123!',
  });
  if (res9.data?.data?.institute?.id) ctx.createdInstituteIds.push(res9.data.data.institute.id);
  if (res9.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res9.data.data.initialAdmin.id);

  assert(
    res9.status === 409 &&
      res9.data?.success === false &&
      res9.data?.error?.includes('already exists'),
    '9. Duplicate admin email — existing rejection preserved (HTTP 409)',
    JSON.stringify(res9.data)
  );

  // =========================================================================
  // TEST 10: Duplicate admin phone — existing rejection preserved
  // =========================================================================
  const adminPhone10 = `9333${Math.floor(100000 + Math.random() * 900000)}`;
  const res10a = await apiPost('/institutes', {
    name: `DG Test Campus Ten A ${nonce}`,
    adminFullName: 'Admin Ten A',
    adminEmail: `admin.t10a.${nonce}@test.edu`,
    adminPhone: adminPhone10,
    adminInitialPassword: 'Password#123!',
  });
  if (res10a.data?.data?.institute?.id) ctx.createdInstituteIds.push(res10a.data.data.institute.id);
  if (res10a.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res10a.data.data.initialAdmin.id);

  const res10b = await apiPost('/institutes', {
    name: `DG Test Campus Ten B ${nonce}`,
    adminFullName: 'Admin Ten B',
    adminEmail: `admin.t10b.${nonce}@test.edu`,
    adminPhone: adminPhone10, // duplicate admin phone
    adminInitialPassword: 'Password#123!',
  });
  if (res10b.data?.data?.institute?.id) ctx.createdInstituteIds.push(res10b.data.data.institute.id);
  if (res10b.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res10b.data.data.initialAdmin.id);

  assert(
    res10a.status === 201 &&
      res10b.status === 409 &&
      res10b.data?.error?.includes('already exists'),
    '10. Duplicate admin phone — existing rejection preserved (HTTP 409)',
    `10a=${res10a.status}, 10b=${res10b.status}`
  );

  // =========================================================================
  // TEST 11: Duplicate institute code — REJECT (HTTP 409)
  // =========================================================================
  const existingCode = res1.data?.data?.institute?.code;
  const res11 = await apiPost('/institutes', {
    code: existingCode, // duplicate manually supplied code
    name: `DG Test Campus Eleven ${nonce}`,
    adminFullName: 'Admin Eleven',
    adminEmail: `admin.t11.${nonce}@test.edu`,
    adminInitialPassword: 'Password#123!',
  });
  if (res11.data?.data?.institute?.id) ctx.createdInstituteIds.push(res11.data.data.institute.id);
  if (res11.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(res11.data.data.initialAdmin.id);

  assert(
    res11.status === 409 &&
      res11.data?.success === false &&
      res11.data?.error?.includes('already exists'),
    '11. Duplicate institute code — REJECT (HTTP 409)',
    JSON.stringify(res11.data)
  );

  // =========================================================================
  // TEST 12: Concurrent duplicate institute email submissions — only one succeeds
  // =========================================================================
  const concurrentEmail = `concurrent.${nonce}@dg-test.edu`;
  const [c1, c2] = await Promise.all([
    apiPost('/institutes', {
      name: `DG Concurrent Campus A ${nonce}`,
      email: concurrentEmail,
      adminFullName: 'Admin Concurrent A',
      adminEmail: `admin.conc.a.${nonce}@test.edu`,
      adminInitialPassword: 'Password#123!',
    }),
    apiPost('/institutes', {
      name: `DG Concurrent Campus B ${nonce}`,
      email: concurrentEmail,
      adminFullName: 'Admin Concurrent B',
      adminEmail: `admin.conc.b.${nonce}@test.edu`,
      adminInitialPassword: 'Password#123!',
    }),
  ]);

  if (c1.data?.data?.institute?.id) ctx.createdInstituteIds.push(c1.data.data.institute.id);
  if (c1.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(c1.data.data.initialAdmin.id);
  if (c2.data?.data?.institute?.id) ctx.createdInstituteIds.push(c2.data.data.institute.id);
  if (c2.data?.data?.initialAdmin?.id) ctx.createdUserIds.push(c2.data.data.initialAdmin.id);

  const statuses = [c1.status, c2.status].sort();
  const oneSuccessOne409 = statuses[0] === 201 && statuses[1] === 409;

  assert(
    oneSuccessOne409,
    '12. Concurrent duplicate institute email submissions — only one succeeds',
    `c1=${c1.status}, c2=${c2.status}`
  );

  // =========================================================================
  // TEST 13: Editing an institute without changing its own email — PASS (HTTP 200)
  // =========================================================================
  const res13 = await apiPatch(`/institutes/${inst1Id}`, {
    email: email1, // same own email
    address: 'Updated 100 Main Road Campus Avenue',
    city: 'Chennai',
  });

  assert(
    res13.status === 200 && res13.data?.success === true,
    '13. Editing an institute without changing its own email — PASS (HTTP 200)',
    JSON.stringify(res13.data)
  );

  // =========================================================================
  // TEST 14: Editing an institute to another institute's email — REJECT (HTTP 409)
  // =========================================================================
  // Attempt to edit inst1Id to use concurrentEmail (which was created in Test 12)
  const res14 = await apiPatch(`/institutes/${inst1Id}`, {
    email: concurrentEmail, // belongs to the concurrent institute
  });

  assert(
    res14.status === 409 &&
      res14.data?.success === false &&
      res14.data?.error?.includes('already exists'),
    "14. Editing an institute to another institute's email — REJECT (HTTP 409)",
    JSON.stringify(res14.data)
  );

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedCount}/14 PASSED, ${failedCount} FAILED`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    throw new Error(`${failedCount} test(s) failed.`);
  }
}

async function main() {
  try {
    await setup();
    await runTests();
    process.exit(0);
  } finally {
    await cleanup();
  }
}

main().catch((err) => {
  console.error('[Fatal Test Failure]', err);
  process.exit(1);
});
