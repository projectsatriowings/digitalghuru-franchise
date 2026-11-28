import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { parseVideoSource, CoursePlayer } from '../components/CoursePlayer';
import {
  Video,
  Play,
  PlayCircle,
  Clock,
  BookOpen,
  Search,
  Filter,
  CheckCircle2,
  Award,
  Sparkles,
  Laptop,
  ChevronRight,
  X,
  ExternalLink,
  Eye,
  Building2,
  Layers,
  ArrowRight,
  Check,
  Loader2,
  RefreshCw,
  Tv,
} from 'lucide-react';

export interface RecordedSessionItem {
  id: string;
  title: string;
  description?: string | null;
  videoUrl: string;
  duration?: string | null;
  durationMinutes?: number | null;
  position: number;
  isFree?: boolean;
  moduleId: string;
  moduleTitle: string;
  courseId: string;
  courseTitle: string;
  courseThumbnail?: string | null;
  categoryName?: string;
  batchName?: string | null;
  isCompleted?: boolean;
}

const parseDurationToMinutes = (dur?: string | null): number => {
  if (!dur) return 15;
  const parts = dur.split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return Math.round(parts[0] + parts[1] / 60);
  }
  const num = parseInt(dur, 10);
  return isNaN(num) ? 15 : num;
};

interface RecordedSessionsProps {
  onNavigateTab?: (tab: string) => void;
  /** Optional student context when rendered inside ParentPortal */
  parentStudentContext?: any;
}

