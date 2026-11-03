import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  Layers,
  FileText,
  Award,
  Sparkles,
  FileQuestion,
  MessageSquare,
  CreditCard,
  Bell,
  User,
  Compass,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { user } = useAuth();
  const role = user?.role;

  const navItemClass = (tab: string) => `
    flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer w-full text-left
    ${currentTab === tab
      ? 'bg-[#006FFF] text-white shadow-md shadow-[#006FFF]/30 font-bold'
      : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
    }
  `;

  return (
    <aside className="w-64 border-r border-slate-800 bg-[#0F172A] h-full p-4 flex flex-col justify-between shrink-0 overflow-y-auto select-none">
      <div className="space-y-1">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-display px-3 py-2">
          Navigation Menu
        </div>

        {/* Super Admin Nav Items */}
        {role === 'SUPER_ADMIN' && (
          <>
            <button
              onClick={() => onSelectTab('super_admin_dashboard')}
              className={navItemClass('super_admin_dashboard')}
            >
              <LayoutDashboard className="w-4 h-4" /> Platform Overview
            </button>
            <button
              onClick={() => onSelectTab('franchise_management')}
              className={navItemClass('franchise_management')}
            >
              <Building2 className="w-4 h-4 text-[#FEDC32]" /> Franchise Management
            </button>
            <button
              onClick={() => onSelectTab('staff_attendance')}
              className={navItemClass('staff_attendance')}
            >
              <Calendar className="w-4 h-4" /> Staff Attendance
            </button>
          </>
        )}

        {/* Franchise Owner Nav Items */}
        {role === 'FRANCHISE_OWNER' && (
          <>
            <button
              onClick={() => onSelectTab('franchise_owner_dashboard')}
              className={navItemClass('franchise_owner_dashboard')}
            >
              <LayoutDashboard className="w-4 h-4 text-[#FEDC32]" /> Franchise Dashboard
            </button>
            <button
              onClick={() => onSelectTab('academics')}
              className={navItemClass('academics')}
            >
              <Layers className="w-4 h-4" /> Batches & Subjects
            </button>
            <button
              onClick={() => onSelectTab('staff')}
              className={navItemClass('staff')}
            >
              <Users className="w-4 h-4" /> Staff Management
            </button>
            <button
              onClick={() => onSelectTab('students')}
              className={navItemClass('students')}
            >
              <GraduationCap className="w-4 h-4" /> Student Admissions
            </button>
            <button
              onClick={() => onSelectTab('attendance')}
              className={navItemClass('attendance')}
            >
              <Calendar className="w-4 h-4" /> Class Attendance
            </button>
            <button
              onClick={() => onSelectTab('exams')}
              className={navItemClass('exams')}
            >
              <Award className="w-4 h-4" /> Exams & Marks
            </button>
            <button
              onClick={() => onSelectTab('fees')}
              className={navItemClass('fees')}
            >
              <CreditCard className="w-4 h-4" /> Branch Tuition Fees
            </button>
            <button
              onClick={() => onSelectTab('materials')}
              className={navItemClass('materials')}
            >
              <BookOpen className="w-4 h-4" /> Learning Materials
            </button>
            <button
              onClick={() => onSelectTab('messaging')}
              className={navItemClass('messaging')}
            >
              <MessageSquare className="w-4 h-4" /> Parent Messages
            </button>
          </>
        )}

        {/* Academic Admin Nav Items (Admin does NOT mark student attendance) */}
        {(role === 'ACADEMIC_ADMIN' || role === 'BRANCH_ADMIN') && (
          <>
            <button
              onClick={() => onSelectTab('academic_dashboard')}
              className={navItemClass('academic_dashboard')}
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>

            <button
              onClick={() => onSelectTab('staff')}
              className={navItemClass('staff')}
            >
              <Users className="w-4 h-4" /> Staff Management
            </button>

            <button
              onClick={() => onSelectTab('staff_attendance')}
              className={navItemClass('staff_attendance')}
            >
              <Calendar className="w-4 h-4" /> Staff Attendance
            </button>

            <button
              onClick={() => onSelectTab('students')}
              className={navItemClass('students')}
            >
              <GraduationCap className="w-4 h-4" /> Student Admissions
            </button>

            <button
              onClick={() => onSelectTab('academics')}
              className={navItemClass('academics')}
            >
              <Layers className="w-4 h-4" /> Batches & Subjects
            </button>

            <button
              onClick={() => onSelectTab('exams')}
              className={navItemClass('exams')}
            >
              <Award className="w-4 h-4" /> Exams & Grading
            </button>

            <button
              onClick={() => onSelectTab('question_generator')}
              className={navItemClass('question_generator')}
            >
              <FileQuestion className="w-4 h-4 text-amber-300" /> AI Question Generator
            </button>

            <button
              onClick={() => onSelectTab('progress_reviews')}
              className={navItemClass('progress_reviews')}
            >
              <Sparkles className="w-4 h-4" /> Progress & Reviews
            </button>

            <button
              onClick={() => onSelectTab('messaging')}
              className={navItemClass('messaging')}
            >
              <MessageSquare className="w-4 h-4" /> Parent Messages
            </button>

            <button
              onClick={() => onSelectTab('fees')}
              className={navItemClass('fees')}
            >
              <CreditCard className="w-4 h-4" /> Fees & Finances
            </button>
          </>
        )}

        {/* Teaching Staff Nav Items (Own GPS Attendance + Student Class Attendance) */}
        {role === 'STAFF' && (
          <>
            <button
              onClick={() => onSelectTab('my_attendance')}
              className={navItemClass('my_attendance')}
            >
              <Compass className="w-4 h-4" /> My Attendance (GPS)
            </button>

            <button
              onClick={() => onSelectTab('attendance')}
              className={navItemClass('attendance')}
            >
              <Calendar className="w-4 h-4" /> Student Attendance
            </button>

            <button
              onClick={() => onSelectTab('academic_dashboard')}
              className={navItemClass('academic_dashboard')}
            >
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>

            <button
              onClick={() => onSelectTab('students')}
              className={navItemClass('students')}
            >
              <GraduationCap className="w-4 h-4" /> Student Admissions
            </button>

            <button
              onClick={() => onSelectTab('materials')}
              className={navItemClass('materials')}
            >
              <BookOpen className="w-4 h-4" /> Learning Materials
            </button>

            <button
              onClick={() => onSelectTab('homework')}
              className={navItemClass('homework')}
            >
              <FileText className="w-4 h-4" /> Homework & Tasks
            </button>

            <button
              onClick={() => onSelectTab('exams')}
              className={navItemClass('exams')}
            >
              <Award className="w-4 h-4" /> Exams & Grading
            </button>

            <button
              onClick={() => onSelectTab('progress_reviews')}
              className={navItemClass('progress_reviews')}
            >
              <Sparkles className="w-4 h-4" /> Progress & Reviews
            </button>

            <button
              onClick={() => onSelectTab('messaging')}
              className={navItemClass('messaging')}
            >
              <MessageSquare className="w-4 h-4" /> Parent Messages
            </button>
          </>
        )}

        {/* Parent Portal Nav Items */}
        {role === 'PARENT' && (
          <>
            <button
              onClick={() => onSelectTab('parent_dashboard')}
              className={navItemClass('parent_dashboard')}
            >
              <LayoutDashboard className="w-4 h-4" /> Parent Dashboard
            </button>

            <button
              onClick={() => onSelectTab('parent_attendance')}
              className={navItemClass('parent_attendance')}
            >
              <Calendar className="w-4 h-4" /> Attendance Report
            </button>

            <button
              onClick={() => onSelectTab('parent_communication')}
              className={navItemClass('parent_communication')}
            >
              <MessageSquare className="w-4 h-4" /> Message Teachers
            </button>

            <button
              onClick={() => onSelectTab('parent_fees')}
              className={navItemClass('parent_fees')}
            >
              <CreditCard className="w-4 h-4" /> Fee Payments
            </button>

            <button
              onClick={() => onSelectTab('parent_academics')}
              className={navItemClass('parent_academics')}
            >
              <BookOpen className="w-4 h-4" /> Academic Reports
            </button>

            <button
              onClick={() => onSelectTab('parent_results')}
              className={navItemClass('parent_results')}
            >
              <Award className="w-4 h-4" /> Test Results
            </button>

            <button
              onClick={() => onSelectTab('parent_notifications')}
              className={navItemClass('parent_notifications')}
            >
              <Bell className="w-4 h-4" /> Notifications
            </button>

            <button
              onClick={() => onSelectTab('parent_profile')}
              className={navItemClass('parent_profile')}
            >
              <User className="w-4 h-4" /> Student Profile
            </button>

            <button
              onClick={() => onSelectTab('progress_reviews')}
              className={navItemClass('progress_reviews')}
            >
              <Sparkles className="w-4 h-4" /> Feedback & Reviews
            </button>
          </>
        )}

        {/* Student Portal Nav Items */}
        {role === 'STUDENT' && (
          <>
            <button
              onClick={() => onSelectTab('student_portal')}
              className={navItemClass('student_portal')}
            >
              <GraduationCap className="w-4 h-4" /> My Profile
            </button>

            <button
              onClick={() => onSelectTab('materials')}
              className={navItemClass('materials')}
            >
              <BookOpen className="w-4 h-4" /> Learning Materials
            </button>

            <button
              onClick={() => onSelectTab('homework')}
              className={navItemClass('homework')}
            >
              <FileText className="w-4 h-4" /> Homework Assignments
            </button>

            <button
              onClick={() => onSelectTab('exams')}
              className={navItemClass('exams')}
            >
              <Award className="w-4 h-4" /> Exams & Test Results
            </button>

            <button
              onClick={() => onSelectTab('progress_reviews')}
              className={navItemClass('progress_reviews')}
            >
              <Sparkles className="w-4 h-4" /> Academic Progress
            </button>
          </>
        )}
      </div>

      <div className="pt-4 border-t border-slate-800 text-[11px] text-slate-400 font-display text-center">
        Digital Guru Franchise &bull; Enterprise v2.0
      </div>
    </aside>
  );
};
