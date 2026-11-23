/**
 * Digital Guru Franchise — Student Domain Types (Mobile)
 */

export interface StudentProfileSummary {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string | null;
  dob?: string | null;
  admissionDate?: string | null;
  status: string;
  photoUrl?: string | null;
  gender?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

export interface StudentInstituteSummary {
  id: string;
  name: string;
  code: string;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
}

export interface StudentBatchSummary {
  id: string;
  name: string;
  academicYear?: string | null;
  rawSchedule?: string | null;
}

export interface TimetableSlotItem {
  id: string;
  subjectName: string;
  batchName: string;
  teacherName?: string | null;
  timeDisplay: string;
  startTime?: string | null;
  endTime?: string | null;
  rawSchedule?: string | null;
  isParsed: boolean;
  isUpcomingToday?: boolean;
}

export interface DayTimetableItem {
  day: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  label: string;
  isToday: boolean;
  slots: TimetableSlotItem[];
}

export interface StructuredTimetable {
  batchId: string | null;
  batchName: string;
  academicYear: string | null;
  rawSchedule: string | null;
  isParsed: boolean;
  unparsedWarning?: string | null;
  days: DayTimetableItem[];
  todaySlots: TimetableSlotItem[];
}

export interface AttendanceEventItem {
  id: string;
  eventType: 'CHECK_IN' | 'CHECK_OUT';
  eventDate: string;
  eventTime: string;
  sessionNumber?: number;
  method: 'MANUAL' | 'QR_SCAN' | 'VOICE_CONFIRMED';
  isLate: boolean;
  remarks?: string | null;
  batch?: { id: string; name: string } | null;
}

export interface AttendanceOverview {
  totalDays: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  percentage: number;
  recentEvents: AttendanceEventItem[];
}

export interface AttendanceHistoryData {
  stats: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    lateDays: number;
    percentage: number;
  };
  events: AttendanceEventItem[];
}

export interface HomeworkItem {
  id: string;
  title: string;
  description?: string | null;
  subject: string;
  dueDate: string;
  isSubmitted: boolean;
  submissionStatus: 'PENDING' | 'SUBMITTED' | 'EVALUATED' | 'RESUBMISSION_REQUESTED';
  grade?: string | null;
  feedback?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  materialId?: string;
  submittedAt?: string | null;
  submissionFileUrl?: string | null;
}

export interface HomeworkOverview {
  totalCount: number;
  pendingCount: number;
  submittedCount: number;
  upcoming: HomeworkItem[];
}

export interface LearningMaterialItem {
  id: string;
  title: string;
  description?: string | null;
  type: 'DOCUMENT' | 'WORKSHEET' | 'NOTES' | 'ASSIGNMENT' | 'SYLLABUS' | 'HOMEWORK' | 'OTHER';
  fileSize?: number | null;
  mimeType?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  subject?: string;
  createdAt: string;
}

export interface AcademicMarkItem {
  id: string;
  examTitle: string;
  subjectName: string;
  examDate: string;
  marksObtained: number;
  totalMarks: number;
  passingMarks: number;
  isAbsent: boolean;
  remarks?: string | null;
}

export interface AcademicProgressData {
  recentMarks: AcademicMarkItem[];
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type?: string;
  isRead: boolean;
  createdAt: string;
  data?: any;
}

export interface NotificationsOverview {
  unreadCount: number;
  recent: NotificationItem[];
}

export interface StudentDashboardData {
  student: StudentProfileSummary;
  institute: StudentInstituteSummary | null;
  batch: StudentBatchSummary | null;
  todayClasses: TimetableSlotItem[];
  attendanceOverview: AttendanceOverview;
  homeworkOverview: HomeworkOverview;
  recentMaterials: LearningMaterialItem[];
  academicProgress: AcademicProgressData;
  notificationsOverview: NotificationsOverview;
}

export interface StudentProfileFull extends StudentProfileSummary {
  user?: {
    id: string;
    email: string;
    phone?: string | null;
    fullName: string;
  };
  institute?: StudentInstituteSummary;
  enrollments?: Array<{
    id: string;
    isActive: boolean;
    batch: {
      id: string;
      name: string;
      code: string;
      schedule?: string | null;
      batchSubjects?: Array<{
        subject: { id: string; name: string; code: string };
        staffProfile?: { user?: { fullName: string } };
      }>;
    };
    subject?: { id: string; name: string; code: string } | null;
  }>;
  parentRelations?: Array<{
    relationshipType: string;
    isPrimaryContact: boolean;
    parent: {
      id: string;
      user: { fullName: string; phone?: string | null; email: string };
    };
  }>;
}
