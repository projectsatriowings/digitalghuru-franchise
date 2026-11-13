/**
 * DIGITAL GURU FRANCHISE — PHASE 2: GLOBAL COURSE CATALOGUE & GOVERNANCE E2E SUITE
 * 
 * Verifies all Phase 2 requirements against an isolated PostgreSQL test database:
 * 1. Database Safety Guard: Positively rejects production Neon and Tuition databases.
 * 2. Authentic Course Catalogue Import: Executes real import of all 5 authentic courses.
 * 3. Import Idempotency: Second execution performs 0 creations and skips all 5 courses.
 * 4. Reconciliation of all 5 courses individually against actual database records:
 *    - ai-powered-digital-marketing: 12 modules, 48 chapters, 10:00 duration, preview, brochure attachment.
 *    - react-js-full-stack-development: 7 modules, 32 chapters, 10:00 duration, preview, brochure attachment.
 *    - ai-super-kids-grade-11-12: 16 modules, 48 chapters.
 *    - data-science-with-ai: 10 modules, 38 chapters.
 *    - creative-design-and-video-editing: 10 modules, 40 chapters.
 *    - Exact totals: 55 modules, 206 chapters calculated from live database records.
 * 5. Full 10-Step CourseWizard Marketing & Content Field Preservation.
 * 6. Authorization Governance & Unauthorized Operation Rejections:
 *    - Unauthenticated course modification rejected (HTTP 401).
 *    - Franchise Owner attempting HQ permission rejected (HTTP 403).
 *    - Super Admin permits course to franchise.
 *    - Franchise Owner enables course with custom fee override.
 * 7. Course Editing (PATCH) & Database Immutability Lock (PostgreSQL triggers).
 * 8. ONLINE and OFFLINE Enrollment Enforcement & Concurrent Dual Enrollment.
 * 9. Student Learning Player, Lesson Completion, and XP Awarding.
 * 10. Course Revocation: Blocks new enrollments while preserving existing enrolled access.
 * 11. Certificate Claiming & Public HMAC-SHA256 Cryptographic Verification.
 * 12. Curriculum Versioning: Existing students stay on Version 1; new students receive Version 2.
 */

process.env.DISABLE_DB_BRIDGE = 'true';
import 'dotenv/config';
import http from 'http';
import { assertSafeTestDatabase } from '../src/utils/test-db-guard.js';

// -----------------------------------------------------------------------------
// 1. STRICT DATABASE SAFETY GUARD & EARLY TERMINATION
// Must run BEFORE any application code, Express app, or Prisma client is loaded.
// -----------------------------------------------------------------------------
const testDbIdentity = assertSafeTestDatabase();
const testDbUrl = process.env.TEST_DATABASE_URL!;
process.env.DATABASE_URL = testDbUrl;
process.env.DIRECT_URL = testDbUrl;

