export type UserRole =
  | 'SUPER_ADMIN'
  | 'FRANCHISE_OWNER'
  | 'BRANCH_ADMIN'
  | 'ACADEMIC_ADMIN'
  | 'STAFF'
  | 'PARENT'
  | 'STUDENT';

export interface UserMembership {
  id: string;
  role: string;
  institute: {
    id: string;
    code: string;
    name: string;
  };
}

export interface UserProfile {
  id: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  role: UserRole;
  mustChangePassword?: boolean;
  memberships: UserMembership[];
}

export interface ActiveInstitute {
  id: string;
  code: string;
  name: string;
  phone?: string | null;
}

export interface LoginResponseData {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
  user: UserProfile;
  institute?: ActiveInstitute | null;
  memberships: UserMembership[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  isRestoringSession: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  activeRole: UserRole | null;
  activeInstitute: ActiveInstitute | null;
  error: string | null;
}
