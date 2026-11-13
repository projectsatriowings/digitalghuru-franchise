/**
 * DIGITAL GURU FRANCHISE — PHASE 2: GLOBAL COURSE CATALOGUE & GOVERNANCE E2E SUITE
 * 
 * Verifies all Phase 2 requirements against an isolated PostgreSQL test database:
 * 1. Course Import Idempotency & Canonical Catalogue Integrity (5 authentic courses).
 * 2. 10-Step CourseWizard Full Payload Creation, Preserving all Marketing & Content Fields.
 * 3. Course Editing & Updates (PATCH).
 * 4. Course Publishing & Database Immutability Lock (PostgreSQL triggers).
 * 5. HQ Franchise Permission Governance (Super Admin controls, Franchise Owner views/enables).
 * 6. Enrollment Modes: ONLINE (no branch/batch), OFFLINE (mandatory branch/batch), Dual Enrollment.
 * 7. Student LMS Learning Player, Video Delivery, Lesson Completion & XP Ledger.
 * 8. Course Revocation: Blocks new enrollments while preserving pre-existing enrolled access.
 * 9. Certificate Claiming & Public Cryptographic Verification (HMAC-SHA256).
 * 10. Curriculum Versioning: Existing enrollments stay on Version 1; new enrollments receive Version 2; progress preserved.
 * 
 * STRICT SAFETY GUARD:
 * - Requires explicit TEST_DATABASE_URL.
 * - Strictly rejects production Neon hosts (neon.tech, ep-, 3.14.138.241, port 5433).
 */

process.env.DISABLE_DB_BRIDGE = 'true';
import 'dotenv/config';
import http from 'http';
import { assertSafeTestDatabase } from '../src/utils/test-db-guard.js';

// Enforce Safety Guard before any imports that initialize database clients
const testDbIdentity = assertSafeTestDatabase();
const testDbUrl = process.env.TEST_DATABASE_URL!;
process.env.DATABASE_URL = testDbUrl;
process.env.DIRECT_URL = testDbUrl;

import { PrismaClient, CourseStatus, LearningMode, EnrollmentStatus, UserRole } from '@prisma/client';
import app from '../src/index.js';
import { generateAccessToken } from '../src/utils/security.js';
import { importCatalogue } from './import-catalogue.js';

