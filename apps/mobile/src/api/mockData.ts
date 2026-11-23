// Complete offline mock data for demo APK exploration

export const MOCK_STUDENT_DASHBOARD = {
  student: {
    id: 'stud-aarav-1',
    firstName: 'Aarav',
    lastName: 'Mehta',
    admissionNumber: 'APEX-101',
    rollNumber: '101',
    class: 'Grade 10',
    batchName: 'Grade 10 - Science Batch A',
    instituteName: 'Apex Tuition Academy',
  },
  todayAttendance: {
    status: 'PRESENT',
    checkInTime: '08:45 AM',
    checkOutTime: null,
  },
  attendanceStats: {
    presentDays: 22,
    totalDays: 24,
    percentage: 91.6,
  },
  upcomingSessions: [
    {
      id: 'sess-1',
      subject: 'Physics',
      time: '09:00 AM - 10:30 AM',
      teacher: 'Prof. Anita Verma',
      room: 'Lab 2',
      status: 'ONGOING',
    },
    {
      id: 'sess-2',
      subject: 'Mathematics',
      time: '11:00 AM - 12:30 PM',
      teacher: 'Dr. Rajesh Sharma',
      room: 'Room 104',
      status: 'UPCOMING',
    },
    {
      id: 'sess-3',
      subject: 'Chemistry',
      time: '02:00 PM - 03:30 PM',
      teacher: 'Mrs. Sunita Rao',
      room: 'Room 201',
      status: 'UPCOMING',
    },
  ],
  recentHomework: [
    {
      id: 'hw-1',
      title: 'Electromagnetic Induction Worksheet',
      subject: 'Physics',
      dueDate: 'Tomorrow, 05:00 PM',
      status: 'PENDING',
    },
    {
      id: 'hw-2',
      title: 'Quadratic Equations Exercise 4.2',
      subject: 'Mathematics',
      dueDate: 'Nov 25, 2026',
      status: 'SUBMITTED',
    },
  ],
  announcements: [
    {
      id: 'ann-1',
      title: 'Term 1 Mock Examinations',
      content: 'Term 1 Mock examination schedules have been published. Check your timetable tab.',
      date: 'Today',
      isUrgent: true,
    },
  ],
};

export const MOCK_STUDENT_TIMETABLE = {
  days: [
    {
      day: 'Monday',
      slots: [
        { id: 't1', time: '09:00 - 10:30', subject: 'Physics', teacher: 'Prof. Anita Verma', room: 'Lab 2' },
        { id: 't2', time: '11:00 - 12:30', subject: 'Mathematics', teacher: 'Dr. Rajesh Sharma', room: 'Room 104' },
      ],
    },
    {
      day: 'Tuesday',
      slots: [
        { id: 't3', time: '09:00 - 10:30', subject: 'Chemistry', teacher: 'Mrs. Sunita Rao', room: 'Room 201' },
        { id: 't4', time: '11:00 - 12:30', subject: 'Biology', teacher: 'Dr. Sneha Patil', room: 'Lab 1' },
      ],
    },
    {
      day: 'Wednesday',
      slots: [
        { id: 't5', time: '09:00 - 10:30', subject: 'Physics Lab', teacher: 'Prof. Anita Verma', room: 'Lab 2' },
        { id: 't6', time: '11:00 - 12:30', subject: 'Mathematics', teacher: 'Dr. Rajesh Sharma', room: 'Room 104' },
      ],
    },
  ],
};

export const MOCK_STUDENT_ATTENDANCE = {
  present: 22,
  absent: 2,
  late: 0,
  totalDays: 24,
  percentage: 91.6,
  records: [
    { date: '2026-11-23', status: 'PRESENT', checkInTime: '08:45 AM', checkOutTime: null },
    { date: '2026-11-22', status: 'PRESENT', checkInTime: '08:50 AM', checkOutTime: '03:30 PM' },
    { date: '2026-11-21', status: 'PRESENT', checkInTime: '08:42 AM', checkOutTime: '03:35 PM' },
    { date: '2026-11-20', status: 'ABSENT', checkInTime: null, checkOutTime: null },
    { date: '2026-11-19', status: 'PRESENT', checkInTime: '08:40 AM', checkOutTime: '03:30 PM' },
  ],
};

export const MOCK_STUDENT_PROFILE = {
  id: 'stud-aarav-1',
  firstName: 'Aarav',
  lastName: 'Mehta',
  admissionNumber: 'APEX-101',
  rollNumber: '101',
  email: 'student@apexacademy.com',
  phone: '9826444307',
  class: 'Grade 10',
  batchName: 'Grade 10 - Science Batch A',
  parentName: 'Vikram Mehta',
  parentPhone: '9826444306',
  institute: {
    name: 'Apex Tuition Academy',
    code: 'APEX01',
    address: '12 Academy Boulevard, Metro City',
  },
};

export const MOCK_MATERIALS = [
  {
    id: 'mat-1',
    title: 'Electromagnetism Chapter Complete Notes',
    subject: 'Physics',
    fileSize: '3.4 MB',
    fileType: 'PDF',
    uploadedAt: '2 days ago',
  },
  {
    id: 'mat-2',
    title: 'Quadratic Equations Formula Sheet',
    subject: 'Mathematics',
    fileSize: '1.2 MB',
    fileType: 'PDF',
    uploadedAt: '1 week ago',
  },
  {
    id: 'mat-3',
    title: 'Periodic Table Revision Flashcards',
    subject: 'Chemistry',
    fileSize: '4.8 MB',
    fileType: 'PDF',
    uploadedAt: '2 weeks ago',
  },
];

