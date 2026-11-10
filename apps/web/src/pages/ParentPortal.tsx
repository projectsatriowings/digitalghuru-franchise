import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { ParentDashboardView } from './parent/ParentDashboardView';
import { ParentAttendanceView } from './parent/ParentAttendanceView';
import { ParentCommunicationView } from './parent/ParentCommunicationView';
import { ParentFeesView } from './parent/ParentFeesView';
import { ParentAcademicsView } from './parent/ParentAcademicsView';
import { ParentTestResultsView } from './parent/ParentTestResultsView';
import { ParentNotificationsView } from './parent/ParentNotificationsView';
import { ParentProfileView } from './parent/ParentProfileView';

import {
  GraduationCap,
  Calendar,
  MessageSquare,
  CreditCard,
  BookOpen,
  Award,
  Bell,
  User,
  LayoutDashboard,
  RotateCw,
  AlertCircle,
  Users,
} from 'lucide-react';

interface ParentPortalProps {
  initialTab?: string;
}

export const ParentPortal: React.FC<ParentPortalProps> = ({ initialTab = 'dashboard' }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<any>(null);
  const [feeStatement, setFeeStatement] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingStatement, setLoadingStatement] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initialTab when props change
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Initial load: Fetch children and dashboard summary
  const loadPortalData = async () => {
    if (user && user.role !== 'PARENT') {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);

      const [childrenRes, summaryRes] = await Promise.all([
        apiFetch('/parents/my/children'),
        apiFetch('/parents/my/dashboard-summary').catch((e) => {
          console.warn('[Dashboard Summary warning]', e);
          return { success: false, data: null };
        }),
      ]);

      if (childrenRes.success && childrenRes.data?.children) {
        const kids = childrenRes.data.children;
        setChildren(kids);
        if (kids.length > 0 && !selectedStudentId) {
          setSelectedStudentId(kids[0].student.id);
        }
      }

      if (summaryRes.success && summaryRes.data) {
        setDashboardSummary(summaryRes.data);
      }
    } catch (err: any) {
      console.error('[Parent Portal Load Error]', err);
      setError(err.message || 'Failed to connect to Parent Portal service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData();
  }, []);

  // Real-time SSE listener to automatically sync attendance updates & alerts into dashboard
  useEffect(() => {
    const token = localStorage.getItem('tuition_token') || localStorage.getItem('token');
    if (!token) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'ATTENDANCE_RECORDED' || payload.type === 'NOTIFICATION_CREATED') {
            apiFetch('/parents/my/dashboard-summary').then((res) => {
              if (res.success && res.data) {
                setDashboardSummary(res.data);
              }
            }).catch(() => {});
          }
        } catch (e) {}
      };
    } catch (err) {
      console.warn('[ParentPortal SSE Error]', err);
    }

    return () => {
      es?.close();
    };
  }, []);

  // Fetch student fee statement whenever active child changes
  const loadStudentFeeStatement = async (studentId: string) => {
    try {
      setLoadingStatement(true);
      const res = await apiFetch(`/fees/students/${studentId}/statement`);
      if (res.success && res.data) {
        setFeeStatement(res.data);
      }
    } catch (err) {
      console.error('[Load Fee Statement Error]', err);
    } finally {
      setLoadingStatement(false);
    }
  };

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentFeeStatement(selectedStudentId);
    }
  }, [selectedStudentId]);

  const activeChildRelation = children.find((c) => c.student.id === selectedStudentId) || children[0];
  const activeStudent = activeChildRelation?.student;

  const formatCurrency = (val: number | string | undefined) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'Attendance', icon: Calendar },
    { id: 'communication', label: 'Teacher Chat', icon: MessageSquare },
    { id: 'fees', label: 'Fee Payments', icon: CreditCard },
    { id: 'academics', label: 'Academic Reports', icon: BookOpen },
    { id: 'results', label: 'Test Results', icon: Award },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: dashboardSummary?.unreadCounts?.notifications || 0,
    },
    { id: 'profile', label: 'Student Profile', icon: User },
  ];

  if (user && user.role !== 'PARENT') {
    return (
      <div className="p-8 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 text-sm text-center space-y-4 max-w-lg mx-auto mt-12 shadow-sm">
        <AlertCircle className="w-10 h-10 mx-auto text-amber-600" />
        <h3 className="font-bold text-base text-[#0F172A]">Parent Portal Access Only</h3>
        <p className="text-xs text-[#475569]">
          You are currently signed in as <strong>{user.fullName}</strong> ({user.role?.replace('_', ' ')}).
          The Parent Portal is reserved for registered student guardians.
        </p>
        <button
          onClick={() => {
            const dest = user.role === 'ACADEMIC_ADMIN' ? 'academic_dashboard' : user.role === 'STAFF' ? 'my_attendance' : 'super_admin_dashboard';
            window.location.href = '/' + dest;
          }}
          className="px-5 py-2.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white font-bold text-xs inline-flex items-center gap-2 shadow-sm transition-all"
        >
          Return to My Dashboard
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-16 text-center text-sm text-[#94A3B8] flex flex-col items-center justify-center gap-3">
        <div className="w-5 h-5 rounded-full bg-[#006FFF] animate-ping"></div>
        <span className="font-semibold text-[#006FFF]">Connecting to Parent Portal...</span>
      </div>
    );
  }

  if (error && children.length === 0) {
    return (
      <div className="p-8 rounded-3xl bg-rose-50 border border-rose-200 text-rose-800 text-sm text-center space-y-3">
        <AlertCircle className="w-8 h-8 mx-auto text-rose-600" />
        <h3 className="font-bold text-base">Unable to Load Parent Portal</h3>
        <p>{error}</p>
        <button
          onClick={loadPortalData}
          className="px-4 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition-all"
        >
          <RotateCw className="w-4 h-4" /> Try Again
        </button>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="p-12 text-center rounded-3xl bg-white border border-[#E2E8F0] text-[#94A3B8] text-sm shadow-sm space-y-3 max-w-xl mx-auto my-12">
        <div className="w-12 h-12 rounded-2xl bg-[#006FFF]/10 text-[#006FFF] flex items-center justify-center mx-auto">
          <GraduationCap className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-base text-[#0F172A]">No Linked Students Found</h3>
        <p className="text-xs text-[#64748B] leading-relaxed">
          No student records are currently linked to your verified parent account. Please contact your course centre administration with your registered phone number to establish the guardian relationship.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Child Switcher Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#006FFF] text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {activeStudent?.firstName?.[0] || 'S'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-[#0F172A]">
                {activeStudent?.firstName} {activeStudent?.lastName}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D7CCC8]/40 text-[#006FFF] border border-[#CBD5E1]">
                {activeChildRelation?.relationship || 'Student'}
              </span>
            </div>
            <p className="text-xs text-[#64748B]">
              Admission No: <strong className="font-mono text-[#0F172A]">{activeStudent?.admissionNumber}</strong> &bull; Batch:{' '}
              <strong className="text-[#0F172A]">{activeStudent?.enrollments?.[0]?.batch?.name || 'Assigned'}</strong>
            </p>
          </div>
        </div>

        {/* Multi-Child Switcher Buttons (if parent has > 1 child) */}
        {children.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap bg-[#F8FAFC] p-1.5 rounded-2xl border border-[#E2E8F0]">
            <span className="text-[10px] font-bold uppercase text-[#94A3B8] px-2 flex items-center gap-1">
              <Users className="w-3.5 h-3.5" /> Select Child:
            </span>
            {children.map((rel) => {
              const isSelected = rel.student.id === selectedStudentId;
              return (
                <button
                  key={rel.student.id}
                  onClick={() => setSelectedStudentId(rel.student.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-[#006FFF] text-white shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-white/60'
                  }`}
                >
                  {rel.student.firstName}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#E2E8F0]/80 select-none no-scrollbar">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#006FFF] text-white shadow-sm'
                  : 'bg-white hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#0F172A] border border-[#E2E8F0]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {Boolean(tab.badge && tab.badge > 0) && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-amber-400 text-[#0F172A]' : 'bg-rose-500 text-white'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab View Content */}
      <div className="transition-all">
        {activeTab === 'dashboard' && (
          <ParentDashboardView
            summary={dashboardSummary}
            activeStudent={activeStudent}
            onNavigateTab={(tab) => setActiveTab(tab)}
            formatCurrency={formatCurrency}
          />
        )}

        {activeTab === 'attendance' && (
          <ParentAttendanceView student={activeStudent} />
        )}

        {activeTab === 'communication' && (
          <ParentCommunicationView student={activeStudent} />
        )}

        {activeTab === 'fees' && (
          <ParentFeesView
            student={activeStudent}
            feeStatement={feeStatement}
            loadingStatement={loadingStatement}
            onRefreshStatement={() => selectedStudentId && loadStudentFeeStatement(selectedStudentId)}
            formatCurrency={formatCurrency}
          />
        )}

        {activeTab === 'academics' && (
          <ParentAcademicsView student={activeStudent} />
        )}

        {activeTab === 'results' && (
          <ParentTestResultsView student={activeStudent} />
        )}

        {activeTab === 'notifications' && (
          <ParentNotificationsView onNavigateTab={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === 'profile' && (
          <ParentProfileView
            student={activeStudent}
            parent={dashboardSummary?.parent}
          />
        )}
      </div>
    </div>
  );
};
