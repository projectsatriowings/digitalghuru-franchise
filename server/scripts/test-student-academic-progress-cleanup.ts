import { PrismaClient } from '@prisma/client';
import { listReviews } from '../src/modules/reviews/reviews.controller.js';
import { listProgressFeedback, getStudentFeedback } from '../src/modules/progress/progress.controller.js';
import { AuthenticatedRequest } from '../src/middleware/auth.js';

const prisma = new PrismaClient();

// Mock Express Response helper
function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
  };
  return res;
}

async function runRegressionSuite() {
  console.log('================================================================');
  console.log('   TUITIONOS — STUDENT ACADEMIC PROGRESS CLEANUP VERIFICATION   ');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (detail) console.error('       Detail:', detail);
      failed++;
    }
  }

  try {
    // 1. Fetch active Institute & Students
    const institute = await prisma.institute.findFirst();
    if (!institute) throw new Error('No institute found in database.');

    const students = await prisma.student.findMany({
      where: { instituteId: institute.id, user: { isNot: null } },
      include: { user: true },
      take: 2,
    });

    if (students.length < 2) {
      throw new Error('Need at least 2 active students in database for cross-student probing tests.');
    }

    const studentA = students[0];
    const studentB = students[1];

    console.log(`[INFO] Student A: ${studentA.firstName} ${studentA.lastName} (${studentA.id})`);
    console.log(`[INFO] Student B: ${studentB.firstName} ${studentB.lastName} (${studentB.id})\n`);

    // Fetch or create a Parent user for verification
    const parentRelation = await prisma.studentParentRelation.findFirst({
      where: { studentId: studentA.id },
      include: { parent: { include: { user: true } } },
    });
    const parentUser = parentRelation?.parent?.user;

    // Fetch a Staff user for verification
    const staffMembership = await prisma.instituteMembership.findFirst({
      where: { instituteId: institute.id, role: { in: ['STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'] } },
      include: { user: true },
    });
    const staffUser = staffMembership?.user;

    // Record initial database counts
    const initialProgressCount = await prisma.progressFeedback.count();
    const initialReviewCount = await prisma.parentReview.count();

    // -------------------------------------------------------------
    // TEST 1: Student cannot access private parent inquiries via type=FEEDBACK
    // -------------------------------------------------------------
    {
      const req: any = {
        instituteId: institute.id,
        user: { userId: studentA.user.id, role: 'STUDENT' },
        query: { type: 'FEEDBACK' },
      };
      const res = createMockResponse();
      await listReviews(req, res);

      assert(
        res.statusCode === 403 && res.body?.success === false,
        'TEST 1: Student GET /reviews?type=FEEDBACK is blocked with HTTP 403 Forbidden',
        res.body
      );
    }

    // -------------------------------------------------------------
    // TEST 2: Student cannot access inquiries via type=ALL
    // -------------------------------------------------------------
    {
      const req: any = {
        instituteId: institute.id,
        user: { userId: studentA.user.id, role: 'STUDENT' },
        query: { type: 'ALL' },
      };
      const res = createMockResponse();
      await listReviews(req, res);

      assert(
        res.statusCode === 403 && res.body?.success === false,
        'TEST 2: Student GET /reviews?type=ALL is blocked with HTTP 403 Forbidden',
        res.body
      );
    }

    // -------------------------------------------------------------
    // TEST 3: Student accessing testimonials returns ONLY published testimonials
    // -------------------------------------------------------------
    {
      const req: any = {
        instituteId: institute.id,
        user: { userId: studentA.user.id, role: 'STUDENT' },
        query: { type: 'TESTIMONIAL' },
      };
      const res = createMockResponse();
      await listReviews(req, res);

      const returnedReviews = res.body?.data?.reviews || [];
      const hasUnpublished = returnedReviews.some((r: any) => !r.isPublished || r.type !== 'TESTIMONIAL');

      assert(
        res.statusCode === 200 && !hasUnpublished,
        'TEST 3: Student GET /reviews?type=TESTIMONIAL returns strictly published testimonials only',
        { count: returnedReviews.length, hasUnpublished }
      );
    }

    // -------------------------------------------------------------
    // TEST 4: Student GET /progress returns ONLY own published progress reports
    // -------------------------------------------------------------
    {
      const req: any = {
        instituteId: institute.id,
        user: { userId: studentA.user.id, role: 'STUDENT' },
        query: {},
      };
      const res = createMockResponse();
      await listProgressFeedback(req, res);

      const returnedReports = res.body?.data?.feedbacks || [];
      const hasOtherStudent = returnedReports.some((fb: any) => fb.studentId !== studentA.id);
      const hasUnpublished = returnedReports.some((fb: any) => !fb.isPublished);

      assert(
        res.statusCode === 200 && !hasOtherStudent && !hasUnpublished,
        'TEST 4: Student GET /progress returns strictly published reports belonging to authenticated student',
        { count: returnedReports.length, hasOtherStudent, hasUnpublished }
      );
    }

    // -------------------------------------------------------------
    // TEST 5: Student querying another student via GET /progress?studentId=... is blocked with 403
    // -------------------------------------------------------------
    {
      const req: any = {
        instituteId: institute.id,
        user: { userId: studentA.user.id, role: 'STUDENT' },
        query: { studentId: studentB.id },
      };
      const res = createMockResponse();
      await listProgressFeedback(req, res);

      assert(
        res.statusCode === 403 && res.body?.success === false,
        'TEST 5: Student cross-student query GET /progress?studentId=OTHER is blocked with HTTP 403 Forbidden',
        res.body
      );
    }

    // -------------------------------------------------------------
    // TEST 6: Student querying another student via GET /progress/students/:studentId is blocked with 403
    // -------------------------------------------------------------
    {
      const req: any = {
        instituteId: institute.id,
        user: { userId: studentA.user.id, role: 'STUDENT' },
        params: { studentId: studentB.id },
      };
      const res = createMockResponse();
      await getStudentFeedback(req, res);

      assert(
        res.statusCode === 403 && res.body?.success === false,
        'TEST 6: Student route query GET /progress/students/OTHER is blocked with HTTP 403 Forbidden',
        res.body
      );
    }

    // -------------------------------------------------------------
    // TEST 7: Parent can still access private inquiries (workflow preserved)
    // -------------------------------------------------------------
    if (parentUser) {
      const req: any = {
        instituteId: institute.id,
        user: { userId: parentUser.id, role: 'PARENT' },
        query: { type: 'FEEDBACK' },
      };
      const res = createMockResponse();
      await listReviews(req, res);

      assert(
        res.statusCode === 200 && res.body?.success === true,
        'TEST 7: Parent inquiry workflow remains intact (GET /reviews?type=FEEDBACK -> HTTP 200)',
        { count: res.body?.data?.reviews?.length }
      );
    } else {
      console.log('[SKIP] TEST 7: No parent user found in test institute.');
    }

    // -------------------------------------------------------------
    // TEST 8: Staff can still access progress reports (workflow preserved)
    // -------------------------------------------------------------
    if (staffUser) {
      const req: any = {
        instituteId: institute.id,
        user: { userId: staffUser.id, role: 'STAFF' },
        query: {},
      };
      const res = createMockResponse();
      await listProgressFeedback(req, res);

      assert(
        res.statusCode === 200 && res.body?.success === true,
        'TEST 8: Staff progress review workflow remains intact (GET /progress -> HTTP 200)',
        { count: res.body?.data?.feedbacks?.length }
      );
    } else {
      console.log('[SKIP] TEST 8: No staff user found in test institute.');
    }

    // -------------------------------------------------------------
    // TEST 9: Database integrity check (zero deletions)
    // -------------------------------------------------------------
    const finalProgressCount = await prisma.progressFeedback.count();
    const finalReviewCount = await prisma.parentReview.count();

    assert(
      finalProgressCount === initialProgressCount && finalReviewCount === initialReviewCount,
      'TEST 9: Zero database records altered or deleted during security evaluation',
      { progressDelta: finalProgressCount - initialProgressCount, reviewDelta: finalReviewCount - initialReviewCount }
    );

    console.log('\n================================================================');
    console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('[UNEXPECTED ERROR]', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runRegressionSuite();
