/**
 * Digital Guru Franchise — Parent Domain Types (Mobile)
 */

export interface ParentChildSummary {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  gender?: string | null;
  photoUrl?: string | null;
  batchName: string;
  relationship: string;
  todayAttendance: {
    status: 'CHECKED_IN' | 'CHECKED_OUT' | 'NOT_MARKED' | 'LATE';
    checkInTime: string | null;
    checkOutTime: string | null;
    isLate: boolean;
  };
  monthlyAttendance: {
    presentDays: number;
    totalWorkingDays: number;
    percentage: number;
  };
  fees: {
    pendingAmount: number;
    pendingAssignmentsCount: number;
  };
  latestExamResult: {
    examTitle: string;
    subject: string;
    score: number;
    totalMarks: number;
    percentage: number;
    examDate: string;
    isAbsent: boolean;
  } | null;
}

export interface ParentChildItem {
  relationship: string;
  isPrimaryContact: boolean;
  canReceiveSms: boolean;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    fullName?: string;
    admissionNumber: string;
    photoUrl?: string | null;
    gender?: string | null;
    institute?: {
      id: string;
      name: string;
      code: string;
      phone?: string | null;
    };
    enrollments?: Array<{
      batch: {
        id: string;
        name: string;
        academicYear?: string | null;
      };
    }>;
  };
}

export interface ParentDashboardSummary {
  parent: {
    id: string;
    fullName: string;
    email?: string | null;
    phone: string;
  };
  children: ParentChildSummary[];
  financialOverview: {
    totalOutstandingFees: number;
    nextUpcomingDueDate: string | null;
  };
  unreadCounts: {
    messages: number;
    notifications: number;
  };
}

export interface ParentCalendarDay {
  date: string;
  day: number;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HOLIDAY_OR_NO_SESSION';
  checkIn: string | null;
  checkOut: string | null;
  isLate: boolean;
  remarks?: string | null;
}

export interface ParentAttendanceData {
  month: number;
  year: number;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    batchName: string;
  };
  metrics: {
    totalWorkingDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    attendancePercentage: number;
  };
  calendar: ParentCalendarDay[];
}

export interface ParentExamMarkItem {
  id: string;
  examTitle: string;
  examType: string;
  subject: string;
  examDate: string;
  marksObtained: number;
  totalMarks: number;
  passingMarks: number;
  percentage: number;
  isPassed: boolean;
  isAbsent: boolean;
  remarks?: string | null;
}

export interface ParentFeedbackReviewItem {
  id: string;
  termName?: string | null;
  periodType: string;
  teacher: string;
  remarks?: string | null;
  rating?: number | null;
  strengths?: string | null;
  improvements?: string | null;
  recommendations?: string | null;
  attendanceRate?: number | null;
  homeworkRate?: number | null;
  examAverage?: number | null;
  date: string;
}

export interface ParentAcademicsData {
  summary?: any;
  teacherEvaluations?: any[];
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    batchName: string;
    batchSchedule?: string | null;
  };
  subjects: Array<{
    id: string;
    name: string;
    code: string;
    schedule: string;
    teacher: string;
  }>;
  homework: Array<{
    id: string;
    title: string;
    description?: string | null;
    type: string;
    subject: string;
    teacher: string;
    dueDate?: string | null;
    createdAt: string;
    submissionStatus: string;
    submittedAt?: string | null;
    grade?: string | null;
    teacherFeedback?: string | null;
  }>;
  feedbacks: ParentFeedbackReviewItem[];
  upcomingExams: Array<{
    id: string;
    title: string;
    examType: string;
    subject: string;
    examDate: string;
    totalMarks: number;
    passingMarks: number;
  }>;
  marks: ParentExamMarkItem[];
}

export interface ParentHomeworkItem {
  id: string;
  title: string;
  description?: string | null;
  subject: string | { id?: string; name: string };
  teacherName: string;
  dueDate?: string | null;
  maxMarks?: number | null;
  submission?: {
    score?: number | null;
    submittedAt: string;
    feedback?: string | null;
  } | null;
  createdAt: string;
  fileUrl?: string | null;
  fileName?: string | null;
  isSubmitted: boolean;
  submissionStatus: 'PENDING' | 'SUBMITTED' | 'EVALUATED' | 'OVERDUE';
  submittedAt?: string | null;
  grade?: string | null;
  feedback?: string | null;
  submissionFileUrl?: string | null;
  isLate?: boolean;
}

export interface ParentFeeStatementItem {
  id: string;
  feeStructureName: string;
  feeStructure?: { id: string; name: string };
  amount?: number;
  balance?: number;
  term?: string | null;
  academicYear?: string | null;
  assignedAmount: number;
  discountAmount: number;
  finalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: 'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
}

export interface ParentFeeStatement {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
    batches: Array<{ id: string; name: string }>;
  };
  summary: {
    totalAssigned: number;
    totalDiscount: number;
    totalPayable: number;
    totalPaid: number;
    totalRefunded: number;
    netOutstanding: number;
  };
  statementItems: ParentFeeStatementItem[];
}

export interface ParentPaymentItem {
  id: string;
  receiptNumber: string;
  paymentDate: string;
  amountPaid: number;
  amount?: number;
  paymentMethod: string;
  paymentMode?: string;
  status: string;
  transactionReference?: string | null;
  transactionRef?: string | null;
  receiptUrl?: string | null;
  feeStructureName?: string;
}

export interface ParentInquiryItem {
  id: string;
  studentId: string;
  category: string;
  feedbackText: string;
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'ACKNOWLEDGED';
  responseText?: string | null;
  subject?: string;
  message?: string;
  response?: string;
  createdAt: string;
  respondedAt?: string | null;
  staffResponder?: {
    fullName: string;
  } | null;
}

export interface CreateParentInquiryPayload {
  studentId: string;
  category: string;
  subject?: string;
  message?: string;
  feedbackText?: string;
  teacherId?: string;
}

export interface ParentTeacherItem {
  id: string;
  fullName: string;
  user?: { fullName: string };
  email?: string | null;
  phone?: string | null;
  subjects: Array<string | { id?: string; name: string }>;
  designation?: string | null;
}
