import { apiClient } from './client';
import {
  TeacherProfile,
  TeacherDashboardData,
  TeacherBatchItem,
  TeacherStudentItem,
  VoiceMatchResult,
  TeacherHomeworkItem,
  TeacherSubmissionItem,
  TeacherMaterialItem,
  TeacherProgressItem,
} from '../types/teacher';
import { NotificationItem } from '../types/student';
import { ApiResponse } from '../types/auth';

/**
 * Fetch authenticated teacher profile
 * GET /api/staff/my/profile
 */
export async function getTeacherProfileApi(): Promise<TeacherProfile> {
  const response = await apiClient.get<ApiResponse<{ profile: TeacherProfile }>>('/staff/my/profile');
  if (!response.data.success || !response.data.data?.profile) {
    throw new Error(response.data.error || 'Failed to load teacher profile');
  }
  return response.data.data.profile;
}

/**
 * Fetch aggregated teacher dashboard data
 * GET /api/staff/my/dashboard
 */
export async function getTeacherDashboardApi(): Promise<TeacherDashboardData> {
  const response = await apiClient.get<ApiResponse<TeacherDashboardData>>('/staff/my/dashboard');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to load teacher dashboard');
  }
  return response.data.data;
}

/**
 * Fetch batches assigned to authenticated teacher
 * GET /api/academics/batches
 */
export async function getTeacherBatchesApi(): Promise<TeacherBatchItem[]> {
  const response = await apiClient.get<ApiResponse<{ batches: TeacherBatchItem[] }>>('/academics/batches');
  if (!response.data.success || !response.data.data?.batches) {
    throw new Error(response.data.error || 'Failed to load assigned batches');
  }
  return response.data.data.batches;
}

/**
 * Fetch batch details
 * GET /api/academics/batches/:id
 */
export async function getTeacherBatchDetailsApi(batchId: string): Promise<any> {
  const response = await apiClient.get<ApiResponse<any>>(`/academics/batches/${batchId}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to load batch details');
  }
  return response.data.data;
}

/**
 * Fetch students enrolled in teacher's assigned batches
 * GET /api/staff/my/students
 */
export async function getTeacherStudentsApi(batchId?: string, search?: string): Promise<TeacherStudentItem[]> {
  const params: any = {};
  if (batchId) params.batchId = batchId;
  if (search) params.search = search;

  const response = await apiClient.get<ApiResponse<{ students: TeacherStudentItem[] }>>('/staff/my/students', {
    params,
  });
  if (!response.data.success || !response.data.data?.students) {
    throw new Error(response.data.error || 'Failed to load students');
  }
  return response.data.data.students;
}

/**
 * Fetch authorized student details
 * GET /api/students/:id
 */
export async function getStudentDetailsApi(studentId: string): Promise<any> {
  const response = await apiClient.get<ApiResponse<any>>(`/students/${studentId}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to load student details');
  }
  return response.data.data.student || response.data.data;
}

/**
 * Fetch teacher weekly timetable
 * GET /api/staff/my/timetable
 */
export async function getTeacherTimetableApi(): Promise<any> {
  const response = await apiClient.get<ApiResponse<any>>('/staff/my/timetable');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to load timetable');
  }
  return response.data.data;
}

/**
 * Match spoken student name in authorized scope
 * POST /api/attendance/voice-match
 */
export async function voiceMatchStudentsApi(
  transcript: string,
  batchId?: string,
  subjectId?: string
): Promise<VoiceMatchResult> {
  const response = await apiClient.post<VoiceMatchResult>('/attendance/voice-match', {
    transcript,
    batchId,
    subjectId,
  });
  return response.data;
}

/**
 * Record check-in attendance
 * POST /api/attendance/check-in
 */
export async function checkInStudentApi(payload: {
  studentId: string;
  batchId: string;
  method?: 'VOICE_CONFIRMED' | 'MANUAL';
  subjectId?: string;
}): Promise<any> {
  const response = await apiClient.post('/attendance/check-in', payload);
  return response.data;
}

/**
 * Record check-out attendance
 * POST /api/attendance/check-out
 */
export async function checkOutStudentApi(payload: {
  studentId: string;
  batchId?: string;
}): Promise<any> {
  const response = await apiClient.post('/attendance/check-out', payload);
  return response.data;
}

/**
 * Fetch attendance reports for batch & date
 * GET /api/attendance/reports?batchId=...&date=...
 */
export async function getTeacherAttendanceReportsApi(batchId: string, date: string): Promise<any> {
  const response = await apiClient.get<ApiResponse<any>>('/attendance/reports', {
    params: { batchId, date },
  });
  return response.data?.data || response.data;
}

/**
 * Fetch homework assignments for batch
 * GET /api/homework?batchId=...
 */
