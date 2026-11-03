import app from '../src/index.js';
import http from 'http';
import { prisma } from '../src/prisma.js';

let server: http.Server;
const TEST_PORT = 5092;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string, extra?: any) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    if (extra) console.error('    Detail:', extra);
    failed++;
  }
}

async function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(TEST_PORT, '127.0.0.1', () => {
      console.log(`[Revised Franchise Test Server] Listening on ${BASE_URL}`);
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('[Revised Franchise Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function runTests() {
  console.log('\n============================================================');
  console.log('REVISED FRANCHISE OWNERSHIP, BRANCH & ROYALTY TEST SUITE');
  console.log('============================================================\n');

  await startServer();

  try {
    // -------------------------------------------------------------
    // SETUP: LOGIN AS SUPER ADMIN
    // -------------------------------------------------------------
    console.log('--- Setup: Super Admin Login ---');
    let adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'superadmin@platform.local',
        password: 'AdminSecurePassword#2026',
        role: 'SUPER_ADMIN',
      }),
    });

    if (adminLoginRes.status !== 200) {
      console.log('[Retry] Retrying Super Admin login after transient serverless wake-up...');
      await new Promise((r) => setTimeout(r, 2000));
      adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: 'superadmin@platform.local',
          password: 'AdminSecurePassword#2026',
          role: 'SUPER_ADMIN',
        }),
      });
    }

    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200, `Super Admin login successful (got ${adminLoginRes.status})`);
    const superAdminToken = adminLoginData.data.accessToken;
    assert(!!superAdminToken, 'Super Admin access token obtained');

    // -------------------------------------------------------------
    // TEST 1: Super Admin creates Franchise Owner with Complete Contact & Agreement
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Super Admin creates Franchise Owner with Complete Contact & Agreement ---');
    const testEmail = `franchise.test.${Date.now()}@digitalghuru.com`;
    const testPhone = `+91 944${Math.floor(1000000 + Math.random() * 9000000)}`;
    const createPayload = {
      name: 'Digital Guru Coimbatore East',
      ownerName: 'Venkatesh Raman',
      email: testEmail,
      phone: testPhone,
      address: '77 Avinashi Road, Peelamedu',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      postalCode: '641004',
      country: 'India',
      authorizedContact: {
        name: 'Kavitha Venkatesh',
        phone: '+91 94433 22111',
        email: 'kavitha@dgcoimbatore.com',
        designation: 'Operations Director',
      },
      businessDetails: {
        gstin: '33AABCC1234F1Z5',
        pan: 'AABCC1234F',
      },
      notes: 'Initial test franchise establishment',
      initialAgreement: {
        title: 'Master Franchise Agreement 2026-2027',
        startDate: '2026-04-01',
        endDate: '2027-03-31',
        calculationMethod: 'FIXED_ANNUAL',
        annualRoyaltyAmount: 200000,
        dueDay: 10,
        terms: 'Annual license with two installments.',
      },
    };

    const createRes = await fetch(`${BASE_URL}/api/franchises`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(createPayload),
    });

    const createData = await createRes.json();
    assert(createRes.status === 201, `Create franchise responded with 201 Created (got ${createRes.status})`);
    assert(createData.success === true, 'Response body success is true');
    assert(!!createData.data.franchise, 'Franchise object returned in response');
    assert(createData.data.franchise.postalCode === '641004', 'Postal code validated and stored');
    assert(createData.data.franchise.country === 'India', 'Country stored correctly');
    assert(
      createData.data.franchise.authorizedContact?.name === 'Kavitha Venkatesh',
      'Authorized contact person stored correctly'
    );
    assert(!!createData.data.ownerCredentials?.temporaryPassword, 'Secure temporary onboarding password provided');

    const createdFranchise = createData.data.franchise;
    const temporaryPassword = createData.data.ownerCredentials.temporaryPassword;

    // Login as the newly created Franchise Owner using the generated credentials!
    console.log('\n--- Test 1b: Franchise Owner Login with Onboarding Credentials ---');
    const ownerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testEmail,
        password: temporaryPassword,
        role: 'FRANCHISE_OWNER',
      }),
    });

    const ownerLoginData = await ownerLoginRes.json();
    assert(ownerLoginRes.status === 200, `Franchise Owner logged in with onboarding credentials (status ${ownerLoginRes.status})`);
    const ownerToken = ownerLoginData.data.accessToken;
    assert(!!ownerToken, 'Franchise Owner access token obtained');

    // -------------------------------------------------------------
    // TEST 2: Two-Installment Generation Verification
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Exactly Two Installments Generated for Annual Agreement ---');
    const installments = createData.data.installments;
    assert(Array.isArray(installments) && installments.length === 2, 'Exactly TWO installments generated');

    const inst1 = installments[0];
    const inst2 = installments[1];

    assert(inst1.installmentNumber === 1, 'Installment 1 has installmentNumber = 1');
    assert(Number(inst1.amount) === 100000, 'Installment 1 amount is exactly 50% (₹1,00,000)');
    assert(inst1.calculationBasis === 'FIXED_ANNUAL', 'Installment 1 calculationBasis is FIXED_ANNUAL');
    assert(!!inst1.calculationBreakdown?.formula, 'Installment 1 includes explicit calculation formula');

    assert(inst2.installmentNumber === 2, 'Installment 2 has installmentNumber = 2');
    assert(Number(inst2.amount) === 100000, 'Installment 2 amount is exactly 50% (₹1,00,000)');
    assert(inst2.calculationBasis === 'FIXED_ANNUAL', 'Installment 2 calculationBasis is FIXED_ANNUAL');
    assert(!!inst2.calculationBreakdown?.formula, 'Installment 2 includes explicit calculation formula');

    // -------------------------------------------------------------
    // TEST 3: Branch Restriction — Franchise Owner CANNOT Create or Attach Branches
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Franchise Owner CANNOT create or attach branches (403 Forbidden) ---');
    const ownerBranchAttempt = await fetch(`${BASE_URL}/api/franchises/${createdFranchise.id}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        createNew: true,
        name: 'Unauthorized Branch Attempt',
        city: 'Coimbatore',
      }),
    });

    const ownerBranchAttemptData = await ownerBranchAttempt.json();
    assert(
      ownerBranchAttempt.status === 403,
      `Franchise Owner branch creation rejected with 403 Forbidden (got ${ownerBranchAttempt.status})`
    );
    assert(
      ownerBranchAttemptData.error?.includes('Forbidden') || ownerBranchAttemptData.error?.includes('Super Admin'),
      'Informative error message received'
    );

    // Super Admin CAN create branch
    console.log('\n--- Test 3b: Super Admin attaches branch to franchise ---');
    const superAdminBranchRes = await fetch(`${BASE_URL}/api/franchises/${createdFranchise.id}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        createNew: true,
        name: 'Digital Guru Peelamedu Campus',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
        code: `BR-CBE-${Date.now().toString().slice(-4)}`,
      }),
    });

    const superAdminBranchData = await superAdminBranchRes.json();
    assert(superAdminBranchRes.status === 201, `Super Admin branch attachment succeeded with 201 (got ${superAdminBranchRes.status})`);
    const attachedBranch = superAdminBranchData.data.branch;
    assert(attachedBranch.franchiseId === createdFranchise.id, 'Branch correctly attached to franchise');

    // -------------------------------------------------------------
    // TEST 4: Franchise Owner CANNOT Create Another Franchise Owner
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Franchise Owner CANNOT create another franchise owner (403 Forbidden) ---');
    const ownerCreateOtherAttempt = await fetch(`${BASE_URL}/api/franchises`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        name: 'Malicious Secondary Franchise',
        ownerName: 'Fake Owner',
        email: `fake.${Date.now()}@example.com`,
        phone: '9999999999',
        address: '123 Fake Street',
        city: 'Chennai',
        state: 'Tamil Nadu',
        postalCode: '600001',
        initialAgreement: {
          startDate: '2026-04-01',
          endDate: '2027-03-31',
          annualRoyaltyAmount: 100000,
        },
      }),
    });

    assert(
      ownerCreateOtherAttempt.status === 403,
      `Franchise Owner creating another franchise rejected with 403 Forbidden (got ${ownerCreateOtherAttempt.status})`
    );

    // -------------------------------------------------------------
    // TEST 5: Tenant Isolation — Cannot Access or Modify Another Franchise
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Tenant Isolation — Cannot Access Another Franchise ---');
    const secondEmail = `franchise.second.${Date.now()}@digitalghuru.com`;
    const secondPhone = `+91 943${Math.floor(1000000 + Math.random() * 9000000)}`;
    const fr2Res = await fetch(`${BASE_URL}/api/franchises`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Digital Guru Madurai South',
        ownerName: 'Muthu Kumar',
        email: secondEmail,
        phone: secondPhone,
        address: '12 South Masi Street',
        city: 'Madurai',
        state: 'Tamil Nadu',
        postalCode: '625001',
        country: 'India',
        initialAgreement: {
          startDate: '2026-04-01',
          endDate: '2027-03-31',
          calculationMethod: 'FIXED_ANNUAL',
          annualRoyaltyAmount: 150000,
        },
      }),
    });

    const fr2Data = await fr2Res.json();
    const secondFranchise = fr2Data.data.franchise;

    // Owner 1 attempts to access Franchise 2 details
    const crossAccessGet = await fetch(`${BASE_URL}/api/franchises/${secondFranchise.id}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(
      crossAccessGet.status === 403,
      `Cross-franchise GET rejected with 403 Forbidden (got ${crossAccessGet.status})`
    );

    // Owner 1 attempts to list Franchise 2 installments
    const crossAccessInstallments = await fetch(`${BASE_URL}/api/franchises/${secondFranchise.id}/installments`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert(
      crossAccessInstallments.status === 403,
      `Cross-franchise installments access rejected with 403 Forbidden (got ${crossAccessInstallments.status})`
    );

    // -------------------------------------------------------------
    // TEST 6: Installment Payment Recording & Duplicate Prevention
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Installment Payment Recording & Duplicate Prevention ---');
    const testReference = `UTR-REV-${Date.now()}`;

    // 6a: Record partial payment of ₹60,000 against Installment 1 (₹1,00,000)
    const payRes1 = await fetch(`${BASE_URL}/api/franchises/${createdFranchise.id}/installments/${inst1.id}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        amountPaid: 60000,
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: testReference,
        remarks: 'First remittance towards Installment 1',
      }),
    });

    const payData1 = await payRes1.json();
    assert(payRes1.status === 201, `Payment 1 recorded successfully with 201 (got ${payRes1.status})`);
    assert(payData1.data.payment.receiptNumber.startsWith('ROY-REC-'), 'Receipt number format ROY-REC-YYYY-XXXX');
    assert(Number(payData1.data.installment.paidAmount) === 60000, 'Installment paid amount is ₹60,000');
    assert(Number(payData1.data.installment.outstandingBalance) === 40000, 'Installment outstanding balance is ₹40,000');
    assert(payData1.data.installment.status === 'PARTIALLY_PAID', 'Installment status transitioned to PARTIALLY_PAID');

    const paymentId = payData1.data.payment.id;
    const receiptNumber = payData1.data.payment.receiptNumber;

    // 6b: Test duplicate transactionReference rejection (409 Conflict)
    console.log('\n--- Test 6b: Duplicate transaction reference rejection ---');
    const duplicatePayRes = await fetch(`${BASE_URL}/api/franchises/${createdFranchise.id}/installments/${inst1.id}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        amountPaid: 40000,
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: testReference, // Same reference!
        remarks: 'Duplicate attempt',
      }),
    });

    const duplicatePayData = await duplicatePayRes.json();
    assert(
      duplicatePayRes.status === 409,
      `Duplicate transaction reference rejected with 409 Conflict (got ${duplicatePayRes.status})`
    );
    assert(
      duplicatePayData.error?.includes('Duplicate payment detected') || duplicatePayData.error?.includes('already been recorded'),
      'Clear duplicate conflict message received'
    );

    // 6c: Settle remainder ₹40,000 with a new reference -> Installment becomes PAID
    console.log('\n--- Test 6c: Settle balance -> Status becomes PAID ---');
    const settleRes = await fetch(`${BASE_URL}/api/franchises/${createdFranchise.id}/installments/${inst1.id}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        amountPaid: 40000,
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: `${testReference}-FINAL`,
        remarks: 'Final settlement for Installment 1',
      }),
    });

    const settleData = await settleRes.json();
    assert(settleRes.status === 201, `Final payment recorded with 201 (got ${settleRes.status})`);
    assert(Number(settleData.data.installment.paidAmount) === 100000, 'Total paid is ₹1,00,000');
    assert(Number(settleData.data.installment.outstandingBalance) === 0, 'Outstanding balance is ₹0');
    assert(settleData.data.installment.status === 'PAID', 'Installment status transitioned to PAID');

    // -------------------------------------------------------------
    // TEST 7: Official Receipt Retrieval
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Official Receipt Retrieval for Super Admin & Owner ---');
    const receiptRes = await fetch(`${BASE_URL}/api/franchises/${createdFranchise.id}/payments/${paymentId}/receipt`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    const receiptResultData = await receiptRes.json();
    assert(receiptRes.status === 200, `Owner retrieved receipt with 200 OK (got ${receiptRes.status})`);
    assert(receiptResultData.data.receiptNumber === receiptNumber, 'Receipt number matches recorded payment');
    assert(receiptResultData.data.payer.franchiseName === 'Digital Guru Coimbatore East', 'Payer franchise name matches');
    assert(receiptResultData.data.installment?.installmentNumber === 1, 'Installment number 1 included in receipt');

    // -------------------------------------------------------------
    // TEST 8: Agreement Renewal Preserves Previous Agreement & Installments
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Agreement Renewal Preserves History ---');
    const agreementId = createData.data.agreement.id;

    const renewRes = await fetch(`${BASE_URL}/api/franchises/${createdFranchise.id}/agreements/${agreementId}/renew`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Master Franchise Agreement 2027-2028',
        startDate: '2027-04-01',
        endDate: '2028-03-31',
        calculationMethod: 'FIXED_ANNUAL',
        annualRoyaltyAmount: 220000,
        dueDay: 10,
        terms: 'Renewed terms with 10% annual escalation.',
      }),
    });

    const renewData = await renewRes.json();
    assert(renewRes.status === 201, `Agreement renewal responded with 201 Created (got ${renewRes.status})`);
    assert(renewData.data.installments.length === 2, 'Renewed agreement generated 2 fresh installments');
    assert(Number(renewData.data.installments[0].amount) === 110000, 'Renewed installment 1 amount is ₹1,10,000');

    // Verify previous agreement is now EXPIRED but still in database
    const oldAgreement = await prisma.franchiseAgreement.findUnique({ where: { id: agreementId } });
    assert(oldAgreement?.status === 'EXPIRED', 'Previous agreement status updated to EXPIRED');

    // Verify previous installments and payments still exist
    const prevInstallments = await prisma.franchiseRoyaltyInstallment.findMany({
      where: { agreementId },
      orderBy: { installmentNumber: 'asc' },
    });
    assert(prevInstallments.length === 2, 'Previous 2 installments preserved in database');
    const paidInst = prevInstallments.find((i) => i.installmentNumber === 1);
    assert(Number(paidInst?.paidAmount) === 100000, 'Previous payment history retained');

    // -------------------------------------------------------------
    // TEST 9: Secure Password Reset by Super Admin
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Secure Password Reset by Super Admin ---');
    const resetRes = await fetch(`${BASE_URL}/api/franchises/${createdFranchise.id}/owner/reset-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });

    const resetData = await resetRes.json();
    assert(resetRes.status === 200, `Password reset responded with 200 OK (got ${resetRes.status})`);
    assert(!!resetData.data.temporaryPassword, 'Secure temporary password returned to Super Admin');

    // Verify Franchise Owner cannot call reset password on themselves or others
    const unauthReset = await fetch(`${BASE_URL}/api/franchises/${createdFranchise.id}/owner/reset-password`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    assert(unauthReset.status === 403, `Franchise Owner reset password attempt rejected with 403 Forbidden (got ${unauthReset.status})`);

    // -------------------------------------------------------------
    // TEST 10: Franchise Owner Workspace Access
    // -------------------------------------------------------------
    console.log('\n--- Test 10: Franchise Owner Dashboard and Profile Metrics ---');
    const ownerDashRes = await fetch(`${BASE_URL}/api/franchises/dashboard/owner`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });

    const ownerDashData = await ownerDashRes.json();
    assert(ownerDashRes.status === 200, `Owner dashboard retrieved with 200 OK (got ${ownerDashRes.status})`);
    assert(ownerDashData.data.franchise.name === 'Digital Guru Coimbatore East', 'Owner franchise name matches');
    assert(Array.isArray(ownerDashData.data.installments), 'Installments schedule returned to owner');
    assert(ownerDashData.data.metrics.totalBranches === 1, 'Campuses count matches (1 campus)');

    console.log('\n============================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await stopServer();
    await prisma.$disconnect();
  }
}

runTests();
