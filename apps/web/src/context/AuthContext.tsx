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
  login: (token: string, user: User, institute?: { id: string; name: string; code: string; city?: string | null } | null) => void;
  logout: () => void;
  setActiveInstitute: (institute: { id: string; name: string; code: string; city?: string | null } | null) => void;
  refreshBranches: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('tuition_token'));
    const [assignedBranches, setAssignedBranches] = useState<AssignedBranch[]>([]);
    const [activeInstitute, setActiveInstituteState] = useState<{ id: string; name: string; code: string; city?: string | null } | null>(() => {
      const saved = localStorage.getItem('tuition_active_institute');
      return saved ? JSON.parse(saved) : null;
    });
    const [loading, setLoading] = useState<boolean>(true);

    const fetchBranches = useCallback(async (role?: string) => {
      if (!token) return;
      try {
        if (role === 'FRANCHISE_OWNER' || role === 'SUPER_ADMIN') {
          const res = await apiFetch('/franchises/my-branches', { skipCache: true });
          if (res.success && Array.isArray(res.data?.branches)) {
            setAssignedBranches(res.data.branches);

            // If no active institute stored, or previous selection is invalid
            const savedId = localStorage.getItem('tuition_active_institute_id');
            if (!savedId) {
              setActiveInstituteState(ALL_BRANCHES_SELECTION);
              localStorage.setItem('tuition_active_institute', JSON.stringify(ALL_BRANCHES_SELECTION));
              localStorage.setItem('tuition_active_institute_id', ALL_BRANCHES_SELECTION.id);
            } else if (savedId !== 'ALL') {
              const exists = res.data.branches.find((b: AssignedBranch) => b.id === savedId);
              if (!exists && res.data.branches.length > 0) {
                setActiveInstituteState(ALL_BRANCHES_SELECTION);
                localStorage.setItem('tuition_active_institute', JSON.stringify(ALL_BRANCHES_SELECTION));
                localStorage.setItem('tuition_active_institute_id', ALL_BRANCHES_SELECTION.id);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[AuthContext] Failed to load assigned branches:', err);
      }
    }, [token]);

    useEffect(() => {
      if (token) {
        apiFetch('/auth/me')
          .then((res) => {
            if (res.data?.user) {
                const fetchedUser = res.data.user;
                setUser(fetchedUser);

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
          .catch(() => {
            logout();
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
  }, [token, fetchBranches]);

    const login = (
      newToken: string,
      newUser: User,
      institute?: { id: string; name: string; code: string; city?: string | null } | null
    ) => {
      setToken(newToken);
      setUser(newUser);
      localStorage.setItem('tuition_token', newToken);

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

      const logout = () => {
        setUser(null);
        setToken(null);
        setAssignedBranches([]);
        setActiveInstituteState(null);
        localStorage.removeItem('tuition_token');
        localStorage.removeItem('tuition_active_institute');
        localStorage.removeItem('tuition_active_institute_id');
        invalidateApiCache();
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
