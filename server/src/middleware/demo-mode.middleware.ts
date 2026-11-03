import { Request, Response, NextFunction } from 'express';
import { generateAccessToken, generateRefreshToken } from '../utils/security.js';
import { InAppNotificationService } from '../modules/notifications/inapp-notification.service.js';

export const isDemoModeActive = () => {
  return !process.env.DATABASE_URL || !process.env.DATABASE_URL.startsWith('postgres');
};

const DEMO_INSTITUTE = {
  id: '11111111-1111-1111-1111-111111111111',
  code: 'APEX01',
  name: 'Apex Tuition Academy',
  status: 'ACTIVE',
};

const DEMO_ACCOUNTS_MAP: Record<string, any> = {
  'teacher@apexacademy.com': {
    id: '22222222-2222-2222-2222-222222222222',
    fullName: 'Prof. Anita Verma',
    email: 'teacher@apexacademy.com',
    phone: '9876543210',
    role: 'STAFF',
    password: 'Password#123',
    isActive: true,
  },
  'admin@apexacademy.com': {
    id: '33333333-3333-3333-3333-333333333333',
    fullName: 'Dr. Rajesh Sharma',
    email: 'admin@apexacademy.com',
    phone: '9876543211',
    role: 'ACADEMIC_ADMIN',
    password: 'Password#123',
    isActive: true,
  },
  'superadmin@platform.local': {
    id: '44444444-4444-4444-4444-444444444444',
    fullName: 'Super Administrator',
    email: 'superadmin@platform.local',
    phone: '9876543212',
    role: 'SUPER_ADMIN',
    password: 'AdminSecurePassword#2026',
    isActive: true,
  },
  '9826444306': {
    id: '55555555-5555-5555-5555-555555555555',
    fullName: 'Vikram Mehta',
    email: 'parent@apexacademy.com',
    phone: '9826444306',
    role: 'PARENT',
    password: 'Password#123',
    isActive: true,
  },
  'parent@apexacademy.com': {
    id: '55555555-5555-5555-5555-555555555555',
    fullName: 'Vikram Mehta',
    email: 'parent@apexacademy.com',
    phone: '9826444306',
    role: 'PARENT',
    password: 'Password#123',
    isActive: true,
  },
  'student@apexacademy.com': {
    id: '66666666-6666-6666-6666-666666666666',
    fullName: 'Aarav Mehta',
    email: 'student@apexacademy.com',
    phone: '9826444307',
    role: 'STUDENT',
    password: 'Password#123',
    isActive: true,
  },
};

const demoStudent = {
  id: 'stud-aarav-1',
  firstName: 'Aarav',
  lastName: 'Mehta',
  admissionNumber: 'APEX-101',
  status: 'ACTIVE',
  enrollments: [
    {
      id: 'enr-1',
      batch: { id: 'batch-10-a', name: 'Grade 10 - Science Batch A' },
    },
  ],
};

const demoTeacher = {
  id: 'staff-anita-1',
  userId: '22222222-2222-2222-2222-222222222222',
  fullName: 'Prof. Anita Verma',
  designation: 'Senior Physics Lecturer',
  subjects: ['Physics', 'Science'],
  batchName: 'Grade 10 - Science Batch A',
  user: {
    id: '22222222-2222-2222-2222-222222222222',
    fullName: 'Prof. Anita Verma',
    role: 'STAFF',
  },
};

let demoAttendanceState = {
  status: 'CHECKED_IN',
  checkInTime: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  checkOutTime: null as string | null,
};

let demoNotifications = [
  {
    id: 'notif-1',
    title: 'Student Check-in Alert',
    message: 'Your child Aarav Mehta checked in at 09:00 AM.',
    type: 'ATTENDANCE',
    isRead: false,
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    link: '/attendance',
  },
];

let demoConversations = [
  {
    id: 'conv-demo-1',
    title: 'Discussion regarding Aarav Mehta (Physics)',
    otherUser: {
      id: '22222222-2222-2222-2222-222222222222',
      fullName: 'Prof. Anita Verma',
      role: 'STAFF',
    },
    lastMessage: {
      id: 'msg-1',
      body: 'Hello Mr. Mehta, Aarav has been doing great in physics derivations.',
      createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
    },
    isUnread: false,
  },
];

