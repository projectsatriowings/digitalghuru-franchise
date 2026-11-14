/**
 * test-franchise-details-and-credentials.ts
 *
 * Automated verification test suite for DIGITAL GURU FRANCHISE:
 * Franchise Details & Owner Credentials Visibility Fix
 *
 * Covers all 10 Section 7 Verification items:
 * 1. Open an existing franchise from the list (GET /franchises/:id).
 * 2. Confirm the correct franchise details appear.
 * 3. Confirm the correct owner email and mobile number appear.
 * 4. Confirm associated branches are displayed.
 * 5. Reset the owner's password (POST /franchises/:id/owner/reset-password).
 * 6. Confirm the new password works for owner login.
 * 7. Confirm the old password no longer works.
 * 8. Confirm a normal franchise owner cannot access Super Admin credential-management operations.
 * 9. Confirm the franchise list still supports search, filters, and branch interactions.
 * 10. Confirm the creation confirmation displays initial credentials correctly.
 */

import http from 'http';
import app from '../src/index.js';
import { prisma } from '../src/prisma.js';
import { generateAccessToken, hashPassword } from '../src/utils/security.js';

interface TestContext {
  server: http.Server;
  baseUrl: string;
  superAdminToken: string;
  ownerToken: string;
  testFranchiseId: string;
  testOwnerUserId: string;
  testBranchId: string;
  createdFranchiseIds: string[];
  createdUserIds: string[];
  createdInstituteIds: string[];
}

