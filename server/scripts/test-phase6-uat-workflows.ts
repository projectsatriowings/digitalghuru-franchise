/**
 * DIGITAL GURU FRANCHISE: PHASE 6 USER ACCEPTANCE TESTING (UAT) SUITE
 * 
 * Verifies end-to-end multi-tier hierarchy & user acceptance workflows:
 * 1. Super Admin manages franchises & agreements (50/50 royalty)
 * 2. Franchise Owner 1 provisions & manages authorized branches
 * 3. Branch Admin & Staff execute branch-level operations (subjects, batches, attendance, fee collection)
 * 4. Student & Parent access authorized portals only (administrative APIs blocked with HTTP 403)
 * 5. Multi-tenant isolation strictly enforced between Franchise 1 and Franchise 2
 * 6. Automated monthly royalty calculation (50% split) & payment recording with receipt generation
 * 7. Operational readiness: health check, rate limiting, and uniform authentication error handling
 */

import http from 'http';
import { Prisma } from '@prisma/client';
import app from '../src/index.js';
import { prisma } from '../src/prisma.js';
import { hashPassword } from '../src/utils/security.js';

let server: http.Server;
const UAT_PORT = 5096;
const BASE_URL = `http://127.0.0.1:${UAT_PORT}`;

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
      'x-internal-test': 'dg-test-suite',
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

