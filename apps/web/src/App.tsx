import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { PageSkeleton } from './components/PageSkeleton';
import { ToastProvider } from './context/ToastContext';
import { useFormKeyboardNavigation } from './hooks/useFormKeyboardNavigation';

// Route-level code splitting via React.lazy (with prefetch helpers for instant tab switches)
const loadFranchiseManagement = () => import('./pages/FranchiseManagement');
const loadCourseManagement = () => import('./pages/CourseManagement');
const loadFranchiseCourses = () => import('./pages/FranchiseCourses');
const loadSuperAdminDashboard = () => import('./pages/SuperAdminDashboard');

const FranchiseManagement = lazy(() => loadFranchiseManagement().then((m) => ({ default: m.FranchiseManagement })));
const CourseManagement = lazy(() => loadCourseManagement().then((m) => ({ default: m.CourseManagement })));
const FranchiseCourses = lazy(() => loadFranchiseCourses().then((m) => ({ default: m.FranchiseCourses })));
const FranchiseOwnerDashboard = lazy(() => import('./pages/FranchiseOwnerDashboard').then((m) => ({ default: m.FranchiseOwnerDashboard })));
const SuperAdminDashboard = lazy(() => loadSuperAdminDashboard().then((m) => ({ default: m.SuperAdminDashboard })));
const MonthlySettlements = lazy(() => import('./pages/MonthlySettlements').then((m) => ({ default: m.MonthlySettlements })));
const AcademicAdminDashboard = lazy(() => import('./pages/AcademicAdminDashboard').then((m) => ({ default: m.AcademicAdminDashboard })));
const StaffManagement = lazy(() => import('./pages/StaffManagement').then((m) => ({ default: m.StaffManagement })));
const StaffAttendanceAdmin = lazy(() => import('./pages/StaffAttendanceAdmin').then((m) => ({ default: m.StaffAttendanceAdmin })));
const StaffMyAttendance = lazy(() => import('./pages/StaffMyAttendance').then((m) => ({ default: m.StaffMyAttendance })));
const StudentManagement = lazy(() => import('./pages/StudentManagement').then((m) => ({ default: m.StudentManagement })));
const AcademicsManagement = lazy(() => import('./pages/AcademicsManagement').then((m) => ({ default: m.AcademicsManagement })));
const AttendanceManagement = lazy(() => import('./pages/AttendanceManagement').then((m) => ({ default: m.AttendanceManagement })));
const ParentPortal = lazy(() => import('./pages/ParentPortal').then((m) => ({ default: m.ParentPortal })));
const StudentPortal = lazy(() => import('./pages/StudentPortal').then((m) => ({ default: m.StudentPortal })));
const MaterialsManagement = lazy(() => import('./pages/MaterialsManagement').then((m) => ({ default: m.MaterialsManagement })));
const HomeworkManagement = lazy(() => import('./pages/HomeworkManagement').then((m) => ({ default: m.HomeworkManagement })));
const ExaminationsManagement = lazy(() => import('./pages/ExaminationsManagement').then((m) => ({ default: m.ExaminationsManagement })));
const QuestionGenerator = lazy(() => import('./pages/QuestionGenerator/QuestionGenerator').then((m) => ({ default: m.QuestionGenerator })));
const ProgressReviewsManagement = lazy(() => import('./pages/ProgressReviewsManagement').then((m) => ({ default: m.ProgressReviewsManagement })));
const MessagingInbox = lazy(() => import('./pages/MessagingInbox').then((m) => ({ default: m.MessagingInbox })));
const FeesManagement = lazy(() => import('./pages/FeesManagement').then((m) => ({ default: m.FeesManagement })));
const RecordedSessions = lazy(() => import('./pages/RecordedSessions').then((m) => ({ default: m.RecordedSessions })));

const getDefaultTabForRole = (role?: string): string => {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'super_admin_dashboard';
    case 'FRANCHISE_OWNER':
      return 'franchise_owner_dashboard';
    case 'BRANCH_ADMIN':
      return 'academic_dashboard';
    case 'ACADEMIC_ADMIN':
      return 'academic_dashboard';
    case 'STAFF':
      return 'my_attendance';
    case 'PARENT':
      return 'parent_dashboard';
    case 'STUDENT':
      return 'student_portal';
    default:
      return 'academic_dashboard';
  }
};

