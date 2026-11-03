import { listReviews } from '../src/modules/reviews/reviews.controller.js';
import { listProgressFeedback, getStudentFeedback } from '../src/modules/progress/progress.controller.js';
import { prisma } from '../src/prisma.js';

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

async function runUnitSecurityTests() {
  console.log('================================================================');
  console.log('   TUITIONOS — STUDENT PROGRESS & REVIEWS SECURITY SUITE        ');
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

  const dummyInstituteId = 'inst-1111-2222-3333';
  const studentA = { id: 'student-aaa', userId: 'user-student-aaa' };
  const studentB = { id: 'student-bbb', userId: 'user-student-bbb' };

  // Mock prisma functions
  (prisma.student as any).findFirst = async (args: any) => {
    if (args?.where?.userId === studentA.userId) {
      return { id: studentA.id, userId: studentA.userId, instituteId: dummyInstituteId };
    }
    if (args?.where?.userId === studentB.userId) {
      return { id: studentB.id, userId: studentB.userId, instituteId: dummyInstituteId };
    }
    return null;
  };

  (prisma.parentReview as any).findMany = async (args: any) => {
    // Return dummy reviews according to args.where
    return [
      { id: 'rev-1', type: args.where.type, isPublished: args.where.isPublished, reviewText: 'Great center!' },
    ];
  };

  (prisma.progressFeedback as any).findMany = async (args: any) => {
    return [
      { id: 'prog-1', studentId: args.where.studentId, isPublished: args.where.isPublished, termName: 'Term 1' },
    ];
  };

  // -------------------------------------------------------------
  // TEST 1: Student cannot access private parent inquiries via type=FEEDBACK
  // -------------------------------------------------------------
  {
    const req: any = {
      instituteId: dummyInstituteId,
      user: { userId: studentA.userId, role: 'STUDENT' },
      query: { type: 'FEEDBACK' },
    };
    const res = createMockResponse();
    await listReviews(req, res);

    assert(
      res.statusCode === 403 && res.body?.success === false,
      'TEST 1: Student GET /reviews?type=FEEDBACK returns HTTP 403 Forbidden',
      res.body
    );
  }

  // -------------------------------------------------------------
  // TEST 2: Student cannot access inquiries via type=ALL
  // -------------------------------------------------------------
  {
    const req: any = {
      instituteId: dummyInstituteId,
      user: { userId: studentA.userId, role: 'STUDENT' },
      query: { type: 'ALL' },
    };
    const res = createMockResponse();
    await listReviews(req, res);

    assert(
      res.statusCode === 403 && res.body?.success === false,
      'TEST 2: Student GET /reviews?type=ALL returns HTTP 403 Forbidden',
      res.body
    );
  }

  // -------------------------------------------------------------
  // TEST 3: Student querying reviews without type receives ONLY published testimonials
  // -------------------------------------------------------------
  {
    let capturedWhere: any = null;
    (prisma.parentReview as any).findMany = async (args: any) => {
      capturedWhere = args.where;
      return [{ id: 'rev-1', type: 'TESTIMONIAL', isPublished: true }];
    };

    const req: any = {
      instituteId: dummyInstituteId,
      user: { userId: studentA.userId, role: 'STUDENT' },
      query: {},
    };
    const res = createMockResponse();
    await listReviews(req, res);

    assert(
      res.statusCode === 200 && capturedWhere?.type === 'TESTIMONIAL' && capturedWhere?.isPublished === true,
      'TEST 3: Student GET /reviews defaults strictly to type=TESTIMONIAL and isPublished=true',
      capturedWhere
    );
  }

  // -------------------------------------------------------------
  // TEST 4: Student cross-querying reviews with studentId of another student returns HTTP 403
  // -------------------------------------------------------------
  {
    const req: any = {
      instituteId: dummyInstituteId,
      user: { userId: studentA.userId, role: 'STUDENT' },
      query: { studentId: studentB.id },
    };
    const res = createMockResponse();
    await listReviews(req, res);

    assert(
      res.statusCode === 403 && res.body?.success === false,
      'TEST 4: Student GET /reviews?studentId=OTHER_STUDENT returns HTTP 403 Forbidden',
      res.body
    );
  }

  // -------------------------------------------------------------
  // TEST 5: Student GET /progress strictly scopes to own studentId and isPublished=true
  // -------------------------------------------------------------
  {
    let capturedWhere: any = null;
    (prisma.progressFeedback as any).findMany = async (args: any) => {
      capturedWhere = args.where;
      return [{ id: 'prog-1', studentId: studentA.id, isPublished: true, termName: 'Term 1' }];
    };

    const req: any = {
      instituteId: dummyInstituteId,
      user: { userId: studentA.userId, role: 'STUDENT' },
      query: {},
    };
    const res = createMockResponse();
    await listProgressFeedback(req, res);

    assert(
      res.statusCode === 200 && capturedWhere?.studentId === studentA.id && capturedWhere?.isPublished === true,
      'TEST 5: Student GET /progress strictly filters where studentId=ownId and isPublished=true',
      capturedWhere
    );
  }

  // -------------------------------------------------------------
  // TEST 6: Student probing another student in GET /progress?studentId=... returns HTTP 403
  // -------------------------------------------------------------
  {
    const req: any = {
      instituteId: dummyInstituteId,
      user: { userId: studentA.userId, role: 'STUDENT' },
      query: { studentId: studentB.id },
    };
    const res = createMockResponse();
    await listProgressFeedback(req, res);

    assert(
      res.statusCode === 403 && res.body?.success === false,
      'TEST 6: Student GET /progress?studentId=OTHER_STUDENT returns HTTP 403 Forbidden',
      res.body
    );
  }

  // -------------------------------------------------------------
  // TEST 7: Student querying another student via GET /progress/students/:studentId returns HTTP 403
  // -------------------------------------------------------------
  {
    const req: any = {
      instituteId: dummyInstituteId,
      user: { userId: studentA.userId, role: 'STUDENT' },
      params: { studentId: studentB.id },
    };
    const res = createMockResponse();
    await getStudentFeedback(req, res);

    assert(
      res.statusCode === 403 && res.body?.success === false,
      'TEST 7: Student GET /progress/students/OTHER_STUDENT returns HTTP 403 Forbidden',
      res.body
    );
  }

  // -------------------------------------------------------------
  // TEST 8: Student querying own studentId via GET /progress/students/:studentId returns HTTP 200
  // -------------------------------------------------------------
  {
    let capturedWhere: any = null;
    (prisma.progressFeedback as any).findMany = async (args: any) => {
      capturedWhere = args.where;
      return [{ id: 'prog-1', studentId: studentA.id, isPublished: true, termName: 'Term 1' }];
    };

    const req: any = {
      instituteId: dummyInstituteId,
      user: { userId: studentA.userId, role: 'STUDENT' },
      params: { studentId: studentA.id },
    };
    const res = createMockResponse();
    await getStudentFeedback(req, res);

    assert(
      res.statusCode === 200 && capturedWhere?.studentId === studentA.id && capturedWhere?.isPublished === true,
      'TEST 8: Student GET /progress/students/OWN_STUDENT succeeds with published reports only',
      capturedWhere
    );
  }

  // -------------------------------------------------------------
  // TEST 9: Staff can still query progress reports without student restriction
  // -------------------------------------------------------------
  {
    let capturedWhere: any = null;
    (prisma.progressFeedback as any).findMany = async (args: any) => {
      capturedWhere = args.where;
      return [{ id: 'prog-staff-1', isPublished: false, termName: 'Draft Term 1' }];
    };

    const req: any = {
      instituteId: dummyInstituteId,
      user: { userId: 'staff-user-1', role: 'SUPER_ADMIN' },
      query: {},
    };
    const res = createMockResponse();
    await listProgressFeedback(req, res);

    assert(
      res.statusCode === 200 && res.body?.success === true,
      'TEST 9: Staff / Admin progress workflow remains intact (can see drafts & all reports)',
      res.body
    );
  }

  console.log('\n================================================================');
  console.log(`SECURITY VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runUnitSecurityTests();