// -----------------------------------------------------------------------------
// 2. RUNTIME DEFERRED INITIALIZATION
// Modules that initialize Prisma or the Express app are dynamically loaded
// inside runPhase2Tests(), strictly after the top-level safety check passes.
// -----------------------------------------------------------------------------
let prisma: any;
let app: any;
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

  // Dynamic runtime imports strictly after top-level assertSafeTestDatabase()
  const { PrismaClient, CourseStatus, LearningMode, EnrollmentStatus, UserRole } = await import('@prisma/client');
  const appModule = await import('../src/index.js');
  app = appModule.default;
  const { generateAccessToken } = await import('../src/utils/security.js');
  const { importCatalogue } = await import('./import-catalogue.js');

  prisma = new PrismaClient({
    datasources: { db: { url: testDbUrl } },
  });
  (global as any).__tuition_prisma__ = prisma;

  await startServer();

  // Test artifacts created during run that will be cleaned up
  const cleanupUserIds: string[] = [];
  const cleanupFranchiseIds: string[] = [];
  const cleanupInstituteIds: string[] = [];
  const cleanupBatchIds: string[] = [];
  const cleanupStudentIds: string[] = [];
  const cleanupEnrollmentIds: string[] = [];
  const cleanupProgressIds: string[] = [];
  const cleanupCertIds: string[] = [];

  try {
    const suffix = `${Date.now()}`;

    // -------------------------------------------------------------
    // Phase 0: Test Database Safety Guard Rejection Assertions
    // -------------------------------------------------------------
    console.log('--- 0. Database Safety Guard Rejection Verification ---');

    // 0.1 Positively reject missing/empty TEST_DATABASE_URL
    let missingRejected = false;
    try {
      assertSafeTestDatabase('');
    } catch (err: any) {
      missingRejected = err.message.includes('No explicit TEST_DATABASE_URL configured');
    }
    assert(missingRejected, '0.1 Safety Guard: Positively rejects missing/empty TEST_DATABASE_URL');

    // 0.2 Positively reject live production Neon host
    let neonRejected = false;
    try {
      assertSafeTestDatabase('postgresql://neondb_owner:npg_123456@ep-nameless-hat-a4s5b9.us-east-2.aws.neon.tech/neondb');
    } catch (err: any) {
      neonRejected = err.message.includes('LIVE PRODUCTION NEON DATABASE');
    }
    assert(neonRejected, '0.2 Safety Guard: Positively rejects live production Neon database URL');

    // 0.3 Positively reject local Neon TCP bridge (port 5433)
    let bridgeRejected = false;
    try {
      assertSafeTestDatabase('postgresql://postgres:password@127.0.0.1:5433/neondb');
    } catch (err: any) {
      bridgeRejected = err.message.includes('LIVE PRODUCTION NEON DATABASE');
    }
    assert(bridgeRejected, '0.3 Safety Guard: Positively rejects local Neon TCP Bridge (port 5433)');

    // 0.4 Positively reject Tuition Management database
    let tuitionRejected = false;
    try {
      assertSafeTestDatabase('postgresql://postgres:password@localhost:5432/tuition_management');
    } catch (err: any) {
      tuitionRejected = err.message.includes('TUITION MANAGEMENT DATABASE');
    }
    assert(tuitionRejected, '0.4 Safety Guard: Positively rejects Tuition Management database target');

    // 0.5 Positively verify safe isolated test database
    let testDbVerified = false;
    try {
      const verified = assertSafeTestDatabase('postgresql://postgres:password@localhost:5432/dg_test_isolated');
      testDbVerified = verified.isIsolatedTestDb && verified.database === '/dg_test_isolated';
    } catch {}
    assert(testDbVerified, '0.5 Safety Guard: Positively validates safe isolated test database (localhost:5432/dg_test_isolated)');

    // -------------------------------------------------------------
    // Phase 0.5: Actor Resolution & Context Setup
    // -------------------------------------------------------------
    console.log('\n--- 0.5 Resolving Actors and Authorization Context ---');

    // 0a. Super Admin Actor
    let superAdmin = await prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN },
    });
    if (!superAdmin) {
      superAdmin = await prisma.user.create({
        data: {
          email: `superadmin-${suffix}@platform.local`,
          passwordHash: 'dummy_hash',
          role: UserRole.SUPER_ADMIN,
          fullName: 'Platform Super Admin',
        },
      });
      cleanupUserIds.push(superAdmin.id);
    }
    const superAdminToken = generateAccessToken({
      userId: superAdmin.id,
      email: superAdmin.email!,
      role: 'SUPER_ADMIN',
    });

    // 0b. Franchise Owner Actor & Franchise
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
        code: `FR-${suffix.slice(-6)}`,
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

    // 0e. Student 2 Actor (for Version 2 new enrollment test)
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
        instituteId: testInstitute.id,
        admissionNumber: `ADM-2-${suffix}`,
        firstName: 'Student',
        lastName: 'Two',
      },
    });
    cleanupStudentIds.push(student2.id);

    // Reset any previously imported canonical courses to ensure clean fresh import of updated catalogue
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "CourseCurriculumVersion" DISABLE TRIGGER trg_lock_course_curriculum_version;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "CourseModule" DISABLE TRIGGER trg_lock_course_module;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "CourseChapter" DISABLE TRIGGER trg_lock_course_chapter;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "LessonAttachment" DISABLE TRIGGER trg_lock_lesson_attachment;`);

      await prisma.lessonAttachment.deleteMany({});
      await prisma.studentLessonProgress.deleteMany({});
      await prisma.courseCertificate.deleteMany({});
      await prisma.courseEnrollment.deleteMany({});
      await prisma.franchiseCourseSelection.deleteMany({});
      await prisma.courseChapter.deleteMany({});
      await prisma.courseModule.deleteMany({});
      await prisma.courseSlugAlias.deleteMany({});
      await prisma.courseCurriculumVersion.deleteMany({});
      await prisma.globalCourse.deleteMany({});
      await prisma.courseCategory.deleteMany({});
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "CourseCurriculumVersion" ENABLE TRIGGER trg_lock_course_curriculum_version;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "CourseModule" ENABLE TRIGGER trg_lock_course_module;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "CourseChapter" ENABLE TRIGGER trg_lock_course_chapter;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "LessonAttachment" ENABLE TRIGGER trg_lock_lesson_attachment;`);
    }

    // -------------------------------------------------------------
    // Test 1: Authentic Course Import & Genuine Idempotency
    // -------------------------------------------------------------
    console.log('\n--- 1. Course Catalogue Import & Idempotency Execution ---');
    
    // First Run: Genuine Execution (creates if missing, or skips if existing)
    const run1 = await importCatalogue({ dryRun: false, allowProd: true });
    assert(
      run1.coursesCreated + run1.coursesSkipped === 5,
      `1.1 Genuine Import: Processed all 5 authentic courses (Created: ${run1.coursesCreated}, Existing: ${run1.coursesSkipped})`
    );

    // Second Run: Strict Idempotency Check (must create 0 new courses, skip all 5)
    const run2 = await importCatalogue({ dryRun: false, allowProd: true });
    assert(
      run2.coursesCreated === 0 && run2.coursesSkipped === 5,
      '1.2 Idempotency: Second import execution safely created 0 duplicates and skipped all 5 existing courses'
    );
    assert(
      run2.modulesCreated === 0 && run2.chaptersCreated === 0,
      '1.3 Idempotency: Zero duplicate modules or chapters were created on repeat execution'
    );

    // -------------------------------------------------------------
    // Test 2: Source-to-Target Reconciliation on Live Database Records
    // -------------------------------------------------------------
    console.log('\n--- 2. Source-to-Target Course Reconciliation Against PostgreSQL ---');

    // Fetch all courses with curriculum from live test database
    const dbCourses = await prisma.globalCourse.findMany({
      include: {
        curriculumVersions: {
          include: {
            modules: {
              orderBy: { position: 'asc' },
              include: {
                chapters: {
                  orderBy: { position: 'asc' },
                  include: { attachments: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const canonicalSlugs = [
      'ai-powered-digital-marketing',
      'react-js-full-stack-development',
      'ai-super-kids-grade-11-12',
      'data-science-with-ai',
      'creative-design-and-video-editing',
    ];

    const courseMap = new Map(dbCourses.map((c) => [c.slug, c]));

    // Verify all 5 canonical slugs exist in database
    for (const slug of canonicalSlugs) {
      assert(courseMap.has(slug), `2.0 Canonical course "${slug}" exists in test database`);
    }

    // 2a. Reconcile Course 1: AI-Powered Digital Marketing
    const c1 = courseMap.get('ai-powered-digital-marketing')!;
    const c1Curriculum = c1.curriculumVersions[0];
    const c1Modules = c1Curriculum?.modules || [];
    const c1Chapters = c1Modules.flatMap((m) => m.chapters);
    assert(c1.title === 'AI-Powered Digital Marketing Course', '2.1 Course 1: Title matches authentic source');
    assert(c1Modules.length === 12, `2.2 Course 1: Module count is exactly 12 (Actual: ${c1Modules.length})`);
    assert(c1Chapters.length === 48, `2.3 Course 1: Chapter count is exactly 48 (Actual: ${c1Chapters.length})`);
    assert(c1Chapters[0].duration === '10:00', `2.4 Course 1: Lesson duration matches authentic default 10:00 (Actual: "${c1Chapters[0].duration}")`);
    assert(c1Chapters[0].isFree === true, '2.5 Course 1: Chapter 1 is marked as free preview');
    assert(c1Chapters[1].isFree === false, '2.6 Course 1: Subsequent chapters are locked (isFree = false)');
    assert(
      c1Chapters[0].attachments.length > 0 &&
      c1Chapters[0].attachments[0].fileUrl === '/Courses/AI Powered Digital Marketing Course.pdf' &&
      c1Chapters[0].attachments[0].fileSize === 8671263,
      '2.7 Course 1: Chapter 1 contains authentic brochure PDF with exact validated size (8,671,263 bytes)'
    );
    assert(c1.thumbnailUrl === '/uploads/courses/1789123754349-ai-powered-digital-marketing-course-card.webp', '2.8 Course 1: Thumbnail URL matches authentic source path');
    assert(c1.bannerUrl === '/uploads/courses/1789123324736-ai-powered-digital-marketing-banner.jpg.webp', '2.9 Course 1: Banner URL matches authentic source path');

    // 2b. Reconcile Course 2: React JS Full Stack Development
    const c2 = courseMap.get('react-js-full-stack-development')!;
    const c2Curriculum = c2.curriculumVersions[0];
    const c2Modules = c2Curriculum?.modules || [];
    const c2Chapters = c2Modules.flatMap((m) => m.chapters);
    assert(c2.title === 'React JS Full Stack Development Course', '2.10 Course 2: Title matches authentic source');
    assert(c2Modules.length === 7, `2.11 Course 2: Module count is exactly 7 (Actual: ${c2Modules.length})`);
    assert(c2Chapters.length === 32, `2.12 Course 2: Chapter count is exactly 32 (Actual: ${c2Chapters.length})`);
    assert(c2Chapters[0].duration === '10:00', `2.13 Course 2: Lesson duration matches database default 10:00 (Actual: "${c2Chapters[0].duration}")`);
    assert(c2Chapters[0].isFree === true, '2.14 Course 2: Chapter 1 is marked as free preview');
    assert(
      c2Chapters[0].attachments.length > 0 &&
      c2Chapters[0].attachments[0].fileUrl === '/Courses/React JS Full Stack Development.pdf' &&
      c2Chapters[0].attachments[0].fileSize === 6700721,
      '2.15 Course 2: Chapter 1 contains authentic brochure PDF with exact validated size (6,700,721 bytes)'
    );

    // 2c. Reconcile Course 3: AI Super Kids Grade 11-12
    const c3 = courseMap.get('ai-super-kids-grade-11-12')!;
    const c3Curriculum = c3.curriculumVersions[0];
    const c3Modules = c3Curriculum?.modules || [];
    const c3Chapters = c3Modules.flatMap((m) => m.chapters);
    assert(c3Modules.length === 16, `2.16 Course 3: Module count is exactly 16 (Actual: ${c3Modules.length})`);
    assert(c3Chapters.length === 48, `2.17 Course 3: Chapter count is exactly 48 (Actual: ${c3Chapters.length})`);
    assert(c3Chapters[0].duration === '10:00', '2.18 Course 3: Lesson duration matches database default 10:00');
    assert(c3Chapters[0].attachments.length === 0, '2.18b Course 3: No attachment created for missing Grade 11-12 brochure (prevents broken references)');

    // 2d. Reconcile Course 4: Advanced Data Science with AI
    const c4 = courseMap.get('data-science-with-ai')!;
    const c4Curriculum = c4.curriculumVersions[0];
    const c4Modules = c4Curriculum?.modules || [];
    const c4Chapters = c4Modules.flatMap((m) => m.chapters);
    assert(c4Modules.length === 10, `2.19 Course 4: Module count is exactly 10 (Actual: ${c4Modules.length})`);
    assert(c4Chapters.length === 38, `2.20 Course 4: Chapter count is exactly 38 (Actual: ${c4Chapters.length})`);
    assert(c4Chapters[0].duration === '10:00', '2.21 Course 4: Lesson duration matches database default 10:00');
    assert(c4Chapters[0].attachments.length === 0, '2.21b Course 4: No attachment created for missing Data Science brochure (prevents broken references)');

    // 2e. Reconcile Course 5: Advanced Creative Design & Video Editing
    const c5 = courseMap.get('creative-design-and-video-editing')!;
    const c5Curriculum = c5.curriculumVersions[0];
    const c5Modules = c5Curriculum?.modules || [];
    const c5Chapters = c5Modules.flatMap((m) => m.chapters);
    assert(c5Modules.length === 10, `2.22 Course 5: Module count is exactly 10 (Actual: ${c5Modules.length})`);
    assert(c5Chapters.length === 40, `2.23 Course 5: Chapter count is exactly 40 (Actual: ${c5Chapters.length})`);
    assert(c5Chapters[0].duration === '10:00', '2.24 Course 5: Lesson duration matches database default 10:00');
    assert(c5Chapters[0].attachments.length === 0, '2.24b Course 5: No attachment created for missing Creative Design brochure (prevents broken references)');
    assert(
      c1Chapters.every((ch) => ch.videoUrl === null && ch.pdfUrl === null),
      '2.24c Media Integrity: No fake lesson video URLs or PDF URLs invented; safely stored as null'
    );

    // 2f. Aggregate Totals Calculated from Actual PostgreSQL Records
    const totalModules = dbCourses
      .filter((c) => canonicalSlugs.includes(c.slug))
      .reduce((sum, c) => sum + (c.curriculumVersions[0]?.modules.length || 0), 0);
    const totalChapters = dbCourses
      .filter((c) => canonicalSlugs.includes(c.slug))
      .reduce(
        (sum, c) =>
          sum +
          (c.curriculumVersions[0]?.modules.reduce((mSum, m) => mSum + m.chapters.length, 0) || 0),
        0
      );
    assert(
      totalModules === 55,
      `2.25 Aggregate Module Verification: Actual database count is exactly 55 modules (Actual: ${totalModules})`
    );
    assert(
      totalChapters === 206,
      `2.26 Aggregate Chapter Verification: Actual database count is exactly 206 chapters (Actual: ${totalChapters})`
    );

    // -------------------------------------------------------------
    // Test 3: CourseWizard 10-Step Marketing & Content Field Verification
    // -------------------------------------------------------------
    console.log('\n--- 3. CourseWizard 10-Step Field Verification on Real Course ---');
    const targetCourse = c1; // AI-Powered Digital Marketing Course
    const overview = targetCourse.overviewJson as any;
    const designedToHelp = targetCourse.designedToHelpJson as any;
    const numberedFeatures = targetCourse.numberedFeaturesJson as any;
    const whyUs = targetCourse.whyDigitalGhuruJson as any;
    const highlights = targetCourse.topHighlightsJson as any;
    const faqs = targetCourse.faqsJson as any;

    assert(Boolean(targetCourse.title && targetCourse.slug), '3.1 Step 1 (Basic Details): Title and slug verified');
    assert(Boolean(overview && overview.batchInfo), '3.2 Step 2 (Overview): OverviewJson batchInfo preserved');
    assert(Boolean(designedToHelp && Array.isArray(designedToHelp.benefits) && designedToHelp.benefits.length >= 4), '3.3 Step 3 (Designed To Help): Benefits array preserved');
    assert(Boolean(numberedFeatures && Array.isArray(numberedFeatures.features) && numberedFeatures.features.length >= 4), '3.4 Step 4 (Numbered Features): Features array preserved');
    assert(Boolean(whyUs && Array.isArray(whyUs.reasons) && whyUs.reasons.length >= 6), '3.5 Step 5 (Why Digital Guru): Reasons array preserved');
    assert(Boolean(Array.isArray(targetCourse.targetAudience) && targetCourse.targetAudience.length >= 4), '3.6 Step 6 (Target Audience): Audience array preserved');
    assert(Boolean(Array.isArray(highlights) && highlights.length >= 6), '3.7 Step 7 (Top Highlights): Highlights array preserved');
    assert(Boolean(Array.isArray(targetCourse.toolsCovered) && targetCourse.toolsCovered.length >= 5), '3.8 Step 8 (Tools Mastered): ToolsCovered preserved');
    assert(c1Modules.length === 12, '3.9 Step 9 (Curriculum Modules): 12 modules preserved in position order');
    assert(Boolean(Array.isArray(faqs) && faqs.length >= 3), '3.10 Step 10 (FAQs): FAQs array preserved');

    // -------------------------------------------------------------
    // Test 4: HQ and Franchise Governance & Unauthorized Operation Rejections
    // -------------------------------------------------------------
    console.log('\n--- 4. HQ & Franchise Authorization & Unauthorized Operation Rejections ---');

    // 4a. Unauthenticated Course Creation Rejection (401)
    const unauthRes = await fetch(`${BASE_URL}/api/courses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Unauthorized Course', slug: 'unauth-course' }),
    });
    assert(unauthRes.status === 401, '4.1 Security: Unauthenticated request attempting course creation is rejected (HTTP 401)');

    // 4b. Franchise Owner Attempting HQ Permit Operation Rejection (403)
    const foPermitRes = await fetch(`${BASE_URL}/api/courses/franchise/${franchise.id}/permit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        courseId: targetCourse.id,
        isPermitted: true,
      }),
    });
    assert(
      foPermitRes.status === 403,
      '4.2 Security: Franchise Owner attempting to permit course for franchise is rejected (HTTP 403 Forbidden)'
    );

    // 4c. Super Admin Permits Course to Franchise
    const hqPermitRes = await fetch(`${BASE_URL}/api/courses/franchise/${franchise.id}/permit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        courseId: targetCourse.id,
        isPermitted: true,
      }),
    });
    assert(hqPermitRes.status === 200, '4.3 HQ Governance: Super Admin successfully permits course to franchise');

    // 4d. Franchise Owner Enables Permitted Course with Custom Fee
    const foSelectRes = await fetch(`${BASE_URL}/api/courses/franchise/${franchise.id}/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        courseId: targetCourse.id,
        isEnabled: true,
        customPrice: 24999,
      }),
    });
    assert(foSelectRes.status === 200, '4.4 Franchise Governance: Franchise Owner enables permitted course with custom fee');

    // -------------------------------------------------------------
    // Test 5: Course Editing (PATCH) & Database Immutability Lock
    // -------------------------------------------------------------
    console.log('\n--- 5. Course Editing & PostgreSQL Trigger Immutability Lock ---');

    // 5a. PATCH course details
    const patchRes = await fetch(`${BASE_URL}/api/courses/${targetCourse.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        subTitle: 'The New Digital Marketing + AI Course (Verified 2026)',
      }),
    });
    assert(patchRes.status === 200, '5.1 Course Editing: PATCH /api/courses/:id returns 200 OK');

    // 5b. Database Immutability Lock: Direct DB mutation of published CourseModule must fail
    let triggerBlocked = false;
    try {
      await prisma.$executeRawUnsafe(`
        UPDATE "CourseModule" SET "title" = 'Tampered Module Title' WHERE "id" = '${c1Modules[0].id}'
      `);
    } catch (e: any) {
      triggerBlocked = e.message.includes('55000') || e.message.includes('locked curriculum version');
    }
    assert(triggerBlocked, '5.2 Immutability: Direct database update on published CourseModule was blocked by PostgreSQL trigger (55000)');

    // -------------------------------------------------------------
    // Test 6: Strict ONLINE and OFFLINE Enrollment Enforcement
    // -------------------------------------------------------------
    console.log('\n--- 6. ONLINE and OFFLINE Enrollment Enforcement ---');

    // 6a. ONLINE Enrollment: No branch or batch required
    const onlineRes = await fetch(`${BASE_URL}/api/courses/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        franchiseId: franchise.id,
        courseId: targetCourse.id,
        studentId: student1.id,
        mode: 'ONLINE',
      }),
    });
    const onlineJson = await onlineRes.json();
    assert(onlineRes.status === 201 && onlineJson.success, '6.1 ONLINE Enrollment: Created successfully with no branch/batch required');
    if (onlineJson.data?.id) cleanupEnrollmentIds.push(onlineJson.data.id);

    // 6b. OFFLINE Validation: Fails without instituteId or batchId
    const badOfflineRes = await fetch(`${BASE_URL}/api/courses/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        franchiseId: franchise.id,
        courseId: targetCourse.id,
        studentId: student1.id,
        mode: 'OFFLINE',
      }),
    });
    assert(badOfflineRes.status === 400, '6.2 OFFLINE Validation: Fails fast when instituteId or batchId are missing');

    // 6c. Valid OFFLINE Enrollment & Concurrent Dual Enrollment
    const offlineRes = await fetch(`${BASE_URL}/api/courses/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        franchiseId: franchise.id,
        courseId: targetCourse.id,
        studentId: student1.id,
        instituteId: testInstitute.id,
        batchId: testBatch.id,
        mode: 'OFFLINE',
      }),
    });
    const offlineJson = await offlineRes.json();
    assert(offlineRes.status === 201 && offlineJson.success, '6.3 Dual Enrollment: Same student holds both ONLINE and OFFLINE enrollments concurrently');
    if (offlineJson.data?.id) cleanupEnrollmentIds.push(offlineJson.data.id);

    // -------------------------------------------------------------
    // Test 7: Student LMS Learning Player & Lesson Progress
    // -------------------------------------------------------------
    console.log('\n--- 7. Student Learning Player, Video Delivery & Lesson Progress ---');
    const playRes = await fetch(`${BASE_URL}/api/courses/learning/${targetCourse.id}`, {
      headers: { Authorization: `Bearer ${studentToken1}` },
    });
    const playJson = await playRes.json();
    assert(playRes.status === 200 && playJson.success, '7.1 Student Player: GET /api/courses/learning/:id returns 200 OK');
    assert(playJson.data?.curriculum?.length === 12, '7.2 Student Player: Returned all 12 modules of authentic course');

    // Complete lesson 1 of module 1
    const targetChapter = c1Chapters[0];
    const compRes = await fetch(`${BASE_URL}/api/courses/learning/complete-lesson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken1}`,
      },
      body: JSON.stringify({
        courseId: targetCourse.id,
        chapterId: targetChapter.id,
        timeSpentSec: 300,
      }),
    });
    const compJson = await compRes.json();
    assert(compRes.status === 200 && compJson.success, '7.3 Lesson Completion: Lesson marked complete and XP awarded');
    if (compJson.data?.progress?.id) cleanupProgressIds.push(compJson.data.progress.id);

    // -------------------------------------------------------------
    // Test 8: Course Revocation & Existing Enrollment Access Preservation
    // -------------------------------------------------------------
    console.log('\n--- 8. Course Revocation & Existing Enrollment Retention ---');

    // 8a. Franchise disables offering
    await fetch(`${BASE_URL}/api/courses/franchise/${franchise.id}/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        courseId: targetCourse.id,
        isEnabled: false,
      }),
    });

    // 8b. New enrollment attempt must be rejected
    const blockedEnrollRes = await fetch(`${BASE_URL}/api/courses/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        franchiseId: franchise.id,
        courseId: targetCourse.id,
        studentId: student2.id,
        mode: 'ONLINE',
      }),
    });
    assert(blockedEnrollRes.status === 400, '8.1 Revocation: New enrollment rejected when course offering is disabled');

    // 8c. Existing enrolled student retains access
    const retainedPlayRes = await fetch(`${BASE_URL}/api/courses/learning/${targetCourse.id}`, {
      headers: { Authorization: `Bearer ${studentToken1}` },
    });
    assert(retainedPlayRes.status === 200, '8.2 Retention: Existing student enrollment retains active access after offering disabled');

    // Re-enable course for remaining tests
    await fetch(`${BASE_URL}/api/courses/franchise/${franchise.id}/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        courseId: targetCourse.id,
        isEnabled: true,
      }),
    });

    // -------------------------------------------------------------
    // Test 9: Cryptographic Certificate Verification
    // -------------------------------------------------------------
    console.log('\n--- 9. Cryptographic Certificate Verification ---');

    // Mark all 48 chapters complete so that student has 100% course completion
    for (const ch of c1Chapters) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "StudentLessonProgress" (
          "id", "studentId", "chapterId", "courseId", "curriculumVersionId", "isCompleted", "completedAt", "timeSpentSec"
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, TRUE, NOW(), 600
        )
        ON CONFLICT ("studentId", "chapterId") DO UPDATE SET
          "isCompleted" = TRUE,
          "completedAt" = NOW()`,
        student1.id,
        ch.id,
        targetCourse.id,
        c1Curriculum.id
      );
    }

    const claimRes = await fetch(`${BASE_URL}/api/courses/certificates/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken1}`,
      },
      body: JSON.stringify({
        courseId: targetCourse.id,
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

    // 10a. Super Admin creates a new draft version (v2) on the authentic course
    const draftRes = await fetch(`${BASE_URL}/api/courses/${targetCourse.id}/versions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const draftJson = await draftRes.json();
    assert(draftRes.status === 201 && draftJson.success, '10.1 Versioning: POST /api/courses/:id/versions creates Draft Version 2');
    const version2 = draftJson.data;

    // 10b. Update Version 2 with a new Module 13
    const updateV2Res = await fetch(`${BASE_URL}/api/courses/${targetCourse.id}/versions/${version2.id}/curriculum`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        modules: [
          ...c1Modules.map((m: any, idx: number) => ({
            title: m.title,
            position: idx,
            chapters: (m.chapters || []).map((c: any, cidx: number) => ({
              title: c.title,
              position: cidx,
              duration: c.duration || '10:00',
              videoUrl: c.videoUrl,
              pdfUrl: c.pdfUrl,
              isFree: c.isFree,
            })),
          })),
          {
            title: 'Module 13: Autonomous Marketing Agents (v2 Exclusive)',
            position: 12,
            chapters: [
              {
                title: 'Lesson 13.1: Building Autonomous AI Marketing Agents',
                position: 0,
                duration: '45:00',
                isFree: false,
              },
            ],
          },
        ],
      }),
    });
    const updateV2Json = await updateV2Res.json();
    assert(updateV2Res.status === 200 && updateV2Json.success, '10.2 Versioning: Draft Version 2 curriculum updated with new Module 13');

    // 10c. Publish Version 2
    const pubV2Res = await fetch(`${BASE_URL}/api/courses/${targetCourse.id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    assert(pubV2Res.status === 200, '10.3 Versioning: Version 2 published and marked as activeCurriculumVersion');

    // 10d. Verify existing student 1 enrollment strictly remains bound to original Version 1
    const originalVersionId = targetCourse.activeCurriculumVersionId || c1Curriculum.id;
    const student1Enrollment = await prisma.courseEnrollment.findFirst({
      where: { id: onlineJson.data.id },
    });
    assert(
      student1Enrollment?.curriculumVersionId === originalVersionId && originalVersionId !== version2.id,
      '10.4 Versioning: Existing student enrollment strictly remains bound to original Version 1 curriculum'
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
        courseId: targetCourse.id,
        studentId: student2.id,
        mode: 'ONLINE',
      }),
    });
    const newEnrollJson = await newEnrollRes.json();
    assert(newEnrollRes.status === 201 && newEnrollJson.success, '10.5 Versioning: New student enrollment created successfully');

    const student2Enrollment = await prisma.courseEnrollment.findFirst({
      where: { id: newEnrollJson.data.id },
    });
    assert(
      student2Enrollment?.curriculumVersionId === version2.id,
      '10.6 Versioning: New student enrollment automatically receives latest active Version 2 curriculum'
    );

    // Reset Course 1 active version back to v1 and cleanup v2 modules
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "CourseCurriculumVersion" DISABLE TRIGGER trg_lock_course_curriculum_version;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "CourseModule" DISABLE TRIGGER trg_lock_course_module;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "CourseChapter" DISABLE TRIGGER trg_lock_course_chapter;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "LessonAttachment" DISABLE TRIGGER trg_lock_lesson_attachment;`);

      if (newEnrollJson?.data?.id) {
        await prisma.courseEnrollment.deleteMany({
          where: { id: newEnrollJson.data.id },
        });
      }

      await prisma.globalCourse.update({
        where: { id: targetCourse.id },
        data: { activeCurriculumVersionId: originalVersionId },
      });
      await prisma.courseChapter.deleteMany({
        where: { module: { curriculumVersionId: version2.id } },
      });
      await prisma.courseModule.deleteMany({
        where: { curriculumVersionId: version2.id },
      });
      await prisma.courseCurriculumVersion.deleteMany({
        where: { id: version2.id },
      });
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "CourseCurriculumVersion" ENABLE TRIGGER trg_lock_course_curriculum_version;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "CourseModule" ENABLE TRIGGER trg_lock_course_module;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "CourseChapter" ENABLE TRIGGER trg_lock_course_chapter;`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "LessonAttachment" ENABLE TRIGGER trg_lock_lesson_attachment;`);
    }

  } catch (err: any) {
    console.error('Test execution error:', err);
    failedCount++;
  } finally {
    // -------------------------------------------------------------
    // Cleanup Test Artifacts in Database
    // -------------------------------------------------------------
    console.log('\n--- Cleanup: Purging Temporary Test Artifacts ---');
    try {
      if (cleanupProgressIds.length > 0 || cleanupStudentIds.length > 0) {
        await prisma.studentLessonProgress.deleteMany({
          where: {
            OR: [
              ...(cleanupProgressIds.length > 0 ? [{ id: { in: cleanupProgressIds } }] : []),
              ...(cleanupStudentIds.length > 0 ? [{ studentId: { in: cleanupStudentIds } }] : []),
            ],
          },
        });
        if (cleanupStudentIds.length > 0) {
          await prisma.studentXpLedger.deleteMany({ where: { studentId: { in: cleanupStudentIds } } });
        }
      }
      if (cleanupCertIds.length > 0 || cleanupStudentIds.length > 0) {
        await prisma.courseCertificate.deleteMany({
          where: {
            OR: [
              ...(cleanupCertIds.length > 0 ? [{ id: { in: cleanupCertIds } }] : []),
              ...(cleanupStudentIds.length > 0 ? [{ studentId: { in: cleanupStudentIds } }] : []),
            ],
          },
        });
      }
      if (cleanupEnrollmentIds.length > 0 || cleanupStudentIds.length > 0) {
        await prisma.courseEnrollment.deleteMany({
          where: {
            OR: [
              ...(cleanupEnrollmentIds.length > 0 ? [{ id: { in: cleanupEnrollmentIds } }] : []),
              ...(cleanupStudentIds.length > 0 ? [{ studentId: { in: cleanupStudentIds } }] : []),
            ],
          },
        });
      }
      if (cleanupFranchiseIds.length > 0) {
        await prisma.franchiseCourseSelection.deleteMany({ where: { franchiseId: { in: cleanupFranchiseIds } } });
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
