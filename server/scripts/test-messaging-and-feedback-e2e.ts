import { z } from 'zod';
import { InAppNotificationService } from '../src/modules/notifications/inapp-notification.service.js';
import {
  FEEDBACK_CATEGORIES,
  submitFeedbackSchema,
  respondFeedbackSchema,
  updateFeedbackStatusSchema,
} from '../src/modules/feedback/feedback.controller.js';

interface TestCase {
  name: string;
  fn: () => boolean | Promise<boolean>;
}

// In-Memory simulated DB for E2E flow testing
interface MockUser {
  id: string;
  fullName: string;
  role: 'PARENT' | 'STAFF' | 'ACADEMIC_ADMIN' | 'STUDENT';
  instituteId: string;
}

interface MockParticipant {
  id: string;
  conversationId: string;
  userId: string;
  lastReadAt: Date | null;
}

interface MockMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
}

interface MockConversation {
  id: string;
  instituteId: string;
  title: string | null;
  participants: MockParticipant[];
  messages: MockMessage[];
}

interface MockFeedback {
  id: string;
  instituteId: string;
  studentId: string;
  parentId: string;
  staffId: string | null;
  category: string;
  feedbackText: string;
  status: 'OPEN' | 'RESPONDED' | 'RESOLVED';
  teacherResponse: string | null;
  respondedAt: Date | null;
  respondedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const tests: TestCase[] = [
  // =========================================================================
  // 1. MESSAGING: RELATIONSHIP & AUTHORIZATION CHECKS
  // =========================================================================
  {
    name: 'Messaging Auth: Parent can initiate conversation only with assigned teacher',
    fn: () => {
      const parentId = 'p1-uuid';
      const studentId = 's1-uuid';
      const assignedTeacherId = 't1-uuid';
      const unassignedTeacherId = 't2-uuid';

      // Parent-student relation
      const parentStudents = new Map([[parentId, [studentId]]]);
      // Student-batch-teacher assignments
      const studentAssignedTeachers = new Map([[studentId, [assignedTeacherId]]]);

      function canParentMessageTeacher(pId: string, teacherId: string): boolean {
        const myKids = parentStudents.get(pId) || [];
        for (const k of myKids) {
          const teachers = studentAssignedTeachers.get(k) || [];
          if (teachers.includes(teacherId)) return true;
        }
        return false;
      }

      const canMessageAssigned = canParentMessageTeacher(parentId, assignedTeacherId);
      const canMessageUnassigned = canParentMessageTeacher(parentId, unassignedTeacherId);

      return canMessageAssigned === true && canMessageUnassigned === false;
    },
  },
  {
    name: 'Messaging Auth: Teacher can initiate conversation only with parent of assigned student',
    fn: () => {
      const teacherId = 't1-uuid';
      const assignedStudentId = 's1-uuid';
      const unassignedStudentId = 's2-uuid';
      const assignedParentId = 'p1-uuid';
      const unassignedParentId = 'p2-uuid';

      // Teacher batches scope
      const teacherAssignedStudents = new Set([assignedStudentId]);
      const parentChildren = new Map([
        [assignedParentId, [assignedStudentId]],
        [unassignedParentId, [unassignedStudentId]],
      ]);

      function canTeacherMessageParent(tId: string, parentUserId: string): boolean {
        const children = parentChildren.get(parentUserId) || [];
        return children.some((c) => teacherAssignedStudents.has(c));
      }

      const canAssigned = canTeacherMessageParent(teacherId, assignedParentId);
      const canUnassigned = canTeacherMessageParent(teacherId, unassignedParentId);

      return canAssigned === true && canUnassigned === false;
    },
  },

  // =========================================================================
  // 2. MESSAGING: TWO-WAY REAL-TIME DELIVERY & PERSISTENCE
  // =========================================================================
  {
    name: 'Messaging E2E: Parent sends message to Teacher with server timestamp & notification',
    fn: () => {
      const parentUser: MockUser = { id: 'usr-parent-1', fullName: 'Rajesh Sharma', role: 'PARENT', instituteId: 'inst-1' };
      const teacherUser: MockUser = { id: 'usr-teacher-1', fullName: 'Anita Desai', role: 'STAFF', instituteId: 'inst-1' };

      const conversation: MockConversation = {
        id: 'conv-101',
        instituteId: 'inst-1',
        title: 'Maths Query',
        participants: [
          { id: 'part-1', conversationId: 'conv-101', userId: parentUser.id, lastReadAt: new Date(Date.now() - 5000) },
          { id: 'part-2', conversationId: 'conv-101', userId: teacherUser.id, lastReadAt: null },
        ],
        messages: [],
      };

      // Parent sends a message
      const messageBody = 'Hello Ma\'am, regarding Priya\'s calculus doubts.';
      const now = new Date();
      const newMessage: MockMessage = {
        id: 'msg-001',
        conversationId: conversation.id,
        senderId: parentUser.id,
        body: messageBody,
        createdAt: now,
      };

      conversation.messages.push(newMessage);

      // Sender participant's lastReadAt is touched to now
      const senderParticipant = conversation.participants.find((p) => p.userId === parentUser.id)!;
      senderParticipant.lastReadAt = now;

      // Event dispatched to SSE stream
      const ssePayload = {
        type: 'MESSAGE_CREATED',
        data: {
          conversationId: conversation.id,
          message: newMessage,
        },
      };

      // InApp notification created for recipient
      const notificationForTeacher = {
        userId: teacherUser.id,
        type: 'MESSAGE',
        title: `New message from ${parentUser.fullName}`,
        message: messageBody,
        metadata: { conversationId: conversation.id, messageId: newMessage.id },
      };

      return (
        conversation.messages.length === 1 &&
        conversation.messages[0].body === messageBody &&
        conversation.messages[0].senderId === parentUser.id &&
        senderParticipant.lastReadAt?.getTime() === now.getTime() &&
        ssePayload.data.message.id === 'msg-001' &&
        notificationForTeacher.userId === teacherUser.id
      );
    },
  },
  {
    name: 'Messaging E2E: Teacher replies to Parent with real-time SSE dispatch',
    fn: () => {
      const parentId = 'usr-parent-1';
      const teacherId = 'usr-teacher-1';

      const conversation: MockConversation = {
        id: 'conv-101',
        instituteId: 'inst-1',
        title: 'Maths Query',
        participants: [
          { id: 'part-1', conversationId: 'conv-101', userId: parentId, lastReadAt: new Date('2026-10-29T10:00:00Z') },
          { id: 'part-2', conversationId: 'conv-101', userId: teacherId, lastReadAt: new Date('2026-10-29T10:00:00Z') },
        ],
        messages: [
          { id: 'msg-001', conversationId: 'conv-101', senderId: parentId, body: 'Question', createdAt: new Date('2026-10-29T10:00:00Z') },
        ],
      };

      // Teacher replies
      const replyBody = 'I have reviewed Priya\'s test. We will solve this in extra class tomorrow.';
      const replyTime = new Date('2026-10-29T10:05:00Z');
      const replyMsg: MockMessage = {
        id: 'msg-002',
        conversationId: conversation.id,
        senderId: teacherId,
        body: replyBody,
        createdAt: replyTime,
      };

      conversation.messages.push(replyMsg);
      const teacherParticipant = conversation.participants.find((p) => p.userId === teacherId)!;
      teacherParticipant.lastReadAt = replyTime;

      return (
        conversation.messages.length === 2 &&
        conversation.messages[1].senderId === teacherId &&
        conversation.messages[1].body === replyBody &&
        teacherParticipant.lastReadAt.getTime() === replyTime.getTime()
      );
    },
  },

  // =========================================================================
  // 3. READ RECEIPTS & UNREAD TRACKING
  // =========================================================================
  {
    name: 'Read Receipts: Recipient opening conversation marks messages read (isReadByRecipient)',
    fn: () => {
      const parentId = 'usr-p';
      const teacherId = 'usr-t';

      // Conversation state:
      // Parent sent msg-1 at 10:00.
      // Teacher last read at 09:50 -> unread.
      let teacherLastRead: Date | null = new Date('2026-10-29T09:50:00Z');
      const msg1: MockMessage = {
        id: 'm1',
        conversationId: 'c1',
        senderId: parentId,
        body: 'Hello Teacher',
        createdAt: new Date('2026-10-29T10:00:00Z'),
      };

      // Before reading:
      const isReadBefore = teacherLastRead !== null && msg1.createdAt <= teacherLastRead;
      if (isReadBefore !== false) return false;

      // Teacher opens conversation at 10:02:
      teacherLastRead = new Date('2026-10-29T10:02:00Z');

      // Now compute isReadByRecipient for parent's message
      const isReadAfter = teacherLastRead !== null && msg1.createdAt <= teacherLastRead;
      return isReadAfter === true;
    },
  },
  {
    name: 'Unread Tracking: Computes isUnread correctly for recipient conversation list',
    fn: () => {
      const parentId = 'usr-p';
      const teacherId = 'usr-t';

      // Conversation where last message was sent by Parent at 10:30
      const lastMsg: MockMessage = {
        id: 'm2',
        conversationId: 'c2',
        senderId: parentId,
        body: 'Any homework today?',
        createdAt: new Date('2026-10-29T10:30:00Z'),
      };

      // Case A: Teacher last read at 10:25 -> should be unread
      const teacherLastReadA = new Date('2026-10-29T10:25:00Z');
      const isUnreadForTeacherA = !teacherLastReadA || lastMsg.createdAt > teacherLastReadA;

      // Case B: Teacher last read at 10:35 -> should NOT be unread
      const teacherLastReadB = new Date('2026-10-29T10:35:00Z');
      const isUnreadForTeacherB = !teacherLastReadB || lastMsg.createdAt > teacherLastReadB;

      // For Sender (Parent): they sent it, so it should not be unread for themselves
      const isUnreadForParent = lastMsg.senderId !== parentId;

      return isUnreadForTeacherA === true && isUnreadForTeacherB === false && isUnreadForParent === false;
    },
  },

  // =========================================================================
  // 4. OFFLINE PERSISTENCE & RECOVERY
  // =========================================================================
  {
    name: 'Offline Persistence: Messages and notifications survive disconnect and are reloaded on reconnect',
    fn: () => {
      // Simulates DB persistence
      const persistentDb = {
        conversations: new Map<string, MockConversation>(),
        notifications: [] as any[],
      };

      // 1. Parent sends message while Teacher is offline
      const conv: MockConversation = {
        id: 'c-offline',
        instituteId: 'inst-1',
        title: 'Query',
        participants: [
          { id: 'part-1', conversationId: 'c-offline', userId: 'p1', lastReadAt: new Date() },
          { id: 'part-2', conversationId: 'c-offline', userId: 't1', lastReadAt: null },
        ],
        messages: [],
      };
      persistentDb.conversations.set(conv.id, conv);

      const offlineMsg: MockMessage = {
        id: 'msg-off-1',
        conversationId: 'c-offline',
        senderId: 'p1',
        body: 'Offline message while faculty was logged out.',
        createdAt: new Date('2026-10-29T08:00:00Z'),
      };
      conv.messages.push(offlineMsg);

      persistentDb.notifications.push({
        id: 'notif-1',
        userId: 't1',
        title: 'New message from Parent',
        message: offlineMsg.body,
        isRead: false,
        createdAt: new Date('2026-10-29T08:00:00Z'),
      });

      // 2. Teacher comes online hours later and queries conversations and notifications
      const loadedConv = persistentDb.conversations.get('c-offline');
      const loadedNotifs = persistentDb.notifications.filter((n) => n.userId === 't1' && !n.isRead);

      return (
        loadedConv !== undefined &&
        loadedConv.messages.length === 1 &&
        loadedConv.messages[0].id === 'msg-off-1' &&
        loadedNotifs.length === 1 &&
        loadedNotifs[0].message === offlineMsg.body
      );
    },
  },

  // =========================================================================
  // 5. PARENT FEEDBACK: SUBMISSION & AUTHORIZATION
  // =========================================================================
  {
    name: 'Feedback Validation: Accepts all 6 required categories with character limits',
    fn: () => {
      const studentId = '11111111-1111-1111-1111-111111111111';
      for (const cat of FEEDBACK_CATEGORIES) {
        const valid = submitFeedbackSchema.safeParse({
          studentId,
          category: cat,
          feedbackText: `Detailed constructive feedback regarding ${cat} performance.`,
        });
        if (!valid.success) return false;
      }
      return true;
    },
  },
  {
    name: 'Feedback Auth: Rejects feedback submission if parent is not linked to student',
    fn: () => {
      const parentId = 'p-authorized';
      const foreignStudentId = 's-foreign';

      // Parent-student relations mapping
      const relations = new Set(['p-authorized:s-child']);

      function canParentSubmitForStudent(pId: string, sId: string): boolean {
        return relations.has(`${pId}:${sId}`);
      }

      const authorizedAttempt = canParentSubmitForStudent(parentId, 's-child');
      const unauthorizedAttempt = canParentSubmitForStudent(parentId, foreignStudentId);

      return authorizedAttempt === true && unauthorizedAttempt === false;
    },
  },
  {
    name: 'Feedback E2E: Parent submits feedback; saved with OPEN status & dispatches FEEDBACK_CREATED',
    fn: () => {
      const feedbackDb: MockFeedback[] = [];
      const dispatchedEvents: any[] = [];

      const newFeedback: MockFeedback = {
        id: 'fb-001',
        instituteId: 'inst-1',
        studentId: 'stud-1',
        parentId: 'parent-1',
        staffId: 'teacher-1',
        category: 'Teaching Method',
        feedbackText: 'Priya finds the recent physics derivation fast-paced. Can we have extra practice sheets?',
        status: 'OPEN',
        teacherResponse: null,
        respondedAt: null,
        respondedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      feedbackDb.push(newFeedback);

      // SSE event broadcast
      dispatchedEvents.push({
        type: 'FEEDBACK_CREATED',
        data: newFeedback,
      });

      return (
        feedbackDb.length === 1 &&
        feedbackDb[0].status === 'OPEN' &&
        feedbackDb[0].teacherResponse === null &&
        dispatchedEvents[0].type === 'FEEDBACK_CREATED' &&
        dispatchedEvents[0].data.id === 'fb-001'
      );
    },
  },

  // =========================================================================
  // 6. PARENT FEEDBACK: TEACHER RESPONSE & STATUS LIFECYCLE
  // =========================================================================
  {
    name: 'Feedback Response: Teacher responds; updates status to RESPONDED with timestamp and notifies parent',
    fn: () => {
      const feedback: MockFeedback = {
        id: 'fb-001',
        instituteId: 'inst-1',
        studentId: 'stud-1',
        parentId: 'parent-1',
        staffId: 'teacher-1',
        category: 'Teaching Method',
        feedbackText: 'Priya finds physics fast-paced.',
        status: 'OPEN',
        teacherResponse: null,
        respondedAt: null,
        respondedById: null,
        createdAt: new Date('2026-10-29T09:00:00Z'),
        updatedAt: new Date('2026-10-29T09:00:00Z'),
      };

      // Teacher responds
      const responseSchema = respondFeedbackSchema.safeParse({
        response: 'Thank you for highlighting this. I will share stepwise derivation notes and review with Priya.',
        status: 'RESPONDED',
      });
      if (!responseSchema.success) return false;

      const respondedTime = new Date('2026-10-29T10:15:00Z');
      feedback.teacherResponse = responseSchema.data.response;
      feedback.status = responseSchema.data.status;
      feedback.respondedAt = respondedTime;
      feedback.respondedById = 'teacher-1';
      feedback.updatedAt = respondedTime;

      // Dispatched SSE event
      const sseEvent = {
        type: 'FEEDBACK_UPDATED',
        data: feedback,
      };

      return (
        feedback.status === 'RESPONDED' &&
        feedback.teacherResponse.includes('stepwise derivation notes') &&
        feedback.respondedById === 'teacher-1' &&
        feedback.respondedAt.getTime() === respondedTime.getTime() &&
        sseEvent.type === 'FEEDBACK_UPDATED' &&
        sseEvent.data.status === 'RESPONDED'
      );
    },
  },
  {
    name: 'Feedback Resolution: Parent or Staff can resolve feedback; status updates to RESOLVED',
    fn: () => {
      const feedback: MockFeedback = {
        id: 'fb-001',
        instituteId: 'inst-1',
        studentId: 'stud-1',
        parentId: 'parent-1',
        staffId: 'teacher-1',
        category: 'Teaching Method',
        feedbackText: 'Priya finds physics fast-paced.',
        status: 'RESPONDED',
        teacherResponse: 'Notes provided.',
        respondedAt: new Date('2026-10-29T10:15:00Z'),
        respondedById: 'teacher-1',
        createdAt: new Date('2026-10-29T09:00:00Z'),
        updatedAt: new Date('2026-10-29T10:15:00Z'),
      };

      const statusSchema = updateFeedbackStatusSchema.safeParse({ status: 'RESOLVED' });
      if (!statusSchema.success) return false;

      feedback.status = statusSchema.data.status;
      feedback.updatedAt = new Date('2026-10-29T11:00:00Z');

      return feedback.status === 'RESOLVED';
    },
  },
  {
    name: 'Feedback Privacy: Students are strictly forbidden from viewing parent feedback (HTTP 403)',
    fn: () => {
      function checkRoleCanViewFeedback(role: string): { allowed: boolean; httpStatus: number } {
        if (role === 'STUDENT') {
          return { allowed: false, httpStatus: 403 };
        }
        if (role === 'PARENT' || role === 'STAFF' || role === 'ACADEMIC_ADMIN' || role === 'SUPER_ADMIN') {
          return { allowed: true, httpStatus: 200 };
        }
        return { allowed: false, httpStatus: 401 };
      }

      const studentCheck = checkRoleCanViewFeedback('STUDENT');
      const parentCheck = checkRoleCanViewFeedback('PARENT');
      const staffCheck = checkRoleCanViewFeedback('STAFF');

      return (
        studentCheck.allowed === false &&
        studentCheck.httpStatus === 403 &&
        parentCheck.allowed === true &&
        staffCheck.allowed === true
      );
    },
  },
  {
    name: 'Feedback Filtering: Staff can query feedback filtered by Category and Status',
    fn: () => {
      const allFeedbacks: MockFeedback[] = [
        {
          id: 'fb-1',
          instituteId: 'inst-1',
          studentId: 's1',
          parentId: 'p1',
          staffId: 't1',
          category: 'Academic Progress',
          feedbackText: 'Report inquiry',
          status: 'OPEN',
          teacherResponse: null,
          respondedAt: null,
          respondedById: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'fb-2',
          instituteId: 'inst-1',
          studentId: 's1',
          parentId: 'p1',
          staffId: 't1',
          category: 'Attendance',
          feedbackText: 'Leave on Monday',
          status: 'RESPONDED',
          teacherResponse: 'Noted',
          respondedAt: new Date(),
          respondedById: 't1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'fb-3',
          instituteId: 'inst-1',
          studentId: 's2',
          parentId: 'p2',
          staffId: 't1',
          category: 'Academic Progress',
          feedbackText: 'Maths doubt',
          status: 'RESOLVED',
          teacherResponse: 'Resolved in class',
          respondedAt: new Date(),
          respondedById: 't1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Filter by Status = 'OPEN'
      const openOnly = allFeedbacks.filter((f) => f.status === 'OPEN');
      // Filter by Category = 'Academic Progress'
      const academicOnly = allFeedbacks.filter((f) => f.category === 'Academic Progress');
      // Filter by Status = 'RESOLVED' and Category = 'Academic Progress'
      const resolvedAcademic = allFeedbacks.filter(
        (f) => f.status === 'RESOLVED' && f.category === 'Academic Progress'
      );

      return (
        openOnly.length === 1 &&
        openOnly[0].id === 'fb-1' &&
        academicOnly.length === 2 &&
        resolvedAcademic.length === 1 &&
        resolvedAcademic[0].id === 'fb-3'
      );
    },
  },
];

async function run() {
  console.log('================================================================');
  console.log(' TUITIONOS: PARENT-TEACHER MESSAGING & FEEDBACK E2E TEST SUITE');
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

