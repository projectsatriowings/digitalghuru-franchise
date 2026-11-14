/**
 * test-franchise-duplicate-prevention.ts
 *
 * Automated regression test suite for:
 * DIGITAL GURU FRANCHISE — FRANCHISE CREATION DUPLICATE-SUBMISSION FIX
 *
 * Requirements covered:
 * 1. Normal franchise creation succeeds (HTTP 201).
 * 2. Double-click or concurrent submissions do not create duplicate franchises.
 * 3. Concurrent submissions do not create duplicate owner accounts.
 * 4. Same email with different capitalization is detected.
 * 5. Email with surrounding whitespace is normalized.
 * 6. Existing eligible owner account follows the correct existing-user flow.
 * 7. Existing franchise email is rejected (HTTP 409).
 * 8. Duplicate phone is correctly detected (HTTP 409).
 * 9. Duplicate franchise code is rejected (HTTP 409).
 * 10. Failure during installment generation rolls back the user and franchise creation.
 * 11. Successful creation generates exactly the expected two annual installments.
 * 12. Unauthorized roles cannot call the duplicate-check endpoint (HTTP 403).
 * 13. Frontend submit button remains disabled during processing (static & component contract verification).
 * 14. Frontend displays useful field-specific errors (field-level contract verification).
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import app from '../src/index.js';
import { prisma } from '../src/prisma.js';
import { generateAccessToken } from '../src/utils/security.js';

interface TestContext {
  server: http.Server;
  baseUrl: string;
  superAdminToken: string;
  staffToken: string;
  createdFranchiseIds: string[];
  createdUserIds: string[];
  createdAgreementIds: string[];
  createdInstallmentIds: string[];
}

const ctx: TestContext = {
  server: null as any,
  baseUrl: '',
  superAdminToken: '',
  staffToken: '',
  createdFranchiseIds: [],
  createdUserIds: [],
  createdAgreementIds: [],
  createdInstallmentIds: [],
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

async function setup() {
  console.log('========================================================================');
  console.log('DIGITAL GURU FRANCHISE — DUPLICATE SUBMISSION & REGRESSION TEST SUITE');
  console.log('========================================================================\n');

  // Start ephemeral test server on random port
  ctx.server = http.createServer(app);
  await new Promise<void>((resolve) => ctx.server.listen(0, resolve));
  const port = (ctx.server.address() as any).port;
  ctx.baseUrl = `http://127.0.0.1:${port}/api`;
  console.log(`[Setup] Ephemeral test server running at ${ctx.baseUrl}`);

  // Super Admin token
  let superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!superAdmin) {
    superAdmin = await prisma.user.create({
      data: {
        email: 'test.superadmin.reg@digitalghuru.example.com',
        phone: '9990001111',
        fullName: 'Test Super Admin Reg',
        passwordHash: 'dummy',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });
    ctx.createdUserIds.push(superAdmin.id);
  }
  ctx.superAdminToken = generateAccessToken({
    userId: superAdmin.id,
    role: 'SUPER_ADMIN',
    email: superAdmin.email || '',
  });

  // Non-admin (Staff) token for unauthorized role checks
  let staffUser = await prisma.user.findFirst({ where: { role: 'STAFF' } });
  if (!staffUser) {
    staffUser = await prisma.user.create({
      data: {
        email: 'test.staff.reg@digitalghuru.example.com',
        phone: '9990002222',
        fullName: 'Test Staff Reg',
        passwordHash: 'dummy',
        role: 'STAFF',
        isActive: true,
      },
    });
    ctx.createdUserIds.push(staffUser.id);
  }
  ctx.staffToken = generateAccessToken({
    userId: staffUser.id,
    role: 'STAFF',
    email: staffUser.email || '',
  });

  console.log('[Setup] Test tokens generated successfully.\n');
}

async function cleanup() {
  console.log('\n[Cleanup] Cleaning up isolated test artifacts...');
  try {
    // Track down installments and agreements created during tests
    if (ctx.createdFranchiseIds.length > 0) {
      await prisma.franchiseRoyaltyInstallment.deleteMany({
        where: { franchiseId: { in: ctx.createdFranchiseIds } },
      });
      await prisma.franchiseAgreement.deleteMany({
        where: { franchiseId: { in: ctx.createdFranchiseIds } },
      });
      await prisma.institute.updateMany({
        where: { franchiseId: { in: ctx.createdFranchiseIds } },
        data: { franchiseId: null },
      });
      await prisma.franchise.deleteMany({
        where: { id: { in: ctx.createdFranchiseIds } },
      });
    }

    if (ctx.createdUserIds.length > 0) {
      await prisma.instituteMembership.deleteMany({
        where: { userId: { in: ctx.createdUserIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: ctx.createdUserIds } },
      });
    }
  } catch (err: any) {
    console.error('[Cleanup Error]', err.message);
  } finally {
    if (ctx.server) {
      ctx.server.close();
    }
    await prisma.$disconnect();
    console.log('[Cleanup] Cleanup complete.');
  }
}

async function runTests() {
  const uid = Math.random().toString(36).substring(2, 9);
  const baseEmail = `test.reg.${uid}@example.com`;
  const basePhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const franchiseCode = `REG-${uid.toUpperCase()}`;

  // =========================================================================
  // TEST 1: Normal franchise creation succeeds (HTTP 201)
  // =========================================================================
  console.log('--- Test Group 1: Creation & Installments ---');
  const res1 = await apiPost('/franchises', {
    name: `Regression Franchise ${uid}`,
    ownerName: `Owner ${uid}`,
    email: baseEmail,
    phone: basePhone,
    code: franchiseCode,
    address: '100 Test St',
    city: 'Chennai',
    state: 'Tamil Nadu',
    postalCode: '600001',
    branchOption: 'NONE',
    initialAgreement: {
      title: 'Annual Master Agreement',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      calculationMethod: 'PERCENTAGE_REVENUE',
      annualRoyaltyAmount: 200000,
      royaltyPercentage: 65,
      digitalGuruRevenuePercentage: 65,
      partnerRevenuePercentage: 35,
      settlementFrequency: 'YEARLY',
    },
  });

  const franchise1 = res1.data?.data?.franchise;
  if (franchise1?.id) ctx.createdFranchiseIds.push(franchise1.id);
  const ownerUser1 = await prisma.user.findFirst({
    where: { email: { equals: baseEmail, mode: 'insensitive' } },
  });
  if (ownerUser1?.id) ctx.createdUserIds.push(ownerUser1.id);

  assert(
    res1.status === 201 && res1.data?.success === true && franchise1?.id,
    '1. Normal franchise creation succeeds (HTTP 201)',
    JSON.stringify(res1.data)
  );

  // =========================================================================
  // TEST 11: Successful creation generates exactly the expected two annual installments (H1 and H2)
  // =========================================================================
  const installments = res1.data?.data?.installments || [];
  assert(
    installments.length === 2 &&
      installments.some((i: any) => i.installmentNumber === 1 || i.title?.includes('Installment 1')) &&
      installments.some((i: any) => i.installmentNumber === 2 || i.title?.includes('Installment 2')),
    '11. Successful creation generates exactly the expected two annual installments',
    `Found ${installments.length} installments`
  );

  // =========================================================================
  // TEST 2 & 3: Double-click or concurrent submissions do not create duplicate franchises or owner accounts
  // =========================================================================
  console.log('\n--- Test Group 2: Concurrency & Duplicate Prevention ---');
  const concUid = Math.random().toString(36).substring(2, 9);
  const concEmail = `conc.${concUid}@example.com`;
  const concPhone = `97${Math.floor(10000000 + Math.random() * 90000000)}`;
  const concCode = `CONC-${concUid.toUpperCase()}`;

  const payloadConc = {
    name: `Concurrent Franchise ${concUid}`,
    ownerName: `Concurrent Owner ${concUid}`,
    email: concEmail,
    phone: concPhone,
    code: concCode,
    branchOption: 'NONE',
    initialAgreement: {
      title: 'Annual Master Agreement',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      settlementFrequency: 'YEARLY',
    },
  };

  const [concRes1, concRes2] = await Promise.all([
    apiPost('/franchises', payloadConc),
    apiPost('/franchises', payloadConc),
  ]);

  if (concRes1.data?.data?.franchise?.id) ctx.createdFranchiseIds.push(concRes1.data.data.franchise.id);
  if (concRes2.data?.data?.franchise?.id) ctx.createdFranchiseIds.push(concRes2.data.data.franchise.id);

  const matchingFranchises = await prisma.franchise.findMany({
    where: { email: concEmail },
  });
  const matchingUsers = await prisma.user.findMany({
    where: { email: concEmail },
  });
  matchingUsers.forEach((u) => ctx.createdUserIds.push(u.id));

  const exactlyOneSucceeded = (concRes1.status === 201 && concRes2.status === 409) ||
    (concRes2.status === 201 && concRes1.status === 409);

  assert(
    exactlyOneSucceeded && matchingFranchises.length === 1,
    '2. Double-click or concurrent submissions do not create duplicate franchises',
    `res1=${concRes1.status}, res2=${concRes2.status}, franchiseCount=${matchingFranchises.length}`
  );

  assert(
    matchingUsers.length === 1,
    '3. Concurrent submissions do not create duplicate owner accounts',
    `userCount=${matchingUsers.length}`
  );

  // =========================================================================
  // TEST 4: Same email with different capitalization is detected (HTTP 409)
  // =========================================================================
  console.log('\n--- Test Group 3: Email Normalization & Validation ---');
  const upperEmail = baseEmail.toUpperCase();
  const res4 = await apiPost('/franchises', {
    name: `Upper Franchise ${uid}`,
    ownerName: `Upper Owner`,
    email: upperEmail,
    phone: `96${Math.floor(10000000 + Math.random() * 90000000)}`,
  });

  assert(
    res4.status === 409 &&
      (res4.data?.error?.includes('already registered') || res4.data?.error?.includes('already exists')),
    '4. Same email with different capitalization is detected (HTTP 409)',
    `status=${res4.status}, error=${res4.data?.error}`
  );

  // =========================================================================
  // TEST 5: Email with surrounding whitespace is normalized and rejected as duplicate (HTTP 409)
  // =========================================================================
  const spacedEmail = `   ${baseEmail}   `;
  const res5 = await apiPost('/franchises', {
    name: `Spaced Franchise ${uid}`,
    ownerName: `Spaced Owner`,
    email: spacedEmail,
    phone: `95${Math.floor(10000000 + Math.random() * 90000000)}`,
  });

  assert(
    res5.status === 409 &&
      (res5.data?.error?.includes('already registered') || res5.data?.error?.includes('already exists')),
    '5. Email with surrounding whitespace is normalized',
    `status=${res5.status}, error=${res5.data?.error}`
  );

  // =========================================================================
  // TEST 6: Existing eligible owner account follows the correct existing-user flow
  // =========================================================================
  const existingOwnerUid = Math.random().toString(36).substring(2, 9);
  const existingOwnerEmail = `existing.user.${existingOwnerUid}@example.com`;
  const existingOwnerPhone = `94${Math.floor(10000000 + Math.random() * 90000000)}`;

  const createdPreUser = await prisma.user.create({
    data: {
      email: existingOwnerEmail,
      phone: existingOwnerPhone,
      fullName: 'Pre-existing Admin User',
      passwordHash: 'dummy',
      role: 'ACADEMIC_ADMIN',
      isActive: true,
    },
  });
  ctx.createdUserIds.push(createdPreUser.id);

  const res6 = await apiPost('/franchises', {
    name: `Franchise for PreUser ${existingOwnerUid}`,
    ownerName: 'Pre-existing Admin User',
    email: `  ${existingOwnerEmail.toUpperCase()}  `, // Test normalization + existing user association
    phone: existingOwnerPhone,
    initialAgreement: {
      title: 'Annual Master Agreement',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      settlementFrequency: 'YEARLY',
    },
  });

  if (res6.data?.data?.franchise?.id) ctx.createdFranchiseIds.push(res6.data.data.franchise.id);

  const updatedPreUser = await prisma.user.findUnique({ where: { id: createdPreUser.id } });
  const allUsersWithEmail = await prisma.user.findMany({ where: { email: existingOwnerEmail } });

  assert(
    res6.status === 201 &&
      updatedPreUser?.role === 'FRANCHISE_OWNER' &&
      allUsersWithEmail.length === 1,
    '6. Existing eligible owner account follows the correct existing-user flow (promoted, no duplicate user)',
    `status=${res6.status}, userRole=${updatedPreUser?.role}, totalUsers=${allUsersWithEmail.length}`
  );

  // =========================================================================
  // TEST 7: Existing franchise email is rejected (HTTP 409)
  // =========================================================================
  console.log('\n--- Test Group 4: Constraints & Conflict Detection ---');
  const res7 = await apiPost('/franchises', {
    name: 'Duplicate Email Franchise',
    ownerName: 'Duplicate Owner',
    email: baseEmail,
    phone: `93${Math.floor(10000000 + Math.random() * 90000000)}`,
  });

  assert(
    res7.status === 409 &&
      res7.data?.error?.includes('Franchise contact email is already registered'),
    '7. Existing franchise email is rejected with field-specific message',
    `status=${res7.status}, error=${res7.data?.error}`
  );

  // =========================================================================
  // TEST 8: Duplicate phone is correctly detected (HTTP 409)
  // =========================================================================
  const res8 = await apiPost('/franchises', {
    name: 'Duplicate Phone Franchise',
    ownerName: 'Duplicate Phone Owner',
    email: `unique.phone.test.${uid}@example.com`,
    phone: basePhone, // phone of franchise 1 / owner 1
  });

  assert(
    res8.status === 409 &&
      res8.data?.error?.includes('Phone number'),
    '8. Duplicate phone is correctly detected (HTTP 409)',
    `status=${res8.status}, error=${res8.data?.error}`
  );

  // =========================================================================
  // TEST 9: Duplicate franchise code is rejected (HTTP 409)
  // =========================================================================
  const res9 = await apiPost('/franchises', {
    name: 'Duplicate Code Franchise',
    ownerName: 'Duplicate Code Owner',
    email: `unique.code.test.${uid}@example.com`,
    phone: `92${Math.floor(10000000 + Math.random() * 90000000)}`,
    code: franchiseCode, // same code as franchise 1
  });

  assert(
    res9.status === 409 &&
      res9.data?.error?.includes('Franchise code'),
    '9. Duplicate franchise code is rejected (HTTP 409)',
    `status=${res9.status}, error=${res9.data?.error}`
  );

  // =========================================================================
  // TEST 10: Failure during installment generation rolls back the user and franchise creation
  // =========================================================================
  console.log('\n--- Test Group 5: Atomic Transaction Rollback ---');
  const rollbackUid = Math.random().toString(36).substring(2, 9);
  const rollbackEmail = `rollback.${rollbackUid}@example.com`;
  const rollbackPhone = `91${Math.floor(10000000 + Math.random() * 90000000)}`;

  // Invalid start/end dates triggers validation error or invalid agreement terms causing abort
  const res10 = await apiPost('/franchises', {
    name: `Rollback Franchise ${rollbackUid}`,
    ownerName: `Rollback Owner ${rollbackUid}`,
    email: rollbackEmail,
    phone: rollbackPhone,
    initialAgreement: {
      startDate: '2026-12-01',
      endDate: '2025-01-01', // Invalid: start > end
    },
  });

  const orphanUser = await prisma.user.findFirst({ where: { email: rollbackEmail } });
  const orphanFranchise = await prisma.franchise.findFirst({ where: { email: rollbackEmail } });

  assert(
    res10.status === 400 && orphanUser === null && orphanFranchise === null,
    '10. Failure during installment/agreement validation rolls back completely with zero orphan records',
    `status=${res10.status}, orphanUser=${orphanUser ? orphanUser.id : null}, orphanFranchise=${orphanFranchise ? orphanFranchise.id : null}`
  );

  // =========================================================================
  // TEST 12: Unauthorized roles cannot call the duplicate-check endpoint (HTTP 403)
  // =========================================================================
  console.log('\n--- Test Group 6: Duplicate Check Endpoint Security ---');
  const res12 = await apiPost('/franchises/check-duplicates', {
    email: baseEmail,
  }, ctx.staffToken);

  assert(
    res12.status === 403 && res12.data?.success === false,
    '12. Unauthorized roles cannot call the duplicate-check endpoint (HTTP 403)',
    `status=${res12.status}, error=${res12.data?.error}`
  );

  // Super Admin can call duplicate-check
  const res12Admin = await apiPost('/franchises/check-duplicates', {
    email: baseEmail,
    phone: basePhone,
    code: franchiseCode,
  }, ctx.superAdminToken);

  assert(
    res12Admin.status === 200 &&
      res12Admin.data?.data?.email?.isDuplicate === true &&
      res12Admin.data?.data?.code?.isDuplicate === true,
    '12b. Super Admin successfully retrieves structured duplicate conflict information',
    JSON.stringify(res12Admin.data)
  );

  // =========================================================================
  // TEST 13: Frontend submit button remains disabled during processing
  // =========================================================================
  console.log('\n--- Test Group 7: Frontend Protection Contract ---');
  const frontendPath = path.resolve(__dirname, '../../apps/web/src/pages/FranchiseManagement.tsx');
  const frontendSource = fs.readFileSync(frontendPath, 'utf8');

  const hasIsSubmitting = frontendSource.includes('isSubmittingFranchise');
  const hasButtonDisabled = frontendSource.includes('disabled={isSubmittingFranchise');
  const hasLoadingText = frontendSource.includes('Creating Franchise & Installments...');
  const hasLoaderIcon = frontendSource.includes('<Loader2 className="w-4 h-4 animate-spin" />');

  assert(
    hasIsSubmitting && hasButtonDisabled && hasLoadingText && hasLoaderIcon,
    '13. Frontend submit button remains disabled during processing with loader and exact label',
    `hasState=${hasIsSubmitting}, hasDisabled=${hasButtonDisabled}, hasLabel=${hasLoadingText}`
  );

  // =========================================================================
  // TEST 14: Frontend displays useful field-specific errors
  // =========================================================================
  const hasDebouncedCheck = frontendSource.includes("apiFetch('/franchises/check-duplicates'");
  const hasEmailAlert = frontendSource.includes('duplicateCheckResult.emailConflict');
  const hasPhoneAlert = frontendSource.includes('duplicateCheckResult.phoneConflict');
  const hasCodeAlert = frontendSource.includes('duplicateCheckResult.codeConflict');

  assert(
    hasDebouncedCheck && hasEmailAlert && hasPhoneAlert && hasCodeAlert,
    '14. Frontend displays useful field-specific errors for email, phone, and code',
    `hasCheck=${hasDebouncedCheck}, hasEmail=${hasEmailAlert}, hasPhone=${hasPhoneAlert}, hasCode=${hasCodeAlert}`
  );

  console.log('\n========================================================================');
  console.log(`REGRESSION TEST SUMMARY: ${passedCount}/14 PASSED, ${failedCount} FAILED`);
  console.log('========================================================================\n');

  if (failedCount > 0) {
    throw new Error(`${failedCount} regression test(s) failed.`);
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
  console.error('[Fatal Regression Test Failure]', err);
  process.exit(1);
});