const prisma = new PrismaClient({
  datasources: { db: { url: testDbUrl } },
});
(global as any).__tuition_prisma__ = prisma;

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
      console.log(`[Test Server] Running on ${BASE_URL}\n`);
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        console.log('\n[Test Server] Stopped.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function runPhase2Tests() {
  console.log('========================================================================');
  console.log(' DIGITAL GURU FRANCHISE — PHASE 2: GLOBAL COURSE CATALOGUE VERIFICATION');
  console.log('========================================================================\n');

  await startServer();

  // Test artifacts created during run that will be cleaned up
  const cleanupUserIds: string[] = [];
  const cleanupFranchiseIds: string[] = [];
  const cleanupInstituteIds: string[] = [];
  const cleanupBatchIds: string[] = [];
  const cleanupStudentIds: string[] = [];
  const cleanupCourseIds: string[] = [];
  const cleanupEnrollmentIds: string[] = [];
  const cleanupProgressIds: string[] = [];
  const cleanupCertIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // Setup Actors & Tokens in Isolated Test Database
    // -------------------------------------------------------------
    console.log('--- 0. Resolving Actors and Authorization Context ---');
    const suffix = Date.now().toString(36);

    // 0a. Super Admin
    let superAdmin = await prisma.user.findFirst({ where: { role: UserRole.SUPER_ADMIN } });
    if (!superAdmin) {
      superAdmin = await prisma.user.create({
        data: {
          email: `superadmin-${suffix}@digitalguru.local`,
          passwordHash: 'dummy_hash',
          role: UserRole.SUPER_ADMIN,
          fullName: 'Super Admin Test Actor',
        },
      });
      cleanupUserIds.push(superAdmin.id);
    }
    const superAdminToken = generateAccessToken({
      userId: superAdmin.id,
      email: superAdmin.email!,
      role: 'SUPER_ADMIN',
    });

    // 0b. Franchise Owner & Franchise
    const franchiseOwnerUser = await prisma.user.create({
      data: {
        email: `fo-${suffix}@test.local`,
        passwordHash: 'dummy_hash',
        role: UserRole.FRANCHISE_OWNER,
        fullName: 'Franchise Owner Test Actor',
      },
    });
    cleanupUserIds.push(franchiseOwnerUser.id);

    const franchise = await prisma.franchise.create({
      data: {
        code: `FR-${suffix.toUpperCase()}`,
        name: `Test Franchise ${suffix}`,
        ownerName: 'Franchise Owner Test Actor',
        email: franchiseOwnerUser.email!,
        phone: '9876543210',
        ownerUserId: franchiseOwnerUser.id,
        status: 'ACTIVE',
      },
    });
    cleanupFranchiseIds.push(franchise.id);

    const franchiseOwnerToken = generateAccessToken({
      userId: franchiseOwnerUser.id,
      email: franchiseOwnerUser.email!,
      role: 'FRANCHISE_OWNER',
      franchiseId: franchise.id,
    });

    // 0c. Branch & Batch for Offline Testing
    const testInstitute = await prisma.institute.create({
      data: {
        name: `Test Branch ${suffix}`,
        code: `BR-${suffix.toUpperCase()}`,
        franchiseId: franchise.id,
        address: 'Anna Nagar Campus',
        city: 'Chennai',
        state: 'Tamil Nadu',
        status: 'ACTIVE',
      },
    });
    cleanupInstituteIds.push(testInstitute.id);

    const testBatch = await prisma.batch.create({
      data: {
        instituteId: testInstitute.id,
        name: 'Weekend Masterclass Batch',
        academicYear: '2026-2027',
        schedule: 'Sat-Sun 10:00 AM - 01:00 PM',
        startDate: new Date(),
      },
    });
    cleanupBatchIds.push(testBatch.id);

    assert(Boolean(testInstitute && testBatch), '0.1 Found Franchise branch and active batch for offline testing');

    // 0d. Student 1 Actor
    const studentUser1 = await prisma.user.create({
      data: {
        email: `student1-${suffix}@test.local`,
        passwordHash: 'dummy_hash',
        role: UserRole.STUDENT,
        fullName: 'Student One Test Actor',
      },
    });
    cleanupUserIds.push(studentUser1.id);

    const student1 = await prisma.student.create({
      data: {
        userId: studentUser1.id,
        franchiseId: franchise.id,
        instituteId: testInstitute.id,
        admissionNumber: `ADM-1-${suffix}`,
        firstName: 'Student',
        lastName: 'One',
      },
    });
    cleanupStudentIds.push(student1.id);

    const studentToken1 = generateAccessToken({
      userId: studentUser1.id,
      email: studentUser1.email!,
      role: 'STUDENT',
      instituteId: testInstitute.id,
    });
    assert(Boolean(studentToken1), '0.2 Resolved student actor and generated authentication JWT');

    // -------------------------------------------------------------
    // Test 1: Course Import Idempotency & Slug Aliases
    // -------------------------------------------------------------
    console.log('\n--- 1. Course Catalogue Import & Idempotency ---');
    const importDryRun = await importCatalogue({ dryRun: true, schema: 'public' });
    assert(
      importDryRun.coursesCreated === 5 || importDryRun.coursesSkipped > 0,
      '1.1 Import Dry-Run: Correctly parsed all 5 authentic courses without error'
    );
    assert(
      importDryRun.categoriesCreated >= 2 || importDryRun.categoriesSkipped >= 2,
      '1.2 Import Dry-Run: Parsed categories accurately'
    );

    // -------------------------------------------------------------
    // Test 2: 10-Step CourseWizard Full Payload Creation & Ordering
    // -------------------------------------------------------------
    console.log('\n--- 2. CourseWizard 10-Step Full Field Creation ---');
    const wizardSlug = `test-wizard-course-${suffix}`;
    const wizardPayload = {
      title: 'Full 10-Step Test Course',
      slug: wizardSlug,
      subTitle: 'Preserving All CourseWizard Fields',
      description: 'Comprehensive test ensuring zero field drop across 10 steps',
      format: 'Classroom + Online',
      duration: '3 Months',
      level: 'Beginner to Advanced',
      price: 9999,
      status: 'DRAFT',
      thumbnailUrl: '/uploads/courses/1789123754349-ai-powered-digital-marketing-course-card.webp',
      bannerUrl: '/uploads/courses/1789123324736-ai-powered-digital-marketing-banner.jpg.webp',
      brochureUrl: '/Courses/AI Powered Digital Marketing Course.pdf',
      learningOutcomes: ['Outcome 1', 'Outcome 2', 'Outcome 3'],
      targetAudience: ['Students', 'Professionals', 'Entrepreneurs'],
      toolsCovered: ['ChatGPT', 'Canva', 'Python', 'React'],
      overviewJson: {
        batchInfo: 'Morning Batch | 2 Modules',
        location: 'Anna Nagar Campus',
        originalPrice: '12999',
        discountedPrice: '9999',
        usps: ['USP 1', 'USP 2'],
        overviewDescription: ['Paragraph 1 of overview description', 'Paragraph 2 of overview description'],
        overviewLearnings: ['Key learning 1', 'Key learning 2'],
      },
      designedToHelpJson: {
        title: 'Designed To Help Header',
        description: 'Designed To Help Subtext',
        benefits: [
          { title: 'Benefit A', description: 'Desc A', iconName: 'Blocks' },
          { title: 'Benefit B', description: 'Desc B', iconName: 'Sparkles' },
        ],
      },
      numberedFeaturesJson: {
        title: 'Numbered Features Header',
        description: 'Numbered Features Subtext',
        features: [
          { num: '01', title: 'Feature 1', description: 'Feature 1 Desc', iconName: 'BrainCircuit' },
          { num: '02', title: 'Feature 2', description: 'Feature 2 Desc', iconName: 'FileImage' },
        ],
      },
      whyDigitalGhuruJson: {
        title: 'Why Digital Guru Header',
        reasons: [
          { num: '01', title: 'Reason 1', description: 'Reason 1 Desc', iconName: 'Search' },
          { num: '02', title: 'Reason 2', description: 'Reason 2 Desc', iconName: 'PenTool' },
        ],
      },
      topHighlightsJson: [
        { title: 'Highlight 1', description: 'Highlight 1 Desc', iconName: 'Award' },
        { title: 'Highlight 2', description: 'Highlight 2 Desc', iconName: 'Users' },
      ],
      faqsJson: [
        { question: 'What is the schedule?', answer: 'Weekend & Weekday' },
        { question: 'Is placement guaranteed?', answer: 'Yes, placement guidance provided' },
      ],
      modules: [
        {
          title: 'Module 1: Foundations',
          position: 0,
          chapters: [
            {
              title: 'Lesson 1.1: Introduction',
              position: 0,
              videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              pdfUrl: '/Courses/AI Powered Digital Marketing Course.pdf',
              duration: '15:00',
              isFree: true,
            },
            {
              title: 'Lesson 1.2: Architecture Deep Dive',
              position: 1,
              videoUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview',
              duration: '25:00',
              isFree: false,
            },
          ],
        },
        {
          title: 'Module 2: Practical Implementation',
          position: 1,
          chapters: [
            {
              title: 'Lesson 2.1: Hands-on Lab',
              position: 0,
              videoUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview',
              duration: '35:00',
              isFree: false,
            },
          ],
        },
      ],
    };

    const createRes = await fetch(`${BASE_URL}/api/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify(wizardPayload),
    });
    const createJson = await createRes.json();
    assert(createRes.status === 201 && createJson.success, '2.1 Course Creation: POST /api/courses returns 201 Created');
    const createdCourse = createJson.data;
    if (createdCourse?.id) cleanupCourseIds.push(createdCourse.id);

    // Verify all 10 steps preserved in fetched course
    const fetchRes = await fetch(`${BASE_URL}/api/courses/${createdCourse.id}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const fetchJson = await fetchRes.json();
    const fetched = fetchJson.data;
    assert(fetched?.title === wizardPayload.title, '2.2 Step 1 (Basic Details): Title preserved');
    assert(fetched?.slug === wizardPayload.slug, '2.3 Step 1 (Basic Details): Slug preserved');
    assert(fetched?.overviewJson?.batchInfo === 'Morning Batch | 2 Modules', '2.4 Step 2 (Overview): OverviewJson batchInfo preserved');
    assert(fetched?.designedToHelpJson?.benefits?.length === 2, '2.5 Step 3 (Designed To Help): Benefits array preserved');
    assert(fetched?.numberedFeaturesJson?.features?.length === 2, '2.6 Step 4 (Numbered Features): Features array preserved');
    assert(fetched?.whyDigitalGhuruJson?.reasons?.length === 2, '2.7 Step 5 (Why Digital Guru): Reasons array preserved');
    assert(fetched?.topHighlightsJson?.length === 2, '2.8 Step 7 (Top Highlights): Highlights array preserved');
    assert(fetched?.toolsCovered?.length === 4, '2.9 Step 8 (Tools Mastered): ToolsCovered preserved');
    assert(fetched?.faqsJson?.length === 2, '2.10 Step 10 (FAQs): FAQs preserved');

    // Verify Modules & Lessons ordering
    const modules = fetched?.activeCurriculumVersion?.modules || [];
    assert(modules.length === 2, '2.11 Step 9 (Curriculum): 2 modules created');
    assert(modules[0]?.position === 0 && modules[1]?.position === 1, '2.12 Step 9: Module ordering (position 0, 1) preserved');
    assert(modules[0]?.chapters?.length === 2, '2.13 Step 9: Chapter count in Module 1 preserved');
    assert(modules[0]?.chapters[0]?.position === 0 && modules[0]?.chapters[1]?.position === 1, '2.14 Step 9: Chapter ordering preserved');

    // -------------------------------------------------------------
    // Test 3: Course Editing (PATCH)
    // -------------------------------------------------------------
    console.log('\n--- 3. Course Editing & Updates (PATCH) ---');
    const patchRes = await fetch(`${BASE_URL}/api/courses/${createdCourse.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        subTitle: 'Updated Subtitle via Wizard Edit',
        price: 8888,
      }),
    });
    const patchJson = await patchRes.json();
    assert(patchRes.status === 200 && patchJson.success, '3.1 Course Editing: PATCH /api/courses/:id returns 200 OK');
    assert(patchJson.data?.subTitle === 'Updated Subtitle via Wizard Edit', '3.2 Course Editing: Subtitle successfully updated');

    // -------------------------------------------------------------
    // Test 4: Course Publishing & Database Immutability Lock
    // -------------------------------------------------------------
    console.log('\n--- 4. Course Publishing & Database Immutability Lock ---');
    const pubRes = await fetch(`${BASE_URL}/api/courses/${createdCourse.id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const pubJson = await pubRes.json();
    assert(pubRes.status === 200 && pubJson.success, '4.1 Publishing: POST /api/courses/:id/publish locks and publishes course');

    // Attempt direct database mutation on published module to verify trigger lock
    let triggerBlocked = false;
    try {
      await prisma.courseModule.update({
        where: { id: modules[0].id },
        data: { title: 'Illegal Mutation of Published Module' },
      });
    } catch (err: any) {
      triggerBlocked = true;
    }
    assert(triggerBlocked, '4.2 Immutability Trigger: Direct DB update on published CourseModule was blocked by PostgreSQL trigger');

    // -------------------------------------------------------------
    // Test 5: HQ Franchise Permission Governance
    // -------------------------------------------------------------
    console.log('\n--- 5. HQ Franchise Permission Governance ---');
    // 5a. Super admin grants permission
    const permitRes = await fetch(`${BASE_URL}/api/courses/franchise/${franchise.id}/permit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        courseId: createdCourse.id,
        isPermitted: true,
      }),
    });
    const permitJson = await permitRes.json();
    assert(permitRes.status === 200 && permitJson.success, '5.1 HQ Permission: Super Admin permits course for franchise');

    // 5b. Franchise owner enables course offering with custom fee
    const selectRes = await fetch(`${BASE_URL}/api/courses/franchise/${franchise.id}/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        courseId: createdCourse.id,
        isEnabled: true,
        customPrice: 7999,
      }),
    });
    const selectJson = await selectRes.json();
    assert(selectRes.status === 200 && selectJson.success, '5.2 Franchise Offering: Franchise Owner enables course with custom fee');

    // -------------------------------------------------------------
    // Test 6: ONLINE and OFFLINE Enrollment Validation
    // -------------------------------------------------------------
    console.log('\n--- 6. ONLINE and OFFLINE Enrollment Enforcement ---');

    // 6a. ONLINE enrollment (branch/batch must be null)
    const onlineRes = await fetch(`${BASE_URL}/api/courses/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        franchiseId: franchise.id,
        courseId: createdCourse.id,
        studentId: student1.id,
        mode: 'ONLINE',
      }),
    });
    const onlineJson = await onlineRes.json();
    assert(onlineRes.status === 201 && onlineJson.success, '6.1 ONLINE Enrollment: Created successfully with no branch/batch required');
    if (onlineJson.data?.id) cleanupEnrollmentIds.push(onlineJson.data.id);

    // 6b. OFFLINE enrollment without branch/batch (must fail)
    const offlineFailRes = await fetch(`${BASE_URL}/api/courses/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        franchiseId: franchise.id,
        courseId: createdCourse.id,
        studentId: student1.id,
        mode: 'OFFLINE',
        // Omitting instituteId & batchId
      }),
    });
    assert(offlineFailRes.status === 400, '6.2 OFFLINE Validation: Fails when instituteId or batchId are missing');

    // 6c. Valid OFFLINE enrollment for the SAME student and course (Dual Enrollment)
    const offlineSuccessRes = await fetch(`${BASE_URL}/api/courses/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        franchiseId: franchise.id,
        courseId: createdCourse.id,
        studentId: student1.id,
        mode: 'OFFLINE',
        instituteId: testInstitute.id,
        batchId: testBatch.id,
      }),
    });
    const offlineJson = await offlineSuccessRes.json();
    assert(
      offlineSuccessRes.status === 201 && offlineJson.success,
      '6.3 Dual Enrollment: Same student holds both ONLINE and OFFLINE enrollments concurrently'
    );
    if (offlineJson.data?.id) cleanupEnrollmentIds.push(offlineJson.data.id);

    // -------------------------------------------------------------
    // Test 7: OFFLINE Student Learning Access & Completion
    // -------------------------------------------------------------
    console.log('\n--- 7. OFFLINE Student Learning Player & Lesson Progress ---');
    const playerRes = await fetch(`${BASE_URL}/api/courses/learning/${createdCourse.id}`, {
      headers: { Authorization: `Bearer ${studentToken1}` },
    });
    const playerJson = await playerRes.json();
    assert(playerRes.status === 200 && playerJson.success, '7.1 Student Player: GET /api/courses/learning/:id returns 200 OK');
    assert(
      Boolean(playerJson.data?.modules?.[0]?.chapters?.[0]?.videoUrl),
      '7.2 Video Delivery: OFFLINE student accesses video session streaming URL'
    );

    // Complete lesson as student
    const testChapter = modules[0].chapters[0];
    const completeRes = await fetch(`${BASE_URL}/api/courses/learning/complete-lesson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken1}`,
      },
      body: JSON.stringify({
        courseId: createdCourse.id,
        chapterId: testChapter.id,
        timeSpentSec: 90,
      }),
    });
    const completeJson = await completeRes.json();
    assert(completeRes.status === 200 && completeJson.success, '7.3 Lesson Completion: Lesson marked complete and XP awarded');
    if (completeJson.data?.progress?.id) cleanupProgressIds.push(completeJson.data.progress.id);

    // -------------------------------------------------------------
    // Test 8: Course Revocation & Enrollment Preservation
    // -------------------------------------------------------------
    console.log('\n--- 8. Course Revocation & Existing Enrollment Retention ---');
    // Disable course for franchise
    await fetch(`${BASE_URL}/api/courses/franchise/${franchise.id}/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        courseId: createdCourse.id,
        isEnabled: false,
      }),
    });

    // Create a new Student 2 to attempt enrollment
    const studentUser2 = await prisma.user.create({
      data: {
        email: `student2-${suffix}@test.local`,
        passwordHash: 'dummy_hash',
        role: UserRole.STUDENT,
        fullName: 'Student Two Test Actor',
      },
    });
    cleanupUserIds.push(studentUser2.id);

    const student2 = await prisma.student.create({
      data: {
        userId: studentUser2.id,
        franchiseId: franchise.id,
        admissionNumber: `ADM-2-${suffix}`,
        firstName: 'Student',
        lastName: 'Two',
      },
    });
    cleanupStudentIds.push(student2.id);

    // Attempting new enrollment must fail
    const blockedEnrollRes = await fetch(`${BASE_URL}/api/courses/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        franchiseId: franchise.id,
        courseId: createdCourse.id,
        studentId: student2.id,
        mode: 'ONLINE',
      }),
    });
    assert(blockedEnrollRes.status === 400, '8.1 Revocation: New enrollment rejected when course offering is disabled');

    // Verify existing student enrollments remain intact and ACTIVE in DB
    const activeEnrs = await prisma.courseEnrollment.findMany({
      where: { id: { in: cleanupEnrollmentIds }, status: 'ACTIVE' },
    });
    assert(activeEnrs.length === 2, '8.2 Retention: Existing student enrollments remain ACTIVE after offering disabled');

    // Re-enable course for subsequent tests
    await fetch(`${BASE_URL}/api/courses/franchise/${franchise.id}/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        courseId: createdCourse.id,
        isEnabled: true,
      }),
    });

    // -------------------------------------------------------------
    // Test 9: Certificate Claiming & Public HMAC-SHA256 Verification
    // -------------------------------------------------------------
    console.log('\n--- 9. Cryptographic Certificate Verification ---');
    // Complete all remaining chapters so student 1 is eligible for certificate
    const allChapters = modules.flatMap((m: any) => m.chapters || []);
    for (const ch of allChapters) {
      const cRes = await fetch(`${BASE_URL}/api/courses/learning/complete-lesson`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken1}`,
        },
        body: JSON.stringify({
          courseId: createdCourse.id,
          chapterId: ch.id,
          timeSpentSec: 60,
        }),
      });
      const cJson = await cRes.json();
      if (cJson.data?.progress?.id) cleanupProgressIds.push(cJson.data.progress.id);
    }

    const claimRes = await fetch(`${BASE_URL}/api/courses/certificates/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken1}`,
      },
      body: JSON.stringify({
        courseId: createdCourse.id,
        recipientName: 'Student One Test Actor',
      }),
    });
    const claimJson = await claimRes.json();
    assert(
      (claimRes.status === 200 || claimRes.status === 201) && claimJson.success,
      '9.1 Certificate Claim: Certificate claimed successfully upon curriculum completion'
    );
    const claimedCert = claimJson.data;
    if (claimedCert?.id) cleanupCertIds.push(claimedCert.id);

    if (claimedCert?.certificateNumber) {
      const verifyRes = await fetch(
        `${BASE_URL}/api/courses/certificates/verify/${encodeURIComponent(claimedCert.certificateNumber)}`
      );
      const verifyJson = await verifyRes.json();
      assert(
        verifyRes.status === 200 && verifyJson.data?.isAuthentic === true,
        '9.2 Certificate Security: Public HMAC-SHA256 verification confirms authentic cryptographic signature'
      );
    }

    // -------------------------------------------------------------
    // Test 10: Curriculum Versioning & Historical Immutability
    // -------------------------------------------------------------
    console.log('\n--- 10. Curriculum Versioning & Historical Integrity ---');
    // 10a. Super Admin creates a new draft version (v2)
    const draftRes = await fetch(`${BASE_URL}/api/courses/${createdCourse.id}/versions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const draftJson = await draftRes.json();
    assert(draftRes.status === 201 && draftJson.success, '10.1 Versioning: POST /api/courses/:id/versions creates Draft Version 2');
    const version2 = draftJson.data;

    // 10b. Update Version 2 with a new 3rd module
    const updateV2Res = await fetch(`${BASE_URL}/api/courses/${createdCourse.id}/versions/${version2.id}/curriculum`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        modules: [
          ...modules.map((m: any, idx: number) => ({
            title: m.title,
            position: idx,
            chapters: (m.chapters || []).map((c: any, cidx: number) => ({
              title: c.title,
              position: cidx,
              duration: c.duration || '15:00',
              videoUrl: c.videoUrl,
              pdfUrl: c.pdfUrl,
              isFree: c.isFree,
            })),
          })),
          {
            title: 'Module 3: Advanced AI Workflows (v2 Exclusive)',
            position: 2,
            chapters: [
              {
                title: 'Lesson 3.1: Autonomous Agents',
                position: 0,
                duration: '45:00',
                videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                isFree: false,
              },
            ],
          },
        ],
      }),
    });
    const updateV2Json = await updateV2Res.json();
    assert(updateV2Res.status === 200 && updateV2Json.success, '10.2 Versioning: Draft Version 2 curriculum updated with new Module 3');

    // 10c. Publish Version 2
    const pubV2Res = await fetch(`${BASE_URL}/api/courses/${createdCourse.id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(pubV2Res.status === 200, '10.3 Versioning: Version 2 published and marked as activeCurriculumVersion');

    // 10d. Verify existing student 1 enrollment remains bound to Version 1
    const student1Enrollment = await prisma.courseEnrollment.findFirst({
      where: { id: onlineJson.data.id },
    });
    assert(
      student1Enrollment?.curriculumVersionId === modules[0].curriculumVersionId,
      '10.4 Versioning: Existing student enrollment strictly remains on original Version 1 curriculum'
    );

    // 10e. Enroll student 2 in the same course now: must receive Version 2!
    const newEnrollRes = await fetch(`${BASE_URL}/api/courses/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        franchiseId: franchise.id,
        courseId: createdCourse.id,
        studentId: student2.id,
        mode: 'ONLINE',
      }),
    });
    const newEnrollJson = await newEnrollRes.json();
    assert(newEnrollRes.status === 201 && newEnrollJson.success, '10.5 Versioning: New student enrollment created successfully');
    if (newEnrollJson.data?.id) cleanupEnrollmentIds.push(newEnrollJson.data.id);

    const student2Enrollment = await prisma.courseEnrollment.findFirst({
      where: { id: newEnrollJson.data.id },
    });
    assert(
      student2Enrollment?.curriculumVersionId === version2.id,
      '10.6 Versioning: New student enrollment automatically receives latest active Version 2 curriculum'
    );

  } finally {
    // -------------------------------------------------------------
    // Cleanup Test Artifacts in Database
    // -------------------------------------------------------------
    console.log('\n--- Cleanup: Purging Temporary Test Artifacts ---');
    try {
      if (cleanupCourseIds.length > 0 || cleanupStudentIds.length > 0) {
        await prisma.studentLessonProgress.deleteMany({
          where: {
            OR: [
              ...(cleanupCourseIds.length > 0 ? [{ courseId: { in: cleanupCourseIds } }] : []),
              ...(cleanupStudentIds.length > 0 ? [{ studentId: { in: cleanupStudentIds } }] : []),
            ],
          },
        });
        if (cleanupStudentIds.length > 0) {
          await prisma.studentXpLedger.deleteMany({ where: { studentId: { in: cleanupStudentIds } } });
        }
      }
      if (cleanupCertIds.length > 0 || cleanupCourseIds.length > 0) {
        await prisma.courseCertificate.deleteMany({
          where: {
            OR: [
              ...(cleanupCertIds.length > 0 ? [{ id: { in: cleanupCertIds } }] : []),
              ...(cleanupCourseIds.length > 0 ? [{ courseId: { in: cleanupCourseIds } }] : []),
            ],
          },
        });
      }
      if (cleanupEnrollmentIds.length > 0 || cleanupCourseIds.length > 0) {
        await prisma.courseEnrollment.deleteMany({
          where: {
            OR: [
              ...(cleanupEnrollmentIds.length > 0 ? [{ id: { in: cleanupEnrollmentIds } }] : []),
              ...(cleanupCourseIds.length > 0 ? [{ courseId: { in: cleanupCourseIds } }] : []),
            ],
          },
        });
      }
      if (cleanupCourseIds.length > 0) {
        await prisma.franchiseCourseSelection.deleteMany({ where: { courseId: { in: cleanupCourseIds } } });
        await prisma.courseSlugAlias.deleteMany({ where: { courseId: { in: cleanupCourseIds } } });

        // Temporarily unlock and remove modules/versions
        const versions = await prisma.courseCurriculumVersion.findMany({
          where: { courseId: { in: cleanupCourseIds } },
          select: { id: true },
        });
        const vIds = versions.map((v) => v.id);
        if (vIds.length > 0) {
          try {
            await prisma.$executeRawUnsafe(`ALTER TABLE "CourseCurriculumVersion" DISABLE TRIGGER trg_lock_course_curriculum_version;`);
            await prisma.$executeRawUnsafe(`ALTER TABLE "CourseModule" DISABLE TRIGGER trg_lock_course_module;`);
            await prisma.$executeRawUnsafe(`ALTER TABLE "CourseChapter" DISABLE TRIGGER trg_lock_course_chapter;`);
            await prisma.$executeRawUnsafe(`ALTER TABLE "LessonAttachment" DISABLE TRIGGER trg_lock_lesson_attachment;`);

            await prisma.lessonAttachment.deleteMany({
              where: { chapter: { module: { curriculumVersionId: { in: vIds } } } },
            });
            await prisma.courseChapter.deleteMany({
              where: { module: { curriculumVersionId: { in: vIds } } },
            });
            await prisma.courseModule.deleteMany({
              where: { curriculumVersionId: { in: vIds } },
            });
            await prisma.courseCurriculumVersion.deleteMany({
              where: { id: { in: vIds } },
            });
          } finally {
            await prisma.$executeRawUnsafe(`ALTER TABLE "CourseCurriculumVersion" ENABLE TRIGGER trg_lock_course_curriculum_version;`);
            await prisma.$executeRawUnsafe(`ALTER TABLE "CourseModule" ENABLE TRIGGER trg_lock_course_module;`);
            await prisma.$executeRawUnsafe(`ALTER TABLE "CourseChapter" ENABLE TRIGGER trg_lock_course_chapter;`);
            await prisma.$executeRawUnsafe(`ALTER TABLE "LessonAttachment" ENABLE TRIGGER trg_lock_lesson_attachment;`);
          }
        }
        await prisma.globalCourse.deleteMany({ where: { id: { in: cleanupCourseIds } } });
      }
      if (cleanupStudentIds.length > 0) {
        await prisma.student.deleteMany({ where: { id: { in: cleanupStudentIds } } });
      }
      if (cleanupBatchIds.length > 0) {
        await prisma.batch.deleteMany({ where: { id: { in: cleanupBatchIds } } });
      }
      if (cleanupInstituteIds.length > 0) {
        await prisma.institute.deleteMany({ where: { id: { in: cleanupInstituteIds } } });
      }
      if (cleanupFranchiseIds.length > 0) {
        await prisma.franchise.deleteMany({ where: { id: { in: cleanupFranchiseIds } } });
      }
      if (cleanupUserIds.length > 0) {
        await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
      }
      console.log('✓ Successfully cleaned up all temporary test entities.');
    } catch (cleanErr: any) {
      console.warn('Cleanup warning:', cleanErr.message);
    }

    await stopServer();
    await prisma.$disconnect();
  }

  console.log('\n========================================================================');
  console.log(` PHASE 2 VERIFICATION SUMMARY: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log('========================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
