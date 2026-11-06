import app from '../src/index.js';
import http from 'http';
import { prisma } from '../src/prisma.js';

let server: http.Server;
const TEST_PORT = 5093;
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
      console.log(`[Multi-Branch Franchisee Test Server] Listening on ${BASE_URL}`);
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('[Multi-Branch Franchisee Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function runTests() {
  console.log('\n============================================================');
  console.log('MULTI-BRANCH FRANCHISEE ADMIN & TENANT ISOLATION TEST SUITE');
  console.log('============================================================\n');

  await startServer();

  let testFranchise1Id = '';
  let testFranchise2Id = '';
  let branch1Id = '';
  let branch2Id = '';
  let branch3Id = '';
  let franchise2BranchId = '';
  let franchisee1Token = '';
  let superAdminToken = '';

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
    superAdminToken = adminLoginData.data.accessToken;
    assert(!!superAdminToken, 'Super Admin access token obtained');

    // -------------------------------------------------------------
    // TEST 1: Create Franchise 1 with Franchisee Admin and Branch 1
    // -------------------------------------------------------------
    console.log('\n--- Test 1: Create Franchise 1 (Franchisee Admin) ---');
    const timestamp = Date.now();
    const franchiseeEmail = `franchisee.admin.${timestamp}@digitalghuru.com`;
    const franchiseePhone = `+91 988${Math.floor(1000000 + Math.random() * 9000000)}`;

    const createFranchise1Res = await fetch(`${BASE_URL}/api/franchises`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Digital Guru South Zone ${timestamp}`,
        ownerName: 'Karthik Subramanian',
        email: franchiseeEmail,
        phone: franchiseePhone,
        address: '100 Mount Road, Guindy',
        city: 'Chennai',
        state: 'Tamil Nadu',
        postalCode: '600032',
        agreementStartDate: '2026-04-01',
        agreementEndDate: '2027-03-31',
        royaltyModel: 'FIXED_ANNUAL',
        fixedAnnualFee: 120000,
        password: 'FranchiseeSecure#2026',
      }),
    });

    const f1Data = await createFranchise1Res.json();
    assert(createFranchise1Res.status === 201, `Franchise 1 created successfully (HTTP 201)`);
    testFranchise1Id = f1Data.data.franchise.id;
    assert(!!testFranchise1Id, `Franchise 1 ID obtained: ${testFranchise1Id}`);

    // Super Admin creates Branch 1 and attaches to Franchise 1
    const branch1Code = `BR1-${timestamp.toString().slice(-4)}`;
    const addBranch1Res = await fetch(`${BASE_URL}/api/franchises/${testFranchise1Id}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Digital Guru Guindy Main ${timestamp.toString().slice(-4)}`,
        code: branch1Code,
        address: '100 Mount Road, Guindy',
        city: 'Chennai',
        state: 'Tamil Nadu',
        postalCode: '600032',
      }),
    });
    const addBranch1Data = await addBranch1Res.json();
    assert(addBranch1Res.status === 201, `Branch 1 attached successfully (HTTP 201)`);
    branch1Id = addBranch1Data.data.branch.id;
    assert(!!branch1Id, `Branch 1 primary institute created: ${branch1Id}`);

    // -------------------------------------------------------------
    // TEST 2: Super Admin assigns a second branch to Franchise 1
    // -------------------------------------------------------------
    console.log('\n--- Test 2: Super Admin assigns a second branch to Franchise 1 ---');
    const branch2Code = `BR2-${timestamp.toString().slice(-4)}`;
    const addBranchRes = await fetch(`${BASE_URL}/api/franchises/${testFranchise1Id}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Digital Guru Adyar Annex ${timestamp.toString().slice(-4)}`,
        code: branch2Code,
        address: '45 Sardar Patel Road, Adyar',
        city: 'Chennai',
        state: 'Tamil Nadu',
        postalCode: '600020',
      }),
    });

    const addBranchData = await addBranchRes.json();
    assert(addBranchRes.status === 201, `Second branch attached successfully (HTTP 201)`);
    branch2Id = addBranchData.data.branch.id;
    assert(!!branch2Id, `Branch 2 ID: ${branch2Id}`);

    // Also create a standalone unassigned branch
    const unassignedInstitute = await prisma.institute.create({
      data: {
        name: `Standalone Institute ${timestamp.toString().slice(-4)}`,
        code: `UNASG-${timestamp.toString().slice(-4)}`,
        address: '12 GST Road',
        city: 'Chennai',
        state: 'Tamil Nadu',
        postalCode: '600016',
        franchiseId: null,
      },
    });
    branch3Id = unassignedInstitute.id;
    assert(!!branch3Id, `Standalone unassigned branch created: ${branch3Id}`);

    // -------------------------------------------------------------
    // TEST 3: Franchisee Admin Single Login & Assigned Branch Discovery
    // -------------------------------------------------------------
    console.log('\n--- Test 3: Franchisee Admin Single Login & Branch Discovery ---');
    const franchiseeLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: franchiseeEmail,
        password: 'FranchiseeSecure#2026',
        role: 'FRANCHISE_OWNER',
      }),
    });

    const franchiseeLoginData = await franchiseeLoginRes.json();
    assert(franchiseeLoginRes.status === 200, `Franchisee Admin single login successful (HTTP 200)`);
    franchisee1Token = franchiseeLoginData.data.accessToken;
    assert(!!franchisee1Token, 'Franchisee Admin JWT token obtained');

    // Call GET /api/franchises/my-branches
    const myBranchesRes = await fetch(`${BASE_URL}/api/franchises/my-branches`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${franchisee1Token}`,
      },
    });

    const myBranchesData = await myBranchesRes.json();
    assert(myBranchesRes.status === 200, `GET /api/franchises/my-branches returned 200 OK`);
    const branchesList = myBranchesData.data.branches || [];
    assert(Array.isArray(branchesList), `Response data.branches is an array of branches`);
    assert(branchesList.length >= 2, `Franchisee Admin sees at least 2 assigned branches (got ${branchesList.length})`);

    const branchIds = branchesList.map((b: any) => b.id);
    assert(branchIds.includes(branch1Id), `Branch 1 (${branch1Id}) is in assigned branches`);
    assert(branchIds.includes(branch2Id), `Branch 2 (${branch2Id}) is in assigned branches`);
    assert(!branchIds.includes(branch3Id), `Unassigned Branch (${branch3Id}) is NOT in assigned branches`);

    // -------------------------------------------------------------
    // TEST 4: Branch Switching without Re-login
    // -------------------------------------------------------------
    console.log('\n--- Test 4: Seamless Branch Switching without Re-login ---');
    // Fetch Branch 1 Dashboard
    const b1DashRes = await fetch(`${BASE_URL}/api/franchises/dashboard/owner?branchId=${branch1Id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${franchisee1Token}` },
    });
    const b1DashData = await b1DashRes.json();
    assert(b1DashRes.status === 200, `Branch 1 dashboard retrieved with same token`);
    assert(b1DashData.data.selectedBranch.id === branch1Id, `Selected branch in response matches Branch 1`);
    assert(b1DashData.data.isConsolidated === false, `Dashboard is in single-branch focus mode`);

    // Fetch Branch 2 Dashboard with exact same token
    const b2DashRes = await fetch(`${BASE_URL}/api/franchises/dashboard/owner?branchId=${branch2Id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${franchisee1Token}` },
    });
    const b2DashData = await b2DashRes.json();
    assert(b2DashRes.status === 200, `Branch 2 dashboard retrieved with same token`);
    assert(b2DashData.data.selectedBranch.id === branch2Id, `Selected branch in response matches Branch 2`);
    assert(b2DashData.data.isConsolidated === false, `Dashboard is in single-branch focus mode`);

    // -------------------------------------------------------------
    // TEST 5: Consolidated Overview Mode & Branch Cards
    // -------------------------------------------------------------
    console.log('\n--- Test 5: Consolidated Overview Mode (All Assigned Branches) ---');
    const consolidatedRes = await fetch(`${BASE_URL}/api/franchises/dashboard/owner?branchId=ALL`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${franchisee1Token}` },
    });
    const consolidatedData = await consolidatedRes.json();
    assert(consolidatedRes.status === 200, `Consolidated dashboard retrieved with branchId=ALL`);
    assert(consolidatedData.data.isConsolidated === true, `Dashboard isConsolidated flag is true`);
    assert(consolidatedData.data.metrics.totalBranches >= 2, `Total branches count in consolidated metrics is >= 2`);
    assert(Array.isArray(consolidatedData.data.branchCards), `branchCards array is present`);
    assert(consolidatedData.data.branchCards.length >= 2, `branchCards contains cards for all assigned branches`);

    // Verify branch cards contain live branch metrics
    const card1 = consolidatedData.data.branchCards.find((c: any) => c.id === branch1Id);
    const card2 = consolidatedData.data.branchCards.find((c: any) => c.id === branch2Id);
    assert(!!card1, `Branch 1 card exists in branchCards`);
    assert(!!card2, `Branch 2 card exists in branchCards`);
    assert(typeof card1.activeStudents === 'number', `Branch 1 card has activeStudents metric`);
    assert(typeof card1.staffCount === 'number', `Branch 1 card has staffCount metric`);
    assert(typeof card1.attendanceRate === 'number', `Branch 1 card has attendanceRate metric`);
    assert(typeof card1.pendingFees === 'number', `Branch 1 card has pendingFees metric`);

    // -------------------------------------------------------------
    // TEST 6: Tenant Isolation & Security (HTTP 403 on Cross-Franchise Branch Access)
    // -------------------------------------------------------------
    console.log('\n--- Test 6: Tenant Isolation - Reject Access to Unauthorized Branches ---');
    // Create Franchise 2 with its own branch
    const f2Email = `other.franchisee.${timestamp}@digitalghuru.com`;
    const f2Phone = `+91 977${Math.floor(1000000 + Math.random() * 9000000)}`;
    const f2Res = await fetch(`${BASE_URL}/api/franchises`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Digital Guru North Zone ${timestamp}`,
        ownerName: 'Pradeep Sharma',
        email: f2Email,
        phone: f2Phone,
        address: '50 Trichy Main Road',
        city: 'Salem',
        state: 'Tamil Nadu',
        postalCode: '636001',
        agreementStartDate: '2026-04-01',
        agreementEndDate: '2027-03-31',
        royaltyModel: 'FIXED_ANNUAL',
        fixedAnnualFee: 100000,
        password: 'FranchiseeSecure#2026',
      }),
    });
    const f2Data = await f2Res.json();
    testFranchise2Id = f2Data.data.franchise.id;
    assert(!!testFranchise2Id, `Franchise 2 ID obtained: ${testFranchise2Id}`);

    const addF2BranchRes = await fetch(`${BASE_URL}/api/franchises/${testFranchise2Id}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `Digital Guru Salem Central ${timestamp.toString().slice(-4)}`,
        code: `F2BR-${timestamp.toString().slice(-4)}`,
        address: '50 Trichy Main Road',
        city: 'Salem',
        state: 'Tamil Nadu',
        postalCode: '636001',
      }),
    });
    const addF2BranchData = await addF2BranchRes.json();
    franchise2BranchId = addF2BranchData.data.branch.id;
    assert(!!franchise2BranchId, `Franchise 2 branch created: ${franchise2BranchId}`);

    // Franchisee 1 attempts to access Franchise 2's branch via query param
    const crossBranchAccessRes = await fetch(
      `${BASE_URL}/api/franchises/dashboard/owner?branchId=${franchise2BranchId}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${franchisee1Token}` },
      }
    );
    assert(
      crossBranchAccessRes.status === 403,
      `Cross-franchise branch query access returns HTTP 403 Forbidden (got ${crossBranchAccessRes.status})`
    );

    // Franchisee 1 attempts to access unassigned branch via query param
    const unassignedAccessRes = await fetch(
      `${BASE_URL}/api/franchises/dashboard/owner?branchId=${branch3Id}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${franchisee1Token}` },
      }
    );
    assert(
      unassignedAccessRes.status === 403,
      `Unassigned branch query access returns HTTP 403 Forbidden (got ${unassignedAccessRes.status})`
    );

    // Franchisee 1 attempts API call with manipulated x-institute-id header pointing to Franchise 2's branch
    const headerTamperRes = await fetch(`${BASE_URL}/api/students`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${franchisee1Token}`,
        'x-institute-id': franchise2BranchId,
      },
    });
    assert(
      headerTamperRes.status === 403,
      `Manipulated x-institute-id header for other franchise branch returns HTTP 403 Forbidden (got ${headerTamperRes.status})`
    );

    // -------------------------------------------------------------
    // TEST 7: Mutation Guard when in Consolidated Mode (ALL)
    // -------------------------------------------------------------
    console.log('\n--- Test 7: Mutation Guard for Consolidated Mode (ALL) ---');
    // Attempting a POST with x-institute-id: ALL must be rejected with 400
    const createStudentInAllRes = await fetch(`${BASE_URL}/api/students`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchisee1Token}`,
        'x-institute-id': 'ALL',
      },
      body: JSON.stringify({
        firstName: 'Unauthorized',
        lastName: 'Student',
      }),
    });
    assert(
      createStudentInAllRes.status === 400,
      `Write/Mutation request with x-institute-id: ALL rejected with HTTP 400 Bad Request (got ${createStudentInAllRes.status})`
    );
    const createStudentInAllData = await createStudentInAllRes.json();
    assert(
      createStudentInAllData.error?.includes('Please select a specific') ||
      createStudentInAllData.error?.includes('campus branch'),
      `Error message guides user to select a specific branch for write operations`
    );

    // -------------------------------------------------------------
    // TEST 8: Super Admin Branch Assignment & Detachment Lifecycle
    // -------------------------------------------------------------
    console.log('\n--- Test 8: Super Admin Branch Assignment and Detachment ---');
    // 8a: Super Admin queries unassigned branches
    const unassignedListRes = await fetch(`${BASE_URL}/api/franchises/unassigned-branches`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const unassignedListData = await unassignedListRes.json();
    assert(unassignedListRes.status === 200, `Super Admin can fetch unassigned branches (HTTP 200)`);
    const unassignedList = unassignedListData.data.branches || [];
    const unassignedIds = unassignedList.map((b: any) => b.id);
    assert(unassignedIds.includes(branch3Id), `Standalone branch ${branch3Id} is in unassigned branches list`);

    // 8b: Super Admin assigns existing unassigned branch to Franchise 1
    const assignExistingRes = await fetch(`${BASE_URL}/api/franchises/${testFranchise1Id}/branches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        instituteId: branch3Id,
      }),
    });
    assert(assignExistingRes.status === 201, `Super Admin assigned existing branch ${branch3Id} to Franchise 1 (HTTP 201)`);

    // Verify Franchisee 1 now sees 3 branches
    const myBranchesAfterAssignRes = await fetch(`${BASE_URL}/api/franchises/my-branches`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${franchisee1Token}` },
    });
    const myBranchesAfterAssignData = await myBranchesAfterAssignRes.json();
    const myBranchesAfterAssignList = myBranchesAfterAssignData.data.branches || [];
    const updatedBranchIds = myBranchesAfterAssignList.map((b: any) => b.id);
    assert(updatedBranchIds.includes(branch3Id), `Branch 3 is now in Franchisee 1's assigned branches list`);

    // 8c: Super Admin detaches Branch 3
    const detachRes = await fetch(`${BASE_URL}/api/franchises/${testFranchise1Id}/branches/${branch3Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(detachRes.status === 200, `Super Admin detached branch ${branch3Id} successfully (HTTP 200)`);

    // Verify branch 3 still exists in database and was NOT deleted
    const preservedInstitute = await prisma.institute.findUnique({
      where: { id: branch3Id },
    });
    assert(!!preservedInstitute, `Detached branch record was PRESERVED in database (not dropped/deleted)`);
    assert(preservedInstitute?.franchiseId === null, `Detached branch franchiseId was safely set to null`);

    // Verify Franchisee 1 no longer sees Branch 3
    const myBranchesAfterDetachRes = await fetch(`${BASE_URL}/api/franchises/my-branches`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${franchisee1Token}` },
    });
    const myBranchesAfterDetachData = await myBranchesAfterDetachRes.json();
    const myBranchesAfterDetachList = myBranchesAfterDetachData.data.branches || [];
    const finalBranchIds = myBranchesAfterDetachList.map((b: any) => b.id);
    assert(!finalBranchIds.includes(branch3Id), `Branch 3 is no longer accessible by Franchisee 1`);

    // -------------------------------------------------------------
    // TEST 9: Preserved Two-Installment Royalty Verification
    // -------------------------------------------------------------
    console.log('\n--- Test 9: Preserved Two-Installment Royalty Verification ---');
    const f1DashboardFullRes = await fetch(
      `${BASE_URL}/api/franchises/dashboard/owner?branchId=${branch1Id}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${franchisee1Token}` },
      }
    );
    const f1DashboardFullData = await f1DashboardFullRes.json();
    assert(f1DashboardFullRes.status === 200, `Franchisee 1 dashboard contains royalty agreements`);
    const agreement = f1DashboardFullData.data.activeAgreement || f1DashboardFullData.data.agreements?.[0];
    assert(!!agreement, `Agreement data is present in dashboard`);
    assert(
      agreement.installments && agreement.installments.length === 2,
      `Agreement maintains exactly two installments schedule (got ${agreement.installments?.length})`
    );
    assert(
      agreement.calculationMethod === 'FIXED_ANNUAL',
      `Agreement calculation method is FIXED_ANNUAL`
    );

  } catch (err: any) {
    console.error('Unexpected error in test suite:', err);
    assert(false, `Unexpected error: ${err.message}`);
  } finally {
    // Clean up temporary institutes created in test to keep DB clean
    if (branch3Id) {
      try {
        await prisma.institute.delete({ where: { id: branch3Id } }).catch(() => { });
      } catch (e) { }
    }
    await stopServer();
  }

  console.log('\n============================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();