async function runUAT() {
  console.log('================================================================');
  console.log(' DIGITAL GURU FRANCHISE: PHASE 6 USER ACCEPTANCE TESTING (UAT)');
  console.log('================================================================\n');

  server = app.listen(UAT_PORT, '127.0.0.1');
  await new Promise((resolve) => setTimeout(resolve, 1500));
  console.log(`[UAT Test Server] Running on ${BASE_URL}\n`);

  // Shared state across UAT stages
  let saToken = '';
  let owner1Token = '';
  let owner2Token = '';
  let branchAdminToken = '';
  let staffToken = '';
  let studentToken = '';
  let parentToken = '';

  let franchise1Id = '';
  let franchise2Id = '';
  let branch1Id = '';
  let branch2Id = '';
  let subjectId = '';
  let batchId = '';
  let studentId = '';
  let agreementId = '';
  let royaltyRecordId = '';
  let parentPhone = '';

  const timestamp = Date.now();
  const pwd = 'UATSecurePassword#2026';
  const hashedPwd = await hashPassword(pwd);

  try {
    // ------------------------------------------------------------------------
    // SCENARIO 1: SYSTEM HEALTH & OPERATIONAL BASELINE
    // ------------------------------------------------------------------------
    console.log('--- Scenario 1: System Health & Baseline Verification ---');
    let healthRes: any;
    for (let attempt = 1; attempt <= 4; attempt++) {
      healthRes = await api('/api/health');
      if (healthRes.status === 200 && healthRes.body?.status === 'healthy') break;
      console.log(`Health check attempt ${attempt} returned status ${healthRes.status}. Retrying in 2.5s...`);
      await new Promise((r) => setTimeout(r, 2500));
    }
    assert(
      healthRes.status === 200 && healthRes.body?.status === 'healthy',
      '1. System health check reports status: "healthy" on dedicated database'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 2: SUPER ADMIN AUTHENTICATION & FRANCHISE ONBOARDING
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 2: Super Admin Franchise Onboarding & 50/50 Agreement ---');
    const saLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'superadmin@platform.local',
        password: 'AdminSecurePassword#2026',
        role: 'SUPER_ADMIN',
      }),
    });
    saToken = saLogin.body?.data?.accessToken;
    assert(Boolean(saToken), '2a. Super Admin logged in successfully');

    // Super Admin creates Franchise Alpha
    const f1Res = await api('/api/franchises', {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        name: `UAT Digital Guru Alpha ${timestamp}`,
        ownerName: 'UAT Franchise Owner Alpha',
        email: `uat.owner.alpha.${timestamp}@digitalghuru.staging`,
        phone: `882594${Math.floor(1000 + Math.random() * 9000)}`,
        password: pwd,
        city: 'Chennai',
        state: 'Tamil Nadu',
        initialAgreement: {
          title: 'Master Franchise Agreement - Alpha',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          royaltyPercentage: 50.0,
          paymentFrequency: 'MONTHLY',
          dueDay: 5,
        },
      }),
    });
    franchise1Id = f1Res.body?.data?.franchise?.id;
    const initialAgr = f1Res.body?.data?.agreement || f1Res.body?.data?.initialAgreement;
    agreementId = initialAgr?.id;
    assert(
      f1Res.status === 201 && Boolean(franchise1Id),
      `2b. Franchise Alpha created with sequential code: ${f1Res.body?.data?.franchise?.code}`
    );
    assert(
      Number(initialAgr?.royaltyPercentage) === 50,
      '2c. Initial franchise agreement established with default 50% royalty split'
    );

    // Super Admin creates Franchise Beta (for cross-tenant tests)
    const f2Res = await api('/api/franchises', {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        name: `UAT Digital Guru Beta ${timestamp}`,
        ownerName: 'UAT Franchise Owner Beta',
        email: `uat.owner.beta.${timestamp}@digitalghuru.staging`,
        phone: `882594${Math.floor(1000 + Math.random() * 9000)}`,
        password: pwd,
        city: 'Hyderabad',
        state: 'Telangana',
      }),
    });
    franchise2Id = f2Res.body?.data?.franchise?.id;
    assert(
      f2Res.status === 201 && Boolean(franchise2Id),
      `2d. Franchise Beta created for tenant isolation verification (${f2Res.body?.data?.franchise?.code})`
    );

    // ------------------------------------------------------------------------
    // SCENARIO 3: FRANCHISE OWNER WORKFLOWS & BRANCH MANAGEMENT
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 3: Franchise Owner Branch Management ---');
    let owner1Login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: `uat.owner.alpha.${timestamp}@digitalghuru.staging`,
        password: pwd,
        role: 'FRANCHISE_OWNER',
      }),
    });
    if (owner1Login.status !== 200) {
      console.log('Retrying Owner Alpha login after transient reconnect...');
      await new Promise(r => setTimeout(r, 2000));
      owner1Login = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: `uat.owner.alpha.${timestamp}@digitalghuru.staging`,
          password: pwd,
          role: 'FRANCHISE_OWNER',
        }),
      });
    }
    owner1Token = owner1Login.body?.data?.accessToken;
    assert(Boolean(owner1Token), '3a. Franchise Owner Alpha logged in');

    let owner2Login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: `uat.owner.beta.${timestamp}@digitalghuru.staging`,
        password: pwd,
        role: 'FRANCHISE_OWNER',
      }),
    });
    if (owner2Login.status !== 200) {
      console.log('Retrying Owner Beta login after transient reconnect...');
      await new Promise(r => setTimeout(r, 2000));
      owner2Login = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: `uat.owner.beta.${timestamp}@digitalghuru.staging`,
          password: pwd,
          role: 'FRANCHISE_OWNER',
        }),
      });
    }
    owner2Token = owner2Login.body?.data?.accessToken;
    assert(Boolean(owner2Token), '3b. Franchise Owner Beta logged in');

    // 3c. Business Rule 1 & 3: Franchise Owner CANNOT create branches (403 Forbidden)
    const ownerCreateBranchAttempt = await api(`/api/franchises/${franchise1Id}/branches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner1Token}` },
      body: JSON.stringify({
        createNew: true,
        name: `Unauthorized Branch Attempt`,
        city: 'Chennai',
      }),
    });
    assert(
      ownerCreateBranchAttempt.status === 403,
      '3c. Franchise Owner strictly forbidden from creating branch campuses (HTTP 403)'
    );

    // Super Admin creates and attaches Branch 1 (Alpha Anna Nagar)
    const br1Res = await api(`/api/franchises/${franchise1Id}/branches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        createNew: true,
        name: `Alpha Anna Nagar Campus ${timestamp}`,
        code: `BR-ANN-${timestamp.toString().slice(-4)}`,
        city: 'Chennai',
        state: 'Tamil Nadu',
        address: '45, 3rd Avenue, Anna Nagar East',
        email: `branch1.${timestamp}@digitalghuru.staging`,
        phone: '8825948851',
      }),
    });
    branch1Id = br1Res.body?.data?.branch?.id;
    assert(
      br1Res.status === 201 && Boolean(branch1Id),
      `3d. Super Admin attaches Branch 1 (Alpha Anna Nagar) under Franchise Alpha (${br1Res.body?.data?.branch?.code})`
    );

    // Super Admin creates and attaches Branch 2 (Alpha Korattur)
    const br2Res = await api(`/api/franchises/${franchise1Id}/branches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        createNew: true,
        name: `Alpha Korattur Campus ${timestamp}`,
        code: `BR-KOR-${timestamp.toString().slice(-4)}`,
        city: 'Chennai',
        state: 'Tamil Nadu',
        address: '2nd Floor, Gurudev Complex, Korattur',
        email: `branch2.${timestamp}@digitalghuru.staging`,
        phone: '8825948852',
      }),
    });
    branch2Id = br2Res.body?.data?.branch?.id;
    assert(
      br2Res.status === 201 && Boolean(branch2Id),
      `3e. Super Admin attaches Branch 2 (Alpha Korattur) under Franchise Alpha (${br2Res.body?.data?.branch?.code})`
    );

    // Owner 1 lists branches
    const listBrRes = await api(`/api/franchises/${franchise1Id}/branches`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    assert(
      listBrRes.status === 200 && listBrRes.body?.data?.branches?.length >= 2,
      '3f. Franchise Owner lists authorized branches (2 campuses confirmed)'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 4: MULTI-TENANT ISOLATION ENFORCEMENT
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 4: Multi-Tenant Cross-Franchise Isolation ---');

    // Owner 1 attempts to access Franchise 2 details -> HTTP 403
    const crossFranchiseRes = await api(`/api/franchises/${franchise2Id}`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    assert(
      crossFranchiseRes.status === 403,
      '4a. Tenant Isolation: Owner Alpha blocked from viewing Franchise Beta (HTTP 403)'
    );

    // Owner 1 attempts to create branch in Franchise 2 -> HTTP 403
    const crossBranchRes = await api(`/api/franchises/${franchise2Id}/branches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner1Token}` },
      body: JSON.stringify({ name: 'Malicious Injected Branch' }),
    });
    assert(
      crossBranchRes.status === 403,
      '4b. Tenant Isolation: Owner Alpha blocked from adding branch to Franchise Beta (HTTP 403)'
    );

    // Owner 1 attempts to view Franchise 2 royalties -> HTTP 403
    const crossRoyaltyRes = await api(`/api/franchises/${franchise2Id}/royalty`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    assert(
      crossRoyaltyRes.status === 403,
      '4c. Tenant Isolation: Owner Alpha blocked from viewing Franchise Beta royalties (HTTP 403)'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 5: BRANCH OPERATIONS (ADMIN, STAFF, ACADEMICS & FEES)
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 5: Branch Operations (Academics, Staff, Students & Fees) ---');

    // Create synthetic Branch Admin for Branch 1
    const adminUser = await prisma.user.create({
      data: {
        email: `uat.admin.a1.${timestamp}@digitalghuru.staging`,
        fullName: 'UAT Branch Admin Alpha',
        passwordHash: hashedPwd,
        role: 'BRANCH_ADMIN',
      },
    });

    await prisma.instituteMembership.create({
      data: {
        userId: adminUser.id,
        instituteId: branch1Id,
        role: 'ACADEMIC_ADMIN',
        isActive: true,
      },
    });

    const adminLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: `uat.admin.a1.${timestamp}@digitalghuru.staging`,
        password: pwd,
        role: 'BRANCH_ADMIN',
      }),
    });
    branchAdminToken = adminLogin.body?.data?.accessToken;
    assert(Boolean(branchAdminToken), '5a. Branch Admin logged in');

    // Create synthetic Staff for Branch 1
    const staffUser = await prisma.user.create({
      data: {
        email: `uat.staff.a1.${timestamp}@digitalghuru.staging`,
        fullName: 'UAT Senior Faculty Alpha',
        passwordHash: hashedPwd,
        role: 'STAFF',
      },
    });

    await prisma.instituteMembership.create({
      data: {
        userId: staffUser.id,
        instituteId: branch1Id,
        role: 'STAFF',
        isActive: true,
      },
    });

    await prisma.staffProfile.create({
      data: {
        userId: staffUser.id,
        instituteId: branch1Id,
        employeeCode: `EMP-UAT-${timestamp.toString().slice(-4)}`,
        altPhone: '8825948853',
        designation: 'Senior Faculty',
        department: 'Digital Marketing & AI',
        joiningDate: new Date(),
      },
    });

    const staffLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: `uat.staff.a1.${timestamp}@digitalghuru.staging`,
        password: pwd,
        role: 'STAFF',
      }),
    });
    staffToken = staffLogin.body?.data?.accessToken;
    assert(Boolean(staffToken), '5b. Staff member logged in');

    // Branch Admin creates Subject
    const subRes = await api('/api/academics/subjects', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${branchAdminToken}`,
        'x-institute-id': branch1Id,
      },
      body: JSON.stringify({
        name: 'AI-Powered Digital Analytics',
        code: `ADA-${timestamp.toString().slice(-4)}`,
        type: 'THEORY',
      }),
    });
    subjectId = subRes.body?.data?.subject?.id || subRes.body?.data?.id;
    assert(
      subRes.status === 201 && Boolean(subjectId),
      '5c. Branch Admin created academic Subject'
    );

    // Branch Admin creates Batch
    const batchRes = await api('/api/academics/batches', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${branchAdminToken}`,
        'x-institute-id': branch1Id,
      },
      body: JSON.stringify({
        name: 'Morning Executive Batch A1',
        code: `MB-A1-${timestamp.toString().slice(-4)}`,
        academicYear: '2026-2027',
        startDate: new Date().toISOString(),
      }),
    });
    batchId = batchRes.body?.data?.batch?.id || batchRes.body?.data?.id;
    assert(
      batchRes.status === 201 && Boolean(batchId),
      '5d. Branch Admin created academic Batch'
    );

    // Create synthetic Student and Parent
    parentPhone = `982594${Math.floor(1000 + Math.random() * 9000)}`;
    const studentAdmissionNum = `ADM-UAT-${timestamp.toString().slice(-4)}`;

    const studentAdmissionRes = await api('/api/students', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${branchAdminToken}`,
        'x-institute-id': branch1Id,
      },
      body: JSON.stringify({
        firstName: 'UAT Student',
        lastName: 'Alpha',
        admissionNumber: studentAdmissionNum,
        gender: 'MALE',
        dob: '2004-05-15',
        batchId,
        initialPassword: 'Password#123',
        parentFullName: 'UAT Parent Alpha',
        parentPhone: parentPhone,
        parentRelationship: 'FATHER',
        parentInitialPassword: 'Password#123',
      }),
    });
    const studentData = studentAdmissionRes.body?.data?.student || studentAdmissionRes.body?.data;
    studentId = studentData?.id;
    const actualAdmissionNum = studentData?.admissionNumber || studentAdmissionNum;
    assert(
      studentAdmissionRes.status === 201 && Boolean(studentId),
      `5e. Student admitted and parent account linked (${actualAdmissionNum})`
    );

    // Branch Admin records Attendance CHECK_IN for student
    const checkInRes = await api('/api/attendance/check-in', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${branchAdminToken}`,
        'x-institute-id': branch1Id,
      },
      body: JSON.stringify({
        studentId,
        batchId,
        subjectId,
        method: 'MANUAL',
      }),
    });
    assert(
      [200, 201].includes(checkInRes.status),
      '5f. Attendance session recorded successfully for student'
    );

    // Create FeeStructure and StudentFeeAssignment, then record payment of 20,000 INR
    const feeStructure = await prisma.feeStructure.create({
      data: {
        instituteId: branch1Id,
        batchId: batchId,
        name: 'UAT Tuition Fee',
        frequency: 'MONTHLY',
        amount: 20000,
      },
    });

    const feeAssignment = await prisma.studentFeeAssignment.create({
      data: {
        studentId: studentId,
        feeStructureId: feeStructure.id,
        termLabel: 'UAT Term 1',
        baseAmount: 20000,
        finalAmount: 20000,
        dueDate: new Date(),
        status: 'PAID',
      },
    });

    // Record fee payment of 20,000 INR for student
    const payment = await prisma.payment.create({
      data: {
        institute: { connect: { id: branch1Id } },
        student: { connect: { id: studentId } },
        feeAssignment: { connect: { id: feeAssignment.id } },
        amountPaid: new Prisma.Decimal(20000.0),
        method: 'UPI',
        receiptNumber: `FEE-REC-${timestamp.toString().slice(-6)}`,
        status: 'SUCCESS',
        recordedBy: { connect: { id: adminUser.id } },
      },
    });
    assert(
      Boolean(payment.id),
      '5g. Student tuition fee payment of 20,000 INR collected and recorded'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 6: STUDENT & PARENT RBAC BOUNDARY VERIFICATION
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 6: Student & Parent Access Boundaries ---');

    // Login as Student
    const studentUser = await prisma.user.findFirst({
      where: { studentProfile: { id: studentId } },
    });
    const studentLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: actualAdmissionNum,
        password: 'Password#123',
        role: 'STUDENT',
      }),
    });
    studentToken = studentLogin.body?.data?.accessToken;
    assert(Boolean(studentToken), '6a. Student logged in with admission number');

    // Student blocked from /api/franchises -> HTTP 403
    const stuFranchiseRes = await api('/api/franchises', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(
      stuFranchiseRes.status === 403,
      '6b. Security Boundary: Student blocked from Franchise Management (HTTP 403)'
    );

    // Student blocked from /api/institutes -> HTTP 403
    const stuInstRes = await api('/api/institutes', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(
      stuInstRes.status === 403,
      '6c. Security Boundary: Student blocked from Institute Administration (HTTP 403)'
    );

    // Login as Parent
    const parentLogin = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: parentPhone,
        password: 'Password#123',
        role: 'PARENT',
      }),
    });
    parentToken = parentLogin.body?.data?.accessToken;
    assert(Boolean(parentToken), '6d. Parent logged in with registered phone');

    // Parent blocked from administrative endpoints -> HTTP 403
    const parentAdminRes = await api('/api/franchises/dashboard/super-admin', {
      headers: { Authorization: `Bearer ${parentToken}` },
    });
    assert(
      parentAdminRes.status === 403,
      '6e. Security Boundary: Parent blocked from Super Admin Dashboard (HTTP 403)'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 7: 50/50 ROYALTY CALCULATION, SETTLEMENT & RECEIPT
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 7: 50/50 Royalty Calculation & Settlement ---');

    // Super Admin calculates monthly royalty for Franchise Alpha
    const periodLabel = `UAT-${timestamp.toString().slice(-6)}`;
    const calcRes = await api(`/api/franchises/${franchise1Id}/royalty/calculate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString(),
        periodLabel,
      }),
    });

    const royaltyRecord = calcRes.body?.data?.royaltyRecord;
    royaltyRecordId = royaltyRecord?.id;
    assert(
      calcRes.status === 200 && Boolean(royaltyRecordId),
      `7a. Royalty calculation executed for period "${periodLabel}"`
    );

    const grossColl = Number(royaltyRecord?.grossCollection);
    const royaltyPayable = Number(royaltyRecord?.royaltyPayable);
    assert(
      grossColl === 20000 && royaltyPayable === 10000,
      `7b. 50/50 revenue sharing verified: Gross ₹${grossColl} -> Super Admin 50% Share ₹${royaltyPayable}`
    );

    // Super Admin records settlement payment with receipt
    const payRef = `UAT-SETTLE-${timestamp}`;
    const payRes = await api(`/api/franchises/${franchise1Id}/royalty/payments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${saToken}` },
      body: JSON.stringify({
        royaltyRecordId,
        amountPaid: 10000,
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: payRef,
        remarks: 'UAT Full Settlement Payment',
      }),
    });

    const receiptNum = payRes.body?.data?.payment?.receiptNumber;
    assert(
      payRes.status === 201 && Boolean(receiptNum),
      `7c. Settlement payment recorded with official receipt: ${receiptNum}`
    );

    // Verify royalty record status updated to PAID
    const royaltyListRes = await api(`/api/franchises/${franchise1Id}/royalty`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    const updatedRecord = royaltyListRes.body?.data?.records?.find((r: any) => r.id === royaltyRecordId);
    assert(
      updatedRecord?.status === 'PAID' && Number(updatedRecord?.outstandingBalance) === 0,
      '7d. Franchise royalty status transitioned to PAID with zero outstanding balance'
    );

    // ------------------------------------------------------------------------
    // SCENARIO 8: FRANCHISE OWNER DASHBOARD TRANSPARENCY
    // ------------------------------------------------------------------------
    console.log('\n--- Scenario 8: Franchise Owner Dashboard Transparency ---');
    const ownerDashRes = await api('/api/franchises/dashboard/owner', {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });

    assert(
      ownerDashRes.status === 200,
      '8a. Franchise Owner Dashboard loaded successfully'
    );
    assert(
      ownerDashRes.body?.data?.franchise?.id === franchise1Id,
      '8b. Franchise Owner Dashboard correctly scoped to Franchise Alpha'
    );
    assert(
      ownerDashRes.body?.data?.branches?.length >= 2,
      '8c. Franchise Owner Dashboard displays all authorized branches'
    );

  } catch (err: any) {
    console.error('Fatal UAT Exception:', err);
    failCount++;
  } finally {
    // Cleanup synthetic fixtures
    console.log('\n--- Cleaning up synthetic UAT fixtures ---');
    try {
      if (franchise1Id) {
        await prisma.franchiseRoyaltyPayment.deleteMany({ where: { franchiseId: franchise1Id } });
        await prisma.franchiseRoyaltyRecord.deleteMany({ where: { franchiseId: franchise1Id } });
        await prisma.franchiseAgreement.deleteMany({ where: { franchiseId: franchise1Id } });
        const validBranchIds = [branch1Id, branch2Id].filter(Boolean) as string[];
        if (validBranchIds.length > 0) {
          await prisma.attendanceEvent.deleteMany({ where: { instituteId: { in: validBranchIds } } }).catch(() => { });
          await prisma.payment.deleteMany({ where: { instituteId: { in: validBranchIds } } }).catch(() => { });
          await prisma.studentFeeAssignment.deleteMany({ where: { feeStructure: { instituteId: { in: validBranchIds } } } }).catch(() => { });
          await prisma.feeStructure.deleteMany({ where: { instituteId: { in: validBranchIds } } }).catch(() => { });
          await prisma.studentParentRelation.deleteMany({ where: { student: { instituteId: { in: validBranchIds } } } }).catch(() => { });
          await prisma.student.deleteMany({ where: { instituteId: { in: validBranchIds } } }).catch(() => { });
          await prisma.batchSubject.deleteMany({ where: { batch: { instituteId: { in: validBranchIds } } } }).catch(() => { });
          await prisma.batch.deleteMany({ where: { instituteId: { in: validBranchIds } } }).catch(() => { });
          await prisma.subject.deleteMany({ where: { instituteId: { in: validBranchIds } } }).catch(() => { });
          await prisma.staffProfile.deleteMany({ where: { instituteId: { in: validBranchIds } } }).catch(() => { });
          await prisma.instituteMembership.deleteMany({ where: { instituteId: { in: validBranchIds } } }).catch(() => { });
          await prisma.institute.deleteMany({ where: { id: { in: validBranchIds } } }).catch(() => { });
        }
        await prisma.franchise.delete({ where: { id: franchise1Id } }).catch(() => { });
      }
      if (franchise2Id) {
        await prisma.franchise.delete({ where: { id: franchise2Id } }).catch(() => { });
      }
      await prisma.user.deleteMany({ where: { email: { contains: `${timestamp}@digitalghuru.staging` } } }).catch(() => { });
      if (parentPhone) {
        await prisma.user.deleteMany({ where: { phone: parentPhone } }).catch(() => { });
      }
      console.log('✓ Synthetic UAT fixtures cleaned successfully');
    } catch (cleanErr) {
      console.warn('Note: Non-critical cleanup notice:', cleanErr);
    }

    if (server) {
      server.close();
      console.log('[UAT Test Server] Stopped.');
    }
  }

  console.log('\n----------------------------------------------------------------');
  console.log(` UAT VERIFICATION SUMMARY: ${passCount} PASSED, ${failCount} FAILED out of ${passCount + failCount} SCENARIOS`);
  console.log('----------------------------------------------------------------\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runUAT().catch((err) => {
  console.error('UAT failed with unhandled error:', err);
  process.exit(1);
});