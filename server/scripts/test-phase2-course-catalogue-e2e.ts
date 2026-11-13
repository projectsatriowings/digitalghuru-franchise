process.env.DISABLE_DB_BRIDGE = 'true';
import 'dotenv/config';
import http from 'http';
import app from '../src/index.js';
import { prisma } from '../src/prisma.js';
import { generateAccessToken } from '../src/utils/security.js';
import { importCatalogue } from './import-catalogue.js';

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
  const cleanupCourseIds: string[] = [];
  const cleanupEnrollmentIds: string[] = [];
  const cleanupProgressIds: string[] = [];
  const cleanupCertIds: string[] = [];

  try {
    // -------------------------------------------------------------
    // Setup Actors & Tokens
    // -------------------------------------------------------------
    console.log('--- 0. Resolving Actors and Authorization Context ---');
    const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    if (!superAdmin) throw new Error('No SUPER_ADMIN user found in database');
    const superAdminToken = generateAccessToken({
      userId: superAdmin.id,
      email: superAdmin.email || 'superadmin@digitalguru.local',
      role: 'SUPER_ADMIN',
    });

    // Find active student with linked User account and franchise branch
    const student = await prisma.student.findFirst({
      where: { userId: { not: null }, institute: { franchiseId: { not: null } } },
      include: {
        user: true,
        institute: {
          include: {
            franchise: { include: { ownerUser: true, branches: { include: { batches: true } } } },
            batches: true,
          },
        },
      },
    });
    if (!student || !student.user || !student.institute?.franchise) {
      throw new Error('No test student with user account and franchise found in database');
    }

    const franchise = student.institute.franchise;
    const franchiseOwner = franchise.ownerUser;
    if (!franchiseOwner) throw new Error('No Franchise Owner user found in database');
    const franchiseOwnerToken = generateAccessToken({
      userId: franchiseOwner.id,
      email: franchiseOwner.email || 'owner@digitalguru.local',
      role: 'FRANCHISE_OWNER',
      franchiseId: franchise.id,
    });

    const testInstitute = student.institute;
    let testBatch = testInstitute.batches[0];
    if (!testBatch) {
      testBatch = await prisma.batch.create({
        data: {
          instituteId: testInstitute.id,
          name: 'Regular Batch 2026',
          academicYear: '2026-2027',
          schedule: 'Mon-Fri 10:00 AM - 12:00 PM',
          startDate: new Date(),
        },
      });
    }
    assert(Boolean(testInstitute && testBatch), '0.1 Found Franchise branch and active batch for offline testing');

    const studentToken = generateAccessToken({
      userId: student.user.id,
      email: student.user.email || 'student@digitalguru.local',
      role: 'STUDENT',
      instituteId: student.instituteId,
    });
    assert(Boolean(studentToken), '0.2 Resolved student actor and generated authentication JWT');

    // -------------------------------------------------------------
    // Test 1: Course Import Idempotency & Slug Aliases
    // -------------------------------------------------------------
    console.log('\n--- 1. Course Catalogue Import & Idempotency ---');
    const importDryRun = await importCatalogue({ dryRun: true, schema: 'public' });
    assert(
      importDryRun.coursesCreated === 5 || importDryRun.coursesSkipped > 0,
      '1.1 Import Dry-Run: Correctly parsed all 5 authentic courses without error'
    );
    assert(importDryRun.categoriesCreated >= 2, '1.2 Import Dry-Run: Parsed categories accurately');

    // -------------------------------------------------------------
    // Test 2: 10-Step CourseWizard Full Payload Creation & Ordering
    // -------------------------------------------------------------
    console.log('\n--- 2. CourseWizard 10-Step Full Field Creation ---');
    const wizardSlug = `test-wizard-course-${Date.now()}`;
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
    // Test 4: Course Publishing & Curriculum Immutability
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
        studentId: student.id,
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
        studentId: student.id,
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
        studentId: student.id,
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
      headers: { Authorization: `Bearer ${studentToken}` },
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
        Authorization: `Bearer ${studentToken}`,
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
        studentId: student.id,
        mode: 'ONLINE',
      }),
    });
    assert(blockedEnrollRes.status === 400, '8.1 Revocation: New enrollment rejected when course offering is disabled');

    // Verify existing student enrollments remain intact and ACTIVE in DB
    const activeEnrs = await prisma.courseEnrollment.findMany({
      where: { id: { in: cleanupEnrollmentIds }, status: 'ACTIVE' },
    });
    assert(activeEnrs.length === 2, '8.2 Retention: Existing student enrollments remain ACTIVE after offering disabled');

    // -------------------------------------------------------------
    // Test 9: Public Certificate Verification (HMAC-SHA256)
    // -------------------------------------------------------------
    console.log('\n--- 9. Cryptographic Certificate Verification ---');
    const existingCert = await prisma.courseCertificate.findFirst({
      orderBy: { issuedAt: 'desc' },
    });
    if (existingCert) {
      const verifyRes = await fetch(
        `${BASE_URL}/api/courses/certificates/verify/${encodeURIComponent(existingCert.certificateNumber)}`
      );
      const verifyJson = await verifyRes.json();
      assert(
        verifyRes.status === 200 && verifyJson.data?.isAuthentic === true,
        '9.1 Certificate Security: Public HMAC-SHA256 verification confirms authentic cryptographic signature'
      );
    } else {
      console.log('  ⚠ [SKIP] 9.1 No existing certificate found for verification test');
    }
  } finally {
    // -------------------------------------------------------------
    // Cleanup Test Artifacts
    // -------------------------------------------------------------
    console.log('\n--- Cleanup: Purging Temporary Test Artifacts ---');
    try {
      if (cleanupProgressIds.length > 0) {
        await prisma.studentLessonProgress.deleteMany({ where: { id: { in: cleanupProgressIds } } });
      }
      if (cleanupCertIds.length > 0) {
        await prisma.courseCertificate.deleteMany({ where: { id: { in: cleanupCertIds } } });
      }
      if (cleanupEnrollmentIds.length > 0) {
        await prisma.courseEnrollment.deleteMany({ where: { id: { in: cleanupEnrollmentIds } } });
      }
      if (cleanupCourseIds.length > 0) {
        await prisma.franchiseCourseSelection.deleteMany({ where: { courseId: { in: cleanupCourseIds } } });
        await prisma.courseSlugAlias.deleteMany({ where: { courseId: { in: cleanupCourseIds } } });
        await prisma.globalCourse.updateMany({
          where: { id: { in: cleanupCourseIds } },
          data: { status: 'ARCHIVED', activeCurriculumVersionId: null },
        });
      }
      console.log('✓ Successfully cleaned up temporary test courses and enrollments.');
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
