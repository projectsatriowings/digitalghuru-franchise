import React from 'react';
import {
  Calendar,
  Clock,
  CreditCard,
  Award,
  MessageSquare,
  Bell,
  BookOpen,
  User,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

interface ParentDashboardViewProps {
  summary: any;
  activeStudent: any;
  onNavigateTab: (tab: string) => void;
  formatCurrency: (val: number | string | undefined) => string;
}

export const ParentDashboardView: React.FC<ParentDashboardViewProps> = ({
  summary,
  activeStudent,
  onNavigateTab,
  formatCurrency,
}) => {
  const studentData = summary?.children?.find(
    (c: any) => c.studentId === activeStudent?.id
  ) || summary?.children?.[0];

  const parentName = summary?.parent?.fullName || 'Parent';
  const todayAtt = studentData?.todayAttendance;
  const monthlyAtt = studentData?.monthlyAttendance;
  const fees = studentData?.fees;
  const latestExam = studentData?.latestExamResult;

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return '--:--';
    const d = new Date(timeStr);
    return isNaN(d.getTime())
      ? '--:--'
      : new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(d);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? 'N/A'
      : new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(d);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-[#3E2723] via-[#4E342E] to-[#5D4037] text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-[#D7CCC8] mb-3">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Verified Parent Portal &bull; Digital Guru
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome back, {parentName}
          </h1>
          <p className="text-[#D7CCC8] text-sm mt-1.5 leading-relaxed">
            Monitoring academic growth, daily attendance, fee dues, and teacher communication for{' '}
            <strong className="text-white font-semibold">
              {activeStudent?.firstName} {activeStudent?.lastName}
            </strong>{' '}
            ({activeStudent?.enrollments?.[0]?.batch?.name || 'Class 10'}).
          </p>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's Attendance Card */}
        <div className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#94A3B8] text-xs font-bold uppercase tracking-wider">
              <span>Today's Attendance</span>
              <Calendar className="w-4 h-4 text-[#64748B]" />
            </div>
            <div className="mt-3">
              {todayAtt?.status === 'CHECKED_OUT' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle className="w-3.5 h-3.5" /> Checked Out
                </div>
              ) : todayAtt?.status === 'CHECKED_IN' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle className="w-3.5 h-3.5" /> Present in Class
                </div>
              ) : todayAtt?.status === 'LATE' ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  <Clock className="w-3.5 h-3.5" /> Late Arrival
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]">
                  <Clock className="w-3.5 h-3.5" /> Not Marked Yet
                </div>
              )}
            </div>
            <div className="mt-3 text-xs text-[#64748B] space-y-1">
              <div className="flex justify-between">
                <span>Check-in:</span>
                <strong className="text-[#0F172A] font-mono">{formatTime(todayAtt?.checkInTime)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Check-out:</span>
                <strong className="text-[#0F172A] font-mono">{formatTime(todayAtt?.checkOutTime)}</strong>
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('attendance')}
            className="mt-4 text-xs font-bold text-[#006FFF] hover:text-[#0F172A] inline-flex items-center gap-1 self-start pt-2 border-t border-[#F1F5F9] w-full"
          >
            Monthly Calendar <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Monthly Attendance Card */}
        <div className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#94A3B8] text-xs font-bold uppercase tracking-wider">
              <span>Monthly Attendance</span>
              <TrendingUp className="w-4 h-4 text-[#64748B]" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-black text-[#0F172A]">
                {monthlyAtt?.percentage ?? 100}%
              </span>
              <span className="text-xs text-[#94A3B8]">present</span>
            </div>
            <div className="w-full bg-[#F1F5F9] rounded-full h-2 mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  (monthlyAtt?.percentage ?? 100) >= 80
                    ? 'bg-emerald-600'
                    : (monthlyAtt?.percentage ?? 100) >= 60
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, monthlyAtt?.percentage ?? 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-[#64748B] mt-2">
              Attended <strong className="text-[#0F172A]">{monthlyAtt?.presentDays || 0}</strong> of{' '}
              <strong className="text-[#0F172A]">{monthlyAtt?.totalWorkingDays || 0}</strong> working sessions.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('attendance')}
            className="mt-4 text-xs font-bold text-[#006FFF] hover:text-[#0F172A] inline-flex items-center gap-1 self-start pt-2 border-t border-[#F1F5F9] w-full"
          >
            Full Attendance Log <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Pending Course Fees Card */}
        <div className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#94A3B8] text-xs font-bold uppercase tracking-wider">
              <span>Pending Course Fees</span>
              <CreditCard className="w-4 h-4 text-[#64748B]" />
            </div>
            <div className="mt-3">
              <span
                className={`text-2xl font-black ${
                  (fees?.pendingAmount || 0) > 0 ? 'text-amber-800' : 'text-emerald-800'
                }`}
              >
                {formatCurrency(fees?.pendingAmount || 0)}
              </span>
            </div>
            <p className="text-xs text-[#64748B] mt-1.5">
              {summary?.financialOverview?.nextUpcomingDueDate ? (
                <>
                  Due by:{' '}
                  <strong className="text-[#0F172A]">
                    {formatDate(summary.financialOverview.nextUpcomingDueDate)}
                  </strong>
                </>
              ) : (
                <span className="text-emerald-700 font-medium">All dues cleared</span>
              )}
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('fees')}
            className="mt-4 text-xs font-bold text-[#006FFF] hover:text-[#0F172A] inline-flex items-center gap-1 self-start pt-2 border-t border-[#F1F5F9] w-full"
          >
            {(fees?.pendingAmount || 0) > 0 ? 'Pay Online Now' : 'View Receipts'} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Latest Test Result Card */}
        <div className="p-5 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-[#94A3B8] text-xs font-bold uppercase tracking-wider">
              <span>Latest Test Result</span>
              <Award className="w-4 h-4 text-[#64748B]" />
            </div>
            {latestExam ? (
              <div className="mt-3 space-y-1">
                <span className="text-sm font-bold text-[#0F172A] block truncate">
                  {latestExam.subject} &bull; {latestExam.examTitle}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-[#0F172A]">
                    {latestExam.score} / {latestExam.totalMarks}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      latestExam.percentage >= 40
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {latestExam.percentage}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 text-xs text-[#94A3B8] italic">No published exams yet</div>
            )}
          </div>
          <button
            onClick={() => onNavigateTab('results')}
            className="mt-4 text-xs font-bold text-[#006FFF] hover:text-[#0F172A] inline-flex items-center gap-1 self-start pt-2 border-t border-[#F1F5F9] w-full"
          >
            All Examination Marks <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Action Navigation Cards */}
      <div>
        <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-wider mb-3">
          Parent Quick Access Modules
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigateTab('attendance')}
            className="p-4 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#006FFF] shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#006FFF]/10 text-[#006FFF] flex items-center justify-center group-hover:bg-[#006FFF] group-hover:text-white transition-colors">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-[#0F172A]">Daily Attendance</span>
          </button>

          <button
            onClick={() => onNavigateTab('communication')}
            className="p-4 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#006FFF] shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#006FFF]/10 text-[#006FFF] flex items-center justify-center group-hover:bg-[#006FFF] group-hover:text-white transition-colors">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-[#0F172A]">Teacher Chat</span>
          </button>

          <button
            onClick={() => onNavigateTab('fees')}
            className="p-4 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#006FFF] shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#006FFF]/10 text-[#006FFF] flex items-center justify-center group-hover:bg-[#006FFF] group-hover:text-white transition-colors">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-[#0F172A]">Fee Payments</span>
          </button>

          <button
            onClick={() => onNavigateTab('academics')}
            className="p-4 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#006FFF] shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#006FFF]/10 text-[#006FFF] flex items-center justify-center group-hover:bg-[#006FFF] group-hover:text-white transition-colors">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-[#0F172A]">Academic Reports</span>
          </button>

          <button
            onClick={() => onNavigateTab('results')}
            className="p-4 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#006FFF] shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#006FFF]/10 text-[#006FFF] flex items-center justify-center group-hover:bg-[#006FFF] group-hover:text-white transition-colors">
              <Award className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-[#0F172A]">Test Results</span>
          </button>

          <button
            onClick={() => onNavigateTab('profile')}
            className="p-4 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#006FFF] shadow-sm hover:shadow-md transition-all text-center flex flex-col items-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#006FFF]/10 text-[#006FFF] flex items-center justify-center group-hover:bg-[#006FFF] group-hover:text-white transition-colors">
              <User className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-[#0F172A]">Student Profile</span>
          </button>
        </div>
      </div>

      {/* Two-Column Activity & Communication Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Child Profile & Batch Overview */}
        <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
            <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
              <User className="w-4 h-4 text-[#64748B]" /> Linked Student Profile
            </h3>
            <span className="text-xs font-mono font-bold text-[#006FFF] bg-[#F8FAFC] px-2.5 py-1 rounded-lg border border-[#E2E8F0]">
              {activeStudent?.admissionNumber}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9]">
              <span className="text-[#94A3B8] text-[10px] uppercase font-bold block">Full Name</span>
              <span className="text-[#0F172A] font-bold mt-0.5 block truncate">
                {activeStudent?.firstName} {activeStudent?.lastName}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9]">
              <span className="text-[#94A3B8] text-[10px] uppercase font-bold block">Batch Class</span>
              <span className="text-[#0F172A] font-bold mt-0.5 block truncate">
                {activeStudent?.enrollments?.[0]?.batch?.name || 'Class 10'}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9]">
              <span className="text-[#94A3B8] text-[10px] uppercase font-bold block">Status</span>
              <span className="text-emerald-800 font-bold mt-0.5 block">Active Enrolled</span>
            </div>
            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9]">
              <span className="text-[#94A3B8] text-[10px] uppercase font-bold block">Gender</span>
              <span className="text-[#0F172A] font-medium mt-0.5 block">
                {activeStudent?.gender || 'Not specified'}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9]">
              <span className="text-[#94A3B8] text-[10px] uppercase font-bold block">Blood Group</span>
              <span className="text-[#0F172A] font-medium mt-0.5 block">
                {activeStudent?.bloodGroup || 'Not specified'}
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#F1F5F9]">
              <span className="text-[#94A3B8] text-[10px] uppercase font-bold block">Institute</span>
              <span className="text-[#0F172A] font-medium mt-0.5 block truncate">
                {activeStudent?.institute?.name || 'Course Centre'}
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={() => onNavigateTab('profile')}
              className="text-xs font-bold text-[#006FFF] hover:text-[#0F172A] inline-flex items-center gap-1"
            >
              View Full Profile & Attendance QR Pass <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Communication & Notifications Banner */}
        <div className="p-6 rounded-3xl bg-white border border-[#E2E8F0] shadow-sm space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-3">
              <h3 className="text-base font-bold text-[#0F172A] flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#64748B]" /> Teacher Communication & Alerts
              </h3>
              {(summary?.unreadCounts?.messages || 0) > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#006FFF] text-white">
                  {summary.unreadCounts.messages} unread
                </span>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#006FFF]/10 text-[#006FFF] flex items-center justify-center shrink-0 mt-0.5">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <h4 className="font-bold text-[#0F172A]">Direct Faculty Channel</h4>
                <p className="text-[#64748B] mt-0.5">
                  Have questions about your child's progress, homework, or attendance? Send a direct message to their class and subject teachers.
                </p>
                <button
                  onClick={() => onNavigateTab('communication')}
                  className="mt-2.5 px-3 py-1.5 rounded-xl bg-[#006FFF] hover:bg-[#0058D4] text-white font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Start / Continue Conversation
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs p-3 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-900">
              <span className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-700" />
                <span>
                  You have <strong className="font-bold">{summary?.unreadCounts?.notifications || 0}</strong> unread notifications
                </span>
              </span>
              <button
                onClick={() => onNavigateTab('notifications')}
                className="font-bold text-amber-900 hover:underline"
              >
                View Alerts
              </button>
            </div>
          </div>

          <div className="text-[11px] text-[#94A3B8] italic pt-2 border-t border-[#F1F5F9]">
            Note: All teacher remarks and marks are officially verified by institute faculty.
          </div>
        </div>
      </div>
    </div>
  );
};