export const RecordedSessions: React.FC<RecordedSessionsProps> = ({
  onNavigateTab,
  parentStudentContext,
}) => {
  const { user, activeInstitute } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<RecordedSessionItem[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; title: string; count: number }>>([]);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'COMPLETED' | 'UNWATCHED'>('ALL');

  // Video playback modal state
  const [activeSession, setActiveSession] = useState<RecordedSessionItem | null>(null);
  const [activePlayerCourseId, setActivePlayerCourseId] = useState<string | null>(null);
  const [completingSessionId, setCompletingSessionId] = useState<string | null>(null);
  const [completionSuccessMsg, setCompletionSuccessMsg] = useState<string | null>(null);

  const isStudent = user?.role === 'STUDENT';
  const isParent = user?.role === 'PARENT' || Boolean(parentStudentContext);
  const isOwner = user?.role === 'FRANCHISE_OWNER' || user?.role === 'SUPER_ADMIN' || user?.role === 'ACADEMIC_ADMIN' || user?.role === 'BRANCH_ADMIN';

  // Load sessions depending on role
  const loadSessionsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const items: RecordedSessionItem[] = [];
      const courseMap = new Map<string, { id: string; title: string; count: number }>();

      if (isStudent || isParent) {
        // Student or Parent: fetch learning dashboard
        const studentIdParam = parentStudentContext?.id ? `?studentId=${encodeURIComponent(parentStudentContext.id)}` : '';
        const res = await apiFetch(`/courses/learning/my-dashboard${studentIdParam}`, { skipCache: true });

        if (res.success && res.data) {
          const enrollments = res.data.enrollments || [];
          const completedSet = new Set((res.data.progress || []).map((p: any) => p.chapterId));

          for (const enr of enrollments) {
            const course = enr.course;
            if (!course) continue;

            const courseId = course.id;
            const courseTitle = course.title;
            const courseThumbnail = course.thumbnailUrl;
            const categoryName = course.category?.name || 'General';
            const batchName = enr.batch?.name || null;

            const modules = course.activeCurriculumVersion?.modules || [];
            let courseSessionCount = 0;

            for (const mod of modules) {
              const chapters = mod.chapters || [];
              for (const ch of chapters) {
                if (ch.videoUrl && ch.videoUrl.trim()) {
                  courseSessionCount++;
                  const isCompleted = completedSet.has(ch.id);

                  items.push({
                    id: ch.id,
                    title: ch.title,
                    description: ch.description,
                    videoUrl: ch.videoUrl.trim(),
                    duration: ch.duration,
                    durationMinutes: parseDurationToMinutes(ch.duration),
                    position: ch.position || 0,
                    isFree: ch.isFree,
                    moduleId: mod.id,
                    moduleTitle: mod.title,
                    courseId,
                    courseTitle,
                    courseThumbnail,
                    categoryName,
                    batchName,
                    isCompleted,
                  });
                }
              }
            }

            if (courseSessionCount > 0) {
              courseMap.set(courseId, { id: courseId, title: courseTitle, count: courseSessionCount });
            }
          }
        }
      } else {
        // Franchise Owner / Administrator: fetch franchise courses
        let targetFranchiseId: string | null = null;
        try {
          const ctxRes = await apiFetch('/courses/my-franchise-context');
          targetFranchiseId = ctxRes?.data?.franchise?.id || null;
        } catch {
          // Fallback to active institute if franchise context unavailable
          if (activeInstitute?.id && activeInstitute.id !== 'ALL') {
            targetFranchiseId = activeInstitute.id;
          }
        }

        if (targetFranchiseId) {
          const res = await apiFetch(`/courses/franchise/${targetFranchiseId}`, { skipCache: true });
          if (res.success && Array.isArray(res.data)) {
            for (const course of res.data) {
              const courseId = course.id;
              const courseTitle = course.title;
              const courseThumbnail = course.thumbnailUrl;
              const categoryName = course.category?.name || 'Curriculum';

              const modules = course.activeCurriculumVersion?.modules || [];
              let courseSessionCount = 0;

              for (const mod of modules) {
                const chapters = mod.chapters || [];
                for (const ch of chapters) {
                  if (ch.videoUrl && ch.videoUrl.trim()) {
                    courseSessionCount++;
                    items.push({
                      id: ch.id,
                      title: ch.title,
                      description: ch.description,
                      videoUrl: ch.videoUrl.trim(),
                      duration: ch.duration,
                      durationMinutes: parseDurationToMinutes(ch.duration),
                      position: ch.position || 0,
                      isFree: ch.isFree,
                      moduleId: mod.id,
                      moduleTitle: mod.title,
                      courseId,
                      courseTitle,
                      courseThumbnail,
                      categoryName,
                      batchName: null,
                    });
                  }
                }
              }

              if (courseSessionCount > 0) {
                courseMap.set(courseId, { id: courseId, title: courseTitle, count: courseSessionCount });
              }
            }
          }
        }
      }

      setSessions(items);
      setCourses(Array.from(courseMap.values()));
    } catch (err: any) {
      setError(err.message || 'Failed to load recorded sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionsData();
  }, [user?.role, parentStudentContext?.id, activeInstitute?.id]);

  // Handle Mark Complete & Claim XP for student
  const handleMarkComplete = async (session: RecordedSessionItem) => {
    if (!isStudent) return;
    try {
      setCompletingSessionId(session.id);
      setCompletionSuccessMsg(null);
      const res = await apiFetch('/courses/learning/complete-lesson', {
        method: 'POST',
        body: JSON.stringify({
          courseId: session.courseId,
          chapterId: session.id,
        }),
      });

      if (res.success) {
        setCompletionSuccessMsg(`Session completed! +${res.data?.xpGained || 50} XP earned.`);
        setSessions((prev) =>
          prev.map((s) => (s.id === session.id ? { ...s, isCompleted: true } : s))
        );
        setTimeout(() => setCompletionSuccessMsg(null), 3500);
      }
    } catch (err: any) {
      console.warn('Failed to mark lesson complete:', err);
    } finally {
      setCompletingSessionId(null);
    }
  };

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Course filter
      if (selectedCourseFilter !== 'ALL' && s.courseId !== selectedCourseFilter) {
        return false;
      }
      // Status filter
      if (selectedStatusFilter === 'COMPLETED' && !s.isCompleted) {
        return false;
      }
      if (selectedStatusFilter === 'UNWATCHED' && s.isCompleted) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = s.title.toLowerCase().includes(q);
        const matchesCourse = s.courseTitle.toLowerCase().includes(q);
        const matchesModule = s.moduleTitle.toLowerCase().includes(q);
        const matchesDesc = (s.description || '').toLowerCase().includes(q);
        if (!matchesTitle && !matchesCourse && !matchesModule && !matchesDesc) {
          return false;
        }
      }
      return true;
    });
  }, [sessions, selectedCourseFilter, selectedStatusFilter, searchQuery]);

  // Aggregated Stats
  const stats = useMemo(() => {
    const totalCount = sessions.length;
    const completedCount = sessions.filter((s) => s.isCompleted).length;
    const totalMinutes = sessions.reduce((acc, s) => acc + (s.durationMinutes || 15), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;
    return {
      totalCount,
      completedCount,
      totalHours,
      totalCourses: courses.length,
    };
  }, [sessions, courses]);

  // Full Course Player handover
  if (activePlayerCourseId) {
    return (
      <CoursePlayer
        courseId={activePlayerCourseId}
        onBack={() => {
          setActivePlayerCourseId(null);
          loadSessionsData();
        }}
        onProgressUpdated={loadSessionsData}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shadow-xs">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
                {isStudent
                  ? 'My Recorded Sessions & Video Lectures'
                  : isParent
                  ? `${parentStudentContext?.firstName || 'Student'}'s Recorded Sessions`
                  : 'Franchise Recorded Sessions & Video Library'}
              </h1>
              <p className="text-xs text-[#64748B] mt-0.5">
                {isStudent
                  ? 'Directly stream classroom recordings, online lecture videos, and topic demonstrations.'
                  : isParent
                  ? 'Review recorded class lectures and video lessons assigned to your child.'
                  : 'Browse all video recordings, lecture URLs, and digital curriculum sessions across enabled courses.'}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadSessionsData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-[#E2E8F0] bg-white rounded-xl text-xs font-semibold text-[#0F172A] hover:bg-[#F8FAFC] shadow-xs transition self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#64748B] ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Library</span>
        </button>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Total Sessions</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <Tv className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-[#0F172A] mt-2">
            {loading ? '...' : stats.totalCount}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">Recorded video lectures</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Content Hours</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-sky-700 mt-2">
            {loading ? '...' : `${stats.totalHours} hrs`}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">Total recording duration</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Courses</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-700 mt-2">
            {loading ? '...' : stats.totalCourses}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">Available learning programs</div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
              {isOwner ? 'Live Access' : 'Completed'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 mt-2">
            {loading ? '...' : isOwner ? '100% Active' : `${stats.completedCount} / ${stats.totalCount}`}
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">
            {isOwner ? 'Classroom & online LMS' : 'Sessions watched'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 bg-white border border-[#E2E8F0] rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by lecture title, chapter, course, or topic..."
              className="w-full bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl pl-9 pr-4 py-2 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#006FFF]/20"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-[#94A3B8] hover:text-[#0F172A]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Course Filter Dropdown */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#64748B]" />
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="bg-[#FAF8F5] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#0F172A] focus:outline-none font-medium"
              >
                <option value="ALL">All Courses ({sessions.length})</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter (Students / Parents) */}
            {(isStudent || isParent) && (
              <div className="flex items-center bg-[#FAF8F5] p-0.5 rounded-xl border border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    selectedStatusFilter === 'ALL'
                      ? 'bg-white text-[#006FFF] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('UNWATCHED')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    selectedStatusFilter === 'UNWATCHED'
                      ? 'bg-white text-[#006FFF] shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Pending
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStatusFilter('COMPLETED')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    selectedStatusFilter === 'COMPLETED'
                      ? 'bg-white text-emerald-700 shadow-xs'
                      : 'text-[#64748B] hover:text-[#0F172A]'
                  }`}
                >
                  Watched
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Sessions Grid */}
      {loading ? (
        <div className="p-16 text-center text-[#94A3B8] text-sm flex flex-col items-center justify-center gap-3 bg-white rounded-3xl border border-[#E2E8F0]">
          <Loader2 className="w-8 h-8 rounded-full animate-spin text-rose-500" />
          <span className="font-semibold text-xs">Loading recorded lectures and curriculum video streams...</span>
        </div>
      ) : error ? (
        <div className="p-8 rounded-3xl bg-rose-50 border border-rose-200 text-rose-800 text-sm text-center">
          <p className="font-bold">{error}</p>
          <button
            onClick={loadSessionsData}
            className="mt-3 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 transition"
          >
            Retry
          </button>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-[#E2E8F0] space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-500 border border-rose-200 flex items-center justify-center mx-auto">
            <Video className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-[#0F172A] text-base">No recorded sessions match your filters</h3>
          <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
            {sessions.length === 0
              ? 'No video lessons are currently published in your enrolled courses. Once instructors attach video lectures to curriculum chapters, they will appear here.'
              : 'Try clearing your search query or selecting a different course from the dropdown.'}
          </p>
          {(searchQuery || selectedCourseFilter !== 'ALL' || selectedStatusFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCourseFilter('ALL');
                setSelectedStatusFilter('ALL');
              }}
              className="px-4 py-2 rounded-xl bg-[#FAF8F5] border border-[#E2E8F0] text-xs font-bold text-[#0F172A] hover:bg-[#F8FAFC]"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSessions.map((session, index) => {
            const parsed = parseVideoSource(session.videoUrl);
            const providerType = parsed?.type || 'direct';

            return (
              <div
                key={`${session.courseId}-${session.id}-${index}`}
                className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden hover:border-[#006FFF]/40 hover:shadow-md transition-all flex flex-col group"
              >
                {/* Card Top Banner / Course Info */}
                <div className="p-4 pb-3 border-b border-[#F1F5F9] bg-[#FAF8F5] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border border-[#E2E8F0] text-[#006FFF] shrink-0">
                      {session.categoryName || 'Course'}
                    </span>
                    <span className="text-xs font-bold text-[#0F172A] truncate" title={session.courseTitle}>
                      {session.courseTitle}
                    </span>
                  </div>

                  {session.isCompleted ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                      <Check className="w-3 h-3 text-emerald-600" /> Watched
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-white border border-[#E2E8F0] px-2 py-0.5 rounded-full shrink-0">
                      {session.durationMinutes ? `${session.durationMinutes}m` : 'Video'}
                    </span>
                  )}
                </div>

                {/* Session Content Body */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[11px] font-semibold text-[#64748B] flex items-center gap-1.5 mb-1">
                      <Layers className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="truncate">{session.moduleTitle}</span>
                    </div>

                    <h4 className="font-black text-sm text-[#0F172A] group-hover:text-[#006FFF] transition leading-snug">
                      {session.title}
                    </h4>

                    {session.description && (
                      <p className="text-xs text-[#64748B] line-clamp-2 mt-1.5 leading-relaxed">
                        {session.description}
                      </p>
                    )}
                  </div>

                  {/* Metadata tags */}
                  <div className="pt-2 border-t border-[#F8FAFC] flex items-center justify-between text-[11px] text-[#64748B]">
                    <span className="inline-flex items-center gap-1 font-mono uppercase text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                      <Tv className="w-3 h-3 text-rose-500" /> {providerType}
                    </span>
                    {session.batchName && (
                      <span className="text-[10px] font-medium text-slate-500">
                        {session.batchName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-3 bg-white border-t border-[#F1F5F9] flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSession(session)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Watch Recording</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePlayerCourseId(session.courseId)}
                    className="p-2 border border-[#E2E8F0] hover:bg-[#FAF8F5] text-[#64748B] hover:text-[#006FFF] rounded-xl transition"
                    title="Open Full Course Player"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Embedded Video Player Modal */}
      {activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0F172A] border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-900 flex items-center justify-between text-white">
              <div className="min-w-0 pr-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                  <Video className="w-3 h-3" />
                  <span>{activeSession.courseTitle} &bull; {activeSession.moduleTitle}</span>
                </div>
                <h3 className="font-bold text-sm sm:text-base text-white truncate mt-0.5">
                  {activeSession.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setActiveSession(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Video Player Display Container */}
            <div className="relative bg-black flex-1 min-h-[300px] sm:min-h-[460px] flex items-center justify-center">
              {(() => {
                const parsed = parseVideoSource(activeSession.videoUrl);
                if (!parsed) {
                  return (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Invalid or unsupported video source format.
                    </div>
                  );
                }

                if (parsed.type === 'direct') {
                  return (
                    <video
                      key={activeSession.id}
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full max-h-[65vh] object-contain"
                      src={parsed.src}
                    >
                      Your browser does not support standard video playback.
                    </video>
                  );
                }

                return (
                  <iframe
                    key={activeSession.id}
                    src={parsed.src}
                    title={activeSession.title}
                    className="w-full h-full min-h-[340px] sm:min-h-[460px] border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                );
              })()}
            </div>

            {/* Modal Footer Controls */}
            <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-white">
              <div className="flex items-center gap-2">
                {isStudent && (
                  <button
                    type="button"
                    disabled={completingSessionId === activeSession.id || activeSession.isCompleted}
                    onClick={() => handleMarkComplete(activeSession)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                      activeSession.isCompleted
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {completingSessionId === activeSession.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>{activeSession.isCompleted ? 'Completed' : 'Mark as Watched'}</span>
                  </button>
                )}

                {completionSuccessMsg && (
                  <span className="text-xs text-emerald-400 font-semibold animate-in fade-in flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> {completionSuccessMsg}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const courseId = activeSession.courseId;
                    setActiveSession(null);
                    setActivePlayerCourseId(courseId);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
                >
                  <Laptop className="w-3.5 h-3.5 text-sky-400" />
                  <span>Open Full Course</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSession(null)}
                  className="px-4 py-1.5 bg-[#006FFF] hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
