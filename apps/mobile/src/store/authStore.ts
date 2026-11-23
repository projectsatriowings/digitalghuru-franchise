import { create } from 'zustand';
import { AuthState, UserProfile, UserRole, ActiveInstitute } from '../types/auth';
import { loginApi, getCurrentUserApi, LoginCredentials } from '../api/auth.api';
import { secureStorage } from '../utils/secureStore';
import { setSessionExpiredHandler } from '../api/client';
import { useParentStore } from './parentStore';
import { useTeacherStore } from './teacherStore';
import {
  registerDevicePushToken,
  unregisterDevicePushToken,
} from '../services/pushNotificationService';

interface AuthStore extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  loginDemo: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
  setActiveInstitute: (institute: ActiveInstitute) => void;
}

const DEMO_SESSIONS: Record<string, { user: UserProfile; institute: ActiveInstitute; accessToken: string; refreshToken: string }> = {
  STUDENT: {
    user: {
      id: '66666666-6666-6666-6666-666666666666',
      fullName: 'Aarav Mehta',
      email: 'student@apexacademy.com',
      phone: '9826444307',
      role: 'STUDENT',
      memberships: [
        {
          id: 'mem-stud-1',
          role: 'STUDENT',
          institute: { id: '11111111-1111-1111-1111-111111111111', code: 'APEX01', name: 'Apex Tuition Academy' },
        },
      ],
    },
    institute: { id: '11111111-1111-1111-1111-111111111111', code: 'APEX01', name: 'Apex Tuition Academy' },
    accessToken: 'demo_token_student_offline',
    refreshToken: 'demo_refresh_student_offline',
  },
  PARENT: {
    user: {
      id: '55555555-5555-5555-5555-555555555555',
      fullName: 'Vikram Mehta',
      email: 'parent@apexacademy.com',
      phone: '9826444306',
      role: 'PARENT',
      memberships: [
        {
          id: 'mem-parent-1',
          role: 'PARENT',
          institute: { id: '11111111-1111-1111-1111-111111111111', code: 'APEX01', name: 'Apex Tuition Academy' },
        },
      ],
    },
    institute: { id: '11111111-1111-1111-1111-111111111111', code: 'APEX01', name: 'Apex Tuition Academy' },
    accessToken: 'demo_token_parent_offline',
    refreshToken: 'demo_refresh_parent_offline',
  },
  STAFF: {
    user: {
      id: '22222222-2222-2222-2222-222222222222',
      fullName: 'Prof. Anita Verma',
      email: 'teacher@apexacademy.com',
      phone: '9876543210',
      role: 'STAFF',
      memberships: [
        {
          id: 'mem-teacher-1',
          role: 'STAFF',
          institute: { id: '11111111-1111-1111-1111-111111111111', code: 'APEX01', name: 'Apex Tuition Academy' },
        },
      ],
    },
    institute: { id: '11111111-1111-1111-1111-111111111111', code: 'APEX01', name: 'Apex Tuition Academy' },
    accessToken: 'demo_token_teacher_offline',
    refreshToken: 'demo_refresh_teacher_offline',
  },
};

export const useAuthStore = create<AuthStore>((set, get) => {
  // Bind forced logout handler when token refresh fails globally
  setSessionExpiredHandler(() => {
    set({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      user: null,
      activeRole: null,
      activeInstitute: null,
      error: 'Session expired. Please log in again.',
    });
  });

  return {
    isAuthenticated: false,
    isLoading: false,
    isRestoringSession: true,
    accessToken: null,
    refreshToken: null,
    user: null,
    activeRole: null,
    activeInstitute: null,
    error: null,

    clearError: () => set({ error: null }),

    setActiveInstitute: (institute: ActiveInstitute) => set({ activeInstitute: institute }),

    login: async (credentials: LoginCredentials) => {
      set({ isLoading: true, error: null });
      try {
        const data = await loginApi(credentials);

        // Store tokens securely in Keychain / Keystore
        await secureStorage.saveSession({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
          institute: data.institute,
        });

        set({
          isAuthenticated: true,
          isLoading: false,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
          activeRole: data.user.role,
          activeInstitute: data.institute || null,
          error: null,
        });

        // Register push token asynchronously after successful login
        registerDevicePushToken().catch(() => {});
      } catch (err: any) {
        set({
          isLoading: false,
          error: err.message || 'Invalid email, phone, or password',
        });
        throw err;
      }
    },

    loginDemo: async (role: UserRole) => {
      set({ isLoading: true, error: null });
      try {
        const demoData = DEMO_SESSIONS[role] || DEMO_SESSIONS.STUDENT;
        await secureStorage.saveSession({
          accessToken: demoData.accessToken,
          refreshToken: demoData.refreshToken,
          user: demoData.user,
          institute: demoData.institute,
        });

        set({
          isAuthenticated: true,
          isLoading: false,
          accessToken: demoData.accessToken,
          refreshToken: demoData.refreshToken,
          user: demoData.user,
          activeRole: demoData.user.role,
          activeInstitute: demoData.institute,
          error: null,
        });
      } catch (err: any) {
        set({
          isLoading: false,
          error: err.message || 'Demo login failed',
        });
      }
    },

    restoreSession: async () => {
      set({ isRestoringSession: true, error: null });
      try {
        const session = await secureStorage.getSession();
        if (!session.accessToken || !session.refreshToken) {
          set({ isRestoringSession: false, isAuthenticated: false });
          return;
        }

        // Fast-path restore for offline demo sessions without network check
        if (session.accessToken.startsWith('demo_token_')) {
          set({
            isAuthenticated: true,
            isRestoringSession: false,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            user: session.user,
            activeRole: session.user?.role || 'STUDENT',
            activeInstitute: session.institute || null,
          });
          return;
        }

        // Verify session by validating token against /api/auth/me
        try {
          const freshUser = await getCurrentUserApi();
          set({
            isAuthenticated: true,
            isRestoringSession: false,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            user: freshUser,
            activeRole: freshUser.role,
            activeInstitute: session.institute || null,
          });
          registerDevicePushToken().catch(() => {});
        } catch {
          // If token verification failed, the 401 interceptor already attempted refresh
          // Check if session still exists after interceptor pass
          const refreshed = await secureStorage.getSession();
          if (refreshed.accessToken) {
            set({
              isAuthenticated: true,
              isRestoringSession: false,
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
              user: refreshed.user,
              activeRole: refreshed.user?.role || null,
              activeInstitute: refreshed.institute || null,
            });
          } else {
            set({ isRestoringSession: false, isAuthenticated: false });
          }
        }
      } catch {
        set({ isRestoringSession: false, isAuthenticated: false });
      }
    },

    logout: async () => {
      set({ isLoading: true });
      try {
        await unregisterDevicePushToken().catch(() => {});
        await secureStorage.clearSession();
        useParentStore.getState().clearParentSession();
        useTeacherStore.getState().clearTeacherSession();
      } finally {
        set({
          isAuthenticated: false,
          isLoading: false,
          accessToken: null,
          refreshToken: null,
          user: null,
          activeRole: null,
          activeInstitute: null,
          error: null,
        });
      }
    },
  };
});
