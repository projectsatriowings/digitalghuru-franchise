import '../src/dns-preload.cjs';
import app from '../src/index.js';
import http from 'http';
import { prisma } from '../src/prisma.js';

let server: http.Server;
const TEST_PORT = 5096;
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
      console.log(`[Client Alignment Test Server] Listening on ${BASE_URL}`);
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('[Client Alignment Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function runTests() {
  console.log('\n======================================================================');
  console.log('DIGITAL GURU FRANCHISE – CLIENT REQUIREMENT ALIGNMENT TEST SUITE');
  console.log('Validating Models A, B, C, D, Direct Payer Rules, Profit Floor & Statements');
  console.log('======================================================================\n');

  await startServer();

  let superAdminToken = '';
  let franchiseId = '';
  let ownerToken = '';
  let branchId = '';

  try {
    // -------------------------------------------------------------
    // SETUP: Super Admin Authentication & Test Center
    // -------------------------------------------------------------
    console.log('--- Step 0: Super Admin Authentication & Test Franchise Setup ---');
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
      name: `DG Alignment Center ${uniqueSuffix}`,
      ownerName: `Ramesh Kumar ${uniqueSuffix}`,
      email: `ramesh.align${uniqueSuffix}@example.com`,
      phone: `98765${uniqueSuffix.slice(-5)}`,
      password: 'FranchiseOwnerPass#2026',
      city: 'Coimbatore',
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
    assert(createFrRes.status === 201 && !!createFrData.data?.franchise?.id, 'Test franchise created successfully');
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
        name: `Coimbatore Main Campus ${uniqueSuffix}`,
        code: `CBE-${uniqueSuffix}`,
        city: 'Coimbatore',
        state: 'Tamil Nadu',
      }),
    });
    const bData = (await bRes.json()) as any;
    assert(bRes.status === 201 && !!bData.data?.branch?.id, 'Franchise branch created successfully');
    branchId = bData.data?.branch?.id;

    // -------------------------------------------------------------
    // PHASE 2 & 3: TEMPLATES API & MODEL VERIFICATION
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Dynamic Agreement Templates Verification ---');
    const tmplRes = await fetch(`${BASE_URL}/api/franchises/agreement-templates`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const tmplData = (await tmplRes.json()) as any;
    assert(tmplRes.status === 200, 'GET /api/franchises/agreement-templates returns HTTP 200');
    assert(Array.isArray(tmplData.data?.templates) && tmplData.data.templates.length === 4, 'Returns exactly 4 business models');

    const modelA = tmplData.data.templates.find((t: any) => t.type === 'NEW_CENTRE_JOINT_INVESTMENT' || t.id === 'NEW_CENTRE_JOINT_INVESTMENT');
    const modelB = tmplData.data.templates.find((t: any) => t.type === 'EXISTING_CENTRE' || t.id === 'EXISTING_CENTRE' || t.id === 'EXISTING_CENTRE_CONVERSION');
    const modelC = tmplData.data.templates.find((t: any) => t.type === 'BRAND_AND_COURSE_SUPPORT' || t.id === 'BRAND_AND_COURSE_SUPPORT');
    const modelD = tmplData.data.templates.find((t: any) => t.type === 'CUSTOM_AGREEMENT' || t.id === 'CUSTOM_AGREEMENT');

    assert(!!modelA && !!modelB && !!modelC && !!modelD, 'Models A, B, C, D all found in API templates');

    // Model A Verification
    console.log('\n--- Step 2: Model A – New Centre Joint Investment ---');
    assert(modelA.defaults.totalInvestment === 200000, 'Model A default total investment is ₹2,00,000 (illustrative)');
    assert(modelA.defaults.digitalGuruInvestmentPercentage === 50, 'Model A DG investment default is 50%');
    assert(modelA.defaults.partnerInvestmentPercentage === 50, 'Model A Partner investment default is 50%');
    assert(modelA.defaults.settlementFrequency === 'MONTHLY', 'Model A default settlement is MONTHLY');
    const modelATrainerPayer = modelA.defaults.expenseResponsibilities?.trainerSalaries?.payer || modelA.defaults.expenseResponsibilities?.trainerSalaries;
    assert(modelATrainerPayer === 'DIGITAL_GURU', 'Model A: DG pays trainers directly');
    const modelARentPayer = modelA.defaults.expenseResponsibilities?.rent?.payer || modelA.defaults.expenseResponsibilities?.rent;
    assert(modelARentPayer === 'PARTNER', 'Model A: Partner pays rent directly');
    assert(modelA.defaults.marketingSupportDurationMonths === 3, 'Model A: DG provides 3-month marketing support');

    const modelAPayload = {
      agreementType: 'NEW_CENTRE_JOINT_INVESTMENT',
      title: 'Model A New Centre Joint Master Agreement',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      settlementFrequency: 'MONTHLY',
      revenueCalculationBasis: 'GROSS_COURSE_FEES',
      digitalGuruRevenuePercentage: 50.0,
      partnerRevenuePercentage: 50.0,
      totalInvestment: 200000,
      digitalGuruInvestmentAmount: 100000,
      partnerInvestmentAmount: 100000,
      digitalGuruInvestmentPercentage: 50.0,
      partnerInvestmentPercentage: 50.0,
      expenseResponsibilities: {
        trainerSalaries: 'DIGITAL_GURU',
        rent: 'PARTNER',
        staffSalaries: 'PARTNER',
        marketing: 'DIGITAL_GURU',
        operationalSetup: 'SHARED',
      },
      marketingResponsibleParty: 'DIGITAL_GURU',
      marketingSupportDurationMonths: 3,
      marketingPostSupportParty: 'PARTNER',
      courseSoftwareAccessEnabled: true,
      terms: 'Model A terms',
    };

    const createModelARes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(modelAPayload),
    });
    const createModelAData = (await createModelARes.json()) as any;
    assert(createModelARes.status === 201, 'Model A agreement created successfully with HTTP 201');
    assert(createModelAData.data?.installments?.length === 0, 'Model A with MONTHLY settlement creates 0 annual installments');
    assert(createModelAData.data?.agreement?.settlementFrequency === 'MONTHLY', 'Model A settlement frequency saved as MONTHLY');

    // Model B Verification (Existing Centre Conversion)
    console.log('\n--- Step 3: Model B – Existing Centre Conversion (45:55 and 55:45 Splits) ---');
    assert(modelB.defaults.totalInvestment === 0, 'Model B default total investment is ₹0 (No initial partner capital)');
    const modelBTrainerPayer = modelB.defaults.expenseResponsibilities?.trainerSalaries?.payer || modelB.defaults.expenseResponsibilities?.trainerSalaries;
    assert(modelBTrainerPayer === 'DIGITAL_GURU', 'Model B: DG pays trainers directly');
    const modelBRentPayer = modelB.defaults.expenseResponsibilities?.rent?.payer || modelB.defaults.expenseResponsibilities?.rent;
    assert(modelBRentPayer === 'PARTNER', 'Model B: Partner pays rent directly');
    assert(modelB.description?.includes('45:55') || modelB.options?.revenueSplitPresets?.includes('45:55'), 'Model B references 45:55 / 55:45 revenue split options');

    const modelB4555Payload = {
      agreementType: 'EXISTING_CENTRE',
      title: 'Model B Existing Centre Conversion Agreement (45:55)',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      settlementFrequency: 'MONTHLY',
      revenueCalculationBasis: 'GROSS_COURSE_FEES',
      digitalGuruRevenuePercentage: 45.0,
      partnerRevenuePercentage: 55.0,
      totalInvestment: 0,
      digitalGuruInvestmentAmount: 0,
      partnerInvestmentAmount: 0,
      digitalGuruInvestmentPercentage: 0,
      partnerInvestmentPercentage: 0,
      expenseResponsibilities: {
        trainerSalaries: 'DIGITAL_GURU',
        rent: 'PARTNER',
        staffSalaries: 'PARTNER',
        marketing: 'DIGITAL_GURU',
      },
      marketingResponsibleParty: 'DIGITAL_GURU',
      marketingSupportDurationMonths: 3,
      marketingPostSupportParty: 'PARTNER',
      courseSoftwareAccessEnabled: true,
      terms: 'Model B 45:55 terms',
    };

    const createModelBRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(modelB4555Payload),
    });
    const createModelBData = (await createModelBRes.json()) as any;
    assert(createModelBRes.status === 201, 'Model B (45:55) agreement created successfully with HTTP 201');
    assert(Number(createModelBData.data?.agreement?.digitalGuruRevenuePercentage) === 45, 'DG revenue percentage is 45%');
    assert(Number(createModelBData.data?.agreement?.partnerRevenuePercentage) === 55, 'Partner revenue percentage is 55%');

    // Model C Verification (Brand & Course Support)
    console.log('\n--- Step 4: Model C – Brand & Course Support (Fixed Annual & 2 Installments) ---');
    assert(modelC.defaults.settlementFrequency === 'YEARLY', 'Model C default settlement is YEARLY');
    assert(modelC.defaults.annualRoyaltyAmount === 200000, 'Model C default fixed fee is ₹2,00,000/year');
    assert(modelC.defaults.courseSoftwareAccessEnabled === true, 'Model C includes Course Software access');

    const modelCPayload = {
      agreementType: 'BRAND_AND_COURSE_SUPPORT',
      title: 'Model C Brand & Course Support Agreement',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      calculationMethod: 'FIXED_ANNUAL',
      annualRoyaltyAmount: 200000,
      settlementFrequency: 'YEARLY',
      revenueCalculationBasis: 'GROSS_COURSE_FEES',
      digitalGuruRevenuePercentage: 0,
      partnerRevenuePercentage: 100,
      totalInvestment: 0,
      courseSoftwareAccessEnabled: true,
      terms: 'Model C fixed terms',
    };

    const createModelCRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(modelCPayload),
    });
    const createModelCData = (await createModelCRes.json()) as any;
    assert(createModelCRes.status === 201, 'Model C agreement created successfully with HTTP 201');
    assert(createModelCData.data?.installments?.length === 2, 'Model C with YEARLY settlement creates exactly 2 H1/H2 installments');
    assert(Number(createModelCData.data?.installments[0]?.amount) === 100000, 'Installment 1 is ₹1,00,000 (H1)');
    assert(Number(createModelCData.data?.installments[1]?.amount) === 100000, 'Installment 2 is ₹1,00,000 (H2)');

    // Model D Verification (Custom Agreement)
    console.log('\n--- Step 5: Model D – Custom Agreement (Non-Standard Split & Profit-After-Expenses) ---');
    const modelDPayload = {
      agreementType: 'CUSTOM_AGREEMENT',
      title: 'Model D Custom Independent Agreement',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      settlementFrequency: 'MONTHLY',
      revenueCalculationBasis: 'PROFIT_AFTER_EXPENSES',
      digitalGuruRevenuePercentage: 37.5,
      partnerRevenuePercentage: 62.5,
      totalInvestment: 150000,
      digitalGuruInvestmentAmount: 50000,
      partnerInvestmentAmount: 100000,
      digitalGuruInvestmentPercentage: 33.33,
      partnerInvestmentPercentage: 66.67,
      expenseResponsibilities: {
        trainerSalaries: 'DIGITAL_GURU',
        rent: 'PARTNER',
        utilities: 'PARTNER',
        marketing: 'SHARED',
      },
      courseSoftwareAccessEnabled: true,
      terms: 'Model D custom terms',
    };

    const createModelDRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(modelDPayload),
    });
    const createModelDData = (await createModelDRes.json()) as any;
    assert(createModelDRes.status === 201, 'Model D agreement created successfully with HTTP 201');
    assert(Number(createModelDData.data?.agreement?.digitalGuruRevenuePercentage) === 37.5, 'Model D DG percentage is 37.5%');
    assert(Number(createModelDData.data?.agreement?.partnerRevenuePercentage) === 62.5, 'Model D Partner percentage is 62.5%');
    assert(createModelDData.data?.agreement?.revenueCalculationBasis === 'PROFIT_AFTER_EXPENSES', 'Model D basis is PROFIT_AFTER_EXPENSES');

    // -------------------------------------------------------------
    // FINANCIAL CALCULATIONS: DIRECT PAYER RULE & PROFIT DEDUCTIONS
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Direct Payer Non-Deduction Rule & Calculation Engine ---');

    // Seed student payment into branch
    const batch = await prisma.batch.findFirst() || await prisma.batch.create({
      data: {
        instituteId: branchId,
        name: `Batch Alignment ${uniqueSuffix}`,
        academicYear: '2026-2027',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      },
    });

    const feeStruct = await prisma.feeStructure.findFirst() || await prisma.feeStructure.create({
      data: {
        instituteId: branchId,
        batchId: batch.id,
        name: `Course Fee ${uniqueSuffix}`,
        amount: 100000,
        frequency: 'ONE_TIME',
      },
    });

    const student = await prisma.student.create({
      data: {
        instituteId: branchId,
        admissionNumber: `ADM-AL-${uniqueSuffix}`,
        firstName: 'Anand',
        lastName: `Aligner ${uniqueSuffix}`,
        status: 'ACTIVE',
      },
    });

    const feeAssignment = await prisma.studentFeeAssignment.create({
      data: {
        studentId: student.id,
        feeStructureId: feeStruct.id,
        baseAmount: 100000,
        finalAmount: 100000,
        dueDate: new Date('2026-12-31'),
        status: 'PAID',
      },
    });

    const superAdminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });

    await prisma.payment.create({
      data: {
        instituteId: branchId,
        studentId: student.id,
        feeAssignmentId: feeAssignment.id,
        receiptNumber: `REC-AL1-${uniqueSuffix}`,
        amountPaid: 100000,
        method: 'BANK_TRANSFER',
        status: 'SUCCESS',
        paidAt: new Date('2026-03-15T10:00:00.000Z'),
        recordedById: superAdminUser!.id,
      },
    });

    await prisma.payment.create({
      data: {
        instituteId: branchId,
        studentId: student.id,
        feeAssignmentId: feeAssignment.id,
        receiptNumber: `REC-AL2-${uniqueSuffix}`,
        amountPaid: 100000,
        method: 'BANK_TRANSFER',
        status: 'SUCCESS',
        paidAt: new Date('2026-04-15T10:00:00.000Z'),
        recordedById: superAdminUser!.id,
      },
    });

    await prisma.payment.create({
      data: {
        instituteId: branchId,
        studentId: student.id,
        feeAssignmentId: feeAssignment.id,
        receiptNumber: `REC-AL3-${uniqueSuffix}`,
        amountPaid: 100000,
        method: 'BANK_TRANSFER',
        status: 'SUCCESS',
        paidAt: new Date('2026-05-15T10:00:00.000Z'),
        recordedById: superAdminUser!.id,
      },
    });
    assert(true, 'Seeded actual student course fee payments of ₹1,00,000 for periods 2026-03, 2026-04, 2026-05');

    // 6a: Gross Course Fees Basis (Direct Payer expenses are IGNORED)
    const calcGrossRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-03',
        startDate: '2026-03-01',
        endDate: '2026-03-31',
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
        // Rent of 25,000 and trainer salary of 20,000 are direct partner/DG obligations
        operatingExpenses: 45000,
        deductibleExpenses: 45000,
      }),
    });
    const calcGrossData = (await calcGrossRes.json()) as any;
    assert(calcGrossRes.status === 200, 'Gross royalty calculation executed');
    const grossSumm = calcGrossData.data?.summary;
    assert(Number(grossSumm?.grossCollection) === 100000, 'Gross collections registered at ₹1,00,000');
    // Under GROSS_COURSE_FEES, distributable amount is entire ₹1,00,000 (direct expenses NOT deducted)
    assert(Number(grossSumm?.distributableAmount) === 100000, 'Direct payer expenses NOT deducted from Gross Course Fees');
    assert(Number(grossSumm?.royaltyPayable) === 37500, 'DG 37.5% share on ₹1,00,000 is ₹37,500');
    assert(Number(grossSumm?.partnerShare) === 62500, 'Partner 62.5% share on ₹1,00,000 is ₹62,500');

    // 6b: Profit After Expenses Basis (Explicit Deductible Expenses)
    console.log('\n--- Step 7: Profit After Expenses with Deductible Operating Expenses ---');
    const calcProfitRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-04',
        startDate: '2026-04-01',
        endDate: '2026-04-30',
        revenueCalculationBasis: 'PROFIT_AFTER_EXPENSES',
        deductibleExpenses: 30000, // ₹30,000 allowable operating deductions
      }),
    });
    const calcProfitData = (await calcProfitRes.json()) as any;
    assert(calcProfitRes.status === 200, 'Profit calculation executed');
    const profitSumm = calcProfitData.data?.summary;
    assert(Number(profitSumm?.deductibleExpenses) === 30000, 'Deductible expenses logged as ₹30,000');
    // Distributable pool = 100,000 - 30,000 = 70,000
    assert(Number(profitSumm?.distributableAmount) === 70000, 'Distributable profit pool is exactly ₹70,000 (₹100k - ₹30k)');
    // DG 37.5% of 70,000 = 26,250
    assert(Number(profitSumm?.royaltyPayable) === 26250, 'DG 37.5% profit share is ₹26,250');
    // Partner 62.5% of 70,000 = 43,750
    assert(Number(profitSumm?.partnerShare) === 43750, 'Partner 62.5% profit share is ₹43,750');

    // 6c: Zero-Profit Floor Assertion
    console.log('\n--- Step 8: Strict Zero-Profit Floor on Loss ---');
    const calcLossRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        periodLabel: '2026-05',
        startDate: '2026-05-01',
        endDate: '2026-05-31',
        revenueCalculationBasis: 'PROFIT_AFTER_EXPENSES',
        deductibleExpenses: 150000, // Expenses ₹1,50,000 exceed collections ₹1,00,000 -> Loss of ₹50,000
      }),
    });
    const calcLossData = (await calcLossRes.json()) as any;
    assert(calcLossRes.status === 200, 'Loss calculation handled gracefully with HTTP 200');
    const lossSumm = calcLossData.data?.summary;
    assert(Number(lossSumm?.distributableAmount) === 0, 'Distributable pool floored at ₹0 (never negative)');
    assert(Number(lossSumm?.royaltyPayable) === 0, 'Digital Guru royalty floored at ₹0');
    assert(Number(lossSumm?.partnerShare) === 0, 'Partner retained share floored at ₹0');

    // -------------------------------------------------------------
    // SUPER ADMIN & FRANCHISEE DASHBOARD STATEMENTS
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Monthly Statements Listing & Franchisee Admin Dashboard ---');

    // Super Admin lists all statements
    const allStatementsRes = await fetch(`${BASE_URL}/api/franchises/all/royalties`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const allStatementsData = (await allStatementsRes.json()) as any;
    assert(allStatementsRes.status === 200, 'Super Admin lists monthly statements via /franchises/all/royalties');
    const stmtList = allStatementsData.data?.royaltyRecords || allStatementsData.data?.records || [];
    assert(Array.isArray(stmtList), 'Returns royaltyRecords array');
    const franchiseRecords = stmtList.filter((r: any) => r.franchiseId === franchiseId);
    assert(franchiseRecords.length >= 3, `Found ${franchiseRecords.length} statements recorded for test franchise`);

    // Franchisee Admin portal retrieves own statements
    const ownerDashRes = await fetch(`${BASE_URL}/api/franchises/dashboard/owner`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const ownerDashData = (await ownerDashRes.json()) as any;
    assert(ownerDashRes.status === 200, 'Franchisee Admin loads portal dashboard via /dashboard/owner');
    assert(Array.isArray(ownerDashData.data?.royaltyRecords), 'Owner dashboard payload includes royaltyRecords array');
    assert(ownerDashData.data.royaltyRecords.length >= 3, 'Owner dashboard displays monthly statements to Franchisee Admin');
    assert(ownerDashData.data?.activeAgreement?.agreementType === 'CUSTOM_AGREEMENT', 'Active agreement displayed accurately in Franchisee Admin portal');

    // Verify Audit Fields in recorded statement
    const recordedStmt = franchiseRecords[0];
    assert(!!recordedStmt.id, 'Royalty statement has unique ID');
    const calcBasisInRecord = recordedStmt.calculationDetails?.calculationBasis || recordedStmt.calculationBasis;
    assert(calcBasisInRecord === 'PROFIT_AFTER_EXPENSES' || calcBasisInRecord === 'GROSS_COURSE_FEES', 'Logged calculation basis matches agreement terms');
    assert(recordedStmt.status === 'PENDING' || recordedStmt.status === 'DUE' || recordedStmt.status === 'OVERDUE', 'Generated monthly statement has valid status PENDING/DUE/OVERDUE');

    console.log('\n--- Step 10: Percentage Total Validation Integrity ---');
    const invalidSplitRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        agreementType: 'NEW_CENTRE_JOINT_INVESTMENT',
        title: 'Invalid Split Agreement',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        digitalGuruRevenuePercentage: 60.0,
        partnerRevenuePercentage: 50.0, // Sum = 110%
      }),
    });
    assert(invalidSplitRes.status === 400, 'API strictly blocks agreement with split totaling 110%');

  } catch (err) {
    console.error('Unexpected test error:', err);
    failed++;
  } finally {
    await stopServer();
    await prisma.$disconnect();
  }

  console.log('\n======================================================================');
  console.log(`CLIENT REQUIREMENT ALIGNMENT RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