export const MOCK_HOMEWORK = [
  {
    id: 'hw-1',
    title: 'Electromagnetic Induction Worksheet',
    description: 'Solve problems 1 to 15 from Chapter 6. Show all intermediate formulas.',
    subject: 'Physics',
    dueDate: '2026-11-24T17:00:00Z',
    status: 'PENDING',
    assignedBy: 'Prof. Anita Verma',
  },
  {
    id: 'hw-2',
    title: 'Quadratic Equations Exercise 4.2',
    description: 'Complete all solved examples and exercise questions.',
    subject: 'Mathematics',
    dueDate: '2026-11-25T17:00:00Z',
    status: 'SUBMITTED',
    assignedBy: 'Dr. Rajesh Sharma',
  },
];

export const MOCK_PARENT_DASHBOARD = {
  children: [
    {
      id: 'stud-aarav-1',
      firstName: 'Aarav',
      lastName: 'Mehta',
      admissionNumber: 'APEX-101',
      class: 'Grade 10',
      batchName: 'Grade 10 - Science Batch A',
      attendancePercentage: 91.6,
      todayStatus: 'PRESENT',
      pendingHomeworkCount: 1,
      feeStatus: 'PAID',
    },
    {
      id: 'stud-diya-2',
      firstName: 'Diya',
      lastName: 'Mehta',
      admissionNumber: 'APEX-204',
      class: 'Grade 8',
      batchName: 'Grade 8 - Foundation Batch',
      attendancePercentage: 96.0,
      todayStatus: 'PRESENT',
      pendingHomeworkCount: 0,
      feeStatus: 'PAID',
    },
  ],
  notifications: [
    {
      id: 'n-1',
      title: 'Arrival Alert: Aarav Mehta',
      message: 'Aarav Mehta has safely arrived on campus at 08:45 AM.',
      time: '08:45 AM',
      type: 'ATTENDANCE',
    },
    {
      id: 'n-2',
      title: 'Homework Assigned',
      message: 'New Physics homework assigned: Electromagnetic Induction Worksheet.',
      time: 'Yesterday',
      type: 'HOMEWORK',
    },
  ],
  summary: {
    totalChildren: 2,
    allFeesClear: true,
    alertsCount: 1,
  },
};

export const MOCK_PARENT_CHILDREN = [
  {
    id: 'stud-aarav-1',
    firstName: 'Aarav',
    lastName: 'Mehta',
    admissionNumber: 'APEX-101',
    class: 'Grade 10',
    batchName: 'Grade 10 - Science Batch A',
  },
  {
    id: 'stud-diya-2',
    firstName: 'Diya',
    lastName: 'Mehta',
    admissionNumber: 'APEX-204',
    class: 'Grade 8',
    batchName: 'Grade 8 - Foundation Batch',
  },
];

export const MOCK_TEACHER_DASHBOARD = {
  teacher: {
    id: 'staff-anita-1',
    fullName: 'Prof. Anita Verma',
    designation: 'Senior Physics Lecturer',
    instituteName: 'Apex Tuition Academy',
  },
  todaySchedule: [
    {
      id: 'sched-1',
      batchName: 'Grade 10 - Science Batch A',
      subject: 'Physics',
      time: '09:00 AM - 10:30 AM',
      room: 'Lab 2',
      attendanceMarked: true,
      studentCount: 32,
    },
    {
      id: 'sched-2',
      batchName: 'Grade 12 - Advanced Physics',
      subject: 'Physics',
      time: '01:00 PM - 02:30 PM',
      room: 'Room 302',
      attendanceMarked: false,
      studentCount: 28,
    },
  ],
  activeBatches: [
    { id: 'b-1', name: 'Grade 10 - Science Batch A', studentCount: 32, subject: 'Physics' },
    { id: 'b-2', name: 'Grade 12 - Advanced Physics', studentCount: 28, subject: 'Physics' },
  ],
  pendingSubmissionsCount: 5,
};

export const MOCK_TEACHER_BATCHES = [
  {
    id: 'b-1',
    name: 'Grade 10 - Science Batch A',
    subject: 'Physics',
    totalStudents: 32,
    todayAttendanceMarked: true,
    room: 'Lab 2',
    schedule: 'Mon, Wed, Fri 09:00 - 10:30 AM',
  },
  {
    id: 'b-2',
    name: 'Grade 12 - Advanced Physics',
    subject: 'Physics',
    totalStudents: 28,
    todayAttendanceMarked: false,
    room: 'Room 302',
    schedule: 'Mon, Wed, Fri 01:00 - 02:30 PM',
  },
];

export const MOCK_TEACHER_PROFILE = {
  id: 'staff-anita-1',
  fullName: 'Prof. Anita Verma',
  designation: 'Senior Physics Lecturer',
  email: 'teacher@apexacademy.com',
  phone: '9876543210',
  qualification: 'M.Sc. Physics, B.Ed',
  department: 'Science & Physics',
  joinDate: 'Jan 2022',
  institute: {
    id: '11111111-1111-1111-1111-111111111111',
    code: 'APEX01',
    name: 'Apex Tuition Academy',
  },
};
