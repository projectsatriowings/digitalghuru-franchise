import { apiClient } from './client';
import {
  ParentDashboardSummary,
  ParentChildItem,
  ParentAttendanceData,
  ParentAcademicsData,
  ParentHomeworkItem,
  ParentFeeStatement,
  ParentPaymentItem,
  ParentInquiryItem,
  CreateParentInquiryPayload,
  ParentTeacherItem,
} from '../types/parent';
import { LearningMaterialItem, NotificationItem } from '../types/student';
import { ApiResponse } from '../types/auth';

/**
 * Fetch overall dashboard summary for logged-in parent
 * GET /api/parents/my/dashboard-summary
 */
export async function getParentDashboardSummaryApi(): Promise<ParentDashboardSummary> {
  const response = await apiClient.get<ApiResponse<ParentDashboardSummary>>('/parents/my/dashboard-summary');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to load parent dashboard');
  }
  return response.data.data;
}

/**
 * Fetch linked children list for logged-in parent
 * GET /api/parents/my/children
 */
export async function getParentMyChildrenApi(): Promise<ParentChildItem[]> {
  const response = await apiClient.get<ApiResponse<{ children: ParentChildItem[] }>>('/parents/my/children');
  if (!response.data.success || !response.data.data?.children) {
    throw new Error(response.data.error || 'Failed to load linked children');
  }
  return response.data.data.children;
}

/**
 * Fetch child attendance details and monthly calendar
 * GET /api/parents/students/:studentId/attendance?month=X&year=Y
 */
export async function getParentAttendanceApi(
  studentId: string,
  month?: number,
  year?: number
): Promise<ParentAttendanceData> {
  const params: any = {};
  if (month) params.month = month;
  if (year) params.year = year;
  const response = await apiClient.get<ApiResponse<ParentAttendanceData>>(
    `/parents/students/${studentId}/attendance`,
    { params }
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to load child attendance');
  }
  return response.data.data;
}

/**
 * Fetch child academic summary, report cards & teacher evaluations
 * GET /api/parents/students/:studentId/academics
 */
export async function getParentAcademicsApi(studentId: string): Promise<ParentAcademicsData> {
  const response = await apiClient.get<ApiResponse<ParentAcademicsData>>(
    `/parents/students/${studentId}/academics`
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to load child academics');
  }
  return response.data.data;
}

/**
 * Fetch child homework and assignment status
 * GET /api/parents/students/:studentId/homework
 */
export async function getParentHomeworkApi(studentId: string): Promise<ParentHomeworkItem[]> {
  const response = await apiClient.get<ApiResponse<ParentHomeworkItem[]> | ParentHomeworkItem[]>(
    `/parents/students/${studentId}/homework`
  );
  const rawData = response.data;
  if (Array.isArray(rawData)) return rawData;
  if (rawData && (rawData as ApiResponse<ParentHomeworkItem[]>).data) {
    return (rawData as ApiResponse<ParentHomeworkItem[]>).data || [];
  }
  return [];
}

/**
 * Fetch child structured weekly timetable
 * GET /api/parents/students/:studentId/timetable
 */
export async function getParentTimetableApi(studentId: string): Promise<any> {
  const response = await apiClient.get<ApiResponse<{ timetable: any; activeBatch?: any }>>(
    `/parents/students/${studentId}/timetable`
  );
  if (!response.data.success || !response.data.data?.timetable) {
    throw new Error(response.data.error || 'Failed to load timetable');
  }
  return response.data.data.timetable;
}

/**
 * Fetch itemized fee statement for child
 * GET /api/fees/students/:studentId/statement
 */
export async function getParentFeeStatementApi(studentId: string): Promise<ParentFeeStatement> {
  const response = await apiClient.get<ApiResponse<ParentFeeStatement>>(
    `/fees/students/${studentId}/statement`
  );
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to load fee statement');
  }
  return response.data.data;
}

/**
 * Fetch fee payment transaction history for child
 * GET /api/fees/payments?studentId=...
 */
export async function getParentPaymentsApi(studentId: string): Promise<ParentPaymentItem[]> {
  const response = await apiClient.get<ApiResponse<ParentPaymentItem[]> | ParentPaymentItem[]>(
    '/fees/payments',
    { params: { studentId } }
  );
  const rawData = response.data;
  if (Array.isArray(rawData)) return rawData;
  if (rawData && (rawData as ApiResponse<ParentPaymentItem[]>).data) {
    return (rawData as ApiResponse<ParentPaymentItem[]>).data || [];
  }
  return [];
}

/**
 * Fetch parent inquiries and teacher responses
 * GET /api/feedback?studentId=...
 */
export async function getParentFeedbackApi(studentId?: string): Promise<ParentInquiryItem[]> {
  const params: any = {};
  if (studentId) params.studentId = studentId;
  const response = await apiClient.get<ApiResponse<ParentInquiryItem[]> | ParentInquiryItem[]>(
    '/feedback',
    { params }
  );
  const rawData = response.data;
  if (Array.isArray(rawData)) return rawData;
  if (rawData && (rawData as ApiResponse<ParentInquiryItem[]>).data) {
    return (rawData as ApiResponse<ParentInquiryItem[]>).data || [];
  }
  return [];
}

/**
 * Submit inquiry or message to teacher
 * POST /api/feedback
 */
export async function submitParentFeedbackApi(payload: CreateParentInquiryPayload): Promise<ParentInquiryItem> {
  const response = await apiClient.post<ApiResponse<ParentInquiryItem>>('/feedback', payload);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to send inquiry');
  }
  return response.data.data;
}

/**
 * Fetch teachers for child's batch/institute
 * GET /api/parents/students/:studentId/teachers
 */
export async function getParentStudentTeachersApi(studentId: string): Promise<ParentTeacherItem[]> {
  const response = await apiClient.get<ApiResponse<ParentTeacherItem[]> | ParentTeacherItem[]>(
    `/parents/students/${studentId}/teachers`
  );
  const rawData = response.data;
  if (Array.isArray(rawData)) return rawData;
  if (rawData && (rawData as ApiResponse<ParentTeacherItem[]>).data) {
    return (rawData as ApiResponse<ParentTeacherItem[]>).data || [];
  }
  return [];
}

/**
 * Fetch learning materials scoped to student's classes
 * GET /api/materials?batchId=...
 */
export async function getParentMaterialsApi(batchId?: string): Promise<LearningMaterialItem[]> {
  const params: any = {};
  if (batchId) params.batchId = batchId;
  const response = await apiClient.get<ApiResponse<LearningMaterialItem[]> | LearningMaterialItem[]>(
    '/materials',
    { params }
  );
  const rawData = response.data;
  if (Array.isArray(rawData)) return rawData;
  if (rawData && (rawData as ApiResponse<LearningMaterialItem[]>).data) {
    return (rawData as ApiResponse<LearningMaterialItem[]>).data || [];
  }
  return [];
}

/**
 * Fetch notifications for parent
 * GET /api/notifications
 */
export async function getParentNotificationsApi(): Promise<NotificationItem[]> {
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
export async function markNotificationReadApi(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`);
}

/**
 * Mark all notifications as read
 * POST /api/notifications/mark-all-read
 */
export async function markAllNotificationsReadApi(): Promise<void> {
  await apiClient.post('/notifications/mark-all-read');
}
