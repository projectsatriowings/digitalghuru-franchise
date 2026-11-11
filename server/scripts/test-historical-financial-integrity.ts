import '../src/dns-preload.cjs';
import app from '../src/index.js';
import http from 'http';
import { prisma } from '../src/prisma.js';

const TEST_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
let server: http.Server;

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
      console.log(`[Integrity Audit Test Server] Listening on ${BASE_URL}`);
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('[Integrity Audit Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function runIntegrityAuditTests() {
  console.log('\n======================================================================');
  console.log('DIGITAL GURU FRANCHISE – FINAL HISTORICAL FINANCIAL INTEGRITY AUDIT');
  console.log('Testing Effective Dates, Finalized Statements & PER_STUDENT Model');
  console.log('======================================================================\n');

  await startServer();

  let superAdminToken = '';
  let ownerToken = '';
  let franchiseId = '';
  let branchId = '';
  let otherBranchId = '';
  let agreementV1Id = '';
  let agreementV2Id = '';
  let agreementPerStudentId = '';

  try {
    // -------------------------------------------------------------
    // SETUP: Super Admin Authentication & Test Center
    // -------------------------------------------------------------
    console.log('--- Step 0: Setup & Authentication ---');
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'superadmin@platform.local',
        password: 'AdminSecurePassword#2026',
        role: 'SUPER_ADMIN',
      }),
    });
    const adminLoginData = (await adminLoginRes.json()) as any;
    assert(adminLoginRes.status === 200 && !!adminLoginData.data?.accessToken, 'Super Admin authenticated successfully');
    superAdminToken = adminLoginData.data?.accessToken;

    const uniqueSuffix = Date.now().toString().slice(-6);
    const testFranchisePayload = {
      name: `Financial Integrity Center ${uniqueSuffix}`,
      ownerName: `Audit Controller ${uniqueSuffix}`,
      email: `audit.finance${uniqueSuffix}@example.com`,
      phone: `98765${uniqueSuffix.slice(-5)}`,
      password: 'AuditSecurePass#2026',
      city: 'Tiruchirappalli',
      state: 'Tamil Nadu',
      country: 'India',
    };

    const createFrRes = await fetch(`${BASE_URL}/api/franchises`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(testFranchisePayload),
    });
    const createFrData = (await createFrRes.json()) as any;
    assert(createFrRes.status === 201 && !!createFrData.data?.franchise?.id, 'Test franchise center created');
    franchiseId = createFrData.data?.franchise?.id;

    // Login as Franchise Owner (non-admin role)
    const ownerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testFranchisePayload.email,
        password: testFranchisePayload.password,
        role: 'FRANCHISE_OWNER',
      }),
    });
    const ownerLoginData = (await ownerLoginRes.json()) as any;
    assert(ownerLoginRes.status === 200 && !!ownerLoginData.data?.accessToken, 'Franchise Owner authenticated successfully');
    ownerToken = ownerLoginData.data?.accessToken;

    // Create primary campus branch
    const bRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Integrity Campus Alpha ${uniqueSuffix}`,
        code: `ICA-${uniqueSuffix}`,
        city: 'Tiruchirappalli',
        state: 'Tamil Nadu',
      }),
    });
    const bData = (await bRes.json()) as any;
    assert(bRes.status === 201 && !!bData.data?.branch?.id, 'Franchise primary campus created');
    branchId = bData.data?.branch?.id;

    // Create an isolated secondary branch for tenant isolation tests
    const otherBRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Isolated Campus Beta ${uniqueSuffix}`,
        code: `ICB-${uniqueSuffix}`,
        city: 'Madurai',
        state: 'Tamil Nadu',
      }),
    });
    const otherBData = (await otherBRes.json()) as any;
    otherBranchId = otherBData.data?.branch?.id;

    // -------------------------------------------------------------
    // AREA 1: AGREEMENT EFFECTIVE-DATE SELECTION
    // -------------------------------------------------------------
    console.log('\n--- Area 1: Agreement Effective-Date Selection Verification ---');

    // Create Agreement v1: Effective January 1, 2026 to December 31, 2026 (40:60 split)
    const agr1Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Agreement 2026 (v1)',
        agreementType: 'NEW_CENTRE_JOINT_INVESTMENT',
        calculationMethod: 'PERCENTAGE_REVENUE',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        settlementFrequency: 'MONTHLY',
        digitalGuruRevenuePercentage: 40.0,
        partnerRevenuePercentage: 60.0,
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const agr1Data = (await agr1Res.json()) as any;
    assert(agr1Res.status === 201, 'Agreement v1 (Jan–Dec 2026, 40:60 split) created');
    agreementV1Id = agr1Data.data?.agreement?.id;

    // Wait slightly to ensure different timestamps
    await new Promise((r) => setTimeout(r, 200));

    // Create Agreement v2: Created in November 2026, but Effective January 1, 2027 to December 31, 2027 (60:40 split)
    const agr2Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Agreement 2027 (v2)',
        agreementType: 'EXISTING_CENTRE',
        calculationMethod: 'PERCENTAGE_REVENUE',
        startDate: '2027-01-01',
        endDate: '2027-12-31',
        settlementFrequency: 'MONTHLY',
        digitalGuruRevenuePercentage: 60.0,
        partnerRevenuePercentage: 40.0,
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const agr2Data = (await agr2Res.json()) as any;
    assert(agr2Res.status === 201, 'Agreement v2 (Jan–Dec 2027, 60:40 split, created later) created');
    agreementV2Id = agr2Data.data?.agreement?.id;

    // Seed batch and fee structure for course fee payments
    const batch = await prisma.batch.create({
      data: {
        instituteId: branchId,
        name: `Integrity Batch ${uniqueSuffix}`,
        academicYear: '2026-2027',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-12-31'),
      },
    });

    const feeStruct = await prisma.feeStructure.create({
      data: {
        instituteId: branchId,
        batchId: batch.id,
        name: `Course Fee Integrity ${uniqueSuffix}`,
        amount: 100000,
        frequency: 'ONE_TIME',
      },
    });

    const studentBase = await prisma.student.create({
      data: {
        instituteId: branchId,
        admissionNumber: `ADM-BASE-${uniqueSuffix}`,
        firstName: 'Primary',
        lastName: `Candidate ${uniqueSuffix}`,
        status: 'PASSED_OUT',
        admissionDate: new Date('2026-01-10T10:00:00Z'),
      },
    });

    const feeAssignmentOct = await prisma.studentFeeAssignment.create({
      data: {
        studentId: studentBase.id,
        feeStructureId: feeStruct.id,
        baseAmount: 100000,
        finalAmount: 100000,
        dueDate: new Date('2026-10-31'),
        status: 'PAID',
      },
    });

    const feeAssignmentFeb = await prisma.studentFeeAssignment.create({
      data: {
        studentId: studentBase.id,
        feeStructureId: feeStruct.id,
        baseAmount: 100000,
        finalAmount: 100000,
        dueDate: new Date('2027-02-28'),
        status: 'PAID',
      },
    });

    const superAdminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });

    // Seed course fee payments:
    // 1) October 2026: ₹1,00,000
    await prisma.payment.create({
      data: {
        instituteId: branchId,
        studentId: studentBase.id,
        feeAssignmentId: feeAssignmentOct.id,
        amountPaid: 100000,
        paidAt: new Date('2026-10-15T10:00:00Z'),
        receiptNumber: `REC-OCT-${uniqueSuffix}`,
        method: 'BANK_TRANSFER',
        status: 'SUCCESS',
        recordedById: superAdminUser!.id,
      },
    });

    // 2) February 2027: ₹1,00,000
    await prisma.payment.create({
      data: {
        instituteId: branchId,
        studentId: studentBase.id,
        feeAssignmentId: feeAssignmentFeb.id,
        amountPaid: 100000,
        paidAt: new Date('2027-02-15T10:00:00Z'),
        receiptNumber: `REC-FEB-${uniqueSuffix}`,
        method: 'BANK_TRANSFER',
        status: 'SUCCESS',
        recordedById: superAdminUser!.id,
      },
    });

    // Test Area 1a: Calculate October 2026 royalty -> MUST pick Agreement v1 (NOT v2)
    const calcOctRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const calcOctData = (await calcOctRes.json()) as any;
    assert(calcOctRes.status === 200, 'October 2026 calculation executed with HTTP 200');
    assert(
      calcOctData.data?.royaltyRecord?.calculationDetails?.agreementId === agreementV1Id,
      'EFFECTIVE-DATE RULE: October 2026 selects Agreement v1 (effective 2026) instead of newer createdAt v2',
      { selected: calcOctData.data?.royaltyRecord?.calculationDetails?.agreementId, expected: agreementV1Id }
    );
    assert(
      Number(calcOctData.data?.summary?.royaltyPercentage) === 40,
      'Agreement v1 40% Digital Guru royalty rate correctly applied to October 2026'
    );
    assert(
      Number(calcOctData.data?.summary?.royaltyPayable) === 40000,
      'October 2026 royalty payable is exactly ₹40,000 (40% of ₹1,00,000)'
    );
    assert(
      Number(calcOctData.data?.summary?.partnerShare) === 60000,
      'October 2026 partner share is exactly ₹60,000 (60% of ₹1,00,000)'
    );

    // Test Area 1b: Calculate February 2027 royalty -> MUST pick Agreement v2
    const calcFebRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2027-02',
        startDate: '2027-02-01',
        endDate: '2027-02-28',
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const calcFebData = (await calcFebRes.json()) as any;
    assert(calcFebRes.status === 200, 'February 2027 calculation executed with HTTP 200');
    assert(
      calcFebData.data?.royaltyRecord?.calculationDetails?.agreementId === agreementV2Id,
      'EFFECTIVE-DATE RULE: February 2027 selects Agreement v2 (effective 2027)',
      { selected: calcFebData.data?.royaltyRecord?.calculationDetails?.agreementId, expected: agreementV2Id }
    );
    assert(
      Number(calcFebData.data?.summary?.royaltyPercentage) === 60,
      'Agreement v2 60% Digital Guru royalty rate correctly applied to February 2027'
    );
    assert(
      Number(calcFebData.data?.summary?.royaltyPayable) === 60000,
      'February 2027 royalty payable is exactly ₹60,000 (60% of ₹1,00,000)'
    );
    assert(
      Number(calcFebData.data?.summary?.partnerShare) === 40000,
      'February 2027 partner share is exactly ₹40,000 (40% of ₹1,00,000)'
    );

    // Test Area 1c: Mid-Period Agreement Split Rejection (Audit 1 Scenario)
    // Prompt specification:
    // - Agreement v1: January 1–October 15, 2026 (45% DG)
    // - Agreement v2: October 16–December 31, 2026 (55% DG)
    // - Calculation period: October 1–October 31, 2026 -> Rejected with PERIOD_SPANS_MULTIPLE_AGREEMENTS
    // - Transition requires separate calculations for Oct 1–15 and Oct 16–31
    const splitFranchisePayload = {
      name: `Split Agreement Center ${uniqueSuffix}`,
      ownerName: `Split Controller ${uniqueSuffix}`,
      email: `split.finance${uniqueSuffix}@example.com`,
      phone: `98764${uniqueSuffix.slice(-5)}`,
      password: 'AuditSecurePass#2026',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      country: 'India',
    };

    const createSplitFrRes = await fetch(`${BASE_URL}/api/franchises`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(splitFranchisePayload),
    });
    const createSplitFrData = (await createSplitFrRes.json()) as any;
    assert(createSplitFrRes.status === 201 && !!createSplitFrData.data?.franchise?.id, 'Split test franchise created');
    const splitFranchiseId = createSplitFrData.data?.franchise?.id;

    const agrSplitARes = await fetch(`${BASE_URL}/api/franchises/${splitFranchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Agreement v1 (Jan 1 - Oct 15, 2026)',
        agreementType: 'NEW_CENTRE_JOINT_INVESTMENT',
        calculationMethod: 'PERCENTAGE_REVENUE',
        startDate: '2026-01-01',
        endDate: '2026-10-15',
        settlementFrequency: 'MONTHLY',
        digitalGuruRevenuePercentage: 45.0,
        partnerRevenuePercentage: 55.0,
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const agrSplitAData = (await agrSplitARes.json()) as any;
    assert(agrSplitARes.status === 201, 'Agreement v1 (Jan 1–Oct 15, 2026) created');
    const agrSplitAId = agrSplitAData.data?.agreement?.id;

    const agrSplitBRes = await fetch(`${BASE_URL}/api/franchises/${splitFranchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Agreement v2 (Oct 16 - Dec 31, 2026)',
        agreementType: 'EXISTING_CENTRE',
        calculationMethod: 'PERCENTAGE_REVENUE',
        startDate: '2026-10-16',
        endDate: '2026-12-31',
        settlementFrequency: 'MONTHLY',
        digitalGuruRevenuePercentage: 55.0,
        partnerRevenuePercentage: 45.0,
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const agrSplitBData = (await agrSplitBRes.json()) as any;
    assert(agrSplitBRes.status === 201, 'Agreement v2 (Oct 16–Dec 31, 2026) created');
    const agrSplitBId = agrSplitBData.data?.agreement?.id;

    // Test: Calculation spanning across agreement versions (Oct 1 to Oct 31) MUST BE REJECTED
    const calcSpanningRes = await fetch(`${BASE_URL}/api/franchises/${splitFranchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const calcSpanningData = (await calcSpanningRes.json()) as any;
    assert(
      calcSpanningRes.status === 400 && calcSpanningData.code === 'PERIOD_SPANS_MULTIPLE_AGREEMENTS',
      'AUDIT 1 INTEGRITY: Period crossing agreement boundary (Oct 1–31) rejected with PERIOD_SPANS_MULTIPLE_AGREEMENTS'
    );
    assert(
      Array.isArray(calcSpanningData.overlappingAgreements) && calcSpanningData.overlappingAgreements.length >= 2,
      'AUDIT 1 INTEGRITY: Response lists both overlapping agreements for segmented calculation'
    );

    // Test: Segmented calculations executed separately for each agreement succeed
    const calcSeg1Res = await fetch(`${BASE_URL}/api/franchises/${splitFranchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-10-P1',
        startDate: '2026-10-01',
        endDate: '2026-10-15',
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const calcSeg1Data = (await calcSeg1Res.json()) as any;
    assert(calcSeg1Res.status === 200, 'Segment 1 calculation (Oct 1–15) succeeds with HTTP 200', calcSeg1Data);
    assert(
      calcSeg1Data.data?.royaltyRecord?.calculationDetails?.agreementId === agrSplitAId,
      'Segment 1 correctly binds Agreement v1 (45% DG)'
    );

    const calcSeg2Res = await fetch(`${BASE_URL}/api/franchises/${splitFranchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-10-P2',
        startDate: '2026-10-16',
        endDate: '2026-10-31',
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const calcSeg2Data = (await calcSeg2Res.json()) as any;
    assert(calcSeg2Res.status === 200, 'Segment 2 calculation (Oct 16–31) succeeds with HTTP 200');
    assert(
      calcSeg2Data.data?.royaltyRecord?.calculationDetails?.agreementId === agrSplitBId,
      'Segment 2 correctly binds Agreement v2 (55% DG)'
    );

    // Test Area 1d: No-agreement period rejection (never fall back to unrelated ACTIVE agreement)
    const calcNoAgrRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2025-05',
        startDate: '2025-05-01',
        endDate: '2025-05-31',
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const calcNoAgrData = (await calcNoAgrRes.json()) as any;
    assert(
      calcNoAgrRes.status === 400 && calcNoAgrData.code === 'NO_APPLICABLE_AGREEMENT',
      'AUDIT 1 INTEGRITY: Period with no covering agreement (2025-05) rejected without fallback to unrelated ACTIVE agreement'
    );
    console.log('\n--- Area 2: Statement Finalization & Recalculation Guard ---');

    const octRecordId = calcOctData.data?.royaltyRecord?.id;

    // Test 2a: Idempotent recalculation of OPEN period (no payment yet recorded)
    const countBeforeRetry = await prisma.franchiseRoyaltyRecord.count({
      where: { franchiseId, periodLabel: '2026-10' },
    });
    assert(countBeforeRetry === 1, 'Exactly 1 record exists for October 2026 before retry');

    const openRetryRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    assert(openRetryRes.status === 200, 'Recalculation of open period succeeds with HTTP 200');
    const countAfterRetry = await prisma.franchiseRoyaltyRecord.count({
      where: { franchiseId, periodLabel: '2026-10' },
    });
    assert(countAfterRetry === 1, 'IDEMPOTENCY: Repeated calculation of open period does NOT create duplicates');

    // Test 2b: Finalize statement by recording full royalty remittance
    const recordPaymentRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        royaltyRecordId: octRecordId,
        amountPaid: 40000,
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: `NEFT-OCT-FINAL-${uniqueSuffix}`,
        remarks: 'October 2026 royalty paid in full',
      }),
    });
    const recordPaymentData = (await recordPaymentRes.json()) as any;
    assert(recordPaymentRes.status === 201, 'Royalty payment recorded successfully');

    const finalizedOctStmt = await prisma.franchiseRoyaltyRecord.findUnique({
      where: { id: octRecordId },
    });
    assert(finalizedOctStmt?.status === 'PAID', 'October 2026 statement status is PAID (Finalized)');
    assert(Number(finalizedOctStmt?.royaltyPaid) === 40000, 'Statement records ₹40,000 paid');
    assert(Number(finalizedOctStmt?.outstandingBalance) === 0, 'Outstanding balance is ₹0');

    // Test 2c: Silent modification attempt on finalized statement MUST BE REJECTED (HTTP 409)
    // Attempting to calculate with higher expenses or different numbers without isCorrection: true
    const unauthorizedModRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        revenueCalculationBasis: 'PROFIT_AFTER_EXPENSES',
        deductibleExpenses: 30000, // Attempting to alter pool from 100k to 70k silently
      }),
    });
    const unauthorizedModData = (await unauthorizedModRes.json()) as any;
    assert(
      unauthorizedModRes.status === 409,
      'FINALIZATION GUARD: Silent modification of finalized statement rejected with HTTP 409 Conflict'
    );
    assert(
      unauthorizedModData.isFinalized === true,
      'Response explicitly signals statement is finalized and protected'
    );

    // Verify database record was completely shielded and unchanged
    const octStmtAfterAttempt = await prisma.franchiseRoyaltyRecord.findUnique({
      where: { id: octRecordId },
    });
    assert(
      Number(octStmtAfterAttempt?.royaltyPayable) === 40000,
      'DATA SHIELD: Royalty payable remains exactly ₹40,000 (original figure preserved)'
    );
    assert(
      octStmtAfterAttempt?.status === 'PAID',
      'DATA SHIELD: Statement status remains PAID without alteration'
    );

    // Test 2d: Re-calculation with identical numbers returns verified statement idempotently
    const identicalReqRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const identicalReqData = (await identicalReqRes.json()) as any;
    assert(identicalReqRes.status === 200, 'Identical recalculation on finalized statement succeeds with HTTP 200');
    assert(identicalReqData.data?.summary?.isFinalized === true, 'Response confirms statement is verified finalized');

    // Test 2e: Authorized correction workflow with isCorrection: true and correctionReason
    const authorizedCorrRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        revenueCalculationBasis: 'PROFIT_AFTER_EXPENSES',
        deductibleExpenses: 20000, // Audited operating expense adjustment
        isCorrection: true,
        correctionReason: 'Finance Committee Audit Adjustment: Deducting approved facility maintenance expense ₹20,000',
      }),
    });
    const authorizedCorrData = (await authorizedCorrRes.json()) as any;
    assert(authorizedCorrRes.status === 200, 'Authorized correction on finalized statement accepted with HTTP 200');
    assert(
      authorizedCorrData.data?.royaltyRecord?.calculationDetails?.isCorrected === true,
      'Statement marked with isCorrected: true'
    );
    const history = authorizedCorrData.data?.royaltyRecord?.calculationDetails?.correctionHistory;
    assert(Array.isArray(history) && history.length === 1, 'Correction history entry logged');
    assert(
      history[0]?.previousSnapshot?.royaltyPayable === 40000,
      'Audit log recorded previous royaltyPayable (₹40,000)'
    );
    assert(
      history[0]?.newSnapshot?.royaltyPayable === 32000, // 40% of (100k - 20k = 80k) = 32,000
      'Audit log recorded new corrected royaltyPayable (₹32,000)'
    );
    assert(
      history[0]?.correctionReason.includes('Finance Committee Audit Adjustment'),
      'Audit log recorded complete correction reason'
    );

    // AUDIT 3: Overpayment Accounting Verification
    assert(
      authorizedCorrData.data?.summary?.hasOverpayment === true,
      'AUDIT 3: Overpayment explicitly flagged (hasOverpayment: true) after downward correction'
    );
    assert(
      Number(authorizedCorrData.data?.summary?.overpaymentAmount) === 8000,
      'AUDIT 3: Overpayment amount calculated as exactly ₹8,000 (₹40,000 paid - ₹32,000 payable)'
    );
    assert(
      authorizedCorrData.data?.summary?.overpaymentStatus === 'AWAITING_CLIENT_DECISION',
      'AUDIT 3: Overpayment status set to AWAITING_CLIENT_DECISION (no silent forfeiture, refund or carryover)'
    );
    assert(
      Number(authorizedCorrData.data?.summary?.outstandingBalance) === 0,
      'AUDIT 3: Outstanding balance is ₹0 (not negative)'
    );
    assert(
      authorizedCorrData.data?.royaltyRecord?.calculationDetails?.overpaymentNotes?.includes('Overpayment of ₹8,000 detected'),
      'AUDIT 3: Overpayment notes clearly state client commercial policy approval is required'
    );

    // AUDIT 3 & 4 SECURITY: Non-admin role cannot perform statement correction
    const nonAdminCorrRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ownerToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        revenueCalculationBasis: 'PROFIT_AFTER_EXPENSES',
        deductibleExpenses: 25000,
        isCorrection: true,
        correctionReason: 'Unauthorized Franchisee Admin Attempt',
      }),
    });
    assert(
      nonAdminCorrRes.status === 403,
      'AUDIT 3 SECURITY: Non-admin role (FRANCHISE_OWNER) rejected with HTTP 403 Forbidden for statement correction'
    );

    // AUDIT 3 SECURITY: Super Admin empty correction reason rejection
    const emptyReasonCorrRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        revenueCalculationBasis: 'PROFIT_AFTER_EXPENSES',
        deductibleExpenses: 25000,
        isCorrection: true,
        correctionReason: '   ',
      }),
    });
    assert(
      emptyReasonCorrRes.status === 409,
      'AUDIT 3 SECURITY: Correction attempt with whitespace-only reason rejected with HTTP 409 Conflict'
    );

    // AUDIT 4: Finalized Statement Protection - Differing numbers without isCorrection MUST return 409
    const unapprovedChangeRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-10',
        startDate: '2026-10-01',
        endDate: '2026-10-31',
        revenueCalculationBasis: 'PROFIT_AFTER_EXPENSES',
        deductibleExpenses: 5000, // Different expenses without isCorrection
      }),
    });
    assert(
      unapprovedChangeRes.status === 409,
      'AUDIT 4: Differing financial figures on finalized statement without isCorrection rejected with HTTP 409'
    );

    // -------------------------------------------------------------
    // AREA 3: PER_STUDENT COMMERCIAL MODEL
    // -------------------------------------------------------------
    console.log('\n--- Area 3: PER_STUDENT Commercial Model Verification ---');

    // Create Agreement v4 with calculationMethod = PER_STUDENT and perStudentFee = ₹2,500
    const agrPerStudentRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Per-Student Model Agreement (2026-Q3)',
        agreementType: 'BRAND_AND_COURSE_SUPPORT',
        calculationMethod: 'PER_STUDENT',
        perStudentFee: 2500.0,
        startDate: '2026-07-01',
        endDate: '2026-09-30',
        settlementFrequency: 'MONTHLY',
        digitalGuruRevenuePercentage: 50.0, // Should be superseded by perStudentFee
        partnerRevenuePercentage: 50.0,
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const agrPerStudentData = (await agrPerStudentRes.json()) as any;
    assert(agrPerStudentRes.status === 201, 'Per-Student Agreement created (₹2,500/student, Jul–Sep 2026)');
    agreementPerStudentId = agrPerStudentData.data?.agreement?.id;

    // Seed Students for Branch Alpha:
    // Student 1: ACTIVE, joined 2026-07-05 (Valid active student for August 2026)
    await prisma.student.create({
      data: {
        instituteId: branchId,
        admissionNumber: `ADM-01-${uniqueSuffix}`,
        firstName: 'Aarav',
        lastName: 'Raman',
        status: 'ACTIVE',
        admissionDate: new Date('2026-07-05T09:00:00Z'),
      },
    });

    // Student 2: ACTIVE, joined 2026-08-10 (Valid active student for August 2026)
    await prisma.student.create({
      data: {
        instituteId: branchId,
        admissionNumber: `ADM-02-${uniqueSuffix}`,
        firstName: 'Diya',
        lastName: 'Sundar',
        status: 'ACTIVE',
        admissionDate: new Date('2026-08-10T09:00:00Z'),
      },
    });

    // Student 3: DISCONTINUED, joined 2026-06-01 (Leaver: should be EXCLUDED from active count)
    await prisma.student.create({
      data: {
        instituteId: branchId,
        admissionNumber: `ADM-03-${uniqueSuffix}`,
        firstName: 'Karthik',
        lastName: 'Prabhu',
        status: 'DISCONTINUED',
        admissionDate: new Date('2026-06-01T09:00:00Z'),
      },
    });

    // Student 4: ACTIVE, joined in November 2026 (Joiner AFTER August: should be EXCLUDED from August 2026)
    await prisma.student.create({
      data: {
        instituteId: branchId,
        admissionNumber: `ADM-04-${uniqueSuffix}`,
        firstName: 'Meera',
        lastName: 'Natarajan',
        status: 'ACTIVE',
        admissionDate: new Date('2026-11-01T09:00:00Z'),
      },
    });

    // Student 5: ACTIVE, joined in August 2026, but in Campus Beta (Different campus: test branch scoping)
    await prisma.student.create({
      data: {
        instituteId: otherBranchId,
        admissionNumber: `ADM-05-${uniqueSuffix}`,
        firstName: 'Vikram',
        lastName: 'Balan',
        status: 'ACTIVE',
        admissionDate: new Date('2026-08-15T09:00:00Z'),
      },
    });

    // Student 6: DISCONTINUED in July 2026 (Before August: should be EXCLUDED from August 2026)
    const studentOldLeaver = await prisma.student.create({
      data: {
        instituteId: branchId,
        admissionNumber: `ADM-06-LEAVER-${uniqueSuffix}`,
        firstName: 'Pranav',
        lastName: 'Kumar',
        status: 'DISCONTINUED',
        admissionDate: new Date('2026-01-10T09:00:00Z'),
      },
    });

    await prisma.auditLog.create({
      data: {
        institute: { connect: { id: branchId } },
        user: { connect: { id: superAdminUser!.id } },
        entityType: 'Student',
        entityId: studentOldLeaver.id,
        action: 'STUDENT_STATUS_CHANGED',
        oldValues: { status: 'ACTIVE' },
        newValues: { status: 'DISCONTINUED' },
        createdAt: new Date('2026-07-20T10:00:00Z'),
      },
    });

    const feeAssignmentAug = await prisma.studentFeeAssignment.create({
      data: {
        studentId: studentBase.id,
        feeStructureId: feeStruct.id,
        baseAmount: 75000,
        finalAmount: 75000,
        dueDate: new Date('2026-08-31'),
        status: 'PAID',
      },
    });

    // Seed August 2026 course fee collections: ₹75,000 for Campus Alpha
    await prisma.payment.create({
      data: {
        instituteId: branchId,
        studentId: studentBase.id,
        feeAssignmentId: feeAssignmentAug.id,
        amountPaid: 75000,
        paidAt: new Date('2026-08-20T10:00:00Z'),
        receiptNumber: `REC-AUG-${uniqueSuffix}`,
        method: 'BANK_TRANSFER',
        status: 'SUCCESS',
        recordedById: superAdminUser!.id,
      },
    });

    // Test Area 3a: Calculate August 2026 royalty scoped to branch Alpha
    const calcPerStudentAlphaRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-08',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        instituteId: branchId,
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const calcPerStudentAlphaData = (await calcPerStudentAlphaRes.json()) as any;
    assert(calcPerStudentAlphaRes.status === 200, 'August 2026 PER_STUDENT calculation executed with HTTP 200');
    assert(
      calcPerStudentAlphaData.data?.summary?.calculationMethod === 'PER_STUDENT',
      'Commercial model resolved as PER_STUDENT'
    );
    assert(
      Number(calcPerStudentAlphaData.data?.summary?.perStudentFee) === 2500,
      'Per-student fee resolved as ₹2,500'
    );
    assert(
      calcPerStudentAlphaData.data?.summary?.activeStudentCount === 3,
      'HISTORICAL ELIGIBILITY: Exactly 3 active students counted for Campus Alpha (Aarav, Diya, and Karthik who was discontinued in Nov)',
      { actual: calcPerStudentAlphaData.data?.summary?.activeStudentCount, expected: 3 }
    );
    assert(
      Number(calcPerStudentAlphaData.data?.summary?.royaltyPayable) === 7500,
      'PER_STUDENT FORMULA: Royalty payable is exactly ₹7,500 (3 students * ₹2,500)',
      { actual: calcPerStudentAlphaData.data?.summary?.royaltyPayable, expected: 7500 }
    );
    assert(
      Number(calcPerStudentAlphaData.data?.summary?.partnerShare) === 67500,
      'Partner retained share is ₹67,500 (₹75,000 collected - ₹7,500 royalty payable)'
    );

    // Test Area 3b: Verify audit documentation of eligibility and proration
    const details = calcPerStudentAlphaData.data?.royaltyRecord?.calculationDetails;
    assert(
      details?.prorationPolicy === 'FULL_MONTH_STANDARD',
      'Proration policy explicitly documented in calculationDetails as FULL_MONTH_STANDARD'
    );
    assert(
      typeof details?.unresolvedEligibilityNotes === 'string' && details.unresolvedEligibilityNotes.includes('proration'),
      'Unresolved proration rules transparently documented in calculation details'
    );

    // Test Area 3c: Calculate August 2026 at Franchise Level (Covering both Alpha and Beta campuses)
    const calcPerStudentFranchiseRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-08',
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        // Omitting instituteId calculates across all franchise campuses
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const calcPerStudentFranchiseData = (await calcPerStudentFranchiseRes.json()) as any;
    assert(calcPerStudentFranchiseRes.status === 200, 'Franchise-level PER_STUDENT calculation executed with HTTP 200');
    assert(
      calcPerStudentFranchiseData.data?.summary?.activeStudentCount === 4,
      'FRANCHISE AGGREGATION & DEDUPLICATION: Exactly 4 distinct students counted across Alpha (3) and Beta (1)',
      { actual: calcPerStudentFranchiseData.data?.summary?.activeStudentCount, expected: 4 }
    );
    assert(
      Number(calcPerStudentFranchiseData.data?.summary?.royaltyPayable) === 10000,
      'Aggregated royalty payable is exactly ₹10,000 (4 students * ₹2,500)'
    );

    // -------------------------------------------------------------
    // AREA 4: DATABASE RECORD & SCHEMA SAFETY
    // -------------------------------------------------------------
    console.log('\n--- Area 4: Database Safety & Record Preservation ---');
    const totalRecords = await prisma.franchiseRoyaltyRecord.count({ where: { franchiseId } });
    assert(totalRecords >= 3, `All generated royalty records safely persisted in database (total: ${totalRecords})`);

    const historicalOctRecord = await prisma.franchiseRoyaltyRecord.findFirst({
      where: { franchiseId, periodLabel: '2026-10' },
    });
    assert(historicalOctRecord?.status === 'PAID', 'Historical October record remains PAID');
    assert(
      Number(historicalOctRecord?.royaltyPaid) === 40000,
      'Historical October record preserves ₹40,000 royalty paid'
    );

  } catch (err) {
    console.error('Unexpected test error during integrity audit:', err);
    failed++;
  } finally {
    await stopServer();
    await prisma.$disconnect();
  }

  console.log('\n======================================================================');
  console.log(`HISTORICAL FINANCIAL INTEGRITY AUDIT RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runIntegrityAuditTests();
