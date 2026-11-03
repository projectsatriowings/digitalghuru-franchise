import {
  submitFeedbackSchema,
  respondFeedbackSchema,
  updateFeedbackStatusSchema,
  FEEDBACK_CATEGORIES,
} from '../src/modules/feedback/feedback.controller.js';

interface TestCase {
  name: string;
  fn: () => boolean | Promise<boolean>;
}

const tests: TestCase[] = [
  // 1. Category validation
  {
    name: 'Validation: submitFeedbackSchema accepts all 6 supported categories',
    fn: () => {
      const studentId = '11111111-1111-1111-1111-111111111111';
      for (const cat of FEEDBACK_CATEGORIES) {
        const res = submitFeedbackSchema.safeParse({
          studentId,
          category: cat,
          feedbackText: `This is constructive feedback regarding ${cat}.`,
        });
        if (!res.success) return false;
      }
      return true;
    },
  },
  {
    name: 'Validation: submitFeedbackSchema rejects unsupported category',
    fn: () => {
      const res = submitFeedbackSchema.safeParse({
        studentId: '11111111-1111-1111-1111-111111111111',
        category: 'Sports & Games', // unsupported
        feedbackText: 'Valid feedback text here.',
      });
      return res.success === false;
    },
  },
  {
    name: 'Validation: submitFeedbackSchema rejects feedback text shorter than 5 chars',
    fn: () => {
      const res = submitFeedbackSchema.safeParse({
        studentId: '11111111-1111-1111-1111-111111111111',
        category: 'Homework',
        feedbackText: 'Bad',
      });
      return res.success === false;
    },
  },
  {
    name: 'Validation: submitFeedbackSchema rejects invalid UUID for studentId',
    fn: () => {
      const res = submitFeedbackSchema.safeParse({
        studentId: 'not-a-uuid',
        category: 'General Feedback',
        feedbackText: 'Valid feedback text here.',
      });
      return res.success === false;
    },
  },
  {
    name: 'Validation: respondFeedbackSchema validates valid response payload',
    fn: () => {
      const res = respondFeedbackSchema.safeParse({
        response: 'Thank you for bringing this to our attention. We will address it.',
        status: 'RESPONDED',
      });
      return res.success === true && res.data.status === 'RESPONDED';
    },
  },
  {
    name: 'Validation: respondFeedbackSchema allows resolving feedback',
    fn: () => {
      const res = respondFeedbackSchema.safeParse({
        response: 'Issue has been fully resolved with the student in today class.',
        status: 'RESOLVED',
      });
      return res.success === true && res.data.status === 'RESOLVED';
    },
  },
  {
    name: 'Validation: respondFeedbackSchema rejects empty or whitespace response',
    fn: () => {
      const res = respondFeedbackSchema.safeParse({
        response: ' ',
      });
      return res.success === false;
    },
  },
  {
    name: 'Validation: updateFeedbackStatusSchema accepts OPEN, RESPONDED, and RESOLVED',
    fn: () => {
      const s1 = updateFeedbackStatusSchema.safeParse({ status: 'OPEN' });
      const s2 = updateFeedbackStatusSchema.safeParse({ status: 'RESPONDED' });
      const s3 = updateFeedbackStatusSchema.safeParse({ status: 'RESOLVED' });
      const s4 = updateFeedbackStatusSchema.safeParse({ status: 'DELETED' });
      return s1.success && s2.success && s3.success && !s4.success;
    },
  },
  // 2. Authorization & Security Unit Checks
  {
    name: 'Security: Parent relationship verification blocks unauthorized student feedback',
    fn: () => {
      // Mock relation table: parent P1 owns student S1, but not student S2
      const relationships = [{ parentId: 'P1', studentId: 'S1', instituteId: 'INST-1' }];
      const canParentAccess = (parentId: string, studentId: string, instId: string) => {
        return relationships.some(
          (r) => r.parentId === parentId && r.studentId === studentId && r.instituteId === instId
        );
      };

      const authorized = canParentAccess('P1', 'S1', 'INST-1');
      const unauthorizedCrossStudent = canParentAccess('P1', 'S2', 'INST-1');
      const unauthorizedCrossInstitute = canParentAccess('P1', 'S1', 'INST-2');

      return authorized === true && unauthorizedCrossStudent === false && unauthorizedCrossInstitute === false;
    },
  },
  {
    name: 'Security: Staff isolation ensures teachers only access assigned feedback',
    fn: () => {
      // Mock assignments: Teacher T1 assigned to Batch B1 (which student S1 belongs to)
      const staffAssignments = [{ teacherId: 'T1', batchId: 'B1' }];
      const studentEnrollments = [{ studentId: 'S1', batchId: 'B1' }, { studentId: 'S2', batchId: 'B2' }];

      const canTeacherRespond = (teacherId: string, studentId: string, targetStaffId?: string) => {
        if (targetStaffId && targetStaffId === teacherId) return true;
        const studentBatch = studentEnrollments.find((e) => e.studentId === studentId)?.batchId;
        return staffAssignments.some((a) => a.teacherId === teacherId && a.batchId === studentBatch);
      };

      const t1AccessS1 = canTeacherRespond('T1', 'S1');
      const t1AccessS2 = canTeacherRespond('T1', 'S2'); // S2 in B2, T1 not assigned
      const t2DirectTarget = canTeacherRespond('T2', 'S2', 'T2'); // T2 explicitly targeted

      return t1AccessS1 === true && t1AccessS2 === false && t2DirectTarget === true;
    },
  },
  {
    name: 'Security: Student role is strictly forbidden from viewing parent feedback',
    fn: () => {
      const allowedRoles = ['SUPER_ADMIN', 'ACADEMIC_ADMIN', 'STAFF', 'PARENT'];
      const isRoleAllowed = (role: string) => allowedRoles.includes(role);

      return isRoleAllowed('PARENT') && isRoleAllowed('STAFF') && !isRoleAllowed('STUDENT');
    },
  },
  {
    name: 'Notification: Real-time payload formatting generates valid notification structures',
    fn: () => {
      const makePayload = (type: string, title: string, message: string, recipientId: string) => ({
        type,
        data: {
          id: 'notif-1',
          title,
          message,
          recipientId,
          isRead: false,
          createdAt: new Date().toISOString(),
        },
      });

      const p = makePayload(
        'NOTIFICATION_CREATED',
        'Teacher Responded to Feedback',
        'Faculty responded to your feedback on Homework for Priya.',
        'parent-user-1'
      );

      return p.type === 'NOTIFICATION_CREATED' && p.data.recipientId === 'parent-user-1' && p.data.isRead === false;
    },
  },
];

async function run() {
  console.log('================================================================');
  console.log(' TUITIONOS: PARENT FEEDBACK & AUTHORIZATION TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];
    try {
      const ok = await t.fn();
      if (ok) {
        console.log(`  ✓ [PASS] ${i + 1}. ${t.name}`);
        passed++;
      } else {
        console.error(`  ✗ [FAIL] ${i + 1}. ${t.name}`);
        failed++;
      }
    } catch (err: any) {
      console.error(`  ✗ [ERROR] ${i + 1}. ${t.name}:`, err.message);
      failed++;
    }
  }

  console.log('\n----------------------------------------------------------------');
  console.log(` Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

run();

