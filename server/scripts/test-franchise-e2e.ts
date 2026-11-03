import app from '../src/index.js';
import http from 'http';
import { prisma } from '../src/prisma.js';

let server: http.Server;
const TEST_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string, extra?: any) {
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
    if (extra) console.error('    Detail:', extra);
    failedCount++;
  }
}

async function startServer(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(TEST_PORT, '127.0.0.1', () => {
      console.log(`[Franchise Test Server] Running on ${BASE_URL}`);
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('[Franchise Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function run() {
  console.log('================================================================');
  console.log(' DIGITAL GURU FRANCHISE: END-TO-END FRANCHISE SUITE VERIFICATION');
  console.log('================================================================\n');

  await startServer();

  try {
    // -------------------------------------------------------------
    // Step 1: Super Admin Login
    // -------------------------------------------------------------
    console.log('\n--- 1. Super Admin Authentication ---');
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
    const adminLoginJson = await adminLoginRes.json();
    assert(adminLoginRes.status === 200 && adminLoginJson.success, '1. Super Admin login successful');
    const superAdminToken = adminLoginJson.data.accessToken;

    // Clean up any test franchises from previous runs if existing
    const existingTestFranchise = await prisma.franchise.findFirst({
      where: { email: 'rajesh.owner@digitalghuru.example.com' },
    });
    if (existingTestFranchise) {
      // Remove any branches pointing to it or cascade
      await prisma.franchise.delete({ where: { id: existingTestFranchise.id } });
    }
    const existingOwner2 = await prisma.franchise.findFirst({
      where: { email: 'owner2@digitalghuru.example.com' },
    });
    if (existingOwner2) {
      await prisma.franchise.delete({ where: { id: existingOwner2.id } });
    }

    // -------------------------------------------------------------
    // Step 2: Super Admin Creates Franchise with 50% Royalty Agreement
    // -------------------------------------------------------------
    console.log('\n--- 2. Create Franchise & Owner Account ---');
    const createFranchiseRes = await fetch(`${BASE_URL}/api/franchises`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Digital Guru Anna Nagar',
        ownerName: 'Rajesh Kumar',
        email: 'rajesh.owner@digitalghuru.example.com',
        phone: '9840123456',
        password: 'FranchiseOwner#2026',
        city: 'Chennai',
        state: 'Tamil Nadu',
        address: '12, 2nd Avenue, Anna Nagar, Chennai - 600040',
        businessDetails: {
          gstin: '33AAAAA0000A1Z5',
          pan: 'ABCDE1234F',
          bankName: 'HDFC Bank',
          accountNumber: '5010099887766',
        },
        initialAgreement: {
          title: 'Master Franchise Agreement - Anna Nagar',
          startDate: '2026-01-01',
          endDate: '2028-12-31',
          royaltyPercentage: 50.0,
          royaltyBasis: 'TOTAL_COLLECTIONS',
          paymentFrequency: 'MONTHLY',
          dueDay: 10,
        },
      }),
    });
    const createFranchiseJson = await createFranchiseRes.json();
    assert(
      createFranchiseRes.status === 201 && createFranchiseJson.success,
      '2. Franchise creation created successfully with sequential code',
      createFranchiseJson
    );
    const franchise1 = createFranchiseJson.data.franchise;
    const initialAgreement1 = createFranchiseJson.data.initialAgreement;
    assert(franchise1.code.startsWith('DG-FR-'), `Franchise code formatted correctly: ${franchise1.code}`);
    assert(Number(initialAgreement1.royaltyPercentage) === 50, `Initial agreement royalty is 50%: ${initialAgreement1.royaltyPercentage}%`);

    // -------------------------------------------------------------
    // Step 3: Franchise Owner Login
    // -------------------------------------------------------------
    console.log('\n--- 3. Franchise Owner Authentication ---');
    const ownerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'rajesh.owner@digitalghuru.example.com',
        password: 'FranchiseOwner#2026',
        role: 'FRANCHISE_OWNER',
      }),
    });
    const ownerLoginJson = await ownerLoginRes.json();
    assert(ownerLoginRes.status === 200 && ownerLoginJson.success, '3. Franchise Owner login successful');
    assert(ownerLoginJson.data.user.role === 'FRANCHISE_OWNER', 'User role is FRANCHISE_OWNER');
    assert(ownerLoginJson.data.franchise?.id === franchise1.id, 'Response returns associated Franchise object');
    const ownerToken = ownerLoginJson.data.accessToken;

    // -------------------------------------------------------------
    // Step 4: Branch Management (Add Campus Branch)
    // -------------------------------------------------------------
    console.log('\n--- 4. Branch Management ---');
    const branchCode = `DG-ANN-${Date.now().toString().slice(-4)}`;
    const addBranchRes = await fetch(`${BASE_URL}/api/franchises/${franchise1.id}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        createNew: true,
        name: 'Digital Guru Anna Nagar Campus',
        code: branchCode,
        city: 'Chennai',
        state: 'Tamil Nadu',
        address: '12, 2nd Avenue, Anna Nagar',
        phone: '9840123456',
        email: 'annanagar@digitalghuru.example.com',
      }),
    });
    const addBranchJson = await addBranchRes.json();
    assert(addBranchRes.status === 201 && addBranchJson.success, '4a. Branch created and attached to franchise');
    const branch1 = addBranchJson.data.branch;

    // List branches as Franchise Owner
    const listBranchesRes = await fetch(`${BASE_URL}/api/franchises/${franchise1.id}/branches`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const listBranchesJson = await listBranchesRes.json();
    assert(
      listBranchesRes.status === 200 && listBranchesJson.data.branches.length >= 1,
      '4b. Franchise Owner can list branches under their franchise'
    );

    // -------------------------------------------------------------
    // Step 5: Agreement Management & Amendments
    // -------------------------------------------------------------
    console.log('\n--- 5. Agreement Lifecycle & Amendment Audit Trail ---');
    const amendRes = await fetch(
      `${BASE_URL}/api/franchises/${franchise1.id}/agreements/${initialAgreement1.id}/amendments`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          note: 'Annual performance clause updated; 50/50 split confirmed',
          royaltyPercentage: 50.0,
          dueDay: 15,
        }),
      }
    );
    const amendJson = await amendRes.json();
    assert(amendRes.status === 200 && amendJson.success, '5a. Agreement amendment logged successfully');
    assert(
      Array.isArray(amendJson.data.agreement.amendments) && amendJson.data.agreement.amendments.length > 0,
      '5b. Amendment audit log preserved on agreement document'
    );

    // Document / PDF Data endpoint
    const pdfDataRes = await fetch(
      `${BASE_URL}/api/franchises/${franchise1.id}/agreements/${initialAgreement1.id}/pdf`,
      {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }
    );
    const pdfDataJson = await pdfDataRes.json();
    assert(pdfDataRes.status === 200 && pdfDataJson.success, '5c. Agreement PDF / Document data generated');
    assert(
      pdfDataJson.data.company.brand.includes('Digital Guru') && pdfDataJson.data.company.royaltySplit.includes('50%'),
      '5d. PDF legal text contains Digital Guru branding & 50/50 split'
    );

    // -------------------------------------------------------------
    // Step 6: Royalty Calculation & Payment
    // -------------------------------------------------------------
    console.log('\n--- 6. Royalty Calculation & Payment ---');
    // Create a batch, student, fee structure, assignment, and payment
    const testBatch = await prisma.batch.create({
      data: {
        instituteId: branch1.id,
        name: 'Franchise 2026 Batch',
        code: `B-FR-${Date.now().toString().slice(-4)}`,
        academicYear: '2026-2027',
        startDate: new Date('2026-01-01'),
      },
    });

    const testStudent = await prisma.student.create({
      data: {
        admissionNumber: `STU-FR-${Date.now().toString().slice(-4)}`,
        instituteId: branch1.id,
        firstName: 'Franchise',
        lastName: 'Student',
        gender: 'MALE',
        status: 'ACTIVE',
      },
    });

    const feeStructure = await prisma.feeStructure.create({
      data: {
        instituteId: branch1.id,
        batchId: testBatch.id,
        name: 'Monthly Tuition Fee',
        frequency: 'MONTHLY',
        amount: 10000,
      },
    });

    const feeAssignment = await prisma.studentFeeAssignment.create({
      data: {
        studentId: testStudent.id,
        feeStructureId: feeStructure.id,
        termLabel: 'November 2026',
        baseAmount: 10000,
        finalAmount: 10000,
        dueDate: new Date('2026-11-10'),
        status: 'PAID',
      },
    });

    const adminUser = await prisma.user.findFirst({ where: { email: 'superadmin@platform.local' } });

    // Seed 1 payment of 10,000 INR
    const payment = await prisma.payment.create({
      data: {
        instituteId: branch1.id,
        studentId: testStudent.id,
        feeAssignmentId: feeAssignment.id,
        receiptNumber: `RCP-FR-${Date.now().toString().slice(-6)}`,
        amountPaid: 10000,
        method: 'CASH',
        status: 'SUCCESS',
        paidAt: new Date('2026-11-02T10:00:00Z'),
        recordedById: adminUser!.id,
      },
    });

    // Run royalty calculation for 2026-11
    const calcRes = await fetch(`${BASE_URL}/api/franchises/${franchise1.id}/royalty/calculate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        startDate: '2026-11-01',
        endDate: '2026-11-30',
        periodLabel: '2026-11',
      }),
    });
    const calcJson = await calcRes.json();
    assert(calcRes.status === 200 && calcJson.success, '6a. Royalty calculated from fee collection payments');
    const royaltyRecord = calcJson.data.royaltyRecord;
    assert(
      Number(royaltyRecord.grossCollection) >= 10000,
      `Gross collection matches payments: ${royaltyRecord.grossCollection} INR`
    );
    assert(
      Number(royaltyRecord.royaltyPayable) === Number(royaltyRecord.grossCollection) * 0.5,
      `Royalty payable is exactly 50% split: ${royaltyRecord.royaltyPayable} INR`
    );

    // Record Royalty Payment against this record
    const payRes = await fetch(`${BASE_URL}/api/franchises/${franchise1.id}/royalty/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        royaltyRecordId: royaltyRecord.id,
        amountPaid: Number(royaltyRecord.royaltyPayable),
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: 'NEFT-DG-88990011',
        remarks: 'November 2026 full royalty settlement (50% split)',
      }),
    });
    const payJson = await payRes.json();
    assert(payRes.status === 201 && payJson.success, '6b. Royalty payment recorded with receipt');
    assert(
      payJson.data.payment.receiptNumber.startsWith('ROY-REC-2026-'),
      `Receipt number generated correctly: ${payJson.data.payment.receiptNumber}`
    );

    // Verify royalty record status updated to PAID via GET /royalty
    const listRoyaltyRes = await fetch(`${BASE_URL}/api/franchises/${franchise1.id}/royalty`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const listRoyaltyJson = await listRoyaltyRes.json();
    const updatedRecord = listRoyaltyJson.data.records.find((r: any) => r.id === royaltyRecord.id);
    assert(
      updatedRecord && updatedRecord.status === 'PAID',
      `Royalty record updated to PAID status: ${updatedRecord?.status}`
    );

    // -------------------------------------------------------------
    // Step 7: Super Admin & Franchise Owner Dashboards
    // -------------------------------------------------------------
    console.log('\n--- 7. Super Admin & Owner Dashboards ---');
    const saDashRes = await fetch(`${BASE_URL}/api/franchises/dashboard/super-admin`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const saDashJson = await saDashRes.json();
    assert(saDashRes.status === 200 && saDashJson.success, '7a. Super Admin Franchise Dashboard operational');
    assert(
      (saDashJson.data.summary?.totalFranchises ?? saDashJson.data.stats?.totalFranchises) >= 1 &&
      (saDashJson.data.summary?.totalBranches ?? saDashJson.data.stats?.totalBranches) >= 1,
      `Super Admin stats: ${saDashJson.data.summary?.totalFranchises} franchises, ${saDashJson.data.summary?.totalBranches} branches`
    );

    const ownerDashRes = await fetch(`${BASE_URL}/api/franchises/dashboard/owner`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const ownerDashJson = await ownerDashRes.json();
    assert(ownerDashRes.status === 200 && ownerDashJson.success, '7b. Franchise Owner Dashboard operational');
    assert(
      ownerDashJson.data.franchise.id === franchise1.id,
      `Owner dashboard correctly scoped to owner franchise: ${ownerDashJson.data.franchise.name}`
    );
    assert(
      ownerDashJson.data.metrics.totalBranches >= 1,
      `Owner dashboard reports ${ownerDashJson.data.metrics.totalBranches} active branches`
    );

    // -------------------------------------------------------------
    // Step 8: Multi-Tenant Isolation & Cross-Tenant 403 Enforcement
    // -------------------------------------------------------------
    console.log('\n--- 8. Multi-Tenant Isolation Verification ---');
    // Create Franchise 2 with Owner 2
    const createFranchise2Res = await fetch(`${BASE_URL}/api/franchises`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Digital Guru Ameerpet',
        ownerName: 'Sunita Sharma',
        email: 'owner2@digitalghuru.example.com',
        phone: '9840999888',
        password: 'FranchiseOwner2#2026',
        city: 'Hyderabad',
        state: 'Telangana',
      }),
    });
    const createFranchise2Json = await createFranchise2Res.json();
    const franchise2 = createFranchise2Json.data.franchise;

    // Login as Owner 2
    const owner2LoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'owner2@digitalghuru.example.com',
        password: 'FranchiseOwner2#2026',
        role: 'FRANCHISE_OWNER',
      }),
    });
    const owner2LoginJson = await owner2LoginRes.json();
    const owner2Token = owner2LoginJson.data.accessToken;

    // Owner 2 tries to access Franchise 1 details -> MUST FAIL (403)
    const crossAccessFranchiseRes = await fetch(`${BASE_URL}/api/franchises/${franchise1.id}`, {
      headers: { Authorization: `Bearer ${owner2Token}` },
    });
    assert(
      crossAccessFranchiseRes.status === 403,
      `8a. Cross-Franchise Isolation: Owner 2 forbidden from accessing Franchise 1 (HTTP ${crossAccessFranchiseRes.status})`
    );

    // Owner 2 tries to list branches of Franchise 1 -> MUST FAIL (403)
    const crossAccessBranchesRes = await fetch(`${BASE_URL}/api/franchises/${franchise1.id}/branches`, {
      headers: { Authorization: `Bearer ${owner2Token}` },
    });
    assert(
      crossAccessBranchesRes.status === 403,
      `8b. Cross-Franchise Isolation: Owner 2 forbidden from listing Franchise 1 branches (HTTP ${crossAccessBranchesRes.status})`
    );

    // Owner 2 tries to view agreements of Franchise 1 -> MUST FAIL (403)
    const crossAccessAgreementsRes = await fetch(`${BASE_URL}/api/franchises/${franchise1.id}/agreements`, {
      headers: { Authorization: `Bearer ${owner2Token}` },
    });
    assert(
      crossAccessAgreementsRes.status === 403,
      `8c. Cross-Franchise Isolation: Owner 2 forbidden from viewing Franchise 1 agreements (HTTP ${crossAccessAgreementsRes.status})`
    );

    // Owner 2 tries to view royalties of Franchise 1 -> MUST FAIL (403)
    const crossAccessRoyaltiesRes = await fetch(`${BASE_URL}/api/franchises/${franchise1.id}/royalty`, {
      headers: { Authorization: `Bearer ${owner2Token}` },
    });
    assert(
      crossAccessRoyaltiesRes.status === 403,
      `8d. Cross-Franchise Isolation: Owner 2 forbidden from viewing Franchise 1 royalties (HTTP ${crossAccessRoyaltiesRes.status})`
    );

    // Clean up test data
    console.log('\n--- Test Cleanup ---');
    await prisma.payment.deleteMany({ where: { instituteId: branch1.id } }).catch(() => {});
    await prisma.studentFeeAssignment.deleteMany({ where: { studentId: testStudent.id } }).catch(() => {});
    await prisma.feeStructure.deleteMany({ where: { instituteId: branch1.id } }).catch(() => {});
    await prisma.batch.deleteMany({ where: { instituteId: branch1.id } }).catch(() => {});
    await prisma.student.deleteMany({ where: { instituteId: branch1.id } }).catch(() => {});
    console.log('Cleaned up test student and payment fixtures.');

  } catch (err: any) {
    console.error('Test Suite encountered an error:', err);
    failedCount++;
  } finally {
    await stopServer();
  }

  console.log('\n================================================================');
  console.log(` FRANCHISE TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

run();
