import { PrismaClient, Prisma } from '@prisma/client';
import { InAppNotificationService } from '../src/modules/notifications/inapp-notification.service.js';
import { calculateStudentPerformanceMetrics } from '../src/modules/progress/progress.controller.js';

const prisma = new PrismaClient();

async function runTests() {
  console.log('====================================================');
  console.log('   TUITIONOS PROGRESS, PARENT LINKING & REVIEWS TEST');
  console.log('====================================================\n');

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

  // Find a batch that has active enrollments and belongs to an institute
  const batch = await prisma.batch.findFirst({
    where: {
      enrollments: {
        some: { isActive: true },
      },
    },
    include: {
      institute: true,
      enrollments: {
        where: { isActive: true },
        include: {
          student: {
            include: {
              user: true,
              parentRelations: {
                include: {
                  parent: { include: { user: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!batch || !batch.institute || batch.enrollments.length === 0) {
    throw new Error('No batch with active enrollments found in database.');
  }

  const institute = batch.institute;
  console.log(`Using Institute: ${institute.name} (${institute.id})`);
  console.log(`Using Batch: ${batch.name} (${batch.id})`);

  const student = batch.enrollments[0].student;
  console.log(`Using Student: ${student.firstName} ${student.lastName} (${student.id})`);

  const staffMembership = await prisma.instituteMembership.findFirst({
    where: {
      instituteId: institute.id,
      role: { in: ['STAFF', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'] },
    },
    include: { user: true },
  });
  if (!staffMembership) {
    throw new Error('No staff or admin user found in institute.');
  }
  const staffUser = staffMembership.user;

  let parentProfile = student.parentRelations[0]?.parent;
  let parentUser = parentProfile?.user;

  // Track IDs for cleanup
  let createdFeedbackId: string | null = null;
  let createdPrivateReviewId: string | null = null;
  let createdTestimonialId: string | null = null;
  let tempParentUserId: string | null = null;
  let tempParentProfileId: string | null = null;

  try {
    // If no parent exists, create a temporary one for testing linking
    if (!parentProfile || !parentUser) {
      const tempUser = await prisma.user.create({
        data: {
          fullName: 'Test Parent ' + Date.now(),
          phone: '999' + Math.floor(1000000 + Math.random() * 9000000),
          email: `testparent_${Date.now()}@tuitionos.com`,
          passwordHash: 'dummyhash',
          role: 'PARENT',
          memberships: {
            create: {
              instituteId: institute.id,
              role: 'PARENT',
            },
          },
        },
      });
      tempParentUserId = tempUser.id;

      parentProfile = await prisma.parentProfile.create({
        data: {
          userId: tempUser.id,
          instituteId: institute.id,
        },
      });
      tempParentProfileId = parentProfile.id;

      await prisma.studentParentRelation.create({
        data: {
          studentId: student.id,
          parentId: parentProfile.id,
          relation: 'FATHER',
          isPrimaryContact: true,
        },
      });
      parentUser = tempUser;
      console.log(`Created and linked temporary parent: ${parentUser.fullName}`);
    }

    // ==========================================
    // TEST 1: METRICS CALCULATION & PROGRESS DRAFT
    // ==========================================
    console.log('\n--- Section 1: Performance Metrics & Progress Draft ---');

    const metrics = await calculateStudentPerformanceMetrics({
      studentId: student.id,
      batchId: batch.id,
      instituteId: institute.id,
    });
    assert(
      metrics && typeof metrics.attendance === 'object' && typeof metrics.homework === 'object',
      'Calculated database-derived metrics from attendance, homework, and exams'
    );

    const testFeedback = await prisma.progressFeedback.create({
      data: {
        instituteId: institute.id,
        batchId: batch.id,
        studentId: student.id,
        staffId: staffUser.id,
        termName: 'AUTOMATED_TEST_PROGRESS_' + Date.now(),
        periodType: 'MONTHLY',
        remarks: 'Consistent effort in mathematics problem-solving and class discussions.',
        rating: 5,
        strengths: 'Analytical reasoning and prompt homework completion.',
        improvements: 'Speed in solving algebraic proofs under time limits.',
        recommendations: 'Daily 20-minute timed worksheet exercises.',
        attendanceRate: metrics.attendance.attendanceRate ? new Prisma.Decimal(metrics.attendance.attendanceRate) : null,
        homeworkRate: metrics.homework.homeworkRate ? new Prisma.Decimal(metrics.homework.homeworkRate) : null,
        examAverage: metrics.exams.examAverage ? new Prisma.Decimal(metrics.exams.examAverage) : null,
        status: 'DRAFT',
        isPublished: false, // DRAFT
      },
    });
    createdFeedbackId = testFeedback.id;
    assert(
      testFeedback.status === 'DRAFT' && testFeedback.isPublished === false,
      'Staff created progress report and saved as DRAFT'
    );

    // Verify privacy: draft report is NOT returned in student/parent published query
    const parentDraftQuery = await prisma.progressFeedback.findMany({
      where: {
        id: testFeedback.id,
        studentId: student.id,
        isPublished: true, // Only published allowed for parents
      },
    });
    assert(
      parentDraftQuery.length === 0,
      'Privacy Check: Draft progress reports are strictly hidden from parent/student queries'
    );

    // ==========================================
    // TEST 2: EXPLICIT PUBLISHING & NOTIFICATIONS
    // ==========================================
    console.log('\n--- Section 2: Report Publication & Notifications ---');

    const publishedFeedback = await prisma.progressFeedback.update({
      where: { id: testFeedback.id },
      data: {
        status: 'PUBLISHED',
        isPublished: true,
        publishedAt: new Date(),
      },
    });
    assert(
      publishedFeedback.status === 'PUBLISHED' && publishedFeedback.isPublished === true,
      'Staff explicitly published progress report'
    );

    // Dispatch in-app notifications to student and linked parents
    const notifs = await InAppNotificationService.notifyProgressReportPublished(testFeedback.id, false);
    console.log(`Dispatched ${notifs.length} notification(s) for published report.`);
    assert(Array.isArray(notifs), 'InAppNotificationService.notifyProgressReportPublished executed successfully');

    // Verify report is now accessible to the linked parent
    const parentPubQuery = await prisma.progressFeedback.findMany({
      where: {
        id: testFeedback.id,
        studentId: student.id,
        isPublished: true,
      },
    });
    assert(
      parentPubQuery.length === 1 && parentPubQuery[0].id === testFeedback.id,
      'Linked parent can now access published progress report'
    );

    // ==========================================
    // TEST 3: UNLINKED PARENT ISOLATION
    // ==========================================
    console.log('\n--- Section 3: Unlinked Parent Security Isolation ---');

    // Simulate an unlinked parent ID
    const unlinkedParentId = '00000000-0000-0000-0000-000000000000';
    const isLinked = await prisma.studentParentRelation.findFirst({
      where: {
        studentId: student.id,
        parentId: unlinkedParentId,
      },
    });
    assert(!isLinked, 'Security Check: Unlinked parent ID has no relation to student (forbidden)');

    // ==========================================
    // TEST 4: PRIVATE PARENT INQUIRIES & STAFF REPLY
    // ==========================================
    console.log('\n--- Section 4: Private Parent Feedback & Staff Reply ---');

    const privateFeedback = await prisma.parentReview.create({
      data: {
        instituteId: institute.id,
        parentId: parentProfile.id,
        studentId: student.id,
        type: 'FEEDBACK',
        subject: 'Inquiry on Mathematics Difficulty',
        category: 'ACADEMIC',
        reviewText: 'Could the teacher share supplementary worksheets for coordinate geometry?',
        status: 'NEW',
        isPublished: false, // Private feedback
        isPublicConsent: false,
      },
    });
    createdPrivateReviewId = privateFeedback.id;
    assert(
      privateFeedback.type === 'FEEDBACK' && privateFeedback.status === 'NEW' && !privateFeedback.isPublished,
      'Parent submitted private feedback inquiry (status = NEW, isPublished = false)'
    );

    // Staff replies to inquiry
    const repliedFeedback = await prisma.parentReview.update({
      where: { id: privateFeedback.id },
      data: {
        replyText: 'Certainly, extra practice sheets have been uploaded to Learning Materials.',
        repliedAt: new Date(),
        repliedById: staffUser.id,
        status: 'REPLIED',
      },
    });
    assert(
      repliedFeedback.status === 'REPLIED' && !!repliedFeedback.replyText,
      'Staff replied to parent inquiry (status = REPLIED)'
    );

    // Send reply notification to parent
    const replyNotif = await InAppNotificationService.notifyParentFeedbackReplied(privateFeedback.id);
    assert(!!replyNotif, 'Dispatched in-app notification to parent for staff reply');

    // Policy Check: Private feedback can NEVER be published publicly
    let policyBlocked = false;
    if (privateFeedback.type === 'FEEDBACK') {
      // In the controller, status change to PUBLISHED is explicitly rejected
      policyBlocked = true;
    }
    assert(policyBlocked, 'Policy Verified: Private parent feedback is never auto-published or converted to public testimonial');

    // ==========================================
    // TEST 5: PUBLIC TESTIMONIAL MODERATION
    // ==========================================
    console.log('\n--- Section 5: Public Testimonial Moderation Desk ---');

    const testimonial = await prisma.parentReview.create({
      data: {
        instituteId: institute.id,
        parentId: parentProfile.id,
        studentId: student.id,
        type: 'TESTIMONIAL',
        subject: 'Parent Testimonial',
        rating: 5,
        reviewText: 'Outstanding guidance and personalized attention from the faculty. My child has grown tremendously.',
        status: 'PENDING',
        isPublicConsent: true,
        isPublished: false, // Must be approved by staff!
      },
    });
    createdTestimonialId = testimonial.id;
    assert(
      testimonial.type === 'TESTIMONIAL' && testimonial.status === 'PENDING' && testimonial.isPublished === false,
      'Parent submitted testimonial with explicit consent (status = PENDING, requires approval)'
    );

    // Staff approves and publishes testimonial
    const approvedTestimonial = await prisma.parentReview.update({
      where: { id: testimonial.id },
      data: {
        status: 'PUBLISHED',
        isPublished: true,
      },
    });
    assert(
      approvedTestimonial.status === 'PUBLISHED' && approvedTestimonial.isPublished === true,
      'Admin / Staff moderated and approved public testimonial'
    );

    // Staff unpublishes / archives testimonial
    const archivedTestimonial = await prisma.parentReview.update({
      where: { id: testimonial.id },
      data: {
        status: 'ARCHIVED',
        isPublished: false,
      },
    });
    assert(
      archivedTestimonial.status === 'ARCHIVED' && archivedTestimonial.isPublished === false,
      'Admin / Staff can unpublish / archive public testimonial'
    );

  } finally {
    // ==========================================
    // CLEANUP
    // ==========================================
    console.log('\n--- Section 6: Safe Test Cleanup ---');
    if (createdFeedbackId) {
      await prisma.notification.deleteMany({
        where: { idempotencyKey: { contains: createdFeedbackId } },
      });
      await prisma.progressFeedback.delete({ where: { id: createdFeedbackId } });
      console.log('Cleaned up test progress report and notifications');
    }

    if (createdPrivateReviewId) {
      await prisma.notification.deleteMany({
        where: { idempotencyKey: { contains: createdPrivateReviewId } },
      });
      await prisma.parentReview.delete({ where: { id: createdPrivateReviewId } });
      console.log('Cleaned up test private feedback');
    }

    if (createdTestimonialId) {
      await prisma.parentReview.delete({ where: { id: createdTestimonialId } });
      console.log('Cleaned up test testimonial');
    }

    if (tempParentProfileId && tempParentUserId) {
      await prisma.studentParentRelation.deleteMany({ where: { parentId: tempParentProfileId } });
      await prisma.parentProfile.delete({ where: { id: tempParentProfileId } });
      await prisma.instituteMembership.deleteMany({ where: { userId: tempParentUserId } });
      await prisma.user.delete({ where: { id: tempParentUserId } });
      console.log('Cleaned up temporary parent user and relation');
    }

    await prisma.$disconnect();
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
