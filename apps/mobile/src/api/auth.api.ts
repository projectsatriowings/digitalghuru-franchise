import { apiClient } from './client';
import { ApiResponse, LoginResponseData, UserProfile } from '../types/auth';

export interface LoginCredentials {
  identifier: string;
  password: string;
  role?: string;
  instituteCode?: string;
}

export async function loginApi(credentials: LoginCredentials): Promise<LoginResponseData> {
  const payload: any = {
    identifier: credentials.identifier.trim(),
    password: credentials.password,
  };
  if (credentials.role) {
    payload.role = credentials.role;
  }
  if (credentials.instituteCode) {
    payload.instituteCode = credentials.instituteCode.trim();
  }

  const response = await apiClient.post<ApiResponse<LoginResponseData>>('/auth/login', payload);
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Authentication failed');
  }
  return response.data.data;
}

export async function refreshApi(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const response = await apiClient.post<ApiResponse<{ accessToken: string; refreshToken: string }>>('/auth/refresh', {
    refreshToken,
  });
  if (!response.data.success || !response.data.data) {
    throw new Error(response.data.error || 'Token refresh failed');
  }
  return response.data.data;
}

export async function getCurrentUserApi(): Promise<UserProfile> {
  const response = await apiClient.get<ApiResponse<{ user: UserProfile }>>('/auth/me');
  if (!response.data.success || !response.data.data?.user) {
    throw new Error(response.data.error || 'Failed to retrieve user profile');
  }
  return response.data.data.user;
}
