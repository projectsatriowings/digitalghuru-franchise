import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, UserRole, Institute } from '../types';
import { apiFetch, invalidateApiCache } from '../services/api';

export interface AssignedBranch {
  id: string;
  code: string;
  name: string;
  city?: string | null;
  state?: string | null;
  status: string;
  _count?: {
    students?: number;
    batches?: number;
    staffProfiles?: number;
  };
}

export const ALL_BRANCHES_SELECTION = {
  id: 'ALL',
  name: 'All Assigned Branches',
  code: 'ALL',
  city: 'Consolidated View',
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  activeInstitute: { id: string; name: string; code: string; city?: string | null } | null;
  assignedBranches: AssignedBranch[];
  isConsolidatedMode: boolean;
  loading: boolean;
  login: (token: string, user: User, institute?: { id: string; name: string; code: string; city?: string | null } | null, refreshToken?: string) => void;
  logout: () => void;
  setActiveInstitute: (institute: { id: string; name: string; code: string; city?: string | null } | null) => void;
  refreshBranches: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('tuition_token'));
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedToken = localStorage.getItem('tuition_token');
      const savedUser = localStorage.getItem('tuition_user');
      return savedToken && savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [assignedBranches, setAssignedBranches] = useState<AssignedBranch[]>([]);
  const [activeInstitute, setActiveInstituteState] = useState<{ id: string; name: string; code: string; city?: string | null } | null>(() => {
    try {
      const saved = localStorage.getItem('tuition_active_institute');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  // Only block UI with splash screen if we have a token but no cached user profile yet
  const [loading, setLoading] = useState<boolean>(() => {
    const savedToken = localStorage.getItem('tuition_token');
    const savedUser = localStorage.getItem('tuition_user');
    return Boolean(savedToken && !savedUser);
  });

    const fetchBranches = useCallback(async (role?: string) => {
      if (!token) return;
      try {
        if (role === 'FRANCHISE_OWNER' || role === 'SUPER_ADMIN') {
          const res = await apiFetch('/franchises/my-branches', { skipCache: true });
          if (res.success && Array.isArray(res.data?.branches)) {
            setAssignedBranches(res.data.branches);

            // If the franchise center has exactly 1 branch (single-branch architecture), automatically bind to it
            if (res.data.branches.length === 1) {
              const singleBranch = {
                id: res.data.branches[0].id,
                name: res.data.branches[0].name,
                code: res.data.branches[0].code,
                city: res.data.branches[0].city,
              };
              setActiveInstituteState(singleBranch);
              localStorage.setItem('tuition_active_institute', JSON.stringify(singleBranch));
              localStorage.setItem('tuition_active_institute_id', singleBranch.id);
            } else if (res.data.branches.length > 1) {
              // If multiple branches exist, respect user selection or default to All Branches (Consolidated Mode)
              const savedId = localStorage.getItem('tuition_active_institute_id');
              if (!savedId || savedId === 'ALL') {
                setActiveInstituteState(ALL_BRANCHES_SELECTION);
                localStorage.setItem('tuition_active_institute', JSON.stringify(ALL_BRANCHES_SELECTION));
                localStorage.setItem('tuition_active_institute_id', ALL_BRANCHES_SELECTION.id);
              } else {
                const exists = res.data.branches.find((b: AssignedBranch) => b.id === savedId);
                if (exists) {
                  const matched = {
                    id: exists.id,
                    name: exists.name,
                    code: exists.code,
                    city: exists.city,
                  };
                  setActiveInstituteState(matched);
                  localStorage.setItem('tuition_active_institute', JSON.stringify(matched));
                } else {
                  setActiveInstituteState(ALL_BRANCHES_SELECTION);
                  localStorage.setItem('tuition_active_institute', JSON.stringify(ALL_BRANCHES_SELECTION));
                  localStorage.setItem('tuition_active_institute_id', ALL_BRANCHES_SELECTION.id);
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Failed to load assigned branches:', err);
      }
    }, [token]);

    useEffect(() => {
      const handleBranchesUpdated = () => {
        if (user?.role === 'FRANCHISE_OWNER' || user?.role === 'SUPER_ADMIN') {
          fetchBranches(user.role);
        }
      };
      window.addEventListener('tuitionos:branches-updated', handleBranchesUpdated);
      return () => {
        window.removeEventListener('tuitionos:branches-updated', handleBranchesUpdated);
      };
    }, [user?.role, fetchBranches]);

    const logout = useCallback(() => {
      setUser(null);
      setToken(null);
      setAssignedBranches([]);
      setActiveInstituteState(null);
      localStorage.removeItem('tuition_token');
      localStorage.removeItem('tuition_access_token');
      localStorage.removeItem('tuition_mobile_access_token');
      localStorage.removeItem('tuition_refresh_token');
      localStorage.removeItem('tuition_user');
      localStorage.removeItem('tuition_active_institute');
      localStorage.removeItem('tuition_active_institute_id');
      invalidateApiCache();
    }, []);

    useEffect(() => {
      const handleSessionExpired = () => {
        logout();
      };
      window.addEventListener('tuitionos:session-expired', handleSessionExpired);
      return () => {
        window.removeEventListener('tuitionos:session-expired', handleSessionExpired);
      };
    }, [logout]);

    useEffect(() => {
      const handleAccountSuspended = (e: any) => {
        logout();
        const message = e.detail?.message || 'Your account or franchise center has been suspended. Please contact your administrator.';
        window.history.replaceState({}, '', '/');
        alert(message);
      };
      window.addEventListener('tuitionos:account-suspended', handleAccountSuspended);
      return () => {
        window.removeEventListener('tuitionos:account-suspended', handleAccountSuspended);
      };
    }, [logout]);

    useEffect(() => {
      if (token) {
        apiFetch('/auth/me')
          .then((res) => {
            if (res.data?.user) {
                const fetchedUser = res.data.user;
                setUser(fetchedUser);
                try {
                  localStorage.setItem('tuition_user', JSON.stringify(fetchedUser));
                } catch {
                  // ignore storage quota errors
                }

                if (fetchedUser.role === 'FRANCHISE_OWNER' || fetchedUser.role === 'SUPER_ADMIN') {
                  fetchBranches(fetchedUser.role);
                } else {
                  const targetInst = activeInstitute || fetchedUser.memberships?.[0]?.institute;
                  if (targetInst) {
                    setActiveInstituteState(targetInst);
                    localStorage.setItem('tuition_active_institute', JSON.stringify(targetInst));
                    localStorage.setItem('tuition_active_institute_id', targetInst.id);
                  }
                }
              }
            })
          .catch((err) => {
            console.warn('[AuthContext] Session invalid or suspended, logging out:', err);
            logout();
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
  }, [token, fetchBranches, logout]);

  const login = (
      newToken: string,
      newUser: User,
      institute?: { id: string; name: string; code: string; city?: string | null } | null,
      newRefreshToken?: string
    ) => {
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('tuition_token', newToken);
      if (newRefreshToken) {
        localStorage.setItem('tuition_refresh_token', newRefreshToken);
      }
      try {
        localStorage.setItem('tuition_user', JSON.stringify(newUser));
      } catch {
        // ignore storage quota errors
      }

        if (newUser.role === 'FRANCHISE_OWNER') {
          const defaultInst = institute || ALL_BRANCHES_SELECTION;
          setActiveInstituteState(defaultInst);
          localStorage.setItem('tuition_active_institute', JSON.stringify(defaultInst));
          localStorage.setItem('tuition_active_institute_id', defaultInst.id);
          fetchBranches(newUser.role);
        } else if (institute) {
          setActiveInstituteState(institute);
          localStorage.setItem('tuition_active_institute', JSON.stringify(institute));
          localStorage.setItem('tuition_active_institute_id', institute.id);
        }
      };

        const setActiveInstitute = (institute: { id: string; name: string; code: string; city?: string | null } | null) => {
          setActiveInstituteState(institute);
          if (institute) {
            localStorage.setItem('tuition_active_institute', JSON.stringify(institute));
            localStorage.setItem('tuition_active_institute_id', institute.id);
          } else {
            localStorage.removeItem('tuition_active_institute');
            localStorage.removeItem('tuition_active_institute_id');
          }
          // Invalidate API cache so all modules immediately re-fetch with fresh data for selected branch
          invalidateApiCache();
        };

        const isConsolidatedMode = !activeInstitute || activeInstitute.id === 'ALL';

        return (
            <AuthContext.Provider
              value={{
                user,
                token,
                activeInstitute,
                assignedBranches,
                isConsolidatedMode,
                loading,
                login,
                logout,
                setActiveInstitute,
                refreshBranches: () => fetchBranches(user?.role),
              }}
            >
              {children}
            </AuthContext.Provider>
            );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
            if (!context) throw new Error('useAuth must be used within an AuthProvider');
            return context;
};
