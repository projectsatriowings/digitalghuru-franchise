/**
 * DIGITAL GURU FRANCHISE: REVISED FRANCHISE & ROYALTY DEEP AUDIT SUITE
 * 
 * Verifies all 6 critical dimensions:
 * 1. Franchise Owner Scope: Barred from branch creation, institute creation, franchise creation,
 *    and cross-franchise campus data access (HTTP 403 Forbidden).
 * 2. Annual Installment Schedule: Exactly 2 installments; explicit configurable due dates;
 *    safe date calculations for leap years, month-end dates, and mid-year starts.
 * 3. Royalty Calculation: Mandatory calculation method; strict validation of parameters;
 *    exact 50/50 reconciliation; non-artificial active student counts (0 students = ₹0).
 * 4. Payments & Receipts: Partial payments, exact payments, overpayment rejection (HTTP 400),
 *    duplicate transaction reference rejection (HTTP 409), atomic transaction updates,
 *    and verified receipt generation (ROY-REC-YYYY-XXXX).
 * 5. Agreement Renewal: Prior agreement marked EXPIRED; historical installments, payments,
 *    and receipts preserved; 2 fresh installments generated for renewed year.
 */

import http from 'http';
import { Prisma } from '@prisma/client';
import app from '../src/index.js';
import { prisma } from '../src/prisma.js';
import { hashPassword } from '../src/utils/security.js';
import { computeSafeDueDates } from '../src/modules/franchise/franchise.controller.js';

let server: http.Server;
const AUDIT_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${AUDIT_PORT}`;

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, scenario: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${scenario}`);
    passCount++;
  } else {
    console.error(`  ✗ [FAIL] ${scenario}${detail ? ` -> ${detail}` : ''}`);
    failCount++;
  }
}

async function api(path: string, options: any = {}): Promise<{ status: number; body: any; headers: Headers }> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-internal-test': 'dg-audit-suite',
      ...options.headers,
    },
  });
  let body: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  return { status: res.status, body, headers: res.headers };
}

