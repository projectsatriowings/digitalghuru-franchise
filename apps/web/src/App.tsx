import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { BrandFooter } from './components/BrandFooter';
import { PageSkeleton } from './components/PageSkeleton';
import { ToastProvider } from './context/ToastContext';
import { motion, AnimatePresence } from 'framer-motion';
import { pageTransitionVariants } from './utils/animations';

// Route-level code splitting via React.lazy
const FranchiseManagement = lazy(() => import('./pages/FranchiseManagement').then((m) => ({ default: m.FranchiseManagement })));
const CourseManagement = lazy(() => import('./pages/CourseManagement').then((m) => ({ default: m.CourseManagement })));
const FranchiseCourses = lazy(() => import('./pages/FranchiseCourses').then((m) => ({ default: m.FranchiseCourses })));
const FranchiseOwnerDashboard = lazy(() => import('./pages/FranchiseOwnerDashboard').then((m) => ({ default: m.FranchiseOwnerDashboard })));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard').then((m) => ({ default: m.SuperAdminDashboard })));
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
      return ['super_admin_dashboard', 'franchise_management', 'course_management', 'staff', 'students', 'academics', 'exams', 'fees'].includes(tab);
    case 'FRANCHISE_OWNER':
      return ['franchise_owner_dashboard', 'franchise_courses', 'franchise_branches', 'franchise_royalties', 'franchise_agreements', 'academic_dashboard', 'students', 'staff', 'staff_attendance', 'academics', 'exams', 'fees', 'materials', 'homework', 'attendance', 'messaging', 'progress_reviews'].includes(tab) || tab.startsWith('franchise_');
    case 'BRANCH_ADMIN':
    case 'ACADEMIC_ADMIN':
      return ['academic_dashboard', 'franchise_courses', 'staff', 'staff_attendance', 'students', 'academics', 'exams', 'question_generator', 'progress_reviews', 'messaging', 'fees'].includes(tab);
    case 'STAFF':
      return ['my_attendance', 'attendance', 'academic_dashboard', 'students', 'materials', 'homework', 'exams', 'progress_reviews', 'messaging'].includes(tab);
    case 'PARENT':
      return tab === 'parent_portal' || tab.startsWith('parent_') || tab === 'progress_reviews';
    case 'STUDENT':
      return ['student_portal', 'materials', 'homework', 'exams', 'progress_reviews'].includes(tab) || tab.startsWith('student_');
    default:
      return false;
  }
};

const AppContent: React.FC = () => {
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
            alt="Digital Guru"
            className="h-10 w-auto animate-pulse"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
          <div className="flex items-center gap-3">
            <div className="w-3.5 h-3.5 rounded-full bg-[#006FFF] animate-ping"></div>
            <span className="text-sm font-semibold text-slate-700 font-display">
              Loading Digital Guru Franchise...
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
          <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex-1">
            <Suspense fallback={<PageSkeleton />}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentTab}
                  variants={pageTransitionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                >
                  {currentTab === 'super_admin_dashboard' && user.role === 'SUPER_ADMIN' && (
                    <SuperAdminDashboard />
                  )}

                  {currentTab === 'franchise_management' && user.role === 'SUPER_ADMIN' && (
                    <FranchiseManagement />
                  )}

                  {currentTab === 'course_management' && user.role === 'SUPER_ADMIN' && (
                    <CourseManagement />
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

                    { currentTab === 'staff_attendance' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'FRANCHISE_OWNER') && (
                      <StaffAttendanceAdmin onNavigateTab={(tab) => setCurrentTab(tab)} />
                    )}

                  {currentTab === 'my_attendance' && user.role === 'STAFF' && <StaffMyAttendance />}

                  {currentTab === 'students' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'STAFF' || user.role === 'FRANCHISE_OWNER') && <StudentManagement />}

                  {currentTab === 'academics' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'FRANCHISE_OWNER') && (
                    <AcademicsManagement onNavigateTab={(tab) => setCurrentTab(tab)} />
                  )}

                  {currentTab === 'attendance' && (user.role === 'STAFF' || user.role === 'FRANCHISE_OWNER') && <AttendanceManagement />}

                  {(currentTab === 'parent_portal' || currentTab.startsWith('parent_')) && user.role === 'PARENT' && (
                    <ParentPortal
                      initialTab={
                        currentTab === 'parent_portal' || currentTab === 'parent_dashboard'
                          ? 'dashboard'
                          : currentTab.replace('parent_', '')
                      }
                    />
                  )}

                  {(currentTab === 'student_portal' || currentTab === 'student_courses') && user.role === 'STUDENT' && (
                    <StudentPortal initialSection={currentTab === 'student_courses' ? 'courses' : 'overview'} />
                  )}

                  {currentTab === 'materials' && (user.role === 'STAFF' || user.role === 'STUDENT' || user.role === 'FRANCHISE_OWNER') && <MaterialsManagement />}

                  {currentTab === 'homework' && (user.role === 'STAFF' || user.role === 'STUDENT' || user.role === 'FRANCHISE_OWNER') && <HomeworkManagement />}

                  {currentTab === 'exams' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'STAFF' || user.role === 'STUDENT' || user.role === 'FRANCHISE_OWNER') && <ExaminationsManagement />}

                  {currentTab === 'question_generator' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN') && <QuestionGenerator />}

                  {currentTab === 'progress_reviews' && <ProgressReviewsManagement />}

                  {currentTab === 'messaging' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'STAFF' || user.role === 'FRANCHISE_OWNER') && <MessagingInbox />}
                  {currentTab === 'fees' && (user.role === 'ACADEMIC_ADMIN' || user.role === 'BRANCH_ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'FRANCHISE_OWNER') && <FeesManagement />}
                </motion.div>
              </AnimatePresence>
            </Suspense>
          </div>
          {user.role !== 'SUPER_ADMIN' && <BrandFooter />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
