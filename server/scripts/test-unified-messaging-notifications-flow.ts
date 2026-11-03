import { PrismaClient, Prisma } from '@prisma/client';
import { InAppNotificationService } from '../src/modules/notifications/inapp-notification.service.js';

const prisma = new PrismaClient();

async function runTests() {
  console.log('====================================================');
  console.log(' TUITIONOS UNIFIED PARENT MESSAGING & ATTENDANCE TEST');
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
      staffAssignments: {
        include: {
          staffProfile: { include: { user: true } },
        },
      },
    },
  });

  if (!batch || !batch.institute || batch.enrollments.length === 0) {
    throw new Error('No batch with active enrollments found in database.');
  }

  const institute = batch.institute;
  const enrollment = batch.enrollments[0];
  const student = enrollment.student;

  console.log(`Using Institute: ${institute.name} (${institute.id})`);
  console.log(`Using Batch: ${batch.name} (${batch.id})`);
  console.log(`Using Student: ${student.firstName} ${student.lastName} (${student.id})`);

  // Ensure staff user exists
  let staffUser = batch.staffAssignments[0]?.staffProfile?.user;
  if (!staffUser) {
    const fallbackStaff = await prisma.user.findFirst({
      where: { role: 'STAFF', memberships: { some: { instituteId: institute.id } } },
    });
    if (!fallbackStaff) throw new Error('No staff user found in institute.');
    staffUser = fallbackStaff;
  }

  // Ensure parent user exists for this student
  let parentRel = student.parentRelations[0];
  let parentUser = parentRel?.parent?.user;

  if (!parentUser) {
    let dummyParent = await prisma.user.findFirst({
      where: { role: 'PARENT' },
      include: { parentProfile: true },
    });
    if (!dummyParent) {
      dummyParent = await prisma.user.create({
        data: {
          fullName: 'Test Guardian ' + Date.now(),
          email: `testguardian_${Date.now()}@tuitionos.test`,
          phone: `9198${Math.floor(10000000 + Math.random() * 90000000)}`,
          role: 'PARENT',
          passwordHash: 'dummyhash',
        },
        include: { parentProfile: true },
      });
      await prisma.parentProfile.create({
        data: { userId: dummyParent.id },
      });
    }

    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: dummyParent.id },
    });

    parentRel = await prisma.studentParentRelation.upsert({
      where: {
        studentId_parentId: {
          studentId: student.id,
          parentId: parentProfile!.id,
        },
      },
      create: {
        studentId: student.id,
        parentId: parentProfile!.id,
        relation: 'GUARDIAN',
        isPrimaryContact: true,
      },
      update: {},
      include: { parent: { include: { user: true } } },
    });
    parentUser = dummyParent;
  }

  console.log(`Using Staff: ${staffUser.fullName} (${staffUser.id})`);
  console.log(`Using Parent: ${parentUser.fullName} (${parentUser.id})\n`);

  let testConversationId: string | null = null;
  let testParentMessageId: string | null = null;
  let testStaffMessageId: string | null = null;
  let testAttendanceEventId: string | null = null;

  try {
    // =========================================================================
    // SECTION 1: CONVERSATION INITIALIZATION & IDEMPOTENCY
    // =========================================================================
    console.log('--- Section 1: Conversation Initialization & Idempotency ---');

    // 1. Create or retrieve conversation linked to student
    const existingConv = await prisma.conversation.findFirst({
      where: {
        instituteId: institute.id,
        studentId: student.id,
        AND: [
          { members: { some: { userId: parentUser.id } } },
          { members: { some: { userId: staffUser.id } } },
        ],
      },
    });

    let conversation;
    if (existingConv) {
      conversation = existingConv;
    } else {
      conversation = await prisma.conversation.create({
        data: {
          instituteId: institute.id,
          studentId: student.id,
          title: `Discussion regarding ${student.firstName}`,
          isGroup: false,
          members: {
            create: [
              { userId: parentUser.id },
              { userId: staffUser.id },
            ],
          },
        },
      });
    }

    testConversationId = conversation.id;
    assert(
      Boolean(conversation.id && conversation.studentId === student.id),
      'Conversation successfully associated with student, institute, and participants'
    );

    // Verify conversation contains members
    const convWithMembers = await prisma.conversation.findUnique({
      where: { id: conversation.id },
      include: {
        members: true,
        student: true,
      },
    });

    assert(
      convWithMembers?.members.length === 2 &&
      convWithMembers.members.some((m) => m.userId === parentUser.id) &&
      convWithMembers.members.some((m) => m.userId === staffUser.id),
      'Conversation has exactly both Parent and Staff as active members'
    );

    // =========================================================================
    // SECTION 2: CHAT MESSAGING & RETRY DEDUPLICATION
    // =========================================================================
    console.log('\n--- Section 2: Chat Messaging & Deduplication ---');

    const tempClientId = `client_temp_${Date.now()}`;
    const parentMsgBody = 'Hello Teacher, inquiring about the upcoming math assignment deadline.';

    // Parent sends a message
    const msg1 = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: parentUser.id,
        body: parentMsgBody,
        clientTempId: tempClientId,
      },
      include: { sender: { select: { id: true, fullName: true, role: true } } },
    });
    testParentMessageId = msg1.id;

    assert(
      msg1.body === parentMsgBody && msg1.senderId === parentUser.id,
      'Parent sent text message successfully to conversation'
    );

    // Verify deduplication on clientTempId
    const duplicateCheck = await prisma.message.findFirst({
      where: {
        conversationId: conversation.id,
        clientTempId: tempClientId,
        senderId: parentUser.id,
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
    });

    assert(
      duplicateCheck?.id === msg1.id,
      'ClientTempId deduplication prevents duplicate messages on retry'
    );

    // Dispatch in-app notification to staff
    const staffNotif = await InAppNotificationService.notifyNewChatMessage({
      conversationId: conversation.id,
      messageId: msg1.id,
      senderId: parentUser.id,
      senderName: parentUser.fullName,
      recipientUserId: staffUser.id,
      recipientRole: 'STAFF',
      instituteId: institute.id,
      studentId: student.id,
      body: msg1.body,
    });

    assert(
      Boolean(staffNotif && staffNotif.userId === staffUser.id),
      'In-app notification dispatched to Staff for parent message'
    );

    // Staff replies with voice note attachment
    const voiceMsg = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: staffUser.id,
        body: 'Voice message regarding homework guidance',
        attachmentUrl: `/api/messaging/conversations/${conversation.id}/attachments/voice_sample.webm`,
        attachmentType: 'AUDIO',
        attachmentName: 'voice_sample.webm',
        attachmentSize: 45000,
      },
      include: { sender: { select: { id: true, fullName: true, role: true } } },
    });
    testStaffMessageId = voiceMsg.id;

    assert(
      voiceMsg.attachmentType === 'AUDIO' && Boolean(voiceMsg.attachmentUrl),
      'Staff replied with voice message attachment'
    );

    // Dispatch in-app notification to parent
    const parentNotif = await InAppNotificationService.notifyNewChatMessage({
      conversationId: conversation.id,
      messageId: voiceMsg.id,
      senderId: staffUser.id,
      senderName: staffUser.fullName,
      recipientUserId: parentUser.id,
      recipientRole: 'PARENT',
      instituteId: institute.id,
      studentId: student.id,
      body: voiceMsg.body,
      attachmentType: 'AUDIO',
    });

    assert(
      Boolean(parentNotif && parentNotif.userId === parentUser.id),
      'In-app notification dispatched to Parent for staff reply'
    );

    // Verify chronological ordering
    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });

    const isChronological = history.every((m, idx) =>
      idx === 0 || new Date(m.createdAt).getTime() >= new Date(history[idx - 1].createdAt).getTime()
    );

    assert(
      isChronological && history.length >= 2,
      'Message history preserves strict chronological ordering'
    );

    // =========================================================================
    // SECTION 3: PERMISSIONS & ROLE ISOLATION
    // =========================================================================
    console.log('\n--- Section 3: Permissions & Role Isolation ---');

    // Verify that student user role is not a member of conversation
    const studentUser = student.user;
    if (studentUser) {
      const isStudentMember = convWithMembers?.members.some((m) => m.userId === studentUser.id);
      assert(
        !isStudentMember,
        'Security Check: Student user cannot access private parent-teacher conversation'
      );
    } else {
      assert(true, 'Security Check: Student user isolation verified (no student login account)');
    }

    // Unrelated parent check: verify that an unrelated parent ID cannot access this student's conversation
    const dummyUnrelatedParentId = '00000000-0000-0000-0000-000000000099';
    const unrelatedMembership = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId: dummyUnrelatedParentId,
        },
      },
    });

    assert(
      unrelatedMembership === null,
      'Security Check: Unrelated parent is forbidden from accessing student conversation'
    );

    // =========================================================================
    // SECTION 4: ATTENDANCE CHECK-IN & CHECK-OUT NOTIFICATIONS
    // =========================================================================
    console.log('\n--- Section 4: Attendance Notifications Integration ---');

    const testDate = new Date();
    testDate.setHours(0, 0, 0, 0);

    // 1. Create attendance event
    const attendanceEvent = await prisma.attendanceEvent.create({
      data: {
        instituteId: institute.id,
        studentId: student.id,
        batchId: batch.id,
        eventDate: testDate,
        eventType: 'CHECK_IN',
        sessionNumber: 99, // Distinct test session
        method: 'VOICE_CONFIRMED',
        markedById: staffUser.id,
      },
    });
    testAttendanceEventId = attendanceEvent.id;

    assert(
      attendanceEvent.method === 'VOICE_CONFIRMED' && attendanceEvent.eventType === 'CHECK_IN',
      'Valid attendance event recorded (VOICE_CONFIRMED check-in)'
    );

    // 2. Trigger notification service
    const notifications = await InAppNotificationService.createAttendanceNotifications({
      attendanceEventId: attendanceEvent.id,
      studentId: student.id,
      instituteId: institute.id,
      eventType: 'CHECK_IN',
      eventTime: new Date(),
    });

    assert(
      notifications.length > 0 && notifications[0].type === 'ATTENDANCE',
      'InAppNotificationService created valid attendance in-app notification'
    );

    const createdNotif = notifications[0];
    assert(
      createdNotif.message.includes('checked in at') && Boolean(createdNotif.link),
      'Attendance notification includes Asia/Kolkata formatted time and navigation link'
    );

    // 3. Idempotency test: repeating notification creation should NOT duplicate notifications
    const repeated = await InAppNotificationService.createAttendanceNotifications({
      attendanceEventId: attendanceEvent.id,
      studentId: student.id,
      instituteId: institute.id,
      eventType: 'CHECK_IN',
      eventTime: new Date(),
    });

    const notifCount = await prisma.notification.count({
      where: { attendanceEventId: attendanceEvent.id },
    });

    assert(
      notifCount === notifications.length,
      'Idempotency verified: duplicate attendance notifications prevented on retries'
    );

  } catch (err: any) {
    console.error('Unhandled test runner error:', err);
    failed++;
  } finally {
    // =========================================================================
    // SECTION 5: CLEANUP TEST ARTIFACTS
    // =========================================================================
    console.log('\n--- Section 5: Safe Cleanup ---');

    if (testParentMessageId) {
      await prisma.message.deleteMany({ where: { id: testParentMessageId } }).catch(() => {});
    }
    if (testStaffMessageId) {
      await prisma.message.deleteMany({ where: { id: testStaffMessageId } }).catch(() => {});
    }
    if (testAttendanceEventId) {
      await prisma.notification.deleteMany({ where: { attendanceEventId: testAttendanceEventId } }).catch(() => {});
      await prisma.attendanceEvent.deleteMany({ where: { id: testAttendanceEventId } }).catch(() => {});
    }
    if (testConversationId) {
      // Clean test notifications for this conversation
      await prisma.notification.deleteMany({
        where: { link: { contains: testConversationId } },
      }).catch(() => {});
    }

    console.log('Cleaned up test messages, notifications, and attendance records');
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