export async function getTeacherHomeworkApi(batchId?: string): Promise<TeacherHomeworkItem[]> {
  const params: any = {};
  if (batchId) params.batchId = batchId;

  const response = await apiClient.get<any>('/homework', {
    params,
  });
  const rawData = response.data;
  if (Array.isArray(rawData)) return rawData;
  if (rawData?.data?.homework && Array.isArray(rawData.data.homework)) {
    return rawData.data.homework;
  }
  if (rawData && Array.isArray(rawData.data)) {
    return rawData.data;
  }
  return [];
}

/**
 * Create homework assignment
 * POST /api/homework
 */
export async function createTeacherHomeworkApi(payload: FormData): Promise<any> {
  const response = await apiClient.post('/homework', payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Fetch submissions for homework
 * GET /api/homework/:id/submissions
 */
export async function getHomeworkSubmissionsApi(homeworkId: string): Promise<{
  homework?: any;
  summary?: any;
  roster?: any[];
  submissions?: any[];
}> {
  const response = await apiClient.get<any>(`/homework/${homeworkId}/submissions`);
  return response.data?.data || { homework: null, summary: {}, roster: [], submissions: [] };
}

/**
 * Grade student homework submission
 * PATCH /api/homework/submissions/:submissionId/grade
 */
export async function gradeSubmissionApi(
  submissionId: string,
  grade: string,
  feedback?: string
): Promise<any> {
  const response = await apiClient.patch(`/homework/submissions/${submissionId}/grade`, {
    grade: String(grade),
    feedback,
  });
  return response.data;
}

/**
 * Fetch learning materials within teacher's scope
 * GET /api/materials?batchId=...
 */
export async function getTeacherMaterialsApi(batchId?: string): Promise<TeacherMaterialItem[]> {
  const params: any = {};
  if (batchId) params.batchId = batchId;

  const response = await apiClient.get<any>('/materials', {
    params,
  });
  const rawData = response.data;
  if (Array.isArray(rawData)) return rawData;
  if (Array.isArray(rawData?.data)) return rawData.data;
  if (Array.isArray(rawData?.data?.materials)) return rawData.data.materials;
  if (Array.isArray(rawData?.materials)) return rawData.materials;
  return [];
}

/**
 * Upload learning material
 * POST /api/materials
 */
export async function createTeacherMaterialApi(payload: FormData): Promise<any> {
  const response = await apiClient.post('/materials', payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/**
 * Delete learning material
 * DELETE /api/materials/:id
 */
export async function deleteTeacherMaterialApi(id: string): Promise<any> {
  const response = await apiClient.delete(`/materials/${id}`);
  return response.data;
}

/**
 * Fetch student progress reviews
 * GET /api/progress?batchId=...&studentId=...
 */
export async function getTeacherProgressFeedbackApi(
  batchId?: string,
  studentId?: string
): Promise<TeacherProgressItem[]> {
  const params: any = {};
  if (batchId) params.batchId = batchId;
  if (studentId) params.studentId = studentId;

  const response = await apiClient.get<ApiResponse<TeacherProgressItem[]> | TeacherProgressItem[]>('/progress', {
    params,
  });
  const rawData = response.data;
  if (Array.isArray(rawData)) return rawData;
  if (rawData && (rawData as ApiResponse<TeacherProgressItem[]>).data) {
    return (rawData as ApiResponse<TeacherProgressItem[]>).data || [];
  }
  return [];
}

/**
 * Create teacher progress review
 * POST /api/progress
 */
export async function createTeacherProgressFeedbackApi(payload: {
  studentId: string;
  batchId: string;
  category: string;
  termName?: string;
  rating?: number;
  remarks: string;
}): Promise<any> {
  const response = await apiClient.post('/progress', {
    ...payload,
    termName: payload.termName || 'Term 1',
  });
  return response.data;
}

/**
 * Fetch notifications for teacher
 * GET /api/notifications
 */
export async function getTeacherNotificationsApi(): Promise<NotificationItem[]> {
  const response = await apiClient.get<ApiResponse<NotificationItem[]> | NotificationItem[]>('/notifications');
  const rawData = response.data;
  if (Array.isArray(rawData)) return rawData;
  if (rawData && (rawData as ApiResponse<NotificationItem[]>).data) {
    return (rawData as ApiResponse<NotificationItem[]>).data || [];
  }
  return [];
}

/**
 * Mark notification as read
 * PATCH /api/notifications/:id/read
 */
export async function markTeacherNotificationReadApi(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`);
}

/**
 * Mark all notifications as read
 * POST /api/notifications/mark-all-read
 */
export async function markAllTeacherNotificationsReadApi(): Promise<void> {
  await apiClient.post('/notifications/mark-all-read');
}
