import React, { useEffect, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap,
  Users,
  Layers,
  BookOpen,
  CheckCircle2,
  Clock,
  ArrowRight,
  Calendar,
  Compass,
  Award,
  MessageSquare,
} from 'lucide-react';

interface AcademicAdminDashboardProps {
  onNavigateTab: (tab: string) => void;
}

export const AcademicAdminDashboard: React.FC<AcademicAdminDashboardProps> = ({ onNavigateTab }) => {
  const { activeInstitute, user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch('/institutes/dashboard/summary')
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [activeInstitute?.id]);

  const metrics = data?.metrics;
  const isAdminRole = user?.role === 'ACADEMIC_ADMIN' || user?.role === 'BRANCH_ADMIN' || user?.role === 'FRANCHISE_OWNER';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-[#0F172A]">Institute Dashboard</h1>
        <p className="text-sm text-[#64748B] mt-1">
          Academic operations, student enrollment, and trainer overview for{' '}
          <strong className="text-[#0F172A]">{data?.institute?.name || activeInstitute?.name}</strong>
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Active Students</span>
            <div className="w-8 h-8 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#006FFF]">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#0F172A] mt-3">
            {loading ? '...' : metrics?.activeStudents ?? 0}
          </div>
          <div className="text-xs text-[#64748B] mt-1">Enrolled and attending</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Total Trainers</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-800 mt-3">
            {loading ? '...' : metrics?.totalStaff ?? 0}
          </div>
          <div className="text-xs text-[#64748B] mt-1">Teaching & operations</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Academic Batches</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-800">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-sky-800 mt-3">
            {loading ? '...' : metrics?.totalBatches ?? 0}
          </div>
          <div className="text-xs text-[#64748B] mt-1">Active class sections</div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Passed / Alumni</span>
            <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#006FFF]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#006FFF] mt-3">
            {loading ? '...' : metrics?.passedOutStudents ?? 0}
          </div>
          <div className="text-xs text-[#64748B] mt-1">Archived records preserved</div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isAdminRole && (
          <>
            <button
              onClick={() => onNavigateTab('students')}
              className="p-5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#8D6E63] text-left transition-all group shadow-sm hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] text-[#006FFF] border border-[#E2E8F0] flex items-center justify-center mb-4">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-[#0F172A] text-base group-hover:text-[#006FFF] transition">
                Student Admissions
              </h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Admit students, assign roll numbers, and organize class batches.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[#006FFF] mt-4">
                Manage Students <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </span>
            </button>

            <button
              onClick={() => onNavigateTab('staff')}
              className="p-5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#8D6E63] text-left transition-all group shadow-sm hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-[#0F172A] text-base group-hover:text-[#006FFF] transition">
                Trainers
              </h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Provision trainer accounts, assign subjects, and configure permissions.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 mt-4">
                Manage Trainers <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </span>
            </button>

            <button
              onClick={() => onNavigateTab('staff_attendance')}
              className="p-5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#8D6E63] text-left transition-all group shadow-sm hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 flex items-center justify-center mb-4">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-[#0F172A] text-base group-hover:text-[#006FFF] transition">
                Trainer Attendance
              </h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Monitor GPS geofenced check-ins, daily trainer register, and geofence radius.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-800 mt-4">
                View Register <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </span>
            </button>

            <button
              onClick={() => onNavigateTab('academics')}
              className="p-5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#8D6E63] text-left transition-all group shadow-sm hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center mb-4">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-[#0F172A] text-base group-hover:text-[#006FFF] transition">
                Batches & Curriculum
              </h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Manage academic batches, assign subjects, trainers, and student rosters.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 mt-4">
                Manage Batches <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </span>
            </button>
          </>
        )}

        {user?.role === 'STAFF' && (
          <>
            <button
              onClick={() => onNavigateTab('my_attendance')}
              className="p-5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#006FFF] text-left transition-all group shadow-sm hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 flex items-center justify-center mb-4">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-[#0F172A] text-base group-hover:text-[#006FFF] transition">
                My Attendance (GPS)
              </h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Check-in and check-out using geofenced location coordinates.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-800 mt-4">
                Mark Attendance <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </span>
            </button>

            <button
              onClick={() => onNavigateTab('attendance')}
              className="p-5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#006FFF] text-left transition-all group shadow-sm hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center mb-4">
                <Calendar className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-[#0F172A] text-base group-hover:text-[#006FFF] transition">
                Student Attendance
              </h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Mark daily attendance and roll call for students in your classes.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 mt-4">
                Class Register <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </span>
            </button>

            <button
              onClick={() => onNavigateTab('exams')}
              className="p-5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#006FFF] text-left transition-all group shadow-sm hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 flex items-center justify-center mb-4">
                <Award className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-[#0F172A] text-base group-hover:text-[#006FFF] transition">
                Exams & Grading
              </h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Record student marks, generate grading reports, and track performance.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-800 mt-4">
                Open Grading <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </span>
            </button>

            <button
              onClick={() => onNavigateTab('messaging')}
              className="p-5 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#006FFF] text-left transition-all group shadow-sm hover:shadow-md"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center justify-center mb-4">
                <MessageSquare className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-[#0F172A] text-base group-hover:text-[#006FFF] transition">
                Parent Messages
              </h3>
              <p className="text-xs text-[#64748B] mt-1 leading-relaxed">
                Communicate directly with parents and students regarding academic progress.
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-800 mt-4">
                View Messages <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
