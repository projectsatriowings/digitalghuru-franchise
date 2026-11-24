import { Platform } from 'react-native';
import { apiClient } from './client';
import {
  StudentDashboardData,
  StructuredTimetable,
  AttendanceHistoryData,
  StudentProfileFull,
  LearningMaterialItem,
  HomeworkItem,
  AcademicMarkItem,
  NotificationItem,
} from '../types/student';
import { ApiResponse } from '../types/auth';

export async function getStudentDashboardApi(): Promise<StudentDashboardData> {
  const response = await apiClient.get<ApiResponse<StudentDashboardData>>('/students/my/dashboard');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to load dashboard data');
  }
  return response.data.data;
}

export async function getStudentTimetableApi(): Promise<StructuredTimetable> {
  const response = await apiClient.get<ApiResponse<{ timetable: StructuredTimetable }>>('/students/my/timetable');
  if (!response.data.success || !response.data.data?.timetable) {
    throw new Error(response.data.error || 'Failed to load timetable');
  }
  return response.data.data.timetable;
}

export async function getStudentAttendanceHistoryApi(): Promise<AttendanceHistoryData> {
  const response = await apiClient.get<ApiResponse<AttendanceHistoryData>>('/students/my/attendance-history');
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to load attendance history');
  }
  return response.data.data;
}

export async function getStudentProfileApi(): Promise<StudentProfileFull> {
  const response = await apiClient.get<ApiResponse<{ student: StudentProfileFull }>>('/students/my/profile');
  if (!response.data.success || !response.data.data?.student) {
    throw new Error(response.data.error || 'Failed to load profile');
  }
  return response.data.data.student;
}

export async function getStudentMaterialsApi(subjectId?: string): Promise<LearningMaterialItem[]> {
  const params: any = {};
  if (subjectId) params.subjectId = subjectId;
  const response = await apiClient.get<any>('/materials', { params });
  const rawData = response.data;
  if (Array.isArray(rawData)) return rawData;
  if (Array.isArray(rawData?.data)) return rawData.data;
  if (Array.isArray(rawData?.data?.materials)) return rawData.data.materials;
  if (Array.isArray(rawData?.materials)) return rawData.materials;
  return [];
}

export async function getStudentHomeworkApi(): Promise<HomeworkItem[]> {
  const response = await apiClient.get<any>('/homework');
  const rawData = response.data;
  if (Array.isArray(rawData)) return rawData;
  if (Array.isArray(rawData?.data)) return rawData.data;
  if (Array.isArray(rawData?.data?.homework)) return rawData.data.homework;
  if (Array.isArray(rawData?.homework)) return rawData.homework;
  return [];
}

export async function getStudentHomeworkDetailApi(id: string): Promise<HomeworkItem> {
  const response = await apiClient.get<ApiResponse<HomeworkItem>>(`/homework/${id}`);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Failed to load homework details');
  }
  return response.data.data;
}

export interface HomeworkUploadPayload {
  uri: string;
  name: string;
  type: string;
}

export async function submitHomeworkApi(
  homeworkId: string,
  file: HomeworkUploadPayload,
  studentNotes?: string
): Promise<any> {
  const formData = new FormData();
  
  // Format file properly for React Native / Metro
  const fileObject: any = {
    uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
    name: file.name || 'submission.pdf',
    type: file.type || 'application/octet-stream',
  };
  formData.append('file', fileObject);

  if (studentNotes && studentNotes.trim().length > 0) {
    formData.append('studentNotes', studentNotes.trim());
  }

  const response = await apiClient.post(`/homework/${homeworkId}/submissions`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return response.data;
}

export async function getStudentExamsApi(): Promise<any[]> {
  const response = await apiClient.get<ApiResponse<any[]> | any[]>('/exams');
  const rawData = response.data;
  if (Array.isArray(rawData)) return rawData;
  if (rawData && (rawData as ApiResponse<any[]>).data) {
    return (rawData as ApiResponse<any[]>).data || [];
  }
  return [];
}

export async function getStudentNotificationsApi(): Promise<NotificationItem[]> {
  const response = await apiClient.get<ApiResponse<NotificationItem[]> | NotificationItem[]>('/notifications');
  const rawData = response.data;
  if (Array.isArray(rawData)) return rawData;
  if (rawData && (rawData as ApiResponse<NotificationItem[]>).data) {
    return (rawData as ApiResponse<NotificationItem[]>).data || [];
  }
  return [];
}

export async function markNotificationReadApi(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsReadApi(): Promise<void> {
  await apiClient.post('/notifications/mark-all-read');
}