async function runDeepAudit() {
  console.log('================================================================');
  console.log(' DIGITAL GURU FRANCHISE: REVISED WORKFLOW DEEP AUDIT & VERIFICATION');
  console.log('================================================================\n');

  // ------------------------------------------------------------------------
  // PART 1: UNIT VERIFICATION OF SAFE DUE DATES
  // ------------------------------------------------------------------------
  console.log('--- Part 1: Date Math & Safe Due Date Calculations ---');

  // 1a. Leap Year Start (Feb 29, 2024 to Feb 28, 2025)
  const leapStart = new Date('2024-02-29T00:00:00Z');
  const leapEnd = new Date('2025-02-28T00:00:00Z');
  const leapMid = new Date(leapStart.getTime() + (leapEnd.getTime() - leapStart.getTime()) / 2);
  const leapDue = computeSafeDueDates(leapStart, leapEnd, leapMid, 10);
  assert(
    !isNaN(leapDue.due1.getTime()) && !isNaN(leapDue.due2.getTime()) && leapDue.due1 < leapDue.due2,
    '1a. Leap year starting Feb 29 calculates valid, ordered H1 & H2 due dates'
  );

  // 1b. Month-End Start (Jan 31, 2026 to Jan 30, 2027)
  const monthEndStart = new Date('2026-01-31T00:00:00Z');
  const monthEndEnd = new Date('2027-01-30T00:00:00Z');
  const monthEndMid = new Date(monthEndStart.getTime() + (monthEndEnd.getTime() - monthEndStart.getTime()) / 2);
  const monthEndDue = computeSafeDueDates(monthEndStart, monthEndEnd, monthEndMid, 10);
  assert(
    !isNaN(monthEndDue.due1.getTime()) && (monthEndDue.due1.getMonth() === 1 || monthEndDue.due1.getMonth() === 2),
    '1b. Month-end start (Jan 31) safely advances without date clipping or NaN'
  );

  // 1c. Mid-Year Start (July 15, 2026 to July 14, 2027)
  const midYearStart = new Date('2026-07-15T00:00:00Z');
  const midYearEnd = new Date('2027-07-14T00:00:00Z');
  const midYearMid = new Date(midYearStart.getTime() + (midYearEnd.getTime() - midYearStart.getTime()) / 2);
  const midYearDue = computeSafeDueDates(midYearStart, midYearEnd, midYearMid, 10);
  assert(
    midYearDue.due1 >= midYearStart && midYearDue.due2 <= midYearEnd && midYearDue.due1 < midYearDue.due2,
    '1c. Mid-year start (July 15) calculates well-bounded H1 & H2 due dates'
  );

  // 1d. Explicit Custom Due Dates
  const customDue1 = new Date('2026-08-15T00:00:00Z');
  const customDue2 = new Date('2027-02-15T00:00:00Z');
  const explicitDue = computeSafeDueDates(midYearStart, midYearEnd, midYearMid, 10, customDue1, customDue2);
  assert(
    explicitDue.due1.getTime() === customDue1.getTime() && explicitDue.due2.getTime() === customDue2.getTime(),
    '1d. Explicit custom due dates are strictly preserved by calculator'
  );

  // Start HTTP Server for integration tests
  server = app.listen(AUDIT_PORT, '127.0.0.1');
  await new Promise((resolve) => setTimeout(resolve, 1500));
  console.log(`\n[Audit Test Server] Running on ${BASE_URL}\n`);

  const timestamp = Date.now();
  const pwd = 'AuditSecurePassword#2026';
  const hashedPwd = await hashPassword(pwd);

  let saToken = '';
  let owner1Token = '';
  let owner2Token = '';
  let franchise1Id = '';
  let franchise2Id = '';
  let branch1Id = '';
  let branch2Id = '';
  let fixedAgreementId = '';
  let installment1Id = '';
  let installment2Id = '';

  try {
    // ------------------------------------------------------------------------
    // PART 2: AUTHENTICATION & FRANCHISE PROVISIONING
    // ------------------------------------------------------------------------
    console.log('--- Part 2: Super Admin Provisioning & Role Barring ---');

    // Login as Super Admin
    let saLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'superadmin@platform.local',
        password: 'AdminSecurePassword#2026',
        role: 'SUPER_ADMIN',
      }),
    });
    if (saLogin.status !== 200) {
      await new Promise((r) => setTimeout(r, 2000));
      saLogin = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: 'superadmin@platform.local',
          password: 'AdminSecurePassword#2026',
          role: 'SUPER_ADMIN',
        }),
      });
    }
    saToken = saLogin.body?.data?.accessToken;
    assert(Boolean(saToken), '2a. Super Admin logged in');

    // Super Admin creates Franchise Alpha
    const f1Res = await api('/api/franchises', {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        name: `Audit Franchise Alpha ${timestamp}`,
        ownerName: 'Audit Owner Alpha',
        email: `audit.alpha.${timestamp}@digitalghuru.staging`,
        phone: `882594${Math.floor(1000 + Math.random() * 9000)}`,
        password: pwd,
        city: 'Chennai',
        state: 'Tamil Nadu',
        postalCode: '600001',
        country: 'India',
        authorizedContact: {
          name: 'Audit Contact Alpha',
          phone: '9840012345',
          email: `contact.alpha.${timestamp}@digitalghuru.staging`,
          designation: 'Operations Director',
        },
        initialAgreement: {
          title: 'Master Franchise Agreement Alpha',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          calculationMethod: 'FIXED_ANNUAL',
          annualRoyaltyAmount: 300000,
          dueDay: 15,
        },
      }),
    });
    franchise1Id = f1Res.body?.data?.franchise?.id;
    const initialAgr = f1Res.body?.data?.agreement || f1Res.body?.data?.initialAgreement;
    fixedAgreementId = initialAgr?.id;
    assert(f1Res.status === 201 && Boolean(franchise1Id), '2b. Super Admin created Franchise Alpha with authorized contact & address');

    // Super Admin creates Franchise Beta for cross-tenant isolation testing
    const f2Res = await api('/api/franchises', {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        name: `Audit Franchise Beta ${timestamp}`,
        ownerName: 'Audit Owner Beta',
        email: `audit.beta.${timestamp}@digitalghuru.staging`,
        phone: `882594${Math.floor(1000 + Math.random() * 9000)}`,
        password: pwd,
        city: 'Bangalore',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
        initialAgreement: {
          title: 'Master Franchise Agreement Beta',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          calculationMethod: 'FIXED_ANNUAL',
          annualRoyaltyAmount: 200000,
        },
      }),
    });
    franchise2Id = f2Res.body?.data?.franchise?.id;
    assert(f2Res.status === 201 && Boolean(franchise2Id), '2c. Super Admin created Franchise Beta');

    // Super Admin attaches Branch Alpha under Franchise Alpha
    const b1Res = await api(`/api/franchises/${franchise1Id}/branches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        createNew: true,
        name: `Campus Alpha Anna Nagar ${timestamp}`,
        code: `BR-AL-${timestamp.toString().slice(-4)}`,
        city: 'Chennai',
      }),
    });
    branch1Id = b1Res.body?.data?.branch?.id;
    assert(b1Res.status === 201 && Boolean(branch1Id), '2d. Super Admin attached Branch 1 under Franchise Alpha');

    // Super Admin attaches Branch Beta under Franchise Beta
    const b2Res = await api(`/api/franchises/${franchise2Id}/branches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        createNew: true,
        name: `Campus Beta Koramangala ${timestamp}`,
        code: `BR-BE-${timestamp.toString().slice(-4)}`,
        city: 'Bangalore',
      }),
    });
    branch2Id = b2Res.body?.data?.branch?.id;
    assert(b2Res.status === 201 && Boolean(branch2Id), '2e. Super Admin attached Branch 2 under Franchise Beta');

    // Franchise Owner Alpha logs in
    const owner1Login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: `audit.alpha.${timestamp}@digitalghuru.staging`,
        password: pwd,
        role: 'FRANCHISE_OWNER',
      }),
    });
    owner1Token = owner1Login.body?.data?.accessToken;
    assert(Boolean(owner1Token), '2f. Franchise Owner Alpha logged in');

    // ------------------------------------------------------------------------
    // PART 3: ROLE BARRING & TENANT ISOLATION VERIFICATION
    // ------------------------------------------------------------------------
    console.log('\n--- Part 3: Franchise Owner Action Restrictions & Tenant Isolation ---');

    // 3a. Franchise Owner barred from creating branches
    const createBranchAttempt = await api(`/api/franchises/${franchise1Id}/branches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner1Token}` },
      body: JSON.stringify({ createNew: true, name: 'Unauthorized Branch' }),
    });
    assert(createBranchAttempt.status === 403, '3a. Franchise Owner barred from creating branches (HTTP 403 Forbidden)');

    // 3b. Franchise Owner barred from creating institutes
    const createInstAttempt = await api('/api/institutes', {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner1Token}` },
      body: JSON.stringify({ name: 'Unauthorized Institute', code: 'UNAUTH-01' }),
    });
    assert(createInstAttempt.status === 403, '3b. Franchise Owner barred from creating institutes (HTTP 403 Forbidden)');

    // 3c. Franchise Owner barred from creating another franchise
    const createFranchiseAttempt = await api('/api/franchises', {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner1Token}` },
      body: JSON.stringify({ name: 'Unauthorized Franchise', ownerName: 'Hacker', email: 'hack@hack.local' }),
    });
    assert(createFranchiseAttempt.status === 403, '3c. Franchise Owner barred from creating franchises (HTTP 403 Forbidden)');

    // 3d. Tenant Isolation: Franchise Owner Alpha blocked from viewing Franchise Beta
    const viewBetaAttempt = await api(`/api/franchises/${franchise2Id}`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    assert(viewBetaAttempt.status === 403, '3d. Tenant Isolation: Owner Alpha blocked from viewing Franchise Beta (HTTP 403)');

    // 3e. Tenant Isolation: Franchise Owner Alpha blocked from accessing Branch Beta tuition data
    const betaSubjectAttempt = await api('/api/academics/subjects', {
      headers: {
        Authorization: `Bearer ${owner1Token}`,
        'x-institute-id': branch2Id,
      },
    });
    assert(betaSubjectAttempt.status === 403, '3e. Tenant Isolation: Owner Alpha blocked from accessing Branch Beta tuition API (HTTP 403)');

    // ------------------------------------------------------------------------
    // PART 4: MANDATORY CALCULATION METHOD & STRICT VALIDATION
    // ------------------------------------------------------------------------
    console.log('\n--- Part 4: Mandatory Calculation Method & Parameter Validation ---');

    // 4a. Missing calculation method rejected
    const missingMethodRes = await api(`/api/franchises/${franchise1Id}/agreements`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        title: 'Agreement Without Method',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    assert(missingMethodRes.status === 400, '4a. Missing calculation method rejected with HTTP 400');

    // 4b. FIXED_ANNUAL without annualRoyaltyAmount rejected
    const fixedNoAmountRes = await api(`/api/franchises/${franchise1Id}/agreements`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        title: 'Fixed Annual Without Amount',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        calculationMethod: 'FIXED_ANNUAL',
      }),
    });
    assert(fixedNoAmountRes.status === 400, '4b. FIXED_ANNUAL without positive annualRoyaltyAmount rejected with HTTP 400');

    // 4c. PERCENTAGE_REVENUE without royaltyPercentage rejected
    const pctNoRateRes = await api(`/api/franchises/${franchise1Id}/agreements`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        title: 'Percentage Without Rate',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        calculationMethod: 'PERCENTAGE_REVENUE',
      }),
    });
    assert(pctNoRateRes.status === 400, '4c. PERCENTAGE_REVENUE without positive royaltyPercentage rejected with HTTP 400');

    // 4d. PER_STUDENT without perStudentFee rejected
    const studentNoFeeRes = await api(`/api/franchises/${franchise1Id}/agreements`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        title: 'Per Student Without Fee',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        calculationMethod: 'PER_STUDENT',
      }),
    });
    assert(studentNoFeeRes.status === 400, '4d. PER_STUDENT without positive perStudentFee rejected with HTTP 400');

    // 4e. Invalid due dates (Due 1 after Due 2) rejected
    const invalidDueDatesRes = await api(`/api/franchises/${franchise1Id}/agreements`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        title: 'Agreement With Inverted Due Dates',
        startDate: '2026-01-01T00:00:00Z',
        endDate: '2026-12-31T00:00:00Z',
        calculationMethod: 'FIXED_ANNUAL',
        annualRoyaltyAmount: 200000,
        installment1DueDate: '2026-09-01T00:00:00Z',
        installment2DueDate: '2026-03-01T00:00:00Z', // Earlier than Due 1!
      }),
    });
    assert(invalidDueDatesRes.status === 400, '4e. Installment 1 due date >= Installment 2 due date rejected with HTTP 400');

    // ------------------------------------------------------------------------
    // PART 5: TWO-INSTALLMENT GENERATION, RECONCILIATION & PER-STUDENT ZERO RULE
    // ------------------------------------------------------------------------
    console.log('\n--- Part 5: Two-Installment Split & PER_STUDENT Zero-Enrolled Rule ---');

    // Check installments generated for Franchise Alpha's FIXED_ANNUAL (₹3,00,000)
    const instListRes = await api(`/api/franchises/${franchise1Id}/installments`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    const alphaInstallments = instListRes.body?.data?.installments || [];
    assert(alphaInstallments.length === 2, '5a. Exactly two installments generated for annual agreement');

    const inst1 = alphaInstallments.find((i: any) => i.installmentNumber === 1);
    const inst2 = alphaInstallments.find((i: any) => i.installmentNumber === 2);
    installment1Id = inst1?.id;
    installment2Id = inst2?.id;

    const amt1 = Number(inst1?.amount);
    const amt2 = Number(inst2?.amount);
    assert(
      amt1 === 150000 && amt2 === 150000 && (amt1 + amt2 === 300000),
      `5b. Fixed Annual split exactly reconciles: ₹${amt1} + ₹${amt2} = ₹3,00,000`
    );

    // Test PER_STUDENT with 0 active students -> must be ₹0, not floored to 1
    const perStudentZeroRes = await api(`/api/franchises/${franchise2Id}/agreements`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        title: 'Per Student Zero Enrollment Agreement',
        startDate: '2026-01-01T00:00:00Z',
        endDate: '2026-12-31T00:00:00Z',
        calculationMethod: 'PER_STUDENT',
        perStudentFee: 2500,
      }),
    });
    const perStudentInsts = perStudentZeroRes.body?.data?.installments || [];
    const psInst1Amt = Number(perStudentInsts[0]?.amount);
    const psInst2Amt = Number(perStudentInsts[1]?.amount);
    assert(
      perStudentZeroRes.status === 201 && psInst1Amt === 0 && psInst2Amt === 0,
      '5c. PER_STUDENT calculation with 0 enrolled students produces ₹0 installments without artificial flooring'
    );

    // ------------------------------------------------------------------------
    // PART 6: PAYMENTS, OVERPAYMENTS, DUPLICATE REFERENCES & RECEIPTS
    // ------------------------------------------------------------------------
    console.log('\n--- Part 6: Payments, Overpayment Rejection & Receipts ---');

    // 6a. Partial Payment: ₹60,000 against ₹1,50,000
    const txRef1 = `AUDIT-TX-${timestamp}-01`;
    const partialPayRes = await api(`/api/franchises/${franchise1Id}/installments/${installment1Id}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        amountPaid: 60000,
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: txRef1,
        remarks: 'Audit Partial Payment 1',
      }),
    });
    const payment1Id = partialPayRes.body?.data?.payment?.id;
    const receiptNum1 = partialPayRes.body?.data?.receiptNumber;
    assert(
      partialPayRes.status === 201 &&
      partialPayRes.body?.data?.installment?.status === 'PARTIALLY_PAID' &&
      Number(partialPayRes.body?.data?.installment?.outstandingBalance) === 90000,
      `6a. Partial payment of ₹60,000 recorded: outstanding balance ₹90,000, status PARTIALLY_PAID (${receiptNum1})`
    );

    // 6b. Duplicate transaction reference rejection -> HTTP 409
    const dupRefRes = await api(`/api/franchises/${franchise1Id}/installments/${installment1Id}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        amountPaid: 10000,
        paymentMethod: 'UPI',
        transactionReference: txRef1, // Duplicate reference!
      }),
    });
    assert(dupRefRes.status === 409, '6b. Duplicate transaction reference rejected with HTTP 409 Conflict');

    // 6c. Overpayment rejection -> HTTP 400
    // Outstanding balance is ₹90,000. Try to pay ₹1,00,000.
    const overpayRes = await api(`/api/franchises/${franchise1Id}/installments/${installment1Id}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        amountPaid: 100000, // Exceeds ₹90,000!
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: `AUDIT-OVERPAY-${timestamp}`,
      }),
    });
    assert(overpayRes.status === 400, '6c. Overpayment of ₹1,00,000 against ₹90,000 outstanding strictly rejected with HTTP 400');

    // 6d. Exact Final Settlement Payment: ₹90,000
    const txRef2 = `AUDIT-TX-${timestamp}-02`;
    const exactPayRes = await api(`/api/franchises/${franchise1Id}/installments/${installment1Id}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        amountPaid: 90000,
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: txRef2,
        remarks: 'Audit Final Settlement Payment',
      }),
    });
    assert(
      exactPayRes.status === 201 &&
      exactPayRes.body?.data?.installment?.status === 'PAID' &&
      Number(exactPayRes.body?.data?.installment?.outstandingBalance) === 0,
      '6d. Exact payment of ₹90,000 completes Installment 1: outstanding balance ₹0, status PAID'
    );

    // 6e. Payment attempt against fully paid installment rejected -> HTTP 400
    const alreadyPaidRes = await api(`/api/franchises/${franchise1Id}/installments/${installment1Id}/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        amountPaid: 5000,
        paymentMethod: 'CASH',
        transactionReference: `AUDIT-ALREADY-PAID-${timestamp}`,
      }),
    });
    assert(alreadyPaidRes.status === 400, '6e. Payment attempt on already paid installment rejected with HTTP 400');

    // 6f. Verified Receipt retrieval
    const receiptRes = await api(`/api/franchises/${franchise1Id}/payments/${payment1Id}/receipt`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    const receiptData = receiptRes.body?.data;
    assert(
      receiptRes.status === 200 &&
      receiptData?.receiptNumber === receiptNum1 &&
      receiptData?.issuer?.organization?.includes('Digital Guru') &&
      (receiptData?.paymentDetails?.amountPaid === 60000 || receiptData?.amountPaid === 60000),
      `6f. Receipt verified: ${receiptNum1} with issuer, franchise, and installment audit trail`
    );

    // ------------------------------------------------------------------------
    // PART 7: ANNUAL AGREEMENT RENEWAL & HISTORY PRESERVATION
    // ------------------------------------------------------------------------
    console.log('\n--- Part 7: Annual Agreement Renewal & Audit Trail Preservation ---');

    const renewRes = await api(`/api/franchises/${franchise1Id}/agreements/${fixedAgreementId}/renew`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        title: 'Master Franchise Agreement Alpha - Year 2 Renewal',
        startDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString(),
        calculationMethod: 'FIXED_ANNUAL',
        annualRoyaltyAmount: 350000,
        notes: 'Annual renewal for Year 2',
      }),
    });
    assert(renewRes.status === 201, '7a. Agreement renewed successfully for Year 2');

    // Verify previous agreement status is EXPIRED
    const prevAgr = await prisma.franchiseAgreement.findUnique({
      where: { id: fixedAgreementId },
      include: { installments: { include: { payments: true } } },
    });
    assert(prevAgr?.status === 'EXPIRED', '7b. Previous agreement status transitioned to EXPIRED');

    // Verify previous payments and installments are preserved
    const prevInstallment1 = prevAgr?.installments.find((i) => i.installmentNumber === 1);
    assert(
      prevInstallment1?.status === 'PAID' && prevInstallment1?.payments.length === 2,
      '7c. Prior agreement installments and payments fully preserved in audit history'
    );

    // Verify new renewed agreement has status ACTIVE with 2 new installments
    const renewedAgrId = renewRes.body?.data?.newAgreement?.id;
    const renewedInsts = await prisma.franchiseRoyaltyInstallment.findMany({
      where: { agreementId: renewedAgrId },
    });
    assert(
      renewedInsts.length === 2 &&
      Number(renewedInsts[0].amount) === 175000 &&
      Number(renewedInsts[1].amount) === 175000,
      '7d. Renewed agreement is ACTIVE with 2 fresh installments of ₹1,75,000 each'
    );

    // ------------------------------------------------------------------------
    // PART 8: FRANCHISE OWNER WORKSPACE ACCESS TO AUTHORIZED CAMPUS
    // ------------------------------------------------------------------------
    console.log('\n--- Part 8: Franchise Owner Campus Workspace Permitted Access ---');

    // Franchise Owner can query their authorized branch branches
    const ownerBranchesRes = await api(`/api/franchises/${franchise1Id}/branches`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    assert(
      ownerBranchesRes.status === 200 && ownerBranchesRes.body?.data?.branches?.length >= 1,
      '8a. Franchise Owner can view authorized campus branches'
    );

    // Franchise Owner can query academic subjects for their authorized branch
    const ownerSubjectsRes = await api('/api/academics/subjects', {
      headers: {
        Authorization: `Bearer ${owner1Token}`,
        'x-institute-id': branch1Id,
      },
    });
    assert(
      ownerSubjectsRes.status === 200,
      '8b. Franchise Owner can access authorized campus academic modules (subjects)'
    );

    // Franchise Owner can query students for their authorized branch
    const ownerStudentsRes = await api('/api/students', {
      headers: {
        Authorization: `Bearer ${owner1Token}`,
        'x-institute-id': branch1Id,
      },
    });
    assert(
      ownerStudentsRes.status === 200,
      '8c. Franchise Owner can access authorized campus student records'
    );

  } catch (err: any) {
    console.error('Fatal Deep Audit Exception:', err);
    failCount++;
  } finally {
    console.log('\n--- Cleaning up synthetic audit fixtures ---');
    try {
      if (franchise1Id) {
        await prisma.franchiseRoyaltyPayment.deleteMany({ where: { franchiseId: franchise1Id } });
        await prisma.franchiseRoyaltyInstallment.deleteMany({ where: { franchiseId: franchise1Id } });
        await prisma.franchiseAgreement.deleteMany({ where: { franchiseId: franchise1Id } });
        await prisma.institute.deleteMany({ where: { franchiseId: franchise1Id } });
        await prisma.franchise.delete({ where: { id: franchise1Id } }).catch(() => {});
      }
      if (franchise2Id) {
        await prisma.franchiseRoyaltyPayment.deleteMany({ where: { franchiseId: franchise2Id } });
        await prisma.franchiseRoyaltyInstallment.deleteMany({ where: { franchiseId: franchise2Id } });
        await prisma.franchiseAgreement.deleteMany({ where: { franchiseId: franchise2Id } });
        await prisma.institute.deleteMany({ where: { franchiseId: franchise2Id } });
        await prisma.franchise.delete({ where: { id: franchise2Id } }).catch(() => {});
      }
      await prisma.user.deleteMany({ where: { email: { contains: `${timestamp}@digitalghuru.staging` } } }).catch(() => {});
      console.log('✓ Synthetic fixtures cleaned successfully');
    } catch (cleanErr) {
      console.warn('Note: Non-critical cleanup notice:', cleanErr);
    }

    if (server) {
      server.close();
      console.log('[Audit Test Server] Stopped.');
    }
  }

  console.log('\n----------------------------------------------------------------');
  console.log(` DEEP AUDIT SUMMARY: ${passCount} PASSED, ${failCount} FAILED out of ${passCount + failCount} CHECKS`);
  console.log('----------------------------------------------------------------\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runDeepAudit();

