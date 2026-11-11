import '../src/dns-preload.cjs';
import app from '../src/index.js';
import http from 'http';
import { prisma } from '../src/prisma.js';

let server: http.Server;
const TEST_PORT = 5097;
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
      console.log(`[Compliance Review Test Server] Listening on ${BASE_URL}`);
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('[Compliance Review Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function runReviewTests() {
  console.log('\n======================================================================');
  console.log('DIGITAL GURU FRANCHISE – FINAL CLIENT REQUIREMENT COMPLIANCE REVIEW');
  console.log('Validating Editability, Idempotency, Commercial Models & Expense Rules');
  console.log('======================================================================\n');

  await startServer();

  let superAdminToken = '';
  let franchiseId = '';
  let ownerToken = '';
  let branchId = '';

  try {
    // -------------------------------------------------------------
    // SETUP: Super Admin Authentication & Test Franchise
    // -------------------------------------------------------------
    console.log('--- Step 0: Super Admin Authentication & Test Center Setup ---');
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
      name: `Compliance Review Center ${uniqueSuffix}`,
      ownerName: `Vijay Anand ${uniqueSuffix}`,
      email: `vijay.compliance${uniqueSuffix}@example.com`,
      phone: `99440${uniqueSuffix.slice(-5)}`,
      password: 'FranchiseOwnerPass#2026',
      city: 'Salem',
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
    assert(createFrRes.status === 201 && !!createFrData.data?.franchise?.id, 'Test franchise center created successfully');
    franchiseId = createFrData.data?.franchise?.id;

    // Login as Franchisee Admin
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
    assert(ownerLoginRes.status === 200 && !!ownerLoginData.data?.accessToken, 'Franchisee Admin authenticated successfully');
    ownerToken = ownerLoginData.data?.accessToken;

    // Create branch
    const bRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Salem Central Campus ${uniqueSuffix}`,
        code: `SLM-${uniqueSuffix}`,
        city: 'Salem',
        state: 'Tamil Nadu',
      }),
    });
    const bData = (await bRes.json()) as any;
    assert(bRes.status === 201 && !!bData.data?.branch?.id, 'Franchise campus created successfully');
    branchId = bData.data?.branch?.id;

    // -------------------------------------------------------------
    // REQUIREMENT 1: VERIFY AGREEMENT TEMPLATE DEFAULTS & EDITABILITY
    // -------------------------------------------------------------
    console.log('\n--- Section 1.1: NEW_CENTRE_JOINT_INVESTMENT Editability ---');
    // 50:50 and ₹1-2L must not be mandatory; can configure e.g. 70:30 setup at ₹3,50,000, 40:60 revenue split
    const newCentreCustomPayload = {
      agreementType: 'NEW_CENTRE_JOINT_INVESTMENT',
      title: 'Custom Capitalized New Centre Agreement',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      settlementFrequency: 'MONTHLY',
      revenueCalculationBasis: 'GROSS_COURSE_FEES',
      // Independent revenue split: 40% DG / 60% Partner
      digitalGuruRevenuePercentage: 40.0,
      partnerRevenuePercentage: 60.0,
      // Custom investment setup: ₹3,50,000 (70% Partner, 30% DG) - not restricted to ₹1-2L or 50:50
      totalInvestment: 350000,
      digitalGuruInvestmentAmount: 105000,
      partnerInvestmentAmount: 245000,
      digitalGuruInvestmentPercentage: 30.0,
      partnerInvestmentPercentage: 70.0,
      operationalSetupContribution: 80000,
      investmentNotes: 'Negotiated capital structure (70% partner, 30% franchisor)',
      // Editable responsibilities
      expenseResponsibilities: {
        trainerSalaries: 'DIGITAL_GURU',
        rent: 'PARTNER',
        staffSalaries: 'PARTNER',
        marketing: 'SHARED',
        operationalSetup: 'SHARED',
      },
      marketingResponsibleParty: 'SHARED',
      marketingSupportDurationMonths: 6, // 6 months negotiated instead of 3
      courseSoftwareAccessEnabled: true,
      terms: 'Custom Model A terms',
    };

    const resNC = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(newCentreCustomPayload),
    });
    const dataNC = (await resNC.json()) as any;
    assert(resNC.status === 201, 'Model A accepts custom negotiated investment and revenue split');
    assert(Number(dataNC.data?.agreement?.totalInvestment) === 350000, 'Model A total setup investment saved as ₹3,50,000 (not restricted to ₹1–2L)');
    assert(Number(dataNC.data?.agreement?.partnerInvestmentPercentage) === 70, 'Model A partner investment percentage saved as 70% (not restricted to 50:50)');
    assert(Number(dataNC.data?.agreement?.digitalGuruRevenuePercentage) === 40, 'Model A revenue split saved as 40:60 (independent of investment split)');
    assert(dataNC.data?.agreement?.marketingSupportDurationMonths === 6, 'Model A marketing duration editable (saved as 6 months)');

    console.log('\n--- Section 1.2: EXISTING_CENTRE Conversion Editability ---');
    // Indicative default is ₹0, but allows additional investment if negotiated
    const existingCentreNegotiatedPayload = {
      agreementType: 'EXISTING_CENTRE',
      title: 'Existing Centre Conversion with Infrastructure Upgrades',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      settlementFrequency: 'MONTHLY',
      revenueCalculationBasis: 'GROSS_COURSE_FEES',
      // Editable revenue share: 55:45
      digitalGuruRevenuePercentage: 55.0,
      partnerRevenuePercentage: 45.0,
      // Additional negotiated investment for lab upgrades: ₹75,000
      totalInvestment: 75000,
      digitalGuruInvestmentAmount: 25000,
      partnerInvestmentAmount: 50000,
      digitalGuruInvestmentPercentage: 33.33,
      partnerInvestmentPercentage: 66.67,
      expenseResponsibilities: {
        trainerSalaries: 'DIGITAL_GURU',
        rent: 'PARTNER',
        staffSalaries: 'PARTNER',
        marketing: 'DIGITAL_GURU',
      },
      marketingResponsibleParty: 'DIGITAL_GURU',
      marketingSupportDurationMonths: 3,
      courseSoftwareAccessEnabled: true,
      terms: 'Model B negotiated investment terms',
    };

    const resEC = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(existingCentreNegotiatedPayload),
    });
    const dataEC = (await resEC.json()) as any;
    assert(resEC.status === 201, 'Model B accepts additional negotiated investment');
    assert(Number(dataEC.data?.agreement?.totalInvestment) === 75000, 'Model B stores negotiated setup investment (₹75,000)');
    assert(Number(dataEC.data?.agreement?.digitalGuruRevenuePercentage) === 55, 'Model B 55:45 revenue split stored accurately');

    console.log('\n--- Section 1.3: BRAND_AND_COURSE_SUPPORT (Fixed Fee vs Percentage-Based) ---');
    // Test 1: Fixed annual fee of ₹1,50,000 (confirming ₹2 Lakh is not a fixed universal requirement)
    const brandFixedPayload = {
      agreementType: 'BRAND_AND_COURSE_SUPPORT',
      title: 'Brand & Course Support (Fixed ₹1.5L Annual Arrangement)',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      calculationMethod: 'FIXED_ANNUAL',
      annualRoyaltyAmount: 150000, // ₹1,50,000 instead of ₹2,00,000
      settlementFrequency: 'YEARLY',
      revenueCalculationBasis: 'GROSS_COURSE_FEES',
      digitalGuruRevenuePercentage: 0,
      partnerRevenuePercentage: 100,
      courseSoftwareAccessEnabled: true,
      courseSoftwarePricingNotes: 'Licensed Course Academy LMS included',
      terms: 'Model C fixed ₹1.5L terms',
    };

    const resBrandFixed = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(brandFixedPayload),
    });
    const dataBrandFixed = (await resBrandFixed.json()) as any;
    assert(resBrandFixed.status === 201, 'Model C creates successfully with custom annual fee ₹1,50,000');
    assert(Number(dataBrandFixed.data?.agreement?.annualRoyaltyAmount) === 150000, 'Model C annual fee saved as ₹1,50,000 (₹2L not universal)');
    assert(dataBrandFixed.data?.installments?.length === 2, 'Model C with YEARLY settlement generates exactly 2 installments');
    assert(Number(dataBrandFixed.data?.installments[0]?.amount) === 75000, 'Installment 1 is exactly ₹75,000 (50% of ₹1,50,000)');
    assert(Number(dataBrandFixed.data?.installments[1]?.amount) === 75000, 'Installment 2 is exactly ₹75,000 (50% of ₹1,50,000)');

    // Test 2: Percentage-based arrangement for BRAND_AND_COURSE_SUPPORT
    const brandPercentagePayload = {
      agreementType: 'BRAND_AND_COURSE_SUPPORT',
      title: 'Brand & Course Support (Percentage-Based 25:75 Arrangement)',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      calculationMethod: 'PERCENTAGE_REVENUE',
      digitalGuruRevenuePercentage: 25.0,
      partnerRevenuePercentage: 75.0,
      annualRoyaltyAmount: 100000, // Base reference for annual installments
      settlementFrequency: 'YEARLY',
      revenueCalculationBasis: 'GROSS_COURSE_FEES',
      courseSoftwareAccessEnabled: false, // Software independently disabled
      courseSoftwarePricingNotes: 'External LMS utilized by partner',
      terms: 'Model C percentage terms',
    };

    const resBrandPct = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(brandPercentagePayload),
    });
    const dataBrandPct = (await resBrandPct.json()) as any;
    assert(resBrandPct.status === 201, 'Model C supports independent percentage-based commercial arrangement');
    assert(dataBrandPct.data?.agreement?.calculationMethod === 'PERCENTAGE_REVENUE', 'Model C calculationMethod stored as PERCENTAGE_REVENUE');
    assert(Number(dataBrandPct.data?.agreement?.digitalGuruRevenuePercentage) === 25, 'Model C DG revenue percentage stored as 25%');
    assert(dataBrandPct.data?.agreement?.courseSoftwareAccessEnabled === false, 'Course software independently configurable (disabled)');

    console.log('\n--- Section 1.4: CUSTOM_AGREEMENT Dimensional Independence ---');
    const customPayload = {
      agreementType: 'CUSTOM_AGREEMENT',
      title: 'Tailored Independent Agreement',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      settlementFrequency: 'MONTHLY',
      revenueCalculationBasis: 'PROFIT_AFTER_EXPENSES',
      digitalGuruRevenuePercentage: 35.0,
      partnerRevenuePercentage: 65.0,
      totalInvestment: 120000,
      digitalGuruInvestmentAmount: 40000,
      partnerInvestmentAmount: 80000,
      digitalGuruInvestmentPercentage: 33.33,
      partnerInvestmentPercentage: 66.67,
      expenseResponsibilities: {
        trainerSalaries: 'DIGITAL_GURU',
        rent: 'PARTNER',
        utilities: 'PARTNER',
      },
      marketingResponsibleParty: 'PARTNER',
      marketingSupportDurationMonths: 0,
      courseSoftwareAccessEnabled: true,
      terms: 'Model D terms',
    };

    const resCustom = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(customPayload),
    });
    const dataCustom = (await resCustom.json()) as any;
    assert(resCustom.status === 201, 'Model D created with fully independent dimensions');
    assert(Number(dataCustom.data?.agreement?.digitalGuruRevenuePercentage) === 35, 'Custom revenue split (35:65) stored accurately');
    const activeAgreementId = dataCustom.data?.agreement?.id;

    // -------------------------------------------------------------
    // REQUIREMENT 2: MONTHLY ROYALTY STATEMENT WORKFLOW & IDEMPOTENCY
    // -------------------------------------------------------------
    console.log('\n--- Section 2: Monthly Royalty Statement Workflow & Idempotency ---');

    // 1. Seed actual student fee collections in the campus
    const batch = await prisma.batch.findFirst() || await prisma.batch.create({
      data: {
        instituteId: branchId,
        name: `Batch Compliance ${uniqueSuffix}`,
        academicYear: '2026-2027',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });

    const feeStruct = await prisma.feeStructure.create({
      data: {
        instituteId: branchId,
        batchId: batch.id,
        name: `Course Fee Comprehensive ${uniqueSuffix}`,
        amount: 80000,
        frequency: 'ONE_TIME',
      },
    });

    const student = await prisma.student.create({
      data: {
        instituteId: branchId,
        admissionNumber: `ADM-COMP-${uniqueSuffix}`,
        firstName: 'Divya',
        lastName: `Suresh ${uniqueSuffix}`,
        status: 'ACTIVE',
      },
    });

    const feeAssignment = await prisma.studentFeeAssignment.create({
      data: {
        studentId: student.id,
        feeStructureId: feeStruct.id,
        baseAmount: 80000,
        finalAmount: 80000,
        dueDate: new Date('2026-12-31'),
        status: 'PAID',
      },
    });

    const superAdminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });

    // Payment of ₹80,000 on June 15, 2026
    const payment = await prisma.payment.create({
      data: {
        instituteId: branchId,
        studentId: student.id,
        feeAssignmentId: feeAssignment.id,
        receiptNumber: `REC-COMP1-${uniqueSuffix}`,
        amountPaid: 80000,
        method: 'BANK_TRANSFER',
        status: 'SUCCESS',
        paidAt: new Date('2026-06-15T10:00:00.000Z'),
        recordedById: superAdminUser!.id,
      },
    });
    assert(!!payment.id, 'Seeded actual course fee payment of ₹80,000 for period 2026-06');

    // Seed payment adjustment / refund of ₹5,000 for net revenue testing
    const adjustment = await prisma.paymentAdjustment.create({
      data: {
        paymentId: payment.id,
        adjustmentType: 'REFUND',
        amount: 5000,
        reason: 'Authorized Early Bird Scholarship concession',
        authorizedById: superAdminUser!.id,
      },
    });
    assert(!!adjustment.id, 'Seeded fee refund adjustment of ₹5,000');

    // 2a: Run statement calculation for 2026-06 (Profit After Expenses basis)
    const calcPayload1 = {
      periodLabel: '2026-06',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      revenueCalculationBasis: 'PROFIT_AFTER_EXPENSES',
      deductibleExpenses: 20000, // ₹20,000 approved operating expenses
    };

    const calc1Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(calcPayload1),
    });
    const calc1Data = (await calc1Res.json()) as any;
    assert(calc1Res.status === 200, 'First calculation run executed with HTTP 200');
    const stmt1Id = calc1Data.data?.royaltyRecord?.id;
    assert(!!stmt1Id, 'Royalty record generated with unique ID');
    assert(Number(calc1Data.data?.summary?.grossCollection) === 80000, 'Gross collections registered at ₹80,000');
    assert(Number(calc1Data.data?.summary?.deductibleExpenses) === 20000, 'Deductible expenses logged as ₹20,000');
    // Pool = 80,000 - 20,000 = 60,000. Active agreement is Model D (35% DG : 65% Partner)
    assert(Number(calc1Data.data?.summary?.distributableAmount) === 60000, 'Distributable profit pool is exactly ₹60,000 (₹80k - ₹20k)');
    assert(Number(calc1Data.data?.summary?.royaltyPayable) === 21000, 'DG 35% profit share on ₹60,000 is ₹21,000');
    assert(Number(calc1Data.data?.summary?.partnerShare) === 39000, 'Partner 65% profit share on ₹60,000 is ₹39,000');

    // 2b: IDEMPOTENCY CHECK - Recalculate same period 2026-06 with updated approved expenses
    console.log('\n--- Section 2b: Idempotency & Duplicate Prevention Verification ---');
    const calcPayloadRetry = {
      periodLabel: '2026-06',
      startDate: '2026-06-01',
      endDate: '2026-06-30',
      revenueCalculationBasis: 'PROFIT_AFTER_EXPENSES',
      deductibleExpenses: 25000, // Updated from 20k to 25k
    };

    const countBeforeRetry = await prisma.franchiseRoyaltyRecord.count({
      where: { franchiseId, periodLabel: '2026-06' },
    });
    assert(countBeforeRetry === 1, 'Exactly 1 record exists before retry');

    const retryRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(calcPayloadRetry),
    });
    const retryData = (await retryRes.json()) as any;
    assert(retryRes.status === 200, 'Calculation retry executed successfully with HTTP 200');

    const countAfterRetry = await prisma.franchiseRoyaltyRecord.count({
      where: { franchiseId, periodLabel: '2026-06' },
    });
    assert(countAfterRetry === 1, 'IDEMPOTENT: Re-running calculation does NOT create a duplicate statement (count remains 1)');
    assert(retryData.data?.royaltyRecord?.id === stmt1Id, 'IDEMPOTENT: Existing statement record updated in-place (ID preserved)');
    // Pool = 80,000 - 25,000 = 55,000. 35% DG = 19,250. 65% Partner = 35,750
    assert(Number(retryData.data?.summary?.distributableAmount) === 55000, 'Updated distributable profit pool is ₹55,000 (₹80k - ₹25k)');
    assert(Number(retryData.data?.summary?.royaltyPayable) === 19250, 'Updated DG 35% share is ₹19,250');
    assert(Number(retryData.data?.summary?.partnerShare) === 35750, 'Updated Partner 65% share is ₹35,750');

    // 2c: NO DOUBLE COUNTING & DATE SCOPING
    console.log('\n--- Section 2c: Collections Scoping & Date Isolation ---');
    // Seed payment in July 2026 (outside June period)
    await prisma.payment.create({
      data: {
        instituteId: branchId,
        studentId: student.id,
        feeAssignmentId: feeAssignment.id,
        receiptNumber: `REC-COMP-JULY-${uniqueSuffix}`,
        amountPaid: 40000,
        method: 'UPI',
        status: 'SUCCESS',
        paidAt: new Date('2026-07-10T10:00:00.000Z'),
        recordedById: superAdminUser!.id,
      },
    });

    const juneCheckRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-06',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const juneCheckData = (await juneCheckRes.json()) as any;
    assert(Number(juneCheckData.data?.summary?.grossCollection) === 80000, 'NO DOUBLE COUNTING: July payments (₹40,000) are strictly excluded from June statements');

    // 2d: HISTORICAL STATEMENT INTEGRITY AFTER AGREEMENT REVISION
    console.log('\n--- Section 2d: Historical Statement Immutability on Agreement Revision ---');
    // Snapshot the June statement amount and version before revision
    const juneStmtBeforeRevise = await prisma.franchiseRoyaltyRecord.findFirst({
      where: { franchiseId, periodLabel: '2026-06' },
    });
    const originalDgRoyalty = Number(juneStmtBeforeRevise?.royaltyPayable);

    // Revise the agreement from Model D (35:65) to Version 2 with 50:50 split
    const reviseRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements/${activeAgreementId}/revise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Revised Agreement v2',
        startDate: '2026-07-01',
        endDate: '2027-06-30',
        settlementFrequency: 'MONTHLY',
        digitalGuruRevenuePercentage: 50.0,
        partnerRevenuePercentage: 50.0,
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    assert(reviseRes.status === 201, 'Agreement revised to v2 (50:50 split)');

    // Verify historical June statement remains completely unchanged
    const juneStmtAfterRevise = await prisma.franchiseRoyaltyRecord.findFirst({
      where: { franchiseId, periodLabel: '2026-06' },
    });
    assert(Number(juneStmtAfterRevise?.royaltyPayable) === originalDgRoyalty, 'HISTORICAL IMMUTABILITY: Statement calculated under v1 preserves original royalty amount after agreement revision');
    assert(Number(juneStmtAfterRevise?.royaltyPercentage) === 35, 'HISTORICAL IMMUTABILITY: Statement preserves original 35% royalty rate');

    // -------------------------------------------------------------
    // REQUIREMENT 3: DIRECT PAYER EXPENSES VS DEDUCTIBLE EXPENSES
    // -------------------------------------------------------------
    console.log('\n--- Section 3: Direct Payer Expenses vs Deductible Operating Expenses ---');
    const calcGrossWithDirectRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-07',
        startDate: '2026-07-01',
        endDate: '2026-07-31',
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
        // Partner paid rent of 25,000 and DG paid trainer salary of 20,000
        operatingExpenses: 45000,
        deductibleExpenses: 45000,
      }),
    });
    const calcGrossWithDirectData = (await calcGrossWithDirectRes.json()) as any;
    assert(Number(calcGrossWithDirectData.data?.summary?.grossCollection) === 40000, 'July gross collections is ₹40,000');
    // Under GROSS_COURSE_FEES, direct payer expenses MUST NOT be deducted
    assert(Number(calcGrossWithDirectData.data?.summary?.distributableAmount) === 40000, 'DIRECT PAYER RULE: Direct rent/salary expenses are NOT deducted from gross collections under GROSS_COURSE_FEES');
    assert(calcGrossWithDirectData.data?.summary?.directPayerExpensesIgnored === true, 'Calculation summary explicitly states directPayerExpensesIgnored: true');
    // v2 is 50:50 -> 50% of 40,000 = 20,000
    assert(Number(calcGrossWithDirectData.data?.summary?.royaltyPayable) === 20000, 'DG 50% royalty under v2 is exactly ₹20,000');

    // -------------------------------------------------------------
    // REQUIREMENT 4: VERIFY THREE OPERATIONAL POLICIES NON-MANDATORY
    // -------------------------------------------------------------
    console.log('\n--- Section 4: Operational Policies Verification (Non-Mandatory) ---');
    // 1. Expense receipts are NOT mandatory: calculation executes without receipt attachment
    assert(calcGrossWithDirectRes.status === 200, 'Expense receipt upload is NOT a mandatory blocking gate');
    // 2. Direct payer payment acknowledgement is NOT mandatory: calculations execute without blocker
    assert(retryRes.status === 200, 'Direct payer payment acknowledgement is NOT a mandatory blocking gate');
    // 3. Late remittance grace periods / overdue notifications do not block platform operations
    const ownerPortalRes = await fetch(`${BASE_URL}/api/franchises/dashboard/owner`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const ownerPortalData = (await ownerPortalRes.json()) as any;
    assert(ownerPortalRes.status === 200, 'Franchisee Admin accesses dashboard cleanly without punitive blocks');
    assert(Array.isArray(ownerPortalData.data?.royaltyRecords), 'Franchisee Admin sees monthly royalty statements');

  } catch (err) {
    console.error('Unexpected compliance review test error:', err);
    failed++;
  } finally {
    await stopServer();
    await prisma.$disconnect();
  }

  console.log('\n======================================================================');
  console.log(`FINAL COMPLIANCE REVIEW RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runReviewTests();