let demoMessages = [
  {
    id: 'msg-1',
    conversationId: 'conv-demo-1',
    senderId: '22222222-2222-2222-2222-222222222222',
    body: 'Hello Mr. Mehta, Aarav has been doing great in physics derivations.',
    createdAt: new Date(Date.now() - 7200 * 1000).toISOString(),
    sender: { fullName: 'Prof. Anita Verma', role: 'STAFF' },
    isReadByRecipient: true,
  },
];

let demoFeedbacks = [
  {
    id: 'fb-demo-1',
    studentId: 'stud-aarav-1',
    category: 'Teaching Method',
    feedbackText: 'Can Aarav get extra practice problems on projectile motion?',
    status: 'RESPONDED',
    teacherResponse: 'Certainly! I have scheduled 15 minutes after class on Friday for extra numerical practice.',
    respondedAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    respondedBy: { fullName: 'Prof. Anita Verma', role: 'STAFF' },
    createdAt: new Date(Date.now() - 86400 * 1000).toISOString(),
    student: { id: 'stud-aarav-1', firstName: 'Aarav', lastName: 'Mehta', admissionNumber: 'APEX-101' },
    parent: { user: { fullName: 'Vikram Mehta', phone: '9826444306' } },
  },
];

export function demoModeMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!isDemoModeActive()) {
    return next();
  }

  const p = req.path;
  const method = req.method;

  // 1. Auth: Login
  if (method === 'POST' && p === '/api/auth/login') {
    const { identifier, password } = req.body || {};
    const key = (identifier || '').trim().toLowerCase();
    const demoUser = DEMO_ACCOUNTS_MAP[key] || DEMO_ACCOUNTS_MAP['teacher@apexacademy.com'];

    const tokenPayload = {
      userId: demoUser.id,
      email: demoUser.email,
      phone: demoUser.phone,
      role: demoUser.role,
      instituteId: DEMO_INSTITUTE.id,
    };

    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    return res.json({
      success: true,
      message: 'Demo login successful',
      data: {
        accessToken,
        refreshToken,
        mustChangePassword: false,
        user: {
          id: demoUser.id,
          fullName: demoUser.fullName,
          email: demoUser.email,
          phone: demoUser.phone,
          role: demoUser.role,
          mustChangePassword: false,
          memberships: [{ id: 'mem-1', role: demoUser.role, institute: DEMO_INSTITUTE }],
        },
        institute: DEMO_INSTITUTE,
        memberships: [{ id: 'mem-1', role: demoUser.role, institute: DEMO_INSTITUTE }],
      },
    });
  }

  // 2. Auth: Me
  if (method === 'GET' && p === '/api/auth/me') {
    const authHeader = req.headers['authorization'];
    let role = 'STAFF';
    let userObj = DEMO_ACCOUNTS_MAP['teacher@apexacademy.com'];

    if (req.headers['x-demo-role']) {
      role = req.headers['x-demo-role'] as string;
    }

    return res.json({
      success: true,
      data: {
        user: {
          ...userObj,
          memberships: [{ id: 'mem-1', role: userObj.role, institute: DEMO_INSTITUTE }],
        },
      },
    });
  }

  // 3. Parent: Children
  if (method === 'GET' && p === '/api/parents/my/children') {
    return res.json({
      success: true,
      data: {
        children: [
          {
            id: 'rel-1',
            relationship: 'Father',
            student: demoStudent,
          },
        ],
      },
    });
  }

  // 4. Parent: Dashboard summary
  if (method === 'GET' && p === '/api/parents/my/dashboard-summary') {
    return res.json({
      success: true,
      data: {
        parent: { fullName: 'Vikram Mehta' },
        unreadCounts: { notifications: demoNotifications.filter((n) => !n.isRead).length },
        children: [
          {
            studentId: demoStudent.id,
            todayAttendance: demoAttendanceState,
            monthlyAttendance: { percentage: 96, presentDays: 24, totalDays: 25 },
            fees: { totalDue: 15000, status: 'PARTIAL' },
            latestExamResult: { examTitle: 'Term 1 Mid-Exam', percentage: 91, status: 'DISTINCTION' },
          },
        ],
      },
    });
  }

  // 5. Parent: Teachers
  if (method === 'GET' && p.startsWith('/api/parents/students/') && p.endsWith('/teachers')) {
    return res.json({
      success: true,
      data: {
        teachers: [demoTeacher],
      },
    });
  }

  // 6. Parent: Attendance monthly report
  if (method === 'GET' && p.startsWith('/api/parents/students/') && p.endsWith('/attendance')) {
    return res.json({
      success: true,
      data: {
        stats: { presentCount: 22, lateCount: 1, absentCount: 1, attendancePercentage: 96 },
        calendar: [
          { date: '2026-10-29', status: demoAttendanceState.status, checkInTime: demoAttendanceState.checkInTime, checkOutTime: demoAttendanceState.checkOutTime },
          { date: '2026-10-28', status: 'CHECKED_OUT', checkInTime: '2026-10-28T03:30:00Z', checkOutTime: '2026-10-28T08:30:00Z' },
          { date: '2026-10-27', status: 'CHECKED_OUT', checkInTime: '2026-10-27T03:35:00Z', checkOutTime: '2026-10-27T08:30:00Z' },
        ],
      },
    });
  }

  // 7. Fees statement
  if (method === 'GET' && p.startsWith('/api/fees/students/') && p.endsWith('/statement')) {
    return res.json({
      success: true,
      data: {
        summary: { totalFees: 45000, totalPaid: 30000, totalDue: 15000, status: 'PARTIAL' },
        terms: [
          { id: 't-1', termName: 'Term 1', amountDue: 15000, amountPaid: 15000, status: 'PAID' },
          { id: 't-2', termName: 'Term 2', amountDue: 15000, amountPaid: 15000, status: 'PAID' },
          { id: 't-3', termName: 'Term 3', amountDue: 15000, amountPaid: 0, status: 'DUE' },
        ],
        payments: [
          { id: 'pay-1', receiptNumber: 'REC-2026-001', amount: 15000, paymentMethod: 'UPI', status: 'COMPLETED', paymentDate: '2026-05-10' },
        ],
      },
    });
  }

  // 8. Notifications
  if (method === 'GET' && p === '/api/notifications') {
    return res.json({
      success: true,
      data: {
        notifications: demoNotifications,
        unreadCount: demoNotifications.filter((n) => !n.isRead).length,
      },
    });
  }

  if (method === 'GET' && p === '/api/notifications/unread-count') {
    return res.json({
      success: true,
      data: { unreadCount: demoNotifications.filter((n) => !n.isRead).length },
    });
  }

  if (method === 'PATCH' && p.startsWith('/api/notifications/') && p.endsWith('/read')) {
    demoNotifications.forEach((n) => (n.isRead = true));
    return res.json({ success: true, message: 'Notification marked as read' });
  }

  if ((method === 'PATCH' || method === 'POST') && (p === '/api/notifications/read-all' || p === '/api/notifications/mark-all-read')) {
    demoNotifications.forEach((n) => (n.isRead = true));
    return res.json({ success: true, message: 'All notifications marked as read' });
  }

  // 9. Feedback
  if (method === 'GET' && p === '/api/feedback') {
    return res.json({
      success: true,
      data: { feedbacks: demoFeedbacks },
    });
  }

  if (method === 'POST' && p === '/api/feedback') {
    const { category, feedbackText } = req.body || {};
    const newFb = {
      id: `fb-demo-${Date.now()}`,
      studentId: demoStudent.id,
      category: category || 'General Feedback',
      feedbackText: feedbackText || 'Demo inquiry text',
      status: 'OPEN',
      teacherResponse: null,
      respondedAt: null,
      respondedBy: null,
      createdAt: new Date().toISOString(),
      student: { id: demoStudent.id, firstName: 'Aarav', lastName: 'Mehta', admissionNumber: 'APEX-101' },
      parent: { user: { fullName: 'Vikram Mehta', phone: '9826444306' } },
    };
    demoFeedbacks.unshift(newFb as any);
    return res.json({ success: true, data: { feedback: newFb } });
  }

  if (method === 'POST' && p.startsWith('/api/feedback/') && p.endsWith('/respond')) {
    const parts = p.split('/');
    const fbId = parts[3];
    const { response, status } = req.body || {};
    const fb = demoFeedbacks.find((f) => f.id === fbId) || demoFeedbacks[0];
    if (fb) {
      fb.teacherResponse = response;
      fb.status = status || 'RESPONDED';
      fb.respondedAt = new Date().toISOString();
      (fb as any).respondedBy = { fullName: 'Prof. Anita Verma', role: 'STAFF' };
    }
    return res.json({ success: true, data: { feedback: fb } });
  }

  if (method === 'PATCH' && p.startsWith('/api/feedback/') && p.endsWith('/status')) {
    const parts = p.split('/');
    const fbId = parts[3];
    const { status } = req.body || {};
    const fb = demoFeedbacks.find((f) => f.id === fbId) || demoFeedbacks[0];
    if (fb) {
      fb.status = status || 'RESOLVED';
    }
    return res.json({ success: true, data: { feedback: fb } });
  }

  // 10. Messaging
  if (method === 'GET' && p === '/api/messaging/conversations') {
    return res.json({
      success: true,
      data: { conversations: demoConversations },
    });
  }

  if (method === 'POST' && p === '/api/messaging/conversations') {
    return res.json({
      success: true,
      data: { conversation: demoConversations[0] },
    });
  }

  if (method === 'GET' && p.startsWith('/api/messaging/conversations/') && p.endsWith('/messages')) {
    return res.json({
      success: true,
      data: { messages: demoMessages },
    });
  }

  if (method === 'POST' && p.startsWith('/api/messaging/conversations/') && p.endsWith('/messages')) {
    const { body } = req.body || {};
    const newMsg = {
      id: `msg-${Date.now()}`,
      conversationId: 'conv-demo-1',
      senderId: 'demo-user',
      body: body || '',
      createdAt: new Date().toISOString(),
      sender: { fullName: 'You', role: 'STAFF' },
      isReadByRecipient: false,
    };
    demoMessages.push(newMsg as any);
    demoConversations[0].lastMessage = { id: newMsg.id, body: newMsg.body, createdAt: newMsg.createdAt };
    return res.json({ success: true, data: { message: newMsg } });
  }

  if (method === 'GET' && p === '/api/parents') {
    return res.json({
      success: true,
      data: {
        parents: [
          {
            user: { id: '55555555-5555-5555-5555-555555555555', fullName: 'Vikram Mehta' },
            studentRelations: [{ student: { firstName: 'Aarav' } }],
          },
        ],
      },
    });
  }

  if (method === 'GET' && p === '/api/staff') {
    return res.json({
      success: true,
      data: { staff: [demoTeacher] },
    });
  }

  if (method === 'GET' && (p === '/api/academics/batches' || p === '/api/batches')) {
    return res.json({
      success: true,
      data: {
        batches: [
          { id: 'batch-10-a', name: 'Grade 10 - Science Batch A', academicYear: '2026-2027', _count: { enrollments: 24 } },
        ],
      },
    });
  }

  if (method === 'GET' && p === '/api/students') {
    return res.json({
      success: true,
      data: {
        students: [demoStudent],
      },
    });
  }

  // 11. Attendance Check-In / Check-Out
  if (method === 'POST' && p === '/api/attendance/check-in') {
    const now = new Date();
    const timeStr = InAppNotificationService.formatKolkataTime(now);
    demoAttendanceState.status = 'CHECKED_IN';
    demoAttendanceState.checkInTime = now.toISOString();
    demoAttendanceState.checkOutTime = null;

    demoNotifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'Student Check-in Alert',
      message: `Your child Aarav Mehta checked in at ${timeStr}.`,
      type: 'ATTENDANCE',
      isRead: false,
      createdAt: now.toISOString(),
      link: '/attendance',
    });

    return res.json({
      success: true,
      message: `Aarav Mehta checked in at ${timeStr}.`,
      data: {
        event: { id: `att-${Date.now()}`, eventType: 'CHECK_IN', eventTime: now },
        student: demoStudent,
      },
    });
  }

  if (method === 'POST' && p === '/api/attendance/check-out') {
    const now = new Date();
    const timeStr = InAppNotificationService.formatKolkataTime(now);
    demoAttendanceState.status = 'CHECKED_OUT';
    demoAttendanceState.checkOutTime = now.toISOString();

    demoNotifications.unshift({
      id: `notif-${Date.now()}`,
      title: 'Student Check-out Alert',
      message: `Your child Aarav Mehta checked out at ${timeStr}.`,
      type: 'ATTENDANCE',
      isRead: false,
      createdAt: now.toISOString(),
      link: '/attendance',
    });

    return res.json({
      success: true,
      message: `Aarav Mehta checked out at ${timeStr}.`,
      data: {
        event: { id: `att-${Date.now()}`, eventType: 'CHECK_OUT', eventTime: now },
        student: demoStudent,
      },
    });
  }

  next();
}
