import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import { secureStorage } from '../utils/secureStore';
import {
  MOCK_STUDENT_DASHBOARD,
  MOCK_STUDENT_TIMETABLE,
  MOCK_STUDENT_ATTENDANCE,
  MOCK_STUDENT_PROFILE,
  MOCK_MATERIALS,
  MOCK_HOMEWORK,
  MOCK_PARENT_DASHBOARD,
  MOCK_PARENT_CHILDREN,
  MOCK_TEACHER_DASHBOARD,
  MOCK_TEACHER_BATCHES,
  MOCK_TEACHER_PROFILE,
} from './mockData';

// Map request URLs to offline mock data for demo exploration
function getMockResponseForUrl(url: string): any {
  if (url.includes('/students/my/dashboard')) return MOCK_STUDENT_DASHBOARD;
  if (url.includes('/students/my/timetable')) return { timetable: MOCK_STUDENT_TIMETABLE };
  if (url.includes('/students/my/attendance-history')) return MOCK_STUDENT_ATTENDANCE;
  if (url.includes('/students/my/profile')) return { student: MOCK_STUDENT_PROFILE };
  if (url.includes('/homework')) return MOCK_HOMEWORK;
  if (url.includes('/materials')) return MOCK_MATERIALS;
  if (url.includes('/parents/my/dashboard-summary')) return MOCK_PARENT_DASHBOARD;
  if (url.includes('/parents/my/children')) return { children: MOCK_PARENT_CHILDREN };
  if (url.includes('/parents/students/') && url.includes('/attendance')) return MOCK_STUDENT_ATTENDANCE;
  if (url.includes('/staff/my/dashboard')) return MOCK_TEACHER_DASHBOARD;
  if (url.includes('/staff/my/profile')) return { profile: MOCK_TEACHER_PROFILE };
  if (url.includes('/academics/batches')) return { batches: MOCK_TEACHER_BATCHES };
  if (url.includes('/notifications')) return [];
  if (url.includes('/feedback')) return [];
  return null;
}

// Determine default host based on runtime platform
function getDefaultBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  return 'https://franchise.digitalghuru.com/api';
}

export const API_BASE_URL = getDefaultBaseUrl();

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'X-Client-Platform': Platform.OS,
  },
});

// Request Interceptor: Attach Bearer token and active institute context
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const session = await secureStorage.getSession();
      if (session.accessToken && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${session.accessToken}`;
      }
      if (session.institute?.id && !config.headers['x-institute-id']) {
        config.headers['x-institute-id'] = session.institute.id;
      }
    } catch {
      // Continue without token if retrieval fails
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Thread-safe 401 token refresh queue
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Global callback for forced logout when refresh token is rejected
let onSessionExpiredCallback: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpiredCallback = handler;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<any>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Check if running under offline demo session or network failed
    const authHeader = (originalRequest?.headers?.Authorization as string) || '';
    const isDemoSession = authHeader.includes('demo_token_');
    const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || error.message?.includes('Network Error');

    if (isDemoSession || isNetworkError) {
      const mockResult = getMockResponseForUrl(originalRequest?.url || '');
      if (mockResult !== null) {
        return {
          data: {
            success: true,
            data: mockResult,
          },
          status: 200,
          statusText: 'OK (Mock)',
          headers: {},
          config: originalRequest,
        };
      }
    }

    // Bypasses refresh for login/refresh calls themselves or if already retried
    if (!originalRequest || originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh') || originalRequest._retry) {
      return Promise.reject(normalizeError(error));
    }

    if (error.response?.status === 401) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(normalizeError(err)));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const session = await secureStorage.getSession();
        if (!session.refreshToken) {
          throw new Error('No refresh token available');
        }

        // Direct Axios call bypassing interceptors to avoid circular refresh loops
        const refreshResponse = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken: session.refreshToken,
        });

        const newAccessToken = refreshResponse.data?.data?.accessToken;
        const newRefreshToken = refreshResponse.data?.data?.refreshToken;

        if (!newAccessToken || !newRefreshToken) {
          throw new Error('Malformed token refresh response');
        }

        // Persist refreshed credentials
        await secureStorage.saveSession({
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          user: session.user,
          institute: session.institute,
        });

        processQueue(null, newAccessToken);
        isRefreshing = false;

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        isRefreshing = false;
        await secureStorage.clearSession();
        if (onSessionExpiredCallback) {
          onSessionExpiredCallback();
        }
        return Promise.reject(normalizeError(refreshErr));
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

export function normalizeError(error: any): Error {
  if (error.response?.data?.error) {
    return new Error(error.response.data.error);
  }
  if (error.response?.data?.message) {
    return new Error(error.response.data.message);
  }
  if (error.message === 'Network Error') {
    return new Error('Cannot connect to Digital Guru server. Please check your internet connection.');
  }
  return new Error(error.message || 'An unexpected error occurred');
}
