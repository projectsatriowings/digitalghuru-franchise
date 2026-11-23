/**
 * Digital Guru Franchise — Teacher Domain Types (Mobile)
 */

export interface TeacherProfile {
  id: string;
  employeeCode: string;
  designation: string | null;
  avatarUrl: string | null;
  dob: string | null;
  gender: string | null;
  altPhone: string | null;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    role: string;
  };
  institute: {
    id: string;
    name: string;
    code: string;
    phone?: string | null;
    email?: string | null;
  };
  assignedBatches: Array<{
    id: string;
    name: string;
    code: string;
    academicYear?: string | null;
    schedule?: string | null;
  }>;
  assignedSubjects: Array<{
    batchId: string;
    batchName: string;
    subjectId: string;
    subjectName: string;
    subjectCode?: string | null;
  }>;
}

export interface TeacherClassSlot {
  day?: string;
  startTime: string;
  endTime: string;
  subject: string;
  batchId?: string;
  batchName: string;
  teacherName?: string | null;
  room?: string | null;
}

export interface TeacherMetrics {
  totalBatches: number;
  totalSubjects: number;
  totalStudents: number;
  pendingHomeworkEvaluations: number;
  todayClassesCount: number;
  todayAttendance: {
    presentCount: number;
    lateCount: number;
    totalEnrolled: number;
    percentage: number;
  };
}

export interface TeacherDashboardData {
  teacher: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    employeeCode: string;
    designation: string | null;
    avatarUrl: string | null;
  };
  institute: {
    id: string;
    name: string;
    code: string;
  };
  metrics: TeacherMetrics;
  todayClasses: TeacherClassSlot[];
  recentNotifications: any[];
}

export interface TeacherBatchItem {
  id: string;
  name: string;
  code: string;
  academicYear?: string | null;
  schedule?: string | null;
  studentsCount?: number;
  batchSubjects?: Array<{
    id: string;
    subject: {
      id: string;
      name: string;
      code: string;
    };
  }>;
}

export interface TeacherStudentItem {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  admissionNumber: string;
  photoUrl: string | null;
  phone: string | null;
  status: string;
  batchId?: string;
  batchName: string;
  subjectName?: string | null;
  todayStatus: 'PRESENT' | 'DEPARTED' | 'NOT_MARKED' | 'ABSENT';
  isLate: boolean;
  checkInTimeFormatted: string | null;
}

export interface VoiceMatchCandidate {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  phone?: string | null;
  photoUrl?: string | null;
  status: string;
  batchId?: string;
  batchName: string;
  subjectName?: string | null;
  alreadyCheckedIn: boolean;
  alreadyCheckedOut: boolean;
  checkInTimeFormatted: string | null;
  checkOutTimeFormatted: string | null;
  todayStatus: string;
  recommendedAction: 'CHECK_IN' | 'CHECK_OUT' | 'COMPLETED';
}

export interface VoiceMatchResult {
  success: boolean;
  status: 'EXACT_SINGLE' | 'EXACT_MULTIPLE' | 'NO_MATCH';
  matchCount: number;
  bestMatch?: VoiceMatchCandidate;
  matches?: VoiceMatchCandidate[];
  autoActionEligible?: boolean;
  message?: string;
  cleanedQuery?: string;
}

export interface TeacherHomeworkItem {
  id: string;
  title: string;
  description?: string | null;
  batchId: string;
  batch?: { id: string; name: string };
  subjectId?: string | null;
  subject?: { id: string; name: string };
  dueDate: string;
  maxMarks?: number | null;
  fileUrl?: string | null;
  createdAt: string;
  submissionsCount?: number;
  evaluatedCount?: number;
}

export interface TeacherSubmissionItem {
  id: string;
  studentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    fullName?: string;
    admissionNumber: string;
    photoUrl?: string | null;
  };
  submittedAt: string;
  fileUrl?: string | null;
  studentNotes?: string | null;
  score?: number | null;
  feedback?: string | null;
  gradedAt?: string | null;
}

export interface TeacherMaterialItem {
  id: string;
  title: string;
  description?: string | null;
  fileUrl: string;
  fileType: string;
  fileSize?: number | null;
  batchId: string;
  batch?: { id: string; name: string };
  subjectId?: string | null;
  subject?: { id: string; name: string };
  createdAt: string;
}

export interface TeacherProgressItem {
  id: string;
  studentId: string;
  student?: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
  };
  batchId: string;
  batch?: { id: string; name: string };
  category: string;
  rating?: number | null;
  remarks: string;
  isPublished?: boolean;
  createdAt: string;
}
