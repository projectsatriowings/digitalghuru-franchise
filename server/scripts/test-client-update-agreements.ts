import '../src/dns-preload.cjs';
import app from '../src/index.js';
import http from 'http';
import { prisma } from '../src/prisma.js';

let server: http.Server;
const TEST_PORT = 5095;
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
      console.log(`[Client Update Agreements Test Server] Listening on ${BASE_URL}`);
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('[Client Update Agreements Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function runTests() {
  console.log('\n============================================================');
  console.log('DIGITAL GURU FRANCHISE – CLIENT UPDATE REQUIREMENTS TEST SUITE');
  console.log('Testing 18 Mandatory Scenarios');
  console.log('============================================================\n');

  await startServer();

  let superAdminToken = '';
  let franchiseId = '';
  let franchiseOwnerToken = '';
  let branch1Id = '';
  let branch2Id = '';
  let newCentreAgreementId = '';
  let existingCentre4555AgreementId = '';
  let existingCentre5545AgreementId = '';
  let revisedAgreementId = '';

  try {
    // -------------------------------------------------------------
    // SETUP: Authenticate Super Admin & Retrieve Pre-Existing / Create Test Franchise
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
    const adminLoginData = await adminLoginRes.json();
    assert(adminLoginRes.status === 200 && !!adminLoginData.data?.accessToken, 'Super Admin authenticated successfully');
    superAdminToken = adminLoginData.data?.accessToken;

    // Create unique test franchise for client update tests
    const uniqueSuffix = Date.now().toString().slice(-6);
    const frRes = await fetch(`${BASE_URL}/api/franchises`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Digital Guru Client Test Center ${uniqueSuffix}`,
        ownerName: `Ramesh Kumar ${uniqueSuffix}`,
        email: `ramesh.client.${uniqueSuffix}@digitalguru.test`,
        phone: `+91 9777${uniqueSuffix}`,
        city: 'Chennai',
        state: 'Tamil Nadu',
        address: '100 Mount Road, Anna Salai',
        initialAgreement: {
          title: 'Initial Annual Agreement',
          startDate: '2026-04-01',
          endDate: '2027-03-31',
          calculationMethod: 'FIXED_ANNUAL',
          annualRoyaltyAmount: 200000,
        },
      }),
    });
    const frData = await frRes.json();
    assert(frRes.status === 201 && !!frData.data?.franchise?.id, 'Test Franchise center successfully created', frData);
    franchiseId = frData.data.franchise.id;

    // Log in as the Franchisee Admin
    const ownerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: `ramesh.client.${uniqueSuffix}@digitalguru.test`,
        password: frData.data.ownerCredentials?.temporaryPassword,
        role: 'FRANCHISE_OWNER',
      }),
    });
    const ownerLoginData = await ownerLoginRes.json();
    assert(ownerLoginRes.status === 200 && !!ownerLoginData.data?.accessToken, 'Franchisee Admin authenticated successfully');
    franchiseOwnerToken = ownerLoginData.data?.accessToken;

    // Add 2 branches to this franchise
    const b1Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        createNew: true,
        name: `DG Anna Nagar ${uniqueSuffix}`,
        code: `BR-AN-${uniqueSuffix}`,
        city: 'Chennai',
      }),
    });
    const b1Data = await b1Res.json();
    branch1Id = b1Data.data?.branch?.id;
    assert(b1Res.status === 201 && !!branch1Id, 'Assigned branch 1 created');

    const b2Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        createNew: true,
        name: `DG Velachery ${uniqueSuffix}`,
        code: `BR-VEL-${uniqueSuffix}`,
        city: 'Chennai',
      }),
    });
    const b2Data = await b2Res.json();
    branch2Id = b2Data.data?.branch?.id;
    assert(b2Res.status === 201 && !!branch2Id, 'Assigned branch 2 created');

    // -------------------------------------------------------------
    // SCENARIO 0: Agreement Templates Endpoint
    // -------------------------------------------------------------
    console.log('\n--- Scenario 0: Retrieve Configurable Agreement Model Templates ---');
    const tmplRes = await fetch(`${BASE_URL}/api/franchises/agreement-templates`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const tmplData = await tmplRes.json();
    assert(tmplRes.status === 200 && tmplData.data?.templates?.length === 4, 'Templates endpoint returns 4 presets', tmplData);
    const tmplTypes = tmplData.data?.templates?.map((t: any) => t.type);
    assert(
      tmplTypes.includes('NEW_CENTRE_JOINT_INVESTMENT') &&
      tmplTypes.includes('EXISTING_CENTRE') &&
      tmplTypes.includes('BRAND_AND_COURSE_SUPPORT') &&
      tmplTypes.includes('CUSTOM_AGREEMENT'),
      'All 4 business model templates present (NEW_CENTRE, EXISTING_CENTRE, BRAND_AND_COURSE, CUSTOM)'
    );

    // -------------------------------------------------------------
    // SCENARIO 1: New Centre with 50:50 Investment
    // -------------------------------------------------------------
    console.log('\n--- Scenario 1: New Centre with 50:50 Investment ---');
    const sc1Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'New Centre Joint Investment Master Agreement (2026-2027)',
        startDate: '2026-05-01',
        endDate: '2027-04-30',
        agreementType: 'NEW_CENTRE_JOINT_INVESTMENT',
        calculationMethod: 'PERCENTAGE_REVENUE',
        totalInvestment: 1200000,
        digitalGuruInvestmentAmount: 600000,
        partnerInvestmentAmount: 600000,
        digitalGuruInvestmentPercentage: 50.0,
        partnerInvestmentPercentage: 50.0,
        operationalSetupContribution: 100000,
        investmentNotes: 'Equal capital contribution for premise setup and equipment',
        digitalGuruRevenuePercentage: 50.0,
        partnerRevenuePercentage: 50.0,
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
        settlementFrequency: 'MONTHLY',
        courseSoftwareAccessEnabled: true,
      }),
    });
    const sc1Data = await sc1Res.json();
    assert(sc1Res.status === 201, 'Scenario 1 agreement created with HTTP 201', sc1Data);
    newCentreAgreementId = sc1Data.data?.agreement?.id;
    assert(
      Number(sc1Data.data?.agreement?.totalInvestment) === 1200000 &&
      Number(sc1Data.data?.agreement?.digitalGuruInvestmentAmount) === 600000 &&
      Number(sc1Data.data?.agreement?.partnerInvestmentAmount) === 600000 &&
      Number(sc1Data.data?.agreement?.digitalGuruInvestmentPercentage) === 50 &&
      Number(sc1Data.data?.agreement?.partnerInvestmentPercentage) === 50,
      'Scenario 1: 50:50 investment amounts and percentages stored accurately'
    );

    // -------------------------------------------------------------
    // SCENARIO 2: Existing Centre with 45:55 Revenue Sharing
    // -------------------------------------------------------------
    console.log('\n--- Scenario 2: Existing Centre with 45:55 Revenue Sharing ---');
    const sc2Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Existing Centre Conversion Agreement (45:55 Split)',
        startDate: '2026-06-01',
        endDate: '2027-05-31',
        agreementType: 'EXISTING_CENTRE',
        calculationMethod: 'PERCENTAGE_REVENUE',
        digitalGuruRevenuePercentage: 45.0,
        partnerRevenuePercentage: 55.0,
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
        settlementFrequency: 'MONTHLY',
      }),
    });
    const sc2Data = await sc2Res.json();
    assert(sc2Res.status === 201, 'Scenario 2 agreement created successfully', sc2Data);
    existingCentre4555AgreementId = sc2Data.data?.agreement?.id;
    assert(
      Number(sc2Data.data?.agreement?.digitalGuruRevenuePercentage) === 45 &&
      Number(sc2Data.data?.agreement?.partnerRevenuePercentage) === 55,
      'Scenario 2: 45:55 revenue split (DG: 45%, Partner: 55%) stored accurately'
    );

    // -------------------------------------------------------------
    // SCENARIO 3: Existing Centre with 55:45 Revenue Sharing
    // -------------------------------------------------------------
    console.log('\n--- Scenario 3: Existing Centre with 55:45 Revenue Sharing ---');
    const sc3Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Existing Centre Conversion Agreement (55:45 Split)',
        startDate: '2026-07-01',
        endDate: '2027-06-30',
        agreementType: 'EXISTING_CENTRE',
        calculationMethod: 'PERCENTAGE_REVENUE',
        digitalGuruRevenuePercentage: 55.0,
        partnerRevenuePercentage: 45.0,
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
        settlementFrequency: 'MONTHLY',
      }),
    });
    const sc3Data = await sc3Res.json();
    assert(sc3Res.status === 201, 'Scenario 3 agreement created successfully', sc3Data);
    existingCentre5545AgreementId = sc3Data.data?.agreement?.id;
    assert(
      Number(sc3Data.data?.agreement?.digitalGuruRevenuePercentage) === 55 &&
      Number(sc3Data.data?.agreement?.partnerRevenuePercentage) === 45,
      'Scenario 3: 55:45 revenue split (DG: 55%, Partner: 45%) stored accurately'
    );

    // -------------------------------------------------------------
    // SCENARIO 4: Custom Percentage Configuration
    // -------------------------------------------------------------
    console.log('\n--- Scenario 4: Custom Percentage Configuration ---');
    const sc4Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Custom Revenue Agreement (37.5 : 62.5)',
        startDate: '2026-08-01',
        endDate: '2027-07-31',
        agreementType: 'CUSTOM_AGREEMENT',
        calculationMethod: 'PERCENTAGE_REVENUE',
        digitalGuruRevenuePercentage: 37.5,
        partnerRevenuePercentage: 62.5,
        revenueCalculationBasis: 'NET_COURSE_REVENUE',
        settlementFrequency: 'MONTHLY',
      }),
    });
    const sc4Data = await sc4Res.json();
    assert(sc4Res.status === 201, 'Scenario 4 custom percentages created successfully', sc4Data);
    assert(
      Number(sc4Data.data?.agreement?.digitalGuruRevenuePercentage) === 37.5 &&
      Number(sc4Data.data?.agreement?.partnerRevenuePercentage) === 62.5,
      'Scenario 4: Custom non-standard split (37.5% : 62.5%) supported and preserved'
    );

    // -------------------------------------------------------------
    // SCENARIO 5: Percentage Total Validation (Negative Test)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 5: Percentage Total Validation (Must Total 100%) ---');
    const sc5Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Invalid Split Agreement (50 + 60 = 110)',
        startDate: '2026-08-01',
        endDate: '2027-07-31',
        calculationMethod: 'PERCENTAGE_REVENUE',
        digitalGuruRevenuePercentage: 50.0,
        partnerRevenuePercentage: 60.0,
      }),
    });
    const sc5Data = await sc5Res.json();
    assert(sc5Res.status === 400, 'Scenario 5: Rejects revenue split totaling 110% with HTTP 400', sc5Data);
    assert(sc5Data.error?.includes('must total 100%'), 'Scenario 5: Explicit validation error message returned');

    // -------------------------------------------------------------
    // SCENARIO 6: Digital Guru-Only Trainer Responsibility
    // -------------------------------------------------------------
    console.log('\n--- Scenario 6: Digital Guru-Only Trainer Responsibility ---');
    const sc6Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Agreement with DG-Only Trainers',
        startDate: '2026-09-01',
        endDate: '2027-08-31',
        calculationMethod: 'PERCENTAGE_REVENUE',
        digitalGuruRevenuePercentage: 50.0,
        partnerRevenuePercentage: 50.0,
        expenseResponsibilities: {
          trainerSalaries: {
            payer: 'DIGITAL_GURU',
            notes: 'Digital Guru supplies trainers and bears trainer costs in this arrangement',
          },
        },
      }),
    });
    const sc6Data = await sc6Res.json();
    assert(sc6Res.status === 201, 'Scenario 6 agreement created', sc6Data);
    assert(
      sc6Data.data?.agreement?.expenseResponsibilities?.trainerSalaries?.payer === 'DIGITAL_GURU',
      'Scenario 6: Trainer cost responsibility stored explicitly as DIGITAL_GURU'
    );

    // -------------------------------------------------------------
    // SCENARIO 7: Partner-Only Rent Responsibility
    // -------------------------------------------------------------
    console.log('\n--- Scenario 7: Partner-Only Rent Responsibility ---');
    const sc7Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Agreement with Partner-Only Rent',
        startDate: '2026-09-01',
        endDate: '2027-08-31',
        calculationMethod: 'PERCENTAGE_REVENUE',
        digitalGuruRevenuePercentage: 50.0,
        partnerRevenuePercentage: 50.0,
        expenseResponsibilities: {
          rent: {
            payer: 'PARTNER',
            notes: 'Partner is sole responsible party for facility lease and property rent',
          },
        },
      }),
    });
    const sc7Data = await sc7Res.json();
    assert(sc7Res.status === 201, 'Scenario 7 agreement created', sc7Data);
    assert(
      sc7Data.data?.agreement?.expenseResponsibilities?.rent?.payer === 'PARTNER',
      'Scenario 7: Rent responsibility stored explicitly as PARTNER'
    );

    // -------------------------------------------------------------
    // SCENARIO 8: Shared Operational Setup Expenses
    // -------------------------------------------------------------
    console.log('\n--- Scenario 8: Shared Operational Setup Expenses ---');
    const sc8Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Agreement with Shared Setup Contribution',
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        calculationMethod: 'PERCENTAGE_REVENUE',
        digitalGuruRevenuePercentage: 50.0,
        partnerRevenuePercentage: 50.0,
        expenseResponsibilities: {
          operationalSetup: {
            payer: 'SHARED',
            sharedDgPercentage: 50,
            sharedPartnerPercentage: 50,
            agreedSetupAmount: 200000,
            notes: '50% contributed by DG, 50% contributed by partner',
          },
        },
      }),
    });
    const sc8Data = await sc8Res.json();
    assert(sc8Res.status === 201, 'Scenario 8 agreement created', sc8Data);
    assert(
      sc8Data.data?.agreement?.expenseResponsibilities?.operationalSetup?.payer === 'SHARED' &&
      sc8Data.data?.agreement?.expenseResponsibilities?.operationalSetup?.sharedDgPercentage === 50,
      'Scenario 8: Shared operational setup expenses configured and stored'
    );

    // -------------------------------------------------------------
    // SCENARIO 9: Three-Month Digital Guru Marketing Support
    // -------------------------------------------------------------
    console.log('\n--- Scenario 9: 3-Month Digital Guru Marketing Support ---');
    const sc9Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Agreement with 3-Month DG Marketing Support',
        startDate: '2026-11-01',
        endDate: '2027-10-31',
        calculationMethod: 'PERCENTAGE_REVENUE',
        digitalGuruRevenuePercentage: 50.0,
        partnerRevenuePercentage: 50.0,
        marketingResponsibleParty: 'DIGITAL_GURU',
        marketingSupportDurationMonths: 3,
        marketingBudget: 75000,
        marketingNotes: 'Digital Guru funds launch marketing campaigns during initial 3 months',
      }),
    });
    const sc9Data = await sc9Res.json();
    assert(sc9Res.status === 201, 'Scenario 9 agreement created', sc9Data);
    assert(
      sc9Data.data?.agreement?.marketingResponsibleParty === 'DIGITAL_GURU' &&
      sc9Data.data?.agreement?.marketingSupportDurationMonths === 3 &&
      Number(sc9Data.data?.agreement?.marketingBudget) === 75000,
      'Scenario 9: 3-month Digital Guru marketing support configured with budget ₹75,000'
    );

    // -------------------------------------------------------------
    // SCENARIO 10: Partner Marketing Responsibility After Three Months
    // -------------------------------------------------------------
    console.log('\n--- Scenario 10: Partner Marketing Responsibility After 3 Months ---');
    const sc10Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Agreement with Handover to Partner Marketing',
        startDate: '2026-11-01',
        endDate: '2027-10-31',
        calculationMethod: 'PERCENTAGE_REVENUE',
        digitalGuruRevenuePercentage: 50.0,
        partnerRevenuePercentage: 50.0,
        marketingResponsibleParty: 'DIGITAL_GURU',
        marketingSupportDurationMonths: 3,
        marketingPostSupportParty: 'PARTNER',
        marketingNotes: 'After month 3, partner assumes full ongoing marketing responsibilities',
      }),
    });
    const sc10Data = await sc10Res.json();
    assert(sc10Res.status === 201, 'Scenario 10 agreement created', sc10Data);
    assert(
      sc10Data.data?.agreement?.marketingPostSupportParty === 'PARTNER',
      'Scenario 10: Partner post-support marketing responsibility stored explicitly as PARTNER'
    );

    // -------------------------------------------------------------
    // SCENARIO 11: Monthly Settlement Configuration & Display
    // -------------------------------------------------------------
    console.log('\n--- Scenario 11: Monthly Settlement ---');
    const sc11Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Monthly Settlement Franchise Contract',
        startDate: '2026-11-01',
        endDate: '2027-10-31',
        calculationMethod: 'PERCENTAGE_REVENUE',
        digitalGuruRevenuePercentage: 50.0,
        partnerRevenuePercentage: 50.0,
        settlementFrequency: 'MONTHLY',
      }),
    });
    const sc11Data = await sc11Res.json();
    assert(sc11Res.status === 201, 'Scenario 11 agreement created', sc11Data);
    assert(
      sc11Data.data?.agreement?.settlementFrequency === 'MONTHLY',
      'Scenario 11: Settlement frequency stored explicitly as MONTHLY'
    );
    assert(
      sc11Data.data?.installments?.length === 0,
      'Scenario 11: Monthly settlement does not generate annual H1/H2 installments'
    );

    // -------------------------------------------------------------
    // SCENARIO 12: Yearly Settlement Configuration
    // -------------------------------------------------------------
    console.log('\n--- Scenario 12: Yearly Settlement ---');
    const sc12Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Yearly Settlement Franchise Contract',
        startDate: '2026-11-01',
        endDate: '2027-10-31',
        calculationMethod: 'FIXED_ANNUAL',
        annualRoyaltyAmount: 240000,
        settlementFrequency: 'YEARLY',
      }),
    });
    const sc12Data = await sc12Res.json();
    assert(sc12Res.status === 201, 'Scenario 12 agreement created', sc12Data);
    assert(
      sc12Data.data?.agreement?.settlementFrequency === 'YEARLY' &&
      sc12Data.data?.installments?.length === 2,
      'Scenario 12: Settlement frequency stored as YEARLY and generates 2 installments'
    );

    // -------------------------------------------------------------
    // SCENARIO 13: Gross Revenue vs Net Revenue vs Profit Calculation
    // -------------------------------------------------------------
    console.log('\n--- Scenario 13: Gross Revenue vs Net Revenue vs Profit Calculation ---');
    // Seed test payment of ₹100,000 in branch1 for November 2026
    const existingFeeAssignment = await prisma.studentFeeAssignment.findFirst({
      include: { student: true },
    });

    let targetStudentId = existingFeeAssignment?.studentId;
    let targetFeeAssignmentId = existingFeeAssignment?.id;

    if (!existingFeeAssignment) {
      const batch = await prisma.batch.findFirst();
      const feeStruct = await prisma.feeStructure.findFirst() || await prisma.feeStructure.create({
        data: {
          instituteId: branch1Id,
          batchId: batch?.id || (await prisma.batch.create({
            data: {
              instituteId: branch1Id,
              name: 'Batch 2026',
              academicYear: '2026-2027',
              startDate: new Date(),
              endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
            },
          })).id,
          name: 'Course Fee',
          amount: 100000,
          frequency: 'ONE_TIME',
        },
      });

      const newStudent = await prisma.student.create({
        data: {
          instituteId: branch1Id,
          admissionNumber: `ADM-SC13-${uniqueSuffix}`,
          firstName: 'Anand',
          lastName: 'Kumar',
          status: 'ACTIVE',
        },
      });
      targetStudentId = newStudent.id;

      const newFeeAssign = await prisma.studentFeeAssignment.create({
        data: {
          studentId: newStudent.id,
          feeStructureId: feeStruct.id,
          finalAmount: 100000,
          dueAmount: 0,
          paidAmount: 100000,
        },
      });
      targetFeeAssignmentId = newFeeAssign.id;
    }

    const superAdminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    const payment = await prisma.payment.create({
      data: {
        instituteId: branch1Id,
        studentId: targetStudentId!,
        feeAssignmentId: targetFeeAssignmentId!,
        receiptNumber: `REC-SC13-${uniqueSuffix}`,
        amountPaid: 100000,
        method: 'BANK_TRANSFER',
        status: 'SUCCESS',
        paidAt: new Date('2026-11-15T10:00:00.000Z'),
        recordedById: superAdminUser!.id,
      },
    });

    // 13a. Gross Revenue Calculation: 50% on ₹100,000 = ₹50,000
    const calcGrossRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        periodLabel: `2026-11-GROSS-${uniqueSuffix}`,
        revenueCalculationBasis: 'GROSS_COURSE_FEES',
      }),
    });
    const calcGrossData = await calcGrossRes.json();
    assert(calcGrossRes.status === 200, 'Scenario 13a: Gross revenue calculation executed', calcGrossData);
    assert(
      calcGrossData.data?.summary?.eligibleRevenue === 100000 &&
      calcGrossData.data?.summary?.royaltyPayable === 50000 &&
      calcGrossData.data?.summary?.franchiseOwnerShare === 50000,
      'Scenario 13a: Gross calculation correctly yields ₹50,000 DG and ₹50,000 Partner share'
    );

    // 13b. Net Revenue Calculation: ₹100,000 minus ₹10,000 deduction = ₹90,000 -> 50% = ₹45,000
    const calcNetRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        periodLabel: `2026-11-NET-${uniqueSuffix}`,
        revenueCalculationBasis: 'NET_COURSE_REVENUE',
        deductions: 10000,
      }),
    });
    const calcNetData = await calcNetRes.json();
    assert(calcNetRes.status === 200, 'Scenario 13b: Net revenue calculation executed', calcNetData);
    assert(
      calcNetData.data?.summary?.eligibleRevenue === 90000 &&
      calcNetData.data?.summary?.royaltyPayable === 45000 &&
      calcNetData.data?.summary?.franchiseOwnerShare === 45000,
      'Scenario 13b: Net calculation correctly deducts ₹10,000 yielding ₹45,000 each'
    );

    // 13c. Profit After Expenses: ₹100,000 minus ₹40,000 operating expenses = ₹60,000 profit -> 50% = ₹30,000
    const calcProfitRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        periodLabel: `2026-11-PROFIT-${uniqueSuffix}`,
        revenueCalculationBasis: 'PROFIT_AFTER_EXPENSES',
        operatingExpenses: 40000,
      }),
    });
    const calcProfitData = await calcProfitRes.json();
    assert(calcProfitRes.status === 200, 'Scenario 13c: Profit calculation executed', calcProfitData);
    assert(
      calcProfitData.data?.summary?.eligibleRevenue === 60000 &&
      calcProfitData.data?.summary?.royaltyPayable === 30000 &&
      calcProfitData.data?.summary?.franchiseOwnerShare === 30000,
      'Scenario 13c: Profit calculation deducts ₹40k expenses yielding ₹30,000 profit share each'
    );

    // -------------------------------------------------------------
    // SCENARIO 14: Course Software Access Enabled & Disabled
    // -------------------------------------------------------------
    console.log('\n--- Scenario 14: Course Software Access Enabled & Disabled ---');
    // Enabled
    const sc14aRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Agreement with Software Access Enabled',
        startDate: '2026-12-01',
        endDate: '2027-11-30',
        calculationMethod: 'FIXED_ANNUAL',
        annualRoyaltyAmount: 180000,
        courseSoftwareAccessEnabled: true,
        courseSoftwarePricingNotes: 'Full Digital Guru LMS suite enabled',
      }),
    });
    const sc14aData = await sc14aRes.json();
    assert(sc14aRes.status === 201 && sc14aData.data?.agreement?.courseSoftwareAccessEnabled === true, 'Scenario 14a: Course software access ENABLED');

    // Disabled
    const sc14bRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Agreement with Software Access Disabled',
        startDate: '2026-12-01',
        endDate: '2027-11-30',
        calculationMethod: 'FIXED_ANNUAL',
        annualRoyaltyAmount: 150000,
        courseSoftwareAccessEnabled: false,
        courseSoftwarePricingNotes: 'Self-hosted local system; DG course software disabled',
      }),
    });
    const sc14bData = await sc14bRes.json();
    assert(sc14bRes.status === 201 && sc14bData.data?.agreement?.courseSoftwareAccessEnabled === false, 'Scenario 14b: Course software access DISABLED');

    // -------------------------------------------------------------
    // SCENARIO 15: Agreement Revision & Historical Data Preservation
    // -------------------------------------------------------------
    console.log('\n--- Scenario 15: Agreement Revision & Historical Data Preservation ---');
    const sc15RevRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements/${newCentreAgreementId}/revise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        revisionReason: 'Mid-term adjustment: Revised partner revenue share to 55%',
        digitalGuruRevenuePercentage: 45.0,
        partnerRevenuePercentage: 55.0,
        notes: 'Changelog: Partner takes higher operational responsibility',
      }),
    });
    const sc15RevData = await sc15RevRes.json();
    assert(sc15RevRes.status === 201, 'Scenario 15: Agreement revision created with HTTP 201', sc15RevData);
    revisedAgreementId = sc15RevData.data?.agreement?.id;
    assert(sc15RevData.data?.version === 2, 'Scenario 15: Revised agreement has version = 2');
    assert(sc15RevData.data?.agreement?.parentAgreementId === newCentreAgreementId, 'Scenario 15: Linked via parentAgreementId');
    assert(sc15RevData.data?.installments?.length === 0, 'Scenario 15: Monthly agreement revision does not receive annual H1/H2 installments');

    // Verify historical agreement is marked EXPIRED and intact
    const originalAgr = await prisma.franchiseAgreement.findUnique({ where: { id: newCentreAgreementId } });
    assert(originalAgr?.status === 'EXPIRED', 'Scenario 15: Original agreement marked EXPIRED');
    assert(Number(originalAgr?.digitalGuruRevenuePercentage) === 50, 'Scenario 15: Original agreement historical 50% rate completely preserved');

    // -------------------------------------------------------------
    // SCENARIO 15b: Yearly Agreement Revision Generates H1/H2 Schedule
    // -------------------------------------------------------------
    console.log('\n--- Scenario 15b: Yearly Agreement Revision Schedule ---');
    const sc12AgreementId = sc12Data.data?.agreement?.id;
    const sc15bRevRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements/${sc12AgreementId}/revise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        revisionReason: 'Annual escalation and revised fixed royalty amount',
        annualRoyaltyAmount: 260000,
        settlementFrequency: 'YEARLY',
        notes: 'Changelog: Escalated from ₹240k to ₹260k',
      }),
    });
    const sc15bRevData = await sc15bRevRes.json();
    assert(sc15bRevRes.status === 201, 'Scenario 15b: Yearly agreement revised successfully', sc15bRevData);
    assert(sc15bRevData.data?.version === 2, 'Scenario 15b: Version incremented to 2');
    assert(sc15bRevData.data?.agreement?.parentAgreementId === sc12AgreementId, 'Scenario 15b: Linked to parent agreement');
    assert(
      Array.isArray(sc15bRevData.data?.installments) && sc15bRevData.data.installments.length === 2,
      'Scenario 15b: Yearly revised agreement generates fresh H1/H2 installments'
    );
    assert(
      Number(sc15bRevData.data.installments[0].amount) === 130000,
      'Scenario 15b: Revised installment 1 amount is ₹130,000 (50% of ₹260,000)'
    );

    // Verify previous agreement and installments are preserved
    const prevYearlyAgr = await prisma.franchiseAgreement.findUnique({ where: { id: sc12AgreementId } });
    assert(prevYearlyAgr?.status === 'EXPIRED', 'Scenario 15b: Previous yearly agreement marked EXPIRED');
    const prevYearlyInsts = await prisma.franchiseRoyaltyInstallment.findMany({ where: { agreementId: sc12AgreementId } });
    assert(prevYearlyInsts.length === 2, 'Scenario 15b: Previous yearly agreement installments preserved intact');

    // -------------------------------------------------------------
    // SCENARIO 16: Existing Annual Royalty Agreements Continue to Work
    // -------------------------------------------------------------
    console.log('\n--- Scenario 16: Existing Annual Royalty Agreements Functionality ---');
    const sc16Res = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'Legacy Compatible Annual Master Agreement (2027)',
        startDate: '2027-01-01',
        endDate: '2027-12-31',
        calculationMethod: 'FIXED_ANNUAL',
        annualRoyaltyAmount: 300000,
        dueDay: 15,
      }),
    });
    const sc16Data = await sc16Res.json();
    assert(sc16Res.status === 201, 'Scenario 16: Standard annual agreement created', sc16Data);
    assert(
      sc16Data.data?.installments?.length === 2 &&
      Number(sc16Data.data?.installments[0]?.amount) === 150000 &&
      Number(sc16Data.data?.installments[1]?.amount) === 150000,
      'Scenario 16: Exactly 2 installments generated at ₹150,000 each (H1 & H2)'
    );

    // -------------------------------------------------------------
    // SCENARIO 17: Multi-Branch Tenant Isolation Intact
    // -------------------------------------------------------------
    console.log('\n--- Scenario 17: Multi-Branch Tenant Isolation ---');
    // Querying branches with franchisee owner token
    const myBranchesRes = await fetch(`${BASE_URL}/api/franchises/my-branches`, {
      headers: { Authorization: `Bearer ${franchiseOwnerToken}` },
    });
    const myBranchesData = await myBranchesRes.json();
    assert(myBranchesRes.status === 200 && myBranchesData.data?.branches?.length === 2, 'Scenario 17: Franchisee Admin sees exactly their 2 assigned branches');

    // Attempting to access an unassigned branch (forbidden)
    const foreignBranchRes = await fetch(`${BASE_URL}/api/students`, {
      headers: {
        Authorization: `Bearer ${franchiseOwnerToken}`,
        'x-institute-id': '00000000-0000-0000-0000-000000000000',
      },
    });
    assert(foreignBranchRes.status === 403, 'Scenario 17: Accessing unassigned branch strictly rejected with HTTP 403');

    // -------------------------------------------------------------
    // SCENARIO 18: Unauthorized Users Cannot Modify Agreements
    // -------------------------------------------------------------
    console.log('\n--- Scenario 18: Unauthorized Users Cannot Modify Agreements ---');
    // Franchisee Admin attempting to create agreement
    const unauthCreateRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        title: 'Hacked Agreement',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        calculationMethod: 'FIXED_ANNUAL',
        annualRoyaltyAmount: 100,
      }),
    });
    assert(unauthCreateRes.status === 403, 'Scenario 18a: Franchisee Admin blocked from creating agreement (HTTP 403)');

    // Franchisee Admin attempting to revise agreement
    const unauthReviseRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements/${newCentreAgreementId}/revise`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        revisionReason: 'Unauthorized change',
        digitalGuruRevenuePercentage: 10.0,
        partnerRevenuePercentage: 90.0,
      }),
    });
    assert(unauthReviseRes.status === 403, 'Scenario 18b: Franchisee Admin blocked from revising agreement (HTTP 403)');

    // Franchisee Admin attempting to renew agreement
    const unauthRenewRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/agreements/${newCentreAgreementId}/renew`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        startDate: '2027-01-01',
        endDate: '2027-12-31',
        calculationMethod: 'FIXED_ANNUAL',
        annualRoyaltyAmount: 1000,
      }),
    });
    assert(unauthRenewRes.status === 403, 'Scenario 18c: Franchisee Admin blocked from renewing agreement (HTTP 403)');

    // Franchisee Admin attempting to delete a branch
    const unauthDelBranchRes = await fetch(`${BASE_URL}/api/franchises/${franchiseId}/branches/${branch1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${franchiseOwnerToken}` },
    });
    assert(unauthDelBranchRes.status === 403, 'Scenario 18d: Franchisee Admin blocked from detaching branch (HTTP 403)');

  } catch (err: any) {
    console.error('[Test Execution Error]', err);
    failed++;
  } finally {
    await stopServer();
    console.log('\n============================================================');
    console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('============================================================\n');
  }
}

runTests();
