import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, Institute } from '../types';
import { apiFetch } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  activeInstitute: { id: string; name: string; code: string } | null;
  loading: boolean;
  login: (token: string, user: User, institute?: { id: string; name: string; code: string } | null) => void;
  logout: () => void;
  setActiveInstitute: (institute: { id: string; name: string; code: string } | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('tuition_token'));
  const [activeInstitute, setActiveInstituteState] = useState<{ id: string; name: string; code: string } | null>(() => {
    const saved = localStorage.getItem('tuition_active_institute');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (token) {
      apiFetch('/auth/me')
        .then((res) => {
          if (res.data?.user) {
            setUser(res.data.user);
            const targetInst = activeInstitute || res.data.user.memberships?.[0]?.institute;
            if (targetInst) {
              setActiveInstituteState(targetInst);
              localStorage.setItem('tuition_active_institute', JSON.stringify(targetInst));
              localStorage.setItem('tuition_active_institute_id', targetInst.id);
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
  }, [token]);

  const login = (newToken: string, newUser: User, institute?: { id: string; name: string; code: string } | null) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('tuition_token', newToken);

    if (institute) {
      setActiveInstituteState(institute);
      localStorage.setItem('tuition_active_institute', JSON.stringify(institute));
      localStorage.setItem('tuition_active_institute_id', institute.id);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setActiveInstituteState(null);
    localStorage.removeItem('tuition_token');
    localStorage.removeItem('tuition_active_institute');
    localStorage.removeItem('tuition_active_institute_id');
  };

  const setActiveInstitute = (institute: { id: string; name: string; code: string } | null) => {
    setActiveInstituteState(institute);
    if (institute) {
      localStorage.setItem('tuition_active_institute', JSON.stringify(institute));
      localStorage.setItem('tuition_active_institute_id', institute.id);
    } else {
      localStorage.removeItem('tuition_active_institute');
      localStorage.removeItem('tuition_active_institute_id');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, activeInstitute, loading, login, logout, setActiveInstitute }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