const isTabAllowedForRole = (tab: string, role?: string): boolean => {
  if (!role) return false;
  switch (role) {
    case 'SUPER_ADMIN':
      return ['super_admin_dashboard', 'franchise_management', 'course_management', 'monthly_settlements', 'staff', 'students', 'academics', 'exams', 'fees', 'recorded_sessions'].includes(tab);
    case 'FRANCHISE_OWNER':
      return ['franchise_owner_dashboard', 'franchise_courses', 'franchise_branches', 'franchise_royalties', 'franchise_agreements', 'monthly_settlements', 'academic_dashboard', 'students', 'staff', 'staff_attendance', 'academics', 'exams', 'question_generator', 'fees', 'messaging', 'progress_reviews', 'recorded_sessions'].includes(tab) || tab.startsWith('franchise_');
    case 'BRANCH_ADMIN':
    case 'ACADEMIC_ADMIN':
      return ['academic_dashboard', 'franchise_courses', 'staff', 'staff_attendance', 'students', 'academics', 'exams', 'question_generator', 'progress_reviews', 'messaging', 'fees', 'recorded_sessions'].includes(tab);
    case 'STAFF':
      return ['my_attendance', 'attendance', 'academic_dashboard', 'exams', 'materials', 'homework', 'progress_reviews', 'messaging', 'recorded_sessions'].includes(tab);
    case 'PARENT':
      return tab === 'parent_portal' || tab.startsWith('parent_') || tab === 'progress_reviews' || tab === 'recorded_sessions';
    case 'STUDENT':
      return ['student_portal', 'exams', 'progress_reviews', 'recorded_sessions'].includes(tab) || tab.startsWith('student_');
    default:
      return false;
  }
};

