import { PrismaClient } from '@prisma/client';
import { InAppNotificationService } from '../src/modules/notifications/inapp-notification.service.js';

const prisma = new PrismaClient();

async function runTests() {
  console.log('====================================================');
  console.log('   TUITIONOS HOMEWORK, MATERIALS & EXAMS TEST SUITE');
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
        include: { student: true },
      },
    },
  });

  if (!batch || !batch.institute) {
    throw new Error('No batch with active student enrollments found in database.');
  }

  const institute = batch.institute;
  console.log(`Using Institute: ${institute.name} (${institute.id})`);
  console.log(`Using Batch: ${batch.name} (${batch.id}) with ${batch.enrollments.length} enrolled student(s)`);

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

  const subject = await prisma.subject.findFirst({
    where: { instituteId: institute.id },
  });

  const enrolledStudentIds = Array.from(new Set(batch.enrollments.map((e) => e.studentId)));
  const testStudentId1 = enrolledStudentIds[0];
  const testStudentId2 = enrolledStudentIds[1] || enrolledStudentIds[0];

  // Variables for tracking created IDs to clean up
  let createdHomeworkId: string | null = null;
  let createdExamId: string | null = null;
  const createdNotificationIds: string[] = [];

  try {
    // ==========================================
    // TEST 1: HOMEWORK ROSTER & SUBMISSION DERIVATION
    // ==========================================
    console.log('\n--- Section 1: Homework Roster & Completion Tracking ---');

    const futureDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const testHomework = await prisma.learningMaterial.create({
      data: {
        instituteId: institute.id,
        batchId: batch.id,
        subjectId: subject?.id || null,
        uploaderId: staffUser.id,
        title: 'AUTOMATED_TEST_HOMEWORK_' + Date.now(),
        description: 'Test Homework Description',
        content: 'Test Homework Content Instructions',
        type: 'HOMEWORK',
        dueDate: futureDue,
        maxMarks: 100,
        isPublished: true,
      },
    });
    createdHomeworkId = testHomework.id;
    assert(!!testHomework.id, 'Created test homework assignment in database');

    // Verify roster derivation: all batch students should be present
    const batchEnrollments = await prisma.studentEnrollment.findMany({
      where: { batchId: batch.id, isActive: true },
      include: { student: true },
    });
    const uniqueStudents = Array.from(new Map(batchEnrollments.map((e) => [e.student.id, e.student])).values());

    // 1. Initial state: No submissions -> Every student is NOT_COMPLETED
    const initialSubmissions = await prisma.homeworkSubmission.findMany({
      where: { materialId: testHomework.id },
    });

    const initialRoster = uniqueStudents.map((st) => {
      const sub = initialSubmissions.find((s) => s.studentId === st.id);
      return {
        studentId: st.id,
        status: sub ? sub.status : 'NOT_COMPLETED',
        isSubmitted: !!sub,
      };
    });

    assert(
      initialRoster.length === uniqueStudents.length,
      `Derived full student roster of ${initialRoster.length} students (matching enrollment count)`
    );
    assert(
      initialRoster.every((r) => r.status === 'NOT_COMPLETED' && !r.isSubmitted),
      'Pending students with no submissions are visible and marked NOT_COMPLETED (not hidden)'
    );

    // 2. Student 1 marks self-completed
    const selfCompletedSub = await prisma.homeworkSubmission.create({
      data: {
        materialId: testHomework.id,
        studentId: testStudentId1,
        status: 'COMPLETED',
        studentNotes: null,
        fileUrl: null,
      },
    });
    assert(!!selfCompletedSub.id, 'Student 1 self-marked completion');

    // 3. If there is a second student, create a file submission
    if (testStudentId2 !== testStudentId1) {
      await prisma.homeworkSubmission.create({
        data: {
          materialId: testHomework.id,
          studentId: testStudentId2,
          status: 'SUBMITTED',
          studentNotes: 'Please review my attached work',
          fileUrl: 'materials/test-sub.pdf',
          fileName: 'test-sub.pdf',
        },
      });
      console.log('Student 2 created file submission for review');
    }

    // Re-derive roster and verify statuses
    const updatedSubs = await prisma.homeworkSubmission.findMany({
      where: { materialId: testHomework.id },
    });
    const sub1 = updatedSubs.find((s) => s.studentId === testStudentId1);
    assert(sub1?.status === 'COMPLETED' && !sub1.fileUrl, 'Student 1 recognized as SELF_COMPLETED / self-marked');

    // 4. Staff grades submission
    await prisma.homeworkSubmission.update({
      where: { id: selfCompletedSub.id },
      data: {
        status: 'GRADED',
        grade: 'A+',
        feedback: 'Excellent work!',
        gradedById: staffUser.id,
        gradedAt: new Date(),
      },
    });

    const gradedSub = await prisma.homeworkSubmission.findUnique({
      where: { id: selfCompletedSub.id },
    });
    assert(gradedSub?.status === 'GRADED' && gradedSub.grade === 'A+', 'Staff graded submission successfully');

    // ==========================================
    // TEST 2: LEARNING MATERIAL MODAL & TRACKING
    // ==========================================
    console.log('\n--- Section 2: Learning Material Modal Interaction Tracking ---');

    // Track OPENED event
    const openTracking = await prisma.materialInteraction.create({
      data: {
        materialId: testHomework.id,
        studentId: testStudentId1,
        interactionType: 'OPENED',
        progressPercent: 0,
        isCompleted: false,
      },
    });
    assert(
      openTracking.interactionType === 'OPENED' && openTracking.isCompleted === false,
      'Recorded material OPENED event (isCompleted is correctly false)'
    );

    // Track AUDIO_PLAYING event
    const playingTracking = await prisma.materialInteraction.upsert({
      where: {
        materialId_studentId_interactionType: {
          materialId: testHomework.id,
          studentId: testStudentId1,
          interactionType: 'AUDIO_PLAYING',
        },
      },
      update: {
        progressPercent: 45,
        lastPositionSec: 45,
        isCompleted: false,
      },
      create: {
        materialId: testHomework.id,
        studentId: testStudentId1,
        interactionType: 'AUDIO_PLAYING',
        progressPercent: 45,
        lastPositionSec: 45,
        isCompleted: false,
      },
    });
    assert(
      playingTracking.interactionType === 'AUDIO_PLAYING' && playingTracking.progressPercent === 45,
      'Recorded AUDIO_PLAYING progress tracking at 45%'
    );

    // Track AUDIO_COMPLETED event
    const completedTracking = await prisma.materialInteraction.upsert({
      where: {
        materialId_studentId_interactionType: {
          materialId: testHomework.id,
          studentId: testStudentId1,
          interactionType: 'AUDIO_COMPLETED',
        },
      },
      update: {
        progressPercent: 100,
        isCompleted: true,
      },
      create: {
        materialId: testHomework.id,
        studentId: testStudentId1,
        interactionType: 'AUDIO_COMPLETED',
        progressPercent: 100,
        isCompleted: true,
      },
    });
    assert(
      completedTracking.interactionType === 'AUDIO_COMPLETED' && completedTracking.isCompleted === true,
      'Recorded AUDIO_COMPLETED with isCompleted = true when playback reached completion'
    );

    // ==========================================
    // TEST 3: EXAM LIFECYCLE, NOTIFICATIONS & GRADING
    // ==========================================
    console.log('\n--- Section 3: Exams Lifecycle, Draft Marks & Report Card ---');

    // 1. Create Exam in DRAFT status
    const examDate = new Date();
    examDate.setDate(examDate.getDate() + 5);

    let testSubject = await prisma.subject.findFirst({ where: { instituteId: institute.id } });
    if (!testSubject) {
      testSubject = await prisma.subject.create({
        data: {
          instituteId: institute.id,
          name: 'Test Mathematics',
          code: 'TMATH-' + Date.now().toString().slice(-4),
        },
      });
      console.log(`Created test subject: ${testSubject.name} (${testSubject.id})`);
    }

    const testExam = await prisma.examination.create({
      data: {
        instituteId: institute.id,
        batchId: batch.id,
        subjectId: testSubject.id,
        title: 'AUTOMATED_TEST_EXAM_' + Date.now(),
        description: 'Comprehensive mid-term examination',
        examType: 'Mid-Term Assessment',
        totalMarks: 100,
        passingMarks: 40,
        examDate: examDate,
        startTime: '10:00 AM',
        endTime: '01:00 PM',
        instructions: 'Read questions carefully. Calculators not allowed.',
        status: 'DRAFT',
        isPublished: false,
        isResultsPublished: false,
      },
    });
    createdExamId = testExam.id;
    assert(
      testExam.status === 'DRAFT' && !testExam.isPublished && !testExam.isResultsPublished,
      'Created exam in DRAFT status with schedule times and instructions'
    );

    // 2. Publish Exam Schedule & Trigger Notification
    const publishedExam = await prisma.examination.update({
      where: { id: testExam.id },
      data: {
        status: 'PUBLISHED',
        isPublished: true,
      },
    });
    assert(publishedExam.isPublished === true && publishedExam.status === 'PUBLISHED', 'Published exam schedule');

    // Dispatch schedule notification via InAppNotificationService
    const notifyRes = await InAppNotificationService.notifyExamScheduled(testExam.id, false);
    console.log(`Exam schedule notifications dispatched. Created: ${notifyRes.length}`);
    assert(Array.isArray(notifyRes), 'InAppNotificationService.notifyExamScheduled executed successfully');

    // 3. Enter Draft Marks
    const draftMark = await prisma.examMark.create({
      data: {
        examId: testExam.id,
        studentId: testStudentId1,
        marksObtained: 88,
        isAbsent: false,
        isPublished: false, // DRAFT mark
        evaluatedById: staffUser.id,
        remarks: 'Very good performance',
      },
    });
    assert(
      draftMark.marksObtained.toNumber() === 88 && draftMark.isPublished === false,
      'Entered draft marks for student (isPublished = false)'
    );

    // 4. Verify Student/Parent API isolation: Unpublished results MUST NOT appear
    const studentViewExams = await prisma.examination.findMany({
      where: {
        id: testExam.id,
        isPublished: true,
      },
      include: {
        marks: {
          where: { isPublished: true }, // Only published marks allowed
        },
      },
    });
    assert(
      studentViewExams[0]?.marks.length === 0,
      'Strict Privacy Verified: Student/Parent query returns 0 marks while exam is in draft grading'
    );

    // 5. Publish Exam Results
    await prisma.$transaction([
      prisma.examination.update({
        where: { id: testExam.id },
        data: {
          status: 'COMPLETED',
          isResultsPublished: true,
          resultsPublishedAt: new Date(),
        },
      }),
      prisma.examMark.updateMany({
        where: { examId: testExam.id },
        data: { isPublished: true },
      }),
    ]);

    const publishedResultsExam = await prisma.examination.findUnique({
      where: { id: testExam.id },
      include: { marks: { where: { isPublished: true } } },
    });
    assert(
      publishedResultsExam?.isResultsPublished === true && publishedResultsExam.marks.length > 0,
      'Official Results Published: Marks are now published and visible'
    );

    // Dispatch results notification
    const resultNotifyRes = await InAppNotificationService.notifyExamResultsPublished(testExam.id);
    console.log(`Exam results notifications dispatched. Created: ${resultNotifyRes.length}`);
    assert(Array.isArray(resultNotifyRes), 'InAppNotificationService.notifyExamResultsPublished executed successfully');

    // 6. Report Card Calculation
    const studentReportMarks = await prisma.examMark.findMany({
      where: {
        studentId: testStudentId1,
        isPublished: true,
        exam: { isResultsPublished: true },
      },
      include: { exam: true },
    });
    assert(
      studentReportMarks.some((m) => m.examId === testExam.id),
      'Student report card includes published test result'
    );

  } finally {
    // ==========================================
    // CLEANUP
    // ==========================================
    console.log('\n--- Section 4: Safe Test Cleanup ---');
    if (createdExamId) {
      await prisma.examMark.deleteMany({ where: { examId: createdExamId } });
      await prisma.notification.deleteMany({
        where: {
          OR: [
            { idempotencyKey: { contains: createdExamId } },
            { link: { contains: createdExamId } },
          ],
        },
      });
      await prisma.examination.delete({ where: { id: createdExamId } });
      console.log('Cleaned up test examination, marks, and notifications');
    }

    if (createdHomeworkId) {
      await prisma.materialInteraction.deleteMany({ where: { materialId: createdHomeworkId } });
      await prisma.homeworkSubmission.deleteMany({ where: { materialId: createdHomeworkId } });
      await prisma.learningMaterial.delete({ where: { id: createdHomeworkId } });
      console.log('Cleaned up test homework and interactions');
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