const ctx: TestContext = {
  server: null as any,
  baseUrl: '',
  superAdminToken: '',
  ownerToken: '',
  testFranchiseId: '',
  testOwnerUserId: '',
  testBranchId: '',
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

async function apiGet(endpoint: string, token = ctx.superAdminToken) {
  const res = await fetch(`${ctx.baseUrl}${endpoint}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function apiPost(endpoint: string, body: any, token = ctx.superAdminToken) {
  const res = await fetch(`${ctx.baseUrl}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function setup() {
  console.log('========================================================================');
  console.log('DIGITAL GURU FRANCHISE — DETAILS & OWNER CREDENTIALS VERIFICATION SUITE');
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
  console.log(`[Setup] Super Admin token generated (${superAdmin.email})`);

  // Seed a unique test franchise with branch campus and owner user
  const uniqueSuffix = Date.now().toString().slice(-6);
  const ownerEmail = `test.owner.${uniqueSuffix}@dg-test.local`;
  const initialPassword = 'InitialOwnerPass#2026';
  const initialHash = await hashPassword(initialPassword);

  const testOwner = await prisma.user.create({
    data: {
      email: ownerEmail,
      phone: `+9198700${uniqueSuffix.slice(-5)}`,
      fullName: `Test Owner ${uniqueSuffix}`,
      passwordHash: initialHash,
      role: 'FRANCHISE_OWNER',
      isActive: true,
      mustChangePassword: false,
    },
  });
  ctx.createdUserIds.push(testOwner.id);
  ctx.testOwnerUserId = testOwner.id;

  ctx.ownerToken = generateAccessToken({
    userId: testOwner.id,
    email: testOwner.email,
    role: 'FRANCHISE_OWNER',
  });

  const testFranchise = await prisma.franchise.create({
    data: {
      code: `DG-TEST-${uniqueSuffix.slice(-4)}`,
      name: `Digital Guru Test Center ${uniqueSuffix}`,
      ownerName: testOwner.fullName,
      email: testOwner.email!,
      phone: testOwner.phone!,
      address: '100 Anna Salai, Guindy',
      city: 'Chennai',
      state: 'Tamil Nadu',
      postalCode: '600032',
      country: 'India',
      status: 'ACTIVE',
      ownerUserId: testOwner.id,
    },
  });
  ctx.createdFranchiseIds.push(testFranchise.id);
  ctx.testFranchiseId = testFranchise.id;

  // Add an attached campus branch
  const testBranch = await prisma.institute.create({
    data: {
      code: `BR-TEST-${uniqueSuffix.slice(-4)}`,
      name: `DG Guindy Campus ${uniqueSuffix}`,
      email: `guindy.${uniqueSuffix}@campus.local`,
      phone: `+9198711${uniqueSuffix.slice(-5)}`,
      address: '100 Anna Salai, Guindy',
      city: 'Chennai',
      state: 'Tamil Nadu',
      postalCode: '600032',
      country: 'India',
      status: 'ACTIVE',
      franchiseId: testFranchise.id,
    },
  });
  ctx.createdInstituteIds.push(testBranch.id);
  ctx.testBranchId = testBranch.id;

  // Create an active agreement for commercial terms check
  await prisma.franchiseAgreement.create({
    data: {
      franchiseId: testFranchise.id,
      agreementNumber: `AGR-TEST-${uniqueSuffix}`,
      title: 'Master Franchise Agreement 2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2028-12-31'),
      status: 'ACTIVE',
      agreementType: 'NEW_CENTRE_JOINT_INVESTMENT',
      royaltyCalculationMethod: 'PERCENTAGE_REVENUE',
      annualRoyaltyAmount: 240000,
      digitalGuruRevenuePercentage: 50,
      partnerRevenuePercentage: 50,
      revenueCalculationBasis: 'GROSS_COURSE_FEES',
      settlementFrequency: 'MONTHLY',
    },
  });

  console.log(`[Setup] Created test franchise ${testFranchise.code} (${testFranchise.id}) with branch ${testBranch.code}\n`);
}

async function cleanup() {
  console.log('\n[Cleanup] Cleaning up temporary test records...');
  try {
    for (const instId of ctx.createdInstituteIds) {
      await prisma.auditLog.deleteMany({ where: { instituteId: instId } });
      await prisma.instituteMembership.deleteMany({ where: { instituteId: instId } });
      await prisma.institute.delete({ where: { id: instId } }).catch(() => {});
    }

    for (const frId of ctx.createdFranchiseIds) {
      await prisma.franchiseRoyaltyInstallment.deleteMany({ where: { franchiseId: frId } });
      await prisma.franchiseRoyaltyPayment.deleteMany({ where: { franchiseId: frId } });
      await prisma.franchiseRoyaltyRecord.deleteMany({ where: { franchiseId: frId } });
      await prisma.franchiseAgreement.deleteMany({ where: { franchiseId: frId } });
      await prisma.franchise.delete({ where: { id: frId } }).catch(() => {});
    }

    for (const uId of ctx.createdUserIds) {
      await prisma.user.delete({ where: { id: uId } }).catch(() => {});
    }
  } catch (err: any) {
    console.warn('[Cleanup Warning]', err.message);
  }

  if (ctx.server) {
    await new Promise<void>((resolve) => ctx.server.close(() => resolve()));
    console.log('[Cleanup] Test server stopped.');
  }
}

async function runTests() {
  await setup();

  try {
    // -------------------------------------------------------------
    // Test 1: Open an existing franchise from the list (GET /franchises/:id)
    // -------------------------------------------------------------
    const getRes = await apiGet(`/franchises/${ctx.testFranchiseId}`);
    assert(
      getRes.status === 200 && getRes.data?.success === true && Boolean(getRes.data?.data?.franchise),
      'Open existing franchise from list via GET /franchises/:id',
      JSON.stringify(getRes.data)
    );

    const frData = getRes.data?.data?.franchise;

    // -------------------------------------------------------------
    // Test 2: Confirm the correct franchise details appear
    // -------------------------------------------------------------
    assert(
      frData?.id === ctx.testFranchiseId &&
      frData?.name.includes('Digital Guru Test Center') &&
      Boolean(frData?.code) &&
      frData?.status === 'ACTIVE' &&
      frData?.city === 'Chennai' &&
      frData?.state === 'Tamil Nadu' &&
      frData?.postalCode === '600032' &&
      frData?.address === '100 Anna Salai, Guindy' &&
      Boolean(frData?.createdAt),
      'Confirm all correct franchise details appear (name, code, status, full address, createdAt)',
      `Returned: name=${frData?.name}, code=${frData?.code}, city=${frData?.city}`
    );

    // -------------------------------------------------------------
    // Test 3: Confirm the correct owner email, phone, and ownerUser credentials appear
    // -------------------------------------------------------------
    assert(
      frData?.ownerName.includes('Test Owner') &&
      frData?.email.includes('@dg-test.local') &&
      Boolean(frData?.phone) &&
      Boolean(frData?.ownerUser) &&
      frData?.ownerUser?.isActive === true &&
      frData?.ownerUser?.role === 'FRANCHISE_OWNER' &&
      frData?.ownerUser?.passwordHash === undefined, // Must NEVER expose passwordHash
      'Confirm correct owner contact, credentials visibility, and NO password hash leak in API',
      `OwnerUser: ${JSON.stringify(frData?.ownerUser)}`
    );

    // -------------------------------------------------------------
    // Test 4: Confirm associated branches and student counts are displayed
    // -------------------------------------------------------------
    assert(
      Array.isArray(frData?.branches) &&
      frData.branches.length === 1 &&
      frData.branches[0].id === ctx.testBranchId &&
      frData.branches[0].code.includes('BR-TEST') &&
      frData.branches[0].city === 'Chennai' &&
      frData.branches[0]._count !== undefined,
      'Confirm associated branches and counts are retrieved and displayed in franchise details',
      `Branches: ${JSON.stringify(frData?.branches)}`
    );

    // -------------------------------------------------------------
    // Test 5: Reset the owner's password (POST /franchises/:id/owner/reset-password)
    // -------------------------------------------------------------
    const resetRes = await apiPost(`/franchises/${ctx.testFranchiseId}/owner/reset-password`, {});
    assert(
      resetRes.status === 200 &&
      resetRes.data?.success === true &&
      Boolean(resetRes.data?.data?.temporaryPassword) &&
      resetRes.data?.data?.mustChangePassword === true &&
      resetRes.data?.data?.email.includes('@dg-test.local'),
      'Super Admin resets owner password and receives temporary credentials',
      JSON.stringify(resetRes.data)
    );

    const tempPassword = resetRes.data?.data?.temporaryPassword;
    const ownerEmail = resetRes.data?.data?.email;

    // -------------------------------------------------------------
    // Test 6: Confirm the new temporary password works for owner login
    // -------------------------------------------------------------
    const newLoginRes = await apiPost('/auth/login', {
      email: ownerEmail,
      password: tempPassword,
    }, '');
    assert(
      newLoginRes.status === 200 &&
      newLoginRes.data?.success === true &&
      Boolean(newLoginRes.data?.data?.accessToken) &&
      newLoginRes.data?.data?.user?.role === 'FRANCHISE_OWNER',
      'Confirm new temporary password successfully authenticates Franchise Owner',
      JSON.stringify(newLoginRes.data)
    );

    // -------------------------------------------------------------
    // Test 7: Confirm the old password no longer works
    // -------------------------------------------------------------
    const oldLoginRes = await apiPost('/auth/login', {
      email: ownerEmail,
      password: 'InitialOwnerPass#2026', // Old password
    }, '');
    assert(
      oldLoginRes.status === 401 && oldLoginRes.data?.success === false,
      'Confirm old password is immediately invalidated and rejected with HTTP 401',
      `Status=${oldLoginRes.status}, data=${JSON.stringify(oldLoginRes.data)}`
    );

    // -------------------------------------------------------------
    // Test 8: Confirm normal franchise owner CANNOT access Super Admin credential-management operations
    // -------------------------------------------------------------
    const unauthorizedResetRes = await apiPost(
      `/franchises/${ctx.testFranchiseId}/owner/reset-password`,
      {},
      ctx.ownerToken // Calling with Franchise Owner token instead of Super Admin
    );
    assert(
      unauthorizedResetRes.status === 403 &&
      unauthorizedResetRes.data?.success === false &&
      unauthorizedResetRes.data?.error?.includes('Forbidden'),
      'Confirm normal franchise owner is denied access (HTTP 403 Forbidden) on password-reset',
      `Status=${unauthorizedResetRes.status}, data=${JSON.stringify(unauthorizedResetRes.data)}`
    );

    // -------------------------------------------------------------
    // Test 9: Confirm franchise list supports search, filter, and relations
    // -------------------------------------------------------------
    const listRes = await apiGet(`/franchises?search=Digital+Guru+Test+Center&status=ACTIVE`);
    assert(
      listRes.status === 200 &&
      listRes.data?.success === true &&
      Array.isArray(listRes.data?.data?.franchises) &&
      listRes.data.data.franchises.some((f: any) => f.id === ctx.testFranchiseId),
      'Confirm franchise list still supports search query, status filters, and branch relations',
      `Total returned: ${listRes.data?.data?.total}`
    );

    // -------------------------------------------------------------
    // Test 10: Confirm creation confirmation displays initial credentials correctly
    // -------------------------------------------------------------
    const uniqueSuffix2 = (Date.now() + 1).toString().slice(-6);
    const creationRes = await apiPost('/franchises', {
      name: `Digital Guru Onboarding Center ${uniqueSuffix2}`,
      ownerName: `Onboarded Owner ${uniqueSuffix2}`,
      email: `onboarded.${uniqueSuffix2}@dg-test.local`,
      phone: `+9198755${uniqueSuffix2.slice(-5)}`,
      address: '25 Mount Road',
      city: 'Chennai',
      state: 'Tamil Nadu',
      postalCode: '600002',
      country: 'India',
      initialAgreement: {
        agreementType: 'NEW_CENTRE_JOINT_INVESTMENT',
        startDate: '2026-03-01',
        endDate: '2028-02-28',
        settlementFrequency: 'YEARLY',
        royaltyCalculationMethod: 'PERCENTAGE_REVENUE',
        annualRoyaltyAmount: 300000,
        digitalGuruRevenuePercentage: 50,
        partnerRevenuePercentage: 50,
        upfrontRoyaltyFee: 100000,
      },
      branchOption: 'NONE',
    });

    if (creationRes.data?.data?.franchise?.id) {
      ctx.createdFranchiseIds.push(creationRes.data.data.franchise.id);
    }
    if (creationRes.data?.data?.ownerCredentials?.email) {
      const u = await prisma.user.findFirst({ where: { email: creationRes.data.data.ownerCredentials.email } });
      if (u) ctx.createdUserIds.push(u.id);
    }

    assert(
      creationRes.status === 201 &&
      creationRes.data?.success === true &&
      Boolean(creationRes.data?.data?.franchise?.code) &&
      Boolean(creationRes.data?.data?.ownerCredentials?.email) &&
      Boolean(creationRes.data?.data?.ownerCredentials?.temporaryPassword) &&
      creationRes.data?.data?.ownerCredentials?.mustChangePassword === true,
      'Confirm franchise creation returns owner credentials (email, temporaryPassword, mustChangePassword)',
      JSON.stringify(creationRes.data)
    );

  } finally {
    await cleanup();
  }

  console.log('\n========================================================================');
  console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED out of ${passedCount + failedCount} TESTS`);
  console.log('========================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('[FATAL TEST ERROR]', err);
  process.exit(1);
});