const AppContent: React.FC = () => {
  useFormKeyboardNavigation();
  const { user, loading } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<string>(() => {
    const raw = window.location.pathname.replace(/^\//, '').trim();
    if (raw && raw !== '/') {
      return raw === 'learning_materials' ? 'materials' : raw;
    }
    return 'academic_dashboard';
  });

  useEffect(() => {
    if (user) {
      const raw = window.location.pathname.replace(/^\//, '').trim();
      const targetTab = raw === 'learning_materials' ? 'materials' : raw;
      if (targetTab && isTabAllowedForRole(targetTab, user.role)) {
        setCurrentTab(targetTab);
      } else {
        const defaultTab = getDefaultTabForRole(user.role);
        setCurrentTab(defaultTab);
        window.history.replaceState({}, '', `/${defaultTab}`);
      }
    }
  }, [user]);

  useEffect(() => {
    const handleTabChange = (e: any) => {
      const { tab } = e.detail || {};
      if (tab) {
        const normalized = tab === 'learning_materials' ? 'materials' : tab;
        if (!user || isTabAllowedForRole(normalized, user.role)) {
          setCurrentTab(normalized);
        }
      }
    };
    const handlePopState = () => {
      const raw = window.location.pathname.replace(/^\//, '').trim();
      if (raw) {
        const normalized = raw === 'learning_materials' ? 'materials' : raw;
        if (!user || isTabAllowedForRole(normalized, user.role)) {
          setCurrentTab(normalized);
        } else if (user) {
          const defaultTab = getDefaultTabForRole(user.role);
          setCurrentTab(defaultTab);
          window.history.replaceState({}, '', `/${defaultTab}`);
        }
      }
    };

    window.addEventListener('tuitionos:tab-change', handleTabChange);
    window.addEventListener('dg:tab-change', handleTabChange);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('tuitionos:tab-change', handleTabChange);
      window.removeEventListener('dg:tab-change', handleTabChange);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [user]);

  // Background-prefetch primary modules during idle time for instant tab switches
  useEffect(() => {
    if (!user) return;
    const prefetch = () => {
      if (user.role === 'SUPER_ADMIN') {
        loadSuperAdminDashboard();
        loadFranchiseManagement();
        loadCourseManagement();
      } else if (user.role === 'FRANCHISE_OWNER' || user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN') {
        loadFranchiseCourses();
      }
    };
    const id = typeof (window as any).requestIdleCallback === 'function'
      ? (window as any).requestIdleCallback(prefetch, { timeout: 1500 })
      : window.setTimeout(prefetch, 600);
    return () => {
      if (typeof (window as any).cancelIdleCallback === 'function') {
        (window as any).cancelIdleCallback(id);
      } else {
        window.clearTimeout(id);
      }
    };
  }, [user]);

  useEffect(() => {
    if (user && !isTabAllowedForRole(currentTab, user.role)) {
      const defaultTab = getDefaultTabForRole(user.role);
      setCurrentTab(defaultTab);
      window.history.replaceState({}, '', `/${defaultTab}`);
    }
  }, [user, currentTab]);

  if (loading) {
    return (
      <div className="h-screen bg-[#F8FAFC] overflow-hidden flex items-center justify-center text-slate-800">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/logo-navbar.webp"
            alt="Digital Ghuru"
            className="h-10 w-auto animate-pulse"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-[#006FFF] animate-ping"></div>
            <span className="text-sm font-semibold text-slate-700 font-display">
              Loading Digital Ghuru Franchise...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="h-screen bg-[#F8FAFC] overflow-hidden text-slate-900 flex flex-col font-sans">
      <Navbar onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)} />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          isMobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            setMobileSidebarOpen(false);
            window.history.pushState({}, '', `/${tab}`);
          }}
        />

        <main className="flex-1 overflow-y-auto flex flex-col justify-between bg-[#F8FAFC]">
          <div className="p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto flex-1">
            <Suspense fallback={<PageSkeleton />}>
              <div key={currentTab} className="animate-in fade-in duration-150">
                {currentTab === 'super_admin_dashboard' && user.role === 'SUPER_ADMIN' && (
                  <SuperAdminDashboard
                    onNavigateTab={(tab) => {
                      setCurrentTab(tab);
                      window.history.pushState({}, '', `/${tab}`);
                    }}
                  />
                )}

                {currentTab === 'franchise_management' && user.role === 'SUPER_ADMIN' && (
                  <FranchiseManagement />
                )}

                {currentTab === 'course_management' && user.role === 'SUPER_ADMIN' && (
                  <CourseManagement />
                )}

                {currentTab === 'monthly_settlements' && (user.role === 'SUPER_ADMIN' || user.role === 'FRANCHISE_OWNER') && (
                  <MonthlySettlements />
                )}

                {currentTab === 'franchise_courses' && (user.role === 'FRANCHISE_OWNER' || user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'SUPER_ADMIN') && (
                  <FranchiseCourses />
                )}

                {(currentTab === 'franchise_owner_dashboard' || (currentTab.startsWith('franchise_') && currentTab !== 'franchise_courses')) && user.role === 'FRANCHISE_OWNER' && (
                  <FranchiseOwnerDashboard />
                )}

                {currentTab === 'academic_dashboard' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'STAFF' || user.role === 'SUPER_ADMIN' || user.role === 'FRANCHISE_OWNER') && (
                  <AcademicAdminDashboard onNavigateTab={(tab) => setCurrentTab(tab)} />
                )}

                {currentTab === 'staff' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'FRANCHISE_OWNER') && <StaffManagement />}

                {currentTab === 'staff_attendance' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'FRANCHISE_OWNER') && (
                  <StaffAttendanceAdmin onNavigateTab={(tab) => setCurrentTab(tab)} />
                )}

                {currentTab === 'my_attendance' && user.role === 'STAFF' && <StaffMyAttendance />}

                {currentTab === 'students' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'FRANCHISE_OWNER') && <StudentManagement />}

                {currentTab === 'academics' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'FRANCHISE_OWNER') && (
                  <AcademicsManagement onNavigateTab={(tab) => setCurrentTab(tab)} />
                )}

                {currentTab === 'attendance' && user.role === 'STAFF' && <AttendanceManagement />}

                {(currentTab === 'parent_portal' || currentTab.startsWith('parent_')) && user.role === 'PARENT' && (
                  <ParentPortal
                    initialTab={
                      currentTab === 'parent_portal' || currentTab === 'parent_dashboard'
                        ? 'dashboard'
                        : currentTab.replace('parent_', '')
                    }
                  />
                )}

                {(currentTab === 'student_portal' || currentTab === 'student_courses' || currentTab === 'student_fees') && user.role === 'STUDENT' && (
                  <StudentPortal initialSection={currentTab === 'student_courses' ? 'courses' : currentTab === 'student_fees' ? 'fees' : 'overview'} />
                )}

                {currentTab === 'materials' && (user.role === 'STAFF' || user.role === 'STUDENT' || user.role === 'FRANCHISE_OWNER') && <MaterialsManagement />}

                {currentTab === 'homework' && (user.role === 'STAFF' || user.role === 'STUDENT' || user.role === 'FRANCHISE_OWNER') && <HomeworkManagement />}

                {currentTab === 'exams' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'STAFF' || user.role === 'STUDENT' || user.role === 'FRANCHISE_OWNER') && <ExaminationsManagement />}

                {currentTab === 'question_generator' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'FRANCHISE_OWNER') && <QuestionGenerator />}

                {currentTab === 'progress_reviews' && <ProgressReviewsManagement />}

                {currentTab === 'recorded_sessions' && (user.role === 'FRANCHISE_OWNER' || user.role === 'STUDENT' || user.role === 'SUPER_ADMIN' || user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'STAFF') && (
                  <RecordedSessions onNavigateTab={(tab) => setCurrentTab(tab)} />
                )}

                {currentTab === 'messaging' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'STAFF' || user.role === 'FRANCHISE_OWNER') && <MessagingInbox />}
                {currentTab === 'fees' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'FRANCHISE_OWNER') && <FeesManagement />}
              </div>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
