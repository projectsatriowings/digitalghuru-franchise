import * as http from 'http';
import { prisma } from '../src/prisma.js';
import { generateAccessToken } from '../src/utils/security.js';

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

const BASE_URL = 'http://127.0.0.1:5000';

async function run() {
  console.log('================================================================');
  console.log(' DIGITAL GURU FRANCHISE: MILESTONE 2 COURSE ENGINE API TEST');
  console.log('================================================================\n');

  try {
    // 1. Health check
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200 && healthJson.status === 'healthy', '1. System Health: /api/health reports healthy with Neon PostgreSQL', healthJson);

    // 2. Resolve or Seed Test Users
    console.log('\n--- Resolving Test Actors ---');
    // Super Admin
    const superAdminUser = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });
    assert(!!superAdminUser, '2a. Super Admin user found in database');
    const superAdminToken = generateAccessToken({
      userId: superAdminUser!.id,
      email: superAdminUser!.email || 'superadmin@platform.local',
      role: 'SUPER_ADMIN',
    });

    // Franchise Owner
    const franchiseOwner = await prisma.user.findFirst({
      where: {
        role: 'FRANCHISE_OWNER',
        ownedFranchises: {
          some: {
            branches: {
              some: {}
            }
          }
        }
      },
      include: {
        ownedFranchises: {
          include: { branches: true },
        },
      },
    });
    assert(!!franchiseOwner && franchiseOwner.ownedFranchises.length > 0, '2b. Franchise Owner found with registered franchise');
    const franchise = franchiseOwner!.ownedFranchises[0];
    const franchiseOwnerToken = generateAccessToken({
      userId: franchiseOwner!.id,
      email: franchiseOwner!.email || 'owner@franchise.local',
      role: 'FRANCHISE_OWNER',
      franchiseId: franchise.id,
    });

    // Student actor (under this franchise's branch)
    let branch = franchise.branches[0];
    assert(!!branch, '2c. Franchise branch campus identified');

    let student = await prisma.student.findFirst({
      where: { instituteId: branch.id, status: 'ACTIVE' },
      include: { user: true },
    });

    if (!student || !student.user) {
      // Find any student in system and link to branch
      student = await prisma.student.findFirst({
        where: { status: 'ACTIVE', userId: { not: null } },
        include: { user: true },
      });
      if (student) {
        await prisma.student.update({
          where: { id: student.id },
          data: { instituteId: branch.id }
        });
        student.instituteId = branch.id;
      }
    }
    assert(!!student && !!student.user, '2d. Active student actor resolved with linked user login');

    const studentToken = generateAccessToken({
      userId: student!.user!.id,
      email: student!.user!.email || 'student@test.local',
      role: 'STUDENT',
      instituteId: student!.instituteId,
    });

    // Offline Batch
    const studentInstituteId = student!.instituteId!;
    let batch = await prisma.batch.findFirst({
      where: { instituteId: studentInstituteId, isActive: true },
    });
    if (!batch) {
      batch = await prisma.batch.create({
        data: {
          instituteId: studentInstituteId,
          name: 'Morning Batch Alpha (2026)',
          academicYear: '2026-2027',
          schedule: 'Mon-Fri 10:00 AM - 12:00 PM',
          startDate: new Date(),
        },
      });
    }
    assert(!!batch, `2e. Active offline batch resolved: "${batch.name}"`);

    // 3. Test Category CRUD
    console.log('\n--- 3. Testing Course Category CRUD ---');
    const catSlug = `cat-test-${Date.now()}`;
    const createCatRes = await fetch(`${BASE_URL}/api/courses/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: `AI & Digital Marketing ${Date.now()}`,
        slug: catSlug,
        description: 'Comprehensive courses on digital growth, performance marketing, and generative AI.',
        icon: 'TrendingUp',
      }),
    });
    const createCatJson = await createCatRes.json();
    assert(createCatRes.status === 201 && createCatJson.success, '3a. Super Admin created course category successfully', createCatJson);
    const categoryId = createCatJson.data.id;

    const listCatRes = await fetch(`${BASE_URL}/api/courses/categories`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const listCatJson = await listCatRes.json();
    assert(listCatRes.status === 200 && listCatJson.data.some((c: any) => c.id === categoryId), '3b. Category listed in /api/courses/categories');

    // 4. Test Course Creation (All 10 Wizard Steps Data)
    console.log('\n--- 4. Testing Global Course Creation (10-Step Wizard Payload) ---');
    const courseSlug = `ai-marketing-test-${Date.now()}`;
    const createCourseRes = await fetch(`${BASE_URL}/api/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        title: 'AI-Powered Digital Marketing Masterclass',
        slug: courseSlug,
        categoryId,
        subtitle: 'The Next Generation Marketing & AI Suite',
        description: 'Learn modern marketing strategies powered by generative AI, automation, and real-time campaign analytics.',
        duration: '12 Weeks',
        format: 'Classroom + AI Lab',
        originalPrice: 45000,
        discountedPrice: 24999,
        location: 'Anna Nagar, Chennai & Online',
        batchInfo: 'Weekday & Weekend Batches Available',
        cardImage: '/uploads/courses/thumbnails/sample-card.webp',
        bannerImage: '/uploads/courses/banners/sample-hero.webp',
        brochureUrl: '/uploads/courses/brochures/syllabus.pdf',
        status: 'DRAFT',
        marketingData: {
          overviewDescription: [
            'Digital marketing combined with AI is rapidly transforming how businesses grow and compete.',
            'Gain hands-on proficiency in search, paid social, generative content, and data analytics.',
          ],
          overviewLearnings: [
            'Master Google Ads and Meta Ads Manager with AI targeting.',
            'Automate copywriting using custom GPT models and Midjourney.',
            'Build full-funnel conversion workflows with Zapier.',
          ],
          designedToHelp: {
            title: 'This course is designed to help you',
            description: 'Transform from a traditional marketer to an AI-empowered digital leader.',
            benefits: [
              { title: '100% Practical Labs', description: 'Real client ad budgets and live campaign execution.' },
              { title: 'Industry Certifications', description: 'Dual certification from Digital Guru & partner hubs.' },
            ],
          },
          numberedFeatures: {
            title: 'Course Highlights',
            features: [
              { number: '01', title: 'Generative AI Workflows', subtitle: 'Modern Tooling', description: 'Learn prompt engineering for marketing.' },
              { number: '02', title: 'Live Client Campaigns', subtitle: 'Real ROI', description: 'Run paid search and social campaigns.' },
            ],
          },
          whyDigitalGhuru: {
            title: 'Why Learn With Us',
            reasons: [
              { number: '1', title: 'Expert Faculty', subtitle: 'Agency Leaders', description: 'Taught by working CMOs and practitioners.' },
            ],
          },
          whoIsThisForData: [
            { role: 'College Graduates', background: 'Any Degree', description: 'Fast-track your entry into high-growth tech marketing.' },
            { role: 'Business Owners', background: 'Entrepreneurs', description: 'Scale customer acquisition with zero agency fees.' },
          ],
          highlightsData: [
            { stat: '100%', label: 'Practical Labs', description: 'Zero theory exams' },
            { stat: '1:1', label: 'Mentorship', description: 'Weekly portfolio reviews' },
          ],
          tools: ['ChatGPT', 'Canva', 'Google Ads', 'Meta Ads', 'Zapier'],
          faqs: [
            { question: 'Do I need prior coding knowledge?', answer: 'No coding is required. The curriculum focuses on AI tools and growth marketing.' },
          ],
        },
        modules: [
          {
            title: 'Module 1: Foundations of AI Marketing & Audience Research',
            description: 'Understanding the modern digital ecosystem.',
            position: 0,
            lessons: [
              {
                title: 'Lesson 1.1: Introduction to Generative AI in Marketing',
                videoUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview',
                duration: '15:20',
                pdfUrl: '/uploads/courses/materials/lesson1-notes.pdf',
                position: 0,
                isFree: true,
              },
              {
                title: 'Lesson 1.2: Customer Journey & Funnel Architecture',
                videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                duration: '22:45',
                position: 1,
                isFree: false,
              },
            ],
          },
          {
            title: 'Module 2: Search Engine & Meta Ad Automation',
            position: 1,
            lessons: [
              {
                title: 'Lesson 2.1: Google Performance Max Campaigns',
                videoUrl: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/preview',
                duration: '18:10',
                position: 0,
                isFree: false,
              },
            ],
          },
        ],
      }),
    });

    const createCourseJson = await createCourseRes.json();
    assert(createCourseRes.status === 201 && createCourseJson.success, '4a. Super Admin created global course with 10-step wizard data', createCourseJson);
    const courseId = createCourseJson.data.id;

    // 5. Verify Course Details & Curriculum
    console.log('\n--- 5. Verifying Course Hierarchy & Modules ---');
    const getCourseRes = await fetch(`${BASE_URL}/api/courses/${courseId}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const getCourseJson: any = await getCourseRes.json();
    if (!getCourseJson.data) {
      console.error('DEBUG getCourseJson failed:', getCourseRes.status, getCourseJson);
    }
    assert(getCourseRes.status === 200 && getCourseJson.data && getCourseJson.data.modules.length === 2, '5a. Course retrieved with 2 modules', getCourseJson);
    assert(getCourseJson.data.modules[0].chapters.length === 2, '5b. Module 1 contains 2 chapters with Drive & YouTube links');
    const firstChapterId = getCourseJson.data.modules[0].chapters[0].id;

    // 6. Test Publishing Course
    console.log('\n--- 6. Publishing Course ---');
    const publishRes = await fetch(`${BASE_URL}/api/courses/${courseId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'PUBLISHED' }),
    });
    const publishJson = await publishRes.json();
    assert(publishRes.status === 200 && publishJson.data.status === 'PUBLISHED', '6a. Course transitioned from DRAFT to PUBLISHED');

    // 7. Franchise Course Selection
    console.log('\n--- 7. Testing Franchise Course Selection ---');
    const selectRes = await fetch(`${BASE_URL}/api/courses/franchise/${franchise.id}/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({ courseId, isEnabled: true }),
    });
    const selectJson = await selectRes.json();
    assert(selectRes.status === 200 && selectJson.success, '7a. Franchise Owner enabled course offering for franchise center', selectJson);

    // 8. Offline Student Enrollment (Core Requirement)
    console.log('\n--- 8. Testing OFFLINE Student Course Enrollment ---');
    const enrollRes = await fetch(`${BASE_URL}/api/courses/enroll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${franchiseOwnerToken}`,
      },
      body: JSON.stringify({
        studentId: student!.id,
        courseId,
        mode: 'OFFLINE',
        instituteId: student!.instituteId,
        batchId: batch!.id,
      }),
    });
    const enrollJson = await enrollRes.json();
    assert(enrollRes.status === 201 && enrollJson.success, '8a. Student successfully enrolled in OFFLINE mode with batch & campus', enrollJson);
    assert(enrollJson.data.mode === 'OFFLINE' && enrollJson.data.batchId === batch!.id, '8b. Enrollment verified as OFFLINE with allocated classroom batch');

    // 9. Universal Course Player Access for OFFLINE Student
    console.log('\n--- 9. Testing Student Video Player Access (OFFLINE Student) ---');
    const playerRes = await fetch(`${BASE_URL}/api/courses/learning/${courseId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const playerJson = await playerRes.json();
    assert(playerRes.status === 200 && playerJson.success, '9a. OFFLINE student authorized to access online recorded course player!', playerJson);
    assert(playerJson.data.enrollmentContext.mode === 'OFFLINE', '9b. Player payload preserves student mode as OFFLINE');
    assert(playerJson.data.enrollmentContext.batchName === batch!.name, '9c. Player payload provides offline batch name context');
    assert(playerJson.data.modules[0].lessons[0].videoUrl.includes('drive.google.com'), '9d. Recorded Google Drive session URL delivered to offline student');
    assert(playerJson.data.modules[0].lessons[1].videoUrl.includes('youtube.com'), '9e. Recorded YouTube session URL delivered to offline student');

    // 10. Database-Enforced Idempotent Lesson Completion & XP Grant
    console.log('\n--- 10. Testing Idempotent Lesson Completion & XP ---');
    const userBefore = await prisma.user.findUnique({ where: { id: student!.user!.id } });
    const initialXp = userBefore?.xpPoints || 0;

    // First completion
    const complete1Res = await fetch(`${BASE_URL}/api/courses/learning/complete-lesson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ courseId, chapterId: firstChapterId }),
    });
    const complete1Json = await complete1Res.json();
    assert(complete1Res.status === 200 && complete1Json.data.xpEarned === 10, '10a. First-time lesson completion awards +10 XP', complete1Json);

    const userAfter1 = await prisma.user.findUnique({ where: { id: student!.user!.id } });
    assert(userAfter1?.xpPoints === initialXp + 10, `10b. User XP incremented accurately (${initialXp} -> ${userAfter1?.xpPoints})`);

    // Replay / duplicate completion attempt
    const complete2Res = await fetch(`${BASE_URL}/api/courses/learning/complete-lesson`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ courseId, chapterId: firstChapterId }),
    });
    const complete2Json = await complete2Res.json();
    assert(complete2Res.status === 200 && complete2Json.data.xpEarned === 0 && complete2Json.data.alreadyCompleted === true, '10c. Replayed lesson completion detects existing record: 0 XP awarded (Idempotent)', complete2Json);

    const userAfter2 = await prisma.user.findUnique({ where: { id: student!.user!.id } });
    assert(userAfter2?.xpPoints === userAfter1?.xpPoints, '10d. User XP remains unchanged after duplicate completion request (No double XP)');

    // 11. Safe Deletion Boundary Check
    console.log('\n--- 11. Testing Deletion Boundary Protection ---');
    const deleteAttemptRes = await fetch(`${BASE_URL}/api/courses/${courseId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const deleteAttemptJson = await deleteAttemptRes.json();
    assert(deleteAttemptRes.status === 400 && deleteAttemptJson.error.includes('existing student enrollment'), '11a. Hard deletion blocked: Course with active enrollments cannot be deleted (Prompts archive)', deleteAttemptJson);

    // 12. Offline Academic Workflow Continuity Check
    console.log('\n--- 12. Verifying Offline Academic Operations Intact ---');
    const batchCheck = await prisma.batch.findUnique({
      where: { id: batch!.id },
      include: { enrollments: true, institute: true },
    });
    assert(!!batchCheck && batchCheck.isActive === true, '12a. Physical classroom batch remains active and intact');
    const studentCheck = await prisma.student.findUnique({
      where: { id: student!.id },
      include: { institute: true },
    });
    assert(studentCheck?.instituteId === branch.id, '12b. Student physical campus association remains unchanged');

    // Safe test tear-down: archive test course and revoke franchise offering to keep live catalog clean
    if (courseId) {
      await prisma.franchiseCourseSelection.updateMany({
        where: { courseId },
        data: { isPermitted: false, isEnabled: false }
      }).catch(() => {});
      await prisma.globalCourse.update({
        where: { id: courseId },
        data: { status: CourseStatus.ARCHIVED }
      }).catch(() => {});
    }

    console.log('\n================================================================');
    console.log(` TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('================================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test run failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
